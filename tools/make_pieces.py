"""Copies chosen renders from renders/ into content/3d/<slug>/ and writes piece.toml.

    python tools/make_pieces.py [slug ...]        # default: every piece in tools/pieces_pass2.py

Stills become JPEG q85, 1800 px wide at most. Videos are copied (re-encoded smaller if over 8 MB).
Strips are contact grids built from several renders (same camera, different versions).
A piece with "extend": True only appends gallery items to its existing piece.toml and leaves the rest alone.
Never touches anything outside content/3d/<slug>/ and renders/.
"""
import os, sys, json, shutil, subprocess, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "renders")
C = os.path.join(ROOT, "content", "3d")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
MAXW = 1800


def jpg(src, dst, maxw=MAXW):
    im = Image.open(src).convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(dst, quality=85, optimize=True)


def video(src, dst):
    shutil.copy2(src, dst)
    if os.path.getsize(dst) > 8 * 1024 * 1024:
        tmp = dst + ".tmp.mp4"
        for crf in (28, 32, 36):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                            "-an", "-crf", str(crf), "-movflags", "+faststart", tmp], check=True)
            if os.path.getsize(tmp) <= 8 * 1024 * 1024:
                break
        os.replace(tmp, dst)


def strip(paths, dst, cols, cell=(600, 450), gap=6):
    rows = (len(paths) + cols - 1) // cols
    W = Image.new("RGB", (cols * cell[0] + gap * (cols - 1), rows * cell[1] + gap * (rows - 1)), (24, 24, 30))
    for i, p in enumerate(paths):
        im = Image.open(os.path.join(R, p)).convert("RGB")
        im = im.resize(cell, Image.LANCZOS) if im.size != cell and abs(im.width / im.height - cell[0] / cell[1]) < 0.02 else im
        im.thumbnail(cell, Image.LANCZOS)
        x, y = (i % cols) * (cell[0] + gap), (i // cols) * (cell[1] + gap)
        W.paste(im, (x + (cell[0] - im.width) // 2, y + (cell[1] - im.height) // 2))
    W.save(dst, quality=88, optimize=True)


def q(s):
    return json.dumps(s, ensure_ascii=False)


def entry(src, caption=None, contain=False):
    parts = ["src = " + q(src)]
    if caption:
        parts.append("caption = " + q(caption))
    if contain:
        parts.append("contain = true")
    return "  { " + ", ".join(parts) + " },"


def build(spec):
    slug = spec["slug"]
    out = os.path.join(C, slug)
    os.makedirs(out, exist_ok=True)
    gallery, made = [], set()

    def place(srcrel, name, kind=None):
        """Copy renders/<srcrel> to content/3d/<slug>/<name>(.jpg|.mp4); returns the file name."""
        src = os.path.join(R, srcrel)
        if srcrel.endswith(".mp4"):
            dst = name + ".mp4"
            if dst not in made:
                video(src, os.path.join(out, dst)); made.add(dst)
        else:
            dst = name + ".jpg"
            if dst not in made:
                jpg(src, os.path.join(out, dst)); made.add(dst)
        return dst

    for g in spec.get("gallery", []):
        if g.get("strip"):
            dst = g["name"] + ".jpg"
            strip(g["strip"], os.path.join(out, dst), g.get("cols", 3), tuple(g.get("cell", (600, 450))))
            made.add(dst)
            gallery.append(entry(dst, g.get("caption"), contain=True))
        else:
            gallery.append(entry(place(g["src"], g["name"]), g.get("caption")))
    if spec.get("extend"):
        pt = os.path.join(out, "piece.toml")
        text = open(pt, encoding="utf-8").read()
        m = re.search(r"\ngallery = \[\n(.*?)\n\]", text, re.S)
        have = set(re.findall(r'src = "([^"]+)"', m.group(1))) if m else set()
        new = [e for e in gallery if re.search(r'src = "([^"]+)"', e).group(1) not in have]
        if m:
            text = text[:m.end(1)] + "\n" + "\n".join(new) + text[m.end(1):]
        else:
            text = text.rstrip("\n") + "\ngallery = [\n" + "\n".join(new) + "\n]\n"
        open(pt, "w", encoding="utf-8").write(text)
        return slug, len(made), os.path.join(out, "piece.toml")

    h = spec["hero"]
    if h.get("strip"):
        hn = h["name"] + ".jpg"
        strip(h["strip"], os.path.join(out, hn), h.get("cols", 3), tuple(h.get("cell", (600, 450))))
        made.add(hn)
        h = dict(h, src=None)
        hero = '{ type = "image", src = %s, alt = %s }' % (q(hn), q(h.get("alt", "")))
        thumb = hn
    elif h["src"].endswith(".mp4"):
        hv = place(h["src"], h["name"])
        poster = place(h["poster"], h["name"] + "-poster")
        hero = '{ type = "video", src = %s, poster = %s }' % (q(hv), q(poster))
        thumb = poster
    else:
        hi = place(h["src"], h["name"])
        hero = '{ type = "image", src = %s, alt = %s }' % (q(hi), q(h.get("alt", "")))
        thumb = hi
    if spec.get("thumb"):
        thumb = place(spec["thumb"]["src"], spec["thumb"]["name"])
    lines = ["title = " + q(spec["title"]), "year = " + q(spec["year"]),
             "made_with = " + json.dumps(spec.get("made_with", ["blender"])),
             "lead = " + ("true" if spec.get("lead") else "false"), "order = " + str(spec["order"]),
             'blurb = ""']
    if spec.get("tags"):
        lines.append("tags = " + json.dumps(spec["tags"], ensure_ascii=False))
    lines += ["thumb = " + q(thumb), "hero = " + hero]
    if spec.get("credits"):
        lines.append("credits = " + json.dumps(spec["credits"], ensure_ascii=False))
    if gallery:
        lines += ["gallery = [", *gallery, "]"]
    open(os.path.join(out, "piece.toml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return slug, len(made), os.path.join(out, "piece.toml")


if __name__ == "__main__":
    import pieces_pass2
    want = sys.argv[1:]
    for spec in pieces_pass2.PIECES:
        if want and spec["slug"] not in want:
            continue
        print(build(spec))
