import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAudienceLeagueChart,
  buildCombinedAudienceEarningsChart,
  buildInteractiveBarsSvg,
  buildNeonDonutGauge,
  buildNeonWaveAreaChart,
  buildTimeStepSelectorHtml,
} from "../src/ui/dashboard/basic-charts.js";

test("renders selectable time blocks with the active value and adaptive interval", () => {
  const html = buildTimeStepSelectorHtml({
    className: "session-flow-step",
    selectedStep: 10,
    autoStep: 5,
    label: "Intervalo do fluxo",
  });

  assert.match(html, /data-step="auto"[^>]*>Auto \(5m\)/);
  assert.match(html, /class="session-flow-step" data-step="10" aria-pressed="true"/);
  assert.match(html, /data-step="60"[^>]*>1h/);
  assert.match(html, /Intervalo do fluxo/);
});

test("renders a bounded donut gauge and escapes its labels", () => {
  const html = buildNeonDonutGauge({
    label: "<tokens>",
    sublabel: "hoje & ontem",
    percent: 120,
  });

  assert.match(html, /100%\s*<\/div>/);
  assert.match(html, /&lt;tokens&gt;/);
  assert.match(html, /hoje &amp; ontem/);
});

test("renders an empty-state wave chart with escaped text", () => {
  const html = buildNeonWaveAreaChart({
    title: "<audiência>",
    subtitle: "sem dados & sem amostras",
  });

  assert.match(html, /&lt;audiência&gt;/);
  assert.match(html, /sem dados &amp; sem amostras/);
  assert.match(html, /Aguardando dados para traçar curva/);
});

test("renders wave chart points and escapes labels and tooltip content", () => {
  const html = buildNeonWaveAreaChart({
    title: "Audiência",
    subtitle: "sessão",
    points: [
      { label: "<início>", value: 2, tooltip: "<script>alert(1)</script>" },
      { label: "Fim", value: 8 },
    ],
  });

  assert.match(html, /viewBox="0 0 360 115"/);
  assert.match(html, /&lt;início&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("renders combined audience and earnings with event markers", () => {
  const html = buildCombinedAudienceEarningsChart({
    title: "Público e ganhos",
    subtitle: "20/11/2026",
    audiencePoints: [
      { label: "09:00", value: 12, tooltip: "<público>" },
      { label: "09:10", value: 25 },
    ],
    earningsBars: [
      { label: "09h", value: 40, tooltip: "Ganhos da hora" },
      { label: "10h", value: 15 },
    ],
    eventMarkers: [
      { label: "09:10", type: "Show", tooltip: "Show: privado" },
    ],
  });

  assert.match(html, /Público médio/);
  assert.match(html, /Ganhos por intervalo/);
  assert.match(html, /Shows/);
  assert.match(html, /Show: privado/);
  assert.match(html, /&lt;público&gt;/);
  assert.match(html, /viewBox="0 0 720 150"/);
  assert.doesNotMatch(html, /<rect x="[^"]+" y="24" width="2"/);
});

test("uses a green fill beneath the combined audience curve", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [
      { label: "12:00", value: 10 },
      { label: "12:01", value: 12 },
    ],
  });

  assert.match(html, /stop-color="#22c55e" stop-opacity="0\.24"/);
  assert.match(html, /stop-color="#059669" stop-opacity="0\.02"/);
  assert.match(html, /stroke="#ff86ad"/);
});

test("uses a vibrant light purple for private show spans", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [{ label: "12:00", value: 10 }],
    eventMarkers: [
      {
        label: "12:00",
        type: "Início do show",
        showType: "private",
        showBoundary: "start",
        tooltip: "Início do show privado",
      },
      {
        label: "12:30",
        type: "Fim do show",
        showType: "private",
        showBoundary: "end",
        tooltip: "Fim do show privado",
      },
    ],
  });

  assert.match(html, /fill="#c084fc" fill-opacity="0\.14"/);
  assert.match(html, />Privado<\/text>/);
});

test("marks the start and end of a show separately from later events", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [{ label: "12:00", value: 10 }],
    eventMarkers: [
      {
        label: "12:00",
        type: "Início do show",
        showType: "group",
        showBoundary: "start",
        tooltip: "Início do show em grupo",
      },
      {
        label: "12:30",
        type: "Fim do show",
        showType: "group",
        showBoundary: "end",
        tooltip: "Fim do show em grupo",
      },
      { label: "13:00", type: "Ticket", tooltip: "Ticket comprado após o show" },
    ],
  });

  assert.match(html, /Início do show em grupo/);
  assert.match(html, /Fim do show em grupo/);
  assert.match(html, /Ticket comprado após o show/);
  assert.match(html, /fill="#f59e0b" fill-opacity="0\.14"/);
  assert.match(html, />Grupo<\/text>/);
  assert.equal((html.match(/stroke-dasharray="3,4"/g) || []).length, 1);
});

test("limits generic event markers to the first and last events", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [
      { label: "14:40", value: 10 },
      { label: "14:50", value: 20 },
      { label: "15:06", value: 12 },
    ],
    eventMarkers: [
      { label: "14:40", type: "Meta" },
      { label: "14:42", type: "Meta" },
      { label: "14:50", type: "Meta" },
      { label: "15:00", type: "Show" },
      { label: "15:06", type: "Show" },
    ],
  });

  const boundaryLines = html.match(/stroke-dasharray="3,4"/g) || [];
  assert.equal(boundaryLines.length, 2);
  assert.match(html, /stroke-dasharray="3,4"/);
});

test("renders a ticket show interval with only start and end markers", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [
      { label: "14:40", value: 10 },
      { label: "14:50", value: 20 },
      { label: "15:06", value: 12 },
    ],
    eventMarkers: [
      {
        label: "14:42",
        type: "Início do show",
        showType: "ticket",
        showBoundary: "start",
        tooltip: "Início do Ticket show",
      },
      {
        label: "15:00",
        type: "Fim do show",
        showType: "ticket",
        showBoundary: "end",
        tooltip: "Fim do Ticket show",
      },
    ],
  });

  assert.match(html, />Ticket show<\/text>/);
  assert.match(html, /Início do Ticket show/);
  assert.match(html, /Fim do Ticket show/);
  assert.equal((html.match(/stroke="#22d3ee" stroke-width="1\.5"/g) || []).length, 2);
});

test("extends an active ticket show to the last chart interval", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [
      { label: "14:40", value: 10 },
      { label: "14:50", value: 20 },
      { label: "15:06", value: 12 },
    ],
    eventMarkers: [{
      label: "14:42",
      type: "Início do show",
      showType: "ticket",
      showBoundary: "start",
      tooltip: "Início do Ticket show",
    }],
  });

  assert.match(html, />Ticket show<\/text>/);
  assert.match(html, /Ticket show em andamento/);
  assert.match(
    html,
    /x1="712\.0" y1="24" x2="712\.0" y2="126" stroke="#22d3ee" stroke-width="1\.5" stroke-dasharray="3,3"/,
  );
});

test("continues the last known audience across missing earnings-only blocks", () => {
  const html = buildCombinedAudienceEarningsChart({
    audiencePoints: [{ label: "12:00", value: 411 }],
    earningsBars: [
      { label: "12:01", value: 10 },
      { label: "12:02", value: 20 },
    ],
    eventMarkers: [
      { label: "12:01", type: "Show" },
      { label: "12:02", type: "Show" },
    ],
  });

  assert.match(html, /411 espectadores/);
  assert.match(html, /<path d="M 28\.0.* L /);
  assert.doesNotMatch(html, /0 espectadores/);
});

test("renders audience league data and safely escapes chart labels", () => {
  const emptyHtml = buildAudienceLeagueChart([], 12);
  assert.match(emptyHtml, /Aguardando dados da transmissão/);
  assert.match(emptyHtml, /Pico de espectadores: 12/);
  assert.match(emptyHtml, /Média por bloco de 2 min/);

  const html = buildAudienceLeagueChart(
    [{
      label: "<bloco>",
      viewers: 8,
      leagues: { grey: 3, bronze: 2 },
      leagueSamples: 1,
    }],
    12,
    "Auto • Média por bloco de 1 min • sessão atual",
  );
  assert.match(html, /&lt;bloco&gt;/);
  assert.match(html, /5 listados/);
  assert.match(html, /Auto • Média por bloco de 1 min • sessão atual/);
  assert.doesNotMatch(html, /<bloco>/);
});

test("renders interactive bars with cumulative values and escapes labels", () => {
  const html = buildInteractiveBarsSvg({
    title: "Tokens",
    subtitle: "Hoje",
    bars: [
      { label: "<agora>", value: 4, tooltip: "<pedido>" },
      { label: "<depois>", value: 3 },
    ],
  });

  assert.match(html, /&lt;agora&gt;/);
  assert.match(html, /&lt;pedido&gt; \| Acumulado: 4 tk/);
  assert.match(html, /&lt;depois&gt;/);
  assert.doesNotMatch(html, /<pedido>/);
});

test("labels sparse bars and can omit cumulative totals for maximum-value charts", () => {
  const html = buildInteractiveBarsSvg({
    title: "Maior gorjeta",
    subtitle: "Por dia",
    showCumulative: false,
    bars: [{ label: "20/11", value: 718, tooltip: "Maior gorjeta de 718 tk" }],
  });

  assert.match(html, />718<\/text>/);
  assert.match(html, /Maior gorjeta de 718 tk<\/title>/);
  assert.match(html, /<rect x="132\.0" y="23" width="96\.0" height="79" rx="4" fill="#252d45"/);
  assert.doesNotMatch(html, /Acumulado:/);
});

test("supports distinct color themes for bar charts", () => {
  const html = buildInteractiveBarsSvg({
    title: "Usuários",
    bars: [{ label: "14h", value: 8 }],
    showCumulative: false,
    variant: "mint",
  });

  assert.match(html, /stop-color="#2dd4bf"/);
  assert.match(html, /stop-color="#0ea5e9"/);
  assert.match(html, /fill="#1d3540"/);
  assert.match(html, /color:#5eead4/);
});

test("supports duration labels and custom units in interactive bar charts", () => {
  const html = buildInteractiveBarsSvg({
    title: "Duração das lives",
    bars: [{
      label: "Live 1",
      value: 90,
      displayValue: "01:30:00",
      tooltip: "Live 1 · duração 01:30:00",
    }],
    showCumulative: false,
    unitLabel: "min",
  });

  assert.match(html, />01:30:00<\/text>/);
  assert.match(html, /duração 01:30:00<\/title>/);
  assert.doesNotMatch(html, /tk<\/title>/);
});
