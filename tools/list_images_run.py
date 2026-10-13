"""python tools/list_images_run.py FILE.blend ... : copy each to temp, list image paths in Blender (one process at a time, shared lock)."""
import os, sys, shutil, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_batch as rb

for f in sys.argv[1:]:
    wd = os.path.join(rb.WORK, "listimg")
    rb.rm(wd)
    os.makedirs(wd)
    tmp = os.path.join(wd, os.path.basename(f))
    shutil.copy2(f, tmp)
    rb.acquire_lock()
    try:
        p = subprocess.run([rb.BLENDER, "-b", "--factory-startup", "-noaudio", tmp, "--python",
                            os.path.join(rb.ROOT, "tools", "list_images.py"), "--", os.path.dirname(f)],
                           capture_output=True, text=True, timeout=300, encoding="utf-8", errors="replace")
    finally:
        rb.release_lock()
    print("==", f)
    for l in p.stdout.splitlines():
        if l.startswith("IMG"):
            print(l)
    rb.rm(wd)
