import assert from "node:assert/strict";
import test from "node:test";
import { localizeText } from "../src/utils/i18n.js";

test("translates shared interface labels to Spanish and English", () => {
  assert.equal(localizeText("Atualizar", "es"), "Actualizar");
  assert.equal(localizeText("Atualizar", "en"), "Refresh");
  assert.equal(localizeText("↗ Página de relatório", "es"), "↗ Página del informe");
  assert.equal(localizeText("↗ Página de relatório", "en"), "↗ Report page");
  assert.equal(localizeText("📊 Geral", "es"), "📊 General");
  assert.equal(localizeText("👥 Usuários", "es"), "👥 Usuarios");
  assert.equal(localizeText("💰 Eventos", "en"), "💰 Events");
  assert.equal(localizeText("🛡️ Moderação", "en"), "🛡️ Moderation");
  assert.equal(localizeText("🗂️ Histórico", "en"), "🗂️ History");
  assert.equal(localizeText("📑 Relatório", "en"), "📑 Report");
  assert.equal(localizeText("Uso do armazenamento local", "es"), "Uso del almacenamiento local");
  assert.equal(
    localizeText("Uso estimado do armazenamento do navegador (usado / quota):", "es"),
    "Uso estimado del almacenamiento del navegador (usado / cuota):",
  );
  assert.equal(
    localizeText(
      "Tamanho JSON estimado dos dados do(a) modelo selecionado:",
      "en",
    ),
    "Estimated JSON size of the selected model data:",
  );
  assert.equal(localizeText("Gorjeta Avulsa", "es"), "Propina individual");
  assert.equal(localizeText("Gorjeta avulsa", "en"), "One-off tip");
  assert.equal(localizeText("Data para apagar", "es"), "Fecha que se borrará");
  assert.equal(localizeText("Data para apagar", "en"), "Date to delete");
  assert.equal(localizeText("Selecione uma data", "en"), "Select a date");
  assert.equal(localizeText("Shows realizados no dia", "en"), "Shows on this day");
  assert.equal(localizeText("Início:", "en"), "Start:");
  assert.equal(localizeText("Fim:", "es"), "Fin:");
  assert.equal(
    localizeText("Detalhamento dos Shows Privados", "en"),
    "Private shows details",
  );
  assert.equal(localizeText("Live", "es"), "Live");
  assert.equal(localizeText("Pico nesta live", "es"), "Pico de esta live");
  assert.equal(localizeText("Tempo Bruto (Live)", "en"), "Gross time (live)");
  assert.equal(localizeText("Tempo Líquido (Live)", "es"), "Tiempo neto (live)");
  assert.equal(
    localizeText("Tokens na live (gorjetas + shows estimados)", "en"),
    "Tokens in the live (tips + estimated shows)",
  );
  assert.equal(localizeText("Limpar live", "en"), "Clear live");
  assert.equal(localizeText("🎬 Live", "es"), "🎬 En vivo");
  assert.equal(localizeText("Shows registrados nesta live", "en"), "Shows recorded during this live");
  assert.equal(localizeText("Ganho estimado:", "es"), "Ganancia estimada:");
  assert.equal(localizeText("Ingressos vendidos:", "en"), "Tickets sold:");
  assert.equal(localizeText("Preço por ingresso:", "en"), "Price per ticket:");
  assert.equal(localizeText("Ver participantes", "en"), "View participants");
  assert.equal(localizeText("Entradas no show:", "en"), "Times entered:");
  assert.equal(
    localizeText("Nenhum participante registrado", "es"),
    "No hay participantes registrados",
  );
  assert.equal(localizeText("Não registrado", "es"), "No registrado");
  assert.equal(localizeText("Ticket show", "es"), "Show con ticket");
  assert.equal(localizeText("Ticket", "es"), "Entrada");
  assert.equal(localizeText("Ingresso Ticket", "en"), "Ticket");
  assert.equal(localizeText("Show em Grupo", "es"), "Show grupal");
  assert.equal(localizeText("Show Privado", "en"), "Private show");
  assert.equal(localizeText("Qtd", "es"), "Cant.");
  assert.equal(localizeText("Qtd", "en"), "Qty");
  assert.equal(
    localizeText("Distribuição de Ligas (Pico / Média)", "en"),
    "League distribution (peak / average)",
  );
  assert.equal(localizeText("Custom user content", "es"), "Custom user content");
});

test("keeps Portuguese as the default and preserves unknown text", () => {
  assert.equal(localizeText("Atualizar", "pt-BR"), "Atualizar");
  assert.equal(localizeText("Custom user content"), "Custom user content");
});
