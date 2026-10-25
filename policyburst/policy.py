"""BurstPolicy model: the administrator's constraints as explicit controller inputs."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

GROUP, VERSION, PLURAL = "p11.burst", "v1", "burstpolicies"


@dataclass(frozen=True)
class Destination:
    name: str
    region: str
    rate_per_hour_inr: float = 0.0
    private: bool = False


@dataclass(frozen=True)
class Policy:
    name: str
    monthly_ceiling_inr: float
    reserve_inr: float
    slo_latency_ms: float
    destinations: tuple[Destination, ...]
    residency: dict[str, tuple[str, ...]] = field(default_factory=dict)
    min_lease_hours: float = 1.0
    # Requests through kube-proxy typically pay a TCP handshake plus the request itself.
    rtt_multiplier: float = 2.0
    # Experiments compress a billing month into one run; None means a calendar month.
    billing_period_hours: float | None = None

    def destination(self, name: str) -> Destination:
        for d in self.destinations:
            if d.name == name:
                return d
        raise KeyError(name)

    @property
    def private(self) -> list[Destination]:
        return [d for d in self.destinations if d.private]

    @property
    def public(self) -> list[Destination]:
        return [d for d in self.destinations if not d.private]

    def permitted_regions(self, data_class: str | None) -> tuple[str, ...]:
        """Regions a data class may run in. Unknown or missing classes fail closed to 'restricted'."""
        if data_class in self.residency:
            return self.residency[data_class]
        return self.residency.get("restricted", tuple({d.region for d in self.private}))


def from_spec(name: str, spec: dict) -> Policy:
    dests = tuple(
        Destination(
            name=d["name"],
            region=d["region"],
            rate_per_hour_inr=float(d.get("ratePerHourINR", 0)),
            private=bool(d.get("private", False)),
        )
        for d in spec["destinations"]
    )
    if not any(d.private for d in dests):
        raise ValueError("policy needs at least one private destination")
    return Policy(
        name=name,
        monthly_ceiling_inr=float(spec["monthlyCeilingINR"]),
        reserve_inr=float(spec.get("reserveINR", 0)),
        slo_latency_ms=float(spec["sloLatencyMs"]),
        destinations=dests,
        residency={k: tuple(v) for k, v in spec.get("residency", {}).items()},
        min_lease_hours=float(spec.get("minLeaseHours", 1.0)),
        rtt_multiplier=float(spec.get("rttMultiplier", 2.0)),
        billing_period_hours=spec.get("billingPeriodHours"),
    )


def load_file(path: str | Path) -> Policy:
    doc = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return from_spec(doc["metadata"]["name"], doc["spec"])


def load_cluster(name: str, namespace: str = "default") -> Policy:
    from kubernetes import client

    obj = client.CustomObjectsApi().get_namespaced_custom_object(GROUP, VERSION, namespace, PLURAL, name)
    return from_spec(name, obj["spec"])
