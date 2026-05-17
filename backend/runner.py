"""Deploy a generated multi-file FastAPI app and obtain a live preview URL.

Two deploy paths:
  * **e2b** — managed micro-VM sandbox (requires ``E2B_API_KEY``). This is the
    production path per the PRD: per-run isolation + a public URL.
  * **local** — a fresh venv + uvicorn subprocess on this host. Used in dev when
    no ``E2B_API_KEY`` is set, so the app runs with zero external credentials.

Both paths emit the same ``deploy_status`` events and end with a booted app
reachable at ``Deployment.url``. A boot check polls that URL before the
deployment is considered live; a non-booting app yields ``None``.
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from typing import Callable, Optional

import httpx

APP_PORT = 8000          # port the generated app's uvicorn listens on
BOOT_TIMEOUT = 120       # seconds to wait for the app to respond (PRD edge case)
IDLE_TIMEOUT = 600       # tear a sandbox down after 10 min idle
PIP_TIMEOUT = 300        # seconds allowed for `pip install`

EmitFn = Callable[[dict], None]


class Deployment:
    """A running generated app plus how to tear it down."""

    def __init__(self, url: str, teardown: Callable[[], None], mode: str) -> None:
        self.url = url
        self.mode = mode
        self._teardown = teardown
        self._torn = False

    def teardown(self) -> None:
        if self._torn:
            return
        self._torn = True
        try:
            self._teardown()
        except Exception:  # noqa: BLE001 — teardown is best-effort
            pass


# --- registry: one deployment per pipeline thread, with idle teardown --------

_deployments: dict[str, Deployment] = {}
_idle_timers: dict[str, threading.Timer] = {}
_lock = threading.Lock()


def _register(thread_id: str, deployment: Deployment) -> None:
    with _lock:
        _deployments[thread_id] = deployment
        old = _idle_timers.pop(thread_id, None)
        if old:
            old.cancel()
        timer = threading.Timer(IDLE_TIMEOUT, teardown_thread, args=(thread_id,))
        timer.daemon = True
        timer.start()
        _idle_timers[thread_id] = timer


def teardown_thread(thread_id: str) -> bool:
    """Tear down the sandbox for a thread (reset or idle timeout). Idempotent."""
    with _lock:
        deployment = _deployments.pop(thread_id, None)
        timer = _idle_timers.pop(thread_id, None)
    if timer:
        timer.cancel()
    if deployment:
        deployment.teardown()
        return True
    return False


def teardown_all() -> None:
    """Tear down every active sandbox — called on server shutdown."""
    for thread_id in list(_deployments.keys()):
        teardown_thread(thread_id)


def runner_mode() -> str:
    return "e2b" if os.environ.get("E2B_API_KEY") else "local"


# --- boot check --------------------------------------------------------------

def _wait_for_boot(url: str, timeout: int = BOOT_TIMEOUT) -> bool:
    """Poll ``url`` until the app responds. Any HTTP status counts as booted —
    a 404/500 still means the server process is up; only a refused/failed
    connection means it is not."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            httpx.get(url, timeout=5, follow_redirects=True)
            return True
        except Exception:  # noqa: BLE001 — connection not ready yet
            time.sleep(2)
    return False


def _free_port() -> int:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


# --- e2b path ----------------------------------------------------------------

def _deploy_e2b(files: list[dict], emit: EmitFn) -> Deployment:
    from e2b import Sandbox

    api_key = os.environ["E2B_API_KEY"]
    emit({"type": "deploy_status", "message": "Creating e2b sandbox…"})
    sbx = Sandbox.create(api_key=api_key, timeout=IDLE_TIMEOUT)
    try:
        emit({"type": "deploy_status", "message": f"Uploading {len(files)} files…"})
        for f in files:
            sbx.files.write(f"/home/user/app/{f['path']}", f["content"])

        emit({"type": "deploy_status", "message": "Installing dependencies (pip install)…"})
        sbx.commands.run(
            "pip install -r requirements.txt",
            cwd="/home/user/app",
            timeout=PIP_TIMEOUT,
        )

        emit({"type": "deploy_status", "message": "Starting uvicorn…"})
        sbx.commands.run(
            f"uvicorn main:app --host 0.0.0.0 --port {APP_PORT}",
            cwd="/home/user/app",
            background=True,
        )
        host = sbx.get_host(APP_PORT)
        url = f"https://{host}"
        return Deployment(url, sbx.kill, "e2b")
    except Exception:
        try:
            sbx.kill()
        except Exception:  # noqa: BLE001
            pass
        raise


# --- local path --------------------------------------------------------------

def _deploy_local(files: list[dict], emit: EmitFn) -> Deployment:
    workdir = tempfile.mkdtemp(prefix="atoms-app-")
    for f in files:
        dest = os.path.join(workdir, f["path"])
        os.makedirs(os.path.dirname(dest) or workdir, exist_ok=True)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(f["content"])

    # Install the generated app's deps into a per-run directory and expose it
    # via PYTHONPATH — avoids needing `python -m venv` (which requires the
    # python3-venv system package). uvicorn itself is run from this backend's
    # interpreter, which already has it.
    deps_dir = os.path.join(workdir, ".deps")
    req = os.path.join(workdir, "requirements.txt")
    if os.path.exists(req):
        emit({"type": "deploy_status", "message": "Installing dependencies (pip install)…"})
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "--target", deps_dir, "-r", req],
            check=True, capture_output=True, timeout=PIP_TIMEOUT,
        )

    port = _free_port()
    emit({"type": "deploy_status", "message": "Starting uvicorn…"})
    env = os.environ.copy()
    path_parts = [p for p in (deps_dir if os.path.isdir(deps_dir) else "", env.get("PYTHONPATH", "")) if p]
    env["PYTHONPATH"] = os.pathsep.join(path_parts)
    log = open(os.path.join(workdir, "uvicorn.log"), "w")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=workdir, stdout=log, stderr=subprocess.STDOUT, env=env,
    )
    url = f"http://127.0.0.1:{port}"

    def teardown() -> None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:  # noqa: BLE001
            proc.kill()
        log.close()
        shutil.rmtree(workdir, ignore_errors=True)

    return Deployment(url, teardown, "local")


# --- public entry point ------------------------------------------------------

def deploy(thread_id: str, files: list[dict], emit: EmitFn) -> Optional[Deployment]:
    """Deploy ``files`` and return a booted :class:`Deployment`, or ``None`` if
    the app failed its boot check. Any prior deployment for ``thread_id`` is
    torn down first."""
    teardown_thread(thread_id)

    mode = runner_mode()
    emit({"type": "deploy_status", "message": f"Deploying via {mode}…"})
    deployment = (
        _deploy_e2b(files, emit) if mode == "e2b" else _deploy_local(files, emit)
    )

    emit({"type": "deploy_status", "message": "Waiting for the app to boot…"})
    if not _wait_for_boot(deployment.url):
        deployment.teardown()
        return None

    _register(thread_id, deployment)
    return deployment
