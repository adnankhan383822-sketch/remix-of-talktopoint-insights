# TalktoPoint — Setup & Architecture Guide

Everything you need to run, understand, and extend this project: local setup, how the AI integration works, where data lives, and how the pieces fit together.

---

## 1. Quick start (local development)

### Requirements

- Node.js 20+ (or Bun)
- npm / bun / pnpm

### Steps

```sh
git clone <your-repo-url>
cd <project-folder>
npm install        # or: bun install
npm run dev        # or: bun dev
```

The app starts on `http://localhost:5173` (Vite default).

### Useful scripts

| Command           | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the dev server with hot reload |
| `npm run build`   | Production build                    |
| `npm run preview` | Serve the production build locally  |
| `npm run test`    | Run the test suite (Vitest)         |
| `npm run lint`    | Lint with ESLint                    |

### Environment variables

| Variable          | Where it's read | Purpose                                             |
| ----------------- | --------------- | --------------------------------------------------- |
| `LOVABLE_API_KEY` | Server only     | Authenticates all AI calls through the AI gateway.  |

When running inside Lovable, this key is injected automatically — you never see or handle it. For local development outside Lovable, create a `.env` file (never commit it):

```sh
LOVABLE_API_KEY=your_key_here
```

The key is read **inside server handlers only** (`process.env["LOVABLE_API_KEY"]`), never at module scope and never in browser code. There is no other secret in the project.

---

## 2. Tech stack

- **Framework:** TanStack Start v1 (React 19, SSR, server functions) on Vite 7
- **Styling:** Tailwind CSS v4 (theme tokens in `src/styles.css`) + shadcn/ui components
- **Charts:** Recharts (sentiment / talk-time)
- **AI:** Lovable AI Gateway — chat model `google/gemini-3.8-flash`, transcription model `openai/gpt-transcribe`
- **Validation:** Zod (every AI response is schema-validated before use)
- **Storage:** Browser localStorage (temporary — see "Database" below)

---

## 3. Project structure

```text
src/
├── routes/
│   ├── __root.tsx          # Root layout: fonts, theme, toasts
│   ├── index.tsx           # Landing page
│   ├── dashboard.tsx       # Upload / paste / samples / recent list
│   └── c.$id.tsx           # Conversation page (transcript + analysis tabs)
├── components/app/
│   ├── AppHeader.tsx       # Header with logo + theme toggle
│   ├── Transcript.tsx      # Chat bubbles, speaker tones, highlight on citation
│   ├── tabs.tsx            # Summary, Key Points, Actions, Timeline, Sentiment, Ask AI tabs
│   ├── citations.tsx       # Citation chips that scroll to source messages
│   └── theme.tsx           # Dark/light toggle
├── lib/
│   ├── llm.ts              # callLLM() — the single AI entry point
│   ├── ai.functions.ts     # Server functions: analyze, summarize, timeline, ask
│   ├── audio.functions.ts  # Server function: audio → transcript → speaker turns
│   ├── audio-convert.ts    # Browser: any audio → 16 kHz mono WAV before upload
│   ├── parser.ts           # Chat text parsing (WhatsApp, "Name:", timed) + privacy masking
│   ├── store.ts            # localStorage persistence + sample merging
│   ├── types.ts            # Shared TypeScript types
│   └── export.ts           # Markdown / email / print export helpers
├── data/samples.ts         # 3 built-in sample conversations with pre-computed analysis
└── styles.css              # Design tokens (indigo/violet, dark/light)
```

---

## 4. AI integration (the important part)

### One function rules them all: `callLLM`

Every model call in the app goes through `callLLM(prompt, schema)` in `src/lib/llm.ts`. Nothing else talks to an AI provider. This keeps the provider swappable — to change models or providers, you edit one file.

How it works:

1. Reads `LOVABLE_API_KEY` from the server environment (inside the call, never at module scope).
2. POSTs to the gateway chat endpoint with `stream: true` and a **strict JSON schema** (`response_format: json_schema, strict: true`).
3. Consumes the SSE stream server-side and accumulates the content.
4. Parses the JSON and **validates it against a Zod schema** before returning. If the model returns anything off-shape, the call fails cleanly with a readable error instead of corrupt data.
5. Maps gateway errors to friendly messages: `429` → "AI is busy", `402` → "credits used up".

### Server functions (where AI is used)

All AI work lives in `createServerFn` handlers so keys never reach the browser:

| Function                  | File                      | Purpose                                                                 |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `analyzeConversation`     | `ai.functions.ts`         | Full pipeline: chunk → extract per chunk (parallel) → merge → verify.   |
| `summarizeFor`            | `ai.functions.ts`         | On-demand summary for a level (TL;DR/Standard/Detailed) × role.         |
| `extractTimelineSentiment`| `ai.functions.ts`         | Topic timeline + per-speaker sentiment scores.                          |
| `askConversation`         | `ai.functions.ts`         | Q&A answered only from the messages, with inline citations `[3]`.       |
| `transcribeAudio`         | `audio.functions.ts`      | Audio file → transcript → speaker-labeled turns.                        |

### The analysis pipeline (`analyzeConversation`)

1. **Chunk** — messages are split into groups of 120.
2. **Extract** — each chunk is analyzed in parallel: title, tags, three summary levels, insights (key point / decision / risk / question), and action items (task, owner, due, priority) — each with `sources`: the exact message ids that support it.
3. **Merge** — partial results are deduplicated into one analysis (single-chunk conversations skip this).
4. **Verify** — every claim is checked against its cited source messages and gets a confidence score 0–1. Claims with no valid sources default to low confidence.

### Citations

Summaries cite message ids inline (`[3]`, `[3,8]`). The UI renders these as chips; clicking one scrolls the transcript to that message and highlights it.

### Language rules

A shared `LANGUAGE_RULES` prompt block (in `ai.functions.ts`) and a matching rule in the audio speaker-split prompt enforce: **Hindi/Urdu conversations (including mixed and already-romanized) produce all output in Roman Urdu — Latin letters only, never Urdu script or Devanagari, never translated to English.** Schema enums, source ids, dates, and privacy-mask tokens stay unchanged. Other languages are answered in their own language.

### Audio transcription

1. The browser converts any audio file (MP3, WAV, M4A, OGG, WebM — including mislabeled files) to 16 kHz mono WAV via Web Audio (`audio-convert.ts`). This avoids format rejections.
2. The WAV (max 25 MB) is posted to the gateway transcription endpoint (`openai/gpt-transcribe`, streamed).
3. The raw transcript has no speaker labels, so a second `callLLM` pass splits it into speaker turns, inferring names from context ("Speaker 1" fallback). Urdu/Hindi speech is romanized in this step.
4. The result is returned as `Name: text` lines, which flow through the normal parser and analysis pipeline.

---

## 5. Database / persistence

**Current state: there is no server database yet.** Conversations persist in the browser's localStorage under the key `ttp:conversations:v1` (`src/lib/store.ts`). The three sample conversations in `src/data/samples.ts` are built in and merged with saved ones; they ship with pre-computed analysis so they open instantly with zero AI cost.

### Planned schema (Lovable Cloud)

The planned tables when Cloud is enabled:

| Table           | Key columns                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `profiles`      | user id, display name                                                        |
| `conversations` | title, source_type, language, raw_text, created_at                           |
| `messages`      | conversation_id, speaker, timestamp, text, embedding (pgvector)              |
| `summaries`     | conversation_id, level, role, content                                        |
| `insights`      | conversation_id, type (key_point/decision/risk/question), text, confidence, source_message_ids |
| `action_items`  | conversation_id, task, owner, due_date, priority, status, source_message_ids |
| `shares`        | token, conversation_id, expires_at                                           |

Embeddings on `messages` power retrieval-based Q&A and cross-conversation memory. Migration to Cloud will replace `store.ts`; the rest of the app reads through the same hooks, so the UI won't change.

---

## 6. Privacy shield

Before any text reaches the AI, `maskMessages` in `src/lib/parser.ts` replaces emails, phone numbers, and card numbers with tokens like `[EMAIL 1]`. Cards are checked before phones to avoid false matches. The UI shows a "N items masked" badge with a toggle to view the original text locally — the masked version is what the AI sees.

---

## 7. Testing

```sh
npm run test
```

Vitest covers routing and core logic (`src/test/`). When changing the parser, store, or analysis mapping, run the suite before shipping.

---

## 8. Troubleshooting

| Symptom                                   | Likely cause / fix                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| "AI is not configured for this app"       | `LOVABLE_API_KEY` missing — outside Lovable, add it to `.env`.              |
| "AI credits are used up"                  | The workspace is out of AI credits; add credits and retry.                  |
| "We couldn't transcribe this audio file"  | File over 25 MB or no speech detected; try a shorter/clearer recording.     |
| Urdu chat collapses into one message      | Speaker names must be followed by a colon (`Ali: hello`) — any script works. |
| Analysis fails with "unreadable response" | Transient model issue; retry. The app never saves unvalidated output.       |
