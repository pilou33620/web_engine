# Bibliothèque graphique web_engine

La bibliothèque graphique commune des jeux. Elle vit dans `web_engine/lib/`, et chaque jeu en garde une copie dans son propre dossier `graphismes/`.

- **Une seule source :** on modifie les graphismes **uniquement dans web_engine**. Les jeux reçoivent la nouvelle version par une commande, ou par la demande de fusion automatique du lundi.
- **Pourquoi une copie plutôt qu'un sous-module ou un CDN :** le jeu continue de marcher hors ligne (Raspberry Pi, réseau local), avec un simple `git pull` ou un zip. Un sous-module ne suivrait pas les mises à jour par `git pull`, et un CDN couperait le jeu hors ligne.
- **Version :** elle figure dans `package.json` ; les changements sont décrits dans `CHANGELOG.md`. Dans un jeu, `graphismes/VERSION.json` indique la version et le commit de web_engine installés.

## Contenu

| Dossier | Contenu | Forme |
|---|---|---|
| `three/` | three.js r186 (`three.module.js`, `three.core.js`) et `addons/utils/BufferGeometryUtils.js` | modules ES |
| `royaumes/` | moteur et rendu de web_royaumes : scène, toon, plateau (terrain, nature), modèles, vie, quartiers, météo, routes, remparts, forts, marine, sièges, espions, brouillard, étiquettes ; `rendu.css` | modules ES |
| `royaumes/img/`, `royaumes/icons/` | illustrations des événements (SVG) et icônes de l'application (PNG) de web_royaumes | fichiers |
| `power/` | outils, moteur 3D, modèles, ambiance et ciel de web_power | scripts classiques |
| `power/pont.js` | les modèles de web_power utilisables dans la scène du moteur royaumes | module ES |

### `royaumes/` : le moteur en modules ES

- **Mise en route :** le moteur démarre à l'import de `scene.js`. La page doit contenir `<canvas id="carte">`, `<div id="etiquettes">` et `<div id="eclair">`, et charger `royaumes/rendu.css`.
- **Pilotage :** on donne au moteur une carte et un état de partie au format du serveur de web_royaumes. L'ordre d'appel est celui de `appliquer()` dans son `main.js` :

```js
import * as plateau from './graphismes/royaumes/plateau.js';
import { initMonde, synchroniser } from './graphismes/royaumes/monde.js';
import { majVie } from './graphismes/royaumes/vie.js';
import { majQuartiers } from './graphismes/royaumes/quartiers.js';
import { appliquerMeteo } from './graphismes/royaumes/meteo.js';

initMonde(regles); plateau.construire(carte);
plateau.majEtat(etat); plateau.majSaison(etat.saison, etat.meteo.neige_sol); synchroniser(etat);
majVie(etat); majQuartiers(etat); appliquerMeteo(etat.meteo, etat.saison);
```

- **Briques de modélisation :** pour un modèle neuf, `toon.js` fournit `lot`, `put`, `fige`, `boite`, `cyl`, `cone`, `sphere`, `MAT` et `CONT` (ombrage toon et contours bruns). Les unités sont de 10 par case, et le groupe est ramené à l'échelle du plateau par `ECH_BAT` (0,1).
- **Exemples complets :** `web_engine/galerie/web_royaumes/monde.html` et `web_engine/carte-test/carte.js`.

### `power/` : les scripts de web_power

- **Chargement :** ce sont des scripts classiques qui partagent leurs déclarations, chargés avec `defer` dans l'ordre de leurs numéros, entre les scripts du jeu. `01-outils.js` fournit le hasard, le bruit et la grille hexagonale. `03-moteur-3d.js`, `04-modeles.js`, `23-ambiance.js` et `24-ciel.js` utilisent les globales du jeu (terrain, villes, état `S`…).
- **three.js :** il arrive en module par une carte d'import :

```html
<script type="importmap">{ "imports": { "three": "./graphismes/three/three.module.js", "three/addons/": "./graphismes/three/addons/" } }</script>
<script type="module">
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
Object.assign(window, { THREE, mergeGeometries });
</script>
<script defer src="graphismes/power/01-outils.js"></script>
```

Une page qui doit aussi s'ouvrir directement en `file://` ne peut pas charger de module local : Chrome les refuse.
Dans ce cas, pointez la carte d'import vers le CDN, **à la même version** que `three/VERSION` :
`https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js` et `…/three@0.186.1/examples/jsm/`. Les scripts classiques de `power/` se chargent normalement en `file://`.
C'est ce que fait web_power.

### `power/pont.js` : les modèles de web_power dans le moteur royaumes

```js
import { chargerPower, modele } from './graphismes/power/pont.js';
const P = await chargerPower();                  // P.BAT (installations), P.QBAT (quartiers), P.bFerme, P.rotor
const { groupe, fumees, rotors } = modele(P.BAT.nucleaire, 1);
scene.add(groupe);                               // à l'échelle du plateau royaumes
```

`chargerPower([urls])` évalue aussi, si on les lui donne, les scripts de catalogue d'un jeu (`TYPES`, `ERES`, `QUART`). C'est ainsi que la carte test sait quelles installations existent à chaque époque.

## Jeux qui utilisent la bibliothèque

| Jeu | Dossier | Parties utilisées |
|---|---|---|
| web_royaumes | `web/graphismes/` | `three/`, `royaumes/` avec ses images et icônes (servi par le serveur Rust) |
| web_power | `graphismes/` | `power/` (servi par `serveur.py` ; three.js r186 depuis le CDN, pour l'ouverture en `file://`) |

## Utiliser la bibliothèque dans un jeu

1. **Copier le script :** placez `web_engine/outils/jeu/maj-graphismes.sh` dans `outils/` du jeu, et changez la ligne `DEST=` si le dossier servi n'est pas la racine (par exemple `DEST=web/graphismes`).
2. **Installer :** lancez `bash outils/maj-graphismes.sh`. Le dossier est créé, avec `VERSION.json`. Commitez-le.
3. **Charger :** importez les modules depuis ce dossier (voir plus haut).
4. **Vérifier en CI :** ajoutez une étape `bash outils/maj-graphismes.sh --verifier`. Elle échoue si quelqu'un modifie les graphismes dans le jeu au lieu de web_engine.
5. **Recevoir les mises à jour :** copiez `web_engine/outils/jeu/graphismes.yml` dans `.github/workflows/`. Chaque lundi, ou à la demande, il ouvre une demande de fusion avec la dernière version.

## Faire évoluer la bibliothèque

1. **Modifier :** changez `lib/` dans web_engine.
2. **Vérifier :** `node outils/verifier.mjs` (la galerie et la carte test utilisent `lib/`).
3. **Versionner :** augmentez la version dans `lib/package.json` et décrivez le changement dans `lib/CHANGELOG.md`.
4. **Publier :** poussez sur main. Les jeux reçoivent la demande de fusion le lundi suivant, ou tout de suite avec `bash outils/maj-graphismes.sh` (ou le bouton « Run workflow » de l'action « graphismes »).
