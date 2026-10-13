"""Screenshot a piece's play/ page with headless Edge and use it as the card picture.

    python tools/capture.py games/square-game experiments/ballpoint ...

Needs the preview server on :8790 (launch.json "portfolio-site"). The shot is
saved as content/<branch>/<slug>/shot.png and becomes thumb + hero, but only
if the piece has no thumb yet.
"""

import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://localhost:8790/"


def main():
    for key in sys.argv[1:]:
        folder = ROOT / "content" / key
        toml = folder / "piece.toml"
        meta = tomllib.loads(toml.read_text(encoding="utf-8"))
        if meta.get("thumb"):
            print(key, "already has a thumb")
            continue
        out = folder / "shot.png"
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
                        "--window-size=1280,800", "--virtual-time-budget=6000",
                        f"--screenshot={out}", BASE + key + "/play/"],
                       capture_output=True, timeout=90)
        if not out.exists():
            print(key, "no screenshot")
            continue
        text = toml.read_text(encoding="utf-8").rstrip("\n")
        text += '\nthumb = "shot.png"\nhero = { type = "image", src = "shot.png" }\n'
        toml.write_text(text, encoding="utf-8")
        print(key, "ok")


if __name__ == "__main__":
    main()
