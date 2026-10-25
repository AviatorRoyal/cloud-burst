const { K, newDeck, content, darkSlide, card, badge, txt, bullets, code, arrow, todoTag, chartOpts, table, hdr, save } = require("./common");
const OUT = process.argv[2];
const p = newDeck("Review 2", "P11 Review 2 — Implementation and Preliminary Results");
const ILL = "ILLUSTRATIVE VALUES — REPLACE WITH MEASURED";

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
  ["3", "Results vs baseline", "Baseline and PolicyBurst on the same axes", "Slides 9–10"],
  ["2", "Ablation & sweep", "Which component causes the gain; behaviour vs load", "Slides 11–12"],
  ["1", "Threats to validity", "What our setup cannot prove", "Slide 13"],
];
rub.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 2.0, 2.8, 3.6, K.bg2, { shadow: true });
  badge(p, s, x + 0.3, 2.3, 0.9, i % 2 ? K.amber : K.teal, r[0] + "m", 18);
  txt(s, r[1], x + 0.3, 3.45, 2.3, 0.5, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x + 0.3, 4.0, 2.3, 0.9, { fontSize: 14 });
  txt(s, r[3], x + 0.3, 5.0, 2.3, 0.4, { fontSize: 14, bold: true, color: K.slate });
});

// ---------- 3. Recap ----------
s = content(p, "Introduction", "Recap from Review 1", "Hypotheses unchanged; the testbed and both baselines now run end to end");
const rc = [
  ["H1", K.teal, "≥ 25% more SLO attainment per ₹ than threshold-only bursting under 2–6× bursts with a fixed ceiling"],
  ["H2", K.amber, "Zero ceiling breaches and zero residency violations in every PolicyBurst run"],
  ["H3", K.slate, "Residency enforcement (30% restricted traffic) costs ≤ 10 pp of SLO attainment"],
];
rc.forEach((h, i) => {
  const y = 1.9 + i * 1.15;
  badge(p, s, 0.6, y, 0.8, h[1], h[0], 16);
  txt(s, h[2], 1.65, y, 6.0, 0.8, { fontSize: 15, valign: "middle" });
});
card(p, s, 8.1, 1.85, 4.6, 3.35, K.bg2);
txt(s, "Changed since Review 1", 8.35, 2.0, 4.1, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets([
  "Policy moved from config file to a BurstPolicy CRD",
  "Latency check uses live RTT probes, not static values",
  "Cost gate projects spend before acquiring capacity",
  "<add any change your team made>",
], { gap: 4 }), 8.35, 2.45, 4.1, 2.7, { fontSize: 14 });
card(p, s, 0.6, 5.5, 12.1, 1.2, K.tealL);
txt(s, [{ text: "Review 1 feedback addressed: ", options: { bold: true } }, { text: "<list each comment from the panel and how it was handled>" }], 0.85, 5.6, 11.6, 1.0, { fontSize: 15, valign: "middle" });

// ---------- 4. Controller design (O1) ----------
s = content(p, "Implementation", "O1 — Constraints are inputs, not post-hoc filters", "Every decision is made inside the feasible set defined by residency, latency and budget");
const steps = [
  ["1", K.muted, "Observe", "Pending pods, CPU, queue depth, p95 latency (Prometheus)"],
  ["2", K.teal, "Residency", "data-class label → permitted regions (hard)"],
  ["3", K.slate, "Latency", "probe RTT + service time ≤ SLO budget"],
  ["4", K.amber, "Budget", "spent + projected ≤ ceiling − reserve"],
  ["5", K.ink, "Act", "cheapest feasible destination; else queue / reject with reason"],
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
txt(s, [{ text: "Baseline (post-hoc)", options: { bold: true, color: K.coral, breakLine: true } }, { text: "decide to burst → then check rules → discard or violate. Budget and residency are found to be broken after capacity is bought." }], 0.85, 4.9, 5.4, 1.7, { fontSize: 14 });
card(p, s, 6.8, 4.75, 5.9, 1.95, K.tealL);
txt(s, [{ text: "PolicyBurst (constraint-first)", options: { bold: true, color: K.teal, breakLine: true } }, { text: "build the feasible destination set first → choose within it. If the set is empty the request is rejected and logged with a reason code (O4 metric)." }], 7.05, 4.9, 5.4, 1.7, { fontSize: 14 });

// ---------- 5. Policy as input ----------
s = content(p, "Implementation", "Policy as a Kubernetes object", "Administrators change rules with kubectl apply — no controller rebuild");
code(p, s, [
  "apiVersion: p11.burst/v1",
  "kind: BurstPolicy",
  "metadata: { name: campus-default }",
  "spec:",
  "  monthlyCeilingINR: 2000",
  "  reserveINR: 100",
  "  sloLatencyMs: 300",
  "  destinations:",
  "  - {name: private, region: IN, ratePerHourINR: 0}",
  "  - {name: pub-in, region: IN, ratePerHourINR: 1.8}",
  "  - {name: pub-far, region: non-IN, ratePerHourINR: 1.2}",
  "  residency:",
  "    restricted: [IN]",
  "    internal:   [IN, non-IN]",
  "    public:     [IN, non-IN]",
].join("\n"), 0.6, 1.85, 6.6, 4.85, 13);
txt(s, "Workload labels", 7.6, 1.9, 5.1, 0.4, { fontSize: 17, bold: true, color: K.ink });
const lab = [
  [hdr("p11.burst/data-class"), hdr("Example"), hdr("May run on")],
  ["restricted", "Student records, Aadhaar-linked data", "private, pub-in"],
  ["internal", "Timetable, LMS content", "all"],
  ["public", "Static site, open datasets", "all"],
].map((r, i) => i ? r.map((c, j) => ({ text: c, options: { bold: j === 0, fill: { color: i === 1 ? K.tealL : K.white } } })) : r);
table(s, lab, 7.6, 2.4, [1.55, 2.0, 1.55], { fontSize: 12, rowH: 0.5 });
txt(s, "Rates are shadow prices (provider's published on-demand rate for the instance type), because free-tier usage costs ₹0 in reality.", 7.6, 4.75, 5.1, 0.9, { fontSize: 13, italic: true, color: K.muted });
todoTag(p, s, 7.6, 5.85, "REPLACE RATES WITH YOUR PROVIDER'S PRICES", 4.2);

// ---------- 6. Repository (O2) ----------
s = content(p, "Implementation", "O2 — Implementation in a version-controlled repo", "Python controller on the official Kubernetes client, running in-cluster on k3s");
code(p, s, [
  "p11-cloud-bursting/",
  "├── controller/",
  "│   ├── main.py          # 15 s reconcile loop",
  "│   ├── policy.py        # BurstPolicy CRD watcher",
  "│   ├── feasibility.py   # residency + latency filters",
  "│   ├── cost.py          # cost accumulator",
  "│   └── actuator.py      # uncordon/drain, node affinity",
  "├── baselines/threshold.py   # B1 (constraints off)",
  "├── deploy/              # CRD, RBAC, sample app, Prometheus",
  "├── load/locustfile.py   # burst LoadTestShape",
  "├── experiments/run_matrix.py",
  "└── analysis/plots.ipynb",
].join("\n"), 0.6, 1.85, 6.9, 4.85, 13);
card(p, s, 7.8, 1.85, 4.9, 2.6, K.bg2, { line: K.line, dash: "dash" });
todoTag(p, s, 8.0, 2.0, "INSERT SCREENSHOT: COMMIT HISTORY", 3.6);
txt(s, "git log --oneline --graph, or the GitHub commits page, showing work spread over the weeks", 8.0, 2.5, 4.5, 1.8, { fontSize: 13, italic: true, color: K.muted, align: "center", valign: "middle" });
card(p, s, 7.8, 4.7, 4.9, 2.0, K.white, { line: K.line });
txt(s, [{ text: "Repo: ", options: { bold: true } }, { text: "github.com/<team>/p11-cloud-bursting", options: { breakLine: true } },
  { text: "Live demo: ", options: { bold: true } }, { text: "kubectl apply a policy, start a burst, watch pods land on pub-in only for restricted traffic." }], 8.0, 4.85, 4.5, 1.75, { fontSize: 14 });

// ---------- 7. Cost accumulator ----------
s = content(p, "Implementation", "The cost accumulator", "Projects spend before buying capacity, so the ceiling is never crossed — it is approached");
code(p, s, [
  "def can_acquire(dest, lease_h):",
  "    spent = meter.total_inr()        # node-hours × rate",
  "    burn  = meter.current_rate_inr_h()",
  "    left  = hours_left_in_month()",
  "    projected = spent + (burn + dest.rate) * min(lease_h, left)",
  "    return projected <= policy.ceiling - policy.reserve",
  "",
  "# at ceiling: stop new bursts, let leases expire,",
  "# fall back to private capacity or reject with reason",
].join("\n"), 0.6, 1.85, 7.6, 3.4, 13);
const stat = [["0", "ceiling breaches allowed", K.amber], ["15 s", "metering interval", K.teal], ["₹100", "reserve below ceiling", K.slate]];
stat.forEach((t, i) => {
  const y = 1.85 + i * 1.18;
  card(p, s, 8.6, y, 4.1, 1.0, K.bg2);
  txt(s, t[0], 8.8, y, 1.5, 1.0, { fontSize: 30, bold: true, color: t[2], valign: "middle" });
  txt(s, t[1], 10.3, y, 2.3, 1.0, { fontSize: 14, valign: "middle" });
});
card(p, s, 0.6, 5.5, 12.1, 1.2, K.tealL);
txt(s, [{ text: "Why projected, not current: ", options: { bold: true } }, { text: "a node acquired at ₹ ceiling − 1 still bills for its whole lease. Checking only current spend lets the baseline overshoot by one lease per node." }], 0.85, 5.6, 11.6, 1.0, { fontSize: 15, valign: "middle" });

// ---------- 8. Experimental setup ----------
s = content(p, "Results", "Experimental setup", "Same app, same load shapes, same metrics — only the controller changes");
const cnt = [["4", "configurations"], ["9", "burst shapes"], ["3", "repetitions"], ["108", "runs in total"]];
cnt.forEach((c, i) => {
  const x = 0.6 + i * 3.1;
  card(p, s, x, 1.85, 2.8, 1.5, i === 3 ? K.ink : K.bg2);
  txt(s, c[0], x + 0.25, 1.9, 2.3, 0.85, { fontSize: 40, bold: true, color: i === 3 ? K.white : K.teal });
  txt(s, c[1], x + 0.25, 2.75, 2.3, 0.45, { fontSize: 14, color: i === 3 ? "CADCE8" : K.text });
});
const cfg = [
  [hdr("Config"), hdr("Bursting"), hdr("Ceiling"), hdr("Latency filter"), hdr("Residency")],
  ["B0 No bursting", "off", "—", "—", "—"],
  ["B1 Threshold-only", "on", "off", "off", "off"],
  ["PB PolicyBurst", "on", "on", "on", "on"],
  ["PB-noRes", "on", "on", "on", "off"],
].map((r, i) => i ? r.map((c, j) => ({ text: c, options: { bold: j === 0, align: j ? "center" : "left", fill: { color: i === 3 ? K.tealL : K.white } } })) : r);
table(s, cfg, 0.6, 3.65, [2.4, 1.2, 1.2, 1.5, 1.3], { fontSize: 13, rowH: 0.5 });
card(p, s, 8.6, 3.65, 4.1, 3.05, K.bg2);
txt(s, "Burst shapes (Locust)", 8.85, 3.8, 3.6, 0.4, { fontSize: 16, bold: true, color: K.ink });
txt(s, bullets(["Magnitude: 2×, 4×, 6× private capacity", "Duration: 1, 3, 5 minutes", "Base load 20 users; 30% of requests tagged restricted", "Ceiling scaled to the run length"], { gap: 4 }), 8.85, 4.25, 3.6, 2.35, { fontSize: 14 });

// ---------- 9. Comparative results ----------
s = content(p, "Results", "Results: attainment and attainment per ₹", "Threshold-only buys attainment at any price; PolicyBurst trades a little attainment for a bounded bill");
const mags = ["2×", "3×", "4×", "5×", "6×"];
s.addChart(p.charts.LINE, [
  { name: "B0 No bursting", labels: mags, values: [96, 82, 68, 55, 46] },
  { name: "B1 Threshold-only", labels: mags, values: [98, 95, 93, 91, 90] },
  { name: "PB PolicyBurst", labels: mags, values: [97, 94, 91, 88, 85] },
], chartOpts({ x: 0.6, y: 1.95, w: 6.0, h: 4.75, title: "SLO attainment (%) vs burst magnitude", chartColors: [K.muted, K.amber, K.teal],
  lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 40, valAxisMaxVal: 100, catAxisTitle: "Burst magnitude (× private capacity)", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, [
  { name: "Attainment per ₹100", labels: ["B1 Threshold-only", "PB PolicyBurst"], values: [41, 58] },
], chartOpts({ x: 6.9, y: 1.95, w: 5.8, h: 4.75, barDir: "col", title: "SLO attainment points per ₹100 (4× burst, 3 min)", chartColors: [K.amber, K.teal],
  showLegend: false, showValue: true, dataLabelPosition: "outEnd", barGapWidthPct: 80, valAxisMinVal: 0 }));
todoTag(p, s, 0.6, 1.62, ILL, 4.2);
s.addNotes("These values are placeholders showing the expected shape. Replace with the means from experiments/run_matrix.py output before presenting. B0 has zero spend so attainment per rupee is undefined for it.");

// ---------- 10. Spend vs ceiling ----------
s = content(p, "Results", "Results: the ceiling holds", "Cumulative spend over a 60-minute run with repeated bursts");
const mins = ["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "60"];
s.addChart(p.charts.LINE, [
  { name: "B1 Threshold-only", labels: mins, values: [0, 8, 20, 35, 48, 60, 75, 92, 105, 120, 138, 150, 165] },
  { name: "PB PolicyBurst", labels: mins, values: [0, 8, 19, 31, 42, 53, 66, 78, 90, 101, 110, 116, 118] },
  { name: "Ceiling (₹120)", labels: mins, values: Array(13).fill(120) },
], chartOpts({ x: 0.6, y: 1.95, w: 8.2, h: 4.75, title: "Cumulative spend (₹, shadow-priced)", chartColors: [K.amber, K.teal, K.coral],
  lineSize: 2.5, lineDataSymbol: "none", catAxisTitle: "Minutes into run", showCatAxisTitle: true }));
todoTag(p, s, 0.6, 1.62, ILL, 4.2);
const tk = [["B1", K.amber, "crosses the ceiling at ~45 min and keeps spending"], ["PB", K.teal, "flattens below the ceiling minus reserve; later bursts fall back to private or are rejected"]];
tk.forEach((t, i) => {
  const y = 2.1 + i * 1.6;
  badge(p, s, 9.2, y, 0.7, t[1], t[0], 14);
  txt(s, t[2], 10.05, y - 0.05, 2.65, 1.3, { fontSize: 14 });
});
card(p, s, 9.2, 5.3, 3.5, 1.4, K.coralL);
txt(s, "H2 check: count of runs where spend > ceiling, per config", 9.4, 5.4, 3.1, 1.2, { fontSize: 13, bold: true, color: K.coral, valign: "middle" });

// ---------- 11. Ablation ----------
s = content(p, "Analysis", "Ablation: which component causes the gain?", "Remove one constraint at a time; measure attainment per ₹ and violations");
s.addChart(p.charts.BAR, [
  { name: "Attainment per ₹ (normalised to full PB)", labels: ["− residency filter", "− latency filter", "− cost accumulator", "Full PolicyBurst"], values: [1.06, 0.84, 0.78, 1.0] },
], chartOpts({ x: 0.6, y: 1.95, w: 7.4, h: 4.75, barDir: "bar", title: "Attainment per ₹, normalised (4× burst, 3 min)", chartColors: [K.coral, K.slate, K.amber, K.teal],
  showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.2, barGapWidthPct: 60 }));
todoTag(p, s, 0.6, 1.62, ILL, 4.2);
const ab = [
  ["− cost", K.amber, "Spend runs past the ceiling; attainment per ₹ falls because the last bursts are the most expensive per extra request."],
  ["− latency", K.slate, "Work sent to pub-far misses the 300 ms SLO: money spent, attainment not gained."],
  ["− residency", K.coral, "Slightly better per ₹ — but restricted requests leave India. This is the price of compliance (O4)."],
];
ab.forEach((a, i) => {
  const y = 1.95 + i * 1.6;
  card(p, s, 8.3, y, 4.4, 1.4, K.bg2);
  txt(s, a[0], 8.5, y + 0.1, 4.0, 0.35, { fontSize: 15, bold: true, color: a[1] });
  txt(s, a[2], 8.5, y + 0.45, 4.0, 0.9, { fontSize: 13 });
});

// ---------- 12. Residency sweep (O4) ----------
s = content(p, "Analysis", "Parameter sweep: what residency costs (O4)", "Attainment penalty grows with the share of traffic that must stay in India");
const shares = ["0%", "10%", "30%", "50%", "70%"];
s.addChart(p.charts.LINE, [
  { name: "Attainment penalty (pp)", labels: shares, values: [0, 1.5, 4.0, 7.5, 11.0] },
], chartOpts({ x: 0.6, y: 1.95, w: 6.2, h: 4.75, title: "PB vs PB-noRes: attainment penalty (pp)", chartColors: [K.teal], showLegend: false,
  lineSize: 2.5, lineDataSymbolSize: 7, showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0.0", catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
s.addChart(p.charts.BAR, [
  { name: "Rejected: no permissible destination", labels: shares, values: [0, 0.4, 1.8, 4.1, 7.6] },
], chartOpts({ x: 7.0, y: 1.95, w: 5.7, h: 4.75, barDir: "col", title: "Requests rejected, no permissible destination (%)", chartColors: [K.coral], showLegend: false,
  showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, catAxisTitle: "Share of restricted traffic", showCatAxisTitle: true }));
todoTag(p, s, 0.6, 1.62, ILL, 4.2);
s.addNotes("H3 is tested at the 30% point: penalty must be at most 10 pp. The sweep shows how the cost of compliance scales, which is the main publishable result.");

// ---------- 13. Threats to validity ----------
s = content(p, "Analysis", "Threats to validity", "What our setup cannot prove");
const th = [
  ["Scale", "One or two free-tier VMs and a few private VMs; results may not hold for hundreds of nodes or real autoscaling delays."],
  ["Cost is modelled", "Free tier bills ₹0, so spend is shadow-priced. Real bills add egress, storage and per-second rounding."],
  ["Emulated far region", "pub-far is a netem delay plus a label, not a real foreign region; real WAN jitter and loss are absent."],
  ["Synthetic load", "Locust shapes are not a production trace; bursts are cleaner and more predictable than real demand."],
  ["Residency ≠ legal compliance", "We enforce placement by label. Backups, logs and the control plane itself may still cross borders."],
  ["Single app, short runs", "One 3-service app and 60-min runs; monthly-ceiling behaviour is compressed by scaling the budget."],
];
th.forEach((t, i) => {
  const x = 0.6 + (i % 3) * 4.1, y = 1.85 + Math.floor(i / 3) * 2.45;
  card(p, s, x, y, 3.8, 2.2, i % 2 ? K.bg2 : K.white, { line: K.line });
  badge(p, s, x + 0.2, y + 0.2, 0.55, K.coral, "!", 16);
  txt(s, t[0], x + 0.9, y + 0.22, 2.75, 0.5, { fontSize: 16, bold: true, color: K.ink, valign: "middle" });
  txt(s, t[1], x + 0.2, y + 0.9, 3.4, 1.25, { fontSize: 13 });
});

// ---------- 14. Next steps ----------
s = content(p, "Next steps", "Road to the final review", "Turn preliminary numbers into the full O3 and O4 evaluation");
const nx = [
  ["1", "Full matrix", "All 108 runs with mean ± 95% CI on every bar"],
  ["2", "O3 curve", "Attainment per ₹ vs burst intensity for B1, PB"],
  ["3", "O4 result", "Residency penalty and rejections, sweep 0–70%"],
  ["4", "Write-up", "Paper draft: DPDP-aware bursting, artefact on GitHub"],
];
nx.forEach((r, i) => {
  const x = 0.6 + i * 3.1;
  badge(p, s, x, 2.0, 0.9, i % 2 ? K.amber : K.teal, r[0], 20);
  if (i < 3) arrow(p, s, x + 1.0, 2.45, x + 3.0, 2.45, K.line);
  txt(s, r[1], x, 3.15, 2.8, 0.45, { fontSize: 18, bold: true, color: K.ink });
  txt(s, r[2], x, 3.65, 2.8, 1.2, { fontSize: 14 });
});
card(p, s, 0.6, 5.3, 12.1, 1.4, K.bg2);
txt(s, [{ text: "Stretch goal: ", options: { bold: true } }, { text: "replace the emulated far region with a real second public region for a short paid run, to check the latency filter against real WAN behaviour." }], 0.85, 5.4, 11.6, 1.2, { fontSize: 15, valign: "middle" });

// ---------- 15. Close ----------
s = darkSlide(p, "Next steps");
s.addText("Thank you — questions?", { placeholder: "title" });
s.addText("PolicyBurst: residency, latency and budget decide where work may go — before the controller decides where it should go.", { placeholder: "body" });

save(p, OUT);
