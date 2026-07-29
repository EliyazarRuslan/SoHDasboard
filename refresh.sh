#!/bin/zsh
# Refresh SoH data from Maximo and publish to GitHub Pages.
# Run from inside the corporate network (VPN/office).
set -e
cd "$(dirname "$0")"

node refresh_data.js

if git diff --quiet -- data/soh_data.js; then
  echo "No data changes — nothing to publish."
  exit 0
fi

git add data/soh_data.js
git commit -m "chore: refresh SoH data $(date +%Y-%m-%d\ %H:%M)"
git push origin main
echo "Published. Dashboard updates in ~1 min: https://eliyazarruslan.github.io/SoHDasboard/"
