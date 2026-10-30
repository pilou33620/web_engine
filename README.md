# web_engine

Moteur de jeu réutilisable : **simulation en Python** + **rendu web PixiJS** avec thèmes graphiques interchangeables.
Gère le temps réel (pause, vitesses ×1/×2/×5/×20) et le tour par tour, un climat physique (soleil, météo, saisons, eau), la sauvegarde.

## Lancer

```bash
python3 lancer.py demo 8080
```
Puis ouvrir `http://<ip-du-raspberry>:8080` sur l'iPad. Aucune dépendance Python, PixiJS est inclus (fonctionne hors ligne).

Tests : `python3 tests/test_moteur.py` et `python3 tests/test_climat.py` (10 ans simulés comparés aux normales de Bordeaux)

## Organisation

```
moteur/monde.py         Horloge, entités, ressources, événements, décisions, fiches, vues, sauvegarde
moteur/climat.py        Physique du climat (fichier à part, utilisé d'office par le monde)
moteur/construction.py  Constructions du joueur, validées côté serveur
moteur/serveur.py       Serveur HTTP + boucle de jeu
jeux/<nom>/regles.py    Les règles d'un jeu (seule chose obligatoire pour un nouveau jeu)
jeux/<nom>/web/         Optionnel : styles.js et images propres au jeu (servis sous /jeu/)
web/moteur/rendu.js     Calques, dessin par style, caméra (doigt, stylet, molette)
web/moteur/climat.js    Rendu du climat : lumière, saisons, nuages, pluie, neige, orages, brouillard, crues
web/moteur/themes/      Thèmes « Vue aérienne » et « Carte » + outils de dessin
web/moteur/*.js         Modules : vues de données, minicarte, construction, décisions, tutoriel
web/app.js, style.css   Kit d'interface commun ; les modules s'y branchent via l'objet ctx
```

API : `GET /api/etat`, `/api/carte`, `/api/info?id=`, `/api/vue?id=`, `POST /api/action {nom, params}`.

## Créer un jeu

Créer `jeux/mon_jeu/regles.py` avec une classe `Regles` :

| Méthode / attribut | Rôle |
|---|---|
| `initialiser(monde)` | créer la carte (`monde.ajouter(...)`), les ressources (`monde.ressource(...)`), `monde.relief` |
| `tick(monde, heures)` | déplacer les unités, produire en continu |
| `nouveau_jour(monde)` | production, événements (`monde.annoncer`), décisions (`monde.proposer`) |
| `action(monde, nom, params)` | actions du joueur ; lever `ValueError` pour refuser |
| `info(monde, entite)` | optionnel : fiche `{titre, lignes, actions}` affichée au toucher |
| `vue(monde, id)` + `VUES` | optionnel : cartes de données `{id_entite: 0..1}` coloriées sur la carte |
| `CONSTRUCTIONS`, `peut_construire`, `construit` | optionnel : ce que le joueur peut construire (voir moteur/construction.py) |
| `TITRE`, `CLIMAT`, `TUTORIEL` | optionnels : nom du jeu, climat, étapes du tutoriel guidé |
| `ANNEE` | optionnel : année du rendu (défaut 1790), de l'Antiquité (-100) à 2100, sans Moyen Âge : villes, routes, réseaux, véhicules et campagne suivent l'époque (voir `web/moteur/themes/epoque.js`) |

### Entités universelles

`monde.ajouter(type, style, calque=…, **propriétés)` :

| type | géométrie | exemples de styles fournis |
|---|---|---|
| `zone` | rectangle `x, y, w, h` ou polygone `points` | chaume, culture, prairie, labour, colza, foret, mer, lac |
| `ligne` | `points` | route, riviere, haie, frontiere, ligne_electrique, canalisation |
| `batiment` | `x, y, taille` | ville, eolienne, transformateur, hangar |
| `unite` (`mobile=True`) | `x, y, angle` | tracteur, regiment |

Calques, du bas vers le haut : sol, eau, vegetation, relief, routes, reseaux, frontieres, batiments, etiquettes, unites.
Propriétés reconnues : `nom` (étiquette), `lumiere` (s'éclaire la nuit), `image` (sprite à la place du dessin),
`effet` (ex. `"poussiere"`), `constructible` (démolissable), `ancre` (position du nom).
Un style inconnu est dessiné par le style par défaut `_` du thème. Pour dessiner ses propres styles, un jeu fournit
`jeux/<nom>/web/styles.js` :

```js
export default { aerienne: { batiment: { moulin(e) { return { dessin: … }; } } }, carte: { … } };
```

## Cartes

Deux cartes réelles toutes faites et un générateur, au même format (voir `moteur/cartes.py`) :

| Carte | Contenu | Échelle |
|---|---|---|
| `france` | 96 départements, préfectures et grandes villes, fleuves et rivières, lacs, Corse, pays voisins, relief des massifs | 1 unité = 250 m |
| `aquitaine` | Gironde, Dordogne, Landes, Lot-et-Garonne, Pyrénées-Atlantiques ; départements voisins et Espagne grisés | 1 unité = 100 m |

Les contours sont simplifiés (reconnaissables, pas exacts au mètre) et projetés en Lambert conique, comme les cartes IGN.
L'occupation du sol (forêts, cultures, prairies, vignes, landes, roche) est plausible, pas exacte : grands terroirs connus
(forêt des Landes, Vosges, bocage breton, vignobles…) + altitude + bruit. Les thèmes la peignent en texture (calque « occupation »).
Sources : départements IGN/INSEE via github.com/gregoiredavid/france-geojson (Licence Ouverte), fleuves, lacs et pays
Natural Earth (domaine public). Pour les refabriquer : `python3 outils/creer_cartes_reelles.py`.

Dans les règles d'un jeu :

```python
from moteur import cartes
cartes.charger(monde, "aquitaine")                       # carte toute faite
cartes.generer(monde, forme="îles", mer=0.5, graine=7)   # carte générée (réglages : moteur/generateur.py, REGLAGES)
```

Les villes viennent des communes INSEE (toutes celles de plus de ~900 habitants en Aquitaine, ~4 000 en France,
espacées), avec leur emprise bâtie peinte dans l'occupation du sol. Les rivières sont raccordées entre elles et à la mer
(estuaire de la Gironde, bassin d'Arcachon et étangs repris de web_conquete). Les routes relient chaque ville à ses
voisines naturelles (`moteur/routes.py`) : grands axes et chemins, dessinés selon l'époque.

Le générateur règle : taille et forme des terres (continent, côte, îles, isthme, presqu'île), part de mer, montagnes,
collines, altitude, rivières, régions, villes, forêts, cultures, latitude et graine. Chaque carte apporte son climat
(latitude, zones). Pour essayer : `CARTE=france python3 lancer.py atlas 8080`, puis ☰ → Carte.

## Climat

Calé sur des **normales réelles** (Bordeaux-Mérignac par défaut), pas de calcul d'une heure :

| Phénomène | Modèle | Pour les règles du jeu |
|---|---|---|
| Soleil | lever, coucher, hauteur réels selon date et latitude, rayonnement W/m² | `z.ensoleillement` (solaire, cultures) |
| Température | normale du jour + cycle jour/nuit (amorti par les nuages) + masses d'air | `z.temperature`, `z.drapeaux["gel"]` |
| Nuages, pluie | situation météo aléatoire calibrée sur les jours et cumuls mensuels | `z.nebulosite`, `z.pluie` (mm/h) |
| Vent | vitesse, rafales, direction dominante ouest-sud-ouest | `z.vent`, `z.rafales` (m/s), `z.direction` |
| Neige, orage, brouillard | selon température, intensité, heure, humidité | `z.meteo`, `z.neige` (mm) |
| Eau du sol | pluie + fonte − évaporation, réserve de 100 mm | `z.sol` (sécheresse < 20 mm) |
| Rivières | surplus d'eau → bassin qui se vide en ~48 h | `z.debit` (×1 = normal, crue > ×3) |

`z = monde.climat.zone_de(x, y)` donne la zone climatique d'un point. Un jeu règle son climat
dans sa classe `Regles` :

```python
CLIMAT = {"latitude": 44.8, "normales": BORDEAUX, "zones": [
    {"nom": "Côte", "rect": [x0, y0, x1, y1], "pluie": 1.15, "vent": 1.5},
    {"nom": "Coteaux", "rect": [...], "dt": -1.5}]}   # dt : écart de température en °C
```
Les crues, sécheresses, gelées, orages et chutes de neige sont annoncés automatiquement dans le journal.
