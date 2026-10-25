from pathlib import Path

import pytest

from policyburst.cost import CostMeter, can_acquire, must_halt
from policyburst.decision import Decider, Observation, Thresholds, Workload
from policyburst.feasibility import Constraints, feasible
from policyburst.policy import load_file

ROOT = Path(__file__).resolve().parents[1]
FAST = Thresholds(burst_after_s=30, idle_after_s=120)


class Clock:
    def __init__(self, t=1_000_000.0):
        self.t = t

    def __call__(self):
        return self.t


@pytest.fixture
def policy():
    return load_file(ROOT / "deploy/policy/experiment.yaml")


def rtts(near=20.0, far=150.0):
    return {"pub-in": near, "pub-far": far}


def wl(name, cls, pending=0):
    return Workload("p11-app", name, cls, pending=pending)


# ---------- policy ----------

def test_policy_loads_both_files(policy):
    campus = load_file(ROOT / "deploy/policy/campus-default.yaml")
    assert [d.name for d in policy.private] == ["private"]
    assert {d.name for d in campus.public} == {"pub-in", "pub-far"}
    assert policy.billing_period_hours == 1


def test_unknown_data_class_fails_closed(policy):
    assert policy.permitted_regions(None) == ("IN",)
    assert policy.permitted_regions("mystery") == ("IN",)


# ---------- feasibility ----------

def test_restricted_never_gets_non_in(policy):
    dests, _ = feasible(policy, "restricted", rtts(), 20, Constraints(latency=False, cost=False))
    assert {d.name for d in dests} == {"private", "pub-in"}


def test_latency_filter_drops_far_region(policy):
    # 2 x 150 ms + 20 ms > 300 ms SLO
    dests, reason = feasible(policy, "public", rtts(far=150), 20, Constraints())
    assert {d.name for d in dests} == {"private", "pub-in"}
    assert reason is None


def test_reason_reported_when_no_public_left(policy):
    _, reason = feasible(policy, "restricted", rtts(near=200), 20, Constraints())
    assert reason == "latency"
    _, reason = feasible(policy, "restricted", {"pub-in": None, "pub-far": 10}, 20, Constraints(latency=False))
    assert reason is None  # pub-in survives residency; latency is off


def test_unprobed_destination_fails_closed(policy):
    dests, _ = feasible(policy, "public", {}, 20, Constraints())
    assert [d.name for d in dests] == ["private"]


def test_constraints_without():
    assert Constraints.without(["residency"]) == Constraints(residency=False)
    with pytest.raises(ValueError):
        Constraints.without(["speed"])


# ---------- cost ----------

def test_meter_accumulates_per_second(policy, tmp_path):
    clock = Clock()
    m = CostMeter(clock, tmp_path / "s.json")
    m.start(policy.destination("pub-in"))      # 180 INR/h
    clock.t += 600
    assert m.total_inr() == pytest.approx(30)
    m.stop("pub-in")
    clock.t += 600
    assert m.total_inr() == pytest.approx(30)
    assert CostMeter(clock, tmp_path / "s.json").total_inr() == pytest.approx(30)  # survives restart


def test_can_acquire_uses_projection(policy):
    clock = Clock()
    m = CostMeter(clock)
    m.closed_inr = 85
    # 85 + 180 * 0.1 h lease = 103 <= 120 - 10
    assert can_acquire(m, policy, policy.destination("pub-in"))[0]
    m.closed_inr = 95
    # 95 + 18 = 113 > 110 even though current spend is under the ceiling
    ok, projected = can_acquire(m, policy, policy.destination("pub-in"))
    assert not ok and projected == pytest.approx(113)


def test_must_halt(policy):
    clock = Clock()
    m = CostMeter(clock)
    m.closed_inr = 109.5
    m.start(policy.destination("pub-in"))
    assert must_halt(m, policy, 15)  # 109.5 + 180 * 15/3600 = 110.25 > 120 - 10
    m.closed_inr = 100
    assert not must_halt(m, policy, 15)


# ---------- decision ----------

def obs(clock, workloads, active=(), util=0.9, r=None):
    return Observation(now=clock(), workloads=workloads, private_util=util, active=set(active), rtts=r or rtts())


def test_waits_for_sustained_pressure_then_bursts(policy):
    clock = Clock()
    d = Decider("policyburst", Constraints(), CostMeter(clock), FAST)
    assert d.decide(policy, obs(clock, [wl("lms", "internal", 3)])).activate == []
    clock.t += 30
    assert d.decide(policy, obs(clock, [wl("lms", "internal", 3)])).activate == ["pub-in"]


def test_threshold_picks_cheapest_even_if_far_and_non_in(policy):
    clock = Clock()
    d = Decider("threshold", Constraints(), CostMeter(clock), FAST)
    d.decide(policy, obs(clock, [wl("records", "restricted", 3)]))
    clock.t += 30
    plan = d.decide(policy, obs(clock, [wl("records", "restricted", 3)]))
    assert plan.activate == ["pub-far"]
    assert set(plan.allowed["p11-app/records"]) == {"private", "pub-in", "pub-far"}


def test_policyburst_keeps_restricted_in_india(policy):
    clock = Clock()
    d = Decider("policyburst", Constraints(latency=False), CostMeter(clock), FAST)
    d.decide(policy, obs(clock, [wl("records", "restricted", 3)]))
    clock.t += 30
    plan = d.decide(policy, obs(clock, [wl("records", "restricted", 3)]))
    assert plan.activate == ["pub-in"]
    assert "pub-far" not in plan.allowed["p11-app/records"]


def test_rejection_when_no_permissible_destination(policy):
    clock = Clock()
    d = Decider("policyburst", Constraints(), CostMeter(clock), FAST)
    workloads = [wl("records", "restricted", 3)]
    d.decide(policy, obs(clock, workloads, r=rtts(near=None)))
    clock.t += 30
    plan = d.decide(policy, obs(clock, workloads, r=rtts(near=None)))
    assert plan.activate == []
    assert plan.rejections == [("p11-app/records", "latency")]


def test_budget_denies_new_capacity(policy):
    clock = Clock()
    m = CostMeter(clock)
    m.closed_inr = 100
    d = Decider("policyburst", Constraints(), m, FAST)
    d.decide(policy, obs(clock, [wl("lms", "internal", 3)]))
    clock.t += 30
    plan = d.decide(policy, obs(clock, [wl("lms", "internal", 3)]))
    assert plan.activate == []
    assert ("p11-app/lms", "budget") in plan.rejections


def test_budget_halt_releases_active_capacity(policy):
    clock = Clock()
    m = CostMeter(clock)
    m.closed_inr = 109.9
    m.start(policy.destination("pub-in"))
    d = Decider("policyburst", Constraints(), m, FAST)
    plan = d.decide(policy, obs(clock, [wl("lms", "internal", 0)], active=["pub-in"]))
    assert plan.deactivate == ["pub-in"] and "budget-halt" in plan.notes


def test_threshold_ignores_budget(policy):
    clock = Clock()
    m = CostMeter(clock)
    m.closed_inr = 500
    d = Decider("threshold", Constraints(), m, FAST)
    d.decide(policy, obs(clock, [wl("lms", "internal", 3)]))
    clock.t += 30
    assert d.decide(policy, obs(clock, [wl("lms", "internal", 3)])).activate == ["pub-far"]


def test_one_destination_per_cooldown(policy):
    clock = Clock()
    d = Decider("threshold", Constraints(), CostMeter(clock), FAST)
    w = [wl("lms", "internal", 5)]
    d.decide(policy, obs(clock, w))
    clock.t += 30
    assert d.decide(policy, obs(clock, w)).activate == ["pub-far"]
    clock.t += 15
    assert d.decide(policy, obs(clock, w, active=["pub-far"])).activate == []
    clock.t += 15
    assert d.decide(policy, obs(clock, w, active=["pub-far"])).activate == ["pub-in"]


def test_scale_in_after_idle_most_expensive_first(policy):
    clock = Clock()
    d = Decider("threshold", Constraints(), CostMeter(clock), FAST)
    idle = [wl("lms", "internal", 0)]
    d.decide(policy, obs(clock, idle, active=["pub-in", "pub-far"], util=0.2))
    clock.t += 120
    assert d.decide(policy, obs(clock, idle, active=["pub-in", "pub-far"], util=0.2)).deactivate == ["pub-in"]


def test_noburst_never_activates(policy):
    clock = Clock()
    d = Decider("noburst", Constraints(), CostMeter(clock), FAST)
    plan = d.decide(policy, obs(clock, [wl("lms", "internal", 9)], active=["pub-in"]))
    assert plan.activate == [] and plan.deactivate == ["pub-in"]
    assert plan.allowed["p11-app/lms"] == ["private"]
