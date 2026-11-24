import { localDateKey, recordDailyModerationLog, recordDailyMutedUser, state } from "../core/state.js";
import { saveToGlobalHistory } from "../core/persistence.js";
import { requestUIRefresh, UI_REFRESH } from "../core/ui-refresh.js";

const MAX_LOGS = 200;
const MAX_MUTED = 300;
const MODAL_TIMEOUT_MS = 3000;
const RESULT_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 50;
let moderationQueue = Promise.resolve();

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUserAlreadyMuted(username) {
  const target = String(username || "").trim().toLowerCase();
  if (!target) return false;
  return (state.mutedUsers || []).some(
    (item) => String(item || "").trim().toLowerCase() === target,
  );
}

function saveModerationLog(log) {
  if (!Array.isArray(state.moderationLogs)) state.moderationLogs = [];
  state.moderationLogs.push(log);
  if (state.moderationLogs.length > MAX_LOGS) {
    state.moderationLogs.splice(0, state.moderationLogs.length - MAX_LOGS);
  }
  recordDailyModerationLog(log);
  saveToGlobalHistory();
  requestUIRefresh(UI_REFRESH.MODERATION_LOGS);
}

function updateModerationLog(log, status, detail) {
  log.status = status;
  log.detail = detail || "";
  log.updatedAt = Date.now();
  recordDailyModerationLog(log);
  saveToGlobalHistory();
  requestUIRefresh(UI_REFRESH.MODERATION_LOGS);
}

function waitForElement(selector, root, timeoutMs) {
  const searchRoot = root || document;
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const element = searchRoot.querySelector(selector);
      if (element) return resolve(element);
      if (Date.now() - startedAt >= timeoutMs) return resolve(null);
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}

function waitForElementToDisappear(selector, root, timeoutMs) {
  const searchRoot = root || document;
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const element = searchRoot.querySelector(selector);
      if (!element) return resolve(true);
      if (Date.now() - startedAt >= timeoutMs) return resolve(false);
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}

function wasConfirmedBySystemMessage(username, previousMessages) {
  const expected = normalizeText(username);
  return Array.from(document.querySelectorAll(".user-muted-message")).some(
    (message) => {
      if (previousMessages.has(message)) return false;
      const text = normalizeText(message.textContent);
      return (
        text.includes(expected) && text.includes("foi silenciado pelo site")
      );
    },
  );
}

export function addMutedUser(
  username,
  messageText = "",
  mutedBy = "Moderação Automática",
  recentMessages = null,
) {
  const cleanUsername = String(username || "").trim();
  if (!cleanUsername) return;

  if (!Array.isArray(state.mutedUsers)) state.mutedUsers = [];
  if (!isUserAlreadyMuted(cleanUsername)) {
    state.mutedUsers.push(cleanUsername);
    if (state.mutedUsers.length > MAX_MUTED) {
      state.mutedUsers.splice(0, state.mutedUsers.length - MAX_MUTED);
    }
  }

  if (!Array.isArray(state.mutedUsersDetails)) state.mutedUsersDetails = [];
  const existingIndex = state.mutedUsersDetails.findIndex(
    (item) =>
      String(item?.username || "").trim().toLowerCase() ===
      cleanUsername.toLowerCase(),
  );

  const detailEntry = {
    username: cleanUsername,
    mutedBy,
    lastMessage: String(messageText || "").trim(),
    recentMessages: Array.isArray(recentMessages)
      ? recentMessages
          .map((message) => String(message || "").trim())
          .filter(Boolean)
          .slice(0, 2)
      : [],
    time: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    timestamp: Date.now(),
  };
  recordDailyMutedUser(detailEntry, localDateKey(detailEntry.timestamp));

  if (existingIndex >= 0) {
    state.mutedUsersDetails[existingIndex] = detailEntry;
  } else {
    state.mutedUsersDetails.unshift(detailEntry);
    if (state.mutedUsersDetails.length > MAX_MUTED) {
      state.mutedUsersDetails.splice(MAX_MUTED);
    }
  }

  saveToGlobalHistory();
  requestUIRefresh(UI_REFRESH.MUTED_USERS);
}

async function performModeration(messageElement, username, messageText, log) {
  const finish = (status, detail) => {
    if (messageElement) {
      messageElement.dataset.scmModerationStatus = status.toLowerCase();
    }
    updateModerationLog(log, status, detail);
    return status === "SUCESSO";
  };

  try {
    if (!messageElement?.isConnected) {
      return finish("FALHA", "A mensagem saiu do chat antes da tentativa.");
    }

    const muteButton = messageElement.querySelector(".mute-button");
    if (!muteButton) {
      return finish("FALHA", "Botão de silenciar não estava disponível.");
    }

    if (muteButton.classList.contains("muted") || isUserAlreadyMuted(username)) {
      addMutedUser(username, messageText);
      return finish("SUCESSO", "O usuário já aparecia como silenciado.");
    }

    if (document.querySelector(".mute-confirmation-modal")) {
      const cleared = await waitForElementToDisappear(
        ".mute-confirmation-modal",
        document,
        MODAL_TIMEOUT_MS,
      );
      if (!cleared) {
        return finish("FALHA", "Já havia outro modal de silenciamento aberto.");
      }
      if (!messageElement?.isConnected) {
        return finish("FALHA", "A mensagem saiu do chat antes da tentativa.");
      }
      const refreshedMuteButton = messageElement.querySelector(".mute-button");
      if (
        refreshedMuteButton?.classList.contains("muted") ||
        isUserAlreadyMuted(username)
      ) {
        addMutedUser(username, messageText);
        return finish("SUCESSO", "O usuário já aparecia como silenciado.");
      }
    }

    const previousSystemMessages = new Set(
      document.querySelectorAll(".user-muted-message"),
    );
    muteButton.click();

    const modal = await waitForElement(
      ".mute-confirmation-modal",
      document,
      MODAL_TIMEOUT_MS,
    );
    if (!modal) return finish("FALHA", "O modal de confirmação não apareceu.");

    const confirmButton = modal.querySelector("button.ds-btn-accept");
    if (!confirmButton) {
      return finish(
        "FALHA",
        "O botão Silenciar não foi encontrado no modal correto.",
      );
    }

    confirmButton.click();

    const confirmed = await new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        const currentButton = messageElement.querySelector(".mute-button");
        if (currentButton?.classList.contains("muted")) return resolve(true);
        if (wasConfirmedBySystemMessage(username, previousSystemMessages)) {
          return resolve(true);
        }
        if (Date.now() - startedAt >= RESULT_TIMEOUT_MS) return resolve(false);
        setTimeout(check, POLL_INTERVAL_MS);
      };
      check();
    });

    if (confirmed) {
      addMutedUser(username, messageText);
      return finish("SUCESSO", "Silenciamento confirmado pelo Stripchat.");
    }
    return finish("FALHA", "O Stripchat não confirmou o silenciamento.");
  } catch (error) {
    console.error("[SC Monitor] Erro na moderação automática:", error);
    return finish(
      "FALHA",
      error?.message || "Erro inesperado durante a moderação.",
    );
  }
}

export function checkAndModerateMessage(messageElement, text, username) {
  if (!messageElement || !username) return Promise.resolve(false);

  const muteButton = messageElement.querySelector(".mute-button");
  if (!muteButton || muteButton.classList.contains("muted")) {
    return Promise.resolve(false);
  }

  if (messageElement.dataset.scmModerationStatus) return Promise.resolve(false);

  const normalizedMessage = normalizeText(text);
  const keywords = Array.isArray(state.moderationKeywords)
    ? state.moderationKeywords
    : [];

  const matchedKeyword = keywords.find((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return false;

    if (!normalizedKeyword.includes(" ") && normalizedKeyword.length <= 5) {
      try {
        const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, "i");
        return regex.test(normalizedMessage);
      } catch (e) {
        return normalizedMessage.includes(normalizedKeyword);
      }
    }

    return normalizedMessage.includes(normalizedKeyword);
  });

  if (!matchedKeyword) return Promise.resolve(false);

  messageElement.dataset.scmModerationStatus = "pending";
  const now = Date.now();
  const cleanUser = String(username).trim();
  const log = {
    id: `scm-mod-${now}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date(now).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    timestamp: now,
    user: cleanUser,
    message: String(text || "").trim(),
    keyword: String(matchedKeyword).trim(),
    status: "PENDENTE",
    detail: "Aguardando confirmação do Stripchat.",
    updatedAt: now,
  };
  saveModerationLog(log);

  const task = moderationQueue.then(() =>
    performModeration(messageElement, cleanUser, String(text || ""), log),
  );
  moderationQueue = task.catch(() => false);
  return task;
}