#!/bin/sh
# Build the public site (no drafts) and push it to the gh-pages branch, which
# GitHub Pages serves at https://danisaurr.github.io/rensemporium/
# Run from Git Bash:  sh tools/publish.sh
set -e
cd "$(dirname "$0")/.."
python -I tools/build.py
python -I tools/checklinks.py
cd _site
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "publish $(date +%Y-%m-%d)"
git push -f https://github.com/DaniSaurr/rensemporium.git gh-pages
rm -rf .git
echo "published: https://danisaurr.github.io/rensemporium/"
