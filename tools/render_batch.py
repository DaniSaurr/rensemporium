"""Batch driver: copies each .blend to a temp work folder, runs render_piece.py headless, logs results.
Usage:
  python tools/render_batch.py [--set pass1|pass2] [--only slug[,slug|slug/part]] [--args "..."] [--skip-done]
  python tools/render_batch.py --file PATH --slug SLUG [--part PART] [--args "..."]    (ad hoc, one file)
  python tools/render_batch.py --jobs-file jobs.json [--only ...]    (json list of [slug, part|null, path, [args]])
Per-job extra args live in JOBS_PASS1 and in jobs_pass2.py. Never touches the originals."""
import os, sys, json, shutil, subprocess, time, stat, tempfile, shlex, threading

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = r"C:\Users\AEROCOOL\Documents"
B = DOCS + r"\Blender"
OCT = B + r"\October 2020"
APR = B + r"\APRIL2024"
WORK = os.path.join(tempfile.gettempdir(), "renderwork")
LOG = os.path.join(ROOT, "renders", "batch-log.txt")
TIMEOUT = 900
TURN_TIMEOUT = 3 * 3600

# (slug, part-or-None, path, extra args)
JOBS_PASS1 = [
    ("jester-clown", None, B + r"\May 2022 2\clown low poly colored 8.blend", ["--turntable", "72"]),
    ("church-diorama", None, B + r"\church46Cheat.blend", []),
    ("nephilim", None, B + r"\nephilimMK7.blend", ["--turntable", "72"]),
    ("biomech-heads", "sohead3", B + r"\dec 2023\sohead3.blend", ["--relight"]),
    ("biomech-heads", "sohead4", B + r"\dec 2023\sohead4.blend", ["--relight"]),
    ("biomech-heads", "sohead5", B + r"\dec 2023\sohead5.blend", ["--relight"]),
    ("radial-sculpture", None, B + r"\jun 2026\sculpture\radial8.blend", []),
    ("sculpts-2019", "dinosaur", B + r"\Misc\DinosaurSculpt.blend", ["--mode", "clay", "--simplify", "1", "--relight"]),
    ("sculpts-2019", "rabbit", B + r"\Misc\RabbitSculpt.blend", ["--mode", "clay", "--simplify", "1", "--relight"]),
    ("kalabu", None, B + r"\jULY 2021\Kaluba\Kalabu2eyes.blend", []),
    ("irish-myth", "level11", B + r"\September 2026\UV Unwrapped and Textured level11.blend", ["--relight"]),
    ("irish-myth", "setanta", B + r"\September 2026\setanta_final.blend", ["--turntable", "72"]),
    ("spooktober-2020", "heavenhound-swords", OCT + r"\heavenHoundSwords.blend", []),
    ("spooktober-2020", "hellhound", OCT + r"\Hellhound7.blend", []),
    ("spooktober-2020", "necromancer6", OCT + r"\necromancer6.blend", []),
    ("spooktober-2020", "musical6", OCT + r"\musical6.blend", []),
    ("spooktober-2020", "werewolf2", OCT + r"\werewolf2.blend", []),
    ("spooktober-2020", "mistofolees", OCT + r"\mrmistoffolees.blend", []),
    # diver (added later; queued after the rest)
    ("diver", "mariner6-suit", APR + r"\MARINER6.blend", ["--mode", "mat", "--relight", "--views", "a:0:8,b:180:8,c:35:12,d:215:12,e:145:12,f:325:12", "--turntable", "72"]),
    ("diver", "mariner5-helmet", APR + r"\MARINER5.blend", ["--mode", "mat", "--relight", "--no-file-cam", "--views", "a:0:6,b:180:6,c:35:10,d:215:10"]),
    ("diver", "mariner6-short-camera", APR + r"\MARINER6-short render.blend", ["--file-cam-only", "--mode", "mat"]),
]


def rm(d):
    def h(f, p, e):
        try:
            os.chmod(p, stat.S_IWRITE); f(p)
        except Exception:
            pass
    shutil.rmtree(d, onerror=h) if os.path.exists(d) else None


def log(msg):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%H:%M:%S ") + msg + "\n")
    print(msg, flush=True)


def done(out):
    """A job counts as done when its folder already holds a render."""
    if not os.path.isdir(out):
        return False
    return any(f.lower().endswith((".png", ".mp4")) for f in os.listdir(out))


LOCK = os.path.join(ROOT, "renders", "_blender.lock")


def acquire_lock():
    """One Blender render at a time across every batch started from this folder (the GPU is shared with Dani)."""
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    while True:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode()); os.close(fd)
            return
        except FileExistsError:
            try:  # stale lock: the owner is gone or it is over three hours old
                if time.time() - os.path.getmtime(LOCK) > 3 * 3600 + 600:
                    os.remove(LOCK)
            except OSError:
                pass
            time.sleep(5)


def release_lock():
    try:
        os.remove(LOCK)
    except OSError:
        pass


def run(slug, part, path, extra, extra_override=None):
    acquire_lock()
    try:
        _run(slug, part, path, extra, extra_override)
    finally:
        release_lock()


def _run(slug, part, path, extra, extra_override=None):
    out = os.path.join(ROOT, "renders", slug, *( [part] if part else [] ))
    if not os.path.exists(path):
        log("SKIP %s/%s missing file %s" % (slug, part, path)); return
    wd = os.path.join(WORK, slug, part or "")
    rm(wd); os.makedirs(wd, exist_ok=True)
    tmp = os.path.join(wd, os.path.basename(path))
    shutil.copy2(path, tmp)
    os.chmod(tmp, stat.S_IREAD)
    os.makedirs(out, exist_ok=True)
    cmd = [BLENDER, "-b", "--factory-startup", "-noaudio", tmp, "--python", os.path.join(ROOT, "tools", "render_piece.py"),
           "--", "--out", out, "--src-dir", os.path.dirname(path), "--frames-dir", os.path.join(wd, "frames")] + (extra_override if extra_override is not None else extra)
    t = time.time()
    tmo = TURN_TIMEOUT if "--turntable" in cmd else TIMEOUT
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=tmo, encoding="utf-8", errors="replace")
        dt = time.time() - t
        summ = None
        for line in p.stdout.splitlines():
            if line.startswith('{"file"'):
                summ = line
        err = [l for l in (p.stderr + p.stdout).splitlines() if "Error" in l or "Traceback" in l][-3:]
        if summ:
            j = json.loads(summ)
            log("OK   %s/%s  %.0fs  outputs=%d framed=%s rig=%s %s %s" % (slug, part, dt, len(j.get("outputs", [])), j.get("objects_framed"), j.get("rig"), j.get("notes") or "", j.get("error") or ""))
            with open(os.path.join(out, "summary.json"), "w") as f: f.write(summ)
        else:
            log("FAIL %s/%s  %.0fs rc=%s %s" % (slug, part, dt, p.returncode, err))
    except subprocess.TimeoutExpired:
        log("TIMEOUT %s/%s after %ds" % (slug, part, tmo))
    rm(wd)


def load_jobs(name):
    if name == "pass1":
        return JOBS_PASS1
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import jobs_pass2
    return jobs_pass2.JOBS


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


if __name__ == "__main__":
    only = arg("--only")
    only = only.split(",") if only else None  # slug or slug/part
    override = shlex.split(arg("--args")) if "--args" in sys.argv else None
    conc = 1  # strictly one Blender at a time; --jobs is ignored on purpose
    skip_done = "--skip-done" in sys.argv
    if "--file" in sys.argv:
        jobs = [(arg("--slug"), arg("--part"), arg("--file"), [])]
    elif "--jobs-file" in sys.argv:
        jobs = [tuple(j) for j in json.load(open(arg("--jobs-file"), encoding="utf-8"))]
    else:
        jobs = load_jobs(arg("--set", "pass2"))
    todo = []
    for slug, part, path, extra in jobs:
        key = slug + ("/" + part if part else "")
        if only and slug not in only and key not in only:
            continue
        if skip_done and done(os.path.join(ROOT, "renders", slug, *([part] if part else []))):
            continue
        todo.append((slug, part, path, extra))
    if "--list" in sys.argv:
        for t in todo:
            print(t)
        sys.exit(0)
    log("--- batch start %s (%d jobs, concurrency %d)" % (time.ctime(), len(todo), conc))
    lock = threading.Lock()
    queue = list(todo)

    def worker():
        while True:
            with lock:
                if not queue:
                    return
                j = queue.pop(0)
            run(j[0], j[1], j[2], j[3], override)
    ths = [threading.Thread(target=worker) for _ in range(max(1, conc))]
    for t in ths:
        t.start()
    for t in ths:
        t.join()
    log("--- batch end %s" % time.ctime())
