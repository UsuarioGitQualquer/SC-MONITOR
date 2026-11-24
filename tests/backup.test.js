import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackupPayload,
  getBackupDataForModel,
  getBackupModelOptions,
  getBackupScope,
  isBackupStorageKey,
  isMonitorStorageKey,
  mergeModelBackupData,
  parseBackupText,
} from "../src/core/backup.js";

test("exports only SC Monitor local data and omits deprecated automation toggles", () => {
  const payload = createBackupPayload(
    {
      "scm:model:model-1": { totalTokens: 42 },
      scm_rooms_history: { "model-1::2026-11-20": {} },
      scm_auto_collect: true,
      unrelated: "ignored",
    },
    "2026-11-20T12:00:00.000Z",
    "5.0",
  );

  assert.deepEqual(payload, {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-11-20T12:00:00.000Z",
    appVersion: "5.0",
    scope: { type: "all" },
    data: {
      "scm:model:model-1": { totalTokens: 42 },
      scm_rooms_history: { "model-1::2026-11-20": {} },
    },
  });
});

test("accepts only versioned backups with SC Monitor keys", () => {
  const valid = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-11-20T12:00:00.000Z",
    appVersion: "5.0",
    scope: { type: "all" },
    data: { "scm:model:model-1": { totalTokens: 42 } },
  };

  assert.deepEqual(parseBackupText(JSON.stringify(valid)), valid);
  assert.equal(isMonitorStorageKey("scm_rooms_history"), true);
  assert.equal(isMonitorStorageKey("scm:model:model-1"), true);
  assert.equal(isBackupStorageKey("scm_auto_collect"), false);
  assert.equal(isBackupStorageKey("other-extension-data"), false);
});

test("rejects malformed, incompatible, empty, and unsafe backups", () => {
  assert.throws(() => parseBackupText("{"), /JSON válido/);

  const valid = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    scope: { type: "all" },
    data: { "scm:model:model-1": {} },
  };
  assert.throws(
    () => parseBackupText(JSON.stringify({ ...valid, version: BACKUP_VERSION + 1 })),
    /não compatível/,
  );
  assert.throws(
    () => parseBackupText(JSON.stringify({ ...valid, data: {} })),
    /não contém dados/,
  );
  assert.throws(
    () => parseBackupText(JSON.stringify({ ...valid, data: { unrelated: true } })),
    /chave.*não permitida/,
  );
  assert.throws(
    () => parseBackupText(
      '{"format":"sc-monitor-backup","version":1,"data":{"scm:model:x":{"constructor":{"prototype":{"polluted":true}}}}}',
    ),
    /propriedades inválidas/,
  );
});

test("exports a model-only backup with that model's keys and history", () => {
  const storageData = {
    "scm:model:model-1": { modelName: "Modelo 1", totalTokens: 42 },
    "scm:model:model-1:daily:2026-11-20": { dailyTokens: 12 },
    "scm:model:model-2": { modelName: "Modelo 2", totalTokens: 99 },
    scm_rooms_history: {
      "model-1::2026-11-20": { modelId: "model-1", modelName: "Modelo 1" },
      "model-2::2026-11-20": { modelId: "model-2", modelName: "Modelo 2" },
    },
    scm_auto_collect: true,
  };

  const payload = createBackupPayload(
    storageData,
    "2026-11-20T12:00:00.000Z",
    "5.0",
    { type: "model", modelId: "model-1" },
  );

  assert.deepEqual(payload.scope, {
    type: "model",
    modelId: "model-1",
    modelName: "Modelo 1",
  });
  assert.deepEqual(payload.data, {
    "scm:model:model-1": { modelName: "Modelo 1", totalTokens: 42 },
    "scm:model:model-1:daily:2026-11-20": { dailyTokens: 12 },
    scm_rooms_history: {
      "model-1::2026-11-20": { modelId: "model-1", modelName: "Modelo 1" },
    },
  });
  assert.deepEqual(getBackupModelOptions(storageData), [
    { modelId: "model-1", modelName: "Modelo 1" },
    { modelId: "model-2", modelName: "Modelo 2" },
  ]);
  assert.deepEqual(getBackupScope(parseBackupText(JSON.stringify(payload))), payload.scope);
});

test("deduplicates model names that belong to different legacy IDs", () => {
  const options = getBackupModelOptions({
    "scm:model:legacy-id-1": { modelName: "Sample Model", room: "Sample Model" },
    "scm:model:legacy-id-2": { modelName: "Sample Model", room: "Sample Model" },
    scm_rooms_history: {
      "legacy-id-1::2026-11-20": { modelId: "legacy-id-1", modelName: "Sample Model" },
      "legacy-id-2::2026-11-21": { modelId: "legacy-id-2", modelName: "Sample Model" },
    },
  });

  assert.deepEqual(options, [
    { modelId: "legacy-id-1", modelName: "Sample Model" },
  ]);
});

test("merges a model-only restore without deleting other models", () => {
  const currentData = {
    "scm:model:keep": { totalTokens: 50 },
    "scm:model:target": { stale: true },
    "scm:model:target:daily:old": { dailyTokens: 1 },
    scm_rooms_history: {
      "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
      "target::2026-11-19": { modelId: "target", dateKey: "2026-11-19" },
    },
  };
  const incomingData = {
    "scm:model:target": { totalTokens: 80 },
    "scm:model:target:daily:new": { dailyTokens: 20 },
    "scm:model:other": { totalTokens: 100 },
    scm_rooms_history: {
      "target::2026-11-20": { modelId: "target", dateKey: "2026-11-20" },
      "other::2026-11-20": { modelId: "other", dateKey: "2026-11-20" },
    },
  };

  assert.deepEqual(getBackupDataForModel(incomingData, "target"), {
    "scm:model:target": { totalTokens: 80 },
    "scm:model:target:daily:new": { dailyTokens: 20 },
    scm_rooms_history: {
      "target::2026-11-20": { modelId: "target", dateKey: "2026-11-20" },
    },
  });
  assert.deepEqual(mergeModelBackupData(currentData, incomingData, "target"), {
    "scm:model:keep": { totalTokens: 50 },
    "scm:model:target": { totalTokens: 80 },
    "scm:model:target:daily:new": { dailyTokens: 20 },
    scm_rooms_history: {
      "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
      "target::2026-11-20": { modelId: "target", dateKey: "2026-11-20" },
    },
  });
});

test("clears the selected model's history when its backup has no history entries", () => {
  const merged = mergeModelBackupData(
    {
      "scm:model:keep": { totalTokens: 50 },
      "scm:model:target": { stale: true },
      scm_rooms_history: {
        "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
        "target::2026-11-19": { modelId: "target", dateKey: "2026-11-19" },
      },
    },
    { "scm:model:target": { totalTokens: 80 } },
    "target",
  );

  assert.deepEqual(merged, {
    "scm:model:keep": { totalTokens: 50 },
    "scm:model:target": { totalTokens: 80 },
    scm_rooms_history: {
      "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
    },
  });
});

test("keeps version 1 backups scoped to all data and rejects invalid model scopes", () => {
  const legacyBackup = {
    format: BACKUP_FORMAT,
    version: 1,
    data: { "scm:model:model-1": { totalTokens: 42 } },
  };
  assert.deepEqual(getBackupScope(parseBackupText(JSON.stringify(legacyBackup))), {
    type: "all",
  });

  const invalid = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    scope: { type: "model", modelId: "model-1" },
    data: { "scm:model:model-2": { totalTokens: 42 } },
  };
  assert.throws(() => parseBackupText(JSON.stringify(invalid)), /modelo indicada/);
  assert.throws(
    () => createBackupPayload({ "scm:model:model-1": {} }, "now", "5.0", {
      type: "model",
      modelId: "missing",
    }),
    /Não há dados salvos/,
  );
});
