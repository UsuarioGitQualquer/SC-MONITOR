import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModerationLogRows,
  buildModerationTagsHtml,
  buildMutedUserRows,
  buildSuspectBotRows,
} from "../src/ui/moderation/moderation-view.js";

test("renders muted user details with at most two recent messages", () => {
  const html = buildMutedUserRows([
    {
      username: "<user>",
      mutedBy: "Moderator",
      time: "09:00",
      recentMessages: ["first", "second", "third"],
    },
  ]);

  assert.match(html, /&lt;user&gt;/);
  assert.match(html, /"first"/);
  assert.match(html, /"second"/);
  assert.doesNotMatch(html, /third/);
  assert.match(buildMutedUserRows([]), /Nenhum usuário silenciado/);
});

test("renders moderation logs newest-first with the original removal indexes", () => {
  const html = buildModerationLogRows([
    { user: "older", message: "old", status: "FALHA" },
    { user: "newer", message: "<unsafe>", status: "PENDENTE" },
  ]);

  assert.ok(html.indexOf("newer") < html.indexOf("older"));
  assert.match(html, /data-index="1"/);
  assert.match(html, /data-index="0"/);
  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /color: #ff7b00/);
  assert.match(buildModerationLogRows([]), /Nenhuma mensagem moderada/);
});

test("escapes moderation keywords and suspect usernames", () => {
  const tags = buildModerationTagsHtml(["<spam>"]);
  const suspects = buildSuspectBotRows([
    {
      username: '"><script>',
      suspicionLevel: "Crítico",
      league: "Cinza",
      timeInRoomMinutes: 25,
      messages: 0,
      tokens: 0,
      consecutiveDays: 2,
    },
  ]);

  assert.match(tags, /&lt;spam&gt;/);
  assert.match(suspects, /data-username="&quot;&gt;&lt;script&gt;"/);
  assert.match(suspects, /color: #ff2a6d/);
  assert.match(suspects, /2 dias seguidos/);
  assert.doesNotMatch(suspects, /<script>/);
  assert.match(buildModerationTagsHtml([]), /Nenhuma palavra\/frase proibida/);
  assert.match(buildSuspectBotRows([]), /Nenhum espectador suspeito/);
});
