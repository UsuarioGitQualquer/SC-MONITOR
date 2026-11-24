import { openReportsPage } from "../src/ui/open-reports.js";
import { safeStorage } from "../src/core/storage.js";
import {
  bindLanguageSelector,
  initializeLocalization,
  watchLocalization,
} from "../src/utils/i18n.js";

const $ = (id) => document.getElementById(id);
let activeTabId = null;

window.addEventListener("blur", () => {
  window.close();
});

function send(type, callback, retryCount = 0) {
  if (activeTabId === null) {
    callback?.({ ok: false, error: "Nenhuma aba ativa disponível." });
    return;
  }
  chrome.tabs.sendMessage(activeTabId, { type }, (response) => {
    const messageError = chrome.runtime.lastError;
    if (messageError || !response) {
      if (retryCount === 0) {
        $("status").textContent = "Verificando conexão…";
        setTimeout(() => send(type, callback, 1), 250);
        return;
      }

      if (retryCount === 1) {
        $("status").textContent = "Reconectando ao Stripchat…";
        chrome.runtime.sendMessage(
          { type: "SCM_RECOVER_CONTENT_SCRIPT", tabId: activeTabId },
          (recovery) => {
            if (chrome.runtime.lastError || !recovery?.ok) {
              $("status").textContent =
                "Não foi possível reconectar. Atualize a extensão e tente novamente.";
              callback?.({ ok: false, error: $("status").textContent });
              return;
            }
            setTimeout(() => send(type, callback, 2), 300);
          },
        );
        return;
      }

      if (retryCount < 6) {
        $("status").textContent = "Reconectando ao Stripchat…";
        setTimeout(() => send(type, callback, retryCount + 1), 300);
        return;
      }

      $("status").textContent =
        "Não foi possível reconectar. Atualize a página do Stripchat.";
      callback?.({ ok: false, error: $("status").textContent });
      return;
    }
    callback?.(response);
  });
}

function showData(data) {
  if (!data?.ok) {
    $("status").textContent = "Recarregue a sala para iniciar";
    return;
  }
  $("status").textContent =
    (data.monitoring ? "Monitorando · " : "Pausado · ") +
    "Modelo: " +
    (data.modelId || "não identificado");
  $("viewers").textContent = data.currentViewers ?? "—";
  $("peak").textContent = data.peakViewers ?? "—";
  $("users").textContent = data.listedUsersCount ?? 0;
  $("others").textContent = data.otherUsersCount ?? 0;

  if ($("tokens-users"))
    $("tokens-users").textContent = data.tokensUsersCount ?? 0;
  if ($("ultimate-users"))
    $("ultimate-users").textContent = data.ultimateUsersCount ?? 0;
  if ($("invisible-users"))
    $("invisible-users").textContent = data.invisibleUsersCount ?? 0;
  if ($("more-users")) $("more-users").textContent = data.moreUsersCount ?? 0;

  $("tokens").textContent = (data.totalTokens || 0) + " tk";
  $("room").textContent = data.modelName || "Dados separados por modelo.";
  $("start").textContent = data.monitoring
    ? "Pausar monitoramento"
    : "Começar a monitorar";
  loadHistoryList();
}

function loadHistoryList() {
  safeStorage.get(["scm_rooms_history"], (res, result) => {
    const container = $("history-container");
    container.innerHTML = "";
    if (result?.ok === false) {
      container.textContent = "Falha ao carregar o histórico local.";
      $("status").textContent = `Falha ao carregar o histórico: ${result.error?.message || "erro desconhecido"}`;
      return;
    }
    const history = res.scm_rooms_history || {};

    if (Object.keys(history).length === 0) {
      container.innerHTML = `<div class="muted" style="text-align:center; padding:6px;">Nenhuma sala anterior salva.</div>`;
      return;
    }

    Object.entries(history).forEach(([entryKey, item]) => {
      const modelId = item.modelId || entryKey.split("::")[0] || entryKey;
      const dateKey = item.dateKey || entryKey.split("::")[1] || "";
      const div = document.createElement("div");
      div.style.cssText =
        "background:#1f2937; padding:6px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; font-size:11px;";

      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.style.cssText = "color:#fff; font-size:12px;";
      name.textContent = String(item.modelName || item.modelId || modelId);

      const summary = document.createElement("span");
      summary.style.cssText = "color:#9ca3af; display:block;";
      summary.textContent = `Tokens: ${Number(item.totalTokens) || 0} tk | Pico: ${Number(item.peakViewers) || 0}`;
      details.append(name, summary);

      const button = document.createElement("button");
      button.className = "secondary";
      button.style.cssText = "padding:4px 8px; font-size:10px;";
      button.textContent = "Apagar";
      button.onclick = () => {
        const modelPrefix = `scm:model:${modelId}`;
        safeStorage.get(null, (allData, readResult) => {
          if (readResult?.ok === false) {
            $("status").textContent = `Falha ao apagar o histórico: ${readResult.error?.message || "erro desconhecido"}`;
            return;
          }
          const keysToRemove = new Set();
          if (dateKey && entryKey !== modelId) {
            keysToRemove.add(`${modelPrefix}:daily:${dateKey}`);
          } else if (entryKey === modelId) {
            keysToRemove.add(modelPrefix);
            Object.keys(allData || {}).forEach((key) => {
              if (
                key.startsWith(`${modelPrefix}:daily:`) ||
                key === `${modelPrefix}:moderation_keywords`
              ) {
                keysToRemove.add(key);
              }
            });
          }

          delete history[entryKey];
          const keyList = Array.from(keysToRemove);
          const saveHistory = () => {
            safeStorage.set({ scm_rooms_history: history }, (writeResult) => {
              if (writeResult?.ok === false) {
                $("status").textContent = `Falha ao apagar o histórico: ${writeResult.error?.message || "erro desconhecido"}`;
                return;
              }
              loadHistoryList();
            });
          };
          if (keyList.length > 0) {
            safeStorage.remove(keyList, (removeResult) => {
              if (removeResult?.ok === false) {
                $("status").textContent = `Falha ao apagar o histórico: ${removeResult.error?.message || "erro desconhecido"}`;
                return;
              }
              saveHistory();
            });
          } else {
            saveHistory();
          }
        });
      };

      div.append(details, button);
      container.appendChild(div);
    });
  });
}

async function refresh() {
  $("reports").onclick = () =>
    openReportsPage((error) => {
      $("status").textContent = `Falha ao abrir relatórios: ${error.message}`;
    });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  if (!url.includes("stripchat.com") && !url.includes("stripchat.global")) {
    $("status").textContent = "Não está no Stripchat";
    return;
  }
  activeTabId = tab.id;
  send("SCM_GET_SUMMARY", showData);
  $("open").onclick = () => send("SCM_TOGGLE");
  $("start").onclick = () =>
    send("SCM_TOGGLE_MONITOR", (r) => {
      if (r)
        $("start").textContent = r.monitoring
          ? "Pausar monitoramento"
          : "Começar a monitorar";
      setTimeout(() => send("SCM_GET_SUMMARY", showData), 150);
    });
  $("save").onclick = () =>
    send("SCM_SAVE", (result) => {
      $("save").textContent = result?.ok ? "Dados guardados!" : "Falha ao guardar";
      if (!result?.ok && result?.error) $("status").textContent = result.error;
      setTimeout(() => ($("save").textContent = "Guardar dados"), 1800);
    });
  $("export").onclick = () => send("SCM_EXPORT");
  $("reset").onclick = () => {
    if (confirm("Apagar os dados somente deste modelo?"))
      send("SCM_RESET", () =>
        setTimeout(() => send("SCM_GET_SUMMARY", showData), 300),
      );
  };
}

initializeLocalization().then(() => {
  bindLanguageSelector($("scm-language"));
  watchLocalization(document.body);
  refresh();
}).catch((error) => {
  console.error("[SC Monitor] Não foi possível inicializar o idioma:", error);
  refresh();
});
