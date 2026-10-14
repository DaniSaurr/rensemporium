"""Headless EEVEE still/turntable renderer for Dani's Blender files.

Run:  blender -b <file> --python tools/render_piece.py -- --out renders/<slug> [options]

Never saves the .blend. Prints one JSON summary line (starts with {"file").
Options:
  --out DIR              output dir (required)
  --mode auto|mat|clay|copper|both   default auto: both for files from Blender < 2.90, else mat
                         (copper = metallic copper override on every object)
  --include-ground       count huge flat ground planes when framing
  --relight              force the 3-point area rig + lavender world, mute the file's lights
  --dusk                 lighting preset: low warm key, cool fill and rim, dark blue-grey world.
                         Mutes the file's lights (emissive materials still glow).
  --exposure F           scene exposure offset (handy with --dusk)
  --all-cameras          render through every camera object in the file (plus the auto orbit views)
  --no-all-cameras       only the active camera. Default (auto): all cameras when the file is
                         scene-like (more than 15 framed objects), the active one otherwise
  --max-cameras N        cap on file cameras rendered (default 12)
  --frame a,b            frame only objects/collections whose name contains one of the substrings
                         (case-insensitive). Collections bring their children.
  --hide a,b             hide_render for objects/collections matching (never saved)
  --views SPEC           orbit views as name:az:el[:lens],... ("scene" or "character" for presets).
                         Default: scene preset for scene-like files, else character preset
  --margin F             framing margin (default 0.08; use 0.15 for looser shots)
  --lens N               default lens for the auto views (default 60 characters, 38 scenes)
  --turntable N          also render an N-frame 360 turn -> turntable.mp4
  --turntable-mode mat|clay   default: clay if mode==clay else mat
  --turntable-el DEG     orbit camera elevation (default 12)
  --turntable-lens MM    orbit camera lens (default 60 characters, 40 scenes)
  --turntable-res W H    frame size (default 960 720)
  --turntable-samples N  samples for orbit frames (default: --samples)
  --no-file-cam          do not render the file's own camera as an extra still
  --file-cam-only        render only the file's own camera, with the file's own lights/world (no rig)
  --no-stills            skip stills (turntable only)
  --samples N            EEVEE render samples (default 48)
  --res W H              still resolution (default 1600 1200)
  --simplify N           enable simplify, subdivision render level N (heavy sculpts)
  --src-dir DIR          original folder, used to re-point relative texture paths
  --frames-dir DIR       where turntable PNG frames go (default: <out>/_frames, deleted after encode)
  --save-cams FILE       write the auto cameras + framing centre/radius to FILE (json)
  --fixed-cam FILE:NAME  render only camera NAME from a --save-cams json, lit by a rig placed from the
                         same centre/radius. Use it to render a build progression from one viewpoint.
"""
import sys, os, json, math, time, shutil, subprocess, re
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

T0 = time.time()

PRESET_CHARACTER = [("left34", -38, 14, None), ("right34", 38, 14, None), ("low", 6, -6, -10)]
PRESET_SCENE = [("front", 0, 16, None), ("left34", -42, 20, None), ("right34", 42, 20, None),
                ("back34", 138, 20, None), ("high", -28, 42, None), ("low", 12, 5, None)]


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = dict(out=None, mode="auto", ground=False, relight=False, dusk=False, exposure=None, allcams=None, maxcams=12,
             frame=[], hide=[], views=None, lens=None, margin=0.08,
             turntable=0, tmode=None, tel=12, tlens=None, tres=(960, 720), tsamples=None,
             stills=True, nofilecam=False, filecamonly=False, samples=48, res=(1600, 1200), simplify=None,
             src=None, frames=None, savecams=None, fixed=None)
    i = 0
    while i < len(argv):
        k = argv[i]
        if k == "--out": a["out"] = argv[i + 1]; i += 1
        elif k == "--mode": a["mode"] = argv[i + 1]; i += 1
        elif k == "--include-ground": a["ground"] = True
        elif k == "--relight": a["relight"] = True
        elif k == "--dusk": a["dusk"] = True
        elif k == "--exposure": a["exposure"] = float(argv[i + 1]); i += 1
        elif k == "--all-cameras": a["allcams"] = True
        elif k == "--no-all-cameras": a["allcams"] = False
        elif k == "--max-cameras": a["maxcams"] = int(argv[i + 1]); i += 1
        elif k == "--frame": a["frame"] = [s.strip().lower() for s in argv[i + 1].split(",") if s.strip()]; i += 1
        elif k == "--hide": a["hide"] = [s.strip().lower() for s in argv[i + 1].split(",") if s.strip()]; i += 1
        elif k == "--views": a["views"] = argv[i + 1]; i += 1
        elif k == "--lens": a["lens"] = float(argv[i + 1]); i += 1
        elif k == "--margin": a["margin"] = float(argv[i + 1]); i += 1
        elif k == "--turntable": a["turntable"] = int(argv[i + 1]); i += 1
        elif k == "--turntable-mode": a["tmode"] = argv[i + 1]; i += 1
        elif k == "--turntable-el": a["tel"] = float(argv[i + 1]); i += 1
        elif k == "--turntable-lens": a["tlens"] = float(argv[i + 1]); i += 1
        elif k == "--turntable-res": a["tres"] = (int(argv[i + 1]), int(argv[i + 2])); i += 2
        elif k == "--turntable-samples": a["tsamples"] = int(argv[i + 1]); i += 1
        elif k == "--no-file-cam": a["nofilecam"] = True
        elif k == "--file-cam-only": a["filecamonly"] = True
        elif k == "--no-stills": a["stills"] = False
        elif k == "--samples": a["samples"] = int(argv[i + 1]); i += 1
        elif k == "--res": a["res"] = (int(argv[i + 1]), int(argv[i + 2])); i += 2
        elif k == "--simplify": a["simplify"] = int(argv[i + 1]); i += 1
        elif k == "--src-dir": a["src"] = argv[i + 1]; i += 1
        elif k == "--frames-dir": a["frames"] = argv[i + 1]; i += 1
        elif k == "--save-cams": a["savecams"] = argv[i + 1]; i += 1
        elif k == "--fixed-cam": a["fixed"] = argv[i + 1]; i += 1
        i += 1
    if not a["out"]:
        raise SystemExit("--out required")
    return a


def log(*m):
    print("[render_piece]", *m, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- safety
def lock_down():
    try:
        p = bpy.context.preferences
        p.filepaths.use_auto_save_temporary_files = False
        p.use_preferences_save = False
    except Exception as e:
        log("prefs lock failed", e)

    # make every save a no-op for this session
    def _nosave(*a, **k):
        raise RuntimeError("saving disabled")
    try:
        bpy.ops.wm.save_mainfile = _nosave
        bpy.ops.wm.save_as_mainfile = _nosave
    except Exception:
        pass


def repoint_paths(src_dir):
    """The file is a temp copy; re-point relative image paths at the original folder."""
    if not src_dir:
        return 0
    n = 0
    for im in bpy.data.images:
        if im.packed_file or im.source not in {"FILE", "SEQUENCE", "MOVIE"}:
            continue
        fp = im.filepath
        if fp.startswith("//"):
            absp = os.path.normpath(os.path.join(src_dir, fp[2:].replace("\\", os.sep)))
            if os.path.exists(absp):
                try:
                    im.filepath = absp
                    n += 1
                except Exception:
                    pass
    return n


# ---------------------------------------------------------------- visibility / framing
RENDERABLE = {"MESH", "CURVE", "SURFACE", "FONT", "META", "CURVES"}


def will_render(o, vl):
    """True when the object goes into a render. Eye (hide_get) and monitor (hide_viewport) icons are
    viewport-only in Blender, so they do not count; the camera icon (hide_render) and excluded collections do."""
    if o.hide_render:
        return False
    try:
        if o.name not in vl.objects:  # collection excluded from the view layer
            return False
    except Exception:
        pass
    cols = o.users_collection
    if cols and all(c.hide_render for c in cols):
        return False
    return True


def unhide_for_render(scene):
    """Make everything that renders also visible to the depsgraph, so framing sees it. Session only."""
    vl = bpy.context.view_layer
    n = 0
    for o in scene.objects:
        if not will_render(o, vl):
            continue
        changed = False
        try:
            if o.hide_get():
                o.hide_set(False); changed = True
        except Exception:
            pass
        if o.hide_viewport:
            o.hide_viewport = False; changed = True
        n += changed
    vl.update()
    return n


def match_set(scene, subs):
    """Object names matching any substring by object name or by collection (children included)."""
    names = set()
    for s in subs:
        for o in scene.objects:
            if s in o.name.lower():
                names.add(o.name)
        for c in bpy.data.collections:
            if s in c.name.lower():
                for o in c.all_objects:
                    names.add(o.name)
    return names


def world_points_inst(inst, cap=300):
    """World-space points (N,3 array) for one depsgraph instance: real vertices when the mesh is a sane size
    (so a tall thin tree does not drag its empty bbox corners into the framing), else the 8 bbox corners."""
    ob = inst.object
    M = np.array(inst.matrix_world, dtype=np.float64)
    try:
        bb = np.array([list(c) for c in ob.bound_box], dtype=np.float64)
    except Exception:
        return None
    corners = bb @ M[:3, :3].T + M[:3, 3]
    if np.ptp(corners, axis=0).sum() < 1e-6:
        return None
    if ob.type not in {"MESH", "CURVE", "SURFACE", "FONT"}:
        return corners
    try:
        me = ob.to_mesh()
        n = len(me.vertices)
        if n == 0 or n > 400000:
            ob.to_mesh_clear()
            return corners
        co = np.empty(n * 3, dtype=np.float32)
        me.vertices.foreach_get("co", co)
        ob.to_mesh_clear()
        co = co.reshape(-1, 3).astype(np.float64)
        if n > cap:
            ext = np.unique(np.concatenate([co.argmin(0), co.argmax(0)]))
            co = np.concatenate([co[:: n // cap + 1], co[ext]])
        return co @ M[:3, :3].T + M[:3, 3]
    except Exception:
        return corners


def extent(pts):
    return pts.min(axis=0), pts.max(axis=0)


def gather(scene, only=None):
    """[(object, points)] for everything that renders, including collection instances and geometry-node
    instances. `only` is an optional set of original object names."""
    vl = bpy.context.view_layer
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for inst in dg.object_instances:
        ob = inst.object
        if ob.type not in RENDERABLE:
            continue
        orig = ob.original
        owner = inst.parent.original if (inst.is_instance and inst.parent is not None) else orig
        if orig.hide_render or owner.hide_render:
            continue
        if not will_render(owner, vl):
            continue
        if orig.display_type in {"WIRE", "BOUNDS"}:
            continue
        if only is not None and owner.name not in only and orig.name not in only:
            continue
        c = world_points_inst(inst)
        if c is not None:
            out.setdefault(owner.name, []).append(c)
    res = []
    for n, l in out.items():
        o = scene.objects.get(n) or bpy.data.objects.get(n)
        res.append((o, np.concatenate(l)))
    return res


def pick_framed(scene, include_ground, only=None):
    items = gather(scene, only)
    ground, hidden = [], []
    if not include_ground and only is None and len(items) > 1:
        keep = []
        for o, c in items:
            lo, hi = extent(c)
            dims = list(hi - lo)
            ti = dims.index(min(dims))
            big_d = max(dims)
            flat = dims[ti] < 0.03 * big_d
            big = False
            if flat:
                others = np.concatenate([c2 for o2, c2 in items if o2 is not o])
                olo, ohi = extent(others)
                oh = max(float((ohi - olo).max()), 1e-9)
                big = big_d > 2.5 * oh
            if big and ti != 2:
                o.hide_render = True  # vertical backdrop/wall: drop it from the render too
                hidden.append(o.name)
            (ground if big else keep).append((o, c))
        if keep:
            items = keep
        else:
            ground = []
    return items, [o.name for o, _ in ground] + [n + " (hidden)" for n in hidden]


# ---------------------------------------------------------------- cameras
def look_quat(from_pt, to_pt):
    d = (to_pt - from_pt).normalized()
    return d.to_track_quat("-Z", "Y")


def fit_distance(pts, center, direction, lens, aspect_hw, margin=0.08, sensor=36.0):
    """pts: (N,3) array. direction: unit vector from center toward camera. Returns distance."""
    f = np.array((-direction).normalized())
    up = np.array((0.0, 0.0, 1.0))
    if abs(f.dot(up)) > 0.98:
        up = np.array((0.0, 1.0, 0.0))
    right = np.cross(f, up)
    right /= np.linalg.norm(right)
    upc = np.cross(right, f)
    upc /= np.linalg.norm(upc)
    tx = (sensor / 2.0 / lens) * (1.0 - margin)
    ty = tx * aspect_hw
    P = pts - np.array(center)
    x, y, zf = P @ right, P @ upc, P @ f
    return float(max(0.01, (np.abs(x) / tx - zf).max(), (np.abs(y) / ty - zf).max()))


def spherical(az_deg, el_deg):
    az, el = math.radians(az_deg), math.radians(el_deg)
    # az 0 = in front of a -Y-facing character (camera on -Y), positive az toward +X
    return Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))


def make_camera(scene, name, lens, clip_end):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36.0
    cd.sensor_fit = "AUTO"
    cd.clip_start = 0.01
    cd.clip_end = clip_end
    co = bpy.data.objects.new(name, cd)
    scene.collection.objects.link(co)
    return co


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower() or "cam"


def parse_views(spec, default_lens):
    if spec in ("scene", "character"):
        base = PRESET_SCENE if spec == "scene" else PRESET_CHARACTER
        return [(n, az, el, default_lens + (dl or 0)) for n, az, el, dl in base]
    out = []
    for part in spec.split(","):
        f = part.split(":")
        out.append((f[0], float(f[1]), float(f[2]), float(f[3]) if len(f) > 3 else default_lens))
    return out


# ---------------------------------------------------------------- lights / world
def file_lights(scene):
    return [o for o in scene.objects if o.type == "LIGHT" and not o.hide_render]


def lavender_world(scene, strength=0.6):
    w = bpy.data.worlds.new("PIECE_Lavender")
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    if bg is None:
        bg = nt.nodes.new("ShaderNodeBackground")
        out = nt.nodes.get("World Output") or nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs[0].default_value = (0.815, 0.775, 0.888, 1.0)  # #e9e4f2 in linear
    bg.inputs[1].default_value = strength
    scene.world = w


def dusk_world(scene):
    """Dark blue-grey sky, a touch lighter and warmer at the horizon."""
    w = bpy.data.worlds.new("PIECE_Dusk")
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs[1].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs[0])
    try:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ab = nt.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        mr = nt.nodes.new("ShaderNodeMapRange")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ab.inputs[0])
        nt.links.new(ab.outputs[0], mr.inputs[0])
        mr.inputs[1].default_value = 0.0
        mr.inputs[2].default_value = 0.8
        mr.inputs[3].default_value = 0.0
        mr.inputs[4].default_value = 1.0
        mr.clamp = True
        nt.links.new(mr.outputs[0], ramp.inputs[0])
        el = ramp.color_ramp.elements
        el[0].position = 0.0
        el[0].color = (0.034, 0.036, 0.050, 1.0)   # horizon: faint cool grey
        el[1].position = 1.0
        el[1].color = (0.004, 0.007, 0.016, 1.0)   # zenith and nadir: dark blue-grey
        mid = ramp.color_ramp.elements.new(0.3)
        mid.color = (0.012, 0.016, 0.030, 1.0)
        nt.links.new(ramp.outputs[0], bg.inputs[0])
    except Exception as e:
        log("dusk gradient failed, flat colour:", e)
        bg.inputs[0].default_value = (0.014, 0.02, 0.038, 1.0)
    scene.world = w


def world_is_dark(scene):
    w = scene.world
    if w is None:
        return True
    if w.use_nodes and w.node_tree:
        for n in w.node_tree.nodes:
            if n.type == "TEX_ENVIRONMENT" or n.type == "TEX_SKY":
                return False
        bg = next((n for n in w.node_tree.nodes if n.type == "BACKGROUND"), None)
        if bg:
            c = bg.inputs[0].default_value
            s = bg.inputs[1].default_value
            return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * s < 0.05
    c = w.color
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) < 0.05


def add_rig(scene, center, radius, parent=None):
    D = max(radius * 2.6, 0.5)
    size = max(radius * 1.8, 0.3)
    specs = [  # name, az, el, energy factor, size factor, colour
        ("RIG_key", -50, 38, 38.0, 1.0, (1.0, 0.96, 0.9)),
        ("RIG_fill", 60, 12, 14.0, 1.6, (0.88, 0.9, 1.0)),
        ("RIG_rim", 200, 32, 26.0, 0.8, (1.0, 1.0, 1.0)),
    ]
    made = []
    for name, az, el, k, sf, col in specs:
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = k * D * D
        ld.size = size * sf
        ld.color = col
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        pos = center + spherical(az, el) * D
        lo.location = pos
        lo.rotation_euler = look_quat(pos, center).to_euler()
        if parent is not None:
            lo.parent = parent
            lo.matrix_parent_inverse = parent.matrix_world.inverted()
        made.append(lo)
    return made


def add_dusk_rig(scene, center, radius, parent=None):
    """Low warm key (sun, ~11 deg up), cool fill from the other side, faint cool rim."""
    D = max(radius * 2.0, 1.0)
    specs = [  # name, az, el, strength, colour, angle (rad)
        ("RIG_key", -50, 13, 3.6, (1.0, 0.58, 0.30), 0.09),
        ("RIG_fill", 135, 30, 0.85, (0.36, 0.50, 1.0), 0.5),
        ("RIG_rim", 205, 18, 1.4, (0.5, 0.62, 1.0), 0.15),
    ]
    made = []
    for name, az, el, k, col, ang in specs:
        ld = bpy.data.lights.new(name, "SUN")
        ld.energy = k
        ld.angle = ang
        ld.color = col
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        pos = center + spherical(az, el) * D
        lo.location = pos
        lo.rotation_euler = look_quat(pos, center).to_euler()
        if parent is not None:
            lo.parent = parent
            lo.matrix_parent_inverse = parent.matrix_world.inverted()
        made.append(lo)
    return made


def set_view_transform(scene, dusk=False):
    names = ["AgX", "Filmic", "Standard"] if dusk else ["Standard"]
    for n in names:
        try:
            scene.view_settings.view_transform = n
            break
        except Exception:
            continue
    try:
        scene.view_settings.look = "None"
    except Exception:
        pass


# ---------------------------------------------------------------- materials
def clay_material():
    m = bpy.data.materials.new("PIECE_Clay")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = (0.50, 0.44, 0.38, 1.0)
        b.inputs["Roughness"].default_value = 0.85
        for n in ("Specular IOR Level", "Specular"):
            if n in b.inputs:
                b.inputs[n].default_value = 0.2
    return m


def copper_material():
    """Metallic copper with a little hammered variation (noise in roughness and bump)."""
    m = bpy.data.materials.new("PIECE_Copper")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    if not b:
        return m
    b.inputs["Base Color"].default_value = (0.93, 0.50, 0.32, 1.0)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.32
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 38.0
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.22, 0.22, 0.22, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.48, 0.48, 0.48, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# ---------------------------------------------------------------- render helpers
def setup_render(scene, a):
    r = scene.render
    r.engine = "BLENDER_EEVEE"
    try:
        r.image_settings.media_type = "IMAGE"  # Blender 5: files saved for video output need this first
    except Exception:
        pass
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.film_transparent = False
    r.resolution_percentage = 100
    r.use_motion_blur = False
    try:
        scene.eevee.taa_render_samples = a["samples"]
    except Exception as e:
        log("samples:", e)
    if a["simplify"] is not None:
        r.use_simplify = True
        r.simplify_subdivision_render = a["simplify"]


def render_to(scene, cam, path, w, h):
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def img_stats(path):
    try:
        import numpy as np
        im = bpy.data.images.load(path)
        px = np.empty(len(im.pixels), dtype="float32")
        im.pixels.foreach_get(px)
        px = px.reshape(-1, im.channels)[:, :3]
        luma = 0.2126 * px[:, 0] + 0.7152 * px[:, 1] + 0.0722 * px[:, 2]
        bpy.data.images.remove(im)
        return round(float(luma.mean()), 3), round(float(luma.std()), 3)
    except Exception as e:
        return None, None


def probe_dark(scene, cam, tmp):
    r = scene.render
    keep = (r.resolution_x, r.resolution_y, scene.eevee.taa_render_samples)
    scene.eevee.taa_render_samples = 4
    render_to(scene, cam, tmp, 320, 240)
    scene.eevee.taa_render_samples = keep[2]
    m, s = img_stats(tmp)
    try:
        os.remove(tmp)
    except OSError:
        pass
    return m, s


def encode_mp4(frames_dir, out_mp4, fps=24):
    base = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i",
            os.path.join(frames_dir, "f_%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-an", "-movflags", "+faststart"]
    for crf in (22, 26, 30, 34):
        subprocess.run(base + ["-crf", str(crf), out_mp4], check=True)
        if os.path.getsize(out_mp4) < 8 * 1024 * 1024:
            return crf
    return None


def file_res_for(scene, cap=1600):
    r = scene.render
    w0, h0 = r.resolution_x * r.resolution_percentage // 100, r.resolution_y * r.resolution_percentage // 100
    sc = min(1.0, float(cap) / max(w0, h0))
    return (max(2, int(w0 * sc) // 2 * 2), max(2, int(h0 * sc) // 2 * 2))


# ---------------------------------------------------------------- main
def main():
    stop = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "renders", "_STOP")
    if os.path.exists(stop):  # cooperative pause: a batch drains quickly without rendering anything
        print(json.dumps(dict(file=os.path.basename(bpy.data.filepath), error="stopped by renders/_STOP", outputs=[])))
        return
    a = parse()
    lock_down()
    scene = bpy.context.scene
    ver = tuple(bpy.data.version)
    src_file = bpy.data.filepath
    out = os.path.abspath(a["out"])
    os.makedirs(out, exist_ok=True)
    notes = []

    fixed = repoint_paths(a["src"])
    setup_render(scene, a)
    unhid = unhide_for_render(scene)
    if a["hide"]:
        hs = match_set(scene, a["hide"])
        for o in scene.objects:
            if o.name in hs:
                o.hide_render = True
        notes.append("hid %d objects" % len(hs))
        bpy.context.view_layer.update()

    fixed_cam = None
    if a["fixed"]:
        fpath, _, fname = a["fixed"].rpartition(":")
        if len(fpath) == 1:  # a bare drive letter, no name given
            fpath, fname = a["fixed"], "left34"
        with open(fpath, "r", encoding="utf-8") as fh:
            fixed_cam = json.load(fh)
        fixed_cam["_name"] = fname

    only = match_set(scene, a["frame"]) if a["frame"] else None
    if only is not None and not only:
        notes.append("--frame matched nothing; framing everything")
        only = None
    items, ground_skipped = pick_framed(scene, a["ground"], only)
    if not items:
        print(json.dumps(dict(file=os.path.basename(src_file), error="no renderable objects", outputs=[])))
        return
    pts = np.concatenate([c for _, c in items])
    if len(pts) > 200000:
        pts = pts[:: len(pts) // 200000 + 1]
    lo, hi = extent(pts)
    center = Vector(((lo + hi) / 2.0).tolist())
    radius = float(np.linalg.norm(pts - np.array(center), axis=1).max())
    if fixed_cam:
        center = Vector(fixed_cam["center"])
        radius = fixed_cam["radius"]
    aspect = a["res"][1] / a["res"][0]
    scene_like = len(items) > 15
    if a["allcams"] is None:
        a["allcams"] = scene_like

    mode = a["mode"]
    if mode == "auto":
        mode = "both" if ver < (2, 90, 0) else "mat"
    modes = ["mat", "clay"] if mode == "both" else [mode]

    # ---- lights / world
    lights = file_lights(scene)
    rig_reason = None
    pivot = bpy.data.objects.new("PIECE_pivot", None)
    pivot.location = center
    scene.collection.objects.link(pivot)
    bpy.context.view_layer.update()
    rig = []
    if a["filecamonly"]:
        pass
    elif a["dusk"]:
        for l in lights:
            l.hide_render = True
        dusk_world(scene)
        rig = add_dusk_rig(scene, center, radius, pivot)
        set_view_transform(scene, dusk=True)
        rig_reason = "dusk"
    elif a["relight"]:
        for l in lights:
            l.hide_render = True
        rig_reason = "relight"
    elif not lights:
        rig_reason = "no lights"
    if rig_reason and not rig:
        lavender_world(scene)
        rig = add_rig(scene, center, radius, pivot)
        set_view_transform(scene)
    if a["exposure"] is None and a["dusk"] and not a["filecamonly"]:
        a["exposure"] = 0.9  # the dusk rig is deliberately low; this brings it to a readable level
    if a["exposure"] is not None:
        scene.view_settings.exposure = a["exposure"]

    # ---- cameras: auto orbit views
    default_lens = a["lens"] or (38.0 if scene_like else 60.0)
    views = parse_views(a["views"] or ("scene" if scene_like else "character"), default_lens)
    cams = []
    clip_end = max(radius * 60, 100)
    saved = dict(center=list(center), radius=radius, cams={})
    for name, az, el, lens in views:
        d = fit_distance(pts, center, spherical(az, el), lens, aspect, a["margin"])
        cam = make_camera(scene, "PIECE_cam_" + name, lens, clip_end)
        pos = center + spherical(az, el) * d
        cam.location = pos
        cam.rotation_euler = look_quat(pos, center).to_euler()
        cams.append((name, cam, a["res"]))
        saved["cams"][name] = dict(loc=list(pos), rot=list(cam.rotation_euler), lens=lens)
    if a["savecams"]:
        os.makedirs(os.path.dirname(os.path.abspath(a["savecams"])), exist_ok=True)
        with open(a["savecams"], "w", encoding="utf-8") as fh:
            json.dump(saved, fh)

    # ---- cameras: the file's own
    active = scene.camera if (scene.camera and scene.camera.type == "CAMERA" and not scene.camera.name.startswith("PIECE_")) else None
    others = sorted((o for o in scene.objects if o.type == "CAMERA" and not o.name.startswith("PIECE_") and o is not active),
                    key=lambda o: o.name)
    if active is None and others:
        active, others = others[0], others[1:]
    file_cams = []
    if active is not None:
        file_cams.append(("file", active))
        if a["allcams"]:
            used = {"file"}
            for o in others[:max(0, a["maxcams"] - 1)]:
                nm = slug(o.name)
                nm = nm if nm.startswith("cam") else "cam-" + nm
                k, base = 2, nm
                while nm in used:
                    nm = "%s-%d" % (base, k); k += 1
                used.add(nm)
                file_cams.append((nm, o))
            if len(others) + 1 > a["maxcams"]:
                notes.append("capped file cameras at %d of %d" % (a["maxcams"], len(others) + 1))
    elif a["filecamonly"] or a["allcams"]:
        notes.append("no file camera found")

    fres = file_res_for(scene)
    all_cams = list(cams)
    if a["filecamonly"]:
        all_cams = []
    if not a["nofilecam"]:
        all_cams += [(n, o, fres) for n, o in file_cams]
    if fixed_cam:
        c = fixed_cam["cams"][fixed_cam["_name"]]
        fc = make_camera(scene, "PIECE_cam_fixed", c["lens"], clip_end)
        fc.location = Vector(c["loc"])
        fc.rotation_euler = Euler(c["rot"])
        all_cams = [(fixed_cam["_name"], fc, a["res"])]

    # ---- darkness probe (only when the file has its own lights and we haven't added the rig)
    probe = None
    if not rig and lights and not a["filecamonly"]:
        tmpf = os.path.join(out, "_probe.png")
        mm, ss = probe_dark(scene, cams[0][1], tmpf)
        probe = (mm, ss)
        if mm is not None and mm < 0.10:
            rig_reason = "dark probe (mean %.3f)" % mm
            lavender_world(scene)
            rig = add_rig(scene, center, radius, pivot)
            set_view_transform(scene)
            if a["exposure"] is not None:
                scene.view_settings.exposure = a["exposure"]

    outputs, stats = [], {}
    overrides = {}

    def set_mode(m):
        vl = bpy.context.view_layer
        if m in ("clay", "copper"):
            if m not in overrides:
                overrides[m] = clay_material() if m == "clay" else copper_material()
            vl.material_override = overrides[m]
        else:
            vl.material_override = None

    if a["stills"]:
        for m in modes:
            set_mode(m)
            for name, cam, res in all_cams:
                fn = "%s_%s.png" % (m, name)
                path = os.path.join(out, fn)
                try:
                    render_to(scene, cam, path, *res)
                except Exception as e:
                    notes.append("render %s failed: %s" % (fn, e))
                    continue
                if os.path.exists(path):
                    outputs.append(fn)
                    mm, ss = img_stats(path)
                    stats[fn] = [mm, ss]
                    log("done", fn, mm)

    # ---- turntable
    if a["turntable"] > 0:
        tm = a["tmode"] or (modes[0] if modes[0] in ("clay", "copper") else "mat")
        set_mode(tm)
        if a["tsamples"]:
            scene.eevee.taa_render_samples = a["tsamples"]
        n = a["turntable"]
        tw, th = a["tres"]
        fdir = a["frames"] or os.path.join(out, "_frames")
        shutil.rmtree(fdir, ignore_errors=True)
        os.makedirs(fdir, exist_ok=True)
        # fit one camera against the bbox swept through a full turn
        pc = pts - np.array(center)
        pts_t = []
        for k in range(12):
            R = np.array(Matrix.Rotation(math.radians(30 * k), 3, "Z"))
            pts_t.append(pc @ R.T + np.array(center))
        pts_t = np.concatenate(pts_t)
        el = a["tel"]
        lens = a["tlens"] or (40.0 if scene_like else 60.0)
        d = fit_distance(pts_t, center, spherical(0, el), lens, th / float(tw), a["margin"])
        tcam = make_camera(scene, "PIECE_cam_turn", lens, clip_end)
        pos = center + spherical(0, el) * d
        tcam.location = pos
        tcam.rotation_euler = look_quat(pos, center).to_euler()
        tcam.parent = pivot
        tcam.matrix_parent_inverse = pivot.matrix_world.inverted()
        # file lights should turn with the camera so the lighting stays constant
        for l in lights:
            if not l.hide_render and l.parent is None:
                l.parent = pivot
                l.matrix_parent_inverse = pivot.matrix_world.inverted()
        ok = True
        for i in range(n):
            pivot.rotation_euler = (0, 0, math.radians(360.0 * i / n))
            bpy.context.view_layer.update()
            try:
                render_to(scene, tcam, os.path.join(fdir, "f_%04d.png" % (i + 1)), tw, th)
            except Exception as e:
                notes.append("turntable frame %d failed: %s" % (i, e))
                ok = False
                break
            if i % 12 == 0:
                log("turntable frame", i + 1, "of", n)
        if ok:
            mp4 = os.path.join(out, "turntable.mp4")
            try:
                crf = encode_mp4(fdir, mp4)
                outputs.append("turntable.mp4")
                stats["turntable.mp4"] = [os.path.getsize(mp4), crf]
                shutil.rmtree(fdir, ignore_errors=True)
            except Exception as e:
                notes.append("ffmpeg failed: %s" % e)
        pivot.rotation_euler = (0, 0, 0)

    summ = dict(
        file=os.path.basename(src_file), blender_version=list(ver), mode=mode,
        objects_framed=len(items), object_names=[o.name for o, _ in items if o is not None][:30],
        ground_skipped=ground_skipped, bbox=[round(float(v), 3) for v in (*lo, *hi)],
        lights_in_file=len(lights), rig=rig_reason, probe=probe, paths_repointed=fixed, unhid=unhid,
        scene_like=scene_like, file_cams=[n for n, _ in file_cams], views=[v[0] for v in views],
        outputs=outputs, stats=stats, notes=notes, seconds=round(time.time() - T0, 1))
    print(json.dumps(summ))


try:
    main()
except SystemExit:
    raise
except Exception as e:
    import traceback
    traceback.print_exc()
    print(json.dumps(dict(file=os.path.basename(bpy.data.filepath), error=repr(e), outputs=[])))
    sys.exit(1)
