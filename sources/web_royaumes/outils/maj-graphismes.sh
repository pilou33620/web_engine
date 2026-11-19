#!/usr/bin/env bash
# Les graphismes de ce jeu viennent de la bibliothèque commune web_engine (lib/) : ne pas les modifier ici, mais dans web_engine.
# Le jeu ne prend que les parties qu'il déclare (PARTIES ; leurs dépendances suivent toutes seules).
#   outils/maj-graphismes.sh [réf]       met à jour le dossier des graphismes depuis web_engine (réf : branche, étiquette ou commit ;
#                                        main par défaut) ; ne change rien si aucune des parties du jeu n'a changé
#   outils/maj-graphismes.sh --verifier  vérifie que le dossier est identique aux parties de la bibliothèque du commit noté dans VERSION.json (CI)
# Modèle : web_engine/outils/jeu/maj-graphismes.sh (seules les lignes DEST et PARTIES changent d'un jeu à l'autre).
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=web/graphismes
PARTIES="ancien guerre"   # parties : three, socle, moderne, antique, ancien, guerre, ou rendu (tout) ; leurs dépendances suivent (voir graphismes/README.md)
DEPOT=https://github.com/pilou33620/web_engine.git
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git clone -q "$DEPOT" "$TMP/web_engine"
if [ "${1:-}" = "--verifier" ]; then
  COMMIT=$(python3 -c "import json; print(json.load(open('$DEST/VERSION.json'))['commit'])")
  git -C "$TMP/web_engine" checkout -q "$COMMIT"
  "$TMP/web_engine/outils/installer.sh" "$TMP/attendu" $PARTIES >/dev/null
  if diff -r --exclude=VERSION.json "$TMP/attendu" "$DEST"; then echo "$DEST/ est la bibliothèque de web_engine ($COMMIT : $PARTIES)"
  else echo "$DEST/ diffère de web_engine ($COMMIT) : modifiez les graphismes dans web_engine, puis lancez outils/maj-graphismes.sh" >&2; exit 1; fi
else
  git -C "$TMP/web_engine" checkout -q "${1:-main}"
  "$TMP/web_engine/outils/installer.sh" "$PWD/$DEST" $PARTIES
  # rien de neuf dans les parties de ce jeu (seuls la version, le journal ou la documentation changent) :
  # on garde ce qui est en place, et il n'y a pas de mise à jour à proposer
  INFOS="$DEST/VERSION.json $DEST/CHANGELOG.md $DEST/README.md $DEST/package.json"
  if git ls-files --error-unmatch "$DEST/VERSION.json" >/dev/null 2>&1 && [ -z "$(git status --porcelain -- "$DEST" | grep -vE " $DEST/(VERSION\.json|CHANGELOG\.md|README\.md|package\.json)\$")" ]; then
    git checkout -q -- $INFOS; echo "aucune des parties de ce jeu ($PARTIES) n'a changé : rien à mettre à jour"
  fi
fi
