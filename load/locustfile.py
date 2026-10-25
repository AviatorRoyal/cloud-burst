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
_log_file = open(_log_path, "w", newline="", encoding="utf-8") if _log_path else None
_log = csv.writer(_log_file) if _log_file else None
if _log:
    _log.writerow(["ts", "service", "data_class", "latency_ms", "ok", "node"])


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
        if _log:
            _log.writerow([round(t0, 3), svc, CLASSES[svc], round((time.time() - t0) * 1000, 1), int(ok), node])

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
    if _log_file:
        _log_file.close()
