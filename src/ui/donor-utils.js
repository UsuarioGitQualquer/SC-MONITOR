export function aggregateDonorEvents(events = []) {
  const donors = new Map();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const name = String(event?.user || "").trim();
    const tokens = Number(event?.price ?? event?.tokens) || 0;
    if (!name || name === "—" || tokens <= 0) return;

    const key = name.toLowerCase();
    const donor = donors.get(key) || { name, tokens: 0, tips: 0 };
    donor.tokens += tokens;
    donor.tips += 1;
    donors.set(key, donor);
  });
  return Array.from(donors.values()).sort((a, b) => b.tokens - a.tokens);
}
