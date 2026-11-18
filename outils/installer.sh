#!/usr/bin/env bash
# Installe la bibliothèque graphique (lib/) dans un dossier d'un jeu, en remplaçant entièrement ce dossier,
# et y écrit VERSION.json (version, commit de web_engine). Appelé par outils/maj-graphismes.sh de chaque jeu.
# Usage : outils/installer.sh /chemin/du/jeu/graphismes
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${1:?usage : outils/installer.sh /chemin/du/dossier}
VERSION=$(python3 -c "import json; print(json.load(open('lib/package.json'))['version'])")
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo inconnu)
if [ -n "$(git status --porcelain lib 2>/dev/null)" ]; then COMMIT="$COMMIT-modifie"; echo "attention : lib/ a des modifications non commitées" >&2; fi
rm -rf "$DEST" && mkdir -p "$DEST" && cp -r lib/. "$DEST/"
printf '{\n  "version": "%s",\n  "commit": "%s",\n  "depot": "https://github.com/pilou33620/web_engine"\n}\n' "$VERSION" "$COMMIT" > "$DEST/VERSION.json"
echo "graphismes $VERSION ($COMMIT) installés dans $DEST"
