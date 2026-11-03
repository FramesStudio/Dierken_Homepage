#!/bin/sh
# Baut die Vorschau und veröffentlicht sie auf dem Branch gh-pages:
# https://framesstudio.github.io/Dierken_Homepage/ (nicht indexiert, siehe PUBLIC_PREVIEW)
set -e
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
rm -rf .preview
SITE_URL=https://framesstudio.github.io BASE_PATH=/Dierken_Homepage PUBLIC_PREVIEW=1 npx astro build --outDir .preview
# ohne .nojekyll ignoriert GitHub Pages den Ordner _astro
touch .preview/.nojekyll
cd .preview
git init -q -b gh-pages
git add -A
git commit -q -m "Vorschau $(date '+%Y-%m-%d %H:%M')"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -f "$REMOTE" gh-pages
