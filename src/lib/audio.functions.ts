import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLLM, LLMError } from "./llm";

// Free transcription via Groq Whisper (OpenAI-compatible endpoint).
const TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const TRANSCRIBE_MODEL = "whisper-large-v3";
const MAX_BYTES = 25 * 1024 * 1024;

const TurnsZ = z.object({ turns: z.array(z.object({ speaker: z.string(), text: z.string() })) });
const turnsJson = {
  type: "object",
  additionalProperties: false,
  required: ["turns"],
  properties: {
    turns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speaker", "text"],
        properties: { speaker: { type: "string" }, text: { type: "string" } },
      },
    },
  },
};

async function transcribe(file: File, key: string): Promise<string> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", file, file.name);
  form.append("response_format", "json");
  const res = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("transcription failed", res.status, body);
    if (res.status === 429) throw new LLMError("Transcription is busy right now. Please try again in a moment.", 429);
    if (res.status === 401) throw new LLMError("The transcription key is invalid. Please update GROQ_API_KEY.", 401);
    let msg = "We couldn't transcribe this audio file.";
    try {
      msg = JSON.parse(body)?.error?.message ?? msg;
    } catch {
      /* keep default */
    }
    throw new LLMError(msg, res.status);
  }
  try {
    return String(JSON.parse(body)?.text ?? "").trim();
  } catch {
    return "";
  }
}

/** Upload audio -> transcript -> speaker turns, returned as "Speaker: text" lines. */
export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("No audio file provided");
    return { file };
  })
  .handler(async ({ data }) => {
    try {
      const { file } = data;
      if (!file.size) throw new LLMError("The audio file is empty.", 400);
      if (file.size > MAX_BYTES) throw new LLMError("Audio file is too large (max 25 MB).", 400);
      const key = process.env["GROQ_API_KEY"];
      if (!key) throw new LLMError("Transcription is not configured (missing GROQ_API_KEY).", 500);

      const transcript = await transcribe(file, key);
      if (!transcript) throw new LLMError("No speech was detected in this recording.", 422);

      let lines: string;
      try {
        const r = await callLLM(
          `This is a raw transcript of an audio recording with no speaker labels. Split it into speaker turns in order. Infer distinct speakers from context (names mentioned, question/answer flow, changes of voice). Use real names when they are said, otherwise "Speaker 1", "Speaker 2". Keep the wording as close to the original as possible; do not summarize or drop content.\n\nLANGUAGE RULE: If the speech is Urdu or Hindi (or mixed Urdu/Hindi-English), write every turn in natural Roman Urdu using Latin letters only — never Urdu script or Devanagari, and do not translate to English. Other languages stay in their original script.\n\nTRANSCRIPT:\n${transcript}`,
          { name: "speaker_turns", json: turnsJson, zod: TurnsZ },
        );
        lines = r.turns
          .filter((t) => t.text.trim())
          .map((t) => `${t.speaker.replace(/:/g, "").trim() || "Speaker"}: ${t.text.replace(/\n+/g, " ").trim()}`)
          .join("\n");
      } catch (e) {
        console.error("speaker split failed, using sentences", e);
        lines = (transcript.match(/[^.!?]+[.!?]*/g) ?? [transcript]).map((s) => `Speaker: ${s.trim()}`).join("\n");
      }
      return { ok: true as const, text: lines };
    } catch (e) {
      const err = e instanceof LLMError ? e : new LLMError("Audio processing failed unexpectedly.", 500);
      console.error("audio error", e);
      return { ok: false as const, error: err.message };
    }
  });
