import { describe, expect, it } from "vitest";
import { landingFor, safeNext } from "./safe-redirect";

describe("safeNext (only paths inside our own site)", () => {
  it("accepts plain paths and keeps the query", () => {
    expect(safeNext("/admin/menu")).toBe("/admin/menu");
    expect(safeNext("/staff?tab=new")).toBe("/staff?tab=new");
  });
  it("normalises dot segments", () => {
    expect(safeNext("/staff/../admin")).toBe("/admin");
  });
  it.each([
    "https://evil.com",
    "http://evil.com/admin",
    "//evil.com",
    "//evil.com/admin",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "/staff\r\nSet-Cookie: x=1",
    "/staff\u0000",
    "admin",
    "",
    "   /admin",
    "/" + "a".repeat(400),
  ])("rejects %j", (bad) => {
    expect(safeNext(bad)).toBeNull();
  });
  it("rejects non-strings", () => {
    for (const v of [undefined, null, 5, {}, ["/admin"]]) expect(safeNext(v)).toBeNull();
  });
});

describe("landingFor (role-aware)", () => {
  it("defaults: owner and manager to /admin, cashier to the board", () => {
    expect(landingFor("owner", null)).toBe("/admin");
    expect(landingFor("manager", undefined)).toBe("/admin");
    expect(landingFor("cashier", "")).toBe("/staff");
  });
  it("returns people to the page they asked for when their role allows it", () => {
    expect(landingFor("owner", "/admin/settings")).toBe("/admin/settings");
    expect(landingFor("manager", "/admin/menu")).toBe("/admin/menu");
    expect(landingFor("cashier", "/staff/orders/abc/slip?w=58")).toBe("/staff/orders/abc/slip?w=58");
  });
  it("sends people to their default when the role does not allow the page", () => {
    expect(landingFor("cashier", "/admin")).toBe("/staff");
    expect(landingFor("cashier", "/admin/menu")).toBe("/staff");
    expect(landingFor("manager", "/admin/settings")).toBe("/admin");
    expect(landingFor("manager", "/admin/staff")).toBe("/admin");
  });
  it("never lands on the login or the redirect page itself, or on a public page", () => {
    expect(landingFor("owner", "/staff/login")).toBe("/admin");
    expect(landingFor("owner", "/staff/go?next=/admin")).toBe("/admin");
    expect(landingFor("cashier", "/menu")).toBe("/staff");
  });
  it("ignores malicious targets", () => {
    for (const role of ["owner", "manager", "cashier"] as const) {
      for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"]) {
        expect(landingFor(role, bad)).toBe(role === "cashier" ? "/staff" : "/admin");
      }
    }
  });
});
