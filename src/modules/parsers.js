import { txt, num, time } from "../utils/helpers.js";
import {
  state,
  isIgnoredUser,
  userRecord,
  getMonitoring,
  ensureDailyBucket,
  localDateKey,
} from "../core/state.js";
import { saveToGlobalHistory } from "../core/persistence.js";
import { requestUIRefresh, UI_REFRESH } from "../core/ui-refresh.js";
import { resolveRoomKing } from "../core/room-king.js";

function normalizeCoreTodoText(rawText) {
  return String(rawText || "")
    .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "")
    .replace(/\s*\[[^\]]+\]\s*$/, "")
    .replace(/\s*\([^)]+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseRoomKingTokens(text = "") {
  const normalizedText = String(text || "").replace(/\u00a0/g, " ");
  const patterns = [
    /\b(?:deu|doou|gave|donated|dio|don[oó])\s+([\d.,]+)\s*(?:tk|tokens?)\b/i,
    /([\d.,]+)\s*(?:tk|tokens?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) return num(match[1]) || 0;
  }
  return 0;
}

export function parseRoomKing() {
  const kingEl = document.querySelector(
    "#view_cam_info_king, .view-cam-info-king",
  );
  const text = txt(kingEl);
  const thresholdElement = kingEl?.querySelector(".king-threshold");
  const thresholdMatch = text.match(/d[\u00ea]\s+([\d.,]+)\s*tk/i);
  const threshold = num(thresholdElement?.textContent || thresholdMatch?.[1]) || 0;
  const thresholdShown =
    Boolean(thresholdElement) ||
    /d[\u00ea]\s+[\d.,]+\s*tk|seja o primeiro/i.test(text);
  const nameElement = kingEl?.querySelector(
    ".user-levels-username-text, [class*='username'], [class*='name'], a",
  );
  let name = thresholdShown
    ? ""
    : txt(nameElement) || text.replace(/^rei da sala\s*:?\s*/i, "").trim();
  if (isIgnoredUser(name)) name = "";

  let siteTokens = 0;
  if (name) {
    const normalizedName = name.toLowerCase();
    const tooltipTexts = [];
    const tooltipAttributes = [
      "title",
      "aria-label",
      "data-tooltip",
      "data-tooltip-content",
      "data-original-title",
      "data-content",
    ];
    const collectTooltipAttributes = (element) => {
      tooltipAttributes.forEach((attribute) => {
        const value = element?.getAttribute?.(attribute);
        if (value) tooltipTexts.push(value);
      });
    };

    collectTooltipAttributes(kingEl);
    if (kingEl) {
      kingEl
        .querySelectorAll("[title], [aria-label], [data-tooltip], [data-tooltip-content], [data-original-title], [data-content]")
        .forEach(collectTooltipAttributes);
    }

    const popovers = document.querySelectorAll(
      ".popover, .tooltip, [class*='popover'], [class*='tooltip'], [role='tooltip'], [data-testid='king-wrapper-popover']",
    );

    for (const element of popovers) {
      const tooltipText = txt(element);
      collectTooltipAttributes(element);
      if (!tooltipText.toLowerCase().includes(normalizedName)) continue;
      siteTokens = parseRoomKingTokens(tooltipText);
      if (siteTokens > 0) break;
    }

    if (siteTokens <= 0) {
      for (const tooltipText of tooltipTexts) {
        if (!tooltipText.toLowerCase().includes(normalizedName)) continue;
        siteTokens = parseRoomKingTokens(tooltipText);
        if (siteTokens > 0) {
          break;
        }
      }
    }
  }

  const today = localDateKey();
  const daily = ensureDailyBucket(today);
  const previous = state.kingStateDate === today
    ? {
        name: state.roomKingName,
        tokens: state.kingTokens,
        source: state.kingTokensSource,
      }
    : {};
  const king = resolveRoomKing({
    currentName: name,
    siteTokens,
    threshold,
    chatTotals: daily.kingChatTotals,
    previous,
  });

  state.roomKingName = king.name;
  state.kingTokens = king.tokens;
  state.kingSiteTokens = king.siteTokens;
  state.kingTokensSource = king.source;
  state.kingThreshold = king.threshold;
  state.kingStateDate = today;
  state.roomKing = king.name
    ? king.tokens > 0
      ? `${king.name} (${king.tokens} tk)`
      : king.name
    : "Nenhum";

  if (king.name) {
    const user = userRecord(king.name);
    if (user) user.lastSeen = time();
  }
  return state.roomKing;
}

export function getGroupShowKind(text = "", iconHref = "") {
  const icon = String(iconHref || "").toLowerCase();
  if (/(?:icons?[-_])ticket(?:[-_]|$)/i.test(icon)) return "ticket";
  if (/(?:icons?[-_])group(?:[-_]|$)/i.test(icon)) return "group";

  const normalizedText = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\b(ticket|bilhetes?|ingressos?|boletos?|entradas?)\b/.test(normalizedText)) {
    return "ticket";
  }
  if (/\b(grupo|grupal|group)\b/.test(normalizedText)) return "group";
  return "unknown";
}

export function parseShowParticipantsCount(text = "") {
  const normalizedText = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, "");
  const patterns = [
    /([\d.]+)\s*(?:pessoas?\s+(?:(?:ja\s+)?(?:estao\s+)?(?:a\s+)?(?:assistir|assistindo|ver|vendo))|espectadores?)/,
    /([\d.]+)\s*(?:personas?\s+(?:(?:ya\s+)?(?:estan\s+)?(?:viendolo|viendo|mirando)(?:\s+actualmente)?)|espectadores?)/,
    /([\d.]+)\s*(?:(?:people|person)\s+(?:(?:already|currently)\s+)?(?:watching|viewing)|viewers)/,
  ];
  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (!match) continue;
    const count = num(match[1]);
    if (count !== null && Number.isFinite(count)) return count;
  }
  return null;
}

export function getGroupShowStatus(text = "") {
  const parsedCount = parseShowParticipantsCount(text);
  const participantCount = parsedCount !== null && parsedCount > 0 ? parsedCount : 0;
  return {
    isActive: participantCount > 0,
    participantCount,
  };
}

export function hasActiveTicketShowTimer(groupElement) {
  return Boolean(
    groupElement?.querySelector?.(
      '[class*="ElapsedShowTime"], [class*="ViewCamGroup__timer"]',
    ),
  );
}

export function getViewerCount() {
  const viewerBadge = document.querySelector(
    ".viewcam-profile-menu .player-viewers-count, .player-container .player-viewers-count, .model-chat-nav-item-count, [class*='viewerCount'], [data-test*='viewer']",
  );
  if (viewerBadge) {
    const val = num(txt(viewerBadge));
    if (val !== null && !isNaN(val) && val >= 0 && val < 100000) return val;
  }

  const viewerRegions = document.querySelectorAll(
    ".viewcam-profile-menu, .viewcam-profile-menu-item, .model-chat-nav, .player, .player-container, header"
  );
  const candidates = new Set();
  viewerRegions.forEach((region) => {
    region.querySelectorAll("div, p, span, h1, h2").forEach((el) => candidates.add(el));
  });

  const scanCandidates = candidates.size
    ? candidates
    : document.querySelectorAll("div, p, span, h1, h2");

  const readCandidate = (elements) => {
    for (const el of elements) {
      const text = (el.textContent || "").trim();
      if (!/assistindo\s+agora/i.test(text)) continue;
      const match = text.match(/([\d.,]+)\s*assistindo\s+agora/i);
      if (!match) continue;
      const val = num(match[1]);
      if (val !== null && !isNaN(val) && val >= 0 && val < 100000) return val;
    }
    return null;
  };

  const regionalValue = readCandidate(scanCandidates);
  if (regionalValue !== null) return regionalValue;
  if (candidates.size) {
    const fallbackValue = readCandidate(document.querySelectorAll("div, p, span, h1, h2"));
    if (fallbackValue !== null) return fallbackValue;
  }
  return null;
}

export function todoFingerprint(text, type, user) {
  const coreText = normalizeCoreTodoText(text);
  return `${String(type || "")
    .trim()
    .toLowerCase()}|${String(user || "—")
    .trim()
    .toLowerCase()}|${coreText}`;
}

export function parseUsersWithTokensCount(text) {
  const match = String(text ?? "").match(
    /(?:users?|usuarios?|usuários?|utilizadores?)\s+(?:with|con|com)\s+tokens\s*:?\s*([\d.,\s]+)/i,
  );
  if (!match) return null;

  const normalizedCount = match[1].replace(/[.,\s]/g, "");
  return /^\d+$/.test(normalizedCount) ? Number(normalizedCount) : null;
}

export function autoAddTodo(text, price, type, user) {
  const normalizedText = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalizedText) return;

  const coreText = normalizeCoreTodoText(normalizedText);
  const fingerprint = todoFingerprint(coreText, type, user);

  if (!Array.isArray(state.todos)) state.todos = [];

  const alreadyExists = state.todos.some((todo) => {
    if (!todo) return false;
    if (todo.fingerprint && todo.fingerprint === fingerprint) return true;
    const existingCore = normalizeCoreTodoText(todo.text);
    return existingCore && existingCore === coreText;
  });

  if (alreadyExists) return;

  if (
    type === "Ingresso Ticket" ||
    /ingresso|ticket/i.test(text) ||
    /ingresso|ticket/i.test(type)
  ) {
    return;
  }

  const monitoringActive = getMonitoring();
  const timeStr = monitoringActive ? time() : "";
  const timePart = timeStr ? `[${timeStr}] ` : "";
  const userPart = user && user !== "—" ? ` (${user})` : "";
  const fullDesc = `${timePart}${text}${userPart} [${type}]`;
  const priceVal = Number.isFinite(Number(price)) ? Number(price) : 0;

  state.todos.push({
    id: Date.now() + Math.random(),
    fingerprint,
    text: fullDesc,
    price: priceVal,
    done: false,
    createdAt: Date.now(),
  });

  const MAX_TODOS = 1000;
  if (state.todos.length > MAX_TODOS) {
    state.todos.splice(0, state.todos.length - MAX_TODOS);
  }

  if (monitoringActive) saveToGlobalHistory();

  requestUIRefresh(UI_REFRESH.TODOS);
}

export function parseGoal() {
  const goalsMap = new Map();

  if (state.goals && Array.isArray(state.goals)) {
    state.goals.forEach((g) => {
      if (g && g.description) {
        goalsMap.set(g.description, {
          description: g.description,
          amounts: g.amount ? [g.amount] : [],
          status: g.status || "Pendente",
          progress: g.progress !== undefined && g.progress !== null
            ? Math.max(0, Number(g.progress) || 0)
            : null,
        });
      }
    });
  }

  const activeTooltip = document.querySelector(
    "[role='tooltip'], [class*='tooltip']",
  );
  let tooltipTotal = null;
  let tooltipProgress = null;

  if (activeTooltip) {
    const tooltipText = txt(activeTooltip);
    const progressMatch = tooltipText.match(/(\d+)\s*\/\s*(\d+)\s*tk/i);
    if (progressMatch && progressMatch[2]) {
      tooltipProgress = Number(progressMatch[1]);
      tooltipTotal = Number(progressMatch[2]);
    }
  }

  const headerGoalEl = document.querySelector(
    ".epic-goal-progress__wrap--view-cam, .epic-goal-progress, [class*='goalProgress']",
  );
  let currentActiveDescFromHeader = "";
  if (headerGoalEl) {
    const rawHeader = txt(headerGoalEl);
    currentActiveDescFromHeader = rawHeader
      .replace(/meta\s*:?/i, "")
      .replace(/\d+\s*tk/i, "")
      .replace(/\/.*$/, "")
      .replace(/\d+([.,]\d+)?\s*%/g, "")
      .trim();
  }

  const goalElements = document.querySelectorAll(
    "div[class*='GoalUpdatedMessage'], [class*='epic-goal-progress']",
  );

  if (goalElements && goalElements.length > 0) {
    goalElements.forEach((el) => {
      const descEl = el.querySelector(
        "div[class*='GoalUpdatedMessage__goalText'], .epic-goal-progress__goal-text, [class*='goalText']",
      );
      let desc = txt(descEl);

      if (!desc && headerGoalEl) {
        desc = currentActiveDescFromHeader;
      }

      if (!desc) return;

      desc = desc.split("/")[0].replace(/\d+([.,]\d+)?\s*%/g, "").trim();

      const fullText = txt(el);
      const titleAccentEl = el.querySelector(
        "span[class*='GoalUpdatedMessage__titleAccent'], .epic-goal-progress__tokens, [class*='amount'], [class*='tokens']",
      );
      let parsedAmount = num(txt(titleAccentEl));

      if (parsedAmount === null || isNaN(parsedAmount) || parsedAmount === 0) {
        const matchTk = fullText.match(/(\d+)\s*tk/i);
        if (matchTk) parsedAmount = Number(matchTk[1]);
      }

      const isReached =
        !!el.querySelector(
          "div[class*='GoalUpdatedMessage__iconContainerGoalReached'], [class*='reached']",
        ) ||
        el.classList.contains("m-bg-goal-v2-reached") ||
        /meta alcançada/i.test(fullText);

      if (!goalsMap.has(desc)) {
        goalsMap.set(desc, {
          description: desc,
          amounts: [],
          status: isReached ? "Completa" : "Interrompida",
        });
      } else if (isReached) {
        goalsMap.get(desc).status = "Completa";
      }

      const goalData = goalsMap.get(desc);
      if (parsedAmount !== null && parsedAmount > 0) {
        goalData.amounts.push(parsedAmount);
      }
    });
  }

  if (goalsMap.size === 0 && currentActiveDescFromHeader) {
    const cleanHeaderDesc = currentActiveDescFromHeader.split("/")[0].trim();
    const matchTk = headerGoalEl
      ? txt(headerGoalEl).match(/(\d+)\s*tk/i)
      : null;
    const amount =
      tooltipTotal !== null ? tooltipTotal : matchTk ? Number(matchTk[1]) : 0;

    if (!goalsMap.has(cleanHeaderDesc)) {
      goalsMap.set(cleanHeaderDesc, {
        description: cleanHeaderDesc,
        amounts: [amount],
        status: "Pendente",
      });
    }
  }

  const parsedGoals = [];
  const activeDescLower = (currentActiveDescFromHeader || "").trim().toLowerCase();

  goalsMap.forEach((g) => {
    let totalAmount = g.amounts.length > 0 ? Math.max(...g.amounts) : 0;
    const isCurrentActive =
      activeDescLower &&
      g.description.trim().toLowerCase() === activeDescLower;

    let finalStatus = g.status;

    if (isCurrentActive) {
      if (finalStatus !== "Completa") {
        finalStatus = "Pendente";
        if (tooltipTotal !== null && tooltipTotal > 0) {
          totalAmount = tooltipTotal;
        }
      }
    } else if (finalStatus === "Pendente") {
      finalStatus = "Interrompida";
    }

    parsedGoals.push({
      amount: totalAmount > 0 ? totalAmount : null,
      progress: tooltipProgress !== null && isCurrentActive
        ? Math.max(0, Number(tooltipProgress) || 0)
        : g.progress !== undefined && g.progress !== null
          ? Math.max(0, Number(g.progress) || 0)
          : null,
      description: g.description,
      status: finalStatus,
      updatedAt: Date.now(),
    });
  });

  const statusPriority = {
    Pendente: 1,
    Completa: 2,
    Interrompida: 3,
  };

  parsedGoals.sort((a, b) => {
    return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
  });

  state.goals = parsedGoals;

  if (!Array.isArray(state.todos)) state.todos = [];
  state.goals.forEach((g) => {
    if (g.status === "Completa") {
      const fullDescSnippet = normalizeCoreTodoText(g.description);
      const existsInTodo = state.todos.some(
        (t) => normalizeCoreTodoText(t?.text) === fullDescSnippet,
      );
      if (!existsInTodo) {
        autoAddTodo(g.description, g.amount || 0, "Meta", "Modelo");
      }
    }
  });
}

function readUserLevel(li) {
  const badge = li.querySelector(".user-level-badge");
  if (badge) {
    const html = badge.innerHTML || "";
    const text = (badge.textContent || "").trim();
    if (
      html.includes("user-level-badge-filter-legend") &&
      html.includes("user-level-badge-stroke") &&
      (!text || text.includes("100"))
    ) {
      return 100;
    }
  }
  const candidates = li.querySelectorAll("span, div, text, .user-level-badge");
  for (const el of candidates) {
    const value = (el.textContent || "").trim();
    if (/^\d{1,3}$/.test(value)) {
      const level = Number(value);
      if (level >= 0 && level < 200) return level;
    }
  }
  const leading = (li.textContent || "").match(/^\s*(\d{1,3})/);
  return leading ? Number(leading[1]) : 0;
}

function classifyLeague(li, level) {
  const leagueEl = li.querySelector('[class*="color-league-"]');
  const leagueClass = leagueEl
    ? Array.from(leagueEl.classList).find((c) => c.startsWith("color-league-")) || ""
    : "";
  const markup = `${leagueClass} ${li.className || ""} ${li.innerHTML || ""}`.toLowerCase();
  if (markup.includes("legend")) return "legend";
  if (level === 100) return "legend";
  for (const league of ["royal", "diamond", "gold", "silver", "bronze"]) {
    if (markup.includes(league)) return league;
  }
  if (level >= 80) return "royal";
  if (level >= 55) return "diamond";
  if (level >= 35) return "gold";
  if (level >= 20) return "silver";
  if (level >= 10) return "bronze";
  return "grey";
}

export function scanUsers() {
  const usersListContainer = document.querySelector(".model-chat-users-list");
  if (!usersListContainer) return;

  const listItems = usersListContainer.querySelectorAll(".users-list ul > li");
  const now = Date.now();

  const currentActiveUsernames = new Set();

  if (listItems && listItems.length > 0) {
    listItems.forEach((li) => {
      if (
        li.closest?.(
          '.private-message, .whisper, .im-chat, [class*="private"], [class*="whisper"]',
        )
      ) {
        return;
      }

      const nameEl = li.querySelector(
        ".user-levels-username-text, .user-name-card-wrapper-text, .username, [class*='username'], [class*='name']",
      );
      const name = txt(nameEl).replace(/^\d+/, "").trim();

      if (!name || isIgnoredUser(name)) return;

      const lowerName = name.toLowerCase();
      currentActiveUsernames.add(lowerName);

      const u = userRecord(name);

      if (u) {
        u.lastSeen = time();

        const userLevel = readUserLevel(li);
        const determinedLeague = classifyLeague(li, userLevel);

        u.league = determinedLeague;
        u.level = userLevel;

        if (!u.isListed) {
          u.visitCount = (u.visitCount || 0) + 1;
          u._currentVisitStart = now;
          u._currentVisitDuration = 0;
          u._visitMessagesStart = Number(u.messages) || 0;
          u._visitTokensStart = Number(u.tokens) || 0;
        }

        if (!Number.isFinite(Number(u._currentVisitStart)) || !u._currentVisitStart) {
          u._currentVisitStart = now;
        }
        if (!Number.isFinite(Number(u._visitMessagesStart))) {
          u._visitMessagesStart = Number(u.messages) || 0;
        }
        if (!Number.isFinite(Number(u._visitTokensStart))) {
          u._visitTokensStart = Number(u.tokens) || 0;
        }
        u._lastListedAt = now;
        u.isListed = true;
      }
    });
  }

  if (state.users && typeof state.users === "object") {
    for (const [name, u] of Object.entries(state.users)) {
      if (!u) continue;
      const lowerName = String(name || "").toLowerCase();
      if (u.isListed && !currentActiveUsernames.has(lowerName)) {
        const visitDuration = Math.max(
          0,
          Math.floor((now - (u._currentVisitStart || now)) / 1000),
        );
        u._currentVisitDuration = visitDuration;
        u.totalTimeSpent = (u.totalTimeSpent || 0) + visitDuration;
        u.isListed = false;
        u._currentVisitStart = null;
      }
    }
  }

  state.listedUsersCount = currentActiveUsernames.size;
}

export function countLeagues() {
  const emptyCounts = {
    grey: 0,
    bronze: 0,
    silver: 0,
    gold: 0,
    diamond: 0,
    royal: 0,
    legend: 0,
  };

  const usersListContainer = document.querySelector(
    ".model-chat-users-list, .users-list",
  );
  if (!usersListContainer) return;

  const listItems = document.querySelectorAll(
    ".model-chat-users-list .users-list ul > li, " +
      ".model-chat-users-list ul > li, " +
      ".model-chat-users-list li[class*='user'], " +
      ".users-list ul > li, " +
      ".users-list > ul > li, " +
      ".users-list li[class*='user']",
  );

  if (!listItems || listItems.length === 0) {
    state.leagueCounts = emptyCounts;
    state.listedUsersCount = 0;
    state.leagueCountsUpdatedAt = Date.now();
    return;
  }

  const tempCounts = { ...emptyCounts };
  const countedUsers = new Set();

  listItems.forEach((li) => {
    if (
      li.closest?.(
        '.private-message, .whisper, .im-chat, [class*="private"], [class*="whisper"]',
      )
    ) {
      return;
    }

    const nameEl = li.querySelector(
      ".user-levels-username-text, .user-name-card-wrapper-text, .username, [class*='username'], [class*='name']",
    );
    const name = txt(nameEl).replace(/^\d+/, "").trim();

    if (!name || isIgnoredUser(name)) return;
    const normalizedName = name.toLowerCase();

    if (countedUsers.has(normalizedName)) return;
    countedUsers.add(normalizedName);

    const userLevel = readUserLevel(li);
    const league = classifyLeague(li, userLevel);
    tempCounts[league]++;
  });

  state.leagueCounts = tempCounts;
  state.listedUsersCount = countedUsers.size;
  state.leagueCountsUpdatedAt = Date.now();
}

export function readUserListCounts() {
  const infoItems = [
    ...document.querySelectorAll(".model-chat-users-info-item"),
  ];
  const usersListContainer = document.querySelector(
    ".model-chat-users-list, .users-list",
  );
  if (!usersListContainer && infoItems.length === 0) return;

  const tokenCount = infoItems
    .map((el) => parseUsersWithTokensCount(txt(el)))
    .find((count) => count !== null);
  if (tokenCount !== undefined) state.tokensUsersCount = tokenCount;

  const ultimateEl = document.querySelector(".info-item-ultimate");
  if (ultimateEl) {
    state.ultimateUsersCount = num(txt(ultimateEl)) ?? state.ultimateUsersCount;
  }

  const invisibleEl = document.querySelector(".info-item-invisibles");
  if (invisibleEl) {
    state.invisibleUsersCount =
      num(txt(invisibleEl)) ?? state.invisibleUsersCount;
  }

  const othersItem = infoItems.find((el) => /^Outros\s*:/i.test(txt(el)));
  if (othersItem) {
    state.otherUsersCount = num(txt(othersItem)) ?? state.otherUsersCount;
  }

  const moreUsersEl = document.querySelector(".more-users");
  if (moreUsersEl) {
    const moreMatch = txt(moreUsersEl).match(/\+\s*mais\s*([\d.,]+)/i);
    if (moreMatch) {
      state.moreUsersCount = num(moreMatch[1]) ?? state.moreUsersCount;
    }
  }

  countLeagues();
}

export function isRoomOffline() {
  return !!document.querySelector(
    ".vc-status-offline, .availability-status.offline",
  );
}