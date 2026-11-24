import { clean } from "../utils/helpers.js";
import { buildEventSummaryHtml } from "./dashboard/event-summary.js";

function getSummaryKeyForEvent(item, type, menuOption = "", rouletteOutcome = "") {
  const label = String(menuOption || item || "—").trim();
  const typeText = String(type || "").toLowerCase();
  const combined = `${typeText} ${label}`.toLowerCase();
  if (/menu|tip menu/.test(typeText) || /menu de gorjetas|tip menu|menu tip/i.test(label)) {
    const optionMatch = label.match(
      /^(?:men[uú]\s+de\s+(?:gorjetas|propinas)|tip\s+menu|menu\s+tip)\s*[:>›»→\-–—]\s*(.+)$/i,
    );
    const menuItem = optionMatch ? optionMatch[1].trim() : label;
    if (/^(?:men[uú](?:\s+de\s+(?:gorjetas|propinas))?|tip\s+menu|menu\s+tip|gorjeta\s+avulsa|—)$/i.test(menuItem)) {
      return "Menu";
    }
    return menuItem;
  }
  if (/roleta|roulette|wheel|spin/i.test(typeText) || rouletteOutcome) {
    const outcome = String(rouletteOutcome || label)
      .replace(/^(?:roleta|roulette|wheel|spin)\s*[:>›»→\-–—]\s*/i, "")
      .trim();
    if (/^(?:roleta|roulette|wheel|spin|resultado da roleta|—)$/i.test(outcome)) return "Roleta";
    return outcome;
  }
  if (/ingresso|ticket/i.test(combined)) return "Ticket";
  if (/show em grupo|grupo/i.test(combined)) return "Show em Grupo";
  if (/show privado|privado/i.test(combined)) return "Show Privado";
  if (/show exclusivo|exclusivo/i.test(combined)) return "Show Exclusivo";
  if (/gorjeta avulsa/i.test(combined)) return "Gorjeta Avulsa";
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Geral";
}

function restoreNamedSummaryItems(summary, bucket, options) {
  const namedTotals = Object.entries(bucket?.[options.totalsKey] || {})
    .filter(([, total]) => (Number(total?.count) || 0) > 0 || (Number(total?.tokens) || 0) > 0);
  if (namedTotals.length === 0) return;

  let totalCount = 0;
  let totalTokens = 0;
  Object.entries(summary).forEach(([key, data]) => {
    if (!options.isCategory(key, data)) return;
    totalCount += Number(data?.count) || 0;
    totalTokens += Number(data?.tokens) || 0;
    delete summary[key];
  });

  let namedCount = 0;
  let namedTokens = 0;
  namedTotals.forEach(([key, total]) => {
    const label = String(total?.label || key).trim();
    const count = Number(total?.count) || 0;
    const tokens = Number(total?.tokens) || 0;
    namedCount += count;
    namedTokens += tokens;
    summary[label] = {
      count: (Number(summary[label]?.count) || 0) + count,
      tokens: (Number(summary[label]?.tokens) || 0) + tokens,
      type: options.type,
    };
  });

  const remainingCount = Math.max(0, totalCount - namedCount);
  const remainingTokens = Math.max(0, totalTokens - namedTokens);
  if (remainingCount > 0 || remainingTokens > 0) {
    summary[options.label] = {
      count: remainingCount,
      tokens: remainingTokens,
      type: options.type,
    };
  }
}

function buildDailyEventSummaryMap(bucket, fallbackSummary = {}) {
  const summary = { ...(bucket?.eventSummaryTotals || fallbackSummary) };
  Object.entries(summary).forEach(([key, data]) => {
    const isTicketShowMarker =
      /^ticket show$/i.test(key) || /^ticket show$/i.test(String(data?.type || ""));
    if (isTicketShowMarker && (Number(data?.tokens) || 0) <= 0) delete summary[key];
  });
  restoreNamedSummaryItems(summary, bucket, {
    totalsKey: "menuOptionTotals",
    type: "Menu de Gorjetas",
    label: "Menu",
    isCategory: (key, data) =>
      key.toLowerCase() === "menu" ||
      String(data?.type || "").toLowerCase().includes("menu") ||
      /menu de gorjetas/i.test(key),
  });
  restoreNamedSummaryItems(summary, bucket, {
    totalsKey: "rouletteOutcomeTotals",
    type: "Resultado da Roleta",
    label: "Roleta",
    isCategory: (key, data) =>
      key.toLowerCase() === "roleta" ||
      /roleta|roulette|wheel|spin/i.test(String(data?.type || "")),
  });
  return summary;
}

const TRANSLATABLE_EVENT_LABELS = new Set([
  "Gorjeta Avulsa",
  "Ingresso Ticket",
  "Compra de Ingresso",
  "Menu de Gorjetas",
  "Objetivo Épico",
  "Compra de Conteúdo",
  "Show em Grupo",
  "Show Privado",
  "Show Exclusivo",
  "Ticket",
]);

export function buildEventSummaryMap(events) {
  const summary = {};
  (Array.isArray(events) ? events : []).forEach((event) => {
    const amount = Number(event?.price ?? event?.tokens) || 0;
    if (amount <= 0) return;
    const key = getSummaryKeyForEvent(
      event?.item,
      event?.type,
      event?.menuOption,
      event?.rouletteOutcome,
    );
    if (!summary[key]) {
      summary[key] = { count: 0, tokens: 0, type: event?.type || "Geral" };
    }
    summary[key].count += 1;
    summary[key].tokens += amount;
  });
  return summary;
}

export function getConsolidatedEventScopeData(state, scope, dateKey) {
  if (scope === "session") {
    const todayBucket = state.dailyBuckets?.[dateKey] || {};
    const currentSegment = todayBucket.liveSessions?.[state.sessionId];
    if (Array.isArray(currentSegment?.capturedEvents) && currentSegment.capturedEvents.length > 0) {
      return {
        summaryMap: buildEventSummaryMap(currentSegment.capturedEvents),
        events: currentSegment.capturedEvents,
      };
    }

    const sessionStartedAt = Number(state._sessionStartedAtTs) || 0;
    const events = (Array.isArray(state.capturedEvents) ? state.capturedEvents : [])
      .filter((event) => {
        const eventTs = Number(event?.timestamp ?? event?.time) || 0;
        return sessionStartedAt > 0 ? eventTs >= sessionStartedAt : true;
      });
    return { summaryMap: buildEventSummaryMap(events), events };
  }

  const bucket = state.dailyBuckets?.[dateKey];
  return {
    summaryMap: buildDailyEventSummaryMap(bucket, state.eventSummaryTotals || {}),
    events: Array.isArray(bucket?.capturedEvents)
      ? bucket.capturedEvents
      : (Array.isArray(state.capturedEvents) ? state.capturedEvents : []),
  };
}

export function filterEvents(events, filterMode) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (!event || event.showBoundary === "end") return false;
    const typeLower = String(event.type || "").toLowerCase();
    const itemLower = String(event.item || "").toLowerCase();
    const eventAmount = Number(event.price ?? event.tokens) || 0;
    if (typeLower === "ticket show" && eventAmount <= 0) return false;
    if (filterMode === "tips") {
      return typeLower.includes("gorjeta") || typeLower.includes("tip") || itemLower.includes("gorjeta");
    }
    if (filterMode === "menu") {
      return (
        typeLower.includes("menu") ||
        typeLower.includes("pedido") ||
        Boolean(event.menuOption)
      );
    }
    if (filterMode === "goals") {
      return (
        typeLower.includes("meta") ||
        typeLower.includes("goal") ||
        typeLower.includes("objetivo") ||
        typeLower.includes("epic") ||
        typeLower.includes("show") ||
        typeLower.includes("ticket")
      );
    }
    return true;
  });
}

export function createPanelEventsController({
  getPanel,
  getState,
  localDateKey,
  buildGainTypeChart,
  buildTopDonorsChart,
}) {
  let filterMode = "all";
  let scope = "day";

  function getScopeData() {
    return getConsolidatedEventScopeData(getState(), scope, localDateKey());
  }

  function syncFilterButtons() {
    const panel = getPanel();
    if (!panel) return;
    panel.querySelectorAll(".scm-event-filter-btn").forEach((button) => {
      if (button.getAttribute("data-filter") === filterMode) {
        button.style.background = "linear-gradient(90deg, #00e5ff, #2563eb)";
        button.style.color = "#0f1024";
        button.style.border = "0";
      } else {
        button.style.background = "#23264d";
        button.style.color = "#8b92b8";
        button.style.border = "0";
      }
    });
  }

  function renderEventsTable() {
    const panel = getPanel();
    if (!panel) return;
    const wheelEl = panel.querySelector("#scm-wheel");
    if (!wheelEl) return;

    const events = getScopeData().events;
    const filtered = filterEvents(events, filterMode);
    if (filtered.length === 0) {
      wheelEl.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#8b92b8; padding: 16px;">Nenhum evento encontrado neste filtro.</td></tr>`;
      return;
    }

    wheelEl.innerHTML = [...filtered]
      .reverse()
      .map((event) => {
        let itemWithUser = clean(event.item);
        const isTicket = /ingresso|ticket/i.test(String(event.type)) || /compra de ingresso/i.test(itemWithUser);

        if (!isTicket && event.user && event.user !== "—" && !itemWithUser.includes(`(${clean(event.user)})`)) {
          itemWithUser = `${itemWithUser} (${clean(event.user)})`;
        }

        let itemHtml = itemWithUser;
        const ticketItemMatch = isTicket && itemWithUser.match(/^Compra de Ingresso(?:\s+\((.*)\))?$/i);
        if (ticketItemMatch) {
          itemHtml = `<span data-scm-i18n>Compra de Ingresso</span>${ticketItemMatch[1] ? ` (${clean(ticketItemMatch[1])})` : ""}`;
        }
        const typeHtml = TRANSLATABLE_EVENT_LABELS.has(String(event.type || ""))
          ? `<span data-scm-i18n>${clean(event.type)}</span>`
          : clean(event.type);
        return `<tr><td>${itemHtml}</td><td><strong style="color:#00e5ff;">${clean(event.price)} tk</strong></td><td>${typeHtml}</td></tr>`;
      })
      .join("");
  }

  function renderEventSummary() {
    const panel = getPanel();
    if (!panel) return;
    let container = panel.querySelector("#scm-event-summary-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "scm-event-summary-container";
      container.className = "scm-cyber-card";
      container.style.cssText = "margin-top: 12px; margin-bottom: 14px;";

      const targetArea = panel.querySelector("#scm-tab-events");
      if (targetArea) targetArea.insertBefore(container, targetArea.firstChild);
    }

    const scopeData = getScopeData();
    const summaryMap = scopeData.summaryMap || {};
    const newContent = buildEventSummaryHtml({
      summaryMap,
      events: scopeData.events,
      scope,
      buildGainTypeChart,
    });

    if (Object.keys(summaryMap).length === 0) {
      container.innerHTML = newContent;
      bindSummaryScopeButtons(container);
      return;
    }

    const existingScroll = container.querySelector(".scroll");
    const savedHeight = existingScroll ? existingScroll.style.height : null;
    container.innerHTML = newContent;
    if (savedHeight) {
      const newScroll = container.querySelector(".scroll");
      if (newScroll) newScroll.style.height = savedHeight;
    }
    bindSummaryScopeButtons(container);
  }

  function renderTopTokenUsers() {
    const panel = getPanel();
    if (!panel) return;
    let container = panel.querySelector("#scm-event-users-tokens-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "scm-event-users-tokens-container";
      container.className = "scm-cyber-card";
      container.style.cssText = "margin-top: 12px; margin-bottom: 14px;";

      const targetArea = panel.querySelector("#scm-tab-events");
      if (targetArea) {
        const summaryEl = targetArea.querySelector("#scm-event-summary-container");
        if (summaryEl && summaryEl.nextSibling) {
          targetArea.insertBefore(container, summaryEl.nextSibling);
        } else {
          targetArea.appendChild(container);
        }
      }
    }

    const state = getState();
    const scopeData = getScopeData();
    const donorsMap = new Map();
    scopeData.events.forEach((event) => {
      const name = String(event?.user || "").trim();
      const tokens = Number(event?.price ?? event?.tokens) || 0;
      if (!name || name === "—" || tokens <= 0) return;
      const previous = donorsMap.get(name) || { name, tokens: 0, tips: 0, isListed: false };
      previous.tokens += tokens;
      previous.tips += 1;
      const liveUser = Object.values(state.users || {}).find(
        (user) => String(user?.name || "").toLowerCase() === name.toLowerCase()
      );
      previous.isListed = Boolean(liveUser?.isListed);
      donorsMap.set(name, previous);
    });
    const usersWithTokens = Array.from(donorsMap.values())
      .sort((a, b) => b.tokens - a.tokens);

    if (usersWithTokens.length === 0) {
      container.innerHTML = `
        <div style="font-weight: 600; color: #00e5ff; margin-bottom: 4px; font-size: 12px;">🏆 Tokens por Usuário</div>
        <div style="color: #8b92b8; font-style: italic; font-size: 11px;">Nenhum usuário com tokens registrados ainda.</div>
      `;
      return;
    }

    const usersTokensSum = usersWithTokens.reduce(
      (acc, user) => acc + (Number(user.tokens) || 0),
      0
    );
    const displayTotal = usersTokensSum;
    const totalTipsSum = usersWithTokens.reduce(
      (acc, user) => acc + (Number(user.tips) || 0),
      0
    );
    const avgPerTip = totalTipsSum > 0 ? Math.round(displayTotal / totalTipsSum) : 0;
    const rowsHtml = usersWithTokens
      .map((user, idx) => {
        const statusDot = user.isListed
          ? `<span style="color: #00e5ff;" title="Presente na lista da sala">●</span>`
          : `<span style="color: #475569;" title="Ausente da lista atual">○</span>`;
        const tipsCount = Number(user.tips) || 0;
        const tokensVal = Number(user.tokens) || 0;

        return `
          <tr>
            <td style="white-space: nowrap; color: #8b92b8;">#${idx + 1}</td>
            <td style="word-break: break-word; color: #f8fafc;">${statusDot} ${clean(user.name)}</td>
            <td style="text-align: center; white-space: nowrap; color: #ff7b00;">${tipsCount}x</td>
            <td style="text-align: right; white-space: nowrap; font-weight: bold; color: #00e5ff;">${tokensVal} tk</td>
          </tr>
        `;
      })
      .join("");

    const subBadgeText = `${scope === "session" ? "Sessão" : "Hoje"}: ${displayTotal} tk • Méd ${avgPerTip}/gorjeta`;

    const newContent = `
      <div style="font-weight: 600; color: #00e5ff; margin-bottom: 8px; border-bottom: 1px solid #272952; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px;">
        <span>🏆 Tokens por Usuário (${usersWithTokens.length})</span>
        <span style="font-size: 10px; color: #0f1024; font-weight: bold; background: #00e5ff; padding: 2px 8px; border-radius: 99px; white-space: nowrap;">${clean(subBadgeText)}</span>
      </div>
      <div class="scroll" style="height: 150px; min-height: 70px;">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Usuário</th>
              <th style="text-align: center;">Gorjetas</th>
              <th style="text-align: right;">Tokens</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;">${buildTopDonorsChart(6, scopeData.events)}</div>
    `;

    const existingScroll = container.querySelector(".scroll");
    const savedHeight = existingScroll ? existingScroll.style.height : null;
    container.innerHTML = newContent;
    if (savedHeight) {
      const newScroll = container.querySelector(".scroll");
      if (newScroll) newScroll.style.height = savedHeight;
    }
  }

  function bindSummaryScopeButtons(container) {
    container.querySelectorAll(".scm-event-scope-btn").forEach((button) => {
      button.onclick = () => {
        scope = button.getAttribute("data-scope") === "session" ? "session" : "day";
        renderEventsTable();
        renderEventSummary();
        renderTopTokenUsers();
      };
    });
  }

  function setFilter(nextFilter) {
    filterMode = nextFilter || "all";
    syncFilterButtons();
    renderEventsTable();
  }

  function onTabSelected() {
    syncFilterButtons();
    renderEventsTable();
  }

  return {
    onTabSelected,
    renderEventSummary,
    renderEventsTable,
    renderTopTokenUsers,
    setFilter,
  };
}
