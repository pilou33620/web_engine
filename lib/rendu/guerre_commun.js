// Ce que partagent la marine et l'espionnage (maquettes/guerre.html) : écume des sillages, éclairs des canons,
// gerbes des boulets, langues de feu, pastilles face à la caméra, pavillons qui claquent au vent, petits calculs de cases.
import { THREE, scene, posCase, voisins, chaqueImage } from './scene.js';
import { toon, degrade, MAT, CONT, lot, fusion } from './toon.js';
import { fantassin, PALIERS } from './modeles.js';
import { carte } from './plateau.js';
import { climat } from './vie.js';

export const MER = -0.15;
export const lisse = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const franchit = (a, b, x) => a < x && b >= x; // un instant x passé entre deux images
export const capVers = (dx, dz) => Math.atan2(dx, dz); // pour un modèle qui regarde +z
export const capX = (dx, dz) => -Math.atan2(dz, dx); // pour un modèle qui regarde +x (les navires)
const _v = new THREE.Vector3();
/** Un point local d'un objet, en coordonnées du monde. */
export const versMonde = (o, x, y, z) => { o.updateMatrixWorld(true); return _v.set(x, y, z).applyMatrix4(o.matrixWorld).clone(); };

// ------------------------------------------------------------------ cases
/** La case est-elle de l'eau (profond, haut-fond, lac) ? */
export const eau = i => { const C = carte(); return !!C && i >= 0 && C.terrain[i] < 3; };
const cube = i => { const { c, r } = posCase(i), x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; };
/** Distance en cases entre deux cases. */
export function ecart(a, b) { const A = cube(a), B = cube(b); return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])); }
export { rayon } from './scene.js';  // les cases à au plus r pas de i (dans scene.js : le brouillard s'en sert sans la guerre)
/** Tracé lissé (Chaikin) d'une suite de points [x, z] : position et cap (modèle face à +x) à une distance donnée. */
export function cheminLisse(pts, iter = 2) {
  for (let it = 0; it < iter; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const long = cum[cum.length - 1];
  const en = sd => {
    if (pts.length < 2) return { x: pts[0][0], z: pts[0][1], cap: 0 };
    sd = Math.max(0, Math.min(long - 1e-4, sd)); let i = 0; while (i < cum.length - 2 && cum[i + 1] < sd) i++;
    const f = (sd - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
    return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, cap: capX(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) };
  };
  return { en, long };
}

// ------------------------------------------------------------------ écume des sillages : petites boules plates à fleur d'eau
const NEC = 240;
const ECUME = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), toon(0xf6fbff, { transparent: true, opacity: 0.85, depthWrite: false }), NEC);
ECUME.count = 0; ECUME.frustumCulled = false; scene.add(ECUME);
const ecumes = [];
export function ecume(x, z, k = 0.32, vie = 1.6) { if (ecumes.length >= NEC) ecumes.shift(); ecumes.push({ x, z, k, vie, age: 0 }); }

// ------------------------------------------------------------------ éclairs des canons et gerbes des boulets
export const tache = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.6)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const NEL = 120, pE = new Float32Array(NEL * 3), cE = new Float32Array(NEL * 3);
const geoE = new THREE.BufferGeometry();
geoE.setAttribute('position', new THREE.BufferAttribute(pE, 3)); geoE.setAttribute('color', new THREE.BufferAttribute(cE, 3)); geoE.setDrawRange(0, 0);
const ECLATS = new THREE.Points(geoE, new THREE.PointsMaterial({ map: tache, size: 0.26, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
ECLATS.frustumCulled = false; scene.add(ECLATS);
const eclats = [];
export function eclat(p, fort = 1) { if (eclats.length > NEL - 2) return; eclats.push({ x: p.x, y: p.y, z: p.z, vie: 0.18 }); if (fort > 1) eclats.push({ x: p.x, y: p.y + 0.01, z: p.z, vie: 0.12 }); }
const NGE = 160;
const GERBES = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshToonMaterial({ color: 0xf2fbff, gradientMap: degrade }), NGE);
GERBES.frustumCulled = false; GERBES.count = 0; scene.add(GERBES);
const gerbes = [];
export function gerbe(x, z, h = 1) { if (gerbes.length < NGE) gerbes.push({ x, z, age: 0, h }); }

// ------------------------------------------------------------------ feu : trois langues de flamme, animées
const M_FLAMME = new THREE.MeshBasicMaterial({ color: 0xff9a2a }), M_FLAMME2 = new THREE.MeshBasicMaterial({ color: 0xffd34d });
const LANGUES = [[0, 0, 0.5, M_FLAMME], [0.18, 0.1, 0.34, M_FLAMME2], [-0.15, -0.12, 0.38, M_FLAMME]].map(([dx, dz, h, m]) => [new THREE.ConeGeometry(0.12, h, 5).translate(0, h / 2, 0), dx, dz, m]);
const feux = new Set();
/** Un feu posé dans parent (invisible au départ) ; animé tant qu'il est visible. */
export function feu(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  for (const [geo, dx, dz, m] of LANGUES) { const c = new THREE.Mesh(geo, m); c.position.set(dx, 0, dz); g.add(c); }
  parent.add(g); g.visible = false; feux.add(g);
  return g;
}
/** Oublie un feu (son parent est jeté) ; les géométries des flammes sont partagées et restent. */
export const oublierFeu = g => feux.delete(g);

// ------------------------------------------------------------------ pastilles face à la caméra (« ! », rouleau de plans…)
export function pastille(dessin, taille = 0.13) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  dessin(g);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.setScalar(taille); s.renderOrder = 10; s.visible = false;
  return s;
}
export const rond = (g, fond) => { g.fillStyle = fond; g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = '#24180f'; g.stroke(); };

// ------------------------------------------------------------------ pavillons : géométries partagées par taille, ondulées une fois par image
const PAVS = new Map(), MATS_PAV = new Map();
function geoPav(w, h) {
  const k = w + 'x' + h;
  let p = PAVS.get(k);
  if (!p) { p = { g: new THREE.PlaneGeometry(w, h, 6, 1).translate(w / 2, 0, 0), w }; PAVS.set(k, p); }
  return p.g;
}
export function matPav(col) {
  const k = String(col);
  let m = MATS_PAV.get(k);
  if (!m) { m = toon(new THREE.Color(col), { side: THREE.DoubleSide }); MATS_PAV.set(k, m); }
  return m;
}
/** Un pavillon (plan qui flotte vers +x local) posé dans parent. */
export function drapeau(parent, col, x, y, z, w = 1.3, h = 0.85, ry = 0) {
  const m = new THREE.Mesh(geoPav(w, h), matPav(col));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  return m;
}

// ------------------------------------------------------------------ soldats à pied (modèle de l'armée, face à +z), géométries partagées
const cacheSol = new Map();
export function soldat(parent, roy, palier, genre = 'ligne', ech = 0.045) {
  const cle = `${roy}|${palier}|${genre}`;
  let r = cacheSol.get(cle);
  if (!r) { const L = lot(); fantassin(L, PALIERS[palier] || PALIERS[0], 0, 0, roy, genre); r = { g: fusion(L.g), o: fusion(L.o) }; cacheSol.set(cle, r); }
  const g = new THREE.Group(); g.add(new THREE.Mesh(r.g, MAT), new THREE.Mesh(r.o, CONT));
  g.scale.setScalar(ech); parent.add(g);
  return g;
}

// ------------------------------------------------------------------ animation commune
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
chaqueImage((dt, t) => {
  const ve = climat.vent || 0.3;
  for (const [, p] of PAVS) {
    const pos = p.g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / p.w; pos.setZ(i, Math.sin(t * (5 + ve * 6) - u * 5) * u * 0.16 * p.w); }
    pos.needsUpdate = true;
  }
  // écume
  let n = 0;
  for (let i = ecumes.length - 1; i >= 0; i--) { const e = ecumes[i]; e.age += dt; if (e.age > e.vie) ecumes.splice(i, 1); }
  for (const e of ecumes) {
    const u = e.age / e.vie, s = (0.6 + e.age * 0.7) * e.k * (u > 0.7 ? (1 - u) / 0.3 : 1);
    _m.compose(_p.set(e.x, MER + 0.004, e.z), _q, _s.set(s, s * 0.35, s)); ECUME.setMatrixAt(n++, _m);
  }
  ECUME.count = n; ECUME.instanceMatrix.needsUpdate = true;
  // éclairs
  n = 0;
  for (let i = eclats.length - 1; i >= 0; i--) { const e = eclats[i]; e.vie -= dt; if (e.vie <= 0) eclats.splice(i, 1); }
  for (const e of eclats) { const f = Math.min(1, e.vie / 0.1); pE.set([e.x, e.y, e.z], n * 3); cE.set([f, 0.82 * f, 0.38 * f], n * 3); n++; }
  geoE.setDrawRange(0, n); geoE.attributes.position.needsUpdate = geoE.attributes.color.needsUpdate = true;
  // gerbes
  n = 0;
  for (let i = gerbes.length - 1; i >= 0; i--) { const g = gerbes[i]; g.age += dt; if (g.age > 0.9) gerbes.splice(i, 1); }
  for (const g of gerbes) { const h = Math.sin(g.age / 0.9 * Math.PI) * 0.19 * g.h, r = 0.024 + g.age * 0.025; _m.compose(_p.set(g.x, MER, g.z), _q, _s.set(r, Math.max(0.001, h), r)); GERBES.setMatrixAt(n++, _m); }
  GERBES.count = n; GERBES.instanceMatrix.needsUpdate = true;
  // feux
  for (const g of feux) if (g.visible) g.children.forEach((c, i) => c.scale.set(1 + Math.sin(t * 13 + i) * 0.2, 1 + Math.sin(t * 17 + i * 2) * 0.3, 1 + Math.cos(t * 11 + i) * 0.2));
});
