<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All model calls go through `callLLM(prompt, schema)` in src/lib/llm.ts, invoked only from createServerFn handlers in src/lib/ai.functions.ts — keeps the provider swappable and keys server-side.
- Conversations currently persist in browser storage (src/lib/store.ts) with built-in samples in src/data/samples.ts — temporary until Lovable Cloud tables are added.
