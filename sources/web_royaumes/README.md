# web_royaumes — Royaumes des Rives (1700-1850)

Fondez un hameau en avril 1700 et faites-en une cité, sur une carte d'hexagones que vous réglez vous-même
(océans, forêts, lacs, rivières, montagnes, gisements). Les rivaux bâtissent eux aussi ; à vous de commercer,
de vous allier ou de faire la guerre.

Jeu de gestion et de stratégie **au tour par tour, mois par mois** : vous donnez vos ordres, puis « Fin du mois »
et le mois se joue sous vos yeux (chantiers, récoltes, marches des armées, batailles). Le moteur, écrit en **Rust**,
tourne sur un petit serveur local ; l'interface est une page web (HTML, CSS, JavaScript, Three.js embarqué)
qui s'ouvre dans le navigateur, comme web_conquete.

## Ce qu'il y a dedans

- **Carte générée et réglable** : forme (classique, continent, deux continents, îles, archipel, mer intérieure,
  péninsule, côte, terres sans mer, ou au hasard), taille, graine, part d'océans, densité de forêt, nombre de lacs et de rivières,
  montagnes, richesse minière (pierre, fer, charbon, or), bancs de poissons, terres fertiles au bord de l'eau.
- **Rendu 3D façon dessin animé** (le même que web_power) : ombrage en trois tons et contours brun foncé, plateau
  d'hexagones étagés (mer translucide, côtes, plaines, collines, montagnes enneigées), forêts, champs en parcellaire
  avec sillons, rivières bordées de sable et leurs cascades, liserés des territoires.
- **Une carte vivante** : marché, enfants sur la place, lavandières, forgeron, bûcheron, meunier, mineurs, pêcheurs,
  travaux des champs selon la saison, vignes et vendanges, bétail et faune des lisières, bateaux, oiseaux, nuages et
  leurs ombres ; cycle lent du jour et de la nuit (fenêtres allumées, lucioles) ; fête au village après une montée de
  rang, une paix, une alliance ou la victoire, et chaque septembre ; train entre la gare et les usines avec le chemin
  de fer.
- **Routes automatiques** : chaque bâtiment achevé est relié à l'hôtel de ville, les villes à leur capitale. Elles
  s'améliorent dans 📊 Royaume : chemins de terre → routes pavées → routes royales bordées d'arbres (production et
  marches plus rapides), et changent d'aspect.
- **Bâtiments qui changent avec l'époque**, chacun sur sa dalle : colombages et chaume, puis crépi, volets et tuiles,
  puis pierre, ardoise et étages, puis brique et ardoise ; la mairie passe du beffroi à l'horloge, à la coupole dorée,
  puis au campanile ; les usines sortent de terre à l'ère industrielle.
- **Armées en icône** (ligne d'infanterie, cavalerie, canons) dont l'allure suit la technologie militaire du royaume :
  piques et mousquets, baïonnettes et grenadiers, canons Gribeauval, bicornes et cuirassiers, shakos et pantalons
  garance, képis et fourgon ; exercice en garnison, tambour en marche, bivouac la nuit.
- **Saisons** : fleurs au printemps, blés dorés l'été, forêts rousses à l'automne, arbres nus et neige l'hiver.
  Le blé ne pousse pas l'hiver, les vendanges sont à l'automne, le froid consomme du bois de chauffage.
- **Vie des villes** (aussi pour les rivaux) : jour de marché tous les trois mois dans chaque halle (impôts et
  bonheur, sauf siège, blocus ou disette) ; écoles en vacances l'été, qui stimulent les ateliers de leur ville ;
  chauffage l'hiver (bois, puis charbon à l'ère industrielle), le froid tue faute de combustible ; éclairage public
  et veilleur de nuit au Siècle des Lumières (moins d'incendies) ; ignorance et délinquance des bourgs qui s'en passent.
- **Météo tirée chaque mois** (climat tempéré du petit âge glaciaire) : soleil, nuages, pluie, orage et grêle,
  brouillard, neige, grand froid, canicule, sécheresse, tempête — avec leurs effets (récoltes, marches ralenties,
  poudre mouillée, pêche impossible, incendies, épidémies) et des prévisions. Années célèbres : Grand Hiver de 1709,
  hiver de 1740, grêle de 1788, « année sans été » de 1816. À l'écran : pluie, neige, brume, éclairs, lacs gelés.
- **Époques** : Ancien Régime (1700), Lumières (1750), Révolution et Empire (1789), Révolution industrielle (1816).
  16 technologies (Vauban, fusil à silex, manufactures, Encyclopédie, Gribeauval, pomme de terre, levée en masse,
  coke, machine à vapeur, chemin de fer…) qui changent bâtiments, unités et aspect des villes et des uniformes.
- **55 bâtiments** en 7 familles (habitat, ressources, artisanat, commerce, services, militaire, expansion),
  **10 unités** (milice, mousquetaires, grenadiers, fusiliers, chasseurs, dragons, hussards, cuirassiers, canons),
  chaînes de production, ouvriers, bonheur détaillé, impôts, rangs de ville (Hameau → Cité), colonies.
- **Rivaux qui jouent avec les mêmes règles que vous** : stocks, production, ouvriers, population, bonheur, famine,
  froid et recherche ; ils construisent selon leurs besoins et au bon endroit. Au combat, ils jugent les forces avant
  d'attaquer, rassemblent leurs armées, défendent et secourent leurs villes, se replient, débarquent escortés et
  bloquent les ports. Leurs souverains (conquérant, marchand, bâtisseur, prudent, opportuniste, fourbe) meurent ou
  sont renversés ; les rivaux se font la guerre entre eux, s'allient, se prennent des villes et se liguent contre le
  royaume trop puissant ; ils négocient (contre-propositions, paix contre une ville, demandes d'aide) et gardent
  rancune. La difficulté les rend plus malins, pas plus riches. Brigands en prime.
- **Brouillard de guerre** : terres inconnues sous la brume, terres connues mais hors de vue voilées (dernier état
  connu) ; la brume se lève au passage des armées, flottes, espions et forts.
- **Marine** : flûtes, corvettes, frégates, vaisseaux de ligne et navires à vapeur, recrutés au port. Les armées ne
  marchent pas sur l'eau : elles embarquent sur des flûtes. Batailles navales, blocus des ports, commerce par mer.
- **Espionnage** : espions recrutés à la taverne (l'académie les rend meilleurs) ; renseignement, vol de technologie,
  sabotage, au risque d'être démasqué.
- **Sièges en plusieurs mois** : tranchées, batteries et brèche, faubourgs hors les murs arrêtés et pillés chaque mois,
  reddition par la faim ou assaut. Les villes se fortifient sur 4 niveaux (palissade, murailles, bastions à la Vauban,
  citadelle), dont l'enceinte s'agrandit et change d'allure avec l'époque.
- **Retranchements et forts** : une armée se retranche en un mois, ou bâtit un fort améliorable (redoute, fort
  bastionné, fort à batteries) qui protège, voit loin et peut être pris.
- **Événements à choix** tous les trois ou quatre mois (inventeur, philosophe, disette, déserteur…).
- Les rivaux utilisent tout cela : flottes, espions, fortifications, forts, sièges et pillages. Ils vivent la même
  économie que vous (réserves, ouvriers, population, bonheur, famine, froid, recherche) et jouent avec les mêmes ordres ;
  la difficulté règle la qualité de leurs décisions (erreurs, lenteur, prévoyance), sans leur donner de ressources
  (seul le niveau Difficile garde +10 % de production).
- **Victoires** : conquête, prospérité (Cité + Palais royal + 400 habitants), diplomatie (alliance avec tous),
  ou meilleur royaume en décembre 1850.

## Lancer le jeu

Rien à installer : le script de lancement prend l'exécutable du jeu (`bin/royaumes`, `bin\royaumes.exe` sous Windows)
par `binaires.sh` (`binaires.cmd` sous Windows). Si Rust (`cargo`) est installé, il le compile sur place (la première
fois prend quelques minutes ; la compilation récupère aussi la caisse commune `web_tools_commun`, du dépôt web_suite).
Sinon il le télécharge, une fois par version, depuis la publication GitHub « binaires » (Linux x86_64 et aarch64,
macOS sur puce Apple, Windows x86_64), recompilée à chaque envoi sur main, et refuse l'archive si son empreinte
SHA-256 n'est pas celle publiée avec elle.

| Système | Commande |
|---|---|
| Windows | double-clic sur `lancer.bat` (`lancer-reseau.bat` pour y jouer depuis l'iPad) |
| Linux, macOS | `./lancer.sh` |
| Raspberry Pi | `./lancer.sh` (sans écran : ouvert au réseau local, adresse affichée), ou `sh raspberry/installer.sh` pour un démarrage automatique |
| Android (Termux) | `pkg install rust git`, puis `./lancer.sh --no-browser` et ouvrir `http://127.0.0.1:8795` |
| iPad | joue par le réseau sur le jeu lancé sur un Raspberry Pi ou un PC (Safari, puis « Sur l'écran d'accueil ») |

Options : `--lan` (ouvert au réseau local), `--local` (cette machine seulement), `--port 8795`, `--no-browser`,
`--browser`, `--no-update`. En mode réseau, un code d'appairage (commun aux web tools) est demandé la première fois.

Installé avec `git clone`, le jeu cherche une mise à jour à chaque démarrage (avance rapide seulement) et se relance
tout seul. La partie est sauvegardée à chaque mois dans `saves/` ; on peut aussi la sauvegarder sous un nom.

## Comment jouer

- **Construire** (🏗️) : choisissez un bâtiment, les cases possibles s'éclairent. Les travaux durent quelques mois.
- **Fin du mois** : tout se joue, puis le bilan du mois s'affiche (événements, stocks, population, météo à venir).
- **Armées** (⚔️) : recrutez à la caserne, au haras ou à l'arsenal ; touchez une armée puis « Donner une destination »,
  ou faites un clic droit sur la case visée. Les marches durent plusieurs mois ; neige et boue les ralentissent.
  Depuis la fiche de l'armée : se retrancher, construire un fort, embarquer sur une flotte ; assaut depuis le panneau
  de siège.
- **Marine et espions** : recrutez au port et à la taverne, puis touchez la flotte ou l'espion pour naviguer,
  débarquer, commercer ou lancer une mission.
- **Villes** : touchez la mairie pour monter de rang ou fortifier la ville.
- **Royaume** (📊) : bonheur, finances et impôts, **sciences**, stocks, conditions de victoire, journal.
- Gestes : glisser = déplacer, pincer = zoom, deux doigts = tourner, toucher une case pour l'inspecter.
  Clavier : ZQSD ou flèches, E / R pour tourner, Entrée = fin du mois, Échap = annuler.

## Organisation

```
rust/royaumes/        le moteur et le serveur (Rust)
  data/regles.json    bâtiments, unités, technologies, époques, prix (envoyé tel quel à l'interface)
  src/carte.rs        génération de la carte
  src/meteo.rs        calendrier, saisons, météo et ses effets
  src/partie.rs       état de la partie, territoire, construction, armées, chemins
  src/tour.rs         la fin du mois (économie, marches, batailles, événements, victoire)
  src/cite.rs         la vie des villes : jour de marché, écoles, chauffage, éclairage public
  src/ia/             les royaumes de l'ordinateur : mod.rs (le mois, la difficulté), economie.rs (besoins et
                      décisions économiques), militaire.rs (défense, campagnes, sièges, marine, espions, forts),
                      diplomatie.rs (relations entre tous les royaumes, souverains, coalitions, guerres et paix)
  src/commandes.rs    les ordres du joueur (vérifiés par le moteur)
  src/marine.rs, espions.rs, sieges.rs, forts.rs, choix.rs   flottes, espionnage, sièges et fortifications,
                      retranchements et forts, événements à choix
  src/vue.rs          ce que reçoit l'interface
  src/serveur.rs      serveur HTTP (web_tools_commun), sauvegardes, options, mise à jour
web/                  l'interface (index.html, css/, js/) ; images, icônes et rendu : graphismes/
  graphismes/         la bibliothèque graphique commune web_engine (three.js r186 ; rendu/ : tous les rendus, plateau 3D, modèles, images, icônes,
                      routes, vie de la carte, météo, étiquettes, brouillard, marine, espions, remparts, sièges, forts).
                      NE PAS MODIFIER ICI : les graphismes se modifient dans web_engine (lib/), puis
                      `bash outils/maj-graphismes.sh` ; la CI vérifie que ce dossier est identique à web_engine
outils/maj-graphismes.sh   met à jour web/graphismes depuis web_engine (aussi chaque lundi par l'action « graphismes »)
maquettes/            maquettes 3D validées avant intégration (rendu, armées, guerre, vie des quartiers)
tests/navigateur.py   banc d'essai de l'interface dans Chrome (Playwright)
```

Bancs d'essai : `cargo test -p royaumes` (dont une campagne de dix ans jouée par un robot, dix ans de rivaux laissés
seuls aux trois difficultés et la relecture d'une sauvegarde). Interface : serveur lancé, puis
`python3 tests/navigateur.py`.
