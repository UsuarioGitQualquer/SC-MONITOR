export const BACKUP_FORMAT = "sc-monitor-backup";
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

const LEGACY_AUTOMATION_KEYS = new Set([
  "scm_auto_collect",
  "scm_auto_monitor_live",
  "scm_watched_model_id",
]);
const MODEL_STORAGE_PREFIX = "scm:model:";

export function isMonitorStorageKey(key) {
  return typeof key === "string" && /^scm(?:_|:)/.test(key);
}

export function isBackupStorageKey(key) {
  return isMonitorStorageKey(key) && !LEGACY_AUTOMATION_KEYS.has(key);
}

export function isModelStorageKey(key, modelId) {
  if (typeof key !== "string" || !modelId) return false;
  const prefix = `${MODEL_STORAGE_PREFIX}${modelId}`;
  return key === prefix || key.startsWith(`${prefix}:`);
}

function getModelIdFromStorageKey(key) {
  if (typeof key !== "string" || !key.startsWith(MODEL_STORAGE_PREFIX)) return "";
  const remainder = key.slice(MODEL_STORAGE_PREFIX.length);
  const markers = [remainder.indexOf(":daily:"), remainder.indexOf(":moderation_keywords")]
    .filter((index) => index >= 0);
  const suffixStart = markers.length ? Math.min(...markers) : remainder.length;
  return remainder.slice(0, suffixStart);
}

function getHistoryModelId(entryKey, entry) {
  if (entry?.modelId) return String(entry.modelId);
  if (entry?.historyKey && String(entry.historyKey).includes("::")) {
    return String(entry.historyKey).split("::")[0];
  }
  if (String(entryKey).includes("::")) return String(entryKey).split("::")[0];
  return String(entryKey || "");
}

function normalizeModelName(modelName) {
  return String(modelName || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function getBackupModelOptions(data) {
  const models = new Map();
  const addModel = (modelId, modelName = "") => {
    const id = String(modelId || "").trim();
    if (!id) return;
    const name = String(modelName || id).trim();
    const identity = normalizeModelName(name) || normalizeModelName(id);
    const previous = models.get(identity);
    if (!previous) {
      models.set(identity, { modelId: id, modelName: name || id });
      return;
    }
    if (normalizeModelName(previous.modelName) === normalizeModelName(previous.modelId)) {
      previous.modelId = id;
      previous.modelName = name || id;
    }
  };

  Object.entries(data || {}).forEach(([key, value]) => {
    if (key === "scm_rooms_history" && value && typeof value === "object") {
      Object.entries(value).forEach(([entryKey, entry]) => {
        addModel(getHistoryModelId(entryKey, entry), entry?.modelName);
      });
      return;
    }

    const modelId = getModelIdFromStorageKey(key);
    if (modelId && key === `${MODEL_STORAGE_PREFIX}${modelId}`) {
      addModel(modelId, value?.modelName || value?.room);
    }
  });

  return Array.from(models.values())
    .sort((a, b) => a.modelName.localeCompare(b.modelName, "pt-BR"));
}

export function getBackupScope(backup) {
  if (Number(backup?.version) < 2 || !backup?.scope) return { type: "all" };
  return backup.scope;
}

export function getBackupDataForModel(storageData, modelId) {
  if (!storageData || typeof storageData !== "object" || Array.isArray(storageData)) {
    throw new TypeError("Os dados locais do monitor estão inválidos.");
  }
  const targetModelId = String(modelId || "").trim();
  if (!targetModelId) throw new Error("Selecione uma modelo para o backup.");

  const data = {};
  Object.keys(storageData)
    .filter(isBackupStorageKey)
    .forEach((key) => {
      if (isModelStorageKey(key, targetModelId)) {
        data[key] = storageData[key];
      } else if (key === "scm_rooms_history") {
        const history = storageData[key];
        if (!history || typeof history !== "object" || Array.isArray(history)) return;
        data[key] = Object.fromEntries(
          Object.entries(history).filter(
            ([entryKey, entry]) => getHistoryModelId(entryKey, entry) === targetModelId,
          ),
        );
      }
    });

  if (!Object.keys(data).some((key) => isModelStorageKey(key, targetModelId))) {
    const history = data.scm_rooms_history;
    if (!history || Object.keys(history).length === 0) {
      throw new Error("Não há dados salvos para a modelo selecionada.");
    }
  }
  return data;
}

export function mergeModelBackupData(currentData, incomingData, modelId) {
  const targetModelId = String(modelId || "").trim();
  const modelData = getBackupDataForModel(incomingData, targetModelId);
  const hasModelData = Object.keys(modelData).some((key) => isModelStorageKey(key, targetModelId));
  const hasModelHistory = Object.keys(modelData.scm_rooms_history || {}).length > 0;
  if (!hasModelData && !hasModelHistory) {
    throw new Error("O backup não contém dados para a modelo selecionada.");
  }

  const merged = { ...(currentData || {}) };
  Object.keys(merged)
    .filter((key) => isModelStorageKey(key, targetModelId))
    .forEach((key) => delete merged[key]);
  Object.entries(modelData)
    .filter(([key]) => isModelStorageKey(key, targetModelId))
    .forEach(([key, value]) => {
      merged[key] = value;
    });

  const currentHistory = currentData?.scm_rooms_history;
  const retainedHistory = Object.fromEntries(
    Object.entries(currentHistory && typeof currentHistory === "object" ? currentHistory : {})
      .filter(([entryKey, entry]) => getHistoryModelId(entryKey, entry) !== targetModelId),
  );
  merged.scm_rooms_history = {
    ...retainedHistory,
    ...(modelData.scm_rooms_history || {}),
  };

  return merged;
}

export function createBackupPayload(
  storageData,
  exportedAt = new Date().toISOString(),
  appVersion = "unknown",
  scope = { type: "all" },
) {
  if (!storageData || typeof storageData !== "object" || Array.isArray(storageData)) {
    throw new TypeError("Os dados locais do monitor estão inválidos.");
  }

  let backupScope;
  let data;
  if (!scope || scope.type === "all") {
    backupScope = { type: "all" };
    data = {};
    Object.keys(storageData)
      .filter(isBackupStorageKey)
      .sort()
      .forEach((key) => {
        data[key] = storageData[key];
      });
  } else if (scope.type === "model") {
    const modelId = String(scope.modelId || "").trim();
    const model = getBackupModelOptions(storageData)
      .find((option) => option.modelId === modelId);
    data = getBackupDataForModel(storageData, modelId);
    backupScope = {
      type: "model",
      modelId,
      modelName: String(scope.modelName || model?.modelName || modelId),
    };
  } else {
    throw new Error("O escopo do backup é inválido.");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: String(exportedAt),
    appVersion: String(appVersion),
    scope: backupScope,
    data,
  };
}

function containsUnsafeObjectKey(value) {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;

    for (const key of Object.keys(current)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return true;
      }
      pending.push(current[key]);
    }
  }
  return false;
}

function isValidBackupScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  if (scope.type === "all") return true;
  return scope.type === "model" &&
    typeof scope.modelId === "string" &&
    scope.modelId.trim().length > 0 &&
    scope.modelId.length <= 512 &&
    (scope.modelName === undefined || typeof scope.modelName === "string");
}

export function parseBackupText(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Formato de backup inválido.");
  }
  if (
    payload.format !== BACKUP_FORMAT ||
    ![1, BACKUP_VERSION].includes(payload.version)
  ) {
    throw new Error("Formato ou versão de backup não compatível.");
  }
  if (
    payload.version >= 2 &&
    (!isValidBackupScope(payload.scope) || containsUnsafeObjectKey(payload.scope))
  ) {
    throw new Error("O escopo do backup é inválido.");
  }
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    throw new Error("O backup não contém dados válidos.");
  }

  const keys = Object.keys(payload.data);
  if (keys.length === 0) {
    throw new Error("O backup não contém dados para restaurar.");
  }
  if (keys.some((key) => !isBackupStorageKey(key))) {
    throw new Error("O backup contém uma chave de armazenamento não permitida.");
  }
  if (containsUnsafeObjectKey(payload.data)) {
    throw new Error("O backup contém propriedades inválidas.");
  }

  const backupScope = getBackupScope(payload);
  if (
    backupScope.type === "model" &&
    !Object.keys(payload.data).some((key) => isModelStorageKey(key, backupScope.modelId)) &&
    !Object.entries(payload.data.scm_rooms_history || {}).some(
      ([entryKey, entry]) => getHistoryModelId(entryKey, entry) === backupScope.modelId,
    )
  ) {
    throw new Error("O backup não contém dados da modelo indicada.");
  }

  return payload;
}
