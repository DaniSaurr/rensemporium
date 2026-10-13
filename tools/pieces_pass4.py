"""Pass 4 piece specs (AI-assisted 3D and experiments). Run: python tools/pieces_pass4.py <slug> [...]
Each builder makes a NEW content folder (it refuses to overwrite an existing piece.toml)."""
import os, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pieces4 import *

SP = "C:/Users/AEROCOOL/AppData/Local/Temp/claude/C--Users-AEROCOOL-Documents-opus-5-5/7d55a6d4-5ae0-40f6-8edc-e4464c165c0e/scratchpad"
R = ROOT.replace("\\", "/") + "/renders"
DOCS = "C:/Users/AEROCOOL/Documents"
BUILD = {}


def piece(fn):
    BUILD[fn.__name__.replace("_", "-")] = fn
    return fn


def put(out, g, src, name, cap=None, crop=None, maxw=1800):
    jpg(src, out + "/" + name + ".jpg", crop=crop, maxw=maxw)
    g.append((name + ".jpg", cap))


@piece
def watched_town():
    out = mkdir("games", "watched-town")
    wt = SP + "/wt_test"
    r = R + "/watched-town"
    vid(wt + "/approach.mp4", out + "/approach.mp4", ss=0.4, t=12.6, scale_w=1280, max_mb=7)
    jpg(wt + "/approach-01.jpg", out + "/approach-poster.jpg")
    g = []
    for i, cap in (("01", None), ("02", None), ("03", None), ("05", "the grab")):
        put(out, g, wt + "/approach-%s.jpg" % i, "walk-" + i, cap)
    for i in ("01", "02", "03", "04", "05", "06", "07", "08"):
        put(out, g, wt + "/tour-%s.png" % i, "town-" + i)
    put(out, g, r + "/town/mat_file.png", "town-blender", "town scene, blender")
    vid(r + "/model/turntable.mp4", out + "/watcher-turntable.mp4", scale_w=720, max_mb=3)
    g.append(("watcher-turntable.mp4", "winged watcher model"))
    for src, name, cap in ((r + "/model/mat_d.png", "model-front", "winged watcher on the dome"),
                           (r + "/model/mat_a.png", "model-side", None),
                           (r + "/pose-idle/mat_a.png", "pose-idle", "pose: perch idle"),
                           (r + "/pose-alert/mat_a.png", "pose-alert", "pose: perch alert"),
                           (r + "/pose-pounce/mat_b.png", "pose-pounce", "pose: pounce"),
                           (r + "/pose-get/mat_b.png", "pose-get", "pose: get")):
        put(out, g, src, name, cap, crop="43")
    hero = '{ type = "video", src = "approach.mp4", poster = "approach-poster.jpg" }'
    write_piece("games", "watched-town", "watched town", "2026", ["godot 4.7", "blender"], True, 8, hero, "approach-poster.jpg",
                [("claude", ["fable 5", "opus 4.8"]), ("gpt", ["gpt-5.6-terra"])], g)


@piece
def biomech_quadruped():
    out = mkdir("3d", "biomech-quadruped")
    r = R + "/biomech-quadruped"
    crop = subject_crop(r + "/turn/turntable.mp4", aspect=16 / 9, pad=0.06)
    print("turntable crop", crop)
    vid(r + "/turn/turntable.mp4", out + "/turntable.mp4", crop=crop, scale_w=960, max_mb=6)
    g = [("turntable.mp4", "turntable")]
    spec = [(r + "/orbit/mat_left34.png", "left34", None), (r + "/orbit/mat_right34.png", "right34", None), (r + "/orbit/mat_low.png", "low", None),
            (r + "/orbit/mat_front.png", "front", None), (r + "/final-cams/mat_cam-t-top.png", "top", "top"),
            (r + "/part-head/mat_a.png", "head", "head"), (r + "/part-neck/mat_a.png", "neck", "neck"),
            (r + "/part-torso/mat_a.png", "torso", "torso"), (r + "/part-pelvis/mat_a.png", "pelvis", "pelvis"),
            (r + "/part-dorsal/mat_a.png", "dorsal-module", "dorsal module"),
            (r + "/part-limb-front/mat_a.png", "front-leg", "front leg"), (r + "/part-limb-hind/mat_a.png", "hind-leg", "hind leg"),
            (r + "/part-cables/mat_a.png", "cables", "cables"), (r + "/part-kit/mat_a.png", "kit-joint", "joint kit part")]
    for src, name, cap in spec:
        put(out, g, src, name, cap, crop="43")
    dev = []
    put(out, dev, DOCS + "/Codex/2026-07-25/i-wan/outputs/biomechanical-quadruped-preview.png", "dev-first-blockout", "first blockout, 25 july 2026")
    put(out, dev, r + "/stage-blockout/mat_left34.png", "dev-blockout", "blockout with hand edits", crop="43")
    hero = '{ type = "video", src = "turntable.mp4", poster = "left34.jpg" }'
    write_piece("3d", "biomech-quadruped", "biomechanical quadruped", "2026", ["blender 5.1"], True, 13, hero, "left34.jpg",
                [("claude", ["opus 4.8", "opus 5"]), ("gpt", ["gpt-5.6-sol"])], g, dev=dev)


def pad43_video(src, dst, ss=None, t=None, h=720, max_mb=5):
    import subprocess
    vf = "scale=-2:%d:flags=lanczos,pad=%d:%d:(ow-iw)/2:0:color=0x1d1f33,format=yuv420p" % (h, h * 4 // 3, h)
    for crf in (24, 28, 32):
        cmd = ["ffmpeg", "-y", "-loglevel", "error"] + (["-ss", str(ss)] if ss else []) + ["-i", src] + (["-t", str(t)] if t else []) +               ["-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-an", "-movflags", "+faststart", dst]
        subprocess.run(cmd, check=True, capture_output=True)
        if os.path.getsize(dst) <= max_mb * 1024 * 1024:
            break


@piece
def bot_project():
    import subprocess
    out = mkdir("3d", "bot-project")
    T = DOCS + "/Codex/2026-07-24/tak/outputs/"
    # hero: three robots side by side, 12 s loops
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-t", "12", "-i", T + "bot-09-window-polisher-event-event2-reverse-event.mp4",
           "-t", "12", "-i", T + "bot-19-fallen-star-repairer-idle-event-idle2.mp4",
           "-t", "12", "-i", T + "bot-30-retro-cgi-stage.mp4",
           "-filter_complex", "[0:v]scale=-2:600[a];[1:v]scale=-2:600[b];[2:v]scale=-2:600[c];[a][b][c]hstack=inputs=3,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-an", "-movflags", "+faststart", out + "/robots.mp4"]
    subprocess.run(cmd, check=True, capture_output=True)
    g = [("robots.mp4", "window polisher, fallen star repairer, hatchling of the horizon")]
    pad43_video(T + "bot-30-cube-toss-full-short-polished.mp4", out + "/cube-toss.mp4", t=20)
    g.append(("cube-toss.mp4", "hatchling of the horizon, cube toss"))
    pad43_video(T + "bot-19-fallen-star-repairer-palindrome-loop.mp4", out + "/star-repairer-loop.mp4")
    g.append(("star-repairer-loop.mp4", "fallen star repairer, loop"))
    for src, name, cap in (("bot-09-window-polisher-preview.png", "window-polisher", "bot 09, window polisher"),
                           ("bot-19-fallen-star-repairer-preview.png", "star-repairer", "bot 19, fallen star repairer"),
                           ("bot-30-retro-cgi-stage-preview.png", "hatchling", "bot 30, hatchling of the horizon"),
                           ("bot-30-preview.png", "hatchling-night", "bot 30, first preview"),
                           ("bot-09-animation-poses.png", "poses-09", "bot 09, animation poses"),
                           ("bot-19-animation-poses.png", "poses-19", "bot 19, animation poses"),
                           ("bot-30-procedural-animation-poses.png", "poses-30", "bot 30, procedural animation poses")):
        jpg(T + src, out + "/" + name + ".jpg", maxw=1400)
        g.append((name + ".jpg", cap, True))
    jpg(T + "bot-30-cube-toss-full-short-polished-checkpoints.png", out + "/toss-checkpoints.jpg", maxw=1400)
    g.append(("toss-checkpoints.jpg", "cube toss, nine frames", True))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", out + "/robots.mp4", "-vframes", "1", "-ss", "2", out + "/poster.jpg"], check=True)
    hero = '{ type = "video", src = "robots.mp4", poster = "poster.jpg" }'
    write_piece("3d", "bot-project", "bot project", "2026", ["blender 5.1"], True, 14, hero, "poster.jpg",
                [("claude", ["opus 4.8", "opus 5"]), ("gpt", ["gpt-5.6-sol", "gpt-5.6-terra"])], g)


@piece
def robot_builds():
    out = mkdir("3d", "robot-builds")
    r = R + "/robot-builds"
    crop = subject_crop(r + "/blue-shield-turn/turntable.mp4", aspect=4 / 3, pad=0.08)
    vid(r + "/blue-shield-turn/turntable.mp4", out + "/blue-shield-turn.mp4", crop=crop, scale_w=960, max_mb=4)
    g = [("blue-shield-turn.mp4", "blue shield robot")]
    for src, name, cap in ((r + "/blue-shield/mat_front.png", "shield-front", "blue shield robot, v2"),
                           (r + "/blue-shield/mat_left34.png", "shield-left", None),
                           (r + "/blue-shield/mat_high.png", "shield-high", None),
                           (r + "/blue-shield/mat_back34.png", "shield-back", None),
                           (r + "/lamp/mat_left34.png", "lamp-left", "robot lamp"),
                           (r + "/lamp/mat_file.png", "lamp-file", None)):
        put(out, g, src, name, cap, crop="43" if name != "lamp-file" else None)
    jpg(r + "/blue-shield/mat_front.png", out + "/poster.jpg", crop="43")
    hero = '{ type = "video", src = "blue-shield-turn.mp4", poster = "poster.jpg" }'
    write_piece("3d", "robot-builds", "robot builds", "2026", ["blender 5.1"], False, 31, hero, "poster.jpg",
                [("claude", ["fable 5", "opus 4.8"]), ("gpt", ["gpt-5.6-sol", "gpt-5.6-terra"])], g)


@piece
def airplane_bots():
    out = mkdir("3d", "airplane-bots")
    r = R + "/airplane-bots"
    crop = subject_crop(r + "/bot5-turn/turntable.mp4", aspect=4 / 3, pad=0.1)
    vid(r + "/bot5-turn/turntable.mp4", out + "/bot5-turn.mp4", crop=crop, scale_w=960, max_mb=4)
    g = [("bot5-turn.mp4", "airplane bot 5")]
    for src, name, cap in ((r + "/bot5/mat_left34.png", "bot5-left", "airplane bot 5"), (r + "/bot5/mat_high.png", "bot5-high", None),
                           (r + "/bot5/mat_back34.png", "bot5-back", None), (r + "/bot5/mat_low.png", "bot5-low", None),
                           (r + "/bot3/mat_file.png", "bot3-front", "airplane bot 3"), (r + "/bot3/mat_left34.png", "bot3-left", None),
                           (r + "/bot3/mat_right34.png", "bot3-right", None),
                           (r + "/bot2/mat_high.png", "bot2-high", "airplane bot 2"), (r + "/bot2/mat_left34.png", "bot2-left", None)):
        put(out, g, src, name, cap, crop="43")
    jpg(r + "/bot5/mat_left34.png", out + "/poster.jpg", crop="43")
    hero = '{ type = "video", src = "bot5-turn.mp4", poster = "poster.jpg" }'
    write_piece("3d", "airplane-bots", "airplane bots", "2024", ["blender"], False, 32, hero, "poster.jpg", None, g, tags=["rendered 2026"])


@piece
def reliquary_engine():
    out = mkdir("3d", "reliquary-engine")
    r = R + "/reliquary-engine/dusk"
    pad43_video(r + "/turntable.mp4", out + "/turntable.mp4", h=900, max_mb=5)
    g = [("turntable.mp4", "turntable")]
    for src, name in ((r + "/mat_threequarter.png", "threequarter"), (r + "/mat_front.png", "front"), (r + "/mat_low.png", "low")):
        jpg(src, out + "/" + name + ".jpg", maxw=1200); g.append((name + ".jpg", None, True))
    jpg(r + "/mat_threequarter.png", out + "/poster.jpg", maxw=1000)
    hero = '{ type = "video", src = "turntable.mp4", poster = "poster.jpg" }'
    write_piece("3d", "reliquary-engine", "reliquary engine", "2026", ["blender 5.1", "python"], False, 33, hero, "poster.jpg",
                [("claude", ["opus 4.8", "opus 5"])], g)


@piece
def scripted_scenes():
    import subprocess
    out = mkdir("experiments", "scripted-scenes")
    A = DOCS + "/ai blender/july 2026/"
    vid(A + "recursive_city.mp4", out + "/recursive-city.mp4", scale_w=1280, max_mb=6)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", A + "murmuration_final.gif", "-vf", "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-c:v", "libx264", "-crf", "26", "-movflags", "+faststart", "-an", out + "/murmuration.mp4"], check=True)
    g = [("recursive-city.mp4", "recursive city"), ("murmuration.mp4", "murmuration")]
    put(out, g, A + "recursive_city.png", "recursive-city-still", "recursive city, 215 towers")
    r = R + "/july-scripts"
    put(out, g, r + "/gamelgishkii/mat_file.png", "island-town", "island town")
    put(out, g, r + "/gamelgishkii/mat_right34.png", "island", None, crop="43")
    put(out, g, r + "/dome/mat_left34.png", "dome", "dome building", crop="43")
    put(out, g, r + "/houses/mat_left34.png", "houses", "house kit", crop="43")
    jpg(A + "recursive_city.png", out + "/poster.jpg", maxw=1200)
    hero = '{ type = "video", src = "recursive-city.mp4", poster = "poster.jpg" }'
    write_piece("experiments", "scripted-scenes", "scripted scenes", "2026", ["blender 5.1", "python"], True, 6, hero, "poster.jpg",
                [("claude", ["fable 5", "opus 4.8"])], g)


@piece
def rens_shaper():
    out = mkdir("experiments", "rens-shaper")
    os.makedirs(out + "/play")
    shutil.copy2(DOCS + "/Codex/2026-07-28/referenced-chatgpt-conversation-this-is-untrusted/outputs/rens-shaper-3.html", out + "/play/index.html")
    g = []
    for n, cap in (("mandala-dense", None), ("peacock-fan", None), ("moth", None), ("archipelago", None), ("gothic-window", None),
                   ("iron-gate", None), ("three-pools", None), ("mandala", None)):
        put(out, g, R + "/shaper-shots/%s.png" % n, n, "composition: " + n.replace("-", " "))
    jpg(R + "/shaper-shots/rose-window.png", out + "/rose-window.jpg")
    hero = '{ type = "image", src = "rose-window.jpg", alt = "the shaper with the rose window composition loaded" }'
    write_piece("experiments", "rens-shaper", "ren's shaper", "2026", ["javascript", "html"], True, 7, hero, "rose-window.jpg",
                [("claude", ["opus 5"]), ("gpt", ["gpt-5.6-sol", "gpt-5.6-terra"])], g, links=[("open", "play/")])


@piece
def blackwood():
    out = mkdir("3d", "blackwood")
    O = DOCS + "/Codex/2026-08-05/i-w/outputs/"
    g = []
    for f, name, cap in (("blackwood_level_trimsheet_v2_overview", "level", "level overview"),
                         ("blackwood_courtyard_trimsheet_v2_overview", "courtyard", "courtyard"),
                         ("blackwood_forest_approach_trimsheet_v2_overview", "forest-approach", "forest approach"),
                         ("blackwood_downhill_path_trimsheet_v2_overview", "downhill-overview", "downhill path"),
                         ("blackwood_downhill_path_trimsheet_v2_top", "downhill-top", None),
                         ("blackwood_downhill_path_trimsheet_v2_bottom", "downhill-bottom", None),
                         ("blackwood_courtyard_closeup", "courtyard-closeup", "courtyard, close"),
                         ("blackwood_courtyard_forest_gate", "forest-gate", "forest gate"),
                         ("blackwood_ravine_bridge", "ravine-bridge", "ravine bridge"),
                         ("blackwood_ravine_enclosed_shrine", "shrine", "shrine"),
                         ("blackwood_eastern_ridge_trail", "ridge-trail", "eastern ridge trail"),
                         ("blackwood_forest_hamlet", "hamlet", "forest hamlet"),
                        ):
        put(out, g, O + f + ".png", name, cap)
    hero = '{ type = "image", src = "level.jpg", alt = "a low poly cliff and forest level seen from above" }'
    write_piece("3d", "blackwood", "blackwood", "2026", ["blender 5.1"], False, 34, hero, "level.jpg", [("gpt", ["gpt-5.6-sol"])], g)


@piece
def cathedral_facade():
    out = mkdir("3d", "cathedral-facade")
    O = DOCS + "/Codex/2026-07-28/"
    g = []
    for v in (10, 9, 2, 3, 4, 6, 8):
        put(out, g, O + "file-c-users-aerocool-documents-codex/outputs/gothic_cathedral_mesh_v%d.png" % v, "v%d" % v, "mesh v%d" % v)
        g[-1] = g[-1] + (True,)
    put(out, g, O + "file-c-users-aerocool-documents-codex/outputs/gothic_cathedral_facade.png", "first-facade", "first facade")
    g[-1] = g[-1] + (True,)
    hero = '{ type = "image", src = "v10.jpg", alt = "a low poly gothic church facade at night with a glowing rose window" }'
    write_piece("3d", "cathedral-facade", "cathedral facade", "2026", ["blender 5.1", "python"], False, 35, hero, "v10.jpg",
                [("gpt", ["gpt-5.6-sol", "gpt-5.6-terra"])], g)


GEN = "C:/Users/AEROCOOL/.codex/generated_images/"


def gen_files(prefix):
    d = [x for x in os.listdir(GEN) if x.startswith(prefix)][0]
    return [GEN + d + "/" + f for f in sorted(os.listdir(GEN + d)) if f.lower().endswith(".png")]


@piece
def character_sheets():
    out = mkdir("experiments", "character-sheets")
    files = gen_files("019f9aeb") + gen_files("019f9b82")
    g = []
    for i, f in enumerate(files, 1):
        put(out, g, f, "sheet-%02d" % i, None, maxw=1700)
        g[-1] = g[-1] + (True,)
    hero = '{ type = "image", src = "sheet-01.jpg", alt = "ten harlequin figures in a grid on red" }'
    write_piece("experiments", "character-sheets", "character sheets", "2026", ["codex"], False, 8, hero, "sheet-01.jpg",
                [("gpt", ["gpt-5.6-sol", "gpt-5.6-terra"])], g[1:])


@piece
def concept_images():
    out = mkdir("experiments", "concept-images")
    candy = gen_files("019f9a4b")
    goth = gen_files("019f9a9c")
    picks = [candy[i] for i in (0, 1, 3, 5, 7, 8, 11, 12, 15, 27, 29, 33, 35, 39)] + [goth[i] for i in (0, 3, 4, 10, 13, 15, 18, 20, 22, 25, 28, 31, 34, 36)]
    g = []
    for i, f in enumerate(picks, 1):
        put(out, g, f, "concept-%02d" % i, None, maxw=1100)
        g[-1] = g[-1] + (True,)
    hero = '{ type = "image", src = "concept-01.jpg", alt = "a ruined stone tower rising out of cloud" }'
    write_piece("experiments", "concept-images", "concept images", "2026", ["codex"], False, 9, hero, "concept-01.jpg",
                [("gpt", ["gpt-5.6-sol"])], g[1:])


if __name__ == "__main__":
    for s in sys.argv[1:]:
        BUILD[s]()
        print("built", s)
