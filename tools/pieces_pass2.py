"""What goes onto the site from the second render pass. Read by make_pieces.py.
Paths are relative to renders/. Captions are factual only (file names, dates); no prose in Dani's voice."""

PIECES = []


def piece(**kw):
    PIECES.append(kw)
    return kw


def g(src, name, caption=None):
    return dict(src=src, name=name, caption=caption)


# ------------------------------------------------------------------ desolate churchyard (existing piece: gallery only)
CD = "church-diorama/"
piece(slug="church-diorama", extend=True, gallery=[
    g(CD + "close/mat_left34.png", "dusk-church-left", "rendered 2026"),
    g(CD + "dusk/mat_left34.png", "dusk-yard-left", "rendered 2026"),
    g(CD + "close/mat_front.png", "dusk-church-front", "rendered 2026"),
    g(CD + "dusk/mat_file.png", "dusk-gate", "rendered 2026, file camera"),
    g(CD + "dusk/mat_high.png", "dusk-yard-high", "rendered 2026"),
    g(CD + "close/mat_right34.png", "dusk-church-right", "rendered 2026"),
    g(CD + "dusk/mat_front.png", "dusk-yard-front", "rendered 2026"),
    g(CD + "dusk/mat_low.png", "dusk-yard-low", "rendered 2026"),
    g(CD + "orbit/turntable.mp4", "orbit"),
    g(CD + "orbit-church/turntable.mp4", "orbit-church"),
    dict(strip=[CD + "prog-20/mat_left34.png", CD + "prog-22Cheat/mat_left34.png",
                CD + "prog-34/mat_left34.png", CD + "prog-49/mat_left34.png"],
         name="progression", cols=2, cell=(900, 675),
         caption="church20, church22cheat, church34cheat, church49cheat, april to may 2022"),
])

# ------------------------------------------------------------------ gothic church 2025 (new lead)
GC = "gothic-church-2025/"
piece(slug="gothic-church-2025", title="gothic church", year="2025", made_with=["blender"], lead=True, order=2.5,
      tags=["rendered 2026"],
      hero=dict(src=GC + "orbit/turntable.mp4", name="turntable", poster=GC + "dusk/mat_left34.png"),
      credits=["textures on the small church generated with ai"],
      gallery=[
          g(GC + "dusk/mat_left34.png", "dusk-left"),
          g(GC + "dusk/mat_front.png", "dusk-front"),
          g(GC + "dusk/mat_right34.png", "dusk-right"),
          g(GC + "dusk/mat_high.png", "dusk-high"),
          g(GC + "dusk/mat_back34.png", "dusk-back"),
          g(GC + "dusk/mat_low.png", "dusk-low"),
          dict(strip=[GC + "prog-%d/mat_left34.png" % n for n in (2, 4, 5, 6, 7, 8)], name="progression", cols=3,
               cell=(600, 450), caption="church2, church4, church5, church6, church7 and church8, may 2025, same camera"),
          g(GC + "day/mat_left34.png", "day-left"),
          g(GC + "day/mat_front.png", "day-front"),
          g(GC + "small-church/mat_file.png", "small-church", "small church, may 2025"),
      ])

import pieces_pass2_more  # noqa: E402,F401  (adds the rest of the pieces)
