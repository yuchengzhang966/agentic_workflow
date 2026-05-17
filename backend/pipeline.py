"""LangGraph pipeline: researcher → human_gate → engineer → reviewer (loop if score < 8).

Sync graph execution in a worker thread. Nodes emit events to an asyncio.Queue
via loop.call_soon_threadsafe so the FastAPI handler can stream SSE without
blocking the event loop. This sidesteps langgraph's Python-3.11 requirement
for async-context interrupt() calls.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import threading
from typing import AsyncIterator, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

ZHIPU_BASE_URL = "https://api.z.ai/api/paas/v4"
MODEL_NAME = "glm-5.1"

RESEARCHER_PROMPT = (
    "You are a sharp product researcher. Given a product idea, write a structured PRD covering: "
    "(1) market context 1-2 sentences, (2) core user story, (3) three key features with brief rationale, "
    "(4) one key risk. 250-350 words. Plain prose, no headers. Always respond in English."
)

ENGINEER_PROMPT = (
    "You are a senior frontend engineer. Build a self-contained single-file HTML app implementing the PRD below. "
    "Use vanilla JS and inline CSS. Output ONLY the complete HTML file, nothing else. Always respond in English."
)

REVIEWER_PROMPT = (
    "You are a code reviewer. Review the HTML app against the original idea and PRD. "
    'Return ONLY a JSON object: { "score": <1-10 integer>, "issues": [<string>, ...] }. '
    "Be concise. Always respond in English."
)


class PipelineState(TypedDict, total=False):
    idea: str
    prd: str
    human_decision: Optional[str]
    human_feedback: Optional[str]
    code: str
    review_score: int
    review_issues: list[str]
    attempts: int


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
_checkpointer = MemorySaver()
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

    attempt = state.get("attempts", 0) + 1
    if attempt > 1 and bus:
        bus.emit({"type": "loop", "attempt": attempt})

    user_msg = f"PRD:\n{state.get('prd', '')}\n\nBuild the HTML app now."
    feedback = state.get("human_feedback")
    if feedback:
        user_msg += f"\n\nIncorporate this feedback: {feedback}"
    prior_issues = state.get("review_issues") or []
    if prior_issues:
        joined = "\n".join(f"{i+1}. {x}" for i, x in enumerate(prior_issues))
        user_msg += f"\n\nFix these issues from code review:\n{joined}"

    model = _make_model(8192)
    code_parts: list[str] = []
    for chunk in model.stream(
        [SystemMessage(content=ENGINEER_PROMPT), HumanMessage(content=user_msg)]
    ):
        text = _extract_text(chunk.content)
        if text:
            code_parts.append(text)
            if bus:
                bus.emit({"type": "chunk", "node": "engineer", "text": text})

    return {"code": "".join(code_parts).strip(), "attempts": attempt}


def reviewer_node(state: PipelineState, config) -> dict:
    thread_id = _thread_id_from_config(config)
    bus = _get_bus(thread_id)
    if bus:
        bus.emit({"type": "status", "node": "reviewer"})

    model = _make_model(512)
    res = model.invoke(
        [
            SystemMessage(content=REVIEWER_PROMPT),
            HumanMessage(
                content=(
                    f"Original idea: {state.get('idea', '')}\n\n"
                    f"PRD:\n{state.get('prd', '')}\n\n"
                    f"App HTML:\n{state.get('code', '')}"
                )
            ),
        ]
    )
    raw = _extract_text(res.content) or (res.content if isinstance(res.content, str) else json.dumps(res.content))
    score, issues = _parse_review(raw)
    if bus:
        bus.emit({"type": "score", "score": score, "issues": issues})
    return {"review_score": score, "review_issues": issues}


def _should_loop(state: PipelineState):
    if state.get("review_score", 0) >= 8 or state.get("attempts", 0) >= 2:
        return END
    return "engineer"


def _build_graph():
    builder = StateGraph(PipelineState)
    builder.add_node("researcher", researcher_node)
    builder.add_node("human_gate", human_gate_node)
    builder.add_node("engineer", engineer_node)
    builder.add_node("reviewer", reviewer_node)
    builder.add_edge(START, "researcher")
    builder.add_edge("researcher", "human_gate")
    builder.add_edge("human_gate", "engineer")
    builder.add_edge("engineer", "reviewer")
    builder.add_conditional_edges("reviewer", _should_loop, {"engineer": "engineer", END: END})
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
            bus.emit(
                {
                    "type": "done",
                    "code": final_state.get("code", ""),
                    "score": final_state.get("review_score", 0),
                    "issues": final_state.get("review_issues", []),
                    "attempts": final_state.get("attempts", 0),
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
        # Drain to avoid leaking the thread (it will finish on its own once invoke returns).
        await asyncio.get_running_loop().run_in_executor(None, worker_thread.join, 30)
        _clear_bus(thread_id)
