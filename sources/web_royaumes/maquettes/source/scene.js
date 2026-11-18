// Maquette : le plateau de Royaumes des Rives rendu comme web_power (toon 3 tons, contours bruns, hexagones étagés).
// Les bâtiments et l'armée viennent du vrai code du jeu (modeles.js, collé plus haut dans la page).
const R = 1, SQ3 = Math.sqrt(3);
const COLS = 13, ROWS = 10;
const toile = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b211a);
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xeef7ff, 0x7d8466, 1.5));
const soleil = new THREE.DirectionalLight(0xfff0d4, 2.6);
soleil.position.set(-8, 14, 7); soleil.castShadow = true;
Object.assign(soleil.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 50 });
soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.bias = -0.0008; soleil.shadow.normalBias = 0.02;
scene.add(soleil); scene.add(soleil.target);

// ---------------------------------------------------------------- matériaux web_power
const degrade = new THREE.DataTexture(new Uint8Array([105, 190, 255]), 3, 1, THREE.RedFormat);
degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.needsUpdate = true;
const MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });
const CONT = new THREE.MeshBasicMaterial({ color: 0x24180f, side: THREE.BackSide });
const EP = 0.022; // épaisseur du contour (web_power : 0,26 pour des cases de 10)

// contour d'une pièce : la même forme, grossie d'une épaisseur fixe autour de son centre, faces arrière en brun foncé
const _c = new THREE.Vector3(), _t = new THREE.Vector3();
function contour(g, ep = EP) {
  g.computeBoundingBox(); g.boundingBox.getSize(_t);
  if (Math.min(_t.x, _t.y, _t.z) < Math.max(ep, 0.022 * (ep / EP))) return null; // les fins détails (colombages, vitres) n'en ont pas
  g.boundingBox.getCenter(_c);
  const o = g.clone().translate(-_c.x, -_c.y, -_c.z);
  o.scale((_t.x + 2 * ep) / _t.x, (_t.y + 2 * ep) / _t.y, (_t.z + 2 * ep) / _t.z);
  return o.translate(_c.x, _c.y, _c.z);
}
function couleur(g, col) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function fusionner(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) C.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return r;
}
// un lot de pièces colorées + leurs contours, figé en deux maillages
const lot = () => ({ g: [], o: [] });
function put(L, geo, col, x = 0, y = 0, z = 0, ry = 0, ep = EP) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (ry) g.rotateY(ry);
  g.translate(x, y, z); couleur(g, col); L.g.push(g);
  if (ep) { const o = contour(g, ep); if (o) L.o.push(o); }
}
function fige(L, parent = scene) {
  const grp = new THREE.Group();
  if (L.g.length) { const m = new THREE.Mesh(fusionner(L.g), MAT); m.castShadow = m.receiveShadow = true; grp.add(m); }
  if (L.o.length) grp.add(new THREE.Mesh(fusionner(L.o.map(o => (o.attributes.color ? o : couleur(o, 0)))), CONT));
  parent.add(grp); return grp;
}
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sphere = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

// ---------------------------------------------------------------- terrain (hauteurs et couleurs de web_power, cases de 1)
const TERR = {
  mer: { col: 0x1d5a86, h: -0.55, eau: true }, cote: { col: 0xe6d49a, h: -0.24, eau: true },
  prairie: { col: 0x84c450, h: 0 }, plaine: { col: 0xc9c65c, h: 0 }, foret: { col: 0x5d9b3a, h: 0.02 },
  colline: { col: 0xa2b65a, h: 0.26 }, montagne: { col: 0x8f8879, h: 0.46 }, bati: { col: 0x84c450, h: 0 }, // comme les villes de web_power : une prairie, recouverte par la dalle du quartier
};
const posCase = (c, r) => ({ x: SQ3 * R * (c + 0.5 * (r & 1)), z: 1.5 * R * r });
const vbruit = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = t => t * t * (3 - 2 * t);
  const h = (a, b) => hache(a, b, 91); const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * s(fx)) + ((c + (d - c) * s(fx)) - (a + (b - a) * s(fx))) * s(fy); };
const CASES = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const u = c / (COLS - 1), v = r / (ROWS - 1);
  // la mer à l'ouest et au sud-ouest, les montagnes au nord-est, le reste en terres
  const e = 0.9 * vbruit(c * 0.45, r * 0.45) + 1.1 * u - 0.5 * v + 0.15;
  const m = vbruit(c * 0.6 + 20, r * 0.6 + 7);
  let t = e < 0.55 ? 'mer' : e > 1.68 ? 'montagne' : e > 1.45 ? 'colline' : m > 0.62 ? 'foret' : m < 0.32 ? 'plaine' : 'prairie';
  CASES.push({ c, r, t, ...posCase(c, r) });
}
const at = (c, r) => (c >= 0 && r >= 0 && c < COLS && r < ROWS ? CASES[r * COLS + c] : null);
function voisins(k) { const d = k.r & 1 ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]; return d.map(([dc, dr]) => at(k.c + dc, k.r + dr)).filter(Boolean); }
for (const k of CASES) if (k.t === 'mer' && voisins(k).some(n => !TERR[n.t].eau)) k.t = 'cote';

// la capitale : la case de terre plate la plus centrale
const centre = CASES.filter(k => k.t === 'prairie' || k.t === 'plaine').sort((a, b) => Math.hypot(a.c - 6, a.r - 5) - Math.hypot(b.c - 6, b.r - 5))[0];
// rivière : des collines vers la mer, en passant à côté de la capitale
const RIV = [];
{
  let k = CASES.filter(x => x.t === 'colline').sort((a, b) => Math.hypot(a.c - centre.c - 2, a.r - centre.r + 3) - Math.hypot(b.c - centre.c - 2, b.r - centre.r + 3))[0];
  const vu = new Set();
  while (k && RIV.length < 20) {
    RIV.push(k); vu.add(k);
    if (voisins(k).some(n => TERR[n.t].eau)) { k.versMer = voisins(k).find(n => TERR[n.t].eau); break; }
    // descend vers la mer en évitant la capitale
    k = voisins(k).filter(n => !vu.has(n) && n !== centre && n.t !== 'montagne').sort((a, b) => (a.x + a.z * 0.35 + hache(a.c, a.r, 3) * 0.6) - (b.x + b.z * 0.35 + hache(b.c, b.r, 3) * 0.6))[0];
  }
  for (const x of RIV) { x.riv = true; if (x.t === 'colline' || x.t === 'foret') x.t = 'prairie'; }
}

// ---------------------------------------------------------------- bâtiments du village (vrai code du jeu)
const libres = CASES.filter(k => !TERR[k.t].eau && k.t !== 'montagne' && !k.riv && k !== centre).sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z));
const COTE = CASES.filter(k => !TERR[k.t].eau && !k.riv && voisins(k).some(n => TERR[n.t].eau)).sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z));
const PLAN = [{ k: centre, cle: 'hotel', niveau: 3 }];
const prises = new Set([centre]);
const prendre = (liste, cle, ere) => { const k = liste.find(x => !prises.has(x)); if (k) { prises.add(k); PLAN.push({ k, cle, ere }); } };
// la ville s'étend sur plusieurs cases, comme dans web_power : quartiers résidentiels et faubourg autour du centre
for (const k of voisins(centre).filter(k => !TERR[k.t].eau && k.t !== 'montagne' && !k.riv).slice(0, 3)) { prises.add(k); PLAN.push({ k, cle: 'maison' }); }
prendre(libres, 'cabane');
prendre(COTE, 'pecheur');
prendre(libres.filter(k => voisins(k).some(n => n.t === 'foret')), 'bucheron');
prendre(libres.filter(k => k.t === 'plaine' || k.t === 'prairie'), 'ferme');
for (const cle of ['eglise', 'moulin', 'marche', 'caserne', 'forge', 'taverne', 'tour', 'vignoble', 'bergerie']) prendre(libres, cle);
prendre(libres.filter(k => k.t === 'colline'), 'mine');
// les usines n'existent qu'à l'ère industrielle ; avant, leurs cases restent des champs
for (const cle of ['usine', 'filature', 'haut_fourneau']) prendre(libres.filter(k => k.t === 'plaine' || k.t === 'prairie'), cle, 'industrie');
function actif(p) { return !p.ere || p.ere === EPOQUE; }
for (const p of PLAN) p.k.bati = !p.ere;
const ARMEE = libres.find(k => !prises.has(k) && (k.t === 'prairie' || k.t === 'plaine')); // en terrain découvert
function topDe(k) { return TERR[k.bati ? 'bati' : k.t].h; }
function chemin(a, b, deja) {
  const d = new Map([[a, 0]]), prev = new Map([[a, null]]), vu = new Set();
  const poids = k => (k.t === 'colline' ? 1.6 : k.t === 'foret' ? 1.3 : k.riv ? 2 : k.bati ? 0.7 : 1) * (deja.has(k) ? 0.4 : 1);
  for (;;) {
    let k = null, m = Infinity; for (const [x, v] of d) if (!vu.has(x) && v < m) { m = v; k = x; }
    if (!k) return null; if (k === b) break; vu.add(k);
    for (const n of voisins(k)) if (!vu.has(n) && !TERR[n.t].eau && n.t !== 'montagne') { const c = m + poids(n); if (c < (d.get(n) ?? Infinity)) { d.set(n, c); prev.set(n, k); } }
  }
  const p = []; for (let k = b; k; k = prev.get(k)) p.unshift(k); return p;
}
const CHEMINS = [], reseau = new Set([centre]);
for (const p of PLAN.slice(1).sort((x, y) => Math.hypot(x.k.x - centre.x, x.k.z - centre.z) - Math.hypot(y.k.x - centre.x, y.k.z - centre.z))) {
  const ch = chemin(centre, p.k, reseau); if (!ch || ch.length < 2) continue;
  ch.forEach(k => reseau.add(k));
  const pts = ch.map((k, i) => [k.x + (i && i < ch.length - 1 ? (hache(k.c, k.r, 17) - 0.5) * 0.3 : 0), k.z + (i && i < ch.length - 1 ? (hache(k.c, k.r, 19) - 0.5) * 0.3 : 0)]);
  pts[0] = [pts[0][0] + (pts[1][0] - pts[0][0]) * 0.35, pts[0][1] + (pts[1][1] - pts[0][1]) * 0.35]; // part du bord de la place
  const fin = pts.length - 1; pts[fin] = [pts[fin][0] + (pts[fin - 1][0] - pts[fin][0]) * 0.3, pts[fin][1] + (pts[fin - 1][1] - pts[fin][1]) * 0.3]; // s'arrête au pied du bâtiment
  const pts2 = []; for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 4; s++) { const t = s / 4; pts2.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); } pts2.push(pts[fin]);
  CHEMINS.push({ pts2, large: 0.07, ch, ere: p.ere });
}
// hauteur d'un point du plateau : la case la plus proche
function solEn(x, z) { let b = null, m = Infinity; for (const k of CASES) { const d = (k.x - x) ** 2 + (k.z - z) ** 2; if (d < m) { m = d; b = k; } } return Math.max(topDe(b), -0.15); }
for (const c of CHEMINS) { c.pts2 = c.pts2.map(([x, z]) => [x, z]); c.y = c.pts2.map(([x, z]) => solEn(x, z) + 0.012); }
// voie ferrée de l'ère industrielle : du haut fourneau à l'usine, en contournant la ville
const RAIL = (() => {
  const voie = (a, b) => {
    const d = new Map([[a, 0]]), prev = new Map([[a, null]]), vu = new Set();
    const poids = k => (k === b ? 1 : k.bati || k === ARMEE ? 8 : k.riv ? 3 : k.t === 'colline' ? 2 : k.t === 'foret' ? 1.5 : 1);
    for (;;) {
      let k = null, m = Infinity; for (const [x, v] of d) if (!vu.has(x) && v < m) { m = v; k = x; }
      if (!k) return null; if (k === b) break; vu.add(k);
      for (const n of voisins(k)) if (!vu.has(n) && !TERR[n.t].eau && n.t !== 'montagne') { const c = m + poids(n); if (c < (d.get(n) ?? Infinity)) { d.set(n, c); prev.set(n, k); } }
    }
    const ch = []; for (let k = b; k; k = prev.get(k)) ch.unshift(k); return { ch, cout: d.get(b) };
  };
  // les deux usines les plus proches l'une de l'autre
  const us = PLAN.filter(p => p.ere === 'industrie').map(p => p.k), paires = [];
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) { const v = voie(us[i], us[j]); if (v) paires.push(v); }
  if (!paires.length) return null;
  const { ch } = paires.sort((x, y) => x.cout - y.cout)[0];
  for (const k of ch.slice(1, -1)) k.rail = true; // pas d'arbres ni de champs sous la voie
  let pts = ch.map(k => [k.x, k.z]);
  const n = pts.length - 1; // la voie entre dans chaque usine sans aller jusqu'au centre
  pts[0] = [pts[0][0] + (pts[1][0] - pts[0][0]) * 0.3, pts[0][1] + (pts[1][1] - pts[0][1]) * 0.3];
  pts[n] = [pts[n][0] + (pts[n - 1][0] - pts[n][0]) * 0.3, pts[n][1] + (pts[n - 1][1] - pts[n][1]) * 0.3];
  for (let it = 0; it < 3; it++) { // courbes douces (Chaikin)
    const q = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    q.push(pts[pts.length - 1]); pts = q;
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const ys = pts.map(([x, z]) => solEn(x, z) + 0.02);
  // position, hauteur et cap à une distance donnée le long de la voie
  const en = sd => { sd = Math.max(0, Math.min(cum[cum.length - 1] - 1e-4, sd)); let i = 0; while (cum[i + 1] < sd) i++; const f = (sd - cum[i]) / (cum[i + 1] - cum[i]); return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, y: ys[i] + (ys[i + 1] - ys[i]) * f, cap: -Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) }; };
  return { pts, cum, ys, long: cum[cum.length - 1], en };
})();

// ---------------------------------------------------------------- plateau
let PLATEAU = null;
const eau = new THREE.Mesh(new THREE.PlaneGeometry(COLS * SQ3 + 8, ROWS * 1.5 + 8), new THREE.MeshToonMaterial({ color: 0x3fa6dc, gradientMap: degrade, transparent: true, opacity: 0.72 }));
eau.rotation.x = -Math.PI / 2; eau.position.set((COLS - 0.5) * SQ3 / 2, -0.15, (ROWS - 1) * 0.75); eau.receiveShadow = true; scene.add(eau);
const TEINTES = [0xe2e9f2, 0xf0fbe8, 0xfff4d8, 0xffd8a8]; // hiver, printemps, été, automne (teinte de web_power)
let SAISON = 2;
function construirePlateau() {
  if (PLATEAU) scene.remove(PLATEAU);
  PLATEAU = new THREE.Group(); scene.add(PLATEAU);
  const TUILES = lot(), DECOR = lot(), RIVL = lot();
  const teinte = new THREE.Color(TEINTES[SAISON]);
  let graine = 1; const rnd = () => hache(graine++, 5, 17);
  for (const k of CASES) {
    const d = TERR[k.bati ? 'bati' : k.t], bas = -1, h = d.h - bas;
    k.top = d.h;
    const g = cyl(R * 0.965, R, h, 6).toNonIndexed(); g.translate(k.x, bas + h / 2, k.z);
    const c = new THREE.Color(d.col).offsetHSL((hache(k.c, k.r, 1) - 0.5) * 0.015, 0, (hache(k.c, k.r, 2) - 0.5) * 0.05);
    if (!d.eau) c.multiply(teinte);
    if (SAISON === 0 && !d.eau && k.t !== 'montagne') c.lerp(new THREE.Color(0xf4f7fb), 0.55);
    const n = g.attributes.normal, a = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) { const f = n.getY(i) > 0.5 ? 1 : 0.62; a.set([c.r * f, c.g * f, c.b * f], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); TUILES.g.push(g);
    if (k.bati || k === ARMEE || (k.rail && EPOQUE === 'industrie')) continue;
    const y = k.top, rr = () => { const an = rnd() * Math.PI * 2, l = Math.sqrt(rnd()) * R * 0.62; return [k.x + Math.cos(an) * l, k.z + Math.sin(an) * l]; };
    const s0 = 0.11; // décor de web_power ramené à des cases de 1
    if (k.t === 'foret') for (let i = 0, nb = 5 + (rnd() * 3 | 0); i < nb; i++) {
      const [x, z] = rr(), s = (0.8 + rnd() * 0.45) * s0;
      const vert = SAISON === 3 ? [0xd9822b, 0xc9a13a, 0xb5562a] : SAISON === 0 ? [0x8a8f7a, 0x9aa08a, 0x7f846f] : [0x5fae3e, 0x74b83f, 0x4f9a37];
      put(DECOR, cyl(0.3 * s, 0.4 * s, 1.4 * s, 5), 0x7a5233, x, y + 0.7 * s, z);
      if (rnd() < 0.55) { put(DECOR, cone(1.9 * s, 3 * s, 6), SAISON === 0 ? 0x5f7f5a : 0x3e7f34, x, y + 2.6 * s, z); put(DECOR, cone(1.4 * s, 2.4 * s, 6), SAISON === 0 ? 0xf4f6f8 : 0x4c9440, x, y + 4 * s, z); }
      else put(DECOR, sphere(1.9 * s, 0), vert[rnd() * 3 | 0], x, y + 2.9 * s, z);
    }
    if (k.t === 'colline') for (let i = 0; i < 2; i++) { const [x, z] = rr(), b = sphere((3 + rnd() * 1.4) * s0, 1); b.scale(1, 0.38, 1); put(DECOR, b, 0x97ad52, x, y, z, 0, 0.012); }
    if (k.t === 'montagne') for (let i = 0, nb = 1 + (rnd() * 2 | 0); i < nb; i++) {
      const [x, z] = i ? rr() : [k.x + (rnd() - 0.5) * 0.2, k.z + (rnd() - 0.5) * 0.2], s = (i ? 0.6 + rnd() * 0.2 : 1 + rnd() * 0.2) * s0;
      put(DECOR, cone(6 * s, 9 * s, 5), 0x8a8173, x, y + 4.5 * s, z, rnd() * 2); put(DECOR, cone(2.6 * s, 3.9 * s, 5), 0xf7f5ee, x, y + 7.05 * s, z, 0, 0.012);
    }
    if (k.t === 'plaine' && !k.riv) {
      // parcellaire : trois bandes de deux parcelles, alignées sur une direction de la case, avec leurs sillons
      const an = (hache(k.c, k.r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an);
      const C = SAISON === 0 ? [0xeef2f6, 0xe4eaef] : SAISON === 1 ? [0x9fd35a, 0x86c24a, 0xb5d86a] : SAISON === 3 ? [0xc9a35a, 0xa8803f, 0x9b7d4a] : [0xe3c75b, 0xd6b24a, 0xa9c457, 0xc9b24a];
      const W = 0.46, D = 0.24, jeu = 0.04;
      const poser = (w, h, d, c, lx, lz) => put(DECOR, new THREE.BoxGeometry(w, h, d), c, k.x + lx * ca + lz * sa, y + h / 2, k.z - lx * sa + lz * ca, an, 0);
      if (hache(k.c, k.r, 12) < 0.35) { const x = k.x + 0.05 * sa, z = k.z + 0.05 * ca; put(DECOR, new THREE.BoxGeometry(0.008, 0.11, 0.008), 0x5b3a1e, x, y + 0.055, z, 0, 0.003); put(DECOR, new THREE.BoxGeometry(0.075, 0.008, 0.008), 0x5b3a1e, x, y + 0.09, z, an, 0.003); put(DECOR, new THREE.BoxGeometry(0.034, 0.034, 0.02), 0x8a5a34, x, y + 0.083, z, an, 0.003); put(DECOR, new THREE.CylinderGeometry(0.024, 0.024, 0.007, 8), 0xd9b45a, x, y + 0.117, z, 0, 0.003); } // épouvantail
      for (let b = -1; b <= 1; b++) for (const cote of [-1, 1]) {
        const col = new THREE.Color(C[hache(k.c * 7 + b, k.r * 5 + cote, 9) * C.length | 0]), lx = cote * (W + jeu) / 2, lz = b * (D + jeu);
        poser(W, 0.03, D, col.getHex(), lx, lz);
        if (SAISON === 2 && b === 0 && cote === 1) for (const g of [-0.15, 0, 0.15]) { const gx = lx + g, x = k.x + gx * ca + lz * sa, z = k.z - gx * sa + lz * ca; put(DECOR, cone(0.03, 0.08, 6), 0xe3c75b, x, y + 0.07, z, 0, 0.004); } // gerbes
        if (SAISON !== 0) for (const sl of [-1, 0, 1]) poser(W * 0.9, 0.034, 0.018, col.clone().multiplyScalar(0.8).getHex(), lx, lz + sl * D / 3);
      }
    }
    if (k.t === 'prairie' && !k.riv && rnd() < 0.5) { const [x, z] = rr(); put(DECOR, sphere(s0, 0), 0x5fa83c, x, y + 0.7 * s0, z); }
    if (k.t === 'cote' && rnd() < 0.3) { const [x, z] = rr(); put(DECOR, sphere((0.8 + rnd() * 0.6) * s0, 0), 0x9b958a, x, y + 0.6 * s0, z); }
  }
  // rivière : ruban de sable puis ruban d'eau, en courbes d'une case à l'autre (comme web_power)
  const milieu = (a, b) => [(a.x + b.x) / 2, (a.z + b.z) / 2];
  RIV.forEach((k, i) => {
    const av = RIV[i - 1], ap = RIV[i + 1] || k.versMer;
    const A = av ? milieu(k, av) : [k.x + 0.2, k.z - 0.2], B = ap ? milieu(k, ap) : [k.x - 0.15, k.z + 0.15], C = [k.x + (hache(k.c, k.r, 5) - 0.5) * 0.4, k.z + (hache(k.c, k.r, 6) - 0.5) * 0.4];
    const pts = []; for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push([(1 - t) ** 2 * A[0] + 2 * t * (1 - t) * C[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * C[1] + t * t * B[1]]); }
    const w = av ? 0.19 : 0.12;
    put(DECOR, ruban(pts, w + 0.11, k.top + 0.005), SAISON === 0 ? 0xe8ecef : 0xdccf96, 0, 0, 0, 0, 0);
    put(RIVL, ruban(pts, w, k.top + 0.01), SAISON === 0 ? 0xbfe4f5 : 0x46a9dd, 0, 0, 0, 0, 0);
  });
  // routes de web_power : chemins de terre, puis pavés (Empire), puis chaussées empierrées (Industrie)
  const ROUTE = { ancien: 0xc9a874, lumieres: 0xc9a874, empire: 0xb9b2a2, industrie: 0x8a867e }[EPOQUE];
  for (const p of PLAN) p.k.bati = actif(p);
  for (const ch of CHEMINS) if (!ch.ere || ch.ere === EPOQUE) put(DECOR, ruban(ch.pts2, ch.large, 0), SAISON === 0 && EPOQUE !== 'industrie' ? 0xe3e6e2 : ROUTE, 0, 0, 0, 0, 0);
  if (EPOQUE === 'industrie' && RAIL) {
    put(DECOR, ruban(RAIL.pts, 0.065, 0), 0x9a948a, 0, 0, 0, 0, 0); // ballast
    for (let sd = 0.02; sd < RAIL.long; sd += 0.045) { const p = RAIL.en(sd); put(DECOR, new THREE.BoxGeometry(0.026, 0.008, 0.13), 0x5b3a1e, p.x, p.y + 0.002, p.z, p.cap, 0); } // traverses
    for (let i = 0; i < RAIL.pts.length - 1; i++) { // deux rails
      const [ax, az] = RAIL.pts[i], [bx, bz] = RAIL.pts[i + 1], l = Math.hypot(bx - ax, bz - az), cap = -Math.atan2(bz - az, bx - ax), px = -(bz - az) / l, pz = (bx - ax) / l, y = (RAIL.ys[i] + RAIL.ys[i + 1]) / 2 + 0.01;
      for (const o of [-0.032, 0.032]) put(DECOR, new THREE.BoxGeometry(l + 0.004, 0.01, 0.008), 0x8a8f96, (ax + bx) / 2 + px * o, y, (az + bz) / 2 + pz * o, cap, 0);
    }
  }
  fige(TUILES, PLATEAU); fige(DECOR, PLATEAU); fige(RIVL, PLATEAU);
}
function perp(pts, i) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }
function ruban(pts, larg, y0) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], pa = perp(pts, i), pb = perp(pts, i + 1);
    const y = y0 || Math.max(solEn(ax, az), solEn(bx, bz)) + 0.012; // y0 = 0 : la route suit le plateau
    pos.push(ax + pa[0] * larg, y, az + pa[1] * larg, bx + pb[0] * larg, y, bz + pb[1] * larg, ax - pa[0] * larg, y, az - pa[1] * larg,
      ax - pa[0] * larg, y, az - pa[1] * larg, bx + pb[0] * larg, y, bz + pb[1] * larg, bx - pb[0] * larg, y, bz - pb[1] * larg);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

// ---------------------------------------------------------------- bâtiments, armée et pièces animées
let BATIS = null, EPOQUE = 'ancien', PALIER = 0;
const ailes = [], drapeaux = [], cheminees = [];
const ROYAUME = '#2f5fa8';
function meshBatiment(r) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(r.geo, MAT); m.castShadow = m.receiveShadow = true; grp.add(m);
  if (r.geo.userData.contour) grp.add(new THREE.Mesh(r.geo.userData.contour, CONT));
  return grp;
}
function construireBatiments() {
  if (BATIS) scene.remove(BATIS);
  BATIS = new THREE.Group(); scene.add(BATIS);
  ailes.length = drapeaux.length = cheminees.length = 0;
  for (const p of PLAN) {
    if (!actif(p)) continue;
    const E = EPOQUES[EPOQUE], L = lot(), ex = { fum: [], ailes: [], drap: [] };
    let i = 0; rnd = () => hache(p.k.c * 31 + i++, p.k.r * 17, 77); // même tirage à chaque reconstruction
    BATR[p.cle](L, ex, E, p);
    const grp = fige(L, BATIS);
    grp.scale.setScalar(ECH_BAT); grp.position.set(p.k.x, p.k.top, p.k.z); grp.rotation.y = (hache(p.k.c, p.k.r, 2) * 6 | 0) * Math.PI / 3;
    grp.updateMatrixWorld(true);
    const monde = a => new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(grp.matrixWorld);
    for (const a of ex.fum) cheminees.push({ pos: monde(a), noire: a[3], prochain: hache(cheminees.length, 4) * 2 });
    for (const a of ex.drap) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13, 6, 1).translate(0.11, 0, 0), new THREE.MeshToonMaterial({ color: ROYAUME, gradientMap: degrade, side: THREE.DoubleSide })); f.position.copy(monde(a)); BATIS.add(f); drapeaux.push(f); }
    for (const a of ex.ailes) {
      const La = lot();
      for (let j = 0; j < 4; j++) { put(La, new THREE.BoxGeometry(0.05, 0.44, 0.014).translate(0, 0.22, 0).rotateZ(j * Math.PI / 2), 0x8b5a2b, 0, 0, 0, 0, 0.008); put(La, new THREE.BoxGeometry(0.16, 0.012, 0.006).translate(0, 0.3, 0.01).rotateZ(j * Math.PI / 2), 0xe9dcc0, 0, 0, 0, 0, 0); }
      const w = fige(La, BATIS); w.position.copy(monde(a)); w.rotation.order = 'YXZ'; w.rotation.y = grp.rotation.y; ailes.push(w);
    }
  }
  if (ARMEE) {
    const grp = fige(armee(PALIERS[PALIER], ROYAUME), BATIS);
    grp.scale.setScalar(ECH_BAT); grp.position.set(ARMEE.x, ARMEE.top, ARMEE.z); grp.rotation.y = 0.5; grp.translateX(-0.12);
    ARMEE_GRP = grp; ARMEE_BASE = grp.position.clone();
  }
}

// fumées : boules toon qui montent et grossissent
const FUM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshToonMaterial({ color: 0xf2f0ea, gradientMap: degrade, transparent: true, opacity: 0.8 }), 300);
FUM.count = 0; FUM.frustumCulled = false; scene.add(FUM);
const bouffees = [], NOIRE = new THREE.Color(0x55504a), BLANCHE = new THREE.Color(0xffffff);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();


// ---------------------------------------------------------------- ambiance de web_power : charrettes, vaches, faune, bateaux, oiseaux
// Modèles repris de web_power (ses unités : cases de 10), réduits d'un facteur ECH.
const ECH = 0.04;
const boite = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PATTES = (dx, dz, h, w, c) => [[-dx, -dz], [-dx, dz], [dx, -dz], [dx, dz]].map(([x, z]) => [boite(w, h, w), x, h / 2, z, c]);
const roue = (x, z, r = 0.38) => [cyl(r, r, 0.22, 8).rotateX(Math.PI / 2), x, r, z, 0x2a2622];
const BICHE = [[boite(1.3, 0.55, 0.45), 0, 1.05, 0, 0x9a6a3a], [boite(1, 0.14, 0.4), 0, 0.78, 0, 0xe8dcc8], [boite(0.28, 0.62, 0.26), 0.6, 1.45, 0, 0x9a6a3a], [boite(0.5, 0.28, 0.26), 0.8, 1.8, 0, 0x8a5c32], [boite(0.1, 0.2, 0.08), 0.68, 2.02, 0.1, 0x6b4a2a], [boite(0.1, 0.2, 0.08), 0.68, 2.02, -0.1, 0x6b4a2a], [boite(0.12, 0.16, 0.14), -0.7, 1.2, 0, 0xf4f1ea], ...PATTES(0.45, 0.14, 0.8, 0.12, 0x6b4a2a)];
const PAYSAN = chemise => [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x5a4632], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x5a4632], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, chemise], [sphere(0.28, 1), 0.02, 2.1, 0, 0xf0c9a0], [cyl(0.55, 0.55, 0.08, 10), 0, 2.36, 0, 0xd9b45a], [cyl(0.25, 0.3, 0.25, 8), 0, 2.5, 0, 0xd9b45a]];
const ATTELAGE = dx => [[boite(1.9, 0.85, 0.7), dx, 1.35, 0, 0x8a5a32], [boite(0.45, 0.9, 0.4), dx + 0.95, 1.95, 0, 0x8a5a32], [boite(0.7, 0.35, 0.35), dx + 1.25, 2.3, 0, 0x7a4a28], ...PATTES(0.7, 0.22, 0.95, 0.16, 0x4a2c18).map(([g, x, y, z, c]) => [g, x + dx, y, z, c])];
const MODELES = {
  char: [[boite(1.7, 0.3, 1), -0.4, 0.75, 0, 0x9a6a3a], [boite(1.7, 0.35, 0.1), -0.4, 1.05, 0.45, 0x7a4f2a], [boite(1.7, 0.35, 0.1), -0.4, 1.05, -0.45, 0x7a4f2a], roue(-0.4, 0.55, 0.45), roue(-0.4, -0.55, 0.45), [boite(1.1, 0.55, 0.4), 1.2, 1.05, 0, 0x6b4226], [boite(0.45, 0.4, 0.3), 1.85, 1.45, 0, 0x6b4226], [boite(0.12, 0.75, 0.12), 0.8, 0.4, 0, 0x4a2e1a], [boite(0.12, 0.75, 0.12), 1.6, 0.4, 0, 0x4a2e1a], [boite(0.7, 0.35, 0.8), -0.5, 1.15, 0, 0xe3c75b]],
  vache: [[boite(1.6, 0.8, 0.7), 0, 0.9, 0, 0xf6f2ea], [boite(0.7, 0.5, 0.72), -0.2, 1.0, 0, 0x2f2c2a], [boite(0.6, 0.55, 0.5), 0.95, 1.15, 0, 0xf6f2ea], [boite(0.2, 0.5, 0.2), -0.55, 0.3, 0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), 0.5, 0.3, -0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), -0.55, 0.3, -0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), 0.5, 0.3, 0.2, 0xe8e2d6]],
  biche: BICHE,
  cerf: [...BICHE, ...[0.13, -0.13].flatMap(z => [[boite(0.07, 0.55, 0.07), 0.66, 2.2, z, 0x5a4630], [boite(0.32, 0.07, 0.07), 0.55, 2.35, z * 1.6, 0x5a4630], [boite(0.07, 0.25, 0.07), 0.45, 2.45, z * 2, 0x5a4630]])],
  sanglier: [[boite(1.3, 0.7, 0.62), 0, 0.75, 0, 0x4a3a30], [boite(1, 0.14, 0.22), 0, 1.15, 0, 0x2e241e], [boite(0.5, 0.46, 0.46), 0.82, 0.68, 0, 0x3e3029], [boite(0.2, 0.22, 0.26), 1.14, 0.58, 0, 0x8a6a5a], [boite(0.06, 0.16, 0.05), 1.1, 0.52, 0.15, 0xf4f1ea], [boite(0.06, 0.16, 0.05), 1.1, 0.52, -0.15, 0xf4f1ea], ...PATTES(0.42, 0.18, 0.42, 0.15, 0x2e241e)],
  renard: [[boite(1, 0.38, 0.32), 0, 0.66, 0, 0xd9622b], [boite(0.8, 0.1, 0.28), 0, 0.48, 0, 0xf4f1ea], [boite(0.38, 0.32, 0.3), 0.6, 0.82, 0, 0xd9622b], [boite(0.2, 0.13, 0.15), 0.85, 0.74, 0, 0xf4f1ea], [boite(0.08, 0.2, 0.08), 0.62, 1.06, 0.09, 0x2a1d14], [boite(0.08, 0.2, 0.08), 0.62, 1.06, -0.09, 0x2a1d14], [boite(0.7, 0.22, 0.22), -0.8, 0.76, 0, 0xd9622b], [boite(0.2, 0.22, 0.22), -1.22, 0.8, 0, 0xf4f1ea], ...PATTES(0.32, 0.1, 0.46, 0.08, 0x2a1d14)],
  loco: [[cyl(0.5, 0.5, 2.2, 12).rotateZ(Math.PI / 2), 0.4, 1.25, 0, 0x2b2b30], [boite(0.15, 1.02, 1.02), -0.2, 1.25, 0, 0xb8322a], [boite(0.15, 1.02, 1.02), 1, 1.25, 0, 0xb8322a], [boite(1, 1.4, 1.15), -1.15, 1.4, 0, 0x8a2a24], [boite(1.3, 0.15, 1.35), -1.15, 2.15, 0, 0x2b2b30], [boite(0.5, 0.45, 0.08), -1.15, 1.6, 0.58, 0xf2d27a],
    [cyl(0.32, 0.18, 0.4, 8), 1.1, 2.15, 0, 0x2b2b30], [cyl(0.16, 0.16, 0.5, 8), 1.1, 1.8, 0, 0x2b2b30], [boite(0.4, 0.3, 0.4), 0.2, 1.85, 0, 0xc9a24a], [boite(3.4, 0.3, 1), -0.1, 0.55, 0, 0x3a3a40], [cone(0.45, 0.6, 4).rotateZ(-Math.PI / 2), 1.75, 0.5, 0, 0xb8322a],
    roue(-1.1, 0.55, 0.42), roue(-1.1, -0.55, 0.42), roue(0.1, 0.55, 0.42), roue(0.1, -0.55, 0.42), roue(1, 0.55, 0.3), roue(1, -0.55, 0.3)],
  paysan: PAYSAN(0xe9e2d0),
  faucheur: [...PAYSAN(0xd9cfb0), [boite(1.8, 0.08, 0.08).rotateZ(-0.6), 0.55, 1.3, 0.35, 0x8b5a2b], [boite(0.08, 0.05, 1.1), 1.25, 0.8, 0.85, 0xd9d9d9]],
  semeur: [...PAYSAN(0xc9d4e0), [boite(0.32, 0.45, 0.4), 0.3, 1.2, 0.4, 0xc9b27a]],
  vendangeur: [...PAYSAN(0xe0d0c0), [cyl(0.36, 0.26, 0.8, 8), -0.45, 1.55, 0, 0x8a6a4a], [sphere(0.22, 0), -0.45, 2, 0, 0x6a2a5a]],
  charrue: [...ATTELAGE(1.6), [boite(1.6, 0.12, 0.12), 0.1, 0.75, 0, 0x8b5a2b], [boite(0.2, 0.55, 0.5), -0.6, 0.35, 0, 0x6b6f75], [boite(0.9, 0.08, 0.08).rotateZ(0.5), -1, 1, 0.25, 0x8b5a2b], [boite(0.9, 0.08, 0.08).rotateZ(0.5), -1, 1, -0.25, 0x8b5a2b], ...PAYSAN(0xd9cfb0).map(([g, x, y, z, c]) => [g.clone(), x - 1.7, y, z, c])],
  poule: [[boite(0.5, 0.4, 0.35), 0, 0.4, 0, 0xf4f1ea], [boite(0.22, 0.25, 0.2), 0.3, 0.7, 0, 0xf4f1ea], [boite(0.1, 0.12, 0.06), 0.32, 0.88, 0, 0xd9322a], [boite(0.1, 0.05, 0.06), 0.45, 0.68, 0, 0xf2b33d], [boite(0.06, 0.25, 0.06), 0, 0.12, 0.08, 0xf2b33d], [boite(0.06, 0.25, 0.06), 0, 0.12, -0.08, 0xf2b33d], [boite(0.15, 0.2, 0.25), -0.3, 0.6, 0, 0xe8e2d6]],
  mouton: [[boite(1.1, 0.65, 0.7), 0, 0.75, 0, 0xf4f2ea], [boite(0.35, 0.35, 0.35), 0.65, 0.85, 0, 0x2b2b2b], ...PATTES(0.35, 0.2, 0.45, 0.12, 0x2b2b2b)],
  corbeau: [[boite(0.6, 0.25, 0.25), 0, 0.25, 0, 0x1f1f24], [boite(0.2, 0.2, 0.2), 0.35, 0.38, 0, 0x1f1f24], [boite(0.15, 0.05, 0.06), 0.5, 0.35, 0, 0x4a4a4a], [boite(0.3, 0.05, 0.2), -0.4, 0.3, 0, 0x1f1f24]],
  wagon: [[boite(2.2, 0.8, 1.1), 0, 0.95, 0, 0x6b4a2a], [boite(2, 0.3, 0.95), 0, 1.4, 0, 0x2b2b2b], [boite(2.4, 0.25, 1), 0, 0.5, 0, 0x3a3a40], roue(-0.7, 0.55, 0.35), roue(-0.7, -0.55, 0.35), roue(0.7, 0.55, 0.35), roue(0.7, -0.55, 0.35)],
  bateau: [[boite(3.2, 0.7, 1.2), 0, 0.35, 0, 0x8a5a34], [boite(0.15, 3.2, 0.15), 0, 2, 0, 0x5b3a1e], [cone(1.2, 3.2, 3).scale(0.25, 1, 1), 0.2, 2.3, 0, 0xf6f2ea]],
  oiseau: [[boite(1.5, 0.32, 0.38), 0, 0, 0, 0xf4f1ea], [boite(0.42, 0.3, 0.3), 0.9, 0.08, 0, 0xf4f1ea], [boite(0.25, 0.08, 0.1), 1.2, 0.04, 0, 0xf2b33d], [boite(0.5, 0.08, 0.5), -0.95, 0.04, 0, 0xd9d6cf], [boite(0.75, 0.07, 2.2), 0.05, 0, 0, 0xd9d6cf]],
};
function acteur(nom, s = ECH, parent = AMB) {
  const L = lot();
  for (const [g, x, y, z, c] of MODELES[nom]) put(L, g, c, x, y, z, 0, 0.09);
  const grp = fige(L, parent); grp.scale.setScalar(s); return grp;
}
let AMB = null, ACTEURS = [];
function construireAmbiance() {
  if (AMB) scene.remove(AMB);
  AMB = new THREE.Group(); scene.add(AMB); ACTEURS = [];
  // charrettes : une par chemin assez long, en va-et-vient
  CHEMINS.filter(c => c.pts2.length > 5 && !c.ere).forEach((c, i) => ACTEURS.push({ type: 'char', o: acteur('char'), c, ph: i * 1.7, v: 0.05 + hache(i, 3) * 0.03 }));
  // vaches dans les prés autour de la ferme ou de la bergerie
  CASES.filter(k => k.t === 'prairie' && !k.bati && !k.riv).slice(0, 3).forEach((k, j) => [0, 1].forEach(n => ACTEURS.push({ type: 'vache', o: acteur('vache', ECH * 0.9), k, x: (hache(k.c, n, 40) - 0.5) * 0.6, z: (hache(k.r, n, 50) - 0.5) * 0.5, a: hache(j, n, 60) * 6, ph: n * 2.1 + j })));
  // faune des lisières : cerf et biches, ou sangliers, ou renard, entre une forêt et un pré
  const lisieres = CASES.filter(k => k.t === 'foret' && voisins(k).some(n => (n.t === 'prairie' || n.t === 'plaine') && !n.bati));
  lisieres.filter((_, i) => i % 3 === 0).slice(0, 5).forEach((k, i) => {
    const pre = voisins(k).find(n => (n.t === 'prairie' || n.t === 'plaine') && !n.bati), h = hache(k.c, k.r, 31);
    const gr = h < 0.45 ? [['cerf', 1], ['biche', 0.9], ['biche', 0.6]] : h < 0.8 ? [['sanglier', 1], ['sanglier', 0.55], ['sanglier', 0.5]] : [['renard', 1]];
    const ex = pre.z - k.z, ez = -(pre.x - k.x), el = Math.hypot(ex, ez);
    gr.forEach(([esp, t], j) => ACTEURS.push({ type: 'faune', esp, o: acteur(esp, ECH * t), bx: k.x + (pre.x - k.x) * 0.5 + (j ? (hache(i, j, 33) - 0.5) * 0.25 : 0), bz: k.z + (pre.z - k.z) * 0.5 + (j ? (hache(i, j, 34) - 0.5) * 0.25 : 0), ex: ex / el, ez: ez / el, ph: i * 1.7 + j * 0.35, v: esp === 'renard' ? 0.35 : esp === 'sanglier' ? 0.3 : 0.18, y: Math.max(topDe(k), topDe(pre)) }));
  });
  // bateaux au large
  CASES.filter(k => k.t === 'mer').filter((k, i) => hache(k.c, k.r, 23) < 0.25).slice(0, 4).forEach((k, i) => ACTEURS.push({ type: 'bateau', o: acteur('bateau', 0.05), k, r: 0.5 + hache(k.c, k.r, 3) * 0.6, ph: i * 1.7, v: 0.05 + hache(k.c, k.r, 5) * 0.05 }));
  // un vol d'oiseaux en V
  for (let n = 0; n < 7; n++) ACTEURS.push({ type: 'oiseau', o: acteur('oiseau', 0.035), n });
  // ---- la vie des champs, des vergers et des fermes, selon la saison
  const angB = k => (hache(k.c, k.r, 2) * 6 | 0) * Math.PI / 3; // orientation d'un bâtiment (comme construireBatiments)
  const dansBat = (k, lx, lz) => { const g = angB(k), c = Math.cos(g), sn = Math.sin(g); return [k.x + (lx * c + lz * sn) * ECH_BAT, k.z + (-lx * sn + lz * c) * ECH_BAT]; };
  // champs des plaines : une parcelle par case pour chaque travail
  CASES.filter(k => k.t === 'plaine' && !k.riv && !k.bati).slice(0, 7).forEach((k, i) => {
    const an = (hache(k.c, k.r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an);
    const parcelle = (b, cote) => { const lx = cote * 0.25, lz = b * 0.28; return { x: k.x + lx * ca + lz * sa, z: k.z - lx * sa + lz * ca }; };
    const champ = (nom, saisons, b, cote, extra = {}) => ACTEURS.push({ type: 'champ', o: acteur(nom), k, ...parcelle(b, cote), an, saisons, ph: hache(k.c, k.r, 30 + b * 3 + cote) * 6, L: 0.36, y: 0.03, ...extra });
    champ('faucheur', [2], -1, -1, { geste: 'fauche', v: 0.12 }); champ('faucheur', [2], 0, -1, { geste: 'fauche', v: 0.1 });
    champ('semeur', [1], 1, 1, { geste: 'marche', v: 0.25 });
    champ('charrue', [3], 1, -1, { geste: 'marche', v: 0.12, L: 0.3 });
    for (let n = 0; n < 3; n++) champ('corbeau', [3, 0], -1 + n, 1, { geste: 'sautille', v: 0.6, L: 0.3, ph: n * 2.3 + i });
  });
  for (const p of PLAN) {
    const k = p.k;
    if (p.cle === 'ferme') {
      for (const [fx, fz, lng, b] of [[-3.6, 2.6, 4.4, 0], [2.2, 3.4, 4.6, 1]]) {
        const [x, z] = dansBat(k, fx, fz);
        ACTEURS.push({ type: 'champ', o: acteur(b ? 'charrue' : 'faucheur'), k, x, z, an: angB(k), saisons: b ? [3, 1] : [2], geste: b ? 'marche' : 'fauche', v: 0.1, L: lng * ECH_BAT, y: 0.045, ph: b * 2 });
      }
      for (let n = 0; n < 5; n++) { const [x, z] = dansBat(k, -3.4 + (hache(n, 1, 44) - 0.5) * 3, -0.2 + (hache(n, 2, 44) - 0.5) * 1.6); ACTEURS.push({ type: 'basse-cour', o: acteur('poule', ECH * 0.8), x, z, y: 0.025, ph: n * 1.3, r: 0.04 }); }
    }
    if (p.cle === 'bergerie') for (let n = 0; n < 6; n++) { const [x, z] = dansBat(k, (hache(n, 3, 45) - 0.5) * 7, 1 + (hache(n, 4, 45) - 0.5) * 6); ACTEURS.push({ type: 'basse-cour', o: acteur('mouton', ECH * 0.85), x, z, y: 0.025, ph: n * 1.7, r: 0.12, lent: true }); }
    if (p.cle === 'vignoble') for (let n = 0; n < 3; n++) {
      const [x, z] = dansBat(k, -0.9, (n - 1) * 1.7 + 0.85); // entre deux rangs de vigne
      ACTEURS.push({ type: 'champ', o: acteur('vendangeur'), k, x, z, an: angB(k), saisons: [3], geste: 'cueille', v: 0.06, L: 0.8, y: 0.03, ph: n * 2.1 });
      if (n < 2) ACTEURS.push({ type: 'champ', o: acteur('paysan'), k, x, z, an: angB(k), saisons: [1, 2], geste: 'cueille', v: 0.05, L: 0.8, y: 0.03, ph: n * 2.7 + 1 });
    }
  }
  // le train entre les deux usines (ère industrielle seulement)
  if (RAIL) ACTEURS.push({ type: 'train', o: AMB, voitures: [acteur('loco'), acteur('wagon'), acteur('wagon')], fumee: 0 });
}
function animAmbiance(dt, t) {
  for (const a of ACTEURS) {
    const o = a.o;
    if (a.type === 'char') {
      const P = a.c.pts2, u = (Math.sin(t * a.v + a.ph) + 1) / 2 * (P.length - 1.001), i = Math.floor(u), f = u - i, sens = Math.cos(t * a.v + a.ph) > 0 ? 1 : -1;
      const x = P[i][0] + (P[i + 1][0] - P[i][0]) * f, z = P[i][1] + (P[i + 1][1] - P[i][1]) * f;
      o.position.set(x, solEn(x, z) + 0.012, z); o.rotation.y = -Math.atan2((P[i + 1][1] - P[i][1]) * sens, (P[i + 1][0] - P[i][0]) * sens);
    } else if (a.type === 'vache') {
      o.position.set(a.k.x + a.x + Math.sin(t * 0.15 + a.ph) * 0.08, topDe(a.k), a.k.z + a.z); o.rotation.y = a.a + Math.sin(t * 0.2 + a.ph) * 0.8;
    } else if (a.type === 'faune') {
      // va-et-vient le long de la lisière, avec des haltes pour brouter ; le renard trotte
      const p = t * a.v + a.ph, u = Math.sin(p - 0.6 * Math.sin(p)) * 0.4, sens = Math.cos(p - 0.6 * Math.sin(p)) >= 0 ? 1 : -1;
      const saut = a.esp === 'renard' ? Math.abs(Math.sin(t * 7 + a.ph)) * 0.01 : 0;
      o.position.set(a.bx + a.ex * u, a.y + saut, a.bz + a.ez * u); o.rotation.y = Math.atan2(-a.ez * sens, a.ex * sens);
      o.visible = HEURE !== 'nuit';
    } else if (a.type === 'bateau') {
      const an = t * a.v + a.ph; o.position.set(a.k.x + Math.cos(an) * a.r, -0.16 + Math.sin(t * 1.3 + a.ph) * 0.006, a.k.z + Math.sin(an) * a.r); o.rotation.y = -an;
    } else if (a.type === 'champ') {
      // va-et-vient le long des sillons ; la faux balaie, le vendangeur se penche, le corbeau sautille
      const vis = a.saisons.includes(SAISON) && HEURE !== 'nuit' && !PLUIE() && !(a.k.rail && EPOQUE === 'industrie'); // tout le monde rentre quand il pleut
      o.visible = vis; if (!vis) continue;
      const p = t * a.v + a.ph, u = a.geste === 'sautille' ? Math.sin(Math.floor(p) * 2.7) : Math.sin(p), sens = a.geste === 'sautille' ? (Math.floor(p) % 2 ? 1 : -1) : Math.cos(p) >= 0 ? 1 : -1;
      const ca = Math.cos(a.an), sa = Math.sin(a.an), d = u * a.L / 2;
      o.position.set(a.x + d * ca, a.k.top + a.y + (a.geste === 'sautille' ? Math.abs(Math.sin(p * Math.PI)) * 0.012 : 0), a.z - d * sa);
      o.rotation.set(0, a.an + (sens < 0 ? Math.PI : 0) + (a.geste === 'fauche' ? Math.sin(t * 2.4 + a.ph) * 0.6 : 0), a.geste === 'cueille' ? -Math.max(0, Math.sin(t * 1.1 + a.ph * 3)) * 0.7 : 0);
    } else if (a.type === 'basse-cour') {
      // poules qui picorent, moutons qui broutent, chacun autour de sa place
      o.visible = HEURE !== 'nuit'; if (!o.visible) continue;
      const p = t * (a.lent ? 0.15 : 0.5) + a.ph, an = p + Math.sin(p * 0.7) * 2;
      o.position.set(a.x + Math.cos(an) * a.r * 0.5, solEn(a.x, a.z) + a.y, a.z + Math.sin(an) * a.r * 0.5);
      o.rotation.set(0, -an - Math.PI / 2, Math.sin(t * (a.lent ? 0.8 : 5) + a.ph) > 0.4 ? -0.5 : 0);
    } else if (a.type === 'train') {
      // navette : la locomotive tire à l'aller et pousse au retour ; arrêts au quai de chaque usine
      const vis = EPOQUE === 'industrie', ecart = 0.115, utile = RAIL.long - ecart * 2 - 0.04;
      const ph = t * 0.06, u = Math.max(-1, Math.min(1, Math.sin(ph) * 1.25)), tete = 0.02 + ecart * 2 + (u + 1) / 2 * utile;
      a.voitures.forEach((o, i) => { const p = RAIL.en(tete - i * ecart); o.visible = vis; o.position.set(p.x, p.y, p.z); o.rotation.y = p.cap; });
      if (vis && Math.abs(u) < 1 && (a.fumee -= dt) <= 0 && bouffees.length < 300) { a.fumee = 0.35; const p = RAIL.en(tete + 0.045); bouffees.push({ x: p.x, y: p.y + 0.1, z: p.z, age: 0.4, noire: true }); }
      continue;
    } else if (a.type === 'oiseau') {
      const Lc = COLS * SQ3 + 6, x = ((t * 0.5) % Lc) - 3, row = a.n - 3, ang = 0.5;
      o.position.set(x - Math.abs(row) * 0.12, 2.6 + Math.abs(row) * 0.03 + Math.sin(t * 9 + a.n) * 0.01, centre.z - 1.5 + row * 0.12 + x * 0.25);
      o.rotation.set(Math.sin(t * 9 + a.n * 0.7) * 0.4, -ang, 0); o.visible = HEURE !== 'nuit';
    }
  }
}

// ---------------------------------------------------------------- heure du jour (couleurs de web_power) et fenêtres allumées
let HEURE = 'jour';
const LUMIERE = {
  jour: { sol: 0xfff0d4, sI: 2.6, hemi: 0xeef7ff, hI: 1.5, fond: 0x1b211a, el: 1 },
  aube: { sol: 0xff9f5a, sI: 1.9, hemi: 0xd8d4e8, hI: 1.15, fond: 0x3b2717, el: 0.25 },
  nuit: { sol: 0x8ea6ff, sI: 0.55, hemi: 0x4d5c8a, hI: 0.75, fond: 0x090d1a, el: 0.6 },
};
const hemi = scene.children.find(o => o.isHemisphereLight);
const tache = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.6)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const FENETRES = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: tache, size: 0.32, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
FENETRES.frustumCulled = false; scene.add(FENETRES);
function majFenetres() {
  const pos = [], col = [];
  for (const p of PLAN) for (let i = 0; i < (!actif(p) ? 0 : p.cle === 'hotel' ? 9 : 4); i++) {
    pos.push(p.k.x + (hache(p.k.c, i, 80) - 0.5) * 0.7, p.k.top + 0.08 + hache(p.k.r, i, 90) * 0.2, p.k.z + (hache(p.k.c, i, 100) - 0.5) * 0.6);
    col.push(1, i % 3 ? 0.74 : 0.9, i % 3 ? 0.36 : 0.65);
  }
  FENETRES.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); FENETRES.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
function appliquerHeure() {
  const L = LUMIERE[HEURE];
  soleil.color.setHex(L.sol); soleil.intensity = L.sI; hemi.color.setHex(L.hemi); hemi.intensity = L.hI; scene.background.setHex(L.fond);
  FENETRES.visible = HEURE !== 'jour'; FENETRES.material.opacity = HEURE === 'nuit' ? 1 : 0.55;
}

// ---------------------------------------------------------------- caméra : glisser pour tourner, molette ou pincer pour zoomer
const vue = { lacet: 0.5, tangage: 0.78, d: 9.5, cible: new THREE.Vector3((centre.x * 2 + (ARMEE || centre).x) / 3, 0, (centre.z * 2 + (ARMEE || centre).z) / 3), auto: true }; // la ville et l'armée dans le cadre
const pointeurs = new Map(); let pince = 0;
toile.addEventListener('pointerdown', e => { pointeurs.set(e.pointerId, [e.clientX, e.clientY]); toile.setPointerCapture(e.pointerId); vue.auto = false; });
toile.addEventListener('pointermove', e => {
  if (!pointeurs.has(e.pointerId)) return;
  const [x0, y0] = pointeurs.get(e.pointerId); pointeurs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointeurs.size === 2) { const [a, b] = [...pointeurs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pince) vue.d = THREE.MathUtils.clamp(vue.d * pince / d, 4, 24); pince = d; return; }
  vue.lacet -= (e.clientX - x0) * 0.008; vue.tangage = THREE.MathUtils.clamp(vue.tangage + (e.clientY - y0) * 0.005, 0.45, 1.35);
});
const lacher = e => { pointeurs.delete(e.pointerId); pince = 0; };
toile.addEventListener('pointerup', lacher); toile.addEventListener('pointercancel', lacher);
toile.addEventListener('wheel', e => { e.preventDefault(); vue.d = THREE.MathUtils.clamp(vue.d * (1 + Math.sign(e.deltaY) * 0.1), 4, 24); vue.auto = false; }, { passive: false });

const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
let avant = performance.now(), t = 0;
function image(now) {
  const dt = Math.min(0.05, (now - avant) / 1000); avant = now; t += dt;
  const w = toile.clientWidth, h = toile.clientHeight;
  if (toile.width !== Math.round(w * renderer.getPixelRatio()) || toile.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  if (vue.auto && !reduit) vue.lacet += dt * 0.06;
  cam.position.set(vue.cible.x + Math.sin(vue.lacet) * Math.cos(vue.tangage) * vue.d, Math.sin(vue.tangage) * vue.d, vue.cible.z + Math.cos(vue.lacet) * Math.cos(vue.tangage) * vue.d);
  cam.lookAt(vue.cible);
  soleil.target.position.copy(vue.cible); { const el = LUMIERE[HEURE].el; soleil.position.set(vue.cible.x - 8 - (1 - el) * 6, 2 + 12 * el, vue.cible.z + 7); }
  if (!reduit) animAmbiance(dt, t);
  animVie2(dt, t, reduit);
  if (!reduit) {
    for (const a of ailes) a.rotation.z += dt * 1.2;
    for (const f of drapeaux) { const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(t * (4 + VENT * 8) - x * 30) * x * 0.25); } p.needsUpdate = true; }
    for (const c of cheminees) { c.prochain -= dt; if (c.prochain <= 0) { c.prochain = 0.7 + Math.random() * 0.6; if (bouffees.length < 300) bouffees.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, age: 0, noire: c.noire }); } }
  }
  let n = 0;
  for (let i = bouffees.length - 1; i >= 0; i--) { const b = bouffees[i]; b.age += dt; if (b.age > 3) { bouffees.splice(i, 1); continue; } b.y += dt * 0.18; b.x += dt * 0.05; }
  for (const b of bouffees) { const s = (0.6 + b.age * 0.7) * (b.k || 1); _m.compose(_p.set(b.x, b.y, b.z), _q, _s.set(s, s, s)); FUM.setColorAt(n, b.noire ? NOIRE : BLANCHE); FUM.setMatrixAt(n++, _m); }
  FUM.count = n; FUM.instanceMatrix.needsUpdate = true; if (FUM.instanceColor) FUM.instanceColor.needsUpdate = true;
  renderer.render(scene, cam);
  requestAnimationFrame(image);
}

// ---------------------------------------------------------------- réglages
function choisir(attr, fn) {
  const bs = document.querySelectorAll(`[${attr}]`);
  bs.forEach(b => b.addEventListener('click', () => { fn(b.getAttribute(attr)); bs.forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
}
// l'armée suit l'époque (on peut aussi choisir son palier à la main)
const PALIER_EPOQUE = { ancien: 0, lumieres: 2, empire: 3, industrie: 5 };
function majPalier(n) { PALIER = n; document.querySelectorAll('[data-palier]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.palier === n))); }
choisir('data-epoque', v => { EPOQUE = v; majPalier(PALIER_EPOQUE[v]); construirePlateau(); construireBatiments(); majFenetres(); });
choisir('data-palier', v => { PALIER = +v; construireBatiments(); });
choisir('data-heure', v => { HEURE = v; appliquerCiel(); });
choisir('data-meteo', v => { METEO = v; appliquerCiel(); });
choisir('data-armee', v => { MODE_ARMEE = v; });
document.querySelector('[data-fete]')?.addEventListener('click', e => { FETE = !FETE; e.currentTarget.setAttribute('aria-pressed', String(FETE)); });
choisir('data-saison', v => { SAISON = +v; construirePlateau(); construireBatiments(); });
construirePlateau(); construireBatiments();
requestAnimationFrame(image);
