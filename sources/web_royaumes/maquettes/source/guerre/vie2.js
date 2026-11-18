// ---------------------------------------------------------------- encore plus de vie : la ville, les métiers, l'armée, la nature, la météo
// Même façon de faire que l'ambiance : petits modèles en boîtes (unités de web_power), contours, va-et-vient simples.
let METEO = 'beau', VENT = 0.25, FETE = false, MODE_ARMEE = 'position', ARMEE_GRP = null, ARMEE_BASE = null;
const PLUIE = () => ['pluie', 'orage', 'tempete', 'neige'].includes(METEO);
const NEIGE_TOMBE = () => METEO === 'neige' || (SAISON === 0 && PLUIE());
const JOUR = () => HEURE !== 'nuit';
const angBat = k => (hache(k.c, k.r, 2) * 6 | 0) * Math.PI / 3; // orientation d'un bâtiment, comme dans construireBatiments
function posB(k, lx, lz) { const g = angBat(k), c = Math.cos(g), s = Math.sin(g); return { x: k.x + (lx * c + lz * s) * ECH_BAT, z: k.z + (-lx * s + lz * c) * ECH_BAT }; }
const capB = (k, dx, dz) => angBat(k) - Math.atan2(dz, dx); // cap d'un modèle (face à +x) qui regarde la direction locale (dx, dz)
const DALLE = 0.025;
const roy = () => new THREE.Color(ROYAUME).getHex();

// ---- modèles
const FEMME = (jupe, haut = 0xe9e2d0) => [[boite(0.7, 0.9, 0.7), 0, 0.45, 0, jupe], [boite(0.5, 0.6, 0.6), 0, 1.2, 0, haut], [sphere(0.28, 1), 0.02, 1.75, 0, 0xf0c9a0], [boite(0.4, 0.16, 0.45), 0, 2.02, 0, 0xf6f2ea]];
const ENFANT = c => PAYSAN(c).slice(0, 4);
Object.assign(MODELES, {
  lavandiere: FEMME(0x4a6a9a), cliente: FEMME(0x8a4a7a, 0xf2e6c8), cliente2: FEMME(0x5a7a4a), danseuse: FEMME(0xd9322a, 0xf6f2ea), danseuse2: FEMME(0xe0a020, 0xf6f2ea),
  marchand: [...PAYSAN(0xc0504a), [boite(0.12, 0.9, 0.6), 0.27, 1.1, 0, 0xf6f2ea]], client: PAYSAN(0x6a8aa4), danseur: PAYSAN(0x3a6aa8),
  musicien: [...PAYSAN(0x7a3a6a), [boite(0.5, 0.15, 0.2), 0.3, 1.8, 0.25, 0x8b5a2b], [boite(0.04, 0.04, 0.7), 0.35, 1.9, -0.1, 0xe9e2d0]],
  enfant0: ENFANT(0xd9533a), enfant1: ENFANT(0x3a8ad9), enfant2: ENFANT(0xe0c040),
  forgeron: [...PAYSAN(0x4a3a30).slice(0, 4), [boite(0.12, 0.85, 0.62), 0.27, 1.1, 0, 0x3a2a20], [boite(0.08, 0.7, 0.08), 0.45, 2, 0.25, 0x5b3a1e], [boite(0.3, 0.2, 0.2), 0.45, 2.4, 0.25, 0x3a3a3a]],
  bucheron: [...PAYSAN(0x8a3a2a), [boite(0.08, 1.3, 0.08).rotateZ(-0.5), 0.6, 1.6, 0.28, 0x5b3a1e], [boite(0.08, 0.3, 0.32), 0.95, 2.1, 0.28, 0xb8b8b8]],
  sapin: [[cyl(0.3, 0.4, 1.4, 5), 0, 0.7, 0, 0x7a5233], [cone(1.9, 3, 6), 0, 2.6, 0, 0x3e7f34], [cone(1.4, 2.4, 6), 0, 4, 0, 0x4c9440]],
  barque: [[boite(3, 0.5, 1.1), 0, 0.25, 0, 0x8a5a34], [boite(3.1, 0.12, 1.2), 0, 0.55, 0, 0x6b4426], ...PAYSAN(0x4a6a8a).map(([g, x, y, z, c]) => [g.clone(), x - 0.6, y + 0.3, z, c]), [boite(0.05, 0.05, 1.8).rotateX(0.3), 0.6, 1.4, 0, 0x5b3a1e], [boite(1, 0.02, 1), 1.5, 0.15, 0.4, 0xd9d2bc]],
  meunier: [...PAYSAN(0xf0ebe0), [boite(0.6, 0.5, 0.55), 0, 2.75, 0, 0xe9e2d0]],
  wagonnet: [[boite(1.2, 0.6, 0.8), 0, 0.55, 0, 0x5a4632], [boite(1.1, 0.25, 0.7), 0, 0.95, 0, 0x6a5a4a], roue(-0.4, 0.35, 0.22), roue(-0.4, -0.35, 0.22), roue(0.4, 0.35, 0.22), roue(0.4, -0.35, 0.22), ...PAYSAN(0x5a5a6a).map(([g, x, y, z, c]) => [g.clone(), x - 1.3, y, z, c])],
  allumeur: [...PAYSAN(0x3a3a4a), [boite(0.06, 2.2, 0.06), 0.35, 2, 0.2, 0x5b3a1e], [boite(0.14, 0.14, 0.14), 0.35, 3.1, 0.2, 0xffd36a]],
  tambour: [[boite(0.24, 0.9, 0.3), 0, 0.45, 0.16, 0xf2efe6], [boite(0.24, 0.9, 0.3), 0, 0.45, -0.16, 0xf2efe6], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, new THREE.Color(ROYAUME).getHex()], [sphere(0.28, 1), 0.02, 2.1, 0, 0xf0c9a0], [cone(0.55, 0.3, 3), 0, 2.4, 0, 0x1f1f1f], [cyl(0.36, 0.36, 0.45, 10).rotateX(Math.PI / 2), 0.45, 1.1, 0, 0xf2efe6], [cyl(0.38, 0.38, 0.08, 10).rotateX(Math.PI / 2), 0.45, 1.1, 0.24, 0xb8322a]],
  pigeon: [[boite(0.6, 0.25, 0.25), 0, 0, 0, 0x9aa0a8], [boite(0.2, 0.2, 0.2), 0.35, 0.1, 0, 0x7a8088], [boite(0.3, 0.05, 1.2), 0, 0.05, 0, 0x8a9098]],
  patineur: [...PAYSAN(0x7a3a3a), [boite(0.55, 0.12, 0.8), 0, 1.75, 0, 0xd9533a]],
  ...Object.fromEntries([0xffd34d, 0xff8ad8, 0x9fd0ff, 0xffffff].map((c, i) => [`papillon${i}`, [[boite(0.12, 0.08, 0.12), 0, 0, 0, 0x3a2a20], [boite(0.5, 0.04, 0.45), 0, 0, 0.27, c], [boite(0.5, 0.04, 0.45), 0, 0, -0.27, c]]])),
});
const V2 = [];
let VIE = null;

// ---- petits chemins lissés (patineurs) : position et cap à une distance donnée
function cheminLisse(pts) {
  for (let it = 0; it < 2; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const en = sd => { sd = Math.max(0, Math.min(cum[cum.length - 1] - 1e-4, sd)); let i = 0; while (cum[i + 1] < sd) i++; const f = (sd - cum[i]) / (cum[i + 1] - cum[i]); return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, cap: -Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) }; };
  return { en, long: cum[cum.length - 1] };
}
// un groupe fixe posé comme un bâtiment (unités de web_power, mêmes orientation et échelle)
function groupeBat(L, k, parent) { const g = fige(L, parent); g.scale.setScalar(ECH_BAT); g.position.set(k.x, k.top, k.z); g.rotation.y = angBat(k); return g; }
const plan = cle => PLAN.find(p => p.cle === cle)?.k;
const ajoute = (o, extra) => { V2.push({ o, ...extra }); return o; };

// ---- particules : étincelles, pluie, neige, feuilles mortes, lucioles, blés
const ETINC = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0xffb43a }), 120);
ETINC.count = 0; ETINC.frustumCulled = false; scene.add(ETINC);
const etincelles = [];
const N_GOUTTES = 1400;
const PLUIE_L = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_GOUTTES * 6), 3)), new THREE.LineBasicMaterial({ color: 0xd8e6f2, transparent: true, opacity: 0.55, depthWrite: false }));
const NEIGE_P = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_GOUTTES * 3), 3)), new THREE.PointsMaterial({ map: tache, size: 0.06, transparent: true, depthWrite: false }));
const GOUT = Float32Array.from({ length: N_GOUTTES * 3 }, Math.random);
for (const o of [PLUIE_L, NEIGE_P]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
const FEUILLES = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.004, 0.016), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade }), 160);
FEUILLES.frustumCulled = false; scene.add(FEUILLES);
const feuilles = [];
const LUCIOLES = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: tache, size: 0.07, color: 0xdfff7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
LUCIOLES.frustumCulled = false; scene.add(LUCIOLES);
const lucioles = [];
const LUEURS = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: tache, size: 0.3, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
LUEURS.frustumCulled = false; scene.add(LUEURS);
let BLE = null, bles = [];

// ---- nuages et leur ombre, arc-en-ciel, brouillard
const M_NUAGE = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade, transparent: true, opacity: 0.85, depthWrite: false });
const NUAGES = Array.from({ length: 10 }, (_, i) => {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + hache(i, k, 71) * 0.45, 1).scale(1, 0.55, 1), M_NUAGE); m.position.set((k - 1.5) * 0.6, hache(i, k, 73) * 0.2, (hache(i, k, 74) - 0.5) * 0.7); m.castShadow = true; g.add(m); }
  g.userData = { x: (hache(i, 0, 75) - 0.5) * 16, z: (hache(i, 0, 77) - 0.5) * 14, y: 3.4 + hache(i, 0, 76) * 0.8 };
  scene.add(g); return g;
});
const ARC = new THREE.Group();
[0xe04040, 0xf08a30, 0xf2d040, 0x60c050, 0x40a0e0, 0x5060d0, 0x9050c0].forEach((c, i) => ARC.add(new THREE.Mesh(new THREE.TorusGeometry(4.6 - i * 0.11, 0.06, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.38, depthWrite: false }))));
ARC.visible = false; scene.add(ARC);
scene.fog = new THREE.Fog(0xb8c0c4, 1000, 2000); // toujours présent : l'ajouter plus tard recompilerait tous les matériaux
const CIEL = { hI: 1.5, fond: new THREE.Color(0x1b211a), eclair: 0, tEclair: 3 };
function appliquerCiel() {
  appliquerHeure();
  const sombre = { beau: 1, nuageux: 0.8, pluie: 0.55, orage: 0.42, brouillard: 0.6, tempete: 0.45, neige: 0.7, arc: 0.95 }[METEO];
  VENT = { beau: 0.25, nuageux: 0.4, pluie: 0.5, orage: 0.8, brouillard: 0.05, tempete: 1.4, neige: 0.4, arc: 0.3 }[METEO];
  soleil.intensity *= sombre; hemi.intensity *= 0.85 + 0.15 * sombre;
  if (sombre < 0.9) scene.background.lerp(new THREE.Color(0x3a4248), (1 - sombre) * 0.6);
  CIEL.hI = hemi.intensity; CIEL.fond.copy(scene.background);
  M_NUAGE.color.setHex(PLUIE() && METEO !== 'neige' ? 0x8d939c : 0xffffff);
}

// ---- tout ce qui vit en plus
function construireVie2() {
  if (VIE) scene.remove(VIE);
  VIE = new THREE.Group(); scene.add(VIE); V2.length = 0;
  const A = (nom, s = ECH) => acteur(nom, s, VIE);
  // marché animé : un marchand derrière chaque étal, des clients qui vont de l'un à l'autre
  const km = plan('marche');
  if (km) {
    for (const [sx, sz] of [[-3.2, -2.6], [3, -2.8], [-3, 3], [3.2, 2.8]]) { const p = posB(km, sx * 1.28, sz * 1.28); ajoute(A('marchand'), { type: 'fixe', k: km, x: p.x, z: p.z, y: DALLE, cap: capB(km, -sx, -sz), balance: 1.5, quand: () => JOUR() }); }
    ['cliente', 'client', 'cliente2', 'client'].forEach((nom, i) => ajoute(A(nom), { type: 'ronde', k: km, cx: 0, cz: 0, r: 2.1, v: 0.12, ph: i * 1.6, arret: true, quand: () => JOUR() && !PLUIE() }));
  }
  // enfants qui jouent autour de la fontaine de la place, bal et guirlandes les jours de fête
  const kh = centre;
  ['enfant0', 'enfant1', 'enfant2'].forEach((nom, i) => ajoute(A(nom, ECH * 0.75), { type: 'ronde', k: kh, cx: 1.8, cz: 2.6, r: 1.1, v: 1.1, ph: i * 2.1, saute: true, quand: () => JOUR() && !PLUIE() }));
  {
    const L = lot(), cs = [0xd9322a, 0xf2d040, 0x3a6ad9, 0xf6f2ea, 0x3fa04a];
    for (const [ax, az, bx, bz] of [[-5, -3, 4, 4], [-6, 0.5, 5.5, -0.5], [-1.5, -5.6, -0.5, 5.5]]) {
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.6);
      for (let i = 0; i <= n; i++) { const f = i / n, y = 5.6 - Math.sin(f * Math.PI) * 1.1; put(L, cone(0.22, 0.4, 3), cs[i % cs.length], ax + (bx - ax) * f, y - 0.2, az + (bz - az) * f, 0, 0); }
    }
    const guir = groupeBat(L, kh, VIE); ajoute(guir, { type: 'decor', quand: () => FETE });
    ['danseuse', 'danseur', 'danseuse2', 'danseur', 'danseuse', 'danseur'].forEach((nom, i) => ajoute(A(nom), { type: 'ronde', k: kh, cx: -2.3, cz: 2.9, r: 1, v: 0.7, ph: i * Math.PI / 3, tourne: true, quand: () => FETE && !PLUIE() }));
    const p = posB(kh, -2.3, 2.9); ajoute(A('musicien'), { type: 'fixe', k: kh, x: p.x, z: p.z, y: DALLE, cap: 0, balance: 4, quand: () => FETE && !PLUIE() });
  }
  // église : la cloche sonne dans son clocheton, les pigeons s'envolent du clocher
  const ke = plan('eglise');
  if (ke) {
    const L = lot(); for (const x of [-0.5, 0.5]) put(L, boite(0.15, 1.2, 0.15), 0xefe3c6, x, 6.4, 3.5, 0, 0.1); put(L, cone(0.8, 0.6, 4), ARDOISE, 0, 7.3, 3.5, Math.PI / 4, 0.1);
    groupeBat(L, ke, VIE);
    const Lc = lot(); put(Lc, new THREE.ConeGeometry(0.32, 0.5, 10).translate(0, -0.45, 0), 0xb08d57, 0, 0, 0, 0, 0.06); put(Lc, sphere(0.12, 0), 0x6a5030, 0, -0.75, 0, 0, 0);
    const cloche = fige(Lc, VIE); cloche.scale.setScalar(ECH_BAT); const p = posB(ke, 0, 3.5); cloche.position.set(p.x, ke.top + 7 * ECH_BAT, p.z); cloche.rotation.y = angBat(ke);
    ajoute(cloche, { type: 'cloche' });
    const cl = posB(ke, 0, -2.4);
    for (let i = 0; i < 6; i++) ajoute(A('pigeon', 0.022), { type: 'pigeon', x: cl.x, z: cl.z, y: ke.top + 1.0, i });
  }
  // lavandières au bord de la rivière la plus proche de la ville, linge qui sèche à côté
  const kr = RIV.filter(k => !k.bati && !TERR[k.t].eau).sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z))[0];
  if (kr) {
    const i = RIV.indexOf(kr), av = RIV[i - 1] || kr, ap = RIV[i + 1] || kr.versMer || kr;
    let dx = ap.x - av.x, dz = ap.z - av.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const px = -dz, pz = dx, rive = { x: kr.x + px * 0.24, z: kr.z + pz * 0.24 };
    for (const o of [-0.07, 0.07]) ajoute(A('lavandiere'), { type: 'penche', x: rive.x + dx * o, z: rive.z + dz * o, y: kr.top + 0.005, cap: -Math.atan2(-pz, -px), ph: o * 30, quand: () => JOUR() && !PLUIE() && SAISON !== 0 });
    const L = lot(); for (const o of [-0.13, 0.13]) put(L, new THREE.BoxGeometry(0.008, 0.12, 0.008), 0x8b5a2b, o, 0.06, 0, 0, 0.003); put(L, new THREE.BoxGeometry(0.26, 0.003, 0.003), 0xe9e2d0, 0, 0.115, 0, 0, 0);
    const linge = fige(L, VIE); linge.position.set(kr.x + px * 0.4, kr.top, kr.z + pz * 0.4); linge.rotation.y = -Math.atan2(dz, dx);
    const draps = [0xf6f2ea, 0x9fc4e8, 0xf2d6d6, 0xf6f2ea].map((c, j) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.05).translate(0, -0.025, 0), new THREE.MeshToonMaterial({ color: c, gradientMap: degrade, side: THREE.DoubleSide })); m.position.set(-0.09 + j * 0.06, 0.113, 0); linge.add(m); return m; });
    ajoute(linge, { type: 'linge', draps, quand: () => SAISON !== 0 && !PLUIE() });
  }
  // allumeur de réverbères (ère industrielle) : il passe à l'aube et au crépuscule, les lanternes brillent la nuit
  const lampes = [[-3.2, 2.4], [3.2, 2.2], [-3.4, -2.2], [3.4, -2.4]].map(([lx, lz]) => posB(kh, lx, lz));
  ajoute(A('allumeur'), { type: 'tournee', pts: lampes, y: kh.top + DALLE, v: 0.12, quand: () => EPOQUE === 'industrie' && HEURE === 'aube' });
  LUEURS.userData.lampes = lampes.map(p => [p.x, kh.top + DALLE + 0.28, p.z]);
  // forgeron et étincelles
  const kf = plan('forge');
  if (kf) { const p = posB(kf, 1.5, 2.2), q = posB(kf, 2.4, 2.2); ajoute(A('forgeron'), { type: 'forgeron', x: p.x, z: p.z, y: kf.top + DALLE, cap: capB(kf, 1, 0), enclume: { x: q.x, y: kf.top + DALLE + 0.1, z: q.z }, avant: 0 }); }
  // bûcheron qui abat un sapin (le sapin repousse)
  const kb = plan('bucheron');
  if (kb) { const p = posB(kb, -0.7, -4.8), q = posB(kb, 0.6, -4.8); const arbre = A('sapin', 0.11); ajoute(A('bucheron'), { type: 'bucheron', x: p.x, z: p.z, y: kb.top + DALLE, cap: capB(kb, 1, 0), arbre, ax: q.x, az: q.z }); }
  // pêcheur dans sa barque, sur l'eau voisine
  const kp = plan('pecheur');
  const eauV = kp && voisins(kp).find(n => TERR[n.t].eau);
  if (eauV) ajoute(A('barque', 0.035), { type: 'barque', x: kp.x + (eauV.x - kp.x) * 0.62, z: kp.z + (eauV.z - kp.z) * 0.62, cap: -Math.atan2(eauV.z - kp.z, eauV.x - kp.x) + Math.PI / 2 });
  // meunier qui porte ses sacs du moulin à la charrette
  const kmo = plan('moulin');
  if (kmo) { const a = posB(kmo, 0, 2.6), b = posB(kmo, -3, 3.8), c = posB(kmo, -3.9, 4.1); const ch = A('char'); ch.position.set(c.x, kmo.top + DALLE, c.z); ch.rotation.y = capB(kmo, 0, 1); ajoute(A('meunier'), { type: 'navette', a, b, y: kmo.top + DALLE, v: 0.35, quand: () => JOUR() && !PLUIE() }); }
  // mineurs qui poussent leurs wagonnets à la sortie de la mine
  const kmi = plan('mine');
  if (kmi) { const a = posB(kmi, -1.5, 2.6), b = posB(kmi, -1.5, 6.2); ajoute(A('wagonnet'), { type: 'navette', a, b, y: kmi.top + DALLE + 0.02, v: 0.3, quand: () => JOUR() }); }
  // armée : tambour en tête quand elle marche ; bivouac la nuit (tentes, feu de camp, faisceau de fusils, sentinelle)
  ajoute(A('tambour'), { type: 'tambour' }).visible = false;
  if (ARMEE) {
    const L = lot(), r = roy();
    [[-3, -2, r], [0.2, -3.4, 0xe9e2d0], [3.2, -2, r], [-2.6, 2.2, 0xe9e2d0]].forEach(([x, z, c]) => { put(L, cone(1.5, 2, 4), c, x, 1, z, Math.PI / 4, 0.09); put(L, boite(0.5, 0.9, 0.1), 0x2a2420, x, 0.45, z + 1.03, 0, 0); });
    for (const a of [0, 1.2, 2.4]) put(L, boite(1.4, 0.18, 0.18), 0x6b4a2a, 1.6 + Math.cos(a) * 0.1, 0.12, 1.6 + Math.sin(a) * 0.1, a, 0.06);
    for (const a of [0, 2.1, 4.2]) put(L, boite(0.07, 2, 0.07).rotateZ(0.25), 0x5b3a1e, 4.4 + Math.cos(a) * 0.25, 0.95, 1.2 + Math.sin(a) * 0.25, a, 0);
    for (const [x, z] of [[-4.6, 0.4]]) { put(L, boite(0.24, 0.9, 0.3), 0xf2efe6, x, 0.45, z, 0, 0.05); put(L, boite(0.75, 1, 0.5), r, x, 1.4, z, 0, 0.07); put(L, sphere(0.28, 1), 0xf0c9a0, x, 2.1, z, 0, 0.05); put(L, boite(0.09, 2.2, 0.09), 0x5b3a1e, x + 0.42, 1.6, z, 0, 0); }
    const biv = fige(L, VIE); biv.scale.setScalar(ECH_BAT); biv.position.set(ARMEE.x, ARMEE.top, ARMEE.z); biv.rotation.y = 0.5;
    const flamme = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6).translate(0, 0.55, 0), new THREE.MeshBasicMaterial({ color: 0xff9a2a })); flamme.position.set(1.6, 0.15, 1.6); biv.add(flamme);
    biv.updateMatrixWorld(true);
    const feu = new THREE.Vector3(1.6, 1, 1.6).applyMatrix4(biv.matrixWorld);
    ajoute(biv, { type: 'bivouac', flamme, feu, fumee: 0 });
  }
  // patineurs sur la rivière gelée
  const riv = RIV.filter(k => !TERR[k.t].eau);
  if (riv.length > 2) { const ch = cheminLisse(riv.map(k => [k.x, k.z])); for (let i = 0; i < 2; i++) ajoute(A('patineur'), { type: 'patine', ch, ph: i * 2.2, y: Math.max(0, riv[0].top) + 0.012 }); }
  // fleurs au printemps et papillons ; bonshommes de neige l'hiver
  const pres = CASES.filter(k => k.t === 'prairie' && !k.bati && !k.riv && k !== ARMEE);
  {
    const L = lot();
    pres.forEach(k => { for (let i = 0; i < 9; i++) { const a = hache(k.c, i, 61) * 6.28, l = Math.sqrt(hache(k.r, i, 62)) * 0.6; put(L, sphere(0.014, 0), [0xff7ab8, 0xffd34d, 0xffffff, 0xb57bff][i % 4], k.x + Math.cos(a) * l, k.top + 0.012, k.z + Math.sin(a) * l, 0, 0); } });
    if (L.g.length) ajoute(fige(L, VIE), { type: 'decor', quand: () => SAISON === 1 });
    pres.slice(0, 6).forEach((k, i) => [0, 1].forEach(j => ajoute(A(`papillon${(i + j) % 4}`, 0.03), { type: 'papillon', x: k.x, z: k.z, y: k.top, ph: i * 1.3 + j * 2.7 })));
    const Ln = lot();
    pres.slice(0, 3).forEach((k, i) => { const x = k.x + 0.2, z = k.z - 0.15; put(Ln, sphere(0.036, 1), 0xf6f8fb, x, k.top + 0.018, z, 0, 0.003); put(Ln, sphere(0.026, 1), 0xf6f8fb, x, k.top + 0.046, z, 0, 0.003); put(Ln, sphere(0.018, 1), 0xf6f8fb, x, k.top + 0.068, z, 0, 0.003); put(Ln, new THREE.CylinderGeometry(0.012, 0.014, 0.02, 8), 0x1f1f1f, x, k.top + 0.088, z, 0, 0.002); put(Ln, new THREE.ConeGeometry(0.004, 0.016, 5).rotateZ(-Math.PI / 2), 0xf08a30, x + 0.012, k.top + 0.07, z, 0, 0); });
    if (Ln.g.length) ajoute(fige(Ln, VIE), { type: 'decor', quand: () => SAISON === 0 });
  }
  // blés qui ondulent : des épis sur les parcelles des plaines (même tracé que le parcellaire)
  if (BLE) scene.remove(BLE);
  bles = [];
  for (const k of CASES.filter(k => k.t === 'plaine' && !k.riv && !k.bati)) {
    const an = (hache(k.c, k.r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an), W = 0.46, D = 0.24, jeu = 0.04;
    for (let b = -1; b <= 1; b++) for (const cote of [-1, 1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const lx = cote * (W + jeu) / 2 + (i / 3 - 0.5) * W * 0.8, lz = b * (D + jeu) + (j / 2 - 0.5) * D * 0.7;
      bles.push({ k, x: k.x + lx * ca + lz * sa, z: k.z - lx * sa + lz * ca, y: k.top + 0.03, ci: hache(k.c * 7 + b, k.r * 5 + cote, 9) });
    }
  }
  BLE = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 0.06, 4).translate(0, 0.03, 0), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade }), Math.max(1, bles.length));
  BLE.frustumCulled = false; scene.add(BLE);
  // feuilles mortes et lucioles
  const forets = CASES.filter(k => k.t === 'foret' && !(k.rail && EPOQUE === 'industrie'));
  feuilles.length = 0; for (let i = 0; i < 160; i++) feuilles.push({ k: forets[i % Math.max(1, forets.length)], age: Math.random() * 4, ph: Math.random() * 6 });
  lucioles.length = 0; const lieux = [...forets, ...pres]; for (let i = 0; i < 90; i++) { const k = lieux[i % Math.max(1, lieux.length)]; if (k) lucioles.push({ x: k.x + (hache(i, 1, 81) - 0.5) * 1.2, z: k.z + (hache(i, 2, 81) - 0.5) * 1.2, y: k.top + 0.05 + hache(i, 3, 81) * 0.2, ph: i }); }
  LUCIOLES.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lucioles.length * 3), 3));
}
const _ve = new THREE.Vector3(), _ce = new THREE.Color(), _eu = new THREE.Euler(), _qe = new THREE.Quaternion();
const COUL_FEUILLES = [0xd9822b, 0xc9a13a, 0xb5562a, 0xe0b040].map(c => new THREE.Color(c));
function animVie2(dt, t, calme) {
  // météo : pluie, neige, éclairs, brouillard, nuages, arc-en-ciel
  const c = vue.cible, neige = NEIGE_TOMBE(), pluie = PLUIE() && !neige;
  PLUIE_L.visible = pluie && !calme; NEIGE_P.visible = neige && !calme;
  if (PLUIE_L.visible) {
    const p = PLUIE_L.geometry.attributes.position.array, vx = VENT * 0.6;
    for (let i = 0; i < N_GOUTTES; i++) { const o = i * 3; GOUT[o + 1] -= dt * 1.6 * (0.8 + GOUT[o + 2] * 0.4); if (GOUT[o + 1] < 0) GOUT[o + 1] += 1; const x = c.x + (GOUT[o] - 0.5) * 10, y = GOUT[o + 1] * 4, z = c.z + (GOUT[o + 2] - 0.5) * 10; p.set([x, y, z, x - vx * 0.08, y + 0.12, z], i * 6); }
    PLUIE_L.geometry.attributes.position.needsUpdate = true;
  }
  if (NEIGE_P.visible) {
    const p = NEIGE_P.geometry.attributes.position.array;
    for (let i = 0; i < N_GOUTTES; i++) { const o = i * 3; GOUT[o + 1] -= dt * 0.12; if (GOUT[o + 1] < 0) GOUT[o + 1] += 1; p[o] = c.x + (GOUT[o] - 0.5) * 10 + Math.sin(t + i) * 0.05 + VENT * 0.1; p[o + 1] = GOUT[o + 1] * 4; p[o + 2] = c.z + (GOUT[o + 2] - 0.5) * 10; }
    NEIGE_P.geometry.attributes.position.needsUpdate = true;
  }
  if ((METEO === 'orage' || METEO === 'tempete') && !calme && (CIEL.tEclair -= dt) < 0) { CIEL.eclair = 1; CIEL.tEclair = 3 + Math.random() * 6; }
  CIEL.eclair = Math.max(0, CIEL.eclair - dt * 5);
  hemi.intensity = CIEL.hI + CIEL.eclair * 1.6; scene.background.copy(CIEL.fond).lerp(_ce.setHex(0xdfe8ff), CIEL.eclair * 0.35);
  const brume = METEO === 'brouillard' ? 1 : METEO === 'tempete' ? 0.4 : NEIGE_TOMBE() ? 0.3 : 0;
  scene.fog.near = brume ? vue.d * (1.4 - brume * 0.9) : 1000; scene.fog.far = brume ? vue.d * (4 - brume * 2.6) : 2000;
  scene.fog.color.setHex(0xb8c0c4).multiplyScalar(HEURE === 'nuit' ? 0.25 : HEURE === 'aube' ? 0.7 : 1);
  const nVis = { beau: 0, nuageux: 8, pluie: 10, orage: 10, brouillard: 0, tempete: 10, neige: 9, arc: 5 }[METEO];
  M_NUAGE.opacity = Math.min(1, Math.max(0, (vue.d - 9) / 6)) * 0.85; M_NUAGE.colorWrite = M_NUAGE.opacity > 0.02; // de près, il ne reste que leur ombre
  NUAGES.forEach((g, i) => { g.visible = i < nVis; const u = g.userData; u.x += dt * (0.15 + VENT * 0.5); if (u.x - c.x > 8) u.x -= 16; if (u.x - c.x < -8) u.x += 16; if (u.z - c.z > 7) u.z -= 14; if (u.z - c.z < -7) u.z += 14; g.position.set(u.x, u.y, u.z); });
  ARC.visible = METEO === 'arc' && JOUR();
  if (ARC.visible) { _ve.set(c.x - cam.position.x, 0, c.z - cam.position.z).normalize(); ARC.position.set(c.x + _ve.x * 3, -1, c.z + _ve.z * 3); ARC.lookAt(cam.position.x, -1, cam.position.z); }
  // les acteurs
  for (const a of V2) {
    const o = a.o;
    if (a.quand) { o.visible = a.quand(); if (!o.visible) continue; }
    if (calme) continue;
    if (a.type === 'fixe') { o.position.set(a.x, a.k.top + a.y + Math.abs(Math.sin(t * a.balance + a.x * 9)) * 0.004, a.z); o.rotation.set(0, a.cap, Math.sin(t * a.balance) * 0.08); }
    else if (a.type === 'ronde') {
      const ang = a.arret ? a.ph + t * a.v + Math.sin(t * 0.6 + a.ph) * 0.6 : a.ph + t * a.v, p = posB(a.k, a.cx + Math.cos(ang) * a.r, a.cz + Math.sin(ang) * a.r);
      o.position.set(p.x, a.k.top + DALLE + (a.saute ? Math.abs(Math.sin(t * 9 + a.ph)) * 0.01 : 0), p.z);
      o.rotation.set(0, a.tourne ? t * 3 + a.ph : capB(a.k, -Math.sin(ang), Math.cos(ang)), 0);
    } else if (a.type === 'penche') { o.position.set(a.x, a.y, a.z); o.rotation.set(0, a.cap, -Math.max(0, Math.sin(t * 1.8 + a.ph)) * 0.8 - 0.3); }
    else if (a.type === 'linge') a.draps.forEach((m, j) => { m.rotation.x = Math.sin(t * (2 + VENT * 3) + j) * (0.15 + VENT * 0.5); });
    else if (a.type === 'cloche') { const cy = t % 22; o.rotation.x = cy < 6 ? Math.sin(cy * 3) * 0.6 * (1 - cy / 6) : 0; }
    else if (a.type === 'pigeon') {
      const cy = t % 22, vole = cy < 9 && JOUR() && !PLUIE(); o.visible = vole; if (!vole) continue;
      const ang = t * 1.4 + a.i * 1.05, r = 0.14 + (a.i % 3) * 0.04;
      o.position.set(a.x + Math.cos(ang) * r, a.y + Math.sin(cy / 9 * Math.PI) * 0.15 + (a.i % 2) * 0.03, a.z + Math.sin(ang) * r);
      o.rotation.set(Math.sin(t * 12 + a.i) * 0.5, -ang - Math.PI / 2, 0);
    } else if (a.type === 'tournee') {
      const n = a.pts.length, u = (t * a.v) % n, i = Math.floor(u), f = Math.min(1, (u - i) * 1.4), A = a.pts[i], B = a.pts[(i + 1) % n];
      o.position.set(A.x + (B.x - A.x) * f, a.y, A.z + (B.z - A.z) * f); o.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
    } else if (a.type === 'forgeron') {
      o.visible = JOUR(); if (!o.visible) continue;
      const s = Math.sin(t * 6); o.position.set(a.x, a.y, a.z); o.rotation.set(0, a.cap, -Math.max(0, s) * 0.45);
      if (a.avant > 0 && s <= 0) for (let n = 0; n < 8; n++) etincelles.push({ x: a.enclume.x, y: a.enclume.y, z: a.enclume.z, vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.5, vie: 0.5 + Math.random() * 0.3 });
      a.avant = s;
    } else if (a.type === 'bucheron') {
      o.visible = a.arbre.visible = JOUR(); if (!o.visible) continue;
      const cy = t % 14; o.position.set(a.x, a.y, a.z);
      o.rotation.set(0, a.cap, cy < 7 ? -Math.max(0, Math.sin(t * 5)) * 0.5 : 0);
      const ar = a.arbre; ar.position.set(a.ax, a.y, a.az); ar.rotation.order = 'YXZ'; ar.rotation.y = a.cap;
      if (cy < 7) { ar.rotation.z = Math.sin(t * 5) > 0.95 ? -0.03 : 0; ar.scale.setScalar(0.11); }
      else if (cy < 8.5) ar.rotation.z = -(((cy - 7) / 1.5) ** 2) * Math.PI / 2; // il tombe
      else if (cy < 11) ar.rotation.z = -Math.PI / 2;
      else if (cy < 12) ar.scale.setScalar(0.0001);
      else { ar.rotation.z = 0; ar.scale.set(0.11, 0.11 * (cy - 12) / 2, 0.11); } // il repousse
    } else if (a.type === 'barque') {
      o.visible = JOUR() && METEO !== 'tempete' && METEO !== 'orage'; if (!o.visible) continue;
      o.position.set(a.x + Math.sin(t * 0.2) * 0.04, -0.16 + Math.sin(t * 1.3) * 0.006, a.z + Math.cos(t * 0.17) * 0.04); o.rotation.set(Math.sin(t * 1.1) * 0.05 * (1 + VENT), a.cap + Math.sin(t * 0.1) * 0.3, 0);
    } else if (a.type === 'navette') {
      const u = (Math.sin(t * a.v) + 1) / 2, sens = Math.cos(t * a.v) >= 0;
      o.position.set(a.a.x + (a.b.x - a.a.x) * u, a.y + Math.abs(Math.sin(t * 7)) * 0.004, a.a.z + (a.b.z - a.a.z) * u);
      o.rotation.y = -Math.atan2((a.b.z - a.a.z) * (sens ? 1 : -1), (a.b.x - a.a.x) * (sens ? 1 : -1));
    } else if (a.type === 'tambour') {
      o.visible = ARMEE_GRP && MODE_ARMEE === 'marche' && JOUR(); if (!o.visible) continue;
      ARMEE_GRP.updateMatrixWorld(true); _ve.set(-0.2, 0, 4.4).applyMatrix4(ARMEE_GRP.matrixWorld);
      o.position.set(_ve.x, _ve.y + Math.abs(Math.sin(t * 8)) * 0.006, _ve.z); o.rotation.y = ARMEE_GRP.rotation.y - Math.PI / 2;
    } else if (a.type === 'bivouac') {
      o.visible = !JOUR(); if (ARMEE_GRP) ARMEE_GRP.visible = JOUR();
      if (!o.visible) continue;
      a.flamme.scale.set(1 + Math.sin(t * 13) * 0.15, 1 + Math.sin(t * 17) * 0.25, 1 + Math.cos(t * 11) * 0.15);
      if ((a.fumee -= dt) <= 0 && bouffees.length < 850) { a.fumee = 1.1; bouffees.push({ x: a.feu.x, y: a.feu.y, z: a.feu.z, age: 0, noire: false, k: 0.45 }); }
    } else if (a.type === 'patine') {
      o.visible = SAISON === 0 && JOUR() && !PLUIE(); if (!o.visible) continue;
      const sd = (Math.sin(t * 0.18 + a.ph) + 1) / 2 * a.ch.long, p = a.ch.en(sd), sens = Math.cos(t * 0.18 + a.ph) >= 0;
      o.position.set(p.x, a.y, p.z); o.rotation.set(0, p.cap + (sens ? 0 : Math.PI), Math.sin(t * 2 + a.ph) * 0.25);
    } else if (a.type === 'papillon') {
      o.visible = (SAISON === 1 || SAISON === 2) && JOUR() && !PLUIE(); if (!o.visible) continue;
      const u = t * 0.5 + a.ph; o.position.set(a.x + Math.sin(u) * 0.3 + Math.sin(u * 2.3) * 0.05, a.y + 0.06 + Math.sin(u * 3.1) * 0.03, a.z + Math.cos(u * 0.8) * 0.25);
      o.rotation.y = -u; o.scale.set(0.03, 0.03, 0.03 * (0.2 + Math.abs(Math.sin(t * 16 + a.ph * 5))));
    }
  }
  // armée : exercice (salves de fumée) ou marche ; elle reste au bivouac la nuit
  if (ARMEE_GRP && ARMEE_BASE && !calme) {
    const marche = MODE_ARMEE === 'marche', d = marche ? Math.sin(t * 0.22) * 0.25 : 0, ry = ARMEE_GRP.rotation.y;
    ARMEE_GRP.position.set(ARMEE_BASE.x + Math.sin(ry) * d, ARMEE_BASE.y + (marche ? Math.abs(Math.sin(t * 8)) * 0.004 : 0), ARMEE_BASE.z + Math.cos(ry) * d);
    if (MODE_ARMEE === 'exercice' && JOUR()) {
      const cy = t % 6, avant = (t - dt) % 6;
      const salve = (pts, k) => { ARMEE_GRP.updateMatrixWorld(true); for (const [lx, ly, lz] of pts) { _ve.set(lx, ly, lz).applyMatrix4(ARMEE_GRP.matrixWorld); if (bouffees.length < 850) bouffees.push({ x: _ve.x, y: _ve.y, z: _ve.z, age: 0, noire: false, k }); } };
      if (avant < 1 && cy >= 1) salve(Array.from({ length: 6 }, (_, i) => [-3.4 + i * 1.15 + 0.42, 2.7, 2.9]), 1.6);
      if (avant < 2.5 && cy >= 2.5) salve([[5.4, 1.2, 3.3], [7.2, 1.2, 2.7]], 3);
    }
  }
  // étincelles
  for (let i = etincelles.length - 1; i >= 0; i--) { const e = etincelles[i]; e.vie -= dt; if (e.vie <= 0) { etincelles.splice(i, 1); continue; } e.vy -= dt * 1.6; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; }
  ETINC.count = Math.min(120, etincelles.length);
  for (let i = 0; i < ETINC.count; i++) { const e = etincelles[i]; _m.compose(_p.set(e.x, e.y, e.z), _q, _s.set(1, 1, 1)); ETINC.setMatrixAt(i, _m); }
  ETINC.instanceMatrix.needsUpdate = true;
  // blés qui ondulent (printemps : courts et verts ; été : hauts et dorés)
  BLE.visible = (SAISON === 1 || SAISON === 2) && bles.length > 0;
  if (BLE.visible) {
    const C = SAISON === 1 ? [0x9fd35a, 0x86c24a, 0xb5d86a] : [0xe3c75b, 0xd6b24a, 0xa9c457, 0xc9b24a], h = SAISON === 1 ? 0.55 : 1;
    bles.forEach((b, i) => {
      const cache = b.k.rail && EPOQUE === 'industrie', pench = calme ? 0 : Math.sin(t * 2.2 + b.x * 4 + b.z * 3) * 0.12 * (0.4 + VENT) + VENT * 0.12;
      _qe.setFromEuler(_eu.set(pench * 0.5, 0, pench)); _m.compose(_p.set(b.x, b.y, b.z), _qe, _s.set(cache ? 0 : 1, cache ? 0 : h, cache ? 0 : 1)); BLE.setMatrixAt(i, _m);
      BLE.setColorAt(i, _ce.setHex(C[b.ci * C.length | 0]).multiplyScalar(1.08));
    });
    BLE.instanceMatrix.needsUpdate = true; if (BLE.instanceColor) BLE.instanceColor.needsUpdate = true;
  }
  // feuilles mortes à l'automne
  FEUILLES.visible = SAISON === 3 && !calme && feuilles.length > 0 && !!feuilles[0].k;
  if (FEUILLES.visible) {
    feuilles.forEach((f, i) => {
      f.age += dt; if (f.age > 4) { f.age = 0; f.ph = Math.random() * 6; f.dx = (Math.random() - 0.5) * 0.9; f.dz = (Math.random() - 0.5) * 0.9; }
      const u = f.age / 4, x = f.k.x + (f.dx || 0) + Math.sin(f.age * 2 + f.ph) * 0.06 + VENT * u * 0.4, z = f.k.z + (f.dz || 0) + Math.cos(f.age * 1.7 + f.ph) * 0.05;
      _qe.setFromEuler(_eu.set(f.age * 3 + f.ph, f.age * 2, f.age * 2.5)); _m.compose(_p.set(x, f.k.top + 0.4 * (1 - u), z), _qe, _s.set(1, 1, 1)); FEUILLES.setMatrixAt(i, _m); FEUILLES.setColorAt(i, COUL_FEUILLES[i % 4]);
    });
    FEUILLES.instanceMatrix.needsUpdate = true; if (FEUILLES.instanceColor) FEUILLES.instanceColor.needsUpdate = true;
  }
  // lucioles les soirs d'été
  LUCIOLES.visible = SAISON === 2 && HEURE !== 'jour' && !PLUIE() && lucioles.length > 0;
  if (LUCIOLES.visible) { const p = LUCIOLES.geometry.attributes.position.array; lucioles.forEach((l, i) => p.set([l.x + Math.sin(t * 0.7 + l.ph) * 0.08, l.y + Math.sin(t * 1.3 + l.ph * 2) * 0.03, l.z + Math.cos(t * 0.6 + l.ph) * 0.08], i * 3)); LUCIOLES.geometry.attributes.position.needsUpdate = true; LUCIOLES.material.opacity = 0.55 + 0.45 * Math.sin(t * 3); }
  // lueurs : lanternes de la ville industrielle, feu du bivouac
  const pos = [], col = [];
  if (EPOQUE === 'industrie' && HEURE !== 'jour') for (const p of LUEURS.userData.lampes || []) { pos.push(...p); col.push(1, 0.85, 0.5); }
  const biv = V2.find(a => a.type === 'bivouac'); if (biv && !JOUR()) { pos.push(biv.feu.x, biv.feu.y - 0.05, biv.feu.z); const f = 0.8 + Math.sin(t * 13) * 0.2; col.push(1 * f, 0.55 * f, 0.2 * f); }
  LUEURS.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); LUEURS.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
