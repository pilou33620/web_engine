# Journal des versions de la bibliothèque graphique

Numérotation : on change le premier chiffre quand un jeu doit adapter son code (fonction renommée, format d'état modifié),
le deuxième pour un ajout (nouveau modèle, nouvelle animation), le troisième pour une correction.

## 2.12.0 — 2026-11-19

Les armées au repos et au travail :
- `animations.js` : `bivouacAncien(palier, couleur)`, l'armée de web_royaumes hors des rangs, à l'uniforme de son palier : tentes, faisceaux de fusils,
  feu de camp, cuisinier à la marmite, joueurs de cartes autour d'un tambour, dormeurs, sentinelle, chevaux au piquet, canon parqué ;
- `antiques.js` (armées gauloise et romaine) : bivouac gaulois (sanglier à la broche, buveurs, lutteurs, dormeurs), bivouac romain (tentes de cuir,
  joueurs de dés, marmite, aigle, sentinelle) ; retranchements en travaux (terrassiers, porteurs de terre, de rondins et de pieux, bûcheron,
  chef ou centurion qui surveille) ; positions défensives terminées : cercle de chariots gaulois, camp retranché romain (agger, palissade, tours,
  porte, lilia, sentinelles) ;
- carte complète : un bivouac par palier dans chaque époque, et une vue « Armées au repos et retranchements ».

## 2.11.0 — 2026-11-19

Tous les bâtiments de toutes les époques sont animés :
- `rendu/animations.js` (nouveau) : `animationsAncien(cle, epoque, boites, couleur)` donne la vie de chacun des 56 bâtiments de `modeles.js`,
  à chaque époque : artisans au travail, porteurs (sacs, tonneaux, caisses, seaux, poissons, minerai…), passants, charrettes et carrosses,
  bêtes (moutons, vaches, chevaux, âne, poules, chiens), soldats à l'uniforme de l'époque, enfants, wagonnets de mine, train de la gare,
  oiseaux ; chacun se place dans les espaces libres du bâtiment (ses emprises au sol), à l'échelle de ses portes ;
- `modeles.js` : chaque emprise de `boites` porte aussi sa hauteur (cinquième valeur), pour qu'une clôture basse n'empêche pas d'entrer dans l'enclos ;
- `antiques.js` exporte aussi `trajet`, `poule`, `mouton`, `chariot`, `ane`, `poisson` ;
- carte complète : chaque bâtiment ancien reçoit sa vie ; `#industrie-brasserie` (époque-clé) pour un gros plan.

## 2.10.0 — 2026-11-19

Les armées de web_royaumes (`modeles.js`, `maillageArmee`) deviennent un grand bataillon, validé sur la maquette `armees-propositions.html` :
- trois lignes de huit fantassins (24 au lieu de 6), piquiers au centre en 1700, grenadiers au bout ensuite, tirailleurs en avant à partir de 1825 ;
- l'officier et trois cavaliers à l'arrière, deux canons et leurs servants sur le flanc droit ;
- le fourgon (chariot de ravitaillement de 1832) est supprimé ; la garde (`maillageGarde`) ne change pas.

## 2.9.0 — 2026-11-19

Pour montrer tous les rendus hors partie (la carte complète) :
- `monde.js` : `animerPose(id, mesh, anim, couleur)` anime un bâtiment de `modeles.js` posé dans une vitrine (ailes du moulin, drapeaux,
  cheminées, fumées), `oublierPose(id)` le retire ;
- `vie.js` : `viderFumees()` efface les fumées en cours ;
- maquette `carte-complete.html` : les époques de 1700 à 1816 (les 56 bâtiments de web_royaumes à chaque époque) et leurs armées, palier par palier,
  avec l'Antiquité et les bâtiments modernes ; les vitrines n'ont plus de nuages (vus de loin, ils cachaient les bâtiments).

## 2.8.0 — 2026-11-19

Plus de Gaulois et de Romains, et plus de vie, dans `rendu/antiques.js` :
- nouveaux bâtiments : marché gaulois, cervoiserie (sanglier à la broche, buveurs), port de pêche (barque, pêcheur à la ligne, poisson qui saute) ;
  marché romain (macellum : tholos, balance, porteur d'amphores), boulangerie (pistrinum : meule tournée par un âne, four, boulanger), théâtre (acteurs masqués) ;
- clin d'œil rare au marché gaulois : quelques secondes toutes les 45 s, une bagarre au poisson dans un nuage de poussière ;
- chaque bâtiment existant gagne des animations : un paysan monte un sac au grenier par l'échelle et redescend sans, chariot qui passe la porte de
  l'oppidum, bûcheron, meule à bras, chaudron du chef, chien de berger, soufflet de la forge, porteurs, pèlerin, messager à cheval ; servante de la domus,
  porteur d'amphore, offrandes au temple, orateur du forum, nageur et serviteur des thermes, spectateurs qui bondissent, chariot sous l'aqueduc,
  vendangeur, canards du moulin, légionnaires à l'exercice et sentinelle du camp ;
- `trajet()` : quelqu'un qui suit un chemin en boucle et ne porte sa charge que sur certains tronçons ;
- `modernes.js` : deux mouvements de plus pour `piece()`, `'chemin'` (trajet en boucle) et `'rare'` (scène qui n'apparaît que de temps en temps).

## 2.7.0 — 2026-11-18

L'Antiquité entre dans la bibliothèque : `rendu/antiques.js`, dans les conventions de `modernes.js`, assemblé et animé par `modele()` et `animer()` :
- Gaulois (murs à poteaux de bois et torchis, toits de chaume) : maison ronde, maison longue, maison du chef, greniers sur pilotis, ferme, forge,
  atelier du potier, sanctuaire (nemeton), porte d'oppidum (murus gallicus), tour de guet ;
- Romains : domus, insula, temple, forum, thermes, amphithéâtre, aqueduc, villa rustica, moulin à eau, camp (castrum) ;
- armées : phalange gauloise (chef au casque ailé, carnyx), cavalerie gauloise, char de guerre, archers ; légion (aigle, centurion), tortue,
  cavalerie romaine, onagre et scorpion ;
- animations de chacun : fumées, feux et torches, forgeron, tour du potier, druide, gardes, bêtes, eau qui coule dans l'aqueduc et le moulin,
  roue du moulin, gladiateurs, oriflammes, troupes qui marchent au pas, flèches, onagre qui tire ;
- `modernes.js` : deux mouvements de plus pour `piece()`, `'marche'` (au pas) et `'coule'` (en boucle) ; `ex.lumiere` éclaire la nuit un dessin d'habitation ;
  `piece`, `oiseaux`, `fum`, `arbreVent`, `arbre`, `toit`, `sol` sont exportés ;
- maquette `maquettes/web_engine/batiments-antiques.html` (`#cle` pour un gros plan, par exemple `#legion`).

## 2.6.0 — 2026-11-18

Plus de vie partout, dans `rendu/modernes.js` : `oiseaux()` (vols qui tournent : mouettes sur la décharge, le compost, le barrage et l'éolien en mer,
pigeons du centre-ville, corbeaux des fermes…), `pietons()` (centre-ville, affaires, centrale nucléaire), `engin()` (chargeurs des centrales
à charbon et biomasse, de la décharge, des déchets dangereux, de la zone industrielle) ; cheminées qui fument dans les maisons et les fermes ;
ventilations des centrales au gaz, TAC, SMR et du centre de tri ; camions de la centrale au fioul et de l'incinérateur ; ambulance de l'hôpital ;
bateau de l'éolien en mer, véhicule d'entretien de la ferme solaire, canards du lagunage, second agitateur de la potabilisation, plus de vaches.

## 2.5.0 — 2026-11-18

Les villes s'animent aussi, dans `rendu/modernes.js` :
- voitures qui font le tour du centre-ville, du quartier résidentiel et du village (`ronde()`), arbres qui ploient dans le vent (`arbreVent()`) ;
- centre-ville et quartier d'affaires : feu de balisage au sommet de la plus haute tour ; affaires : nacelle de laveur de vitres et enseigne qui tourne ;
- zone industrielle : un camion de livraison ; village : girouette sur le clocher.

## 2.4.0 — 2026-11-18

Chaque bâtiment moderne a maintenant son animation, dans `rendu/modernes.js` :
- `piece(L, ex, dessin, x, y, z, a, axe, amp, v, ph)` déclare une partie mobile (tourne, oscille, glisse, pulse, clignote), animée par `animer()` ;
  `modele()` la renvoie dans `pieces` ; un modèle dessiné hors de `modele()` la garde immobile ;
- panneaux solaires qui suivent le soleil, embruns des barrages et du fil de l'eau, plasma de la fusion, voyants des batteries, feux des postes,
  du château d'eau et du centre de déchets dangereux, flèche de la grue, vanne de la prise d'eau, agitateur, ventilations, balancier du forage,
  jet de la source, ponts racleurs de l'épuration, roseaux du lagunage, bulldozer, voiture, retourneur et fumée du compost, camions, conteneur
  du quai, dômes et torchère du méthaniseur, vaches et tracteur des fermes, hélicoptère de l'hôpital ;
- `bFerme(L, elevage, ex)` : troisième argument facultatif pour ses animations.

## 2.3.0 — 2026-11-18

Ce qu'il faut à web_power pour passer au moteur unique :
- `scene.js` : le canevas peut ne couvrir qu'une partie de la page (la carte de web_power est à côté de son panneau) :
  la taille de rendu et les clics suivent le canevas, plus la fenêtre ; rien ne change pour un canevas plein écran ;
- `plateau.js` : le sol et son décor ont leur matériau, `MAT_SOL` (exporté avec `MAT_RIV`, celui des rivières),
  qu'un jeu peut teinter sans toucher aux bâtiments (les vues réseau de web_power assombrissent la carte) ;
- `modernes.js` : `semer` est exporté, pour un jeu qui appelle lui-même les dessins de `BAT` et `QBAT`.

web_power passe au moteur unique (partie `rendu`) : plateau, caméra, ciel et modèles viennent de la bibliothèque.

## 2.2.0 — 2026-11-18

Les animations des bâtiments modernes de web_power, dans `rendu/modernes.js` :
- `animer(m, { pop })` anime un modèle posé : fumées (bouffées de `vie.js`), éoliennes dont la vitesse suit le vent (`climat.vent`),
  fenêtres et réverbères des quartiers allumés la nuit, courant qui circule dans les lignes, rebond de la construction (`pop`, 650 ms) ;
  un modèle retiré de la scène sort tout seul de la liste ;
- `modele(dessin, graine, { chantier: true })` : le modèle en transparence sous la grue, comme pendant les travaux ;
- carte test : elle passe par `animer()` (avec le rebond) ; le chantier montre un poste en travaux ; les zones industrielles fument.

## 2.1.0 — 2026-11-18

Tous les bâtiments modernes de web_power sont dans le moteur :
- `rendu/modernes.js` : les pylônes des lignes électriques (`js/09-lignes.js`) : `pylone(L, x, y, z, ry, kv)` (poteau en bois en 15 kV,
  treillis en 63, 225 et 400 kV) et un tronçon de ligne par tension, `BAT.ligne15`, `ligne63`, `ligne225`, `ligne400`, au catalogue (groupe Réseau) ;
- carte test : les lignes et le chantier sont posés, et la dernière époque (2035) montre aussi la centrale à fusion (2042).

## 2.0.0 — 2026-11-18

**Tous les rendus dans un seul dossier, `rendu/`, avec un seul moteur (style web_royaumes).** Les jeux doivent adapter leurs chemins.
- `royaumes/` devient `rendu/` (mêmes modules ; `graphismes/royaumes/…` → `graphismes/rendu/…`) ;
- `rendu/modernes.js` : les bâtiments modernes de web_power (installations, quartiers, fermes, interconnexion, chantier) deviennent des modèles
  du moteur, avec leur catalogue (`INSTALLATIONS`, `QUARTIERS`) et les époques modernes (`EPOQUES`) ;
- retirés : `power/` (le moteur propre de web_power : plateau, ciel, ambiance) et `pont/` (remplacé par `modernes.js`) ;
- parties : `rendu` (qui prend `three`) et `three`.

## 1.4.0 — 2026-11-18

Les mêmes forêts et montagnes dans le plateau de web_power (`power/03-moteur-3d.js`) : sapins à trois étages,
feuillus en grappes, buissons ; massif de trois pics de roche taillée, éboulis et sapins au pied.
Version d'été, comme le reste du décor de web_power (la saison et la neige passent par la teinte de MAT_SOL).

## 1.3.0 — 2026-11-18

Nouveaux arbres et montagnes du plateau (`royaumes/plateau.js`), proposition 1 de `maquettes/web_engine/arbres-montagnes.html` :
- forêts plus fournies (11/6 arbres par arbre compté par le moteur) et variées : sapins à trois étages de trois verts,
  feuillus en grappes de trois boules, branches nues l'hiver, buissons en forêt ;
- montagnes en massif de trois pics de roche taillée, neige qui descend plus bas l'hiver, éboulis et sapins au pied.

Outils : l'installateur installe toutes les parties si on ne lui en demande aucune (anciens scripts des jeux).

## 1.2.0 — 2026-11-18

Les jeux ne prennent que les parties qu'ils déclarent (`PARTIES` dans leur `outils/maj-graphismes.sh`) :
- `pont.js` devient sa propre partie, `pont/` (il dépend de `royaumes` et de `power`) ; aucun jeu ne l'utilisait à son ancienne place ;
- le contenu des autres parties ne change pas.

## 1.1.0 — 2026-11-18

Ajout des derniers graphismes de web_royaumes (c33f182), pour qu'il prenne tous ses rendus ici :
- `royaumes/img/` : illustrations des événements (disette, inventeur, philosophe), en SVG ;
- `royaumes/icons/` : icônes de l'application (180, 192 et 512 px).

## 1.0.0 — 2026-11-18

Première version, reprise des deux jeux :
- `royaumes/` : moteur et rendu de web_royaumes (`web/js/rendu` de c33f182), avec `rendu.css` ;
- `power/` : outils, moteur 3D, modèles, ambiance et ciel de web_power (14109fc), et `pont.js` ;
- `three/` : three.js r186 et `addons/utils/BufferGeometryUtils.js` (npm three@0.186.1). web_power passe de three 0.170 (CDN) à cette copie locale.
