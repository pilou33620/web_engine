// L'eau qui vit, automatique : vagues qui viennent se briser sur les côtes, écume et embruns au pied des cascades ;
// et sillage(x, y, z) : une traînée d'écume derrière un bateau, que le jeu (ou chroniques.js) appelle pendant qu'il avance.
import { THREE, scene, chaqueImage, hache, cam, posCase, voisins, qualite, pres } from './scene.js';
import { carte, TERRE, piedsCascades } from './plateau.js';
import { climat, bouffee } from './vie.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const MER = -0.15;
const M_ECUME = new THREE.MeshBasicMaterial({ color: 0xf4f8fb, transparent: true, opacity: 0.55, depthWrite: false });
const inst = (geo, n) => { const m = new THREE.InstancedMesh(geo, M_ECUME, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.renderOrder = 2; scene.add(m); return m; };
const PLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), DISQUE = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);

// ------------------------------------------------------------------ vagues sur les côtes : un liseré d'écume par bord eau / terre
const NV = 500, VAGUES = inst(PLAT, NV);
let carteVue = null, bords = [];
function lieux(C) {
  carteVue = C; bords = [];
  for (let i = 0; i < C.terrain.length; i++) {
    if (TERRE(C.terrain[i])) continue;
    const a = posCase(i);
    for (const n of voisins(i)) {
      if (!TERRE(C.terrain[n])) continue;
      const b = posCase(n), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      // le milieu du bord commun, la direction vers la terre, et le cap du bord
      bords.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, ux: dx / l, uz: dz / l, cap: Math.atan2(dx, dz), ph: hache(i, n, 140) });
    }
  }
}

// ------------------------------------------------------------------ écume des cascades et des sillages
const NC = 120, CASCADES = inst(DISQUE, NC);
const NS = 300, SILLAGES = inst(DISQUE, NS), sill = [];
/** Une tache d'écume qui s'élargit puis disparaît (repère du plateau) : derrière un bateau qui avance, tous les quelques pas. */
export function sillage(x, y, z, r = 0.04) { if (sill.length >= NS) sill.shift(); sill.push({ x, y: y + 0.006, z, r, t: 0 }); }

chaqueImage((dt, t) => {
  const C = carte(); if (!C) return;
  if (C !== carteVue) lieux(C);
  const houle = 0.6 + Math.min(1.2, climat.vent || 0.3) * 0.6 + (climat.genre === 'tempete' ? 0.8 : 0);
  // vagues : chaque bord proche du regard reçoit une vague qui arrive du large, s'étale et se retire
  let nv = 0;
  if (!climat.gel || climat.gel < 0.6) for (const b of bords) {
    if (nv >= NV * Math.min(1, qualite.part + 0.2)) break;
    if (!pres(b.x, b.z)) continue;
    const u = (t * 0.25 * houle + b.ph) % 1, d = (1 - u) * 0.22, larg = 0.015 + 0.025 * Math.sin(u * Math.PI);
    VAGUES.setMatrixAt(nv++, _m.compose(_p.set(b.x - b.ux * d, MER + 0.008, b.z - b.uz * d), _q.setFromAxisAngle(_y, b.cap), _s.set(0.75 * (0.5 + 0.5 * u), 1, larg)));
  }
  VAGUES.count = nv; VAGUES.instanceMatrix.needsUpdate = true;
  // cascades : bouillonnement au pied, embruns de temps en temps
  let nc = 0;
  for (const c of piedsCascades()) {
    if (nc >= NC - 2 || !pres(c.x, c.z)) continue;
    for (let k = 0; k < 3; k++) { const u = (t * 0.9 + k / 3 + c.x) % 1; CASCADES.setMatrixAt(nc++, _m.compose(_p.set(c.x + Math.sin(k * 2.1) * 0.03, c.y, c.z + Math.cos(k * 2.1) * 0.03), _q.identity(), _s.setScalar(0.03 + 0.07 * u))); }
    if (Math.random() < dt * 1.5 * qualite.part) bouffee(c.x, c.y + 0.03, c.z, 'blanche', 0.35);
  }
  CASCADES.count = nc; CASCADES.instanceMatrix.needsUpdate = true;
  // sillages
  let ns = 0;
  for (let i = sill.length - 1; i >= 0; i--) {
    const e = sill[i]; e.t += dt;
    if (e.t > 2.5) { sill.splice(i, 1); continue; }
    const k = e.r * (0.6 + e.t * 0.9) * (1 - (e.t / 2.5) ** 2);
    SILLAGES.setMatrixAt(ns++, _m.compose(_p.set(e.x, e.y, e.z), _q.identity(), _s.set(k, 1, k)));
  }
  SILLAGES.count = ns; SILLAGES.instanceMatrix.needsUpdate = true;
});
