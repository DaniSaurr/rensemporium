"""Screenshot pages of the local site with headless Firefox, for design review.

    python tools/shoot.py games/ 3d/diver/ ...           # 1280 wide
    python tools/shoot.py --phone games/                 # 390 wide

Writes to %TEMP%/shots/<page>.png. Needs the server on :8790 (serve.bat).
"""

import os
import subprocess
import sys
from pathlib import Path

FIREFOX = r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
BASE = "http://localhost:8790/"


def main():
    args = sys.argv[1:]
    phone = "--phone" in args
    pages = [a for a in args if not a.startswith("--")] or [""]
    out = Path(os.environ["TEMP"]) / "shots"
    out.mkdir(exist_ok=True)
    prof = Path(os.environ["TEMP"]) / "ffshot"
    prof.mkdir(exist_ok=True)
    size = "390,1600" if phone else "1280,1600"
    for page in pages:
        name = (page.strip("/").replace("/", "_") or "home") + ("-phone" if phone else "") + ".png"
        subprocess.run([FIREFOX, "-headless", "-no-remote", "-profile", str(prof),
                        f"--window-size={size}", "--screenshot", str(out / name), BASE + page],
                       capture_output=True, timeout=120)
        print(out / name)


if __name__ == "__main__":
    main()
