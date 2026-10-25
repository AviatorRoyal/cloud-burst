const { K, newDeck, content, darkSlide, card, badge, txt, bullets, code, arrow, todoTag, chartOpts, table, hdr, save } = require("./common");
const OUT = process.argv[2];
const p = newDeck("Review 1", "P11 Review 1 — Problem Formulation and Baseline");

// ---------- 1. Title ----------

let s = darkSlide(p, "Introduction");
s.addText("Policy-Driven Cloud Bursting Under Cost, Latency and Data-Residency Constraints", { placeholder: "title" });
s.addText([
  { text: "Review 1 — Problem Formulation and Baseline  ·  27/08/2026", options: { bold: true, color: K.white, breakLine: true } },
  { text: "Project P11  ·  Cloud Computing", options: { breakLine: true } },
  { text: "Ramanuj Agarwal  ·  23BCE1861   |   Guide: Indra Priyadarshini S." },
], { placeholder: "body" });
badge(p, s, 0.8, 0.8, 0.7, K.teal, "PVT", 12);
arrow(p, s, 1.6, 1.15, 2.5, 1.15, "CADCE8");
badge(p, s, 2.6, 0.8, 0.7, K.amber, "PUB", 12);
s.addNotes("Introduce the team and the project. One line: we are building a cloud-bursting controller that treats cost ceiling, latency and data residency as first-class inputs.");

// ---------- 2. Rubric map ----------
s = content(p, "Introduction", "What this review covers", "Each rubric component maps to a section of the deck");
const rub = [
  ["3", "Literature survey", "15 papers (2021–2024) as a gap table", "Slides 6–8"],
  ["2", "Problem & hypothesis", "Own restatement + falsifiable claim", "Slides 3–5"],
  ["3", "Testbed evidence", "k3s private + public node joined, screenshots", "Slides 9–10"],
  ["2", "Baseline reproduced", "Threshold-only and no-burst runs with numbers", "Slides 11–12"],
];
rub.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 2.0, 2.8, 3.6, K.bg2, { shadow: true });
  badge(p, s, x + 0.3, 2.3, 0.9, i % 2 ? K.amber : K.teal, r[0] + "m", 18);
  txt(s, r[1], x + 0.3, 3.45, 2.3, 0.5, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x + 0.3, 4.0, 2.3, 1.2, { fontSize: 14 });
  txt(s, r[3], x + 0.3, 5.0, 2.3, 0.4, { fontSize: 14, bold: true, color: K.slate });
});
s.addNotes("Total 10 marks. We organised the deck so each rubric line has explicit evidence.");

// ---------- 3. Background ----------
s = content(p, "Problem", "Cloud bursting in one picture", "Private capacity is sized for typical load; public capacity absorbs the peaks");
const hrs = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];
s.addChart(p.charts.LINE, [
  { name: "Demand (pods)", labels: hrs, values: [18, 15, 14, 16, 30, 52, 61, 58, 66, 49, 32, 22] },
  { name: "Private capacity", labels: hrs, values: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40] },
], chartOpts({ x: 0.6, y: 1.8, w: 7.2, h: 4.9, title: "Conceptual daily demand vs fixed private capacity", chartColors: [K.amber, K.teal],
  lineSize: 2.5, lineDataSymbol: "none", valAxisTitle: "Pods", showValAxisTitle: true, catAxisTitle: "Hour of day", showCatAxisTitle: true }));
const qs = [["When", "to burst — what signal and how early?"], ["How much", "capacity to acquire — and for how long?"], ["Which work", "goes outward — and to which destination?"]];
qs.forEach((q, i) => {
  const y = 1.9 + i * 1.6;
  card(p, s, 8.2, y, 4.5, 1.35, i === 2 ? K.amberL : K.bg2);
  txt(s, q[0], 8.45, y + 0.18, 4.0, 0.45, { fontSize: 20, bold: true, color: K.ink });
  txt(s, q[1], 8.45, y + 0.65, 4.0, 0.6, { fontSize: 14 });
});
s.addNotes("Explain bursting: the area above the teal line is overflow. A bursting controller answers three questions. The third — which work — is where policy matters.");

// ---------- 4. Problem in our words ----------
s = content(p, "Problem", "The problem, in our words", "A single-threshold controller is blind to the rules that actually govern an institution's bursting decision");
code(p, s, "# typical production rule\nif cpu_util > 0.80 or pending_pods > 0:\n    add_public_node()\n    schedule_overflow(anywhere)", 0.6, 1.9, 5.2, 1.7, 14);
txt(s, "What it optimises: keeping pods running.\nWhat it ignores: who pays, where the data goes, and whether the destination is fast enough.", 0.6, 3.85, 5.2, 1.4, { fontSize: 15 });
card(p, s, 0.6, 5.45, 5.2, 1.25, K.coralL);
txt(s, "Result: decisions that are operationally correct but administratively or legally unacceptable.", 0.8, 5.6, 4.8, 1.0, { fontSize: 15, bold: true, color: K.coral, valign: "middle" });
const cons = [
  [K.amber, "₹", "Monthly expenditure ceiling", "Public spend must never exceed the approved budget — a hard cap, not a soft preference."],
  [K.slate, "ms", "Latency requirement", "Some public regions cannot meet the service-level latency; sending work there fails the SLO anyway."],
  [K.teal, "IN", "Data residency", "Data classed as restricted (e.g. personal data under the DPDP Act 2023) must stay inside India."],
];
cons.forEach((c, i) => {
  const y = 1.9 + i * 1.62;
  card(p, s, 6.3, y, 6.4, 1.42, K.white, { line: K.line, shadow: true });
  badge(p, s, 6.5, y + 0.3, 0.8, c[0], c[1], 16);
  txt(s, c[2], 7.5, y + 0.15, 5.0, 0.4, { fontSize: 17, bold: true, color: K.ink });
  txt(s, c[3], 7.5, y + 0.58, 5.0, 0.8, { fontSize: 14 });
});
s.addNotes("Restate the given problem in our own words. The three constraints are what make bursting an institutional decision, not just a scheduling one.");

// ---------- 5. Hypothesis ----------
s = content(p, "Problem", "Falsifiable hypotheses", "Method X reduces metric M by at least N% compared to baseline B under condition C");
const hyp = [
  ["H1", K.teal, "Efficiency (O1–O3)",
    [{ text: "PolicyBurst ", options: { bold: true } }, { text: "improves " }, { text: "SLO attainment per ₹ spent ", options: { bold: true } }, { text: "by " }, { text: "≥ 25% ", options: { bold: true, color: K.teal } },
     { text: "over " }, { text: "threshold-only bursting ", options: { bold: true } }, { text: "under bursts of 2–6× private capacity with a fixed monthly ceiling." }]],
  ["H2", K.amber, "Hard-constraint compliance",
    [{ text: "PolicyBurst records " }, { text: "zero ", options: { bold: true, color: K.amber } }, { text: "ceiling breaches and " }, { text: "zero ", options: { bold: true, color: K.amber } },
     { text: "residency violations in every run, while the threshold baseline breaches the ceiling whenever cumulative burst load exceeds the budget." }]],
  ["H3", K.slate, "Cost of compliance (O4)",
    [{ text: "With 30% of traffic tagged restricted, enforcing residency lowers SLO attainment by " }, { text: "≤ 10 percentage points ", options: { bold: true, color: K.slate } },
     { text: "compared to the same controller with residency disabled." }]],
];
hyp.forEach((h, i) => {
  const y = 1.85 + i * 1.32;
  card(p, s, 0.6, y, 8.4, 1.15, K.bg2);
  badge(p, s, 0.8, y + 0.18, 0.8, h[1], h[0], 16);
  txt(s, h[2], 1.8, y + 0.1, 7.0, 0.3, { fontSize: 12, bold: true, color: K.muted });
  txt(s, h[3], 1.8, y + 0.4, 7.0, 0.72, { fontSize: 14 });
});
card(p, s, 9.4, 1.85, 3.3, 3.79, K.white, { line: K.line });
txt(s, "Definitions", 9.6, 2.0, 2.9, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets([
  "SLO: request succeeds within 300 ms",
  "Attainment: share of all requests meeting SLO (rejections count as misses)",
  "₹ spent: public node-hours × published on-demand rate (shadow price)",
  "Burst: load above private capacity for 1–5 min",
], { gap: 4 }), 9.6, 2.45, 2.95, 3.1, { fontSize: 13 });
card(p, s, 0.6, 5.85, 12.1, 0.85, K.coralL);
txt(s, [{ text: "Falsified if: ", options: { bold: true, color: K.coral } }, { text: "the gain in H1 is under 25% across the burst matrix, any PolicyBurst run breaches the ceiling or residency, or the H3 penalty exceeds 10 pp." }],
  0.85, 5.92, 11.6, 0.7, { fontSize: 14, valign: "middle" });
s.addNotes("PolicyBurst is our name for the proposed controller. Free-tier VMs cost nothing in reality, so spend is measured with shadow pricing at the provider's published on-demand rate. Thresholds (25%, 10 pp) are our commitments; we will report honestly if they fail.");

// ---------- 6-7. Literature gap table ----------
const lit = [
  ["Stoica & Shenker, HotOS 2021 — From Cloud Computing to Sky Computing", "Vision of an intercloud broker over interoperable clouds", "Position paper", "Qualitative", "No controller or evaluation; constraints discussed only abstractly"],
  ["Wiesner et al., Middleware 2021 — Let's Wait Awhile", "Temporal shifting of delay-tolerant jobs to low-carbon hours", "Simulation on 2020 grid-carbon data (DE, GB, FR, CA)", "CO₂ saved", "Single objective (carbon); no budget, latency or residency limits"],
  ["Ju, Singh & Toor, UCC 2021 Companion — Proactive Autoscaling for Edge with Kubernetes", "Forecast-driven proactive pod autoscaler", "Kubernetes edge cluster", "Utilisation, response time", "Scales inside one cluster; no external capacity or cost cap"],
  ["Toka et al., IEEE TNSM 2021 — ML-based scaling management for Kubernetes edge clusters", "ML forecasting drives scaling decisions", "Kubernetes edge clusters, request traces", "Lost requests, resources used", "Single cluster; no cost or data-placement policy"],
  ["Phuc, Phan & Kim, IEEE Access 2022 — Traffic-Aware HPA in Kubernetes Edge", "HPA that places replicas by per-node traffic", "Kubernetes edge testbed", "Throughput, response time", "Placement by traffic only; ignores cost and jurisdiction"],
  ["Xiao, Zhou, Yang & He, FGCS 130, 2022 — Privacy-preserving workflow scheduling in geo-distributed DCs", "Workflow scheduling with privacy limits on cross-DC data movement", "Simulation, scientific workflows", "Makespan, cost", "Offline workflow planning; no live bursting or spend ceiling"],
  ["Iorio et al., IEEE TCC 2023 — Computing Without Borders (Liqo)", "Peers Kubernetes clusters; offloads pods via a virtual node", "Liqo on real multi-cluster Kubernetes", "Overhead, latency", "Mechanism, not policy: no cost- or residency-aware decision"],
  ["Yang et al., NSDI 2023 — SkyPilot: An Intercloud Broker", "Optimiser picks cheapest cloud/region meeting job needs", "AWS, GCP, Azure; ML & batch jobs", "Cost, completion time", "Batch jobs, public-only; region limits set manually"],
];
const lit2 = [
  ["Yang, Xia, Ye, Gao & Zhan, IEEE TCC 2023 — HPCP-PSO workflow scheduling", "PSO minimises cost within a workflow deadline", "Simulated cloud, scientific workflows", "Cost, deadline success", "Single public cloud; no residency; static workflows"],
  ["TanGo, IEEE INFOCOM 2023 — Tenant task placement in geo-distributed clouds", "Submodular (1−1/e) approximation for placement", "Simulation, geo-distributed regions", "Electricity cost", "Sovereignty cited as motivation, not modelled; offline"],
  ["Tekawade & Banerjee, COMSNETS 2023 — Reliability-aware multi-cloud task-graph scheduler", "Cost-effective, reliability-aware scheduling", "Simulation", "Cost, reliability", "No private/public split, no residency constraint"],
  ["Luo et al., USENIX ATC 2024 — Starburst: Cost-aware Scheduler for Hybrid Cloud", "Waiting budget: big jobs wait for private, small jobs burst", "Production traces + 32-GPU private cluster", "Cloud cost, JCT", "Cost–JCT trade-off only; no hard ceiling, latency or residency"],
  ["Wu et al., NSDI 2024 — Can't Be Late: Spot Savings under Deadlines", "Uniform Progress: spot with on-demand fallback", "SkyPilot on public cloud, real workloads", "Cost saved, deadlines met", "Deadline + cost only; no jurisdiction or private cluster"],
  ["Abdi, Ashjaei & Mubeen, FGCS 2024 — Deadline-constrained security-aware workflow scheduling in hybrid cloud", "Keeps sensitive tasks private, minimises cost under deadline", "Simulation, scientific workflows", "Monetary cost", "Closest to residency, but offline and simulated; no live controller"],
  ["Sukprasert et al., EuroSys 2024 — Carbon-aware temporal and spatial workload shifting", "Trace-driven analysis of shifting across time and regions", "Grid carbon-intensity traces", "Carbon reduction", "Analysis study; no controller, no policy enforcement"],
];
const litHead = [hdr("Paper"), hdr("Method"), hdr("Dataset / testbed"), hdr("Metric"), hdr("Limitation (gap)")];
const litCols = [3.55, 2.65, 2.3, 1.45, 2.15];
const litRows = (arr) => [litHead, ...arr.map((r, i) => r.map((c, j) => ({ text: c, options: { fill: { color: i % 2 ? K.white : K.bg2 }, bold: j === 0, color: j === 4 ? K.coral : K.text } })))];
s = content(p, "Literature", "Literature survey — gap table (1 of 2)", "15 papers, 2021 onwards, ordered by year");
table(s, litRows(lit), 0.6, 1.75, litCols, { fontSize: 10.5 });
s.addNotes("Read the limitation column: every paper handles at most one or two of our three constraints, and most are simulated.");
s = content(p, "Literature", "Literature survey — gap table (2 of 2)", "Closest prior work: Starburst (cost-aware bursting) and Abdi et al. (sensitive tasks kept private)");
table(s, litRows(lit2), 0.6, 1.75, litCols, { fontSize: 10.5 });
s.addNotes("Starburst is the closest bursting system but optimises a cost-latency trade-off with no hard ceiling and no residency. Abdi et al. is the closest on sensitivity but is offline and simulated.");

// ---------- 8. Gap synthesis ----------
s = content(p, "Literature", "The gap: no one enforces all three, live", "Residency is almost never a first-class input to a bursting decision");
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
txt(s, "“Partial” = treated as a soft objective, a manual setting, or only in simulation. Cells summarise the papers' stated scope.", 0.6, 6.45, 12.1, 0.35, { fontSize: 11, color: K.muted, italic: true });
s.addNotes("This matrix is our contribution statement. The bottom row is what we must demonstrate by the final review.");

// ---------- 9. Testbed architecture ----------
s = content(p, "Testbed", "Testbed design", "Private k3s cluster on campus hardware, public free-tier nodes joined over an encrypted overlay");
card(p, s, 0.6, 1.85, 5.6, 4.85, K.tealL);
txt(s, "PRIVATE CAPACITY — on-prem, India", 0.85, 2.0, 5.1, 0.35, { fontSize: 13, bold: true, color: K.teal });
const pv = ["k3s server (control plane)", "k3s agent-1 · agent-2 (Ubuntu VMs)", "Prometheus + metrics-server", "PolicyBurst controller (Python)", "Sample app: 3 services, data-class labels"];
pv.forEach((t, i) => { card(p, s, 0.85, 2.45 + i * 0.82, 5.1, 0.64, K.white, { line: K.teal }); txt(s, t, 1.05, 2.45 + i * 0.82, 4.8, 0.64, { fontSize: 14, valign: "middle" }); });
card(p, s, 7.1, 1.85, 5.6, 3.3, K.amberL);
txt(s, "PUBLIC OVERFLOW POOL", 7.35, 2.0, 5.1, 0.35, { fontSize: 13, bold: true, color: "B5761A" });
const pb = [["pub-in: free-tier VM, Indian region", "region=IN · tainted burst=public"], ["pub-far: same VM + 120 ms netem delay", "region=non-IN (emulated far region)"]];
pb.forEach((t, i) => { const y = 2.45 + i * 1.3; card(p, s, 7.35, y, 5.1, 1.1, K.white, { line: K.amber }); txt(s, [{ text: t[0], options: { bold: true, breakLine: true } }, { text: t[1], options: { color: K.muted } }], 7.55, y + 0.12, 4.8, 0.9, { fontSize: 14 }); });
txt(s, "WireGuard / Tailscale overlay", 6.25, 3.05, 0.85, 1.2, { fontSize: 10, color: K.muted, align: "center", valign: "middle" });
arrow(p, s, 6.2, 4.4, 7.1, 4.4, K.ink); arrow(p, s, 7.1, 2.9, 6.2, 2.9, K.ink);
card(p, s, 7.1, 5.45, 5.6, 1.25, K.bg2);
txt(s, [{ text: "Locust load generator ", options: { bold: true } }, { text: "drives bursts of 2–6× capacity for 1–5 min against the app ingress; results land in CSV + Prometheus." }], 7.35, 5.55, 5.1, 1.05, { fontSize: 14, valign: "middle" });
s.addNotes("Free-tier options: Oracle Cloud Always Free (Hyderabad/Mumbai) or AWS free tier in ap-south-1. A second public destination outside India is emulated with tc netem delay plus a non-IN region label, since a second paid region is out of budget — we state this as a threat to validity.");

// ---------- 10. Testbed evidence ----------
s = content(p, "Testbed", "Testbed evidence: the environment runs", "Rubric: a screenshot or log proving it runs — slides alone score 0");
const ev = [
  ["kubectl get nodes -o wide --show-labels", "Private server + agents and the public node(s) all Ready, with region labels"],
  ["kubectl get pods -A -o wide", "App pods on private nodes; Prometheus and controller running"],
];
ev.forEach((e, i) => {
  const x = 0.6 + i * 6.2;
  card(p, s, x, 1.8, 5.9, 3.85, K.bg2, { line: K.line, dash: "dash" });
  todoTag(p, s, x + 0.2, 1.95, "INSERT SCREENSHOT FROM YOUR TESTBED", 3.6);
  txt(s, e[1], x + 0.3, 2.5, 5.3, 0.8, { fontSize: 14, color: K.muted });
  code(p, s, "$ " + e[0], x + 0.3, 3.45, 5.3, 0.6, 13);
  txt(s, "Paste screenshot here (crop to the terminal, include hostname and timestamp)", x + 0.3, 4.3, 5.3, 1.0, { fontSize: 12, italic: true, color: K.muted, align: "center", valign: "middle" });
});
card(p, s, 0.6, 5.85, 12.1, 0.85, K.tealL);
txt(s, [{ text: "Also attach: ", options: { bold: true } }, { text: "k3s agent join log from the public VM · Locust web UI at a burst peak · `kubectl describe node pub-in` showing taints and labels." }], 0.85, 5.9, 11.6, 0.75, { fontSize: 14, valign: "middle" });
s.addNotes("Replace the two frames with real screenshots before the review. Timestamps and hostnames make it obvious the environment is ours and live.");

// ---------- 11. Baselines ----------
s = content(p, "Baseline", "Baselines named in the statement", "Both baselines share the same app, load and metrics as PolicyBurst — only the decision logic differs");
card(p, s, 0.6, 1.85, 5.9, 4.85, K.bg2);
badge(p, s, 0.85, 2.05, 0.8, K.muted, "B0", 16);
txt(s, "No bursting", 1.85, 2.15, 4.4, 0.5, { fontSize: 20, bold: true, color: K.ink });
txt(s, bullets([
  "Public node cordoned; private cluster absorbs or rejects all load",
  "HPA scales replicas up to private node limits",
  "Excess requests queue, time out, or receive 503",
  "Lower bound on attainment, zero spend",
]), 0.85, 3.0, 5.4, 3.5, { fontSize: 15 });
card(p, s, 6.8, 1.85, 5.9, 4.85, K.amberL);
badge(p, s, 7.05, 2.05, 0.8, K.amber, "B1", 16);
txt(s, "Threshold-only bursting", 8.05, 2.15, 4.4, 0.5, { fontSize: 20, bold: true, color: K.ink });
code(p, s, "every 15 s:\n  if cpu > 75% or pending > 0 for 30 s:\n      uncordon public node\n      add toleration -> any pod\n  if cpu < 40% for 5 min:\n      drain + cordon public node", 7.05, 2.9, 5.4, 2.1, 12);
txt(s, bullets([
  "No spend ceiling, no latency or residency check",
  "Same reconcile loop as PolicyBurst with constraints switched off",
]), 7.05, 5.2, 5.4, 1.4, { fontSize: 14 });
s.addNotes("Implementing B1 inside our own codebase (constraints disabled) keeps the comparison fair: any gain comes from the policy, not from different plumbing.");

// ---------- 12. Baseline numbers ----------
s = content(p, "Baseline", "Baseline reproduced: first numbers", "Reference burst: 4× private capacity for 3 min, 3 repetitions, mean ± sd");
const bRows = [
  [hdr("Config"), hdr("SLO attainment (%)"), hdr("p95 latency (ms)"), hdr("Rejected / failed req."), hdr("Public node-hours"), hdr("Spend (₹, shadow)"), hdr("Attainment per ₹100")],
  ...["B0 — No bursting", "B1 — Threshold-only"].map((n, i) => [{ text: n, options: { bold: true, fill: { color: i ? K.amberL : K.bg2 } } },
    ...Array(6).fill(0).map(() => ({ text: "___", options: { align: "center", color: K.coral, fill: { color: i ? K.amberL : K.bg2 } } }))]),
];
table(s, bRows, 0.6, 1.85, [2.5, 1.65, 1.65, 1.75, 1.55, 1.5, 1.5], { fontSize: 13, rowH: 0.55 });
todoTag(p, s, 9.1, 1.4, "FILL FROM results/baseline_*.csv", 3.6);
card(p, s, 0.6, 3.75, 7.4, 2.95, K.bg2, { line: K.line, dash: "dash" });
todoTag(p, s, 0.8, 3.9, "INSERT PLOT: latency over time, B0 vs B1", 3.6);
txt(s, "Locust response-time plot across the burst window, with the 300 ms SLO line", 0.9, 4.5, 6.8, 1.9, { fontSize: 13, italic: true, color: K.muted, align: "center", valign: "middle" });
card(p, s, 8.3, 3.75, 4.4, 2.95, K.white, { line: K.line });
txt(s, "What we expect to see", 8.5, 3.9, 4.0, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets(["B0: attainment collapses during the burst; zero spend", "B1: attainment recovers, spend grows without bound", "Neither respects residency — the gap PolicyBurst closes"], { gap: 4 }), 8.5, 4.35, 4.0, 2.25, { fontSize: 14 });
s.addNotes("Fill this table from the actual baseline runs before the review. The rubric only credits a baseline that runs and produces numbers.");

// ---------- 13. Plan ----------
s = content(p, "Plan", "Plan to Review 2", "Objectives O1 and O2 evidenced in code by 23/09/2026");
const plan = [
  ["Wk 1", "Policy model", "BurstPolicy CRD, data-class labels, destination catalogue"],
  ["Wk 2", "Feasibility filters", "Residency + latency filters; RTT probes to each destination"],
  ["Wk 3", "Cost accumulator", "Shadow-priced metering, projected-spend gate, halt at ceiling"],
  ["Wk 4", "Experiments", "Burst matrix × 4 configs × 3 reps; first comparison graphs"],
];
plan.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  badge(p, s, x, 2.0, 0.9, i % 2 ? K.amber : K.teal, r[0], 13);
  if (i < 3) arrow(p, s, x + 1.0, 2.45, x + 3.0, 2.45, K.line);
  txt(s, r[1], x, 3.15, 2.8, 0.45, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x, 3.65, 2.8, 1.3, { fontSize: 14 });
});
card(p, s, 0.6, 5.4, 12.1, 1.3, K.bg2);
txt(s, [{ text: "Repository: ", options: { bold: true } }, { text: "github.com/AviatorRoyal/cloud-burst — controller, baselines, Locust shapes, experiment runner and analysis scripts, all version-controlled from day one." }], 0.85, 5.5, 11.6, 1.1, { fontSize: 15, valign: "middle" });

// ---------- 14. References ----------
s = content(p, "Plan", "References", null);
const refs = [...lit, ...lit2].map((r) => r[0]);
const half = Math.ceil(refs.length / 2);
[refs.slice(0, half), refs.slice(half)].forEach((col, c) => {
  txt(s, col.map((t, i) => ({ text: `[${c * half + i + 1}] ${t}`, options: { breakLine: i < col.length - 1, paraSpaceAfter: 6 } })), 0.6 + c * 6.2, 1.45, 5.9, 5.3, { fontSize: 13 });
});

// ---------- 15. Close ----------
s = darkSlide(p, "Plan");
s.addText("Thank you — questions?", { placeholder: "title" });
s.addText("Hypothesis: constraint-aware bursting gives ≥ 25% more SLO attainment per ₹, with zero ceiling or residency violations.", { placeholder: "body" });

save(p, OUT);
