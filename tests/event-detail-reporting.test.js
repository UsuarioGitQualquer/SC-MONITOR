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
  isShowCancellationMessage,
  parseTicketPurchaseUsername,
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
  assert.equal(parseTicketPurchaseUsername("TestUser bought a ticket for the show"), "TestUser");
  assert.equal(parseTicketPurchaseUsername("Usuario compró una entrada para el show"), "Usuario");
});

test("recognizes joining ticket shows in Portuguese, Spanish, and English", () => {
  assert.equal(isTicketShowJoinText("entrou no show por ingressos"), true);
  assert.equal(isTicketShowJoinText("TicketUserPt juntou-se ao Ticket Show"), true);
  assert.equal(isTicketShowJoinText("se unió al Ticket Show"), true);
  assert.equal(isTicketShowJoinText("se ha unido al Ticket Show"), true);
  assert.equal(isTicketShowJoinText("TestUser recibió el ticket del show"), true);
  assert.equal(isTicketShowJoinText("joined the ticket show"), true);
  assert.equal(isTicketShowJoinText("GroupUserBr entrou no show de grupo"), false);
  assert.equal(isTicketShowJoinText("GroupUserPt juntou-se ao Show de Grupo"), false);
  assert.equal(isTicketShowJoinText("GroupUserEs se ha unido al Show Grupal"), false);
  assert.equal(isTicketShowJoinText("GroupUserEn joined the Group Show"), false);
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
    parseTicketShowJoinUsername("TicketUserPt juntou-se ao Ticket Show"),
    "TicketUserPt",
  );
  assert.equal(
    parseTicketShowJoinUsername("ModelUser joined the ticket show"),
    "ModelUser",
  );
});

test("reads ticket prices from localized purchase controls only", () => {
  assert.equal(parseTicketPriceFromText("Buy ticket for 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Get Ticket 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Obtener ticket 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Obter bilhete 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Comprar entrada por 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Comprar ingresso por 8 tk"), 8);
  assert.equal(parseTicketPriceFromText("Comprar un boleto por 12 tk"), 12);
  assert.equal(parseTicketPriceFromText("Tip menu for 8 tk"), 0);
});

test("preserves the known ticket price when no purchase control is found", () => {
  const previousPrice = state.currentTicketPrice;
  const previousTicketShowStartedAt = state.currentTicketShowStartedAt;
  const previousDocument = globalThis.document;
  state.currentTicketPrice = 44;
  state.currentTicketShowStartedAt = 0;
  globalThis.document = { querySelectorAll: () => [{ textContent: "Tip menu for 44 tk" }] };

  try {
    checkActiveCamTicketPrice();
    assert.equal(state.currentTicketPrice, 44);
    assert.equal(state.currentTicketShowStartedAt, 0);

    globalThis.document.querySelectorAll = () => [{ textContent: "Buy ticket for 40 tk" }];
    checkActiveCamTicketPrice();
    assert.equal(state.currentTicketPrice, 40);
    assert.equal(state.currentTicketShowStartedAt, 0);
  } finally {
    state.currentTicketPrice = previousPrice;
    state.currentTicketShowStartedAt = previousTicketShowStartedAt;
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
});

test("replays the ticket announcement price before processing later chat messages", () => {
  const previousPrice = state.currentTicketPrice;
  const previousTicketShowStartedAt = state.currentTicketShowStartedAt;
  const messageId = "old-ticket-show-announcement";
  const newerMessageId = "newer-ticket-show-announcement";
  const message = {
    classList: {
      contains: (className) =>
        className === "TicketShowAnnouncedBaseMessage" ||
        className === "m-bg-system",
    },
    dataset: { messageId },
    textContent: "Ticket Show announced for 44 tk",
    querySelector: (selector) =>
      selector.includes("TicketShowAnnouncedBaseMessage__highlight")
        ? { textContent: "44 tk" }
        : null,
    getAttribute: () => null,
  };
  const newerMessage = {
    ...message,
    dataset: { messageId: newerMessageId },
    querySelector: (selector) =>
      selector.includes("TicketShowAnnouncedBaseMessage__highlight")
        ? { textContent: "90 tk" }
        : null,
  };
  state.currentTicketPrice = 0;
  state.currentTicketShowStartedAt = 0;

  try {
    processMessage(message, { ignoreTicketPurchaseCorrelation: true });
    assert.equal(state.currentTicketPrice, 44);
    const firstAnnouncementAt = state.currentTicketShowStartedAt;
    assert.ok(firstAnnouncementAt > 0);

    processMessage(newerMessage, { ignoreTicketPurchaseCorrelation: true });
    assert.equal(state.currentTicketPrice, 90);
    assert.ok(state.currentTicketShowStartedAt > firstAnnouncementAt);
  } finally {
    processedMessageIds.delete(messageId);
    processedMessageIds.delete(newerMessageId);
    state.currentTicketPrice = previousPrice;
    state.currentTicketShowStartedAt = previousTicketShowStartedAt;
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
      now: 2000,
    }),
    false,
  );
});

test("classifies higher tips only before a ticket show starts, and exact-price tips while active", () => {
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 44,
      messageText: "User deu uma gorjeta de 44 tk",
      isActiveTicketShow: true,
      isFirstTicketPriceTipInShow: true,
    }),
    true,
  );
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 60,
      messageText: "User deu uma gorjeta de 60 tk",
      isActiveTicketShow: false,
      isFirstTicketPriceTipInShow: true,
    }),
    true,
  );
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 44,
      messageText: "User deu uma gorjeta de 44 tk",
      isActiveTicketShow: false,
      isFirstTicketPriceTipInShow: true,
    }),
    true,
  );
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 60,
      messageText: "User deu uma gorjeta de 60 tk",
      isActiveTicketShow: true,
      isFirstTicketPriceTipInShow: true,
    }),
    false,
  );
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 44,
      messageText: "User deu uma gorjeta de 44 tk",
      isActiveTicketShow: true,
      isFirstTicketPriceTipInShow: false,
    }),
    false,
  );
  assert.equal(
    isTicketTip({
      user: {},
      ticketPrice: 44,
      tipAmount: 40,
      messageText: "User deu uma gorjeta de 40 tk",
      isActiveTicketShow: false,
      isFirstTicketPriceTipInShow: true,
    }),
    false,
  );
});

test("classifies higher tips before the show starts and exact-price tips once it is active", () => {
  const dateKey = localDateKey();
  const previousState = {
    modelName: state.modelName,
    currentTicketPrice: state.currentTicketPrice,
    currentTicketShowStartedAt: state.currentTicketShowStartedAt,
    currentTicketShowActive: state.currentTicketShowActive,
    events: state.events,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    eventSummaryTotals: state.eventSummaryTotals,
    users: state.users,
    sessionId: state.sessionId,
  };
  const previousDocument = globalThis.document;
  const announcementId = "ticket-announcement-before-show";
  const announcement = {
    classList: {
      contains: (className) =>
        className === "TicketShowAnnouncedBaseMessage" ||
        className === "m-bg-system",
    },
    dataset: { messageId: announcementId },
    textContent: "Ticket show announcement",
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) =>
      selector.includes("TicketShowAnnouncedBaseMessage__highlight")
        ? { textContent: "60 tk" }
        : null,
  };
  const makeTipMessage = (messageId, username, amount) => ({
    className: "TipMessage",
    classList: { contains: () => false },
    dataset: { messageId },
    textContent: `${username} deu uma gorjeta de ${amount} tk`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.includes("amountHighlight")) return { textContent: `${amount} tk` };
      if (selector.includes("username")) return { textContent: username };
      return null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  });
  const messageIds = [
    "ticket-other-tip-a",
    "ticket-first-price-tip-a",
    "ticket-second-price-tip-a",
    "ticket-first-tip-b",
    "ticket-first-higher-tip-c",
    "ticket-second-higher-tip-c",
    "ticket-higher-tip-during-show",
    "ticket-exact-tip-during-show",
  ];

  state.modelName = "TestModel";
  state.currentTicketPrice = 0;
  state.currentTicketShowStartedAt = 0;
  state.currentTicketShowActive = false;
  state.events = [];
  state.capturedEvents = [];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.eventSummaryTotals = {};
  state.users = {};
  state.sessionId = null;
  try {
    processMessage(announcement);
    const announcedAt = state.currentTicketShowStartedAt;
    assert.ok(announcedAt > 0);
    assert.equal(state.currentTicketPrice, 60);

    processMessage(makeTipMessage(messageIds[0], "BuyerA", 20));
    processMessage(makeTipMessage(messageIds[1], "BuyerA", 60));
    processMessage(makeTipMessage(messageIds[2], "BuyerA", 60));
    processMessage(makeTipMessage(messageIds[3], "BuyerB", 60));
    processMessage(makeTipMessage(messageIds[4], "BuyerC", 75));
    processMessage(makeTipMessage(messageIds[5], "BuyerC", 80));
    state.currentTicketShowActive = true;
    processMessage(makeTipMessage(messageIds[6], "BuyerD", 75));
    processMessage(makeTipMessage(messageIds[7], "BuyerE", 60));

    assert.deepEqual(
      state.capturedEvents.map((event) => event.type),
      [
        "Gorjeta Avulsa",
        "Ingresso Ticket",
        "Gorjeta Avulsa",
        "Ingresso Ticket",
        "Ingresso Ticket",
        "Gorjeta Avulsa",
        "Gorjeta Avulsa",
        "Ingresso Ticket",
      ],
    );
    assert.equal(
      state.users.BuyerA._ticketShowTicketPriceTipAt,
      announcedAt,
    );
    assert.equal(
      state.users.BuyerB._ticketShowTicketPriceTipAt,
      announcedAt,
    );
    assert.equal(
      state.users.BuyerC._ticketShowTicketPriceTipAt,
      announcedAt,
    );
  } finally {
    processedMessageIds.delete(announcementId);
    messageIds.forEach((messageId) => processedMessageIds.delete(messageId));
    Object.assign(state, previousState);
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
});

test("matches a replayed advance purchase to the same user's ticket-price tip", () => {
  const dateKey = localDateKey();
  const previousState = {
    modelName: state.modelName,
    currentTicketPrice: state.currentTicketPrice,
    currentTicketShowStartedAt: state.currentTicketShowStartedAt,
    events: state.events,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    eventSummaryTotals: state.eventSummaryTotals,
    users: state.users,
    sessionId: state.sessionId,
  };
  const purchaseMessageId = "advance-ticket-purchase";
  const tipMessageId = "advance-ticket-tip";
  const username = "AdvanceBuyer";
  const purchaseMessage = {
    classList: { contains: (className) => className === "m-bg-action" },
    dataset: { messageId: purchaseMessageId },
    textContent: `${username} comprou o ingresso do show`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) =>
      selector.includes("TicketShowGotTicket")
        ? {}
        : selector.includes(".user-levels-username-text")
          ? { textContent: username }
          : null,
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };
  const tipMessage = {
    className: "TipMessage",
    classList: { contains: () => false },
    dataset: { messageId: tipMessageId },
    textContent: `${username} deu uma gorjeta de 16 tk`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.includes("amountHighlight")) return { textContent: "16 tk" };
      if (selector.includes("username")) return { textContent: username };
      return null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };

  state.modelName = "TestModel";
  state.currentTicketPrice = 16;
  state.currentTicketShowStartedAt = 0;
  state.events = [];
  state.capturedEvents = [];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.eventSummaryTotals = {};
  state.users = {};
  state.sessionId = null;

  try {
    processMessage(purchaseMessage, { ignoreTicketPurchaseCorrelation: true });
    processMessage(tipMessage);

    assert.equal(
      state.capturedEvents.find((event) => event.id === tipMessageId)?.type,
      "Ingresso Ticket",
    );
    assert.equal(state.eventSummaryTotals.Ticket?.tokens, 16);
    assert.equal(state.users[username]._ticketAdvancePurchasePending, false);
  } finally {
    processedMessageIds.delete(purchaseMessageId);
    processedMessageIds.delete(tipMessageId);
    Object.assign(state, previousState);
  }
});

test("reads the current ticket price before correlating a live ticket purchase and tip", () => {
  const dateKey = localDateKey();
  const previousState = {
    modelName: state.modelName,
    currentTicketPrice: state.currentTicketPrice,
    currentTicketShowStartedAt: state.currentTicketShowStartedAt,
    currentTicketShowActive: state.currentTicketShowActive,
    events: state.events,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    eventSummaryTotals: state.eventSummaryTotals,
    users: state.users,
    sessionId: state.sessionId,
  };
  const previousDocument = globalThis.document;
  const username = "TicketPriceRaceBuyer";
  const purchaseMessageId = "live-ticket-price-purchase";
  const tipMessageId = "live-ticket-price-tip";
  const purchaseMessage = {
    classList: { contains: () => false },
    dataset: { messageId: purchaseMessageId },
    textContent: `${username} comprou o ingresso do show`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) =>
      selector.includes(".user-levels-username-text")
        ? { textContent: username }
        : null,
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };
  const tipMessage = {
    className: "TipMessage",
    classList: { contains: () => false },
    dataset: { messageId: tipMessageId },
    textContent: `${username} deu uma gorjeta de 150 tk`,
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (selector.includes("amountHighlight")) return { textContent: "150 tk" };
      if (selector.includes("username")) return { textContent: username };
      return null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  };

  state.modelName = "TestModel";
  state.currentTicketPrice = 0;
  state.currentTicketShowStartedAt = 0;
  state.currentTicketShowActive = false;
  state.events = [];
  state.capturedEvents = [];
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  state.eventSummaryTotals = {};
  state.users = {};
  state.sessionId = null;
  globalThis.document = {
    querySelectorAll: () => [{ textContent: "Comprar ingresso por 150 tk" }],
  };

  try {
    processMessage(purchaseMessage);
    assert.equal(state.currentTicketPrice, 150);
    processMessage(tipMessage);

    assert.equal(
      state.capturedEvents.find((event) => event.id === tipMessageId)?.type,
      "Ingresso Ticket",
    );
    assert.equal(state.eventSummaryTotals.Ticket?.tokens, 150);
  } finally {
    processedMessageIds.delete(purchaseMessageId);
    processedMessageIds.delete(tipMessageId);
    Object.assign(state, previousState);
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
});

test("requires a ticket-price match even when a ticket purchase is pending", () => {
  const tip = {
    user: { _ticketPurchaseAt: 1000 },
    ticketPrice: 44,
    tipAmount: 40,
    now: 2000,
  };
  assert.equal(isTicketTip(tip), false);
  assert.equal(isTicketTip({ ...tip, tipAmount: 44 }), true);
  assert.equal(
    isTicketTip({
      ...tip,
      user: {},
    }),
    false,
  );
  assert.equal(
    isTicketTip({
      user: {
        _ticketAdvancePurchasePending: true,
        _ticketAdvancePurchasePrice: 44,
      },
      ticketPrice: 44,
      tipAmount: 40,
    }),
    false,
  );
});

test("does not classify a pending ticket join while the ticket price is unknown", () => {
  assert.equal(
    isTicketTip({
      user: { _ticketShowJoinedAt: 1000 },
      ticketPrice: 0,
      tipAmount: 40,
      now: 2000,
    }),
    false,
  );
});

test("matches a recent tip by user and time", () => {
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

test("records ticket and group show participants for daily reports", () => {
  const messageIds = [
    "ticket-participant-report",
    "group-participant-report",
    "ticket-got-ticket-participant-report",
    "ticket-pt-pt-participant-report",
    "group-pt-br-participant-report",
    "group-pt-pt-participant-report",
    "group-es-participant-report",
    "group-en-participant-report",
  ];
  const previousState = {
    modelName: state.modelName,
    users: state.users,
    capturedEvents: state.capturedEvents,
    dailyBuckets: state.dailyBuckets,
    events: state.events,
    sessionId: state.sessionId,
  };
  const createJoinMessage = (
    messageId,
    username,
    isGroupShow,
    textContent = "",
    hasTicketGotClass = false,
  ) => ({
    classList: {
      contains: (className) =>
        isGroupShow && className === "group-show-user-joined-message",
    },
    dataset: { messageId },
    textContent: textContent || (isGroupShow
      ? `${username} joined the group show`
      : `${username} joined the ticket show`),
    closest: () => null,
    matches: () => false,
    getAttribute: () => null,
    querySelector: (selector) => {
      if (hasTicketGotClass && selector.includes("TicketShowGotTicket")) return {};
      return selector.includes("username") || selector.includes("user-levels-username-text")
        ? { textContent: username }
        : null;
    },
    querySelectorAll: () => [],
    cloneNode: () => ({ textContent: "", querySelectorAll: () => [] }),
  });

  state.modelName = "TestModel";
  state.users = {};
  state.capturedEvents = [];
  state.dailyBuckets = {};
  state.events = [];
  state.sessionId = null;
  try {
    processMessage(createJoinMessage(messageIds[0], "TicketUser", false));
    processMessage(createJoinMessage(messageIds[1], "GroupUser", true));
    processMessage(createJoinMessage(
      messageIds[2],
      "TicketGotUser",
      false,
      "TicketGotUser received the ticket for the show",
      true,
    ));
    processMessage(createJoinMessage(
      messageIds[3],
      "TicketUserPt",
      true,
      "TicketUserPt juntou-se ao Ticket Show",
    ));
    processMessage(createJoinMessage(
      messageIds[4],
      "GroupUserBr",
      true,
      "GroupUserBr entrou no show de grupo",
    ));
    processMessage(createJoinMessage(
      messageIds[5],
      "GroupUserPt",
      true,
      "GroupUserPt juntou-se ao Show de Grupo",
    ));
    processMessage(createJoinMessage(
      messageIds[6],
      "GroupUserEs",
      true,
      "GroupUserEs se ha unido al Show Grupal",
    ));
    processMessage(createJoinMessage(
      messageIds[7],
      "GroupUserEn",
      true,
      "GroupUserEn joined the Group Show",
    ));

    const records = state.dailyBuckets[localDateKey()].capturedEvents;
    assert.deepEqual(records.map(({ user, showParticipantType }) => ({
      user,
      showParticipantType,
    })), [
      { user: "TicketUser", showParticipantType: "ticket" },
      { user: "GroupUser", showParticipantType: "group" },
      { user: "TicketGotUser", showParticipantType: "ticket" },
      { user: "TicketUserPt", showParticipantType: "ticket" },
      { user: "GroupUserBr", showParticipantType: "group" },
      { user: "GroupUserPt", showParticipantType: "group" },
      { user: "GroupUserEs", showParticipantType: "group" },
      { user: "GroupUserEn", showParticipantType: "group" },
    ]);
  } finally {
    messageIds.forEach((messageId) => processedMessageIds.delete(messageId));
    recordTicketPurchaseActivity(Date.now() - 60000);
    Object.assign(state, previousState);
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
  const cancelledShow = {
    classList: {
      contains: (className) =>
        className === "m-bg-system" ||
        className === "group-show-cancelled-message",
    },
    textContent: "",
  };
  assert.equal(isShowCancellationMessage(cancelledShow), true);
  assert.equal(shouldIgnoreSystemMessage(cancelledShow), true);
  assert.equal(isShowCancellationMessage(createMessage(["m-bg-system"])), false);
  assert.equal(
    shouldIgnoreSystemMessage(
      createMessage(["m-bg-system", "TicketShowAnnouncedBaseMessage"]),
    ),
    false,
  );
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
    price: 44,
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
    "Gorjeta Avulsa": { count: 1, tokens: 44, type: "Gorjeta Avulsa" },
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
    assert.ok(state.capturedEvents.some((event) =>
      event.id === messageId && event.showParticipantType === "ticket"
    ));
    assert.equal(state.events[0].type, "Ingresso Ticket");
    assert.equal(state.currentTicketPrice, 44);
    assert.equal(state.eventSummaryTotals["Gorjeta Avulsa"], undefined);
    assert.equal(state.eventSummaryTotals.Ticket.tokens, 44);
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
  assert.equal(daily.moderationLogs.length, 1);
  assert.equal(daily.moderationLogs[0].status, "SUCESSO");
  assert.equal(Object.values(daily.moderationHourlyTotals).reduce((sum, count) => sum + count, 0), 1);
  assert.deepEqual(daily.mutedUsers[0], {
    username: "Muted",
    mutedBy: "Moderator",
    lastMessage: "private chat text",
    recentMessages: [],
    timestamp,
    _timestamp: timestamp,
  });
});

test("keeps deleted moderation details hidden when a pending attempt resolves", () => {
  const dateKey = localDateKey();
  state.dailyBuckets = { [dateKey]: createEmptyDailyBucket(dateKey) };
  const timestamp = Date.now();
  recordDailyModerationLog({
    id: "deleted-moderation",
    user: "Muted",
    status: "PENDENTE",
    message: "spam",
    timestamp,
  });
  state.dailyBuckets[dateKey].moderationLogDeletedIds = ["deleted-moderation"];
  recordDailyModerationLog({
    id: "deleted-moderation",
    user: "Muted",
    status: "SUCESSO",
    message: "spam",
    timestamp,
  });

  const daily = state.dailyBuckets[dateKey];
  assert.equal(daily.moderationLogs.length, 0);
  assert.equal(daily.moderationStats.attempts, 1);
  assert.equal(daily.moderationStats.successes, 1);
  assert.equal(Object.values(daily.moderationHourlyTotals).reduce((sum, count) => sum + count, 0), 1);
});
