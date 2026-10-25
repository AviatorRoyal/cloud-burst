"""The bursting decision: when to burst, how much capacity to add, and which work may use it.

Pure logic over an Observation, so the same code drives PolicyBurst, the threshold
baseline (constraints off) and every ablation, and is unit-testable without a cluster.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .cost import CostMeter, can_acquire, must_halt
from .feasibility import Constraints, feasible
from .policy import Policy

MODES = ("policyburst", "threshold", "noburst")


@dataclass(frozen=True)
class Workload:
    namespace: str
    name: str
    data_class: str | None
    pending: int = 0
    ready: int = 0

    @property
    def key(self) -> str:
        return f"{self.namespace}/{self.name}"


@dataclass
class Observation:
    now: float
    workloads: list[Workload]
    private_util: float | None          # mean CPU usage / allocatable over private nodes
    active: set[str]                    # public destinations currently schedulable
    rtts: dict[str, float | None]       # probed RTT per destination
    service_ms: float = 20.0            # typical in-pod service time


@dataclass(frozen=True)
class Thresholds:
    burst_util: float = 0.75
    burst_after_s: float = 30
    idle_util: float = 0.40
    idle_after_s: float = 300


@dataclass
class Plan:
    allowed: dict[str, list[str]] = field(default_factory=dict)  # workload -> destination names
    activate: list[str] = field(default_factory=list)
    deactivate: list[str] = field(default_factory=list)
    rejections: list[tuple[str, str]] = field(default_factory=list)  # (workload, reason)
    notes: list[str] = field(default_factory=list)


class Decider:
    def __init__(self, mode: str, constraints: Constraints, meter: CostMeter,
                 thresholds: Thresholds = Thresholds(), interval_s: float = 15):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        self.mode = mode
        self.constraints = Constraints.none() if mode == "threshold" else constraints
        self.meter = meter
        self.t = thresholds
        self.interval_s = interval_s
        self._hot_since: float | None = None
        self._idle_since: float | None = None
        self._last_activation = float("-inf")

    def decide(self, policy: Policy, obs: Observation) -> Plan:
        plan = Plan()
        if self.mode == "noburst":
            private = [d.name for d in policy.private]
            plan.allowed = {w.key: private for w in obs.workloads}
            plan.deactivate = sorted(obs.active)
            plan.rejections = [(w.key, "no-burst") for w in obs.workloads if w.pending]
            return plan

        reasons: dict[str, str | None] = {}
        for w in obs.workloads:
            dests, reason = feasible(policy, w.data_class, obs.rtts, obs.service_ms, self.constraints,
                                     rtt_multiplier=policy.rtt_multiplier)
            plan.allowed[w.key] = [d.name for d in dests]
            reasons[w.key] = reason

        pending = [w for w in obs.workloads if w.pending]
        util = obs.private_util or 0.0
        hot = bool(pending) or util > self.t.burst_util
        idle = not pending and util < self.t.idle_util
        self._hot_since = (self._hot_since or obs.now) if hot else None
        self._idle_since = (self._idle_since or obs.now) if idle else None
        active = set(obs.active)

        # Budget: stop all public capacity before the next interval would cross the ceiling.
        if self.constraints.cost and active and must_halt(self.meter, policy, self.interval_s):
            plan.deactivate = sorted(active, key=lambda n: -policy.destination(n).rate_per_hour_inr)
            plan.notes.append("budget-halt")
            active.clear()
            budget_blocked = True
        else:
            budget_blocked = False

        # Scale out: one destination per reconcile, after pressure has lasted burst_after_s
        # and the previous activation has had time to absorb pending pods.
        if (self._hot_since is not None and obs.now - self._hot_since >= self.t.burst_after_s
                and obs.now - self._last_activation >= self.t.burst_after_s):
            for w in pending:
                permitted = sorted((d for d in policy.public if d.name in plan.allowed[w.key]),
                                   key=lambda d: d.rate_per_hour_inr)
                if not permitted:
                    plan.rejections.append((w.key, reasons[w.key] or "no-public-destination"))
                    continue
                candidates = [d for d in permitted if d.name not in active and d.name not in plan.activate]
                if not candidates:
                    if plan.activate:
                        continue
                    plan.rejections.append((w.key, "capacity"))
                    continue
                if budget_blocked:
                    plan.rejections.append((w.key, "budget"))
                    continue
                chosen = None
                for d in candidates:
                    if self.constraints.cost:
                        ok, projected = can_acquire(self.meter, policy, d)
                        if not ok:
                            plan.notes.append(f"budget-deny {d.name} projected={projected:.2f}")
                            continue
                    chosen = d
                    break
                if chosen is None:
                    plan.rejections.append((w.key, "budget"))
                    continue
                plan.activate.append(chosen.name)
                self._last_activation = obs.now
                break  # one destination per reconcile

        # Scale in: release the most expensive active destination once load has stayed low.
        if (active and self._idle_since is not None
                and obs.now - self._idle_since >= self.t.idle_after_s):
            victim = max(active, key=lambda n: policy.destination(n).rate_per_hour_inr)
            plan.deactivate.append(victim)
            self._idle_since = obs.now
        return plan
