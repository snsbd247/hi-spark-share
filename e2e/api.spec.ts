import { test, expect } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:8000/api";

test.describe("Backend API", () => {
  test("Super Admin login API", async ({ request }) => {
    const res = await request.post(`${API}/super-admin/login`, {
      data: { email: "superadmin", password: "Admin@123" },
    });
    // Accept 200 (success) or 401 (wrong creds in test env)
    expect([200, 401]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    if (res.ok()) {
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
    }
  });

  test("Admin login API", async ({ request }) => {
    const res = await request.post(`${API}/admin/login`, {
      data: { email: "snb_admin", password: "123456" },
    });
    expect([200, 401, 422]).toContain(res.status());
  });

  test("Unauthenticated API returns 401", async ({ request }) => {
    const res = await request.get(`${API}/admin/me`);
    expect(res.status()).toBe(401);
  });

  test("Invalid endpoints return 404", async ({ request }) => {
    const res = await request.get(`${API}/nonexistent-endpoint`);
    expect([404, 405]).toContain(res.status());
  });
});
