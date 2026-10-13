"""Builds the pass-3 pieces into NEW folders under content/3d/. Skips any slug whose folder already exists
(the other agent is editing existing piece.toml files), so it is safe to re-run after deleting a folder it made.

python tools/make_pieces3.py [slug ...]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_pieces as mp
import pieces_pass3

want = sys.argv[1:]
for spec in pieces_pass3.PIECES:
    if want and spec["slug"] not in want:
        continue
    out = os.path.join(mp.C, spec["slug"])
    if os.path.exists(out):
        print("exists, skipped:", spec["slug"])
        continue
    print(mp.build(spec))
