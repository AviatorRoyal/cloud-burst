"""Figures for the reviews from results/summary.csv and run event logs.

    python analysis/plots.py                    # writes results/figures/*.png
    python analysis/plots.py --spend-runs results/runs/B1_m4_d180_s0.3_r1 results/runs/PB_m4_d180_s0.3_r1
"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analysis.metrics import read_events  # noqa: E402

COLORS = {"B0": "#5B6675", "B1": "#E9A23B", "PB": "#2A9D8F", "PB-noRes": "#D1495B",
          "PB-noLat": "#4C6A92", "PB-noCost": "#B5761A"}
LABELS = {"B0": "B0 No bursting", "B1": "B1 Threshold-only", "PB": "PB PolicyBurst", "PB-noRes": "PB without residency",
          "PB-noLat": "PB without latency filter", "PB-noCost": "PB without cost accumulator"}


def load(path: Path) -> list[dict]:
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k, v in r.items():
            try:
                r[k] = float(v)
            except (TypeError, ValueError):
                pass
    return rows


def mean_ci(vals: list[float]) -> tuple[float, float]:
    """Mean and 95% half-interval (normal approximation; fine for the 3-rep design, state it as such)."""
    vals = [v for v in vals if isinstance(v, float)]
    if not vals:
        return float("nan"), 0.0
    m = statistics.fmean(vals)
    return m, (1.96 * statistics.stdev(vals) / len(vals) ** 0.5) if len(vals) > 1 else 0.0


def group(rows, keys, metric, **where):
    g = defaultdict(list)
    for r in rows:
        if all(r.get(k) == v for k, v in where.items()):
            g[tuple(r[k] for k in keys)].append(r[metric])
    return {k: mean_ci(v) for k, v in g.items()}


def style(ax, title, xlabel, ylabel):
    ax.set_title(title, fontsize=11)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", color="#E3E8ED")
    ax.set_axisbelow(True)


def attainment_vs_magnitude(rows, out, dur, share):
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    for cfg in ("B0", "B1", "PB"):
        g = group(rows, ["magnitude"], "attainment", config=cfg, duration_s=dur, restricted_share=share)
        if not g:
            continue
        xs = sorted(g)
        ax.errorbar([x[0] for x in xs], [g[x][0] for x in xs], yerr=[g[x][1] for x in xs], marker="o",
                    color=COLORS[cfg], label=LABELS[cfg], capsize=3, linewidth=2)
    style(ax, f"SLO attainment vs burst magnitude ({dur:g} s bursts)", "Burst magnitude (x private capacity)", "SLO attainment (%)")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(out / "attainment_vs_magnitude.png", dpi=200)


def per_inr(rows, out, mag, dur, share, configs, name, title):
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    cs = [c for c in configs if group(rows, ["config"], "attainment_per_100inr", config=c, magnitude=mag, duration_s=dur, restricted_share=share)]
    vals = [group(rows, ["config"], "attainment_per_100inr", config=c, magnitude=mag, duration_s=dur, restricted_share=share)[(c,)] for c in cs]
    ax.bar([LABELS[c] for c in cs], [v[0] for v in vals], yerr=[v[1] for v in vals], color=[COLORS[c] for c in cs], capsize=4)
    for i, v in enumerate(vals):
        ax.text(i, v[0], f"{v[0]:.1f}", ha="center", va="bottom")
    style(ax, title, "", "SLO attainment points per INR 100")
    plt.setp(ax.get_xticklabels(), rotation=12)
    fig.tight_layout()
    fig.savefig(out / name, dpi=200)


def residency_sweep(rows, out, mag, dur):
    on = group(rows, ["restricted_share"], "attainment", config="PB", magnitude=mag, duration_s=dur)
    off = group(rows, ["restricted_share"], "attainment", config="PB-noRes", magnitude=mag, duration_s=dur)
    shares = sorted(set(on) & set(off))
    if not shares:
        return
    rej = group(rows, ["restricted_share"], "rejected_no_dest", config="PB", magnitude=mag, duration_s=dur)
    reqs = group(rows, ["restricted_share"], "requests", config="PB", magnitude=mag, duration_s=dur)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
    xs = [100 * s[0] for s in shares]
    a1.plot(xs, [off[s][0] - on[s][0] for s in shares], marker="o", color=COLORS["PB"], linewidth=2)
    style(a1, "Attainment penalty of residency (PB-noRes minus PB)", "Restricted traffic share (%)", "Penalty (percentage points)")
    a2.bar([f"{x:g}%" for x in xs], [100 * rej[s][0] / reqs[s][0] for s in shares], color=COLORS["PB-noRes"])
    style(a2, "Requests rejected: no permissible destination", "Restricted traffic share (%)", "% of requests")
    fig.tight_layout()
    fig.savefig(out / "residency_sweep.png", dpi=200)


def spend_over_time(run_dirs, out):
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ceiling = None
    for d in run_dirs:
        ev = read_events(Path(d) / "events.jsonl")
        if not ev:
            continue
        cfg = Path(d).name.split("_")[0]
        t0 = ev[0]["ts"]
        ax.plot([(e["ts"] - t0) / 60 for e in ev], [e["spent_inr"] for e in ev], color=COLORS.get(cfg), label=LABELS.get(cfg, cfg), linewidth=2)
        ceiling = ev[-1]["ceiling_inr"]
    if ceiling is not None:
        ax.axhline(ceiling, color="#D1495B", linestyle="--", label=f"Ceiling (INR {ceiling:g})")
    style(ax, "Cumulative spend (shadow-priced)", "Minutes into run", "INR")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(out / "spend_over_time.png", dpi=200)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--summary", default=str(ROOT / "results" / "summary.csv"))
    p.add_argument("--out", default=str(ROOT / "results" / "figures"))
    p.add_argument("--mag", type=float, default=4)
    p.add_argument("--dur", type=float, default=180)
    p.add_argument("--share", type=float, default=0.3)
    p.add_argument("--spend-runs", nargs="*", default=[])
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = load(Path(a.summary)) if Path(a.summary).exists() else []
    if rows:
        attainment_vs_magnitude(rows, out, a.dur, a.share)
        per_inr(rows, out, a.mag, a.dur, a.share, ["B1", "PB"], "attainment_per_inr.png", "Attainment per INR 100 (B0 spends nothing)")
        per_inr(rows, out, a.mag, a.dur, a.share, ["PB", "PB-noCost", "PB-noLat", "PB-noRes"], "ablation.png", "Ablation: one constraint removed at a time")
        residency_sweep(rows, out, a.mag, a.dur)
    if a.spend_runs:
        spend_over_time(a.spend_runs, out)
    print("figures in", out)


if __name__ == "__main__":
    main()
