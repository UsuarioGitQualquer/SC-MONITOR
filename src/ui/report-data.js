import {
  buildDayTimeBars,
  buildSessionBars,
  getAdaptiveTimeStep,
  normalizeMinuteBuckets,
} from "./chart-data.js";

const MAX_PERIOD_REPORT_DAYS = 400;

function formatSecondsToTimeForReportData(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function getHistoryModelId(entryKey, item = {}) {
  if (item?.modelId) return String(item.modelId);
  if (item?.historyKey && String(item.historyKey).includes("::")) {
    return String(item.historyKey).split("::")[0];
  }
  if (entryKey && String(entryKey).includes("::")) {
    return String(entryKey).split("::")[0];
  }
  return String(entryKey || item?.modelName || "");
}

export function getCanonicalModelKey(entryKey, item = {}) {
  const name = String(item?.modelName || "").trim();
  const modelId = getHistoryModelId(entryKey, item);
  if (name && name !== "Modelo" && name !== "Sala Desconhecida") {
    return name.toLocaleLowerCase();
  }
  return modelId.toLocaleLowerCase();
}

function getHistoryUpdateOrder(entry) {
  const updated = entry?.lastUpdated;
  const numeric = Number(updated);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const match = String(updated || "").match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  return match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : 0;
}

export function listHistoryModels(history = {}) {
  const modelsByName = new Map();
  Object.entries(history).forEach(([entryKey, entry]) => {
    const modelId = getHistoryModelId(entryKey, entry);
    if (!modelId || modelId === "::") return;
    const modelName = String(entry?.modelName || modelId);
    const canonicalName = getCanonicalModelKey(entryKey, entry);
    const dateKey = String(entry?.dateKey || String(entryKey).split("::")[1] || "");
    const lastUpdated = getHistoryUpdateOrder(entry);
    const existing = modelsByName.get(canonicalName);
    if (!existing) {
      modelsByName.set(canonicalName, {
        modelId,
        modelIds: new Set([modelId]),
        modelName,
        dateKey,
        lastUpdated,
      });
    } else {
      existing.modelIds.add(modelId);
      if (
        dateKey > existing.dateKey ||
        (dateKey === existing.dateKey && lastUpdated > existing.lastUpdated)
      ) {
        existing.modelId = modelId;
        existing.modelName = modelName;
        existing.dateKey = dateKey;
        existing.lastUpdated = lastUpdated;
      }
    }
  });

  return Array.from(modelsByName.values())
    .map(({ modelId, modelIds, modelName }) => ({
      modelId,
      modelIds: Array.from(modelIds),
      modelName,
      label: modelName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function listHistoryEntriesForModel(history = {}, modelId) {
  const targetModelId = String(modelId || "");
  const targetEntry = Object.entries(history).find(
    ([entryKey, entry]) => getHistoryModelId(entryKey, entry) === targetModelId,
  );
  const targetCanonicalName = targetEntry
    ? getCanonicalModelKey(targetEntry[0], targetEntry[1])
    : targetModelId.toLocaleLowerCase();
  const entriesByDate = new Map();

  Object.entries(history).forEach(([entryKey, entry]) => {
    if (getCanonicalModelKey(entryKey, entry) !== targetCanonicalName) return;
    const dateKey = String(entry?.dateKey || String(entryKey).split("::")[1] || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const candidate = {
      ...entry,
      modelId: getHistoryModelId(entryKey, entry),
      dateKey,
    };
    const previous = entriesByDate.get(dateKey);
    if (!previous) {
      entriesByDate.set(dateKey, {
        ...candidate,
        modelIds: [candidate.modelId],
        sourceEntries: [candidate],
      });
      return;
    }
    if (!previous.modelIds.includes(candidate.modelId)) previous.modelIds.push(candidate.modelId);
    previous.sourceEntries.push(candidate);
    if (getHistoryUpdateOrder(candidate) > getHistoryUpdateOrder(previous)) {
      Object.assign(previous, candidate, {
        modelIds: previous.modelIds,
        sourceEntries: previous.sourceEntries,
      });
    }
  });

  return Array.from(entriesByDate.values()).map((entry) => {
    const sources = entry.sourceEntries;
    entry.totalTokens = sources.reduce(
      (total, source) => total + Math.max(0, Number(source.totalTokens) || 0),
      0,
    );
    entry.peakViewers = Math.max(
      0,
      ...sources.map((source) => Number(source.peakViewers) || 0),
    );
    delete entry.sourceEntries;
    return entry;
  });
}

function sumNumericFields(target, source) {
  Object.entries(source && typeof source === "object" ? source : {}).forEach(([key, value]) => {
    if (Number.isFinite(Number(value))) {
      target[key] = (Number(target[key]) || 0) + Number(value);
    }
  });
  return target;
}

function maxNumericFields(target, source) {
  Object.entries(source && typeof source === "object" ? source : {}).forEach(([key, value]) => {
    if (Number.isFinite(Number(value))) {
      target[key] = Math.max(Number(target[key]) || 0, Number(value));
    }
  });
  return target;
}

function mergeDailyRecordArrays(sources, property, identity) {
  const records = new Map();
  sources.forEach((source) => {
    const values = Array.isArray(source?.[property])
      ? source[property]
      : Object.values(source?.[property] || {});
    values.forEach((value, index) => {
      if (!value || typeof value !== "object") return;
      const key = identity(value, index);
      if (key && !records.has(key)) records.set(key, value);
    });
  });
  return Array.from(records.values());
}

function mergeDailyMinuteBuckets(sources) {
  const buckets = {};
  sources.forEach((source) => {
    Object.entries(source?.minuteBuckets || {}).forEach(([key, minute]) => {
      if (!minute || typeof minute !== "object") return;
      const target = buckets[key];
      if (!target) {
        buckets[key] = {
          ...minute,
          leagueSums: { ...(minute.leagueSums || {}) },
        };
        return;
      }
      Object.entries(minute).forEach(([field, value]) => {
        if (field === "minute" || field === "leagueSums") return;
        if (Number.isFinite(Number(value))) {
          target[field] = (Number(target[field]) || 0) + Number(value);
        }
      });
      sumNumericFields(target.leagueSums, minute.leagueSums);
    });
  });
  return buckets;
}

function mergeDailySessions(sources) {
  const sessions = {};
  sources.forEach((source) => {
    Object.entries(source?.liveSessions || {}).forEach(([key, session]) => {
      if (!session || typeof session !== "object") return;
      const sessionId = String(session.sessionId || key);
      const previous = sessions[sessionId];
      const completeness = (item) =>
        Object.keys(item.minuteBuckets || {}).length +
        Object.keys(item.minuteBucketsByMinute || {}).length +
        (Array.isArray(item.capturedEvents) ? item.capturedEvents.length : 0);
      if (!previous || completeness(session) > completeness(previous)) {
        sessions[sessionId] = { ...session, sessionId };
      }
    });
  });
  return sessions;
}

function mergeDailyNamedTotals(sources, property) {
  const totals = {};
  sources.forEach((source) => mergeNamedTotals(totals, source?.[property]));
  return totals;
}

function mergeDailyKeyedTotals(sources, property, numericFields) {
  const totals = {};
  const keysByName = new Map();
  sources.forEach((source) => {
    Object.entries(source?.[property] || {}).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const name = String(value.name || value.label || key).trim();
      const normalizedName = name.toLocaleLowerCase();
      const targetKey = keysByName.get(normalizedName) || key;
      const previous = totals[targetKey];
      const target = { ...(previous || {}), ...value };
      if (previous) {
        numericFields.forEach((field) => {
          target[field] = (Number(previous[field]) || 0) + (Number(value[field]) || 0);
        });
      }
      if (name) keysByName.set(normalizedName, targetKey);
      totals[targetKey] = target;
    });
  });
  return totals;
}

export function mergeDailyReportBuckets(dailies = []) {
  const sources = dailies.filter(
    (daily) => daily && typeof daily === "object" && !Array.isArray(daily),
  );
  if (sources.length === 0) return {};
  if (sources.length === 1) return sources[0];

  const merged = { ...sources[sources.length - 1] };
  [
    "dailyTokens",
    "totalTokensDay",
    "bruteDaySeconds",
    "netDaySeconds",
    "viewerSum",
    "viewerSamplesCount",
    "userSamplesCount",
    "leagueSamplesCount",
    "samplesCount",
  ].forEach((field) => {
    merged[field] = sources.reduce(
      (total, daily) => total + Math.max(0, Number(daily[field]) || 0),
      0,
    );
  });
  ["peakViewers", "peakViewersDay"].forEach((field) => {
    merged[field] = Math.max(0, ...sources.map((daily) => Number(daily[field]) || 0));
  });

  merged.liveSessions = mergeDailySessions(sources);
  merged.minuteBuckets = mergeDailyMinuteBuckets(sources);
  merged.hourlyTokens = Array.from({ length: 24 }, (_, hour) =>
    sources.reduce(
      (total, daily) => total + (Number(daily.hourlyTokens?.[hour]) || 0),
      0,
    ),
  );

  ["userSum", "leagueSum", "moderationStats"].forEach((field) => {
    const target = {};
    sources.forEach((daily) => sumNumericFields(target, daily[field]));
    merged[field] = target;
  });
  ["eventSummaryTotals", "menuOptionTotals", "rouletteOutcomeTotals"].forEach((field) => {
    merged[field] = mergeDailyNamedTotals(sources, field);
  });
  merged.kingChatTotals = mergeDailyKeyedTotals(
    sources,
    "kingChatTotals",
    ["tokens", "tips"],
  );
  merged.moderationPendingById = Object.assign(
    {},
    ...sources.map((daily) => daily.moderationPendingById || {}),
  );
  ["userPeak", "leaguePeak"].forEach((field) => {
    const target = {};
    sources.forEach((daily) => maxNumericFields(target, daily[field]));
    merged[field] = target;
  });

  const audienceFields = new Set([
    "newUsers", "returningUsers", "newTippers", "returningTippers",
    "newTokens", "returningTokens",
  ]);
  merged.audienceStats = {};
  sources.forEach((daily) => {
    Object.entries(daily.audienceStats || {}).forEach(([field, value]) => {
      if (!Number.isFinite(Number(value))) return;
      merged.audienceStats[field] = audienceFields.has(field)
        ? (Number(merged.audienceStats[field]) || 0) + Number(value)
        : Number(value);
    });
  });

  merged.capturedEvents = mergeDailyRecordArrays(
    sources,
    "capturedEvents",
    (event, index) => String(
      event.id ||
      `${event.timestamp || event.time || ""}|${event.username || event.user || ""}|${event.item || ""}|${event.price || event.tokens || ""}|${index}`,
    ),
  );
  merged.moderationLogs = mergeDailyRecordArrays(
    sources,
    "moderationLogs",
    (log, index) => String(log.id || `${log.timestamp || ""}|${log.username || ""}|${index}`),
  );
  merged.goalsSnapshot = mergeDailyRecordArrays(
    sources,
    "goalsSnapshot",
    (goal, index) => String(goal.id || `${goal.description || ""}|${goal.timestamp || goal.updatedAt || index}`),
  );
  merged.suspectBots = mergeDailyRecordArrays(
    sources,
    "suspectBots",
    (suspect) => String(suspect.username || "").toLocaleLowerCase(),
  );
  merged.mutedUsers = mergeDailyRecordArrays(
    sources,
    "mutedUsers",
    (user) => String(user.username || "").toLocaleLowerCase(),
  );

  const topUsers = new Map();
  sources.forEach((daily) => {
    (Array.isArray(daily.topUsersSnapshot) ? daily.topUsersSnapshot : []).forEach((user) => {
      const name = String(user?.name || "").trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      const previous = topUsers.get(key);
      if (!previous) {
        topUsers.set(key, { ...user });
        return;
      }
      ["tokens", "tips", "messages", "totalTimeSpent", "visitCount"].forEach((field) => {
        previous[field] = (Number(previous[field]) || 0) + (Number(user[field]) || 0);
      });
      if (user.firstSeenDate && (!previous.firstSeenDate || user.firstSeenDate < previous.firstSeenDate)) {
        previous.firstSeenDate = user.firstSeenDate;
      }
      if (user.lastSeenDate && user.lastSeenDate > (previous.lastSeenDate || "")) {
        previous.lastSeenDate = user.lastSeenDate;
      }
    });
  });
  merged.topUsersSnapshot = Array.from(topUsers.values());

  merged.largestTip = sources
    .map((daily) => daily.largestTip)
    .filter(Boolean)
    .reduce((best, tip) =>
      !best || (Number(tip.tokens ?? tip.price) || 0) >
        (Number(best.tokens ?? best.price) || 0)
        ? tip
        : best,
    null);
  merged.roomKingSnapshot = sources
    .map((daily) => daily.roomKingSnapshot)
    .filter(Boolean)
    .reduce((latest, snapshot) =>
      !latest || String(snapshot.capturedAt || "") > String(latest.capturedAt || "")
        ? snapshot
        : latest,
    null);
  merged.leagueUserTotals = {};
  sources.forEach((daily) => {
    Object.entries(daily.leagueUserTotals || {}).forEach(([key, league]) => {
      const target = merged.leagueUserTotals[key] || { ...league };
      if (target !== league) {
        target.users = Math.max(Number(target.users) || 0, Number(league.users) || 0);
        target.timeSpent = Math.max(Number(target.timeSpent) || 0, Number(league.timeSpent) || 0);
        ["tokens", "tips", "messages"].forEach((field) => {
          target[field] = (Number(target[field]) || 0) + (Number(league[field]) || 0);
        });
      }
      merged.leagueUserTotals[key] = target;
    });
  });
  return merged;
}

function getSaoPauloDateParts(timestamp) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  if (![year, month, day, hour].every(Number.isInteger)) return null;
  return { year, month, day, hour };
}

export const LEAGUE_CHART_ITEMS = [
  { key: "grey", label: "Cinza", color: "#94a3b8" },
  { key: "bronze", label: "Bronze", color: "#f97316" },
  { key: "silver", label: "Prata", color: "#00e5ff" },
  { key: "gold", label: "Ouro", color: "#facc15" },
  { key: "diamond", label: "Diamante", color: "#c084fc" },
  { key: "royal", label: "Real", color: "#ff2a6d" },
  { key: "legend", label: "Lendária", color: "#ff7b00" },
];

export function classifyGainType(itemName = "", itemType = "") {
  const combined = `${String(itemName)} ${String(itemType)}`.toLowerCase();
  const normalized = combined.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/compra de conteudo|compra de contenido|content purchase|bought content/.test(normalized)) {
    return "Compra de Conteúdo";
  }
  if (combined.includes("battleship")) return "Battleship";
  if (/objetivo\s+épico|objetivo\s+epico|epic\s*goal/.test(combined)) {
    return "Objetivo Épico";
  }
  if (combined.includes("menu de gorjetas") || combined.includes("menu")) {
    return "Menu";
  }
  if (combined.includes("roleta") || combined.includes("wheel") || combined.includes("spin")) {
    return "Roleta";
  }
  if (combined.includes("show exclusivo") || combined.includes("exclusivo") || combined.includes("vip")) {
    return "Show exclusivo";
  }
  if (combined.includes("show privado") || combined.includes("privado") || combined.includes("private")) {
    return "Show privado";
  }
  if (combined.includes("ticket") || combined.includes("ingresso") || combined.includes("show")) {
    return "Ticket";
  }
  if (combined.includes("gorjeta avulsa") || combined.includes("gorjeta") || combined.includes("tip")) {
    return "Gorjeta avulsa";
  }
  return "Outros";
}

export function buildGainTypeRows(eventSummaryTotals = {}) {
  const totals = new Map();
  if (!eventSummaryTotals || typeof eventSummaryTotals !== "object" || Array.isArray(eventSummaryTotals)) {
    return [];
  }

  Object.entries(eventSummaryTotals).forEach(([itemName, summary]) => {
    const tokens = Math.max(0, Number(summary?.tokens) || 0);
    const count = Math.max(0, Number(summary?.count) || 0);
    if (tokens <= 0 && count <= 0) return;

    const label = classifyGainType(itemName, summary?.type);
    const previous = totals.get(label) || { value: 0, count: 0 };
    previous.value += tokens;
    previous.count += count;
    totals.set(label, previous);
  });

  return Array.from(totals.entries())
    .map(([label, total]) => ({
      label,
      value: Math.round(total.value),
      count: Math.round(total.count),
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildNamedTotalRows(totals = {}) {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return [];
  return Object.entries(totals)
    .map(([key, total]) => ({
      label: String(total?.label || key),
      count: Math.max(0, Number(total?.count) || 0),
      tokens: Math.max(0, Number(total?.tokens) || 0),
    }))
    .filter((row) => row.count > 0 || row.tokens > 0)
    .sort((a, b) => b.count - a.count || b.tokens - a.tokens);
}

export function buildDonorRows(kingChatTotals = {}) {
  if (!kingChatTotals || typeof kingChatTotals !== "object" || Array.isArray(kingChatTotals)) {
    return [];
  }
  return Object.values(kingChatTotals)
    .filter((donor) => donor && String(donor.name || "").trim())
    .map((donor) => ({
      name: String(donor.name).trim(),
      tokens: Math.max(0, Number(donor.tokens) || 0),
      tips: Math.max(0, Number(donor.tips) || 0),
    }))
    .filter((donor) => donor.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
}

export function hasAudienceStats(stats) {
  return Boolean(
    stats &&
      typeof stats === "object" &&
      !Array.isArray(stats) &&
      ["newUsers", "returningUsers"].every(
        (key) =>
          stats[key] !== undefined &&
          stats[key] !== null &&
          stats[key] !== "" &&
          Number.isFinite(Number(stats[key])),
      ),
  );
}

export function hasAudienceConversionStats(stats) {
  if (
    !hasAudienceStats(stats) ||
    !["newTippers", "returningTippers"].every(
      (key) =>
        stats[key] !== undefined &&
        stats[key] !== null &&
        stats[key] !== "" &&
        Number.isFinite(Number(stats[key])) &&
        Number(stats[key]) >= 0,
    )
  ) {
    return false;
  }
  return (
    Number(stats.newTippers) >= 0 &&
    Number(stats.newTippers) <= Number(stats.newUsers) &&
    Number(stats.returningTippers) >= 0 &&
    Number(stats.returningTippers) <= Number(stats.returningUsers)
  );
}

function normalizeCapturedTip(event) {
  if (!event || typeof event !== "object") return null;
  const tokens = Math.max(0, Number(event.price ?? event.tokens) || 0);
  const username = String(event.username || event.user || "").trim();
  if (tokens <= 0 || !username) return null;

  const item = String(
    event.menuOption || event.rouletteOutcome || event.item || "",
  ).trim();
  const type = event.rouletteOutcome
    ? "Roleta"
    : event.menuOption
      ? "Menu"
      : classifyGainType(item, event.type);
  return {
    username,
    tokens,
    item,
    type,
    timestamp: Number(event.timestamp) || 0,
  };
}

function getDailyCapturedEvents(daily) {
  if (Array.isArray(daily?.capturedEvents)) return daily.capturedEvents;
  if (daily?.capturedEvents && typeof daily.capturedEvents === "object") {
    return Object.values(daily.capturedEvents);
  }
  return [];
}

function getDailyCapturedEventEntries(daily) {
  if (Array.isArray(daily?.capturedEvents)) {
    return daily.capturedEvents.map((event, sourceIndex) => ({
      event,
      sourceIndex,
      sourceKey: "",
    }));
  }
  if (daily?.capturedEvents && typeof daily.capturedEvents === "object") {
    return Object.entries(daily.capturedEvents).map(([sourceKey, event], sourceIndex) => ({
      event,
      sourceIndex,
      sourceKey,
    }));
  }
  return [];
}

function isCapturedShowOrTicket(event) {
  if (!event || typeof event !== "object") return false;
  const type = String(event.type || "").trim();
  const item = String(event.item || event.menuOption || event.rouletteOutcome || "").trim();
  const normalizedType = `${type} ${item}`
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    /menu de gorjetas|menu|gorjeta avulsa|roleta|battleship|objetivo epico|compra de conteudo/.test(normalizedType)
  ) {
    return false;
  }

  return /(?:^|\s)(show (?:privado|exclusivo|em grupo)|ticket|ingresso|show privado|show exclusivo)(?:\s|$)/.test(normalizedType);
}

function getDailyLargestTip(daily) {
  const candidates = [
    normalizeCapturedTip(daily?.largestTip),
    ...getDailyCapturedEvents(daily).map(normalizeCapturedTip),
  ].filter(Boolean);
  return candidates.reduce(
    (best, tip) => (!best || tip.tokens > best.tokens ? tip : best),
    null,
  );
}

function mergeNamedTotals(target, source) {
  Object.entries(source && typeof source === "object" ? source : {}).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const label = String(value.label || key).trim();
    if (!label) return;
    const normalized = label.toLocaleLowerCase();
    const existingKey = Object.keys(target).find(
      (itemKey) => String(target[itemKey]?.label || itemKey).toLocaleLowerCase() === normalized,
    );
    const targetKey = existingKey || label;
    const current = target[targetKey] || { label, count: 0, tokens: 0 };
    current.count += Math.max(0, Number(value.count) || 0);
    current.tokens += Math.max(0, Number(value.tokens) || 0);
    if (value.type) current.type = value.type;
    target[targetKey] = current;
  });
}

function groupPeriodMetricBars(bars, granularity, unitLabel) {
  if (granularity === "day") return bars;
  const grouped = new Map();
  if (granularity === "week") {
    bars.forEach((bar) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bar.dateKey || ""))) return;
      const weekStart = dateKeyToUtcDate(bar.dateKey);
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      const weekKey = weekStart.toISOString().slice(0, 10);
      const week = grouped.get(weekKey) || {
        label: `${weekKey.slice(8, 10)}/${weekKey.slice(5, 7)}`,
        value: 0,
        first: bar.label,
        last: bar.label,
      };
      week.value += Number(bar.value) || 0;
      week.last = bar.label;
      grouped.set(weekKey, week);
    });
    return Array.from(grouped.values()).map((week) => ({
      label: week.label,
      value: week.value,
      tooltip: `Semana de ${week.label} (${week.first}${week.first === week.last ? "" : `–${week.last}`}): ${week.value} ${unitLabel}`,
    }));
  }

  bars.forEach((bar) => {
    const monthKey = String(bar.dateKey || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
    const monthDate = new Date(`${monthKey}-01T00:00:00Z`);
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(monthDate);
    const month = grouped.get(monthKey) || { label, value: 0 };
    month.value += Number(bar.value) || 0;
    grouped.set(monthKey, month);
  });
  return Array.from(grouped.entries()).map(([monthKey, month]) => ({
    ...month,
    tooltip: `${month.label}: ${month.value} ${unitLabel}`,
    monthKey,
  }));
}

function groupPeriodMaxMetricBars(bars, granularity) {
  if (granularity === "day") return bars;
  const grouped = new Map();
  (Array.isArray(bars) ? bars : []).forEach((bar) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bar.dateKey || ""))) return;
    let key;
    let label;
    if (granularity === "week") {
      const weekStart = dateKeyToUtcDate(bar.dateKey);
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      key = weekStart.toISOString().slice(0, 10);
      label = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
    } else {
      key = String(bar.dateKey).slice(0, 7);
      label = new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(new Date(`${key}-01T00:00:00Z`));
    }

    const current = grouped.get(key);
    if (!current || Number(bar.value) > current.value) {
      grouped.set(key, {
        label,
        value: Number(bar.value) || 0,
        tooltip: `${granularity === "week" ? "Semana" : label}: maior gorjeta de ${Number(bar.value) || 0} tk`,
      });
    }
  });
  return Array.from(grouped.values());
}

export function weekdayIndexFromDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return -1;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function dateKeyToUtcDate(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`);
}

export function formatHistoryDate(room) {
  if (room?.savedDate) return String(room.savedDate);
  if (room?.lastDate && /^\d{4}-\d{2}-\d{2}$/.test(String(room.lastDate))) {
    const [year, month, day] = String(room.lastDate).split("-");
    return `${day}/${month}/${year}`;
  }
  return "—";
}

export function buildAudienceChartPoints(
  minuteRows,
  stepMinutes = getAdaptiveTimeStep(minuteRows),
) {
  const step = [1, 2, 5, 10, 15, 20, 30, 60].includes(Number(stepMinutes))
    ? Number(stepMinutes)
    : getAdaptiveTimeStep(minuteRows);
  const buckets = new Map();
  (Array.isArray(minuteRows) ? minuteRows : []).forEach((minute) => {
    const [hour, minuteOfHour] = String(minute?.minute || "").split(":").map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minuteOfHour)) return;

    const startMinute = Math.floor((hour * 60 + minuteOfHour) / step) * step;
    let bucket = buckets.get(startMinute);
    if (!bucket) {
      bucket = {
        viewerSum: 0,
        viewerSamples: 0,
        leagueSamples: 0,
        leagueSums: Object.fromEntries(LEAGUE_CHART_ITEMS.map(({ key }) => [key, 0])),
      };
      buckets.set(startMinute, bucket);
    }

    const viewerSamples = Math.max(0, Number(minute.viewerSamples) || 0);
    const savedViewerSum =
      minute.viewersSum !== undefined &&
      minute.viewersSum !== null &&
      minute.viewersSum !== "" &&
      Number.isFinite(Number(minute.viewersSum))
        ? Number(minute.viewersSum)
        : (Number(minute.avgViewers) || 0) * viewerSamples;
    bucket.viewerSum += savedViewerSum;
    bucket.viewerSamples += viewerSamples;

    const leagueSamples = Math.max(0, Number(minute.leagueSamples) || 0);
    bucket.leagueSamples += leagueSamples;
    LEAGUE_CHART_ITEMS.forEach(({ key }) => {
      bucket.leagueSums[key] +=
        (Number(minute.leagueCounts?.[key]) || 0) * leagueSamples;
    });
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([startMinute, bucket]) => {
      const hour = String(Math.floor(startMinute / 60)).padStart(2, "0");
      const minute = String(startMinute % 60).padStart(2, "0");
      const label = `${hour}:${minute}`;
      const viewers = bucket.viewerSamples > 0
        ? Math.round(bucket.viewerSum / bucket.viewerSamples)
        : 0;
      const leagues = Object.fromEntries(
        LEAGUE_CHART_ITEMS.map(({ key }) => [
          key,
          bucket.leagueSamples > 0
            ? Math.round(bucket.leagueSums[key] / bucket.leagueSamples)
            : 0,
        ]),
      );
      const leagueTooltip = LEAGUE_CHART_ITEMS
        .map(({ key, label: leagueLabel }) => `${leagueLabel}: ${leagues[key]}`)
        .join(" • ");

      return {
        label,
        viewers,
        viewerSamples: bucket.viewerSamples,
        leagues,
        leagueSamples: bucket.leagueSamples,
        tooltip: `${label}: média de ${viewers} espectadores • ${leagueTooltip}`,
      };
    });
}

export function buildDailyReportChartData({
  report,
  daily = {},
  stepMinutes = 60,
  sessionId = null,
}) {
  const liveSessions = Array.isArray(report.liveSessions) ? report.liveSessions : [];
  const selectedSession = sessionId
    ? liveSessions.find((session) => session && session.sessionId === sessionId) ||
      liveSessions[liveSessions.length - 1] ||
      null
    : null;
  const minuteRows = selectedSession
    ? selectedSession.minuteRows || []
    : report.minuteRows || [];
  const timeBars = selectedSession
    ? buildSessionBars(report, selectedSession.sessionId, stepMinutes)
    : buildDayTimeBars(daily, report.minuteRows || [], stepMinutes);
  const audiencePoints = buildAudienceChartPoints(minuteRows, stepMinutes)
    .filter((point) => point.viewerSamples > 0);
  const timeBucketTokens = timeBars.reduce(
    (sum, bar) => sum + Math.max(0, Number(bar.value) || 0),
    0,
  );
  const tokensWithoutTime = selectedSession
    ? 0
    : Math.max(
      0,
      Math.round((Number(report.totalTokens) || 0) - timeBucketTokens),
    );

  return { timeBars, audiencePoints, tokensWithoutTime };
}

export function groupPeriodBarsByWeek(dayBars) {
  if (!Array.isArray(dayBars) || dayBars.length === 0) return [];
  const weeks = [];
  for (let i = 0; i < dayBars.length; i += 7) {
    const chunk = dayBars.slice(i, i + 7);
    const totalTk = chunk.reduce((acc, day) => acc + (Number(day.value) || 0), 0);
    const maxPk = Math.max(0, ...chunk.map((day) => Number(day.peakViewers) || 0));
    const firstLabel = chunk[0].label;
    const lastLabel = chunk[chunk.length - 1].label;
    const rangeLabel = firstLabel === lastLabel ? firstLabel : `${firstLabel}–${lastLabel}`;

    weeks.push({
      label: `Sem ${weeks.length + 1}`,
      value: Math.round(totalTk),
      peakViewers: maxPk,
      tooltip: `Semana ${weeks.length + 1} (${rangeLabel}): ${Math.round(totalTk)} tk • Pico: ${maxPk} viewers`,
    });
  }
  return weeks;
}

export function groupPeriodBarsByMonth(dayBars) {
  const months = new Map();
  (Array.isArray(dayBars) ? dayBars : []).forEach((day) => {
    const monthKey = String(day.dateKey || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
    if (!months.has(monthKey)) {
      const monthDate = new Date(`${monthKey}-01T12:00:00`);
      months.set(monthKey, {
        label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(monthDate),
        value: 0,
        peakViewers: 0,
      });
    }
    const month = months.get(monthKey);
    month.value += Number(day.value) || 0;
    month.peakViewers = Math.max(month.peakViewers, Number(day.peakViewers) || 0);
  });
  return Array.from(months.entries()).map(([monthKey, month]) => ({
    ...month,
    value: Math.round(month.value),
    tooltip: `${month.label}: ${Math.round(month.value)} tk • Pico: ${month.peakViewers} viewers`,
    monthKey,
  }));
}

export function listPeriodReportDateKeys(start, end) {
  const current = dateKeyToUtcDate(start);
  const last = dateKeyToUtcDate(end);
  const dateKeys = [];

  while (current <= last && dateKeys.length < MAX_PERIOD_REPORT_DAYS) {
    dateKeys.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dateKeys;
}

export function buildPeriodReportSummary({
  modelId,
  modelEntries = [],
  start,
  end,
  dateKeys = [],
  dailyByDate = {},
  granularity = "day",
}) {
  const entryByDate = new Map(modelEntries.map((entry) => [entry.dateKey, entry]));
  const hourlyTokens = Array(24).fill(0);
  const hourlyNetSeconds = Array(24).fill(0);
  const hourlyViewerSums = Array(24).fill(0);
  const hourlyViewerSamples = Array(24).fill(0);
  const hourlyListedUserSums = Array(24).fill(0);
  const hourlyListedUserSamples = Array(24).fill(0);
  const hourlyTokensUserSums = Array(24).fill(0);
  const hourlyTokensUserSamples = Array(24).fill(0);
  const hourlyTokensUserPeaks = Array(24).fill(0);
  const weekdayStats = WEEKDAY_NAMES.map((name) => ({
    name,
    days: 0,
    tokens: 0,
    netSeconds: 0,
    bruteSeconds: 0,
    viewerSum: 0,
    viewerSamples: 0,
    peakViewers: 0,
  }));
  const userKeys = [
    "listedUsersCount",
    "otherUsersCount",
    "tokensUsersCount",
    "ultimateUsersCount",
    "invisibleUsersCount",
    "moreUsersCount",
  ];
  const leagueKeys = ["grey", "bronze", "silver", "gold", "diamond", "royal", "legend"];
  const periodUserPeak = {};
  const periodUserSum = {};
  let periodUserSamples = 0;
  const periodLeaguePeak = {};
  const periodLeagueSum = {};
  let periodLeagueSamples = 0;
  const newUserBars = [];
  const returningUserBars = [];
  const newTipperBars = [];
  const returningTipperBars = [];
  const suspectBars = [];
  const mutedBars = [];
  const largestTipBars = [];
  const leagueEngagementTotals = new Map();
  const goalTimeline = [];
  const showTimeline = [];
  let periodNetSeconds = 0;
  let periodBruteSeconds = 0;
  const heatmap = WEEKDAY_NAMES.map(() => Array.from({ length: 24 }, () => ({
    tokens: 0,
    events: 0,
    viewerSum: 0,
    viewerSamples: 0,
  })));
  const activityTimeline = Array.from({ length: 24 }, () => ({
    events: 0,
    moderation: 0,
  }));
  const engagementTotals = new Map();
  let audienceDays = 0;
  const audienceConversion = {
    days: 0,
    newUsers: 0,
    newTippers: 0,
    returningUsers: 0,
    returningTippers: 0,
  };
  const uniqueNewUserNames = new Set();
  const uniqueNewTipperNames = new Set();
  let fallbackNewUsers = 0;
  let fallbackNewTippers = 0;
  const roomKingRows = [];
  const liveSessionRows = [];
  const dayBars = [];
  const durationDayBars = [];
  const bruteDurationDayBars = [];
  const dailyPaceBars = [];
  const dailyAudienceBars = [];
  const tokensUsersDayAverages = [];
  let totalPeriodTokens = 0;
  let activeDays = 0;
  const activeDayDates = [];
  let bestDay = { dateBr: "—", tokens: 0 };
  let maxPeak = 0;
  const eventSummaryTotals = {};
  let eventSummaryDays = 0;
  const menuOptionTotals = {};
  const rouletteOutcomeTotals = {};
  const donorTotals = {};
  const suspectTotals = new Map();
  const mutedTotals = new Map();
  let moderationLogCount = 0;
  let moderationSuccessCount = 0;
  let moderationFailureCount = 0;
  let moderationPendingCount = 0;
  let bestTip = null;
  let periodTotalTips = 0;
  let periodTotalMessages = 0;

  dateKeys.forEach((dateKey) => {
    const shortDate = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
    const entry = entryByDate.get(dateKey);
    const daily = dailyByDate[dateKey] || {};
    const minuteBuckets = Object.values(daily.minuteBuckets || {});
    const tokensUsersDailyTotals = minuteBuckets.reduce((totals, minute) => {
      totals.sum += Math.max(0, Number(minute?.tokensUsersSum) || 0);
      totals.samples += Math.max(0, Number(minute?.tokensUsersSamples) || 0);
      return totals;
    }, { sum: 0, samples: 0 });
    if (tokensUsersDailyTotals.samples > 0) {
      tokensUsersDayAverages.push({
        dateKey,
        label: shortDate,
        average: tokensUsersDailyTotals.sum / tokensUsersDailyTotals.samples,
        samples: tokensUsersDailyTotals.samples,
      });
    }
    periodNetSeconds += Math.max(0, Number(daily.netDaySeconds) || 0);
    periodBruteSeconds += Math.max(0, Number(daily.bruteDaySeconds) || 0);
    Object.entries(daily.leagueUserTotals || {}).forEach(([key, league]) => {
      if (!league || typeof league !== "object") return;
      const normalized = String(key || league.label || "").trim().toLocaleLowerCase();
      if (!normalized) return;
      const current = leagueEngagementTotals.get(normalized) || {
        label: String(league.label || key),
        users: 0,
        tokens: 0,
        tips: 0,
        messages: 0,
        timeSpent: 0,
      };
      current.users = Math.max(current.users, Math.max(0, Number(league.users) || 0));
      current.tokens += Math.max(0, Number(league.tokens) || 0);
      current.tips += Math.max(0, Number(league.tips) || 0);
      current.messages += Math.max(0, Number(league.messages) || 0);
      current.timeSpent = Math.max(current.timeSpent, Math.max(0, Number(league.timeSpent) || 0));
      leagueEngagementTotals.set(normalized, current);
    });
    (Array.isArray(daily.goalsSnapshot) ? daily.goalsSnapshot : []).forEach((goal, sourceIndex) => {
      goalTimeline.push({
        dateKey,
        sourceIndex,
        description: String(goal.description || "").trim(),
        status: String(goal.status || "Pendente"),
        amount: Math.max(0, Number(goal.amount) || 0),
        progress: goal.progress !== undefined && goal.progress !== null
          ? Math.max(0, Number(goal.progress) || 0)
          : null,
        timestamp: Math.max(
          0,
          Number(goal.timestamp) ||
          Number(goal.updatedAt) ||
          0,
        ),
      });
    });
    getDailyCapturedEventEntries(daily).forEach(({ event, sourceIndex, sourceKey }) => {
      if (!isCapturedShowOrTicket(event)) return;
      const timestamp = Number(event?.timestamp) ||
        Number(event?.time) ||
        0;
      showTimeline.push({
        dateKey,
        sourceIndex,
        sourceKey,
        eventId: String(event?.id || ""),
        timestamp,
        label: String(event?.item || event?.type || "Show"),
        type: String(event?.type || "Show"),
        tokens: Math.max(0, Number(event?.price ?? event?.tokens) || 0),
      });
    });
    Object.values(daily.liveSessions || {}).forEach((session) => {
      if (!session || typeof session !== "object") return;
      const durationSeconds = Math.max(0, Number(session.durationSeconds) || 0);
      const tokens = Math.max(0, Math.round(Number(session.tokens) || 0));
      const viewerSamples = Math.max(0, Number(session.viewerSamples) || 0);
      const avgViewers = viewerSamples > 0
        ? Math.round((Number(session.viewerSum) || 0) / viewerSamples)
        : Math.max(0, Number(session.avgViewers) || 0);
      const startTime = String(session.startedAt || "--:--").slice(0, 5);
      const dateBr = `${shortDate}/${dateKey.slice(0, 4)}`;
      const label = `${shortDate} ${startTime}`;
      const tokensPerHour = durationSeconds > 0
        ? Math.round((tokens / durationSeconds) * 3600)
        : 0;
      liveSessionRows.push({
        dateKey,
        dateBr,
        startedAt: startTime,
        label,
        tokens,
        durationSeconds,
        tokensPerHour,
        avgViewers,
        peakViewers: Math.max(0, Number(session.peakViewers) || 0),
        tooltip: `${dateBr} · ${startTime}: ${tokens} tk · ${tokensPerHour} tk/h · média ${avgViewers} espectadores`,
        startedAtTs: Number(session.startedAtTs) || 0,
      });
    });
    const largestTip = getDailyLargestTip(daily);
    if (largestTip && (!bestTip || largestTip.tokens > bestTip.tokens)) {
      bestTip = {
        ...largestTip,
        dateKey,
        dateBr: `${shortDate}/${dateKey.slice(0, 4)}`,
      };
    }
    if (largestTip) {
      largestTipBars.push({
        dateKey,
        label: shortDate,
        value: largestTip.tokens,
        tooltip: `${shortDate}: maior gorjeta de ${largestTip.tokens} tk (${largestTip.username})`,
        username: largestTip.username,
        type: largestTip.type,
      });
    }
    const audience = daily.audienceStats;
    const newTippers = Math.max(0, Number(audience?.newTippers) || 0);
    const returningTippers = Math.max(0, Number(audience?.returningTippers) || 0);
    let hasEventSummary = false;
    Object.entries(daily.eventSummaryTotals || {}).forEach(([key, eventSummary]) => {
      const count = Math.max(0, Number(eventSummary?.count) || 0);
      const tokens = Math.max(0, Number(eventSummary?.tokens) || 0);
      if (count <= 0 && tokens <= 0) return;
      hasEventSummary = true;
      if (!eventSummaryTotals[key]) {
        eventSummaryTotals[key] = {
          count: 0,
          tokens: 0,
          type: String(eventSummary?.type || "Geral"),
        };
      }
      eventSummaryTotals[key].count += count;
      eventSummaryTotals[key].tokens += tokens;
    });
    mergeNamedTotals(menuOptionTotals, daily.menuOptionTotals);
    mergeNamedTotals(rouletteOutcomeTotals, daily.rouletteOutcomeTotals);
    Object.entries(daily.kingChatTotals || {}).forEach(([key, donor]) => {
      if (!donor || typeof donor !== "object") return;
      const normalized = String(donor.name || key).trim().toLocaleLowerCase();
      if (!normalized) return;
      const total = donorTotals[normalized] || {
        name: String(donor.name || key).trim(),
        tokens: 0,
        tips: 0,
        days: 0,
      };
      const tokens = Math.max(0, Number(donor.tokens) || 0);
      total.name = String(donor.name || total.name);
      total.tokens += tokens;
      total.tips += Math.max(0, Number(donor.tips) || 0);
      if (tokens > 0) total.days += 1;
      donorTotals[normalized] = total;
    });

    const dailySuspects = Array.isArray(daily.suspectBots)
      ? daily.suspectBots
      : Object.values(daily.suspectBots || {});
    const suspectNames = new Set();
    dailySuspects.forEach((suspect) => {
      const username = String(suspect?.username || "").trim();
      const normalized = username.toLocaleLowerCase();
      if (!normalized) return;
      suspectNames.add(normalized);
      const total = suspectTotals.get(normalized) || {
        username,
        days: 0,
        suspicionScore: 0,
        suspicionLevel: "",
        league: "",
        messages: 0,
        tokens: 0,
      };
      total.days += 1;
      if ((Number(suspect.suspicionScore) || 0) >= total.suspicionScore) {
        total.suspicionScore = Number(suspect.suspicionScore) || 0;
        total.suspicionLevel = String(suspect.suspicionLevel || total.suspicionLevel);
        total.league = String(suspect.league || total.league);
        total.messages = Math.max(total.messages, Number(suspect.messages) || 0);
        total.tokens = Math.max(total.tokens, Number(suspect.tokens) || 0);
      }
      suspectTotals.set(normalized, total);
    });

    const dailyMutedUsers = Array.isArray(daily.mutedUsers)
      ? daily.mutedUsers
      : Object.values(daily.mutedUsers || {});
    const mutedNames = new Set();
    dailyMutedUsers.forEach((muted) => {
      const username = String(muted?.username || "").trim();
      const normalized = username.toLocaleLowerCase();
      if (!normalized) return;
      mutedNames.add(normalized);
      const total = mutedTotals.get(normalized) || {
        username,
        days: 0,
        mutedBy: "",
        timestamp: 0,
      };
      total.days += 1;
      const timestamp = Number(muted.timestamp ?? muted._timestamp) || 0;
      if (timestamp >= total.timestamp) {
        total.timestamp = timestamp;
        total.mutedBy = String(muted.mutedBy || "");
      }
      mutedTotals.set(normalized, total);
    });

    if (daily.moderationStats && typeof daily.moderationStats === "object") {
      moderationLogCount += Math.max(0, Number(daily.moderationStats.attempts) || 0);
      moderationSuccessCount += Math.max(0, Number(daily.moderationStats.successes) || 0);
      moderationFailureCount += Math.max(0, Number(daily.moderationStats.failures) || 0);
      moderationPendingCount += Math.max(0, Number(daily.moderationStats.pending) || 0);
    } else {
      const dailyModerationLogs = Array.isArray(daily.moderationLogs)
        ? daily.moderationLogs
        : Object.values(daily.moderationLogs || {});
      moderationLogCount += dailyModerationLogs.length;
      moderationSuccessCount += dailyModerationLogs.filter(
        (log) => String(log?.status || "").toUpperCase() === "SUCESSO",
      ).length;
      moderationFailureCount += dailyModerationLogs.filter(
        (log) => String(log?.status || "").toUpperCase() === "FALHA",
      ).length;
      moderationPendingCount += dailyModerationLogs.filter(
        (log) => String(log?.status || "").toUpperCase() === "PENDENTE",
      ).length;
    }
    const dailyModerationLogs = Array.isArray(daily.moderationLogs)
      ? daily.moderationLogs
      : Object.values(daily.moderationLogs || {});
    dailyModerationLogs.forEach((log) => {
      const timestamp = Number(log?.timestamp);
      if (!timestamp) return;
      const parts = getSaoPauloDateParts(timestamp);
      if (parts && parts.hour >= 0 && parts.hour < 24) {
        activityTimeline[parts.hour].moderation += 1;
      }
    });

    getDailyCapturedEvents(daily).forEach((event) => {
      const timestamp = Number(event?.timestamp ?? event?.time);
      if (!timestamp) return;
      const parts = getSaoPauloDateParts(timestamp);
      if (parts && parts.hour >= 0 && parts.hour < 24) {
        activityTimeline[parts.hour].events += 1;
        const weekday = weekdayIndexFromDateKey(
          `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
        );
        if (weekday >= 0) heatmap[weekday][parts.hour].events += 1;
      }
    });

    (Array.isArray(daily.topUsersSnapshot) ? daily.topUsersSnapshot : []).forEach((user) => {
      const name = String(user?.name || "").trim();
      if (!name) return;
      const normalizedName = name.toLocaleLowerCase();
      if (String(user?.firstSeenDate || "") === dateKey) {
        uniqueNewUserNames.add(normalizedName);
        if (Math.max(0, Number(user?.tokens) || 0) > 0) {
          uniqueNewTipperNames.add(normalizedName);
        }
      }
      periodTotalTips += Math.max(0, Number(user.tips) || 0);
      periodTotalMessages += Math.max(0, Number(user.messages) || 0);
      const key = name.toLocaleLowerCase();
      const current = engagementTotals.get(key) || {
        name,
        tokens: 0,
        tips: 0,
        messages: 0,
        totalTimeSpent: 0,
        visitCount: 0,
        days: 0,
        firstSeenDate: String(user?.firstSeenDate || ""),
      };
      current.tokens += Math.max(0, Number(user.tokens) || 0);
      current.tips += Math.max(0, Number(user.tips) || 0);
      current.messages += Math.max(0, Number(user.messages) || 0);
      current.totalTimeSpent += Math.max(0, Number(user.totalTimeSpent) || 0);
      current.visitCount += Math.max(1, Number(user.visitCount) || 1);
      current.days += 1;
      if (!current.firstSeenDate) current.firstSeenDate = String(user?.firstSeenDate || "");
      engagementTotals.set(key, current);
    });
    suspectBars.push({
      dateKey,
      label: shortDate,
      value: suspectNames.size,
      tooltip: `${shortDate}: ${suspectNames.size} suspeita(s) registrada(s)`,
    });
    mutedBars.push({
      dateKey,
      label: shortDate,
      value: mutedNames.size,
      tooltip: `${shortDate}: ${mutedNames.size} usu\u00e1rio(s) silenciado(s)`,
    });

    if (hasEventSummary) eventSummaryDays += 1;
    if (hasAudienceStats(audience)) {
      audienceDays += 1;
      const newUsers = Math.max(0, Number(audience.newUsers) || 0);
      const returningUsers = Math.max(0, Number(audience.returningUsers) || 0);
      newUserBars.push({
        dateKey,
        label: shortDate,
        value: newUsers,
        tooltip: `${shortDate}: ${newUsers} novos usuários`,
      });
      returningUserBars.push({
        dateKey,
        label: shortDate,
        value: returningUsers,
        tooltip: `${shortDate}: ${returningUsers} usuários recorrentes`,
      });
    }
    if (hasAudienceConversionStats(audience)) {
      audienceConversion.days += 1;
      audienceConversion.returningUsers += Number(audience.returningUsers);
      audienceConversion.returningTippers += Number(audience.returningTippers);
      const topUsersSnapshot = Array.isArray(daily.topUsersSnapshot)
        ? daily.topUsersSnapshot
        : [];
      if (topUsersSnapshot.length === 0) {
        fallbackNewUsers += Number(audience.newUsers);
        fallbackNewTippers += Number(audience.newTippers);
      }
    }
    if (hasAudienceStats(audience)) {
      newTipperBars.push({
        dateKey,
        label: shortDate,
        value: newTippers,
        tooltip: `${shortDate}: ${newTippers} doador(es) novo(s)`,
      });
      returningTipperBars.push({
        dateKey,
        label: shortDate,
        value: returningTippers,
        tooltip: `${shortDate}: ${returningTippers} doador(es) recorrente(s)`,
      });
    }

    const king = daily.roomKingSnapshot;
    if (king?.name) {
      const chatTokens = Math.max(0, Number(king.chatTokens) || 0);
      const effectiveTokens = Math.max(0, Number(king.tokens) || 0) > 0
        ? Math.max(0, Number(king.tokens) || 0)
        : chatTokens;
      const effectiveSource = Math.max(0, Number(king.tokens) || 0) > 0
        ? String(king.valueSource || "site")
        : chatTokens > 0
          ? "chat"
          : String(king.valueSource || "site");
      roomKingRows.push({
        dateKey,
        dateBr: `${shortDate}/${dateKey.slice(0, 4)}`,
        name: String(king.name),
        tokens: effectiveTokens,
        valueSource: effectiveSource,
      });
    }

    minuteBuckets.forEach((minute) => {
      const hour = Number(String(minute?.minute || "").split(":")[0]);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
      hourlyTokens[hour] += Number(minute.tokens) || 0;
      hourlyNetSeconds[hour] += Math.max(
        0,
        Number(minute.netSeconds) || 60,
      );
      hourlyViewerSums[hour] += Number(minute.viewersSum) || 0;
      hourlyViewerSamples[hour] += Number(minute.viewerSamples) || 0;
      hourlyListedUserSums[hour] += Number(minute.listedUsersSum) || 0;
      hourlyListedUserSamples[hour] += Number(minute.listedUsersSamples) || 0;
      hourlyTokensUserSums[hour] += Number(minute.tokensUsersSum) || 0;
      hourlyTokensUserSamples[hour] += Number(minute.tokensUsersSamples) || 0;
      hourlyTokensUserPeaks[hour] = Math.max(
        hourlyTokensUserPeaks[hour],
        Number(minute.tokensUsersPeak) || 0,
      );
      const weekday = weekdayIndexFromDateKey(dateKey);
      if (weekday >= 0) {
        heatmap[weekday][hour].tokens += Math.max(0, Number(minute.tokens) || 0);
        const viewerSamples = Math.max(0, Number(minute.viewerSamples) || 0);
        heatmap[weekday][hour].viewerSamples += viewerSamples;
        heatmap[weekday][hour].viewerSum +=
          (Number(minute.viewersSum) || 0) * (viewerSamples > 0 ? 1 : 0);
      }
    });

    const tokens = Math.round(Number(daily.totalTokensDay || entry?.totalTokens) || 0);
    const peakViewers = Math.max(
      Number(daily.peakViewersDay) || 0,
      Number(entry?.peakViewers) || 0,
    );
    const weekdayIndex = weekdayIndexFromDateKey(dateKey);
    const hasDailyRecord = Boolean(entry || daily.date);
    if (hasDailyRecord && weekdayIndex >= 0) {
      const weekday = weekdayStats[weekdayIndex];
      weekday.days += 1;
      weekday.tokens += tokens;
      weekday.netSeconds += Math.max(0, Number(daily.netDaySeconds) || 0);
      weekday.bruteSeconds += Math.max(0, Number(daily.bruteDaySeconds) || 0);
      weekday.peakViewers = Math.max(weekday.peakViewers, peakViewers);

      let viewerSum = Number(daily.viewerSum) || 0;
      let viewerSamples = Number(daily.viewerSamplesCount) || 0;
      if (viewerSamples === 0) {
        Object.values(daily.minuteBuckets || {}).forEach((minute) => {
          viewerSum += Number(minute?.viewersSum) || 0;
          viewerSamples += Number(minute?.viewerSamples) || 0;
        });
      }
      weekday.viewerSum += viewerSum;
      weekday.viewerSamples += viewerSamples;
    }

    totalPeriodTokens += tokens;
    if (tokens > 0 || entry) {
      activeDays++;
      activeDayDates.push(`${shortDate}/${dateKey.slice(0, 4)}`);
    }
    if (tokens > bestDay.tokens) {
      bestDay = { dateBr: `${shortDate}/${dateKey.slice(0, 4)}`, tokens };
    }
    if (peakViewers > maxPeak) maxPeak = peakViewers;

    let dailyViewerSum = Number(daily.viewerSum) || 0;
    let dailyViewerSamples = Number(daily.viewerSamplesCount) || 0;
    if (dailyViewerSamples === 0) {
      Object.values(daily.minuteBuckets || {}).forEach((minute) => {
        dailyViewerSum += Number(minute?.viewersSum) || 0;
        dailyViewerSamples += Number(minute?.viewerSamples) || 0;
      });
    }
    const avgViewers = dailyViewerSamples > 0
      ? Math.round(dailyViewerSum / dailyViewerSamples)
      : 0;
    if (hasDailyRecord && (avgViewers > 0 || peakViewers > 0)) {
      dailyAudienceBars.push({
        dateKey,
        label: shortDate,
        avgViewers,
        peakViewers,
        tooltip: `${shortDate}: média ${avgViewers} • pico ${peakViewers} espectadores`,
      });
    }

    if (daily.userPeak) {
      userKeys.forEach((key) => {
        periodUserPeak[key] = Math.max(
          periodUserPeak[key] || 0,
          Number(daily.userPeak[key]) || 0,
        );
      });
    }
    if ((Number(daily.userSamplesCount) || 0) > 0 && daily.userSum) {
      periodUserSamples += Number(daily.userSamplesCount) || 0;
      userKeys.forEach((key) => {
        periodUserSum[key] =
          (periodUserSum[key] || 0) + (Number(daily.userSum[key]) || 0);
      });
    }

    if (daily.leaguePeak) {
      leagueKeys.forEach((key) => {
        periodLeaguePeak[key] = Math.max(
          periodLeaguePeak[key] || 0,
          Number(daily.leaguePeak[key]) || 0,
        );
      });
    }
    if ((Number(daily.leagueSamplesCount) || 0) > 0 && daily.leagueSum) {
      periodLeagueSamples += Number(daily.leagueSamplesCount) || 0;
      leagueKeys.forEach((key) => {
        periodLeagueSum[key] =
          (periodLeagueSum[key] || 0) + (Number(daily.leagueSum[key]) || 0);
      });
    }

    dayBars.push({
      dateKey,
      dateBr: `${shortDate}/${dateKey.slice(0, 4)}`,
      label: shortDate,
      value: tokens,
      peakViewers,
      tooltip: `${shortDate}: ${tokens} tk • Pico: ${peakViewers} viewers`,
    });
    const netSeconds = Math.max(0, Number(daily.netDaySeconds) || 0);
    durationDayBars.push({
      dateKey,
      label: shortDate,
      value: Math.round(netSeconds / 60),
      tooltip: `${shortDate}: ${formatSecondsToTimeForReportData(netSeconds)} líquidos`,
    });
    const bruteSeconds = Math.max(0, Number(daily.bruteDaySeconds) || 0);
    bruteDurationDayBars.push({
      dateKey,
      label: shortDate,
      value: Math.round(bruteSeconds / 60),
      tooltip: `${shortDate}: ${formatSecondsToTimeForReportData(bruteSeconds)} brutos`,
    });
    const netSecondsForPace = Math.max(0, Number(daily.netDaySeconds) || 0);
    if (netSecondsForPace > 0) {
      dailyPaceBars.push({
        dateKey,
        label: shortDate,
        value: Math.round((tokens / netSecondsForPace) * 3600),
        tooltip: `${shortDate}: ${Math.round((tokens / netSecondsForPace) * 3600)} tk/h · ${formatSecondsToTimeForReportData(netSecondsForPace)} líquidos`,
      });
    }
  });

  const avgPerActiveDay =
    activeDays > 0 ? Math.round(totalPeriodTokens / activeDays) : 0;
  const periodViewerSum = weekdayStats.reduce((sum, day) => sum + day.viewerSum, 0);
  const periodViewerSamples = weekdayStats.reduce((sum, day) => sum + day.viewerSamples, 0);
  const periodAvgViewers = periodViewerSamples > 0
    ? Math.round(periodViewerSum / periodViewerSamples)
    : 0;
  const modelName = modelEntries[0]?.modelName || modelId;
  const periodUserAvg = Object.fromEntries(
    userKeys.map((key) => [
      key,
      periodUserSamples > 0
        ? Math.round((periodUserSum[key] || 0) / periodUserSamples)
        : 0,
    ]),
  );
  const periodLeagueAvg = Object.fromEntries(
    leagueKeys.map((key) => [
      key,
      periodLeagueSamples > 0
        ? Math.round((periodLeagueSum[key] || 0) / periodLeagueSamples)
        : 0,
    ]),
  );
  const tokensUsersDayBars = tokensUsersDayAverages.map((day) => {
    const average = Math.round(day.average);
    const sampleLabel = day.samples === 1 ? "amostra" : "amostras";
    return {
      dateKey: day.dateKey,
      label: day.label,
      value: average,
      tooltip: `${day.label}: média de ${average} usuários com tokens calculada a partir de ${day.samples} ${sampleLabel}`,
    };
  });
  const tokensUsersByWeekday = WEEKDAY_NAMES.map(() => ({ sum: 0, days: 0 }));
  tokensUsersDayAverages.forEach((day) => {
    const weekday = weekdayIndexFromDateKey(day.dateKey);
    if (weekday < 0) return;
    tokensUsersByWeekday[weekday].sum += day.average;
    tokensUsersByWeekday[weekday].days += 1;
  });
  const tokensUsersWeekdayBars = tokensUsersDayAverages.length > 0
    ? WEEKDAY_NAMES.map((name, weekday) => {
      const { sum, days } = tokensUsersByWeekday[weekday];
      const average = days > 0 ? Math.round(sum / days) : 0;
      return {
        label: name,
        value: average,
        days,
        tooltip: days > 0
          ? `${name}: média de ${average} usuários com tokens em ${days} ${days === 1 ? "dia" : "dias"}`
          : `${name}: sem registros no período`,
      };
    })
    : [];
  const isWeekly = granularity === "week";
  const isMonthly = granularity === "month";
  const chartBars = isWeekly
    ? groupPeriodBarsByWeek(dayBars)
    : isMonthly
      ? groupPeriodBarsByMonth(dayBars)
      : dayBars;
  const hourlyBars = hourlyTokens.map((tokens, hour) => {
    const label = `${String(hour).padStart(2, "0")}h`;
    const avgViewers = hourlyViewerSamples[hour] > 0
      ? Math.round(hourlyViewerSums[hour] / hourlyViewerSamples[hour])
      : 0;
    return {
      label,
      value: Math.round(tokens),
      avgViewers,
      tooltip: `${label}: ${Math.round(tokens)} tk • Média ${avgViewers} viewers`,
    };
  });
  const audienceHourBars = hourlyBars
    .filter((hour) => hour.avgViewers > 0)
    .map((hour) => ({
      label: hour.label,
      value: hour.avgViewers,
      tooltip: `${hour.label}: média de ${hour.avgViewers} espectadores`,
    }));
  const listedUsersHourBars = hourlyListedUserSamples
    .map((samples, hour) => {
      if (samples <= 0) return null;
      const label = `${String(hour).padStart(2, "0")}h`;
      const value = Math.round(hourlyListedUserSums[hour] / samples);
      return {
        label,
        value,
        tooltip: `${label}: média de ${value} usuários listados`,
      };
    })
    .filter((bar) => bar && bar.value > 0);
  const tokensUsersHourBars = hourlyTokensUserSamples
    .map((samples, hour) => {
      if (samples <= 0) return null;
      const label = `${String(hour).padStart(2, "0")}h`;
      const value = Math.round(hourlyTokensUserSums[hour] / samples);
      return {
        label,
        value,
        tooltip: `${label}: média de ${value} usuários com tokens`,
      };
    })
    .filter((bar) => bar && bar.value > 0);
  const tokensUsersPeakHourBars = hourlyTokensUserPeaks
    .map((value, hour) => {
      if (value <= 0) return null;
      const label = `${String(hour).padStart(2, "0")}h`;
      return {
        label,
        value,
        tooltip: `${label}: pico de ${value} usuários com tokens`,
      };
    })
    .filter((bar) => bar !== null);
  const hourlyPaceBars = hourlyTokens
    .map((tokens, hour) => {
      const seconds = hourlyNetSeconds[hour];
      if (tokens <= 0 || seconds <= 0) return null;
      const label = `${String(hour).padStart(2, "0")}h`;
      const value = Math.round((tokens / seconds) * 3600);
      return {
        label,
        value,
        tooltip: `${label}: ${value} tk/h · ${formatSecondsToTimeForReportData(seconds)} líquidos`,
      };
    })
    .filter((bar) => bar && bar.value > 0);
  const weekdayPaceBars = weekdayStats
    .filter((day) => day.days > 0 && day.netSeconds > 0)
    .map((day) => {
      const value = Math.round((day.tokens / day.netSeconds) * 3600);
      return {
        label: day.name.slice(0, 3),
        value,
        tooltip: `${day.name}: ${value} tk/h em ${day.days} dia(s)`,
      };
    })
    .filter((bar) => bar.value > 0);
  const activeRatioPct =
    dayBars.length > 0 ? Math.round((activeDays / dayBars.length) * 100) : 0;
  const busiestWeekday = weekdayStats
    .filter((day) => day.days > 0 && day.viewerSamples > 0)
    .reduce((best, day) => {
      const average = day.viewerSum / day.viewerSamples;
      return !best || average > best.avg ? { name: day.name, avg: average } : best;
    }, null);
  const bestTokenWeekday = weekdayStats
    .filter((day) => day.days > 0)
    .reduce((best, day) => {
      const average = day.tokens / day.days;
      return !best || average > best.avg ? { name: day.name, avg: average } : best;
    }, null);
  const bestTokenHour = hourlyBars
    .filter((hour) => hour.value > 0)
    .reduce((best, hour) => !best || hour.value > best.tokens
      ? { label: hour.label, tokens: hour.value }
      : best, null);
  const bestAudienceHour = audienceHourBars
    .reduce((best, hour) => !best || hour.value > best.viewers
      ? { label: hour.label, viewers: hour.value }
      : best, null);
  liveSessionRows.sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey) ||
    a.startedAtTs - b.startedAtTs ||
    a.startedAt.localeCompare(b.startedAt),
  );
  const bestLiveByTokens = liveSessionRows
    .filter((session) => session.tokens > 0)
    .reduce((best, session) => !best || session.tokens > best.tokens ? session : best, null);
  const bestLiveByPace = liveSessionRows
    .filter((session) => session.durationSeconds > 0 && session.tokensPerHour > 0)
    .reduce((best, session) =>
      !best || session.tokensPerHour > best.tokensPerHour ? session : best,
    null);

  return {
    modelId,
    modelName,
    start,
    end,
    totalPeriodTokens,
    activeDays,
    activeDayDates,
    avgPerActiveDay,
    periodAvgViewers,
    bestDay,
    bestTip,
    largestTipBars: groupPeriodMaxMetricBars(largestTipBars, granularity),
    maxPeak,
    dayBars,
    durationDayBars: groupPeriodMetricBars(durationDayBars, granularity, "minutos"),
    bruteDurationDayBars: groupPeriodMetricBars(bruteDurationDayBars, granularity, "minutos"),
    weekdayStats,
    busiestWeekday,
    bestTokenWeekday,
    eventSummaryTotals,
    eventSummaryDays,
    menuOptionTotals,
    menuOptionRows: buildNamedTotalRows(menuOptionTotals),
    rouletteOutcomeTotals,
    rouletteOutcomeRows: buildNamedTotalRows(rouletteOutcomeTotals),
    donorRows: Object.values(donorTotals).sort((a, b) => b.tokens - a.tokens),
    totalTips: periodTotalTips,
    totalMessages: periodTotalMessages,
    suspectRows: Array.from(suspectTotals.values()).sort(
      (a, b) => b.days - a.days || b.suspicionScore - a.suspicionScore,
    ),
    mutedRows: Array.from(mutedTotals.values()).sort(
      (a, b) => b.days - a.days || b.timestamp - a.timestamp,
    ),
    moderationLogCount,
    moderationSuccessCount,
    moderationFailureCount,
    moderationPendingCount,
    periodUserPeak,
    periodUserAvg,
    periodLeaguePeak,
    periodLeagueAvg,
    newUserBars: groupPeriodMetricBars(newUserBars, granularity, "usu\u00e1rios"),
    returningUserBars: groupPeriodMetricBars(returningUserBars, granularity, "usu\u00e1rios"),
    newTipperBars: groupPeriodMetricBars(newTipperBars, granularity, "doadores-dia"),
    returningTipperBars: groupPeriodMetricBars(
      returningTipperBars,
      granularity,
      "doadores-dia",
    ),
    suspectBars: groupPeriodMetricBars(suspectBars, granularity, "suspeitas"),
    mutedBars: groupPeriodMetricBars(mutedBars, granularity, "silenciados"),
    audienceDays,
    audienceConversion: {
      ...audienceConversion,
      newUsers: uniqueNewUserNames.size + fallbackNewUsers,
      newTippers: uniqueNewTipperNames.size + fallbackNewTippers,
    },
    bestTokenHour,
    bestAudienceHour,
    roomKingRows,
    isWeekly,
    isMonthly,
    chartBars,
    hourlyBars,
    hourlyPaceBars,
    weekdayPaceBars,
    dailyPaceBars,
    dailyAudienceBars,
    audienceHourBars,
    listedUsersHourBars,
    tokensUsersHourBars,
    tokensUsersDayBars,
    tokensUsersWeekdayBars,
    tokensUsersPeakHourBars,
    periodNetSeconds,
    periodBruteSeconds,
    audienceEfficiency: {
      tokensPerAverageViewer: periodAvgViewers > 0
        ? Math.round((totalPeriodTokens / periodAvgViewers) * 10) / 10
        : 0,
      tokensPerNetHour: periodNetSeconds > 0
        ? Math.round((totalPeriodTokens / periodNetSeconds) * 3600)
        : 0,
      averageViewers: periodAvgViewers,
      totalTokens: totalPeriodTokens,
    },
    leagueEngagementRows: Array.from(leagueEngagementTotals.values())
      .map((row) => ({
        ...row,
        tokensPerUser: row.users > 0 ? Math.round(row.tokens / row.users) : 0,
        minutesPerUser: row.users > 0
          ? Math.round(row.timeSpent / 60 / row.users)
          : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens),
    goalTimeline: goalTimeline
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey) ||
        a.description.localeCompare(b.description)),
    showTimeline: showTimeline
      .sort((a, b) =>
        a.timestamp - b.timestamp || a.label.localeCompare(b.label)),
    heatmap: heatmap.map((cells, weekday) => ({
      name: WEEKDAY_NAMES[weekday],
      cells: cells.map((cell) => ({
        tokens: Math.round(cell.tokens),
        events: Math.round(cell.events),
        avgViewers: cell.viewerSamples > 0
          ? Math.round(cell.viewerSum / cell.viewerSamples)
          : 0,
      })),
    })),
    activityTimeline,
    engagementRows: Array.from(engagementTotals.values())
      .map((row) => ({
        ...row,
        engagementScore:
          row.tokens * 3 +
          row.messages +
          Math.floor(row.totalTimeSpent / 60),
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore),
    liveSessionRows,
    bestLiveByTokens,
    bestLiveByPace,
    activeRatioPct,
  };
}

export function buildReportData(room, daily) {
  const modelName = room?.modelName || room?.modelId || "Modelo";
  const dateBr = formatHistoryDate(room);
  const dateKey = room?.dateKey || daily?.date || "";

  const totalTokens = Math.round(
    Number(daily?.totalTokensDay) > 0
      ? Number(daily.totalTokensDay)
      : Number(daily?.dailyTokens) || Number(room?.totalTokens) || 0
  );

  const peakViewers = Math.max(
    Number(daily?.peakViewersDay) || 0,
    Number(daily?.peakViewers) || 0,
    Number(room?.peakViewers) || 0
  );

  const avgViewers =
    (Number(daily?.viewerSamplesCount) || 0) > 0
      ? Math.round((Number(daily.viewerSum) || 0) / Number(daily.viewerSamplesCount))
      : Number(room?.avgViewers) || 0;

  const bruteSeconds = Number(daily?.bruteDaySeconds) || 0;
  const netSeconds = Number(daily?.netDaySeconds) || 0;

  const savedLiveSessions = Object.values(daily?.liveSessions || {})
    .filter((session) => session && typeof session === "object")
    .sort((a, b) => (Number(a.startedAtTs) || 0) - (Number(b.startedAtTs) || 0));
  const liveSessions = savedLiveSessions
    .map((session, index) => {
      const laterSessionStartedAfterEnd = savedLiveSessions
        .slice(index + 1)
        .some((laterSession) =>
          Number(laterSession.startedAtTs) > 0 &&
          Number(session.endedAtTs) > 0 &&
          Number(laterSession.startedAtTs) > Number(session.endedAtTs),
        );
      const sessionMinuteRows = normalizeMinuteBuckets(session.minuteBuckets);
      const sessionViewerSamples = Number(session.viewerSamples) || 0;
      return {
        ...session,
        ...(laterSessionStartedAfterEnd ? { status: "ENCERRADA" } : {}),
        modelName,
        minuteRows: sessionMinuteRows,
        avgViewers:
          sessionViewerSamples > 0
            ? Math.round((Number(session.viewerSum) || 0) / sessionViewerSamples)
            : 0,
      };
    });

  const suspectBots = Array.isArray(daily?.suspectBots)
    ? daily.suspectBots
    : Object.values(daily?.suspectBots || {});

  const minuteRows = normalizeMinuteBuckets(daily?.minuteBuckets);
  const capturedEvents = getDailyCapturedEvents(daily);
  const largestTip = getDailyLargestTip(daily);
  const topTipCandidates = capturedEvents.map(normalizeCapturedTip).filter(Boolean);
  if (largestTip && !topTipCandidates.some((tip) =>
    tip.tokens === largestTip.tokens &&
    tip.username.toLocaleLowerCase() === largestTip.username.toLocaleLowerCase() &&
    tip.item === largestTip.item
  )) {
    topTipCandidates.push(largestTip);
  }
  const topTipRows = topTipCandidates
    .sort((a, b) => b.tokens - a.tokens || b.timestamp - a.timestamp)
    .slice(0, 10);

  const uPeak = daily?.userPeak || {};
  const uSamples = Number(daily?.userSamplesCount) || 0;
  const uSum = daily?.userSum || {};
  const uAvg = (key) => (uSamples > 0 ? Math.round((Number(uSum[key]) || 0) / uSamples) : 0);

  const lPeak = daily?.leaguePeak || {};
  const lSamples = Number(daily?.leagueSamplesCount) || 0;
  const lSum = daily?.leagueSum || {};
  const lAvg = (key) => (lSamples > 0 ? Math.round((Number(lSum[key]) || 0) / lSamples) : 0);
  const topUsersSnapshot = Array.isArray(daily?.topUsersSnapshot)
    ? daily.topUsersSnapshot
    : [];
  const dailyTotalTips = topUsersSnapshot.reduce(
    (sum, user) => sum + Math.max(0, Number(user?.tips) || 0),
    0,
  );
  const dailyTotalMessages = topUsersSnapshot.reduce(
    (sum, user) => sum + Math.max(0, Number(user?.messages) || 0),
    0,
  );

  return {
    modelId: room?.modelId || daily?.modelId || "",
    modelName,
    dateBr,
    dateKey,
    totalTokens,
    peakViewers,
    avgViewers,
    bruteSeconds,
    netSeconds,
    liveSessions,
    suspectBots,
    menuOptionTotals: daily?.menuOptionTotals || {},
    menuOptionRows: buildNamedTotalRows(daily?.menuOptionTotals),
    rouletteOutcomeTotals: daily?.rouletteOutcomeTotals || {},
    rouletteOutcomeRows: buildNamedTotalRows(daily?.rouletteOutcomeTotals),
    donorRows: buildDonorRows(daily?.kingChatTotals),
    totalTips: dailyTotalTips,
    totalMessages: dailyTotalMessages,
    largestTip,
    topTipRows,
    mutedUsers: Array.isArray(daily?.mutedUsers) ? daily.mutedUsers : [],
    moderationStats: daily?.moderationStats || null,
    moderationLogs: Array.isArray(daily?.moderationLogs) ? daily.moderationLogs : [],
    audienceStats: daily?.audienceStats || {},
    minuteRows,
    uPeak,
    uAvg,
    lPeak,
    lAvg,
    roomKingSnapshot: daily?.roomKingSnapshot || null,
  };
}

export function getRoomKingSourceLabel(valueSource) {
  if (valueSource === "chat") return "Chat capturado";
  if (valueSource === "threshold") return "Chat atingiu o limite do site";
  return "Valor exibido pelo site";
}
