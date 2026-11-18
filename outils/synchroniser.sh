#!/usr/bin/env bash
# Recopie intégralement web_royaumes et web_power (branche main) dans sources/, sans rien modifier,
# ainsi que le travail graphique qui n'existe que sur une branche (BRANCHES), puis régénère sources/SOURCES.json.
# Usage : outils/synchroniser.sh   (DEPOTS=/chemin/des/clones pour utiliser des clones locaux, sinon clone depuis GitHub)
set -euo pipefail
cd "$(dirname "$0")/.."
DEPOTS_DIR=${DEPOTS:-}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

depot() {  # chemin d'un clone à jour du dépôt $1
  if [ -n "$DEPOTS_DIR" ] && [ -d "$DEPOTS_DIR/$1/.git" ]; then git -C "$DEPOTS_DIR/$1" fetch -q origin; echo "$DEPOTS_DIR/$1"
  else [ -d "$TMP/$1" ] || git clone -q "https://github.com/pilou33620/$1.git" "$TMP/$1"; echo "$TMP/$1"; fi
}

for r in web_royaumes web_power; do
  d=$(depot $r)
  rm -rf "sources/$r" && mkdir -p "sources/$r"
  git -C "$d" archive origin/main | tar -x -C "sources/$r"
  echo "$r : $(git -C "$d" log -1 --format='%h %cs %s' origin/main | cut -c1-100)"
done

# dépôt  branche  fichier  dossier sous sources/branches/
BRANCHES=(
  "web_power claude/jolly-meitner-cjshzu maquettes/conquete-spatiale.html web_power-heliosphere"
)
rm -rf sources/branches && mkdir -p sources/branches
for ligne in "${BRANCHES[@]}"; do
  read -r r b f dest <<<"$ligne"
  d=$(depot $r)
  if git -C "$d" cat-file -e "origin/$b:$f" 2>/dev/null; then
    mkdir -p "sources/branches/$dest/$(dirname "$f")"
    git -C "$d" show "origin/$b:$f" > "sources/branches/$dest/$f"
    echo "branche $r/$b : $f"
  else echo "branche $r/$b introuvable (fusionnée ou supprimée ?) : $f ignoré" >&2; fi
done

# maquettes/ : dossier permanent de web_engine. Les maquettes des jeux et des branches y sont ajoutées ou mises à jour,
# jamais supprimées : un jeu peut retirer les siennes (sources/ suivra), web_engine les garde.
for r in web_royaumes web_power; do [ -d "sources/$r/maquettes" ] && mkdir -p "maquettes/$r" && cp -r "sources/$r/maquettes/." "maquettes/$r/"; done
for d in sources/branches/*/; do [ -d "$d/maquettes" ] && n=$(basename "$d") && mkdir -p "maquettes/$n" && cp -r "$d/maquettes/." "maquettes/$n/"; done

# SOURCES.json : commits copiés et maquettes (lu par index.html)
python3 - "$(depot web_royaumes)" "$(depot web_power)" <<'EOF'
import json, subprocess, sys, pathlib, re
def git(d, *a): return subprocess.check_output(['git', '-C', d, *a], text=True).strip()
out = {'depots': {}, 'maquettes': []}
for nom, d in zip(['web_royaumes', 'web_power'], sys.argv[1:]):
    h, date, msg = git(d, 'log', '-1', '--format=%H%x09%cs%x09%s', 'origin/main').split('\t')
    out['depots'][nom] = {'commit': h, 'date': date, 'message': msg}
for p in sorted(pathlib.Path('maquettes').glob('*/*.html')):
    t = re.search(r'<title>(.*?)</title>', p.read_text(encoding='utf-8', errors='replace'), re.S)
    out['maquettes'].append({'source': p.parts[1], 'chemin': p.as_posix(), 'titre': (t.group(1).strip() if t else p.stem)})
pathlib.Path('sources/SOURCES.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(len(out['maquettes']), 'maquettes')
EOF

# INVENTAIRE.md : chaque fichier graphique des sources, décrit par son propre commentaire d'en-tête
python3 - <<'PY'
import pathlib, re, json
S = json.loads(pathlib.Path('sources/SOURCES.json').read_text(encoding='utf-8'))
GRAPHIQUE = re.compile(r'(^|/)(web|js|css|maquettes|img|icons|vendor)(/|$)|\.(html|svg|png)$')
def entete(p):
    if p.suffix not in ('.js', '.html', '.css', '.py', '.md'): return ''
    for l in p.read_text(encoding='utf-8', errors='replace').splitlines()[:12]:
        l = l.strip()
        m = re.match(r'^(//+|/\*+|#|<!--)\s*(.*?)\s*(\*/|-->)?$', l)
        if m and m.group(2) and not m.group(2).startswith(('!', '=', '-')) and 'use strict' not in l: return m.group(2).strip('=─ ')
        m = re.search(r'<title>(.*?)</title>', l)
        if m: return m.group(1)
    return ''
lignes = ['# Inventaire graphique des sources', '', 'Généré par `outils/synchroniser.sh` : ne pas modifier à la main.', '']
for nom, d in S['depots'].items():
    lignes += [f'## {nom} — `{d["commit"][:7]}` ({d["date"]})', '', '| Fichier | Taille | Rôle (en-tête du fichier) |', '|---|---:|---|']
    racine = pathlib.Path('sources', nom)
    for p in sorted(x for x in racine.rglob('*') if x.is_file()):
        r = p.relative_to(racine).as_posix()
        if GRAPHIQUE.search(r): lignes.append(f'| `{r}` | {p.stat().st_size // 1024} ko | {entete(p).replace("|", "/")} |')
    lignes.append('')
lignes += ['## Branches non fusionnées', '', '| Fichier | Rôle |', '|---|---|']
for p in sorted(x for x in pathlib.Path('sources/branches').rglob('*') if x.is_file()):
    lignes.append(f'| `{p.relative_to("sources/branches").as_posix()}` | {entete(p)} |')
pathlib.Path('sources/INVENTAIRE.md').write_text('\n'.join(lignes) + '\n', encoding='utf-8')
print('INVENTAIRE.md :', sum(l.startswith('| `') for l in lignes), 'fichiers')
PY

# La version de la bibliothèque que chaque jeu a installée (graphismes/VERSION.json) ; sa CI vérifie qu'il n'a rien modifié.
echo "graphismes des jeux face à lib/ $(python3 -c "import json; print(json.load(open('lib/package.json'))['version'])") :"
for v in sources/web_royaumes/web/graphismes/VERSION.json sources/web_power/graphismes/VERSION.json; do
  [ -f "$v" ] && echo "  $(dirname "$v") : bibliothèque $(python3 -c "import json; d=json.load(open('$v')); print(d['version'], d['commit'][:7])")"
done
