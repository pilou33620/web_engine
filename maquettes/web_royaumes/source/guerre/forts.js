// ---------------------------------------------------------------- forts d'armée : retranchement (ordre gratuit et temporaire) et fort permanent à trois niveaux
// Tout est en unités du monde (une case = 1). Chaque ouvrage est un groupe posé au centre de sa case (y = haut de la case), porte au sud (+z, vers la caméra) ;
// le fort est décalé vers le nord (cz) pour laisser l'armée qui le garde sur le glacis, devant la porte : fort et armée tiennent sur une case.
// Case (9, 2), colline frontalière : le fort améliorable ; (8, 3) : une armée qui se retranche ; (9, 3) : un fort rival vide qu'une armée prend.
const FORTS = { k: at(9, 2), kRet: at(8, 3), kPris: at(9, 3), niveau: 1, debut: -99, duree: 6, cur: null, vieux: null, echaf: null, ret: { etat: 'creuse', debut: 0, auto: true } };
for (const k of [FORTS.k, FORTS.kRet, FORTS.kPris]) k.vide = true;
const NOM_FORT = { 1: 'Redoute', 2: 'Fort', 3: 'Fort à batteries' }, VISION_FORT = { 1: 2, 2: 2, 3: 3 }; // vision en cases (une armée seule voit à une case)
const STYLE_FORT = {
  ancien: { terre: 0x9c7a4a, dessus: 0xb08a54, bois: 0x8a5a2e, pierre: 0xdcc58a, haut: 0xf2e8cc, toit: 0xa8553a, canon: BRONZE, affut: 0x8a3a2a, fosse: 0x8a6a44, eau: true,
    nom: ['redoute de terre et de pieux, fossé, porte de bois', 'petit fort bastionné de pierre ocre, caserne, canons de bronze', 'fort à demi-lunes, batteries, poudrière, tour de guet au brasier'] },
  lumieres: { terre: 0x7fa64c, dessus: 0x9cc260, bois: 0xd2ad74, pierre: 0xe8dfc6, haut: 0xfbf6e6, toit: ARDOISE, canon: BRONZE, affut: 0x6b7a4a, fosse: 0x8a6a44, eau: true,
    nom: ['redoute en talus gazonné, palissade de pieux clairs', 'fort bastionné de pierre claire, toits d\'ardoise', 'fort à demi-lunes, batteries Gribeauval, poudrière, sémaphore'] },
  empire: { terre: 0x9a8058, dessus: 0xa88e62, bois: 0x8c7d68, pierre: 0xbcb7aa, haut: 0xdedad0, toit: ARDOISE, canon: BRONZE, affut: 0x6b7a4a, fosse: 0x8a6a44, eau: true, gazon: true,
    nom: ['redoute de terre et de gabions, un canon', 'fort de pierre grise gazonné', 'fort à ravelins, batteries, poudrière, télégraphe Chappe'] },
  industrie: { terre: 0x7d6a48, dessus: 0x8f9c5a, bois: 0x2e2824, pierre: 0xa8553c, haut: 0x8a3f2c, toit: 0x58606c, canon: 0x3a3d42, affut: 0x5a5f66, fosse: 0x7d8f5a, eau: false,
    nom: ['redoute de terre, palissade de poteaux goudronnés', 'fort bastionné de brique', 'fort bas polygonal de brique et de terre, casemates, canons rayés, sémaphore'] },
};
// polygone régulier, toujours direct (aire > 0 : la normale [uz, -ux] des côtés regarde dehors, comme pour les remparts)
const polyR = (n, r, a0, cx, cz) => { const P = []; for (let i = 0; i < n; i++) { const a = a0 + i * 2 * Math.PI / n; P.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return aire(P) > 0 ? P : P.reverse(); };
function enveloppe(pts) { // enveloppe convexe (chaîne monotone), rendue directe
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && x(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  const r = lo.slice(0, -1).concat(hi.slice(0, -1)); return aire(r) > 0 ? r : r.reverse();
}
// rempart de terre : talus extérieur en pente de Pb (au sol, y0) à Ph (en haut, y1), terre-plein de Ph à Pi, face intérieure droite ; contour brun de même forme
function talus(L, Pb, Ph, Pi, y0, y1, col, colHaut = col, ep = 0.01) {
  const fait = (B, Hh, I, a, b) => {
    const s = [], h = [], A = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3(), n = B.length;
    const tri = (o, p, q, r, w) => { A.set(...p); U.set(...q).sub(A); V.set(...r).sub(A); U.cross(V); if (U.x * w[0] + U.y * w[1] + U.z * w[2] < 0) o.push(...p, ...r, ...q); else o.push(...p, ...q, ...r); };
    const quad = (o, p, q, r, t, w) => { tri(o, p, q, r, w); tri(o, p, r, t, w); };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ex = B[j][0] - B[i][0], ez = B[j][1] - B[i][1], l = Math.hypot(ex, ez), nx = ez / l, nz = -ex / l;
      quad(s, [B[i][0], a, B[i][1]], [B[j][0], a, B[j][1]], [Hh[j][0], b, Hh[j][1]], [Hh[i][0], b, Hh[i][1]], [nx, 0.5, nz]);
      quad(h, [Hh[i][0], b, Hh[i][1]], [Hh[j][0], b, Hh[j][1]], [I[j][0], b, I[j][1]], [I[i][0], b, I[i][1]], [0, 1, 0]);
      quad(s, [I[i][0], b, I[i][1]], [I[j][0], b, I[j][1]], [I[j][0], a, I[j][1]], [I[i][0], a, I[i][1]], [-nx, 0, -nz]);
    }
    return [s, h].map(v => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g; });
  };
  const [s, h] = fait(Pb, Ph, Pi, y0, y1);
  put(L, s, col, 0, 0, 0, 0, 0); put(L, h, colHaut, 0, 0, 0, 0, 0);
  if (ep) L.o.push(...fait(decale(Pb, ep), decale(Ph, ep), decale(Pi, -ep), y0 - ep, y1 + ep));
}
// bastions aux sommets d'un polygone direct : face, flanc, pointe (même dessin que les remparts) ; rend le tracé complet T et son enveloppe ENV
function traceBastions(Q, f, sf, Lt) {
  const n = Q.length, U = Q.map((q, j) => { const r = Q[(j + 1) % n], l = Math.hypot(r[0] - q[0], r[1] - q[1]); return [(r[0] - q[0]) / l, (r[1] - q[1]) / l]; }), N = U.map(u => [u[1], -u[0]]);
  const T = [], ENV = [], pointes = [];
  Q.forEach((q, v) => {
    const jp = (v - 1 + n) % n, u1 = U[jp], u2 = U[v], n1 = N[jp], n2 = N[v], bx = n1[0] + n2[0], bz = n1[1] + n2[1], bl = Math.hypot(bx, bz), bi = [bx / bl, bz / bl];
    const F1 = [q[0] - u1[0] * f, q[1] - u1[1] * f], F2 = [q[0] + u2[0] * f, q[1] + u2[1] * f], S1 = [F1[0] + n1[0] * sf, F1[1] + n1[1] * sf], S2 = [F2[0] + n2[0] * sf, F2[1] + n2[1] * sf], P = [q[0] + bi[0] * Lt, q[1] + bi[1] * Lt];
    T.push(F1, S1, P, S2, F2); ENV.push(S1, P, S2); pointes.push({ x: P[0], z: P[1], bi });
  });
  return { T, ENV, pointes, U, N };
}
const toitM = (L, w, d, h, col, x, y, z, ry = 0) => { const p = cyl(1, 1, d, 3); p.rotateX(Math.PI / 2); p.rotateZ(Math.PI); p.scale(w / SQ3, h / 1.5, 1); p.translate(0, h / 2 - h / 3, 0); putR(L, p, col, x, y + h / 6, z, ry, 0.006); };
function canonM(L, st, x, y, z, dx, dz, raye = false) { // une pièce sur son affût, le tube vers (dx, dz) ; canon rayé, long et fin, à l'ère industrielle
  const l = Math.hypot(dx, dz); dx /= l; dz /= l; const ry = ryDe(dx, dz), Ln = raye ? 0.14 : 0.1, b = cyl(raye ? 0.008 : 0.011, raye ? 0.014 : 0.017, Ln, 8); b.rotateZ(-Math.PI / 2);
  putR(L, b, st.canon, x + dx * Ln * 0.28, y + 0.032, z + dz * Ln * 0.28, ry, 0.004);
  putR(L, boite(0.07, 0.022, 0.042), st.affut, x - dx * 0.012, y + 0.013, z - dz * 0.012, ry, 0.004);
  for (const s of [-1, 1]) putR(L, cyl(0.017, 0.017, 0.008, 8).rotateX(Math.PI / 2), raye ? 0x2b2b30 : 0x4a3420, x - dz * s * 0.026, y + 0.017, z + dx * s * 0.026, ry, 0.003);
}
const gabionM = (L, x, y, z, r = 0.02, h = 0.045) => { putR(L, cyl(r, r, h, 8), 0x9a7a4a, x, y + h / 2, z, 0, 0.004); putR(L, cyl(r * 1.06, r * 1.06, 0.006, 8), 0x6a5030, x, y + h, z, 0, 0); };
const tenteM = (L, x, z, col, ry = 0) => { putR(L, cone(0.05, 0.065, 4), col, x, 0.0325, z, Math.PI / 4 + ry, 0.005); putR(L, boite(0.016, 0.03, 0.004), 0x2a2420, x + Math.sin(ry) * 0.036, 0.015, z + Math.cos(ry) * 0.036, ry, 0); };
const parcourir = (P, f) => { const n = P.length; for (let j = 0; j < n; j++) { const a = P[j], b = P[(j + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); f(a, b, l, (b[0] - a[0]) / l, (b[1] - a[1]) / l); } };
// le côté du polygone le plus au sud (la porte)
const coteSud = P => { let jb = 0, zb = -Infinity; P.forEach((p, j) => { const q = P[(j + 1) % P.length], z = (p[1] + q[1]) / 2; if (z > zb) { zb = z; jb = j; } }); const a = P[jb], b = P[(jb + 1) % P.length]; return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, ry: ryDe(b[0] - a[0], b[1] - a[1]) }; };
// fossé (sec ou en eau) autour de ENV, glacis et son liseré ; rend le bord extérieur du fossé
function fosseGlacis(Ls, st, ENV, trou, eau, demi = []) {
  const F0 = decale(ENV, 0.08, 1.6), Fd = demi.map(d => decale(d, 0.055)), M = enveloppe(F0.concat(...Fd)), Gl = decale(M, 0.07, 1.6), col = eau ? EAU_F : st.fosse;
  dalle(Ls, F0, 0.001, 0.006, col, 0, [trou]);
  for (const d of Fd) dalle(Ls, d, 0.0012, 0.0062, col, 0); // le fossé de chaque demi-lune, par-dessus le glacis
  dalle(Ls, Gl, 0.0005, 0.0045, GLACIS, 0, [F0]);
  dalle(Ls, decale(Gl, 0.014), 0.0005, 0.0035, 0x6f8a44, 0, [Gl]);
  return M;
}
// porte au sud : pavillon, vantaux, pont jusqu'au bord du fossé
function porteM(L, Ls, st, P, H, larg, pont, fer = false, bois = false) {
  const c = coteSud(P), sx = -Math.sin(c.ry), sz = -Math.cos(c.ry); // (sx, sz) : vers le sud, hors du mur
  putR(L, boite(larg + 0.04, H + 0.035, 0.05), bois ? st.bois : fer ? st.pierre : st.haut, c.x - sx * 0.012, (H + 0.035) / 2, c.z - sz * 0.012, c.ry, 0.008);
  putR(L, boite(larg, H * 0.72, 0.012), fer ? 0x3a3d42 : 0x5a3a20, c.x + sx * 0.016, H * 0.36, c.z + sz * 0.016, c.ry, 0);
  if (pont) putR(Ls, boite(larg * 0.9, 0.012, pont), fer ? 0x8a867e : 0x8b5a2b, c.x + sx * pont / 2, 0.012, c.z + sz * pont / 2, c.ry, 0.005);
  return c;
}
// ---- le fort au niveau n, à l'époque courante. Rend { g, murs, sol, T (tracé, coordonnées de la case), H, ronde, anime : pièces animées }
function modeleFort(n, roy, propre = false) {
  const st = STYLE_FORT[EPOQUE], indus = EPOQUE === 'industrie', cx = 0, cz = -0.16;
  const g = new THREE.Group(), murs = new THREE.Group(), sol = new THREE.Group(); g.add(sol); g.add(murs);
  const L = lot(), Ls = lot(), anime = {};
  let T, H, ronde, mat;
  if (n === 1) { // ---- redoute de terre : talus, fossé, défense sur la crête selon l'époque, porte, deux tentes et le mât
    const pent = EPOQUE === 'empire' || indus, Q = pent ? polyR(5, 0.37, Math.PI * 0.3, cx, cz) : polyR(4, 0.42, Math.PI / 4, cx, cz);
    H = 0.12; T = decale(Q, 0.055); const Pi = decale(Q, -0.1);
    talus(L, T, Q, Pi, -0.03, H, st.terre, st.dessus, 0.011);
    dalle(Ls, decale(T, 0.065), 0.001, 0.006, 0x5e4a30, 0, [T]); dalle(Ls, decale(T, 0.082), 0.001, 0.005, GLACIS, 0, [decale(T, 0.065)]); dalle(Ls, decale(T, 0.094), 0.001, 0.0045, 0x6f8a44, 0, [decale(T, 0.082)]);
    const crete = decale(Q, -0.014);
    if (EPOQUE === 'ancien') parcourir(crete, (a, b, l, ux, uz) => { for (let s = 0.02; s < l - 0.01; s += 0.034) putR(L, cone(0.011, 0.05, 5), st.bois, a[0] + ux * s, H + 0.022, a[1] + uz * s, 0, 0.004); }); // pieux
    else if (EPOQUE === 'lumieres') parcourir(decale(T, 0.022), (a, b, l, ux, uz) => { putR(L, boite(l, 0.012, 0.01), st.bois, (a[0] + b[0]) / 2, 0.05, (a[1] + b[1]) / 2, ryDe(ux, uz), 0.003); for (let s = 0.012; s < l - 0.006; s += 0.024) putR(L, boite(0.014, 0.075, 0.012), st.bois, a[0] + ux * s, 0.037, a[1] + uz * s, ryDe(ux, uz), 0.004); }); // palissade au pied du talus
    else if (EPOQUE === 'empire') { parcourir(decale(Q, -0.03), (a, b, l, ux, uz) => { for (let s = 0.04; s < l - 0.03; s += 0.05) gabionM(L, a[0] + ux * s, H, a[1] + uz * s); }); const q = Q.reduce((m, p) => (p[1] > m[1] ? p : m)); canonM(L, st, q[0] * 0.8, H, (q[1] - cz) * 0.8 + cz, q[0] - cx, q[1] - cz); }
    else parcourir(crete, (a, b, l, ux, uz) => { const ry = ryDe(ux, uz); for (let s = 0.014; s < l - 0.008; s += 0.026) putR(L, boite(0.016, 0.06, 0.014), st.bois, a[0] + ux * s, H + 0.026, a[1] + uz * s, ry, 0.004); for (const hh of [0.02, 0.045]) putR(L, boite(l, 0.008, 0.02), 0x5a4a3a, (a[0] + b[0]) / 2, H + hh, (a[1] + b[1]) / 2, ry, 0); }); // poteaux goudronnés et lisses
    porteM(L, Ls, st, T, H * 0.75, 0.07, 0.1, indus, !indus);
    tenteM(L, cx - 0.09, cz + 0.02, new THREE.Color(roy).getHex()); tenteM(L, cx + 0.06, cz - 0.11, 0xe9e2d0, 0.6);
    mat = [cx + 0.1, cz + 0.04]; ronde = decale(Q, -0.05);
  } else if (n === 3 && indus) { // ---- fort polygonal bas : escarpe de brique, rempart de terre par-dessus, casemates, canons rayés
    const Q = polyR(5, 0.5, Math.PI * 0.3, cx, cz), Qi = decale(Q, -0.14);
    H = 0.125; T = Q;
    dalle(L, Q, -0.03, 0.07, st.pierre, 0.012, [Qi]);
    dalle(L, Q, 0.07, 0.078, st.haut, 0.006, [decale(Q, -0.02)]); // tablette de brique
    talus(L, decale(Q, -0.02), decale(Q, -0.055), Qi, 0.075, H, st.dessus, HERBE, 0.009);
    parcourir(Q, (a, b, l, ux, uz) => { const ry = ryDe(ux, uz); for (const f of [0.28, 0.72]) putR(L, boite(0.032, 0.03, 0.012), 0x2a1d14, a[0] + ux * l * f + uz * 0.002, 0.03, a[1] + uz * l * f - ux * 0.002, ry, 0); }); // casemates
    Q.forEach(q => canonM(L, st, cx + (q[0] - cx) * 0.8, H - 0.01, cz + (q[1] - cz) * 0.8, q[0] - cx, q[1] - cz, true));
    { const c = coteSud(Q); for (const s of [-0.13, 0.13]) canonM(L, st, c.x + s, H - 0.01, c.z - 0.06, 0, 1, true); }
    fosseGlacis(Ls, st, Q, Q, false);
    porteM(L, Ls, st, Q, 0.07, 0.08, 0.14, true);
    put(L, new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), HERBE, cx - 0.13, 0, cz - 0.08, 0, 0.008); putR(L, boite(0.04, 0.035, 0.012), st.pierre, cx - 0.13, 0.017, cz - 0.005, 0, 0.004); // poudrière sous la terre
    dalle(L, [[cx - 0.04, cz + 0.02], [cx + 0.2, cz + 0.02], [cx + 0.2, cz + 0.12], [cx - 0.04, cz + 0.12]], 0, 0.06, st.pierre, 0.008); dalle(L, [[cx - 0.04, cz + 0.02], [cx + 0.2, cz + 0.02], [cx + 0.2, cz + 0.12], [cx - 0.04, cz + 0.12]], 0.06, 0.075, HERBE, 0.006); // caserne casematée
    for (let i = 0; i < 4; i++) putR(L, boite(0.022, 0.026, 0.006), 0xffe2a0, cx + i * 0.06 - 0.01, 0.03, cz + 0.122, 0, 0);
    anime.semaphore = semaphore(L, murs, st, cx + 0.12, cz - 0.14, 0.2, true);
    mat = [cx - 0.02, cz - 0.24]; ronde = decale(Q, -0.09);
  } else { // ---- fort bastionné (niveau 2) ou fort à batteries avec demi-lunes (niveau 3)
    const grand = n === 3, s = grand ? 0.3 : 0.25, Q = polyR(4, s * Math.SQRT2, Math.PI / 4, cx, cz), w = grand ? 0.08 : 0.07, Qi = decale(Q, -w);
    H = grand ? 0.14 : 0.12;
    const tb = traceBastions(Q, grand ? 0.11 : 0.1, grand ? 0.06 : 0.055, grand ? 0.19 : 0.17); T = tb.T;
    const haut = indus ? HERBE : st.haut;
    if (st.gazon) { dalle(L, T, -0.03, H * 0.62, st.pierre, 0.012, [Qi]); dalle(L, decale(T, -0.004), H * 0.62, H, HERBE, 0.008, [Qi]); } // pierre grise, talus gazonné au-dessus
    else dalle(L, T, -0.03, H, st.pierre, 0.012, [Qi]);
    dalle(L, T, H, H + 0.024, haut, 0.006, [decale(T, -0.022)]); // parapet (de terre à l'ère industrielle)
    dalle(L, decale(T, -0.022), H, H + 0.005, indus ? 0x8a6a44 : HERBE, 0, [Qi]); // terre-plein
    if (!st.gazon) dalle(L, decale(T, 0.002), H * 0.55, H * 0.55 + 0.012, st.haut, 0, [decale(T, -0.01)]); // cordon
    // bastions : échauguettes (1700, Lumières, niveau 2) et canons
    tb.pointes.forEach((p, i) => {
      const avant = p.z > cz, [bx, bz] = p.bi;
      if (!grand && !indus && EPOQUE !== 'empire') { const ex = p.x - bx * 0.035, ez = p.z - bz * 0.035; putR(L, cyl(0.026, 0.021, 0.06, 8), st.haut, ex, H + 0.03, ez, 0, 0.005); putR(L, cone(0.036, 0.055, 8), st.toit, ex, H + 0.088, ez, 0, 0.005); }
      const nb = avant || grand ? 2 : 1;
      for (let c = 0; c < nb; c++) { const lat = nb > 1 ? (c ? 1 : -1) * 0.05 : 0; canonM(L, st, p.x - bx * 0.12 - bz * lat, H + 0.004, p.z - bz * 0.12 + bx * lat, bx, bz, indus); }
    });
    const extra = [];
    if (grand) { // demi-lunes devant les courtines est, ouest et nord (la porte reste au sud, l'armée devant)
      Q.forEach((q, j) => {
        const r = Q[(j + 1) % 4], mx = (q[0] + r[0]) / 2, mz = (q[1] + r[1]) / 2; if (mz > cz + 0.1) return;
        const [ux, uz] = tb.U[j], [nx, nz] = tb.N[j], tri = [[mx + nx * 0.1 + ux * 0.17, mz + nz * 0.1 + uz * 0.17], [mx + nx * 0.36, mz + nz * 0.36], [mx + nx * 0.1 - ux * 0.17, mz + nz * 0.1 - uz * 0.17]];
        const t2 = aire(tri) > 0 ? tri : tri.slice().reverse();
        dalle(L, t2, -0.03, H * 0.72, st.pierre, 0.01); dalle(L, decale(t2, -0.02), H * 0.72, H * 0.72 + 0.005, HERBE, 0); dalle(L, t2, H * 0.72, H * 0.72 + 0.02, haut, 0.005, [decale(t2, -0.02)]);
        canonM(L, st, mx + nx * 0.24, H * 0.72 + 0.004, mz + nz * 0.24, nx, nz, indus);
        extra.push(t2);
      });
    }
    fosseGlacis(Ls, st, tb.ENV, T, grand && st.eau, extra);
    porteM(L, Ls, st, Q, H * 0.8, 0.075, (grand ? 0.06 : 0.055) + 0.1, indus); // sur la courtine sud (celle du carré, pas une face de bastion), pont jusqu'au bord du fossé
    // dedans : caserne, et au niveau 3 la poudrière et la tour de guet (sémaphore)
    const yb = 0, mur = indus ? 0xb7634a : EPOQUE === 'ancien' ? 0xf1e4c4 : 0xf6eedb;
    if (grand) {
      putR(L, boite(0.28, 0.065, 0.075), mur, cx, yb + 0.0325, cz - 0.15, 0, 0.007); toitM(L, 0.09, 0.3, 0.045, st.toit, cx, yb + 0.065, cz - 0.15, Math.PI / 2);
      for (let i = 0; i < 5; i++) putR(L, boite(0.02, 0.022, 0.004), VITRE, cx - 0.1 + i * 0.05, yb + 0.035, cz - 0.111, 0, 0);
      putR(L, boite(0.075, 0.055, 0.06), PIERRE, cx - 0.12, yb + 0.0275, cz + 0.0, 0, 0.007); toitM(L, 0.085, 0.07, 0.06, st.toit, cx - 0.12, yb + 0.055, cz + 0.0); // poudrière
      for (const s of [-1, 1]) putR(L, boite(0.014, 0.04, 0.07), PIERRE, cx - 0.12 + s * 0.042, yb + 0.02, cz, 0, 0.004);
      putR(L, boite(0.004, 0.06, 0.004), 0x3a3a40, cx - 0.12, yb + 0.14, cz, 0, 0); // paratonnerre
      if (EPOQUE === 'ancien') anime.brasier = tourGuet(L, murs, st, cx + 0.13, cz + 0.0);
      else anime.semaphore = semaphore(L, murs, st, cx + 0.13, cz + 0.0, 0.2, false);
      mat = [cx - 0.19, cz - 0.05]; // à gauche : le drapeau ne cache pas le sémaphore
    } else {
      putR(L, boite(0.22, 0.06, 0.075), mur, cx, yb + 0.03, cz - 0.12, 0, 0.007); toitM(L, 0.09, 0.24, 0.045, st.toit, cx, yb + 0.06, cz - 0.12, Math.PI / 2);
      for (let i = 0; i < 4; i++) putR(L, boite(0.02, 0.022, 0.004), VITRE, cx - 0.075 + i * 0.05, yb + 0.032, cz - 0.081, 0, 0);
      mat = [cx + 0.11, cz + 0.0];
    }
    ronde = decale(Q, -w / 2);
  }
  // le mât et le drapeau (du royaume, ou rival pour le fort à prendre)
  const hm = n === 1 ? 0.34 : 0.4; putR(L, boite(0.012, hm, 0.012), 0x4a3420, mat[0], hm / 2, mat[1], 0, 0.004);
  const drap = drapeau(murs, roy, mat[0] + 0.006, hm - 0.05, mat[1], 0.17, 0.11, 0, propre);
  fige(L, murs); fige(Ls, sol);
  return { g, murs, sol, T, H, ronde, anime, drap, mat, hm };
}
// tour de guet de bois au brasier (1700)
function tourGuet(L, parent, st, x, z) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) putR(L, boite(0.01, 0.2, 0.01), st.bois, x + dx * 0.025, 0.1, z + dz * 0.025, 0, 0.003);
  putR(L, boite(0.075, 0.012, 0.075), st.bois, x, 0.2, z, 0, 0.004); putR(L, cyl(0.016, 0.01, 0.02, 8), 0x3a3a40, x, 0.216, z, 0, 0.003);
  const f = feu(parent, x, 0.226, z, 0.12); f.visible = true; return f;
}
// sémaphore : tour, mât, régulateur et deux bras qui battent (télégraphe Chappe aux Lumières et sous l'Empire, de fer à l'ère industrielle)
function semaphore(L, parent, st, x, z, h, fer) {
  putR(L, boite(0.055, h, 0.055), fer ? st.pierre : PIERRE, x, h / 2, z, 0, 0.006); putR(L, boite(0.068, 0.012, 0.068), st.haut, x, h + 0.006, z, 0, 0.004);
  putR(L, boite(0.008, 0.12, 0.008), fer ? 0x3a3d42 : 0x4a3420, x, h + 0.07, z, 0, 0.003);
  const pivot = new THREE.Group(); pivot.position.set(x, h + 0.12, z + 0.008); parent.add(pivot);
  const col = fer ? 0x3a3d42 : 0x2b2b30, Lr = lot(); putR(Lr, boite(0.13, 0.012, 0.006), col, 0, 0, 0, 0, 0.003); const reg = fige(Lr, pivot);
  const bras = [-1, 1].map(s => { const Lb = lot(); putR(Lb, boite(0.008, 0.05, 0.005), col, 0, 0.022, 0, 0, 0.002); const b = fige(Lb, reg); b.position.set(s * 0.062, 0, 0.004); return b; });
  return { reg, bras };
}
// ---- l'anneau léger de la vision : le contour exact des cases vues depuis le fort, posé sur le relief
function anneauVision(k, r, roy) {
  const { P: P0, ed } = contourGroupe(CASES.filter(c => ecart(c, k) <= r)), P = decale(P0, -0.1), L = lot(); // rentré sur les cases vues, hors des rainures entre cases
  P.forEach((a, j) => { const b = P[(j + 1) % P.length], y = Math.max(ed[j].k.top ?? 0, MER) + 0.016, ux = b[0] - a[0], uz = b[1] - a[1], l = Math.hypot(ux, uz); putR(L, boite(l + 0.07, 0.012, 0.12), 0xffffff, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, ryDe(ux / l, uz / l), 0); });
  const g = fige(L, GUERRE), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(roy).lerp(new THREE.Color(0xffffff), 0.12), transparent: true, opacity: 0.85, depthWrite: false });
  g.children.forEach(c => { c.material = m; c.castShadow = c.receiveShadow = false; c.renderOrder = 3; }); g.userData.mat = m; return g;
}
// ---- un terrassier : soldat sans fusil à l'épaule mais une pelle à la main (unités de l'armée)
function terrassier(P, roy) {
  const L = lot(); fantassin(L, { ...P, baionnette: false }, 0, 0, roy);
  const m = boite(0.09, 1.7, 0.09); m.rotateX(0.7); put(L, m, BOIS, -0.45, 1.1, 0.75, 0, 0.04); put(L, boite(0.42, 0.5, 0.07), 0x9a9a9a, -0.45, 0.42, 1.38, 0, 0.04);
  const g = fige(L, GUERRE); g.scale.setScalar(ECH_GENS * 1.15); g.rotation.order = 'YXZ'; return g;
}
const pose = (g, k, lx, lz, dy = 0) => g.position.set(k.x + lx, k.top + dy, k.z + lz);
const ECH_ARMEE_FORT = 0.06; // l'icône d'armée du plateau (0,1) réduite pour tenir sur la case avec son fort
// une armée de l'époque dont l'origine est au centre de l'icône (ses pièces sont décalées vers l'artillerie, à +x)
function armeeCentree(P, roy) { const g = new THREE.Group(), a = fige(armee(P, roy), g); a.position.set(-2.05, 0, 0.55); g.scale.setScalar(ECH_ARMEE_FORT); GUERRE.add(g); return g; }
// ---- tout ce qui vit sur ces trois cases (rebâti à chaque époque)
function construireForts(E, P, roy) {
  const F = FORTS, Fo = {};
  F.cur = F.vieux = F.echaf = null; F.debut = -99;
  // l'armée qui garde le fort, sur le glacis devant la porte
  Fo.armee = armeeCentree(P, roy); pose(Fo.armee, F.k, 0, 0.56);
  // la garnison : une sentinelle qui fait sa ronde sur le rempart, un factionnaire à la porte
  Fo.sentinelle = soldat(GUERRE, P, roy, 'ligne', ECH_GENS * 0.9);
  // ouvriers des travaux (montée de niveau) : deux qui frappent, deux qui portent des blocs
  Fo.ouvriers = [0, 1, 2, 3].map(i => { const o = acteur('paysan', ECH * 1.25, GUERRE); if (i >= 2) { const L = lot(); put(L, boite(0.7, 0.45, 0.55), 0xd8cfb4, 0, 2.6, 0, 0, 0.06); fige(L, o); } o.visible = false; return o; });
  // une onde légère part du fort jusqu'au bord de sa vision (le sémaphore « signale » ce qu'il voit)
  Fo.onde = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: roy, transparent: true, opacity: 0, depthWrite: false })); Fo.onde.renderOrder = 3; GUERRE.add(Fo.onde);
  construireFort(false);
  // le retranchement : l'armée sur sa colline, une tranchée basse en arc devant elle, gabions, fascines et sacs, six terrassiers
  { const k = F.kRet, R = { k, ry: 0.55 }; R.fx = Math.sin(R.ry); R.fz = Math.cos(R.ry); R.base = { x: -0.04 - R.fx * 0.14, z: -0.04 - R.fz * 0.14 };
    R.armee = armeeCentree(P, roy); R.armee.rotation.y = R.ry;
    const nb = 12, rayon = 0.5, a0 = Math.atan2(R.fx, R.fz), pt = (a, r = rayon) => [R.base.x + Math.sin(a) * r, R.base.z + Math.cos(a) * r];
    R.segs = []; R.gabions = []; R.terr = [];
    for (let i = 0; i < nb; i++) {
      const a = a0 + (i / (nb - 1) - 0.5) * 2.1, [x, z] = pt(a), ry = ryDe(Math.cos(a), -Math.sin(a)), l = rayon * 2.1 / (nb - 1) + 0.02, Lt = lot();
      putR(Lt, boite(l, 0.032, 0.055), 0x8f744a, Math.sin(a) * 0.02, 0.016, Math.cos(a) * 0.02, ry, 0.006); // parapet de terre côté ennemi
      putR(Lt, boite(l, 0.005, 0.032), 0x4a3522, -Math.sin(a) * 0.026, 0.003, -Math.cos(a) * 0.026, ry, 0); // la tranchée
      const g = fige(Lt, GUERRE); pose(g, k, x, z); R.segs.push(g);
      if (i % 2) { const Lg = lot(); if (EPOQUE === 'empire' || EPOQUE === 'industrie') { for (const d of [-0.025, 0, 0.025]) putR(Lg, sphere(0.016, 0).scale(1.3, 0.7, 1), 0xd8c9a0, Math.cos(a) * d + Math.sin(a) * 0.022, 0.04, -Math.sin(a) * d + Math.cos(a) * 0.022, 0, 0.003); } // sacs de terre
        else putR(Lg, cyl(0.011, 0.011, l * 0.9, 6).rotateZ(Math.PI / 2), 0x8a6a3a, Math.sin(a) * 0.022, 0.04, Math.cos(a) * 0.022, ry, 0.003); // fascine
        const gs = fige(Lg, GUERRE); pose(gs, k, x, z); gs.userData.i = i; R.gabions.push(gs); }
      else if (i > 0 && i < nb - 1) { const Lg = lot(); gabionM(Lg, Math.sin(a) * 0.022, 0.03, Math.cos(a) * 0.022, 0.018, 0.04); const gs = fige(Lg, GUERRE); pose(gs, k, x, z); gs.userData.i = i; R.gabions.push(gs); }
    }
    R.terr = [0, 1, 2, 3, 4, 5].map(i => { const a = a0 + (i / 5 - 0.5) * 1.8, [x, z] = pt(a, rayon - 0.08), g = terrassier(P, roy); g.userData.p = [x, z]; g.userData.a = a; g.visible = false; return g; });
    Fo.ret = R; }
  // le fort rival vide (redoute aux couleurs rouges) et l'armée qui vient le prendre
  { const k = F.kPris, f = modeleFort(1, ROUGE, true); f.g.position.set(k.x, k.top, k.z); GUERRE.add(f.g);
    Fo.pris = { k, f, armee: armeeCentree(P, roy) }; }
  return Fo;
}
// le fort au niveau choisi ; en montant, quelques secondes de travaux (échafaudages, blocs, poussière, ouvriers), puis l'ancien disparaît
function construireFort(travaux) {
  const F = FORTS, k = F.k, nf = modeleFort(F.niveau, ROYAUME);
  nf.g.position.set(k.x, k.top, k.z); GUERRE.add(nf.g);
  nf.Tw = nf.T.map(([x, z]) => [k.x + x, k.z + z]);
  if (F.vieux) { F.vieux.g.parent?.remove(F.vieux.g); F.vieux = null; }
  if (F.echaf) { F.echaf.parent?.remove(F.echaf); F.echaf = null; }
  if (travaux && F.cur) { F.vieux = F.cur; F.debut = t; F.echaf = echafaudages(GUERRE, decale(nf.Tw, 0.02), nf.H); nf.murs.scale.y = 0.03; }
  else { if (F.cur) F.cur.g.parent?.remove(F.cur.g); F.debut = -99; }
  if (G.forts?.anneau) G.forts.anneau.parent?.remove(G.forts.anneau);
  F.cur = nf;
  if (G.forts) G.forts.anneau = anneauVision(k, VISION_FORT[F.niveau], ROYAUME);
}
function niveauFort(nv) { const monte = nv > FORTS.niveau; FORTS.niveau = nv; construireFort(monte); }
function relancerForts() { Object.assign(FORTS.ret, { etat: 'creuse', debut: t, auto: true }); }
function visionForts() {
  const F = FORTS, s = [[F.k.x, F.k.z, VISION_FORT[F.niveau]], [F.kRet.x, F.kRet.z, 1]];
  if (G.forts?.pris?.armee.visible) s.push([G.forts.pris.armee.position.x, G.forts.pris.armee.position.z, 1]);
  return s;
}
function animForts(dt, tps) {
  const F = FORTS, Fo = G.forts; if (!Fo || !F.cur) return;
  if (!Fo.anneau) Fo.anneau = anneauVision(F.k, VISION_FORT[F.niveau], ROYAUME);
  const e = F.cur, k = F.k, u = tps - F.debut, tr = u >= 0 && u < F.duree;
  // ---- travaux de montée de niveau
  if (tr) {
    e.murs.scale.y = 0.03 + 0.97 * lisse(0.6, F.duree - 0.4, u);
    if (F.vieux) F.vieux.g.visible = u < F.duree * 0.45;
    if (Math.random() < dt * 8) { const q = e.Tw[Math.random() * e.Tw.length | 0]; fumer({ x: q[0], y: k.top + 0.03, z: q[1] }, { c: POUSSIERE, k: 0.7, vie: 1.6, vy: 0.08 }); }
  } else if (F.debut > -99) { e.murs.scale.y = 1; if (F.vieux) { F.vieux.g.parent?.remove(F.vieux.g); F.vieux = null; } if (F.echaf) { F.echaf.parent?.remove(F.echaf); F.echaf = null; } F.debut = -99; }
  Fo.ouvriers.forEach((o, i) => {
    o.visible = tr; if (!tr) return;
    const n = e.Tw.length, a = e.Tw[(i * 3 + 1) % n], b = e.Tw[(i * 3 + 2) % n], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = mx - k.x, dz = mz - (k.z - 0.16), l = Math.hypot(dx, dz) || 1, ox = dx / l, oz = dz / l;
    if (i < 2) { o.position.set(mx + ox * 0.1, k.top + Math.abs(Math.sin(tps * 7 + i)) * 0.008, mz + oz * 0.1); o.rotation.y = Math.atan2(-ox, -oz) - Math.PI / 2; o.rotation.z = Math.sin(tps * 7 + i) * 0.15; } // ils frappent la pierre
    else { const f = (Math.sin(tps * 1.4 + i) + 1) / 2, x = mx + ox * (0.12 + f * 0.25), z = mz + oz * (0.12 + f * 0.25); o.position.set(x, k.top + Math.abs(Math.sin(tps * 9 + i)) * 0.006, z); o.rotation.y = Math.atan2(ox, oz) - Math.PI / 2 + (Math.cos(tps * 1.4 + i) > 0 ? Math.PI : 0); } // ils portent les blocs
  });
  // ---- la sentinelle fait sa ronde sur le rempart (cachée pendant les travaux)
  { const s = Fo.sentinelle; s.visible = !tr; if (s.visible) {
    const P = e.ronde, n = P.length, lg = []; let tot = 0; for (let j = 0; j < n; j++) { const a = P[j], b = P[(j + 1) % n]; lg.push(Math.hypot(b[0] - a[0], b[1] - a[1])); tot += lg[j]; }
    let d = (tps * 0.06) % tot, j = 0; while (d > lg[j]) { d -= lg[j]; j++; }
    const a = P[j], b = P[(j + 1) % n], f = d / lg[j], x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
    s.position.set(k.x + x, k.top + e.H + 0.004 + Math.abs(Math.sin(tps * 8)) * 0.004, k.z + z); s.rotation.y = capVers(b[0] - a[0], b[1] - a[1]); } }
  // ---- sémaphore qui signale, brasier ; anneau de la vision qui respire
  const sm = e.anime.semaphore; if (sm) { sm.reg.parent.visible = !tr; sm.reg.rotation.z = Math.round(Math.sin(tps * 0.7) * 2) * Math.PI / 4 * 0.5 + Math.sin(tps * 3) * 0.04; sm.bras.forEach((b, i) => { b.rotation.z = (Math.floor(tps * 0.9 + i * 1.3) % 4) * Math.PI / 4; }); }
  if (e.anime.brasier) { e.anime.brasier.visible = !tr; animFeu(e.anime.brasier, tps); if (Math.random() < dt * 2) fumer(versMonde(e.anime.brasier, 0, 0.3, 0), { k: 0.35, vie: 2 }); }
  { const w = (tps % 3.2) / 3.2, R = VISION_FORT[F.niveau] * SQ3 + 0.4; Fo.onde.visible = SC.courante === 'forts' && !tr; Fo.onde.position.set(k.x, k.top + 0.05, k.z - 0.16); Fo.onde.scale.setScalar(0.4 + w * R); Fo.onde.material.opacity = (1 - w) * 0.7; }
  if (Fo.anneau) { Fo.anneau.visible = SC.courante === 'forts'; Fo.anneau.userData.mat.opacity = 0.75 + Math.sin(tps * 2) * 0.15; } // seulement dans cette scène
  // ---- le retranchement : creuser en un mois, armée retranchée, lever le camp
  { const R = Fo.ret, st = F.ret; let w = tps - st.debut;
    if (st.etat === 'creuse' && w > 6) { st.etat = 'retranche'; st.debut = tps - (w - 6); w -= 6; }
    if (st.auto && st.etat === 'retranche' && w > 7) { st.etat = 'leve'; st.debut = tps; w = 0; }
    if (st.etat === 'leve' && w > 8) { if (st.auto) { st.etat = 'creuse'; st.debut = tps; } else st.etat = 'marche'; w = tps - st.debut; }
    const creuse = st.etat === 'creuse', leve = st.etat === 'leve', fait = st.etat === 'retranche';
    // l'armée : en place, ou qui part à reculons vers le nord-ouest et revient (en marche, sans retranchement)
    let rec = 0; if (leve) rec = w < 4.6 ? lisse(0.2, 3.4, w) : 1 - lisse(5, 7.8, w);
    R.armee.visible = !(leve && w > 3.4 && w < 5.2);
    pose(R.armee, R.k, R.base.x - R.fx * rec * 0.9, R.base.z - R.fz * rec * 0.9, leve && rec > 0.02 && rec < 0.98 ? Math.abs(Math.sin(tps * 8)) * 0.004 : 0);
    const nb = R.segs.length;
    R.segs.forEach((g, i) => { const h = creuse ? lisse(0.4 + i * 0.32, 1 + i * 0.32, w) : fait ? 1 : leve ? 1 - lisse(1.2 + i * 0.08, 3.4 + i * 0.08, w) : 0; g.visible = h > 0.01; g.scale.y = Math.max(0.01, h); });
    R.gabions.forEach(g => { const i = g.userData.i, h = creuse ? lisse(2.4 + i * 0.22, 2.9 + i * 0.22, w) : fait ? 1 : leve ? 1 - lisse(0.8, 2.6, w) : 0; g.visible = h > 0.01; g.scale.setScalar(Math.max(0.01, h)); });
    R.terr.forEach((g, i) => {
      g.visible = creuse && w > 0.1 + i * 0.1 && w < 5.6; if (!g.visible) return;
      const [x, z] = g.userData.p, a = g.userData.a, sw = Math.sin(tps * 7 + i * 1.7);
      pose(g, R.k, x, z); g.rotation.y = a; g.rotation.x = 0.25 + sw * 0.3;
      if (sw > 0.97 && Math.random() < 0.5) fumer({ x: R.k.x + x + Math.sin(a) * 0.06, y: R.k.top + 0.02, z: R.k.z + z + Math.cos(a) * 0.06 }, { c: POUSSIERE, k: 0.4, vie: 1, vy: 0.06 });
    });
    R.nb = creuse ? Math.min(100, Math.round(w / 6 * 100)) : 0; }
  // ---- le fort rival pris : l'armée arrive, le drapeau rouge descend, le nôtre monte (seize secondes)
  { const Pr = Fo.pris, f = Pr.f, w = ((tps - (SC.t.forts || 0)) % 16 + 16) % 16, k = Pr.k;
    const A = { x: -0.45, z: 1.05 }, B = { x: 0, z: 0.56 }, m = lisse(0.5, 5, w), x = A.x + (B.x - A.x) * m, z = A.z + (B.z - A.z) * m;
    Pr.armee.visible = w > 0.3; pose(Pr.armee, k, x, z, m > 0.01 && m < 0.99 ? Math.abs(Math.sin(tps * 8)) * 0.004 : 0); Pr.armee.rotation.y = capVers(B.x - A.x, B.z - A.z) * (1 - lisse(4.5, 5.5, w));
    const bas = lisse(5.6, 7, w), haut = lisse(7.4, 9, w), notre = w > 7.2, hy = notre ? haut : 1 - bas;
    f.drap.material.color.set(notre ? ROYAUME : ROUGE); f.drap.position.y = 0.09 + hy * (f.hm - 0.14); Pr.notre = notre && w > 9; }
}
function texteForts() {
  const F = FORTS, n = F.niveau, st = F.ret, u = t - F.debut, tr = u >= 0 && u < F.duree, R = G.forts?.ret;
  const ret = { creuse: `on se retranche (ordre gratuit, un mois) : les soldats creusent, ${R ? R.nb : 0} %`, retranche: 'armée retranchée derrière sa tranchée, gabions et fascines', leve: 'on lève le camp : l\'armée repart, le retranchement s\'efface', marche: 'armée en campagne, sans retranchement' }[st.etat];
  return `Forts d'armée · ${NOM_FORT[n]} (niveau ${n}) : ${STYLE_FORT[EPOQUE].nom[n - 1]} · vision ${VISION_FORT[n]} cases${tr ? ` · travaux ${Math.min(99, Math.round(u / F.duree * 100))} %` : ''} · à gauche, ${ret}${G.forts?.pris?.notre ? ' · à droite, le fort rival est pris' : ''}.`;
}
// ---- boutons
const allerForts = () => { if (SC.courante === 'forts') return; voir('forts', false); document.querySelectorAll('[data-voir]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.voir === 'forts'))); };
document.querySelectorAll('[data-fort]').forEach(b => b.addEventListener('click', () => { allerForts(); niveauFort(+b.dataset.fort); document.querySelectorAll('[data-fort]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
document.querySelectorAll('[data-retranche]').forEach(b => b.addEventListener('click', () => {
  allerForts(); const st = FORTS.ret, oui = b.dataset.retranche === 'oui', k = FORTS.kRet;
  vue.auto = false; vue.but = { x: k.x, z: k.z - 0.05, d: 3.4, tg: 0.8, la: 0.08 }; // la caméra se rapproche de l'armée pour qu'on voie l'ordre
  // « Se retrancher » recommence toujours le chantier depuis zéro ; « Lever le camp » n'a rien à faire si l'armée est déjà partie
  if (!oui && (st.etat === 'leve' || st.etat === 'marche')) { st.auto = false; return; }
  Object.assign(st, { etat: oui ? 'creuse' : 'leve', debut: t, auto: false });
}));
