import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyDailyBucket,
  localDateKey,
  recordDailyLargestTip,
  recordDailyModerationLog,
  recordDailyMutedUser,
  processedMessageIds,
  state,
} from "../src/core/state.js";
import {
  isTicketPurchaseText,
  isTicketShowAnnouncementText,
  isTicketShowJoinText,
  isTicketTip,
  isTipMessage,
  isTipMenuMessage,
  parseTipMenuOption,
  isPendingTicketShowTip,
  isRecentTicketTipEvent,
  parseTicketShowJoinUsername,
  parseTicketPriceFromText,
  hasRecentTicketPurchase,
  recordTicketPurchaseActivity,
  checkActiveCamTicketPrice,
  processMessage,
  registerCapturedEvent,
  shouldIgnoreSystemMessage,
} from "../src/modules/events.js";

test("recognizes ticket show announcements and purchases in Portuguese, Spanish, and English", () => {
  [
    "Modelo anunciou um Ticket Show!",
    "¡La modelo ha anunciado un Ticket Show!",
    "Model has announced a Ticket Show!",
    "comprou o ingresso do show",
    "compró una entrada para el show",
    "bought a ticket for the show",
  ].forEach((text) => {
    assert.equal(isTicketShowAnnouncementText(text) || isTicketPurchaseText(text), true, text);
  });

  assert.equal(isTicketShowAnnouncementText("TestUser joined the Ticket Show"), false);
  assert.equal(isTicketShowAnnouncementText("TestUser bought a ticket for the show"), false);
  assert.equal(isTicketPurchaseText("TestUser got the Show Ticket"), true);
});

test("recognizes joining ticket shows in Portuguese, Spanish, and English", () => {
  assert.equal(isTicketShowJoinText("entrou no show por ingressos"), true);
  assert.equal(isTicketShowJoinText("se unió al show"), true);
  assert.equal(isTicketShowJoinText("se ha unido al Ticket Show"), true);
  assert.equal(isTicketShowJoinText("TestUser recibió el ticket del show"), true);
  assert.equal(isTicketShowJoinText("joined the ticket show"), true);
});

test("recognizes tip messages from Portuguese and Spanish text when CSS classes differ", () => {
  const createMessage = (textContent) => ({
    className: "",
    querySelector: () => null,
    textContent,
  });

  assert.equal(isTipMessage(createMessage("User One deu uma gorjeta de 24 tk")), true);
  assert.equal(isTipMessage(createMessage("TestUser ha dado 24 tk de propina")), true);
  assert.equal(isTipMessage(createMessage("User One sent a public message")), false);
});

test("recognizes and extracts Spanish tip-menu options", () => {
  const menuText = "🎚 Menú de propinas > Say my name";
  assert.equal(isTipMenuMessage(menuText), true);
  assert.equal(parseTipMenuOption(menuText), "Say my name");
  assert.equal(isTipMenuMessage("Menu de gorjetas > Beijo"), true);
  assert.equal(parseTipMenuOption("Menu de gorjetas > Beijo"), "Beijo");
});

test("classifies a menu tip before matching the current ticket price", () => {
  const dateKey = localDateKey();
  const previousState = {
    modelName: state.modelName,
    currentTicketPrice: state.currentTicketPrice,
    events: state.events,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    eventSummaryTotals: state.eventSummaryTotals,
    users: state.users,
    sessionId: state.sessionId,
  };
  const messageId = "spanish-menu-tip-matches-ticket-price";
  const menuOption = "Menú de propinas > DICK RATE (1-10)";
  const message = {
    className: "TipMessage",
    classList: { contains: () => false },
    dataset: { messageId },
    textContent: `Fellii556 ha dado 40 tk de propina ${menuOption}`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.includes("amountHighlight")) return { textContent: "40 tk" };
      if (selector.includes("commentTipMenu") || selector.includes("tipMenuLink")) {
        return { textContent: menuOption };
      }
      if (selector.includes(".user-levels-username-text")) {
        return { textContent: "Fellii556" };
      }
      return null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };

  state.modelName = "TestModel";
  state.currentTicketPrice = 40;
  state.events = [];
  state.capturedEvents = [];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.eventSummaryTotals = {};
  state.users = {};
  state.sessionId = null;
  try {
    processMessage(message);
    assert.equal(state.capturedEvents[0]?.type, "Menu de Gorjetas");
    assert.equal(state.capturedEvents[0]?.menuOption, "DICK RATE (1-10)");
    assert.equal(state.eventSummaryTotals["DICK RATE (1-10)"]?.tokens, 40);
    assert.equal(state.eventSummaryTotals.Menu, undefined);
  } finally {
    processedMessageIds.delete(messageId);
    Object.assign(state, previousState);
  }
});

test("processes ordinary chat messages without requiring plugin classes", () => {
  const message = {
    className: "",
    classList: { contains: () => false },
    dataset: {},
    textContent: "RuntimeTestUser says hello",
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) =>
      selector.includes(".user-levels-username-text")
        ? { textContent: "RuntimeTestUser" }
        : null,
    querySelectorAll: () => [],
    cloneNode: () => ({
      textContent: "says hello",
      querySelectorAll: () => [],
    }),
  };

  const previousModelName = state.modelName;
  state.modelName = "TestModel";
  try {
    assert.doesNotThrow(() => processMessage(message));
  } finally {
    state.modelName = previousModelName;
  }
});

test("extracts the username from localized ticket-show join messages", () => {
  assert.equal(
    parseTicketShowJoinUsername("TestUser se ha unido al Ticket Show"),
    "TestUser",
  );
  assert.equal(
    parseTicketShowJoinUsername("TestUser recibió el ticket del show"),
    "TestUser",
  );
  assert.equal(
    parseTicketShowJoinUsername("ModelUser entrou no show por ingressos"),
    "ModelUser",
  );
  assert.equal(
    parseTicketShowJoinUsername("ModelUser joined the ticket show"),
    "ModelUser",
  );
});

test("reads ticket prices from localized purchase controls only", () => {
  assert.equal(parseTicketPriceFromText("Buy ticket for 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Comprar entrada por 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Comprar un boleto por 12 tk"), 12);
  assert.equal(parseTicketPriceFromText("Tip menu for 8 tk"), 0);
});

test("clears the previous ticket price when no active purchase control is found", () => {
  const previousPrice = state.currentTicketPrice;
  const previousDocument = globalThis.document;
  state.currentTicketPrice = 44;
  globalThis.document = { querySelectorAll: () => [{ textContent: "Tip menu for 44 tk" }] };

  try {
    checkActiveCamTicketPrice();
    assert.equal(state.currentTicketPrice, 0);

    globalThis.document.querySelectorAll = () => [{ textContent: "Buy ticket for 40 tk" }];
    checkActiveCamTicketPrice();
    assert.equal(state.currentTicketPrice, 40);
  } finally {
    state.currentTicketPrice = previousPrice;
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
});

test("does not restore a ticket price from old chat announcements", () => {
  const previousPrice = state.currentTicketPrice;
  const messageId = "old-ticket-show-announcement";
  const message = {
    classList: { contains: (className) => className === "TicketShowAnnouncedBaseMessage" },
    dataset: { messageId },
    textContent: "Ticket Show announced for 44 tk",
    querySelector: () => null,
    getAttribute: () => null,
  };
  state.currentTicketPrice = 0;

  try {
    processMessage(message, { ignoreTicketPriceAnnouncement: true });
    assert.equal(state.currentTicketPrice, 0);
  } finally {
    processedMessageIds.delete(messageId);
    state.currentTicketPrice = previousPrice;
  }
});

test("keeps a ticket-show join pending for the following tip message", () => {
  assert.equal(isPendingTicketShowTip({ _ticketShowJoinedAt: 1000 }, 15999), true);
  assert.equal(isPendingTicketShowTip({ _ticketShowJoinedAt: 1000 }, 16001), false);
  assert.equal(isPendingTicketShowTip({ _ticketShowJoinedAt: 2000 }, 1999), false);
  assert.equal(
    isTicketTip({
      user: { _ticketShowJoinedAt: 1000 },
      ticketPrice: 44,
      tipAmount: 44,
      now: 2000,
    }),
    true,
  );
});

test("does not classify a pending ticket join when the tip amount differs from the known ticket price", () => {
  assert.equal(
    isTicketTip({
      user: { _ticketShowJoinedAt: 1000 },
      ticketPrice: 44,
      tipAmount: 40,
      hasTicketDOM: false,
      messageText: "Arnoldo3333 deu uma gorjeta de 40 tk",
      now: 2000,
    }),
    false,
  );
});

test("classifies an exact ticket-price match even without a pending join", () => {
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 44,
    }),
    true,
  );
});

test("classifies a price-mismatched tip only while a same-user ticket purchase is pending", () => {
  const tip = {
    user: { _ticketPurchaseAt: 1000 },
    ticketPrice: 44,
    tipAmount: 40,
    now: 2000,
  };
  assert.equal(isTicketTip(tip), true);
  assert.equal(
    isTicketTip({
      ...tip,
      user: {},
    }),
    false,
  );
});

test("keeps a pending ticket join when the ticket price is unknown", () => {
  assert.equal(
    isTicketTip({
      user: { _ticketShowJoinedAt: 1000 },
      ticketPrice: 0,
      tipAmount: 40,
      now: 2000,
    }),
    true,
  );
});

test("reclassifies a recent same-user tip as a ticket when the ticket price is unknown", () => {
  const event = {
    user: "TestUser",
    type: "Gorjeta Avulsa",
    price: 8,
    timestamp: 1000,
  };

  assert.equal(isRecentTicketTipEvent(event, "TestUser", 2000), true);
  assert.equal(isRecentTicketTipEvent(event, "TestUser", 2000), true);
  assert.equal(isRecentTicketTipEvent(event, "Other", 2000), false);
  assert.equal(isRecentTicketTipEvent(event, "TestUser", 16001), false);
});

test("keeps the chat tab active briefly after ticket purchases", () => {
  recordTicketPurchaseActivity(1000);

  assert.equal(hasRecentTicketPurchase(15999), true);
  assert.equal(hasRecentTicketPurchase(16000), false);
  assert.equal(hasRecentTicketPurchase(999), false);
});

test("keeps the chat tab active after users join a ticket show", () => {
  const messageId = "joined-ticket-show-keeps-chat";
  const previousModelName = state.modelName;
  const previousUsers = state.users;
  const message = {
    classList: { contains: () => false },
    dataset: { messageId },
    textContent: "TicketJoinUser joined the ticket show",
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) =>
      selector.includes(".user-levels-username-text")
        ? { textContent: "TicketJoinUser" }
        : null,
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };

  state.modelName = "TestModel";
  state.users = {};
  try {
    processMessage(message);
    assert.equal(hasRecentTicketPurchase(), true);
  } finally {
    processedMessageIds.delete(messageId);
    state.modelName = previousModelName;
    state.users = previousUsers;
  }
});

test("does not discard system-styled content purchase messages", () => {
  const createMessage = (classes, textContent = "") => ({
    classList: { contains: (className) => classes.includes(className) },
    matches: () => false,
    querySelector: () => null,
    textContent,
  });

  assert.equal(shouldIgnoreSystemMessage(createMessage(["m-bg-system"])), true);
  assert.equal(
    shouldIgnoreSystemMessage(createMessage(["m-bg-system"], "Dudu576 se ha unido al Ticket Show")),
    false,
  );
  assert.equal(
    shouldIgnoreSystemMessage(
      createMessage(["m-bg-system", "user-bought-content-message"]),
    ),
    false,
  );
  assert.equal(
    shouldIgnoreSystemMessage(createMessage(["m-bg-system"], "acabou de comprar vídeo")),
    false,
  );
  assert.equal(
    shouldIgnoreSystemMessage({
      classList: { contains: (className) => className === "m-bg-action" },
      querySelector: (selector) =>
        selector.includes("TicketShowGotTicket") ? {} : null,
      textContent: "TestUser got the Show Ticket",
    }),
    false,
  );
});

test("reclassifies a recent same-user tip when the purchase message arrives", () => {
  const dateKey = localDateKey();
  const previousState = {
    modelName: state.modelName,
    currentTicketPrice: state.currentTicketPrice,
    events: state.events,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    eventSummaryTotals: state.eventSummaryTotals,
    users: state.users,
    sessionId: state.sessionId,
  };
  const messageId = "buyer-got-show-ticket";
  const tipTimestamp = Date.now() - 1000;
  const capturedTip = {
    id: "buyer-tip",
    item: "Gorjeta Avulsa",
    price: 40,
    type: "Gorjeta Avulsa",
    user: "TicketBuyer",
    timestamp: tipTimestamp,
  };
  const generalTip = { ...capturedTip };
  const purchaseMessage = {
    classList: { contains: (className) => className === "m-bg-action" },
    dataset: { messageId },
    textContent: "TicketBuyer got the Show Ticket",
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.includes("TicketShowGotTicket")) return {};
      if (selector.includes(".user-levels-username-text")) {
        return { textContent: "TicketBuyer" };
      }
      return null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };

  state.modelName = "TestModel";
  state.currentTicketPrice = 44;
  state.events = [generalTip];
  state.capturedEvents = [capturedTip];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.dailyBuckets[dateKey].capturedEvents = state.capturedEvents;
  state.eventSummaryTotals = {
    "Gorjeta Avulsa": { count: 1, tokens: 40, type: "Gorjeta Avulsa" },
  };
  state.users = {};
  state.sessionId = null;

  try {
    processMessage(purchaseMessage, { ignoreTicketPurchaseCorrelation: true });
    assert.equal(state.capturedEvents[0].type, "Gorjeta Avulsa");
    assert.equal(state.users.TicketBuyer._ticketPurchaseAt, undefined);
    processedMessageIds.delete(messageId);
    delete purchaseMessage.dataset.scmSeen;

    processMessage(purchaseMessage);

    assert.equal(state.capturedEvents[0].type, "Ingresso Ticket");
    assert.equal(state.events[0].type, "Ingresso Ticket");
    assert.equal(state.currentTicketPrice, 44);
    assert.equal(state.eventSummaryTotals["Gorjeta Avulsa"], undefined);
    assert.equal(state.eventSummaryTotals.Ticket.tokens, 40);
  } finally {
    processedMessageIds.delete(messageId);
    Object.assign(state, previousState);
  }
});

test("accumulates named menu options and roulette outcomes in the daily report bucket", () => {
  const dateKey = localDateKey();
  state.capturedEvents = [];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.eventSummaryTotals = {};

  registerCapturedEvent("Kiss", 20, "Menu de Gorjetas", "menu-1", "User One", {
    menuOption: "Kiss",
  });
  registerCapturedEvent("Kiss", 15, "Menu de Gorjetas", "menu-2", "User Two", {
    menuOption: "Kiss",
  });
  registerCapturedEvent("Wheel: Gold", 0, "Gold", "wheel-1", "User One", {
    rouletteOutcome: "Gold",
  });
  registerCapturedEvent("Wheel: Gold", 0, "Gold", "wheel-2", "User Two", {
    rouletteOutcome: "Gold",
  });
  registerCapturedEvent("Wheel: Gold", 12, "Resultado da Roleta", "wheel-3", "User One", {
    rouletteOutcome: "Gold",
  });

  assert.deepEqual(state.dailyBuckets[dateKey].menuOptionTotals.Kiss, {
    label: "Kiss",
    count: 2,
    tokens: 35,
  });
  assert.deepEqual(state.eventSummaryTotals.Kiss, {
    count: 2,
    tokens: 35,
    type: "Menu de Gorjetas",
  });
  assert.equal(state.eventSummaryTotals.Menu, undefined);
  assert.deepEqual(state.dailyBuckets[dateKey].rouletteOutcomeTotals.Gold, {
    label: "Gold",
    count: 3,
    tokens: 12,
  });
  assert.deepEqual(state.eventSummaryTotals.Gold, {
    count: 1,
    tokens: 12,
    type: "Resultado da Roleta",
  });
  assert.deepEqual(state.dailyBuckets[dateKey].largestTip, {
    username: "User One",
    tokens: 20,
    item: "Kiss",
    type: "Menu de Gorjetas",
    menuOption: "Kiss",
    rouletteOutcome: "",
    timestamp: state.dailyBuckets[dateKey].capturedEvents[0].timestamp,
  });
});

test("keeps the largest daily tip even when event details are capped", () => {
  const dateKey = localDateKey();
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  recordDailyLargestTip({
    user: "User One",
    price: 500,
    item: "Wheel: Gold",
    type: "Roleta",
    rouletteOutcome: "Gold",
    timestamp: Date.now(),
  }, dateKey);
  recordDailyLargestTip({
    user: "User Two",
    price: 200,
    item: "Kiss",
    type: "Menu",
    timestamp: Date.now(),
  }, dateKey);

  assert.equal(state.dailyBuckets[dateKey].largestTip.username, "User One");
  assert.equal(state.dailyBuckets[dateKey].largestTip.tokens, 500);
});

test("keeps daily moderation metrics compact and updates pending outcomes", () => {
  const dateKey = localDateKey();
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  const timestamp = Date.now();
  recordDailyMutedUser({
    username: "Muted",
    mutedBy: "Moderator",
    lastMessage: "private chat text",
    timestamp,
  });
  recordDailyModerationLog({
    id: "moderation-1",
    user: "Muted",
    status: "PENDENTE",
    message: "private chat text",
    timestamp,
  });
  recordDailyModerationLog({
    id: "moderation-1",
    user: "Muted",
    status: "SUCESSO",
    message: "private chat text",
    timestamp,
  });

  const daily = state.dailyBuckets[dateKey];
  assert.deepEqual(daily.moderationStats, {
    attempts: 1,
    successes: 1,
    failures: 0,
    pending: 0,
  });
  assert.deepEqual(daily.mutedUsers[0], {
    username: "Muted",
    mutedBy: "Moderator",
    timestamp,
    _timestamp: timestamp,
  });
  assert.equal(daily.moderationLogs, undefined);
});
