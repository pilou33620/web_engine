"use strict";
// ============================================================ moteur 3D
const toile = $('#scene'), zone = $('#zone');
const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b211a);
const cam = new THREE.PerspectiveCamera(30, 1, 5, 4000);
const ciel = new THREE.HemisphereLight(0xeef7ff, 0x7d8466, 1.5); scene.add(ciel);
const soleilL = new THREE.DirectionalLight(0xfff0d4, 2.6);
soleilL.position.set(-170, 300, 160); soleilL.castShadow = true;
Object.assign(soleilL.shadow.camera, { left: -360, right: 360, top: 300, bottom: -300, near: 10, far: 1000 });
soleilL.shadow.mapSize.set(4096, 4096); soleilL.shadow.bias = -.0006; soleilL.shadow.normalBias = .4;
scene.add(soleilL);
const degrade = new THREE.DataTexture(new Uint8Array([105, 190, 255]), 3, 1, THREE.RedFormat);
degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.needsUpdate = true;
const MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });
const FANT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade, transparent: true, opacity: .7, depthWrite: false });
const CHANT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade, transparent: true, opacity: .42, depthWrite: false });
const CONT = new THREE.MeshBasicMaterial({ color: 0x24180f, side: THREE.BackSide });
const MAT_SOL = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });  // terrain et décor : assombris dans les vues réseau
const MAT_RIV = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });  // rivières : restent vives dans la vue Eau
const GHOST = new THREE.MeshToonMaterial({ color: 0xa3a89a, gradientMap: degrade, transparent: true, opacity: .32, depthWrite: false });
const CONT_V = { eau: new THREE.MeshBasicMaterial({ color: 0x38b6ff, side: THREE.BackSide }), elec: new THREE.MeshBasicMaterial({ color: 0xffc94d, side: THREE.BackSide }), dechets: new THREE.MeshBasicMaterial({ color: 0xf0a35e, side: THREE.BackSide }) };

const VA = new THREE.Vector3(), VB = new THREE.Vector3(), AXEY = new THREE.Vector3(0, 1, 0);
const lot = () => ({ g: [], o: [] });
function put(L, geo, col, x = 0, y = 0, z = 0, ry = 0, ep = .26) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  const c = new THREE.Color(col), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  L.g.push(geo);
  if (ep) {
    const o = geo.clone(); o.computeBoundingBox(); o.boundingBox.getCenter(VA); o.boundingBox.getSize(VB);
    o.translate(-VA.x, -VA.y, -VA.z);
    o.scale((VB.x + 2 * ep) / Math.max(VB.x, 1e-3), (VB.y + 2 * ep) / Math.max(VB.y, 1e-3), (VB.z + 2 * ep) / Math.max(VB.z, 1e-3));
    o.translate(VA.x, VA.y, VA.z); L.o.push(o);
  }
  return geo;
}
function transfere(src, L, x, y, z, ry = 0, s = 1) { for (const k of ['g', 'o']) for (const geo of src[k]) { if (s !== 1) geo.scale(s, s, s); if (ry) geo.rotateY(ry); geo.translate(x, y, z); L[k].push(geo); } }
function fige(L, parent = scene, mat = MAT) {
  const grp = new THREE.Group();
  const plein = mat === MAT || mat === MAT_SOL || mat === MAT_RIV;
  if (L.g.length) { const m = new THREE.Mesh(mergeGeometries(L.g), mat); m.castShadow = m.receiveShadow = plein; grp.add(m); }
  if (L.o.length && plein) grp.add(new THREE.Mesh(mergeGeometries(L.o), CONT));
  parent.add(grp); return grp;
}
function jeter(obj) { if (!obj) return; obj.parent?.remove(obj); obj.traverse(o => { if (o.isMesh || o.isLineSegments) { o.geometry.dispose(); const mt = o.userData.m0 || o.material; if (o.userData.propre && ![MAT, FANT, CHANT, CONT, GHOST, MAT_SOL, MAT_RIV].includes(mt)) mt.dispose(); } }); }
const boite = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sphere = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
function toit(L, w, d, h, col, x, y, z, ry = 0) {
  const p = cyl(1, 1, d, 3); p.rotateX(Math.PI / 2); p.rotateZ(Math.PI / 2); p.scale(h / 1.5, w / SQ3, 1); p.translate(0, h / 2 - h / 3, 0);
  put(L, p, col, x, y + h / 6, z, ry);
}
function perp(pts, i) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }
function ruban(pts, larg, y) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], pa = perp(pts, i), pb = perp(pts, i + 1);
    const a1 = [ax + pa[0] * larg, az + pa[1] * larg], a2 = [ax - pa[0] * larg, az - pa[1] * larg], b1 = [bx + pb[0] * larg, bz + pb[1] * larg], b2 = [bx - pb[0] * larg, bz - pb[1] * larg];
    pos.push(a1[0], y, a1[1], b1[0], y, b1[1], a2[0], y, a2[1], a2[0], y, a2[1], b1[0], y, b1[1], b2[0], y, b2[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  return geo;
}

/** Une géométrie aux sommets bousculés (roche taillée), la pointe gardée en place ; les sommets partagés bougent ensemble. */
function bosseler(g, force) {
  g = g.index ? g.toNonIndexed() : g;
  const P = g.attributes.position, vu = new Map();
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (Math.hypot(x, z) < 1e-4) continue;
    if (!vu.has(k)) vu.set(k, [(rnd() - .5) * force, (rnd() - .5) * force * .6, (rnd() - .5) * force]);
    const [dx, dy, dz] = vu.get(k); P.setXYZ(v, x + dx, y + dy, z + dz);
  }
  g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}

// ============================================================ plateau : tuiles, décor, rivière, eau
let PLATEAU = null;
const eau = new THREE.Mesh(new THREE.PlaneGeometry(COLS * R * SQ3 - 20, ROWS * R * 1.5 - 20), new THREE.MeshToonMaterial({ color: 0x3fa6dc, gradientMap: degrade, transparent: true, opacity: .7 }));
eau.rotation.x = -Math.PI / 2; eau.position.y = -.7; eau.receiveShadow = true; scene.add(eau);
function construirePlateau() {
  jeter(PLATEAU); PLATEAU = new THREE.Group(); scene.add(PLATEAU);
  const DECOR = lot(), TUILES = lot(), RIVL = lot(); FERMES.length = 0;
  for (const t of LISTE) {
    semer(t);
    const d = TERR[t.brume ? 'brume' : t.ville ? 'prairie' : t.t], bas = -10, h = t.top - bas;
    const geo = put(TUILES, cyl(R * .965, R, h, 6), d.col, t.x, bas + h / 2, t.z, 0, 0);
    const c = new THREE.Color(d.col).offsetHSL((rnd() - .5) * .015, 0, (rnd() - .5) * .05), n = geo.attributes.normal, col = geo.attributes.color;
    for (let i = 0; i < col.count; i++) { const k = n.getY(i) > .5 ? 1 : .62; col.setXYZ(i, c.r * k, c.g * k, c.b * k); }
    if (t.brume || t.ville || t === FRONT_T) continue;
    const y = t.top, rr = () => { const a = rnd() * Math.PI * 2, l = Math.sqrt(rnd()) * R * .62; return [t.x + Math.cos(a) * l, t.z + Math.sin(a) * l]; };
    // forêts et montagnes : proposition 1 de web_engine/maquettes/web_engine/arbres-montagnes.html (saison et neige : par MAT_SOL)
    if (t.t === 'foret') {
      for (let i = 0, nb = 9 + (rnd() * 4 | 0); i < nb; i++) {
        const [x, z] = rr(), s = entre(.62, 1.17), ry = rnd() * 6;
        put(DECOR, cyl(.2 * s, .32 * s, 1.5 * s, 5), 0x6e4a2c, x, y + .75 * s, z);
        if (rnd() < .5) {  // sapin à trois étages, chacun tourné
          const v = [0x3e7f34, 0x356f30, 0x4a8a3c][rnd() * 3 | 0];
          [[1.75, 2.3, 1.9], [1.35, 2.1, 3.2], [.95, 1.9, 4.4]].forEach(([r, h, hy], e) => put(DECOR, cone(r * s, h * s, 7), v, x, y + hy * s, z, ry + e * .45));
        } else {           // feuillu en grappe de trois boules
          const c = () => [0x5fae3e, 0x74b83f, 0x4f9a37][rnd() * 3 | 0];
          put(DECOR, sphere(1.45 * s, 0), c(), x, y + 2.75 * s, z, ry);
          put(DECOR, sphere(1.05 * s, 0), c(), x + Math.cos(ry) * .9 * s, y + 2.35 * s, z + Math.sin(ry) * .9 * s, ry);
          put(DECOR, sphere(.95 * s, 0), c(), x - Math.cos(ry + .8) * .8 * s, y + 3.3 * s, z - Math.sin(ry + .8) * .8 * s, ry);
        }
      }
      for (let i = 0; i < 3; i++) { const [x, z] = rr(), s = entre(.5, .8), b = sphere(s, 0); b.scale(1, .6, 1); put(DECOR, b, 0x4f8f3a, x, y + .35 * s, z); }
    }
    if (t.t === 'colline') for (let i = 0; i < 2; i++) { const [x, z] = rr(), b = sphere(entre(3, 4.4), 1); b.scale(1, .38, 1); put(DECOR, b, 0x97ad52, x, y, z, 0, .2); }
    if (t.t === 'montagne') {  // un massif : trois pics de roche taillée, éboulis et sapins au pied
      for (const [dx, dz, k, j] of [[0, -.5, 1.15, 0], [-3.8, 1.2, .72, 1], [3.6, 2, .62, 2]]) {
        const h = 9.5 * k, hn = h * .38, ry = rnd() * 6;
        put(DECOR, bosseler(cone(5.6 * k, h, 6), 1.1 * k), j === 1 ? 0x7a7266 : 0x8a8173, t.x + dx, y + h / 2, t.z + dz, ry);
        put(DECOR, bosseler(cone(5.6 * k * .38 * 1.08, hn, 6), .5 * k), 0xf7f5ee, t.x + dx, y + h - hn / 2 + .02, t.z + dz, ry, .12);
      }
      for (let i = 0; i < 6; i++) { const [x, z] = rr(), s = entre(.35, .65); put(DECOR, sphere(1.2 * s, 0), 0x9b958a, x, y + .3 * s, z, rnd() * 3); }
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2, l = R * entre(.62, .82), x = t.x + Math.cos(a) * l, z = t.z + Math.sin(a) * l, s = entre(.5, .7);
        put(DECOR, cyl(.2 * s, .3 * s, s, 5), 0x6e4a2c, x, y + .5 * s, z); put(DECOR, cone(1.4 * s, 3 * s, 7), 0x3e7f34, x, y + 2.4 * s, z);
      }
    }
    if (t.ferme) { const F = lot(); bFerme(F, t.ferme === 'elevage'); t.grpF = fige(F, PLATEAU, MAT_SOL); t.grpF.position.set(t.x, t.top, t.z); t.grpF.rotation.y = (hache(t.q, t.r, 43) * 6 | 0) * Math.PI / 3; if (t.ferme === 'culture' && t.dr <= 2) FERMES.push(rivProche(t) ?? 0); continue; }
    if (t.t === 'plaine' && t.riviere === undefined) for (let i = 0; i < 3; i++) { const [x, z] = rr(); put(DECOR, boite(entre(3, 5), .5, entre(2, 3)), [0xe3c75b, 0xd6b24a, 0xa9c457][rnd() * 3 | 0], x, y + .25, z, rnd() * 3, .15); }
    if (t.t === 'prairie' && t.riviere === undefined && rnd() < .5) { const [x, z] = rr(); put(DECOR, sphere(1, 0), 0x5fa83c, x, y + .7, z); }
    if (t.t === 'cote' && rnd() < .3) { const [x, z] = rr(); put(DECOR, sphere(entre(.8, 1.4), 0), 0x9b958a, x, y + .6, z); }
  }
  const milieu = (a, b) => [(a.x + b.x) / 2, (a.z + b.z) / 2];
  for (const t of RIV) {
    if (t.riviere === undefined) continue;
    const i = RIV.indexOf(t), av = RIV[i - 1], ap = RIV[i + 1] || t.versMer;
    const A = av ? milieu(t, av) : [t.x + 2, t.z - 2], B = ap ? milieu(t, ap) : [t.x - 1.5, t.z + 1.5], C = [t.x + (hache(t.q, t.r, 5) - .5) * 4, t.z + (hache(t.q, t.r, 6) - .5) * 4];
    const pts = []; for (let s = 0; s <= 12; s++) { const k = s / 12; pts.push([(1 - k) ** 2 * A[0] + 2 * k * (1 - k) * C[0] + k * k * B[0], (1 - k) ** 2 * A[1] + 2 * k * (1 - k) * C[1] + k * k * B[1]]); }
    const w = av ? 1.9 : 1.2;
    put(DECOR, ruban(pts, w + 1.1, t.top + .05), 0xdccf96, 0, 0, 0, 0, 0); put(RIVL, ruban(pts, w, t.top + .1), 0x46a9dd, 0, 0, 0, 0, 0); t.rivPts = pts;
  }
  fige(TUILES, PLATEAU, MAT_SOL); fige(DECOR, PLATEAU, MAT_SOL); fige(RIVL, PLATEAU, MAT_RIV);
  const p = [];
  for (const t of LISTE) if (t.brume) for (let i = 0; i < 6; i++) { const a = coin(t, i, .965), b = coin(t, (i + 1) % 6, .965); p.push(a[0], t.top + .05, a[1], b[0], t.top + .05, b[1]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const traits = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa48c5e })); traits.userData.propre = true; PLATEAU.add(traits);
}
