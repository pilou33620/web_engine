# Journal des versions de la bibliothèque graphique

Numérotation : on change le premier chiffre quand un jeu doit adapter son code (fonction renommée, format d'état modifié),
le deuxième pour un ajout (nouveau modèle, nouvelle animation), le troisième pour une correction.

## 1.0.0 — 2026-11-18

Première version, reprise des deux jeux :
- `royaumes/` : moteur et rendu de web_royaumes (`web/js/rendu` de c33f182), avec `rendu.css` ;
- `power/` : outils, moteur 3D, modèles, ambiance et ciel de web_power (14109fc), et `pont.js` ;
- `three/` : three.js r186 et `addons/utils/BufferGeometryUtils.js` (npm three@0.186.1). web_power passe de three 0.170 (CDN) à cette copie locale.
