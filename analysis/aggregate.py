"""Aggregates a summary.csv (simulated or measured) into the tables used by the review decks.

    python analysis/aggregate.py results/sim/summary.csv results/sim/aggregate.json

Every value is mean and 95% half-interval (t-distribution, n = repetitions).
"""
from __future__ import annotations

import csv
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

T95 = {1: 0.0, 2: 12.71, 3: 4.30, 4: 3.18, 5: 2.78}


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return {"True": 1.0, "False": 0.0}.get(x)


def same(a, b) -> bool:
    """Equal as numbers when both parse (so 2, 2.0 and "2" match), else as strings."""
    na, nb = num(a), num(b)
    return na == nb if na is not None and nb is not None else a == b


def stat(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    m = statistics.fmean(vals)
    ci = T95.get(len(vals), 1.96) * statistics.stdev(vals) / len(vals) ** 0.5 if len(vals) > 1 else 0.0
    return {"mean": round(m, 3), "ci": round(ci, 3), "n": len(vals)}


def table(rows, where, by, metrics):
    g = defaultdict(list)
    for r in rows:
        if all(same(r.get(k), v) for k, v in where.items()):
            g[tuple(r[k] for k in by)].append(r)
    return [{**dict(zip(by, k)), **{m: stat([num(r[m]) for r in rs]) for m in metrics}} for k, rs in sorted(g.items(), key=lambda kv: [num(x) if num(x) is not None else x for x in kv[0]])]


METRICS = ["attainment", "p95_ms", "failed", "requests", "rejected_no_dest", "residency_violations", "spend_inr",
           "ceiling_breached", "public_node_hours", "attainment_per_100inr", "attainment_restricted",
           "attainment_internal", "attainment_public"]


def main(src: str, dst: str):
    rows = list(csv.DictReader(open(src, newline="")))
    has_set = "set" in rows[0]
    m = {"set": "matrix"} if has_set else {}
    out = {
        "source": src,
        "runs": len(rows),
        "by_magnitude_180s": table(rows, {**m, "duration_s": 180}, ["config", "magnitude"], METRICS),
        "by_duration_2x": table(rows, {**m, "magnitude": 2}, ["config", "duration_s"], METRICS),
        "matrix_overall": table(rows, m, ["config"], METRICS),
    }
    if has_set:
        out["ablation"] = table(rows, {"set": "ablation"}, ["config"], METRICS)
        out["sweep"] = table(rows, {"set": "sweep"}, ["config", "restricted_share"], METRICS)
    Path(dst).write_text(json.dumps(out, indent=1))
    print("wrote", dst)


if __name__ == "__main__":
    main(*sys.argv[1:3])
