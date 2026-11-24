import { clean } from "../utils/helpers.js";
import { safeStorage } from "../core/storage.js";
import { state } from "../core/state.js";
import {
  buildInteractiveBarsSvg,
  buildNeonDonutGauge,
  buildNeonWaveAreaChart,
} from "./dashboard/basic-charts.js";
import {
  buildDailyReportChartData,
  buildReportData,
  hasAudienceStats,
  mergeDailyReportBuckets,
} from "./report-data.js";
import { getAdaptiveTimeStep } from "./chart-data.js";
import {
  buildGranularityToolbar,
  buildReportLeaguesChart,
  buildReportUsersChart,
} from "./report-charts.js";
import { buildDailyAdditionalMetricsHtml } from "./reports-view.js";

function formatDeltaHtml(valA, valB, suffix = "") {
  if (valB === undefined || valB === null) return "";
  const diff = (Number(valA) || 0) - (Number(valB) || 0);
  if (diff === 0) return ` <span style="color:#8b92b8; font-size:10px;">(=)</span>`;
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "#00e5ff" : "#ff2a6d";
  return ` <span style="color:${color}; font-size:10.5px; font-weight:bold;">(${sign}${diff}${suffix})</span>`;
}

function buildReportInsightsCard(repA, dailyA = {}) {
  const insights = [];

  if (Array.isArray(repA.minuteRows) && repA.minuteRows.length > 0) {
    const bestMin = [...repA.minuteRows].sort((a, b) => (b.tokens || 0) - (a.tokens || 0))[0];
    if (bestMin && bestMin.tokens > 0) {
      insights.push(`⏱️ Melhor minuto: <strong>${clean(bestMin.minute)}</strong> (${bestMin.tokens} tk)`);
    }
  }

  const topUsers = Array.isArray(dailyA.topUsersSnapshot) && dailyA.topUsersSnapshot.length > 0
    ? dailyA.topUsersSnapshot
    : Object.values(state.users || {})
        .filter((u) => u && (Number(u.tokens) || 0) > 0)
        .sort((a, b) => (Number(b.tokens) || 0) - (Number(a.tokens) || 0));

  if (topUsers[0]) {
    insights.push(`👑 Maior doador: <strong>${clean(topUsers[0].name)}</strong> (${Number(topUsers[0].tokens) || 0} tk)`);
  }

  const suspectCount = Array.isArray(state.suspectBots) ? state.suspectBots.length : 0;
  const modCount = Array.isArray(state.moderationLogs) ? state.moderationLogs.length : 0;
  if (suspectCount > 0 || modCount > 0) {
    insights.push(`🛡️ Segurança: <strong>${suspectCount}</strong> bot(s) suspeito(s) • <strong>${modCount}</strong> moderação(ões)`);
  }

  if (insights.length === 0) return "";

  return `
    <div class="scm-cyber-card" style="margin-bottom:12px; border-left: 3px solid #ff7b00;">
      <div style="font-weight: 700; color: #ff7b00; font-size: 11.5px; margin-bottom: 6px;">💡 Destaques da Sessão</div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:11px; color:#e2e8f0;">
        ${insights.map((line) => `<div>${line}</div>`).join("")}
      </div>
    </div>
  `;
}

export function createPanelReportWorkspace({
  getPanel,
  reportState,
  buildGainTypeChart,
  buildTopDonorsChart,
  formatSecondsToTime,
  storage = safeStorage,
}) {
  let renderSequence = 0;

  function bindGranularityButtons(workspace) {
    workspace.querySelectorAll(".scm-rep-gran-time").forEach((btn) => {
      btn.onclick = () => {
        const step = btn.getAttribute("data-step") || "auto";
        reportState.timeGranularity = step === "auto" ? "auto" : Number(step) || 60;
        render();
      };
    });
  }

  function render() {
    const panel = getPanel();
    if (!panel) return;
    const workspace = panel.querySelector("#scm-report-workspace");
    if (!workspace) return;
    const currentRender = ++renderSequence;
    const isCurrentRender = () =>
      currentRender === renderSequence &&
      getPanel() === panel &&
      panel.contains(workspace);

    const modelId = reportState.selectedModelId;
    const dateA = reportState.dateA;
    const dateB = reportState.dateB;

    if (!modelId) {
      workspace.innerHTML = `<div style="color:#8b92b8; font-size:12px; text-align:center; padding:20px;">Selecione um modelo para visualizar o relatório.</div>`;
      return;
    }

    if (!dateA) {
      workspace.innerHTML = `<div style="color:#8b92b8; font-size:12px; text-align:center; padding:20px;">Selecione uma data para visualizar o relatório.</div>`;
      return;
    }

    const historyEntryForDate = (dateKey) =>
      (reportState.historyEntries || []).find((entry) => entry.dateKey === dateKey);
    const historyEntryA = historyEntryForDate(dateA);
    const historyEntryB = dateB ? historyEntryForDate(dateB) : null;
    const reportModelIdA = historyEntryA?.modelId || modelId;
    const reportModelIdB = historyEntryB?.modelId || modelId;
    const modelIdsA = historyEntryA?.modelIds?.length
      ? historyEntryA.modelIds
      : [reportModelIdA];
    const modelIdsB = historyEntryB?.modelIds?.length
      ? historyEntryB.modelIds
      : [reportModelIdB];
    const keysA = modelIdsA.map((id) => `scm:model:${id}:daily:${dateA}`);
    const keysB = dateB
      ? modelIdsB.map((id) => `scm:model:${id}:daily:${dateB}`)
      : [];
    const keysToRead = ["scm_rooms_history", ...keysA, ...keysB];

    storage.get(keysToRead, (res) => {
      if (!isCurrentRender()) return;
      const hist = res?.scm_rooms_history || {};
      const roomMetaA = historyEntryA ||
        hist[`${reportModelIdA}::${dateA}`] ||
        { modelId: reportModelIdA, dateKey: dateA, modelName: modelId };
      const dailyA = mergeDailyReportBuckets(keysA.map((key) => res?.[key]));
      const repA = buildReportData(roomMetaA, dailyA);

      let repB = null;
      let dailyB = null;
      if (dateB) {
        const roomMetaB = historyEntryB ||
          hist[`${reportModelIdB}::${dateB}`] ||
          { modelId: reportModelIdB, dateKey: dateB, modelName: modelId };
        dailyB = mergeDailyReportBuckets(keysB.map((key) => res?.[key]));
        repB = buildReportData(roomMetaB, dailyB);
      }

      reportState.lastReportA = repA;
      reportState.lastReportB = repB;

      const sessionSelect = panel.querySelector("#scm-report-session");
      if (sessionSelect) {
        const sessions = (Array.isArray(repA.liveSessions) ? repA.liveSessions : [])
          .filter((session) => session && typeof session === "object");
        if (
          reportState.liveFilterEnabled &&
          sessions.length > 0 &&
          !sessions.some((s) => s.sessionId === reportState.selectedSessionId)
        ) {
          reportState.selectedSessionId = sessions[sessions.length - 1].sessionId;
        }
        if (sessions.length === 0) {
          reportState.selectedSessionId = "";
        }
        sessionSelect.innerHTML =
          sessions.length > 0
            ? (reportState.viewMode === "day"
                ? `<option value="" ${!reportState.liveFilterEnabled ? "selected" : ""}>Todas as Lives</option>`
                : "")
              + sessions
                .map(
                  (s, idx) =>
                    `<option value="${clean(s.sessionId)}" ${s.sessionId === reportState.selectedSessionId ? "selected" : ""}>Live ${idx + 1} • ${clean(s.startedAt || "--:--")} → ${clean(s.endedAt || "ativa")}${s.status === "ENCERRADA" ? "" : " • ativa"}</option>`
                )
                .join("")
            : `<option value="">Sessão única</option>`;
      }

      const liveBSelect = panel.querySelector("#scm-report-live-b");
      if (liveBSelect) {
        const sessions = (Array.isArray(repA.liveSessions) ? repA.liveSessions : [])
          .filter((session) => session && typeof session === "object");
        const primarySessionId = sessions.some((s) => s.sessionId === reportState.selectedSessionId)
          ? reportState.selectedSessionId
          : sessions[0]?.sessionId || "";
        if (
          sessions.length > 0 &&
          !reportState.liveBComparisonCleared &&
          (!reportState.selectedLiveBId ||
            reportState.selectedLiveBId === primarySessionId ||
            !sessions.some((s) => s.sessionId === reportState.selectedLiveBId))
        ) {
          reportState.selectedLiveBId =
            sessions.find((s) => s.sessionId !== primarySessionId)?.sessionId ||
            sessions[sessions.length - 1]?.sessionId ||
            "";
        }
        liveBSelect.innerHTML =
          sessions.length > 1
            ? `<option value="">Sem comparação de Live</option>` +
              sessions
                .map(
                  (s, idx) =>
                    `<option value="${clean(s.sessionId)}" ${s.sessionId === reportState.selectedLiveBId ? "selected" : ""}>Live ${idx + 1} • ${clean(s.startedAt || "--:--")} → ${clean(s.endedAt || "ativa")}</option>`
                )
                .join("")
            : `<option value="">Nenhuma outra Live neste dia</option>`;
      }

      const activeReportSession = repA.liveSessions.find(
        (session) => session && session.sessionId === reportState.selectedSessionId
      );
      const audienceMinuteRows =
        reportState.liveFilterEnabled && reportState.selectedSessionId
          ? activeReportSession?.minuteRows
          : repA.minuteRows;
      const hasHourlyFallback =
        !reportState.liveFilterEnabled &&
        Array.isArray(dailyA.hourlyTokens) &&
        dailyA.hourlyTokens.length === 24;
      const autoStepMin = audienceMinuteRows?.length
        ? getAdaptiveTimeStep(audienceMinuteRows)
        : hasHourlyFallback
          ? 60
          : 1;
      const stepMin = reportState.timeGranularity === "auto"
        ? autoStepMin
        : Number(reportState.timeGranularity) || 60;
      const stepLabel = stepMin === 60 ? "1h" : `${stepMin} min`;
      const reportChartData = buildDailyReportChartData({
        report: repA,
        daily: dailyA,
        stepMinutes: stepMin,
        sessionId: reportState.liveFilterEnabled ? reportState.selectedSessionId : null,
      });
      const activeBars = reportChartData.timeBars;
      const audiencePoints = reportChartData.audiencePoints;
      const timeChartSubtitleBase =
        reportState.liveFilterEnabled && activeReportSession && activeReportSession.minuteRows.length === 0
          ? "Detalhamento por live disponível a partir desta atualização"
          : repA.dateBr;
      const timeChartSubtitle = reportChartData.tokensWithoutTime > 0
        ? `${timeChartSubtitleBase} · ${reportChartData.tokensWithoutTime} tk sem horário registrado`
        : timeChartSubtitleBase;

      const hasAudA = hasAudienceStats(dailyA?.audienceStats);
      const audA = hasAudA ? dailyA.audienceStats : {
        newUsers: 0,
        returningUsers: 0,
        newTippers: 0,
        returningTippers: 0,
        newTokens: 0,
        returningTokens: 0,
      };
      const audB = repB && hasAudienceStats(dailyB?.audienceStats)
        ? dailyB.audienceStats
        : null;
      const newUsersA = Number(audA.newUsers) || 0;
      const returningUsersA = Number(audA.returningUsers) || 0;
      const totalAudA = newUsersA + returningUsersA;
      const returnRateA = totalAudA > 0 ? Math.round((returningUsersA / totalAudA) * 100) : 0;
      const netEfficiencyPct = repA.bruteSeconds > 0 ? Math.round((repA.netSeconds / repA.bruteSeconds) * 100) : 0;
      const tokensPerHour = repA.netSeconds > 0 ? Math.round((repA.totalTokens / repA.netSeconds) * 3600) : 0;

      const topUsers = repA.donorRows;
      const topUsersHtml =
        topUsers.length > 0
          ? topUsers
              .slice(0, 10)
              .map(
                (u, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td>${clean(u.name)}</td>
                  <td style="text-align:center;">${Number(u.tips) || 0}x</td>
                  <td style="text-align:right; color:#00e5ff; font-weight:bold;">${Number(u.tokens) || 0} tk</td>
                </tr>`
              )
              .join("")
          : `<tr><td colspan="4" style="text-align:center; color:#8b92b8;">Sem top gorjeteiros salvos neste dia.</td></tr>`;

      const liveSessionsForComparison = (Array.isArray(repA.liveSessions) ? repA.liveSessions : [])
        .filter((session) => session && typeof session === "object");
      const liveA =
        liveSessionsForComparison.find((s) => s && s.sessionId === reportState.selectedSessionId) ||
        liveSessionsForComparison[0] ||
        null;
      const liveB =
        liveSessionsForComparison.find((s) => s && s.sessionId === reportState.selectedLiveBId) ||
        null;
      const liveComparisonHtml =
        liveA && liveB && liveA.sessionId !== liveB.sessionId
          ? (() => {
              const liveATokens = Math.round(Number(liveA.tokens) || 0);
              const liveBTokens = Math.round(Number(liveB.tokens) || 0);
              const liveADuration = Number(liveA.durationSeconds) || 0;
              const liveBDuration = Number(liveB.durationSeconds) || 0;
              const liveAPeak = Number(liveA.peakViewers) || 0;
              const liveBPeak = Number(liveB.peakViewers) || 0;
              const liveATokensPerHour = liveADuration > 0 ? Math.round((liveATokens / liveADuration) * 3600) : 0;
              const liveBTokensPerHour = liveBDuration > 0 ? Math.round((liveBTokens / liveBDuration) * 3600) : 0;
              const tokenDelta = liveATokens - liveBTokens;
              const deltaColor = tokenDelta >= 0 ? "#00e5ff" : "#ff2a6d";
              const tokenSign = tokenDelta >= 0 ? "+" : "";
              return `
                <div class="scm-cyber-card" style="margin-bottom:12px; border-left:3px solid #c084fc;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#c084fc; font-size:12px;">⚖️ Comparação entre Lives</strong>
                    <span style="font-size:9.5px; color:#8b92b8;">Mesmo dia</span>
                  </div>
                  <div style="font-size:10px; color:#8b92b8; margin-bottom:6px; text-align:center;">
                    Live A · ${clean(liveA.startedAt || "--:--")} &nbsp;|&nbsp; Live B · ${clean(liveB.startedAt || "--:--")}
                  </div>
                  <div class="scroll" style="max-height:190px;">
                    <table>
                      <thead><tr><th>Métrica</th><th style="text-align:right;">Live A</th><th style="text-align:right;">Live B</th></tr></thead>
                      <tbody>
                        <tr><td>Tokens</td><td style="text-align:right;">${liveATokens.toLocaleString("pt-BR")} tk</td><td style="text-align:right;">${liveBTokens.toLocaleString("pt-BR")} tk</td></tr>
                        <tr><td>Ritmo</td><td style="text-align:right;">${liveATokensPerHour.toLocaleString("pt-BR")} tk/h</td><td style="text-align:right;">${liveBTokensPerHour.toLocaleString("pt-BR")} tk/h</td></tr>
                        <tr><td>Duração</td><td style="text-align:right;">${formatSecondsToTime(liveADuration)}</td><td style="text-align:right;">${formatSecondsToTime(liveBDuration)}</td></tr>
                        <tr><td>Pico de espectadores</td><td style="text-align:right;">${liveAPeak}</td><td style="text-align:right;">${liveBPeak}</td></tr>
                        <tr><td>Média de espectadores</td><td style="text-align:right;">${Number(liveA.avgViewers) || 0}</td><td style="text-align:right;">${Number(liveB.avgViewers) || 0}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style="text-align:center; margin-top:8px; font-size:11px; color:${deltaColor}; font-weight:bold;">
                    Live A ${tokenSign}${tokenDelta} tk em relação à Live B
                  </div>
                </div>
              `;
            })()
          : "";

      workspace.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:12px;">
          <div class="scm-cyber-card" style="border-left: 3px solid #00e5ff; background:linear-gradient(135deg, rgba(0,229,255,0.12), #181a36 78%);">
            <small style="color:#8b92b8;">Tokens (gorjetas + shows estimados)</small>
            <strong style="font-size:16px; color:#00e5ff;">${repA.totalTokens} tk${repB ? formatDeltaHtml(repA.totalTokens, repB.totalTokens, " tk") : ""}</strong>
          </div>
          <div class="scm-cyber-card" style="border-left: 3px solid #ff7b00; background:linear-gradient(135deg, rgba(255,123,0,0.12), #181a36 78%);">
            <small style="color:#8b92b8;">Ritmo (Tokens / Hora)</small>
            <strong style="font-size:15px; color:#ff7b00;">${tokensPerHour} tk/h</strong>
          </div>
          <div class="scm-cyber-card" style="border-left:3px solid #ff2a6d; background:linear-gradient(135deg, rgba(255,42,109,0.12), #181a36 78%);">
            <small style="color:#8b92b8;">Pico / Média Viewers</small>
            <strong style="font-size:14px; color:#ff2a6d;">${repA.peakViewers} / ${repA.avgViewers}${repB ? formatDeltaHtml(repA.peakViewers, repB.peakViewers) : ""}</strong>
          </div>
          <div class="scm-cyber-card" style="border-left:3px solid #c084fc; background:linear-gradient(135deg, rgba(192,132,252,0.12), #181a36 78%);">
            <small style="color:#8b92b8;">Tempo Líquido / Bruto</small>
            <strong style="font-size:12.5px; color:#c084fc;">${formatSecondsToTime(repA.netSeconds)} <span style="color:#8b92b8; font-weight:400;">/ ${formatSecondsToTime(repA.bruteSeconds)}</span></strong>
          </div>
        </div>

        ${liveComparisonHtml}

        ${buildReportInsightsCard(repA, dailyA)}

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
          ${buildNeonDonutGauge({
            label: "Retenção de Público",
            sublabel: hasAudA ? `${returningUsersA} recorrentes` : "Sem dados de público",
            percent: returnRateA,
            colorStart: "#ff2a6d",
            colorEnd: "#8a2be2",
          })}
          ${buildNeonDonutGauge({
            label: "Aproveitamento Live",
            sublabel: `Líquido vs Bruto`,
            percent: netEfficiencyPct,
            colorStart: "#00e5ff",
            colorEnd: "#2563eb",
          })}
        </div>

        ${buildGranularityToolbar({
          timeGranularity: reportState.timeGranularity,
          autoStepMin,
        })}
        ${buildInteractiveBarsSvg({
          title: `💰 Ganhos por Bloco (${stepLabel})`,
          subtitle: timeChartSubtitle,
          bars: activeBars,
        })}
        ${buildNeonWaveAreaChart({
          title: "📈 Curva de Audiência Média",
          subtitle: `${reportState.timeGranularity === "auto" ? "Auto · " : ""}blocos de ${stepLabel}`,
          points: audiencePoints.map((point) => ({
            label: point.label,
            value: point.viewers,
            tooltip: point.tooltip,
          })),
          strokeColor: "#00e5ff",
          fillStart: "#00e5ff",
          fillEnd: "#8a2be2",
        })}
        ${buildGainTypeChart()}
        ${buildTopDonorsChart()}
        ${buildReportUsersChart(repA.uPeak, repA.uAvg, repA.dateBr)}
        ${buildReportLeaguesChart(repA.lPeak, repA.lAvg, repA.dateBr)}
        ${buildDailyAdditionalMetricsHtml(repA, dailyA, false, false, {
          menu: false,
          tips: false,
          roulette: false,
        })}

        <div class="scm-cyber-card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:#00e5ff; font-size:12px;">👥 Detalhe Novos vs. Recorrentes</strong>
            <span style="font-size:10px; color:#8b92b8; background:#23264d; padding:2px 8px; border-radius:10px;">Retorno: <strong style="color:#00e5ff;">${hasAudA ? `${returnRateA}%` : "—"}</strong></span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px;">
            <div style="background:#23264d; padding:8px 10px; border-radius:8px; border-left:3px solid #00e5ff;">
              <small style="color:#8b92b8;">🆕 Novos no Dia</small>
              <div style="font-weight:bold; font-size:14px; color:#fff; margin-top:2px;">
                ${hasAudA ? newUsersA : "—"}${hasAudA && audB ? formatDeltaHtml(newUsersA, audB.newUsers) : ""}
              </div>
              <div style="font-size:10px; color:#8b92b8; margin-top:3px;">
                ${hasAudA ? `Doadores: ${audA.newTippers} (${audA.newTokens} tk)` : "Sem dados de público"}
              </div>
            </div>
            <div style="background:#23264d; padding:8px 10px; border-radius:8px; border-left:3px solid #ff2a6d;">
              <small style="color:#8b92b8;">🔁 Recorrentes</small>
              <div style="font-weight:bold; font-size:14px; color:#fff; margin-top:2px;">
                ${hasAudA ? returningUsersA : "—"}${hasAudA && audB ? formatDeltaHtml(returningUsersA, audB.returningUsers) : ""}
              </div>
              <div style="font-size:10px; color:#8b92b8; margin-top:3px;">
                ${hasAudA ? `Doadores: ${audA.returningTippers} (${audA.returningTokens} tk)` : "Sem dados de público"}
              </div>
            </div>
          </div>
        </div>

        <h4 style="color:#ff2a6d; font-size:12.5px; margin: 14px 0 6px 0; border-bottom: 1px solid #272952; padding-bottom: 4px;">🏆 Top Doadores (${clean(repA.dateBr)})</h4>
        <div class="scroll" style="height:130px; min-height:70px;">
          <table>
            <thead><tr><th>#</th><th>Usuário</th><th style="text-align:center;">Gorjetas</th><th style="text-align:right;">Tokens</th></tr></thead>
            <tbody>${topUsersHtml}</tbody>
          </table>
        </div>
      `;
      bindGranularityButtons(workspace);
    });
  }

  return { render };
}
