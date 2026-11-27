import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_STOP_IDLE_MS,
  getOfflineStopDelay,
  getLiveTimerIncrements,
  isOfflineStopDue,
  isRoomMonitorable,
} from "../src/core/offline-monitor.js";

test("gross time counts while waiting and pauses immediately when offline", () => {
  assert.deepEqual(
    getLiveTimerIncrements({
      elapsedSeconds: 5,
      isOffline: false,
      isLiveActive: false,
    }),
    { grossSeconds: 5, netSeconds: 0 },
  );
  assert.deepEqual(
    getLiveTimerIncrements({
      elapsedSeconds: 5,
      isOffline: true,
      isLiveActive: false,
    }),
    { grossSeconds: 0, netSeconds: 0 },
  );
  assert.deepEqual(
    getLiveTimerIncrements({
      elapsedSeconds: 5,
      isOffline: false,
      isLiveActive: true,
    }),
    { grossSeconds: 5, netSeconds: 5 },
  );
});

test("starts monitoring while the room is waiting, but not when offline", () => {
  assert.equal(
    isRoomMonitorable({
      isOffline: false,
      isLiveActive: false,
      isWaiting: true,
    }),
    true,
  );
  assert.equal(
    isRoomMonitorable({
      isOffline: true,
      isLiveActive: false,
      isWaiting: true,
    }),
    false,
  );
  assert.equal(
    isRoomMonitorable({
      isOffline: false,
      isLiveActive: true,
      isWaiting: false,
    }),
    true,
  );
  assert.equal(
    isRoomMonitorable({
      isOffline: false,
      isLiveActive: false,
      isWaiting: false,
    }),
    false,
  );
});

test("stops after the offline and chat idle thresholds have both elapsed", () => {
  const now = 9 * 60 * 1000;
  const offlineSinceAt = now - 8 * 60 * 1000;
  assert.equal(
    getOfflineStopDelay({
      now,
      offlineSinceAt,
      lastChatActivityAt: offlineSinceAt,
    }),
    0,
  );
  assert.equal(
    isOfflineStopDue({
      now,
      offlineSinceAt,
      lastChatActivityAt: offlineSinceAt,
    }),
    true,
  );
});

test("waits until two minutes after recent chat activity", () => {
  const now = 8 * 60 * 1000;
  const lastChatActivityAt = now - 60 * 1000;
  assert.equal(
    getOfflineStopDelay({
      now,
      offlineSinceAt: now - 8 * 60 * 1000,
      lastChatActivityAt,
    }),
    60 * 1000,
  );
  assert.equal(
    isOfflineStopDue({
      now,
      offlineSinceAt: now - 8 * 60 * 1000,
      lastChatActivityAt,
    }),
    false,
  );
  assert.equal(AUTO_STOP_IDLE_MS, 120 * 1000);
});

test("still waits two minutes after a newly detected offline state", () => {
  const now = 12 * 60 * 1000;
  const offlineSinceAt = now - 10 * 1000;
  const lastChatActivityAt = now - 5 * 60 * 1000;

  assert.equal(
    getOfflineStopDelay({ now, offlineSinceAt, lastChatActivityAt }),
    110 * 1000,
  );
  assert.equal(
    isOfflineStopDue({ now, offlineSinceAt, lastChatActivityAt }),
    false,
  );
});
