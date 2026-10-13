"""The perfunctory lock on writing/private.

This is a curtain, not a safe. Dani wants it easy to break, so they can always get back in.

Readable pieces live in content/writing/private/source/, which is gitignored:
    source/lock.toml          password = "...", hint = "..."
    source/<slug>/piece.toml  title, year (and optional order)
    source/<slug>/body.html   the text, plain html

seal() scrambles them into content/writing/private/sealed.json. That file is
committed, so the site still builds where source/ doesn't exist (GitHub
Actions). The scrambling is an XOR with a SHA-256 keystream made from the
password: unreadable in the repo and to search engines, and nothing more.

    python tools/lock.py unlock <password>          print every piece
    python tools/lock.py unlock <password> out/     write them back out as files
    python tools/lock.py crack                      try the obvious passwords (for when you forget)
"""

import base64
import hashlib
import json
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT / "content" / "writing" / "private"
SOURCE = PRIVATE / "source"
SEALED = PRIVATE / "sealed.json"


def keystream(password, n):
    out, i = bytearray(), 0
    while len(out) < n:
        out += hashlib.sha256(f"{password}:{i}".encode()).digest()
        i += 1
    return bytes(out[:n])


def scramble(data: bytes, password: str) -> bytes:
    return bytes(a ^ b for a, b in zip(data, keystream(password, len(data))))


def read_source():
    with open(SOURCE / "lock.toml", "rb") as f:
        cfg = tomllib.load(f)
    pieces = []
    for d in sorted(SOURCE.iterdir()):
        if not (d / "piece.toml").exists():
            continue
        with open(d / "piece.toml", "rb") as f:
            m = tomllib.load(f)
        body = (d / "body.html").read_text(encoding="utf-8") if (d / "body.html").exists() else ""
        pieces.append({"slug": d.name, "title": m.get("title", d.name), "year": m.get("year", ""),
                       "order": m.get("order", 999), "body": body})
    pieces.sort(key=lambda p: (p["order"], p["title"]))
    return cfg, pieces


def seal():
    """Rebuild sealed.json from source/ when it's there; otherwise use the committed one."""
    if (SOURCE / "lock.toml").exists():
        cfg, pieces = read_source()
        blob = scramble(json.dumps({"pieces": pieces}).encode("utf-8"), cfg["password"])
        sealed = {"hint": cfg.get("hint", ""), "count": len(pieces), "blob": base64.b64encode(blob).decode()}
        SEALED.write_text(json.dumps(sealed, indent=0), encoding="utf-8")
        return sealed
    if SEALED.exists():
        return json.loads(SEALED.read_text(encoding="utf-8"))
    return {"hint": "", "count": 0, "blob": ""}


def unseal(password, sealed=None):
    sealed = sealed or json.loads(SEALED.read_text(encoding="utf-8"))
    raw = scramble(base64.b64decode(sealed["blob"]), password)
    return json.loads(raw.decode("utf-8"))["pieces"]


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "unlock":
        pieces = unseal(sys.argv[2])
        if len(sys.argv) > 3:
            out = Path(sys.argv[3])
            for p in pieces:
                (out / p["slug"]).mkdir(parents=True, exist_ok=True)
                (out / p["slug"] / "body.html").write_text(p["body"], encoding="utf-8")
            print(f"wrote {len(pieces)} pieces to {out}")
        else:
            for p in pieces:
                print(f"== {p['title']} ({p['year']})\n{p['body']}\n")
    elif len(sys.argv) >= 2 and sys.argv[1] == "crack":
        sealed = json.loads(SEALED.read_text(encoding="utf-8"))
        print("hint:", sealed.get("hint"))
        guesses = ["ren", "emporium", "rensemporium", "dani", "deetvleet", "daniel", "password", "whitethorn"]
        for g in guesses + [g.upper() for g in guesses] + [g.capitalize() for g in guesses]:
            try:
                unseal(g, sealed)
                print("password is:", g)
                return
            except Exception:
                pass
        print("not one of the obvious ones. the readable copies are in content/writing/private/source/")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
