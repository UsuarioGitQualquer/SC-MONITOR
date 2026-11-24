import { clean } from "../utils/helpers.js";

export function buildReportHorizontalChart({
  title,
  subtitle,
  accentColor = "#00e5ff",
  rows = [],
  unit = " tk",
}) {
  const validRows = Array.isArray(rows) ? rows : [];
  if (validRows.length === 0) {
    return `
      <div class="scm-cyber-card scm-report-chart-card" style="--report-accent:${accentColor}; border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
        <strong style="color:${accentColor}; font-size:13px;">${clean(title)}</strong>
        <div style="font-size:11px; color:#aab3d6; text-align:center; padding:14px 0;">Sem dados para exibir.</div>
      </div>
    `;
  }

  const maxVal = Math.max(
    1,
    ...validRows.flatMap((row) => [
      Number(row.value) || 0,
      Number(row.secondaryValue) || 0,
    ]),
  );

  const rowsHtml = validRows
    .map((row) => {
      const value = Math.round(Number(row.value) || 0);
      const secondaryValue =
        row.secondaryValue !== undefined && row.secondaryValue !== null
          ? Math.round(Number(row.secondaryValue) || 0)
          : null;
      const percentage = Math.min(100, Math.round((value / maxVal) * 100));
      const color1 = row.color || "#00e5ff";
      const color2 = row.secondaryColor || "#8a2be2";
      const rowUnit = row.unit !== undefined ? row.unit : unit;

      return `
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px;">
              <span style="color:#cbd5e1; font-weight:500;">${clean(row.label)}</span>
              <span style="color:#f8fafc; font-weight:650;">${secondaryValue !== null ? `${value} <span style="color:#94a3b8; font-weight:400;">/ méd ${secondaryValue}</span>` : `${value}${rowUnit}`}</span>
          </div>
              <div style="width:100%; height:10px; background:#252d45; border-radius:99px; overflow:hidden;">
              <div title="${clean(row.tooltip || row.label)}" style="width:${percentage}%; height:100%; background:linear-gradient(90deg, ${color1}, ${color2}); border-radius:99px; transition:width 0.4s ease;"></div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="scm-cyber-card scm-report-chart-card" style="--report-accent:${accentColor}; border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#202944,#151a2d);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="color:${accentColor}; font-size:13px;">${clean(title)}</strong>
        <span style="font-size:10px; color:#c4b5fd; background:#292744; padding:4px 9px; border-radius:99px;">${clean(subtitle || "")}</span>
      </div>
      ${rowsHtml}
    </div>
  `;
}

export function buildReportUsersChart(uPeak = {}, uAvgObj = {}, subtitle = "") {
  const getAverage = (key) =>
    typeof uAvgObj === "function"
      ? uAvgObj(key)
      : Math.round(Number(uAvgObj?.[key]) || 0);

  return buildReportHorizontalChart({
    title: "👥 Engajamento de Usuários (Pico / Média)",
    subtitle,
    accentColor: "#00e5ff",
    rows: [
      { label: "Listados", value: uPeak.listedUsersCount || 0, secondaryValue: getAverage("listedUsersCount"), color: "#00e5ff", secondaryColor: "#2563eb" },
      { label: "Outros", value: uPeak.otherUsersCount || 0, secondaryValue: getAverage("otherUsersCount"), color: "#94a3b8", secondaryColor: "#475569" },
      { label: "Com Tokens", value: uPeak.tokensUsersCount || 0, secondaryValue: getAverage("tokensUsersCount"), color: "#ff7b00", secondaryColor: "#ff2a6d" },
      { label: "Ultimate", value: uPeak.ultimateUsersCount || 0, secondaryValue: getAverage("ultimateUsersCount"), color: "#ff2a6d", secondaryColor: "#8a2be2" },
      { label: "Invisíveis", value: uPeak.invisibleUsersCount || 0, secondaryValue: getAverage("invisibleUsersCount"), color: "#94a3b8", secondaryColor: "#475569" },
      { label: "Mais (+)", value: uPeak.moreUsersCount || 0, secondaryValue: getAverage("moreUsersCount"), color: "#38bdf8", secondaryColor: "#8a2be2" },
    ],
  });
}

export function buildReportLeaguesChart(lPeak = {}, lAvgObj = {}, subtitle = "") {
  const getAverage = (key) =>
    typeof lAvgObj === "function"
      ? lAvgObj(key)
      : Math.round(Number(lAvgObj?.[key]) || 0);

  return buildReportHorizontalChart({
    title: "🏆 Distribuição de Ligas (Pico / Média)",
    subtitle,
    accentColor: "#ff2a6d",
    rows: [
      { label: "🔘 Cinza", value: lPeak.grey || 0, secondaryValue: getAverage("grey"), color: "#94a3b8", secondaryColor: "#64748b" },
      { label: "🟠 Bronze", value: lPeak.bronze || 0, secondaryValue: getAverage("bronze"), color: "#f97316", secondaryColor: "#ea580c" },
      { label: "🔵 Prata", value: lPeak.silver || 0, secondaryValue: getAverage("silver"), color: "#00e5ff", secondaryColor: "#0284c7" },
      { label: "🟡 Ouro", value: lPeak.gold || 0, secondaryValue: getAverage("gold"), color: "#facc15", secondaryColor: "#ff7b00" },
      { label: "🟣 Diamante", value: lPeak.diamond || 0, secondaryValue: getAverage("diamond"), color: "#c084fc", secondaryColor: "#8a2be2" },
      { label: "🔴 Real", value: lPeak.royal || 0, secondaryValue: getAverage("royal"), color: "#ff2a6d", secondaryColor: "#dc2626" },
      { label: "⭐ Lendária", value: lPeak.legend || 0, secondaryValue: getAverage("legend"), color: "#ff7b00", secondaryColor: "#ff2a6d" },
    ],
  });
}

export function buildGranularityToolbar({
  timeGranularity,
  autoStepMin = 1,
}) {
  const steps = [
    { value: "auto", label: `Auto (${autoStepMin}m)` },
    { value: 1, label: "1m" },
    { value: 2, label: "2m" },
    { value: 5, label: "5m" },
    { value: 10, label: "10m" },
    { value: 20, label: "20m" },
    { value: 30, label: "30m" },
    { value: 60, label: "1h" },
  ];
  return `
    <div class="scm-cyber-card" style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:10px; padding:8px 12px;">
      <span style="font-size:11px; color:#e2e8f0; font-weight:600;">⏱️ Intervalo:</span>
      <div style="display:flex; gap:5px;">
        ${steps
          .map((step) => {
            const active = step.value === "auto"
              ? timeGranularity === "auto"
              : Number(timeGranularity) === step.value;
            return `<button type="button" class="scm-rep-gran-time" data-step="${step.value}" style="background:${active ? "linear-gradient(90deg, #00e5ff, #2563eb)" : "#23264d"}; color:${active ? "#0f1024" : "#8b92b8"}; border:0; padding:4px 8px; border-radius:6px; font-size:10.5px; font-weight:bold; cursor:pointer;">${clean(step.label)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}
