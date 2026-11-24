export function buildPanelHtml({ headerDate, footerDate, fanClubPrices = {}, showPrices = {} }) {
  return `

    <div class="head" id="scm-panel-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #ff2a6d, #8a2be2); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #fff; box-shadow: 0 0 12px rgba(255,42,109,0.6);">S</div>
        <div style="display: flex; flex-direction: column; gap: 1px;">
          <span style="font-size: 13px; letter-spacing: 0.6px; color: #fff;">STRIPCHAT MONITOR</span>
          <span id="scm-header-date" style="font-size: 10px; color: #00e5ff; font-weight: 500;">📅 ${headerDate}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <label style="display:inline-flex; align-items:center; gap:5px; font-size:10px; color:#8b92b8;">
          Idioma
          <select id="scm-language" aria-label="Idioma" style="width:auto; padding:4px 6px; border-radius:6px; font-size:10px;">
            <option value="pt-BR">Português-BR</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; cursor: pointer; user-select: none; color: #8b92b8;">
          <input type="checkbox" id="scm-pin-panel" style="cursor: pointer;" />
          <span>Fixar</span>
        </label> 
        <button class="close" id="scm-close">Fechar</button>
      </div>
    </div>

    <div class="tabs-nav">
      <button class="scm-tab-btn" data-tab="general">📊 Geral</button>
      <button class="scm-tab-btn" data-tab="users">👥 Usuários</button>
      <button class="scm-tab-btn" data-tab="events">💰 Eventos</button>
      <button class="scm-tab-btn" data-tab="moderation">🛡️ Moderação</button>
      <button class="scm-tab-btn" data-tab="history">🗂️ Histórico</button>
      <button class="scm-tab-btn" data-tab="report">📑 Relatório</button>
    </div>

    <div class="body">
      <div id="scm-tab-general" class="scm-tab-content">
        <div class="cards" style="align-items:center;">
          <div class="muted" id="scm-room" style="margin: 0; font-size: 11.5px;"></div>
          <div id="scm-status-badge" style="display: flex; justify-content: flex-end; align-items: center;"></div>
        </div>
        <div class="cards">
          <div class="card" style="background: linear-gradient(135deg, #181a36 0%, #1c254c 100%); border-left: 3px solid #00e5ff;"><small style="color: #00e5ff;">Tokens hoje (gorjetas + shows estimados)</small><strong id="scm-tokens" style="font-size: 18px; color: #fff;">0 tk</strong></div>
          <div class="card" style="background: linear-gradient(135deg, #1a3114 0%, #204d17 100%); border-left: 3px solid #07af04;"><small style="color: #00ff3c;">Tokens na sessão (gorjetas + shows estimados)</small><strong id="scm-session-tokens" style="font-size: 18px; color: #fff;">0 tk</strong></div>
          <div class="card"><small>Tempo Bruto (Sessão)</small><strong id="scm-time-brute">00:00:00</strong></div>
          <div class="card"><small>Tempo Líquido (Sessão)</small><strong id="scm-time-net" style="color: #00e5ff;">00:00:00</strong></div>
          <div class="card"><small>Espectadores agora</small><strong id="scm-viewers" style="color: #ff7b00;">—</strong></div>
          <div class="card"><small>Tempo Líquido (Hoje)</small><strong id="scm-time-net-day" style="color: #c084fc;">00:00:00</strong></div>
        </div>
        <div class="cards" style="margin-top: -4px;">
          <div class="card" style="grid-column: span 2; flex-direction: row; justify-content: space-between; align-items: center; padding: 8px 14px;">
            <small style="margin:0;">Tempo Bruto Acumulado (Hoje)</small>
            <strong id="scm-time-brute-day" style="margin:0; font-size: 13px;">00:00:00</strong>
          </div>
        </div>
        <div style="font-size:10px; color:#8b92b8; font-style:italic; margin-bottom:8px; line-height:1.45; background:rgba(0,229,255,0.05); padding:5px 7px; border-radius:6px;">
          ℹ️ <strong style="color:#e2e8f0;">Tempo Bruto:</strong> cronômetro total desde o início do monitoramento.<br>
          ℹ️ <strong style="color:#e2e8f0;">Tempo Líquido:</strong> tempo efetivo com a transmissão ativa e a sala realmente online.
        </div>

        <h4>Configuração de Tarifas (Tokens)</h4>
        <div style="font-size:10px; color:#8b92b8; font-style:italic; margin-bottom:6px;">
          ℹ️ Informe os valores do Fan Club (período de 3 meses) e o preço por minuto dos shows privados e exclusivos. A receita de shows é estimada pelo estado do player e pela tarifa informada; não representa confirmação de pagamento.
        </div>
        <div class="card" style="padding: 12px; margin-bottom: 12px;">
          <small style="color: #ff2a6d; font-weight: 700; margin-bottom: 6px; display: block;">Fan Club (3 Meses)</small>
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <div style="flex: 1;"><small>Soldado</small><input type="number" id="scm-price-soldado" value="${Number(fanClubPrices.soldado) || 0}"></div>
            <div style="flex: 1;"><small>Lord</small><input type="number" id="scm-price-lorde" value="${Number(fanClubPrices.lord) || 0}"></div>
            <div style="flex: 1;"><small>Príncipe</small><input type="number" id="scm-price-principe" value="${Number(fanClubPrices.principe) || 0}"></div>
          </div>
          <small style="color: #00e5ff; font-weight: 700; margin-bottom: 6px; display: block;">Shows (tk/min)</small>
          <div style="display: flex; gap: 8px;">
            <div style="flex: 1;"><small>Privado</small><input type="number" id="scm-price-private" value="${Number(showPrices.privateTkMin) || 0}"></div>
            <div style="flex: 1;"><small>Exclusivo</small><input type="number" id="scm-price-vip" value="${Number(showPrices.vipTkMin) || 0}"></div>
          </div>
        </div>
      </div>

      <div id="scm-tab-users" class="scm-tab-content">
        <div class="cards" style="margin-bottom: 10px;">
          <div class="card" style="border-left: 3px solid #ff2a6d;"><small>Pico observado hoje</small><strong id="scm-peak">0</strong></div>
          <div class="card" style="border-left: 3px solid #00e5ff;"><small>Média espectadores hoje</small><strong id="scm-avg">0</strong></div>
          <div class="card"><small>Listados</small><strong id="scm-users">0</strong></div>
          <div class="card"><small>Outros</small><strong id="scm-others">0</strong></div>
          <div class="card"><small>Com Tokens</small><strong id="scm-tokens-users" style="color:#00e5ff;">0</strong></div>
          <div class="card"><small>Ultimate</small><strong id="scm-ultimate-users" style="color:#ff2a6d;">0</strong></div>
          <div class="card"><small>Invisíveis</small><strong id="scm-invisible-users">0</strong></div>
          <div class="card"><small>Mais (+)</small><strong id="scm-more-users">0</strong></div>
          <div class="card" style="border-left: 3px solid #00e5ff;"><small>🆕 Novos (Hoje)</small><strong id="scm-new-users" style="color: #00e5ff;">0</strong></div>
          <div class="card" style="border-left: 3px solid #8a2be2;"><small>🔁 Recorrentes (Hoje)</small><strong id="scm-returning-users" style="color: #c084fc;">0</strong></div>
        </div>
        <div id="scm-users-audience-step-bar" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; margin:4px 0 6px;">
          <span style="font-size:10px; color:#8b92b8;">Bloco do gráfico:</span>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            <button type="button" class="scm-users-audience-step" data-step="auto" style="background:linear-gradient(90deg, #00e5ff, #2563eb); color:#0f1024; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">Auto (1m)</button>
            <button type="button" class="scm-users-audience-step" data-step="5" style="background:#23264d; color:#8b92b8; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">5m</button>
            <button type="button" class="scm-users-audience-step" data-step="10" style="background:#23264d; color:#8b92b8; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">10m</button>
            <button type="button" class="scm-users-audience-step" data-step="30" style="background:#23264d; color:#8b92b8; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">30m</button>
            <button type="button" class="scm-users-audience-step" data-step="60" style="background:#23264d; color:#8b92b8; border:0; padding:4px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">1h</button>
          </div>
        </div>
        <div id="scm-users-audience-chart"></div>
        <div style="font-size:10px; color:#8b92b8; font-style:italic; margin-bottom:10px; line-height:1.45;">
          ℹ️ <strong style="color:#e2e8f0;">Mais (+)</strong> representa usuários sem nick visível na lista que aparecem como "+ mais usuários".<br>
          ℹ️ <strong style="color:#e2e8f0;">Listados</strong> representa usuários cujo nick aparece na lista da sala. As categorias podem se sobrepor; não some os cartões para obter o total de espectadores.
        </div>

        <h4>Ligas Atuais</h4>
        <div class="cards" style="grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 10px; margin-bottom: 14px;">
          <div class="card" style="border-left: solid 3px #94a3b8; padding: 8px;"><small class="leagues">Cinzas</small><strong id="scm-league-grey">0</strong></div>
          <div class="card" style="border-left: solid 3px #f97316; padding: 8px;"><small class="leagues">Bronze</small><strong id="scm-league-bronze">0</strong></div>
          <div class="card" style="border-left: solid 3px #00e5ff; padding: 8px;"><small class="leagues">Prata</small><strong id="scm-league-silver">0</strong></div>
          <div class="card" style="border-left: solid 3px #facc15; padding: 8px;"><small class="leagues">Ouro</small><strong id="scm-league-gold">0</strong></div>
          <div class="card" style="border-left: solid 3px #c084fc; padding: 8px;"><small class="leagues">Diamante</small><strong id="scm-league-diamond">0</strong></div>
          <div class="card" style="border-left: solid 3px #ff2a6d; padding: 8px;"><small class="leagues">Real</small><strong id="scm-league-royal">0</strong></div>
          <div class="card" style="border-left: solid 3px #ff7b00; padding: 8px;"><small class="leagues">⭐Lendária</small><strong id="scm-league-legend">0</strong></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px 0; border-bottom: 1px solid #272952; padding-bottom: 6px;">
          <h4 style="margin: 0; border: 0; padding: 0;">Lista de Usuários</h4>
          <div id="scm-users-filter-bar" style="display: flex; gap: 4px;">
            <button type="button" class="scm-user-filter-btn" data-filter="all" style="background: linear-gradient(90deg, #ff2a6d, #ff7b00); color: #fff; border: 0; padding: 4px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">Todos</button>
            <button type="button" class="scm-user-filter-btn" data-filter="new" style="background: #23264d; color: #8b92b8; border: 0; padding: 4px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">🆕 Novos</button>
            <button type="button" class="scm-user-filter-btn" data-filter="returning" style="background: #23264d; color: #8b92b8; border: 0; padding: 4px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">🔁 Recorrentes</button>
          </div>
        </div>
        <div style="font-size:10px; color:#8b92b8; font-style:italic; margin:6px 0 8px;">
          ℹ️ O símbolo ciano (●) indica que o usuário ainda está na lista; o símbolo cinza (○) indica que saiu da lista atual.
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário (nível)</th>
                <th>tk</th>
                <th>Gorjetas</th>
                <th>Msgs</th>
                <th>Visto em</th>
              </tr>
            </thead>
            <tbody id="scm-table"></tbody>
          </table>
        </div><br>

        <div class="scm-cyber-card" style="margin-top: 12px;">
          <div style="font-weight: 700; color: #ff2a6d; margin-bottom: 6px; font-size: 12px;">🛡️ Espectadores Suspeitos / Bots</div>        
          <div style="font-size:10px; color:#8b92b8; font-style:italic; margin-bottom:7px; line-height:1.45;">
            ℹ️ <strong style="color:#e2e8f0;">Como é detectado:</strong> contas cinzas, nível até 9, observadas continuamente na lista por pelo menos 20 minutos sem mensagens nem tokens na visita atual, e com nome suspeito ou entradas/saídas sincronizadas. A visita termina quando a conta sai da lista ou a sala fica offline. É um indicador heurístico, não prova de bot ou gravação.
          </div>
          <div class="scroll" style="height: 120px; min-height: 60px;">
            <table>
              <thead>
                <tr>
                  <th>Usuário / Motivo</th>
                  <th style="text-align: right;">Tempo</th>
                  <th style="text-align: right; padding-right: 24px;">Liga</th>
                </tr>
              </thead>
              <tbody id="scm-suspect-bots-table"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="scm-tab-events" class="scm-tab-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px 0; border-bottom: 1px solid #272952; padding-bottom: 6px;">
          <h4 style="margin: 0; border: 0; padding: 0;">Eventos e Menu / Gorjetas</h4>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button type="button" class="scm-event-filter-btn" data-filter="all" style="background: linear-gradient(90deg, #00e5ff, #2563eb); color: #0f1024; border: 0; padding: 3px 7px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">Todos</button>
              <button type="button" class="scm-event-filter-btn" data-filter="tips" style="background: #23264d; color: #8b92b8; border: 0; padding: 3px 7px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">Gorjetas</button>
              <button type="button" class="scm-event-filter-btn" data-filter="menu" style="background: #23264d; color: #8b92b8; border: 0; padding: 3px 7px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">Menu</button>
              <button type="button" class="scm-event-filter-btn" data-filter="goals" style="background: #23264d; color: #8b92b8; border: 0; padding: 3px 7px; border-radius: 99px; font-size: 10px; font-weight: bold; cursor: pointer;">Shows</button>
            </div>
          </div>
        </div>
        <div class="scroll"><table><thead><tr><th>Item / Pedido</th><th>Preço</th><th>Tipo</th></tr></thead><tbody id="scm-wheel"></tbody></table></div>
        
        <div id="scm-todo-section" style="margin:14px 0 10px; border:1px solid #26734d; border-left:4px solid #4ade80; border-radius:11px; background:linear-gradient(135deg,rgba(52,211,153,0.22),rgba(24,26,54,0.96)); box-shadow:0 4px 14px rgba(52,211,153,0.12); overflow:hidden;">
          <div id="scm-todo-section-header" style="padding:11px 12px 9px; background:transparent;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <h4 id="scm-todo-heading" style="margin:0; border:0; padding:0; color:#4ade80; font-size:14px; letter-spacing:0.2px; text-transform:none;">📌 Para Fazer (Tarefas / Pendências)</h4>
              <span id="scm-todo-pending-count" style="flex-shrink:0; padding:4px 9px; border-radius:99px; background:rgba(52,211,153,0.18); color:#86efac; font-size:10px; font-weight:800;">0 pendências</span>
            </div>
            <div style="margin-top:5px; font-size:10px; color:#cbd5e1;">Clique em uma tarefa para marcar como feita; as pendentes aparecem primeiro.</div>
          </div>
          <div id="scm-todo-container" style="padding:0 10px 10px;"></div>
        </div>

        <h4>Metas da sala</h4>
        <div id="scm-goal"></div>       
      </div>

      <div id="scm-tab-moderation" class="scm-tab-content">
        <h4>Palavras/Frases Proibidas (Spam)</h4>
        <div class="card" style="padding: 12px;">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="scm-mod-input" placeholder="ex: telegram, cupom" style="flex: 1; background: #0f1024; border: 1px solid #272952; color: #fff; padding: 8px 10px; border-radius: 99px; font-size: 12px;" />
            <button id="scm-mod-add-btn" type="button" style="background: linear-gradient(90deg, #ff2a6d, #ff7b00); color: #fff; border: none; padding: 0 16px; border-radius: 99px; font-weight: bold; cursor: pointer; font-size: 12px;">Add</button>
          </div>
          <div id="scm-mod-tags-container" style="display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px;"></div>
        </div>

        <h4>Mensagens Moderadas</h4>
        <div class="scroll"><table><thead><tr><th>Usuário</th><th>Mensagem / Motivo</th></tr></thead><tbody id="scm-moderation-table"></tbody></table></div>

        <h4>Usuários Silenciados</h4>
        <div class="scroll"><table><thead><tr><th>Usuário / Moderador</th><th>Última Mensagem</th></tr></thead><tbody id="scm-muted-users-table"></tbody></table></div>
      </div>

      <div id="scm-tab-history" class="scm-tab-content">
        <section class="scm-backup-card">
          <div class="scm-backup-heading">
            <strong>Backup e restauração</strong>
            <small>Exporte todos os dados ou apenas uma modelo. A restauração seletiva preserva os demais modelos.</small>
          </div>
          <div class="scm-backup-section">
            <strong class="scm-backup-section-title">Exportar</strong>
            <div class="scm-backup-controls">
              <label for="scm-backup-export-scope">Escopo
                <select id="scm-backup-export-scope">
                  <option value="all">Todos os dados</option>
                  <option value="model">Uma modelo</option>
                </select>
              </label>
              <select id="scm-backup-export-model" aria-label="Modelo para exportar" hidden></select>
              <button type="button" id="scm-export-backup">Exportar backup JSON</button>
            </div>
          </div>
          <div class="scm-backup-section">
            <strong class="scm-backup-section-title">Importar</strong>
            <div class="scm-backup-controls">
              <button type="button" id="scm-import-backup">Selecionar arquivo JSON</button>
              <input id="scm-backup-file" type="file" accept=".json,application/json" hidden />
            </div>
            <div id="scm-backup-import-options" class="scm-backup-import-options" hidden>
              <label for="scm-backup-import-scope">Restaurar
                <select id="scm-backup-import-scope">
                  <option value="all">Todos os dados do arquivo</option>
                  <option value="model">Somente uma modelo</option>
                </select>
              </label>
              <select id="scm-backup-import-model" aria-label="Modelo para importar" hidden></select>
              <div class="scm-backup-controls scm-backup-actions">
                <button type="button" id="scm-apply-backup" class="scm-backup-primary">Restaurar backup</button>
                <button type="button" id="scm-cancel-backup">Cancelar</button>
              </div>
            </div>
            <small id="scm-backup-preview" class="scm-backup-note" role="status" hidden></small>
          </div>
          <small id="scm-storage-usage" class="scm-backup-note" role="status">Consultando armazenamento local…</small>
          <small id="scm-backup-status" class="scm-backup-note" role="status" aria-live="polite"></small>
        </section>
        <h4>Salas / Modelos Salvas</h4>
        <div class="scroll"><table><thead><tr><th>Modelo / Sala</th><th>Data</th><th>Pico / Média</th><th>Tokens</th><th>Ações</th></tr></thead><tbody id="scm-history-table"><tr><td colspan="5" style="text-align:center; color:#8b92b8; padding: 16px;">Carregando...</td></tr></tbody></table></div>
      </div>

      <div id="scm-tab-report" class="scm-tab-content">
        <div class="scm-report-header-row" style="display:flex; flex-direction:column; align-items:stretch; gap:6px;">
          <button type="button" id="scm-open-reports" style="align-self:flex-start; background:#23264d; color:#00e5ff; border:1px solid #353970; padding:8px 12px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">↗ Página de relatório</button>
          <div class="scm-cyber-card scm-report-center-card" style="width:100%; min-width:0; box-sizing:border-box; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #00e5ff; font-size: 12px;">📑 Central de Relatórios</span>
              <div id="scm-report-mode-bar" style="display:flex; gap:4px; flex-wrap:wrap;">
              <button type="button" class="scm-rep-mode-btn" data-mode="session" style="background:#23264d; color:#8b92b8; border:0; padding:4px 8px; border-radius:99px; font-size:10px; font-weight:bold; cursor:pointer;">🎬 Sessão</button>
              <button type="button" class="scm-rep-mode-btn" data-mode="day" style="background:linear-gradient(90deg, #ff2a6d, #ff7b00); color:#fff; border:0; padding:4px 8px; border-radius:99px; font-size:10px; font-weight:bold; cursor:pointer;">📅 Dia</button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 10px;">
            <div>
              <small>Modelo / Sala</small>
              <select id="scm-report-model" style="width: 100%; background: #0f1024; color: #fff; border: 1px solid #272952; padding: 7px; border-radius: 8px; font-size: 11px;"></select>
            </div>

            <div id="scm-report-day-controls" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <small>Data Principal (A)</small>
                <select id="scm-report-date-a" style="width: 100%; background: #0f1024; color: #fff; border: 1px solid #272952; padding: 7px; border-radius: 8px; font-size: 11px;"></select>
              </div>
              <div id="scm-report-date-b-wrap">
                <small>Comparar com (B)</small>
                <select id="scm-report-date-b" style="width: 100%; background: #0f1024; color: #fff; border: 1px solid #272952; padding: 7px; border-radius: 8px; font-size: 11px;"></select>
              </div>
              <div id="scm-report-session-wrap" style="display: none; grid-column: 1 / -1;">
                <small>Live do Dia</small>
                <select id="scm-report-session" style="width: 100%; background: #0f1024; color: #fff; border: 1px solid #272952; padding: 7px; border-radius: 8px; font-size: 11px;"></select>
              </div>
              <div id="scm-report-live-b-wrap" style="display: none; grid-column: 1 / -1;">
                <small>Comparar esta Live com (B)</small>
                <select id="scm-report-live-b" style="width: 100%; background: #0f1024; color: #fff; border: 1px solid #272952; padding: 7px; border-radius: 8px; font-size: 11px;"></select>
              </div>
            </div>

          </div>

          <div style="display: flex; gap: 8px;">
            <button id="scm-report-copy" type="button" style="flex: 1; background: linear-gradient(90deg, #00e5ff, #2563eb); border: 0; color: #0f1024; padding: 8px; border-radius: 99px; cursor: pointer; font-size: 11px; font-weight: bold;">📋 Copiar Resumo</button>
            <button id="scm-report-csv" type="button" style="flex: 1; background: linear-gradient(90deg, #ff2a6d, #ff7b00); border: 0; color: #fff; padding: 8px; border-radius: 99px; cursor: pointer; font-size: 11px; font-weight: bold;">📥 CSV</button>
          </div>
        </div>
        </div>
        <div id="scm-report-workspace"></div>
      </div>

      <div class="card" style="display:flex; flex-direction:row; align-items:center; gap:10px; margin-top:14px;">
        <input type="checkbox" id="scm-auto-collect" style="width:16px;height:16px;cursor:pointer;">
        <label for="scm-auto-collect" style="font-weight:600;color:#00e5ff;cursor:pointer;font-size:11px;">Coleta Automática</label>
        <small style="margin-left:auto;color:#8b92b8;font-size:10px;">Chat ↔ Usuários</small>
      </div>

      <div class="card" style="display:flex; flex-direction:row; align-items:center; gap:10px; margin-top:8px;">
        <input type="checkbox" id="scm-auto-monitor-live" style="width:16px;height:16px;cursor:pointer;">
        <label for="scm-auto-monitor-live" style="font-weight:600;color:#ff2a6d;cursor:pointer;font-size:11px;">Monitorar sala (OFF ⇄ ON)</label>
        <small style="margin-left:auto;color:#8b92b8;font-size:10px;">Só nesta sala</small>
      </div>

      <div class="button-grid">
        <div class="button-row">
          <button id="scm-monitor">Monitorar</button>
          <button id="scm-refresh">Atualizar</button>
          <button id="scm-save">Guardar</button>
        </div>
        <div class="button-row">
          <button id="scm-export">CSV</button>
          <button id="scm-reset">Limpar sessão</button>
        </div>
      </div>
    </div>

    <div class="scm-panel-footer" id="scm-panel-footer">
      <div class="scm-panel-footer-brand">
        <span class="scm-panel-footer-logo">S</span>
        <span>STRIPCHAT MONITOR</span>
      </div>
      <span class="scm-panel-footer-date" id="scm-panel-footer-date">📅 ${footerDate}</span>
    </div>
    <button class="scm-panel-resize-handle scm-resize-nw" data-resize-corner="nw" type="button" aria-label="Redimensionar pelo canto superior esquerdo"></button>
    <button class="scm-panel-resize-handle scm-resize-ne" data-resize-corner="ne" type="button" aria-label="Redimensionar pelo canto superior direito"></button>
    <button class="scm-panel-resize-handle scm-resize-sw" data-resize-corner="sw" type="button" aria-label="Redimensionar pelo canto inferior esquerdo"></button>
    <button class="scm-panel-resize-handle scm-resize-se" data-resize-corner="se" type="button" aria-label="Redimensionar pelo canto inferior direito"></button>
`;
}
