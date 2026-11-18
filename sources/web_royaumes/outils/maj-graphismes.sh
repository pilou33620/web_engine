#!/usr/bin/env bash
# Les graphismes de ce jeu viennent de la bibliothèque commune web_engine (lib/) : ne pas les modifier ici, mais dans web_engine.
#   outils/maj-graphismes.sh [réf]       met à jour le dossier des graphismes depuis web_engine (réf : branche, étiquette ou commit ; main par défaut)
#   outils/maj-graphismes.sh --verifier  vérifie que le dossier est identique à la bibliothèque du commit noté dans VERSION.json (CI)
# Modèle : web_engine/outils/jeu/maj-graphismes.sh (seule la ligne DEST change d'un jeu à l'autre).
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=web/graphismes
DEPOT=https://github.com/pilou33620/web_engine.git
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git clone -q "$DEPOT" "$TMP/web_engine"
if [ "${1:-}" = "--verifier" ]; then
  COMMIT=$(python3 -c "import json; print(json.load(open('$DEST/VERSION.json'))['commit'])")
  git -C "$TMP/web_engine" checkout -q "$COMMIT"
  if diff -r --exclude=VERSION.json "$TMP/web_engine/lib" "$DEST"; then echo "$DEST/ est la bibliothèque de web_engine ($COMMIT)"
  else echo "$DEST/ diffère de web_engine ($COMMIT) : modifiez les graphismes dans web_engine, puis lancez outils/maj-graphismes.sh" >&2; exit 1; fi
else
  git -C "$TMP/web_engine" checkout -q "${1:-main}"
  "$TMP/web_engine/outils/installer.sh" "$PWD/$DEST"
fi
