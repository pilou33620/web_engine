#!/usr/bin/env bash
# Auto-test de outils/installer.sh : parties demandées, dépendances, refus d'une partie inconnue, tout par défaut,
# parties fines (moderne sans le monde ancien ; rendu identique à lib/rendu).
set -uo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; ok=1
contenu() { ls "$1" | tr '\n' ' '; }
outils/installer.sh "$T/a" rendu >/dev/null 2>&1; [ "$(contenu "$T/a")" = "CHANGELOG.md README.md VERSION.json package.json rendu three " ] || { ok=0; echo "rendu → $(contenu "$T/a")"; }
outils/installer.sh "$T/b" three >/dev/null 2>&1; [ "$(contenu "$T/b")" = "CHANGELOG.md README.md VERSION.json package.json three " ] || { ok=0; echo "three → $(contenu "$T/b")"; }
outils/installer.sh "$T/d" power >/dev/null 2>&1 && { ok=0; echo "partie inconnue acceptée"; }
outils/installer.sh "$T/e" >/dev/null 2>&1; grep -q '"parties": "ancien antique defense guerre moderne rendu socle three"' "$T/e/VERSION.json" || { ok=0; echo "sans partie : tout n'est pas installé (anciens scripts des jeux)"; }
diff -r lib/rendu "$T/a/rendu" >/dev/null || { ok=0; echo "rendu : différent de lib/rendu (un fichier n'appartient à aucune partie ?)"; }
outils/installer.sh "$T/f" moderne >/dev/null 2>&1 && [ -e "$T/f/rendu/modernes.js" ] && [ -e "$T/f/rendu/meteo.js" ] && [ ! -e "$T/f/rendu/monde.js" ] || { ok=0; echo "moderne → $(contenu "$T/f/rendu" 2>/dev/null)"; }
[ $ok = 1 ] && echo "installateur : OK" || { echo "installateur : ÉCHEC"; exit 1; }
