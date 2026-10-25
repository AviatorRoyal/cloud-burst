"""Hard filters that define where a workload may run, before any burst decision is made."""
from __future__ import annotations

from dataclasses import dataclass

from .policy import Destination, Policy


@dataclass(frozen=True)
class Constraints:
    """Which constraints are enforced. Threshold baseline = all off; ablations switch one off."""
    residency: bool = True
    latency: bool = True
    cost: bool = True

    @classmethod
    def none(cls) -> "Constraints":
        return cls(residency=False, latency=False, cost=False)

    @classmethod
    def without(cls, names: list[str]) -> "Constraints":
        unknown = set(names) - {"residency", "latency", "cost"}
        if unknown:
            raise ValueError(f"unknown constraint(s): {sorted(unknown)}")
        return cls(**{n: n not in names for n in ("residency", "latency", "cost")})


def residency_ok(policy: Policy, data_class: str | None, dest: Destination) -> bool:
    return dest.region in policy.permitted_regions(data_class)


def latency_ok(policy: Policy, dest: Destination, rtt_ms: float | None, service_ms: float,
               rtt_multiplier: float = 2.0) -> bool:
    """A request forwarded from the private ingress to dest pays rtt_multiplier round trips."""
    if dest.private:
        return True
    if rtt_ms is None:  # unreachable or not yet probed: fail closed
        return False
    return rtt_multiplier * rtt_ms + service_ms <= policy.slo_latency_ms


def feasible(
    policy: Policy,
    data_class: str | None,
    rtts: dict[str, float | None],
    service_ms: float,
    constraints: Constraints,
    rtt_multiplier: float = 2.0,
) -> tuple[list[Destination], str | None]:
    """Destinations this workload may use, and the reason public capacity is excluded (if it is)."""
    dests = list(policy.destinations)
    reason = None
    if constraints.residency:
        dests = [d for d in dests if residency_ok(policy, data_class, d)]
        if not any(not d.private for d in dests):
            reason = "residency"
    if constraints.latency:
        before = any(not d.private for d in dests)
        dests = [d for d in dests if latency_ok(policy, d, rtts.get(d.name), service_ms, rtt_multiplier)]
        if before and not any(not d.private for d in dests):
            reason = "latency"
    return dests, reason
