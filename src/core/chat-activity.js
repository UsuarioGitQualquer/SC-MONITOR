const CHAT_MESSAGE_SELECTOR = ".message-base, .message";

export function getChatMessageActivityKey(message) {
  const nativeId =
    message?.getAttribute?.("data-message-id") ||
    message?.dataset?.messageId ||
    message?.getAttribute?.("data-id") ||
    message?.dataset?.id;
  if (nativeId) return `id:${nativeId}`;

  const timeElement = message?.querySelector?.(
    "time, [class*='timestamp'], [class*='Timestamp'], [data-timestamp]",
  );
  const messageTime =
    timeElement?.getAttribute?.("datetime") ||
    timeElement?.getAttribute?.("data-timestamp") ||
    timeElement?.getAttribute?.("title") ||
    timeElement?.textContent?.trim();
  if (!messageTime) return "";

  const username = message
    ?.querySelector?.(
      ".user-levels-username-text, .message-username, .user-name-card-wrapper-text",
    )
    ?.textContent?.trim()
    .toLowerCase();
  const body = message?.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
  if (!username || !body) return "";

  return `time:${messageTime}|user:${username}|body:${body}`;
}

export function getAddedChatMessages(
  records,
  shouldIgnoreMessage = () => false,
  isAlreadyProcessed = () => false,
) {
  const messages = new Set();

  for (const record of records || []) {
    if (record.type !== "childList") continue;

    for (const node of record.addedNodes || []) {
      if (node?.nodeType !== 1) continue;
      if (node.matches?.(CHAT_MESSAGE_SELECTOR)) messages.add(node);
      node.querySelectorAll?.(CHAT_MESSAGE_SELECTOR).forEach((message) => {
        messages.add(message);
      });
    }
  }

  return Array.from(messages).filter(
    (message) => !shouldIgnoreMessage(message) && !isAlreadyProcessed(message),
  );
}
