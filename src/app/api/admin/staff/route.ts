import { ApiError } from "@/lib/server/order-service";
import { adminRoute, db, must, mustList, OWNER_ONLY } from "@/lib/server/admin";
import { staffOp } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

async function activeOwners() {
  return mustList(await db().from("profiles").select("user_id").eq("role", "owner").eq("active", true));
}

export const POST = adminRoute(OWNER_ONLY, staffOp, async (input, me) => {
  switch (input.op) {
    case "create": {
      const { data, error } = await db().auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
      if (error || !data.user) {
        const taken = /already|registered|exists/i.test(error?.message ?? "");
        throw new ApiError(taken ? 409 : 500, "create_failed", taken ? "الإيميل ده مسجل قبل كده." : "مقدرناش نعمل الحساب.", taken ? { email: "مسجل قبل كده" } : undefined);
      }
      const { error: pErr } = await db().from("profiles").insert({ user_id: data.user.id, name: input.name, role: input.role, active: true });
      if (pErr) {
        await db().auth.admin.deleteUser(data.user.id); // never leave a login without a profile
        throw new ApiError(500, "db_error", "مقدرناش نعمل الحساب.");
      }
      return { userId: data.user.id };
    }

    case "update": {
      const target = must(await db().from("profiles").select("user_id, role, active").eq("user_id", input.userId).maybeSingle());
      if (!target) throw new ApiError(404, "not_found", "الموظف مش موجود.");
      const losingOwner = target.role === "owner" && target.active && ((input.role && input.role !== "owner") || input.active === false);
      if (input.userId === me.userId && (input.active === false || (input.role && input.role !== me.role))) {
        throw new ApiError(409, "self", "مينفعش تغير صلاحيتك أو توقف حسابك بنفسك.");
      }
      if (losingOwner && (await activeOwners()).length <= 1) {
        throw new ApiError(409, "last_owner", "لازم يفضل مالك واحد شغال على الأقل.");
      }
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.role !== undefined) patch.role = input.role;
      if (input.active !== undefined) patch.active = input.active;
      must(await db().from("profiles").update(patch).eq("user_id", input.userId));
      // a stopped account must stop receiving order alerts right away
      if (input.active === false) await db().from("push_subscriptions").delete().eq("user_id", input.userId);
      return { ok: true };
    }

    case "password": {
      const { error } = await db().auth.admin.updateUserById(input.userId, { password: input.password });
      if (error) throw new ApiError(500, "db_error", "مقدرناش نغير كلمة السر.");
      return { ok: true };
    }

    case "delete": {
      if (input.userId === me.userId) throw new ApiError(409, "self", "مينفعش تمسح حسابك بنفسك.");
      const target = must(await db().from("profiles").select("role, active").eq("user_id", input.userId).maybeSingle());
      if (target?.role === "owner" && target.active && (await activeOwners()).length <= 1) {
        throw new ApiError(409, "last_owner", "لازم يفضل مالك واحد شغال على الأقل.");
      }
      const { error } = await db().auth.admin.deleteUser(input.userId); // profile + devices cascade; order history keeps working
      if (error) throw new ApiError(500, "db_error", "مقدرناش نمسح الحساب.");
      return { ok: true };
    }
  }
});
