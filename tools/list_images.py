"""List a .blend's image paths and whether each exists. Run on TEMP COPIES only, via list_images_run.py.
blender -b copy.blend --python tools/list_images.py -- ORIGINAL_DIR"""
import sys, os, bpy

orig = sys.argv[sys.argv.index("--") + 1]
for im in bpy.data.images:
    if im.source not in {"FILE", "SEQUENCE"} or im.packed_file:
        continue
    fp = im.filepath
    absp = fp
    if fp.startswith("//"):
        absp = os.path.normpath(os.path.join(orig, fp[2:].replace("\\", os.sep)))
    print("IMG", im.name, "|", fp, "|", "OK" if os.path.exists(absp) else "MISSING")
