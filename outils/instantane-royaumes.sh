#!/usr/bin/env bash
# Régénère galerie/web_royaumes/donnees/{carte,etat}.json avec le vrai moteur Rust de sources/web_royaumes :
# nouvelle partie (petite carte, graine 1700), puis carte et état tels que le jeu les envoie à sa page.
# Le serveur tourne depuis une copie temporaire : il écrit des sauvegardes (saves/) que sources/ ne doit pas recevoir.
# Usage : outils/instantane-royaumes.sh   (nécessite cargo et curl)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=galerie/web_royaumes/donnees PORT=${PORT:-8796}
TMP=$(mktemp -d); trap 'kill "${PID:-0}" 2>/dev/null || true; rm -rf "$TMP"' EXIT
cp -r sources/web_royaumes "$TMP/jeu"
( cd "$TMP/jeu" && cargo build -q --release )
( cd "$TMP/jeu" && exec ./target/release/royaumes --local --no-browser --no-update --port "$PORT" ) > "$TMP/serveur.log" 2>&1 &
PID=$!
for _ in $(seq 50); do curl -sf "localhost:$PORT/api/info" >/dev/null && break; sleep 0.2; done
OPTIONS='{"taille":"petite","forme":"classique","graine":1700,"oceans":30,"forets":40,"lacs":3,"rivieres":4,"montagnes":12,"mines":2,"rivaux":2,"attitude":"normale","difficulte":1,"brigands":false,"capitale":"Valdor"}'
curl -sf -XPOST "localhost:$PORT/api/nouvelle" -H 'Content-Type: application/json' -d "$OPTIONS" | grep -q '"ok":true'
mkdir -p "$DEST"
curl -sf "localhost:$PORT/api/carte" > "$DEST/carte.json"
curl -sf "localhost:$PORT/api/etat" > "$DEST/etat.json"
python3 -c "import json,sys; [json.load(open(f)) for f in sys.argv[1:]]" "$DEST/carte.json" "$DEST/etat.json"
echo "carte et état écrits dans $DEST"
