import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyStatsHtml } from "../src/ui/dashboard/daily-stats.js";

test("renders daily totals, selected flow step, audience retention, and league averages", () => {
  const html = buildDailyStatsHtml({
    formattedToday: "20/11/2026",
    flowStepMin: 30,
    waveHtml: "<svg>flow</svg>",
    peakViewers: 42,
    avgViewers: 25,
    tokens: 1200,
    userPeak: {
      listedUsersCount: 20,
      tokensUsersCount: 8,
      ultimateUsersCount: 2,
      invisibleUsersCount: 1,
    },
    userAverages: {
      listedUsersCount: 10,
      tokensUsersCount: 4,
      ultimateUsersCount: 1,
      invisibleUsersCount: 0,
    },
    audience: {
      newUsers: 5,
      newTippers: 2,
      returningUsers: 3,
      returningTippers: 1,
    },
    returnRate: 38,
    leaguePeak: { grey: 4, bronze: 3, silver: 2 },
    leagueAverages: { grey: 2, bronze: 1, silver: 1 },
  });

  assert.match(html, /Consolidado Diário \(Hoje\)/);
  assert.match(html, /data-step="30"/);
  assert.match(html, /background:linear-gradient\(90deg, #00e5ff, #2563eb\)/);
  assert.match(html, /42 espectadores/);
  assert.match(html, /1200 tk/);
  assert.match(html, /Novos: 5 \(2 doadores\)/);
  assert.match(html, /Retorno: <strong[^>]*>38%/);
  assert.match(html, /👥 Listados/);
  assert.match(html, /🪙 Com tokens/);
  assert.match(html, /min-height:44px/);
  assert.match(html, /🔘 Cinzas/);
  assert.match(html, /Pico 4 · Média 2/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /🟡 Ouro/);
  assert.match(html, /Pico 0 · Média 0/);
  assert.match(html, /<svg>flow<\/svg>/);
});

test("escapes the displayed date", () => {
  const html = buildDailyStatsHtml({
    formattedToday: "<script>",
    flowStepMin: 10,
    flowStepSelection: "auto",
    waveHtml: "",
    peakViewers: 0,
    avgViewers: 0,
    tokens: 0,
    userPeak: {},
    userAverages: {},
    audience: { newUsers: 0, newTippers: 0, returningUsers: 0, returningTippers: 0 },
    returnRate: 0,
    leaguePeak: {},
    leagueAverages: {},
  });

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /data-step="auto"/);
  assert.match(html, />Auto \(10m\)<\/button>/);
});
