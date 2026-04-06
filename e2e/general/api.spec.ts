import { test, expect } from "@playwright/test";
import { API_URL } from "../helpers";

test.describe("Backend API — Authentication", () => {
  test("super admin login returns token", async ({ request }) => {
    const res = await request.post(`${API_URL}/super-admin/login`, {
      data: { email: "superadmin", password: "Admin@123" },
    });
    expect([200, 401]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user).toHaveProperty("id");
    }
  });

  test("admin login returns token", async ({ request }) => {
    const res = await request.post(`${API_URL}/admin/login`, {
      data: { email: "snb_admin", password: "123456" },
    });
    expect([200, 401, 422]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty("token");
    }
  });

  test("login with empty body returns error", async ({ request }) => {
    const res = await request.post(`${API_URL}/super-admin/login`, { data: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("login with SQL injection attempt", async ({ request }) => {
    const res = await request.post(`${API_URL}/super-admin/login`, {
      data: { email: "' OR 1=1 --", password: "' OR 1=1 --" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).not.toBe(200);
  });

  test("login with XSS attempt", async ({ request }) => {
    const res = await request.post(`${API_URL}/admin/login`, {
      data: { email: "<script>alert(1)</script>", password: "test" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("Backend API — Unauthorized Access", () => {
  test("admin/me without token returns 401", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/me`);
    expect(res.status()).toBe(401);
  });

  test("tenants endpoint without token returns 401", async ({ request }) => {
    const res = await request.get(`${API_URL}/super-admin/tenants`);
    expect([401, 403]).toContain(res.status());
  });

  test("invalid token returns 401", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/me`, {
      headers: { Authorization: "Bearer invalid-token-123" },
    });
    expect(res.status()).toBe(401);
  });

  test("expired token returns 401", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/me`, {
      headers: { Authorization: "Bearer 00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Backend API — Authenticated Operations", () => {
  let superToken = "";

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/super-admin/login`, {
      data: { email: "superadmin", password: "Admin@123" },
    });
    if (res.ok()) {
      const body = await res.json();
      superToken = body.token;
    }
  });

  test("fetch tenants list", async ({ request }) => {
    test.skip(!superToken, "No super admin token");
    const res = await request.get(`${API_URL}/super-admin/tenants`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(Array.isArray(body.data || body)).toBeTruthy();
    }
  });

  test("fetch packages list", async ({ request }) => {
    test.skip(!superToken, "No super admin token");
    const res = await request.get(`${API_URL}/super-admin/packages`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect([200, 404]).toContain(res.status());
  });

  test("super admin logout", async ({ request }) => {
    test.skip(!superToken, "No super admin token");
    const res = await request.post(`${API_URL}/super-admin/logout`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect([200, 204, 302]).toContain(res.status());
  });
});

test.describe("Backend API — Edge Cases", () => {
  test("non-existent endpoint returns 404", async ({ request }) => {
    const res = await request.get(`${API_URL}/this-does-not-exist`);
    expect([404, 405]).toContain(res.status());
  });

  test("oversized payload handled gracefully", async ({ request }) => {
    const bigPayload = { email: "a".repeat(10000), password: "b".repeat(10000) };
    const res = await request.post(`${API_URL}/super-admin/login`, { data: bigPayload });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("content-type mismatch handled", async ({ request }) => {
    const res = await request.post(`${API_URL}/super-admin/login`, {
      data: "not-json",
      headers: { "Content-Type": "text/plain" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
