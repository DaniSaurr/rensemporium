"""Pass 3 batch driver for mesh exports (OBJ/FBX). Copies each file (and sidecar mtl/textures) to a temp folder, then
runs Blender once per job through mesh_wrapper.py. Same lock as render_batch.py; one Blender at a time.

python tools/render_meshes.py [--jobs tools/jobs_pass3.py] [--only slug/part,...] [--skip-done] [--list]
jobs_pass3.py defines MESH_JOBS = [(slug, part, spec_dict, [render_piece args])]; spec items have "path" and optional "sidecar" list.
"""
import os, sys, json, shutil, subprocess, time, importlib.util
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_batch as rb

ROOT = rb.ROOT


def run_job(slug, part, spec, extra):
    out = os.path.join(ROOT, "renders", slug, *([part] if part else []))
    wd = os.path.join(rb.WORK, "mesh-" + slug, part or "")
    rb.rm(wd)
    os.makedirs(wd, exist_ok=True)
    items = []
    for n, it in enumerate(spec["items"]):
        src = it["path"]
        if not os.path.exists(src):
            rb.log("SKIP %s/%s missing %s" % (slug, part, src))
            return
        d = os.path.join(wd, "i%d" % n)
        os.makedirs(d)
        dst = os.path.join(d, os.path.basename(src))
        shutil.copy2(src, dst)
        for sc in it.get("sidecar", []):
            if os.path.exists(sc):
                shutil.copy2(sc, os.path.join(d, os.path.basename(sc)))
        items.append(dict(it, path=dst))
    sp = os.path.join(wd, "spec.json")
    json.dump(dict(spec, items=items), open(sp, "w"))
    os.makedirs(out, exist_ok=True)
    cmd = [rb.BLENDER, "-b", "--factory-startup", "-noaudio", "--python", os.path.join(ROOT, "tools", "mesh_wrapper.py"),
           "--", "--spec", sp, "--out", out, "--frames-dir", os.path.join(wd, "frames")] + list(extra)
    rb.acquire_lock()
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, encoding="utf-8", errors="replace")
        dt = time.time() - t
        summ, info = None, ""
        for line in p.stdout.splitlines():
            if line.startswith('{"file"'):
                summ = line
            if line.startswith("MESHINFO"):
                info = line[9:]
        err = [l for l in (p.stderr + p.stdout).splitlines() if "Error" in l or "Traceback" in l][-4:]
        if summ:
            j = json.loads(summ)
            rb.log("OK   %s/%s %.0fs outputs=%d %s %s %s" % (slug, part, dt, len(j.get("outputs", [])), j.get("notes") or "", j.get("error") or "", info[:200]))
            open(os.path.join(out, "summary.json"), "w").write(summ)
        else:
            rb.log("FAIL %s/%s %.0fs rc=%s %s" % (slug, part, dt, p.returncode, err))
    except subprocess.TimeoutExpired:
        rb.log("TIMEOUT %s/%s" % (slug, part))
    finally:
        rb.release_lock()
    rb.rm(wd)


if __name__ == "__main__":
    jf = rb.arg("--jobs", os.path.join(ROOT, "tools", "jobs_pass3.py"))
    spec = importlib.util.spec_from_file_location("jobs3", jf)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    only = rb.arg("--only")
    only = only.split(",") if only else None
    todo = []
    for slug, part, sp, extra in m.MESH_JOBS:
        key = slug + ("/" + part if part else "")
        if only and slug not in only and key not in only:
            continue
        if "--skip-done" in sys.argv and rb.done(os.path.join(ROOT, "renders", slug, *([part] if part else []))):
            continue
        todo.append((slug, part, sp, extra))
    if "--list" in sys.argv:
        for t in todo:
            print(t[0], t[1])
        sys.exit(0)
    rb.log("--- mesh batch start (%d jobs)" % len(todo))
    for t in todo:
        run_job(*t)
    rb.log("--- mesh batch end")
