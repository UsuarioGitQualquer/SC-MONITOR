import assert from "node:assert/strict";
import test from "node:test";
import { removeManualEntryFromDaily } from "../src/ui/manual-entry-storage.js";

test("removes a manual earning from daily and live copies without changing other events", () => {
  const manualEntry = {
    id: "manual-entry-1",
    manualEntry: true,
    manualAmount: 40,
  };
  const daily = {
    manualEarnings: [manualEntry, {
      id: "manual-entry-2",
      manualEntry: true,
      manualAmount: 15,
    }],
    capturedEvents: [manualEntry, { id: "ticket-sale", type: "Ingresso Ticket" }],
    liveSessions: {
      liveA: { capturedEvents: [manualEntry, { id: "chat-message" }] },
    },
  };

  const result = removeManualEntryFromDaily(daily, manualEntry.id);

  assert.equal(result.removed, true);
  assert.deepEqual(result.daily.manualEarnings.map((entry) => entry.id), ["manual-entry-2"]);
  assert.deepEqual(result.daily.capturedEvents.map((entry) => entry.id), ["ticket-sale"]);
  assert.deepEqual(
    result.daily.liveSessions.liveA.capturedEvents.map((entry) => entry.id),
    ["chat-message"],
  );
  assert.equal(daily.manualEarnings.length, 2);
});

test("does not remove an unrelated or non-manual record with the same id", () => {
  const daily = {
    manualEarnings: [{ id: "same-id", type: "Chat privado", manualEntry: false }],
    capturedEvents: [{ id: "same-id", type: "Gorjeta" }],
  };

  const result = removeManualEntryFromDaily(daily, "same-id");

  assert.equal(result.removed, false);
  assert.deepEqual(result.daily, daily);
});
