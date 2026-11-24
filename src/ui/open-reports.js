export function openReportsPage(onError) {
  try {
    chrome.runtime.sendMessage({ type: "SCM_OPEN_REPORTS" }, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        onError?.(new Error(error.message));
      } else if (!result?.ok) {
        onError?.(new Error(result?.error || "Não foi possível abrir os relatórios."));
      }
    });
  } catch (error) {
    onError?.(error);
  }
}
