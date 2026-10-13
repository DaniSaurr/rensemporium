"""Second half of the pass-2 piece list: spooktober additions and the broader-pass pieces.
Imported by pieces_pass2.py (bottom). Paths are relative to renders/. Captions are factual only."""
from pieces_pass2 import piece, g

# ------------------------------------------------------------------ spooktober 2020 (existing piece: gallery only)
SP = "spooktober-2020/"
piece(slug="spooktober-2020", extend=True, gallery=[
    g(SP + "raven/mat_file.png", "r26-raven", "rendered 2026"),
    g(SP + "jackalope/mat_file.png", "r26-jackalope", "rendered 2026"),
    g(SP + "knight/mat_file.png", "r26-knight", "rendered 2026"),
    g(SP + "puppet/mat_file.png", "r26-puppet", "rendered 2026"),
    g(SP + "antique/mat_file.png", "r26-antique", "rendered 2026"),
    g(SP + "witch-spider/mat_file.png", "r26-witch-spider", "rendered 2026"),
    g(SP + "cat/mat_file.png", "r26-cats", "rendered 2026"),
    g(SP + "alien4/mat_file.png", "r26-alien", "rendered 2026"),
    g(SP + "werewolf2/mat_file.png", "r26-werewolf", "rendered 2026"),
    g(SP + "mistofolees/mat_file.png", "r26-mistofolees", "rendered 2026"),
])

# ------------------------------------------------------------------ broader pass: new pieces (lead = false)
T = ["rendered 2026"]
piece(slug="mecha-study", title="mecha study", year="2021", made_with=["blender"], lead=False, order=30, tags=T,
      hero=dict(src="mecha-study/9color/mat_left34.png", name="mecha-9color",
                alt="a blue and purple mech figure with white horns on a lavender background"),
      gallery=[g("mecha-study/9color/mat_file.png", "mecha-9color-front"),
               g("mecha-study/8color/mat_file.png", "mecha-8color-pose"),
               g("mecha-study/8color/mat_left34.png", "mecha-8color-left"),
               g("mecha-study/7color/mat_left34.png", "mecha-7color-left"),
               g("mecha-study/6-colours/mat_left34.png", "mecha-6colours-left"),
               g("mecha-study/psoing/mat_left34.png", "mecha-psoing-left"),
               g("mecha-study/manashpere/mat_left34.png", "manashpere-left")])

piece(slug="low-poly-2023", title="low poly 2023", year="2023", made_with=["blender"], lead=False, order=31, tags=T,
      hero=dict(src="low-poly-2023/bull-guy/mat_file.png", name="bull-guy",
                alt="the head of a black horned figure with gold glowing eyes and chest"),
      gallery=[g("low-poly-2023/bull-guy/mat_left34.png", "bull-guy-left", "bull guy 3"),
               g("low-poly-2023/boots-guy/mat_left34.png", "boots-guy-left", "boots guy 3"),
               g("low-poly-2023/boofer/mat_file.png", "boofer-desert", "boofer 4"),
               g("low-poly-2023/big-sword/mat_left34.png", "big-sword-left", "big sword"),
               g("low-poly-2023/silly-dog/mat_file.png", "silly-dog", "silly dog dance"),
               g("low-poly-2023/harpoon/mat_left34.png", "harpoon-left", "harpoon"),
               g("low-poly-2023/bridge/mat_left34.png", "bridge-left", "bridge2")])

piece(slug="street-corner", title="street corner", year="2020", made_with=["blender"], lead=False, order=32, tags=T,
      hero=dict(src="street-corner/blockout7/mat_file.png", name="blockout7-file",
                alt="a fox-faced figure sitting on a stone wall at a brick street corner, with an electrical box beside it"),
      gallery=[g("street-corner/scene/mat_file.png", "scene-file", "scene, november 2020"),
               g("street-corner/blockout7/mat_left34.png", "blockout7-left", "blockout7")])

piece(slug="node-textured-plane", title="node based textured plane", year="2022", made_with=["blender"], lead=False,
      order=33, tags=T,
      hero=dict(src="node-textured-plane/plane-8/mat_file.png", name="plane8-file",
                alt="a grey castle with many towers beside green hills and water"),
      gallery=[g("node-textured-plane/plane-8/mat_left34.png", "plane8-left", "node based textured plane8"),
               g("node-textured-plane/plane-4/mat_file.png", "plane4-file", "node based textured plane4"),
               g("node-textured-plane/plane-4/mat_left34.png", "plane4-left"),
               g("node-textured-plane/plane-2/mat_left34.png", "plane2-left", "node based textured plane2"),
               g("node-textured-plane/plane-2/mat_file.png", "plane2-file")])

piece(slug="hffc-hotel", title="hffc hotel", year="2022", made_with=["blender"], lead=False, order=34, tags=T,
      hero=dict(src="hffc-hotel/hotel/mat_file.png", name="hotel-file",
                alt="a stone hotel at night with lit windows, seen down a path"),
      gallery=[g("hffc-hotel/hotel-5/mat_file.png", "hotel5-file", "hffc hotel 5")])

piece(slug="july-2018", title="july 2018", year="2018", made_with=["blender 2.79"], lead=False, order=35, tags=T,
      hero=dict(src="first-steps-2018/little-scene/mat_file.png", name="little-scene",
                alt="a low-poly lake scene with purple rocks, reeds and a small house"),
      gallery=[g("first-steps-2018/rocks/mat_file.png", "rocks", "rocks"),
               g("first-steps-2018/house/mat_file.png", "house", "house"),
               g("first-steps-2018/staff/mat_file.png", "staff", "staff"),
               g("first-steps-2018/tsuchiniko/mat_file.png", "tsuchiniko", "tsuchiniko"),
               g("first-steps-2018/eyebot/mat_file.png", "eyebot", "eyebot"),
               g("first-steps-2018/donut2/clay_file.png", "donut", "donut"),
               g("first-steps-2018/lizard/mat_file.png", "lizard", "lizard")])

piece(slug="texture-doodle", title="texture doodle", year="2026", made_with=["blender"], lead=False, order=36, tags=T,
      hero=dict(src="texture-doodle/animals/mat_left34.png", name="cat-and-crow",
                alt="a textured low-poly cat standing over a blue and white crow"),
      gallery=[g("texture-doodle/cat/mat_left34.png", "cat-left", "animal exports cat"),
               g("texture-doodle/untitled/mat_file.png", "untitled-file", "untitled"),
               g("texture-doodle/untitled/mat_left34.png", "untitled-left")])

piece(slug="face-medals", title="face medals", year="2026", made_with=["blender"], lead=False, order=37, tags=T,
      hero=dict(src="face-medals/faces/mat_file.png", name="faces-file",
                alt="three relief faces on discs: a sun face in orange, a pale face and a grey mercury face"),
      gallery=[g("face-medals/faces/mat_left34.png", "faces-left")])

piece(slug="godot-3d-models", title="godot 3d models", year="2026", made_with=["blender", "godot"], lead=False, order=38,
      tags=T,
      hero=dict(strip=["godot-3d-models/%s/mat_left34.png" % n for n in
                       ("crabblock", "medium-tree", "mountain", "tree-and-log", "spiky-rock-1", "spiky-rock-2",
                        "spiky-rock-3", "spiky-rock-4", "book", "bricks", "medium-twig", "small-twig")],
                name="kit", cols=4, cell=(450, 338),
                alt="twelve small game models on one board: a carved stone block, trees, a mountain, crystals, a book and bricks"),
      gallery=[g("godot-3d-models/mountain/mat_front.png", "mountain-front", "mountain"),
               g("godot-3d-models/crabblock/mat_left34.png", "crabblock-left", "crabblock"),
               g("godot-3d-models/medium-tree/mat_left34.png", "medium-tree-left", "medium_tree"),
               g("godot-3d-models/bricks/mat_left34.png", "bricks-left", "bricks"),
               g("godot-3d-models/book/mat_left34.png", "book-left", "book")])

piece(slug="july-2026", title="july 2026", year="2026", made_with=["blender"], lead=False, order=39, tags=T,
      hero=dict(src="july-2026/pool/mat_file.png", name="pool-file",
                alt="a round pool in a tiled room with glass-block windows"),
      gallery=[g("july-2026/gorger-relit/mat_left34.png", "gorger-left", "gorger2"),
               g("july-2026/gorger-relit/mat_right34.png", "gorger-right"),
               g("july-2026/greentower/mat_left34.png", "greentower-left", "greentower"),
               g("july-2026/fractal-relit/mat_front.png", "fractal-front", "splitting fractal")])

piece(slug="pillar", title="pillar", year="2026", made_with=["blender"], lead=False, order=40, tags=T,
      hero=dict(src="pillar/pillar2h/mat_file.png", name="pillar2-file",
                alt="a grey temple front with green-tinted columns on a checkered floor"),
      gallery=[g("pillar/pillar3h/mat_file.png", "pillar3-file", "pillar3"),
               g("pillar/pillar3h/mat_front.png", "pillar3-front"),
               g("pillar/pillar2h/mat_left34.png", "pillar2-left", "pillar2")])

piece(slug="shapes-zoom", title="shapes zoom", year="2026", made_with=["blender"], lead=False, order=41, tags=T,
      hero=dict(src="shapes-zoom/shapes-zoom/mat_left34.png", name="shapes-left",
                alt="a cube-shaped stack of thin layers in red, green and blue patterns"),
      gallery=[g("shapes-zoom/shapes-zoom/mat_file.png", "shapes-file", "file camera")])

piece(slug="beetle", title="beetle", year="2021", made_with=["blender"], lead=False, order=42, tags=T,
      hero=dict(src="characters-2021/beetle/mat_file.png", name="beetle-file",
                alt="a green and yellow beetle character with antennae and a blue face"),
      gallery=[g("characters-2021/beetle/mat_left34.png", "beetle-left", "beetle4")])

piece(slug="modular-walls", title="modular walls", year="2020 to 2021", made_with=["blender"], lead=False, order=43,
      tags=T,
      hero=dict(src="modular-walls/uvdemo/mat_left34.png", name="uvdemo-left",
                alt="a hotel interior block with a red patterned carpet and gold trim"),
      gallery=[g("modular-walls/hotel-walls/mat_left34.png", "hotel-walls-left", "modeularHotelWalls"),
               g("modular-walls/snow/mat_left34.png", "snow-left", "snow mesh"),
               g("modular-walls/level2/mat_left34.png", "level2-left", "level2")])

piece(slug="misc-sketches", title="misc", year="2023 to 2026", made_with=["blender"], lead=False, order=44, tags=T,
      hero=dict(src="misc-sketches/cool-shapes/mat_left34.png", name="cool-shapes-left",
                alt="a tall tower of black frames and glass shapes"),
      gallery=[g("misc-sketches/e1/mat_left34.png", "e1-left", "E1"),
               g("misc-sketches/e1/mat_file.png", "e1-file"),
               g("misc-sketches/chick/mat_left34.png", "chick-left", "chick1"),
               g("misc-sketches/playing-scene-1/mat_left34.png", "playing-scene-left", "playing scene 1")])
