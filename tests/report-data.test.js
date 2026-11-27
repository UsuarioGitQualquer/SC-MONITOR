import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAudienceChartPoints,
  buildDailyShowStats,
  buildDailyShowCounts,
  buildDailyReportChartData,
  buildDonorRows,
  buildReportData,
  buildGainTypeRows,
  buildNamedTotalRows,
  buildPeriodReportSummary,
  classifyGainType,
  getCanonicalModelKey,
  getHistoryModelId,
  hasAudienceConversionStats,
  hasAudienceStats,
  listHistoryEntriesForModel,
  listHistoryModels,
  listPeriodReportDateKeys,
  mergeDailyReportBuckets,
} from "../src/ui/report-data.js";

test("counts unique daily show starts by type, excluding minutes, ends, and ticket purchases", () => {
  const daily = {
    capturedEvents: [
      { id: "ticket-start", type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start" },
      { id: "ticket-start", type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start" },
      { id: "ticket-minute", type: "Ticket show", item: "Ticket show (1 min)" },
      { id: "ticket-end", type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
      { id: "private-start", type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start" },
      { id: "exclusive-start", type: "Show Exclusivo", item: "Show Exclusivo (Início)", showBoundary: "start" },
      { id: "group-start", type: "Show em Grupo", item: "Show em Grupo (Início)", showBoundary: "start" },
      { id: "ticket-purchase", type: "Ingresso Ticket", item: "Compra de Ingresso", showBoundary: "start" },
    ],
  };
  const expectedCounts = {
    ticket: 1,
    private: 1,
    exclusive: 1,
    group: 1,
  };

  assert.deepEqual(buildDailyShowCounts(daily), expectedCounts);
  assert.deepEqual(
    buildReportData(
      { modelId: "test-model", modelName: "Test", dateKey: "2026-11-22" },
      daily,
    ).showCounts,
    expectedCounts,
  );
});

test("estimates daily show earnings and ticket sales for each ticket show", () => {
  const daily = {
    capturedEvents: [
      { id: "ticket-participant-1", timestamp: 95, type: "Participante de show", item: "TicketAlice", user: "TicketAlice", showParticipantType: "ticket" },
      { id: "ticket-start-1", timestamp: 100, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 20 },
      { id: "ticket-participant-reentry", timestamp: 105, type: "Participante de show", item: "TicketAlice", user: "TicketAlice", showParticipantType: "ticket" },
      { id: "ticket-sale-1", timestamp: 110, type: "Ingresso Ticket", item: "Compra de Ingresso (A)", price: 1 },
      { id: "ticket-sale-2", timestamp: 120, type: "Ingresso Ticket", item: "Compra de Ingresso (B)", price: 20 },
      { id: "ticket-end-1", timestamp: 150, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
      { id: "ticket-start-2", timestamp: 200, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 35 },
      { id: "ticket-sale-3", timestamp: 210, type: "Ingresso Ticket", item: "Compra de Ingresso (C)", price: 35 },
      { id: "ticket-end-2", timestamp: 250, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
      { id: "private-start", timestamp: 300, type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 12 },
      { id: "private-minute", timestamp: 360, type: "Show Privado", item: "Show Privado (1 min)", tokens: 12 },
      { id: "private-end", timestamp: 400, type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
      { id: "exclusive-start", timestamp: 500, type: "Show Exclusivo", item: "Show Exclusivo (Início)", showBoundary: "start", tokens: 25 },
      { id: "exclusive-end", timestamp: 550, type: "Show Exclusivo", item: "Show Exclusivo (Fim)", showBoundary: "end" },
      { id: "group-start", timestamp: 600, type: "Show em Grupo", item: "Show em Grupo (Início)", showBoundary: "start", tokens: 10 },
      { id: "group-participant-1", timestamp: 610, type: "Participante de show", item: "GroupAlice", user: "GroupAlice", showParticipantType: "group" },
      { id: "group-participant-duplicate", timestamp: 620, type: "Participante de show", item: "groupalice", user: "groupalice", showParticipantType: "group" },
      { id: "group-participant-2", timestamp: 630, type: "Participante de show", item: "GroupBob", user: "GroupBob", showParticipantType: "group" },
      { id: "group-minute", timestamp: 660, type: "Show em Grupo", item: "Show em Grupo (1 min)", tokens: 10 },
      { id: "group-end", timestamp: 700, type: "Show em Grupo", item: "Show em Grupo (Fim)", showBoundary: "end" },
    ],
  };
  const stats = buildDailyShowStats(daily);

  assert.deepEqual(stats, {
    ticket: {
      count: 2,
      earnings: 75,
      ticketsSold: 3,
      unpricedTicketsSold: 0,
      ticketShows: [
        {
          startedAt: 100,
          endedAt: 150,
          ticketPrice: 20,
          ticketsSold: 2,
          unpricedTicketsSold: 0,
          earnings: 40,
          ticketPriceBreakdown: [{ price: 20, quantity: 2 }],
          participants: ["TicketAlice"],
          participantEntries: [{ name: "TicketAlice", count: 2 }],
        },
        {
          startedAt: 200,
          endedAt: 250,
          ticketPrice: 35,
          ticketsSold: 1,
          unpricedTicketsSold: 0,
          earnings: 35,
          ticketPriceBreakdown: [{ price: 35, quantity: 1 }],
          participants: [],
          participantEntries: [],
        },
      ],
    },
    private: {
      count: 1,
      earnings: 24,
      privateShows: [{ startedAt: 300, endedAt: 400, earnings: 24 }],
    },
    exclusive: {
      count: 1,
      earnings: 25,
      exclusiveShows: [{ startedAt: 500, endedAt: 550, earnings: 25 }],
    },
    group: {
      count: 1,
      earnings: 20,
      groupShows: [{
        startedAt: 600,
        endedAt: 700,
        earnings: 20,
        participants: ["GroupAlice", "GroupBob"],
        participantEntries: [
          { name: "GroupAlice", count: 2 },
          { name: "GroupBob", count: 1 },
        ],
      }],
    },
  });
  assert.deepEqual(
    buildReportData(
      { modelId: "test-model", modelName: "Test", dateKey: "2026-11-22" },
      daily,
    ).showStats,
    stats,
  );
});

test("closes a ticket show when the next one starts without an end marker", () => {
  const stats = buildDailyShowStats({
    capturedEvents: [
      { id: "ticket-start-1", timestamp: 100, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start" },
      { id: "ticket-user-1", timestamp: 110, type: "Participante de show", item: "FirstUser", user: "FirstUser", showParticipantType: "ticket" },
      { id: "ticket-start-2", timestamp: 200, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start" },
      { id: "ticket-user-2", timestamp: 210, type: "Participante de show", item: "SecondUser", user: "SecondUser", showParticipantType: "ticket" },
    ],
  });

  assert.equal(stats.ticket.count, 2);
  assert.equal(stats.ticket.ticketShows[0].endedAt, 200);
  assert.deepEqual(stats.ticket.ticketShows[0].participants, ["FirstUser"]);
  assert.equal(stats.ticket.ticketShows[1].endedAt, null);
  assert.deepEqual(stats.ticket.ticketShows[1].participants, ["SecondUser"]);
});

test("includes known ticket buyers in the associated show participants", () => {
  const stats = buildDailyShowStats({
    capturedEvents: [
      { id: "ticket-sale-before", timestamp: 95, type: "Ingresso Ticket", user: "EarlyBuyer" },
      { id: "ticket-start", timestamp: 100, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start" },
      { id: "ticket-sale-during", timestamp: 110, type: "Ingresso Ticket", user: "Buyer" },
      { id: "ticket-join", timestamp: 120, type: "Participante de show", item: "Attendee", user: "Attendee", showParticipantType: "ticket" },
      { id: "ticket-end", timestamp: 150, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
    ],
  });

  assert.deepEqual(stats.ticket.ticketShows[0].participants, [
    "EarlyBuyer",
    "Buyer",
    "Attendee",
  ]);
  assert.equal(stats.ticket.ticketShows[0].ticketsSold, 2);
});

test("does not estimate ticket revenue from a sale amount without a recorded show price", () => {
  const stats = buildDailyShowStats({
    capturedEvents: [
      {
        id: "ticket-start-unknown-price",
        timestamp: 100,
        type: "Ticket show",
        item: "Ticket show (Início)",
        showBoundary: "start",
        ticketPrice: 0,
      },
      {
        id: "ticket-sale-unknown-price",
        timestamp: 110,
        type: "Ingresso Ticket",
        item: "Compra de Ingresso",
        price: 1,
      },
    ],
  });

  assert.equal(stats.ticket.earnings, 0);
  assert.equal(stats.ticket.ticketsSold, 1);
  assert.equal(stats.ticket.unpricedTicketsSold, 1);
  assert.equal(stats.ticket.ticketShows[0].earnings, 0);
  assert.equal(stats.ticket.ticketShows[0].unpricedTicketsSold, 1);
});

test("reconstructs an unretained ticket-show start and infers repeated sale prices", () => {
  const stats = buildDailyShowStats({
    capturedEvents: [
      { id: "early-ticket-sale-1", timestamp: 100, type: "Ingresso Ticket", user: "BuyerOne", price: 16 },
      { id: "early-ticket-sale-2", timestamp: 110, type: "Ingresso Ticket", user: "BuyerTwo", price: 16 },
      { id: "orphan-ticket-end", timestamp: 150, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
      { id: "ticket-start", timestamp: 200, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 0 },
      { id: "ticket-sale-1", timestamp: 210, type: "Ingresso Ticket", user: "BuyerThree", price: 16 },
      { id: "ticket-sale-2", timestamp: 220, type: "Ingresso Ticket", user: "BuyerFour", price: 16 },
      { id: "ticket-end", timestamp: 250, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
    ],
  });

  assert.equal(stats.ticket.count, 2);
  assert.equal(stats.ticket.ticketsSold, 4);
  assert.equal(stats.ticket.earnings, 64);
  assert.equal(stats.ticket.unpricedTicketsSold, 0);
  assert.equal(stats.ticket.ticketShows[0].startedAt, 100);
  assert.equal(stats.ticket.ticketShows[0].endedAt, 150);
  assert.equal(stats.ticket.ticketShows[0].inferredStart, true);
  assert.equal(stats.ticket.ticketShows[0].ticketPrice, 16);
  assert.deepEqual(stats.ticket.ticketShows[0].participants, ["BuyerOne", "BuyerTwo"]);
  assert.equal(stats.ticket.ticketShows[1].ticketPrice, 16);
  assert.equal(stats.ticket.ticketShows[1].earnings, 32);
});

test("includes manual gains in day, live, and period totals and show participants", () => {
  const dateKey = "2026-11-25";
  const daily = {
    date: dateKey,
    totalTokensDay: 100,
    capturedEvents: [
      { id: "day-private-start", timestamp: 10, type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 10 },
      { id: "day-private-end", timestamp: 20, type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
      { id: "live-private-start", timestamp: 50, type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 8 },
      { id: "live-private-end", timestamp: 70, type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
    ],
    manualEarnings: [
      {
        id: "manual-day-show",
        timestamp: 30,
        type: "Show Privado",
        item: "Show privado · ganho manual",
        manualEntry: true,
        manualAmount: 20,
        user: "DayNick",
        manualShowTargetId: "day-private-start",
        scope: "day",
        price: 20,
        tokens: 20,
      },
      {
        id: "manual-live-show",
        timestamp: 80,
        type: "Show Privado",
        item: "Show privado · ganho manual",
        manualEntry: true,
        manualAmount: 12,
        user: "LiveNick",
        manualShowTargetId: "live-private-start",
        scope: "live",
        sessionId: "live-1",
        price: 12,
        tokens: 12,
      },
      {
        id: "manual-chat-private",
        timestamp: 90,
        type: "Chat privado",
        item: "Ganho manual de chat privado",
        manualEntry: true,
        manualAmount: 5,
        scope: "day",
        price: 5,
        tokens: 5,
      },
    ],
    liveSessions: {
      "live-1": {
        sessionId: "live-1",
        tokens: 30,
        capturedEvents: [
          { id: "live-private-start", timestamp: 50, type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 8 },
          { id: "live-private-end", timestamp: 70, type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
        ],
      },
    },
  };
  const report = buildReportData(
    { modelId: "test-model", modelName: "Test", dateKey, totalTokens: 100 },
    daily,
  );
  const live = report.liveSessions[0];
  const liveShowStats = buildDailyShowStats({ capturedEvents: live.capturedEvents });
  const period = buildPeriodReportSummary({
    modelId: "test-model",
    modelEntries: [{ modelId: "test-model", dateKey, totalTokens: 100 }],
    start: dateKey,
    end: dateKey,
    dateKeys: [dateKey],
    dailyByDate: { [dateKey]: daily },
  });

  assert.equal(report.totalTokens, 137);
  assert.equal(report.largestTip, null);
  assert.equal(report.showStats.private.earnings, 50);
  assert.deepEqual(report.showStats.private.privateShows[0].participants, ["DayNick"]);
  assert.equal(live.tokens, 42);
  assert.equal(liveShowStats.private.earnings, 20);
  assert.deepEqual(liveShowStats.private.privateShows[0].participants, ["LiveNick"]);
  assert.equal(period.totalPeriodTokens, 137);
  assert.equal(period.showStats.private.earnings, 50);
  assert.deepEqual(
    buildGainTypeRows(report.eventSummaryTotals).map(({ label, value }) => ({ label, value })),
    [
      { label: "Show privado", value: 32 },
      { label: "Chat privado", value: 5 },
    ],
  );
});

test("counts a manually created show and its optional participant", () => {
  const stats = buildDailyShowStats({
    capturedEvents: [
      {
        id: "manual-exclusive-start",
        timestamp: 100,
        type: "Show Exclusivo",
        item: "Show exclusivo · ganho manual",
        showBoundary: "start",
        manualNewShow: true,
        manualEntry: true,
        manualAmount: 35,
        price: 35,
        tokens: 35,
        user: "ExclusiveNick",
      },
      {
        id: "manual-exclusive-end",
        timestamp: 101,
        type: "Show Exclusivo",
        item: "Show exclusivo · fim manual",
        showBoundary: "end",
      },
    ],
  });

  assert.equal(stats.exclusive.count, 1);
  assert.equal(stats.exclusive.earnings, 35);
  assert.equal(stats.exclusive.exclusiveShows[0].startedAt, null);
  assert.equal(stats.exclusive.exclusiveShows[0].endedAt, null);
  assert.deepEqual(stats.exclusive.exclusiveShows[0].participants, ["ExclusiveNick"]);
  assert.deepEqual(
    stats.exclusive.exclusiveShows[0].participantEntries,
    [{ name: "ExclusiveNick", count: 1 }],
  );
});

test("aggregates show counts and participant details for period reports", () => {
  const dateKey = "2026-11-25";
  const summary = buildPeriodReportSummary({
    modelId: "test-model",
    start: dateKey,
    end: dateKey,
    dateKeys: [dateKey],
    dailyByDate: {
      [dateKey]: {
        capturedEvents: [
          { id: "ticket-start", timestamp: 100, type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 30 },
          { id: "ticket-user", timestamp: 110, type: "Participante de show", item: "TicketUser", user: "TicketUser", showParticipantType: "ticket" },
          { id: "ticket-sale", timestamp: 120, type: "Ingresso Ticket", item: "Compra de Ingresso", price: 30 },
          { id: "ticket-end", timestamp: 150, type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
          { id: "group-start", timestamp: 200, type: "Show em Grupo", item: "Show em Grupo (Início)", showBoundary: "start", tokens: 15 },
          { id: "group-user", timestamp: 210, type: "Participante de show", item: "GroupUser", user: "GroupUser", showParticipantType: "group" },
          { id: "group-end", timestamp: 250, type: "Show em Grupo", item: "Show em Grupo (Fim)", showBoundary: "end" },
          { id: "private-start", timestamp: 300, type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 20 },
          { id: "private-end", timestamp: 350, type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
          { id: "exclusive-start", timestamp: 400, type: "Show Exclusivo", item: "Show Exclusivo (Início)", showBoundary: "start", tokens: 25 },
          { id: "exclusive-end", timestamp: 450, type: "Show Exclusivo", item: "Show Exclusivo (Fim)", showBoundary: "end" },
        ],
      },
    },
  });

  assert.deepEqual(summary.showCounts, {
    ticket: 1,
    private: 1,
    exclusive: 1,
    group: 1,
  });
  assert.equal(summary.showStats.ticket.earnings, 30);
  assert.equal(summary.showStats.ticket.ticketsSold, 1);
  assert.equal(summary.showStats.ticket.ticketShows[0].dateKey, dateKey);
  assert.deepEqual(summary.showStats.ticket.ticketShows[0].participants, ["TicketUser"]);
  assert.deepEqual(
    summary.showStats.ticket.ticketShows[0].participantEntries,
    [{ name: "TicketUser", count: 1 }],
  );
  assert.equal(summary.showStats.group.earnings, 15);
  assert.equal(summary.showStats.group.groupShows[0].dateKey, dateKey);
  assert.deepEqual(summary.showStats.group.groupShows[0].participants, ["GroupUser"]);
  assert.deepEqual(
    summary.showStats.group.groupShows[0].participantEntries,
    [{ name: "GroupUser", count: 1 }],
  );
  assert.deepEqual(summary.showStats.private.privateShows, [{
    startedAt: 300,
    endedAt: 350,
    earnings: 20,
    dateKey,
  }]);
  assert.deepEqual(summary.showStats.exclusive.exclusiveShows, [{
    startedAt: 400,
    endedAt: 450,
    earnings: 25,
    dateKey,
  }]);
});

test("distinguishes saved audience counts from missing or empty data", () => {
  assert.equal(hasAudienceStats({ newUsers: 0, returningUsers: 0 }), true);
  assert.equal(hasAudienceStats({ newUsers: 2, returningUsers: 3 }), true);
  assert.equal(hasAudienceStats({}), false);
  assert.equal(hasAudienceStats({ newUsers: 2 }), false);
});

test("ignores null and malformed entries while building live sessions", () => {
  const report = buildReportData(
    { modelId: "test-model", modelName: "Test", dateKey: "2026-11-22" },
    {
      date: "2026-11-22",
      liveSessions: {
        "live-null": null,
        "live-valid": {
          sessionId: "live-valid",
          startedAtTs: 1763827200000,
          startedAt: "12:00:00",
          endedAt: "12:05:00",
          durationSeconds: 300,
          tokens: 25,
          viewerSum: 200,
          viewerSamples: 2,
        },
      },
      minuteBuckets: {},
    },
  );

  assert.equal(report.liveSessions.length, 1);
  assert.equal(report.liveSessions[0].sessionId, "live-valid");
  assert.equal(report.liveSessions[0].avgViewers, 100);
});

test("marks an active session ended when a later session starts after its last update", () => {
  const report = buildReportData(
    { modelId: "test-model", modelName: "Test", dateKey: "2026-11-24" },
    {
      liveSessions: {
        first: {
          sessionId: "first",
          startedAtTs: 1000,
          endedAtTs: 2000,
          status: "ENCERRADA",
        },
        staleActive: {
          sessionId: "staleActive",
          startedAtTs: 3000,
          endedAtTs: 4000,
          startedAt: "17:16:10",
          endedAt: "17:24:39",
          status: "ATIVA",
        },
        later: {
          sessionId: "later",
          startedAtTs: 5000,
          endedAtTs: 6000,
          status: "ENCERRADA",
        },
        currentActive: {
          sessionId: "currentActive",
          startedAtTs: 7000,
          endedAtTs: 8000,
          status: "ATIVA",
        },
      },
    },
  );

  assert.equal(
    report.liveSessions.find((session) => session.sessionId === "staleActive").status,
    "ENCERRADA",
  );
  assert.equal(
    report.liveSessions.find((session) => session.sessionId === "currentActive").status,
    "ATIVA",
  );
});

test("deduplicates same-name models and uses the latest ID for each report date", () => {
  const history = {
    "model-id-1::2026-11-23": {
      modelId: "model-id-1",
      modelName: "Sample Model",
      dateKey: "2026-11-23",
      lastUpdated: "16:12:48",
    },
    "model-id-1::2026-11-24": {
      modelId: "model-id-1",
      modelName: "Sample Model",
      dateKey: "2026-11-24",
      lastUpdated: "16:12:48",
    },
    "model-id-2::2026-11-24": {
      modelId: "model-id-2",
      modelName: "Sample Model",
      dateKey: "2026-11-24",
      lastUpdated: "17:16:12",
    },
  };

  const models = listHistoryModels(history);
  assert.equal(models.length, 1);
  assert.equal(models[0].modelId, "model-id-2");
  assert.equal(models[0].label, "Sample Model");
  assert.deepEqual(models[0].modelIds.sort(), ["model-id-1", "model-id-2"]);
  const entries = listHistoryEntriesForModel(history, models[0].modelId);
  assert.equal(entries.length, 2);
  assert.equal(entries.find((entry) => entry.dateKey === "2026-11-23").modelId, "model-id-1");
  assert.deepEqual(
    entries.find((entry) => entry.dateKey === "2026-11-24").modelIds.sort(),
    ["model-id-1", "model-id-2"],
  );
});

test("merges daily buckets from same-name model IDs without dropping live sessions", () => {
  const merged = mergeDailyReportBuckets([
    {
      date: "2026-11-24",
      totalTokensDay: 547,
      dailyTokens: 547,
      peakViewersDay: 73,
      viewerSum: 8772,
      viewerSamplesCount: 172,
      bruteDaySeconds: 510,
      netDaySeconds: 510,
      minuteBuckets: {
        "17:16": { minute: "17:16", tokens: 44, viewersSum: 3520, viewerSamples: 50 },
      },
      liveSessions: {
        liveB: {
          sessionId: "liveB",
          startedAt: "17:16:10",
          startedAtTs: 2,
          tokens: 547,
          durationSeconds: 508,
          viewerSum: 8772,
          viewerSamples: 172,
        },
      },
      kingChatTotals: {
        donor: { name: "User One", tokens: 10, tips: 2 },
      },
      manualEarnings: [{
        id: "manual-model-one",
        type: "Chat privado",
        manualEntry: true,
        manualAmount: 5,
      }],
    },
    {
      date: "2026-11-24",
      totalTokensDay: 1070,
      dailyTokens: 1070,
      peakViewersDay: 177,
      viewerSum: 148096,
      viewerSamplesCount: 1316,
      bruteDaySeconds: 4026,
      netDaySeconds: 3953,
      minuteBuckets: {
        "16:12": { minute: "16:12", tokens: 0, viewersSum: 1152, viewerSamples: 12 },
        "17:25": { minute: "17:25", tokens: 40, viewersSum: 800, viewerSamples: 20 },
      },
      liveSessions: {
        liveA: {
          sessionId: "liveA",
          startedAt: "16:12:48",
          startedAtTs: 1,
          tokens: 762,
          durationSeconds: 3653,
        },
        liveC: {
          sessionId: "liveC",
          startedAt: "17:25:22",
          startedAtTs: 3,
          tokens: 308,
          durationSeconds: 371,
        },
      },
      kingChatTotals: {
        donor: { name: "User One", tokens: 20, tips: 3 },
      },
      manualEarnings: [{
        id: "manual-model-two",
        type: "Chat privado",
        manualEntry: true,
        manualAmount: 7,
      }],
    },
  ]);
  const report = buildReportData(
    { modelId: "model-id-2", modelName: "Sample Model", dateKey: "2026-11-24" },
    merged,
  );

  assert.equal(report.totalTokens, 1629);
  assert.equal(report.eventSummaryTotals["__manual__:Chat privado"].tokens, 12);
  assert.equal(report.peakViewers, 177);
  assert.equal(report.liveSessions.length, 3);
  assert.deepEqual(
    report.liveSessions.map((session) => session.startedAt),
    ["16:12:48", "17:16:10", "17:25:22"],
  );
  assert.equal(report.netSeconds, 4463);
  assert.deepEqual(report.donorRows, [{ name: "User One", tokens: 30, tips: 5 }]);
});

test("daily muted-user deletion markers are retained alongside aggregate source records", () => {
  const deletedRecord = { username: "Muted", timestamp: 100 };
  const deleted = mergeDailyReportBuckets([{
    mutedUsers: [deletedRecord],
    mutedUserDeletedIds: ["muted|100"],
  }]);
  assert.deepEqual(deleted.mutedUsers, [deletedRecord]);
  assert.deepEqual(deleted.mutedUserDeletedIds, ["muted|100"]);

  const reMuted = mergeDailyReportBuckets([
    {
      mutedUsers: [deletedRecord],
      mutedUserDeletedIds: ["muted|100"],
    },
    {
      mutedUsers: [{ username: "Muted", timestamp: 200 }],
    },
  ]);
  assert.deepEqual(reMuted.mutedUsers, [deletedRecord]);
});

test("requires complete and consistent counts for audience conversion", () => {
  assert.equal(
    hasAudienceConversionStats({
      newUsers: 4,
      returningUsers: 3,
      newTippers: 2,
      returningTippers: 1,
    }),
    true,
  );
  assert.equal(
    hasAudienceConversionStats({
      newUsers: 4,
      returningUsers: 3,
      newTippers: 2,
    }),
    false,
  );
  assert.equal(
    hasAudienceConversionStats({
      newUsers: 1,
      returningUsers: 0,
      newTippers: 2,
      returningTippers: 0,
    }),
    false,
  );
});

test("deduplicates new users across snapshots in period audience conversion", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: "2026-01-05",
    end: "2026-01-06",
    dateKeys: ["2026-01-05", "2026-01-06"],
    dailyByDate: {
      "2026-01-05": {
        audienceStats: {
          newUsers: 100,
          returningUsers: 3,
          newTippers: 8,
          returningTippers: 1,
        },
        topUsersSnapshot: [
          { name: "User One", firstSeenDate: "2026-01-05", tokens: 50 },
          { name: "User Two", firstSeenDate: "2026-01-05", tokens: 0 },
        ],
      },
      "2026-01-06": {
        audienceStats: {
          newUsers: 100,
          returningUsers: 6,
          newTippers: 7,
          returningTippers: 4,
        },
        topUsersSnapshot: [
          { name: "User One", firstSeenDate: "2026-01-05", tokens: 20 },
          { name: "User Three", firstSeenDate: "2026-01-06", tokens: 30 },
        ],
      },
    },
  });

  assert.deepEqual(summary.audienceConversion, {
    days: 2,
    newUsers: 3,
    newTippers: 2,
    returningUsers: 9,
    returningTippers: 5,
  });
});

test("excludes incomplete days from period audience conversion", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: "2026-01-05",
    end: "2026-01-06",
    dateKeys: ["2026-01-05", "2026-01-06"],
    dailyByDate: {
      "2026-01-05": {
        audienceStats: {
          newUsers: 4,
          returningUsers: 3,
          newTippers: 2,
          returningTippers: 1,
        },
      },
      "2026-01-06": {
        audienceStats: { newUsers: 2, returningUsers: 6 },
      },
    },
  });

  assert.deepEqual(summary.audienceConversion, {
    days: 1,
    newUsers: 4,
    newTippers: 2,
    returningUsers: 3,
    returningTippers: 1,
  });
});

test("resolves history identities consistently for reports and panel totals", () => {
  assert.equal(getHistoryModelId("model-a::2026-01-05", {}), "model-a");
  assert.equal(
    getHistoryModelId("legacy-key", { historyKey: "model-b::2026-01-06" }),
    "model-b",
  );
  assert.equal(
    getCanonicalModelKey("model-a::2026-01-05", { modelName: "  Model A " }),
    "model a",
  );
  assert.equal(
    getCanonicalModelKey("model-a::2026-01-05", { modelName: "Modelo" }),
    "model-a",
  );
});

test("classifies Battleship actions as their own gain type", () => {
  assert.equal(classifyGainType("Ação Battleship (58 tk)", "Battleship"), "Battleship");
  assert.equal(classifyGainType("Vídeo", "Compra de Conteúdo"), "Compra de Conteúdo");
  assert.equal(classifyGainType("Video", "Content purchase"), "Compra de Conteúdo");
  assert.deepEqual(
    buildGainTypeRows({
      Menu: { count: 2, tokens: 80, type: "menu" },
      "Ação Battleship": { count: 1, tokens: 120, type: "Battleship" },
      Vídeo: { count: 1, tokens: 2, type: "Compra de Conteúdo" },
    }),
    [
      { label: "Battleship", value: 120, count: 1 },
      { label: "Menu", value: 80, count: 2 },
      { label: "Compra de Conteúdo", value: 2, count: 1 },
    ],
  );
  assert.deepEqual(
    buildNamedTotalRows({
      Kiss: { label: "Kiss", count: 4, tokens: 80 },
      ignored: { label: "ignored", count: 0, tokens: 0 },
    }),
    [{ label: "Kiss", count: 4, tokens: 80 }],
  );
  assert.deepEqual(
    buildDonorRows({
      "user-one": { name: "User One", tokens: 80, tips: 3 },
      empty: { name: "Empty", tokens: 0, tips: 0 },
    }),
    [{ name: "User One", tokens: 80, tips: 3 }],
  );
});

test("groups audience into five-minute buckets and weights averages by samples", () => {
  const points = buildAudienceChartPoints(
    [
      {
        minute: "12:04",
        avgViewers: 5,
        viewerSamples: 3,
        leagueSamples: 2,
        leagueCounts: { silver: 4, bronze: 1 },
      },
      {
        minute: "12:00",
        avgViewers: 2,
        viewerSamples: 1,
        leagueSamples: 1,
        leagueCounts: { silver: 2, bronze: 2 },
      },
      {
        minute: "12:05",
        avgViewers: 9,
        viewerSamples: 2,
        leagueSamples: 0,
      },
    ],
    5,
  );

  assert.deepEqual(
    points.map(({ label, viewers, viewerSamples, leagueSamples, leagues }) => ({
      label,
      viewers,
      viewerSamples,
      leagueSamples,
      silver: leagues.silver,
      bronze: leagues.bronze,
    })),
    [
      {
        label: "12:00",
        viewers: 4,
        viewerSamples: 4,
        leagueSamples: 3,
        silver: 3,
        bronze: 1,
      },
      {
        label: "12:05",
        viewers: 9,
        viewerSamples: 2,
        leagueSamples: 0,
        silver: 0,
        bronze: 0,
      },
    ],
  );
});

test("uses one-minute audience buckets automatically for short timelines", () => {
  const points = buildAudienceChartPoints([
    { minute: "10:00", avgViewers: 2, viewerSamples: 1 },
    { minute: "10:01", avgViewers: 3, viewerSamples: 1 },
  ]);

  assert.deepEqual(
    points.map(({ label, viewers }) => ({ label, viewers })),
    [
      { label: "10:00", viewers: 2 },
      { label: "10:01", viewers: 3 },
    ],
  );
});

test("excludes audience samples from minutes with no live time", () => {
  const points = buildAudienceChartPoints([
    { minute: "15:35", viewersSum: 20, viewerSamples: 2, netSeconds: 60 },
    { minute: "15:36", viewersSum: 80, viewerSamples: 2, netSeconds: 0 },
    { minute: "15:37", viewersSum: 24, viewerSamples: 2, netSeconds: 60 },
  ]);

  assert.deepEqual(points.map(({ label, viewers }) => ({ label, viewers })), [
    { label: "15:35", viewers: 10 },
    { label: "15:37", viewers: 12 },
  ]);
});

test("keeps precise audience sums when grouping pre-aggregated minute rows", () => {
  const points = buildAudienceChartPoints([
    { minute: "12:00", avgViewers: 0, viewerSamples: 10, viewersSum: 1 },
    { minute: "12:01", avgViewers: 1, viewerSamples: 10, viewersSum: 8 },
  ], 5);

  assert.equal(points[0].viewers, 0);
});

test("prepares daily and live chart data consistently", () => {
  const minuteRows = [{
    minute: "10:00",
    tokens: 70,
    avgViewers: 10,
    viewerSamples: 2,
    viewersSum: 20,
  }];
  const report = {
    totalTokens: 100,
    minuteRows,
    liveSessions: [{
      sessionId: "live-a",
      startedAt: "10:00:00",
      endedAt: "10:01:00",
      minuteRows,
    }],
  };
  const dayData = buildDailyReportChartData({
    report,
    daily: { totalTokensDay: 100 },
    stepMinutes: 60,
  });
  const liveData = buildDailyReportChartData({
    report,
    stepMinutes: 60,
    sessionId: "live-a",
  });

  assert.deepEqual(dayData.timeBars.map(({ label, value }) => ({ label, value })), [
    { label: "10h", value: 70 },
  ]);
  assert.equal(dayData.audiencePoints[0].viewers, 10);
  assert.equal(dayData.tokensWithoutTime, 30);
  assert.equal(liveData.tokensWithoutTime, 0);
});

test("builds the daily largest-tip report and classifies menu and roulette tips", () => {
  const report = buildReportData(
    { modelId: "model-a", modelName: "Modelo A", dateKey: "2026-01-05" },
    {
      largestTip: {
        username: "User One",
        tokens: 80,
        item: "Kiss",
        type: "Menu de Gorjetas",
        menuOption: "Kiss",
      },
      capturedEvents: [
        { user: "User One", price: 80, item: "Kiss", type: "menu", menuOption: "Kiss" },
        { user: "User Two", price: 50, item: "Wheel: Gold", type: "roulette", rouletteOutcome: "Gold" },
        { user: "User Three", price: 20, item: "Tip", type: "gorjeta avulsa" },
      ],
    },
  );

  assert.deepEqual(report.largestTip, {
    username: "User One",
    tokens: 80,
    item: "Kiss",
    type: "Menu",
    timestamp: 0,
  });
  assert.deepEqual(
    report.topTipRows.map(({ username, tokens, type }) => ({ username, tokens, type })),
    [
      { username: "User One", tokens: 80, type: "Menu" },
      { username: "User Two", tokens: 50, type: "Roleta" },
      { username: "User Three", tokens: 20, type: "Gorjeta avulsa" },
    ],
  );
});

test("ignores malformed minute labels and returns points in time order", () => {
  const points = buildAudienceChartPoints(
    [
      { minute: "13:10", avgViewers: 7, viewerSamples: 1 },
      { minute: "invalid", avgViewers: 100, viewerSamples: 1 },
      { minute: "13:00", avgViewers: 3, viewerSamples: 1 },
      { minute: "13", avgViewers: 100, viewerSamples: 1 },
    ],
    5,
  );

  assert.deepEqual(
    points.map(({ label, viewers }) => ({ label, viewers })),
    [
      { label: "13:00", viewers: 3 },
      { label: "13:10", viewers: 7 },
    ],
  );
});

test("lists inclusive UTC dates and preserves the 400-day history limit", () => {
  assert.deepEqual(
    listPeriodReportDateKeys("2024-02-28", "2024-03-01"),
    ["2024-02-28", "2024-02-29", "2024-03-01"],
  );

  const cappedDates = listPeriodReportDateKeys("2024-01-01", "2025-12-31");
  assert.equal(cappedDates.length, 400);
  assert.equal(cappedDates[399], "2025-02-03");
});

test("averages users with tokens by date and by weekday", () => {
  const dateKeys = ["2026-01-05", "2026-01-06", "2026-01-12"];
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: dateKeys[0],
    end: dateKeys[2],
    dateKeys,
    dailyByDate: {
      "2026-01-05": {
        date: "2026-01-05",
        minuteBuckets: {
          "10:00": { minute: "10:00", tokensUsersSum: 4, tokensUsersSamples: 2 },
          "10:01": { minute: "10:01", tokensUsersSum: 6, tokensUsersSamples: 1 },
        },
      },
      "2026-01-06": {
        date: "2026-01-06",
        minuteBuckets: {
          "10:00": { minute: "10:00", tokensUsersSum: 9, tokensUsersSamples: 3 },
        },
      },
      "2026-01-12": {
        date: "2026-01-12",
        minuteBuckets: {
          "10:00": { minute: "10:00", tokensUsersSum: 10, tokensUsersSamples: 1 },
        },
      },
    },
  });

  assert.deepEqual(
    summary.tokensUsersDayBars.map(({ label, value }) => [label, value]),
    [["05/01", 3], ["06/01", 3], ["12/01", 10]],
  );
  assert.equal(summary.tokensUsersWeekdayBars.length, 7);
  assert.deepEqual(
    summary.tokensUsersWeekdayBars.find((day) => day.label === "Segunda"),
    {
      label: "Segunda",
      value: 7,
      days: 2,
      tooltip: "Segunda: média de 7 usuários com tokens em 2 dias",
    },
  );
  assert.equal(summary.tokensUsersWeekdayBars[0].days, 0);
});

test("aggregates period metrics, hourly bars, weekdays, users, and leagues", () => {
  const dateKeys = ["2026-01-05", "2026-01-06"];
  const modelEntries = [
    { dateKey: dateKeys[0], modelName: "Modelo A", totalTokens: 110, peakViewers: 9 },
    { dateKey: dateKeys[1], modelName: "Modelo A", totalTokens: 50, peakViewers: 12 },
  ];
  const dailyByDate = {
    [dateKeys[0]]: {
      date: dateKeys[0],
      netDaySeconds: 3600,
      bruteDaySeconds: 5400,
      totalTokensDay: 100,
      peakViewersDay: 10,
      viewerSum: 20,
      viewerSamplesCount: 2,
      liveSessions: {
        "live-a": {
          sessionId: "live-a",
          startedAtTs: 1767636000000,
          startedAt: "18:00:00",
          durationSeconds: 7200,
          tokens: 100,
          peakViewers: 12,
          viewerSum: 20,
          viewerSamples: 2,
        },
      },
      minuteBuckets: {
        "10:02": {
          minute: "10:02",
          tokens: 60,
          viewersSum: 6,
          viewerSamples: 1,
          tokensUsersSum: 4,
          tokensUsersSamples: 2,
          tokensUsersPeak: 4,
          listedUsersSum: 8,
          listedUsersSamples: 2,
        },
        "11:30": { minute: "11:30", tokens: 40, viewersSum: 14, viewerSamples: 1 },
      },
      userPeak: { listedUsersCount: 8 },
      userSamplesCount: 2,
      userSum: { listedUsersCount: 6 },
      audienceStats: {
        newUsers: 4,
        returningUsers: 3,
        newTippers: 2,
        returningTippers: 1,
      },
      menuOptionTotals: {
        Kiss: { label: "Kiss", count: 2, tokens: 20 },
      },
      rouletteOutcomeTotals: {
        Gold: { label: "Gold", count: 1, tokens: 0 },
      },
      kingChatTotals: {
        "user-one": { name: "User One", tokens: 30, tips: 2 },
      },
      largestTip: {
        user: "User One",
        price: 45,
        item: "Kiss",
        type: "Menu",
        menuOption: "Kiss",
      },
      suspectBots: [{
        username: "Suspect",
        suspicionScore: 5,
        suspicionLevel: "Médio",
        league: "Prata",
      }],
      mutedUsers: [{
        username: "Muted",
        mutedBy: "Mod",
        timestamp: 1760000000000,
      }],
      moderationStats: { attempts: 1, successes: 1, failures: 0, pending: 0 },
      moderationLogs: [{
        timestamp: 1767636000000,
        status: "SUCESSO",
        user: "SpamUser",
      }],
      capturedEvents: [{
        timestamp: 1767636000000,
        username: "User One",
        tokens: 30,
      }],
      topUsersSnapshot: [{
        name: "User One",
        tokens: 30,
        tips: 2,
        messages: 10,
        totalTimeSpent: 1800,
        visitCount: 2,
        firstSeenDate: "2026-01-05",
      }],
      roomKingSnapshot: {
        name: "TestModel",
        tokens: 605,
        valueSource: "site",
      },
      eventSummaryTotals: {
        Menu: { count: 2, tokens: 50, type: "menu" },
      },
      leagueUserTotals: {
        prata: { label: "Prata", users: 2, tokens: 50, tips: 2, messages: 10, timeSpent: 3600 },
      },
      goalsSnapshot: [
        { description: "Chegar a 1000", status: "Completa", amount: 1000 },
      ],
      capturedEvents: [
        { timestamp: 1767636000000, item: "Show Privado", type: "Show Privado", price: 45 },
        { timestamp: 1767636600000, item: "Show As / Make It Jiggle", type: "Menu de Gorjetas", price: 75 },
      ],
      leaguePeak: { grey: 4 },
      leagueSamplesCount: 2,
      leagueSum: { grey: 5 },
    },
    [dateKeys[1]]: {
      date: dateKeys[1],
      netDaySeconds: 1800,
      bruteDaySeconds: 3600,
      peakViewersDay: 7,
      viewerSum: 0,
      viewerSamplesCount: 0,
      liveSessions: {
        "live-b": {
          sessionId: "live-b",
          startedAtTs: 1767722400000,
          startedAt: "18:00:00",
          durationSeconds: 3600,
          tokens: 90,
          peakViewers: 15,
          viewerSum: 30,
          viewerSamples: 3,
        },
      },
      minuteBuckets: {
        "10:40": {
          minute: "10:40",
          tokens: 50,
          viewersSum: 8,
          viewerSamples: 2,
          tokensUsersSum: 9,
          tokensUsersSamples: 3,
          tokensUsersPeak: 6,
          listedUsersSum: 12,
          listedUsersSamples: 3,
        },
      },
      userPeak: { listedUsersCount: 10 },
      userSamplesCount: 1,
      userSum: { listedUsersCount: 9 },
      audienceStats: {
        newUsers: 2,
        returningUsers: 6,
        newTippers: 1,
        returningTippers: 4,
      },
      menuOptionTotals: {
        Kiss: { label: "Kiss", count: 3, tokens: 45 },
      },
      rouletteOutcomeTotals: {
        Gold: { label: "Gold", count: 2, tokens: 0 },
      },
      kingChatTotals: {
        "user-one": { name: "User One", tokens: 20, tips: 1 },
      },
      largestTip: {
        username: "User Two",
        tokens: 70,
        item: "Wheel: Gold",
        type: "Roleta",
        rouletteOutcome: "Gold",
      },
      suspectBots: [{
        username: "Suspect",
        suspicionScore: 8,
        suspicionLevel: "Alto",
        league: "Prata",
      }],
      mutedUsers: [{
        username: "Muted",
        mutedBy: "Mod",
        timestamp: 1760100000000,
      }],
      moderationStats: { attempts: 1, successes: 0, failures: 1, pending: 0 },
      roomKingSnapshot: {
        name: "Sample Model",
        tokens: 700,
        valueSource: "chat",
      },
      eventSummaryTotals: {
        Menu: { count: 1, tokens: 30, type: "menu" },
      },
      leaguePeak: { grey: 6 },
      leagueSamplesCount: 1,
      leagueSum: { grey: 7 },
    },
  };
  const input = {
    modelId: "model-a",
    modelEntries,
    start: dateKeys[0],
    end: dateKeys[1],
    dateKeys,
    dailyByDate,
    granularity: "week",
  };

  const summary = buildPeriodReportSummary(input);

  assert.equal(summary.modelName, "Modelo A");
  assert.equal(summary.totalPeriodTokens, 150);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.avgPerActiveDay, 75);
  assert.equal(summary.periodBruteSeconds, 9000);
  assert.deepEqual(summary.bruteDurationDayBars.map((bar) => bar.value), [150]);
  assert.equal(summary.periodAvgViewers, 7);
  assert.deepEqual(summary.bestDay, { dateBr: "05/01/2026", tokens: 100 });
  assert.equal(summary.maxPeak, 12);
  assert.equal(summary.activeRatioPct, 100);
  assert.equal(summary.chartBars.length, 1);
  assert.equal(summary.chartBars[0].value, 150);
  assert.equal(summary.hourlyBars[10].value, 110);
  assert.deepEqual(summary.tokensUsersHourBars, [{
    label: "10h",
    value: 3,
    tooltip: "10h: média de 3 usuários com tokens",
  }]);
  assert.deepEqual(summary.tokensUsersPeakHourBars, [{
    label: "10h",
    value: 6,
    tooltip: "10h: pico de 6 usuários com tokens",
  }]);
  assert.match(summary.hourlyBars[10].tooltip, /Média 5 viewers/);
  assert.equal(summary.dailyAudienceBars.length, 2);
  assert.deepEqual(
    summary.dailyAudienceBars.map((bar) => [bar.avgViewers, bar.peakViewers]),
    [[10, 10], [4, 12]],
  );
  assert.deepEqual(summary.audienceHourBars.map((bar) => bar.value), [5, 14]);
  assert.deepEqual(summary.listedUsersHourBars, [{
    label: "10h",
    value: 4,
    tooltip: "10h: média de 4 usuários listados",
  }]);
  assert.deepEqual(summary.bestAudienceHour, { label: "11h", viewers: 14 });
  assert.equal(summary.weekdayStats[1].viewerSamples, 2);
  assert.equal(summary.weekdayStats[2].viewerSamples, 2);
  assert.deepEqual(summary.busiestWeekday, { name: "Segunda", avg: 10 });
  assert.deepEqual(summary.bestTokenWeekday, { name: "Segunda", avg: 100 });
  assert.equal(summary.periodUserPeak.listedUsersCount, 10);
  assert.equal(summary.periodUserAvg.listedUsersCount, 5);
  assert.equal(summary.periodLeaguePeak.grey, 6);
  assert.equal(summary.periodLeagueAvg.grey, 4);
  assert.equal(summary.liveSessionRows.length, 2);
  assert.equal(summary.liveSessionRows[0].label, "05/01 18:00");
  assert.equal(summary.durationDayBars.length, 1);
  assert.equal(summary.durationDayBars[0].value, 90);
  assert.equal(summary.bestLiveByTokens.label, "05/01 18:00");
  assert.equal(summary.bestLiveByTokens.tokens, 100);
  assert.equal(summary.bestLiveByPace.label, "06/01 18:00");
  assert.equal(summary.bestLiveByPace.tokensPerHour, 90);
  assert.deepEqual(summary.dailyPaceBars.map((bar) => bar.value), [100, 100]);
  assert.equal(summary.weekdayPaceBars.length, 2);
  assert.equal(summary.weekdayPaceBars[0].value, 100);
  assert.equal(summary.hourlyPaceBars.find((bar) => bar.label === "10h")?.value, 3300);
  assert.equal(summary.audienceDays, 2);
  assert.deepEqual(summary.audienceConversion, {
    days: 2,
    newUsers: 3,
    newTippers: 2,
    returningUsers: 9,
    returningTippers: 5,
  });
  assert.equal(summary.eventSummaryDays, 2);
  assert.equal(summary.eventSummaryTotals.Menu.count, 3);
  assert.equal(summary.eventSummaryTotals.Menu.tokens, 80);
  assert.equal(summary.periodNetSeconds, 5400);
  assert.equal(summary.audienceEfficiency.tokensPerNetHour, 100);
  assert.equal(summary.leagueEngagementRows[0].label, "Prata");
  assert.equal(summary.leagueEngagementRows[0].tokensPerUser, 25);
  assert.equal(summary.goalTimeline[0].status, "Completa");
  assert.equal(summary.goalTimeline[0].sourceIndex, 0);
  assert.equal(summary.showTimeline[0].label, "Show Privado");
  assert.equal(summary.showTimeline[0].sourceIndex, 0);
  assert.deepEqual(summary.newUserBars.map((bar) => bar.value), [6]);
  assert.deepEqual(summary.returningUserBars.map((bar) => bar.value), [9]);
  assert.deepEqual(summary.newTipperBars.map((bar) => bar.value), [3]);
  assert.deepEqual(summary.returningTipperBars.map((bar) => bar.value), [5]);
  assert.equal(summary.menuOptionRows[0].label, "Kiss");
  assert.equal(summary.menuOptionRows[0].count, 5);
  assert.equal(summary.rouletteOutcomeRows[0].count, 3);
  assert.deepEqual(summary.donorRows[0], {
    name: "User One",
    tokens: 50,
    tips: 3,
    days: 2,
  });
  assert.deepEqual(summary.suspectRows[0], {
    username: "Suspect",
    days: 2,
    suspicionScore: 8,
    suspicionLevel: "Alto",
    league: "Prata",
    messages: 0,
    tokens: 0,
  });
  assert.equal(summary.mutedRows[0].days, 2);
  assert.equal(summary.moderationLogCount, 2);
  assert.equal(summary.moderationSuccessCount, 1);
  assert.equal(summary.moderationFailureCount, 1);
  assert.equal(summary.moderationPendingCount, 0);
  assert.equal(summary.activityTimeline.reduce((sum, bucket) => sum + bucket.events, 0), 2);
  assert.equal(summary.activityTimeline.reduce((sum, bucket) => sum + bucket.moderation, 0), 1);
  assert.equal(summary.heatmap.reduce((sum, row) =>
    sum + row.cells.reduce((cellSum, cell) => cellSum + cell.events, 0), 0), 2);
  assert.equal(summary.engagementRows[0].name, "User One");
  assert.equal(summary.engagementRows[0].visitCount, 2);
  assert.deepEqual(summary.bestTokenHour, { label: "10h", tokens: 110 });
  assert.deepEqual(
    { username: summary.bestTip.username, tokens: summary.bestTip.tokens, dateBr: summary.bestTip.dateBr },
    { username: "User Two", tokens: 70, dateBr: "06/01/2026" },
  );
  assert.equal(summary.largestTipBars.length, 1);
  assert.equal(summary.largestTipBars[0].value, 70);
  assert.deepEqual(
    summary.roomKingRows.map(({ name, tokens }) => ({ name, tokens })),
    [{ name: "TestModel", tokens: 605 }, { name: "Sample Model", tokens: 700 }],
  );

  const monthlySummary = buildPeriodReportSummary({
    ...input,
    granularity: "month",
  });
  assert.equal(monthlySummary.chartBars.length, 1);
  assert.equal(monthlySummary.chartBars[0].monthKey, "2026-01");
  assert.equal(monthlySummary.chartBars[0].value, 150);
  assert.equal(monthlySummary.newUserBars.length, 1);

  const dailySummary = buildPeriodReportSummary({
    ...input,
    granularity: "day",
  });
  assert.deepEqual(dailySummary.newUserBars.map((bar) => bar.value), [4, 2]);
});

test("keeps period summary metrics safe when no history exists", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model-a",
    modelEntries: [],
    start: "2026-01-05",
    end: "2026-01-06",
    dateKeys: ["2026-01-05", "2026-01-06"],
  });

  assert.equal(summary.modelName, "model-a");
  assert.deepEqual(summary.dayBars.map((bar) => bar.value), [0, 0]);
  assert.equal(summary.activeDays, 0);
  assert.equal(summary.avgPerActiveDay, 0);
  assert.equal(summary.bestDay.dateBr, "—");
  assert.equal(summary.activeRatioPct, 0);
  assert.equal(summary.busiestWeekday, null);
  assert.equal(summary.bestTokenWeekday, null);
});

test("does not count empty audience snapshots as recorded audience data", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model-a",
    modelEntries: [],
    start: "2026-01-05",
    end: "2026-01-06",
    dateKeys: ["2026-01-05", "2026-01-06"],
    dailyByDate: {
      "2026-01-05": { audienceStats: {} },
    },
  });

  assert.equal(summary.audienceDays, 0);
  assert.deepEqual(summary.newUserBars, []);
  assert.deepEqual(summary.returningUserBars, []);
});

test("keeps period moderation totals and hourly activity after a detail is removed", () => {
  const dateKey = "2026-01-05";
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: dateKey,
    end: dateKey,
    dateKeys: [dateKey],
    dailyByDate: {
      [dateKey]: {
        moderationStats: { attempts: 2, successes: 1, failures: 1, pending: 0 },
        moderationHourlyTotals: { 12: 2 },
        moderationLogs: [{
          id: "visible-log",
          timestamp: Date.parse("2026-01-05T12:30:00-03:00"),
          user: "Visible",
          status: "SUCESSO",
        }],
      },
    },
  });

  assert.equal(summary.moderationLogCount, 2);
  assert.equal(summary.moderationSuccessCount, 1);
  assert.equal(summary.moderationFailureCount, 1);
  assert.equal(summary.moderationLogs.length, 1);
  assert.equal(summary.moderationLogs[0].dateKey, dateKey);
  assert.equal(summary.activityTimeline[12].moderation, 2);
});

test("keeps muted-user messages separated by day in period reports", () => {
  const firstDay = "2026-01-05";
  const secondDay = "2026-01-06";
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: firstDay,
    end: secondDay,
    dateKeys: [firstDay, secondDay],
    dailyByDate: {
      [firstDay]: {
        mutedUsers: [{
          username: "Muted",
          mutedBy: "Moderator",
          lastMessage: "first day's message",
          timestamp: Date.parse("2026-01-05T12:00:00-03:00"),
        }],
      },
      [secondDay]: {
        mutedUsers: [{
          username: "Muted",
          mutedBy: "Moderator",
          lastMessage: "second day's message",
          timestamp: Date.parse("2026-01-06T12:00:00-03:00"),
        }],
      },
    },
  });

  assert.equal(summary.mutedRows[0].days, 2);
  assert.equal(summary.mutedRows[0].dateKey, secondDay);
  assert.equal(summary.mutedRows[0].lastMessage, "second day's message");
  assert.deepEqual(summary.mutedLogRows.map((entry) => entry.dateKey), [secondDay, firstDay]);
  assert.deepEqual(
    summary.mutedLogRows.map((entry) => entry.lastMessage),
    ["second day's message", "first day's message"],
  );
});

test("hides deleted muted-user details but preserves daily aggregate counts", () => {
  const dateKey = "2026-01-05";
  const timestamp = Date.parse("2026-01-05T12:00:00-03:00");
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: dateKey,
    end: dateKey,
    dateKeys: [dateKey],
    dailyByDate: {
      [dateKey]: {
        mutedUsers: [{
          username: "Muted",
          mutedBy: "Moderator",
          lastMessage: "removed detail",
          timestamp,
        }],
        mutedUserDeletedIds: [`muted|${timestamp}`],
      },
    },
  });

  assert.deepEqual(summary.mutedRows, []);
  assert.deepEqual(summary.mutedLogRows, []);
  assert.equal(summary.mutedBars[0].value, 1);
});
