"""Cost accumulator: meters public node-hours at shadow prices and gates new capacity on projected spend."""
from __future__ import annotations

import calendar
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .policy import Destination, Policy


class CostMeter:
    """Per-second metering of each active public destination. Survives restarts via a JSON state file."""

    def __init__(self, clock: Callable[[], float] = time.time, state_path: str | Path | None = None):
        self.clock = clock
        self.state_path = Path(state_path) if state_path else None
        self.closed_inr = 0.0
        self.active: dict[str, tuple[float, float]] = {}  # name -> (start_ts, rate_per_hour)
        self.period_start = clock()
        if self.state_path and self.state_path.exists():
            s = json.loads(self.state_path.read_text())
            self.closed_inr, self.period_start = s["closed_inr"], s["period_start"]
            self.active = {k: tuple(v) for k, v in s["active"].items()}

    def start(self, dest: Destination) -> None:
        if dest.name not in self.active:
            self.active[dest.name] = (self.clock(), dest.rate_per_hour_inr)
            self._save()

    def stop(self, name: str) -> None:
        if name in self.active:
            started, rate = self.active.pop(name)
            self.closed_inr += rate * (self.clock() - started) / 3600
            self._save()

    def total_inr(self) -> float:
        now = self.clock()
        return self.closed_inr + sum(rate * (now - t0) / 3600 for t0, rate in self.active.values())

    def burn_rate_inr_h(self) -> float:
        return sum(rate for _, rate in self.active.values())

    def hours_left(self, policy: Policy) -> float:
        now = self.clock()
        if policy.billing_period_hours:
            return max(0.0, float(policy.billing_period_hours) - (now - self.period_start) / 3600)
        d = datetime.fromtimestamp(now, timezone.utc)
        end = datetime(d.year, d.month, calendar.monthrange(d.year, d.month)[1], 23, 59, 59, tzinfo=timezone.utc)
        return max(0.0, (end.timestamp() - now) / 3600)

    def _save(self) -> None:
        if self.state_path:
            self.state_path.write_text(json.dumps(
                {"closed_inr": self.closed_inr, "period_start": self.period_start, "active": self.active}))


def can_acquire(meter: CostMeter, policy: Policy, dest: Destination) -> tuple[bool, float]:
    """Projected spend if dest is added now and everything active runs for one more lease.

    Checking projected rather than current spend matters: a node bought just under the
    ceiling still bills for its whole lease, so a current-spend check overshoots.
    """
    lease = min(policy.min_lease_hours, meter.hours_left(policy))
    projected = meter.total_inr() + (meter.burn_rate_inr_h() + dest.rate_per_hour_inr) * lease
    return projected <= policy.monthly_ceiling_inr - policy.reserve_inr, projected


def must_halt(meter: CostMeter, policy: Policy, interval_s: float) -> bool:
    """True when running one more reconcile interval would cross ceiling minus reserve."""
    next_total = meter.total_inr() + meter.burn_rate_inr_h() * interval_s / 3600
    return next_total > policy.monthly_ceiling_inr - policy.reserve_inr
