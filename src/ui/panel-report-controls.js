import { clean } from "../utils/helpers.js";
import { state } from "../core/state.js";
import { safeStorage } from "../core/storage.js";
import {
  formatHistoryDate,
  listHistoryEntriesForModel,
  listHistoryModels,
} from "./report-data.js";

export function createPanelReportControls({
  getPanel,
  reportState,
  renderReportWorkspace,
  generateExecutiveText,
  downloadDailyReportCSV,
}) {
  let populateSelectors = null;

  function initialize() {
    const panel = getPanel();
    if (!panel || reportState.initialized) return;
    const modelSelect = panel.querySelector("#scm-report-model");
    const dateASelect = panel.querySelector("#scm-report-date-a");
    const dateBSelect = panel.querySelector("#scm-report-date-b");
    const liveBSelect = panel.querySelector("#scm-report-live-b");
    const copyBtn = panel.querySelector("#scm-report-copy");
    const csvBtn = panel.querySelector("#scm-report-csv");
    if (!modelSelect || !dateASelect || !dateBSelect) return;

    reportState.initialized = true;
    const initialSessionWrap = panel.querySelector("#scm-report-session-wrap");
    const initialDateBWrap = panel.querySelector("#scm-report-date-b-wrap");
    const initialLiveBWrap = panel.querySelector("#scm-report-live-b-wrap");
    if (initialSessionWrap) initialSessionWrap.style.display = "block";
    if (initialDateBWrap) initialDateBWrap.style.display = "block";
    if (initialLiveBWrap) initialLiveBWrap.style.display = "block";

    panel.querySelectorAll(".scm-rep-mode-btn").forEach((btn) => {
      btn.onclick = () => {
        reportState.viewMode = btn.getAttribute("data-mode") || "day";
        panel.querySelectorAll(".scm-rep-mode-btn").forEach((b) => {
          const active = b.getAttribute("data-mode") === reportState.viewMode;
          b.style.background = active ? "linear-gradient(90deg, #ff2a6d, #ff7b00)" : "#23264d";
          b.style.color = active ? "#fff" : "#8b92b8";
        });

        const dayControls = panel.querySelector("#scm-report-day-controls");
        const dateBWrap = panel.querySelector("#scm-report-date-b-wrap");
        const sessionWrap = panel.querySelector("#scm-report-session-wrap");
        const liveBWrap = panel.querySelector("#scm-report-live-b-wrap");

        if (dayControls) dayControls.style.display = "grid";
        if (dateBWrap) dateBWrap.style.display = reportState.viewMode === "day" ? "block" : "none";
        if (sessionWrap) sessionWrap.style.display = "block";
        if (liveBWrap) liveBWrap.style.display = "block";

        reportState.timeGranularity = "auto";
        reportState.liveFilterEnabled = reportState.viewMode === "session";
        renderReportWorkspace();
      };
    });

    const sessionSelect = panel.querySelector("#scm-report-session");
    if (sessionSelect) {
      sessionSelect.onchange = () => {
        reportState.selectedSessionId = sessionSelect.value;
        reportState.liveFilterEnabled =
          reportState.viewMode === "session" ? true : Boolean(sessionSelect.value);
        renderReportWorkspace();
      };
    }

    if (liveBSelect) {
      liveBSelect.onchange = () => {
        reportState.selectedLiveBId = liveBSelect.value;
        reportState.liveBComparisonCleared = !liveBSelect.value;
        renderReportWorkspace();
      };
    }

    populateSelectors = () => {
      safeStorage.get(["scm_rooms_history"], (res, readResult) => {
        if (readResult?.ok === false) {
          reportState.selectedModelId = null;
          reportState.dateA = null;
          reportState.dateB = "";
          modelSelect.innerHTML = `<option value="">Falha ao carregar modelos</option>`;
          dateASelect.innerHTML = `<option value="">—</option>`;
          dateBSelect.innerHTML = `<option value="">Sem comparação</option>`;
          const workspace = panel.querySelector("#scm-report-workspace");
          if (workspace) {
            workspace.innerHTML =
              `<div style="color:#ff7b00; font-size:12px; text-align:center; padding:20px;">Falha ao carregar modelos salvos. Tente abrir a aba novamente.</div>`;
          }
          return;
        }

        const hist = res?.scm_rooms_history || {};
        const models = listHistoryModels(hist);

        if (models.length === 0) {
          modelSelect.innerHTML = `<option value="">Nenhum modelo salvo</option>`;
          dateASelect.innerHTML = `<option value="">—</option>`;
          dateBSelect.innerHTML = `<option value="">Sem comparação</option>`;
          renderReportWorkspace();
          return;
        }

        const modelEntries = new Map(models.map((model) => [
          model.modelId,
          listHistoryEntriesForModel(hist, model.modelId),
        ]));

        const currentModel =
          models.find((model) => model.modelIds.includes(reportState.selectedModelId))?.modelId ||
          models.find((model) => model.modelIds.includes(state.modelId))?.modelId ||
          models[0].modelId;

        reportState.selectedModelId = currentModel;
        reportState.modelIds =
          models.find((model) => model.modelId === currentModel)?.modelIds || [currentModel];
        reportState.historyEntries = modelEntries.get(currentModel) || [];

        modelSelect.innerHTML = models
          .map(
            (m) =>
              `<option value="${clean(m.modelId)}" ${m.modelId === currentModel ? "selected" : ""}>${clean(m.label)}</option>`
          )
          .join("");

        const activeModelObj = models.find((model) => model.modelId === currentModel);
        const sortedDates = (modelEntries.get(activeModelObj?.modelId) || [])
          .map((entry) => ({
            ...entry,
            dateBr: formatHistoryDate(entry),
          }))
          .sort((a, b) =>
          String(b.dateKey).localeCompare(String(a.dateKey))
        );

        if (!reportState.dateA || !sortedDates.some((d) => d.dateKey === reportState.dateA)) {
          reportState.dateA = sortedDates[0]?.dateKey || "";
        }

        dateASelect.innerHTML = sortedDates
          .map(
            (d) =>
              `<option value="${clean(d.dateKey)}" ${d.dateKey === reportState.dateA ? "selected" : ""}>${clean(d.dateBr)}</option>`
          )
          .join("");

        dateBSelect.innerHTML =
          `<option value="">Sem comparação</option>` +
          sortedDates
            .map(
              (d) =>
                `<option value="${clean(d.dateKey)}" ${d.dateKey === reportState.dateB ? "selected" : ""}>${clean(d.dateBr)}</option>`
            )
            .join("");

        renderReportWorkspace();
      });
    };

    modelSelect.onchange = () => {
      reportState.selectedModelId = modelSelect.value;
      reportState.dateA = null;
      reportState.dateB = "";
      reportState.selectedSessionId = "";
      reportState.selectedLiveBId = "";
      reportState.liveBComparisonCleared = false;
      reportState.liveFilterEnabled = false;
      populateSelectors?.();
    };

    dateASelect.onchange = () => {
      reportState.dateA = dateASelect.value;
      reportState.selectedSessionId = "";
      reportState.selectedLiveBId = "";
      reportState.liveBComparisonCleared = false;
      reportState.liveFilterEnabled = false;
      renderReportWorkspace();
    };

    dateBSelect.onchange = () => {
      reportState.dateB = dateBSelect.value;
      renderReportWorkspace();
    };

    if (copyBtn) {
      copyBtn.onclick = () => {
        if (!reportState.lastReportA) return;
        const baseText = generateExecutiveText(reportState.lastReportA);
        let finalText = baseText;
        if (reportState.lastReportB) {
          const a = reportState.lastReportA;
          const b = reportState.lastReportB;
          finalText +=
            `\n\n🔄 *Comparativo vs ${b.dateBr}:*\n` +
            `  Tokens: ${a.totalTokens - b.totalTokens >= 0 ? "+" : ""}${a.totalTokens - b.totalTokens} tk\n` +
            `  Pico Viewers: ${a.peakViewers - b.peakViewers >= 0 ? "+" : ""}${a.peakViewers - b.peakViewers}\n` +
            `  Média Viewers: ${a.avgViewers - b.avgViewers >= 0 ? "+" : ""}${a.avgViewers - b.avgViewers}`;
        }
        navigator.clipboard.writeText(finalText).then(() => {
          copyBtn.textContent = "Copiado! ✅";
          setTimeout(() => (copyBtn.textContent = "📋 Copiar Resumo"), 1500);
        });
      };
    }

    if (csvBtn) {
      csvBtn.onclick = () => {
        if (reportState.lastReportA) {
          downloadDailyReportCSV(reportState.lastReportA);
        }
      };
    }

    populateSelectors();
  }

  return {
    initialize,
    isInitialized: () => reportState.initialized,
    refreshSelectors: () => populateSelectors?.(),
  };
}
