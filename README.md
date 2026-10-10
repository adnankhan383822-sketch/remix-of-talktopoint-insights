# Remix of TalktoPoint Insights

Build a web app called "TalktoPoint ": an AI conversation intelligence tool. Users paste or upload a conversation (team chat, meeting transcript, support ticket) and the app returns a summary, key points, decisions, action items with owners and deadlines, sentiment, and a topic timeline. Users can also ask questions about the conversation and get answers with citations to the exact source messages.

This is a hackathon demo, so it must look polished, be fast, and work end to end with free services only.

## Tech
- React + TypeScript + Tailwind + shadcn/ui, Recharts for charts
- Supabase for auth (email + Google), Postgres database, and file storage
- Supabase Edge Functions for all AI calls (never expose API keys in the frontend)
- Use Lovable's built-in AI / Gemini Flash model for LLM calls, with all model calls wrapped in one function `callLLM(prompt, schema)` so the provider can be swapped easily
- Ask the LLM to return strict JSON matching a schema, and validate it before saving

## Design
- Modern, clean SaaS look, dark and light mode toggle, fully responsive
- Indigo/violet primary color, rounded cards, subtle shadows, smooth transitions
- Skeleton loaders and streaming-style text while AI is working
- Friendly empty states and toast notifications

## Pages
1. **Landing page**: hero ("Stop re-reading long conversations"), 3 feature highlights, "Try demo" and "Sign in" buttons.
2. **Dashboard (home)**: large drag-and-drop zone and paste box for new conversations, a "Load sample conversation" dropdown (3 samples: startup team chat, product meeting transcript, customer support ticket), and a list of recent conversations with title, date, and tags.
3. **Conversation page** (the main screen), two-column layout:
   - Left: the transcript as chat bubbles with speaker names and timestamps, with highlighting.
   - Right: tabs for Summary, Key Points, Actions, Timeline, Sentiment, Ask AI.
   - Summary tab: switch between TL;DR / Standard / Detailed, plus a "summarize for" role selector (Executive, Developer, Customer).
   - Key Points: ranked list with importance badges and a confidence score each.
   - Actions: table of task, owner, due date, priority, status.
   - Timeline: topics in order with time ranges.
   - Sentiment: overall tone and a per-speaker sentiment chart, plus talk-time per speaker.
   - Ask AI: chat box answering questions about this conversation.
   - **Citations**: every insight and answer shows small source chips (e.g. "msg 12"). Clicking a chip scrolls to and highlights that message in the transcript.
   - Export buttons: Copy as Markdown, Download PDF, and "Copy as email".
4. **Action Board page**: Kanban (To do / In progress / Done) of all action items across conversations, with drag and drop.
5. **Workspace Insights page**: ask questions across ALL conversations ("What did we decide about pricing?"), recurring topics chart, and a "Decision conflicts" panel that warns when a newer conversation contradicts an earlier decision.
6. **Share page**: read-only public link for a conversation summary.

## Features
- Input: paste text, upload .txt/.pdf/.docx, or load a sample. Auto-detect speakers and timestamps (formats like "Name: message" and WhatsApp exports).
- Privacy shield: before sending to the AI, detect and mask phone numbers, emails, and card numbers, and show the user a "3 items masked" badge with a toggle to view them.
- AI pipeline in an edge function: split long text into chunks, extract structured data per chunk, merge into one final result, then run a verification step that checks each claim against the source messages and assigns a confidence score.
- Q&A uses retrieval: embed messages and fetch the most relevant ones, answer only from them, and cite message ids. If the answer is not in the conversation, say so.
- Cross-conversation memory: store embeddings with pgvector so workspace-level questions work.
- Contradiction detector: when saving a new conversation, compare its decisions with earlier ones and flag conflicts.

## Database tables (Supabase, with row-level security so users only see their own data)
profiles, conversations (title, source_type, language, raw_text, created_at), messages (conversation_id, speaker, timestamp, text, embedding), summaries (conversation_id, level, role, content), insights (conversation_id, type: key_point|decision|risk|question, text, confidence, source_message_ids), action_items (conversation_id, task, owner, due_date, priority, status, source_message_ids), shares (token, conversation_id, expires_at)

## Demo data
Pre-load the 3 sample conversations with realistic content AND pre-computed analysis results, so the demo works instantly even if the AI service is slow. Make sample 2 contradict a decision from sample 1 (for example, a pricing decision changes) so the contradiction detector has something to show.

## Rules
- Handle errors gracefully (loading, empty, rate-limit, and failed-AI states)
- Keep code modular and well organized; no hard-coded secrets
- Prioritize the Conversation page, citations, and Action Board first; make them look excellent

Start by building the landing page, dashboard, sample data, and the Conversation page with the Summary, Key Points, and Actions tabs. I will ask for the rest in follow-up prompts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c5ba4ab2-a965-400c-8bd7-120d70605d5a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
