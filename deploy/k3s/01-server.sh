#!/usr/bin/env bash
# Run on the private k3s server (control plane). Private nodes carry destination=private, region=IN.
set -euo pipefail
TS_IP=$(tailscale ip -4)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
  --node-ip ${TS_IP} --advertise-address ${TS_IP} --flannel-iface tailscale0 \
  --node-label p11.burst/destination=private --node-label p11.burst/region=IN \
  --write-kubeconfig-mode 644" sh -
echo
echo "Join token (give to agents):"
sudo cat /var/lib/rancher/k3s/server/node-token
echo "Server URL: https://${TS_IP}:6443"
