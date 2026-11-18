// Les forts d'armée et les retranchements (maquette validée : maquettes/guerre.html, source maquettes/source/guerre/forts.js).
// Fort permanent à trois niveaux (Redoute, Fort bastionné, Fort à batteries) dont l'aspect suit l'époque ; niveau 0 : le chantier
// de la redoute. Pendant les travaux, le nouvel ouvrage s'élève derrière ses échafaudages, des ouvriers frappent et portent les
// pierres (rien ne bouge si les travaux sont suspendus). Une sentinelle fait sa ronde sur le rempart, le drapeau du royaume flotte
// au mât ; tour de guet au brasier ou sémaphore au niveau 3 ; quand le fort change de mains, le drapeau descend et l'autre monte.
// Anneau de la vision (cases vues depuis le fort) et onde : pour le fort sélectionné (selectionnerFort) et après une montée de niveau.
// Retranchement (armees[].retranche) : tranchée basse en arc devant l'armée, parapet de terre, gabions et fascines (sacs de terre
// sous l'Empire et à l'ère industrielle), six terrassiers à la pelle pendant le mois de travaux.
// Tout est en unités du plateau ; chaque fort est posé au centre de sa case, porte au sud (+z), décalé vers le nord (cz) pour
// laisser l'armée qui le garde sur le glacis devant la porte (monde.js la range là).
import { THREE, scene, posCase, chaqueImage } from './scene.js';
import { lot, put, fige, boite, cyl, cone, sphere } from './toon.js';
import { dessus, solEn } from './plateau.js';
import { maillageCache } from './modeles.js';
import { bouffee } from './vie.js';
import { ARDOISE, BRONZE, HERBE, EAU_F, GLACIS, putR, aire, decale, dalle, contourGroupe, echafaudages, ryDe, lisse } from './remparts.js';
import { soldat, feu, animFeu, drapeau, oter, partage, capVers } from './sieges.js';
import { couleurDe, palierRoyaume, posArmee } from './monde.js';

const PIERRE = 0xbcb6a8, VITRE = 0x3a4652, BOIS = 0x5b3a1e, SQ3 = Math.sqrt(3), ECH_GENS = 0.045;
const STYLE_FORT = {
  ancien: { terre: 0x9c7a4a, dessus: 0xb08a54, bois: 0x8a5a2e, pierre: 0xdcc58a, haut: 0xf2e8cc, toit: 0xa8553a, canon: BRONZE, affut: 0x8a3a2a, fosse: 0x8a6a44, eau: true },
  lumieres: { terre: 0x7fa64c, dessus: 0x9cc260, bois: 0xd2ad74, pierre: 0xe8dfc6, haut: 0xfbf6e6, toit: ARDOISE, canon: BRONZE, affut: 0x6b7a4a, fosse: 0x8a6a44, eau: true },
  empire: { terre: 0x9a8058, dessus: 0xa88e62, bois: 0x8c7d68, pierre: 0xbcb7aa, haut: 0xdedad0, toit: ARDOISE, canon: BRONZE, affut: 0x6b7a4a, fosse: 0x8a6a44, eau: true, gazon: true },
  industrie: { terre: 0x7d6a48, dessus: 0x8f9c5a, bois: 0x2e2824, pierre: 0xa8553c, haut: 0x8a3f2c, toit: 0x58606c, canon: 0x3a3d42, affut: 0x5a5f66, fosse: 0x7d8f5a, eau: false },
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
// fossé (sec ou en eau) autour de ENV, glacis et son liseré
function fosseGlacis(Ls, st, ENV, trou, eau, demi = []) {
  const F0 = decale(ENV, 0.08, 1.6), Fd = demi.map(d => decale(d, 0.055)), M = enveloppe(F0.concat(...Fd)), Gl = decale(M, 0.07, 1.6), col = eau ? EAU_F : st.fosse;
  dalle(Ls, F0, 0.001, 0.006, col, 0, [trou]);
  for (const d of Fd) dalle(Ls, d, 0.0012, 0.0062, col, 0); // le fossé de chaque demi-lune, par-dessus le glacis
  dalle(Ls, Gl, 0.0005, 0.0045, GLACIS, 0, [F0]);
  dalle(Ls, decale(Gl, 0.014), 0.0005, 0.0035, 0x6f8a44, 0, [Gl]);
}
// porte au sud : pavillon, vantaux, pont jusqu'au bord du fossé
function porteM(L, Ls, st, P, H, larg, pont, fer = false, bois = false) {
  const c = coteSud(P), sx = -Math.sin(c.ry), sz = -Math.cos(c.ry); // (sx, sz) : vers le sud, hors du mur
  putR(L, boite(larg + 0.04, H + 0.035, 0.05), bois ? st.bois : fer ? st.pierre : st.haut, c.x - sx * 0.012, (H + 0.035) / 2, c.z - sz * 0.012, c.ry, 0.008);
  putR(L, boite(larg, H * 0.72, 0.012), fer ? 0x3a3d42 : 0x5a3a20, c.x + sx * 0.016, H * 0.36, c.z + sz * 0.016, c.ry, 0);
  if (pont) putR(Ls, boite(larg * 0.9, 0.012, pont), fer ? 0x8a867e : 0x8b5a2b, c.x + sx * pont / 2, 0.012, c.z + sz * pont / 2, c.ry, 0.005);
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

/** Le fort au niveau n (1 à 3) à l'époque donnée : { g, murs, sol, T (tracé, coordonnées de la case), H, ronde, anime, drap, hm }. */
function modeleFort(n, roy, EPOQUE) {
  const st = STYLE_FORT[EPOQUE] || STYLE_FORT.ancien, indus = EPOQUE === 'industrie', cx = 0, cz = -0.16;
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
    const cas = [[cx - 0.04, cz + 0.02], [cx + 0.2, cz + 0.02], [cx + 0.2, cz + 0.12], [cx - 0.04, cz + 0.12]];
    dalle(L, cas, 0, 0.06, st.pierre, 0.008); dalle(L, cas, 0.06, 0.075, HERBE, 0.006); // caserne casematée
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
    tb.pointes.forEach(p => {
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
    porteM(L, Ls, st, Q, H * 0.8, 0.075, (grand ? 0.06 : 0.055) + 0.1, indus); // sur la courtine sud, pont jusqu'au bord du fossé
    // dedans : caserne, et au niveau 3 la poudrière et la tour de guet (sémaphore)
    const yb = 0, mur = indus ? 0xb7634a : EPOQUE === 'ancien' ? 0xf1e4c4 : 0xf6eedb;
    if (grand) {
      putR(L, boite(0.28, 0.065, 0.075), mur, cx, yb + 0.0325, cz - 0.15, 0, 0.007); toitM(L, 0.09, 0.3, 0.045, st.toit, cx, yb + 0.065, cz - 0.15, Math.PI / 2);
      for (let i = 0; i < 5; i++) putR(L, boite(0.02, 0.022, 0.004), VITRE, cx - 0.1 + i * 0.05, yb + 0.035, cz - 0.111, 0, 0);
      putR(L, boite(0.075, 0.055, 0.06), PIERRE, cx - 0.12, yb + 0.0275, cz, 0, 0.007); toitM(L, 0.085, 0.07, 0.06, st.toit, cx - 0.12, yb + 0.055, cz); // poudrière
      for (const s2 of [-1, 1]) putR(L, boite(0.014, 0.04, 0.07), PIERRE, cx - 0.12 + s2 * 0.042, yb + 0.02, cz, 0, 0.004);
      putR(L, boite(0.004, 0.06, 0.004), 0x3a3a40, cx - 0.12, yb + 0.14, cz, 0, 0); // paratonnerre
      if (EPOQUE === 'ancien') anime.brasier = tourGuet(L, murs, st, cx + 0.13, cz);
      else anime.semaphore = semaphore(L, murs, st, cx + 0.13, cz, 0.2, false);
      mat = [cx - 0.19, cz - 0.05]; // à gauche : le drapeau ne cache pas le sémaphore
    } else {
      putR(L, boite(0.22, 0.06, 0.075), mur, cx, yb + 0.03, cz - 0.12, 0, 0.007); toitM(L, 0.09, 0.24, 0.045, st.toit, cx, yb + 0.06, cz - 0.12, Math.PI / 2);
      for (let i = 0; i < 4; i++) putR(L, boite(0.02, 0.022, 0.004), VITRE, cx - 0.075 + i * 0.05, yb + 0.032, cz - 0.081, 0, 0);
      mat = [cx + 0.11, cz];
    }
    ronde = decale(Q, -w / 2);
  }
  // le mât et le drapeau du royaume (matériau propre : il change de couleur quand le fort est pris)
  const hm = n === 1 ? 0.34 : 0.4; putR(L, boite(0.012, hm, 0.012), 0x4a3420, mat[0], hm / 2, mat[1], 0, 0.004);
  const drap = drapeau(murs, roy, mat[0] + 0.006, hm - 0.05, mat[1], 0.17, 0.11, true);
  fige(L, murs); fige(Ls, sol);
  return { g, murs, sol, T, H, ronde, anime, drap, hm };
}

// ---------------------------------------------------------------- l'anneau léger de la vision : le contour exact des cases vues depuis le fort
const cube = i => { const p = posCase(i), x = p.c - (p.r - (p.r & 1)) / 2; return [x, -x - p.r, p.r]; };
const ecart = (a, b) => { const A = cube(a), B = cube(b); return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])); };
function anneauVision(c, r, roy, N) {
  const vues = []; for (let i = 0; i < N; i++) if (ecart(c, i) <= r) vues.push(i);
  const { P: P0, ed } = contourGroupe(vues), P = decale(P0, -0.1), L = lot();
  P.forEach((a, j) => { const b = P[(j + 1) % P.length], y = Math.max(dessus(ed[j].k), -0.15) + 0.016, ux = b[0] - a[0], uz = b[1] - a[1], l = Math.hypot(ux, uz); putR(L, boite(l + 0.07, 0.012, 0.12), 0xffffff, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, ryDe(ux / l, uz / l), 0); });
  const g = fige(L, groupe), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(roy).lerp(new THREE.Color(0xffffff), 0.12), transparent: true, opacity: 0.85, depthWrite: false });
  g.children.forEach(o => { o.material = m; o.castShadow = o.receiveShadow = false; o.renderOrder = 3; }); g.userData.mat = m; return g;
}

// ---------------------------------------------------------------- figurants : ouvriers des travaux (paysans, un bloc sur l'épaule pour deux d'entre eux)
const PAYSAN = [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x5a4632], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x5a4632], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, 0xe9e2d0], [sphere(0.28, 1), 0.02, 2.1, 0, 0xf0c9a0], [cyl(0.55, 0.55, 0.08, 10), 0, 2.36, 0, 0xd9b45a], [cyl(0.25, 0.3, 0.25, 8), 0, 2.5, 0, 0xd9b45a]];
function ouvrier(parent, bloc) {
  const g = partage(maillageCache(`ouvrier|${bloc ? 1 : 0}`, L => { for (const [geo, x, y, z, c] of PAYSAN) put(L, geo, c, x, y, z, 0, 0.09); if (bloc) put(L, boite(0.7, 0.45, 0.55), 0xd8cfb4, 0, 2.6, 0, 0, 0.06); }));
  g.scale.setScalar(0.05); g.rotation.order = 'YXZ'; g.visible = false; parent.add(g); return g;
}

// ---------------------------------------------------------------- les forts du plateau
const groupe = new THREE.Group();
scene.add(groupe);
const forts = new Map();  // id → F
const rets = new Map();   // id de l'armée → retranchement
let horloge = 0, selFort = null, nbCases = 0;
const DUREE_FIN = 3.5;
const hautMurs = p => 0.03 + 0.97 * p * 0.9;

const oterAnneau = F => { if (F.anneau) { F.anneau.userData.mat.dispose(); oter(F.anneau); F.anneau = null; } };
const retirer = F => { oterAnneau(F); F.ondeM.material.dispose(); oter(F.g); };

function poserModele(F, n, roy, ep) {
  const m = modeleFort(n, roy, ep), p = posCase(F.case), y = dessus(F.case);
  m.g.position.set(p.x, y, p.z);
  m.Tw = m.T.map(([x, z]) => [p.x + x, p.z + z]);
  return m;
}

/** Met les forts et les retranchements d'accord avec l'état (forts[], armees[].retranche). À appeler après la mise à jour des armées. */
export function majForts(etat, R) {
  const ep = etat.epoque?.cle || 'ancien', vus = new Set();
  nbCases = (etat.cases?.proprio || []).length;
  for (const f of etat.forts || []) {
    vus.add(f.id);
    const roy = couleurDe(f.proprio), travaux = f.travaux > 0 && f.niveau < 3;
    const duree = R?.forts?.niveaux?.find(x => x.niveau === f.niveau + 1)?.duree || 1, prog = travaux ? Math.max(0, Math.min(1, 1 - f.travaux / duree)) : 1;
    const cle = [f.case, f.niveau, travaux ? 1 : 0, roy, ep, dessus(f.case).toFixed(2)].join('|');
    let F = forts.get(f.id);
    if (F && F.cle === cle) { F.prog = prog; F.suspendu = !!f.suspendu; F.garnison = !!f.garnison; if (F.neuf && !F.anim) F.neuf.murs.scale.y = hautMurs(prog); continue; }
    const fin = F && F.niveau < f.niveau && F.neuf, depart = fin ? F.neuf.murs.scale.y : 1, pris = F && F.proprio !== f.proprio ? couleurDe(F.proprio) : null;
    if (F) retirer(F);
    const g = new THREE.Group(); groupe.add(g);
    const N = { cle, g, case: f.case, id: f.id, niveau: f.niveau, proprio: f.proprio, roy, prog, suspendu: !!f.suspendu, garnison: !!f.garnison, cur: null, neuf: null, vieux: null, echaf: null, anim: null, pris: null, onde: -99 };
    const pose = n => { const m = poserModele(N, n, roy, ep); g.add(m.g); return m; };
    if (f.niveau > 0) N.cur = pose(f.niveau);
    if (travaux) { N.neuf = pose(f.niveau + 1); N.neuf.murs.scale.y = hautMurs(prog); if (N.cur) N.cur.sol.visible = false; N.echaf = echafaudages(g, decale(N.neuf.Tw, 0.02), N.neuf.H); }
    if (fin && N.cur) { // les travaux s'achèvent : le nouveau fort finit de monter, l'ancien disparaît, l'onde annonce la vision étendue
      N.anim = { debut: horloge, de: depart }; N.cur.murs.scale.y = depart; N.echaf = echafaudages(g, decale(N.cur.Tw, 0.02), N.cur.H);
      if (f.niveau > 1) { N.vieux = pose(f.niveau - 1); N.vieux.sol.visible = false; }
      N.onde = horloge + DUREE_FIN;
    }
    if (pris && N.cur) N.pris = { debut: horloge, de: pris };
    N.sentinelle = soldat(g, roy, palierRoyaume(f.proprio), ECH_GENS * 0.9);
    N.ouvriers = [0, 1, 2, 3].map(i => ouvrier(g, i >= 2));
    N.ondeM = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: roy, transparent: true, opacity: 0, depthWrite: false }));
    N.ondeM.renderOrder = 3; N.ondeM.visible = false; g.add(N.ondeM);
    N.vision = R?.forts?.niveaux?.find(x => x.niveau === f.niveau)?.vision || 1;
    if (selFort === f.id) N.anneau = anneauVision(f.case, N.vision, roy, nbCases);
    forts.set(f.id, N);
  }
  for (const [id, F] of forts) if (!vus.has(id)) { retirer(F); forts.delete(id); }
  majRetranchements(etat, ep);
}

/** Montre l'anneau de la vision du fort choisi (null : aucun). */
export function selectionnerFort(id) {
  selFort = id ?? null;
  for (const F of forts.values()) { oterAnneau(F); if (F.id === selFort) F.anneau = anneauVision(F.case, F.vision, F.roy, nbCases); }
}

// ---------------------------------------------------------------- les retranchements
function majRetranchements(etat, ep) {
  const vus = new Set();
  for (const a of etat.armees || []) {
    if (!a.retranche) continue;
    const pa = posArmee(a.id); if (!pa) continue;
    vus.add(a.id);
    const roy = couleurDe(a.proprio), P = palierRoyaume(a.proprio);
    const cle = [pa.x.toFixed(3), pa.z.toFixed(3), pa.ry.toFixed(2), pa.s.toFixed(3), ep, roy, P].join('|');
    let Rt = rets.get(a.id);
    if (Rt && Rt.cle !== cle) { oter(Rt.g); Rt = null; }
    if (!Rt) { Rt = construireRetranchement(pa, ep, roy, P, a.retranche === 'pret'); Rt.cle = cle; rets.set(a.id, Rt); }
    if (Rt.etat === 'en_cours' && a.retranche === 'pret') Rt.fini = horloge; // gabions et fascines arrivent
    Rt.etat = a.retranche;
  }
  for (const [id, Rt] of rets) if (!vus.has(id)) { oter(Rt.g); rets.delete(id); }
}
// une tranchée basse en arc devant l'armée (dessin de la maquette, à l'échelle de l'icône d'armée)
function construireRetranchement(pa, ep, roy, P, pret) {
  const g = new THREE.Group(); groupe.add(g);
  const k = pa.s / 0.06, fx = Math.sin(pa.ry), fz = Math.cos(pa.ry), c = Math.cos(pa.ry), s = Math.sin(pa.ry);
  // le centre de l'icône d'armée (ses pièces sont décalées vers l'artillerie, à +x local)
  const cx = pa.x + (2.05 * c - 0.55 * s) * pa.s, cz = pa.z + (-2.05 * s - 0.55 * c) * pa.s;
  const bx = cx - fx * 0.14 * k, bz = cz - fz * 0.14 * k, y = solEn(cx, cz);
  const arc = new THREE.Group(); arc.position.set(bx, y, bz); arc.scale.setScalar(k); g.add(arc);
  const nb = 12, rayon = 0.5, a0 = Math.atan2(fx, fz), pt = (a, r = rayon) => [Math.sin(a) * r, Math.cos(a) * r];
  const R = { g, segs: [], gabions: [], terr: [], debut: horloge, etat: pret ? 'pret' : 'en_cours', fini: pret ? -99 : null, y };
  for (let i = 0; i < nb; i++) {
    const a = a0 + (i / (nb - 1) - 0.5) * 2.1, [x, z] = pt(a), ry = ryDe(Math.cos(a), -Math.sin(a)), l = rayon * 2.1 / (nb - 1) + 0.02, Lt = lot();
    putR(Lt, boite(l, 0.032, 0.055), 0x8f744a, Math.sin(a) * 0.02, 0.016, Math.cos(a) * 0.02, ry, 0.006); // parapet de terre côté ennemi
    putR(Lt, boite(l, 0.005, 0.032), 0x4a3522, -Math.sin(a) * 0.026, 0.003, -Math.cos(a) * 0.026, ry, 0); // la tranchée
    const sg = fige(Lt, arc); sg.position.set(x, 0, z); R.segs.push(sg);
    let Lg = null;
    if (i % 2) { Lg = lot(); if (ep === 'empire' || ep === 'industrie') { for (const d of [-0.025, 0, 0.025]) putR(Lg, sphere(0.016, 0).scale(1.3, 0.7, 1), 0xd8c9a0, Math.cos(a) * d + Math.sin(a) * 0.022, 0.04, -Math.sin(a) * d + Math.cos(a) * 0.022, 0, 0.003); } // sacs de terre
      else putR(Lg, cyl(0.011, 0.011, l * 0.9, 6).rotateZ(Math.PI / 2), 0x8a6a3a, Math.sin(a) * 0.022, 0.04, Math.cos(a) * 0.022, ry, 0.003); } // fascine
    else if (i > 0 && i < nb - 1) { Lg = lot(); gabionM(Lg, Math.sin(a) * 0.022, 0.03, Math.cos(a) * 0.022, 0.018, 0.04); }
    if (Lg) { const gs = fige(Lg, arc); gs.position.set(x, 0, z); gs.userData.i = i; R.gabions.push(gs); }
  }
  R.terr = [0, 1, 2, 3, 4, 5].map(i => { const a = a0 + (i / 5 - 0.5) * 1.8, [x, z] = pt(a, rayon - 0.08), t = soldat(g, roy, P, ECH_GENS * 1.15, 'pelle'); t.userData.p = [bx + x * k, bz + z * k]; t.userData.a = a; t.visible = false; return t; });
  return R;
}

// ---------------------------------------------------------------- à chaque image
chaqueImage((dt, t) => {
  horloge = t;
  for (const F of forts.values()) {
    const u = F.anim ? (t - F.anim.debut) / DUREE_FIN : -1, enTravaux = !!F.neuf || !!F.anim, actifs = (F.neuf && !F.suspendu) || !!F.anim;
    const e = F.anim ? F.cur : F.neuf || F.cur, p = posCase(F.case), y = dessus(F.case);
    if (F.anim) {
      F.cur.murs.scale.y = F.anim.de + (1 - F.anim.de) * lisse(0, 1, u);
      if (F.vieux) F.vieux.g.visible = u < 0.45;
      if (u >= 1) { F.cur.murs.scale.y = 1; oter(F.vieux?.g); F.vieux = null; oter(F.echaf); F.echaf = null; F.anim = null; }
    } else if (F.neuf && F.cur) F.cur.g.visible = F.prog < 0.45;
    // poussière et ouvriers des travaux
    if (actifs && e && Math.random() < dt * (F.anim ? 8 : 2.5)) { const q = e.Tw[Math.random() * e.Tw.length | 0]; bouffee(q[0], y + 0.03, q[1], 'poussiere', 0.7); }
    F.ouvriers.forEach((o, i) => {
      o.visible = actifs && !!e; if (!o.visible) return;
      const n = e.Tw.length, a = e.Tw[(i * 3 + 1) % n], b = e.Tw[(i * 3 + 2) % n], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = mx - p.x, dz = mz - (p.z - 0.16), l = Math.hypot(dx, dz) || 1, ox = dx / l, oz = dz / l;
      if (i < 2) { o.position.set(mx + ox * 0.1, y + Math.abs(Math.sin(t * 7 + i)) * 0.008, mz + oz * 0.1); o.rotation.y = Math.atan2(-ox, -oz) - Math.PI / 2; o.rotation.z = Math.sin(t * 7 + i) * 0.15; } // ils frappent la pierre
      else { const f = (Math.sin(t * 1.4 + i) + 1) / 2; o.position.set(mx + ox * (0.12 + f * 0.25), y + Math.abs(Math.sin(t * 9 + i)) * 0.006, mz + oz * (0.12 + f * 0.25)); o.rotation.y = Math.atan2(ox, oz) - Math.PI / 2 + (Math.cos(t * 1.4 + i) > 0 ? Math.PI : 0); } // ils portent les blocs
    });
    // la sentinelle fait sa ronde sur le rempart (pas pendant les travaux, ni sans garnison)
    const r = F.cur, sn = F.sentinelle;
    sn.visible = !!r && F.garnison && !enTravaux;
    if (sn.visible) {
      const P = r.ronde, n = P.length, lg = []; let tot = 0; for (let j = 0; j < n; j++) { const a = P[j], b = P[(j + 1) % n]; lg.push(Math.hypot(b[0] - a[0], b[1] - a[1])); tot += lg[j]; }
      let d = (t * 0.06 + F.id) % tot, j = 0; while (d > lg[j]) { d -= lg[j]; j++; }
      const a = P[j], b = P[(j + 1) % n], f = d / lg[j];
      sn.position.set(p.x + a[0] + (b[0] - a[0]) * f, y + r.H + 0.004 + Math.abs(Math.sin(t * 8)) * 0.004, p.z + a[1] + (b[1] - a[1]) * f); sn.rotation.y = capVers(b[0] - a[0], b[1] - a[1]);
    }
    // sémaphore qui signale, brasier
    for (const m of [F.cur, F.neuf]) {
      if (!m) continue;
      const sm = m.anime.semaphore; if (sm) { sm.reg.rotation.z = Math.round(Math.sin(t * 0.7 + F.id) * 2) * Math.PI / 8 + Math.sin(t * 3) * 0.04; sm.bras.forEach((b, i) => { b.rotation.z = (Math.floor(t * 0.9 + i * 1.3) % 4) * Math.PI / 4; }); }
      if (m.anime.brasier) { m.anime.brasier.visible = m === F.cur && !enTravaux; if (m.anime.brasier.visible) { animFeu(m.anime.brasier, t); if (Math.random() < dt * 2) { const q = m.anime.brasier.getWorldPosition(new THREE.Vector3()); bouffee(q.x, q.y + 0.03, q.z, 'blanche', 0.35); } } }
    }
    // le fort change de mains : l'ancien drapeau descend, le nouveau monte
    if (F.pris && r) {
      const w = t - F.pris.debut, bas = lisse(0, 1.4, w), haut = lisse(1.8, 3.4, w), notre = w > 1.6;
      r.drap.material.color.set(notre ? F.roy : F.pris.de); r.drap.position.y = 0.09 + (notre ? haut : 1 - bas) * (r.hm - 0.14);
      if (w > 3.4) F.pris = null;
    }
    // l'onde de la vision : en boucle pour le fort sélectionné, trois fois après une montée de niveau
    const onde = (selFort === F.id && !enTravaux) || t < F.onde + 9.6;
    F.ondeM.visible = onde && !F.anim;
    if (F.ondeM.visible) { const w = (t % 3.2) / 3.2, Rv = F.vision * SQ3 + 0.4; F.ondeM.position.set(p.x, y + 0.05, p.z - 0.16); F.ondeM.scale.setScalar(0.4 + w * Rv); F.ondeM.material.opacity = (1 - w) * 0.7; }
    if (F.anneau) F.anneau.userData.mat.opacity = 0.75 + Math.sin(t * 2) * 0.15;
  }
  // les retranchements : creuser (le mois de travaux), puis gabions et fascines
  for (const R of rets.values()) {
    const w = t - R.debut, creuse = R.etat === 'en_cours', wf = R.fini === null ? -1 : t - R.fini;
    R.segs.forEach((g, i) => { const h = creuse ? 0.15 + 0.85 * lisse(0.4 + i * 0.32, 1 + i * 0.32, w) * (i < 8 ? 1 : 0.4) : 1; g.scale.y = Math.max(0.01, h); });
    R.gabions.forEach(g => { const i = g.userData.i, h = creuse ? 0 : R.fini < 0 ? 1 : lisse(0.2 + i * 0.12, 0.7 + i * 0.12, wf); g.visible = h > 0.01; g.scale.setScalar(Math.max(0.01, h)); });
    R.terr.forEach((g, i) => {
      g.visible = creuse; if (!creuse) return;
      const [x, z] = g.userData.p, a = g.userData.a, sw = Math.sin(t * 7 + i * 1.7);
      g.position.set(x, R.y, z); g.rotation.y = a; g.rotation.x = 0.25 + sw * 0.3;
      if (sw > 0.97 && Math.random() < 0.5) bouffee(x + Math.sin(a) * 0.06, R.y + 0.02, z + Math.cos(a) * 0.06, 'poussiere', 0.4);
    });
  }
});
