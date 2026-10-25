"""Locust load for the three-service app, with burst and ramp shapes and a per-request log.

    TARGET=100.x.y.z SHAPE=burst BURST_MAG=4 BURST_DUR_S=180 CAPACITY_USERS=40 \
    REQUEST_LOG=results/run/requests.csv locust -f load/locustfile.py --headless

Each user sends ~2 req/s, so offered load scales with the user count. RESTRICTED_SHARE sets the
fraction of requests that hit the restricted (records) service; the rest split evenly.
"""
from __future__ import annotations

import csv
import os
import sys
import time
from pathlib import Path

from locust import HttpUser, LoadTestShape, constant_throughput, events

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shape import BurstParams, RampParams, burst_users, ramp_users  # noqa: E402

TARGET = os.environ.get("TARGET", "127.0.0.1")
PORTS = {"records": 30081, "lms": 30082, "static": 30083}
CLASSES = {"records": "restricted", "lms": "internal", "static": "public"}
SHARE = float(os.environ.get("RESTRICTED_SHARE", "0.3"))
TIMEOUT_S = float(os.environ.get("REQUEST_TIMEOUT_S", "5"))

_log_path = os.environ.get("REQUEST_LOG")
_logs: dict[int, tuple] = {}


def _log_row(row):
    """Per-process request log (opened lazily, so `locust --processes N` workers never share a file)."""
    if not _log_path:
        return
    pid = os.getpid()
    if pid not in _logs:
        p = Path(_log_path)
        f = open(p.with_name(f"{p.stem}.{pid}{p.suffix}"), "w", newline="", encoding="utf-8")
        w = csv.writer(f)
        w.writerow(["ts", "service", "data_class", "latency_ms", "ok", "node"])
        _logs[pid] = (f, w)
    _logs[pid][1].writerow(row)


class AppUser(HttpUser):
    host = f"http://{TARGET}"
    wait_time = constant_throughput(2)

    def _hit(self, svc: str):
        t0 = time.time()
        node, ok = "", False
        try:
            r = self.client.get(f"http://{TARGET}:{PORTS[svc]}/", name=svc, timeout=TIMEOUT_S)
            ok = r.status_code == 200
            if ok:
                node = r.json().get("node", "")
        except Exception:
            pass
        _log_row([round(t0, 3), svc, CLASSES[svc], round((time.time() - t0) * 1000, 1), int(ok), node])

    def records(self):
        self._hit("records")

    def lms(self):
        self._hit("lms")

    def static(self):
        self._hit("static")

    # Integer weights out of 1000; a service with zero share gets no task at all.
    tasks = {f: w for f, w in ((records, round(SHARE * 1000)), (lms, round((1 - SHARE) * 500)),
                               (static, round((1 - SHARE) * 500))) if w > 0}


class Shape(LoadTestShape):
    def __init__(self):
        super().__init__()
        self.mode = os.environ.get("SHAPE", "burst")
        self.burst = BurstParams.from_env()
        self.ramp = RampParams.from_env()

    def tick(self):
        t = self.get_run_time()
        if self.mode == "ramp":
            users = ramp_users(t, self.ramp)
            return None if users is None else (users, self.ramp.spawn_rate)
        users = burst_users(t, self.burst)
        return None if users is None else (users, self.burst.spawn_rate)


@events.quitting.add_listener
def _close(environment, **_):
    for f, _ in _logs.values():
        f.close()
