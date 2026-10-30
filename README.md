# web_engine

Moteur de jeu réutilisable : **simulation en Python** + **rendu web PixiJS** avec thèmes graphiques interchangeables.
Gère le temps réel (pause, vitesses ×1/×2/×5/×20) et le tour par tour, jour/nuit, météo, saisons, sauvegarde.

## Lancer

```bash
python3 lancer.py demo 8080
```
Puis ouvrir `http://<ip-du-raspberry>:8080` sur l'iPad. Aucune dépendance Python, PixiJS est inclus (fonctionne hors ligne).

Test du moteur : `python3 tests/test_moteur.py`

## Organisation

```
moteur/monde.py     Horloge, météo, ressources, entités, événements, sauvegarde
moteur/serveur.py   Serveur HTTP + boucle de jeu (API /api/etat, /api/carte, /api/action)
jeux/<nom>/regles.py  Les règles d'un jeu (seule chose à écrire pour un nouveau jeu)
web/moteur/rendu.js   Calques, caméra (doigt, stylet, molette), jour/nuit, pluie
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
