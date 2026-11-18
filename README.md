# web_engine — galerie des rendus

Rassemble les rendus 3D des bâtiments des deux jeux, séparés par source, pour préparer leur fusion.

| Dossier | Source | Époques | Rôle prévu |
|---|---|---|---|
| `web_royaumes/` | web_royaumes @ `c33f182` (main) | 1700 Ancien Régime · 1750 Lumières · 1789 Empire · 1816 Révolution industrielle | rendus des **époques passées** |
| `web_power/` | web_power @ `14109fc` | 1900 → 2035 (10 ères) | rendus des **époques modernes** |

Les fichiers de rendu sont copiés **sans modification** (`web_royaumes/js/rendu`, `web_royaumes/vendor/three`, `web_power/js`).
Seules les visionneuses (`visionneuse.html`, `web_power/visionneuse.js`, `visionneuse.css`) et `index.html` sont nouvelles.

## Voir la galerie

```sh
cd web_engine && python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Un serveur est nécessaire (modules JS et `fetch`). web_power charge three.js 0.170 depuis cdn.jsdelivr.net, comme le jeu.

- Onglet par source ; dans chaque visionneuse : époque, saison, neige au sol, et un bâtiment ou tous.
- **web_royaumes** : rendu toon façon web_power (dalle hexagonale, contours bruns). Le style des bâtiments change avec l'époque ; la saison change les champs, vignes, arbres, jardins et la hauteur du soleil ; la case « Incendié » montre la version en ruine.
- **web_power** : l'époque filtre les installations disponibles cette année-là (années `an` / `fin` du catalogue) ; la saison teinte le sol comme dans le jeu (les bâtiments eux-mêmes ne changent pas).
