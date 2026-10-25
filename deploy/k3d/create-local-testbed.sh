#!/usr/bin/env bash
# Single-machine emulation of the P11 testbed with k3d (k3s nodes as Docker containers).
# Used when cloud VMs are not available: every node is real k3s, but the "public" nodes run on the
# same host, with their CPU capped and WAN delay added by netem on each node's host-side veth.
#
#   sudo ./deploy/k3d/create-local-testbed.sh          # create cluster "p11" + kubeconfig ./p11.kubeconfig
#   sudo ./deploy/k3d/create-local-testbed.sh netem    # re-apply WAN delays (needed after a host/WSL restart)
#   sudo ./deploy/k3d/create-local-testbed.sh delete
#
# Nodes (2 vCPU each):
#   server-0, agent-0   private  (destination=private, region=IN)
#   agent-1             pub-in   (region=IN)
#   agent-2             pub-sg   (region=non-IN, +40 ms)
#   agent-3             pub-us   (region=non-IN, +120 ms)
set -euo pipefail
NAME=p11
CORES=${CORES:-2}
HOST_CORES=$(nproc)
RESERVE=$((HOST_CORES - CORES))

veth_of() {
  local idx; idx=$(docker exec "$1" cat /sys/class/net/eth0/iflink)
  ip -o link | awk -F': ' -v i="$idx" '$1==i {split($2,a,"@"); print a[1]}'
}

# WAN delay for emulated foreign regions: netem on the host-side veth delays traffic into the node,
# which adds the delay to every round trip (controller probes, kube-proxy forwarding, responses).
apply_netem() {
  for spec in "agent-2:40ms" "agent-3:120ms"; do
    local node="k3d-${NAME}-${spec%%:*}" delay="${spec##*:}" dev
    dev=$(veth_of "$node")
    tc qdisc replace dev "$dev" root netem delay "$delay" 5ms distribution normal
    echo "$node ($dev): +$delay"
  done
}

case "${1:-}" in
  delete) k3d cluster delete "$NAME"; exit 0 ;;
  netem) apply_netem; exit 0 ;;
esac

k3d cluster create "$NAME" --servers 1 --agents 4 --api-port 127.0.0.1:6550 --wait \
  --k3s-arg "--disable=traefik@server:0" --k3s-arg "--disable=servicelb@server:0" \
  --k3s-arg "--disable-network-policy@server:0" \
  --k3s-arg "--kubelet-arg=system-reserved=cpu=${RESERVE}@all" \
  --k3s-node-label "p11.burst/destination=private@server:0" --k3s-node-label "p11.burst/region=IN@server:0" \
  --k3s-node-label "p11.burst/destination=private@agent:0"  --k3s-node-label "p11.burst/region=IN@agent:0" \
  --k3s-node-label "p11.burst/destination=pub-in@agent:1"   --k3s-node-label "p11.burst/region=IN@agent:1" \
  --k3s-node-label "p11.burst/destination=pub-sg@agent:2"   --k3s-node-label "p11.burst/region=non-IN@agent:2" \
  --k3s-node-label "p11.burst/destination=pub-us@agent:3"   --k3s-node-label "p11.burst/region=non-IN@agent:3" \
  --k3s-arg "--node-taint=p11.burst/public=true:NoSchedule@agent:1;agent:2;agent:3"

# Cap each node container's real CPU to match its allocatable CPU.
for c in $(docker ps --format '{{.Names}}' | grep "^k3d-${NAME}-\(server\|agent\)"); do
  docker update --cpus "$CORES" "$c" >/dev/null
done

apply_netem

k3d kubeconfig get "$NAME" > p11.kubeconfig
chmod 600 p11.kubeconfig
KUBECONFIG=p11.kubeconfig kubectl get nodes -L p11.burst/destination,p11.burst/region
