import { clean } from "../../utils/helpers.js";

export function buildUsersTableHtml(users, filterMode, today, now = Date.now()) {
  const entries = Object.values(users || {});
  const filteredEntries = entries.filter((user) => {
    if (!user) return false;
    if (filterMode === "new") return user.firstSeenDate === today;
    if (filterMode === "returning") return user.firstSeenDate !== today;
    return true;
  });

  if (filteredEntries.length === 0) {
    const emptyMessage =
      filterMode === "new"
        ? "Nenhum usuário novo detectado hoje."
        : filterMode === "returning"
          ? "Nenhum usuário recorrente detectado hoje."
          : 'Nenhum usuário detectado ainda. Clique em "Atualizar" para escanear.';
    return `<tr><td colspan="5" style="text-align:center; color:#8b92b8; padding: 16px;">${emptyMessage}</td></tr>`;
  }

  return filteredEntries
    .sort((a, b) => {
      const aListed = a.isListed ? 1 : 0;
      const bListed = b.isListed ? 1 : 0;
      if (bListed !== aListed) return bListed - aListed;
      return (Number(b.tokens) || 0) - (Number(a.tokens) || 0);
    })
    .slice(0, 100)
    .map((user) => {
      const statusIndicator = user.isListed
        ? `<span style="color: #00e5ff; margin-right: 6px; text-shadow: 0 0 6px #00e5ff;" title="Presente na lista da sala">●</span>`
        : `<span style="color: #475569; margin-right: 6px;" title="Ausente da lista atual">○</span>`;

      const isNewToday = user.firstSeenDate === today;
      const typeBadge = isNewToday
        ? `<span style="background: rgba(0, 229, 255, 0.15); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.4); font-size: 9px; padding: 1px 5px; border-radius: 4px; margin-left: 6px;">Novo</span>`
        : `<span style="background: rgba(255, 42, 109, 0.15); color: #ff2a6d; border: 1px solid rgba(255, 42, 109, 0.4); font-size: 9px; padding: 1px 5px; border-radius: 4px; margin-left: 6px;">Rec.</span>`;

      const userLevel = Number(user.level) || 0;
      const levelDisplay =
        userLevel > 0
          ? ` <span style="color: #8b92b8; font-size: 11px;">(${userLevel})</span>`
          : "";
      const formattedUsername = `${clean(user.name)}${levelDisplay}${typeBadge}`;

      let currentVisitSeconds = 0;
      if (user.isListed) {
        const start = user._currentVisitStart || user._firstSeenTimestamp || now;
        currentVisitSeconds = Math.max(0, Math.floor((now - start) / 1000));
      } else {
        currentVisitSeconds = Math.max(0, Number(user._currentVisitDuration) || 0);
      }

      const currentVisit = `${Math.floor(currentVisitSeconds / 60)}m ${currentVisitSeconds % 60}s`;
      const totalSeconds = Math.max(
        0,
        (Number(user.totalTimeSpent) || 0) +
          (user.isListed ? currentVisitSeconds : 0),
      );
      const totalTime = `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
      const visits = Number(user.visitCount) || 1;

      return `<tr>
        <td>${statusIndicator}${formattedUsername}</td>
        <td><strong style="color: #00e5ff;">${Number(user.tokens) || 0}</strong></td>
        <td>${Number(user.tips) || 0}</td>
        <td>${Number(user.messages) || 0}</td>
        <td style="font-size: 11px; line-height: 1.3;">
          <div><strong>${clean(currentVisit)}</strong></div>
          <div style="font-size: 9px; color: #8b92b8; margin-top: 1px;">
            Total: ${clean(totalTime)} (${visits}x)
          </div>
        </td>
      </tr>`;
    })
    .join("");
}
