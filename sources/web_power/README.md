# web_power

**GridMaster** est un jeu de gestion d'un réseau électrique régional, dans le navigateur, sur un plateau d'hexagones en style cartoon (three.js).

La partie est une campagne historique de 1900 à 2050. En 1900, une seule ville découvre l'électricité, alimentée par une petite usine au charbon et une usine au fil de l'eau, en 15 kV. Au fil des époques, les villes s'étendent, de nouveaux villages apparaissent et deviennent des villes, et les technologies arrivent à leur date historique : 63 kV, grands barrages, 225 kV et interconnexion, fioul, 400 kV, nucléaire, gaz, éolien, solaire, batteries, petits réacteurs, fusion.

La région a trois réseaux à gérer : l'électricité, l'eau et les déchets. Le but est de les étendre à mesure que la région se peuple. En 2050, l'électricité doit être bas carbone, sans coupure ni faillite, l'eau potable servie et conforme aux normes, et les déchets valorisés.

| Époque | À partir de | Ce qui change |
|---|---|---|
| Les pionniers | 1900 | usines au charbon et au fil de l'eau, lignes 15 kV |
| L'entre-deux-guerres | 1920 | 63 kV, grands barrages (1922), centrales au charbon (1925) |
| Le réseau régional | 1935 | 225 kV, postes 225/63 kV, interconnexion (1938) |
| La reconstruction | 1946 | fioul (1952), grandes centrales au charbon (1955), forte croissance |
| Les Trente Glorieuses | 1960 | 400 kV, turbines à combustion (1965) |
| Le choc pétrolier | 1974 | fioul hors de prix, nucléaire |
| Le marché | 1990 | cycles combinés au gaz, éolien (1996), biomasse |
| Le climat | 2005 | taxe carbone, solaire, éolien en mer, batteries |
| La transition | 2020 | sortie du charbon obligatoire avant 2032 |
| Le futur | 2035 | petits réacteurs (2030), fusion (2042) |

## Jouer

Le jeu est une page web, sans installation, sans compilation ni serveur obligatoire : `index.html` charge ses styles (`css/`) et ses scripts (`js/`). Voir [Organisation des fichiers](#organisation-des-fichiers).

- **Localement** : ouvrez `index.html` dans un navigateur récent. Une connexion internet est nécessaire pour charger three.js et les polices.
- **En ligne** : activez GitHub Pages sur la branche `main` (Settings → Pages). Le jeu sera alors disponible à l'adresse `https://pilou33620.github.io/web_power/`.

- **Sur le réseau local** (tablette, autre poste) : `python3 serveur.py`, ou le bouton de `web_launcher` (port 8794). Bibliothèque standard Python seulement, rien à installer ; marche pareil sous Raspberry Pi, Windows et Termux.
  - L'autre appareil ouvre l'adresse « réseau » affichée, entre une fois le code d'appairage (affiché dans le terminal et sur la carte du launcher), et peut installer la CA du poste depuis `/appairage/ca.pem` pour éviter l'alerte HTTPS.
  - Options : `--port N`, `--local` (127.0.0.1 seulement), `--sans-navigateur`, `--sans-pause`, `--sans-maj` (au démarrage, le serveur met le dépôt à jour par `git pull --ff-only`, sauf sous `web_launcher`, qui s'en charge).
  - Banc du serveur : `python test/banc-serveur.py` (affiche `OK`).

La partie s'enregistre automatiquement dans le navigateur à chaque jour de jeu : chaque appareil a donc sa propre partie, et le serveur ne stocke rien.

## Écrans

- **Ordinateur et tablette (iPad)** : format paysage, avec la carte à gauche et le panneau de gestion à droite. Une fenêtre d'ordinateur étroite (moins de 900 px) passe en portrait.
- **Téléphone (iPhone)** : format portrait, avec la carte en haut et le panneau qui monte du bas.
- Si l'appareil est tenu dans l'autre sens, un écran demande de le tourner. Le bouton « Continuer ainsi » passe outre.

## Quatre vues

- **Carte** (touche 1) : toute la région, tous les réseaux à la fois, sans les flux.
- **Électricité** (touche 2) : centrales et postes en surbrillance dorée, courant dans les lignes ; les ouvrages de l'eau passent en fantôme.
- **Eau** (touche 3) : captages, usines, châteaux d'eau et épurations en surbrillance bleue, conduites en transparence avec l'eau qui y coule ; les centrales passent en fantôme.
- **Déchets** (touche 4) : décharges, centres de tri, incinérateurs et compostages en surbrillance orange ; les autres ouvrages passent en fantôme.

On construit dans la vue de chaque réseau.

## Gestion de l'eau

- **Ouvrages**, datés comme les centrales :
  - captage de source, forage en nappe, prise d'eau en rivière (1900) ;
  - usine de potabilisation (1905) ;
  - château d'eau, réservoir sur colline (1900) ;
  - station de pompage (1910) ;
  - lagunage (1900) ;
  - forage profond (1955) ;
  - station d'épuration (1950) ;
  - dessalement (1985).
- **Conduites et égouts** : tracés d'hexagone en hexagone ; une nouvelle conduite suit de préférence les conduites existantes. Dans une ville raccordée, la distribution se dessine toute seule de quartier en quartier.
- **Simulation**, par réseau connexe et par pas de 15 minutes :
  - demande des habitants et des industries, avec les pointes du matin et du soir et la chaleur ;
  - débit de la rivière, irrigation des fermes l'été, débit réservé à partir de 1984, nappe qui se recharge l'hiver ;
  - stocks des châteaux d'eau, fuites qui augmentent avec l'âge des conduites, casses.
- **Qualité** : six paramètres (turbidité, microbes, matières organiques, nitrates, pesticides, micropolluants). Leurs normes entrent en vigueur au fil du siècle. La chaîne de traitement de chaque usine se complète par étapes : filtre à sable et chlore, charbon actif, ozonation, dénitratation, ultrafiltration.
- **Recherche** : une branche « Eau et assainissement » de 10 technologies. Elle débloque les étapes de traitement après leur date (charbon actif, ozonation, dénitratation, ultrafiltration). Elle réduit aussi les fuites et les casses, augmente la capacité des stations d'épuration, rend le dessalement moins gourmand et ouvre la réutilisation des eaux usées.
- **Crises sanitaires** : une eau chargée en microbes peut déclencher une épidémie dans la ville (typhoïde au début du siècle, puis dysenterie, gastro-entérite). Une épidémie coûte des soins, fait chuter la satisfaction et dure une à deux semaines.
- **Pollutions accidentelles** (à partir de 1920) : un rejet industriel descend la rivière ou un captage de nappe est contaminé pendant quelques jours. On coupe les captages touchés depuis leur fiche ; la recherche « Surveillance continue de la qualité » les coupe automatiquement.
- **Réutilisation des eaux usées** (recherche, à partir de 2010) : une station d'épuration ou un lagunage équipé fournit son eau traitée à l'irrigation des fermes, puis à l'industrie, à la place de l'eau potable et des prélèvements en rivière. Des conduites vertes partent de la station vers les fermes et la zone industrielle les plus proches.
- **Assainissement** : les eaux usées non épurées polluent la rivière en aval et dégradent les prises d'eau. Elles coûtent des amendes à partir de 1992.
- **Économie** : prix du m³ réglable, restrictions d'usage, renouvellement des vieilles conduites. Le pompage et le traitement consomment de l'électricité.

## Contenu

- **Plateau** : une installation par hexagone, avec des règles de pose par terrain (barrage sur rivière, nucléaire au bord de l'eau, éolien en mer sur la côte…). Les villes occupent plusieurs hexagones et s'agrandissent avec les années.
- **Réseau** : lignes 15, 63, 225 et 400 kV tracées d'hexagone en hexagone. Au début, les usines alimentent directement les villes en 15 kV ; plus tard, l'ordre devient centrale → 225 kV → poste 225/63 kV → 63 kV → ville.
  - Seul un poste change de tension : une centrale raccordée en 225/400 kV ne peut pas repartir en 15/63 kV vers une ville.
  - Flux de puissance calculés ligne par ligne (courant continu), avec les pertes.
  - Contrôle du critère N-1, déclenchement des lignes en surcharge, îlotage.
- **Dispatch** : appel des centrales par coût marginal (modifiable), batteries, valeur de l'eau des barrages, import et export, fréquence, délestage.
- **Météo** : saisons, vent, soleil, débit de la rivière, prévisions à 3 jours.
  - À l'écran : nuit bleutée sous la lune, aube et crépuscule dorés, nuages qui dérivent avec le vent et dont l'ombre court sur la carte, pluie, neige qui tient au sol puis fond, brouillard des matins d'hiver, éclairs pendant les tempêtes, feuilles mortes à l'automne, couleurs du sol selon la saison.
  - La nuit, seules les villes alimentées s'allument : une coupure se voit.
- **Partie tutoriel guidée** (Menu → Partie tutoriel guidée, ou depuis le tutoriel en fiches) : une vraie partie en 15 étapes, avec une fiche de guidage en bas à gauche. On construit une usine et sa ligne, on épure les eaux usées avec un lagunage et un égout, on dimensionne la flotte de camions et la collecte, puis on découvre les malus d'un bâtiment et les liens entre les réseaux. Chaque étape se valide toute seule ; un bouton montre où aller.
- **Tutoriel en fiches** (s'ouvre seul à la première partie, puis Menu → Tutoriel) : quatre sujets, électricité, eau, déchets et territoire. Il reprend la chaîne de l'électricité (centrale → 225/400 kV → poste 225/63 kV → 63 kV → ville) celle de l'eau (captage → potabilisation → château d'eau → ville → égout → épuration → rivière) et celle des déchets (ville → bacs → camions → tri, compost, incinération → décharge), étape par étape.
- **Économie** : tarifs, combustibles, taxe carbone qui augmente chaque année, prêts.
- **R&D** : 55 technologies réparties en 6 branches et 5 niveaux.
- **Événements** : pannes, tempêtes, vagues de froid, canicules, sécheresses, crise du gaz.
- **Ambiance** : fermes sur les plaines et les prairies, bateaux, oiseaux, vaches, cerfs et tracteurs.
  - Routes entre chaque ville et ses deux voisines (en terre, puis goudronnées en 1930), une desserte vers chaque ouvrage isolé et un chemin de terre vers chaque ferme isolée. Les routes se redessinent quand on construit ou démolit.
  - Trafic selon l'époque : charrettes à cheval, puis premières automobiles et camions (1910), autobus (1930), voitures colorées (1955), voitures modernes (2000). Le trafic grossit au fil du siècle, les camions desservent les ouvrages, et les phares s'allument la nuit.
- **Cartes** :
  - Vallée de Valmont ;
  - Côte d'Émeraude ;
  - Grande plaine agricole ;
  - Île de Kerlann (aucune interconnexion) ;
  - Bassin de Forgeval (industriels exigeants) ;
  - Carrefour des frontières (marché ouvert) ;
  - carte aléatoire, définie par une graine.
- **Difficultés** : Facile, Normal, Difficile.

## Gestion des déchets

La troisième filière se gère dans la vue **Déchets** (touche 4) et l'onglet Déchets.

- **Production** : chaque ville remplit ses poubelles, environ 120 kg par habitant et par an en 1900, plus de 500 kg en 2000. La part des emballages grandit au fil du siècle ; les déchets verts reviennent au printemps et à l'automne, les emballages en fin d'année, les encombrants après une tempête.
- **Camions de collecte** : le premier levier. Tombereaux à cheval (2,5 t par jour), camions (5 t, 1925), puis bennes tasseuses (recherche). Trop peu de camions : les bacs débordent et les ordures finissent dans la rue. Trop : chaque camion coûte cher pour rien. L'onglet compare la flotte au besoin ; les camions se voient sur la carte, dans les quartiers et sur les routes des sites.
- **Collecte par flux** : passages par semaine pour les ordures, colonnes à verre (1974), bac jaune des emballages (1992, recherche), bac marron des biodéchets (2000, recherche).
- **Sites** : dépôt de camions (1900), décharge (1900, se remplit, loin des habitations et de la rivière), quai de transfert (1970), usine d'incinération (1960), méthaniseur (2005), compostage (1980), déchèterie (1985, encombrants et déchets verts), centre de tri (1990). Décharges pleines : export d'urgence à prix d'or.
- **Économie** : redevance par habitant, ventes des matières triées à des cours qui bougent (stocker quand un cours s'effondre), taxe sur l'enfouissement à partir de 1999.
- **Gêne** : dépôts sauvages, bacs qui débordent et riverains des sites pèsent sur la satisfaction. Lentilles Remplissage des bacs et Nuisances.
- **Événements** : grève de la collecte, incendie de centre de tri, effondrement d'un cours, décharge sauvage.
- **Recherche** : une branche « Déchets » de 13 technologies.
- **Diagramme des flux** : d'où viennent les tonnes et où elles vont sur 30 jours ; l'installation saturée est cerclée de rouge. Chaque tonne produite est retrouvée (vérifié chaque jour).
- **Dépôt et quai de transfert** : les camions partent d'un dépôt, collectent, puis vident au site de traitement ou à un quai de transfert plus proche (1970). Plus le trajet est long, moins un camion collecte ; après un quai, de gros porteurs font le reste pour moins cher.
- **Équipages et horaires** : des tournées trop chargées et la collecte de nuit usent les équipages, et des équipages usés font plus souvent grève. La collecte de nuit supprime la gêne du bruit mais coûte 25 % de plus. Recherche « Bennes ergonomiques ».
- **Lien avec l'électricité** : l'incinérateur (4 MW) et le méthaniseur (2005, recherche) produisent selon les tonnes traitées, s'ils sont reliés au réseau en 15 ou 63 kV.
- **Lien avec l'eau** : les stations d'épuration envoient leurs boues dans les flux de déchets (méthaniseur, compost, incinérateur ou décharge) ; les jus des décharges proches de la rivière la polluent, jusqu'aux prises d'eau.
- **Objectif 2050** : 65 % des déchets valorisés, dont 30 % recyclés ou compostés.

## Territoire et habitants

Ce qui relie les trois réseaux et leurs habitants (`js/06c-territoire.js`) :

- **Enquête publique** (à partir de 1960) avant une décharge, un incinérateur, un centre de déchets dangereux, une centrale nucléaire ou un barrage : passer en force (délai normal, riverains fâchés, risque d'un recours en justice qui suspend le chantier 9 mois), concerter (chantier 40 % plus long, aucun recours) ou indemniser la commune (coût +15 %, aucun recours).
- **Réseau de chaleur** (outil Chaleur, vues Électricité et Déchets, à partir de 1925) : un tuyau orange relie une centrale thermique, un incinérateur ou un méthaniseur à une ville. La chaleur se vend et remplace une partie du chauffage électrique l'hiver.
- **Quartiers aux attentes différentes** : le centre-ville veut au moins 3 passages par semaine et pas de bruit ; la zone industrielle produit des déchets dangereux à traiter à part (centre de traitement, 1955), sinon les fûts stockés finissent par fuir dans la rivière ; l'hôpital ne supporte aucune coupure d'électricité.
- **Fêtes et vacances** : fête nationale, vacances d'été (plus de monde sur la côte et l'île, moins ailleurs), fêtes de fin d'année. Plus de déchets et d'eau à ces dates ; renforts saisonniers (camions et bacs loués 30 jours).
- **Élections municipales** tous les 6 ans à partir de 1902 : le maire est réélu si la satisfaction dépasse 50 %, et fixe une priorité pour le mandat (ville propre, électricité pour tous, eau moins chère, chauffage urbain, zéro décharge, sortie du charbon). Tenue : prime et habitants satisfaits ; manquée : habitants déçus.
- **Plan de crise** (onglet Région) : camions de réserve, groupes électrogènes, citernes, équipes d'astreinte. Coûte chaque année, mais grèves, tempêtes, pollutions, coupures d'hôpital et coupures en cascade comptent deux fois moins.
- **Vieillissement** : chaque bâtiment a une durée de vie (25 à 40 ans). Usé, il tombe plus souvent en panne et gêne davantage ; on le rénove (40 % de son prix) ou on le démantèle (une décharge fermée reste 30 ans sous surveillance, un réacteur coûte 30 % de son prix à démanteler).
- **Cyberattaque** (à partir de 2010) : quelques jours sans alertes, sans prévisions et sans optimisation des tournées. Recherche « Cybersécurité ».
- **Coupure en cascade** (à partir de 1920) : quand une ville est privée d'électricité, les pompes, usines d'eau, épurations et sites de déchets voisins s'arrêtent, sauf s'ils ont un groupe électrogène de secours (amélioration) ou si le plan de crise est actif (moitié de la capacité).
- **Sécheresse et canicule partagées** : en sécheresse, il faut choisir à qui va la rivière (onglet Eau) : l'eau potable (les centrales au bord de l'eau perdent 30 %) ou les centrales (les prises d'eau perdent 40 %). En canicule, les centrales sont bridées, la demande d'eau monte, les déchets sentent plus fort.

## Malus et améliorations des bâtiments

Beaucoup de bâtiments, dans les trois réseaux, ont un malus. La fiche du bâtiment le montre, avec l'équipement qui le réduit, débloqué par une recherche :

| Bâtiments | Malus | Équipement | Recherche |
|---|---|---|---|
| Usine, centrales au charbon et au fioul | fumées : riverains gênés, malus du charbon | dépoussiérage et désulfuration | Production, 1970 |
| Centrale au gaz, turbine | oxydes d'azote : riverains gênés | brûleurs bas NOx | Production, 1990 |
| Station d'épuration, lagunage | odeurs près des villes | couverture et désodorisation | Eau, 1975 |
| Station d'épuration, lagunage | boues à éliminer | déshydratation des boues (÷3) | Eau, 1980 |
| Décharge | jus qui polluent la rivière | casiers étanches | Déchets, 1975 |
| Décharge | odeurs et méthane | captage du biogaz | Déchets, 1990 |
| Incinérateur | fumées | traitement des fumées | Déchets, 1990 |
| Compostage, méthaniseur | odeurs | bâtiment fermé | à partir de 1995 |
| Pompes, usines d'eau, épurations, sites de déchets | s'arrêtent pendant les coupures | groupe électrogène de secours | à partir de 1930 |

La maquette autonome qui a servi à concevoir ce mode reste dans `maquettes/dechets.html`.

## Organisation des fichiers

Le découpage reprend celui de web_cao : une page, un dossier `css/` et des scripts numérotés dans `js/`.

| Fichier | Contenu |
|---|---|
| `index.html` | la page : structure HTML, chargement de three.js et des scripts |
| `css/style.css` | tous les styles, mises en page paysage et portrait comprises |
| `js/00-appareil.js` | détection ordinateur, tablette ou téléphone, avant l'affichage |
| `js/01-outils.js` | utilitaires, grille hexagonale |
| `js/02-terrain.js` | génération des cartes et du terrain |
| `js/03-moteur-3d.js` | scène three.js, matériaux, plateau |
| `js/04-modeles.js` | modèles 3D des installations et des quartiers |
| `js/05-catalogue.js` | catalogue des centrales et des postes, tensions des lignes |
| `js/06-eau.js` | réseau d'eau : ouvrages, conduites, qualité, simulation |
| `js/06b-dechets.js` | déchets : sites, collecte, tri, traitement, marché, simulation journalière |
| `js/06c-territoire.js` | chaleur, fêtes, élections, plan de crise, vieillissement, cascades, déchets dangereux |
| `js/07-epoques-rd.js` | époques de la campagne, recherche |
| `js/08-installations.js` | état de la partie, construire et démolir |
| `js/09-lignes.js` | lignes électriques et leurs règles de raccordement, dessin des conduites |
| `js/10-reseau.js` | topologie, flux de puissance, critère N-1 |
| `js/11-meteo-demande.js` | soleil, météo, demande |
| `js/12-dispatch.js` | appel des centrales, stockage, import |
| `js/13-simulation.js` | pas de 15 minutes : économie, pannes, événements |
| `js/14-superpositions.js` | survol, sélection, lentilles, fumées |
| `js/15-camera.js` | caméra et commandes tactiles ou souris |
| `js/16-interface.js` | barre de construction, survol, clics sur la carte |
| `js/17-panneaux.js` | panneaux de gestion (électricité, eau et déchets) |
| `js/18-hud.js` | barre du haut, étiquettes, mini-carte |
| `js/19-vues.js` | les quatre vues : carte, électricité, eau, déchets |
| `js/20-actions.js` | boutons, menu, tutoriel, bilans annuels |
| `js/21-partie.js` | nouvelle partie, sauvegarde, chargement |
| `js/22-banc.js` | stratégies programmées du banc d'équilibrage |
| `js/23-ambiance.js` | routes, véhicules, animaux, bateaux |
| `js/24-ciel.js` | jour et nuit, nuages, pluie, neige, saisons, lumières |
| `js/25-boucle.js` | démarrage et boucle d'animation |

Les scripts sont des scripts classiques chargés dans l'ordre de leur numéro : ils partagent leurs déclarations, donc un fichier peut utiliser ce que les précédents ont défini. Seul three.js arrive en module ES, depuis le CDN.

Le serveur (`serveur.py`) ne sert que la page, `css/*.css` et `js/*.js`.

## Banc d'équilibrage

Le banc joue des campagnes complètes de 1900 à 2050 avec trois stratégies programmées (aucune IA) :

- **Passif** : ne construit rien.
- **Fossile** : charbon, puis fioul, puis gaz, au moindre coût.
- **Bas carbone** : hydraulique, puis nucléaire, renouvelables, stockage et petits réacteurs.

Il sert à vérifier l'équilibrage après une modification.

**Dans le jeu** : Menu → Banc d'équilibrage.

**En ligne de commande**, avec plusieurs parties en parallèle et un rapport année par année :

```bash
cd banc
```

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
node banc.js diffs=normal strats=passif,fossile,vert paralleles=4
```

Options disponibles :

| Option | Valeurs |
|---|---|
| `cartes=` | `valmont`, `littoral`, `plaine`, `ile`, `industrie`, `marche`, `aleatoire` |
| `diffs=` | `facile`, `normal`, `difficile` |
| `strats=` | `passif`, `fossile`, `vert` |
| `graine=` | graine de la carte aléatoire |
| `sortie=` | préfixe des fichiers produits |

Le programme écrit `banc-resultats.json` et `banc-rapport.md`. Les résultats de référence sont dans [`banc/rapport-reference.md`](banc/rapport-reference.md).
