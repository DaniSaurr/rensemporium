"""Draw the home-page map as hand-drawn SVG.

    python tools/drawmap.py            # writes static/map-wide.svg and static/map-tall.svg
    python tools/drawmap.py --seed 7   # same map, different wobble

Everything is jittered marker lines with fills printed slightly off the
outlines, like the 2019 AstroGirl UI sketches. Places are <a> groups, so
the SVG has to be inlined in the page (build.py does that) for the links
and DaniFont to work.
"""

import argparse
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

INK = "#5d5f6e"
NAVY = "#2f3552"
PINK = "#ffd6ec"
LAV = "#e6dcff"
PEACH = "#ffe0cc"
CREAM = "#fff6d8"
MINT = "#cdf5e4"
SKY = "#d4ecff"
GREEN = "#2ecc71"
PLUM = "#990066"
RUIN = "#dcd8e6"
PATH = "#fbe6cf"
WATER = "#9fc6ee"

rng = random.Random(1)
NOTES = []  # music notes around the bandstand, set per layout


# ---------- wobble primitives ----------

class Noise:
    """Smooth 1-D noise: a few sines with random phase."""

    def __init__(self, amp):
        self.terms = [(rng.uniform(0.008, 0.05), rng.uniform(0, 6.3), rng.uniform(0.4, 1)) for _ in range(3)]
        self.amp = amp

    def __call__(self, t):
        return self.amp * sum(w * math.sin(f * t + p) for f, p, w in self.terms) / 1.6


def resample(pts, closed, step):
    if closed:
        pts = pts + [pts[0]]
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / step))
        for i in range(n):
            t = i / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    if not closed:
        out.append(pts[-1])
    return out


def wobble(pts, closed=False, amp=2.2, step=15, overshoot=4):
    pts = list(pts)
    if not closed and overshoot and len(pts) >= 2:
        # marker lines run a little past their ends
        (x0, y0), (x1, y1) = pts[0], pts[1]
        d = math.hypot(x1 - x0, y1 - y0) or 1
        pts[0] = (x0 - (x1 - x0) / d * overshoot * rng.random(), y0 - (y1 - y0) / d * overshoot * rng.random())
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        d = math.hypot(x1 - x0, y1 - y0) or 1
        pts[-1] = (x1 + (x1 - x0) / d * overshoot * rng.random(), y1 + (y1 - y0) / d * overshoot * rng.random())
    rs = resample(pts, closed, step)
    nx, ny = Noise(amp), Noise(amp)
    s = 0.0
    out = []
    for i, (x, y) in enumerate(rs):
        if i:
            s += math.hypot(x - rs[i - 1][0], y - rs[i - 1][1])
        out.append((x + nx(s), y + ny(s + 400)))
    return smooth(out, closed)


def smooth(p, closed):
    """Catmull-Rom through the points, as cubic beziers."""
    if len(p) < 3:
        return "M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in p)
    pts = p + p[:2] if closed else [p[0]] + p + [p[-1]]
    d = [f"M{pts[1][0]:.0f},{pts[1][1]:.0f}"]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{c1[0]:.0f},{c1[1]:.0f} {c2[0]:.0f},{c2[1]:.0f} {p2[0]:.0f},{p2[1]:.0f}")
    if closed:
        d.append("Z")
    return " ".join(d)


def rect(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def ellipse(cx, cy, rx, ry, a0=0, a1=2 * math.pi, n=None):
    n = n or max(10, int((rx + ry) * abs(a1 - a0) / 18))
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cy + ry * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + (0 if a1 - a0 >= 6.28 else 1))]


def shape(pts, fill=None, closed=True, w=4.5, ink=INK, amp=2.2, offset=True, extra=""):
    """Outline plus a misregistered fill underneath."""
    out = []
    if fill:
        dx, dy = (rng.uniform(3, 7), rng.uniform(2, 6)) if offset else (0, 0)
        fp = [(x + dx, y + dy) for x, y in pts]
        out.append(f'<path d="{wobble(fp, True, amp * 1.6, overshoot=0)}" fill="{fill}" stroke="none"/>')
    if w:
        out.append(f'<path d="{wobble(pts, closed, amp)}" fill="none" stroke="{ink}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}/>')
    return "".join(out)


def line(*pts, w=4.5, ink=INK, amp=1.8, extra=""):
    return shape(list(pts), None, closed=False, w=w, ink=ink, amp=amp, extra=extra)


def dot(x, y, r, fill):
    return shape(ellipse(x, y, r, r, n=10), fill, w=3, amp=0.8, offset=False)


# ---------- places (drawn around 0,0 = middle of the front step) ----------

def arcade():
    s = shape(rect(-95, -175, 190, 175), PINK)
    s += shape(rect(-112, -232, 224, 58), CREAM)                       # marquee
    for i in range(7):                                                  # bulbs
        s += dot(-90 + i * 30, -203, 6, "#ffe066")
    s += shape(rect(-62, -150, 124, 78), "#3b3f63", w=4)                # screen
    s += shape([(-20, -95), (0, -128), (20, -95)], MINT, w=3, amp=1)    # little ship
    for x, y in [(-45, -135), (40, -140), (35, -95), (-40, -88)]:
        s += dot(x, y, 2.5, "#ffffff")
    s += shape(rect(-24, -60, 48, 60), LAV)                             # door
    return s


def workshop():
    s = shape(rect(-90, -125, 180, 125), PEACH)
    s += shape([(-108, -122), (0, -196), (108, -122)], LAV, closed=True)
    s += shape(rect(-42, -86, 84, 86), CREAM)                           # big doors
    s += line((0, -86), (0, 0), w=3)
    for y in (-60, -32):
        s += line((-38, y), (38, y), w=2.5)
    # wireframe cube floating over the roof
    c, k = (0, -228), 30
    f = [(c[0] - k, c[1] - k * .3), (c[0] + k * .2, c[1] - k * .6), (c[0] + k * .2, c[1] + k * .9), (c[0] - k, c[1] + k * 1.2)]
    b = [(x + k * 1.1, y - k * .45) for x, y in f]
    s += shape(f, SKY, w=3.5)
    s += shape(b, None, w=3)
    for p, q in zip(f, b):
        s += line(p, q, w=3)
    return s


def gallery():
    s = shape(rect(-100, -165, 200, 165), CREAM)
    s += shape([(-118, -162), (0, -228), (118, -162)], PEACH)
    eye = [(-70, -100)] + [(x, -100 - 46 * math.sin(math.pi * (x + 70) / 140)) for x in range(-60, 71, 10)] + \
          [(x, -100 + 40 * math.sin(math.pi * (x + 70) / 140)) for x in range(60, -71, -10)]
    s += shape(eye, "#ffffff")
    s += shape(ellipse(4, -100, 30, 30), GREEN, w=4)
    s += dot(6, -98, 12, NAVY)
    s += dot(-4, -110, 5, "#ffffff")
    s += shape(rect(-20, -45, 40, 45), PINK)
    return s


def library():
    s = shape(rect(-62, -270, 124, 270), LAV)
    s += shape([(-76, -266), (0, -330), (76, -266)], PINK)
    cols = [PINK, MINT, PEACH, SKY, CREAM, "#ffe066"]
    for row in range(4):                                                # shelves of spines
        y = -245 + row * 48
        x = -46
        while x < 40:
            wd = rng.choice((10, 12, 14, 16))
            ht = rng.choice((30, 34, 38))
            s += shape(rect(x, y + 38 - ht, wd, ht), rng.choice(cols), w=2.5, amp=0.8)
            x += wd + 2
        s += line((-50, y + 40), (50, y + 40), w=3)
    s += shape([(-22, 0), (-22, -36)] + ellipse(0, -36, 22, 20, math.pi, 2 * math.pi)[1:] + [(22, 0)], PEACH)
    return s


def lab():
    s = shape(rect(-100, -44, 200, 44), CREAM)
    s += shape([(-92, -44)] + ellipse(0, -44, 92, 96, math.pi, 2 * math.pi) + [(92, -44)], SKY)
    pts = [(14 * t * math.cos(t * 1.9) * .55, -92 + 14 * t * math.sin(t * 1.9) * .45) for t in [i / 6 for i in range(1, 30)]]
    s += line(*pts, w=3.5, ink=PLUM, amp=0.6)                           # spiral
    s += line((40, -128), (64, -190), w=4)
    s += dot(66, -196, 10, "#ffe066")
    s += shape(rect(-20, -40, 40, 40), LAV)
    return s


def bandstand():
    s = shape(ellipse(0, -8, 110, 22), PEACH)
    for x in (-80, -28, 28, 80):
        s += line((x, -18), (x * 0.95, -120), w=4)
    s += shape([(-118, -118), (0, -200), (118, -118)], MINT)
    s += shape(ellipse(0, -118, 118, 14), PINK, w=3.5)
    for x, y, r in NOTES:   # notes
        s += dot(x, y, 10 * r, NAVY)
        s += line((x + 9 * r, y), (x + 9 * r, y - 40 * r), w=3.5, ink=NAVY)
        s += line((x + 9 * r, y - 40 * r), (x + 24 * r, y - 30 * r), w=3.5, ink=NAVY)
    return s


def signpost():
    s = line((0, 0), (0, -170), w=6)
    s += shape([(-6, -160), (90, -160), (112, -143), (90, -126), (-6, -126)], CREAM, w=4)
    s += shape([(6, -118), (-86, -118), (-108, -101), (-86, -84), (6, -84)], PINK, w=4)
    s += shape([(-6, -76), (70, -76), (90, -61), (70, -46), (-6, -46)], MINT, w=4)
    return s


def ruin():
    s = shape([(-110, 0), (-110, -120), (-84, -146), (-62, -118), (-40, -160), (-14, -112), (6, -128), (6, 0)], RUIN)
    s += shape(rect(-86, -96, 26, 34), "#f4f2f8", w=3)                  # empty window
    s += shape(rect(36, -150, 30, 150), RUIN)                           # standing column
    s += shape([(84, 0), (84, -64), (98, -78), (110, -58), (116, 0)], RUIN)  # broken one
    s += shape([(28, -150), (74, -150), (74, -166), (28, -166)], "#f4f2f8", w=3.5)
    for x, r in [(-130, 10), (-30, 12), (14, 8), (136, 9)]:
        s += dot(x, -r * .7, r, RUIN)
    s += shape([(124, 0), (138, -44), (152, 0)], "#ff9a4d", w=3.5)      # the under-construction cone
    s += line((129, -16), (147, -16), w=3, ink="#ffffff")
    return s


def hill():
    s = shape([(-120, 0)] + ellipse(0, 0, 120, 70, math.pi, 2 * math.pi) + [(120, 0)], "#bfeccf")
    s += shape([(-15, 0), (-15, -22)] + ellipse(0, -22, 15, 14, math.pi, 2 * math.pi)[1:] + [(15, 0)], PLUM, w=3.5)
    s += shape(rect(18, -30, 12, 10), "#ffe066", w=2.5, amp=0.6)        # padlock
    s += shape(ellipse(24, -32, 5, 6, math.pi, 2 * math.pi), None, closed=False, w=2.5, amp=0.4)
    return s


def tree(r):
    s = line((0, 0), (0, -r * 1.2), w=5)
    s += shape(ellipse(0, -r * 1.6, r, r * .9), rng.choice((MINT, "#bfeccf", "#d9f7c8")), w=4, amp=2.6)
    return s


# ---------- flagship places (the worlds of particular projects) ----------

STONE = "#dcd7e6"
ROOF = "#e9846f"
GOLD = "#ffd75e"
SAND = "#fff0c8"
ISLE = "#cdeec0"


def hotel():
    """hotel for fancy creatures: a tall hotel, every window a different room"""
    s = shape(rect(-82, -262, 164, 262), PEACH)
    s += shape(rect(-96, -282, 192, 26), LAV)                           # cornice
    s += shape([(-30, -282), (-30, -308), (30, -308), (30, -282)], PINK, w=4)
    s += shape(ellipse(0, -308, 30, 22, math.pi, 2 * math.pi) + [(30, -308)], GOLD, w=4)   # little dome
    cols = [PINK, MINT, SKY, CREAM, LAV, "#ffe066", "#ffc4b0"]
    faces = {(0, 1), (2, 3), (1, 4)}
    for r in range(5):
        for c in range(3):
            x, y = -64 + c * 46, -240 + r * 40
            s += shape(rect(x, y, 34, 28), rng.choice(cols), w=3, amp=0.8)
            if (c, r) in faces:                                         # somebody's in
                s += dot(x + 11, y + 13, 2.6, NAVY) + dot(x + 23, y + 13, 2.6, NAVY)
    s += shape(rect(-26, -40, 52, 40), CREAM)                           # door
    s += shape([(-40, -40), (-34, -56), (34, -56), (40, -40)], PINK, w=3.5)   # awning
    return s


def churchyard():
    """desolate churchyard: red-roofed church, stained glass, ivy, graves, a dead tree"""
    bark = "#6e5f5a"
    s = line((118, 0), (118, -96), (98, -128), w=4.5, ink=bark)                # dead tree
    s += line((118, -96), (140, -138), w=4, ink=bark) + line((118, -60), (140, -78), w=3.5, ink=bark)
    s += shape(rect(-78, -112, 156, 112), STONE)
    s += shape([(-92, -108), (0, -178), (92, -108)], ROOF)
    s += shape([(-18, -60), (-18, -86)] + ellipse(0, -86, 18, 18, math.pi, 2 * math.pi)[1:] + [(18, -60)], "#ffe066", w=3.5)
    s += line((0, -102), (0, -60), w=2.5) + line((-18, -78), (18, -78), w=2.5)            # glass leading
    s += dot(-9, -70, 4, "#7fb6ff") + dot(9, -70, 4, "#ff7fa8")
    s += shape(rect(-16, -40, 32, 40), "#8a6a5a", w=3.5)
    for x, y, r in [(-70, -90, 16), (-58, -62, 14), (-72, -36, 15), (-52, -100, 10)]:     # ivy
        s += shape(ellipse(x, y, r, r * 0.8), "#8fd18a", w=2.5, amp=1.2)
    for x in (-128, -104, 88):                                                              # graves
        s += shape([(x, 0), (x, -26)] + ellipse(x + 9, -26, 9, 9, math.pi, 2 * math.pi)[1:] + [(x + 18, 0)], STONE, w=3)
    for x in range(-150, -84, 12):                                                          # railings
        s += line((x, 2), (x, -18), w=2.5)
    return s


def zoo_gate():
    """dungeonzoo: the golden gate, with someone peeking through"""
    s = shape(ellipse(46, -40, 30, 26), PINK, w=3.5)                                       # a pet behind the bars
    s += dot(36, -46, 5, NAVY) + dot(56, -46, 5, NAVY)
    s += shape(rect(-100, -150, 30, 150), GOLD)
    s += shape(rect(70, -150, 30, 150), GOLD)
    s += shape([(-108, -150)] + ellipse(0, -150, 108, 62, math.pi, 2 * math.pi) + [(108, -150)], GOLD)
    s += shape(ellipse(0, -164, 22, 22), CREAM, w=3.5)
    s += shape(ellipse(0, -164, 11, 11), MINT, w=3)
    for x in range(-56, 70, 22):
        s += line((x, 0), (x, -140), w=3.5)
    s += line((-70, -112), (70, -112), w=3.5)
    return s


def palm(x, y, k=1):
    s = line((x, y), (x + 6 * k, y - 34 * k), (x + 4 * k, y - 62 * k), w=4.5, ink="#a07a50")
    for ang in (-2.6, -2.0, -1.2, -0.5, 0.2):
        ex, ey = x + 4 * k + math.cos(ang) * 34 * k, y - 62 * k + math.sin(ang) * 22 * k
        s += shape([(x + 4 * k, y - 62 * k), ((x + 4 * k + ex) / 2, min(y - 62 * k, ey) - 10 * k), (ex, ey)], "#8fd18a", closed=False, w=4)
    return s


def pet_archipelago():
    """petislands: a little archipelago, with pets on the beach"""
    s = ""
    for x, y, rx, ry in [(-96, 10, 84, 30), (74, -24, 74, 28), (6, 62, 62, 22)]:
        s += shape(ellipse(x, y + 8, rx + 16, ry + 10), None, w=3, ink=WATER, extra=' stroke-dasharray="2 12"')
        s += shape(ellipse(x, y, rx, ry), SAND, w=4)
        s += shape(ellipse(x, y - 4, rx * 0.66, ry * 0.55), ISLE, w=3, amp=1.4)
    s += palm(-110, 0) + palm(86, -32, 0.85)
    s += shape(ellipse(-60, -8, 22, 18), "#ffb3d1", w=3.5)
    s += dot(-67, -12, 3.5, NAVY) + dot(-53, -12, 3.5, NAVY)
    s += shape(ellipse(20, 52, 16, 13), "#b3e5ff", w=3)
    s += dot(15, 49, 2.6, NAVY) + dot(25, 49, 2.6, NAVY)
    return s


def stump_isle():
    """whitethorn: an island with the stump, still putting out thorns and blossom"""
    bark = "#6e5f5a"
    s = shape(ellipse(0, 6, 150, 44), ISLE)
    s += shape([(-40, -6), (-34, -74), (30, -74), (40, -6)], "#b48a68")
    s += shape(ellipse(-2, -74, 32, 10), "#e8cfa8", w=3.5)
    s += shape(ellipse(-2, -74, 16, 5), None, w=2, ink="#a07a50", amp=0.5)
    s += line((18, -74), (44, -112), (70, -128), w=4, ink=bark) + line((44, -112), (36, -140), w=3.5, ink=bark)
    for x, y in [(30, -94), (56, -120), (40, -128)]:
        s += line((x, y), (x + 9, y - 6), w=2.5, ink=bark)                     # thorns
    for x, y in [(70, -130), (36, -142), (60, -110), (50, -136), (78, -120)]:
        s += dot(x, y, 7, "#ffffff") + dot(x, y, 2.5, "#ff9ec4")               # blossom
    return s


def thou_isle():
    """hound of ulster: the island from the game, a beach and a boat"""
    s = shape(ellipse(0, 8, 150, 46), SAND)
    s += shape([(-120, 0), (-90, -40), (-30, -60), (40, -54), (100, -30), (124, 0)], ISLE, w=4)
    s += shape([(-60, -36), (-50, -96), (-30, -96), (-24, -40)], STONE, w=4)                # standing stone
    s += shape([(40, 18), (128, 18), (112, 40), (56, 40)], "#a07a50", w=4)                   # boat
    s += line((86, 18), (86, -42), w=3.5)
    s += shape([(88, -40), (88, 10), (122, 10)], CREAM, w=3.5)
    return s



def watched_town():
    """watched town: a little island town, and the winged watcher on the tallest roof"""
    s = shape(ellipse(0, 8, 150, 44), ISLE)
    houses = [(-104, 0, 50, 46, PEACH), (-46, 0, 56, 74, CREAM), (20, 0, 50, 52, LAV), (78, 0, 44, 40, PINK)]
    for x, y, w, h, col in houses:
        s += shape(rect(x, y - h, w, h), col, w=3.5)
        s += shape([(x - 6, y - h), (x + w / 2, y - h - 28), (x + w + 6, y - h)], ROOF, w=3.5)
        s += shape(rect(x + w / 2 - 6, y - 16, 12, 16), "#8a6a5a", w=2.5, amp=0.6)
    # the watcher, perched on the tall house
    cx, cy = -18, -112
    s += shape([(cx - 8, cy), (cx - 46, cy - 30), (cx - 30, cy - 4), (cx - 52, cy - 8), (cx - 14, cy + 8)], "#5d5f6e", w=3)
    s += shape([(cx + 8, cy), (cx + 46, cy - 30), (cx + 30, cy - 4), (cx + 52, cy - 8), (cx + 14, cy + 8)], "#5d5f6e", w=3)
    s += shape(ellipse(cx, cy + 4, 11, 15), "#3b3f63", w=3)
    s += dot(cx - 4, cy - 2, 2.4, "#ffe066") + dot(cx + 4, cy - 2, 2.4, "#ffe066")
    return s



def toolshed():
    """tools: a shed with a hammer and a wrench crossed on the front"""
    s = shape(rect(-86, -118, 172, 118), CREAM)
    s += shape([(-100, -114), (-60, -168), (100, -150), (100, -114)], SKY)
    s += shape(rect(-24, -64, 48, 64), PEACH)                                  # door
    s += dot(14, -32, 3.5, NAVY)
    # wrench
    s += line((-70, -24), (-30, -96), w=6, ink="#8a8fa8")
    s += shape(ellipse(-28, -100, 11, 11), "#c9cde0", w=3.5)
    s += dot(-28, -104, 4.5, CREAM)
    # hammer
    s += line((70, -24), (36, -92), w=6, ink="#a07a50")
    s += shape([(22, -98), (40, -112), (58, -96), (42, -84)], "#8a8fa8", w=3.5)
    return s



def sailboat(sail, flip=False):
    """a little boat for the open water; it rocks when you hover (css .boat)"""
    k = -1 if flip else 1
    s = shape([(-46 * k, -8), (46 * k, -8), (30 * k, 14), (-30 * k, 14)], "#c99a6e", w=4)   # hull
    s += line((-36 * k, -2), (36 * k, -2), w=2.5, ink="#8a6a5a")
    s += line((2 * k, -8), (2 * k, -78), w=4)                                            # mast
    s += shape([(6 * k, -74), (6 * k, -14), (40 * k, -14)], sail, w=3.5)                 # sail
    s += shape([(-2 * k, -74), (-2 * k, -24), (-28 * k, -24)], CREAM, w=3)               # jib
    s += shape([(2 * k, -78), (2 * k, -92), (20 * k, -85)], PINK, w=2.5, amp=0.6)         # flag
    return s


PLACES = {
    # key: (drawing, label, href, label size, scale)
    "games": (arcade, "games", "games/", 46, 1),
    "3d": (workshop, "3d", "3d/", 46, 1),
    "drawings": (gallery, "drawings", "drawings/", 46, 1),
    "experiments": (lab, "experiments", "experiments/", 40, 1),
    "sound": (bandstand, "sound", "sound/", 40, 1),
    "tools": (toolshed, "tools", "tools/", 38, .82),
    "gazetteer": (signpost, "gazetteer", "gazetteer/", 34, 1),
    "old": (ruin, "the old emporium", "https://rensemporium.neocities.org/", 30, 1),
    "private": (hill, "private", "writing/private/", 22, 1),
    # the worlds of particular projects
    "hotel": (hotel, "the hotel", "games/hotel-for-fancy-creatures/", 30, .8),
    "churchyard": (churchyard, "desolate churchyard", "3d/church-diorama/", 28, .78),
    "zoo": (zoo_gate, "dungeonzoo", "games/dungeonzoo/", 30, .8),
    "petislands": (pet_archipelago, "petislands", "games/petislands/", 30, .9),
    "whitethorn": (stump_isle, "whitethorn", "games/whitethorn/", 30, .85),
    "thou": (thou_isle, "hound of ulster", "games/hound-of-ulster/", 28, .85),
    "watched": (watched_town, "watched town", "games/watched-town/", 28, .62),
}
SEA = {"old", "petislands", "whitethorn", "thou", "watched"}  # reached by dotted ferry lines, not paths

LAYOUTS = {
    "wide": {
        "size": (1900, 1220),
        "island": (930, 620, 700, 450),
        "plaza": (930, 680),
        "pos": {"experiments": (930, 320), "games": (470, 450), "tools": (700, 345), "3d": (1425, 450), "churchyard": (1180, 325),
                "gazetteer": (930, 710), "hotel": (700, 800), "zoo": (1160, 810), "private": (1590, 660),
                "drawings": (470, 920), "sound": (930, 1050),
                "petislands": (200, 200), "thou": (1730, 210), "whitethorn": (210, 1090), "old": (1730, 1100),
                "watched": (112, 650)},
        "islet": (1730, 1105, 150, 60),
        "boats": [(600, 100, PINK, False, .8), (1430, 95, MINT, True, .7), (90, 450, SKY, False, .7),
                  (1815, 610, PEACH, True, .75), (1150, 1170, LAV, False, .7)],
        "notes": [(-34, -226, .55), (16, -244, .6), (58, -222, .5)],
        "trees": [(300, 650, 24), (255, 750, 18), (1560, 520, 20), (1540, 820, 18),
                  (1110, 1060, 18), (745, 1060, 22), (1060, 560, 16), (790, 560, 16)],
    },
    "tall": {
        "size": (800, 2420),
        "island": (400, 1150, 385, 930),
        "plaza": (400, 1250),
        "pos": {"experiments": (400, 420), "games": (215, 760), "3d": (595, 770), "churchyard": (590, 1020),
                "hotel": (210, 1110), "gazetteer": (400, 1270), "private": (165, 1300),
                "drawings": (215, 1560), "zoo": (235, 1820), "sound": (440, 1975), "tools": (650, 1800),
                "petislands": (190, 150), "thou": (610, 160), "whitethorn": (150, 2150), "old": (640, 2160),
                "watched": (395, 2310)},
        "islet": (640, 2165, 150, 50),
        "boats": [(405, 85, PINK, False, .7), (95, 2350, MINT, True, .65), (720, 2360, SKY, False, .65)],
        "notes": [(-40, -246, .8), (32, -270, .9), (80, -238, .7)],
        "trees": [(130, 520, 22), (660, 520, 24), (330, 900, 16), (480, 910, 16), (330, 1410, 18), (480, 1410, 18),
                  (110, 1930, 20), (690, 1820, 20)],
    },
}


def coast(cx, cy, rx, ry):
    n = Noise(0.07)
    ph = [rng.uniform(0, 6.3) for _ in range(3)]
    pts = []
    for i in range(96):
        a = 2 * math.pi * i / 96
        k = 1 + n(a * 60) + 0.045 * math.sin(3 * a + ph[0]) + 0.03 * math.sin(5 * a + ph[1]) + 0.018 * math.sin(9 * a + ph[2])
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    return pts


def label(x, y, text, size, key):
    cls = "lbl lbl-small" if key in ("private", "old") else "lbl"
    return (f'<text class="{cls}" x="{x}" y="{y}" text-anchor="middle" font-size="{size}">{text}</text>')


def draw(layout):
    L = LAYOUTS[layout]
    W, H = L["size"]
    out = [f'<svg class="map map-{layout}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" '
           f'aria-label="a map of ren\'s emporium">']

    # water ripples
    for _ in range(int(W * H / 26000)):
        x, y = rng.uniform(30, W - 60), rng.uniform(30, H - 30)
        cx, cy, rx, ry = L["island"]
        if ((x - cx) / (rx + 60)) ** 2 + ((y - cy) / (ry + 60)) ** 2 < 1:
            continue
        out.append(line((x, y), (x + 14, y - 6), (x + 28, y), (x + 42, y - 6), w=3, ink=WATER, amp=1))

    # boats on the open water (decoration; they rock on hover)
    for bx, by, sail, flip, bk in L.get("boats", []):
        out.append(f'<g class="boat" transform="translate({bx},{by}) scale({bk})"><g class="rock">{sailboat(sail, flip)}</g></g>')

    # island, shallow-water ring, islet
    cx, cy, rx, ry = L["island"]
    out.append(shape(coast(cx, cy, rx + 26, ry + 26), None, w=3, ink=WATER, extra=' stroke-dasharray="2 14"'))
    out.append(shape(coast(cx, cy, rx, ry), "#eefbe6", w=5))
    ix, iy, irx, iry = L["islet"]
    out.append(shape(ellipse(ix, iy, irx, iry), "#ece8f2", w=4))

    # paths from the plaza; private gets none, the old emporium gets a dotted ferry line
    px, py = L["plaza"]
    for key, (x, y) in L["pos"].items():
        if key in ("gazetteer", "private"):
            continue
        if key in SEA and key != "old":
            # ferry line from the nearest bit of coast
            cx, cy, rx, ry = L["island"]
            ang = math.atan2((y - cy) / ry, (x - cx) / rx)
            ex, ey = cx + rx * 0.98 * math.cos(ang), cy + ry * 0.98 * math.sin(ang)
            pts = [(ex, ey), ((ex + x) / 2 + rng.uniform(-20, 20), (ey + y) / 2 + rng.uniform(-20, 20)), (x, y + 10)]
            out.append(f'<path d="{wobble(pts, amp=2)}" fill="none" stroke="{WATER}" stroke-width="4" stroke-dasharray="1 16" stroke-linecap="round"/>')
            continue
        bend = rng.uniform(-60, 60)
        mx, my = (px + x) / 2, (py + y) / 2
        dx, dy = y - py, px - x
        d = math.hypot(dx, dy) or 1
        mid = (mx + dx / d * bend, my + dy / d * bend)
        target = (x, y + 14)
        pts = [(px, py)] + [((1 - t) ** 2 * px + 2 * (1 - t) * t * mid[0] + t * t * target[0],
                             (1 - t) ** 2 * py + 2 * (1 - t) * t * mid[1] + t * t * target[1]) for t in [i / 12 for i in range(1, 13)]]
        if key == "old":
            out.append(f'<path d="{wobble(pts, amp=2)}" fill="none" stroke="{WATER}" stroke-width="4" stroke-dasharray="1 16" stroke-linecap="round"/>')
            continue
        out.append(f'<path d="{wobble(pts, amp=2)}" fill="none" stroke="{PATH}" stroke-width="34" stroke-linecap="round"/>')
        out.append(f'<path d="{wobble(pts, amp=2)}" fill="none" stroke="{INK}" stroke-opacity=".45" stroke-width="4" stroke-dasharray="1 18" stroke-linecap="round"/>')
    out.append(shape(ellipse(px, py + 20, 110, 46), PATH, w=4))

    for x, y, r in L["trees"]:
        out.append(f'<g transform="translate({x},{y})">{tree(r)}</g>')

    # places, back to front so lower ones overlap
    for key, (x, y) in sorted(L["pos"].items(), key=lambda kv: kv[1][1]):
        fn, text, href, size, k = PLACES[key]
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        ly = y + (size + 10 if key != "private" else 30) + (56 if key in SEA and key != "old" else 0)
        out.append(f'<a class="place place-{key}" href="{href}"{ext} aria-label="{text}">'
                   f'<g transform="translate({x},{y}) scale({k})"><g class="lift">{fn()}</g></g>'
                   f'{label(x, ly, text, size, key)}</a>')

    out.append("</svg>")
    return "\n".join(out)


def main():
    global rng, NOTES
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()
    for layout in LAYOUTS:
        rng = random.Random(args.seed)
        NOTES = LAYOUTS[layout]["notes"]
        svg = draw(layout)
        p = ROOT / "static" / f"map-{layout}.svg"
        p.write_text(svg, encoding="utf-8")
        print(p, len(svg) // 1024, "KB")


if __name__ == "__main__":
    main()
