#!/usr/bin/env bash
# Run on a public free-tier VM (overflow capacity). The taint keeps ordinary pods off it;
# only PolicyBurst-managed workloads tolerate it, and the controller cordons it when idle.
#   K3S_URL=... K3S_TOKEN=... ./03-agent-public.sh pub-in IN
#   K3S_URL=... K3S_TOKEN=... ./03-agent-public.sh pub-sg non-IN
#   K3S_URL=... K3S_TOKEN=... ./03-agent-public.sh pub-us non-IN
set -euo pipefail
DEST=${1:?destination name, e.g. pub-in}; REGION=${2:?region label, e.g. IN or non-IN}
: "${K3S_URL:?set K3S_URL}" "${K3S_TOKEN:?set K3S_TOKEN}"
TS_IP=$(tailscale ip -4)
curl -sfL https://get.k3s.io | K3S_URL="$K3S_URL" K3S_TOKEN="$K3S_TOKEN" INSTALL_K3S_EXEC="agent \
  --node-ip ${TS_IP} --flannel-iface tailscale0 \
  --node-label p11.burst/destination=${DEST} --node-label p11.burst/region=${REGION} \
  --node-taint p11.burst/public=true:NoSchedule" sh -
