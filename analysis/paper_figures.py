"""Figures for the research paper, drawn from results/sim and results/testbed.

    python analysis/paper_figures.py            # writes paper/figures/*.png
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "paper" / "figures"
SIM = json.loads((ROOT / "results/sim/aggregate.json").read_text())
BED_PATH = ROOT / "results/testbed/aggregate.json"
BED = json.loads(BED_PATH.read_text()) if BED_PATH.exists() else None

C = {"B0": "#5B6675", "B1": "#E9A23B", "PB": "#2A9D8F", "PB-noRes": "#D1495B", "PB-noLat": "#4C6A92", "PB-noCost": "#B5761A"}
NAME = {"B0": "B0 no bursting", "B1": "B1 threshold-only", "PB": "PolicyBurst", "PB-noRes": "PB without residency",
        "PB-noLat": "PB without latency filter", "PB-noCost": "PB without cost accumulator"}
MAGS = [1.5, 2, 2.5, 3, 4]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.titlesize": 10, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.grid": True, "grid.color": "#E3E8ED", "axes.axisbelow": True,
                     "legend.frameon": False, "savefig.dpi": 220, "savefig.bbox": "tight"})


def val(table, where, metric, field="mean"):
    for r in table:
        if all(str(r[k]) == str(v) or (_num(r[k]) is not None and _num(r[k]) == _num(v)) for k, v in where.items()):
            return r[metric][field] if r.get(metric) else None
    return None


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / name)
    plt.close(fig)
    print("wrote", OUT / name)


def box(ax, x, y, w, h, text, fc, ec="#12263A", fs=8.5, bold=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08", fc=fc, ec=ec, lw=1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, weight="bold" if bold else "normal", wrap=True)


def arrow(ax, a, b, color="#12263A"):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=12, color=color, lw=1.2))


def fig_architecture():
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.add_patch(FancyBboxPatch((0.2, 0.3), 5.0, 6.4, boxstyle="round,pad=0.02", fc="#DDF1EE", ec="#2A9D8F"))
    ax.text(2.7, 6.4, "Private cluster (region IN)", ha="center", weight="bold", color="#2A9D8F")
    box(ax, 0.6, 5.0, 4.2, 0.9, "BurstPolicy CRD\nceiling · SLO · regions · prices", "white")
    box(ax, 0.6, 3.4, 4.2, 1.2, "PolicyBurst controller\nobserve → residency → latency\n→ budget → act", "#12263A", fs=8.5)
    ax.texts[-1].set_color("white")
    box(ax, 0.6, 2.0, 2.0, 1.0, "metrics-server\n+ HPA", "white")
    box(ax, 2.8, 2.0, 2.0, 1.0, "App: records /\nlms / static", "white")
    box(ax, 0.6, 0.6, 4.2, 1.0, "private nodes\nserver-0 · agent-0", "white")
    arrow(ax, (2.7, 5.0), (2.7, 4.6))
    arrow(ax, (1.6, 3.0), (1.6, 3.4))
    ax.add_patch(FancyBboxPatch((6.6, 0.3), 5.2, 6.4, boxstyle="round,pad=0.02", fc="#FCEFD9", ec="#E9A23B"))
    ax.text(9.2, 6.4, "Public overflow pool (tainted, cordoned)", ha="center", weight="bold", color="#B5761A")
    for i, (n, d) in enumerate([("pub-in", "region IN · ₹1.8/h · +0 ms"), ("pub-sg", "region non-IN · ₹1.4/h · +40 ms"),
                                ("pub-us", "region non-IN · ₹1.0/h · +120 ms")]):
        box(ax, 7.0, 4.6 - i * 1.6, 4.4, 1.1, f"{n}\n{d}", "white")
    arrow(ax, (4.8, 4.0), (7.0, 5.15))
    arrow(ax, (4.8, 4.0), (7.0, 3.55))
    arrow(ax, (4.8, 4.0), (7.0, 1.95))
    ax.text(5.9, 1.0, "uncordon /\ncordon +\nnode affinity", ha="center", fontsize=7.5, color="#5B6675")
    save(fig, "fig1_architecture.png")


def fig_calibration():
    fig, ax = plt.subplots(figsize=(6.2, 3.0))
    for path, label, col in ((ROOT / "results/sim/calibration.csv", "Simulation (7-core private pool)", "#4C6A92"),
                             (ROOT / "results/testbed/calibration.csv", "Testbed (2 × 2-vCPU private nodes)", "#12263A")):
        if path.exists():
            rows = list(csv.DictReader(open(path)))
            ax.plot([int(r["users"]) for r in rows], [float(r["attainment"]) for r in rows], marker="o", ms=3.5, label=label, color=col)
    ax.axhline(95, ls="--", color="#D1495B", lw=1)
    ax.text(20, 96.5, "95% capacity threshold", color="#D1495B", fontsize=8)
    ax.set_xlabel("Concurrent Locust users (2 req/s each)")
    ax.set_ylabel("SLO attainment (%)")
    ax.set_ylim(0, 102)
    ax.legend(loc="lower left")
    ax.set_title("Capacity calibration without bursting")
    save(fig, "fig_calibration.png")


def fig_attainment():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 3.0))
    for c in ("B0", "B1", "PB"):
        m = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": x}, "attainment") for x in MAGS]
        e = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": x}, "attainment", "ci") for x in MAGS]
        a1.errorbar(MAGS, m, yerr=e, marker="o", ms=4, capsize=3, color=C[c], label=NAME[c])
    a1.set_xlabel("Burst size (× private capacity)")
    a1.set_ylabel("SLO attainment (%)")
    a1.set_ylim(0, 100)
    a1.legend(fontsize=7.5)
    a1.set_title("(a) Attainment, 180 s bursts")
    w = 0.36
    for k, c in enumerate(("B1", "PB")):
        m = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": x}, "attainment_per_100inr") for x in MAGS]
        e = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": x}, "attainment_per_100inr", "ci") for x in MAGS]
        a2.bar([i + (k - 0.5) * w for i in range(len(MAGS))], m, w, yerr=e, capsize=2, color=C[c], label=NAME[c])
    a2.set_xticks(range(len(MAGS)), [f"{x}×" for x in MAGS])
    a2.set_xlabel("Burst size")
    a2.set_ylabel("Attainment points per ₹100")
    a2.legend(fontsize=7.5)
    a2.set_title("(b) Attainment per unit spend")
    fig.tight_layout()
    save(fig, "fig_attainment.png")


def fig_duration():
    fig, ax = plt.subplots(figsize=(6.2, 2.8))
    durs = [60, 180, 300]
    w = 0.26
    for k, c in enumerate(("B0", "B1", "PB")):
        m = [val(SIM["by_duration_2x"], {"config": c, "duration_s": d}, "attainment") for d in durs]
        e = [val(SIM["by_duration_2x"], {"config": c, "duration_s": d}, "attainment", "ci") for d in durs]
        ax.bar([i + (k - 1) * w for i in range(3)], m, w, yerr=e, capsize=2, color=C[c], label=NAME[c])
    ax.set_xticks(range(3), [f"{d} s" for d in durs])
    ax.set_xlabel("Burst duration (2× burst)")
    ax.set_ylabel("SLO attainment (%)")
    ax.set_ylim(0, 100)
    ax.legend(fontsize=7.5, ncol=3, loc="upper right")
    ax.set_title("Effect of burst duration")
    save(fig, "fig_duration.png")


def fig_spend():
    fig, ax = plt.subplots(figsize=(6.2, 3.0))
    ceiling = None
    for c in ("B1", "PB"):
        ev = [json.loads(l) for l in (ROOT / f"results/sim/runs/spend-{c}_m2_d180_s0.3_b5_r1/events.jsonl").read_text().splitlines()]
        ax.plot([e["t"] / 60 for e in ev], [e["spent_inr"] for e in ev], color=C[c], label=NAME[c], lw=2)
        ceiling = ev[0]["ceiling_inr"]
    ax.axhline(ceiling, color="#D1495B", ls="--", lw=1.2, label=f"Ceiling (₹{ceiling:g})")
    ax.axhline(ceiling - 10, color="#D1495B", ls=":", lw=1, label="Ceiling − reserve")
    ax.set_xlabel("Minutes into run (five 2× bursts)")
    ax.set_ylabel("Cumulative spend (₹, shadow)")
    ax.legend(fontsize=7.5)
    ax.set_title("Spend against the ceiling")
    save(fig, "fig_spend.png")


def fig_ablation():
    cfgs = ["B1", "PB", "PB-noCost", "PB-noLat", "PB-noRes"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 2.9))
    for ax, metric, title, lab in ((a1, "attainment_per_100inr", "(a) Attainment per ₹100", "points per ₹100"),
                                   (a2, "spend_inr", "(b) Spend per run", "₹ (shadow)")):
        m = [val(SIM["ablation"], {"config": c}, metric) for c in cfgs]
        e = [val(SIM["ablation"], {"config": c}, metric, "ci") for c in cfgs]
        ax.barh(range(len(cfgs)), m, xerr=e, capsize=2, color=[C[c] for c in cfgs])
        ax.set_yticks(range(len(cfgs)), ["B1", "PB", "PB − cost", "PB − latency", "PB − residency"])
        ax.invert_yaxis()
        ax.set_xlabel(lab)
        ax.set_title(title)
    a2.axvline(120, color="#D1495B", ls="--", lw=1)
    fig.tight_layout()
    save(fig, "fig_ablation.png")


def fig_sweep():
    shares = [0.0, 0.1, 0.3, 0.5, 0.7]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 2.9))
    pen = [val(SIM["sweep"], {"config": "PB-noRes", "restricted_share": s}, "attainment") -
           val(SIM["sweep"], {"config": "PB", "restricted_share": s}, "attainment") for s in shares]
    a1.plot([100 * s for s in shares], pen, marker="o", color=C["PB"], lw=2)
    a1.axhline(10, color="#D1495B", ls="--", lw=1)
    a1.text(1, 11, "H3 bound (10 pp)", color="#D1495B", fontsize=7.5)
    a1.set_xlabel("Restricted share of traffic (%)")
    a1.set_ylabel("Penalty (percentage points)")
    a1.set_title("(a) Attainment penalty of residency")
    w = 0.38
    for k, c in enumerate(("PB", "PB-noRes")):
        m = [val(SIM["sweep"], {"config": c, "restricted_share": s}, "attainment_restricted") for s in shares[1:]]
        a2.bar([i + (k - 0.5) * w for i in range(4)], m, w, color=C[c], label=NAME[c])
    a2.set_xticks(range(4), [f"{int(100 * s)}%" for s in shares[1:]])
    a2.set_xlabel("Restricted share of traffic")
    a2.set_ylabel("Attainment of restricted requests (%)")
    a2.set_ylim(0, 100)
    a2.legend(fontsize=7.5)
    a2.set_title("(b) Restricted requests only")
    fig.tight_layout()
    save(fig, "fig_sweep.png")


def fig_testbed():
    if not BED:
        return
    tl = json.loads((ROOT / "results/testbed/timeline.json").read_text())
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 2.9), gridspec_kw={"width_ratios": [1.5, 1]})
    for c in ("B0", "B1", "PB"):
        if c in tl and tl[c]:
            a1.plot([r["t"] / 60 for r in tl[c]], [r["attainment"] if r["attainment"] is not None else float("nan") for r in tl[c]],
                    color=C[c], label=NAME[c], lw=1.6)
    a1.axvspan(2, 5, color="#E9A23B", alpha=0.08)
    a1.set_xlabel("Minutes into run (burst shaded)")
    a1.set_ylabel("Attainment per 15 s (%)")
    a1.set_ylim(0, 102)
    a1.legend(fontsize=7.5)
    a1.set_title("(a) Testbed run, repetition 1")
    cfgs = ["B0", "B1", "PB"]
    w = 0.38
    bed = [val(BED["by_magnitude_180s"], {"config": c, "magnitude": 2}, "attainment") for c in cfgs]
    bed_e = [val(BED["by_magnitude_180s"], {"config": c, "magnitude": 2}, "attainment", "ci") for c in cfgs]
    sim = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": 2}, "attainment") for c in cfgs]
    sim_e = [val(SIM["by_magnitude_180s"], {"config": c, "magnitude": 2}, "attainment", "ci") for c in cfgs]
    a2.bar([i - w / 2 for i in range(3)], bed, w, yerr=bed_e, capsize=2, color="#12263A", label="Testbed")
    a2.bar([i + w / 2 for i in range(3)], sim, w, yerr=sim_e, capsize=2, color="#4C6A92", label="Simulation")
    a2.set_xticks(range(3), ["B0", "B1", "PB"])
    a2.set_ylabel("SLO attainment (%)")
    a2.set_ylim(0, 100)
    a2.legend(fontsize=7.5)
    a2.set_title("(b) Testbed vs simulation, 2×")
    fig.tight_layout()
    save(fig, "fig_testbed.png")


if __name__ == "__main__":
    fig_architecture()
    fig_calibration()
    fig_attainment()
    fig_duration()
    fig_spend()
    fig_ablation()
    fig_sweep()
    fig_testbed()
