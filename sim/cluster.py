"""Trace-driven simulation of the testbed, driving the real PolicyBurst decision code.

The controller logic (Decider, CostMeter, feasibility filters, BurstPolicy) is imported unchanged
from policyburst/; only the cluster around it is modelled, at 1-second resolution:

- Nodes: CPU cores and pod slots per destination (private pool, pub-in, pub-sg, pub-us).
- Pods: 250m request, 500m limit; each request costs 15 ms CPU (the sample app's WORK_MS), so a
  pod serves at most ~33 req/s and a node at most cores/0.015 req/s.
- HPA: 15 s sync, 60% CPU target, scale-up limited to max(+4, x2) per sync, 300 s scale-down
  stabilisation, 1..30 replicas.
- Scheduler: pending pods go to the allowed, schedulable destination with the most free slots
  (LeastAllocated); startup 3-5 s, plus a one-off image pull on a public node.
- Requests: Poisson arrivals at 2 req/s per Locust user, split by data class, spread evenly over
  ready pods (kube-proxy). Latency = network penalty + M/M/1-style service time + fluid queue
  wait, with log-normal noise; requests waiting longer than the 5 s client timeout fail.
- Network: public requests pay rtt_multiplier x RTT; RTT probes are noisy.

What it cannot capture is listed in the Review 2 threats-to-validity slide.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from policyburst.cost import CostMeter
from policyburst.decision import Decider, Observation, Thresholds, Workload
from policyburst.feasibility import Constraints
from policyburst.policy import Policy

CPU_PER_REQ_S = 0.015
POD_LIMIT_CORES = 0.5
POD_REQUEST_CORES = 0.25
POD_MAX_RPS = POD_LIMIT_CORES / CPU_PER_REQ_S
REQ_PER_USER_S = 2.0
MAX_REPLICAS = 30
TIMEOUT_MS = 5000
NS = "p11-app"
DEPLOYS = {"records": "restricted", "lms": "internal", "static": "public"}


@dataclass(frozen=True)
class DestSpec:
    cores: float
    pod_slots: int
    rtt_ms: float          # private: ingress-to-pod; public: round trip over the overlay
    region: str


TESTBED = {
    # 3 private VMs (4 + 2 + 2 vCPU), ~1 core held back for k3s, Prometheus and the controller
    "private": DestSpec(cores=7.0, pod_slots=28, rtt_ms=0.6, region="IN"),
    # Oracle Always Free Ampere A1 (4 OCPU) in Hyderabad, campus -> Hyderabad over Tailscale
    "pub-in": DestSpec(cores=4.0, pod_slots=14, rtt_ms=28.0, region="IN"),
    # emulated foreign regions: same VM class + netem delay
    "pub-sg": DestSpec(cores=4.0, pod_slots=14, rtt_ms=28.0 + 40.0, region="non-IN"),
    "pub-us": DestSpec(cores=4.0, pod_slots=14, rtt_ms=28.0 + 120.0, region="non-IN"),
}


@dataclass
class Pod:
    deploy: str
    dest: str | None = None
    ready_at: float | None = None   # None while pending

    def ready(self, t: float) -> bool:
        return self.dest is not None and self.ready_at is not None and t >= self.ready_at


@dataclass
class Counters:
    requests: int = 0
    good: int = 0
    failed: int = 0
    rejected_no_dest: int = 0
    residency_violations: int = 0
    lat_hist: np.ndarray = field(default_factory=lambda: np.zeros(1201, dtype=np.int64))  # 5 ms bins to 6 s
    by_class: dict = field(default_factory=lambda: {c: [0, 0] for c in DEPLOYS.values()})  # [good, total]


@dataclass
class SimConfig:
    mode: str = "policyburst"
    disable: tuple[str, ...] = ()
    users: callable = None          # t -> users or None (end)
    restricted_share: float = 0.3
    interval_s: float = 15
    thresholds: Thresholds = Thresholds(burst_after_s=30, idle_after_s=120)
    seed: int = 0
    testbed: dict = None


class Simulation:
    def __init__(self, policy: Policy, cfg: SimConfig):
        self.policy = policy
        self.cfg = cfg
        self.bed = cfg.testbed or TESTBED
        self.rng = np.random.default_rng(cfg.seed)
        self.t0 = 1_800_000_000.0
        self.t = 0.0
        self.meter = CostMeter(clock=lambda: self.t0 + self.t)
        self.decider = Decider(cfg.mode, Constraints.without(list(cfg.disable)), self.meter,
                               cfg.thresholds, cfg.interval_s)
        self.pods = [Pod(d, "private", 0.0) for d in DEPLOYS]
        self.active: set[str] = set()
        self.pulled: set[str] = {"private"}
        self.allowed = {d: {"private", *TESTBED} for d in DEPLOYS}
        self.backlog = {}  # (deploy, dest) -> queued requests
        self.hpa_hist = {d: [] for d in DEPLOYS}  # (t, desired)
        self.no_dest = {d: False for d in DEPLOYS}
        self.rtts: dict[str, float | None] = {}
        self.last_util = {k: 0.0 for k in self.bed}
        self.resp_ms = {d: 20.0 for d in DEPLOYS}  # last second's mean response time per service
        self.c = Counters()
        self.events: list[dict] = []
        self.timeline: list[dict] = []
        self.shares = {"records": cfg.restricted_share, "lms": (1 - cfg.restricted_share) / 2,
                       "static": (1 - cfg.restricted_share) / 2}

    # ---------- cluster mechanics ----------

    def slots_free(self, dest: str) -> int:
        return self.bed[dest].pod_slots - sum(1 for p in self.pods if p.dest == dest)

    def schedulable(self, dest: str) -> bool:
        return dest == "private" or dest in self.active

    def schedule(self):
        for p in self.pods:
            if p.dest is not None:
                continue
            cands = [d for d in self.bed if d in self.allowed[p.deploy] and self.schedulable(d) and self.slots_free(d) > 0]
            if not cands:
                continue
            d = max(cands, key=lambda k: self.slots_free(k) / self.bed[k].pod_slots)
            pull = 0.0 if d in self.pulled else self.rng.uniform(15, 25)
            self.pulled.add(d)
            p.dest, p.ready_at = d, self.t + pull + self.rng.uniform(3, 5)

    def evict(self, pred):
        for p in self.pods:
            if p.dest is not None and pred(p):
                p.dest, p.ready_at = None, None

    def hpa(self, demand_rps: dict[str, float]):
        for d in DEPLOYS:
            mine = [p for p in self.pods if p.deploy == d]
            ready = [p for p in mine if p.ready(self.t)]
            if not ready:
                continue
            util = demand_rps[d] * CPU_PER_REQ_S / (len(ready) * POD_REQUEST_CORES)
            desired = min(MAX_REPLICAS, max(1, math.ceil(len(ready) * util / 0.60)))
            hist = self.hpa_hist[d]
            hist.append((self.t, desired))
            hist[:] = [(t, v) for t, v in hist if self.t - t <= 300]
            cur = len(mine)
            if desired > cur:
                target = min(desired, max(cur + 4, 2 * cur))
                self.pods += [Pod(d) for _ in range(target - cur)]
            else:
                target = max(v for _, v in hist)  # scale-down stabilisation window
                for _ in range(cur - target):
                    # ReplicaSet removes unscheduled, then not-ready, then public pods first
                    victims = sorted((p for p in self.pods if p.deploy == d),
                                     key=lambda p: (p.dest is not None, p.ready(self.t), p.dest == "private"))
                    self.pods.remove(victims[0])

    # ---------- controller ----------

    def probe(self):
        self.rtts = {d: self.bed[d].rtt_ms * self.rng.lognormal(0, 0.05) for d in self.bed if d != "private"}

    def control(self):
        if int(self.t) % 60 == 0 or not self.rtts:
            self.probe()
        workloads = [Workload(NS, d, cls, pending=sum(1 for p in self.pods if p.deploy == d and p.dest is None))
                     for d, cls in DEPLOYS.items()]
        for d in self.policy.public:
            (self.meter.start(d) if d.name in self.active else self.meter.stop(d.name))
        free_slots = self.slots_free("private")
        obs = Observation(now=self.t0 + self.t, workloads=workloads, private_util=self.last_util["private"],
                          active=set(self.active), rtts=dict(self.rtts), service_ms=20.0,
                          private_free_cpu=free_slots * POD_REQUEST_CORES,
                          dest_requested_cpu={d: POD_REQUEST_CORES * sum(1 for p in self.pods if p.dest == d)
                                              for d in self.bed if d != "private"})
        plan = self.decider.decide(self.policy, obs)
        for key, dests in plan.allowed.items():
            d = key.split("/")[1]
            if set(dests) != self.allowed[d]:
                self.allowed[d] = set(dests)
                self.evict(lambda p, d=d: p.deploy == d and p.dest not in self.allowed[d])
        for name in plan.deactivate:
            self.active.discard(name)
            self.meter.stop(name)
            self.evict(lambda p, n=name: p.dest == n)
        for name in plan.activate:
            self.active.add(name)
            self.meter.start(self.policy.destination(name))
        self.no_dest = {d: False for d in DEPLOYS}
        for key, reason in plan.rejections:
            if reason in ("residency", "latency", "budget", "no-public-destination"):
                self.no_dest[key.split("/")[1]] = True
        self.events.append({"ts": round(self.t0 + self.t, 3), "t": self.t, "spent_inr": round(self.meter.total_inr(), 4),
                            "ceiling_inr": self.policy.monthly_ceiling_inr, "active": sorted(self.active),
                            "private_util": round(self.last_util["private"], 3),
                            "pending": {w.name: w.pending for w in workloads if w.pending},
                            "activate": plan.activate, "deactivate": plan.deactivate,
                            "rejections": plan.rejections, "notes": plan.notes})

    # ---------- traffic ----------

    def serve(self, users: int) -> dict[str, float]:
        # Closed loop, as in Locust: a user sends its next request only after the previous
        # response (or 5 s timeout), so offered load falls as latency rises.
        demand = {d: users * s * min(REQ_PER_USER_S, 1000 / min(self.resp_ms[d], TIMEOUT_MS))
                  for d, s in self.shares.items()}
        ready = [p for p in self.pods if p.ready(self.t)]
        # CPU demand per node, capped by pod limits; node saturation slows every pod on it
        node_load = {k: 0.0 for k in self.bed}
        per_pod = {}
        for d in DEPLOYS:
            mine = [p for p in ready if p.deploy == d]
            per_pod[d] = demand[d] / len(mine) if mine else 0.0
            for p in mine:
                node_load[p.dest] += min(per_pod[d], POD_MAX_RPS) * CPU_PER_REQ_S
        node_factor = {k: min(1.0, self.bed[k].cores / v) if v > 0 else 1.0 for k, v in node_load.items()}
        self.last_util = {k: min(1.0, v / self.bed[k].cores) for k, v in node_load.items()}

        for d, cls in DEPLOYS.items():
            lat_sum, lat_n = 0.0, 0
            n_arr = self.rng.poisson(demand[d])
            mine = [p for p in ready if p.deploy == d]
            self.c.requests += n_arr
            self.c.by_class[cls][1] += n_arr
            if not mine:
                self.resp_ms[d] = TIMEOUT_MS
                self.c.failed += n_arr
                if self.no_dest[d]:
                    self.c.rejected_no_dest += n_arr
                continue
            groups: dict[str, int] = {}
            for p in mine:
                groups[p.dest] = groups.get(p.dest, 0) + 1
            split = self.rng.multinomial(n_arr, [n / len(mine) for n in groups.values()])
            for (dest, n_pods), arrivals in zip(groups.items(), split):
                # Pod limit, or this group's share of a saturated node's cores (CFS shares by demand)
                cap = n_pods * (POD_MAX_RPS if node_factor[dest] >= 1 else min(per_pod[d], POD_MAX_RPS) * node_factor[dest])
                cap = max(cap, 1e-6)
                key = (d, dest)
                q = max(0.0, self.backlog.get(key, 0.0) + arrivals - cap)
                q_max = cap * TIMEOUT_MS / 1000
                dropped = int(max(0.0, q - q_max))
                q = min(q, q_max)
                self.backlog[key] = q
                served = arrivals - dropped
                rho = min(0.95, (arrivals / cap) if cap else 0.95)
                net = public_net_ms(self.bed[dest], self.policy.rtt_multiplier, self.rng) if dest != "private" else self.bed[dest].rtt_ms
                mean = net + CPU_PER_REQ_S * 1000 / (1 - rho) + 1000 * q / cap + 2.0  # +2 ms client->ingress
                lat = mean * self.rng.lognormal(0, 0.25, served) if served else np.empty(0)
                spikes = self.rng.random(served) < 0.004  # retransmits, CFS throttling, GC pauses
                lat[spikes] += self.rng.exponential(250, int(spikes.sum()))
                late_fail = int((lat > TIMEOUT_MS).sum())
                good = int((lat <= self.policy.slo_latency_ms).sum())
                failed = dropped + late_fail
                self.c.good += good
                self.c.failed += failed
                self.c.by_class[cls][0] += good
                lat_sum += float(np.minimum(lat, TIMEOUT_MS).sum()) + TIMEOUT_MS * dropped
                lat_n += served + dropped
                np.add.at(self.c.lat_hist, np.minimum((lat[lat <= TIMEOUT_MS] / 5).astype(int), 1200), 1)
                if self.no_dest[d]:
                    self.c.rejected_no_dest += arrivals - good
                if cls == "restricted" and self.bed[dest].region not in self.policy.permitted_regions("restricted"):
                    self.c.residency_violations += served - late_fail
            if lat_n:
                self.resp_ms[d] = lat_sum / lat_n
        return demand

    # ---------- main loop ----------

    def run(self) -> dict:
        demand = {d: 0.0 for d in DEPLOYS}
        while True:
            users = self.cfg.users(self.t)
            if users is None:
                break
            if self.t % self.cfg.interval_s == 0:
                self.control()
            if self.t % 15 == 7:
                self.hpa(demand)
            self.schedule()
            demand = self.serve(users)
            if self.t % 5 == 0:
                self.timeline.append({"t": self.t, "users": users, "active": len(self.active),
                                      "pods": len(self.pods), "pending": sum(p.dest is None for p in self.pods),
                                      "spent": round(self.meter.total_inr(), 3)})
            self.t += 1
        self.control()
        return self.summary()

    def summary(self) -> dict:
        c = self.c
        att = 100 * c.good / c.requests if c.requests else 0.0
        spend = self.meter.total_inr()
        cum = np.cumsum(c.lat_hist)
        p95 = float(np.searchsorted(cum, 0.95 * cum[-1]) * 5) if cum[-1] else None
        node_h = sum(len(a["active"]) * (b["t"] - a["t"]) / 3600 for a, b in zip(self.events, self.events[1:]))
        return {
            "requests": int(c.requests), "attainment": round(att, 2), "p95_ms": p95, "failed": int(c.failed),
            "rejected_no_dest": int(c.rejected_no_dest), "residency_violations": int(c.residency_violations),
            "spend_inr": round(spend, 2), "ceiling_inr": self.policy.monthly_ceiling_inr,
            "ceiling_breached": spend > self.policy.monthly_ceiling_inr,
            "public_node_hours": round(node_h, 3),
            "attainment_per_100inr": round(100 * att / spend, 2) if spend > 0 else None,
            **{f"attainment_{cls}": round(100 * g / n, 2) if n else None for cls, (g, n) in c.by_class.items()},
        }


def public_net_ms(spec: DestSpec, mult: float, rng) -> float:
    """Extra latency for a request forwarded from the private ingress to a public node."""
    return mult * spec.rtt_ms * rng.uniform(0.9, 1.1)
