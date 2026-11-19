// Petites touches du temps qui passe, toutes automatiques (elles suivent climat, posé par meteo.js) :
// brume du matin sur l'eau (rivières, lacs, rivages) à l'aube ; feuilles qui tombent près des forêts en automne ;
// givre sur les toits quand il gèle sans neige au sol (d'après les toits relevés par modeles.js ; monde.js donne ses bâtiments par toitsDe()).
import { THREE, scene, chaqueImage, hache, cam, posCase, voisins, qualite } from './scene.js';
import { carte, hauteur, solEn, TERRE, casesBaties } from './plateau.js';
import { cyl } from './toon.js';
import { climat } from './vie.js';

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; scene.add(m); return m; };
let carteVue = null, nappes = [], forets = [];

// les lieux : nappes de brume sur l'eau, cases boisées pour les feuilles (refaits quand la carte change)
function lieux(C) {
  carteVue = C; nappes = []; forets = [];
  for (let i = 0; i < C.terrain.length; i++) {
    const { x, z, c, r } = posCase(i), terre = TERRE(C.terrain[i]);
    if (terre && (C.foret?.[i] || C.arbres?.[i] > 0)) forets.push(i);
    // sur une rivière, ou sur l'eau au bord de la terre (lacs, rivages)
    const bord = !terre && voisins(i).some(n => TERRE(C.terrain[n]));
    if (!(terre && C.riviere?.[i]) && !bord) continue;
    for (let k = 0; k < 2; k++) {
      const y = terre ? hauteur(i) + 0.06 : solEn(x, z) + 0.05;
      nappes.push({ x: x + (hache(c, r, 30 + k) - 0.5) * 0.7, y, z: z + (hache(c, r, 32 + k) - 0.5) * 0.7, s: 0.3 + hache(c, r, 34 + k) * 0.25, ph: hache(c, r, 36 + k) * 6 });
    }
  }
  if (nappes.length > NB) nappes = nappes.filter((_, k) => k % Math.ceil(nappes.length / NB) === 0);
}

// ------------------------------------------------------------------ brume du matin
const NB = 400, M_BRUME = new THREE.MeshBasicMaterial({ color: 0xf2f5f8, transparent: true, opacity: 0, depthWrite: false });
const BRUME = inst(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), M_BRUME, NB);
BRUME.renderOrder = 2;
let brume = 0;

// ------------------------------------------------------------------ feuilles d'automne
const NF = 260, M_FEUILLE = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const FEUILLES = inst(new THREE.PlaneGeometry(0.06, 0.04), M_FEUILLE, NF), feuilles = [];
const ROUSSES = [0xd9822b, 0xc9a13a, 0xb5562a, 0xe0b040, 0xa8431f];
function chute(f) {  // une feuille repart du haut d'un arbre d'une case boisée proche du regard
  const R = Math.max(4, cam.d * 0.45);
  for (let essai = 0; essai < 8; essai++) {
    const i = forets[Math.random() * forets.length | 0], q = posCase(i);
    if (Math.hypot(q.x - cam.x, q.z - cam.z) > R) continue;
    Object.assign(f, { x: q.x + (Math.random() - 0.5) * 0.8, z: q.z + (Math.random() - 0.5) * 0.8, y: hauteur(i) + 0.25 + Math.random() * 0.3, sol: hauteur(i) + 0.01, v: 0.05 + Math.random() * 0.05, ph: Math.random() * 6, vivante: true });
    return;
  }
  f.vivante = false;
}
for (let k = 0; k < NF; k++) { feuilles.push({ vivante: false, c: ROUSSES[k % ROUSSES.length] }); FEUILLES.setColorAt(k, _c.setHex(ROUSSES[k % ROUSSES.length])); }

// ------------------------------------------------------------------ herbes hautes des prés proches du regard, qui ondulent au vent
const NH = 420, M_HERBE = new THREE.MeshToonMaterial({ color: 0xa8d060 });
const HERBES = inst(new THREE.ConeGeometry(0.012, 0.095, 3).translate(0, 0.0475, 0), M_HERBE, NH), herbes = [];
let herbesX = 1e9, herbesZ = 1e9;
function semerHerbes(C) {  // autour du regard, sur les prés et plaines sans bâti ni forêt (case de terrain 4)
  herbes.length = 0; herbesX = cam.x; herbesZ = cam.z;
  const B = casesBaties() || new Set(), R = 6;
  for (let k = 0; k < NH * 4 && herbes.length < NH; k++) {
    const x = cam.x + (hache(k, 1, 130) - 0.5) * 2 * R, z = cam.z + (hache(k, 2, 131) - 0.5) * 2 * R;
    let i = -1, best = 1e9; for (const n of autour) { const q = posCase(n), d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < best) { best = d; i = n; } }
    if (i < 0 || C.terrain[i] !== 4 || C.foret?.[i] || B.has(i)) continue;
    herbes.push({ x, z, y: hauteur(i), ph: hache(k, 3, 132) * 6, s: 0.7 + hache(k, 4, 133) * 0.7 });
  }
}
let autour = [];  // la case du regard et ses voisines sur 4 rangs : on y cherche la case de chaque brin

// ------------------------------------------------------------------ givre sur les toits
const PRISME = cyl(1, 1, 1, 3).rotateX(Math.PI / 2).rotateZ(Math.PI).scale(1 / Math.sqrt(3), 1 / 1.5, 1).translate(0, 1 / 6, 0);
const M_GIVRE = new THREE.MeshToonMaterial({ color: 0xeef5ff, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
let GIVRE = null, givreT = 0;
var batisPoses;  // var : monde.js peut s'inscrire avant que ce module ait fini de se charger (imports circulaires)
/** f() : les bâtiments posés (itérable de [id, { mesh, rel }]) dont les toits givrent ; monde.js s'inscrit lui-même. */
export function toitsDe(f) { batisPoses = f; }
function poserGivre() {
  const toits = [];
  for (const [, b] of batisPoses?.() || []) if (b.mesh?.parent && b.rel?.toits?.length) { b.mesh.updateMatrixWorld(); for (const t of b.rel.toits) toits.push([b.mesh.matrixWorld, t]); }
  if (!GIVRE || GIVRE.instanceMatrix.count < toits.length) { if (GIVRE) { scene.remove(GIVRE); GIVRE.dispose(); } GIVRE = inst(PRISME, M_GIVRE, Math.max(64, Math.ceil(toits.length * 1.3))); }
  toits.forEach(([M, t], k) => {
    _l.compose(_p.set(t.x, t.y + t.h / 6, t.z), _q.setFromEuler(_e.set(0, t.ry || 0, 0)), _s.set(t.w * 1.03, t.h * 1.06, t.d * 1.03));
    GIVRE.setMatrixAt(k, _m.multiplyMatrices(M, _l));
  });
  GIVRE.count = toits.length; GIVRE.instanceMatrix.needsUpdate = true;
}

chaqueImage((dt, t) => {
  const C = carte(); if (!C) return;
  if (C !== carteVue) lieux(C);
  // brume : elle se lève à l'aube, se dissipe dans la matinée ; elle dérive avec le vent
  const cible = climat.phase === 'aube' && !climat.neige ? 0.9 : 0;
  brume += (cible - brume) * Math.min(1, dt * 0.6);
  BRUME.visible = brume > 0.02;
  if (BRUME.visible) {
    M_BRUME.opacity = 0.32 * brume;
    const dx = Math.cos(climat.dir || 0) * 0.05, dz = Math.sin(climat.dir || 0) * 0.05;
    nappes.forEach((n, k) => {
      const d = Math.sin(t * 0.15 + n.ph), s = n.s * (0.85 + 0.15 * Math.sin(t * 0.4 + n.ph));
      BRUME.setMatrixAt(k, _m.compose(_p.set(n.x + d * dx * 3, n.y + 0.02 * Math.sin(t * 0.3 + n.ph), n.z + d * dz * 3), _q.identity(), _s.set(s, 1, s * 0.7)));
    });
    BRUME.count = nappes.length; BRUME.instanceMatrix.needsUpdate = true;
  }
  // feuilles : seulement en automne, près des forêts que l'on regarde
  const automne = climat.saison === 3 && !climat.neige && forets.length;
  FEUILLES.visible = !!automne;
  if (automne) {
    let n = 0; const vent = Math.min(1.4, climat.vent || 0.3);
    const nmax = NF * Math.min(1, qualite.part);
    feuilles.forEach((f, k) => {
      if (k >= nmax) return;
      if (!f.vivante || f.y <= f.sol) { if (Math.random() < dt * 3) chute(f); else f.vivante = false; }
      if (!f.vivante) return;
      f.y -= f.v * dt; f.x += (Math.sin(t * 2 + f.ph) * 0.06 + Math.cos(climat.dir || 0) * vent * 0.05) * dt; f.z += Math.sin(climat.dir || 0) * vent * 0.05 * dt;
      _q.setFromEuler(_e.set(Math.sin(t * 3 + f.ph) * 1.2, t + f.ph, Math.cos(t * 2.5 + f.ph)));
      FEUILLES.setMatrixAt(n, _m.compose(_p.set(f.x, Math.max(f.y, f.sol), f.z), _q, _s.set(1, 1, 1)));
      FEUILLES.setColorAt(n++, _c.setHex(f.c));
    });
    FEUILLES.count = n; FEUILLES.instanceMatrix.needsUpdate = true; if (FEUILLES.instanceColor) FEUILLES.instanceColor.needsUpdate = true;
  }
  // herbes : refaites quand le regard s'éloigne ; couchées par le vent, absentes sous la neige
  if (Math.hypot(cam.x - herbesX, cam.z - herbesZ) > 2.5) {
    let i = -1, best = 1e9; for (let n = 0; n < C.terrain.length; n++) { const q = posCase(n), d = (q.x - cam.x) ** 2 + (q.z - cam.z) ** 2; if (d < best) { best = d; i = n; } }
    autour = [i]; for (let r = 0; r < 4; r++) for (const n of [...autour]) for (const v of voisins(n)) if (!autour.includes(v)) autour.push(v);
    semerHerbes(C);
  }
  const herbe = climat.saison !== 0 && !climat.neigeSol && cam.d < 22;
  HERBES.visible = herbe;
  if (herbe) {
    const v = Math.min(1.4, climat.vent || 0.3), dx = Math.cos(climat.dir || 0), dz = Math.sin(climat.dir || 0);
    M_HERBE.color.setHex(climat.sec ? 0xc8b860 : climat.saison === 3 ? 0xb0a850 : 0xa8d060);  // plus clair que le pré, pour se voir
    const n = Math.round(herbes.length * Math.min(1, qualite.part));
    for (let k = 0; k < n; k++) {
      const h = herbes[k], pli = (0.15 + 0.35 * v) * (0.6 + 0.4 * Math.sin(t * (1.5 + v * 2) + h.ph + h.x * 3));
      HERBES.setMatrixAt(k, _m.compose(_p.set(h.x, h.y, h.z), _q.setFromEuler(_e.set(dz * pli, 0, -dx * pli)), _s.set(h.s, h.s, h.s)));
    }
    HERBES.count = n; HERBES.instanceMatrix.needsUpdate = true;
  }
  // givre : il gèle, sans neige au sol ; les toits se refont de temps en temps (bâtiments construits ou détruits)
  const givre = climat.gel > 0.05 && !climat.neigeSol ? Math.min(1, climat.gel * 1.5) : 0;
  M_GIVRE.opacity += (givre * 0.6 - M_GIVRE.opacity) * Math.min(1, dt);
  if (M_GIVRE.opacity > 0.02) { if ((givreT -= dt) <= 0) { givreT = 2; poserGivre(); } }
  if (GIVRE) GIVRE.visible = M_GIVRE.opacity > 0.02;
});
