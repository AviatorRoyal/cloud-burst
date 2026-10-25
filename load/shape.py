"""Load profiles as pure functions of time, so they can be tested without Locust.

burst: base load, then BURST_COUNT bursts of BURST_MAG x capacity lasting BURST_DUR_S, separated
       by BURST_GAP_S, then a cool-down.
ramp:  step the user count up to find the private cluster's capacity (calibration).
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class BurstParams:
    capacity_users: int = 40      # users the private cluster serves within SLO (from calibration)
    base_users: int = 20
    magnitude: float = 4.0        # burst users = magnitude x capacity_users
    burst_s: float = 180
    count: int = 1
    gap_s: float = 300
    warmup_s: float = 120
    cooldown_s: float = 180
    spawn_rate: float = 20

    @classmethod
    def from_env(cls, env=os.environ) -> "BurstParams":
        return cls(
            capacity_users=int(env.get("CAPACITY_USERS", cls.capacity_users)),
            base_users=int(env.get("BASE_USERS", cls.base_users)),
            magnitude=float(env.get("BURST_MAG", cls.magnitude)),
            burst_s=float(env.get("BURST_DUR_S", cls.burst_s)),
            count=int(env.get("BURST_COUNT", cls.count)),
            gap_s=float(env.get("BURST_GAP_S", cls.gap_s)),
            warmup_s=float(env.get("WARMUP_S", cls.warmup_s)),
            cooldown_s=float(env.get("COOLDOWN_S", cls.cooldown_s)),
            spawn_rate=float(env.get("SPAWN_RATE", cls.spawn_rate)),
        )

    @property
    def total_s(self) -> float:
        return self.warmup_s + self.count * self.burst_s + (self.count - 1) * self.gap_s + self.cooldown_s


def burst_users(t: float, p: BurstParams) -> int | None:
    """Target user count at time t (seconds since start); None when the run is over."""
    if t >= p.total_s:
        return None
    s = t - p.warmup_s
    if s < 0:
        return p.base_users
    period = p.burst_s + p.gap_s
    k, into = divmod(s, period)
    if k < p.count and into < p.burst_s:
        return max(p.base_users, round(p.magnitude * p.capacity_users))
    return p.base_users


@dataclass(frozen=True)
class RampParams:
    start: int = 10
    step: int = 10
    step_s: float = 60
    max_users: int = 200
    spawn_rate: float = 20

    @classmethod
    def from_env(cls, env=os.environ) -> "RampParams":
        return cls(int(env.get("RAMP_START", cls.start)), int(env.get("RAMP_STEP", cls.step)),
                   float(env.get("RAMP_STEP_S", cls.step_s)), int(env.get("RAMP_MAX", cls.max_users)))


def ramp_users(t: float, p: RampParams) -> int | None:
    users = p.start + int(t // p.step_s) * p.step
    return users if users <= p.max_users else None
