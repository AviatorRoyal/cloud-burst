"""Per-run metrics from the request log, controller events and node labels.

Metrics (as defined in Review 1):
  attainment            share of ALL requests that succeeded within the SLO (failures count as misses)
  spend_inr             shadow-priced public spend at the end of the run
  attainment_per_100inr attainment points per INR 100 spent (undefined when nothing was spent)
  rejected_no_dest      failed/late requests of a workload while the controller reported that no
                        permissible public destination existed for it (residency or latency)
  residency_violations  restricted requests served by a node outside the permitted regions
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

NO_DEST_REASONS = {"residency", "latency", "no-public-destination"}
WORKLOAD_SERVICE = {"p11-app/records": "records", "p11-app/lms": "lms", "p11-app/static": "static"}


def read_requests(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return [{"ts": float(r["ts"]), "service": r["service"], "data_class": r["data_class"],
                 "latency_ms": float(r["latency_ms"]), "ok": r["ok"] == "1", "node": r["node"]}
                for r in csv.DictReader(f)]


def read_events(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    v = sorted(values)
    i = min(len(v) - 1, max(0, round(q / 100 * (len(v) - 1))))
    return v[i]


def no_dest_windows(events: list[dict], interval_s: float) -> dict[str, list[tuple[float, float]]]:
    """Time windows per service during which the controller found no permissible destination."""
    out: dict[str, list[tuple[float, float]]] = {}
    for e in events:
        for workload, reason in e.get("rejections", []):
            if reason in NO_DEST_REASONS and workload in WORKLOAD_SERVICE:
                out.setdefault(WORKLOAD_SERVICE[workload], []).append((e["ts"] - interval_s, e["ts"] + interval_s))
    return out


def node_hours(events: list[dict]) -> float:
    total = 0.0
    for a, b in zip(events, events[1:]):
        total += len(a.get("active", [])) * (b["ts"] - a["ts"]) / 3600
    return total


def summarize(requests: list[dict], events: list[dict], node_regions: dict[str, str],
              slo_ms: float = 300, permitted_restricted: tuple[str, ...] = ("IN",), interval_s: float = 15) -> dict:
    n = len(requests)
    good = sum(1 for r in requests if r["ok"] and r["latency_ms"] <= slo_ms)
    failed = sum(1 for r in requests if not r["ok"])
    attainment = 100 * good / n if n else 0.0
    spend = events[-1]["spent_inr"] if events else 0.0
    windows = no_dest_windows(events, interval_s)
    rejected = sum(1 for r in requests
                   if not (r["ok"] and r["latency_ms"] <= slo_ms)
                   and any(a <= r["ts"] <= b for a, b in windows.get(r["service"], [])))
    violations = sum(1 for r in requests if r["data_class"] == "restricted" and r["ok"]
                     and node_regions.get(r["node"], "IN") not in permitted_restricted)
    by_class = {}
    for cls in ("restricted", "internal", "public"):
        rs = [r for r in requests if r["data_class"] == cls]
        by_class[f"attainment_{cls}"] = round(100 * sum(1 for r in rs if r["ok"] and r["latency_ms"] <= slo_ms) / len(rs), 2) if rs else None
    return {
        "requests": n,
        "attainment": round(attainment, 2),
        "p95_ms": percentile([r["latency_ms"] for r in requests if r["ok"]], 95),
        "failed": failed,
        "rejected_no_dest": rejected,
        "residency_violations": violations,
        "spend_inr": round(spend, 2),
        "ceiling_inr": events[-1]["ceiling_inr"] if events else None,
        "ceiling_breached": bool(events and spend > events[-1]["ceiling_inr"]),
        "public_node_hours": round(node_hours(events), 3),
        "attainment_per_100inr": round(100 * attainment / spend, 2) if spend > 0 else None,
        **by_class,
    }


def node_regions_from_json(path: Path) -> dict[str, str]:
    """Map node name -> p11.burst/region from `kubectl get nodes -o json`."""
    if not path.exists():
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    return {n["metadata"]["name"]: n["metadata"].get("labels", {}).get("p11.burst/region", "?") for n in doc["items"]}


def summarize_run(run_dir: Path, slo_ms: float = 300, interval_s: float = 15) -> dict:
    run_dir = Path(run_dir)
    return summarize(read_requests(run_dir / "requests.csv"), read_events(run_dir / "events.jsonl"),
                     node_regions_from_json(run_dir / "nodes.json"), slo_ms=slo_ms, interval_s=interval_s)


if __name__ == "__main__":
    import sys
    print(json.dumps(summarize_run(Path(sys.argv[1])), indent=2))
