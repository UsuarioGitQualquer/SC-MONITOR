import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureDailyBucket,
  localDateKey,
  recordMinuteMetric,
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

  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersSum, 9);
  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersSamples, 2);
  assert.equal(bucket.minuteBuckets[minuteKey].tokensUsersPeak, 6);
});
