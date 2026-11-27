import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeReportViewState,
  resolveReportDateSelection,
} from "../src/ui/report-view-state.js";

test("restores a saved date ahead of the current date when it is still available", () => {
  assert.equal(
    resolveReportDateSelection(
      ["2026-11-26", "2026-11-25", "2026-11-24"],
      "2026-11-24",
      "2026-11-26",
    ),
    "2026-11-24",
  );
});

test("falls back to the preferred or first available date when saved date is unavailable", () => {
  assert.equal(
    resolveReportDateSelection(
      ["2026-11-26", "2026-11-25"],
      "2026-11-24",
      "2026-11-25",
    ),
    "2026-11-25",
  );
  assert.equal(
    resolveReportDateSelection(["2026-11-26", "2026-11-25"], "2026-11-24", ""),
    "2026-11-26",
  );
  assert.equal(resolveReportDateSelection([], "2026-11-24", ""), "");
});

test("normalizes persisted report filters and rejects invalid date values", () => {
  assert.deepEqual(normalizeReportViewState({
    mode: "period",
    modelId: "model-a",
    dateA: "2026-11-25",
    dateB: "2026-02-30",
    sessionA: "session-a",
    comparePeriods: true,
    periodStart: "2026-11-20",
    periodEnd: "2026-11-26",
  }), {
    mode: "period",
    modelId: "model-a",
    dateA: "2026-11-25",
    dateB: "",
    sessionA: "session-a",
    sessionB: "",
    sessionComparisonCleared: false,
    timeGranularity: "",
    periodStart: "2026-11-20",
    periodEnd: "2026-11-26",
    periodGranularity: "",
    comparePeriods: true,
    periodComparisonStart: "",
    periodComparisonEnd: "",
  });
});
