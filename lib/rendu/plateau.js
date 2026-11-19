// Le plateau, rendu comme web_power (maquettes/rendu-power.html) : hexagones séparés et étagés, ombrage toon en trois tons
// et contours brun foncé ; mer translucide ; décor par case (forêts, collines, montagnes, rochers, gisements, champs) ;
// rivières en rubans de sable et d'eau ; liserés des territoires ; surbrillances.
// Trois familles figées (tuiles, décor, rivières), reconstruites seulement quand la carte, la saison, la neige,
// les arbres, le bâti ou les routes changent.
import { THREE, scene, geo, posCase, voisin, hache, caseA } from './scene.js';
import { toon, put, fige, lot, cyl as cyl0, cone as cone0, sphere as sphere0, boite as boite0, jeter, fusion, degrade } from './toon.js';

// formes mises en cache (non indexées) : le décor en réutilise des milliers à chaque reconstruction
const memo = new Map();
function forme(f, ...a) {
  const k = f.name + a.join();
  let g = memo.get(k);
  if (!g) { g = f(...a); if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); memo.set(k, g); }
  return g;
}
const cyl = (...a) => forme(cyl0, ...a), cone = (...a) => forme(cone0, ...a), sphere = (...a) => forme(sphere0, ...a), boite = (...a) => forme(boite0, ...a);
const dome = r => forme(function dome(r) { return sphere0(r, 1).scale(1, 0.38, 1); }, r);
const arrondi = v => Math.round(v * 200) / 200; // tailles arrondies au demi-centième : le cache sert

/** Gardé pour compatibilité (anciens shaders) : t et vent servent encore à l'animation, gel suit geler(). */
export const U = { t: { value: 0 }, vent: { value: 0.3 }, gel: { value: 0 }, vague: { value: 1 } };
export const TERRE = t => t >= 3;

const R = 1, EP = 0.022, S0 = 0.11, MER = -0.15; // S0 : le décor de web_power ramené à des cases de 1
const groupe = new THREE.Group();
scene.add(groupe);

let C = null, H = [], familles = [], eau = null, glace = null, liseres = null, surb = null, anneau = null, points = null;
let saison = 2, neige = 0, gel = 0, sec = 0;  // sec : 0, 1 champs jaunis, 2 grillés (meteo.js, d'après la sécheresse)
let E = { arbres: [], foret: [], bati: new Set(), routes: new Set(), forts: new Set() }; // état du mois : ce qui change le décor (un fort dégage sa case d'arbres et de buttes)
let rivPts = new Map(); // case → points des rivières qui la traversent (pour y écarter arbres et rochers)
let cascades = [];      // pied des cascades { x, y, z } : leur écume (eau.js)
let degages = new Set(); // cases des ouvrages de siège et des garnisons (sieges.js, monde.js) : ni arbres, ni buttes, ni champs, comme la case d'un fort
const degage = i => E.forts.has(i) || degages.has(i);

export const hauteur = i => H[i] ?? 0;
export const carte = () => C;
/** Le dessus d'une case, là où l'on pose un bâtiment ou une armée. */
export const dessus = i => Math.max(H[i] ?? 0, 0.02);
/** Hauteur du sol au point (x, z) : celle de la case la plus proche (−0,55 hors de la carte). */
export function hauteurEn(x, z) { if (!C) return 0; const i = caseA(x, z); return i < 0 ? -0.55 : H[i]; }
/** Où poser quelque chose : le dessus de la case, ou la surface de l'eau. */
export const solEn = (x, z) => Math.max(hauteurEn(x, z), MER);

// ------------------------------------------------------------------ terrain (hauteurs et couleurs de web_power)
const TERR = {
  mer: [0x1d5a86, -0.55], hautfond: [0xd2c88f, -0.24], lac: [0xe6d49a, -0.24], sable: [0xe6d49a, 0],
  prairie: [0x84c450, 0], plaine: [0xc9c65c, 0], foret: [0x5d9b3a, 0.02], colline: [0xa2b65a, 0.26],
  collineBoisee: [0x6fa043, 0.26], montagne: [0x8f8879, 0.46],
  bati: [0x84c450, 0], // comme les villes de web_power : une prairie, recouverte par la dalle du bâtiment
};
const EAUX = new Set(['mer', 'hautfond', 'lac']);
const TEINTES = [0xe2e9f2, 0xf0fbe8, 0xfff4d8, 0xffd8a8].map(c => new THREE.Color(c)); // hiver, printemps, été, automne
const PAILLE = new THREE.Color(0xffd890);
const BLANC = new THREE.Color(0xf4f7fb);
const boise = i => E.foret[i] || E.arbres[i] > 0;
/** Plaine cultivée : fertile, sans arbres, hors rivière. */
const cultivee = i => C.terrain[i] === 4 && C.fertile[i] && !boise(i) && !C.riviere[i];
const champ = i => cultivee(i) && !E.bati.has(i) && !E.routes.has(i) && !degages.has(i);

function genre(i) {
  const t = C.terrain[i];
  if (t === 0) return 'mer';
  if (t === 1) return 'hautfond';
  if (t === 2) return 'lac';
  if (E.bati.has(i)) return 'bati';
  if (t === 3) return 'sable';
  if (t === 6) return 'montagne';
  if (t === 5) return E.foret[i] ? 'collineBoisee' : 'colline';
  if (E.foret[i]) return 'foret';
  return cultivee(i) ? 'plaine' : 'prairie';
}
/** Une couleur blanchie par la neige au sol (k : part de la neige qui tient). */
const nv = (hex, k = 1) => (neige > 0 ? new THREE.Color(hex).lerp(BLANC, neige * k).getHex() : hex);

// ------------------------------------------------------------------ matériaux propres au plateau
const EAU = new THREE.Color(0x3fa6dc), EAU_GEL = new THREE.Color(0xcfe6f0);
const matMer = toon(0x3fa6dc, { transparent: true, opacity: 0.72 });
const matGlace = toon(0xe8f3f8, { transparent: true, opacity: 0, depthWrite: false });
const RIV = new THREE.Color(0x46a9dd), RIV_HIVER = new THREE.Color(0xbfe4f5), RIV_GEL = new THREE.Color(0xeaf3f7);
const matRiv = toon(0x46a9dd, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
/** Le matériau du sol et de son décor (blanc : les couleurs sont dans les sommets) : un jeu le teinte, par exemple pour
 *  assombrir la carte sous ses réseaux (vues de web_power). MAT_RIV : celui des rivières. */
export const MAT_SOL = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });
/** Les berges de sable des rivières : boue.js les recouvre d'eau trouble pendant une crue (couleur recopiée de MAT_SOL sinon). */
export const MAT_BERGE = MAT_SOL.clone();
export { matRiv as MAT_RIV };

// ------------------------------------------------------------------ construction
export function construire(carteServeur) {
  C = carteServeur;
  geo.l = C.l; geo.h = C.h;
  for (const o of [...groupe.children]) jeter(o);
  familles = [];
  const N = C.l * C.h;
  H = new Array(N).fill(0);
  E = { arbres: C.arbres.slice(), foret: C.foret.slice(), bati: new Set(), routes: new Set(), forts: new Set() };
  // la mer : un plan translucide sur toute la carte, qui recouvre aussi les lacs
  const marge = 4, lx = Math.sqrt(3) * (C.l + 0.5) + 2 * marge, lz = 1.5 * (C.h - 1) + 2 + 2 * marge;
  eau = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), matMer);
  eau.rotation.x = -Math.PI / 2;
  eau.position.set(Math.sqrt(3) * (C.l - 0.5) / 2, MER, 0.75 * (C.h - 1));
  eau.receiveShadow = true;
  groupe.add(eau);
  // la glace des lacs : des hexagones posés sur l'eau, visibles quand il gèle
  const lacs = [];
  for (let i = 0; i < N; i++) if (C.terrain[i] === 2) { const p = posCase(i); lacs.push(hexagone(1).translate(p.x, MER + 0.004, p.z)); }
  glace = new THREE.Mesh(lacs.length ? fusion(lacs) : new THREE.BufferGeometry(), matGlace);
  glace.visible = false;
  groupe.add(glace);
  superpositions(N);
  rebatir();
  geler(gel);
}
/** Un hexagone plat (pointe vers z), non indexé. */
const hexagone = r => new THREE.CircleGeometry(r, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6).toNonIndexed();

function rebatir() {
  for (const f of familles) jeter(f);
  const N = C.l * C.h, TU = lot(), DE = lot(), RS = lot(), RE = lot();
  for (let i = 0; i < N; i++) H[i] = TERR[genre(i)][1];
  rivieres(RS, RE);
  const teinte = (TEINTES[saison] || TEINTES[2]).clone().lerp(PAILLE, Math.min(sec, 2) * 0.22);  // l'herbe sèche avec la sécheresse
  for (let i = 0; i < N; i++) {
    const g0 = genre(i), [col, top] = TERR[g0], { x, z, c, r } = posCase(i), bas = -1, h = top - bas;
    const g = cyl(R * 0.965, R, h, 6).clone();
    g.translate(x, bas + h / 2, z);
    const k = new THREE.Color(col).offsetHSL((hache(c, r, 1) - 0.5) * 0.015, 0, (hache(c, r, 2) - 0.5) * 0.05);
    if (!EAUX.has(g0)) { k.multiply(teinte); if (neige) k.lerp(BLANC, neige * 0.6); }
    const n = g.attributes.normal, a = new Float32Array(n.count * 3);
    for (let v = 0; v < n.count; v++) { const f = n.getY(v) > 0.5 ? 1 : 0.62; a.set([k.r * f, k.g * f, k.b * f], v * 3); } // flancs plus sombres
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    TU.g.push(g);
    if (g0 !== 'bati') decor(DE, i, g0, top, x, z, c, r);
  }
  familles = [fige(TU, groupe, MAT_SOL), fige(DE, groupe, MAT_SOL), fige(RS, groupe, MAT_BERGE), fige(RE, groupe, matRiv)];
  teinterEaux();
}

const p = (L, g, col, x, y, z, ry = 0, ep = EP) => put(L, g, col, x, y, z, ry, ep);
/** Les points ([x, z]) du tracé des rivières, par case ; et les cases bâties (villes, fermes) : la nuit s'y reflète (nuit.js). */
export const pointsRiviere = () => rivPts;
export const casesBaties = () => E.bati;
/** Le pied des cascades ({ x, y, z }) : l'écume s'y forme (eau.js). */
export const piedsCascades = () => cascades;
export const presRiviere = (i, x, z) => (rivPts.get(i) || []).some(v => (v[0] - x) ** 2 + (v[1] - z) ** 2 < 0.13);
/** Un point au hasard (stable) dans la case, à l'écart des rivières. */
function auHasard(i, x, z, k, sel, rayon = 0.62) {
  for (let essai = 0; essai < 4; essai++) {
    const an = hache(i, k * 4 + essai, sel) * Math.PI * 2, l = Math.sqrt(hache(i, k * 4 + essai, sel + 1)) * rayon;
    const px = x + Math.cos(an) * l, pz = z + Math.sin(an) * l;
    if (!presRiviere(i, px, pz)) return [px, pz];
  }
  return null;
}
const FEUILLES = {
  1: [0x8fd15a, 0xa6dd6a, 0x7cc84d, 0x97d35f, 0xf2b5cf], 2: [0x5fae3e, 0x74b83f, 0x4f9a37], 3: [0xd9822b, 0xc9a13a, 0xb5562a, 0x74b83f],
};
// arbres et montagnes : proposition 1 de maquettes/web_engine/arbres-montagnes.html (validée le 18/11/2026)
const VERTS = [0x3e7f34, 0x356f30, 0x4a8a3c];
function arbre(L, x, y, z, s, i, k, conif) {
  const ry = hache(i, k, 25) * 6;
  p(L, cyl(0.2 * s, 0.32 * s, 1.5 * s, 5), 0x6e4a2c, x, y + 0.75 * s, z);
  if (conif) {
    // sapin à trois étages, chacun tourné ; l'étage du haut blanchi par la neige
    const v = saison === 0 ? 0x557a50 : VERTS[hache(i, k, 26) * 3 | 0];
    [[1.75, 2.3, 1.9], [1.35, 2.1, 3.2], [0.95, 1.9, 4.4]].forEach(([r, h, hy], e) =>
      p(L, cone(r * s, h * s, 7), neige > 0.3 && e === 2 ? 0xf4f6f8 : nv(v, e === 2 ? 0.4 : 0.15), x, y + hy * s, z, ry + e * 0.45));
  } else if (saison === 0) {
    // nu l'hiver : trois branches
    for (let b = 0; b < 3; b++) { const a = ry + b * 2.1; p(L, boite(0.16 * s, 1.5 * s, 0.16 * s).clone().rotateZ(0.6), nv(0x6e4a2c, 0.4), x + Math.cos(a) * 0.35 * s, y + 1.95 * s, z + Math.sin(a) * 0.35 * s, a, 0); }
  } else {
    // feuillu en grappe de trois boules, chacune de sa couleur de saison
    const pal = FEUILLES[saison] || FEUILLES[2], c = j => pal[hache(i, k, 27 + j) * pal.length | 0];
    p(L, sphere(1.45 * s, 0), c(0), x, y + 2.75 * s, z, ry);
    p(L, sphere(1.05 * s, 0), c(1), x + Math.cos(ry) * 0.9 * s, y + 2.35 * s, z + Math.sin(ry) * 0.9 * s, ry);
    p(L, sphere(0.95 * s, 0), c(2), x - Math.cos(ry + 0.8) * 0.8 * s, y + 3.3 * s, z - Math.sin(ry + 0.8) * 0.8 * s, ry);
  }
}
/** Une géométrie aux sommets bousculés (roche taillée), la pointe gardée en place. */
function bosseler(g, force, graine) {
  g = g.clone();
  const P = g.attributes.position, vu = new Map();
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!vu.has(k)) { const n = vu.size; vu.set(k, [(hache(graine, n, 1) - 0.5) * force, (hache(graine, n, 2) - 0.5) * force * 0.6, (hache(graine, n, 3) - 0.5) * force]); }
    if (Math.hypot(x, z) < 1e-4) continue;
    const [dx, dy, dz] = vu.get(k);
    P.setXYZ(v, x + dx, y + dy, z + dz);
  }
  g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}
const ROCHE = 0x8a8173, ROCHE2 = 0x7a7266, PICS = [[0, -0.05, 1.15], [-0.38, 0.12, 0.72], [0.36, 0.2, 0.62]];
const GISEMENTS = { pierre: 0xd0cbbf, fer: 0xb0603a, charbon: 0x2e2e33, or: 0xf0c43a };
const W = 0.46, D = 0.24, JEU = 0.04; // parcellaire de la maquette
function decor(L, i, g0, y, x, z, c, r) {
  const t = C.terrain[i];
  // arbres : la forêt (autant que la case en porte) ou quelques arbres épars
  // (le moteur compte 0 à 6 arbres par case : on en dessine 11/6 fois plus, plus serrés, et des buissons en forêt)
  const n0 = t >= 4 && t <= 5 && !degage(i) ? (E.arbres[i] | 0) : 0, nb = Math.round(n0 * 11 / 6);
  for (let k = 0; k < nb; k++) {
    const q = auHasard(i, x, z, k, 21, 0.66);
    if (!q) continue;
    const s = arrondi((0.62 + hache(i, k, 23) * 0.55) * S0);
    arbre(L, q[0], y, q[1], s, i, k, hache(i, k, 24) < (t === 5 ? 0.75 : 0.5));
  }
  for (let k = 0; k < (n0 >= 4 ? n0 - 2 : 0); k++) {
    const q = auHasard(i, x, z, k, 41, 0.7);
    if (!q) continue;
    const s = arrondi((0.5 + hache(i, k, 42) * 0.3) * S0);
    p(L, sphere(s, 0).clone().scale(1, 0.6, 1), saison === 0 ? nv(0x5d6b3e, 0.5) : saison === 3 ? 0x8a8a3a : 0x4f8f3a, q[0], y + 0.35 * s, q[1]);
  }
  if (g0 === 'colline' && !degage(i)) for (let k = 0; k < 2; k++) {
    const q = auHasard(i, x, z, k, 31);
    if (!q) continue;
    p(L, dome(arrondi((3 + hache(i, k, 33) * 1.4) * S0)), nv(0x97ad52, 0.6), q[0], y, q[1], 0, 0.012);
  }
  if (g0 === 'montagne') {
    // un massif : trois pics de roche taillée ; la neige descend plus bas l'hiver ; éboulis et sapins au pied
    const bas = saison === 0 || neige > 0.3 ? 0.42 : 0.62;
    PICS.forEach(([dx, dz, k], j) => {
      const s = k * S0, ry = hache(i, j, 55) * 6, h = 9.5 * s, hn = h * (1 - bas), rn = 5.6 * s * (1 - bas) * 1.08;
      p(L, bosseler(cone(5.6 * s, h, 6), 1.1 * s, i * 7 + j), nv(j === 1 ? ROCHE2 : ROCHE, 0.25), x + dx, y + h / 2, z + dz, ry);
      p(L, bosseler(cone(rn, hn, 6), 0.5 * s, i * 7 + j), 0xf7f5ee, x + dx, y + h - hn / 2 + 0.002, z + dz, ry, 0.012);
    });
    for (let k = 0; k < 6; k++) { const q = auHasard(i, x, z, k, 61, 0.8); if (!q) continue; const s = arrondi((0.35 + hache(i, k, 62) * 0.3) * S0); p(L, sphere(1.2 * s, 0), nv(0x9b958a, 0.4), q[0], y + 0.3 * s, q[1], hache(i, k, 63) * 3); }
    for (let k = 0; k < 4; k++) {
      const q = auHasard(i, x, z, k, 71, 0.85); if (!q || Math.hypot(q[0] - x, q[1] - z) < 0.6) continue;
      const s = arrondi((0.5 + hache(i, k, 72) * 0.2) * S0);
      p(L, cyl(0.2 * s, 0.3 * s, s, 5), 0x6e4a2c, q[0], y + 0.5 * s, q[1]); p(L, cone(1.4 * s, 3 * s, 7), neige > 0.3 ? 0xe9eef2 : 0x3e7f34, q[0], y + 2.4 * s, q[1]);
    }
  }
  if (C.gisement[i]) {
    // au pied du relief : deux rochers et des cailloux de la couleur du minerai
    const l = g0 === 'montagne' ? 0.66 : 0.5;
    let an = hache(i, 60) * Math.PI * 2;
    for (let e = 0; e < 5 && presRiviere(i, x + Math.cos(an) * l, z + Math.sin(an) * l); e++) an += Math.PI / 3; // à l'écart de la rivière
    const gx = x + Math.cos(an) * l, gz = z + Math.sin(an) * l;
    for (let k = 0; k < 2; k++) p(L, sphere(arrondi((0.6 + hache(i, k, 61) * 0.3) * S0), 0), nv(0x9b958a, 0.4), gx + (k - 0.5) * 0.12, y + 0.05, gz + (hache(i, k, 62) - 0.5) * 0.08, hache(i, k, 63) * 3);
    const col = GISEMENTS[C.gisement[i]] ?? 0x9c9c94;
    for (let k = 0; k < 3; k++) p(L, sphere(0.045, 0), col, gx + (hache(i, k, 64) - 0.5) * 0.26, y + 0.025, gz + 0.07 + (hache(i, k, 65) - 0.5) * 0.14, 0, 0.008);
  }
  if (champ(i)) {
    // parcellaire : trois bandes de deux parcelles, alignées sur une direction de la case, avec leurs sillons
    const an = (hache(c, r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an);
    const CC = sec === 3 ? [0x8a6e4a, 0x7a6040, 0x806848] : saison !== 0 && sec === 2 ? [0xa8824a, 0x94703e, 0x8a6a3c] : saison !== 0 && sec === 1 ? [0xd8c060, 0xc9ad4e, 0xbfa452] : saison === 0 ? (neige > 0.3 ? [0xeef2f6, 0xe4eaef] : [0xa08a5a, 0x8f7a4f]) : saison === 1 ? [0x9fd35a, 0x86c24a, 0xb5d86a] : saison === 3 ? [0xc9a35a, 0x6e4e32, 0xa8803f, 0x7a5a3a] : [0xe3c75b, 0xd6b24a, 0xa9c457, 0xc9b24a];
    const poser = (w, h, d, col, lx, lz) => p(L, boite(w, h, d), col, x + lx * ca + lz * sa, y + h / 2, z - lx * sa + lz * ca, an, 0);
    if (hache(c, r, 12) < 0.35) { // épouvantail
      const ex = x + 0.05 * sa, ez = z + 0.05 * ca;
      p(L, boite(0.008, 0.11, 0.008), 0x5b3a1e, ex, y + 0.055, ez, 0, 0.003);
      p(L, boite(0.075, 0.008, 0.008), 0x5b3a1e, ex, y + 0.09, ez, an, 0.003);
      p(L, boite(0.034, 0.034, 0.02), 0x8a5a34, ex, y + 0.083, ez, an, 0.003);
      p(L, cyl(0.024, 0.024, 0.007, 8), 0xd9b45a, ex, y + 0.117, ez, 0, 0.003);
    }
    for (let b = -1; b <= 1; b++) for (const cote of [-1, 1]) {
      const col = new THREE.Color(CC[hache(c * 7 + b, r * 5 + cote, 9) * CC.length | 0]), lx = cote * (W + JEU) / 2, lz = b * (D + JEU);
      poser(W, 0.03, D, col.getHex(), lx, lz);
      if (saison === 2 && b === 1 && cote === -1 && hache(c, r, 14) < 0.7) for (const gg of [-0.12, 0.12]) { // meules de foin, l'été
        const gx = lx + gg; p(L, cone(0.06, 0.11, 8), 0xd8b45a, x + gx * ca + (lz) * sa, y + 0.085, z - gx * sa + (lz) * ca, 0, 0.004);
        p(L, sphere(0.025, 0), 0xc9a24a, x + gx * ca + lz * sa, y + 0.14, z - gx * sa + lz * ca, 0, 0);
      }
      if (saison === 2 && b === 0 && cote === 1) for (const gg of [-0.15, 0, 0.15]) { // gerbes
        const gx = lx + gg;
        p(L, cone(0.03, 0.08, 6), 0xe3c75b, x + gx * ca + lz * sa, y + 0.07, z - gx * sa + lz * ca, 0, 0.004);
      }
      if (saison !== 0) for (const sl of [-1, 0, 1]) poser(W * 0.9, 0.034, 0.018, col.clone().multiplyScalar(0.8).getHex(), lx, lz + sl * D / 3); // sillons
    }
  }
  if (saison === 1 && (g0 === 'prairie' || g0 === 'colline') && !nb && !degage(i)) for (let k = 0; k < 9; k++) { // fleurs des prés au printemps
    const q = auHasard(i, x, z, 0, 120 + k); if (q) p(L, sphere(0.012, 0), [0xff6b9a, 0xffd34d, 0xffffff, 0xb57bff][k % 4], q[0], y + 0.012, q[1], 0, 0);
  }
  if (g0 === 'prairie' && !nb && !degage(i) && hache(i, 70) < 0.5) { const q = auHasard(i, x, z, 0, 71); if (q) p(L, sphere(S0, 0), saison === 3 ? 0x8fa03c : saison === 0 ? nv(0x7d8a5a, 0.5) : 0x5fa83c, q[0], y + 0.7 * S0, q[1]); }
  if (g0 === 'hautfond' && hache(i, 72) < 0.3) { const q = auHasard(i, x, z, 0, 73); if (q) p(L, sphere(arrondi((0.8 + hache(i, 74) * 0.6) * S0), 0), 0x9b958a, q[0], y + 0.6 * S0, q[1]); }
}

/** Centres monde des six parcelles d'une case cultivée (même tracé que le décor), ou null. */
export function parcelles(i) {
  if (!C || !champ(i)) return null;
  const { x, z, c, r } = posCase(i), an = (hache(c, r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an), centres = [];
  for (let b = -1; b <= 1; b++) for (const cote of [-1, 1]) {
    const lx = cote * (W + JEU) / 2, lz = b * (D + JEU);
    centres.push({ x: x + lx * ca + lz * sa, z: z - lx * sa + lz * ca, b, cote });
  }
  return { an, W, D, centres };
}

// ------------------------------------------------------------------ rivières : ruban de sable puis ruban d'eau, en courbes d'une case à l'autre
function perp(pts, i) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }
/** Un ruban plat de demi-largeur larg le long de pts ([x, z] ou [x, z, y]) ; y : hauteur des points qui n'en ont pas. */
export function ruban(pts, larg, y = 0) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ya = y] = pts[i], [bx, bz, yb = y] = pts[i + 1], pa = perp(pts, i), pb = perp(pts, i + 1);
    pos.push(ax + pa[0] * larg, ya, az + pa[1] * larg, bx + pb[0] * larg, yb, bz + pb[1] * larg, ax - pa[0] * larg, ya, az - pa[1] * larg,
      ax - pa[0] * larg, ya, az - pa[1] * larg, bx + pb[0] * larg, yb, bz + pb[1] * larg, bx - pb[0] * larg, yb, bz - pb[1] * larg);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}
function rivieres(RS, RE) {
  rivPts = new Map(); cascades = [];
  const sable = saison === 0 && neige > 0.3 ? 0xe8ecef : 0xdccf96;
  const niveau = i => Math.max(H[i], MER);
  for (const ch of C.rivieres || []) ch.forEach((i, n) => {
    if (!TERRE(C.terrain[i])) return;
    const k = posCase(i), av = ch[n - 1], ap = ch[n + 1];
    const milieu = j => { const q = posCase(j); return [(k.x + q.x) / 2, (k.z + q.z) / 2]; };
    const A = av != null ? milieu(av) : [k.x + 0.2, k.z - 0.2], B = ap != null ? milieu(ap) : [k.x - 0.15, k.z + 0.15];
    const M = [k.x + (hache(k.c, k.r, 5) - 0.5) * 0.4, k.z + (hache(k.c, k.r, 6) - 0.5) * 0.4], pts = [];
    for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push([(1 - t) ** 2 * A[0] + 2 * t * (1 - t) * M[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * M[1] + t * t * B[1]]); }
    if (!rivPts.has(i)) rivPts.set(i, []);
    rivPts.get(i).push(...pts);
    const w = av != null ? 0.19 : 0.12;
    p(RS, ruban(pts, w + 0.11, H[i] + 0.006), sable, 0, 0, 0, 0, 0);
    p(RE, ruban(pts, w, H[i] + 0.012), 0xffffff, 0, 0, 0, 0, 0);
    // une cascade quand la case suivante est plus basse (ou la mer)
    if (ap != null && niveau(ap) < H[i] - 0.05) {
      const q = posCase(ap), dh = H[i] - niveau(ap);
      p(RE, boite(0.03, dh, 2 * w), 0xffffff, B[0], niveau(ap) + dh / 2 + 0.012, B[1], -Math.atan2(q.z - k.z, q.x - k.x), 0);
      cascades.push({ x: B[0], y: niveau(ap) + 0.02, z: B[1] });
    }
  });
}
const RIV_CRUE = new THREE.Color(0x8f8460), RIV_SALE = new THREE.Color(0x6f7f45);
let crue = 0, sale = 0;
function teinterEaux() {
  matRiv.color.copy(RIV).lerp(RIV_HIVER, Math.max(gel, saison === 0 ? neige : 0)).lerp(RIV_GEL, gel * 0.6).lerp(RIV_CRUE, crue * 0.7).lerp(RIV_SALE, sale * 0.65);
}
/** Crue (0 à 1 : eau trouble et boueuse) et pollution de l'eau (0 à 1 : vert brun) des rivières ; boue.js les tient à jour. */
export function teinterRivieres(c, s) { crue = c; sale = s; teinterEaux(); }
/** La sécheresse du décor : 0, 1 (champs jaunis, herbe pâle), 2 (champs grillés) ou 3 (champs vides : la famine, chroniques.js) ;
 *  le décor ne se refait que si elle change. */
export function secher(v) { v = v | 0; if (v === sec) return; sec = v; if (C) rebatir(); }
/** Le gel (0 à 1) : l'eau des rivières et des lacs pâlit puis blanchit, la mer un peu. */
export function geler(v) {
  gel = U.gel.value = Math.max(0, Math.min(1, v || 0));
  if (eau) eau.material.color.copy(EAU).lerp(EAU_GEL, gel * 0.3);
  if (glace) { matGlace.opacity = 0.85 * gel; glace.visible = gel > 0.02; }
  teinterEaux();
}

/** Saison (0 hiver… 3 automne) et neige au sol (0 à 1). */
export function majSaison(s, n) {
  const nq = Math.round((n || 0) * 10) / 10;
  if (s === saison && nq === neige) return;
  saison = s; neige = nq;
  if (C) rebatir();
}

// ------------------------------------------------------------------ état de la partie (arbres, bâti, routes, territoires)
const pareil = (a, b) => a.length === b.length && a.every((v, k) => v === b[k]);
const memes = (a, b) => a.size === b.size && [...a].every(v => b.has(v));
export function majEtat(etat) {
  if (!C) return;
  const cs = etat.cases, bati = new Set(etat.batiments.map(b => b.case));
  const routes = new Set((etat.routes || []).flatMap(r => [r[0], r[1]])), forts = new Set((etat.forts || []).map(f => f.case));
  const nq = Math.round((etat.meteo?.neige_sol || 0) * 10) / 10;
  const change = !pareil(cs.arbres, E.arbres) || !pareil(cs.foret, E.foret) || !memes(bati, E.bati) || !memes(routes, E.routes) || !memes(forts, E.forts) || etat.saison !== saison || nq !== neige;
  E = { arbres: cs.arbres.slice(), foret: cs.foret.slice(), bati, routes, forts };
  saison = etat.saison; neige = nq;
  if (change) rebatir();
  territoires(etat);
}

/** Les cases à dégager de leur décor (ouvrages de siège, garnisons) : le décor est refait si elles changent. */
export function degager(cases) { if (memes(cases, degages)) return; degages = new Set(cases); if (C) rebatir(); }

function coin(x, z, r, k, y) { const a = (60 * k - 30) * Math.PI / 180; return [x + Math.cos(a) * r, y, z + Math.sin(a) * r]; }
/** Liseré au bord des territoires : sombre dessous, couleur du royaume dessus, posé sur le dessus de chaque case. */
function territoires(etat) {
  const couleurs = {};
  for (const r of etat.royaumes) couleurs[r.id] = new THREE.Color(r.couleur).offsetHSL(0, 0.12, 0.14);
  couleurs[99] = new THREE.Color('#4b4b4b');
  const pr = etat.cases.proprio, pos = [], cols = [], sombre = new THREE.Color(0x1a1a1a), gris = new THREE.Color(0x888888);
  for (let i = 0; i < pr.length; i++) {
    const o = pr[i];
    if (o < 0) continue;
    const { x, z } = posCase(i), y = Math.max(H[i], MER) + 0.02;
    for (let k = 0; k < 6; k++) {
      const v = voisin(i, k);
      if (v >= 0 && pr[v] === o) continue;
      for (const [r1, r2, dy, cc] of [[0.95, 0.78, 0, sombre], [0.93, 0.84, 0.004, couleurs[o] || gris]]) {
        const A = coin(x, z, r1, k, y + dy), B = coin(x, z, r1, k + 1, y + dy), A2 = coin(x, z, r2, k, y + dy), B2 = coin(x, z, r2, k + 1, y + dy);
        pos.push(...A, ...B, ...B2, ...A, ...B2, ...A2);
        for (let w = 0; w < 6; w++) cols.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  liseres.geometry.dispose();
  liseres.geometry = g;
}

// ------------------------------------------------------------------ surbrillances
const matLiseres = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const matSurb = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false, depthTest: false });
const matAnneau = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false });
const matPoints = new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false, transparent: true });
const _m = new THREE.Matrix4();
function superpositions(N) {
  liseres = new THREE.Mesh(new THREE.BufferGeometry(), matLiseres);
  groupe.add(liseres);
  surb = new THREE.InstancedMesh(new THREE.CircleGeometry(0.97, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6), matSurb, N);
  surb.count = 0;
  surb.frustumCulled = false; // la sphère englobante des instances n'est jamais recalculée : sans cela, la surbrillance disparaît
  for (let i = 0; i < N; i++) surb.setColorAt(i, new THREE.Color(0xe6ff4a));
  groupe.add(surb);
  const ring = [];
  for (let k = 0; k < 6; k++) {
    const o1 = coin(0, 0, 1.0, k, 0), o2 = coin(0, 0, 1.0, k + 1, 0), i1 = coin(0, 0, 0.83, k, 0), i2 = coin(0, 0, 0.83, k + 1, 0);
    ring.push(...o1, ...o2, ...i2, ...o1, ...i2, ...i1);
  }
  const gr = new THREE.BufferGeometry();
  gr.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
  anneau = new THREE.Mesh(gr, matAnneau);
  anneau.visible = false;
  groupe.add(anneau);
  points = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), matPoints, 500);
  points.count = 0;
  points.frustumCulled = false; // idem : sinon la trace des marches disparaît
  groupe.add(points);
}
export function surbrillance(cases, couleur = 0xe6ff4a) {
  let n = 0;
  const c = new THREE.Color(couleur);
  for (const i of cases) {
    const { x, z } = posCase(i);
    surb.setMatrixAt(n, _m.makeTranslation(x, dessus(i) + 0.03, z));
    surb.setColorAt(n++, c);
  }
  surb.count = n;
  surb.instanceMatrix.needsUpdate = true;
  if (surb.instanceColor) surb.instanceColor.needsUpdate = true;
}
export function selection(i, couleur = 0xffffff) {
  if (i == null || i < 0) { anneau.visible = false; return; }
  const { x, z } = posCase(i);
  anneau.visible = true;
  anneau.position.set(x, dessus(i) + 0.045, z);
  anneau.material.color.setHex(couleur);
}
export function trace(cases) {
  let n = 0;
  for (const i of cases || []) {
    if (n >= 500) break;
    const { x, z } = posCase(i);
    points.setMatrixAt(n++, _m.makeTranslation(x, dessus(i) + 0.05, z));
  }
  points.count = n;
  points.instanceMatrix.needsUpdate = true;
}
export function animer(dt, t) {
  U.t.value = t;
  if (U.gel.value !== gel) geler(U.gel.value); // l'ancienne météo écrit directement U.gel
  if (surb && surb.count) surb.material.opacity = 0.36 + Math.sin(t * 4.5) * 0.16;
}

