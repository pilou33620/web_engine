// ---------------------------------------------------------------- guerre et diplomatie : brouillard, marine, espionnage, sièges
// Maquette. Même vocabulaire que le reste : pièces en boîtes en unités de web_power (une case = 10, réduite par l'échelle
// du modèle), ombrage toon trois tons, contours bruns. Toutes les scènes vivent en même temps ; les boutons y mènent la caméra
// et les relancent depuis le début.
const ROUGE = '#b8323a', VERT = '#3f8f4a';
const MER = -0.15, ECH_NAV = 0.085, ECH_GENS = 0.045, ECH_ESPION = 0.08;
const LIEU = { portNous: at(7, 7), allie: at(4, 11), cabaneAllie: at(2, 11), rivale: at(12, 7), batterie: at(13, 7), camp: at(14, 7), plage: at(15, 11), bataille: at(10, 11), armeeCachee: at(15, 4), armeeLoin: at(10, 2), departEspion: at(9, 5), colline: at(10, 5), affut: at(11, 6), seuil: at(12, 6) };
for (const k of [LIEU.portNous, LIEU.allie, LIEU.cabaneAllie, LIEU.rivale]) k.bati = true;
for (const k of [LIEU.batterie, LIEU.camp, LIEU.plage, LIEU.armeeCachee, LIEU.armeeLoin, at(13, 6), at(13, 8), at(14, 6)]) k.vide = true;
const cube = k => { const x = k.c - (k.r - (k.r & 1)) / 2; return [x, -x - k.r, k.r]; };
const ecart = (a, b) => { const A = cube(a), B = cube(b); return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])); };
function caseEn(x, z) {
  const r0 = Math.round(z / 1.5); let b = null, m = Infinity;
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) { const k = at(c, r); if (!k) continue; const d = (k.x - x) ** 2 + (k.z - z) ** 2; if (d < m) { m = d; b = k; } }
  return b;
}
const franchit = (a, b, x) => a < x && b >= x; // un instant x passé entre deux images
const lisse = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const _vg = new THREE.Vector3();
const versMonde = (o, x, y, z) => { o.updateMatrixWorld(true); return _vg.set(x, y, z).applyMatrix4(o.matrixWorld).clone(); };
const fumer = (p, extra = {}) => { if (bouffees.length < 850) bouffees.push({ x: p.x, y: p.y, z: p.z, age: 0, noire: false, ...extra }); };
const POUDRE = new THREE.Color(0xf4f1ea), POUSSIERE = new THREE.Color(0xb59a74), ECUME = new THREE.Color(0xf6fbff);

// ---------------------------------------------------------------- brouillard de guerre
// Trois états par case : 0 jamais explorée (sous la brume), 1 explorée mais hors de vue (terne : terrain et villes, pas les armées),
// 2 en vue (autour de nos villes, armées, flottes et espions). Une petite texture peinte case par case, adoucie par un flou,
// dit aux matériaux toon l'état de chaque point du plateau.
let BROUILLARD = true;
const BRUME = { on: { value: 1 }, tex: { value: null }, min: { value: new THREE.Vector2(-2.5, -2.5) }, taille: { value: new THREE.Vector2(COLS * SQ3 + 4, ROWS * 1.5 + 3.5) } };
function brumiser(m) {
  m.onBeforeCompile = sh => {
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
  m.customProgramCacheKey = () => 'brume';
  m.needsUpdate = true;
}
brumiser(MAT); brumiser(CONT); brumiser(eau.material);
const BR_W = 640, BR_H = Math.round(640 * BRUME.taille.value.y / BRUME.taille.value.x);
const cvA = document.createElement('canvas'), cvB = document.createElement('canvas');
cvA.width = cvB.width = BR_W; cvA.height = cvB.height = BR_H;
const texBrume = new THREE.CanvasTexture(cvB);
texBrume.flipY = false; texBrume.generateMipmaps = false; texBrume.minFilter = texBrume.magFilter = THREE.LinearFilter;
BRUME.tex.value = texBrume;
const INCONNU0 = k => k.c >= 15 || (k.c >= 11 && k.r <= 1); // l'est et les montagnes du nord-est : jamais explorés au départ
let EXPLORE = new Set();
const reexplorer = () => { EXPLORE = new Set(CASES.filter(k => !INCONNU0(k))); };
reexplorer();
for (const k of CASES) k.vu = -1;
function peindreBrume() {
  const g = cvA.getContext('2d'), m = BRUME.min.value, sx = BR_W / BRUME.taille.value.x, sz = BR_H / BRUME.taille.value.y;
  g.fillStyle = 'rgb(115,0,0)'; g.fillRect(0, 0, BR_W, BR_H);
  for (const k of CASES) {
    g.fillStyle = k.vu === 2 ? 'rgb(255,0,0)' : k.vu === 1 ? 'rgb(115,0,0)' : 'rgb(0,255,0)';
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = (k.x + Math.sin(a) * 1.04 - m.x) * sx, y = (k.z + Math.cos(a) * 1.04 - m.y) * sz; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.fill();
  }
  const h = cvB.getContext('2d'); h.fillStyle = 'rgb(115,0,0)'; h.fillRect(0, 0, BR_W, BR_H); h.filter = 'blur(5px)'; h.drawImage(cvA, 0, 0); h.filter = 'none';
  texBrume.needsUpdate = true;
  for (const n of NUEES) { n.cible = BROUILLARD && n.k.vu === 0 ? 1 : 0; n.puffs.forEach(p => { p.bord = !(p.vois ? p.vois.vu === 0 : true); }); }
}
// la brume : un tapis de nuages crème qui ondule, posé sur des tuiles beiges comme celles de web_power (0xdcc79a), cerné de traits bruns
const M_BRUME = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade });
const M_BRUME_C = new THREE.MeshBasicMaterial({ color: 0x6b5638, side: THREE.BackSide });
const geoNuee = new THREE.IcosahedronGeometry(1, 1), geoTuile = new THREE.CylinderGeometry(1, 1, 1, 6);
const NUEES = CASES.map(k => {
  const puffs = [{ dx: 0, dz: 0, r: 0.42, y: 0.63, ph: hache(k.c, k.r, 301) * 6, vois: null }];
  for (let j = 0; j < 6; j++) { const a = Math.PI / 6 + j * Math.PI / 3, s = Math.sin(a), c = Math.cos(a); puffs.push({ dx: s, dz: c, r: 0.36 + hache(k.c * 7 + j, k.r, 302) * 0.08, y: 0.58 + hache(k.c, k.r * 5 + j, 303) * 0.05, ph: hache(k.c, k.r, 304 + j) * 6, vois: caseEn(k.x + s * SQ3, k.z + c * SQ3) }); }
  for (const p of puffs) if (p.vois && ecart(p.vois, k) !== 1) p.vois = null; // hors du plateau : la brume continue jusqu'au bord
  return { k, f: 0, cible: 0, puffs };
});
const NB_P = NUEES.length * 7;
const NUAGE_P = new THREE.InstancedMesh(geoNuee, M_BRUME, NB_P), NUAGE_PC = new THREE.InstancedMesh(geoNuee, M_BRUME_C, NB_P);
const TUILE_B = new THREE.InstancedMesh(geoTuile, M_BRUME, NUEES.length), TUILE_BC = new THREE.InstancedMesh(geoTuile, M_BRUME_C, NUEES.length);
for (const o of [NUAGE_P, NUAGE_PC, TUILE_B, TUILE_BC]) { o.frustumCulled = false; scene.add(o); }
NUAGE_P.castShadow = TUILE_B.castShadow = true;
{ const cs = [0xf6eedb, 0xf1e6cc, 0xeadcbc].map(c => new THREE.Color(c)); for (let i = 0; i < NB_P; i++) NUAGE_P.setColorAt(i, cs[i % 7 === 0 ? 0 : hache(i, 3, 305) * 3 | 0]); const t0 = new THREE.Color(0xdcc79a); for (let i = 0; i < NUEES.length; i++) TUILE_B.setColorAt(i, t0); }
function animBrume(dt, tps) {
  let n = 0;
  NUEES.forEach((nu, i) => {
    nu.f += (nu.cible - nu.f) * Math.min(1, dt * (nu.cible ? 2.5 : 1.4));
    const f = nu.f < 0.01 ? 0 : nu.f, k = nu.k;
    _m.compose(_p.set(k.x, 0.46 + 0.035 * f, k.z), _q, _s.set(f ? 1.0 : 0, 0.09 * f, f ? 1.0 : 0)); TUILE_B.setMatrixAt(i, _m);
    _m.compose(_p.set(k.x, 0.46 + 0.035 * f, k.z), _q, _s.set(f ? 1.012 : 0, f ? 0.09 * f + 0.012 : 0, f ? 1.012 : 0)); TUILE_BC.setMatrixAt(i, _m);
    for (const p of nu.puffs) {
      const bord = p.bord, rr = p.dx || p.dz ? (bord ? 0.44 : 0.55) : 0, s = p.r * (bord ? 0.66 : 1) * f * (1 + Math.sin(tps * 0.7 + p.ph) * 0.06);
      const y = p.y + (bord ? -0.05 : 0) + Math.sin(tps * 0.5 + p.ph) * 0.025 + (1 - f) * 0.35;
      _m.compose(_p.set(k.x + p.dx * rr, y, k.z + p.dz * rr), _q, _s.set(s, s * 0.58, s)); NUAGE_P.setMatrixAt(n, _m);
      _m.compose(_p, _q, _s.set(s * 1.055 + (s ? 0.008 : 0), s * 0.58 * 1.055 + (s ? 0.008 : 0), s * 1.055 + (s ? 0.008 : 0))); NUAGE_PC.setMatrixAt(n++, _m);
    }
  });
  for (const o of [NUAGE_P, NUAGE_PC, TUILE_B, TUILE_BC]) o.instanceMatrix.needsUpdate = true;
}
let tVision = 0;
function majVision() {
  const vis = new Set();
  if (G) for (const [x, z, r] of sourcesVision()) { const k0 = caseEn(x, z); for (const k of CASES) if (ecart(k0, k) <= r) vis.add(k); }
  let change = false;
  for (const k of CASES) { if (vis.has(k)) EXPLORE.add(k); const e = !BROUILLARD || vis.has(k) ? 2 : EXPLORE.has(k) ? 1 : 0; if (k.vu !== e) { k.vu = e; change = true; } }
  if (change) peindreBrume();
}
const enVue = (x, z) => !BROUILLARD || caseEn(x, z).vu === 2; // les unités rivales ne se voient qu'en vue

// ---------------------------------------------------------------- petites particules : éclairs des canons, gerbes d'eau, flammes
const ECLATS = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: tache, size: 0.26, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
ECLATS.frustumCulled = false; scene.add(ECLATS);
const eclats = [];
const eclat = (p, fort = 1) => { eclats.push({ x: p.x, y: p.y, z: p.z, vie: 0.18, fort }); if (fort > 1) eclats.push({ x: p.x, y: p.y + 0.01, z: p.z, vie: 0.12, fort }); };
const GERBES = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshToonMaterial({ color: 0xf2fbff, gradientMap: degrade }), 160);
GERBES.frustumCulled = false; GERBES.count = 0; scene.add(GERBES);
const gerbes = [];
const gerbe = (x, z, h = 1) => { if (gerbes.length < 160) gerbes.push({ x, z, age: 0, h }); };
const M_FLAMME = new THREE.MeshBasicMaterial({ color: 0xff9a2a }), M_FLAMME2 = new THREE.MeshBasicMaterial({ color: 0xffd34d });
function feu(parent, x, y, z, s = 1) { // trois langues de feu, animées à part
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  [[0, 0, 0.5, M_FLAMME], [0.18, 0.1, 0.34, M_FLAMME2], [-0.15, -0.12, 0.38, M_FLAMME]].forEach(([dx, dz, h, m]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 5).translate(0, h / 2, 0), m); c.position.set(dx, 0, dz); g.add(c); });
  parent.add(g); g.visible = false; return g;
}
const animFeu = (g, tps) => g.children.forEach((c, i) => c.scale.set(1 + Math.sin(tps * 13 + i) * 0.2, 1 + Math.sin(tps * 17 + i * 2) * 0.3, 1 + Math.cos(tps * 11 + i) * 0.2));
// pastilles qui restent face à la caméra : « ! » de l'espion démasqué, rouleau de plans
function pastille(dessin, taille = 0.13) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  dessin(g); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.setScalar(taille); s.renderOrder = 10; return s;
}
const rond = (g, fond) => { g.fillStyle = fond; g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = '#24180f'; g.stroke(); };

// ---------------------------------------------------------------- la marine
// Navires vus de côté, proue vers +x, ligne de flottaison à y = 0 ; une case = 10 unités, réduites par ECH_NAV.
const LIVREE = {
  ancien: { coque: 0x8a5a2e, bande: 0xd9a43a, sabord: 0x6a1e14, voile: 0xefe6cc, deco: 0xe0b040, pont: 0xd2a96c },
  lumieres: { coque: 0x5e3d22, bande: 0xe6c66a, sabord: 0x2a1d14, voile: 0xf6f2ea, deco: 0xe6c66a, pont: 0xcfa66c },
  empire: { coque: 0x2a2a2e, bande: 0xe8c45e, sabord: 0x161616, voile: 0xfaf8f2, deco: 0xe8c45e, pont: 0xcaa56e },
  industrie: { coque: 0x26262a, bande: 0xf2efe6, sabord: 0x161616, voile: 0xf0eee6, deco: 0xd9b45a, pont: 0xc4a274 },
};
const TYPES = {
  flute: { L: 5.2, W: 1.8, H: 1.05, arriere: 0.48, mats: [[-1.4, 5.0], [0.3, 5.9], [1.8, 4.7]], voiles: 2, dunette: 1.0, gaillard: 0.3, bandes: [] },
  corvette: { L: 5.0, W: 1.3, H: 0.8, arriere: 0.8, mats: [[-1.0, 5.6], [1.15, 6.0]], voiles: 3, dunette: 0.3, gaillard: 0.22, bandes: [0.42] },
  fregate: { L: 6.2, W: 1.5, H: 1.0, arriere: 0.78, mats: [[-1.8, 5.8], [0.2, 7.0], [2.0, 6.2]], voiles: 3, dunette: 0.4, gaillard: 0.25, bandes: [0.55] },
  vaisseau: { L: 7.4, W: 1.95, H: 1.6, arriere: 0.8, mats: [[-2.3, 6.4], [0.1, 8.0], [2.5, 7.0]], voiles: 3, dunette: 0.7, gaillard: 0.35, bandes: [0.5, 1.12] },
  vapeur: { L: 5.8, W: 1.4, H: 0.85, arriere: 0.75, mats: [[-2.0, 4.0], [2.0, 4.4]], voiles: 0, auriques: true, dunette: 0, gaillard: 0.25, bandes: [], roues: true, cheminee: [0, 3.2] },
};
TYPES.fregateH = { ...TYPES.fregate, voiles: 2, cheminee: [-0.8, 2.8] };
TYPES.vaisseauH = { ...TYPES.vaisseau, voiles: 2, cheminee: [-1.1, 3.1] };
const NOM_NAVIRE = { flute: 'flûte', corvette: 'corvette', fregate: 'frégate', vaisseau: 'vaisseau de ligne', vapeur: 'vapeur à roues', fregateH: 'frégate à hélice', vaisseauH: 'vaisseau à hélice' };
const FLOTTE = { ancien: ['flute', 'corvette', 'fregate'], lumieres: ['flute', 'corvette', 'fregate', 'vaisseau'], empire: ['flute', 'corvette', 'fregate', 'vaisseau'], industrie: ['vapeur', 'fregateH', 'vaisseauH'] };
const lourd = () => ({ ancien: 'fregate', industrie: 'vaisseauH' }[EPOQUE] || 'vaisseau');
const leger = () => ({ ancien: 'corvette', industrie: 'fregateH' }[EPOQUE] || 'fregate');
const transport = () => (EPOQUE === 'industrie' ? 'vapeur' : 'flute');
function planCoque(Lg, W, arr) { // vue de dessus : arrière plat, flancs droits, étrave en pointe arrondie
  const a = -Lg / 2, b = Lg / 2, s = new THREE.Shape();
  s.moveTo(a, -W * arr / 2); s.lineTo(a * 0.55, -W / 2); s.lineTo(b * 0.3, -W / 2);
  s.quadraticCurveTo(b * 0.85, -W * 0.44, b, 0); s.quadraticCurveTo(b * 0.85, W * 0.44, b * 0.3, W / 2);
  s.lineTo(a * 0.55, W / 2); s.lineTo(a, W * arr / 2); s.closePath(); return s;
}
function tranche(Lg, W, arr, y0, y1, sx = 1, sz = 1) {
  const g = new THREE.ExtrudeGeometry(planCoque(Lg, W, arr), { depth: y1 - y0, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2); g.scale(sx, 1, sz); g.translate(0, y0, 0); return g;
}
const pavillons = [], MATS_PAV = {};
function matPav(col, propre) { if (propre || !MATS_PAV[col]) { const m = new THREE.MeshToonMaterial({ color: col, gradientMap: degrade, side: THREE.DoubleSide }); brumiser(m); if (propre) return m; MATS_PAV[col] = m; } return MATS_PAV[col]; }
function drapeau(parent, col, x, y, z, w = 1.3, h = 0.85, ry = 0, propre = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 6, 1).translate(w / 2, 0, 0), matPav(col, propre));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.w = w; m.castShadow = true; parent.add(m); pavillons.push(m); return m;
}
function navire(type, roy, { ferle = false } = {}) {
  const T = TYPES[type], E = LIVREE[EPOQUE], L = lot(), Lg = T.L, W = T.W, H = T.H, ep = 0.12, bois = 0x5b3a1e;
  const g = new THREE.Group(), corps = new THREE.Group(); g.add(corps); corps.scale.setScalar(ECH_NAV); g.rotation.order = 'YXZ';
  put(L, tranche(Lg, W, T.arriere, -0.55, H), E.coque, 0, 0, 0, 0, ep);
  put(L, tranche(Lg, W, T.arriere, H - 0.02, H + 0.03, 0.93, 0.86), E.pont, 0, 0, 0, 0, 0);
  const ports = { d: [], g: [] };
  for (const yb of T.bandes) {
    put(L, tranche(Lg, W, T.arriere, yb - 0.13, yb + 0.15, 1.012, 1.05), E.bande, 0, 0, 0, 0, 0);
    for (let x = -Lg * 0.27; x <= Lg * 0.18; x += 0.56) for (const s of [1, -1]) { put(L, boite(0.24, 0.17, 0.06), E.sabord, x, yb + 0.01, s * (W / 2 * 1.05 + 0.025), 0, 0); (s > 0 ? ports.d : ports.g).push([x, yb, s * (W / 2 + 0.2)]); }
  }
  put(L, tranche(Lg, W, T.arriere, H - 0.17, H - 0.03, 1.012, 1.04), roy, 0, 0, 0, 0, 0); // liston aux couleurs du royaume
  const yP = H + T.dunette;
  if (T.dunette) {
    const dl = Lg * 0.24, dw = W * (T.arriere * 0.5 + 0.45), dx = -Lg / 2 + dl / 2 + 0.04;
    put(L, boite(dl, T.dunette, dw), E.coque, dx, H + T.dunette / 2, 0, 0, ep);
    put(L, boite(dl * 0.9, 0.04, dw * 0.84), E.pont, dx, yP + 0.02, 0, 0, 0);
    put(L, boite(dl * 1.01, 0.12, dw * 1.03), roy, dx, yP - 0.08, 0, 0, 0);
    put(L, boite(0.08, T.dunette * 0.75, dw * 0.88), E.deco, -Lg / 2 + 0.02, H + T.dunette * 0.5, 0, 0, 0); // poupe ornée
    for (const z of [-0.25, 0.25]) put(L, boite(0.06, T.dunette * 0.32, 0.26), 0xf2d27a, -Lg / 2 - 0.03, H + T.dunette * 0.55, z * dw, 0, 0); // fenêtres de poupe
  }
  if (T.gaillard) put(L, boite(Lg * 0.14, T.gaillard, W * 0.55), E.coque, Lg * 0.3, H + T.gaillard / 2, 0, 0, ep);
  { const len = Lg * 0.36, bp = cyl(0.06, 0.1, len, 6); bp.rotateZ(-Math.PI / 2 + 0.32); put(L, bp, bois, Lg / 2 - 0.3 + 0.949 * len / 2, H + 0.15 + 0.315 * len / 2, 0, 0, 0); } // beaupré
  let grand = T.mats[0];
  T.mats.forEach(([mx, mh], i) => {
    if (mh > grand[1]) grand = [mx, mh];
    put(L, cyl(0.09, 0.15, mh, 6), bois, mx, H + mh / 2, 0, 0, 0.08);
    let y = H + 0.75;
    for (let v = 0; v < T.voiles; v++) {
      const sh = mh * [0.36, 0.29, 0.21][v], sw = W * [2.05, 1.72, 1.28][v] * (Lg > 7 ? 1.05 : 1);
      if (ferle) put(L, cyl(0.09, 0.09, sw * 0.8, 6).rotateX(Math.PI / 2), E.voile, mx + 0.1, y + sh - 0.06, 0, 0, 0.04);
      else put(L, boite(0.2, sh, sw), E.voile, mx + 0.16, y + sh / 2, 0, 0, 0.07);
      put(L, boite(0.09, 0.09, sw * (ferle ? 0.88 : 1.08)), bois, mx + 0.06, y + sh, 0, 0, 0);
      y += sh + 0.08;
    }
    if (T.auriques || (i === 0 && !ferle && T.voiles)) put(L, boite(T.auriques ? 1.7 : 1.3, mh * (T.auriques ? 0.55 : 0.36), 0.12), E.voile, mx - (T.auriques ? 0.9 : 0.72), H + 0.65 + mh * (T.auriques ? 0.28 : 0.2), 0, 0, 0.06);
  });
  if (!ferle && T.voiles) { // foc, du beaupré au mât de misaine
    const [fx, fh] = T.mats[T.mats.length - 1], s = new THREE.Shape(); s.moveTo(fx + 0.25, H + fh * 0.72); s.lineTo(Lg / 2 + Lg * 0.28, H + 0.6); s.lineTo(fx + 0.6, H + 0.45); s.closePath();
    const gf = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }); gf.translate(0, 0, -0.05); put(L, gf, E.voile, 0, 0, 0, 0, 0.05);
  }
  let fum = null;
  if (T.cheminee) { const [cx, ch] = T.cheminee; put(L, cyl(0.3, 0.34, ch, 10), 0x2b2b30, cx, H + ch / 2, 0, 0, 0.08); put(L, cyl(0.318, 0.318, 0.36, 10), roy, cx, H + ch - 0.5, 0, 0, 0); fum = [cx, H + ch + 0.1, 0]; }
  put(L, boite(0.07, 1.4, 0.07), bois, -Lg / 2 + 0.06, yP + 0.7, 0, 0, 0);
  const roues = [];
  if (T.roues) for (const s of [1, -1]) {
    const cz = s * (W / 2 + 0.26), cy = H * 0.5;
    put(L, new THREE.CylinderGeometry(0.95, 0.95, 0.5, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), roy, 0, cy, cz, 0, 0.08);
    const Lr = lot(); put(Lr, cyl(0.2, 0.2, 0.44, 8).rotateX(Math.PI / 2), 0x3a3a40, 0, 0, 0, 0, 0);
    for (let k = 0; k < 8; k++) { const b = boite(0.16, 0.42, 0.38); b.translate(0, 0.62, 0); b.rotateZ(k * Math.PI / 4); put(Lr, b, 0x6b4426, 0, 0, 0, 0, 0); }
    const r = fige(Lr, corps); r.position.set(0, cy, cz); roues.push(r);
  }
  fige(L, corps);
  drapeau(corps, roy, -Lg / 2 + 0.06, yP + 1.12, 0, 1.25, 0.8, Math.PI);
  drapeau(corps, roy, grand[0], H + grand[1] + 0.02, 0, 1.7, 0.28, Math.PI); // flamme en tête du grand mât
  return { g, corps, ports, fum, roues, T, type, ph: hache(pavillons.length, 7, 311) * 6, sill: 0, fumT: 0 };
}
// pose d'un navire : cap (face à +x), tangage et roulis de la houle, sillage d'écume quand il avance, fumée de sa cheminée
function poser(n, x, z, cap, tps, dt, { vitesse = 0, roulis = 0, tangage = 0, dy = 0, mouille = false } = {}) {
  const g = n.g, h = mouille ? 0.6 : 1;
  g.position.set(x, MER + Math.sin(tps * 1.3 + n.ph) * 0.006 * h + dy, z);
  g.rotation.set(roulis + Math.sin(tps * 1.05 + n.ph) * 0.045 * h, cap, tangage + Math.sin(tps * 0.85 + n.ph * 2) * 0.03 * h);
  if (!g.visible || !dt) return;
  if (vitesse > 0.02 && (n.sill -= dt) <= 0) { n.sill = 0.16; const p = versMonde(g, -n.T.L / 2 * ECH_NAV, 0, (Math.random() - 0.5) * 0.04); fumer({ x: p.x, y: MER + 0.004, z: p.z }, { c: ECUME, vy: 0, vie: 1.6, k: 0.32 }); }
  if (n.fum && (n.fumT -= dt) <= 0) { n.fumT = 0.45; const p = versMonde(n.corps, ...n.fum); fumer(p, { noire: true, k: 0.6 }); }
  for (const r of n.roues) r.rotation.z -= dt * (vitesse > 0.02 ? 5 : 0.6);
}
function chaloupe(roy, P) {
  const L = lot(), Lp = lot();
  put(L, tranche(2.4, 0.95, 0.7, -0.3, 0.42), 0x8a5a34, 0, 0, 0, 0, 0.09);
  put(L, tranche(2.4, 0.95, 0.7, 0.3, 0.42, 1.02, 1.06), roy, 0, 0, 0, 0, 0);
  for (const x of [-0.45, 0.35]) for (const s of [1, -1]) { const r = boite(0.08, 0.06, 1.2); r.rotateX(s * 0.35); put(L, r, 0xb08a5a, x, 0.33, s * 0.8, 0, 0); }
  for (const x of [-0.78, -0.26, 0.26, 0.78]) { put(Lp, boite(0.4, 0.5, 0.42), roy, x, 0.62, 0, 0, 0.05); put(Lp, sphere(0.2, 1), PEAU, x, 1.05, 0, 0, 0.04); tete(Lp, P, x, 1.2, 0, roy); }
  const g = new THREE.Group(), c = fige(L, g), pass = fige(Lp, g); g.scale.setScalar(ECH_NAV); g.rotation.order = 'YXZ'; return { g, pass, ph: Math.random() * 6 };
}
// soldats et gardes à pied, modèles de l'armée (fantassin de batiments.js), face à +z
function soldat(parent, P, roy, genre = 'ligne', ech = ECH_GENS) { const L = lot(); fantassin(L, P, 0, 0, roy, genre); const g = fige(L, parent); g.scale.setScalar(ech); return g; }
const capVers = (dx, dz) => Math.atan2(dx, dz); // pour un modèle qui regarde +z

// ---------------------------------------------------------------- l'espion
function modeleEspion(roy) {
  const L = lot(), ep = 0.07;
  for (const dz of [-0.15, 0.15]) put(L, boite(0.22, 0.85, 0.26), 0x2b2b30, 0, 0.42, dz, 0, ep);
  put(L, cone(0.66, 1.6, 8), 0x2f3542, 0, 1.45, 0, 0, ep); // la cape
  put(L, cyl(0.31, 0.35, 0.16, 8), roy, 0, 2.0, 0, 0, 0); // écharpe aux couleurs du royaume
  put(L, sphere(0.27, 1), PEAU, 0.03, 2.26, 0, 0, ep);
  if (EPOQUE === 'empire') put(L, boite(0.32, 0.36, 0.98), NOIR, 0, 2.5, 0, 0, 0.05); // bicorne
  else if (EPOQUE === 'industrie') { put(L, cyl(0.48, 0.48, 0.05, 12), NOIR, 0, 2.42, 0, 0, 0.04); put(L, cyl(0.25, 0.27, 0.6, 10), NOIR, 0, 2.72, 0, 0, 0.05); } // haut-de-forme
  else put(L, cone(0.6, 0.32, 3), NOIR, 0, 2.5, 0, Math.PI, 0.05); // tricorne
  if (EPOQUE === 'ancien' || EPOQUE === 'lumieres') { put(L, boite(0.24, 0.3, 0.24), 0xffd36a, 0.38, 1.18, 0.34, 0, 0.04); put(L, boite(0.06, 0.25, 0.06), 0x2b2b30, 0.38, 1.45, 0.34, 0, 0); } // lanterne
  else { put(L, boite(0.36, 0.42, 0.2), 0x7a4a24, -0.05, 1.2, 0.62, 0, 0.04); put(L, boite(0.06, 0.06, 0.9), 0x5a3418, 0.18, 1.7, 0.3, 0, 0); } // sacoche
  return L;
}
function cage() {
  const L = lot(), fer = 0x3a3a40;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; put(L, cyl(0.05, 0.05, 2.9, 5), fer, Math.cos(a) * 0.8, 1.45, Math.sin(a) * 0.8, 0, 0.03); }
  put(L, cyl(0.9, 0.9, 0.12, 12), fer, 0, 0.06, 0, 0, 0.04); put(L, cyl(0.9, 0.9, 0.12, 12), fer, 0, 2.9, 0, 0, 0.04); put(L, cone(0.95, 0.5, 12), fer, 0, 3.2, 0, 0, 0.04);
  return L;
}

// ---------------------------------------------------------------- bâtiments du port et de la ville rivale fortifiée
const caisse = (L, x, z, s = 1, y = 0) => put(L, boite(0.8 * s, 0.8 * s, 0.8 * s), 0xb07a3a, x, y + 0.4 * s + 0.25, z, 0, 0.08);
const tonneau = (L, x, z) => put(L, cyl(0.4, 0.4, 0.9, 8), 0x8a5a2b, x, 0.7, z, 0, 0.08);
// port : capitainerie et entrepôt, quai de bois vers l'eau (+x), grue, marchandises
function portBat(L, ex, E) {
  solQ(L, 0xd9cfa0);
  maison(L, ex, -3.6, -2.6, 0.2, 1.05, E); maison(L, ex, -4.2, 2.4, -0.3, 0.85, E);
  put(L, boite(7.6, 0.4, 2.2), 0x8b5a2b, 4.6, 0.3, 0, 0, 0.1);
  for (const x of [1.6, 4.4, 7.6]) for (const z of [-0.9, 0.9]) put(L, boite(0.3, 2.6, 0.3), BOIS, x, -1, z, 0, 0);
  put(L, boite(0.35, 4.6, 0.35), BOIS, 1.8, 2.3, -1.5, 0, 0.08); const fl = boite(3.4, 0.22, 0.22); fl.rotateZ(0.42); put(L, fl, BOIS, 3.3, 4.6, -1.5, 0, 0.06); put(L, boite(0.05, 1.6, 0.05), 0x3a3a3a, 4.8, 4.4, -1.5, 0, 0); caisse(L, 4.8, -1.5, 0.6, 3);
  for (const [x, z] of [[-0.6, 1.4], [0.3, 1.9], [-0.2, 2.8], [2.8, 0.4]]) caisse(L, x, z); tonneau(L, 0.9, 3.1); tonneau(L, 3.8, -0.5);
  mat(L, ex, -1.4, -0.6, 6.5);
}
function figeBat(L, ex, k, ry, parent, roy) { // un bâtiment en unités de cases de 10, posé sur sa case, drapeaux et fumées compris
  const g = fige(L, parent); g.scale.setScalar(ECH_BAT); g.position.set(k.x, k.top ?? 0, k.z); g.rotation.y = ry; g.updateMatrixWorld(true);
  for (const a of ex.drap || []) drapeau(g, roy, a[0], a[1], a[2], 2.2, 1.3);
  return g;
}
const dirMer = k => { let x = 0, z = 0; for (const n of voisins(k)) if (TERR[n.t].eau) { x += n.x - k.x; z += n.z - k.z; } const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
// la ville rivale fortifiée : enceinte bastionnée à la Vauban (cinq bastions, fossé en eau, demi-lunes aux Lumières et sous l'Empire),
// fort bas en brique à l'ère industrielle ; donjon, arsenal, église et maisons dedans, une jetée vers la mer.
// phi : direction (dans le plan) d'où vient l'assiégeant ; la courtine qui lui fait face recevra la brèche.
function prisme(L, bas, haut, y0, y1, col, ep = 0.15) { // bas, haut : 4 points [x, z] dans l'ordre ; faces tournées vers l'extérieur
  const v = [], cx = bas.reduce((s, p) => s + p[0], 0) / 4, cz = bas.reduce((s, p) => s + p[1], 0) / 4, cy = (y0 + y1) / 2;
  const B = bas.map(([x, z]) => [x, y0, z]), Hh = haut.map(([x, z]) => [x, y1, z]), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tri = (p, q, r) => { a.set(...p); b.set(...q).sub(a); c.set(...r).sub(a); b.cross(c); const mx = (p[0] + q[0] + r[0]) / 3 - cx, my = (p[1] + q[1] + r[1]) / 3 - cy, mz = (p[2] + q[2] + r[2]) / 3 - cz; if (b.x * mx + b.y * my + b.z * mz < 0) v.push(...p, ...r, ...q); else v.push(...p, ...q, ...r); };
  const quad = (p, q, r, s) => { tri(p, q, r); tri(p, r, s); };
  quad(Hh[0], Hh[1], Hh[2], Hh[3]); quad(B[0], B[1], B[2], B[3]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(B[i], B[j], Hh[j], Hh[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  put(L, g, col, 0, 0, 0, 0, ep);
}
function forteresse(L, LB, ex, E, phi) {
  const indus = EPOQUE === 'industrie', H = { ancien: 1.8, lumieres: 1.9, empire: 2.05, industrie: 1.35 }[EPOQUE];
  const pierre = { ancien: 0xdccb9e, lumieres: 0xd6c8a6, empire: 0xcbc5b4, industrie: 0xa8553c }[EPOQUE], herbe = 0x9ab85c, haut = indus ? 0x8a3f2c : 0xece2c4;
  const Rt = 8.0, Rs = 6.4, Rc = 5.6, sa = 0.26, fa = 0.4, pol = (R, a) => [R * Math.cos(a), R * Math.sin(a)];
  const P = [], bast = [];
  for (let i = 0; i < 5; i++) { const a = phi + Math.PI / 5 + i * 2 * Math.PI / 5; bast.push(a); P.push(pol(Rc, a - fa), pol(Rs, a - sa), pol(Rt, a), pol(Rs, a + sa), pol(Rc, a + fa)); }
  const Q = P.map(([x, z]) => [x * 0.8, z * 0.8]), Tt = P.map(([x, z], j) => [x + (Q[j][0] - x) * (indus ? 0.22 : 0.12), z + (Q[j][1] - z) * (indus ? 0.22 : 0.12)]);
  // fossé (en eau avant l'ère industrielle) sous l'enceinte
  { const s = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x * 1.1, -z * 1.1))); s.holes.push(new THREE.Path(P.map(([x, z]) => new THREE.Vector2(x * 0.96, -z * 0.96)).reverse())); const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); g.rotateX(-Math.PI / 2); put(L, g, indus ? 0x7d8f5a : 0x4f9fcf, 0, 0.02, 0, 0, 0);
    const s2 = new THREE.Shape(Q.map(([x, z]) => new THREE.Vector2(x * 1.02, -z * 1.02))); const g2 = new THREE.ExtrudeGeometry(s2, { depth: 0.12, bevelEnabled: false }); g2.rotateX(-Math.PI / 2); put(L, g2, E.pave, 0, 0.02, 0, 0, 0); }
  const lerp = (A, B, f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
  const mur = (Lx, p0, p1, q1, q0, t0, t1) => {
    prisme(Lx, [p0, p1, q1, q0], [t0, t1, q1, q0], 0, H, pierre);
    prisme(Lx, [t0, t1, q1, q0], [t0, t1, q1, q0], H, H + 0.05, herbe, 0);
    const i0 = lerp(t0, q0, 0.22), i1 = lerp(t1, q1, 0.22); prisme(Lx, [t0, t1, i1, i0], [t0, t1, i1, i0], H, H + 0.38, haut, 0.08); // parapet
  };
  for (let j = 0; j < 25; j++) {
    const k = (j + 1) % 25;
    if (j === 24) { // la courtine face à l'assiégeant, en trois morceaux : celui du milieu s'effondre en brèche
      const cut = f => [lerp(P[j], P[k], f), lerp(Q[j], Q[k], f), lerp(Tt[j], Tt[k], f)], [p1, q1, t1] = cut(0.24), [p2, q2, t2] = cut(0.76);
      mur(L, P[j], p1, q1, Q[j], Tt[j], t1); mur(LB, p1, p2, q2, q1, t1, t2); mur(L, p2, P[k], Q[k], q2, t2, Tt[k]);
    } else mur(L, P[j], P[k], Q[k], Q[j], Tt[j], Tt[k]);
  }
  // demi-lunes devant les courtines (Lumières, Empire), échauguettes à la pointe des bastions, canons sur les bastions
  if (EPOQUE === 'lumieres' || EPOQUE === 'empire') for (let i = 1; i < 5; i++) {
    const m = phi + i * 2 * Math.PI / 5, b1 = pol(Rc * 1.16, m - 0.24), b2 = pol(Rc * 1.16, m + 0.24), t1 = pol(Rc * 1.46, m - 0.03), t2 = pol(Rc * 1.46, m + 0.03);
    const cx = (b1[0] + b2[0] + t1[0] + t2[0]) / 4, cz = (b1[1] + b2[1] + t1[1] + t2[1]) / 4, rentre = p => lerp(p, [cx, cz], 0.18), haut4 = [b1, t1, t2, b2].map(rentre);
    prisme(L, [b1, t1, t2, b2], haut4, 0, H * 0.6, pierre); prisme(L, haut4, haut4.map(p => lerp(p, [cx, cz], 0.08)), H * 0.6, H * 0.64, herbe, 0);
  }
  ex.canons = [];
  bast.forEach((a, i) => {
    if (!indus) { const [x, z] = pol(Rt - 0.6, a); put(L, cyl(0.3, 0.26, 0.75, 8), pierre, x, H + 0.38, z, 0, 0.08); put(L, cone(0.42, 0.55, 8), ARDOISE, x, H + 1.03, z, 0, 0.06); }
    if (i === 0 || i === 4) for (const da of [-0.12, 0.12]) {
      const a2 = a + da * (i === 0 ? -1 : 1) * 2.2, [x, z] = pol(Rs - 0.2, a2), b = cyl(0.11, 0.17, 1.2, 8); b.rotateZ(-Math.PI / 2);
      put(L, b, indus ? 0x3a3d42 : BRONZE, x, H + 0.32, z, -a2, 0.05); ex.canons.push([x + Math.cos(a2) * 0.65, H + 0.36, z + Math.sin(a2) * 0.65]);
    }
  });
  // porte (vers le nord) et pont sur le fossé
  let best = 1, bd = 9;
  for (let n = 1; n < 5; n++) { const m = phi + n * 2 * Math.PI / 5, d = Math.abs(Math.atan2(Math.sin(m + Math.PI / 2), Math.cos(m + Math.PI / 2))); if (d < bd) { bd = d; best = n; } }
  { const m = phi + best * 2 * Math.PI / 5, j = 5 * (best - 1) + 4, A = P[j], B = P[(j + 1) % 25], mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, ry = -Math.atan2(B[1] - A[1], B[0] - A[0]), ox = Math.cos(m), oz = Math.sin(m);
    put(L, boite(1.6, 1.45, 0.3), haut, mx + ox * 0.05, 0.72, mz + oz * 0.05, ry, 0.08); put(L, boite(0.9, 1.05, 0.34), 0x3a2a1e, mx + ox * 0.08, 0.52, mz + oz * 0.08, ry, 0);
    put(L, boite(0.95, 0.12, 1.6), 0x8b5a2b, mx + ox * 0.9, 0.12, mz + oz * 0.9, ry, 0.05);
    ex.porte = { x: mx + ox * 0.2, z: mz + oz * 0.2, ox, oz }; }
  // jetée vers la mer et grue du port
  { const a = ex.jetee, [jx, jz] = pol(9.4, a), sx = -Math.sin(a), sz = Math.cos(a); put(L, boite(7.4, 0.35, 1.8), 0x8b5a2b, jx, 0.25, jz, -a, 0.08);
    for (const R of [6.6, 9.4, 12.4]) for (const s of [-0.7, 0.7]) { const [x, z] = pol(R, a); put(L, boite(0.28, 3, 0.28), BOIS, x + sx * s, -1.3, z + sz * s, 0, 0); }
    { const [x, z] = pol(11.2, a); put(L, boite(0.3, 3.6, 0.3), BOIS, x - sx * 0.55, 2.1, z - sz * 0.55, 0, 0.06); const fl = boite(2.6, 0.2, 0.2); fl.rotateZ(0.4); put(L, fl, BOIS, x - sx * 0.55 + Math.cos(a) * 1.1, 3.9, z - sz * 0.55 + Math.sin(a) * 1.1, -a, 0.05); }
    for (const [R, s] of [[8.0, -0.35], [8.8, -0.4], [8.4, -0.3]]) { const [x, z] = pol(R, a); caisse(L, x + sx * s, z + sz * s, 0.75, 0.15); } }
  // dedans : donjon (le drapeau), arsenal (cible du sabotage), église, maisons
  { const [x, z] = pol(1.5, phi + Math.PI), hd = 2.4 * E.h; put(L, boite(1.8, hd, 1.8), indus ? 0xb7634a : PIERRE, x, hd / 2, z, 0, 0.15); put(L, cone(1.45, 1.4, 4), ARDOISE, x, hd + 0.7, z, Math.PI / 4, 0.12); put(L, boite(0.16, 3, 0.16), 0x4a3420, x, hd + 1.5, z, 0, 0.06); ex.drapRival = [x, hd + 2.5, z]; }
  { const [x, z] = pol(2.3, phi + 1.9), ry = -(phi + 1.9) + Math.PI / 2; put(L, boite(2.6, 1.6 * E.h, 1.4), indus ? 0xa8553c : PIERRE, x, 0.8 * E.h, z, ry, 0.15); toit(L, 1.7, 2.9, 0.9, ARDOISE, x, 1.6 * E.h, z, ry); ex.arsenal = [x, 1.6 * E.h + 0.6, z]; }
  { const [x, z] = pol(2.3, phi - 1.9); eglise(L, ex, E, x, z, 0.55); }
  for (const da of [0.45, 1.15, 2.6, 3.7, 5.15, 5.85]) { const [x, z] = pol(3.1, phi + da); maison(L, ex, x, z, -(phi + da) + Math.PI / 2, 0.62, E); }
  // défenseurs sur la courtine et les bastions voisins
  ex.defenseurs = [pol(4.6, phi - 0.12), pol(4.6, phi + 0.12), pol(6.2, phi + 0.68), pol(6.2, phi - 0.68)].map(([x, z]) => [x, H + 0.05, z]);
  ex.breche = { H, Rc, pied: pol(Rc + 0.55, phi) };
}

// ---------------------------------------------------------------- ouvrages et troupes d'un siège, communs à la petite et à la grande ville
// S.pt(d, v) : point à la distance d (le pied du mur assiégé vers d = 0,58) et au décalage latéral v ; (S.ux, S.uz) va de la ville vers le camp.
// e grossit les ouvrages pour qu'ils restent lisibles de plus loin (grande ville).
const ETAPES_SIEGE = [ // parallèles de Vauban et boyaux en zigzag, avec le mois où chacun est creusé
  { m: 1, pts: [[3.0, 0.05], [2.7, 0.24], [2.4, -0.18], [2.12, 0.16], [1.88, -0.04]] }, { m: 1, pts: [[1.88, -0.78], [1.86, 0.78]] },
  { m: 2, pts: [[1.88, -0.04], [1.72, 0.2], [1.57, -0.17], [1.42, 0.04]] }, { m: 2.6, pts: [[1.42, -0.62], [1.42, 0.62]] },
  { m: 4, pts: [[1.42, 0.04], [1.3, -0.17], [1.17, 0.14], [1.04, -0.02]] }, { m: 5, pts: [[1.04, -0.42], [1.04, 0.42]] },
];
function travauxSiege(S, P, roy, e = 1, etapes = ETAPES_SIEGE) {
  S.tranchees = etapes.map(({ m, pts }) => {
    const Lt = lot();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = S.pt(...pts[i]), b = S.pt(...pts[i + 1]), l = Math.hypot(b.x - a.x, b.z - a.z), cap = -Math.atan2(b.z - a.z, b.x - a.x), nb = Math.ceil(l / 0.1);
      let nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l; if (nx * -S.ux + nz * -S.uz < 0) { nx = -nx; nz = -nz; } // parapet côté ville
      for (let s = 0; s < nb; s++) { // par tronçons, chacun posé sur le sol de sa case (le boyau descend de la colline du camp)
        const f = (s + 0.5) / nb, mx = a.x + (b.x - a.x) * f, mz = a.z + (b.z - a.z) * f, y = solEn(mx, mz);
        put(Lt, boite(l / nb + 0.05 * e, 0.003 * e, 0.062 * e), 0xb59c68, mx + nx * 0.008 * e, y + 0.0015 * e, mz + nz * 0.008 * e, cap, 0); // terre rejetée
        put(Lt, boite(l / nb + 0.026 * e, 0.004 * e, 0.026 * e), 0x4a3522, mx - nx * 0.004 * e, y + 0.0025 * e, mz - nz * 0.004 * e, cap, 0); // le fossé
      }
    }
    const g = fige(Lt, GUERRE); g.userData.m = m; return g;
  });
  { const Lg = lot(); for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const p = S.pt(1.35, s * (0.24 + i * 0.065 * e)), y = solEn(p.x, p.z); put(Lg, cyl(0.014 * e, 0.014 * e, 0.034 * e, 8), 0x9a7a4a, p.x, y + 0.017 * e, p.z, 0, 0.003); put(Lg, cyl(0.015 * e, 0.015 * e, 0.006 * e, 8), 0x6a5030, p.x, y + 0.036 * e, p.z, 0, 0); } S.gabions = fige(Lg, GUERRE); S.gabions.userData.m = 2.6; }
  S.batteries = [-1, 1].map(s => {
    const Lb = lot(), p = S.pt(1.5, s * 0.42), canonsL = [];
    for (const x of [-1.25, 1.25]) {
      if (EPOQUE === 'industrie') { // canon rayé de fer sur affût de fer
        const f = cyl(0.17, 0.27, 3.1, 10); f.rotateX(Math.PI / 2 - 0.1); put(Lb, f, 0x3a3d42, x, 1.05, 0.55, 0, 0.06); put(Lb, boite(0.6, 0.45, 2.1), 0x5a5f66, x, 0.62, -0.25, 0, 0.05);
        for (const dx of [-0.55, 0.55]) { const r = cyl(0.6, 0.6, 0.14, 12); r.rotateZ(Math.PI / 2); put(Lb, r, 0x2b2b30, x + dx, 0.6, 0, 0, 0.05); }
      } else canon(Lb, P, x, 0);
      canonsL.push([x, 1.12, 2.05]);
      fantassin(Lb, P, x - 0.9, -1.4, roy);
    }
    for (const x of [-0.2, 0.25]) put(Lb, cyl(0.38, 0.38, 0.8, 8), 0x6b4a2a, x, 0.4, -2.2, 0, 0.05);
    const g = fige(Lb, GUERRE); g.scale.setScalar(0.05 * e); g.position.set(p.x, solEn(p.x, p.z), p.z); g.rotation.y = capVers(-S.ux, -S.uz);
    return { g, canonsL, ph: s > 0 ? 0 : 1.3 };
  });
}
// l'assaut : huit soldats et un porte-drapeau
function troupesAssaut(S, P, roy, ech) {
  S.assaut = Array.from({ length: 8 }, () => { const s = soldat(GUERRE, P, roy, 'ligne', ech); s.visible = false; return s; });
  S.drapBreche = new THREE.Group(); { const L2 = lot(); put(L2, boite(0.14, 4.6, 0.14), 0x4a3420, 0, 2.3, 0, 0, 0.05); fige(L2, S.drapBreche); drapeau(S.drapBreche, roy, 0, 3.9, 0, 1.6, 1.05); } S.drapBreche.scale.setScalar(ech); S.drapBreche.visible = false; GUERRE.add(S.drapBreche);
}
// gravats au pied de la brèche (unités des bâtiments, ramenées par ech)
function gravatsSiege(S, pierreG, x, y, z, ry, ech) {
  const Lr = lot(), b = sphere(1.5, 1); b.scale(1.3, 0.62, 1.9); put(Lr, b, pierreG, -0.3, 0, 0, 0, 0.12);
  for (const [gx, gz, s] of [[1.2, 1.1, 0.7], [-0.6, -1.6, 0.6], [1.6, -0.8, 0.55], [0.4, 1.9, 0.5], [-1.4, 0.9, 0.6]]) put(Lr, boite(s, s * 0.7, s * 0.8), pierreG, gx, s * 0.3, gz, gx * 2, 0.06);
  S.gravats = fige(Lr, GUERRE); S.gravats.position.set(x, y, z); S.gravats.rotation.y = ry; S.echG = ech;
}

// ---------------------------------------------------------------- tout construire (à chaque changement d'époque ou de saison)
let G = null, GUERRE = null;
const SC = { courante: 'ensemble', t: {}, mission: 'renseignement', missionChoisie: false, s1: { mois: 1, assaut: -1, prise: false }, s2: { mois: 1, assaut: -1, prise: false } }; // s1 : petite ville, s2 : grande ville
const PAL = () => PALIERS[PALIER_EPOQUE[EPOQUE]];
function construireGuerre() {
  if (GUERRE) scene.remove(GUERRE);
  GUERRE = new THREE.Group(); scene.add(GUERRE); pavillons.length = 0;
  const E = EPOQUES[EPOQUE], P = PAL(), roy = ROYAUME;
  G = { nos: [], rivaux: [], cachees: [] };
  REMP.cur = REMP.vieux = REMP.echaf = null; REMP.debut = -99;
  const graine = c => { let i = 0; rnd = () => hache(c * 31 + i++, 4242, 77); };
  // ---- ports : le nôtre près de la capitale, celui de l'île alliée (et sa cabane)
  const port = (k, coul) => { graine(k.c * 13 + k.r); const L = lot(), ex = { fum: [], drap: [] }; portBat(L, ex, E); const [dx, dz] = dirMer(k); const g = figeBat(L, ex, k, -Math.atan2(dz, dx), GUERRE, coul); for (const a of ex.fum) cheminees.push({ pos: new THREE.Vector3(...a).applyMatrix4(g.matrixWorld), noire: false, prochain: Math.random() * 2 }); return { k, dx, dz, quai: { x: k.x + dx * 0.84, z: k.z + dz * 0.84 } }; };
  G.portNous = port(LIEU.portNous, roy); G.portAllie = port(LIEU.allie, VERT);
  { graine(5); const L = lot(), ex = { fum: [], drap: [] }; ROYAUME = VERT; BATR.cabane(L, ex, E); mat(L, ex, 2.2, -1.4, 6); ROYAUME = roy; const g = figeBat(L, ex, LIEU.cabaneAllie, 0.4, GUERRE, VERT); for (const a of ex.fum) cheminees.push({ pos: new THREE.Vector3(...a).applyMatrix4(g.matrixWorld), noire: false, prochain: Math.random() * 2 }); }
  // ---- revue de la flotte de l'époque, mouillée au sud-ouest de la capitale
  G.revue = FLOTTE[EPOQUE].map((ty, i) => { const n = navire(ty, roy); GUERRE.add(n.g); n.x = 1.9 + i * 1.6; n.z = 12.25 - i * 0.12; G.nos.push(n); return n; });
  // ---- commerce : une flûte (un vapeur à l'ère industrielle) entre notre port et le port allié
  {
    const a = G.portNous, b = G.portAllie, eauV = k => voisins(k).filter(n => TERR[n.t].eau);
    const dep = eauV(a.k).sort((x, y) => Math.hypot(x.x - b.k.x, x.z - b.k.z) - Math.hypot(y.x - b.k.x, y.z - b.k.z))[0], arr = eauV(b.k).sort((x, y) => Math.hypot(x.x - a.k.x, x.z - a.k.z) - Math.hypot(y.x - a.k.x, y.z - a.k.z))[0];
    const prev = new Map([[dep, null]]), file = [dep];
    while (file.length) { const k = file.shift(); if (k === arr) break; for (const n of voisins(k)) if (TERR[n.t].eau && !prev.has(n)) { prev.set(n, k); file.push(n); } }
    const ch = []; for (let k = arr; k; k = prev.get(k)) ch.unshift(k);
    G.route = cheminLisse([[a.quai.x + a.dz * 0.2, a.quai.z - a.dx * 0.2], ...ch.map(k => [k.x, k.z]), [b.quai.x + b.dz * 0.2, b.quai.z - b.dx * 0.2]]);
    G.marchand = navire(transport(), roy); GUERRE.add(G.marchand.g); G.nos.push(G.marchand);
  }
  // ---- bataille navale au large : deux lignes de file qui se canonnent
  {
    const B = LIEU.bataille, types = [lourd(), leger()];
    G.bataille = { B, nous: types.map(ty => navire(ty, roy)), eux: types.map(ty => navire(ty, ROUGE)), debris: lot() };
    for (const n of [...G.bataille.nous, ...G.bataille.eux]) GUERRE.add(n.g);
    G.nos.push(...G.bataille.nous); G.rivaux.push(...G.bataille.eux);
    G.bataille.feu = feu(G.bataille.eux[1].corps, -0.5, G.bataille.eux[1].T.H, 0, 6);
  }
  // ---- débarquement : la flûte mouille devant la plage, deux chaloupes amènent seize soldats qui se forment en ligne
  {
    const Pk = LIEU.plage, [dx, dz] = dirMer(Pk), px = -dz, pz = dx;
    const D = { Pk, dx, dz, px, pz, ancre: { x: Pk.x + dx * 1.6, z: Pk.z + dz * 1.6 }, depart: { x: Pk.x + dx * 1.6 - 3.2, z: Pk.z + dz * 1.6 - 0.35 } };
    D.capAncre = -Math.atan2(D.ancre.z - D.depart.z, D.ancre.x - D.depart.x);
    D.navire = navire(transport(), roy); D.navireF = navire(transport(), roy, { ferle: true });
    for (const n of [D.navire, D.navireF]) GUERRE.add(n.g);
    G.nos.push(D.navire, D.navireF);
    D.chaloupes = [0, 1].map(() => { const c = chaloupe(roy, P); GUERRE.add(c.g); return c; });
    D.soldats = Array.from({ length: 16 }, (_, i) => { const s = soldat(GUERRE, P, roy, i === 7 ? 'grenadier' : 'ligne'); s.visible = false; return s; });
    D.porteDrapeau = new THREE.Group(); GUERRE.add(D.porteDrapeau); { const L = lot(); put(L, boite(0.14, 4.6, 0.14), 0x4a3420, 0.45, 2.3, 0.2, 0, 0.05); fige(L, D.porteDrapeau); drapeau(D.porteDrapeau, roy, 0.45, 3.95, 0.2, 1.6, 1.05); soldat(D.porteDrapeau, { ...P, piques: false, baionnette: false }, roy, 'ligne', 1); D.porteDrapeau.scale.setScalar(ECH_GENS); D.porteDrapeau.visible = false; }
    G.deb = D;
  }
  // ---- la ville rivale fortifiée, sa jetée, sa flûte à quai et notre blocus devant
  {
    const V = LIEU.rivale, C = LIEU.camp, ux = (C.x - V.x) / Math.hypot(C.x - V.x, C.z - V.z), uz = (C.z - V.z) / Math.hypot(C.x - V.x, C.z - V.z), phi = Math.atan2(uz, ux);
    const S = { V, ux, uz, wx: -uz, wz: ux, phi };
    S.pt = (d, v) => ({ x: V.x + ux * d - uz * v, z: V.z + uz * d + ux * v });
    graine(77); const L = lot(), LB = lot(), ex = { fum: [], jetee: phi + 4 * Math.PI / 5 }; forteresse(L, LB, ex, E, phi);
    const fort = fige(L, GUERRE); fort.scale.setScalar(ECH_BAT); fort.position.set(V.x, 0, V.z);
    S.brecheG = fige(LB, GUERRE); S.brecheG.scale.setScalar(ECH_BAT); S.brecheG.position.set(V.x, 0, V.z);
    S.ex = ex; S.H = ex.breche.H * ECH_BAT;
    fort.updateMatrixWorld(true);
    const monde = a => new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(fort.matrixWorld);
    S.fum = ex.fum.map(a => ({ pos: monde(a), prochain: Math.random() * 2 }));
    S.canons = ex.canons.map(monde); S.arsenal = monde(ex.arsenal); S.porte = { ...monde([ex.porte.x, 0, ex.porte.z]), ox: ex.porte.ox, oz: ex.porte.oz };
    S.drapeau = drapeau(fort, ROUGE, ...ex.drapRival, 1.9, 1.15, 0, true);
    S.feuArsenal = feu(GUERRE, S.arsenal.x, S.arsenal.y - 0.02, S.arsenal.z, 0.35);
    // gravats au pied de la brèche
    { const [px, pz] = ex.breche.pied; gravatsSiege(S, { ancien: 0xdccb9e, lumieres: 0xd6c8a6, empire: 0xcbc5b4, industrie: 0xa8553c }[EPOQUE], V.x + px * ECH_BAT, 0, V.z + pz * ECH_BAT, -phi, ECH_BAT); S.echB = ECH_BAT; }
    // défenseurs sur les murs
    S.defenseurs = ex.defenseurs.map(a => { const s = soldat(GUERRE, P, ROUGE, 'ligne', ECH_GENS * 0.9); const m = monde(a); s.position.copy(m); s.rotation.y = capVers(ux, uz); G.rivaux.push({ g: s }); return s; });
    // flûte rivale à quai, voiles serrées
    { const a = ex.jetee, n = navire('flute', ROUGE, { ferle: true }); GUERRE.add(n.g); const q = { x: V.x + Math.cos(a) * 1.02 + Math.sin(a) * 0.2, z: V.z + Math.sin(a) * 1.02 - Math.cos(a) * 0.2 }; n.x = q.x; n.z = q.z; n.cap = -a; S.aQuai = n; }
    // blocus : trois de nos navires de guerre mouillés en arc devant la ville, flanc tourné vers elle, voiles serrées, bouées de la ligne
    S.blocus = [[2.65, 150], [2.7, 177], [2.6, 124]].map(([R, deg], i) => { const a = deg * Math.PI / 180, n = navire(i === 1 ? lourd() : leger(), roy, { ferle: true }); GUERRE.add(n.g); n.x = V.x + Math.cos(a) * R; n.z = V.z + Math.sin(a) * R; n.cap = -(a + Math.PI / 2); G.nos.push(n); return n; });
    { const Lb = lot(); const pts = [S.blocus[1], S.blocus[0], S.blocus[2]]; for (let i = 0; i < 2; i++) for (let f = 0.2; f < 0.85; f += 0.15) put(Lb, sphere(0.022, 0), (f * 100 | 0) % 2 ? 0xd9322a : 0xf6f2ea, pts[i].x + (pts[i + 1].x - pts[i].x) * f, MER + 0.012, pts[i].z + (pts[i + 1].z - pts[i].z) * f, 0, 0.004); S.bouees = fige(Lb, GUERRE); }
    // siège : tranchées, gabions, deux batteries (communs aux deux sièges), puis le camp de tentes
    travauxSiege(S, P, roy, 1);
    { const Lc = lot(), Cp = S.pt(3.15, 0); let i = 0;
      for (const [lx, lz] of [[-6, -3], [-2, -4.5], [2, -4.5], [6, -3], [-6, 3.2], [-2, 4.6], [2, 4.6], [6, 3.2]]) { put(Lc, cone(1.5, 2, 4), i++ % 2 ? 0xe9e2d0 : new THREE.Color(roy).getHex(), lx, 1, lz, Math.PI / 4, 0.09); put(Lc, boite(0.5, 0.9, 0.1), 0x2a2420, lx + 1.05, 0.45, lz, Math.PI / 2, 0); }
      put(Lc, boite(0.16, 5.4, 0.16), 0x4a3420, 0, 2.7, 0, 0, 0.06);
      for (const a of [0, 1.2, 2.4]) put(Lc, boite(1.4, 0.18, 0.18), 0x6b4a2a, 3 + Math.cos(a) * 0.1, 0.12, 0, a, 0.06);
      for (let k = 0; k < 4; k++) put(Lc, sphere(0.22, 0), FER, -1 + (k % 2) * 0.45, 0.22 + (k >> 1) * 0.35, 2.2, 0, 0);
      fantassin(Lc, P, -3.2, 0, roy); fantassin(Lc, P, 4.6, -1.4, roy);
      const g = fige(Lc, GUERRE); g.scale.setScalar(0.06); g.position.set(Cp.x, solEn(Cp.x, Cp.z), Cp.z); g.rotation.y = capVers(-ux, -uz);
      drapeau(g, roy, 0, 4.7, 0, 2.4, 1.5); S.feuCamp = versMonde(g, 3, 0.9, 0); S.campFumee = 0;
      const f = feu(g, 3, 0.1, 0, 2.6); f.visible = true; S.flammeCamp = f; }
    troupesAssaut(S, P, roy, ECH_GENS);
    G.siege = S;
  }
  // ---- deux armées rivales : une dans les terres explorées (cachée hors de vue), une dans l'inconnu (révélée par l'espion)
  for (const [k, ry] of [[LIEU.armeeLoin, 2.2], [LIEU.armeeCachee, 2.6]]) { const g = fige(armee(P, ROUGE), GUERRE); g.scale.setScalar(ECH_BAT); g.position.set(k.x, topDe(k), k.z); g.rotation.y = ry; G.cachees.push(g); }
  // ---- l'espion, sa longue-vue, son rouleau de plans, sa lanterne ; les gardes et la cage quand il est démasqué
  {
    const Sp = { chemin: cheminLisse([LIEU.colline, LIEU.affut, LIEU.seuil].map(k => [k.x, k.z]).concat([[G.siege.porte.x, G.siege.porte.z]])), dernier: 0 };
    Sp.g = new THREE.Group(); GUERRE.add(Sp.g);
    Sp.corps = fige(modeleEspion(roy), Sp.g); Sp.corps.scale.setScalar(ECH_ESPION);
    { const L = lot(), lv = cyl(0.09, 0.15, 1.3, 8); lv.rotateZ(-Math.PI / 2 + 0.25); put(L, lv, 0xc9a24a, 0.75, 2.34, 0.12, 0, 0.04); Sp.longueVue = fige(L, Sp.corps); }
    { const L = lot(), r = cyl(0.13, 0.13, 0.95, 10); r.rotateX(Math.PI / 2); put(L, r, 0xf2e6c4, 0, 3.05, 0, 0, 0.04); put(L, cyl(0.145, 0.145, 0.14, 10).rotateX(Math.PI / 2), 0xb8322a, 0, 3.05, 0, 0, 0); put(L, boite(0.1, 0.7, 0.1), PEAU, 0, 2.55, 0.25, 0, 0.03); Sp.plans = fige(L, Sp.corps); }
    Sp.anneau = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: roy, transparent: true, opacity: 0.9, depthWrite: false })); GUERRE.add(Sp.anneau);
    Sp.lueur = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial({ map: tache, size: 0.18, color: 0xffc86a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); GUERRE.add(Sp.lueur);
    Sp.alerte = pastille(g => { rond(g, '#ffb02e'); g.fillStyle = '#24180f'; g.fillRect(41, 20, 14, 36); g.beginPath(); g.arc(48, 70, 8, 0, 7); g.fill(); }); GUERRE.add(Sp.alerte);
    Sp.etoile = pastille(g => { rond(g, '#fff2b8'); g.fillStyle = '#2f5fa8'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', 48, 52); }, 0.11); GUERRE.add(Sp.etoile);
    Sp.cage = fige(cage(), GUERRE); Sp.cage.scale.setScalar(ECH_ESPION);
    Sp.gardes = [0, 1, 2].map(() => { const s = soldat(GUERRE, P, ROUGE); G.rivaux.push({ g: s }); return s; });
    Sp.onde = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); GUERRE.add(Sp.onde);
    G.espion = Sp;
  }
  // ---- nos remparts (niveau choisi), la grande ville rivale assiégée, les forts d'armée
  construireRempartsCapitale(false);
  G.siege2 = construireSiege2(E, P, roy);
  G.forts = construireForts(E, P, roy);
}

// ---------------------------------------------------------------- les scènes
const CYCLE = { bataille: 32, debarquement: 48, espion: 30, revue: 1e9, commerce: 1e9, blocus: 1e9 };
const VUES = { // cible de la caméra : x, z, distance, inclinaison, cap
  ensemble: () => [COLS * SQ3 / 2, ROWS * 0.75, 27, 0.95, 0.35],
  revue: () => { const r = G.revue, a = r[0], b = r[r.length - 1]; return [(a.x + b.x) / 2, (a.z + b.z) / 2 + 0.1, 2.6 + Math.abs(b.x - a.x) * 1.05, 0.5, 0.05]; },
  commerce: () => { const a = G.portNous.quai, b = G.portAllie.quai; return [(a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(a.x - b.x, a.z - b.z) * 1.35, 0.9, 0.45]; },
  bataille: () => [LIEU.bataille.x - 0.6, LIEU.bataille.z, 5.2, 0.66, 0.1],
  debarquement: () => [LIEU.plage.x - 0.6, LIEU.plage.z + 0.45, 4.2, 0.66, -0.35],
  blocus: () => [LIEU.rivale.x - 1.1, LIEU.rivale.z + 0.6, 6, 0.75, 0.75],
  espion: () => [LIEU.seuil.x - 0.2, LIEU.seuil.z + 0.45, 4.3, 0.82, Math.PI - 0.35],
  siege: () => [LIEU.rivale.x + 1.1, LIEU.rivale.z + 0.1, 4.6, 0.78, 0.75],
  brouillard: () => [COLS * SQ3 * 0.72, ROWS * 0.55, 13, 0.95, 0.25],
  remparts: () => [centre.x, centre.z + 0.15, 11, 0.9, 0.35],
  siege2: () => { const M = VILLE2.mairie, C = VILLE2.camp; return [(M.x + C.x) / 2 - 0.2, M.z - 0.5, 9.6, 0.9, 0.1]; },
  forts: () => { const a = FORTS.k, b = FORTS.kRet, c = FORTS.kPris; return [(a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3 - 0.2, 6.8, 0.86, 0.08]; },
};
function voir(nom, relancer = true) {
  SC.courante = nom; const [x, z, d, tg, la] = VUES[nom]();
  vue.auto = false; vue.but = { x, z, d, tg, la };
  if (relancer) { SC.t[nom] = t; if (nom === 'espion') SC.reprise = true; if (nom === 'siege' || nom === 'siege2') Object.assign(nom === 'siege' ? SC.s1 : SC.s2, { mois: 1, assaut: -1, prise: false }); if (nom === 'forts') relancerForts(); if (nom === 'debarquement' || nom === 'espion' || nom === 'brouillard') { reexplorer(); tVision = 0; } }
}
const tau = (nom, tps) => { const c = CYCLE[nom] || 1e9; return ((tps - (SC.t[nom] || 0)) % c + c) % c; };
const tauPrec = {};
function animGuerre(dt, tps, calme) {
  if (!G) return;
  // caméra qui glisse vers la scène choisie
  if (vue.but) { const b = vue.but, k = 1 - Math.exp(-dt * 2.6); vue.cible.x += (b.x - vue.cible.x) * k; vue.cible.z += (b.z - vue.cible.z) * k; vue.d += (b.d - vue.d) * k; vue.tangage += (b.tg - vue.tangage) * k; let dl = b.la - vue.lacet; dl = Math.atan2(Math.sin(dl), Math.cos(dl)); vue.lacet += dl * k; if (Math.abs(b.d - vue.d) < 0.01 && Math.abs(dl) < 0.002) vue.but = null; }
  const T = {}; for (const n of ['bataille', 'debarquement', 'espion']) { T[n] = tau(n, tps); if (tauPrec[n] === undefined || T[n] < tauPrec[n]) tauPrec[n] = -1; }
  animRevue(dt, tps); animCommerce(dt, tps); animBataille(dt, tps, T.bataille, tauPrec.bataille); animDebarquement(dt, tps, T.debarquement, tauPrec.debarquement); animBlocus(dt, tps); animSiege(dt, tps); animEspion(dt, tps, T.espion, tauPrec.espion); animRemparts(dt, tps); animSiege2(dt, tps); animForts(dt, tps);
  for (const n in T) tauPrec[n] = T[n];
  // unités rivales et armées cachées : seulement en vue
  for (const g of G.cachees) g.visible = enVue(g.position.x, g.position.z);
  for (const r of G.rivaux) if (r.g.visible) r.g.visible = enVue(r.g.position.x, r.g.position.z);
  if ((tVision -= dt) <= 0) { tVision = 0.2; majVision(); }
  animBrume(dt, calme ? 0 : tps);
  // drapeaux des navires et des forts
  for (const f of pavillons) { const p = f.geometry.attributes.position, w = f.userData.w; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w; p.setZ(i, Math.sin(tps * (5 + VENT * 6) - u * 5) * u * 0.16 * w); } p.needsUpdate = true; }
  // éclairs et gerbes
  const pe = [], ce = [];
  for (let i = eclats.length - 1; i >= 0; i--) { const e = eclats[i]; e.vie -= dt; if (e.vie <= 0) { eclats.splice(i, 1); continue; } pe.push(e.x, e.y, e.z); const f = Math.min(1, e.vie / 0.1); ce.push(1 * f, 0.82 * f, 0.38 * f); }
  ECLATS.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pe, 3)); ECLATS.geometry.setAttribute('color', new THREE.Float32BufferAttribute(ce, 3));
  let ng = 0;
  for (let i = gerbes.length - 1; i >= 0; i--) { const g = gerbes[i]; g.age += dt; if (g.age > 0.9) { gerbes.splice(i, 1); continue; } }
  for (const g of gerbes) { const h = Math.sin(g.age / 0.9 * Math.PI) * 0.19 * g.h, r = 0.024 + g.age * 0.025; _m.compose(_p.set(g.x, MER, g.z), _q, _s.set(r, Math.max(0.001, h), r)); GERBES.setMatrixAt(ng++, _m); }
  GERBES.count = ng; GERBES.instanceMatrix.needsUpdate = true;
  majLegende();
}
// ---- revue de la flotte : au mouillage, ils se balancent
function animRevue(dt, tps) { for (const n of G.revue) poser(n, n.x + Math.sin(tps * 0.2 + n.ph) * 0.03, n.z, 0.12 + Math.sin(tps * 0.15 + n.ph) * 0.05, tps, dt); }
// ---- commerce : navette, trois secondes à quai à chaque bout, demi-tour pendant l'escale
function animCommerce(dt, tps) {
  const R = G.route, v = 0.3, tr = R.long / v, cyc = 2 * (tr + 3), u = tps % cyc, n = G.marchand;
  let sd, cap, vit = v;
  if (u < 3) { sd = 0; const p = R.en(0.02); cap = p.cap + Math.PI * (1 - lisse(0, 3, u)); vit = 0; }
  else if (u < 3 + tr) { sd = (u - 3) * v; cap = R.en(sd).cap; }
  else if (u < 6 + tr) { sd = R.long; const p = R.en(R.long - 0.02); cap = p.cap + Math.PI * lisse(3 + tr, 6 + tr, u); vit = 0; }
  else { sd = R.long - (u - 6 - tr) * v; cap = R.en(sd).cap + Math.PI; }
  const p = R.en(sd); poser(n, p.x, p.z, cap, tps, dt, { vitesse: vit });
}
// ---- bataille navale : bordées (éclairs, fumée de poudre), boulets qui éclaboussent ou touchent, un navire rival brûle et coule
function animBataille(dt, tps, u, u0) {
  const Bt = G.bataille, B = Bt.B, coule = Bt.eux[1];
  const xL = B.x - 1.1 + Math.min(u, 26) * 0.055;
  Bt.nous.forEach((n, i) => poser(n, xL - i * 0.95, B.z - 0.62, 0, tps, dt, { vitesse: 0.06 }));
  Bt.eux.forEach((n, i) => {
    let x = xL - i * 0.95 + 0.25, dy = 0, roulis = 0, tangage = 0, vit = 0.06;
    if (n === coule && u > 15) { const s = lisse(15, 27, u); x = B.x - 1.1 + 15 * 0.055 - 0.95 + 0.25 + (u - 15) * 0.012; roulis = s * 0.75; tangage = -s * 0.32; dy = -s * 0.62; vit = 0; }
    n.g.visible = !(n === coule && u > 27.5);
    poser(n, x, B.z + 0.62, 0, tps, dt, { vitesse: vit, roulis, tangage, dy });
  });
  Bt.feu.visible = u > 14.5 && u < 25; if (Bt.feu.visible) { animFeu(Bt.feu, tps); if (Math.random() < dt * 3) fumer(versMonde(coule.corps, 0, coule.T.H + 1.2, 0), { noire: true, k: 0.9 }); }
  if (franchit(u0, u, 27.4)) for (let k = 0; k < 6; k++) gerbe(coule.g.position.x + (Math.random() - 0.5) * 0.3, coule.g.position.z + (Math.random() - 0.5) * 0.2, 0.6);
  // bordées : chaque navire tire toutes les 3,2 s ; les sabords crachent l'un après l'autre
  const tirer = (n, cote, cible, i) => {
    const ports = n.ports[cote].length ? n.ports[cote] : [[0, n.T.H * 0.7, (cote === 'd' ? 1 : -1) * (n.T.W / 2 + 0.2)]];
    for (let b = 0; b < 5; b++) {
      const t0 = 3 + i * 0.8 + b * 3.2; if (n === coule && t0 > 14.5) continue;
      ports.forEach(([x, y, z], k) => {
        const tk = t0 + k * 0.07; if (!franchit(u0, u, tk)) return;
        const p = versMonde(n.corps, x, y, z); eclat(p, 1.5); fumer(p, { c: POUDRE, k: 1.25, vy: 0.05, vie: 3.4 });
        const tx = cible.g.position.x + (Math.random() - 0.5) * 0.7, tz = cible.g.position.z + (cote === 'd' ? -1 : 1) * (0.12 + Math.random() * 0.22);
        if (Math.random() < 0.65) setTimeout(() => gerbe(tx, tz), 280); else setTimeout(() => fumer({ x: cible.g.position.x + (Math.random() - 0.5) * 0.4, y: MER + 0.08, z: cible.g.position.z }, { c: POUSSIERE, k: 0.7, vie: 1.4 }), 280);
      });
    }
  };
  Bt.nous.forEach((n, i) => tirer(n, 'd', Bt.eux[i], i));
  Bt.eux.forEach((n, i) => tirer(n, 'g', Bt.nous[i], i + 0.5));
}
// ---- débarquement
function animDebarquement(dt, tps, u, u0) {
  const D = G.deb, a = D.ancre, d0 = D.depart, arrive = lisse(0, 8, u);
  const x = d0.x + (a.x - d0.x) * arrive, z = d0.z + (a.z - d0.z) * arrive, mouille = u > 8.2;
  D.navire.g.visible = !mouille; D.navireF.g.visible = mouille;
  poser(mouille ? D.navireF : D.navire, x, z, D.capAncre, tps, dt, { vitesse: mouille ? 0 : 0.25, mouille });
  // les chaloupes : trois allers-retours chacune, quatre soldats par voyage
  const hl = Math.hypot(a.x - d0.x, a.z - d0.z), hx = (a.x - d0.x) / hl, hz = (a.z - d0.z) / hl, sg = (-hz * -D.dx + hx * -D.dz) > 0 ? 1 : -1;
  const flanc = (s) => ({ x: a.x - hz * sg * 0.16 + hx * s * 0.08, z: a.z + hx * sg * 0.16 + hz * s * 0.08 }), rive = s => ({ x: D.Pk.x + D.dx * 0.93 + D.px * s * 0.16, z: D.Pk.z + D.dz * 0.93 + D.pz * s * 0.16 });
  D.chaloupes.forEach((c, j) => {
    const s = j ? 1 : -1, debut = 9 + j * 2.6, cyc = 7.6, A = flanc(s), Bp = rive(s);
    let f = 0, charge = true;
    const vis = u > debut - 0.6 && u < debut + 2 * cyc;
    if (u >= debut) { const w = (u - debut) % cyc; charge = w < 3.2 || w > 7.3; f = w < 3.2 ? lisse(0, 3.2, w) : w < 4.2 ? 1 : 1 - lisse(4.2, 7.4, w); }
    c.g.visible = vis; c.pass.visible = charge;
    const cx = A.x + (Bp.x - A.x) * f, cz = A.z + (Bp.z - A.z) * f;
    c.g.position.set(cx, MER + 0.004 + Math.sin(tps * 2 + c.ph) * 0.004, cz); c.g.rotation.set(Math.sin(tps * 3 + c.ph) * 0.06, -Math.atan2(Bp.z - A.z, Bp.x - A.x), Math.sin(tps * 2.4) * 0.05);
    if (vis && f > 0.05 && f < 0.95 && Math.random() < dt * 4) fumer({ x: cx - D.dx * 0.12, y: MER + 0.004, z: cz - D.dz * 0.12 }, { c: ECUME, vy: 0, vie: 1.2, k: 0.25 });
  });
  // à terre : chacun remonte la plage vers sa place dans la ligne (deux rangs de huit, face aux terres)
  let aTerre = 0;
  D.soldats.forEach((s, i) => {
    const j = i % 2, q = i >> 1, voyage = q >> 2, place = q % 4, quand = 9 + j * 2.6 + voyage * 7.6 + 3.4 + place * 0.25;
    s.visible = u > quand && u < 47.5; if (!s.visible) return;
    aTerre++;
    const rang = i >> 3, col = i % 8, cible = { x: D.Pk.x + D.dx * (0.12 - rang * 0.15) + D.px * (col - 3.5) * 0.105, z: D.Pk.z + D.dz * (0.12 - rang * 0.15) + D.pz * (col - 3.5) * 0.105 };
    const dep = rive(j ? 1 : -1), f = lisse(quand, quand + 2.6, u), x = dep.x + (cible.x - dep.x) * f, z = dep.z + (cible.z - dep.z) * f;
    s.position.set(x, Math.max(solEn(x, z), MER - 0.01) + (f < 1 ? Math.abs(Math.sin(tps * 9 + i)) * 0.006 : 0), z);
    s.rotation.y = f < 1 ? capVers(cible.x - dep.x, cible.z - dep.z) : capVers(-D.dx, -D.dz);
  });
  D.debarques = aTerre;
  const pd = D.porteDrapeau; pd.visible = u > 31 && u < 47.5;
  if (pd.visible) { const f = lisse(31, 33.5, u), dep = rive(0), c = { x: D.Pk.x - D.dx * 0.32, z: D.Pk.z - D.dz * 0.32 }; const x = dep.x + (c.x - dep.x) * f, z = dep.z + (c.z - dep.z) * f; pd.position.set(x, Math.max(solEn(x, z), MER), z); pd.rotation.y = capVers(-D.dx, -D.dz); }
}
// ---- blocus : nos navires mouillés, le port rival à l'arrêt (flûte à quai, voiles serrées)
function animBlocus(dt, tps) {
  const S = G.siege;
  for (const n of S.blocus) poser(n, n.x, n.z, n.cap + Math.sin(tps * 0.12 + n.ph) * 0.04, tps, dt, { mouille: true });
  poser(S.aQuai, S.aQuai.x, S.aQuai.z, S.aQuai.cap, tps, dt, { mouille: true });
}
// ---- siège : un mois toutes les quatre secondes ; tranchées qui avancent, batteries qui tirent, brèche qui s'ouvre, famine, reddition ; assaut au bouton
// (commun aux deux sièges : st est l'état du siège, duree la durée d'un mois en secondes)
function animSiegeDe(S, st, dt, tps, duree) {
  if (st.assaut < 0) { st.mois += dt / duree; if (st.mois > 9.6) { st.mois = 1; st.prise = false; } }
  const m = st.mois, rendue = m >= 8 && st.assaut < 0;
  for (const g of S.tranchees) g.visible = m >= g.userData.m;
  S.gabions.visible = m >= 2.6;
  for (const b of S.batteries) b.g.visible = m >= 2.6;
  const br = lisse(3.5, 7, m); S.brecheG.scale.y = S.echB * (1 - 0.78 * br); S.gravats.scale.setScalar(Math.max(0.001, br) * S.echG);
  // les batteries tirent (pas après la reddition ni pendant l'assaut)
  const tire = m >= 3 && !rendue && st.assaut < 0 && !st.prise;
  for (const b of S.batteries) b.canonsL.forEach(([x, y, z], i) => {
    const per = 2.6, ph = b.ph + i * 1.1, k0 = Math.floor((tps - dt - ph) / per), k1 = Math.floor((tps - ph) / per);
    if (!tire || k0 === k1 || !b.g.visible) return;
    const p = versMonde(b.g, x, y, z); eclat(p, 1.6); fumer(p, { c: POUDRE, k: 1.5, vy: 0.08, vie: 3 });
    const cible = S.pt(0.6, (Math.random() - 0.5) * 0.2); setTimeout(() => fumer({ x: cible.x, y: S.H * 0.6, z: cible.z }, { c: POUSSIERE, k: 1.1, vie: 1.8, vy: 0.06 }), 380);
  });
  // la ville répond depuis ses bastions jusqu'au septième mois
  if (m < 7 && m >= 2.6 && !st.prise && st.assaut < 0) S.canons.forEach((c, i) => { const per = 3.4, ph = i * 0.9, k0 = Math.floor((tps - dt - ph) / per), k1 = Math.floor((tps - ph) / per); if (k0 !== k1 && enVue(c.x, c.z)) { eclat(c, 1.2); fumer(c, { c: POUDRE, k: 0.9, vie: 2.4 }); const p = S.pt(1.6 + Math.random() * 0.2, (Math.random() - 0.5) * 1.2); setTimeout(() => fumer({ x: p.x, y: solEn(p.x, p.z) + 0.02, z: p.z }, { c: POUSSIERE, k: 0.8, vie: 1.4 }), 420); } });
  // famine : de moins en moins de cheminées fument
  const actives = Math.round(S.fum.length * Math.max(0, 1 - (m - 1) / 6));
  S.fum.forEach((c, i) => { if (i >= actives || st.prise) return; if ((c.prochain -= dt) <= 0) { c.prochain = 0.9 + Math.random() * 0.6; fumer(c.pos, { k: 0.6 }); } });
  // camp : feu et fumée
  animFeu(S.flammeCamp, tps); if ((S.campFumee -= dt) <= 0) { S.campFumee = 1.1; fumer(S.feuCamp, { k: 0.45 }); }
  // drapeau de la ville : rouge, blanc à la reddition, le nôtre après l'assaut
  S.drapeau.material.color.set(st.prise ? ROYAUME : rendue ? '#f6f4ee' : ROUGE);
  S.defenseurs.forEach(d => { d.visible = !rendue && !st.prise && (st.assaut < 0 || tps - st.assaut < 5); });
  // l'assaut
  const ua = st.assaut >= 0 ? tps - st.assaut : -1, hB = S.H * (1 - 0.78 * br);
  S.assaut.forEach((s, i) => {
    s.visible = ua >= 0 && ua < 13; if (!s.visible) return;
    const v = (i - 3.5) * 0.07, d0 = S.pt(1.04, v), d1 = S.pt(0.72, v * 0.5), d2 = S.pt(0.53, v * 0.3), d3 = S.pt(0.32, v * 0.8), w = ua - i * 0.22;
    let x, z, y; const f1 = lisse(0, 3.2, w), f2 = lisse(3.2, 5, w), f3 = lisse(5.2, 7, w);
    if (w < 3.2) { x = d0.x + (d1.x - d0.x) * f1; z = d0.z + (d1.z - d0.z) * f1; y = solEn(x, z); }
    else if (w < 5.2) { x = d1.x + (d2.x - d1.x) * f2; z = d1.z + (d2.z - d1.z) * f2; y = f2 * hB; }
    else { x = d2.x + (d3.x - d2.x) * f3; z = d2.z + (d3.z - d2.z) * f3; y = hB * (1 - f3) + 0.02 * f3; }
    s.position.set(x, y + (w < 7 ? Math.abs(Math.sin(tps * 10 + i)) * 0.006 : 0), z); s.rotation.y = capVers(-S.ux, -S.uz);
    if (w > 0.5 && w < 3 && Math.random() < dt * 0.9) { const p = versMonde(s, 0.42, 2.8, 0.5); fumer(p, { c: POUDRE, k: 0.5, vie: 1.6 }); eclat(p); }
  });
  if (ua >= 0) { for (const d of S.defenseurs) if (d.visible && Math.random() < dt * 1.2) { const p = versMonde(d, 0.42, 2.8, 0.5); eclat(p); fumer(p, { c: POUDRE, k: 0.5, vie: 1.6 }); } }
  S.drapBreche.visible = ua > 6.2 && ua < 13; if (S.drapBreche.visible) { const p = S.pt(0.54, 0); S.drapBreche.position.set(p.x, hB, p.z); }
  if (ua > 8) st.prise = true;
  if (ua > 13) { st.assaut = -1; st.mois = 1; st.prise = false; }
}
function animSiege(dt, tps) { animSiegeDe(G.siege, SC.s1, dt, tps, 4); }
// « Assaut ! » : sur la grande ville si on la regarde, sinon sur la petite
function assaut() { const deux = SC.courante === 'siege2', st = deux ? SC.s2 : SC.s1; if (st.assaut >= 0) return; if (!deux) voir('siege', false); st.mois = Math.min(7.6, Math.max(6.2, st.mois)); st.assaut = t; }
// ---- l'espion : il se faufile vers la ville rivale (marche, s'accroupit, repart), puis sa mission, puis il rentre
const MISSIONS = ['renseignement', 'vol', 'sabotage', 'demasque'];
function animEspion(dt, tps, u, u0) {
  const Sp = G.espion, S = G.siege, ch = Sp.chemin, L = ch.long, approche = L - ({ renseignement: 0.95, demasque: 0.5 }[SC.mission] ?? 0.3);
  if (u < Sp.dernier) { if (!SC.reprise && !SC.missionChoisie) SC.mission = MISSIONS[(MISSIONS.indexOf(SC.mission) + 1) % 4]; SC.reprise = false; }
  Sp.dernier = u; const mis = SC.mission;
  // avance par bonds : 1,1 s de marche, 0,7 s accroupi à guetter
  const PAS = 0.95, bonds = u => { const n = Math.floor(u / 1.8), w = u % 1.8; return (n + Math.min(1, w / 1.1)) * PAS; };
  let sd, accroupi = false, cache = false, sens = 1, porte = { x: S.porte.x + S.porte.ox * 0.04, z: S.porte.z + S.porte.oz * 0.04 };
  const finApproche = Math.floor(approche / PAS) * 1.8 + (approche % PAS) / PAS * 1.1;
  const entre = mis === 'vol' || mis === 'sabotage';
  if (u < finApproche) { sd = bonds(u); accroupi = u % 1.8 > 1.1; }
  else if (u < 18) { sd = approche; if (entre) { const f = lisse(finApproche, finApproche + 1.2, u) - lisse(15.2, 16.4, u); sd = approche + f * (L - approche); cache = u > finApproche + 1.3 && u < 15.1; } }
  else { sd = mis === 'demasque' ? approche : Math.max(0, approche - (u - 18) * 0.6); sens = sd > 0 ? -1 : 1; }
  if (mis === 'demasque' && u >= finApproche) sd = approche;
  sd = Math.min(sd, L);
  const p = ch.en(sd), y = solEn(p.x, p.z);
  Sp.g.position.set(p.x, y + (!accroupi && u < finApproche ? Math.abs(Math.sin(tps * 8)) * 0.005 : 0), p.z);
  let cap = p.cap + (sens < 0 ? Math.PI : 0);
  // la longue-vue vise l'armée cachée dans l'inconnu
  const cv = LIEU.armeeCachee, vise = mis === 'renseignement' && u > finApproche + 0.3 && u < 18;
  if (vise) cap = -Math.atan2(cv.z - p.z, cv.x - p.x);
  Sp.g.rotation.set(0, cap, accroupi ? -0.25 : 0);
  const zoom = Math.min(2, Math.max(1, vue.d / 5)); // reste lisible de loin
  Sp.corps.scale.set(ECH_ESPION * zoom, ECH_ESPION * zoom * (accroupi ? 0.8 : 1), ECH_ESPION * zoom);
  Sp.g.visible = !cache;
  Sp.anneau.visible = !cache; Sp.anneau.position.set(p.x, y + 0.036, p.z); Sp.anneau.scale.setScalar(zoom);
  Sp.longueVue.visible = vise;
  Sp.plans.visible = mis === 'vol' && u > 15.1 && u < 26;
  Sp.etoile.visible = Sp.plans.visible && u < 20; if (Sp.etoile.visible) Sp.etoile.position.set(p.x, y + 0.27 * zoom, p.z);
  const lant = (EPOQUE === 'ancien' || EPOQUE === 'lumieres') && HEURE !== 'jour' && !cache; Sp.lueur.visible = lant;
  if (lant) { const q = versMonde(Sp.corps, 0.38, 1.18, 0.34); Sp.lueur.geometry.attributes.position.setXYZ(0, q.x, q.y, q.z); Sp.lueur.geometry.attributes.position.needsUpdate = true; }
  // renseignement : l'onde dorée et la zone révélée autour de l'armée cachée
  G.revele = vise && u > finApproche + 1.2 && u < 17;
  Sp.onde.visible = vise && u > finApproche + 1.2; if (Sp.onde.visible) { const w = (u - finApproche - 1.2) % 3 / 3; Sp.onde.position.set(cv.x, topDe(cv) + 0.03, cv.z); Sp.onde.scale.setScalar(0.3 + w * 2.6); Sp.onde.material.opacity = (1 - w) * 0.85; }
  // sabotage : l'arsenal brûle
  S.feuArsenal.visible = mis === 'sabotage' && u > finApproche + 2.4 && u < 25; if (S.feuArsenal.visible) { animFeu(S.feuArsenal, tps); if (Math.random() < dt * 6) fumer(S.arsenal, { noire: true, k: 1.2, vy: 0.14 }); }
  // démasqué : « ! », trois gardes sortent de la porte, l'entourent, la cage tombe
  const dem = mis === 'demasque', ud = u - finApproche;
  Sp.alerte.visible = dem && ud > 0.3 && ud < 6; if (Sp.alerte.visible) Sp.alerte.position.set(p.x, y + 0.3 * zoom + Math.abs(Math.sin(tps * 6)) * 0.02, p.z);
  Sp.gardes.forEach((g, i) => {
    g.visible = dem && ud > 0.6; if (!g.visible) return;
    const a = cap + Math.PI / 2 + (i - 1) * 1.6, cible = { x: p.x + Math.cos(a) * 0.13, z: p.z - Math.sin(a) * 0.13 }, f = lisse(0.6, 3 + i * 0.3, ud);
    const x = porte.x + (cible.x - porte.x) * f, z = porte.z + (cible.z - porte.z) * f;
    g.position.set(x, solEn(x, z) + (f < 1 ? Math.abs(Math.sin(tps * 10 + i)) * 0.006 : 0), z); g.rotation.y = f < 1 ? capVers(cible.x - porte.x, cible.z - porte.z) : capVers(p.x - x, p.z - z);
  });
  Sp.cage.visible = dem && ud > 3.6; if (Sp.cage.visible) { const f = lisse(3.6, 4.2, ud); Sp.cage.position.set(p.x, y + (1 - f) * 0.5, p.z); Sp.cage.scale.setScalar(ECH_ESPION * zoom); }
}

// ---------------------------------------------------------------- d'où l'on voit
function sourcesVision() {
  const s = [[centre.x, centre.z, 2], [LIEU.portNous.x, LIEU.portNous.z, 1], [LIEU.batterie.x, LIEU.batterie.z, 1], [LIEU.camp.x, LIEU.camp.z, 1]];
  if (ARMEE) s.push([ARMEE.x, ARMEE.z, 1]);
  for (const n of G.nos) if (n.g.visible) s.push([n.g.position.x, n.g.position.z, 2]);
  if (G.espion.g.visible || G.espion.cage.visible) s.push([G.espion.g.position.x, G.espion.g.position.z, 1]);
  if (G.deb.debarques > 0) s.push([LIEU.plage.x, LIEU.plage.z, 1]);
  if (G.revele) s.push([LIEU.armeeCachee.x, LIEU.armeeCachee.z, 2]);
  if (SC.courante === 'siege2') s.push([VILLE2.mairie.x, VILLE2.mairie.z, 2], [VILLE2.camp.x, VILLE2.camp.z, 1]); // l'armée qui investit la ville la voit
  if (SC.courante === 'forts') s.push(...visionForts()); // nos armées et la vision étendue du fort
  return s;
}

// ---------------------------------------------------------------- légende de la scène en cours
const legende = document.getElementById('legende');
let legendePrec = '';
function majLegende() {
  if (!legende) return;
  const u = n => tau(n, t), noms = FLOTTE[EPOQUE].map(x => NOM_NAVIRE[x]);
  const s1 = SC.s1, m = Math.floor(s1.mois), br = Math.round(lisse(3.5, 7, s1.mois) * 100), S = G.siege, act = Math.round(S.fum.length * Math.max(0, 1 - (s1.mois - 1) / 6));
  const mis = { renseignement: 'renseignement : la longue-vue révèle une armée cachée', vol: 'vol de technologie : il ressort avec les plans', sabotage: 'sabotage : l\'arsenal brûle', demasque: 'démasqué : les gardes l\'encagent' }[SC.mission];
  const txt = {
    ensemble: 'Vue d\'ensemble · notre royaume à l\'ouest, la baie, le royaume rival à l\'est (brume sur l\'inconnu).',
    brouillard: BROUILLARD ? 'Brouillard de guerre · en vue / exploré mais hors de vue (terne, sans armées) / jamais exploré (brume).' : 'Brouillard de guerre désactivé : tout est visible, même les armées rivales.',
    revue: `Flotte de l'époque · ${noms.join(', ')}.`,
    commerce: `Commerce · la ${NOM_NAVIRE[transport()]} fait la navette entre notre port et le port allié.`,
    bataille: u('bataille') < 15 ? 'Bataille navale · bordées, fumée de poudre, boulets qui éclaboussent.' : 'Bataille navale · touché, le navire rival brûle et coule.',
    debarquement: `Débarquement · ${Math.min(16, G.deb.debarques)} / 16 soldats à terre.`,
    blocus: 'Blocus · nos navires mouillés devant le port rival, à l\'arrêt.',
    espion: `Espion · ${u('espion') < 9 ? 'il se faufile vers la ville rivale' : mis}.`,
    remparts: (() => { const n = REMP.niveau, u = t - REMP.debut, tr = u >= 0 && u < REMP.duree; return `Remparts · niveau ${n}, ${NOM_REMP[n]} · ${STYLE_REMP[EPOQUE].nom[n - 1]}${n >= 3 ? ' · l\'enceinte englobe les six quartiers voisins, faubourgs hors les murs' : ' · autour de la mairie seule'}${tr ? ` · travaux ${Math.min(99, Math.round(u / REMP.duree * 100))} %` : ''}.`; })(),
    siege2: (() => { const S2 = G.siege2, st = SC.s2, m = Math.floor(st.mois), w = (st.mois - m) * 6, F = st.assaut < 0 ? S2.faub[m - 1] : null, np = Math.min(4, m - 1 + (F && w > 3.4 ? 1 : 0)), b2 = Math.round(lisse(3.5, 7, st.mois) * 100), a2 = Math.round(S2.fum.length * Math.max(0, 1 - (st.mois - 1) / 6)), N = 'Siège d\'une grande ville';
      if (st.prise) return `${N} · la brèche est prise, notre drapeau flotte sur la mairie.`;
      if (st.assaut >= 0) return `${N} · à l'assaut de la brèche !`;
      if (st.mois >= 8) return `${N} · affamée, la ville hisse le drapeau blanc · 4 / 4 faubourgs pillés.`;
      return `${N} · mois ${m} · brèche ${b2} % · ${a2} / ${S2.fum.length} cheminées fument · ${F ? (w < 2 ? `on sort piller le faubourg ${F.nom}` : w < 3.9 ? `le faubourg ${F.nom} brûle` : 'retour au camp chargé de butin') + ` (${np} / 4 pillés)` : `${np} / 4 faubourgs pillés`}.`; })(),
    forts: texteForts(),
    siege: s1.prise ? 'Siège d\'une petite ville · la brèche est prise, la ville tombe.' : s1.assaut >= 0 ? 'Siège d\'une petite ville · à l\'assaut de la brèche !' : s1.mois >= 8 ? 'Siège d\'une petite ville · affamée, elle hisse le drapeau blanc.' : `Siège d'une petite ville · mois ${m} · brèche ${br} % · ${act} / ${S.fum.length} cheminées fument.`,
  }[SC.courante] || '';
  if (txt !== legendePrec) { legende.textContent = txt; legendePrec = txt; }
}

// ---------------------------------------------------------------- boutons de la maquette
document.querySelectorAll('[data-voir]').forEach(b => b.addEventListener('click', () => { voir(b.dataset.voir); document.querySelectorAll('[data-voir]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
document.querySelectorAll('[data-mission]').forEach(b => b.addEventListener('click', () => { SC.mission = b.dataset.mission; SC.missionChoisie = true; voir('espion'); document.querySelectorAll('[data-mission]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); document.querySelectorAll('[data-voir]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.voir === 'espion'))); }));
document.querySelectorAll('[data-brouillard]').forEach(b => b.addEventListener('click', () => { BROUILLARD = b.dataset.brouillard === 'oui'; BRUME.on.value = BROUILLARD ? 1 : 0; tVision = 0; document.querySelectorAll('[data-brouillard]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (SC.courante === 'ensemble' || SC.courante === 'brouillard') legendePrec = ''; }));
document.querySelector('[data-mois]')?.addEventListener('click', () => { // fait avancer le siège qu'on regarde (la petite ville sinon) ; après la reddition, on recommence
  const deux = SC.courante === 'siege2', st = deux ? SC.s2 : SC.s1; if (!deux) voir('siege', false);
  if (st.assaut < 0) { const m = Math.floor(st.mois); Object.assign(st, m >= 8 ? { mois: 1, prise: false } : { mois: m + 1 }); }
});
document.querySelectorAll('[data-rempart]').forEach(b => b.addEventListener('click', () => { if (SC.courante !== 'remparts') { voir('remparts', false); document.querySelectorAll('[data-voir]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.voir === 'remparts'))); } niveauRemparts(+b.dataset.rempart); document.querySelectorAll('[data-rempart]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
document.querySelector('[data-assaut]')?.addEventListener('click', assaut);

// ---------------------------------------------------------------- événements à choix (fenêtre du jeu)
const EVENEMENTS = {
  inventeur: {
    titre: '⚙️ Un inventeur à votre porte', date: 'Mai 1824 · Révolution industrielle', svg: 'svg-inventeur',
    texte: 'Maître Anselme Vautrin, mécanicien de Lyon, présente une <b>machine à vapeur</b> qui pompe l\'eau des mines et, dit-il, pourra tirer des wagons sur des rails de fer. Il lui faut de quoi bâtir son atelier.',
    choix: [{ l: 'Financer l\'atelier · −400 🪙', c: 'vert', r: ['La machine de Vautrin tourne : le chemin de fer avance plus vite.', 'bon'] }, { l: 'Le prendre à l\'arsenal · −150 🪙', c: 'b2', r: ['Vautrin travaillera pour l\'armée : canons rayés plus tôt.', 'or'] }, { l: 'Le renvoyer', c: 'rouge', r: ['Vautrin part vendre sa machine à Castelrouge…', 'guerre'] }],
  },
  philosophe: {
    titre: '📜 Un philosophe demande asile', date: 'Octobre 1762 · Siècle des Lumières', svg: 'svg-philosophe',
    texte: 'Chassé de Castelrouge pour un pamphlet contre son roi, le philosophe <b>Évariste Delorme</b> se présente à la frontière avec ses livres. L\'accueillir ravira vos savants, mais fâchera votre voisin.',
    choix: [{ l: 'L\'accueillir · +savoir, +😊', c: 'vert', r: ['Delorme ouvre un salon dans la capitale : les Lumières rayonnent. Castelrouge proteste.', 'bon'] }, { l: 'Le cacher en secret · −60 🪙', c: 'b2', r: ['Delorme écrit dans l\'ombre, Castelrouge n\'en saura rien… pour l\'instant.', 'or'] }, { l: 'Le livrer à Castelrouge', c: 'rouge', r: ['Castelrouge vous remercie. Vos savants, beaucoup moins.', 'guerre'] }],
  },
  disette: {
    titre: '🌾 Disette', date: 'Mars 1709 · Ancien Régime', svg: 'svg-disette',
    texte: 'Le grand hiver a gelé les semences. Les greniers se vident et le prix du <b>pain</b> double sur les marchés. Les paysans grondent.',
    choix: [{ l: 'Ouvrir les greniers royaux · −40 🌾', c: 'vert', r: ['Le pain revient sur les tables : le peuple vous bénit.', 'bon'] }, { l: 'Acheter du blé à l\'étranger · −300 🪙', c: 'b2', r: ['Les flûtes chargées de blé arrivent au port allié.', 'or'] }, { l: 'Fixer le prix du pain', c: 'rouge', r: ['Les boulangers ferment boutique : le bonheur baisse.', 'guerre'] }],
  },
};
const fenetre = document.getElementById('evt'), boiteEvt = document.getElementById('evt-boite'), annonces = document.getElementById('annonces');
function annonce(txt, cls) { const d = document.createElement('div'); d.className = 'annonce ' + (cls || ''); d.textContent = txt; annonces.append(d); setTimeout(() => d.remove(), 4500); }
function ouvrirEvenement(cle) {
  const e = EVENEMENTS[cle];
  boiteEvt.innerHTML = `<div class="illus">${document.getElementById(e.svg).innerHTML}</div><h3 id="evt-titre">${e.titre}</h3><p class="mini">${e.date}</p><p>${e.texte}</p><div class="btns" style="justify-content:flex-end;margin-top:12px">${e.choix.map((c, i) => `<button class="btn ${c.c}" data-i="${i}">${c.l}</button>`).join('')}</div>`;
  fenetre.classList.add('ouverte');
  boiteEvt.querySelectorAll('button[data-i]').forEach(b => (b.onclick = () => { fenetre.classList.remove('ouverte'); const [txt, cls] = e.choix[+b.dataset.i].r; annonce(txt, cls); }));
  boiteEvt.querySelector('button')?.focus();
}
document.querySelectorAll('[data-evt]').forEach(b => b.addEventListener('click', () => ouvrirEvenement(b.dataset.evt)));
fenetre?.addEventListener('click', e => { if (e.target === fenetre) fenetre.classList.remove('ouverte'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fenetre?.classList.remove('ouverte'); });
