"""Read-only inspector: blender -b <copy.blend> --python tools/inspect_blend.py -- [--objects]
Prints one JSON line (starts with {"inspect") describing images, cameras, lights, collections, world,
and why objects are or are not renderable. Never saves."""
import sys, os, json
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
scene = bpy.context.scene
vl = bpy.context.view_layer


def coll_state(lc, out, depth=0):
    out.append(dict(name=lc.name, exclude=lc.exclude, hide_viewport=lc.hide_viewport,
                    hide_render=lc.collection.hide_render, coll_hide_viewport=lc.collection.hide_viewport,
                    n=len(lc.collection.objects), depth=depth))
    for c in lc.children:
        coll_state(c, out, depth + 1)


cs = []
coll_state(vl.layer_collection, cs)
imgs = []
for im in bpy.data.images:
    imgs.append(dict(name=im.name, packed=bool(im.packed_file), src=im.source, path=im.filepath[:90], size=list(im.size)))
types = {}
for o in scene.objects:
    types[o.type] = types.get(o.type, 0) + 1
reasons = {}
for o in scene.objects:
    if o.type not in {"MESH", "CURVE", "SURFACE", "FONT", "META", "CURVES"}:
        if o.type == "EMPTY" and o.instance_type == "COLLECTION":
            reasons["empty_instance"] = reasons.get("empty_instance", 0) + 1
        continue
    r = []
    if o.hide_render: r.append("hide_render")
    if o.hide_viewport: r.append("hide_viewport")
    try:
        if not o.visible_get(): r.append("not_visible_get")
    except Exception:
        pass
    if o.display_type in {"WIRE", "BOUNDS"}: r.append("display_" + o.display_type)
    k = ",".join(r) or "ok"
    reasons[k] = reasons.get(k, 0) + 1
cams = [dict(name=o.name, lens=o.data.lens, type=o.data.type, hide_render=o.hide_render, loc=[round(v, 2) for v in o.location]) for o in scene.objects if o.type == "CAMERA"]
lights = [dict(name=o.name, type=o.data.type, energy=round(o.data.energy, 1), hide_render=o.hide_render) for o in scene.objects if o.type == "LIGHT"]
w = scene.world
world = None
if w:
    world = dict(name=w.name, nodes=[n.type for n in w.node_tree.nodes] if w.use_nodes and w.node_tree else None, color=list(w.color))
res = dict(inspect=os.path.basename(bpy.data.filepath), version=list(bpy.data.version), engine=scene.render.engine,
           res=[scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage],
           frame=[scene.frame_start, scene.frame_end], types=types, reasons=reasons, cameras=cams, lights=lights, world=world,
           active_cam=scene.camera.name if scene.camera else None, images=imgs, collections=cs[:60],
           materials=len(bpy.data.materials), view_transform=scene.view_settings.view_transform)
if "--objects" in argv:
    res["objects"] = [dict(n=o.name, t=o.type, hr=o.hide_render, hv=o.hide_viewport, vg=o.visible_get(), col=[c.name for c in o.users_collection][:2],
                           dims=[round(v, 2) for v in o.dimensions], loc=[round(v, 2) for v in o.matrix_world.translation])
                      for o in scene.objects][:int(argv[argv.index("--objects") + 1]) if len(argv) > argv.index("--objects") + 1 else 400]
print(json.dumps(res))
