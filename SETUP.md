# TalktoPoint — Setup & Architecture Guide

Everything you need to run, understand, and deploy this project: local setup, how the AI integration works, where data lives, how to migrate to your own Supabase account, and how to deploy to Vercel.

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

| Command           | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with hot reload |
| `npm run build`   | Production build                     |
| `npm run preview` | Serve the production build locally   |
| `npm run test`    | Run the test suite (Vitest)          |
| `npm run lint`    | Lint with ESLint                     |

### Environment variables

| Variable          | Where it's read | Purpose                                                        |
| ----------------- | --------------- | -------------------------------------------------------------- |
| `GEMINI_API_KEY`  | Server only     | Text AI (summaries, key points, actions, Q&A) via Gemini API.  |
| `GROQ_API_KEY`    | Server only     | Audio transcription via Groq's free `whisper-large-v3`.        |
| `LOVABLE_API_KEY` | Server only     | Optional fallback for text AI when Gemini is busy/rate-limited. |

For local development outside Lovable, create a `.env` file (never commit it):

```sh
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
LOVABLE_API_KEY=your_lovable_key_here   # optional fallback
```

All keys are read **inside server handlers only** (`process.env[...]`), never at module scope and never in browser code.

**Where to get the free keys:**

- **Gemini:** https://aistudio.google.com/apikey — free tier, no credit card.
- **Groq:** https://console.groq.com — free tier, no credit card (20 audio requests/min, 2 hours of audio/day).

---

## 2. Tech stack

- **Framework:** TanStack Start v1 (React 19, SSR, server functions) on Vite 7
- **Styling:** Tailwind CSS v4 (theme tokens in `src/styles.css`) + shadcn/ui components
- **Charts:** Recharts (sentiment / talk-time)
- **Text AI:** Google Gemini `gemini-3.8-flash` (direct API, free key) with automatic fallback to the Lovable AI Gateway
- **Audio AI:** Groq `whisper-large-v3` (free tier)
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
│   ├── llm.ts              # callLLM() — the single AI entry point (Gemini → gateway fallback)
│   ├── ai.functions.ts     # Server functions: analyze, summarize, timeline, ask
│   ├── audio.functions.ts  # Server function: audio → Groq transcript → speaker turns
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

Every text model call in the app goes through `callLLM(prompt, schema)` in `src/lib/llm.ts`. Nothing else talks to an AI provider. This keeps the provider swappable — to change models or providers, you edit one file.

How it works:

1. If `GEMINI_API_KEY` is set, it calls the Gemini API directly (`gemini-3.8-flash`) with `responseMimeType: application/json` and a converted JSON schema (`toGeminiSchema` strips `additionalProperties` and flattens union types like `["string","null"]`, which Gemini rejects).
2. If Gemini returns `429` or `5xx` (the free tier is often busy) and `LOVABLE_API_KEY` exists, it automatically falls back to the Lovable AI Gateway so analysis still succeeds.
3. The response is parsed (markdown fences stripped) and **validated against a Zod schema** before returning. Off-shape output fails cleanly with a readable error instead of corrupt data.
4. Errors map to friendly messages: `429` → "AI is busy", `402` → "credits used up".

### Server functions (where AI is used)

All AI work lives in `createServerFn` handlers so keys never reach the browser:

| Function                   | File                 | Purpose                                                               |
| -------------------------- | -------------------- | --------------------------------------------------------------------- |
| `analyzeConversation`      | `ai.functions.ts`    | Full pipeline: chunk → extract per chunk (parallel) → merge → verify. |
| `summarizeFor`             | `ai.functions.ts`    | On-demand summary for a level (TL;DR/Standard/Detailed) × role.       |
| `extractTimelineSentiment` | `ai.functions.ts`    | Topic timeline + per-speaker sentiment scores.                        |
| `askConversation`          | `ai.functions.ts`    | Q&A answered only from the messages, with inline citations `[3]`.     |
| `transcribeAudio`          | `audio.functions.ts` | Audio file → Groq transcript → speaker-labeled turns.                 |

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
2. The WAV (max 25 MB) is posted to Groq's transcription endpoint (`https://api.groq.com/openai/v1/audio/transcriptions`, model `whisper-large-v3`) using `GROQ_API_KEY`.
3. The raw transcript has no speaker labels, so a second `callLLM` pass splits it into speaker turns, inferring names from context ("Speaker 1" fallback). Urdu/Hindi speech is romanized in this step.
4. The result is returned as `Name: text` lines, which flow through the normal parser and analysis pipeline.

---

## 5. Database / persistence

**Current state: there is no server database yet.** Conversations persist in the browser's localStorage under the key `ttp:conversations:v1` (`src/lib/store.ts`). The three sample conversations in `src/data/samples.ts` are built in and merged with saved ones; they ship with pre-computed analysis so they open instantly with zero AI cost.

### Planned schema

The planned tables when a real database is connected:

| Table           | Key columns                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- |
| `profiles`      | user id, display name                                                                        |
| `conversations` | title, source_type, language, raw_text, created_at                                           |
| `messages`      | conversation_id, speaker, timestamp, text, embedding (pgvector)                              |
| `summaries`     | conversation_id, level, role, content                                                        |
| `insights`      | conversation_id, type (key_point/decision/risk/question), text, confidence, source_message_ids |
| `action_items`  | conversation_id, task, owner, due_date, priority, status, source_message_ids                 |
| `shares`        | token, conversation_id, expires_at                                                           |

Embeddings on `messages` power retrieval-based Q&A and cross-conversation memory. Migration to a real database will replace `store.ts`; the rest of the app reads through the same hooks, so the UI won't change.

---

## 6. Migrating the database to your own Supabase account

If you later enable Lovable Cloud (which provisions a managed Supabase project) and want to move everything to **your own personal Supabase account**, follow these steps.

### Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign in (free tier is fine).
2. Click **New project**, pick an organization, name it (e.g. `talktopoint`), set a strong database password (save it), and choose a region close to your users.
3. Wait ~2 minutes for provisioning.

### Step 2 — Export the schema and data from the old project

**Option A — SQL dump (recommended):**

1. In the old project, open **Project Settings → Database** and copy the connection string (or use the pooler string).
2. Run `pg_dump` locally:

```sh
pg_dump "postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres" \
  --schema=public --clean --if-exists > backup.sql
```

**Option B — Dashboard export:** in the old project's **SQL Editor**, run `pg_dump` equivalents per table, or export each table as CSV from **Table Editor → ⋯ → Export to CSV**.

### Step 3 — Create the schema in your new project

In your new project's **SQL Editor**, run the schema (adapted from the planned schema above):

```sql
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  source_type text default 'paste',
  language text,
  raw_text text not null,
  created_at timestamptz default now()
);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id uuid references conversations on delete cascade,
  speaker text,
  "timestamp" text,
  text text not null,
  embedding vector(768)
);

create table summaries (
  id bigint generated always as identity primary key,
  conversation_id uuid references conversations on delete cascade,
  level text not null,
  role text,
  content text not null
);

create table insights (
  id bigint generated always as identity primary key,
  conversation_id uuid references conversations on delete cascade,
  type text check (type in ('key_point','decision','risk','question')),
  text text not null,
  confidence real,
  source_message_ids bigint[]
);

create table action_items (
  id bigint generated always as identity primary key,
  conversation_id uuid references conversations on delete cascade,
  task text not null,
  owner text,
  due_date text,
  priority text,
  status text default 'todo',
  source_message_ids bigint[]
);

create table shares (
  token uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations on delete cascade,
  expires_at timestamptz
);

-- Row Level Security: users only see their own data
alter table conversations enable row level security;
alter table messages enable row level security;
alter table summaries enable row level security;
alter table insights enable row level security;
alter table action_items enable row level security;

create policy "own conversations" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on messages for all using (
  exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
-- repeat the same "own ..." policy pattern for summaries, insights, action_items

create policy "public shared reads" on conversations for select using (
  exists (select 1 from shares s where s.conversation_id = id and (s.expires_at is null or s.expires_at > now()))
);
```

### Step 4 — Import the data

```sh
psql "postgresql://postgres:[NEW-PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" < backup.sql
```

Or import the CSVs via **Table Editor → Import data from CSV**.

### Step 5 — Point the app at your project

1. In your new project, go to **Project Settings → API** and copy:
   - **Project URL** (`https://[ref].supabase.co`)
   - **anon public key** (safe for the browser)
   - **service_role key** (server only — never expose it)
2. Set these environment variables (locally in `.env`, on Vercel in the dashboard):

```sh
VITE_SUPABASE_URL=https://[ref].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Replace `src/lib/store.ts` reads/writes with Supabase queries through `createServerFn` handlers (keys stay server-side; the browser uses the anon key with RLS enforcing per-user access).
4. For auth (email + Google), enable providers in **Authentication → Providers**. For Google, create OAuth credentials in Google Cloud Console and paste the client ID/secret into Supabase.

---

## 7. Deploying to Vercel

**There is no database in this build.** Conversations are saved in each visitor's
own browser, so what lands on Vercel is the frontend plus a few server functions
that call Gemini and Groq. Nothing else has to exist for the app to work.

### What the build produces

`npm run build` runs Vite + Nitro. `vite.config.ts` pins the Vercel target
(`nitro: { preset: "vercel" }`) whenever Vercel's own `VERCEL` / `VERCEL_ENV`
variables are set, and leaves Lovable's Cloudflare target untouched otherwise.
The build writes Vercel's Build Output API v3 layout:

```text
.vercel/output/
├── static/                  # the browser bundle
├── functions/__server.func  # SSR + every server function (AI, transcription)
└── config.json
```

Vercel reads this on its own — you do not configure an output directory.
(Verified locally by running the build with `VERCEL=1 VERCEL_ENV=production` and
the Lovable sandbox flags removed; it emitted exactly the tree above.)

### Step 1 — Push your code to GitHub

```sh
git init
git add .
git commit -m "TalktoPoint"
git remote add origin https://github.com/<you>/talktopoint.git
git push -u origin main
```

### Step 2 — Import into Vercel

1. Go to https://vercel.com → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Vite** (auto-detected). Keep the defaults:
   - **Build command:** `npm run build`
   - **Output directory:** leave it empty — Vercel picks up `.vercel/output`.
   - **Install command:** `npm install`
3. Do **not** deploy yet — add environment variables first.

### Step 3 — Add environment variables

Only two are required. In **Settings → Environment Variables**, add both and tick
**Production, Preview and Development**:

| Name             | Value                                      | What it powers                                       |
| ---------------- | ------------------------------------------ | ---------------------------------------------------- |
| `GEMINI_API_KEY` | your key from aistudio.google.com          | summaries, key points, actions, timeline, sentiment, Ask AI |
| `GROQ_API_KEY`   | your `gsk_...` key from console.groq.com   | audio transcription (Whisper large-v3)               |

The same values you use locally work unchanged — both APIs are key-authenticated
over HTTPS with no IP allow-list.

What **not** to add:

| Name                     | Verdict                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `LOVABLE_API_KEY`        | Skip. Lovable-managed; only a fallback when Gemini is busy.         |
| `SUPABASE_*` / `VITE_SUPABASE_*` | Only after section 6 is done **and** the code is wired to Supabase. |

### Step 4 — Deploy

Click **Deploy**. Vercel builds the app and gives you a URL like
`https://talktopoint.vercel.app`. Every push to `main` redeploys automatically;
pull requests get preview deployments.

### Step 5 — Post-deploy checks

- Open the URL and run one sample conversation end to end (summary, key points, actions).
- Upload a short recording to confirm Groq transcription works in production.
- Ask AI a question and click a citation chip to confirm it jumps to the message.
- (Optional) Add a custom domain in Vercel → **Settings → Domains**.

### Limits that affect this app

- **4.5 MB request body.** Every POST to a Vercel function is capped at 4.5 MB;
  larger uploads return `413 FUNCTION_PAYLOAD_TOO_LARGE`. Audio is converted to
  16 kHz mono WAV (≈32 KB per second) before upload, so a recording longer than
  roughly **2 minutes** trips it even though the app itself allows 25 MB. Keep
  demo recordings short, or drop the sample rate for long files.
- **Function duration:** 300 s (5 minutes) on the free Hobby plan — far more than
  transcription and analysis need.
- **Gemini free tier** intermittently answers "high demand, try again later". With
  no `LOVABLE_API_KEY` there is no fallback, so the app shows a friendly error —
  clicking again usually works.
- **No server-side session:** data is browser-local, so a share link opened on
  another device shows an empty conversation. Fixing that needs the database in
  section 6.

### Notes

- Server functions become Vercel functions — `process.env` reads stay inside
  handlers (the code already does this).
- Never commit `.env`; Vercel's environment variables are the production source of truth.
- If you ever run the build locally with `VERCEL=1`, add `.vercel/` to `.gitignore`.

---

## 8. Privacy shield

Before any text reaches the AI, `maskMessages` in `src/lib/parser.ts` replaces emails, phone numbers, and card numbers with tokens like `[EMAIL 1]`. Cards are checked before phones to avoid false matches. The UI shows a "N items masked" badge with a toggle to view the original text locally — the masked version is what the AI sees.

---

## 9. Testing

```sh
npm run test
```

Vitest covers routing and core logic (`src/test/`). When changing the parser, store, or analysis mapping, run the suite before shipping.

---

## 10. Troubleshooting

| Symptom                                   | Likely cause / fix                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| "AI is not configured for this app"       | No `GEMINI_API_KEY` (and no `LOVABLE_API_KEY` fallback) — add it to `.env`.     |
| "AI is busy right now"                    | Gemini free tier rate-limited; retry, or set `LOVABLE_API_KEY` as fallback.     |
| "Transcription is not configured"         | `GROQ_API_KEY` missing — add it and restart the dev server.                     |
| "Transcription is busy right now"         | Groq free tier rate limit (20 req/min) — wait a minute and retry.               |
| "We couldn't transcribe this audio file"  | File over 25 MB or no speech detected; try a shorter/clearer recording.         |
| Gemini error about `response_schema`      | Schema uses a shape Gemini rejects — check `toGeminiSchema` in `src/lib/llm.ts`. |
| Urdu chat collapses into one message      | Speaker names must be followed by a colon (`Ali: hello`) — any script works.    |
| Analysis fails with "unreadable response" | Transient model issue; retry. The app never saves unvalidated output.           |
| Vercel build fails on env vars            | Add all variables to Preview **and** Production, then redeploy.                 |
