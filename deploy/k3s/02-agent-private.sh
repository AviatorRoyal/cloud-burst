#!/usr/bin/env bash
# Run on each additional private VM.  Usage: K3S_URL=https://<server-ts-ip>:6443 K3S_TOKEN=<token> ./02-agent-private.sh
set -euo pipefail
: "${K3S_URL:?set K3S_URL}" "${K3S_TOKEN:?set K3S_TOKEN}"
TS_IP=$(tailscale ip -4)
curl -sfL https://get.k3s.io | K3S_URL="$K3S_URL" K3S_TOKEN="$K3S_TOKEN" INSTALL_K3S_EXEC="agent \
  --node-ip ${TS_IP} --flannel-iface tailscale0 \
  --node-label p11.burst/destination=private --node-label p11.burst/region=IN" sh -
