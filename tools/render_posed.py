"""Driver for pose_wrapper.py: copy a .blend to temp, run Blender once per job under the shared lock.

python tools/render_posed.py --jobs-file jobs.json [--only slug/part,...]
jobs.json: [[slug, part, blend path, action, [render_piece args]], ...]. Output: renders/<slug>/<part>/.
"""
import os, sys, json, shutil, subprocess, time, stat
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_batch as rb

ROOT = rb.ROOT


def run_job(slug, part, path, action, extra):
    out = os.path.join(ROOT, "renders", slug, *([part] if part else []))
    wd = os.path.join(rb.WORK, "posed-" + slug, part or "")
    rb.rm(wd)
    os.makedirs(wd, exist_ok=True)
    tmp = os.path.join(wd, os.path.basename(path))
    shutil.copy2(path, tmp)
    os.chmod(tmp, stat.S_IREAD)
    os.makedirs(out, exist_ok=True)
    cmd = [rb.BLENDER, "-b", "--factory-startup", "-noaudio", tmp, "--python", os.path.join(ROOT, "tools", "pose_wrapper.py"),
           "--", "--action", action, "--out", out, "--src-dir", os.path.dirname(path), "--frames-dir", os.path.join(wd, "frames")] + list(extra)
    rb.acquire_lock()
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=3 * 3600 if "--turntable" in cmd else 900, encoding="utf-8", errors="replace")
        summ = None
        for line in p.stdout.splitlines():
            if line.startswith('{"file"'):
                summ = line
        err = [l for l in (p.stderr + p.stdout).splitlines() if "Error" in l or "Traceback" in l][-4:]
        if summ:
            j = json.loads(summ)
            rb.log("OK   %s/%s [%s] %.0fs outputs=%d %s %s" % (slug, part, action, time.time() - t, len(j.get("outputs", [])), j.get("notes") or "", j.get("error") or ""))
            open(os.path.join(out, "summary.json"), "w").write(summ)
        else:
            rb.log("FAIL %s/%s %.0fs rc=%s %s" % (slug, part, time.time() - t, p.returncode, err))
    except subprocess.TimeoutExpired:
        rb.log("TIMEOUT %s/%s" % (slug, part))
    finally:
        rb.release_lock()
    rb.rm(wd)


if __name__ == "__main__":
    only = rb.arg("--only")
    only = only.split(",") if only else None
    jobs = [tuple(j) for j in json.load(open(rb.arg("--jobs-file"), encoding="utf-8"))]
    rb.log("--- posed batch start (%d jobs)" % len(jobs))
    for slug, part, path, action, extra in jobs:
        key = slug + ("/" + part if part else "")
        if only and slug not in only and key not in only:
            continue
        run_job(slug, part, path, action, extra)
    rb.log("--- posed batch end")
