const LANGUAGE_KEY = "scm_ui_language";
const LANGUAGES = new Set(["pt-BR", "es", "en"]);
const TRANSLATIONS = {
  "pt-BR": {},
  es: {
    "Aguardando página…": "Esperando la página…",
    "Espectadores ahora": "Espectadores ahora",
    "Pico nesta sessão": "Pico de esta sesión",
    "Usuários listados": "Usuarios listados",
    "Outros (sem tokens)": "Otros (sin tokens)",
    "Com Tokens": "Con tokens",
    "Ocultos / Invisíveis": "Ocultos / invisibles",
    "Mais sem tokens (+)": "Más sin tokens (+)",
    "Tokens (gorjetas + shows estimados)": "Tokens (propinas + shows estimados)",
    "Abra uma sala do Stripchat para iniciar.": "Abre una sala de Stripchat para comenzar.",
    "Começar a monitorar": "Comenzar a monitorear",
    "Pausar monitoramento": "Pausar monitoreo",
    "Guardar dados": "Guardar datos",
    "Exportar CSV": "Exportar CSV",
    "Limpar dados": "Borrar datos",
    "Abrir painel na página": "Abrir el panel en la página",
    "Ver relatórios": "Ver informes",
    "Salas Anteriores Monitoradas": "Salas monitoreadas anteriormente",
    "Nenhuma sala anterior salva.": "No hay salas anteriores guardadas.",
    "Os dados são separados por modelo e armazenados localmente no navegador.": "Los datos se separan por modelo y se guardan localmente en el navegador.",
    "Aguardando página...": "Esperando la página...",
    "Nenhuma aba ativa disponível.": "No hay ninguna pestaña activa disponible.",
    "Verificando conexão…": "Verificando conexión…",
    "Reconectando ao Stripchat…": "Reconectando con Stripchat…",
    "Não foi possível reconectar. Atualize a extensão e tente novamente.": "No se pudo reconectar. Actualiza la extensión e inténtalo de nuevo.",
    "Não foi possível reconectar. Atualize a página do Stripchat.": "No se pudo reconectar. Actualiza la página de Stripchat.",
    "Recarregue a sala para iniciar": "Recarga la sala para comenzar",
    "Monitorando · ": "Monitoreando · ",
    "Pausado · ": "En pausa · ",
    "Modelo: ": "Modelo: ",
    "não identificado": "no identificado",
    "Dados separados por modelo.": "Datos separados por modelo.",
    "Falha ao carregar o histórico local.": "No se pudo cargar el historial local.",
    "Nenhuma aba ativa disponível.": "No hay ninguna pestaña activa disponible.",
    "Não está no Stripchat": "No estás en Stripchat",
    "Apagar": "Borrar",
    "Relatórios": "Informes",
    "Consulte e compare os dados locais das salas monitoradas.": "Consulta y compara los datos locales de las salas monitoreadas.",
    "Atualizar": "Actualizar",
    "Tipo de relatório": "Tipo de informe",
    "Dia": "Día",
    "Sessão": "Sesión",
    "Período": "Período",
    "Modelo / sala": "Modelo / sala",
    "Data principal": "Fecha principal",
    "Comparar com": "Comparar con",
    "Live do dia (A)": "Live del día (A)",
    "Comparar esta live com (B)": "Comparar esta live con (B)",
    "Exportar CSV": "Exportar CSV",
    "Filtros e exportação": "Filtros y exportación",
    "Backup": "Copia de seguridad",
    "Gerenciar dados": "Administrar datos",
    "Visão geral": "Resumen",
    "Uso do armazenamento local": "Uso del almacenamiento local",
    "Estimativa do armazenamento indisponível.": "Estimación del almacenamiento no disponible.",
    "Uso estimado do armazenamento do navegador:": "Uso estimado del almacenamiento del navegador:",
    "Uso estimado do armazenamento do navegador (usado / quota):": "Uso estimado del almacenamiento del navegador (usado / cuota):",
    "Tamanho JSON estimado dos dados do(a) modelo selecionado:": "Tamaño JSON estimado de los datos del modelo seleccionado:",
    "Consultando armazenamento…": "Consultando almacenamiento…",
    "Bloco de tempo dos gráficos diários": "Intervalo de tiempo de los gráficos diarios",
    "Automático": "Automático",
    "Ferramentas de dados": "Herramientas de datos",
    "Faça backup ou gerencie o histórico armazenado localmente.": "Haz una copia de seguridad o administra el historial guardado localmente.",
    "Backup dos dados": "Copia de seguridad de los datos",
    "Exporte todos os dados ou apenas o modelo selecionado. A restauração seletiva preserva os demais modelos.": "Exporta todos los datos o solo el modelo seleccionado. La restauración selectiva conserva los demás modelos.",
    "Exportar": "Exportar",
    "Escopo": "Alcance",
    "Todos os dados": "Todos los datos",
    "Modelo selecionado acima": "Modelo seleccionado arriba",
    "Exportar backup JSON": "Exportar copia JSON",
    "Importar": "Importar",
    "Selecionar arquivo JSON": "Seleccionar archivo JSON",
    "Restaurar": "Restaurar",
    "Todos os dados do arquivo": "Todos los datos del archivo",
    "Somente um modelo": "Solo un modelo",
    "Modelo": "Modelo",
    "Restaurar backup": "Restaurar copia",
    "Cancelar": "Cancelar",
    "Apagar dados": "Borrar datos",
    "Confirme antes da exclusão. Modelos monitorados precisam ser pausados.": "Confirma antes de eliminar. Es necesario pausar los modelos monitoreados.",
    "Dados a apagar": "Datos que se borrarán",
    "Dia Completo": "Día completo",
    "Live": "Live",
    "Todo o Histórico": "Todo el historial",
    "Exportar CSV": "Exportar CSV",
    "Comparar com outro período": "Comparar con otro período",
    "De": "Desde",
    "Até": "Hasta",
    "Agrupar por": "Agrupar por",
    "Período B · De": "Período B · Desde",
    "Período B · Até": "Período B · Hasta",
    "Fechar menu lateral": "Cerrar menú lateral",
    "SC MONITOR · ANÁLISES": "SC MONITOR · ANÁLISIS",
    "Pico / Média Viewers": "Pico / promedio de espectadores",
    "Tokens por live": "Tokens por live",
    "Distribuição de Ligas (Pico / Média)": "Distribución de ligas (pico / promedio)",
    "Opções mais pedidas do menu": "Opciones más solicitadas del menú",
    "Resultados mais frequentes na roleta": "Resultados más frecuentes de la ruleta",
    "Maiores gorjetas individuais": "Mayores propinas individuales",
    "Duração das lives do dia": "Duración de las lives del día",
    "Tempo líquido registrado por sessão": "Tiempo neto registrado por sesión",
    "Uma live registrada · comparação disponível ao registrar outra": "Una live registrada · la comparación estará disponible al registrar otra",
    "Sem dados para exibir.": "No hay datos para mostrar.",
    "Sem dados suficientes neste recorte.": "No hay suficientes datos en este intervalo.",
    "Aguardando dados para traçar curva...": "Esperando datos para dibujar la curva…",
    "Selecione um modelo para visualizar o relatório.": "Selecciona un modelo para ver el informe.",
    "Selecione uma data para visualizar o relatório.": "Selecciona una fecha para ver el informe.",
    "Não há lives registradas para esta data.": "No hay lives registradas en esta fecha.",
    "Idioma": "Idioma",
    "Pico": "Pico",
    "Média": "Promedio",
    "Usuários": "Usuarios",
    "Histórico": "Historial",
    "Eventos": "Eventos",
    "Moderação": "Moderación",
    "Geral": "General",
    "Relatório": "Informe",
    "📊 Geral": "📊 General",
    "👥 Usuários": "👥 Usuarios",
    "💰 Eventos": "💰 Eventos",
    "🛡️ Moderação": "🛡️ Moderación",
    "🗂️ Histórico": "🗂️ Historial",
    "📑 Relatório": "📑 Informe",
    "Fixar": "Fijar",
    "Fechar": "Cerrar",
    "Configuração de Tarifas (Tokens)": "Configuración de tarifas (tokens)",
    "Fan Club (3 Meses)": "Fan Club (3 meses)",
    "Privado": "Privado",
    "Exclusivo": "Exclusivo",
    "Central de relatórios": "Centro de informes",
    "PAINEL": "PANEL",
    "ANÁLISES": "ANÁLISIS",
    "GERENCIAMENTO": "ADMINISTRACIÓN",
    "Configuração de Tarifas (Tokens)": "Configuración de tarifas (tokens)",
    "Tempo Bruto (Sessão)": "Tiempo bruto (sesión)",
    "Tempo Líquido (Sessão)": "Tiempo neto (sesión)",
    "Tempo Líquido (Hoje)": "Tiempo neto (hoy)",
    "Tempo Bruto Acumulado (Hoje)": "Tiempo bruto acumulado (hoy)",
    "Tempo Bruto:": "Tiempo bruto:",
    "Tempo Líquido:": "Tiempo neto:",
    "cronômetro total desde o início do monitoramento.": "cronómetro total desde el inicio del monitoreo.",
    "tempo efetivo com a transmissão ativa e a sala realmente online.": "tiempo efectivo con la transmisión activa y la sala conectada.",
    "Soldado": "Soldado",
    "Príncipe": "Príncipe",
    "Shows (tk/min)": "Shows (tk/min)",
    "Pico observado hoje": "Pico observado hoy",
    "Média espectadores hoje": "Promedio de espectadores hoy",
    "Bloco do gráfico:": "Intervalo del gráfico:",
    "Ligas Atuais": "Ligas actuales",
    "Cinzas": "Grises",
    "Prata": "Plata",
    "Ouro": "Oro",
    "Diamante": "Diamante",
    "⭐Lendária": "⭐Legendaria",
    "Lista de Usuários": "Lista de usuarios",
    "Todos": "Todos",
    "🆕 Novos": "🆕 Nuevos",
    "🔁 Recorrentes": "🔁 Recurrentes",
    "Usuário (nível)": "Usuario (nivel)",
    "Gorjetas": "Propinas",
    "Msgs": "Mensajes",
    "Visto em": "Visto en",
    "🛡️ Espectadores Suspeitos / Bots": "🛡️ Espectadores sospechosos / bots",
    "Como é detectado:": "Cómo se detecta:",
    "Usuário / Motivo": "Usuario / motivo",
    "Tempo": "Tiempo",
    "Liga": "Liga",
    "Eventos e Menu / Gorjetas": "Eventos y menú / propinas",
    "Ganho por tipo": "Ganancias por tipo",
    "Ganhos por Tipo": "Ganancias por tipo",
    "💎 Ganhos por Tipo": "💎 Ganancias por tipo",
    "💎 Ganhos por tipo": "💎 Ganancias por tipo",
    "Resumo Consolidado por Item": "Resumen consolidado por artículo",
    "Nenhum evento capturado ainda.": "Aún no se han registrado eventos.",
    "Nenhum evento encontrado neste filtro.": "No se encontraron eventos con este filtro.",
    "Qtd": "Cant.",
    "Total": "Total",
    "Ticket": "Entrada",
    "Ingresso Ticket": "Entrada",
    "Compra de Ingresso": "Compra de entrada",
    "Gorjeta Avulsa": "Propina individual",
    "Gorjeta avulsa": "Propina individual",
    "Menu de Gorjetas": "Menú de propinas",
    "Menu": "Menú",
    "Show em Grupo": "Show grupal",
    "Show Privado": "Show privado",
    "Show Exclusivo": "Show exclusivo",
    "Show privado": "Show privado",
    "Show exclusivo": "Show exclusivo",
    "Compra de Conteúdo": "Compra de contenido",
    "Objetivo Épico": "Meta épica",
    "Roleta": "Ruleta",
    "Outros": "Otros",
    "Tokens por Usuário": "Tokens por usuario",
    "Nenhum usuário com tokens registrados ainda.": "Aún no hay usuarios con tokens registrados.",
    "Presente na lista da sala": "Presente en la lista de la sala",
    "Ausente da lista atual": "Ausente de la lista actual",
    "Shows": "Shows",
    "Item / Pedido": "Artículo / solicitud",
    "Preço": "Precio",
    "Tipo": "Tipo",
    "📌 Para Fazer (Tarefas / Pendências)": "📌 Por hacer (tareas / pendientes)",
    "pendências": "pendientes",
    "Clique em uma tarefa para marcar como feita; as pendentes aparecem primeiro.": "Haz clic en una tarea para marcarla como completada; las pendientes aparecen primero.",
    "Metas da sala": "Objetivos de la sala",
    "Palavras/Frases Proibidas (Spam)": "Palabras/frases prohibidas (spam)",
    "Mensagens Moderadas": "Mensajes moderados",
    "Usuários Silenciados": "Usuarios silenciados",
    "Usuário / Moderador": "Usuario / moderador",
    "Última Mensagem": "Último mensaje",
    "Backup e restauração": "Copia de seguridad y restauración",
    "Exporte todos os dados ou apenas uma modelo. A restauração seletiva preserva os demais modelos.": "Exporta todos los datos o solo un modelo. La restauración selectiva conserva los demás modelos.",
    "Uma modelo": "Un modelo",
    "Consultando armazenamento local…": "Consultando el almacenamiento local…",
    "Salas / Modelos Salvas": "Salas / modelos guardados",
    "Carregando...": "Cargando…",
    "↗ Página de relatório": "↗ Página del informe",
    "📑 Central de Relatórios": "📑 Centro de informes",
    "🎬 Sessão": "🎬 Sesión",
    "📅 Dia": "📅 Día",
    "📆 Período": "📆 Período",
    "Modelo / Sala": "Modelo / sala",
    "Data Principal (A)": "Fecha principal (A)",
    "Live do Dia": "Live del día",
    "7 dias": "7 días",
    "15 dias": "15 días",
    "30 dias": "30 días",
    "90 dias": "90 días",
    "1 ano": "1 año",
    "📋 Copiar Resumo": "📋 Copiar resumen",
    "Coleta Automática": "Recopilación automática",
    "Chat ↔ Usuários": "Chat ↔ usuarios",
    "Só nesta sala": "Solo en esta sala",
    "Monitorar": "Monitorear",
    "Guardar": "Guardar",
    "Limpar sessão": "Borrar sesión",
    "Redimensionar pelo canto superior esquerdo": "Cambiar tamaño desde la esquina superior izquierda",
    "Redimensionar pelo canto superior direito": "Cambiar tamaño desde la esquina superior derecha",
    "Redimensionar pelo canto inferior esquerdo": "Cambiar tamaño desde la esquina inferior izquierda",
    "Redimensionar pelo canto inferior direito": "Cambiar tamaño desde la esquina inferior derecha",
    "Central de relatórios": "Centro de informes",
    "PAINEL": "PANEL",
    "ANÁLISES": "ANÁLISIS",
    "GERENCIAMENTO": "ADMINISTRACIÓN",
    "Tempo Bruto (Sessão)": "Tiempo bruto (sesión)",
    "Tempo Líquido (Sessão)": "Tiempo neto (sesión)",
    "Tempo Líquido (Hoje)": "Tiempo neto (hoy)",
    "Tempo Bruto Acumulado (Hoje)": "Tiempo bruto acumulado (hoy)",
    "Tempo Bruto:": "Tiempo bruto:",
    "Tempo Líquido:": "Tiempo neto:",
    "cronômetro total desde o início do monitoramento.": "cronómetro total desde el inicio del monitoreo.",
    "tempo efetivo com a transmissão ativa e a sala realmente online.": "tiempo efectivo con la transmisión activa y la sala conectada.",
    "Príncipe": "Príncipe",
    "Pico observado hoje": "Pico observado hoy",
    "Média espectadores hoje": "Promedio de espectadores hoy",
    "Bloco do gráfico:": "Intervalo del gráfico:",
    "Ligas Atuais": "Ligas actuales",
    "Cinzas": "Grises",
    "Prata": "Plata",
    "Ouro": "Oro",
    "Lista de Usuários": "Lista de usuarios",
    "🆕 Novos": "🆕 Nuevos",
    "🔁 Recorrentes": "🔁 Recurrentes",
    "Usuário (nível)": "Usuario (nivel)",
    "Gorjetas": "Propinas",
    "Msgs": "Mensajes",
    "Visto em": "Visto en",
    "🛡️ Espectadores Suspeitos / Bots": "🛡️ Espectadores sospechosos / bots",
    "Como é detectado:": "Cómo se detecta:",
    "Usuário / Motivo": "Usuario / motivo",
    "Tempo": "Tiempo",
    "Eventos e Menu / Gorjetas": "Eventos y menú / propinas",
    "Shows": "Shows",
    "Item / Pedido": "Artículo / solicitud",
    "Preço": "Precio",
    "Tipo": "Tipo",
    "📌 Para Fazer (Tarefas / Pendências)": "📌 Por hacer (tareas / pendientes)",
    "pendências": "pendientes",
    "Clique em uma tarefa para marcar como feita; as pendentes aparecem primeiro.": "Haz clic en una tarea para marcarla como completada; las pendientes aparecen primero.",
    "Metas da sala": "Objetivos de la sala",
    "Palavras/Frases Proibidas (Spam)": "Palabras/frases prohibidas (spam)",
    "Mensagens Moderadas": "Mensajes moderados",
    "Usuários Silenciados": "Usuarios silenciados",
    "Usuário / Moderador": "Usuario / moderador",
    "Última Mensagem": "Último mensaje",
    "Backup e restauração": "Copia de seguridad y restauración",
    "Exporte todos os dados ou apenas uma modelo. A restauração seletiva preserva os demais modelos.": "Exporta todos los datos o solo un modelo. La restauración selectiva conserva los demás modelos.",
    "Uma modelo": "Un modelo",
    "Consultando armazenamento local…": "Consultando el almacenamiento local…",
    "Salas / Modelos Salvas": "Salas / modelos guardados",
    "Carregando...": "Cargando…",
    "↗ Página de relatório": "↗ Página del informe",
    "📑 Central de Relatórios": "📑 Centro de informes",
    "🎬 Sessão": "🎬 Sesión",
    "📅 Dia": "📅 Día",
    "Data Principal (A)": "Fecha principal (A)",
    "Live do Dia": "Live del día",
    "7 dias": "7 días",
    "15 dias": "15 días",
    "30 dias": "30 días",
    "90 dias": "90 días",
    "1 ano": "1 año",
    "📋 Copiar Resumo": "📋 Copiar resumen",
    "Coleta Automática": "Recopilación automática",
    "Chat ↔ Usuários": "Chat ↔ usuarios",
    "Só nesta sala": "Solo en esta sala",
    "Monitorar": "Monitorear",
    "Limpar sessão": "Borrar sesión",
    "Redimensionar pelo canto superior esquerdo": "Cambiar tamaño desde la esquina superior izquierda",
    "Redimensionar pelo canto superior direito": "Cambiar tamaño desde la esquina superior derecha",
    "Redimensionar pelo canto inferior esquerdo": "Cambiar tamaño desde la esquina inferior izquierda",
    "Redimensionar pelo canto inferior direito": "Cambiar tamaño desde la esquina inferior derecha",
  },
  en: {
    "Aguardando página…": "Waiting for page…",
    "Espectadores agora": "Current viewers",
    "Pico nesta sessão": "Session peak",
    "Usuários listados": "Listed users",
    "Outros (sem tokens)": "Others (without tokens)",
    "Com Tokens": "With tokens",
    "Ocultos / Invisíveis": "Hidden / invisible",
    "Mais sem tokens (+)": "More without tokens (+)",
    "Tokens (gorjetas + shows estimados)": "Tokens (tips + estimated shows)",
    "Abra uma sala do Stripchat para iniciar.": "Open a Stripchat room to get started.",
    "Começar a monitorar": "Start monitoring",
    "Pausar monitoramento": "Pause monitoring",
    "Guardar dados": "Save data",
    "Limpar dados": "Clear data",
    "Abrir painel na página": "Open page panel",
    "Ver relatórios": "View reports",
    "Salas Anteriores Monitoradas": "Previously monitored rooms",
    "Nenhuma sala anterior salva.": "No previous rooms saved.",
    "Os dados são separados por modelo e armazenados localmente no navegador.": "Data is separated by model and stored locally in the browser.",
    "Nenhuma aba ativa disponível.": "No active tab available.",
    "Verificando conexão…": "Checking connection…",
    "Reconectando ao Stripchat…": "Reconnecting to Stripchat…",
    "Não foi possível reconectar. Atualize a extensão e tente novamente.": "Could not reconnect. Reload the extension and try again.",
    "Não foi possível reconectar. Atualize a página do Stripchat.": "Could not reconnect. Reload the Stripchat page.",
    "Recarregue a sala para iniciar": "Reload the room to get started",
    "Monitorando · ": "Monitoring · ",
    "Pausado · ": "Paused · ",
    "Modelo: ": "Model: ",
    "não identificado": "not identified",
    "Dados separados por modelo.": "Data is separated by model.",
    "Falha ao carregar o histórico local.": "Could not load local history.",
    "Não está no Stripchat": "Not on Stripchat",
    "Apagar": "Delete",
    "Relatórios": "Reports",
    "Consulte e compare os dados locais das salas monitoradas.": "View and compare local data from monitored rooms.",
    "Atualizar": "Refresh",
    "Tipo de relatório": "Report type",
    "Dia": "Day",
    "Sessão": "Session",
    "Período": "Period",
    "Modelo / sala": "Model / room",
    "Data principal": "Primary date",
    "Comparar com": "Compare with",
    "Live do dia (A)": "Live for the day (A)",
    "Comparar esta live com (B)": "Compare this live with (B)",
    "Filtros e exportação": "Filters and export",
    "Backup": "Backup",
    "Gerenciar dados": "Manage data",
    "Visão geral": "Overview",
    "Uso do armazenamento local": "Local storage usage",
    "Estimativa do armazenamento indisponível.": "Storage estimate unavailable.",
    "Uso estimado do armazenamento do navegador:": "Estimated browser storage usage:",
    "Uso estimado do armazenamento do navegador (usado / quota):": "Estimated browser storage usage (used / quota):",
    "Tamanho JSON estimado dos dados do(a) modelo selecionado:": "Estimated JSON size of the selected model data:",
    "Consultando armazenamento…": "Checking storage…",
    "Bloco de tempo dos gráficos diários": "Time interval for daily charts",
    "Automático": "Automatic",
    "Ferramentas de dados": "Data tools",
    "Faça backup ou gerencie o histórico armazenado localmente.": "Back up or manage locally stored history.",
    "Backup dos dados": "Data backup",
    "Exporte todos os dados ou apenas o modelo selecionado. A restauração seletiva preserva os demais modelos.": "Export all data or only the selected model. Selective restore preserves other models.",
    "Exportar": "Export",
    "Escopo": "Scope",
    "Todos os dados": "All data",
    "Modelo selecionado acima": "Model selected above",
    "Exportar backup JSON": "Export JSON backup",
    "Importar": "Import",
    "Selecionar arquivo JSON": "Select JSON file",
    "Restaurar": "Restore",
    "Todos os dados do arquivo": "All data in file",
    "Somente um modelo": "One model only",
    "Modelo": "Model",
    "Restaurar backup": "Restore backup",
    "Cancelar": "Cancel",
    "Apagar dados": "Delete data",
    "Dados a apagar": "Data to delete",
    "Dia Completo": "Full day",
    "Live": "Live",
    "Todo o Histórico": "All history",
    "Comparar com outro período": "Compare with another period",
    "De": "From",
    "Até": "To",
    "Agrupar por": "Group by",
    "Período B · De": "Period B · From",
    "Período B · Até": "Period B · To",
    "Fechar menu lateral": "Close sidebar",
    "SC MONITOR · ANÁLISES": "SC MONITOR · ANALYTICS",
    "Pico / Média Viewers": "Peak / average viewers",
    "Tokens por live": "Tokens per live",
    "Distribuição de Ligas (Pico / Média)": "League distribution (peak / average)",
    "Opções mais pedidas do menu": "Most requested menu options",
    "Resultados mais frequentes na roleta": "Most frequent roulette results",
    "Maiores gorjetas individuais": "Largest individual tips",
    "Duração das lives do dia": "Live duration for the day",
    "Tempo líquido registrado por sessão": "Net time recorded per session",
    "Uma live registrada · comparação disponível ao registrar outra": "One live recorded · comparison available after another is recorded",
    "Sem dados para exibir.": "No data to display.",
    "Sem dados suficientes neste recorte.": "Not enough data for this range.",
    "Aguardando dados para traçar curva...": "Waiting for data to plot the curve…",
    "Selecione um modelo para visualizar o relatório.": "Select a model to view the report.",
    "Selecione uma data para visualizar o relatório.": "Select a date to view the report.",
    "Não há lives registradas para esta data.": "No lives recorded for this date.",
    "Idioma": "Language",
    "Pico": "Peak",
    "Média": "Average",
    "Usuários": "Users",
    "Histórico": "History",
    "Eventos": "Events",
    "Moderação": "Moderation",
    "Geral": "General",
    "Relatório": "Report",
    "📊 Geral": "📊 General",
    "👥 Usuários": "👥 Users",
    "💰 Eventos": "💰 Events",
    "🛡️ Moderação": "🛡️ Moderation",
    "🗂️ Histórico": "🗂️ History",
    "📑 Relatório": "📑 Report",
    "Fixar": "Pin",
    "Fechar": "Close",
    "Configuração de Tarifas (Tokens)": "Rate settings (tokens)",
    "Fan Club (3 Meses)": "Fan Club (3 months)",
    "Privado": "Private",
    "Exclusivo": "Exclusive",
  },
};

Object.assign(TRANSLATIONS.en, {
  "Central de relatórios": "Reports center",
  "GERENCIAMENTO": "MANAGEMENT",
  "Tempo Bruto (Sessão)": "Gross time (session)",
  "Tempo Líquido (Sessão)": "Net time (session)",
  "Tempo Líquido (Hoje)": "Net time (today)",
  "Tempo Bruto Acumulado (Hoje)": "Accumulated gross time (today)",
  "Tempo Bruto:": "Gross time:",
  "Tempo Líquido:": "Net time:",
  "cronômetro total desde o início do monitoramento.": "total timer since monitoring started.",
  "tempo efetivo com a transmissão ativa e a sala realmente online.": "effective time while the stream is active and the room is online.",
  "Soldado": "Soldier",
  "Pico observado hoje": "Peak observed today",
  "Média espectadores hoje": "Average viewers today",
  "Bloco do gráfico:": "Chart interval:",
  "Ligas Atuais": "Current leagues",
  "Cinzas": "Gray",
  "Prata": "Silver",
  "Ouro": "Gold",
  "Lista de Usuários": "User list",
  "🆕 Novos": "🆕 New",
  "🔁 Recorrentes": "🔁 Returning",
  "Usuário (nível)": "User (level)",
  "Gorjetas": "Tips",
  "Msgs": "Msgs",
  "Visto em": "Seen at",
  "🛡️ Espectadores Suspeitos / Bots": "🛡️ Suspicious viewers / bots",
  "Como é detectado:": "How detection works:",
  "Usuário / Motivo": "User / reason",
  "Tempo": "Time",
  "Eventos e Menu / Gorjetas": "Events and menu / tips",
  "Ganho por tipo": "Earnings by type",
  "Ganhos por Tipo": "Earnings by type",
  "💎 Ganhos por Tipo": "💎 Earnings by type",
  "💎 Ganhos por tipo": "💎 Earnings by type",
  "Resumo Consolidado por Item": "Consolidated summary by item",
  "Nenhum evento capturado ainda.": "No events have been recorded yet.",
  "Nenhum evento encontrado neste filtro.": "No events found for this filter.",
  "Qtd": "Qty",
  "Ticket": "Ticket",
  "Ingresso Ticket": "Ticket",
  "Compra de Ingresso": "Ticket purchase",
  "Gorjeta Avulsa": "One-off tip",
  "Gorjeta avulsa": "One-off tip",
  "Menu de Gorjetas": "Tip menu",
  "Menu": "Menu",
  "Show em Grupo": "Group show",
  "Show Privado": "Private show",
  "Show Exclusivo": "Exclusive show",
  "Show privado": "Private show",
  "Show exclusivo": "Exclusive show",
  "Compra de Conteúdo": "Content purchase",
  "Objetivo Épico": "Epic goal",
  "Roleta": "Roulette",
  "Outros": "Other",
  "Tokens por Usuário": "Tokens by user",
  "Nenhum usuário com tokens registrados ainda.": "No users with recorded tokens yet.",
  "Presente na lista da sala": "Present in the room list",
  "Ausente da lista atual": "Not on the current list",
  "Item / Pedido": "Item / request",
  "Preço": "Price",
  "Tipo": "Type",
  "📌 Para Fazer (Tarefas / Pendências)": "📌 To-do (tasks / pending)",
  "pendências": "pending",
  "Clique em uma tarefa para marcar como feita; as pendentes aparecem primeiro.": "Click a task to mark it done; pending tasks appear first.",
  "Metas da sala": "Room goals",
  "Palavras/Frases Proibidas (Spam)": "Banned words/phrases (spam)",
  "Mensagens Moderadas": "Moderated messages",
  "Usuários Silenciados": "Muted users",
  "Usuário / Moderador": "User / moderator",
  "Última Mensagem": "Last message",
  "Backup e restauração": "Backup and restore",
  "Exporte todos os dados ou apenas uma modelo. A restauração seletiva preserva os demais modelos.": "Export all data or only one model. Selective restore preserves other models.",
  "Uma modelo": "One model",
  "Salas / Modelos Salvas": "Saved rooms / models",
  "Carregando...": "Loading…",
  "↗ Página de relatório": "↗ Report page",
  "📑 Central de Relatórios": "📑 Reports center",
  "🎬 Sessão": "🎬 Session",
  "📅 Dia": "📅 Day",
  "Data Principal (A)": "Primary date (A)",
  "Live do Dia": "Live of the day",
  "7 dias": "7 days",
  "15 dias": "15 days",
  "30 dias": "30 days",
  "90 dias": "90 days",
  "1 ano": "1 year",
  "📋 Copiar Resumo": "📋 Copy summary",
  "Coleta Automática": "Automatic collection",
  "Chat ↔ Usuários": "Chat ↔ users",
  "Só nesta sala": "This room only",
  "Monitorar": "Monitor",
  "Guardar": "Save",
  "Limpar sessão": "Clear session",
  "Redimensionar pelo canto superior esquerdo": "Resize from top-left corner",
  "Redimensionar pelo canto superior direito": "Resize from top-right corner",
  "Redimensionar pelo canto inferior esquerdo": "Resize from bottom-left corner",
  "Redimensionar pelo canto inferior direito": "Resize from bottom-right corner",
});

let currentLanguage = "pt-BR";
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const boundLanguageSelectors = new WeakSet();
let languageListenerInstalled = false;
let documentObserver;
let localizationRoot;
let extensionOnlyRoot = false;

function normalizeLanguage(language) {
  const normalized = String(language || "").toLowerCase();
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("en")) return "en";
  return "pt-BR";
}

export function localizeText(source, language = currentLanguage) {
  const locale = normalizeLanguage(language);
  return TRANSLATIONS[locale]?.[source] || source;
}

function translate(source) {
  return localizeText(source);
}

function isTranslatableTextNode(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest("script,style,textarea,[contenteditable='true']")) return false;
  if (parent.closest("tbody") && !parent.closest("[data-scm-i18n]")) return false;
  return /^(A|BUTTON|H[1-6]|LABEL|OPTION|P|SMALL|SPAN|STRONG|TEXT|TH|TITLE)$/.test(parent.tagName);
}

function translateTree(root) {
  if (!root) return;
  const doc = root.ownerDocument || root;
  const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(root, showText);
  let node;
  while ((node = walker.nextNode())) {
    if (!isTranslatableTextNode(node)) continue;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    const content = source.trim();
    const next = `${leading}${translate(content)}${trailing}`;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  const elements = root.nodeType === 1
    ? [root, ...root.querySelectorAll("*")]
    : root.nodeType === 9
      ? [...root.querySelectorAll("*")]
      : [];
  elements.forEach((element) => {
    ["title", "aria-label", "placeholder"].forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      let originals = originalAttributes.get(element);
      if (!originals) {
        originals = new Map();
        originalAttributes.set(element, originals);
      }
      if (!originals.has(attribute)) originals.set(attribute, element.getAttribute(attribute));
      const source = originals.get(attribute);
      const next = translate(source);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
    if (element.id === "scm-language") bindLanguageSelector(element);
  });
}

function translateExtensionUi() {
  document.querySelectorAll("#scm-panel, #scm-launch").forEach(translateTree);
  const selector = document.getElementById("scm-language");
  if (selector) selector.value = currentLanguage;
}

function translateActiveRoot() {
  if (extensionOnlyRoot) translateExtensionUi();
  else translateTree(localizationRoot || document.body);
}

export async function initializeLocalization() {
  const storedLanguage = await new Promise((resolve) => {
    if (!globalThis.chrome?.storage?.local) {
      resolve("");
      return;
    }
    chrome.storage.local.get([LANGUAGE_KEY], (result) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        console.error("[SC Monitor] Não foi possível ler o idioma salvo:", error.message);
        resolve("");
        return;
      }
      resolve(result?.[LANGUAGE_KEY] || "");
    });
  });
  currentLanguage = normalizeLanguage(
    storedLanguage || globalThis.navigator?.language || "pt-BR",
  );
  document.documentElement.lang = currentLanguage;
  if (!languageListenerInstalled && globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type !== "SCM_LANGUAGE_CHANGED") return;
      currentLanguage = normalizeLanguage(message.language);
      document.documentElement.lang = currentLanguage;
      translateActiveRoot();
    });
    languageListenerInstalled = true;
  }
  return currentLanguage;
}

export async function setUiLanguage(language) {
  if (!LANGUAGES.has(String(language))) throw new Error("Idioma não suportado.");
  const nextLanguage = normalizeLanguage(language);
  if (!globalThis.chrome?.storage?.local) throw new Error("Armazenamento da extensão indisponível.");
  await new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LANGUAGE_KEY]: nextLanguage }, () => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
  currentLanguage = nextLanguage;
  document.documentElement.lang = nextLanguage;
  translateActiveRoot();
  chrome.runtime.sendMessage({ type: "SCM_LANGUAGE_CHANGED", language: nextLanguage }, () => {
    void chrome.runtime.lastError;
  });
}

export function watchLocalization(root = document.body, extensionOnly = false) {
  if (!globalThis.MutationObserver || !document.body || documentObserver) return;
  localizationRoot = root;
  extensionOnlyRoot = extensionOnly;
  if (extensionOnly) translateExtensionUi();
  else translateTree(root);
  documentObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent && (!extensionOnly || parent.closest("#scm-panel, #scm-launch"))) {
          translateTree(parent);
        }
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (!extensionOnly || node.matches("#scm-panel, #scm-launch") || node.closest("#scm-panel, #scm-launch")) {
            translateTree(node);
          }
        } else if (node.parentElement && (!extensionOnly || node.parentElement.closest("#scm-panel, #scm-launch"))) {
          translateTree(node.parentElement);
        }
      });
    });
  });
  documentObserver.observe(root, { childList: true, subtree: true, characterData: true });
}

export function watchExtensionUi() {
  watchLocalization(document.body, true);
}

export function bindLanguageSelector(selector) {
  if (!selector || boundLanguageSelectors.has(selector)) return;
  boundLanguageSelectors.add(selector);
  selector.value = currentLanguage;
  selector.addEventListener("change", () => {
    setUiLanguage(selector.value).catch((error) => {
      console.error("[SC Monitor] Não foi possível alterar o idioma:", error);
    });
  });
}
