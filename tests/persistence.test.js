import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyDailyBucket,
  resolveStorageKey,
  state,
} from "../src/core/state.js";
import { saveToGlobalHistory } from "../src/core/persistence.js";
import { subscribeToUIRefresh, UI_REFRESH } from "../src/core/ui-refresh.js";
import { buildReportData } from "../src/ui/report-data.js";

const TEST_DAY = "2026-11-19";
const storage = {};
let activeStorageError = null;
let failOnSetCall = 0;
let setCallCount = 0;
let nextGetError = null;

globalThis.document = {
  querySelector(selector) {
    if (!selector.includes("data-model-id")) return null;
    return {
      getAttribute(name) {
        return name === "data-model-id" ? "test-model" : null;
      },
    };
  },
};
globalThis.window = { location: { pathname: "/test-model" } };
globalThis.chrome = {
  runtime: {
    get lastError() {
      return activeStorageError;
    },
  },
  storage: {
    local: {
      get(keys, callback) {
        const error = nextGetError;
        nextGetError = null;
        const result = {};
        if (!error) {
          const requestedKeys = keys === null
            ? Object.keys(storage)
            : Array.isArray(keys)
              ? keys
              : [keys];
          requestedKeys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(storage, key)) {
              result[key] = structuredClone(storage[key]);
            }
          });
        }
        queueMicrotask(() => {
          activeStorageError = error;
          callback(result);
          activeStorageError = null;
        });
      },
      set(values, callback) {
        setCallCount += 1;
        const error =
          setCallCount === failOnSetCall
            ? new Error("simulated storage write failure")
            : null;
        if (!error) {
          Object.entries(values).forEach(([key, value]) => {
            storage[key] = structuredClone(value);
          });
        }
        queueMicrotask(() => {
          activeStorageError = error;
          callback();
          activeStorageError = null;
        });
      },
      remove(keys, callback) {
        const requestedKeys = Array.isArray(keys) ? keys : [keys];
        requestedKeys.forEach((key) => delete storage[key]);
        queueMicrotask(callback);
      },
    },
  },
};

function resetFixture(totalTokens = 0) {
  Object.keys(storage).forEach((key) => delete storage[key]);
  activeStorageError = null;
  failOnSetCall = 0;
  setCallCount = 0;
  nextGetError = null;

  state.room = "test-model";
  state.modelName = "Test Model";
  state.roomKing = "Nenhum";
  state.roomKingName = "";
  state.kingTokens = 0;
  state.kingSiteTokens = 0;
  state.kingTokensSource = "site";
  state.kingThreshold = 0;
  state.kingStateDate = "";
  state.sessionId = "test-session";
  state.totalTokens = totalTokens;
  state.dailyTokenDate = TEST_DAY;
  state.dailyTokenBaseline = 0;
  state._sessionTokensStart = 0;
  state.dailyBuckets = {
    [TEST_DAY]: createEmptyDailyBucket(TEST_DAY, 0, 0),
  };
  state.users = {};
  state.events = [];
  state.capturedEvents = [];
  state.eventSummaryTotals = {};
  state.suspectBots = [];
  state.dismissedSuspectBots = [];
  state.viewerSamples = [];
  state.userStatsSummary = { peak: {}, avg: {}, samplesCount: 0 };
  state.leagueStatsSummary = { peak: {}, avg: {}, samplesCount: 0 };
  resolveStorageKey();
}

function save() {
  return new Promise((resolve) => {
    saveToGlobalHistory(resolve, TEST_DAY);
  });
}

test("reports success only after all history writes finish", async () => {
  resetFixture(25);
  state.currentTicketPrice = 44;

  const result = await save();

  assert.equal(result.ok, true);
  assert.equal(storage["scm:model:test-model"].totalTokens, 25);
  assert.equal("currentTicketPrice" in storage["scm:model:test-model"], false);
  assert.equal(
    storage["scm:model:test-model:daily:2026-11-19"].totalTokensDay,
    25,
  );
  assert.ok(storage.scm_rooms_history["test-model::2026-11-19"]);
});

test("persists captured events in the daily bucket without a duplicate top-level list", async () => {
  resetFixture(0);
  const event = {
    id: "event-1",
    item: "Rose",
    price: 10,
    timestamp: Date.parse(`${TEST_DAY}T12:00:00-03:00`),
  };
  state.capturedEvents = [event];

  const result = await save();

  assert.equal(result.ok, true);
  assert.deepEqual(storage["scm:model:test-model"].capturedEvents, []);
  assert.deepEqual(
    storage["scm:model:test-model"].dailyBuckets[TEST_DAY].capturedEvents,
    [event],
  );
  assert.deepEqual(
    storage[`scm:model:test-model:daily:${TEST_DAY}`].capturedEvents,
    [event],
  );
});

test("persists the latest king of the day and its validated value source", async () => {
  resetFixture(0);
  state.roomKing = "TestModel (615 tk)";
  state.roomKingName = "TestModel";
  state.kingTokens = 615;
  state.kingSiteTokens = 605;
  state.kingTokensSource = "chat";
  state.kingThreshold = 500;
  state.kingStateDate = TEST_DAY;
  state.dailyBuckets[TEST_DAY].kingChatTotals = {
    testmodel: { name: "TestModel", tokens: 615 },
  };

  const result = await save();
  const daily = storage[`scm:model:test-model:daily:${TEST_DAY}`];

  assert.equal(result.ok, true);
  assert.deepEqual(daily.roomKingSnapshot && {
    name: daily.roomKingSnapshot.name,
    tokens: daily.roomKingSnapshot.tokens,
    siteTokens: daily.roomKingSnapshot.siteTokens,
    chatTokens: daily.roomKingSnapshot.chatTokens,
    valueSource: daily.roomKingSnapshot.valueSource,
  }, {
    name: "TestModel",
    tokens: 615,
    siteTokens: 605,
    chatTokens: 615,
    valueSource: "chat",
  });
  assert.equal(daily.kingChatTotals.testmodel.tokens, 615);

  state.roomKingName = "Other";
  state.kingTokens = 700;
  state.kingSiteTokens = 700;
  state.kingTokensSource = "site";
  state.dailyBuckets[TEST_DAY].kingChatTotals.other = {
    name: "Other",
    tokens: 700,
  };
  await save();
  const updatedDaily = storage[`scm:model:test-model:daily:${TEST_DAY}`];
  assert.equal(updatedDaily.roomKingSnapshot.name, "Other");
  assert.equal(updatedDaily.roomKingSnapshot.tokens, 700);
});

test("persists daily menu, roulette, mute, and moderation metrics without double counting", async () => {
  resetFixture(0);
  const timestamp = Date.parse(`${TEST_DAY}T12:00:00-03:00`);
  const bucket = state.dailyBuckets[TEST_DAY];
  bucket.menuOptionTotals = {
    Kiss: { label: "Kiss", count: 2, tokens: 40 },
  };
  bucket.rouletteOutcomeTotals = {
    Gold: { label: "Gold", count: 1, tokens: 0 },
  };
  bucket.mutedUsers = [{
    username: "MutedUser",
    mutedBy: "Moderator",
    lastMessage: "spam",
    timestamp,
  }];
  const dismissedSuspect = { username: "DismissedBot", suspicionScore: 30 };
  const visibleSuspect = { username: "VisibleBot", suspicionScore: 20 };
  bucket.suspectBots = [dismissedSuspect, visibleSuspect];
  state.suspectBots = [dismissedSuspect, visibleSuspect];
  state.dismissedSuspectBots = ["dismissedbot"];
  bucket.largestTip = {
    username: "TopTipper",
    tokens: 500,
    item: "Wheel: Gold",
    type: "Roleta",
    rouletteOutcome: "Gold",
    timestamp,
  };
  bucket.capturedEvents = [{
    id: "smaller-tip",
    username: "AnotherUser",
    price: 250,
    item: "Kiss",
    type: "Menu",
    timestamp,
  }];
  bucket.moderationStats = { attempts: 1, successes: 0, failures: 0, pending: 1 };
  bucket.moderationPendingById = { "moderation-1": "PENDENTE" };

  const firstSave = await save();
  const dailyKey = `scm:model:test-model:daily:${TEST_DAY}`;
  assert.equal(firstSave.ok, true);
  assert.deepEqual(storage[dailyKey].menuOptionTotals.Kiss, {
    label: "Kiss",
    count: 2,
    tokens: 40,
  });
  assert.deepEqual(storage[dailyKey].rouletteOutcomeTotals.Gold, {
    label: "Gold",
    count: 1,
    tokens: 0,
  });
  assert.equal(storage[dailyKey].mutedUsers[0].username, "MutedUser");
  assert.deepEqual(storage[dailyKey].suspectBots.map((suspect) => suspect.username), ["VisibleBot"]);
  assert.equal(storage[dailyKey].largestTip.username, "TopTipper");
  assert.equal(storage[dailyKey].largestTip.tokens, 500);
  assert.deepEqual(storage[dailyKey].moderationStats, {
    attempts: 1,
    successes: 0,
    failures: 0,
    pending: 1,
  });

  const secondSave = await save();
  assert.equal(secondSave.ok, true);
  assert.equal(storage[dailyKey].menuOptionTotals.Kiss.count, 2);
  assert.equal(storage[dailyKey].rouletteOutcomeTotals.Gold.count, 1);
  assert.equal(storage[dailyKey].moderationStats.attempts, 1);

  bucket.moderationStats = { attempts: 1, successes: 1, failures: 0, pending: 0 };
  bucket.moderationPendingById = {};
  const resolvedSave = await save();
  assert.equal(resolvedSave.ok, true);
  assert.equal(storage[dailyKey].moderationStats.pending, 0);
  assert.deepEqual(storage[dailyKey].moderationPendingById, {});
});

test("refreshes report models only after a new history entry is saved", async () => {
  const refreshedSections = [];
  const unsubscribe = subscribeToUIRefresh((section) => {
    refreshedSections.push(section);
  });

  try {
    resetFixture(5);
    failOnSetCall = 3;
    const failedResult = await save();
    assert.equal(failedResult.ok, false);
    assert.deepEqual(refreshedSections, []);

    resetFixture(5);
    const firstResult = await save();
    assert.equal(firstResult.ok, true);
    assert.deepEqual(refreshedSections, [UI_REFRESH.REPORT_MODELS]);

    state.totalTokens = 10;
    const updateResult = await save();
    assert.equal(updateResult.ok, true);
    assert.deepEqual(refreshedSections, [UI_REFRESH.REPORT_MODELS]);
  } finally {
    unsubscribe();
  }
});

test("backfills user and league metrics in older daily records", async () => {
  const reportRefreshes = [];
  const unsubscribe = subscribeToUIRefresh((section, payload) => {
    if (section === UI_REFRESH.REPORT_DATA) reportRefreshes.push(payload);
  });
  resetFixture(0);
  state.userStatsSummary = {
    peak: { listedUsersCount: 25, tokensUsersCount: 15 },
    avg: { listedUsersCount: 22, tokensUsersCount: 12 },
    samplesCount: 1,
  };
  state.leagueStatsSummary = {
    peak: { silver: 181, gold: 103 },
    avg: { silver: 90, gold: 50 },
    samplesCount: 1,
  };
  const dailyStorageKey = `scm:model:test-model:daily:${TEST_DAY}`;
  storage[dailyStorageKey] = {
    modelId: "test-model",
    date: TEST_DAY,
    dayStartTokens: 0,
    dailyTokens: 0,
    totalTokensDay: 0,
    userPeak: {},
    userSum: {},
    userSamplesCount: 0,
    userSessions: {},
    leaguePeak: {},
    leagueSum: {},
    leagueSamplesCount: 0,
    leagueSessions: {},
    minuteBuckets: {},
    liveSessions: {},
    sessions: {},
  };

  let result;
  try {
    result = await save();
  } finally {
    unsubscribe();
  }

  assert.equal(result.ok, true);
  assert.deepEqual(reportRefreshes, [
    { modelId: "test-model", dayKey: TEST_DAY },
  ]);
  const report = buildReportData(
    { modelId: "test-model", dateKey: TEST_DAY },
    storage[dailyStorageKey],
  );
  assert.equal(report.uPeak.listedUsersCount, 25);
  assert.equal(report.uAvg("listedUsersCount"), 22);
  assert.equal(report.uPeak.tokensUsersCount, 15);
  assert.equal(report.lPeak.silver, 181);
  assert.equal(report.lAvg("silver"), 90);
  assert.equal(report.lPeak.gold, 103);
});

test("reports failures in each storage write", async (t) => {
  await t.test("model snapshot write", async () => {
    resetFixture(10);
    failOnSetCall = 1;

    const result = await save();

    assert.equal(result.ok, false);
    assert.match(result.error.message, /simulated storage write failure/);
  });

  await t.test("daily statistics write", async () => {
    resetFixture(10);
    failOnSetCall = 2;

    const result = await save();

    assert.equal(result.ok, false);
    assert.match(result.error.message, /simulated storage write failure/);
  });

  await t.test("room history write", async () => {
    resetFixture(10);
    failOnSetCall = 3;

    const result = await save();

    assert.equal(result.ok, false);
    assert.match(result.error.message, /simulated storage write failure/);
  });
});

test("reports failure when daily statistics cannot be read", async () => {
  resetFixture(10);
  nextGetError = new Error("simulated storage read failure");

  const result = await save();

  assert.equal(result.ok, false);
  assert.match(result.error.message, /simulated storage read failure/);
});

test("serializes concurrent saves and leaves the latest snapshot stored", async () => {
  resetFixture(10);

  const firstSave = save();
  state.totalTokens = 20;
  const secondSave = save();
  const results = await Promise.all([firstSave, secondSave]);

  assert.deepEqual(results.map((result) => result.ok), [true, true]);
  assert.equal(storage["scm:model:test-model"].totalTokens, 20);
  assert.equal(
    storage["scm:model:test-model:daily:2026-11-19"].totalTokensDay,
    20,
  );
});
