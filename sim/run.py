"""Runs the evaluation in simulation, producing the same summary schema as experiments/run_matrix.py.

    python -m sim.run calibrate                 # capacity_users of the private pool
    python -m sim.run all --capacity-users N    # matrix + ablation + residency sweep + spend runs

Outputs go to results/sim/: summary.csv, calibration.csv, and runs/<id>/events.jsonl + timeline.csv
for the spend-over-time runs. Each repetition uses a different random seed; all configurations of
the same shape and repetition share a seed, so they are compared under identical arrival noise.
"""
from __future__ import annotations

import argparse
import csv
import itertools
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from load.shape import BurstParams, RampParams, burst_users, ramp_users
from policyburst.policy import load_file
from sim.cluster import SimConfig, Simulation

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "results" / "sim"
POLICY = ROOT / "deploy" / "policy" / "experiment.yaml"
CONFIGS = {
    "B0": ("noburst", ()), "B1": ("threshold", ()), "PB": ("policyburst", ()),
    "PB-noRes": ("policyburst", ("residency",)), "PB-noLat": ("policyburst", ("latency",)),
    "PB-noCost": ("policyburst", ("cost",)),
}
KEYS = ["set", "run", "config", "magnitude", "duration_s", "restricted_share", "rep", "bursts"]


def one(job: dict) -> dict:
    policy = load_file(POLICY)
    mode, disable = CONFIGS[job["config"]]
    bp = BurstParams(capacity_users=job["capacity_users"], base_users=job["base_users"], magnitude=job["magnitude"],
                     burst_s=job["duration_s"], count=job["bursts"], gap_s=job["gap_s"], warmup_s=120, cooldown_s=180)
    seed = hash((job["magnitude"], job["duration_s"], job["restricted_share"], job["rep"], job["bursts"])) % 2**32
    sim = Simulation(policy, SimConfig(mode=mode, disable=disable, users=lambda t: burst_users(t, bp),
                                       restricted_share=job["restricted_share"], seed=seed))
    row = {k: job[k] for k in KEYS} | sim.run()
    if job["keep"]:
        d = OUT / "runs" / job["run"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "events.jsonl").write_text("\n".join(json.dumps(e) for e in sim.events), encoding="utf-8")
        with open(d / "timeline.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(sim.timeline[0]))
            w.writeheader()
            w.writerows(sim.timeline)
        (d / "summary.json").write_text(json.dumps(row, indent=2))
    return row


def calibrate(seed: int = 1) -> int:
    """Ramp load with no bursting; capacity = highest step whose attainment stays >= 95%."""
    policy = load_file(POLICY)
    rp = RampParams(start=20, step=20, step_s=90, max_users=400)
    sim = Simulation(policy, SimConfig(mode="noburst", users=lambda t: ramp_users(t, rp), seed=seed))
    rows, prev = [], (0, 0)
    serve = sim.serve

    def measured_serve(users):
        nonlocal prev
        out = serve(users)
        if (sim.t + 1) % rp.step_s == 0:
            req, good = sim.c.requests - prev[0], sim.c.good - prev[1]
            rows.append({"users": users, "requests": req, "attainment": round(100 * good / req, 2) if req else 0})
            prev = (sim.c.requests, sim.c.good)
        return out

    sim.serve = measured_serve
    sim.run()
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "calibration.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["users", "requests", "attainment"])
        w.writeheader()
        w.writerows(rows)
    best = max((r["users"] for r in rows if r["attainment"] >= 95), default=0)
    for r in rows:
        print(f"users={r['users']:4d} attainment={r['attainment']:6.2f}%")
    print(f"capacity_users = {best}")
    return best


def jobs(cap: int, base: int, reps: int) -> list[dict]:
    out = []

    def add(set_, cfg, mag, dur, share, rep, bursts=1, keep=False):
        out.append({"set": set_, "run": f"{set_}-{cfg}_m{mag:g}_d{dur:g}_s{share:g}_b{bursts}_r{rep}", "config": cfg,
                    "magnitude": mag, "duration_s": dur, "restricted_share": share, "rep": rep, "bursts": bursts,
                    "gap_s": 300, "capacity_users": cap, "base_users": base, "keep": keep})

    reps_ = range(1, reps + 1)
    for rep, mag, dur, cfg in itertools.product(reps_, (1.5, 2, 2.5, 3, 4), (60, 180, 300), ("B0", "B1", "PB", "PB-noRes")):
        add("matrix", cfg, mag, dur, 0.3, rep)
    # Ablation under repeated bursts, so the spend ceiling actually binds
    for rep, cfg in itertools.product(reps_, ("B1", "PB", "PB-noCost", "PB-noLat", "PB-noRes")):
        add("ablation", cfg, 2, 180, 0.3, rep, bursts=5)
    # O4: residency penalty as the restricted share grows
    for rep, share, cfg in itertools.product(reps_, (0.0, 0.1, 0.3, 0.5, 0.7), ("PB", "PB-noRes")):
        add("sweep", cfg, 2, 180, share, rep)
    for cfg in ("B1", "PB"):
        add("spend", cfg, 2, 180, 0.3, 1, bursts=5, keep=True)
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("what", choices=["calibrate", "all"])
    p.add_argument("--capacity-users", type=int)
    p.add_argument("--base-users", type=int, default=40)
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--workers", type=int, default=8)
    a = p.parse_args()
    if a.what == "calibrate":
        calibrate()
        return
    cap = a.capacity_users or calibrate()
    js = jobs(cap, a.base_users, a.reps)
    print(f"{len(js)} simulated runs, capacity_users={cap}")
    OUT.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(a.workers) as ex:
        rows = list(ex.map(one, js, chunksize=4))
    with open(OUT / "summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print("wrote", OUT / "summary.csv")


if __name__ == "__main__":
    main()
