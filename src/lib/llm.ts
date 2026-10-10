// Server-only usage: imported from server function handlers. Reads secrets inside the call.
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";
export const LLM_MODEL = "gemini-3.8-flash";
const GATEWAY_MODEL = "google/gemini-3.8-flash"; // fallback when no GEMINI_API_KEY

// Gemini's responseSchema is an OpenAPI subset: strip unsupported keywords.
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "additionalProperties") continue;
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return node;
}

/** Direct Gemini call (free tier) with strict JSON output. */
async function callGemini<T>(prompt: string, schema: LLMSchema<T>, system: string, key: string): Promise<T> {
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(schema.json),
      },
    }),
  });
  if (!res.ok) {
    let msg = `AI request failed (${res.status}).`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 429) msg = "The AI is busy right now (rate limited). Please try again in a moment.";
    if (res.status === 400 && /API key/i.test(msg)) msg = "The Gemini API key is invalid. Please update GEMINI_API_KEY.";
    throw new LLMError(msg, res.status);
  }
  const j = await res.json();
  const content: string = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!content) throw new LLMError("The AI returned an empty response. Please retry.", 502);
  return validate(content, schema);
}

function validate<T>(content: string, schema: LLMSchema<T>): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LLMError("The AI returned an unreadable response. Please retry.", 502);
  }
  const result = schema.zod.safeParse(parsed);
  if (!result.success) throw new LLMError("The AI response didn't match the expected format.", 502);
  return result.data;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface LLMSchema<T> {
  name: string;
  json: Record<string, unknown>; // strict JSON schema sent to the model
  zod: z.ZodType<T>; // validated before returning
}

/**
 * Single provider-agnostic entry point for all model calls.
 * Swap the provider here without touching any feature code.
 */
export async function callLLM<T>(prompt: string, schema: LLMSchema<T>, system?: string): Promise<T> {
  const sys =
    system ??
    "You are a precise conversation analyst. Only use facts present in the provided messages. Respond with JSON only.";

  // Prefer the free direct Gemini key; fall back to the Lovable gateway.
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) return callGemini(prompt, schema, sys, geminiKey);

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new LLMError("AI is not configured for this app.", 500);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      stream: true,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schema.name, strict: true, schema: schema.json },
      },
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `AI request failed (${res.status}).`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 429) msg = "The AI is busy right now (rate limited). Please try again in a moment.";
    if (res.status === 402) msg = "AI credits are used up for this workspace. Add credits to keep analyzing.";
    throw new LLMError(msg, res.status);
  }

  // Consume the SSE stream server-side and accumulate content.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        content += j.choices?.[0]?.delta?.content ?? "";
      } catch {
        /* partial line */
      }
    }
  }

  return validate(content, schema);
}
