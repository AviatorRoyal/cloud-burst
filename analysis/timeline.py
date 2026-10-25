"""Per-bin timeline of a run from its request logs: offered requests, SLO attainment and p95 latency.

    python analysis/timeline.py results/testbed/runs/B1_m2_d180_s0.3_r1 [--bin 15] [--slo 300]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analysis.metrics import percentile, read_events, read_run_requests  # noqa: E402


def timeline(run_dir: Path, bin_s: float = 15, slo_ms: float = 300) -> list[dict]:
    reqs = read_run_requests(run_dir)
    if not reqs:
        return []
    t0 = reqs[0]["ts"]
    bins: dict[int, list[dict]] = {}
    for r in reqs:
        bins.setdefault(int((r["ts"] - t0) // bin_s), []).append(r)
    events = read_events(Path(run_dir) / "events.jsonl")
    out = []
    for b in range(max(bins) + 1):
        rs = bins.get(b, [])
        t = b * bin_s
        active = [e for e in events if e["ts"] - t0 <= t]
        out.append({
            "t": t,
            "requests": len(rs),
            "attainment": round(100 * sum(1 for r in rs if r["ok"] and r["latency_ms"] <= slo_ms) / len(rs), 2) if rs else None,
            "p95_ms": percentile([r["latency_ms"] for r in rs if r["ok"]], 95),
            "public_nodes": len(active[-1]["active"]) if active else 0,
            "spent_inr": active[-1]["spent_inr"] if active else 0.0,
        })
    return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("run_dir")
    p.add_argument("--bin", type=float, default=15)
    p.add_argument("--slo", type=float, default=300)
    a = p.parse_args()
    print(json.dumps(timeline(Path(a.run_dir), a.bin, a.slo)))
