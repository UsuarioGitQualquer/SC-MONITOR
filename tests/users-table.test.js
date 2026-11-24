import assert from "node:assert/strict";
import test from "node:test";
import { buildUsersTableHtml } from "../src/ui/users/users-table.js";

const today = "2026-11-20";

test("renders the selected new or returning user filter and its empty state", () => {
  const users = {
    today: { name: "Today", firstSeenDate: today },
    legacy: { name: "Legacy", firstSeenDate: "legacy" },
  };

  const newUsers = buildUsersTableHtml(users, "new", today, 1000);
  const returningUsers = buildUsersTableHtml(users, "returning", today, 1000);

  assert.match(newUsers, /Today/);
  assert.doesNotMatch(newUsers, /Legacy/);
  assert.match(returningUsers, /Legacy/);
  assert.doesNotMatch(returningUsers, /Today/);
  assert.match(buildUsersTableHtml({}, "new", today), /Nenhum usuário novo/);
});

test("orders listed users before absent users and ranks each group by tokens", () => {
  const html = buildUsersTableHtml(
    {
      absentHigh: { name: "Absent high", tokens: 100, isListed: false },
      listedLow: { name: "Listed low", tokens: 1, isListed: true },
      listedHigh: { name: "Listed high", tokens: 20, isListed: true },
    },
    "all",
    today,
    1000,
  );

  assert.ok(html.indexOf("Listed high") < html.indexOf("Listed low"));
  assert.ok(html.indexOf("Listed low") < html.indexOf("Absent high"));
});

test("renders visit durations and escapes usernames", () => {
  const html = buildUsersTableHtml(
    {
      user: {
        name: "<img src=x onerror=alert(1)>",
        firstSeenDate: today,
        isListed: true,
        tokens: 7,
        tips: 2,
        messages: 3,
        _currentVisitStart: 1000,
        totalTimeSpent: 30,
        visitCount: 2,
      },
    },
    "all",
    today,
    121000,
  );

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /2m 0s/);
  assert.match(html, /Total: 2m 30s \(2x\)/);
  assert.doesNotMatch(html, /<img src=x/);
});
