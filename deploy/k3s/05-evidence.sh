#!/usr/bin/env bash
# Collects the Review 1 testbed evidence into evidence/<timestamp>/ (screenshot these outputs too).
set -euo pipefail
OUT=evidence/$(date +%Y%m%d-%H%M%S); mkdir -p "$OUT"
{ hostname; date -Is; } > "$OUT/host.txt"
kubectl get nodes -o wide --show-labels > "$OUT/nodes.txt"
kubectl get nodes -L p11.burst/destination,p11.burst/region > "$OUT/nodes-labels.txt"
kubectl describe nodes > "$OUT/nodes-describe.txt"
kubectl get pods -A -o wide > "$OUT/pods.txt"
kubectl get burstpolicies -o yaml > "$OUT/policies.yaml" 2>/dev/null || true
cat "$OUT/nodes-labels.txt"; echo "saved to $OUT"
