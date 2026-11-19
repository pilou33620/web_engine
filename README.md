# web_engine — base graphique des jeux

La base de travail pour les graphismes des jeux, en trois parties :

- **`lib/`, la bibliothèque graphique commune :** c'est la **seule** source des graphismes. Les jeux l'utilisent, et on ne la met à jour qu'ici. Voir [`lib/README.md`](lib/README.md).
- **`sources/`, l'intégralité de web_royaumes et de web_power :** des copies de référence.
- **Une galerie et une carte test pour tout voir, et des outils pour tenir la base à jour.**

| Source | Époques | Rôle prévu |
|---|---|---|
| `sources/web_royaumes/` | 1700 Ancien Régime · 1750 Lumières · 1789 Empire · 1816 Révolution industrielle | rendus des **époques passées** |
| `sources/web_power/` | 1900 → 2035 (10 ères) | rendus des **époques modernes** |

Les commits copiés sont dans `sources/SOURCES.json`. L'inventaire de chaque fichier graphique, avec son rôle, est dans [`sources/INVENTAIRE.md`](sources/INVENTAIRE.md).

## Organisation

```
index.html                 accueil : une source, puis Bâtiments / Monde vivant / Maquettes
lib/                       LA BIBLIOTHÈQUE GRAPHIQUE (version dans lib/package.json, journal dans lib/CHANGELOG.md)
  three/                   three.js r186 (+ BufferGeometryUtils)
  rendu/                   TOUS LES RENDUS, un seul moteur (style web_royaumes) : terrain, nature, météo, vie, bâtiments anciens,
                           bâtiments modernes (modernes.js, d'après web_power) ; rendu.css, img/, icons/
maquettes/                 L'ATELIER : toutes les maquettes (permanentes, jamais supprimées par la synchronisation)
sources/                   copies intégrales, jamais modifiées à la main (outils/synchroniser.sh les remplace)
  web_royaumes/            tout le dépôt (main) : web/ (rendu, ui, css, images), maquettes/, moteur Rust, tests…
  web_power/               tout le dépôt (main) : index.html, js/, css/, maquettes/, banc/, serveur…
  branches/                travail graphique qui n'existe que sur une branche non fusionnée
  SOURCES.json             commits copiés et liste des maquettes
  INVENTAIRE.md            inventaire graphique (généré)
carte-test/                la carte test : tous les bâtiments de toutes les époques (1700 → 2035) sur une seule carte
  carte.js                 la carte, la frise des époques, la liste des bâtiments
galerie/                   les pages de la galerie : elles chargent le code de sources/ tel quel
  visionneuse.css
  web_royaumes/            visionneuse.html (bâtiments), monde.html (monde vivant), donnees/ (carte et état du moteur)
  web_power/               visionneuse.html (bâtiments, dessinés par lib/rendu/modernes.js), monde.html (le jeu, piloté)
outils/
  synchroniser.sh          recopie les deux dépôts, régénère SOURCES.json et INVENTAIRE.md, signale les graphismes à reporter dans lib/
  installer.sh             installe lib/ dans le dossier graphismes/ d'un jeu (avec VERSION.json)
  jeu/                     à copier dans chaque jeu : maj-graphismes.sh (mise à jour, vérification en CI), graphismes.yml (action du lundi)
  instantane-royaumes.sh   régénère galerie/web_royaumes/donnees avec le vrai moteur Rust
  verifier.mjs             ouvre toutes les pages et maquettes dans Chromium et échoue à la moindre erreur
```

**Jeux branchés sur la bibliothèque :** web_royaumes et web_power, tous deux sur le moteur unique (voir le tableau de [`lib/README.md`](lib/README.md)).

**Règles de base :**
- **Les graphismes se modifient dans `lib/`,** jamais dans un jeu. La CI de chaque jeu le vérifie.
- **On ne modifie jamais `sources/`** (`outils/synchroniser.sh` la remplace).
- **La galerie et la carte test chargent `lib/` :** c'est le banc d'essai de la bibliothèque, lancé par la CI de web_engine à chaque envoi sur GitHub.

**Mettre à jour les graphismes de tous les jeux :**
1. Modifier `lib/` ici.
2. Lancer `node outils/verifier.mjs`.
3. Augmenter la version dans `lib/package.json` et l'expliquer dans `lib/CHANGELOG.md`.
4. Pousser sur main.

Chaque jeu reçoit alors une demande de fusion le lundi suivant, ou tout de suite avec `bash outils/maj-graphismes.sh` dans le jeu (ou le bouton « Run workflow » de son action « graphismes »).

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
- **Maquettes** : le dossier permanent `maquettes/` : armées, guerre, quartiers, rendu façon web_power, déchets, et Héliosphère (conquête spatiale, branche non fusionnée de web_power). Voir [`maquettes/LISEZMOI.md`](maquettes/LISEZMOI.md).

## Carte test

`carte-test/` (lien en haut de l'accueil) : une seule carte, comme dans un jeu, avec la frise des **14 époques** (4 de web_royaumes, 10 de web_power).

- **Une seule scène :** celle du moteur de web_royaumes, avec sa nature (mer, rivières, forêts, champs, montagnes), sa météo, l'heure du jour et ses animations.
- **Époques de web_royaumes :** les 56 bâtiments autour de la capitale, avec ses remparts, son armée et la vie des quartiers.
- **Époques modernes (d'après web_power) :** les quartiers, les fermes, une installation de chaque type disponible cette année-là, un tronçon de chaque tension de ligne et un chantier (la dernière époque montre aussi le futur : la fusion), dessinés par `lib/rendu/modernes.js`, avec les animations de web_power : fumées, éoliennes au vent, fenêtres allumées la nuit, courant dans les lignes, rebond de construction. Le catalogue de `modernes.js` dit quelles installations existent à chaque époque.
- **Réglages :** saison, temps, neige au sol, heure. Le bouton « Bâtiments » ouvre la liste de l'époque : un clic y amène la caméra et entoure la case.

## Mettre à jour

```sh
outils/synchroniser.sh                 # clone depuis GitHub ; DEPOTS=/chemin/des/clones pour des clones locaux
outils/instantane-royaumes.sh          # si le moteur ou le format de l'état de web_royaumes a changé (cargo requis)
node outils/verifier.mjs               # playwright requis ; THREE_LOCAL=…/node_modules/three si le CDN est inaccessible
git diff --stat                        # ce qui a changé dans les jeux
```

Pour suivre une nouvelle branche non fusionnée, ajoutez-la à `BRANCHES` dans `outils/synchroniser.sh`.
