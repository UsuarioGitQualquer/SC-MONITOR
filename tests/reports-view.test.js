import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportEmptyState,
  buildDailyAdditionalMetricsHtml,
  buildDailyReportHtml,
  buildPeriodReportHtml,
  buildSessionReportHtml,
  formatReportDuration,
} from "../src/ui/reports-view.js";
import { buildPeriodReportSummary } from "../src/ui/report-data.js";

test("renders daily activity rankings when enabled", () => {
  const html = buildDailyAdditionalMetricsHtml({
    menuOptionRows: [
      { label: "Kiss", count: 4, tokens: 100 },
      { label: "Hug", count: 3, tokens: 75 },
      { label: "Dance", count: 2, tokens: 50 },
    ],
    rouletteOutcomeRows: [
      { label: "Gold", count: 2, tokens: 0 },
      { label: "Silver", count: 1, tokens: 0 },
      { label: "Bronze", count: 1, tokens: 0 },
    ],
    topTipRows: [
      { username: "User One", tokens: 100, type: "Menu" },
      { username: "User Two", tokens: 50, type: "Menu" },
      { username: "User Three", tokens: 25, type: "Menu" },
    ],
    suspectBots: [],
    mutedUsers: [],
  }, {}, false);

  assert.match(html, /Maiores gorjetas individuais/);
  assert.match(html, /Opções mais pedidas do menu/);
  assert.match(html, /Resultados mais frequentes na roleta/);
  assert.match(html, /#1 User One · Menu/);
  assert.match(html, /#2 User Two · Menu/);
  assert.match(html, /#3 User Three · Menu/);
  assert.match(html, /background:linear-gradient\(90deg, #fbbf24, #f97316\)/);
  assert.match(html, /background:linear-gradient\(90deg, #cbd5e1, #64748b\)/);
  assert.match(html, /background:linear-gradient\(90deg, #fb923c, #c2410c\)/);
});

test("can keep all activity rankings out of panel metrics", () => {
  const html = buildDailyAdditionalMetricsHtml({
    menuOptionRows: [{ label: "Kiss", count: 4, tokens: 100 }],
    rouletteOutcomeRows: [{ label: "Gold", count: 2, tokens: 0 }],
    topTipRows: [{ username: "User One", tokens: 100, type: "Menu" }],
    suspectBots: [],
    mutedUsers: [],
  }, {}, false, false, { menu: false, tips: false, roulette: false });

  assert.doesNotMatch(html, /Maiores gorjetas individuais/);
  assert.doesNotMatch(html, /Opções mais pedidas do menu/);
  assert.doesNotMatch(html, /Resultados mais frequentes na roleta/);
});

test("renders daily report details and escapes user content", () => {
  const html = buildDailyReportHtml({
    report: {
      modelName: "modelo",
      dateBr: "20/11/2026",
      totalTokens: 120,
      peakViewers: 30,
      avgViewers: 12,
      bruteSeconds: 3600,
      netSeconds: 1800,
      liveSessions: [{
        startedAt: "12:00",
        endedAt: "13:00",
        durationSeconds: 3600,
        tokens: 150,
        peakViewers: 20,
        avgViewers: 10,
      }, {
        startedAt: "14:00",
        endedAt: "15:00",
        durationSeconds: 3600,
        tokens: 60,
        peakViewers: 10,
        avgViewers: 6,
      }],
      donorRows: [{ name: "<script>", tokens: 80, tips: 4 }],
      largestTip: {
        username: "<Doador>",
        tokens: 120,
        item: "Wheel: Gold",
        type: "Roleta",
      },
      topTipRows: [{ username: "<Doador>", tokens: 120, type: "Roleta" }],
      suspectBots: [{ username: "Suspect", suspicionScore: 7, suspicionLevel: "Alto" }],
      mutedUsers: [{ username: "Muted", mutedBy: "Mod", lastMessage: "spam" }],
      moderationStats: { attempts: 1, successes: 0, failures: 1, pending: 2 },
      menuOptionRows: [{ label: "Kiss", count: 4, tokens: 100 }],
      rouletteOutcomeRows: [{ label: "Gold", count: 2, tokens: 0 }],
      minuteRows: [],
      uPeak: {},
      uAvg: () => 0,
      lPeak: {},
      lAvg: () => 0,
    },
    daily: {
      audienceStats: { newUsers: 3, returningUsers: 2, newTippers: 1, returningTippers: 2 },
      topUsersSnapshot: [{ name: "<script>", tokens: 80, tips: 4, messages: 19 }],
      roomKingSnapshot: {
        name: "<King>",
        tokens: 605,
        chatTokens: 605,
        valueSource: "chat",
      },
      eventSummaryTotals: {
        Menu: { count: 2, tokens: 100, type: "menu" },
        "Show Privado": { count: 1, tokens: 50, type: "show privado" },
      },
      goalsSnapshot: [{
        timestamp: Date.parse("2026-11-20T14:08:00-03:00"),
        status: "Completa",
      }],
      capturedEvents: [{
        timestamp: Date.parse("2026-11-20T14:08:00-03:00"),
        type: "Show privado",
        item: "Show privado de 10 min",
      }, {
        timestamp: Date.parse("2026-11-20T14:09:00-03:00"),
        type: "Ticket show",
        item: "Ticket show (Início)",
        showBoundary: "start",
      }, {
        timestamp: Date.parse("2026-11-20T14:10:00-03:00"),
        type: "Ingresso Ticket",
        item: "Compra de Ingresso (nao-exibir)",
      }, {
        timestamp: Date.parse("2026-11-20T14:12:00-03:00"),
        type: "Ticket show",
        item: "Ticket show (Fim)",
        showBoundary: "end",
      }],
    },
    timeBars: [{
      label: "14:08",
      value: 1,
      avgListedUsers: 4,
      listedUsersSamples: 1,
      tooltip: "14:08 - 14:09 (2m): 1 tk",
    }],
    timeStepMin: 2,
    enableSuspectRemoval: true,
  });

  assert.match(html, /120 tk/);
  assert.match(html, /50%/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /report-summary-strip/);
  assert.equal((html.match(/class="report-summary-icon"/g) || []).length, 6);
  assert.match(html, /class="report-hero-avatar" aria-hidden="true">\s*<svg/);
  assert.match(html, /Tokens<\/small>/);
  assert.match(html, /Gorjetas<\/small>/);
  assert.match(html, /Mensagens<\/small>/);
  assert.match(html, /Lives registradas/);
  assert.match(html, /Rei da sala neste dia/);
  assert.match(html, /&lt;King&gt;/);
  assert.match(html, /Chat capturado/);
  assert.match(html, /Ganhos por intervalo/);
  assert.match(html, /Fluxo de Tokens \(Blocos de 2 min\)/);
  assert.match(html, /Fluxo de Usuários \(pessoas listadas\)/);
  assert.match(html, /14:08: 4 pessoas listadas \(média\)/);
  assert.match(html, /Shows/);
  assert.match(html, /Show: Show privado de 10 min/);
  assert.match(html, /Ticket show/);
  assert.match(html, /Início do Ticket show/);
  assert.match(html, /Fim do Ticket show/);
  assert.doesNotMatch(html, /nao-exibir|Compra de Ingresso/);
  assert.doesNotMatch(html, /Meta alcançada/);
  assert.match(html, /Blocos de 2 minutos/);
  assert.match(html, /Ganhos por tipo/);
  assert.match(html, /3 eventos · 150 tk/);
  assert.match(html, /Ritmo/);
  assert.match(html, /150 tk\/h/);
  assert.match(html, /Média viewers/);
  assert.match(html, /Novos usuários/);
  assert.match(html, /1 novo doador/);
  assert.match(html, /1 novo doador · conversão 33%/);
  assert.match(html, /Usuários recorrentes/);
  assert.match(html, /2 doadores recorrentes/);
  assert.match(html, /2 doadores recorrentes · conversão 100%/);
  assert.match(html, /Live com melhor ritmo/);
  assert.match(html, /Live 1 · 150 tk\/h/);
  assert.match(html, /Tokens por live/);
  assert.match(html, /Opções mais pedidas do menu/);
  assert.match(html, /Maiores gorjetas individuais/);
  assert.match(html, /Resultados mais frequentes na roleta/);
  assert.match(html, /--report-accent:#fbbf24/);
  assert.match(html, /--report-accent:#fb7185/);
  assert.match(html, /Insights do dia/);
  assert.match(html, /report-chart-group--audience/);
  assert.match(html, /report-chart-group--gains/);
  assert.match(html, /report-chart-group--lives/);
  assert.match(html, /principal fonte entre os ganhos classificados \(67%/);
  assert.match(html, /maior gorjeta representou 100% dos tokens do dia/);
  assert.match(html, /tk do total diário não têm horário registrado/);
  assert.match(html, /Suspeitas de bots no dia/);
  assert.match(html, /<th>Ação<\/th>/);
  assert.match(html, /class="report-dismiss-suspect" data-username="Suspect"/);
  assert.match(html, /Usuários silenciados/);
  assert.match(html, /1 tentativa\(s\), 0 confirmada\(s\), 1 falha\(s\) e 2 pendente\(s\)/);
  assert.match(html, /Maior gorjeta do dia/);
  assert.match(
    html,
    /<div class="daily-highlight-grid">\s*<section class="report-card report-card--tip">[\s\S]*?<\/section>\s*<section class="report-card report-card--king">/,
  );
  assert.match(html, /&lt;Doador&gt;.*120 tk.*Roleta/);
});

test("includes zero-token lives in the daily average pace insight", () => {
  const html = buildDailyReportHtml({
    report: {
      modelName: "modelo",
      dateBr: "20/11/2026",
      totalTokens: 100,
      peakViewers: 0,
      avgViewers: 0,
      bruteSeconds: 7200,
      netSeconds: 7200,
      totalTips: 0,
      totalMessages: 0,
      donorRows: [],
      liveSessions: [
        { startedAt: "12:00", durationSeconds: 3600, tokens: 0 },
        { startedAt: "14:00", durationSeconds: 3600, tokens: 100 },
      ],
    },
    daily: {},
  });

  assert.match(
    html,
    /A live 2 teve ritmo 100% acima da média das lives com duração registrada/,
  );
});

test("renders illustrated empty report states and escapes their message", () => {
  const html = buildReportEmptyState("Nenhum dado para <modelo>");

  assert.match(html, /class="empty-state-art"/);
  assert.match(html, /Nenhum dado para &lt;modelo&gt;/);
  assert.doesNotMatch(html, /Nenhum dado para <modelo>/);
});

test("marks the start and end of group shows in the daily chart", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "23/11/2026",
      totalTokens: 0,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 0,
      bruteSeconds: 0,
      liveSessions: [],
      donorRows: [],
      topTipRows: [],
      suspectBots: [],
      mutedUsers: [],
      moderationLogs: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: {
      capturedEvents: [
        {
          timestamp: Date.parse("2026-11-23T12:00:00-03:00"),
          type: "Show em Grupo",
          item: "Show em Grupo (Início)",
          price: 0,
          showBoundary: "start",
        },
        {
          timestamp: Date.parse("2026-11-23T12:01:00-03:00"),
          type: "Show em Grupo",
          item: "Show em Grupo (1 min)",
          price: 0,
        },
        {
          timestamp: Date.parse("2026-11-23T12:30:00-03:00"),
          type: "Show em Grupo",
          item: "Show em Grupo (Fim)",
          price: 0,
          showBoundary: "end",
        },
      ],
    },
    timeBars: [{ label: "12:00", value: 10 }],
    audiencePoints: [{ label: "12:00", viewers: 5 }],
  });

  assert.match(html, /Início do show: Show em Grupo/);
  assert.match(html, /Fim do show: Show em Grupo/);
  assert.doesNotMatch(html, /Show em Grupo \(1 min\)/);
});

test("adds percentage insights for daily and same-hour comparisons", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "20/11/2026",
      totalTokens: 120,
      peakViewers: 20,
      avgViewers: 12,
      netSeconds: 3600,
      bruteSeconds: 3600,
      liveSessions: [],
      donorRows: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: {
      audienceStats: { newUsers: 4, returningUsers: 2 },
    },
    comparisonReport: {
      dateBr: "19/11/2026",
      totalTokens: 100,
      peakViewers: 15,
      avgViewers: 10,
      netSeconds: 3600,
    },
    comparisonDaily: {
      audienceStats: { newUsers: 2, returningUsers: 1 },
    },
    timeBars: [{ label: "14h", value: 60 }],
    comparisonTimeBars: [{ label: "14h", value: 50 }],
  });

  assert.match(html, /Insights · 20\/11\/2026 vs\. 19\/11\/2026/);
  assert.match(html, /Ganhos em tokens<\/small>\s*<strong>\+20%/);
  assert.match(html, /Ganhos no melhor intervalo \(14h\)<\/small>\s*<strong>\+20%/);
  assert.match(html, /14:00–14:59 foi o melhor intervalo, concentrando 50% dos tokens do dia/);
  assert.match(html, /não representa receita monetária/);
});

test("shows the start and end of the best interval in daily insights", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "20/11/2026",
      totalTokens: 100,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 0,
      bruteSeconds: 0,
      liveSessions: [],
      donorRows: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: {},
    timeBars: [{ label: "09:40", value: 80 }],
    timeStepMin: 5,
  });

  assert.match(html, /09:40–09:44 foi o melhor intervalo, concentrando 80% dos tokens do dia/);
  assert.match(html, /20 tk do total diário não têm horário registrado/);
});

test("explains the live chart when the day has fewer than two sessions", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "20/11/2026",
      totalTokens: 100,
      peakViewers: 5,
      avgViewers: 3,
      bruteSeconds: 3600,
      netSeconds: 3600,
      liveSessions: [{
        startedAt: "12:00",
        durationSeconds: 3600,
        tokens: 100,
        peakViewers: 5,
        avgViewers: 3,
      }],
      donorRows: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: {},
  });

  assert.match(html, /Tokens por live/);
  assert.match(html, /Uma live registrada · comparação disponível ao registrar outra/);
  assert.match(html, /Live 1/);
});

test("avoids a misleading percentage when the comparison baseline is zero", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "20/11/2026",
      totalTokens: 50,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 3600,
      bruteSeconds: 3600,
      liveSessions: [],
      donorRows: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: { audienceStats: {} },
    comparisonReport: {
      dateBr: "19/11/2026",
      totalTokens: 0,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 0,
    },
    comparisonDaily: { audienceStats: {} },
  });

  assert.match(html, /Sem base anterior/);
  assert.match(html, /Sem dados de público/);
  assert.match(html, /Novos usuários<\/td><td>—<\/td><td>—<\/td><td>—<\/td>/);
  assert.doesNotMatch(html, />undefined</);
  assert.doesNotMatch(html, /Infinity|NaN/);
});

test("keeps available audience counts when the comparison day has no audience data", () => {
  const html = buildDailyReportHtml({
    report: {
      dateBr: "20/11/2026",
      totalTokens: 50,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 0,
      bruteSeconds: 0,
      liveSessions: [],
      donorRows: [],
      uPeak: {},
      uAvg: {},
      lPeak: {},
      lAvg: {},
    },
    daily: { audienceStats: { newUsers: 2, returningUsers: 1 } },
    comparisonReport: {
      dateBr: "19/11/2026",
      totalTokens: 20,
      peakViewers: 0,
      avgViewers: 0,
      netSeconds: 0,
    },
    comparisonDaily: {},
  });

  assert.match(html, /Novos usuários<\/td><td>2<\/td><td>—<\/td><td>—<\/td>/);
  assert.match(html, /Usuários recorrentes<\/td><td>1<\/td><td>—<\/td><td>—<\/td>/);
  assert.doesNotMatch(html, /conversão/);
});

test("renders period totals and weekday summaries", () => {
  const html = buildPeriodReportHtml({
    modelId: "model-a",
    start: "2026-11-18",
    end: "2026-11-20",
    totalPeriodTokens: 450,
    activeDays: 3,
    activeDayDates: ["18/11/2026", "19/11/2026", "20/11/2026"],
    avgPerActiveDay: 150,
    bestTokenWeekday: { name: "Quarta", avg: 180 },
    periodAvgViewers: 16,
    bestDay: { dateBr: "18/11/2026", tokens: 220 },
    bestTip: { username: "User One", tokens: 90, type: "Gorjeta avulsa", dateBr: "18/11/2026" },
    largestTipBars: [{ label: "18/11", value: 90, tooltip: "maior gorjeta: 90 tk" }],
    maxPeak: 40,
    bestTokenHour: { label: "14h", tokens: 30 },
    busiestWeekday: { name: "Quarta", avg: 16 },
    bestAudienceHour: { label: "14h", viewers: 18 },
    liveSessionRows: [
      {
        label: "18/11 12:00",
        startedAt: "12:00",
        tokens: 300,
        tokensPerHour: 150,
        durationSeconds: 7200,
        tooltip: "18/11/2026 · 12:00: 300 tk · 150 tk/h · média 12 espectadores",
      },
      {
        label: "19/11 11:00",
        startedAt: "11:00",
        tokens: 200,
        tokensPerHour: 200,
        durationSeconds: 3600,
        tooltip: "19/11/2026 · 11:00: 200 tk · 200 tk/h · média 15 espectadores",
      },
    ],
    bestLiveByTokens: { label: "18/11 12:00", tokens: 300 },
    bestLiveByPace: { label: "19/11 11:00", tokensPerHour: 200 },
    dayBars: [{ value: 100 }, { value: 130 }, { value: 220 }],
    chartBars: [
      { label: "18/11", value: 120, tooltip: "18/11: 120 tk" },
      { label: "19/11", value: 330, tooltip: "19/11: 330 tk" },
    ],
    hourlyBars: [
      { label: "14h", value: 30 },
      { label: "15h", value: 10 },
    ],
    audienceHourBars: [{ label: "14h", value: 18, tooltip: "14h: média de 18 espectadores" }],
    listedUsersHourBars: [{ label: "14h", value: 8, tooltip: "14h: média de 8 usuários listados" }],
    tokensUsersHourBars: [{ label: "14h", value: 5, tooltip: "14h: média de 5 usuários com tokens" }],
    tokensUsersDayBars: [{
      label: "18/11",
      value: 5,
      tooltip: "18/11: média de 5 usuários com tokens calculada a partir de 2 amostras",
    }],
    tokensUsersWeekdayBars: [
      { label: "Domingo", value: 0, days: 0 },
      { label: "Segunda", value: 5, days: 1 },
      { label: "Terça", value: 0, days: 0 },
      { label: "Quarta", value: 0, days: 0 },
      { label: "Quinta", value: 0, days: 0 },
      { label: "Sexta", value: 0, days: 0 },
      { label: "Sábado", value: 0, days: 0 },
    ],
    tokensUsersPeakHourBars: [{ label: "14h", value: 9, tooltip: "14h: pico de 9 usuários com tokens" }],
    bruteDurationDayBars: [{ label: "18/11", value: 90, tooltip: "18/11: 01:30:00 brutos" }],
    durationDayBars: [{ label: "18/11", value: 60, tooltip: "18/11: 01:00:00 líquidos" }],
    dailyPaceBars: [{ label: "18/11", value: 120, tooltip: "18/11: 120 tk/h" }],
    hourlyPaceBars: [{ label: "14h", value: 180, tooltip: "14h: 180 tk/h" }],
    weekdayPaceBars: [
      { label: "Seg", value: 100, tooltip: "Segunda: 100 tk/h" },
      { label: "Qua", value: 150, tooltip: "Quarta: 150 tk/h" },
    ],
    dailyAudienceBars: [
      { label: "18/11", avgViewers: 12, peakViewers: 20, tooltip: "18/11: média 12 • pico 20 espectadores" },
      { label: "19/11", avgViewers: 15, peakViewers: 25, tooltip: "19/11: média 15 • pico 25 espectadores" },
    ],
    periodUserPeak: {},
    periodUserAvg: {},
    periodLeaguePeak: {},
    periodLeagueAvg: {},
    weekdayStats: [
      { name: "Quarta", days: 2, tokens: 220, viewerSamples: 4, viewerSum: 32, peakViewers: 20 },
      { name: "Sexta", days: 1, tokens: 100, viewerSamples: 2, viewerSum: 16, peakViewers: 16 },
    ],
    newUserBars: [{ label: "05/01", value: 4 }],
    returningUserBars: [{ label: "05/01", value: 6 }],
    newTipperBars: [{ label: "05/01", value: 2 }],
    returningTipperBars: [{ label: "05/01", value: 3 }],
    audienceDays: 1,
    audienceConversion: {
      days: 2,
      newUsers: 6,
      newTippers: 3,
      returningUsers: 9,
      returningTippers: 5,
    },
    roomKingRows: [
      { dateBr: "05/01/2026", name: "TestModel", tokens: 605, valueSource: "chat" },
    ],
    eventSummaryTotals: {
      Menu: { count: 4, tokens: 300, type: "menu" },
    },
    eventSummaryDays: 2,
    menuOptionRows: [{ label: "Kiss", count: 3, tokens: 80 }],
    rouletteOutcomeRows: [{ label: "Gold", count: 2, tokens: 20 }],
    donorRows: [{ name: "TestModel", tips: 5, days: 2, tokens: 200 }],
    suspectRows: [{ username: "Bot?", days: 2, suspicionLevel: "Alto", suspicionScore: 9 }],
    mutedRows: [{ username: "Muted", days: 1, mutedBy: "Mod", lastMessage: "spam" }],
    moderationLogCount: 2,
    moderationSuccessCount: 1,
    moderationFailureCount: 1,
    moderationPendingCount: 0,
    newTipperBars: [{ label: "05/01", value: 2 }],
    returningTipperBars: [{ label: "05/01", value: 3 }],
    suspectBars: [{ label: "05/01", value: 1 }],
    mutedBars: [{ label: "05/01", value: 1 }],
    activeRatioPct: 60,
    isWeekly: false,
    isMonthly: false,
    heatmap: [
      {
        name: "Segunda",
        cells: Array.from({ length: 24 }, (_, hour) => ({
          tokens: hour === 10 ? 110 : 0,
          events: hour === 10 ? 2 : 0,
          avgViewers: hour === 10 ? 14 : 0,
        })),
      },
    ],
    activityTimeline: Array.from({ length: 24 }, (_, hour) => ({
      events: hour === 10 ? 2 : 0,
      moderation: hour === 10 ? 1 : 0,
    })),
    engagementRows: [
      {
        name: "User One",
        firstSeenDate: "2026-11-18",
        tokens: 90,
        messages: 12,
        totalTimeSpent: 3600,
        visitCount: 2,
        engagementScore: 342,
      },
    ],
    audienceEfficiency: {
      tokensPerAverageViewer: 28.1,
      tokensPerNetHour: 150,
      averageViewers: 16,
    },
    leagueEngagementRows: [
      { label: "Prata", users: 2, tokens: 50, tokensPerUser: 25, messages: 10, minutesPerUser: 30 },
    ],
    goalTimeline: [
      { dateKey: "2026-11-18", sourceIndex: 2, timestamp: 1767636000000, description: "Chegar a 1000", status: "Completa", amount: 1000 },
    ],
    showTimeline: [
      { dateKey: "2026-11-18", sourceIndex: 1, eventId: "show-1", timestamp: 1767636000000, label: "Show Privado", type: "Show Privado", tokens: 45 },
    ],
  }, {
    enableSuspectRemoval: true,
    comparisonSummary: {
      start: "2026-11-11",
      end: "2026-11-17",
      totalPeriodTokens: 300,
      activeDays: 2,
      avgPerActiveDay: 150,
      periodAvgViewers: 12,
      maxPeak: 20,
      hourlyBars: [{ label: "14h", value: 50 }],
      bestLiveByPace: { tokensPerHour: 100 },
    },
  });

  assert.match(html, /450 tk/);
  assert.match(html, /18\/11\/2026/);
  assert.match(html, /Quarta/);
  assert.match(html, /Média tokens\/dia/);
  assert.match(html, /Dia com maior público médio/);
  assert.match(html, /Quarta · 16 espectadores/);
  assert.match(html, /Horário com maior média de espectadores/);
  assert.match(html, /Média de espectadores por horário/);
  assert.match(html, /Média de tokens por horário/);
  assert.match(html, /14h: média de 10 tk por dia ativo \(30 tk em 3 dias\)/);
  assert.match(html, /Média de usuários listados por horário/);
  assert.match(html, /Média de usuários com tokens por horário/);
  assert.match(html, /Média de usuários com tokens por dia/);
  assert.match(html, /Média de usuários com tokens por dia da semana/);
  assert.match(html, /Pico de usuários com tokens por horário/);
  assert.doesNotMatch(html, /Evolução de tokens/);
  const getChartSvg = (title) => {
    const titleIndex = html.indexOf(`>${title}</strong>`);
    const svgStart = html.indexOf("<svg", titleIndex);
    const svgEnd = html.indexOf("</svg>", svgStart);
    assert.ok(titleIndex >= 0 && svgStart > titleIndex && svgEnd >= 0);
    return html.slice(svgStart, svgEnd + "</svg>".length);
  };
  const getChartGroupHtml = (title) => {
    const titleIndex = html.indexOf(`>${title}</strong>`);
    const groupStart = html.lastIndexOf('<section class="report-chart-group', titleIndex);
    const groupEnd = html.indexOf("</section>", groupStart);
    assert.ok(titleIndex >= 0 && groupStart >= 0 && groupEnd > titleIndex);
    return html.slice(groupStart, groupEnd);
  };
  assert.match(getChartGroupHtml("Tokens por horário"), /Tendências e ganhos/);
  assert.match(getChartGroupHtml("Média de tokens por horário"), /Tendências e ganhos/);
  assert.match(getChartGroupHtml("Média de espectadores por horário"), /Público e usuários/);
  assert.match(getChartGroupHtml("Duração por live no período"), /Lives e duração/);
  for (const title of [
    "Tokens por horário",
    "Média de tokens por horário",
    "Média de espectadores por horário",
  ]) {
    const svg = getChartSvg(title);
    assert.match(svg, /<rect[^>]*fill="url\(#scm-bargrad-/);
    assert.doesNotMatch(svg, /<path /);
  }
  const tokensUsersWeekdaySvg = getChartSvg("Média de usuários com tokens por dia da semana");
  for (const weekday of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
    assert.match(tokensUsersWeekdaySvg, new RegExp(`>${weekday}</text>`));
  }
  for (const title of ["Duração por live no período", "Tokens por live no período"]) {
    const svg = getChartSvg(title);
    assert.match(svg, />12:00<\/text>/);
    assert.doesNotMatch(svg, /18\/11 12:00/);
    assert.match(svg, /18\/11\/2026/);
  }
  const mutedSection = html.match(
    /<section class="report-card">\s*<h2>Usuários silenciados<\/h2>[\s\S]*?<\/section>/,
  )?.[0];
  assert.ok(mutedSection);
  assert.match(mutedSection, /<th>Usuário<\/th><th>Por<\/th>/);
  assert.doesNotMatch(mutedSection, /<th[^>]*>Dias<\/th>/);
  assert.match(mutedSection, /<td>Muted<\/td>\s*<td>Mod<\/td>/);
  assert.match(html, /Média de tokens por dia da semana/);
  assert.match(html, /Novos usuários por dia/);
  assert.match(html, /Usuários recorrentes por dia/);
  assert.match(html, /Novos doadores por dia/);
  assert.match(html, /Doadores recorrentes por dia/);
  assert.match(html, /Conversão em doadores/);
  assert.match(html, /3 de 6 doaram/);
  assert.match(html, /5 de 9 presenças doaram/);
  assert.match(html, /a mesma pessoa pode aparecer em dias diferentes/);
  assert.match(html, /Rei da sala por dia/);
  assert.match(html, /Opções mais pedidas do menu/);
  assert.match(html, /Resultados mais frequentes na roleta/);
  assert.match(html, /TestModel/);
  assert.match(html, /Ganhos por tipo/);
  assert.match(html, /2 dias com dados/);
  assert.match(html, /Principais doadores no período/);
  assert.match(html, /class="report-dismiss-suspect" data-username="Bot\?"/);
  assert.match(html, /Melhor horário/);
  assert.match(html, /Maior gorjeta no período/);
  assert.match(html, /Maior gorjeta por dia/);
  assert.match(html, /Live com mais tokens/);
  assert.match(html, /Live com melhor ritmo/);
  assert.match(html, /Tokens por live no período/);
  assert.match(html, /Tempo bruto de live por dia/);
  assert.match(html, /Tempo líquido de live por dia/);
  assert.match(html, /Ritmo de ganhos por dia/);
  assert.match(html, /Ritmo de ganhos por horário/);
  assert.match(html, /Ritmo médio por dia da semana/);
  assert.match(html, /Pico e média de espectadores por dia/);
  assert.match(html, /Picos de espectadores por dia/);
  assert.match(html, /Mapa de calor por dia e horário/);
  assert.match(html, /Atividade e moderação por horário/);
  assert.match(html, /Engajamento por usuário/);
  assert.match(html, /User One/);
  assert.match(html, /Eficiência da audiência/);
  assert.match(html, /Engajamento por liga/);
  assert.match(html, /Linha do tempo de metas/);
  assert.match(html, /data-model-id="model-a" data-entry-date="2026-11-18" data-entry-kind="goal" data-entry-index="2"/);
  assert.doesNotMatch(html, /Linha do tempo de metas e shows/);
  assert.doesNotMatch(html, /data-entry-kind="show"/);
  assert.match(html, /Ritmo de ganhos por live/);
  assert.match(html, /Insights · 2026-11-18–2026-11-20 vs\. 2026-11-11–2026-11-17/);
  assert.match(html, /report-chart-group--gains/);
  assert.match(html, /report-chart-group--audience/);
  assert.match(html, /report-chart-group--lives/);
  assert.match(html, /report-chart-group--comparison/);
  assert.ok(
    html.indexOf("Tendências e ganhos") < html.indexOf("Público e usuários") &&
      html.indexOf("Público e usuários") < html.indexOf("Lives e duração"),
  );
  assert.match(html, /Comparação da média diária de tokens/);
  assert.match(html, /Comparação da média de espectadores/);
  assert.match(html, /Insights do período/);
  assert.match(html, /Houve registros em 3 de 3 dias do período \(100%\): 18\/11\/2026, 19\/11\/2026 e 20\/11\/2026/);
  assert.match(html, /O melhor dia concentrou 49% dos tokens do período/);
  assert.match(html, /Dados de público foram registrados em 1 de 3 dias/);
  assert.match(html, /14h concentrou 75% dos tokens contabilizados por hora/);
  assert.match(html, /Quarta teve média diária 20% acima da média de dias ativos/);
  assert.match(html, /19\/11 11:00 teve ritmo 14% acima da média de todas as lives com duração registrada/);
  assert.match(html, /2 tentativa\(s\), 1 confirmada\(s\), 1 falha\(s\) e 0 pendente\(s\)/);
});

test("identifies the recorded date in period insights", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: "2026-11-15",
    end: "2026-11-21",
    dateKeys: [
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
    ],
    dailyByDate: {
      "2026-11-21": {
        date: "2026-11-21",
        totalTokensDay: 100,
      },
    },
  });

  const html = buildPeriodReportHtml(summary);

  assert.match(html, /Houve registros em 21\/11\/2026 \(1 de 7 dias do período; 14%\)\./);
  assert.match(html, /Ganhos por data/);
  assert.match(html, /Média de tokens por dia da semana/);
  assert.match(html, /Domingo a sábado · vazios = sem registro/);
  const weekdayChart = html.match(
    /<strong[^>]*>Média de tokens por dia da semana<\/strong>[\s\S]*?<svg[\s\S]*?<\/svg>/,
  )?.[0];
  assert.ok(weekdayChart);
  for (const weekday of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
    assert.match(weekdayChart, new RegExp(`>${weekday}</text>`));
  }
});

test("omits audience comparisons when neither period has viewer samples", () => {
  const buildEmptySummary = (date) => buildPeriodReportSummary({
    modelId: "model",
    modelEntries: [],
    start: date,
    end: date,
    dateKeys: [date],
  });
  const html = buildPeriodReportHtml(buildEmptySummary("2026-11-21"), {
    comparisonSummary: buildEmptySummary("2026-11-20"),
  });
  const comparisonInsights = html.match(
    /<section class="report-card comparison-insights">([\s\S]*?)<\/section>/,
  )?.[1];

  assert.ok(comparisonInsights);
  assert.doesNotMatch(comparisonInsights, /Média de espectadores|Pico de espectadores/);
  assert.doesNotMatch(html, />Comparação da média de espectadores<\/strong>/);
});

test("includes zero-token sessions in the period average pace insight", () => {
  const summary = buildPeriodReportSummary({
    modelId: "model",
    modelEntries: [],
    start: "2026-11-21",
    end: "2026-11-21",
    dateKeys: ["2026-11-21"],
  });
  summary.liveSessionRows = [
    { label: "Live sem ganhos", durationSeconds: 3600, tokensPerHour: 0, tokens: 0 },
    { label: "Live melhor", durationSeconds: 3600, tokensPerHour: 100, tokens: 100 },
  ];
  summary.bestLiveByPace = { label: "Live melhor", tokensPerHour: 100 };
  const html = buildPeriodReportHtml(summary);

  assert.match(
    html,
    /Live melhor teve ritmo 100% acima da média de todas as lives com duração registrada/,
  );
});

test("renders a focused live report with an optional live comparison", () => {
  const html = buildSessionReportHtml({
    dateBr: "20/11/2026",
    modelName: "Sample Model",
    session: {
      sessionId: "live-a",
      startedAt: "14:45:38",
      endedAt: "14:55:42",
      durationSeconds: 604,
      tokens: 605,
      peakViewers: 30,
      avgViewers: 12,
      minuteRows: [],
    },
    comparisonSession: {
      sessionId: "live-b",
      startedAt: "14:30:29",
      endedAt: "14:45:21",
      durationSeconds: 892,
      tokens: 450,
      peakViewers: 24,
      avgViewers: 10,
    },
    timeBars: [{
      label: "14:45",
      value: 25,
      avgListedUsers: 8,
      listedUsersSamples: 2,
      tooltip: "14:45 - 14:49 (5m): 25 tk",
    }],
    audiencePoints: [],
    timeStepMin: 5,
  });

  assert.match(html, /Sample Model/);
  assert.match(html, /605 tk/);
  assert.match(html, /Comparação entre lives · 20\/11\/2026/);
  assert.match(html, /14:45:38/);
  assert.match(html, /14:30:29/);
  assert.match(html, /Live A \+155 tk em relação à Live B/);
  assert.match(html, /Insights da comparação entre lives/);
  assert.match(html, /Ganhos em tokens<\/small>\s*<strong>\+34%/);
  assert.match(html, /A média de 12 espectadores equivaleu a 40% do pico de 30/);
  assert.match(html, /Ganhos por intervalo da live/);
  assert.match(html, /Fluxo de Tokens \(Blocos de 5 min\)/);
  assert.match(html, /Fluxo de Usuários \(pessoas listadas\)/);
  assert.match(html, /14:45: 8 pessoas listadas \(média\)/);
});

test("formats durations as non-negative padded clock values", () => {
  assert.equal(formatReportDuration(3661), "01:01:01");
  assert.equal(formatReportDuration(-1), "00:00:00");
});
