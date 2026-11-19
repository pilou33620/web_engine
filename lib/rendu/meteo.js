// Le temps qu'il fait et l'heure du jour, rendus : pluie, neige, brouillard, orage (éclairs), nuages et leur ombre,
// arc-en-ciel, vent, glace sur l'eau ; cycle lent du jour et de la nuit (indépendant des tours), aube et crépuscule dorés.
// La lumière passe par l'objet `lumiere` de scene.js, que la caméra fait suivre en douceur.
import { THREE, scene, chaqueImage, cam, camera, lumiere, hemi, hache } from './scene.js';
import * as P from './plateau.js';
import { climat, MONDE } from './vie.js';
import { toon } from './toon.js';
import './boue.js';      // routes mouillées, crue, eau sale, traces de boue
import './ambiance.js';  // brume du matin sur l'eau, feuilles d'automne, givre sur les toits

const groupe = new THREE.Group();
scene.add(groupe);
const etat = { pluie: 0, neige: 0, brume: 0, orage: false, cible: { pluie: 0, neige: 0, brume: 0 } };
const _c = new THREE.Color(), _v = new THREE.Vector3();

// ------------------------------------------------------------------ pluie : traits qui tombent autour du regard
const NP = 1800, BOITE = 34, HAUT = 14;
const pluieGeo = new THREE.BufferGeometry();
const pp = new Float32Array(NP * 6);
for (let i = 0; i < NP; i++) {
  const x = (Math.random() - 0.5) * BOITE, y = Math.random() * HAUT, z = (Math.random() - 0.5) * BOITE;
  pp.set([x, y, z, x, y - 0.35, z], i * 6);
}
pluieGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const pluieMat = new THREE.LineBasicMaterial({ color: 0xd8e6f2, transparent: true, opacity: 0, depthWrite: false });
const pluie = new THREE.LineSegments(pluieGeo, pluieMat);
pluie.frustumCulled = false;
groupe.add(pluie);

// ------------------------------------------------------------------ neige : flocons ronds qui dérivent
function texFlocon() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), d = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.5, 'rgba(255,255,255,.75)'); d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const NN = 2200;
const neigeGeo = new THREE.BufferGeometry();
const np = new Float32Array(NN * 3), phase = new Float32Array(NN);
for (let i = 0; i < NN; i++) { np.set([(Math.random() - 0.5) * BOITE, Math.random() * HAUT, (Math.random() - 0.5) * BOITE], i * 3); phase[i] = Math.random() * 6.28; }
neigeGeo.setAttribute('position', new THREE.BufferAttribute(np, 3));
const neigeMat = new THREE.PointsMaterial({ size: 0.16, map: texFlocon(), transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
const neige = new THREE.Points(neigeGeo, neigeMat);
neige.frustumCulled = false;
groupe.add(neige);

// ------------------------------------------------------------------ brouillard : nappes basses qui glissent
function texBrume() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let k = 0; k < 40; k++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 14 + Math.random() * 30, d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, 'rgba(255,255,255,.35)'); d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const nappes = [];
const texB = texBrume();
for (let k = 0; k < 3; k++) {
  const t = texB.clone(); t.needsUpdate = true; t.repeat.set(3, 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, color: 0xf2f5f8 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.55 + k * 0.45;
  groupe.add(m);
  nappes.push({ m, t, v: 0.004 + k * 0.003 });
}

// ------------------------------------------------------------------ nuages toon et leur ombre (visibles de loin ; de près, seule l'ombre passe)
const M_NUAGE = toon(0xffffff, { transparent: true, opacity: 0.85, depthWrite: false });
const NUAGES = Array.from({ length: 16 }, (_, i) => {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + hache(i, k, 71) * 0.45, 1).scale(1, 0.55, 1), M_NUAGE);
    m.position.set((k - 1.5) * 0.6, hache(i, k, 73) * 0.2, (hache(i, k, 74) - 0.5) * 0.7); m.castShadow = true; g.add(m);
  }
  g.scale.setScalar(2.2);
  g.userData = { x: (hache(i, 0, 75) - 0.5) * 40, z: (hache(i, 0, 77) - 0.5) * 40, y: 6 + hache(i, 0, 76) * 1.6 };
  groupe.add(g); return g;
});

// ------------------------------------------------------------------ arc-en-ciel
const ARC = new THREE.Group();
[0xe04040, 0xf08a30, 0xf2d040, 0x60c050, 0x40a0e0, 0x5060d0, 0x9050c0].forEach((c, i) => ARC.add(new THREE.Mesh(new THREE.TorusGeometry(4.6 - i * 0.11, 0.06, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.38, depthWrite: false }))));
ARC.visible = false; groupe.add(ARC);

// ------------------------------------------------------------------ éclairs
const eclairEl = document.getElementById('eclair');
const matEclair = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const eclair = new THREE.Line(new THREE.BufferGeometry(), matEclair);
groupe.add(eclair);
let prochainEclair = 4, flash = 0;
function foudre() {
  const x = cam.x + (Math.random() - 0.5) * cam.d * 1.2, z = cam.z + (Math.random() - 0.5) * cam.d * 0.8;
  const pts = [];
  let px = x, pz = z;
  for (let y = 14; y >= 0.3; y -= 1.4) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 0.9; pz += (Math.random() - 0.5) * 0.9; }
  eclair.geometry.dispose();
  eclair.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  matEclair.opacity = 1;
  flash = 1; climat.eclair = 1; // les vitres flashent (quartiers.js)
  if (eclairEl) {
    eclairEl.style.opacity = 0.45;
    setTimeout(() => (eclairEl.style.opacity = 0), 90);
    setTimeout(() => { eclairEl.style.opacity = 0.25; setTimeout(() => (eclairEl.style.opacity = 0), 70); }, 180);
  }
}

// ------------------------------------------------------------------ heure du jour (couleurs de la maquette) : ~5 min de jour, crépuscule, ~1 min de nuit, aube
const LUMIERE = {
  jour: { sol: 0xfff0d4, sI: 2.6, hemi: 0xeef7ff, hI: 1.5, fond: 0x1b211a, el: 1 },
  aube: { sol: 0xff9f5a, sI: 1.9, hemi: 0xd8d4e8, hI: 1.15, fond: 0x3b2717, el: 0.25 },
  // le crépuscule, plus rosé que l'aube (maquette « vie des quartiers »)
  crep: { sol: 0xff7f6a, sI: 1.75, hemi: 0xcdbde0, hI: 1.1, fond: 0x2c1b2a, el: 0.22 },
  // nuit : lune bleutée, mais la carte reste lisible (hemi pas sous 0,9)
  nuit: { sol: 0x8ea6ff, sI: 0.6, hemi: 0x7484b4, hI: 0.95, fond: 0x090d1a, el: 0.6 },
};
for (const L of Object.values(LUMIERE)) { L.sol = new THREE.Color(L.sol); L.hemi = new THREE.Color(L.hemi); L.fond = new THREE.Color(L.fond); }
const JOUR_S = 300, CREP_S = 30, NUIT_S = 60, AUBE_S = 30, CYCLE = JOUR_S + CREP_S + NUIT_S + AUBE_S;
let force = null, tForce = 0, marcheForce = null;
/** Pour les essais : 'jour', 'aube', 'crepuscule', 'nuit' (l'horloge de la phase repart de 0), ou un instant du cycle en secondes
 *  (0 = début du jour) ; null = cycle automatique. */
export function forcerHeure(h) { force = h; tForce = 0; }
/** Pour les essais : true ou false force le jour de marché, null le rend au cycle (un jour sur deux). */
export function forcerMarche(v) { marcheForce = v; }
/** Poids [jour, aube, nuit], phase ('jour', 'crepuscule', 'nuit', 'aube') et secondes écoulées dans la phase, à l'instant t. */
function poids(t) {
  if (typeof force === 'string') return [force === 'jour' ? 1 : 0, force === 'aube' || force === 'crepuscule' ? 1 : 0, force === 'nuit' ? 1 : 0, force, tForce];
  const p = typeof force === 'number' ? force % CYCLE : (t + 20) % CYCLE;
  // chaque transition passe par l'or : à mi-chemin, tout est aube
  if (p < JOUR_S) return [1, 0, 0, 'jour', p];
  if (p < JOUR_S + CREP_S) { const u = (p - JOUR_S) / CREP_S; return [Math.max(0, 1 - 2 * u), 1 - Math.abs(2 * u - 1), Math.max(0, 2 * u - 1), 'crepuscule', p - JOUR_S]; }
  if (p < JOUR_S + CREP_S + NUIT_S) return [0, 0, 1, 'nuit', p - JOUR_S - CREP_S];
  const u = (p - JOUR_S - CREP_S - NUIT_S) / AUBE_S;
  return [Math.max(0, 2 * u - 1), 1 - Math.abs(2 * u - 1), Math.max(0, 1 - 2 * u), 'aube', p - JOUR_S - CREP_S - NUIT_S];
}

// ------------------------------------------------------------------ appliquer le temps du mois
const TEMPS = { sombre: 1, brume: 1, gris: 0, teinte: null, hautSaison: 1 };
const PLUVIEUX = ['pluie', 'orage', 'tempete', 'neige'];
/** m : la météo du serveur ; saison : 0 hiver … 3 automne. */
export function appliquerMeteo(m, saison) {
  if (!m) return;
  const g = m.genre, tombe = PLUVIEUX.includes(g);
  const neigeTombe = g === 'neige' || (saison === 0 && tombe);
  etat.cible.pluie = tombe && !neigeTombe ? Math.max(0.35, m.pluie ?? 0.5) : 0;
  etat.cible.neige = neigeTombe ? Math.max(0.4, m.pluie ?? 0.5) : 0;
  etat.cible.brume = g === 'brouillard' ? 1 : neigeTombe ? 0.25 : 0;
  etat.orage = g === 'orage' || g === 'tempete';
  const v = Math.min(1, m.vent ?? 0.3), gel = m.temperature < -1 ? Math.min(1, (-m.temperature + 1) / 6) : 0;
  Object.assign(climat, {
    genre: g, saison, pluie: tombe, neige: neigeTombe, gel, froid: m.temperature < 12, dir: m.direction || 0,
    vent: g === 'tempete' ? 1.4 : g === 'brouillard' ? 0.05 : 0.2 + v * 0.6,
    nuages: { soleil: 3, nuages: 10, pluie: 14, orage: 16, brouillard: 2, neige: 13, gel: 4, canicule: 1, tempete: 16 }[g] ?? 6,
    gris: { pluie: 0.6, orage: 0.85, tempete: 0.8, neige: 0.35, brouillard: 0.3 }[g] ?? 0,
    oiseaux: !tombe, neigeSol: (m.neige_sol ?? 0) > 0.3,
    // effets de jeu (web_royaumes les envoie dans etat.meteo) : poudre mouillée (tir < 1), forte pluie (crue),
    // champs secs : 1 jaunis (canicule, début de sécheresse), 2 grillés (sécheresse au-delà de 1, qui coûte les récoltes)
    poudre: m.tir ?? (tombe && !neigeTombe ? 0.8 : 1),
    pluieForte: (g === 'orage' || g === 'tempete' || (m.pluie ?? 0) > 0.6) && !neigeTombe,
    sec: saison === 0 ? 0 : (m.secheresse ?? 0) > 1 ? 2 : g === 'canicule' || (m.secheresse ?? 0) > 0.6 ? 1 : 0,
  });
  if (typeof P.secher === 'function') P.secher(climat.sec);
  // glace sur l'eau, vent sur la mer et dans les ailes
  if (typeof P.geler === 'function') P.geler(gel);
  else if (P.U) { P.U.gel.value = gel; P.U.vent.value = 0.15 + v * (g === 'tempete' ? 1.4 : 0.8); P.U.vague.value = 0.7 + v * (g === 'tempete' ? 2.5 : 1.2); }
  if (MONDE.vent) { MONDE.vent.v = g === 'tempete' ? 1 : v; MONDE.vent.dir = -(m.direction || 0); }
  TEMPS.sombre = { nuages: 0.8, pluie: 0.55, orage: 0.42, brouillard: 0.6, tempete: 0.45, neige: 0.7, gel: 0.9 }[g] ?? 1;
  TEMPS.brume = { brouillard: 0.45, tempete: 0.75, neige: 0.8, pluie: 0.9, orage: 0.85 }[g] ?? 1;
  TEMPS.gris = g === 'brouillard' ? 0.85 : 0;
  TEMPS.teinte = g === 'canicule' ? 0xffd9a0 : g === 'gel' ? 0xe8f0ff : null;
  TEMPS.hautSaison = [0.35, 0.75, 1.0, 0.6][saison] ?? 1;
  M_NUAGE.color.setHex(tombe && g !== 'neige' ? 0x8d939c : 0xffffff);
}

const GRIS = new THREE.Color(0x3a4248), BRUME = new THREE.Color(0x9aa2a6), DORE = new THREE.Color(0xdfe8ff);
function majLumiere(t) {
  const [j, a, n, phase, p] = poids(t);
  climat.jour = j; climat.aube = a; climat.nuit = n;
  climat.heure = j >= a && j >= n ? 'jour' : n > a ? 'nuit' : 'aube';
  // la phase fine et l'heure dans la phase (vie des quartiers) ; le jour de marché revient un jour du cycle sur deux
  climat.phase = phase; climat.p = p;
  climat.marcheForce = marcheForce;
  climat.marche = marcheForce ?? (Math.floor((typeof force === 'number' ? force : t + 20) / CYCLE) % 2 === 0);
  const L = { ...LUMIERE, aube: phase === 'crepuscule' ? LUMIERE.crep : LUMIERE.aube }, s = TEMPS.sombre;
  lumiere.soleil = (L.jour.sI * j + L.aube.sI * a + L.nuit.sI * n) * s;
  lumiere.hemi = (L.jour.hI * j + L.aube.hI * a + L.nuit.hI * n) * (0.75 + 0.25 * s);
  const mix = (cle, cible) => { const A = L.jour[cle], B = L.aube[cle], D = L.nuit[cle]; return cible.setRGB(A.r * j + B.r * a + D.r * n, A.g * j + B.g * a + D.g * n, A.b * j + B.b * a + D.b * n); };
  mix('sol', lumiere.couleurSoleil);
  if (TEMPS.teinte != null) lumiere.couleurSoleil.lerp(_c.setHex(TEMPS.teinte), 0.5 * j);
  if (climat.pollution) lumiere.couleurSoleil.lerp(_c.setHex(0xe0b860), 0.6 * climat.pollution * (j + a));  // ciel jauni (web_power : charbon)
  if (lumiere.couleurHemi) { mix('hemi', lumiere.couleurHemi); if (climat.pollution) lumiere.couleurHemi.lerp(_c.setHex(0xd2bc80), 0.4 * climat.pollution); }
  mix('fond', lumiere.ciel);
  const clarte = j + a * 0.7 + n * 0.25;
  if (s < 0.9) lumiere.ciel.lerp(GRIS, (1 - s) * 0.6 * clarte);
  if (TEMPS.gris) lumiere.ciel.lerp(_c.copy(BRUME).multiplyScalar(clarte), TEMPS.gris);
  if (climat.pollution) lumiere.ciel.lerp(_c.setHex(0xb9a46e).multiplyScalar(clarte), 0.5 * climat.pollution);
  lumiere.brume = TEMPS.brume * (1 - 0.45 * (climat.pollution || 0));  // la pollution voile le lointain
  lumiere.hauteurSoleil = TEMPS.hautSaison * (L.jour.el * j + L.aube.el * a + L.nuit.el * n);
}

chaqueImage((dt, t) => {
  tForce += dt;
  climat.eclair = Math.max(0, (climat.eclair || 0) - dt * 5);
  majLumiere(t);
  const a = Math.min(1, dt * 0.8);
  for (const k of ['pluie', 'neige', 'brume']) etat[k] += (etat.cible[k] - etat[k]) * a;
  // pluie
  pluieMat.opacity = etat.pluie * 0.55;
  pluie.visible = etat.pluie > 0.02;
  if (pluie.visible) {
    const p = pluieGeo.attributes.position.array, v = 13 * dt, dx = Math.cos(climat.dir) * climat.vent * 0.25, dz = Math.sin(climat.dir) * climat.vent * 0.25;
    for (let i = 0; i < NP; i++) {
      const o = i * 6;
      p[o + 1] -= v; p[o + 4] -= v;
      if (p[o + 4] < 0) { const x = (Math.random() - 0.5) * BOITE, z = (Math.random() - 0.5) * BOITE, y = HAUT; p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - dx; p[o + 4] = y - 0.35; p[o + 5] = z - dz; }
    }
    pluieGeo.attributes.position.needsUpdate = true;
    pluie.position.set(cam.x, 0, cam.z);
  }
  // neige
  neigeMat.opacity = etat.neige * 0.95;
  neige.visible = etat.neige > 0.02;
  if (neige.visible) {
    const p = neigeGeo.attributes.position.array;
    for (let i = 0; i < NN; i++) {
      const o = i * 3;
      p[o + 1] -= (0.9 + (i % 5) * 0.12) * dt;
      p[o] += (Math.sin(t * 0.8 + phase[i]) * 0.25 + Math.cos(climat.dir) * climat.vent * 0.6) * dt;
      p[o + 2] += Math.sin(climat.dir) * climat.vent * 0.6 * dt;
      if (p[o + 1] < 0) { p[o] = (Math.random() - 0.5) * BOITE; p[o + 1] = HAUT; p[o + 2] = (Math.random() - 0.5) * BOITE; }
    }
    neigeGeo.attributes.position.needsUpdate = true;
    neige.position.set(cam.x, 0, cam.z);
  }
  // brume : nappes plus sombres la nuit
  for (const n of nappes) {
    n.m.material.opacity = etat.brume * 0.42 * Math.max(0.35, 1 - (cam.d - 20) / 60);
    n.m.material.color.setScalar(0.3 + 0.65 * (climat.jour + climat.aube * 0.7));
    n.m.visible = etat.brume > 0.02;
    n.t.offset.x += n.v * dt * (1 + climat.vent); n.t.offset.y += n.v * 0.4 * dt;
    n.m.position.x = cam.x; n.m.position.z = cam.z;
  }
  // nuages : poussés par le vent, ils reviennent de l'autre côté du regard
  const R = Math.max(16, cam.d * 1.3), vx = Math.cos(climat.dir) * (0.15 + climat.vent * 0.5), vz = Math.sin(climat.dir) * (0.15 + climat.vent * 0.5);
  M_NUAGE.opacity = Math.min(1, Math.max(0, (cam.d - 16) / 14)) * 0.85; M_NUAGE.colorWrite = M_NUAGE.opacity > 0.02;
  NUAGES.forEach((g, i) => {
    g.visible = i < climat.nuages;
    const u = g.userData; u.x += vx * dt; u.z += vz * dt;
    if (u.x - cam.x > R) u.x -= 2 * R; if (u.x - cam.x < -R) u.x += 2 * R;
    if (u.z - cam.z > R) u.z -= 2 * R; if (u.z - cam.z < -R) u.z += 2 * R;
    g.position.set(u.x, u.y, u.z);
  });
  // arc-en-ciel, face à la caméra, à la taille du regard
  ARC.visible = (climat.arc || climat.apresPluie) && climat.heure === 'jour' && !climat.pluie && !climat.neige && climat.gel < 0.05;  // apresPluie : boue.js, juste après une averse
  if (ARC.visible) {
    const k = cam.d / 9.5;
    _v.set(cam.x - camera.position.x, 0, cam.z - camera.position.z).normalize();
    ARC.scale.setScalar(k); ARC.position.set(cam.x + _v.x * 3 * k, -1 * k, cam.z + _v.z * 3 * k); ARC.lookAt(camera.position.x, -1 * k, camera.position.z);
  }
  // orage : éclair dans le ciel, la campagne s'illumine d'un coup puis la lumière revient en douceur
  matEclair.opacity = Math.max(0, matEclair.opacity - dt * 6);
  if (etat.orage) { prochainEclair -= dt; if (prochainEclair <= 0) { prochainEclair = 3 + Math.random() * 6; foudre(); } }
  if (flash > 0) { hemi.intensity += flash * 1.6; scene.background.lerp(DORE, flash * 0.35); flash = 0; }
});
