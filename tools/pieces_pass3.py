"""Pass 3 pieces: mesh exports, X: drive sculpts, textured re-renders. Paths are relative to renders/.
Run: python tools/make_pieces3.py [slug ...]   (writes only NEW folders under content/3d/; refuses to touch existing ones)"""

PIECES = []
T = ["rendered 2026"]


def piece(**kw):
    PIECES.append(kw)
    return kw


def g(src, name, caption=None):
    return dict(src=src, name=name, caption=caption)


# ------------------------------------------------------------------ robot head sculpt (2019)
R = "robot-head-sculpt/"
piece(slug="robot-head-sculpt", title="robot head sculpt", year="2019", made_with=["blender"], lead=False, order=50, tags=T,
      hero=dict(src=R + "orbit/turntable.mp4", name="turntable", poster=R + "highsculpt/clay_front.png"),
      gallery=[
          g(R + "highsculpt/clay_front.png", "high-front", "high sculpt"),
          g(R + "pair/clay_left34.png", "low-and-high-left", "low poly and high poly sculpt, october 2019"),
          g(R + "highsculpt/clay_left34.png", "high-left", "high sculpt"),
          g(R + "lowsculpt/clay_left34.png", "low-left", "low sculpt"),
          g("sculpts-x-drive/dynamesh-robot3/clay_low.png", "dynamesh-front", "dynamesh robot 3"),
          dict(strip=["robot-head-sculpt/done-robot2/mat_left34.png", "robot-head-sculpt/done-robot3/mat_left34.png",
                      "robot-head-sculpt/done-robot-high/mat_left34.png"],
               name="done-robot-tiers", cols=3, cell=(640, 480),
               caption="done robot, three levels of detail: about 3 thousand, 97 thousand and 1.4 million vertices, july 2019"),
          g(R + "done-robot-high/mat_front.png", "done-robot-front", "done robot high res"),
          g(R + "done-robot-high/clay_left34.png", "done-robot-clay", "done robot high res, clay"),
          g(R + "snakehead/mat_front.png", "snake-head-front", "snake head"),
          g(R + "snakehead/mat_left34.png", "snake-head-left", "snake head"),
          g(R + "snakehead/clay_left34.png", "snake-head-clay", "snake head, clay"),
      ])

# ------------------------------------------------------------------ cursed emoji (2019)
C = "cursed-emoji/"
piece(slug="cursed-emoji", title="cursed emoji", year="2019", made_with=["maya", "blender"], lead=False, order=51, tags=T,
      hero=dict(src=C + "orbit/turntable.mp4", name="turntable", poster=C + "obj1/mat_front.png"),
      gallery=[
          g(C + "obj1/mat_front.png", "painted-front", "painted"),
          dict(strip=[C + "base/clay_left34.png", C + "sculpt1/clay_left34.png", C + "sculpt7/clay_left34.png",
                      C + "obj1/clay_left34.png"],
               name="sculpt-progression", cols=2, cell=(800, 600),
               caption="base mesh, sculpt 1, sculpt 7 and the final sculpt, october 2019"),
          g(C + "obj1/mat_left34.png", "painted-left", "painted"),
          g(C + "obj1/mat_right34.png", "painted-right"),
          g(C + "obj1/clay_front.png", "final-clay-front", "final sculpt, clay"),
          g(C + "sculpt7/clay_front.png", "sculpt7-front", "sculpt 7"),
          g(C + "sculpt1/clay_front.png", "sculpt1-front", "sculpt 1"),
          g(C + "base/clay_front.png", "base-front", "base mesh"),
      ])

# ------------------------------------------------------------------ cosmic crash models (2019)
K = "cosmic-crash-models/"
piece(slug="cosmic-crash-models", title="cosmic crash models", year="2019", made_with=["maya"], lead=False, order=52, tags=T,
      hero=dict(src=K + "healthpickup/clay_left34.png", name="health-pickup",
                alt="two grey medical crates with raised crosses, a low poly one beside a high poly one"),
      gallery=[
          g(K + "astrogirl/clay_left34.png", "astrogirl-left", "astrogirl"),
          g(K + "astrogirl/clay_front.png", "astrogirl-front"),
          g(K + "mainship/clay_top34.png", "main-ship", "main ship, low poly and high poly"),
          g(K + "enemyship/clay_top34.png", "enemy-ship", "enemy ship, low poly and high poly"),
          g(K + "seamine/clay_front.png", "sea-mine", "sea mine, low poly and high poly"),
          g(K + "healthpickup/clay_front.png", "health-pickup-front", "health pickup, low poly and high poly"),
          g(K + "cast/clay_front.png", "cast-front", "giant, goblin, normal man, weird man and cucullain"),
          g(K + "cast/clay_left34.png", "cast-left"),
          g(K + "extras/clay_left34.png", "biplane-and-whip", "biplane and chain whip"),
          g(K + "mainship/clay_front.png", "main-ship-front"),
      ])

# ------------------------------------------------------------------ maya 2019
M = "maya-2019/"
piece(slug="maya-2019", title="maya 2019", year="2019 to 2020", made_with=["maya"], lead=False, order=53, tags=T,
      hero=dict(src=M + "cute-castle/mat_left34.png", name="cute-castle-left",
                alt="a small grey castle with blue bands on a green octagonal base"),
      gallery=[
          g(M + "castle-tower/clay_left34.png", "castle-tower-left", "castle tower modular"),
          g(M + "castle-tower/clay_front.png", "castle-tower-front"),
          g(M + "frog/mat_left34.png", "frog-left", "frog"),
          g(M + "frog/mat_front.png", "frog-front"),
          g(M + "bench/mat_left34.png", "bench-left", "bench"),
          g(M + "nibbler/mat_left34.png", "nibbler-left", "nibbler"),
          g(M + "nibbler/mat_front.png", "nibbler-front"),
          g(M + "ice-rink/mat_left34.png", "ice-rink-left", "ice rink"),
          g(M + "little-mouse-man/clay_left34.png", "little-mouse-man-left", "little mouse man, 2020"),
          g(M + "cute-castle/mat_front.png", "cute-castle-front", "cute castle"),
      ])

# ------------------------------------------------------------------ dinosaur sculpt stages (2019)
D = "sculpts-x-drive/"
piece(slug="dinosaur-stages", title="dinosaur stages", year="2019", made_with=["blender"], lead=False, order=54, tags=T,
      hero=dict(src=D + "dino-retopo/clay_left34.png", name="retopo-left",
                alt="a pale dinosaur with a curled tail, head lowered to the ground"),
      gallery=[
          dict(strip=[D + "dino1/clay_left34.png", D + "dino-downward-dog/clay_left34.png", D + "dino-retopo/clay_left34.png"],
               name="stages", cols=3, cell=(600, 450),
               caption="dinosaur1, dinosaur (downward dog) and dinosaur sculpt retopo, october 2019"),
          g(D + "dino-retopo/clay_right34.png", "retopo-right", "retopo"),
          g(D + "dino-retopo/clay_low.png", "retopo-low"),
          g(D + "dino-downward-dog/clay_right34.png", "downward-dog-right", "downward dog"),
          g(D + "dino1/clay_right34.png", "dino1-right", "dinosaur1"),
      ])

# ------------------------------------------------------------------ irish level progression (2026)
L = "irish-level/"
piece(slug="irish-level", title="irish level progression", year="2026", made_with=["blender"], lead=False, order=55, tags=T,
      hero=dict(src=L + "level11/mat_left34.png", name="level11-left",
                alt="a coastal island level with green terraces, white paths and blue water"),
      gallery=[
          dict(strip=[L + "level%d/mat_left34.png" % n for n in (5, 6, 7, 8, 10, 11)], name="progression", cols=3,
               cell=(640, 480), caption="level 5, 6, 7, 8, 10 and 11, september 2026, same camera"),
          g(L + "level11/mat_high.png", "level11-high", "level 11"),
          g(L + "level11/mat_front.png", "level11-front"),
          g(L + "level11/mat_right34.png", "level11-right"),
      ])

# ------------------------------------------------------------------ walsh building (2020)
W = "tex-fix/"
piece(slug="walsh-building", title="walsh building", year="2020", made_with=["blender"], lead=False, order=56, tags=T,
      hero=dict(src=W + "walsh5/mat_file.png", name="walsh5-file",
                alt="a red brick corner building with green trim and a dark roof"),
      gallery=[
          g(W + "walsh5/mat_right34.png", "walsh5-right", "walshBuilding5"),
          g(W + "walsh5/mat_left34.png", "walsh5-left"),
          g(W + "walsh5/mat_low.png", "walsh5-low"),
          g(W + "blockout6/mat_file.png", "blockout6-file", "blockout6, november 2020"),
          g(W + "blockout6/mat_left34.png", "blockout6-left", "blockout6"),
          g(W + "blockout6/mat_high.png", "blockout6-high"),
      ])

# ------------------------------------------------------------------ tophat timmy (2021)
piece(slug="tophat-timmy", title="tophat timmy", year="2021", made_with=["blender"], lead=False, order=57, tags=T,
      hero=dict(src=W + "tophat-timmy/mat_file.png", name="timmy-file",
                alt="a small pale skull-faced figure in a black top hat with a red band, sitting"),
      gallery=[
          g(W + "tophat-timmy/mat_right34.png", "timmy-right", "tophat timmy, sitting"),
          g(W + "tophat-timmy/mat_left34.png", "timmy-left"),
      ])

# ------------------------------------------------------------------ character blockouts (2021)
S = "clay-study/"
piece(slug="character-blockouts", title="character blockouts", year="2021", made_with=["blender"], lead=False, order=58, tags=T,
      hero=dict(strip=[S + "emilia/clay_left34.png", S + "gallemblock/clay_left34.png", S + "mechthing/clay_left34.png",
                       S + "funny-little-guy/clay_left34.png"],
                name="lineup", cols=4, cell=(450, 450),
                alt="four pale clay figures in a row: a girl with a staff, a winged child, a thin mech and a flat bird shape"),
      gallery=[
          g(S + "emilia/clay_front.png", "emilia-front", "emilia, august 2021"),
          g(S + "gallemblock/clay_front.png", "gallemblock-front", "gallemblock, july 2021"),
          g(S + "gallemblock/clay_left34.png", "gallemblock-left"),
          g(S + "mechthing/clay_left34.png", "mechthing-left", "mech thing, january 2021"),
          g(S + "funny-little-guy/clay_left34.png", "funny-little-guy-left", "funny little guy, august 2021"),
          g(S + "personbase/clay_left34.png", "personbase-left", "person base, january 2021"),
      ])
