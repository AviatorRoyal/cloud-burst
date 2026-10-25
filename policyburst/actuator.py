"""Applies a Plan: cordon/uncordon public nodes and pin each workload to its permitted destinations."""
from __future__ import annotations

import logging

from kubernetes import client

from .signals import DEST_LABEL

PUBLIC_TAINT = "p11.burst/public"
ALLOWED_ANNOTATION = "p11.burst/allowed"
log = logging.getLogger("policyburst.actuator")


class Actuator:
    def __init__(self):
        self.core = client.CoreV1Api()
        self.apps = client.AppsV1Api()

    def set_active(self, nodes: list, active: bool) -> None:
        for n in nodes:
            self.core.patch_node(n.metadata.name, {"spec": {"unschedulable": not active}})
            if not active:
                self._evict_managed(n.metadata.name)

    def _evict_managed(self, node_name: str) -> None:
        pods = self.core.list_pod_for_all_namespaces(field_selector=f"spec.nodeName={node_name}",
                                                     label_selector="p11.burst/managed=true").items
        for p in pods:
            body = client.V1Eviction(metadata=client.V1ObjectMeta(name=p.metadata.name, namespace=p.metadata.namespace))
            try:
                self.core.create_namespaced_pod_eviction(p.metadata.name, p.metadata.namespace, body)
            except client.ApiException as e:  # a PodDisruptionBudget may refuse; retried next cycle
                log.warning("evict %s/%s failed: %s", p.metadata.namespace, p.metadata.name, e.reason)

    def evict_misplaced(self, deployments: dict, allowed: dict[str, list[str]], nodes_by_dest: dict[str, list]) -> int:
        """Placement guard: evict managed pods running on a destination their workload may not use."""
        evicted = 0
        for dest, nodes in nodes_by_dest.items():
            for n in nodes:
                pods = self.core.list_pod_for_all_namespaces(field_selector=f"spec.nodeName={n.metadata.name}",
                                                             label_selector="p11.burst/managed=true").items
                for p in pods:
                    labels = p.metadata.labels or {}
                    for key, d in deployments.items():
                        sel = d.spec.selector.match_labels or {}
                        if d.metadata.namespace == p.metadata.namespace and all(labels.get(k) == v for k, v in sel.items()):
                            if dest not in allowed.get(key, [dest]):
                                body = client.V1Eviction(metadata=client.V1ObjectMeta(name=p.metadata.name, namespace=p.metadata.namespace))
                                try:
                                    self.core.create_namespaced_pod_eviction(p.metadata.name, p.metadata.namespace, body)
                                    evicted += 1
                                    log.warning("evicted misplaced %s/%s from %s", p.metadata.namespace, p.metadata.name, dest)
                                except client.ApiException as e:
                                    log.warning("evict %s failed: %s", p.metadata.name, e.reason)
                            break
        return evicted

    def set_allowed(self, deployment, dests: list[str]) -> bool:
        """Pin a deployment to dests via required node affinity. Patches only on change (a patch rolls pods)."""
        want = ",".join(sorted(dests))
        annotations = deployment.spec.template.metadata.annotations or {}
        if annotations.get(ALLOWED_ANNOTATION) == want:
            return False
        patch = {"spec": {"template": {
            "metadata": {"annotations": {ALLOWED_ANNOTATION: want}},
            "spec": {
                "affinity": {"nodeAffinity": {"requiredDuringSchedulingIgnoredDuringExecution": {
                    "nodeSelectorTerms": [{"matchExpressions": [
                        {"key": DEST_LABEL, "operator": "In", "values": sorted(dests) or ["none"]}]}]}}},
                "tolerations": [{"key": PUBLIC_TAINT, "operator": "Exists", "effect": "NoSchedule"}],
            }}}}
        self.apps.patch_namespaced_deployment(deployment.metadata.name, deployment.metadata.namespace, patch)
        log.info("allowed %s/%s -> %s", deployment.metadata.namespace, deployment.metadata.name, want)
        return True
