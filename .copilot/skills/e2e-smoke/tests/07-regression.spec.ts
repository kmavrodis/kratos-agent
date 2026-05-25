/**
 * Regression coverage for kratos-agent surfaces that pre-date the
 * evals + tracing branch. These specs assert that the existing
 * use-case catalogue, conversation CRUD, skills admin, and settings
 * surfaces still behave correctly after the changes shipped in
 * `feat/evals-and-tracing`.
 *
 * Specs in 01-05 cover the NEW surface (evals, traces, chat); this
 * spec exists so a future change can't quietly break the pre-existing
 * core kratos-agent contract.
 */
import { test, expect, request } from "@playwright/test";
import { BACKEND_URL, USE_CASES } from "./helpers";

test.describe("regression: core kratos-agent surfaces", () => {
  test("GET /api/use-cases returns every configured use-case with schema", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${BACKEND_URL}/api/use-cases`);
    expect(resp.status(), "/api/use-cases status").toBe(200);
    const body = await resp.json();
    expect(body, "shape").toHaveProperty("useCases");
    const cases: any[] = body.useCases;
    const names = cases.map((c) => c.name);
    for (const expected of USE_CASES) {
      expect(names, `use-case '${expected}' missing`).toContain(expected);
    }
    const first = cases[0];
    expect(first.displayName, "displayName").toBeTruthy();
    expect(first.description, "description").toBeTruthy();
    expect(
      typeof first.skillCount,
      "skillCount type",
    ).toBe("number");
    expect(Array.isArray(first.sampleQuestions), "sampleQuestions array").toBe(true);
  });

  test("GET /api/settings returns Foundry config shape", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${BACKEND_URL}/api/settings`);
    expect(resp.status(), "/api/settings status").toBe(200);
    const body = await resp.json();
    expect(body, "settings shape").toHaveProperty("foundryEndpoint");
    expect(body, "settings shape").toHaveProperty("foundryModelDeployment");
    expect(
      typeof body.configured,
      "configured flag is boolean",
    ).toBe("boolean");
    expect(
      body.foundryEndpoint.startsWith("https://"),
      `foundryEndpoint should be https (got ${body.foundryEndpoint})`,
    ).toBe(true);
  });

  test("conversation CRUD round-trip: POST -> GET -> list -> DELETE", async () => {
    const api = await request.newContext();

    const created = await api.post(`${BACKEND_URL}/api/conversations`, {
      data: { useCase: "generic", title: "e2e-smoke regression" },
    });
    expect(created.status(), "create conversation status").toBeLessThan(300);
    const conv = await created.json();
    expect(conv.id, "conversation.id present").toBeTruthy();
    expect(conv.useCase, "conversation.useCase preserved").toBe("generic");

    const id = conv.id;
    try {
      const fetched = await api.get(`${BACKEND_URL}/api/conversations/${id}`);
      expect(fetched.status(), "GET conversation by id").toBe(200);
      const fetchedBody = await fetched.json();
      expect(fetchedBody.id, "GET returns same id").toBe(id);

      const list = await api.get(`${BACKEND_URL}/api/conversations`);
      expect(list.status(), "list conversations status").toBe(200);
      const listBody = await list.json();
      const ids: string[] = (listBody.conversations || []).map((c: any) => c.id);
      expect(ids, "newly-created conversation must appear in list").toContain(id);

      const msgs = await api.get(`${BACKEND_URL}/api/conversations/${id}/messages`);
      expect(msgs.status(), "messages endpoint status").toBe(200);
    } finally {
      const del = await api.delete(`${BACKEND_URL}/api/conversations/${id}`);
      expect(
        [200, 204].includes(del.status()),
        `DELETE conversation expected 200/204, got ${del.status()}`,
      ).toBe(true);
    }
  });

  test("admin/skills catalogue returns >=1 skill with descriptor", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${BACKEND_URL}/api/admin/skills`);
    expect(resp.status(), "admin/skills status").toBe(200);
    const body = await resp.json();
    const skills: any[] = body.skills || [];
    expect(skills.length, "skills count").toBeGreaterThan(0);

    const sample = skills[0];
    expect(sample.name, "skill.name").toBeTruthy();
    expect(sample.description, "skill.description").toBeTruthy();

    const detail = await api.get(
      `${BACKEND_URL}/api/admin/skills/${encodeURIComponent(sample.name)}`,
    );
    expect(detail.status(), `GET admin/skills/${sample.name}`).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.name, "detail.name matches list").toBe(sample.name);
  });

  test("admin/system-prompt returns content", async () => {
    const api = await request.newContext();
    const resp = await api.get(`${BACKEND_URL}/api/admin/system-prompt`);
    expect(resp.status(), "system-prompt status").toBe(200);
    const body = await resp.json();
    expect(body.content, "system-prompt.content").toBeTruthy();
    expect(
      typeof body.content === "string" && body.content.length > 50,
      "system-prompt should be non-trivially long",
    ).toBe(true);
  });
});
