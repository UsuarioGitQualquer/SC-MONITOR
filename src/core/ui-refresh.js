const listeners = new Set();

export const UI_REFRESH = Object.freeze({
  TODOS: "todos",
  EVENTS: "events",
  MUTED_USERS: "muted-users",
  MODERATION_LOGS: "moderation-logs",
  REPORT_MODELS: "report-models",
  REPORT_DATA: "report-data",
});

export function subscribeToUIRefresh(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestUIRefresh(section, payload = null) {
  listeners.forEach((listener) => {
    try {
      listener(section, payload);
    } catch (error) {
      console.error("[SC Monitor] Erro ao atualizar a interface:", error);
    }
  });
}
