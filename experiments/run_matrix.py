"""Runs the evaluation matrix: configurations x burst shapes x repetitions.

Run on the k3s server (or any machine with kubectl access and a route to the node IPs):

    python experiments/run_matrix.py --target 100.x.y.z --capacity-users 40            # full matrix
    python experiments/run_matrix.py --target ... --configs B1,PB --mags 4 --durs 180 --reps 1
    python experiments/run_matrix.py --target ... --configs PB,PB-noRes --shares 0,0.1,0.3,0.5,0.7   # O4 sweep
    python experiments/run_matrix.py --target ... --calibrate                         # find capacity_users
    python experiments/run_matrix.py ... --dry-run                                    # print the plan only

Each run gets results/runs/<id>/ with requests.csv, events.jsonl, nodes.json, controller.log,
and one summary row is appended to results/summary.csv.
"""
from __future__ import annotations

import argparse
import csv
import itertools
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analysis.metrics import summarize_run  # noqa: E402

CONFIGS = {
    "B0": ["--mode", "noburst"],
    "B1": ["--mode", "threshold"],
    "PB": ["--mode", "policyburst"],
    "PB-noRes": ["--mode", "policyburst", "--disable", "residency"],
    "PB-noLat": ["--mode", "policyburst", "--disable", "latency"],
    "PB-noCost": ["--mode", "policyburst", "--disable", "cost"],
}
APP_NS, APP_DEPLOYS = "p11-app", ["records", "lms", "static"]


def sh(cmd: list[str], dry: bool, check: bool = True, **kw):
    print("$", " ".join(cmd), flush=True)
    if not dry:
        return subprocess.run(cmd, check=check, **kw)


def reset_app(dry: bool):
    """Back to one replica per service, all on private nodes, before every run."""
    for d in APP_DEPLOYS:
        sh(["kubectl", "-n", APP_NS, "scale", "deploy", d, "--replicas=1"], dry)
    sh(["kubectl", "-n", APP_NS, "delete", "pod", "-l", "p11.burst/managed=true", "--field-selector",
        "status.phase!=Running"], dry, check=False)
    for d in APP_DEPLOYS:
        sh(["kubectl", "-n", APP_NS, "rollout", "status", "deploy", d, "--timeout=180s"], dry)


def run_one(a, cfg: str, mag: float, dur: float, share: float, rep: int, out_root: Path) -> dict | None:
    run_id = f"{cfg}_m{mag:g}_d{dur:g}_s{share:g}_r{rep}"
    run_dir = out_root / "runs" / run_id
    if (run_dir / "summary.json").exists() and not a.force:
        print(f"skip {run_id} (done)")
        return json.loads((run_dir / "summary.json").read_text())
    print(f"\n=== {run_id} ===", flush=True)
    if not a.dry_run:
        run_dir.mkdir(parents=True, exist_ok=True)
    ctl_cmd = [sys.executable, "-m", "policyburst.main", *CONFIGS[cfg], "--policy-file", a.policy,
               "--interval", str(a.interval), "--fresh", "--state", str(run_dir / "state.json"),
               "--events", str(run_dir / "events.jsonl"), "--burst-after", str(a.burst_after),
               "--idle-after", str(a.idle_after)]
    env = dict(os.environ, TARGET=a.target, SHAPE="burst", CAPACITY_USERS=str(a.capacity_users),
               BASE_USERS=str(a.base_users), BURST_MAG=str(mag), BURST_DUR_S=str(dur), BURST_COUNT=str(a.bursts),
               BURST_GAP_S=str(a.gap), WARMUP_S=str(a.warmup), COOLDOWN_S=str(a.cooldown),
               RESTRICTED_SHARE=str(share), REQUEST_LOG=str(run_dir / "requests.csv"))
    loc_cmd = ["locust", "-f", str(ROOT / "load" / "locustfile.py"), "--headless", "--only-summary",
               "--csv", str(run_dir / "locust"), "--processes", str(a.locust_processes)]
    if a.dry_run:
        print("$", " ".join(ctl_cmd))
        reset_app(True)
        print("$", f"BURST_MAG={mag} BURST_DUR_S={dur} RESTRICTED_SHARE={share}", " ".join(loc_cmd))
        return None

    reset_app(False)
    with open(run_dir / "controller.log", "w") as log:
        ctl = subprocess.Popen(ctl_cmd, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=log)
        try:
            time.sleep(a.settle)
            subprocess.run(loc_cmd, cwd=ROOT, env=env, check=False)
        finally:
            ctl.terminate()  # SIGTERM: the controller cordons public nodes and closes its meter
            try:
                ctl.wait(timeout=60)
            except subprocess.TimeoutExpired:
                ctl.kill()
    nodes = subprocess.run(["kubectl", "get", "nodes", "-o", "json"], capture_output=True, text=True, check=True)
    (run_dir / "nodes.json").write_text(nodes.stdout)
    row = {"run": run_id, "config": cfg, "magnitude": mag, "duration_s": dur, "restricted_share": share,
           "rep": rep, **summarize_run(run_dir, slo_ms=a.slo, interval_s=a.interval)}
    (run_dir / "summary.json").write_text(json.dumps(row, indent=2))
    summary = out_root / "summary.csv"
    new = not summary.exists()
    with open(summary, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(row))
        if new:
            w.writeheader()
        w.writerow(row)
    print(json.dumps(row), flush=True)
    return row


def calibrate(a):
    """Ramp load with no bursting; capacity = highest step whose attainment stays >= 95%."""
    run_dir = Path(a.out) / "calibration"
    env = dict(os.environ, TARGET=a.target, SHAPE="ramp", RESTRICTED_SHARE="0.3", REQUEST_LOG=str(run_dir / "requests.csv"))
    cmd = ["locust", "-f", str(ROOT / "load" / "locustfile.py"), "--headless", "--only-summary",
           "--processes", str(a.locust_processes)]
    if a.dry_run:
        print("$ SHAPE=ramp", " ".join(cmd))
        return
    run_dir.mkdir(parents=True, exist_ok=True)
    reset_app(False)
    ctl = subprocess.Popen([sys.executable, "-m", "policyburst.main", "--mode", "noburst", "--policy-file", a.policy,
                            "--fresh", "--state", str(run_dir / "state.json")], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        subprocess.run(cmd, cwd=ROOT, env=env, check=False)
    finally:
        ctl.terminate()
        ctl.wait(timeout=60)
    from analysis.metrics import read_run_requests
    from load.shape import RampParams
    reqs, rp = read_run_requests(run_dir), RampParams.from_env()
    t0 = min(r["ts"] for r in reqs)
    best, rows = 0, []
    for step in itertools.count():
        rs = [r for r in reqs if step * rp.step_s <= r["ts"] - t0 < (step + 1) * rp.step_s]
        if not rs:
            break
        att = 100 * sum(1 for r in rs if r["ok"] and r["latency_ms"] <= a.slo) / len(rs)
        users = rp.start + step * rp.step
        if users > rp.max_users:  # requests still in flight after the ramp ended
            break
        print(f"users={users:4d} attainment={att:5.1f}%")
        rows.append({"users": users, "requests": len(rs), "attainment": round(att, 2)})
        if att >= 95:
            best = users
    with open(Path(a.out) / "calibration.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["users", "requests", "attainment"])
        w.writeheader()
        w.writerows(rows)
    print(f"\ncapacity_users = {best}   (pass --capacity-users {best})")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--target", required=True, help="IP of a private node (NodePorts 30081-30083)")
    p.add_argument("--policy", default=str(ROOT / "deploy" / "policy" / "experiment.yaml"))
    p.add_argument("--configs", default="B0,B1,PB,PB-noRes")
    p.add_argument("--mags", default="2,4,6")
    p.add_argument("--durs", default="60,180,300", help="burst durations in seconds")
    p.add_argument("--shares", default="0.3", help="restricted traffic share(s)")
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--capacity-users", type=int, default=40)
    p.add_argument("--base-users", type=int, default=20)
    p.add_argument("--bursts", type=int, default=1, help="bursts per run (use 4+ for spend-over-time runs)")
    p.add_argument("--gap", type=float, default=300)
    p.add_argument("--warmup", type=float, default=120)
    p.add_argument("--cooldown", type=float, default=180)
    p.add_argument("--settle", type=float, default=20, help="seconds between controller start and load")
    p.add_argument("--interval", type=float, default=15)
    p.add_argument("--burst-after", type=float, default=30)
    p.add_argument("--idle-after", type=float, default=120)
    p.add_argument("--slo", type=float, default=300)
    p.add_argument("--locust-processes", type=int, default=1, help="Locust worker processes (Linux)")
    p.add_argument("--out", default=str(ROOT / "results"))
    p.add_argument("--force", action="store_true", help="re-run runs that already have a summary")
    p.add_argument("--calibrate", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    if a.calibrate:
        return calibrate(a)
    configs = a.configs.split(",")
    unknown = set(configs) - set(CONFIGS)
    if unknown:
        p.error(f"unknown configs {sorted(unknown)}; choose from {list(CONFIGS)}")
    mags = [float(x) for x in a.mags.split(",")]
    durs = [float(x) for x in a.durs.split(",")]
    shares = [float(x) for x in a.shares.split(",")]
    plan = list(itertools.product(range(1, a.reps + 1), mags, durs, shares, configs))
    print(f"{len(plan)} runs planned")
    for rep, mag, dur, share, cfg in plan:  # configs innermost: comparable runs happen close in time
        run_one(a, cfg, mag, dur, share, rep, Path(a.out))


if __name__ == "__main__":
    main()
