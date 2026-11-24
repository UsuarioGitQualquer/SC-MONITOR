import { clean } from "../utils/helpers.js";
import { safeStorage } from "../core/storage.js";
import {
  buildDailyReportCsv,
  buildUsersCsv,
  triggerCsvDownload,
} from "./export/csv-export.js";
import { buildHistoryTableHtml, formatStorageBytes } from "./history/history-table.js";
import { buildUsersTableHtml } from "./users/users-table.js";
import { buildTodoListView, formatPendingTodos } from "./todos/todo-list.js";
import {
  buildModerationLogRows,
  buildModerationTagsHtml,
  buildMutedUserRows,
  buildSuspectBotRows,
} from "./moderation/moderation-view.js";
import { buildDailyStatsHtml } from "./dashboard/daily-stats.js";
import { buildPanelHtml } from "./panel-template.js";
import { createPanelReportController } from "./panel-report-controller.js";
import { createPanelEventsController } from "./panel-events-controller.js";
import { calculatePanelResize } from "./panel-resize.js";
import { openReportsPage } from "./open-reports.js";
import {
  buildAudienceLeagueChart,
  buildNeonDonutGauge,
  buildNeonWaveAreaChart,
  buildTimeStepSelectorHtml,
} from "./dashboard/basic-charts.js";
import {
  createBackupPayload,
  getBackupModelOptions,
  getBackupScope,
  MAX_BACKUP_FILE_BYTES,
  parseBackupText,
} from "../core/backup.js";
import { state, getMonitoring, localDateKey, getAudienceBreakdown } from "../core/state.js";
import { saveToGlobalHistory, waitForHistorySaves } from "../core/persistence.js";
import { subscribeToUIRefresh, UI_REFRESH } from "../core/ui-refresh.js";
import {
  buildDailyFlowMinuteRows,
  buildDayTimeBars,
  buildTimeBucketBars,
  getAdaptiveTimeStep,
  normalizeMinuteBuckets,
} from "./chart-data.js";
import {
  buildAudienceChartPoints,
  buildReportData,
  classifyGainType,
  getCanonicalModelKey,
  getHistoryModelId,
  hasAudienceStats,
} from "./report-data.js";
import { buildReportHorizontalChart } from "./report-charts.js";

let panel, launch;
let unsubscribeUIRefresh = null;
let activeTab = "general";
let usersFilterMode = "all";
let outsideClickListener = null;
let dailyFlowStepMin = "auto";
let usersAudienceStepMin = "auto";
let sessionUserFlowStepMin = "auto";
let dailyStatsRenderSequence = 0;
let sessionUserFlowChartCache = { sessionId: "", updatedAt: 0, html: "" };
let pendingBackupImport = null;
let todayTokensHistoryCache = {
  key: "",
  updatedAt: 0,
  pending: false,
  currentModelTokens: 0,
  otherModelTokens: 0,
};

const eventsController = createPanelEventsController({
  getPanel: () => panel,
  getState: () => state,
  localDateKey,
  buildGainTypeChart,
  buildTopDonorsChart,
});

const reportController = createPanelReportController({
  getPanel: () => panel,
  buildGainTypeChart,
  buildTopDonorsChart,
  formatSecondsToTime,
  generateExecutiveText,
  downloadDailyReportCSV,
});

function getDailyTokensTotal() {
  const todayKey = localDateKey();
  const todayBucket = state.dailyBuckets?.[todayKey] || null;
  const totalTokensVal = Number(state.totalTokens) || 0;
  if (todayBucket && todayBucket.dailyTokens !== undefined && todayBucket.dailyTokens !== null) {
    return Math.max(0, Math.round(Number(todayBucket.dailyTokens) || 0));
  }
  if (todayBucket) {
    return Math.max(0, Math.round(totalTokensVal - (Number(todayBucket.dayStartTokens) || 0)));
  }
  return Math.max(0, Math.round(totalTokensVal));
}

function refreshTodayTokensDisplay() {
  if (!panel) return;

  const todayKey = localDateKey();
  const modelId = String(state.modelId || state.room || "");
  const canonicalName = getCanonicalModelKey("", {
    modelId,
    modelName: state.modelName || state.room,
  });
  const cacheKey = `${todayKey}:${modelId}:${canonicalName}`;
  const localTokens = getDailyTokensTotal();
  const updateDisplay = () => {
    if (todayTokensHistoryCache.key !== cacheKey) return;
    const displayedTokens =
      todayTokensHistoryCache.otherModelTokens +
      Math.max(localTokens, todayTokensHistoryCache.currentModelTokens);
    const tokensEl = panel.querySelector("#scm-tokens");
    if (tokensEl) tokensEl.textContent = `${Math.round(displayedTokens)} tk`;
  };

  if (todayTokensHistoryCache.key === cacheKey) {
    updateDisplay();
    if (
      todayTokensHistoryCache.pending ||
      Date.now() - todayTokensHistoryCache.updatedAt < 10000
    ) {
      return;
    }
  }

  todayTokensHistoryCache = {
    ...(todayTokensHistoryCache.key === cacheKey
      ? todayTokensHistoryCache
      : {
          key: cacheKey,
          currentModelTokens: 0,
          otherModelTokens: 0,
        }),
    updatedAt: Date.now(),
    pending: true,
  };

  safeStorage.get(["scm_rooms_history"], (res, result) => {
    if (todayTokensHistoryCache.key !== cacheKey) return;
    const tokenTotalsByModel = new Map();
    if (result?.ok !== false) {
      Object.entries(res?.scm_rooms_history || {}).forEach(([entryKey, entry]) => {
        if (
          String(entry?.dateKey || "") !== todayKey ||
          getCanonicalModelKey(entryKey, entry) !== canonicalName
        ) {
          return;
        }

        const historyModelId = getHistoryModelId(entryKey, entry);
        const tokens = Math.max(0, Number(entry?.totalTokens) || 0);
        tokenTotalsByModel.set(
          historyModelId,
          Math.max(tokenTotalsByModel.get(historyModelId) || 0, tokens),
        );
      });
    }

    let otherModelTokens = 0;
    tokenTotalsByModel.forEach((tokens, historyModelId) => {
      if (historyModelId === modelId) {
        todayTokensHistoryCache.currentModelTokens = tokens;
      } else {
        otherModelTokens += tokens;
      }
    });

    todayTokensHistoryCache.otherModelTokens = otherModelTokens;
    todayTokensHistoryCache.pending = false;
    todayTokensHistoryCache.updatedAt = Date.now();
    updateDisplay();
  });
}

function getActivePaceSeconds() {
  const netSession = Number(state.timerState?.netSeconds) || 0;
  return Math.max(0, netSession);
}

function updatePanelFooterDate() {
  const dateEl = document.getElementById("scm-panel-footer-date");
  if (dateEl) dateEl.textContent = `📅 ${formatIsoDateToBr(localDateKey())}`;
}

function formatPaceDisplay(tokens, seconds, minSecondsToProject = 120) {
  const tk = Number(tokens) || 0;
  const secs = Number(seconds) || 0;
  if (secs <= 0) return "—";
  if (tk <= 0) return "0 tk/h";
  if (secs < minSecondsToProject) return "—";
  return `${Math.round((tk / secs) * 3600)} tk/h`;
}

export function csv() {
  return buildUsersCsv(state.users);
}

function buildGainTypeChart(summaryMapOverride = null, eventsOverride = null) {
  const summaryMap = summaryMapOverride || state.eventSummaryTotals || {};
  const entries = Object.entries(summaryMap);

  const buckets = {
    "Gorjeta avulsa": 0,
    "Compra de Conteúdo": 0,
    "Roleta": 0,
    "Battleship": 0,
    "Menu": 0,
    "Objetivo Épico": 0,
    "Ticket": 0,
    "Show privado": 0,
    "Show exclusivo": 0,
    "Outros": 0,
  };

  if (entries.length > 0) {
    entries.forEach(([itemName, data]) => {
      const tokens = Math.round(Number(data?.tokens) || 0);
      if (tokens <= 0) return;
      const cat = classifyGainType(itemName, data?.type);
      buckets[cat] += tokens;
    });
  } else {
    const fallbackEvents = Array.isArray(eventsOverride)
      ? eventsOverride
      : (Array.isArray(state.capturedEvents) ? state.capturedEvents : []);
    fallbackEvents.forEach((ev) => {
      const tokens = Math.round(Number(ev?.price) || 0);
      if (tokens <= 0) return;
      const cat = classifyGainType(ev?.item, ev?.type);
      buckets[cat] += tokens;
    });
  }

  const totalClassified = Object.values(buckets).reduce((acc, v) => acc + v, 0);
  if (totalClassified <= 0) return "";

  const rows = Object.entries(buckets)
    .filter(([, val]) => val > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => {
      return {
        label,
        value,
        color: "#60a5fa",
        secondaryColor: "#818cf8",
      };
    });

  return buildReportHorizontalChart({
    title: "💎 Ganhos por Tipo",
    subtitle: `${totalClassified} tk`,
    accentColor: "#60a5fa",
    rows,
  });
}

function buildTopDonorsChart(limit = 6, scopeEventsOverride = null) {
  let donors;
  if (Array.isArray(scopeEventsOverride)) {
    const donorsMap = new Map();
    scopeEventsOverride.forEach((event) => {
      const name = String(event?.user || "").trim();
      const tokens = Number(event?.price ?? event?.tokens) || 0;
      if (!name || name === "—" || tokens <= 0) return;
      const previous = donorsMap.get(name) || { name, tokens: 0, tips: 0 };
      previous.tokens += tokens;
      previous.tips += 1;
      donorsMap.set(name, previous);
    });
    donors = Array.from(donorsMap.values()).sort((a, b) => b.tokens - a.tokens);
  } else {
    donors = Object.values(state.users || {})
      .filter((u) => u && (Number(u.tokens) || 0) > 0)
      .sort((a, b) => (Number(b.tokens) || 0) - (Number(a.tokens) || 0));
  }

  if (donors.length === 0) return "";

  const totalDonorTokens = donors.reduce((acc, u) => acc + (Number(u.tokens) || 0), 0);
  const topSlice = donors.slice(0, limit);
  const restTokens = donors.slice(limit).reduce((acc, u) => acc + (Number(u.tokens) || 0), 0);

  const rows = topSlice.map((u, idx) => {
    const tk = Math.round(Number(u.tokens) || 0);
    const tips = Number(u.tips) || 0;
    const pct = totalDonorTokens > 0 ? Math.round((tk / totalDonorTokens) * 100) : 0;
    return {
      label: `#${idx + 1} ${u.name} (${tips}x • ${pct}%)`,
      value: tk,
      color: idx === 0 ? "#ff2a6d" : "#00e5ff",
      secondaryColor: idx === 0 ? "#ff7b00" : "#8a2be2",
    };
  });

  if (restTokens > 0) {
    const restPct = totalDonorTokens > 0 ? Math.round((restTokens / totalDonorTokens) * 100) : 0;
    rows.push({
      label: `Demais doadores (${donors.length - limit}) • ${restPct}%`,
      value: Math.round(restTokens),
      color: "#8a2be2",
      secondaryColor: "#2563eb",
    });
  }

  return buildReportHorizontalChart({
    title: "👑 Usuários Doadores",
    subtitle: `${donors.length} doador(es)`,
    accentColor: "#00e5ff",
    rows,
  });
}

function buildAudienceFunnelCard() {
  const today = localDateKey();
  const aud = getAudienceBreakdown(state.users, today);
  const listed = Math.max(
    Number(state.listedUsersCount) || 0,
    Object.values(state.users || {}).filter((u) => u?.isListed).length
  );
  const withTokens = Math.max(
    Number(state.tokensUsersCount) || 0,
    Object.values(state.users || {}).filter((u) => (Number(u?.tokens) || 0) > 0).length
  );

  if (listed === 0 && withTokens === 0 && aud.returningUsers === 0) return "";

  return buildReportHorizontalChart({
    title: "🧲 Funil de Público (Hoje)",
    subtitle: `Retorno: ${aud.returningUsers}`,
    accentColor: "#c084fc",
    unit: "",
    rows: [
      { label: "Listados na Sala", value: listed, color: "#00e5ff", secondaryColor: "#2563eb", unit: "" },
      { label: "Usuários com Tokens", value: withTokens, color: "#ff7b00", secondaryColor: "#ff2a6d", unit: "" },
      { label: "Recorrentes Ativos", value: aud.returningUsers, color: "#c084fc", secondaryColor: "#8a2be2", unit: "" },
    ],
  });
}

export function downloadCSV() {
  triggerCsvDownload(
    csv(),
    "stripchat-monitor-" +
      (state.modelId || state.room || "sala") +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv"
  );
}

export function tableUsers() {
  const today = localDateKey();

  const aud = getAudienceBreakdown(state.users, today);
  const newEl = panel?.querySelector("#scm-new-users");
  const retEl = panel?.querySelector("#scm-returning-users");
  if (newEl) newEl.textContent = aud.newUsers;
  if (retEl) retEl.textContent = aud.returningUsers;

  return buildUsersTableHtml(state.users, usersFilterMode, today);
}

export function renderTodoList() {
  if (!panel) return;
  const container = panel.querySelector("#scm-todo-container");
  if (!container) return;

  const todos = Array.isArray(state.todos) ? state.todos : [];
  const todoView = buildTodoListView(todos);
  const { pendingCount, doneCount, pendingTokens } = todoView;
  const pendingCountBadge = panel.querySelector("#scm-todo-pending-count");
  const todoSectionHeader = panel.querySelector("#scm-todo-section-header");
  const todoSection = panel.querySelector("#scm-todo-section");
  const hasPendingTodos = pendingCount > 0;
  const sectionAccent = hasPendingTodos ? "#facc15" : "#4ade80";
  if (pendingCountBadge) {
    pendingCountBadge.textContent = `${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"}`;
    pendingCountBadge.style.background = hasPendingTodos
      ? "#facc15"
      : "rgba(52,211,153,0.18)";
    pendingCountBadge.style.color = hasPendingTodos
      ? "#171717"
      : "#86efac";
  }
  if (todoSection) {
    todoSection.style.borderColor = hasPendingTodos ? "#8a7025" : "#26734d";
    todoSection.style.borderLeftColor = sectionAccent;
    todoSection.style.background = hasPendingTodos
      ? "linear-gradient(135deg,rgba(250,204,21,0.15),rgba(24,26,54,0.96))"
      : "linear-gradient(135deg,rgba(52,211,153,0.22),rgba(24,26,54,0.96))";
    todoSection.style.boxShadow = hasPendingTodos
      ? "0 4px 14px rgba(250,204,21,0.12)"
      : "0 4px 14px rgba(52,211,153,0.12)";
  }
  if (todoSectionHeader) {
    todoSectionHeader.style.border = "0";
    todoSectionHeader.style.background = "transparent";
    todoSectionHeader.style.boxShadow = "none";
    const heading = todoSectionHeader.querySelector("#scm-todo-heading");
    if (heading) heading.style.color = sectionAccent;
  }

  const existingScroll = container.querySelector(".scroll");
  const savedHeight = existingScroll ? existingScroll.style.height : null;

  container.innerHTML = todoView.html;

  if (savedHeight) {
    const newScroll = container.querySelector(".scroll");
    if (newScroll) newScroll.style.height = savedHeight;
  }

  const copyBtn = container.querySelector("#scm-copy-todos-btn");
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      const pendingTodos = (state.todos || []).filter((t) => !t.done);

      if (pendingTodos.length === 0) {
        copyBtn.textContent = "Nenhuma pendente!";
        setTimeout(() => (copyBtn.textContent = "📋 Copiar Pendentes"), 1500);
        return;
      }

      const textToCopy = formatPendingTodos(pendingTodos);

      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.textContent = "Copiado! ✅";
        setTimeout(() => (copyBtn.textContent = "📋 Copiar Pendentes"), 1500);
      });
    };
  }

  container.querySelectorAll(".scm-todo-row").forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest(".scm-todo-del")) return;
      const rawId = row.getAttribute("data-id");
      const item = state.todos.find((i) => String(i.id) === String(rawId));
      if (item) {
        item.done = !item.done;
        render();
        saveToGlobalHistory();
      }
    };
  });

  container.querySelectorAll(".scm-todo-del").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rawId = btn.getAttribute("data-id");
      state.todos = state.todos.filter((i) => String(i.id) !== String(rawId));
      render();
      saveToGlobalHistory();
    };
  });
}

export function renderHistoryTable() {
  if (!panel) return;
  const tbody = panel.querySelector("#scm-history-table");
  if (!tbody) return;

  safeStorage.get(["scm_rooms_history"], (res) => {
    const hist = res?.scm_rooms_history || {};
    chrome.runtime.sendMessage({ type: "SCM_STORAGE_USAGE" }, (usageResponse) => {
      const modelSizes = usageResponse?.ok ? (usageResponse.modelBytes || {}) : {};
      tbody.innerHTML = buildHistoryTableHtml(hist, modelSizes);
      bindHistoryTableActions(tbody, hist);
    });
  });
}

function bindHistoryTableActions(tbody, hist) {
  if (Object.keys(hist).length === 0) return;

  tbody.querySelectorAll(".scm-view-report").forEach((btn) => {
    btn.onclick = (e) => {
      const targetKey = e.currentTarget.getAttribute("data-key");
      openDailyReportModal(targetKey);
    };
  });

  tbody.querySelectorAll(".scm-del-room").forEach((btn) => {
    btn.onclick = (e) => {
      const targetKey = e.currentTarget.getAttribute("data-key");
      deleteRoomHistory(targetKey);
    };
  });
}

function setBackupStatus(message, isError = false) {
  const status = panel?.querySelector("#scm-backup-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#fca5a5" : "#a7f3d0";
}

function refreshStorageUsage() {
  const usage = panel?.querySelector("#scm-storage-usage");
  if (!usage) return;
  usage.textContent = "Consultando uso do IndexedDB…";
  chrome.runtime.sendMessage({ type: "SCM_STORAGE_USAGE" }, (response) => {
    const error = chrome.runtime?.lastError;
    if (error) {
      usage.textContent = `Não foi possível consultar o armazenamento: ${error.message}`;
      return;
    }
    if (!response?.ok) {
      usage.textContent = `Não foi possível consultar o armazenamento: ${response?.error || "erro desconhecido"}`;
      return;
    }
    const usedBytes = Number(response.originUsageBytes ?? response.bytes) || 0;
    const quotaBytes = Number(response.quotaBytes) || 0;
    usage.textContent = quotaBytes > 0
      ? `Armazenamento usado: ${formatStorageBytes(usedBytes)} de ${formatStorageBytes(quotaBytes)} permitidos.`
      : `Dados locais gravados: ${formatStorageBytes(usedBytes)} (limite do navegador não informado).`;
    usage.style.color = "#8b92b8";
  });
}

function downloadDataBackup() {
  safeStorage.get(null, (storageData, result) => {
    if (result?.ok === false) {
      setBackupStatus(
        `Falha ao ler os dados para backup: ${result.error?.message || "erro desconhecido"}`,
        true,
      );
      return;
    }

    try {
      const version = chrome.runtime?.getManifest?.().version || "unknown";
      const exportScope = panel.querySelector("#scm-backup-export-scope").value;
      const modelSelect = panel.querySelector("#scm-backup-export-model");
      const models = getBackupModelOptions(storageData);
      populateBackupModelSelect(modelSelect, models);
      const model = models.find((option) => option.modelId === modelSelect.value);
      const scope = exportScope === "model"
        ? { type: "model", modelId: model?.modelId, modelName: model?.modelName }
        : { type: "all" };
      const backup = createBackupPayload(
        storageData,
        new Date().toISOString(),
        version,
        scope,
      );
      if (Object.keys(backup.data).length === 0) {
        setBackupStatus("Ainda não há dados locais do SC Monitor para exportar.", true);
        return;
      }
      const json = JSON.stringify(backup, null, 2);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      const scopeName = backup.scope.type === "model"
        ? `-${backup.scope.modelId.replace(/[^a-z0-9_-]/gi, "_")}`
        : "";
      link.download = `sc-monitor-backup${scopeName}-${localDateKey()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupStatus(
        `Backup ${backup.scope.type === "model" ? "da modelo" : "completo"} exportado: ` +
          `${Object.keys(backup.data).length} itens locais.`,
      );
    } catch (error) {
      setBackupStatus(`Falha ao criar o backup: ${error.message}`, true);
    }
  });
}

function populateBackupModelSelect(select, models) {
  const previousValue = select.value;
  select.replaceChildren();
  models.forEach(({ modelId, modelName }) => {
    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = modelName;
    select.appendChild(option);
  });
  if (models.some((model) => model.modelId === previousValue)) {
    select.value = previousValue;
  }
  select.disabled = models.length === 0;
  return models.length > 0;
}

function refreshBackupExportModels() {
  const scopeSelect = panel?.querySelector("#scm-backup-export-scope");
  const modelSelect = panel?.querySelector("#scm-backup-export-model");
  if (!scopeSelect || !modelSelect) return;
  safeStorage.get(null, (storageData, result) => {
    if (result?.ok === false) {
      setBackupStatus(
        `Falha ao consultar modelos para o backup: ${result.error?.message || "erro desconhecido"}`,
        true,
      );
      return;
    }
    const hasModels = populateBackupModelSelect(modelSelect, getBackupModelOptions(storageData));
    modelSelect.hidden = scopeSelect.value !== "model";
    if (!hasModels && scopeSelect.value === "model") {
      setBackupStatus("Não há modelos com dados salvos para exportar.", true);
    }
  });
}

function cancelBackupImport() {
  pendingBackupImport = null;
  const options = panel?.querySelector("#scm-backup-import-options");
  const preview = panel?.querySelector("#scm-backup-preview");
  if (options) options.hidden = true;
  if (preview) preview.hidden = true;
}

async function inspectBackupFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (file.size > MAX_BACKUP_FILE_BYTES) {
    setBackupStatus("O arquivo excede o limite de 25 MiB.", true);
    return;
  }

  try {
    pendingBackupImport = parseBackupText(await file.text());
    const backupScope = getBackupScope(pendingBackupImport);
    const models = getBackupModelOptions(pendingBackupImport.data);
    const importScope = panel.querySelector("#scm-backup-import-scope");
    const modelSelect = panel.querySelector("#scm-backup-import-model");
    const options = panel.querySelector("#scm-backup-import-options");
    const preview = panel.querySelector("#scm-backup-preview");
    const allOption = importScope.querySelector('option[value="all"]');
    allOption.disabled = backupScope.type !== "all";
    importScope.value = backupScope.type === "all" ? "all" : "model";
    const hasModels = populateBackupModelSelect(modelSelect, models);
    modelSelect.hidden = importScope.value !== "model";
    importScope.disabled = backupScope.type !== "all";
    options.hidden = false;
    preview.hidden = false;
    preview.textContent = backupScope.type === "model"
      ? `Backup limitado à modelo ${backupScope.modelName || backupScope.modelId}.`
      : `Backup completo: ${Object.keys(pendingBackupImport.data).length} itens e ${models.length} modelos.`;
    if (!hasModels && backupScope.type === "model") {
      throw new Error("O backup não contém dados de modelo válidos.");
    }
    setBackupStatus("Revise o escopo e confirme a restauração.");
  } catch (error) {
    cancelBackupImport();
    setBackupStatus(`Não foi possível ler o backup: ${error.message}`, true);
  }
}

function sendRestoreRequest(data, backupScope, restoreScope) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SCM_RESTORE_BACKUP", data, backupScope, restoreScope },
      (response) => {
        const error = chrome.runtime?.lastError;
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

async function applyDataBackup() {
  if (!pendingBackupImport) return;

  const backup = pendingBackupImport;
  const backupScope = getBackupScope(backup);
  const importScopeSelect = panel.querySelector("#scm-backup-import-scope");
  const modelSelect = panel.querySelector("#scm-backup-import-model");
  const restoreScope = importScopeSelect.value === "model"
    ? {
        type: "model",
        modelId: modelSelect.value,
        modelName: modelSelect.selectedOptions[0]?.textContent || modelSelect.value,
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

  const itemCount = Object.keys(backup.data).length;
  const confirmMessage = restoreScope.type === "all"
    ? `O arquivo contém ${itemCount} itens. A importação substituirá todos os dados locais do SC Monitor. Exporte um backup atual antes de continuar. Deseja prosseguir?`
    : `A importação substituirá somente os dados de ${restoreScope.modelName}, preservando os demais modelos. Deseja prosseguir?`;
  if (!confirm(confirmMessage)) {
    setBackupStatus("Importação cancelada.");
    return;
  }

  const applyButton = panel.querySelector("#scm-apply-backup");
  applyButton.disabled = true;
  try {
    await waitForHistorySaves();
    setBackupStatus("Verificando monitoramento e restaurando dados…");
    const result = await sendRestoreRequest(backup.data, backupScope, restoreScope);
    cancelBackupImport();
    reportController.refreshSelectors();
    refreshStorageUsage();
    setBackupStatus(
      `Backup restaurado com sucesso (${result.itemCount} itens locais).`,
    );
  } catch (error) {
    const prefix = error.dataApplied
      ? "Dados gravados, mas nem todas as abas foram atualizadas"
      : "Não foi possível restaurar o backup";
    setBackupStatus(`${prefix}: ${error.message}`, true);
  } finally {
    applyButton.disabled = false;
  }
}

function updateBackupImportControls() {
  const scope = panel?.querySelector("#scm-backup-import-scope");
  const model = panel?.querySelector("#scm-backup-import-model");
  if (scope && model) model.hidden = scope.value !== "model";
}

function configureBackupControls() {
  const exportScope = panel.querySelector("#scm-backup-export-scope");
  const exportModel = panel.querySelector("#scm-backup-export-model");
  exportScope.addEventListener("change", () => {
    exportModel.hidden = exportScope.value !== "model";
    if (exportScope.value === "model") refreshBackupExportModels();
  });
  panel.querySelector("#scm-backup-import-scope").addEventListener(
    "change",
    updateBackupImportControls,
  );
  panel.querySelector("#scm-apply-backup").addEventListener("click", applyDataBackup);
  panel.querySelector("#scm-cancel-backup").addEventListener("click", () => {
    cancelBackupImport();
    setBackupStatus("Importação cancelada.");
  });
  panel.querySelector("#scm-backup-file").addEventListener("change", inspectBackupFile);
  refreshBackupExportModels();
}

export function deleteRoomHistory(entryKey) {
  if (!confirm("Deseja apagar os dados salvos deste dia/modelo?")) return;
  safeStorage.get(["scm_rooms_history"], (res) => {
    const hist = res?.scm_rooms_history || {};
    const entry = hist[entryKey];
    delete hist[entryKey];

    const detailBox = panel?.querySelector("#scm-report-detail-box");
    if (detailBox) detailBox.remove();

    safeStorage.set({ scm_rooms_history: hist }, () => {
      const keysToRemove = [];
      if (entry?.modelId && entry?.dateKey) {
        keysToRemove.push(`scm:model:${entry.modelId}:daily:${entry.dateKey}`);
      } else if (entryKey && !entryKey.includes("::")) {
        keysToRemove.push(`scm:model:${entryKey}`);
      }

      if (keysToRemove.length > 0) {
        safeStorage.remove(keysToRemove, () => renderHistoryTable());
      } else {
        renderHistoryTable();
      }
    });
  });
}

export function renderMutedUsers() {
  if (!panel) return;
  const tbody = panel.querySelector("#scm-muted-users-table");
  if (!tbody) return;

  const mutedList = state.mutedUsersDetails || [];
  tbody.innerHTML = buildMutedUserRows(mutedList);
  if (mutedList.length === 0) return;

  tbody.querySelectorAll(".scm-muted-del").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-index"));
      mutedList.splice(idx, 1);
      state.mutedUsersDetails = mutedList;
      renderMutedUsers();
      saveToGlobalHistory();
    };
  });
}

export function renderModerationLogs() {
  if (!panel) return;
  const tbody = panel.querySelector("#scm-moderation-table");
  if (!tbody) return;

  const logs = state.moderationLogs || [];
  tbody.innerHTML = buildModerationLogRows(logs);
  if (logs.length === 0) return;

  tbody.querySelectorAll(".scm-modlog-del").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-index"));
      logs.splice(idx, 1);
      state.moderationLogs = logs;
      renderModerationLogs();
      saveToGlobalHistory();
    };
  });
}

export function renderStatsSummary(sessionTokensVal) {
  if (!panel) return;
  let container = panel.querySelector("#scm-stats-summary-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "scm-stats-summary-container";
    container.className = "scm-cyber-card";
    container.style.cssText = "margin-top:12px; margin-bottom:14px;";

    const targetArea = panel.querySelector("#scm-tab-general");
    if (targetArea) targetArea.appendChild(container);
  }

  const currentLivePeak = Math.max(
    Number(state._sessionPeakViewers) || 0,
    Number(state.peakViewers) || 0,
    Number(state.currentViewers) || 0
  );
  const totalTokensVal = Number(state.totalTokens) || 0;
  const sessionStartVal = Number(state._sessionTokensStart) || 0;
  const fallbackSessionTokens = Math.max(0, totalTokensVal - sessionStartVal);
  const liveTokens = Math.max(
    0,
    Number(sessionTokensVal !== undefined && sessionTokensVal !== null ? sessionTokensVal : fallbackSessionTokens) || 0
  );
  const avgViewersVal = Math.round(state.avgViewers || 0);
  const viewerSampleCount = Number(state.generalStatsSummary?.samplesCount) || 0;
  const lastViewerSample = Number(state.lastViewerSampleAt) > 0
    ? new Date(state.lastViewerSampleAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

  const uPeak = state.userStatsSummary?.peak || {};
  const uAvg = state.userStatsSummary?.avg || {};

  const lPeak = state.leagueStatsSummary?.peak || {};
  const lAvg = state.leagueStatsSummary?.avg || {};

  const audNow = getAudienceBreakdown(state.users, localDateKey());
  const totalAud = audNow.newUsers + audNow.returningUsers;
  const retPct = totalAud > 0 ? Math.round((audNow.returningUsers / totalAud) * 100) : 0;

  const bruteSecs = Math.max(0, Number(state.timerState?.bruteSeconds) || 0);
  const netSecs = Math.min(bruteSecs, Math.max(0, Number(state.timerState?.netSeconds) || 0));
  const effPct = bruteSecs > 0 ? Math.round((netSecs / bruteSecs) * 100) : 0;
  const isMonitoring = getMonitoring();
  container.style.background = isMonitoring
    ? "linear-gradient(145deg,#1b302f,#172522)"
    : "#181a36";
  container.style.border = isMonitoring ? "1px solid #285b4a" : "1px solid #272952";

  const paceSecs = getActivePaceSeconds();
  const tokensPerHourDisplay = formatPaceDisplay(liveTokens, paceSecs, 120);
  const todayBucket = state.dailyBuckets?.[localDateKey()] || {};
  const currentLiveSession = todayBucket.liveSessions?.[state.sessionId];
  const sessionFlowCacheKey =
    `${state.sessionId || ""}:${currentLiveSession?.minuteBucketsByMinute ? 1 : 0}:${sessionUserFlowStepMin}`;
  if (
    sessionUserFlowChartCache.sessionId !== sessionFlowCacheKey ||
    Date.now() - sessionUserFlowChartCache.updatedAt >= 120000
  ) {
    const sessionMinuteRows = normalizeMinuteBuckets(currentLiveSession?.minuteBucketsByMinute);
    const autoStepMin = getAdaptiveTimeStep(sessionMinuteRows);
    const sessionStepMin = sessionUserFlowStepMin === "auto"
      ? autoStepMin
      : Number(sessionUserFlowStepMin) || autoStepMin;
    const userFlowBars = buildTimeBucketBars(sessionMinuteRows, sessionStepMin)
      .filter((bar) => bar.listedUsersSamples > 0);
    sessionUserFlowChartCache = {
      sessionId: sessionFlowCacheKey,
      updatedAt: Date.now(),
      html: buildNeonWaveAreaChart({
        title: "👥 Fluxo de Usuários (pessoas listadas)",
        subtitle: `${sessionUserFlowStepMin === "auto" ? "Auto • " : ""}média em blocos de ${sessionStepMin === 60 ? "1h" : `${sessionStepMin} min`}`,
        points: userFlowBars.map((bar) => ({
          label: bar.label,
          value: bar.avgListedUsers,
          tooltip: `${bar.label}: ${bar.avgListedUsers} pessoas listadas (média)`,
        })),
        strokeColor: "#00e5ff",
        fillStart: "#00e5ff",
        fillEnd: "#2563eb",
      }),
    };
  }
  const bestActivityBlock = Object.values(currentLiveSession?.minuteBuckets || {})
    .reduce((best, block) => (
      !best || (Number(block?.tokens) || 0) > (Number(best.tokens) || 0) ? block : best
    ), null);
  const donorsList = Object.values(state.users || {}).filter((u) => u && (Number(u.tokens) || 0) > 0);
  const donorTokens = donorsList.reduce((acc, u) => acc + (Number(u.tokens) || 0), 0);
  const donorTips = donorsList.reduce((acc, u) => acc + (Number(u.tips) || 0), 0);
  const avgPerDonor = donorsList.length > 0 ? Math.round(donorTokens / donorsList.length) : 0;
  const avgPerTip = donorTips > 0 ? Math.round(donorTokens / donorTips) : 0;

  container.innerHTML = `
    <div style="font-weight: 600; color: #00e5ff; margin-bottom: 10px; border-bottom: 1px solid #272952; padding-bottom: 6px; display: flex; justify-content: space-between; font-size: 12px;">
      <span>⚡ Painel Analítico (Sessão Ativa)</span>
      <span style="font-size: 10px; color: ${isMonitoring ? "#34d399" : "#94a3b8"}; background: ${isMonitoring ? "rgba(52,211,153,0.15)" : "rgba(148,163,184,0.12)"}; padding: 2px 8px; border-radius: 99px; font-weight: bold;">${isMonitoring ? "MONITORANDO" : "PAUSADO"}</span>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
      ${buildNeonDonutGauge({
        label: "Retenção Hoje",
        sublabel: `${audNow.newUsers} novos • ${audNow.returningUsers} recorrentes`,
        percent: retPct,
        colorStart: "#ff2a6d",
        colorEnd: "#8a2be2",
      })}
      ${buildNeonDonutGauge({
        label: "Atividade efetiva",
        sublabel: `${formatSecondsToTime(netSecs)} líquido / ${formatSecondsToTime(bruteSecs)} bruto`,
        percent: effPct,
        colorStart: "#00e5ff",
        colorEnd: "#2563eb",
      })}
    </div>

    <div style="margin-bottom: 10px; border-bottom: 1px dashed #272952; padding-bottom: 8px; line-height: 1.6; font-size: 11px;">
      <strong style="color: #00e5ff;">📈 Resumo da Live:</strong><br>
      <strong>🎖️ Pico Espectadores:</strong> ${currentLivePeak}  |  <strong>🧑🏻‍💻 Média:</strong> ${avgViewersVal}<br>
      <span style="font-size:10px; color:#8b92b8;">Amostras com monitoramento ativo: ${viewerSampleCount} • Última leitura: ${clean(lastViewerSample)}</span><br>
      <strong>✨ Tokens na Sessão:</strong> <span style="color: #00e5ff; font-weight: bold;">${liveTokens.toLocaleString("pt-BR")} tk</span>  |  <strong>⚡ Ritmo:</strong> <span style="color: #ff7b00; font-weight: bold;">${clean(tokensPerHourDisplay)}</span><br>
      ${bestActivityBlock && (Number(bestActivityBlock.tokens) || 0) > 0
        ? `<strong>🔥 Melhor intervalo (5 min):</strong> ${clean(bestActivityBlock.minute)} • ${Math.round(Number(bestActivityBlock.tokens) || 0).toLocaleString("pt-BR")} tk<br>`
        : ""}
      <strong>🎟️ Ticket Médio:</strong> ${avgPerDonor} tk/doador  |  ${avgPerTip} tk/gorjeta
    </div>

    ${buildTimeStepSelectorHtml({
      className: "scm-session-user-flow-step",
      selectedStep: sessionUserFlowStepMin,
      autoStep: getAdaptiveTimeStep(normalizeMinuteBuckets(currentLiveSession?.minuteBucketsByMinute)),
      label: "Bloco do fluxo de usuários:",
    })}
    ${sessionUserFlowChartCache.html}
    ${buildAudienceFunnelCard()}
    ${buildGainTypeChart()}
    ${buildTopDonorsChart()}

    <div style="margin-bottom: 10px; border-bottom: 1px dashed #272952; padding-bottom: 8px; line-height: 1.6; font-size: 11px;">
      <strong style="color: #c084fc;">👥 Usuários (Pico / Média):</strong><br>
      Listados: ${uPeak.listedUsersCount || 0}/${Math.round(uAvg.listedUsersCount || 0)} | Com Tokens: ${uPeak.tokensUsersCount || 0}/${Math.round(uAvg.tokensUsersCount || 0)} | Ultimate: ${uPeak.ultimateUsersCount || 0}/${Math.round(uAvg.ultimateUsersCount || 0)} | Invisíveis: ${uPeak.invisibleUsersCount || 0}/${Math.round(uAvg.invisibleUsersCount || 0)}
    </div>

    <div style="line-height: 1.6; font-size: 11px;">
      <strong style="color: #ff7b00;">🏆 Ligas (Pico / Média):</strong><br>
      🔘${lPeak.grey || 0}/${Math.round(lAvg.grey || 0)}   🟠${lPeak.bronze || 0}/${Math.round(lAvg.bronze || 0)}   🔵${lPeak.silver || 0}/${Math.round(lAvg.silver || 0)}   🟡${lPeak.gold || 0}/${Math.round(lAvg.gold || 0)}   🟣${lPeak.diamond || 0}/${Math.round(lAvg.diamond || 0)}   🔴${lPeak.royal || 0}/${Math.round(lAvg.royal || 0)}   ⭐${lPeak.legend || 0}/${Math.round(lAvg.legend || 0)}
    </div>
  `;

  container.querySelectorAll(".scm-session-user-flow-step").forEach((button) => {
    button.onclick = () => {
      const step = button.getAttribute("data-step") || "auto";
      sessionUserFlowStepMin = step === "auto" ? "auto" : Number(step) || "auto";
      sessionUserFlowChartCache.updatedAt = 0;
      renderStatsSummary();
    };
  });
}

function formatSecondsToTime(totalSeconds) {
  const safeSecs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSecs / 3600);
  const minutes = Math.floor((safeSecs % 3600) / 60);
  const seconds = safeSecs % 60;
  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");
}

function formatIsoDateToBr(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
  }
  const [year, month, day] = String(dateKey).split("-");
  return `${day}/${month}/${year}`;
}

export function renderDailyStats() {
  if (!panel) return;
  let container = panel.querySelector("#scm-daily-stats-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "scm-daily-stats-container";
    container.className = "scm-cyber-card";
    container.style.cssText = "margin-top:12px; margin-bottom:14px; background:linear-gradient(145deg,#211f3d,#191a33); border:1px solid #3b315b;";

    const targetArea = panel.querySelector("#scm-tab-general");
    if (targetArea) targetArea.appendChild(container);
  }

  const modelKey = state.modelId || state.room;
  if (!modelKey) return;

  const todayDate = localDateKey();
  const formattedToday = formatIsoDateToBr(todayDate);
  const dailyStorageKey = `scm:model:${modelKey}:daily:${todayDate}`;
  const renderSequence = ++dailyStatsRenderSequence;

  safeStorage.get([dailyStorageKey], (res) => {
    if (renderSequence !== dailyStatsRenderSequence) return;

    const rawStored = res?.[dailyStorageKey];
    const storedMatchesToday = rawStored && rawStored.date === todayDate;
    const bucketMatchesToday = state.dailyBuckets?.[todayDate]?.date === todayDate;
    const currentBucket = bucketMatchesToday ? state.dailyBuckets[todayDate] : null;
    const daily = storedMatchesToday
      ? rawStored
      : currentBucket
        ? currentBucket
        : {};

    const tokensToShow =
      Number(daily.totalTokensDay) > 0
        ? Number(daily.totalTokensDay)
        : Number(daily.dailyTokens) || 0;
    const peakToShow = Math.max(
      Number(daily.peakViewersDay) || 0,
      Number(daily.peakViewers) || 0,
      Number(state.peakViewers) || 0
    );
    const avgViewersDay =
      (Number(daily.viewerSamplesCount) || 0) > 0
        ? Math.round((Number(daily.viewerSum) || 0) / Number(daily.viewerSamplesCount))
        : 0;

    const uPeak = daily.userPeak || {};
    const uSamples = Number(daily.userSamplesCount) || 0;
    const uSum = daily.userSum || {};
    const getAvgUser = (key) =>
      uSamples > 0 ? Math.round((Number(uSum[key]) || 0) / uSamples) : 0;

    const lPeak = daily.leaguePeak || {};
    const lSamples = Number(daily.leagueSamplesCount) || 0;
    const lSum = daily.leagueSum || {};
    const getAvgLeague = (key) =>
      lSamples > 0 ? Math.round((Number(lSum[key]) || 0) / lSamples) : 0;

    const audDay = hasAudienceStats(daily?.audienceStats)
      ? daily.audienceStats
      : getAudienceBreakdown(state.users, todayDate);
    const totalAud = audDay.newUsers + audDay.returningUsers;
    const retRate = totalAud > 0 ? Math.round((audDay.returningUsers / totalAud) * 100) : 0;

    const minuteRows = buildDailyFlowMinuteRows(daily, currentBucket, state.totalTokens);
    const flowStepSelection = dailyFlowStepMin;
    const hasHourlyFallback =
      Array.isArray(daily.hourlyTokens) && daily.hourlyTokens.length === 24;
    const autoFlowStepMin = minuteRows.length
      ? getAdaptiveTimeStep(minuteRows)
      : hasHourlyFallback
        ? 60
        : 1;
    const flowStepMin = flowStepSelection === "auto"
      ? autoFlowStepMin
      : Number(flowStepSelection) || 10;
    const flowBars = buildDayTimeBars(daily, minuteRows, flowStepMin);
    const waveHtml = flowBars.length > 0
      ? buildNeonWaveAreaChart({
          title: `🌊 Fluxo de Tokens (Blocos de ${flowStepMin === 60 ? "1h" : `${flowStepMin} min`})`,
          subtitle: formattedToday,
          points: flowBars,
        })
      : "";

    const userAverages = Object.fromEntries(
      ["listedUsersCount", "tokensUsersCount", "ultimateUsersCount", "invisibleUsersCount"]
        .map((key) => [key, getAvgUser(key)]),
    );
    const leagueAverages = Object.fromEntries(
      ["grey", "bronze", "silver", "gold", "diamond", "royal", "legend"]
        .map((key) => [key, getAvgLeague(key)]),
    );
    container.innerHTML = buildDailyStatsHtml({
      formattedToday,
      flowStepMin,
      flowStepSelection,
      waveHtml,
      peakViewers: peakToShow,
      avgViewers: avgViewersDay,
      tokens: tokensToShow,
      userPeak: uPeak,
      userAverages,
      audience: audDay,
      returnRate: retRate,
      leaguePeak: lPeak,
      leagueAverages,
    });

    container.querySelectorAll(".scm-daily-flow-step").forEach((button) => {
      button.onclick = () => {
        const step = button.getAttribute("data-step") || "auto";
        dailyFlowStepMin = step === "auto" ? "auto" : Number(step) || 10;
        renderDailyStats();
      };
    });
  });
}

function generateExecutiveText(rep) {
  const lines = [
    `📊 *RELATÓRIO DIÁRIO - ${rep.modelName.toUpperCase()}*`,
    `📅 Data: ${rep.dateBr}`,
    ``,
    `💰 *Tokens (gorjetas + shows estimados):* ${rep.totalTokens} tk`,
    `⏱️ *Tempo Bruto:* ${formatSecondsToTime(rep.bruteSeconds)}`,
    `🟢 *Tempo Líquido:* ${formatSecondsToTime(rep.netSeconds)}`,
    `🎖️ *Pico Espectadores:* ${rep.peakViewers}`,
    `🧑🏻‍💻 *Média Espectadores:* ${rep.avgViewers}`,
  ];

  if (rep.liveSessions.length > 0) {
    lines.push(``, `🎬 *Sessões de Live (${rep.liveSessions.length}):*`);
    rep.liveSessions.forEach((s, i) => {
      const dur = formatSecondsToTime(Number(s.durationSeconds) || 0);
      lines.push(
        `  ${i + 1}. ${s.startedAt || "--:--"} → ${s.endedAt || "ativa"} (${dur}) | ${Math.round(Number(s.tokens) || 0)} tk | Pico: ${Number(s.peakViewers) || 0}`
      );
    });
  }

  if (rep.suspectBots.length > 0) {
    lines.push(``, `🛡️ *Espectadores Suspeitos (${rep.suspectBots.length}):*`);
    rep.suspectBots.forEach((bot) => {
      lines.push(
        `  ${bot.username}: ${bot.suspicionLevel || "Suspeito"} | ${Number(bot.timeInRoomMinutes) || 0} min | ${Number(bot.messages) || 0} msgs | ${Number(bot.tokens) || 0} tk`
      );
    });
  }

  lines.push(
    ``,
    `👥 *Usuários (Pico / Média):*`,
    `  Listados: ${rep.uPeak.listedUsersCount || 0} / ${rep.uAvg("listedUsersCount")} | Com Tokens: ${rep.uPeak.tokensUsersCount || 0} / ${rep.uAvg("tokensUsersCount")} | Ultimate: ${rep.uPeak.ultimateUsersCount || 0} / ${rep.uAvg("ultimateUsersCount")} | Invisíveis: ${rep.uPeak.invisibleUsersCount || 0} / ${rep.uAvg("invisibleUsersCount")}`,
    ``,
    `🏆 *Ligas (Pico / Média):*`,
    `  Cinza: ${rep.lPeak.grey || 0}/${rep.lAvg("grey")} | Bronze: ${rep.lPeak.bronze || 0}/${rep.lAvg("bronze")} | Prata: ${rep.lPeak.silver || 0}/${rep.lAvg("silver")} | Ouro: ${rep.lPeak.gold || 0}/${rep.lAvg("gold")} | Diamante: ${rep.lPeak.diamond || 0}/${rep.lAvg("diamond")} | Real: ${rep.lPeak.royal || 0}/${rep.lAvg("royal")} | Lendária: ${rep.lPeak.legend || 0}/${rep.lAvg("legend")}`
  );

  return lines.join("\n");
}

function downloadDailyReportCSV(rep) {
  const csvContent = buildDailyReportCsv(rep, formatSecondsToTime);
  triggerCsvDownload(csvContent, `relatorio-${rep.modelId || "modelo"}-${rep.dateKey || "dia"}.csv`);
}

export function openDailyReportModal(entryKey) {
  if (!panel) return;
  const tabHistory = panel.querySelector("#scm-tab-history");
  if (!tabHistory) return;

  let detailBox = tabHistory.querySelector("#scm-report-detail-box");
  if (!detailBox) {
    detailBox = document.createElement("div");
    detailBox.id = "scm-report-detail-box";
    detailBox.className = "scm-cyber-card";
    detailBox.style.cssText = "margin-top: 14px; border: 1px solid #00e5ff;";
    tabHistory.appendChild(detailBox);
  }

  detailBox.innerHTML = `<div style="color:#00e5ff; text-align:center; padding:15px;">Carregando relatório detalhado...</div>`;

  safeStorage.get(["scm_rooms_history"], (res) => {
    const hist = res?.scm_rooms_history || {};
    const room = hist[entryKey];
    if (!room) {
      detailBox.innerHTML = `<div style="color:#ff2a6d;">Registro não encontrado.</div>`;
      return;
    }

    const dailyKey =
      room.modelId && room.dateKey
        ? `scm:model:${room.modelId}:daily:${room.dateKey}`
        : null;

    const renderWithDaily = (dailyObj) => {
      const rep = buildReportData(room, dailyObj || {});

      const sessionsHtml =
        rep.liveSessions.length > 0
          ? rep.liveSessions
              .map(
                (s, i) => `
              <tr>
                <td>#${i + 1}</td>
                <td>${clean(s.startedAt || "--:--")} → ${clean(s.endedAt || "ativa")}</td>
                <td>${formatSecondsToTime(Number(s.durationSeconds) || 0)}</td>
                <td style="color:#00e5ff; font-weight:bold;">${Math.round(Number(s.tokens) || 0)} tk</td>
                <td>${Number(s.peakViewers) || 0}</td>
              </tr>`
              )
              .join("")
          : `<tr><td colspan="5" style="text-align:center; color:#8b92b8;">Nenhuma sessão segmentada registrada.</td></tr>`;

      const minuteHtml =
        rep.minuteRows.length > 0
          ? rep.minuteRows
              .map(
                (m) => `
              <tr>
                <td>${clean(m.minute)}</td>
                <td style="color:#00e5ff; font-weight:bold;">${m.tokens} tk</td>
                <td>${m.avgViewers}</td>
                <td>${m.netSeconds}s</td>
              </tr>`
              )
              .join("")
          : `<tr><td colspan="4" style="text-align:center; color:#8b92b8;">Sem dados minuto a minuto para este dia.</td></tr>`;

      detailBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #272952; padding-bottom:8px; margin-bottom:10px;">
          <div>
            <div style="font-weight:bold; color:#00e5ff; font-size:13px;">📑 Relatório: ${clean(rep.modelName)}</div>
            <div style="font-size:10px; color:#8b92b8;">Data: ${clean(rep.dateBr)}</div>
          </div>
          <button id="scm-close-report-box" type="button" style="background:#23264d; border:0; color:#fff; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">Fechar ✕</button>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button id="scm-copy-report-txt" type="button" style="flex:1; background:linear-gradient(90deg, #00e5ff, #2563eb); border:0; color:#0f1024; padding:7px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">📋 Copiar Resumo</button>
          <button id="scm-export-report-csv" type="button" style="flex:1; background:linear-gradient(90deg, #ff2a6d, #ff7b00); border:0; color:#fff; padding:7px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">📥 CSV do Dia</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:12px;">
          <div style="background:#23264d; padding:8px 10px; border-radius:8px;"><small style="color:#8b92b8;">Tokens (gorjetas + shows estimados)</small><div style="font-weight:bold; color:#00e5ff; font-size:14px;">${rep.totalTokens} tk</div></div>
          <div style="background:#23264d; padding:8px 10px; border-radius:8px;"><small style="color:#8b92b8;">Pico / Média</small><div style="font-weight:bold; color:#ff2a6d; font-size:14px;">${rep.peakViewers} / ${rep.avgViewers}</div></div>
          <div style="background:#23264d; padding:8px 10px; border-radius:8px;"><small style="color:#8b92b8;">Tempo Bruto</small><div style="font-weight:bold; color:#f8fafc;">${formatSecondsToTime(rep.bruteSeconds)}</div></div>
          <div style="background:#23264d; padding:8px 10px; border-radius:8px;"><small style="color:#8b92b8;">Tempo Líquido</small><div style="font-weight:bold; color:#c084fc;">${formatSecondsToTime(rep.netSeconds)}</div></div>
        </div>

        <div style="font-weight:bold; color:#ff7b00; margin:10px 0 6px;">🎬 Sessões de Live (${rep.liveSessions.length})</div>
        <div class="scroll" style="height:120px; min-height:70px;">
          <table>
            <thead><tr><th>#</th><th>Horário</th><th>Duração</th><th>Tokens</th><th>Pico</th></tr></thead>
            <tbody>${sessionsHtml}</tbody>
          </table>
        </div>

        <div style="font-weight:bold; color:#00e5ff; margin:12px 0 6px;">⏱️ Evolução Minuto a Minuto (${rep.minuteRows.length} min)</div>
        <div class="scroll" style="height:140px; min-height:70px;">
          <table>
            <thead><tr><th>Minuto</th><th>Tokens</th><th>Média Viewers</th><th>Ativo</th></tr></thead>
            <tbody>${minuteHtml}</tbody>
          </table>
        </div>
      `;

      detailBox.querySelector("#scm-close-report-box").onclick = () => detailBox.remove();

      const copyBtn = detailBox.querySelector("#scm-copy-report-txt");
      copyBtn.onclick = () => {
        const text = generateExecutiveText(rep);
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "Copiado! ✅";
          setTimeout(() => (copyBtn.textContent = "📋 Copiar Resumo"), 1500);
        });
      };

      detailBox.querySelector("#scm-export-report-csv").onclick = () => {
        downloadDailyReportCSV(rep);
      };
    };

    if (dailyKey) {
      safeStorage.get([dailyKey], (dRes) => renderWithDaily(dRes?.[dailyKey]));
    } else {
      renderWithDaily({});
    }
  });
}

function renderUsersAudienceChart() {
  if (!panel) return;
  const chart = panel.querySelector("#scm-users-audience-chart");
  if (!chart) return;

  const daily = state.dailyBuckets?.[localDateKey()] || {};
  const liveSession = daily.liveSessions?.[state.sessionId];
  const minuteRows = normalizeMinuteBuckets(liveSession?.minuteBucketsByMinute);
  const autoStepMin = getAdaptiveTimeStep(minuteRows);
  const stepMin = usersAudienceStepMin === "auto"
    ? autoStepMin
    : Number(usersAudienceStepMin) || 60;
  const audiencePoints = buildAudienceChartPoints(minuteRows, stepMin)
    .filter((point) => point.viewerSamples > 0);
  const sessionPeak = Math.max(
    Number(liveSession?.peakViewers) || 0,
    Number(state._sessionPeakViewers) || 0,
    Number(state.currentViewers) || 0,
  );
  const stepLabel = stepMin === 60 ? "1h" : `${stepMin} min`;
  const intervalLabel = `${usersAudienceStepMin === "auto" ? "Auto • " : ""}Média por bloco de ${stepLabel} • sessão atual`;

  chart.innerHTML = buildAudienceLeagueChart(audiencePoints, sessionPeak, intervalLabel);
  panel.querySelectorAll(".scm-users-audience-step").forEach((button) => {
    const value = button.getAttribute("data-step") || "auto";
    const isActive = String(usersAudienceStepMin) === value;
    if (value === "auto") button.textContent = `Auto (${autoStepMin}m)`;
    button.style.background = isActive
      ? "linear-gradient(90deg, #00e5ff, #2563eb)"
      : "#23264d";
    button.style.color = isActive ? "#0f1024" : "#8b92b8";
    button.setAttribute("aria-pressed", String(isActive));
  });
}

export function render() {
  updatePanelFooterDate();
  if (!panel || panel.style.display !== "flex") return;

  const setElementText = (selector, value) => {
    const el = panel.querySelector(selector);
    if (el) el.textContent = value ?? "—";
  };

  if (state.timerState) {
    setElementText("#scm-time-brute-day", formatSecondsToTime(state.timerState.bruteDaySeconds || 0));
    setElementText("#scm-time-net-day", formatSecondsToTime(state.timerState.netDaySeconds || 0));
  }

  const todayKey = localDateKey();
  setElementText("#scm-header-date", `📅 ${formatIsoDateToBr(todayKey)}`);

  const totalTokensVal = Number(state.totalTokens) || 0;
  const dailyTokensVal = getDailyTokensTotal();
  const sessionStartVal = Number(state._sessionTokensStart) || 0;
  const sessionTokensVal = Math.max(0, totalTokensVal - sessionStartVal);

  setElementText("#scm-tokens", Math.round(dailyTokensVal) + " tk");
  refreshTodayTokensDisplay();
  setElementText("#scm-session-tokens", Math.round(sessionTokensVal) + " tk");

  setElementText("#scm-viewers", state.currentViewers);
  setElementText("#scm-peak", state.peakViewers || 0);
  setElementText("#scm-avg", state.avgViewers || 0);
  setElementText("#scm-users", state.listedUsersCount || 0);
  setElementText("#scm-others", state.otherUsersCount || 0);
  setElementText("#scm-tokens-users", state.tokensUsersCount || 0);
  setElementText("#scm-ultimate-users", state.ultimateUsersCount || 0);
  setElementText("#scm-invisible-users", state.invisibleUsersCount || 0);
  setElementText("#scm-more-users", state.moreUsersCount || 0);

  const leagues = state.leagueCounts || {};
  setElementText("#scm-league-grey", leagues.grey || 0);
  setElementText("#scm-league-bronze", leagues.bronze || 0);
  setElementText("#scm-league-silver", leagues.silver || 0);
  setElementText("#scm-league-gold", leagues.gold || 0);
  setElementText("#scm-league-diamond", leagues.diamond || 0);
  setElementText("#scm-league-royal", leagues.royal || 0);
  setElementText("#scm-league-legend", leagues.legend || 0);

  renderUsersAudienceChart();

  renderModerationTags();
  renderMutedUsers();
  renderModerationLogs();
  renderStatsSummary(sessionTokensVal);
  renderDailyStats();
  renderSuspectBots();
  eventsController.renderEventSummary();
  eventsController.renderTopTokenUsers();

  const inSoldado = panel.querySelector("#scm-price-soldado");
  if (inSoldado && document.activeElement !== inSoldado) inSoldado.value = state.fanClubPrices?.soldado || 0;

  const inLorde = panel.querySelector("#scm-price-lorde");
  if (inLorde && document.activeElement !== inLorde) inLorde.value = state.fanClubPrices?.lord || 0;

  const inPrincipe = panel.querySelector("#scm-price-principe");
  if (inPrincipe && document.activeElement !== inPrincipe) inPrincipe.value = state.fanClubPrices?.principe || 0;

  const inPrivate = panel.querySelector("#scm-price-private");
  if (inPrivate && document.activeElement !== inPrivate) inPrivate.value = state.showPrices?.privateTkMin || 0;

  const inVip = panel.querySelector("#scm-price-vip");
  if (inVip && document.activeElement !== inVip) inVip.value = state.showPrices?.vipTkMin || 0;

  const statusBadge = panel.querySelector("#scm-status-badge");
  if (statusBadge) {
    if (getMonitoring()) {
      statusBadge.innerHTML = `<span style="background: linear-gradient(90deg, #00e5ff, #2563eb); color: #0f1024; padding: 4px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 800; box-shadow: 0 0 10px rgba(0,229,255,0.4);">● MONITORANDO</span>`;
    } else {
      statusBadge.innerHTML = `<span style="background: rgba(255,123,0,0.2); color: #ff7b00; border: 1px solid #ff7b00; padding: 3px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 700;">⚠️ VISUALIZAÇÃO</span>`;
    }
  }

  const monitorBtn = panel.querySelector("#scm-monitor");

  const autoCollectEl = panel.querySelector("#scm-auto-collect");
  if (autoCollectEl && document.activeElement !== autoCollectEl) {
    autoCollectEl.checked = state.autoCollectEnabled === true;
  }

  const autoMonitorEl = panel.querySelector("#scm-auto-monitor-live");
  if (autoMonitorEl && document.activeElement !== autoMonitorEl) {
    autoMonitorEl.checked = state.autoMonitorOnLive === true;
  }

  if (monitorBtn) {
    if (getMonitoring()) {
      monitorBtn.textContent = "Pausar Monitor";
      monitorBtn.style.background = "linear-gradient(90deg, #00e5ff, #2563eb)";
      monitorBtn.style.color = "#0f1024";
    } else {
      monitorBtn.textContent = "Iniciar Monitor";
      monitorBtn.style.background = "linear-gradient(90deg, #ff2a6d, #ff7b00)";
      monitorBtn.style.color = "#fff";
    }
  }

  let kingDisplay = state.roomKing;
  if (!kingDisplay || kingDisplay.includes("Seja o primeiro!")) kingDisplay = "Nenhum";
  const roomEl = panel.querySelector("#scm-room");
  if (roomEl) {
    roomEl.innerHTML = `▶️ Sala: <b style="color:#fff;">${clean(state.room)}</b> <br> 👑 Rei: <span style="color:#ff7b00; font-weight:600;">${clean(kingDisplay)}</span>`;
  }

  const tableUsersEl = panel.querySelector("#scm-table");
  if (tableUsersEl) tableUsersEl.innerHTML = tableUsers();

  eventsController.renderEventsTable();

  let goalsHtml = "";
  if (state.goals && state.goals.length > 0) {
    goalsHtml =
      `<div class="scroll"><table><thead><tr><th>Meta / Descrição</th><th>Preço</th><th>Status</th></tr></thead><tbody>` +
      state.goals
        .map((g) => {
          let statusColor = "#ff7b00";
          if (g.status === "Completa") statusColor = "#00e5ff";
          if (g.status === "Interrompida") statusColor = "#ff2a6d";
          const amtText = g.amount ? `${g.amount}` : "—";
          return `<tr><td>${clean(g.description)}</td><td>${clean(amtText)}</td><td><span style="color:${statusColor}; font-weight:bold;">${clean(g.status)}</span></td></tr>`;
        })
        .join("") +
      `</tbody></table></div>`;
  } else {
    goalsHtml = `<div class="scroll"><table><thead><tr><th>Meta / Descrição</th><th>Preço</th><th>Status</th></tr></thead><tbody><tr><td colspan="3" style="text-align:center; color:#8b92b8; padding: 16px;">Nenhuma meta identificada.</td></tr></tbody></table></div>`;
  }

  const goalContainer = panel.querySelector("#scm-goal");
  if (goalContainer) {
    const existingScroll = goalContainer.querySelector(".scroll");
    const savedHeight = existingScroll ? existingScroll.style.height : null;
    goalContainer.innerHTML = goalsHtml;
    if (savedHeight) {
      const newScroll = goalContainer.querySelector(".scroll");
      if (newScroll) newScroll.style.height = savedHeight;
    }
  }

  renderTodoList();
  renderHistoryTable();
}

function makeDraggable(elmnt, handle) {
  const targetHandle = handle || elmnt;
  targetHandle.onmousedown = (e) => {
    if (e.target.closest("input, button, select, textarea, a, label")) return;
    e.preventDefault();
    let pos3 = e.clientX;
    let pos4 = e.clientY;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const pos1 = pos3 - moveEvent.clientX;
      const pos2 = pos4 - moveEvent.clientY;
      pos3 = moveEvent.clientX;
      pos4 = moveEvent.clientY;
      elmnt.style.top = elmnt.offsetTop - pos2 + "px";
      elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
      elmnt.style.bottom = "auto";
      elmnt.style.right = "auto";
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
}

function makeResizable(elmnt) {
  if (!elmnt) return;

  elmnt.querySelectorAll("[data-resize-corner]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = elmnt.getBoundingClientRect();
      const rect = {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
      const corner = handle.getAttribute("data-resize-corner") || "se";
      const startX = event.clientX;
      const startY = event.clientY;

      const onPointerMove = (moveEvent) => {
        const next = calculatePanelResize(
          rect,
          corner,
          moveEvent.clientX - startX,
          moveEvent.clientY - startY,
          window.innerWidth,
          window.innerHeight,
        );
        elmnt.style.left = `${next.left}px`;
        elmnt.style.top = `${next.top}px`;
        elmnt.style.right = "auto";
        elmnt.style.bottom = "auto";
        elmnt.style.width = `${next.width}px`;
        elmnt.style.height = `${next.height}px`;
      };

      const finishResize = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", finishResize);
        document.removeEventListener("pointercancel", finishResize);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", finishResize);
      document.addEventListener("pointercancel", finishResize);
    });
  });
}

export function renderModerationTags() {
  if (!panel) return;
  const container = panel.querySelector("#scm-mod-tags-container");
  if (!container) return;

  const keywords = state.moderationKeywords || [];
  container.innerHTML = buildModerationTagsHtml(keywords);
  if (keywords.length === 0) return;

  container.querySelectorAll(".scm-remove-tag").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-index"));
      keywords.splice(idx, 1);
      state.moderationKeywords = keywords;

      safeStorage.set({ [`scm:model:${state.modelId}:moderation_keywords`]: state.moderationKeywords }, () => {
        saveToGlobalHistory();
        renderModerationTags();
      });
    };
  });
}

export function renderSuspectBots() {
  if (!panel) return;
  const tbody = panel.querySelector("#scm-suspect-bots-table");
  if (!tbody) return;

  const suspects = state.suspectBots || [];
  tbody.innerHTML = buildSuspectBotRows(suspects);
  if (suspects.length === 0) return;

  tbody.querySelectorAll(".scm-dismiss-bot-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetUser = btn.getAttribute("data-username");
      if (targetUser && typeof window.__scmDismissBot === "function") {
        window.__scmDismissBot(targetUser);
      }
    };
  });
}

function syncUserFilterButtons() {
  if (!panel) return;
  panel.querySelectorAll(".scm-user-filter-btn").forEach((b) => {
    if (b.getAttribute("data-filter") === usersFilterMode) {
      b.style.background = "linear-gradient(90deg, #ff2a6d, #ff7b00)";
      b.style.color = "#fff";
      b.style.border = "0";
    } else {
      b.style.background = "#23264d";
      b.style.color = "#8b92b8";
      b.style.border = "0";
    }
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  if (!panel) return;

  panel.querySelectorAll(".scm-tab-content").forEach((content) => {
    content.style.display = content.id === `scm-tab-${tabId}` ? "block" : "none";
  });

  panel.querySelectorAll(".scm-tab-btn").forEach((btn) => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.style.color = "#fff";
      btn.style.background = "rgba(255, 42, 109, 0.14)";
      btn.style.boxShadow = "inset 0 -2px 0 #00e5ff";
    } else {
      btn.style.color = "#8b92b8";
      btn.style.background = "transparent";
      btn.style.boxShadow = "none";
    }
  });

  if (tabId === "users") {
    syncUserFilterButtons();
    const tableUsersEl = panel.querySelector("#scm-table");
    if (tableUsersEl) tableUsersEl.innerHTML = tableUsers();
  } else if (tabId === "events") {
    eventsController.onTabSelected();
  } else if (tabId === "history") {
    renderHistoryTable();
  } else if (tabId === "report") {
    const alreadyInitialized = reportController.isInitialized();
    reportController.initialize();
    if (alreadyInitialized) reportController.refreshSelectors();
  }
}

export function setLauncherAvatar(avatarUrl = "") {
  const launcher = document.getElementById("scm-launch");
  if (!launcher) return;

  let url = null;
  try {
    url = new URL(String(avatarUrl));
  } catch {
    url = null;
  }
  const isAllowedAvatar =
    url?.protocol === "https:" && url.hostname === "static-proxy.strpst.com";
  let image = launcher.querySelector(".scm-launch-avatar");

  if (!isAllowedAvatar) {
    if (image) launcher.replaceChildren(document.createTextNode("📊"));
    launcher.style.width = "";
    launcher.style.height = "";
    launcher.style.padding = "16px 20px";
    launcher.style.boxSizing = "";
    launcher.style.lineHeight = "";
    launcher.title = "Abrir SC Monitor";
    launcher.setAttribute("aria-label", "Abrir SC Monitor");
    return;
  }

  if (!image) {
    image = document.createElement("img");
    image.className = "scm-launch-avatar";
    image.alt = "";
    image.draggable = false;
    image.style.cssText =
      "display:block; width:46px; height:46px; object-fit:cover; border:2px solid rgba(0,229,255,.95); border-radius:50%; box-sizing:border-box;";
    launcher.replaceChildren(image);
  }

  if (image.src !== url.href) image.src = url.href;
  launcher.style.width = "56px";
  launcher.style.height = "56px";
  launcher.style.padding = "5px";
  launcher.style.boxSizing = "border-box";
  launcher.style.lineHeight = "0";
  launcher.title = "Abrir SC Monitor — foto da modelo";
  launcher.setAttribute("aria-label", "Abrir SC Monitor; foto da modelo");
}

export function createUI(handlers = {}) {
  if (document.getElementById("scm-launch")) return;

  unsubscribeUIRefresh?.();
  unsubscribeUIRefresh = subscribeToUIRefresh((section, payload) => {
    if (!panel || panel.style.display !== "flex") return;
    if (section === UI_REFRESH.TODOS) renderTodoList();
    else if (section === UI_REFRESH.EVENTS) render();
    else if (section === UI_REFRESH.MUTED_USERS) renderMutedUsers();
    else if (section === UI_REFRESH.MODERATION_LOGS) renderModerationLogs();
    else if (section === UI_REFRESH.REPORT_MODELS && activeTab === "report") {
      reportController.refreshSelectors();
    } else if (
      section === UI_REFRESH.REPORT_DATA &&
      activeTab === "report" &&
      reportController.shouldRenderDataUpdate(payload)
    ) {
      reportController.render();
    }
  });

  launch = document.createElement("button");
  launch.id = "scm-launch";
  launch.style.cssText =
    "position: fixed; bottom: 52px; right: 15px; z-index: 999999; background: linear-gradient(135deg, #ff2a6d 0%, #8a2be2 100%); color: #fff; border: 0; padding: 16px 20px; border-radius: 99px; font-weight: bold; cursor: move; box-shadow: 0 6px 24px rgba(255,42,109,0.5); transition: transform 0.2s;";
  launch.textContent = "📊";

  panel = document.createElement("div");
  panel.id = "scm-panel";
  panel.style.display = "none";

  const existingStyleFix = document.getElementById("scm-style-fix");
  if (existingStyleFix && !existingStyleFix.textContent.includes(".scm-panel-footer")) {
    existingStyleFix.remove();
  }

  if (!document.getElementById("scm-style-fix")) {
    const styleFix = document.createElement("style");
    styleFix.id = "scm-style-fix";
    styleFix.textContent = `
      #scm-panel {
        position: fixed; 
        bottom: 20px; 
        right: 20px; 
        width: 508px;
        min-width: 370px;
        max-width: 900px;
        min-height: 300px;
        max-height: 92vh;
        background: radial-gradient(ellipse at top left, #171a36 0%, #0f1024 58%);
        color: #f8fafc; 
        z-index: 999999; 
        border: 1px solid rgba(0, 229, 255, 0.22);
        box-shadow: 0 20px 56px rgba(0, 0, 0, 0.72), 0 0 30px rgba(0, 229, 255, 0.06);
        display: flex; 
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
        border-radius: 18px;
        resize: none;
        overflow: auto; 
        backdrop-filter: blur(12px);
      }
      #scm-panel {
        scrollbar-width: thin;
        scrollbar-color: #353970 #0f1024;
      }
      #scm-panel .scm-panel-resize-handle {
        position: absolute;
        z-index: 999;
        width: 14px;
        height: 14px;
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        opacity: 0.5;
        touch-action: none;
      }
      #scm-panel .scm-panel-resize-handle::before {
        content: "";
        position: absolute;
        width: 8px;
        height: 8px;
        right: 3px;
        bottom: 3px;
        background: repeating-linear-gradient(135deg, transparent 0 3px, rgba(210, 216, 235, 0.8) 3px 4px, transparent 4px 7px);
      }
      #scm-panel .scm-resize-ne::before,
      #scm-panel .scm-resize-sw::before {
        background: repeating-linear-gradient(45deg, transparent 0 3px, rgba(210, 216, 235, 0.8) 3px 4px, transparent 4px 7px);
      }
      #scm-panel .scm-panel-resize-handle:hover,
      #scm-panel .scm-panel-resize-handle:focus-visible { opacity: 1; }
      #scm-panel .scm-resize-nw { top: 0; left: 0; cursor: nwse-resize; }
      #scm-panel .scm-resize-ne { top: 0; right: 0; cursor: nesw-resize; }
      #scm-panel .scm-resize-sw { bottom: 0; left: 0; cursor: nesw-resize; }
      #scm-panel .scm-resize-se { bottom: 0; right: 0; cursor: nwse-resize; }
      #scm-panel .scm-resize-nw::before { top: 3px; left: 3px; right: auto; bottom: auto; }
      #scm-panel .scm-resize-ne::before { top: 3px; right: 3px; bottom: auto; }
      #scm-panel .scm-resize-sw::before { bottom: 3px; left: 3px; right: auto; }
      #scm-panel .scroll {
        scrollbar-width: thin;
        scrollbar-color: #353970 #181a36;
      }
      #scm-panel ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      #scm-panel ::-webkit-scrollbar-track {
        background: #0f1024;
        border-radius: 4px;
      }
      #scm-panel ::-webkit-scrollbar-thumb {
        background: #353970;
        border-radius: 4px;
      }
      #scm-panel ::-webkit-scrollbar-thumb:hover {
        background: #00e5ff;
      }
      #scm-panel .head {
        background: linear-gradient(110deg, #171a36 0%, #252950 100%);
        padding: 13px 16px; 
        display: flex; 
        justify-content: space-between;
        align-items: center; 
        font-weight: bold; 
        flex-shrink: 0; 
        z-index: 100; 
        cursor: move;
        border-radius: 17px 17px 0px 0px;
        border-bottom: 1px solid rgba(0, 229, 255, 0.18);
        box-shadow: 0 5px 16px rgba(0,0,0,0.18);
      }
      #scm-launch { cursor: move; }
      #scm-panel .scm-panel-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-shrink: 0;
        min-height: 38px;
        padding: 6px 14px;
        box-sizing: border-box;
        background: linear-gradient(110deg, #171a36 0%, #252950 100%);
        border-top: 1px solid rgba(0, 229, 255, 0.18);
        border-radius: 0 0 17px 17px;
        box-shadow: 0 -4px 14px rgba(0,0,0,0.16);
        cursor: move;
        user-select: none;
      }
      #scm-panel .scm-panel-footer-brand {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 8px;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.35px;
        white-space: nowrap;
      }
      #scm-panel .scm-panel-footer-logo {
        display: flex;
        width: 26px;
        height: 26px;
        flex: 0 0 26px;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0, 229, 255, 0.65);
        border-radius: 50%;
        background: linear-gradient(135deg, #ff2a6d, #8a2be2);
        color: #fff;
        font-size: 12px;
        font-weight: 900;
      }
      #scm-panel .scm-panel-footer-date {
        color: #67e8f9;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
      }
      #scm-panel .head button.close {
        background: rgba(255,42,109,0.2); border: 1px solid rgba(255,42,109,0.5); color: #ff2a6d; padding: 4px 10px; border-radius: 99px; cursor: pointer; font-weight: bold; font-size: 11px; transition: all 0.2s;
      }
      #scm-panel .head button.close:hover { background: #ff2a6d; color: #fff; }
      #scm-panel .tabs-nav {
        display: flex; background: #14162e; border-bottom: 1px solid #272952; flex-shrink: 0; overflow-x: auto;
      }
      #scm-panel .scm-tab-btn {
        flex: 1; padding: 10px 8px; border: none; background: transparent; color: #8b92b8; font-size: 11px;
        font-weight: 600; cursor: pointer; text-align: center; white-space: nowrap; transition: all 0.2s;
      }
      #scm-panel .scm-tab-btn:hover { color: #fff; background: rgba(255,255,255,0.03); }
      #scm-panel .scm-tab-btn:focus-visible,
      #scm-panel button:focus-visible,
      #scm-panel input:focus-visible,
      #scm-panel select:focus-visible {
        outline: 2px solid #00e5ff;
        outline-offset: 2px;
      }
      #scm-panel .body { padding: 16px; overflow-y: auto !important; flex: 1; background: #0f1024; }
      #scm-panel .scm-tab-content { display: none; }
      #scm-panel .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
      #scm-panel .card, #scm-panel .scm-cyber-card {
        background: #181a36; 
        padding: 12px 14px; 
        border-radius: 14px; 
        display: flex; 
        flex-direction: column; 
        border: 1px solid #272952; 
        box-shadow: 0 8px 20px rgba(0,0,0,0.3); 
      }
      #scm-panel #scm-report-workspace > .scm-cyber-card,
      #scm-panel #scm-report-workspace > .report-card,
      #scm-panel #scm-report-workspace > .chart-grid {
        margin-bottom: 12px;
      }
      #scm-panel #scm-report-workspace .report-card {
        display: block;
        min-width: 0;
        margin-bottom: 12px;
        padding: 12px 14px;
        border: 1px solid #272952;
        border-left: 3px solid #8a5cf6;
        border-radius: 14px;
        background: #181a36;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      }
      #scm-panel #scm-report-workspace .report-card h2 {
        margin: 0 0 8px;
        color: #00e5ff;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 700;
      }
      #scm-panel .card small, #scm-panel .scm-cyber-card small { color: #8b92b8; font-size: 10.5px; margin-bottom: 2px; }
      #scm-panel .card small.leagues { color: #f8fafc; font-weight: 500; }
      #scm-panel .card strong, #scm-panel .scm-cyber-card strong { font-size: 15px; margin-top: 2px; color: #fff; font-weight: 700; }
      #scm-panel .card input { width: 100%; background: #0f1024; border: 1px solid #272952; color: #00e5ff; padding: 6px 8px; border-radius: 8px; text-align: center; font-size: 12px; font-weight: bold; }
      #scm-panel .card input:focus { border-color: #00e5ff; outline: none; }
      #scm-panel h4 { margin: 16px 0 8px 0; font-size: 12.5px; color: #00e5ff; border-bottom: 1px solid #272952; padding-bottom: 6px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; }
      #scm-panel .scroll { height: 190px; min-height: 90px; resize: vertical; overflow: auto !important; background: #181a36; border-radius: 12px; border: 1px solid #272952; margin-top: 6px; box-shadow: inset 0 2px 6px rgba(0,0,0,0.3); }
      #scm-panel table { width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left; }
      #scm-panel th { background: #23264d; color: #00e5ff; padding: 8px 10px; position: sticky; top: 0; z-index: 5; font-weight: 700; border-bottom: 1px solid #272952; font-size: 10.5px; text-transform: uppercase; }
      #scm-panel td { padding: 7px 10px; border-bottom: 1px solid #23264d; color: #f8fafc; }
      #scm-panel tr:hover td { background: rgba(0, 229, 255, 0.04); }
      #scm-panel .button-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
      #scm-panel .button-row { display: flex; gap: 8px; width: 100%; }
      #scm-panel .button-row button { flex: 1; background: #23264d; border: 1px solid #353970; color: #fff; padding: 10px; border-radius: 99px; cursor: pointer; font-size: 11.5px; font-weight: 700; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25); transition: all 0.2s; }
      #scm-panel .button-row button:hover { border-color: #00e5ff; transform: translateY(-1px); }
      #scm-panel .button-row button:active { transform: translateY(0); }
      #scm-panel .muted { color: #8b92b8; font-size: 12px; }
      #scm-panel .scm-backup-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 12px;
        padding: 14px;
        border: 1px solid #272952;
        border-radius: 14px;
        background: #181a36;
      }
      #scm-panel .scm-backup-heading,
      #scm-panel .scm-backup-section {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      #scm-panel .scm-backup-heading > strong {
        color: #00e5ff;
        font-size: 13px;
      }
      #scm-panel .scm-backup-heading > small,
      #scm-panel .scm-backup-note {
        color: #8b92b8;
        font-size: 10.5px;
        line-height: 1.45;
      }
      #scm-panel .scm-backup-section {
        padding-top: 10px;
        border-top: 1px solid #272952;
      }
      #scm-panel .scm-backup-section-title {
        color: #cbd5e1;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.35px;
      }
      #scm-panel .scm-backup-controls,
      #scm-panel .scm-backup-import-options {
        display: flex;
        align-items: end;
        flex-wrap: wrap;
        gap: 8px;
      }
      #scm-panel .scm-backup-import-options {
        align-items: stretch;
        flex-direction: column;
        padding-top: 8px;
      }
      #scm-panel .scm-backup-card label {
        display: flex;
        min-width: 150px;
        flex: 1 1 150px;
        flex-direction: column;
        gap: 5px;
        color: #8b92b8;
        font-size: 10px;
      }
      #scm-panel .scm-backup-card select {
        width: 100%;
        min-height: 36px;
        padding: 7px 9px;
        border: 1px solid #353970;
        border-radius: 8px;
        background: #0f1024;
        color: #f8fafc;
        font-size: 11px;
      }
      #scm-panel .scm-backup-card button {
        min-height: 36px;
        flex: 1 1 150px;
        padding: 8px 12px;
        border: 1px solid #353970;
        border-radius: 8px;
        background: #23264d;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      #scm-panel .scm-backup-card button:hover {
        border-color: #00e5ff;
      }
      #scm-panel .scm-backup-card button.scm-backup-primary {
        border: 0;
        background: linear-gradient(90deg, #00e5ff, #2563eb);
        color: #0f1024;
      }
      #scm-panel .scm-backup-card [hidden] {
        display: none !important;
      }
    `;
    document.head.append(styleFix);
  }

  panel.innerHTML = buildPanelHtml({
    headerDate: formatIsoDateToBr(localDateKey()),
    footerDate: formatIsoDateToBr(localDateKey()),
    fanClubPrices: state.fanClubPrices || {},
    showPrices: state.showPrices || {},
  });

  document.body.append(launch, panel);

  switchTab(activeTab);

  panel.querySelectorAll(".scm-tab-btn").forEach((btn) => {
    btn.onclick = () => switchTab(btn.getAttribute("data-tab"));
  });

  const openReportsButton = panel.querySelector("#scm-open-reports");
  if (openReportsButton) {
    openReportsButton.onclick = () =>
      openReportsPage((error) => {
        openReportsButton.textContent = "Falha ao abrir";
        openReportsButton.title = error.message;
      });
  }

  panel.querySelectorAll(".scm-user-filter-btn").forEach((btn) => {
    btn.onclick = () => {
      usersFilterMode = btn.getAttribute("data-filter") || "all";
      syncUserFilterButtons();
      const tableUsersEl = panel.querySelector("#scm-table");
      if (tableUsersEl) tableUsersEl.innerHTML = tableUsers();
    };
  });

  panel.querySelectorAll(".scm-users-audience-step").forEach((button) => {
    button.onclick = () => {
      const step = button.getAttribute("data-step") || "auto";
      usersAudienceStepMin = step === "auto" ? "auto" : Number(step) || 60;
      renderUsersAudienceChart();
    };
  });

  panel.querySelectorAll(".scm-event-filter-btn").forEach((btn) => {
    btn.onclick = () => {
      eventsController.setFilter(btn.getAttribute("data-filter") || "all");
    };
  });

  const modInput = panel.querySelector("#scm-mod-input");
  const modAddBtn = panel.querySelector("#scm-mod-add-btn");

  const addKeyword = () => {
    if (!modInput) return;
    const val = modInput.value.trim().toLowerCase();
    if (!val) return;
    if (!Array.isArray(state.moderationKeywords)) state.moderationKeywords = [];
    if (!state.moderationKeywords.includes(val)) {
      state.moderationKeywords.push(val);
      safeStorage.set({ [`scm:model:${state.modelId}:moderation_keywords`]: state.moderationKeywords }, () => {
        saveToGlobalHistory();
        renderModerationTags();
      });
    }
    modInput.value = "";
    modInput.focus();
  };

  if (modAddBtn) modAddBtn.onclick = addKeyword;
  if (modInput) {
    modInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addKeyword();
      }
    };
  }

  const bindInput = (id, obj, prop) => {
    const el = panel.querySelector(id);
    if (!el) return;
    el.onfocus = () => el.select();

    const updateValue = (e) => {
      const val = Number(e.target.value) || 0;
      if (obj) obj[prop] = val;

      if (id.includes("soldado") || id.includes("lorde") || id.includes("principe")) {
        if (!state.fanClubPrices) state.fanClubPrices = { soldado: 0, lord: 0, principe: 0 };
        state.fanClubPrices[prop] = val;
      } else {
        if (!state.showPrices) state.showPrices = { privateTkMin: 0, vipTkMin: 0 };
        state.showPrices[prop] = val;
      }

      const modelKey = state.modelId || state.room;
      const storageKey = state.modelId ? `scm:model:${state.modelId}` : `scm:model:${modelKey}`;

      safeStorage.get([storageKey], (res) => {
        const roomData = res?.[storageKey] || {};
        roomData.fanClubPrices = state.fanClubPrices;
        roomData.showPrices = state.showPrices;
        safeStorage.set({ [storageKey]: roomData }, () => {
          if (getMonitoring()) saveToGlobalHistory();
        });
      });
    };

    el.oninput = updateValue;
    el.onblur = updateValue;
  };

  bindInput("#scm-price-soldado", state.fanClubPrices, "soldado");
  bindInput("#scm-price-lorde", state.fanClubPrices, "lord");
  bindInput("#scm-price-principe", state.fanClubPrices, "principe");
  bindInput("#scm-price-private", state.showPrices, "privateTkMin");
  bindInput("#scm-price-vip", state.showPrices, "vipTkMin");

  let isDragging = false;
  let startX = 0,
    startY = 0;

  launch.onmousedown = (e) => {
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    let pos3 = e.clientX;
    let pos4 = e.clientY;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const pos1 = pos3 - moveEvent.clientX;
      const pos2 = pos4 - moveEvent.clientY;
      pos3 = moveEvent.clientX;
      pos4 = moveEvent.clientY;
      launch.style.top = launch.offsetTop - pos2 + "px";
      launch.style.left = launch.offsetLeft - pos1 + "px";
      launch.style.bottom = "auto";
      launch.style.right = "auto";
    };

    const onMouseUp = (upEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (Math.abs(upEvent.clientX - startX) > 4 || Math.abs(upEvent.clientY - startY) > 4) {
        isDragging = true;
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  launch.onclick = (e) => {
    e.stopPropagation();
    if (isDragging) {
      isDragging = false;
      return;
    }

    panel.style.top = "auto";
    panel.style.left = "auto";
    panel.style.bottom = "20px";
    panel.style.right = "20px";

    panel.style.display = "flex";
    launch.style.display = "none";
    render();
  };

  makeDraggable(panel, panel.querySelector("#scm-panel-header"));
  makeDraggable(panel, panel.querySelector("#scm-panel-footer"));
  makeResizable(panel);

  const closeBtn = panel.querySelector("#scm-close");
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      panel.style.display = "none";
      launch.style.display = "block";
    };
  }

  if (outsideClickListener) {
    document.removeEventListener("pointerdown", outsideClickListener);
  }
  outsideClickListener = (e) => {
    if (!panel || panel.style.display === "none") return;
    const pinCheckbox = panel.querySelector("#scm-pin-panel");
    if (pinCheckbox && pinCheckbox.checked) return;

    if (panel.contains(e.target) || launch.contains(e.target)) return;

    if (
      e.target.closest('[data-testid="join-fan-club-button"]') ||
      e.target.closest(".FanClubWelcome__joinButton") ||
      e.target.closest("button") ||
      e.target.closest("input")
    ) {
      return;
    }

    panel.style.display = "none";
    launch.style.display = "block";
  };
  document.addEventListener("pointerdown", outsideClickListener);

  panel.querySelector("#scm-export").onclick = downloadCSV;
  panel.querySelector("#scm-export-backup").onclick = downloadDataBackup;
  panel.querySelector("#scm-import-backup").onclick = () => {
    panel.querySelector("#scm-backup-file")?.click();
  };
  configureBackupControls();
  refreshStorageUsage();

  if (handlers.collect) panel.querySelector("#scm-refresh").onclick = () => handlers.collect();
  if (handlers.toggleMonitoring)
    panel.querySelector("#scm-monitor").onclick = () => {
      handlers.toggleMonitoring();
      render();
    };
  if (handlers.resetData) panel.querySelector("#scm-reset").onclick = () => handlers.resetData();
  if (handlers.saveNow) panel.querySelector("#scm-save").onclick = () => handlers.saveNow();

  const autoCollectCheckbox = panel.querySelector("#scm-auto-collect");
  if (autoCollectCheckbox) {
    autoCollectCheckbox.checked = state.autoCollectEnabled === true;
    autoCollectCheckbox.onchange = () => {
      const isChecked = autoCollectCheckbox.checked;
      state.autoCollectEnabled = isChecked;
      if (handlers.setAutoCollect) handlers.setAutoCollect(isChecked);
    };
  }

  const autoMonitorLiveCheckbox = panel.querySelector("#scm-auto-monitor-live");
  if (autoMonitorLiveCheckbox) {
    autoMonitorLiveCheckbox.checked = state.autoMonitorOnLive === true;
    autoMonitorLiveCheckbox.onchange = () => {
      const isChecked = autoMonitorLiveCheckbox.checked;
      state.autoMonitorOnLive = isChecked;
      if (handlers.setAutoMonitorOnLive) {
        handlers.setAutoMonitorOnLive(isChecked);
      }
    };
  }
}