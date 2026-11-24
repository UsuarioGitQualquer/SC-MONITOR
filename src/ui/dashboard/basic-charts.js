import { clean } from "../../utils/helpers.js";
import { LEAGUE_CHART_ITEMS } from "../report-data.js";

export function buildTimeStepSelectorHtml({
  className,
  selectedStep = "auto",
  autoStep = 1,
  label = "Bloco do gráfico:",
}) {
  const steps = [
    { value: "auto", label: `Auto (${Math.max(1, Number(autoStep) || 1)}m)` },
    { value: "5", label: "5m" },
    { value: "10", label: "10m" },
    { value: "30", label: "30m" },
    { value: "60", label: "1h" },
  ];
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; margin:4px 0 6px;">
      <span style="font-size:10px; color:#8b92b8;">${clean(label)}</span>
      <div style="display:flex; flex-wrap:wrap; gap:4px;">
        ${steps.map((step) => {
          const isActive = String(selectedStep) === step.value;
          return `<button type="button" class="${clean(className)}" data-step="${step.value}" aria-pressed="${isActive}" style="background:${isActive ? "linear-gradient(90deg, #00e5ff, #2563eb)" : "#23264d"}; color:${isActive ? "#0f1024" : "#8b92b8"}; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">${clean(step.label)}</button>`;
        }).join("")}
      </div>
    </div>
  `;
}

export function buildNeonDonutGauge({
  label,
  sublabel = "",
  percent = 0,
  valueText = "",
  colorStart = "#00e5ff",
  colorEnd = "#8a2be2",
}) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const gradId = `scm-grad-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <div class="scm-cyber-card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px 8px; text-align:center; border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
      <div style="position:relative; width:68px; height:68px; margin-bottom:6px;">
        <svg viewBox="0 0 68 68" style="width:68px; height:68px; transform: rotate(-90deg);">
          <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${colorStart}" />
              <stop offset="100%" stop-color="${colorEnd}" />
            </linearGradient>
          </defs>
          <circle cx="34" cy="34" r="${radius}" fill="none" stroke="#2b3450" stroke-width="5" />
          <circle cx="34" cy="34" r="${radius}" fill="none" stroke="url(#${gradId})" stroke-width="5"
            stroke-dasharray="${circumference.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}"
            stroke-linecap="round"
            style="transition: stroke-dashoffset 0.5s ease;" />
        </svg>
        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff;">
          ${valueText || `${pct}%`}
        </div>
      </div>
      <div style="font-size:11px; font-weight:600; color:#e2e8f0; letter-spacing:0.3px;">${clean(label)}</div>
      ${sublabel ? `<div style="font-size:9.5px; color:#8b92b8; margin-top:2px;">${clean(sublabel)}</div>` : ""}
    </div>
  `;
}

export function buildNeonWaveAreaChart({
  title,
  subtitle,
  points = [],
  strokeColor = "#ff2a6d",
  fillStart = "#ff2a6d",
  fillEnd = "#8a2be2",
}) {
  if (!Array.isArray(points) || points.length === 0) {
    return `
      <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="color:#e2e8f0; font-size:12px;">${clean(title)}</strong>
          <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle || "")}</span>
        </div>
        <div style="font-size:11px; color:#8b92b8; text-align:center; padding:14px 0;">Aguardando dados para traçar curva...</div>
      </div>
    `;
  }

  const width = 360;
  const height = 115;
  const padX = 14;
  const padT = 22;
  const padB = 20;
  const plotW = width - padX * 2;
  const plotH = height - padT - padB;

  const vals = points.map((point) => Number(point.value) || 0);
  const maxVal = Math.max(1, ...vals);
  const peakIdx = vals.indexOf(Math.max(...vals));
  const areaGradId = `scm-area-${Math.random().toString(36).slice(2, 8)}`;

  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * plotW;
    const y = padT + plotH - ((Number(point.value) || 0) / maxVal) * plotH;
    return { x, y, val: Math.round(Number(point.value) || 0), label: point.label, tooltip: point.tooltip };
  });

  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let index = 0; index < coords.length - 1; index++) {
    const p0 = coords[index];
    const p1 = coords[index + 1];
    const midX = (p0.x + p1.x) / 2;
    pathD += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${padT + plotH} L ${coords[0].x.toFixed(1)} ${padT + plotH} Z`;
  const labelEvery = coords.length <= 6 ? 1 : Math.ceil(coords.length / 6);
  const showSmallDots = coords.length <= 25;
  const dotsAndLabels = coords
    .map((point, index) => {
      const isPeak = index === peakIdx && point.val > 0;
      const showLabel = index % labelEvery === 0 || index === coords.length - 1;
      const tooltip = clean(point.tooltip || `${point.label}: ${point.val}`);
      return `
        <g>
          ${
            isPeak
              ? `
            <rect x="${(point.x - 18).toFixed(1)}" y="${Math.max(1, point.y - 20).toFixed(1)}" width="36" height="14" rx="7" fill="#d97706" />
            <text x="${point.x.toFixed(1)}" y="${Math.max(11, point.y - 10).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="bold" font-family="sans-serif">${point.val}</text>
            <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="#fff" stroke="${strokeColor}" stroke-width="2" />
          `
              : ""
          }
          ${
            showLabel
              ? `<text x="${point.x.toFixed(1)}" y="${height - 4}" text-anchor="middle" fill="#8b92b8" font-size="8.5" font-family="sans-serif">${clean(point.label)}</text>`
              : ""
          }
          ${
            showSmallDots
              ? `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.5" fill="${strokeColor}" opacity="0.8"><title>${tooltip}</title></circle>`
              : `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="transparent"><title>${tooltip}</title></circle>`
          }
        </g>
      `;
    })
    .join("");

  return `
    <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#e2e8f0; font-size:12px; letter-spacing:0.1px;">${clean(title)}</strong>
        <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle || "")}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
        <defs>
          <linearGradient id="${areaGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${fillStart}" stop-opacity="0.24" />
            <stop offset="100%" stop-color="${fillEnd}" stop-opacity="0.01" />
          </linearGradient>
        </defs>
        <line x1="${padX}" y1="${padT}" x2="${width - padX}" y2="${padT}" stroke="#343d58" stroke-dasharray="2,4" stroke-width="0.8" />
        <line x1="${padX}" y1="${padT + plotH / 2}" x2="${width - padX}" y2="${padT + plotH / 2}" stroke="#343d58" stroke-dasharray="2,4" stroke-width="0.8" />
        <line x1="${padX}" y1="${padT + plotH}" x2="${width - padX}" y2="${padT + plotH}" stroke="#46516d" stroke-width="1" />
        <path d="${areaD}" fill="url(#${areaGradId})" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" />
        ${dotsAndLabels}
      </svg>
    </div>
  `;
}

export function buildCombinedAudienceEarningsChart({
  title = "Público e ganhos",
  subtitle = "",
  audiencePoints = [],
  earningsBars = [],
  eventMarkers = [],
}) {
  const audience = Array.isArray(audiencePoints) ? audiencePoints : [];
  const earnings = Array.isArray(earningsBars) ? earningsBars : [];
  const events = Array.isArray(eventMarkers) ? eventMarkers : [];

  if (audience.length === 0 && earnings.length === 0) {
    return `
      <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="color:#e2e8f0; font-size:12px;">${clean(title)}</strong>
          <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle)}</span>
        </div>
        <div style="font-size:11px; color:#8b92b8; text-align:center; padding:14px 0;">Aguardando dados de público e ganhos...</div>
      </div>
    `;
  }

  const width = 720;
  const height = 150;
  const padL = 28;
  const padR = 8;
  const padT = 24;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const gradId = `scm-combined-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeLabel = (label) => {
    const text = String(label || "");
    const full = text.match(/^(\d{1,2}):(\d{2})/);
    if (full) return `${String(Number(full[1])).padStart(2, "0")}:${full[2]}`;
    const hour = text.match(/^(\d{1,2})h$/i);
    if (hour) return `${String(Number(hour[1])).padStart(2, "0")}:00`;
    return text;
  };

  const labels = [];
  earnings.forEach((bar) => {
    const label = normalizeLabel(bar.label);
    if (!labels.includes(label)) labels.push(label);
  });
  audience.forEach((point) => {
    const label = normalizeLabel(point.label);
    if (!labels.includes(label)) labels.push(label);
  });
  events.forEach((event) => {
    const label = normalizeLabel(event.label);
    if (!labels.includes(label)) labels.push(label);
  });
  labels.sort();

  if (labels.length === 0) return buildCombinedAudienceEarningsChart({
    title,
    subtitle,
  });

  const audienceMap = new Map(audience.map((point) => [normalizeLabel(point.label), point]));
  const earningsMap = new Map(earnings.map((bar) => [normalizeLabel(bar.label), bar]));
  const eventMap = new Map();
  events.forEach((event) => {
    const label = normalizeLabel(event.label);
    if (!eventMap.has(label)) eventMap.set(label, []);
    eventMap.get(label).push(event);
  });

  let lastAudienceValue = null;
  const audienceValues = labels.map((label) => {
    if (audienceMap.has(label)) {
      lastAudienceValue = Math.max(
        0,
        Number(audienceMap.get(label)?.value ?? audienceMap.get(label)?.viewers) || 0,
      );
      return lastAudienceValue;
    }
    return lastAudienceValue;
  });
  const earningsValues = labels.map((label) => Math.max(0, Number(earningsMap.get(label)?.value) || 0));
  const knownAudienceValues = audienceValues.filter((value) => value !== null);
  const maxAudience = Math.max(1, ...knownAudienceValues);
  const maxEarnings = Math.max(1, ...earningsValues);
  const xAt = (index) => labels.length === 1
    ? padL + plotW / 2
    : padL + (index / (labels.length - 1)) * plotW;
  const audienceY = (value) => padT + plotH - (value / maxAudience) * plotH;

  const coords = labels.map((label, index) => ({
    x: xAt(index),
    y: audienceY(audienceValues[index] || 0),
    value: audienceValues[index] || 0,
    label,
  }));
  let linePath = "";
  if (coords.length > 0) {
    linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let index = 1; index < coords.length; index++) {
      linePath += ` L ${coords[index].x.toFixed(1)} ${coords[index].y.toFixed(1)}`;
    }
  }
  const areaPath = coords.length > 1
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${padT + plotH} L ${coords[0].x.toFixed(1)} ${padT + plotH} Z`
    : "";
  const peakIndex = coords.reduce(
    (best, point, index) => point.value > coords[best].value ? index : best,
    0,
  );

  const labelEvery = Math.max(1, Math.ceil(labels.length / 7));
  const barSlot = plotW / labels.length;
  const barWidth = Math.max(6, Math.min(18, barSlot * 0.38));
  const barsSvg = labels.map((label, index) => {
    const value = earningsValues[index];
    const barHeight = value > 0 ? Math.max(3, (value / maxEarnings) * plotH * 0.72) : 0;
    const x = xAt(index) - barWidth / 2;
    const y = padT + plotH - barHeight;
    const tooltip = clean(earningsMap.get(label)?.tooltip || `${label}: ${value} tk`);
    return value > 0
      ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2" fill="#60a5fa" opacity="0.68"><title>${tooltip}</title></rect>`
      : "";
  }).join("");

  const audienceSvg = coords.map((point, index) => {
    if (audienceValues[index] === null) return "";
    const showLabel = index % labelEvery === 0 || index === coords.length - 1;
    const isPeak = index === peakIndex && point.value > 0;
    const tooltip = clean(audienceMap.get(point.label)?.tooltip || `${point.label}: ${point.value} espectadores`);
    return `
      ${showLabel ? `<text x="${point.x.toFixed(1)}" y="${height - 5}" text-anchor="middle" fill="#8b92b8" font-size="8" font-family="sans-serif">${clean(point.label)}</text>` : ""}
      ${isPeak ? `
        <rect x="${(point.x - 19).toFixed(1)}" y="${Math.max(1, point.y - 20).toFixed(1)}" width="38" height="14" rx="7" fill="#f97316" />
        <text x="${point.x.toFixed(1)}" y="${Math.max(11, point.y - 10).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="700" font-family="sans-serif">${point.value}</text>
      ` : ""}
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${isPeak ? 4 : 2.5}" fill="${isPeak ? "#fff" : "#ff86ad"}" stroke="#ff2a6d" stroke-width="1.2">
        <title>${tooltip}</title>
      </circle>
    `;
  }).join("");

  const showEvents = events
    .filter((event) => event.showBoundary && event.showType)
    .slice()
    .sort((a, b) => {
      const aTime = Number(a.timestamp ?? a.time) || 0;
      const bTime = Number(b.timestamp ?? b.time) || 0;
      if (aTime && bTime && aTime !== bTime) return aTime - bTime;
      return normalizeLabel(a.label).localeCompare(normalizeLabel(b.label));
    });
  const showStyle = {
    private: { label: "Privado", color: "#c084fc" },
    group: { label: "Grupo", color: "#f59e0b" },
    exclusive: { label: "Exclusivo", color: "#8b5cf6" },
    ticket: { label: "Ticket show", color: "#22d3ee" },
  };
  const openShows = new Map();
  const showSpans = [];
  const unmatchedShowEnds = [];
  showEvents.forEach((event) => {
    const open = openShows.get(event.showType) || [];
    if (event.showBoundary === "start") {
      open.push(event);
      openShows.set(event.showType, open);
      return;
    }

    const start = open.shift();
    openShows.set(event.showType, open);
    if (start) {
      showSpans.push({ start, end: event, showType: event.showType });
    } else {
      unmatchedShowEnds.push(event);
    }
  });
  openShows.forEach((open, showType) => {
    open.forEach((start) => showSpans.push({ start, end: null, showType }));
  });
  const lastLabel = labels[labels.length - 1];
  const showSpansSvg = showSpans.map((span) => {
    const startIndex = labels.indexOf(normalizeLabel(span.start.label));
    const endIndex = span.end
      ? labels.indexOf(normalizeLabel(span.end.label))
      : labels.indexOf(lastLabel);
    if (startIndex < 0 || endIndex < 0) return "";
    const style = showStyle[span.showType] || showStyle.group;
    const startX = xAt(startIndex);
    const endX = xAt(endIndex);
    const spanX = Math.min(startX, endX);
    const spanWidth = Math.max(2, Math.abs(endX - startX));
    const tooltip = [
      span.start.tooltip || `Início do show: ${style.label}`,
      span.end?.tooltip || (!span.end ? `${style.label} em andamento` : ""),
    ].filter(Boolean).map(clean).join(" • ");
    const endBorder = span.end
      ? `<line x1="${endX.toFixed(1)}" y1="${padT}" x2="${endX.toFixed(1)}" y2="${padT + plotH}" stroke="${style.color}" stroke-width="1.5" />`
      : `<line x1="${endX.toFixed(1)}" y1="${padT}" x2="${endX.toFixed(1)}" y2="${padT + plotH}" stroke="${style.color}" stroke-width="1.5" stroke-dasharray="3,3" />`;
    return `
      <rect x="${spanX.toFixed(1)}" y="${padT}" width="${spanWidth.toFixed(1)}" height="${plotH}" fill="${style.color}" fill-opacity="0.14" stroke="${style.color}" stroke-opacity="0.5" stroke-width="0.8">
        <title>${tooltip}</title>
      </rect>
      <line x1="${startX.toFixed(1)}" y1="${padT}" x2="${startX.toFixed(1)}" y2="${padT + plotH}" stroke="${style.color}" stroke-width="1.5" />
      ${endBorder}
      <text x="${((startX + endX) / 2).toFixed(1)}" y="${padT + 12}" text-anchor="middle" fill="${style.color}" font-size="9" font-weight="700" font-family="sans-serif">${style.label}</text>
    `;
  }).join("");
  const unmatchedShowEndsSvg = unmatchedShowEnds.map((event) => {
    const index = labels.indexOf(normalizeLabel(event.label));
    if (index < 0) return "";
    const style = showStyle[event.showType] || showStyle.group;
    const x = xAt(index);
    return `
      <line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" stroke="${style.color}" stroke-width="1.5" stroke-dasharray="3,3">
        <title>${clean(event.tooltip || `Fim do show: ${style.label}`)}</title>
      </line>
    `;
  }).join("");
  const showIndexes = new Set(showEvents.map((event) => labels.indexOf(normalizeLabel(event.label))));
  const eventIndexes = labels
    .map((label, index) => eventMap.has(label) && !showIndexes.has(index) ? index : -1)
    .filter((index) => index >= 0);
  const ticketIndexes = labels
    .map((label, index) =>
      (eventMap.get(label) || []).some((event) => event.type === "Ticket show") ? index : -1)
    .filter((index) => index >= 0);
  const visibleEventIndexes = [...new Set([
    ...eventIndexes.slice(0, 1),
    ...eventIndexes.slice(-1),
    ...ticketIndexes,
  ])].sort((a, b) => a - b);
  const eventSvg = visibleEventIndexes.map((index) => {
    const label = labels[index];
    const labelEvents = (eventMap.get(label) || []).filter((event) => !event.showBoundary);
    const x = xAt(index);
    if (labelEvents.length === 0) return "";
    const markerColor = "#fbbf24";
    const tooltip = [...new Set(labelEvents.map((event) =>
      clean(event.tooltip || `${event.type || "Evento"}: ${event.label}`),
    ))].join(" • ");
    return `
      <line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" stroke="${markerColor}" stroke-width="1.5" opacity="0.9" stroke-dasharray="3,4">
        <title>${tooltip}</title>
      </line>
      <circle cx="${x.toFixed(1)}" cy="${padT}" r="3" fill="${markerColor}">
        <title>${tooltip}</title>
      </circle>
    `;
  }).join("");
  const showTypes = [...new Set([
    ...showSpans.map((span) => span.showType),
    ...unmatchedShowEnds.map((event) => event.showType),
  ])];
  const hasOtherEventMarkers = events.some((event) => !event.showBoundary);

  return `
    <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:6px;">
        <strong style="color:#e2e8f0; font-size:12px;">${clean(title)}</strong>
        <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle)}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${clean(title)}" style="width:100%; height:auto; display:block;">
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.24" />
            <stop offset="100%" stop-color="#059669" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="${padL}" y1="${padT}" x2="${width - padR}" y2="${padT}" stroke="#343d58" stroke-dasharray="2,4" stroke-width="0.8" />
        <line x1="${padL}" y1="${padT + plotH / 2}" x2="${width - padR}" y2="${padT + plotH / 2}" stroke="#343d58" stroke-dasharray="2,4" stroke-width="0.8" />
        <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="#46516d" stroke-width="1" />
        ${showSpansSvg}
        ${areaPath ? `<path d="${areaPath}" fill="url(#${gradId})" />` : ""}
        ${barsSvg}
        ${unmatchedShowEndsSvg}
        ${eventSvg}
        ${coords.length > 1 ? `<path d="${linePath}" fill="none" stroke="#ff86ad" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />` : ""}
        ${audienceSvg}
      </svg>
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:4px; color:#aab3d6; font-size:9px;">
        <span><i style="display:inline-block;width:16px;height:2px;margin-right:5px;background:#ff86ad;vertical-align:middle;"></i>Público médio</span>
        <span><i style="display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:2px;background:#60a5fa;vertical-align:middle;"></i>Ganhos por intervalo</span>
        ${showTypes.map((showType) => {
          const style = showStyle[showType] || showStyle.group;
          return `<span><i style="display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:2px;background:${style.color};vertical-align:middle;"></i>${style.label}</span>`;
        }).join("")}
        ${hasOtherEventMarkers ? `<span><i style="display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#fbbf24;vertical-align:middle;"></i>Shows</span>` : ""}
      </div>
    </div>
  `;
}

export function buildAudienceLeagueChart(
  points = [],
  sessionPeak = 0,
  intervalLabel = "Média por bloco de 2 min • sessão atual",
) {
    points = Array.isArray(points) ? points : [];
    const width = 360;
    const height = 152;
    const padL = 28;
    const padR = 12;
    const padT = 20;
    const padB = 24;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const latestPoint = points[points.length - 1];
    const latestLeagueCounts = latestPoint?.leagues || {};
    const latestListedTotal = LEAGUE_CHART_ITEMS.reduce(
      (sum, league) => sum + (Number(latestLeagueCounts[league.key]) || 0),
      0,
    );
    const legend = `
      <span style="display:flex; align-items:center; gap:4px; color:#e2e8f0; white-space:nowrap;">
        <i style="width:12px; height:2px; background:#f8fafc; display:inline-block;"></i>
        Total listados
      </span>
      ${LEAGUE_CHART_ITEMS.map((league) => `
        <span style="display:flex; align-items:center; gap:4px; color:#cbd5e1; white-space:nowrap;">
          <i style="width:10px; height:7px; border-radius:2px; background:${league.color}35; border-bottom:2px solid ${league.color}; display:inline-block;"></i>
          ${league.label}
        </span>
      `).join("")}
    `;
    const latestSummary = latestPoint
      ? `
        <div style="font-size:9px; color:#cbd5e1; margin-top:6px;">
          Último bloco (${clean(latestPoint.label)}): ${Number(latestPoint.leagueSamples) > 0 ? `${latestListedTotal} listados` : "aguardando amostra por liga"} • ${Math.round(Number(latestPoint.viewers) || 0)} espectadores totais
        </div>
      `
      : `<div style="font-size:9px; color:#8b92b8; margin-top:6px;">Os dados por liga começam a ser registrados a partir das próximas amostras.</div>`;
    const peakNote = `
      <div style="font-size:9px; color:#8b92b8; margin-top:5px;">
        As áreas mostram cada liga separadamente; a linha branca e o marcador laranja mostram o total médio de listados no bloco. O pico no cabeçalho é o total de listados da sala.
      </div>
    `;

    if (points.length === 0) {
      return `
        <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px;">
            <strong style="color:#e2e8f0; font-size:12px;">📈 Total de listados por liga</strong>
            <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">Pico de espectadores: ${Math.round(Number(sessionPeak) || 0)}</span>
          </div>
          <div style="font-size:9px; color:#8b92b8; margin-bottom:2px;">${clean(intervalLabel)}</div>
          <div style="font-size:11px; color:#8b92b8; text-align:center; padding:14px 0;">Aguardando dados da transmissão para traçar a curva...</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px 12px; padding-top:7px; border-top:1px solid #2b3450; font-size:9px;">${legend}</div>
          ${latestSummary}
          ${peakNote}
        </div>
      `;
    }

    const listedValues = points.map((point) =>
      LEAGUE_CHART_ITEMS.reduce(
        (sum, league) => sum + (Number(point.leagues?.[league.key]) || 0),
        0,
      ),
    );
    const maxData = Math.max(
      1,
      ...listedValues,
      ...points.flatMap((point) =>
        LEAGUE_CHART_ITEMS.map(
          (league) => Number(point.leagues?.[league.key]) || 0,
        ),
      ),
    );
    const axisMax = Math.max(1, Math.ceil(maxData * 1.1));
    const xAt = (index) =>
      points.length === 1
        ? padL + plotW / 2
        : padL + (index / (points.length - 1)) * plotW;
    const yAt = (value) =>
      padT + plotH - (Math.max(0, value) / axisMax) * plotH;
    const areaPaths = LEAGUE_CHART_ITEMS.map((league) => {
      const values = points.map(
        (point) => Math.max(0, Number(point.leagues?.[league.key]) || 0),
      );
      if (!values.some((value) => value > 0)) return "";

      const coords = values.map((value, index) => ({
        x: xAt(index),
        y: yAt(value),
        value,
      }));
      const linePath = coords
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(" ");
      const baselineY = padT + plotH;
      const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY} L ${coords[0].x.toFixed(1)} ${baselineY} Z`;
      const markers = coords
        .map((point, index) => `
          <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.3" fill="${league.color}" stroke="#151a2d" stroke-width="0.7">
            <title>${clean(`${points[index].label}: ${league.label} ${Math.round(point.value)} pessoas`)}</title>
          </circle>
        `)
        .join("");

      return `
        <path d="${areaPath}" fill="${league.color}" fill-opacity="0.13" />
        <path d="${linePath}" fill="none" stroke="${league.color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" />
        ${markers}
      `;
    }).join("");

    const listedCoords = points.map((point, index) => ({
      x: xAt(index),
      y: yAt(listedValues[index]),
      value: Math.round(listedValues[index]),
      label: point.label,
      viewers: Math.round(Number(point.viewers) || 0),
    }));
    const peakIndex = listedCoords.reduce(
      (bestIndex, point, index, coords) =>
        point.value > coords[bestIndex].value ? index : bestIndex,
      0,
    );
    const listedPath = listedCoords
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");

    const labelEvery = Math.max(1, Math.ceil(listedCoords.length / 6));
    const grid = [0, 0.5, 1]
      .map((fraction) => {
        const y = padT + plotH * (1 - fraction);
        const value = Math.round(axisMax * fraction);
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#343d58" stroke-dasharray="2,4" stroke-width="0.8" />
          <text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#8b92b8" font-size="7.5" font-family="sans-serif">${value}</text>
        `;
      })
      .join("");
    const listedMarkers = listedCoords
      .map((point, index) => {
        const isPeak = index === peakIndex && point.value > 0;
        const showLabel = index % labelEvery === 0 || index === listedCoords.length - 1;
        const bubbleX = Math.max(padL, Math.min(width - padR - 38, point.x - 19));
        const leagueTooltip = LEAGUE_CHART_ITEMS
          .map((league) => `${league.label} ${Math.round(Number(points[index].leagues?.[league.key]) || 0)}`)
          .join(" • ");
        const tooltip = clean(`${point.label}: ${point.value} listados • ${point.viewers} espectadores totais • ${leagueTooltip}`);
        return `
          <g>
            ${isPeak ? `
              <rect x="${bubbleX.toFixed(1)}" y="${Math.max(1, point.y - 20).toFixed(1)}" width="38" height="14" rx="7" fill="#d97706" />
              <text x="${(bubbleX + 19).toFixed(1)}" y="${Math.max(11, point.y - 10).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="bold" font-family="sans-serif">${point.value}</text>
              <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="#fff" stroke="#00e5ff" stroke-width="2">
                <title>${tooltip}</title>
              </circle>
            ` : ""}
            ${showLabel ? `<text x="${point.x.toFixed(1)}" y="${height - 4}" text-anchor="middle" fill="#8b92b8" font-size="8" font-family="sans-serif">${clean(point.label)}</text>` : ""}
            ${isPeak ? "" : `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.5" fill="#f8fafc">
              <title>${tooltip}</title>
            </circle>`}
          </g>
        `;
      })
      .join("");
    return `
      <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px;">
          <strong style="color:#e2e8f0; font-size:12px;">📈 Total de listados por liga</strong>
          <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">Pico de espectadores: ${Math.round(Number(sessionPeak) || 0)}</span>
        </div>
        <div style="font-size:9px; color:#8b92b8; margin-bottom:2px;">${clean(intervalLabel)}</div>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Áreas independentes por liga e linha do total de usuários listados" style="width:100%; height:auto; display:block;">
          ${grid}
          ${areaPaths}
          <path d="${listedPath}" fill="none" stroke="#f8fafc" stroke-width="2.6" stroke-linecap="round" style="filter:drop-shadow(0 0 2px #00e5ff);" />
          ${listedMarkers}
        </svg>
        <div style="display:flex; flex-wrap:wrap; gap:5px 11px; padding-top:7px; border-top:1px solid #2b3450; font-size:9px;">
          ${legend}
        </div>
        ${latestSummary}
        ${peakNote}
      </div>
    `;
  }

export function buildInteractiveBarsSvg({
  title,
  subtitle,
  bars,
  showCumulative = true,
  unitLabel = "tk",
  variant = "default",
}) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return `
      <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:6px;">
          <strong style="color:#e2e8f0; font-size:12px;">${clean(title)}</strong>
          <span style="font-size:10px; color:#a5b4fc; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle || "")}</span>
        </div>
        <div style="font-size:11px; color:#8b92b8; text-align:center; padding:12px 0;">Sem dados suficientes neste recorte.</div>
      </div>
    `;
  }

  const width = 360;
  const height = 122;
  const padL = 6;
  const padR = 6;
  const showValueLabels = bars.length <= 8;
  const padT = showValueLabels ? 23 : 14;
  const padB = 20;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(1, ...bars.map((bar) => Number(bar.value) || 0));
  const gap = bars.length > 24 ? 2 : 4;
  const calculatedBarW = (plotW - gap * (bars.length - 1)) / bars.length;
  const maxBarW = bars.length === 1 ? 96 : bars.length <= 4 ? 72 : 48;
  const barW = Math.max(4, Math.min(calculatedBarW, maxBarW));
  const barsWidth = barW * bars.length + gap * (bars.length - 1);
  const barsStart = padL + (plotW - barsWidth) / 2;
  const labelEvery = bars.length <= 10 ? 1 : Math.ceil(bars.length / 8);
  const barGradId = `scm-bargrad-${Math.random().toString(36).slice(2, 8)}`;
  const chartStyle = {
    default: { start: "#60a5fa", end: "#818cf8", track: "#252d45", accent: "#a5b4fc" },
    sunset: { start: "#fb7185", end: "#f97316", track: "#38263a", accent: "#fda4af" },
    mint: { start: "#2dd4bf", end: "#0ea5e9", track: "#1d3540", accent: "#5eead4" },
    violet: { start: "#c084fc", end: "#7c3aed", track: "#302744", accent: "#d8b4fe" },
    amber: { start: "#fbbf24", end: "#f97316", track: "#3a3023", accent: "#fcd34d" },
    rose: { start: "#f472b6", end: "#be185d", track: "#3a2438", accent: "#f9a8d4" },
  }[variant] || {
    start: "#60a5fa",
    end: "#818cf8",
    track: "#252d45",
    accent: "#a5b4fc",
  };
  let cumulative = 0;
  const barsSvg = bars
    .map((bar, index) => {
      const value = Math.round(Number(bar.value) || 0);
      cumulative += value;
      const barH = value > 0 ? Math.max(5, Math.round((value / maxVal) * plotH)) : 0;
      const x = barsStart + index * (barW + gap);
      const y = padT + (plotH - barH);
      const showLabel = index % labelEvery === 0 || index === bars.length - 1;

      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${padT}" width="${barW.toFixed(1)}" height="${plotH}" rx="4" fill="${chartStyle.track}" opacity="0.9" />
          ${
            value > 0
              ? `<rect x="${x.toFixed(1)}" y="${y}" width="${barW.toFixed(1)}" height="${barH}" rx="3" fill="url(#${barGradId})">
                  <title>${clean(bar.tooltip || `${bar.label}: ${value}${unitLabel}`)}${showCumulative ? ` | Acumulado: ${cumulative} ${unitLabel}` : ""}</title>
                </rect>`
              : ""
          }
          ${
            showValueLabels && value > 0
              ? `<text x="${(x + barW / 2).toFixed(1)}" y="${Math.max(10, y - 4)}" text-anchor="middle" fill="#e2e8f0" font-size="8.5" font-weight="700" font-family="sans-serif">${clean(bar.displayValue || value.toLocaleString("pt-BR"))}</text>`
              : ""
          }
          ${
            showLabel
              ? `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 4}" text-anchor="middle" fill="#8b92b8" font-size="8.5" font-family="sans-serif">${clean(bar.label)}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");

  return `
    <div class="scm-cyber-card" style="border:1px solid #2b3450; border-radius:12px; background:linear-gradient(145deg,#1b2138,#151a2d);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:6px;">
        <strong style="color:${chartStyle.accent}; font-size:12px;">${clean(title)}</strong>
        <span style="font-size:10px; color:${chartStyle.accent}; background:#222a41; padding:3px 8px; border-radius:99px;">${clean(subtitle || "")}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
        <defs>
          <linearGradient id="${barGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${chartStyle.start}" />
            <stop offset="100%" stop-color="${chartStyle.end}" />
          </linearGradient>
        </defs>
        ${barsSvg}
      </svg>
    </div>
  `;
}
