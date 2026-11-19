// Les routes sous la pluie : la terre devient boue, le pavé fonce comme mouillé, des flaques grandissent puis sèchent.
// L'humidité suit le temps (climat, posé par meteo.js) : elle monte sous la pluie, redescend quand il ne pleut plus,
// et retombe à zéro sous la neige au sol. Commun aux jeux : routes.js s'en sert, un jeu qui trace ses routes lui-même aussi
// (dessiner les chemins de terre avec MAT_TERRE, les routes pavées ou goudronnées avec MAT_PAVE, puis flaques()).
// Aussi : la crue des rivières après une forte pluie (eau trouble qui recouvre les berges), l'eau sale (climat.eauSale,
// posé par le jeu), l'arc-en-ciel juste après l'averse (climat.apresPluie), et les traces de boue des armées (trace()).
import { THREE, scene, chaqueImage, hache } from './scene.js';
import { MAT, toon } from './toon.js';
import { climat } from './vie.js';
import { MAT_SOL, MAT_BERGE, teinterRivieres } from './plateau.js';

/** L'humidité des routes, de 0 (sèches) à 1 (détrempées). */
export const humidite = { v: 0 };
/** La crue des rivières, de 0 à 1 : monte lentement sous une forte pluie (climat.pluieForte), redescend plus lentement encore. */
export const crue = { v: 0 };
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

// ------------------------------------------------------------------ traces de boue : des empreintes qui s'effacent peu à peu
const NT = 400, VIE_T = 25, MAT_TRACE = toon(0x5a4330), TRACES = new THREE.InstancedMesh(DISQUE, MAT_TRACE, NT), tr = [];
TRACES.count = 0; TRACES.frustumCulled = false; TRACES.castShadow = false; TRACES.receiveShadow = true; scene.add(TRACES);
/** Une trace de boue au sol (repère du plateau), allongée dans la direction ry ; r : sa demi-longueur. Les plus vieilles disparaissent. */
export function trace(x, y, z, ry = 0, r = 0.05) { if (tr.length >= NT) tr.shift(); tr.push({ x, y: y + 0.004, z, ry, r, t: 0 }); }

const BERGE_CRUE = new THREE.Color(0.62, 0.66, 0.72);
let crueVue = -1, saleVue = -1;
chaqueImage((dt, t) => {
  const pluie = climat.pluie && !climat.neige;
  humidite.v = climat.neigeSol ? 0 : Math.max(0, Math.min(1, humidite.v + (pluie ? dt * 0.12 : -dt * 0.035)));
  const h = humidite.v;
  climat.apresPluie = !pluie && !climat.neige && h > 0.3;
  // crue : l'eau se trouble et recouvre les berges
  crue.v = Math.max(0, Math.min(1, crue.v + (pluie && climat.pluieForte ? dt * 0.04 : -dt * 0.008)));
  MAT_BERGE.color.copy(MAT_SOL.color).lerp(BERGE_CRUE, crue.v * 0.75);
  const sale = climat.eauSale || 0;
  if (Math.abs(crue.v - crueVue) > 0.01 || Math.abs(sale - saleVue) > 0.01) { crueVue = crue.v; saleVue = sale; teinterRivieres(crue.v, sale); }
  // traces de boue
  let nt = 0;
  for (let i = tr.length - 1; i >= 0; i--) {
    const e = tr[i]; e.t += dt;
    if (e.t > VIE_T) { tr.splice(i, 1); continue; }
    const k = e.r * (1 - (e.t / VIE_T) ** 2);
    _q.setFromAxisAngle(_p.set(0, 1, 0), e.ry);
    TRACES.setMatrixAt(nt++, _m.compose(_p.set(e.x, e.y, e.z), _q, _s.set(k * 0.45, 1, k)));
  }
  TRACES.count = nt; TRACES.instanceMatrix.needsUpdate = true;
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
