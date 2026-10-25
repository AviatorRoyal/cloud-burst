"""B1 threshold-only baseline: the PolicyBurst reconcile loop with every constraint switched off.

Running the baseline through the same code path keeps the comparison fair: only the
decision logic differs, not the metrics, actuation or timing.

    python baselines/threshold.py --policy-file deploy/policy/experiment.yaml
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from policyburst.main import main  # noqa: E402

if __name__ == "__main__":
    main(["--mode", "threshold", *sys.argv[1:]])
