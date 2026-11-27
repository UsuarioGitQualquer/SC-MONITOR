import { clean } from "../../utils/helpers.js";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildMutedUserRows(mutedUsers) {
  if (!mutedUsers.length) {
    return `<tr><td colspan="2" style="text-align:center; color:#8b92b8; padding: 16px;">Nenhum usuário silenciado detectado.</td></tr>`;
  }

  return mutedUsers
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aTimestamp = Number(a.item.timestamp ?? a.item._timestamp) || 0;
      const bTimestamp = Number(b.item.timestamp ?? b.item._timestamp) || 0;
      return bTimestamp - aTimestamp || a.index - b.index;
    })
    .map(({ item, index }) => {
      const recentMessages = Array.isArray(item.recentMessages)
        ? item.recentMessages
            .map((message) => String(message || "").trim())
            .filter(Boolean)
            .slice(0, 2)
        : [];
      if (recentMessages.length === 0 && item.lastMessage) {
        recentMessages.push(String(item.lastMessage));
      }
      const messagesHtml = recentMessages
        .map((message) => `<div>"${clean(message)}"</div>`)
        .join("");

      return `
        <tr>
          <td style="vertical-align: top; padding: 8px; width: 35%;">
            <div style="font-weight: bold; color: #ff2a6d;">${clean(item.username)}</div>
            <div style="font-size: 10px; color: #8b92b8; margin-top: 2px;">Por: <span style="color: #ff7b00;">${clean(item.mutedBy)}</span></div>
          </td>
          <td style="color: #f8fafc; font-size: 11px; word-break: break-word; vertical-align: top; padding: 8px; position: relative;">
            ${messagesHtml || "<div>—</div>"}
            <div style="font-size: 9.5px; color: #8b92b8; margin-top: 4px;">${clean(item.time)}</div>
            <button class="scm-muted-del" data-index="${index}" style="position: absolute; right: 6px; top: 6px; background: transparent; border: 0; color: #ff2a6d; cursor: pointer; font-size: 14px;" title="Remover da lista">✕</button>
          </td>
        </tr>`;
    })
    .join("");
}

export function buildModerationLogRows(logs) {
  if (!logs.length) {
    return `<tr><td colspan="2" style="text-align:center; color:#8b92b8; padding: 16px;">Nenhuma mensagem moderada ainda.</td></tr>`;
  }

  return [...logs]
    .reverse()
    .map((log) => {
      const status = String(log.status || "SUCESSO").toUpperCase();
      const statusColor =
        status === "SUCESSO" ? "#00e5ff" : status === "PENDENTE" ? "#ff7b00" : "#ff2a6d";
      const when = log.time || (log.timestamp ? new Date(log.timestamp).toLocaleString() : "");
      const logId = String(log.id || "");
      return `
        <tr>
          <td style="min-width: 110px; vertical-align: top; padding: 8px;">
            <div style="font-weight: bold; color: #ff2a6d;">${clean(log.user)}</div>
            <div style="font-size: 10px; color: #8b92b8; margin-top: 3px;">${clean(when)}</div>
            <div style="font-size: 10px; font-weight: bold; color: ${statusColor}; margin-top: 3px;">${clean(status)}</div>
          </td>
          <td style="word-break: break-word; color: #f8fafc; position: relative; padding: 8px 24px 8px 8px;">
            <div>${clean(log.message)}</div>
            ${log.keyword ? `<div style="font-size: 10px; color: #ff7b00; margin-top: 4px;">Palavra: ${clean(log.keyword)}</div>` : ""}
            ${log.detail ? `<div style="font-size: 10px; color: #8b92b8; margin-top: 3px;">${clean(log.detail)}</div>` : ""}
            ${logId ? `<button type="button" class="scm-modlog-del" data-log-id="${escapeAttribute(logId)}" style="position: absolute; right: 6px; top: 6px; background: transparent; border: 0; color: #ff2a6d; cursor: pointer; font-size: 14px;" title="Remover histórico">✕</button>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");
}

export function buildModerationTagsHtml(keywords) {
  if (!keywords.length) {
    return `<span style="color: #8b92b8; font-size: 11px; font-style: italic;">Nenhuma palavra/frase proibida cadastrada.</span>`;
  }

  return keywords
    .map(
      (keyword, index) => `
        <span style="display: inline-flex; align-items: center; background: #23264d; color: #f8fafc; padding: 4px 10px; border-radius: 99px; font-size: 11px; gap: 6px; border: 1px solid #353970;">
          ${clean(keyword)}
          <button type="button" data-index="${index}" class="scm-remove-tag" style="background: none; border: none; color: #ff2a6d; font-weight: bold; cursor: pointer; padding: 0; font-size: 14px; line-height: 1;" title="Remover">×</button>
        </span>
      `,
    )
    .join("");
}

export function buildSuspectBotRows(suspects) {
  if (!suspects.length) {
    return `<tr><td colspan="3" style="text-align:center; color:#8b92b8; padding: 12px;">Nenhum espectador suspeito detectado.</td></tr>`;
  }

  return [...suspects]
    .map((bot) => {
      let badgeColor = "#ff7b00";
      const description = bot.suspicionLevel || "";
      if (description.includes("Crítico")) badgeColor = "#ff2a6d";
      else if (description.includes("Alto")) badgeColor = "#f97316";

      return `
        <tr>
          <td style="padding: 8px; vertical-align: top;">
            <div style="font-weight: bold; color: #ff2a6d; font-size: 12px;">${clean(bot.username)}</div>
            <div style="font-size: 10px; color: ${badgeColor}; margin-top: 3px; font-weight: bold;">⚠️ ${clean(bot.suspicionLevel)}</div>
          </td>
          <td style="padding: 8px; color: #00e5ff; vertical-align: top; white-space: nowrap; text-align: right; font-weight: 500;">~${Number(bot.timeInRoomMinutes) || 0} min</td>
          <td style="padding: 8px; color: #8b92b8; vertical-align: top; font-size: 11px; text-align: right; padding-right: 36px; position: relative;">
            <div>${clean(bot.league)}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">(${Number(bot.messages) || 0} msgs / ${Number(bot.tokens) || 0} tk)</div>
            ${Number(bot.consecutiveDays) > 1 ? `<div style="font-size: 9px; color: #ff7b00; margin-top: 2px;">${Number(bot.consecutiveDays)} dias seguidos</div>` : ""}
            <button type="button" class="scm-dismiss-bot-btn" data-username="${escapeAttribute(bot.username)}" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: #23264d; border: 1px solid #353970; color: #ff2a6d; border-radius: 6px; cursor: pointer; font-size: 12px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-weight: bold;" title="Dispensar">✕</button>
          </td>
        </tr>
      `;
    })
    .join("");
}
