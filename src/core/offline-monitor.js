export const AUTO_STOP_IDLE_MS = 2 * 60 * 1000;

export function isRoomMonitorable({ isOffline, isLiveActive, isWaiting }) {
  return !isOffline && (isLiveActive || isWaiting);
}

export function getLiveTimerIncrements({ elapsedSeconds, isOffline, isLiveActive }) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  return {
    grossSeconds: isOffline ? 0 : elapsed,
    netSeconds: !isOffline && isLiveActive ? elapsed : 0,
  };
}

export function getOfflineStopDelay({
  now,
  offlineSinceAt,
  lastChatActivityAt,
  idleMs = AUTO_STOP_IDLE_MS,
}) {
  const stopAt = Math.max(
    (Number(offlineSinceAt) || 0) + idleMs,
    (Number(lastChatActivityAt) || 0) + idleMs,
  );
  return Math.max(0, stopAt - now);
}

export function isOfflineStopDue({
  now,
  offlineSinceAt,
  lastChatActivityAt,
  idleMs = AUTO_STOP_IDLE_MS,
}) {
  return (
    Number(offlineSinceAt) > 0 &&
    now - Number(offlineSinceAt) >= idleMs &&
    now - Number(lastChatActivityAt) >= idleMs
  );
}
