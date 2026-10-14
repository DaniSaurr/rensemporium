"""Build ren's emporium into _site/.

    python tools/build.py

Content layout:
    content/site.toml                   intro line etc.
    content/<branch>/_branch.toml       label, intro, order
    content/<branch>/<slug>/piece.toml  one page per piece (see content/README.md)
    content/<branch>/<slug>/body.html   optional longer text, plain html
    content/<branch>/<slug>/*           its pictures; subfolders (a playable game) are copied as they are

All links are relative, so the site works from any folder, on GitHub Pages
or opened straight from disk.
"""

import json
import re
import shutil
import sys
import tomllib
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lock  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "_site"
SHOW_DRAFTS = "--drafts" in sys.argv
MAX_W = 1800  # widest picture we ship
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
SKIP = {"piece.toml", "body.html", "_branch.toml", "notes.md"}

env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))
# cache-buster: the stylesheet link changes whenever the css does
import hashlib  # noqa: E402
env.globals["css_v"] = hashlib.sha1((ROOT / "static" / "css" / "site.css").read_bytes()).hexdigest()[:8]


def load_toml(p):
    with open(p, "rb") as f:
        return tomllib.load(f)


# The "made with" row at the foot of a piece page. made_with entries are matched
# by their first word(s); whatever follows ("2.90", "4.23") becomes the hover note.
# Icons live in static/icons (Simple Icons, CC0, plus a few drawn here).
TOOLS = [
    # (prefixes, id, label, icon)
    (("blender",), "blender", "blender", "blender"),
    (("godot",), "godot", "godot", "godotengine"),
    (("unity",), "unity", "unity", "unity"),
    (("unreal",), "unreal", "unreal", "unrealengine"),
    (("javascript", "js"), "javascript", "javascript", "javascript"),
    (("three.js", "threejs"), "three", "three.js", "threedotjs"),
    (("roblox",), "roblox", "roblox", "roblox"),
    (("python",), "python", "python", "python"),
    (("glsl", "opengl"), "glsl", "glsl", "opengl"),
    (("pico-8", "pico8"), "pico8", "pico-8", "pico8"),
    (("bitsy",), "bitsy", "bitsy", "bitsy"),
    (("maya",), "maya", "maya", "autodeskmaya"),
    (("photoshop",), "photoshop", "photoshop", "adobephotoshop"),
    (("gamemaker",), "gamemaker", "gamemaker", "gamemaker"),
    (("krita",), "krita", "krita", "krita"),
    (("inkscape",), "inkscape", "inkscape", "inkscape"),
    (("audacity",), "audacity", "audacity", "audacity"),
    (("ableton",), "ableton", "ableton live", "music"),
    (("davinci", "resolve"), "resolve", "davinci resolve", "davinciresolve"),
    (("html",), "html", "html", "html5"),
    (("pen", "pencil", "ink", "marker", "paper", "biro", "ballpoint"), "pen", "pen & paper", "pen"),
    (("codex", "gpt", "chatgpt"), "gpt", "gpt", "openai"),
    (("claude",), "claude", "claude", "claude"),
]
_icon_cache = {}


def icon_svg(name):
    if name not in _icon_cache:
        f = ROOT / "static" / "icons" / f"{name}.svg"
        svg = f.read_text(encoding="utf-8") if f.exists() else ""
        # drop the <title> (the li carries its own) and paint with currentColor
        svg = re.sub(r"<title>.*?</title>", "", svg).replace("<svg ", '<svg aria-hidden="true" fill="currentColor" ', 1)
        _icon_cache[name] = svg
    return _icon_cache[name]


def match_tool(text):
    low = text.lower().strip()
    for prefixes, tid, label, icon in TOOLS:
        for pre in prefixes:
            if low == pre or low.startswith(pre + " ") or (len(pre) > 3 and low.startswith(pre)):
                return tid, label, icon, text[len(pre):].strip(" -")
    return None


def tool_row(made_with, ai):
    """One entry per tool, in order: made_with first, then the ai helpers."""
    row, seen = [], {}
    def add(tid, label, icon, note):
        if tid in seen:
            if note and note not in seen[tid]["notes"]:
                seen[tid]["notes"].append(note)
            return
        item = {"label": label, "svg": icon_svg(icon) if icon else "", "notes": [note] if note else []}
        seen[tid] = item
        row.append(item)
    for m in made_with:
        hit = match_tool(m)
        if hit:
            add(*hit)
        elif m.strip():
            add(m.lower(), m, None, "")
    for e in ai or []:
        tid, label, icon, _ = match_tool(e["tool"]) or (e["tool"], e["tool"], None, "")
        add(tid, label, icon, ", ".join(e.get("models") or []))
    for item in row:
        item["title"] = item["label"] + (": " + ", ".join(item["notes"]) if item["notes"] else "")
    return row


def sort_date(p):
    """When the project itself last changed: `updated` if set, else the latest year it mentions."""
    if p.get("updated"):
        return str(p["updated"])
    ys = re.findall(r"(?:19|20)\d\d", str(p.get("year", "")))
    return f"{max(ys)}-01-01" if ys else "0000"


def load_piece(folder, branch_key):
    p = load_toml(folder / "piece.toml")
    p["slug"] = folder.name
    p["branch"] = branch_key
    p.setdefault("year", "")
    p.setdefault("made_with", [])
    p.setdefault("blurb", "")
    p.setdefault("lead", False)
    p.setdefault("order", 999)
    p["tags"] = [{"text": t, "ai": False} for t in p.get("tags", [])]
    p["tools"] = tool_row(p["made_with"], p.get("ai"))
    # the show/hide-ai toggle never applies to games (Dani, 2026-10-13)
    p["is_ai"] = bool(p.get("ai")) and branch_key not in ("games", "tools")
    p["sort_date"] = sort_date(p)
    # gallery items can carry group = "..."; consecutive items with the same group share a heading
    groups = []
    for g in p.get("gallery", []):
        name = g.get("group", "")
        if not groups or groups[-1]["title"] != name:
            groups.append({"title": name, "pics": []})
        groups[-1]["pics"].append(g)
    p["gallery_groups"] = groups
    # no card picture or hero given: fall back to the first still in the gallery
    stills = [g["src"] for g in p.get("gallery", []) if g.get("src", "").lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp"))]
    hero = p.get("hero") or {}
    if not p.get("thumb") and hero.get("type", "image") == "image" and hero.get("src"):
        p["thumb"] = hero["src"]
    if not p.get("thumb") and stills:
        p["thumb"] = stills[0]
    if not p.get("hero") and p.get("thumb"):
        p["hero"] = {"type": "image", "src": p["thumb"]}
    body = folder / "body.html"
    p["body"] = body.read_text(encoding="utf-8") if body.exists() else ""
    # placeholder text waiting for Dani's own words: <!--draft--> ... <!--/draft-->
    if SHOW_DRAFTS:
        p["body"] = p["body"].replace("<!--draft-->", '<div class="draft-note">').replace("<!--/draft-->", "</div>")
    else:
        p["body"] = re.sub(r"<!--draft-->.*?<!--/draft-->", "", p["body"], flags=re.S)
    p["src"] = folder
    return p


def load_branches():
    branches = []
    for d in sorted(CONTENT.iterdir()):
        if not d.is_dir() or not (d / "_branch.toml").exists():
            continue
        b = load_toml(d / "_branch.toml")
        b["key"] = d.name
        pieces = [load_piece(f, d.name) for f in sorted(d.iterdir()) if (f / "piece.toml").exists()]
        # unpublished pieces live in content/_drafts/<branch>/ (gitignored, so the public repo never holds them)
        drafts = CONTENT / "_drafts" / d.name
        if SHOW_DRAFTS and drafts.exists():
            pieces += [load_piece(f, d.name) for f in sorted(drafts.iterdir()) if (f / "piece.toml").exists()]
        # drafts show only in local builds (python tools/build.py --drafts, which serve.bat uses)
        pieces = [p for p in pieces if SHOW_DRAFTS or not p.get("draft")]
        for p in pieces:
            if p.get("draft"):
                p["tags"].insert(0, {"text": "draft, not published", "ai": False})
        # newest first, by the last real change to the project (see `updated` in content/README.md)
        pieces.sort(key=lambda p: (p["sort_date"], p["title"]), reverse=True)
        b["pieces"] = pieces
        b["leads"] = [p for p in pieces if p["lead"]]
        b["shelf"] = [p for p in pieces if not p["lead"]]
        if b.get("layout") == "timeline":
            # everything in one newest-first run, grouped under the year of its last real change
            years = []
            for p in pieces:
                y = p["sort_date"][:4]
                if not years or years[-1]["year"] != y:
                    years.append({"year": y, "pieces": []})
                years[-1]["pieces"].append(p)
            for y in years:
                y["all_ai"] = all(p["is_ai"] for p in y["pieces"])
            b["timeline"] = years
        years = sorted({int(y) for p in pieces for y in re.findall(r"(?:19|20)\d\d", str(p["year"]))})
        b["span"] = (f"{years[0]} to {years[-1]}" if len(years) > 1 and years[0] != years[-1] else str(years[0])) if years else ""
        branches.append(b)
    branches.sort(key=lambda b: b.get("order", 99))
    return branches


def ship_media(src, dst):
    """Copy a piece's files, shrinking big pictures."""
    dst.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        if f.name in SKIP:
            continue
        if f.is_dir():
            shutil.copytree(f, dst / f.name, dirs_exist_ok=True)
        elif f.suffix.lower() in IMAGE_EXT:
            with Image.open(f) as im:
                if im.width > MAX_W:
                    im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
                    if f.suffix.lower() in (".jpg", ".jpeg"):
                        im.convert("RGB").save(dst / f.name, quality=86, optimize=True)
                    else:
                        im.save(dst / f.name, optimize=True)
                else:
                    shutil.copy2(f, dst / f.name)
        else:
            shutil.copy2(f, dst / f.name)


def write(path, html):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")


def main():
    # ignore_errors: on Windows the preview server can hold a file open; it just gets overwritten
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(ROOT / "static", OUT / "static", ignore=shutil.ignore_patterns("map-*.svg"), dirs_exist_ok=True)
    site = load_toml(CONTENT / "site.toml")
    branches = load_branches()

    # "lately": the most recently changed lead from each room, newest first
    lately = []
    for b in branches:
        leads = [p for p in b["leads"] if p.get("thumb")]
        if leads:
            top = max(leads, key=lambda p: p["sort_date"])
            lately.append({**top, "room": b["key"], "room_label": b["label"]})
    lately.sort(key=lambda p: p["sort_date"], reverse=True)

    # map places that lead to AI-assisted pieces get data-ai, so the toggle can hide them too
    ai_hrefs = {f'{b["key"]}/{p["slug"]}/' for b in branches for p in b["pieces"] if p["is_ai"]}

    def mark_ai(svg):
        return re.sub(r'<a class="place ([^"]*)" href="([^"]*)"',
                      lambda m: f'<a class="place {m.group(1)}" href="{m.group(2)}"' + (' data-ai="1"' if m.group(2) in ai_hrefs else ""),
                      svg)

    write(OUT / "index.html", env.get_template("index.html").render(
        root="", site=site, lately=lately[:4],
        map_wide=mark_ai((ROOT / "static/map-wide.svg").read_text(encoding="utf-8")),
        map_tall=(ROOT / "static/map-tall.svg").read_text(encoding="utf-8")))

    for b in branches:
        write(OUT / b["key"] / "index.html", env.get_template("branch.html").render(root="../", site=site, branch=b))
        for p in b["pieces"]:
            ship_media(p["src"], OUT / b["key"] / p["slug"])
            write(OUT / b["key"] / p["slug"] / "index.html",
                  env.get_template("piece.html").render(root="../../", site=site, branch=b, p=p))

    # the private door on the map (see tools/lock.py)
    sealed = lock.seal()
    write(OUT / "writing" / "private" / "index.html", env.get_template("private.html").render(root="../../", site=site, hint=sealed.get("hint", "")))
    write(OUT / "writing" / "private" / "sealed.json", json.dumps(sealed))
    write(OUT / "robots.txt", "User-agent: *\nDisallow: /writing/private/\n")
    # the about page: Dani's own words plus links
    about = CONTENT / "about"
    if (about / "body.html").exists():
        body = (about / "body.html").read_text(encoding="utf-8")
        if SHOW_DRAFTS and (about / "draft.html").exists():
            body += '<div class="draft-note">' + (about / "draft.html").read_text(encoding="utf-8") + "</div>"
        if SHOW_DRAFTS:
            body = body.replace("<!--draft-->", '<div class="draft-note">').replace("<!--/draft-->", "</div>")
        else:
            body = re.sub(r"<!--draft-->.*?<!--/draft-->", "", body, flags=re.S)
        meta = load_toml(about / "about.toml") if (about / "about.toml").exists() else {}
        write(OUT / "about" / "index.html", env.get_template("about.html").render(root="../", site=site, body=body, links=meta.get("links", [])))
    write(OUT / "gazetteer" / "index.html", env.get_template("gazetteer.html").render(root="../", site=site, branches=branches))
    (OUT / ".nojekyll").write_text("")
    n = sum(len(b["pieces"]) for b in branches)
    print(f"built {len(branches)} branches, {n} pieces -> {OUT}")


if __name__ == "__main__":
    main()
