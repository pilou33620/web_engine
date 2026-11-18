#!/usr/bin/env bash
# Auto-test de outils/installer.sh : parties demandées, dépendances, refus d'une partie inconnue, tout par défaut.
set -uo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; ok=1
contenu() { ls "$1" | tr '\n' ' '; }
outils/installer.sh "$T/a" rendu >/dev/null 2>&1; [ "$(contenu "$T/a")" = "CHANGELOG.md README.md VERSION.json package.json rendu three " ] || { ok=0; echo "rendu → $(contenu "$T/a")"; }
outils/installer.sh "$T/b" three >/dev/null 2>&1; [ "$(contenu "$T/b")" = "CHANGELOG.md README.md VERSION.json package.json three " ] || { ok=0; echo "three → $(contenu "$T/b")"; }
outils/installer.sh "$T/d" power >/dev/null 2>&1 && { ok=0; echo "partie inconnue acceptée"; }
outils/installer.sh "$T/e" >/dev/null 2>&1; grep -q '"parties": "rendu three"' "$T/e/VERSION.json" || { ok=0; echo "sans partie : tout n'est pas installé (anciens scripts des jeux)"; }
[ $ok = 1 ] && echo "installateur : OK" || { echo "installateur : ÉCHEC"; exit 1; }
