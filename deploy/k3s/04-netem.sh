#!/usr/bin/env bash
# Run on an emulated foreign-region node to add WAN delay to all overlay traffic.
#   ./04-netem.sh 40ms    # on pub-sg (nearby region)
#   ./04-netem.sh 120ms   # on pub-us (distant region)
#   ./04-netem.sh off     # remove
set -euo pipefail
DELAY=${1:-120ms}; IFACE=${IFACE:-tailscale0}
if [ "$DELAY" = off ]; then sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true; exit 0; fi
sudo tc qdisc replace dev "$IFACE" root netem delay "$DELAY" 10ms distribution normal
tc qdisc show dev "$IFACE"
