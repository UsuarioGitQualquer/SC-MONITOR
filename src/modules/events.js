import { num, time } from "../utils/helpers.js";
import {
  state,
  processedMessageIds,
  isIgnoredUser,
  userRecord,
  getMonitoring,
  recalculateTotalTokens,
  ensureDailyBucket,
  localDateKey,
  recordDailyKingChatTip,
  recordDailyLargestTip,
  recordDailyMutedUser,
} from "../core/state.js";
import { saveToGlobalHistory } from "../core/persistence.js";
import { autoAddTodo } from "./parsers.js";
import { checkAndModerateMessage, addMutedUser } from "./moderation.js";
import { requestUIRefresh, UI_REFRESH } from "../core/ui-refresh.js";

const TICKET_JOIN_CORRELATION_WINDOW_MS = 15000;

function normalizeTicketMessageText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTicketShowAnnouncementText(text) {
  const normalizedText = normalizeTicketMessageText(text);
  if (isTicketShowJoinText(normalizedText) || isTicketPurchaseText(normalizedText)) return false;
  return /\bticket show\b|\bshow\s+(?:de|por)\s+(?:tickets?|ingressos?|bilhetes?|entradas?|boletos?)\b/
    .test(normalizedText);
}

export function isTicketPurchaseText(text) {
  return /\b(?:comprou|compro|compra|bought|purchased)\s+(?:(?:o|el|un|una|a|the)\s+)?(?:ticket|ingresso|bilhete|boleto|entrada)\b|\b(?:got|received)\s+(?:(?:the|a)\s+)?(?:show\s+)?ticket\b/
    .test(normalizeTicketMessageText(text));
}

export function parseTicketPriceFromText(text) {
  const purchaseLabel =
    /\b(?:comprar|buy|purchase)\s+(?:(?:el|la|un|una|a|the)\s+)?(?:tickets?|ingressos?|bilhetes?|entradas?|boletos?)\b/;
  if (!purchaseLabel.test(normalizeTicketMessageText(text))) return 0;
  const match = String(text || "").match(/(\d+)\s*tk\b/i);
  return match ? Number(match[1]) || 0 : 0;
}

export function isTicketShowJoinText(text) {
  const normalizedText = normalizeTicketMessageText(text);
  return /\bentrou no show por (?:ingressos?|bilhetes?|tickets?)\b|\bse (?:ha )?uni(?:o|d[oa]) (?:al|a un) (?:ticket )?show\b|\b(?:recibio|recibiste)\s+(?:el\s+)?ticket\s+(?:de|del|para el)\s+show\b|\b(?:received|got)\s+(?:the\s+)?ticket\s+(?:for|from)\s+(?:the\s+)?show\b|\bjoined (?:the )?(?:ticket )?show\b/
    .test(normalizedText);
}

export function isTipMessage(el) {
  const text = String(el?.textContent || "");
  return (
    String(el?.className || "").includes("TipMessage") ||
    Boolean(el?.querySelector?.("[class*='TipMessage__amountHighlight']")) ||
    /deu uma gorjeta de|deu gorjeta de|\b(?:ha dado|dio)\s+\d+\s*tk\b/i.test(text)
  );
}

export function isTipMenuMessage(text) {
  const normalizedText = normalizeTicketMessageText(text);
  return /\bmenu de (?:gorjetas|propinas)\b|\btip menu\b|\bmenu tip\b/.test(normalizedText);
}

export function parseTipMenuOption(text) {
  const rawText = String(text || "").replace(/\s+/g, " ").trim();
  const match = rawText.match(
    /(?:men[uú]\s+de\s+(?:gorjetas|propinas)|tip\s+menu|menu\s+tip)(?:\s*[>:›»→\-–—]\s*)?/i,
  );
  if (!match) return rawText;
  const optionStart = match.index + match[0].length;
  return rawText
    .slice(optionStart)
    .replace(/^[\s>:›»→\-–—]+/, "")
    .trim();
}

export function parseTicketShowJoinUsername(text) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  const match = normalizedText.match(
    /^(.+?)\s+(?:se\s+(?:ha\s+)?(?:unio|unió|unido|unida)\s+(?:al|a un)\s+(?:ticket\s+)?show|(?:recibio|recibió|recibiste)\s+(?:el\s+)?ticket\s+(?:de|del|para el)\s+show|(?:received|got)\s+(?:the\s+)?ticket\s+(?:for|from)\s+(?:the\s+)?show|entrou no show por (?:ingressos?|bilhetes?|tickets?)|joined (?:the )?(?:ticket )?show)\b/i,
  );
  return match ? cleanUsername(match[1]) : "";
}

export function isPendingTicketShowTip(user, now = Date.now()) {
  const joinedAt = Number(user?._ticketShowJoinedAt) || 0;
  const elapsed = Number(now) - joinedAt;
  return joinedAt > 0 && elapsed >= 0 && elapsed <= TICKET_JOIN_CORRELATION_WINDOW_MS;
}

function isPendingTicketPurchaseTip(user, now = Date.now()) {
  const purchasedAt = Number(user?._ticketPurchaseAt) || 0;
  const elapsed = Number(now) - purchasedAt;
  return purchasedAt > 0 && elapsed >= 0 && elapsed <= TICKET_JOIN_CORRELATION_WINDOW_MS;
}

export function isTicketTip({
  user,
  ticketPrice,
  tipAmount,
  hasTicketDOM,
  messageText,
  now = Date.now(),
}) {
  const knownTicketPrice = Number(ticketPrice) || 0;
  const amount = Number(tipAmount) || 0;
  return (
    Boolean(hasTicketDOM) ||
    isTicketPurchaseText(messageText) ||
    (knownTicketPrice > 0 && amount === knownTicketPrice) ||
    isPendingTicketPurchaseTip(user, now) ||
    (knownTicketPrice <= 0 && isPendingTicketShowTip(user, now))
  );
}

export function isRecentTicketTipEvent(event, username, now = Date.now()) {
  const timestamp = Number(event?.timestamp) || 0;
  const elapsed = Number(now) - timestamp;
  return (
    String(event?.user || "").toLowerCase() === String(username || "").toLowerCase() &&
    event.type === "Gorjeta Avulsa" &&
    timestamp > 0 &&
    elapsed >= 0 &&
    elapsed <= TICKET_JOIN_CORRELATION_WINDOW_MS
  );
}

function getSummaryKey(item, type, menuOption = "", rouletteOutcome = "") {
  const label = String(menuOption || item || "—").trim();
  const typeText = String(type || "").toLowerCase();
  const combined = `${typeText} ${label}`.toLowerCase();
  if (/menu|tip menu/.test(typeText) || /menu de gorjetas|tip menu|menu tip/i.test(label)) {
    const optionMatch = label.match(
      /^(?:men[uú]\s+de\s+(?:gorjetas|propinas)|tip\s+menu|menu\s+tip)\s*[:>›»→\-–—]\s*(.+)$/i,
    );
    const menuItem = optionMatch ? optionMatch[1].trim() : label;
    if (/^(?:men[uú](?:\s+de\s+(?:gorjetas|propinas))?|tip\s+menu|menu\s+tip|gorjeta\s+avulsa|—)$/i.test(menuItem)) {
      return "Menu";
    }
    return menuItem;
  }
  if (/roleta|roulette|wheel|spin/i.test(typeText) || rouletteOutcome) {
    const outcome = String(rouletteOutcome || label)
      .replace(/^(?:roleta|roulette|wheel|spin)\s*[:>›»→\-–—]\s*/i, "")
      .trim();
    if (/^(?:roleta|roulette|wheel|spin|resultado da roleta|—)$/i.test(outcome)) return "Roleta";
    return outcome;
  }
  if (/ingresso|ticket/i.test(combined)) return "Ticket";
  if (/show em grupo|grupo/i.test(combined)) return "Show em Grupo";
  if (/show privado|privado/i.test(combined)) return "Show Privado";
  if (/show exclusivo|exclusivo/i.test(combined)) return "Show Exclusivo";
  if (/gorjeta avulsa/i.test(combined)) return "Gorjeta Avulsa";
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Geral";
}

function cleanUsername(rawName) {
  if (!rawName) return "Usuário";

  let cleaned = String(rawName)
    .replace(/[()]/g, " ")
    .replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, " ")
    .trim();

  if (!cleaned) return "Usuário";

  cleaned = cleaned.replace(/^(\S+)(?:\s+\1)+$/i, "$1");

  return cleaned || "Usuário";
}

function addNamedEventTotal(bucket, field, name, amount) {
  const label = String(name || "").trim();
  if (!label || !bucket) return;
  if (!bucket[field] || typeof bucket[field] !== "object") bucket[field] = {};
  const existingKey = Object.keys(bucket[field]).find(
    (key) => key.toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  const key = existingKey || label;
  const total = bucket[field][key] || { label, count: 0, tokens: 0 };
  total.count = (Number(total.count) || 0) + 1;
  total.tokens = (Number(total.tokens) || 0) + Math.max(0, Number(amount) || 0);
  bucket[field][key] = total;
}

function adjustSummaryForReclassification(event, nextType, nextItem) {
  if (!event || !state.eventSummaryTotals) return;
  const amount = Number(event.price || event.tokens) || 0;
  if (amount <= 0) return;
  const oldKey = getSummaryKey(
    event.item,
    event.type,
    event.menuOption,
    event.rouletteOutcome,
  );
  const newKey = getSummaryKey(nextItem, nextType);
  if (oldKey === newKey) return;
  const oldEntry = state.eventSummaryTotals[oldKey];
  if (oldEntry) {
    oldEntry.count = Math.max(0, (Number(oldEntry.count) || 0) - 1);
    oldEntry.tokens = Math.max(0, (Number(oldEntry.tokens) || 0) - amount);
    if (!oldEntry.count) delete state.eventSummaryTotals[oldKey];
  }
  if (!state.eventSummaryTotals[newKey]) {
    state.eventSummaryTotals[newKey] = { count: 0, tokens: 0, type: nextType || "Geral" };
  }
  state.eventSummaryTotals[newKey].count += 1;
  state.eventSummaryTotals[newKey].tokens += amount;
  ensureDailyBucket(localDateKey()).eventSummaryTotals =
    JSON.parse(JSON.stringify(state.eventSummaryTotals));
}

function reclassifyRecentTicketTip(username, now) {
  const capturedEvent = [...(state.capturedEvents || [])]
    .reverse()
    .find((event) => isRecentTicketTipEvent(event, username, now));
  const generalEvent = [...(state.events || [])]
    .reverse()
    .find((event) => isRecentTicketTipEvent(event, username, now));
  const summaryEvent = capturedEvent || generalEvent;
  if (!summaryEvent) return false;

  const nextItem = `Compra de Ingresso (${username})`;
  adjustSummaryForReclassification(summaryEvent, "Ingresso Ticket", nextItem);
  [capturedEvent, generalEvent].filter(Boolean).forEach((event) => {
    event.type = "Ingresso Ticket";
    event.item = nextItem;
  });

  if (!Number(state.currentTicketPrice)) {
    state.currentTicketPrice =
      Number(summaryEvent.price) || Number(summaryEvent.tokens) || 0;
  }
  return true;
}

let fallbackMessageSequence = 0;
let lastTicketPurchaseAt = 0;

export function recordTicketPurchaseActivity(timestamp = Date.now()) {
  const parsedTimestamp = Number(timestamp);
  if (Number.isFinite(parsedTimestamp) && parsedTimestamp > 0) {
    lastTicketPurchaseAt = parsedTimestamp;
  }
}

export function hasRecentTicketPurchase(now = Date.now(), windowMs = 15000) {
  const elapsed = Number(now) - lastTicketPurchaseAt;
  return lastTicketPurchaseAt > 0 && elapsed >= 0 && elapsed < windowMs;
}

function markMessageProcessed(el, msgId) {
  if (msgId) processedMessageIds.add(msgId);
  if (el?.dataset && msgId) el.dataset.scmSeen = msgId;
}

export function checkActiveCamTicketPrice() {
  state.currentTicketPrice = 0;
  const camButtons = document.querySelectorAll(
    '.ViewCamGroup__wrapper button, [class*="ViewCamGroup"] button, [class*="ShutterButton"], button'
  );
  for (const btn of camButtons) {
    const text = (btn.textContent || "").trim();
    const ticketPrice = parseTicketPriceFromText(text);
    if (ticketPrice > 0) {
      state.currentTicketPrice = ticketPrice;
      return;
    }
  }
}

export function getMessageId(el) {
  if (!el) return null;

  const nativeId =
    el.getAttribute?.("data-message-id") || el.dataset?.messageId;
  if (nativeId) return String(nativeId);
  if (el.dataset?.scmId) return String(el.dataset.scmId);

  fallbackMessageSequence++;
  const generatedId = `scm-${Date.now()}-${fallbackMessageSequence}`;
  if (el.dataset) el.dataset.scmId = generatedId;
  return generatedId;
}

export function registerCapturedEvent(item, price, type, messageId, username, details = {}) {
  if (!messageId) return;

  const itemPrice = Number(price);
  if (!Number.isFinite(itemPrice) || itemPrice < 0) return;

  const cleanUser = cleanUsername(username);
  let finalItem = item || "—";
  if (/ingresso|ticket/i.test(String(type)) || /compra de ingresso/i.test(String(finalItem))) {
    finalItem = `Compra de Ingresso (${cleanUser})`;
  }

  const todayBucket = ensureDailyBucket(localDateKey());
  if (!Array.isArray(todayBucket.capturedEvents)) todayBucket.capturedEvents = [];
  state.capturedEvents = todayBucket.capturedEvents;

  const exists = state.capturedEvents.some((e) => e.id === messageId);
  if (!exists) {
    const capturedEvent = {
      id: messageId,
      item: finalItem,
      price: itemPrice,
      type,
      user: cleanUser,
      timestamp: Date.now(),
      ...details,
    };
    state.capturedEvents.push(capturedEvent);
    if (state.capturedEvents.length > 500) state.capturedEvents.shift();

    recordDailyLargestTip(capturedEvent, localDateKey(capturedEvent.timestamp));
    if (!todayBucket.capturedEvents.some((event) => event?.id === messageId)) {
      todayBucket.capturedEvents.push(capturedEvent);
      if (todayBucket.capturedEvents.length > 500) todayBucket.capturedEvents.shift();
    }
    if (details.menuOption) {
      addNamedEventTotal(todayBucket, "menuOptionTotals", details.menuOption, itemPrice);
    }
    if (details.rouletteOutcome) {
      addNamedEventTotal(todayBucket, "rouletteOutcomeTotals", details.rouletteOutcome, itemPrice);
    }
    const currentSegment = todayBucket.liveSessions?.[state.sessionId];
    if (currentSegment) {
      if (!Array.isArray(currentSegment.capturedEvents)) currentSegment.capturedEvents = [];
      if (!currentSegment.capturedEvents.some((event) => event?.id === messageId)) {
        currentSegment.capturedEvents.push(capturedEvent);
        if (currentSegment.capturedEvents.length > 500) currentSegment.capturedEvents.shift();
      }
    }

    const isGoal = (text, typeText) => {
      const combined = `${String(text || "")} ${String(typeText || "")}`.toLowerCase();
      if (/epic|épico/i.test(combined)) return false;
      return /meta|goal|target|objetivo|progresso/i.test(combined);
    };

    if (!isGoal(finalItem, type) && itemPrice > 0) {
      if (!state.eventSummaryTotals || typeof state.eventSummaryTotals !== "object") {
        state.eventSummaryTotals = {};
      }

      const summaryKey = getSummaryKey(
        finalItem,
        type,
        details.menuOption,
        details.rouletteOutcome,
      );

      if (!state.eventSummaryTotals[summaryKey]) {
        state.eventSummaryTotals[summaryKey] = { count: 0, tokens: 0, type: type || "Geral" };
      }
      state.eventSummaryTotals[summaryKey].count += 1;
      state.eventSummaryTotals[summaryKey].tokens += itemPrice;
      const todayBucket = ensureDailyBucket(localDateKey());
      todayBucket.eventSummaryTotals = JSON.parse(JSON.stringify(state.eventSummaryTotals));
    }
  }
}

function normalizeFanClubTier(rawTier) {
  const normalized = String(rawTier || "soldado")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

  if (normalized === "lord" || normalized === "duque") {
    return { key: "lord", label: normalized === "duque" ? "Duque" : "Lord" };
  }
  if (normalized.startsWith("prin")) {
    return { key: "principe", label: "Príncipe" };
  }
  return { key: "soldado", label: "Soldado" };
}

function extractModerationText(messageElement) {
  const source =
    messageElement.querySelector(
      ".message-body, .message-text, .user-message-text, [class*='messageBody'], [class*='messageText']"
    ) || messageElement;
  const clone = source.cloneNode(true);
  clone
    .querySelectorAll(
      ".message-username, .username, .user-levels-username-text, .user-level-badge, .message-more-menu, .mute-button, time, [class*='timestamp']"
    )
    .forEach((node) => node.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function rememberProcessedMessage(user, msgId, maxSize = 2000) {
  if (!Array.isArray(user._processedMsgs)) {
    user._processedMsgs = [];
  }
  if (user._processedMsgs.includes(msgId)) {
    return false;
  }
  user._processedMsgs.push(msgId);
  if (user._processedMsgs.length > maxSize) {
    user._processedMsgs.splice(0, user._processedMsgs.length - maxSize);
  }
  return true;
}

function isSystemGoalOrLovenseElement(el) {
  if (!el) return false;
  if (
    el.matches?.(".user-muted-message") ||
    el.querySelector?.(".user-muted-message")
  ) {
    return false;
  }

  const classList = el.classList;
  if (
    classList?.contains("animated-lovense-tip-message") ||
    classList?.contains("GoalUpdatedMessage") ||
    classList?.contains("ActionMessage") ||
    classList?.contains("new-king-message") ||
    classList?.contains("m-bg-public-tip") ||
    classList?.contains("m-bg-action") ||
    classList?.contains("m-bg-system")
  ) {
    return true;
  }
  return Boolean(
    el.querySelector?.(
      ".animated-lovense-tip-message, .GoalUpdatedMessage, [class*='GoalUpdatedMessage'], [class*='animated-lovense-tip']"
    )
  );
}

function isContentPurchaseMessage(el) {
  return Boolean(
    el?.classList?.contains("user-bought-content-message") ||
    /acabou de comprar/i.test(String(el?.textContent || "")),
  );
}

function isTicketPurchaseMessage(el) {
  return Boolean(
    el?.querySelector?.("[class*='TicketShowGotTicket']") ||
    isTicketPurchaseText(el?.textContent),
  );
}

export function shouldIgnoreSystemMessage(el) {
  return (
    isSystemGoalOrLovenseElement(el) &&
    !isContentPurchaseMessage(el) &&
    !isTicketPurchaseMessage(el) &&
    !isTicketShowJoinText(el?.textContent)
  );
}

function isValidChatMessage(text) {
  if (!text || text === "—" || text.length <= 1) return false;
  const lower = String(text).toLowerCase();
  return !(
    lower.includes("vibração") ||
    lower.includes("compra de ingresso") ||
    lower.includes("ingresso") ||
    lower.includes("gorjeta") ||
    lower.includes("fã-clube") ||
    lower.includes("entrou no") ||
    lower.includes("foi silenciado") ||
    /^[_.\-\s]+$/.test(text)
  );
}

function extractRecentMessagesForUser(mutedName) {
  if (!mutedName) return [];
  const lowerTarget = mutedName.toLowerCase();

  const userObj = state.users
    ? Object.values(state.users).find((u) => u && String(u.name || "").toLowerCase() === lowerTarget)
    : null;

  const collected = [];
  const domMessages = [];
  document.querySelectorAll(".messages-v2 .message-base, .message").forEach((messageElement) => {
    if (
      messageElement.matches(".user-muted-message") ||
      /foi silenciado/i.test(messageElement.textContent || "")
    ) {
      return;
    }

    const nameEl = messageElement.querySelector(
      ".user-levels-username-text, .TipMessage__username, .PluginMessage__username, .message-username, .user-name-card-wrapper-text, .view-cam-username, .user"
    );
    const name = cleanUsername(nameEl?.textContent || "");
    if (name.toLowerCase() !== lowerTarget) return;

    const messageText = extractModerationText(messageElement);
    if (isValidChatMessage(messageText) && !domMessages.includes(messageText)) {
      domMessages.push(messageText);
    }
  });

  domMessages.slice(-2).reverse().forEach((message) => {
    if (!collected.includes(message)) collected.push(message);
  });

  if (Array.isArray(userObj?._recentMessages)) {
    userObj._recentMessages.forEach((m) => {
      if (isValidChatMessage(m) && !collected.includes(m)) collected.push(m);
    });
  }
  if (userObj && isValidChatMessage(userObj.lastMessage)) {
    if (!collected.includes(userObj.lastMessage)) collected.push(userObj.lastMessage);
  }

  for (let i = (state.events || []).length - 1; i >= 0 && collected.length < 2; i--) {
    const ev = state.events[i];
    if (
      ev?.user &&
      String(ev.user).toLowerCase() === lowerTarget &&
      isValidChatMessage(ev.item) &&
      !collected.includes(ev.item)
    ) {
      collected.push(ev.item);
    }
  }

  const deduped = [];
  for (const item of collected) {
    const normalized = String(item).trim();
    if (normalized && !deduped.includes(normalized)) {
      deduped.push(normalized);
    }
    if (deduped.length >= 2) break;
  }
  return deduped;
}

export function processMessage(
  el,
  {
    ignoreTicketPriceAnnouncement = false,
    ignoreTicketPurchaseCorrelation = false,
  } = {},
) {
  if (!el) return;

  if (
    el.closest?.(
      '.private-message, .whisper, .im-chat, [class*="private"], [class*="whisper"]',
    ) ||
    el.classList?.contains("invisible-mode-message")
  ) {
    return;
  }

  if (!String(el.textContent || "").trim()) return;

  const msgId = getMessageId(el);
  if (processedMessageIds.has(msgId) || el.dataset?.scmSeen === msgId) return;

  if (shouldIgnoreSystemMessage(el)) return;

  if (
    el.classList?.contains("TicketShowAnnouncedBaseMessage") ||
    el.querySelector("[class*='TicketShowAnnounced']") ||
    isTicketShowAnnouncementText(el.textContent)
  ) {
    markMessageProcessed(el, msgId);

    const priceEl = el.querySelector("[class*='TicketShowAnnouncedBaseMessage__highlight'], [class*='TicketShowAnnouncedBaseMessage__button'], button");
    const priceMatch = (priceEl?.textContent || "").match(/(\d+)\s*tk/i) || (el.textContent || "").match(/(\d+)\s*tk/i);

    if (priceMatch && !ignoreTicketPriceAnnouncement) {
      state.currentTicketPrice = Number(priceMatch[1]);
    }
    return;
  }

  const rawElText = (el.textContent || "").replace(/\s+/g, " ").trim();
  const isMutedMessage =
    el.matches?.(".user-muted-message") ||
    el.classList?.contains("user-muted-message") ||
    Boolean(el.querySelector(".user-muted-message, [class*='mutedUser']")) ||
    /foi silenciado/i.test(rawElText);

  if (isMutedMessage) {
    const exactUsernames = Array.from(
      el.querySelectorAll(
        ".user-levels-username-text, .user-levels-username-chat-owner, .user-name-card-wrapper-text"
      )
    )
      .map((node) => cleanUsername(node.textContent))
      .filter(Boolean);

    let mutedName = exactUsernames[0] || "";
    let mutedBy = exactUsernames[1] || "";

    const mutedPatterns = [
      /^([^\n]+?)\s+foi silenciado(?:\s+por\s+|\s+pela\s+|\s+pelo\s+)(.+)$/i,
      /^([^\n]+?)\s+foi\s+mutado(?:\s+por\s+|\s+pela\s+|\s+pelo\s+)(.+)$/i,
      /^([^\n]+?)\s+was muted by\s+(.+)$/i,
    ];
    for (const pattern of mutedPatterns) {
      const matchText = rawElText.match(pattern);
      if (matchText) {
        mutedName = cleanUsername(matchText[1]);
        mutedBy = cleanUsername(matchText[2]);
        break;
      }
    }

    if (!mutedName) {
      const matchText = rawElText.match(/^([^\s]+)\s+foi silenciado(?:\s+(?:pelo site|por|pela modelo)\s*([^\s]+))?/i);
      if (matchText) {
        mutedName = cleanUsername(matchText[1]);
        if (matchText[2]) mutedBy = cleanUsername(matchText[2]);
      }
    }

    if (!mutedBy) {
      const ownerNode = el.querySelector(".user-levels-username-chat-owner, [class*='chat-owner']");
      if (ownerNode) {
        mutedBy = cleanUsername(ownerNode.textContent);
      }
    }

    mutedBy = mutedBy.replace(/^site\s+/i, "").trim();

    if (!mutedBy || mutedBy.toLowerCase() === mutedName.toLowerCase()) {
      mutedBy = "Moderador / Modelo / Sistema";
    }

    const recentMsgs = extractRecentMessagesForUser(mutedName);
    const lastMsg = recentMsgs[0] || "—";

    if (mutedName && !isIgnoredUser(mutedName)) {
      if (!Array.isArray(state.mutedUsers)) state.mutedUsers = [];
      if (!state.mutedUsers.some((item) => String(item).toLowerCase() === mutedName.toLowerCase())) {
        state.mutedUsers.push(mutedName);
      }

      if (!Array.isArray(state.mutedUsersDetails)) state.mutedUsersDetails = [];

      const existingIndex = state.mutedUsersDetails.findIndex(
        (m) =>
          String(m.username || "").toLowerCase() === mutedName.toLowerCase(),
      );

      if (existingIndex >= 0) {
        state.mutedUsersDetails[existingIndex] = {
          ...state.mutedUsersDetails[existingIndex],
          username: mutedName,
          mutedBy,
          lastMessage: lastMsg,
          recentMessages: recentMsgs,
          time: time(),
          timestamp: Date.now(),
          _timestamp: Date.now(),
        };
      } else {
        state.mutedUsersDetails.push({
          username: mutedName,
          mutedBy,
          lastMessage: lastMsg,
          recentMessages: recentMsgs,
          time: time(),
          _timestamp: Date.now(),
        });
        if (state.mutedUsersDetails.length > 300) state.mutedUsersDetails.shift();
      }

      const mutedDetail = state.mutedUsersDetails.find(
        (entry) => String(entry?.username || "").toLowerCase() === mutedName.toLowerCase(),
      );
      if (mutedDetail) recordDailyMutedUser(mutedDetail);
      saveToGlobalHistory();
      requestUIRefresh(UI_REFRESH.MUTED_USERS);
    }

    markMessageProcessed(el, msgId);
    return;
  }

  const nameEl = el.querySelector(
    ".user-levels-username-text, .TipMessage__username, .PluginMessage__username, .message-username, .user-name-card-wrapper-text, .view-cam-username, .user"
  );
  const rawName = (nameEl?.textContent || "").replace(/\s+/g, " ").trim();
  const name = cleanUsername(rawName);

  if (isIgnoredUser(name)) return;

  const muteButton = el.querySelector(".mute-button");
  if (muteButton?.classList.contains("muted")) {
    const recentMessages = extractRecentMessagesForUser(name);
    addMutedUser(
      name,
      recentMessages[0] || "",
      "Modelo / Cavaleiro",
      recentMessages,
    );
  }

  const isTipMsg = isTipMessage(el);
  const classString = String(el.className || "");
  const isPluginMsg =
    classString.includes("PluginMessage") ||
    Boolean(el.querySelector?.("[class*='PluginMessage']"));

  const messageText = extractModerationText(el);

  checkAndModerateMessage(el, messageText, name);

  if (isTipMsg) {
    const amountEl = el.querySelector(
      "[class*='amountHighlight'], .TipMessage__amountHighlight",
    );
    let amount = num((amountEl?.textContent || "").replace(/\s+/g, " ").trim());

    const u = userRecord(name);
    if (u) {
      if (
        u._lastPluginAction &&
        u._lastPluginTime &&
        Date.now() - u._lastPluginTime < 10000
      ) {
        const lastEvt = [...state.capturedEvents]
          .reverse()
          .find(
            (e) =>
              e.user === name &&
              Number(e.price) === 0 &&
              Number(e.timestamp) > 0 &&
              Date.now() - Number(e.timestamp) < 10000,
          );
        if (lastEvt) {
          lastEvt.price = amount;
          lastEvt.item = `${u._lastPluginAction} (${amount} tk)`;

          if (!state.eventSummaryTotals || typeof state.eventSummaryTotals !== "object") {
            state.eventSummaryTotals = {};
          }
          const summaryKey = getSummaryKey(
            lastEvt.item,
            lastEvt.type,
            lastEvt.menuOption,
            lastEvt.rouletteOutcome,
          );
          if (!state.eventSummaryTotals[summaryKey]) {
            state.eventSummaryTotals[summaryKey] = { count: 0, tokens: 0, type: lastEvt.type || "Geral" };
          }
          state.eventSummaryTotals[summaryKey].count += 1;
          state.eventSummaryTotals[summaryKey].tokens += amount;
          ensureDailyBucket(localDateKey()).eventSummaryTotals =
            JSON.parse(JSON.stringify(state.eventSummaryTotals));
        }

        const generalEvt = [...state.events]
          .reverse()
          .find(
            (e) =>
              e.user === name &&
              e.tokens === 0 &&
              e.type.includes("Plugin") &&
              Number(e.timestamp) > 0 &&
              Date.now() - Number(e.timestamp) < 10000,
          );
        if (generalEvt) {
          generalEvt.tokens = amount;
          generalEvt.item = `${u._lastPluginAction} (${amount} tk)`;
        }

        u._lastPluginAction = null;
        u._lastPluginTime = null;

        if (rememberProcessedMessage(u, msgId)) {
          if (getMonitoring()) {
            u.tokens += amount;
            u.tips += 1;
            recordDailyKingChatTip(name, amount);
            recalculateTotalTokens();
          }
          u._lastTipTimestamp = Date.now();
        }
        markMessageProcessed(el, msgId);
        return;
      }
    }

    if (amount === null || isNaN(amount)) {
      const match = (el.textContent || "").replace(/\s+/g, " ").trim().match(/(\d+)\s*tk/i);
      if (match) amount = Number(match[1]);
    }

    if (amount !== null && amount > 0) {
      markMessageProcessed(el, msgId);

      const commentEl = el.querySelector("[class*='commentBody'], .TipMessage__commentBody");
      let commentBody = (commentEl?.textContent || "").replace(/\s+/g, " ").trim();
      if (!commentBody) commentBody = "Gorjeta Avulsa";

      let eventType = "Gorjeta Avulsa";
      const fullElText = (el.textContent || "").toLowerCase();
      const currentTicketPrice = Number(state.currentTicketPrice) || 0;
      const tipAmount = Number(amount) || 0;

      const hasTicketDOM = Boolean(
        el.querySelector("[class*='ticket'], [class*='Ticket'], [class*='TicketShowGotTicket']"),
      );
      const hasTipMenu = Boolean(
        el.querySelector(
          "[class*='TipMessage__commentTipMenu'], [class*='tipMenuLink']",
        ) ||
        isTipMenuMessage(fullElText)
      );

      if (hasTipMenu) {
        eventType = "Menu de Gorjetas";
      } else if (
        isTicketTip({
          user: u,
          ticketPrice: currentTicketPrice,
          tipAmount,
          hasTicketDOM,
          messageText: fullElText,
        })
      ) {
        eventType = "Ingresso Ticket";
        commentBody = `Compra de Ingresso (${name})`;
        if (!currentTicketPrice) state.currentTicketPrice = tipAmount;
        if (u) {
          u._hasTicket = true;
          u._ticketShowJoinedAt = 0;
          u._ticketPurchaseAt = 0;
        }
      } else if (
        el.querySelector(
          "[class*='TipMessage__commentEpicGoal'], [class*='epicGoalLink']",
        ) ||
        fullElText.includes("objetivo épico")
      ) {
        eventType = "Objetivo Épico";
      }

      if (u) {
        if (rememberProcessedMessage(u, msgId)) {
          if (getMonitoring()) {
            u.tokens += amount;
            u.tips += 1;
            recordDailyKingChatTip(name, amount);
          }
          u._lastTipTimestamp = Date.now();
        }

        u.lastSeen = time();
        if (!u.firstTipAt) u.firstTipAt = time();

        if (getMonitoring()) {
          recalculateTotalTokens();
        }

        u._lastTipAmount = amount;
        u._lastTipTime = Date.now();

        const menuOptionElement = el.querySelector(
          "[class*='commentTipMenu'], [class*='tipMenuLink']",
        );
        const menuSource =
          menuOptionElement?.textContent ||
          (commentBody === "Gorjeta Avulsa" ? rawElText : commentBody);
        const menuOption = eventType === "Menu de Gorjetas"
          ? parseTipMenuOption(menuSource)
          : "";
        if (
          eventType === "Menu de Gorjetas" &&
          (commentBody === "Gorjeta Avulsa" || isTipMenuMessage(commentBody))
        ) {
          commentBody = menuOption || "Menu de Gorjetas";
        }
        registerCapturedEvent(commentBody, amount, eventType, msgId, name, {
          menuOption:
            menuOption &&
            !/^(gorjeta avulsa|menu de gorjetas|menú de propinas|tip menu|menu)$/i.test(menuOption)
              ? menuOption
              : "",
        });
        state.events.push({
          time: time(),
          timestamp: Date.now(),
          type: eventType,
          user: name,
          tokens: amount,
          item: commentBody,
        });

        if (
          eventType === "Menu de Gorjetas" ||
          eventType === "Objetivo Épico"
        ) {
          autoAddTodo(commentBody, amount, eventType, name);
        }
      }
    }
  } else if (isPluginMsg) {
    const fullText = (el.textContent || "").replace(/\s+/g, " ").trim();

    if (/is spinning/i.test(fullText)) {
      markMessageProcessed(el, msgId);
      return;
    }

    markMessageProcessed(el, msgId);

    const pluginNameEl = el.querySelector("button, [class*='HighlightButton'], a");
    const pluginName = (pluginNameEl?.textContent || "").replace(/\s+/g, " ").trim() || "Plugin";
    const prizeEl = el.querySelector(
      "[class*='PluginMessage__accent'], .PluginMessage__accent",
    );
    const prizeText = (prizeEl?.textContent || "").replace(/\s+/g, " ").trim();

    const isBattleship =
      /battleship/i.test(pluginName) || /battleship/i.test(fullText);

    let eventType = isBattleship
      ? "Battleship"
      : prizeText || /won/i.test(fullText)
        ? "Resultado da Roleta"
        : "Ação de Plugin";

    let fullDetail = "";
    let pluginPrice = 0;

    if (isBattleship || prizeText || /won/i.test(fullText)) {
      const matchTk = fullText.match(/(\d+)\s*tk/i);
      if (matchTk) {
        pluginPrice = Number(matchTk[1]);
      } else {
        const u = userRecord(name);
        if (
          u &&
          u._lastTipAmount &&
          Date.now() - (u._lastTipTime || 0) < 15000
        ) {
          pluginPrice = u._lastTipAmount;
        }
      }

      fullDetail = isBattleship
        ? `Ação Battleship (${pluginPrice > 0 ? pluginPrice + ' tk' : '0 tk'})`
        : (prizeText ? `${pluginName}: ${prizeText}` : fullText);

      const isRoulette = /roleta|roulette|wheel|spin/i.test(`${pluginName} ${fullText} ${eventType}`);
      registerCapturedEvent(fullDetail, pluginPrice, eventType, msgId, name, {
        rouletteOutcome: isRoulette ? (prizeText || fullDetail) : "",
      });
      state.events.push({
        time: time(),
        timestamp: Date.now(),
        type: eventType,
        user: name,
        tokens: pluginPrice,
        item: fullDetail,
      });

      if (!isBattleship && pluginPrice > 0) {
        autoAddTodo(fullDetail, pluginPrice, pluginName, name);
      }
    } else {
      fullDetail = `Ação ${pluginName}`.replace(/\s+/g, " ").trim();

      const u = userRecord(name);
      if (u) {
        u.lastSeen = time();
        u._lastPluginAction = fullDetail;
        u._lastPluginType = eventType;
        u._lastPluginTime = Date.now();

        registerCapturedEvent(fullDetail, 0, eventType, msgId, name);
        state.events.push({
          time: time(),
          timestamp: Date.now(),
          type: eventType,
          user: name,
          tokens: 0,
          item: fullDetail,
        });
      }
    }
  } else if (isContentPurchaseMessage(el)) {
    markMessageProcessed(el, msgId);

    const strongVal = num((el.querySelector("strong")?.textContent || "").replace(/\s+/g, " ").trim());
    const amount = strongVal !== null ? strongVal : 1;
    const u = userRecord(name);
    if (u) {
      if (rememberProcessedMessage(u, msgId)) {
        if (getMonitoring()) {
          u.tokens += amount;
          u.tips += 1;
        }
        u._lastTipTimestamp = Date.now();
      }

      u.lastSeen = time();
      if (!u.firstTipAt) u.firstTipAt = time();
      if (getMonitoring()) {
        recalculateTotalTokens();
      }

      const contentEl = el.querySelector(
        "a.section-link, [class*='sectionLink'], [class*='title']",
      );
      const contentName =
        (contentEl?.textContent || "").replace(/\s+/g, " ").trim() || "Vídeo / Mídia";
      const timestamp = Date.now();
      registerCapturedEvent(
        contentName,
        amount,
        "Compra de Conteúdo",
        msgId,
        name,
      );
      state.events.push({
        time: time(),
        timestamp,
        type: "Compra de Conteúdo",
        user: name,
        tokens: amount,
        item: contentName,
      });
    }
  } else if (
    isTicketPurchaseMessage(el)
  ) {
    markMessageProcessed(el, msgId);
    recordTicketPurchaseActivity();

    let username = parseTicketShowJoinUsername(rawElText) || name;
    if (!username || username === "Usuário") {
      const uEl = el.querySelector(
        ".user-levels-username-text, .user-name-card-wrapper-text, .username-text, .username, [class*='username']"
      );
      if (uEl) username = cleanUsername((uEl.textContent || "").replace(/\s+/g, " ").trim());
    }
    if (!username || username === "Usuário") {
      const matchName = (el.textContent || "").replace(/\s+/g, " ").trim().match(/^([^\s]+)\s+comprou o ingresso/i);
      if (matchName) username = cleanUsername(matchName[1]);
    }
    username = username || "Usuário";

    const u = userRecord(username);
    if (u) {
      u._hasTicket = true;
      if (!ignoreTicketPurchaseCorrelation) {
        const purchasedAt = Date.now();
        u._ticketShowJoinedAt = purchasedAt;
        u._ticketPurchaseAt = purchasedAt;
        if (reclassifyRecentTicketTip(username, purchasedAt)) {
          u._ticketShowJoinedAt = 0;
          u._ticketPurchaseAt = 0;
          saveToGlobalHistory();
          requestUIRefresh(UI_REFRESH.EVENTS);
        }
      }
    }
    return;
  } else if (
    el.classList?.contains("user-joined-fan-club-message") ||
    (el.textContent.includes("entrou no") &&
      (el.textContent.includes("fã-clube") ||
        el.textContent.includes("fa-clube")))
  ) {
    markMessageProcessed(el, msgId);

    let username = name;
    if (!username || username === "Usuário") {
      const matchName = (el.textContent || "").replace(/\s+/g, " ").trim().match(/^([^\s]+)\s+entrou no/i);
      if (matchName) username = cleanUsername(matchName[1]);
    }

    if (!username || isIgnoredUser(username)) return;

    const fullElText = (el.textContent || "").replace(/\s+/g, " ").trim();
    const tierMatch = fullElText.match(/como\s+([^\s!]+)/i);
    const tierInfo = normalizeFanClubTier(tierMatch ? tierMatch[1] : "soldado");
    const tier = tierInfo.key;

    const fanClubPrices = state.fanClubPrices || {};
    const price = Number(fanClubPrices[tier]) || 0;

    const detail = `Entrou no fã-clube (${tierInfo.label})`;
    const eventType = "Entrada no Fã-Clube";

    const u = userRecord(username);
    if (u) {
      if (rememberProcessedMessage(u, msgId)) {
        if (getMonitoring()) {
          u.tokens += price;
          u.tips += 1;
        }
        u._lastTipTimestamp = Date.now();
      }

      u.lastSeen = time();
      if (!u.firstTipAt) u.firstTipAt = time();

      if (getMonitoring()) {
        recalculateTotalTokens();
      }

      registerCapturedEvent(detail, price, eventType, msgId, username);
      state.events.push({
        time: time(),
        timestamp: Date.now(),
        type: eventType,
        user: username,
        tokens: price,
        item: detail,
      });

      autoAddTodo(detail, price, "Fã-Clube", username);
    }
  } else if (
    el.classList?.contains("group-show-user-joined-message") ||
    isTicketShowJoinText(el.textContent)
  ) {
    if (isTicketShowJoinText(el.textContent)) {
      recordTicketPurchaseActivity();
    }
    markMessageProcessed(el, msgId);

    let username = parseTicketShowJoinUsername(rawElText) || name;
    if (!username || username === "Usuário") {
      const uEl = el.querySelector(
        ".user-levels-username-text, .view-cam-username",
      );
      if (uEl) username = cleanUsername((uEl.textContent || "").replace(/\s+/g, " ").trim());
    }
    if (!username || username === "Usuário") {
      username = parseTicketShowJoinUsername(rawElText) || username;
    }

    if (username) {
      const u = userRecord(username);
      if (u) {
        u._hasTicket = true;
        u._ticketShowJoinedAt = Date.now();
      }

      const now = Date.now();
      const ticketPrice = Number(state.currentTicketPrice) || 0;
      let reclassifiedTip = false;

      const recentEvt = [...state.capturedEvents]
        .reverse()
        .find((event) => isRecentTicketTipEvent(event, username, now));
      if (recentEvt) {
        adjustSummaryForReclassification(recentEvt, "Ingresso Ticket", `Compra de Ingresso (${username})`);
        recentEvt.type = "Ingresso Ticket";
        recentEvt.item = `Compra de Ingresso (${username})`;
        state.currentTicketPrice = Number(recentEvt.price) || Number(recentEvt.tokens) || ticketPrice;
        if (u) u._ticketShowJoinedAt = 0;
        reclassifiedTip = true;
      }

      const generalEvt = [...state.events]
        .reverse()
        .find((event) => isRecentTicketTipEvent(event, username, now));
      if (generalEvt) {
        generalEvt.type = "Ingresso Ticket";
        generalEvt.item = `Compra de Ingresso (${username})`;
        state.currentTicketPrice = Number(generalEvt.price) || Number(generalEvt.tokens) || ticketPrice;
        if (u) u._ticketShowJoinedAt = 0;
        reclassifiedTip = true;
      }

      if (reclassifiedTip) {
        saveToGlobalHistory();
        requestUIRefresh(UI_REFRESH.EVENTS);
      }
    }
  } else {
    markMessageProcessed(el, msgId);

    if (!isSystemGoalOrLovenseElement(el)) {
      const u = userRecord(name);
      if (u) {
        if (getMonitoring()) {
          u.messages += 1;
          u._lastMessageTimestamp = Date.now();
        }
        u.lastSeen = time();

        const cleanBody = extractModerationText(el);

        if (isValidChatMessage(cleanBody) && !/agora é o rei da sala/i.test(cleanBody)) {
          const trimmed = cleanBody.slice(0, 180);
          u.lastMessage = trimmed;
          if (!Array.isArray(u._recentMessages)) u._recentMessages = [];
          u._recentMessages.unshift(trimmed);
          if (u._recentMessages.length > 2) u._recentMessages.length = 2;
        }
      }
    }
  }

  if (state.events.length > 5000) {
    state.events.splice(0, state.events.length - 5000);
  }
}