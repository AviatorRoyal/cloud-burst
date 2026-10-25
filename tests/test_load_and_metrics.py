import pytest

from analysis.metrics import node_hours, percentile, summarize
from load.shape import BurstParams, RampParams, burst_users, ramp_users


def test_single_burst_profile():
    p = BurstParams(capacity_users=40, base_users=20, magnitude=4, burst_s=180, warmup_s=120, cooldown_s=60)
    assert burst_users(0, p) == 20
    assert burst_users(120, p) == 160
    assert burst_users(299, p) == 160
    assert burst_users(300, p) == 20
    assert burst_users(p.total_s, p) is None
    assert p.total_s == 360


def test_repeated_bursts():
    p = BurstParams(capacity_users=10, base_users=5, magnitude=2, burst_s=60, count=3, gap_s=120, warmup_s=0, cooldown_s=0)
    hot = [t for t in range(0, int(p.total_s)) if burst_users(t, p) == 20]
    assert len(hot) == 180 and burst_users(70, p) == 5 and burst_users(180, p) == 20


def test_ramp_ends():
    p = RampParams(start=10, step=10, step_s=60, max_users=30)
    assert [ramp_users(t, p) for t in (0, 60, 120, 180)] == [10, 20, 30, None]


def req(ts, svc, cls, lat, ok=True, node="priv-1"):
    return {"ts": ts, "service": svc, "data_class": cls, "latency_ms": lat, "ok": ok, "node": node}


def test_summary_metrics():
    reqs = [
        req(0, "lms", "internal", 100),
        req(1, "lms", "internal", 400),                       # late
        req(2, "records", "restricted", 50, node="far-1"),    # residency violation
        req(100, "records", "restricted", 0, ok=False),       # failed during a no-dest window
    ]
    events = [
        {"ts": 0, "spent_inr": 0, "ceiling_inr": 120, "active": ["pub-us"], "rejections": []},
        {"ts": 3600, "spent_inr": 50, "ceiling_inr": 120, "active": [],
         "rejections": [["p11-app/records", "residency"]]},
    ]
    s = summarize(reqs, events, {"priv-1": "IN", "far-1": "non-IN"}, interval_s=3600)
    assert s["attainment"] == 50.0
    assert s["failed"] == 1
    assert s["residency_violations"] == 1
    assert s["rejected_no_dest"] == 1
    assert s["spend_inr"] == 50 and not s["ceiling_breached"]
    assert s["attainment_per_100inr"] == pytest.approx(100.0)
    assert s["public_node_hours"] == pytest.approx(1.0)


def test_percentile_and_node_hours_edges():
    assert percentile([], 95) is None
    assert percentile([1, 2, 3, 4], 50) in (2, 3)
    assert node_hours([{"ts": 0, "active": []}]) == 0
