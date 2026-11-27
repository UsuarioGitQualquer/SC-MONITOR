export const REPORT_VIEW_STATE_KEY = "report_page_view_state";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_MODES = new Set(["day", "session", "period"]);

function normalizeDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : "";
}

function normalizeString(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeReportViewState(value) {
  const state = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return {
    mode: REPORT_MODES.has(state.mode) ? state.mode : "",
    modelId: normalizeString(state.modelId),
    dateA: normalizeDateKey(state.dateA),
    dateB: normalizeDateKey(state.dateB),
    sessionA: normalizeString(state.sessionA),
    sessionB: normalizeString(state.sessionB),
    sessionComparisonCleared: state.sessionComparisonCleared === true,
    timeGranularity: normalizeString(state.timeGranularity),
    periodStart: normalizeDateKey(state.periodStart),
    periodEnd: normalizeDateKey(state.periodEnd),
    periodGranularity: normalizeString(state.periodGranularity),
    comparePeriods: state.comparePeriods === true,
    periodComparisonStart: normalizeDateKey(state.periodComparisonStart),
    periodComparisonEnd: normalizeDateKey(state.periodComparisonEnd),
  };
}

export function resolveReportDateSelection(dateKeys, savedDateKey, preferredDateKey) {
  const availableDates = new Set(Array.isArray(dateKeys) ? dateKeys : []);
  if (availableDates.has(savedDateKey)) return savedDateKey;
  if (availableDates.has(preferredDateKey)) return preferredDateKey;
  return Array.from(availableDates)[0] || "";
}
