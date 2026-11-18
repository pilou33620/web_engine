Sources de la maquette `maquettes/quartiers.html` (vie des quartiers : météo, saisons, jour et nuit sur les logements ; rues peuplées, halle du marché et petite école).

- `quartiers.js` : le bourg (plateau, rues), les relevés des bâtiments (fenêtres, portes, toits, cheminées), le décor de saison et de météo, les fenêtres allumées, les volets, les fumées, l'eau, le ciel de nuit, les personnages et le panneau « En ce moment ».
  Partie « rues, marché et école » : tenues d'époque (HOMME, DAME, ECOLIER, SOLDAT, MAITRE, CRIEUR), bêtes et attelages (CHIEN, POULE, CHEVAL, CAVALIER, VOITURE, OMNIBUS), graphe des rues (GRAPHE) et promeneurs (promeneur, pasPromeneur, saluts), foule() selon le temps, décor de la halle par époque (decorMarche) et de l'école (decorEcole), horaire de l'école (ECOLE), jour de marché (JOUR_MARCHE), et construireRues qui pose tous ces personnages.
- `page.html` : la page (textes, boutons) ; le script y est inséré à la place de `/*SCRIPT*/`.
- `gen.py` : assemble la page autonome avec `web/js/rendu/toon.js` et `web/js/rendu/modeles.js` du jeu. modeles.js est repris tel quel, avec quelques relevés `EXC?.…` ajoutés à la volée (fenêtres, portes, toits) ; hors maquette ils ne font rien.
  Usage depuis ce dossier : `python3 gen.py ../../quartiers.html` (ajouter `<!doctype html>` n'est pas nécessaire : page.html le contient).
- `capture.cjs` : captures avec Playwright (`window.MAQ.regler({...})`, `MAQ.avancer(s)`), en réécrivant three vers une copie locale ; chemins du scratchpad à adapter. Réglages utiles : `marche: true` (jour de marché forcé) ; `MAQ.etat()` donne `persos` (personnages dessinés), `nouveaux`, `ecole`, `foule`.
- `ou.cjs` : donne la position d'un personnage (`MAQ.ou(nom)`) pour viser un gros plan.
