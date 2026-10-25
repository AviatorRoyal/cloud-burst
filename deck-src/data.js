// Loads measured and simulated results for the decks. Every number on a results slide comes from here.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const SIM = readJSON("results/sim/aggregate.json");
const BED = exists("results/testbed/aggregate.json") ? readJSON("results/testbed/aggregate.json") : null;

// mean of metric for the row matching all key/values (numbers compared as numbers)
function val(table, where, metric, field = "mean") {
  const row = table.find((r) => Object.entries(where).every(([k, v]) => Number(r[k]) === Number(v) || r[k] === v));
  if (!row || !row[metric]) return null;
  return row[metric][field];
}

function events(runDir) {
  return fs.readFileSync(path.join(ROOT, runDir, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
}

function evidence() {
  const dir = path.join(ROOT, "evidence");
  const latest = fs.readdirSync(dir).filter((d) => /^\d{8}-\d{6}$/.test(d)).sort().pop();
  const read = (f) => fs.readFileSync(path.join(dir, latest, f), "utf8").replace(/\r/g, "").trimEnd();
  const podsFile = exists(`evidence/${latest}/pods-app.txt`) ? "pods-app.txt" : "pods.txt";
  const podLines = read(podsFile).split("\n");
  const pods = podLines.length > 7 ? podLines.slice(0, 7).join("\n") + `\n... (${podLines.length - 1} pods in total)` : podLines.join("\n");
  return { dir: `evidence/${latest}`, host: read("host.txt"), nodes: read("nodes-labels.txt"), pods,
    rtt: exists(`evidence/${latest}/rtt.txt`) ? read("rtt.txt") : "" };
}

function gitLog(n = 8) {
  return execSync(`git log --date=short --format="%h %ad %s" -${n}`, { cwd: ROOT }).toString().trim();
}

const pct = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(100 * x))}%`;
const fmt = (x, d = 1) => (x === null || x === undefined ? "—" : Number(x).toFixed(d));

module.exports = { ROOT, SIM, BED, val, events, evidence, gitLog, pct, fmt, readJSON, exists };
