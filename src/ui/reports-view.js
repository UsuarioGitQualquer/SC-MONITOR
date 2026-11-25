import { clean } from "../utils/helpers.js";
import {
  buildInteractiveBarsSvg,
  buildNeonDonutGauge,
  buildNeonWaveAreaChart,
  buildCombinedAudienceEarningsChart,
} from "./dashboard/basic-charts.js";
import {
  buildReportHorizontalChart,
  buildReportLeaguesChart,
  buildReportUsersChart,
} from "./report-charts.js";
import { buildTimeBucketBars } from "./chart-data.js";
import {
  buildGainTypeRows,
  getRoomKingSourceLabel,
  hasAudienceConversionStats,
  hasAudienceStats,
  WEEKDAY_NAMES,
} from "./report-data.js";

const RANKING_PODIUM_COLORS = [
  ["#fbbf24", "#f97316"],
  ["#cbd5e1", "#64748b"],
  ["#fb923c", "#c2410c"],
];

const SUMMARY_ICONS = {
  tokens: '<circle cx="12" cy="12" r="8.5"></circle><path d="M15 8.5c-.7-.7-1.6-1-2.8-1-1.4 0-2.4.7-2.4 1.8 0 2.8 5.2 1.2 5.2 4.2 0 1.2-1.1 2-2.7 2-1.2 0-2.2-.4-3-1.2M12 5.5v13"></path>',
  duration: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3.5 2"></path>',
  pace: '<path d="M4.5 18.5a9 9 0 1 1 15 0"></path><path d="m12 13 4-4M7.5 18.5h9"></path><circle cx="12" cy="13" r="1"></circle>',
  audience: '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19zM16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.5V19h-4"></path>',
  tips: '<path d="M20 12v7H4v-7M2.5 7.5h19v4h-19zM12 7.5v11.5"></path><path d="M12 7.5H8.5a2 2 0 1 1 2-2c0 1.1 1.5 2 1.5 2ZM12 7.5h3.5a2 2 0 1 0-2-2c0 1.1-1.5 2-1.5 2Z"></path>',
  messages: '<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5a7.5 7.5 0 1 1 17-3Z"></path><path d="M7.5 11h.01M12 11h.01M16.5 11h.01"></path>',
};

const CHART_GROUP_ICONS = {
  audience: '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19zM16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.5V19h-4"></path>',
  gains: '<circle cx="12" cy="12" r="9"></circle><path d="M15 8.5c-.7-.7-1.6-1-2.8-1-1.4 0-2.4.7-2.4 1.8 0 2.8 5.2 1.2 5.2 4.2 0 1.2-1.1 2-2.7 2-1.2 0-2.2-.4-3-1.2M12 5.5v13"></path>',
  lives: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path>',
  events: '<path d="M12 3.5 14.5 9l6 1-4.5 4.2 1.1 6-5.1-2.9-5.1 2.9 1.1-6L3.5 10l6-1z"></path>',
  activity: '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2"></path>',
  comparison: '<path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6"></path><path d="M16 7h3v3"></path>',
  moderation: '<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z"></path><path d="m9 12 2 2 4-4"></path>',
};

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildReportChartGroup(title, description, category, charts = []) {
  const chartMarkup = charts.filter((chart) => typeof chart === "string" && chart.trim()).join("");
  const icon = CHART_GROUP_ICONS[category];
  if (!chartMarkup || !icon) return "";
  return `
    <section class="report-chart-group report-chart-group--${category}">
      <header class="report-chart-group-heading">
        <span class="report-chart-group-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">${icon}</svg>
        </span>
        <div>
          <h2>${clean(title)}</h2>
          <p>${clean(description)}</p>
        </div>
      </header>
      <div class="chart-grid">${chartMarkup}</div>
    </section>
  `;
}

function buildReportFlowCharts(timeBars, timeStepMin, subtitle) {
  const intervalLabel = timeStepMin === 60 ? "1h" : `${timeStepMin} min`;
  const bars = Array.isArray(timeBars) ? timeBars : [];
  const tokenPoints = bars.map((bar) => ({
    label: bar.label,
    value: bar.value,
    tooltip: bar.tooltip,
  }));
  const userPoints = bars
    .filter((bar) => Number(bar.listedUsersSamples) > 0)
    .map((bar) => ({
      label: bar.label,
      value: bar.avgListedUsers,
      tooltip: `${bar.label}: ${bar.avgListedUsers} pessoas listadas (média)`,
    }));

  return buildReportChartGroup(
    "Fluxos ao longo do tempo",
    "Acompanhe os ganhos e a média de pessoas listadas em cada bloco.",
    "lives",
    [
      buildNeonWaveAreaChart({
        title: `🌊 Fluxo de Tokens (Blocos de ${intervalLabel})`,
        subtitle,
        points: tokenPoints,
      }),
      buildNeonWaveAreaChart({
        title: "👥 Fluxo de Usuários (pessoas listadas)",
        subtitle: `Média em blocos de ${intervalLabel}`,
        points: userPoints,
        strokeColor: "#00e5ff",
        fillStart: "#00e5ff",
        fillEnd: "#2563eb",
      }),
    ],
  );
}

function buildHourlyAxisBars(bars) {
  const barsByHour = new Map((Array.isArray(bars) ? bars : []).map((bar) => [bar.label, bar]));
  return Array.from({ length: 24 }, (_, hour) => {
    const label = `${String(hour).padStart(2, "0")}h`;
    const bar = barsByHour.get(label);
    return bar ? { ...bar, label } : { label, value: 0 };
  });
}

export function buildReportEmptyState(message) {
  return `
    <div class="empty-state">
      <svg class="empty-state-art" viewBox="0 0 64 48" aria-hidden="true">
        <rect x="5" y="5" width="54" height="38" rx="9"></rect>
        <path d="M14 34v-8h7v8m5 0V19h7v15m5 0v-5h7v5"></path>
        <path d="m14 21 9-5 8 3 12-9"></path>
        <circle cx="47" cy="10" r="2"></circle>
      </svg>
      <p>${clean(message)}</p>
    </div>
  `;
}

function buildSummaryStrip(cards = []) {
  const validCards = cards.filter((card) => card?.label);
  if (validCards.length === 0) return "";
  return `
    <div class="report-summary-strip">
      ${validCards.map((card) => `
        <div class="report-summary-item report-summary-item--${clean(card.tone || "cyan")}">
          ${SUMMARY_ICONS[card.icon] ? `<span class="report-summary-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${SUMMARY_ICONS[card.icon]}</svg></span>` : ""}
          <small>${clean(card.label)}</small>
          <strong>${clean(card.value)}</strong>
          ${card.note ? `<span>${clean(card.note)}</span>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function buildReportHero({
  name,
  eyebrow,
  subtitle,
  badges = [],
}) {
  const safeName = clean(name || "Modelo");
  const badgesHtml = badges
    .filter((badge) => badge?.label)
    .map((badge) =>
      `<span class="report-hero-badge ${clean(badge.className || "")}">${clean(badge.label)}</span>`,
    )
    .join("");

  return `
    <section class="report-hero">
      <div class="report-hero-avatar" aria-hidden="true">
        <svg viewBox="0 0 40 40" focusable="false" style="width:38px;height:38px;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.6">
          <rect x="5" y="6" width="30" height="23" rx="4"></rect>
          <path d="M12 34h16m-8-5v5M10 23v-5h4v5m4 0v-9h4v9m4 0v-6h4v6"></path>
          <path d="m10 15 6-4 5 2 7-5"></path>
          <circle cx="28" cy="8" r="1.5"></circle>
        </svg>
      </div>
      <div class="report-hero-copy">
        <span class="report-hero-eyebrow">${clean(eyebrow)}</span>
        <h2>${safeName}</h2>
        ${subtitle ? `<p>${clean(subtitle)}</p>` : ""}
      </div>
      ${badgesHtml ? `<div class="report-hero-badges">${badgesHtml}</div>` : ""}
    </section>
  `;
}


export function formatReportDuration(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatTimeBucketRange(label, stepMinutes) {
  const match = String(label || "").match(/^(\d{1,2})(?::(\d{2})|h)$/i);
  if (!match) return String(label || "");

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return String(label);

  const start = hour * 60 + minute;
  const step = Math.max(1, Number(stepMinutes) || 60);
  const end = Math.min(1439, start + step - 1);
  const formatTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return `${formatTime(start)}–${formatTime(end)}`;
}

function buildGainTypeChart(eventSummaryTotals, daysWithData = 0) {
  const rows = buildGainTypeRows(eventSummaryTotals);
  if (rows.length === 0) return "";

  const colorByType = {
    "Gorjeta avulsa": ["#22d3ee", "#2563eb"],
    "Compra de Conteúdo": ["#34d399", "#0f766e"],
    Menu: ["#fb923c", "#e11d48"],
    Roleta: ["#f472b6", "#8b5cf6"],
    "Show exclusivo": ["#c084fc", "#7c3aed"],
    "Show privado": ["#a78bfa", "#ec4899"],
    Ticket: ["#facc15", "#f97316"],
    Battleship: ["#34d399", "#0f766e"],
    "Objetivo Épico": ["#60a5fa", "#8b5cf6"],
    Outros: ["#94a3b8", "#475569"],
  };
  const coloredRows = rows.map((row) => {
    const [color, secondaryColor] = colorByType[row.label] || colorByType.Outros;
    return { ...row, color, secondaryColor };
  });
  const eventCount = rows.reduce((sum, row) => sum + row.count, 0);
  const totalTokens = rows.reduce((sum, row) => sum + row.value, 0);
  const eventLabel = eventCount === 1 ? "evento" : "eventos";
  const dayLabel = daysWithData > 0
    ? ` · ${daysWithData} ${daysWithData === 1 ? "dia" : "dias"} com dados`
    : "";

  return buildReportHorizontalChart({
    title: "💎 Ganhos por tipo",
    subtitle: `${eventCount} ${eventLabel} · ${totalTokens} tk${dayLabel}`,
    accentColor: coloredRows[0].color,
    rows: coloredRows.map((row) => ({
      label: `${row.label} (${row.count} ${row.count === 1 ? "evento" : "eventos"})`,
      value: row.value,
      color: row.color,
      secondaryColor: row.secondaryColor,
    })),
  });
}

function buildPopularItemsChart(
  title,
  rows = [],
  { accentColor = "#00e5ff", colorStart = "#00e5ff", colorEnd = "#8a2be2" } = {},
) {
  if (!Array.isArray(rows)) rows = [];
  if (!rows.length) return "";
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  return buildReportHorizontalChart({
    title,
    subtitle: `${totalCount} registro(s)`,
    accentColor,
    unit: "x",
    rows: rows.slice(0, 10).map((row, index) => {
      const [color, secondaryColor] = RANKING_PODIUM_COLORS[index] || [colorStart, colorEnd];
      return {
        label: `#${index + 1} ${row.label} (${row.count}x)`,
        value: row.count,
        color,
        secondaryColor,
      };
    }),
  });
}

function buildSafetyTables({
  suspectRows = [],
  mutedRows = [],
  moderationLogCount = 0,
  moderationSuccessCount = 0,
  moderationFailureCount = 0,
  moderationPendingCount = 0,
  enableSuspectRemoval = false,
  scope = "no per\u00edodo",
}) {
  const suspectHtml = suspectRows.length
    ? `
      <section class="report-card">
        <h2>Suspeitas de bots ${scope}</h2>
        <div class="report-table-wrap">
          <table>
            <thead><tr><th>Usu\u00e1rio</th><th>N\u00edvel m\u00e1ximo</th><th style="text-align:right;">Dias</th><th style="text-align:right;">Pontua\u00e7\u00e3o</th>${enableSuspectRemoval ? "<th>Ação</th>" : ""}</tr></thead>
            <tbody>${suspectRows.slice(0, 20).map((suspect) => `
              <tr>
                <td>${clean(suspect.username)}</td>
                <td>${clean(suspect.suspicionLevel || "—")}</td>
                <td style="text-align:right;">${suspect.days}</td>
                <td style="text-align:right;">${Math.round(Number(suspect.suspicionScore) || 0)}</td>
                ${enableSuspectRemoval ? `<td><button type="button" class="report-dismiss-suspect" data-username="${escapeAttribute(suspect.username)}" title="Dispensar usuário das suspeitas" aria-label="Dispensar ${clean(suspect.username)}">×</button></td>` : ""}
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </section>
    `
    : "";
  const mutedHtml = mutedRows.length
    ? `
      <section class="report-card">
        <h2>Usu\u00e1rios silenciados</h2>
        <div class="report-table-wrap">
          <table>
            <thead><tr><th>Usu\u00e1rio</th><th>Por</th></tr></thead>
            <tbody>${mutedRows.slice(0, 20).map((muted) => `
              <tr>
                <td>${clean(muted.username)}</td>
                <td>${clean(muted.mutedBy || "—")}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </section>
    `
    : "";
  const moderationHtml = moderationLogCount > 0
    ? `<section class="report-card"><h2>Modera\u00e7\u00e3o</h2><p>${moderationLogCount} tentativa(s), ${moderationSuccessCount} confirmada(s), ${moderationFailureCount} falha(s) e ${moderationPendingCount} pendente(s).</p></section>`
    : "";
  return `${suspectHtml}${mutedHtml}${moderationHtml}`;
}

export function buildDailyAdditionalMetricsHtml(
  report,
  daily = {},
  showAudienceStats = true,
  enableSuspectRemoval = false,
  activityRankings = {},
  leadingChart = "",
) {
  const showMenuRanking = activityRankings.menu ?? true;
  const showRouletteRanking = activityRankings.roulette ?? true;
  const showTipRanking = activityRankings.tips ?? true;
  const menuChart = showMenuRanking
    ? buildPopularItemsChart("Op\u00e7\u00f5es mais pedidas do menu", report.menuOptionRows, {
      accentColor: "#fb7185",
      colorStart: "#fb7185",
      colorEnd: "#e11d48",
    })
    : "";
  const rouletteChart = showRouletteRanking
    ? buildPopularItemsChart("Resultados mais frequentes na roleta", report.rouletteOutcomeRows, {
      accentColor: "#38bdf8",
      colorStart: "#38bdf8",
      colorEnd: "#4f46e5",
    })
    : "";
  const topTipsChart = showTipRanking && report.topTipRows?.length ? buildReportHorizontalChart({
    title: "Maiores gorjetas individuais",
    subtitle: "Top 10 do dia",
    accentColor: "#fbbf24",
    rows: (report.topTipRows || []).map((tip, index) => {
      const [color, secondaryColor] = RANKING_PODIUM_COLORS[index] || ["#fbbf24", "#f97316"];
      return {
        label: `#${index + 1} ${tip.username} · ${tip.type}`,
        value: tip.tokens,
        color,
        secondaryColor,
      };
    }),
  }) : "";
  const suspectRows = (Array.isArray(report.suspectBots) ? report.suspectBots : []).map((suspect) => ({
    ...suspect,
    days: 1,
  }));
  const mutedRows = (Array.isArray(report.mutedUsers) ? report.mutedUsers : []).map((muted) => ({
    ...muted,
    days: 1,
  }));
  const logs = Array.isArray(report.moderationLogs) ? report.moderationLogs : [];
  const moderationStats = report.moderationStats && typeof report.moderationStats === "object"
    ? report.moderationStats
    : null;
  const moderationLogCount = moderationStats
    ? Number(moderationStats.attempts) || 0
    : logs.length;
  const successCount = moderationStats
    ? Number(moderationStats.successes) || 0
    : logs.filter((log) => String(log.status || "").toUpperCase() === "SUCESSO").length;
  const failureCount = moderationStats
    ? Number(moderationStats.failures) || 0
    : logs.filter((log) => String(log.status || "").toUpperCase() === "FALHA").length;
  const safetyTables = buildSafetyTables({
    suspectRows,
    mutedRows,
    moderationLogCount,
    moderationSuccessCount: successCount,
    moderationFailureCount: failureCount,
    moderationPendingCount: moderationStats
      ? Number(moderationStats.pending) || 0
      : logs.filter((log) => String(log.status || "").toUpperCase() === "PENDENTE").length,
    enableSuspectRemoval,
    scope: "no dia",
  });
  const audience = daily.audienceStats || {};
  const audienceStats = showAudienceStats &&
    (Number(audience.newUsers) || 0) + (Number(audience.returningUsers) || 0) > 0
    ? `
      <section class="report-card">
        <h2>Audi\u00eancia e doadores</h2>
          <p>Novos: ${Number(audience.newUsers) || 0} (${Number(audience.newTippers) || 0} doadores) \u00b7
          Recorrentes: ${Number(audience.returningUsers) || 0} (${Number(audience.returningTippers) || 0} doadores)</p>
      </section>
    `
    : "";
  const leagueChartHtml = buildReportChartGroup(
    "Engajamento por liga",
    "Distribuição de usuários por nível de atividade.",
    "audience",
    [leadingChart],
  );
  const activityRankingsHtml = buildReportChartGroup(
    "Gorjetas e eventos",
    "Itens mais frequentes entre gorjetas, menu e roleta.",
    "events",
    [
      showTipRanking ? topTipsChart : "",
      showRouletteRanking ? rouletteChart : "",
      showMenuRanking ? menuChart : "",
    ],
  );
  return `${leagueChartHtml}${activityRankingsHtml}${audienceStats}${safetyTables}`;
}

function buildSessionComparisonTable(sessionA, sessionB, dateBr, timeStepMin = 60) {
  if (!sessionA || !sessionB || sessionA.sessionId === sessionB.sessionId) return "";

  const tokensA = Math.round(Number(sessionA.tokens) || 0);
  const tokensB = Math.round(Number(sessionB.tokens) || 0);
  const durationA = Math.max(0, Number(sessionA.durationSeconds) || 0);
  const durationB = Math.max(0, Number(sessionB.durationSeconds) || 0);
  const paceA = durationA > 0 ? Math.round((tokensA / durationA) * 3600) : 0;
  const paceB = durationB > 0 ? Math.round((tokensB / durationB) * 3600) : 0;
  const tokenDelta = tokensA - tokensB;
  const sessionBarsA = buildTimeBucketBars(sessionA.minuteRows || [], timeStepMin);
  const sessionBarsB = buildTimeBucketBars(sessionB.minuteRows || [], timeStepMin);
  const bestSessionBar = sessionBarsA
    .filter((bar) => Number(bar.value) > 0)
    .reduce((best, bar) => !best || bar.value > best.value ? bar : best, null);
  const comparisonBar = bestSessionBar
    ? sessionBarsB.find((bar) => bar.label === bestSessionBar.label)
    : null;
  const insightMetrics = [
    { label: "Ganhos em tokens", current: tokensA, previous: tokensB, unit: "tk" },
    { label: "Ritmo de ganhos", current: paceA, previous: paceB, unit: "tk/h" },
    {
      label: "Média de espectadores",
      current: Number(sessionA.avgViewers) || 0,
      previous: Number(sessionB.avgViewers) || 0,
      unit: "espectadores",
    },
    {
      label: "Pico de espectadores",
      current: Number(sessionA.peakViewers) || 0,
      previous: Number(sessionB.peakViewers) || 0,
      unit: "espectadores",
    },
  ];
  if (bestSessionBar && comparisonBar) {
    insightMetrics.push({
      label: `Ganhos no melhor horário (${bestSessionBar.label})`,
      current: Number(bestSessionBar.value) || 0,
      previous: Number(comparisonBar.value) || 0,
      unit: "tk",
    });
  }

  return `
    <section class="report-card">
      <h2>Comparação entre lives · ${clean(dateBr)}</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Métrica</th><th>Live A · ${clean(sessionA.startedAt || "--:--")}</th><th>Live B · ${clean(sessionB.startedAt || "--:--")}</th></tr></thead>
          <tbody>
            <tr><td>Tokens</td><td>${tokensA} tk</td><td>${tokensB} tk</td></tr>
            <tr><td>Ritmo</td><td>${paceA} tk/h</td><td>${paceB} tk/h</td></tr>
            <tr><td>Duração</td><td>${formatReportDuration(durationA)}</td><td>${formatReportDuration(durationB)}</td></tr>
            <tr><td>Pico de espectadores</td><td>${Number(sessionA.peakViewers) || 0}</td><td>${Number(sessionB.peakViewers) || 0}</td></tr>
            <tr><td>Média de espectadores</td><td>${Number(sessionA.avgViewers) || 0}</td><td>${Number(sessionB.avgViewers) || 0}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="comparison-delta">Live A ${tokenDelta >= 0 ? "+" : ""}${tokenDelta} tk em relação à Live B</p>
    </section>
    ${buildComparisonInsights(insightMetrics, "Insights da comparação entre lives")}
  `;
}

function buildComparisonInsights(metrics, title) {
  const cards = metrics
    .filter((metric) => Number.isFinite(Number(metric.current)) && Number.isFinite(Number(metric.previous)))
    .map((metric) => {
      const current = Math.round(Number(metric.current));
      const previous = Math.round(Number(metric.previous));
      const delta = current - previous;
      const trend = delta > 0 ? "up" : delta < 0 ? "down" : "same";
      const percent = previous !== 0
        ? `${delta > 0 ? "+" : ""}${Math.round((delta / Math.abs(previous)) * 100)}%`
        : current === 0
          ? "Sem variação"
          : "Sem base anterior";
      const deltaValue = `${delta > 0 ? "+" : ""}${delta} ${metric.unit}`;
      return `
        <div class="comparison-insight comparison-insight--${trend}">
          <small>${clean(metric.label)}</small>
          <strong>${percent}</strong>
          <span>${deltaValue} · ${current} vs. ${previous} ${clean(metric.unit)}</span>
        </div>
      `;
    })
    .join("");
  if (!cards) return "";
  return `
    <section class="report-card comparison-insights">
      <h2>${clean(title)}</h2>
      <p class="comparison-insights-note">Variação baseada nos tokens registrados; não representa receita monetária.</p>
      <div class="comparison-insights-grid">${cards}</div>
    </section>
  `;
}

function getPercentDifference(current, baseline) {
  const value = Number(current);
  const reference = Number(baseline);
  if (!Number.isFinite(value) || !Number.isFinite(reference) || reference <= 0) return null;
  return Math.round(((value - reference) / reference) * 100);
}

function getConversionRate(tippers, users) {
  const totalUsers = Math.max(0, Number(users) || 0);
  return totalUsers > 0
    ? Math.round((Math.max(0, Number(tippers) || 0) / totalUsers) * 100)
    : null;
}

function formatConversionRate(tippers, users) {
  const rate = getConversionRate(tippers, users);
  return rate === null ? "—" : `${rate}%`;
}

function getOptionalReportNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildReportInsights(title, insights) {
  const items = insights.filter(Boolean);
  if (items.length === 0) return "";
  return `
    <section class="report-card report-insights">
      <h2>${clean(title)}</h2>
      <div class="report-insight-list">
        ${items.map((insight) => `<p class="report-insight">${clean(insight)}</p>`).join("")}
      </div>
    </section>
  `;
}

export function buildSessionReportHtml({
  dateBr,
  modelName = "",
  session,
  comparisonSession = null,
  timeBars = [],
  audiencePoints = [],
  timeStepMin = 60,
}) {
  if (!session) return buildReportEmptyState("Não há lives registradas para esta data.");

  const tokens = Math.round(Number(session.tokens) || 0);
  const durationSeconds = Math.max(0, Number(session.durationSeconds) || 0);
  const tokensPerHour = durationSeconds > 0
    ? Math.round((tokens / durationSeconds) * 3600)
    : 0;
  const bestInterval = timeBars
    .filter((bar) => Number(bar.value) > 0)
    .reduce((best, bar) => !best || bar.value > best.value ? bar : best, null);
  const sessionGainTypes = buildGainTypeRows(session.eventSummaryTotals);
  const sessionClassifiedTokens = sessionGainTypes.reduce((sum, row) => sum + row.value, 0);
  const leadingGainType = sessionGainTypes[0];
  const peakViewers = Math.max(0, Number(session.peakViewers) || 0);
  const avgViewers = Math.max(0, Number(session.avgViewers) || 0);
  const audiencePeakRatio = peakViewers > 0
    ? Math.round((avgViewers / peakViewers) * 100)
    : null;
  const sessionInsights = buildReportInsights("Insights da live", [
    bestInterval && tokens > 0 && bestInterval.value <= tokens
      ? `${bestInterval.label} foi o intervalo mais forte, com ${Math.round(bestInterval.value)} tk (${Math.round((bestInterval.value / tokens) * 100)}% dos tokens da live).`
      : "",
    leadingGainType && sessionClassifiedTokens > 0
      ? `${leadingGainType.label} liderou os ganhos classificados, com ${Math.round((leadingGainType.value / sessionClassifiedTokens) * 100)}% do total categorizado.`
      : "",
    audiencePeakRatio !== null && avgViewers <= peakViewers
      ? `A média de ${avgViewers} espectadores equivaleu a ${audiencePeakRatio}% do pico de ${peakViewers}.`
      : "",
  ]);
  const intervalLabel = timeStepMin === 60 ? "1h" : `${timeStepMin} min`;
  const sessionHero = buildReportHero({
    name: modelName || session.modelName || "Modelo",
    eyebrow: "Resumo da live",
    subtitle: `${clean(dateBr)} · ${clean(session.startedAt || "--:--")} → ${clean(session.endedAt || "ativa")}`,
    badges: [
      { label: clean(session.status || "Live registrada"), className: "report-hero-badge--status" },
      { label: `${tokens} tk`, className: "report-hero-badge--tokens" },
      { label: `${tokensPerHour} tk/h`, className: "report-hero-badge--pace" },
    ],
  });

  return `
    ${sessionHero}
    ${buildSummaryStrip([
      { label: "Tokens", value: `${tokens} tk`, tone: "cyan", icon: "tokens" },
      { label: "Duração", value: formatReportDuration(durationSeconds), tone: "purple", icon: "duration" },
      { label: "Tokens/hora", value: `${tokensPerHour} tk/h`, tone: "orange", icon: "pace" },
      { label: "Público", value: `${peakViewers} / ${avgViewers}`, note: "pico / média", tone: "pink", icon: "audience" },
    ])}
    <div class="combined-report-chart">
      ${buildCombinedAudienceEarningsChart({
        title: "Público e ganhos da live · Ganhos por intervalo da live",
        subtitle: `${clean(session.startedAt || "--:--")} · blocos de ${intervalLabel}`,
        audiencePoints: audiencePoints.map((point) => ({
          label: point.label,
          value: point.viewers,
          tooltip: point.tooltip,
        })),
        earningsBars: timeBars,
        eventMarkers: [],
      })}
    </div>
    ${buildReportFlowCharts(
      timeBars,
      timeStepMin,
      `${dateBr} · ${session.startedAt || "--:--"}–${session.endedAt || "ativa"}`,
    )}
    ${sessionInsights}
    ${buildSessionComparisonTable(session, comparisonSession, dateBr, timeStepMin)}
    <div class="chart-grid">
      ${buildGainTypeChart(session.eventSummaryTotals)}
    </div>
  `;
}

export function buildPeriodAdditionalMetricsHtml(
  summary,
  enableSuspectRemoval = false,
  showMenuRanking = true,
  showRouletteRanking = true,
  leadingChart = "",
) {
  const groupedTimeLabel = summary.isWeekly ? "por semana" : summary.isMonthly ? "por mês" : "por dia";
  const menuChart = showMenuRanking
    ? buildPopularItemsChart("Op\u00e7\u00f5es mais pedidas do menu", summary.menuOptionRows, {
      accentColor: "#fb7185",
      colorStart: "#fb7185",
      colorEnd: "#e11d48",
    })
    : "";
  const rouletteChart = showRouletteRanking
    ? buildPopularItemsChart("Resultados mais frequentes na roleta", summary.rouletteOutcomeRows, {
      accentColor: "#38bdf8",
      colorStart: "#38bdf8",
      colorEnd: "#4f46e5",
    })
    : "";
  const suspectRows = Array.isArray(summary.suspectRows) ? summary.suspectRows : [];
  const mutedRows = Array.isArray(summary.mutedRows) ? summary.mutedRows : [];
  const safetyCharts = `
    ${buildInteractiveBarsSvg({
      title: `Suspeitas de bots ${groupedTimeLabel}`,
      subtitle: "Usu\u00e1rios distintos registrados em cada intervalo",
      bars: summary.suspectBars || [],
      showCumulative: false,
      variant: "amber",
    })}
    ${buildInteractiveBarsSvg({
      title: `Silenciados ${groupedTimeLabel}`,
      subtitle: "Usu\u00e1rios distintos registrados em cada intervalo",
      bars: summary.mutedBars || [],
      showCumulative: false,
      variant: "rose",
    })}
  `;
  const donors = Array.isArray(summary.donorRows) ? summary.donorRows : [];
  const donorRows = donors.length
    ? `
      <section class="report-card">
        <h2>Principais doadores no per\u00edodo</h2>
        <div class="report-table-wrap">
          <table>
            <thead><tr><th>Usu\u00e1rio</th><th style="text-align:right;">Gorjetas</th><th style="text-align:right;">Dias</th><th style="text-align:right;">Tokens</th></tr></thead>
            <tbody>${donors.slice(0, 20).map((donor) => `
              <tr>
                <td>${clean(donor.name)}</td>
                <td style="text-align:right;">${donor.tips || "—"}</td>
                <td style="text-align:right;">${donor.days}</td>
                <td style="text-align:right;">${Math.round(donor.tokens)} tk</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </section>
    `
    : "";
  const safetyTables = buildSafetyTables({ ...summary, enableSuspectRemoval });
  return `
    ${buildReportChartGroup(
      "Ligas e comunidade",
      "Distribuição de usuários por nível de atividade.",
      "audience",
      [leadingChart],
    )}
    ${buildReportChartGroup(
      "Eventos e rankings",
      "Itens mais frequentes do menu e da roleta.",
      "events",
      [rouletteChart, menuChart],
    )}
    ${buildReportChartGroup(
      "Segurança e moderação",
      "Registros de suspeitas e usuários silenciados.",
      "moderation",
      [safetyCharts],
    )}
    ${donorRows}
    ${safetyTables}
  `;
}

export function buildDailyReportHtml({
  report,
  daily,
  comparisonReport = null,
  comparisonDaily = null,
  timeBars = [],
  comparisonTimeBars = [],
  tokensWithoutTime: suppliedTokensWithoutTime = null,
  timeStepMin = 60,
  audiencePoints = [],
  sessionComparison = null,
  enableSuspectRemoval = false,
}) {
  const audienceStatsAvailable = hasAudienceStats(daily?.audienceStats);
  const audienceConversionAvailable = hasAudienceConversionStats(daily?.audienceStats);
  const comparisonAudienceStatsAvailable = hasAudienceStats(comparisonDaily?.audienceStats);
  const audience = audienceStatsAvailable ? daily.audienceStats : {};
  const newTippers = Number(audience.newTippers) || 0;
  const returningTippers = Number(audience.returningTippers) || 0;
  const newTippersLabel =
    `${newTippers} ${newTippers === 1 ? "novo doador" : "novos doadores"}` +
    (audienceConversionAvailable
      ? ` · conversão ${formatConversionRate(newTippers, audience.newUsers)}`
      : "");
  const returningTippersLabel =
    `${returningTippers} ${returningTippers === 1 ? "doador recorrente" : "doadores recorrentes"}` +
    (audienceConversionAvailable
      ? ` · conversão ${formatConversionRate(returningTippers, audience.returningUsers)}`
      : "");
  const totalAudience = (Number(audience.newUsers) || 0) + (Number(audience.returningUsers) || 0);
  const returnRate = totalAudience > 0
    ? Math.round(((Number(audience.returningUsers) || 0) / totalAudience) * 100)
    : 0;
  const efficiency = report.bruteSeconds > 0
    ? Math.round((report.netSeconds / report.bruteSeconds) * 100)
    : 0;
  const tokensPerHour = report.netSeconds > 0
    ? Math.round((report.totalTokens / report.netSeconds) * 3600)
    : 0;
  const topUsers = Array.isArray(report.donorRows) ? report.donorRows : [];
  const roomKing = daily?.roomKingSnapshot;
  const topUsersRows = topUsers.slice(0, 10).map((user, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${clean(user?.name)}</td>
      <td style="text-align:right;">${Number(user?.tips) || 0}</td>
      <td style="text-align:right;">${Number(user?.tokens) || 0} tk</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-cell">Sem doadores salvos para esta data.</td></tr>`;
  const sessionRows = report.liveSessions.map((session, index) => {
    const tokens = Math.round(Number(session.tokens) || 0);
    const durationSeconds = Number(session.durationSeconds) || 0;
    const tokensPerHour = durationSeconds > 0
      ? Math.round((tokens / durationSeconds) * 3600)
      : 0;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${clean(session.startedAt || "--:--")}</td>
        <td>${clean(session.endedAt || "ativa")}</td>
        <td>${formatReportDuration(durationSeconds)}</td>
        <td>${tokens} tk</td>
        <td>${tokensPerHour} tk/h</td>
        <td>${Number(session.peakViewers) || 0}</td>
        <td>${Number(session.avgViewers) || 0}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="8" class="empty-cell">Nenhuma live registrada.</td></tr>`;
  const bestTimeBar = timeBars
    .filter((bar) => Number(bar.value) > 0)
    .reduce((best, bar) => !best || bar.value > best.value ? bar : best, null);
  const comparisonPace = comparisonReport?.netSeconds > 0
    ? Math.round((comparisonReport.totalTokens / comparisonReport.netSeconds) * 3600)
    : 0;
  const paceSessions = report.liveSessions
    .map((session, index) => {
      const durationSeconds = Number(session.durationSeconds) || 0;
      const tokens = Math.round(Number(session.tokens) || 0);
      return {
        index: index + 1,
        startedAt: session.startedAt || "--:--",
        durationSeconds,
        tokensPerHour: durationSeconds > 0 ? Math.round((tokens / durationSeconds) * 3600) : 0,
      };
    });
  const timedPaceSessions = paceSessions.filter((session) => session.durationSeconds > 0);
  const validPaceSessions = timedPaceSessions.filter((session) => session.tokensPerHour > 0);
  const bestPaceSession = validPaceSessions.reduce(
    (best, session) => !best || session.tokensPerHour > best.tokensPerHour ? session : best,
    null,
  );
  const averageSessionPace = timedPaceSessions.length > 0
    ? timedPaceSessions.reduce((sum, session) => sum + session.tokensPerHour, 0) / timedPaceSessions.length
    : 0;
  const sessionBars = buildInteractiveBarsSvg({
    title: "Tokens por live",
    subtitle: report.liveSessions.length > 1
      ? "Comparação entre sessões do dia"
      : report.liveSessions.length === 1
        ? "Uma live registrada · comparação disponível ao registrar outra"
        : "Nenhuma live registrada neste dia",
    bars: report.liveSessions.map((session, index) => {
      const tokens = Math.round(Number(session.tokens) || 0);
      const durationSeconds = Number(session.durationSeconds) || 0;
      const pace = durationSeconds > 0 ? Math.round((tokens / durationSeconds) * 3600) : 0;
      return {
        label: `Live ${index + 1}`,
        value: tokens,
        tooltip: `Live ${index + 1} · ${session.startedAt || "--:--"}: ${tokens} tk · ${pace} tk/h`,
      };
    }),
    showCumulative: false,
    variant: "rose",
  });
  const sessionDurationBars = report.liveSessions.length > 0
    ? buildInteractiveBarsSvg({
      title: "Duração das lives do dia",
      subtitle: "Tempo líquido registrado por sessão",
      bars: report.liveSessions.map((session, index) => {
        const durationSeconds = Math.max(0, Number(session.durationSeconds) || 0);
        return {
          label: `Live ${index + 1}`,
          value: Math.round(durationSeconds / 60),
          displayValue: formatReportDuration(durationSeconds),
          tooltip: `Live ${index + 1} · início ${session.startedAt || "--:--"} · duração ${formatReportDuration(durationSeconds)}`,
        };
      }),
      showCumulative: false,
      variant: "violet",
      unitLabel: "min",
    })
    : "";
  const largestTip = report.largestTip || report.topTipRows?.[0] || null;
  const largestTipCard = largestTip
    ? `<section class="report-card report-card--tip"><h2>Maior gorjeta do dia</h2><p><strong>${clean(largestTip.username)}</strong> · ${Math.round(Number(largestTip.tokens) || 0)} tk · ${clean(largestTip.type || "Outros")}</p>${largestTip.item ? `<small>${clean(largestTip.item)}</small>` : ""}</section>`
    : `<section class="report-card report-card--tip"><h2>Maior gorjeta do dia</h2><p>Não há gorjetas individuais salvas para esta data.</p></section>`;
  const totalDayTokens = Math.max(0, Number(report.totalTokens) || 0);
  const timeBucketTokens = timeBars.reduce(
    (sum, bar) => sum + Math.max(0, Number(bar.value) || 0),
    0,
  );
  const computedTokensWithoutTime = Math.max(0, totalDayTokens - timeBucketTokens);
  const tokensWithoutTime = suppliedTokensWithoutTime === null
    ? computedTokensWithoutTime
    : Math.max(0, Number(suppliedTokensWithoutTime) || 0);
  const dayGainTypes = buildGainTypeRows(daily?.eventSummaryTotals);
  const dayClassifiedTokens = dayGainTypes.reduce((sum, row) => sum + row.value, 0);
  const leadingDayGainType = dayGainTypes[0];
  const largestTipTokens = Math.max(0, Number(largestTip?.tokens) || 0);
  const dailyInsights = buildReportInsights("Insights do dia", [
    bestTimeBar && totalDayTokens > 0 && bestTimeBar.value <= totalDayTokens
      ? `${formatTimeBucketRange(bestTimeBar.label, timeStepMin)} foi o melhor intervalo, concentrando ${Math.round((bestTimeBar.value / totalDayTokens) * 100)}% dos tokens do dia.`
      : "",
    tokensWithoutTime > 0
      ? `${Math.round(tokensWithoutTime)} tk do total diário não têm horário registrado e não aparecem no gráfico por intervalo.`
      : "",
    leadingDayGainType && dayClassifiedTokens > 0
      ? `${leadingDayGainType.label} foi a principal fonte entre os ganhos classificados (${Math.round((leadingDayGainType.value / dayClassifiedTokens) * 100)}% do total categorizado).`
      : "",
    largestTip && largestTipTokens > 0 && totalDayTokens > 0 && largestTipTokens <= totalDayTokens
      ? `A maior gorjeta representou ${Math.round((largestTipTokens / totalDayTokens) * 100)}% dos tokens do dia.`
      : "",
    bestPaceSession && timedPaceSessions.length > 1
      ? (() => {
        const difference = getPercentDifference(bestPaceSession.tokensPerHour, averageSessionPace);
        return difference === null
          ? ""
          : `A live ${bestPaceSession.index} teve ritmo ${Math.abs(difference)}% ${difference >= 0 ? "acima" : "abaixo"} da média das lives com duração registrada.`;
      })()
      : "",
  ]);

  const comparisonMetrics = comparisonReport
    ? [
      { label: "Ganhos em tokens", current: report.totalTokens, previous: comparisonReport.totalTokens, unit: "tk" },
      { label: "Ritmo de ganhos", current: tokensPerHour, previous: comparisonPace, unit: "tk/h" },
    ]
    : [];
  if (
    comparisonReport &&
    Number(report.avgViewers) > 0 &&
    Number(comparisonReport.avgViewers) > 0
  ) {
    comparisonMetrics.push({
      label: "Média de espectadores",
      current: report.avgViewers,
      previous: comparisonReport.avgViewers,
      unit: "espectadores",
    });
  }
  if (
    comparisonReport &&
    Number(report.peakViewers) > 0 &&
    Number(comparisonReport.peakViewers) > 0
  ) {
    comparisonMetrics.push({
      label: "Pico de espectadores",
      current: report.peakViewers,
      previous: comparisonReport.peakViewers,
      unit: "espectadores",
    });
  }
  const previousBestTimeBar = bestTimeBar
    ? comparisonTimeBars.find((bar) => bar.label === bestTimeBar.label)
    : null;
  if (bestTimeBar && previousBestTimeBar) {
    comparisonMetrics.push({
      label: `Ganhos no melhor intervalo (${bestTimeBar.label})`,
      current: Number(bestTimeBar.value) || 0,
      previous: Number(previousBestTimeBar.value) || 0,
      unit: "tk",
    });
  }
  if (comparisonAudienceStatsAvailable && audienceStatsAvailable) {
    [
      ["newUsers", "Novos usuários"],
      ["returningUsers", "Usuários recorrentes"],
    ].forEach(([key, label]) => {
      const current = audience[key];
      const previous = comparisonDaily.audienceStats[key];
      if (current === undefined || current === null || previous === undefined || previous === null) return;
      comparisonMetrics.push({
        label,
        current,
        previous,
        unit: "usuários",
      });
    });
  }
  const comparisonInsights = comparisonReport
    ? buildComparisonInsights(
      comparisonMetrics,
      `Insights · ${report.dateBr} vs. ${comparisonReport.dateBr}`,
    )
    : "";
  const comparisonRows = comparisonReport
    ? `
      <section class="report-card">
        <h2>Comparação com ${clean(comparisonReport.dateBr)}</h2>
        <div class="report-table-wrap">
          <table>
            <thead><tr><th>Métrica</th><th>${clean(report.dateBr)}</th><th>${clean(comparisonReport.dateBr)}</th><th>Diferença</th></tr></thead>
            <tbody>
              ${[
                ["Tokens", report.totalTokens, comparisonReport.totalTokens, " tk"],
                ["Pico de espectadores", report.peakViewers, comparisonReport.peakViewers, ""],
                ["Média de espectadores", report.avgViewers, comparisonReport.avgViewers, ""],
                [
                  "Novos usuários",
                  audienceStatsAvailable ? audience.newUsers : null,
                  comparisonAudienceStatsAvailable
                    ? comparisonDaily.audienceStats.newUsers
                    : null,
                  "",
                ],
                [
                  "Usuários recorrentes",
                  audienceStatsAvailable ? audience.returningUsers : null,
                  comparisonAudienceStatsAvailable
                    ? comparisonDaily.audienceStats.returningUsers
                    : null,
                  "",
                ],
              ].map(([label, current, previous, suffix]) => {
                const currentValue = getOptionalReportNumber(current);
                const previousValue = getOptionalReportNumber(previous);
                const difference = currentValue !== null && previousValue !== null
                  ? currentValue - previousValue
                  : null;
                const currentText = currentValue === null ? "—" : `${currentValue}${suffix}`;
                const previousText = previousValue === null ? "—" : `${previousValue}${suffix}`;
                const differenceText = difference === null
                  ? "—"
                  : `${difference > 0 ? "+" : ""}${difference}${suffix}`;
                return `<tr><td>${label}</td><td>${currentText}</td><td>${previousText}</td><td>${differenceText}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `
    : "";
  const dailyEventMarkers = [];
  const capturedEvents = Array.isArray(daily?.capturedEvents)
    ? daily.capturedEvents
    : daily?.capturedEvents && typeof daily.capturedEvents === "object"
      ? Object.values(daily.capturedEvents)
      : [];
  capturedEvents.forEach((event) => {
    const combined = `${String(event?.type || "")} ${String(event?.item || "")}`
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (/menu de gorjetas|menu|gorjeta avulsa|roleta|battleship|objetivo epico|compra de conteudo/.test(combined)) return;
    const showType = /show em grupo/.test(combined)
      ? "group"
      : /show privado/.test(combined)
        ? "private"
        : /show exclusivo/.test(combined)
          ? "exclusive"
          : /ticket show|show (?:por|de) (?:tickets?|ingressos?|bilhetes?|entradas?)/.test(combined)
            ? "ticket"
            : "";
    if (!showType) return;
    const showBoundary = event?.showBoundary === "end"
      ? "end"
      : event?.showBoundary === "start" || /\binicio\b/.test(combined)
        ? "start"
        : "";
    if (!showBoundary && /\b1 min\b/.test(combined)) return;
    const timestamp = Number(event?.timestamp ?? event?.time) || 0;
    if (timestamp <= 0) return;
    const label = new Date(timestamp).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    dailyEventMarkers.push({
      label,
      timestamp,
      showType,
      showBoundary,
      type: showBoundary === "end"
        ? "Fim do show"
        : showBoundary === "start"
          ? "Início do show"
          : "Show",
      tooltip: showType === "ticket"
        ? `${showBoundary === "end" ? "Fim" : "Início"} do Ticket show`
        : showBoundary === "end"
          ? `Fim do show: ${String(event?.item || event?.type || "Show").trim()}`
          : showBoundary === "start"
            ? `Início do show: ${String(event?.item || event?.type || "Show").trim()}`
            : `Show: ${String(event?.item || event?.type || "Show").trim()}`,
    });
  });
  const dailyHero = buildReportHero({
    name: report.modelName || "Modelo",
    eyebrow: "Resumo diário",
    subtitle: report.dateBr,
    badges: [
      { label: `${report.liveSessions.length} ${report.liveSessions.length === 1 ? "live" : "lives"}`, className: "report-hero-badge--status" },
      { label: `${Math.round(Number(report.totalTokens) || 0)} tk`, className: "report-hero-badge--tokens" },
      { label: `${topUsers.length} doadores`, className: "report-hero-badge--pace" },
    ],
  });

  return `
    ${dailyHero}
    ${buildSummaryStrip([
      { label: "Tokens", value: `${Math.round(Number(report.totalTokens) || 0)} tk`, tone: "cyan", icon: "tokens" },
      { label: "Horas", value: formatReportDuration(report.netSeconds), note: `bruto ${formatReportDuration(report.bruteSeconds)}`, tone: "purple", icon: "duration" },
      { label: "Tokens/hora", value: `${tokensPerHour} tk/h`, tone: "orange", icon: "pace" },
      { label: "Doadores", value: String(topUsers.length), note: "usuários únicos", tone: "pink", icon: "audience" },
      { label: "Gorjetas", value: String(Math.round(Number(report.totalTips) || 0)), note: "registradas", tone: "amber", icon: "tips" },
      { label: "Mensagens", value: String(Math.round(Number(report.totalMessages) || 0)), tone: "blue", icon: "messages" },
    ])}
    <div class="combined-report-chart">
      ${buildCombinedAudienceEarningsChart({
        title: "Público e ganhos no dia · Ganhos por intervalo",
        subtitle: `${report.dateBr} · Blocos de ${timeStepMin === 60 ? "1h" : `${timeStepMin} minutos`}`,
        audiencePoints: audiencePoints.map((point) => ({
          label: point.label,
          value: point.viewers,
          tooltip: point.tooltip,
        })),
        earningsBars: timeBars,
        eventMarkers: dailyEventMarkers,
      })}
    </div>
    ${buildReportFlowCharts(timeBars, timeStepMin, report.dateBr)}
    <div class="metric-grid">
      <div class="metric-card metric-card--audience"><small>Pico / média de espectadores</small><strong>${report.peakViewers} / ${report.avgViewers}</strong></div>
      <div class="metric-card metric-card--highlight"><small>Melhor intervalo</small><strong>${bestTimeBar ? `${clean(bestTimeBar.label)} · ${Math.round(bestTimeBar.value)} tk` : "—"}</strong></div>
      <div class="metric-card metric-card--new"><small>Novos usuários</small><strong>${audienceStatsAvailable ? Number(audience.newUsers) || 0 : "—"}</strong><small class="metric-note">${audienceStatsAvailable ? newTippersLabel : "Sem dados de público"}</small></div>
      <div class="metric-card metric-card--returning"><small>Usuários recorrentes</small><strong>${audienceStatsAvailable ? Number(audience.returningUsers) || 0 : "—"}</strong><small class="metric-note">${audienceStatsAvailable ? returningTippersLabel : "Sem dados de público"}</small></div>
      ${bestPaceSession ? `<div class="metric-card metric-card--pace"><small>Live com melhor ritmo</small><strong>Live ${bestPaceSession.index} · ${bestPaceSession.tokensPerHour} tk/h</strong><small class="metric-note">Início ${clean(bestPaceSession.startedAt)}</small></div>` : ""}
    </div>

    ${comparisonRows}
    ${dailyInsights}
    ${comparisonInsights}

    ${buildSessionComparisonTable(
      sessionComparison?.sessionA,
      sessionComparison?.sessionB,
      report.dateBr,
      timeStepMin,
    )}

    <div class="daily-highlight-grid">
      ${largestTipCard}

      <section class="report-card report-card--king">
        <h2>Rei da sala neste dia</h2>
        ${
          roomKing?.name
            ? (() => {
                const chatTokens = Math.max(0, Number(roomKing.chatTokens) || 0);
                const storedTokens = Math.max(0, Number(roomKing.tokens) || 0);
                const effectiveTokens = storedTokens > 0 ? storedTokens : chatTokens;
                const effectiveSource = storedTokens > 0
                  ? roomKing.valueSource
                  : chatTokens > 0
                    ? "chat"
                    : roomKing.valueSource;
                if (effectiveTokens <= 0) {
                  return `<p><strong>${clean(roomKing.name)}</strong></p>
                    <small>Sem valor capturado no site nem no chat.</small>`;
                }
                return `<p><strong>${clean(roomKing.name)}</strong> · ${effectiveTokens} tk</p>
                  <small>${clean(getRoomKingSourceLabel(effectiveSource))}${
                    effectiveSource !== "chat" && chatTokens > 0
                      ? ` · Chat capturado: ${chatTokens} tk`
                      : ""
                  }</small>`;
              })()
            : `<p>Sem registro de rei para este dia. O histórico começa a ser coletado a partir desta versão.</p>`
        }
      </section>
    </div>

    ${buildReportChartGroup(
      "Público e usuários",
      "Retenção, pico e média de usuários registrados no dia.",
      "audience",
      [
        audienceStatsAvailable
          ? buildNeonDonutGauge({
            label: "Retenção de público",
            sublabel: `${Number(audience.returningUsers) || 0} recorrentes`,
            percent: returnRate,
            colorStart: "#ff2a6d",
            colorEnd: "#8a2be2",
          })
          : "",
        buildReportUsersChart(report.uPeak, report.uAvg, report.dateBr),
      ],
    )}
    ${buildReportChartGroup(
      "Ganhos por categoria",
      "Composição dos ganhos classificados no dia.",
      "gains",
      [buildGainTypeChart(daily?.eventSummaryTotals)],
    )}
    ${buildReportChartGroup(
      "Desempenho das lives",
      "Duração, ganhos e aproveitamento do tempo ao vivo.",
      "lives",
      [
        buildNeonDonutGauge({
          label: "Aproveitamento da live",
          sublabel: "Tempo líquido vs. bruto",
          percent: efficiency,
          colorStart: "#00e5ff",
          colorEnd: "#2563eb",
        }),
        sessionDurationBars,
        sessionBars,
      ],
    )}

    ${buildDailyAdditionalMetricsHtml(report, daily, false, enableSuspectRemoval, {
      menu: true,
      roulette: true,
      tips: true,
    }, buildReportLeaguesChart(report.lPeak, report.lAvg, report.dateBr))}

    <section class="report-card">
      <h2>Lives registradas</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>#</th><th>Início</th><th>Fim</th><th>Duração</th><th>Tokens</th><th>Ritmo</th><th>Pico</th><th>Média viewers</th></tr></thead>
          <tbody>${sessionRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-card">
      <h2>Top doadores</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>#</th><th>Usuário</th><th>Gorjetas</th><th>Tokens</th></tr></thead>
          <tbody>${topUsersRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function buildHeatmapHtml(heatmap = []) {
  if (!Array.isArray(heatmap) || heatmap.length === 0) return "";
  const maxTokens = Math.max(1, ...heatmap.flatMap((row) =>
    row.cells.map((cell) => Number(cell.tokens) || 0),
  ));
  const header = Array.from({ length: 24 }, (_, hour) =>
    `<span>${String(hour).padStart(2, "0")}h</span>`,
  ).join("");
  const rows = heatmap.map((row) => {
    const cells = row.cells.map((cell) => {
      const value = Number(cell.tokens) || 0;
      const level = value <= 0 ? 0 : Math.max(1, Math.ceil((value / maxTokens) * 4));
      const label = `${row.name} ${String(row.cells.indexOf(cell)).padStart(2, "0")}h: ${value} tk, ${cell.events || 0} evento(s), média ${cell.avgViewers || 0} espectadores`;
      return `<span class="activity-heatmap-cell heat-level-${level}" title="${clean(label)}" aria-label="${clean(label)}"></span>`;
    }).join("");
    return `<div class="activity-heatmap-row"><strong>${clean(row.name.slice(0, 3))}</strong><div class="activity-heatmap-cells">${cells}</div></div>`;
  }).join("");
  return `
    <section class="report-card activity-heatmap-card">
      <h2>Mapa de calor por dia e horário</h2>
      <p class="section-note">Intensidade pela soma de tokens por hora. Passe o mouse sobre uma célula para ver tokens, eventos e público médio.</p>
      <div class="activity-heatmap-scroll">
        <div class="activity-heatmap-header"><span></span><div>${header}</div></div>
        ${rows}
      </div>
    </section>
  `;
}

function buildActivityTimelineHtml(timeline = []) {
  if (!Array.isArray(timeline) || timeline.length === 0) return "";
  const maxEvents = Math.max(1, ...timeline.map((bucket) => Number(bucket.events) || 0));
  const maxModeration = Math.max(1, ...timeline.map((bucket) => Number(bucket.moderation) || 0));
  const bars = timeline.map((bucket, hour) => {
    const eventHeight = Math.round(((Number(bucket.events) || 0) / maxEvents) * 100);
    const moderationHeight = Math.round(((Number(bucket.moderation) || 0) / maxModeration) * 100);
    const label = `${String(hour).padStart(2, "0")}h: ${bucket.events || 0} evento(s), ${bucket.moderation || 0} moderação(ões)`;
    return `
      <div class="activity-timeline-hour" title="${clean(label)}" aria-label="${clean(label)}">
        <div class="activity-timeline-bars">
          <span class="activity-timeline-event" style="height:${eventHeight}%"></span>
          <span class="activity-timeline-moderation" style="height:${moderationHeight}%"></span>
        </div>
        <small>${String(hour).padStart(2, "0")}h</small>
      </div>
    `;
  }).join("");
  return `
    <section class="report-card activity-timeline-card">
      <h2>Atividade e moderação por horário</h2>
      <div class="activity-timeline-legend">
        <span><i class="activity-timeline-key-event"></i>Eventos</span>
        <span><i class="activity-timeline-key-moderation"></i>Moderação</span>
      </div>
      <div class="activity-timeline">${bars}</div>
    </section>
  `;
}

function buildEngagementTableHtml(summary) {
  const rows = Array.isArray(summary.engagementRows) ? summary.engagementRows : [];
  if (rows.length === 0) return "";
  const start = String(summary.start || "");
  const body = rows.slice(0, 20).map((row, index) => {
    const isNew = start && row.firstSeenDate >= start;
    const visitCount = Math.max(1, Number(row.visitCount) || 1);
    const minutes = Math.floor(Math.max(0, Number(row.totalTimeSpent) || 0) / 60);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${clean(row.name)}</td>
        <td><span class="engagement-kind ${isNew ? "engagement-kind--new" : "engagement-kind--returning"}">${isNew ? "Novo" : "Recorrente"}</span></td>
        <td style="text-align:right;">${Number(row.tokens) || 0} tk</td>
        <td style="text-align:right;">${Number(row.messages) || 0}</td>
        <td style="text-align:right;">${minutes} min</td>
        <td style="text-align:right;">${visitCount}x</td>
      </tr>
    `;
  }).join("");
  return `
    <section class="report-card">
      <h2>Engajamento por usuário</h2>
      <p class="section-note">Ranking combinado por tokens, mensagens e tempo acumulado no período. Tempo e visitas são os maiores valores conhecidos no snapshot diário.</p>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>#</th><th>Usuário</th><th>Perfil</th><th style="text-align:right;">Tokens</th><th style="text-align:right;">Mensagens</th><th style="text-align:right;">Tempo</th><th style="text-align:right;">Visitas</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function buildAudienceEfficiencyHtml(summary) {
  const efficiency = summary.audienceEfficiency || {};
  return `
    <section class="report-card">
      <h2>Eficiência da audiência</h2>
      <div class="metric-grid metric-grid--compact">
        <div class="metric-card"><small>Tokens por espectador médio</small><strong>${Number(efficiency.tokensPerAverageViewer) || 0} tk</strong></div>
        <div class="metric-card"><small>Tokens por hora líquida</small><strong>${Number(efficiency.tokensPerNetHour) || 0} tk/h</strong></div>
        <div class="metric-card"><small>Público médio no período</small><strong>${Number(efficiency.averageViewers) || 0}</strong></div>
      </div>
      <p class="section-note">Tokens por espectador médio = tokens do período dividido pela média ponderada de espectadores. A relação é indicativa, não receita líquida.</p>
    </section>
  `;
}

function buildAudienceConversionHtml(conversion) {
  if (!conversion || Number(conversion.days) <= 0) return "";
  const newUsers = Math.max(0, Number(conversion.newUsers) || 0);
  const newTippers = Math.max(0, Number(conversion.newTippers) || 0);
  const returningUsers = Math.max(0, Number(conversion.returningUsers) || 0);
  const returningTippers = Math.max(0, Number(conversion.returningTippers) || 0);

  return `
    <section class="report-card">
      <h2>Conversão em doadores</h2>
      <div class="metric-grid metric-grid--compact">
        <div class="metric-card">
          <small>Novos usuários</small>
          <strong>${formatConversionRate(newTippers, newUsers)}</strong>
          <small class="metric-note">${newTippers} de ${newUsers} doaram</small>
        </div>
        <div class="metric-card">
          <small>Presenças recorrentes por dia</small>
          <strong>${formatConversionRate(returningTippers, returningUsers)}</strong>
          <small class="metric-note">${returningTippers} de ${returningUsers} presenças doaram</small>
        </div>
      </div>
      <p class="section-note">
        Calculado com dados completos de ${Number(conversion.days)} dia(s).
        Novos usuários são únicos no período e descontam recorrências; nos dias sem lista completa,
        é usado o total registrado pelo relatório diário.
      </p>
    </section>
  `;
}

function buildLeagueEngagementHtml(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return `
    <section class="report-card">
      <h2>Engajamento por liga</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Liga</th><th style="text-align:right;">Usuários</th><th style="text-align:right;">Tokens</th><th style="text-align:right;">Tk/usuário</th><th style="text-align:right;">Mensagens</th><th style="text-align:right;">Min/usuário</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td>${clean(row.label)}</td>
              <td style="text-align:right;">${Number(row.users) || 0}</td>
              <td style="text-align:right;">${Number(row.tokens) || 0} tk</td>
              <td style="text-align:right;">${Number(row.tokensPerUser) || 0}</td>
              <td style="text-align:right;">${Number(row.messages) || 0}</td>
              <td style="text-align:right;">${Number(row.minutesPerUser) || 0}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function buildGoalShowTimelineHtml(summary) {
  const goals = Array.isArray(summary.goalTimeline) ? summary.goalTimeline : [];
  if (goals.length === 0) return "";
  const modelId = clean(summary.modelId || "");
  const goalRows = goals.slice(0, 30).map((goal, index) => {
    const time = goal.timestamp
      ? new Date(goal.timestamp).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "--:--";
    const sourceIndex = Number.isInteger(goal.sourceIndex) ? goal.sourceIndex : index;
    return `<tr><td>${clean(goal.dateKey)} ${clean(time)}</td><td>Meta</td><td>${clean(goal.description)}</td><td>${clean(goal.status)}</td><td style="text-align:right;">${Number(goal.amount) || 0} tk</td><td><button type="button" class="report-delete-timeline" data-model-id="${modelId}" data-entry-date="${clean(goal.dateKey)}" data-entry-kind="goal" data-entry-index="${sourceIndex}" data-entry-description="${clean(goal.description)}" data-entry-status="${clean(goal.status)}" data-entry-amount="${Number(goal.amount) || 0}" data-entry-timestamp="${Number(goal.timestamp) || 0}" aria-label="Apagar meta: ${clean(goal.description)}">Apagar</button></td></tr>`;
  }).join("");
  return `
    <section class="report-card">
      <h2>Linha do tempo de metas</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Data/hora</th><th>Tipo</th><th>Descrição</th><th>Status</th><th style="text-align:right;">Valor</th><th>Ação</th></tr></thead>
          <tbody>${goalRows}</tbody>
        </table>
      </div>
      <p class="timeline-delete-status" role="status" aria-live="polite"></p>
    </section>
  `;
}

export function buildPeriodReportHtml(
  summary,
  { enableSuspectRemoval = false, comparisonSummary = null } = {},
) {
  const audienceInterval = summary.isWeekly ? "por semana" : summary.isMonthly ? "por mês" : "por dia";
  const audienceCharts = summary.audienceDays > 0
    ? `
      ${buildInteractiveBarsSvg({
        title: `Novos usuários ${audienceInterval}`,
        subtitle: `${summary.audienceDays} dia(s) com dados`,
        bars: summary.newUserBars,
        showCumulative: false,
        variant: "mint",
      })}
      ${buildInteractiveBarsSvg({
        title: `Usuários recorrentes ${audienceInterval}`,
        subtitle: `${summary.audienceDays} dia(s) com dados`,
        bars: summary.returningUserBars,
        showCumulative: false,
        variant: "violet",
      })}
    `
    : "";
  const tipperCharts = summary.audienceDays > 0
    ? `
      ${buildInteractiveBarsSvg({
        title: `Novos doadores ${audienceInterval}`,
        subtitle: "Contagem diária; a mesma pessoa pode aparecer em dias diferentes",
        bars: summary.newTipperBars || [],
        showCumulative: false,
        variant: "amber",
      })}
      ${buildInteractiveBarsSvg({
        title: `Doadores recorrentes ${audienceInterval}`,
        subtitle: "Contagem diária; a mesma pessoa pode aparecer em dias diferentes",
        bars: summary.returningTipperBars || [],
        showCumulative: false,
        variant: "rose",
      })}
    `
    : "";
  const weekdayStatsByName = new Map(
    (Array.isArray(summary.weekdayStats) ? summary.weekdayStats : [])
      .map((day) => [day.name, day]),
  );
  const hasWeekdayRecords = [...weekdayStatsByName.values()].some((day) => day.days > 0);
  const weekdayTokenBars = hasWeekdayRecords
    ? WEEKDAY_NAMES.map((name) => {
      const day = weekdayStatsByName.get(name);
      const days = day?.days || 0;
      const average = days > 0 ? Math.round(day.tokens / days) : 0;
      return {
        label: name,
        value: average,
        tooltip: days > 0
          ? `${name}: média de ${average} tk/dia em ${days} dia(s)`
          : `${name}: sem registros no período`,
      };
    })
    : [];
  const weekdayTokenChart = weekdayTokenBars.length > 0
    ? buildInteractiveBarsSvg({
      title: "Média de tokens por dia da semana",
      subtitle: "Domingo a sábado · vazios = sem registro",
      bars: weekdayTokenBars,
      showCumulative: false,
      variant: "sunset",
    })
    : "";
  const weekdayPaceChart = (summary.weekdayPaceBars || []).length > 1
    ? buildInteractiveBarsSvg({
      title: "Ritmo médio por dia da semana",
      subtitle: "Tokens por hora líquida acumulada",
      bars: summary.weekdayPaceBars,
      showCumulative: false,
      unitLabel: " tk/h",
      variant: "mint",
    })
    : "";
  const dailyAudienceBars = Array.isArray(summary.dailyAudienceBars)
    ? summary.dailyAudienceBars
    : [];
  const dailyAudienceComparisonChart = dailyAudienceBars.length > 0
    ? buildCombinedAudienceEarningsChart({
      title: "Pico e média de espectadores por dia",
      subtitle: "Linha: média • barras: pico diário",
      audiencePoints: dailyAudienceBars.map((bar) => ({
        label: bar.label,
        value: bar.avgViewers,
        tooltip: bar.tooltip,
      })),
      earningsBars: dailyAudienceBars.map((bar) => ({
        label: bar.label,
        value: bar.peakViewers,
        tooltip: `${bar.label}: pico de ${bar.peakViewers} espectadores`,
      })),
    })
    : "";
  const dailyPeakAudienceChart = dailyAudienceBars.length > 0
    ? buildInteractiveBarsSvg({
      title: "Picos de espectadores por dia",
      subtitle: `${dailyAudienceBars.length} dia(s) com dados`,
      bars: dailyAudienceBars.map((bar) => ({
        label: bar.label,
        value: bar.peakViewers,
        tooltip: `${bar.label}: pico de ${bar.peakViewers} espectadores`,
      })),
      showCumulative: false,
      unitLabel: " espectadores",
      variant: "rose",
    })
    : "";
  const dailyPaceChart = (summary.dailyPaceBars || []).length > 0
    ? buildInteractiveBarsSvg({
      title: "Ritmo de ganhos por dia",
      subtitle: "Tk/h normalizados pelo tempo líquido",
      bars: summary.dailyPaceBars,
      showCumulative: false,
      unitLabel: " tk/h",
      variant: "sunset",
    })
    : "";
  const hourlyPaceChart = (summary.hourlyPaceBars || []).length > 0
    ? buildInteractiveBarsSvg({
      title: "Ritmo de ganhos por horário",
      subtitle: "Média de tk/h por hora ativa",
      bars: buildHourlyAxisBars(summary.hourlyPaceBars),
      showCumulative: false,
      unitLabel: " tk/h",
      variant: "default",
      showAllLabels: true,
    })
    : "";
  const activeDaysForHourlyAverage = Math.max(0, Number(summary.activeDays) || 0);
  const hourlyTokenBars = Array.isArray(summary.hourlyBars) ? summary.hourlyBars : [];
  const hourlyAverageBars = activeDaysForHourlyAverage > 0
    ? hourlyTokenBars.map((hour) => {
      const tokens = Math.max(0, Number(hour.value) || 0);
      const average = Math.round(tokens / activeDaysForHourlyAverage);
      return {
        label: hour.label,
        value: average,
        tooltip: `${hour.label}: média de ${average} tk por dia ativo (${tokens} tk em ${activeDaysForHourlyAverage} dias)`,
      };
    })
    : [];
  const hourlyAverageChart = hourlyAverageBars.some((bar) => bar.value > 0)
    ? buildInteractiveBarsSvg({
      title: "Média de tokens por horário",
      subtitle: `Média por dia ativo · ${activeDaysForHourlyAverage} dias`,
      bars: hourlyAverageBars,
      showCumulative: false,
      unitLabel: " tk/dia",
      variant: "mint",
      showAllLabels: true,
    })
    : "";
  const weekdayRows = summary.weekdayStats.map((day) => `
    <tr>
      <td>${clean(day.name)}</td>
      <td style="text-align:right;">${day.days > 0 ? `${Math.round(day.tokens / day.days)} tk` : "—"}</td>
      <td style="text-align:right;">${day.viewerSamples > 0 ? Math.round(day.viewerSum / day.viewerSamples) : "—"}</td>
      <td style="text-align:right;">${day.days > 0 ? day.peakViewers : "—"}</td>
      <td style="text-align:right;">${day.days}</td>
    </tr>
  `).join("");
  const kingRows = (summary.roomKingRows || []).map((king) => `
    <tr>
      <td>${clean(king.dateBr)}</td>
      <td>${clean(king.name)}</td>
      <td style="text-align:right;">${Math.round(Number(king.tokens) || 0) > 0 ? `${Math.round(Number(king.tokens) || 0)} tk` : "Sem valor"}</td>
      <td>${clean(getRoomKingSourceLabel(king.valueSource))}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-cell">Sem registros de rei neste período.</td></tr>`;
  const bestTip = summary.bestTip;
  const largestTipChart = summary.largestTipBars?.length
    ? buildInteractiveBarsSvg({
      title: `Maior gorjeta ${summary.isWeekly ? "por semana" : summary.isMonthly ? "por mês" : "por dia"}`,
      subtitle: "Valor máximo registrado em cada intervalo",
      bars: summary.largestTipBars,
      showCumulative: false,
      variant: "amber",
    })
    : "";
  const audienceHourChart = summary.audienceHourBars?.length
    ? buildInteractiveBarsSvg({
      title: "Média de espectadores por horário",
      subtitle: "Média ponderada pelas amostras do período",
      bars: buildHourlyAxisBars(summary.audienceHourBars),
      showCumulative: false,
      variant: "default",
      showAllLabels: true,
    })
    : "";
  const listedUsersHourChart = summary.listedUsersHourBars?.length
    ? buildInteractiveBarsSvg({
      title: "Média de usuários listados por horário",
      subtitle: "Média ponderada pelas amostras do período",
      bars: buildHourlyAxisBars(summary.listedUsersHourBars),
      showCumulative: false,
      variant: "mint",
      showAllLabels: true,
    })
    : "";
  const tokensUsersHourChart = summary.tokensUsersHourBars?.length
    ? buildInteractiveBarsSvg({
      title: "Média de usuários com tokens por horário",
      subtitle: "Média ponderada pelas amostras do período",
      bars: buildHourlyAxisBars(summary.tokensUsersHourBars),
      showCumulative: false,
      unitLabel: " usuários",
      variant: "rose",
      showAllLabels: true,
    })
    : "";
  const tokensUsersDayChart = summary.tokensUsersDayBars?.length
    ? buildInteractiveBarsSvg({
      title: "Média de usuários com tokens por dia",
      subtitle: "Média das amostras registradas em cada data",
      bars: summary.tokensUsersDayBars,
      showCumulative: false,
      unitLabel: " usuários",
      variant: "violet",
    })
    : "";
  const tokensUsersWeekdayChart = summary.tokensUsersWeekdayBars?.length
    ? buildInteractiveBarsSvg({
      title: "Média de usuários com tokens por dia da semana",
      subtitle: "Domingo a sábado · vazios = sem registro",
      bars: summary.tokensUsersWeekdayBars,
      showCumulative: false,
      unitLabel: " usuários",
      variant: "rose",
      showAllLabels: true,
    })
    : "";
  const tokensUsersPeakHourChart = summary.tokensUsersPeakHourBars?.length
    ? buildInteractiveBarsSvg({
      title: "Pico de usuários com tokens por horário",
      subtitle: "Maior contagem registrada em cada hora",
      bars: buildHourlyAxisBars(summary.tokensUsersPeakHourBars),
      showCumulative: false,
      unitLabel: " usuários",
      variant: "amber",
      showAllLabels: true,
    })
    : "";
  const liveSessionRows = Array.isArray(summary.liveSessionRows)
    ? summary.liveSessionRows
    : [];
  const liveSessionCount = liveSessionRows.length;
  const topTokenLives = [...liveSessionRows]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 20);
  const topPaceLives = liveSessionRows
    .filter((session) => session.durationSeconds > 0 && session.tokensPerHour > 0)
    .sort((a, b) => b.tokensPerHour - a.tokensPerHour)
    .slice(0, 20);
  const liveTokenChart = liveSessionCount > 1
    ? buildInteractiveBarsSvg({
      title: "Tokens por live no período",
      subtitle: `Top ${topTokenLives.length} de ${liveSessionCount} lives · maiores totais`,
      bars: topTokenLives.map((session) => ({
        label: session.startedAt,
        value: session.tokens,
        tooltip: session.tooltip,
      })),
      showCumulative: false,
      variant: "rose",
    })
    : "";
  const livePaceChart = topPaceLives.length > 1
    ? buildReportHorizontalChart({
      title: "Ritmo de ganhos por live",
      subtitle: `Top ${topPaceLives.length} · tk/h normalizados pela duração`,
      accentColor: "#38bdf8",
      unit: " tk/h",
      rows: topPaceLives.map((session, index) => ({
        label: session.label,
        value: session.tokensPerHour,
        color: index === 0 ? "#38bdf8" : "#818cf8",
        tooltip: `${session.tooltip} · duração ${formatReportDuration(session.durationSeconds)}`,
      })),
    })
    : "";
  const bruteDurationDayChart = buildInteractiveBarsSvg({
    title: summary.isWeekly
      ? "Tempo bruto de live por semana"
      : summary.isMonthly
        ? "Tempo bruto de live por mês"
        : "Tempo bruto de live por dia",
    subtitle: `${summary.bruteDurationDayBars?.length || 0} intervalo(s)`,
    bars: (summary.bruteDurationDayBars || []).map((bar) => ({
      ...bar,
      displayValue: formatReportDuration(Math.round(Number(bar.value) || 0) * 60),
    })),
    showCumulative: false,
    unitLabel: "min",
    variant: "amber",
  });
  const durationDayChart = buildInteractiveBarsSvg({
    title: summary.isWeekly
      ? "Tempo líquido de live por semana"
      : summary.isMonthly
        ? "Tempo líquido de live por mês"
        : "Tempo líquido de live por dia",
    subtitle: `${summary.durationDayBars?.length || 0} intervalo(s)`,
    bars: (summary.durationDayBars || []).map((bar) => ({
      ...bar,
      displayValue: formatReportDuration(Math.round(Number(bar.value) || 0) * 60),
    })),
    showCumulative: false,
    unitLabel: "min",
    variant: "violet",
  });
  const liveDurationChart = liveSessionCount > 1
    ? buildInteractiveBarsSvg({
      title: "Duração por live no período",
      subtitle: `Top ${Math.min(20, liveSessionCount)} lives por duração registrada`,
      bars: [...liveSessionRows]
        .sort((a, b) => b.durationSeconds - a.durationSeconds)
        .slice(0, 20)
        .map((session) => ({
          label: session.startedAt,
          value: Math.round(session.durationSeconds / 60),
          displayValue: formatReportDuration(session.durationSeconds),
          tooltip: `${session.tooltip} · duração ${formatReportDuration(session.durationSeconds)}`,
        })),
      showCumulative: false,
      unitLabel: "min",
      variant: "amber",
    })
    : "";
  const periodComparisonMetrics = comparisonSummary
    ? [
      {
        label: "Ganhos em tokens",
        current: summary.totalPeriodTokens,
        previous: comparisonSummary.totalPeriodTokens,
        unit: "tk",
      },
      {
        label: "Média por dia ativo",
        current: summary.avgPerActiveDay,
        previous: comparisonSummary.avgPerActiveDay,
        unit: "tk/dia",
      },
      {
        label: "Dias ativos",
        current: summary.activeDays,
        previous: comparisonSummary.activeDays,
        unit: "dias",
      },
    ]
    : [];
  if (
    comparisonSummary &&
    Number(summary.periodAvgViewers) > 0 &&
    Number(comparisonSummary.periodAvgViewers) > 0
  ) {
    periodComparisonMetrics.push({
      label: "Média de espectadores",
      current: summary.periodAvgViewers,
      previous: comparisonSummary.periodAvgViewers,
      unit: "espectadores",
    });
  }
  if (
    comparisonSummary &&
    Number(summary.maxPeak) > 0 &&
    Number(comparisonSummary.maxPeak) > 0
  ) {
    periodComparisonMetrics.push({
      label: "Pico de espectadores",
      current: summary.maxPeak,
      previous: comparisonSummary.maxPeak,
      unit: "espectadores",
    });
  }
  if (summary.bestTokenHour && comparisonSummary?.hourlyBars) {
    const previousHour = comparisonSummary.hourlyBars.find(
      (hour) => hour.label === summary.bestTokenHour.label,
    );
    if (previousHour && summary.activeDays > 0 && comparisonSummary.activeDays > 0) {
      periodComparisonMetrics.push({
        label: `Média no melhor horário (${summary.bestTokenHour.label})`,
        current: summary.bestTokenHour.tokens / summary.activeDays,
        previous: previousHour.value / comparisonSummary.activeDays,
        unit: "tk/dia",
      });
    }
  }
  if (summary.bestLiveByPace && comparisonSummary?.bestLiveByPace) {
    periodComparisonMetrics.push({
      label: "Melhor ritmo entre lives",
      current: summary.bestLiveByPace.tokensPerHour,
      previous: comparisonSummary.bestLiveByPace.tokensPerHour,
      unit: "tk/h",
    });
  }
  const periodComparisonInsights = comparisonSummary
    ? buildComparisonInsights(
      periodComparisonMetrics,
      `Insights · ${summary.start}–${summary.end} vs. ${comparisonSummary.start}–${comparisonSummary.end}`,
    )
    : "";
  const periodComparisonCharts = comparisonSummary
    ? `
      ${buildInteractiveBarsSvg({
        title: "Comparação da média diária de tokens",
        subtitle: "Média por dia ativo em cada período",
        bars: [
          {
            label: "Período A",
            value: summary.avgPerActiveDay,
            tooltip: `${summary.start} a ${summary.end}: média ${summary.avgPerActiveDay} tk por dia ativo`,
          },
          {
            label: "Período B",
            value: comparisonSummary.avgPerActiveDay,
            tooltip: `${comparisonSummary.start} a ${comparisonSummary.end}: média ${comparisonSummary.avgPerActiveDay} tk por dia ativo`,
          },
        ],
        showCumulative: false,
        variant: "sunset",
      })}
      ${Number(summary.periodAvgViewers) > 0 && Number(comparisonSummary.periodAvgViewers) > 0
        ? buildInteractiveBarsSvg({
          title: "Comparação da média de espectadores",
          subtitle: "Média ponderada pelas amostras",
          bars: [
            {
              label: "Período A",
              value: summary.periodAvgViewers,
              tooltip: `${summary.start} a ${summary.end}: média de ${summary.periodAvgViewers} espectadores`,
            },
            {
              label: "Período B",
              value: comparisonSummary.periodAvgViewers,
              tooltip: `${comparisonSummary.start} a ${comparisonSummary.end}: média de ${comparisonSummary.periodAvgViewers} espectadores`,
            },
          ],
          showCumulative: false,
          variant: "mint",
        })
        : ""}
    `
    : "";
  const weekdayTokenDifference = summary.bestTokenWeekday
    ? getPercentDifference(summary.bestTokenWeekday.avg, summary.avgPerActiveDay)
    : null;
  const weekdayAudienceDifference = summary.busiestWeekday
    ? getPercentDifference(summary.busiestWeekday.avg, summary.periodAvgViewers)
    : null;
  const timedLiveSessions = liveSessionRows.filter((session) => session.durationSeconds > 0);
  const livePaceAverage = timedLiveSessions
    .reduce((sum, session) => sum + session.tokensPerHour, 0);
  const livePaceCount = timedLiveSessions.length;
  const livePaceDifference = summary.bestLiveByPace && livePaceCount > 1
    ? getPercentDifference(
      summary.bestLiveByPace.tokensPerHour,
      livePaceAverage / livePaceCount,
    )
    : null;
  const periodDayCount = Array.isArray(summary.dayBars) ? summary.dayBars.length : 0;
  const activeDayCount = Math.min(
    periodDayCount,
    Math.max(0, Number(summary.activeDays) || 0),
  );
  const activeDayPct = periodDayCount > 0
    ? Math.round((activeDayCount / periodDayCount) * 100)
    : null;
  const activeDateLabels = Array.isArray(summary.activeDayDates)
    ? summary.activeDayDates.slice(0, 4).map(clean)
    : [];
  const activeDateList = activeDateLabels.length <= 1
    ? activeDateLabels[0] || ""
    : activeDateLabels.length === 2
      ? `${activeDateLabels[0]} e ${activeDateLabels[1]}`
      : `${activeDateLabels.slice(0, -1).join(", ")} e ${activeDateLabels[activeDateLabels.length - 1]}`;
  const remainingActiveDays = Math.max(0, activeDayCount - activeDateLabels.length);
  const activeDaysInsight = activeDayPct === null
    ? ""
    : activeDayCount === 0
      ? `Nenhum dia do período teve registros (0 de ${periodDayCount}; 0%).`
      : activeDayCount === 1 && activeDateLabels.length === 1
        ? `Houve registros em ${activeDateLabels[0]} (1 de ${periodDayCount} dias do período; ${activeDayPct}%).`
        : `Houve registros em ${activeDayCount} de ${periodDayCount} dias do período (${activeDayPct}%)${activeDateList ? `: ${activeDateList}${remainingActiveDays > 0 ? ` e mais ${remainingActiveDays} dias` : ""}` : ""}.`;
  const totalPeriodTokens = Math.max(0, Number(summary.totalPeriodTokens) || 0);
  const bestDayTokens = Math.max(0, Number(summary.bestDay?.tokens) || 0);
  const bestDayShare = totalPeriodTokens > 0 && bestDayTokens <= totalPeriodTokens
    ? Math.round((bestDayTokens / totalPeriodTokens) * 100)
    : null;
  const hourlyTokenTotal = (Array.isArray(summary.hourlyBars) ? summary.hourlyBars : [])
    .reduce((sum, hour) => sum + Math.max(0, Number(hour.value) || 0), 0);
  const bestHourTokens = Math.max(0, Number(summary.bestTokenHour?.tokens) || 0);
  const bestHourShare = summary.bestTokenHour &&
    hourlyTokenTotal > 0 &&
    bestHourTokens <= hourlyTokenTotal
    ? Math.round((bestHourTokens / hourlyTokenTotal) * 100)
    : null;
  const audienceDayCount = Math.min(
    periodDayCount,
    Math.max(0, Number(summary.audienceDays) || 0),
  );
  const periodInsights = buildReportInsights("Insights do período", [
    activeDaysInsight,
    bestDayShare !== null && bestDayTokens > 0
      ? `O melhor dia concentrou ${bestDayShare}% dos tokens do período.`
      : "",
    periodDayCount > 0 && audienceDayCount < periodDayCount
      ? `Dados de público foram registrados em ${audienceDayCount} de ${periodDayCount} dias; as métricas de audiência usam esse recorte.`
      : "",
    bestHourShare !== null && bestHourShare > 0
      ? `Entre os registros por horário, ${summary.bestTokenHour.label} concentrou ${bestHourShare}% dos tokens contabilizados por hora.`
      : "",
    weekdayTokenDifference !== null && weekdayTokenDifference !== 0
      ? `${summary.bestTokenWeekday.name} teve média diária ${Math.abs(weekdayTokenDifference)}% ${weekdayTokenDifference >= 0 ? "acima" : "abaixo"} da média de dias ativos.`
      : "",
    weekdayAudienceDifference !== null && weekdayAudienceDifference !== 0
      ? `${summary.busiestWeekday.name} teve público médio ${Math.abs(weekdayAudienceDifference)}% ${weekdayAudienceDifference >= 0 ? "acima" : "abaixo"} da média do período.`
      : "",
    livePaceDifference !== null && livePaceDifference > 0
      ? `${summary.bestLiveByPace.label} teve ritmo ${livePaceDifference}% acima da média de todas as lives com duração registrada.`
      : "",
  ]);
  const periodHero = buildReportHero({
    name: summary.modelName || "Modelo",
    eyebrow: "Resumo do período",
    subtitle: `${summary.start}–${summary.end}`,
    badges: [
      { label: `${Math.round(Number(summary.totalPeriodTokens) || 0)} tk`, className: "report-hero-badge--tokens" },
      { label: `${summary.activeDays} dias ativos`, className: "report-hero-badge--status" },
      { label: `${Math.round(Number(summary.periodAvgViewers) || 0)} espectadores médios`, className: "report-hero-badge--pace" },
    ],
  });

  return `
    ${periodHero}
    ${buildSummaryStrip([
      { label: "Tokens", value: `${Math.round(summary.totalPeriodTokens)} tk`, tone: "cyan", icon: "tokens" },
      { label: "Horas líquidas", value: formatReportDuration(summary.periodNetSeconds), note: `${summary.activeDays} dias ativos`, tone: "purple", icon: "duration" },
      { label: "Tokens/hora", value: `${summary.audienceEfficiency?.tokensPerNetHour || 0} tk/h`, tone: "orange", icon: "pace" },
      { label: "Doadores", value: String(Array.isArray(summary.donorRows) ? summary.donorRows.length : 0), note: "usuários únicos", tone: "pink", icon: "audience" },
      { label: "Gorjetas", value: String(Math.round(Number(summary.totalTips) || 0)), note: "registradas", tone: "amber", icon: "tips" },
      { label: "Mensagens", value: String(Math.round(Number(summary.totalMessages) || 0)), tone: "blue", icon: "messages" },
    ])}
    <div class="metric-grid">
      <div class="metric-card metric-card--highlight"><small>Melhor dia</small><strong>${clean(summary.bestDay.dateBr)} · ${summary.bestDay.tokens} tk</strong></div>
      <div class="metric-card metric-card--audience"><small>Maior pico de espectadores</small><strong>${summary.maxPeak}</strong></div>
      <div class="metric-card metric-card--audience"><small>Dia com maior público médio</small><strong>${summary.busiestWeekday ? `${clean(summary.busiestWeekday.name)} · ${Math.round(summary.busiestWeekday.avg)} espectadores` : "—"}</strong></div>
      <div class="metric-card metric-card--highlight"><small>Melhor dia da semana</small><strong>${summary.bestTokenWeekday ? `${clean(summary.bestTokenWeekday.name)} · ${Math.round(summary.bestTokenWeekday.avg)} tk/dia` : "—"}</strong></div>
      <div class="metric-card metric-card--pace"><small>Melhor horário</small><strong>${summary.bestTokenHour ? `${clean(summary.bestTokenHour.label)} · ${summary.bestTokenHour.tokens} tk` : "—"}</strong></div>
      <div class="metric-card metric-card--audience"><small>Horário com maior média de espectadores</small><strong>${summary.bestAudienceHour ? `${clean(summary.bestAudienceHour.label)} · ${summary.bestAudienceHour.viewers}` : "—"}</strong></div>
      <div class="metric-card metric-card--highlight"><small>Maior gorjeta no período</small><strong>${bestTip ? `${clean(bestTip.username)} · ${Math.round(bestTip.tokens)} tk` : "—"}</strong>${bestTip ? `<small>${clean(bestTip.type)} · ${clean(bestTip.dateBr)}</small>` : ""}</div>
      ${summary.bestLiveByTokens ? `<div class="metric-card metric-card--income"><small>Live com mais tokens</small><strong>${clean(summary.bestLiveByTokens.label)} · ${Math.round(summary.bestLiveByTokens.tokens)} tk</strong></div>` : ""}
      ${summary.bestLiveByPace ? `<div class="metric-card metric-card--pace"><small>Live com melhor ritmo</small><strong>${clean(summary.bestLiveByPace.label)} · ${Math.round(summary.bestLiveByPace.tokensPerHour)} tk/h</strong></div>` : ""}
    </div>

    ${periodInsights}
    ${periodComparisonInsights}
    ${buildAudienceConversionHtml(summary.audienceConversion)}
    ${buildAudienceEfficiencyHtml(summary)}

    ${buildReportChartGroup(
      "Tendências e ganhos",
      "Tokens e ritmo por período, horário e categoria.",
      "gains",
      [
        buildInteractiveBarsSvg({
          title: summary.isWeekly ? "Ganhos por semana" : summary.isMonthly ? "Ganhos por mês" : "Ganhos por data",
          subtitle: `${summary.chartBars.length} intervalo(s)`,
          bars: summary.chartBars,
          variant: "sunset",
        }),
        weekdayTokenChart,
        dailyPaceChart,
        weekdayPaceChart,
        hourlyPaceChart,
        buildInteractiveBarsSvg({
          title: "Tokens por horário",
          subtitle: "Acumulado no período",
          bars: summary.hourlyBars,
          showCumulative: false,
          variant: "amber",
          showAllLabels: true,
        }),
        hourlyAverageChart,
        buildGainTypeChart(summary.eventSummaryTotals, summary.eventSummaryDays),
        largestTipChart,
      ],
    )}
    ${buildReportChartGroup(
      "Público e usuários",
      "Evolução de espectadores, usuários e recorrência.",
      "audience",
      [
        dailyAudienceComparisonChart,
        dailyPeakAudienceChart,
        audienceHourChart,
        listedUsersHourChart,
        tokensUsersHourChart,
        tokensUsersDayChart,
        tokensUsersWeekdayChart,
        tokensUsersPeakHourChart,
        audienceCharts,
        buildReportUsersChart(summary.periodUserPeak, summary.periodUserAvg, "Pico / média no período"),
      ],
    )}
    ${buildReportChartGroup(
      "Lives e duração",
      "Frequência, tempo ao vivo, ganhos e ritmo por sessão.",
      "lives",
      [
        buildNeonDonutGauge({
          label: "Frequência de lives",
          sublabel: `${summary.activeDays} de ${summary.dayBars.length} dias`,
          percent: summary.activeRatioPct,
        }),
        bruteDurationDayChart,
        durationDayChart,
        liveDurationChart,
        liveTokenChart,
        livePaceChart,
      ],
    )}
    ${buildReportChartGroup(
      "Doadores e recorrência",
      "Contagem de novos e recorrentes doadores ao longo do período.",
      "events",
      [tipperCharts],
    )}
    ${buildReportChartGroup(
      "Comparação entre períodos",
      "Variação das principais métricas em relação ao período anterior.",
      "comparison",
      [periodComparisonCharts],
    )}

    ${buildPeriodAdditionalMetricsHtml(
      summary,
      enableSuspectRemoval,
      true,
      true,
      buildReportLeaguesChart(summary.periodLeaguePeak, summary.periodLeagueAvg, "Pico / média no período"),
    )}
    ${buildReportChartGroup(
      "Padrões de atividade",
      "Distribuição de tokens, eventos e moderação por dia e horário.",
      "activity",
      [
        buildHeatmapHtml(summary.heatmap),
        buildActivityTimelineHtml(summary.activityTimeline),
      ],
    )}
    ${buildEngagementTableHtml(summary)}
    ${buildLeagueEngagementHtml(summary.leagueEngagementRows)}
    ${buildGoalShowTimelineHtml(summary)}

    <section class="report-card">
      <h2>Comparação por dia da semana</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Dia</th><th style="text-align:right;">Média tokens/dia</th><th style="text-align:right;">Média espectadores</th><th style="text-align:right;">Pico</th><th style="text-align:right;">Dias</th></tr></thead>
          <tbody>${weekdayRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-card">
      <h2>Rei da sala por dia</h2>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Rei</th><th style="text-align:right;">Tokens</th><th>Origem do valor</th></tr></thead>
          <tbody>${kingRows}</tbody>
        </table>
      </div>
    </section>
  `;
}
