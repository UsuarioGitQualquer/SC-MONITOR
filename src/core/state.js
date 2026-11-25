import { time } from '../utils/helpers.js';

export let KEY = null;

class BoundedSet extends Set {
  add(value) {
    if (this.has(value)) return this;
    super.add(value);
    while (this.size > 10000) super.delete(this.values().next().value);
    return this;
  }
}

export const processedMessageIds = new BoundedSet();
export let monitoring = false;

export function localDateKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getDailyStorageKey(modelId, dayKey = localDateKey()) {
  const safeModel = String(modelId || state.modelId || state.room || "unknown");
  return `scm:model:${safeModel}:daily:${dayKey}`;
}

export function formatTimeSp(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatDateBrFromKey(dayKey = localDateKey()) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey))) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
  }
  const [year, month, day] = String(dayKey).split("-");
  return `${day}/${month}/${year}`;
}

function getHourMinuteSp(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value || "00";
  const mm = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hh}:${mm}`;
}

export function createEmptyDailyBucket(dayKey = localDateKey(), baseTokens = 0, baseViewers = 0) {
  return {
    date: dayKey,
    dayStartTokens: Number(baseTokens) || 0,
    dailyTokens: 0,
    peakViewers: Number(baseViewers) || 0,
    peakViewersDay: Number(baseViewers) || 0,
    avgViewers: 0,
    viewerSum: 0,
    viewerSamplesCount: 0,
    viewerSamples: [],
    bruteDaySeconds: 0,
    netDaySeconds: 0,
    userPeak: {
      listedUsersCount: 0,
      otherUsersCount: 0,
      tokensUsersCount: 0,
      ultimateUsersCount: 0,
      invisibleUsersCount: 0,
      moreUsersCount: 0,
    },
    userSum: {
      listedUsersCount: 0,
      otherUsersCount: 0,
      tokensUsersCount: 0,
      ultimateUsersCount: 0,
      invisibleUsersCount: 0,
      moreUsersCount: 0,
    },
    userSamplesCount: 0,
    leaguePeak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    leagueSum: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    leagueSamplesCount: 0,
    userStatsSummary: {
      peak: {
        listedUsersCount: 0,
        otherUsersCount: 0,
        tokensUsersCount: 0,
        ultimateUsersCount: 0,
        invisibleUsersCount: 0,
        moreUsersCount: 0,
      },
      avg: {
        listedUsersCount: 0,
        otherUsersCount: 0,
        tokensUsersCount: 0,
        ultimateUsersCount: 0,
        invisibleUsersCount: 0,
        moreUsersCount: 0,
      },
      samplesCount: 0,
    },
    leagueStatsSummary: {
      peak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
      avg: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
      samplesCount: 0,
    },
    capturedEvents: [],
    largestTip: null,
    eventSummaryTotals: {},
    menuOptionTotals: {},
    rouletteOutcomeTotals: {},
    kingChatTotals: {},
    goals: [],
    moderationStats: { attempts: 0, successes: 0, failures: 0, pending: 0 },
    moderationPendingById: {},
    mutedUsers: [],
    minuteBuckets: {},
    liveSessions: {},
    sessions: {},
    suspectBots: [],
  };
}

export function ensureDailyBucket(dayKey = localDateKey()) {
  if (!state.dailyBuckets || typeof state.dailyBuckets !== "object") {
    state.dailyBuckets = {};
  }
  if (!state.dailyBuckets[dayKey]) {
    state.dailyBuckets[dayKey] = createEmptyDailyBucket(
      dayKey,
      state.totalTokens,
      state.currentViewers
    );
  }
  state.dailyKey = dayKey;
  return state.dailyBuckets[dayKey];
}

export function recordDailyKingChatTip(username, amount, dayKey = localDateKey()) {
  const name = String(username || "").trim();
  const tokens = Number(amount);
  if (!name || !Number.isFinite(tokens) || tokens <= 0) return 0;

  const bucket = ensureDailyBucket(dayKey);
  if (!bucket.kingChatTotals || typeof bucket.kingChatTotals !== "object") {
    bucket.kingChatTotals = {};
  }
  const key = name.toLowerCase();
  const record = bucket.kingChatTotals[key] || { name, tokens: 0, tips: 0 };
  record.name = name;
  record.tokens = Math.max(0, Number(record.tokens) || 0) + tokens;
  record.tips = Math.max(0, Number(record.tips) || 0) + 1;
  bucket.kingChatTotals[key] = record;
  return record.tokens;
}

export function recordDailyLargestTip(event, dayKey = localDateKey()) {
  if (!event || typeof event !== "object") return null;
  const username = String(event.user || event.username || "").trim();
  const tokens = Number(event.price ?? event.tokens);
  if (!username || !Number.isFinite(tokens) || tokens <= 0) return null;

  const bucket = ensureDailyBucket(dayKey);
  if (Number(bucket.largestTip?.tokens) >= tokens) return bucket.largestTip;

  bucket.largestTip = {
    username,
    tokens,
    item: String(event.item || event.menuOption || event.rouletteOutcome || "").trim(),
    type: String(event.type || "").trim(),
    menuOption: String(event.menuOption || "").trim(),
    rouletteOutcome: String(event.rouletteOutcome || "").trim(),
    timestamp: Number(event.timestamp) || Date.now(),
  };
  return bucket.largestTip;
}

export function recordDailyMutedUser(user, dayKey = localDateKey()) {
  const username = String(user?.username || "").trim();
  if (!username) return null;

  const bucket = ensureDailyBucket(dayKey);
  if (!Array.isArray(bucket.mutedUsers)) bucket.mutedUsers = [];
  const timestamp = Number(user.timestamp ?? user._timestamp) || Date.now();
  const entry = {
    username,
    mutedBy: String(user.mutedBy || ""),
    timestamp,
    _timestamp: timestamp,
  };
  const existingIndex = bucket.mutedUsers.findIndex(
    (item) => String(item?.username || "").trim().toLowerCase() === username.toLowerCase(),
  );
  if (existingIndex >= 0) {
    bucket.mutedUsers[existingIndex] = { ...bucket.mutedUsers[existingIndex], ...entry };
  } else {
    bucket.mutedUsers.push(entry);
  }
  if (bucket.mutedUsers.length > 300) bucket.mutedUsers.splice(0, bucket.mutedUsers.length - 300);
  return entry;
}

export function recordDailyModerationLog(log) {
  if (!log || typeof log !== "object") return null;
  const timestamp = Number(log.timestamp) || Date.now();
  const bucket = ensureDailyBucket(localDateKey(timestamp));
  if (!bucket.moderationStats || typeof bucket.moderationStats !== "object") {
    bucket.moderationStats = { attempts: 0, successes: 0, failures: 0, pending: 0 };
  }
  if (!bucket.moderationPendingById || typeof bucket.moderationPendingById !== "object") {
    bucket.moderationPendingById = {};
  }
  const status = String(log.status || "PENDENTE").toUpperCase();
  const statusKey = status === "SUCESSO"
    ? "successes"
    : status === "FALHA"
      ? "failures"
      : "pending";
  const id = String(log.id || `${timestamp}-${log.user || ""}`);
  const previousStatus = bucket.moderationPendingById[id];
  if (previousStatus === status) return { id, status, timestamp };
  if (!previousStatus) {
    bucket.moderationStats.attempts = (Number(bucket.moderationStats.attempts) || 0) + 1;
  } else {
    const previousKey = previousStatus === "SUCESSO"
      ? "successes"
      : previousStatus === "FALHA"
        ? "failures"
        : "pending";
    if (previousKey !== statusKey) {
      bucket.moderationStats[previousKey] = Math.max(
        0,
        (Number(bucket.moderationStats[previousKey]) || 0) - 1,
      );
    }
  }
  bucket.moderationStats[statusKey] = (Number(bucket.moderationStats[statusKey]) || 0) + 1;
  if (status === "PENDENTE") {
    bucket.moderationPendingById[id] = status;
  } else {
    delete bucket.moderationPendingById[id];
  }
  return {
    id,
    status,
    timestamp,
  };
}

export function startOrTouchLiveSegment(dayKey = localDateKey(), nowTs = Date.now(), forcedStartStr = null) {
  const bucket = ensureDailyBucket(dayKey);
  if (!bucket.liveSessions || typeof bucket.liveSessions !== "object") {
    bucket.liveSessions = {};
  }

  const segId = state.sessionId || `live-${nowTs}`;
  if (!bucket.liveSessions[segId]) {
    bucket.liveSessions[segId] = {
      sessionId: segId,
      date: dayKey,
      startedAtTs: nowTs,
      startedAt: forcedStartStr || formatTimeSp(nowTs),
      endedAtTs: nowTs,
      endedAt: formatTimeSp(nowTs),
      durationSeconds: 0,
      tokens: 0,
      peakViewers: Number(state.currentViewers) || 0,
      viewerSum: 0,
      viewerSamples: 0,
      minuteBuckets: {},
      minuteBucketsByMinute: {},
      capturedEvents: [],
      eventSummaryTotals: {},
      status: "ATIVA",
    };
  }

  const seg = bucket.liveSessions[segId];
  if (!seg.minuteBuckets || typeof seg.minuteBuckets !== "object") seg.minuteBuckets = {};
  seg.endedAtTs = nowTs;
  seg.endedAt = formatTimeSp(nowTs);
  seg.durationSeconds = Math.max(
    Number(seg.durationSeconds) || 0,
    Math.floor((nowTs - seg.startedAtTs) / 1000)
  );
  seg.peakViewers = Math.max(
    Number(seg.peakViewers) || 0,
    Number(state.currentViewers) || 0,
    Number(state._sessionPeakViewers) || 0
  );

  const currentGlobalTokens = Number(state.totalTokens) || 0;
  const sessionStartBaseline = Number(state._sessionTokensStart) || 0;
  seg.tokens = Math.max(Number(seg.tokens) || 0, Math.max(0, currentGlobalTokens - sessionStartBaseline));

  return seg;
}

export function closeLiveSegmentForDay(dayKey, endTs = Date.now(), forcedEndStr = null) {
  const bucket = state.dailyBuckets?.[dayKey];
  if (!bucket || !bucket.liveSessions) return;
  const segId = state.sessionId;
  if (!segId || !bucket.liveSessions[segId]) return;

  const seg = bucket.liveSessions[segId];
  seg.endedAtTs = endTs;
  seg.endedAt = forcedEndStr || formatTimeSp(endTs);
  seg.durationSeconds = Math.max(
    Number(seg.durationSeconds) || 0,
    Math.floor((endTs - seg.startedAtTs) / 1000)
  );
  seg.status = "ENCERRADA";
}

export function resetSessionStats(preserveTokensBaseline = true) {
  const currentTokens = Number(state.totalTokens) || 0;

  state._sessionStartedAtTs = Date.now();
  state.lastViewerSampleAt = null;
  state._sessionPeakViewers = 0;
  state._sessionViewerSum = 0;
  state._sessionViewerSamplesCount = 0;
  state._sessionUserSum = {
    listedUsersCount: 0,
    otherUsersCount: 0,
    tokensUsersCount: 0,
    ultimateUsersCount: 0,
    invisibleUsersCount: 0,
    moreUsersCount: 0,
  };
  state._sessionLeagueSum = {
    grey: 0,
    bronze: 0,
    silver: 0,
    gold: 0,
    diamond: 0,
    royal: 0,
    legend: 0,
  };
  state._showInitialCharged = false;
  state.showTokensAccumulated = 0;
  state.viewerSamples = [];
  state.peakViewers = 0;
  state.avgViewers = 0;

  if (preserveTokensBaseline) {
    state._sessionTokensStart = currentTokens;
  } else {
    state._sessionTokensStart = 0;
    state.totalTokens = 0;
  }

  state.userStatsSummary = {
    peak: {
      listedUsersCount: 0,
      otherUsersCount: 0,
      tokensUsersCount: 0,
      ultimateUsersCount: 0,
      invisibleUsersCount: 0,
      moreUsersCount: 0,
    },
    avg: {
      listedUsersCount: 0,
      otherUsersCount: 0,
      tokensUsersCount: 0,
      ultimateUsersCount: 0,
      invisibleUsersCount: 0,
      moreUsersCount: 0,
    },
    samplesCount: 0,
  };

  state.leagueStatsSummary = {
    peak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    avg: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    samplesCount: 0,
  };

  state.generalStatsSummary = {
    peakViewers: 0,
    avgViewers: 0,
    totalTokens: preserveTokensBaseline ? currentTokens : 0,
    samplesCount: 0,
  };
}

export function recalculateTotalTokens() {
  const usersTokens =
    Object.values(state.users || {}).reduce(
      (acc, user) => acc + (Number(user?.tokens) || 0),
      0
    ) + (Number(state.showTokensAccumulated) || 0);

  const eventsTokens = (state.capturedEvents || []).reduce(
    (acc, ev) => acc + (Number(ev?.price ?? ev?.tokens) || 0),
    0
  );

  state.totalTokens = Math.max(usersTokens, eventsTokens);
  return state.totalTokens;
}

export function pruneUserRecords(maxUsers = 2000) {
  if (!state.users || typeof state.users !== "object") return;

  const entries = Object.entries(state.users);
  if (entries.length <= maxUsers) return;

  const now = Date.now();
  const removable = entries.filter(([, user]) => {
    if (!user) return true;
    const hasFinancialActivity =
      (Number(user.tokens) || 0) > 0 ||
      (Number(user.tips) || 0) > 0 ||
      (Number(user.messages) || 0) > 0;
    if (hasFinancialActivity) return false;

    const lastSeen = Number(user._firstSeenTimestamp) || 0;
    return !user.isListed && lastSeen > 0 && now - lastSeen > 24 * 60 * 60 * 1000;
  }).sort((a, b) =>
    (Number(a[1]?._firstSeenTimestamp) || 0) -
    (Number(b[1]?._firstSeenTimestamp) || 0)
  );

  const removeCount = Math.min(removable.length, entries.length - maxUsers);
  removable
    .slice(0, removeCount)
    .forEach(([name]) => delete state.users[name]);
}

const LEAGUE_COUNT_KEYS = ["grey", "bronze", "silver", "gold", "diamond", "royal", "legend"];

function addLeagueCountsSample(entry, leagueCounts) {
  if (!leagueCounts || typeof leagueCounts !== "object") return;

  if (!entry.leagueSums || typeof entry.leagueSums !== "object") {
    entry.leagueSums = Object.fromEntries(LEAGUE_COUNT_KEYS.map((key) => [key, 0]));
  }
  entry.leagueSamples = Number(entry.leagueSamples) || 0;

  LEAGUE_COUNT_KEYS.forEach((key) => {
    const value = Number(leagueCounts[key]);
    entry.leagueSums[key] =
      (Number(entry.leagueSums[key]) || 0) +
      (Number.isFinite(value) ? Math.max(0, value) : 0);
  });
  entry.leagueSamples += 1;
}

export function recordMinuteMetric(
  viewers = null,
  tokensDelta = 0,
  netSecondsDelta = 0,
  liveActive = true,
  listedUsers = null,
  leagueCounts = null,
  tokensUsers = null,
) {
  const now = new Date();
  const dayKey = localDateKey(now);
  const bucket = ensureDailyBucket(dayKey);
  const minKey = getHourMinuteSp(now);

  if (!bucket.minuteBuckets[minKey]) {
    bucket.minuteBuckets[minKey] = {
      minute: minKey,
      tokens: 0,
      viewersSum: 0,
      viewerSamples: 0,
      listedUsersSum: 0,
      listedUsersSamples: 0,
      tokensUsersSum: 0,
      tokensUsersSamples: 0,
      tokensUsersPeak: 0,
      leagueSums: Object.fromEntries(LEAGUE_COUNT_KEYS.map((key) => [key, 0])),
      leagueSamples: 0,
      netSeconds: 0,
    };
  }

  const entry = bucket.minuteBuckets[minKey];
  entry.tokens += Math.max(0, Number(tokensDelta) || 0);
  entry.netSeconds += Math.max(0, Number(netSecondsDelta) || 0);
  entry.listedUsersSum = Number(entry.listedUsersSum) || 0;
  entry.listedUsersSamples = Number(entry.listedUsersSamples) || 0;
  if (listedUsers !== null && listedUsers !== undefined && Number.isFinite(Number(listedUsers))) {
    entry.listedUsersSum += Math.max(0, Number(listedUsers));
    entry.listedUsersSamples += 1;
  }
  entry.tokensUsersSum = Number(entry.tokensUsersSum) || 0;
  entry.tokensUsersSamples = Number(entry.tokensUsersSamples) || 0;
  if (tokensUsers !== null && tokensUsers !== undefined && Number.isFinite(Number(tokensUsers))) {
    entry.tokensUsersSum += Math.max(0, Number(tokensUsers));
    entry.tokensUsersSamples += 1;
    entry.tokensUsersPeak = Math.max(
      Number(entry.tokensUsersPeak) || 0,
      Math.max(0, Number(tokensUsers)),
    );
  }
  addLeagueCountsSample(entry, leagueCounts);
  if (viewers !== null && viewers !== undefined && !Number.isNaN(Number(viewers))) {
    entry.viewersSum += Number(viewers);
    entry.viewerSamples += 1;
  }

  const liveSegment = liveActive ? bucket.liveSessions?.[state.sessionId] : null;
  if (liveSegment) {
    if (!liveSegment.minuteBuckets || typeof liveSegment.minuteBuckets !== "object") {
      liveSegment.minuteBuckets = {};
    }
    const [hour, minute] = minKey.split(":").map(Number);
    const sessionMinuteKey = `${String(hour).padStart(2, "0")}:${String(Math.floor(minute / 5) * 5).padStart(2, "0")}`;
    if (!liveSegment.minuteBuckets[sessionMinuteKey]) {
      liveSegment.minuteBuckets[sessionMinuteKey] = {
        minute: sessionMinuteKey,
        tokens: 0,
        viewersSum: 0,
        viewerSamples: 0,
        listedUsersSum: 0,
        listedUsersSamples: 0,
        tokensUsersSum: 0,
        tokensUsersSamples: 0,
        tokensUsersPeak: 0,
        leagueSums: Object.fromEntries(LEAGUE_COUNT_KEYS.map((key) => [key, 0])),
        leagueSamples: 0,
        netSeconds: 0,
      };
    }
    const sessionEntry = liveSegment.minuteBuckets[sessionMinuteKey];
    sessionEntry.tokens += Math.max(0, Number(tokensDelta) || 0);
    sessionEntry.netSeconds += Math.max(0, Number(netSecondsDelta) || 0);
    sessionEntry.listedUsersSum = Number(sessionEntry.listedUsersSum) || 0;
    sessionEntry.listedUsersSamples = Number(sessionEntry.listedUsersSamples) || 0;
    if (listedUsers !== null && listedUsers !== undefined && Number.isFinite(Number(listedUsers))) {
      sessionEntry.listedUsersSum += Math.max(0, Number(listedUsers));
      sessionEntry.listedUsersSamples += 1;
    }
    sessionEntry.tokensUsersSum = Number(sessionEntry.tokensUsersSum) || 0;
    sessionEntry.tokensUsersSamples = Number(sessionEntry.tokensUsersSamples) || 0;
    if (tokensUsers !== null && tokensUsers !== undefined && Number.isFinite(Number(tokensUsers))) {
      sessionEntry.tokensUsersSum += Math.max(0, Number(tokensUsers));
      sessionEntry.tokensUsersSamples += 1;
      sessionEntry.tokensUsersPeak = Math.max(
        Number(sessionEntry.tokensUsersPeak) || 0,
        Math.max(0, Number(tokensUsers)),
      );
    }
    addLeagueCountsSample(sessionEntry, leagueCounts);
    if (viewers !== null && viewers !== undefined && !Number.isNaN(Number(viewers))) {
      sessionEntry.viewersSum += Number(viewers);
      sessionEntry.viewerSamples += 1;
      liveSegment.viewerSum = (Number(liveSegment.viewerSum) || 0) + Number(viewers);
      liveSegment.viewerSamples = (Number(liveSegment.viewerSamples) || 0) + 1;
    }

    if (!liveSegment.minuteBucketsByMinute || typeof liveSegment.minuteBucketsByMinute !== "object") {
      liveSegment.minuteBucketsByMinute = {};
    }
    if (!liveSegment.minuteBucketsByMinute[minKey]) {
      liveSegment.minuteBucketsByMinute[minKey] = {
        minute: minKey,
        tokens: 0,
        viewersSum: 0,
        viewerSamples: 0,
        listedUsersSum: 0,
        listedUsersSamples: 0,
        tokensUsersSum: 0,
        tokensUsersSamples: 0,
        tokensUsersPeak: 0,
        leagueSums: Object.fromEntries(LEAGUE_COUNT_KEYS.map((key) => [key, 0])),
        leagueSamples: 0,
        netSeconds: 0,
      };
    }
    const preciseEntry = liveSegment.minuteBucketsByMinute[minKey];
    preciseEntry.tokens += Math.max(0, Number(tokensDelta) || 0);
    preciseEntry.netSeconds += Math.max(0, Number(netSecondsDelta) || 0);
    preciseEntry.listedUsersSum = Number(preciseEntry.listedUsersSum) || 0;
    preciseEntry.listedUsersSamples = Number(preciseEntry.listedUsersSamples) || 0;
    if (listedUsers !== null && listedUsers !== undefined && Number.isFinite(Number(listedUsers))) {
      preciseEntry.listedUsersSum += Math.max(0, Number(listedUsers));
      preciseEntry.listedUsersSamples += 1;
    }
    preciseEntry.tokensUsersSum = Number(preciseEntry.tokensUsersSum) || 0;
    preciseEntry.tokensUsersSamples = Number(preciseEntry.tokensUsersSamples) || 0;
    if (tokensUsers !== null && tokensUsers !== undefined && Number.isFinite(Number(tokensUsers))) {
      preciseEntry.tokensUsersSum += Math.max(0, Number(tokensUsers));
      preciseEntry.tokensUsersSamples += 1;
      preciseEntry.tokensUsersPeak = Math.max(
        Number(preciseEntry.tokensUsersPeak) || 0,
        Math.max(0, Number(tokensUsers)),
      );
    }
    addLeagueCountsSample(preciseEntry, leagueCounts);
    if (viewers !== null && viewers !== undefined && !Number.isNaN(Number(viewers))) {
      preciseEntry.viewersSum += Number(viewers);
      preciseEntry.viewerSamples += 1;
    }
  }
}

export function setMonitoring(val) {
  monitoring = Boolean(val);
}

export function getMonitoring() {
  return monitoring;
}

export const state = {
  modelId: null,
  sessionId: null,
  dailyKey: null,
  dailyBuckets: {},
  dailyTokenBaseline: 0,
  _sessionTokensStart: 0,
  _sessionStartedAtTs: 0,
  dailyTokenDate: null,
  modelName: '',
  room: '',
  roomKing: 'Nenhum',
  roomKingName: '',
  kingTokens: 0,
  kingSiteTokens: 0,
  kingTokensSource: 'site',
  kingThreshold: 0,
  kingStateDate: '',
  currentTicketPrice: 0,
  currentGroupShowRate: 0,
  _showInitialCharged: false,
  currentViewers: null,
  lastViewerSampleAt: null,
  peakViewers: 0,
  _sessionPeakViewers: 0,
  avgViewers: 0,
  totalTokens: 0,
  users: {},
  listedUsersCount: 0,
  otherUsersCount: 0,
  tokensUsersCount: 0,
  ultimateUsersCount: 0,
  invisibleUsersCount: 0,
  moreUsersCount: 0,
  leagueCounts: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
  events: [],
  capturedEvents: [],
  viewerSamples: [],
  goals: [],
  todos: [],
  fanClubPrices: { soldado: 0, lord: 0, principe: 0 },
  showPrices: { privateTkMin: 0, vipTkMin: 0 },
  showTokensAccumulated: 0,
  timerState: {
    bruteSeconds: 0,
    netSeconds: 0,
    showSecondsCounter: 0,
    activeShowCategory: null,
  },
  autoCollectEnabled: false,
  autoMonitorOnLive: false,
  watchedModelId: null,
  mutedUsers: [],
  mutedUsersDetails: [],
  moderationLogs: [],
  moderationKeywords: [],
  userStatsSummary: {
    peak: { listedUsersCount: 0, otherUsersCount: 0, tokensUsersCount: 0, ultimateUsersCount: 0, invisibleUsersCount: 0, moreUsersCount: 0 },
    avg: { listedUsersCount: 0, otherUsersCount: 0, tokensUsersCount: 0, ultimateUsersCount: 0, invisibleUsersCount: 0, moreUsersCount: 0 },
    samplesCount: 0
  },
  leagueStatsSummary: {
    peak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    avg: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
    samplesCount: 0
  },
  suspectBots: [],
  suspectBotHistory: {},
  dismissedSuspectBots: [],
  eventSummaryTotals: {},
};

export function roomName() {
  const labelEl = document.querySelector(".viewcam-profile-menu-item__label, h1.viewcam-profile-menu-item__label");
  if (labelEl) {
    const clone = labelEl.cloneNode(true);
    clone.querySelectorAll("svg").forEach((svg) => svg.remove());
    const name = (clone.textContent || "").trim();
    if (name) return name;
  }

  const profileLinkEl = document.querySelector("a.viewcam-profile-menu-item, .local-link__profile a");
  if (profileLinkEl) {
    const href = profileLinkEl.getAttribute("href");
    if (href) {
      const match = href.match(/^\/([^/]+)\/profile/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0) {
    const potentialRoom = pathSegments[0];
    if (!["search", "tags", "categories", "faq", "terms"].includes(potentialRoom.toLowerCase())) {
      return potentialRoom;
    }
  }

  return "Sala Desconhecida";
}

export function getModelId() {
  const node = document.querySelector('[data-model-id], [data-user-id]');
  const attr = node?.getAttribute('data-model-id') || node?.getAttribute('data-user-id');
  if (attr) return String(attr);
  return roomName();
}

export function resolveStorageKey() {
  state.modelId = getModelId();
  KEY = 'scm:model:' + state.modelId;
}

export function isIgnoredUser(name) {
  if (!name) return true;
  const cleanName = name.trim().toLowerCase();
  const currentModel = (state.modelName || roomName() || '').toLowerCase();
  return cleanName.includes('announcement bot') || (currentModel && cleanName === currentModel);
}

export function userRecord(name) {
  if (isIgnoredUser(name)) return null;

  const now = Date.now();
  const today = localDateKey();

  if (!state.users[name]) {
    state.users[name] = {
      name,
      firstSeen: time(),
      firstSeenDate: today,
      lastSeenDate: today,
      _firstSeenTimestamp: now,
      lastSeen: time(),
      messages: 0,
      tokens: 0,
      tips: 0,
      lastMessage: '',
      firstTipAt: null,
      _processedMsgs: [],
      visitCount: 1,
      _currentVisitStart: now,
      _currentVisitDuration: 0,
      _visitMessagesStart: 0,
      _visitTokensStart: 0,
      totalTimeSpent: 0,
      isListed: true,
    };
  } else {
    if (!state.users[name].firstSeenDate) {
      state.users[name].firstSeenDate = "legacy";
    }
    state.users[name].lastSeenDate = today;
  }

  if (!state.users[name]._firstSeenTimestamp) {
    state.users[name]._firstSeenTimestamp = now;
  }

  if (!Array.isArray(state.users[name]._processedMsgs)) {
    state.users[name]._processedMsgs = [];
  }

  return state.users[name];
}

export function getAudienceBreakdown(usersMap = state.users, todayDate = localDateKey()) {
  const allUsersToday = Object.values(usersMap || {}).filter(
    (u) => u && u.lastSeenDate === todayDate
  );

  let newUsers = 0;
  let returningUsers = 0;
  let newTippers = 0;
  let returningTippers = 0;
  let newTokens = 0;
  let returningTokens = 0;

  allUsersToday.forEach((u) => {
    const isNew = u.firstSeenDate === todayDate;
    const userTokens = Number(u.tokens) || 0;

    if (isNew) {
      newUsers += 1;
      if (userTokens > 0) {
        newTippers += 1;
        newTokens += userTokens;
      }
    } else {
      returningUsers += 1;
      if (userTokens > 0) {
        returningTippers += 1;
        returningTokens += userTokens;
      }
    }
  });

  return {
    newUsers,
    returningUsers,
    newTippers,
    returningTippers,
    newTokens: Math.round(newTokens),
    returningTokens: Math.round(returningTokens),
  };
}
