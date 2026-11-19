#!/usr/bin/env bash
# Installe dans un dossier d'un jeu les parties de la bibliothèque graphique (lib/) qu'il demande, avec leurs dépendances,
# en remplaçant entièrement ce dossier, et y écrit VERSION.json (version, commit de web_engine, parties).
# Appelé par outils/maj-graphismes.sh de chaque jeu.
# Usage : outils/installer.sh /chemin/du/jeu/graphismes [partie…]
# Parties (depuis la 2.15.0) : les fichiers restent dans rendu/ (les chemins d'import des jeux ne changent pas), chaque partie en prend une liste.
#   three    three.js r186 et BufferGeometryUtils
#   socle    scène, caméra, plateau (terrain, nature, rivières), météo et heure, vie commune (fumées, climat), routes, boue,
#            brume, feuilles et givre, nuit (étoiles, lune, lucioles, reflets, lueurs, halos), faune (migrateurs, poissons, envols), eau (vagues, cascades, sillages), brouillard, étiquettes, rendu.css
#   moderne  bâtiments modernes (modernes.js : installations, lignes, quartiers, fermes), chantiers vivants et piquets de grève (chantiers.js), voies ferrées et trains (rail.js)
#   antique  Gaulois et Romains (antiques.js)
#   ancien   bâtiments et armées de 1700 à 1816, le monde de web_royaumes (monde, quartiers, animations, chroniques), images et icônes
#   guerre   remparts, forts, sièges, flottes, espions
#   rendu    tout (les jeux d'avant la 2.15.0)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${1:?usage : outils/installer.sh /chemin/du/dossier partie…}; shift
# sans partie demandée : tout, comme avant les parties (anciens scripts maj-graphismes.sh des jeux)
[ $# -gt 0 ] || set -- rendu
R=rendu
declare -A FICHIERS=(
  [three]="three"
  [socle]="$R/scene.js $R/toon.js $R/plateau.js $R/meteo.js $R/vie.js $R/boue.js $R/ambiance.js $R/nuit.js $R/faune.js $R/eau.js $R/routes.js $R/brouillard.js $R/etiquettes.js $R/rendu.css"
  [moderne]="$R/modernes.js $R/chantiers.js $R/rail.js"
  [antique]="$R/antiques.js"
  [ancien]="$R/modeles.js $R/monde.js $R/quartiers.js $R/animations.js $R/chroniques.js $R/img $R/icons"
  [guerre]="$R/guerre_commun.js $R/remparts.js $R/forts.js $R/sieges.js $R/marine.js $R/espions.js"
  [rendu]=""
)
# ce dont chaque partie a besoin (monde.js pose les forts, sièges et remparts ; les animations anciennes prennent les personnages antiques)
declare -A BESOIN=([three]="" [socle]="three" [moderne]="socle" [antique]="moderne" [ancien]="socle moderne antique guerre" [guerre]="ancien" [rendu]="socle moderne antique ancien guerre")
declare -A PRISES=()
prendre() { [ -n "${BESOIN[$1]+x}" ] || { echo "partie inconnue : $1 (three, socle, moderne, antique, ancien, guerre, rendu)" >&2; exit 2; }
            [ -n "${PRISES[$1]:-}" ] && return; PRISES[$1]=1; for b in ${BESOIN[$1]}; do prendre "$b"; done; }
for p in "$@"; do prendre "$p"; done
PARTIES=$(printf '%s\n' "${!PRISES[@]}" | sort | tr '\n' ' ' | sed 's/ $//')

VERSION=$(python3 -c "import json; print(json.load(open('lib/package.json'))['version'])")
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo inconnu)
if [ -n "$(git status --porcelain lib 2>/dev/null)" ]; then COMMIT="$COMMIT-modifie"; echo "attention : lib/ a des modifications non commitées" >&2; fi
rm -rf "$DEST" && mkdir -p "$DEST"
cp lib/README.md lib/CHANGELOG.md lib/package.json "$DEST/"
for p in $PARTIES; do for f in ${FICHIERS[$p]}; do mkdir -p "$(dirname "$DEST/$f")"; cp -r "lib/$f" "$DEST/$f"; done; done
# contrôle : chaque import relatif d'un module installé doit trouver son fichier (sinon une partie oublie une dépendance)
manque=0
for js in "$DEST/$R"/*.js; do
  [ -e "$js" ] || continue
  for dep in $(grep -oE "(from|import) '\./[a-zA-Z_]+\.js'" "$js" | grep -oE "[a-zA-Z_]+\.js" | sort -u); do
    [ -e "$DEST/$R/$dep" ] || { echo "erreur : $R/$(basename "$js") importe $dep, absent des parties $PARTIES" >&2; manque=1; }
  done
done
[ $manque = 0 ] || exit 3
printf '{\n  "version": "%s",\n  "commit": "%s",\n  "parties": "%s",\n  "depot": "https://github.com/pilou33620/web_engine"\n}\n' "$VERSION" "$COMMIT" "$PARTIES" > "$DEST/VERSION.json"
echo "graphismes $VERSION ($COMMIT) installés dans $DEST : $PARTIES"
