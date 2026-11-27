import { localDateKey } from "../core/state.js";
import {
  bindLanguageSelector,
  initializeLocalization,
  watchLocalization,
} from "../utils/i18n.js";
import {
  createBackupPayload,
  getBackupModelOptions,
  getBackupScope,
  MAX_BACKUP_FILE_BYTES,
  parseBackupText,
} from "../core/backup.js";
import {
  buildDailyReportCsv,
  buildPeriodReportCsv,
  triggerCsvDownload,
} from "./export/csv-export.js";
import { getAdaptiveTimeStep } from "./chart-data.js";
import {
  buildDailyReportChartData,
  buildDailyShowStats,
  buildPeriodReportSummary,
  buildReportData,
  dateKeyToUtcDate,
  formatHistoryDate,
  mergeDailyReportBuckets,
  listHistoryEntriesForModel,
  listHistoryModels,
  listPeriodReportDateKeys,
  weekdayIndexFromDateKey,
  WEEKDAY_NAMES,
} from "./report-data.js";
import {
  buildReportEmptyState,
  buildDailyReportHtml,
  buildPeriodReportHtml,
  buildSessionReportHtml,
  formatReportDuration,
} from "./reports-view.js";
import {
  normalizeReportViewState,
  REPORT_VIEW_STATE_KEY,
  resolveReportDateSelection,
} from "./report-view-state.js";
import { canRestoreManualEntryDraft } from "./manual-entry-draft.js";
import { removeManualEntryFromDaily } from "./manual-entry-storage.js";

const elements = {
  appShell: document.querySelector(".app-shell"),
  sidebarToggle: document.getElementById("toggle-sidebar"),
  mode: document.getElementById("report-mode"),
  model: document.getElementById("report-model"),
  dateA: document.getElementById("report-date-a"),
  dateB: document.getElementById("report-date-b"),
  dateComparisonControl: document.getElementById("date-comparison-control"),
  sessionA: document.getElementById("report-session-a"),
  sessionB: document.getElementById("report-session-b"),
  dayControls: document.getElementById("day-controls"),
  dayTimeControl: document.getElementById("day-time-control"),
  timeGranularity: document.getElementById("report-time-granularity"),
  periodControls: document.getElementById("period-controls"),
  periodStart: document.getElementById("period-start"),
  periodEnd: document.getElementById("period-end"),
  periodGranularity: document.getElementById("period-granularity"),
  periodComparisonControl: document.getElementById("period-comparison-control"),
  comparePeriods: document.getElementById("compare-periods"),
  periodComparisonDates: document.getElementById("period-comparison-dates"),
  periodComparisonStart: document.getElementById("period-comparison-start"),
  periodComparisonEnd: document.getElementById("period-comparison-end"),
  workspace: document.getElementById("report-workspace"),
  status: document.getElementById("report-status"),
  refresh: document.getElementById("refresh-report"),
  export: document.getElementById("export-report"),
  exportBackup: document.getElementById("export-backup"),
  exportBackupScope: document.getElementById("backup-export-scope"),
  importBackup: document.getElementById("import-backup"),
  backupFile: document.getElementById("backup-file"),
  backupImportOptions: document.getElementById("backup-import-options"),
  backupImportScope: document.getElementById("backup-import-scope"),
  backupImportModelControl: document.getElementById("backup-import-model-control"),
  backupImportModel: document.getElementById("backup-import-model"),
  applyBackup: document.getElementById("apply-backup"),
  cancelBackup: document.getElementById("cancel-backup"),
  backupPreview: document.getElementById("backup-preview"),
  backupStatus: document.getElementById("backup-status"),
  deleteReportModel: document.getElementById("delete-report-model"),
  deleteReportScope: document.getElementById("delete-report-scope"),
  deleteReportDateControl: document.getElementById("delete-report-date-control"),
  deleteReportDate: document.getElementById("delete-report-date"),
  deleteReportLiveControl: document.getElementById("delete-report-live-control"),
  deleteReportLive: document.getElementById("delete-report-live"),
  deleteReportData: document.getElementById("delete-report-data"),
  deleteReportStatus: document.getElementById("delete-report-status"),
  localStorageSummary: document.getElementById("local-storage-summary"),
};

let historyData = {};
let currentReport = null;
let refreshTimer = null;
let pendingBackupImport = null;
let selectedSessionAId = "";
let selectedSessionBId = "";
let sessionComparisonCleared = false;
let manualEntryDraft = null;

function readStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SCM_STORAGE_GET", keys: keys ?? null }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Falha ao ler o armazenamento local."));
        return;
      }
      resolve(response.data || {});
    });
  });
}

function writeStorage(values) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SCM_STORAGE_SET", values }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!response?.ok) {
        reject(new Error(response?.error || "Falha ao gravar o armazenamento local."));
      } else resolve();
    });
  });
}

function updateManualEntryForm(form) {
  const kind = form.querySelector('[name="kind"]')?.value || "chat_private";
  const scope = form.querySelector('[name="scope"]')?.value || "day";
  const showControl = form.querySelector("[data-manual-show-control]");
  const showSelect = form.querySelector('[name="showId"]');
  if (!showControl || !showSelect) return;

  showControl.hidden = kind === "chat_private";
  Array.from(showSelect.options).forEach((option) => {
    if (!option.value) return;
    const visible = option.dataset.showScope === scope &&
      option.dataset.showType === kind;
    option.hidden = !visible;
    option.disabled = !visible;
  });
  if (showSelect.selectedOptions[0]?.hidden) showSelect.value = "";
}

function getManualEntryDraftContext() {
  return {
    modelId: elements.model.value,
    dateKey: elements.dateA.value,
    mode: elements.mode.value,
    sessionId: selectedSessionAId,
  };
}

function captureManualEntryDraft(form) {
  manualEntryDraft = {
    ...getManualEntryDraftContext(),
    scope: form.querySelector('[name="scope"]')?.value || "day",
    kind: form.querySelector('[name="kind"]')?.value || "chat_private",
    amount: form.querySelector('[name="amount"]')?.value || "",
    username: form.querySelector('[name="username"]')?.value || "",
    showId: form.querySelector('[name="showId"]')?.value || "",
  };
}

function restoreManualEntryDraft(form) {
  if (!canRestoreManualEntryDraft(manualEntryDraft, getManualEntryDraftContext())) {
    manualEntryDraft = null;
    return;
  }

  const scopeSelect = form.querySelector('[name="scope"]');
  const kindSelect = form.querySelector('[name="kind"]');
  const amountInput = form.querySelector('[name="amount"]');
  const usernameInput = form.querySelector('[name="username"]');
  const showSelect = form.querySelector('[name="showId"]');
  const availableScope = Array.from(scopeSelect?.options || []).find(
    (option) => option.value === manualEntryDraft.scope && !option.disabled,
  );
  if (!availableScope) {
    manualEntryDraft = null;
    return;
  }

  scopeSelect.value = manualEntryDraft.scope;
  kindSelect.value = manualEntryDraft.kind;
  updateManualEntryForm(form);
  if (amountInput) amountInput.value = manualEntryDraft.amount;
  if (usernameInput) usernameInput.value = manualEntryDraft.username;
  if (showSelect) {
    const availableShow = Array.from(showSelect.options).some(
      (option) => option.value === manualEntryDraft.showId && !option.disabled && !option.hidden,
    );
    showSelect.value = availableShow ? manualEntryDraft.showId : "";
    if (manualEntryDraft.showId && !availableShow) {
      const status = form.querySelector("[data-manual-entry-status]");
      if (status) status.textContent = "O show selecionado não está mais disponível; escolha outro.";
    }
  }
}

function setWorkspaceHtml(html) {
  const activeField = document.activeElement?.closest?.("[data-manual-entry-form]")
    ? document.activeElement
    : null;
  const activeFieldName = activeField?.getAttribute("name") || "";
  const selectionStart = activeField instanceof HTMLInputElement &&
    activeField.type === "text"
    ? activeField.selectionStart
    : null;
  const selectionEnd = activeField instanceof HTMLInputElement &&
    activeField.type === "text"
    ? activeField.selectionEnd
    : null;
  elements.workspace.innerHTML = html;
  const manualEntryForm = elements.workspace.querySelector("[data-manual-entry-form]");
  if (!manualEntryForm) return;
  restoreManualEntryDraft(manualEntryForm);
  if (
    activeFieldName &&
    canRestoreManualEntryDraft(manualEntryDraft, getManualEntryDraftContext())
  ) {
    const restoredField = Array.from(manualEntryForm.elements)
      .find((field) => field.name === activeFieldName);
    restoredField?.focus();
    if (
      restoredField instanceof HTMLInputElement &&
      restoredField.type === "text" &&
      selectionStart !== null &&
      selectionEnd !== null
    ) {
      restoredField.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

function getCapturedEvents(daily) {
  if (Array.isArray(daily?.capturedEvents)) return daily.capturedEvents;
  if (daily?.capturedEvents && typeof daily.capturedEvents === "object") {
    return Object.values(daily.capturedEvents);
  }
  return [];
}

function getManualEarningEvents(daily) {
  const storedManual = Array.isArray(daily?.manualEarnings)
    ? daily.manualEarnings
    : daily?.manualEarnings && typeof daily.manualEarnings === "object"
      ? Object.values(daily.manualEarnings)
      : [];
  const legacyManual = getCapturedEvents(daily).filter((event) => event?.manualEntry === true);
  const entries = new Map();
  [...storedManual, ...legacyManual].forEach((event, index) => {
    if (!event || typeof event !== "object") return;
    const id = String(event.id || `manual-${index}`);
    if (!entries.has(id)) entries.set(id, event);
  });
  return Array.from(entries.values());
}

async function saveManualEarning(form) {
  const modelId = elements.model.value;
  const dateKey = elements.dateA.value;
  const scope = form.querySelector('[name="scope"]')?.value;
  const kind = form.querySelector('[name="kind"]')?.value;
  const amount = Number(form.querySelector('[name="amount"]')?.value);
  const username = String(form.querySelector('[name="username"]')?.value || "")
    .trim()
    .slice(0, 64);
  const showId = form.querySelector('[name="showId"]')?.value || "";
  const entryType = {
    chat_private: "Chat privado",
    private: "Show privado",
    exclusive: "Show exclusivo",
  }[kind];

  if (!modelId || !dateKey) throw new Error("Selecione uma modelo e um dia.");
  if (!entryType) throw new Error("Selecione um tipo de ganho válido.");
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Informe um valor inteiro de tokens maior que zero.");
  }

  const sessionId = scope === "live" ? selectedSessionAId : "";
  if (scope !== "day" && scope !== "live") throw new Error("Selecione Dia ou Live.");
  if (scope === "live" && !sessionId) {
    throw new Error("Selecione uma live antes de registrar o ganho.");
  }

  const storageKey = `scm:model:${modelId}:daily:${dateKey}`;
  const stored = await readStorage([storageKey]);
  const daily = stored[storageKey] && typeof stored[storageKey] === "object"
    ? { ...stored[storageKey] }
    : { modelId, date: dateKey };
  const capturedEvents = getCapturedEvents(daily);
  let targetSession = null;
  if (scope === "live") {
    const sessions = Object.values(daily.liveSessions || {});
    targetSession = daily.liveSessions?.[sessionId] ||
      sessions.find((session) => String(session?.sessionId || "") === sessionId);
    if (!targetSession) throw new Error("A live selecionada não foi encontrada no armazenamento.");
  }

  if (kind !== "chat_private" && showId) {
    const targetEvents = scope === "day"
      ? [...capturedEvents, ...getManualEarningEvents(daily)]
      : [
        ...getCapturedEvents(targetSession),
        ...getManualEarningEvents(daily).filter((event) =>
          event?.manualEntry === true &&
          event.scope === "live" &&
          String(event.sessionId || "") === sessionId,
        ),
      ];
    const targetStats = buildDailyShowStats({ capturedEvents: targetEvents });
    const shows = kind === "private"
      ? targetStats.private.privateShows
      : targetStats.exclusive.exclusiveShows;
    if (!shows.some((show) => show.id === showId)) {
      throw new Error("O show selecionado não está mais disponível. Atualize o relatório.");
    }
  }

  let timestamp = Date.now();
  if (scope === "live") {
    const endedAt = Number(targetSession.endedAtTs) || 0;
    const startedAt = Number(targetSession.startedAtTs) || 0;
    if (endedAt > 0) timestamp = endedAt;
    if (startedAt > 0) timestamp = Math.max(timestamp, startedAt);
  } else if (dateKey !== localDateKey()) {
    const selectedDayTimestamp = new Date(`${dateKey}T12:00:00`).getTime();
    if (Number.isFinite(selectedDayTimestamp)) timestamp = selectedDayTimestamp;
  }
  const entryId = `manual-${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  const showLabel = kind === "private" ? "Show privado" : "Show exclusivo";
  const entry = {
    id: entryId,
    timestamp,
    time: timestamp,
    type: entryType,
    item: kind === "chat_private"
      ? "Ganho manual de chat privado"
      : `${showLabel} · ganho manual`,
    price: amount,
    tokens: amount,
    manualAmount: amount,
    manualEntry: true,
    user: username,
    scope,
    ...(sessionId ? { sessionId } : {}),
    ...(showId ? { manualShowTargetId: showId } : {}),
    ...(!showId && kind !== "chat_private"
      ? { showBoundary: "start", manualNewShow: true }
      : {}),
  };

  daily.modelId = modelId;
  daily.date = dateKey;
  daily.manualEarnings = [...getManualEarningEvents(daily), entry];
  await writeStorage({ [storageKey]: daily });
  return { amount, entryType };
}

function sendDismissSuspectRequest(modelId, username) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_DISMISS_SUSPECT_BOT", modelId, username },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "A aba monitorada não pôde ser atualizada."));
          return;
        }
        resolve(response);
      },
    );
  });
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setBackupStatus(message, isError = false) {
  elements.backupStatus.textContent = message;
  elements.backupStatus.classList.toggle("error", isError);
}

function formatStorageBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function refreshLocalStorageSummary(modelBytes = null) {
  if (!elements.localStorageSummary) return;
  chrome.runtime.sendMessage({ type: "SCM_STORAGE_USAGE" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      elements.localStorageSummary.innerHTML =
        `<span>Estimativa do armazenamento indisponível.</span>`;
      return;
    }
    const modelId = elements.model?.value || "";
    const modelSize = modelBytes?.[modelId] ??
      response.modelBytes?.[modelId] ??
      null;
    const usedBytes = Number(response.originUsageBytes ?? response.bytes) || 0;
    const quotaBytes = Number(response.quotaBytes) || 0;
    const globalText = quotaBytes > 0
      ? `<span>Uso estimado do armazenamento do navegador (usado / quota):</span> ${formatStorageBytes(usedBytes)} / ${formatStorageBytes(quotaBytes)}`
      : `<span>Uso estimado do armazenamento do navegador:</span> ${formatStorageBytes(usedBytes)}`;
    const modelText = modelSize !== null
      ? `<br><span>Tamanho JSON estimado dos dados do(a) modelo selecionado:</span> ${formatStorageBytes(modelSize)}`
      : "";
    elements.localStorageSummary.innerHTML = `${globalText}${modelText}`;
  });
}

function emptyState(message) {
  setWorkspaceHtml(buildReportEmptyState(message));
}

function entriesForModel(modelId) {
  return listHistoryEntriesForModel(historyData, modelId);
}

function appendOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function setSelectValueIfAvailable(select, value) {
  if (value && Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

function populateModelOptions(preferredModelId = "") {
  const modelOptions = listHistoryModels(historyData);
  const previousModelId = elements.model.value || preferredModelId;
  elements.model.replaceChildren();
  modelOptions.forEach(({ modelId, label }) =>
    appendOption(elements.model, modelId, label),
  );

  const previousModel = modelOptions.find(
    (model) => model.modelIds.includes(previousModelId),
  );
  if (previousModel) {
    elements.model.value = previousModel.modelId;
  } else {
    elements.model.selectedIndex = 0;
  }

  const previousDeleteModelId = elements.deleteReportModel.value;
  elements.deleteReportModel.replaceChildren();
  modelOptions.forEach(({ modelId, label }) =>
    appendOption(elements.deleteReportModel, modelId, label),
  );
  const previousDeleteModel = modelOptions.find(
    (model) => model.modelIds.includes(previousDeleteModelId),
  );
  if (previousDeleteModel) {
    elements.deleteReportModel.value = previousDeleteModel.modelId;
  } else if (modelOptions.some((model) => model.modelId === elements.model.value)) {
    elements.deleteReportModel.value = elements.model.value;
  }
}

function populateDateOptions({
  resetMainToPreferred = false,
  preferredDateA = "",
  preferredDateB = "",
} = {}) {
  const dates = historyDatesForModel(elements.model.value);
  const previousDateA = elements.dateA.value;
  const previousDateB = elements.dateB.value;
  const currentDateKey = localDateKey();
  const preferredDateKey = dates.some((entry) => entry.dateKey === currentDateKey)
    ? currentDateKey
    : dates[0]?.dateKey || "";
  const dateKeys = dates.map((entry) => entry.dateKey);

  elements.dateA.replaceChildren();
  dates.forEach((entry) =>
    appendOption(elements.dateA, entry.dateKey, formatHistoryDate(entry)),
  );
  elements.dateA.value = resolveReportDateSelection(
    dateKeys,
    resetMainToPreferred ? "" : previousDateA || preferredDateA,
    preferredDateKey,
  );

  elements.dateB.replaceChildren();
  appendOption(elements.dateB, "", "Sem comparação");
  dates
    .filter((entry) => entry.dateKey !== elements.dateA.value)
    .forEach((entry) =>
      appendOption(elements.dateB, entry.dateKey, formatHistoryDate(entry)),
    );
  const requestedDateB = previousDateB || preferredDateB;
  elements.dateB.value = dates.some(
    (entry) => entry.dateKey === requestedDateB && entry.dateKey !== elements.dateA.value,
  )
    ? requestedDateB
    : "";
}

function historyDatesForModel(modelId) {
  return Array.from(
    new Map(entriesForModel(modelId).map((entry) => [entry.dateKey, entry])).values(),
  ).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function populateDeleteDateOptions({ resetSelection = false } = {}) {
  const previousDate = resetSelection ? "" : elements.deleteReportDate.value;
  const dates = historyDatesForModel(elements.deleteReportModel.value);
  elements.deleteReportDate.replaceChildren();
  appendOption(
    elements.deleteReportDate,
    "",
    dates.length ? "Selecione uma data" : "Nenhuma data disponível",
  );
  dates.forEach((entry) =>
    appendOption(
      elements.deleteReportDate,
      entry.dateKey,
      formatHistoryDate({ lastDate: entry.dateKey }),
    ),
  );
  elements.deleteReportDate.value = dates.some(
    (entry) => entry.dateKey === previousDate,
  )
    ? previousDate
    : "";
}

function populateSessionOptions(report) {
  const sessions = Array.isArray(report.liveSessions) ? report.liveSessions : [];
  const validSessions = sessions.filter((session) => session && typeof session === "object");
  const sessionId = (session) => String(session?.sessionId || "");
  sessions.splice(0, sessions.length, ...validSessions);
  const activeSession = sessions.findLast
    ? sessions.findLast((session) => String(session.status || "").toUpperCase() !== "ENCERRADA")
    : [...sessions].reverse().find((session) => String(session.status || "").toUpperCase() !== "ENCERRADA");
  const latestSession = sessions[sessions.length - 1] || null;
  const preferredSessionId = activeSession
    ? sessionId(activeSession)
    : sessionId(latestSession);
  const sessionLabel = (session, index) =>
    `Live ${index + 1} · ${session.startedAt || "--:--"} → ${session.endedAt || "ativa"}${session.status === "ENCERRADA" ? "" : " · ativa"}`;

  elements.sessionA.replaceChildren();
  sessions.forEach((session, index) => {
    const id = sessionId(session);
    if (id) appendOption(elements.sessionA, id, sessionLabel(session, index));
  });
  const availablePrimaryIds = sessions.map(sessionId).filter(Boolean);
  if (!availablePrimaryIds.includes(selectedSessionAId)) {
    selectedSessionAId = availablePrimaryIds.includes(preferredSessionId)
      ? preferredSessionId
      : availablePrimaryIds[availablePrimaryIds.length - 1] || "";
  }
  elements.sessionA.value = selectedSessionAId;
  if (!availablePrimaryIds.length) {
    appendOption(elements.sessionA, "", "Nenhuma live registrada");
  }

  elements.sessionB.replaceChildren();
  appendOption(elements.sessionB, "", "Sem comparação de live");
  const comparisonSessions = sessions.filter(
    (session) => sessionId(session) && sessionId(session) !== selectedSessionAId,
  );
  comparisonSessions.forEach((session) => {
    const index = sessions.indexOf(session);
    appendOption(elements.sessionB, sessionId(session), sessionLabel(session, index));
  });
  const availableComparisonIds = comparisonSessions.map(sessionId);
  if (!availableComparisonIds.includes(selectedSessionBId)) {
    selectedSessionBId = sessionComparisonCleared ? "" : availableComparisonIds[0] || "";
  }
  elements.sessionB.value = selectedSessionBId;

  updateDeleteReportScope();
  refreshDeleteLiveOptions().catch((error) => {
    setDeleteReportStatus(`Falha ao carregar as lives: ${error.message}`, true);
  });
}

function setDefaultPeriod() {
  if (elements.periodStart.value && elements.periodEnd.value) return;
  const end = localDateKey();
  const start = dateKeyToUtcDate(end);
  start.setUTCDate(start.getUTCDate() - 6);
  elements.periodStart.value = start.toISOString().slice(0, 10);
  elements.periodEnd.value = end;
}

function setDefaultComparisonPeriod() {
  const start = elements.periodStart.value;
  const end = elements.periodEnd.value;
  if (!start || !end || (elements.periodComparisonStart.value && elements.periodComparisonEnd.value)) return;

  const rangeDays = Math.floor(
    (dateKeyToUtcDate(end) - dateKeyToUtcDate(start)) / 86400000,
  ) + 1;
  const comparisonEnd = dateKeyToUtcDate(start);
  comparisonEnd.setUTCDate(comparisonEnd.getUTCDate() - 1);
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setUTCDate(comparisonStart.getUTCDate() - rangeDays + 1);

  elements.periodComparisonStart.value = comparisonStart.toISOString().slice(0, 10);
  elements.periodComparisonEnd.value = comparisonEnd.toISOString().slice(0, 10);
}

function findHistoryEntry(modelId, dateKey) {
  return entriesForModel(modelId).find((entry) => entry.dateKey === dateKey) ||
    historyData[`${modelId}::${dateKey}`] ||
    { modelId, dateKey, modelName: elements.model.selectedOptions[0]?.textContent || modelId };
}

async function renderDayReport(modelId) {
  const dateA = elements.dateA.value;
  if (!dateA) {
    currentReport = null;
    emptyState("Este modelo ainda não tem relatórios diários salvos.");
    setStatus("Nenhum dia disponível para o modelo selecionado.");
    return;
  }

  const dateB = elements.dateB.value;
  const historyEntryA = findHistoryEntry(modelId, dateA);
  const historyEntryB = dateB ? findHistoryEntry(modelId, dateB) : null;
  const reportModelIdA = historyEntryA.modelId || modelId;
  const reportModelIdB = historyEntryB?.modelId || modelId;
  const modelIdsA = historyEntryA.modelIds?.length ? historyEntryA.modelIds : [reportModelIdA];
  const modelIdsB = historyEntryB?.modelIds?.length
    ? historyEntryB.modelIds
    : [reportModelIdB];
  const keysA = modelIdsA.map((id) => `scm:model:${id}:daily:${dateA}`);
  const keysB = dateB
    ? modelIdsB.map((id) => `scm:model:${id}:daily:${dateB}`)
    : [];
  const result = await readStorage(["scm_rooms_history", ...keysA, ...keysB]);
  historyData = result.scm_rooms_history || historyData;

  const dailyA = mergeDailyReportBuckets(keysA.map((key) => result[key]));
  const report = buildReportData(historyEntryA, dailyA);
  populateSessionOptions(report);
  const selectedSession = report.liveSessions.find(
    (session) => session && session.sessionId === selectedSessionAId,
  ) || null;
  const comparisonSession = report.liveSessions.find(
    (session) => session && session.sessionId === selectedSessionBId,
  ) || null;
  if (elements.mode.value === "session") {
    if (!selectedSession) {
      currentReport = null;
      setWorkspaceHtml(buildReportEmptyState("Não há lives registradas para esta data."));
      setStatus(`${report.modelName} · ${report.dateBr} · sem lives registradas`);
      return;
    }

    const sessionMinuteRows = selectedSession.minuteRows || [];
    const autoStepMin = sessionMinuteRows.length
      ? getAdaptiveTimeStep(sessionMinuteRows)
      : 1;
    const timeStepMin = elements.timeGranularity.value === "auto"
      ? autoStepMin
      : Number(elements.timeGranularity.value) || autoStepMin;
    const chartData = buildDailyReportChartData({
      report,
      daily: dailyA,
      stepMinutes: timeStepMin,
      sessionId: selectedSession.sessionId,
    });

    setWorkspaceHtml(buildSessionReportHtml({
      dateBr: report.dateBr,
      dateKey: report.dateKey,
      modelId: report.modelId,
      modelName: report.modelName,
      session: selectedSession,
      dayShowStats: report.showStats,
      comparisonSession,
      timeBars: chartData.timeBars,
      timeStepMin,
      audiencePoints: chartData.audiencePoints,
    }));
    currentReport = { mode: "day", report };
    const liveIndex = report.liveSessions.indexOf(selectedSession) + 1;
    setStatus(`${report.modelName} · ${report.dateBr} · Live ${liveIndex}`);
    return;
  }

  const comparisonDaily = dateB
    ? mergeDailyReportBuckets(keysB.map((key) => result[key]))
    : null;
  const comparisonReport = dateB
    ? buildReportData(historyEntryB, comparisonDaily)
    : null;
  const hasHourlyFallback =
    Array.isArray(dailyA.hourlyTokens) && dailyA.hourlyTokens.length === 24;
  const autoStepMin = report.minuteRows.length
    ? getAdaptiveTimeStep(report.minuteRows)
    : hasHourlyFallback
      ? 60
      : 1;
  const timeStepMin = elements.timeGranularity.value === "auto"
    ? autoStepMin
    : Number(elements.timeGranularity.value) || autoStepMin;
  const chartData = buildDailyReportChartData({
    report,
    daily: dailyA,
    stepMinutes: timeStepMin,
  });
  const comparisonChartData = comparisonReport
    ? buildDailyReportChartData({
      report: comparisonReport,
      daily: comparisonDaily,
      stepMinutes: timeStepMin,
    })
    : null;

  setWorkspaceHtml(buildDailyReportHtml({
    report,
    daily: dailyA,
    comparisonReport,
    comparisonDaily,
    timeBars: chartData.timeBars,
    comparisonTimeBars: comparisonChartData?.timeBars || [],
    tokensWithoutTime: chartData.tokensWithoutTime,
    timeStepMin,
    audiencePoints: chartData.audiencePoints,
    sessionComparison: { sessionA: selectedSession, sessionB: comparisonSession },
    enableSuspectRemoval: true,
  }));
  currentReport = { mode: "day", report };
  setStatus(`${report.modelName} · ${report.dateBr}`);
}

async function renderPeriodReport(modelId) {
  const start = elements.periodStart.value || localDateKey();
  const end = elements.periodEnd.value || localDateKey();
  if (start > end) {
    currentReport = null;
    emptyState("A data inicial deve ser anterior ou igual à data final.");
    setStatus("Intervalo de datas inválido.", true);
    return;
  }

  const comparePeriods = elements.comparePeriods.checked;
  if (comparePeriods) setDefaultComparisonPeriod();
  const comparisonStart = comparePeriods ? elements.periodComparisonStart.value : "";
  const comparisonEnd = comparePeriods ? elements.periodComparisonEnd.value : "";
  if (comparePeriods && (!comparisonStart || !comparisonEnd || comparisonStart > comparisonEnd)) {
    currentReport = null;
    emptyState("Verifique as datas do período de comparação.");
    setStatus("Intervalo de comparação inválido.", true);
    return;
  }

  const modelEntries = entriesForModel(modelId);
  const dateKeys = listPeriodReportDateKeys(start, end);
  const comparisonDateKeys = comparePeriods
    ? listPeriodReportDateKeys(comparisonStart, comparisonEnd)
    : [];
  const entryForDate = new Map(modelEntries.map((entry) => [entry.dateKey, entry]));
  const comparisonEntries = new Map(
    modelEntries.map((entry) => [entry.dateKey, entry]),
  );
  const storageKeysForDate = (dateKey, entryMap) => {
    const entry = entryMap.get(dateKey);
    const modelIds = entry?.modelIds?.length ? entry.modelIds : [entry?.modelId || modelId];
    return modelIds.map((id) => `scm:model:${id}:daily:${dateKey}`);
  };
  const keysForDateA = (dateKey) => storageKeysForDate(dateKey, entryForDate);
  const keysForDateB = (dateKey) => storageKeysForDate(dateKey, comparisonEntries);
  const keysToRead = Array.from(new Set([
    ...dateKeys.flatMap(keysForDateA),
    ...comparisonDateKeys.flatMap(keysForDateB),
  ]));
  const result = await readStorage(keysToRead);
  const dailyByDate = Object.fromEntries(dateKeys.map((dateKey) => [
    dateKey,
    mergeDailyReportBuckets(keysForDateA(dateKey).map((key) => result[key])),
  ]));
  const comparisonDailyByDate = Object.fromEntries(comparisonDateKeys.map((dateKey) => [
    dateKey,
    mergeDailyReportBuckets(keysForDateB(dateKey).map((key) => result[key])),
  ]));
  const summary = buildPeriodReportSummary({
    modelId,
    modelEntries,
    start,
    end,
    dateKeys,
    dailyByDate,
    granularity: elements.periodGranularity.value,
  });
  const comparisonSummary = comparePeriods
    ? buildPeriodReportSummary({
      modelId,
      modelEntries,
      start: comparisonStart,
      end: comparisonEnd,
      dateKeys: comparisonDateKeys,
      dailyByDate: comparisonDailyByDate,
      granularity: elements.periodGranularity.value,
    })
    : null;

  setWorkspaceHtml(buildPeriodReportHtml(summary, {
    enableSuspectRemoval: true,
    enableMutedRemoval: true,
    enableModerationRemoval: true,
    comparisonSummary,
  }));
  currentReport = { mode: "period", summary, comparisonSummary };
  setStatus(
    comparePeriods
      ? `${summary.modelName} · ${start} até ${end} vs. ${comparisonStart} até ${comparisonEnd}`
      : `${summary.modelName} · ${start} até ${end}`,
  );
}

async function renderSelectedReport() {
  if (
    manualEntryDraft &&
    !canRestoreManualEntryDraft(manualEntryDraft, getManualEntryDraftContext())
  ) {
    manualEntryDraft = null;
  }
  await persistReportViewState();
  const modelId = elements.model.value;
  const hasModels = elements.model.options.length > 0;
  const isPeriod = elements.mode.value === "period";
  elements.status.hidden = isPeriod;
  elements.dayControls.hidden = isPeriod;
  elements.dateComparisonControl.hidden = elements.mode.value !== "day";
  elements.dayTimeControl.hidden = isPeriod;
  elements.periodControls.hidden = elements.mode.value !== "period";
  elements.periodComparisonControl.hidden = !isPeriod;
  elements.periodComparisonDates.hidden = !elements.comparePeriods.checked;
  if (!hasModels) {
    currentReport = null;
    emptyState("Nenhum histórico salvo. Monitore uma sala e guarde os dados para gerar relatórios.");
    setStatus("Ainda não há modelos salvos.");
    return;
  }

  setStatus("Carregando relatório…");
  if (elements.mode.value === "period") {
    await renderPeriodReport(modelId);
  } else {
    await renderDayReport(modelId);
  }
}

async function persistReportViewState() {
  await writeStorage({
    [REPORT_VIEW_STATE_KEY]: {
      mode: elements.mode.value,
      modelId: elements.model.value,
      dateA: elements.dateA.value,
      dateB: elements.dateB.value,
      sessionA: elements.sessionA.value || selectedSessionAId,
      sessionB: elements.sessionB.value || selectedSessionBId,
      sessionComparisonCleared,
      timeGranularity: elements.timeGranularity.value,
      periodStart: elements.periodStart.value,
      periodEnd: elements.periodEnd.value,
      periodGranularity: elements.periodGranularity.value,
      comparePeriods: elements.comparePeriods.checked,
      periodComparisonStart: elements.periodComparisonStart.value,
      periodComparisonEnd: elements.periodComparisonEnd.value,
    },
  });
}

async function loadAndRender() {
  setStatus("Carregando dados salvos…");
  try {
    const result = await readStorage(["scm_rooms_history", REPORT_VIEW_STATE_KEY]);
    historyData = result.scm_rooms_history || {};
    const viewState = normalizeReportViewState(result[REPORT_VIEW_STATE_KEY]);
    setSelectValueIfAvailable(elements.mode, viewState.mode);
    setSelectValueIfAvailable(elements.timeGranularity, viewState.timeGranularity);
    setSelectValueIfAvailable(elements.periodGranularity, viewState.periodGranularity);
    elements.comparePeriods.checked = viewState.comparePeriods;
    if (viewState.periodStart && viewState.periodEnd) {
      elements.periodStart.value = viewState.periodStart;
      elements.periodEnd.value = viewState.periodEnd;
    }
    elements.periodComparisonStart.value = viewState.periodComparisonStart;
    elements.periodComparisonEnd.value = viewState.periodComparisonEnd;
    selectedSessionAId = viewState.sessionA;
    selectedSessionBId = viewState.sessionB;
    sessionComparisonCleared = viewState.sessionComparisonCleared;
    populateModelOptions(viewState.modelId);
    populateDateOptions({
      preferredDateA: viewState.dateA,
      preferredDateB: viewState.dateB,
    });
    populateDeleteDateOptions();
    setDefaultPeriod();
    refreshLocalStorageSummary();
    await renderSelectedReport();
  } catch (error) {
    currentReport = null;
    emptyState("Não foi possível ler os dados locais. Verifique as permissões de armazenamento e tente atualizar.");
    setStatus(`Falha ao carregar os relatórios: ${error.message}`, true);
  }
}

async function dismissSuspectFromReport(username) {
  const cleanUsername = String(username || "").trim();
  if (!cleanUsername || !currentReport) return;

  const modelId = currentReport.mode === "day"
    ? currentReport.report.modelId
    : currentReport.summary.modelId;
  const dateKeys = currentReport.mode === "day"
    ? [currentReport.report.dateKey]
    : listPeriodReportDateKeys(currentReport.summary.start, currentReport.summary.end);
  const modelStorageKey = `scm:model:${modelId}`;
  const dailyStorageKeys = dateKeys.map(
    (dateKey) => `scm:model:${modelId}:daily:${dateKey}`,
  );
  const stored = await readStorage([modelStorageKey, ...dailyStorageKeys]);
  const normalized = cleanUsername.toLocaleLowerCase();
  const modelData = { ...(stored[modelStorageKey] || {}) };
  const dismissedNames = new Set(
    (Array.isArray(modelData.dismissedSuspectBots) ? modelData.dismissedSuspectBots : [])
      .map((name) => String(name).toLocaleLowerCase()),
  );
  dismissedNames.add(normalized);
  modelData.dismissedSuspectBots = Array.from(dismissedNames).slice(-300);
  const filterSuspects = (suspects) => {
    const values = Array.isArray(suspects)
      ? suspects
      : Object.values(suspects || {});
    return values.filter(
      (suspect) => String(suspect?.username || "").trim().toLocaleLowerCase() !== normalized,
    );
  };
  modelData.suspectBots = filterSuspects(modelData.suspectBots);
  if (modelData.dailyBuckets && typeof modelData.dailyBuckets === "object") {
    dateKeys.forEach((dateKey) => {
      const bucket = modelData.dailyBuckets[dateKey];
      if (bucket) bucket.suspectBots = filterSuspects(bucket.suspectBots);
    });
  }

  const updates = { [modelStorageKey]: modelData };
  dailyStorageKeys.forEach((key) => {
    const daily = stored[key];
    if (daily) updates[key] = { ...daily, suspectBots: filterSuspects(daily.suspectBots) };
  });
  await writeStorage(updates);

  let warning = "";
  try {
    const response = await sendDismissSuspectRequest(modelId, cleanUsername);
    warning = response.warning || "";
  } catch (error) {
    warning = ` A aba monitorada será atualizada na próxima inicialização (${error.message}).`;
  }

  await renderSelectedReport();
  setStatus(`${cleanUsername} foi removido das suspeitas neste relatório.${warning}`);
}

function exportCurrentReport() {
  if (!currentReport) {
    setStatus("Não há relatório para exportar.", true);
    return;
  }

  try {
    if (currentReport.mode === "period") {
      const summary = currentReport.summary;
      const csv = buildPeriodReportCsv(summary, {
        weekdayNames: WEEKDAY_NAMES,
        weekdayIndexFromDateKey,
      });
      triggerCsvDownload(
        csv,
        `periodo-${safeFilename(summary.modelId)}-${summary.start}-a-${summary.end}.csv`,
      );
      return;
    }

    const report = currentReport.report;
    triggerCsvDownload(
      buildDailyReportCsv(report, formatReportDuration),
      `relatorio-${safeFilename(report.modelId)}-${report.dateKey || "dia"}.csv`,
    );
  } catch (error) {
    setStatus(`Falha ao exportar o relatório: ${error.message}`, true);
  }
}

async function exportDataBackup() {
  elements.exportBackup.disabled = true;
  try {
    const storageData = await readStorage(null);
    const selectedModelId = elements.model.value;
    const selectedModelName = elements.model.selectedOptions[0]?.textContent || selectedModelId;
    const scope = elements.exportBackupScope.value === "model"
      ? { type: "model", modelId: selectedModelId, modelName: selectedModelName }
      : { type: "all" };
    const backup = createBackupPayload(
      storageData,
      new Date().toISOString(),
      chrome.runtime?.getManifest?.().version || "unknown",
      scope,
    );
    const itemCount = Object.keys(backup.data).length;
    if (!itemCount) {
      setBackupStatus("Ainda não há dados locais do SC Monitor para exportar.", true);
      return;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const scopeName = backup.scope.type === "model"
      ? `-${safeFilename(backup.scope.modelId)}`
      : "";
    link.download = `sc-monitor-backup${scopeName}-${localDateKey()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus(
      `Backup ${backup.scope.type === "model" ? "da modelo" : "completo"} exportado: ${itemCount} itens locais.`,
    );
  } catch (error) {
    setBackupStatus(`Falha ao criar o backup: ${error.message}`, true);
  } finally {
    elements.exportBackup.disabled = false;
  }
}

function sendRestoreRequest(data, backupScope, restoreScope) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_RESTORE_BACKUP", data, backupScope, restoreScope },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          const restoreError = new Error(response?.error || "A restauração não foi concluída.");
          restoreError.dataApplied = response?.dataApplied === true;
          reject(restoreError);
          return;
        }
        resolve(response);
      },
    );
  });
}

function populateBackupImportModels(models) {
  const previous = elements.backupImportModel.value;
  elements.backupImportModel.replaceChildren();
  models.forEach(({ modelId, modelName }) => {
    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = modelName;
    elements.backupImportModel.append(option);
  });
  if (models.some((model) => model.modelId === previous)) {
    elements.backupImportModel.value = previous;
  }
  const modelOption = elements.backupImportScope.querySelector('option[value="model"]');
  modelOption.disabled = models.length === 0;
  return models.length > 0;
}

function updateBackupImportControls() {
  elements.backupImportModelControl.hidden = elements.backupImportScope.value !== "model";
}

function clearPendingBackup() {
  pendingBackupImport = null;
  elements.backupImportOptions.hidden = true;
  elements.backupPreview.hidden = true;
}

async function inspectBackupFile(event) {
  const file = event.target.files?.[0];
  elements.backupFile.value = "";
  if (!file) return;

  if (file.size > MAX_BACKUP_FILE_BYTES) {
    setBackupStatus("O arquivo excede o limite de 25 MiB.", true);
    return;
  }

  try {
    pendingBackupImport = parseBackupText(await file.text());
    const backupScope = getBackupScope(pendingBackupImport);
    const models = getBackupModelOptions(pendingBackupImport.data);
    populateBackupImportModels(models);
    elements.backupImportScope.disabled = backupScope.type !== "all";
    elements.backupImportScope.value = backupScope.type === "all" ? "all" : "model";
    elements.backupImportOptions.hidden = false;
    elements.backupPreview.hidden = false;
    elements.backupPreview.textContent = backupScope.type === "model"
      ? `Backup limitado à modelo ${backupScope.modelName || backupScope.modelId}.`
      : `Backup completo: ${Object.keys(pendingBackupImport.data).length} itens e ${models.length} modelos.`;
    updateBackupImportControls();
    setBackupStatus("Revise o escopo e confirme a restauração.");
  } catch (error) {
    clearPendingBackup();
    setBackupStatus(`Não foi possível ler o backup: ${error.message}`, true);
  }
}

async function applyDataBackup() {
  if (!pendingBackupImport) return;
  const backup = pendingBackupImport;
  const backupScope = getBackupScope(backup);
  const restoreScope = elements.backupImportScope.value === "model"
    ? {
        type: "model",
        modelId: elements.backupImportModel.value,
        modelName: elements.backupImportModel.selectedOptions[0]?.textContent ||
          elements.backupImportModel.value,
      }
    : { type: "all" };

  if (backupScope.type === "model" && restoreScope.type !== "model") {
    setBackupStatus("Um backup limitado a modelo só pode restaurar essa modelo.", true);
    return;
  }
  if (restoreScope.type === "model" && !restoreScope.modelId) {
    setBackupStatus("Selecione uma modelo para restaurar.", true);
    return;
  }

  const confirmMessage = restoreScope.type === "all"
    ? `Restaurar ${Object.keys(backup.data).length} itens? Todos os dados locais do SC Monitor serão substituídos.`
    : `Restaurar somente os dados de ${restoreScope.modelName}? Os demais modelos serão preservados.`;
  if (!confirm(confirmMessage)) {
    setBackupStatus("Importação cancelada.");
    return;
  }

  elements.applyBackup.disabled = true;
  try {
    setBackupStatus("Verificando monitoramento e restaurando dados…");
    const result = await sendRestoreRequest(backup.data, backupScope, restoreScope);
    clearPendingBackup();
    setBackupStatus(`Backup importado: ${result.itemCount} itens locais.`);
    await loadAndRender();
  } catch (error) {
    const prefix = error.dataApplied
      ? "Os dados foram gravados, mas a atualização não foi concluída"
      : "Falha ao importar o backup";
    setBackupStatus(`${prefix}: ${error.message}`, true);
  } finally {
    elements.applyBackup.disabled = false;
  }
}

function safeFilename(value) {
  return String(value || "modelo").replace(/[^a-z0-9_-]/gi, "_");
}

function setDeleteReportStatus(message, isError = false) {
  elements.deleteReportStatus.textContent = message;
  elements.deleteReportStatus.classList.toggle("error", isError);
}

function updateDeleteReportScope() {
  const scope = elements.deleteReportScope.value;
  const needsDate = scope === "day" || scope === "live";
  const isLive = scope === "live";
  elements.deleteReportDateControl.hidden = !needsDate;
  elements.deleteReportLiveControl.hidden = !isLive;
}

async function refreshDeleteLiveOptions({ resetSelection = false } = {}) {
  const modelId = elements.deleteReportModel.value;
  const dateKey = elements.deleteReportDate.value;
  const previousLiveId = resetSelection ? "" : elements.deleteReportLive.value;
  elements.deleteReportLive.replaceChildren();
  appendOption(
    elements.deleteReportLive,
    "",
    dateKey ? "Selecione uma live" : "Selecione uma data primeiro",
  );
  if (!modelId || !dateKey) return;

  const dailyKey = `scm:model:${modelId}:daily:${dateKey}`;
  const data = await readStorage([dailyKey]);
  if (
    elements.deleteReportModel.value !== modelId ||
    elements.deleteReportDate.value !== dateKey
  ) return;
  const sessions = Object.entries(data[dailyKey]?.liveSessions || {})
    .filter(([, session]) => session && typeof session === "object")
    .sort(([, a], [, b]) =>
      (Number(a.startedAtTs) || 0) - (Number(b.startedAtTs) || 0),
    );
  sessions.forEach(([sessionId, session], index) => {
    appendOption(
      elements.deleteReportLive,
      sessionId,
      `Live ${index + 1} · ${session.startedAt || "--:--"} → ${session.endedAt || "ativa"}`,
    );
  });
  if (sessions.some(([sessionId]) => sessionId === previousLiveId)) {
    elements.deleteReportLive.value = previousLiveId;
  } else if (!sessions.length) {
    elements.deleteReportLive.options[0].textContent = "Nenhuma live registrada nesta data";
  }
}

function sendDeleteReportData(modelId, scope, dateKey, liveId) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_DELETE_REPORT_DATA", modelId, scope, dateKey, liveId },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Não foi possível apagar os dados."));
          return;
        }
        resolve(response);
      },
    );
  });
}

function sendDeleteTimelineEntry(entry) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_DELETE_REPORT_TIMELINE_ENTRY", ...entry },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Não foi possível apagar o registro."));
          return;
        }
        resolve(response);
      },
    );
  });
}

function sendDeleteModerationLog(entry) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_DELETE_MODERATION_LOG", ...entry },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Não foi possível apagar o registro."));
          return;
        }
        resolve(response);
      },
    );
  });
}

function sendDeleteMutedUserRecords(entry) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_DELETE_MUTED_USER_RECORDS", ...entry },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Não foi possível apagar os registros."));
          return;
        }
        resolve(response);
      },
    );
  });
}

function setTimelineDeleteStatus(message, isError = false) {
  const status = elements.workspace.querySelector(".timeline-delete-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setMutedDeleteStatus(message, isError = false) {
  const status = elements.workspace.querySelector(".muted-delete-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function deleteTimelineEntry(button) {
  const entry = {
    modelId: button.dataset.modelId || "",
    dateKey: button.dataset.entryDate || "",
    entryType: button.dataset.entryKind || "",
    sourceIndex: Number(button.dataset.entryIndex),
    sourceKey: button.dataset.entryKey || "",
  };
  const label = button.dataset.entryDescription || button.dataset.entryLabel || "registro";
  if (!confirm(`Apagar "${label}" de ${entry.dateKey}? O registro da linha do tempo será removido; métricas agregadas não serão recalculadas.`)) {
    return;
  }

  button.disabled = true;
  setTimelineDeleteStatus("Apagando registro…");
  try {
    if (entry.entryType === "goal") {
      Object.assign(entry, {
        description: button.dataset.entryDescription || "",
        status: button.dataset.entryStatus || "",
        amount: Number(button.dataset.entryAmount),
        timestamp: Number(button.dataset.entryTimestamp),
      });
    } else {
      Object.assign(entry, {
        eventId: button.dataset.entryId || "",
        label: button.dataset.entryLabel || "",
        eventType: button.dataset.entryType || "",
        tokens: Number(button.dataset.entryTokens),
        timestamp: Number(button.dataset.entryTimestamp),
      });
    }

    await sendDeleteTimelineEntry(entry);
    await renderSelectedReport();
    setTimelineDeleteStatus("Registro apagado.");
  } catch (error) {
    setTimelineDeleteStatus(`Falha ao apagar: ${error.message}`, true);
    button.disabled = false;
  }
}

async function deleteManualEntry(button) {
  const modelId = button.dataset.modelId || "";
  const dateKey = button.dataset.entryDate || "";
  const entryId = button.dataset.entryId || "";
  if (!modelId || !dateKey || !entryId) {
    setStatus("Não foi possível identificar o ganho manual para apagar.", true);
    return;
  }
  if (!confirm(`Apagar este ganho manual de ${dateKey}? Os totais do relatório serão atualizados.`)) {
    return;
  }

  button.disabled = true;
  setStatus("Apagando ganho manual…");
  try {
    const storageKey = `scm:model:${modelId}:daily:${dateKey}`;
    const stored = await readStorage([storageKey]);
    const daily = stored[storageKey];
    if (!daily || typeof daily !== "object") {
      throw new Error("O relatório selecionado não foi encontrado no armazenamento.");
    }

    const result = removeManualEntryFromDaily(daily, entryId);
    if (!result.removed) {
      throw new Error("O ganho manual não foi encontrado; atualize o relatório.");
    }
    await writeStorage({ [storageKey]: result.daily });
    await renderSelectedReport();
    setStatus("Ganho manual apagado e totais atualizados.");
  } catch (error) {
    setStatus(`Falha ao apagar o ganho manual: ${error.message}`, true);
    button.disabled = false;
  }
}

async function deleteModerationLog(button) {
  const entry = {
    modelId: button.dataset.modelId || "",
    dateKey: button.dataset.entryDate || "",
    logId: button.dataset.logId || "",
  };
  const username = button.dataset.logUser || "registro de moderação";
  if (!confirm(`Apagar o registro de "${username}" em ${entry.dateKey}? Ele será removido da lista; os totais agregados não serão alterados.`)) {
    return;
  }

  button.disabled = true;
  setTimelineDeleteStatus("Apagando registro de moderação…");
  try {
    const result = await sendDeleteModerationLog(entry);
    await renderSelectedReport();
    setTimelineDeleteStatus(
      `Registro removido; os totais foram mantidos.${result.warning || ""}`,
    );
  } catch (error) {
    setTimelineDeleteStatus(`Falha ao apagar: ${error.message}`, true);
    button.disabled = false;
  }
}

async function deleteMutedUserRecords(button) {
  const modelId = button.dataset.modelId || "";
  const username = button.dataset.username || "";
  const start = button.dataset.startDate || "";
  const end = button.dataset.endDate || "";
  if (!currentReport || currentReport.mode !== "period") return;

  const dateKeys = listPeriodReportDateKeys(start, end);
  const entriesByDate = new Map(
    entriesForModel(modelId).map((entry) => [entry.dateKey, entry]),
  );
  const dailyRecords = dateKeys.flatMap((dateKey) => {
    const entry = entriesByDate.get(dateKey);
    const modelIds = entry?.modelIds?.length
      ? entry.modelIds
      : [entry?.modelId || modelId];
    return modelIds.map((id) => ({ modelId: id, dateKey }));
  });
  if (!username || dailyRecords.length === 0) {
    setMutedDeleteStatus("Não foi possível identificar os registros deste período.", true);
    return;
  }
  if (!confirm(`Apagar os registros de "${username}" de ${start} até ${end}? A exclusão ficará limitada a esse período.`)) {
    return;
  }

  button.disabled = true;
  setMutedDeleteStatus("Apagando registros do período…");
  try {
    const result = await sendDeleteMutedUserRecords({ username, dailyRecords });
    await renderSelectedReport();
    const statusMessage = `${result.removedDates || 0} registro(s) diário(s) removido(s) do período.`;
    setMutedDeleteStatus(statusMessage);
    setStatus(statusMessage);
  } catch (error) {
    setMutedDeleteStatus(`Falha ao apagar: ${error.message}`, true);
    button.disabled = false;
  }
}

async function deleteReportData() {
  const modelId = elements.deleteReportModel.value;
  const modelName = elements.deleteReportModel.selectedOptions[0]?.textContent || modelId;
  const selectedScope = ["day", "live", "model"].includes(elements.deleteReportScope.value)
    ? elements.deleteReportScope.value
    : "day";
  const scope = selectedScope === "day" ? "date" : selectedScope;
  const dateKey = elements.deleteReportDate.value;
  const dateLabel = dateKey ? formatHistoryDate({ lastDate: dateKey }) : "";
  const liveId = elements.deleteReportLive.value;
  if (!modelId) {
    setDeleteReportStatus("Selecione um modelo para apagar.", true);
    return;
  }
  if (selectedScope !== "model" && !dateKey) {
    setDeleteReportStatus("Selecione a data que deseja apagar.", true);
    return;
  }
  if (selectedScope === "live" && !liveId) {
    setDeleteReportStatus("Selecione a live que deseja apagar.", true);
    return;
  }

  const confirmation = selectedScope === "model"
    ? `Apagar todo o histórico da modelo ${modelName}? Esta ação remove todas as datas desse modelo.`
    : selectedScope === "live"
      ? `Apagar somente a live selecionada de ${modelName} em ${dateLabel}?`
      : `Apagar somente os dados de ${modelName} em ${dateLabel}?`;
  if (!confirm(confirmation)) {
    setDeleteReportStatus("Exclusão cancelada.");
    return;
  }

  elements.deleteReportData.disabled = true;
  try {
    setDeleteReportStatus("Apagando dados locais…");
    const result = await sendDeleteReportData(modelId, scope, dateKey, liveId);
    await loadAndRender();
    setDeleteReportStatus(
      selectedScope === "model"
        ? `Histórico da modelo ${modelName} apagado (${result.removedKeys} itens).`
        : selectedScope === "live"
          ? `Live selecionada de ${modelName} em ${dateKey} apagada.`
          : `Dados de ${modelName} em ${dateKey} apagados.`,
    );
  } catch (error) {
    setDeleteReportStatus(`Falha ao apagar: ${error.message}`, true);
  } finally {
    elements.deleteReportData.disabled = false;
  }
}

elements.mode.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.model.addEventListener("change", () => {
  elements.timeGranularity.value = "auto";
  elements.deleteReportModel.value = elements.model.value;
  populateDeleteDateOptions({ resetSelection: true });
  populateDateOptions({ resetMainToPreferred: true });
  refreshLocalStorageSummary();
  refreshDeleteLiveOptions({ resetSelection: true }).catch((error) => {
    setDeleteReportStatus(`Falha ao carregar as lives: ${error.message}`, true);
  });
  renderSelectedReport().catch(showRenderError);
});
elements.dateA.addEventListener("change", () => {
  populateDateOptions();
  renderSelectedReport().catch(showRenderError);
});
elements.dateB.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.sessionA.addEventListener("change", () => {
  selectedSessionAId = elements.sessionA.value;
  if (selectedSessionAId === selectedSessionBId) {
    selectedSessionBId = "";
    sessionComparisonCleared = false;
  }
  renderSelectedReport().catch(showRenderError);
});
elements.sessionB.addEventListener("change", () => {
  selectedSessionBId = elements.sessionB.value;
  sessionComparisonCleared = !selectedSessionBId;
  renderSelectedReport().catch(showRenderError);
});
elements.timeGranularity.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.periodStart.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.periodEnd.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.periodGranularity.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.comparePeriods.addEventListener("change", () => {
  if (elements.comparePeriods.checked) setDefaultComparisonPeriod();
  elements.periodComparisonDates.hidden = !elements.comparePeriods.checked;
  renderSelectedReport().catch(showRenderError);
});
elements.periodComparisonStart.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.periodComparisonEnd.addEventListener("change", () => renderSelectedReport().catch(showRenderError));
elements.sidebarToggle.addEventListener("click", () => {
  const isExpanded = elements.sidebarToggle.getAttribute("aria-expanded") === "true";
  const nextExpanded = !isExpanded;
  const label = nextExpanded ? "Fechar menu lateral" : "Abrir menu lateral";

  elements.appShell.classList.toggle("sidebar-collapsed", !nextExpanded);
  elements.sidebarToggle.setAttribute("aria-expanded", String(nextExpanded));
  elements.sidebarToggle.setAttribute("aria-label", label);
  elements.sidebarToggle.title = label;
});
elements.refresh.addEventListener("click", () => loadAndRender());
elements.export.addEventListener("click", exportCurrentReport);
elements.exportBackup.addEventListener("click", exportDataBackup);
elements.importBackup.addEventListener("click", () => elements.backupFile.click());
elements.deleteReportData.addEventListener("click", deleteReportData);
elements.deleteReportModel.addEventListener("change", () => {
  populateDeleteDateOptions({ resetSelection: true });
  refreshDeleteLiveOptions({ resetSelection: true }).catch((error) => {
    setDeleteReportStatus(`Falha ao carregar as lives: ${error.message}`, true);
  });
});
elements.backupFile.addEventListener("change", inspectBackupFile);
elements.deleteReportDate.addEventListener("change", () => {
  refreshDeleteLiveOptions({ resetSelection: true }).catch((error) => {
    setDeleteReportStatus(`Falha ao carregar as lives: ${error.message}`, true);
  });
});
elements.deleteReportScope.addEventListener("change", () => {
  updateDeleteReportScope();
  if (elements.deleteReportScope.value !== "live") return;
  refreshDeleteLiveOptions().catch((error) => {
    setDeleteReportStatus(`Falha ao carregar as lives: ${error.message}`, true);
  });
});
elements.backupImportScope.addEventListener("change", updateBackupImportControls);
elements.applyBackup.addEventListener("click", applyDataBackup);
elements.cancelBackup.addEventListener("click", () => {
  clearPendingBackup();
  setBackupStatus("Importação cancelada.");
});
elements.workspace.addEventListener("change", (event) => {
  const form = event.target.closest("[data-manual-entry-form]");
  if (!form) return;
  updateManualEntryForm(form);
  captureManualEntryDraft(form);
});
elements.workspace.addEventListener("input", (event) => {
  const form = event.target.closest("[data-manual-entry-form]");
  if (form) captureManualEntryDraft(form);
});
elements.workspace.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-manual-entry-form]");
  if (!form) return;
  event.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-manual-entry-status]");
  if (button) button.disabled = true;
  if (status) status.textContent = "Salvando…";
  saveManualEarning(form)
    .then(async ({ amount, entryType }) => {
      manualEntryDraft = null;
      setStatus(`${entryType}: ${amount} tk adicionados ao relatório.`);
      try {
        await renderSelectedReport();
      } catch (error) {
        setStatus(`Ganho salvo, mas o relatório não foi atualizado: ${error.message}`, true);
      }
    })
    .catch((error) => {
      if (status) status.textContent = error.message;
      setStatus(`Falha ao adicionar o ganho manual: ${error.message}`, true);
    })
    .finally(() => {
      if (button) button.disabled = false;
    });
});
elements.workspace.addEventListener("click", (event) => {
  const manualEntryButton = event.target.closest(".report-delete-manual-entry");
  if (manualEntryButton) {
    deleteManualEntry(manualEntryButton);
    return;
  }

  const timelineButton = event.target.closest(".report-delete-timeline");
  if (timelineButton) {
    deleteTimelineEntry(timelineButton);
    return;
  }

  const moderationLogButton = event.target.closest(".report-delete-moderation-log");
  if (moderationLogButton) {
    deleteModerationLog(moderationLogButton);
    return;
  }

  const mutedUserButton = event.target.closest(".report-delete-muted-user");
  if (mutedUserButton) {
    deleteMutedUserRecords(mutedUserButton);
    return;
  }

  const button = event.target.closest(".report-dismiss-suspect");
  if (!button) return;
  button.disabled = true;
  dismissSuspectFromReport(button.getAttribute("data-username"))
    .catch((error) => {
      setStatus(`Falha ao remover a suspeita: ${error.message}`, true);
      button.disabled = false;
    });
});

function showRenderError(error) {
  currentReport = null;
  emptyState("O relatório não pôde ser montado. Tente atualizar a página.");
  setStatus(`Falha ao gerar o relatório: ${error.message}`, true);
}

if (chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    const changedKeys = Array.isArray(message?.keys) ? message.keys : [];
    if (
      message?.type === "SCM_STORAGE_CHANGED" &&
      changedKeys.some((key) => key === "scm_rooms_history" || key.startsWith("scm:model:"))
    ) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadAndRender(), 250);
    }
  });
}

initializeLocalization().then(() => {
  bindLanguageSelector(document.getElementById("scm-language"));
  watchLocalization(document.querySelector(".app-shell"));
  loadAndRender();
}).catch((error) => {
  console.error("[SC Monitor] Não foi possível inicializar o idioma:", error);
  loadAndRender();
});
