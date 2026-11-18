#!/bin/sh
# Royaumes des Rives (Linux, macOS, Raspberry Pi) : obtient l'exécutable du jeu (binaires.sh) puis le lance.
#   ./lancer.sh [--port 8795] [--lan | --local] [--no-browser | --browser] [--no-update]
cd "$(dirname "$0")" || exit 1
. ./binaires.sh
# Le jeu sort avec le code 75 quand il vient de se mettre à jour (git pull) :
# on reprend l'exécutable de la nouvelle version, puis on le relance.
export ROYAUMES_RELANCEUR=1
while :; do
  obtenir_binaires && bin/royaumes "$@"
  code=$?
  [ "$code" -eq 75 ] || break
done
exit "$code"
