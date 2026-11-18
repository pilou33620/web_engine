Sources de la maquette `maquettes/rendu-power.html` (référence pour l'intégration dans le jeu).

- `scene.js` : plateau d'hexagones étagés, décor, rivières, routes, voie ferrée, bâtiments posés, ambiance (charrettes, faune, bateaux, oiseaux, travaux des champs), jour/aube/nuit.
- `batiments.js` : les bâtiments dans le vocabulaire de web_power (unités de cases de 10, réduites par 0,1) et les armées par palier technologique.
- `vie2.js` : vie de la ville, métiers, ordres à l'armée et bivouac, nature des saisons, météo animée.

La page assemble ces trois fichiers dans cet ordre : scene.js, batiments.js inséré avant la section « bâtiments, armée et pièces animées », vie2.js inséré avant la section « caméra ».
