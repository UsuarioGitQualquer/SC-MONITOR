import assert from "node:assert/strict";
import test from "node:test";

const previousChrome = globalThis.chrome;
const previousIndexedDB = globalThis.indexedDB;
const messageListeners = [];
const sentTabMessages = [];
let localData = {};
let indexedData = {};
let monitoringActive = false;
let stripchatTabs = [
  { id: 7, url: "https://stripchat.com/model" },
  { id: 8, url: "https://stripchat.global/model" },
];

globalThis.chrome = {
  runtime: {
    id: "extension-id",
    lastError: null,
    getURL: (path) => `chrome-extension://extension-id/${path}`,
    sendMessage: (_message, callback) => callback?.(),
    onMessage: { addListener: (listener) => messageListeners.push(listener) },
    onInstalled: { addListener: () => {} },
  },
  storage: {
    local: {
      get: (_keys, callback) => callback({ ...localData }),
      remove: (keys, callback) => {
        keys.forEach((key) => delete localData[key]);
        callback();
      },
    },
  },
  tabs: {
    onRemoved: { addListener: () => {} },
    onUpdated: { addListener: () => {} },
    query: (_query, callback) => callback(stripchatTabs),
    sendMessage: (tabId, message, callback) => {
      sentTabMessages.push({ tabId, message });
      if (message.type === "SCM_PREPARE_BACKUP_RESTORE" && monitoringActive && tabId === 8) {
        callback({ ok: false, monitoring: true });
        return;
      }
      if (message.type === "SCM_GET_STATUS") {
        callback({ ok: true, monitoring: monitoringActive, modelId: "model-a" });
        return;
      }
      callback({ ok: true });
    },
  },
};

globalThis.indexedDB = {
  open() {
    const request = {};
    const storeNames = new Set();
    const store = {
      get(key) {
        return createRequest(indexedData[key]);
      },
      getAll() {
        return createRequest(Object.values(indexedData));
      },
      put(record) {
        indexedData[record.key] = structuredClone(record);
        scheduleTransactionComplete(this.transaction);
      },
      delete(key) {
        delete indexedData[key];
        scheduleTransactionComplete(this.transaction);
      },
      clear() {
        indexedData = {};
        scheduleTransactionComplete(this.transaction);
      },
    };
    const database = {
      objectStoreNames: { contains: (name) => storeNames.has(name) },
      createObjectStore(name) {
        storeNames.add(name);
        return store;
      },
      transaction() {
        const transaction = {
          objectStore() {
            const transactionStore = Object.create(store);
            transactionStore.get = (key) => createRequest(indexedData[key], transaction);
            transactionStore.getAll = () => createRequest(Object.values(indexedData), transaction);
            transactionStore.put = (record) => {
              indexedData[record.key] = structuredClone(record);
              scheduleTransactionComplete(transaction);
            };
            transactionStore.delete = (key) => {
              delete indexedData[key];
              scheduleTransactionComplete(transaction);
            };
            transactionStore.clear = () => {
              indexedData = {};
              scheduleTransactionComplete(transaction);
            };
            return transactionStore;
          },
        };
        return transaction;
      },
      close() {},
    };

    queueMicrotask(() => {
      request.result = database;
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
};

function createRequest(value, transaction) {
  const request = {};
  queueMicrotask(() => {
    request.result = structuredClone(value);
    request.onsuccess?.();
  });
  if (transaction) scheduleTransactionComplete(transaction);
  return request;
}

function scheduleTransactionComplete(transaction) {
  if (transaction.completionScheduled) return;
  transaction.completionScheduled = true;
  queueMicrotask(() => transaction.oncomplete?.());
}

await import("../src/background.js?backup-test");

function sendRestore(data, backupScope = { type: "all" }, restoreScope = { type: "all" }, senderOverride) {
  return new Promise((resolve) => {
    const sender = senderOverride || {
      id: "extension-id",
      url: "chrome-extension://extension-id/reports.html",
    };
    const message = { type: "SCM_RESTORE_BACKUP", data, backupScope, restoreScope };
    const listener = messageListeners.find((candidate) =>
      candidate(message, sender, resolve),
    );
    assert.ok(listener);
  });
}

function sendReportsMessage(message) {
  return new Promise((resolve) => {
    const sender = {
      id: "extension-id",
      url: "chrome-extension://extension-id/reports.html",
    };
    const listener = messageListeners.find((candidate) =>
      candidate(message, sender, resolve),
    );
    assert.ok(listener);
  });
}

function sendStorageRequest(message) {
  return new Promise((resolve) => {
    const sender = { id: "extension-id" };
    const listener = messageListeners.find((candidate) =>
      candidate(message, sender, resolve),
    );
    assert.ok(listener);
  });
}

let testQueue = Promise.resolve();
function serialTest(name, run) {
  test(name, () => {
    const result = testQueue.then(run);
    testQueue = result.catch(() => {});
    return result;
  });
}

test.after(() => {
  globalThis.chrome = previousChrome;
  globalThis.indexedDB = previousIndexedDB;
});

serialTest("uses IndexedDB without importing legacy local storage", async () => {
  localData = {
    unrelated_extension_data: "preserved",
    scm_old_data: "removed",
  };
  indexedData = {};
  sentTabMessages.length = 0;
  monitoringActive = false;
  stripchatTabs = [
    { id: 7, url: "https://stripchat.com/model" },
    { id: 8, url: "https://stripchat.global/model" },
  ];

  const initialData = await sendStorageRequest({
    type: "SCM_STORAGE_GET",
    keys: null,
  });
  assert.deepEqual(initialData.data, {});
  assert.equal(localData.scm_old_data, "removed");

  const result = await sendRestore({
    scm_rooms_history: { model: {} },
    "scm:model:model": { totalTokens: 42 },
  });

  assert.deepEqual(result, { ok: true, dataApplied: true, itemCount: 2 });
  assert.equal(localData.unrelated_extension_data, "preserved");
  assert.equal(localData.scm_old_data, "removed");
  assert.equal(indexedData.scm_rooms_history.value.model !== undefined, true);
  assert.equal(indexedData["scm:model:model"].value.totalTokens, 42);
  assert.deepEqual(
    sentTabMessages.map(({ message }) => message.type),
    [
      "SCM_PREPARE_BACKUP_RESTORE",
      "SCM_PREPARE_BACKUP_RESTORE",
      "SCM_BACKUP_RESTORED",
      "SCM_BACKUP_RESTORED",
      "SCM_FINISH_BACKUP_RESTORE",
      "SCM_FINISH_BACKUP_RESTORE",
    ],
  );
});

serialTest("restores only a selected model and keeps all other model data", async () => {
  indexedData = {
    "scm:model:keep": {
      key: "scm:model:keep",
      value: { totalTokens: 50 },
    },
    "scm:model:target": {
      key: "scm:model:target",
      value: { stale: true },
    },
    "scm:model:target:daily:old": {
      key: "scm:model:target:daily:old",
      value: { dailyTokens: 1 },
    },
    scm_rooms_history: {
      key: "scm_rooms_history",
      value: {
        "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
        "target::2026-11-19": { modelId: "target", dateKey: "2026-11-19" },
      },
    },
  };
  sentTabMessages.length = 0;
  monitoringActive = false;
  const incomingData = {
    "scm:model:target": { totalTokens: 80 },
    "scm:model:target:daily:new": { dailyTokens: 20 },
    "scm:model:other": { totalTokens: 100 },
    scm_rooms_history: {
      "target::2026-11-20": { modelId: "target", dateKey: "2026-11-20" },
      "other::2026-11-20": { modelId: "other", dateKey: "2026-11-20" },
    },
  };

  const result = await sendRestore(
    incomingData,
    { type: "all" },
    { type: "model", modelId: "target" },
    {
      id: "extension-id",
      url: "https://stripchat.com/model",
      tab: { id: 7, url: "https://stripchat.com/model" },
    },
  );

  assert.deepEqual(result, { ok: true, dataApplied: true, itemCount: 3 });
  assert.deepEqual(indexedData["scm:model:keep"].value, { totalTokens: 50 });
  assert.deepEqual(indexedData["scm:model:target"].value, { totalTokens: 80 });
  assert.equal(indexedData["scm:model:target:daily:old"], undefined);
  assert.deepEqual(indexedData["scm:model:target:daily:new"].value, { dailyTokens: 20 });
  assert.deepEqual(indexedData.scm_rooms_history.value, {
    "keep::2026-11-19": { modelId: "keep", dateKey: "2026-11-19" },
    "target::2026-11-20": { modelId: "target", dateKey: "2026-11-20" },
  });
  const restoredMessage = sentTabMessages.find(
    ({ message }) => message.type === "SCM_BACKUP_RESTORED",
  );
  assert.deepEqual(restoredMessage.message.data["scm:model:keep"], { totalTokens: 50 });
  assert.deepEqual(
    restoredMessage.message.data.scm_rooms_history["target::2026-11-20"],
    { modelId: "target", dateKey: "2026-11-20" },
  );
});

serialTest("does not allow a model-only backup to replace all data", async () => {
  indexedData = {
    "scm:model:keep": { key: "scm:model:keep", value: { totalTokens: 50 } },
  };
  sentTabMessages.length = 0;
  const result = await sendRestore(
    { "scm:model:target": { totalTokens: 80 } },
    { type: "model", modelId: "target" },
    { type: "all" },
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /só pode restaurar essa modelo/);
  assert.deepEqual(indexedData["scm:model:keep"].value, { totalTokens: 50 });
  assert.equal(sentTabMessages.length, 0);
});

serialTest("refuses to restore while any Stripchat tab is monitoring", async () => {
  localData = { scm_existing_data: true };
  indexedData = {};
  sentTabMessages.length = 0;
  monitoringActive = true;
  stripchatTabs = [
    { id: 7, url: "https://stripchat.com/model" },
    { id: 8, url: "https://stripchat.global/model" },
  ];

  const result = await sendRestore({ scm_rooms_history: {} });

  assert.equal(result.ok, false);
  assert.match(result.error, /Pause o monitoramento/);
  assert.equal(result.dataApplied, undefined);
  assert.equal(localData.scm_existing_data, true);
  assert.deepEqual(indexedData, {});
  assert.deepEqual(
    sentTabMessages.map(({ message }) => message.type),
    [
      "SCM_PREPARE_BACKUP_RESTORE",
      "SCM_PREPARE_BACKUP_RESTORE",
      "SCM_FINISH_BACKUP_RESTORE",
    ],
  );
});

serialTest("reads, writes, removes, and estimates IndexedDB data", async () => {
  const writeResult = await sendStorageRequest({
    type: "SCM_STORAGE_SET",
    values: { "scm:test": { totalTokens: 17 } },
  });
  assert.equal(writeResult.ok, true);

  const readResult = await sendStorageRequest({
    type: "SCM_STORAGE_GET",
    keys: ["scm:test"],
  });
  assert.deepEqual(readResult.data, { "scm:test": { totalTokens: 17 } });

  const usageResult = await sendStorageRequest({ type: "SCM_STORAGE_USAGE" });
  assert.ok(usageResult.bytes > 0);
  assert.ok(typeof usageResult.modelBytes === "object");

  const removeResult = await sendStorageRequest({
    type: "SCM_STORAGE_REMOVE",
    keys: ["scm:test"],
  });
  assert.equal(removeResult.ok, true);
  const afterRemove = await sendStorageRequest({
    type: "SCM_STORAGE_GET",
    keys: ["scm:test"],
  });
  assert.deepEqual(afterRemove.data, {});
});

serialTest("deletes an individual period timeline show from stored copies", async () => {
  monitoringActive = false;
  const dateKey = "2026-11-23";
  const show = {
    id: "show-1",
    item: "Show Privado (Início)",
    type: "Show Privado",
    timestamp: 1795485300000,
    price: 24,
  };
  const otherEvent = {
    id: "tip-1",
    item: "Gorjeta",
    type: "Menu",
    timestamp: 1795485240000,
    price: 5,
  };
  const dailyKey = `scm:model:model-a:daily:${dateKey}`;
  const snapshotKey = "scm:model:model-a";
  indexedData = {
    [dailyKey]: {
      key: dailyKey,
      value: {
        capturedEvents: [otherEvent, show],
        liveSessions: { live1: { capturedEvents: [show] } },
      },
    },
    [snapshotKey]: {
      key: snapshotKey,
      value: {
        capturedEvents: [show],
        dailyBuckets: {
          [dateKey]: {
            capturedEvents: [show],
            liveSessions: { live1: { capturedEvents: [show] } },
          },
        },
      },
    },
  };

  const result = await sendReportsMessage({
    type: "SCM_DELETE_REPORT_TIMELINE_ENTRY",
    modelId: "model-a",
    dateKey,
    entryType: "show",
    sourceIndex: 1,
    sourceKey: "",
    eventId: "show-1",
    timestamp: show.timestamp,
    label: show.item,
    eventType: show.type,
    tokens: show.price,
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(indexedData[dailyKey].value.capturedEvents, [otherEvent]);
  assert.deepEqual(indexedData[dailyKey].value.liveSessions.live1.capturedEvents, []);
  assert.deepEqual(indexedData[snapshotKey].value.capturedEvents, []);
  assert.deepEqual(
    indexedData[snapshotKey].value.dailyBuckets[dateKey].capturedEvents,
    [],
  );
  assert.deepEqual(
    indexedData[snapshotKey].value.dailyBuckets[dateKey].liveSessions.live1.capturedEvents,
    [],
  );
});

serialTest("deletes an individual period timeline goal from daily and snapshot data", async () => {
  monitoringActive = false;
  const dateKey = "2026-11-23";
  const goal = {
    description: "Meta antiga",
    status: "Completa",
    amount: 100,
    timestamp: 1795485300000,
  };
  const dailyKey = `scm:model:model-a:daily:${dateKey}`;
  const snapshotKey = "scm:model:model-a";
  indexedData = {
    [dailyKey]: {
      key: dailyKey,
      value: { goalsSnapshot: [{ description: "Outra meta" }, goal] },
    },
    [snapshotKey]: {
      key: snapshotKey,
      value: {
        goals: [goal],
        dailyBuckets: { [dateKey]: { goalsSnapshot: [goal] } },
      },
    },
  };

  const result = await sendReportsMessage({
    type: "SCM_DELETE_REPORT_TIMELINE_ENTRY",
    modelId: "model-a",
    dateKey,
    entryType: "goal",
    sourceIndex: 1,
    description: goal.description,
    status: goal.status,
    amount: goal.amount,
    timestamp: goal.timestamp,
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(indexedData[dailyKey].value.goalsSnapshot, [
    { description: "Outra meta" },
  ]);
  assert.deepEqual(indexedData[snapshotKey].value.goals, []);
  assert.deepEqual(
    indexedData[snapshotKey].value.dailyBuckets[dateKey].goalsSnapshot,
    [],
  );
});

serialTest("refuses to delete an individual timeline record while monitoring", async () => {
  monitoringActive = true;
  const dateKey = "2026-11-23";
  const dailyKey = `scm:model:model-a:daily:${dateKey}`;
  indexedData = {
    [dailyKey]: {
      key: dailyKey,
      value: {
        goalsSnapshot: [{
          description: "Meta",
          status: "Pendente",
          amount: 50,
          timestamp: 1795485300000,
        }],
      },
    },
  };

  const result = await sendReportsMessage({
    type: "SCM_DELETE_REPORT_TIMELINE_ENTRY",
    modelId: "model-a",
    dateKey,
    entryType: "goal",
    sourceIndex: 0,
    description: "Meta",
    status: "Pendente",
    amount: 50,
    timestamp: 1795485300000,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Pause o monitoramento/);
  assert.equal(indexedData[dailyKey].value.goalsSnapshot.length, 1);
  monitoringActive = false;
});
