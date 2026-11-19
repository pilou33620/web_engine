// La nuit et l'eau qui brille, toutes automatiques (elles suivent climat, posé par meteo.js) :
// étoiles et lune (qui change de phase d'une nuit à l'autre) ; lucioles les nuits d'été près des bois et des prés ;
// reflet du soleil (le jour) ou de la lune (la nuit) sur la mer, face au regard ; lumières des villes dans les rivières la nuit.
import { THREE, scene, chaqueImage, hache, cam, camera, posCase, qualite } from './scene.js';
import { carte, hauteur, hauteurEn, TERRE, pointsRiviere, casesBaties } from './plateau.js';
import { climat } from './vie.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const MER = -0.15;
const plat = n => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const additif = (couleur, op = 1) => new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.renderOrder = 3; scene.add(m); return m; };
const disque = (r = 32) => { const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d'), d = g.createRadialGradient(r, r, 0, r, r, r); d.addColorStop(0, '#fff'); d.addColorStop(0.35, 'rgba(255,255,255,.7)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, r * 2, r * 2); return new THREE.CanvasTexture(c); };
const TACHE = disque();

// ------------------------------------------------------------------ étoiles : un ciel autour du regard, qui s'efface sous les nuages
const NE = 600, posE = new Float32Array(NE * 3);
for (let i = 0; i < NE; i++) { const a = hache(i, 1, 90) * Math.PI * 2, h = 0.08 + hache(i, 2, 91) * 0.9, r = 1; posE.set([Math.cos(a) * Math.cos(h) * r, Math.sin(h) * r, Math.sin(a) * Math.cos(h) * r], i * 3); }
const geoE = new THREE.BufferGeometry(); geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
const M_ETOILE = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
const ETOILES = new THREE.Points(geoE, M_ETOILE); ETOILES.frustumCulled = false; ETOILES.renderOrder = -1; scene.add(ETOILES);

// ------------------------------------------------------------------ lune : huit phases, une par nuit
const PHASES = Array.from({ length: 8 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fdf6dc'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  // l'ombre : un disque sombre décalé (nouvelle lune au 0, pleine lune au 4)
  const u = k / 8, dx = (u < 0.5 ? 1 - u * 4 : (u - 0.5) * 4 - 1) * 58;
  if (k !== 4) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(32 + (u < 0.5 ? dx : -dx), 32, 28, 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
});
const M_LUNE = new THREE.SpriteMaterial({ map: PHASES[4], transparent: true, opacity: 0, depthWrite: false, fog: false });
const LUNE = new THREE.Sprite(M_LUNE); LUNE.renderOrder = -1; scene.add(LUNE);
let nuitN = 0, etaitNuit = false;
/** La phase de la lune (0 nouvelle, 4 pleine, de 0 à 7) ; elle avance d'un huitième à chaque nuit. */
export const phaseLune = () => nuitN % 8;

// ------------------------------------------------------------------ reflet du soleil ou de la lune sur la mer : une traînée de paillettes
const NR = 60, M_REFLET = additif(0xfff2c8, 0.5); M_REFLET.map = TACHE;
const REFLET = inst(plat(), M_REFLET, NR);

// ------------------------------------------------------------------ lumières des villes dans les rivières, la nuit
const NV = 300, M_VILLE = additif(0xffb54a, 0.55); M_VILLE.map = TACHE;
const VILLES = inst(plat(), M_VILLE, NV);
let lueurs = [], sigLueurs = '';
function poserLueurs() {
  const R = pointsRiviere(), B = casesBaties(), C = carte(); lueurs = [];
  if (!R || !B || !C) return;
  for (const [i, pts] of R) {
    const q = posCase(i), pres = B.has(i) || [...B].some(b => { const p = posCase(b); return (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < 1.2; });
    if (!pres) continue;
    pts.forEach(([x, z], k) => { if (k % 2 === 0 && lueurs.length < NV) lueurs.push({ x, z, y: hauteur(i) + 0.016, ph: hache(i, k, 95) * 6, s: 0.05 + hache(i, k, 96) * 0.05 }); });
  }
}

// ------------------------------------------------------------------ lucioles : les nuits d'été, près des bois et des prés
const NL = 120, M_LUCIOLE = additif(0xd8ff6a, 0.9); M_LUCIOLE.map = TACHE;
const LUCIOLES = inst(plat(), M_LUCIOLE, NL), lucioles = [];
function placerLuciole(f) {
  const C = carte(), R = Math.max(3, cam.d * 0.35);
  for (let essai = 0; essai < 6; essai++) {
    const x = cam.x + (Math.random() - 0.5) * 2 * R, z = cam.z + (Math.random() - 0.5) * 2 * R, h = hauteurEn(x, z);
    if (h < 0) continue;
    return Object.assign(f, { x, z, y: h + 0.05 + Math.random() * 0.15, ph: Math.random() * 6, v: 0.5 + Math.random(), vie: 6 + Math.random() * 8 });
  }
  return Object.assign(f, { vie: 0 });
}
for (let k = 0; k < NL; k++) lucioles.push({ vie: 0 });

chaqueImage((dt, t) => {
  const C = carte(); if (!C) return;
  const nuit = Math.min(1, (climat.nuit || 0) + (climat.aube || 0) * 0.3), couvert = Math.min(1, (climat.nuages || 0) / 12);
  if (climat.heure === 'nuit' && !etaitNuit) nuitN++;
  etaitNuit = climat.heure === 'nuit';
  // étoiles et lune : un ciel lointain, centré sur la caméra
  ETOILES.position.copy(camera.position); ETOILES.scale.setScalar(Math.max(60, cam.d * 4));
  M_ETOILE.opacity = nuit * (1 - couvert) * 0.9;
  ETOILES.visible = M_ETOILE.opacity > 0.02;
  const lune = phaseLune() !== 0 && nuit > 0.1 && couvert < 0.8;
  M_LUNE.opacity += ((lune ? nuit * (1 - couvert * 0.7) : 0) - M_LUNE.opacity) * Math.min(1, dt * 2);
  LUNE.visible = M_LUNE.opacity > 0.02;
  if (LUNE.visible) {
    M_LUNE.map = PHASES[phaseLune()];
    _v.set(cam.x - camera.position.x, 0, cam.z - camera.position.z).normalize();  // au loin, devant le regard, haut dans le ciel
    const k = cam.d * 2.2; LUNE.position.set(cam.x + _v.x * k - _v.z * k * 0.3, cam.d * 0.9, cam.z + _v.z * k + _v.x * k * 0.3); LUNE.scale.setScalar(cam.d * 0.18);
  }
  // reflet : le jour, le soleil (au nord-ouest, comme la lumière de scene.js) ; la nuit, la lune
  const astre = climat.heure === 'jour' ? 1 - couvert * 0.8 : LUNE.visible ? M_LUNE.opacity * 0.8 : 0;
  let nr = 0;
  if (astre > 0.05) {
    M_REFLET.color.setHex(climat.heure === 'jour' ? 0xfff2c8 : 0xcfdcff);
    const ax = cam.x - 0.6 * cam.d * 0.35, az = cam.z - 0.45 * cam.d * 0.35;  // entre le regard et l'astre
    for (let k = 0; k < NR * Math.min(1, qualite.part); k++) {
      const u = hache(k, 3, 97), x = ax + (cam.x - ax) * u * 1.2 + (hache(k, 4, 98) - 0.5) * 0.35 * (1 + u), z = az + (cam.z - az) * u * 1.2 + (hache(k, 5, 99) - 0.5) * 0.25 * (1 + u);
      if (hauteurEn(x, z) > MER) continue;  // seulement sur la mer
      const b = Math.max(0, Math.sin(t * (2 + hache(k, 6, 100) * 3) + k)), s = (0.08 + 0.12 * b) * (cam.d / 8);
      REFLET.setMatrixAt(nr++, _m.compose(_p.set(x, MER + 0.01, z), _q.identity(), _s.set(s * 1.8, 1, s * 0.6)));
    }
    M_REFLET.opacity = 0.55 * astre;
  }
  REFLET.count = nr; REFLET.instanceMatrix.needsUpdate = true;
  // lumières des villes dans les rivières
  const sig = (pointsRiviere()?.size || 0) + ':' + (casesBaties()?.size || 0);
  if (sig !== sigLueurs) { sigLueurs = sig; poserLueurs(); }
  let nv = 0;
  if (nuit > 0.3) for (const l of lueurs) {
    const s = l.s * (0.8 + 0.3 * Math.sin(t * 3 + l.ph));
    VILLES.setMatrixAt(nv++, _m.compose(_p.set(l.x, l.y, l.z), _q.identity(), _s.set(s * 0.6, 1, s * 1.8)));
  }
  M_VILLE.opacity = 0.6 * nuit; VILLES.count = nv; VILLES.instanceMatrix.needsUpdate = true;
  // lucioles
  let nl = 0;
  if (climat.saison === 2 && nuit > 0.5 && !climat.pluie) for (let k = 0; k < NL * Math.min(1, qualite.part); k++) {
    const f = lucioles[k];
    if ((f.vie -= dt) <= 0) placerLuciole(f);
    if (f.vie <= 0) continue;
    f.x += Math.sin(t * f.v + f.ph) * 0.05 * dt; f.z += Math.cos(t * f.v * 0.8 + f.ph) * 0.05 * dt;
    const b = Math.max(0, Math.sin(t * 2.2 * f.v + f.ph * 3)), s = 0.055 * b;
    if (s > 0.004) LUCIOLES.setMatrixAt(nl++, _m.compose(_p.set(f.x, f.y + Math.sin(t + f.ph) * 0.02, f.z), _q.identity(), _s.set(s, 1, s)));
  }
  LUCIOLES.count = nl; LUCIOLES.instanceMatrix.needsUpdate = true;
});
