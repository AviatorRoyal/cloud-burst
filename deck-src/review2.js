const { K, newDeck, content, darkSlide, card, badge, txt, bullets, code, arrow, chartOpts, table, hdr, save } = require("./common");
const { SIM, BED, val, events, gitLog, pct, fmt } = require("./data");
const OUT = process.argv[2];
const p = newDeck("Review 2", "P11 Review 2 — Implementation and Preliminary Results");

const MAGS = [1.5, 2, 2.5, 3, 4];
const byMag = (cfg, metric) => MAGS.map((m) => val(SIM.by_magnitude_180s, { config: cfg, magnitude: m }, metric));
const abl = (cfg, metric) => val(SIM.ablation, { config: cfg }, metric);
const sweep = (cfg, s, metric) => val(SIM.sweep, { config: cfg, restricted_share: s }, metric);
const overall = (cfg, metric) => val(SIM.matrix_overall, { config: cfg }, metric);
const gainPerInr = MAGS.map((m, i) => byMag("PB", "attainment_per_100inr")[i] / byMag("B1", "attainment_per_100inr")[i] - 1);
const ablGain = abl("PB", "attainment_per_100inr") / abl("B1", "attainment_per_100inr") - 1;
const SHARES = [0, 0.1, 0.3, 0.5, 0.7];
const penalty = SHARES.map((s) => sweep("PB-noRes", s, "attainment") - sweep("PB", s, "attainment"));

function source(s, text) {
  txt(s, text, 0.6, 6.72, 12.1, 0.25, { fontSize: 10, italic: true, color: K.muted });
}

// ---------- 1. Title ----------
let s = darkSlide(p, "Introduction");
s.addText("Policy-Driven Cloud Bursting Under Cost, Latency and Data-Residency Constraints", { placeholder: "title" });
s.addText([
  { text: "Review 2 — Implementation and Preliminary Results  ·  23/09/2026", options: { bold: true, color: K.white, breakLine: true } },
  { text: "Project P11  ·  Cloud Computing", options: { breakLine: true } },
  { text: "Ramanuj Agarwal  ·  23BCE1861   |   Guide: Indra Priyadarshini S." },
], { placeholder: "body" });
badge(p, s, 0.8, 0.8, 0.7, K.teal, "PVT", 12);
arrow(p, s, 1.6, 1.15, 2.5, 1.15, "CADCE8");
badge(p, s, 2.6, 0.8, 0.7, K.amber, "PUB", 12);

// ---------- 2. Rubric map ----------
s = content(p, "Introduction", "What this review covers", "Each rubric component maps to a section of the deck");
const rub = [
  ["4", "O1 & O2 evidenced", "Working controller in a version-controlled repo", "Slides 4–7"],
  ["3", "Results vs baseline", "Baseline and PolicyBurst on the same axes", "Slides 9–11"],
  ["2", "Ablation & sweep", "Which component causes the gain; behaviour vs load", "Slides 12–13"],
  ["1", "Threats to validity", "What our setup cannot prove", "Slide 15"],
];
rub.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 2.0, 2.8, 3.6, K.bg2, { shadow: true });
  badge(p, s, x + 0.3, 2.3, 0.9, i % 2 ? K.amber : K.teal, r[0] + "m", 18);
  txt(s, r[1], x + 0.3, 3.45, 2.3, 0.5, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x + 0.3, 4.0, 2.3, 0.9, { fontSize: 14 });
  txt(s, r[3], x + 0.3, 5.0, 2.3, 0.4, { fontSize: 14, bold: true, color: K.slate });
});

// ---------- 3. Recap + method ----------
s = content(p, "Introduction", "Hypotheses and evaluation method", "Hypotheses from the problem formulation, evaluated on a real k3s testbed and in simulation");
const rc = [
  ["H1", K.teal, "≥ 25% more SLO attainment per ₹ than threshold-only bursting, under bursts with a fixed ceiling"],
  ["H2", K.amber, "Zero ceiling breaches and zero residency violations in every PolicyBurst run"],
  ["H3", K.slate, "Residency enforcement (30% restricted traffic) costs ≤ 10 pp of SLO attainment"],
];
rc.forEach((h, i) => {
  const y = 1.85 + i * 1.0;
  badge(p, s, 0.6, y, 0.75, h[1], h[0], 15);
  txt(s, h[2], 1.55, y, 6.0, 0.75, { fontSize: 15, valign: "middle" });
});
card(p, s, 8.0, 1.85, 4.7, 2.75, K.bg2);
txt(s, "Design changes during implementation", 8.25, 1.98, 4.2, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets([
  "Public pool split into pub-in, pub-sg, pub-us so residency and latency have distinct effects",
  "Safe scale-in: release a node only if its pods fit back on private capacity",
  "Rollout + placement guards: testbed showed restricted pods leaking abroad mid-rollout",
  "HPA max replicas 12 → 30; app does fixed CPU work per request",
], { gap: 3 }), 8.25, 2.4, 4.25, 2.15, { fontSize: 12 });
const layers = [
  [K.teal, "Testbed", "Real k3s v1.35 cluster, 5 nodes (2 private, 3 public), 2 vCPU each; netem WAN delay; Locust load; controller and baselines run end to end."],
  [K.slate, "Simulation", `Same controller code (Decider, CostMeter) against a 1 s cluster model: HPA, scheduler, pod start-up, closed-loop users. ${SIM.runs} runs.`],
];
layers.forEach((l, i) => {
  const x = 0.6 + i * 6.2;
  card(p, s, x, 4.9, 5.9, 1.8, K.white, { line: K.line, shadow: true });
  badge(p, s, x + 0.2, 5.05, 0.55, l[0], String(i + 1), 14);
  txt(s, l[1], x + 0.9, 5.05, 4.8, 0.45, { fontSize: 16, bold: true, color: K.ink, valign: "middle" });
  txt(s, l[2], x + 0.2, 5.6, 5.5, 1.05, { fontSize: 13 });
});

// ---------- 4. Controller design (O1) ----------
s = content(p, "Implementation", "O1 — Constraints are inputs, not post-hoc filters", "Every decision is made inside the feasible set defined by residency, latency and budget");
const steps = [
  ["1", K.muted, "Observe", "Pending pods, private CPU, active nodes, RTT probes (every 15 s)"],
  ["2", K.teal, "Residency", "data-class label → permitted regions (hard, fail-closed)"],
  ["3", K.slate, "Latency", "2 × RTT + service time ≤ 300 ms SLO"],
  ["4", K.amber, "Budget", "spent + projected lease ≤ ceiling − reserve"],
  ["5", K.ink, "Act", "cheapest feasible node; else reject with reason code"],
];
steps.forEach((st, i) => {
  const x = 0.6 + i * 2.48;
  card(p, s, x, 1.9, 2.2, 2.55, K.white, { line: K.line, shadow: true });
  badge(p, s, x + 0.2, 2.05, 0.65, st[1], st[0], 16);
  txt(s, st[2], x + 0.2, 2.8, 1.85, 0.4, { fontSize: 17, bold: true, color: K.ink });
  txt(s, st[3], x + 0.2, 3.25, 1.85, 1.15, { fontSize: 13 });
  if (i < 4) arrow(p, s, x + 2.22, 3.17, x + 2.46, 3.17, K.ink);
});
card(p, s, 0.6, 4.75, 5.9, 1.95, K.coralL);
txt(s, [{ text: "Threshold baseline (post-hoc)", options: { bold: true, color: K.coral, breakLine: true } }, { text: "burst when CPU > 75% or pods pend → cheapest node, any region. Budget and residency are discovered broken after capacity is bought." }], 0.85, 4.9, 5.4, 1.7, { fontSize: 14 });
card(p, s, 6.8, 4.75, 5.9, 1.95, K.tealL);
txt(s, [{ text: "PolicyBurst (constraint-first)", options: { bold: true, color: K.teal, breakLine: true } }, { text: "build the feasible set per workload first, then choose within it. Empty set → request rejected and logged with a reason (residency, latency, budget)." }], 7.05, 4.9, 5.4, 1.7, { fontSize: 14 });

// ---------- 5. Policy as input ----------
s = content(p, "Implementation", "Policy as a Kubernetes object", "Administrators change rules with kubectl apply — the controller re-reads the policy every cycle");
code(p, s, [
  "apiVersion: p11.burst/v1",
  "kind: BurstPolicy",
  "metadata: { name: campus-default }",
  "spec:",
  "  monthlyCeilingINR: 2000",
  "  reserveINR: 100",
  "  sloLatencyMs: 300",
  "  minLeaseHours: 1",
  "  destinations:",
  "  - {name: private, region: IN, private: true}",
  "  - {name: pub-in, region: IN,     ratePerHourINR: 1.8}",
  "  - {name: pub-sg, region: non-IN, ratePerHourINR: 1.4}",
  "  - {name: pub-us, region: non-IN, ratePerHourINR: 1.0}",
  "  residency:",
  "    restricted: [IN]",
  "    internal:   [IN, non-IN]",
  "    public:     [IN, non-IN]",
].join("\n"), 0.6, 1.85, 6.6, 4.85, 12);
txt(s, "Workload labels", 7.6, 1.9, 5.1, 0.4, { fontSize: 17, bold: true, color: K.ink });
const lab = [
  [hdr("p11.burst/data-class"), hdr("Example"), hdr("May run on")],
  ["restricted", "Student records, Aadhaar-linked data", "private, pub-in"],
  ["internal", "Timetable, LMS content", "all four"],
  ["public", "Static site, open datasets", "all four"],
].map((r, i) => i ? r.map((c, j) => ({ text: c, options: { bold: j === 0, fill: { color: i === 1 ? K.tealL : K.white } } })) : r);
table(s, lab, 7.6, 2.4, [1.55, 2.0, 1.55], { fontSize: 12, rowH: 0.5 });
txt(s, bullets([
  "Missing or unknown class → treated as restricted",
  "Rates are shadow prices: free-tier usage bills ₹0",
  "experiment.yaml compresses a month into 1 h and scales rates ×100, so the ceiling binds within a run",
], { gap: 4 }), 7.6, 4.65, 5.1, 2.0, { fontSize: 13 });

// ---------- 6. Repository (O2) ----------
s = content(p, "Implementation", "O2 — Implementation in a version-controlled repo", "github.com/AviatorRoyal/cloud-burst · Python controller on the official Kubernetes client");
code(p, s, [
  "cloud-burst/",
  "├── policyburst/      # controller",
  "│   ├── policy.py  feasibility.py  cost.py",
  "│   ├── decision.py   # when / how much / which",
  "│   └── signals.py  actuator.py  main.py",
  "├── baselines/threshold.py   # B1 = constraints off",
  "├── deploy/  k3s/ k3d/ crd/ policy/ app/",
  "├── load/locustfile.py       # burst + ramp shapes",
  "├── experiments/run_matrix.py",
  "├── sim/  cluster.py  run.py # simulation",
  "├── analysis/  metrics aggregate timeline",
  "├── evidence/   results/",
  "└── tests/      # 28 unit tests",
].join("\n"), 0.6, 1.85, 6.0, 4.85, 12);
txt(s, "Commit history (git log)", 6.9, 1.85, 5.8, 0.4, { fontSize: 16, bold: true, color: K.ink });
code(p, s, gitLog(8), 6.9, 2.3, 5.8, 2.6, 10.5);
card(p, s, 6.9, 5.15, 5.8, 1.55, K.tealL);
txt(s, [{ text: "Demo: ", options: { bold: true } }, { text: "kubectl apply a policy, start a Locust burst, watch restricted pods land only on private / pub-in while internal pods use pub-sg." }], 7.1, 5.25, 5.4, 1.35, { fontSize: 14, valign: "middle" });

// ---------- 7. Cost accumulator ----------
s = content(p, "Implementation", "The cost accumulator", "Projects spend before buying capacity, so the ceiling is approached, never crossed");
code(p, s, [
  "def can_acquire(meter, policy, dest):",
  "    lease = min(policy.min_lease_hours, meter.hours_left(policy))",
  "    projected = meter.total_inr() + \\",
  "        (meter.burn_rate_inr_h() + dest.rate_per_hour_inr) * lease",
  "    return projected <= policy.ceiling - policy.reserve",
  "",
  "def must_halt(meter, policy, interval_s):",
  "    nxt = meter.total_inr() + meter.burn_rate_inr_h() * interval_s / 3600",
  "    return nxt > policy.ceiling - policy.reserve",
].join("\n"), 0.6, 1.85, 7.6, 3.4, 12);
const stat = [["0", "ceiling breaches allowed", K.amber], ["1 s", "metering resolution (per-second billing)", K.teal], ["₹100", "reserve below ceiling (campus policy)", K.slate]];
stat.forEach((t, i) => {
  const y = 1.85 + i * 1.18;
  card(p, s, 8.6, y, 4.1, 1.0, K.bg2);
  txt(s, t[0], 8.8, y, 1.5, 1.0, { fontSize: 30, bold: true, color: t[2], valign: "middle" });
  txt(s, t[1], 10.3, y, 2.3, 1.0, { fontSize: 14, valign: "middle" });
});
card(p, s, 0.6, 5.5, 12.1, 1.2, K.tealL);
txt(s, [{ text: "Why projected, not current: ", options: { bold: true } }, { text: "a node acquired just under the ceiling still bills for its whole lease. A current-spend check overshoots by up to one lease per node." }], 0.85, 5.6, 11.6, 1.0, { fontSize: 15, valign: "middle" });

// ---------- 8. Experimental setup ----------
s = content(p, "Results", "Experimental setup", "Same app, load shapes and metrics for every configuration — only the controller changes");
const cnt = [["5", "real k3s nodes (testbed)"], ["15", "burst shapes (5 sizes × 3 durations)"], ["3", "repetitions, paired seeds"], [String(SIM.runs), "simulated runs in total"]];
cnt.forEach((c, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 1.85, 2.8, 1.5, i === 3 ? K.ink : K.bg2);
  txt(s, c[0], x + 0.25, 1.9, 2.3, 0.85, { fontSize: 40, bold: true, color: i === 3 ? K.white : K.teal });
  txt(s, c[1], x + 0.25, 2.75, 2.4, 0.5, { fontSize: 13, color: i === 3 ? "CADCE8" : K.text });
});
const cfg = [
  [hdr("Config"), hdr("Burst"), hdr("Ceiling"), hdr("Latency"), hdr("Residency")],
  ["B0 No bursting", "off", "—", "—", "—"],
  ["B1 Threshold-only", "on", "off", "off", "off"],
  ["PB PolicyBurst", "on", "on", "on", "on"],
  ["PB-noRes / -noLat / -noCost", "on", "ablation: one constraint off", "", ""],
].map((r, i) => i ? r.map((c, j) => ({ text: c, options: { bold: j === 0, align: j ? "center" : "left", fill: { color: i === 3 ? K.tealL : K.white }, colspan: i === 4 && j === 2 ? 3 : undefined } })).filter((c, j) => !(i === 4 && j > 2)) : r);
table(s, cfg, 0.6, 3.65, [2.9, 1.0, 1.2, 1.2, 1.2], { fontSize: 13, rowH: 0.5 });
card(p, s, 8.6, 3.65, 4.1, 3.05, K.bg2);
txt(s, "Load (Locust, closed loop)", 8.85, 3.8, 3.6, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets([
  "Bursts of 1.5–4× private capacity for 60, 180 or 300 s",
  "Base 40 users; 2 req/s per user",
  "30% of requests restricted",
  "SLO: success within 300 ms",
], { gap: 4 }), 8.85, 4.25, 3.65, 2.35, { fontSize: 14 });

// ---------- 9. Results: attainment ----------
s = content(p, "Results", "Results: attainment and attainment per ₹",
  `PolicyBurst gives ${pct(gainPerInr[0])} attainment per ₹ at 1.5× and ${pct(gainPerInr[1])} at 2×, but ${pct(gainPerInr[2])} at 2.5×`);
s.addChart(p.charts.LINE, ["B0", "B1", "PB"].map((c, i) => ({ name: ["B0 No bursting", "B1 Threshold-only", "PB PolicyBurst"][i], labels: MAGS.map((m) => `${m}×`), values: byMag(c, "attainment") })),
  chartOpts({ x: 0.6, y: 1.75, w: 6.0, h: 4.9, title: "SLO attainment (%) vs burst size (180 s bursts)", chartColors: [K.muted, K.amber, K.teal],
    lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0, valAxisMaxVal: 100, catAxisTitle: "Burst size (× private capacity)", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, ["B1", "PB"].map((c, i) => ({ name: ["B1 Threshold-only", "PB PolicyBurst"][i], labels: MAGS.map((m) => `${m}×`), values: byMag(c, "attainment_per_100inr").map((v) => Math.round(v)) })),
  chartOpts({ x: 6.9, y: 1.75, w: 5.8, h: 4.9, barDir: "col", barGrouping: "clustered", title: "Attainment points per ₹100 spent", chartColors: [K.amber, K.teal],
    showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, catAxisTitle: "Burst size", showCatAxisTitle: true }));
source(s, "Simulation, 3 repetitions per point, mean shown. B0 spends nothing, so it has no per-₹ value.");
s.addNotes("Why PolicyBurst loses at 2.5x: the latency filter keeps work off pub-us (2 x 148 ms RTT breaks the 300 ms SLO). At 2.5x the cluster is so overloaded that pub-us capacity, even though slow, relieves queueing more than it costs. A static latency filter ignores local queueing delay — a concrete improvement for the final review.");

// ---------- 10. Results: spend vs ceiling ----------
const spendRuns = { B1: events("results/sim/runs/spend-B1_m2_d180_s0.3_b5_r1"), PB: events("results/sim/runs/spend-PB_m2_d180_s0.3_b5_r1") };
const perMin = (ev) => ev.filter((e) => e.t % 60 === 0);
const minutes = perMin(spendRuns.B1).map((e) => String(e.t / 60));
const finalB1 = spendRuns.B1[spendRuns.B1.length - 1].spent_inr, finalPB = spendRuns.PB[spendRuns.PB.length - 1].spent_inr;
const ceiling = spendRuns.PB[0].ceiling_inr;
s = content(p, "Results", "Results: the ceiling holds", `Five 2× bursts in one compressed billing month: threshold-only spends ₹${fmt(finalB1, 0)} against a ₹${ceiling} ceiling`);
s.addChart(p.charts.LINE, [
  { name: "B1 Threshold-only", labels: minutes, values: perMin(spendRuns.B1).map((e) => e.spent_inr) },
  { name: "PB PolicyBurst", labels: minutes, values: perMin(spendRuns.PB).map((e) => e.spent_inr).concat(Array(Math.max(0, minutes.length - perMin(spendRuns.PB).length)).fill(finalPB)) },
  { name: `Ceiling (₹${ceiling})`, labels: minutes, values: minutes.map(() => ceiling) },
], chartOpts({ x: 0.6, y: 1.75, w: 8.2, h: 4.9, title: "Cumulative spend (₹, shadow-priced)", chartColors: [K.amber, K.teal, K.coral],
  lineSize: 2.5, lineDataSymbol: "none", catAxisTitle: "Minutes into run", showCatAxisTitle: true, catAxisLabelFrequency: 5 }));
const tk = [["B1", K.amber, `ends at ₹${fmt(finalB1, 0)}: ${fmt(finalB1 / ceiling, 1)}× the ceiling`], ["PB", K.teal, `stops at ₹${fmt(finalPB, 0)}, under ceiling − reserve; later bursts fall back to private capacity or are rejected with reason "budget"`]];
tk.forEach((t, i) => {
  const y = 1.95 + i * 1.6;
  badge(p, s, 9.2, y, 0.7, t[1], t[0], 14);
  txt(s, t[2], 10.05, y - 0.05, 2.65, 1.45, { fontSize: 14 });
});
card(p, s, 9.2, 5.2, 3.5, 1.45, K.tealL);
txt(s, `H2 check: ceiling breached in ${fmt(100 * abl("B1", "ceiling_breached"), 0)}% of B1 runs, ${fmt(100 * abl("PB", "ceiling_breached"), 0)}% of PB runs`, 9.4, 5.3, 3.1, 1.25, { fontSize: 13, bold: true, color: K.teal, valign: "middle" });
source(s, "Simulation, repetition 1 shown; repetitions 2–3 give the same outcome (see ablation slide).");

// ---------- 11. Testbed vs simulation ----------
s = content(p, "Results", "Testbed check: does the simulation agree?", "Same configurations on the real 5-node k3s cluster at a 2× burst of 180 s");
if (BED) {
  const cfgs = ["B0", "B1", "PB"];
  const bedAtt = cfgs.map((c) => val(BED.by_magnitude_180s, { config: c, magnitude: 2 }, "attainment"));
  const simAtt = cfgs.map((c) => val(SIM.by_magnitude_180s, { config: c, magnitude: 2 }, "attainment"));
  s.addChart(p.charts.BAR, [
    { name: "Testbed (measured)", labels: ["B0 No bursting", "B1 Threshold", "PB PolicyBurst"], values: bedAtt.map((v) => Math.round(v * 10) / 10) },
    { name: "Simulation", labels: ["B0 No bursting", "B1 Threshold", "PB PolicyBurst"], values: simAtt.map((v) => Math.round(v * 10) / 10) },
  ], chartOpts({ x: 0.6, y: 1.75, w: 6.4, h: 4.9, barDir: "col", barGrouping: "clustered", title: "SLO attainment (%) at 2× / 180 s", chartColors: [K.ink, K.slate],
    showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: 100 }));
  const rows = [[hdr("Testbed, mean of " + val(BED.by_magnitude_180s, { config: "B1", magnitude: 2 }, "attainment", "n") + " runs"), hdr("B0"), hdr("B1"), hdr("PB")],
    ...[["SLO attainment (%)", "attainment", 1], ["p95 latency (ms)", "p95_ms", 0], ["Spend (₹, shadow)", "spend_inr", 1], ["Public node-hours", "public_node_hours", 2], ["Residency violations", "residency_violations", 0]].map(([label, m, d], i) =>
      [{ text: label, options: { bold: true, fill: { color: i % 2 ? K.white : K.bg2 } } }, ...cfgs.map((c) => ({ text: fmt(val(BED.by_magnitude_180s, { config: c, magnitude: 2 }, m), d), options: { align: "center", fill: { color: i % 2 ? K.white : K.bg2 } } }))])];
  table(s, rows, 7.3, 1.85, [2.4, 1.0, 1.0, 1.0], { fontSize: 13, rowH: 0.5 });
  txt(s, "B1 and PB rank differently: on the testbed pub-us measures ≈120 ms RTT and fits the SLO, so the latency filter removes nothing and PB only gives up foreign capacity for restricted pods. The model adds a 28 ms WAN base (148 ms), where filtering pub-us pays off.", 7.3, 5.0, 5.4, 1.65, { fontSize: 12, italic: true, color: K.muted });
}
source(s, "Testbed: k3s v1.35.5 via k3d on WSL2 (host DEATHSTAR, 16 vCPU); Locust 2.47, 4 processes. Raw data in results/testbed/.");

// ---------- 12. Ablation ----------
s = content(p, "Analysis", "Ablation: which component causes the gain?", `Repeated 2× bursts, ceiling binding: PolicyBurst gets ${pct(ablGain)} attainment per ₹ over threshold-only`);
const ABL = ["B1", "PB", "PB-noCost", "PB-noLat", "PB-noRes"];
const ablLabels = ["B1 Threshold-only", "PB (full)", "PB − cost accumulator", "PB − latency filter", "PB − residency filter"];
s.addChart(p.charts.BAR, [{ name: "Attainment per ₹100", labels: ablLabels, values: ABL.map((c) => Math.round(abl(c, "attainment_per_100inr") * 10) / 10) }],
  chartOpts({ x: 0.6, y: 1.75, w: 7.2, h: 4.9, barDir: "bar", title: "Attainment points per ₹100 (5 bursts, 3 reps)", chartColors: [K.amber, K.teal, "B5761A", K.slate, K.coral],
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", valAxisMinVal: 0, barGapWidthPct: 50, catAxisOrientation: "maxMin" }));
const ab = [
  ["− cost accumulator", "B5761A", `Attainment ${fmt(abl("PB-noCost", "attainment"))}% but spend ₹${fmt(abl("PB-noCost", "spend_inr"), 0)}: ceiling breached in every run. The accumulator is what makes PB efficient.`],
  ["− latency filter", K.slate, `Uses cheap pub-us: attainment falls to ${fmt(abl("PB-noLat", "attainment"))}% (from ${fmt(abl("PB", "attainment"))}%) for the same budget.`],
  ["− residency filter", K.coral, `Similar efficiency, but ${Math.round(abl("PB-noRes", "residency_violations")).toLocaleString("en-IN")} restricted requests served outside India per run.`],
];
ab.forEach((a, i) => {
  const y = 1.75 + i * 1.66;
  card(p, s, 8.1, y, 4.6, 1.5, K.bg2);
  txt(s, a[0], 8.3, y + 0.1, 4.2, 0.35, { fontSize: 15, bold: true, color: a[1] });
  txt(s, a[2], 8.3, y + 0.45, 4.2, 1.0, { fontSize: 13 });
});
source(s, "Simulation. Without the cost accumulator PolicyBurst behaves like the baseline on spend; the gain comes from budget-aware acquisition.");

// ---------- 13. Residency sweep (O4) ----------
s = content(p, "Analysis", "Parameter sweep: what residency costs (O4)",
  `Penalty is within noise up to 30% restricted traffic, then rises to ${fmt(penalty[4], 0)} pp at 70% as pub-in saturates`);
s.addChart(p.charts.LINE, [{ name: "Attainment penalty (pp)", labels: SHARES.map((x) => `${x * 100}%`), values: penalty.map((v) => Math.round(v * 10) / 10) }],
  chartOpts({ x: 0.6, y: 1.75, w: 6.0, h: 4.9, title: "Penalty: PB without residency minus PB (pp)", chartColors: [K.teal], showLegend: false,
    lineSize: 2.5, lineDataSymbolSize: 7, showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0.0", catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, [
  { name: "PB (residency on)", labels: SHARES.slice(1).map((x) => `${x * 100}%`), values: SHARES.slice(1).map((x) => Math.round(sweep("PB", x, "attainment_restricted"))) },
  { name: "PB without residency", labels: SHARES.slice(1).map((x) => `${x * 100}%`), values: SHARES.slice(1).map((x) => Math.round(sweep("PB-noRes", x, "attainment_restricted"))) },
], chartOpts({ x: 6.9, y: 1.75, w: 5.8, h: 4.9, barDir: "col", barGrouping: "clustered", title: "Attainment of restricted requests (%)", chartColors: [K.teal, K.coral],
  showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: 100, catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
source(s, "Simulation, 2× / 180 s bursts, 3 repetitions. Restricted work can only use private + pub-in; the cost of compliance is the capacity of one in-country node.");

// ---------- 14. Hypotheses verdict ----------
s = content(p, "Analysis", "Hypotheses: preliminary verdict", "Reported against the hypotheses as stated, including where the data disagrees");
const pbTables = [SIM.matrix_overall, SIM.ablation];
const simPbViol = Math.round(Math.max(...pbTables.map((t) => val(t, { config: "PB" }, "residency_violations"))));
const simPbBreaches = Math.round(Math.max(...pbTables.map((t) => val(t, { config: "PB" }, "ceiling_breached"))));
const bedPbViol = BED ? val(BED.matrix_overall, { config: "PB" }, "residency_violations") : null;
const h2Verdict = simPbViol === 0 && simPbBreaches === 0 && (bedPbViol === null || bedPbViol === 0) ? "Supported" : "Not supported";
const verdict = [
  ["H1", K.amber, "Partly supported", `Per-₹ gain ${MAGS.map((m, i) => `${m}×: ${pct(gainPerInr[i])}`).join(" · ")}. With a binding ceiling (repeated bursts): ${pct(ablGain)}. Fails at 2.5× because the static latency filter forgoes pub-us capacity.`],
  ["H2", K.teal, h2Verdict, `PolicyBurst: ${simPbBreaches} ceiling breaches and ${simPbViol} residency violations in ${SIM.runs} simulated runs; testbed: ${fmt(bedPbViol, 0)} violations. Threshold-only: ${Math.round(overall("B1", "residency_violations")).toLocaleString("en-IN")} violations per run on average (simulation); ceiling breached in every repeated-burst run.`],
  ["H3", K.teal, "Supported at 30%", `Penalty at 30% restricted: ${fmt(penalty[2])} pp (≤ 10 pp). It grows to ${fmt(penalty[3])} pp at 50% and ${fmt(penalty[4])} pp at 70%.`],
];
verdict.forEach((v, i) => {
  const y = 1.8 + i * 1.6;
  card(p, s, 0.6, y, 12.1, 1.42, K.white, { line: K.line, shadow: true });
  badge(p, s, 0.8, y + 0.3, 0.8, K.ink, v[0], 16);
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 1.85, y: y + 0.45, w: 2.3, h: 0.5, fill: { color: v[1] }, line: { color: v[1] }, rectRadius: 0.08 });
  txt(s, v[2], 1.85, y + 0.45, 2.3, 0.5, { fontSize: 14, bold: true, color: K.white, align: "center", valign: "middle" });
  txt(s, v[3], 4.4, y + 0.12, 8.1, 1.2, { fontSize: 14, valign: "middle" });
});

// ---------- 15. Threats to validity ----------
s = content(p, "Analysis", "Threats to validity", "What our setup cannot prove");
const th = [
  ["Simulation model", "Fluid queues and an M/M/1-style service time approximate the app; the testbed check covers one burst size only."],
  ["One host, emulated WAN", "All testbed nodes share one machine; pub-sg/pub-us are netem delays, not real foreign regions, so jitter and loss are idealised."],
  ["Cost is modelled", "Free tier bills ₹0, so spend is shadow-priced and time-compressed ×100; egress, storage and billing rounding are ignored."],
  ["Synthetic load", "Locust bursts are square waves; real campus demand ramps, overlaps and has diurnal patterns."],
  ["Residency ≠ legal compliance", "Enforced at pod placement only. Logs, backups, DNS and the control plane may still cross borders."],
  ["Small scale", "5 nodes, 3 services, 3 repetitions; CI widths are large at 2–2.5× where outcomes depend on start-up timing."],
];
th.forEach((t, i) => {
  const x = 0.6 + (i % 3) * 4.1, y = 1.85 + Math.floor(i / 3) * 2.45;
  card(p, s, x, y, 3.8, 2.2, i % 2 ? K.bg2 : K.white, { line: K.line });
  badge(p, s, x + 0.2, y + 0.2, 0.55, K.coral, "!", 16);
  txt(s, t[0], x + 0.9, y + 0.22, 2.75, 0.5, { fontSize: 16, bold: true, color: K.ink, valign: "middle" });
  txt(s, t[1], x + 0.2, y + 0.9, 3.4, 1.25, { fontSize: 13 });
});

// ---------- 16. Next steps ----------
s = content(p, "Next steps", "Road to the final review", "Close the H1 gap and move from emulation to a real public region");
const nx = [
  ["1", "Queue-aware latency", "Admit a slow region when local queueing delay is worse (fixes 2.5×)"],
  ["2", "Real public node", "Join one free-tier VM in an Indian region; repeat the testbed check"],
  ["3", "Wider testbed check", "All burst sizes on the cluster, not only 2×"],
  ["4", "Write-up", "DPDP-aware bursting paper draft; artefact on GitHub"],
];
nx.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  badge(p, s, x, 2.0, 0.9, i % 2 ? K.amber : K.teal, r[0], 20);
  if (i < 3) arrow(p, s, x + 1.0, 2.45, x + 3.0, 2.45, K.line);
  txt(s, r[1], x, 3.15, 2.8, 0.45, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x, 3.65, 2.8, 1.2, { fontSize: 14 });
});
card(p, s, 0.6, 5.3, 12.1, 1.4, K.bg2);
txt(s, [{ text: "Reproduce everything: ", options: { bold: true } }, { text: "sudo ./deploy/k3d/create-local-testbed.sh · python experiments/run_matrix.py … · python -m sim.run all · python analysis/aggregate.py — see the README." }], 0.85, 5.4, 11.6, 1.2, { fontSize: 15, valign: "middle" });

// ---------- 17. Close ----------
s = darkSlide(p, "Next steps");
s.addText("Thank you — questions?", { placeholder: "title" });
s.addText("PolicyBurst: residency, latency and budget decide where work may go — before the controller decides where it should go.", { placeholder: "body" });

save(p, OUT);
