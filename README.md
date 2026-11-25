SC MONITOR - VERSÃO 5.0
========================================================================

       Painel Local de Audiência, Chat, Gorjetas, Metas e Moderação

                               para Stripchat
========================================================================

O SC Monitor é uma extensão para navegadores Chromium que monitora, em tempo
real, a atividade das salas do Stripchat. Os dados são processados e guardados
localmente no navegador. A versão 5.0 consolida a estabilidade dos dados em
transmissões de longa duração e amplia a análise com mapas de calor, eficiência
de audiência, engajamento por liga e linha do tempo de metas e shows.


------------------------------------------------------------------------
📌 NOVIDADES E FUNCIONALIDADES DA VERSÃO 5.0
------------------------------------------------------------------------

COMPARAÇÃO POR DIA DA SEMANA E TRANSPARÊNCIA DAS MÉTRICAS

   - Relatórios por período comparam média de tokens, média e pico de
     espectadores por dia da semana, contando apenas dias com histórico salvo.

   - A média de audiência informa o número de amostras coletadas durante o
     monitoramento; as categorias de público podem se sobrepor.

   - Valores de shows são estimativas baseadas no estado do player e nas
     tarifas configuradas, não uma confirmação de pagamento.

   - A lista de suspeitos considera a visita atual observada na lista de
     usuários, descontando mensagens e tokens anteriores à visita. Ao encerrar
     o monitoramento da sala offline, as visitas abertas são finalizadas.

   - Menu e roleta são lidos a partir dos eventos e mensagens exibidos no chat.
     O monitoramento não lê parâmetros de iframe.


1. PERSISTÊNCIA ACUMULATIVA DE METAS DA SALA

   - Blindagem contra re-renderizações do DOM e trocas de abas no chat.

   - Acumulador inteligente (Merge) que mantém o histórico de metas da

     sessão mesmo quando saem da área visível do chat ou entram em modo

     ticket/offline.

   - Preservação de status (Pendente, Completa, Interrompida) e envio

     automático de metas concluídas para a lista de pendências.


2. LISTA DE TAREFAS (PARA FAZER) & CÓPIA RÁPIDA

   - Adição automática de pedidos via Menu de Gorjetas, Resultados de

     Plugins/Roleta, Fã-Clube e Metas concluídas.

   - Exibição completa no painel com horário [HH:MM:SS], usuário e origem.

   - Novo botão "📋 Copiar Pendentes": exporta apenas as tarefas ainda não

     concluídas para a área de transferência em formato limpo e encadeado:

     descrição (@nickusuario) -> descrição (@outrousuario).


3. CONTABILIZAÇÃO DE SHOWS (PRIVADO, EXCLUSIVO, GRUPO E INGRESSO)

   - Cobrança e registro imediato no início do show, seguidos de ciclos

     precisos a cada 60 segundos ativos.

   - Cálculo dinâmico em Shows em Grupo baseado na tarifa por minuto e na

     quantidade de participantes assistindo.

   - Classificação diferenciada de Ingressos (Ticket Shows) validada por

     DOM, valor anunciado e entrada confirmada do usuário.


4. DETECÇÃO DE ESPECTADORES SUSPEITOS / BOTS

   - Análise comportamental cruzando tempo de permanência sem interação,

     liga/nível (foco em contas Cinza nível <= 9), padrões numéricos ou

     genéricos de nick e saídas/retornos sincronizados em shows restritos.


5. PAINÉIS ANALÍTICOS (SESSÃO ATIVA & CONSOLIDADO DIÁRIO)

   - 📊 Painel Analítico (Sessão Ativa): visão em tempo real com picos e
     médias de espectadores, atividade efetiva, tokens e retenção.

   - Retenção Hoje apresenta a quantidade de usuários novos e recorrentes,
     além do percentual de retorno. Usuários sem data de primeira visita
     conhecida são classificados como recorrentes, sem presumir que sejam novos.

   - Atividade efetiva é o tempo líquido em transmissão ao vivo dividido pelo
     tempo bruto monitorado; Ritmo estima tokens por hora líquida da sessão.

   - 📅 Consolidado Diário (Hoje): integra todas as lives do dia, incluindo
     tokens, maior pico de espectadores e estatísticas de usuários e ligas.

   - Fluxo de Tokens permite escolher blocos de 5, 10 ou 30 minutos, ou 1 hora.
     Diferenças entre o total diário e os registros por minuto são recuperadas
     no bloco atual; o tooltip identifica esses tokens sem horário registrado.
     Nos relatórios do dia, tokens sem horário são informados à parte e não
     distribuídos artificialmente pelos intervalos.
     O painel da sessão mostra o fluxo médio de pessoas listadas em blocos de
     2 minutos, atualizado a cada 2 minutos.

   - A aba Usuários mostra áreas independentes por liga e a linha do total de
     usuários listados, em blocos de 2 minutos. O pico de espectadores da sala
     continua indicado no cabeçalho; espectadores sem nick visível não entram
     na contagem de listados.

6. EVENTOS E RESUMOS POR SESSÃO OU DIA

   - A tabela de eventos e os blocos de resumo da aba Eventos podem alternar
     entre os dados da sessão atual e os dados acumulados no dia.

   - O seletor Sessão/Dia atualiza em conjunto a lista de eventos, o resumo
     consolidado por item, o gráfico de ganhos por tipo e o ranking de usuários.

   - Filtros Todos, Gorjetas, Menu e Metas/Shows continuam disponíveis. O
     filtro Menu limita a lista a eventos de menu/pedido; Metas/Shows inclui
     objetivos épicos, shows e ingressos.

   - Eventos são separados por data local (horário de Brasília), evitando que
     os registros de um dia anterior apareçam no resumo do dia atual.


7. MODERAÇÃO AUTOMÁTICA & RASTREAMENTO DE SILENCIADOS

   - Cadastro dinâmico de palavras-chave proibidas por modelo em tags.

   - Tentativa automática de silenciamento via modal de confirmação e

     histórico completo (PENDENTE, SUCESSO ou FALHA).

   - Detecção robusta de usuários silenciados no chat (.user-muted-message)

     com registro do autor, moderador e última mensagem capturada.


8. CONTROLE DE TEMPO & INTERFACE FLUTUANTE

   - Cronômetros independentes para Tempo Bruto e Tempo Líquido ativo.

   - No modo Monitorar Sala, uma indicação de sala offline aguarda 2 minutos
     e é prolongada por novas mensagens antes de encerrar o monitoramento.

   - Painel arrastável pelo cabeçalho ou pela barra inferior interna, que
     mostra a data e a logo. O tamanho pode ser ajustado pelos quatro cantos;
     o painel também pode ser fixado e oferece coleta automática alternando
     abas de chat e usuários.

   - O ícone da extensão mostra o avatar da modelo enquanto o monitoramento
     está ativo.


9. EXPORTAÇÃO E HISTÓRICO LOCAL

   - Exportação completa do relatório de usuários, visitas, tempo e tokens
     em formato CSV.

   - Relatórios detalhados em uma página da extensão, aberta pelo popup ou pelo painel.
     Os relatórios por período também mostram a evolução diária de usuários novos e
     recorrentes quando esses dados foram salvos. O rei atual de cada dia também é
     registrado e exibido no relatório diário e no resumo por período.
   - Os gráficos usam intervalos automáticos conforme a duração registrada:
     até 9 min: 1 min; 10–29 min: 2 min; 30–59 min: 5 min; 1h–1h39: 10 min;
     1h40–2h59: 20 min; 3h–4h59: 30 min; a partir de 5h: 1 hora.
   - O período também oferece mapa de calor dia/hora, linha do tempo de atividade e
     moderação, engajamento por usuário, eficiência da audiência, contribuição por liga
     e histórico combinado de metas e shows.

   COMO LER OS GRÁFICOS DOS RELATÓRIOS

   - A página oferece três visões: Dia, Sessão e Período. Escolha o modelo/sala e
     os dados disponíveis; no relatório por período, defina as datas e separe os
     resultados por dia, semana ou mês. Também é possível comparar dois períodos.

   - Nos relatórios de Dia e Sessão, o gráfico combinado mostra tokens por intervalo
     junto da evolução do público. No relatório diário, marcadores indicam shows
     registrados. Os gráficos de fluxo detalham tokens e pessoas listadas; escolha
     o tamanho dos blocos ou use Automático, que ajusta o intervalo à duração.
     Tokens sem horário registrado são informados à parte e não são distribuídos
     artificialmente nos blocos.

   - No relatório diário, os gráficos e indicadores de audiência mostram retenção,
     pico/média de usuários e distribuição por liga. A composição de ganhos agrupa
     tokens por categoria. Os gráficos de desempenho comparam duração e tokens
     entre as lives do dia; os rankings mostram maiores gorjetas, opções de menu e
     resultados de roleta registrados. Tabelas complementares apresentam lives,
     doadores, suspeitas e usuários silenciados quando há dados.

   - No relatório por Sessão, o gráfico combinado mostra público e ganhos da live
     nos intervalos selecionados. Também há fluxo de tokens e usuários listados,
     ganhos por categoria e, quando outra sessão é selecionada para comparação,
     uma tabela com as principais diferenças.

   - No relatório por Período, “Ganhos por data/semana/mês” soma os tokens em cada
     agrupamento. “Tokens por horário” reúne os registros do mesmo horário em todo
     o período; já “Média de tokens por horário” divide esse total pelos dias
     ativos. Os gráficos de ritmo usam tk/h e consideram o tempo líquido ao vivo.
     “Maior gorjeta” apresenta o maior valor do agrupamento, não a soma das gorjetas.

   - Os gráficos de público incluem pico e média de espectadores por dia, médias
     por horário, além de médias de usuários listados e de usuários com tokens por
     horário, data e dia da semana. Médias horárias de audiência e de usuários
     listados/com tokens são ponderadas pelas amostras registradas; médias por
     data ou dia da semana usam os dias com dados. O pico de usuários com tokens
     por horário é a maior contagem observada naquela hora, não uma média.

   - A área de lives mostra frequência de dias ativos, duração bruta e líquida,
     tokens e ritmo por live. Os gráficos de novos/recorrentes e doadores mostram
     a evolução por agrupamento; nas séries de doadores, a mesma pessoa pode
     aparecer em dias diferentes. A comparação entre períodos exibe médias de
     tokens e, quando disponíveis, de espectadores.

   - O mapa de calor organiza tokens por dia da semana e hora; a intensidade da
     cor representa tokens, e o tooltip informa também eventos e público médio.
     A linha do tempo separa eventos de moderação por hora. As tabelas de
     engajamento, ligas, doadores e rei da sala complementam esses gráficos com
     métricas individuais ou totais.

   - Os gráficos de suspeitas e silenciados contam usuários distintos em cada
     intervalo; não representam uma contagem acumulada de pessoas únicas no
     período inteiro. Suspeita de bot é uma indicação heurística, não uma
     confirmação. Gráficos podem aparecer vazios quando não há registros salvos;
     valores ausentes não significam necessariamente zero atividade.

   - Na linha do tempo do período, cada meta e show pode ser apagado individualmente.
     A ação pede confirmação, remove o registro do histórico e não recalcula métricas
     agregadas. É necessário pausar o monitoramento do modelo antes da exclusão.
   - Relatórios diário e por período mostram a conversão de novos e recorrentes em
     doadores quando há dados completos. No período, recorrentes são contados por dia;
     uma mesma pessoa pode aparecer em mais de um dia.

   - Para validar o total do rei, o valor do site é mantido até coincidir com a
     soma das gorjetas capturadas no chat; depois dessa confirmação, o relatório
     acompanha a soma do chat. Se o limite para virar rei aparecer antes do nome,
     o sistema identifica quem alcançou esse limite. Esse histórico começa com
     esta versão e guarda apenas o rei mais recente observado em cada dia.

   - Backup completo ou limitado a uma modelo em JSON, disponível no painel e
     na página de relatórios, com validação, prévia, confirmação e limite de
     25 MiB. A restauração seletiva substitui os dados daquela modelo e preserva
     os demais, inclusive no histórico compartilhado. Backups antigos continuam
     sendo reconhecidos como completos; um backup limitado não pode ser aplicado
     como restauração completa.

   - O histórico é armazenado no IndexedDB da extensão, mais adequado para
     volumes maiores que o armazenamento chave/valor do navegador.

   - O uso do IndexedDB exibido na aba Histórico é uma estimativa do tamanho
     serializado dos dados; o espaço real ocupado pelo navegador pode variar.

   - A restauração verifica todas as abas Stripchat abertas; pause o
     monitoramento antes de importar. A restauração completa substitui os dados
     locais do SC Monitor; exporte um backup atual antes de restaurar outro
     arquivo. Guarde o arquivo exportado fora do navegador para evitar perda ao
     desinstalar.

   - Isolamento automático de contexto ao navegar entre salas (SPA).


------------------------------------------------------------------------
📖 GUIA DAS ABAS E DOS CONTROLES DO PAINEL
------------------------------------------------------------------------

ABAS

   - 📊 Geral: mostra a sala e o estado do monitoramento, tokens da sessão e
     do dia, tempos bruto e líquido, espectadores e configurações de tarifas
     do Fan Club e dos shows. Os valores de shows são estimativas.

   - 👥 Usuários: apresenta os números de audiência, novos e recorrentes,
     ligas, o gráfico de usuários listados e a lista de usuários com tokens,
     gorjetas e mensagens. Os filtros permitem ver todos, novos ou recorrentes.
     Também exibe espectadores suspeitos segundo critérios heurísticos; isso
     não confirma que uma conta seja bot.

   - 💰 Eventos: reúne eventos capturados, como gorjetas, compras de conteúdo,
     menu, metas e shows. Os filtros separam todos, gorjetas, menu e metas/shows.
     Inclui as tarefas/pendências geradas a partir de pedidos e as metas da sala;
     clique em uma tarefa para marcá-la como concluída.

   - 🛡️ Moderação: permite cadastrar palavras e frases proibidas e consulta
     mensagens moderadas e usuários silenciados. A extensão pode tentar silenciar
     mensagens identificadas; confira o histórico para ver o resultado.

   - 🗂️ Histórico: lista salas/modelos e dados diários salvos, com ações sobre
     os registros. Também permite exportar/importar backups completos ou de uma
     modelo. Pause o monitoramento de todas as abas abertas antes de restaurar.

   - 📑 Relatório: compara dados da sessão, do dia ou de um período. Selecione a
     sala e as datas para consultar os gráficos e métricas; use “Página” para
     abrir os relatórios detalhados. “Copiar Resumo” e “CSV” exportam os dados
     do relatório selecionado.


CONTROLES DO PAINEL

   - Idioma: escolha Português (Brasil), Español ou English no cabeçalho do
     painel ou na página de relatórios. A preferência é aplicada às interfaces abertas.

   - Monitorar / Pausar Monitor: inicia ou encerra manualmente a coleta da
     sessão atual. Pausar encerra e salva a sessão; não apaga o histórico diário.

   - Coleta Automática: enquanto o monitoramento está ativo, alterna entre as
     abas de chat e usuários aproximadamente a cada 12 segundos para atualizar
     eventos e a lista de usuários; depois retorna ao chat. Não inicia o
     monitoramento por conta própria.

   - Monitorar sala (OFF ⇄ ON): acompanha automaticamente a sala aberta. Inicia
     a coleta quando detecta a transmissão ao vivo e encerra após 2 minutos
     offline sem novas mensagens no chat. Mensagens prolongam a espera; voltar
     ao vivo cancela a parada. Ao navegar para outra sala, a coleta da sala
     acompanhada é encerrada. Desmarcar esta opção desativa a automação, mas não
     pausa uma sessão que já esteja monitorando; use “Pausar Monitor”.

   - Fixar: mantém o painel aberto ao clicar fora dele. Para fechá-lo, use
     “Fechar”.

   - Mover e redimensionar: arraste o painel pelo cabeçalho ou pela barra
     inferior. Ajuste o tamanho arrastando qualquer um dos quatro cantos.

   - Atualizar: solicita uma nova leitura dos dados disponíveis na página.
     Guardar salva os dados locais naquele momento. CSV exporta os dados em
     formato de planilha; “Limpar sessão” reinicia os dados da sessão atual.


------------------------------------------------------------------------
📂 ESTRUTURA DO PROJETO
------------------------------------------------------------------------

```text
site_monitor/
├── manifest.json            # Configuração do Manifest V3 da extensão (v5.0)
├── README.txt               # Documentação oficial do projeto
├── README.en.md             # Documentação em inglês
├── README.es.md             # Documentação em espanhol
├── reports.html             # Página dedicada aos relatórios
├── reports.css              # Estilos da página de relatórios
├── popup/
│   ├── popup.html            # Menu flutuante simplificado da barra do navegador
│   ├── popup.css             # Estilos do popup
│   └── popup.js              # Lógica de conexão do popup com a aba ativa
├── src/
│   ├── content.js            # Orquestração do monitoramento, sessão e navegação SPA
│   ├── background.js         # Service worker, IndexedDB, backups e ícone por aba
│   ├── core/
│   │   ├── state.js          # Estado global em memória e métricas
│   │   ├── persistence.js    # Gravação, consolidação e histórico diário
│   │   ├── configuration.js  # Padrões de inicialização e limpeza de opções temporárias
│   │   ├── backup.js         # Validação e formato dos backups JSON
│   │   ├── room-king.js      # Reconciliação do rei atual com valores de site e chat
│   │   ├── storage.js        # Interface de armazenamento via service worker
│   │   └── ui-refresh.js     # Atualizações de UI desacopladas dos módulos de domínio
│   ├── modules/
│   │   ├── auto-collector.js # Alternância de abas e ciclo da coleta automática
│   │   ├── events.js         # Leitura de mensagens, gorjetas, plugins e shows
│   │   ├── moderation.js     # Motor de verificação e filtragem por palavras-chave
│   │   └── parsers.js        # Extratores de DOM (metas, rei da sala, usuários, ligas)
│   ├── ui/
│   │   ├── panel.js          # Navegação, estado e orquestração do painel
│   │   ├── panel-events-controller.js # Resumo, filtros e eventos da aba Eventos
│   │   ├── panel-report-controller.js # Estado e integração da aba Relatório
│   │   ├── panel-report-workspace.js  # Carregamento e renderização do relatório no painel
│   │   ├── panel-report-controls.js   # Controles e seletores da aba Relatório
│   │   ├── panel-template.js  # Marcação HTML do painel
│   │   ├── panel-resize.js    # Cálculo do redimensionamento pelos quatro cantos
│   │   ├── open-reports.js    # Abertura da página dedicada de relatórios
│   │   ├── chart-data.js      # Normalização e agregação de séries temporais
│   │   ├── reports-page.js    # Controles e carregamento dos relatórios
│   │   ├── reports-view.js    # Renderização dos relatórios detalhados
│   │   ├── report-charts.js   # Gráficos e controles de granularidade do relatório
│   │   ├── report-data.js     # Agregação temporal e métricas usadas nos relatórios
│   │   ├── history/
│   │   │   └── history-table.js # Renderização da tabela de histórico
│   │   ├── users/
│   │   │   └── users-table.js # Renderização e filtros da tabela de usuários
│   │   ├── todos/
│   │   │   └── todo-list.js   # Renderização e formatação das tarefas
│   │   ├── moderation/
│   │   │   └── moderation-view.js # Renderização das listas de moderação
│   │   ├── dashboard/
│   │   │   ├── basic-charts.js # Gráficos SVG do painel
│   │   │   ├── daily-stats.js # Marcações do consolidado diário
│   │   │   └── event-summary.js # Renderização do resumo de eventos
│   │   └── export/
│   │       └── csv-export.js  # Geração e download dos relatórios em CSV
│   └── utils/
│       └── helpers.js         # Funções utilitárias (sanitização de texto e formatadores)
└── tests/                     # Testes de regressão com o runner nativo do Node.js
```

TESTES DE REGRESSÃO

   - Requer Node.js 18 ou superior. Execute `npm test` na raiz do projeto.
   - Os testes usam o runner nativo do Node.js e não adicionam dependências
     de terceiros.
   - A suíte cobre armazenamento e backup, persistência, relatórios, captura de
     eventos, histórico do rei e redimensionamento do painel.



------------------------------------------------------------------------
⚙️ COMO INSTALAR / ATUALIZAR NO GOOGLE CHROME / BRAVE / EDGE
------------------------------------------------------------------------

AVISO: A extensão não foi testada com uma conta de modelo. Para utilizá-la,
recomendamos acessar o Stripchat com uma conta normal de usuário.

A extensão pode ser usada sem login, mas pode não ler os eventos de Ticket
Shows corretamente: sem estar conectado, o valor do ingresso pode aparecer
em dólares em vez de tokens.

Baixar o código pelo GitHub:

   Repositório: `https://github.com/UsuarioGitQualquer/SC-MONITOR`

   - GitHub CLI:
     `gh repo clone UsuarioGitQualquer/SC-MONITOR`

   - Git:
     `git clone https://github.com/UsuarioGitQualquer/SC-MONITOR.git`

   - Baixar como ZIP pelo navegador:
     Abra `https://github.com/UsuarioGitQualquer/SC-MONITOR`, selecione
     Code > Download ZIP e extraia o arquivo.

   - Baixar e extrair como ZIP pelo PowerShell (ramo main):
     `$repo = "https://github.com/UsuarioGitQualquer/SC-MONITOR"`
     `$zip = "$HOME\Downloads\SC-Monitor.zip"`
     `Invoke-WebRequest -Uri "$repo/archive/refs/heads/main.zip" -OutFile $zip`
     `Expand-Archive -Path $zip -DestinationPath "$HOME\Downloads\SC-Monitor-source"`

   Depois de clonar ou extrair, use a pasta raiz que contém `manifest.json`
   em “Carregar sem compactação”.

1. Abra o navegador e acesse a página de extensões:
   chrome://extensions/

2. No canto superior direito, ative a chave "Modo do desenvolvedor" (Developer mode).

3. Escolha o procedimento conforme o seu caso:
   - SE FOR UMA INSTALAÇÃO NOVA: Clique no botão "Carregar sem compactação" 
     (Load unpacked) no canto superior esquerdo e selecione a pasta raiz `site_monitor`.
   - SE JÁ ESTIVER INSTALADA (ATUALIZAÇÃO): Localize o cartão do SC Monitor na 
     lista de extensões e clique no ícone de atualizar (↻) localizado no próprio cartão.

4. Abra a página da transmissão no Stripchat e clique no ícone 📊. Se a extensão
   tiver sido atualizada com a sala já aberta, abrir o popup da extensão tenta
   reconectar o painel automaticamente, sem recarregar a página.


Habilitar uso em Janelas Anônimas (Opcional):
- Na mesma página de extensões (`chrome://extensions/`), localize o
  cartão do **SC Monitor** e clique no botão **"Detalhes"**.
- Role a página para baixo e localize a opção **"Permitir em modo anônimo"**.
- Ative a chave correspondente para permitir o uso da extensão em páginas do
  Stripchat abertas em uma janela anônima.


------------------------------------------------------------------------
🔒 PRIVACIDADE E SEGURANÇA
------------------------------------------------------------------------

- Todo o processamento de mensagens, contagem de tokens e captura de dados

  ocorre estritamente no seu navegador (Client-Side).

- O histórico fica no IndexedDB local da extensão, com a quota ampliada por
  `unlimitedStorage`. Os dados permanecem no navegador; mantenha backups externos.

- Nenhuma informação da modelo, espectadores ou chat é enviada para
  servidores externos.

- Quando o monitoramento está ativo, o avatar é carregado do CDN do Stripchat
  para compor o ícone da aba; a imagem não é encaminhada a outros servidores.

========================================================================
