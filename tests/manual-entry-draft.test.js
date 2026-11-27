import assert from "node:assert/strict";
import test from "node:test";
import { canRestoreManualEntryDraft } from "../src/ui/manual-entry-draft.js";

const draft = {
  modelId: "model-a",
  dateKey: "2026-11-26",
  mode: "day",
  scope: "day",
};

test("restores a manual entry draft for the same report context", () => {
  assert.equal(canRestoreManualEntryDraft(draft, {
    modelId: "model-a",
    dateKey: "2026-11-26",
    mode: "day",
    sessionId: "session-b",
  }), true);
});

test("does not restore a draft into another model, date, or mode", () => {
  for (const context of [
    { ...draft, modelId: "model-b" },
    { ...draft, dateKey: "2026-11-25" },
    { ...draft, mode: "period" },
  ]) {
    assert.equal(canRestoreManualEntryDraft(draft, context), false);
  }
});

test("restores live-scoped drafts only for the same selected live", () => {
  const liveDraft = { ...draft, scope: "live", sessionId: "session-a" };
  assert.equal(canRestoreManualEntryDraft(liveDraft, {
    ...draft,
    sessionId: "session-a",
  }), true);
  assert.equal(canRestoreManualEntryDraft(liveDraft, {
    ...draft,
    sessionId: "session-b",
  }), false);
});
