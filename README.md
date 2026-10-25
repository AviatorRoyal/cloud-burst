# P11 · Policy-Driven Cloud Bursting (PolicyBurst)

A cloud-bursting controller for a private k3s cluster with public overflow nodes. It treats a **monthly
spend ceiling**, a **latency SLO** and **data residency** (DPDP Act 2023) as explicit inputs to the burst
decision rather than filters applied afterwards.

Ramanuj Agarwal · 23BCE1861 · Guide: Indra Priyadarshini S.

## How it works

Every 15 s the controller:

1. **Observes**: unschedulable pods per managed Deployment, private-node CPU (metrics-server), which public nodes are active, and TCP RTT to each public node.
2. **Residency filter (hard)**: the Deployment's `p11.burst/data-class` label maps to permitted regions in the `BurstPolicy`. Unknown classes are treated as `restricted`.
3. **Latency filter**: a public destination is allowed only if `rttMultiplier × RTT + service time ≤ sloLatencyMs`.
4. **Cost gate**: new capacity is bought only if *projected* spend (current spend plus every active node for one more lease) stays under `ceiling − reserve`. If the next interval would cross the limit, all public nodes are released.
5. **Act**: it pins each Deployment to its permitted destinations (node affinity), uncordons the cheapest feasible public node, or records a rejection with a reason (`residency`, `latency`, `budget`, `capacity`).

The **threshold baseline (B1)** is the same loop with every constraint off. **B0** never bursts. Ablations switch off one constraint at a time (`--disable residency|latency|cost`).

```
policyburst/   policy.py  feasibility.py  cost.py  decision.py  (pure logic, unit-tested)
               signals.py actuator.py main.py                    (Kubernetes I/O + loop)
baselines/     threshold.py                                      (B1 entry point)
deploy/        k3s/ (cloud VMs) · k3d/ (single-machine testbed) · crd/ · policy/ · app/ · controller/
load/          locustfile.py · shape.py (burst + ramp profiles)
experiments/   run_matrix.py (configs × shapes × reps on a real cluster → results/testbed/)
sim/           cluster.py · run.py (trace-driven simulation driving the real controller code → results/sim/)
analysis/      metrics.py · aggregate.py · plots.py
evidence/      captured kubectl output from the testbed
tests/         pytest suite (no cluster needed)
```

The evaluation has two layers:

- **Testbed:** a real 5-node k3s cluster (k3d on WSL2: 2 private nodes and 3 public nodes, 2 vCPU each, with
  netem WAN delay on `pub-sg` and `pub-us`). It runs the baselines and PolicyBurst end to end with Locust.
- **Simulation:** `sim/` runs the unchanged `Decider` and `CostMeter` against a 1-second model of the cluster
  (HPA, scheduler, pod start-up, closed-loop Locust users, queueing). It covers the full 227-run matrix,
  ablation and residency sweep, which would take days on the testbed.

## 1. Testbed (Review 1 evidence)

### Option A: one machine (what the reported results use)

On Linux or WSL2 with Docker and [k3d](https://k3d.io):

```bash
sudo ./deploy/k3d/create-local-testbed.sh          # cluster "p11", kubeconfig ./p11.kubeconfig
export KUBECONFIG=$PWD/p11.kubeconfig
sudo ./deploy/k3d/create-local-testbed.sh netem    # re-apply WAN delay after a host/WSL restart
```

On WSL2, keep a WSL session open while experiments run; WSL stops its VM when idle.

### Option B: cloud VMs

You need Ubuntu 22.04/24.04 machines: 1 private server, at least 1 private agent, and public VMs.
`pub-in` is a free-tier VM in an Indian region (Oracle Cloud Always Free in Hyderabad/Mumbai, or AWS
`ap-south-1`). `pub-sg` (nearby, +40 ms) and `pub-us` (distant, +120 ms) stand in for foreign regions: VMs
labelled `non-IN` with added delay. All nodes reach each other over Tailscale.

```bash
# every node
./deploy/k3s/00-tailscale.sh
# private server
./deploy/k3s/01-server.sh                         # prints token + URL
# private agents
K3S_URL=https://<server-ts-ip>:6443 K3S_TOKEN=<token> ./deploy/k3s/02-agent-private.sh
# public nodes
K3S_URL=... K3S_TOKEN=... ./deploy/k3s/03-agent-public.sh pub-in IN
K3S_URL=... K3S_TOKEN=... ./deploy/k3s/03-agent-public.sh pub-sg non-IN
K3S_URL=... K3S_TOKEN=... ./deploy/k3s/03-agent-public.sh pub-us non-IN
./deploy/k3s/04-netem.sh 40ms                     # on pub-sg
./deploy/k3s/04-netem.sh 120ms                    # on pub-us
```

Then, on the server:

```bash
kubectl apply -f deploy/crd/burstpolicy-crd.yaml
kubectl apply -f deploy/policy/campus-default.yaml -f deploy/policy/experiment.yaml
kubectl apply -f deploy/app/app.yaml
./deploy/k3s/05-evidence.sh                       # saves nodes/pods/labels into evidence/<timestamp>/
```

Screenshot `kubectl get nodes -L p11.burst/destination,p11.burst/region` and `kubectl get pods -A -o wide`
for Review 1, slide 10.

## 2. Python environment (on the server)

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
pytest                                            # 25 tests, no cluster needed
```

## 3. Calibrate, then run the baseline (Review 1, slide 12)

```bash
python experiments/run_matrix.py --target <private-node-ts-ip> --calibrate
python experiments/run_matrix.py --target <ip> --capacity-users <N> --configs B0,B1 --mags 4 --durs 180 --reps 3
cat results/summary.csv
```

## 4. Simulation (full matrix in about 2 minutes)

```bash
python -m sim.run calibrate
python -m sim.run all --capacity-users 220
python analysis/aggregate.py results/sim/summary.csv results/sim/aggregate.json
```

## 5. Full evaluation on a cluster (Review 2 and final)

```bash
# H1/H2: 4 configs × 3 magnitudes × 3 durations × 3 reps = 108 runs (several hours, resumable)
python experiments/run_matrix.py --target <ip> --capacity-users <N>
# ablation
python experiments/run_matrix.py --target <ip> --capacity-users <N> --configs PB,PB-noCost,PB-noLat,PB-noRes --mags 4 --durs 180
# O4 residency sweep
python experiments/run_matrix.py --target <ip> --capacity-users <N> --configs PB,PB-noRes --mags 4 --durs 180 --shares 0,0.1,0.3,0.5,0.7
# spend-over-time runs (repeated bursts so the ceiling binds)
python experiments/run_matrix.py --target <ip> --capacity-users <N> --configs B1,PB --mags 4 --durs 180 --bursts 5 --gap 300 --reps 1 --out results/spend
python analysis/plots.py --spend-runs results/spend/runs/B1_m4_d180_s0.3_r1 results/spend/runs/PB_m4_d180_s0.3_r1
```

Figures go to `results/figures/`. Each run's raw data stays in `results/runs/<id>/`.

## Running the controller by hand

```bash
python -m policyburst.main --mode policyburst --policy campus-default          # policy read from the cluster
python -m policyburst.main --mode policyburst --policy-file deploy/policy/experiment.yaml --dry-run
python baselines/threshold.py --policy-file deploy/policy/experiment.yaml
```

To run in-cluster instead, see `deploy/controller/`.

## Notes and threats to validity

- Free-tier usage bills ₹0, so spend is **shadow-priced** at `ratePerHourINR`. `experiment.yaml` compresses a billing month into one hour (`billingPeriodHours: 1`) with rates scaled ~100×. Keep the price ratios between public destinations realistic.
- `pub-sg` and `pub-us` are emulated with `tc netem` and a `non-IN` label. They are not real foreign regions.
- Residency is enforced at pod placement. Logs, backups and the control plane are out of scope.
- Rejection attribution joins failed or late requests with the controller's no-destination events within ±1 interval. It is an estimate.
