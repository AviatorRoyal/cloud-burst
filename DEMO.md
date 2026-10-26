# Live demo guide (from zero)

This guide walks you through showing PolicyBurst working live, in about 10 minutes. You type one short command per step. Each step says what you will see and what to say.

---

## Part 0 — The idea in plain words (say this first)

> "Our college runs a small private cloud. When too many users arrive at once, it runs out of capacity. Cloud bursting means renting extra machines from a public cloud for the peak and giving them back afterwards.
>
> The usual way is: CPU above 75% → rent the cheapest machine anywhere. That ignores three rules the institution actually has: a monthly budget, a latency target, and a law that some data (student records) must stay in India.
>
> PolicyBurst checks those three rules *before* it decides to rent anything."

### Words you will use

| Word | Meaning in one line |
|---|---|
| **Kubernetes (k3s)** | Software that runs many copies of an app across many machines. k3s is a light version. |
| **Node** | One machine in the cluster. We have 5. |
| **Pod** | One running copy of a service. When load rises, Kubernetes makes more pods. |
| **HPA** | Horizontal Pod Autoscaler: adds pods when CPU is high. |
| **Pending pod** | A pod Kubernetes wants to start but has nowhere to put. This is the "we are full" signal. |
| **Cordon / uncordon** | Close / open a node for new pods. PolicyBurst "rents" a public node by uncordoning it. |
| **Taint** | A "keep out" sign on the public nodes so random pods never land there. |
| **SLO** | Service-level objective: a request must succeed within 300 ms. |

### What is in the cluster

| Node | Plays the role of | Region | Added delay |
|---|---|---|---|
| `k3d-p11-server-0`, `k3d-p11-agent-0` | your college's private cloud | IN | none |
| `k3d-p11-agent-1` = **pub-in** | public cloud, Hyderabad | IN | none |
| `k3d-p11-agent-2` = **pub-sg** | public cloud, Singapore | non-IN | +40 ms |
| `k3d-p11-agent-3` = **pub-us** | public cloud, USA | non-IN | +120 ms |

There are three services, one per data class:

- **records** is *restricted*: student records, which must stay in India.
- **lms** is *internal*.
- **static** is *public*.

All five nodes are real Kubernetes nodes running on this laptop. The three "public cloud" nodes are emulated. Say this openly if asked (see Part 5).

---

## Part 1 — Before the review (start 20 minutes early)

**1. Open three terminals.** Open Windows Terminal, press `Ctrl+Shift+T` twice so you have 3 tabs, and in **each** tab type:

```bash
wsl -d Ubuntu -u root
```

```bash
cd /mnt/c/Users/raman/Projects/P11-cloud-bursting
```

> **Important:** keep at least one of these WSL tabs open for the whole review. If every WSL window is closed, Windows shuts the Linux VM down, and the cluster stops.

**2. Wake the cluster up (tab 1):**

```bash
bash demo/demo.sh up
```

It takes 1 minute if WSL was already running, and up to **10 minutes** right after Windows or WSL starts, because the CPU-metrics service starts slowly. Wait for the last line:

```
READY: cluster up, public nodes closed, metrics live.
```

Just above it you will see 5 nodes, all `Ready`; 3 pods (`lms`, `records`, `static`), all `Running`; and the HPA table showing real CPU numbers (for example `cpu: 3%/60%`, not `<unknown>`). The three public nodes show `SchedulingDisabled`, which is correct: they are "not rented" yet.

If it fails or hangs, run it again. It is safe to repeat.

**3. Have these open in other windows:** the Review 3 slides and the GitHub repo page (github.com/AviatorRoyal/cloud-burst).

---

## Part 2 — The demo (about 10 minutes)

### Step 1 — Show the cluster (tab 1)

```bash
bash demo/demo.sh status
```

**Point at:** the `DESTINATION` and `REGION` columns.

**Say:** "Two private nodes in India. Three public nodes: pub-in in India, pub-sg and pub-us abroad. The public ones are closed (SchedulingDisabled) until the controller decides to rent them."

### Step 2 — Show the policy (tab 1)

```bash
bash demo/demo.sh policy
```

**Point at:** `monthlyCeilingINR: 120`, `sloLatencyMs: 300`, the three destinations with prices, and `restricted: [IN]`.

**Say:** "This is the administrator's policy, stored inside Kubernetes. Budget ₹120, latency 300 ms, and restricted data only in India. The prices are shadow prices; the free tier costs nothing, so we model the bill."

### Step 3 — Start the live view (tab 2)

```bash
bash demo/demo.sh watch
```

This refreshes every 2 seconds. Leave it running; it is your "screen" for the audience.

### Step 4 — Start PolicyBurst (tab 3)

```bash
bash demo/demo.sh controller
```

One line appears every 15 seconds:

```
06:48:09  |  private CPU  99%  |  spent Rs   0.00/120  |  public: none  |  pending: lms=2 records=4 static=4
06:48:39  |  private CPU 100%  |  spent Rs   0.00/120  |  public: pub-us  ...  BUY pub-us
06:49:09  |  private CPU  15%  |  spent Rs   0.78/120  |  public: pub-in, pub-us  ...  BUY pub-in
```

Words in square brackets like `[rollout-wait ...]` in the first lines are normal. The controller is re-pinning each service to its allowed nodes and waits for that to finish before renting anything (this is the safety guard).

**Say:** "Every 15 seconds the controller looks at the cluster and decides. Right now everything is calm, so nothing is rented."

### Step 5 — Send a burst of users (tab 1)

```bash
bash demo/demo.sh load
```

It first checks that the cluster is settled. Then it sends 12 users for 30 seconds, then **120 users (2× what the private nodes can handle) for 2 minutes**, then calm for 1 minute. It takes about 4 minutes in total.

**What happens, in order (watch tabs 2 and 3):**

1. **About 30–60 s in:** private CPU goes to 100%, and in tab 2 new pods appear as `Pending`. **Say:** "The private cloud is full; the autoscaler wants more pods than fit."
2. **About 30 s later:** tab 3 prints **`BUY pub-...`** in green, and in tab 2 that node loses `SchedulingDisabled` and Pending pods start on it. **Say:** "The pressure lasted 30 seconds, so PolicyBurst rents the cheapest node that the rules allow."
3. The `spent Rs` number starts climbing. **Say:** "That's the cost meter, charged per second."

### Step 6 — Prove the residency rule (tab 1, while the burst is still running)

```bash
bash demo/demo.sh where
```

**Point at** every `records-...` line: its REGION is always **IN**. `lms` and `static` pods may be on non-IN nodes; that is allowed for their data class.

**Say:** "Student records never left India, even though the cheapest machine was abroad."

### Step 7 — Show what the normal approach does (the contrast)

1. In tab 3 press **Ctrl+C**. The controller stops and closes the public nodes again.
2. In tab 1:

```bash
bash demo/demo.sh reset
```

3. In tab 3 start the *baseline* controller:

```bash
bash demo/demo.sh controller threshold
```

4. In tab 1 send the same burst:

```bash
bash demo/demo.sh load
```

5. About 2 minutes in, run:

```bash
bash demo/demo.sh where
```

**Now you will see red-flag lines like:**

```
records-548cb76fd9-4nljp   Running   k3d-p11-agent-3   non-IN   <-- RESTRICTED DATA OUTSIDE INDIA
```

**Say:** "Same load, same app. The usual threshold controller rents every node it can, cheapest first, and puts student records in the USA and Singapore. It also spends more: in our rehearsal ₹25 against ₹9 for PolicyBurst over the same few minutes."

6. Finish: **Ctrl+C** in tab 3, then `bash demo/demo.sh reset` in tab 1.

### Step 8 (optional, 4 minutes) — Show the latency rule

```bash
bash demo/demo.sh delay 200
```

This makes the "USA" node slower (about 270 ms round trip). Run Steps 4–6 again. PolicyBurst will **not** buy `pub-us` any more, because 2 × 270 ms is already over the 300 ms target. Afterwards, put it back:

```bash
bash demo/demo.sh delay 120
```

### Step 9 — The budget rule (use the slides)

Hitting the ₹120 ceiling live needs several bursts (around 40 minutes), so show **Review 3 → "The ceiling holds"** instead. **Say:** "Under five bursts the threshold controller spent ₹257, 2.1× the budget; PolicyBurst stopped at ₹109."

---

## Part 3 — How to read the controller line

```
06:49:09 | private CPU 15% | spent Rs 0.78/120 | public: pub-in, pub-us | pending: records=4  BUY pub-in
   time     load on private   money spent/limit    rented nodes now        pods waiting   decision this cycle
```

| You see | It means |
|---|---|
| `BUY pub-in` | rented this node (uncordoned it) |
| `RELEASE pub-us` | gave this node back (drained and cordoned it) |
| `refused records: residency` | no allowed node for this data class |
| `refused ...: budget` | the next rental would break the monthly ceiling |
| `refused ...: capacity` | every allowed node is already rented and full |
| `[rollout-wait ...]` | waiting for a service to finish moving to its allowed nodes (safety guard) |
| `[scale-in-wait pub-in ...]` | wants to give a node back, but its pods don't fit on private yet; waits rather than thrash |
| `evicted N misplaced pod(s)` | found a pod on a node it may not use and moved it (safety guard) |

---

## Part 4 — If something goes wrong

| Problem | Fix |
|---|---|
| `connection refused ... 6550` or nodes `NotReady` | `bash demo/demo.sh up` (WSL was restarted). Wait 1 minute. |
| Pods stuck `Pending`/`Terminating` after a run | `bash demo/demo.sh reset` |
| `load` waits a long time at "checking the cluster is settled" | Metrics are still starting (up to 10 minutes after a reboot). Wait; it continues by itself. Next time run `up` earlier. |
| Controller shows `private CPU  --` | Same cause: metrics not live yet. Run `bash demo/demo.sh up` and wait for `READY`. |
| `[scale-in-wait ...]` for several minutes after the burst | Normal. The autoscaler keeps extra pods for 5 minutes, and PolicyBurst won't give a node back until its pods fit on private. Use `reset` if you need a clean state now. |
| No `BUY` appears during the burst | Check the controller is running in tab 3. Run `bash demo/demo.sh load` again; the second burst is usually stronger, because pods are warm. |
| Everything is broken and time is short | Show the slides: Review 3, slides 9 and 11 (real testbed output and measured results). |

---

## Part 5 — Questions you may be asked

**"Is this a real cloud?"**
"No. All five Kubernetes nodes are real k3s nodes running on one machine. The public regions are emulated with labels and network delay (netem), and cost is shadow-priced because the free tier bills nothing. The repo has scripts to join a real free-tier VM over Tailscale; that's the next step."

**"Why not just block the pod after it's scheduled?"**
"By then the capacity is already rented and paid for. PolicyBurst decides where work *may* go before deciding to rent."

**"How does it keep records in India?"**
"Each service has a data-class label. The policy maps classes to allowed regions. The controller pins the service to allowed nodes with node affinity, and a guard evicts any pod that lands somewhere it shouldn't."

**"What bugs did you find?"**
"Two that mattered. The test app was busy-waiting on the wall clock, so it never became CPU-bound; we fixed it and re-measured. And during a rollout, old pods could still land abroad; the testbed caught 62 and 126 such requests, so we added a rollout guard and a placement guard and re-measured to zero."

**"Why is PolicyBurst sometimes worse than the baseline?"**
"At heavy bursts (2.5× in simulation) refusing a slow region loses capacity that would still have helped. The fix is a queue-aware latency filter; it's in future work."

**"How do you calculate cost?"**
"Per second, at the policy's price for each rented node. Before renting, it checks that spend plus a full lease of every rented node stays under the ceiling minus a reserve."
