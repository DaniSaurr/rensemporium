"""Pass 3 mesh jobs (run with tools/render_meshes.py). (slug, part, spec, render_piece args)."""
D = r"C:\Users\AEROCOOL\Desktop"
DOC = r"C:\Users\AEROCOOL\Documents"
X = r"X:\Alt USB Backup\2021\drive E\3D Stuff"
V = ["--views", "left34:-38:14,right34:38:14,front:0:8,back34:150:14", "--mode", "both", "--samples", "40", "--no-file-cam"]

MESH_JOBS = []


def mj(slug, part, items, *args, gap=0.3):
    MESH_JOBS.append((slug, part, dict(items=items, gap=gap), list(args)))


mj("robot-head-sculpt", "done-robot2", [dict(path=D + r"\done robot2.obj", vcol=True, smooth=True, rot=[0, 0, 0])], *V)
mj("robot-head-sculpt", "done-robot3", [dict(path=D + r"\done robot3.obj", vcol=True, smooth=True)], *V)
mj("robot-head-sculpt", "snakehead", [dict(path=D + r"\snakeHead.obj", vcol=True, smooth=True)], *V)

mj("robot-head-sculpt", "done-robot-high", [dict(path=D + r"\done robot high res.obj", smooth=True,
    sidecar=[D + r"\done robot high res.mtl", D + r"\done robot high res_Layer_3.png"])], *V)
mj("robot-head-sculpt", "highsculpt", [dict(path=X + r"\HighSculpt_RobotHead.fbx", smooth=True)], *V)
mj("robot-head-sculpt", "lowsculpt", [dict(path=X + r"\LowSculpt_RobotHead.fbx", smooth=True)], *V)

mj("robot-head-sculpt", "pair", [dict(path=X + r"\LowSculpt_RobotHead.fbx", smooth=True, size=1.84),
                                  dict(path=X + r"\HighSculpt_RobotHead.fbx", smooth=True)],
   "--views", "front:0:6:70,left34:-30:10:70", "--mode", "clay", "--samples", "40", "--no-file-cam", "--margin", "0.1", gap=0.5)

CE = DOC
VC = ["--views", "front:0:6,left34:-35:12,right34:35:12,back34:150:12", "--mode", "clay", "--samples", "40", "--no-file-cam"]
mj("cursed-emoji", "base", [dict(path=CE + r"\CursedEmojiBaseMesh.fbx", smooth=True)], *VC)
mj("cursed-emoji", "sculpt1", [dict(path=CE + r"\CursedEmojiSculpt1.fbx", smooth=True)], *VC)
mj("cursed-emoji", "sculpt7", [dict(path=CE + r"\CursedEmojiSculpt7.fbx", smooth=True)], *VC)

VM = ["--views", "front:0:6,left34:-35:12,right34:35:12", "--mode", "both", "--samples", "40", "--no-file-cam"]
mj("cursed-emoji", "obj1", [dict(path=CE + r"\CursedEmojiOBJ.obj", smooth=True,
    sidecar=[CE + r"\CursedEmojiOBJ.mtl", CE + r"\cursedEmojiTexture.png"])], *VM)
mj("cursed-emoji", "obj2", [dict(path=CE + r"\CursedEmojiOBJ2.obj", smooth=True,
    sidecar=[CE + r"\CursedEmojiOBJ2.mtl", CE + r"\cursedEmojiTexture.png"])], *VM)

# ---- cosmic crash models, 2019 (X: drive, drive E / 3D Stuff)
def xs(*names):
    return [X + "\\" + n for n in names]


EXP = ["--exposure", "-0.7", "--samples", "40", "--no-file-cam", "--mode", "clay"]
PAIR = ["--res", "1600", "800", "--margin", "0.06"] + EXP
mj("cosmic-crash-models", "astrogirl", [dict(path=X + r"\AstrogirlOBJ.obj", smooth=True)],
   "--views", "front:0:6,left34:-35:12,right34:35:12,back34:150:12", *EXP)
mj("cosmic-crash-models", "mainship", [dict(path=p, smooth=True) for p in xs("mainShipLP.obj", "mainShipHP.obj")],
   "--views", "top34:-25:40:60,front:0:10:60", *PAIR, gap=0.5)
mj("cosmic-crash-models", "enemyship", [dict(path=p, smooth=True) for p in xs("eshipLP.obj", "eshipHP.obj")],
   "--views", "top34:-25:30:60,front:0:10:60", *PAIR, gap=0.5)
mj("cosmic-crash-models", "seamine", [dict(path=p, smooth=True) for p in xs("seaMineLP.obj", "seaMineHP.obj")],
   "--views", "front:0:10:60", *PAIR, gap=0.5)
mj("cosmic-crash-models", "healthpickup", [dict(path=p, smooth=True) for p in xs("healthPickupLP.obj", "healthPickupHP.obj")],
   "--views", "front:0:10:60,left34:-30:15:60", *PAIR, gap=0.5)
mj("cosmic-crash-models", "extras", [dict(path=p, smooth=True) for p in xs("BiPlane.fbx", "ChainWhip.fbx")],
   "--views", "left34:-30:20:60,top34:-60:40:60", *PAIR, gap=0.6)
mj("cosmic-crash-models", "cast", [dict(path=p, smooth=True) for p in xs("GiantOBJ.obj", "GoblinOBJ.obj", "NormalMan.obj", "weirdManOBJ.obj", "CucullainOBJ.obj")],
   "--views", "front:0:6:60,left34:-30:10:60", "--res", "1800", "700", "--margin", "0.04", *EXP[:0], *EXP, gap=0.5)

# ---- maya exports, 2019 (Downloads/*.fbx from Dec 2020, Documents/bench.fbx)
DL = r"C:\Users\AEROCOOL\Downloads"
M3 = ["--views", "left34:-38:16,right34:38:16,front:0:8,back34:150:14", "--mode", "both", "--samples", "40", "--no-file-cam", "--exposure", "-0.5"]
mj("maya-2019", "castle-tower", [dict(path=DL + r"\CastleTowerModular.fbx", smooth=True)], *M3)
mj("maya-2019", "cute-castle", [dict(path=DL + r"\cuteCastleRendering.fbx", smooth=True)], *M3)
mj("maya-2019", "frog", [dict(path=DL + r"\frogGradTexture.fbx", smooth=True)], *M3)
mj("maya-2019", "bench", [dict(path=DOC + r"\bench.fbx", smooth=True)], *M3)
mj("maya-2019", "ice-rink", [dict(path=DOC + r"\iceRink.fbx", smooth=True)], *M3)
mj("maya-2019", "nibbler", [dict(path=DOC + r"\nibbler.fbx", smooth=True)], *M3)
mj("maya-2019", "little-mouse-man", [dict(path=DOC + r"\littlemouseman.obj", smooth=True)], *M3)

# ---- turntables
TT = ["--no-stills", "--turntable", "72", "--turntable-el", "10", "--turntable-lens", "60", "--tsamples", "24", "--no-file-cam"]
mj("robot-head-sculpt", "orbit", [dict(path=X + r"\HighSculpt_RobotHead.fbx", smooth=True)], *TT, "--mode", "clay", "--exposure", "-0.3")
mj("cursed-emoji", "orbit", [dict(path=CE + r"\CursedEmojiOBJ.obj", smooth=True,
    sidecar=[CE + r"\CursedEmojiOBJ.mtl", CE + r"\cursedEmojiTexture.png"])], *TT, "--mode", "mat")
