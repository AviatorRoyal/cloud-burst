#!/usr/bin/env bash
# Run on EVERY node (private VMs and public free-tier VMs). Joins the node to your tailnet,
# which gives all nodes stable private IPs across campus NAT and the cloud.
set -euo pipefail
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh "$@"
echo "Tailscale IP: $(tailscale ip -4)"
