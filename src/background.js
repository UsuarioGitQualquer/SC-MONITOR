import {
  getBackupDataForModel,
  isBackupStorageKey,
  mergeModelBackupData,
} from "./core/backup.js";

const ICON_SIZE = 32;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const STORAGE_DB_NAME = "sc-monitor-data";
const STORAGE_DB_VERSION = 1;
const STORAGE_OBJECT_STORE = "entries";
const iconRequests = new Map();
const customizedIconTabs = new Set();
let storageDatabasePromise = null;

function updateCustomizedIconTab(tabId, active) {
  const key = `scm_customized_icon_tab_${tabId}`;
  if (active) customizedIconTabs.add(tabId);
  else customizedIconTabs.delete(tabId);

  const sessionStorage = chrome.storage.session;
  if (!sessionStorage) return;
  const update = active
    ? (callback) => sessionStorage.set({ [key]: true }, callback)
    : (callback) => sessionStorage.remove(key, callback);
  update(() => {
    if (chrome.runtime.lastError) {
      console.error("[SC Monitor] Não foi possível atualizar o estado do ícone da aba.");
    }
  });
}

function isStripchatPage(value) {
  try {
    const hostname = new URL(value).hostname;
    return ["stripchat.com", "stripchat.global"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function isReportsPage(sender) {
  return sender.id === chrome.runtime.id &&
    sender.url === chrome.runtime.getURL("reports.html");
}

function queryStripchatTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve((tabs || []).filter((tab) => isStripchatPage(tab.url || "")));
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    });
  });
}

function openStorageDatabase() {
  if (storageDatabasePromise) return storageDatabasePromise;
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  }

  storageDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORAGE_OBJECT_STORE)) {
        request.result.createObjectStore(STORAGE_OBJECT_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir o IndexedDB."));
    request.onblocked = () => reject(new Error("A abertura do IndexedDB foi bloqueada."));
  }).then((database) => {
    database.onversionchange = () => {
      database.close();
      storageDatabasePromise = null;
    };
    return database;
  }).catch((error) => {
    storageDatabasePromise = null;
    throw error;
  });
  return storageDatabasePromise;
}

function transactionFinished(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () =>
      reject(transaction.error || new Error("Falha em uma transação do IndexedDB."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("A transação do IndexedDB foi cancelada."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Falha ao acessar o IndexedDB."));
  });
}

async function getStorageData(keys = null) {
  const database = await openStorageDatabase();
  const transaction = database.transaction(STORAGE_OBJECT_STORE, "readonly");
  const store = transaction.objectStore(STORAGE_OBJECT_STORE);
  const requestedKeys = keys === null
    ? null
    : Array.isArray(keys)
      ? keys
      : [keys];
  const requests = requestedKeys === null
    ? [store.getAll()]
    : requestedKeys.filter((key) => typeof key === "string").map((key) => store.get(key));
  const [results] = await Promise.all([
    Promise.all(requests.map(requestResult)),
    transactionFinished(transaction),
  ]);
  const entries = requestedKeys === null ? results[0] : results.filter(Boolean);
  return Object.fromEntries(entries.map((record) => [record.key, record.value]));
}

async function setStorageData(values) {
  const database = await openStorageDatabase();
  const transaction = database.transaction(STORAGE_OBJECT_STORE, "readwrite");
  const store = transaction.objectStore(STORAGE_OBJECT_STORE);
  Object.entries(values).forEach(([key, value]) => store.put({ key, value }));
  await transactionFinished(transaction);
}

async function removeStorageData(keys) {
  const database = await openStorageDatabase();
  const transaction = database.transaction(STORAGE_OBJECT_STORE, "readwrite");
  const store = transaction.objectStore(STORAGE_OBJECT_STORE);
  (Array.isArray(keys) ? keys : [keys]).forEach((key) => store.delete(key));
  await transactionFinished(transaction);
}

async function replaceStorageData(values) {
  const database = await openStorageDatabase();
  const transaction = database.transaction(STORAGE_OBJECT_STORE, "readwrite");
  const store = transaction.objectStore(STORAGE_OBJECT_STORE);
  store.clear();
  Object.entries(values).forEach(([key, value]) => store.put({ key, value }));
  await transactionFinished(transaction);
}

async function getStorageUsage() {
  const data = await getStorageData(null);
  const encoder = new TextEncoder();
  let totalBytes = Object.entries(data).reduce(
    (total, [key, value]) =>
      total + encoder.encode(JSON.stringify({ key, value })).byteLength,
    0,
  );

  const modelBytes = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!key.startsWith("scm:model:")) return;
    const remainder = key.slice("scm:model:".length);
    const markerIndex = remainder.search(/:daily:|:moderation_keywords/);
    const modelId = markerIndex >= 0 ? remainder.slice(0, markerIndex) : remainder;
    if (!modelId) return;
    modelBytes[modelId] = (modelBytes[modelId] || 0) +
      encoder.encode(JSON.stringify({ key, value })).byteLength;
  });

  if (data.scm_rooms_history && typeof data.scm_rooms_history === "object") {
    Object.entries(data.scm_rooms_history).forEach(([entryKey, entry]) => {
      const modelId = String(
        entry?.modelId ||
        (entry?.historyKey && String(entry.historyKey).includes("::")
          ? String(entry.historyKey).split("::")[0]
          : String(entryKey).includes("::")
            ? String(entryKey).split("::")[0]
            : entryKey),
      );
      if (!modelId) return;
      modelBytes[modelId] = (modelBytes[modelId] || 0) +
        encoder.encode(JSON.stringify({ key: "scm_rooms_history", value: { [entryKey]: entry } })).byteLength;
    });
  }

  let quotaBytes = null;
  let originUsageBytes = null;
  try {
    if (navigator?.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      quotaBytes = Number.isFinite(Number(estimate?.quota)) ? Number(estimate.quota) : null;
      originUsageBytes = Number.isFinite(Number(estimate?.usage)) ? Number(estimate.usage) : null;
    }
  } catch (error) {
    console.warn("[SC Monitor] Não foi possível consultar quota de armazenamento:", error);
  }

  if (originUsageBytes !== null && originUsageBytes > 0) {
    totalBytes = Math.max(totalBytes, originUsageBytes);
  }

  return {
    bytes: totalBytes,
    quotaBytes,
    originUsageBytes,
    modelBytes,
  };
}

function notifyStorageChanged(keys) {
  chrome.runtime.sendMessage({ type: "SCM_STORAGE_CHANGED", keys }, () => {
    void chrome.runtime.lastError;
  });
}

function isValidRestoreScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  if (scope.type === "all") return true;
  return scope.type === "model" &&
    typeof scope.modelId === "string" &&
    scope.modelId.trim().length > 0 &&
    scope.modelId.length <= 512;
}

async function restoreBackup(data, backupScope, restoreScope) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Os dados do backup são inválidos.");
  }
  const keys = Object.keys(data);
  if (!keys.length || keys.some((key) => !isBackupStorageKey(key))) {
    throw new Error("O backup contém chaves inválidas.");
  }
  if (!isValidRestoreScope(backupScope) || !isValidRestoreScope(restoreScope)) {
    throw new Error("O escopo da restauração é inválido.");
  }
  if (
    backupScope.type === "model" &&
    (restoreScope.type !== "model" || restoreScope.modelId !== backupScope.modelId)
  ) {
    throw new Error("Um backup limitado a modelo só pode restaurar essa modelo.");
  }

  const restoredKeys = restoreScope.type === "model"
    ? Object.keys(getBackupDataForModel(data, restoreScope.modelId))
    : keys;

  const tabs = await queryStripchatTabs();
  const preparedTabs = [];
  try {
    for (const tab of tabs) {
      let response;
      try {
        response = await sendTabMessage(tab.id, { type: "SCM_PREPARE_BACKUP_RESTORE" });
      } catch {
        throw new Error(
          "Não foi possível verificar uma aba do Stripchat. Atualize essa aba e tente novamente.",
        );
      }
      if (response?.monitoring) {
        throw new Error("Pause o monitoramento em todas as abas do Stripchat antes de restaurar.");
      }
      if (!response?.ok) {
        throw new Error(response?.error || "Uma aba do Stripchat não está pronta para restaurar o backup.");
      }
      preparedTabs.push(tab);
    }

    const restoreData = restoreScope.type === "model"
      ? mergeModelBackupData(
          await getStorageData(null),
          data,
          restoreScope.modelId,
        )
      : data;
    await replaceStorageData(restoreData);
    notifyStorageChanged(Object.keys(restoreData));

    const refreshResults = await Promise.all(preparedTabs.map(async (tab) => {
      try {
        const response = await sendTabMessage(tab.id, {
          type: "SCM_BACKUP_RESTORED",
          data: restoreData,
        });
        return response?.ok
          ? null
          : response?.error || "Uma aba do Stripchat não conseguiu atualizar os dados.";
      } catch {
        return "Uma aba do Stripchat foi fechada ou deixou de responder durante a restauração.";
      }
    }));
    const refreshError = refreshResults.find(Boolean);
    if (refreshError) {
      return {
        ok: false,
        dataApplied: true,
        error: `Os dados foram gravados, mas uma aba não foi atualizada: ${refreshError}`,
      };
    }
    return { ok: true, dataApplied: true, itemCount: restoredKeys.length };
  } finally {
    await Promise.all(preparedTabs.map((tab) =>
      sendTabMessage(tab.id, { type: "SCM_FINISH_BACKUP_RESTORE" }).catch(() => null),
    ));
  }
}

function createDefaultIcon() {
  const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível desenhar o ícone padrão.");

  const gradient = context.createLinearGradient(0, 0, ICON_SIZE, ICON_SIZE);
  gradient.addColorStop(0, "#11152e");
  gradient.addColorStop(1, "#272952");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(ICON_SIZE / 2, ICON_SIZE / 2, 15, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#00e5ff";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(8, 22);
  context.lineTo(13, 17);
  context.lineTo(17, 19);
  context.lineTo(24, 10);
  context.stroke();

  return context.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

async function createAvatarIcon(avatarUrl) {
  const url = new URL(avatarUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "static-proxy.strpst.com"
  ) {
    throw new Error("Origem de avatar não permitida.");
  }

  const response = await fetch(url.href, {
    credentials: "omit",
    cache: "force-cache",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Falha ao carregar o avatar (${response.status}).`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_AVATAR_BYTES) {
    throw new Error("Formato ou tamanho de avatar não permitido.");
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível desenhar o avatar.");

    context.save();
    context.beginPath();
    context.arc(ICON_SIZE / 2, ICON_SIZE / 2, 14, 0, Math.PI * 2);
    context.clip();
    context.drawImage(bitmap, 2, 2, 28, 28);
    context.restore();

    context.beginPath();
    context.arc(ICON_SIZE / 2, ICON_SIZE / 2, 14, 0, Math.PI * 2);
    context.strokeStyle = "#00e5ff";
    context.lineWidth = 2;
    context.stroke();

    return context.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
  } finally {
    bitmap.close();
  }
}

function setTabIcon(tabId, imageData) {
  return new Promise((resolve, reject) => {
    chrome.action.setIcon({ tabId, imageData }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_SET_ACTION_ICON") return false;

  const tabId = sender.tab?.id;
  if (typeof tabId !== "number" || !isStripchatPage(sender.tab?.url || "")) {
    sendResponse({ ok: false });
    return false;
  }

  const requestId = (iconRequests.get(tabId) || 0) + 1;
  iconRequests.set(tabId, requestId);
  const active = Boolean(message.active);
  if (active) updateCustomizedIconTab(tabId, true);

  (async () => {
    try {
      const imageData = message.active
        ? await createAvatarIcon(String(message.avatarUrl || ""))
        : createDefaultIcon();
      if (iconRequests.get(tabId) !== requestId) {
        sendResponse({ ok: true, stale: true });
        return;
      }

      await setTabIcon(tabId, imageData);
      if (iconRequests.get(tabId) !== requestId) {
        sendResponse({ ok: true, stale: true });
        return;
      }
      if (!active) updateCustomizedIconTab(tabId, false);
      sendResponse({ ok: true });
    } catch (error) {
      console.error("[SC Monitor] Falha ao atualizar o ícone da extensão:", error);
      if (iconRequests.get(tabId) === requestId) {
        try {
          await setTabIcon(tabId, createDefaultIcon());
          updateCustomizedIconTab(tabId, false);
        } catch (iconError) {
          console.error("[SC Monitor] Falha ao restaurar o ícone padrão:", iconError);
        }
      }
      sendResponse({ ok: false });
    }
  })();

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_LANGUAGE_CHANGED") return false;
  const supportedLanguages = ["pt-BR", "es", "en"];
  if (sender.id !== chrome.runtime.id || !supportedLanguages.includes(message.language)) {
    sendResponse({ ok: false });
    return false;
  }
  chrome.tabs.query({}, (tabs) => {
    tabs
      .filter((tab) => Number.isInteger(tab.id) && isStripchatPage(tab.url || ""))
      .forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "SCM_LANGUAGE_CHANGED", language: message.language },
          () => void chrome.runtime.lastError,
        );
      });
    sendResponse({ ok: true });
  });
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const operations = {
    SCM_STORAGE_GET: async () => ({ data: await getStorageData(message.keys ?? null) }),
    SCM_STORAGE_SET: async () => {
      if (!message.values || typeof message.values !== "object" || Array.isArray(message.values)) {
        throw new Error("Os dados para gravação são inválidos.");
      }
      const keys = Object.keys(message.values);
      await setStorageData(message.values);
      notifyStorageChanged(keys);
      return {};
    },
    SCM_STORAGE_REMOVE: async () => {
      const keys = Array.isArray(message.keys) ? message.keys : [message.keys];
      const validKeys = keys.filter((key) => typeof key === "string");
      if (validKeys.length) {
        await removeStorageData(validKeys);
        notifyStorageChanged(validKeys);
      }
      return {};
    },
    SCM_STORAGE_USAGE: async () => ({ ...(await getStorageUsage()) }),
  };
  const operation = operations[message?.type];
  if (!operation) return false;
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Solicitação de armazenamento não autorizada." });
    return false;
  }

  operation()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error("[SC Monitor] Falha ao acessar o IndexedDB:", error);
      sendResponse({ ok: false, error: error.message || "Falha ao acessar o armazenamento." });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_RECOVER_CONTENT_SCRIPT") return false;
  if (sender.id !== chrome.runtime.id || !Number.isInteger(message.tabId)) {
    sendResponse({ ok: false });
    return false;
  }

  chrome.tabs.get(message.tabId, (tab) => {
    const tabError = chrome.runtime.lastError;
    if (tabError || !isStripchatPage(tab?.url || "")) {
      sendResponse({ ok: false });
      return;
    }

    chrome.scripting
      .executeScript({
        target: { tabId: message.tabId },
        func: () => {
          window.__scmForceRecovery = true;
        },
      })
      .then(() =>
        chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          files: ["src/content.js"],
        }),
      )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("[SC Monitor] Não foi possível reconectar o painel:", error);
        sendResponse({ ok: false });
      });
  });

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_OPEN_REPORTS") return false;
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Solicitação não autorizada." });
    return false;
  }

  try {
    chrome.tabs.create({ url: chrome.runtime.getURL("reports.html") }, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error("[SC Monitor] Falha ao abrir relatórios:", error);
        sendResponse({ ok: false, error: error.message });
        return;
      }
      sendResponse({ ok: true, tabId: tab?.id });
    });
  } catch (error) {
    console.error("[SC Monitor] Falha ao abrir relatórios:", error);
    sendResponse({ ok: false, error: error.message });
  }

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_RESTORE_BACKUP") return false;
  const isStripchatContentScript = sender.id === chrome.runtime.id &&
    Number.isInteger(sender.tab?.id) &&
    isStripchatPage(sender.tab?.url || "");
  if (!isReportsPage(sender) && !isStripchatContentScript) {
    sendResponse({ ok: false, error: "Solicitação não autorizada." });
    return false;
  }

  restoreBackup(message.data, message.backupScope, message.restoreScope).then(sendResponse, (error) => {
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_DELETE_REPORT_DATA") return false;
  if (!isReportsPage(sender)) {
    sendResponse({ ok: false, error: "Solicitação não autorizada." });
    return false;
  }

  const modelId = String(message.modelId || "").trim();
  const scope = ["date", "live", "model"].includes(message.scope)
    ? message.scope
    : "date";
  const dateKey = String(message.dateKey || "").trim();
  const liveId = String(message.liveId || "").trim();
  if (!modelId) {
    sendResponse({ ok: false, error: "Modelo não selecionado." });
    return false;
  }
  if (scope === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    sendResponse({ ok: false, error: "Data inválida." });
    return false;
  }
  if (scope === "live" && (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
    !liveId
  )) {
    sendResponse({ ok: false, error: "Data ou live inválida." });
    return false;
  }

  (async () => {
    const tabs = await queryStripchatTabs();
    const statuses = await Promise.all(tabs.map(async (tab) => {
      try {
        return await sendTabMessage(tab.id, { type: "SCM_GET_STATUS" });
      } catch {
        return null;
      }
    }));
    const activeMatchingTab = statuses.some((status) =>
      status?.ok &&
      status.monitoring &&
      String(status.modelId || "") === modelId,
    );
    if (activeMatchingTab) {
      throw new Error("Pause o monitoramento deste modelo antes de apagar os dados.");
    }

    const allData = await getStorageData(null);
    if (scope === "live") {
      const liveDailyKey = `scm:model:${modelId}:daily:${dateKey}`;
      const liveDaily = allData[liveDailyKey];
      const liveExistsInDaily = Boolean(
        liveDaily?.liveSessions &&
        typeof liveDaily.liveSessions === "object" &&
        liveDaily.liveSessions[liveId],
      );
      const snapshot = allData[`scm:model:${modelId}`];
      const liveExistsInSnapshot = Boolean(
        snapshot?.dailyBuckets?.[dateKey]?.liveSessions &&
        typeof snapshot.dailyBuckets[dateKey].liveSessions === "object" &&
        snapshot.dailyBuckets[dateKey].liveSessions[liveId],
      );
      if (!liveExistsInDaily && !liveExistsInSnapshot) {
        throw new Error("A live selecionada não existe nos dados do dia.");
      }
    }
    const keysToRemove = Object.keys(allData).filter((key) => {
      const modelPrefix = `scm:model:${modelId}`;
      if (scope === "model") {
        return key === modelPrefix ||
          key.startsWith(`${modelPrefix}:daily:`) ||
          key === `${modelPrefix}:moderation_keywords`;
      }
      if (scope === "live") return false;
      return key === `scm:model:${modelId}:daily:${dateKey}`;
    });

    const history = allData.scm_rooms_history;
    let updatedHistory = history;
    if (history && typeof history === "object") {
      updatedHistory = { ...history };
      Object.entries(updatedHistory).forEach(([entryKey, entry]) => {
        const matchesModel =
          entryKey === modelId ||
          entry?.modelId === modelId ||
          entryKey.startsWith(`${modelId}::`);
        if (!matchesModel) return;
        if (scope === "model") {
          delete updatedHistory[entryKey];
        } else if (scope === "live") {
          const entryDate =
            entry?.dateKey ||
            (entryKey.includes("::") ? entryKey.split("::")[1] : "");
          if (entryDate !== dateKey) return;
          const dailyKey = `scm:model:${modelId}:daily:${dateKey}`;
          const liveSessions = allData[dailyKey]?.liveSessions;
          const remainingSessions = Object.values(liveSessions || {})
            .filter((session) => session && session.sessionId !== liveId);
          updatedHistory[entryKey] = {
            ...entry,
            livesCount: remainingSessions.length,
            firstLiveStart: remainingSessions[0]?.startedAt || "",
            lastLiveEnd: remainingSessions[remainingSessions.length - 1]?.endedAt || "",
          };
        } else {
          const entryDate =
            entry?.dateKey ||
            (entryKey.includes("::") ? entryKey.split("::")[1] : "");
          if (entryDate === dateKey) delete updatedHistory[entryKey];
        }
      });
    }

    if (scope === "model") {
      await removeStorageData(keysToRemove);
    } else if (keysToRemove.length > 0) {
      await removeStorageData(keysToRemove);
    }
    const updatedValues = { scm_rooms_history: updatedHistory || {} };
    if (scope === "live") {
      const dailyKey = `scm:model:${modelId}:daily:${dateKey}`;
      const daily = allData[dailyKey];
      if (daily && typeof daily === "object") {
        const liveSessions = daily.liveSessions && typeof daily.liveSessions === "object"
          ? { ...daily.liveSessions }
          : {};
        delete liveSessions[liveId];
        updatedValues[dailyKey] = {
          ...daily,
          liveSessions,
        };
      }

      const snapshotKey = `scm:model:${modelId}`;
      const snapshot = allData[snapshotKey];
      if (snapshot && typeof snapshot === "object") {
        const snapshotCopy = {
          ...snapshot,
          dailyBuckets: snapshot.dailyBuckets && typeof snapshot.dailyBuckets === "object"
            ? { ...snapshot.dailyBuckets }
            : {},
        };
        const snapshotBucket = snapshotCopy.dailyBuckets[dateKey];
        if (snapshotBucket && typeof snapshotBucket === "object") {
          const snapshotSessions = snapshotBucket.liveSessions &&
            typeof snapshotBucket.liveSessions === "object"
            ? { ...snapshotBucket.liveSessions }
            : {};
          delete snapshotSessions[liveId];
          snapshotCopy.dailyBuckets[dateKey] = {
            ...snapshotBucket,
            liveSessions: snapshotSessions,
          };
        }
        updatedValues[snapshotKey] = snapshotCopy;
      }
    } else if (scope === "date") {
      const snapshotKey = `scm:model:${modelId}`;
      const snapshot = allData[snapshotKey];
      if (snapshot && typeof snapshot === "object") {
        const snapshotCopy = {
          ...snapshot,
          dailyBuckets: snapshot.dailyBuckets && typeof snapshot.dailyBuckets === "object"
            ? { ...snapshot.dailyBuckets }
            : {},
        };
        delete snapshotCopy.dailyBuckets[dateKey];
        updatedValues[snapshotKey] = snapshotCopy;
      }
    }
    await setStorageData(updatedValues);
    notifyStorageChanged(
      scope === "model"
        ? [...keysToRemove, "scm_rooms_history"]
        : [...keysToRemove, "scm_rooms_history"],
    );
    sendResponse({
      ok: true,
      removedKeys: keysToRemove.length,
      scope,
    });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});

function getTimelineCollectionEntry(collection, sourceIndex, sourceKey) {
  if (Array.isArray(collection)) {
    return Number.isInteger(sourceIndex) ? collection[sourceIndex] : undefined;
  }
  if (!collection || typeof collection !== "object") return undefined;
  if (sourceKey && Object.prototype.hasOwnProperty.call(collection, sourceKey)) {
    return collection[sourceKey];
  }
  return Object.values(collection)[sourceIndex];
}

function filterTimelineCollection(collection, shouldRemove) {
  if (Array.isArray(collection)) return collection.filter((entry) => !shouldRemove(entry));
  if (!collection || typeof collection !== "object") return collection;
  return Object.fromEntries(
    Object.entries(collection).filter(([, entry]) => !shouldRemove(entry)),
  );
}

function isTimelineShowEvent(event) {
  if (!event || typeof event !== "object") return false;
  const normalizedType = `${String(event.type || "")} ${String(event.item || "")}`
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/menu de gorjetas|menu|gorjeta avulsa|roleta|battleship|objetivo epico|compra de conteudo/.test(normalizedType)) {
    return false;
  }
  return /(?:^|\s)(show (?:privado|exclusivo|em grupo)|ticket|ingresso)(?:\s|$)/.test(normalizedType);
}

function removeTimelineShowCopies(daily, shouldRemove) {
  const updated = { ...daily };
  if (daily.capturedEvents !== undefined) {
    updated.capturedEvents = filterTimelineCollection(daily.capturedEvents, shouldRemove);
  }
  if (daily.liveSessions && typeof daily.liveSessions === "object") {
    updated.liveSessions = Object.fromEntries(
      Object.entries(daily.liveSessions).map(([sessionId, session]) => [
        sessionId,
        session && typeof session === "object"
          ? {
            ...session,
            ...(session.capturedEvents === undefined
              ? {}
              : {
                capturedEvents: filterTimelineCollection(
                  session.capturedEvents,
                  shouldRemove,
                ),
              }),
          }
          : session,
      ]),
    );
  }
  return updated;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_DELETE_REPORT_TIMELINE_ENTRY") return false;
  if (!isReportsPage(sender)) {
    sendResponse({ ok: false, error: "Solicitação não autorizada." });
    return false;
  }

  const modelId = String(message.modelId || "").trim();
  const dateKey = String(message.dateKey || "").trim();
  const entryType = message.entryType;
  const sourceIndex = Number(message.sourceIndex);
  const sourceKey = String(message.sourceKey || "");
  if (!modelId || modelId.length > 512) {
    sendResponse({ ok: false, error: "Modelo inválido." });
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    sendResponse({ ok: false, error: "Data inválida." });
    return false;
  }
  if (!["goal", "show"].includes(entryType) ||
      !Number.isInteger(sourceIndex) ||
      sourceIndex < 0 ||
      (entryType === "goal" && sourceKey)) {
    sendResponse({ ok: false, error: "Registro da linha do tempo inválido." });
    return false;
  }

  (async () => {
    const tabs = await queryStripchatTabs();
    const statuses = await Promise.all(tabs.map(async (tab) => {
      try {
        return await sendTabMessage(tab.id, { type: "SCM_GET_STATUS" });
      } catch {
        return null;
      }
    }));
    if (statuses.some((status) =>
      status?.ok &&
      status.monitoring &&
      String(status.modelId || "") === modelId,
    )) {
      throw new Error("Pause o monitoramento deste modelo antes de apagar registros.");
    }

    const dailyKey = `scm:model:${modelId}:daily:${dateKey}`;
    const snapshotKey = `scm:model:${modelId}`;
    const data = await getStorageData([dailyKey, snapshotKey]);
    const daily = data[dailyKey];
    if (!daily || typeof daily !== "object") {
      throw new Error("Os dados deste dia não estão mais disponíveis.");
    }

    let updatedDaily;
    let updatedSnapshot = data[snapshotKey];
    if (entryType === "goal") {
      const description = String(message.description || "").trim();
      const status = String(message.status || "Pendente");
      const amount = Math.max(0, Number(message.amount) || 0);
      const timestamp = Math.max(0, Number(message.timestamp) || 0);
      const target = Array.isArray(daily.goalsSnapshot)
        ? daily.goalsSnapshot[sourceIndex]
        : undefined;
      const targetTimestamp = Math.max(
        0,
        Number(target?.timestamp) || Number(target?.updatedAt) || 0,
      );
      if (!description ||
          String(target?.description || "").trim() !== description ||
          String(target?.status || "Pendente") !== status ||
          Math.max(0, Number(target?.amount) || 0) !== amount ||
          targetTimestamp !== timestamp) {
        throw new Error("A meta mudou ou já foi apagada. Atualize o relatório.");
      }

      const matchesGoal = (goal) =>
        String(goal?.description || "").trim().toLocaleLowerCase() ===
        description.toLocaleLowerCase();
      const matchesGoalVersion = (goal) =>
        matchesGoal(goal) &&
        String(goal?.status || "Pendente") === status &&
        Math.max(0, Number(goal?.amount) || 0) === amount &&
        Math.max(0, Number(goal?.timestamp) || Number(goal?.updatedAt) || 0) === timestamp;
      updatedDaily = {
        ...daily,
        goalsSnapshot: (Array.isArray(daily.goalsSnapshot) ? daily.goalsSnapshot : [])
          .filter((goal) => !matchesGoal(goal)),
      };
      if (updatedSnapshot && typeof updatedSnapshot === "object") {
        const dailyBuckets = updatedSnapshot.dailyBuckets &&
          typeof updatedSnapshot.dailyBuckets === "object"
          ? { ...updatedSnapshot.dailyBuckets }
          : {};
        const snapshotBucket = dailyBuckets[dateKey];
        if (snapshotBucket && typeof snapshotBucket === "object") {
          dailyBuckets[dateKey] = {
            ...snapshotBucket,
            goalsSnapshot: (Array.isArray(snapshotBucket.goalsSnapshot)
              ? snapshotBucket.goalsSnapshot
              : []).filter((goal) => !matchesGoal(goal)),
          };
        }
        updatedSnapshot = {
          ...updatedSnapshot,
          goals: (Array.isArray(updatedSnapshot.goals)
            ? updatedSnapshot.goals
            : []).filter((goal) => !matchesGoalVersion(goal)),
          dailyBuckets,
        };
      }
    } else {
      const expected = {
        id: String(message.eventId || ""),
        timestamp: Math.max(0, Number(message.timestamp) || 0),
        label: String(message.label || ""),
        type: String(message.eventType || ""),
        tokens: Math.max(0, Number(message.tokens) || 0),
      };
      const matchesShow = (event) => {
        if (!event || typeof event !== "object") return false;
        if (expected.id) return String(event.id || "") === expected.id;
        const eventTimestamp = Math.max(
          0,
          Number(event.timestamp) || Number(event.time) || 0,
        );
        const eventLabel = String(event.item || event.type || "Show");
        const eventTokens = Math.max(0, Number(event.price ?? event.tokens) || 0);
        return eventTimestamp === expected.timestamp &&
          eventLabel === expected.label &&
          String(event.type || "Show") === expected.type &&
          eventTokens === expected.tokens;
      };
      const target = getTimelineCollectionEntry(
        daily.capturedEvents,
        sourceIndex,
        sourceKey,
      );
      if (!isTimelineShowEvent(target) || !matchesShow(target)) {
        throw new Error("O show mudou ou já foi apagado. Atualize o relatório.");
      }
      updatedDaily = removeTimelineShowCopies(daily, matchesShow);

      if (updatedSnapshot && typeof updatedSnapshot === "object") {
        const dailyBuckets = updatedSnapshot.dailyBuckets &&
          typeof updatedSnapshot.dailyBuckets === "object"
          ? { ...updatedSnapshot.dailyBuckets }
          : {};
        const snapshotBucket = dailyBuckets[dateKey];
        if (snapshotBucket && typeof snapshotBucket === "object") {
          dailyBuckets[dateKey] = removeTimelineShowCopies(snapshotBucket, matchesShow);
        }
        updatedSnapshot = {
          ...updatedSnapshot,
          ...(updatedSnapshot.capturedEvents === undefined
            ? {}
            : {
              capturedEvents: filterTimelineCollection(
                updatedSnapshot.capturedEvents,
                matchesShow,
              ),
            }),
          dailyBuckets,
        };
      }
    }

    const updatedValues = { [dailyKey]: updatedDaily };
    if (updatedSnapshot && typeof updatedSnapshot === "object") {
      updatedValues[snapshotKey] = updatedSnapshot;
    }
    await setStorageData(updatedValues);
    notifyStorageChanged([dailyKey, snapshotKey]);
    sendResponse({ ok: true });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCM_DISMISS_SUSPECT_BOT") return false;
  if (!isReportsPage(sender)) {
    sendResponse({ ok: false, error: "Solicitação não autorizada." });
    return false;
  }

  const modelId = String(message.modelId || "").trim();
  const username = String(message.username || "").trim();
  if (!modelId || !username) {
    sendResponse({ ok: false, error: "Modelo ou usuário inválido." });
    return false;
  }

  queryStripchatTabs().then(async (tabs) => {
    const results = await Promise.all(tabs.map(async (tab) => {
      try {
        return await sendTabMessage(tab.id, {
          type: "SCM_DISMISS_SUSPECT_BOT",
          modelId,
          username,
        });
      } catch (error) {
        console.warn(
          `[SC Monitor] Não foi possível atualizar a aba ${tab.id} ao dispensar ${username}:`,
          error,
        );
        return null;
      }
    }));
    sendResponse({
      ok: true,
      notifiedTabs: results.filter((result) => result?.ok && !result.ignored).length,
      warning: results.some((result) => result === null)
        ? " Algumas abas abertas não puderam ser sincronizadas; atualize-as se a suspeita voltar."
        : "",
    });
  }).catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({ imageData: createDefaultIcon() }, () => {
    if (chrome.runtime.lastError) {
      console.error("[SC Monitor] Falha ao configurar o ícone padrão da extensão.");
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  iconRequests.delete(tabId);
  updateCustomizedIconTab(tabId, false);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;

  const requestId = (iconRequests.get(tabId) || 0) + 1;
  iconRequests.set(tabId, requestId);
  const key = `scm_customized_icon_tab_${tabId}`;
  const resetIcon = (isCustomized) => {
    if (!isCustomized || iconRequests.get(tabId) !== requestId) return;
    setTabIcon(tabId, createDefaultIcon()).then(
      () => {
        if (iconRequests.get(tabId) === requestId) {
          updateCustomizedIconTab(tabId, false);
        }
      },
      (error) => {
        console.error("[SC Monitor] Falha ao restaurar o ícone padrão da aba:", error);
      },
    );
  };

  if (customizedIconTabs.has(tabId)) {
    resetIcon(true);
    return;
  }
  if (!chrome.storage.session) return;

  chrome.storage.session.get([key], (stored) => {
    if (chrome.runtime.lastError) {
      console.error("[SC Monitor] Não foi possível verificar o ícone da aba.");
      return;
    }
    resetIcon(stored?.[key] === true);
  });
});
