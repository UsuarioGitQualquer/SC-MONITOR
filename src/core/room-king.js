function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function findChatTotal(chatTotals, name) {
  const key = normalizeName(name);
  const record = chatTotals?.[key];
  return Math.max(0, Number(record?.tokens) || 0);
}

export function resolveRoomKing({
  currentName = "",
  siteTokens = 0,
  threshold = 0,
  chatTotals = {},
  previous = {},
} = {}) {
  const name = String(currentName || "").trim();
  const safeSiteTokens = Math.max(0, Number(siteTokens) || 0);
  const safeThreshold = Math.max(0, Number(threshold) || 0);

  if (!name) {
    const candidate = Object.values(chatTotals || {})
      .filter((record) => record?.name && Number(record.tokens) >= safeThreshold && safeThreshold > 0)
      .sort((a, b) =>
        Number(b.tokens) - Number(a.tokens) ||
        String(a.name).localeCompare(String(b.name), "pt-BR"),
      )[0];
    if (!candidate) {
      return {
        name: "",
        tokens: 0,
        siteTokens: 0,
        source: "site",
        threshold: safeThreshold,
      };
    }

    return {
      name: String(candidate.name).trim(),
      tokens: Math.max(0, Number(candidate.tokens) || 0),
      siteTokens: 0,
      source: "threshold",
      threshold: safeThreshold,
    };
  }

  const sameKing = normalizeName(previous.name) === normalizeName(name);
  const chatTokens = findChatTotal(chatTotals, name);
  const previousChatValidated =
    sameKing && ["chat", "threshold"].includes(previous.source);

  if (safeSiteTokens <= 0 && chatTokens > 0) {
    return {
      name,
      tokens: chatTokens,
      siteTokens: 0,
      source: "chat",
      threshold: safeThreshold,
    };
  }

  if (previousChatValidated) {
    const previousTokens = Math.max(0, Number(previous.tokens) || 0);
    const tokens = Math.max(chatTokens, safeSiteTokens, previousTokens);
    return {
      name,
      tokens,
      siteTokens: safeSiteTokens,
      source: safeSiteTokens > Math.max(chatTokens, previousTokens) ? "site" : "chat",
      threshold: safeThreshold,
    };
  }

  if (chatTokens > 0 && chatTokens === safeSiteTokens) {
    return {
      name,
      tokens: chatTokens,
      siteTokens: safeSiteTokens,
      source: "chat",
      threshold: safeThreshold,
    };
  }

  return {
    name,
    tokens: safeSiteTokens || (sameKing ? Math.max(0, Number(previous.tokens) || 0) : 0),
    siteTokens: safeSiteTokens,
    source: safeSiteTokens > 0 ? "site" : (sameKing ? previous.source || "site" : "site"),
    threshold: safeThreshold,
  };
}
