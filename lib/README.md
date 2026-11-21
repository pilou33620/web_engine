# Bibliothèque graphique web_engine

La bibliothèque graphique commune des jeux. Elle vit dans `web_engine/lib/`, et chaque jeu en garde une copie dans son propre dossier `graphismes/`.

- **Une seule source :** on modifie les graphismes **uniquement dans web_engine**. Les jeux reçoivent la nouvelle version par une commande, ou par la demande de fusion automatique du lundi.
- **Pourquoi une copie plutôt qu'un sous-module ou un CDN :** le jeu continue de marcher hors ligne (Raspberry Pi, réseau local), avec un simple `git pull` ou un zip. Un sous-module ne suivrait pas les mises à jour par `git pull`, et un CDN couperait le jeu hors ligne.
- **Version :** elle figure dans `package.json` ; les changements sont décrits dans `CHANGELOG.md`. Dans un jeu, `graphismes/VERSION.json` indique la version et le commit de web_engine installés.

## Contenu

**Tous les rendus sont dans un seul dossier, `rendu/`.** Un seul moteur, celui du style web_royaumes, dessine le terrain, la nature (forêts, montagnes, rivières, champs, mer), la météo, l'heure du jour, la vie, les bâtiments anciens (1700 → 1816) et les bâtiments modernes (1900 → 2035). Les bâtiments modernes reprennent les modèles de web_power, qui ne fournit que ceux-là.

| Partie | Contenu | A besoin de |
|---|---|---|
| `three` | `three/` : three.js r186 (`three.module.js`, `three.core.js`) et `addons/utils/BufferGeometryUtils.js` : une bibliothèque tierce, pas un rendu | — |
| `socle` | `rendu/` : `scene` (et le réglage de qualité), `toon`, `plateau`, `meteo`, `vie`, `boue`, `ambiance`, `nuit`, `faune`, `eau`, `routes`, `brouillard`, `etiquettes`, `rendu.css` | `three` |
| `moderne` | `rendu/modernes.js`, `rendu/chantiers.js`, `rendu/rail.js` | `socle` |
| `antique` | `rendu/antiques.js` | `moderne` |
| `ancien` | `rendu/` : `modeles`, `monde`, `quartiers`, `animations`, `chroniques`, `img/` (illustrations des événements, SVG), `icons/` (icônes de l'application, PNG) | `socle`, `moderne`, `antique`, `guerre` |
| `guerre` | `rendu/` : `guerre_commun`, `remparts`, `forts`, `sieges`, `marine`, `espions` | `ancien` |
| `defense` | `rendu/defense.js` : le tower defense (tours, ennemis, projectiles, effets, villes à défendre) | `ancien` |
| `rendu` | tout (les jeux d'avant la 2.15.0) | toutes |

Depuis la 2.15.0, **les parties sont des listes de fichiers de `rendu/`** (dans `outils/installer.sh`) : un jeu qui prend moins de parties a moins
de fichiers, mais les chemins d'import ne changent pas (`graphismes/rendu/…`). Le socle ne dépend ni de `monde.js` ni de la guerre :
`monde.js` s'inscrit lui-même auprès de `vie.js` (`MONDE`) et de `ambiance.js` (`toitsDe`) quand il est chargé. L'installateur vérifie
que chaque import d'un fichier installé trouve son fichier, et échoue sinon.

| Module de `rendu/` | Rôle |
|---|---|
| `scene.js`, `toon.js` | la scène, la caméra et la lumière ; l'ombrage toon et les contours, les briques des modèles (`lot`, `put`, `fige`, `boite`, `cyl`, `cone`, `sphere`) |
| `plateau.js` | le terrain et la nature : cases, mer, rivières, forêts, collines, montagnes, champs, saisons et neige |
| `modeles.js` | les bâtiments anciens (styles Ancien Régime, Lumières, Empire, Révolution industrielle) et les armées |
| `modernes.js` | les bâtiments modernes : installations électriques, lignes (`pylone`, `BAT.ligne15`…`ligne400`), eau, déchets, quartiers, fermes ; leur catalogue (`INSTALLATIONS`, `QUARTIERS`) et les époques modernes (`EPOQUES`) ; les parties mobiles (`piece`) et leur animation (`modele`, `animer`) |
| `animations.js` | la vie des bâtiments anciens hors partie : `animationsAncien(cle, epoque, boites, couleur)`, une recette par bâtiment (artisans, porteurs, passants, charrettes, bêtes, soldats, wagonnets, train) posée dans ses espaces libres ; `bivouacAncien(palier, couleur)`, l'armée au repos ; animés par `modele()` et `animer()` |
| `antiques.js` | l'Antiquité : bâtiments gaulois (bois, torchis, chaume) et romains, armées gauloises et romaines (`ANT`), leur catalogue (`ANTIQUES`) ; assemblés et animés par `modele()` et `animer()` de `modernes.js` |
| `traces.js`, `chroniques.js` | les traces de bataille ; les grands événements de web_royaumes (incendies, épidémies, couronnements, révoltes, mariages, fêtes) |
| `crises.js` | les crises de web_power : panaches, chutes des barrages, reflets des panneaux solaires, blackout |
| `monde.js`, `vie.js`, `quartiers.js` | ce qui vit sur le plateau : bâtiments posés, fumées, drapeaux, habitants, bêtes, bateaux, vie des quartiers |
| `meteo.js`, `routes.js`, `boue.js`, `ambiance.js`, `nuit.js`, `faune.js`, `eau.js`, `etiquettes.js` | le temps et l'heure du jour ; les routes ; la pluie (routes boueuses et mouillées, flaques, crue, eau sale, traces de boue des armées) ; brume du matin, feuilles d'automne, givre sur les toits ; les bannières et étiquettes HTML. Les effets suivent `climat` (vie.js) : un jeu peut y poser `pollution` et `eauSale` |
| `remparts.js`, `forts.js`, `sieges.js`, `marine.js`, `espions.js`, `brouillard.js`, `guerre_commun.js` | la guerre : remparts, forts, sièges, flottes, espions, brouillard de guerre |
| `defense.js` | le tower defense : les quinze époques (`ERES`) en cinq styles, `tour(role, style, niveau)` (tête qui pivote, bouche du tir), `ennemi(genre, style, couleur)`, `projectile(genre)`, effets (`explosion`, `eclat`, `eclaboussure`, `rayon`, `chute`), `anneauPortee`, `barreVie`, `batimentVille` |

### Mise en route

- **La page :** le moteur démarre à l'import de `scene.js`. La page doit contenir `<canvas id="carte">`, `<div id="etiquettes">` et `<div id="eclair">`, et charger `rendu/rendu.css`.
- **Une partie complète :** on donne au moteur une carte et un état de partie au format du serveur de web_royaumes, dans l'ordre de `appliquer()` de son `main.js` :

```js
import * as plateau from './graphismes/rendu/plateau.js';
import { initMonde, synchroniser } from './graphismes/rendu/monde.js';
import { majVie } from './graphismes/rendu/vie.js';
import { majQuartiers } from './graphismes/rendu/quartiers.js';
import { appliquerMeteo } from './graphismes/rendu/meteo.js';

initMonde(regles); plateau.construire(carte);
plateau.majEtat(etat); plateau.majSaison(etat.saison, etat.meteo.neige_sol); synchroniser(etat);
majVie(etat); majQuartiers(etat); appliquerMeteo(etat.meteo, etat.saison);
```

- **Les bâtiments modernes :**

```js
import { BAT, QBAT, bFerme, modele, animer, INSTALLATIONS, EPOQUES } from './graphismes/rendu/modernes.js';
const m = modele(BAT.nucleaire, 1);   // à l'échelle du plateau (une case de 10 → 1) ; modele(…, { chantier: true }) : en travaux
m.groupe.position.set(x, y, z); scene.add(m.groupe);
animer(m, { pop: true });             // fumées, éoliennes au vent, fenêtres la nuit, courant des lignes, rebond de construction
const en1960 = INSTALLATIONS.filter(t => t.an <= 1960 && !(t.fin && t.fin < 1960));
```

- **Un modèle neuf :** utilisez les briques de `toon.js`, en unités de 10 par case, puis ramenez le groupe à l'échelle du plateau (× 0,1, `ECH_BAT`).
- **Exemples complets :** `web_engine/carte-test/carte.js` (toutes les époques sur une carte) et `web_engine/galerie/web_royaumes/monde.html`.

## Jeux qui utilisent la bibliothèque

| Jeu | Dossier | `PARTIES` |
|---|---|---|
| web_royaumes | `web/graphismes/` | `ancien guerre` (donc tout ; servi par le serveur Rust) |
| web_defense | `graphismes/` | `defense` (donc tout ; le jeu est statique : une page et ses modules) |
| web_power | `graphismes/` | `moderne` (avec `socle` et `three` ; le moteur unique depuis la 2.3.0 : le jeu dessine dans un groupe à son échelle, voir son `js/01-moteur.js`) |

## Utiliser la bibliothèque dans un jeu

1. **Copier le script :** placez `web_engine/outils/jeu/maj-graphismes.sh` dans `outils/` du jeu, puis réglez deux lignes : `PARTIES=`, les parties dont le jeu a besoin (leurs dépendances suivent toutes seules), et `DEST=`, si le dossier servi n'est pas la racine (par exemple `DEST=web/graphismes`).
2. **Installer :** lancez `bash outils/maj-graphismes.sh`. Le dossier est créé avec ces parties seulement, et `VERSION.json`. Commitez-le.
3. **Charger :** importez les modules depuis ce dossier (voir plus haut).
4. **Vérifier en CI :** ajoutez une étape `bash outils/maj-graphismes.sh --verifier`. Elle échoue si quelqu'un modifie les graphismes dans le jeu au lieu de web_engine.
5. **Recevoir les mises à jour :** copiez `web_engine/outils/jeu/graphismes.yml` dans `.github/workflows/`. Chaque lundi, ou à la demande, il ouvre une demande de fusion, **seulement si l'une des parties du jeu a changé**. Une version qui ne touche pas ses parties ne lui propose rien.

## Faire évoluer la bibliothèque

1. **Modifier :** changez `lib/` dans web_engine.
2. **Vérifier :** `node outils/verifier.mjs` (la galerie et la carte test utilisent `lib/`).
3. **Versionner :** augmentez la version dans `lib/package.json` et décrivez le changement dans `lib/CHANGELOG.md`.
4. **Publier :** poussez sur main. Les jeux reçoivent la demande de fusion le lundi suivant, ou tout de suite avec `bash outils/maj-graphismes.sh` (ou le bouton « Run workflow » de l'action « graphismes »).
