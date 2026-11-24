import { clean } from "../../utils/helpers.js";

const TRANSLATABLE_EVENT_LABELS = new Set([
  "Gorjeta Avulsa",
  "Menu",
  "Show em Grupo",
  "Show Privado",
  "Show Exclusivo",
  "Ticket",
  "Roleta",
]);

function getMenuItemName(itemName) {
  const label = String(itemName || "").trim();
  const match = label.match(
    /^(?:men[uú]\s+de\s+(?:gorjetas|propinas)|tip\s+menu|menu\s+tip)\s*[:>›»→\-–—]\s*(.+)$/i,
  );
  return match ? match[1].trim() : label;
}

function isGenericMenuItem(itemName) {
  return /^(?:men[uú](?:\s+de\s+(?:gorjetas|propinas))?|tip\s+menu|menu\s+tip|gorjeta\s+avulsa|—)$/i
    .test(String(itemName || "").trim());
}

function getRouletteItemName(itemName) {
  return String(itemName || "")
    .replace(/^(?:resultado da\s+)?(?:roleta|roulette|wheel|spin)\s*[:>›»→\-–—]\s*/i, "")
    .trim();
}

function isGenericRouletteItem(itemName) {
  return /^(?:roleta|roulette|wheel|spin|resultado da roleta|—)$/i
    .test(String(itemName || "").trim());
}

export function buildEventSummaryHtml({
  summaryMap = {},
  events = [],
  scope,
  buildGainTypeChart,
}) {
  const scopeButtonsHtml = `
    <div style="display:flex; gap:4px; flex-shrink:0;">
      <button type="button" class="scm-event-scope-btn" data-scope="session" style="background:${scope === "session" ? "linear-gradient(90deg,#00e5ff,#2563eb)" : "#23264d"}; color:${scope === "session" ? "#0f1024" : "#8b92b8"}; border:0; padding:3px 7px; border-radius:99px; font-size:10px; font-weight:bold; cursor:pointer;">Sessão</button>
      <button type="button" class="scm-event-scope-btn" data-scope="day" style="background:${scope === "day" ? "linear-gradient(90deg,#ff2a6d,#ff7b00)" : "#23264d"}; color:${scope === "day" ? "#fff" : "#8b92b8"}; border:0; padding:3px 7px; border-radius:99px; font-size:10px; font-weight:bold; cursor:pointer;">Dia</button>
    </div>
  `;
  const header = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; border-bottom:1px solid #272952; padding-bottom:6px;">
      ${scopeButtonsHtml}
      <div style="font-weight:600; color:#ff7b00; font-size:12px;">📊 Resumo Consolidado por Item</div>
    </div>
  `;

  if (Object.keys(summaryMap).length === 0) {
    return `${header}
      <div style="color: #8b92b8; font-style: italic; font-size: 11px;">Nenhum evento capturado ainda.</div>
    `;
  }

  const consolidatedSummary = new Map();
  Object.entries(summaryMap).forEach(([itemName, data]) => {
    const menuItemName = getMenuItemName(itemName);
    const rouletteItemName = getRouletteItemName(itemName);
    const isMenu =
      String(data?.type || "").toLowerCase().includes("menu") ||
      itemName.toLowerCase().includes("menu de gorjetas");
    const isRoulette =
      /roleta|roulette|wheel|spin/i.test(String(data?.type || "")) ||
      /roleta|roulette|wheel|spin/i.test(itemName);
    const key = isMenu
      ? isGenericMenuItem(menuItemName)
        ? "Menu"
        : `${menuItemName.replace(/\s+\(menu\)$/i, "")} (Menu)`
      : isRoulette
        ? isGenericRouletteItem(rouletteItemName)
          ? "Roleta"
          : `${rouletteItemName.replace(/\s+\(roleta\)$/i, "")} (Roleta)`
        : menuItemName;
    const existing = consolidatedSummary.get(key) || {
      count: 0,
      tokens: 0,
      type: data?.type || "Geral",
    };
    existing.count += Number(data?.count) || 0;
    existing.tokens += Number(data?.tokens) || 0;
    consolidatedSummary.set(key, existing);
  });

  const rowsHtml = Array.from(consolidatedSummary.entries())
    .sort((a, b) => (Number(b[1]?.tokens) || 0) - (Number(a[1]?.tokens) || 0))
    .map(([itemName, data]) => {
      let displayName = itemName;
      const isMenuItem = String(data?.type || "").toLowerCase().includes("menu");
      const isRouletteItem = /roleta|roulette|wheel|spin/i.test(String(data?.type || ""));
      if (itemName.toLowerCase().includes("gorjeta avulsa")) {
        displayName = "Gorjeta Avulsa";
      } else if (itemName.toLowerCase() === "menu") {
        displayName = "Menu";
      } else if (itemName.toLowerCase() === "roleta") {
        displayName = "Roleta";
      } else if (
        itemName !== "Show em Grupo" &&
        itemName !== "Show Privado" &&
        itemName !== "Show Exclusivo" &&
        itemName !== "Ticket" &&
        !isRouletteItem
      ) {
        displayName = isMenuItem ? itemName : `${itemName} (${data.type})`;
      }

      return `
        <tr>
          <td style="word-break: break-word; color: #f8fafc;">${TRANSLATABLE_EVENT_LABELS.has(displayName) ? `<span data-scm-i18n>${clean(displayName)}</span>` : clean(displayName)}</td>
          <td style="text-align: center; white-space: nowrap; color: #ff7b00;">${Number(data.count) || 0}x</td>
          <td style="text-align: right; white-space: nowrap; font-weight: bold; color: #00e5ff;">${Number(data.tokens) || 0} tk</td>
        </tr>
      `;
    })
    .join("");

  const gainTypeChartHtml = buildGainTypeChart(summaryMap, events);
  return `
    ${header}
    <div class="scroll" style="height: 140px; min-height: 70px;">
      <table>
        <thead>
          <tr>
            <th>Item / Pedido</th>
            <th style="text-align: center;">Qtd</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${gainTypeChartHtml ? `<div style="margin-top:10px;">${gainTypeChartHtml}</div>` : ""}
  `;
}
