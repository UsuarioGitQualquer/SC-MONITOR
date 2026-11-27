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
import {
  buildPeriodReportSummary,
  buildReportData,
} from "../src/ui/report-data.js";

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

test("can keep safety details out of panel metrics while retaining them by default", () => {
  const report = {
    suspectBots: [{ username: "Suspect", suspicionLevel: "Alto", suspicionScore: 40 }],
    mutedUsers: [{ username: "Muted", mutedBy: "Moderator", lastMessage: "spam" }],
    moderationStats: { attempts: 1, successes: 1, failures: 0, pending: 0 },
  };
  const pageHtml = buildDailyAdditionalMetricsHtml(report, {}, false);
  const panelHtml = buildDailyAdditionalMetricsHtml(
    report,
    {},
    false,
    false,
    { menu: false, tips: false, roulette: false },
    "",
    { showSafetyTables: false },
  );

  assert.match(pageHtml, /Suspeitas de bots no dia/);
  assert.match(pageHtml, /Usuários silenciados/);
  assert.match(pageHtml, /1 tentativa\(s\), 1 confirmada\(s\)/);
  assert.doesNotMatch(panelHtml, /Suspeitas de bots/);
  assert.doesNotMatch(panelHtml, /Usuários silenciados/);
  assert.doesNotMatch(panelHtml, /Moderação/);
});

test("renders daily report details and escapes user content", () => {
  const html = buildDailyReportHtml({
    report: {
      modelId: "model-a",
      modelName: "modelo",
      dateBr: "20/11/2026",
      dateKey: "2026-11-20",
      totalTokens: 120,
      peakViewers: 30,
      avgViewers: 12,
      bruteSeconds: 3600,
      netSeconds: 1800,
      showCounts: { ticket: 1, private: 2, exclusive: 3, group: 4 },
      showStats: {
        ticket: {
          earnings: 60,
          ticketsSold: 3,
          ticketShows: [{
            ticketsSold: 3,
            ticketPrice: 20,
            earnings: 60,
            startedAt: Date.parse("2026-11-20T14:30:00-03:00"),
            endedAt: Date.parse("2026-11-20T14:35:00-03:00"),
            ticketPriceBreakdown: [{ price: 20, quantity: 3 }],
            participants: ["TicketUser"],
            participantEntries: [{ name: "TicketUser", count: 3 }],
          }],
        },
        private: {
          earnings: 50,
          privateShows: [{
            startedAt: Date.parse("2026-11-20T15:10:00-03:00"),
            endedAt: Date.parse("2026-11-20T15:15:00-03:00"),
            earnings: 50,
          }],
        },
        exclusive: {
          earnings: 75,
          exclusiveShows: [{
            startedAt: Date.parse("2026-11-20T15:20:00-03:00"),
            endedAt: Date.parse("2026-11-20T15:25:00-03:00"),
            earnings: 75,
          }],
        },
        group: {
          earnings: 90,
          groupShows: [{
            earnings: 90,
            startedAt: Date.parse("2026-11-20T16:30:00-03:00"),
            endedAt: Date.parse("2026-11-20T16:40:00-03:00"),
            participants: ["GroupUser", "<script>"],
            participantEntries: [
              { name: "GroupUser", count: 2 },
              { name: "<script>", count: 1 },
            ],
          }],
        },
      },
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
      manualEarnings: [{
        id: "manual-private-chat",
        type: "Chat privado",
        manualEntry: true,
        manualAmount: 17,
        user: "<ManualUser>",
        scope: "day",
      }],
    },
    timeBars: [{
      label: "14:08",
      value: 1,
      avgListedUsers: 4,
      listedUsersSamples: 1,
      avgTokensUsers: 7,
      tokensUsersSamples: 2,
      tooltip: "14:08 - 14:09 (2m): 1 tk",
    }],
    timeStepMin: 2,
    enableSuspectRemoval: true,
  });

  test("shows unregistered Ticket show earnings when the price was not captured", () => {
    const dateKey = "2026-11-26";
    const daily = {
      capturedEvents: [{
        id: "ticket-sale-unknown-price",
        timestamp: Date.parse("2026-11-26T10:30:00-03:00"),
        type: "Ingresso Ticket",
        item: "Compra de Ingresso",
        price: 1,
      }],
    };
    const report = buildReportData({
      modelId: "test-model",
      modelName: "Test",
      dateKey,
    }, daily);
    const html = buildDailyReportHtml({ report, daily });

    assert.match(html, /Ticket show<\/small>\s*<strong>0<\/strong>/);
    assert.match(html, /Ganho estimado:<\/small>\s*Não registrado/);
    assert.match(html, /Ingressos vendidos:<\/small>\s*1/);
    assert.doesNotMatch(html, /Ganho estimado:<\/small>\s*1 tk/);
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
  assert.match(html, /Shows realizados no dia/);
  assert.match(html, /<h2>Shows<\/h2>/);
  assert.match(html, /Ticket show<\/small>\s*<strong>1<\/strong>/);
  assert.match(html, /Dependendo do momento em que a extensão é iniciada, alguns anúncios, compras ou gorjetas podem não ser capturados/);
  assert.match(html, /Show Privado<\/small>\s*<strong>2<\/strong>/);
  assert.match(html, /Show Exclusivo<\/small>\s*<strong>3<\/strong>/);
  assert.match(html, /Show em Grupo<\/small>\s*<strong>4<\/strong>/);
  assert.doesNotMatch(html, /report-card--show-counts-compact/);
  assert.match(html, /Ganho estimado:<\/small>\s*60 tk/);
  assert.match(html, /Ingressos vendidos:<\/small>\s*3/);
  assert.match(html, /Detalhamento dos Ticket shows/);
  assert.match(html, /Preço por ingresso:<\/small>\s*3 × 20 tk/);
  assert.match(html, /Detalhamento dos Shows em Grupo/);
  assert.match(html, /Detalhamento dos Shows Privados/);
  assert.match(html, /Detalhamento dos Shows Exclusivos/);
  assert.match(html, /Início:<\/small>\s*14:30/);
  assert.match(html, /Fim:<\/small>\s*14:35/);
  assert.match(html, /Início:<\/small>\s*15:10/);
  assert.match(html, /Fim:<\/small>\s*15:15/);
  assert.match(html, /Início:<\/small>\s*15:20/);
  assert.match(html, /Fim:<\/small>\s*15:25/);
  assert.match(html, /Início:<\/small>\s*16:30/);
  assert.match(html, /Fim:<\/small>\s*16:40/);
  assert.match(html, /Ver participantes/);
  assert.match(html, /TicketUser/);
  assert.match(html, /GroupUser/);
  assert.match(html, /Entradas no show:<\/small>\s*3/);
  assert.match(html, /Entradas no show:<\/small>\s*2/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Ganho estimado:<\/small>\s*50 tk/);
  assert.match(html, /Ganho estimado:<\/small>\s*75 tk/);
  assert.match(html, /Ganho estimado:<\/small>\s*90 tk/);
  assert.match(html, /Rei da sala neste dia/);
  assert.match(html, /&lt;King&gt;/);
  assert.match(html, /Chat capturado/);
  assert.match(html, /Ganhos por intervalo/);
  assert.match(html, /Fluxo de Tokens \(Blocos de 2 min\)/);
  assert.match(html, /Fluxo de Usuários \(pessoas listadas\)/);
  assert.match(html, /Usuários listados são aqueles cujo nome aparece na lista de usuários da sala/);
  assert.match(html, /Fluxo de Usuários com Tokens/);
  assert.match(html, /14:08: 7 usuários com tokens \(média\)/);
  assert.match(html, /14:08: 4 pessoas listadas \(média\)/);
  assert.match(html, /Shows/);
  assert.match(html, /Show: Show privado de 10 min/);
  assert.match(html, /Pico: 30/);
  assert.match(html, /Ticket show/);
  assert.match(html, /Início do Ticket show/);
  assert.match(html, /Fim do Ticket show/);
  assert.doesNotMatch(html, /nao-exibir|Compra de Ingresso/);
  assert.doesNotMatch(html, /Meta alcançada/);
  assert.match(html, /Blocos de 2 minutos/);
  assert.match(html, /Ganhos por tipo/);
  assert.match(html, /data-manual-entry-form/);
  assert.match(html, /name="scope"/);
  assert.match(html, /name="kind"/);
  assert.match(html, /name="amount"/);
  assert.match(html, /name="username"/);
  assert.match(html, /name="showId"/);
  assert.match(html, /Ganhos manuais registrados/);
  assert.match(html, /17 tk/);
  assert.match(html, /class="report-delete-manual-entry" data-model-id="model-a" data-entry-date="2026-11-20" data-entry-id="manual-private-chat"/);
  assert.match(html, /&lt;ManualUser&gt;/);
  assert.doesNotMatch(html, /<ManualUser>/);
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
  assert.match(html, /Última mensagem/);
  assert.match(html, /spam/);
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
      manualEarnings: [{
        id: "manual-private-show",
        timestamp: Date.parse("2026-11-23T12:40:00-03:00"),
        type: "Show Privado",
        item: "Show privado · ganho manual",
        manualEntry: true,
        manualNewShow: true,
        manualAmount: 20,
        showBoundary: "start",
      }],
    },
    timeBars: [{ label: "12:00", value: 10 }],
    audiencePoints: [{ label: "12:00", viewers: 5 }],
  });

  assert.match(html, /Início do show: Show em Grupo/);
  assert.match(html, /Fim do show: Show em Grupo/);
  assert.doesNotMatch(html, /Show em Grupo \(1 min\)/);
  assert.doesNotMatch(html, /Show privado · ganho manual/);
});

test("labels reconstructed ticket shows as estimated in the report and chart", () => {
  const dateKey = "2026-11-23";
  const daily = {
    date: dateKey,
    capturedEvents: [
      {
        id: "ticket-sale-one",
        timestamp: Date.parse("2026-11-23T12:02:00-03:00"),
        type: "Ingresso Ticket",
        user: "BuyerOne",
        price: 16,
      },
      {
        id: "ticket-sale-two",
        timestamp: Date.parse("2026-11-23T12:04:00-03:00"),
        type: "Ingresso Ticket",
        user: "BuyerTwo",
        price: 16,
      },
      {
        id: "ticket-end",
        timestamp: Date.parse("2026-11-23T12:10:00-03:00"),
        type: "Ticket show",
        item: "Ticket show (Fim)",
        showBoundary: "end",
      },
    ],
  };
  const report = buildReportData({
    modelId: "test-model",
    modelName: "modelo",
    dateKey,
  }, daily);
  const html = buildDailyReportHtml({
    report,
    daily,
    audiencePoints: [{ label: "12:05", viewers: 10 }],
  });

  assert.match(html, /Início estimado:<\/small>/);
  assert.match(html, /Preço por ingresso:<\/small>\s*2 × 16 tk/);
  assert.match(html, /fill="#22d3ee" fill-opacity="0\.14"/);
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
    newUserBars: [{ label: "05/01", value: 4, tooltip: "05/01: 4 novos usuários" }],
    returningUserBars: [{ label: "05/01", value: 6, tooltip: "05/01: 6 usuários recorrentes" }],
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
    mutedRows: [{
      username: "Muted",
      days: 1,
      mutedBy: "Mod",
      dateKey: "2026-01-05",
      lastMessage: "spam",
    }],
    mutedLogRows: [{
      username: "Muted",
      mutedBy: "Mod",
      dateKey: "2026-01-05",
      timestamp: Date.parse("2026-01-05T12:00:00-03:00"),
      lastMessage: "message from this day",
    }],
    moderationLogCount: 2,
    moderationSuccessCount: 1,
    moderationFailureCount: 1,
    moderationPendingCount: 0,
    newTipperBars: [{ label: "05/01", value: 2 }],
    returningTipperBars: [{ label: "05/01", value: 3 }],
    suspectBars: [{ label: "05/01", value: 1, tooltip: "05/01: 1 suspeita(s) registrada(s)" }],
    mutedBars: [{ label: "05/01", value: 1, tooltip: "05/01: 1 usuário(s) silenciado(s)" }],
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
    enableMutedRemoval: true,
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
  for (const title of [
    "Suspeitas de bots por dia",
    "Silenciados por dia",
    "Novos usuários por dia",
    "Usuários recorrentes por dia",
  ]) {
    assert.doesNotMatch(getChartSvg(title), /Acumulado:/);
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
  assert.match(mutedSection, /<th>Ação<\/th>/);
  assert.match(
    mutedSection,
    /class="report-delete-muted-user" data-model-id="model-a" data-username="Muted" data-start-date="2026-11-18" data-end-date="2026-11-20"/,
  );
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
  assert.match(html, /Mensagens dos usuários silenciados/);
  assert.match(html, /message from this day/);
  assert.match(html, /05\/01\/2026/);
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
  assert.match(html, /Resumo dos Shows no período/);
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

test("groups period show rows by type and date and omits empty participant lists", () => {
  const earlierDate = "2026-11-24";
  const dateKey = "2026-11-25";
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: earlierDate,
    end: dateKey,
    dateKeys: [earlierDate, dateKey],
    dailyByDate: {
      [earlierDate]: {
        capturedEvents: [
          { id: "older-ticket-start", timestamp: Date.parse("2026-11-24T13:00:00-03:00"), type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 10 },
          { id: "older-ticket-sale", timestamp: Date.parse("2026-11-24T13:01:00-03:00"), type: "Ingresso Ticket", item: "Compra de Ingresso", price: 10 },
          { id: "older-ticket-end", timestamp: Date.parse("2026-11-24T13:03:00-03:00"), type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
        ],
      },
      [dateKey]: {
        capturedEvents: [
          { id: "ticket-start", timestamp: Date.parse("2026-11-25T14:00:00-03:00"), type: "Ticket show", item: "Ticket show (Início)", showBoundary: "start", ticketPrice: 30 },
          { id: "ticket-user", timestamp: Date.parse("2026-11-25T14:01:00-03:00"), type: "Participante de show", item: "TicketUser", user: "TicketUser", showParticipantType: "ticket" },
          { id: "ticket-sale", timestamp: Date.parse("2026-11-25T14:02:00-03:00"), type: "Ingresso Ticket", item: "Compra de Ingresso", price: 30 },
          { id: "ticket-end", timestamp: Date.parse("2026-11-25T14:03:00-03:00"), type: "Ticket show", item: "Ticket show (Fim)", showBoundary: "end" },
          { id: "private-start", timestamp: Date.parse("2026-11-25T15:00:00-03:00"), type: "Show Privado", item: "Show Privado (Início)", showBoundary: "start", tokens: 20 },
          { id: "private-end", timestamp: Date.parse("2026-11-25T15:05:00-03:00"), type: "Show Privado", item: "Show Privado (Fim)", showBoundary: "end" },
          { id: "exclusive-start", timestamp: Date.parse("2026-11-25T16:00:00-03:00"), type: "Show Exclusivo", item: "Show Exclusivo (Início)", showBoundary: "start", tokens: 40 },
          { id: "exclusive-end", timestamp: Date.parse("2026-11-25T16:05:00-03:00"), type: "Show Exclusivo", item: "Show Exclusivo (Fim)", showBoundary: "end" },
          { id: "group-start", timestamp: Date.parse("2026-11-25T17:00:00-03:00"), type: "Show em Grupo", item: "Show em Grupo (Início)", showBoundary: "start", tokens: 15 },
          { id: "group-end", timestamp: Date.parse("2026-11-25T17:05:00-03:00"), type: "Show em Grupo", item: "Show em Grupo (Fim)", showBoundary: "end" },
        ],
      },
    },
  });

  const html = buildPeriodReportHtml(summary);

  assert.match(html, /report-card--show-counts-compact/);
  assert.match(html, /report-card--show-counts-period/);
  assert.match(html, /class="period-show-folder"/);
  assert.match(html, /class="period-show-date-folder"/);
  assert.equal((html.match(/<details class="period-show-folder">/g) || []).length, 4);
  assert.equal((html.match(/<details class="period-show-date-folder">/g) || []).length, 5);
  assert.match(html, /<span>Shows Privados<\/span>/);
  assert.match(html, /<span>Shows Exclusivos<\/span>/);
  assert.match(html, /<span>Shows em Grupo<\/span>/);
  const ticketFolderStart = html.indexOf('<details class="period-show-folder">');
  const privateFolderStart = html.indexOf('<details class="period-show-folder">', ticketFolderStart + 1);
  const ticketFolderHtml = html.slice(ticketFolderStart, privateFolderStart);
  assert.match(ticketFolderHtml, /<span>Ticket shows<\/span>\s*<small>2 shows<\/small>/);
  assert.ok(ticketFolderHtml.indexOf("25/11/2026") < ticketFolderHtml.indexOf("24/11/2026"));
  assert.match(ticketFolderHtml, /daily-ticket-show-grid daily-ticket-show-grid--compact/);
  assert.match(html, /Horário:<\/small> 14:00–14:03 · <small>Ingressos:<\/small> 1 · <small>Preço:<\/small> 1 × 30 tk · <small>Ganho:<\/small> 30 tk/);
  assert.match(html, /Ver participantes<\/span> <span>\(1\)/);
  assert.doesNotMatch(html, /Ver participantes<\/span> <span>\(0\)/);
  assert.doesNotMatch(ticketFolderHtml, /<details class="period-show-date-folder" open>/);
});

test("always shows both moderation charts for a period with no moderation records", () => {
  const date = "2026-11-25";
  const summary = buildPeriodReportSummary({
    modelId: "model",
    start: date,
    end: date,
    dateKeys: [date],
    dailyByDate: { [date]: { date } },
  });
  const html = buildPeriodReportHtml(summary);
  const moderationGroup = html.match(
    /<section class="report-chart-group report-chart-group--moderation">[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(moderationGroup);
  assert.match(moderationGroup, /Suspeitas de bots por dia/);
  assert.match(moderationGroup, /Silenciados por dia/);
  assert.equal((moderationGroup.match(/class="scm-cyber-card"/g) || []).length, 2);
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

test("renders period moderation details with per-record deletion without changing totals", () => {
  const dateKey = "2026-11-23";
  const summary = buildPeriodReportSummary({
    modelId: "model-a",
    start: dateKey,
    end: dateKey,
    dateKeys: [dateKey],
    dailyByDate: {
      [dateKey]: {
        moderationStats: { attempts: 2, successes: 1, failures: 1, pending: 0 },
        moderationLogs: [{
          id: 'log-"1',
          timestamp: Date.parse("2026-11-23T12:00:00-03:00"),
          time: "23/11/2026 12:00",
          user: "<user>",
          message: "spam & link",
          status: "SUCESSO",
        }],
      },
    },
  });

  const html = buildPeriodReportHtml(summary, { enableModerationRemoval: true });

  assert.match(html, /2 tentativa\(s\), 1 confirmada\(s\), 1 falha\(s\) e 0 pendente\(s\)/);
  assert.match(html, /Ver registros detalhados \(1\)/);
  assert.match(html, /class="report-delete-moderation-log"/);
  assert.match(html, /data-model-id="model-a"/);
  assert.match(html, /data-entry-date="2026-11-23"/);
  assert.match(html, /data-log-id="log-&quot;1"/);
  assert.match(html, /&lt;user&gt;/);
  assert.match(html, /spam &amp; link/);
  assert.match(html, /os totais agregados permanecem iguais/);
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
      capturedEvents: [
        {
          timestamp: Date.parse("2026-11-20T14:46:00-03:00"),
          type: "Ticket show",
          item: "Ticket show (Início)",
          showBoundary: "start",
          ticketPrice: 20,
        },
        {
          timestamp: Date.parse("2026-11-20T14:46:20-03:00"),
          type: "Participante de show",
          item: "TicketUser",
          user: "TicketUser",
          showParticipantType: "ticket",
        },
        {
          timestamp: Date.parse("2026-11-20T14:46:30-03:00"),
          type: "Ingresso Ticket",
          item: "Compra de Ingresso",
          price: 20,
        },
        {
          timestamp: Date.parse("2026-11-20T14:47:00-03:00"),
          type: "Ticket show",
          item: "Ticket show (Fim)",
          showBoundary: "end",
        },
        {
          timestamp: Date.parse("2026-11-20T14:48:00-03:00"),
          type: "Show em Grupo",
          item: "Show em Grupo (Início)",
          showBoundary: "start",
          tokens: 15,
        },
        {
          timestamp: Date.parse("2026-11-20T14:48:20-03:00"),
          type: "Participante de show",
          item: "GroupUser",
          user: "GroupUser",
          showParticipantType: "group",
        },
        {
          timestamp: Date.parse("2026-11-20T14:49:00-03:00"),
          type: "Show em Grupo",
          item: "Show em Grupo (Fim)",
          showBoundary: "end",
        },
      ],
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
    audiencePoints: [
      {
        label: "14:45",
        viewers: 10,
        leagues: { grey: 3, bronze: 2 },
        leagueSamples: 1,
      },
      {
        label: "14:50",
        viewers: 12,
        leagues: { grey: 4, bronze: 2 },
        leagueSamples: 1,
      },
    ],
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
  assert.match(html, /Shows registrados nesta live/);
  assert.match(html, /Pico: 30/);
  assert.match(html, /TicketUser/);
  assert.match(html, /GroupUser/);
  assert.match(html, /Ticket show/);
  assert.match(html, />Grupo<\/text>/);
  assert.match(html, /Fluxo de Tokens \(Blocos de 5 min\)/);
  assert.match(html, /Fluxo de Usuários \(pessoas listadas\)/);
  assert.match(html, /14:45: 8 pessoas listadas \(média\)/);
  assert.match(html, /📈 Total de listados por liga/);
  assert.match(html, /Último bloco \(14:50\): 6 listados/);
  assert.ok(
    html.indexOf("📈 Total de listados por liga") >
      html.indexOf("Fluxo de Usuários com Tokens"),
  );
});

test("formats durations as non-negative padded clock values", () => {
  assert.equal(formatReportDuration(3661), "01:01:01");
  assert.equal(formatReportDuration(-1), "00:00:00");
});
