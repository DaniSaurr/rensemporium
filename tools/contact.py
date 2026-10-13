"""Quick contact sheet: python tools/contact.py OUT.jpg [--cols 4] [--cell 400x300] [--only a,b] [--deep] PATH_OR_DIR...
A directory contributes every png/jpg in it (--deep: its sub-folders too); a path with * is globbed.
--only keeps files whose name contains one of the substrings (e.g. left34,file)."""
import sys, os, glob
from PIL import Image, ImageDraw

args = sys.argv[1:]
out = args.pop(0)
cols, cell = 4, (400, 300)
only, deep = [], False
files = []
i = 0
while i < len(args):
    a = args[i]
    if a == "--cols":
        cols = int(args[i + 1]); i += 2; continue
    if a == "--only":
        only = args[i + 1].split(","); i += 2; continue
    if a == "--deep":
        deep = True; i += 1; continue
    if a == "--cell":
        w, h = args[i + 1].split("x"); cell = (int(w), int(h)); i += 2; continue
    if os.path.isdir(a):
        pat = os.path.join(a, "**", "*") if deep else os.path.join(a, "*")
        files += sorted(f for f in glob.glob(pat, recursive=deep) if f.lower().endswith((".png", ".jpg", ".jpeg")) and "contact" not in os.path.basename(f))
    else:
        files += sorted(glob.glob(a))
    i += 1
if only:
    files = [f for f in files if any(o in os.path.basename(f) for o in only)]
if not files:
    raise SystemExit("no images")
cols = min(cols, len(files))
rows = (len(files) + cols - 1) // cols
W = Image.new("RGB", (cols * cell[0], rows * cell[1]), (30, 30, 30))
d = ImageDraw.Draw(W)
for n, f in enumerate(files):
    try:
        im = Image.open(f).convert("RGB")
    except Exception:
        continue
    im.thumbnail(cell)
    x, y = (n % cols) * cell[0], (n // cols) * cell[1]
    W.paste(im, (x + (cell[0] - im.width) // 2, y + (cell[1] - im.height) // 2))
    d.text((x + 4, y + 3), os.path.basename(os.path.dirname(f))[-14:] + "/" + os.path.basename(f)[:30], fill=(255, 255, 0))
W.save(out, quality=80)
print(out, len(files))
