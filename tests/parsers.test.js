import assert from "node:assert/strict";
import test from "node:test";
import {
  getGroupShowKind,
  getGroupShowStatus,
  hasActiveTicketShowTimer,
  isRoomOffline,
  parseRoomKingTokens,
  parseShowParticipantsCount,
  parseUsersWithTokensCount,
} from "../src/modules/parsers.js";

test("parses the king's tip total from hover text in supported languages", () => {
  assert.equal(parseRoomKingTokens("TestModel deu 1.265 tk de gorjeta"), 1265);
  assert.equal(parseRoomKingTokens("TestModel gave 1,265 tokens"), 1265);
  assert.equal(parseRoomKingTokens("TestModel donó 1,265 tk"), 1265);
  assert.equal(parseRoomKingTokens("Sem total de gorjetas"), 0);
});

test("parses users-with-tokens counts in Portuguese, Spanish, and English", () => {
  assert.equal(parseUsersWithTokensCount("Usuários com tokens: 34"), 34);
  assert.equal(parseUsersWithTokensCount("Utilizadores com tokens: 35"), 35);
  assert.equal(parseUsersWithTokensCount("Usuarios con tokens: 39"), 39);
  assert.equal(parseUsersWithTokensCount("Users with tokens: 40"), 40);
});

test("parses grouped counts and ignores unrelated labels", () => {
  assert.equal(parseUsersWithTokensCount("Users with tokens: 1,661"), 1661);
  assert.equal(parseUsersWithTokensCount("Utilizadores com tokens: 1.661"), 1661);
  assert.equal(parseUsersWithTokensCount("Otros: 349"), null);
});

test("classifies group and ticket shows from language-independent icons", () => {
  assert.equal(getGroupShowKind("Show em Grupo", "#icons-group-ds"), "group");
  assert.equal(getGroupShowKind("show grupal", "#icons-group-ds"), "group");
  assert.equal(getGroupShowKind("Group show", "#icons-group-ds"), "group");
  assert.equal(getGroupShowKind("show em grupo", "#icons-ticket-ds"), "ticket");
  assert.equal(getGroupShowKind("show grupal", "#icons-ticket-ds"), "ticket");
  assert.equal(getGroupShowKind("Group show", "#icons-ticket-ds"), "ticket");
});

test("classifies ticket and group show text in Portuguese, Spanish, and English", () => {
  assert.equal(getGroupShowKind("Show de Ticket · Obter bilhete"), "ticket");
  assert.equal(getGroupShowKind("Ticket show · Obtener ticket"), "ticket");
  assert.equal(getGroupShowKind("Ticket show · Get ticket"), "ticket");
  assert.equal(getGroupShowKind("Show de entradas"), "ticket");
  assert.equal(
    getGroupShowKind("convidou você para o show · Assistir por 12 tk/min", "#icons-group-ds"),
    "group",
  );
  assert.equal(getGroupShowKind("convida-o(a) para Show em Grupo", "#icons-group-ds"), "group");
  assert.equal(getGroupShowKind("convida para Show em Grupo"), "group");
  assert.equal(getGroupShowKind("te invita a un show grupal"), "group");
  assert.equal(getGroupShowKind("invites you to Group show"), "group");
  assert.equal(getGroupShowKind("Descrição sem indicação"), "unknown");
});

test("parses show participant counts in Portuguese, Spanish, and English", () => {
  assert.equal(parseShowParticipantsCount("23 pessoas já estão a assistir"), 23);
  assert.equal(parseShowParticipantsCount("23 pessoas assistindo"), 23);
  assert.equal(parseShowParticipantsCount("3 personas viéndolo actualmente"), 3);
  assert.equal(parseShowParticipantsCount("5 people already watching"), 5);
  assert.equal(parseShowParticipantsCount("14 people already watching"), 14);
  assert.equal(parseShowParticipantsCount("1 person watching"), 1);
  assert.equal(parseShowParticipantsCount("Descrição sem contagem"), null);
});

test("does not treat a group-show invitation as an active show without participants", () => {
  assert.deepEqual(
    getGroupShowStatus("Julietasantos invites you to Group show Watch for 16 tk/min"),
    { isActive: false, participantCount: 0 },
  );
  assert.deepEqual(
    getGroupShowStatus("1 person watching · Watch for 16 tk/min"),
    { isActive: true, participantCount: 1 },
  );
});

test("detects an active ticket show from its on-screen elapsed timer, not viewers", () => {
  const timer = { className: "ElapsedShowTime ViewCamGroup__timer" };
  assert.equal(
    hasActiveTicketShowTimer({
      querySelector: (selector) =>
        selector.includes("ElapsedShowTime") || selector.includes("ViewCamGroup__timer")
          ? timer
          : null,
    }),
    true,
  );
  assert.equal(
    hasActiveTicketShowTimer({
      querySelector: () => null,
      innerText: "Ticket show · 18 people already watching",
    }),
    false,
  );
  assert.equal(hasActiveTicketShowTimer(null), false);
});

test("detects offline status labels shown by the room overlay", () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    globalThis.document = {
      querySelector: () => null,
      querySelectorAll: () => [{
        innerText: "OFF-LINE Estava on-line há 8 minutos",
      }],
    };
    assert.equal(isRoomOffline(), true);

    globalThis.document.querySelectorAll = () => [{
      innerText: "Status da sala: OFF‑LINE Estava on-line há 13 minutos",
    }];
    assert.equal(isRoomOffline(), true);

    for (const label of [
      "Offline — Esteve online há 31 minutos",
      "Fuera de línea — Estuvo en línea hace 31 minutos",
      "Fora de linha — Esteve online há 30 minutos",
    ]) {
      globalThis.document.querySelectorAll = () => [{ innerText: label }];
      assert.equal(isRoomOffline(), true, `Expected offline label to match: ${label}`);
    }

    globalThis.document.querySelectorAll = () => [{ innerText: "Aguarde" }];
    assert.equal(isRoomOffline(), false);

    globalThis.document.querySelectorAll = () => [{
      className: "offline-status-time",
      innerText: "Estava on-line há 2 minutos",
    }];
    assert.equal(isRoomOffline(), false);

    globalThis.document.querySelectorAll = () => [{
      className: "ViewCamShutterWrapper__statusOffline",
    }];
    assert.equal(isRoomOffline(), true);

    globalThis.document.querySelector = (selector) =>
      selector.includes(".vc-status-offline") ? {} : null;
    assert.equal(isRoomOffline(), true);
  } finally {
    if (previousDocument) {
      Object.defineProperty(globalThis, "document", previousDocument);
    } else {
      delete globalThis.document;
    }
  }
});

