# content

Each piece on the site is one folder: `content/<branch>/<slug>/`. The branches are `games`, `3d`, `drawings`, `writing`, `experiments` and `sound`. Slugs are lowercase-with-dashes. Run `python tools/build.py` to build the site into `_site/`.

## piece.toml

```toml
title = "cosmic crash"            # lowercase, as Dani writes titles
year = "2019, 2026"               # free text: "2020", "2018 to 2026"
updated = "2026-05-21"            # last real change to the project (not renders or views); rooms sort newest first by this
made_with = ["unreal 4.23", "javascript"]   # becomes the "made with" logo row at the foot of the page (see TOOLS in tools/build.py)
lead = true                       # true = big card on the branch page; false = "older stuff" shelf
order = 1                         # no longer used for sorting (rooms sort by `updated`)
blurb = ""                        # one line for the card. Use Dani's own words (old site text) or leave it empty.
caption = ""                      # optional paragraph under the hero. Same rule.
thumb = "hero.jpg"                # card picture, a file in this folder
hero = { type = "image", src = "hero.jpg", alt = "..." }
#      type is "image", "video" (mp4/webm, autoplays muted and loops, optional poster), "iframe",
#      "audio": hero = { type = "audio", src = "song.mp3", poster = "cover.jpg" }  (poster optional)
#      or "youtube": hero = { type = "youtube", id = "12HtBL1r9FQ" }  (gallery items can be { youtube = "id" } too)
links = [ { label = "play", href = "play/" } ]       # first one is the green button; add big = true for a large one
tags = ["college project"]        # optional plain tags
ai = [ { tool = "claude", models = ["opus 5.5"] } ]  # adds a claude logo to the "made with" row; models show on hover
facts = [["status", "in progress, v0.05"], ["plays on", "windows"]]   # optional small facts row under the title
credits = ["unity version (2018): niall, programming; hayley, music"]
gallery = [
  { src = "a.jpg", caption = "optional" },
  { src = "b.png", contain = true },   # contain = don't crop (transparent sprites, sketches)
  { src = "loop.mp4" },                # videos work in the gallery too
  { src = "c.jpg", group = "unity version" },   # consecutive items sharing a group get a small heading
]
draft = true                      # optional: only shows in local builds (serve.bat / build.py --drafts), never published
versions = [ { label = "first version", date = "9 july 2026", href = "v/first/", shot = "v-first.jpg" } ]   # optional: playable older versions, shown as small cards
dev = [ { src = "wip-01.png", caption = "march 2024" } ]   # optional "in progress" strip: mid-development shots, same format as gallery
```

Optional `body.html` holds longer text as plain HTML (`<h2>`, `<p>`, `<figure>`). Any subfolder, such as `play/` for a browser game, is copied as it is.

## rules

- **Copy only.** Never move, rename or edit anything in Dani's own folders, or on the X: drive.
- **Size.** Resize stills to 1800 px wide at most when copying (JPEG q85 for photos and renders, PNG for pixel art and flat colour). Loops: under 8 MB, 720p, H.264 mp4 with no audio. Longer videos: under 25 MB. Game audio: convert WAV to OGG (q5).
- **Words.** Don't write prose in Dani's voice. Blurbs and captions are either Dani's own words (from the old site in `inventory/neocities/mirror/`, or their own docs) or left empty. Short factual gallery captions such as "hud sketch, 2019" are fine.
- **AI tags.** Look the project folder up in `inventory/provenance.csv` and list the models with real message counts. Leave out haiku 4.5 and codex-auto-review. For work done in ChatGPT on the web (anything from "chatgpt export - Copy" with no Claude or Codex rows), use `{ tool = "gpt" }` with no models.
- **Never copy** chat logs, other people's art, or personal photos and videos.
- **Credit third-party assets** in `credits` if a game uses them (Kenney, Quaternius, Sunny Land and so on).
