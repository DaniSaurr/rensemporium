"""Build the AI provenance table for the portfolio site.

Metadata only. Reads model ids, working directories, timestamps, session ids
and conversation titles from the Claude Code, Codex and ChatGPT logs. Each log
line is parsed on its own and only the fields used here are kept. Message text
and tool output are never written to the outputs.

Run (from any folder):
    python -I "C:\\Users\\AEROCOOL\\Documents\\opus 5.5\\portfolio-site\\tools\\provenance.py"

Optional, repeatable:
    --chatgpt-json PATH   an extra ChatGPT conversations.json to read

Outputs, overwritten on each run:
    inventory\\provenance.csv
    inventory\\provenance.md
"""

import argparse
import collections
import csv
import datetime as dt
import glob
import json
import os
import re
import tomllib

HOME = r"C:\Users\AEROCOOL"
SITE = os.path.join(HOME, "Documents", "opus 5.5", "portfolio-site")
INVENTORY = os.path.join(SITE, "inventory")
OUT_CSV = os.path.join(INVENTORY, "provenance.csv")
OUT_MD = os.path.join(INVENTORY, "provenance.md")

CLAUDE_PROJECTS = os.path.join(HOME, ".claude", "projects")
CODEX_HOME = os.path.join(HOME, ".codex")
CODEX_LOGS = [os.path.join(CODEX_HOME, "sessions"), os.path.join(CODEX_HOME, "archived_sessions")]
CODEX_CONFIG = os.path.join(CODEX_HOME, "config.toml")
CODEX_INDEX = os.path.join(CODEX_HOME, "session_index.jsonl")
CODEX_IMAGES = os.path.join(CODEX_HOME, "generated_images")
CODEX_OUTPUTS = os.path.join(HOME, "Documents", "Codex")
CHATGPT_DIRS = [
    os.path.join(HOME, "Documents", "chatgpt export - Copy"),
    os.path.join(HOME, "Documents", "chatgpt export"),
]
SEARCH_ROOTS = [os.path.join(HOME, "Documents"), os.path.join(HOME, "Downloads"), os.path.join(HOME, "Desktop")]

SCRATCH_RE = re.compile(r"\\AppData\\Local\\Temp\\", re.IGNORECASE)
DATE_DIR_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
UUID_RE = re.compile(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", re.IGNORECASE)
# Codex lines start with timestamp then type. Only these few line types are parsed.
CODEX_HEAD_RE = re.compile(rb'"type"\s*:\s*"(session_meta|turn_context|thread_settings_applied|agent_message)"')
ISO_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$")
CLAUDE_MODEL_RE = re.compile(r"^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?$")

# ChatGPT conversation titles that map to a project. Anything else is "unmapped".
CHATGPT_KEYWORDS = [
    ("citybuilder", "citybuilder"),
    ("hffc", "hffc"),
    ("hotel for fancy", "hffc"),
    ("cosmic", "cosmic crash"),
    ("biomech", "biomechanical quadraped"),
    ("hound of ulster", "hound of ulster"),
    ("wordwood", "wordwood"),
    ("dungeon", "DungeonZoo"),
    ("petisland", "PetIslands"),
    ("pet islands", "PetIslands"),
    ("hl2craft", "hl2craft"),
    ("whitethorn", "whitethorn-systems"),
    ("substitute king", "Substitute King"),
    ("minecraft", "mc-comparison"),
    ("packing", "packing-video"),
    ("ballpoint", "ballpoint"),
    ("watchedtown", "watchedTown"),
]

# Models that are logged but are not authors of content (Codex's automatic
# approval reviewer). They stay in the table and leave the portfolio tags out.
AUX_MODELS = {"codex-auto-review"}


# ---------------------------------------------------------------- helpers

def norm_cwd(p):
    """Windows path with backslashes, no trailing slash, drive letter upper case."""
    if not isinstance(p, str) or not p.strip():
        return None
    s = p.strip().replace("/", "\\")
    if s.startswith("\\\\?\\"):
        s = s[4:]
    s = s.rstrip("\\")
    if re.fullmatch(r"[A-Za-z]:", s):
        s += "\\"
    if len(s) > 1 and s[1] == ":":
        s = s[0].upper() + s[1:]
    return s


def is_scratch(p):
    """Claude scratchpads live in Temp; they say nothing about the project."""
    return bool(p) and bool(SCRATCH_RE.search(p))


def encode_folder(p):
    """Claude Code names its project folders by replacing non-alphanumerics with '-'."""
    return re.sub(r"[^A-Za-z0-9]", "-", p)


def to_date(ts):
    """ISO timestamp to a local-date string YYYY-MM-DD, or None."""
    if not isinstance(ts, str):
        return None
    m = ISO_RE.match(ts.strip())
    if not m:
        return None
    y, mo, d, h, mi, s, tz = m.groups()
    tzinfo = dt.timezone.utc
    if tz and tz != "Z":
        sign = 1 if tz[0] == "+" else -1
        tzinfo = dt.timezone(sign * dt.timedelta(hours=int(tz[1:3]), minutes=int(tz[4:6])))
    when = dt.datetime(int(y), int(mo), int(d), int(h), int(mi), int(s), tzinfo=tzinfo)
    return when.astimezone().strftime("%Y-%m-%d")


def epoch_date(x):
    if isinstance(x, (int, float)) and x > 0:
        return dt.datetime.fromtimestamp(x, dt.timezone.utc).astimezone().strftime("%Y-%m-%d")
    return None


def claude_label(model):
    """claude-opus-5-5 -> 'opus 5.5'; claude-haiku-4-5-20251001 -> 'haiku 4.5'."""
    m = CLAUDE_MODEL_RE.match(model)
    if not m:
        return model
    family, major, minor = m.groups()
    return f"{family} {major}" + (f".{minor}" if minor else "")


def guess_project(path):
    """Folder name of the project a working directory belongs to."""
    if not path or is_scratch(path):
        return None
    segs = path.split("\\")
    low = [s.lower() for s in segs]
    if "documents" not in low:
        return segs[-1] or path
    i = low.index("documents")
    rel = segs[i + 1:]
    if not rel:
        return "Documents"
    head = rel[0].lower()

    def at(n):
        return rel[n] if len(rel) > n else None

    if head == "opus 5.5":
        if (at(1) or "").lower() == "roblox":
            if (at(2) or "").lower() == "games" and at(3):
                return at(3)
            return "roblox"
        return at(1) or "opus 5.5"
    if head in ("chatgpt export - copy", "chatgpt export"):
        return at(1) or rel[0]
    if head == "codex":
        if at(1) and DATE_DIR_RE.match(at(1)):
            return at(2) or "Codex (dated folder)"
        return at(1) or "Codex"
    if head == "ai blender":
        return "ai blender"
    if head == "blender":
        return "Blender"
    if head in ("godot '26", "godot 2026 plans"):
        return at(1) or rel[0]
    return rel[-1]


def map_chatgpt_title(title):
    low = (title or "").lower()
    for kw, project in CHATGPT_KEYWORDS:
        if kw in low:
            return project
    return None


# ---------------------------------------------------------------- aggregation

class Agg:
    __slots__ = ("messages", "sessions", "first", "last")

    def __init__(self):
        self.messages = 0
        self.sessions = set()
        self.first = None
        self.last = None


AGG = collections.defaultdict(Agg)  # key: (tool, model, project_path, project_guess)


def touch(tool, label, path, sid, date, msgs=0, guess=None):
    path = path or ""
    g = guess or guess_project(path) or "unattributed"
    a = AGG[(tool, label, path, g)]
    if sid:
        a.sessions.add(str(sid))
    a.messages += msgs
    if date:
        if a.first is None or date < a.first:
            a.first = date
        if a.last is None or date > a.last:
            a.last = date


# ---------------------------------------------------------------- Claude Code

def read_claude_files():
    loaded = []
    for path in sorted(glob.glob(os.path.join(CLAUDE_PROJECTS, "**", "*.jsonl"), recursive=True)):
        folder = os.path.relpath(path, CLAUDE_PROJECTS).split(os.sep)[0]
        stem = os.path.splitext(os.path.basename(path))[0]
        entries = []  # (sessionId, date, cwd, model)
        custom, ai = {}, {}
        with open(path, "rb") as fh:
            for raw in fh:
                if not raw.strip():
                    continue
                try:
                    o = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(o, dict):
                    continue
                sid = o.get("sessionId") or stem
                msg = o.get("message")
                model = msg.get("model") if isinstance(msg, dict) else None
                if not isinstance(model, str):
                    model = None
                if isinstance(o.get("customTitle"), str):
                    custom[sid] = o["customTitle"]
                if isinstance(o.get("aiTitle"), str):
                    ai[sid] = o["aiTitle"]
                mid = msg.get("id") if isinstance(msg, dict) else None
                entries.append((sid, to_date(o.get("timestamp")), norm_cwd(o.get("cwd")), model, mid))
        titles = {s: custom.get(s) or ai.get(s) for s in set(custom) | set(ai)}
        loaded.append((folder, entries, titles))
    return loaded


def process_claude(loaded, stats):
    known = set()
    for _folder, entries, _titles in loaded:
        for _sid, _d, cwd, _m, _i in entries:
            if cwd and not is_scratch(cwd):
                known.add(cwd)
    by_encoded = {encode_folder(c): c for c in known}

    # Claude writes one line per content block, and a resumed session can repeat
    # lines in a second file. Count each API response (message id) once.
    seen_ids = set()
    sessions = {}
    for folder, entries, titles in loaded:
        stats["files"] += 1
        folder_cwd = by_encoded.get(folder)
        groups = collections.defaultdict(list)
        for e in entries:
            groups[e[0]].append(e)
        for sid, group in groups.items():
            stats["entries"] += len(group)
            cwd_counts = collections.Counter(c for _s, _d, c, _m, _i in group if c and not is_scratch(c))
            dom = cwd_counts.most_common(1)[0][0] if cwd_counts else folder_cwd
            info = sessions.setdefault(sid, {"cwds": set(), "models": set(), "title": None})
            info["cwds"].update(cwd_counts)
            if titles.get(sid):
                info["title"] = titles[sid]
            real = []
            for _s, d, c, m, mid in group:
                if m == "<synthetic>":
                    stats["synthetic"] += 1
                elif m:
                    real.append((d, c, m, mid))
            if real:
                for d, c, m, mid in real:
                    label = claude_label(m)
                    info["models"].add(label)
                    fresh = mid is None or mid not in seen_ids
                    if mid is not None:
                        seen_ids.add(mid)
                    if fresh:
                        stats["messages"] += 1
                    use = c if (c and not is_scratch(c)) else dom
                    touch("claude", label, use, sid, d, 1 if fresh else 0)
            else:
                for _s, d, _c, _m, _i in group:
                    touch("claude", "model unknown", dom, sid, d, 0)
    stats["sessions"] = len(sessions)
    return sessions


# ---------------------------------------------------------------- Codex

def read_codex_index():
    titles = {}
    if os.path.isfile(CODEX_INDEX):
        with open(CODEX_INDEX, "rb") as fh:
            for raw in fh:
                try:
                    o = json.loads(raw)
                except ValueError:
                    continue
                sid, name, upd = o.get("id"), o.get("thread_name"), o.get("updated_at") or ""
                if sid and name and upd >= titles.get(sid, ("", ""))[0]:
                    titles[sid] = (upd, name)
    return {sid: name for sid, (_u, name) in titles.items()}


def read_codex(stats, index_titles):
    files = []
    for root in CODEX_LOGS:
        files += glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True)
    sessions = {}
    for path in sorted(files):
        stats["files"] += 1
        # The rollout file is the session. A resumed or forked thread can carry a
        # later session_meta line from its parent, so only the first one is used.
        m = UUID_RE.search(os.path.basename(path))
        sid = m.group(1) if m else os.path.basename(path)
        meta_seen = False
        sess_cwd = cur_model = cur_cwd = ts_model = first_date = None
        events = []  # (kind, model, cwd, date)
        with open(path, "rb") as fh:
            for raw in fh:
                if not CODEX_HEAD_RE.search(raw[:600]):
                    continue
                try:
                    o = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(o, dict):
                    continue
                t = o.get("type")
                p = o.get("payload")
                if not isinstance(p, dict):
                    continue
                d = to_date(o.get("timestamp"))
                if first_date is None and d:
                    first_date = d
                pt = p.get("type")
                if t == "session_meta":
                    if not meta_seen:
                        meta_seen = True
                        sess_cwd = norm_cwd(p.get("cwd")) or sess_cwd
                elif t == "turn_context":
                    if isinstance(p.get("model"), str):
                        cur_model = p["model"]
                    cur_cwd = norm_cwd(p.get("cwd")) or cur_cwd
                    events.append(("turn", cur_model or ts_model, cur_cwd or sess_cwd, d))
                elif t == "event_msg" and pt == "thread_settings_applied":
                    ts = p.get("thread_settings")
                    if isinstance(ts, dict) and isinstance(ts.get("model"), str) and ts_model is None:
                        ts_model = ts["model"]
                elif t == "event_msg" and pt == "agent_message":
                    events.append(("msg", cur_model or ts_model, cur_cwd or sess_cwd, d))
        if not events:
            events.append(("meta", None, sess_cwd, first_date))
        models_seen = set()
        for kind, model, cwd, d in events:
            label = model or "model unknown"
            if kind == "turn" and model:
                models_seen.add(model)
            if kind == "msg":
                stats["messages"] += 1
            touch("codex", label, cwd, sid, d, 1 if kind == "msg" else 0)
        sessions[sid] = {
            "cwd": cur_cwd or sess_cwd,
            "models": models_seen,
            "title": index_titles.get(sid),
            "first": first_date,
            "file": path,
        }
    stats["sessions"] = len(sessions)
    return sessions


def codex_image_sets(codex_sessions):
    rows = []
    if not os.path.isdir(CODEX_IMAGES):
        return rows
    for name in sorted(os.listdir(CODEX_IMAGES)):
        full = os.path.join(CODEX_IMAGES, name)
        if not os.path.isdir(full):
            continue
        count = sum(len(files) for _dp, _dn, files in os.walk(full))
        info = codex_sessions.get(name)
        if info:
            cwd = info["cwd"] or ""
            rows.append({
                "sid": name, "files": count, "cwd": cwd,
                "project": guess_project(cwd) or "unattributed",
                "models": sorted(info["models"]) or ["model unknown"],
                "title": info["title"] or "", "first": info["first"] or "",
            })
        else:
            rows.append({"sid": name, "files": count, "cwd": "", "project": "unattributed",
                         "models": ["no matching session log"], "title": "", "first": ""})
    return rows


def codex_output_folders(codex_sessions, claude_sessions, index_titles):
    entries = []
    if os.path.isdir(CODEX_OUTPUTS):
        for name in sorted(os.listdir(CODEX_OUTPUTS)):
            full = os.path.join(CODEX_OUTPUTS, name)
            if name.startswith(".") or not os.path.isdir(full):
                continue
            if DATE_DIR_RE.match(name):
                for sub in sorted(os.listdir(full)):
                    sp = os.path.join(full, sub)
                    if os.path.isdir(sp):
                        entries.append(sp)
            else:
                entries.append(full)
    rows = []
    for e in entries:
        en = norm_cwd(e).lower()

        def inside(cwd, en=en):
            if not cwd:
                return False
            c = cwd.lower()
            return c == en or c.startswith(en + "\\")

        cx = [i for i in codex_sessions.values() if inside(i["cwd"])]
        cl = [i for i in claude_sessions.values() if any(inside(c) for c in i["cwds"])]
        cx_models = sorted({m for i in cx for m in i["models"]}) or (["model unknown"] if cx else [])
        cl_models = sorted({m for i in cl for m in i["models"]}) or (["model unknown"] if cl else [])
        cx_titles = [t for t in (i["title"] for i in cx) if t][:3]
        cl_titles = [t for t in (i["title"] for i in cl) if t][:3]
        rows.append({
            "folder": os.path.relpath(e, CODEX_OUTPUTS),
            "codex_n": len(cx), "codex_models": cx_models, "codex_titles": cx_titles,
            "claude_n": len(cl), "claude_models": cl_models, "claude_titles": cl_titles,
        })
    return rows


# ---------------------------------------------------------------- ChatGPT

def find_chatgpt_exports(extra):
    found = set()
    for d in CHATGPT_DIRS:
        p = os.path.join(d, "conversations.json")
        if os.path.isfile(p):
            found.add(p)
    for root in SEARCH_ROOTS:
        if not os.path.isdir(root):
            continue
        base = root.rstrip("\\").count("\\")
        for dp, dns, fns in os.walk(root):
            dns[:] = [x for x in dns if not x.startswith(".") and x.lower() not in ("node_modules", "appdata")]
            if dp.count("\\") - base >= 3:
                dns[:] = []
            if "conversations.json" in fns:
                found.add(os.path.join(dp, "conversations.json"))
    found.update(extra)
    return sorted(found)


def read_chatgpt(paths, stats):
    for path in paths:
        with open(path, "rb") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            data = data.get("conversations", [])
        stats["files"] += 1
        for conv in data:
            if not isinstance(conv, dict):
                continue
            project = map_chatgpt_title(conv.get("title"))
            guess = project or "unmapped"
            cid = conv.get("conversation_id") or conv.get("id")
            ctime = epoch_date(conv.get("create_time"))
            stats["sessions"] += 1
            any_assistant = False
            mapping = conv.get("mapping") or {}
            for node in mapping.values():
                msg = node.get("message") if isinstance(node, dict) else None
                if not isinstance(msg, dict):
                    continue
                role = (msg.get("author") or {}).get("role")
                if role != "assistant":
                    continue
                meta = msg.get("metadata") or {}
                slug = meta.get("model_slug")
                label = slug if isinstance(slug, str) and slug else "model unknown"
                d = epoch_date(msg.get("create_time")) or ctime
                touch("chatgpt", label, "", cid, d, 1, guess=guess)
                stats["messages"] += 1
                any_assistant = True
            if not any_assistant:
                touch("chatgpt", "model unknown", "", cid, ctime, 0, guess=guess)


# ---------------------------------------------------------------- output

def merge_into(store, key, a):
    cur = store.setdefault(key, {"messages": 0, "sessions": set(), "first": None, "last": None})
    cur["messages"] += a.messages
    cur["sessions"] |= a.sessions
    if a.first and (cur["first"] is None or a.first < cur["first"]):
        cur["first"] = a.first
    if a.last and (cur["last"] is None or a.last > cur["last"]):
        cur["last"] = a.last


def tag_lines(pairs):
    """Portfolio tags: one line per tool family, with the models that logged messages."""
    claude_known = sorted(l for (t, l), v in pairs.items() if t == "claude" and l != "model unknown" and v["messages"])
    gpt_known = sorted({l for (t, l), v in pairs.items()
                        if t in ("codex", "chatgpt") and l != "model unknown" and l not in AUX_MODELS
                        and v["messages"]})
    claude_unknown = any(t == "claude" and l == "model unknown" for (t, l) in pairs)
    gpt_unknown = any(t in ("codex", "chatgpt") and l == "model unknown" for (t, l) in pairs)
    out = []
    if claude_known:
        out.append(f"help from claude ({', '.join(claude_known)})")
    elif claude_unknown:
        out.append("help from claude (model unknown)")
    if gpt_known:
        out.append(f"help from gpt ({', '.join(gpt_known)})")
    elif gpt_unknown:
        out.append("help from gpt (model unknown)")
    return out


def md_table(headers, rows):
    def cell(x):
        return str(x).replace("|", "/").replace("\n", " ")
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(cell(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def write_csv(path):
    rows = sorted(AGG.items(), key=lambda kv: (kv[0][0], kv[0][3].lower(), kv[0][1], kv[0][2].lower()))
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["tool", "model", "project_path", "project_guess", "first_date", "last_date",
                    "sessions", "messages_by_model"])
        for (tool, label, p, guess), a in rows:
            w.writerow([tool, label, p, guess, a.first or "", a.last or "", len(a.sessions), a.messages])
    return len(rows)


def write_markdown(path, stats_claude, stats_codex, stats_chatgpt, chatgpt_files, image_rows,
                   folder_rows, default_model):
    projects = collections.defaultdict(lambda: {"pairs": {}, "paths": set()})
    for (tool, label, p, guess), a in AGG.items():
        P = projects[guess]
        merge_into(P["pairs"], (tool, label), a)
        if p:
            P["paths"].add(p)

    def total(P):
        return sum(v["messages"] for v in P["pairs"].values())

    order = sorted(projects.items(), key=lambda kv: (-total(kv[1]), kv[0].lower()))
    img_by_project = collections.defaultdict(lambda: [0, 0])
    for r in image_rows:
        img_by_project[r["project"]][0] += 1
        img_by_project[r["project"]][1] += r["files"]

    now = dt.date.today().isoformat()
    L = []
    L.append("# AI provenance by project")
    L.append("")
    L.append(f"Generated {now} by `tools/provenance.py`. Metadata only: model ids, folders, timestamps, "
             "session ids and conversation titles. No message text or tool output was read into this file.")
    L.append("")
    L.append("## Sources")
    L.append("")
    L.append(f"- Claude Code: {stats_claude['files']} log files, {stats_claude['sessions']} sessions, "
             f"{stats_claude['messages']} assistant responses with a model, each counted once by message id. "
             f"{stats_claude['synthetic']} `<synthetic>` placeholder entries were skipped.")
    L.append(f"- Codex: {stats_codex['files']} rollout files (sessions and archived_sessions), "
             f"{stats_codex['sessions']} sessions, {stats_codex['messages']} assistant messages. "
             f"Models come from turn_context per turn. The config.toml default is `{default_model}`, "
             "shown for reference only and not used to attribute anything.")
    if chatgpt_files:
        L.append(f"- ChatGPT: {len(chatgpt_files)} conversations.json file(s) read, "
                 f"{stats_chatgpt['sessions']} conversations.")
    else:
        L.append("- ChatGPT: no conversations.json found in the chatgpt export folders or the Documents, "
                 "Downloads and Desktop folders. The export folders hold plain-text chat logs and "
                 "attachments only, so no ChatGPT rows are in the table.")
    L.append("- Claude `advisorModel` fields are not counted as the tool's model. Only `message.model` is.")
    L.append("- `codex-auto-review` is Codex's automatic approval reviewer. It is in the table, but it is left out "
             "of the portfolio tags.")
    L.append("")
    L.append("Model labels: Claude ids are shortened (claude-opus-5-5 becomes opus 5.5, "
             "claude-haiku-4-5-20251001 becomes haiku 4.5). Codex and ChatGPT slugs are kept as logged.")
    L.append("")
    L.append("## Projects")
    L.append("")
    for guess, P in order:
        pairs = P["pairs"]
        known = any(l != "model unknown" and v["messages"] for (_t, l), v in pairs.items())
        head = f"### {guess}" + ("" if known else "  (model unknown)")
        L.append(head)
        L.append("")
        tags = tag_lines(pairs)
        if tags:
            L.append("Tag: " + " ; ".join(f"`{t}`" for t in tags))
            L.append("")
        firsts = [v["first"] for v in pairs.values() if v["first"]]
        lasts = [v["last"] for v in pairs.values() if v["last"]]
        if firsts:
            L.append(f"Date range: {min(firsts)} to {max(lasts)}")
            L.append("")
        rows = []
        for (tool, label) in sorted(pairs):
            v = pairs[(tool, label)]
            rows.append([tool, label, f"{v['messages']:,}", len(v["sessions"]),
                         v["first"] or "", v["last"] or ""])
        L.append(md_table(["tool", "model", "messages", "sessions", "first", "last"], rows))
        L.append("")
        if P["paths"]:
            L.append("Folders:")
            for p in sorted(P["paths"], key=str.lower):
                L.append(f"- `{p}`")
            L.append("")
        if guess in img_by_project:
            sets, files = img_by_project[guess]
            L.append(f"Codex generated image sets: {sets} set(s), {files} file(s). See the image table below.")
            L.append("")
    L.append("## Codex generated image sets")
    L.append("")
    if image_rows:
        rows = [[r["sid"], r["files"], r["project"], ", ".join(r["models"]), r["cwd"] or "-",
                 r["title"] or "-", r["first"] or "-"] for r in image_rows]
        L.append(md_table(["session id", "files", "project", "model", "cwd", "session title", "first date"], rows))
    else:
        L.append("No generated_images folders found.")
    L.append("")
    L.append("## Codex output folders (Documents\\Codex)")
    L.append("")
    L.append("Each output folder is matched to the sessions whose working directory sits inside it.")
    L.append("")
    if folder_rows:
        rows = []
        for r in folder_rows:
            rows.append([
                r["folder"],
                f"{r['codex_n']}: " + (", ".join(r["codex_models"]) or "-"),
                "; ".join(r["codex_titles"]) or "-",
                f"{r['claude_n']}: " + (", ".join(r["claude_models"]) or "-"),
            ])
        L.append(md_table(["folder", "codex sessions: models", "codex titles", "claude sessions: models"], rows))
    else:
        L.append("No output folders found.")
    L.append("")
    L.append("## Not attributed")
    L.append("")
    unattr = [(k, v) for k, v in AGG.items() if k[3] == "unattributed"]
    unmapped = [(k, v) for k, v in AGG.items() if k[3] == "unmapped"]
    no_model = sorted({k[3] for k, _v in AGG.items() if k[1] == "model unknown"})
    if unattr:
        sess = sum(len(v.sessions) for _k, v in unattr)
        L.append(f"- Sessions with no usable folder: {sess} (`unattributed`).")
    if unmapped:
        sess = sum(len(v.sessions) for _k, v in unmapped)
        L.append(f"- ChatGPT conversations with no project keyword: {sess} (`unmapped`).")
    if no_model:
        L.append("- Projects whose logs carry no model information (marked `model unknown`): "
                 + ", ".join(f"`{g}`" for g in no_model) + ".")
    if not (unattr or unmapped or no_model):
        L.append("- Every session was attributed to a project and a model.")
    L.append("")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(L))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--chatgpt-json", action="append", default=[], help="extra conversations.json")
    args = ap.parse_args()

    os.makedirs(INVENTORY, exist_ok=True)

    default_model = "unknown"
    if os.path.isfile(CODEX_CONFIG):
        with open(CODEX_CONFIG, "rb") as fh:
            default_model = tomllib.load(fh).get("model", "unknown")

    stats_claude = {"files": 0, "entries": 0, "sessions": 0, "messages": 0, "synthetic": 0}
    stats_codex = {"files": 0, "sessions": 0, "messages": 0}
    stats_chatgpt = {"files": 0, "sessions": 0, "messages": 0}

    loaded = read_claude_files()
    claude_sessions = process_claude(loaded, stats_claude)

    index_titles = read_codex_index()
    codex_sessions = read_codex(stats_codex, index_titles)
    image_rows = codex_image_sets(codex_sessions)
    folder_rows = codex_output_folders(codex_sessions, claude_sessions, index_titles)

    chatgpt_files = find_chatgpt_exports(args.chatgpt_json)
    read_chatgpt(chatgpt_files, stats_chatgpt)

    n = write_csv(OUT_CSV)
    write_markdown(OUT_MD, stats_claude, stats_codex, stats_chatgpt, chatgpt_files,
                   image_rows, folder_rows, default_model)

    print(f"csv rows: {n}  -> {OUT_CSV}")
    print(f"markdown -> {OUT_MD}")
    print(f"claude: files={stats_claude['files']} sessions={stats_claude['sessions']} "
          f"messages={stats_claude['messages']}")
    print(f"codex: files={stats_codex['files']} sessions={stats_codex['sessions']} "
          f"messages={stats_codex['messages']}")
    print(f"chatgpt exports read: {len(chatgpt_files)}")


if __name__ == "__main__":
    main()
