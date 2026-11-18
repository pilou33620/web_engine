// Les modèles et le catalogue de web_power, assemblés avec les briques du moteur de web_royaumes (toon.js, three.js r186).
// Les deux partagent le même vocabulaire (lot, put, fige, boite, cyl…, unités de 10 par case) : on lit les fichiers de
// sources/web_power tels quels et on les évalue dans une portée où ces briques viennent de toon.js. Rien n'est modifié ni dupliqué.
import { THREE } from '../sources/web_royaumes/web/js/rendu/scene.js';
import { lot, put, fige, boite, cyl, cone, sphere } from '../sources/web_royaumes/web/js/rendu/toon.js';

const DOSSIER = new URL('../sources/web_power/js/', import.meta.url);
// outils et grille, terrain (plat…), modèles, catalogue des installations, de l'eau et des déchets, époques
const FICHIERS = ['01-outils.js', '02-terrain.js', '04-modeles.js', '05-catalogue.js', '06-eau.js', '06b-dechets.js', '07-epoques-rd.js'];
const lire = f => fetch(new URL(f, DOSSIER)).then(r => { if (!r.ok) throw new Error(`${f} : ${r.status}`); return r.text(); });

const [textes, moteur] = await Promise.all([Promise.all(FICHIERS.map(lire)), lire('03-moteur-3d.js')]);
// toit() vient de 03-moteur-3d.js, dont le reste (moteur de rendu, plateau) ne sert pas ici
const toit = moteur.match(/^function toit\([\s\S]*?^}/m);
if (!toit) throw new Error('toit() introuvable dans 03-moteur-3d.js');

const corps = [toit[0], ...textes].join('\n;\n') + '\n;return { BAT, QBAT, bFerme, rotor, semer, TYPES, ERES, QUART, R };';
export const P = new Function('THREE', 'mergeGeometries', 'lot', 'put', 'fige', 'boite', 'cyl', 'cone', 'sphere', corps)(
  THREE, null, lot, put, fige, boite, cyl, cone, sphere);

/** Échelle des modèles de web_power sur le plateau de web_royaumes (une case de 10 → 1), comme ECH_BAT. */
export const ECH = 1 / P.R;

/** Assemble un modèle de web_power : { groupe (THREE.Group à l'échelle du plateau), fumees: [[x, y, z, vapeur]], rotors: [THREE.Group] }.
 *  dessin(L, ex) : BAT[type], QBAT[quartier] ou bFerme ; graine : pour les variantes aléatoires (couleurs des maisons…). */
export function modele(dessin, graine) {
  P.semer({ q: graine, r: 7 });
  const L = lot(), ex = { fum: [], rotors: [] };
  dessin(L, ex);
  const groupe = fige(L);
  const rotors = ex.rotors.map(r => { const g = P.rotor(); g.position.set(...r); groupe.add(g); return g; });
  groupe.scale.setScalar(ECH);
  return { groupe, fumees: ex.fum, rotors };
}
