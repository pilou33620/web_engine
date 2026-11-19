// Le moteur unique de web_engine (graphismes/rendu) : il tient le canevas #carte, la caméra et ses gestes, la boucle d'images,
// le plateau (terrain, nature, rivières, mer, saisons, neige), la météo, l'heure du jour et la brume des terres inexplorées.
// Le jeu, en scripts classiques (defer) qui partagent leurs déclarations, s'exécute après ce module, dans l'ordre des balises.
// Il garde ses unités (une case de 10, carte centrée sur l'origine) : il dessine dans MONDE, un groupe ramené à l'échelle
// du moteur (une case de 1, la case (0, 0) à l'origine).
import * as M from '../graphismes/rendu/scene.js';
import * as plateau from '../graphismes/rendu/plateau.js';
import * as toon from '../graphismes/rendu/toon.js';
import * as modernes from '../graphismes/rendu/modernes.js';
import { appliquerMeteo, forcerHeure } from '../graphismes/rendu/meteo.js';
import { climat, bouffee } from '../graphismes/rendu/vie.js';
import { majBrouillard, sansBrouillard } from '../graphismes/rendu/brouillard.js';
import * as boue from '../graphismes/rendu/boue.js';
import { mergeGeometries } from '../graphismes/three/addons/utils/BufferGeometryUtils.js';

const MONDE = new M.THREE.Group();
MONDE.scale.setScalar(0.1);
M.scene.add(MONDE);

window.THREE = M.THREE;
window.mergeGeometries = mergeGeometries;
window.MOTEUR = { ...M, MONDE, plateau, toon, modernes, appliquerMeteo, forcerHeure, climat, bouffee, majBrouillard, sansBrouillard, boue };
