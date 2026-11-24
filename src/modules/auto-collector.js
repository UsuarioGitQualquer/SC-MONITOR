export function createAutoCollectionController({
  documentRef = document,
  windowRef = window,
  isEnabled,
  isMonitoring,
  collect,
  triggerTooltipsOnce,
  scanUsers,
  readUserListCounts,
  shouldKeepChatTab = () => false,
}) {
  let timer = null;
  let isRunning = false;
  let generation = 0;

  function findChatTab() {
    const navItems = documentRef.querySelectorAll(".model-chat-nav-item");
    for (const item of navItems) {
      if (item.classList.contains("users-tab-wrapper") || item.classList.contains("chat-settings")) continue;
      const text = (item.textContent || "").toLowerCase();
      if (text.includes("público") || text.includes("public") || text.includes("chat")) return item;
    }
    return documentRef.querySelector(".model-chat-nav-item:not(.users-tab-wrapper)") || null;
  }

  function findUsersTab() {
    return documentRef.querySelector('.users-tab-wrapper, .users-tab-wrapper .model-chat-nav-item, [class*="users-tab"]') || null;
  }

  function switchTab(tabElement) {
    if (!tabElement) return false;
    const clickable = tabElement.querySelector('button, a, div[class*="item"]') || tabElement;
    if (tabElement.classList.contains("selected") || tabElement.getAttribute("aria-selected") === "true") return true;

    ["pointerdown", "mousedown", "click"].forEach((eventType) => {
      clickable.dispatchEvent(
        new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: windowRef,
          buttons: 1,
        }),
      );
    });
    return true;
  }

  async function run() {
    if (!isEnabled() || !isMonitoring() || isRunning) return;
    isRunning = true;
    const runGeneration = generation;
    const isCurrentRun = () => runGeneration === generation;

    try {
      const chatTab = findChatTab();
      const usersTab = findUsersTab();

      if (chatTab) switchTab(chatTab);
      triggerTooltipsOnce();
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!isCurrentRun() || !isEnabled() || !isMonitoring()) return;

      collect();

      if (usersTab && !shouldKeepChatTab()) {
        switchTab(usersTab);
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (!isCurrentRun() || !isEnabled() || !isMonitoring()) return;
        scanUsers();
        readUserListCounts();
      }

      if (chatTab) {
        switchTab(chatTab);
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!isCurrentRun() || !isEnabled() || !isMonitoring()) return;
      }
      collect();
    } catch (error) {
      console.error("[SC Monitor] Erro na coleta automática:", error);
    } finally {
      if (isCurrentRun()) isRunning = false;
    }
  }

  function stop() {
    generation++;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isRunning = false;
  }

  function start() {
    if (timer) return;
    stop();
    if (!isEnabled() || !isMonitoring()) return;
    void run();
    timer = setInterval(() => void run(), 15000);
  }

  return { start, stop, run, isRunning: () => isRunning };
}
