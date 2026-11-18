#!/usr/bin/env bash
# Installe dans un dossier d'un jeu les parties de la bibliothèque graphique (lib/) qu'il demande, avec leurs dépendances,
# en remplaçant entièrement ce dossier, et y écrit VERSION.json (version, commit de web_engine, parties).
# Appelé par outils/maj-graphismes.sh de chaque jeu.
# Usage : outils/installer.sh /chemin/du/jeu/graphismes partie…   (parties : three, royaumes, power, pont)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${1:?usage : outils/installer.sh /chemin/du/dossier partie…}; shift
[ $# -gt 0 ] || { echo "aucune partie demandée (three, royaumes, power, pont)" >&2; exit 2; }
# ce dont chaque partie a besoin pour fonctionner
declare -A BESOIN=([three]="" [royaumes]="three" [power]="" [pont]="royaumes power")
declare -A PRISES=()
prendre() { [ -n "${BESOIN[$1]+x}" ] || { echo "partie inconnue : $1 (three, royaumes, power, pont)" >&2; exit 2; }
            [ -n "${PRISES[$1]:-}" ] && return; PRISES[$1]=1; for b in ${BESOIN[$1]}; do prendre "$b"; done; }
for p in "$@"; do prendre "$p"; done
PARTIES=$(printf '%s\n' "${!PRISES[@]}" | sort | tr '\n' ' ' | sed 's/ $//')

VERSION=$(python3 -c "import json; print(json.load(open('lib/package.json'))['version'])")
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo inconnu)
if [ -n "$(git status --porcelain lib 2>/dev/null)" ]; then COMMIT="$COMMIT-modifie"; echo "attention : lib/ a des modifications non commitées" >&2; fi
rm -rf "$DEST" && mkdir -p "$DEST"
cp lib/README.md lib/CHANGELOG.md lib/package.json "$DEST/"
for p in $PARTIES; do cp -r "lib/$p" "$DEST/"; done
printf '{\n  "version": "%s",\n  "commit": "%s",\n  "parties": "%s",\n  "depot": "https://github.com/pilou33620/web_engine"\n}\n' "$VERSION" "$COMMIT" "$PARTIES" > "$DEST/VERSION.json"
echo "graphismes $VERSION ($COMMIT) installés dans $DEST : $PARTIES"
