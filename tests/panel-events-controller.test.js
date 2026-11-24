import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventSummaryMap,
  filterEvents,
  getConsolidatedEventScopeData,
} from "../src/ui/panel-events-controller.js";

test("preserves named menu options in the event summary", () => {
  assert.deepEqual(
    buildEventSummaryMap([
      { item: "Kiss", type: "Menu", menuOption: "Kiss", price: 5 },
      { item: "Hug", type: "Menu", price: 7 },
      { item: "Menu de Gorjetas", type: "Menu de Gorjetas", price: 3 },
      {
        item: "Wheel: Gold",
        type: "Resultado da Roleta",
        rouletteOutcome: "Gold",
        price: 6,
      },
      { item: "Private", type: "Show Privado", price: 30 },
      { item: "Free", type: "Menu", price: 0 },
    ]),
    {
      Kiss: { count: 1, tokens: 5, type: "Menu" },
      Hug: { count: 1, tokens: 7, type: "Menu" },
      Menu: { count: 1, tokens: 3, type: "Menu de Gorjetas" },
      Gold: { count: 1, tokens: 6, type: "Resultado da Roleta" },
      "Show Privado": { count: 1, tokens: 30, type: "Show Privado" },
    },
  );
});

test("rebuilds named menu rows for daily data saved before the item fix", () => {
  const state = {
    dailyBuckets: {
      "2026-11-24": {
        eventSummaryTotals: {
          Menu: { count: 2, tokens: 70, type: "Menu de Gorjetas" },
          Roleta: { count: 2, tokens: 45, type: "Resultado da Roleta" },
          Ticket: { count: 1, tokens: 40, type: "Ingresso Ticket" },
          "Ticket show": { count: 1, tokens: 0, type: "Ticket show" },
        },
        menuOptionTotals: {
          "Show Boobs": { label: "🍒 Show Boobs", count: 1, tokens: 50 },
        },
        rouletteOutcomeTotals: {
          Gold: { label: "Gold", count: 1, tokens: 20 },
        },
        capturedEvents: [],
      },
    },
  };

  assert.deepEqual(
    getConsolidatedEventScopeData(state, "day", "2026-11-24").summaryMap,
    {
      "🍒 Show Boobs": { count: 1, tokens: 50, type: "Menu de Gorjetas" },
      Menu: { count: 1, tokens: 20, type: "Menu de Gorjetas" },
      Gold: { count: 1, tokens: 20, type: "Resultado da Roleta" },
      Roleta: { count: 1, tokens: 25, type: "Resultado da Roleta" },
      Ticket: { count: 1, tokens: 40, type: "Ingresso Ticket" },
    },
  );
});

test("uses session events when available and filters fallback events by session start", () => {
  const currentEvents = [{ item: "Current", type: "Gorjeta", price: 9 }];
  const state = {
    sessionId: "live-a",
    _sessionStartedAtTs: 100,
    dailyBuckets: {
      "2026-11-21": {
        liveSessions: {
          "live-a": { capturedEvents: currentEvents },
        },
      },
    },
    capturedEvents: [
      { item: "Earlier", type: "Gorjeta", price: 2, timestamp: 99 },
      { item: "At start", type: "Gorjeta", price: 3, timestamp: 100 },
    ],
  };

  assert.equal(
    getConsolidatedEventScopeData(state, "session", "2026-11-21").events,
    currentEvents,
  );

  state.dailyBuckets["2026-11-21"].liveSessions["live-a"].capturedEvents = [];
  assert.deepEqual(
    getConsolidatedEventScopeData(state, "session", "2026-11-21").events,
    [state.capturedEvents[1]],
  );
});

test("filters event rows by tips, menus, and goals while excluding null entries", () => {
  const events = [
    { type: "Gorjeta", item: "Tip" },
    { type: "Pedido", item: "Kiss" },
    { type: "Compra de Conteúdo", item: "Vídeo" },
    { type: "Resultado da Roleta", item: "Prêmio" },
    { type: "Entrada no Fã-Clube", item: "Soldado" },
    { type: "Meta", item: "Goal" },
    { type: "Objetivo Épico", item: "Goal" },
    { type: "Show Privado", item: "Private" },
    { type: "Ingresso Ticket", item: "Ticket" },
    { type: "Ticket show", item: "Ticket show (Início)", price: 0 },
    { type: "Show em Grupo", item: "Show em Grupo (Fim)", showBoundary: "end", price: 0 },
    null,
  ];

  assert.deepEqual(filterEvents(events, "tips"), [events[0]]);
  assert.deepEqual(filterEvents(events, "menu"), [events[1]]);
  assert.deepEqual(filterEvents(events, "goals"), [events[5], events[6], events[7], events[8]]);
  assert.deepEqual(filterEvents(events, "all"), events.filter(
    (event) => event && event.type !== "Ticket show" && event.showBoundary !== "end",
  ));
});
