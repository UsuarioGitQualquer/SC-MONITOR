import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureDailyBucket,
  localDateKey,
  recordMinuteMetric,
  trimCapturedEvents,
} from "../src/core/state.js";

test("records users with tokens in minute buckets", () => {
  const now = new Date();
  const dateKey = localDateKey();
  const bucket = ensureDailyBucket(dateKey);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const minuteKey = `${timeParts.find((part) => part.type === "hour").value}:${timeParts.find((part) => part.type === "minute").value}`;

  recordMinuteMetric(null, 0, 0, false, 8, null, 3);
  recordMinuteMetric(null, 0, 0, false, 8, null, 6);
  recordMinuteMetric(18, 0, 0, false, null, null, null);

  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersSum, 9);
  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersSamples, 2);
  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersPeak, 6);
  assert.equal(bucket.minuteBuckets[minuteKey].viewerSamples, 0);
});

test("retains ticket-show boundaries and ticket records when trimming captured events", () => {
  const marker = { showBoundary: "start", type: "Ticket show" };
  const sale = { type: "Ingresso Ticket", item: "Compra de Ingresso" };
  const events = [
    ...Array.from({ length: 501 }, (_, index) => ({ type: "Chat", id: index })),
    marker,
    sale,
  ];

  const trimmed = trimCapturedEvents(events);

  assert.equal(trimmed.length, 500);
  assert.ok(trimmed.includes(marker));
  assert.ok(trimmed.includes(sale));
});
