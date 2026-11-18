# Journal des versions de la bibliothèque graphique

Numérotation : on change le premier chiffre quand un jeu doit adapter son code (fonction renommée, format d'état modifié),
le deuxième pour un ajout (nouveau modèle, nouvelle animation), le troisième pour une correction.

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
