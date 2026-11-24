import { safeStorage } from "./storage.js";

export const AUTOMATION_CONFIG_KEYS = Object.freeze([
  "scm_auto_collect",
  "scm_auto_monitor_live",
  "scm_watched_model_id",
]);

export function loadAutomationConfig(storedConfig = {}) {
  return {
    autoCollectEnabled: false,
    autoMonitorOnLive: false,
    watchedModelId: null,
    hasPersistedAutomationConfig: AUTOMATION_CONFIG_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(storedConfig, key),
    ),
  };
}

export function clearAutomationConfig() {
  safeStorage.remove(AUTOMATION_CONFIG_KEYS);
}
