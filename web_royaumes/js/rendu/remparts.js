// Les remparts des villes : une amélioration à quatre niveaux (Palissade, Murailles, Bastions à la Vauban, Citadelle),
// dont l'aspect suit l'époque (maquette validée : maquettes/guerre.html, source maquettes/source/guerre/remparts.js).
// Tout est en unités du plateau (une case = 1). L'enceinte suit le contour extérieur des cases intra-muros que le moteur
// envoie (villes[].enceinte : la mairie aux niveaux 1-2, la mairie et ses voisines aux niveaux 3-4), rentrée de RE depuis
// le bord des cases ; bastions aux angles saillants, portes là où passent les routes (pont sur le fossé), arches sur les rivières.
// Chaque morceau de mur est posé sur sa case et descend jusqu'au sol le plus bas autour. Pendant les travaux, la nouvelle
// enceinte s'élève derrière des échafaudages (poussière) ; à la fin, l'ancienne disparaît.
// Une enceinte est figée en deux maillages (murs, sol) et gardée tant que sa clé (niveau, époque, cases, hauteurs, routes,
// brèche) ne change pas.
import { THREE, scene, posCase, caseA, voisin, hache, chaqueImage } from './scene.js';
import { lot, put, fige, jeter, couleur, contour, boite, cyl, cone } from './toon.js';
import { carte, hauteur, solEn } from './plateau.js';
import { bouffee } from './vie.js';
import { campDe } from './sieges.js';

const SQ3 = Math.sqrt(3), MER = -0.15;
export const RE = 0.1; // retrait de l'enceinte depuis le bord des cases intra-muros
export const ARDOISE = 0x5d6f80, BRONZE = 0xb08d57;
export const STYLE_REMP = {
  ancien: { pierre: 0xd4bf8c, haut: 0xf2e8cc, toit: 0xa8553a, bois: 0x8a5a2e, h: 1 },
  lumieres: { pierre: 0xd2c3a0, haut: 0xf6f0de, toit: ARDOISE, bois: 0xa0703c, h: 1 },
  empire: { pierre: 0xcbc5b4, haut: 0xe2ddd0, toit: null, bois: 0x8c7d68, h: 0.95 },
  industrie: { pierre: 0xa8553c, haut: 0x8a3f2c, toit: null, bois: 0x3d342c, h: 0.8 },
};
export const HERBE = 0x9ab85c, TERRE = 0x8f744a, EAU_F = 0x3f93cc, GLACIS = 0xc6d98c;
export const ryDe = (ux, uz) => Math.atan2(-uz, ux); // rotation d'une pièce dont l'axe x doit suivre (ux, uz)
export const lisse = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const sol = i => (i >= 0 ? Math.max(hauteur(i), MER) : MER);

/** Une pièce tournée APRÈS le calcul de son contour : traits de même épaisseur quelle que soit son orientation. */
export function putR(L, geo, col, x, y, z, ry = 0, ep = 0.006) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  couleur(g, col);
  const o = ep ? contour(g, ep) : null;
  for (const m of o ? [g, o] : [g]) { m.rotateY(ry); m.translate(x, y, z); }
  L.g.push(g); if (o) L.o.push(o);
}
export const aire = P => { let A = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length]; A += x1 * z2 - x2 * z1; } return A / 2; };
/** Polygone décalé vers l'extérieur de d (vers l'intérieur si d < 0), joints en onglet limités à lim × d. */
export function decale(P, d, lim = 2.2) {
  const n = P.length, sg = aire(P) > 0 ? 1 : -1;
  const nor = i => { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % n], l = Math.hypot(x2 - x1, z2 - z1) || 1; return [sg * (z2 - z1) / l, -sg * (x2 - x1) / l]; };
  return P.map((p, i) => { const a = nor((i - 1 + n) % n), b = nor(i), c = a[0] * b[0] + a[1] * b[1], f = Math.min(lim, Math.sqrt(2 / Math.max(1 + c, 0.05))), sx = a[0] + b[0], sz = a[1] + b[1], l = Math.hypot(sx, sz) || 1; return [p[0] + sx / l * d * f, p[1] + sz / l * d * f]; });
}
/** Prisme droit sur un polygone [x, z] (convexe ou non, trous possibles) et son contour brun. */
export function dalle(L, P, y0, y1, col, ep = 0.01, trous = []) {
  const fait = (Q, H, a, b) => {
    const s = new THREE.Shape(Q.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of H) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ExtrudeGeometry(s, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, a, 0); g.deleteAttribute('uv'); return g;
  };
  put(L, fait(P, trous, y0, y1), col, 0, 0, 0, 0, 0);
  if (ep) L.o.push(fait(decale(P, ep), trous.map(h => decale(h, -ep)), y0 - ep, y1 + ep));
}
/** Contour extérieur d'un groupe de cases (indices) : polygone de sens direct dans (x, z), et pour chaque côté la case du dedans et celle du dehors (-1 hors carte). */
export function contourGroupe(groupe) {
  const dans = new Set(groupe), cle = p => Math.round(p[0] * 1e3) + ',' + Math.round(p[1] * 1e3), arcs = new Map();
  for (const k of groupe) {
    const c = posCase(k);
    for (let i = 0; i < 6; i++) {
      const am = (i + 0.5) * Math.PI / 3, px = c.x + Math.sin(am) * SQ3, pz = c.z + Math.cos(am) * SQ3, n0 = caseA(px, pz);
      const n = n0 >= 0 && Math.hypot(posCase(n0).x - px, posCase(n0).z - pz) < 0.3 ? n0 : -1;
      if (n >= 0 && dans.has(n)) continue;
      const a = i * Math.PI / 3, b = a + Math.PI / 3;
      // shortcut: un groupe pincé (deux cases ne se touchant que par un sommet) perd une boucle ; les enceintes du moteur sont compactes
      arcs.set(cle([c.x + Math.sin(a), c.z + Math.cos(a)]), { A: [c.x + Math.sin(a), c.z + Math.cos(a)], B: [c.x + Math.sin(b), c.z + Math.cos(b)], k, out: n });
    }
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
function croise(A, B, C, D) { // paramètre sur AB du croisement des segments AB et CD, ou -1
  const r0 = B[0] - A[0], r1 = B[1] - A[1], s0 = D[0] - C[0], s1 = D[1] - C[1], den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((C[0] - A[0]) * s1 - (C[1] - A[1]) * s0) / den, u = ((C[0] - A[0]) * r1 - (C[1] - A[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

// ---------------------------------------------------------------- passages : routes (même point de passage que routes.js) et rivières (même tracé que plateau.js)
const passeRoute = i => { const q = posCase(i); return [q.x + (hache(q.c, q.r, 17) - 0.5) * 0.3, q.z + (hache(q.c, q.r, 19) - 0.5) * 0.3]; };
function passages(etat, autour) {
  const r = [];
  for (const [a, b] of etat.routes || []) if (autour.has(a) || autour.has(b)) r.push({ pts: [passeRoute(a), passeRoute(b)], larg: 0.17, cle: a + '-' + b });
  const C = carte();
  for (const ch of C?.rivieres || []) ch.forEach((i, n) => {
    if (!autour.has(i) || C.terrain[i] < 3) return;
    const k = posCase(i), av = ch[n - 1], ap = ch[n + 1], mil = j => { const q = posCase(j); return [(k.x + q.x) / 2, (k.z + q.z) / 2]; };
    const A = av != null ? mil(av) : [k.x + 0.2, k.z - 0.2], B = ap != null ? mil(ap) : [k.x - 0.15, k.z + 0.15], M = [k.x + (hache(k.c, k.r, 5) - 0.5) * 0.4, k.z + (hache(k.c, k.r, 6) - 0.5) * 0.4];
    const pts = []; for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push([(1 - t) ** 2 * A[0] + 2 * t * (1 - t) * M[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * M[1] + t * t * B[1]]); }
    r.push({ pts, larg: 0.5 });
  });
  return r;
}

// ---------------------------------------------------------------- une enceinte complète
// passages : [{ pts, larg }] (routes ~0,17, rivières ~0,5). Rend { murs, sol, pointes, H, Q, breche, infoBreche } :
// murs = ce qui s'élève pendant les travaux, sol = fossé et glacis, pointes = sommets saillants (défenseurs, canons),
// Q = tracé de la face extérieure. breche [x, z] (siège) : la courtine qui fait face à ce point, au plus près, est coupée en trois, le morceau du milieu à part.
export function enceinte(parent, groupe, niveau, passages, EPOQUE, breche = null) {
  const indus = EPOQUE === 'industrie', st = STYLE_REMP[EPOQUE] || STYLE_REMP.ancien;
  const H = { 1: 0.08, 2: 0.13, 3: 0.13, 4: 0.15 }[niveau] * (niveau >= 3 ? st.h : 1), w = { 1: 0.024, 2: 0.055, 3: 0.085, 4: 0.095 }[niveau];
  const { P, ed } = contourGroupe(groupe), n = P.length;
  const Q = decale(P, -RE), Qi = decale(P, -(RE + w));
  const yIn = j => sol(ed[j].k), yBas = j => Math.min(yIn(j), sol(ed[j].out)) - 0.04;
  const ymin = Math.min(...ed.map((e, j) => Math.min(yIn(j), sol(e.out))));
  const U = Q.map((q, j) => { const r = Q[(j + 1) % n], l = Math.hypot(r[0] - q[0], r[1] - q[1]); return { ux: (r[0] - q[0]) / l, uz: (r[1] - q[1]) / l, l }; });
  const N = U.map(u => [u.uz, -u.ux]); // normale vers l'extérieur (polygone direct)
  const saillant = v => { const a = U[(v - 1 + n) % n], b = U[v]; return a.ux * b.uz - a.uz * b.ux > 0; };
  // ouvertures : où les routes et rivières coupent la face extérieure
  const ouv = U.map(() => []);
  for (const ps of passages) for (let i = 0; i < ps.pts.length - 1; i++) for (let j = 0; j < n; j++) {
    const t = croise(Q[j], Q[(j + 1) % n], ps.pts[i], ps.pts[i + 1]); if (t < 0) continue;
    const s = t * U[j].l; if (ouv[j].some(o => Math.abs(o.s - s) < 0.05)) continue;
    ouv[j].push({ s: Math.max(ps.larg / 2 + 0.02, Math.min(U[j].l - ps.larg / 2 - 0.02, s)), g: ps.larg, eau: ps.larg > 0.3 });
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
  // la brèche : sur la courtine qui regarde le bout des tranchées (le point breche), au plus près de lui (sb : son milieu sur la face)
  let ib = -1, sb = 0, LB = null, infoBreche = null;
  if (breche && niveau >= 2) {
    let dm = Infinity;
    pieces.forEach(([j, a, b], i) => {
      if (b - a < 0.3) return;
      const s = Math.max(a, Math.min(b, (breche[0] - Q[j][0]) * U[j].ux + (breche[1] - Q[j][1]) * U[j].uz)), c = O(j, s), dx = breche[0] - c[0], dz = breche[1] - c[1];
      const d = Math.hypot(dx, dz) + (dx * N[j][0] + dz * N[j][1] < 0 ? 10 : 0); // une courtine qui tourne le dos au camp : en dernier recours
      if (d < dm) { dm = d; ib = i; sb = s; }
    });
  }
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
      if (EPOQUE !== 'empire') for (let s = a + 0.02; s < b - 0.012; s += 0.036) { const p = O(j, s); putR(L, boite(0.018, 0.016, pw), st.haut, p[0] - nx * pw / 2, y1(j) + 0.02, p[1] - nz * pw / 2, ryDe(U[j].ux, U[j].uz), 0.004); }
      if (indus) for (let s = a + 0.05; s < b - 0.03; s += 0.09) { const p = O(j, s); putR(L, boite(0.008, 0.022, 0.006), 0x2a1d14, p[0] + nx * 0.002, y1(j) - 0.04, p[1] + nz * 0.002, ryDe(U[j].ux, U[j].uz), 0); } // meurtrières
    } else dalle(L, [o0, o1, p1, p0], y1(j), y1(j) + (indus ? 0.02 : 0.018), indus ? HERBE : st.haut, 0.006); // parapet (de terre à l'ère industrielle)
  };
  pieces.forEach(([j, a, b], i) => {
    if (i !== ib) return morceau(L, j, a, b);
    const c = (b - a) * 0.2, m = Math.max(a + c + 0.08, Math.min(b - c - 0.08, sb)); // 0,08 : à l'écart de la tour d'angle
    LB = lot(); morceau(L, j, a, m - c); morceau(LB, j, m - c, m + c); morceau(L, j, m + c, b);
    infoBreche = { O: O(j, m), n: N[j], y: yIn(j), H };
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
    if (!bast[v]) { FULL.push(q); ENV.push(q); pointes.push({ x: q[0], z: q[1], y: y1(v), nx: (N[v][0] + N[jp][0]) / 2, nz: (N[v][1] + N[jp][1]) / 2, rentrant: !saillant(v) }); return; }
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
    pointes.push({ x: T[0] - bi[0] * 0.07, z: T[1] - bi[1] * 0.07, y: yh, nx: bi[0], nz: bi[1], bastion: true });
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
  return { murs, sol: solG, pointes, H, Q, breche: LB ? fige(LB, murs) : null, infoBreche };
}
/** Les remparts d'une ville au niveau donné : niveaux 1-2 sur la mairie, 3 sur l'enceinte, 4 sur l'enceinte + l'ancienne muraille en réduit. */
export function remparts(parent, mairie, groupe, niveau, pass, epoque, breche = null) {
  const g = new THREE.Group(); parent.add(g);
  const e = enceinte(g, niveau >= 3 ? groupe : [mairie], niveau, pass, epoque, breche);
  if (niveau === 4) { const r = enceinte(g, [mairie], 2, pass, epoque); g.remove(r.murs); e.murs.add(r.murs); g.remove(r.sol); e.sol.add(r.sol); }
  e.g = g; return e;
}
/** Échafaudages le long d'un tracé : perches, lisses, quelques blocs de pierre. */
export function echafaudages(parent, Q, H) {
  const L = lot(), n = Q.length;
  for (let j = 0; j < n; j++) {
    const a = Q[j], b = Q[(j + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = uz, nz = -ux, y = solEn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let s = 0.03; s < l - 0.02; s += 0.075) putR(L, boite(0.006, H + 0.05, 0.006), 0x9a7a4a, a[0] + ux * s + nx * 0.035, y + (H + 0.05) / 2, a[1] + uz * s + nz * 0.035, 0, 0.003);
    for (const hh of [0.45, 0.9]) putR(L, boite(l - 0.02, 0.006, 0.006), 0x9a7a4a, (a[0] + b[0]) / 2 + nx * 0.035, y + (H + 0.05) * hh, (a[1] + b[1]) / 2 + nz * 0.035, ryDe(ux, uz), 0.003);
    if (j % 3 === 0 && l > 0.45) for (let i = 0; i < 3; i++) putR(L, boite(0.03, 0.02, 0.025), 0xd8cfb4, a[0] + ux * (0.3 + i * 0.035) + nx * 0.1, y + 0.01, a[1] + uz * (0.3 + i * 0.035) + nz * 0.1, ryDe(ux, uz), 0.004);
  }
  return fige(L, parent);
}

// ---------------------------------------------------------------- les villes du plateau
const groupe = new THREE.Group();
scene.add(groupe);
const villes = new Map(); // id de la ville → { cle, fortif, cur, neuf, vieux, echaf, prog, anim }
const DUREE_FIN = 3.5;    // secondes : la nouvelle enceinte finit de s'élever quand les travaux s'achèvent
let horloge = 0;

const progres = (v, R) => { const d = R?.fortifications?.find(f => f.niveau === v.fortif + 1)?.duree || 1; return Math.max(0, Math.min(1, 1 - (v.travaux_fortif || 0) / d)); };
const hautMurs = p => 0.03 + 0.97 * p * 0.9; // pendant les travaux, la nouvelle enceinte monte sans jamais finir
function oter(e) { if (e) jeter(e.g); }

/** Met les remparts d'accord avec l'état (villes[].fortif, travaux_fortif, enceinte ; sièges pour la brèche). À appeler après plateau.majEtat. */
export function majRemparts(etat, R) {
  const vus = new Set();
  const ep = etat.epoque?.cle || 'ancien';
  for (const v of etat.villes) {
    const travaux = v.travaux_fortif > 0 && v.fortif < 4;
    if (!v.fortif && !travaux) continue;
    vus.add(v.id);
    // les cases intra-muros (au niveau suivant pendant les travaux) et leurs voisines : leurs hauteurs et leurs routes comptent
    const intra = v.enceinte?.length ? v.enceinte : [v.case];
    const groupeNeuf = travaux && v.fortif + 1 >= 3 && v.fortif < 3 ? [v.case, ...[0, 1, 2, 3, 4, 5].map(d => voisin(v.case, d)).filter(i => i >= 0 && carte()?.terrain[i] >= 3 && etat.cases.proprio[i] === v.proprio)] : intra;
    const autour = new Set();
    for (const i of [...intra, ...groupeNeuf]) { autour.add(i); for (let d = 0; d < 6; d++) { const n = voisin(i, d); if (n >= 0) autour.add(n); } }
    const pass = passages(etat, autour);
    const camp = v.assiegee ? campDe(v.case) : null;
    const cle = [v.fortif, travaux ? 1 : 0, ep, intra.join('.'), groupeNeuf.join('.'), [...autour].map(i => hauteur(i).toFixed(2)).join(','), pass.map(p => p.cle || 'r').join(','), camp ? camp.cible.map(c => c.toFixed(2)).join(',') : ''].join('|');
    let ex = villes.get(v.id);
    const prog = travaux ? progres(v, R) : 1;
    if (ex && ex.cle === cle) { ex.prog = prog; if (ex.neuf && !ex.anim) ex.neuf.murs.scale.y = hautMurs(prog); continue; }
    // la fin des travaux : la nouvelle enceinte achève de monter, l'ancienne disparaît, puis les échafaudages
    const fin = ex && ex.fortif < v.fortif && ex.neuf;
    const depart = fin ? ex.neuf.murs.scale.y : 1;
    if (ex) { oter(ex.vieux); jeter(ex.echaf); oter(ex.neuf); if (fin) ex.vieux = ex.cur; else oter(ex.cur); }
    const n = { cle, fortif: v.fortif, prog, cur: null, neuf: null, vieux: fin ? ex.vieux : null, echaf: null, anim: null, case: v.case };
    if (v.fortif) n.cur = remparts(groupe, v.case, intra, v.fortif, pass, ep, camp ? camp.cible : null);
    if (travaux) {
      n.neuf = remparts(groupe, v.case, groupeNeuf, v.fortif + 1, pass, ep);
      n.neuf.murs.scale.y = hautMurs(prog);
      n.echaf = echafaudages(groupe, decale(n.neuf.Q, 0.02), n.neuf.H);
    }
    if (fin && n.cur) { n.anim = { debut: horloge, de: depart }; n.cur.murs.scale.y = depart; n.echaf = echafaudages(groupe, decale(n.cur.Q, 0.02), n.cur.H); }
    else if (n.vieux) { oter(n.vieux); n.vieux = null; }
    villes.set(v.id, n);
  }
  for (const [id, ex] of villes) if (!vus.has(id)) { oter(ex.cur); oter(ex.neuf); oter(ex.vieux); jeter(ex.echaf); villes.delete(id); }
}

/** Ce que les sièges lisent des remparts d'une ville : { pointes, Q, H, breche (groupe du morceau qui s'effondre), infoBreche } ou null. */
export function infoRemparts(villeId) { return villes.get(villeId)?.cur || null; }

chaqueImage((dt, t) => {
  horloge = t;
  for (const v of villes.values()) {
    // poussière des travaux, sur le tracé de la nouvelle enceinte
    const e = v.anim ? v.cur : v.neuf;
    if (e && Math.random() < dt * (v.anim ? 9 : 2.5)) { const q = e.Q[Math.random() * e.Q.length | 0]; bouffee(q[0], solEn(q[0], q[1]) + 0.03, q[1], 'poussiere', 0.7); }
    if (!v.anim) continue;
    const u = (t - v.anim.debut) / DUREE_FIN;
    v.cur.murs.scale.y = v.anim.de + (1 - v.anim.de) * lisse(0, 1, u);
    if (v.vieux) v.vieux.g.visible = u < 0.45;
    if (u >= 1) { v.cur.murs.scale.y = 1; oter(v.vieux); v.vieux = null; jeter(v.echaf); v.echaf = null; v.anim = null; }
  }
});
