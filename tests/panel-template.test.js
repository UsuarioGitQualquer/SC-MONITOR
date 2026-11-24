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
  assert.match(html, /id="scm-price-soldado" value="10"/);
  assert.match(html, /id="scm-price-lorde" value="20"/);
  assert.match(html, /id="scm-price-principe" value="30"/);
  assert.match(html, /id="scm-price-private" value="4"/);
  assert.match(html, /id="scm-price-vip" value="8"/);
  assert.match(html, /id="scm-report-workspace"/);
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
