"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ signedInButNotStaff }: { signedInButNotStaff: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    signedInButNotStaff ? "الحساب ده مش متفعل كموظف. كلم صاحب المطعم." : null,
  );
  const [busy, setBusy] = useState(false);
  // The button stays off until the page is interactive, so an early tap can never submit the form natively.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Read straight from the form (uncontrolled inputs) so text typed before the page finished loading is not lost.
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return setError("اكتب الإيميل وكلمة السر.");
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(/invalid|credentials/i.test(error.message) ? "الإيميل أو كلمة السر غلط." : "مقدرناش نسجل دخولك. جرب تاني.");
      setBusy(false);
      return;
    }
    router.replace("/staff");
    router.refresh();
  }

  async function switchAccount() {
    await createSupabaseBrowser().auth.signOut();
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-forest px-5 py-10 text-ivory">
      {/* method=post: if someone submits before the page has hydrated, the password can never end up in the URL */}
      <form onSubmit={submit} method="post" className="w-full max-w-sm" noValidate>
        <Image src="/brand/logo.png" alt="كباش" width={96} height={96} priority className="mx-auto size-24" />
        <h1 className="mt-4 text-center font-display text-4xl">دخول الموظفين</h1>
        <p className="mt-1 text-center text-ivory/80">لوحة طلبات كباش</p>

        <label htmlFor="email" className="mt-8 block font-medium">
          الإيميل
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          className="mt-1 h-14 w-full rounded-xl border-2 border-transparent bg-ivory px-4 text-lg text-charcoal outline-none focus:border-saffron"
        />
        <label htmlFor="password" className="mt-4 block font-medium">
          كلمة السر
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          className="mt-1 h-14 w-full rounded-xl border-2 border-transparent bg-ivory px-4 text-lg text-charcoal outline-none focus:border-saffron"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-ember p-3 font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !ready}
          className="mt-6 h-14 w-full rounded-full bg-saffron font-display text-2xl text-charcoal disabled:opacity-50"
        >
          {busy ? "بندخلك…" : "دخول"}
        </button>
        {signedInButNotStaff && (
          <button type="button" onClick={switchAccount} className="mt-4 w-full text-center underline">
            استخدم حساب تاني
          </button>
        )}
      </form>
    </main>
  );
}
