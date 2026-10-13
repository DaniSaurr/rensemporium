"""Capture stills and a short clip from a Godot 4 project with Movie Maker mode.

    python tools/godot_capture.py <project folder> --name sk --tag court \\
        --frames 450 --stills 8 --clip-seconds 12 -- --start=morning

What it does, in order:

 1. Copies the project to %TEMP%\\gamecap\\<name> (robocopy; the original is never
    written to, and the copy gets its own user:// folder under %APPDATA%\\gamecap\\<name>,
    so saves, settings and caches of the original are not touched).
 2. In the COPY ONLY: renames the user dir, and if you asked for camera drift,
    held keys or a custom script, adds a small autoload (_capture_helper.gd).
 3. Runs  godot --path <copy> --write-movie <frames>.png --fixed-fps 30 --quit-after N [scene]
    which writes one numbered PNG per frame, frame-exact whatever the machine's speed.
 4. Picks --stills evenly spaced frames (skipping black or flat ones) and saves them
    as JPEG q85 (or PNG with --png), at most 1800 px wide.
 5. Encodes --clip-seconds of the run as H.264, no audio, 720p or less, under --max-mb.

Everything after a bare `--` goes to the game as user args (the game sees them
in OS.get_cmdline_user_args()). Outputs land in renders/games/<name>/ unless --out is given.

One game at a time: it refuses to start while any Godot process is open, runs Godot in the
foreground, kills the whole process tree on --timeout, and checks tasklist before returning.

Driving a game that wants a player (all optional, all written into the copy only):
    --drift 12          slowly turn the active 3D camera, degrees per second
    --drift-mode mouse  same, but as mouse motion events (for mouse-look controllers)
    --hold move_forward:1-8   press an input action (or a key name like W) from 1 s to 8 s
    --tap ui_accept:3,9       tap it at 3 s and 9 s
    --autoload my_demo.gd     your own script, registered as an autoload in the copy
    --mouse-capture           set the mouse mode to captured at start

Examples:
    python tools/godot_capture.py "C:/Users/AEROCOOL/Documents/opus 5.5/DungeonZoo" --name dungeonzoo \\
        --frames 600 --clip-seconds 15 --stills 6 --hold move_forward:1-6
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parent.parent
TEMP = Path(os.environ.get("TEMP", r"C:\Windows\Temp"))
CAPROOT = TEMP / "gamecap"
FRAMES = CAPROOT / "_frames"
DEFAULT_GODOT = r"C:\Users\AEROCOOL\Documents\Godot '26\Godot_v4.7.1-stable_win64_console.exe"

EXCLUDE_DIRS = [".git", "build", "builds", "shots", "__pycache__", ".claude", ".vscode", ".idea"]
EXCLUDE_FILES = ["*.exe", "*.zip", "*.rar", "*.7z", "*.pck", "*.blend", "*.blend1", "*.psd", "*.kra", "*.log"]

HELPER_NAME = "_capture_helper"

HELPER_GD = r'''extends Node
## Written into the TEMP COPY of a project by tools/godot_capture.py. Not part of the original.

var cfg: Dictionary = {}
var t := 0.0
var _held := {}
var _tapped := {}
var _release_next: Array = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var f := FileAccess.open("res://_capture_cfg.json", FileAccess.READ)
	if f:
		var parsed = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			cfg = parsed
	if cfg.get("mouse_capture", false):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _send(name: String, down: bool) -> void:
	if InputMap.has_action(name):
		var a := InputEventAction.new()
		a.action = name
		a.pressed = down
		a.strength = 1.0 if down else 0.0
		Input.parse_input_event(a)
	else:
		var k := InputEventKey.new()
		var code := OS.find_keycode_from_string(name)
		k.keycode = code
		k.physical_keycode = code
		k.pressed = down
		Input.parse_input_event(k)


func _process(dt: float) -> void:
	t += dt
	for n in _release_next:
		_send(n, false)
	_release_next.clear()

	var drift := float(cfg.get("drift", 0.0))
	if drift != 0.0:
		if String(cfg.get("drift_mode", "camera")) == "mouse":
			var ev := InputEventMouseMotion.new()
			ev.relative = Vector2(drift * dt * float(cfg.get("mouse_px_per_deg", 8.0)), 0.0)
			ev.position = get_viewport().get_visible_rect().size * 0.5
			Input.parse_input_event(ev)
		else:
			var cam := get_viewport().get_camera_3d()
			if cam:
				cam.global_rotate(Vector3.UP, deg_to_rad(-drift) * dt)

	for h in cfg.get("hold", []):
		var on: bool = t >= float(h["from"]) and t < float(h["to"])
		var key := String(h["name"])
		if on != bool(_held.get(key, false)):
			_held[key] = on
			_send(key, on)

	for p in cfg.get("tap", []):
		var id := "%s@%s" % [p["name"], p["at"]]
		if not _tapped.has(id) and t >= float(p["at"]):
			_tapped[id] = true
			_send(String(p["name"]), true)
			_release_next.append(String(p["name"]))
'''


def godot_processes():
    """Names of Godot processes running right now (the editor, a game, a console wrapper)."""
    r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq Godot*", "/FO", "CSV", "/NH"], capture_output=True, text=True)
    return [ln.split(",")[0].strip('"') for ln in r.stdout.splitlines() if ln.lower().startswith('"godot')]


def require_no_godot():
    """One game at a time: refuse to start while any Godot process is open."""
    running = godot_processes()
    if running:
        die("a Godot process is already running (" + ", ".join(sorted(set(running))) +
            "). Close it first; captures run strictly one at a time.")


def run_godot(cmd, log_path, timeout):
    """Run one Godot command, wait for it, kill its whole process tree on timeout, and
    confirm with tasklist that nothing is left before returning. Returns the exit code."""
    require_no_godot()
    with open(log_path, "wb") as lf:
        p = subprocess.Popen(cmd, stdout=lf, stderr=subprocess.STDOUT)
        try:
            code = p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
            p.wait()
            code = "timeout"
    for _ in range(30):
        if not godot_processes():
            break
        time.sleep(1)
    left = godot_processes()
    if left:
        print("WARNING: still running after exit:", ", ".join(sorted(set(left))))
    else:
        print("godot is gone (tasklist clear)")
    return code


def die(msg):
    print("error:", msg, file=sys.stderr)
    sys.exit(1)


def split_argv(argv):
    if "--" in argv:
        i = argv.index("--")
        return argv[:i], argv[i + 1:]
    return argv, []


def parse_span(spec):
    """'move_forward:1-8' -> ('move_forward', 1.0, 8.0)"""
    name, _, span = spec.rpartition(":")
    a, _, b = span.partition("-")
    if not name or not b:
        die(f"bad --hold {spec!r}, want NAME:FROM-TO in seconds")
    return name, float(a), float(b)


def parse_taps(spec):
    name, _, times = spec.rpartition(":")
    if not name:
        die(f"bad --tap {spec!r}, want NAME:T1,T2 in seconds")
    return [(name, float(t)) for t in times.split(",") if t]


# ---- the temp copy ---------------------------------------------------------------

def safe_copy_dir(name):
    dst = (CAPROOT / name).resolve()
    if CAPROOT.resolve() not in dst.parents:
        die(f"refusing to use {dst} as a copy")
    return dst


def copy_project(src, dst, extra_exclude, no_default_exclude):
    src = src.resolve()
    if dst == src or src in dst.parents or dst in src.parents:
        die("copy and original overlap")
    dst.mkdir(parents=True, exist_ok=True)
    xd = ([] if no_default_exclude else EXCLUDE_DIRS) + list(extra_exclude)
    xf = [] if no_default_exclude else EXCLUDE_FILES
    cmd = ["robocopy", str(src), str(dst), "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/MT:8"]
    if xd:
        cmd += ["/XD"] + xd
    if xf:
        cmd += ["/XF"] + xf
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode >= 8:
        die(f"robocopy failed ({r.returncode}):\n{r.stdout}\n{r.stderr}")


def edit_project(copy, name, helper_cfg, extra_autoload):
    """Change project.godot IN THE COPY: own user:// folder, plus autoloads."""
    pg = copy / "project.godot"
    raw = pg.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    lines = raw.decode("utf-8-sig").splitlines()

    def section_range(sec):
        start = None
        for i, ln in enumerate(lines):
            if ln.strip() == f"[{sec}]":
                start = i
            elif start is not None and ln.strip().startswith("[") and ln.strip().endswith("]"):
                return start, i
        return (start, len(lines)) if start is not None else (None, None)

    # drop any existing user dir settings, then set ours
    lines = [ln for ln in lines if not re.match(r"\s*config/(use_custom_user_dir|custom_user_dir_name)\s*=", ln)]
    s, e = section_range("application")
    new = ["config/use_custom_user_dir=true", f'config/custom_user_dir_name="gamecap/{name}"']
    if s is None:
        lines += ["", "[application]"] + new
    else:
        lines[s + 1:s + 1] = new

    autoloads = []
    if helper_cfg is not None:
        autoloads.append((HELPER_NAME, f"*res://{HELPER_NAME}.gd"))
    for n, p in extra_autoload:
        autoloads.append((n, f"*res://{p}"))
    if autoloads:
        s, e = section_range("autoload")
        add = [f'{n}="{p}"' for n, p in autoloads]
        if s is None:
            lines += ["", "[autoload]"] + add
        else:
            while e > s + 1 and not lines[e - 1].strip():
                e -= 1
            lines[e:e] = add

    out = "\n".join(lines) + "\n"
    pg.write_bytes((b"\xef\xbb\xbf" if bom else b"") + out.encode("utf-8"))


def main_scene(copy):
    m = re.search(r'run/main_scene="([^"]+)"', (copy / "project.godot").read_text(encoding="utf-8-sig"))
    return m.group(1) if m else ""


# ---- running godot ---------------------------------------------------------------

def godot_version(exe):
    r = subprocess.run([exe, "--version"], capture_output=True, text=True)
    m = re.match(r"(\d+)\.(\d+)", r.stdout.strip())
    return (int(m.group(1)), int(m.group(2))) if m else None


def project_feature_version(copy):
    t = (copy / "project.godot").read_text(encoding="utf-8-sig")
    m = re.search(r'config/features=PackedStringArray\("(\d+)\.(\d+)"', t)
    return (int(m.group(1)), int(m.group(2))) if m else None


def import_project(exe, copy, log):
    print("importing the copy (first run or a different engine version)...")
    run_godot([exe, "--headless", "--path", str(copy), "--import"], log, 540)


def run_movie(exe, copy, frames_dir, args):
    shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True, exist_ok=True)
    base = frames_dir / "f.png"
    cmd = [exe, "--path", str(copy), "--windowed", "--resolution", args.resolution,
           "--write-movie", str(base), "--fixed-fps", str(args.fps), "--quit-after", str(args.frames)]
    if args.rendering_method:
        cmd += ["--rendering-method", args.rendering_method]
    if args.scene:
        cmd.append(args.scene)
    if args.game_args:
        cmd += ["--"] + args.game_args
    print("running:", " ".join(f'"{c}"' if " " in c else c for c in cmd))
    log = frames_dir / "godot.log"
    t0 = time.time()
    code = run_godot(cmd, log, args.timeout)
    frames = sorted(frames_dir.glob("f*.png"))
    print(f"godot exited ({code}) after {time.time() - t0:.0f} s, {len(frames)} frames")
    return frames, log


# ---- stills and clip -------------------------------------------------------------

def lively(path):
    """False for black or flat frames (fades, loading screens)."""
    with Image.open(path) as im:
        small = im.convert("L").resize((64, 36))
    st = ImageStat.Stat(small)
    return st.mean[0] > 6 and st.stddev[0] > 6


def pick_stills(frames, n, skip_frames):
    pool = frames[skip_frames:] or frames
    if n <= 0 or not pool:
        return []
    seg = len(pool) / n
    chosen = []
    for k in range(n):
        lo, hi = int(k * seg), max(int((k + 1) * seg), int(k * seg) + 1)
        mid = (lo + hi) // 2
        order = sorted(range(lo, min(hi, len(pool))), key=lambda i: abs(i - mid))
        pick = next((i for i in order if lively(pool[i])), mid)
        chosen.append(pool[min(pick, len(pool) - 1)])
    return chosen


def save_still(src, dst, width, as_png):
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        if as_png:
            im.save(dst.with_suffix(".png"), optimize=True)
        else:
            im.save(dst.with_suffix(".jpg"), quality=85, optimize=True)


def encode_clip(frames_dir, first, count, fps, out, max_mb, height, flags):
    vf = f"scale=-2:'min({height},ih)':flags={flags},format=yuv420p"
    crf = 23
    for attempt in range(6):
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-start_number", str(first),
               "-i", str(frames_dir / "f%08d.png"), "-frames:v", str(count), "-vf", vf,
               "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-an", "-movflags", "+faststart", str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print("ffmpeg failed:", r.stderr)
            return None
        size = out.stat().st_size / 1e6
        print(f"clip crf {crf}: {size:.1f} MB")
        if size <= max_mb:
            return out
        crf += 3
    return out


def main():
    argv, game_args = split_argv(sys.argv[1:])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", help="folder with project.godot (never modified; a copy is used)")
    ap.add_argument("--name", required=True, help="short name: copy goes to %%TEMP%%/gamecap/<name>, output to renders/games/<name>")
    ap.add_argument("--tag", default="", help="prefix for output files, e.g. 'court' (default: scene name or 'run')")
    ap.add_argument("--scene", default="", help="scene to run, e.g. res://level6_test.tscn (default: main scene)")
    ap.add_argument("--frames", type=int, default=450, help="frames to record (default 450 = 15 s at 30 fps)")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--resolution", default="1280x720", help="window size, e.g. 1920x1080")
    ap.add_argument("--stills", type=int, default=6, help="number of evenly spaced stills (0 = none)")
    ap.add_argument("--still-width", type=int, default=1800)
    ap.add_argument("--png", action="store_true", help="stills as PNG (pixel art, flat colour)")
    ap.add_argument("--skip-seconds", type=float, default=1.0, help="ignore the start when picking stills")
    ap.add_argument("--clip-seconds", type=float, default=0, help="encode a clip of this length (0 = none)")
    ap.add_argument("--clip-start", type=float, default=0, help="where the clip starts, in seconds")
    ap.add_argument("--clip-height", type=int, default=720)
    ap.add_argument("--pixel", action="store_true", help="scale the clip with nearest-neighbour (low-res pixel art)")
    ap.add_argument("--max-mb", type=float, default=8.0)
    ap.add_argument("--out", default="", help="output folder (default renders/games/<name>)")
    ap.add_argument("--godot", default=DEFAULT_GODOT)
    ap.add_argument("--rendering-method", default="", help="forward_plus | mobile | gl_compatibility (default: what the project says)")
    ap.add_argument("--timeout", type=int, default=540, help="kill godot (the whole process tree) after this many seconds")
    ap.add_argument("--keep-frames", action="store_true")
    ap.add_argument("--reimport", action="store_true", help="run godot --import on the copy first")
    ap.add_argument("--exclude", action="append", default=[], help="extra folder name to leave out of the copy")
    ap.add_argument("--no-default-exclude", action="store_true")
    ap.add_argument("--drift", type=float, default=0.0)
    ap.add_argument("--drift-mode", choices=["camera", "mouse"], default="camera")
    ap.add_argument("--mouse-capture", action="store_true")
    ap.add_argument("--hold", action="append", default=[])
    ap.add_argument("--tap", action="append", default=[])
    ap.add_argument("--autoload", action="append", default=[], help="a .gd file copied into the copy and registered as an autoload")
    args = ap.parse_args(argv)
    args.game_args = game_args

    src = Path(args.project)
    if not (src / "project.godot").exists():
        die(f"{src} has no project.godot")
    exe = args.godot
    if not Path(exe).exists():
        die(f"godot not found at {exe}")

    name = re.sub(r"[^a-z0-9_-]", "-", args.name.lower())
    tag = args.tag or (Path(args.scene).stem if args.scene else "run")
    out_dir = Path(args.out) if args.out else ROOT / "renders" / "games" / name
    out_dir.mkdir(parents=True, exist_ok=True)

    before = (src / "project.godot").stat().st_mtime_ns
    copy = safe_copy_dir(name)
    print(f"copying {src} -> {copy}")
    copy_project(src, copy, args.exclude, args.no_default_exclude)

    cfg = {}
    if args.drift:
        cfg["drift"] = args.drift
        cfg["drift_mode"] = args.drift_mode
    if args.mouse_capture:
        cfg["mouse_capture"] = True
    if args.hold:
        cfg["hold"] = [dict(zip(("name", "from", "to"), parse_span(h))) for h in args.hold]
    if args.tap:
        cfg["tap"] = [{"name": n, "at": t} for spec in args.tap for n, t in parse_taps(spec)]

    extra = []
    for a in args.autoload:
        p = Path(a)
        if not p.exists():
            die(f"autoload script {a} not found")
        shutil.copy2(p, copy / p.name)
        extra.append((p.stem, p.name))

    # start from a clean project.godot each time (robocopy refreshes it if the original changed;
    # if not, strip our earlier edits by recopying)
    shutil.copy2(src / "project.godot", copy / "project.godot")
    edit_project(copy, name, cfg if cfg else None, extra)
    if cfg:
        (copy / HELPER_NAME).with_suffix(".gd").write_text(HELPER_GD, encoding="utf-8")
        (copy / "_capture_cfg.json").write_text(json.dumps(cfg), encoding="utf-8")
    else:
        for f in ((copy / HELPER_NAME).with_suffix(".gd"), copy / "_capture_cfg.json"):
            f.unlink(missing_ok=True)

    have = godot_version(exe)
    want = project_feature_version(copy)
    if args.reimport or not (copy / ".godot" / "imported").exists() or (have and want and have != want):
        FRAMES.mkdir(parents=True, exist_ok=True)
        import_project(exe, copy, FRAMES / f"{name}-import.log")

    frames_dir = FRAMES / f"{name}-{tag}"
    frames, log = run_movie(exe, copy, frames_dir, args)
    if not frames:
        print("no frames written. tail of the godot log:")
        print("\n".join(log.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]))
        sys.exit(2)

    skip = int(args.skip_seconds * args.fps)
    stills = pick_stills(frames, args.stills, skip)
    for i, f in enumerate(stills, 1):
        save_still(f, out_dir / f"{tag}-{i:02d}", args.still_width, args.png)
    if stills:
        print(f"{len(stills)} stills -> {out_dir}")

    if args.clip_seconds > 0:
        first = int(args.clip_start * args.fps)
        count = min(int(args.clip_seconds * args.fps), len(frames) - first)
        if count > 0:
            encode_clip(frames_dir, first, count, args.fps, out_dir / f"{tag}.mp4",
                        args.max_mb, args.clip_height, "neighbor" if args.pixel else "lanczos")
            print("clip ->", out_dir / f"{tag}.mp4")
        else:
            print("clip start is past the last frame")

    log_copy = out_dir / f"{tag}.godot.log"
    shutil.copy2(log, log_copy)
    if not args.keep_frames and CAPROOT.resolve() in frames_dir.resolve().parents:
        shutil.rmtree(frames_dir, ignore_errors=True)

    after = (src / "project.godot").stat().st_mtime_ns
    if before != after:
        print("WARNING: the original project.godot changed while this ran")
    else:
        print("original project.godot untouched")


if __name__ == "__main__":
    main()
