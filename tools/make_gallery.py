"""Builds renders/<slug>/contact.jpg for each slug and renders/index.html (plain local gallery)."""
import os, glob, html, subprocess
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "renders")
CELL = (400, 300)

def collect(slug_dir):
    imgs, vids = [], []
    for dp, dn, fn in os.walk(slug_dir):
        dn[:] = [d for d in dn if not d.startswith("_")]
        for f in sorted(fn):
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, ROOT).replace("\\", "/")
            if f.lower().endswith(".png"): imgs.append((rel, p))
            elif f.lower().endswith(".mp4"): vids.append((rel, p))
    return imgs, vids

def sheet(slug, imgs, vids, out):
    tiles = [(r, p) for r, p in imgs]
    for r, p in vids:  # one mid frame of each turntable
        tmp = out + ".frame.png"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", p, "-frames:v", "1", tmp])
        if os.path.exists(tmp): tiles.append((r + " (frame)", tmp))
    if not tiles: return False
    cols = min(4, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    W = Image.new("RGB", (cols * CELL[0], rows * CELL[1]), (30, 30, 30))
    d = ImageDraw.Draw(W)
    for i, (r, p) in enumerate(tiles):
        im = Image.open(p).convert("RGB"); im.thumbnail(CELL)
        x, y = (i % cols) * CELL[0], (i // cols) * CELL[1]
        W.paste(im, (x + (CELL[0] - im.width) // 2, y + (CELL[1] - im.height) // 2))
        d.text((x + 4, y + 3), os.path.basename(r)[:40] if "/" not in r[len(slug)+1:] else r[len(slug)+1:][:46], fill=(255, 255, 0))
    W.save(out, quality=82)
    if os.path.exists(out + ".frame.png"): os.remove(out + ".frame.png")
    return True

slugs = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
parts = ["<!doctype html><meta charset=utf-8><title>renders</title><style>body{font:14px sans-serif;background:#16141c;color:#ddd;margin:20px}img,video{max-width:420px;margin:4px;vertical-align:top}h2{border-top:1px solid #444;padding-top:12px}a{color:#b9a8ff}</style><h1>Dani renders</h1><p>"]
parts.append(" | ".join('<a href="#%s">%s</a>' % (s, s) for s in slugs) + "</p>")
for s in slugs:
    imgs, vids = collect(os.path.join(ROOT, s))
    if not imgs and not vids: continue
    sheet(s, imgs, vids, os.path.join(ROOT, s, "contact.jpg"))
    parts.append('<h2 id="%s">%s <small>(%d images, %d videos) <a href="%s/contact.jpg">contact sheet</a></small></h2>' % (s, s, len(imgs), len(vids), s))
    last = None
    for rel, _ in imgs + vids:
        sub = os.path.dirname(rel)
        if sub != last:
            parts.append("<div><b>%s</b></div>" % html.escape(sub)); last = sub
        if rel.endswith(".mp4"):
            parts.append('<video src="%s" controls loop muted preload="metadata"></video>' % rel)
        else:
            parts.append('<a href="%s"><img loading=lazy src="%s" title="%s"></a>' % (rel, rel, os.path.basename(rel)))
open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write("\n".join(parts))
print("ok", len(slugs))
