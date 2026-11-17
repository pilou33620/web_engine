// Le temps qu'il fait, rendu : pluie, neige, brouillard, orage (éclairs), vent dans les arbres et sur la mer,
// glace sur les lacs, soleil bas l'hiver, lumière chaude l'été, ciel gris sous la pluie.
import { THREE, scene, chaqueImage, cam, lumiere } from './scene.js';
import { U } from './plateau.js';
import { climat } from './vie.js';
import { vent } from './monde.js';

const groupe = new THREE.Group();
scene.add(groupe);
const etat = { pluie: 0, neige: 0, brume: 0, orage: false, cible: { pluie: 0, neige: 0, brume: 0 } };

// ------------------------------------------------------------------ pluie : traits qui tombent autour du regard
const NP = 1800, BOITE = 34, HAUT = 14;
const pluieGeo = new THREE.BufferGeometry();
const pp = new Float32Array(NP * 6);
for (let i = 0; i < NP; i++) {
  const x = (Math.random() - 0.5) * BOITE, y = Math.random() * HAUT, z = (Math.random() - 0.5) * BOITE;
  pp.set([x, y, z, x, y - 0.35, z], i * 6);
}
pluieGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const pluieMat = new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0, depthWrite: false });
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

// ------------------------------------------------------------------ éclairs
const eclairEl = document.getElementById('eclair');
const matEclair = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const eclair = new THREE.Line(new THREE.BufferGeometry(), matEclair);
groupe.add(eclair);
let prochainEclair = 4;
function foudre() {
  const x = cam.x + (Math.random() - 0.5) * cam.d * 1.2, z = cam.z + (Math.random() - 0.5) * cam.d * 0.8;
  const pts = [];
  let px = x, pz = z;
  for (let y = 14; y >= 0.3; y -= 1.4) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 0.9; pz += (Math.random() - 0.5) * 0.9; }
  eclair.geometry.dispose();
  eclair.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  matEclair.opacity = 1;
  eclairEl.style.opacity = 0.55;
  setTimeout(() => (eclairEl.style.opacity = 0), 90);
  setTimeout(() => { eclairEl.style.opacity = 0.3; setTimeout(() => (eclairEl.style.opacity = 0), 70); }, 180);
}

// ------------------------------------------------------------------ appliquer le temps du mois
const CIELS = {
  soleil: 0x1d5c96, nuages: 0x2a5f8e, pluie: 0x3d5468, orage: 0x2c3846, brouillard: 0x93a6b6,
  neige: 0x8ea2b4, gel: 0x6f8aa3, canicule: 0x2e78bd, tempete: 0x2f3e4e,
};
/** m : la météo du serveur ; saison : 0 hiver … 3 automne. */
export function appliquerMeteo(m, saison) {
  const g = m.genre;
  etat.cible.pluie = (g === 'pluie' || g === 'orage' || g === 'tempete') ? Math.max(0.35, m.pluie) : 0;
  etat.cible.neige = g === 'neige' ? Math.max(0.4, m.pluie) : 0;
  etat.cible.brume = g === 'brouillard' ? 1 : g === 'neige' ? 0.25 : 0;
  etat.orage = g === 'orage' || g === 'tempete';
  const ventFort = Math.min(1, m.vent);
  U.vent.value = 0.15 + ventFort * (g === 'tempete' ? 1.4 : 0.8);
  U.vague.value = 0.7 + ventFort * (g === 'tempete' ? 2.5 : 1.2);
  U.gel.value = m.temperature < -1 ? Math.min(1, (-m.temperature + 1) / 6) : 0;
  vent.v = ventFort; vent.dir = -m.direction;
  Object.assign(climat, {
    froid: m.temperature < 12, vent: ventFort, dir: m.direction,
    nuages: { soleil: 3, nuages: 10, pluie: 14, orage: 16, brouillard: 4, neige: 13, gel: 4, canicule: 1, tempete: 16 }[g] ?? 6,
    gris: { pluie: 0.6, orage: 0.85, tempete: 0.8, neige: 0.35, brouillard: 0.3 }[g] ?? 0,
    oiseaux: !['pluie', 'orage', 'tempete', 'neige'].includes(g),
  });
  // lumière : saison (hauteur et couleur du soleil) et temps
  lumiere.hauteurSoleil = [0.35, 0.75, 1.0, 0.6][saison];
  const sombre = { pluie: 0.5, orage: 0.38, tempete: 0.42, brouillard: 0.55, neige: 0.65, nuages: 0.8, gel: 0.85 }[g] ?? 1;
  lumiere.soleil = 2.3 * sombre;
  lumiere.hemi = 1.0 + (1 - sombre) * 0.35;
  const cs = [0xfff2e2, 0xfff4dc, 0xfff0d0, 0xffe2b8][saison];
  lumiere.couleurSoleil.setHex(g === 'canicule' ? 0xffd9a0 : g === 'gel' ? 0xe8f0ff : cs);
  lumiere.ciel.setHex(CIELS[g] ?? 0x1d5c96);
  lumiere.brume = g === 'brouillard' ? 0.62 : g === 'neige' ? 0.75 : (g === 'pluie' || g === 'orage') ? 0.85 : 1;
}

chaqueImage((dt, t) => {
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
  // brume
  for (const n of nappes) {
    n.m.material.opacity = etat.brume * 0.42 * Math.max(0.35, 1 - (cam.d - 20) / 60);
    n.m.visible = etat.brume > 0.02;
    n.t.offset.x += n.v * dt * (1 + climat.vent); n.t.offset.y += n.v * 0.4 * dt;
    n.m.position.x = cam.x; n.m.position.z = cam.z;
  }
  // orage
  matEclair.opacity = Math.max(0, matEclair.opacity - dt * 6);
  if (etat.orage) { prochainEclair -= dt; if (prochainEclair <= 0) { prochainEclair = 3 + Math.random() * 6; foudre(); } }
});
