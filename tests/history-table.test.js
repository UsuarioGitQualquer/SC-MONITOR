import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHistoryTableHtml,
  formatStorageBytes,
} from "../src/ui/history/history-table.js";

test("renders an empty-state row when history has no entries", () => {
  assert.match(buildHistoryTableHtml(), /Nenhuma sala salva no histórico/);
});

test("sorts history by date and escapes room values and action keys", () => {
  const html = buildHistoryTableHtml({
    'model"><script>': {
      dateKey: "2026-11-18",
      modelId: "older",
      modelName: "<img src=x onerror=alert(1)>",
      peakViewers: 4,
      avgViewers: 2,
      totalTokens: 10,
    },
    "newer::2026-11-19": {
      dateKey: "2026-11-19",
      modelId: "newer",
      modelName: "Newer",
      peakViewers: 8,
      avgViewers: 5,
      totalTokens: 30,
      livesCount: 1,
      firstLiveStart: "10:00",
      lastLiveEnd: "11:00",
    },
  });

  assert.ok(html.indexOf("Newer") < html.indexOf("&lt;img"));
  assert.match(html, /data-key="model&quot;&gt;&lt;script&gt;"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /1 live\(s\) • 10:00 - 11:00/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>/);
});

test("formats storage sizes and renders the recorded size per model", () => {
  assert.equal(formatStorageBytes(512), "512 B");
  assert.equal(formatStorageBytes(1536), "1.5 KiB");
  assert.equal(formatStorageBytes(2 * 1024 * 1024), "2.00 MiB");

  const html = buildHistoryTableHtml({
    "model-a::2026-11-20": {
      dateKey: "2026-11-20",
      modelId: "model-a",
      modelName: "Modelo A",
    },
  }, {
    "model-a": 2 * 1024 * 1024,
  });

  assert.match(html, /Dados gravados: 2\.00 MiB/);
});
