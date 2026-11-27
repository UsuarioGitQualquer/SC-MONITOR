import { clean } from "../../utils/helpers.js";
import { formatHistoryDate } from "../report-data.js";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatStorageBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

export function getCurrentLocalDateKey(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildHistoryTableHtml(history = {}, modelSizes = {}, todayKey = getCurrentLocalDateKey()) {
  const keys = Object.keys(history).filter((entryKey) => {
    const room = history[entryKey];
    const dateKey = String(room?.dateKey || entryKey.split("::").at(-1) || "");
    return dateKey === todayKey;
  }).sort((a, b) => {
    const dateA = String(history[a]?.dateKey || "");
    const dateB = String(history[b]?.dateKey || "");
    return dateB.localeCompare(dateA);
  });

  if (keys.length === 0) {
    return `<tr><td colspan="5" style="text-align:center; color:#8b92b8; padding: 16px;">Nenhuma sala salva hoje.</td></tr>`;
  }

  return keys
    .map((entryKey) => {
      const room = history[entryKey];
      const livesBadge =
        room.livesCount > 0
          ? `<div style="font-size: 9.5px; color: #8b92b8; margin-top: 3px;">${room.livesCount} live(s)${room.firstLiveStart ? ` • ${clean(room.firstLiveStart)} - ${clean(room.lastLiveEnd || "ativa")}` : ""}</div>`
          : "";

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #fff;">${clean(room.modelName || room.modelId)}</div>
            ${modelSizes[String(room.modelId || "").trim()] !== undefined
              ? `<div style="font-size: 9.5px; color: #8b92b8; margin-top: 3px;">Dados gravados: ${formatStorageBytes(modelSizes[String(room.modelId || "").trim()])}</div>`
              : ""}
            ${livesBadge}
          </td>
          <td>${clean(formatHistoryDate(room))}</td>
          <td>${clean(room.peakViewers || 0)} <span style="color:#8b92b8;">(${clean(room.avgViewers || 0)})</span></td>
          <td><strong style="color:#00e5ff;">${clean(room.totalTokens || 0)} tk</strong></td>
          <td style="white-space: nowrap;">
            <button class="scm-view-report" data-key="${escapeAttribute(entryKey)}" style="background:linear-gradient(90deg, #00e5ff, #2563eb); padding:4px 8px; font-size:10.5px; border:0; color:#0f1024; border-radius:6px; cursor:pointer; margin-right:4px; font-weight:bold;">Relatório</button>
            <button class="scm-del-room" data-key="${escapeAttribute(entryKey)}" style="background:#ff2a6d; padding:4px 8px; font-size:10.5px; border:0; color:#fff; border-radius:6px; cursor:pointer; font-weight:bold;">Apagar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}
