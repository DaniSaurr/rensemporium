#!/bin/sh
# Run ONCE, just before the first push. It replaces the local history with a
# single commit of the current files, so old WAVs and PNGs we've since replaced
# don't get uploaded. The old history is kept in a bundle file next to the repo.
set -e
cd "$(dirname "$0")/.."
git diff --quiet && git diff --cached --quiet || { echo "commit or stash changes first"; exit 1; }
git bundle create "../portfolio-site-history-$(date +%Y%m%d).bundle" --all
git checkout --orphan squashed
git commit -q -m "ren's emporium

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git branch -D main 2>/dev/null || git branch -D master 2>/dev/null || true
git branch -m main
git reflog expire --expire=now --all
git gc -q --prune=now --aggressive
du -sh .git
