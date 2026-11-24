import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyReportCsv,
  buildPeriodReportCsv,
  buildUsersCsv,
} from "../src/ui/export/csv-export.js";

test("builds user CSV with quoted cells and spreadsheet formula protection", () => {
  const csv = buildUsersCsv({
    one: {
      name: '=HYPERLINK("https://example.test")',
      tokens: "12",
      tips: 2,
      messages: 3,
      firstSeen: "09:00",
      lastSeen: "10:00",
      lastMessage: "hello; world",
    },
    missing: null,
  });
  const expectedUserRow = [
    `"'=HYPERLINK(""https://example.test"")"`,
    '"12"',
    '"2"',
    '"3"',
    '"09:00"',
    '"10:00"',
    '"hello; world"',
  ].join(";");

  assert.equal(
    csv,
    '"usuario";"tokens";"gorjetas";"mensagens";"primeira_aparicao";"ultima_aparicao";"ultima_mensagem"' +
      "\r\n" +
      expectedUserRow,
  );
});

test("builds daily report CSV with formatted session and timeline values", () => {
  const csv = buildDailyReportCsv(
    {
      modelId: "model-1",
      dateKey: "2026-11-20",
      modelName: "Model",
      dateBr: "20/11/2026",
      totalTokens: 25,
      bruteSeconds: 120,
      netSeconds: 60,
      peakViewers: 10,
      avgViewers: 5,
      roomKingSnapshot: {
        name: "TestModel",
        tokens: 605,
        valueSource: "chat",
      },
      largestTip: {
        username: "User One",
        tokens: 50,
        type: "Menu",
        item: "Kiss",
      },
      topTipRows: [{ username: "User One", tokens: 50, type: "Menu", item: "Kiss" }],
      liveSessions: [
        {
          startedAt: "09:00",
          endedAt: "10:00",
          durationSeconds: 3600,
          tokens: 25,
          peakViewers: 10,
          status: "ENCERRADA",
        },
      ],
      suspectBots: [],
      audienceStats: { newUsers: 4, newTippers: 2, newTokens: 30 },
      menuOptionRows: [{ label: "Kiss", count: 3, tokens: 20 }],
      rouletteOutcomeRows: [{ label: "Gold", count: 2, tokens: 0 }],
      donorRows: [{ name: "User One", tips: 2, tokens: 30 }],
      mutedUsers: [{ username: "Muted", mutedBy: "Mod", time: "09:30" }],
      moderationStats: { attempts: 1, successes: 0, failures: 1, pending: 0 },
      minuteRows: [{ minute: "09:00", tokens: 25, avgViewers: 5, netSeconds: 60 }],
    },
    (seconds) => `${seconds}s`,
  );

  assert.match(csv, /"Model";"20\/11\/2026";"25";"120s";"60s";"10";"5"/);
  assert.match(csv, /"1";"09:00";"10:00";"3600s";"25";"10";"ENCERRADA"/);
  assert.match(csv, /"09:00";"25";"5";"60"/);
  assert.match(csv, /"TestModel";"605";"Chat capturado"/);
  assert.match(csv, /"Kiss";"3";"20"/);
  assert.match(csv, /"Gold";"2";"0"/);
  assert.match(csv, /"User One";"2";"30"/);
  assert.match(csv, /"Muted";"Mod"/);
  assert.match(csv, /"User One";"50";"Menu";"Kiss"/);
  assert.match(csv, /"Tentativas";"Confirmadas";"Falhas";"Pendentes"\r\n"1";"0";"1";"0"/);
});

test("builds period CSV with weekday and average metrics", () => {
  const csv = buildPeriodReportCsv(
    {
      modelName: "Model",
      modelId: "model-1",
      start: "2026-11-16",
      end: "2026-11-22",
      dayBars: [
        {
          dateBr: "20/11/2026",
          dateKey: "2026-11-20",
          value: 40,
          peakViewers: 12,
        },
      ],
      weekdayStats: [
        {
          name: "Sexta",
          days: 2,
          tokens: 80,
          viewerSamples: 4,
          viewerSum: 20,
          peakViewers: 12,
        },
      ],
      roomKingRows: [
        { dateBr: "20/11/2026", name: "TestModel", tokens: 605, valueSource: "chat" },
      ],
      bestDay: { dateBr: "20/11/2026", tokens: 40 },
      bestTip: { username: "User One", tokens: 50, type: "Menu", dateBr: "20/11/2026" },
      bestTokenWeekday: { name: "Sexta", avg: 40 },
      bestTokenHour: { label: "09h", tokens: 30 },
      moderationLogCount: 2,
      moderationSuccessCount: 1,
      moderationFailureCount: 1,
      moderationPendingCount: 0,
      menuOptionRows: [{ label: "Kiss", count: 3, tokens: 20 }],
      rouletteOutcomeRows: [{ label: "Gold", count: 2, tokens: 0 }],
      donorRows: [{ name: "User One", tips: 2, days: 1, tokens: 30 }],
      suspectRows: [{ username: "Bot?", days: 1, suspicionScore: 8, suspicionLevel: "Alto" }],
      mutedRows: [{ username: "Muted", days: 1, mutedBy: "Mod", lastMessage: "spam" }],
      newUserBars: [{ label: "16/11", value: 4 }],
      returningUserBars: [{ label: "16/11", value: 5 }],
      newTipperBars: [{ label: "16/11", value: 2 }],
      returningTipperBars: [{ label: "16/11", value: 1 }],
      suspectBars: [{ label: "16/11", value: 1 }],
      mutedBars: [{ label: "16/11", value: 1 }],
      audienceEfficiency: { tokensPerAverageViewer: 8.2, tokensPerNetHour: 120, averageViewers: 5 },
      leagueEngagementRows: [{ label: "Prata", users: 2, tokens: 30, tokensPerUser: 15, messages: 10, minutesPerUser: 20 }],
      goalTimeline: [{ dateKey: "2026-11-20", description: "Meta", status: "Completa", amount: 100 }],
      showTimeline: [{ dateKey: "2026-11-20", label: "Show Privado", type: "Show Privado", tokens: 45 }],
    },
    {
      weekdayNames: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      weekdayIndexFromDateKey: () => 5,
    },
  );

  assert.match(csv, /"RELATORIO POR PERIODO";"Model";"2026-11-16 a 2026-11-22"/);
  assert.match(csv, /"20\/11\/2026";"Sex";"40";"12"/);
  assert.match(csv, /"Sexta";"2";"40";"5";"12"/);
  assert.match(csv, /"20\/11\/2026";"TestModel";"605";"Chat capturado"/);
  assert.match(csv, /"Kiss";"3";"20"/);
  assert.match(csv, /"User One";"2";"1";"30"/);
  assert.match(csv, /"16\/11";"4";"5";"2";"1";"1";"1"/);
  assert.match(csv, /"Moderacao";"Tentativas";"Confirmadas";"Falhas";"Pendentes"\r\n"";"2";"1";"1";"0"/);
  assert.match(csv, /"Maior gorjeta";"User One";"50";"Menu";"20\/11\/2026"/);
  assert.match(csv, /"EFICIENCIA DA AUDIENCIA"/);
  assert.match(csv, /"ENGAJAMENTO POR LIGA"/);
  assert.match(csv, /"LINHA DO TEMPO METAS"/);
  assert.doesNotMatch(csv, /"Show\/Ingresso"/);
});
