"""Reads cluster state into an Observation: pending pods, private CPU, active destinations, RTTs."""
from __future__ import annotations

import socket
import statistics
import time

from kubernetes import client

from .decision import Observation, Workload
from .policy import Policy

DEST_LABEL = "p11.burst/destination"
CLASS_LABEL = "p11.burst/data-class"
MANAGED = "p11.burst/managed=true"


def parse_cpu(q: str) -> float:
    """Kubernetes CPU quantity -> cores."""
    units = {"n": 1e-9, "u": 1e-6, "m": 1e-3}
    return float(q[:-1]) * units[q[-1]] if q[-1] in units else float(q)


def node_ip(node) -> str | None:
    for a in node.status.addresses or []:
        if a.type == "InternalIP":
            return a.address
    return None


def node_ready(node) -> bool:
    return any(c.type == "Ready" and c.status == "True" for c in node.status.conditions or [])


def probe_rtt_ms(host: str, port: int = 10250, tries: int = 3, timeout: float = 1.0) -> float | None:
    """Median TCP connect time to the node's kubelet port; None if unreachable."""
    samples = []
    for _ in range(tries):
        t0 = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=timeout):
                samples.append((time.perf_counter() - t0) * 1000)
        except OSError:
            pass
    return statistics.median(samples) if samples else None


class ClusterReader:
    def __init__(self, service_ms: float = 20.0, probe_every_s: float = 60.0):
        self.core = client.CoreV1Api()
        self.apps = client.AppsV1Api()
        self.custom = client.CustomObjectsApi()
        self.service_ms = service_ms
        self.probe_every_s = probe_every_s
        self._rtts: dict[str, float | None] = {}
        self._probed_at = float("-inf")

    def nodes_by_dest(self) -> dict[str, list]:
        out: dict[str, list] = {}
        for n in self.core.list_node().items:
            dest = (n.metadata.labels or {}).get(DEST_LABEL)
            if dest:
                out.setdefault(dest, []).append(n)
        return out

    def workloads(self) -> list[tuple[Workload, object]]:
        out = []
        for d in self.apps.list_deployment_for_all_namespaces(label_selector=MANAGED).items:
            sel = ",".join(f"{k}={v}" for k, v in (d.spec.selector.match_labels or {}).items())
            pods = self.core.list_namespaced_pod(d.metadata.namespace, label_selector=sel).items
            pending = sum(1 for p in pods if p.status.phase == "Pending" and any(
                c.type == "PodScheduled" and c.reason == "Unschedulable" for c in p.status.conditions or []))
            ready = sum(1 for p in pods if any(
                c.type == "Ready" and c.status == "True" for c in p.status.conditions or []))
            cls = (d.metadata.labels or {}).get(CLASS_LABEL)
            out.append((Workload(d.metadata.namespace, d.metadata.name, cls, pending, ready), d))
        return out

    def private_util(self, policy: Policy, nodes: dict[str, list]) -> float | None:
        private = [n for d in policy.private for n in nodes.get(d.name, [])]
        if not private:
            return None
        try:
            usage = {m["metadata"]["name"]: parse_cpu(m["usage"]["cpu"])
                     for m in self.custom.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes")["items"]}
        except client.ApiException:
            return None
        ratios = [usage[n.metadata.name] / parse_cpu(n.status.allocatable["cpu"])
                  for n in private if n.metadata.name in usage]
        return sum(ratios) / len(ratios) if ratios else None

    def rtts(self, policy: Policy, nodes: dict[str, list], now: float) -> dict[str, float | None]:
        if now - self._probed_at >= self.probe_every_s:
            for d in policy.public:
                vals = [r for n in nodes.get(d.name, []) if (ip := node_ip(n)) and (r := probe_rtt_ms(ip)) is not None]
                self._rtts[d.name] = min(vals) if vals else None
            self._probed_at = now
        return dict(self._rtts)

    def observe(self, policy: Policy) -> tuple[Observation, dict[str, list], dict[str, object]]:
        now = time.time()
        nodes = self.nodes_by_dest()
        wl = self.workloads()
        active = {d.name for d in policy.public
                  if any(not n.spec.unschedulable and node_ready(n) for n in nodes.get(d.name, []))}
        obs = Observation(now=now, workloads=[w for w, _ in wl], private_util=self.private_util(policy, nodes),
                          active=active, rtts=self.rtts(policy, nodes, now), service_ms=self.service_ms)
        return obs, nodes, {w.key: d for w, d in wl}
