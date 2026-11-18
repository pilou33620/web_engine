# web_engine — galerie des rendus

Rassemble les rendus 3D des bâtiments des deux jeux, séparés par source, pour préparer leur fusion.

| Dossier | Source | Époques | Rôle prévu |
|---|---|---|---|
| `web_royaumes/` | web_royaumes @ `c33f182` (main) | 1700 Ancien Régime · 1750 Lumières · 1789 Empire · 1816 Révolution industrielle | rendus des **époques passées** |
| `web_power/` | web_power @ `14109fc` | 1900 → 2035 (10 ères) | rendus des **époques modernes** |

Les fichiers des jeux sont copiés **sans modification** : `web_royaumes/js/rendu`, `css/`, `vendor/three` ; le jeu web_power complet (`web_power/jeu.html`, `js/`, `css/`).
`web_royaumes/donnees/` contient les règles, et une carte et un état de partie produits par le vrai moteur Rust (carte petite, graine 1700, tour 3).
Seules les pages de la galerie sont nouvelles : `index.html`, `visionneuse.css`, `*/visionneuse.html`, `web_power/visionneuse.js`, `*/monde.html`.

## Voir la galerie

```sh
cd web_engine && python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Un serveur est nécessaire (modules JS et `fetch`). web_power charge three.js 0.170 depuis cdn.jsdelivr.net, comme le jeu.

- Onglet par source ; dans chaque visionneuse : époque, saison, neige au sol, et un bâtiment ou tous.
- **web_royaumes** : rendu toon façon web_power (dalle hexagonale, contours bruns). Le style des bâtiments change avec l'époque ; la saison change les champs, vignes, arbres, jardins et la hauteur du soleil ; la case « Incendié » montre la version en ruine.
- **web_power** : l'époque filtre les installations disponibles cette année-là (années `an` / `fin` du catalogue) ; la saison teinte le sol comme dans le jeu (les bâtiments eux-mêmes ne changent pas).

## Monde vivant

Deuxième page de chaque source : la carte du jeu avec sa **nature** (mer, rivières, forêts, champs, collines, montagnes) et ses **animations** (fumées, habitants, véhicules, marché, météo, jour et nuit), rendue par le moteur du jeu lui-même.

- **web_royaumes** (`monde.html`) : le pipeline de `appliquer()` de `main.js` sur la carte et l'état du moteur. La page ne fait que retoucher l'état : époque (style des bâtiments, uniformes, éclairage public), saison, temps, neige au sol, heure, jour de marché, remparts, et tous les bâtiments posés autour de la capitale.
- **web_power** (`monde.html`) : le jeu complet dans un cadre, piloté avec ses propres fonctions. Nouvelle partie, croissance des villes année par année jusqu'à l'époque, une installation de chaque type de l'époque raccordée à la capitale, puis le mois, un jour dont la météo correspond, et l'heure. Le temps continue de s'écouler.
