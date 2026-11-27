import { time } from "../utils/helpers.js";
import { safeStorage } from "./storage.js";
import {
  KEY,
  ensureDailyBucket,
  formatDateBrFromKey,
  getAudienceBreakdown,
  getDailyStorageKey,
  localDateKey,
  state,
  trimCapturedEvents,
} from "./state.js";
import { requestUIRefresh, UI_REFRESH } from "./ui-refresh.js";

const USER_METRIC_KEYS = [
  "listedUsersCount",
  "otherUsersCount",
  "tokensUsersCount",
  "ultimateUsersCount",
  "invisibleUsersCount",
  "moreUsersCount",
];
const LEAGUE_METRIC_KEYS = [
  "grey",
  "bronze",
  "silver",
  "gold",
  "diamond",
  "royal",
  "legend",
];

function normalizeMetricRecord(record, keys) {
  const normalized =
    record && typeof record === "object" && !Array.isArray(record)
      ? { ...record }
      : {};
  keys.forEach((key) => {
    normalized[key] = Number(normalized[key]) || 0;
  });
  return normalized;
}

function mergeNamedTotals(...sources) {
  const merged = new Map();
  sources.forEach((source) => {
    Object.entries(source && typeof source === "object" ? source : {}).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const label = String(value.label || key).trim();
      if (!label) return;
      const normalized = label.toLocaleLowerCase();
      const previous = merged.get(normalized);
      if (!previous) {
        merged.set(normalized, {
          ...value,
          label,
          count: Math.max(0, Number(value.count) || 0),
          tokens: Math.max(0, Number(value.tokens) || 0),
        });
        return;
      }
      previous.count = Math.max(previous.count, Number(value.count) || 0);
      previous.tokens = Math.max(previous.tokens, Number(value.tokens) || 0);
    });
  });
  return Object.fromEntries(
    Array.from(merged.values(), (entry) => [entry.label, entry]),
  );
}

function mergeDailyRecords(sources, keyForRecord, timestampForRecord) {
  const merged = new Map();
  sources.forEach((source) => {
    (Array.isArray(source) ? source : Object.values(source || {})).forEach((record) => {
      if (!record || typeof record !== "object") return;
      const key = keyForRecord(record);
      if (!key) return;
      const previous = merged.get(key);
      if (!previous || timestampForRecord(record) >= timestampForRecord(previous)) {
        merged.set(key, record);
      }
    });
  });
  return Array.from(merged.values());
}

function compactMutedUser(user) {
  const timestamp = Number(user?.timestamp ?? user?._timestamp) || 0;
  const recentMessages = Array.isArray(user?.recentMessages)
    ? user.recentMessages.map((message) => String(message || "").trim()).filter(Boolean).slice(0, 2)
    : [];
  const lastMessage = String(user?.lastMessage || recentMessages[0] || "").trim();
  return {
    username: String(user?.username || "").trim(),
    mutedBy: String(user?.mutedBy || ""),
    lastMessage,
    recentMessages,
    timestamp,
    _timestamp: timestamp,
  };
}

let globalHistoryQueue = Promise.resolve();
let globalHistoryGeneration = 0;

export function waitForHistorySaves() {
  return globalHistoryQueue;
}

export function invalidatePendingHistorySaves() {
  globalHistoryGeneration += 1;
}

export function saveToGlobalHistory(onComplete, targetDayKey = null) {
  const complete = (result) => {
    if (!onComplete) return;
    try {
      onComplete(result);
    } catch (error) {
      console.error("[SC Monitor] Erro no callback de salvamento:", error);
    }
  };

  if (!KEY || !state.modelId) {
    complete({ ok: false, error: new Error("Modelo ou chave de armazenamento indisponível.") });
    return;
  }

  const storageKey = KEY;
  const modelId = state.modelId;
  const dayKey = targetDayKey || localDateKey();
  const saveGeneration = globalHistoryGeneration;
  const bucket = ensureDailyBucket(dayKey);

  if (!targetDayKey) {
    if (state.dailyTokenDate !== dayKey) {
      state.dailyTokenBaseline = Number(state.totalTokens) || 0;
      state.dailyTokenDate = dayKey;
      bucket.dayStartTokens = Number(state.totalTokens) || 0;
    }
    if (state._sessionTokensStart === undefined || state._sessionTokensStart === null) {
      state._sessionTokensStart = Number(state.totalTokens) || 0;
    }
    bucket.dailyTokens = Math.max(
      0,
      (Number(state.totalTokens) || 0) - (Number(bucket.dayStartTokens) || 0),
    );
  }

  let snapshot;
  try {
    snapshot = JSON.parse(JSON.stringify(state));
    delete snapshot.currentTicketPrice;
    delete snapshot.currentTicketShowActive;
    const snapshotBucket = snapshot.dailyBuckets?.[dayKey];
    if (snapshotBucket && Array.isArray(snapshot.capturedEvents)) {
      if (!Array.isArray(snapshotBucket.capturedEvents) || snapshotBucket.capturedEvents.length === 0) {
        snapshotBucket.capturedEvents = snapshot.capturedEvents;
      }
      snapshot.capturedEvents = [];
    }
  } catch (error) {
    console.error("[SC Monitor] Erro ao criar snapshot:", error);
    complete({ ok: false, error });
    return;
  }

  globalHistoryQueue = globalHistoryQueue
    .then(() => new Promise((resolve, reject) => {
      const removeStaleData = (keys) => {
        safeStorage.remove(keys, (removeResult) => {
          if (removeResult?.ok === false) {
            reject(removeResult.error || new Error("Falha ao remover dados desatualizados"));
          } else {
            reject(new Error("Salvamento cancelado por alteração do estado."));
          }
        });
      };

      safeStorage.set({ [storageKey]: snapshot }, (writeResult) => {
        if (saveGeneration !== globalHistoryGeneration) {
          removeStaleData(storageKey);
          return;
        }
        if (writeResult?.ok === false) {
          reject(writeResult.error || new Error("Falha ao salvar estado"));
          return;
        }

        saveDailyStats(snapshot, dayKey, (dailyResult) => {
          if (dailyResult?.ok === false) {
            reject(dailyResult.error || new Error("Falha ao salvar estatísticas diárias"));
            return;
          }
          if (saveGeneration !== globalHistoryGeneration) {
            removeStaleData(storageKey);
            return;
          }

          const dailyStorageKey = getDailyStorageKey(modelId, dayKey);
          safeStorage.get(["scm_rooms_history", dailyStorageKey], (res, readResult) => {
            if (readResult?.ok === false) {
              reject(readResult.error || new Error("Falha ao ler histórico de salas"));
              return;
            }

            const history = res?.scm_rooms_history || {};
            const savedDaily = res?.[dailyStorageKey] || bucket || {};
            const historyEntryKey = `${modelId}::${dayKey}`;
            const savedDate = formatDateBrFromKey(dayKey);
            const dayPeak =
              Number(savedDaily.peakViewersDay) ||
              Number(bucket.peakViewersDay) ||
              Number(snapshot.peakViewers) ||
              0;
            const dayAvg = (Number(savedDaily.viewerSamplesCount) || 0) > 0
              ? Math.round((Number(savedDaily.viewerSum) || 0) / Number(savedDaily.viewerSamplesCount))
              : Number(snapshot.avgViewers) || 0;
            const dayTokens = Number(savedDaily.totalTokensDay) > 0
              ? Number(savedDaily.totalTokensDay)
              : Number(savedDaily.dailyTokens) || Number(bucket.dailyTokens) || 0;

            const liveList = Object.values(savedDaily.liveSessions || {});
            const historyEntry = {
              historyKey: historyEntryKey,
              modelId,
              dateKey: dayKey,
              modelName: snapshot.modelName || snapshot.room || modelId,
              totalTokens: Math.round(dayTokens),
              peakViewers: dayPeak,
              avgViewers: dayAvg,
              livesCount: liveList.length,
              firstLiveStart: liveList[0]?.startedAt || "",
              lastLiveEnd: liveList[liveList.length - 1]?.endedAt || "",
              savedDate,
              lastUpdated: time(),
            };
            const previousHistoryEntry = history[historyEntryKey];
            const legacyHistoryEntry = history[modelId];
            const shouldRefreshReportModels =
              !previousHistoryEntry ||
              previousHistoryEntry.modelId !== historyEntry.modelId ||
              previousHistoryEntry.modelName !== historyEntry.modelName ||
              legacyHistoryEntry?.savedDate === savedDate;
            history[historyEntryKey] = historyEntry;

            if (legacyHistoryEntry?.savedDate === savedDate) delete history[modelId];

            if (saveGeneration !== globalHistoryGeneration) {
              removeStaleData([storageKey, getDailyStorageKey(modelId, dayKey)]);
              return;
            }

            safeStorage.set({ scm_rooms_history: history }, (historyResult) => {
              if (historyResult?.ok === false) {
                reject(historyResult.error || new Error("Falha ao salvar histórico de salas"));
                return;
              }
              if (saveGeneration !== globalHistoryGeneration) {
                removeStaleData([storageKey, getDailyStorageKey(modelId, dayKey)]);
                return;
              }
              if (shouldRefreshReportModels) {
                requestUIRefresh(UI_REFRESH.REPORT_MODELS);
              }
              resolve();
            });
          });
        }, saveGeneration);
      });
    }))
    .then(() => complete({ ok: true }))
    .catch((error) => {
      console.error("[SC Monitor] Erro ao salvar histórico:", error);
      complete({ ok: false, error });
    });
}

let dailyStatsQueue = Promise.resolve();

export function saveDailyStats(
  source = state,
  targetDayKey = null,
  onDone = null,
  saveGeneration = globalHistoryGeneration,
) {
  const complete = (result) => {
    if (!onDone) return;
    try {
      onDone(result);
    } catch (error) {
      console.error("[SC Monitor] Erro no callback das estatísticas diárias:", error);
    }
  };

  if (!source.modelId && !source.room) {
    complete({ ok: false, error: new Error("Modelo indisponível para salvar estatísticas.") });
    return;
  }

  const modelKey = source.modelId || source.room;
  const nowSp = new Date();
  const todayDate = targetDayKey || localDateKey(nowSp);
  const dailyStorageKey = getDailyStorageKey(modelKey, todayDate);

  dailyStatsQueue = dailyStatsQueue
    .then(() => new Promise((resolve, reject) => {
      if (saveGeneration !== globalHistoryGeneration) {
        reject(new Error("Salvamento de estatísticas cancelado por alteração do estado."));
        return;
      }

      safeStorage.get([dailyStorageKey], (res, readResult) => {
        if (readResult?.ok === false) {
          reject(readResult.error || new Error("Falha ao ler estatísticas diárias"));
          return;
        }

        const existingBucket = source.dailyBuckets?.[todayDate] || {};
        const daily = res?.[dailyStorageKey] || {
          modelId: modelKey,
          date: todayDate,
          dayStartTokens: Number(existingBucket.dayStartTokens) || Number(source.totalTokens) || 0,
          dailyTokens: 0,
          peakViewersDay: 0,
          viewerSum: 0,
          viewerSamplesCount: 0,
          totalTokensDay: 0,
          bruteDaySeconds: Number(existingBucket.bruteDaySeconds) || 0,
          netDaySeconds: Number(existingBucket.netDaySeconds) || 0,
          userPeak: { listedUsersCount: 0, otherUsersCount: 0, tokensUsersCount: 0, ultimateUsersCount: 0, invisibleUsersCount: 0, moreUsersCount: 0 },
          userSum: { listedUsersCount: 0, otherUsersCount: 0, tokensUsersCount: 0, ultimateUsersCount: 0, invisibleUsersCount: 0, moreUsersCount: 0 },
          userSamplesCount: 0,
          leaguePeak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
          leagueSum: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
          leagueSamplesCount: 0,
          samplesCount: 0,
          minuteBuckets: {},
          liveSessions: {},
          sessions: {},
          suspectBots: [],
          largestTip: null,
          menuOptionTotals: {},
          rouletteOutcomeTotals: {},
          mutedUsers: [],
          moderationStats: { attempts: 0, successes: 0, failures: 0, pending: 0 },
          moderationPendingById: {},
        };
        const previousReportMetrics = JSON.stringify([
          daily.userPeak || {},
          daily.userSum || {},
          Number(daily.userSamplesCount) || 0,
          daily.leaguePeak || {},
          daily.leagueSum || {},
          Number(daily.leagueSamplesCount) || 0,
          daily.roomKingSnapshot || null,
        ]);

        daily.date = todayDate;
        const mergedKingChatTotals = { ...(daily.kingChatTotals || {}) };
        Object.entries(existingBucket.kingChatTotals || {}).forEach(([key, record]) => {
          const previous = mergedKingChatTotals[key];
          if (!previous || (Number(record?.tokens) || 0) >= (Number(previous.tokens) || 0)) {
            mergedKingChatTotals[key] = record;
          }
        });
        daily.kingChatTotals = mergedKingChatTotals;

        const kingName = source.kingStateDate === todayDate
          ? String(source.roomKingName || "").trim()
          : "";
        if (kingName) {
          const kingChatTotal =
            Number(mergedKingChatTotals[kingName.toLowerCase()]?.tokens) || 0;
          const storedKingTokens = Math.max(0, Number(source.kingTokens) || 0);
          const effectiveKingTokens = storedKingTokens > 0
            ? storedKingTokens
            : kingChatTotal;
          const effectiveValueSource = storedKingTokens > 0
            ? String(source.kingTokensSource || "site")
            : kingChatTotal > 0
              ? "chat"
              : String(source.kingTokensSource || "site");
          const roomKingSnapshot = {
            name: kingName,
            tokens: effectiveKingTokens,
            siteTokens: Math.max(0, Number(source.kingSiteTokens) || 0),
            chatTokens: kingChatTotal,
            valueSource: effectiveValueSource,
            threshold: Math.max(0, Number(source.kingThreshold) || 0),
          };
          const snapshotSignature = (snapshot) => JSON.stringify([
            snapshot?.name,
            snapshot?.tokens,
            snapshot?.siteTokens,
            snapshot?.chatTokens,
            snapshot?.valueSource,
            snapshot?.threshold,
          ]);
          if (snapshotSignature(daily.roomKingSnapshot) !== snapshotSignature(roomKingSnapshot)) {
            daily.roomKingSnapshot = {
              ...roomKingSnapshot,
              capturedAt: new Date().toISOString(),
            };
          }
        }

        daily.dayStartTokens = Number(
          daily.dayStartTokens ?? existingBucket.dayStartTokens ?? source.totalTokens,
        ) || 0;
        daily.bruteDaySeconds = Math.max(
          Number(daily.bruteDaySeconds) || 0,
          Number(existingBucket.bruteDaySeconds) || 0,
        );
        daily.netDaySeconds = Math.max(
          Number(daily.netDaySeconds) || 0,
          Number(existingBucket.netDaySeconds) || 0,
        );
        daily.minuteBuckets = {
          ...(daily.minuteBuckets || {}),
          ...(existingBucket.minuteBuckets || {}),
        };

        const hourlyTokens = Array(24).fill(0);
        Object.values(daily.minuteBuckets).forEach((minute) => {
          const hour = Number(String(minute?.minute || "").split(":")[0]);
          if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
            hourlyTokens[hour] += Math.max(0, Number(minute.tokens) || 0);
          }
        });
        daily.hourlyTokens = hourlyTokens.map((value) => Math.round(value));

        daily.liveSessions = {
          ...(daily.liveSessions || {}),
          ...(existingBucket.liveSessions || {}),
        };

        const mergedSuspects = new Map();
        [
          ...Object.values(daily.suspectBots || {}),
          ...Object.values(existingBucket.suspectBots || {}),
        ].forEach((suspect) => {
          if (!suspect?.username) return;
          const key = String(suspect.username).toLocaleLowerCase();
          const previous = mergedSuspects.get(key);
          if (!previous || (Number(suspect.suspicionScore) || 0) >= (Number(previous.suspicionScore) || 0)) {
            mergedSuspects.set(key, suspect);
          }
        });
        (Array.isArray(source.suspectBots) ? source.suspectBots : []).forEach((suspect) => {
          if (!suspect?.username) return;
          const key = String(suspect.username).toLocaleLowerCase();
          const previous = mergedSuspects.get(key);
          if (!previous || (Number(suspect.suspicionScore) || 0) >= (Number(previous.suspicionScore) || 0)) {
            mergedSuspects.set(key, suspect);
          }
        });
        const dismissedSuspects = new Set(
          (Array.isArray(source.dismissedSuspectBots) ? source.dismissedSuspectBots : [])
            .map((username) => String(username).trim().toLocaleLowerCase()),
        );
        daily.suspectBots = Array.from(mergedSuspects.values()).filter(
          (suspect) => !dismissedSuspects.has(String(suspect.username).trim().toLocaleLowerCase()),
        );
        daily.menuOptionTotals = mergeNamedTotals(
          daily.menuOptionTotals,
          existingBucket.menuOptionTotals,
        );
        daily.rouletteOutcomeTotals = mergeNamedTotals(
          daily.rouletteOutcomeTotals,
          existingBucket.rouletteOutcomeTotals,
        );
        daily.mutedUsers = mergeDailyRecords(
          [
            (Array.isArray(daily.mutedUsers)
              ? daily.mutedUsers
              : Object.values(daily.mutedUsers || {})).map(compactMutedUser),
            (Array.isArray(existingBucket.mutedUsers)
              ? existingBucket.mutedUsers
              : Object.values(existingBucket.mutedUsers || {})).map(compactMutedUser),
            (source.mutedUsersDetails || []).filter((user) => {
              const timestamp = Number(user?.timestamp ?? user?._timestamp) || 0;
              return timestamp > 0 && localDateKey(timestamp) === todayDate;
            }).map(compactMutedUser),
          ],
          (user) => String(user.username || "").trim().toLocaleLowerCase(),
          (user) => Number(user.timestamp ?? user._timestamp) || 0,
        );
        const deletedMutedUserIds = new Set([
          ...(Array.isArray(daily.mutedUserDeletedIds)
            ? daily.mutedUserDeletedIds
            : []),
          ...(Array.isArray(existingBucket.mutedUserDeletedIds)
            ? existingBucket.mutedUserDeletedIds
            : []),
        ].map((id) => String(id)));
        daily.mutedUserDeletedIds = Array.from(deletedMutedUserIds);
        const moderationStats = daily.moderationStats || {};
        const bucketModerationStats = existingBucket.moderationStats || {};
        daily.moderationStats = {
          attempts: Math.max(
            Number(moderationStats.attempts) || 0,
            Number(bucketModerationStats.attempts) || 0,
          ),
          successes: Math.max(
            Number(moderationStats.successes) || 0,
            Number(bucketModerationStats.successes) || 0,
          ),
          failures: Math.max(
            Number(moderationStats.failures) || 0,
            Number(bucketModerationStats.failures) || 0,
          ),
          pending: Math.max(
            0,
            bucketModerationStats.pending === undefined
              ? Number(moderationStats.pending) || 0
              : Number(bucketModerationStats.pending) || 0,
          ),
        };
        daily.moderationPendingById =
          existingBucket.moderationPendingById || daily.moderationPendingById || {};
        const moderationDeletedIds = new Set([
          ...(Array.isArray(daily.moderationLogDeletedIds)
            ? daily.moderationLogDeletedIds
            : []),
          ...(Array.isArray(existingBucket.moderationLogDeletedIds)
            ? existingBucket.moderationLogDeletedIds
            : []),
        ].map((id) => String(id)));
        daily.moderationLogDeletedIds = Array.from(moderationDeletedIds);
        const sourceModerationLogs = (Array.isArray(source.moderationLogs)
          ? source.moderationLogs
          : []).filter((log) => {
          const timestamp = Number(log?.timestamp) || 0;
          return timestamp > 0 && localDateKey(timestamp) === todayDate;
        });
        daily.moderationLogs = mergeDailyRecords(
          [
            daily.moderationLogs,
            existingBucket.moderationLogs,
            sourceModerationLogs,
          ],
          (log) => String(log.id || ""),
          (log) => Number(log.updatedAt) || Number(log.timestamp) || 0,
        ).filter((log) => !moderationDeletedIds.has(String(log.id || "")));
        const moderationHourlyTotals = {
          ...(daily.moderationHourlyTotals || {}),
          ...(existingBucket.moderationHourlyTotals || {}),
        };
        Object.entries(existingBucket.moderationHourlyTotals || {}).forEach(([hour, count]) => {
          moderationHourlyTotals[hour] = Math.max(
            Number(moderationHourlyTotals[hour]) || 0,
            Number(count) || 0,
          );
        });
        if (
          Object.keys(moderationHourlyTotals).length === 0 &&
          daily.moderationLogs.length > 0
        ) {
          daily.moderationLogs.forEach((log) => {
            const timestamp = Number(log.timestamp) || 0;
            if (!timestamp) return;
            const hour = Number(new Intl.DateTimeFormat("en-GB", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              hourCycle: "h23",
            }).format(new Date(timestamp)));
            moderationHourlyTotals[hour] = (Number(moderationHourlyTotals[hour]) || 0) + 1;
          });
        }
        daily.moderationHourlyTotals = moderationHourlyTotals;

        daily.peakViewersDay = Math.max(
          daily.peakViewersDay || 0,
          Number(existingBucket.peakViewersDay) || 0,
          source.peakViewers || 0,
        );

        const viewerSummary = source.generalStatsSummary || {};
        const viewerSamples = Number(viewerSummary.samplesCount) || Number(source.viewerSamples?.length) || 0;
        const viewerAverage = Number(source.avgViewers) || 0;
        if (!daily.viewerSessions || typeof daily.viewerSessions !== "object") daily.viewerSessions = {};
        const viewerSessionId = source.sessionId || `${modelKey}:legacy`;
        const previousViewerSession = daily.viewerSessions[viewerSessionId] || {
          samplesCount: 0,
          cumulativeSum: 0,
        };
        const newViewerSamples = Math.max(
          0,
          viewerSamples - (Number(previousViewerSession.samplesCount) || 0),
        );
        const currentCumulativeViewerSum = viewerAverage * viewerSamples;
        const viewerDelta = Math.max(
          0,
          currentCumulativeViewerSum - (Number(previousViewerSession.cumulativeSum) || 0),
        );

        daily.viewerSum = (Number(daily.viewerSum) || 0) + viewerDelta;
        daily.viewerSamplesCount = (Number(daily.viewerSamplesCount) || 0) + newViewerSamples;
        previousViewerSession.cumulativeSum = currentCumulativeViewerSum;
        previousViewerSession.samplesCount = Math.max(
          Number(previousViewerSession.samplesCount) || 0,
          viewerSamples,
        );
        daily.viewerSessions[viewerSessionId] = previousViewerSession;

        if (!daily.sessions || typeof daily.sessions !== "object") daily.sessions = {};
        const sessionId = source.sessionId || `${modelKey}:legacy`;
        const currentGlobalTokens = Number(source.totalTokens) || 0;
        const sessionStartBaseline =
          Number(source._sessionTokensStart) || Number(source.dailyTokenBaseline) || 0;
        const sessionTokens = Math.max(0, currentGlobalTokens - sessionStartBaseline);
        daily.sessions[sessionId] = Math.max(Number(daily.sessions[sessionId]) || 0, sessionTokens);
        const sessionsSum = Object.values(daily.sessions).reduce(
          (sum, value) => sum + (Number(value) || 0),
          0,
        );
        const dayDeltaTokens = Math.max(0, currentGlobalTokens - daily.dayStartTokens);
        daily.dailyTokens = Math.max(Number(existingBucket.dailyTokens) || 0, dayDeltaTokens);
        daily.totalTokensDay = Math.max(sessionsSum, daily.dailyTokens);

        const minuteTokens = Object.values(daily.minuteBuckets).reduce(
          (sum, minute) => sum + (Number(minute?.tokens) || 0),
          0,
        );
        if (daily.totalTokensDay > minuteTokens) {
          const missingTokens = Math.round(daily.totalTokensDay - minuteTokens);
          const currentMinute = getHourMinuteSp(nowSp);
          if (!daily.minuteBuckets[currentMinute]) {
            daily.minuteBuckets[currentMinute] = {
              minute: currentMinute,
              tokens: 0,
              viewersSum: 0,
              viewerSamples: 0,
              netSeconds: 0,
            };
          }
          daily.minuteBuckets[currentMinute].tokens += missingTokens;
        }

        daily.userPeak = normalizeMetricRecord(daily.userPeak, USER_METRIC_KEYS);
        daily.userSum = normalizeMetricRecord(daily.userSum, USER_METRIC_KEYS);
        daily.leaguePeak = normalizeMetricRecord(daily.leaguePeak, LEAGUE_METRIC_KEYS);
        daily.leagueSum = normalizeMetricRecord(daily.leagueSum, LEAGUE_METRIC_KEYS);

        const userPeak = source.userStatsSummary?.peak || {};
        for (const key in daily.userPeak) {
          daily.userPeak[key] = Math.max(daily.userPeak[key] || 0, userPeak[key] || 0);
        }

        const userSamples = Number(source.userStatsSummary?.samplesCount) || 0;
        const userAverage = source.userStatsSummary?.avg || {};
        if (!daily.userSum) {
          daily.userSum = {
            listedUsersCount: 0,
            otherUsersCount: 0,
            tokensUsersCount: 0,
            ultimateUsersCount: 0,
            invisibleUsersCount: 0,
            moreUsersCount: 0,
          };
        }
        if (!daily.userSessions || typeof daily.userSessions !== "object") daily.userSessions = {};
        const userSessionId = source.sessionId || `${modelKey}:legacy`;
        const previousUserSession = daily.userSessions[userSessionId] || { samplesCount: 0, sums: {} };
        const newUserSamples = Math.max(
          0,
          userSamples - (Number(previousUserSession.samplesCount) || 0),
        );
        for (const key in daily.userSum) {
          const cumulativeSum = (Number(userAverage[key]) || 0) * userSamples;
          const delta = Math.max(
            0,
            cumulativeSum - (Number(previousUserSession.sums?.[key]) || 0),
          );
          daily.userSum[key] = (Number(daily.userSum[key]) || 0) + delta;
          previousUserSession.sums[key] = cumulativeSum;
        }
        daily.userSamplesCount = (Number(daily.userSamplesCount) || 0) + newUserSamples;
        previousUserSession.samplesCount = Math.max(
          Number(previousUserSession.samplesCount) || 0,
          userSamples,
        );
        daily.userSessions[userSessionId] = previousUserSession;

        const leaguePeak = source.leagueStatsSummary?.peak || {};
        for (const key in daily.leaguePeak) {
          daily.leaguePeak[key] = Math.max(daily.leaguePeak[key] || 0, leaguePeak[key] || 0);
        }

        const leagueSummary = source.leagueStatsSummary || {};
        const leagueSampleCount = Number(leagueSummary.samplesCount) || 0;
        if (!daily.leagueSum) {
          daily.leagueSum = {
            grey: 0,
            bronze: 0,
            silver: 0,
            gold: 0,
            diamond: 0,
            royal: 0,
            legend: 0,
          };
        }
        if (!daily.leagueSessions || typeof daily.leagueSessions !== "object") {
          daily.leagueSessions = {};
        }
        const leagueSessionId = source.sessionId || `${modelKey}:legacy`;
        const previousLeagueSession = daily.leagueSessions[leagueSessionId] || {
          samplesCount: 0,
          sums: {},
        };
        const leagueAverage = leagueSummary.avg || {};
        const leagueKeys = Object.keys(daily.leagueSum);
        const newLeagueSamples = Math.max(
          0,
          leagueSampleCount - (Number(previousLeagueSession.samplesCount) || 0),
        );
        for (const key of leagueKeys) {
          const cumulativeSum = (Number(leagueAverage[key]) || 0) * leagueSampleCount;
          const delta = Math.max(
            0,
            cumulativeSum - (Number(previousLeagueSession.sums?.[key]) || 0),
          );
          daily.leagueSum[key] = (Number(daily.leagueSum[key]) || 0) + delta;
          previousLeagueSession.sums[key] = cumulativeSum;
        }
        daily.leagueSamplesCount = (Number(daily.leagueSamplesCount) || 0) + newLeagueSamples;
        previousLeagueSession.samplesCount = Math.max(
          Number(previousLeagueSession.samplesCount) || 0,
          leagueSampleCount,
        );
        daily.leagueSessions[leagueSessionId] = previousLeagueSession;

        const mergedCapturedEvents = new Map();
        [
          ...Object.values(daily.capturedEvents || {}),
          ...Object.values(existingBucket.capturedEvents || {}),
          ...(Array.isArray(source.capturedEvents) ? source.capturedEvents : []),
        ].forEach((event) => {
          if (!event) return;
          const eventTimestamp = Number(event.timestamp ?? event.time);
          if (eventTimestamp > 0 && localDateKey(eventTimestamp) !== todayDate) return;
          const key = event.id || `${eventTimestamp}-${event.item}-${event.price}`;
          if (!mergedCapturedEvents.has(key)) mergedCapturedEvents.set(key, event);
        });
        daily.capturedEvents = trimCapturedEvents(Array.from(mergedCapturedEvents.values()));
        const largestTipCandidates = [
          daily.largestTip,
          existingBucket.largestTip,
          ...daily.capturedEvents,
        ].filter((event) => {
          if (!event || typeof event !== "object") return false;
          const timestamp = Number(event.timestamp) || 0;
          return timestamp <= 0 || localDateKey(timestamp) === todayDate;
        });
        daily.largestTip = largestTipCandidates.reduce((largest, event) => {
          const tokens = Math.max(0, Number(event.price ?? event.tokens) || 0);
          const largestTokens = Math.max(
            0,
            Number(largest?.price ?? largest?.tokens) || 0,
          );
          return tokens > largestTokens ? event : largest;
        }, null);

        daily.eventSummaryTotals = JSON.parse(JSON.stringify(
          source.eventSummaryTotals || daily.eventSummaryTotals || {},
        ));
        if (existingBucket.eventSummaryTotals && typeof existingBucket.eventSummaryTotals === "object") {
          Object.entries(existingBucket.eventSummaryTotals).forEach(([key, value]) => {
            if (!daily.eventSummaryTotals[key]) {
              daily.eventSummaryTotals[key] = JSON.parse(JSON.stringify(value));
            }
          });
        }
        daily.topUsersSnapshot = Object.values(source.users || {})
          .filter((user) => user && String(user.name || "").trim())
          .sort((a, b) =>
            ((Number(b.tokens) || 0) * 3 + (Number(b.messages) || 0) +
              Math.floor(Math.max(0, Number(b.totalTimeSpent) || 0) / 60)) -
            ((Number(a.tokens) || 0) * 3 + (Number(a.messages) || 0) +
              Math.floor(Math.max(0, Number(a.totalTimeSpent) || 0) / 60)),
          )
          .slice(0, 100)
          .map((user) => ({
            name: user.name,
            tokens: Number(user.tokens) || 0,
            tips: Number(user.tips) || 0,
            messages: Number(user.messages) || 0,
            league: String(user.league || ""),
            totalTimeSpent: Math.max(0, Number(user.totalTimeSpent) || 0) +
              (user.isListed
                ? Math.max(0, Math.floor((Date.now() - (Number(user._currentVisitStart) || Date.now())) / 1000))
                : 0),
            visitCount: Math.max(1, Number(user.visitCount) || 1),
            firstSeenDate: String(user.firstSeenDate || ""),
            lastSeenDate: String(user.lastSeenDate || todayDate),
          }));
        daily.leagueUserTotals = {};
        Object.values(source.users || {}).forEach((user) => {
          if (!user?.name) return;
          const league = String(user.league || "").trim() || "Sem liga";
          const key = league.toLocaleLowerCase();
          const total = daily.leagueUserTotals[key] || {
            label: league,
            users: 0,
            tokens: 0,
            tips: 0,
            messages: 0,
            timeSpent: 0,
          };
          total.users += 1;
          total.tokens += Math.max(0, Number(user.tokens) || 0);
          total.tips += Math.max(0, Number(user.tips) || 0);
          total.messages += Math.max(0, Number(user.messages) || 0);
          total.timeSpent += Math.max(0, Number(user.totalTimeSpent) || 0);
          daily.leagueUserTotals[key] = total;
        });
        const mergedGoals = new Map();
        (Array.isArray(existingBucket.goalsSnapshot)
          ? existingBucket.goalsSnapshot
          : []).forEach((goal) => {
            const description = String(goal?.description || "").trim();
            if (description) mergedGoals.set(description.toLocaleLowerCase(), {
              description,
              status: String(goal?.status || "Pendente"),
              amount: Math.max(0, Number(goal?.amount) || 0),
              progress: goal?.progress !== undefined && goal?.progress !== null
                ? Math.max(0, Number(goal.progress) || 0)
                : null,
              timestamp: Number(goal?.timestamp ?? goal?.updatedAt) || 0,
            });
          });
        (Array.isArray(source.goals) ? source.goals : []).forEach((goal) => {
          const description = String(goal?.description || "").trim();
          if (!description) return;
          const key = description.toLocaleLowerCase();
          const previous = mergedGoals.get(key);
          const statusPriority = { Interrompida: 1, Pendente: 2, Completa: 3 };
          const nextStatus = String(goal?.status || "Pendente");
          const status = previous &&
            (statusPriority[nextStatus] || 2) < (statusPriority[previous.status] || 1)
            ? previous.status
            : nextStatus;
          const sourceProgress = goal?.progress !== undefined && goal?.progress !== null
            ? Math.max(0, Number(goal.progress) || 0)
            : null;
          const previousProgress = previous?.progress;
          mergedGoals.set(key, {
            description,
            status,
            amount: Math.max(
              Number(previous?.amount) || 0,
              Math.max(0, Number(goal?.amount) || 0),
            ),
            progress: sourceProgress !== null
              ? Math.max(sourceProgress, previousProgress || 0)
              : previousProgress,
            timestamp: Math.max(
              Number(previous?.timestamp) || 0,
              Number(goal?.timestamp ?? goal?.updatedAt) || 0,
            ),
          });
        });
        daily.goalsSnapshot = Array.from(mergedGoals.values());

        daily.audienceStats = getAudienceBreakdown(source.users, todayDate);

        if (saveGeneration !== globalHistoryGeneration) {
          safeStorage.remove(dailyStorageKey, (removeResult) => {
            if (removeResult?.ok === false) {
              reject(removeResult.error || new Error("Falha ao remover estatísticas desatualizadas"));
            } else {
              reject(new Error("Salvamento de estatísticas cancelado por alteração do estado."));
            }
          });
          return;
        }

        const reportMetricsChanged =
          previousReportMetrics !== JSON.stringify([
            daily.userPeak || {},
            daily.userSum || {},
            Number(daily.userSamplesCount) || 0,
            daily.leaguePeak || {},
            daily.leagueSum || {},
            Number(daily.leagueSamplesCount) || 0,
            daily.roomKingSnapshot || null,
          ]);

        safeStorage.set({ [dailyStorageKey]: daily }, (writeResult) => {
          if (writeResult?.ok === false) {
            reject(writeResult.error || new Error("Falha ao salvar estatísticas diárias"));
            return;
          }
          if (saveGeneration !== globalHistoryGeneration) {
            safeStorage.remove(dailyStorageKey, (removeResult) => {
              if (removeResult?.ok === false) {
                reject(removeResult.error || new Error("Falha ao remover estatísticas desatualizadas"));
              } else {
                reject(new Error("Salvamento de estatísticas cancelado por alteração do estado."));
              }
            });
            return;
          }
          if (reportMetricsChanged) {
            requestUIRefresh(UI_REFRESH.REPORT_DATA, {
              modelId: String(modelKey),
              dayKey: todayDate,
            });
          }
          complete({ ok: true });
          resolve();
        });
      });
    }))
    .catch((error) => {
      console.error("[SC Monitor] Erro ao salvar estatísticas diárias:", error);
      complete({ ok: false, error });
    });
}

function getHourMinuteSp(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}
