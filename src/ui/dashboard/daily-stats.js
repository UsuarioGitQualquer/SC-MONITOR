import { clean } from "../../utils/helpers.js";

export function buildDailyStatsHtml({
  formattedToday,
  flowStepMin,
  flowStepSelection = flowStepMin,
  waveHtml,
  peakViewers,
  avgViewers,
  tokens,
  userPeak,
  userAverages,
  audience,
  returnRate,
  leaguePeak,
  leagueAverages,
}) {
  const steps = [
    { value: "auto", label: `Auto (${flowStepMin === 60 ? "1h" : `${flowStepMin}m`})` },
    { value: 5, label: "5m" },
    { value: 10, label: "10m" },
    { value: 30, label: "30m" },
    { value: 60, label: "1h" },
  ];
  const userMetrics = [
    ["👥 Listados", userPeak.listedUsersCount, userAverages.listedUsersCount],
    ["🪙 Com tokens", userPeak.tokensUsersCount, userAverages.tokensUsersCount],
    ["👑 Ultimate", userPeak.ultimateUsersCount, userAverages.ultimateUsersCount],
    ["👻 Invisíveis", userPeak.invisibleUsersCount, userAverages.invisibleUsersCount],
  ];
  const leagueMetrics = [
    ["Cinzas", "🔘", leaguePeak.grey, leagueAverages.grey],
    ["Bronze", "🟠", leaguePeak.bronze, leagueAverages.bronze],
    ["Prata", "🔵", leaguePeak.silver, leagueAverages.silver],
    ["Ouro", "🟡", leaguePeak.gold, leagueAverages.gold],
    ["Diamante", "🟣", leaguePeak.diamond, leagueAverages.diamond],
    ["Real", "🔴", leaguePeak.royal, leagueAverages.royal],
    ["Lendária", "⭐", leaguePeak.legend, leagueAverages.legend],
  ];

  return `
    <div style="font-weight: 600; color: #c084fc; margin-bottom: 8px; border-bottom: 1px solid #272952; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
      <span>📅 Consolidado Diário (Hoje)</span>
      <span style="font-size: 10px; color: #00e5ff; font-weight: bold; background: #23264d; padding: 2px 8px; border-radius: 99px;">${clean(formattedToday)}</span>
    </div>

    <div style="font-size: 10px; color:#8b92b8; font-style:italic; margin-bottom:8px; background:rgba(0,229,255,0.06); padding:5px 7px; border-radius:6px;">
      ℹ️ Este bloco acumula e consolida todas as lives da modelo no dia e reinicia automaticamente à meia-noite.
    </div>

    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:8px;">
      <span style="font-size:10px; color:#8b92b8;">Intervalo do fluxo de tokens:</span>
      <div style="display:flex; gap:4px;">
        ${steps.map((step) => `
          <button type="button" class="scm-daily-flow-step" data-step="${step.value}"
          style="background:${String(flowStepSelection) === String(step.value) ? "linear-gradient(90deg, #00e5ff, #2563eb)" : "#23264d"}; color:${String(flowStepSelection) === String(step.value) ? "#0f1024" : "#8b92b8"}; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">${clean(step.label)}</button>
        `).join("")}
      </div>
    </div>

    ${waveHtml}
    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; margin:10px 0 14px;">
      <div style="padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.035);">
        <span style="display:block; color:#8b92b8; font-size:10px;">🎖️ Maior pico de hoje</span>
        <strong style="font-size:12px;">${peakViewers} espectadores</strong>
      </div>
      <div style="padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.035);">
        <span style="display:block; color:#8b92b8; font-size:10px;">🧑🏻‍💻 Média de espectadores</span>
        <strong style="font-size:12px;">${avgViewers}</strong>
      </div>
      <div style="grid-column:1 / -1; padding:8px 10px; border-radius:8px; background:rgba(0,229,255,0.06);">
        <span style="display:block; color:#8b92b8; font-size:10px;">✨ Tokens hoje (gorjetas + shows estimados)</span>
        <strong style="font-size:14px; color:#00e5ff;">${tokens} tk</strong>
      </div>
    </div>
    <div style="margin:-8px 0 12px; color:#8b92b8; font-size:10px;">
      Média calculada pelas amostras coletadas durante o monitoramento.
    </div>

    <div style="margin-bottom:12px; border-top:1px dashed #272952; padding-top:10px;">
      <strong style="display:block; color:#00e5ff; font-size:11px; margin-bottom:7px;">Usuários (Hoje · Pico / Média)</strong>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:5px;">
        ${userMetrics.map(([label, peak, average]) => `
          <div style="padding:6px 8px; border-radius:6px; background:rgba(255,255,255,0.035);">
            <span style="display:block; color:#8b92b8; font-size:9px;">${label}</span>
            <strong style="font-size:10px;">Pico ${Math.round(Number(peak) || 0)} · Média ${Math.round(Number(average) || 0)}</strong>
          </div>
        `).join("")}
      </div>
      <strong style="display:block; margin:12px 0 8px; font-size:11px;">Retenção</strong>
      <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; font-size:10px;">
        <span style="display:flex; align-items:center; box-sizing:border-box; min-height:44px; padding:9px 10px; border-radius:6px; background:rgba(255,255,255,0.035);">🆕 Novos: ${audience.newUsers} (${audience.newTippers} doadores)</span>
        <span style="display:flex; align-items:center; box-sizing:border-box; min-height:44px; padding:9px 10px; border-radius:6px; background:rgba(255,255,255,0.035);">🔁 Recorrentes: ${audience.returningUsers} (${audience.returningTippers} doadores)</span>
        <span style="display:flex; align-items:center; box-sizing:border-box; grid-column:1 / -1; min-height:44px; padding:9px 10px; border-radius:6px; background:rgba(255,42,109,0.07);">Retorno: <strong style="color:#ff2a6d; margin-left:4px;">${returnRate}%</strong></span>
      </div>
    </div>

    <div style="border-top:1px dashed #272952; padding-top:10px;">
      <strong style="display:block; color:#ff7b00; font-size:11px; margin-bottom:7px;">Ligas (Hoje · Pico / Média)</strong>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(105px,1fr)); gap:5px;">
        ${leagueMetrics.map(([label, icon, peak, average]) => `
          <div style="padding:6px 8px; border-radius:6px; background:rgba(255,255,255,0.035);">
            <span style="display:block; color:#cbd5e1; font-size:9px;">${icon} ${label}</span>
            <strong style="font-size:10px;">Pico ${Math.round(Number(peak) || 0)} · Média ${Math.round(Number(average) || 0)}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}
