# Journal des versions de la bibliothèque graphique

Numérotation : on change le premier chiffre quand un jeu doit adapter son code (fonction renommée, format d'état modifié),
le deuxième pour un ajout (nouveau modèle, nouvelle animation), le troisième pour une correction.

## 2.21.0 — 2026-11-19

Biomes donnés par le jeu : si la carte passée à `construire()` porte `biome` (une valeur par case : 'marais', 'desert',
'toundra' ou null), le plateau prend ces biomes au lieu de les déduire (le générateur de web_royaumes les tire désormais).

## 2.20.0 — 2026-11-19

Relief, biomes, vie des villes, guerre et crises :
- relief (plateau.js) : les collines descendent en pente douce vers les cases plus basses (le replat central, où l'on bâtit, garde
  sa hauteur), falaises de roche au bord des montagnes ; `hauteurEn()` suit la pente, `bordEntre(a, b)` ; le liseré des territoires
  et les routes suivent le sol ;
- biomes (plateau.js, ambiance.js) : marais (mares, roseaux), désert (dunes qui migrent sous le vent, sable soulevé), toundra
  (lichens, sapins), déduits de la carte ou imposés par le jeu : `poserBiomes({ case: 'marais' | 'desert' | 'toundra' })`,
  `biome(i)`, `casesBiome(nom)` ;
- usure des routes (routes.js) : les tronçons les plus empruntés s'élargissent, un chemin de terre très passant devient pavé
  (4e élément d'une route : son trafic, de 0 à 1, sinon estimé d'après le réseau) ;
- villes (vie.js) : passants plus nombreux dans les grandes villes (`ville.pop` si le jeu la donne), linge qui sèche, fumées de
  cheminée plus fortes quand il gèle ;
- guerre (monde.js, modeles.js, sieges.js) : drapeaux des armées, des sièges et des forts qui flottent dans le sens du vent,
  poussière derrière les armées en marche par temps sec ; les habitants d'une ville assiégée fuient vers la campagne ;
- `traces.js` (ancien) : `traceBataille(case, tour)`, terre retournée, cratères et débris qui se referment en quatre mois ;
- chroniques de web_royaumes : couronnement (confettis, cloches), peste (charrette des morts), révolte (foule aux torches, bonheur
  sous `SEUIL_REVOLTE`), mariage royal (carrosse et pétales entre deux capitales alliées) ;
- `crises.js` (moderne) : `panache()` (vapeur des tours nucléaires, fumée noire d'accident), `chute()` (débit des barrages),
  `reflets()` (panneaux solaires), `blackout(x, z)` / `retablir()` (la carte s'éteint par vagues) ; `manifAntinucleaire()` (chantiers.js).

## 2.19.0 — 2026-11-19

Le plateau (`plateau.js`, les deux jeux) : les cases se touchent (le dessus à pleine taille, sans biseau ni fossé entre elles),
et un fin trait sombre souligne le contour de chaque case de terre.

## 2.18.0 — 2026-11-19

Nouvelle cabane de pêcheur (`modeles.js`, maquette `maquettes/web_engine/pecheur-propositions.html`, mélange des propositions P1 et P3) :
cabane sur pilotis au bord de l'eau avec son échelle, jetée en L qui dépasse le rivage et ses deux barques, étal de la criée sous
un auvent rayé et ses caisses de poissons, filet tendu, séchoir à poissons, casiers et tonneau ; toit et porte relevés (givre, épidémie).

## 2.17.0 — 2026-11-19

Saisons, vent, lumière de nuit, eau, journée des habitants, animaux, trains, commerce et grèves :
- saisons (plateau.js) : fleurs des prés au printemps, meules de foin l'été, labours bruns à l'automne ; la glace prend peu à peu
  sur l'eau l'hiver (meteo.js) ; `piedsCascades()` ;
- vent : herbes hautes qui ondulent près du regard (ambiance.js) ; poussière soulevée sur les routes sèches (boue.js) ;
- nuit (nuit.js) : `lueur(x, y, z, r, allongement, cap)`, taches de lumière au sol (lanternes et réverbères de quartiers.js,
  phares de web_power) ; halo orangé au-dessus des grandes villes ;
- `eau.js` (socle) : vagues qui se brisent sur les côtes, écume et embruns au pied des cascades, `sillage(x, y, z)` (gabares de
  chroniques.js, bateaux de web_power) ;
- journée (vie.js) : marché le matin seulement, paysans qui rentrent au village au crépuscule, bétail et basse-cour à l'abri sous la pluie ;
- animaux : `envol(x, y, z)` (faune.js), les oiseaux s'envolent quand une armée passe près d'un bois (monde.js) ;
- `rail.js` (moderne) : `poserVoie(parent, pts, { ech, electrique, wagons })`, traverses, rails, caténaire, train en navette
  (vapeur qui fume, rame électrique) ;
- `piquetGreve()` (chantiers.js) : grévistes, pancartes, banderole et brasero ;
- chroniques.js : charrettes sur les routes commerciales entre la capitale du joueur et celles de ses alliés ;
- cabane de pêcheur : le ponton dépasse le rivage (il s'arrêtait sur le sable), pieux dans l'eau, barque amarrée.

## 2.16.0 — 2026-11-19

Plus de lumière, de vie et de règles visibles, et un réglage de qualité :
- qualité (`scene.js`) : `qualite` (léger, normal, riche), `reglerQualite(n)`, `NIVEAUX_QUALITE`, `pres(x, z)` ; léger : sans ombres,
  définition 1, un tiers des fumées, de la pluie, des feuilles, des poissons et des lucioles, pièces animées figées au loin ;
  choisi par `?qualite=` dans l'adresse, sinon le dernier choix, sinon deviné (tactile, 4 cœurs ou 4 Go au plus : léger) ;
- lumière : fin de journée plus chaude, soleil plus bas et ombres plus longues ; `foudreSur(x, y, z)` (meteo.js) : la foudre sur un point ;
- `nuit.js` (socle) : étoiles, lune qui change de phase chaque nuit, lucioles les nuits d'été, reflet du soleil ou de la lune sur la mer,
  lumières des villes dans les rivières ; `faune.js` (socle) : vols de migrateurs en V au printemps et à l'automne, bancs de poissons
  près des côtes, un poisson qui saute ;
- `chantiers.js` (moderne) : `chantierVivant(av, { w, d, haut, ancien })`, échafaudages qui montent avec les travaux, ouvriers, porteur,
  grue (ou chèvre de levage) dont le mât s'élève ; monde.js s'en sert pour les chantiers de web_royaumes ;
- `chroniques.js` (ancien) : `majChroniques(etat, rapport)`, incendies (flammes, fumée, braises), épidémie (croix sur les portes,
  fumigations), famine (champs vides : `secher(3)`, file devant les greniers), feux d'artifice après une bataille gagnée (vie.js y fait
  aussi la fête), gabares de commerce sur les rivières ;
- plateau.js : `pointsRiviere()`, `casesBaties()`.

## 2.15.0 — 2026-11-19

`rendu` est redécoupé en parties plus fines : un jeu n'installe que ce qu'il utilise (voir le tableau du README).
- parties : `three`, `socle` (scène, plateau, météo, vie commune, routes, boue, ambiance, brouillard, étiquettes), `moderne`, `antique`,
  `ancien` (bâtiments et armées de 1700 à 1816, monde, quartiers, animations, images, icônes), `guerre` ; `rendu` reste « tout » ;
- les fichiers restent dans `rendu/` : aucun chemin d'import ne change, rien à adapter dans les jeux sauf leur ligne `PARTIES` ;
- le socle ne charge plus `monde.js` : `vie.js` exporte `MONDE`, où `monde.js` s'inscrit (`estArrete`, `listeArmees`, `parts`, `vent`) ;
  `rayon()` passe dans `scene.js` (`guerre_commun.js` le réexporte) pour que le brouillard se passe de la guerre ;
- l'installateur vérifie que chaque import relatif d'un module installé trouve son fichier.

## 2.14.0 — 2026-11-19

Le temps et les effets de jeu se voient. Tout passe par `climat` (vie.js) : meteo.js le remplit d'après la météo du jeu,
un jeu peut aussi poser lui-même `climat.pollution` et `climat.eauSale` (0 à 1).
- effets de jeu de web_royaumes (son serveur envoie `secheresse`, `pluie` et `tir` dans `etat.meteo`) :
  champs jaunis pendant une canicule, grillés et plus courts pendant une sécheresse, herbe qui pâlit (`plateau.secher()`, `climat.sec`) ;
  traces de boue derrière les armées qui marchent sous la pluie (`boue.trace()`) ; poudre mouillée (`climat.poudre`) :
  des coups ratent dans les salves d'exercice et les combats, une goutte au-dessus de la mêlée ;
- plus de météo : crue des rivières après une forte pluie, eau trouble qui recouvre les berges (`boue.crue`, `MAT_BERGE`) ;
  arc-en-ciel plus fréquent, et juste après chaque averse (`climat.apresPluie`) ; nouveau `ambiance.js` : brume du matin sur l'eau à l'aube,
  feuilles qui tombent près des forêts en automne, givre sur les toits quand il gèle sans neige (monde.js s'inscrit par `toitsDe()`) ;
- pollution (web_power) : `climat.pollution` jaunit la lumière et voile le lointain, `climat.eauSale` teinte les rivières en vert brun
  (`plateau.teinterRivieres()`) ; `debordDecharge(n)` (modernes.js) : tas d'ordures et sacs qui passent la clôture d'une décharge pleine.

## 2.13.0 — 2026-11-19

Les routes vivent avec la météo, dans `rendu/boue.js` (nouveau) :
- `humidite.v` (0 à 1) monte sous la pluie, redescend quand elle s'arrête, retombe à zéro sous la neige au sol ;
- `MAT_TERRE` : les chemins de terre virent à la boue ; `MAT_PAVE` : routes pavées et goudronnées foncent, comme mouillées ;
  `TEINTE_ROUTES` : la teinte de fond qu'un jeu peut leur donner (les vues réseau de web_power assombrissent la carte) ;
- `flaques(parent, points, r)` : des flaques le long des routes, qui grandissent chacune à leur tour puis sèchent dans l'ordre inverse,
  avec les ronds de la pluie à leur surface ;
- `routes.js` s'en sert : rien à changer dans web_royaumes ; un jeu qui trace ses routes lui-même (web_power) dessine ses chemins
  avec `MAT_TERRE`, ses routes avec `MAT_PAVE`, et pose `flaques()` sur leurs points.

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
