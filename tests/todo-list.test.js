import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTodoListView,
  formatPendingTodos,
} from "../src/ui/todos/todo-list.js";

test("summarizes tasks and renders pending tasks before completed tasks", () => {
  const view = buildTodoListView([
    { id: "done", text: "Completed", price: 99, done: true },
    { id: "pending-1", text: "First pending", price: 10, done: false },
    { id: "pending-2", text: "Second pending", price: 5 },
  ]);

  assert.equal(view.pendingCount, 2);
  assert.equal(view.pendingTokens, 15);
  assert.equal(view.doneCount, 1);
  assert.ok(view.html.indexOf("First pending") < view.html.indexOf("Completed"));
  assert.match(view.html, /Pendentes:\s*<strong[^>]*>2<\/strong> \(15 tk\) • Feitas:/);
});

test("renders an empty state and escapes task content and identifiers", () => {
  const emptyView = buildTodoListView([]);
  const view = buildTodoListView([
    {
      id: '"<script>',
      text: "<img src=x onerror=alert(1)>",
      price: 1,
      done: false,
    },
  ]);

  assert.match(emptyView.html, /Nenhuma tarefa pendente/);
  assert.match(view.html, /data-id="&quot;&lt;script&gt;"/);
  assert.match(view.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(view.html, /<img src=x/);
});

test("formats pending task text without timestamps or source labels", () => {
  const text = formatPendingTodos([
    { text: "[10:20:30] Dance (User One) [Menu]", done: false },
    { text: "Kiss (User Two) (modelo)", done: false },
    { text: "Completed", done: true },
  ]);

  assert.equal(text, "Dance (@User One) -> Kiss (@User Two)");
});
