// Les routes sous la pluie : la terre devient boue, le pavé fonce comme mouillé, des flaques grandissent puis sèchent.
// L'humidité suit le temps (climat, posé par meteo.js) : elle monte sous la pluie, redescend quand il ne pleut plus,
// et retombe à zéro sous la neige au sol. Commun aux jeux : routes.js s'en sert, un jeu qui trace ses routes lui-même aussi
// (dessiner les chemins de terre avec MAT_TERRE, les routes pavées ou goudronnées avec MAT_PAVE, puis flaques()).
import { THREE, chaqueImage, hache } from './scene.js';
import { MAT, toon } from './toon.js';
import { climat } from './vie.js';

/** L'humidité des routes, de 0 (sèches) à 1 (détrempées). */
export const humidite = { v: 0 };
/** Teinte de fond des routes (blanc : aucune) : un jeu qui assombrit sa carte (vues de web_power) la recopie ici. */
export const TEINTE_ROUTES = new THREE.Color(1, 1, 1);
/** Matériaux des routes (couleurs par sommet, comme MAT) : chemins de terre, routes pavées ou goudronnées. */
export const MAT_TERRE = MAT.clone(), MAT_PAVE = MAT.clone();

const BOUE = new THREE.Color(0x8c6a52), MOUILLE = new THREE.Color(0xa8a8b4), BLANC = new THREE.Color(1, 1, 1);
const DISQUE = new THREE.CylinderGeometry(1, 1, 0.002, 12), MAT_FLAQUE = toon(0x7f9db3);
const ROND = new THREE.RingGeometry(0.78, 1, 16).rotateX(-Math.PI / 2), MAT_ROND = new THREE.MeshBasicMaterial({ color: 0xdfeefa, transparent: true, opacity: 0.7, depthWrite: false });
const FLAQUES = [];  // { mesh, pts: [[x, y, z, r]] } ; sortent de la liste quand on les retire de la scène
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Pose des flaques aux points donnés ([x, y, z] dans le repère de parent) ; r : rayon d'une grande flaque à pleine humidité
 *  (0,045 à l'échelle du plateau, 0,45 dans le repère de web_power). Six points sur dix environ, choisie au hasard fixe du point. */
export function flaques(parent, points, r = 0.045) {
  const pts = points.filter(([x, , z]) => hache(x * 37 | 0, z * 41 | 0, 11) < 0.6)
    .map(([x, y, z]) => [x, y + r * 0.05, z, r * (0.5 + hache(x * 13 | 0, z * 17 | 0, 12) * 0.6), hache(x * 7 | 0, z * 5 | 0, 13) * 0.5]);  // seuil : humidité où elle apparaît
  if (!pts.length) return null;
  const mesh = new THREE.InstancedMesh(DISQUE, MAT_FLAQUE, pts.length);
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.count = 0; mesh.frustumCulled = false;
  // les ronds de la pluie qui s'élargissent à la surface
  const ronds = new THREE.InstancedMesh(ROND, MAT_ROND, pts.length);
  ronds.count = 0; ronds.frustumCulled = false; ronds.castShadow = ronds.receiveShadow = false;
  parent.add(mesh, ronds); FLAQUES.push({ mesh, ronds, pts });
  return mesh;
}

chaqueImage((dt, t) => {
  const pluie = climat.pluie && !climat.neige;
  humidite.v = climat.neigeSol ? 0 : Math.max(0, Math.min(1, humidite.v + (pluie ? dt * 0.12 : -dt * 0.035)));
  const h = humidite.v;
  MAT_TERRE.color.copy(BLANC).lerp(BOUE, h * 0.75).multiply(TEINTE_ROUTES);
  MAT_PAVE.color.copy(BLANC).lerp(MOUILLE, h * 0.6).multiply(TEINTE_ROUTES);
  for (let i = FLAQUES.length - 1; i >= 0; i--) {
    const { mesh, ronds, pts } = FLAQUES[i];
    if (!mesh.parent) { FLAQUES.splice(i, 1); continue; }
    if (h < 0.02) { mesh.count = ronds.count = 0; continue; }
    // chaque flaque apparaît à son seuil d'humidité et sèche dans l'ordre inverse
    let n = 0, nr = 0;
    for (const [x, y, z, r, seuil] of pts) {
      if (h <= seuil) continue;
      const k = r * (h - seuil) / (1 - seuil);
      mesh.setMatrixAt(n++, _m.compose(_p.set(x, y, z), _q.identity(), _s.set(k, 1, k * 0.75)));
      if (pluie) { const u = (t * 1.4 + seuil * 7) % 1, e = k * 0.7 * u; ronds.setMatrixAt(nr++, _m.compose(_p.set(x, y + r * 0.02, z), _q, _s.set(e, 1, e * 0.75))); }
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
    ronds.count = nr; ronds.instanceMatrix.needsUpdate = true;
  }
});
