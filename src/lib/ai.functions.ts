import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLLM, LLMError } from "./llm";

const MsgIn = z.object({ id: z.number(), speaker: z.string(), text: z.string() });
type MsgIn = z.infer<typeof MsgIn>;

const fmt = (msgs: MsgIn[]) => msgs.map((m) => `[${m.id}] ${m.speaker}: ${m.text}`).join("\n");

const ids = { type: "array", items: { type: "integer" } };
const extractJson = {
  type: "object",
  additionalProperties: false,
  required: ["title", "tags", "tldr", "standard", "detailed", "insights", "actions"],
  properties: {
    title: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    tldr: { type: "string" },
    standard: { type: "string" },
    detailed: { type: "string" },
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "importance", "sources"],
        properties: {
          type: { type: "string", enum: ["key_point", "decision", "risk", "question"] },
          text: { type: "string" },
          importance: { type: "string", enum: ["high", "medium", "low"] },
          sources: ids,
        },
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task", "owner", "due", "priority", "sources"],
        properties: {
          task: { type: "string" },
          owner: { type: "string" },
          due: { type: ["string", "null"] },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          sources: ids,
        },
      },
    },
  },
};
const ExtractZ = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  tldr: z.string(),
  standard: z.string(),
  detailed: z.string(),
  insights: z.array(
    z.object({
      type: z.enum(["key_point", "decision", "risk", "question"]),
      text: z.string(),
      importance: z.enum(["high", "medium", "low"]),
      sources: z.array(z.number()),
    }),
  ),
  actions: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      due: z.string().nullable(),
      priority: z.enum(["high", "medium", "low"]),
      sources: z.array(z.number()),
    }),
  ),
});
type Extract = z.infer<typeof ExtractZ>;
const extractSchema = { name: "conversation_analysis", json: extractJson, zod: ExtractZ };

const verifyJson = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "confidence"],
        properties: { index: { type: "integer" }, confidence: { type: "number" } },
      },
    },
  },
};
const VerifyZ = z.object({ scores: z.array(z.object({ index: z.number(), confidence: z.number() })) });

const LANGUAGE_RULES = `For Hindi or Urdu conversations, including mixed Hindi/Urdu-English and already romanized conversations, write all human-readable output in natural Roman Urdu using Latin letters only, never Urdu script or Devanagari. This applies to titles, tags, summaries, section headings, insights, action tasks, and owner names (transliterate names faithfully). Do not translate these conversations into English. For other languages, use the conversation's language. Keep schema enum values, source message ids, citation markers, dates, and privacy-mask tokens unchanged.`;
const CITE_RULES = `${LANGUAGE_RULES} Cite source message ids inline in summaries using brackets like [3] or [3,8]. Every insight/action must list "sources" with the exact message ids supporting it. Dates as YYYY-MM-DD when inferable, else null. Owner "Unassigned" if unclear. Never invent facts.`;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fail(e: unknown) {
  const err = e instanceof LLMError ? e : new LLMError("AI analysis failed unexpectedly.", 500);
  console.error("AI error", e);
  return { ok: false as const, error: err.message, status: err.status };
}

export const analyzeConversation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ messages: z.array(MsgIn).min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const msgs = data.messages;
      // 1. Chunk + extract per chunk (in parallel)
      const parts = await Promise.all(
        chunk(msgs, 120).map((c) =>
          callLLM(
            `Analyze this conversation segment. ${CITE_RULES}\nSummaries: tldr = 1-2 sentences, standard = 2 short paragraphs, detailed = structured markdown with bold section labels. Audience: executive.\n\nMESSAGES:\n${fmt(c)}`,
            extractSchema,
          ),
        ),
      );
      // 2. Merge
      const first = parts[0];
      if (!first) throw new LLMError("No conversation analysis was returned.", 500);
      let merged: Extract = first;
      if (parts.length > 1) {
        merged = await callLLM(
          `Merge these partial analyses of one conversation into a single deduplicated analysis. Keep source ids. ${CITE_RULES}\n\n${JSON.stringify(parts)}`,
          extractSchema,
        );
      }
      // 3. Verify each claim against its sources
      const valid = new Set(msgs.map((m) => m.id));
      const byId = new Map(msgs.map((m) => [m.id, m]));
      const claims = [
        ...merged.insights.map((i) => ({ text: i.text, sources: i.sources })),
        ...merged.actions.map((a) => ({ text: `${a.task} (owner ${a.owner}, due ${a.due})`, sources: a.sources })),
      ].map((c) => ({ ...c, sources: c.sources.filter((s) => valid.has(s)) }));
      let scores = new Map<number, number>();
      try {
        const v = await callLLM(
          `For each claim, check whether its cited source messages support it. Return confidence 0-1 per claim index (0 = unsupported, 1 = explicit).\n\n${claims
            .map(
              (c, i) =>
                `#${i} CLAIM: ${c.text}\nSOURCES:\n${c.sources.map((s) => `[${s}] ${byId.get(s)?.speaker}: ${byId.get(s)?.text}`).join("\n") || "(none)"}`,
            )
            .join("\n\n")}`,
          { name: "verification", json: verifyJson, zod: VerifyZ },
        );
        scores = new Map(v.scores.map((s) => [s.index, Math.max(0, Math.min(1, s.confidence))]));
      } catch (e) {
        console.error("verify step failed, using defaults", e);
      }
      const conf = (i: number, sources: number[]) => scores.get(i) ?? (sources.length ? 0.7 : 0.3);
      const nI = merged.insights.length;
      return {
        ok: true as const,
        analysis: {
          title: merged.title,
          tags: merged.tags.slice(0, 4).map((t) => t.toLowerCase()),
          summaries: {
            "tldr:executive": merged.tldr,
            "standard:executive": merged.standard,
            "detailed:executive": merged.detailed,
          },
          insights: merged.insights.map((ins, i) => ({
            ...ins,
            sources: claims[i]?.sources ?? [],
            confidence: conf(i, claims[i]?.sources ?? []),
          })),
          actions: merged.actions.map((a, i) => ({
            ...a,
            id: crypto.randomUUID(),
            status: "todo" as const,
            sources: claims[nI + i]?.sources ?? [],
            confidence: conf(nI + i, claims[nI + i]?.sources ?? []),
          })),
        },
      };
    } catch (e) {
      return fail(e);
    }
  });

const SummaryZ = z.object({ summary: z.string() });
const ROLE_HINT = {
  executive: "a busy executive: outcomes, decisions, risks, owners",
  developer: "a software developer: technical scope, deadlines, engineering risks",
  customer: "the customer: plain friendly language, what was resolved and what happens next, no internal jargon",
};
const LEVEL_HINT = {
  tldr: "1-2 sentences",
  standard: "2 short paragraphs",
  detailed: "structured markdown with **bold** section labels and bullet lists",
};

export const summarizeFor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z.array(MsgIn).min(1).max(2000),
        level: z.enum(["tldr", "standard", "detailed"]),
        role: z.enum(["executive", "developer", "customer"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const r = await callLLM(
        `Summarize this conversation for ${ROLE_HINT[data.role]}. ${LANGUAGE_RULES} Length: ${LEVEL_HINT[data.level]}. Cite message ids inline like [3] or [3,8]. Only use facts from the messages.\n\nMESSAGES:\n${fmt(data.messages)}`,
        {
          name: "summary",
          json: { type: "object", additionalProperties: false, required: ["summary"], properties: { summary: { type: "string" } } },
          zod: SummaryZ,
        },
      );
      return { ok: true as const, text: r.summary };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------- Timeline + sentiment ---------------- */
const TsIn = MsgIn.extend({ timestamp: z.string().nullable().optional() });

const timelineJson = {
  type: "object",
  additionalProperties: false,
  required: ["timeline", "sentiment"],
  properties: {
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "startId", "endId", "sources"],
        properties: {
          topic: { type: "string" },
          startId: { type: ["integer", "null"] },
          endId: { type: ["integer", "null"] },
          sources: ids,
        },
      },
    },
    sentiment: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "speakers"],
      properties: {
        overall: { type: "string" },
        speakers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "score"],
            properties: { name: { type: "string" }, score: { type: "number" } },
          },
        },
      },
    },
  },
};
const TimelineZ = z.object({
  timeline: z.array(
    z.object({
      topic: z.string(),
      startId: z.number().nullable(),
      endId: z.number().nullable(),
      sources: z.array(z.number()),
    }),
  ),
  sentiment: z.object({ overall: z.string(), speakers: z.array(z.object({ name: z.string(), score: z.number() })) }),
});

export const extractTimelineSentiment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ messages: z.array(TsIn).min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const msgs = data.messages;
      const r = await callLLM(
        `Build a topic timeline and a sentiment read of this conversation.
Timeline: 3-8 major topics in the order they were discussed, phrased in the conversation's language. startId/endId = the message id where the topic starts/ends (integer or null). sources = the message ids that define the topic.
Sentiment: overall = one sentence describing the tone and how it evolved. speakers = one entry per distinct speaker with score from -1 (negative) to 1 (positive).
${LANGUAGE_RULES}\n\nMESSAGES:\n${fmt(msgs)}`,
        { name: "timeline_sentiment", json: timelineJson, zod: TimelineZ },
      );
      const ts = (id: number | null) => (id == null ? null : msgs.find((m) => m.id === id)?.timestamp ?? null);
      return {
        ok: true as const,
        timeline: r.timeline.map((t) => ({ topic: t.topic, start: ts(t.startId), end: ts(t.endId), sources: t.sources })),
        sentiment: r.sentiment,
      };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------- Ask AI (Q&A with citations) ---------------- */
const AskIn = z.object({
  messages: z.array(MsgIn).min(1).max(2000),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).max(10).optional(),
});

export const askConversation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AskIn.parse(d))
  .handler(async ({ data }) => {
    try {
      const hist = (data.history ?? []).map((h) => `${h.role === "user" ? "Q" : "A"}: ${h.content}`).join("\n");
      const r = await callLLM(
        `You answer questions about the conversation below.
Rules: Answer ONLY from the messages — never invent facts. Cite the supporting message ids inline like [3] or [3,8]. If the answer is not in the conversation, say so plainly. Keep answers short (2-5 sentences) unless a list is genuinely needed.
${LANGUAGE_RULES}
${hist ? `PREVIOUS Q&A IN THIS THREAD:\n${hist}\n\n` : ""}QUESTION: ${data.question}

MESSAGES:
${fmt(data.messages)}`,
        {
          name: "ask",
          json: { type: "object", additionalProperties: false, required: ["answer"], properties: { answer: { type: "string" } } },
          zod: z.object({ answer: z.string() }),
        },
      );
      return { ok: true as const, answer: r.answer };
    } catch (e) {
      return fail(e);
    }
  });
