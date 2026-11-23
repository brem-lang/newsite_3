// Turns an activity_logs entry into display text for the admin history list
// and the system-events bell. Lifecycle entries (written by the api function)
// carry JSON details; older staff entries carry plain text.

function parse(details) {
  if (!details) return {};
  try {
    const v = JSON.parse(details);
    return v && typeof v === "object" ? v : { text: String(details) };
  } catch {
    return { text: String(details) };
  }
}

export function describeEvent(entry, t) {
  const L = t.admin.lifecycle;
  const d = parse(entry.details);
  const label = L.events[entry.action] || entry.action;
  const parts = [];
  if (d.title) parts.push(d.title);
  if (entry.action === "auction.relaunched" && d.to_round) parts.push(`round ${d.from_round} → ${d.to_round}`);
  else if (d.round) parts.push(`round ${d.round}`);
  if (d.trigger && L.triggers[d.trigger]) parts.push(L.triggers[d.trigger]);
  if (entry.action === "auction.ended") {
    parts.push(d.winner_name ? `winner ${d.winner_name}` : "no winner");
  }
  if (d.recovered) parts.push(L.recovered);
  if (d.text) parts.push(d.text);
  const who = entry.source === "system" ? L.bySystem : entry.actor_name || "—";
  return { label, detail: parts.join(" · "), who, recovered: !!d.recovered };
}
