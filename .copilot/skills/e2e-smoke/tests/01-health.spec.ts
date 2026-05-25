import { test, expect, request } from "@playwright/test";
import { BACKEND_URL, FRONTEND_URL } from "./helpers";

test.describe("health & runtime config", () => {
  test("backend /health returns ok", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${BACKEND_URL}/health`);
    expect(resp.status(), `backend /health status`).toBe(200);
    const body = await resp.json();
    expect(body, "health JSON shape").toMatchObject({ status: expect.any(String) });
  });

  test("frontend root serves HTML", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${FRONTEND_URL}/`);
    expect(resp.status(), "frontend root status").toBe(200);
    const html = await resp.text();
    expect(html.toLowerCase()).toContain("<!doctype html>");
  });

  test("frontend /config.json points at the same backend host", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${FRONTEND_URL}/config.json`);
    expect(resp.status(), "config.json status").toBe(200);
    const cfg = await resp.json();
    expect(cfg, "config.json shape").toHaveProperty("apiUrl");
    expect(
      cfg.apiUrl.replace(/\/$/, ""),
      "frontend apiUrl should match KRATOS_BACKEND_URL",
    ).toBe(BACKEND_URL.replace(/\/$/, ""));
  });
});
