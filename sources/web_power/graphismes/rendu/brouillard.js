// Le brouillard de guerre (maquettes/guerre.html) : trois états par case, d'après etat.explore et etat.visible.
//   0 jamais explorée : sous une brume crème qui ondule, posée sur des tuiles beiges cernées de brun ; rien n'en dépasse ;
//   1 explorée mais hors de vue : terne et bleutée (terrain et villes connues ; le serveur n'envoie pas les armées) ;
//   2 en vue : normale.
// Une petite texture peinte case par case (adoucie par le filtrage) dit aux matériaux du plateau l'état de chaque point.
// La brume : tuiles et bouffées en instances, figées tant que les cases inconnues ne changent pas ; la houle et la levée
// de la brume (elle s'élève et se dissipe quand on découvre) se jouent dans le shader, d'après une texture d'une valeur par case.
import { THREE, scene, camera, posCase, voisin, chaqueImage, hache } from './scene.js';
import { MAT, CONT, degrade } from './toon.js';
import { carte } from './plateau.js';
import { rayon } from './scene.js';

const SQ3 = Math.sqrt(3);
let C = null, N = 0, vu = new Uint8Array(0), actif = false;
let eclaire = null; // pendant le mois joué : cases découvertes en route par nos armées et nos flottes

// ------------------------------------------------------------------ la texture d'état, lue par les matériaux
const PX = 4; // pixels par unité de plateau (une case fait 1,73 de large)
const BRUME = { on: { value: 0 }, tex: { value: null }, min: { value: new THREE.Vector2(-2, -2) }, taille: { value: new THREE.Vector2(1, 1) } };
let toile = null, texEtat = null;
/** Une toile neuve à la taille de la carte (une texture ne change pas de taille une fois envoyée). */
function nouvelleToile(w, h) {
  texEtat?.dispose();
  toile = document.createElement('canvas'); toile.width = w; toile.height = h;
  texEtat = new THREE.CanvasTexture(toile);
  texEtat.flipY = false; texEtat.generateMipmaps = false; texEtat.minFilter = texEtat.magFilter = THREE.LinearFilter;
  BRUME.tex.value = texEtat;
}
nouvelleToile(4, 4);

const brumises = new WeakSet(), exclus = new WeakSet();
/** Un matériau qui ne doit jamais être terni ni coupé par le brouillard (surbrillances, interface…). */
export const sansBrouillard = m => { exclus.add(m); };
const TYPES = new Set(['MeshToonMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshStandardMaterial']);
/** Les matériaux du plateau lisent la texture d'état : ternes hors de vue ; sous la brume, rien ne dépasse du tapis. */
function brumiser(m) {
  if (brumises.has(m) || exclus.has(m) || !TYPES.has(m.type)) return;
  if ((m.transparent && !m.depthWrite) || !m.depthTest) return; // fumées, nuages du ciel, surbrillances
  brumises.add(m);
  const avant = m.onBeforeCompile, cle = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    avant?.call(m, sh, r);
    Object.assign(sh.uniforms, { uBrumeOn: BRUME.on, uBrume: BRUME.tex, uBrumeMin: BRUME.min, uBrumeTaille: BRUME.taille });
    sh.vertexShader = 'varying vec3 vBrumeW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 bw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  bw = instanceMatrix * bw;
  #endif
  vBrumeW = (modelMatrix * bw).xyz;`);
    sh.fragmentShader = 'varying vec3 vBrumeW;\nuniform float uBrumeOn; uniform sampler2D uBrume; uniform vec2 uBrumeMin, uBrumeTaille;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `if (uBrumeOn > 0.5) {
    vec4 bz = texture2D(uBrume, (vBrumeW.xz - uBrumeMin) / uBrumeTaille);
    if (bz.g > 0.5 && vBrumeW.y > 0.47) discard; // sous la brume : rien ne dépasse du tapis de nuages
    float lum = dot(outgoingLight, vec3(0.3, 0.59, 0.11));
    vec3 terne = mix(vec3(lum), outgoingLight, 0.42) * vec3(0.7, 0.73, 0.83);
    outgoingLight = mix(terne, outgoingLight, smoothstep(0.42, 0.95, bz.r));
  }
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => (cle ? cle.call(m) : '') + '|brume';
  m.needsUpdate = true;
}
brumiser(MAT); brumiser(CONT);
/** Passe sur les matériaux de la scène pas encore brumisés (bâtiments, mer, rivières… créés depuis). */
function brumiserScene() { scene.traverse(o => { if (o.isMesh && !o.userData.sansBrouillard) for (const m of [].concat(o.material)) brumiser(m); }); }

function peindre() {
  const g = toile.getContext('2d'), m = BRUME.min.value, sx = toile.width / BRUME.taille.value.x, sz = toile.height / BRUME.taille.value.y;
  g.fillStyle = 'rgb(115,0,0)'; g.fillRect(0, 0, toile.width, toile.height);
  const coul = ['rgb(0,255,0)', 'rgb(115,0,0)', 'rgb(255,0,0)'];
  for (let e = 0; e < 3; e++) {
    if (e === 1) continue; // le fond est déjà « exploré »
    g.fillStyle = coul[e];
    g.beginPath();
    for (let i = 0; i < N; i++) {
      if (vu[i] !== e) continue;
      const { x, z } = posCase(i);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, px = (x + Math.sin(a) * 1.04 - m.x) * sx, pz = (z + Math.cos(a) * 1.04 - m.y) * sz; k ? g.lineTo(px, pz) : g.moveTo(px, pz); }
      g.closePath();
    }
    g.fill();
  }
  texEtat.needsUpdate = true;
}

// ------------------------------------------------------------------ la brume : tuiles beiges et bouffées crème, cernées de brun
const LF = 64; // largeur de la texture des valeurs par case
let texF = null, dataF = null, ff = new Float32Array(0), cible = new Uint8Array(0);
const U = { uF: { value: null }, uT: { value: 0 } };
const M_BRUME = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade });
const M_BRUME_C = new THREE.MeshBasicMaterial({ color: 0x6b5638, side: THREE.BackSide });
const M_TUILE = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade });
const M_TUILE_C = new THREE.MeshBasicMaterial({ color: 0x6b5638, side: THREE.BackSide });
for (const m of [M_BRUME, M_BRUME_C, M_TUILE, M_TUILE_C]) exclus.add(m);
const LIRE_F = `attribute vec3 aInfo; uniform sampler2D uF; uniform float uT;
float brumeF() { int ci = int(aInfo.x + 0.5); return texelFetch(uF, ivec2(ci % ${LF}, ci / ${LF}), 0).r; }
`;
/** Bouffée : grossit avec la brume et houle doucement ; en se levant, elle monte et fond. */
function patchBouffee(m, gonfle) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = LIRE_F + sh.vertexShader.replace('#include <project_vertex>', `float f = brumeF();
  float s = f * (1.0 + sin(uT * 0.7 + aInfo.y) * 0.06) * ${gonfle.toFixed(3)};
  vec4 mvPosition = instanceMatrix * vec4(transformed * s, 1.0);
  mvPosition.y += (1.0 - f) * 0.35 + sin(uT * 0.5 + aInfo.y) * 0.025;
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'bouffee' + gonfle;
}
/** Tuile : une colonne beige dont le dessus porte la brume ; elle s'efface vers le haut quand la brume se lève. */
function patchTuile(m) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = LIRE_F + sh.vertexShader.replace('#include <project_vertex>', `float f = brumeF();
  vec3 tr = vec3(transformed.x * step(0.01, f), transformed.y * f, transformed.z * step(0.01, f));
  vec4 mvPosition = modelViewMatrix * (instanceMatrix * vec4(tr, 1.0));
  gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'tuileBrume';
}
patchBouffee(M_BRUME, 1); patchBouffee(M_BRUME_C, 1.06); patchTuile(M_TUILE); patchTuile(M_TUILE_C);

// la bouffée : une calotte (le bas, sous le dessus de la tuile, ne se voit jamais) ; deux fois moins de faces qu'une sphère
const geoNuee = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.68);
const geoTuile = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, -0.5, 0); // le dessus à y = 0
const groupe = new THREE.Group();
scene.add(groupe);
// la brume par blocs de BLOC × BLOC cases : chaque bloc a ses instances, que la caméra écarte quand il sort du champ
const BLOC = 10;
let blocs = [], nbx = 1;
const COUL_P = [0xf6eedb, 0xf1e6cc, 0xeadcbc].map(c => new THREE.Color(c)), COUL_T = new THREE.Color(0xdcc79a);

function creerNuees() {
  for (const o of [...groupe.children]) { groupe.remove(o); o.geometry.dispose(); }
  nbx = Math.ceil(C.l / BLOC);
  blocs = [];
  for (let k = nbx * Math.ceil(C.h / BLOC); k > 0; k--) {
    const n = BLOC * BLOC, B = { np: 0, npc: 0, nt: 0, ntc: 0 };
    // chaque famille a sa géométrie : ses instances (et leur case) ne sont pas les mêmes
    const famille = (geo, mat, max, cle) => {
      const g = geo.clone(), info = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      g.setAttribute('aInfo', info);
      const o = new THREE.InstancedMesh(g, mat, max); o.count = 0; o.userData.sansBrouillard = true; groupe.add(o);
      B[cle] = o; B['info' + cle] = info;
    };
    famille(geoNuee, M_BRUME, n * 7, 'P'); famille(geoNuee, M_BRUME_C, n * 7, 'PC'); famille(geoTuile, M_TUILE, n, 'T'); famille(geoTuile, M_TUILE_C, n, 'TC');
    B.P.setColorAt(0, COUL_P[0]); B.T.setColorAt(0, COUL_T);
    blocs.push(B);
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Pose les instances : les cases inconnues, et celles dont la brume finit de se lever. */
function poserNuees() {
  for (const B of blocs) B.np = B.npc = B.nt = B.ntc = 0;
  const inconnue = i => i < 0 || vu[i] === 0; // hors du plateau : la brume continue jusqu'au bord
  for (let i = 0; i < N; i++) {
    if (vu[i] !== 0 && ff[i] < 0.01) continue;
    const { x, z, c, r } = posCase(i), B = blocs[((c / BLOC) | 0) + ((r / BLOC) | 0) * nbx];
    const bords = [0, 1, 2, 3, 4, 5].map(j => !inconnue(voisin(i, DIRS[j])));
    const interieur = !bords.some(b => b);
    _m.compose(_p.set(x, 0.5, z), _q, _s.set(1, 1.1, 1)); B.T.setMatrixAt(B.nt, _m); B.T.setColorAt(B.nt, COUL_T); B.infoT.setXYZ(B.nt++, i, 0, 0);
    if (!interieur) { _m.compose(_p.set(x, 0.512, z), _q, _s.set(1.012, 1.124, 1.012)); B.TC.setMatrixAt(B.ntc, _m); B.infoTC.setXYZ(B.ntc++, i, 0, 0); } // au milieu, les flancs sont cachés par les voisines
    const puffs = [[0, 0, 0.42, 0.63, hache(c, r, 301) * 6, false]];
    for (let j = 0; j < 6; j++) {
      if (interieur && j % 2) continue; // au milieu de la brume, trois bouffées suffisent autour du centre
      const a = Math.PI / 6 + j * Math.PI / 3, bord = bords[j];
      puffs.push([Math.sin(a), Math.cos(a), (0.36 + hache(c * 7 + j, r, 302) * 0.08) * (interieur ? 1.18 : 1), 0.58 + hache(c, r * 5 + j, 303) * 0.05, hache(c, r, 304 + j) * 6, bord]);
    }
    for (const [dx, dz, rad, y, ph, bord] of puffs) {
      const rr = dx || dz ? (bord ? 0.44 : 0.55) : 0, s = rad * (bord ? 0.66 : 1);
      _m.compose(_p.set(x + dx * rr, y + (bord ? -0.05 : 0), z + dz * rr), _q, _s.set(s, s * 0.58, s));
      B.P.setMatrixAt(B.np, _m); B.P.setColorAt(B.np, COUL_P[dx || dz ? hache(i, ph * 100 | 0, 305) * 3 | 0 : 0]); B.infoP.setXYZ(B.np++, i, ph, bord ? 1 : 0);
      // au milieu de la brume, seul le centre garde son trait brun : ses voisines se fondent dans le tapis
      if (!interieur || !(dx || dz)) { B.PC.setMatrixAt(B.npc, _m); B.infoPC.setXYZ(B.npc++, i, ph, bord ? 1 : 0); }
    }
  }
  for (const B of blocs) {
    B.P.count = B.np; B.PC.count = B.npc; B.T.count = B.nt; B.TC.count = B.ntc;
    for (const k of ['P', 'PC', 'T', 'TC']) {
      const o = B[k];
      o.instanceMatrix.needsUpdate = true; B['info' + k].needsUpdate = true;
      o.visible = o.count > 0;
      if (o.count) { o.computeBoundingSphere(); o.boundingSphere.radius += 0.6; } // la brume qui se lève monte un peu
    }
    B.P.instanceColor.needsUpdate = B.T.instanceColor.needsUpdate = true;
  }
}
// voisins dans l'ordre des bouffées (angles π/6 + jπ/3, x = sin, z = cos) : sud-est, est, nord-est, nord-ouest, ouest, sud-ouest
const DIRS = [1, 0, 5, 4, 3, 2];

function nouvelleCarte() {
  C = carte(); N = C.l * C.h;
  vu = new Uint8Array(N); ff = new Float32Array(N); cible = new Uint8Array(N);
  const lx = SQ3 * (C.l + 0.5) + 4, lz = 1.5 * (C.h - 1) + 4;
  BRUME.min.value.set(-2, -2); BRUME.taille.value.set(lx, lz);
  nouvelleToile(Math.ceil(lx * PX), Math.ceil(lz * PX));
  texF?.dispose();
  dataF = new Uint8Array(LF * Math.ceil(N / LF));
  texF = new THREE.DataTexture(dataF, LF, Math.ceil(N / LF), THREE.RedFormat);
  texF.needsUpdate = true;
  U.uF.value = texF;
  creerNuees();
}

/** Applique l'état : ce que le joueur a exploré et ce qu'il voit. Sans état (accueil), le brouillard s'efface. */
export function majBrouillard(etat) {
  if (!etat || !carte() || !etat.explore) { actif = false; BRUME.on.value = 0; groupe.visible = false; return; }
  const prem = !actif || carte() !== C;
  if (carte() !== C) nouvelleCarte();
  actif = true; eclaire = null;
  BRUME.on.value = 1; groupe.visible = true;
  brumiserScene();
  const ex = etat.explore, vi = etat.visible || [];
  let change = false;
  for (let i = 0; i < N; i++) {
    const e = vi[i] ? 2 : ex[i] ? 1 : 0;
    if (e !== vu[i] || prem) { vu[i] = e; change = true; }
  }
  if (change) appliquerVu(prem);
}
function appliquerVu(instant) {
  for (let i = 0; i < N; i++) {
    cible[i] = vu[i] === 0 ? 1 : 0;
    if (instant) { ff[i] = cible[i]; dataF[i] = cible[i] * 255; }
  }
  texF.needsUpdate = true;
  peindre();
  poserNuees();
}

/** La case n'a jamais été explorée (sous la brume). */
export const enBrouillard = i => actif && vu[i] === 0;
/** La case est en vue (toujours vrai sans brouillard). */
export const caseVisible = i => !actif || vu[i] === 2;

// ------------------------------------------------------------------ le mois joué : la brume se lève au passage de nos armées et de nos flottes
/** À appeler avec jouerMois de monde.js (mêmes rapport et durée) : nos marches découvrent le pays au fil du trajet. */
export function jouerMoisBrouillard(rapport, duree = 2800) {
  if (!actif) return;
  const etapes = Math.max(1, ...rapport.mouvements.map(m => m.trajet.length - 1), ...rapport.combats.map(c => c.etape || 1));
  const marches = rapport.mouvements.filter(m => m.proprio === 0 && m.trajet.length > 1).map(m => ({ trajet: m.trajet, r: m.flotte ? 2 : 1, d: duree * (m.trajet.length - 1) / etapes, fait: -1 }));
  eclaire = marches.length ? { t0: performance.now(), marches } : null;
}
function eclairer() {
  const now = performance.now();
  let change = false;
  for (const m of eclaire.marches) {
    const k = Math.min(1, (now - eclaire.t0) / Math.max(1, m.d)), i = Math.round(k * (m.trajet.length - 1));
    if (i <= m.fait) continue;
    for (let j = m.fait + 1; j <= i; j++) for (const c of rayon(m.trajet[j], m.r)) if (vu[c] !== 2) { vu[c] = 2; change = true; }
    m.fait = i;
  }
  if (eclaire.marches.every(m => m.fait >= m.trajet.length - 1)) eclaire = null;
  if (change) appliquerVu(false);
}

chaqueImage((dt, t) => {
  if (!actif) return;
  U.uT.value = t;
  // au-delà de la brume de distance, rien ne se voit : les blocs trop loin ne sont pas dessinés
  for (const B of blocs) for (const o of [B.P, B.PC, B.T, B.TC]) o.visible = o.count > 0 && camera.position.distanceTo(o.boundingSphere.center) - o.boundingSphere.radius < scene.fog.far;
  if (eclaire) eclairer();
  let change = false, fini = false;
  for (let i = 0; i < N; i++) {
    const c = cible[i];
    if (ff[i] === c) continue;
    const v = ff[i] + (c - ff[i]) * Math.min(1, dt * (c ? 2.5 : 1.4));
    ff[i] = Math.abs(v - c) < 0.01 ? c : v;
    if (ff[i] === 0) fini = true;
    dataF[i] = ff[i] * 255; change = true;
  }
  if (change) texF.needsUpdate = true;
  if (fini) poserNuees(); // les brumes levées quittent les instances
});
