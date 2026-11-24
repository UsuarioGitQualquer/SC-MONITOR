import assert from "node:assert/strict";
import test from "node:test";
import { resolveRoomKing } from "../src/core/room-king.js";
import {
  createEmptyDailyBucket,
  recordDailyKingChatTip,
  state,
} from "../src/core/state.js";

test("keeps the site's king total until it matches captured chat tips", () => {
  const mismatch = resolveRoomKing({
    currentName: "TestModel",
    siteTokens: 605,
    chatTotals: { testmodel: { name: "TestModel", tokens: 600 } },
  });
  assert.deepEqual(mismatch, {
    name: "TestModel",
    tokens: 605,
    siteTokens: 605,
    source: "site",
    threshold: 0,
  });

  const matched = resolveRoomKing({
    currentName: "TestModel",
    siteTokens: 605,
    chatTotals: { testmodel: { name: "TestModel", tokens: 605 } },
  });
  assert.equal(matched.tokens, 605);
  assert.equal(matched.source, "chat");

  const updated = resolveRoomKing({
    currentName: "TestModel",
    siteTokens: 605,
    chatTotals: { testmodel: { name: "TestModel", tokens: 615 } },
    previous: matched,
  });
  assert.equal(updated.tokens, 615);
  assert.equal(updated.source, "chat");
});

test("accepts a higher current site value after the chat total was validated", () => {
  const previous = resolveRoomKing({
    currentName: "Sample Model",
    siteTokens: 60,
    chatTotals: { "sample model": { name: "Sample Model", tokens: 60 } },
  });
  const updated = resolveRoomKing({
    currentName: "Sample Model",
    siteTokens: 1265,
    chatTotals: { "sample model": { name: "Sample Model", tokens: 60 } },
    previous,
  });

  assert.equal(updated.tokens, 1265);
  assert.equal(updated.siteTokens, 1265);
  assert.equal(updated.source, "site");
});

test("uses captured chat tokens when the site has no king value", () => {
  const king = resolveRoomKing({
    currentName: "TestModel",
    siteTokens: 0,
    chatTotals: {
      testmodel: { name: "testmodel", tokens: 10614 },
    },
  });

  assert.deepEqual(king, {
    name: "TestModel",
    tokens: 10614,
    siteTokens: 0,
    source: "chat",
    threshold: 0,
  });
});

test("recognizes the current chat leader after the displayed threshold is reached", () => {
  const king = resolveRoomKing({
    threshold: 500,
    chatTotals: {
      testmodel: { name: "TestModel", tokens: 605 },
      other: { name: "Other", tokens: 499 },
    },
  });

  assert.deepEqual(king, {
    name: "TestModel",
    tokens: 605,
    siteTokens: 0,
    source: "threshold",
    threshold: 500,
  });
});

test("breaks chat leader ties deterministically by username", () => {
  const king = resolveRoomKing({
    threshold: 500,
    chatTotals: {
      usertwo: { name: "User Two", tokens: 600 },
      userone: { name: "User One", tokens: 600 },
    },
  });
  assert.equal(king.name, "User One");
  assert.equal(king.tokens, 600);
  assert.equal(king.source, "threshold");
});

test("counts validated tip messages by user and day", () => {
  const dayKey = "2026-11-20";
  state.dailyBuckets = { [dayKey]: createEmptyDailyBucket(dayKey) };

  assert.equal(recordDailyKingChatTip("TestModel", 605, dayKey), 605);
  assert.equal(recordDailyKingChatTip("testmodel", 10, dayKey), 615);
  assert.deepEqual(state.dailyBuckets[dayKey].kingChatTotals, {
    testmodel: { name: "testmodel", tokens: 615, tips: 2 },
  });
  assert.equal(recordDailyKingChatTip("TestModel", 0, dayKey), 0);
});
