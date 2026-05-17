"""LangGraph pipeline: researcher → human_gate → engineer → runner → reviewer.

The engineer node emits a self-contained client-side `index.html`; the runner
node hands that HTML to the frontend, which renders it directly in the browser
preview (no server or sandbox). No score<8 re-engineer loop — the reviewer
scores the generated app once, then the pipeline ends.

Sync graph execution runs in a worker thread. Nodes emit events to an
asyncio.Queue via loop.call_soon_threadsafe so the FastAPI handler can stream
SSE without blocking the event loop.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sqlite3
import threading
from typing import AsyncIterator, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

ZHIPU_BASE_URL = "https://api.z.ai/api/paas/v4"
MODEL_NAME = "glm-4.5-flash"

RESEARCHER_PROMPT = (
    "You are a sharp product researcher. Given a product idea, write a structured PRD covering: "
    "(1) market context 1-2 sentences, (2) core user story, (3) three key features with brief rationale, "
    "(4) one key risk. 250-350 words. Plain prose, no headers. Always respond in English."
)

ENGINEER_PROMPT = (
    "You are a senior front-end engineer. Build a COMPLETE, RUNNABLE web "
    "application implementing the PRD below, as a SINGLE self-contained HTML "
    "file.\n\n"
    "Hard requirements:\n"
    "- Output EXACTLY ONE file named `index.html`.\n"
    "- It MUST be fully self-contained: all CSS inside one `<style>` tag and "
    "all JavaScript inside one `<script>` tag, inline in the HTML. NO external "
    "files, NO CDN links, NO frameworks — plain HTML, CSS and vanilla JS only.\n"
    "- The app runs ENTIRELY in the browser. There is NO backend and NO "
    "network. Do NOT use `fetch`, `XMLHttpRequest`, or any server call.\n"
    "- Persist data with `localStorage` so it survives a page reload.\n"
    "- The app MUST be genuinely functional and interactive — real working "
    "features, not a static mockup.\n\n"
    "OUTPUT FORMAT — output EXACTLY this and nothing else. No markdown fences, "
    "no prose, no commentary:\n"
    "@@FILE: index.html\n"
    "<full verbatim file content>\n"
    "@@ENDFILE@@\n\n"
    "Keep the app focused but polished. Always respond in English."
)

REVIEWER_PROMPT = (
    "You are a senior code reviewer. Review the generated multi-file FastAPI "
    "project against the original idea and PRD. Judge correctness, whether it "
    "implements the PRD, and obvious bugs. "
    'Return ONLY a JSON object: { "score": <1-10 integer>, "issues": [<string>, ...] }. '
    "Be concise. Always respond in English."
)


class PipelineState(TypedDict, total=False):
    idea: str
    prd: str
    human_decision: Optional[str]
    human_feedback: Optional[str]
    files: list[dict]
    runner_error: Optional[str]
    review_score: int
    review_issues: list[str]


# --- engineer output parsing -------------------------------------------------

_FILE_RE = re.compile(
    r"@@FILE:\s*(?P<path>[^\n]+)\n(?P<body>.*?)\n?@@ENDFILE@@",
    re.DOTALL,
)

# A file whose @@FILE: header has streamed in but is not yet closed by
# @@ENDFILE@@ — used to stream the in-progress file into the Code tab live.
_PARTIAL_FILE_RE = re.compile(r"@@FILE:\s*(?P<path>[^\n]+)\n(?P<body>.*)", re.DOTALL)


def _strip_fences(body: str) -> str:
    """Drop a stray leading ```lang / trailing ``` line if the model added one."""
    lines = body.split("\n")
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


class FileStreamParser:
    """Incremental parser: feed streamed text, get complete files back."""

    def __init__(self) -> None:
        self.buffer = ""

    def feed(self, text: str) -> list[dict]:
        self.buffer += text
        out: list[dict] = []
        while True:
            m = _FILE_RE.search(self.buffer)
            if not m:
                break
            out.append(
                {
                    "path": m.group("path").strip(),
                    "content": _strip_fences(m.group("body")),
                }
            )
            self.buffer = self.buffer[m.end():]
        return out

    def partial(self) -> Optional[dict]:
        """The file currently being written — its @@FILE: header has arrived
        but @@ENDFILE@@ has not. Returns ``None`` when nothing is in flight."""
        m = _PARTIAL_FILE_RE.search(self.buffer)
        if not m:
            return None
        return {
            "path": m.group("path").strip(),
            "content": _strip_fences(m.group("body")),
        }


# --- cross-thread event bus --------------------------------------------------

class Bus:
    """Cross-thread event bus: worker thread emits, asyncio consumer reads."""

    SENTINEL = object()

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.queue: asyncio.Queue = asyncio.Queue()

    def emit(self, event: dict) -> None:
        # Called from worker thread.
        self.loop.call_soon_threadsafe(self.queue.put_nowait, event)

    def close(self) -> None:
        self.loop.call_soon_threadsafe(self.queue.put_nowait, Bus.SENTINEL)

    async def next(self):
        return await self.queue.get()


# Module-level singletons — Python's import cache makes these process-wide
# within one uvicorn worker, so /pipeline/start and /pipeline/resume share state.
#
# Durable checkpointer: pipeline state (per thread_id) is persisted to a local
# SQLite file, so an interrupted run survives a process restart and can resume.
# check_same_thread=False because the graph runs in a worker thread; SqliteSaver
# serializes access internally.
_DB_PATH = os.environ.get(
    "CHECKPOINT_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints.db"),
)
_checkpointer = SqliteSaver(sqlite3.connect(_DB_PATH, check_same_thread=False))
_checkpointer.setup()
_bus_registry: dict[str, Bus] = {}
_registry_lock = threading.Lock()


def _get_bus(thread_id: str) -> Optional[Bus]:
    with _registry_lock:
        return _bus_registry.get(thread_id)


def _set_bus(thread_id: str, bus: Bus) -> None:
    with _registry_lock:
        _bus_registry[thread_id] = bus


def _clear_bus(thread_id: str) -> None:
    with _registry_lock:
        _bus_registry.pop(thread_id, None)


def _make_model(max_tokens: int) -> ChatOpenAI:
    return ChatOpenAI(
        model=MODEL_NAME,
        max_tokens=max_tokens,
        api_key=os.environ["ZHIPU_API"],
        base_url=ZHIPU_BASE_URL,
        # glm-4.5-flash is a reasoning model — disable thinking so the token
        # budget goes to real output, not reasoning_content.
        extra_body={"thinking": {"type": "disabled"}},
    )


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, dict) and isinstance(c.get("text"), str):
                parts.append(c["text"])
        return "".join(parts)
    return ""


def _parse_review(raw: str) -> tuple[int, list[str]]:
    trimmed = raw.strip()
    trimmed = re.sub(r"^```(?:json)?", "", trimmed, flags=re.IGNORECASE).strip()
    trimmed = re.sub(r"```$", "", trimmed).strip()
    m = re.search(r"\{[\s\S]*\}", trimmed)
    payload = m.group(0) if m else trimmed
    try:
        parsed = json.loads(payload)
        score_val = parsed.get("score", 5)
        if not isinstance(score_val, (int, float)):
            score_val = 5
        score = max(1, min(10, int(round(score_val))))
        issues_val = parsed.get("issues", [])
        issues = [s for s in issues_val if isinstance(s, str)] if isinstance(issues_val, list) else []
        return score, issues
    except (ValueError, TypeError):
        return 5, ["reviewer output was not valid JSON"]


def _thread_id_from_config(config) -> str:
    return (config or {}).get("configurable", {}).get("thread_id", "")


# --- nodes -------------------------------------------------------------------

def researcher_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "researcher"})

    model = _make_model(1024)
    prd_parts: list[str] = []
    for chunk in model.stream(
        [SystemMessage(content=RESEARCHER_PROMPT), HumanMessage(content=f"Product idea: {state['idea']}")]
    ):
        text = _extract_text(chunk.content)
        if text:
            prd_parts.append(text)
            if bus:
                bus.emit({"type": "chunk", "node": "researcher", "text": text})
    return {"prd": "".join(prd_parts).strip()}


def human_gate_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "human_gate"})

    decision = interrupt({"prd": state.get("prd", "")})
    return {
        "human_decision": "approved" if decision.get("approved") else "changes",
        "human_feedback": decision.get("feedback"),
    }


def engineer_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "engineer"})

    user_msg = f"PRD:\n{state.get('prd', '')}\n\nBuild the application now."
    feedback = state.get("human_feedback")
    if feedback:
        user_msg += f"\n\nIncorporate this feedback: {feedback}"

    model = _make_model(16000)
    parser = FileStreamParser()
    files: list[dict] = []
    raw_parts: list[str] = []

    def _add(f: dict) -> None:
        files.append(f)
        if bus:
            bus.emit({"type": "file", "path": f["path"], "content": f["content"]})
            bus.emit({"type": "chunk", "node": "engineer", "text": f"\U0001F4C4 {f['path']}\n"})

    last_partial_len = 0
    for chunk in model.stream(
        [SystemMessage(content=ENGINEER_PROMPT), HumanMessage(content=user_msg)]
    ):
        text = _extract_text(chunk.content)
        if not text:
            continue
        raw_parts.append(text)
        for f in parser.feed(text):
            _add(f)
            last_partial_len = 0
        # Stream the in-progress file into the Code tab so the engineer phase
        # shows continuous progress instead of long silences between files.
        if bus:
            p = parser.partial()
            if p and len(p["content"]) - last_partial_len >= 100:
                last_partial_len = len(p["content"])
                bus.emit({"type": "file", "path": p["path"], "content": p["content"]})

    # Fallback: model ignored the streaming-friendly schema — parse the whole
    # output once more in case blocks were only complete at the very end.
    if not files:
        full = "".join(raw_parts)
        for m in _FILE_RE.finditer(full):
            _add({"path": m.group("path").strip(), "content": _strip_fences(m.group("body"))})

    return {"files": files}


def runner_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "runner"})

    def emit(event: dict) -> None:
        if bus:
            bus.emit(event)

    files = state.get("files") or []
    html = next(
        (f["content"] for f in files if f["path"].strip().lower().endswith("index.html")),
        None,
    )
    if not html:
        msg = "Engineer output incomplete — no index.html was produced."
        emit({"type": "error", "message": msg})
        return {"runner_error": msg}

    # The generated app is a self-contained client-side page — hand the HTML to
    # the frontend, which renders it straight into the browser preview. No
    # server, no sandbox, nothing to boot or expire.
    emit({"type": "deploy_status", "message": "Rendering preview…"})
    emit({"type": "preview", "html": html})
    emit({"type": "deploy_status", "message": "Live"})
    return {}


def reviewer_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "reviewer"})
        bus.emit({"type": "chunk", "node": "reviewer", "text": "Reviewing the generated project…\n"})

    files = state.get("files") or []
    files_blob = "\n\n".join(f"=== {f['path']} ===\n{f['content']}" for f in files)
    # Larger budget than the old single-HTML reviewer: a multi-file project plus
    # any model preamble can overrun 512 tokens and truncate the JSON verdict.
    model = _make_model(1024)
    res = model.invoke(
        [
            SystemMessage(content=REVIEWER_PROMPT),
            HumanMessage(
                content=(
                    f"Original idea: {state.get('idea', '')}\n\n"
                    f"PRD:\n{state.get('prd', '')}\n\n"
                    f"Generated project ({len(files)} files):\n{files_blob}"
                )
            ),
        ]
    )
    raw = _extract_text(res.content) or (res.content if isinstance(res.content, str) else json.dumps(res.content))
    score, issues = _parse_review(raw)
    if bus:
        bus.emit(
            {
                "type": "score",
                "score": score,
                "issues": issues,
                "feedback": "; ".join(issues) if issues else "No blocking issues found.",
            }
        )
    return {"review_score": score, "review_issues": issues}


def _after_runner(state: PipelineState):
    """Skip the reviewer when the app never deployed — the error is already out."""
    return END if state.get("runner_error") else "reviewer"


def _build_graph():
    builder = StateGraph(PipelineState)
    builder.add_node("researcher", researcher_node)
    builder.add_node("human_gate", human_gate_node)
    builder.add_node("engineer", engineer_node)
    builder.add_node("runner", runner_node)
    builder.add_node("reviewer", reviewer_node)
    builder.add_edge(START, "researcher")
    builder.add_edge("researcher", "human_gate")
    builder.add_edge("human_gate", "engineer")
    builder.add_edge("engineer", "runner")
    builder.add_conditional_edges("runner", _after_runner, {"reviewer": "reviewer", END: END})
    builder.add_edge("reviewer", END)
    return builder.compile(checkpointer=_checkpointer)


graph = _build_graph()


async def run_pipeline(
    thread_id: str,
    *,
    idea: Optional[str] = None,
    resume_with: Optional[dict] = None,
) -> AsyncIterator[dict]:
    loop = asyncio.get_running_loop()
    bus = Bus(loop)
    _set_bus(thread_id, bus)

    config = {"configurable": {"thread_id": thread_id}}
    graph_input = Command(resume=resume_with) if resume_with is not None else {"idea": idea or ""}

    def worker():
        try:
            final_state = graph.invoke(graph_input, config)
            if isinstance(final_state, dict) and "__interrupt__" in final_state:
                interrupts = final_state["__interrupt__"]
                if interrupts:
                    first = interrupts[0]
                    value = first.value if hasattr(first, "value") else first.get("value", {})
                    prd = value.get("prd", "") if isinstance(value, dict) else ""
                    bus.emit({"type": "interrupt", "prd": prd})
                return
            if isinstance(final_state, dict) and final_state.get("runner_error"):
                # error event already emitted by runner_node; just close out.
                return
            bus.emit(
                {
                    "type": "done",
                    "files": final_state.get("files", []),
                    "preview_url": final_state.get("preview_url"),
                    "score": final_state.get("review_score", 0),
                    "issues": final_state.get("review_issues", []),
                }
            )
        except Exception as err:  # noqa: BLE001
            bus.emit({"type": "error", "message": str(err) or "pipeline failed"})
        finally:
            bus.close()

    worker_thread = threading.Thread(target=worker, daemon=True)
    worker_thread.start()

    try:
        while True:
            event = await bus.next()
            if event is Bus.SENTINEL:
                break
            yield event
    finally:
        # Drain to avoid leaking the thread (it finishes on its own once invoke returns).
        await asyncio.get_running_loop().run_in_executor(None, worker_thread.join, 30)
        _clear_bus(thread_id)
