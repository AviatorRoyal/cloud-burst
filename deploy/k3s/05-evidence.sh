#!/usr/bin/env bash
# Collects the testbed evidence into evidence/<timestamp>/ (screenshot these outputs too).
set -euo pipefail
OUT=evidence/$(date +%Y%m%d-%H%M%S); mkdir -p "$OUT"
{ hostname; date -Is; } > "$OUT/host.txt"
kubectl get nodes -o wide --show-labels > "$OUT/nodes.txt"
kubectl get nodes -L p11.burst/destination,p11.burst/region > "$OUT/nodes-labels.txt"
kubectl describe nodes > "$OUT/nodes-describe.txt"
kubectl get pods -A -o wide > "$OUT/pods.txt"
kubectl get burstpolicies -o yaml > "$OUT/policies.yaml" 2>/dev/null || true
kubectl get pods -n p11-app -o custom-columns=POD:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName,IP:.status.podIP > "$OUT/pods-app.txt"
# average round-trip time from this host to every node (shows emulated WAN delay)
kubectl get nodes -o custom-columns=NAME:.metadata.name,IP:.status.addresses[0].address --no-headers |
  while read -r name ip; do
    avg=$(ping -c 5 -q "$ip" | awk -F/ '/rtt|round-trip/ {print $5}')
    printf '%-18s %-12s %s ms\n' "$name" "$ip" "$avg"
  done > "$OUT/rtt.txt"
cat "$OUT/nodes-labels.txt"; echo "saved to $OUT"
