import test from "node:test";
import assert from "node:assert/strict";
import {
  getAddedChatMessages,
  getChatMessageActivityKey,
} from "../src/core/chat-activity.js";

function message({ system = false } = {}) {
  return {
    nodeType: 1,
    system,
    matches: (selector) => selector.includes(".message-base"),
    querySelectorAll: () => [],
  };
}

test("chat activity only includes newly added non-system messages", () => {
  const newMessage = message();
  const systemMessage = message({ system: true });
  const existingMessage = message();
  const addedChild = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: () => [],
  };

  const messages = getAddedChatMessages(
    [
      { type: "characterData", target: existingMessage, addedNodes: [] },
      { type: "childList", addedNodes: [newMessage, systemMessage, addedChild] },
    ],
    (item) => item.system,
  );

  assert.deepEqual(messages, [newMessage]);
});

test("chat activity finds message elements inside newly added subtrees", () => {
  const nestedMessage = message();
  const addedContainer = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: () => [nestedMessage],
  };

  assert.deepEqual(
    getAddedChatMessages([{ type: "childList", addedNodes: [addedContainer] }]),
    [nestedMessage],
  );
});

test("chat activity ignores message elements already processed by the extension", () => {
  const processedMessage = message();
  processedMessage.processed = true;
  const newMessage = message();

  assert.deepEqual(
    getAddedChatMessages(
      [{ type: "childList", addedNodes: [processedMessage, newMessage] }],
      () => false,
      (item) => item.processed,
    ),
    [newMessage],
  );
});

test("chat activity keys remain stable when the same message node is recreated", () => {
  const makeMessage = () => ({
    dataset: {},
    textContent: "User Hello everyone",
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.startsWith("time")) {
        return {
          textContent: "22:19",
          getAttribute: (name) => name === "datetime" ? "2026-11-26T22:19:00" : null,
        };
      }
      if (selector.includes("username")) return { textContent: "User" };
      return null;
    },
  });

  assert.equal(
    getChatMessageActivityKey(makeMessage()),
    getChatMessageActivityKey(makeMessage()),
  );
});

test("chat activity prefers native message ids and distinguishes separate timestamps", () => {
  const withId = {
    dataset: { messageId: "native-1" },
    getAttribute: () => null,
  };
  assert.equal(getChatMessageActivityKey(withId), "id:native-1");

  const makeMessage = (timestamp) => ({
    textContent: "User Hello",
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.startsWith("time")) {
        return {
          textContent: timestamp,
          getAttribute: () => null,
        };
      }
      if (selector.includes("username")) return { textContent: "User" };
      return null;
    },
  });
  assert.notEqual(
    getChatMessageActivityKey(makeMessage("22:19")),
    getChatMessageActivityKey(makeMessage("22:20")),
  );
});
