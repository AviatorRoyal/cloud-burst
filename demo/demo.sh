#!/usr/bin/env bash
# Live demo helper. Run inside WSL as root, from any directory:
#   wsl -d Ubuntu -u root
#   cd /mnt/c/Users/raman/Projects/P11-cloud-bursting && bash demo/demo.sh <step>
#
# Steps (see DEMO.md for what to say at each one):
#   up                 bring the testbed back after a reboot (CPU caps, WAN delay, wait for Ready)
#   status             nodes with their destination/region labels, and the app pods
#   watch              live view of nodes and pods (leave running in its own terminal)
#   policy             show the BurstPolicy the controller reads
#   controller [mode]  run the controller: policyburst (default) or threshold
#   load [size]        send a burst of <size> x private capacity (default 2) for 2 minutes
#   where              which node and region every pod is on (the residency check)
#   reset              back to a calm cluster: 1 pod per service, public nodes cordoned
set -uo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
export KUBECONFIG=${KUBECONFIG:-/root/p11/p11.kubeconfig}
PY=${PY:-/root/p11/venv/bin/python}
export PATH=/root/p11/venv/bin:$PATH
CAPACITY=60   # users the private nodes serve at >= 95% SLO attainment (calibrated)
cd "$REPO"

target() { docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' k3d-p11-agent-0; }

case "${1:-}" in
up)
  docker start $(docker ps -a --format '{{.Names}}' | grep '^k3d-p11-') >/dev/null 2>&1
  echo "waiting for 5 nodes to be Ready..."
  for _ in $(seq 1 60); do
    [ "$(kubectl get nodes --no-headers 2>/dev/null | grep -c ' Ready')" = 5 ] && break; sleep 5
  done
  for c in $(docker ps --format '{{.Names}}' | grep '^k3d-p11-\(server\|agent\)'); do docker update --cpus 2 "$c" >/dev/null; done
  tr -d '\r' < deploy/k3d/create-local-testbed.sh > /tmp/create.sh && bash /tmp/create.sh netem
  bash "$0" reset
  # After a fresh boot metrics-server can take several minutes; the autoscaler is blind until then.
  echo "waiting for CPU metrics (can take up to 10 minutes after Windows/WSL restarts)..."
  for i in $(seq 1 120); do
    kubectl top nodes >/dev/null 2>&1 && ! kubectl -n p11-app get hpa --no-headers | grep -q "<unknown>" && break
    [ $((i % 6)) = 0 ] && echo "  still waiting ($((i * 5)) s)"; sleep 5
  done
  kubectl -n p11-app get hpa
  echo "READY: cluster up, public nodes closed, metrics live."
  ;;
delay)
  # Optional: change the emulated WAN delay of pub-us (default 120 ms). At 200 ms a request routed
  # there needs 2 x 200 + 20 ms > 300 ms SLO, so PolicyBurst's latency filter will refuse pub-us.
  ms=${2:-120}
  idx=$(docker exec k3d-p11-agent-3 cat /sys/class/net/eth0/iflink)
  dev=$(ip -o link | awk -F': ' -v i="$idx" '$1==i {split($2,a,"@"); print a[1]}')
  tc qdisc replace dev "$dev" root netem delay "${ms}ms" 5ms distribution normal
  ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' k3d-p11-agent-3)
  echo "pub-us delay set to ${ms} ms; measured: $(ping -c 3 -q "$ip" | awk -F/ '/rtt/ {print $5}') ms"
  ;;
status)
  kubectl get nodes -L p11.burst/destination,p11.burst/region
  echo
  kubectl -n p11-app get pods -o wide
  ;;
watch)
  watch -n 2 "kubectl get nodes -L p11.burst/destination,p11.burst/region; echo; \
    kubectl -n p11-app get pods -o custom-columns=POD:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName --sort-by=.metadata.name"
  ;;
policy)
  kubectl get burstpolicy experiment -o yaml | sed -n '/^spec:/,$p'
  ;;
controller)
  mode=${2:-policyburst}
  echo "PolicyBurst controller, mode=$mode (Ctrl+C to stop; public nodes are released on exit)"
  "$PY" -u -m policyburst.main --mode "$mode" --policy-file deploy/policy/experiment.yaml \
    --fresh --state /tmp/demo-state.json --burst-after 30 --idle-after 60 2>/dev/null | "$PY" -u demo/pretty.py
  ;;
load)
  size=${2:-2}
  # Start only when the cluster is settled: Deployments not mid-rollout (the controller re-pins them
  # when it starts) and the autoscaler able to read CPU metrics (takes 1-2 min after a reboot).
  echo "checking the cluster is settled before the burst..."
  for d in records lms static; do kubectl -n p11-app rollout status deploy "$d" --timeout=240s >/dev/null; done
  for _ in $(seq 1 60); do
    kubectl -n p11-app get hpa --no-headers 2>/dev/null | grep -q "<unknown>" || break; sleep 5
  done
  kubectl -n p11-app get hpa
  echo "Burst: $(( CAPACITY / 5 )) users for 30 s, then ${size}x capacity for 120 s, then calm for 60 s"
  TARGET=$(target) SHAPE=burst CAPACITY_USERS=$CAPACITY BASE_USERS=$(( CAPACITY / 5 )) BURST_MAG="$size" \
    BURST_DUR_S=120 WARMUP_S=30 COOLDOWN_S=60 RESTRICTED_SHARE=0.3 \
    locust -f load/locustfile.py --headless --processes 4 --only-summary 2>&1 | grep -E "Aggregated|records|lms|static|Name" | head -8
  ;;
where)
  printf '%-30s %-10s %-20s %-8s\n' POD STATUS NODE REGION
  kubectl -n p11-app get pods -o jsonpath='{range .items[*]}{.metadata.name} {.status.phase} {.spec.nodeName}{"\n"}{end}' |
    while read -r pod phase node; do
      region=$( [ -n "$node" ] && kubectl get node "$node" -o jsonpath='{.metadata.labels.p11\.burst/region}' )
      flag=""; [[ "$pod" == records-* && "$region" == non-IN ]] && flag="  <-- RESTRICTED DATA OUTSIDE INDIA"
      printf '%-30s %-10s %-20s %-8s%s\n' "$pod" "$phase" "${node:--}" "${region:--}" "$flag"
    done
  ;;
reset)
  for d in records lms static; do kubectl -n p11-app scale deploy "$d" --replicas=1 >/dev/null; done
  for n in k3d-p11-agent-1 k3d-p11-agent-2 k3d-p11-agent-3; do
    kubectl cordon "$n" >/dev/null
    # cordon only stops new pods; move the existing ones back to private nodes
    kubectl -n p11-app delete pod --field-selector=spec.nodeName="$n" --wait=false >/dev/null 2>&1
  done
  kubectl -n p11-app delete pod --field-selector=status.phase!=Running --wait=false >/dev/null 2>&1
  echo "waiting for one ready pod per service on the private nodes..."
  for d in records lms static; do kubectl -n p11-app rollout status deploy "$d" --timeout=240s >/dev/null; done
  for _ in $(seq 1 60); do
    n=$(kubectl -n p11-app get pods --no-headers 2>/dev/null | wc -l)
    r=$(kubectl -n p11-app get pods --no-headers 2>/dev/null | grep -c ' 1/1 *Running')
    [ "$n" = 3 ] && [ "$r" = 3 ] && break; sleep 3
  done
  bash "$0" status
  ;;
*)
  sed -n '2,16p' "$0"
  ;;
esac
