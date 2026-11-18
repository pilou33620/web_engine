// ---------------------------------------------------------------- remparts : une amélioration de la ville, quatre niveaux, aspect selon l'époque
// Tout est en unités du monde (une case = 1). L'enceinte suit le contour extérieur d'un groupe d'hexagones : la case de la mairie
// aux niveaux 1 et 2, la mairie et ses cases voisines aux niveaux 3 et 4. Le tracé est rentré de RE depuis le bord des cases
// (hexagones de rayon 1, sommets vers ±z) pour ne pas mordre sur les cases d'à côté ; les bastions sortent aux angles saillants.
// Chaque morceau de mur est posé sur sa case (sa hauteur) et descend jusqu'au sol le plus bas autour ; portes là où passent les routes,
// arches sur les rivières.
const RE = 0.1;
const NOM_REMP = { 1: 'Palissade', 2: 'Murailles', 3: 'Bastions', 4: 'Citadelle' };
const STYLE_REMP = {
  ancien: { pierre: 0xd4bf8c, haut: 0xf2e8cc, toit: 0xa8553a, bois: 0x8a5a2e, h: 1, nom: ['pieux de bois, fossé, porte de bois', 'pierre ocre, tours rondes à toits de tuiles, porte fortifiée', 'enceinte étoilée de pierre, échauguettes, fossé sec, glacis', 'double enceinte, demi-lunes, fossé en eau, échauguettes'] },
  lumieres: { pierre: 0xd2c3a0, haut: 0xf6f0de, toit: ARDOISE, bois: 0xa0703c, h: 1, nom: ['pieux clairs, banquette de terre, porte couverte', 'pierre claire, tours à toits d\'ardoise, porte fortifiée', 'bastions de pierre claire, échauguettes et canons de bronze, fossé, glacis', 'double enceinte, demi-lunes, fossé en eau, canons de bronze'] },
  empire: { pierre: 0xcbc5b4, haut: 0xe2ddd0, toit: null, bois: 0x8c7d68, h: 0.95, nom: ['pieux sur un rempart de terre gazonné, fossé', 'pierre grise, tours basses à plate-forme et canon', 'bastions de pierre grise gazonnés, canons, fossé, glacis', 'double enceinte, demi-lunes, fossé en eau, batteries'] },
  industrie: { pierre: 0xa8553c, haut: 0x8a3f2c, toit: null, bois: 0x3d342c, h: 0.8, nom: ['poteaux goudronnés, lisses, porte de fer', 'brique, tours plates à meurtrières, porte de fer', 'remparts bas de brique et de terre, canons de fer, fossé, glacis', 'brique et terre, demi-lunes, fossé en eau, canons rayés'] },
};
const HERBE = 0x9ab85c, TERRE = 0x8f744a, EAU_F = 0x3f93cc, GLACIS = 0xc6d98c;
const ryDe = (ux, uz) => Math.atan2(-uz, ux); // rotation d'une pièce dont l'axe x doit suivre (ux, uz)
// une pièce tournée APRÈS le calcul de son contour : traits de même épaisseur quelle que soit son orientation
function putR(L, geo, col, x, y, z, ry = 0, ep = 0.006) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); couleur(g, col);
  const o = ep ? contour(g, ep) : null;
  for (const m of o ? [g, o] : [g]) { m.rotateY(ry); m.translate(x, y, z); }
  L.g.push(g); if (o) L.o.push(o);
}
const aire = P => { let A = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length]; A += x1 * z2 - x2 * z1; } return A / 2; };
// polygone décalé vers l'extérieur de d (vers l'intérieur si d < 0), joints en onglet limités à lim × d
function decale(P, d, lim = 2.2) {
  const n = P.length, sg = aire(P) > 0 ? 1 : -1;
  const nor = i => { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % n], l = Math.hypot(x2 - x1, z2 - z1) || 1; return [sg * (z2 - z1) / l, -sg * (x2 - x1) / l]; };
  return P.map((p, i) => { const a = nor((i - 1 + n) % n), b = nor(i), c = a[0] * b[0] + a[1] * b[1], f = Math.min(lim, Math.sqrt(2 / Math.max(1 + c, 0.05))), sx = a[0] + b[0], sz = a[1] + b[1], l = Math.hypot(sx, sz) || 1; return [p[0] + sx / l * d * f, p[1] + sz / l * d * f]; });
}
// prisme droit sur un polygone [x, z] (convexe ou non, trous possibles) et son contour brun
function dalle(L, P, y0, y1, col, ep = 0.01, trous = []) {
  const fait = (Q, H, a, b) => { const s = new THREE.Shape(Q.map(([x, z]) => new THREE.Vector2(x, -z))); for (const h of H) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))); const g = new THREE.ExtrudeGeometry(s, { depth: b - a, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, a, 0); return g; };
  put(L, fait(P, trous, y0, y1), col, 0, 0, 0, 0, 0);
  if (ep) { const o = fait(decale(P, ep), trous.map(h => decale(h, -ep)), y0 - ep, y1 + ep); o.deleteAttribute('uv'); L.o.push(o); }
}
// contour extérieur d'un groupe de cases : polygone de sens direct dans (x, z), et pour chaque côté la case du dedans et celle du dehors
function contourGroupe(groupe) {
  const dans = new Set(groupe), cle = p => Math.round(p[0] * 1e3) + ',' + Math.round(p[1] * 1e3), arcs = new Map();
  for (const k of groupe) for (let i = 0; i < 6; i++) {
    const am = (i + 0.5) * Math.PI / 3, px = k.x + Math.sin(am) * SQ3, pz = k.z + Math.cos(am) * SQ3, n0 = caseEn(px, pz), n = n0 && Math.hypot(n0.x - px, n0.z - pz) < 0.3 ? n0 : null;
    if (n && dans.has(n)) continue;
    const a = i * Math.PI / 3, b = a + Math.PI / 3;
    arcs.set(cle([k.x + Math.sin(a), k.z + Math.cos(a)]), { A: [k.x + Math.sin(a), k.z + Math.cos(a)], B: [k.x + Math.sin(b), k.z + Math.cos(b)], k, out: n }); // shortcut: un groupe pincé (deux cases ne se touchant que par un sommet) perd une boucle ; les villes sont compactes
  }
  let best = null;
  while (arcs.size) {
    const [c0, a0] = arcs.entries().next().value, b = []; let a = a0, c = c0;
    while (a) { arcs.delete(c); b.push(a); c = cle(a.B); a = arcs.get(c); }
    if (!best || Math.abs(aire(b.map(x => x.A))) > Math.abs(aire(best.map(x => x.A)))) best = b; // la plus grande boucle : l'extérieur
  }
  const r = best.slice().reverse(); // les cases tournent en sens indirect : on renverse
  return { P: r.map(a => a.B), ed: r.map(a => ({ k: a.k, out: a.out })) };
}
// la rivière telle que construirePlateau la trace (mêmes courbes), pour y percer des arches
function lignesRiviere() {
  const mil = (a, b) => [(a.x + b.x) / 2, (a.z + b.z) / 2];
  return RIV.map((k, i) => {
    const av = RIV[i - 1], ap = RIV[i + 1] || k.versMer, A = av ? mil(k, av) : [k.x + 0.2, k.z - 0.2], B = ap ? mil(k, ap) : [k.x - 0.15, k.z + 0.15], C = [k.x + (hache(k.c, k.r, 5) - 0.5) * 0.4, k.z + (hache(k.c, k.r, 6) - 0.5) * 0.4];
    const pts = []; for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push([(1 - t) ** 2 * A[0] + 2 * t * (1 - t) * C[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * C[1] + t * t * B[1]]); }
    return { pts, larg: 0.5 };
  });
}
function croise(A, B, C, D) { // paramètre sur AB du croisement des segments AB et CD, ou -1
  const r0 = B[0] - A[0], r1 = B[1] - A[1], s0 = D[0] - C[0], s1 = D[1] - C[1], den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((C[0] - A[0]) * s1 - (C[1] - A[1]) * s0) / den, u = ((C[0] - A[0]) * r1 - (C[1] - A[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}
// ---- une enceinte complète. passages : [{ pts, larg }] (routes larg ~0,17, rivières ~0,5). Rend { murs, sol, pointes, H, Q } :
// murs = ce qui s'élève pendant les travaux, sol = fossé et glacis, pointes = sommets saillants (défenseurs), Q = tracé de la face extérieure.
// breche [x, z] (siège) : la courtine la plus proche de ce point est coupée en trois, le morceau du milieu à part (rend breche, infoBreche).
function enceinte(parent, groupe, niveau, passages, style = STYLE_REMP[EPOQUE], breche = null) {
  const indus = EPOQUE === 'industrie', st = style;
  const H = { 1: 0.08, 2: 0.13, 3: 0.13, 4: 0.15 }[niveau] * (niveau >= 3 ? st.h : 1), w = { 1: 0.024, 2: 0.055, 3: 0.085, 4: 0.095 }[niveau];
  const { P, ed } = contourGroupe(groupe), n = P.length;
  const Q = decale(P, -RE), Qi = decale(P, -(RE + w));
  const sol = k => (k ? Math.max(k.top ?? topDe(k), MER) : MER);
  const yIn = j => ed[j].k.top ?? topDe(ed[j].k), yBas = j => Math.min(yIn(j), sol(ed[j].out)) - 0.04;
  const ymin = Math.min(...ed.map((e, j) => Math.min(yIn(j), sol(e.out))));
  const U = Q.map((q, j) => { const r = Q[(j + 1) % n], l = Math.hypot(r[0] - q[0], r[1] - q[1]); return { ux: (r[0] - q[0]) / l, uz: (r[1] - q[1]) / l, l }; });
  const N = U.map(u => [u.uz, -u.ux]); // normale vers l'extérieur (polygone direct)
  const saillant = v => { const a = U[(v - 1 + n) % n], b = U[v]; return a.ux * b.uz - a.uz * b.ux > 0; };
  // ouvertures : où les routes et rivières coupent la face extérieure
  const ouv = U.map(() => []);
  for (const ps of passages) for (let i = 0; i < ps.pts.length - 1; i++) for (let j = 0; j < n; j++) {
    const t = croise(Q[j], Q[(j + 1) % n], ps.pts[i], ps.pts[i + 1]); if (t < 0) continue;
    const s = t * U[j].l; if (ouv[j].some(o => Math.abs(o.s - s) < 0.05)) continue;
    ouv[j].push({ s, g: ps.larg, eau: ps.larg > 0.3 });
  }
  for (const o of ouv) { o.sort((a, b) => a.s - b.s); for (let i = o.length - 1; i > 0; i--) if (o[i].s - o[i].g / 2 < o[i - 1].s + o[i - 1].g / 2) { const a = o[i - 1], b = o.splice(i, 1)[0], s0 = Math.min(a.s - a.g / 2, b.s - b.g / 2), s1 = Math.max(a.s + a.g / 2, b.s + b.g / 2); a.s = (s0 + s1) / 2; a.g = s1 - s0; a.eau = a.eau || b.eau; } }
  // bastions (niveaux 3-4) aux angles saillants, tours (niveau 2) à tous les angles, sauf là où une ouverture les gênerait
  const f = 0.19, sf = 0.1, Lt = 0.3;
  const libre = (v, marge) => { const jp = (v - 1 + n) % n; return !ouv[jp].some(o => o.s + o.g / 2 > U[jp].l - marge) && !ouv[v].some(o => o.s - o.g / 2 < marge); };
  const bast = Q.map((_, v) => niveau >= 3 && saillant(v) && libre(v, f + 0.02));
  const murs = new THREE.Group(), solG = new THREE.Group(); parent.add(murs); parent.add(solG);
  const L = lot(), Ls = lot();
  const O = (j, s) => [Q[j][0] + U[j].ux * s, Q[j][1] + U[j].uz * s];
  const I = (j, s) => (s <= 1e-6 ? Qi[j] : s >= U[j].l - 1e-6 ? Qi[(j + 1) % n] : [O(j, s)[0] - N[j][0] * w, O(j, s)[1] - N[j][1] * w]);
  const cap = niveau >= 3 ? HERBE : st.haut; // terre-plein gazonné des remparts bastionnés
  // ---- courtines (ou palissade), morceau par morceau entre les ouvertures et les bastions
  const pieces = [];
  for (let j = 0; j < n; j++) {
    const a0 = bast[j] ? f : 0, b0 = U[j].l - (bast[(j + 1) % n] ? f : 0); let a = a0;
    for (const o of ouv[j]) { if (o.s - o.g / 2 > a) pieces.push([j, a, Math.min(b0, o.s - o.g / 2)]); a = Math.max(a, o.s + o.g / 2); }
    if (a < b0) pieces.push([j, a, b0]);
  }
  const y1 = j => yIn(j) + H;
  let ib = -1, LB = null, infoBreche = null;
  if (breche && niveau >= 2) { let dm = Infinity; pieces.forEach(([j, a, b], i) => { if (b - a < 0.3) return; const c = O(j, (a + b) / 2), d = Math.hypot(c[0] - breche[0], c[1] - breche[1]); if (d < dm) { dm = d; ib = i; } }); }
  const morceau = (L, j, a, b) => {
    const o0 = O(j, a), o1 = O(j, b), i0 = I(j, a), i1 = I(j, b), nx = N[j][0], nz = N[j][1];
    if (niveau === 1) { // palissade : bande de pieux, pointes ou poteaux plats, et ce qui la porte selon l'époque
      if (EPOQUE === 'empire') dalle(L, [[o0[0] + nx * 0.03, o0[1] + nz * 0.03], [o1[0] + nx * 0.03, o1[1] + nz * 0.03], [i1[0] - nx * 0.03, i1[1] - nz * 0.03], [i0[0] - nx * 0.03, i0[1] - nz * 0.03]], yBas(j), yIn(j) + 0.03, HERBE, 0.008);
      if (EPOQUE === 'lumieres') dalle(L, [i0, i1, [i1[0] - nx * 0.04, i1[1] - nz * 0.04], [i0[0] - nx * 0.04, i0[1] - nz * 0.04]], yBas(j), yIn(j) + 0.022, 0xb59c68, 0.006);
      const yb = yIn(j) + (EPOQUE === 'empire' ? 0.03 : 0), hp = H - 0.025;
      dalle(L, [o0, o1, i1, i0], yBas(j), yb + hp, st.bois, 0.008);
      const ux = U[j].ux, uz = U[j].uz;
      for (let s = a + 0.013; s < b - 0.006; s += 0.026) { const p = O(j, s), cx = p[0] - nx * w / 2, cz = p[1] - nz * w / 2; if (indus) putR(L, boite(0.02, 0.022, w * 0.95), st.bois, cx, yb + hp + 0.011, cz, ryDe(ux, uz), 0.004); else putR(L, cone(0.012, 0.03, 5), st.bois, cx, yb + hp + 0.015, cz, 0, 0.004); }
      if (indus) for (const hh of [0.022, 0.05]) dalle(L, [[o0[0] + nx * 0.006, o0[1] + nz * 0.006], [o1[0] + nx * 0.006, o1[1] + nz * 0.006], o1, o0], yb + hh, yb + hh + 0.008, 0x6b5a48, 0);
      return;
    }
    dalle(L, [o0, o1, i1, i0], yBas(j), y1(j), st.pierre, 0.013);
    const pw = niveau === 2 ? 0.016 : 0.022, p0 = [o0[0] - nx * pw, o0[1] - nz * pw], p1 = [o1[0] - nx * pw, o1[1] - nz * pw];
    dalle(L, [p0, p1, i1, i0], y1(j), y1(j) + 0.004, cap, 0);
    if (niveau === 2) { // créneaux
      dalle(L, [o0, o1, p1, p0], y1(j), y1(j) + 0.012, st.haut, 0.005);
      if (!(EPOQUE === 'empire')) for (let s = a + 0.02; s < b - 0.012; s += 0.036) { const p = O(j, s); putR(L, boite(0.018, 0.016, pw), st.haut, p[0] - nx * pw / 2, y1(j) + 0.02, p[1] - nz * pw / 2, ryDe(U[j].ux, U[j].uz), 0.004); }
      if (indus) for (let s = a + 0.05; s < b - 0.03; s += 0.09) { const p = O(j, s); putR(L, boite(0.008, 0.022, 0.006), 0x2a1d14, p[0] + nx * 0.002, y1(j) - 0.04, p[1] + nz * 0.002, ryDe(U[j].ux, U[j].uz), 0); } // meurtrières
    } else dalle(L, [o0, o1, p1, p0], y1(j), y1(j) + (indus ? 0.02 : 0.018), indus ? HERBE : st.haut, 0.006); // parapet (de terre à l'ère industrielle)
  };
  pieces.forEach(([j, a, b], i) => {
    if (i !== ib) return morceau(L, j, a, b);
    const c = (b - a) * 0.3; LB = lot(); morceau(L, j, a, a + c); morceau(LB, j, a + c, b - c); morceau(L, j, b - c, b);
    infoBreche = { O: O(j, (a + b) / 2), n: N[j], y: yIn(j), H };
  });
  // ---- tours rondes (niveau 2)
  if (niveau === 2) Q.forEach((q, v) => {
    if (!libre(v, 0.075)) return;
    const j = saillant(v) ? v : (v - 1 + n) % n, y = yIn(j), r = 0.062, ht = H + (EPOQUE === 'empire' || indus ? 0.03 : 0.05), b = Math.min(yBas(v), yBas((v - 1 + n) % n)), cx = q[0] - (N[v][0] + N[(v - 1 + n) % n][0]) * 0.012, cz = q[1] - (N[v][1] + N[(v - 1 + n) % n][1]) * 0.012;
    putR(L, cyl(r, r * 1.08, y + ht - b, 12), st.pierre, cx, (b + y + ht) / 2, cz, 0, 0.01);
    if (st.toit) { putR(L, cyl(r * 1.08, r * 1.08, 0.01, 12), st.haut, cx, y + ht + 0.005, cz, 0, 0.004); putR(L, cone(r * 1.18, 0.085, 12), st.toit, cx, y + ht + 0.052, cz, 0, 0.008); }
    else {
      putR(L, cyl(r * 1.1, r * 1.1, 0.018, 12), st.haut, cx, y + ht + 0.009, cz, 0, 0.005); putR(L, cyl(r * 0.85, r * 0.85, 0.004, 12), indus ? 0x6a3020 : HERBE, cx, y + ht + 0.019, cz, 0, 0);
      if (EPOQUE === 'empire') { const bx = cyl(0.008, 0.011, 0.06, 6); bx.rotateZ(-Math.PI / 2); const ox = (N[v][0] + N[(v - 1 + n) % n][0]) / 2, oz = (N[v][1] + N[(v - 1 + n) % n][1]) / 2; putR(L, bx, BRONZE, cx + ox * 0.04, y + ht + 0.03, cz + oz * 0.04, ryDe(ox, oz), 0.003); }
    }
  });
  // ---- bastions (niveaux 3-4) : faces, flancs, gorge sur la courtine ; échauguettes (1700, Lumières) ou canons (Lumières et après)
  const pointes = [], ENV = [], FULL = [];
  Q.forEach((q, v) => {
    const jp = (v - 1 + n) % n;
    if (!bast[v]) { FULL.push(q); ENV.push(q); if (niveau >= 3 && saillant(v)) pointes.push({ x: q[0], z: q[1], y: y1(v), nx: (N[v][0] + N[jp][0]) / 2, nz: (N[v][1] + N[jp][1]) / 2 }); return; }
    const u1 = U[jp], u2 = U[v], n1 = N[jp], n2 = N[v], bx = n1[0] + n2[0], bz = n1[1] + n2[1], bl = Math.hypot(bx, bz), bi = [bx / bl, bz / bl];
    const F1 = [q[0] - u1.ux * f, q[1] - u1.uz * f], F2 = [q[0] + u2.ux * f, q[1] + u2.uz * f], S1 = [F1[0] + n1[0] * sf, F1[1] + n1[1] * sf], S2 = [F2[0] + n2[0] * sf, F2[1] + n2[1] * sf], T = [q[0] + bi[0] * Lt, q[1] + bi[1] * Lt];
    const F1i = [F1[0] - n1[0] * w, F1[1] - n1[1] * w], F2i = [F2[0] - n2[0] * w, F2[1] - n2[1] * w];
    const poly = [F1, S1, T, S2, F2, F2i, Qi[v], F1i], y = yIn(v), yb = Math.min(yBas(v), yBas(jp)), yh = y + H + 0.004;
    dalle(L, poly, yb, yh, st.pierre, 0.013);
    dalle(L, decale(poly, -0.024), yh, yh + 0.004, cap, 0);
    for (const [A, B] of [[F1, S1], [S1, T], [T, S2], [S2, F2]]) { const l = Math.hypot(B[0] - A[0], B[1] - A[1]), ix = -(B[1] - A[1]) / l * 0.022, iz = (B[0] - A[0]) / l * 0.022, sg = Math.sign(ix * (q[0] - A[0]) + iz * (q[1] - A[1])) || 1; dalle(L, [A, B, [B[0] + ix * sg, B[1] + iz * sg], [A[0] + ix * sg, A[1] + iz * sg]], yh, yh + (indus ? 0.02 : 0.018), indus ? HERBE : st.haut, 0.005); }
    if (!indus && EPOQUE !== 'empire') { const ex = T[0] - bi[0] * 0.03, ez = T[1] - bi[1] * 0.03; putR(L, cyl(0.03, 0.024, 0.07, 8), st.haut, ex, yh + 0.035, ez, 0, 0.006); putR(L, cone(0.042, 0.06, 8), st.toit || ARDOISE, ex, yh + 0.1, ez, 0, 0.006); }
    if (EPOQUE !== 'ancien') for (const s of [-1, 1]) { const px = q[0] + bi[0] * 0.1 - bi[1] * s * 0.045, pz = q[1] + bi[1] * 0.1 + bi[0] * s * 0.045, c = cyl(0.008, 0.012, 0.07, 6); c.rotateZ(-Math.PI / 2); putR(L, c, indus ? 0x3a3d42 : BRONZE, px, yh + 0.022, pz, ryDe(bi[0], bi[1]), 0.003); }
    FULL.push(F1, S1, T, S2, F2); ENV.push(S1, T, S2);
    pointes.push({ x: T[0] - bi[0] * 0.07, z: T[1] - bi[1] * 0.07, y: yh, nx: bi[0], nz: bi[1] });
  });
  // ---- portes et arches
  for (let j = 0; j < n; j++) for (const o of ouv[j]) {
    const c = O(j, o.s), nx = N[j][0], nz = N[j][1], ry = ryDe(U[j].ux, U[j].uz), y = yIn(j), cx = c[0] - nx * w / 2, cz = c[1] - nz * w / 2, g = o.g;
    if (o.eau) { // la rivière passe sous une arche (une estacade de pieux pour la palissade)
      if (niveau === 1) { for (const s of [-1, 1]) putR(L, boite(0.02, H + 0.03, 0.02), st.bois, c[0] + U[j].ux * s * g / 2, y + (H + 0.03) / 2 - 0.02, c[1] + U[j].uz * s * g / 2, ry, 0.005); putR(L, boite(g, 0.014, 0.014), st.bois, c[0], y + 0.03, c[1], ry, 0.004); }
      else {
        putR(L, boite(g + 0.01, H * 0.5, w), st.pierre, cx, y + H * 0.75, cz, ry, 0.01); putR(L, boite(g, 0.01, w * 0.9), st.haut, cx, y + H + 0.005, cz, ry, 0);
        for (let s = -g / 2 + 0.03; s < g / 2 - 0.02; s += 0.04) putR(L, boite(0.008, H * 0.5, 0.008), 0x2b2b30, c[0] + U[j].ux * s + nx * 0.005, y + H * 0.25 + 0.01, c[1] + U[j].uz * s + nz * 0.005, ry, 0);
        for (const s of [-1, 1]) putR(L, boite(0.03, H + 0.01, w + 0.01), st.pierre, cx + U[j].ux * s * (g / 2 + 0.01), y + (H + 0.01) / 2 - 0.01, cz + U[j].uz * s * (g / 2 + 0.01), ry, 0.008);
      }
      continue;
    }
    if (niveau === 1) { // deux poteaux, linteau, deux vantaux ; toit à deux pans aux Lumières ; fer à l'ère industrielle
      for (const s of [-1, 1]) putR(L, boite(0.026, H + 0.04, 0.026), st.bois, c[0] + U[j].ux * s * (g / 2 + 0.005), y + (H + 0.04) / 2, c[1] + U[j].uz * s * (g / 2 + 0.005), ry, 0.005);
      putR(L, boite(g + 0.05, 0.018, 0.026), st.bois, c[0], y + H + 0.04, c[1], ry, 0.005);
      for (const s of [-1, 1]) putR(L, boite(g / 2 - 0.006, H * 0.75, 0.01), indus ? 0x3a3d42 : 0x6b4426, c[0] + U[j].ux * s * g / 4 + nx * 0.006, y + H * 0.375, c[1] + U[j].uz * s * g / 4 + nz * 0.006, ry, 0.004);
      if (EPOQUE === 'lumieres') putR(L, cyl(0.04, 0.04, g + 0.08, 3).rotateZ(Math.PI / 2).scale(1, 0.7, 0.8), st.toit, c[0], y + H + 0.065, c[1], ry, 0.005);
      continue;
    }
    if (niveau === 2) { // châtelet : corps de garde au-dessus du passage, deux tourelles, toit ou plate-forme
      const gw = g + 0.05, gd = w + 0.05, gh = H + 0.045;
      putR(L, boite(gw, gh, gd), st.pierre, cx, y + gh / 2, cz, ry, 0.01);
      putR(L, boite(g * 0.8, H * 0.7, 0.01), indus ? 0x3a3d42 : 0x3a2a1e, c[0] + nx * 0.026, y + H * 0.35, c[1] + nz * 0.026, ry, 0);
      if (st.toit) putR(L, cone(gw * 0.78, 0.07, 4).rotateY(Math.PI / 4).scale(1, 1, gd / gw), st.toit, cx, y + gh + 0.035, cz, ry, 0.006);
      else for (let s = -gw / 2 + 0.012; s <= gw / 2; s += 0.03) putR(L, boite(0.016, 0.016, 0.016), st.haut, cx + U[j].ux * s + nx * gd * 0.4, y + gh + 0.008, cz + U[j].uz * s + nz * gd * 0.4, ry, 0.004);
      continue;
    }
    // niveaux 3-4 : pavillon de porte et pont sur le fossé
    const gw = g + 0.04, gd = w + 0.02, gh = H + 0.035;
    putR(L, boite(gw, gh, gd), indus ? st.pierre : st.haut, cx, y + gh / 2, cz, ry, 0.009);
    putR(L, boite(g * 0.7, H * 0.65, 0.01), indus ? 0x3a3d42 : 0x3a2a1e, c[0] + nx * 0.006, y + H * 0.325, c[1] + nz * 0.006, ry, 0);
    if (!indus) putR(L, cyl(0.06, 0.06, gw * 0.9, 3).rotateZ(Math.PI / 2).scale(1, 0.5, 0.2), st.haut, c[0] + nx * 0.004, y + gh + 0.012, c[1] + nz * 0.004, ry, 0.004); // fronton
    const pl = niveau === 4 ? 0.15 : 0.12; putR(Ls, boite(0.085, 0.012, pl), indus ? 0x8a867e : 0x8b5a2b, c[0] + nx * pl / 2, Math.max(ymin, y - 0.02) + 0.012, c[1] + nz * pl / 2, ry, 0.005);
  }
  // ---- fossé, glacis, demi-lunes (niveau 4) ; fossé simple devant la palissade
  if (niveau === 1) dalle(Ls, decale(Q, 0.055), ymin + 0.003, ymin + 0.006, 0x8a6a44, 0, [decale(Q, 0.012)]);
  if (niveau >= 3) {
    const dm = niveau === 4 ? 0.13 : 0.1, dg = 0.11, M = decale(ENV, dm, 1.6), Gl = decale(ENV, dm + dg, 1.6);
    dalle(Ls, M, ymin + 0.004, ymin + (niveau === 4 ? 0.008 : 0.007), niveau === 4 ? EAU_F : TERRE, 0, [FULL]);
    dalle(Ls, Gl, ymin + 0.002, ymin + 0.005, GLACIS, 0, [M]);
    dalle(Ls, decale(Gl, 0.012), ymin + 0.002, ymin + 0.0045, 0x6f8a44, 0, [Gl]); // liseré du glacis, lisible de loin
    if (niveau === 4) Q.forEach((q, v) => {
      if (saillant(v) || !libre(v, 0.3)) return;
      const jp = (v - 1 + n) % n, bx = N[v][0] + N[jp][0], bz = N[v][1] + N[jp][1], bl = Math.hypot(bx, bz), b = [bx / bl, bz / bl], p = [-b[1], b[0]];
      const tri = [[q[0] + b[0] * 0.07 + p[0] * 0.16, q[1] + b[1] * 0.07 + p[1] * 0.16], [q[0] + b[0] * 0.36, q[1] + b[1] * 0.36], [q[0] + b[0] * 0.07 - p[0] * 0.16, q[1] + b[1] * 0.07 - p[1] * 0.16]];
      dalle(Ls, decale(tri, 0.04), ymin + 0.004, ymin + 0.0085, EAU_F, 0);
      dalle(L, tri, ymin - 0.02, ymin + H * 0.62, st.pierre, 0.009); dalle(L, decale(tri, -0.02), ymin + H * 0.62, ymin + H * 0.62 + 0.004, cap, 0);
      pointes.push({ x: tri[1][0] - b[0] * 0.06, z: tri[1][1] - b[1] * 0.06, y: ymin + H * 0.62, nx: b[0], nz: b[1], demi: true });
    });
  }
  fige(L, murs); fige(Ls, solG);
  return { murs, sol: solG, pointes, H, Q, ouv, breche: LB ? fige(LB, murs) : null, infoBreche };
}
// la ville : la case de la mairie et ses voisines de terre ; routes et voie ferrée actives, rivière
const voisinesVille = k => voisins(k).filter(n => !TERR[n.t].eau && n.t !== 'montagne');
function passagesCapitale() {
  const r = CHEMINS.filter(c => !c.ere || c.ere === EPOQUE).map(c => ({ pts: c.pts2, larg: 0.17 }));
  if (EPOQUE === 'industrie' && RAIL) r.push({ pts: RAIL.pts, larg: 0.17 });
  return r.concat(lignesRiviere());
}
// les remparts d'une ville au niveau donné : niveaux 1-2 sur la mairie ; 3 sur le groupe ; 4 sur le groupe + l'ancienne enceinte en réduit
function remparts(parent, mairie, groupe, niveau, passages, breche = null) {
  const g = new THREE.Group(); parent.add(g);
  const e = enceinte(g, niveau >= 3 ? groupe : [mairie], niveau, passages, STYLE_REMP[EPOQUE], breche);
  if (niveau === 4) { const r = enceinte(g, [mairie], 2, passages); r.murs.parent.remove(r.murs); e.murs.add(r.murs); e.sol.add(r.sol); }
  e.g = g; return e;
}
// échafaudages le long d'un tracé : perches, lisses, quelques blocs de pierre
function echafaudages(parent, Q, H) {
  const L = lot(), n = Q.length;
  for (let j = 0; j < n; j++) {
    const a = Q[j], b = Q[(j + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = uz, nz = -ux, y = solEn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let s = 0.03; s < l - 0.02; s += 0.075) putR(L, boite(0.006, H + 0.05, 0.006), 0x9a7a4a, a[0] + ux * s + nx * 0.035, y + (H + 0.05) / 2, a[1] + uz * s + nz * 0.035, 0, 0.003);
    for (const hh of [0.45, 0.9]) putR(L, boite(l - 0.02, 0.006, 0.006), 0x9a7a4a, (a[0] + b[0]) / 2 + nx * 0.035, y + (H + 0.05) * hh, (a[1] + b[1]) / 2 + nz * 0.035, ryDe(ux, uz), 0.003);
    if (j % 3 === 0) for (let i = 0; i < 3; i++) putR(L, boite(0.03, 0.02, 0.025), 0xd8cfb4, a[0] + ux * (0.3 + i * 0.035) + nx * 0.1, y + 0.01, a[1] + uz * (0.3 + i * 0.035) + nz * 0.1, ryDe(ux, uz), 0.004);
  }
  return fige(L, parent);
}
// ---- nos remparts (scène « Remparts ») : niveau choisi, travaux quand on monte de niveau
const REMP = { niveau: 3, debut: -99, duree: 5, cur: null, vieux: null, echaf: null };
function construireRempartsCapitale(travaux = false) {
  const groupe = [centre, ...voisinesVille(centre)], e = remparts(GUERRE, centre, groupe, REMP.niveau, passagesCapitale());
  if (REMP.vieux) { REMP.vieux.g.parent?.remove(REMP.vieux.g); REMP.vieux = null; }
  if (REMP.echaf) { REMP.echaf.parent?.remove(REMP.echaf); REMP.echaf = null; }
  if (travaux && REMP.cur) { REMP.vieux = REMP.cur; REMP.debut = t; REMP.echaf = echafaudages(GUERRE, e.Q, e.H); e.murs.scale.y = 0.03; }
  else { if (REMP.cur) REMP.cur.g.parent?.remove(REMP.cur.g); REMP.debut = -99; }
  REMP.cur = e;
}
function niveauRemparts(nv) {
  const monte = nv > REMP.niveau; REMP.niveau = nv;
  construireRempartsCapitale(monte);
}
function animRemparts(dt, tps) {
  const u = tps - REMP.debut, e = REMP.cur; if (!e) return;
  if (u >= 0 && u < REMP.duree) {
    e.murs.scale.y = 0.03 + 0.97 * lisse(0.6, REMP.duree - 0.4, u);
    if (REMP.vieux) REMP.vieux.g.visible = u < REMP.duree * 0.45;
    if (Math.random() < dt * 9) { const q = e.Q[Math.random() * e.Q.length | 0]; fumer({ x: q[0], y: solEn(q[0], q[1]) + 0.03, z: q[1] }, { c: POUSSIERE, k: 0.7, vie: 1.6, vy: 0.08 }); }
  } else if (REMP.debut > -99 && u >= REMP.duree) { e.murs.scale.y = 1; if (REMP.vieux) { REMP.vieux.g.parent?.remove(REMP.vieux.g); REMP.vieux = null; } if (REMP.echaf) { REMP.echaf.parent?.remove(REMP.echaf); REMP.echaf = null; } REMP.debut = -99; }
}
// ---------------------------------------------------------------- siège d'une grande ville rivale : enceinte agrandie (niveau 3), faubourgs arrêtés et pillés,
// et en même temps le siège en règle de la petite ville : parallèles, batteries, brèche dans la courtine qui fait face au camp, famine, reddition, assaut.
// Mairie en (13, 4), ses six voisines bâties dans les murs ; notre camp en (10, 4) sur la colline ; les tranchées sur (11, 4), droit vers la courtine ouest ;
// quatre faubourgs hors les murs de part et d'autre des tranchées.
const VILLE2 = { mairie: at(13, 4), faubourgs: [at(11, 3), at(11, 5), at(12, 2), at(13, 2)], camp: at(10, 4), approche: at(11, 4), niveau: 3 };
VILLE2.anneau = voisins(VILLE2.mairie);
for (const k of [VILLE2.mairie, ...VILLE2.anneau, ...VILLE2.faubourgs]) { k.bati = true; if (k.t === 'foret') k.t = 'prairie'; }
VILLE2.camp.vide = VILLE2.approche.vide = true;
const CLES_ANNEAU = ['maison', 'marche', 'maison', 'eglise', 'maison', 'caserne'], CLES_FAUB = ['maison', 'forge', 'ferme', 'moulin'];
const NOMS_FAUB = ['des Tanneurs', 'de la Forge', 'de la Grange', 'du Moulin'];
// noircir un bâtiment incendié : toutes ses pièces hautes virent au charbon (le sol de la case reste), quelle que soit leur couleur
function noircir(L) {
  for (const g of L.g) {
    g.computeBoundingBox(); if (g.boundingBox.max.y < 0.3) continue;
    const c = g.attributes.color; for (let i = 0; i < c.count; i++) { const l = c.getX(i) * 0.3 + c.getY(i) * 0.59 + c.getZ(i) * 0.11; c.setXYZ(i, 0.07 + l * 0.12, 0.06 + l * 0.1, 0.055 + l * 0.09); }
  }
}
function construireSiege2(E, P, roy) {
  const V = VILLE2, M = V.mairie, C = V.camp, S2 = { V, faub: [], fum: [] };
  const graine = c => { let i = 0; rnd = () => hache(c * 31 + i++, 4242, 77); };
  const bat = (k, cle, Ex, drap = true, brule = false) => { graine(k.c * 13 + k.r); const L = lot(), ex = { fum: [], drap: [], ailes: [] }; ROYAUME = ROUGE; BATR[cle](L, ex, Ex, { k, cle }); ROYAUME = roy; if (brule) noircir(L); const d0 = ex.drap; if (!drap) ex.drap = []; const g = figeBat(L, ex, k, (hache(k.c, k.r, 2) * 6 | 0) * Math.PI / 3, GUERRE, ROUGE); return { g, ex, d0, monde: a => new THREE.Vector3(...a).applyMatrix4(g.matrixWorld) }; };
  // routes de la place vers les faubourgs (elles s'arrêtent au pied des maisons, comme celles du jeu)
  const ROUTE = { ancien: 0xc9a874, lumieres: 0xc9a874, empire: 0xb9b2a2, industrie: 0x8a867e }[EPOQUE], Lr = lot(), routes = [];
  for (const k of V.faubourgs) { const pts = []; for (let f = 0.17; f <= 0.86; f += 0.05) pts.push([M.x + (k.x - M.x) * f, M.z + (k.z - M.z) * f]); routes.push({ pts, larg: 0.17 }); put(Lr, ruban(pts, 0.07, 0), SAISON === 0 && EPOQUE !== 'industrie' ? 0xe3e6e2 : ROUTE, 0, 0, 0, 0, 0); }
  fige(Lr, GUERRE);
  // la ville dans les murs : ses cheminées fument (de moins en moins avec la famine) ; le drapeau de la mairie changera de couleur
  [M, ...V.anneau].forEach((k, i) => {
    const b = bat(k, i ? CLES_ANNEAU[i - 1] : 'hotel', E, i > 0);
    for (const a of b.ex.fum) S2.fum.push({ pos: b.monde(a), prochain: Math.random() * 2 });
    if (!i) S2.drapeau = drapeau(b.g, ROUGE, b.d0[0][0], b.d0[0][1], b.d0[0][2], 2.2, 1.3, 0, true);
  });
  // faubourgs : à l'arrêt (pas de fumée, ailes du moulin immobiles) ; une version incendiée, noircie, pour après le pillage
  const Edam = { ...E, h: E.h * 0.62, volets: false, colomb: false };
  V.faubourgs.forEach((k, i) => {
    const a = bat(k, CLES_FAUB[i], E), r = bat(k, CLES_FAUB[i], Edam, false, true); r.g.visible = false;
    for (const p of a.ex.ailes) { const La = lot(); for (let j = 0; j < 4; j++) { put(La, new THREE.BoxGeometry(0.05, 0.44, 0.014).translate(0, 0.22, 0).rotateZ(j * Math.PI / 2 + 0.4), 0x8b5a2b, 0, 0, 0, 0, 0.008); put(La, new THREE.BoxGeometry(0.16, 0.012, 0.006).translate(0, 0.3, 0.01).rotateZ(j * Math.PI / 2 + 0.4), 0xe9dcc0, 0, 0, 0, 0, 0); } const wg = fige(La, a.g.parent); wg.position.copy(a.monde(p)); wg.rotation.y = a.g.rotation.y; a.g.userData.ailes = wg; }
    const feux = [[0.32, 0.1], [-0.28, 0.2], [0.02, -0.34]].map(([dx, dz]) => feu(GUERRE, k.x + dx, k.top + 0.1, k.z + dz, 0.32));
    S2.faub.push({ k, intact: a.g, ruine: r.g, ailes: a.g.userData.ailes, feux, nom: NOMS_FAUB[i] });
  });
  // l'enceinte agrandie : bastions sur le contour des sept cases ; la courtine qui fait face au camp recevra la brèche
  S2.e = remparts(GUERRE, M, [M, ...V.anneau], V.niveau, routes.concat(lignesRiviere()), [C.x, C.z]);
  { const ib = S2.e.infoBreche, [ox, oz] = ib.O; S2.ux = ib.n[0]; S2.uz = ib.n[1]; S2.H = ib.y + ib.H; S2.brecheG = S2.e.breche; S2.echB = 1;
    S2.pt = (d, v) => ({ x: ox + S2.ux * (d - 0.58) - S2.uz * v, z: oz + S2.uz * (d - 0.58) + S2.ux * v }); // même repère que la petite ville : le mur vers d = 0,58
    const g = S2.pt(0.66, 0); gravatsSiege(S2, STYLE_REMP[EPOQUE].pierre, g.x, ib.y, g.z, -Math.atan2(S2.uz, S2.ux), 0.11); }
  // bastions qui regardent le camp : défenseurs, et les trois plus proches répondent au canon (on leur pose une pièce en 1700, les autres époques en ont déjà)
  const bastions = S2.e.pointes.filter(p => !p.demi).sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z));
  S2.defenseurs = bastions.slice(0, 5).map(p => { const s = soldat(GUERRE, P, ROUGE, 'ligne', ECH_GENS * 0.9); s.position.set(p.x, p.y, p.z); s.rotation.y = capVers(p.nx, p.nz); G.rivaux.push({ g: s }); return s; });
  S2.canons = bastions.slice(0, 3).map(p => new THREE.Vector3(p.x + p.nx * 0.07, p.y + 0.03, p.z + p.nz * 0.07));
  if (EPOQUE === 'ancien') { const Lc = lot(); for (const p of bastions.slice(0, 3)) { const b = cyl(0.009, 0.013, 0.075, 6); b.rotateZ(-Math.PI / 2); putR(Lc, b, BRONZE, p.x + p.nx * 0.035 - p.nz * 0.03, p.y + 0.024, p.z + p.nz * 0.035 + p.nx * 0.03, ryDe(p.nx, p.nz), 0.003); putR(Lc, boite(0.04, 0.016, 0.03), 0x8a3a2a, p.x - p.nz * 0.03, p.y + 0.01, p.z + p.nx * 0.03, ryDe(p.nx, p.nz), 0.003); } fige(Lc, GUERRE); }
  // le siège en règle, grossi pour la vue de loin : parallèles et boyaux, gabions, deux batteries ; les troupes de l'assaut
  travauxSiege(S2, P, roy, 1.7);
  troupesAssaut(S2, P, roy, ECH_GENS * 1.25);
  // notre camp sur la colline : tentes, drapeau, feu
  { const Lc = lot(); let i = 0;
    for (const [lx, lz] of [[-5, -3], [-1.5, -4.5], [2.5, -4], [-5, 3.2], [-1.5, 4.6], [2.5, 4]]) { put(Lc, cone(1.5, 2, 4), i++ % 2 ? 0xe9e2d0 : new THREE.Color(roy).getHex(), lx, 1, lz, Math.PI / 4, 0.09); put(Lc, boite(0.5, 0.9, 0.1), 0x2a2420, lx + 1.05, 0.45, lz, Math.PI / 2, 0); }
    put(Lc, boite(0.16, 5.4, 0.16), 0x4a3420, 0, 2.7, 0, 0, 0.06);
    for (const a of [0, 1.2, 2.4]) put(Lc, boite(1.4, 0.18, 0.18), 0x6b4a2a, -1 + Math.cos(a) * 0.1, 0.12, 0, a, 0.06);
    for (const [x, z] of [[1.5, -1.6], [1.5, 1.6]]) fantassin(Lc, P, x, z, roy);
    const g = fige(Lc, GUERRE); g.scale.setScalar(0.07); g.position.set(C.x - 0.12, topDe(C), C.z); g.rotation.y = capVers(M.x - C.x, M.z - C.z) - Math.PI / 2;
    drapeau(g, roy, 0, 4.7, 0, 2.4, 1.5); S2.feuCamp = versMonde(g, -1, 0.9, 0); S2.campFumee = 0;
    const fl = feu(g, -1, 0.1, 0, 2.6); fl.visible = true; S2.flammeCamp = fl; }
  // pillards : quatre de nos soldats, un sac ou une caisse de butin au retour ; chaque faubourg a son chemin, dégagé des maisons,
  // qui s'arrête au bord du faubourg côté camp (là où on les voit)
  const vers = (k, dx, dz) => [k.x + dx, k.z + dz], dep = [C.x + 0.25, C.z], nord = [C.x + 0.85, C.z - 1.35];
  const chemins = [[dep, vers(V.faubourgs[0], -0.6, 0.36)], [dep, vers(V.faubourgs[1], -0.6, -0.36)], [dep, nord, vers(V.faubourgs[2], -0.72, -0.12)], [dep, nord, vers(V.faubourgs[2], -0.1, -0.9), vers(V.faubourgs[3], -0.86, -0.3)]];
  S2.faub.forEach((F, i) => { F.chemin = cheminLisse(chemins[i]); });
  S2.pillards = [0, 1, 2, 3].map(i => { const s = soldat(GUERRE, P, roy, 'ligne', ECH_GENS * 1.15); const L = lot(); if (i % 2) put(L, boite(1.5, 1.2, 1.5), 0xb07a3a, 0, 3.6, -0.3, 0.3, 0.14); else put(L, sphere(1, 1), 0xd9c08a, 0, 3.6, -0.35, 0, 0.14); s.userData.butin = fige(L, s); s.visible = false; return s; });
  return S2;
}
function animSiege2(dt, tps) {
  const S2 = G.siege2; if (!S2) return;
  const st = SC.s2; animSiegeDe(S2, st, dt, tps, 6); // le siège en règle (un mois toutes les six secondes)
  // en parallèle, chaque mois un faubourg pillé : sortie, incendie, retour chargés de butin
  const m = Math.floor(st.mois), w = (st.mois - m) * 6, j = m - 1, nf = S2.faub.length;
  S2.faub.forEach((F, i) => {
    const pille = i < j || (i === j && w > 3.4), brule = i === j && w > 2.1 && w < 5.4 && st.assaut < 0;
    F.intact.visible = !pille; F.ruine.visible = pille; if (F.ailes) F.ailes.visible = !pille;
    F.feux.forEach(f => { f.visible = brule; if (brule) animFeu(f, tps); });
    if (brule && Math.random() < dt * 9) { const f = F.feux[Math.random() * 3 | 0].position; fumer({ x: f.x, y: f.y + 0.12, z: f.z }, { noire: true, k: 1.1, vy: 0.15 }); }
    else if (pille && Math.random() < dt * 0.7) fumer({ x: F.k.x, y: F.k.top + 0.12, z: F.k.z }, { noire: true, k: 0.55, vie: 2.2 }); // braises
  });
  const F = j < nf && st.assaut < 0 ? S2.faub[j] : null;
  S2.pillards.forEach((s, i) => {
    const wi = w - i * 0.2; s.visible = !!F && wi > 0 && wi < 5.9; s.userData.butin.visible = wi > 3.9; if (!s.visible) return;
    const ch = F.chemin, L = ch.long, sd = wi < 2.2 ? lisse(0, 2.2, wi) * L : wi < 3.9 ? L : (1 - lisse(3.9, 5.9, wi)) * L, p = ch.en(sd), retour = wi >= 3.9;
    const lat = (i - 1.5) * 0.06, px = Math.sin(p.cap) * lat, pz = Math.cos(p.cap) * lat; // de front, côte à côte
    let x = p.x + px, z = p.z + pz, cap = p.cap + Math.PI / 2 + (retour ? Math.PI : 0);
    if (wi >= 2.2 && wi < 3.9) { const a = tps * 1.3 + i * 1.6; x += Math.cos(a) * 0.05; z += Math.sin(a) * 0.05; cap = capVers(-Math.sin(a), Math.cos(a)); } // ils fouillent
    s.position.set(x, solEn(x, z) + Math.abs(Math.sin(tps * 9 + i)) * 0.006, z); s.rotation.y = cap;
  });
  // les défenseurs tirent aussi sur les pillards
  if (S2.pillards[0].visible && Math.random() < dt * 1.6) { const d = S2.defenseurs[Math.random() * S2.defenseurs.length | 0]; if (d.visible) { const p = versMonde(d, 0.42, 2.8, 0.5); eclat(p); fumer(p, { c: POUDRE, k: 0.5, vie: 1.6 }); } }
}
