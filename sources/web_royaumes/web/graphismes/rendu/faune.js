// Bêtes du ciel et de l'eau, automatiques : oiseaux migrateurs en V au printemps (vers le nord) et à l'automne (vers le sud),
// qui traversent le regard de temps en temps ; bancs de poissons qui tournent près des côtes, et un poisson qui saute parfois ;
// envol(x, y, z) : des oiseaux dérangés qui s'échappent des arbres (une armée qui passe, monde.js).
import { THREE, scene, chaqueImage, hache, cam, posCase, voisins, qualite } from './scene.js';
import { carte, TERRE } from './plateau.js';
import { climat } from './vie.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const MER = -0.15;
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; scene.add(m); return m; };

// ------------------------------------------------------------------ oiseaux migrateurs : un vol en V qui passe
const AILE = new THREE.BoxGeometry(0.16, 0.012, 0.04);
const NO = 15, M_OISEAU = new THREE.MeshBasicMaterial({ color: 0x2b2b30 });
const AILES_G = inst(AILE.clone().translate(-0.08, 0, 0), M_OISEAU, NO), AILES_D = inst(AILE.clone().translate(0.08, 0, 0), M_OISEAU, NO);
let vol = null, attente = 8;
const NEV = 72, ENV_G = inst(AILE.clone().translate(-0.06, 0, 0).scale(0.7, 1, 0.7), M_OISEAU, NEV), ENV_D = inst(AILE.clone().translate(0.06, 0, 0).scale(0.7, 1, 0.7), M_OISEAU, NEV), envols = [];
/** Une volée d'oiseaux dérangés s'élève de ce point (repère du plateau) et s'éparpille. */
export function envol(x, y, z) {
  for (let k = 0; k < 7 && envols.length < NEV; k++) { const a = Math.random() * Math.PI * 2; envols.push({ x, y: y + 0.15, z, vx: Math.cos(a) * 0.5, vz: Math.sin(a) * 0.5, vy: 0.6 + Math.random() * 0.4, t: 0, ph: Math.random() * 6 }); }
}
function nouveauVol() {
  const vers = climat.saison === 1 ? -1 : 1, R = Math.max(8, cam.d * 0.9);  // printemps : vers le nord (−z) ; automne : vers le sud
  const x0 = cam.x + (Math.random() - 0.5) * R * 0.8;
  return { x: x0 + (Math.random() - 0.5) * 2, z: cam.z - vers * R, vx: (Math.random() - 0.5) * 0.4, vz: vers * (1.3 + Math.random() * 0.4), y: 2.6 + Math.random() * 0.8, n: 9 + (Math.random() * 6 | 0), fin: 2 * R / 1.4 + 2 };
}

// ------------------------------------------------------------------ bancs de poissons près des côtes
const POISSON = new THREE.CylinderGeometry(1, 1, 0.002, 6).scale(1, 1, 0.4);
const NP = 8, NBANCS = 6, M_POISSON = new THREE.MeshBasicMaterial({ color: 0x1f3d52, transparent: true, opacity: 0.55, depthWrite: false });
const POISSONS = inst(POISSON, M_POISSON, NP * NBANCS), M_SAUT = new THREE.MeshToonMaterial({ color: 0xc9d6de });
const SAUT = inst(new THREE.SphereGeometry(1, 6, 4).scale(1, 0.4, 0.35), M_SAUT, 1);
let carteVue = null, cotes = [], bancs = [];
function lieux(C) {
  carteVue = C; cotes = [];
  for (let i = 0; i < C.terrain.length; i++) if (!TERRE(C.terrain[i]) && voisins(i).some(n => TERRE(C.terrain[n]))) cotes.push(i);
  bancs = [];
}

chaqueImage((dt, t) => {
  const C = carte(); if (!C) return;
  if (C !== carteVue) lieux(C);
  // migrateurs : au printemps et à l'automne, de jour, pas sous la pluie
  const saisonVol = (climat.saison === 1 || climat.saison === 3) && climat.heure === 'jour' && !climat.pluie && !climat.neige;
  if (!vol && saisonVol && (attente -= dt) <= 0) { vol = nouveauVol(); attente = 25 + Math.random() * 35; }
  let no = 0;
  if (vol) {
    vol.x += vol.vx * dt; vol.z += vol.vz * dt; vol.fin -= dt;
    const cap = Math.atan2(vol.vx, vol.vz), c = Math.cos(cap), sn = Math.sin(cap);
    for (let k = 0; k < Math.min(vol.n, NO); k++) {
      // le V : le meneur en tête, les autres de part et d'autre, en arrière
      const rang = Math.ceil(k / 2), cote = k % 2 ? 1 : -1, lx = cote * rang * 0.22, lz = -rang * 0.25;
      const x = vol.x + lx * c + lz * sn, z = vol.z - lx * sn + lz * c, b = Math.sin(t * 9 + k * 0.7) * 0.5;
      _p.set(x, vol.y + Math.sin(t * 1.3 + k) * 0.03, z);
      AILES_G.setMatrixAt(no, _m.compose(_p, _q.setFromEuler(_e.set(0, cap, b)), _s.set(1, 1, 1)));
      AILES_D.setMatrixAt(no++, _m.compose(_p, _q.setFromEuler(_e.set(0, cap, -b)), _s.set(1, 1, 1)));
    }
    if (vol.fin <= 0) vol = null;
  }
  AILES_G.count = AILES_D.count = no; AILES_G.instanceMatrix.needsUpdate = AILES_D.instanceMatrix.needsUpdate = true;
  let ne = 0;
  for (let i = envols.length - 1; i >= 0; i--) {
    const o = envols[i]; o.t += dt; if (o.t > 3.5) { envols.splice(i, 1); continue; }
    o.x += o.vx * dt; o.z += o.vz * dt; o.y += o.vy * dt; o.vy *= 0.985;
    const cap = Math.atan2(o.vx, o.vz), b = Math.sin(t * 14 + o.ph) * 0.6;
    _p.set(o.x, o.y, o.z);
    ENV_G.setMatrixAt(ne, _m.compose(_p, _q.setFromEuler(_e.set(0, cap, b)), _s.set(1, 1, 1)));
    ENV_D.setMatrixAt(ne++, _m.compose(_p, _q.setFromEuler(_e.set(0, cap, -b)), _s.set(1, 1, 1)));
  }
  ENV_G.count = ENV_D.count = ne; ENV_G.instanceMatrix.needsUpdate = ENV_D.instanceMatrix.needsUpdate = true;
  // poissons : les bancs des côtes proches du regard, renouvelés quand on s'éloigne
  const R = Math.max(5, cam.d * 0.6), proches = cotes.filter(i => { const q = posCase(i); return Math.abs(q.x - cam.x) < R && Math.abs(q.z - cam.z) < R; });
  bancs = bancs.filter(b => proches.includes(b.i));
  while (bancs.length < Math.min(NBANCS * Math.min(1, qualite.part), proches.length)) {
    const i = proches[Math.random() * proches.length | 0]; if (bancs.some(b => b.i === i)) break;
    const q = posCase(i); bancs.push({ i, x: q.x + (hache(i, 1, 80) - 0.5) * 0.5, z: q.z + (hache(i, 2, 81) - 0.5) * 0.5, r: 0.12 + hache(i, 3, 82) * 0.1, v: 0.6 + hache(i, 4, 83) * 0.6, ph: hache(i, 5, 84) * 6 });
  }
  let np = 0;
  for (const b of bancs) for (let k = 0; k < NP; k++) {
    const a = t * b.v + b.ph + k * 0.32, r = b.r * (0.85 + 0.15 * Math.sin(k * 1.7));
    POISSONS.setMatrixAt(np++, _m.compose(_p.set(b.x + Math.cos(a) * r, MER + 0.004, b.z + Math.sin(a) * r), _q.setFromAxisAngle(_s.set(0, 1, 0), -a), _s.set(0.025, 1, 0.025)));
  }
  POISSONS.count = np; POISSONS.instanceMatrix.needsUpdate = true;
  // un poisson saute de temps en temps, au-dessus d'un banc
  const b0 = bancs[Math.floor(t / 7) % Math.max(1, bancs.length)], u = (t % 7) / 0.8;
  SAUT.count = b0 && u < 1 ? 1 : 0;
  if (SAUT.count) SAUT.setMatrixAt(0, _m.compose(_p.set(b0.x + (u - 0.5) * 0.15, MER + Math.sin(u * Math.PI) * 0.12, b0.z), _q.setFromEuler(_e.set(0, 0, (0.5 - u) * 2)), _s.set(0.03, 0.03, 0.03)));
  SAUT.instanceMatrix.needsUpdate = true;
});
