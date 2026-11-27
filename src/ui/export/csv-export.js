import { getRoomKingSourceLabel } from "../report-data.js";

function escapeCsvCell(value, protectFormulas = false) {
  let text = String(value ?? "");
  if (protectFormulas && /^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows, protectFormulas = false) {
  return rows
    .map((row) => row.map((value) => escapeCsvCell(value, protectFormulas)).join(";"))
    .join("\r\n");
}

export function buildUsersCsv(users) {
  const rows = [
    [
      "usuario",
      "tokens",
      "gorjetas",
      "mensagens",
      "primeira_aparicao",
      "ultima_aparicao",
      "ultima_mensagem",
    ],
  ];

  Object.values(users || {}).forEach((user) => {
    if (!user) return;
    rows.push([
      user.name,
      Number(user.tokens) || 0,
      Number(user.tips) || 0,
      Number(user.messages) || 0,
      user.firstSeen,
      user.lastSeen,
      user.lastMessage,
    ]);
  });

  return rowsToCsv(rows, true);
}

export function buildDailyReportCsv(report, formatSecondsToTime) {
  const moderationStats = report.moderationStats && typeof report.moderationStats === "object"
    ? report.moderationStats
    : null;
  const moderationLogs = Array.isArray(report.moderationLogs) ? report.moderationLogs : [];
  const moderationAttempts = moderationStats
    ? Number(moderationStats.attempts) || 0
    : moderationLogs.length;
  const moderationSuccesses = moderationStats
    ? Number(moderationStats.successes) || 0
    : moderationLogs.filter((log) => String(log.status || "").toUpperCase() === "SUCESSO").length;
  const moderationFailures = moderationStats
    ? Number(moderationStats.failures) || 0
    : moderationLogs.filter((log) => String(log.status || "").toUpperCase() === "FALHA").length;
  const moderationPending = moderationStats
    ? Number(moderationStats.pending) || 0
    : moderationLogs.filter((log) => String(log.status || "").toUpperCase() === "PENDENTE").length;
  const rows = [
    ["RESUMO DO DIA"],
    [
      "Modelo",
      "Data",
      "Tokens (ganhos registrados)",
      "Tempo Bruto",
      "Tempo Liquido",
      "Pico Espectadores",
      "Media Espectadores",
    ],
    [
      report.modelName,
      report.dateBr,
      report.totalTokens,
      formatSecondsToTime(report.bruteSeconds),
      formatSecondsToTime(report.netSeconds),
      report.peakViewers,
      report.avgViewers,
    ],
    [],
    ["AUDIENCIA E DOADORES"],
    ["Novos usuarios", "Doadores novos", "Tokens de doadores novos", "Usuarios recorrentes", "Doadores recorrentes", "Tokens de doadores recorrentes"],
    [
      Number(report.audienceStats?.newUsers) || 0,
      Number(report.audienceStats?.newTippers) || 0,
      Number(report.audienceStats?.newTokens) || 0,
      Number(report.audienceStats?.returningUsers) || 0,
      Number(report.audienceStats?.returningTippers) || 0,
      Number(report.audienceStats?.returningTokens) || 0,
    ],
    [],
    ["REI DA SALA"],
    ["Usuario", "Tokens", "Origem do valor"],
    [
      report.roomKingSnapshot?.name || "Sem registro",
      report.roomKingSnapshot?.name
        ? (
            Math.max(0, Number(report.roomKingSnapshot?.tokens) || 0) > 0
              ? Math.max(0, Number(report.roomKingSnapshot?.tokens) || 0)
              : Math.max(0, Number(report.roomKingSnapshot?.chatTokens) || 0)
          )
        : 0,
      report.roomKingSnapshot?.name
        ? getRoomKingSourceLabel(
            Math.max(0, Number(report.roomKingSnapshot?.tokens) || 0) > 0
              ? report.roomKingSnapshot.valueSource
              : Math.max(0, Number(report.roomKingSnapshot?.chatTokens) || 0) > 0
                ? "chat"
                : report.roomKingSnapshot.valueSource,
          )
        : "",
    ],
    [],
    ["MAIOR GORJETA DO DIA"],
    ["Usuario", "Tokens", "Tipo", "Item"],
    [
      report.largestTip?.username || "",
      Math.round(Number(report.largestTip?.tokens) || 0),
      report.largestTip?.type || "",
      report.largestTip?.item || "",
    ],
    [],
    ["MAIORES GORJETAS INDIVIDUAIS"],
    ["Usuario", "Tokens", "Tipo", "Item"],
    ...(report.topTipRows || []).map((tip) => [
      tip.username,
      Math.round(Number(tip.tokens) || 0),
      tip.type || "",
      tip.item || "",
    ]),
    [],
    ["OPCOES MAIS PEDIDAS DO MENU"],
    ["Opcao", "Quantidade", "Tokens"],
    ...(report.menuOptionRows || []).map((row) => [row.label, row.count, row.tokens]),
    [],
    ["RESULTADOS MAIS FREQUENTES NA ROLETA"],
    ["Resultado", "Quantidade", "Tokens"],
    ...(report.rouletteOutcomeRows || []).map((row) => [row.label, row.count, row.tokens]),
    [],
    ["TOP DOADORES DO DIA"],
    ["Usuario", "Gorjetas", "Tokens"],
    ...(report.donorRows || []).map((donor) => [
      donor.name,
      Number(donor.tips) || 0,
      Math.round(Number(donor.tokens) || 0),
    ]),
    [],
    ["SESSOES DE LIVE"],
    ["Sessao", "Inicio", "Fim", "Duracao", "Tokens", "Pico Espectadores", "Status"],
    ...(report.liveSessions || []).map((session, index) => [
      index + 1,
      session.startedAt || "",
      session.endedAt || "",
      formatSecondsToTime(Number(session.durationSeconds) || 0),
      Math.round(Number(session.tokens) || 0),
      Number(session.peakViewers) || 0,
      session.status || "",
    ]),
    [],
    ["ESPECTADORES SUSPEITOS"],
    [
      "Usuario",
      "Tempo na Sala (min)",
      "Liga",
      "Mensagens",
      "Tokens",
      "Pontuacao",
      "Nivel",
      "Dias Seguidos",
    ],
    ...(report.suspectBots || []).map((bot) => [
      bot.username || "",
      Number(bot.timeInRoomMinutes) || 0,
      bot.league || "",
      Number(bot.messages) || 0,
      Number(bot.tokens) || 0,
      Number(bot.suspicionScore) || 0,
      bot.suspicionLevel || "",
      Number(bot.consecutiveDays) || 0,
    ]),
    [],
    ["USUARIOS SILENCIADOS"],
    ["Usuario", "Silenciado por", "Timestamp"],
    ...(report.mutedUsers || []).map((user) => [
      user.username || "",
      user.mutedBy || "",
      user.timestamp ? new Date(Number(user.timestamp)).toISOString() : "",
    ]),
    [],
    ["MODERACAO"],
    ["Tentativas", "Confirmadas", "Falhas", "Pendentes"],
    [moderationAttempts, moderationSuccesses, moderationFailures, moderationPending],
    [],
    ["LINHA DO TEMPO (MINUTO A MINUTO)"],
    ["Hora:Minuto", "Tokens Ganhos", "Media Espectadores", "Segundos Ativos"],
    ...(report.minuteRows || []).map((minute) => [
      minute.minute,
      minute.tokens,
      minute.avgViewers,
      minute.netSeconds,
    ]),
  ];

  return rowsToCsv(rows);
}

export function buildPeriodReportCsv(
  summary,
  { weekdayNames, weekdayIndexFromDateKey },
) {
  const intervalRows = new Map();
  [
    ["newUsers", summary.newUserBars],
    ["returningUsers", summary.returningUserBars],
    ["newTippers", summary.newTipperBars],
    ["returningTippers", summary.returningTipperBars],
    ["suspects", summary.suspectBars],
    ["muted", summary.mutedBars],
  ].forEach(([key, bars]) => {
    (Array.isArray(bars) ? bars : []).forEach((bar) => {
      const interval = intervalRows.get(bar.label) || {
        label: bar.label,
        newUsers: 0,
        returningUsers: 0,
        newTippers: 0,
        returningTippers: 0,
        suspects: 0,
        muted: 0,
      };
      interval[key] = Number(bar.value) || 0;
      intervalRows.set(bar.label, interval);
    });
  });
  const rows = [
    ["RELATORIO POR PERIODO", summary.modelName, `${summary.start} a ${summary.end}`],
    ["Melhor dia", summary.bestDay?.dateBr || "", Number(summary.bestDay?.tokens) || 0],
    ["Melhor dia da semana", summary.bestTokenWeekday?.name || "", Math.round(Number(summary.bestTokenWeekday?.avg) || 0)],
    ["Melhor horario", summary.bestTokenHour?.label || "", Number(summary.bestTokenHour?.tokens) || 0],
    ["Maior gorjeta", summary.bestTip?.username || "", Math.round(Number(summary.bestTip?.tokens) || 0), summary.bestTip?.type || "", summary.bestTip?.dateBr || ""],
    ["Moderacao", "Tentativas", "Confirmadas", "Falhas", "Pendentes"],
    ["", Number(summary.moderationLogCount) || 0, Number(summary.moderationSuccessCount) || 0, Number(summary.moderationFailureCount) || 0, Number(summary.moderationPendingCount) || 0],
    ["Data", "Dia da semana", "Tokens (ganhos registrados)", "Pico Viewers"],
    ...summary.dayBars.map((day) => [
      day.dateBr,
      weekdayNames[weekdayIndexFromDateKey(day.dateKey)] || "",
      day.value,
      day.peakViewers,
    ]),
    [],
    ["OPCOES MAIS PEDIDAS DO MENU"],
    ["Opcao", "Quantidade", "Tokens"],
    ...(summary.menuOptionRows || []).map((row) => [row.label, row.count, row.tokens]),
    [],
    ["RESULTADOS MAIS FREQUENTES NA ROLETA"],
    ["Resultado", "Quantidade", "Tokens"],
    ...(summary.rouletteOutcomeRows || []).map((row) => [row.label, row.count, row.tokens]),
    [],
    ["DOADORES NO PERIODO"],
    ["Usuario", "Gorjetas", "Dias com doacao", "Tokens"],
    ...(summary.donorRows || []).map((donor) => [
      donor.name,
      Number(donor.tips) || 0,
      Number(donor.days) || 0,
      Math.round(Number(donor.tokens) || 0),
    ]),
    [],
    ["SUSPEITAS DE BOTS"],
    ["Usuario", "Dias suspeito", "Maior pontuacao", "Nivel"],
    ...(summary.suspectRows || []).map((suspect) => [
      suspect.username,
      suspect.days,
      suspect.suspicionScore,
      suspect.suspicionLevel,
    ]),
    [],
    ["USUARIOS SILENCIADOS"],
    ["Usuario", "Dias silenciado", "Silenciado por", "Ultima ocorrencia"],
    ...(summary.mutedRows || []).map((muted) => [
      muted.username,
      muted.days,
      muted.mutedBy,
      muted.timestamp ? new Date(Number(muted.timestamp)).toISOString() : "",
    ]),
    [],
    ["AUDIENCIA POR INTERVALO"],
    ["Intervalo", "Novos usuarios", "Usuarios recorrentes", "Doadores novos", "Doadores recorrentes", "Suspeitas", "Silenciados"],
    ...Array.from(intervalRows.values()).map((interval) => [
      interval.label,
      interval.newUsers,
      interval.returningUsers,
      interval.newTippers,
      interval.returningTippers,
      interval.suspects,
      interval.muted,
    ]),
    [],
    ["COMPARAÇÃO POR DIA DA SEMANA"],
    ["Dia", "Dias com histórico", "Média tokens por dia", "Média viewers", "Pico viewers"],
    ...summary.weekdayStats.map((day) => [
      day.name,
      day.days,
      day.days > 0 ? Math.round(day.tokens / day.days) : "",
      day.viewerSamples > 0 ? Math.round(day.viewerSum / day.viewerSamples) : "",
      day.days > 0 ? day.peakViewers : "",
    ]),
    [],
    ["MAPA DE CALOR DIA/HORARIO"],
    ["Dia", "Horario", "Tokens", "Eventos", "Media espectadores"],
    ...(summary.heatmap || []).flatMap((row) =>
      row.cells.map((cell, hour) => [
        row.name,
        `${String(hour).padStart(2, "0")}h`,
        Number(cell.tokens) || 0,
        Number(cell.events) || 0,
        Number(cell.avgViewers) || 0,
      ]),
    ),
    [],
    ["ATIVIDADE E MODERACAO POR HORARIO"],
    ["Horario", "Eventos", "Moderação"],
    ...(summary.activityTimeline || []).map((bucket, hour) => [
      `${String(hour).padStart(2, "0")}h`,
      Number(bucket.events) || 0,
      Number(bucket.moderation) || 0,
    ]),
    [],
    ["ENGAJAMENTO POR USUARIO"],
    ["Usuario", "Perfil", "Tokens", "Mensagens", "Tempo minutos", "Visitas"],
    ...(summary.engagementRows || []).map((user) => [
      user.name,
      String(summary.start || "") && user.firstSeenDate >= summary.start ? "Novo" : "Recorrente",
      Number(user.tokens) || 0,
      Number(user.messages) || 0,
      Math.floor(Math.max(0, Number(user.totalTimeSpent) || 0) / 60),
      Math.max(1, Number(user.visitCount) || 1),
    ]),
    [],
    ["EFICIENCIA DA AUDIENCIA"],
    ["Métrica", "Valor"],
    ["Tokens por espectador médio", Number(summary.audienceEfficiency?.tokensPerAverageViewer) || 0],
    ["Tokens por hora líquida", Number(summary.audienceEfficiency?.tokensPerNetHour) || 0],
    ["Público médio", Number(summary.audienceEfficiency?.averageViewers) || 0],
    [],
    ["ENGAJAMENTO POR LIGA"],
    ["Liga", "Usuários", "Tokens", "Tk por usuário", "Mensagens", "Min por usuário"],
    ...(summary.leagueEngagementRows || []).map((league) => [
      league.label,
      Number(league.users) || 0,
      Number(league.tokens) || 0,
      Number(league.tokensPerUser) || 0,
      Number(league.messages) || 0,
      Number(league.minutesPerUser) || 0,
    ]),
    [],
    ["LINHA DO TEMPO METAS"],
    ["Data", "Tipo", "Descrição", "Status", "Valor"],
    ...(summary.goalTimeline || []).map((goal) => [
      goal.dateKey,
      "Meta",
      goal.description,
      goal.status,
      Number(goal.amount) || 0,
    ]),
    [],
    ["REI DA SALA POR DIA"],
    ["Data", "Rei", "Tokens", "Origem do valor"],
    ...(summary.roomKingRows || []).map((king) => [
      king.dateBr,
      king.name,
      Math.max(0, Number(king.tokens) || 0),
      getRoomKingSourceLabel(king.valueSource),
    ]),
  ];
  return rowsToCsv(rows);
}

export function triggerCsvDownload(csvString, filename) {
  const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
