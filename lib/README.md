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
| `guerre` | `rendu/` : `guerre_commun`, `remparts`, `forts`, `sieges`, `marine`, `espions`, `agents` | `ancien` |
| `defense` | `rendu/defense.js` : le tower defense (tours, ennemis, projectiles, effets, villes à défendre) | `ancien` |
| `rendu` | tout (les jeux d'avant la 2.15.0) | toutes |

Depuis la 2.15.0, **les parties sont des listes de fichiers de `rendu/`** (dans `outils/installer.sh`) : un jeu qui prend moins de parties a moins
de fichiers, mais les chemins d'import ne changent pas (`graphismes/rendu/…`). Le socle ne dépend ni de `monde.js` ni de la guerre :
`monde.js` s'inscrit lui-même auprès de `vie.js` (`MONDE`) et de `ambiance.js` (`toitsDe`) quand il est chargé. L'installateur vérifie
que chaque import d'un fichier installé trouve son fichier, et échoue sinon.

| Module de `rendu/` | Rôle |
|---|---|
| `scene.js`, `toon.js` | la scène, la caméra et la lumière ; l'ombrage toon et les contours, les briques des modèles (`lot`, `put`, `fige`, `boite`, `cyl`, `cone`, `sphere`) |
| `plateau.js` | le terrain et la nature : cases, mer, rivières, bras de mer, forêts (les arbres ploient au vent), collines, montagnes, champs, saisons et neige |
| `modeles.js` | les bâtiments anciens (styles Ancien Régime, Lumières, Empire, Révolution industrielle) et les armées |
| `modernes.js` | les bâtiments modernes : installations électriques, lignes (`pylone`, `BAT.ligne15`…`ligne400`), eau, déchets, quartiers, fermes ; leur catalogue (`INSTALLATIONS`, `QUARTIERS`) et les époques modernes (`EPOQUES`) ; les parties mobiles (`piece`) et leur animation (`modele`, `animer`) |
| `animations.js` | la vie des bâtiments anciens hors partie : `animationsAncien(cle, epoque, boites, couleur)`, une recette par bâtiment (artisans, porteurs, passants, charrettes, bêtes, soldats, wagonnets, train) posée dans ses espaces libres (deux lignes de la recette seulement en qualité légère) ; `bivouacAncien(palier, couleur)`, l'armée au repos ; `maillageEnChantier({ cle, couleur, epoque, av })`, un bâtiment ancien monté à mesure des travaux sous ses échafaudages, ouvriers au travail ; animés par `modele()` et `animer()` |
| `antiques.js` | l'Antiquité : bâtiments gaulois (bois, torchis, chaume) et romains, armées gauloises et romaines (`ANT`), leur catalogue (`ANTIQUES`) ; assemblés et animés par `modele()` et `animer()` de `modernes.js` |
| `traces.js`, `chroniques.js` | les traces de bataille ; les grands événements de web_royaumes (incendies, épidémies, couronnements, révoltes, mariages, fêtes) |
| `crises.js` | les crises de web_power : panaches, chutes des barrages, reflets des panneaux solaires, blackout |
| `monde.js`, `vie.js`, `quartiers.js` | ce qui vit sur le plateau : bâtiments posés, fumées, drapeaux, habitants, bêtes, bateaux, vie des quartiers |
| `meteo.js`, `routes.js`, `boue.js`, `ambiance.js`, `nuit.js`, `faune.js`, `eau.js`, `etiquettes.js` | le temps et l'heure du jour ; les routes ; la pluie (routes boueuses et mouillées, flaques, crue, eau sale, traces de boue des armées) ; brume du matin, feuilles d'automne, givre sur les toits ; les bannières et étiquettes HTML. Les effets suivent `climat` (vie.js) : un jeu peut y poser `pollution` et `eauSale` |
| `remparts.js`, `forts.js`, `sieges.js`, `marine.js`, `espions.js`, `brouillard.js`, `guerre_commun.js` | la guerre : remparts, forts, sièges, flottes, espions, brouillard de guerre |
| `agents.js` | les agents sur la carte (espion, gentilhomme, prêtre, diplomate) : `maillageAgent`, `jeterAgent` ; les scènes courtes de mission : `sceneMission`, `finirMissions` |
| `defense.js` | le tower defense, dans le style du moteur : les quinze époques (`ERES`) en cinq styles, `tour(role, ere, niveau, { pop })` (tête qui pivote, animations au repos) et `tirer(t)` (recul, fumée, éclair), `ennemi(genre, ere)`, `avancer(e, d, dt)` (jambes, roues, hélices), `abattre(e)`, `toucher(e)`, `piege(role, ere)` et `declencher(p)` (pièges animés), `projectile(genre)` et `suivreTir(p)`, effets (`explosion`, `eclat`, `eclaboussure`, `rayon`, `chute`), `anneauPortee`, `barreVie`, `batimentVille` |

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

### Qualité, vue de loin, première image, heure (2.31.0)

- **Réglage de qualité (`scene.js`) :** `qualite` (lecture) et `reglerQualite(niveau, options)`. `niveau` : `'leger'`, `'normal'`,
  `'riche'`, ou `null` pour ne changer que les options. Options facultatives : `retenir: false` (le niveau n'est pas enregistré comme
  le choix de l'appareil, pour une qualité automatique), `echelle` (facteur de la définition, par exemple `0.7`), `decor: false`
  (décor clairsemé : `plateau.js` ne refait que le décor, pas les cases), `vie: false` (les figures de `vie.js` et `quartiers.js`
  ne bougent plus et disparaissent, sans rien rebâtir). L'anticrénelage est choisi une fois, à la création du moteur de rendu :
  coupé en qualité légère (celle de l'adresse `?qualite=`, celle qui est enregistrée, sinon celle qui est devinée), ou forcé par
  `?aa=0` / `?aa=1` (`qualite.aa`).

```js
S.reglerQualite('leger', { retenir: false, echelle: 0.85 });  // un palier automatique : rien n'est enregistré
S.reglerQualite(null, { decor: false, vie: false });           // le palier le plus sobre, sans rebâtir la fenêtre
```

- **Hexagones simples pour la vue de loin (`plateau.js`) :** `hexagonesSimples(true)` puis `construire(…)` : cases sans flancs cachés
  ni dessous (identiques à l'écran), décor sans contours ni pièces de moins de 0,1, cônes sans fond, buttes à 20 faces ; les routes
  perdent leurs contours. Trois à quatre fois moins de triangles pour une grande carte vue de loin ; à réserver aux hexagones de
  moins d'une trentaine de pixels à l'écran (de près, les sillons et les troncs manquent). Pris à la reconstruction suivante ;
  `casesSimples()` dit ce qui est bâti. Par défaut (`false`), rien ne change.
- **Première image (`scene.js`) :** `await prechauffer()` une fois la scène posée (avec `decorProgressif`, quand `decorEnCours()` est
  faux) : les programmes des shaders sont compilés pendant le chargement plutôt qu'à la première image.
- **Heure sans `meteo.js` (`nuit.js`) :** un jeu qui pilote son heure appelle `eclairage('jour' | 'aube' | 'crepuscule' | 'nuit')`
  (ou des poids `{ jour, aube, nuit, phase }`) à chaque changement d'heure : `climat` et les consignes de lumière de la scène sont
  posés, et les fenêtres, les lueurs et les feux des phares s'allument la nuit. Avec `meteo.js`, c'est son cycle ou `forcerHeure()`
  qui décide (`forcerHeure` seul ne fait rien sans `meteo.js`).

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

### Agents sur la carte (2.34.0)

- **Les agents (`agents.js`) :** `maillageAgent({ type, couleur, epoque, marche, cache, niveau, leger })` rend un `THREE.Group` à l'échelle
  0,1 (comme `maillageTroupe`, face à +z), géométries fusionnées en cache par type, couleur et époque. `type` : `'espion'` (manteau sombre au
  col relevé, écharpe du camp, tricorne puis chapeau mou, lanterne sourde), `'gentilhomme'` (habit brodé d'or à la couleur du camp, perruque
  en 1700, cheveux poudrés aux Lumières, naturels ensuite, épée au côté), `'pretre'` (soutane, pèlerine, ceinture du camp, croix d'or, chapeau
  rond, bréviaire), `'diplomate'` (habit de cour crème puis uniforme bleu brodé, écharpe en sautoir du camp, porte-documents) ; `epoque` :
  `'ancien'`, `'lumieres'`, `'empire'`, `'industrie'` ; `niveau` (1 à 5) : les étoiles sur le socle à la couleur du camp ; `leger` (par
  défaut, la qualité légère) : la figurine d'un bloc. Animé tant qu'il est dans la scène (masqué, il ne coûte rien) : au repos il regarde à
  gauche, à droite, puis porte la main à son chapeau (le prêtre bénit ; d'un bloc, il pivote doucement) ; `userData.marche = true` : il
  marche au pas (le jeu le déplace et l'oriente lui-même) ; `userData.cache = true` : silhouette translucide sans contours et petit œil barré
  au-dessus. Les deux se changent à tout moment, sans rien rebâtir. `jeterAgent(grp)` le retire (tout est partagé, rien à libérer).
  `TYPES_AGENT` : les quatre types.
- **Les scènes de mission :** `sceneMission({ type, position, case, couleurs, reussite, duree, epoque, echelle, cap, agent, parent })` pose
  une scène courte au point donné (`position` : `{ x, y, z }` ou `[x, y, z]`, sinon `case` : une case du plateau), la joue et la retire
  toute seule ; elle rend sa durée en ms (0 pour un type inconnu). `type` : `'duel'` (deux gentilshommes, les lames se croisent, l'un tombe),
  `'sabotage'` (l'espion allume la mèche ; le feu prend, fumée noire, la palissade s'effondre), `'assassinat'` (une silhouette sombre approche,
  la cible s'efface), `'espionnage'` (l'espion observe derrière un buisson, une feuille s'envole de la table vers lui), `'apaisement'` (la
  cloche sonne, le prêtre bénit, la foule agitée se calme et s'incline), `'diplomate'` (diplomate reçu : ses couleurs hissées au mât,
  révérence), `'pris'` (agent pris : deux gardes l'encadrent et l'emmènent). `couleurs` : `[camp de l'agent, camp adverse]` ; `reussite` :
  la mission de l'agent réussit (sinon : l'agent tombe, la mèche fait long feu, la cible pare, la feuille s'envole au loin, la foule
  s'échauffe, le drapeau redescend ; pour `'pris'`, réussite : il s'échappe) ; une marque ✓ ou ✗ paraît aux trois quarts. `duree` : en ms
  (par défaut 4 800 à 6 000) ; `echelle` : celle des figurines (0,1 ; un jeu qui grossit ses troupes passe la même) ; `cap` : rotation de la
  scène (0 : les acteurs de profil pour la caméra du plateau) ; `agent` : le type de l'agent pris ; `parent` : la scène par défaut.
  `finirMissions()` arrête et retire les scènes en cours ; `TYPES_MISSION` : les sept types. En qualité légère, moins de pieux, de gens et
  de particules. Maquette : `maquettes/web_engine/agents.html`.

```js
const a = maillageAgent({ type: 'espion', couleur: '#3b6fd1', epoque: 'lumieres', niveau: 3 });
a.position.set(x, y, z); a.scale.multiplyScalar(1.8); scene.add(a);
a.userData.marche = true; a.rotation.y = Math.atan2(dx, dz);   // en route
a.userData.cache = true;                                         // caché
jeterAgent(a);
const ms = sceneMission({ type: 'duel', position: { x, y, z }, couleurs: ['#3b6fd1', '#c0392b'], reussite: true, epoque: 'empire', echelle: 0.18 });
```

### Bras de mer (2.33.0)

- **Les bras de mer étroits (`plateau.js`) :** champ facultatif `bras` de la carte donnée à `construire()`, à côté de `rivieres`.
  Chaque bras est une chaîne de cases voisines, du fond vers la mer (comme une rivière d'amont en aval), qui finit par la case d'eau
  où il débouche (un détroit commence et finit par une case d'eau) : une liste de cases, ou `{ cases, largeur }` (`largeur` : facteur
  de la largeur, 1 par défaut). Sur les cases de terre, un ruban d'eau de mer (le matériau translucide de la mer, qui suit le gel),
  étroit au fond (0,1 de demi-largeur), qui s'élargit en trompe jusqu'à l'embouchure (0,44), descend au niveau de la mer et s'y fond
  dans la case d'eau ; dessous, un fond de sable bordé d'un mince liseré de roche. Ni berge de sable, ni cascade, ni barques
  (`vie.js` ne lit que `rivieres`) ; les arbres et les rochers s'en écartent comme d'une rivière. Sans `bras`, rien ne change.
  Le champ `riviere` des cases reste au jeu (ponts, routes). Maquette : `maquettes/web_engine/bras-de-mer.html`.

```js
plateau.construire({ ...carte, bras: [[fond, case2, case3, mer], { cases: estuaire, largeur: 1.3 }] });
```

### Troupes en campagne (2.32.0)

- **Une armée vue de près sur une carte de campagne (`modeles.js`) :** `maillageTroupe({ couleur, palier, armes, marche, leger })` rend
  un petit groupe de figurines (face à +z, à l'échelle 0,1, géométries en cache) d'après ce que compte l'armée, `armes = { inf, leg,
  cav, art }` (effectifs ou parts) : le porte-drapeau, l'infanterie de ligne (piquiers au départ, grenadier ensuite), des tirailleurs,
  un ou deux cavaliers, un canon et son servant, 10 figurines en tout (6 en qualité légère, `leger` par défaut) ; `compoTroupe(armes,
  leger)` donne ce compte. Au repos : en carré, au bivouac (tentes et feu) ; `marche: true` : en colonne courte, cavalerie en tête,
  canon attelé en queue. Le drapeau flotte, et la troupe marche au pas quand `userData.avance` est vrai, tant que le groupe est dans la
  scène (masqué, il ne coûte rien). `jeterTroupe(grp)` le retire et libère son drapeau. Maquette : `maquettes/web_engine/troupes.html`.

```js
const t = maillageTroupe({ couleur: '#3b6fd1', palier: 0, armes: { inf: 1500, leg: 300, cav: 400, art: 300 }, marche: true });
t.position.set(x, y, z); t.rotation.y = Math.atan2(dx, dz); t.userData.avance = true; scene.add(t);
```
