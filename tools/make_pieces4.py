"""Pass 4 builder: AI-assisted 3D and experiments. Copies chosen media into NEW content/<room>/<slug>/ folders
and writes piece.toml. Sources are renders/ output, captures or Dani's own output folders (read only).

    python tools/make_pieces4.py <slug> [...]      specs live in pieces_pass4.py
Helpers: jpg() resizes (q85, 1800 px), crop43() trims a flat background and pads to 4:3, vid() trims/re-encodes
(optionally cropping to the moving subject), montage_h() puts videos side by side.
"""
import os, sys, json, shutil, subprocess
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
MAXW = 1800


def jpg(src, dst, maxw=MAXW, crop=None, q=85):
    im = Image.open(src).convert("RGB")
    if crop == "43":
        im = crop43(im)
    elif crop:
        im = im.crop(crop)
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(dst, quality=q, optimize=True)


def bbox_nonbg(im, thresh=18, step=2):
    a = np.asarray(im.convert("RGB"), dtype=np.int16)
    bg = np.median(np.concatenate([a[:4, :4].reshape(-1, 3), a[:4, -4:].reshape(-1, 3), a[-4:, :4].reshape(-1, 3), a[-4:, -4:].reshape(-1, 3)]), axis=0)
    d = np.abs(a - bg).sum(axis=2) > thresh
    ys, xs = np.where(d)
    if len(xs) == 0:
        return None, tuple(bg)
    return (xs.min(), ys.min(), xs.max(), ys.max()), tuple(int(v) for v in bg)


def crop43(im, pad=0.07, aspect=4 / 3):
    bb, bg = bbox_nonbg(im)
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    w, h = w * (1 + 2 * pad), h * (1 + 2 * pad)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if w / h < aspect:
        w = h * aspect
    else:
        h = w / aspect
    box = (int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))
    out = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), bg)
    out.paste(im, (-box[0], -box[1]))
    return out


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def vid(src, dst, ss=None, t=None, scale_w=None, crop=None, max_mb=8.0, fps=None, vf_extra=None):
    vf = []
    if crop:
        vf.append("crop=%d:%d:%d:%d" % crop)
    if scale_w:
        vf.append("scale=%d:-2:flags=lanczos" % scale_w)
    if fps:
        vf.append("fps=%d" % fps)
    if vf_extra:
        vf.append(vf_extra)
    vf.append("format=yuv420p")
    for crf in (24, 28, 32, 36):
        cmd = ["ffmpeg", "-y", "-loglevel", "error"] + (["-ss", str(ss)] if ss else []) + ["-i", src] + (["-t", str(t)] if t else []) + \
              ["-vf", ",".join(vf), "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-an", "-movflags", "+faststart", dst]
        run(cmd)
        if os.path.getsize(dst) <= max_mb * 1024 * 1024:
            return
    return


def subject_crop(src, aspect=4 / 3, pad=0.1, samples=12):
    """Union bounding box of what moves/differs from the flat background across the clip, padded to `aspect`."""
    import tempfile
    d = tempfile.mkdtemp()
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", "fps=3", os.path.join(d, "f%03d.png")])
    fs = sorted(os.listdir(d))
    step = max(1, len(fs) // samples)
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    W = H = 0
    for f in fs[::step]:
        im = Image.open(os.path.join(d, f)).convert("RGB")
        W, H = im.size
        bb, _ = bbox_nonbg(im)
        if bb:
            x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
    shutil.rmtree(d, ignore_errors=True)
    w, h = (x1 - x0) * (1 + 2 * pad), (y1 - y0) * (1 + 2 * pad)
    if w / h < aspect:
        w = h * aspect
    else:
        h = w / aspect
    w, h = min(w, W), min(h, H)
    w, h = int(w) // 2 * 2, int(h) // 2 * 2
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X = int(min(max(cx - w / 2, 0), W - w))
    Y = int(min(max(cy - h / 2, 0), H - h))
    return (w, h, X, Y)


def q(s):
    return json.dumps(s, ensure_ascii=False)


def entry(src, caption=None, contain=False):
    parts = ["src = " + q(src)]
    if caption:
        parts.append("caption = " + q(caption))
    if contain:
        parts.append("contain = true")
    return "  { " + ", ".join(parts) + " },"


def ai_line(ai):
    items = []
    for tool, models in ai:
        items.append("{ tool = %s, models = %s }" % (q(tool), json.dumps(models)) if models else "{ tool = %s }" % q(tool))
    return "ai = [ " + ", ".join(items) + " ]"


def write_piece(room, slug, title, year, made_with, lead, order, hero, thumb, ai, gallery, dev=None, links=None, credits=None, tags=None, blurb=""):
    out = os.path.join(CONTENT, room, slug)
    lines = ["title = " + q(title), "year = " + q(year), "made_with = " + json.dumps(made_with), "lead = " + ("true" if lead else "false"),
             "order = " + str(order), "blurb = " + q(blurb)]
    if tags:
        lines.append("tags = " + json.dumps(tags))
    lines += ["thumb = " + q(thumb), "hero = " + hero]
    if links:
        lines.append("links = [ " + ", ".join("{ label = %s, href = %s }" % (q(a), q(b)) for a, b in links) + " ]")
    if ai:
        lines.append(ai_line(ai))
    if credits:
        lines.append("credits = " + json.dumps(credits, ensure_ascii=False))
    lines += ["gallery = [", *[entry(*g) for g in gallery], "]"]
    if dev:
        lines += ["dev = [", *[entry(*g) for g in dev], "]"]
    open(os.path.join(out, "piece.toml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")


def mkdir(room, slug):
    out = os.path.join(CONTENT, room, slug)
    if os.path.exists(os.path.join(out, "piece.toml")):
        raise SystemExit("refusing to overwrite existing piece " + out)
    os.makedirs(out, exist_ok=True)
    return out
