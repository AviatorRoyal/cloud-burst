"""Turns the controller's JSON event lines into one readable line per 15 s cycle for a live demo."""
import json
import sys
import time

COLOR = sys.stdout.isatty()
G, Y, R, B, X = ("\033[32m", "\033[33m", "\033[31m", "\033[1m", "\033[0m") if COLOR else ("",) * 5

for line in sys.stdin:
    try:
        e = json.loads(line)
    except json.JSONDecodeError:
        continue
    t = time.strftime("%H:%M:%S", time.localtime(e["ts"]))
    util = e.get("private_util")
    parts = [f"{t}", f"private CPU {util * 100:3.0f}%" if util is not None else "private CPU  -- ",
             f"spent Rs {e['spent_inr']:6.2f}/{e['ceiling_inr']:.0f}",
             f"public: {', '.join(e['active']) or 'none'}"]
    if e["pending"]:
        parts.append("pending: " + " ".join(f"{k.split('/')[-1]}={v}" for k, v in e["pending"].items()))
    out = "  |  ".join(parts)
    if e["activate"]:
        out += f"  {G}{B}BUY {', '.join(e['activate'])}{X}"
    if e["deactivate"]:
        out += f"  {Y}{B}RELEASE {', '.join(e['deactivate'])}{X}"
    for w, reason in e["rejections"]:
        out += f"  {R}refused {w.split('/')[-1]}: {reason}{X}"
    for n in e["notes"]:
        out += f"  {Y}[{n}]{X}"
    if e.get("evicted_misplaced"):
        out += f"  {R}evicted {e['evicted_misplaced']} misplaced pod(s){X}"
    print(out, flush=True)
