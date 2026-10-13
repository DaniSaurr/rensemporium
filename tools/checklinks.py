"""Check that every relative link in the built site points at a file that exists.

    python -I tools/checklinks.py            # checks _site/
    python -I tools/checklinks.py some/dir   # checks another built folder

Looks at href and src in .html files (and srcset), and url(...) in .css files.
Absolute links (http:, https:, mailto:, data:, ...) and in-page anchors (#x) are
skipped. A link to a folder counts as good only if the folder has an index.html.
Root-relative links (starting with "/") are reported too: the site is served
from a sub-folder on GitHub Pages, so they break there.

Exits 1 if anything is missing, 0 if all links resolve.
"""

import re
import sys
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = ROOT / "_site"

LINK_ATTRS = {"href", "src"}
CSS_URL = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""")
SKIP_SCHEMES = {"http", "https", "mailto", "tel", "data", "javascript", "blob", "about"}


class LinkFinder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.found = []  # (line, target)

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        for name, value in attrs:
            if value is None:
                continue
            if name in LINK_ATTRS:
                self.found.append((line, value.strip()))
            elif name == "srcset":
                for part in value.split(","):
                    url = part.strip().split(" ")[0]
                    if url:
                        self.found.append((line, url))


def is_checkable(target):
    if not target or target.startswith("#"):
        return False
    parts = urlsplit(target)
    if parts.scheme.lower() in SKIP_SCHEMES:
        return False
    if target.startswith("//"):  # protocol-relative, points off the site
        return False
    return True


def resolve(base_dir, target, site):
    """Return (ok, problem) for one link found in a file under base_dir."""
    if target.startswith("/"):
        return False, "root-relative link (breaks on a sub-folder host)"
    path = unquote(urlsplit(target).path)
    if path == "":
        return True, ""
    candidate = (base_dir / path).resolve()
    try:
        candidate.relative_to(site)
    except ValueError:
        return False, "points outside _site"
    if path.endswith("/") or candidate.is_dir():
        if (candidate / "index.html").is_file():
            return True, ""
        return False, "folder has no index.html"
    if candidate.is_file():
        return True, ""
    return False, "file not found"


def check_html(path, site, problems):
    finder = LinkFinder()
    text = path.read_text(encoding="utf-8", errors="replace")
    finder.feed(text)
    for line, target in finder.found:
        if not is_checkable(target):
            continue
        ok, why = resolve(path.parent, target, site)
        if not ok:
            problems.append((path, line, target, why))


def check_css(path, site, problems):
    text = path.read_text(encoding="utf-8", errors="replace")
    for match in CSS_URL.finditer(text):
        target = match.group(2).strip()
        if not is_checkable(target):
            continue
        line = text.count("\n", 0, match.start()) + 1
        ok, why = resolve(path.parent, target, site)
        if not ok:
            problems.append((path, line, target, why))


def main(argv):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    site = (Path(argv[1]) if len(argv) > 1 else DEFAULT).resolve()
    if not site.is_dir():
        print("no such folder: %s (run tools/build.py first)" % site)
        return 2
    problems = []
    n_html = n_css = 0
    for path in sorted(site.rglob("*")):
        if path.suffix.lower() in (".html", ".htm"):
            n_html += 1
            check_html(path, site, problems)
        elif path.suffix.lower() == ".css":
            n_css += 1
            check_css(path, site, problems)
    rel = lambda p: p.relative_to(site).as_posix()
    for path, line, target, why in problems:
        print("%s:%d  %s  (%s)" % (rel(path), line, target, why))
    print("checked %d html and %d css files in %s: %d problem(s)" % (n_html, n_css, site, len(problems)))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
