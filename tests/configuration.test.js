import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_CONFIG_KEYS,
  clearAutomationConfig,
  loadAutomationConfig,
} from "../src/core/configuration.js";

test("loads automation defaults when there is no saved configuration", () => {
  assert.deepEqual(loadAutomationConfig({}), {
    autoCollectEnabled: false,
    autoMonitorOnLive: false,
    watchedModelId: null,
    hasPersistedAutomationConfig: false,
  });
});

test("does not restore automation toggles from previous page loads", () => {
  const saved = {
    scm_auto_collect: true,
    scm_auto_monitor_live: true,
    scm_watched_model_id: "model-1",
  };

  assert.deepEqual(loadAutomationConfig(saved), {
    autoCollectEnabled: false,
    autoMonitorOnLive: false,
    watchedModelId: null,
    hasPersistedAutomationConfig: true,
  });
});

test("clears legacy persisted automation toggles", () => {
  const originalChrome = globalThis.chrome;
  const storage = Object.fromEntries(
    AUTOMATION_CONFIG_KEYS.map((key) => [key, true]),
  );
  let removedKeys = [];
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        remove(keys, callback) {
          removedKeys = Array.isArray(keys) ? keys : [keys];
          removedKeys.forEach((key) => delete storage[key]);
          callback();
        },
      },
    },
  };

  try {
    clearAutomationConfig();
    assert.deepEqual([...removedKeys].sort(), [...AUTOMATION_CONFIG_KEYS].sort());
    assert.deepEqual(storage, {});
  } finally {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  }
});
