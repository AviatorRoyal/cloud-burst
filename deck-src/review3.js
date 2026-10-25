const { K, newDeck, content, darkSlide, card, badge, txt, bullets, code, arrow, chartOpts, table, hdr, save } = require("./common");
const { SIM, BED, val, events, evidence, gitLog, pct, fmt, readJSON } = require("./data");
const { readFileSync } = require("fs");
const { join } = require("path");
const OUT = process.argv[2];
const p = newDeck("Final Review", "P11 Final Review — PolicyBurst");

const MAGS = [1.5, 2, 2.5, 3, 4];
const sm = (c, m, metric) => val(SIM.by_magnitude_180s, { config: c, magnitude: m }, metric);
const bm = (c, metric, fld) => val(BED.by_magnitude_180s, { config: c, magnitude: 2 }, metric, fld);
const ab = (c, metric) => val(SIM.ablation, { config: c }, metric);
const sw = (c, s, metric) => val(SIM.sweep, { config: c, restricted_share: s }, metric);
const gain = MAGS.map((m) => sm("PB", m, "attainment_per_100inr") / sm("B1", m, "attainment_per_100inr") - 1);
const ablGain = ab("PB", "attainment_per_100inr") / ab("B1", "attainment_per_100inr") - 1;
const SHARES = [0, 0.1, 0.3, 0.5, 0.7];
const pen = SHARES.map((s) => sw("PB-noRes", s, "attainment") - sw("PB", s, "attainment"));
const bedRuns = val(BED.matrix_overall, { config: "PB" }, "attainment", "n") * 3;
const PRE_VIOL = readFileSync(join(__dirname, "..", "results/testbed/pre-fix/summary-PB.csv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => Number(l.split(",")[11]));
const source = (s, t) => txt(s, t, 0.6, 6.72, 12.1, 0.25, { fontSize: 10, italic: true, color: K.muted });

// ---------- 1. Title ----------
let s = darkSlide(p, "Introduction");
s.addText("PolicyBurst: Constraint-First Cloud Bursting Under Cost, Latency and Data Residency", { placeholder: "title" });
s.addText([
  { text: "Final Review  ·  Project P11  ·  Cloud Computing", options: { bold: true, color: K.white, breakLine: true } },
  { text: "Ramanuj Agarwal  ·  23BCE1861", options: { breakLine: true } },
  { text: "Guide: Indra Priyadarshini S.   |   github.com/AviatorRoyal/cloud-burst" },
], { placeholder: "body" });
badge(p, s, 0.8, 0.8, 0.7, K.teal, "PVT", 12);
arrow(p, s, 1.6, 1.15, 2.5, 1.15, "CADCE8");
badge(p, s, 2.6, 0.8, 0.7, K.amber, "PUB", 12);

// ---------- 2. Results at a glance ----------
s = content(p, "Introduction", "The project in one slide", "A bursting controller that never breaks the budget or the residency rule, and is cheaper per unit of service when it matters");
const glance = [
  ["0", "residency violations and ceiling breaches by PolicyBurst", `${SIM.runs} simulated + ${bedRuns} testbed runs`, K.teal],
  [pct(ablGain), "SLO attainment per ₹ vs threshold-only", "repeated bursts, ceiling binding", K.amber],
  [`${fmt(ab("B1", "spend_inr") / 120, 1)}×`, "the ceiling spent by threshold-only bursting", "same workload, no cost check", K.coral],
  [pen[2] <= 1 ? "≈ 0 pp" : `${fmt(pen[2], 0)} pp`, "attainment cost of residency at 30% restricted traffic", `rises to ${fmt(pen[4], 0)} pp at 70%`, K.slate],
];
glance.forEach((g, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 1.9, 2.8, 4.75, K.bg2, { shadow: true });
  txt(s, g[0], x + 0.25, 2.1, 2.4, 1.1, { fontSize: 40, bold: true, color: g[3] });
  txt(s, g[1], x + 0.25, 3.35, 2.35, 1.6, { fontSize: 16, bold: true, color: K.ink });
  txt(s, g[2], x + 0.25, 5.3, 2.35, 1.0, { fontSize: 13, color: K.muted });
});

// ---------- 3. Problem ----------
s = content(p, "Problem", "The problem", "Threshold controllers keep pods running but ignore the rules that govern an institution's bursting decision");
code(p, s, "# typical production rule\nif cpu_util > 0.75 or pending_pods > 0:\n    add_cheapest_public_node()\n    allow_any_pod_anywhere()", 0.6, 1.9, 5.2, 1.7, 14);
txt(s, "Operationally correct — the pods run. Administratively or legally unacceptable — the bill, the SLO and the data's jurisdiction are not checked.", 0.6, 3.85, 5.2, 1.4, { fontSize: 15 });
card(p, s, 0.6, 5.45, 5.2, 1.25, K.coralL);
txt(s, "Post-hoc filters are too late: the capacity is already bought when the rule rejects it.", 0.8, 5.55, 4.8, 1.05, { fontSize: 15, bold: true, color: K.coral, valign: "middle" });
const cons = [
  [K.amber, "₹", "Monthly spending ceiling", "Public spend is paid from an approved budget — a hard cap, not a preference."],
  [K.slate, "ms", "Latency objective", "Distant regions add more delay than the 300 ms SLO allows."],
  [K.teal, "IN", "Data residency", "DPDP Act 2023 §16 and sector rules (e.g. RBI 2018) keep some data in India."],
];
cons.forEach((c, i) => {
  const y = 1.9 + i * 1.62;
  card(p, s, 6.3, y, 6.4, 1.42, K.white, { line: K.line, shadow: true });
  badge(p, s, 6.5, y + 0.3, 0.8, c[0], c[1], 16);
  txt(s, c[2], 7.5, y + 0.15, 5.0, 0.4, { fontSize: 17, bold: true, color: K.ink });
  txt(s, c[3], 7.5, y + 0.58, 5.0, 0.8, { fontSize: 14 });
});

// ---------- 4. Objectives ----------
s = content(p, "Problem", "Objectives and how each was met", "All four objectives are evidenced in code, on the testbed and in simulation");
const obj = [
  ["O1", "Controller with cost, latency and residency as explicit inputs", "Feasible set per workload, then projected-spend gate (policyburst/decision.py)", "Done"],
  ["O2", "Implementation on private Kubernetes with a public node pool", "5-node k3s cluster, BurstPolicy CRD, tainted public pool", "Done"],
  ["O3", "SLO attainment per unit spend under varying burst intensity", "1.5–4× bursts, 60–300 s, testbed + simulation", "Done"],
  ["O4", "Capacity and cost consequences of residency", "Sweep of restricted share 0–70%, with and without residency", "Done"],
];
const orows = [[hdr("#"), hdr("Objective"), hdr("Evidence"), hdr("Status")],
  ...obj.map((o, i) => o.map((c, j) => ({ text: c, options: { bold: j === 0 || j === 3, color: j === 3 ? K.teal : K.text, align: j === 0 || j === 3 ? "center" : "left", fill: { color: i % 2 ? K.white : K.bg2 } } })))];
table(s, orows, 0.6, 1.85, [0.7, 4.6, 5.6, 1.2], { fontSize: 13, rowH: 0.7 });
card(p, s, 0.6, 5.85, 12.1, 0.85, K.tealL);
txt(s, "Baselines (from the problem statement): B0 no bursting · B1 threshold-only bursting without constraints.", 0.85, 5.9, 11.6, 0.75, { fontSize: 15, valign: "middle" });

// ---------- 5. Literature gap ----------
s = content(p, "Problem", "Literature gap", "15 papers from 2021 onwards; none enforces all three constraints in a live private + public Kubernetes controller");
const F = (t) => ({ text: t, options: { align: "center", bold: true, color: t === "Full" ? K.white : t === "Partial" ? K.text : K.muted, fill: { color: t === "Full" ? K.teal : t === "Partial" ? K.amberL : K.white } } });
const gapRows = [
  [hdr("Work"), hdr("Hard cost ceiling"), hdr("Per-destination latency"), hdr("Data residency"), hdr("Live private + public K8s")],
  ["Starburst (ATC'24)", "Partial", "—", "—", "Full"],
  ["Can't Be Late (NSDI'24)", "Partial", "—", "—", "Partial"],
  ["SkyPilot (NSDI'23)", "Partial", "Partial", "Partial", "Partial"],
  ["Liqo (TCC'23)", "—", "—", "Partial", "Full"],
  ["Abdi et al. (FGCS'24)", "Partial", "—", "Partial", "—"],
  ["Xiao et al. (FGCS'22)", "Partial", "—", "Partial", "—"],
  ["K8s edge autoscalers ('21–'22)", "—", "—", "—", "Partial"],
  ["PolicyBurst (this work)", "Full", "Full", "Full", "Full"],
].map((r, i) => i === 0 ? r : r.map((c, j) => j === 0 ? { text: c, options: { bold: true, fill: { color: i === 8 ? K.slateL : K.white } } } : F(c)));
table(s, gapRows, 0.6, 1.85, [3.3, 2.2, 2.2, 2.2, 2.2], { fontSize: 13, rowH: 0.5 });
source(s, "“Partial” = soft objective, manual setting, or simulation only. Full gap table and references in the paper.");

// ---------- 6. Architecture ----------
s = content(p, "Design", "Architecture", "Standard Kubernetes primitives only: taints, cordon, node affinity, HPA — runs on any conformant cluster");
s.addImage({ path: require("path").join(__dirname, "..", "paper", "figures", "fig1_architecture.png"), x: 0.6, y: 1.8, w: 7.6, h: 4.42 });
txt(s, bullets([
  "Policy is a BurstPolicy custom resource; kubectl apply changes it live",
  "Public nodes are tainted and stay cordoned until bought",
  "Each Deployment is pinned to its permissible destinations by node affinity",
  "HPA decides how many replicas; PolicyBurst decides where they may go",
], { gap: 8 }), 8.6, 2.0, 4.1, 4.5, { fontSize: 15 });

// ---------- 7. Decision procedure ----------
s = content(p, "Design", "Constraint-first decision, every 15 s", "Residency and latency define the feasible set before the controller decides to burst");
const steps = [
  ["1", K.muted, "Observe", "Pending pods, private CPU, active nodes, RTT probes"],
  ["2", K.teal, "Residency", "data class → permitted regions; unknown = restricted"],
  ["3", K.slate, "Latency", "2 × RTT + service ≤ 300 ms"],
  ["4", K.amber, "Budget", "spent + next lease ≤ ceiling − reserve"],
  ["5", K.ink, "Act", "cheapest feasible node, or reject with reason"],
];
steps.forEach((st, i) => {
  const x = 0.6 + i * 2.48;
  card(p, s, x, 1.9, 2.2, 2.3, K.white, { line: K.line, shadow: true });
  badge(p, s, x + 0.2, 2.05, 0.65, st[1], st[0], 16);
  txt(s, st[2], x + 0.2, 2.8, 1.85, 0.4, { fontSize: 17, bold: true, color: K.ink });
  txt(s, st[3], x + 0.2, 3.25, 1.85, 0.9, { fontSize: 13 });
  if (i < 4) arrow(p, s, x + 2.22, 3.05, x + 2.46, 3.05, K.ink);
});
code(p, s, [
  "S(t) + (Σ p(active) + p(d)) · min(lease, T − t)  ≤  B − ρ      # buy d only if the whole lease fits",
  "S(t) + Σ p(active) · Δ  >  B − ρ   ⇒   release all public       # halt before the next interval crosses",
  "release priciest node only if its pods fit on private capacity # safe scale-in (fixes thrash)",
  "no new public node while a Deployment is mid-rollout; evict misplaced pods  # rollout guard",
].join("\n"), 0.6, 4.4, 12.1, 1.55, 12);
txt(s, "The threshold baseline is the same loop with all three constraints switched off — so any difference comes from the decision logic, not the plumbing.", 0.6, 6.0, 12.1, 0.6, { fontSize: 14, italic: true, color: K.slate });

// ---------- 8. Implementation ----------
s = content(p, "Implementation", "Implementation", "github.com/AviatorRoyal/cloud-burst · Python on the official Kubernetes client");
code(p, s, [
  "cloud-burst/",
  "├── policyburst/   policy · feasibility · cost",
  "│                  decision · signals · actuator · main",
  "├── baselines/threshold.py   # B1, constraints off",
  "├── deploy/  k3s/ k3d/ crd/ policy/ app/ controller/",
  "├── load/locustfile.py        # burst + ramp shapes",
  "├── experiments/run_matrix.py # testbed runs",
  "├── sim/                      # simulator, same code",
  "├── analysis/                 # metrics, figures",
  "├── paper/   evidence/   results/",
  "└── tests/                    # unit tests",
].join("\n"), 0.6, 1.85, 6.0, 4.0, 12);
txt(s, "Commit history", 6.9, 1.85, 5.8, 0.4, { fontSize: 16, bold: true, color: K.ink });
code(p, s, gitLog(10), 6.9, 2.3, 5.8, 3.55, 10);
card(p, s, 0.6, 6.0, 12.1, 0.7, K.tealL);
txt(s, "Sample app: records (restricted) · lms (internal) · static (public); 15 ms CPU per request; HPA 60% CPU, 1–30 replicas.", 0.85, 6.0, 11.6, 0.7, { fontSize: 14, valign: "middle" });

// ---------- 9. Testbed ----------
const E = evidence();
const [evHost, evTime] = E.host.split("\n");
s = content(p, "Implementation", "Testbed: a real 5-node k3s cluster", `Captured on ${evHost} at ${evTime.replace("T", " ").replace("+00:00", " UTC")} · ${E.dir}/`);
code(p, s, "$ kubectl get nodes -L p11.burst/destination,p11.burst/region\n" + E.nodes, 0.6, 1.8, 12.1, 2.0, 11);
code(p, s, "$ ping -c 5 <node-ip>   (avg RTT)\n" + (E.rtt || "(see evidence folder)"), 0.6, 4.0, 6.2, 2.0, 11);
txt(s, bullets([
  "k3s v1.35.5 via k3d, 2 vCPU per node",
  "Private: server-0, agent-0 (region IN)",
  "pub-in IN · pub-sg +40 ms · pub-us +120 ms (netem)",
  "Public nodes tainted, cordoned until bought",
  "Locust load from the host, 4 processes",
], { gap: 4 }), 7.1, 4.0, 5.6, 2.3, { fontSize: 13 });
source(s, "Same topology can be built from real VMs over Tailscale with deploy/k3s/ (planned upgrade).");

// ---------- 10. Methodology ----------
s = content(p, "Evaluation", "Evaluation method", "Two layers: measure on the cluster, explore the parameter space in a simulator that runs the same decision code");
const layers = [
  [K.ink, "Testbed (measured)", [`B0, B1, PolicyBurst · 2× burst, 180 s · 3 repetitions`, "Per-request logs from Locust, including the serving node", "Capacity calibrated: largest load with ≥ 95% SLO attainment"]],
  [K.slate, "Simulation (same Decider + CostMeter)", [`${SIM.runs} runs: 5 burst sizes × 3 durations, ablation, residency sweep`, "Models HPA, scheduler, pod start-up, CPU limits, closed-loop users, queues", "Checked against the testbed at the shared 2× point"]],
];
layers.forEach((l, i) => {
  const x = 0.6 + i * 6.2;
  card(p, s, x, 1.85, 5.9, 3.0, K.white, { line: K.line, shadow: true });
  badge(p, s, x + 0.25, 2.05, 0.6, l[0], String(i + 1), 14);
  txt(s, l[1], x + 1.0, 2.05, 4.7, 0.6, { fontSize: 17, bold: true, color: K.ink, valign: "middle" });
  txt(s, bullets(l[2], { gap: 6 }), x + 0.3, 2.8, 5.4, 2.0, { fontSize: 14 });
});
const met = [[hdr("Metric"), hdr("Definition")],
  ["SLO attainment", "share of all requests that succeed within 300 ms (failures count as misses)"],
  ["Attainment per ₹100", "attainment points ÷ shadow-priced spend × 100"],
  ["Residency violations", "restricted requests served by a non-IN node (from client logs)"],
  ["Residency penalty", "attainment without residency − attainment with residency (pp)"]].map((r, i) => i ? r.map((c, j) => ({ text: c, options: { bold: j === 0, fill: { color: i % 2 ? K.bg2 : K.white } } })) : r);
table(s, met, 0.6, 5.0, [2.6, 9.5], { fontSize: 12, rowH: 0.36 });

// ---------- 11. Testbed results ----------
s = content(p, "Results", "Testbed results (measured)", `2× private capacity for 180 s, ${val(BED.by_magnitude_180s, { config: "B1", magnitude: 2 }, "attainment", "n")} repetitions per configuration, mean ± 95% CI`);
const brow = (c, n, i) => [{ text: n, options: { bold: true, fill: { color: i % 2 ? K.white : K.bg2 } } },
  ...[`${fmt(bm(c, "attainment"))} ± ${fmt(bm(c, "attainment", "ci"))}`, fmt(bm(c, "p95_ms"), 0), fmt(bm(c, "spend_inr"), 1), fmt(bm(c, "attainment_per_100inr"), 0), fmt(bm(c, "residency_violations"), 0)]
    .map((t) => ({ text: t, options: { align: "center", fill: { color: i % 2 ? K.white : K.bg2 } } }))];
table(s, [[hdr("Config"), hdr("Attainment (%)"), hdr("p95 (ms)"), hdr("Spend (₹)"), hdr("Per ₹100"), hdr("Violations")],
  brow("B0", "B0 No bursting", 0), brow("B1", "B1 Threshold-only", 1), brow("PB", "PolicyBurst", 2)], 0.6, 1.8, [2.6, 2.0, 1.4, 1.4, 1.4, 1.5], { fontSize: 13, rowH: 0.48 });
const TL = readJSON("results/testbed/timeline.json");
const nb = Math.min(TL.B0.length, TL.B1.length, TL.PB.length);
s.addChart(p.charts.LINE, ["B0", "B1", "PB"].map((c, i) => ({ name: ["B0 No bursting", "B1 Threshold-only", "PolicyBurst"][i], labels: TL.B0.slice(0, nb).map((r) => (r.t / 60).toFixed(1)), values: TL[c].slice(0, nb).map((r) => r.attainment ?? 0) })),
  chartOpts({ x: 0.6, y: 3.9, w: 12.1, h: 2.85, title: "SLO attainment per 15 s window (%), repetition 1 — burst from minute 2.0 to 5.0", chartColors: [K.muted, K.amber, K.teal],
    lineSize: 2, lineDataSymbol: "none", valAxisMinVal: 0, valAxisMaxVal: 100, catAxisLabelFrequency: 4 }));

// ---------- 12. Sim vs testbed ----------
s = content(p, "Results", "Does the simulation agree with the testbed?", "Same configurations at the one point both cover; the simulation is then used to explore the rest");
const cf = ["B0", "B1", "PB"];
s.addChart(p.charts.BAR, [
  { name: "Testbed (measured)", labels: ["B0 No bursting", "B1 Threshold", "PolicyBurst"], values: cf.map((c) => Math.round(bm(c, "attainment") * 10) / 10) },
  { name: "Simulation", labels: ["B0 No bursting", "B1 Threshold", "PolicyBurst"], values: cf.map((c) => Math.round(sm(c, 2, "attainment") * 10) / 10) },
], chartOpts({ x: 0.6, y: 1.75, w: 7.0, h: 4.95, barDir: "col", barGrouping: "clustered", title: "SLO attainment (%) at 2× / 180 s", chartColors: [K.ink, K.slate],
  showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: 100 }));
const burstHelpsBoth = ["B1", "PB"].every((c) => bm(c, "attainment") > bm("B0", "attainment") && sm(c, 2, "attainment") > sm("B0", 2, "attainment"));
const pbVsB1Bed = bm("PB", "attainment") - bm("B1", "attainment"), pbVsB1Sim = sm("PB", 2, "attainment") - sm("B1", 2, "attainment");
txt(s, bullets([
  `Largest gap ${fmt(Math.max(...cf.map((c) => Math.abs(bm(c, "attainment") - sm(c, 2, "attainment")))), 0)} pp: 4-core testbed private pool vs 7-core model, real start-up timing`,
  burstHelpsBoth ? "Agree: bursting beats no bursting on both platforms" : "Disagree on whether bursting beats no bursting",
  `PolicyBurst vs threshold: ${pct(pbVsB1Bed / 100).replace("%", " pp")} on the testbed, ${pct(pbVsB1Sim / 100).replace("%", " pp")} in simulation`,
  `Testbed caught what the model cannot: restricted pods leaked abroad during affinity rollouts (${PRE_VIOL.filter((v) => v > 0).join(" and ")} requests in early runs) — fixed with rollout + placement guards`,
  "Why: emulated pub-us is ≈120 ms RTT on the testbed (fits the SLO, so the latency filter removes nothing) but 148 ms in the model (misses it)",
], { gap: 5 }), 7.9, 1.8, 4.8, 4.9, { fontSize: 12 });

// ---------- 13. O3 ----------
s = content(p, "Results", "O3: attainment per ₹ across burst sizes", `PolicyBurst ${pct(gain[0])} at 1.5×, ${pct(gain[1])} at 2×, but ${pct(gain[2])} at 2.5× (simulation, 180 s bursts)`);
s.addChart(p.charts.LINE, ["B0", "B1", "PB"].map((c, i) => ({ name: ["B0 No bursting", "B1 Threshold-only", "PolicyBurst"][i], labels: MAGS.map((m) => `${m}×`), values: MAGS.map((m) => sm(c, m, "attainment")) })),
  chartOpts({ x: 0.6, y: 1.75, w: 6.0, h: 4.95, title: "SLO attainment (%)", chartColors: [K.muted, K.amber, K.teal], lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0, valAxisMaxVal: 100, catAxisTitle: "Burst size (× private capacity)", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, ["B1", "PB"].map((c, i) => ({ name: ["B1 Threshold-only", "PolicyBurst"][i], labels: MAGS.map((m) => `${m}×`), values: MAGS.map((m) => Math.round(sm(c, m, "attainment_per_100inr"))) })),
  chartOpts({ x: 6.9, y: 1.75, w: 5.8, h: 4.95, barDir: "col", barGrouping: "clustered", title: "Attainment points per ₹100", chartColors: [K.amber, K.teal], showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, catAxisTitle: "Burst size", showCatAxisTitle: true }));
s.addNotes("Why PolicyBurst loses at 2.5x: the static latency filter skips pub-us. At heavy overload, local queueing delay exceeds the 300 ms pub-us would add, so slow capacity would still help. Fix: a queue-aware latency filter.");

// ---------- 14. Ceiling ----------
const ev = { B1: events("results/sim/runs/spend-B1_m2_d180_s0.3_b5_r1"), PB: events("results/sim/runs/spend-PB_m2_d180_s0.3_b5_r1") };
const perMin = (e) => e.filter((x) => x.t % 60 === 0);
const mins = perMin(ev.B1).map((e) => String(e.t / 60));
const fB1 = ev.B1[ev.B1.length - 1].spent_inr, fPB = ev.PB[ev.PB.length - 1].spent_inr;
s = content(p, "Results", "The ceiling holds", `Five 2× bursts in one compressed billing month: threshold-only spends ₹${fmt(fB1, 0)}, PolicyBurst ₹${fmt(fPB, 0)} (ceiling ₹120)`);
s.addChart(p.charts.LINE, [
  { name: "B1 Threshold-only", labels: mins, values: perMin(ev.B1).map((e) => e.spent_inr) },
  { name: "PolicyBurst", labels: mins, values: perMin(ev.PB).map((e) => e.spent_inr).concat(Array(Math.max(0, mins.length - perMin(ev.PB).length)).fill(fPB)) },
  { name: "Ceiling (₹120)", labels: mins, values: mins.map(() => 120) },
], chartOpts({ x: 0.6, y: 1.75, w: 8.2, h: 4.95, title: "Cumulative spend (₹, shadow-priced)", chartColors: [K.amber, K.teal, K.coral], lineSize: 2.5, lineDataSymbol: "none", catAxisTitle: "Minutes into run", showCatAxisTitle: true, catAxisLabelFrequency: 5 }));
txt(s, bullets([
  `Threshold-only: ${fmt(fB1 / 120, 1)}× the ceiling`,
  "PolicyBurst stops when the next lease would cross ceiling − reserve",
  "Later bursts: private capacity only, rejections logged with reason “budget”",
  `Ceiling breached: ${fmt(100 * ab("B1", "ceiling_breached"), 0)}% of B1 runs, ${fmt(100 * ab("PB", "ceiling_breached"), 0)}% of PolicyBurst runs`,
], { gap: 8 }), 9.1, 1.9, 3.6, 4.7, { fontSize: 14 });

// ---------- 15. Ablation ----------
s = content(p, "Results", "Ablation: where the gain comes from", `With the ceiling binding, PolicyBurst gets ${pct(ablGain)} attainment per ₹; the cost accumulator is the main source`);
const AB = ["B1", "PB", "PB-noCost", "PB-noLat", "PB-noRes"];
s.addChart(p.charts.BAR, [{ name: "Attainment per ₹100", labels: ["B1 Threshold-only", "PolicyBurst (full)", "PB − cost accumulator", "PB − latency filter", "PB − residency filter"], values: AB.map((c) => Math.round(ab(c, "attainment_per_100inr") * 10) / 10) }],
  chartOpts({ x: 0.6, y: 1.75, w: 7.2, h: 4.95, barDir: "bar", title: "Attainment points per ₹100 (5 bursts, 3 reps)", chartColors: [K.amber, K.teal, "B5761A", K.slate, K.coral], showLegend: false, showValue: true, dataLabelPosition: "outEnd", valAxisMinVal: 0, barGapWidthPct: 50, catAxisOrientation: "maxMin" }));
const abl = [
  ["− cost accumulator", "B5761A", `spend ₹${fmt(ab("PB-noCost", "spend_inr"), 0)}, ceiling breached every run`],
  ["− latency filter", K.slate, `buys slow pub-us: attainment ${fmt(ab("PB-noLat", "attainment"))}% vs ${fmt(ab("PB", "attainment"))}%`],
  ["− residency filter", K.coral, `${Math.round(ab("PB-noRes", "residency_violations")).toLocaleString("en-IN")} restricted requests abroad per run`],
];
abl.forEach((a, i) => {
  const y = 1.85 + i * 1.6;
  card(p, s, 8.1, y, 4.6, 1.4, K.bg2);
  txt(s, a[0], 8.3, y + 0.12, 4.2, 0.4, { fontSize: 16, bold: true, color: a[1] });
  txt(s, a[2], 8.3, y + 0.55, 4.2, 0.8, { fontSize: 14 });
});

// ---------- 16. O4 ----------
s = content(p, "Results", "O4: what residency costs", `About zero up to 30% restricted traffic; ${fmt(pen[3], 0)} pp at 50% and ${fmt(pen[4], 0)} pp at 70%, once pub-in is saturated`);
s.addChart(p.charts.LINE, [{ name: "Penalty (pp)", labels: SHARES.map((x) => `${x * 100}%`), values: pen.map((v) => Math.round(v * 10) / 10) }],
  chartOpts({ x: 0.6, y: 1.75, w: 6.0, h: 4.95, title: "Attainment penalty of residency (pp)", chartColors: [K.teal], showLegend: false, lineSize: 2.5, lineDataSymbolSize: 7, showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0.0", catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, [
  { name: "With residency", labels: SHARES.slice(1).map((x) => `${x * 100}%`), values: SHARES.slice(1).map((x) => Math.round(sw("PB", x, "attainment_restricted"))) },
  { name: "Without residency", labels: SHARES.slice(1).map((x) => `${x * 100}%`), values: SHARES.slice(1).map((x) => Math.round(sw("PB-noRes", x, "attainment_restricted"))) },
], chartOpts({ x: 6.9, y: 1.75, w: 5.8, h: 4.95, barDir: "col", barGrouping: "clustered", title: "Attainment of restricted requests (%)", chartColors: [K.teal, K.coral], showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: 100, catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
source(s, "Rule of thumb: compliance is cheap while in-country capacity (private + pub-in) can absorb the restricted share of peak demand.");

// ---------- 17. Hypotheses ----------
s = content(p, "Results", "Hypotheses: final verdict", "Reported against the hypotheses as stated, including where the data disagrees");
const pbViol = Math.round(Math.max(val(SIM.matrix_overall, { config: "PB" }, "residency_violations"), val(SIM.ablation, { config: "PB" }, "residency_violations"), bm("PB", "residency_violations")));
const verdict = [
  ["H1", K.amber, "Partly supported", `≥ 25% per ₹ holds at 1.5× (${pct(gain[0])}) and with a binding ceiling (${pct(ablGain)}); ${pct(gain[1])} at 2×; fails at 2.5× (${pct(gain[2])}) where the static latency filter forgoes pub-us.`],
  ["H2", pbViol === 0 ? K.teal : K.coral, pbViol === 0 ? "Supported" : "Not supported", `PolicyBurst: ${pbViol} residency violations and no ceiling breach in ${SIM.runs} simulated and ${bedRuns} testbed runs. Threshold-only served ${fmt(bm("B1", "residency_violations"), 0)} restricted requests abroad per testbed run and breached the ceiling in ${fmt(100 * ab("B1", "ceiling_breached"), 0)}% of repeated-burst runs.`],
  ["H3", pen[2] <= 10 ? K.teal : K.coral, pen[2] <= 10 ? "Supported at 30%" : "Not supported", `Penalty at 30% restricted: ${fmt(pen[2])} pp (bound 10 pp). Not true beyond: ${fmt(pen[3])} pp at 50%, ${fmt(pen[4])} pp at 70%.`],
];
verdict.forEach((v, i) => {
  const y = 1.8 + i * 1.6;
  card(p, s, 0.6, y, 12.1, 1.42, K.white, { line: K.line, shadow: true });
  badge(p, s, 0.8, y + 0.3, 0.8, K.ink, v[0], 16);
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 1.85, y: y + 0.45, w: 2.3, h: 0.5, fill: { color: v[1] }, line: { color: v[1] }, rectRadius: 0.08 });
  txt(s, v[2], 1.85, y + 0.45, 2.3, 0.5, { fontSize: 14, bold: true, color: K.white, align: "center", valign: "middle" });
  txt(s, v[3], 4.4, y + 0.12, 8.1, 1.2, { fontSize: 14, valign: "middle" });
});

// ---------- 18. Threats ----------
s = content(p, "Discussion", "Threats to validity", "What this setup cannot prove");
const th = [
  ["Simulation model", "Fluid queues and M/M/1-style service; checked against the testbed at one burst size."],
  ["One host, emulated WAN", "All nodes share a machine; foreign regions are netem delay, not real links."],
  ["Cost is modelled", "Free tier bills ₹0: shadow prices, month compressed into 1 h, rates ×100."],
  ["Synthetic load", "Square-wave bursts; real demand ramps, overlaps and follows daily cycles."],
  ["Residency ≠ legal compliance", "Pod placement only; logs, backups and control plane may still cross borders."],
  ["Small scale", "5 nodes, 3 services, 3 repetitions; wide CIs at 2–2.5×."],
];
th.forEach((t, i) => {
  const x = 0.6 + (i % 3) * 4.1, y = 1.85 + Math.floor(i / 3) * 2.45;
  card(p, s, x, y, 3.8, 2.2, i % 2 ? K.bg2 : K.white, { line: K.line });
  badge(p, s, x + 0.2, y + 0.2, 0.55, K.coral, "!", 16);
  txt(s, t[0], x + 0.9, y + 0.22, 2.75, 0.5, { fontSize: 16, bold: true, color: K.ink, valign: "middle" });
  txt(s, t[1], x + 0.2, y + 0.9, 3.4, 1.25, { fontSize: 14 });
});

// ---------- 19. Conclusion ----------
s = content(p, "Discussion", "Conclusion and future work", "Making constraints inputs, not filters, lets a bursting controller honour them at little cost in service");
txt(s, "Contributions", 0.6, 1.85, 5.9, 0.4, { fontSize: 18, bold: true, color: K.ink });
txt(s, bullets([
  "Constraint-first bursting: feasible set per workload, projected-spend gate, safe scale-in",
  "Open-source controller with a BurstPolicy CRD, baselines in the same code path",
  "Evaluation on a real k3s cluster and in a simulator running the same decision code",
  "A measured cost of residency compliance and a rule of thumb for institutions",
], { gap: 8 }), 0.6, 2.35, 5.9, 4.3, { fontSize: 15 });
txt(s, "Next", 6.9, 1.85, 5.8, 0.4, { fontSize: 18, bold: true, color: K.ink });
const nx = [["1", "Queue-aware latency filter", "admit a slow region when local queueing is worse — fixes 2.5×"], ["2", "Real public node", "free-tier VM in an Indian region over Tailscale"], ["3", "Beyond placement", "residency for logs, backups and storage"]];
nx.forEach((n, i) => {
  const y = 2.35 + i * 1.4;
  badge(p, s, 6.9, y, 0.7, i % 2 ? K.amber : K.teal, n[0], 16);
  txt(s, n[1], 7.8, y - 0.05, 4.9, 0.4, { fontSize: 16, bold: true, color: K.ink });
  txt(s, n[2], 7.8, y + 0.38, 4.9, 0.8, { fontSize: 14 });
});

// ---------- 20. References ----------
s = content(p, "Discussion", "Key references", null);
const refs = [
  "Luo et al., Starburst: A cost-aware scheduler for hybrid cloud, USENIX ATC 2024",
  "Yang et al., SkyPilot: An intercloud broker for sky computing, NSDI 2023",
  "Wu et al., Can't Be Late: Optimizing spot instance savings under deadlines, NSDI 2024",
  "Iorio et al., Computing without borders: The way towards liquid computing, IEEE TCC 2023",
  "Abdi, Ashjaei & Mubeen, Deadline-constrained security-aware workflow scheduling in hybrid cloud, FGCS 2024",
  "Xiao, Zhou, Yang & He, Privacy-preserving workflow scheduling in geo-distributed data centers, FGCS 2022",
  "Stoica & Shenker, From cloud computing to sky computing, HotOS 2021",
  "Wiesner et al., Let's wait awhile, Middleware 2021",
  "Ju, Singh & Toor, Proactive autoscaling for edge computing systems with Kubernetes, UCC 2021",
  "Sukprasert et al., Carbon-aware temporal and spatial workload shifting, EuroSys 2024",
  "Digital Personal Data Protection Act 2023; RBI circular on storage of payment system data, 2018",
  "Kubernetes documentation (HPA, taints, node affinity); k3s; k3d; Locust; NetEm (Hemminger 2005)",
];
txt(s, refs.map((t, i) => ({ text: `[${i + 1}] ${t}`, options: { breakLine: i < refs.length - 1, paraSpaceAfter: 6 } })), 0.6, 1.4, 12.1, 5.3, { fontSize: 13 });

// ---------- 21. Close ----------
s = darkSlide(p, "Discussion");
s.addText("Thank you — questions?", { placeholder: "title" });
s.addText("Residency, latency and budget decide where work may go — before the controller decides where it should go.", { placeholder: "body" });

save(p, OUT);
