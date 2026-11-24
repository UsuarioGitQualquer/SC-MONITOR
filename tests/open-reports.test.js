import assert from "node:assert/strict";
import test from "node:test";
import { openReportsPage } from "../src/ui/open-reports.js";

test("opens the extension reports page", () => {
  let sentMessage;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        sentMessage = message;
        callback({ ok: true });
      },
    },
  };

  try {
    openReportsPage();
    assert.deepEqual(sentMessage, { type: "SCM_OPEN_REPORTS" });
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("reports errors returned by the background when opening reports", () => {
  const previousChrome = globalThis.chrome;
  let receivedError;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (_message, callback) => {
        callback({ ok: false, error: "tabs permission denied" });
      },
    },
  };

  try {
    openReportsPage((error) => {
      receivedError = error;
    });
    assert.equal(receivedError.message, "tabs permission denied");
  } finally {
    globalThis.chrome = previousChrome;
  }
});
