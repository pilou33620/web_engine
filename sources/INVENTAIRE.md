# Inventaire graphique des sources

Généré par `outils/synchroniser.sh` : ne pas modifier à la main.

## web_royaumes — `6b93ff1` (2026-11-19)

| Fichier | Taille | Rôle (en-tête du fichier) |
|---|---:|---|
| `maquettes/armees.html` | 17 ko | Armées par technologie |
| `maquettes/guerre.html` | 283 ko | Guerre et diplomatie |
| `maquettes/quartiers.html` | 236 ko | Vie des quartiers |
| `maquettes/rendu-power.html` | 255 ko | Rendu façon web_power |
| `maquettes/source/LISEZMOI.md` | 0 ko |  |
| `maquettes/source/batiments.js` | 24 ko | Même façon de faire que web_power (04-modeles.js) : dalle hexagonale, maisons à toit en prisme, arbres boule, |
| `maquettes/source/guerre/batiments.js` | 24 ko | Même façon de faire que web_power (04-modeles.js) : dalle hexagonale, maisons à toit en prisme, arbres boule, |
| `maquettes/source/guerre/forts.js` | 33 ko | Tout est en unités du monde (une case = 1). Chaque ouvrage est un groupe posé au centre de sa case (y = haut de la case), porte au sud (+z, vers la caméra) ; |
| `maquettes/source/guerre/gen.py` | 2 ko | Assemble la maquette « Guerre et diplomatie » : scene.js + batiments.js + vie2.js + guerre.js + remparts.js dans page.html. |
| `maquettes/source/guerre/guerre.js` | 77 ko | Maquette. Même vocabulaire que le reste : pièces en boîtes en unités de web_power (une case = 10, réduite par l'échelle |
| `maquettes/source/guerre/page.html` | 34 ko | Guerre et diplomatie |
| `maquettes/source/guerre/remparts.js` | 34 ko | Tout est en unités du monde (une case = 1). L'enceinte suit le contour extérieur d'un groupe d'hexagones : la case de la mairie |
| `maquettes/source/guerre/scene.js` | 46 ko | Maquette : le plateau de Royaumes des Rives rendu comme web_power (toon 3 tons, contours bruns, hexagones étagés). |
| `maquettes/source/guerre/vie2.js` | 32 ko | Même façon de faire que l'ambiance : petits modèles en boîtes (unités de web_power), contours, va-et-vient simples. |
| `maquettes/source/quartiers/LISEZMOI.md` | 1 ko |  |
| `maquettes/source/quartiers/capture.cjs` | 2 ko |  |
| `maquettes/source/quartiers/gen.py` | 3 ko | Assemble la maquette « Vie des quartiers » en une page autonome : |
| `maquettes/source/quartiers/ou.cjs` | 1 ko |  |
| `maquettes/source/quartiers/page.html` | 23 ko | Vie des quartiers |
| `maquettes/source/quartiers/quartiers.js` | 150 ko | Les logements du jeu (modeles.js, collé plus haut) animés selon la météo, la saison, l'heure et l'époque. |
| `maquettes/source/scene.js` | 46 ko | Maquette : le plateau de Royaumes des Rives rendu comme web_power (toon 3 tons, contours bruns, hexagones étagés). |
| `maquettes/source/vie2.js` | 32 ko | Même façon de faire que l'ambiance : petits modèles en boîtes (unités de web_power), contours, va-et-vient simples. |
| `web/css/style.css` | 13 ko | Royaumes des Rives — interface (thème de la vidéo : bleu nuit, or, rubans colorés) |
| `web/graphismes/CHANGELOG.md` | 21 ko | Journal des versions de la bibliothèque graphique |
| `web/graphismes/README.md` | 8 ko | Bibliothèque graphique web_engine |
| `web/graphismes/VERSION.json` | 0 ko |  |
| `web/graphismes/package.json` | 0 ko |  |
| `web/graphismes/rendu/ambiance.js` | 11 ko | Petites touches du temps qui passe, toutes automatiques (elles suivent climat, posé par meteo.js) : |
| `web/graphismes/rendu/animations.js` | 17 ko | La vie des bâtiments anciens (modeles.js, 1700 → 1816) hors partie : artisans, porteurs, passants, charrettes, bêtes, soldats, |
| `web/graphismes/rendu/antiques.js` | 66 ko | Les bâtiments et les armées de l'Antiquité : Gaulois et Romains. Modèles du moteur, dans les conventions de modernes.js |
| `web/graphismes/rendu/boue.js` | 6 ko | Les routes sous la pluie : la terre devient boue, le pavé fonce comme mouillé, des flaques grandissent puis sèchent. |
| `web/graphismes/rendu/brouillard.js` | 15 ko | Le brouillard de guerre (maquettes/guerre.html) : trois états par case, d'après etat.explore et etat.visible. |
| `web/graphismes/rendu/chantiers.js` | 7 ko | Les chantiers vivants, communs aux jeux : échafaudages qui montent avec les travaux, ouvriers qui vont et viennent, |
| `web/graphismes/rendu/chroniques.js` | 24 ko | Ce qui arrive au royaume se voit (web_royaumes) : incendies, épidémies (croix, fumigations, charrette des morts), famine, |
| `web/graphismes/rendu/crises.js` | 8 ko | Les crises et les grands ouvrages qui vivent, communs aux jeux modernes (repère du plateau : une case de 1) : |
| `web/graphismes/rendu/eau.js` | 4 ko | L'eau qui vit, automatique : vagues qui viennent se briser sur les côtes, écume et embruns au pied des cascades ; |
| `web/graphismes/rendu/espions.js` | 16 ko | L'espionnage (maquettes/guerre.html) : l'espion en cape à l'écharpe du royaume, tricorne et lanterne (1700, Lumières), |
| `web/graphismes/rendu/etiquettes.js` | 2 ko | Étiquettes HTML posées sur la carte : bannières des villes (rang + nom, comme sur la vidéo), |
| `web/graphismes/rendu/faune.js` | 6 ko | Bêtes du ciel et de l'eau, automatiques : oiseaux migrateurs en V au printemps (vers le nord) et à l'automne (vers le sud), |
| `web/graphismes/rendu/forts.js` | 33 ko | Les forts d'armée et les retranchements (maquette validée : maquettes/guerre.html, source maquettes/source/guerre/forts.js). |
| `web/graphismes/rendu/guerre_commun.js` | 9 ko | Ce que partagent la marine et l'espionnage (maquettes/guerre.html) : écume des sillages, éclairs des canons, |
| `web/graphismes/rendu/icons/icon-180.png` | 9 ko |  |
| `web/graphismes/rendu/icons/icon-192.png` | 10 ko |  |
| `web/graphismes/rendu/icons/icon-512.png` | 27 ko |  |
| `web/graphismes/rendu/img/evenement-disette.svg` | 2 ko |  |
| `web/graphismes/rendu/img/evenement-inventeur.svg` | 7 ko |  |
| `web/graphismes/rendu/img/evenement-philosophe.svg` | 2 ko |  |
| `web/graphismes/rendu/marine.js` | 32 ko | La marine (maquettes/guerre.html) : navires aux couleurs du royaume (pavillon, flamme, liston) qui tanguent et laissent |
| `web/graphismes/rendu/meteo.js` | 18 ko | Le temps qu'il fait et l'heure du jour, rendus : pluie, neige, brouillard, orage (éclairs), nuages et leur ombre, |
| `web/graphismes/rendu/modeles.js` | 82 ko | Les modèles des bâtiments et des armées, dans le vocabulaire de web_power (maquette maquettes/rendu-power.html) : |
| `web/graphismes/rendu/modernes.js` | 47 ko | Les bâtiments modernes (1900 → 2035), modèles du moteur : installations électriques, lignes, eau, déchets, quartiers, fermes. |
| `web/graphismes/rendu/monde.js` | 24 ko | Ce qui vit sur le plateau et suit l'état de la partie : bâtiments (et chantiers), armées, bannières ; |
| `web/graphismes/rendu/nuit.js` | 10 ko | La nuit et l'eau qui brille, toutes automatiques (elles suivent climat, posé par meteo.js) : |
| `web/graphismes/rendu/plateau.js` | 36 ko | Le plateau, rendu comme web_power (maquettes/rendu-power.html) : hexagones séparés et étagés, ombrage toon en trois tons |
| `web/graphismes/rendu/quartiers.js` | 94 ko | La vie des quartiers (maquette maquettes/quartiers.html), sur les seuls bâtiments proches du centre du regard : |
| `web/graphismes/rendu/rail.js` | 4 ko | Voies ferrées et trains, pour un jeu qui trace ses lignes lui-même (web_power) : poserVoie(parent, pts, options) dessine |
| `web/graphismes/rendu/remparts.js` | 28 ko | Les remparts des villes : une amélioration à quatre niveaux (Palissade, Murailles, Bastions à la Vauban, Citadelle), |
| `web/graphismes/rendu/rendu.css` | 1 ko | Styles des éléments HTML du rendu : canevas #carte, étiquettes posées sur la carte (#etiquettes : bannières .ban et .barres des villes, |
| `web/graphismes/rendu/routes.js` | 7 ko | Les routes : tracées par le moteur entre les bâtiments et les villes, dessinées en rubans posés sur les cases |
| `web/graphismes/rendu/scene.js` | 11 ko | La scène 3D : moteur de rendu, caméra inclinée (glisser, pincer, tourner), lumières, boucle d'animation. |
| `web/graphismes/rendu/sieges.js` | 44 ko | Les sièges (maquette validée : maquettes/guerre.html, source maquettes/source/guerre/guerre.js) : le siège en règle d'une ville |
| `web/graphismes/rendu/toon.js` | 4 ko | Le rendu de web_power, commun à tout le plateau : ombrage dessin animé en trois tons et contours brun foncé. |
| `web/graphismes/rendu/traces.js` | 4 ko | Traces de bataille (web_royaumes) : là où l'on s'est battu, la terre est retournée, des cratères de boulets et des débris |
| `web/graphismes/rendu/vie.js` | 63 ko | La vie de la carte, comme la maquette rendu-power : fumées, charrettes, bêtes, faune des lisières, bateaux, oiseaux, |
| `web/graphismes/three/LICENSE` | 1 ko |  |
| `web/graphismes/three/VERSION` | 0 ko |  |
| `web/graphismes/three/addons/utils/BufferGeometryUtils.js` | 36 ko |  |
| `web/graphismes/three/three.core.js` | 1423 ko |  |
| `web/graphismes/three/three.module.js` | 647 ko |  |
| `web/index.html` | 6 ko |  |
| `web/js/api.js` | 1 ko | Les appels au serveur Rust (le moteur décide de tout ; la page affiche et envoie les ordres). |
| `web/js/bivouacs.js` | 3 ko | Les armées au repos (la nuit, ou hors des villes depuis un tour) : le bivouac de la bibliothèque (bivouacAncien, web_engine 2.12) à la place du bivouac simple de vie.js. |
| `web/js/main.js` | 23 ko | Royaumes des Rives : démarrage, écran d'accueil (réglage de la carte avec aperçu 3D), boucle des tours. |
| `web/js/ui.js` | 68 ko | L'interface : barre du haut, panneaux (construire, diplomatie, armées, royaume, menu), fiche d'une case |
| `web/manifest.webmanifest` | 0 ko |  |

## web_power — `1868d80` (2026-11-19)

| Fichier | Taille | Rôle (en-tête du fichier) |
|---|---:|---|
| `css/style.css` | 24 ko | GridMaster : plateau d'hexagones cartoon + panneaux de gestion. Tokens repris de web_office ; thème unique sombre, comme le jeu. |
| `index.html` | 9 ko | GridMaster |
| `js/00-appareil.js` | 0 ko | appareil : le téléphone se joue en portrait, la tablette et l'ordinateur en paysage |
| `js/01-moteur.js` | 1 ko | Le moteur unique de web_engine (graphismes/rendu) : il tient le canevas #carte, la caméra et ses gestes, la boucle d'images, |
| `js/01-outils.js` | 3 ko |  |
| `js/02-terrain.js` | 12 ko | Relief : e = amp·bruit + gu·u + gv·v + base − ile·(distance au centre). Les proportions de mer, collines, montagnes, forêts et plaines |
| `js/03-plateau.js` | 7 ko | Le moteur (js/01-moteur.js) dessine le plateau ; le jeu pose ses ouvrages, lignes, conduites et superpositions dans MONDE, |
| `js/05-catalogue.js` | 6 ko | mw : puissance ; capex M€ ; delai mois ; opex k€/MW/an ; cout €/MWh hors CO₂ ; co2 g/kWh ; ramp MW/min ; min MW |
| `js/06-eau.js` | 26 ko | Bilan par réseau connexe à chaque pas de 15 minutes : ressource, stocks des châteaux d'eau, fuites, qualité (6 paramètres), rejets. |
| `js/06b-dechets.js` | 24 ko | Un pas par jour, à minuit : chaque ville remplit ses bacs, les camions les vident (du lundi au samedi), |
| `js/06c-territoire.js` | 10 ko | Réseau de chaleur, fêtes et vacances, élections municipales, plan de crise, vieillissement des installations, |
| `js/07-epoques-rd.js` | 11 ko |  |
| `js/08-installations.js` | 12 ko | argent en M€ ; k : demande ; croit : rythme de croissance des villes (plus de croissance = plus difficile) |
| `js/09-lignes.js` | 12 ko | tracé au moindre coût : la montagne et la traversée d'un bras de mer peu profond coûtent plus cher, la haute mer est interdite |
| `js/10-reseau.js` | 5 ko | Jeux de barres : un par ouvrage ; un poste en a deux (225/400 kV « H » et 63 kV « B ») reliés par ses 2 autotransformateurs. |
| `js/11-meteo-demande.js` | 4 ko |  |
| `js/12-dispatch.js` | 3 ko | batteries : charge la nuit ou quand il y a du surplus, décharge à la pointe du soir |
| `js/13-simulation.js` | 19 ko | économie du pas (0,25 h) |
| `js/14-superpositions.js` | 5 ko |  |
| `js/15-camera.js` | 2 ko | Celles du moteur : glisser, pincer, tourner (clic droit ou deux doigts), molette, clavier (ZQSD, flèches, E et R). |
| `js/16-interface.js` | 29 ko |  |
| `js/17-panneaux.js` | 72 ko |  |
| `js/18-hud.js` | 9 ko |  |
| `js/19-vues.js` | 3 ko | Dans la vue d'un réseau, ses ouvrages ont un contour coloré et un anneau, ceux de l'autre réseau deviennent des fantômes. |
| `js/20-actions.js` | 36 ko |  |
| `js/21-partie.js` | 10 ko |  |
| `js/22-banc.js` | 22 ko | Aucune IA : chaque stratégie applique des règles fixes une fois par mois de jeu, ce qui rend le banc reproductible. |
| `js/23-ambiance.js` | 23 ko | Décor animé, sans effet sur la simulation. Tout est en instances : quelques centaines d'objets mis à jour à chaque image. |
| `js/24-ciel.js` | 8 ko | Rendus par le moteur (lumière, nuages, pluie, neige, brouillard, orage, saison et neige du plateau), d'après l'horloge et la météo du jeu. |
| `js/25-boucle.js` | 3 ko | une image : appelée par la boucle du moteur (qui fait ensuite la caméra et le rendu) |
| `maquettes/dechets.html` | 72 ko | Maquette Déchets |

## Branches non fusionnées

| Fichier | Rôle |
|---|---|
| `web_power-heliosphere/maquettes/conquete-spatiale.html` | Héliosphère |
