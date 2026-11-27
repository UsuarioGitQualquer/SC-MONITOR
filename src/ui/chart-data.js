function getOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeMinuteBuckets(rawBuckets) {
  if (!rawBuckets) return [];
  if (Array.isArray(rawBuckets)) {
    return rawBuckets
      .filter((minute) => minute && minute.minute)
      .map((minute) => ({
        minute: String(minute.minute),
        tokens: Math.round(Number(minute.tokens) || 0),
        viewersSum: getOptionalNumber(minute.viewersSum),
        avgViewers:
          (Number(minute.viewerSamples) || 0) > 0
            ? Math.round((Number(minute.viewersSum) || 0) / Number(minute.viewerSamples))
            : Math.round(Number(minute.avgViewers) || 0),
        listedUsersSum: Number(minute.listedUsersSum) || 0,
        listedUsersSamples: Number(minute.listedUsersSamples) || 0,
        tokensUsersSum: Number(minute.tokensUsersSum) || 0,
        tokensUsersSamples: Number(minute.tokensUsersSamples) || 0,
        tokensUsersPeak: Number(minute.tokensUsersPeak) || 0,
        unassignedTokens: Number(minute.unassignedTokens) || 0,
        viewerSamples: Number(minute.viewerSamples) || 0,
        leagueSamples: Number(minute.leagueSamples) || 0,
        leagueCounts: Object.fromEntries(
          Object.entries(minute.leagueSums || {}).map(([key, sum]) => [
            key,
            Number(minute.leagueSamples) > 0
              ? Math.round((Number(sum) || 0) / Number(minute.leagueSamples))
              : 0,
          ]),
        ),
        netSeconds: Number(minute.netSeconds) || 0,
      }))
      .sort((a, b) => a.minute.localeCompare(b.minute));
  }

  return Object.entries(rawBuckets)
    .map(([key, minute]) => {
      const minuteKey = String(minute?.minute || key || "");
      return {
        minute: minuteKey,
        tokens: Math.round(Number(minute?.tokens) || 0),
        viewersSum: getOptionalNumber(minute?.viewersSum),
        avgViewers:
          (Number(minute?.viewerSamples) || 0) > 0
            ? Math.round((Number(minute?.viewersSum) || 0) / Number(minute?.viewerSamples))
            : Math.round(Number(minute?.avgViewers) || 0),
        listedUsersSum: Number(minute?.listedUsersSum) || 0,
        listedUsersSamples: Number(minute?.listedUsersSamples) || 0,
        tokensUsersSum: Number(minute?.tokensUsersSum) || 0,
        tokensUsersSamples: Number(minute?.tokensUsersSamples) || 0,
        tokensUsersPeak: Number(minute?.tokensUsersPeak) || 0,
        unassignedTokens: Number(minute?.unassignedTokens) || 0,
        viewerSamples: Number(minute?.viewerSamples) || 0,
        leagueSamples: Number(minute?.leagueSamples) || 0,
        leagueCounts: Object.fromEntries(
          Object.entries(minute?.leagueSums || {}).map(([league, sum]) => [
            league,
            Number(minute?.leagueSamples) > 0
              ? Math.round((Number(sum) || 0) / Number(minute.leagueSamples))
              : 0,
          ]),
        ),
        netSeconds: Number(minute?.netSeconds) || 0,
      };
    })
    .filter((minute) => minute.minute)
    .sort((a, b) => a.minute.localeCompare(b.minute));
}

export function getAdaptiveTimeStep(minuteRows = []) {
  const minuteIndexes = (Array.isArray(minuteRows) ? minuteRows : [])
    .map((row) => {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(row?.minute || ""));
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    })
    .filter((minute) => minute !== null);

  if (minuteIndexes.length === 0) return 1;

  const elapsedMinutes = Math.max(...minuteIndexes) - Math.min(...minuteIndexes);
  if (elapsedMinutes <= 9) return 1;
  if (elapsedMinutes < 30) return 2;
  if (elapsedMinutes < 60) return 5;
  if (elapsedMinutes < 100) return 10;
  if (elapsedMinutes < 180) return 20;
  if (elapsedMinutes < 300) return 30;
  return 60;
}

function buildTimeBucketBars(minuteRows, stepMinutes = 60, startMinStr = null, endMinStr = null) {
  const step = [1, 2, 5, 10, 15, 20, 30, 60].includes(Number(stepMinutes))
    ? Number(stepMinutes)
    : 60;

  const filtered = (minuteRows || []).filter((minute) => {
    if (!minute?.minute) return false;
    if (startMinStr && minute.minute < startMinStr) return false;
    if (endMinStr && minute.minute > endMinStr) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  const bucketMap = new Map();
  let minSlotTotal = Infinity;
  let maxSlotTotal = -Infinity;

  filtered.forEach((minute) => {
    const [hour, minuteOfHour] = String(minute.minute).split(":").map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minuteOfHour)) return;
    const totalMinutes = hour * 60 + minuteOfHour;
    const slotStart = Math.floor(totalMinutes / step) * step;

    if (slotStart < minSlotTotal) minSlotTotal = slotStart;
    if (slotStart > maxSlotTotal) maxSlotTotal = slotStart;

    const previous = bucketMap.get(slotStart) || {
      value: 0,
      viewersSum: 0,
      viewerSamples: 0,
      listedUsersSum: 0,
      listedUsersSamples: 0,
      tokensUsersSum: 0,
      tokensUsersSamples: 0,
      tokensUsersPeak: 0,
      unassignedTokens: 0,
    };
    previous.value += Number(minute.tokens) || 0;
    const viewerSamples = Math.max(0, Number(minute.viewerSamples) || 0);
    if (viewerSamples > 0) {
      previous.viewersSum += getOptionalNumber(minute.viewersSum) ??
        (Number(minute.avgViewers) || 0) * viewerSamples;
      previous.viewerSamples += viewerSamples;
    } else if (Number(minute.avgViewers) > 0) {
      previous.viewersSum += Number(minute.avgViewers);
      previous.viewerSamples += 1;
    }
    previous.listedUsersSum += Number(minute.listedUsersSum) || 0;
    previous.listedUsersSamples += Number(minute.listedUsersSamples) || 0;
    previous.tokensUsersSum += Number(minute.tokensUsersSum) || 0;
    previous.tokensUsersSamples += Number(minute.tokensUsersSamples) || 0;
    previous.tokensUsersPeak = Math.max(
      previous.tokensUsersPeak,
      Number(minute.tokensUsersPeak) || 0,
    );
    previous.unassignedTokens += Number(minute.unassignedTokens) || 0;
    bucketMap.set(slotStart, previous);
  });

  if (!Number.isFinite(minSlotTotal)) return [];

  const formatSlot = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const result = [];
  const occupiedSlots = Array.from(bucketMap.keys()).sort((a, b) => a - b);
  const renderedSlots = new Set();
  const appendSlot = (slot) => {
    if (renderedSlots.has(slot)) return;
    renderedSlots.add(slot);
    const data = bucketMap.get(slot) || {
      value: 0,
      viewersSum: 0,
      viewerSamples: 0,
      listedUsersSum: 0,
      listedUsersSamples: 0,
      tokensUsersSum: 0,
      tokensUsersSamples: 0,
      tokensUsersPeak: 0,
      unassignedTokens: 0,
    };
    const startLabel = formatSlot(slot);
    const endLabel = formatSlot(Math.min(1439, slot + step - 1));
    const shortLabel = step === 60 ? `${String(Math.floor(slot / 60)).padStart(2, "0")}h` : startLabel;
    const avgViewers = data.viewerSamples > 0
      ? Math.round(data.viewersSum / data.viewerSamples)
      : 0;
    const avgListedUsers = data.listedUsersSamples > 0
      ? Math.round(data.listedUsersSum / data.listedUsersSamples)
      : 0;
    const avgTokensUsers = data.tokensUsersSamples > 0
      ? Math.round(data.tokensUsersSum / data.tokensUsersSamples)
      : 0;
    const tokensUsersNote = data.tokensUsersSamples > 0
      ? ` • média ${avgTokensUsers} usuários com tokens`
      : "";

    result.push({
      label: shortLabel,
      value: Math.round(data.value),
      avgViewers,
      avgListedUsers,
      listedUsersSamples: data.listedUsersSamples,
      avgTokensUsers,
      tokensUsersSamples: data.tokensUsersSamples,
      tokensUsersPeak: data.tokensUsersPeak,
      tooltip: `${startLabel} - ${endLabel} (${step === 60 ? "1h" : `${step}m`}): ${Math.round(data.value)} tk • Média ${avgViewers} viewers • ${avgListedUsers} usuários listados${tokensUsersNote}${data.unassignedTokens > 0 ? ` • ${Math.round(data.unassignedTokens)} tk recuperados do total diário, sem minuto registrado` : ""}`,
    });
  };

  occupiedSlots.forEach((slot, index) => {
    appendSlot(slot);
    const nextSlot = occupiedSlots[index + 1];
    if (nextSlot === undefined) return;

    const gapMinutes = nextSlot - slot;
    if (gapMinutes <= 60) {
      for (let missingSlot = slot + step; missingSlot < nextSlot; missingSlot += step) {
        appendSlot(missingSlot);
      }
    }
  });

  return result;
}

function buildSessionBars(report, selectedSessionId, stepMinutes = 15) {
  const sessions = report.liveSessions || [];
  const activeSession =
    sessions.find((session) => session && session.sessionId === selectedSessionId) ||
    sessions[sessions.length - 1] ||
    null;

  const startMinStr = activeSession?.startedAt ? activeSession.startedAt.slice(0, 5) : null;
  const endText = String(activeSession?.endedAt || "");
  const endMinStr = /^\d{2}:\d{2}/.test(endText) ? endText.slice(0, 5) : null;

  return buildTimeBucketBars(activeSession?.minuteRows || [], stepMinutes, startMinStr, endMinStr);
}

function buildDayTimeBars(daily, minuteRows, stepMinutes = 60) {
  const step = [1, 2, 5, 10, 15, 20, 30, 60].includes(Number(stepMinutes))
    ? Number(stepMinutes)
    : 60;

  if (Array.isArray(minuteRows) && minuteRows.length > 0) {
    return buildTimeBucketBars(minuteRows, step);
  }

  if (step === 60 && Array.isArray(daily?.hourlyTokens) && daily.hourlyTokens.length === 24) {
    const hours = daily.hourlyTokens.map((value) => Number(value) || 0);
    const firstActive = hours.findIndex((value) => value > 0);
    let lastActive = -1;
    for (let hour = 23; hour >= 0; hour--) {
      if (hours[hour] > 0) {
        lastActive = hour;
        break;
      }
    }
    if (firstActive === -1) return [];
    const result = [];
    for (let hour = firstActive; hour <= lastActive; hour++) {
      const label = `${String(hour).padStart(2, "0")}h`;
      result.push({
        label,
        value: Math.round(hours[hour]),
        avgViewers: 0,
        tooltip: `${label} - ${String(hour).padStart(2, "0")}:59 → ${Math.round(hours[hour])} tk`,
      });
    }
    return result;
  }

  return [];
}

function buildDailyFlowMinuteRows(daily, currentBucket, currentTotalTokens) {
  const minuteBuckets = new Map();
  const mergeMinuteBuckets = (source) => {
    const entries = Array.isArray(source)
      ? source.filter((entry) => entry?.minute).map((entry) => [entry.minute, entry])
      : Object.entries(source || {});

    entries.forEach(([key, entry]) => {
      if (!entry || typeof entry !== "object") return;
      const minute = String(entry.minute || key || "");
      if (!minute) return;

      const saved = minuteBuckets.get(minute) || {};
      minuteBuckets.set(minute, {
        ...saved,
        ...entry,
        minute,
        tokens: Math.max(Number(saved.tokens) || 0, Number(entry.tokens) || 0),
        unassignedTokens: Math.max(
          Number(saved.unassignedTokens) || 0,
          Number(entry.unassignedTokens) || 0,
        ),
      });
    });
  };

  mergeMinuteBuckets(daily?.minuteBuckets);
  mergeMinuteBuckets(currentBucket?.minuteBuckets);

  const trackedTokens = Array.from(minuteBuckets.values()).reduce(
    (sum, bucket) => sum + Math.max(0, Number(bucket.tokens) || 0),
    0,
  );
  const dayStartTokens = currentBucket?.dayStartTokens ?? daily?.dayStartTokens;
  const currentDayTokens = dayStartTokens === undefined || dayStartTokens === null
    ? 0
    : Math.max(0, (Number(currentTotalTokens) || 0) - (Number(dayStartTokens) || 0));
  const expectedTokens = Math.max(
    Number(daily?.totalTokensDay) || 0,
    Number(daily?.dailyTokens) || 0,
    Number(currentBucket?.dailyTokens) || 0,
    currentDayTokens,
  );
  const unassignedTokens = Math.max(0, Math.round(expectedTokens - trackedTokens));

  if (unassignedTokens > 0) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = parts.find((part) => part.type === "hour")?.value || "00";
    const minute = parts.find((part) => part.type === "minute")?.value || "00";
    const currentMinute = `${hour}:${minute}`;
    const bucket = minuteBuckets.get(currentMinute) || { minute: currentMinute, tokens: 0 };
    bucket.tokens = (Number(bucket.tokens) || 0) + unassignedTokens;
    bucket.unassignedTokens = (Number(bucket.unassignedTokens) || 0) + unassignedTokens;
    minuteBuckets.set(currentMinute, bucket);
  }

  return normalizeMinuteBuckets(Object.fromEntries(minuteBuckets));
}

export {
  buildDailyFlowMinuteRows,
  buildDayTimeBars,
  buildSessionBars,
  buildTimeBucketBars,
  normalizeMinuteBuckets,
};
