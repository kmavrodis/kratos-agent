import { test, expect, request } from "@playwright/test";
import { BACKEND_URL, USE_CASES } from "./helpers";

test.describe("evals runs", () => {
  test("at least one use-case has runs (any status); detail endpoint reachable", async () => {
    const api = await request.newContext();

    let totalRuns = 0;
    let probedDetail = false;
    const summaries: string[] = [];

    for (const useCase of USE_CASES) {
      const resp = await api.get(
        `${BACKEND_URL}/api/use-cases/${useCase}/evals/runs`,
      );
      expect(resp.status(), `${useCase} runs status`).toBe(200);
      const body = await resp.json();
      const runs: any[] = body.runs ?? [];
      totalRuns += runs.length;
      summaries.push(`${useCase}=${runs.length}`);

      if (!probedDetail && runs.length > 0) {
        const runId = runs[0].run_id;
        const detail = await api.get(
          `${BACKEND_URL}/api/use-cases/${useCase}/evals/runs/${runId}`,
        );
        expect(detail.status(), `${useCase}/${runId} detail status`).toBe(200);
        const detailBody = await detail.json();
        expect(detailBody, `${useCase}/${runId} detail shape`).toHaveProperty("run_id", runId);
        probedDetail = true;
      }
    }

    expect(
      totalRuns,
      `total run count across use-cases: ${summaries.join(", ")}`,
    ).toBeGreaterThan(0);
    expect(probedDetail, "at least one run detail probed").toBe(true);
  });
});
