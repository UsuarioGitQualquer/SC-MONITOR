import assert from "node:assert/strict";
import test from "node:test";
import { buildEventSummaryHtml } from "../src/ui/dashboard/event-summary.js";

test("renders the empty event summary with active scope controls", () => {
  const html = buildEventSummaryHtml({
    summaryMap: {},
    scope: "session",
    buildGainTypeChart() {
      assert.fail("chart should not be built for an empty summary");
    },
  });

  assert.match(html, /Nenhum evento capturado ainda/);
  assert.match(html, /data-scope="session" style="background:linear-gradient/);
});

test("merges menu items, sorts totals, and escapes item names", () => {
  const events = [{ item: "tip" }];
  let chartArguments;
  const html = buildEventSummaryHtml({
    scope: "day",
    events,
    summaryMap: {
      "Menu de Gorjetas: Kiss": { type: "Menu", count: 2, tokens: 30 },
      "Menu de Gorjetas: Lick ass (during cuni) 🍑": {
        type: "Menu de Gorjetas",
        count: 1,
        tokens: 16,
      },
      Menu: { type: "Menu de Gorjetas", count: 1, tokens: 20 },
      "Wheel: Gold": { type: "Resultado da Roleta", count: 2, tokens: 40 },
      "Wheel: Lick ass (during cuni) 🍑": {
        type: "Resultado da Roleta",
        count: 1,
        tokens: 25,
      },
      "<unsafe>": { type: "Geral", count: 1, tokens: 10 },
      "Show Privado": { type: "Show", count: 1, tokens: 15 },
    },
    buildGainTypeChart(summaryMap, chartEvents) {
      chartArguments = [summaryMap, chartEvents];
      return "<svg>chart</svg>";
    },
  });

  assert.equal(chartArguments[1], events);
  assert.match(html, /<td[^>]*>Kiss \(Menu\)<\/td>\s*<td[^>]*>2x<\/td>\s*<td[^>]*>30 tk<\/td>/);
  assert.match(html, /<span data-scm-i18n>Menu<\/span><\/td>\s*<td[^>]*>1x<\/td>\s*<td[^>]*>20 tk<\/td>/);
  assert.match(html, /<td[^>]*>Gold \(Roleta\)<\/td>\s*<td[^>]*>2x<\/td>\s*<td[^>]*>40 tk<\/td>/);
  assert.match(html, /Lick ass \(during cuni\) 🍑 \(Menu\)/);
  assert.match(html, /Lick ass \(during cuni\) 🍑 \(Roleta\)/);
  assert.match(html, /<td[^>]*>Lick ass \(during cuni\) 🍑 \(Menu\)<\/td>\s*<td[^>]*>1x<\/td>\s*<td[^>]*>16 tk<\/td>/);
  assert.match(html, /<td[^>]*>Lick ass \(during cuni\) 🍑 \(Roleta\)<\/td>\s*<td[^>]*>1x<\/td>\s*<td[^>]*>25 tk<\/td>/);
  assert.match(html, /&lt;unsafe&gt; \(Geral\)/);
  assert.ok(html.indexOf("Menu") < html.indexOf("Show Privado"));
  assert.match(html, /<svg>chart<\/svg>/);
  assert.doesNotMatch(html, /<unsafe>/);
});
