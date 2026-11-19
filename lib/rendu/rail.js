// Voies ferrées et trains, pour un jeu qui trace ses lignes lui-même (web_power) : poserVoie(parent, pts, options) dessine
// les traverses et les rails le long du tracé, les poteaux et le fil de la caténaire si la ligne est électrique, et un train
// qui fait la navette d'un bout à l'autre (locomotive à vapeur qui fume, ou rame électrique). Retirer le groupe arrête le train.
import { THREE, chaqueImage } from './scene.js';
import { lot, put, fige, boite, cyl } from './toon.js';
import { bouffee } from './vie.js';

const TRAINS = [];  // { groupe, rame, pts, long, s, v, vapeur, fum }
const _v = new THREE.Vector3();

/** pts : [[x, y, z], …] dans le repère de parent ; ech : unités du parent pour une case de 1 (web_power : 10) ;
 *  electrique : caténaire et rame électrique, sinon locomotive à vapeur ; wagons : nombre de voitures. Renvoie le groupe. */
export function poserVoie(parent, pts, { ech = 1, electrique = false, wagons = 3 } = {}) {
  const L = lot(), k = ech, long = [0];
  for (let i = 1; i < pts.length; i++) long.push(long[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const tot = long.at(-1); if (tot < 0.5 * k) return null;
  const point = d => { let i = 1; while (i < pts.length - 1 && long[i] < d) i++; const A = pts[i - 1], B = pts[i], u = (d - long[i - 1]) / ((long[i] - long[i - 1]) || 1); return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u, Math.atan2(B[0] - A[0], B[2] - A[2])]; };
  // traverses, ballast et rails (en tronçons courts : la voie suit les courbes)
  for (let d = 0; d < tot; d += 0.05 * k) {
    const [x, y, z, cap] = point(d);
    put(L, boite(0.16 * k, 0.012 * k, 0.03 * k), 0x6b4a2b, x, y + 0.006 * k, z, cap + Math.PI / 2, 0);
    for (const c of [-1, 1]) put(L, boite(0.012 * k, 0.012 * k, 0.055 * k), 0x8d939c, x + Math.cos(cap) * c * 0.05 * k, y + 0.016 * k, z - Math.sin(cap) * c * 0.05 * k, cap, 0);
  }
  if (electrique) for (let d = 0; d < tot; d += 0.35 * k) {  // poteaux de caténaire et fil
    const [x, y, z, cap] = point(d), px = x + Math.cos(cap) * 0.11 * k, pz = z - Math.sin(cap) * 0.11 * k;
    put(L, boite(0.012 * k, 0.16 * k, 0.012 * k), 0x6b6f75, px, y + 0.08 * k, pz, cap, 0);
    put(L, boite(0.11 * k, 0.008 * k, 0.008 * k), 0x6b6f75, (px + x) / 2, y + 0.155 * k, (pz + z) / 2, cap + Math.PI / 2, 0);
    put(L, boite(0.004 * k, 0.004 * k, 0.35 * k), 0x3a3a3a, x, y + 0.15 * k, z, cap, 0);
  }
  const groupe = fige(L, parent);
  // le train : locomotive (vapeur ou électrique) et ses voitures, posés le long du tracé à chaque image
  const voiture = (col, loco) => { const V = lot(); put(V, boite(0.07 * k, 0.07 * k, 0.16 * k), col, 0, 0.055 * k, 0, 0, 0.004 * k); put(V, boite(0.072 * k, 0.012 * k, 0.15 * k), 0x3a3a3a, 0, 0.095 * k, 0, 0, 0);
    if (loco && !electrique) { put(V, cyl(0.012 * k, 0.012 * k, 0.04 * k, 6), 0x2b2b2b, 0, 0.11 * k, 0.05 * k, 0, 0); put(V, boite(0.07 * k, 0.04 * k, 0.05 * k), 0x2b2b2b, 0, 0.1 * k, -0.05 * k, 0, 0); }
    if (loco && electrique) put(V, boite(0.04 * k, 0.03 * k, 0.004 * k), 0x3a3a3a, 0, 0.115 * k, 0, 0, 0);
    return fige(V, groupe); };
  const rame = [voiture(electrique ? 0xd9573b : 0x2f3a2f, true), ...Array.from({ length: wagons }, (_, i) => voiture(electrique ? 0xe9e3d3 : [0x6b4a2b, 0x5c7184, 0x7a3a2a][i % 3], false))];
  TRAINS.push({ groupe, rame, point, tot, s: 0, v: 0.35 * k, k, vapeur: !electrique, fum: 0 });
  return groupe;
}

chaqueImage(dt => {
  for (let i = TRAINS.length - 1; i >= 0; i--) {
    const T = TRAINS[i];
    if (!T.groupe.parent) { TRAINS.splice(i, 1); continue; }
    T.s = (T.s + dt * T.v / T.tot) % 2;
    const aller = T.s < 1, u = aller ? T.s : 2 - T.s, ecart = 0.18 * T.k;
    T.rame.forEach((o, n) => {
      const d = Math.max(0, Math.min(T.tot, u * T.tot + (aller ? -1 : 1) * n * ecart)), [x, y, z, cap] = T.point(d);
      o.position.set(x, y, z); o.rotation.y = cap + (aller ? 0 : Math.PI);
    });
    // la locomotive à vapeur fume ; la rame électrique fait de temps en temps une étincelle au pantographe
    if ((T.fum -= dt) <= 0) {
      T.fum = T.vapeur ? 0.35 : 2 + Math.random() * 4;
      T.rame[0].localToWorld(_v.set(0, (T.vapeur ? 0.14 : 0.12) * T.k, T.vapeur ? 0.05 * T.k : 0));
      bouffee(_v.x, _v.y, _v.z, T.vapeur ? 'noire' : 'blanche', T.vapeur ? 0.7 : 0.15);
    }
  }
});
