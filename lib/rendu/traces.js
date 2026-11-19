// Traces de bataille (web_royaumes) : là où l'on s'est battu, la terre est retournée, des cratères de boulets et des débris
// (planches, fûts, roues brisées) jonchent le sol ; ils restent quelques mois, se referment peu à peu, puis disparaissent.
// traceBataille(case, tour) au combat ; majTraces(tour) chaque mois (chroniques.js fait les deux d'après le rapport).
import { THREE, scene, posCase, hache } from './scene.js';
import { carte, solEn, TERRE } from './plateau.js';
import { toon } from './toon.js';

/** Combien de mois une bataille reste marquée sur le terrain. */
export const DUREE_TRACES = 4;
const N = 600;
function inst(geo, col, n, ombre = false) {
  const mat = toon(new THREE.Color(col), { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = ombre; scene.add(m); return m;
}
const SOL = new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2);
const TERRE_R = inst(SOL, 0x55402b, N), CRATERE = inst(SOL, 0x2b211a, N), BORD = inst(new THREE.RingGeometry(0.72, 1, 10).rotateX(-Math.PI / 2), 0x7d6443, N);
const PLANCHES = inst(new THREE.BoxGeometry(1, 0.22, 0.28), 0x6b4a2b, N, true), ROUES = inst(new THREE.TorusGeometry(1, 0.2, 4, 10).rotateX(Math.PI / 2), 0x3e2a1a, N / 4, true);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

let traces = [], tourVu = 0;
/** Une bataille sur la case c au mois tour : terre retournée, cratères, débris (rien en mer). */
export function traceBataille(c, tour = tourVu) {
  const C = carte(); if (C && !TERRE(C.terrain[c])) return;
  if (traces.some(t => t.c === c && t.tour === tour)) return;
  traces.push({ ...posCase(c), c, tour }); tourVu = Math.max(tourVu, tour); dessiner(); // (posCase rend aussi c : la colonne, d'où l'ordre)
}
/** Le mois a passé : les traces vieillissent (elles se referment) et s'effacent au bout de DUREE_TRACES mois. */
export function majTraces(tour) { tourVu = tour; traces = traces.filter(t => tour - t.tour < DUREE_TRACES); dessiner(); }
/** Les traces encore visibles (pour les tests et les vitrines). */
export const tracesVisibles = () => traces.map(t => ({ case: t.c, tour: t.tour, age: tourVu - t.tour }));

function poser(M, n, x, z, y, s, ry = 0, sy = s, sz = s, inc = 0) { M.setMatrixAt(n, _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(inc, ry, 0)), _s.set(s, sy, sz))); }
function dessiner() {
  const n = { t: 0, c: 0, p: 0, r: 0 };
  for (const t of traces) {
    const k = 1 - Math.max(0, tourVu - t.tour) / DUREE_TRACES; // 1 le mois du combat, puis ça se referme
    let g = Math.floor(hache(t.c, t.tour, 77) * 1e5) + 1;
    const rnd = () => (g = (g * 16807) % 2147483647) / 2147483647;
    const pt = r => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; return [t.x + Math.cos(a) * d, t.z + Math.sin(a) * d]; };
    // terre retournée : de grandes plaques sombres, piétinées
    for (let i = 0; i < 6 && n.t < N; i++) { const [x, z] = pt(0.32), s = (0.06 + rnd() * 0.07) * (0.5 + 0.5 * k); poser(TERRE_R, n.t++, x, z, solEn(x, z) + 0.004, s, rnd() * 3, 1, s * (0.5 + rnd() * 0.6)); }
    // cratères de boulets, avec leur bourrelet de terre
    for (let i = 0; i < Math.round(6 * k) && n.c < N; i++) {
      const [x, z] = pt(0.34), r = 0.02 + rnd() * 0.025, y = solEn(x, z);
      poser(CRATERE, n.c, x, z, y + 0.006, r); poser(BORD, n.c++, x, z, y + 0.008, r * 1.45);
    }
    // débris : planches et fûts brisés, une roue de canon
    for (let i = 0; i < Math.round(7 * k) && n.p < N; i++) { const [x, z] = pt(0.3), s = 0.025 + rnd() * 0.02; poser(PLANCHES, n.p++, x, z, solEn(x, z) + 0.006, s, rnd() * 6, s, s, (rnd() - 0.5) * 0.4); }
    if (k > 0.5 && n.r < N / 4) { const [x, z] = pt(0.25); poser(ROUES, n.r++, x, z, solEn(x, z) + 0.005, 0.022, rnd() * 6, 0.022, 0.022, 0.15); }
  }
  for (const [M, c] of [[TERRE_R, n.t], [CRATERE, n.c], [BORD, n.c], [PLANCHES, n.p], [ROUES, n.r]]) { M.count = c; M.instanceMatrix.needsUpdate = true; }
}
