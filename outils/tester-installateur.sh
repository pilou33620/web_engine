#!/usr/bin/env bash
# Auto-test de outils/installer.sh : parties demandées, dépendances, refus d'une partie inconnue, tout par défaut.
set -uo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; ok=1
contenu() { ls "$1" | tr '\n' ' '; }
outils/installer.sh "$T/a" royaumes >/dev/null 2>&1; [ "$(contenu "$T/a")" = "CHANGELOG.md README.md VERSION.json package.json royaumes three " ] || { ok=0; echo "royaumes → $(contenu "$T/a")"; }
outils/installer.sh "$T/b" power >/dev/null 2>&1; [ "$(contenu "$T/b")" = "CHANGELOG.md README.md VERSION.json package.json power " ] || { ok=0; echo "power → $(contenu "$T/b")"; }
outils/installer.sh "$T/c" pont >/dev/null 2>&1; grep -q '"parties": "pont power royaumes three"' "$T/c/VERSION.json" || { ok=0; echo "pont : dépendances manquantes"; }
outils/installer.sh "$T/d" inconnue >/dev/null 2>&1 && { ok=0; echo "partie inconnue acceptée"; }
outils/installer.sh "$T/e" >/dev/null 2>&1; grep -q '"parties": "pont power royaumes three"' "$T/e/VERSION.json" || { ok=0; echo "sans partie : tout n'est pas installé (anciens scripts des jeux)"; }
[ $ok = 1 ] && echo "installateur : OK" || { echo "installateur : ÉCHEC"; exit 1; }
