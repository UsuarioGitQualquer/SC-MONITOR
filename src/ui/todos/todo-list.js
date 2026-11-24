import { clean } from "../../utils/helpers.js";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildTodoListView(todos = []) {
  const pendingCount = todos.filter((todo) => !todo?.done).length;
  const doneCount = todos.filter((todo) => Boolean(todo?.done)).length;
  const pendingTokens = todos
    .filter((todo) => !todo?.done)
    .reduce((sum, todo) => sum + (Number(todo?.price) || 0), 0);

  const sortedTodos = [...todos].sort((a, b) =>
    a.done === b.done ? 0 : a.done ? 1 : -1,
  );
  const rowsHtml =
    sortedTodos.length > 0
      ? sortedTodos
          .map((todo) => {
            const badgeHtml = todo.done
              ? `<span style="background: rgba(52,211,153,0.2); color: #86efac; border: 1px solid #34d399; padding: 2px 7px; border-radius: 99px; font-weight: bold; font-size: 10px;">✓ Feito</span>`
              : `<span style="background: rgba(250,204,21,0.18); color: #facc15; border: 1px solid #facc15; padding: 2px 7px; border-radius: 99px; font-weight: bold; font-size: 10px;">Pendente</span>`;
            const textStyle = todo.done
              ? "text-decoration: line-through; color: #86efac;"
              : "color: #fde68a;";
            const rowBackground = todo.done
              ? "rgba(52,211,153,0.08)"
              : "rgba(250,204,21,0.07)";
            const rowAccent = todo.done ? "#34d399" : "#facc15";
            const amountText = todo.price ? `${todo.price} tk` : "—";

            return `<tr class="scm-todo-row" data-id="${escapeAttribute(todo.id)}" style="cursor: pointer;" title="Clique para alternar o status da tarefa">
        <td style="${textStyle} word-break: break-word; background:${rowBackground}; border-left:3px solid ${rowAccent};">${clean(todo.text)}</td>
        <td style="white-space: nowrap; ${textStyle} background:${rowBackground};">${clean(amountText)}</td>
        <td style="white-space: nowrap; background:${rowBackground};">
          ${badgeHtml}
          <button class="scm-todo-del" data-id="${escapeAttribute(todo.id)}" style="background: transparent; border: 0; color: #ff2a6d; cursor: pointer; font-size: 14px; margin-left: 6px; padding: 2px 4px;" title="Remover">✕</button>
        </td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="3" style="text-align:center; color:#8b92b8; padding: 14px;">Nenhuma tarefa pendente no momento.</td></tr>`;

  const html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 6px; flex-wrap: wrap;">
      <div style="font-size: 10.5px; color: #8b92b8;">
        Pendentes:         <strong style="color:#facc15;">${pendingCount}</strong> (${pendingTokens} tk) • Feitas: <strong style="color:#4ade80;">${doneCount}</strong>
      </div>
      <button id="scm-copy-todos-btn" type="button" style="background: linear-gradient(90deg, #00e5ff, #2563eb); border: 0; color: #0f1024; padding: 4px 10px; border-radius: 99px; cursor: pointer; font-size: 10.5px; font-weight: bold;" title="Copiar tarefas pendentes formatadas">📋 Copiar Pendentes</button>
    </div>
    <div class="scroll scm-todo-scroll" style="border:0; border-radius:0 0 8px 8px; margin-top:0; background:rgba(24,26,54,0.72); box-shadow:none;"><table><thead><tr><th>Meta / Descrição</th><th>Preço</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
  `;

  return { html, pendingCount, pendingTokens, doneCount };
}

export function formatPendingTodos(todos = []) {
  return todos
    .filter((todo) => !todo.done)
    .map((todo) =>
      String(todo.text || "")
        .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "")
        .replace(/\s*\[[^\]]+\]\s*$/, "")
        .replace(/\s*\(\s*modelo\s*\)\s*$/i, "")
        .replace(/\(([^@)]+)\)\s*$/, "(@$1)")
        .trim(),
    )
    .join(" -> ");
}
