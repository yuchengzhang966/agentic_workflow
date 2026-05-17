# Atoms Demo — Multi-Agent Pipeline

A streaming multi-agent product pipeline:
**Researcher → Human Gate → Engineer ↔ Reviewer** (loops if review score < 8, max 2 attempts).

Backend is FastAPI + LangGraph (with a `MemorySaver` checkpointer and an
`interrupt()`-based human gate). Frontend is Vite + React 18 + antd, consuming
Server-Sent Events.

## Stack

| Part      | Tech                                          |
|-----------|-----------------------------------------------|
| Backend   | FastAPI, LangGraph, langchain-openai, SSE     |
| Frontend  | Vite, React 18, antd, TypeScript              |
| Model     | GLM-4-plus via the Z.ai OpenAI-compatible API |

## Run locally

### Backend (port 8000)

```bash
cd backend
python3 -m venv .venv            # if .venv does not exist
.venv/bin/pip install -r requirements.txt
cp .env.example .env             # then fill in ZHIPU_API
.venv/bin/uvicorn main:app --port 8000
```

`GET /health` → `{"ok": true}`

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/pipeline/*` to `http://localhost:8000`, so start the backend first.
For a production build: `npm run build` (output in `dist/`).

## API

| Endpoint           | Body                                          | Streams                                    |
|--------------------|-----------------------------------------------|---------------------------------------------|
| `POST /pipeline/start`  | `{idea, thread_id}`                      | researcher chunks → `interrupt` (PRD)       |
| `POST /pipeline/resume` | `{thread_id, decision, feedback?}`       | engineer chunks → `score` → `done` (code)   |
| `GET /health`           | —                                        | `{"ok": true}`                              |

SSE event types: `status`, `chunk`, `interrupt`, `score`, `loop`, `done`, `error`.

## Environment

Only `ZHIPU_API` is required (see `backend/.env.example`). No other external
accounts are needed for dev.
