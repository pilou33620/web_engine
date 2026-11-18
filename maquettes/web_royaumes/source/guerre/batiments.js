// ---------------------------------------------------------------- bâtiments de Royaumes dans le vocabulaire de web_power
// Même façon de faire que web_power (04-modeles.js) : dalle hexagonale, maisons à toit en prisme, arbres boule,
// quartiers en couronne, fermes ; mêmes unités (cases de 10, ramenées à 1 par ECH_BAT). Couleurs et étages selon l'époque.
const RW = 10, ECH_BAT = 0.1;
const EPOQUES = {
  ancien: { murs: [0xf1e4c4, 0xead7b0, 0xf6eedb], toits: [0xc9a14f, 0xb8903f, 0xa8553a, 0xc9a14f], h: 1, colomb: true, sol: 0xcdbb8e, pave: 0xd8c9a0 },
  lumieres: { murs: [0xf6eedb, 0xf1e2c2, 0xfaf6ee], toits: [0xd9573b, 0xe07a3a, 0xc4493a], h: 1.15, volets: true, sol: 0xd6c69c, pave: 0xe0d3b0 },
  empire: { murs: [0xe9e0ca, 0xddd3bc, 0xefe7d6], toits: [0x5d6f80, 0x58606c, 0xc4493a], h: 1.5, volets: true, sol: 0xd9d0b8, pave: 0xcfc6b0 },
  industrie: { murs: [0xb7634a, 0xa8553c, 0xc07a5a], toits: [0x58606c, 0x5d6f80, 0x6b6470], h: 1.7, sol: 0xc9c2b2, pave: 0xb5b0a4 },
};
const BOIS = 0x5b3a1e, PIERRE = 0xbcb6a8, ARDOISE = 0x5d6f80, VITRE = 0x3a4652;
let rnd = Math.random;
const entre = (a, b) => a + rnd() * (b - a);
const pick = l => l[rnd() * l.length | 0];
function toit(L, w, d, h, col, x, y, z, ry = 0) {
  // prisme triangulaire : base w en x, faîte de hauteur h, long de d en z
  const p = cyl(1, 1, d, 3); p.rotateX(Math.PI / 2); p.rotateZ(Math.PI); p.scale(w / SQ3, h / 1.5, 1); p.translate(0, h / 2 - h / 3, 0);
  put(L, p, col, x, y + h / 6, z, ry, 0.26);
}
const solQ = (L, col) => put(L, cyl(RW * 0.9, RW * 0.9, 0.25, 6), col, 0, 0.12, 0, 0, 0);
function arbre(L, x, z, s = 1, E) { put(L, cyl(0.25, 0.3, 1.2 * s, 5), 0x7a5233, x, 0.6 * s, z, 0, 0.2); put(L, sphere(1.3 * s, 0), SAISON === 3 ? pick([0xd9822b, 0xc9a13a]) : SAISON === 0 ? 0x9aa08a : 0x5fae3e, x, 2 * s, z, 0, 0.2); }
// une maison de l'époque : murs, toit en prisme, porte ; colombages en 1700, volets ensuite, cheminée qui fume parfois
function maison(L, ex, x, z, ry, s, E, mur = pick(E.murs), toitC = pick(E.toits)) {
  const h = 1.7 * s * E.h, w = 2.2 * s, d = 2 * s, c = Math.cos(ry), sn = Math.sin(ry);
  const loc = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  put(L, boite(w, h, d), mur, x, h / 2, z, ry);
  toit(L, w + 0.3 * s, d + 0.2 * s, 1.3 * s, toitC, x, h, z, ry);
  const [px, pz] = loc(-w * 0.22, d / 2 + 0.02); put(L, boite(0.45 * s, 0.8 * s, 0.08), BOIS, px, 0.4 * s, pz, ry, 0);
  for (const f of [1, -1]) for (const k of [-0.25, 0.25]) {
    if (f === 1 && k < 0) continue;
    const [wx, wz] = loc(k * w, f * (d / 2 + 0.02)); put(L, boite(0.4 * s, 0.4 * s, 0.08), VITRE, wx, h * 0.55, wz, ry, 0);
    if (E.volets) for (const v of [-1, 1]) { const [vx, vz] = loc(k * w + v * 0.3 * s, f * (d / 2 + 0.04)); put(L, boite(0.14 * s, 0.42 * s, 0.06), toitC === 0xc9a14f ? 0x5c7a4a : 0x4a6a7a, vx, h * 0.55, vz, ry, 0); }
  }
  if (E.colomb) for (const f of [1, -1]) { const [bx, bz] = loc(0, f * (d / 2 + 0.03)); put(L, boite(w, 0.12, 0.06), BOIS, bx, h * 0.5, bz, ry, 0); for (const k of [-0.48, 0.48]) { const [cx, cz] = loc(k * w, f * (d / 2 + 0.03)); put(L, boite(0.12, h, 0.06), BOIS, cx, h / 2, cz, ry, 0); } }
  if (rnd() < 0.55) { const [cx, cz] = loc(w * 0.28, -d * 0.15); put(L, boite(0.35 * s, 1 * s, 0.35 * s), EPOQUE === 'industrie' ? 0x8a3f2c : PIERRE, cx, h + 0.7 * s, cz, ry, 0.15); ex.fum.push([cx, h + 1.3 * s, cz, false]); }
}
const meule = (L, x, z) => put(L, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 1.1, 0.9), 0xe3c75b, x, 0, z, 0, 0.15);
function cloture(L, r, n = 14, dz = 0) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(L, boite(0.25, 0.9, 0.25), 0x8a6a4a, Math.cos(a) * r, 0.45, Math.sin(a) * r + dz, 0, 0); } put(L, new THREE.TorusGeometry(r, 0.1, 3, 28).rotateX(Math.PI / 2), 0x8a6a4a, 0, 0.75, dz, 0, 0); }
function eglise(L, ex, E, x = 0, z = 0, g = 1) {
  const m = EPOQUE === 'industrie' ? 0xcfc6b0 : 0xefe3c6;
  put(L, boite(2.6 * g, 3.2 * g, 4.4 * g), m, x, 1.6 * g, z + 0.3 * g); toit(L, 3 * g, 4.6 * g, 1.5 * g, 0x8a5a44, x, 3.2 * g, z + 0.3 * g);
  put(L, boite(1.5 * g, 5.4 * g, 1.5 * g), m, x, 2.7 * g, z - 2.4 * g); put(L, cone(1.2 * g, 3.2 * g, 4), ARDOISE, x, 7 * g, z - 2.4 * g, Math.PI / 4);
  put(L, boite(0.12, 0.8 * g, 0.12), 0xf2c23a, x, 9 * g, z - 2.4 * g, 0, 0);
  for (const k of [-1, 0, 1]) put(L, boite(0.08, 0.9 * g, 0.5 * g), 0x6ab0e8, x + 1.32 * g, 1.8 * g, z + 0.3 * g + k * 1.2 * g, 0, 0);
}
const DRAP = (ex, x, y, z) => ex.drap.push([x, y, z]);
function mat(L, ex, x, z, h) { put(L, boite(0.25, h, 0.25), 0x4a3420, x, h / 2, z, 0, 0.1); DRAP(ex, x, h - 0.8, z); }

const BATR = {
  // ---- habitat : les quartiers de web_power
  maison(L, ex, E) { solQ(L, 0x9fc46a); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rnd() * 0.3, l = i % 3 === 0 ? 2 : 5.6; maison(L, ex, Math.cos(a) * l, Math.sin(a) * l, a + Math.PI / 2, entre(0.95, 1.15), E); } arbre(L, 3, 1.2); arbre(L, -2.5, -1.8, 0.9); },
  cabane(L, ex, E) { solQ(L, 0xa9c66e); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; maison(L, ex, Math.cos(a) * 4.4, Math.sin(a) * 4.4, a + Math.PI / 2, 0.9, E); } meule(L, 0, 0); arbre(L, 1.5, 3, 0.9); },
  // la mairie au centre de la ville : beffroi en 1700, horloge aux Lumières, coupole dorée sous l'Empire (comme le centre de web_power), campanile ensuite
  hotel(L, ex, E) {
    solQ(L, E.pave);
    const m = EPOQUE === 'industrie' ? 0xd9c9a8 : 0xf3e6c8;
    put(L, boite(4.2, 2.8 * E.h, 3.2), m, 0, 1.4 * E.h, 0); toit(L, 4.6, 3.6, 1.4, pick(E.toits), 0, 2.8 * E.h, 0);
    if (EPOQUE === 'ancien') { put(L, boite(1.5, 6, 1.5), PIERRE, 2.6, 3, -1); put(L, cone(1.25, 2.6, 4), E.toits[2], 2.6, 7.3, -1, Math.PI / 4); }
    else if (EPOQUE === 'lumieres') { put(L, boite(1.4, 1.6, 1.4), m, 0, 3.2 * E.h + 1.6, 0); put(L, cyl(0.45, 0.45, 0.1, 12).rotateX(Math.PI / 2), 0xf7f3e6, 0, 3.2 * E.h + 1.8, 0.72, 0, 0); put(L, new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), ARDOISE, 0, 3.2 * E.h + 2.4, 0); }
    else if (EPOQUE === 'empire') { put(L, cyl(1.2, 1.2, 1.2, 10), m, 0, 3.4 * E.h, 0); put(L, new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xffc94d, 0, 4 * E.h, 0); for (let i = 0; i < 4; i++) put(L, cyl(0.2, 0.2, 2.4, 8), 0xfbf6ec, -1.5 + i, 1.2, 1.8, 0, 0.1); }
    else { put(L, boite(1.6, 8, 1.6), m, 0, 4, -1); put(L, cone(1.3, 2.4, 4), ARDOISE, 0, 9.2, -1, Math.PI / 4); for (const [x, z] of [[-3.2, 2.4], [3.2, 2.2], [-3.4, -2.2], [3.4, -2.4]]) { put(L, boite(0.15, 2.6, 0.15), 0x2b2b30, x, 1.3, z, 0, 0.06); put(L, boite(0.42, 0.42, 0.42), 0xffe9a0, x, 2.8, z, 0, 0.06); put(L, cone(0.35, 0.3, 4), 0x2b2b30, x, 3.15, z, Math.PI / 4, 0.05); } } // réverbères
    for (const [x, z] of [[-5, -3], [-1.5, -5.6], [3.2, -4.6], [5.5, -0.5], [4, 4], [-0.5, 5.5], [-4.7, 3.6], [-6, 0.5]]) maison(L, ex, x, z, Math.atan2(x, z), 0.85, E);
    put(L, cyl(0.7, 0.7, 0.6, 10), PIERRE, 1.8, 0.3, 2.6, 0, 0.12); put(L, cyl(0.55, 0.55, 0.1, 10), 0x5fc0ee, 1.8, 0.62, 2.6, 0, 0);
    mat(L, ex, -2.4, 1.8, 6);
  },
  eglise(L, ex, E) { solQ(L, 0xa9c66e); eglise(L, ex, E, 0, 0.6, 1.25); arbre(L, -4, 2.5, 1); arbre(L, 4, -3, 0.9); for (let i = 0; i < 5; i++) put(L, boite(0.5, 0.7, 0.2), PIERRE, 3.5 + (i % 2) * 1.2, 0.35, 1 + i * 0.8, 0, 0); },
  // ---- fermes de web_power ; pas de silo avant l'ère industrielle : des meules
  ferme(L, ex, E) {
    put(L, boite(3.2, 2, 2.6), pick(E.murs), -3.4, 1, -3); toit(L, 3.6, 2.9, 1.4, pick(E.toits), -3.4, 2, -3);
    put(L, boite(3.6, 2.8, 4), 0xb8453a, 1.2, 1.4, -3.2); toit(L, 4, 4.4, 1.8, 0x6b3a2e, 1.2, 2.8, -3.2); put(L, boite(1.3, 1.8, 0.2), 0xf3ead6, 1.2, 0.9, -1.15, 0, 0);
    if (EPOQUE === 'industrie') { put(L, cyl(1, 1, 4.8, 10), 0xd9d5c9, 4.3, 2.4, -1.4); put(L, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a9aa4, 4.3, 4.8, -1.4); }
    else { meule(L, 4.3, -1.4); meule(L, 5, 0.6); }
    const C = SAISON === 0 ? [0xeef2f6, 0xe4eaef] : SAISON === 1 ? [0x9fd35a, 0x86c24a, 0xa9c457] : SAISON === 3 ? [0xc9a35a, 0xa8803f, 0x9b7d4a] : [0xe3c75b, 0xd6b24a, 0xa9c457, 0x9fbf4f];
    for (const [x, z, w, d] of [[-3.6, 2.6, 5, 3.4], [2.2, 3.4, 5.2, 2.8], [-0.4, 0.3, 4, 1.6]]) { put(L, boite(w, 0.45, d), pick(C), x, 0.22, z, 0, 0.12); for (let k = -1; k <= 1; k++) put(L, boite(w * 0.9, 0.12, 0.18), 0x8f7a3a, x, 0.5, z + k * d / 3.2, 0, 0); }
    arbre(L, 5.8, 1.6, 0.8);
  },
  bergerie(L, ex, E) {
    put(L, boite(6, 2.2, 2.8), 0xb8453a, -1.5, 1.1, -3.4); toit(L, 3.2, 6.4, 1.3, 0x6b3a2e, -1.5, 2.2, -3.4, Math.PI / 2);
    put(L, boite(2.6, 1.8, 2.2), pick(E.murs), 4, 0.9, -3.6); toit(L, 2.9, 2.5, 1.1, pick(E.toits), 4, 1.8, -3.6);
    cloture(L, 7.4, 14, 1); meule(L, 2.5, 3.2);
  },
  vignoble(L, ex, E) {
    put(L, cyl(RW * 0.86, RW * 0.9, 0.3, 6), 0xa99a6a, 0, 0.15, 0, 0, 0);
    const feuille = SAISON === 0 ? 0x8b7d6b : SAISON === 3 ? 0xb8502c : SAISON === 1 ? 0x9fd35a : 0x5e9a3c;
    for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++) { const x = c * 1.9, z = r * 1.7; if (Math.hypot(x, z) > 6.8 || (x > 2 && z > 2)) continue; put(L, boite(0.15, 1.2, 0.15), 0x6b4a2a, x, 0.6, z, 0, 0); put(L, sphere(0.6, 0), feuille, x, 1.3, z, 0, 0.1); }
    maison(L, ex, 4.6, 4, 0.6, 0.8, E);
  },
  moulin(L, ex, E) {
    solQ(L, 0xb3c27a);
    const tour = new THREE.LatheGeometry([[1.9, 0], [1.7, 3], [1.4, 5.6]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    put(L, tour, EPOQUE === 'industrie' ? 0xd9c9a8 : 0xf1e4c4, 0, 0, 0, 0, 0.26); put(L, cone(1.9, 2, 10), pick(E.toits), 0, 6.6, 0);
    put(L, boite(0.7, 1.3, 0.2), BOIS, 0, 0.65, 1.85, 0, 0); ex.ailes.push([0, 5, 2.1]);
    for (let i = 0; i < 3; i++) put(L, sphere(0.45, 1), 0xe9e2d0, -1.5 + i * 0.8, 0.4, 3.2, 0, 0.1);
    maison(L, ex, -4.6, -2.6, 0.6, 0.75, E); meule(L, 4, 3);
  },
  caserne(L, ex, E) {
    solQ(L, E.pave);
    const m = EPOQUE === 'industrie' ? 0xb7634a : PIERRE;
    put(L, boite(7.4, 2.8 * E.h, 3), m, 0, 1.4 * E.h, -2.6); toit(L, 3.4, 7.8, 1.3, pick(E.toits), 0, 2.8 * E.h, -2.6, Math.PI / 2);
    for (let i = 0; i < 5; i++) put(L, boite(0.6, 0.7, 0.08), VITRE, -2.8 + i * 1.4, 1.6 * E.h, -1.05, 0, 0);
    for (const x of [-4.5, 4.5]) { put(L, boite(1, 1.8, 1), 0xe9e2d0, x, 0.9, 3.6); put(L, cone(0.8, 0.8, 4), ROYAUME, x, 2.2, 3.6, Math.PI / 4, 0.12); }
    for (let i = 0; i < 4; i++) { put(L, boite(0.18, 1.6, 0.18), 0x8b5a2b, -2 + i * 1.3, 0.8, 1.5, 0, 0); put(L, boite(0.8, 0.3, 0.18), 0xc9b27a, -2 + i * 1.3, 1.3, 1.5, 0, 0); }
    mat(L, ex, 3, 0.5, 7);
  },
  forge(L, ex, E) { solQ(L, 0xb3ad9e); maison(L, ex, -1, -1.6, 0, 1.25, E); put(L, boite(0.8, 3.6, 0.8), PIERRE, 1.4, 3.4, -2.4); ex.fum.push([1.4, 5.4, -2.4, true]); put(L, boite(1.2, 0.5, 0.6), 0x444444, 2.4, 0.9, 2.2); put(L, boite(0.5, 0.7, 0.4), 0x555555, 2.4, 0.35, 2.2, 0, 0); put(L, boite(2.4, 1.2, 1.6), 0x8a6a4a, -2.6, 0.6, 3, 0.3); },
  taverne(L, ex, E) { solQ(L, 0xc9b98e); maison(L, ex, -0.6, -1, 0, 1.45, E); put(L, boite(0.18, 2.4, 0.18), 0x8b5a2b, 3, 1.2, 2.4, 0, 0); put(L, boite(1.4, 0.18, 0.18), 0x8b5a2b, 3.6, 2.4, 2.4, 0, 0); put(L, boite(1, 0.7, 0.1), 0xd9a43a, 3.9, 1.85, 2.4, 0, 0.08); for (const [x, z] of [[-3.4, 3], [-2.4, 3.6], [-3, 4.4]]) put(L, cyl(0.5, 0.5, 1.1, 10), 0x8a5a2b, x, 0.55, z, 0, 0.12); },
  marche(L, ex, E) {
    solQ(L, E.pave);
    const cs = [0xd94f4f, 0x4f9fd9, 0xe0b040, 0x5fbf5f];
    [[-3.2, -2.6], [3, -2.8], [-3, 3], [3.2, 2.8]].forEach(([x, z], i) => { put(L, boite(3, 1, 2.2), 0x8b5a2b, x, 0.5, z); for (const dx of [-1.3, 1.3]) put(L, boite(0.18, 2.2, 0.18), 0x8b5a2b, x + dx, 1.1, z + 0.9, 0, 0); toit(L, 3.6, 2.8, 0.9, cs[i], x, 2.2, z); put(L, boite(0.8, 0.8, 0.8), 0xb07a45, x + 1, 0.4, z + 1.8, 0.4, 0.1); });
    put(L, cyl(0.9, 1, 0.8, 10), PIERRE, 0, 0.4, 0, 0, 0.12); put(L, cyl(0.7, 0.7, 0.1, 10), 0x5fc0ee, 0, 0.82, 0, 0, 0);
  },
  tour(L, ex, E) { solQ(L, 0xb3c27a); put(L, cyl(1.5, 1.7, 8, 10), PIERRE, 0, 4, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(L, boite(0.5, 0.6, 0.5), PIERRE, Math.cos(a) * 1.45, 8.3, Math.sin(a) * 1.45, -a, 0.1); } put(L, cone(1.9, 2.6, 10), pick(E.toits), 0, 9.6, 0); mat(L, ex, 0, 0, 13.5); arbre(L, 4, 3, 0.9); },
  mine(L, ex, E) {
    solQ(L, 0xa9a394);
    const butte = sphere(5.4, 1); butte.scale(1, 0.55, 0.8); put(L, butte, 0x8a7f6a, -1.5, 0, -2.6, 0, 0.2);
    put(L, boite(1.9, 2.1, 0.4), 0x1a1a1a, -1.5, 1.05, 1.1, 0, 0); for (const x of [-2.6, -0.4]) put(L, boite(0.3, 2.5, 0.3), 0x6b4a2a, x, 1.25, 1.35, 0, 0.08); put(L, boite(2.8, 0.35, 0.45), 0x6b4a2a, -1.5, 2.55, 1.35, 0, 0.08);
    for (const o of [-0.35, 0.35]) put(L, boite(0.08, 0.06, 5.6), 0x8a8f96, -1.5 + o, 0.3, 4, 0, 0); for (let z = 1.6; z < 6.8; z += 0.6) put(L, boite(1, 0.06, 0.2), 0x5b3a1e, -1.5, 0.26, z, 0, 0);
    put(L, cone(1.6, 1.4, 7), EPOQUE === 'industrie' ? 0x2b2b2b : 0x6a5a4a, 3, 0.7, 3, 0, 0.12); maison(L, ex, 3.6, -2.6, 0.4, 0.85, E);
  },
  pecheur(L, ex, E) { solQ(L, 0xd9cfa0); maison(L, ex, -2.6, -1.5, 0.3, 1, E); for (const [x, z] of [[-3.6, 3], [-2.6, 3.6]]) put(L, cyl(0.5, 0.5, 1.1, 10), 0x8a5a2b, x, 0.55, z, 0, 0.12); put(L, boite(5.6, 0.3, 1.4), 0x8b5a2b, 3.6, 0.3, 0.4, 0, 0.1); for (const x of [1.4, 3.6, 5.8]) put(L, boite(0.25, 1.4, 0.25), 0x5b3a1e, x, -0.2, 1.2, 0, 0); for (const x of [0.4, 2.4]) put(L, boite(0.12, 1.8, 0.12), 0x8b5a2b, x, 0.9, -3, 0, 0); put(L, boite(2.2, 1.2, 0.05), 0xd9d2bc, 1.4, 1.2, -3, 0, 0); },
  bucheron(L, ex, E) {
    solQ(L, 0xb3c27a); maison(L, ex, -2.4, -2.4, 0.3, 1, E);
    for (let i = 0; i < 5; i++) { const b = cyl(0.45, 0.45, 3.4, 8); b.rotateZ(Math.PI / 2); put(L, b, 0xa0703f, 3 + (i % 2) * 0.2, 0.45 + (i >> 1) * 0.8, 1.6 + (i % 2) * 0.9, 0.3, 0.12); }
    for (const [x, z] of [[-1, 3.6], [1, 4.6], [-4.6, 2]]) put(L, cyl(0.5, 0.6, 0.6, 7), 0xb98a55, x, 0.3, z, 0, 0.1);
    for (const [x, z] of [[4.6, -3], [6, -1], [3, -4.8]]) { put(L, cyl(0.3, 0.4, 1.4, 5), 0x7a5233, x, 0.7, z); put(L, cone(1.6, 2.6, 6), 0x3e7f34, x, 2.4, z); put(L, cone(1.2, 2, 6), 0x4c9440, x, 3.6, z); }
  },
  // ---- ère industrielle : les usines de web_power (hall de brique, sheds en dents de scie, grandes cheminées qui fument noir)
  usine(L, ex, E) {
    solQ(L, 0xb3ad9e);
    for (const [x, z] of [[-3.4, -2.8], [2.6, -3.2], [-2.4, 3]]) {
      put(L, boite(4.4, 2.2, 3.4), 0xb7634a, x, 1.1, z);
      for (let k = 0; k < 3; k++) { const sh = cyl(0.9, 0.9, 3.6, 3); sh.rotateX(Math.PI / 2); sh.rotateZ(Math.PI / 2 + 0.5); put(L, sh, ARDOISE, x - 1.45 + k * 1.45, 2.6, z, 0, 0.12); }
      for (let k = 0; k < 3; k++) put(L, boite(0.7, 0.8, 0.08), 0xf2d27a, x - 1.45 + k * 1.45, 1, z + 1.72, 0, 0);
    }
    put(L, cyl(0.6, 0.8, 9, 8), 0xb0644c, 4.4, 4.5, 2.6); put(L, cyl(0.7, 0.7, 0.5, 8), 0x5a2f24, 4.4, 9, 2.6); ex.fum.push([4.4, 9.5, 2.6, true]);
    put(L, cyl(1.5, 1.5, 3, 12), 0xe8e4da, 1.6, 1.5, 4.6); put(L, cone(1.8, 1.6, 7), 0x2f2c2a, -5.6, 0.8, -0.4);
  },
  filature(L, ex, E) {
    solQ(L, 0xa9a394);
    put(L, boite(6.4, 3.4 * 1.3, 3.6), 0xa8553c, -0.8, 1.7 * 1.3, 0.4); toit(L, 4, 6.8, 1.6, 0x5a4741, -0.8, 3.4 * 1.3, 0.4, Math.PI / 2);
    for (let e = 0; e < 2; e++) for (let k = 0; k < 4; k++) put(L, boite(0.8, 0.9, 0.1), 0xf2d27a, -3.2 + k * 1.6, 1.2 + e * 1.8, 2.25, 0, 0);
    put(L, boite(1.6, 2.2, 0.1), 0x4a3420, -0.8, 1.1, 2.26, 0, 0);
    put(L, cyl(0.55, 0.8, 10, 8), 0x8a3f2c, 3.6, 5, 2.6); put(L, cyl(0.7, 0.7, 0.5, 8), 0x5a2f24, 3.6, 10, 2.6); ex.fum.push([3.6, 10.6, 2.6, true]);
    for (let i = 0; i < 4; i++) put(L, boite(1, 1, 1), 0xe9e2d0, -4.6 + (i % 2) * 1.1, 0.5 + (i >> 1), 4.4, 0, 0.1);
    put(L, cone(1.8, 1.6, 7), 0x2f2c2a, 3.6, 0.8, -3.4);
  },
  haut_fourneau(L, ex, E) {
    solQ(L, 0x9c968a);
    const four = new THREE.LatheGeometry([[2.4, 0], [2.6, 2.4], [1.8, 6.4], [1.4, 7.4]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    put(L, four, 0x8a4a36, -1.6, 0, -1, 0, 0.26); put(L, cyl(1.5, 1.5, 0.8, 12), 0x5a4741, -1.6, 7.8, -1); ex.fum.push([-1.6, 8.6, -1, true]);
    put(L, boite(1.4, 1, 0.2), 0xff8a1c, -1.6, 0.9, 1.5, 0, 0);
    const pont = boite(0.6, 0.5, 6.4); pont.rotateX(0.75); put(L, pont, 0x6b6f75, 2, 4, -1.2, 0, 0.1);
    put(L, boite(4.6, 2.6, 3), 0xb7634a, 2.6, 1.3, 3.2); toit(L, 3.4, 5, 1.2, ARDOISE, 2.6, 2.6, 3.2, Math.PI / 2);
    put(L, cyl(0.6, 0.8, 11, 8), 0xb0644c, 5.4, 5.5, -2.6); ex.fum.push([5.4, 11.2, -2.6, true]);
    put(L, cone(2.4, 2, 7), 0x2f2c2a, -4.8, 1, 3.6); put(L, cone(1.6, 1.4, 7), 0xa5532a, 0.4, 0.7, -5);
  },
};

// ---- armées : une icône fixe dont l'allure suit le palier technologique (même code que maquettes/armees.html)
const PEAU = 0xf0c9a0, BLANC = 0xf2efe6, NOIR = 0x1f1f1f, ACIER = 0xd9d9d9, BRONZE = 0xb08d57, FER = 0x2b2b2b, GARANCE = 0xb8322a, CHEVAL = 0x6b4226;
const PALIERS = [
  { date: '1700 · au départ', nom: 'Mousquets et piques', tete: 'tricorne', habit: 'long', piques: true, baionnette: false, cav: 'dragon', art: 'ancienne',
    notes: ['Mousquetaires en justaucorps long et tricorne, mousquet sans baïonnette.', 'Deux piquiers au centre de la ligne, longues piques dressées.', 'Dragons à cheval, tricorne.', 'Lourds canons de bronze sur affûts rouges à grandes roues.'] },
  { date: '1703 · Fusil à silex et baïonnette', nom: 'Fini les piques', tete: 'tricorne', habit: 'long', piques: false, baionnette: true, grenadiers: true, cav: 'dragon', art: 'ancienne',
    notes: ['Les piques disparaissent : toute la ligne a le fusil et la baïonnette.', 'Deux grenadiers en bonnet à plaque au bout de la ligne.', 'Cavalerie et canons inchangés.'] },
  { date: '1765 · Système Gribeauval', nom: 'Artillerie moderne', tete: 'tricorne', habit: 'long', piques: false, baionnette: true, grenadiers: true, cav: 'dragon', art: 'gribeauval',
    notes: ['Canons plus courts et plus légers, affûts peints en vert olive.', 'Avant-train attelé de deux chevaux derrière chaque pièce.', 'Infanterie et cavalerie inchangées.'] },
  { date: '1793 · Levée en masse', nom: 'Les armées de la nation', tete: 'bicorne', habit: 'court', piques: false, baionnette: true, grenadiers: true, cav: 'cuirassier', hussard: true, art: 'gribeauval',
    notes: ['Fusiliers en habit court et bicorne, guêtres blanches.', 'Cuirassiers : casque à crinière et cuirasse d\'acier.', 'Un hussard en colback et pelisse rejoint la cavalerie.'] },
  { date: '1825 · Fusil à percussion', nom: 'Capotes et pantalons garance', tete: 'shako', habit: 'capote', pantalon: GARANCE, piques: false, baionnette: true, chasseurs: true, cav: 'cuirassier', lanciers: true, art: 'gribeauval',
    notes: ['Shako, capote longue et pantalon rouge garance.', 'Deux chasseurs à pied vert sombre déployés en tirailleurs devant la ligne.', 'Un lancier à fanion dans la cavalerie.'] },
  { date: '1832 · Chemin de fer', nom: 'Le train des équipages', tete: 'kepi', habit: 'capote', pantalon: GARANCE, piques: false, baionnette: true, chasseurs: true, cav: 'cuirassier', lanciers: true, art: 'gribeauval', fourgon: true,
    notes: ['Le képi remplace le shako.', 'Un fourgon bâché du train des équipages suit l\'armée.', 'Le reste comme au palier précédent.'] },
];

function tete(L, P, x, y, z, couleurRoy) {
  if (P.tete === 'bicorne') put(L, boite(0.95, 0.35, 0.3), NOIR, x, y + 0.1, z, 0, 0.05);
  else if (P.tete === 'shako') { put(L, cyl(0.3, 0.26, 0.5, 8), NOIR, x, y + 0.2, z, 0, 0.05); put(L, boite(0.1, 0.2, 0.1), couleurRoy, x, y + 0.52, z + 0.18, 0, 0); }
  else if (P.tete === 'kepi') { put(L, cyl(0.24, 0.28, 0.32, 8), couleurRoy, x, y + 0.12, z, 0, 0.05); put(L, boite(0.4, 0.04, 0.2), NOIR, x, y, z + 0.2, 0, 0); }
  else put(L, cone(0.55, 0.3, 3), NOIR, x, y + 0.1, z, Math.PI, 0.05); // tricorne
}
function fantassin(L, P, x, z, roy, genre = 'ligne') {
  const habit = genre === 'chasseur' ? 0x2f4a32 : roy, pant = P.pantalon || BLANC;
  for (const dx of [-0.16, 0.16]) put(L, boite(0.24, 0.9, 0.3), pant, x + dx, 0.45, z, 0, 0.05);
  const long = P.habit === 'long' || P.habit === 'capote';
  put(L, boite(0.75, long ? 1.25 : 0.95, 0.5), P.habit === 'capote' && genre !== 'chasseur' ? 0x5a6a86 : habit, x, long ? 1.2 : 1.35, z, 0, 0.07);
  if (P.habit === 'capote' && genre !== 'chasseur') put(L, boite(0.78, 0.25, 0.52), roy, x, 1.75, z, 0, 0); // col et épaulettes à la couleur du royaume
  put(L, boite(0.8, 0.1, 0.55), BLANC, x, 1.15, z, 0, 0);
  put(L, sphere(0.28, 1), PEAU, x, 2.1, z, 0, 0.05);
  if (genre === 'grenadier') { put(L, cone(0.3, 0.8, 4), roy, x, 2.65, z, Math.PI / 4, 0.05); put(L, boite(0.4, 0.5, 0.06), BRONZE, x, 2.55, z + 0.2, 0, 0); }
  else if (genre === 'piquier') { tete(L, P, x, 2.32, z, roy); put(L, boite(0.08, 4.6, 0.08), BOIS, x + 0.4, 2.3, z + 0.15, 0, 0); put(L, cone(0.1, 0.4, 4), ACIER, x + 0.4, 4.8, z + 0.15, 0, 0); return; }
  else tete(L, P, x, 2.32, z, roy);
  put(L, boite(0.09, 2.2, 0.09), BOIS, x + 0.42, 1.5, z + 0.18, 0, 0);
  if (P.baionnette) put(L, boite(0.04, 0.45, 0.04), ACIER, x + 0.42, 2.82, z + 0.18, 0, 0);
}
function cheval(L, x, z, robe = CHEVAL) {
  put(L, boite(0.7, 0.85, 1.9), robe, x, 1.35, z, 0, 0.07); put(L, boite(0.4, 0.9, 0.45), robe, x, 1.95, z + 0.95, 0, 0.05); put(L, boite(0.35, 0.35, 0.7), robe, x, 2.3, z + 1.25, 0, 0.05);
  for (const [dx, dz] of [[-0.22, -0.7], [0.22, -0.7], [-0.22, 0.7], [0.22, 0.7]]) put(L, boite(0.16, 0.95, 0.16), 0x4a2c18, x + dx, 0.47, z + dz, 0, 0);
  put(L, boite(0.12, 0.6, 0.12), 0x2a1d14, x, 1.5, z - 1.05, 0, 0);
}
function cavalier(L, P, x, z, roy, genre) {
  cheval(L, x, z, genre === 'hussard' ? 0x8a5a32 : CHEVAL);
  const habit = genre === 'hussard' ? 0x3f6f9a : roy;
  put(L, boite(0.6, 0.8, 0.45), habit, x, 2.15, z - 0.1, 0, 0.06);
  put(L, sphere(0.25, 1), PEAU, x, 2.8, z - 0.1, 0, 0.05);
  if (genre === 'cuirassier') { put(L, boite(0.64, 0.55, 0.5), ACIER, x, 2.25, z - 0.1, 0, 0.05); put(L, new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), ACIER, x, 2.95, z - 0.1, 0, 0.04); put(L, boite(0.08, 0.3, 0.55), NOIR, x, 3.2, z - 0.2, 0, 0); }
  else if (genre === 'hussard') { put(L, cyl(0.28, 0.3, 0.5, 8), NOIR, x, 3.15, z - 0.1, 0, 0.05); put(L, boite(0.3, 0.6, 0.5), GARANCE, x - 0.42, 2.2, z - 0.1, 0, 0.04); }
  else if (genre === 'lancier') { tete(L, P, x, 3, z - 0.1, roy); put(L, boite(0.07, 4, 0.07), BOIS, x + 0.42, 3, z + 0.1, 0, 0); put(L, boite(0.04, 0.35, 0.6), roy, x + 0.42, 4.6, z + 0.45, 0, 0); put(L, boite(0.04, 0.17, 0.6), BLANC, x + 0.42, 4.37, z + 0.45, 0, 0); }
  else tete(L, P, x, 3, z - 0.1, roy);
  if (genre !== 'lancier') put(L, boite(0.06, 0.06, 1.1), ACIER, x + 0.4, 2.3, z + 0.35, 0, 0);
}
function canon(L, P, x, z) {
  const gri = P.art === 'gribeauval';
  const fut = cyl(gri ? 0.2 : 0.24, gri ? 0.3 : 0.36, gri ? 2 : 2.9, 10); fut.rotateX(Math.PI / 2 - 0.12); put(L, fut, BRONZE, x, 1, z + (gri ? 0.3 : 0.5), 0, 0.06);
  const affut = gri ? 0x6b7a4a : 0x8a3a2a;
  put(L, boite(0.6, 0.35, 1.9), affut, x, 0.6, z - 0.35, 0, 0.05);
  for (const dx of [-0.58, 0.58]) { const r = cyl(gri ? 0.55 : 0.68, gri ? 0.55 : 0.68, 0.14, 12); r.rotateZ(Math.PI / 2); put(L, r, gri ? affut : 0x4a3420, x + dx, gri ? 0.55 : 0.68, z, 0, 0.05); }
  if (gri) { // avant-train attelé
    put(L, boite(1.1, 0.5, 0.8), affut, x, 0.75, z - 2.1, 0, 0.05);
    for (const dx of [-0.6, 0.6]) { const r = cyl(0.45, 0.45, 0.12, 12); r.rotateZ(Math.PI / 2); put(L, r, affut, x + dx, 0.45, z - 2.1, 0, 0.05); }
    put(L, boite(0.08, 0.08, 1.4), BOIS, x, 0.7, z - 2.9, 0, 0);
    for (const dx of [-0.45, 0.45]) cheval(L, x + dx, z - 4.3);
  } else for (let i = 0; i < 3; i++) put(L, sphere(0.16, 0), FER, x - 0.3 + i * 0.3, 0.16, z - 1.7, 0, 0);
}
function fourgon(L, x, z) {
  put(L, boite(1.5, 0.5, 2.6), 0x8a6a4a, x, 0.9, z, 0, 0.05);
  put(L, new THREE.CylinderGeometry(0.78, 0.78, 2.6, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), 0xe9e2d0, x, 1.15, z, 0, 0.05);
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const r = cyl(0.42, 0.42, 0.12, 12); r.rotateZ(Math.PI / 2); put(L, r, 0x4a3420, x + dx, 0.42, z + dz, 0, 0.05); }
  cheval(L, x, z + 2.7);
}
function armee(P, roy) {
  const L = lot();
  // la ligne, devant : piquiers au centre au départ, grenadiers au bout ensuite
  for (let i = 0; i < 6; i++) fantassin(L, P, -3.4 + i * 1.15, 2.4, roy, P.piques && (i === 2 || i === 3) ? 'piquier' : P.grenadiers && i === 5 ? 'grenadier' : 'ligne');
  if (P.chasseurs) { fantassin(L, P, -2.6, 4.6, roy, 'chasseur'); fantassin(L, P, 1.4, 5.0, roy, 'chasseur'); } // tirailleurs en avant
  // la cavalerie, derrière
  const cav = [P.cav, P.hussard ? 'hussard' : P.lanciers ? 'lancier' : P.cav, P.cav];
  cav.forEach((g, i) => cavalier(L, P, -2.6 + i * 2, -2.8, roy, g));
  // l'artillerie, sur le flanc
  canon(L, P, 5.4, 1.8); canon(L, P, 7.2, 1.2);
  fantassin(L, P, 4.4, 0.4, roy); fantassin(L, P, 6.4, 0, roy);
  // le drapeau et l'officier
  put(L, boite(0.14, 4.6, 0.14), 0x4a3420, -0.2, 2.3, 0.4, 0, 0.05);
  put(L, boite(0.05, 1.1, 1.6), roy, -0.2, 3.95, 1.25, 0, 0.04); put(L, boite(0.06, 0.25, 1.6), BLANC, -0.2, 3.95, 1.25, 0, 0); put(L, boite(0.06, 1.1, 0.25), BLANC, -0.2, 3.95, 1.25, 0, 0);
  fantassin(L, P, 0.2, 0.4, roy);
  cavalier(L, P, -1.6, 0, roy, P.cav === 'cuirassier' ? 'officier' : P.cav);
  if (P.fourgon) fourgon(L, -5.8, -3); // sur le flanc gauche, à l'écart des attelages
  return L;
}

