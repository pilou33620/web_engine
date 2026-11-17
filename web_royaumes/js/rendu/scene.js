// La scène 3D : moteur de rendu, caméra inclinée (glisser, pincer, tourner), lumières, boucle d'animation.
import * as THREE from '../../vendor/three/three.module.js';

export { THREE };
export const SQ3 = Math.sqrt(3);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function hache(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ géométrie des hexagones
export const geo = { l: 1, h: 1 };
export function posCase(i) {
  const c = i % geo.l, r = (i / geo.l) | 0;
  return { x: SQ3 * (c + 0.5 * (r & 1)), z: 1.5 * r, c, r };
}
export function caseA(x, z) {
  const q = SQ3 / 3 * x - z / 3, r = 2 / 3 * z, cy = -q - r;
  let rx = Math.round(q), ry = Math.round(cy), rz = Math.round(r);
  const dx = Math.abs(rx - q), dy = Math.abs(ry - cy), dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  const col = rx + (rz - (rz & 1)) / 2;
  if (col < 0 || rz < 0 || col >= geo.l || rz >= geo.h) return -1;
  return rz * geo.l + col;
}
const DP = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]], DI = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];
export function voisin(i, d) {
  const c = i % geo.l, r = (i / geo.l) | 0, [dc, dr] = ((r & 1) ? DI : DP)[d];
  const cc = c + dc, rr = r + dr;
  return cc < 0 || rr < 0 || cc >= geo.l || rr >= geo.h ? -1 : rr * geo.l + cc;
}
export function voisins(i) { const v = []; for (let d = 0; d < 6; d++) { const n = voisin(i, d); if (n >= 0) v.push(n); } return v; }

// ------------------------------------------------------------------ moteur de rendu
export const canvas = document.getElementById('carte');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

export const scene = new THREE.Scene();
export const CIEL = new THREE.Color(0x1d5c96);
scene.background = CIEL.clone();
scene.fog = new THREE.Fog(CIEL.clone(), 40, 120);
export const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 600);

export const hemi = new THREE.HemisphereLight(0xdcefff, 0x41592f, 1.05);
scene.add(hemi);
export const soleil = new THREE.DirectionalLight(0xfff0d8, 2.6);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
soleil.shadow.bias = -0.0005;
soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);
export const ambiance = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambiance);

// réglages modifiés par la météo et la saison
export const lumiere = { soleil: 2.6, hemi: 1.25, couleurSoleil: new THREE.Color(0xfff0d8), ciel: CIEL.clone(), brume: 1, hauteurSoleil: 1 };

function redimensionner() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();

// ------------------------------------------------------------------ caméra et gestes
export const cam = { x: 30, z: 24, d: 30, cible: 30, lacet: 0, auto: true, l: 80, h: 60 };
const ray = new THREE.Raycaster(), plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35), ndc = new THREE.Vector2();
export function solA(px, py) {
  ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plan, p) ? p : null;
}
export function viser(x, z, d) { cam.x = x; cam.z = z; if (d) cam.cible = d; cam.auto = false; }

const ecouteurs = { tap: [] };
export function surTap(f) { ecouteurs.tap.push(f); }

(function gestes() {
  const pts = new Map();
  let t0 = 0, bouge = 0, pince = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
    if (pts.size === 1) { t0 = performance.now(); bouge = 0; }
    pince = null;
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      if (p.b === 2 || e.shiftKey) cam.lacet -= (e.clientX - p.x) * 0.006;
      else {
        const a = solA(p.x, p.y), b = solA(e.clientX, e.clientY);
        if (a && b) { cam.x -= b.x - a.x; cam.z -= b.z - a.z; }
      }
      bouge += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    } else if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [A, B] = [...pts.values()];
      const d = Math.hypot(A.x - B.x, A.y - B.y), ang = Math.atan2(B.y - A.y, B.x - A.x), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      if (pince) {
        cam.d = cam.cible = clamp(cam.d * pince.d / d, 6, 95);
        cam.lacet += ang - pince.ang;
        const a = solA(pince.mx, pince.my), b = solA(mx, my);
        if (a && b) { cam.x -= b.x - a.x; cam.z -= b.z - a.z; }
      }
      pince = { d, ang, mx, my };
      bouge += 99;
    }
    if (bouge > 12) cam.auto = false;
  });
  const fin = e => {
    const n = pts.size;
    pts.delete(e.pointerId);
    pince = null;
    if (n === 1 && bouge < 12 && performance.now() - t0 < 650 && e.button !== 2) {
      const p = solA(e.clientX, e.clientY);
      if (p) { const i = caseA(p.x, p.z); if (i >= 0) ecouteurs.tap.forEach(f => f(i, e)); }
    }
  };
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pince = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.cible = clamp(cam.cible * (1 + e.deltaY * 0.0012), 6, 95); cam.auto = false; }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase(), s = cam.d * 0.05, c = Math.cos(cam.lacet), sn = Math.sin(cam.lacet);
    if (k === 'z' || k === 'w' || k === 'arrowup') { cam.x -= sn * s; cam.z -= c * s; }
    if (k === 's' || k === 'arrowdown') { cam.x += sn * s; cam.z += c * s; }
    if (k === 'q' || k === 'a' || k === 'arrowleft') { cam.x -= c * s; cam.z += sn * s; }
    if (k === 'd' || k === 'arrowright') { cam.x += c * s; cam.z -= sn * s; }
    if (k === 'e') cam.lacet -= 0.1;
    if (k === 'r') cam.lacet += 0.1;
  });
})();

// ------------------------------------------------------------------ boucle
const animations = [], apres = [];
export function chaqueImage(f) { animations.push(f); }
/** Après le placement de la caméra (étiquettes HTML posées sur la scène). */
export function apresCamera(f) { apres.push(f); }
export const horloge = { t: 0 };
let avant = performance.now();
const _c = new THREE.Color();

function placerCamera(dt) {
  cam.d += (cam.cible - cam.d) * Math.min(1, dt * 9);
  if (cam.auto) cam.lacet += dt * 0.04;
  cam.x = clamp(cam.x, 0, cam.l);
  cam.z = clamp(cam.z, 0, cam.h);
  const k = clamp((cam.d - 7) / 60, 0, 1), tangage = lerp(0.62, 1.12, k);
  camera.position.set(cam.x + Math.sin(cam.lacet) * Math.cos(tangage) * cam.d, Math.sin(tangage) * cam.d, cam.z + Math.cos(cam.lacet) * Math.cos(tangage) * cam.d);
  camera.lookAt(cam.x, 0.3, cam.z);
  // brume de distance : le large se fond dans le ciel, comme sur la vidéo
  scene.fog.near = cam.d * 1.1 * lumiere.brume;
  scene.fog.far = cam.d * 3.3 * lumiere.brume;
  // l'ombre suit le regard
  const s = Math.max(14, cam.d * 1.25), sc = soleil.shadow.camera;
  if (Math.abs(sc.right - s) > s * 0.12) { sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 1; sc.far = 220; sc.updateProjectionMatrix(); }
  const hs = lumiere.hauteurSoleil;
  soleil.target.position.set(cam.x, 0, cam.z);
  soleil.position.set(cam.x - 22, 26 + 30 * hs, cam.z - 16);
  // lumières : vont doucement vers leurs consignes (transition de météo)
  const a = Math.min(1, dt * 1.5);
  soleil.intensity += (lumiere.soleil - soleil.intensity) * a;
  hemi.intensity += (lumiere.hemi - hemi.intensity) * a;
  soleil.color.lerp(lumiere.couleurSoleil, a);
  scene.background.lerp(lumiere.ciel, a);
  scene.fog.color.copy(scene.background);
}

function boucle(t) {
  const dt = Math.min(0.1, (t - avant) / 1000);
  avant = t;
  horloge.t += dt;
  for (const f of animations) f(dt, horloge.t);
  placerCamera(dt);
  camera.updateMatrixWorld();
  for (const f of apres) f(dt, horloge.t);
  renderer.render(scene, camera);
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
void _c;
