function removeManualEntryFromCollection(records, entryId, onRemove) {
  const shouldKeep = (entry) => {
    const shouldRemove = entry?.manualEntry === true && String(entry.id || "") === entryId;
    if (shouldRemove) onRemove();
    return !shouldRemove;
  };
  if (Array.isArray(records)) return records.filter(shouldKeep);
  if (records && typeof records === "object") {
    return Object.fromEntries(
      Object.entries(records).filter(([, entry]) => shouldKeep(entry)),
    );
  }
  return records;
}

export function removeManualEntryFromDaily(daily, entryId) {
  if (!daily || typeof daily !== "object" || !entryId) {
    return { daily, removed: false };
  }

  let removed = false;
  const markRemoved = () => {
    removed = true;
  };
  const nextDaily = {
    ...daily,
    manualEarnings: removeManualEntryFromCollection(
      daily.manualEarnings,
      entryId,
      markRemoved,
    ),
    capturedEvents: removeManualEntryFromCollection(
      daily.capturedEvents,
      entryId,
      markRemoved,
    ),
  };

  if (daily.liveSessions && typeof daily.liveSessions === "object") {
    nextDaily.liveSessions = Object.fromEntries(
      Object.entries(daily.liveSessions).map(([sessionId, session]) => [
        sessionId,
        session && typeof session === "object"
          ? {
              ...session,
              manualEarnings: removeManualEntryFromCollection(
                session.manualEarnings,
                entryId,
                markRemoved,
              ),
              capturedEvents: removeManualEntryFromCollection(
                session.capturedEvents,
                entryId,
                markRemoved,
              ),
            }
          : session,
      ]),
    );
  }

  return { daily: nextDaily, removed };
}
