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

- AI calls go through `src/lib/ai.functions.ts` and must call the `consume_ai_quota` database function first — workers are stateless, so per-user quotas live in the database, not memory.
- Media lives in private storage buckets (`videos`, `thumbnails`) under `<user_id>/`, shown via signed URLs — the workspace blocks public buckets.
- The site-wide developer credit renders from `src/components/SiteFooter.tsx`, mounted once in the root layout (`src/routes/__root.tsx`) so it appears on every page — keep it there instead of duplicating it per page.
