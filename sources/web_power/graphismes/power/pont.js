// Le pont : les modèles de web_power (04-modeles.js) assemblés avec les briques du moteur royaumes (toon.js, three.js r186).
// Les deux partagent le même vocabulaire (lot, put, fige, boite, cyl…, unités de 10 par case) : on lit les scripts de web_power
// tels quels et on les évalue dans une portée où ces briques viennent de toon.js. Un jeu en modules ES peut ainsi poser
// les bâtiments de web_power dans la scène du moteur royaumes.
//
//   import { chargerPower, modele } from '…/graphismes/power/pont.js';
//   const P = await chargerPower();                       // BAT, QBAT, bFerme, rotor, semer, R
//   const P = await chargerPower([url02, url05, …]);      // + le catalogue d'un jeu (TYPES, ERES, QUART), lu dans ses fichiers
//   const { groupe, fumees, rotors } = modele(P.BAT.nucleaire, 1);
import { THREE } from '../royaumes/scene.js';
import { lot, put, fige, boite, cyl, cone, sphere } from '../royaumes/toon.js';

const lire = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u} : ${r.status}`); return r.text(); });
let P = null;

/** Évalue les modèles de web_power (et, si donnés, les scripts de catalogue d'un jeu, dans leur ordre de chargement). */
export async function chargerPower(catalogue = []) {
  const ici = f => new URL(f, import.meta.url);
  const [outils, moteur, modeles, ...cat] = await Promise.all([lire(ici('01-outils.js')), lire(ici('03-moteur-3d.js')), lire(ici('04-modeles.js')), ...catalogue.map(lire)]);
  // toit() vient de 03-moteur-3d.js, dont le reste (moteur de rendu, plateau du jeu) ne sert pas ici
  const toit = moteur.match(/^function toit\([\s\S]*?^}/m);
  if (!toit) throw new Error('toit() introuvable dans 03-moteur-3d.js');
  const sortie = ['BAT', 'QBAT', 'bFerme', 'rotor', 'semer', 'R', 'TYPES', 'ERES', 'QUART'].map(n => `${n}: typeof ${n} === 'undefined' ? null : ${n}`).join(', ');
  const corps = [toit[0], outils, modeles, ...cat].join('\n;\n') + `\n;return { ${sortie} };`;
  P = new Function('THREE', 'mergeGeometries', 'lot', 'put', 'fige', 'boite', 'cyl', 'cone', 'sphere', corps)(THREE, null, lot, put, fige, boite, cyl, cone, sphere);
  return P;
}

/** Assemble un modèle de web_power : { groupe (THREE.Group à l'échelle du plateau royaumes : une case de 10 → 1),
 *  fumees: [[x, y, z, vapeur]] (coordonnées locales), rotors: [THREE.Group] }. dessin(L, ex) : P.BAT[type], P.QBAT[quartier]…
 *  graine : pour les variantes aléatoires (couleurs des maisons…). */
export function modele(dessin, graine) {
  if (!P) throw new Error('chargerPower() d’abord');
  P.semer({ q: graine, r: 7 });
  const L = lot(), ex = { fum: [], rotors: [] };
  dessin(L, ex);
  const groupe = fige(L);
  const rotors = ex.rotors.map(r => { const g = P.rotor(); g.position.set(...r); groupe.add(g); return g; });
  groupe.scale.setScalar(1 / P.R);
  return { groupe, fumees: ex.fum, rotors };
}
