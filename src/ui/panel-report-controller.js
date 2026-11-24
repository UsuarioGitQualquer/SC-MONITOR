import { createPanelReportControls } from "./panel-report-controls.js";
import { createPanelReportWorkspace } from "./panel-report-workspace.js";

export function isReportUpdateVisible(reportState, payload) {
  const updatedModelId = String(payload?.modelId || "");
  const selectedModelIds = Array.isArray(reportState.modelIds)
    ? reportState.modelIds.map(String)
    : [String(reportState.selectedModelId || "")];
  if (!selectedModelIds.includes(updatedModelId)) {
    return false;
  }

  const dayKey = String(payload?.dayKey || "");
  return dayKey === reportState.dateA || dayKey === reportState.dateB;
}

export function createPanelReportController({
  getPanel,
  buildGainTypeChart,
  buildTopDonorsChart,
  formatSecondsToTime,
  generateExecutiveText,
  downloadDailyReportCSV,
}) {
  const reportState = {
    initialized: false,
    selectedModelId: null,
    viewMode: "day",
    timeGranularity: "auto",
    selectedSessionId: "",
    selectedLiveBId: "",
    liveBComparisonCleared: false,
    dateA: null,
    dateB: "",
    liveFilterEnabled: false,
    lastReportA: null,
    lastReportB: null,
  };
  const workspace = createPanelReportWorkspace({
    getPanel,
    reportState,
    buildGainTypeChart,
    buildTopDonorsChart,
    formatSecondsToTime,
  });
  const controls = createPanelReportControls({
    getPanel,
    reportState,
    renderReportWorkspace: workspace.render,
    generateExecutiveText,
    downloadDailyReportCSV,
  });

  return {
    initialize: controls.initialize,
    isInitialized: controls.isInitialized,
    refreshSelectors: controls.refreshSelectors,
    render: workspace.render,
    shouldRenderDataUpdate: (payload) => isReportUpdateVisible(reportState, payload),
  };
}
