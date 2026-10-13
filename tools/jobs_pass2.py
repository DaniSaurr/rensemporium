"""Job list for the second render pass (used by render_batch.py --set pass2).
Each job: (slug, part, path, extra args). Output goes to renders/<slug>/<part>/.
Nothing here ever writes to the source files; render_batch.py copies each one to temp first."""
import os

DOCS = r"C:\Users\AEROCOOL\Documents"
B = DOCS + r"\Blender"
M25 = B + r"\  march 2025"          # the folder name starts with two spaces
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMS = os.path.join(ROOT, "renders", "_cams")
os.makedirs(CAMS, exist_ok=True)

JOBS = []


def job(slug, part, path, *args):
    JOBS.append((slug, part, path, list(args)))


# ------------------------------------------------------------------ 2. desolate churchyard (2022)
C49 = B + r"\church49Cheat.blend"
CH_CLOSE = "collection 7,church 1,church bits"   # the church building, its windows and the yard bits
job("church-diorama", "dusk", C49, "--dusk", "--samples", "48", "--save-cams", os.path.join(CAMS, "church49.json"))
job("church-diorama", "close", C49, "--dusk", "--frame", CH_CLOSE, "--lens", "45", "--margin", "0.14",
    "--views", "front:15:10,left34:-40:12,right34:40:12,back34:150:14", "--no-file-cam", "--samples", "48")
job("church-diorama", "orbit", C49, "--dusk", "--no-stills", "--turntable", "72", "--turntable-el", "22",
    "--turntable-lens", "45", "--tsamples", "24")
job("church-diorama", "orbit-church", C49, "--dusk", "--frame", CH_CLOSE, "--margin", "0.12", "--no-stills",
    "--turntable", "72", "--turntable-el", "14", "--turntable-lens", "45", "--tsamples", "24")
for tag, f in (("20", "church20"), ("22", "church22"), ("30", "church30Cheat"), ("34", "church34Cheat"),
               ("40", "church40Cheat"), ("49", "church49Cheat")):
    job("church-diorama", "prog-" + tag, B + "\\" + f + ".blend", "--dusk", "--no-file-cam", "--samples", "40",
        "--fixed-cam", os.path.join(CAMS, "church49.json") + ":left34")

# ------------------------------------------------------------------ 3. gothic church 2025
G8 = M25 + r"\church8.blend"
G9 = M25 + r"\april 2026\church9.blend"
GAI = M25 + r"\little ai texture church.blend"
job("gothic-church-2025", "dusk", G8, "--dusk", "--hide", "plane.001", "--samples", "48",
    "--views", "front:0:8,left34:-38:14,right34:38:14,back34:150:14,low:15:2,high:-20:35",
    "--save-cams", os.path.join(CAMS, "church8.json"))
job("gothic-church-2025", "day", G8, "--relight", "--exposure", "-1.0", "--hide", "plane.001", "--samples", "48",
    "--views", "front:0:8,left34:-38:14,right34:38:14,back34:150:14")
job("gothic-church-2025", "orbit", G8, "--dusk", "--hide", "plane.001", "--no-stills", "--turntable", "72",
    "--turntable-el", "10", "--turntable-lens", "55", "--tsamples", "32")
for n in range(2, 9):
    job("gothic-church-2025", "prog-%d" % n, M25 + "\\church%d.blend" % n, "--dusk", "--hide", "plane.001",
        "--no-file-cam", "--samples", "40", "--fixed-cam", os.path.join(CAMS, "church8.json") + ":left34")
job("gothic-church-2025", "church9", G9, "--dusk", "--samples", "40", "--views", "front:0:8,left34:-38:14")
job("gothic-church-2025", "small-church", GAI, "--samples", "48", "--views", "left34:-38:14,right34:38:14")

# ------------------------------------------------------------------ 4. broader pass (own work not yet on the site)
J26 = B + r"\july 2026"
JUN = B + r"\jun 2026"
G3D = DOCS + r"\Godot 2026 plans\3D models"
MAY22 = B + r"\May 2022 2"
DEC20 = B + r"\December 2020"
OCT = B + r"\October 2020"

# july 2026 experiments
for part, f in (("gorger", J26 + r"\gorger2.blend"),
                ("exploded-view", J26 + r"\exploded view.blend"),
                ("fractal-1", J26 + r"\splitting fractal\Untitled1.blend"),
                ("fractal-0", J26 + r"\splitting fractal\Untitled.blend"),
                ("greentower", J26 + r"\splitting fractal\greentower-col.blend")):
    job("july-2026", part, f)

# godot 3d models (single-object kit files with one shared atlas)
for part, f in (("mountain", "mountain"), ("medium-tree", "medium_tree"), ("tree-and-log", "tree and fell log"),
                ("spiky-rock-1", "SpikyRock1"), ("spiky-rock-2", "SpikyRock2"), ("spiky-rock-3", "SpikyRock3"),
                ("spiky-rock-4", "SpikyRock4"), ("book", "book"), ("bricks", "bricks"), ("crabblock", "crabblock"),
                ("medium-twig", "medium_twig"), ("small-twig", "small_twig")):
    job("godot-3d-models", part, G3D + "\\" + f + ".blend")

# texture doodle (cat and crow)
job("texture-doodle", "animals", JUN + r"\texture doodle\animal exports .blend")
job("texture-doodle", "cat", JUN + r"\texture doodle\animal exports cat  .blend")
job("texture-doodle", "untitled", JUN + r"\texture doodle\Untitled.blend")

# face medals, pillar, shapes
job("face-medals", "faces", JUN + r"\face medals\faces.blend")
for part, f in (("pillar3", "pillar3"), ("pillar2", "pillar2"), ("pillar1", "pillar1")):
    job("pillar", part, JUN + "\\pillar\\" + f + ".blend")
for part, f in (("shapes-zoom", JUN + r"\shapes zoom .blend"), ("hexashape", JUN + r"\hexashape.blend"), ("camera-shapes", B + r"\may 2025\camera shapes fun .blend")):
    job("shapes-zoom", part, f)

# mecha study (2021)
for part, f in (("9color", "mechaStudy(CarveTool)9COLOR"), ("8color", "mechaStudy(CarveTool)8COLOR"),
                ("7color", "mechaStudy(CarveTool)7COLOR"), ("psoing", "mechaStudyPSOING"),
                ("6-colours", "mechaStudy6-Colours"), ("wip", "mechstudyWIP"), ("manashpere", "manashpere ")):
    job("mecha-study", part, B + "\\" + f + ".blend")

# low poly 2023
for part, f in (("boots-guy", "boots guy 3"), ("bull-guy", "bull guy 3"), ("boofer", "July 2023\\boofer 4"),
                ("silly-dog", "silly dog dance"), ("harpoon", "harpoon "), ("big-sword", "big sword"),
                ("bridge", "bridge2"), ("plane-3", "plane LOWPOLY 3"), ("plane-5", "plane LOWPOLY 5"),
                ("chesta", "chesta1"), ("silly-scene", "silly scene2"), ("shield", "bad shield thing ")):
    job("low-poly-2023", part, B + "\\" + f + ".blend")

# hffc hotel, node textured plane (2022)
for part, f in (("hotel", "hffc hotel "), ("hotel-5", "hffc hotel 5"), ("ribbed-cage", "ribbed cage"),
                ("brick-wall", "material maker brick wall")):
    job("hffc-hotel", part, MAY22 + "\\" + f + ".blend")
for part, f in (("plane-8", "node based textured plane8"), ("plane-6", "node based textured plane6"),
                ("plane-4", "node based textured plane4"), ("plane-2", "node based textured plane2")):
    job("node-textured-plane", part, MAY22 + "\\" + f + ".blend")

# modular walls (Dec 2020) and test buildings (Oct 2021)
for part, f in (("level3", DEC20 + r"\level3.blend"), ("hotel-walls", DEC20 + r"\modeularHotelWalls.blend"),
                ("uvdemo", DEC20 + r"\UVDemo.blend"), ("level2", DEC20 + r"\level2.blend"),
                ("snow", DEC20 + r"\FinishedWalls+\SnowScene\SnowMesh.blend"),
                ("dirt-and-snow", DEC20 + r"\FinishedWalls+\DirtandSnow.blend"),
                ("door", DEC20 + r"\FinishedWalls+\Door.blend"),
                ("test-building", B + r"\Octover 2021\test Building.blend"),
                ("window", B + r"\Octover 2021\window2.blend")):
    job("modular-walls", part, f)

# small characters (2021)
for part, f in (("tophat-timmy", B + r"\jULY 2021\Tophat Timmy\Tophat Timmy_sitting.blend"),
                ("beetle", B + r"\august 2021\beetle4.blend"), ("emilia", B + r"\august 2021\emilia.blend"),
                ("funny-little-guy", B + r"\august 2021\funny little guy.blend"),
                ("gallemblock", B + r"\jULY 2021\gallemblock.2blend.blend"),
                ("mechthing", B + r"\Janyuary 2021\mechThing.blend"),
                ("personbase", B + r"\Janyuary 2021\personBase.blend")):
    job("characters-2021", part, f)

# street corner (Nov 2020)
for part, f in (("blockout7", "blockout7"), ("blockout6", "blockout6"), ("scene", "Scene"), ("walsh5", "walshBuilding5")):
    job("street-corner", part, B + r"\November 2020\%s.blend" % f)

# wooden dwelling, early 2018, misc (2/5: judged from the contact sheets)
job("wooden-dwelling", "dwelling2", JUN + r"\ANCIENTHOUSE\wooden dwelling2.blend")
job("wooden-dwelling", "dwelling1", JUN + r"\ANCIENTHOUSE\wooden dwelling1.blend")
for part, f in (("donut2", r"Donut 1.07.18\Donut2"), ("rocks", r"Rocks 6.07.18\RocksCircle"),
                ("eyebot", r"EyeBot 2.07.18\EyeBot"), ("house", r"House 6.07.18\House"),
                ("lizard", r"Lizard 3.07.18\Lizard"), ("tsuchiniko", r"Tsuchiniko 4.07.18\Tsuchiniko"),
                ("little-scene", r"Misc\little scene"), ("staff", r"Staff 10.07.18\staff"),
                ("mossy-pillar", r"Misc\Mossy Pillar")):
    job("first-steps-2018", part, B + "\\" + f + ".blend")
for part, f in (("trash-camel", r"May 2024\trash camel "), ("chick", r"January 2023\chick1"),
                ("cool-shapes", "IDK COOL SCHAPES"), ("e1", r"MARCH 2024\E1"), ("feet", r"MARCH 2024\feet")):
    job("misc-sketches", part, B + "\\" + f + ".blend")
for part, f in (("playing-scene-1", r"APRIL 2025\playing scene 1"), ("thomas-blockout", r"jun 2026\thomas\blockout "),
                ("frontfence", r"Feb 2025\frontfence1")):
    job("misc-sketches", part, B + "\\" + f + ".blend")

# desolate churchyard extras
job("church-diorama", "bake-test", B + r"\baking church test 2.blend", "--dusk", "--views", "left34:-42:20,front:0:16")

# spooktober 2020: the final version of every character not rendered in pass 1
SPOOK = [("raven", "RAVEN4"), ("alien", "alien"), ("alien4", "alien4"), ("antique", "antique"), ("armour-test", "armourTest"),
         ("cat", "cat3"), ("clown", "clown3"), ("scarecrow", "day2_scarecrowRender"), ("demon", "demon"),
         ("fur-test", "furTest"), ("hellcat", "hellCat"), ("jackalope", "jackalope2"), ("knight", "knight5"),
         ("minstrels", "minstrels"), ("monster", "monster"), ("mummy", "mummy2"), ("mythological", "mythological2"),
         ("psychic", "psychic"), ("puppet", "puppet2"), ("siren", "siren"), ("spider", "spider"),
         ("spider-witch", "spider&witch"), ("witch-spider", "witch&spider"), ("vampire", "vampire"),
         ("werewolf", "werewolf"), ("witches", "witches5"), ("zombie", "zombie5"), ("trim", "seriousTRim"),
         ("heavenhound", "heavenHound"), ("hellhound-rigged", "Hellhoundrigged")]
for part, f in SPOOK:
    job("spooktober-2020", part, OCT + "\\" + f + ".blend")
