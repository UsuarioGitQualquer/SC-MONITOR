import assert from "node:assert/strict";
import test from "node:test";
import { buildPanelHtml } from "../src/ui/panel-template.js";

test("builds the panel shell with supplied dates and saved prices", () => {
  const html = buildPanelHtml({
    headerDate: "10/04/2025",
    footerDate: "10/04/2025",
    fanClubPrices: { soldado: 10, lord: 20, principe: 30 },
    showPrices: { privateTkMin: 4, vipTkMin: 8 },
  });

  assert.match(html, /id="scm-header-date"[^>]*>📅 10\/04\/2025/);
  assert.match(html, /id="scm-panel-footer-date"[^>]*>📅 10\/04\/2025/);
  assert.match(html, /border-radius: 50%; background: linear-gradient\(135deg, #ff2a6d, #8a2be2\)[^>]*>S<\/div>/);
  assert.match(html, /class="scm-panel-footer-logo">S<\/span>/);
  assert.match(html, /id="scm-price-soldado" value="10"/);
  assert.match(html, /id="scm-price-lorde" value="20"/);
  assert.match(html, /id="scm-price-principe" value="30"/);
  assert.match(html, /id="scm-price-private" value="4"/);
  assert.match(html, /id="scm-price-vip" value="8"/);
  assert.match(html, /id="scm-report-workspace"/);
  assert.doesNotMatch(html, /scm-panel-welcome/);
  assert.equal((html.match(/class="scm-tab-btn" data-tab="[^"]+"><svg/g) || []).length, 6);
  assert.equal((html.match(/class="scm-metric-icon scm-metric-icon--/g) || []).length, 17);
  assert.equal((html.match(/class="scm-metric-heading"/g) || []).length, 17);
  assert.equal((html.match(/scm-metric-icon--pink/g) || []).length, 1);
  assert.match(html, /id="scm-session-tokens"/);
  assert.match(html, /Tokens na live \(gorjetas \+ shows estimados\)/);
  assert.match(html, /Tempo Bruto \(Live\)/);
  assert.match(html, /Tempo Líquido \(Live\)/);
  assert.match(html, />Limpar live<\/button>/);
  assert.doesNotMatch(html, /Tokens na sessão|Tempo Bruto \(Sessão\)|Tempo Líquido \(Sessão\)|Limpar sessão/i);
  assert.match(html, /data-mode="session"/);
  assert.match(html, /data-mode="day"/);
  assert.doesNotMatch(html, /data-mode="period"|scm-report-period|scm-period-preset/);
  assert.match(html, /id="scm-language"/);
  assert.match(html, /<option value="es">Español<\/option>/);
  assert.match(html, /<option value="en">English<\/option>/);
  assert.match(html, />↗ Página de relatório<\/button>/);
  assert.match(html, /id="scm-backup-file"/);
  assert.match(html, /id="scm-backup-export-scope"/);
  assert.match(html, /id="scm-backup-export-model"/);
  assert.match(html, /id="scm-backup-import-scope"/);
  assert.match(html, /id="scm-backup-import-model"/);
  assert.match(html, /id="scm-apply-backup"/);
  assert.match(html, /class="scm-backup-section-title">Exportar/);
  assert.match(html, /class="scm-backup-section-title">Importar/);
  assert.match(html, /id="scm-users-audience-step-bar"/);
  assert.match(html, /class="scm-users-audience-step" data-step="auto"/);
  assert.match(html, /class="scm-users-audience-step" data-step="60"[^>]*>1h/);
  assert.ok(html.indexOf('id="scm-league-legend"') < html.indexOf('id="scm-users-audience-chart"'));
  assert.ok(html.indexOf('id="scm-users-audience-chart"') < html.indexOf("Lista de Usuários"));
  assert.equal((html.match(/data-resize-corner=/g) || []).length, 4);
  assert.ok(html.indexOf('id="scm-open-reports"') < html.indexOf("Central de Relatórios"));
  assert.match(
    html,
    /<div class="scm-report-header-row"[^>]*>\s*<button[^>]*id="scm-open-reports"[^>]*>↗ Página de relatório<\/button>\s*<div class="scm-cyber-card scm-report-center-card"/,
  );
});

test("defaults missing panel prices to zero", () => {
  const html = buildPanelHtml({ headerDate: "", footerDate: "" });

  assert.match(html, /id="scm-price-soldado" value="0"/);
  assert.match(html, /id="scm-price-private" value="0"/);
});
