"""PolicyBurst reconcile loop.

    python -m policyburst.main --mode policyburst --policy campus-default
    python -m policyburst.main --mode threshold   --policy-file deploy/policy/experiment.yaml
    python -m policyburst.main --mode policyburst --disable residency     # PB-noRes / ablations
"""
from __future__ import annotations

import argparse
import json
import logging
import signal
import sys
import time
from dataclasses import asdict
from pathlib import Path

from kubernetes import config

from . import policy as pol
from .actuator import Actuator
from .cost import CostMeter
from .decision import MODES, Decider, Thresholds
from .feasibility import Constraints
from .signals import ClusterReader

log = logging.getLogger("policyburst")


def parse_args(argv=None):
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--mode", choices=MODES, default="policyburst")
    a.add_argument("--disable", default="", help="comma list of constraints to switch off: residency,latency,cost")
    src = a.add_mutually_exclusive_group(required=True)
    src.add_argument("--policy", help="BurstPolicy object name in the cluster")
    src.add_argument("--policy-file", help="BurstPolicy YAML file")
    a.add_argument("--namespace", default="default", help="namespace of the BurstPolicy object")
    a.add_argument("--interval", type=float, default=15.0)
    a.add_argument("--service-ms", type=float, default=20.0, help="typical in-pod service time")
    a.add_argument("--state", default="policyburst-state.json", help="cost meter state file")
    a.add_argument("--fresh", action="store_true", help="discard previous cost state (start of an experiment run)")
    a.add_argument("--events", help="append one JSON line per reconcile to this file")
    a.add_argument("--burst-util", type=float, default=Thresholds.burst_util)
    a.add_argument("--burst-after", type=float, default=Thresholds.burst_after_s)
    a.add_argument("--idle-util", type=float, default=Thresholds.idle_util)
    a.add_argument("--idle-after", type=float, default=Thresholds.idle_after_s)
    a.add_argument("--dry-run", action="store_true", help="decide and log, change nothing")
    return a.parse_args(argv)


class Controller:
    def __init__(self, args):
        self.args = args
        if args.fresh:
            Path(args.state).unlink(missing_ok=True)
        self.meter = CostMeter(state_path=args.state)
        self.constraints = Constraints.without([c for c in args.disable.split(",") if c])
        self.decider = Decider(args.mode, self.constraints, self.meter,
                               Thresholds(args.burst_util, args.burst_after, args.idle_util, args.idle_after),
                               args.interval)
        self.reader = ClusterReader(service_ms=args.service_ms)
        self.act = Actuator()
        self.policy = None
        self.events = open(args.events, "a", encoding="utf-8") if args.events else None

    def load_policy(self):
        try:
            self.policy = (pol.load_file(self.args.policy_file) if self.args.policy_file
                           else pol.load_cluster(self.args.policy, self.args.namespace))
        except Exception as e:  # keep running on the last good policy
            if self.policy is None:
                raise
            log.warning("policy reload failed, keeping previous: %s", e)
        return self.policy

    def release_all(self):
        """Cordon every public destination and close its meter (clean start / shutdown)."""
        policy = self.load_policy()
        nodes = self.reader.nodes_by_dest()
        for d in policy.public:
            if not self.args.dry_run:
                self.act.set_active(nodes.get(d.name, []), False)
            self.meter.stop(d.name)

    def step(self):
        policy = self.load_policy()
        obs, nodes, deployments = self.reader.observe(policy)
        # Keep the meter honest if someone toggled a node by hand.
        for d in policy.public:
            if d.name in obs.active:
                self.meter.start(d)
            else:
                self.meter.stop(d.name)
        plan = self.decider.decide(policy, obs)
        if not self.args.dry_run:
            for key, dests in plan.allowed.items():
                self.act.set_allowed(deployments[key], dests)
            for name in plan.deactivate:
                self.act.set_active(nodes.get(name, []), False)
                self.meter.stop(name)
            for name in plan.activate:
                self.act.set_active(nodes.get(name, []), True)
                self.meter.start(policy.destination(name))
        active = (obs.active - set(plan.deactivate)) | set(plan.activate)
        event = {
            "ts": round(obs.now, 3), "mode": self.args.mode, "constraints": asdict(self.constraints),
            "policy": policy.name, "spent_inr": round(self.meter.total_inr(), 4),
            "burn_inr_h": self.meter.burn_rate_inr_h(), "ceiling_inr": policy.monthly_ceiling_inr,
            "private_util": obs.private_util, "rtts": obs.rtts, "active": sorted(active),
            "pending": {w.key: w.pending for w in obs.workloads if w.pending},
            "activate": plan.activate, "deactivate": plan.deactivate,
            "rejections": plan.rejections, "notes": plan.notes,
        }
        line = json.dumps(event)
        print(line, flush=True)
        if self.events:
            self.events.write(line + "\n")
            self.events.flush()

    def run(self):
        stop = {"flag": False}
        signal.signal(signal.SIGTERM, lambda *_: stop.update(flag=True))
        self.release_all()
        log.info("started mode=%s constraints=%s", self.args.mode, self.constraints)
        try:
            while not stop["flag"]:
                t0 = time.time()
                try:
                    self.step()
                except Exception:
                    log.exception("reconcile failed")
                time.sleep(max(0.0, self.args.interval - (time.time() - t0)))
        except KeyboardInterrupt:
            pass
        finally:
            self.release_all()
            log.info("stopped, spent=%.2f INR", self.meter.total_inr())


def main(argv=None):
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    args = parse_args(argv)
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    Controller(args).run()


if __name__ == "__main__":
    main()
