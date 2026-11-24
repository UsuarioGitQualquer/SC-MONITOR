export const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

export const num = (s) => {
  const m = String(s ?? "")
    .replace(/[.,]/g, "")
    .match(/\d+/);
  return m ? Number(m[0]) : null;
};

export const clean = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const time = () =>
  new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });