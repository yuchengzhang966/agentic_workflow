# Atoms Demo

Generate any web app from a text description. Watch it come to life in real time.

**Live demo:** https://atoms-demo.vercel.app  
**Source:** https://github.com/your-username/atoms-demo

## What it does

1. **Generate** — type a description, Claude streams a self-contained HTML app live
2. **Preview** — rendered immediately in a sandboxed iframe
3. **Refine** — iterate on the app with follow-up prompts (version history saved)
4. **Share** — every app gets a persistent URL
5. **Remix** — fork any app and start from there
6. **Edit** — direct code editing with save

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **Anthropic Claude** (claude-haiku-4-5) — streaming generation
- **SQLite** (better-sqlite3) — zero-infrastructure persistence
- **Tailwind CSS** — styling
- **Vercel** — deployment

## Local setup

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

npm install
npm run dev
# open http://localhost:3000
```

## Architecture

```
/src
  /app
    /api
      /stream        → SSE streaming from Claude
      /apps          → CRUD for saved apps
      /apps/[id]     → single app + version history
    /create          → live generation page
    /app/[id]        → share/view page with refine + edit
  /lib
    db.ts            → SQLite access layer
    claude.ts        → Anthropic client
  /components
    AppCard.tsx      → gallery thumbnail
```

SQLite schema: `apps` table (id, title, prompt, html, timestamps, remix_of) + `iterations` table for version history. Auto-created on first run.
