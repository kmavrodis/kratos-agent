import { test, expect, request } from "@playwright/test";
import { BACKEND_URL, TRACES_LOOKBACK_HOURS } from "./helpers";

test.describe("traces", () => {
  test("operations list returns; per-op detail returns spans (skip if empty window)", async () => {
    const api = await request.newContext();

    const listResp = await api.get(
      `${BACKEND_URL}/api/traces/operations?hours=${TRACES_LOOKBACK_HOURS}`,
    );
    expect(listResp.status(), "operations list status").toBe(200);
    const list = await listResp.json();
    expect(list, "operations list shape").toHaveProperty("operations");
    const ops: any[] = list.operations ?? [];

    if (ops.length === 0) {
      test.info().annotations.push({
        type: "skip-reason",
        description: `Zero operations in last ${TRACES_LOOKBACK_HOURS}h — likely AppIn ingestion delay or no recent chats`,
      });
      test.skip(true, "no trace operations in window");
      return;
    }

    expect(ops[0], "op has operation_id").toHaveProperty("operation_id");

    const opId = ops[0].operation_id;
    const detailResp = await api.get(
      `${BACKEND_URL}/api/traces/operations/${opId}?hours=${TRACES_LOOKBACK_HOURS}`,
    );
    expect(detailResp.status(), `op ${opId} detail status`).toBe(200);
    const detail = await detailResp.json();
    expect(detail, "op detail shape").toHaveProperty("operation_id", opId);
    expect(Array.isArray(detail.spans), "spans must be an array").toBe(true);
    expect(detail.spans.length, "spans array should be non-empty").toBeGreaterThan(0);
  });
});
