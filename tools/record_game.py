"""Record a game you are playing by hand, then pull stills out of it.

    python tools\\record_game.py <slug> [--seconds 120] [--region x,y,w,h]

Start the game first (windowed or fullscreen), run this, and switch to the game
during the countdown. It records the screen with ffmpeg's ddagrab (Windows desktop
duplication, which works for GPU games), no audio, and writes to renders\\games\\<slug>\\:

    clip.mp4        the recording, H.264, up to 1080p (for picking stills; can be big)
    clip-web.mp4    a copy sized for the site: under 8 MB if the take is 20 s or less, else under 24 MB
    still-001.jpg ...   one frame every --every seconds (default 10), 1800 px wide at most
    contact.jpg     all the stills on one sheet with their numbers

Press Enter in this window to stop early. --region crops to part of the screen
(x,y,w,h in pixels of that monitor, e.g. --region 0,0,1280,720 for a windowed game
in the top-left corner). --monitor N picks another screen (0 is the first).

Picking favourites: open contact.jpg, then

    python tools\\record_game.py <slug> --pick 3 7 12 --use-clip

copies still-003, still-007 and still-012 into content\\games\\<slug>\\ as <slug>-shot-03.jpg
and so on (and clip-web.mp4 as <slug>-clip.mp4 with --use-clip), and prints the lines to
paste into piece.toml. It does not edit piece.toml and never overwrites an existing file.

Dry run:  python tools\\record_game.py test --seconds 5 --delay 0 --every 1
"""

import argparse
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent


def die(msg):
    print("error:", msg, file=sys.stderr)
    sys.exit(1)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe_duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def record(out, seconds, fps, monitor, region, delay):
    src = f"ddagrab=framerate={fps}:output_idx={monitor}:draw_mouse=0"
    if region:
        x, y, w, h = region
        src += f":offset_x={x}:offset_y={y}:video_size={w}x{h}"
    vf = "hwdownload,format=bgra,scale=trunc(iw/2)*2:trunc(ih/2)*2,scale=-2:'min(1080,ih)',format=yuv420p"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-f", "lavfi", "-i", src,
           "-t", str(seconds), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-an", "-movflags", "+faststart", str(out)]
    if delay > 0:
        print(f"recording {seconds} s in {delay} s. Switch to the game now. Enter stops early.")
        for n in range(delay, 0, -1):
            print(f"  {n}...", flush=True)
            time.sleep(1)
    else:
        print(f"recording {seconds} s. Enter stops early.")
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, text=True)

    def watch_stdin():
        try:
            line = sys.stdin.readline()
            if line and p.poll() is None:   # '' means stdin is closed: keep recording
                p.stdin.write("q\n")
                p.stdin.flush()
        except Exception:
            pass

    threading.Thread(target=watch_stdin, daemon=True).start()
    try:
        p.wait()
    except KeyboardInterrupt:
        try:
            p.stdin.write("q\n")
            p.stdin.flush()
        except Exception:
            pass
        p.wait()
    return p.returncode


def encode_web(src, dst, seconds):
    limit_mb = 8.0 if seconds <= 20 else 24.0
    kbps = int(limit_mb * 8192 * 0.9 / max(seconds, 1))
    vf = "scale=-2:'min(720,ih)':flags=lanczos,format=yuv420p"
    for attempt in range(3):
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-vf", vf,
               "-c:v", "libx264", "-preset", "slow", "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.4)}k",
               "-bufsize", f"{kbps * 2}k", "-an", "-movflags", "+faststart", str(dst)]
        r = run(cmd)
        if r.returncode != 0:
            print("ffmpeg failed:", r.stderr)
            return
        mb = dst.stat().st_size / 1e6
        if mb <= limit_mb:
            print(f"clip-web.mp4: {mb:.1f} MB (limit {limit_mb:.0f})")
            return
        kbps = int(kbps * 0.8)
    print(f"clip-web.mp4 is {mb:.1f} MB, over the {limit_mb:.0f} MB limit; trim the take")


def extract_stills(clip, folder, every):
    for old in folder.glob("still-*.jpg"):
        old.unlink()
    r = run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(clip),
             "-vf", f"fps=1/{every},scale='min(1800,iw)':-2", "-q:v", "3", str(folder / "still-%03d.jpg")])
    if r.returncode != 0:
        print("still extraction failed:", r.stderr)
    return sorted(folder.glob("still-*.jpg"))


def contact_sheet(stills, every, out):
    if not stills:
        return
    cols = 4
    tw = 440
    ims = []
    for s in stills:
        with Image.open(s) as im:
            im = im.convert("RGB")
            im.thumbnail((tw, tw))
            ims.append(im.copy())
    th = max(i.height for i in ims)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 18)), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, im in enumerate(ims):
        x, y = (k % cols) * tw, (k // cols) * (th + 18)
        sheet.paste(im, (x, y + 18))
        d.text((x + 4, y + 3), f"{k + 1}   {k * every}s", fill=(255, 255, 255))
    sheet.save(out, quality=85)


def pick(slug, numbers, use_clip, folder):
    dest = ROOT / "content" / "games" / slug
    if not dest.is_dir():
        die(f"no content folder {dest}")
    lines = []
    for n in numbers:
        src = folder / f"still-{n:03d}.jpg"
        if not src.exists():
            print(f"skip {src.name}: not there")
            continue
        dst = dest / f"{slug}-shot-{n:02d}.jpg"
        if dst.exists():
            print(f"skip {dst.name}: already exists")
        else:
            shutil.copy2(src, dst)
        lines.append(f'  {{ src = "{dst.name}" }},')
    if use_clip:
        web = folder / "clip-web.mp4"
        dst = dest / f"{slug}-clip.mp4"
        if not web.exists():
            print("no clip-web.mp4 to copy")
        elif dst.exists():
            print(f"skip {dst.name}: already exists")
        else:
            shutil.copy2(web, dst)
        if web.exists():
            lines.insert(0, f'  {{ src = "{dst.name}" }},')
    print(f"\ncopied into {dest}. Add to the gallery in piece.toml:\n")
    print("\n".join(lines))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", help="piece folder name under content/games, e.g. dungeonzoo")
    ap.add_argument("--seconds", type=int, default=120)
    ap.add_argument("--region", default="", help="x,y,w,h of the part of the screen to record")
    ap.add_argument("--monitor", type=int, default=0)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--every", type=float, default=10, help="seconds between stills")
    ap.add_argument("--delay", type=int, default=5, help="countdown before recording starts")
    ap.add_argument("--out", default="", help="output folder (default renders/games/<slug>)")
    ap.add_argument("--pick", type=int, nargs="+", help="copy these still numbers into content/games/<slug>/")
    ap.add_argument("--use-clip", action="store_true", help="with --pick: also copy clip-web.mp4")
    args = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9-]+", args.slug):
        die("slug is lowercase letters, digits and dashes")
    folder = Path(args.out) if args.out else ROOT / "renders" / "games" / args.slug
    if args.pick:
        pick(args.slug, args.pick, args.use_clip, folder)
        return

    region = None
    if args.region:
        try:
            region = [int(v) for v in args.region.split(",")]
            assert len(region) == 4
        except (ValueError, AssertionError):
            die("--region wants x,y,w,h, four whole numbers")
    folder.mkdir(parents=True, exist_ok=True)
    clip = folder / "clip.mp4"
    code = record(clip, args.seconds, args.fps, args.monitor, region, args.delay)
    if not clip.exists() or clip.stat().st_size < 1000:
        die(f"ffmpeg wrote nothing (exit {code}). ddagrab needs an interactive desktop session; "
            "if the game is exclusive fullscreen, run it borderless or windowed.")
    secs = probe_duration(clip)
    print(f"recorded {secs:.1f} s, {clip.stat().st_size / 1e6:.1f} MB -> {clip}")
    encode_web(clip, folder / "clip-web.mp4", secs)
    stills = extract_stills(clip, folder, args.every)
    contact_sheet(stills, args.every, folder / "contact.jpg")
    print(f"{len(stills)} stills (one every {args.every:g} s) in {folder}")
    print()
    print("Pick favourites:")
    print(f"  1. open {folder / 'contact.jpg'} (the number above each picture is its still number)")
    print(f"  2. python tools\\record_game.py {args.slug} --pick 3 7 12 --use-clip")
    print("     (copies those stills, and clip-web.mp4 with --use-clip, into content\\games\\"
          f"{args.slug}\\ and prints the gallery lines for piece.toml)")


if __name__ == "__main__":
    main()
