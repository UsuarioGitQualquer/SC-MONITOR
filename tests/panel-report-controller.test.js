import assert from "node:assert/strict";
import test from "node:test";
import { isReportUpdateVisible } from "../src/ui/panel-report-controller.js";

test("refreshes only report updates matching the selected model and visible dates", () => {
  const reportState = {
    selectedModelId: "model-a",
    modelIds: ["model-a", "legacy-model-a"],
    viewMode: "day",
    dateA: "2026-11-20",
    dateB: "2026-11-19",
  };

  assert.equal(
    isReportUpdateVisible(reportState, { modelId: "model-a", dayKey: "2026-11-20" }),
    true,
  );
  assert.equal(
    isReportUpdateVisible(reportState, {
      modelId: "legacy-model-a",
      dayKey: "2026-11-20",
    }),
    true,
  );
  assert.equal(
    isReportUpdateVisible(reportState, { modelId: "model-a", dayKey: "2026-11-18" }),
    false,
  );
  assert.equal(
    isReportUpdateVisible(reportState, { modelId: "model-b", dayKey: "2026-11-20" }),
    false,
  );

  reportState.viewMode = "session";
  assert.equal(
    isReportUpdateVisible(reportState, { modelId: "model-a", dayKey: "2026-11-19" }),
    true,
  );
  assert.equal(
    isReportUpdateVisible(reportState, { modelId: "model-a", dayKey: "2026-11-18" }),
    false,
  );
});
