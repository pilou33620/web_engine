// La vie des quartiers (maquette maquettes/quartiers.html), sur les seuls bâtiments proches du centre du regard :
// fenêtres qui s'allument une à une et volets selon l'heure et le temps, ombres chinoises, voilages, gouttières, flaques, seaux,
// tuiles qui s'envolent, personnages de la saison et de la nuit (veilleur, allumeur, boulanger, coq, chats, hibou, chauves-souris),
// rues peuplées sur les joints des dalles et les routes (promeneurs, métiers, crieur, patrouille, attelages), marché et école.
// Ailleurs, la vie plus légère de vie.js continue. Les décors fixes de la saison sont dans le maillage des bâtiments (modeles.js) ;
// ici, seulement ce qui bouge ou s'allume. Personnages : petits modèles en boîtes (unités de web_power, réduits par ECH) regroupés
// en InstancedMesh par modèle (troupe de vie.js), reconstruits quand le voisinage du regard change.
import { THREE, scene, chaqueImage, hache, cam, camera, posCase, voisins } from './scene.js';
import * as P from './plateau.js';
import * as M from './monde.js';
import { climat, troupe, PROCHES, remplirFenetres, bouffee } from './vie.js';
import { caseVisible } from './brouillard.js';
import { toon, boite, cyl, cone, sphere } from './toon.js';
import { piecesMarche, casesMarelle, ETALS, ROND, QUARTIER } from './modeles.js';

const ECH = 0.04, ECH_BAT = 0.1, DALLE = 0.025;
const RAYON = 2.6, MAX_BATS = 10, D_MAX = 30; // le voisinage du regard : bâtiments à moins de RAYON du centre, les MAX_BATS plus proches, caméra à moins de D_MAX
const MAX_PERSOS = 170, MAX_PARTS = 600;
const VITRE = 0x3a4652, BOIS = 0x5b3a1e;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AXE_Y = V(0, 1, 0), UN = V(1, 1, 1);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _p = V(), _v = V(), _w = V(), _col = new THREE.Color(), _e = new THREE.Euler();
const tache = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.6)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const ROOT = new THREE.Group(); scene.add(ROOT);

// ------------------------------------------------------------------ le temps qu'il fait et l'heure (climat, tenu par meteo.js)
let ETAT = null, EPOQUE = 'ancien', SAISON = 2, MOIS = 3, METEO = 'beau', tMeteo = 99, t = 0, FLAQUE = 0, VENT = 0.3, VENT_X = 0.03, VENT_Z = 0;
const H = { phase: 'jour', p: 0 };
const METEO_DE = { soleil: 'beau', gel: 'beau', nuages: 'nuageux' };
const PLUVIEUX = () => METEO === 'pluie' || METEO === 'orage' || METEO === 'tempete';
const PLUIE = () => climat.pluie && !climat.neige;
const NEIGE_SOL = () => !!climat.neigeSol;
const SEC = () => !PLUVIEUX() && METEO !== 'neige';
const DOUX = () => METEO === 'beau' || METEO === 'nuageux';
const CLAIR = () => ({ beau: 1, canicule: 1, nuageux: 0.45 })[METEO] || 0;
const JOUR = () => H.phase === 'jour', SOIR = () => H.phase === 'crepuscule', NUIT = () => H.phase === 'nuit', AUBE = () => H.phase === 'aube';
const DEHORS = () => JOUR() || (AUBE() && H.p > 12) || (SOIR() && H.p < 14); // les heures où l'on est dehors
const ORAGEUX = () => METEO === 'orage' || METEO === 'tempete';
// la phase de la lune suit le mois du tour (0 nouvelle, 0,5 pleine) : huit phases sur l'année
const PHASE_LUNE = m => ((m + 4) % 8) / 8;

// ------------------------------------------------------------------ repères des bâtiments proches (coordonnées locales de web_power → monde)
let BATS = []; // { b, cle, id, M, x, y, z, th, cos, sin, rel, case }
const posB = (k, lx, lz) => ({ x: k.x + (lx * k.cos + lz * k.sin) * ECH_BAT, z: k.z + (-lx * k.sin + lz * k.cos) * ECH_BAT });
const pres = (k, lx, lz) => { const p = posB(k, lx, lz); return { x: p.x, z: p.z, y: k.y + DALLE }; };
const capB = (k, dx, dz) => k.th - Math.atan2(dz, dx); // cap d'un modèle (face à +x) qui regarde la direction locale (dx, dz)
const monde = (k, x, y, z) => V(x, y, z).applyMatrix4(k.M);
const cadre = (k, x, y, z, ry) => new THREE.Matrix4().multiplyMatrices(k.M, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(AXE_Y, ry), UN));
const dansCadre = (Mc, x, y, z) => V(x, y, z).applyMatrix4(Mc);
/** Une pièce accrochée à un cadre (fenêtre, porte, toit) : le cadre est en unités de web_power, le modèle aussi (échelle 1 = 0,1 dans le monde). */
function surCadre(o, Mc, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) { _m.copy(Mc).multiply(_m2.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(s, s, s))); _m.decompose(o.position, o.quaternion, o.scale); }

// ------------------------------------------------------------------ pièces dynamiques en InstancedMesh (une seule passe de dessin par sorte)
const BOITE1 = new THREE.BoxGeometry(1, 1, 1);
function mkInst(geo, mat, n, couleurs = false) { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.visible = false; if (couleurs) { m.setColorAt(0, _col.set(0xffffff)); for (let i = 1; i < n; i++) m.setColorAt(i, _col); } scene.add(m); return m; }
const fin = m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.visible = m.count > 0; };
const NF = 700;
const VITRES = mkInst(BOITE1, new THREE.MeshBasicMaterial({ color: 0xffffff }), NF, true); // la vitre, posée juste devant celle du modèle : éteinte, allumée, rideau, ouverte
const VOLETS = mkInst(BOITE1, toon(0xffffff), NF * 2, true);
const VOILES = mkInst(BOITE1, toon(0xf6f2ea, { side: THREE.DoubleSide }), NF);
const SILS = mkInst(BOITE1, new THREE.MeshBasicMaterial({ color: 0x2a1a10 }), 120);
const FLAQUES = mkInst(new THREE.CylinderGeometry(1, 1, 0.002, 14), toon(0x7f9db3), 160);
// points lumineux (additifs) : un point n'a qu'une profondeur, on l'avance vers la caméra pour que le mur qui le porte ne le coupe pas
function lueurs(n, taille, avance) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setDrawRange(0, 0);
  const o = new THREE.Points(g, new THREE.PointsMaterial({ map: tache, size: taille, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  o.frustumCulled = false; scene.add(o); o.nb = 0;
  o.mettre = (p, c, k = 1) => { if (o.nb >= n) return; _w.copy(camera.position).sub(p).setLength(avance).add(p); g.attributes.position.setXYZ(o.nb, _w.x, _w.y, _w.z); g.attributes.color.setXYZ(o.nb++, c.r * k, c.g * k, c.b * k); };
  o.fin = () => { g.setDrawRange(0, o.nb); g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; o.visible = o.nb > 0; o.nb = 0; };
  return o;
}
const HALO = lueurs(900, 0.13, 0.07), GRAND = lueurs(80, 0.36, 0.14), PETIT = lueurs(60, 0.03, 0.01);
// particules : boules de neige, poussière, copeaux, tuiles, gouttes, ondes sonores, ronds dans l'eau
const PI = {
  boule: mkInst(new THREE.IcosahedronGeometry(1, 0), toon(0xffffff), 500, true),
  plaque: mkInst(BOITE1, toon(0xffffff), 300, true),
  son: mkInst(new THREE.RingGeometry(0.82, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 60, true),
  ride: mkInst(new THREE.RingGeometry(0.7, 1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), 120, true),
};
const parts = [];
function particule(o) { if (parts.length < MAX_PARTS) parts.push({ age: 0, vie: 1, g: 0, vx: 0, vy: 0, vz: 0, s: 0.01, genre: 'boule', col: 0xffffff, spin: 0, ...o }); }
const C_FLAQUE = new THREE.Color(0x7f9db3), NOIR = new THREE.Color(0);
function majParticules(dt) {
  const n = { boule: 0, plaque: 0, son: 0, ride: 0 };
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt;
    if (p.age > p.vie) { parts.splice(i, 1); if (p.fin) p.fin(p); continue; }
    p.vy -= p.g * dt; p.x += (p.vx + (p.vent ? VENT_X * p.vent : 0)) * dt; p.y += p.vy * dt; p.z += (p.vz + (p.vent ? VENT_Z * p.vent : 0)) * dt;
    if (p.sol != null && p.y < p.sol) { p.y = p.sol; p.vx *= 0.2; p.vz *= 0.2; p.vy = 0; p.spin = 0; p.vent = 0; }
  }
  for (const p of parts) {
    const m = PI[p.genre], k = n[p.genre]; if (k >= m.instanceMatrix.count) continue;
    const u = p.age / p.vie;
    if (p.genre === 'son') { const s = p.s * (0.35 + u * 1.8); _m.compose(_p.set(p.x, p.y, p.z), camera.quaternion, _s.set(s, s, s)); m.setColorAt(k, _col.setHex(p.col).lerp(NOIR, u)); }
    else if (p.genre === 'ride') { const s = p.s * (0.25 + u); _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s, s)); m.setColorAt(k, _col.setHex(0xe6f2fa).lerp(C_FLAQUE, u)); }
    else { const s = p.s * (p.grandit ? 1 + u * p.grandit : 1); _q.setFromEuler(_e.set(p.age * p.spin, p.age * p.spin * 0.7, p.rz || 0)); _m.compose(_p.set(p.x, p.y, p.z), _q, p.forme ? _s.set(p.forme[0] * s, p.forme[1] * s, p.forme[2] * s) : _s.set(s, s, s)); m.setColorAt(k, _col.setHex(p.col)); }
    m.setMatrixAt(k, _m); n[p.genre]++;
  }
  for (const g in PI) { PI[g].count = n[g]; fin(PI[g]); }
}
// filets d'eau des avant-toits
const RUISS_L = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3 * 6), 3)), new THREE.LineBasicMaterial({ color: 0xcfe6f8, transparent: true, opacity: 0.9 }));
RUISS_L.frustumCulled = false; RUISS_L.visible = false; scene.add(RUISS_L);

// ------------------------------------------------------------------ la lune dans un coin du ciel (sa phase suit le mois), étoiles filantes des nuits d'été
// La caméra regarde vers le sol : il n'y a pas de ciel dans le cadre ; la lune et les filantes sont posées devant la caméra, comme dans la maquette.
const TEX_LUNE = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; return new THREE.CanvasTexture(c); })();
let phaseDessinee = -1;
function dessinerLune(f) {
  if (f === phaseDessinee) return; phaseDessinee = f;
  const c = TEX_LUNE.image, g = c.getContext('2d'), R = 54, img = g.createImageData(128, 128), k = Math.cos(2 * Math.PI * f);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = x - 63.5, dy = y - 63.5, d = Math.hypot(dx, dy); if (d > R + 1) continue;
    const hw = Math.sqrt(Math.max(0, R * R - dy * dy)), lit = f < 0.5 ? dx > hw * k : dx < -hw * k, a = Math.min(1, R + 1 - d), o = (y * 128 + x) * 4;
    const mer = hache(x >> 3, y >> 3, 5) < 0.18 ? 0.86 : 1; // quelques mers lunaires
    if (lit) img.data.set([246 * mer, 241 * mer, 214 * mer, 255 * a], o); else img.data.set([40, 48, 76, 120 * a], o);
  }
  g.putImageData(img, 0, 0); TEX_LUNE.needsUpdate = true;
}
const LUNE = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_LUNE, transparent: true, fog: false, depthWrite: false, depthTest: false }));
LUNE.renderOrder = 10;
const HALO_LUNE = new THREE.Sprite(new THREE.SpriteMaterial({ map: tache, color: 0x9fb4ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, depthTest: false }));
HALO_LUNE.renderOrder = 9;
const FILANTE = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, depthTest: false }));
FILANTE.frustumCulled = false; FILANTE.renderOrder = 10;
camera.add(HALO_LUNE, LUNE, FILANTE);
if (!camera.parent) scene.add(camera);
for (const o of [LUNE, HALO_LUNE, FILANTE]) o.visible = false;
const fil = { t: 2, x: 0, y: 0, vx: 0, vy: 0 };
function majCiel(dt) {
  const nuit = Math.min(1, (climat.nuit || 0) + (climat.aube || 0) * 0.35) * CLAIR();
  const f = PHASE_LUNE(MOIS); dessinerLune(f);
  const D = 100, hh = D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
  LUNE.visible = HALO_LUNE.visible = nuit > 0.02 && f !== 0;
  LUNE.position.set(hw - hh * 0.24, hh * 0.62, -D); LUNE.scale.setScalar(hh * 0.16); LUNE.material.opacity = Math.min(1, nuit * 1.3);
  HALO_LUNE.position.set(hw - hh * 0.24, hh * 0.62, -D - 1); HALO_LUNE.scale.setScalar(hh * 0.55 * (0.4 + Math.sin(f * Math.PI))); HALO_LUNE.material.opacity = 0.25 * nuit;
  fil.t -= dt;
  const actif = NUIT() && SAISON === 2 && CLAIR() >= 1;
  if (actif && fil.t <= 0 && fil.t > -0.7) {
    if (!fil.vx) { fil.x = (Math.random() * 1.2 - 0.6) * hw; fil.y = hh * (0.3 + Math.random() * 0.35); const a = -0.35 - Math.random() * 0.5; fil.vx = Math.cos(a) * hw * 1.6 * (Math.random() < 0.5 ? 1 : -1); fil.vy = Math.sin(a) * hw * 1.6; }
    const u = -fil.t, x = fil.x + fil.vx * u, y = fil.y + fil.vy * u, p = FILANTE.geometry.attributes.position;
    p.setXYZ(0, x, y, -D + 2); p.setXYZ(1, x - fil.vx * 0.12, y - fil.vy * 0.12, -D + 2); p.needsUpdate = true;
    FILANTE.material.opacity = Math.sin(u / 0.7 * Math.PI); FILANTE.visible = true;
  } else { FILANTE.visible = false; if (fil.t <= -0.7) { fil.t = 3 + Math.random() * 4; fil.vx = 0; } if (!actif && fil.t < 0) fil.t = 1; }
}

// ------------------------------------------------------------------ personnages et bêtes (unités de web_power, face à +x)
const PATTES = (dx, dz, h, w, c) => [[-dx, -dz], [-dx, dz], [dx, -dz], [dx, dz]].map(([x, z]) => [boite(w, h, w), x, h / 2, z, c]);
const PEAU = 0xf0c9a0, NOIR_H = 0x1f1f24;
const PAYSAN = (chemise, chapeau = 0xd9b45a) => [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x5a4632], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x5a4632], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, chemise], [sphere(0.28, 1), 0.02, 2.1, 0, PEAU], [cyl(0.55, 0.55, 0.08, 10), 0, 2.36, 0, chapeau], [cyl(0.25, 0.3, 0.25, 8), 0, 2.5, 0, chapeau]];
const TETE_NUE = c => PAYSAN(c).slice(0, 4);
const FEMME = (jupe, haut = 0xe9e2d0) => [[boite(0.7, 0.9, 0.7), 0, 0.45, 0, jupe], [boite(0.5, 0.6, 0.6), 0, 1.2, 0, haut], [sphere(0.28, 1), 0.02, 1.75, 0, PEAU], [boite(0.4, 0.16, 0.45), 0, 2.02, 0, 0xf6f2ea]];
const ENFANT = (c, bonnet) => [...TETE_NUE(c), ...(bonnet ? [[cone(0.3, 0.42, 6), 0.02, 2.48, 0, bonnet], [boite(0.55, 0.14, 0.8), 0, 1.78, 0, bonnet]] : [])];
const PARAPLUIE = (c, toile) => [...PAYSAN(c, 0x2b2b30), [boite(0.06, 1.2, 0.06), 0.28, 2.15, 0.2, 0x3a2a20], [cone(1.05, 0.42, 8), 0.28, 2.95, 0.2, toile], [boite(0.08, 0.08, 0.08), 0.28, 3.2, 0.2, 0x3a2a20]];
const CHAT = c => [[boite(0.75, 0.32, 0.28), 0, 0.4, 0, c], [boite(0.3, 0.3, 0.3), 0.46, 0.62, 0, c], [boite(0.07, 0.13, 0.08), 0.46, 0.83, 0.09, c], [boite(0.07, 0.13, 0.08), 0.46, 0.83, -0.09, c], [boite(0.07, 0.55, 0.07).rotateZ(0.55), -0.5, 0.64, 0, c], ...PATTES(0.28, 0.09, 0.26, 0.08, c)];
const ASSIS = (c, femme) => femme
  ? [[boite(0.7, 0.3, 0.7), 0.15, 0.8, 0, c], [boite(0.3, 0.68, 0.6), 0.4, 0.34, 0, c], [boite(0.5, 0.6, 0.6), -0.05, 1.25, 0, 0xe9e2d0], [sphere(0.28, 1), -0.03, 1.8, 0, PEAU], [boite(0.4, 0.16, 0.45), -0.03, 2.07, 0, 0xf6f2ea]]
  : [[boite(0.6, 0.22, 0.5), 0.2, 0.78, 0, 0x5a4632], [boite(0.22, 0.68, 0.45), 0.45, 0.34, 0, 0x5a4632], [boite(0.5, 0.85, 0.72), -0.05, 1.28, 0, c], [sphere(0.28, 1), -0.03, 1.96, 0, PEAU]];
const MODELES = {
  passant0: PAYSAN(0x6a8aa4), passant1: PAYSAN(0xc0504a, 0x5a4632), passante0: FEMME(0x8a4a7a, 0xf2e6c8), passante1: FEMME(0x5a7a4a),
  commere0: FEMME(0x4a6a9a), commere1: FEMME(0xb8603f, 0xf6f2ea),
  enfant0: ENFANT(0xd9533a), enfant1: ENFANT(0x3a8ad9), enfant2: ENFANT(0xe0c040),
  enfantH0: ENFANT(0xd9533a, 0xf6f2ea), enfantH1: ENFANT(0x3a8ad9, 0xd9322a), enfantH2: ENFANT(0x5a8a3a, 0xe0c040), enfantH3: ENFANT(0x8a4a7a, 0x3a6ad9),
  sac: [...TETE_NUE(0xc9b28a), [boite(0.95, 0.3, 0.95), 0, 2.42, 0, 0x9a7a4a], [boite(0.25, 0.85, 0.95), -0.38, 1.95, 0, 0x9a7a4a]], // un sac sur la tête sous la pluie, en 1700
  parapluieVert: PARAPLUIE(0x6a8aa4, 0x3f7a4a), parapluieRouge: PARAPLUIE(0x8a4a7a, 0xc0403a), parapluieNoir: PARAPLUIE(0x3a3a46, 0x1f1f24), parapluieNoir2: PARAPLUIE(0x6a5a4a, 0x2a2a30),
  pelleteur: [...PAYSAN(0x7a3a3a, 0x3a3046), [boite(0.07, 1.5, 0.07).rotateZ(0.9), 0.55, 1.05, 0.3, 0x5b3a1e], [boite(0.5, 0.06, 0.45), 1.15, 0.5, 0.3, 0x8a8f96]],
  veilleur: [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x3a3030], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x3a3030], [boite(0.62, 1.15, 0.85), 0, 1.4, 0, 0x3a3446], [sphere(0.28, 1), 0.02, 2.1, 0, PEAU], [cone(0.55, 0.32, 3), 0, 2.42, 0, 0x1f1f1f], [boite(0.06, 0.5, 0.06), 0.45, 1.45, 0.38, 0x2b2b30], [boite(0.26, 0.32, 0.26), 0.45, 1.1, 0.38, 0xffd36a], [boite(0.07, 2.9, 0.07), 0.1, 1.45, -0.42, 0x5b3a1e], [cone(0.12, 0.42, 5), 0.1, 3.0, -0.42, 0xd9d9d9]],
  cloche: [[cone(0.2, 0.3, 8), 0, -0.15, 0, 0xb08d57], [boite(0.05, 0.25, 0.05), 0, 0.1, 0, 0x5b3a1e]],
  allumeur: [...PAYSAN(0x3a3a4a, 0x2b2b30), [boite(0.06, 2.2, 0.06), 0.35, 2, 0.2, 0x5b3a1e], [boite(0.14, 0.14, 0.14), 0.35, 3.1, 0.2, 0xffd36a]],
  porteLanterne: [...PAYSAN(0x5a5a6a, 0x3a3046), [boite(0.06, 0.55, 0.06), 0.55, 1.7, 0.3, 0x2b2b30], [boite(0.26, 0.32, 0.26), 0.55, 1.3, 0.3, 0xffd36a]],
  chat0: CHAT(0x2a2628), chat1: CHAT(0xd98a3a),
  hibou: [[boite(0.5, 0.7, 0.5), 0, 0.35, 0, 0x8a6a4a], [boite(0.42, 0.5, 0.42), 0.04, 0.35, 0, 0xd9c8a0], [boite(0.55, 0.42, 0.5), 0.02, 0.9, 0, 0x9a7a5a], [boite(0.05, 0.14, 0.14), 0.3, 0.95, 0.12, 0xffd34d], [boite(0.05, 0.14, 0.14), 0.3, 0.95, -0.12, 0xffd34d], [boite(0.1, 0.1, 0.06), 0.32, 0.82, 0, 0xd9a43a], [boite(0.1, 0.2, 0.08), 0.05, 1.18, 0.18, 0x7a5a3a], [boite(0.1, 0.2, 0.08), 0.05, 1.18, -0.18, 0x7a5a3a]],
  chauvesouris: [[boite(0.35, 0.2, 0.2), 0, 0, 0, 0x2a2228], [boite(0.5, 0.04, 0.6), -0.05, 0, 0.38, 0x3a3038], [boite(0.5, 0.04, 0.6), -0.05, 0, -0.38, 0x3a3038], [boite(0.08, 0.14, 0.06), 0.18, 0.13, 0.06, 0x2a2228], [boite(0.08, 0.14, 0.06), 0.18, 0.13, -0.06, 0x2a2228]],
  hirondelle: [[boite(0.6, 0.16, 0.18), 0, 0, 0, 0x1f2a4a], [boite(0.42, 0.08, 0.15), 0.04, -0.08, 0, 0xf4f1ea], [boite(0.14, 0.12, 0.14), 0.36, 0.03, 0, 0xb8322a], [boite(0.38, 0.04, 0.06), -0.45, 0, 0.07, 0x1f2a4a], [boite(0.38, 0.04, 0.06), -0.45, 0, -0.07, 0x1f2a4a], [boite(0.32, 0.04, 1.4), 0.02, 0.02, 0, 0x1f2a4a]],
  coq: [[boite(0.6, 0.45, 0.35), 0, 0.55, 0, 0xb8502a], [boite(0.25, 0.38, 0.2), 0.3, 0.9, 0, 0xd9a43a], [boite(0.12, 0.16, 0.06), 0.33, 1.15, 0, 0xd9322a], [boite(0.13, 0.06, 0.06), 0.47, 0.92, 0, 0xf2b33d], [boite(0.08, 0.14, 0.05), 0.35, 0.77, 0, 0xd9322a], [boite(0.25, 0.62, 0.12).rotateZ(0.4), -0.38, 0.86, 0, 0x1f4a3a], [boite(0.06, 0.32, 0.06), 0, 0.16, 0.08, 0xf2b33d], [boite(0.06, 0.32, 0.06), 0, 0.16, -0.08, 0xf2b33d]],
  rateleur: [...PAYSAN(0x5a6a3a), [boite(0.06, 2.0, 0.06).rotateZ(-0.75), 0.75, 1.1, 0.3, 0x8b5a2b], [boite(0.1, 0.12, 0.75), 1.45, 0.38, 0.3, 0x6b6f75]],
  fendeur: [...PAYSAN(0x8a3a2a), [boite(0.08, 1.3, 0.08).rotateZ(-0.5), 0.6, 1.6, 0.28, 0x5b3a1e], [boite(0.08, 0.3, 0.32), 0.95, 2.1, 0.28, 0xb8b8b8]],
  porteurBois: [...PAYSAN(0x6a4a3a, 0x5a4632), [cyl(0.22, 0.22, 0.95, 6).rotateX(Math.PI / 2), 0.42, 1.3, 0, 0xa0703f], [cyl(0.22, 0.22, 0.95, 6).rotateX(Math.PI / 2), 0.42, 1.68, 0, 0xa0703f]],
  boulanger: [...TETE_NUE(0xf6f2ea), [cyl(0.3, 0.26, 0.5, 8), 0.02, 2.55, 0, 0xffffff], [boite(0.7, 0.3, 0.62), 0.48, 1.38, 0, 0xb08040], [sphere(0.18, 0).scale(1.6, 0.7, 1), 0.48, 1.58, 0.12, 0xd9a45a], [sphere(0.18, 0).scale(1.6, 0.7, 1), 0.48, 1.58, -0.16, 0xd9a45a]],
  jardinier: [...PAYSAN(0x7a8a4a), [boite(0.45, 0.38, 0.28), 0.48, 1.0, 0.3, 0x6b8a9a], [boite(0.45, 0.06, 0.06).rotateZ(-0.6), 0.82, 1.12, 0.3, 0x6b8a9a]],
  assis0: ASSIS(0x6a8aa4), assis1: ASSIS(0x8a4a7a, true), assis2: ASSIS(0xc0504a), assis3: ASSIS(0x5a7a4a, true),
  buveur0: [...PAYSAN(0x8a5a3a, 0x5a4632), [cyl(0.14, 0.14, 0.3, 8), 0.42, 1.5, 0.3, 0xd9c08a]], buveur1: [...PAYSAN(0x4a6a5a), [cyl(0.14, 0.14, 0.3, 8), 0.42, 1.5, 0.3, 0xd9c08a]], buveur2: PAYSAN(0x7a3a6a, 0x2b2b30),
  tapis0: [[boite(0.95, 1.15, 0.04), 0, -0.58, 0, 0xb8322a], [boite(0.72, 0.9, 0.045), 0, -0.58, 0, 0xe0b040], [boite(0.5, 0.65, 0.05), 0, -0.58, 0, 0x3a5a8a]],
  tapis1: [[boite(0.95, 1.15, 0.04), 0, -0.58, 0, 0x3a6a4a], [boite(0.72, 0.9, 0.045), 0, -0.58, 0, 0xe8dcc0], [boite(0.5, 0.65, 0.05), 0, -0.58, 0, 0x8a3a2a]],
  seau: [[cyl(0.24, 0.18, 0.36, 8), 0, 0.18, 0, 0x8a6a4a], [cyl(0.2, 0.2, 0.02, 8), 0, 0.33, 0, 0x5fa8d8]], // sous la fuite de la chaumière
  ...Object.fromEntries([0xf6f2ea, 0x9fc4e8, 0xf2d6d6, 0xe8dcc0].map((c, j) => [`drap${j}`, [[boite(0.5, 0.6, 0.02), 0, -0.3, 0, c]]])), // le linge, pendu par le haut
};
// ---- les gens de la rue selon l'époque (bourgeois, soldats, maîtres d'école, crieur) ; les paysans gardent PAYSAN et FEMME
const TETE = (y, x = 0.02) => [sphere(0.28, 1), x, y, 0, PEAU];
const CHAPEAUX = {
  tricorne: (y = 2.4, c = NOIR_H) => [[cyl(0.62, 0.66, 0.2, 3).rotateY(Math.PI / 2), 0, y, 0, c]],
  bicorne: (y = 2.4, c = NOIR_H) => [[boite(0.22, 0.38, 1.15), 0, y + 0.06, 0, c], [boite(0.36, 0.1, 0.8), 0, y - 0.08, 0, c]],
  hautDeForme: (y = 2.34, c = NOIR_H) => [[cyl(0.44, 0.44, 0.06, 10), 0, y, 0, c], [cyl(0.25, 0.27, 0.62, 10), 0, y + 0.33, 0, c]],
  shako: (y = 2.36) => [[cyl(0.3, 0.26, 0.56, 8), 0, y + 0.26, 0, NOIR_H], [boite(0.22, 0.04, 0.42), 0.24, y + 0.02, 0, NOIR_H], [sphere(0.12, 0), 0.02, y + 0.62, 0, 0xc0302a]],
  kepi: (y = 2.34) => [[cyl(0.25, 0.29, 0.32, 8), 0, y + 0.14, 0, 0xb8322a], [cyl(0.295, 0.295, 0.1, 8), 0, y + 0.02, 0, 0x2f3f6a], [boite(0.2, 0.04, 0.4), 0.27, y - 0.02, 0, NOIR_H]],
};
const SAC_TETE = (y = 2.42) => [[boite(0.95, 0.3, 0.95), 0, y, 0, 0x9a7a4a], [boite(0.25, 0.85, 0.95), -0.38, y - 0.47, 0, 0x9a7a4a]];
const OMBRELLE = (toile, y = 3.25) => [[boite(0.06, 1.45, 0.06), 0.28, y - 0.85, 0.22, 0x3a2a20], [cone(1.05, 0.42, 8), 0.28, y, 0.22, toile], [boite(0.08, 0.08, 0.08), 0.28, y + 0.25, 0.22, 0x3a2a20]];
const JAMBES = (bas, haut) => [-0.16, 0.16].flatMap(z => [[boite(0.28, 0.48, 0.22), 0, 0.24, z, bas], [boite(0.3, 0.44, 0.24), 0, 0.68, z, haut]]);
const HABITS = { ancien: [0x8a3a2a, 0x4a5a3a], lumieres: [0x6a4a8a, 0x3a6a8a], empire: [0x2f3f6a, 0x5a3a2a], industrie: [0x2a2a30, 0x4a4038] };
const ROBES = { ancien: [0xb8604a, 0x6a8ab8], lumieres: [0xe8a0b0, 0x9fc4a8], empire: [0xf2eee4, 0xe8d8a8], industrie: [0x6a3a5a, 0x3a5a6a] };
const TOILES = { lumieres: [0x3f7a4a, 0xc0403a], empire: [0x3f7a4a, 0xc0403a], industrie: [NOIR_H, 0x2a2a30] };
/** Un bourgeois de l'époque : habit, culotte et tricorne (1700, Lumières), redingote et bicorne (Empire), redingote et haut-de-forme (Industrie). */
function HOMME(ep, i, pluie = false, habit = HABITS[ep][i]) {
  const vieux = ep === 'ancien' || ep === 'lumieres';
  const corps = vieux ? [...JAMBES(0xece6d8, i ? 0x5a4632 : 0x3a3030), [boite(0.55, 1.2, 0.8), 0, 1.22, 0, habit], [boite(0.06, 0.62, 0.36), 0.29, 1.4, 0, 0xe9dcb0]]
    : ep === 'empire' ? [...JAMBES(NOIR_H, 0xe8e0c8), [boite(0.56, 1.3, 0.8), 0, 1.17, 0, habit], [boite(0.3, 0.16, 0.5), 0.08, 1.86, 0, 0xf6f2ea]]
      : [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x4a4a52], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x4a4a52], [boite(0.56, 1.25, 0.8), 0, 1.2, 0, habit], [boite(0.3, 0.14, 0.46), 0.08, 1.84, 0, 0xf6f2ea]];
  const sac = pluie && (ep === 'ancien' || (ep === 'lumieres' && i === 0));
  const chapeau = sac ? SAC_TETE() : vieux ? CHAPEAUX.tricorne() : ep === 'empire' ? CHAPEAUX.bicorne() : CHAPEAUX.hautDeForme();
  return [...corps, TETE(2.1), ...chapeau, ...(pluie && !sac ? OMBRELLE(TOILES[ep][i]) : [])];
}
/** Une bourgeoise : robe à paniers (1700, Lumières, coiffure haute aux Lumières), robe Empire à taille haute et capote, crinoline et petit chapeau. */
function DAME(ep, i, pluie = false, robe = ROBES[ep][i]) {
  let corps, coiffe;
  if (ep === 'ancien' || ep === 'lumieres') {
    corps = [[boite(0.8, 0.95, 1.35), 0, 0.48, 0, robe], [boite(0.42, 0.62, 0.55), 0, 1.26, 0, robe], [boite(0.44, 0.16, 0.6), 0.02, 1.48, 0, 0xf6f2ea]];
    coiffe = ep === 'ancien' ? [[boite(0.4, 0.2, 0.45), 0, 2.12, 0, 0xf6f2ea]] : [[boite(0.38, 0.42, 0.42), -0.02, 2.22, 0, 0xe4e0d8], [sphere(0.1, 0), 0.1, 2.42, 0.14, 0xd9322a]];
  } else if (ep === 'empire') {
    corps = [[boite(0.55, 1.38, 0.62), 0, 0.69, 0, robe], [boite(0.58, 0.09, 0.65), 0, 1.4, 0, i ? 0xc0403a : 0x3a6ad9], [boite(0.42, 0.32, 0.5), 0, 1.58, 0, robe]];
    coiffe = [[boite(0.46, 0.4, 0.56), -0.04, 2.1, 0, i ? 0xc0403a : 0x3a6ad9], [boite(0.14, 0.44, 0.62), 0.24, 2.06, 0, i ? 0xc0403a : 0x3a6ad9]];
  } else {
    corps = [[cyl(0.34, 0.86, 1.05, 12), 0, 0.53, 0, robe], [boite(0.42, 0.62, 0.5), 0, 1.36, 0, robe], [boite(0.44, 0.1, 0.52), 0.01, 1.62, 0, NOIR_H]];
    coiffe = [[cyl(0.3, 0.33, 0.13, 10), 0, 2.12, 0, NOIR_H], [sphere(0.11, 0), -0.12, 2.22, 0.18, 0xd9a43a]];
  }
  const sac = pluie && (ep === 'ancien' || (ep === 'lumieres' && i === 0));
  return [...corps, TETE(1.85), ...(sac ? SAC_TETE(2.12) : coiffe), ...(pluie && !sac ? OMBRELLE(TOILES[ep][i], 2.95) : [])];
}
/** Un écolier : couleurs vives (1700, Lumières), blouse bleue (Empire), blouse noire, casquette et cartable (Industrie) ; bûche pour le poêle l'hiver. */
function ECOLIER(ep, i, buche = false) {
  const c = ep === 'empire' ? [0x4a6aa8, 0x3a5a98][i] : ep === 'industrie' ? [0x2a2a30, 0x3a3a44][i] : [0xd9533a, 0x3a8ad9][i];
  return [...TETE_NUE(c), ...(ep === 'industrie' ? [[cyl(0.3, 0.3, 0.12, 8), 0, 2.38, 0, 0x2f3f6a], [boite(0.2, 0.04, 0.34), 0.27, 2.34, 0, 0x2f3f6a], [boite(0.22, 0.5, 0.55), -0.36, 1.45, 0, 0x8a5a2b]]
    : ep === 'empire' ? [[boite(0.52, 0.12, 0.77), 0, 1.78, 0, 0xf6f2ea]] : i ? [[cone(0.3, 0.42, 6), 0.02, 2.48, 0, 0xe0c040]] : []),
  ...(buche ? [[cyl(0.18, 0.18, 0.8, 6).rotateX(Math.PI / 2), 0.4, 1.35, 0, 0xa0703f]] : [])];
}
const PANIER = (x = 0.12, z = 0.46, y = 1.0) => [[boite(0.45, 0.3, 0.36), x, y, z, 0xa8804a], [boite(0.05, 0.32, 0.05), x, y + 0.3, z, 0x8a6a3a], [sphere(0.1, 0), x + 0.08, y + 0.18, z, 0xd9322a]];
/** Le soldat de la patrouille : habit blanc et tricorne (1700), habit blanc à revers bleus (Lumières), habit bleu et shako (Empire), capote bleue, pantalon garance et képi (Industrie). */
function SOLDAT(ep) {
  const fusil = [[boite(0.07, 1.7, 0.07).rotateZ(0.12), -0.02, 2.0, 0.42, 0x5b3a1e], [boite(0.03, 0.4, 0.03), -0.1, 3.0, 0.42, 0xc8ccd0]];
  if (ep === 'industrie') return [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0xb8322a], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0xb8322a], [boite(0.58, 1.35, 0.82), 0, 1.15, 0, 0x3f4f7a], TETE(2.1), ...CHAPEAUX.kepi(), ...fusil];
  const habit = ep === 'empire' ? 0x2f4a8a : 0xe4e0d4;
  return [...JAMBES(NOIR_H, 0xece6d8), [boite(0.55, 1.2, 0.8), 0, 1.22, 0, habit], [boite(0.06, 0.62, 0.42), 0.29, 1.4, 0, ep === 'lumieres' ? 0x2f4a8a : ep === 'empire' ? 0xf6f2ea : 0xb8322a], TETE(2.1), ...(ep === 'empire' ? CHAPEAUX.shako() : CHAPEAUX.tricorne()), ...fusil];
}
/** Le maître : le curé en soutane (école de paroisse, 1700), le régent en tricorne (Lumières), l'instituteur en redingote (Empire, Industrie), une baguette à la main. */
function MAITRE(ep) {
  const baguette = [[boite(0.05, 0.05, 0.9).rotateX(0.5), 0.38, 1.35, 0.5, 0x5b3a1e]];
  if (ep === 'ancien') return [[boite(0.62, 1.85, 0.78), 0, 0.93, 0, NOIR_H], [boite(0.06, 0.22, 0.24), 0.32, 1.66, 0, 0xf6f2ea], TETE(2.1), [cyl(0.62, 0.62, 0.07, 12), 0, 2.36, 0, NOIR_H], [cyl(0.24, 0.27, 0.2, 10), 0, 2.48, 0, NOIR_H], ...baguette];
  return [...HOMME(ep, 0, false, ep === 'lumieres' ? 0x6a4a2a : NOIR_H), ...baguette];
}
/** Le crieur public : une feuille à lire ; une clochette (1700, Lumières), un tambour de ville (Empire, Industrie). */
function CRIEUR(ep) {
  const vieux = ep === 'ancien' || ep === 'lumieres';
  return [...HOMME(ep, 0, false, 0x8a2a2a), [boite(0.05, 0.55, 0.42), 0.46, 1.68, 0, 0xf6f2ea], ...(vieux ? [[cone(0.16, 0.24, 8), 0.4, 1.15, -0.42, 0xd9a43a]] : [[cyl(0.32, 0.32, 0.38, 10), 0.3, 1.0, 0.4, 0xc0403a], [cyl(0.33, 0.33, 0.06, 10), 0.3, 1.2, 0.4, 0xf6f2ea]])];
}
// ---- les bêtes et les attelages
const CHIEN = (c, oreille) => [[boite(0.85, 0.38, 0.32), 0, 0.56, 0, c], [boite(0.38, 0.34, 0.3), 0.5, 0.8, 0, c], [boite(0.2, 0.16, 0.18), 0.74, 0.74, 0, c], [boite(0.08, 0.2, 0.08), 0.44, 1.0, 0.1, oreille], [boite(0.08, 0.2, 0.08), 0.44, 1.0, -0.1, oreille], [boite(0.08, 0.42, 0.08).rotateZ(-0.6), -0.52, 0.82, 0, c], ...PATTES(0.3, 0.1, 0.4, 0.1, c)];
const POULE = c => [[boite(0.45, 0.35, 0.3), 0, 0.42, 0, c], [boite(0.2, 0.25, 0.16), 0.25, 0.68, 0, c], [boite(0.1, 0.08, 0.04), 0.27, 0.85, 0, 0xd9322a], [boite(0.08, 0.05, 0.05), 0.38, 0.68, 0, 0xf2b33d], [boite(0.15, 0.25, 0.12), -0.26, 0.62, 0, c], [boite(0.04, 0.24, 0.04), 0, 0.12, 0.06, 0xf2b33d], [boite(0.04, 0.24, 0.04), 0, 0.12, -0.06, 0xf2b33d]];
function CHEVAL(c, ox = 0, oz = 0, crin = 0x2a1f18, mince = 1) {
  return [[boite(1.9, 0.75, 0.7 * mince), ox, 1.45, oz, c], ...[[-0.7, -0.22], [-0.7, 0.22], [0.7, -0.22], [0.7, 0.22]].map(([x, z]) => [boite(0.2, 1.1, 0.2), ox + x, 0.55, oz + z * mince, c]),
    [boite(0.45, 0.95, 0.42).rotateZ(-0.55), ox + 1.0, 2.0, oz, c], [boite(0.8, 0.36, 0.34).rotateZ(-0.35), ox + 1.42, 2.36, oz, c], [boite(0.5, 0.12, 0.14).rotateZ(-0.55), ox + 0.86, 2.36, oz, crin], [boite(0.16, 0.8, 0.14).rotateZ(0.35), ox - 1.05, 1.32, oz, crin], [boite(0.08, 0.18, 0.08), ox + 1.2, 2.66, oz + 0.1, c], [boite(0.08, 0.18, 0.08), ox + 1.2, 2.66, oz - 0.1, c]];
}
const ROUE = (r, x, z, y = r) => [cyl(r, r, 0.1, 12).rotateX(Math.PI / 2), x, y, z, 0x3a2a20];
/** Le cavalier de l'époque sur son cheval bai. */
function CAVALIER(ep) {
  const h = HOMME(ep, 1), chapeau = h.filter(p => p[2] >= 2.3).map(([g, x, y, z, c]) => [g, x, y + 0.98, z, c]);
  return [...CHEVAL(0x7a4a2a), [boite(0.7, 0.12, 0.8), -0.05, 1.86, 0, 0x5a2a1e], [boite(0.25, 0.7, 0.2), 0.05, 1.62, 0.42, 0x3a3030], [boite(0.25, 0.7, 0.2), 0.05, 1.62, -0.42, 0x3a3030], [boite(0.5, 0.9, 0.72), -0.05, 2.38, 0, HABITS[ep][1]], TETE(3.08, -0.03), ...chapeau];
}
/** La calèche découverte (Empire) ou le fiacre fermé (Industrie), avec son cocher. */
function VOITURE(ep) {
  const cocher = ep === 'empire' ? CHAPEAUX.bicorne(3.32) : CHAPEAUX.hautDeForme(3.26);
  const base = [...CHEVAL(0x2a2224, 1.7, 0, 0x151012), [boite(1.3, 0.08, 0.08), 0.75, 1.35, 0.45, 0x3a2a20], [boite(1.3, 0.08, 0.08), 0.75, 1.35, -0.45, 0x3a2a20], ROUE(0.62, -1.45, 0.62), ROUE(0.62, -1.45, -0.62), ROUE(0.42, -0.25, 0.6), ROUE(0.42, -0.25, -0.6), [boite(0.5, 0.82, 0.72), -0.2, 2.4, 0, ep === 'empire' ? 0x2f3f6a : 0x2a2a30], TETE(3.02, -0.18), ...cocher.map(([g, x, y, z, c]) => [g, x - 0.2, y, z, c])];
  if (ep === 'empire') return [...base, [boite(1.7, 0.75, 1.15), -1.05, 1.35, 0, 0x3a6a4a], [boite(1.72, 0.08, 1.17), -1.05, 1.74, 0, 0xd9a43a], [boite(0.55, 0.65, 1.18), -1.75, 2.02, 0, NOIR_H], [boite(0.45, 0.6, 0.6), -1.2, 2.0, 0.2, ROBES.empire[0]], TETE(2.5, -1.2), [boite(0.46, 0.38, 0.5), -1.24, 2.76, 0.2, 0x3a6ad9]];
  return [...base, [boite(1.75, 1.35, 1.15), -1.1, 1.62, 0, 0x3a1f24], [boite(0.62, 0.46, 1.18), -1.0, 1.9, 0, 0xa8c0cc], [boite(1.9, 0.1, 1.25), -1.1, 2.33, 0, NOIR_H], [boite(0.16, 0.2, 0.16), -0.2, 1.7, 0.62, 0xffe08a], [boite(0.16, 0.2, 0.16), -0.2, 1.7, -0.62, 0xffe08a]];
}
/** L'omnibus à cheval de l'ère industrielle : deux chevaux, caisse jaune et bordeaux, voyageurs sur l'impériale. */
const OMNIBUS = () => [...CHEVAL(0xc8c4bc, 2.3, 0.42, 0x8a8680, 0.75), ...CHEVAL(0x7a4a2a, 2.3, -0.42, 0x2a1f18, 0.75),
  [boite(1.2, 0.1, 0.1), 1.0, 1.35, 0, 0x3a2a20], [boite(3.5, 0.55, 1.3), -1.4, 1.15, 0, 0x7a2a24], [boite(3.5, 0.95, 1.3), -1.4, 1.88, 0, 0xd9b13a], [boite(3.1, 0.42, 1.32), -1.4, 1.95, 0, 0xa8c0cc],
  [boite(3.7, 0.1, 1.42), -1.4, 2.4, 0, NOIR_H], [boite(3.1, 0.35, 0.3), -1.5, 2.62, 0, 0x5b3a1e], ...[-2.6, -1.8, -1.0].flatMap((x, i) => [TETE(2.95, x), ...CHAPEAUX.hautDeForme(3.2).map(([g, , y, z, c]) => [g, x, y, z, i === 1 ? 0x4a4038 : c])]),
  [boite(0.5, 0.8, 0.7), 0.15, 2.65, 0, NOIR_H], TETE(3.25, 0.17), ...CHAPEAUX.hautDeForme(3.5).map(([g, x, y, z, c]) => [g, x + 0.17, y, z, c]),
  ROUE(0.6, -2.6, 0.66), ROUE(0.6, -2.6, -0.66), ROUE(0.5, -0.2, 0.66), ROUE(0.5, -0.2, -0.66)];
// ---- les métiers de la rue
const PORTEUR_EAU = () => [...PAYSAN(0x7a6a5a, 0x5a4632), [boite(0.12, 0.12, 1.75), -0.05, 1.9, 0, 0x8a6a3a], [cyl(0.24, 0.2, 0.42, 8), 0, 1.0, 0.84, 0x8a6a4a], [cyl(0.24, 0.2, 0.42, 8), 0, 1.0, -0.84, 0x8a6a4a], [boite(0.03, 0.7, 0.03), 0, 1.55, 0.84, 0x3a2a20], [boite(0.03, 0.7, 0.03), 0, 1.55, -0.84, 0x3a2a20]];
const COLPORTEUR = () => [...PAYSAN(0x5a6a7a, 0x3a3046), [boite(0.48, 1.05, 0.78), -0.5, 1.75, 0, 0x8a6a3a], [boite(0.5, 0.18, 0.8), -0.5, 2.36, 0, 0xb8453a], [boite(0.06, 2.4, 0.06), 0.45, 1.2, 0.36, 0x5b3a1e]];
const REMOULEUR = () => [...PAYSAN(0x5a4a3a, 0x3a3030), ROUE(0.55, 1.35, 0), [boite(1.0, 0.08, 0.5), 1.0, 1.0, 0, BOIS], [cyl(0.34, 0.34, 0.14, 10).rotateX(Math.PI / 2), 1.0, 1.38, 0, 0xa8a8a8], [boite(0.85, 0.06, 0.06), 0.5, 1.1, 0.26, BOIS], [boite(0.85, 0.06, 0.06), 0.5, 1.1, -0.26, BOIS]];
const FRUITS = [[0x9fbf8a, 0xc9a86a, 0x7a4a2a], [0x8fcf5a, 0xd94f6a, 0xff7ab8], [0xa01a2a, 0xf0a040, 0xc9d070], [0xe07a1a, 0xc0302a, 0x6a3a7a]]; // hiver, printemps, été, automne
const CHARRETTE = s => [...FEMME(0x6a5a8a, 0xf2e6c8), [boite(1.3, 0.35, 0.95), 1.05, 0.95, 0, 0x9a6a3a], ROUE(0.42, 1.1, 0.56), ROUE(0.42, 1.1, -0.56), [boite(0.7, 0.06, 0.06), 0.3, 1.0, 0.34, BOIS], [boite(0.7, 0.06, 0.06), 0.3, 1.0, -0.34, BOIS],
  ...[0, 1, 2, 3, 4, 5].map(n => [sphere(n % 3 === 2 ? 0.2 : 0.15, 0), 0.65 + (n % 3) * 0.38, 1.25, n < 3 ? 0.22 : -0.22, FRUITS[s][n % 3]])];
const MARCHAND = (c, femme) => femme ? [...FEMME(c, 0xf2e6c8), [boite(0.1, 0.8, 0.62), 0.37, 0.75, 0, 0xf6f2ea]] : [...PAYSAN(c), [boite(0.12, 0.9, 0.6), 0.27, 1.1, 0, 0xf6f2ea]];
const CERCEAU = [[new THREE.TorusGeometry(0.55, 0.06, 4, 18), 0, 0.6, 0, 0xb07a45]];
const BALLON = [[sphere(0.28, 1), 0, 0, 0, 0xd9322a], [boite(0.58, 0.08, 0.58), 0, 0, 0, 0xf6f2ea]];
const CORDE = [[boite(0.26, 0.26, 4.4), 0, 1.25, 0, 0xf6f0d8], [boite(0.26, 1.25, 0.26), 0, 0.62, 2.2, 0xf6f0d8], [boite(0.26, 1.25, 0.26), 0, 0.62, -2.2, 0xf6f0d8]];
/** Un modèle nommé, assemblé à la première demande (seules les tenues de l'époque affichée sont assemblées). */
const mod = (nom, f) => { if (!MODELES[nom]) MODELES[nom] = f(); return nom; };
const TROUPE = troupe(MODELES, MAX_PERSOS, false); // sans ombre portée : à cette taille, elle coûterait une passe de plus par modèle pour presque rien

// ------------------------------------------------------------------ les animations : un acteur, son mouvement, sa condition
let ACT = [];
/** o : l'acteur ; f(t, dt, o) : son mouvement ; quand() : visible ou non. */
const ajoute = (o, f, quand) => { ACT.push({ o, f, quand }); return o; };
const RIEN = new THREE.Object3D(); // le support des animations sans personnage (chef d'orchestre, tuiles, lueur du four…)
/** Marche le long d'une ligne brisée (points du monde), en boucle ou en va-et-vient ; y : hauteur du sol. */
function longer(o, pts, d, boucle, y, saut = 0.004) {
  const segs = []; let L = 0;
  const n = boucle ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6; segs.push([a, b, l, L]); L += l; }
  const u = boucle ? ((d % L) + L) % L : L - Math.abs(((d % (2 * L)) + 2 * L) % (2 * L) - L);
  const sens = boucle || ((d % (2 * L)) + 2 * L) % (2 * L) < L ? 1 : -1;
  const s = segs.find(x => u <= x[3] + x[2]) || segs[segs.length - 1], f = (u - s[3]) / s[2];
  o.position.set(s[0].x + (s[1].x - s[0].x) * f, y + Math.abs(Math.sin(d * 60)) * saut, s[0].z + (s[1].z - s[0].z) * f);
  o.rotation.set(0, -Math.atan2((s[1].z - s[0].z) * sens, (s[1].x - s[0].x) * sens), 0);
}

// ------------------------------------------------------------------ les rues : joints entre les dalles des cases bâties, et routes du royaume
// Les promeneurs vont de carrefour en carrefour et choisissent au hasard la rue suivante.
let GRAPHE = [];
const coinCase = (c, i, r = 0.98) => { const k = posCase(c); return { x: k.x + Math.sin(i * Math.PI / 3) * r, z: k.z + Math.cos(i * Math.PI / 3) * r }; };
function construireGraphe(cases) {
  const nds = [], idx = new Map();
  const n = p => { const c = `${Math.round(p.x * 50)},${Math.round(p.z * 50)}`; if (!idx.has(c)) { idx.set(c, nds.length); nds.push({ x: p.x, z: p.z, v: [], y: 0 }); } return idx.get(c); };
  const lier = (a, b) => { const i = n(a), j = n(b); if (i === j || nds[i].v.includes(j)) return; nds[i].v.push(j); nds[j].v.push(i); };
  for (const c of cases) for (let i = 0; i < 6; i++) lier(coinCase(c, i), coinCase(c, i + 1));
  // les routes : du milieu du bord commun de deux cases (sur le joint) au point de passage d'une case non bâtie (comme routes.js)
  const bati = new Set((ETAT?.batiments || []).map(b => b.case)), pres = new Set(cases);
  for (const c of cases) for (const v of voisins(c)) pres.add(v);
  const P0 = i => { const q = posCase(i); return { x: q.x + (hache(q.c, q.r, 17) - 0.5) * 0.3, z: q.z + (hache(q.c, q.r, 19) - 0.5) * 0.3 }; };
  for (const [a, b] of ETAT?.routes || []) {
    if (!pres.has(a) || !pres.has(b) || !caseVisible(a) || !caseVisible(b)) continue;
    const A = posCase(a), B = posCase(b), mil = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
    for (const c of [a, b]) if (!bati.has(c)) lier(mil, P0(c));
    // au bord d'une case bâtie, le milieu du bord se raccorde à ses deux coins (le bord n est entre les coins n et n + 1)
    const c0 = cases.includes(a) ? a : cases.includes(b) ? b : -1;
    if (c0 >= 0) { const K = posCase(c0), d = Math.atan2(mil.x - K.x, mil.z - K.z), k = Math.round(d / (Math.PI / 3) - 0.5); for (const i of [k, k + 1]) lier(mil, coinCase(c0, i)); }
  }
  for (const nd of nds) nd.y = Math.max(P.solEn(nd.x + 0.08, nd.z), P.solEn(nd.x - 0.08, nd.z), P.solEn(nd.x, nd.z + 0.08), P.solEn(nd.x, nd.z - 0.08)) + 0.012;
  return nds;
}
const PROMENEURS = [];
function promeneur(i, v, o = {}) {
  const a = (i * 5 + 3) % GRAPHE.length;
  const w = { a, b: GRAPHE[a].v[i % GRAPHE[a].v.length] ?? a, u: hache(i, 3, 61), v, pause: 0, salut: 0, attente: 1 + (i % 4), d: i, x: 0, z: 0, y: 0, cap: 0, dx: 1, dz: 0, lat: 0.04, f: 50 + hache(i, 4, 61) * 35, saut: 0.002 + hache(i, 5, 61) * 0.004, flane: 0.25, pauseL: 2, veh: false, vis: false, salue: true, visible: () => false, ...o };
  PROMENEURS.push(w); pasPromeneur(w, 0); return w;
}
function pasPromeneur(w, dt) {
  if (w.salut > 0) w.salut -= dt;
  w.attente -= dt;
  if (w.pause > 0) { w.pause -= dt; return; }
  let A = GRAPHE[w.a], B = GRAPHE[w.b], L = Math.hypot(B.x - A.x, B.z - A.z) || 1e-3;
  w.u += w.v * dt / L; w.d += w.v * dt;
  if (w.u >= 1) { // au carrefour : une autre rue au hasard (pas celle d'où l'on vient, sauf au bout d'une impasse) ; les attelages évitent les impasses
    const prec = w.a; w.a = w.b;
    let vs = GRAPHE[w.a].v.filter(j => j !== prec);
    if (w.veh) { const ok = vs.filter(j => GRAPHE[j].v.length > 1); if (ok.length) vs = ok; }
    w.b = vs.length ? vs[Math.random() * vs.length | 0] : prec; w.u = 0;
    if (Math.random() < w.flane) w.pause = 0.8 + Math.random() * w.pauseL;
    A = GRAPHE[w.a]; B = GRAPHE[w.b]; L = Math.hypot(B.x - A.x, B.z - A.z) || 1e-3;
  }
  w.dx = (B.x - A.x) / L; w.dz = (B.z - A.z) / L;
  w.x = A.x + (B.x - A.x) * w.u - w.dz * w.lat; w.z = A.z + (B.z - A.z) * w.u + w.dx * w.lat; w.y = A.y + (B.y - A.y) * Math.min(1, w.u); w.cap = -Math.atan2(w.dz, w.dx); // chacun garde sa droite
}
/** Pose un acteur sur un promeneur, décalé de av le long de la marche et de cote sur le côté (unités du monde). */
function poser(o, w, av = 0, cote = 0, sautK = 1) {
  const marche = w.pause <= 0;
  o.position.set(w.x + w.dx * av - w.dz * cote, w.y + (marche ? Math.abs(Math.sin(w.d * w.f)) * w.saut * sautK : 0), w.z + w.dz * av + w.dx * cote);
  o.rotation.set(0, w.cap, w.salut > 0 ? -Math.sin(w.salut / 1.6 * Math.PI) * 0.35 : marche ? Math.sin(w.d * w.f * 0.5) * 0.04 : 0);
}
function saluts() {
  for (let i = 0; i < PROMENEURS.length; i++) {
    const a = PROMENEURS[i]; if (!a.vis || !a.salue || a.pause > 0 || a.attente > 0) continue;
    for (let j = i + 1; j < PROMENEURS.length; j++) {
      const b = PROMENEURS[j]; if (!b.vis || !b.salue || b.pause > 0 || b.attente > 0) continue;
      if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) > 0.11) continue;
      if (Math.random() < 0.65) { for (const [p, q] of [[a, b], [b, a]]) { p.pause = 1.8; p.salut = 1.6; p.attente = 9; p.cap = -Math.atan2(q.z - p.z, q.x - p.x); } }
      else a.attente = b.attente = 3;
      break;
    }
  }
}

// ------------------------------------------------------------------ fenêtres, volets, voilages, ombres chinoises ; lanternes et réverbères
let FEN = [], SILWIN = [], LAMPES = [], LANTERNES = [], TABLES = [], RUISS = [], FLAQUES_POS = [], TOITS = [];
// la lumière des fenêtres selon l'époque : chandelle, lampe à huile, lampe plus claire (quinquet), bec de gaz ; et son vacillement
const LAMPE = { ancien: [0xffa24a, 0.3], lumieres: [0xffb85a, 0.14], empire: [0xffc870, 0.08], industrie: [0xfff2cc, 0.015] };
const RUE = { ancien: 0xffa850, lumieres: 0xffc060, empire: 0xffcc70, industrie: 0xfff4d0 };
// l'horaire de l'école sur la journée du jeu (300 s), fermée l'été (vacances) et hors du jour
function ECOLE() {
  if (SAISON === 2) return 'vacances';
  if (!JOUR()) return 'fermee';
  const s = H.p;
  return s < 90 ? 'arrivee' : s < 120 ? 'classe' : s < 200 ? 'recre' : s < 225 ? 'classe' : s < 295 ? 'sortie' : 'fermee';
}
const EN_CLASSE = () => { const e = ECOLE(); return e === 'arrivee' || e === 'classe' || e === 'recre'; };
const DEHORS_ECOLE = () => !ORAGEUX(); // par orage ou tempête, les écoliers restent en classe
function cibleLum(f) {
  const ph = H.phase, p = H.p, ind = EPOQUE === 'industrie', cle = f.k.cle;
  if (cle === 'taverne' && ((ph === 'crepuscule' && p > 3) || (ph === 'nuit' && p < 50))) return 1.25; // la taverne s'anime le soir
  if (cle === 'ecole') return EN_CLASSE() && (SAISON === 0 || !CLAIR()) ? 0.8 : 0; // l'école est vide le soir et la nuit
  if (cle === 'marche') return 0;
  if (cle === 'boulangerie' && ((ph === 'nuit' && p > 35) || ph === 'aube')) return 1; // le boulanger se lève avant l'aube
  if (ph === 'crepuscule') return p > 2 + f.rang * 24 ? 1 : 0; // une à une
  if (ph === 'nuit') return f.r2 < (ind ? 0.5 : 0.35) || p < 12 + f.r2 * 42 ? 1 : 0; // elles s'éteignent tard, une à une ; les veilleurs gardent la leur
  if (ph === 'aube') return f.r3 < 0.3 && p < 5 + f.r3 * 60 ? 1 : 0; // quelques lève-tôt
  return (METEO === 'brouillard' && f.r3 < 0.4) || (METEO === 'orage' && f.r3 < 0.25) ? 0.75 : 0;
}
function cibleVolet(f) {
  if (METEO === 'tempete') return f.r2 < 0.55 ? -1 : 0; // la moitié battent, les autres ont été fermés
  if (PLUVIEUX() || (METEO === 'neige' && !DEHORS())) return tMeteo > 0.6 + f.rang * 7 ? 0 : 1; // on les ferme un à un
  if (NUIT()) return f.cible > 0 ? 1 : 0;
  if (AUBE()) return H.p > 2 + f.rang * 24 ? 1 : 0; // on les ouvre un à un
  return 1;
}
// les volets du jeu (vert sous le chaume, bleu-gris ailleurs), un peu ravivés pour qu'on les distingue de la vitre une fois fermés
const VOLET_VIF = { [0x5c7a4a]: 0x6f9a52, [0x4a6a7a]: 0x5a8fb4 };
const VITRE_C = new THREE.Color(VITRE), INTERIEUR = new THREE.Color(0x1c130d), FLASH = new THREE.Color(0xf4f8ff), C_LAMPE = new THREE.Color(), C_ON = new THREE.Color(), C_RID = new THREE.Color();
function majFenetres(dt) {
  const [lc, fl] = LAMPE[EPOQUE], clarte = 0.3 + 0.7 * Math.min(1, (climat.jour || 0) + (climat.aube || 0) * 0.6), ouvertes = METEO === 'canicule' && JOUR(), eclair = climat.eclair || 0;
  C_LAMPE.setHex(lc);
  let nv = 0, nvo = 0;
  for (const f of FEN) {
    f.cible = cibleLum(f);
    f.lum += Math.sign(f.cible - f.lum) * Math.min(Math.abs(f.cible - f.lum), dt * 2.5);
    const vac = 1 - fl * (0.5 + 0.5 * Math.sin(t * 17 + f.i * 3.1) * Math.sin(t * 7.3 + f.i));
    const rideau = METEO === 'orage' || (f.lum > 0.3 && (NUIT() || SOIR()) && f.r3 > 0.6);
    C_RID.setHex(f.rideau);
    _col.copy(ouvertes ? INTERIEUR : rideau ? C_RID : VITRE_C).multiplyScalar(ouvertes ? 1 : clarte * (rideau ? 0.75 : 1));
    if (f.lum > 0) { C_ON.copy(C_LAMPE); if (rideau) C_ON.lerp(C_RID, 0.45).multiplyScalar(1.15); _col.lerp(C_ON.multiplyScalar(vac), Math.min(1, f.lum)); }
    if (eclair > 0) _col.lerp(FLASH, eclair * 0.85);
    VITRES.setColorAt(f.i, _col);
    // volets : charnière au bord de la fenêtre, 0 fermé, 1 rabattu contre le mur ; rabattus, ce sont ceux du modèle qu'on voit
    if (f.volet) {
      const c = cibleVolet(f);
      if (c < 0) f.o = THREE.MathUtils.clamp(0.5 + 0.8 * Math.sin(t * (1.7 + f.r3 * 2.2) + f.i) * Math.sin(t * 0.63 + f.i * 3), 0, 1);
      else f.o += Math.sign(c - f.o) * Math.min(Math.abs(c - f.o), dt * 1.4);
      if (f.o < 0.97 && nv < VOLETS.instanceMatrix.count - 1) {
        const ww = f.w, ph = Math.PI * f.o;
        for (const v of [-1, 1]) {
          const cx = v * ww / 2 - v * ww / 4 * Math.cos(v * ph), cz = 0.07 + v * ww / 4 * Math.sin(v * ph);
          _m.copy(f.m).multiply(_m2.compose(_p.set(cx, 0, cz), _q.setFromAxisAngle(AXE_Y, v * ph), _s.set(ww / 2 * 0.93, f.h * 1.05, 0.03)));
          VOLETS.setMatrixAt(nv, _m); VOLETS.setColorAt(nv++, _col.setHex(VOLET_VIF[f.volet] || f.volet));
        }
      }
    } else f.o = 1;
    // lueur de la fenêtre (affaiblie derrière un volet clos)
    if (f.lum > 0.04) HALO.mettre(_p.copy(f.c).addScaledVector(f.n, 0.006), C_ON.copy(C_LAMPE), Math.min(1, f.lum) * vac * (f.volet ? 0.25 + 0.75 * f.o : 1) * (JOUR() ? 0.45 : 0.9));
    // canicule : fenêtres grandes ouvertes, voilage qui ondule dehors
    if (ouvertes && nvo < NF) {
      const a = 0.25 + 0.22 * Math.sin(t * 1.3 + f.i * 1.7);
      _m.copy(f.m).multiply(_m2.compose(_p.set(0, f.h / 2, 0.06), _q.setFromAxisAngle(_v.set(1, 0, 0), -a), UN)).multiply(_m2.compose(_p.set(0, -f.h * 0.45, 0), _q.identity(), _s.set(f.w * 0.8, f.h * 0.9, 0.01)));
      VOILES.setMatrixAt(nvo++, _m);
    }
  }
  VITRES.count = FEN.length; fin(VITRES);
  VOLETS.count = nv; fin(VOLETS);
  VOILES.count = nvo; fin(VOILES);
  // ombres chinoises : on passe derrière le rideau ; on danse derrière ceux de la taverne
  let ns = 0;
  if (NUIT() || SOIR()) for (const f of SILWIN) {
    const tav = f.k.cle === 'taverne';
    if (f.lum < 0.6 || f.o < 0.6 || (!tav && Math.sin(t * 0.21 + f.i * 2.3) < -0.1) || ns > 118) continue;
    const x = Math.sin(t * (tav ? 1.6 : 0.45) + f.i) * (f.w / 2 - f.w * 0.17) * 0.92, saut = tav ? Math.abs(Math.sin(t * 6 + f.i)) * f.h * 0.07 : 0;
    _m.copy(f.m).multiply(_m2.compose(_p.set(x, -f.h * 0.14 + saut, 0.052), _q.identity(), _s.set(f.w * 0.3, f.h * 0.56, 0.004))); SILS.setMatrixAt(ns++, _m);
    _m.copy(f.m).multiply(_m2.compose(_p.set(x, f.h * 0.25 + saut, 0.052), _q.identity(), _s.set(f.w * 0.19, f.h * 0.19, 0.004))); SILS.setMatrixAt(ns++, _m);
  }
  SILS.count = ns; fin(SILS);
}
const lampeAllumee = j => (SOIR() && H.p > 1.5 + j * 5) || NUIT() || (AUBE() && H.p < 1.5 + j * 5) || (METEO === 'brouillard' && !NUIT()); // l'allumeur passe toutes les 5 s
function majLampes() {
  const vac = EPOQUE === 'ancien' ? 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.05 : 1, c = _col.setHex(RUE[EPOQUE]);
  LAMPES.forEach((l, j) => { if (lampeAllumee(l.j ?? j)) GRAND.mettre(l.p, c, (JOUR() ? 0.55 : 1) * vac); });
  for (const L of LANTERNES) {
    const tav = L.k.cle === 'taverne' || L.k.cle === 'boulangerie';
    if (METEO === 'brouillard' || (SOIR() && H.p > 4 + L.r * 18) || (NUIT() && (tav || H.p < 30 + L.r * 50))) HALO.mettre(L.p, c, (JOUR() ? 0.7 : 0.95) * vac);
  }
  if (SAISON === 2 && SEC() && (SOIR() || (NUIT() && H.p < 35))) for (const T of TABLES) { HALO.mettre(T.lampe, c, vac); GRAND.mettre(T.lampe, c, 0.3 * vac); }
}
// eau : gouttières qui ruissellent, flaques qui grandissent puis sèchent
function majEau(dt) {
  const pl = PLUIE();
  FLAQUE = NEIGE_SOL() ? 0 : THREE.MathUtils.clamp(FLAQUE + (pl ? dt * 0.12 : -dt * 0.035), 0, 1); // la neige recouvre les flaques
  let n = 0;
  if (FLAQUE > 0.01) FLAQUES_POS.forEach((p, i) => { if (n >= 160) return; const r = (0.028 + hache(i, 4, 4) * 0.03) * FLAQUE; _m.compose(p, _q.identity(), _s.set(r, 1, r * (0.7 + hache(i, 5, 4) * 0.5))); FLAQUES.setMatrixAt(n++, _m); });
  FLAQUES.count = n; fin(FLAQUES);
  if (pl && FLAQUE > 0.2 && FLAQUES_POS.length) for (let i = 0; i < 2; i++) if (Math.random() < dt * 9) { const j = Math.random() * FLAQUES_POS.length | 0, p = FLAQUES_POS[j], r = (0.028 + hache(j, 4, 4) * 0.03) * FLAQUE; particule({ genre: 'ride', x: p.x + (Math.random() - 0.5) * r, y: p.y + 0.002, z: p.z + (Math.random() - 0.5) * r * 0.6, s: r * 0.55, vie: 0.7 }); }
  const a = RUISS_L.geometry.attributes.position; let k = 0;
  RUISS_L.visible = pl && RUISS.length > 0;
  if (RUISS_L.visible) for (const r of RUISS) {
    if (r.seau && EPOQUE !== 'ancien') continue;
    for (let j = 0; j < (r.seau ? 2 : 3); j++) {
      if (k >= 400 * 3) break;
      const u = (t * (r.seau ? 1.1 : 1.8) + r.ph + j / 3) % 1, y = r.a.y + (r.b.y - r.a.y) * u * u;
      a.setXYZ(k * 2, r.a.x, y, r.a.z); a.setXYZ(k * 2 + 1, r.a.x, y - (r.seau ? 0.006 : 0.016), r.a.z); k++;
      if (r.seau && u > 0.95 && Math.random() < 0.3) particule({ genre: 'ride', x: r.b.x, y: r.b.y, z: r.b.z, s: 0.014, vie: 0.5 });
    }
  }
  RUISS_L.geometry.setDrawRange(0, k * 2); a.needsUpdate = true;
}

// ------------------------------------------------------------------ le voisinage du regard
let sigVois = '', prochaine = 0, sale = true, MARCHES = [];
/** Les bâtiments des quartiers les plus proches du centre du regard, s'il est assez près (arrêtés et cases dans le brouillard exclus). */
function voisinage() {
  if (!ETAT || cam.d > D_MAX) return [];
  const r = [];
  for (const b of ETAT.batiments) {
    if (b.reste !== 0 || !QUARTIER.has(b.cle) || M.estArrete(b) || !caseVisible(b.case)) continue;
    const k = posCase(b.case), d = Math.hypot(k.x - cam.x, k.z - cam.z);
    if (d < RAYON) r.push([d, b]);
  }
  return r.sort((a, b) => a[0] - b[0]).slice(0, MAX_BATS).map(x => x[1]);
}
/** Met la vie des quartiers d'accord avec l'état (appelé par main.js après majVie). */
export function majQuartiers(etat) { ETAT = etat; EPOQUE = etat?.epoque?.cle || 'ancien'; MOIS = etat?.mois ?? MOIS; sale = true; prochaine = 0; }

function reconstruire(liste) {
  TROUPE.vider(); ACT = []; PROMENEURS.length = 0; parts.length = 0;
  for (const g of MARCHES) ROOT.remove(g.bache, g.carreau);
  MARCHES = []; FEN = []; SILWIN = []; LAMPES = []; LANTERNES = []; TABLES = []; RUISS = []; FLAQUES_POS = []; TOITS = []; GRAPHE = [];
  PROCHES.clear();
  BATS = [];
  for (const b of liste) {
    const B = M.batiPose(b.id); if (!B?.rel) continue;
    const m = B.mesh; m.updateMatrixWorld();
    BATS.push({ b, cle: b.cle, id: b.id, case: b.case, M: m.matrixWorld.clone(), x: m.position.x, y: m.position.y, z: m.position.z, th: m.rotation.y, cos: Math.cos(m.rotation.y), sin: Math.sin(m.rotation.y), rel: B.rel });
    PROCHES.add(b.id);
  }
  remplirFenetres();
  if (!BATS.length) { TROUPE.installer(); return; }
  // ---- relevés → cadres
  let id = 0;
  for (const k of BATS) {
    const R = k.rel;
    for (const f of R.fen) {
      if (FEN.length >= NF) break;
      const m = cadre(k, f.x, f.y, f.z, f.ry), i = id++;
      FEN.push({ k, m, w: f.w, h: f.h, volet: f.volet, c: V().setFromMatrixPosition(m), n: V(m.elements[8], m.elements[9], m.elements[10]).normalize(), rang: hache(i, 1, 5), r2: hache(i, 2, 5), r3: hache(i, 3, 5), rideau: [0xb8453a, 0xd9a43a, 0x5c7a4a, 0xe8d8b0, 0x7a4a7a][i % 5], lum: 0, o: 1, i, rec: f });
    }
    for (const r of R.toits) if (r.w < 9) {
      TOITS.push({ k, m: cadre(k, r.x, r.y, r.z, r.ry), ...r, petit: r.w < 3.4 && r.d < 3.4 });
      if (TOITS.length % 2 === 0) for (const sz of [1, -1]) { const x = r.x + (r.w / 2 * 0.95) * Math.cos(r.ry) + sz * r.d / 2 * 0.9 * Math.sin(r.ry), z = r.z - (r.w / 2 * 0.95) * Math.sin(r.ry) + sz * r.d / 2 * 0.9 * Math.cos(r.ry); RUISS.push({ a: monde(k, x, r.y, z), b: monde(k, x, 0.25, z), ph: hache(RUISS.length, 3, 9) }); } // l'eau dégouline des avant-toits
    }
    for (const s of R.seaux) RUISS.push({ a: monde(k, s[0], s[1], s[2]), b: monde(k, s[0], 0.6, s[2]), ph: 0.3, seau: true });
    for (const [x, y, z, r] of R.lant) LANTERNES.push({ p: monde(k, x, y, z), k, r: r ?? 0.3 });
    R.lampes.forEach(([x, y, z], j) => LAMPES.push({ p: monde(k, x, y, z), k, j }));
    for (const T of R.tables) if (T.lampe) TABLES.push({ k, ...T, lampe: monde(k, ...T.lampe) });
    R.portes.forEach((p, j) => { if (hache(p.x * 7, p.z * 5, 23) < 0.6) FLAQUES_POS.push(dansCadre(cadre(k, p.x, 0.26, p.z, p.ry), 0.3, 0, 0.9 + hache(j, 2, 3))); });
  }
  for (const f of FEN) { _m.copy(f.m).multiply(_m2.compose(_p.set(0, 0, 0.045), _q.identity(), _s.set(f.w, f.h, 0.012))); VITRES.setMatrixAt(f.i, _m); }
  VITRES.count = FEN.length; fin(VITRES);
  // ombres chinoises : toutes les fenêtres de la taverne et une fenêtre sur sept ailleurs
  SILWIN = FEN.filter(f => f.k.cle === 'taverne' || (f.r3 > 0.86 && f.k.cle !== 'ecole')).slice(0, 55);
  GRAPHE = construireGraphe(BATS.map(k => k.case));
  for (let i = 0; i < GRAPHE.length; i++) for (const j of GRAPHE[i].v) if (j > i && hache(i, j, 7) < 0.35) { const a = GRAPHE[i], b = GRAPHE[j], u = 0.3 + hache(i, j, 8) * 0.4; FLAQUES_POS.push(V(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + 0.001, a.z + (b.z - a.z) * u)); }
  construireVie();
  TROUPE.installer();
}

// ------------------------------------------------------------------ la vie des logements (maquette : construireVie), par sorte de bâtiment proche
function construireVie() {
  const A = (nom, s = ECH) => TROUPE.acteur(nom, s);
  const de = cle => BATS.filter(k => k.cle === cle), un = cle => BATS.find(k => k.cle === cle);
  const kh = un('hotel'), kt = un('taverne'), kb = un('boulangerie'), centre = kh || BATS[0];
  const S = 0.4; // échelle d'un personnage dans un cadre (unités de web_power)
  const portesDe = k => k.rel.portes.map(p => ({ k, m: cadre(k, p.x, 0, p.z, p.ry), w: p.w, h: p.h, rec: p }));
  const fenetreLibre = (k, rang = 0) => FEN.filter(f => f.k === k && f.n.z > 0.3 && !f.rec.jardin).sort((a, b) => b.c.y - a.c.y || a.i - b.i)[rang];

  // ---- la mairie : enfants autour de la fontaine (qui s'aspergent en canicule), allumeur, veilleur, crieur, chauves-souris
  if (kh) {
    ['enfant0', 'enfant1', 'enfant2'].forEach((nom, i) => ajoute(A(nom, ECH * 0.75), (t, dt, o) => { const a = i * 2.1 + t * 1.1, p = pres(kh, 1.8 + Math.cos(a) * 1.15, 2.6 + Math.sin(a) * 1.15); o.position.set(p.x, p.y + Math.abs(Math.sin(t * 9 + i)) * 0.01, p.z); o.rotation.y = capB(kh, -Math.sin(a), Math.cos(a)); }, () => DEHORS() && DOUX() && !NEIGE_SOL()));
    ['enfant1', 'enfant2'].forEach((nom, i) => { const fo = pres(kh, 1.8, 2.6); ajoute(A(nom, ECH * 0.75), (t, dt, o) => { const a = i * Math.PI + Math.sin(t * 0.7) * 0.6, p = pres(kh, 1.8 + Math.cos(a) * 0.95, 2.6 + Math.sin(a) * 0.95), saut = Math.max(0, Math.sin(t * 5 + i * 2)); o.position.set(p.x, p.y + saut * 0.02, p.z); o.rotation.y = capB(kh, -Math.cos(a), -Math.sin(a)); if (saut > 0.97 && Math.random() < 0.5) for (let n = 0; n < 3; n++) particule({ x: fo.x + (Math.random() - 0.5) * 0.04, y: fo.y + 0.06, z: fo.z + (Math.random() - 0.5) * 0.04, vx: (p.x - fo.x) * 2 + (Math.random() - 0.5) * 0.1, vy: 0.35 + Math.random() * 0.2, vz: (p.z - fo.z) * 2 + (Math.random() - 0.5) * 0.1, g: 1.4, s: 0.004, col: 0x9fd4f2, vie: 0.6 }); }, () => DEHORS() && METEO === 'canicule'); });
    // l'allumeur de réverbères, à toutes les époques
    const lampes = LAMPES.filter(l => l.k === kh);
    if (lampes.length) {
      const pts = lampes.map(l => ({ x: l.p.x - 0.03, z: l.p.z }));
      ajoute(A('allumeur'), (t, dt, o) => {
        const q = Math.max(0, H.p - 1), j = Math.min(pts.length - 1, Math.floor(q / 5)), tau = q - j * 5;
        const a = pts[j], b = pts[Math.min(pts.length - 1, j + 1)], f = tau < 1 ? 0 : Math.min(1, (tau - 1) / 4);
        o.position.set(a.x + (b.x - a.x) * f, kh.y + DALLE + (f > 0 && f < 1 ? Math.abs(Math.sin(t * 9)) * 0.004 : 0), a.z + (b.z - a.z) * f);
        o.rotation.set(0, f > 0 ? -Math.atan2(b.z - a.z, b.x - a.x) : o.rotation.y, tau < 1 ? 0.35 : 0);
      }, () => (SOIR() || AUBE()) && H.p < 5 * pts.length + 1);
    }
    // le veilleur de nuit, sa lanterne et sa cloche, autour de la place
    { const ronde = [0, 1, 2, 3, 4, 5].map(i => coinCase(kh.case, -i, 0.95)), cloche = A('cloche', ECH * 1.4), y = kh.y + DALLE; let avant = 0;
      const v = ajoute(A('veilleur'), (t, dt, o) => {
        longer(o, ronde, t * 0.035, true, y, 0.003); o.updateMatrix();
        HALO.mettre(_v.set(0.45, 1.1, 0.38).applyMatrix4(o.matrix), _col.setHex(RUE[EPOQUE]), 1); GRAND.mettre(_v, _col, 0.35);
        const cy = t % 6, ag = cy < 1.6 ? Math.sin(cy * 12) * 0.7 : 0;
        _v.set(0.1, 3.1, -0.42).applyMatrix4(o.matrix); cloche.position.copy(_v); cloche.rotation.set(0, o.rotation.y, ag);
        if (cy < 1.6 && Math.floor(cy * 12 / Math.PI) !== avant) { avant = Math.floor(cy * 12 / Math.PI); if (avant % 2 === 0) particule({ genre: 'son', x: _v.x, y: _v.y + 0.01, z: _v.z, s: 0.035, col: 0xfff0c0, vie: 0.6 }); }
      }, () => NUIT() || (SOIR() && H.p > 18));
      ajoute(cloche, null, () => v.visible);
    }
    // brouillard : un passant éclaire son chemin à la lanterne
    { const tour = [0, 1, 2, 3, 4, 5].map(i => coinCase(kh.case, i, 0.98)); ajoute(A('porteLanterne'), (t, dt, o) => { longer(o, tour, t * 0.04 + 2, true, kh.y + DALLE); o.updateMatrix(); GRAND.mettre(_v.set(0.55, 1.3, 0.3).applyMatrix4(o.matrix), _col.setHex(RUE[EPOQUE]), 0.55); }, () => METEO === 'brouillard' && !NUIT()); }
    // chauves-souris autour des toits
    for (let i = 0; i < 4; i++) ajoute(A('chauvesouris', 0.022), (t, dt, o) => { const a = t * (0.9 + i * 0.25) + i * 1.6, r = 0.55 + 0.3 * Math.sin(t * 0.8 + i * 2); o.position.set(kh.x + Math.cos(a) * r + Math.sin(t * 3.1 + i) * 0.08, kh.y + 0.36 + Math.sin(t * 2.3 + i) * 0.1, kh.z + Math.sin(a) * r + Math.cos(t * 2.7 + i) * 0.08); o.rotation.set(0, -a - Math.PI / 2, Math.sin(t * 3 + i) * 0.4); o.scale.set(0.022, 0.022, 0.022 * (0.2 + Math.abs(Math.sin(t * 18 + i)))); }, () => (SOIR() || NUIT()) && SAISON !== 0 && SEC() && METEO !== 'brouillard');
  }

  // ---- les maisons de quartier : voisines sur le pas de la porte, déneigement, chat sur le faîtage, chat au rebord en canicule, tapis battus, hirondelles
  de('maison').slice(0, 2).forEach((km, n) => {
    const ps = portesDe(km), d = ps[1] || ps[0];
    if (d && n === 0) [['commere0', -0.5, 0], ['commere1', 0.5, Math.PI]].forEach(([nom, x, ry], i) => ajoute(A(nom), (t, dt, o) => surCadre(o, d.m, x, 0.25, 1.1, ry, 0, Math.sin(t * 2.2 + i * 2) * 0.06, S), () => DEHORS() && DOUX()));
    if (ps[0]) { const d0 = ps[0]; ajoute(A('pelleteur'), (t, dt, o) => { const u = t * 0.45, x = Math.sin(u) * 0.7, sens = Math.cos(u) > 0 ? 0 : Math.PI, pelle = Math.max(0, Math.sin(t * 3.5)); surCadre(o, d0.m, x, 0.25, 1.35, sens, 0, -pelle * 0.5, S); if (pelle > 0.98 && Math.random() < 0.35) { const p = dansCadre(d0.m, x, 0.4, 1.9); for (let k = 0; k < 4; k++) particule({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.15, vy: 0.2 + Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.15, g: 0.9, s: 0.005, col: 0xf6f8fb, vie: 0.8, sol: km.y + DALLE }); } }, () => NEIGE_SOL() && DEHORS() && METEO !== 'tempete'); }
    if (n === 0) {
      const r = TOITS.find(x => x.k === km && x.petit);
      if (r) ajoute(A('chat0', ECH * 1.3), (t, dt, o) => { const u = t * 0.22, z = Math.sin(u) * r.d * 0.36, sens = Math.cos(u) >= 0; surCadre(o, r.m, 0, r.h - 0.05, z, sens ? -Math.PI / 2 : Math.PI / 2, 0, 0, S * 1.3); o.updateMatrix(); if (NUIT()) for (const e of [0.07, -0.07]) PETIT.mettre(_v.set(0.62, 0.66, e).applyMatrix4(o.matrix), _col.setHex(0xd8ff6a), 1); }, () => (SOIR() || NUIT()) && SEC());
      const f = fenetreLibre(km, 1) || fenetreLibre(km);
      if (f) ajoute(A('chat0', ECH * 1.3), (t, dt, o) => { surCadre(o, f.m, 0, -f.h / 2 - 0.01, 0.2, 0, 0, 0, S * 1.3); o.scale.y *= 0.7; }, () => JOUR() && METEO === 'canicule');
      // hirondelles autour des toits
      for (let i = 0; i < 5; i++) ajoute(A('hirondelle', 0.02), (t, dt, o) => { const a = t * (1.3 + i * 0.12) + i * 1.3, r = 0.35 + 0.2 * Math.sin(t * 0.7 + i); o.position.set(km.x + Math.cos(a) * r, km.y + 0.25 + Math.sin(t * 2.1 + i) * 0.07, km.z + Math.sin(a) * r * 0.8); o.rotation.set(0, -a - Math.PI / 2, Math.sin(t * 2.1 + i) * 0.3); o.scale.set(0.02, 0.02, 0.02 * (0.25 + Math.abs(Math.sin(t * 15 + i)))); }, () => (SAISON === 1 || SAISON === 2) && JOUR() && SEC());
    }
  });
  // ménage de printemps : tapis battus aux fenêtres (une fenêtre libre par maison, maison de pierre, immeuble)
  [...de('maison'), ...de('maison_pierre'), ...de('immeuble')].slice(0, 5).map(k => fenetreLibre(k)).filter(Boolean).forEach((f, i) => ajoute(A(`tapis${i % 2}`), (t, dt, o) => { const cy = (t + i * 1.1) % 3, bat = cy < 1.2 ? Math.max(0, Math.sin(cy * 13)) : 0; surCadre(o, f.m, 0, -f.h / 2 + 0.02, 0.09, 0, -bat * 0.35, 0, 0.7); if (bat > 0.95 && Math.random() < 0.5) { const p = dansCadre(f.m, 0, -f.h / 2 - 0.35, 0.3); for (let n = 0; n < 3; n++) particule({ x: p.x + (Math.random() - 0.5) * 0.03, y: p.y, z: p.z, vx: f.n.x * 0.05 + (Math.random() - 0.5) * 0.04, vy: 0.03, vz: f.n.z * 0.05 + (Math.random() - 0.5) * 0.04, s: 0.008, grandit: 2.5, col: 0xd9c9a0, vie: 1.3 }); } }, () => SAISON === 1 && DEHORS() && SEC()));

  // ---- les maisons de pierre : bataille de boules de neige, on ratisse les feuilles
  const kp = un('maison_pierre');
  if (kp) {
    const equipes = [[-2.6, 0.9, 0], [-2.3, -1.0, 0], [2.6, 1.3, Math.PI], [2.9, -0.1, Math.PI]], gamins = [], neigeux = () => NEIGE_SOL() && DEHORS() && (METEO === 'beau' || METEO === 'nuageux' || METEO === 'neige');
    equipes.forEach(([x, z, ry], i) => gamins.push(ajoute(A(`enfantH${i}`, ECH * 0.75), (t, dt, o) => { const p = pres(kp, x + Math.sin(t * 0.8 + i) * 0.4, z + Math.cos(t * 0.6 + i) * 0.3); o.position.set(p.x, p.y + Math.max(0, Math.sin(t * 4 + i * 1.7)) * 0.008, p.z); o.rotation.y = kp.th + ry; }, neigeux)));
    let pro = 0;
    ajoute(RIEN, (t, dt) => { if ((pro -= dt) > 0) return; pro = 0.45 + Math.random() * 0.4; const a = Math.random() * 4 | 0, b = a < 2 ? 2 + (Math.random() * 2 | 0) : Math.random() * 2 | 0, A_ = gamins[a].position, B = gamins[b].position, T = 0.75, g = 0.7; particule({ x: A_.x, y: A_.y + 0.07, z: A_.z, vx: (B.x - A_.x) / T, vz: (B.z - A_.z) / T, vy: 0.5 * g * T, g, s: 0.0055, col: 0xffffff, vie: T, fin: p => { for (let n = 0; n < 4; n++) particule({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.2, vy: 0.1 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.2, g: 0.8, s: 0.0028, col: 0xffffff, vie: 0.4 }); } }); }, neigeux);
    const arbre = monde(kp, 1.8, 1.6, -1.6);
    ajoute(A('rateleur'), (t, dt, o) => { const u = (Math.sin(t * 0.3) + 1) / 2, p = pres(kp, -0.6 + 2.4 * u, 2.5 - 0.4 * u); o.position.set(p.x, p.y, p.z); o.rotation.set(0, capB(kp, 0.3, 1), Math.sin(t * 3.2) * 0.12); if (Math.random() < dt * 3) particule({ genre: 'plaque', x: arbre.x + (Math.random() - 0.5) * 0.1, y: arbre.y + 0.02, z: arbre.z + (Math.random() - 0.5) * 0.1, vx: 0.02 + (Math.random() - 0.5) * 0.04, vy: -0.03, vz: (Math.random() - 0.5) * 0.04, g: 0.02, spin: 3, s: 0.012, forme: [1, 0.2, 0.7], col: [0xd9822b, 0xc9a13a, 0xb5562a, 0xe0b040][Math.random() * 4 | 0], vie: 4, sol: kp.y + DALLE }); }, () => SAISON === 3 && DEHORS() && SEC());
  }

  // ---- les chaumières : le linge, le potager et son jardinier, le bois, le coq sur la meule, le chat devant la porte, les voisins à l'ombre en canicule
  de('cabane').slice(0, 2).forEach((kc, n) => {
    const R = kc.rel, y = kc.y + DALLE;
    if (R.linge) { // le linge sur sa corde : il sèche, claque dans la tempête, on le décroche quand le ciel se couvre
      const [lx, lz, cap] = R.linge, nb = () => METEO === 'nuageux' ? 4 - Math.min(4, Math.floor((t % 20) / 3)) : 4;
      for (let j = 0; j < 4; j++) {
        const q = posB(kc, lx + (-1.0 + j * 0.66) * Math.cos(cap), lz - (-1.0 + j * 0.66) * Math.sin(cap)); // le long de la corde
        const o = A(`drap${j}`, ECH_BAT); o.rotation.order = 'YXZ';
        ajoute(o, (t, dt, o) => { o.position.set(q.x, kc.y + 2.34 * ECH_BAT, q.z); const a = Math.sin(t * (2 + VENT * 4) + j * 1.3) * (0.15 + VENT * 0.5); o.rotation.set(METEO === 'tempete' ? -1.2 + Math.sin(t * 9 + j) * 0.35 : a, kc.th + cap, 0); }, () => ((DEHORS() && SEC()) || (METEO === 'tempete' && !NUIT())) && j < nb());
      }
      if (n === 0) ajoute(A('commere1'), (t, dt, o) => { const u = Math.min(3, Math.floor((t % 20) / 3)), d = -1 + u * 0.66, q = posB(kc, lx + Math.cos(cap) * d + Math.sin(cap) * 0.6, lz - Math.sin(cap) * d + Math.cos(cap) * 0.6); o.position.set(q.x, y, q.z); o.rotation.y = kc.th + cap + Math.PI / 2; }, () => DEHORS() && METEO === 'nuageux');
    }
    if (n > 0) return;
    const d = portesDe(kc)[0];
    if (d) ajoute(A('chat1', ECH * 1.3), (t, dt, o) => surCadre(o, d.m, 0.62, 0.25, 0.4, -Math.PI / 2 + Math.sin(t * 0.4) * 0.5, 0, 0, S * 1.3), () => JOUR() && DOUX());
    // le jardinier arrose le potager l'été
    { const [px, pz] = ROND(0), a0 = 0.4 + Math.PI / 4, tg = [Math.cos(a0 - Math.PI / 2 + Math.PI), Math.sin(a0 - Math.PI / 2 + Math.PI)]; let pro = 0;
      ajoute(A('jardinier'), (t, dt, o) => { const u = Math.sin(t * 0.25) * 1.1, p = pres(kc, px + Math.cos(a0) * 1.15 + tg[0] * u, pz + Math.sin(a0) * 1.15 + tg[1] * u); o.position.set(p.x, p.y, p.z); o.rotation.y = capB(kc, -Math.cos(a0), -Math.sin(a0)); o.updateMatrix(); if ((pro -= dt) <= 0) { pro = 0.12; const b = _v.set(1.05, 0.95, 0.3).applyMatrix4(o.matrix); particule({ x: b.x, y: b.y, z: b.z, vx: (Math.random() - 0.5) * 0.02, vy: 0, vz: (Math.random() - 0.5) * 0.02, g: 0.6, s: 0.003, col: 0x9fd4f2, vie: 0.35 }); } }, () => SAISON === 2 && JOUR() && SEC() && METEO !== 'brouillard'); }
    // on fend du bois à l'automne, on le rentre l'hiver
    { const [bx, bz] = ROND(1), bil = monde(kc, bx + 1.4, 0.8, bz + 0.6);
      ajoute(A('fendeur'), (t, dt, o) => { const p = pres(kc, bx + 0.55, bz + 0.6), s = Math.sin(t * 4); o.position.set(p.x, p.y, p.z); o.rotation.set(0, capB(kc, 1, 0), -Math.max(0, s) * 0.6); if (s < -0.97 && Math.random() < 0.4) for (let k = 0; k < 3; k++) particule({ genre: 'plaque', x: bil.x, y: bil.y, z: bil.z, vx: (Math.random() - 0.5) * 0.25, vy: 0.2 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.25, g: 1.2, spin: 10, s: 0.006, forme: [1, 0.4, 0.6], col: 0xd9b07a, vie: 0.7, sol: y }); }, () => SAISON === 3 && DEHORS() && SEC());
      const tas = pres(kc, bx, bz + 1.4), porte = portesDe(kc).map(p => dansCadre(p.m, 0, 0, 1.0)).sort((a, b) => Math.hypot(a.x - tas.x, a.z - tas.z) - Math.hypot(b.x - tas.x, b.z - tas.z))[0];
      if (porte) ajoute(A('porteurBois'), (t, dt, o) => longer(o, [tas, porte], t * 0.04, false, y), () => SAISON === 0 && DEHORS() && !ORAGEUX());
    }
    // le coq chante sur la meule
    { const p = pres(kc, 0, 0); let avant = 0;
      ajoute(A('coq', ECH * 1.4), (t, dt, o) => { const cy = t % 2.6, chante = cy < 0.9; o.position.set(p.x, kc.y + 0.108, p.z); o.rotation.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z) - Math.PI / 2 + 0.7, chante ? 0.45 : Math.sin(t * 3) * 0.05); if (chante && avant >= 0.9) { o.updateMatrix(); const b = _v.set(0.5, 1.0, 0).applyMatrix4(o.matrix); for (let k = 0; k < 3; k++) particule({ genre: 'son', x: b.x, y: b.y + 0.004, z: b.z, s: 0.018 + k * 0.008, col: 0xfff6d0, vie: 0.5 + k * 0.25 }); } avant = cy; }, () => AUBE() || (JOUR() && H.p < 25)); }
    // canicule : deux voisins s'éventent à l'ombre de l'arbre
    [['assis0', 0.4, 4.0, -0.4], ['assis1', 2.7, 3.7, Math.PI + 0.5]].forEach(([nom, x, z, ry], i) => ajoute(A(nom), (t, dt, o) => { const p = pres(kc, x, z); o.position.set(p.x, p.y, p.z); o.rotation.set(0, kc.th + ry, Math.sin(t * 7 + i) * 0.05); }, () => METEO === 'canicule' && JOUR()));
    // les seaux sous les fuites des chaumières (1700)
    for (const s of kc.rel.seaux) { const p = pres(kc, s[0], s[2]); ajoute(A('seau', ECH_BAT), (t, dt, o) => o.position.set(p.x, p.y, p.z), () => PLUIE() && EPOQUE === 'ancien'); }
  });

  // ---- on dîne dehors les soirs d'été (tables relevées : chaumière, hôtel particulier)
  TABLES.slice(0, 3).forEach((T, n) => {
    const Mt = cadre(T.k, T.x, 0.25, T.z, T.ry);
    [[-0.5, 0.95, Math.PI / 2], [0.5, 0.95, Math.PI / 2], [-0.5, -0.95, -Math.PI / 2], [0.5, -0.95, -Math.PI / 2]].forEach(([x, z, ry], i) => ajoute(A(`assis${(i + n) % 4}`), (t, dt, o) => surCadre(o, Mt, x, 0, z, ry, 0, Math.sin(t * 1.7 + i * 2 + n) * 0.07, S), () => SAISON === 2 && SEC() && (SOIR() || (NUIT() && H.p < 35))));
  });

  // ---- le hibou, dans l'arbre d'une maison ou d'une chaumière
  { const k = un('maison') || un('cabane');
    if (k) { const p = monde(k, k.cle === 'maison' ? 3 : 1.5, k.cle === 'maison' ? 3.25 : 2.9, k.cle === 'maison' ? 1.2 : 3);
      ajoute(A('hibou', ECH * 1.5), (t, dt, o) => { o.position.copy(p); const vif = Math.sin(t * 0.37) > 0.6 ? 1.6 : 0; o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z) - Math.PI / 2 + Math.sin(t * 0.5) * 1.1 + vif; o.updateMatrix(); for (const e of [0.12, -0.12]) PETIT.mettre(_v.set(0.33, 0.95, e).applyMatrix4(o.matrix), _col.setHex(0xffd34d), NUIT() ? 1 : 0.4); }, () => (NUIT() || (SOIR() && H.p > 15)) && !PLUVIEUX()); }
  }
  // ---- le boulanger : il allume son four avant l'aube, puis sort ses pains
  if (kb) {
    const four = monde(kb, 3.2, 0.55, 0.4);
    ajoute(A('boulanger'), (t, dt, o) => { const p = pres(kb, 3.2, 1.35); o.position.set(p.x, p.y, p.z); o.rotation.set(0, capB(kb, 0, -1), -Math.max(0, Math.sin(t * 1.4)) * 0.45); }, () => NUIT() && H.p > 35);
    ajoute(A('boulanger'), (t, dt, o) => longer(o, [pres(kb, 3.2, 1.35), pres(kb, 1.2, 1.9)], t * 0.03, false, kb.y + DALLE), () => AUBE() || (JOUR() && H.p < 60));
    ajoute(RIEN, (t) => GRAND.mettre(four, _col.setHex(0xff7a1c), 0.75 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.08), () => (NUIT() && H.p > 32) || AUBE() || (JOUR() && H.p < 90));
  }
  // ---- la taverne s'anime le soir
  if (kt) {
    const d = portesDe(kt)[0], quand = () => ((SOIR() && H.p > 3) || (NUIT() && H.p < 50)) && !ORAGEUX(), y = kt.y + DALLE;
    if (d) {
      const a = dansCadre(d.m, 0, 0, 0.35), b = dansCadre(d.m, 2.2, 0, 3.4), c2 = dansCadre(d.m, -1.8, 0, 3.0);
      ajoute(A('buveur0'), (t, dt, o) => longer(o, [a, b], t * 0.03, false, y), quand);
      ajoute(A('buveur1'), (t, dt, o) => longer(o, [a, c2], t * 0.026 + 0.1, false, y), quand);
      ajoute(A('buveur2'), (t, dt, o) => surCadre(o, d.m, 0.9 + Math.sin(t * 0.5) * 0.35, 0.25, 1.4 + Math.sin(t * 0.37) * 0.2, Math.sin(t * 0.8) * 1.2, 0, Math.sin(t * 2.1) * 0.3, S), quand);
    }
  }
  // ---- tuiles qui s'envolent dans la tempête
  { let pro = 0; const toits = TOITS.filter(r => r.petit); ajoute(RIEN, (t, dt) => { if ((pro -= dt) > 0 || !toits.length) return; pro = 0.5 + Math.random() * 0.8; const r = toits[Math.random() * toits.length | 0], p = dansCadre(r.m, (Math.random() - 0.5) * r.w * 0.4, r.h * 0.75, (Math.random() - 0.5) * r.d * 0.7); particule({ genre: 'plaque', x: p.x, y: p.y, z: p.z, vx: 0.25 + Math.random() * 0.2, vy: 0.3 + Math.random() * 0.25, vz: 0.1 + Math.random() * 0.1, g: 0.55, spin: 7 + Math.random() * 6, s: 0.03, forme: [1, 0.15, 0.7], col: r.col, vie: 2.6, sol: r.k.y + 0.004, vent: 0.6 }); }, () => METEO === 'tempete'); }

  if (GRAPHE.length > 3) construireRues(A, centre, kt);
  for (const k of de('marche').slice(0, 2)) construireMarche(A, k);
  for (const k of de('ecole').slice(0, 2)) construireEcole(A, k);
  if (kh) construireCrieur(A, kh, portesDe);
}

// ------------------------------------------------------------------ les rues : promeneurs, couples, enfants, métiers, patrouille, attelages
/** La part des promeneurs dehors (0 : personne, 1 : tout le monde) selon le temps, la saison et l'heure. */
function foule() {
  if (ORAGEUX() || NUIT()) return 0;
  let f = { beau: 1, nuageux: 0.85, pluie: 0.35, brouillard: 0.45, neige: 0.5, canicule: 0.3 }[METEO] ?? 0.8;
  if (SAISON === 0 && METEO !== 'neige') f *= 0.75;
  if (AUBE()) return H.p > 15 ? 0.2 * f : 0;
  if (SOIR()) return (SAISON === 2 && (SEC() || METEO === 'canicule') ? 1 : 0.3 * f) * (H.p < 20 ? 1 : 0.35); // la promenade du soir l'été
  return f;
}
const PROMENADE_SOIR = () => SOIR() && SAISON === 2 && foule() > 0.5;
const MARCHE_OUVERT = () => (JOUR() || (SOIR() && H.p < 8)) && !ORAGEUX();
// le jour de marché vient du moteur (villes[].jour_marche : pas de marché sous siège, blocus ou disette) ; à défaut, le cycle
const JOUR_MARCHE = kM => {
  if (climat.marcheForce != null) return climat.marcheForce;
  const v = kM && ETAT?.villes?.find(x => x.id === kM.b?.ville);
  return v && 'jour_marche' in v ? !!v.jour_marche : !!climat.marche;
};

function construireRues(A, centre, kt) {
  const ep = EPOQUE;
  const nomH = i => mod(`homme_${ep}_${i}`, () => HOMME(ep, i)), nomF = i => mod(`dame_${ep}_${i}`, () => DAME(ep, i));
  const pluieH = i => mod(`hommeP_${ep}_${i}`, () => HOMME(ep, i, true)), pluieF = i => mod(`dameP_${ep}_${i}`, () => DAME(ep, i, true));
  const gamin = (i, b = false) => mod(`ecolier_${ep}_${i}${b ? 'b' : ''}`, () => ECOLIER(ep, i, b));
  const pluieP = { ancien: 'sac', lumieres: 'parapluieVert', empire: 'parapluieRouge', industrie: 'parapluieNoir' }[ep];
  // le chef d'orchestre : il fait avancer tous les promeneurs (visibles ou non) et déclenche les saluts
  ajoute(RIEN, (t, dt) => { for (const w of PROMENEURS) { w.vis = w.visible(); pasPromeneur(w, dt); } saluts(); }, null);
  // ---- promeneurs seuls : bourgeois de l'époque et gens du peuple ; le rang décide qui reste dehors quand la foule baisse
  const SOLO = [['h', 0, 0.05, 0.05], ['f', 1, 0.12, 0.042], ['p', 'passante0', 0.2, 0.055], ['h', 1, 0.28, 0.062], ['f', 0, 0.33, 0.038], ['p', 'passant1', 0.42, 0.066],
    ['p', 'commere1', 0.5, 0.045], ['h', 0, 0.58, 0.032, 0.6], ['f', 1, 0.66, 0.05], ['p', 'passant0', 0.75, 0.072], ['f', 0, 0.83, 0.04], ['p', 'passante1', 0.92, 0.052]];
  const solos = SOLO.map(([g, m, r, v, flane = 0.25], i) => {
    const w = promeneur(i, v, { flane, visible: () => r < foule() });
    const nom = g === 'h' ? nomH(m) : g === 'f' ? nomF(m) : m, np = g === 'h' ? pluieH(m) : g === 'f' ? pluieF(m) : pluieP;
    ajoute(A(nom), (t, dt, o) => poser(o, w), () => w.vis && !PLUIE());
    ajoute(A(np), (t, dt, o) => poser(o, w), () => w.vis && PLUIE());
    return w;
  });
  // les chiens qui suivent leur maître
  [[0, 'chien0'], [3, 'chien1']].forEach(([n, nom]) => ajoute(A(mod(nom, () => n ? CHIEN(0xd9c8a0, 0x8a6a4a) : CHIEN(0x5a3a2a, 0x2a1f18)), ECH * 1.1), (t, dt, o) => poser(o, solos[n], -0.03, 0.014, 2.2), () => solos[n].vis));
  // ---- couples bras dessus bras dessous : tous dehors à la promenade du soir l'été
  [[0, 1, 0.55], [1, 0, 0.7], [0, 0, 0.85]].forEach(([h, f, r], i) => {
    const w = promeneur(20 + i, 0.03, { flane: 0.35, visible: () => (r < foule() && !PLUIE()) || PROMENADE_SOIR() });
    ajoute(A(nomH(h)), (t, dt, o) => poser(o, w, 0, -0.011), () => w.vis);
    ajoute(A(nomF(f)), (t, dt, o) => poser(o, w, 0, 0.011), () => w.vis);
  });
  // ---- mères avec leurs enfants
  [['commere0', 0.38, 2], [nomF(0), 0.62, 1]].forEach(([nom, r, nb], i) => {
    const w = promeneur(30 + i, 0.035, { flane: 0.4, visible: () => r < foule() && !PLUIE() });
    ajoute(A(nom), (t, dt, o) => poser(o, w), () => w.vis);
    for (let n = 0; n < nb; n++) ajoute(A(gamin(n), ECH * 0.72), (t, dt, o) => poser(o, w, -0.008 - n * 0.012, n ? -0.016 : 0.016, 1.8), () => w.vis);
  });
  // ---- les enfants qui courent : pas pendant l'école (sauf les vacances), ni sous la pluie ; le cerceau
  const libres = () => DEHORS() && SEC() && METEO !== 'canicule' && !EN_CLASSE();
  [0.1, 0.4, 0.7].forEach((r, i) => {
    const w = promeneur(40 + i, 0.1 + i * 0.012, { flane: 0.4, saut: 0.008, f: 90, lat: 0.03, salue: false, visible: () => libres() && r < foule() });
    ajoute(A(gamin(i % 2), ECH * 0.72), (t, dt, o) => poser(o, w), () => w.vis);
  });
  { const w = promeneur(45, 0.085, { flane: 0.2, saut: 0.006, f: 80, salue: false, visible: () => libres() && foule() > 0.4 });
    ajoute(A(gamin(1), ECH * 0.72), (t, dt, o) => poser(o, w), () => w.vis);
    ajoute(A(mod('cerceau', () => CERCEAU), ECH * 0.72), (t, dt, o) => { poser(o, w, 0.022, 0.004); o.position.y = w.y; o.rotation.set(0, w.cap, -w.d / (0.55 * ECH * 0.72)); }, () => w.vis);
  }
  // ---- la marelle de la rue : sur le joint le plus proche du centre, on saute à cloche-pied jusqu'au ciel, puis on revient
  { const a = GRAPHE.reduce((m, n, i) => (n.v.length && Math.hypot(n.x - centre.x, n.z - centre.z) < Math.hypot(GRAPHE[m].x - centre.x, GRAPHE[m].z - centre.z) ? i : m), 0), b = GRAPHE[GRAPHE[a].v[0] ?? a];
    const A0 = GRAPHE[a], l = Math.hypot(b.x - A0.x, b.z - A0.z) || 1, ux = (b.x - A0.x) / l, uz = (b.z - A0.z) / l, x0 = A0.x + ux * 0.2, z0 = A0.z + uz * 0.2, y = A0.y;
    const cases = casesMarelle(x0, z0, ux, uz, 0.034), n = cases.length;
    ajoute(A(gamin(0), ECH * 0.72), (t, dt, o) => {
      const u = (t / 0.45) % (2 * n), i = Math.floor(u), f = u - i, ia = i < n ? i : 2 * n - 1 - i, ib = Math.min(n - 1, Math.max(0, i < n ? ia + 1 : ia - 1));
      const ca = cases[ia], cb = i === n - 1 || i === 2 * n - 1 ? ca : cases[ib], g = f < 0.6 ? 0 : (f - 0.6) / 0.4;
      o.position.set(ca.x + (cb.x - ca.x) * g, y + Math.sin(Math.PI * g) * 0.012, ca.z + (cb.z - ca.z) * g); o.rotation.set(0, -Math.atan2(uz * (i < n ? 1 : -1), ux * (i < n ? 1 : -1)), 0);
    }, () => libres() && !NEIGE_SOL());
    ajoute(A(gamin(1), ECH * 0.72), (t, dt, o) => { o.position.set(x0 - uz * 0.03 - ux * 0.04, y, z0 + ux * 0.03 - uz * 0.04); o.rotation.set(0, -Math.atan2(uz, ux), Math.sin(t * 1.3) * 0.04); }, () => libres() && !NEIGE_SOL());
  }
  // ---- les métiers de la rue
  const matin = () => (AUBE() && H.p > 10) || (JOUR() && H.p < 160);
  { const w = promeneur(50, 0.034, { flane: 0.6, saut: 0.002, visible: () => matin() && !ORAGEUX() }); ajoute(A(mod('porteurEau', PORTEUR_EAU)), (t, dt, o) => poser(o, w), () => w.vis); }
  { const w = promeneur(51, 0.03, { flane: 0.5, visible: () => JOUR() && SEC() && foule() > 0.3 }); ajoute(A(mod('colporteur', COLPORTEUR)), (t, dt, o) => poser(o, w), () => w.vis); }
  { const w = promeneur(52, 0.028, { flane: 0.8, pauseL: 4, salue: false, visible: () => JOUR() && SEC() && foule() > 0.3 });
    ajoute(A(mod('remouleur', REMOULEUR)), (t, dt, o) => { poser(o, w); if (w.pause > 0.4 && Math.random() < 0.6) { o.updateMatrix(); const p = _v.set(1.0, 1.72, 0).applyMatrix4(o.matrix); particule({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.2, vy: 0.08 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.2, g: 1.4, s: 0.0022, col: Math.random() < 0.5 ? 0xffd04a : 0xff8a2a, vie: 0.35 }); } }, () => w.vis); }
  { const w = promeneur(53, 0.03, { flane: 0.6, pauseL: 3, salue: false, visible: () => JOUR() && SEC() && foule() > 0.3 }); ajoute(A(mod(`charrette${SAISON}`, () => CHARRETTE(SAISON))), (t, dt, o) => poser(o, w), () => w.vis); }
  // ---- la patrouille : deux soldats au pas, l'uniforme de l'époque
  { const w = promeneur(60, 0.045, { veh: true, lat: 0, flane: 0.15, saut: 0.004, f: 70, salue: false, visible: () => (JOUR() || SOIR() || (AUBE() && H.p > 10)) && !ORAGEUX() });
    const nom = mod(`soldat_${ep}`, () => SOLDAT(ep));
    ajoute(A(nom), (t, dt, o) => poser(o, w, 0, -0.014), () => w.vis);
    ajoute(A(nom), (t, dt, o) => poser(o, w, 0, 0.014), () => w.vis);
  }
  // ---- les attelages : un cavalier à toutes les époques, la calèche (Empire) ou le fiacre (Industrie), l'omnibus à cheval (Industrie)
  { const w = promeneur(70, 0.085, { veh: true, lat: 0.01, flane: 0.1, saut: 0.005, f: 60, salue: false, visible: () => JOUR() && foule() >= 0.3 }); ajoute(A(mod(`cavalier_${ep}`, () => CAVALIER(ep))), (t, dt, o) => poser(o, w), () => w.vis); }
  if (ep === 'empire' || ep === 'industrie') {
    const w = promeneur(71, 0.06, { veh: true, lat: 0, flane: 0.1, saut: 0.002, f: 60, salue: false, visible: ep === 'empire' ? () => JOUR() && SEC() && foule() >= 0.45 : () => (JOUR() || (SOIR() && H.p < 20)) && !ORAGEUX() });
    ajoute(A(mod(`voiture_${ep}`, () => VOITURE(ep))), (t, dt, o) => { poser(o, w); if (ep === 'industrie' && (SOIR() || METEO === 'brouillard')) { o.updateMatrix(); for (const z of [0.62, -0.62]) HALO.mettre(_v.set(-0.2, 1.7, z).applyMatrix4(o.matrix), _col.setHex(RUE.industrie), 0.8); } }, () => w.vis);
  }
  if (ep === 'industrie') { const w = promeneur(72, 0.05, { veh: true, lat: 0, flane: 0.3, pauseL: 4, saut: 0.002, f: 60, salue: false, visible: () => (JOUR() || (SOIR() && H.p < 20)) && !ORAGEUX() }); ajoute(A(mod('omnibus', OMNIBUS)), (t, dt, o) => poser(o, w), () => w.vis); }
  // ---- la nuit : on rentre de la taverne en zigzag, la lanterne à la main
  if (kt) {
    const p0 = V(kt.x, 0, kt.z), proche = GRAPHE.map((n, i) => [Math.hypot(n.x - p0.x, n.z - p0.z), i]).sort((a, b) => a[0] - b[0])[0][1];
    ['porteLanterne', 'buveur2'].forEach((nom, i) => {
      const w = promeneur(80 + i, 0.022, { flane: 0.5, salue: false, visible: () => NUIT() && H.p < 50 && !ORAGEUX() });
      w.a = proche; w.b = GRAPHE[proche].v[i % GRAPHE[proche].v.length] ?? proche;
      ajoute(A(nom), (t, dt, o) => { w.lat = 0.03 + Math.sin(t * 1.7 + i) * 0.02; poser(o, w); o.rotation.z = Math.sin(t * 2.1 + i * 2) * 0.22; if (i === 0) { o.updateMatrix(); HALO.mettre(_v.set(0.55, 1.3, 0.3).applyMatrix4(o.matrix), _col.setHex(RUE[ep]), 1); } }, () => w.vis);
    });
  }
}

// ------------------------------------------------------------------ le crieur public devant la mairie : roulement de tambour (clochette avant l'Empire), lecture, on s'attroupe
function construireCrieur(A, kh, portesDe) {
  const ep = EPOQUE, d = portesDe(kh).find(p => p.rec.mairie) || portesDe(kh).at(-1); if (!d) return;
  const quand = () => JOUR() && foule() >= 0.3 && !PLUIE(), cy = () => t % 22, S = 0.4;
  ajoute(A(mod(`crieur_${ep}`, () => CRIEUR(ep))), (t, dt, o) => {
    const c = cy(), appel = c < 3; surCadre(o, d.m, -1.3, 0.25, 1.2, -Math.PI / 2, 0, appel ? Math.sin(t * 18) * 0.06 : c < 14 ? 0.12 + Math.sin(t * 1.5) * 0.03 : 0, S);
    if (appel && Math.random() < 0.15) { o.updateMatrix(); const p = _v.set(0.35, 1.3, 0.4).applyMatrix4(o.matrix); particule({ genre: 'son', x: p.x, y: p.y + 0.01, z: p.z, s: 0.03, col: 0xfff0c0, vie: 0.5 }); }
  }, quand);
  [['passant1', -2.1, 2.3, 0.2], [mod(`dame_${ep}_0`, () => DAME(ep, 0)), -1.25, 2.6, 0], ['commere0', -0.5, 2.35, -0.25]].forEach(([nom, x, z, a], i) => ajoute(A(nom), (t, dt, o) => surCadre(o, d.m, x, 0.25, z, Math.PI / 2 + a, 0, Math.sin(t * 1.1 + i) * 0.03, S), () => quand() && cy() > 2 + i * 0.6 && cy() < 15 - i * 0.4));
}

// ------------------------------------------------------------------ le marché : marchands derrière leurs étals, clients d'étal en étal ; plus de monde le jour de marché
function construireMarche(A, kM) {
  const ep = EPOQUE, yM = kM.y + DALLE;
  // les bâches de la nuit et le carreau du jour de marché, posés sur le modèle
  const g = piecesMarche(SAISON);
  for (const x of [g.bache, g.carreau]) { x.matrixAutoUpdate = false; x.matrix.copy(kM.M); x.visible = false; ROOT.add(x); }
  MARCHES.push(g);
  ajoute(RIEN, () => { const o = MARCHE_OUVERT(); g.bache.visible = !o; g.carreau.visible = o && JOUR_MARCHE(kM) && SEC(); }, null);
  const ANG = [...ETALS.map(([x, z]) => Math.atan2(z, x)), -Math.PI / 2], clients = [];
  const nbClients = () => !MARCHE_OUVERT() ? 0 : Math.round((JOUR_MARCHE(kM) ? 8 : 3) * (PLUIE() ? 0.5 : 1) * (SAISON === 0 || METEO === 'neige' ? 0.75 : 1) * (METEO === 'canicule' ? 0.5 : 1));
  const nomsClients = [mod('clienteP0', () => [...FEMME(0x8a4a7a, 0xf2e6c8), ...PANIER()]), mod('clienteP1', () => [...FEMME(0x5a7a4a), ...PANIER()]), mod(`dameP_${ep}`, () => [...DAME(ep, 0), ...PANIER(0.1, 0.72, 0.95)]), mod('clientP', () => [...PAYSAN(0x6a8aa4), ...PANIER(0.12, 0.46, 1.1)])];
  for (let i = 0; i < 8; i++) {
    const c = { ang: i * 0.8, r: 2.0 + (i % 3) * 0.18, cible: i % 5, pause: i * 0.4, sens: 1 };
    clients.push(c);
    ajoute(A(nomsClients[i % 4]), (t, dt, o) => {
      const cible = ANG[c.cible], diff = Math.atan2(Math.sin(cible - c.ang), Math.cos(cible - c.ang));
      if (c.pause > 0) { c.pause -= dt; if (c.pause <= 0) { let n; do n = Math.random() * 5 | 0; while (n === c.cible); c.cible = n; } } // fini à cet étal : on en choisit un autre
      else if (Math.abs(diff) < 0.01) c.pause = 2 + Math.random() * 3;
      else { c.sens = Math.sign(diff); c.ang += c.sens * Math.min(Math.abs(diff), 0.036 / (c.r * ECH_BAT) * dt); }
      const p = pres(kM, Math.cos(c.ang) * c.r, Math.sin(c.ang) * c.r), arret = c.pause > 0;
      o.position.set(p.x, yM + (arret ? 0 : Math.abs(Math.sin(t * 9 + i)) * 0.003), p.z);
      o.rotation.set(0, arret ? capB(kM, Math.cos(c.ang), Math.sin(c.ang)) : capB(kM, -Math.sin(c.ang) * c.sens, Math.cos(c.ang) * c.sens), arret ? Math.sin(t * 2 + i) * 0.05 - 0.08 : 0);
    }, () => i < nbClients());
  }
  [['marchand_0', [0xc0504a, false]], ['marchande_1', [0x6a8aa4, true]], ['marchand_2', [0x5a7a4a, false]], ['marchande_3', [0xb8603f, true]], ['volaillere', [0x8a6a4a, true]]].forEach(([nom, [c, femme]], i) => {
    const [sx, sz] = i < 4 ? ETALS[i] : [0, -2.6], [mx, mz] = i < 4 ? [sx + Math.sign(sx) * 1.9, sz + Math.sign(sz) * 0.4] : [0, -3.6];
    ajoute(A(mod(nom, () => MARCHAND(c, femme))), (t, dt, o) => {
      const p = pres(kM, mx, mz), client = clients.some((c2, j) => j < nbClients() && c2.cible === i && c2.pause > 0);
      o.position.set(p.x, yM, p.z); o.rotation.set(0, capB(kM, -sx, -sz) + (client ? 0 : Math.sin(t * 0.6 + i) * 0.5), client ? -0.18 + Math.sin(t * 5 + i) * 0.05 : Math.sin(t * 2.2 + i) * 0.04);
    }, MARCHE_OUVERT);
  });
  // le jour de marché : le carreau (marchandes assises au sol), des poules échappées, plus de clients
  const jm = () => JOUR_MARCHE(kM) && MARCHE_OUVERT() && SEC();
  [['assis1', 0, 6.45, 0, -1], ['assis3', -6.85, 2.9, 1, 0], ['assis1', 6.85, 3.0, -1, 0]].forEach(([nom, x, z, dx, dz], i) => ajoute(A(nom), (t, dt, o) => { const p = pres(kM, x, z); o.position.set(p.x, yM, p.z); o.rotation.set(0, capB(kM, dx, dz), Math.sin(t * 1.2 + i) * 0.05); }, jm));
  [[mod(`dame_${ep}_1`, () => DAME(ep, 1)), 0.3, 4.75, 0, 1], ['passant0', -5.05, 2.6, -1, 0.1]].forEach(([nom, x, z, dx, dz], i) => ajoute(A(nom), (t, dt, o) => { const p = pres(kM, x + Math.sin(t * 0.3 + i) * 0.4, z); o.position.set(p.x, yM, p.z); o.rotation.set(0, capB(kM, dx, dz) + Math.sin(t * 0.5 + i) * 0.4, -0.06); }, () => jm() && foule() > 0.4));
  for (let i = 0; i < 5; i++) ajoute(A(mod(`poule${i % 2}`, () => POULE(i % 2 ? 0xb8602a : 0xf2eee4)), ECH * 0.9), (t, dt, o) => {
    const a = t * 0.3 * (1 + i * 0.2) + i * 1.3, rr = 0.35 + 0.25 * Math.sin(t * 0.5 + i), p = pres(kM, 2.4 + Math.cos(a) * rr, 6.95 + Math.sin(a) * rr * 0.6);
    o.position.set(p.x, yM, p.z); o.rotation.set(0, capB(kM, -Math.sin(a), Math.cos(a) * 0.8), -Math.max(0, Math.sin(t * 4 + i * 2)) * 0.7);
  }, jm);
  // l'hiver : marrons chauds au brasero
  const braise = kM.rel.braise ? monde(kM, ...kM.rel.braise) : null;
  if (braise) ajoute(A(mod('marronnier', () => [...MARCHAND(0x5a4a3a), [cyl(0.3, 0.3, 0.06, 8), 0.6, 1.35, 0.2, 0x2b2b30]])), (t, dt, o) => {
    const p = pres(kM, 5.25, 1.35); o.position.set(p.x, yM, p.z); o.rotation.set(0, capB(kM, 0.6, -0.7), Math.sin(t * 6) * 0.08);
    GRAND.mettre(braise, _col.setHex(0xff7a1c), 0.55 + Math.sin(t * 11) * 0.1); if (Math.random() < 0.08) bouffee(braise.x, braise.y + 0.02, braise.z, 'blanche', 0.5);
  }, () => SAISON === 0 && MARCHE_OUVERT());
}

// ------------------------------------------------------------------ l'école : cloche, arrivée du matin, classe, récréation, sortie ; fermée l'été, vide la nuit
function construireEcole(A, kE) {
  const ep = EPOQUE, E = { ancien: 1, lumieres: 1.15, empire: 1.5, industrie: 1.7 }[ep], hm = 2.4 * E, yE = kE.y + DALLE, yC = kE.y + 0.045; // yC : la cour, un peu surélevée
  const loc = (x, z) => posB(kE, x, z);
  const gamin = (i, b = false) => mod(`ecolier_${ep}_${i}${b ? 'b' : ''}`, () => ECOLIER(ep, i, b));
  const SONNE = [[0, 7], [90, 96], [120, 126], [200, 206], [225, 231]], sonne = () => JOUR() && SAISON !== 2 && SONNE.some(([a, b]) => H.p >= a && H.p < b);
  { const cl = A('cloche', 0.1), pos = monde(kE, 1.4, hm + 1.62, -1.47); let pro = 0;
    ajoute(cl, (t, dt, o) => { o.position.copy(pos); const s = sonne(); o.rotation.set(0, kE.th, s ? Math.sin(t * 13) * 0.55 : 0); if (s && (pro -= dt) <= 0) { pro = 0.28; particule({ genre: 'son', x: pos.x, y: pos.y + 0.01, z: pos.z + 0.01, s: 0.035, col: 0xfff0c0, vie: 0.6 }); } }, null); }
  const CHEMINS = [[[-7.8, 2.0], [-3.6, 0.35], [-0.6, 0.3], [0.65, 0.05]], [[-7.4, -4.0], [-3.5, -0.2], [-0.6, 0.25], [0.65, 0.05]], [[2.4, -6.0], [3.4, -4.2], [3.5, 0.15], [1.7, 0.3], [0.65, 0.05]]].map(c => c.map(([x, z]) => loc(x, z)));
  const lg = c => c.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - c[i].x, p.z - c[i].z), 0);
  const hiver = SAISON === 0;
  for (let j = 0; j < 10; j++) {
    const ch = CHEMINS[j % 3], L = lg(ch), retour = [...ch].reverse(), s0 = j * 3, s1 = 228 + j * 2.2;
    ajoute(A(gamin(j % 2, hiver), ECH * 0.72), (t, dt, o) => {
      const ar = ECOLE() === 'arrivee';
      longer(o, ar ? ch : retour, Math.min(0.9999, Math.max(0, (H.p - (ar ? s0 : s1)) / (ar ? 60 : 45))) * L, false, yE, ar ? 0.006 : 0.012);
    }, () => { const e = ECOLE(), s = H.p; return DEHORS_ECOLE() && ((e === 'arrivee' && s > s0 && s < s0 + 60) || (e === 'sortie' && s > s1 && s < s1 + 45)); });
  }
  ajoute(A('commere0'), (t, dt, o) => longer(o, CHEMINS[0].slice(0, 2), Math.max(0, H.p - 2) / 85 * 2 * lg(CHEMINS[0].slice(0, 2)), false, yE), () => ECOLE() === 'arrivee' && DEHORS_ECOLE() && H.p > 2);
  [['commere1', -1.1, 5.0], [mod(`dame_${ep}_1`, () => DAME(ep, 1)), 1.2, 5.1]].forEach(([nom, x, z], i) => ajoute(A(nom), (t, dt, o) => { const p = loc(x, z); o.position.set(p.x, yE, p.z); o.rotation.set(0, capB(kE, 0.3 - i * 0.6, -1) + Math.sin(t * 0.4 + i) * 0.3, 0); }, () => ECOLE() === 'sortie' && DEHORS_ECOLE()));
  ajoute(A(mod(`maitre_${ep}`, () => MAITRE(ep))), (t, dt, o) => { const p = loc(1.55, 0.05); o.position.set(p.x, yE, p.z); o.rotation.set(0, capB(kE, 0, 1) + Math.sin(t * 0.5) * 0.6, sonne() ? -0.1 : 0); }, () => { const e = ECOLE(); return (e === 'arrivee' || e === 'recre' || e === 'sortie') && DEHORS_ECOLE(); });
  // la classe : on récite, les voix sortent par les fenêtres
  { const fens = FEN.filter(f => f.k === kE && f.rec.ry === 0); let pro = 0;
    ajoute(RIEN, (t, dt) => { if ((pro -= dt) > 0 || !fens.length) return; pro = 0.7; const f = fens[Math.random() * fens.length | 0]; particule({ genre: 'son', x: f.c.x + f.n.x * 0.01, y: f.c.y, z: f.c.z + f.n.z * 0.01, s: 0.022, col: 0xfff6d0, vie: 0.7 }); }, () => ECOLE() === 'classe' && SEC()); }
  // la récréation : marelle, ballon, corde à sauter ; sous la neige, boules de neige et glissades ; sous la pluie, en classe (sous le préau à l'ère industrielle)
  const neige = NEIGE_SOL(), recre = () => ECOLE() === 'recre' && DEHORS_ECOLE() && (SEC() || METEO === 'neige'), preau = () => ECOLE() === 'recre' && PLUVIEUX() && DEHORS_ECOLE() && ep === 'industrie';
  const enCour = (o, x, z, cap, y = yC) => { const p = loc(x, z); o.position.set(p.x, y, p.z); o.rotation.set(0, cap, 0); };
  if (!neige) {
    const cases = casesMarelle(-1.6, 3.5, 1, 0, 0.42).map(c => loc(c.x, c.z)), n = cases.length;
    ajoute(A(gamin(0), ECH * 0.72), (t, dt, o) => {
      const u = (t / 0.45) % (2 * n), i = Math.floor(u), f = u - i, a = i < n ? i : 2 * n - 1 - i, b = i === n - 1 || i === 2 * n - 1 ? a : i < n ? a + 1 : a - 1, g = f < 0.6 ? 0 : (f - 0.6) / 0.4;
      o.position.set(cases[a].x + (cases[b].x - cases[a].x) * g, yC + Math.sin(Math.PI * g) * 0.012, cases[a].z + (cases[b].z - cases[a].z) * g); o.rotation.set(0, capB(kE, i < n ? 1 : -1, 0), 0);
    }, recre);
    ajoute(A(gamin(1), ECH * 0.72), (t, dt, o) => enCour(o, -2.25, 3.0, capB(kE, 1, 0.5)), recre);
    // la corde : deux enfants la font tourner, un troisième saute quand elle passe sous ses pieds
    const corde = A(mod('corde', () => CORDE), 0.034), mil = loc(0.15, 1.5);
    ajoute(A(gamin(1), ECH * 0.72), (t, dt, o) => enCour(o, -0.6, 1.5, capB(kE, 1, 0)), recre);
    ajoute(A(gamin(0), ECH * 0.72), (t, dt, o) => enCour(o, 0.9, 1.5, capB(kE, -1, 0)), recre);
    corde.rotation.order = 'YXZ';
    ajoute(corde, (t, dt, o) => { o.position.set(mil.x, yC + 0.0005, mil.z); o.rotation.set(t * 7, kE.th + Math.PI / 2, 0); }, recre);
    ajoute(A(gamin(1), ECH * 0.72), (t, dt, o) => enCour(o, 0.15, 1.5, capB(kE, 0, 1), yC + Math.pow(Math.max(0, -Math.cos(t * 7)), 3) * 0.016), recre);
  }
  { // le ballon (ou les boules de neige) entre trois enfants
    const K = [[-1.7, 2.4], [1.6, 2.5], [0.1, 2.95]].map(([x, z]) => loc(x, z)), ball = A(mod('ballon', () => BALLON), ECH * 0.6);
    const passe = t => { const n = Math.floor(t / 1.1), f = (t / 1.1) % 1; return { a: n % 3, b: (n + 1) % 3, f }; };
    K.forEach((p, i) => ajoute(A(gamin(i % 2), ECH * 0.72), (t, dt, o) => { const { a, b, f } = passe(t), q = a === i ? K[b] : K[a]; o.position.set(p.x, yC + (b === i && f > 0.85 ? 0.004 : 0), p.z); o.rotation.set(0, -Math.atan2(q.z - p.z, q.x - p.x), a === i && f < 0.15 ? -0.25 : 0); }, recre));
    let avant = -1;
    ajoute(ball, (t, dt, o) => { const { a, b, f } = passe(t); o.position.set(K[a].x + (K[b].x - K[a].x) * f, yC + 0.007 + Math.sin(Math.PI * f) * 0.03, K[a].z + (K[b].z - K[a].z) * f); o.rotation.set(t * 5, t * 3, 0); }, () => recre() && !neige);
    ajoute(RIEN, (t) => { const { a, b } = passe(t), n = Math.floor(t / 1.1); if (n === avant) return; avant = n; const T = 1.0, g = 0.7, A_ = K[a], B = K[b]; particule({ x: A_.x, y: yC + 0.06, z: A_.z, vx: (B.x - A_.x) / T, vz: (B.z - A_.z) / T, vy: 0.5 * g * T, g, s: 0.005, col: 0xffffff, vie: T }); }, () => recre() && neige);
    if (neige) [0, 1].forEach(i => ajoute(A(gamin(i), ECH * 0.72), (t, dt, o) => { const u = ((t * 0.5 + i * 0.5) % 1); enCour(o, -1.8 + u * 3.2, 3.4 - i * 0.5, capB(kE, 1, 0)); o.rotation.z = -0.15; }, recre));
    // sous le préau quand il pleut (ère industrielle)
    if (ep === 'industrie') [[3.4, -2.8], [4.1, -2.2], [4.6, -1.3], [3.5, -1.3], [4.5, -3.0]].forEach(([x, z], i) => ajoute(A(gamin(i % 2), ECH * 0.72), (t, dt, o) => { enCour(o, x, z, capB(kE, Math.cos(i * 2.3 + t * 0.2), Math.sin(i * 2.3)), yE); o.position.y += Math.abs(Math.sin(t * 3 + i)) * 0.003; }, preau));
  }
}

// ------------------------------------------------------------------ boucle
chaqueImage((dt, tt) => {
  t = tt;
  const g = METEO_DE[climat.genre] || climat.genre || 'beau';
  if (g !== METEO) { METEO = g; tMeteo = 0; } else tMeteo += dt;
  SAISON = climat.saison ?? 2; H.phase = climat.phase || climat.heure || 'jour'; H.p = climat.p || 0;
  VENT = climat.vent ?? 0.3; VENT_X = Math.cos(climat.dir || 0) * VENT * 0.22; VENT_Z = Math.sin(climat.dir || 0) * VENT * 0.1;
  majCiel(dt);
  if ((prochaine -= dt) <= 0) {
    prochaine = 0.4;
    const liste = voisinage(), sig = liste.map(b => b.id).join() + '|' + SAISON;
    if (sig !== sigVois || sale) { sigVois = sig; sale = false; reconstruire(liste); }
  }
  if (!BATS.length) { for (const m of [VITRES, VOLETS, VOILES, SILS, FLAQUES, ...Object.values(PI)]) { m.count = 0; m.visible = false; } RUISS_L.visible = false; TROUPE.dessiner(); HALO.fin(); GRAND.fin(); PETIT.fin(); return; }
  majFenetres(dt); majLampes();
  for (const a of ACT) { if (a.quand) { a.o.visible = a.quand(); if (!a.o.visible) continue; } if (a.f) a.f(t, dt, a.o); }
  majEau(dt); majParticules(dt); TROUPE.dessiner();
  HALO.fin(); GRAND.fin(); PETIT.fin();
});

/** Pour les bancs d'essai : ce que fait la vie des quartiers en ce moment. */
export function etatQuartiers() {
  return { proches: BATS.length, persos: TROUPE.nb, acteurs: ACT.length, particules: parts.length, fenetres: FEN.length, allumees: FEN.filter(f => f.lum > 0.5).length, promeneurs: PROMENEURS.filter(w => w.vis).length, rues: GRAPHE.length, phase: H.phase, p: +H.p.toFixed(1), meteo: METEO, saison: SAISON, ecole: ECOLE(), marche: JOUR_MARCHE(), foule: +foule().toFixed(2) };
}
