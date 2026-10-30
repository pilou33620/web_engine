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
moteur/monde.py     Horloge, ressources, entités, événements, sauvegarde
moteur/climat.py    Physique du climat (fichier à part, utilisé d'office par le monde)
moteur/serveur.py   Serveur HTTP + boucle de jeu (API /api/etat, /api/carte, /api/action)
jeux/<nom>/regles.py  Les règles d'un jeu (seule chose à écrire pour un nouveau jeu)
web/moteur/rendu.js   Calques, caméra (doigt, stylet, molette)
web/moteur/climat.js  Rendu du climat : lumière, saisons, nuages, pluie, neige, orages, brouillard, crues
web/moteur/themes.js  Thèmes « Ferme » (vue aérienne) et « Carte » (stratégique)
web/app.js, style.css Kit d'interface commun (barre, journal, temps, réglages)
```

## Créer un jeu

Créer `jeux/mon_jeu/regles.py` avec une classe `Regles` :

| Méthode | Rôle |
|---|---|
| `initialiser(monde)` | créer la carte (`monde.ajouter(...)`) et les ressources (`monde.ressource(...)`) |
| `tick(monde, heures)` | déplacer les entités mobiles |
| `nouveau_jour(monde)` | production, événements (`monde.annoncer(...)`) |
| `action(monde, nom, params)` | actions du joueur ; lever `ValueError` pour refuser |

Types d'entités dessinés par les thèmes : `parcelle`, `haie`, `riviere`, `route`, `frontiere`, `ville`, `tracteur`, `regiment`.
Un nouveau type s'ajoute en écrivant sa fonction de dessin dans chaque thème.

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
