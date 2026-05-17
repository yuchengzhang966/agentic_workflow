"""FastAPI entry: /pipeline/start (SSE), /pipeline/resume (SSE), /health."""
from __future__ import annotations

import json
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

load_dotenv(".env")
load_dotenv(".env.local")

from pipeline import run_pipeline  # noqa: E402

app = FastAPI(title="Atoms Demo Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    idea: str
    thread_id: str


class ResumeRequest(BaseModel):
    thread_id: str
    decision: str  # "approve" | "reject"
    feedback: Optional[str] = None


def _wrap(event: dict, start_time: float) -> dict:
    # sse-starlette accepts {"data": str} dict; we encode the payload as JSON.
    # If this is the "done" event, inject elapsed seconds.
    if event.get("type") == "done":
        event = {**event, "elapsed": round(time.time() - start_time, 2)}
    return {"data": json.dumps(event)}


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/pipeline/start")
async def pipeline_start(req: StartRequest):
    start_time = time.time()

    async def gen():
        async for event in run_pipeline(req.thread_id, idea=req.idea):
            yield _wrap(event, start_time)

    return EventSourceResponse(gen())


@app.post("/pipeline/resume")
async def pipeline_resume(req: ResumeRequest):
    start_time = time.time()
    resume_with = {
        "approved": req.decision == "approve",
        "feedback": req.feedback,
    }

    async def gen():
        async for event in run_pipeline(req.thread_id, resume_with=resume_with):
            yield _wrap(event, start_time)

    return EventSourceResponse(gen())
