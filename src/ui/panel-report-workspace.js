import assert from "node:assert/strict";
import test from "node:test";
import { createPanelReportWorkspace } from "../src/ui/panel-report-workspace.js";

test("ignores report data returned for an outdated render", () => {
  const callbacks = [];
  const workspace = {
    innerHTML: "waiting",
    querySelectorAll: () => [],
  };
  const panel = {
    querySelector: (selector) =>
      selector === "#scm-report-workspace" ? workspace : null,
    contains: (element) => element === workspace,
  };
  const reportState = {
    selectedModelId: "model-a",
    dateA: "2026-01-05",
    dateB: "",
    viewMode: "day",
    timeGranularity: "auto",
  };
  const controller = createPanelReportWorkspace({
    getPanel: () => panel,
    reportState,
    buildGainTypeChart: () => "",
    buildTopDonorsChart: () => "",
    formatSecondsToTime: () => "00:00:00",
    storage: {
      get: (_keys, callback) => callbacks.push(callback),
    },
  });

  controller.render();
  reportState.dateA = "2026-01-06";
  controller.render();
  callbacks[0]({});

  assert.equal(callbacks.length, 2);
  assert.equal(workspace.innerHTML, "waiting");
});

test("renders a session report using its automatic time interval", () => {
  const workspace = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const panel = {
    querySelector: (selector) =>
      selector === "#scm-report-workspace" ? workspace : null,
    contains: (element) => element === workspace,
  };
  const daily = {
    totalTokensDay: 56,
    liveSessions: {
      live1: {
        sessionId: "live1",
        startedAt: "08:14:10",
        endedAt: "08:15:09",
        status: "ATIVA",
        startedAtTs: 1,
        durationSeconds: 59,
        minuteBuckets: {
          "08:14": {
            minute: "08:14",
            tokens: 56,
            viewerSamples: 1,
            viewersSum: 10,
          },
        },
      },
    },
    minuteBuckets: {
      "08:14": {
        minute: "08:14",
        tokens: 56,
        viewerSamples: 1,
        viewersSum: 10,
      },
    },
  };
  const reportState = {
    selectedModelId: "model-a",
    dateA: "2026-11-24",
    dateB: "",
    viewMode: "session",
    timeGranularity: "auto",
    selectedSessionId: "live1",
    selectedLiveBId: "",
    liveBComparisonCleared: false,
    liveFilterEnabled: true,
  };
  const controller = createPanelReportWorkspace({
    getPanel: () => panel,
    reportState,
    buildGainTypeChart: () => "",
    buildTopDonorsChart: () => "",
    formatSecondsToTime: () => "00:00:59",
    storage: {
      get: (_keys, callback) => callback({
        scm_rooms_history: {},
        "scm:model:model-a:daily:2026-11-24": daily,
      }),
    },
  });

  controller.render();

  assert.match(workspace.innerHTML, /Ganhos por Bloco \(1 min\)/);
  assert.match(workspace.innerHTML, />Auto \(1m\)<\/button>/);
});

test("loads and combines same-day report data from all model IDs", () => {
  const workspace = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const panel = {
    querySelector: (selector) =>
      selector === "#scm-report-workspace" ? workspace : null,
    contains: (element) => element === workspace,
  };
  const dateKey = "2026-11-24";
  const modelIds = ["model-id-1", "model-id-2"];
  const reportState = {
    selectedModelId: "model-id-2",
    historyEntries: [{
      modelId: "model-id-2",
      modelIds,
      modelName: "Sample Model",
      dateKey,
    }],
    dateA: dateKey,
    dateB: "",
    viewMode: "day",
    timeGranularity: "auto",
    selectedSessionId: "",
    selectedLiveBId: "",
    liveBComparisonCleared: false,
    liveFilterEnabled: false,
  };
  const dailyById = {
    "model-id-1": {
      totalTokensDay: 1070,
      liveSessions: {
        live1: {
          sessionId: "live1",
          startedAt: "16:12:48",
          startedAtTs: 1,
          tokens: 762,
          durationSeconds: 3653,
        },
        live3: {
          sessionId: "live3",
          startedAt: "17:25:22",
          startedAtTs: 3,
          tokens: 308,
          durationSeconds: 371,
        },
      },
    },
    "model-id-2": {
      totalTokensDay: 547,
      liveSessions: {
        live2: {
          sessionId: "live2",
          startedAt: "17:16:10",
          startedAtTs: 2,
          tokens: 547,
          durationSeconds: 508,
        },
      },
    },
  };
  const controller = createPanelReportWorkspace({
    getPanel: () => panel,
    reportState,
    buildGainTypeChart: () => "",
    buildTopDonorsChart: () => "",
    formatSecondsToTime: () => "00:00:00",
    storage: {
      get: (keys, callback) => {
        assert.ok(keys.includes("scm:model:model-id-1:daily:2026-11-24"));
        assert.ok(keys.includes("scm:model:model-id-2:daily:2026-11-24"));
        callback({
          scm_rooms_history: {},
          "scm:model:model-id-1:daily:2026-11-24": dailyById["model-id-1"],
          "scm:model:model-id-2:daily:2026-11-24": dailyById["model-id-2"],
        });
      },
    },
  });

  controller.render();

  assert.equal(reportState.lastReportA.totalTokens, 1617);
  assert.deepEqual(
    reportState.lastReportA.liveSessions.map((session) => session.startedAt),
    ["16:12:48", "17:16:10", "17:25:22"],
  );
});
