import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDayTimeBars,
  buildTimeBucketBars,
  getAdaptiveTimeStep,
} from "../src/ui/chart-data.js";

function minuteAtOffset(offset) {
  const totalMinutes = offset;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

test("uses automatic chart intervals for the configured live durations", () => {
  const cases = [
    [0, 1],
    [9, 1],
    [10, 2],
    [29, 2],
    [30, 5],
    [59, 5],
    [60, 10],
    [99, 10],
    [100, 20],
    [179, 20],
    [180, 30],
    [299, 30],
    [300, 60],
    [360, 60],
  ];

  cases.forEach(([elapsedMinutes, expectedStep]) => {
    assert.equal(
      getAdaptiveTimeStep([
        { minute: "00:00" },
        { minute: minuteAtOffset(elapsedMinutes) },
      ]),
      expectedStep,
      `expected ${expectedStep} minute interval after ${elapsedMinutes} minutes`,
    );
  });
});

test("builds token charts with the selected one- and twenty-minute intervals", () => {
  const minuteRows = [
    { minute: "10:00", tokens: 2 },
    { minute: "10:01", tokens: 3 },
    { minute: "10:19", tokens: 5 },
    { minute: "10:20", tokens: 7 },
  ];

  const minuteBars = buildTimeBucketBars(minuteRows, 1);
  assert.equal(minuteBars.length, 21);
  assert.deepEqual(
    minuteBars.filter(({ value }) => value > 0).map(({ label, value }) => ({ label, value })),
    [
      { label: "10:00", value: 2 },
      { label: "10:01", value: 3 },
      { label: "10:19", value: 5 },
      { label: "10:20", value: 7 },
    ],
  );
  assert.deepEqual(
    buildDayTimeBars({}, minuteRows, 20).map(({ label, value }) => ({ label, value })),
    [
      { label: "10:00", value: 10 },
      { label: "10:20", value: 7 },
    ],
  );
});

test("does not expand an entire day across long idle periods", () => {
  const bars = buildTimeBucketBars([
    { minute: "00:10", tokens: 1 },
    { minute: "21:30", tokens: 2 },
  ], 5);

  assert.deepEqual(
    bars.map(({ label, value }) => ({ label, value })),
    [
      { label: "00:10", value: 1 },
      { label: "21:30", value: 2 },
    ],
  );
});

test("weights interval audience averages by samples and ignores unsampled minutes", () => {
  const bars = buildTimeBucketBars([
    { minute: "10:00", avgViewers: 10, viewerSamples: 10 },
    { minute: "10:01", avgViewers: 20, viewerSamples: 1 },
    { minute: "10:02", avgViewers: 0, viewerSamples: 0 },
  ], 60);

  assert.equal(bars[0].avgViewers, 11);

  const preciseBars = buildTimeBucketBars([
    { minute: "11:00", avgViewers: 0, viewerSamples: 10, viewersSum: 1 },
    { minute: "11:01", avgViewers: 1, viewerSamples: 10, viewersSum: 8 },
  ], 60);

  assert.equal(preciseBars[0].avgViewers, 0);
});
