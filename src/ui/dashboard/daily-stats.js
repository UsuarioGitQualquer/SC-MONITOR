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
    <div style="margin-bottom: 10px; line-height: 1.6; font-size: 11px;">
      <strong>🎖️ Maior Pico (Hoje):</strong> ${peakViewers} espectadores  |  <strong>🧑🏻‍💻 Média:</strong> ${avgViewers}<br>
      <span style="font-size:10px; color:#8b92b8;">Média calculada pelas amostras coletadas durante o monitoramento.</span><br>
      <strong>✨ Tokens (gorjetas + shows estimados, hoje):</strong> <span style="color: #00e5ff; font-weight: bold; font-size: 13px;">${tokens} tk</span>
    </div>

    <div style="margin-bottom: 10px; border-top: 1px dashed #272952; padding-top: 8px; line-height: 1.6; font-size: 11px;">
      <strong style="color: #00e5ff;">Usuários (Hoje - Pico / Média):</strong><br>
      Listados: ${userPeak.listedUsersCount || 0}/${userAverages.listedUsersCount} | Com Tokens: ${userPeak.tokensUsersCount || 0}/${userAverages.tokensUsersCount} | Ultimate: ${userPeak.ultimateUsersCount || 0}/${userAverages.ultimateUsersCount} | Invisíveis: ${userPeak.invisibleUsersCount || 0}/${userAverages.invisibleUsersCount}<br>
      <strong>Retenção:</strong> 🆕 Novos: ${audience.newUsers} (${audience.newTippers} doadores) | 🔁 Recorrentes: ${audience.returningUsers} (${audience.returningTippers} doadores) | Retorno: <span style="color:#ff2a6d; font-weight:bold;">${returnRate}%</span>
    </div>

    <div style="border-top: 1px dashed #272952; padding-top: 8px; line-height: 1.6; font-size: 11px;">
      <strong style="color: #ff7b00;">Ligas (Hoje - Pico / Média):</strong><br>
      🔘${leaguePeak.grey || 0}/${leagueAverages.grey}   🟠${leaguePeak.bronze || 0}/${leagueAverages.bronze}   🔵${leaguePeak.silver || 0}/${leagueAverages.silver}   🟡${leaguePeak.gold || 0}/${leagueAverages.gold}   🟣${leaguePeak.diamond || 0}/${leagueAverages.diamond}   🔴${leaguePeak.royal || 0}/${leagueAverages.royal}   ⭐${leaguePeak.legend || 0}/${leagueAverages.legend}
    </div>
  `;
}
