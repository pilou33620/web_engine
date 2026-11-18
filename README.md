# web_engine — base graphique des jeux

La base de travail pour les graphismes des prochains jeux. Elle contient **l'intégralité** de web_royaumes et de web_power, une galerie pour tout voir, et les outils pour la tenir à jour.

| Source | Époques | Rôle prévu |
|---|---|---|
| `sources/web_royaumes/` | 1700 Ancien Régime · 1750 Lumières · 1789 Empire · 1816 Révolution industrielle | rendus des **époques passées** |
| `sources/web_power/` | 1900 → 2035 (10 ères) | rendus des **époques modernes** |

Les commits copiés sont dans `sources/SOURCES.json`. L'inventaire de chaque fichier graphique, avec son rôle, est dans [`sources/INVENTAIRE.md`](sources/INVENTAIRE.md).

## Organisation

```
index.html                 accueil : une source, puis Bâtiments / Monde vivant / Maquettes
sources/                   copies intégrales, jamais modifiées à la main (outils/synchroniser.sh les remplace)
  web_royaumes/            tout le dépôt (main) : web/ (rendu, ui, css, images), maquettes/, moteur Rust, tests…
  web_power/               tout le dépôt (main) : index.html, js/, css/, maquettes/, banc/, serveur…
  branches/                travail graphique qui n'existe que sur une branche non fusionnée
  SOURCES.json             commits copiés et liste des maquettes
  INVENTAIRE.md            inventaire graphique (généré)
carte-test/                la carte test : tous les bâtiments de toutes les époques (1700 → 2035) sur une seule carte
  carte.js                 la carte, la frise des époques, la liste des bâtiments
  power.js                 les modèles et le catalogue de web_power, évalués avec les briques du moteur web_royaumes
galerie/                   les pages de la galerie : elles chargent le code de sources/ tel quel
  visionneuse.css
  web_royaumes/            visionneuse.html (bâtiments), monde.html (monde vivant), donnees/ (carte et état du moteur)
  web_power/               visionneuse.html + visionneuse.js (bâtiments), monde.html (monde vivant)
outils/
  synchroniser.sh          recopie les deux dépôts et régénère SOURCES.json et INVENTAIRE.md
  instantane-royaumes.sh   régénère galerie/web_royaumes/donnees avec le vrai moteur Rust
  verifier.mjs             ouvre toutes les pages et maquettes dans Chromium et échoue à la moindre erreur
```

**Règle de base :** on ne modifie jamais `sources/`. Tout ce qu'on construit à partir des sources (fusion des deux rendus, nouveaux modèles, pages) va en dehors de ce dossier et importe le code de `sources/`.

## Voir la galerie

```sh
python3 -m http.server 8000      # à la racine de web_engine
# puis ouvrir http://localhost:8000/
```

Un serveur est nécessaire (modules JS et `fetch`). web_power et certaines maquettes chargent three.js 0.170 depuis cdn.jsdelivr.net, comme les jeux.

- **Bâtiments** : chaque modèle seul, avec l'époque, la saison et la neige.
  - *web_royaumes* : rendu toon façon web_power. Le style des bâtiments change avec l'époque ; la saison change les champs, vignes, arbres, jardins et la hauteur du soleil ; « Incendié » montre la version en ruine.
  - *web_power* : l'époque filtre les installations disponibles cette année-là ; la saison teinte le sol, comme dans le jeu.
- **Monde vivant** : la carte du jeu avec sa nature (mer, rivières, forêts, champs, collines, montagnes) et ses animations, rendue par le moteur du jeu lui-même.
  - *web_royaumes* : le pipeline de `appliquer()` de `main.js` sur la carte et l'état du moteur. La page ne fait que retoucher l'état : époque (style, uniformes, éclairage public), saison, temps, neige au sol, heure, jour de marché, remparts, et tous les bâtiments posés autour de la capitale.
  - *web_power* : le jeu complet dans un cadre, piloté avec ses propres fonctions. Croissance des villes année par année jusqu'à l'époque, une installation de chaque type de l'époque raccordée à la capitale, puis le mois, un jour dont la météo correspond, et l'heure. Le temps continue de s'écouler.
- **Maquettes** : les maquettes graphiques des deux dépôts (armées, guerre, quartiers, rendu façon web_power, déchets) et Héliosphère (conquête spatiale, branche non fusionnée de web_power).

## Carte test

`carte-test/` (lien en haut de l'accueil) : une seule carte, comme dans un jeu, avec la frise des **14 époques** (4 de web_royaumes, 10 de web_power).

- **Une seule scène :** celle du moteur de web_royaumes, avec sa nature (mer, rivières, forêts, champs, montagnes), sa météo, l'heure du jour et ses animations.
- **Époques de web_royaumes :** les 56 bâtiments autour de la capitale, avec ses remparts, son armée et la vie des quartiers.
- **Époques de web_power :** les quartiers, les fermes et une installation de chaque type disponible cette année-là. Elles sont dessinées par les modèles de web_power eux-mêmes, avec leurs fumées et leurs éoliennes.
- **Pourquoi c'est possible :** `power.js` lit les fichiers de `sources/web_power/js` et les évalue avec `lot`, `put`, `fige`… de `toon.js`. Les deux jeux partagent le même vocabulaire de rendu, donc rien n'est recopié ni modifié. C'est le point de départ de la fusion des deux rendus.
- **Réglages :** saison, temps, neige au sol, heure. Le bouton « Bâtiments » ouvre la liste de l'époque : un clic y amène la caméra et entoure la case.

## Mettre à jour

```sh
outils/synchroniser.sh                 # clone depuis GitHub ; DEPOTS=/chemin/des/clones pour des clones locaux
outils/instantane-royaumes.sh          # si le moteur ou le format de l'état de web_royaumes a changé (cargo requis)
node outils/verifier.mjs               # playwright requis ; THREE_LOCAL=…/node_modules/three si le CDN est inaccessible
git diff --stat                        # ce qui a changé dans les jeux
```

Pour suivre une nouvelle branche non fusionnée, ajoutez-la à `BRANCHES` dans `outils/synchroniser.sh`.
