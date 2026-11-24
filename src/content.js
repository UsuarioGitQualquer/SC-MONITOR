(async () => {
  const forceRecovery = window.__scmForceRecovery === true;
  window.__scmForceRecovery = false;
  const previousMonitoringIntent =
    typeof window.__scmMonitoringIntent === "boolean"
      ? window.__scmMonitoringIntent
      : /MONITORANDO/.test(
          document.getElementById("scm-status-badge")?.textContent || "",
        );
  const resumeAfterRecovery =
    forceRecovery && previousMonitoringIntent;
  if (
    (window.__stripchatMonitorLoaded || window.__scmLoading) &&
    !forceRecovery
  ) return;

  const bootGeneration = (Number(window.__scmBootGeneration) || 0) + 1;
  window.__scmBootGeneration = bootGeneration;
  const isCurrentBoot = () => window.__scmBootGeneration === bootGeneration;

  if (forceRecovery) {
    try {
      window.__scmDispose?.();
    } catch (error) {
      console.warn("[SC Monitor] Não foi possível encerrar o contexto anterior.", error);
    }
    document.getElementById("scm-panel")?.remove();
    document.getElementById("scm-launch")?.remove();
    window.__scmMonitoringIntent = resumeAfterRecovery;
    window.__scmRecoveryShouldResume = resumeAfterRecovery;
  } else {
    window.__scmMonitoringIntent = false;
    window.__scmRecoveryShouldResume = false;
  }

  window.__scmLoading = true;

  const dismissedBots = new Set();
  const SAVE_INTERVAL_MS = 30_000;
  const METRIC_SAMPLE_INTERVAL_MS = 10_000;
  const CHAT_MESSAGE_PROCESS_DELAY_MS = 300;

  window.__scmDismissBot = function (username) {
    if (!username) return;
    const cleanUser = username.toLowerCase();
    dismissedBots.add(cleanUser);

    if (!Array.isArray(state.dismissedSuspectBots)) state.dismissedSuspectBots = [];
    if (!state.dismissedSuspectBots.includes(cleanUser)) {
      state.dismissedSuspectBots.push(cleanUser);
    }
    if (state.dismissedSuspectBots.length > 300) {
      state.dismissedSuspectBots.splice(0, state.dismissedSuspectBots.length - 300);
    }

    if (Array.isArray(state.suspectBots)) {
      state.suspectBots = state.suspectBots.filter((b) => b.username.toLowerCase() !== cleanUser);
    }
    Object.values(state.dailyBuckets || {}).forEach((bucket) => {
      if (!bucket || typeof bucket !== "object") return;
      const suspects = Array.isArray(bucket.suspectBots)
        ? bucket.suspectBots
        : Object.values(bucket.suspectBots || {});
      bucket.suspectBots = suspects.filter(
        (suspect) => String(suspect?.username || "").toLowerCase() !== cleanUser,
      );
    });

    detectSuspectBots();
    persistCurrentState();
    render();
  };

  let core;
  let persistence;
  let storage;
  let parsers;
  let events;
  let autoCollector;
  let panelUI;
  let configuration;
  let localization;
  try {
    [
      core,
      persistence,
      storage,
      parsers,
      events,
      autoCollector,
      panelUI,
      configuration,
      localization,
    ] = await Promise.all([
      import(chrome.runtime.getURL("src/core/state.js")),
      import(chrome.runtime.getURL("src/core/persistence.js")),
      import(chrome.runtime.getURL("src/core/storage.js")),
      import(chrome.runtime.getURL("src/modules/parsers.js")),
      import(chrome.runtime.getURL("src/modules/events.js")),
      import(chrome.runtime.getURL("src/modules/auto-collector.js")),
      import(chrome.runtime.getURL("src/ui/panel.js")),
      import(chrome.runtime.getURL("src/core/configuration.js")),
      import(chrome.runtime.getURL("src/utils/i18n.js")),
    ]);
    await localization.initializeLocalization();
    localization.watchExtensionUi();
  } catch (error) {
    if (!isCurrentBoot()) return;
    window.__scmLoading = false;
    window.__stripchatMonitorLoaded = false;
    delete window.__scmDismissBot;
    console.error("[SC Monitor] Não foi possível carregar os módulos:", error);
    return;
  }
  if (!isCurrentBoot()) return;

  const {
    state,
    processedMessageIds,
    roomName,
    resolveStorageKey,
    getMonitoring,
    setMonitoring,
    localDateKey,
    resetSessionStats,
    ensureDailyBucket,
    recordMinuteMetric,
    startOrTouchLiveSegment,
    closeLiveSegmentForDay,
    recalculateTotalTokens,
    pruneUserRecords,
  } = core;

  const {
    saveToGlobalHistory,
    waitForHistorySaves,
    invalidatePendingHistorySaves,
  } = persistence;
  const { safeStorage } = storage;
  const {
    parseRoomKing,
    getGroupShowKind,
    getGroupShowStatus,
    hasActiveTicketShowTimer,
    getViewerCount,
    parseGoal,
    scanUsers,
    readUserListCounts,
    isRoomOffline,
  } = parsers;

  const {
    checkActiveCamTicketPrice,
    processMessage,
    hasRecentTicketPurchase,
  } = events;
  const { createAutoCollectionController } = autoCollector;
  const {
    AUTOMATION_CONFIG_KEYS,
    clearAutomationConfig,
    loadAutomationConfig,
  } = configuration;
  const {
    createUI,
    render,
    downloadCSV,
    setLauncherAvatar,
  } = panelUI;

  let observer;
  let chatContainerObserver;
  let observedChatContainer = null;
  let sampleTimer;
  let processTimeout;
  let recoveryResumeTimer;
  const pendingChatMessages = new Set();
  let saveTimer;
  let lastHistorySaveAt = 0;
  let spaInterval;

  let roomOfflineState = true;
  let autoCollectEnabled = false;
  let saveFeedbackTimer = null;
  let lastKingGoalCheckTime = 0;
  const kingTooltipTargets = new WeakSet();
  let roomRestorePending = false;
  let backupRestorePending = false;

  // Estado da vigilância de modelo específica (OFF ⇄ ON)
  let autoMonitorOnLive = false;
  let watchedModelId = null;
  let offlineDebounceTimer = null;
  const AUTO_STOP_IDLE_MS = 2 * 60 * 1000;
  let offlineSinceAt = 0;
  let lastChatActivityAt = Date.now();
  let watchInterval = null;
  let lastActionIconActive = null;
  let lastActionIconUrl = "";
  let actionIconRuntimeWarningShown = false;

  let totalBruteSeconds = 0;
  let totalNetSeconds = 0;
  let bruteDaySeconds = 0;
  let netDaySeconds = 0;
  let timerDayDate = null;
  let liveTimerInterval = null;
  let lastMinuteMetricTotalTokens = 0;
  let showSecondsCounter = 0;
  let activeShowCategory = null;

  let lastPlayerState = {
    isRestricted: false,
  };

  const autoCollection = createAutoCollectionController({
    isEnabled: () => autoCollectEnabled,
    isMonitoring: getMonitoring,
    collect,
    triggerTooltipsOnce,
    scanUsers,
    readUserListCounts,
    shouldKeepChatTab: hasRecentTicketPurchase,
  });

  function isRoomOfflineNow() {
    return Boolean(isRoomOffline());
  }

  function updateExtensionIcon(active = getMonitoring()) {
    const avatar = document.querySelector(
      ".viewcam-profile-menu-item__avatar img",
    );
    const avatarUrl = active
      ? String(avatar?.currentSrc || avatar?.src || "")
      : "";
    const iconActive = Boolean(active && avatarUrl);
    const iconUrl = iconActive ? avatarUrl : "";
    setLauncherAvatar(iconUrl);

    if (
      lastActionIconActive === iconActive &&
      (!iconActive || lastActionIconUrl === iconUrl)
    ) {
      return;
    }

    const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      lastActionIconActive = null;
      lastActionIconUrl = "";
      if (!actionIconRuntimeWarningShown) {
        console.warn(
          "[SC Monitor] Contexto da extensão indisponível; recarregue a página da sala.",
        );
        actionIconRuntimeWarningShown = true;
      }
      return;
    }

    actionIconRuntimeWarningShown = false;
    lastActionIconActive = iconActive;
    lastActionIconUrl = iconUrl;
    try {
      runtime.sendMessage(
        { type: "SCM_SET_ACTION_ICON", active: iconActive, avatarUrl: iconUrl },
        (response) => {
          if (runtime.lastError) {
            lastActionIconActive = null;
            lastActionIconUrl = "";
            console.warn("[SC Monitor] Não foi possível atualizar o ícone da extensão.");
          } else if (response?.ok === false) {
            lastActionIconActive = null;
            lastActionIconUrl = "";
            console.warn("[SC Monitor] A atualização do ícone da extensão falhou.");
          }
        },
      );
    } catch (error) {
      lastActionIconActive = null;
      lastActionIconUrl = "";
      console.warn("[SC Monitor] Não foi possível enviar a atualização do ícone.", error);
    }
  }

  function getChatMessagesFromNode(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) return new Set();
    const messages = new Set();
    const selector = ".message-base, .message";
    if (element.matches(selector)) messages.add(element);
    element.querySelectorAll(selector).forEach((message) => messages.add(message));
    const parentMessage = element.closest(selector);
    if (parentMessage) messages.add(parentMessage);
    return messages;
  }

  function getChatContainer() {
    return (
      document.querySelector(".model-chat-content") ||
      document.querySelector(".messages-v2") ||
      Array.from(document.querySelectorAll(".scroll-bar-container")).find(
        (container) => container.querySelector(".message-base, .message"),
      ) ||
      document.body
    );
  }

  function queueChatMessages(records) {
    const addedMessages = new Set();
    records.forEach((record) => {
      if (record.type === "characterData") {
        getChatMessagesFromNode(record.target).forEach((message) => addedMessages.add(message));
      }
      record.addedNodes.forEach((node) => {
        getChatMessagesFromNode(node).forEach((message) => addedMessages.add(message));
      });
    });
    if (addedMessages.size === 0) return;

    lastChatActivityAt = Date.now();
    addedMessages.forEach((message) => pendingChatMessages.add(message));
    if (!getMonitoring() || processTimeout) return;
    processTimeout = setTimeout(() => {
      processTimeout = null;
      if (getMonitoring()) {
        const messages = Array.from(pendingChatMessages);
        pendingChatMessages.clear();
        messages.forEach(processChatMessageSafely);
        return;
      }
      pendingChatMessages.clear();
    }, CHAT_MESSAGE_PROCESS_DELAY_MS);
  }

  function attachChatObserver() {
    const chatContainer = getChatContainer();
    if (!chatContainer || (observer && chatContainer === observedChatContainer)) return;

    observer?.disconnect();
    observedChatContainer = chatContainer;
    observer = new MutationObserver(queueChatMessages);
    observer.observe(chatContainer, { subtree: true, childList: true, characterData: true });

    if (chatContainer !== document.body && !chatContainerObserver) {
      chatContainerObserver = new MutationObserver(() => {
        if (!observedChatContainer?.isConnected) attachChatObserver();
      });
      chatContainerObserver.observe(document.body, { subtree: true, childList: true });
    }
  }

  function processChatMessageSafely(message, options) {
    try {
      processMessage(message, options);
    } catch (error) {
      const messageId =
        message?.dataset?.messageId ||
        message?.getAttribute?.("data-message-id") ||
        "sem identificador";
      console.error(`[SC Monitor] Falha ao processar mensagem do chat (${messageId}).`, error);
    }
  }

  function scheduleOfflineStop() {
    if (offlineDebounceTimer) return;

    const stopAt = Math.max(
      offlineSinceAt + AUTO_STOP_IDLE_MS,
      lastChatActivityAt + AUTO_STOP_IDLE_MS,
    );
    offlineDebounceTimer = setTimeout(() => {
      offlineDebounceTimer = null;
      if (!autoMonitorOnLive || !isWatchedRoomActive()) return;

      const liveData = parseLiveStates();
      if (!isRoomOfflineNow() || liveData.isLiveActive) {
        roomOfflineState = false;
        offlineSinceAt = 0;
        return;
      }

      const now = Date.now();
      if (
        now - offlineSinceAt < AUTO_STOP_IDLE_MS ||
        now - lastChatActivityAt < AUTO_STOP_IDLE_MS
      ) {
        scheduleOfflineStop();
        return;
      }

      closeListedUserVisits();
      roomOfflineState = true;
      offlineSinceAt = 0;
      state.suspectBots = [];
      state.currentViewers = 0;
      if (getMonitoring()) {
        stopMonitoringSession(true, "a sala foi detectada como offline");
      }
    }, Math.max(0, stopAt - Date.now()));
  }

  function clearRuntimeHandles() {
    if (recoveryResumeTimer) {
      clearTimeout(recoveryResumeTimer);
      recoveryResumeTimer = null;
    }
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (sampleTimer) {
      clearInterval(sampleTimer);
      sampleTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (chatContainerObserver) {
      chatContainerObserver.disconnect();
      chatContainerObserver = null;
    }
    observedChatContainer = null;
    if (processTimeout) {
      clearTimeout(processTimeout);
      processTimeout = null;
    }
    pendingChatMessages.clear();
  }

  function pruneOldDailyBuckets(keepDays = 30) {
    if (!state.dailyBuckets || typeof state.dailyBuckets !== "object") {
      state.dailyBuckets = {};
      return;
    }
    const keys = Object.keys(state.dailyBuckets).sort();
    if (keys.length <= keepDays) return;
    const toRemove = keys.slice(0, keys.length - keepDays);
    for (const k of toRemove) {
      delete state.dailyBuckets[k];
    }
  }

  function isWatchedRoomActive() {
    if (!watchedModelId) return false;
    const currentId = String(state.modelId || state.room || "");
    const currentRoom = String(roomName() || "");
    return currentId === watchedModelId || currentRoom === watchedModelId;
  }

  function startMonitoringSession() {
    if (getMonitoring() || backupRestorePending) return;
    setMonitoring(true);
    window.__scmMonitoringIntent = true;
    lastChatActivityAt = Date.now();
    updateExtensionIcon(true);
    onSessionStartOrRoomSwitch();
    collect(true);
    lastMinuteMetricTotalTokens = Number(state.totalTokens) || 0;
    triggerTooltipsOnce();
    startLiveTimer();
    if (autoCollectEnabled) startAutoCollection();

    attachChatObserver();

    if (!sampleTimer) {
      sampleTimer = setInterval(() => {
        if (getMonitoring()) {
          collect();
          updateStatsSummary(true);
        }
      }, METRIC_SAMPLE_INTERVAL_MS);
    }
    render();
  }

  function stopMonitoringSession(shouldSave = true, reason = "ação manual") {
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    stopAutoCollection();
    clearRuntimeHandles();
    if (!getMonitoring()) {
      window.__scmMonitoringIntent = false;
      return;
    }

    endActiveShow();
    closeLiveSegmentForDay(localDateKey(), Date.now());
    console.info(`[SC Monitor] Monitoramento pausado: ${reason}.`);
    setMonitoring(false);
    window.__scmMonitoringIntent = false;
    updateExtensionIcon(false);
    offlineSinceAt = 0;
    if (shouldSave) saveNow();
    render();
  }

  function checkWatchedModelLiveStatus() {
    if (!autoMonitorOnLive) return;

    if (!isWatchedRoomActive()) {
      if (getMonitoring()) {
        stopMonitoringSession(true, "a sala monitorada não corresponde à sala atual");
      }
      return;
    }

    const offlineNow = isRoomOfflineNow();
    const liveData = parseLiveStates();
    const isNowOnline = !offlineNow && liveData.isLiveActive;

    if (isNowOnline) {
      if (offlineDebounceTimer) {
        clearTimeout(offlineDebounceTimer);
        offlineDebounceTimer = null;
      }
      offlineSinceAt = 0;
      roomOfflineState = false;

      if (!getMonitoring()) {
        startMonitoringSession();
      } else if (autoCollectEnabled && !autoCollection.isRunning()) {
        startAutoCollection();
      }
      return;
    }

    if (!roomOfflineState && offlineNow) {
      if (!offlineSinceAt) offlineSinceAt = Date.now();
      scheduleOfflineStop();
      return;
    }

    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    offlineSinceAt = 0;
  }

  function setAutoMonitorOnLive(enabled) {
    autoMonitorOnLive = Boolean(enabled);
    state.autoMonitorOnLive = autoMonitorOnLive;

    if (autoMonitorOnLive) {
      watchedModelId = String(state.modelId || state.room || roomName() || "");
      state.watchedModelId = watchedModelId;
      const offlineNow = isRoomOfflineNow();
      roomOfflineState = offlineNow && !getMonitoring();
      offlineSinceAt = offlineNow && getMonitoring() ? Date.now() : 0;
      startWatchdog();
      checkWatchedModelLiveStatus();
    } else {
      watchedModelId = null;
      state.watchedModelId = null;
      if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
      }
      if (offlineDebounceTimer) {
        clearTimeout(offlineDebounceTimer);
        offlineDebounceTimer = null;
      }
      offlineSinceAt = 0;
    }
    state.watchedModelId = watchedModelId;
    render();
  }

  function startWatchdog() {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = setInterval(() => {
      checkWatchedModelLiveStatus();
    }, 3000);
  }

  function handleMidnightRollover(previousDay, newDay, nowTs = Date.now()) {
    if (!previousDay || previousDay === newDay) return;

    closeLiveSegmentForDay(previousDay, nowTs, "23:59:59");
    persistCurrentState(null, previousDay);

    state.events = [];
    state.eventSummaryTotals = {};
    state.goals = [];
    state.todos = [];

    timerDayDate = newDay;
    bruteDaySeconds = 0;
    netDaySeconds = 0;
    state.dailyTokenDate = newDay;
    state.dailyTokenBaseline = Number(state.totalTokens) || 0;

    pruneOldDailyBuckets(30);
    const freshBucket = ensureDailyBucket(newDay);
    if (!Array.isArray(freshBucket.capturedEvents)) freshBucket.capturedEvents = [];
    state.capturedEvents = freshBucket.capturedEvents;
    freshBucket.dayStartTokens = Number(state.totalTokens) || 0;
    freshBucket.dailyTokens = 0;
    freshBucket.bruteDaySeconds = 0;
    freshBucket.netDaySeconds = 0;

    const liveData = parseLiveStates();
    if (getMonitoring() && !isRoomOfflineNow() && liveData.isLiveActive) {
      startOrTouchLiveSegment(newDay, nowTs, "00:00:00");
    }
  }

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }

  function rollDailyTokenWindow() {
    const today = localDateKey();
    const bucket = ensureDailyBucket(today);

    if (state.dailyTokenDate !== today) {
      state.dailyTokenBaseline = Number(state.totalTokens) || 0;
      state.dailyTokenDate = today;
      bucket.dayStartTokens = Number(state.totalTokens) || 0;
      bucket.dailyTokens = 0;
    }

    if (state.dailyTokenBaseline === undefined || state.dailyTokenBaseline === null) {
      state.dailyTokenBaseline = Number(state.totalTokens) || 0;
    }

    if (state._sessionTokensStart === undefined || state._sessionTokensStart === null) {
      state._sessionTokensStart = Number(state.totalTokens) || 0;
    }
  }

  function updatePersistentTimerState() {
    rollDailyTokenWindow();
    state.timerState = {
      bruteSeconds: totalBruteSeconds,
      netSeconds: totalNetSeconds,
      showSecondsCounter,
      activeShowCategory,
      bruteDaySeconds,
      netDaySeconds,
      timerDayDate,
    };
  }

  function parseLiveStates() {
    const videoArea = document.querySelector(".ViewCamWrapper__videoLayout, .ViewCamWrapper__video, .ViewCamPlayer, .ViewCamPublic") || document;
    const groupElement = document.querySelector(".ViewCamGroup, [class*='ViewCamGroup'], .group-show-control, .group-show-btn");
    const groupButton =
      groupElement?.querySelector('[class*="joinButton"], .group-show-btn') || groupElement;
    const groupTitle = groupElement?.querySelector(
      '[class*="ViewCamGroup__title"], [class*="GroupShowControlButton__announcement"]',
    );
    const groupText = [
      groupTitle?.innerText,
      groupButton?.innerText,
    ].filter(Boolean).join(" ") || groupElement?.innerText || "";
    const ticketIcon = groupButton?.querySelector("svg use");
    const iconHref =
      ticketIcon?.getAttribute("href") ||
      ticketIcon?.getAttribute("xlink:href") ||
      ticketIcon?.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      "";
    const groupShowKind = getGroupShowKind(groupText, iconHref);

    const isTicketShow = Boolean(
      groupElement &&
      groupShowKind === "ticket" &&
      hasActiveTicketShowTimer(groupElement)
    );
    let isGroupShow = false;
    let groupParticipantsCount = 0;
    let groupRatePrice = 0;

    if (groupElement && !isTicketShow) {
      const allTextInside = groupElement.innerText || groupText;
      const matchTk = allTextInside.match(/(\d+)\s*tk\/min/i);
      if (matchTk) groupRatePrice = Number(matchTk[1]);

      const groupStatus = getGroupShowStatus(allTextInside);
      isGroupShow = groupStatus.isActive;
      groupParticipantsCount = groupStatus.participantCount;

      state.currentGroupShowRate = isGroupShow ? groupRatePrice * groupParticipantsCount : 0;
    } else {
      state.currentGroupShowRate = 0;
    }

    const p2pElement = document.querySelector('.ViewCamP2p__shutter, .ViewCamP2p__body, [class*="ViewCamP2p"]');
    const p2pText = (p2pElement?.innerText || "").toLowerCase();
    const isExclusiveShow = Boolean(p2pElement && /exclusivo|exclusive|particular exclusivo|vip/i.test(p2pText));

    const privateShowElement = videoArea.querySelector('.ViewCamPrivate, [class*="ViewCamPrivate"], [class*="PrivateShow"], [data-testid*="private-show"]');
    const privateText = (privateShowElement?.innerText || "").toLowerCase();
    const isPrivateShow =
      !isExclusiveShow &&
      (Boolean(privateShowElement && /show particular|show privado|private show/.test(privateText)) ||
        Boolean(p2pElement && /show particular|show privado|private show/.test(p2pText)));

    const isOfflineState =
      !groupElement &&
      !p2pElement &&
      (document.querySelector(".vc-status-offline, .availability-status.offline") !== null || isRoomOfflineNow());
    const isAguarde =
      !isOfflineState &&
      !groupElement &&
      !p2pElement &&
      document.querySelector(".ViewCamIdle__status, .ViewCamShutterWrapper__statusDefault") !== null;
    const hasPlayer = document.querySelector('.player-controls-layers, video, [class*="videoPlayer"]') !== null;

    const isRecognizedShow = isPrivateShow || isExclusiveShow || isGroupShow || isTicketShow;
    const isLiveActive = !isAguarde && !isOfflineState && (hasPlayer || isRecognizedShow);
    const isRestrictedShowState = isPrivateShow || isExclusiveShow || isTicketShow || isGroupShow;

    return {
      isPrivateShow,
      isExclusiveShow,
      isGroupShow,
      isTicketShow,
      isOfflineState,
      isAguarde,
      isLiveActive,
      isRestrictedShowState,
      groupRatePrice,
      groupParticipantsCount,
    };
  }

  function trackUserSyncBehavior(currentActiveUsers, isRestricted) {
    if (isRestricted && !lastPlayerState.isRestricted) {
      if (state.users) {
        for (const [username, user] of Object.entries(state.users)) {
          if (user._wasActiveRecently && !currentActiveUsers.has(username)) {
            user.syncExits = (user.syncExits || 0) + 1;
            user._lastSyncActionTime = Date.now();
          }
        }
      }
    }

    if (!isRestricted && lastPlayerState.isRestricted) {
      if (state.users) {
        for (const [username, user] of Object.entries(state.users)) {
          if (!user._wasActiveRecently && currentActiveUsers.has(username)) {
            user.syncReturns = (user.syncReturns || 0) + 1;
            user._lastSyncActionTime = Date.now();
          }
        }
      }
    }

    if (state.users) {
      for (const [username, user] of Object.entries(state.users)) {
        user._wasActiveRecently = currentActiveUsers.has(username);
      }
    }
    lastPlayerState.isRestricted = isRestricted;
  }

  function getActiveUsersSet() {
    const activeUsersNow = new Set();
    const usersListContainer = document.querySelector(".model-chat-users-list");
    if (usersListContainer) {
      usersListContainer.querySelectorAll(".users-list ul > li").forEach((li) => {
        const nameEl = li.querySelector(".user-levels-username-text, .user-name-card-wrapper-text, .username, [class*='username']");
        const name = (nameEl?.textContent || "").replace(/^\d+/, "").trim();
        if (name) activeUsersNow.add(name);
      });
    }
    return activeUsersNow;
  }

  function updateStatsSummary(isSampleTick = false) {
    if (!state.userStatsSummary) return;
    if (!state.generalStatsSummary) {
      state.generalStatsSummary = { peakViewers: 0, avgViewers: 0, totalTokens: 0, samplesCount: 0 };
    }

    if (!state.leagueStatsSummary) {
      state.leagueStatsSummary = {
        peak: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
        avg: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
        samplesCount: 0,
      };
    }

    if (!state._sessionUserSum) {
      state._sessionUserSum = {
        listedUsersCount: 0,
        otherUsersCount: 0,
        tokensUsersCount: 0,
        ultimateUsersCount: 0,
        invisibleUsersCount: 0,
        moreUsersCount: 0,
      };
    }

    if (!state._sessionLeagueSum) {
      state._sessionLeagueSum = { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 };
    }

    const gStats = state.generalStatsSummary;
    gStats.peakViewers = Math.max(gStats.peakViewers || 0, state.peakViewers || 0);
    gStats.avgViewers = state.avgViewers || 0;
    gStats.totalTokens = state.totalTokens || 0;

    const todayBucket = ensureDailyBucket(localDateKey());
    todayBucket.peakViewers = Math.max(todayBucket.peakViewers || 0, state.peakViewers || 0);
    todayBucket.peakViewersDay = Math.max(todayBucket.peakViewersDay || 0, state.peakViewers || 0);
    todayBucket.avgViewers = state.avgViewers || 0;

    if (isSampleTick) {
      gStats.samplesCount = (gStats.samplesCount || 0) + 1;

      const currentViewers = Number(state.currentViewers) || 0;
      state._sessionViewerSum = (Number(state._sessionViewerSum) || 0) + currentViewers;
      state._sessionViewerSamplesCount = (Number(state._sessionViewerSamplesCount) || 0) + 1;
      state.avgViewers = Math.round(state._sessionViewerSum / state._sessionViewerSamplesCount);
      gStats.avgViewers = state.avgViewers;
      todayBucket.avgViewers = state.avgViewers;

      const uSamples = (state.userStatsSummary.samplesCount || 0) + 1;
      state.userStatsSummary.samplesCount = uSamples;

      const currentUsers = {
        listedUsersCount: Number(state.listedUsersCount) || 0,
        otherUsersCount: Number(state.otherUsersCount) || 0,
        tokensUsersCount: Number(state.tokensUsersCount) || 0,
        ultimateUsersCount: Number(state.ultimateUsersCount) || 0,
        invisibleUsersCount: Number(state.invisibleUsersCount) || 0,
        moreUsersCount: Number(state.moreUsersCount) || 0,
      };

      for (const key in currentUsers) {
        const val = currentUsers[key];
        state.userStatsSummary.peak[key] = Math.max(Number(state.userStatsSummary.peak[key]) || 0, val);
        state._sessionUserSum[key] = (Number(state._sessionUserSum[key]) || 0) + val;
        state.userStatsSummary.avg[key] = Math.round(state._sessionUserSum[key] / uSamples);
      }

      const lSamples = (state.leagueStatsSummary.samplesCount || 0) + 1;
      state.leagueStatsSummary.samplesCount = lSamples;

      const currentLeagues = state.leagueCounts || { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 };

      for (const key in currentLeagues) {
        const val = Number(currentLeagues[key]) || 0;
        state.leagueStatsSummary.peak[key] = Math.max(Number(state.leagueStatsSummary.peak[key]) || 0, val);
        state._sessionLeagueSum[key] = (Number(state._sessionLeagueSum[key]) || 0) + val;
        state.leagueStatsSummary.avg[key] = Math.round(state._sessionLeagueSum[key] / lSamples);
      }

      todayBucket.userStatsSummary = JSON.parse(JSON.stringify(state.userStatsSummary));
      todayBucket.leagueStatsSummary = JSON.parse(JSON.stringify(state.leagueStatsSummary));
    }
  }

  function registerShowTokenEvent(currentType, ratePrice, groupRate, groupPeople, isInitial = false) {
    state.showTokensAccumulated = (state.showTokensAccumulated || 0) + ratePrice;

    const description = isInitial
      ? currentType === "Grupo"
        ? `Show em Grupo (${groupRate}tk/min × ${groupPeople} pessoas - Início)`
        : currentType === "Ticket"
          ? "Ticket show (Início)"
          : `Show ${currentType} (Início)`
      : currentType === "Grupo"
        ? `Show em Grupo (${groupRate}tk/min × ${groupPeople} pessoas - 1 min)`
        : currentType === "Ticket"
          ? "Ticket show (1 min)"
          : `Show ${currentType} (1 min)`;

    const eventItem = {
      id: `scm-show-${Date.now()}-${Math.random()}`,
      time: Date.now(),
      timestamp: Date.now(),
      type: currentType === "Grupo"
        ? "Show em Grupo"
        : currentType === "Ticket"
          ? "Ticket show"
          : `Show ${currentType}`,
      user: "—",
      tokens: ratePrice,
      price: `${ratePrice}`,
      item: description,
      showBoundary: isInitial ? "start" : null,
    };

    if (!Array.isArray(state.events)) state.events = [];
    state.events.push(eventItem);
    if (state.events.length > 500) state.events.shift();

    const todayBucket = ensureDailyBucket(localDateKey());
    if (!Array.isArray(todayBucket.capturedEvents)) todayBucket.capturedEvents = [];
    state.capturedEvents = todayBucket.capturedEvents;
    todayBucket.capturedEvents.push(eventItem);
    if (todayBucket.capturedEvents.length > 500) todayBucket.capturedEvents.shift();
    const currentSegment = todayBucket.liveSessions?.[state.sessionId];
    if (currentSegment) {
      if (!Array.isArray(currentSegment.capturedEvents)) currentSegment.capturedEvents = [];
      currentSegment.capturedEvents.push(eventItem);
      if (currentSegment.capturedEvents.length > 500) currentSegment.capturedEvents.shift();
    }

    if (ratePrice > 0) {
      if (!state.eventSummaryTotals || typeof state.eventSummaryTotals !== "object") {
        state.eventSummaryTotals = {};
      }

      let summaryKey = eventItem.type;
      if (/show em grupo/i.test(summaryKey)) summaryKey = "Show em Grupo";
      else if (/show privado/i.test(summaryKey)) summaryKey = "Show Privado";
      else if (/show exclusivo/i.test(summaryKey)) summaryKey = "Show Exclusivo";

      if (!state.eventSummaryTotals[summaryKey]) {
        state.eventSummaryTotals[summaryKey] = {
          count: 0,
          tokens: 0,
          type: eventItem.type,
        };
      }
      state.eventSummaryTotals[summaryKey].count += 1;
      state.eventSummaryTotals[summaryKey].tokens += ratePrice;
      todayBucket.eventSummaryTotals = JSON.parse(JSON.stringify(state.eventSummaryTotals));
    }

    scheduleSave();
    render();
  }

  function registerShowEndMarker(currentType) {
    if (!currentType) return;
    const timestamp = Date.now();
    const showName = currentType === "Grupo"
      ? "Show em Grupo"
      : currentType === "Ticket"
        ? "Ticket show"
        : `Show ${currentType}`;
    const eventItem = {
      id: `scm-show-end-${timestamp}-${Math.random()}`,
      time: timestamp,
      timestamp,
      type: showName,
      user: "—",
      tokens: 0,
      price: 0,
      item: `${showName} (Fim)`,
      showBoundary: "end",
    };
    const todayBucket = ensureDailyBucket(localDateKey(timestamp));
    if (!Array.isArray(todayBucket.capturedEvents)) todayBucket.capturedEvents = [];
    todayBucket.capturedEvents.push(eventItem);
    if (todayBucket.capturedEvents.length > 500) todayBucket.capturedEvents.shift();
    state.capturedEvents = todayBucket.capturedEvents;

    const currentSegment = todayBucket.liveSessions?.[state.sessionId];
    if (currentSegment) {
      if (!Array.isArray(currentSegment.capturedEvents)) currentSegment.capturedEvents = [];
      currentSegment.capturedEvents.push(eventItem);
      if (currentSegment.capturedEvents.length > 500) currentSegment.capturedEvents.shift();
    }

    scheduleSave();
  }

  function endActiveShow() {
    if (activeShowCategory && state._showInitialCharged) {
      registerShowEndMarker(activeShowCategory);
    }
    activeShowCategory = null;
    showSecondsCounter = 0;
    state._showInitialCharged = false;
  }

  function getOpenTicketShowMarkerCount() {
    const events = ensureDailyBucket(localDateKey()).capturedEvents || [];
    const boundaries = events
      .filter((event) =>
        event?.showBoundary &&
        /ticket show/i.test(`${event.type || ""} ${event.item || ""}`)
      )
      .sort((a, b) =>
        (Number(a.timestamp ?? a.time) || 0) - (Number(b.timestamp ?? b.time) || 0)
      );
    return boundaries.reduce((openCount, event) => {
      if (event.showBoundary === "start") return openCount + 1;
      if (event.showBoundary === "end") return Math.max(0, openCount - 1);
      return openCount;
    }, 0);
  }

  let lastTickTime = Date.now();

  function updateLiveTimers() {
    if (!getMonitoring()) {
      if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
      }
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastTickTime) / 1000);
    if (elapsedSeconds <= 0) return;

    lastTickTime += elapsedSeconds * 1000;

    const today = localDateKey();
    if (timerDayDate && timerDayDate !== today) {
      handleMidnightRollover(timerDayDate, today, now);
    } else if (!timerDayDate) {
      timerDayDate = today;
    }

    const bucket = ensureDailyBucket(today);

    const liveData = parseLiveStates();
    if (!liveData.isTicketShow) {
      if (activeShowCategory === "Ticket") {
        endActiveShow();
      } else if (activeShowCategory === null) {
        const openTicketShowCount = getOpenTicketShowMarkerCount();
        for (let index = 0; index < openTicketShowCount; index += 1) {
          registerShowEndMarker("Ticket");
        }
      }
    }
    trackUserSyncBehavior(getActiveUsersSet(), liveData.isRestrictedShowState);

    totalBruteSeconds += elapsedSeconds;
    bruteDaySeconds += elapsedSeconds;
    bucket.bruteDaySeconds = bruteDaySeconds;

    if (liveData.isLiveActive) {
      totalNetSeconds += elapsedSeconds;
      netDaySeconds += elapsedSeconds;
      bucket.netDaySeconds = netDaySeconds;
      startOrTouchLiveSegment(today, now);

      let currentType = null;
      let ratePrice = 0;
      const pricesSource = state.showPrices || state.prices || {};

      if (liveData.isExclusiveShow) {
        currentType = "Exclusivo";
        ratePrice = Number(pricesSource.vipTkMin || pricesSource.exclusive || pricesSource.vip || 0);
      } else if (liveData.isPrivateShow) {
        currentType = "Privado";
        ratePrice = Number(pricesSource.privateTkMin || pricesSource.private || pricesSource.prices?.privateTkMin || 0);
      } else if (liveData.isGroupShow) {
        currentType = "Grupo";
        ratePrice =
          state.currentGroupShowRate ||
          liveData.groupRatePrice * Math.max(1, liveData.groupParticipantsCount);
      } else if (liveData.isTicketShow) {
        currentType = "Ticket";
      }

      const openTicketShowCount = activeShowCategory === null
        ? getOpenTicketShowMarkerCount()
        : 0;
      if (openTicketShowCount > 0) {
        if (currentType === "Ticket") {
          for (let index = 1; index < openTicketShowCount; index += 1) {
            registerShowEndMarker("Ticket");
          }
          activeShowCategory = "Ticket";
          state._showInitialCharged = true;
        } else {
          for (let index = 0; index < openTicketShowCount; index += 1) {
            registerShowEndMarker("Ticket");
          }
        }
      }

      if (currentType !== activeShowCategory) {
        endActiveShow();
        showSecondsCounter = 0;
        activeShowCategory = currentType;
      }

      if (currentType === "Ticket") {
        showSecondsCounter = 0;
        if (!state._showInitialCharged) {
          state._showInitialCharged = true;
          registerShowTokenEvent(currentType, 0, 0, 0, true);
        }
      } else if (currentType && ratePrice > 0) {
        showSecondsCounter += elapsedSeconds;

        if (!state._showInitialCharged) {
          state._showInitialCharged = true;
          registerShowTokenEvent(
            currentType,
            ratePrice,
            liveData.groupRatePrice,
            liveData.groupParticipantsCount,
            true
          );
        }

        while (showSecondsCounter >= 60) {
          showSecondsCounter -= 60;
          registerShowTokenEvent(
            currentType,
            ratePrice,
            liveData.groupRatePrice,
            liveData.groupParticipantsCount,
            false
          );
        }
      } else {
        showSecondsCounter = 0;
      }
    } else if (liveData.isOfflineState || !liveData.isAguarde) {
      endActiveShow();
    }

    recalculateTotalTokens();

    const currentTotalTokens = Number(state.totalTokens) || 0;
    const tokensDelta = Math.max(0, currentTotalTokens - lastMinuteMetricTotalTokens);
    lastMinuteMetricTotalTokens = currentTotalTokens;
    bucket.dailyTokens = Math.max(
      0,
      (Number(state.totalTokens) || 0) - (Number(bucket.dayStartTokens) || 0)
    );
    const leagueCountsAreFresh =
      Date.now() - (Number(state.leagueCountsUpdatedAt) || 0) <= 15000;
    const leagueCounts =
      liveData.isLiveActive && leagueCountsAreFresh ? state.leagueCounts : null;

    recordMinuteMetric(
      state.currentViewers,
      tokensDelta,
      liveData.isLiveActive ? elapsedSeconds : 0,
      liveData.isLiveActive,
      state.listedUsersCount,
      leagueCounts,
    );

    updatePersistentTimerState();

    if (totalBruteSeconds % 10 === 0) scheduleSave();

    const bruteEl = document.getElementById("scm-time-brute");
    const netEl = document.getElementById("scm-time-net");
    if (bruteEl) bruteEl.textContent = formatTime(totalBruteSeconds);
    if (netEl) netEl.textContent = formatTime(totalNetSeconds);

    const bruteDayEl = document.getElementById("scm-time-brute-day");
    const netDayEl = document.getElementById("scm-time-net-day");
    if (bruteDayEl) bruteDayEl.textContent = formatTime(bruteDaySeconds);
    if (netDayEl) netDayEl.textContent = formatTime(netDaySeconds);

    const totalTokensVal = Number(state.totalTokens) || 0;
    const sessionStartVal = Number(state._sessionTokensStart) || 0;
    const sessionTokensVal = Math.max(0, totalTokensVal - sessionStartVal);

    const sessionTokensEl = document.getElementById("scm-session-tokens");
    if (sessionTokensEl) sessionTokensEl.textContent = `${Math.round(sessionTokensVal)} tk`;
  }

  function startLiveTimer() {
    lastTickTime = Date.now();
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    liveTimerInterval = setInterval(updateLiveTimers, 1000);
  }

  function detectSuspectBots() {
    if (isRoomOfflineNow()) {
      state.suspectBots = [];
      return [];
    }

    const nowTime = Date.now();
    const TEST_TIME_MS = 20 * 60 * 1000;
    const suspects = [];
    const botPattern = /^(user|guest|bot|anon|player)\d+|_?\d{5,}$/i;

    if (!state.users) return [];
    if (!state.suspectBotHistory || typeof state.suspectBotHistory !== "object") {
      state.suspectBotHistory = {};
    }
    const dayKeyForPrune = localDateKey();
    Object.entries(state.suspectBotHistory).forEach(([historyKey, entry]) => {
      if (!entry?.lastSeenDay) {
        delete state.suspectBotHistory[historyKey];
        return;
      }
      const lastSeen = new Date(`${entry.lastSeenDay}T12:00:00`);
      const current = new Date(`${dayKeyForPrune}T12:00:00`);
      if (Math.floor((current - lastSeen) / 86400000) > 30) {
        delete state.suspectBotHistory[historyKey];
      }
    });
    if (!Array.isArray(state.dismissedSuspectBots)) state.dismissedSuspectBots = [];
    state.dismissedSuspectBots.forEach((username) => dismissedBots.add(String(username).toLowerCase()));

    for (const [username, user] of Object.entries(state.users)) {
      if (!user) continue;

      if (dismissedBots.has(username.toLowerCase())) continue;
      if (!user.isListed) continue;

      const visitStartedAt = Number(user._currentVisitStart);
      if (!visitStartedAt || visitStartedAt > nowTime) {
        user._currentVisitStart = nowTime;
      }

      const timeInRoom = nowTime - Number(user._currentVisitStart);
      const messagesCount = Math.max(
        0,
        (Number(user.messages) || 0) - (Number(user._visitMessagesStart) || 0),
      );
      const tokensCount = Math.max(
        0,
        (Number(user.tokens) || 0) - (Number(user._visitTokensStart) || 0),
      );
      const recentActivityWindow = 30 * 1000;
      const messagedDuringVisit =
        Number(user._lastMessageTimestamp) >= Number(user._currentVisitStart) - recentActivityWindow;
      const tippedDuringVisit =
        Number(user._lastTipTimestamp) >= Number(user._currentVisitStart) - recentActivityWindow;

      const league = String(user.league || "grey").toLowerCase();
      const userLevel = Number(user.level || 0);

      if (league !== "grey" || userLevel > 9) continue;

      if (user._lastSyncActionTime && nowTime - user._lastSyncActionTime > 30 * 60 * 1000) {
        if (user.syncExits > 0) user.syncExits--;
        if (user.syncReturns > 0) user.syncReturns--;
        user._lastSyncActionTime = nowTime;
      }

      const syncExitsCount = Number(user.syncExits || 0);
      const syncReturnsCount = Number(user.syncReturns || 0);
      const totalSyncActions = syncExitsCount + syncReturnsCount;

      const isInactiveLongTime =
        timeInRoom >= TEST_TIME_MS &&
        messagesCount === 0 &&
        tokensCount === 0 &&
        !messagedDuringVisit &&
        !tippedDuringVisit;

      if (isInactiveLongTime) {
        const hasWeirdName = botPattern.test(username) || /\d{4,}/.test(username);
        const repeatedSync = totalSyncActions >= 2;

        let suspicionScore = 5;
        if (hasWeirdName) suspicionScore += 35;
        if (repeatedSync) suspicionScore += 35;
        else if (totalSyncActions === 1) suspicionScore += 15;
        if (timeInRoom >= 60 * 60 * 1000) suspicionScore += 10;

        if (suspicionScore < 30) continue;

        let levelDescription = "Alto (Inatividade prolongada)";
        if (hasWeirdName && repeatedSync) levelDescription = "Crítico (Nome suspeito + entradas/saídas repetidas)";
        else if (hasWeirdName) levelDescription = "Alto (Nome genérico ou numérico)";
        else if (repeatedSync) levelDescription = "Alto (Entradas/saídas sincronizadas)";

        const dayKey = localDateKey();
        const historyKey = username.toLowerCase();
        const previous = state.suspectBotHistory[historyKey];
        const isConsecutive =
          previous?.lastSeenDay &&
          (() => {
            const previousDate = new Date(`${previous.lastSeenDay}T12:00:00`);
            const currentDate = new Date(`${dayKey}T12:00:00`);
            return Math.round((currentDate - previousDate) / 86400000) === 1;
          })();

        const history = {
          username,
          firstSeenDay: previous?.firstSeenDay || dayKey,
          lastSeenDay: dayKey,
          occurrences: (Number(previous?.occurrences) || 0) + (previous?.lastSeenDay === dayKey ? 0 : 1),
          consecutiveDays: isConsecutive ? (Number(previous?.consecutiveDays) || 0) + 1 : 1,
          bestScore: Math.max(Number(previous?.bestScore) || 0, suspicionScore),
          league,
          level: userLevel,
        };
        state.suspectBotHistory[historyKey] = history;

        suspects.push({
          username,
          timeInRoomMinutes: Math.max(0, Math.floor(timeInRoom / 60000)),
          league: `${league} (Nível ${userLevel})`,
          syncExits: syncExitsCount,
          syncReturns: syncReturnsCount,
          messages: messagesCount,
          tokens: tokensCount,
          suspicionScore,
          suspicionLevel: levelDescription,
          firstSeenDay: history.firstSeenDay,
          lastSeenDay: history.lastSeenDay,
          occurrences: history.occurrences,
          consecutiveDays: history.consecutiveDays,
        });
      }
    }

    suspects.sort((a, b) => b.suspicionScore - a.suspicionScore);
    state.suspectBots = suspects;
    ensureDailyBucket(localDateKey()).suspectBots = suspects.map((suspect) => ({ ...suspect }));
    return suspects;
  }

  function closeListedUserVisits(endTs = Date.now()) {
    Object.values(state.users || {}).forEach((user) => {
      if (!user?.isListed) return;
      const visitStart = Number(user._currentVisitStart) || endTs;
      const visitDuration = Math.max(0, Math.floor((endTs - visitStart) / 1000));
      user._currentVisitDuration = visitDuration;
      user.totalTimeSpent = (Number(user.totalTimeSpent) || 0) + visitDuration;
      user.isListed = false;
      user._currentVisitStart = null;
    });
  }

  function collect(processExistingMessages = false) {
    if (roomRestorePending) return;
    updateExtensionIcon();
    const currentRoom = roomName();
    if (handleRoomChange(currentRoom)) return;

    if (autoMonitorOnLive) {
      checkWatchedModelLiveStatus();
    }

    if (isRoomOfflineNow()) {
      if (!roomOfflineState) state.suspectBots = [];
      if (!autoMonitorOnLive || !getMonitoring()) {
        closeListedUserVisits();
        roomOfflineState = true;
        state.currentViewers = 0;
        const panel = document.getElementById("scm-panel");
        if (panel && panel.style.display === "flex") render();
        return;
      }
      state.currentViewers = 0;
    }

    if (roomOfflineState) {
      roomOfflineState = false;
    }

    checkActiveCamTicketPrice();
    state.room = currentRoom;
    state.modelName = currentRoom;
    triggerTooltipsOnce();
    state.roomKing = parseRoomKing();

    const v = isRoomOfflineNow() ? 0 : getViewerCount();
    if (v !== null && !isNaN(v)) {
      state.currentViewers = v;
      state.lastViewerSampleAt = Date.now();
      state.viewerSamples.push(v);
      if (state.viewerSamples.length > 1000) state.viewerSamples.shift();

      state.peakViewers = Math.max(state.peakViewers || 0, v, ...state.viewerSamples);
      state._sessionPeakViewers = Math.max(state._sessionPeakViewers || 0, v);
      state.avgViewers = Math.round(state.viewerSamples.reduce((acc, val) => acc + val, 0) / state.viewerSamples.length);
    }

    parseGoal();
    if (processExistingMessages) {
      document
        .querySelectorAll(".messages-v2 .message-base, .message")
        .forEach((message) =>
          processChatMessageSafely(message, {
            ignoreTicketPriceAnnouncement: true,
            ignoreTicketPurchaseCorrelation: true,
          }),
        );
    }

    scanUsers();
    readUserListCounts();
    pruneUserRecords();
    updateStatsSummary(getMonitoring());
    detectSuspectBots();

    if (getMonitoring()) {
      recalculateTotalTokens();
      scheduleSave();
    }

    const panel = document.getElementById("scm-panel");
    if (panel && panel.style.display === "flex") render();
  }

  function scheduleSave() {
    if (!getMonitoring()) return;
    updatePersistentTimerState();
    if (saveTimer) return;
    const elapsedSinceSave = Date.now() - lastHistorySaveAt;
    const delay = Math.max(0, SAVE_INTERVAL_MS - elapsedSinceSave);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!getMonitoring()) return;
      updatePersistentTimerState();
      persistCurrentState();
    }, delay);
  }

  function persistCurrentState(onComplete, targetDayKey = null) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    lastHistorySaveAt = Date.now();
    saveToGlobalHistory(onComplete, targetDayKey);
  }

  function handlePageHide() {
    if (!getMonitoring() && !saveTimer) return;
    endActiveShow();
    updatePersistentTimerState();
    persistCurrentState();
  }

  function handlePageShow(event) {
    if (!event.persisted || !getMonitoring()) return;
    lastTickTime = Date.now();
    startLiveTimer();
  }

  function saveNow(callback) {
    if (!core.KEY || !state.modelId) {
      resolveStorageKey();
    }
    if (!core.KEY || !state.modelId) {
      callback?.({
        ok: false,
        error: "Não foi possível identificar o modelo para salvar os dados.",
      });
      return;
    }
    updatePersistentTimerState();
    const b = document.querySelector("#scm-save");
    if (b) {
      clearTimeout(saveFeedbackTimer);
      b.disabled = true;
      b.textContent = "Salvando...";
    }
    persistCurrentState((result) => {
      if (result?.ok) render();
      if (b) {
        b.disabled = false;
        b.textContent = result?.ok ? "Dados guardados!" : "Falha ao guardar";
        clearTimeout(saveFeedbackTimer);
        saveFeedbackTimer = setTimeout(() => {
          b.textContent = "Guardar";
        }, 1800);
      }
      callback?.({
        ok: result?.ok === true,
        error: result?.error?.message || (result?.ok ? undefined : "Não foi possível salvar os dados."),
      });
    });
  }

  function triggerTooltipsOnce() {
    const now = Date.now();
    if (now - lastKingGoalCheckTime < 8000) return;
    lastKingGoalCheckTime = now;

    const kingEl = document.querySelector("#view_cam_info_king, .view-cam-info-king");
    if (kingEl) {
      if (!kingTooltipTargets.has(kingEl)) {
        kingTooltipTargets.add(kingEl);
        kingEl.addEventListener("pointerenter", () => {
          [250, 700].forEach((delay) => {
            setTimeout(() => {
              if (!getMonitoring() || !kingEl.isConnected || !kingEl.matches(":hover")) return;

              const previousState = `${state.roomKing}|${state.kingTokensSource}|${state.kingSiteTokens}`;
              state.roomKing = parseRoomKing();
              const nextState = `${state.roomKing}|${state.kingTokensSource}|${state.kingSiteTokens}`;
              if (nextState === previousState) return;

              updateStatsSummary(true);
              scheduleSave();
              const panel = document.getElementById("scm-panel");
              if (panel && panel.style.display === "flex") render();
            }, delay);
          });
        });
      }

      ["pointerenter", "mouseover", "mouseenter"].forEach((eventType) => {
        kingEl.dispatchEvent(new PointerEvent(eventType, { bubbles: true, cancelable: true, view: window }));
      });
    }

    const goalEl = document.querySelector(".epic-goal-progress__wrap--view-cam, .epic-goal-progress");
    if (goalEl) {
      ["pointerenter", "mouseover", "mouseenter"].forEach((eventType) => {
        goalEl.dispatchEvent(new PointerEvent(eventType, { bubbles: true, cancelable: true, view: window }));
      });
    }
  }

  function setAutoCollect(enabled) {
    autoCollectEnabled = Boolean(enabled);
    state.autoCollectEnabled = autoCollectEnabled;
    if (autoCollectEnabled && getMonitoring()) {
      startAutoCollection();
    } else {
      stopAutoCollection();
    }
    render();
  }

  function startAutoCollection() {
    autoCollection.start();
  }

  function stopAutoCollection() {
    autoCollection.stop();
  }

  function createSessionId() {
    return globalThis.crypto?.randomUUID?.() || `scm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function onSessionStartOrRoomSwitch() {
    totalBruteSeconds = 0;
    totalNetSeconds = 0;
    showSecondsCounter = 0;
    activeShowCategory = null;
    lastTickTime = Date.now();
    state.sessionId = createSessionId();
    resetSessionStats(true);
    ensureDailyBucket(localDateKey());
  }

  function clearRoomData() {
    totalBruteSeconds = 0;
    totalNetSeconds = 0;
    bruteDaySeconds = 0;
    netDaySeconds = 0;
    timerDayDate = localDateKey();
    showSecondsCounter = 0;
    activeShowCategory = null;

    resetSessionStats(false);

    Object.assign(state, {
      users: {},
      capturedEvents: [],
      events: [],
      eventSummaryTotals: {},
      goals: [],
      todos: [],
      moderationLogs: [],
      mutedUsers: [],
      mutedUsersDetails: [],
      suspectBots: [],
      suspectBotHistory: {},
      dismissedSuspectBots: [],
      autoCollectEnabled: false,
      autoMonitorOnLive: false,
      watchedModelId: null,
      currentViewers: null,
      roomKing: "Nenhum",
      roomKingName: "",
      kingTokens: 0,
      kingSiteTokens: 0,
      kingTokensSource: "site",
      kingThreshold: 0,
      kingStateDate: "",
      currentTicketPrice: 0,
      currentGroupShowRate: 0,
      listedUsersCount: 0,
      otherUsersCount: 0,
      tokensUsersCount: 0,
      ultimateUsersCount: 0,
      invisibleUsersCount: 0,
      moreUsersCount: 0,
      leagueCounts: { grey: 0, bronze: 0, silver: 0, gold: 0, diamond: 0, royal: 0, legend: 0 },
      timerState: { bruteSeconds: 0, netSeconds: 0, showSecondsCounter: 0, activeShowCategory: null },
    });

    processedMessageIds.clear();
    state.sessionId = createSessionId();

    const today = localDateKey();
    state.dailyKey = today;
    state.dailyBuckets = {};
    const bucket = ensureDailyBucket(today);
    if (!Array.isArray(bucket.capturedEvents)) bucket.capturedEvents = [];
    state.capturedEvents = bucket.capturedEvents;
    bucket.dayStartTokens = 0;

    const panel = document.getElementById("scm-panel");
    if (panel) {
      panel.querySelectorAll(".scroll").forEach((scrollEl) => {
        scrollEl.style.height = "";
      });
      if (panel.style.display === "flex") render();
    }
  }

  function restoreSavedState(saved, room) {
    if (!saved || typeof saved !== "object") return false;
    Object.assign(state, saved);
    state.currentTicketPrice = 0;

    if (!Array.isArray(state.dismissedSuspectBots)) state.dismissedSuspectBots = [];
    state.dismissedSuspectBots.forEach((username) => dismissedBots.add(String(username).toLowerCase()));

    state.modelId = core.KEY.replace(/^scm:model:/, "");
    state.room = room;
    state.modelName = saved.modelName || room;

    resetSessionStats(true);
    const today = localDateKey();
    const bucket = ensureDailyBucket(today);
    if (saved.dailyBuckets?.[today]) {
      Object.assign(bucket, saved.dailyBuckets[today]);
    }

    if (!Array.isArray(state.events)) state.events = [];
    if (!Array.isArray(state.capturedEvents)) state.capturedEvents = [];
    state.events = state.events.filter((event) => {
      const eventTs = Number(event?.timestamp ?? event?.time);
      return eventTs > 0 ? localDateKey(eventTs) === today : true;
    });
    const savedEvents = state.capturedEvents.filter((event) => {
      const eventTs = Number(event?.timestamp ?? event?.time);
      return eventTs > 0 ? localDateKey(eventTs) === today : true;
    });
    const bucketEvents = Array.isArray(bucket.capturedEvents)
      ? bucket.capturedEvents.filter((event) => {
          const eventTs = Number(event?.timestamp ?? event?.time);
          return eventTs > 0 ? localDateKey(eventTs) === today : true;
        })
      : [];
    const mergedEvents = new Map();
    [...savedEvents, ...bucketEvents].forEach((event) => {
      const key = event?.id || `${event?.timestamp ?? event?.time}-${event?.item}-${event?.price}`;
      if (!mergedEvents.has(key)) mergedEvents.set(key, event);
    });
    bucket.capturedEvents = Array.from(mergedEvents.values()).slice(-500);
    state.capturedEvents = bucket.capturedEvents;
    if (bucket.eventSummaryTotals && typeof bucket.eventSummaryTotals === "object") {
      state.eventSummaryTotals = JSON.parse(JSON.stringify(bucket.eventSummaryTotals));
    } else if (state.capturedEvents.length === 0) {
      state.eventSummaryTotals = {};
    }
    if (bucket.dayStartTokens === undefined || bucket.dayStartTokens === null) {
      bucket.dayStartTokens = Number(state.totalTokens) || 0;
    }

    const savedTimer = saved.timerState || {};
    totalBruteSeconds = 0;
    totalNetSeconds = 0;

    bruteDaySeconds = Number(bucket.bruteDaySeconds ?? savedTimer.bruteDaySeconds) || 0;
    netDaySeconds = Number(bucket.netDaySeconds ?? savedTimer.netDaySeconds) || 0;
    timerDayDate = today;

    state.timerState = {
      bruteSeconds: 0,
      netSeconds: 0,
      showSecondsCounter: 0,
      activeShowCategory: null,
      bruteDaySeconds,
      netDaySeconds,
      timerDayDate,
    };

    state.sessionId = createSessionId();

    if (!state.users || typeof state.users !== "object") state.users = {};
    Object.values(state.users).forEach((u) => {
      if (u && !u.firstSeenDate) {
        u.firstSeenDate = "legacy";
      }
    });
    if (!Array.isArray(state.events)) state.events = [];
    if (!Array.isArray(state.capturedEvents)) state.capturedEvents = [];
    if (!Array.isArray(state.moderationLogs)) state.moderationLogs = [];
    if (!state.eventSummaryTotals || typeof state.eventSummaryTotals !== "object") {
      state.eventSummaryTotals = {};
    }
    return true;
  }

  function restoreCurrentRoomAfterBackup(storageData) {
    if (getMonitoring()) {
      throw new Error("Pause o monitoramento antes de restaurar um backup.");
    }

    const currentRoom = roomName();
    dismissedBots.clear();
    stopAutoCollection();
    if (watchInterval) {
      clearInterval(watchInterval);
      watchInterval = null;
    }
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    clearRoomData();
    state.room = currentRoom;
    state.modelName = currentRoom;
    resolveStorageKey();

    if (!restoreSavedState(storageData?.[core.KEY], currentRoom)) {
      state.room = currentRoom;
      state.modelName = currentRoom;
      state.sessionId = createSessionId();
    }

    const modelKeywords = storageData?.[`scm:model:${state.modelId}:moderation_keywords`];
    const globalKeywords = storageData?.scm_global_moderation_keywords;
    const keywords = modelKeywords ?? globalKeywords ?? [];
    state.moderationKeywords = Array.isArray(keywords) ? keywords : [];
    state.autoCollectEnabled = false;
    state.autoMonitorOnLive = false;
    state.watchedModelId = null;
    autoCollectEnabled = false;
    autoMonitorOnLive = false;
    watchedModelId = null;
    roomOfflineState = isRoomOfflineNow();
    updatePersistentTimerState();
    render();
    collect();
  }

  function handleRoomChange(currentRoom, force = false) {
    if (!force && (!state.room || state.room === currentRoom)) return false;

    if (getMonitoring()) {
      console.info(`[SC Monitor] Monitoramento pausado por mudança de sala: ${currentRoom}.`);
      persistCurrentState();
    }

    core.setMonitoring(false);
    window.__scmMonitoringIntent = false;
    updateExtensionIcon(false);
    stopAutoCollection();
    autoCollectEnabled = false;
    autoMonitorOnLive = false;
    watchedModelId = null;
    state.autoCollectEnabled = false;
    state.autoMonitorOnLive = false;
    state.watchedModelId = null;
    dismissedBots.clear();
    if (watchInterval) {
      clearInterval(watchInterval);
      watchInterval = null;
    }
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    offlineSinceAt = 0;
    clearRuntimeHandles();

    onSessionStartOrRoomSwitch();

    const bruteEl = document.getElementById("scm-time-brute");
    const netEl = document.getElementById("scm-time-net");
    if (bruteEl) bruteEl.textContent = "00:00:00";
    if (netEl) netEl.textContent = "00:00:00";

    clearRoomData();
    state.room = currentRoom;
    state.modelName = currentRoom;
    resolveStorageKey();
    roomRestorePending = true;
    const roomKey = core.KEY;
    const roomId = state.modelId;

    safeStorage.get(
      [roomKey, `scm:model:${roomId}:moderation_keywords`, "scm_global_moderation_keywords"],
      (data) => {
        if (state.room !== currentRoom) return;
        const restored = restoreSavedState(data?.[roomKey], currentRoom);
        if (!restored) {
          state.room = currentRoom;
          state.modelName = currentRoom;
          state.sessionId = state.sessionId || createSessionId();

          const currentSavedData = data?.[roomKey] || {};
          state.fanClubPrices = currentSavedData.fanClubPrices || { soldado: 0, lord: 0, principe: 0 };
          state.showPrices = currentSavedData.showPrices || { privateTkMin: 0, vipTkMin: 0 };
          state.moderationKeywords = [];
        }
        const keywords =
          data?.[`scm:model:${roomId}:moderation_keywords`] ??
          data?.scm_global_moderation_keywords ??
          state.moderationKeywords;
        state.moderationKeywords = Array.isArray(keywords) ? keywords : [];
        state.autoCollectEnabled = autoCollectEnabled;
        state.autoMonitorOnLive = autoMonitorOnLive;
        state.watchedModelId = watchedModelId;
        clearAutomationConfig();
        roomOfflineState = isRoomOfflineNow();
        updatePersistentTimerState();
        roomRestorePending = false;

        render();
        collect();
      }
    );

    return true;
  }

  function toggleMonitoring() {
    if (recoveryResumeTimer) {
      clearTimeout(recoveryResumeTimer);
      recoveryResumeTimer = null;
    }
    if (getMonitoring()) {
      stopMonitoringSession(true, "botão do monitor");
    } else {
      startMonitoringSession();
    }
  }

  function resetData(callback) {
    if (getMonitoring()) {
      console.info("[SC Monitor] Monitoramento pausado para limpar os dados.");
    }
    setMonitoring(false);
    window.__scmMonitoringIntent = false;
    updateExtensionIcon(false);
    stopAutoCollection();
    clearRuntimeHandles();
    invalidatePendingHistorySaves();

    const modelKey = state.modelId || state.room;
    const modelPrefix = `scm:model:${modelKey}`;

    safeStorage.get(null, (allData) => {
      const keysToRemove = Object.keys(allData || {}).filter((key) =>
        key === modelPrefix ||
        key.startsWith(`${modelPrefix}:daily:`) ||
        key === `${modelPrefix}:moderation_keywords`
      );

      const history = allData?.scm_rooms_history;
      let updatedHistory = history;
      if (history && typeof history === "object") {
        updatedHistory = { ...history };
        Object.entries(updatedHistory).forEach(([entryKey, entry]) => {
          if (
            entryKey === modelKey ||
            entry?.modelId === modelKey ||
            entryKey.startsWith(`${modelKey}::`)
          ) {
            delete updatedHistory[entryKey];
          }
        });
      }

      const finishReset = () => {
        clearRoomData();
        state.room = roomName();
        state.modelName = state.room;
        state.sessionId = createSessionId();
        render();
        callback?.({ ok: true });
      };

      safeStorage.remove(keysToRemove, () => {
        safeStorage.set({ scm_rooms_history: updatedHistory || {} }, finishReset);
      });
    });
  }

  function resumeMonitoringWhenLiveActive(attemptsRemaining = 30) {
    if (getMonitoring() || backupRestorePending) return;
    if (parseLiveStates().isLiveActive) {
      recoveryResumeTimer = null;
      startMonitoringSession();
      return;
    }
    if (attemptsRemaining <= 0) {
      recoveryResumeTimer = null;
      return;
    }
    recoveryResumeTimer = setTimeout(() => {
      recoveryResumeTimer = null;
      resumeMonitoringWhenLiveActive(attemptsRemaining - 1);
    }, 1000);
  }

  function getSummary() {
    return {
      ok: true,
      monitoring: getMonitoring(),
      modelId: state.modelId,
      modelName: state.modelName || state.room,
      currentViewers: state.currentViewers,
      peakViewers: state.peakViewers,
      listedUsersCount: state.listedUsersCount,
      otherUsersCount: state.otherUsersCount,
      tokensUsersCount: state.tokensUsersCount,
      ultimateUsersCount: state.ultimateUsersCount,
      invisibleUsersCount: state.invisibleUsersCount,
      moreUsersCount: state.moreUsersCount,
      totalTokens: state.totalTokens,
    };
  }

  function togglePanel() {
    const panel = document.getElementById("scm-panel");
    const launch = document.getElementById("scm-launch");
    if (!panel || !launch) return false;

    if (panel.style.display === "flex") {
      panel.querySelector("#scm-close")?.click();
    } else {
      launch.click();
    }

    return true;
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    if (!message?.type) return false;
    switch (message.type) {
      case "SCM_GET_SUMMARY":
        sendResponse(getSummary());
        break;
      case "SCM_TOGGLE":
        sendResponse({ ok: togglePanel() });
        break;
      case "SCM_TOGGLE_MONITOR":
        toggleMonitoring();
        sendResponse({ ...getSummary() });
        break;
      case "SCM_SAVE":
        saveNow(sendResponse);
        return true;
      case "SCM_PREPARE_BACKUP_RESTORE":
        if (getMonitoring()) {
          sendResponse({ ok: false, monitoring: true });
          break;
        }
        backupRestorePending = true;
        waitForHistorySaves().then(
          () => {
            if (getMonitoring()) {
              backupRestorePending = false;
              sendResponse({ ok: false, monitoring: true });
              return;
            }
            sendResponse({ ok: true });
          },
          (error) => {
            backupRestorePending = false;
            sendResponse({ ok: false, error: error.message });
          },
        );
        return true;
      case "SCM_BACKUP_RESTORED":
        try {
          restoreCurrentRoomAfterBackup(message.data);
          sendResponse({ ok: true });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        break;
      case "SCM_FINISH_BACKUP_RESTORE":
        backupRestorePending = false;
        sendResponse({ ok: true });
        break;
      case "SCM_GET_STATUS":
        sendResponse({
          ok: true,
          modelId: String(state.modelId || ""),
          monitoring: getMonitoring(),
        });
        break;
      case "SCM_EXPORT":
        downloadCSV();
        sendResponse({ ok: true });
        break;
      case "SCM_DISMISS_SUSPECT_BOT":
        if (
          String(message.modelId || "") !== String(state.modelId || "") ||
          !String(message.username || "").trim()
        ) {
          sendResponse({ ok: false, ignored: true });
          break;
        }
        window.__scmDismissBot(String(message.username));
        sendResponse({ ok: true });
        break;
      case "SCM_RESET":
        resetData(sendResponse);
        return true;
      default:
        return false;
    }
    return false;
  }
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  window.__scmToggleMonitoring = toggleMonitoring;
  window.__scmDispose = () => {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("pageshow", handlePageShow);
    if (getMonitoring()) {
      stopMonitoringSession(true, "contexto da extensão encerrado");
    } else {
      stopAutoCollection();
      clearRuntimeHandles();
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (watchInterval) {
      clearInterval(watchInterval);
      watchInterval = null;
    }
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    if (spaInterval) {
      clearInterval(spaInterval);
      spaInterval = null;
    }

    try {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    } catch (error) {
      console.warn("[SC Monitor] Não foi possível remover o listener anterior.", error);
    }

    window.__scmMonitoringIntent = false;
    if (!isCurrentBoot()) return;
    window.__scmLoading = false;
    window.__stripchatMonitorLoaded = false;
  };
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);

  async function init() {
    resolveStorageKey();
    clearRoomData();

    await new Promise((resolve, reject) => {
      safeStorage.get(
        [
          core.KEY,
          "scm_global_moderation_keywords",
          `scm:model:${state.modelId}:moderation_keywords`,
          ...AUTOMATION_CONFIG_KEYS,
        ],
        (data, readResult) => {
          if (!isCurrentBoot()) {
            reject(new Error("Inicialização substituída por uma recuperação."));
            return;
          }
          if (readResult?.ok === false) {
            reject(readResult.error || new Error("Falha ao ler os dados salvos."));
            return;
          }
          try {
            const initialRoom = roomName();
            const restored = restoreSavedState(data?.[core.KEY], initialRoom);
            if (!restored) {
              state.room = initialRoom;
              state.modelName = initialRoom;
              state.sessionId = createSessionId();
            }
            const savedKeywords =
              data?.[`scm:model:${state.modelId}:moderation_keywords`] ??
              data?.scm_global_moderation_keywords ??
              state.moderationKeywords;
            state.moderationKeywords = Array.isArray(savedKeywords) ? savedKeywords : [];

            const automationConfig = loadAutomationConfig(data);
            autoCollectEnabled = automationConfig.autoCollectEnabled;
            autoMonitorOnLive = automationConfig.autoMonitorOnLive;
            watchedModelId = automationConfig.watchedModelId;
            if (automationConfig.hasPersistedAutomationConfig) {
              clearAutomationConfig();
            }
            state.autoCollectEnabled = autoCollectEnabled;
            state.autoMonitorOnLive = autoMonitorOnLive;
            state.watchedModelId = watchedModelId;
            roomOfflineState = isRoomOfflineNow();
            updatePersistentTimerState();

            createUI({
              collect,
              toggleMonitoring,
              saveNow,
              setAutoCollect,
              setAutoMonitorOnLive,
              resetData,
              autoCollectEnabled,
              onDataRestored: restoreCurrentRoomAfterBackup,
            });
            updateExtensionIcon();

            if (autoCollectEnabled) startAutoCollection();
            if (autoMonitorOnLive) {
              roomOfflineState = isRoomOfflineNow();
              startWatchdog();
              checkWatchedModelLiveStatus();
            }
            const shouldResumeMonitoring = window.__scmRecoveryShouldResume === true;
            window.__scmRecoveryShouldResume = false;
            if (shouldResumeMonitoring) resumeMonitoringWhenLiveActive();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    });

    let lastPath = window.location.pathname;
    let lastModelName = roomName();

    spaInterval = setInterval(() => {
      const currentPath = window.location.pathname;
      const currentModel = roomName();

      if ((currentPath !== lastPath || currentModel !== lastModelName) && currentModel && currentModel !== "Sala Desconhecida") {
        lastPath = currentPath;
        lastModelName = currentModel;

        handleRoomChange(currentModel, true);
      }
    }, 1000);
  }

  async function startInit() {
    if (!isCurrentBoot()) return;
    try {
      await init();
      if (!isCurrentBoot()) return;
      window.__scmLoading = false;
      window.__stripchatMonitorLoaded = true;
    } catch (error) {
      if (!isCurrentBoot()) return;
      try {
        window.__scmDispose?.();
      } catch (cleanupError) {
        console.warn("[SC Monitor] Falha ao limpar uma inicialização incompleta:", cleanupError);
      }
      document.getElementById("scm-panel")?.remove();
      document.getElementById("scm-launch")?.remove();
      window.__scmLoading = false;
      window.__stripchatMonitorLoaded = false;
      console.error("[SC Monitor] Falha ao inicializar:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void startInit(), { once: true });
  } else {
    void startInit();
  }
})();