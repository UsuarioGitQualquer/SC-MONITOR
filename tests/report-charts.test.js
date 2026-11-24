import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGranularityToolbar,
  buildReportHorizontalChart,
  buildReportUsersChart,
} from "../src/ui/report-charts.js";

test("escapes report chart text and renders values within the bar range", () => {
  const html = buildReportHorizontalChart({
    title: "<Resumo>",
    subtitle: "dia & noite",
    rows: [{ label: "Pessoa <1>", value: 5, tooltip: "Detalhes da pessoa <1>" }],
  });

  assert.match(html, /&lt;Resumo&gt;/);
  assert.match(html, /dia &amp; noite/);
  assert.match(html, /Pessoa &lt;1&gt;/);
  assert.match(html, /title="Detalhes da pessoa &lt;1&gt;"/);
  assert.match(html, /width:100%/);
  assert.match(html, /scm-report-chart-card/);
  assert.match(html, /--report-accent:#00e5ff/);
});

test("renders an explicit empty state when a report chart has no rows", () => {
  const html = buildReportHorizontalChart({
    title: "Ligas",
    rows: [],
  });

  assert.match(html, /Ligas/);
  assert.match(html, /Sem dados para exibir\./);
});

test("renders the Others audience category in report user engagement charts", () => {
  const html = buildReportUsersChart(
    {
      listedUsersCount: 123,
      otherUsersCount: 2160,
      tokensUsersCount: 95,
      ultimateUsersCount: 7,
      invisibleUsersCount: 4,
      moreUsersCount: 2135,
    },
    {
      listedUsersCount: 78,
      otherUsersCount: 1681,
      tokensUsersCount: 53,
      ultimateUsersCount: 6,
      invisibleUsersCount: 4,
      moreUsersCount: 1656,
    },
  );

  assert.match(html, />Listados</);
  assert.match(html, />Outros</);
  assert.match(html, />Com Tokens</);
  assert.match(html, />Mais \(\+\)</);
});

test("renders the selected time granularity for session and daily reports", () => {
  const dayToolbar = buildGranularityToolbar({ timeGranularity: 10 });

  assert.match(dayToolbar, /data-step="10" style="background:linear-gradient/);
  assert.match(dayToolbar, />10m<\/button>/);

  const autoToolbar = buildGranularityToolbar({
    timeGranularity: "auto",
    autoStepMin: 2,
  });
  assert.match(autoToolbar, /data-step="auto" style="background:linear-gradient/);
  assert.match(autoToolbar, />Auto \(2m\)<\/button>/);
  assert.match(autoToolbar, /data-step="60"/);
});
