# Journal des versions de la bibliothèque graphique

Numérotation : on change le premier chiffre quand un jeu doit adapter son code (fonction renommée, format d'état modifié),
le deuxième pour un ajout (nouveau modèle, nouvelle animation), le troisième pour une correction.

## 2.34.0 — 2026-11-24

Les agents sur la carte (demandés par web_conquete, SPEC-POLITIQUE module 4, W6 ; ajout, rien ne change pour un jeu qui ne s'en sert pas).

- `agents.js` (partie `guerre`) : `maillageAgent({ type, couleur, epoque, marche, cache, niveau, leger })`, un agent en figurine à l'échelle
  des troupes de `maillageTroupe` (groupe à l'échelle 0,1, face à +z, géométries en cache) : espion (manteau sombre, écharpe du camp, tricorne
  puis chapeau mou, lanterne sourde), gentilhomme (habit brodé à la couleur du camp, perruque, cheveux poudrés ou naturels selon l'époque,
  épée au côté), prêtre (soutane, ceinture du camp, croix, chapeau rond), diplomate (habit de cour, écharpe en sautoir du camp,
  porte-documents) ; habits selon l'époque (`ancien`, `lumieres`, `empire`, `industrie`) ; socle à la couleur du camp, le niveau (1 à 5)
  en étoiles. Au repos, il regarde alentour et ajuste son chapeau (le prêtre bénit) ; `userData.marche` : il marche au pas ;
  `userData.cache` : silhouette translucide et œil barré ; les deux se changent sans rien rebâtir. En qualité légère, la figurine est
  d'un bloc (elle pivote doucement au repos). `jeterAgent(grp)` le retire.
- `sceneMission({ type, position | case, couleurs, reussite, duree, epoque, echelle, cap, agent, parent })` : scènes courtes de mission,
  posées, jouées et retirées toutes seules, qui rendent leur durée en ms : duel, sabotage, assassinat, espionnage, apaisement, diplomate
  reçu, agent pris ; réussite et échec différents, marque ✓ ou ✗ à la fin. `finirMissions()` les arrête. Qualité légère : moins de pièces
  et de particules.
- `outils/installer.sh` : `agents.js` dans la partie `guerre`.
- Maquette `maquettes/web_engine/agents.html` : les quatre agents par époque (au repos, en marche, cachés), une couleur au choix, une troupe
  pour l'échelle, un bouton par scène, réussie ou manquée (`?vue=colonne,rangée` : de tout près ; `?mission=duel&echec` : une scène en
  boucle).

## 2.33.0 — 2026-11-24

Les bras de mer (demandés par web_conquete : ses rias, fjords, lochs, golfes courts et estuaires étaient des rubans de rivière, en
pointe, bordés de sable, avec une cascade à la mer ; ajout, rien ne change pour un jeu qui ne s'en sert pas).

- `bras` (`plateau.js`, champ facultatif de la carte de `construire()`) : chaînes de cases du fond vers la case d'eau où elles
  débouchent (un détroit : de l'eau aux deux bouts), une liste de cases ou `{ cases, largeur }`. Un ruban d'eau de mer, du matériau
  translucide de la mer (même teinte, même transparence, suit `geler`), étroit au fond, qui s'élargit en trompe jusqu'à l'embouchure,
  y descend au niveau de la mer et s'élargit encore dans la case d'eau, où il se fond dans la mer (dessiné avant le plan de la mer,
  qu'il cache, et peint une seule fois là où il se recouvre : pas de double épaisseur d'eau) ; dessous, un fond de sable et un
  mince liseré de roche. Ni berge de sable, ni cascade, ni barques ; arbres et rochers s'en écartent (`presRiviere`).
- `ruban(pts, larg, y)` : `larg` peut être une demi-largeur par point.
- Maquette `maquettes/web_engine/bras-de-mer.html` : une ria entre des collines, un fjord entre des montagnes, un estuaire où se
  jette une rivière, un détroit ; « En rivière » montre les mêmes chaînes comme avant (`#ria`, `#fjord`, `#estuaire`, `#detroit`,
  `?riviere`).

## 2.32.0 — 2026-11-24

Les troupes en campagne (demandées par web_conquete : de près, une armée de la carte de campagne était une longue file de figurines
dessinée en 2D ; ajout, rien ne change pour un jeu qui ne s'en sert pas).

- `maillageTroupe({ couleur, palier, armes, marche, leger })` (`modeles.js`) : une armée en petit groupe de figurines d'après ce qu'elle
  compte (`armes = { inf, leg, cav, art }`, effectifs ou parts ; `compoTroupe` donne le compte) : porte-drapeau aux couleurs du camp,
  infanterie de ligne (piquiers en 1700, grenadier ensuite), tirailleurs en habit vert, un ou deux cavaliers (dragons, cuirassiers,
  hussards, lanciers selon le palier), un canon et son servant ; 10 figurines (6 en qualité légère). Au repos, la ligne en petit carré, le
  drapeau derrière, deux tentes et un feu (sans eux en qualité légère) ; en marche, une colonne courte de deux de front, cavalerie en tête,
  canon tiré par deux chevaux en queue, moins longue qu'une case. Uniformes du palier (`PALIERS`).
- Animée sans rien rebâtir : le drapeau flotte (vu de face quel que soit le cap), et quand `userData.avance` est vrai la colonne marche au
  pas (deux géométries en cache, jambes inversées, montrées en alternance, et un léger rebond) ; tant que le groupe est dans la scène,
  rien s'il est masqué. `jeterTroupe(grp)` le retire et libère son drapeau.
- `fantassin(…, pas)`, `canon(…, attele)` : paramètres facultatifs (jambes écartées pour la marche ; pièce sans avant-train ni attelage).
  Les dessins d'avant ne changent pas.
- Maquette `maquettes/web_engine/troupes.html` : une rangée par palier, au repos, en marche, infanterie seule, cavalerie et canons,
  qualité légère (`?vue=colonne,rangée` : de tout près sur une case).

## 2.31.0 — 2026-11-23

La vue de loin d'une grande carte, la qualité automatique et la première image (demandés par web_conquete ; options facultatives,
rien ne change pour un jeu qui ne s'en sert pas, sauf l'anticrénelage coupé en qualité légère).

- Hexagones simples pour la vue de loin (`plateau.js`, `hexagonesSimples(true)` avant `construire()`, `casesSimples()`) : les cases
  ne gardent que leur dessus (4 triangles) et les flancs qui se voient (vers une case plus basse, une colline en pente ou le bord) ;
  le décor perd ses contours et ses pièces de moins de 0,1 de large (fleurs, cailloux, troncs, sillons), ses cônes leur fond, les
  buttes des collines passent de 80 à 20 faces ; les routes perdent leurs contours. Les cases sont identiques à l'écran ; de loin le
  décor est très proche (1,5 % des pixels changent sur la grande carte de mesure), de près il ne convient pas (sillons, troncs) :
  pour des hexagones de moins d'une trentaine de pixels (web_conquete : les niveaux `leger` de `carte-moteur.js`).
- Les cases sont écrites directement dans un seul maillage (plus de géométrie par case à copier puis fusionner) ; les rubans des
  rivières et des routes dans des tableaux typés, sans copie ; l'usure des routes compte les tronçons d'un coup par parcours (mêmes
  valeurs, vérifiées sur des réseaux au hasard). Même résultat à l'écran par défaut (0,01 % des pixels, l'anticrénelage).
- Anticrénelage (`scene.js`) : choisi avant la création du moteur de rendu, coupé en qualité légère (adresse, choix enregistré ou
  qualité devinée), forcé par `?aa=0` / `?aa=1` ; `qualite.aa`.
- `reglerQualite(niveau, { retenir, echelle, decor, vie })` : `niveau` peut être `null` (options seules) ; `retenir: false` n'enregistre
  pas le niveau ; `echelle` multiplie la définition ; `decor: false` donne un décor clairsemé (un compte d'un arbre par case de forêt,
  ni arbres épars, ni buissons, ni fleurs ; les champs restent) en ne refaisant que le décor ; `vie: false` arrête et cache les
  figures de `vie.js` et `quartiers.js` sans rien rebâtir. Les matériaux ne sont plus recompilés que si les ombres changent.
- `prechauffer()` (`scene.js`) : compile les programmes des shaders pendant le chargement (`compileAsync` de three.js r186, ou
  `compile` sans compilation parallèle, sans l'avertissement de three.js).
- `PCFSoftShadowMap`, retiré de three.js, remplacé par `PCFShadowMap` (ce que three.js utilisait déjà, sans l'avertissement).
- Départs et arrivées par l'horizon (`marine.js` : `departFlotte`, `departs`, ordre `route`, `arrivees`) : au-delà de la balise, la
  flotte parcourt une distance qui suit le zoom (la moitié de `cam.d`, 4,5 au moins), en 8 à 10 s, ses navires grossis de loin
  (jusqu'à ×3), en fondu seulement sur le dernier (ou le premier) cinquième ; son étiquette, plus grande (`.arm.horizon`), reste lisible
  à tout zoom.
- `eclairage(heure)` (`nuit.js`) : l'éclairage d'une heure fixe sans `meteo.js` (`'jour'`, `'aube'`, `'crepuscule'`, `'nuit'` ou des
  poids `{ jour, aube, nuit, phase }`) : `climat` et les consignes de lumière de la scène ; fenêtres, lueurs et feux des phares
  ressortent la nuit. Les couleurs de chaque heure (`LUMIERE`) sont désormais dans `nuit.js`, partagées avec `meteo.js`.
- Mesures (Chromium sans GPU, processeur ralenti ×4, 1200 × 800) : grande carte de 130 × 92 cases vue de loin comme les niveaux légers
  de web_conquete (hexagones de 14 px, un arbre par forêt) : qualité légère, 2 003 k → 568 k triangles avec les hexagones simples
  (÷ 3,5), 20 → 17 appels de dessin, boucle JS 11,6 → 6,3 ms par image ; qualité normale (ombres), 3 181 k → 1 123 k (÷ 2,8).
  `construire()` de cette carte (décor par morceaux, sans ralentissement) 492 → 279 ms, `majRoutes` 296 → 229 ms. Qualité légère
  sans anticrénelage : batiments-empire 230 → 104 ms par image, marine-empire 230 → 153 ms, carte-complete 447 → 305 ms (rendu
  logiciel : à refaire sur le Pi).
- Essais : `essai-decor-progressif.mjs` vérifie aussi les hexagones simples (par morceaux comme d'un coup, et rien que des pièces
  du décor complet) ; les crochets des deux essais suivent la nouvelle ligne de `p()`.

## 2.30.0 — 2026-11-23

Corrections de l'époque d'Empire demandées après la 2.29.0 (web_conquete ; utilisables par tous les jeux, champs nouveaux facultatifs,
rien ne change pour un jeu qui ne s'en sert pas).

- Le phare éclaire la nuit (`nuit.js`, `feuPhare(x, y, z, faisceau)`) : la lanterne brille (halo face à la caméra) et deux faisceaux
  lumineux (mélange additif, qui s'éteignent vers le bout) balaient la mer ; la nuit et au crépuscule, discrets le jour ; en 1700, le
  brasier : un halo orangé, sans faisceau. En qualité normale ou riche, un grand halo et la tache de chaque faisceau sur l'eau (`lueur`) ;
  en qualité légère, la lanterne et les faisceaux seulement. Tous les phares tiennent en deux appels de dessin (maillages instanciés).
  Le feu est demandé à chaque image par le bâtiment posé (`maillageBatiment` : nouvelle entrée `{ type: 'phare', pos, faisceau }` de
  `anim`, que `animerPose`/`synchroniser` de monde.js posent) et par ses pièces mobiles (`animationsAncien` : `ex.feux` de `modele()`,
  nouveau champ `feux` du modèle, animé par `animer()`) ; une même lanterne demandée deux fois n'est dessinée qu'une fois. Le faisceau jaune
  pâle (une pièce mobile opaque) disparaît.
- La barrière de la douane s'ouvre (`modeles.js`, `monde.js`) : le bras rayé aux couleurs du camp est une pièce mobile (`brasBarriere(couleur)`,
  entrée `{ type: 'barriere', pos, couleur }` de `anim`, posée dans le groupe du bâtiment par `animerPose`) qui pivote dans le plan du sol
  (lisible vue de haut) : fermé en travers de la route, il s'ouvre pendant que la charrette attend, reste ouvert à son passage et se rabat
  après, sur la même horloge que la charrette d'animations.js (`PIECES_EMPIRE.barriere.T`, `.ouverte(u)`). Poteau d'appui en face.
- Les routes commerciales se voient de loin (`marine.js`) : la largeur du ruban suit le zoom (à peu près constante à l'écran, de 0,075 de
  tout près à 0,42 au plus ; pointillés aux mêmes proportions), calculée par le nuanceur (rien n'est rebâti) ; de loin, un liseré sombre continu.
- Une flotte part vers le bon côté : `etat.sorties[].vers = [dx, dz]` (de quel côté est le théâtre : flèche, départs et arrivées par cette
  balise) ; `flottes[].sortie` (la balise à prendre) ou `flottes[].vers` (la direction du théâtre : la balise qui va le mieux de ce côté,
  sinon droit vers le bord de la fenêtre) avec l'ordre `route` ; `arrivees[].vers` (le côté d'où elle vient). Sans eux, comme avant.
- Une flotte qui sort de la vue ne saute plus (`jouerMoisMarine`) : un mouvement de flotte avec `sortie: true` (ou `[dx, dz]`), ou dont le
  trajet finit par des cases négatives (hors fenêtre), va jusqu'au bord puis s'estompe au-delà ; avec `entree: true` (ou `[dx, dz]`), ou un
  trajet qui commence hors fenêtre, elle paraît au bord en fondu puis navigue. Les mouvements avancent désormais à vitesse régulière le long
  de leurs cases (même tracé qu'avant). Format en tête de marine.js.
- Départ d'une flotte que le jeu ne suit plus : `departFlotte({ case, proprio, navires, sortie?, vers?, armee?, epoque? })` (exportée) et
  le champ `departs` du rapport de `jouerMoisMarine` : la flotte gagne la balise, s'éloigne et s'efface, sans exister dans `etat.flottes`
  (elle survit à `majMarine`).
- Chantier visible (`animations.js`) : `maillageEnChantier({ cle, couleur, epoque, saison, neige, av })`, n'importe quel bâtiment ancien
  monté jusqu'à la part `av` des travaux (0 à 1 : murs ouverts en haut, toits posés à la fin) sous un échafaudage de bois qui monte avec lui,
  maçon, manœuvre, porteur et chèvre de levage (`chantierVivant`) ; un modèle de `modele()`, à animer par `animer()`. (`maillageChantier()`
  n'est qu'un échafaudage fixe ; `chantierVivant` seul ne montre pas le bâtiment.)
- Raspberry Pi (réglage de qualité de scene.js) : en qualité légère, `animationsAncien` ne pose que les deux premières lignes de chaque
  recette (moins de pièces mobiles, donc moins d'appels de dessin) ; pas de grand halo du phare ; les drapeaux des bâtiments partagent un
  matériau par couleur (un par drapeau avant) ; `nuit.js` n'alloue plus de tableaux à chaque image (taches de lumière, feux) et accepte
  bien 400 taches (66 avant, par erreur). Mesuré dans Chromium sans GPU, processeur ralenti ×4, qualité légère,
  mêmes maquettes avant et après : carte-complete passe de 1048–1122 à 831–851 appels de dessin par image (−20 %, triangles 262 k → 232 k),
  batiments-empire de 362–372 à 307–313 (−16 %) ; la mer de marine-empire reste à 77–78 appels (le liseré des routes ne se dessine que
  de loin, les feux des phares seulement s'il y en a). Le temps par image y est celui du rendu logiciel (230 à 700 ms) : à refaire sur le Pi.
- Maquettes : `batiments-empire.html` (phare de nuit, barrière, réglage « Chantier », `?heure=nuit&chantier=0.4`), `marine-empire.html`
  (phare sur la côte et heure, routes de loin, départ orienté vers la Baltique, sortie et entrée dans la vue, départ non suivi).

## 2.29.0 — 2026-11-23

Les bâtiments et la marine de l'époque d'Empire (pour web_conquete, chantier « Empire » : emplacements, marine, commerce
maritime ; utilisables par tous les jeux, rien ne change pour ceux qui ne s'en servent pas).

- Nouveaux bâtiments anciens (`modeles.js`, `BATR`), aux quatre époques, à la couleur du camp, en ruine automatiquement :
  `chantier_naval`, `cale_seche`, `ecole_militaire`, `universite`, `seminaire`, `phare`, `douane`, et sept plantations
  (`plantation_sucre`, `plantation_tabac`, `plantation_cafe`, `plantation_coton`, `plantation_the`, `plantation_epices`,
  `plantation_indigo`). L'eau est du côté +x pour le chantier naval, la cale sèche et le phare (comme `port`). Export
  `PIECES_EMPIRE` : les points où `animations.js` accroche leurs pièces mobiles.
- Leurs animations (`animations.js`, `RECETTES`) : coque bordée planche par planche (`bordages`), balancier de pompe (`pompe`),
  cadets à l'exercice et tambour (`cadets`, `tambour`), étudiants en robe (`etudiants`), cloche et procession (`cloche`,
  `procession`), faisceau du phare (`faisceau`), charrette arrêtée à la douane (`douane`), récolte (`recolte`), moulin à sucre
  (`moulinSucre`), `ouvrierEn`.
- Marine (`marine.js`), champs d'état facultatifs : comptoirs en mer (`etat.comptoirs`), routes commerciales
  (`etat.routes_mer` : ne pas les mettre dans `etat.routes`, que `plateau.js` lit autrement), balises vers les autres théâtres
  (`etat.sorties`), corsaires (`flottes[].ordre = 'corsaire'`) et départs (`'route'`) ; rapport de `jouerMoisMarine` :
  `arrivees`, `abordages` ; nouvelles fonctions `abordageCorsaire(...)` et `sceneNavale({case, camps, phase, vent, coules, pris})`
  (bataille navale pilotée phase par phase) ; navire `cuirasse` ; `fregate_helice` et `vaisseau_helice` reconnus.
- Maquettes `maquettes/web_engine/batiments-empire.html` (galerie et village d'essai) et `marine-empire.html`.

## 2.28.0 — 2026-11-23

Le décor par morceaux (`plateau.js`, au choix du jeu) : `decorProgressif(ms)` ; avec ms > 0, `construire()`, `majEtat()`,
`majSaison()`… ne bâtissent plus aussitôt que les cases, le relief, les rivières et les contours ; le décor (arbres, buissons,
rochers, montagnes, champs, fleurs) est posé ensuite par morceaux, au plus ms millisecondes par image, du centre de la carte vers
les bords, et figé par paquets d'au moins 256 cases. `decorEnCours()` dit s'il en reste. Le décor obtenu est le même, pièce pour
pièce (`node outils/essai-decor-progressif.mjs`, lancé par la CI : sur une carte de 60 × 50 cases, 3 s d'arrêt deviennent 70 ms,
puis environ 190 images de 9 ms en médiane). Sans cet appel (ms = 0, par défaut), rien ne change : web_royaumes et web_power
bâtissent leur décor d'un coup, comme avant. web_conquete l'active (6 ms) : changer de niveau de zoom n'arrête plus l'image.

## 2.27.0 — 2026-11-23

- Plus de vie sur le plateau (`vie.js`, tous les jeux), dans le style des autres figurines :
  - voyageurs entre les villes : charrettes, cavaliers et piétons (baluchon, bâton) font l'aller et retour par la route, sur le
    tracé du ruban (`passage()`), chacun sur sa droite ; un trajet par paire de villes voisines sur le réseau, 28 au plus, un à
    trois voyageurs selon la longueur ; les piétons rentrent la nuit et sous la pluie ;
  - troupeaux de moutons, leur berger et son chien qui fait le tour du troupeau, dans six autres prés (pas l'hiver, ni la nuit,
    ni sous la pluie) ;
  - barques qui remontent et descendent les rivières sur la courbe de l'eau, entre deux cascades (six au plus, pas sur l'eau gelée).
  Nouveaux modèles : `cavalier`, `voyageur`, `berger`, `chien`.
- Décor bâti plus vite (`toon.js`, tous les jeux) : `put()` ne refabrique plus une sphère ou un cône par défaut à chaque copie
  (clone() de three.js), écrit les couleurs sans tableau intermédiaire (une conversion par teinte), tourne et pose la pièce en
  une passe ; le contour ne grossit que les positions (son matériau ne lit pas les normales). Les sommets sont les mêmes
  (`node outils/essai-toon.mjs`, lancé par la CI). Avec la 2.26.0, une reconstruction du plateau de web_conquete prend de 2 à
  3,5 fois moins de temps qu'en 2.25.1.

## 2.26.0 — 2026-11-23

Construire une carte avec son état (`plateau.js`, tous les jeux) : `construire(carte, etat)` prend désormais l'état de la partie
(facultatif, au format de `majEtat`) et ne bâtit le décor qu'une fois. Sans lui, l'appel à `majEtat()` qui suit d'habitude le
rebâtissait aussitôt (le bâti, les routes et les territoires ne sont connus qu'avec l'état) : deux fois le temps de calcul à
chaque nouvelle carte. web_conquete, qui rebâtit une fenêtre de la carte quand la vue change de niveau de zoom, s'arrête ainsi de
35 à 60 % moins longtemps. `majEtat(etat, forcer)` : `forcer` rebâtit le décor même si rien n'a changé. Les jeux qui appellent
`construire(carte)` seul ne changent pas.

## 2.25.1 — 2026-11-23

Arbres sur les routes (`plateau.js`, tous les jeux) : les arbres des forêts, les buissons, rochers, fleurs et cailloux des
gisements, tirés au hasard dans la case, s'écartaient des rivières mais pas des routes, si bien qu'en forêt des arbres poussaient
sur le ruban. `auHasard()` les écarte désormais du tracé des routes de la case (du point de passage au milieu de chaque bord relié,
demi-largeur du ruban le plus large et une marge : `ECART_ROUTE`) ; une case de route a quatre essais de plus, tirés à part, pour
garder sa forêt aussi dense (les arbres des autres cases ne bougent pas). Le tracé est désormais calculé à un seul endroit
(`passage()` et `traceRoute()` de plateau.js, que routes.js dessine) ; `majEtat()` refait le décor quand une route relie
autrement des cases déjà desservies. Essai sans navigateur : `node outils/essai-arbres-routes.mjs` (lancé par la CI).

## 2.25.0 — 2026-11-21

- Le vent dans les arbres (`plateau.js`, tous les jeux) : les sapins et les feuillus des forêts et des bosquets ploient dans le
  sens du vent, en rafales décalées d'un arbre à l'autre, plus fort par grand vent (meteo.js donne `U.vent` et `U.dir`) ; le
  pied reste fixe (attribut `souple` des sommets, que `fusion()` de toon.js conserve désormais). Les ombres restent immobiles.
- Pièges du tower defense (`defense.js`) : `PIEGES` (pointes, boue, mine, barrage), leurs noms dans `STYLES[style].pieges`
  et `piege(role, ere, { pop })`, cinq allures (chausse-trappes, fossé boueux, fosse à feu, abattis ; chevaux de frise, marais,
  fougasse, gabions ; barbelés, tranchée inondée, mine, hérissons ; herse à clous, mousse collante, mine antichar, blocs de béton ;
  champ de lames, champ de gravité, mine à impulsion, mur de force). Animations : les pointes jaillissent (`declencher`) et
  s'émoussent (`usure`), la mine montre sa charge et son voyant tant qu'elle est armée (`arme`), la barricade tremble sous les
  coups, penche quand elle faiblit et disparaît détruite (`vie`) ; boue qui bouillonne, roseaux, champs qui battent.
- `batimentVille()` / `animerVille()` : les bâtiments de 1700 à 1816 ont leurs drapeaux, cheminées et fumées (`animerPose` de
  monde.js) ; `oublierVille()` les retire.

## 2.24.1 — 2026-11-21

Hélices (`defense.js`) : elles tournaient trop vite (20 à 36 rad/s) et sautaient d'un quart de tour entre deux images, si bien
qu'elles semblaient figées ou à l'envers. Les pales tournent désormais à une vitesse que l'œil suit (6 à 9 rad/s, les rotors du
drone en sens alternés) et un disque translucide donne le flou de la rotation ; moyeux et pales plus épais pour l'hélicoptère et
le drone ; les moteurs du zeppelin sortent du ballon, sur des bras, pour qu'on voie leurs hélices.

## 2.24.0 — 2026-11-21

`defense.js` refait dans le style du moteur, avec ses animations :
- les tours deviennent de petits bâtiments : tour de guet gauloise au toit de chaume, onagre sur sa butte palissadée,
  chaudron de poix sur son foyer, scorpion ; redoute crénelée et ses fusiliers en joue, bastion et canon de web_royaumes
  (`canon()` de modeles.js), pompe à bras, grosse tour carrée et sa couleuvrine ; nid de mitrailleuse en sacs de sable, obusier,
  pompe à vapeur, casemate et canon long ; tourelle double, lance-roquettes sur chenilles, camion lance-eau, rampe de missiles
  et son radar ; tourelle laser, mortier à plasma, cristal cryogénique, canon électrique ; soldats aux coiffes de l'époque
  (`tete()` de modeles.js, `homme()` d'antiques.js), fanions et torches selon le niveau ;
- animations des tours : au tir (`tirer(t)`, qui rend la bouche et pose l'éclair et la fumée de poudre) recul des pièces, bras
  de l'onagre, chaudron qui se renverse, levier de la pompe, mitrailleuse qui tremble, missile qui part et revient ; en continu
  drapeaux au vent, flammes, fumée du chaudron et de la chaudière, radars, gyrophares, noyaux lumineux, cristal qui flotte ;
  `tour(…, { pop: true })` sort de terre ;
- les ennemis deviennent des troupes comme les armées du moteur (trois légionnaires, deux cavaliers, la tortue, trois fusiliers…) ;
  `avancer(e, distance, dt)` : jambes et sabots au pas, roues qui tournent selon la distance, hélices, balancement ;
  `abattre(e)` : la troupe s'effondre (les engins s'affaissent, les volants piquent) puis quitte la scène ; `toucher(e)` : elle tressaille ;
- projectiles et effets : `suivreTir(p)` (traînée des roquettes, fumée de la poix), explosion avec onde au sol, éclaboussure
  et ses gouttes, laser avec halo ;
- `tour(role, ere, niveau)` et `ennemi(genre, ere)` prennent l'époque (ou, comme avant, un style).

## 2.23.0 — 2026-11-21

Nouvelle partie `defense` (`defense.js`, pour le tower defense web_defense ; maquette `maquettes/web_engine/defense.html`) :
- `ERES` : quinze époques de l'Antiquité à 2035 (une tous les cinq niveaux du jeu), regroupées en cinq styles de dessin
  (antique, poudre 1700 → 1816, guerres 1900 → 1946, moderne 1960 → 1990, futur 2005 → 2035), avec leur niveau de route et la
  couleur des ennemis ; `STYLES` : les noms des tours et des ennemis, et le projectile de chaque tour ;
- `tour(role, style, niveau)` : quatre rôles (rapide, zone, lent, loin) à trois niveaux (socle plus haut, fanion, cerclage doré),
  avec une tête qui pivote vers sa cible et la bouche du tir ; archers, onagre, poix, scorpion → mousquetaires, canon, pompe à bras,
  couleuvrine → mitrailleuse, obusier, pompe à vapeur, canon long → tourelle, lance-roquettes, canon à eau, missiles → laser,
  plasma, rayon cryogénique, canon électrique ;
- `ennemi(genre, style, couleur)` : fantassin, rapide, lourd, chef (de la tortue romaine et l'éléphant de guerre au méca géant ;
  zeppelin, hélicoptère et drones volent, leurs hélices tournent) ;
- `projectile(genre)`, effets `explosion`, `eclat`, `eclaboussure`, `rayon` (laser), `chute` ; `anneauPortee(r)`, `barreVie()` ;
- `batimentVille(ere, coeur)` : la ville à défendre, faite des bâtiments existants (oppidum et huttes, citadelle et maisons de
  l'époque, centre-ville et quartiers modernes), `animerVille()`.

## 2.22.0 — 2026-11-19

Deux niveaux de route de plus (`routes.js`), un par époque : 4, routes impériales (Empire : larges, claires, bordées de
peupliers) ; 5, routes empierrées au macadam (révolution industrielle : grises, bornes kilométriques).

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
