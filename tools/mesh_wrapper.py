"""Blender-side wrapper for pass 3: import OBJ/FBX meshes into an empty scene, lay them out, then run render_piece.py.

blender -b --factory-startup --python tools/mesh_wrapper.py -- --spec SPEC.json <render_piece args>

SPEC.json: {"items": [{"path": ..., "rot": [x,y,z degrees], "size": 2.0, "vcol": bool, "smooth": bool, "decimate": 0.3,
            "name": "label"}], "gap": 0.25}
Each item is scaled so its largest dimension equals "size" (default 2) and items sit side by side along X.
Never saves anything; the meshes are temp copies made by render_meshes.py.
"""
import sys, os, json, math
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
i = argv.index("--spec")
spec = json.load(open(argv[i + 1], encoding="utf-8"))
rest = argv[:i] + argv[i + 2:]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def bbox_world(objs):
    lo = Vector((1e18,) * 3)
    hi = Vector((-1e18,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def vcol_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    cn = nt.nodes.new("ShaderNodeAttribute")
    cn.attribute_type = "GEOMETRY"
    nt.links.new(cn.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.6
    return m, cn


def patch_fbx_lights():
    """Blender 5.1's FBX importer crashes on lights (lamp.cycles.cast_shadow is gone); make lights plain."""
    try:
        import io_scene_fbx.import_fbx as m
        m.blen_read_light = lambda tmpl, obj, settings: bpy.data.lights.new("fbxlight", "POINT")
        print("patched fbx light import", flush=True)
    except Exception as e:
        print("could not patch fbx light import:", e, flush=True)


patch_fbx_lights()
x_cursor = 0.0
gap = spec.get("gap", 0.3)
info = []
for it in spec["items"]:
    before = set(bpy.data.objects.keys())
    p = it["path"]
    ext = os.path.splitext(p)[1].lower()
    if ext == ".obj":
        bpy.ops.wm.obj_import(filepath=p)
    elif ext == ".fbx":
        try:
            bpy.ops.import_scene.fbx(filepath=p)
        except Exception as e:  # the importer trips over some FBX light settings; keep whatever came in
            print("FBX import warning:", str(e)[-200:], flush=True)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=p)
    else:
        raise RuntimeError("unsupported " + p)
    new = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in list(new):
        if o.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(o)
    new = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]
    if not meshes:
        raise RuntimeError("no meshes in " + p)
    root = bpy.data.objects.new("ITEM_" + it.get("name", os.path.basename(p)), None)
    scene.collection.objects.link(root)
    for o in new:
        if o.name in bpy.data.objects and o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    for o in meshes:
        if it.get("decimate"):
            mod = o.modifiers.new("dec", "DECIMATE")
            mod.ratio = it["decimate"]
        if it.get("smooth"):
            try:
                o.data.shade_smooth()
            except Exception:
                pass
        if it.get("vcol"):
            attrs = [a.name for a in o.data.color_attributes]
            if attrs:
                m, cn = vcol_material("VCOL_" + o.name)
                cn.attribute_name = attrs[0]
                o.data.materials.clear()
                o.data.materials.append(m)
    if it.get("rot"):
        root.rotation_euler = [math.radians(a) for a in it["rot"]]
    bpy.context.view_layer.update()
    lo, hi = bbox_world(meshes)
    dims = hi - lo
    s = it.get("size", 2.0) / max(dims)
    root.scale = (s, s, s)
    bpy.context.view_layer.update()
    lo, hi = bbox_world(meshes)
    cx = (lo.x + hi.x) / 2
    cy = (lo.y + hi.y) / 2
    w = hi.x - lo.x
    root.location += Vector((x_cursor + w / 2 - cx, -cy, -lo.z))
    x_cursor += w + gap
    bpy.context.view_layer.update()
    nv = sum(len(o.data.vertices) for o in meshes)
    info.append(dict(path=os.path.basename(p), meshes=len(meshes), verts=nv, dims=[round(d, 3) for d in dims]))
print("MESHINFO " + json.dumps(info), flush=True)

sys.argv = [sys.argv[0], "--"] + rest
here = os.path.dirname(os.path.abspath(__file__))
rp = os.path.join(here, "render_piece.py")
src = open(rp, encoding="utf-8").read()
exec(compile(src, rp, "exec"), {"__name__": "__main__", "__file__": rp})
