import type { Conversation } from "./types";

const strip = (s: string) => s.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, ids) => `(msg ${ids})`);

export function toMarkdown(c: Conversation) {
  const a = c.analysis;
  if (!a) return `# ${c.title}`;
  const summary = a.summaries["standard:executive"] ?? a.summaries["tldr:executive"] ?? "";
  return [
    `# ${a.title}`,
    `_${new Date(c.createdAt).toLocaleDateString()} · ${a.tags.join(", ")}_`,
    `## Summary`,
    strip(summary),
    `## Key points`,
    ...a.insights.map((i) => `- **${i.type.replace("_", " ")}** (${i.importance}): ${i.text} (msg ${i.sources.join(", ")})`),
    `## Action items`,
    `| Task | Owner | Due | Priority | Status |`,
    `|---|---|---|---|---|`,
    ...a.actions.map((x) => `| ${x.task} | ${x.owner} | ${x.due ?? "—"} | ${x.priority} | ${x.status.replace("_", " ")} |`),
  ].join("\n\n");
}

export function toEmail(c: Conversation) {
  const a = c.analysis;
  if (!a) return "";
  const summary = (a.summaries["tldr:executive"] ?? "").replace(/\s*\[[\d,\s]+\]/g, "");
  return [
    `Subject: Recap — ${a.title}`,
    ``,
    `Hi all,`,
    ``,
    `Quick recap: ${summary}`,
    ``,
    `Decisions:`,
    ...a.insights.filter((i) => i.type === "decision").map((i) => `• ${i.text}`),
    ``,
    `Action items:`,
    ...a.actions.map((x) => `• ${x.task} — ${x.owner}${x.due ? ` (due ${x.due})` : ""}`),
    ``,
    `Thanks!`,
  ].join("\n");
}
