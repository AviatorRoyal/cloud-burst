#!/usr/bin/env bash
# Run on the pub-far node to emulate a distant region by delaying all overlay traffic.
#   ./04-netem-far.sh 120ms   # add / change delay
#   ./04-netem-far.sh off     # remove
set -euo pipefail
DELAY=${1:-120ms}; IFACE=${IFACE:-tailscale0}
if [ "$DELAY" = off ]; then sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true; exit 0; fi
sudo tc qdisc replace dev "$IFACE" root netem delay "$DELAY" 10ms distribution normal
tc qdisc show dev "$IFACE"
