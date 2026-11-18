// Les sièges (maquette validée : maquettes/guerre.html, source maquettes/source/guerre/guerre.js) : le siège en règle d'une ville
// ou d'un fort — parallèles et boyaux en zigzag qui avancent de mois en mois, gabions, deux batteries qui tirent, canons de la place
// qui répondent, brèche qui s'ouvre dans la courtine qui fait face au camp (avec ses gravats), défenseurs sur les bastions,
// drapeau blanc quand la place a faim, camp de tentes ; l'assaut et la capitulation joués pendant le mois ; le pillage des faubourgs
// (nos soldats sortent du camp, le faubourg flambe, ils rentrent chargés de butin ; il reste noirci, quelques braises).
// Tout est en unités du plateau. Les ouvrages d'un siège sont figés une fois par clé (place, époque, armée, camp) ; ce qui change
// de mois en mois (tranchées creusées, brèche, drapeau) ne fait que montrer, cacher ou étirer des groupes déjà faits.
// L'armée assiégeante (sur la case de la place pour le moteur) est dessinée au camp, au bout des tranchées (monde.js : campArmee).
// Le camp se dresse sur une case libre à une, deux ou trois cases de l'enceinte ; tranchées et pillards suivent des chemins tracés sur le
// terrain libre (choisirCamp, cheminPillards) : jamais sur un bâtiment ni sur l'eau, entre les faubourgs quand il le faut.
import { THREE, scene, posCase, caseA, voisins, hache, chaqueImage } from './scene.js';
import { lot, put, fige, toon, boite, cyl, cone, sphere } from './toon.js';
import { carte, dessus, solEn, presRiviere } from './plateau.js';
import { maillageCache, maillageArmee, fantassin, canon, PALIERS } from './modeles.js';
import { bouffee } from './vie.js';
import { infoRemparts, STYLE_REMP, BRONZE, lisse, putR, ryDe, contourGroupe, decale, RE } from './remparts.js';
import { couleurDe, palierRoyaume } from './monde.js';

const SQ3 = Math.sqrt(3), ECH_GENS = 0.045;
const DIRS = [[1, 0], [0.5, 0.866], [-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866]]; // les six directions de voisin(i, d), en (x, z)
export const capVers = (dx, dz) => Math.atan2(dx, dz); // pour un modèle qui regarde +z
const groupe = new THREE.Group();
scene.add(groupe);
let horloge = 0;

// ---------------------------------------------------------------- petites choses communes : copies de modèles, flammes, drapeaux, éclairs
/** Un groupe neuf qui partage les maillages d'un modèle figé (un groupe ne se pose pas à deux endroits). */
export function copie(m) { const g = new THREE.Group(); m.traverse(o => { if (o.isMesh) { const c = new THREE.Mesh(o.geometry, o.material); c.castShadow = o.castShadow; g.add(c); } }); return g; }
/** Un soldat à pied de l'armée d'un royaume (face à +z), à l'échelle ech ; objet : 'pelle', 'sac', 'caisse'. */
export function soldat(parent, couleur, palier, ech = ECH_GENS, objet = '') {
  const p = Math.max(0, Math.min(5, palier | 0));
  const g = maillageCache(`soldat|${couleur}|${p}|${objet}`, L => {
    fantassin(L, objet === 'pelle' ? { ...PALIERS[p], baionnette: false } : PALIERS[p], 0, 0, couleur);
    if (objet === 'pelle') { const m = boite(0.09, 1.7, 0.09); m.rotateX(0.7); put(L, m, 0x5b3a1e, -0.45, 1.1, 0.75, 0, 0.04); put(L, boite(0.42, 0.5, 0.07), 0x9a9a9a, -0.45, 0.42, 1.38, 0, 0.04); }
    if (objet === 'caisse') put(L, boite(1.5, 1.2, 1.5), 0xb07a3a, 0, 3.6, -0.3, 0.3, 0.14);
    if (objet === 'sac') put(L, sphere(1, 1), 0xd9c08a, 0, 3.6, -0.35, 0, 0.14);
  });
  partage(g); g.scale.setScalar(ech); g.rotation.order = 'YXZ'; parent.add(g); return g;
}
const M_FLAMME = new THREE.MeshBasicMaterial({ color: 0xff9a2a }), M_FLAMME2 = new THREE.MeshBasicMaterial({ color: 0xffd34d });
const GEO_FLAMMES = [0.5, 0.34, 0.38].map(h => { const g = new THREE.ConeGeometry(0.12, h, 5).translate(0, h / 2, 0); g.userData.partage = true; return g; });
/** Trois langues de feu (cachées au départ), animées par animFeu. */
export function feu(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  [[0, 0, M_FLAMME], [0.18, 0.1, M_FLAMME2], [-0.15, -0.12, M_FLAMME]].forEach(([dx, dz, m], i) => { const c = new THREE.Mesh(GEO_FLAMMES[i], m); c.position.set(dx, 0, dz); g.add(c); });
  parent.add(g); g.visible = false; return g;
}
export const animFeu = (g, t) => g.children.forEach((c, i) => c.scale.set(1 + Math.sin(t * 13 + i) * 0.2, 1 + Math.sin(t * 17 + i * 2) * 0.3, 1 + Math.cos(t * 11 + i) * 0.2));
const pavillons = new Set(), MATS_PAV = new Map();
const matPav = col => { let m = MATS_PAV.get(col); if (!m) { m = toon(new THREE.Color(col), { side: THREE.DoubleSide }); MATS_PAV.set(col, m); } return m; };
/** Un drapeau qui flotte (propre : son matériau à lui, pour en changer la couleur) ; jeterDrapeau quand il disparaît. */
export function drapeau(parent, col, x, y, z, w = 0.12, h = 0.075, propre = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 6, 1).translate(w / 2, 0, 0), propre ? toon(new THREE.Color(col), { side: THREE.DoubleSide }) : matPav(col));
  m.position.set(x, y, z); m.userData.w = w; m.userData.ph = Math.random() * 6; m.castShadow = true; parent.add(m); pavillons.add(m); return m;
}
const _p = new THREE.Vector3();
/** Marque les géométries d'un modèle en cache : oter() ne les libère pas. */
export function partage(g) { g.traverse(o => { if (o.geometry) o.geometry.userData.partage = true; }); return g; }
/** Retire un objet de la scène et libère ce qui n'appartient qu'à lui (géométries hors cache, drapeaux). */
export function oter(obj) {
  if (!obj) return;
  obj.parent?.remove(obj);
  const communs = new Set(MATS_PAV.values());
  obj.traverse(o => {
    if (pavillons.delete(o) && !communs.has(o.material)) o.material.dispose();
    if ((o.isMesh || o.isPoints) && !o.geometry.userData.partage) o.geometry.dispose();
  });
}
// éclairs des canons : points additifs qui s'éteignent en 0,18 s
const tache = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.6)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const NECL = 64, ECLATS = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: tache, size: 0.26, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
ECLATS.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NECL * 3), 3));
ECLATS.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NECL * 3), 3));
ECLATS.frustumCulled = false; scene.add(ECLATS);
const eclats = [];
export function eclat(p, fort = 1) { if (eclats.length < NECL - 2) { eclats.push({ x: p.x, y: p.y, z: p.z, vie: 0.18 }); if (fort > 1) eclats.push({ x: p.x, y: p.y + 0.01, z: p.z, vie: 0.12 }); } }
const versMonde = (o, x, y, z) => { o.updateMatrixWorld(true); return _p.set(x, y, z).applyMatrix4(o.matrixWorld).clone(); };

// ---------------------------------------------------------------- le terrain libre autour d'une place, et les chemins qui le suivent
// Les ouvrages et les pillards ne passent ni sur l'eau (mer, lacs, rivières), ni sur une montagne, ni sur la dalle d'un bâtiment
// (hexagone de rayon 0,9 au centre de sa case), ni dans une enceinte, sur ses bastions ou sur un fort. On quadrille le terrain
// (pas de 0,05) et on y cherche les chemins (Dijkstra, huit voisins) ; plus une cellule est à l'étroit (entre deux faubourgs), plus elle
// coûte : les tranchées passent en plein champ quand elles le peuvent, et les parallèles y ont la place de s'étendre des deux côtés.
const PAS = 0.05, M = 0.04; // M : demi-largeur d'une tranchée, terre rejetée comprise
const rayonHex = (dx, dz) => Math.max(Math.abs(dx), Math.abs(0.5 * dx + 0.866 * dz), Math.abs(0.5 * dx - 0.866 * dz)) / 0.866; // 1 au bord d'une case (sommet vers +z)
/** Le point (x, z) est-il libre à la marge m près ? o = { C, bati, dedans (case → rayon interdit), ronds [[x, z, r]] }. */
function libreEn(o, x, z, m) {
  const i = caseA(x, z); if (i < 0) return false;
  const t = o.C.terrain[i]; if (t < 3 || t === 6) return false;
  if (presRiviere(i, x, z)) return false;
  for (const j of [i, ...voisins(i)]) { // la dalle d'un bâtiment, l'enceinte : la marge passe le bord de la case
    const r = o.dedans.get(j) ?? (o.bati.has(j) ? 0.9 : undefined); if (r === undefined) continue;
    const q = posCase(j); if (rayonHex(x - q.x, z - q.z) < r + m / 0.866) return false;
  }
  for (const [cx, cz, r] of o.ronds) if ((x - cx) ** 2 + (z - cz) ** 2 < (r + m) ** 2) return false;
  return true;
}
const segLibre = (o, a, b, m) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.025) || 1; for (let k = 0; k <= n; k++) if (!libreEn(o, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, m)) return false; return true; };
/** Le quadrillage d'un rectangle : lib = 0 (pris), 1 (libre, à l'étroit), 2 (libre et dégagé), 3 (en plein champ). */
function quadriller(o, x0, z0, x1, z1) {
  const nx = Math.ceil((x1 - x0) / PAS) + 1, nz = Math.ceil((z1 - z0) / PAS) + 1, lib = new Uint8Array(nx * nz);
  for (let b = 0, k = 0; b < nz; b++) for (let a = 0; a < nx; a++, k++) { const x = x0 + a * PAS, z = z0 + b * PAS; lib[k] = libreEn(o, x, z, M) ? (libreEn(o, x, z, 0.16) ? (libreEn(o, x, z, 0.36) ? 3 : 2) : 1) : 0; }
  return { nx, nz, lib, k: (x, z) => { const a = Math.round((x - x0) / PAS), b = Math.round((z - z0) / PAS); return a < 0 || b < 0 || a >= nx || b >= nz ? -1 : b * nx + a; }, xz: k => [x0 + (k % nx) * PAS, z0 + ((k / nx) | 0) * PAS] };
}
const VOISINS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
/** Distances depuis les sources ([[cellule, coût de départ]]) sur le terrain libre ; prev : la cellule d'où l'on vient. */
function dijkstra(Q, sources) {
  const N = Q.lib.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), tas = [];
  const pousse = (d, k) => { tas.push([d, k]); for (let i = tas.length - 1; i;) { const j = (i - 1) >> 1; if (tas[j][0] <= tas[i][0]) break; [tas[i], tas[j]] = [tas[j], tas[i]]; i = j; } };
  const tire = () => { const r = tas[0], f = tas.pop(); if (tas.length) { tas[0] = f; for (let i = 0; ;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < tas.length && tas[a][0] < tas[m][0]) m = a; if (b < tas.length && tas[b][0] < tas[m][0]) m = b; if (m === i) break; [tas[i], tas[m]] = [tas[m], tas[i]]; i = m; } } return r; };
  for (const [k, d] of sources) if (Q.lib[k] && d < dist[k]) { dist[k] = d; pousse(d, k); }
  while (tas.length) {
    const [d, k] = tire(); if (d > dist[k]) continue;
    const a = k % Q.nx, b = (k / Q.nx) | 0;
    for (const [da, db, l] of VOISINS8) {
      const aa = a + da, bb = b + db; if (aa < 0 || bb < 0 || aa >= Q.nx || bb >= Q.nz) continue;
      const kk = bb * Q.nx + aa, li = Q.lib[kk]; if (!li) continue;
      const nd = d + l * PAS * (li === 3 ? 1 : li === 2 ? 1.3 : 2); if (nd < dist[kk]) { dist[kk] = nd; prev[kk] = k; pousse(nd, kk); }
    }
  }
  return { dist, prev };
}
const remonter = (Q, prev, k) => { const pts = []; for (; k >= 0; k = prev[k]) pts.push(Q.xz(k)); return pts; }; // de k jusqu'à sa source
function tendre(Q, pts) { // ne garde que les coudes nécessaires : en ligne droite tant que le terrain est libre, sans se rapprocher des obstacles
  const ok = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (PAS / 2)) || 1, lo = Math.max(1, Math.min(Q.lib[Q.k(...a)] || 0, Q.lib[Q.k(...b)] || 0)); for (let s = 0; s <= n; s++) { const k = Q.k(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n); if (k < 0 || Q.lib[k] < lo) return false; } return true; };
  const r = [pts[0]];
  for (let i = 0; i < pts.length - 1;) { let j = pts.length - 1; while (j > i + 1 && !ok(pts[i], pts[j])) j--; r.push(pts[j]); i = j; }
  return r;
}
/** Une polyligne parcourue à l'abscisse s : { x, z, tx, tz (sens de la marche), nx, nz (à gauche) } ; L : sa longueur. */
function polyligne(W) {
  const cum = [0]; for (let i = 1; i < W.length; i++) cum.push(cum[i - 1] + Math.hypot(W[i][0] - W[i - 1][0], W[i][1] - W[i - 1][1]));
  const L = cum[cum.length - 1];
  const sur = s => {
    s = Math.max(0, Math.min(L, s)); let i = 0; while (i < W.length - 2 && cum[i + 1] < s) i++;
    const l = (cum[i + 1] - cum[i]) || 1, f = (s - cum[i]) / l, tx = (W[i + 1][0] - W[i][0]) / l, tz = (W[i + 1][1] - W[i][1]) / l;
    return { x: W[i][0] + (W[i + 1][0] - W[i][0]) * f, z: W[i][1] + (W[i + 1][1] - W[i][1]) * f, tx, tz, nx: -tz, nz: tx };
  };
  return { W, L, sur };
}
function lisser(pts) { // Chaikin, deux passes (comme les chemins de la maquette)
  for (let it = 0; it < 2; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  return pts;
}
/** Les cases à une, puis deux cases d'un groupe (hors du groupe). */
function autourDe(groupe, n) {
  const vu = new Set(groupe), r = []; let bord = [...groupe];
  for (let k = 0; k < n; k++) { const s = []; for (const c of bord) for (const v of voisins(c)) if (!vu.has(v)) { vu.add(v); s.push(v); r.push(v); } bord = s; }
  return r;
}

// ---------------------------------------------------------------- le camp : de quel côté de la place, et le plan des ouvrages
const camps = new Map(); // case de la place → { cible: [x, z] (point vers lequel la brèche s'ouvre), O, u (pied du mur et normale), plan, o, cases, id }
const memo = new Map();  // case de la place → dernier choix et sa clé (on ne refait le plan que si le voisinage change)
let numero = 0;
/** Choisit le côté de chaque siège : le camp sur une case libre à une, deux ou trois cases de l'enceinte, du côté de l'assiégeant,
 *  et les tranchées qui y mènent sans passer sur les faubourgs ni sur l'eau. À appeler avant majRemparts. */
export function preparerSieges(etat) {
  camps.clear();
  const C = carte(); if (!C) return;
  const bati = new Set(etat.batiments.map(b => b.case)), murees = new Map();
  for (const v of etat.villes) if (v.fortif > 0) for (const c of v.enceinte?.length ? v.enceinte : [v.case]) murees.set(c, 1);
  for (const f of etat.forts || []) murees.set(f.case, 1);
  for (const s of etat.sieges || []) {
    const ville = !s.fort && etat.villes.find(v => v.id === s.ville), p0 = posCase(s.case);
    const chez = etat.villes.filter(v => v.proprio === s.assiegeant).map(v => posCase(v.case)).sort((a, b) => Math.hypot(a.x - p0.x, a.z - p0.z) - Math.hypot(b.x - p0.x, b.z - p0.z))[0];
    const pres = c => { const q = posCase(c); return Math.hypot(q.x - p0.x, q.z - p0.z) < 8; };
    const cle = [s.fort ? 1 : 0, ville?.fortif, (ville?.enceinte || []).join('.'), chez ? chez.c + ',' + chez.r : '', [...bati].filter(pres).sort((a, b) => a - b).join('.'), [...murees.keys()].filter(pres).join('.')].join('|');
    let k = memo.get(s.case);
    if (!k || k.cle !== cle || k.C !== C) { k = choisirCamp(s, ville, C, bati, murees, chez, etat); k.cle = cle; k.C = C; memo.set(s.case, k); }
    camps.set(s.case, k);
  }
  for (const c of memo.keys()) if (!camps.has(c)) memo.delete(c);
}
/** Les cases portant des ouvrages de siège (on en écarte le décor). */
export function casesOuvrages() { const r = new Set(); for (const k of camps.values()) for (const c of k.cases) r.add(c); return r; }
/** Le camp du siège de la place posée sur cette case (null sans siège). */
export const campDe = c => camps.get(c) || null;
/** Où se tient l'armée assiégeante (à côté du camp, face à la place) : { x, z, ry } ou null. */
export const campArmee = c => camps.get(c)?.plan.armee || null;

const DIST_PAR = [0.81, 0.52, 0.285], LONG_PAR = [0.48, 0.38, 0.26]; // parallèles de la maquette : distance au pied du mur, demi-longueur
function choisirCamp(s, ville, C, bati, murees, chez, etat) {
  const p0 = posCase(s.case), niveau = ville ? ville.fortif : 0, fort = !!s.fort, intra = ville?.enceinte?.length ? ville.enceinte : [s.case];
  // l'enceinte (et son fossé en eau au niveau 4), ses bastions et demi-lunes ; le fort et l'armée qui le garde sur son glacis
  const rD = fort ? 0.72 : 1 + (niveau >= 4 ? 0.17 : niveau >= 3 ? 0.03 : 0) / 0.866, dedans = new Map(murees), ronds = [];
  for (const c of intra) dedans.set(c, rD);
  const { P } = contourGroupe(intra), Q = decale(P, -RE);
  if (fort) ronds.push([p0.x, p0.z + 0.58, 0.32]);
  else if (niveau >= 3) P.forEach((q, v) => { const a = P[(v + P.length - 1) % P.length], b = P[(v + 1) % P.length]; if ((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0]) > 0) ronds.push([q[0], q[1], 0.34]); else if (niveau >= 4) ronds.push([q[0], q[1], 0.45]); });
  const o = { C, bati, dedans, ronds };
  // les camps possibles : cases de terre libres à une, deux ou trois cases de l'enceinte (trois : quand les faubourgs la cernent)
  const foret = etat.cases?.foret || [], arbres = etat.cases?.arbres || [];
  const cand = autourDe(intra, 3).filter(c => C.terrain[c] >= 3 && C.terrain[c] !== 6 && !bati.has(c) && !dedans.has(c));
  const xs = [...cand, ...intra].map(c => posCase(c));
  const G = quadriller(o, Math.min(...xs.map(q => q.x)) - 1, Math.min(...xs.map(q => q.z)) - 1, Math.max(...xs.map(q => q.x)) + 1, Math.max(...xs.map(q => q.z)) + 1);
  // les sources : le terrain libre au pied du mur ; partir du milieu d'une courtine coûte moins que d'un angle, et quand les faubourgs
  // ou les bastions ferment l'accès au mur, les tranchées s'arrêtent au plus près (partir de plus loin coûte trois fois la distance)
  const milieux = Q.map((q, j) => { const r = Q[(j + 1) % Q.length]; return [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2]; }), sources = [], qi = intra.map(c => posCase(c));
  for (let kk = 0; kk < G.lib.length; kk++) {
    if (!G.lib[kk]) continue;
    const [gx, gz] = G.xz(kk), r = Math.min(...qi.map(q => rayonHex(gx - q.x, gz - q.z))) - rD; if (r > 0.8) continue;
    sources.push([kk, Math.max(0, r - 0.2) * 0.866 * 3 + (fort ? 0 : Math.min(...milieux.map(m => Math.hypot(m[0] - gx, m[1] - gz))) * 0.8)]);
  }
  const { dist, prev } = dijkstra(G, sources);
  const vers = chez ? [chez.x - p0.x, chez.z - p0.z] : [0, 0], lv = Math.hypot(...vers) || 1;
  let best = null;
  for (const c of cand) {
    const q = posCase(c), kk = G.k(q.x, q.z); if (kk < 0 || !isFinite(dist[kk])) continue;
    if (!libreEn(o, q.x, q.z, 0.1) || !DIRS.every(([dx, dz]) => libreEn(o, q.x + dx * 0.42, q.z + dz * 0.42, 0.02))) continue; // la place des tentes
    const L = dist[kk], lq = Math.hypot(q.x - p0.x, q.z - p0.z) || 1;
    // la place des ouvrages : du premier endroit où la dernière parallèle tient jusqu'au camp ; quand les faubourgs serrent la place,
    // les parallèles ne tiennent qu'au-delà, et le camp recule d'autant pour qu'elles ne s'y tassent pas
    const Wc = tendre(G, remonter(G, prev, kk).reverse()); Wc[Wc.length - 1] = [q.x, q.z];
    const PLc = polyligne(Wc); let sf = 0; while (sf < PLc.L && !parallele(o, PLc, sf, LONG_PAR[2]).length) sf += 0.05;
    const score = ((q.x - p0.x) * vers[0] + (q.z - p0.z) * vers[1]) / (lq * lv) * 1.2 - Math.abs(L - 1.9) * 0.5 - Math.max(0, 1.4 - (PLc.L - sf)) * 3 - (L < 1.15 ? 2 : 0) - (foret[c] || arbres[c] > 2 ? 0.3 : 0) + hache(c, s.case, 91) * 0.1;
    if (!best || score > best.score) best = { score, W: Wc };
  }
  let W;
  if (best) W = best.W;
  else { // shortcut: rien de libre autour (île, montagnes) : l'ancien camp en ligne droite ; les tronçons qui chevauchent quelque chose ne sont pas tracés
    let d = 0, sc = -Infinity; DIRS.forEach(([dx, dz], i) => { const v = (dx * vers[0] + dz * vers[1]) / lv + hache(s.case, i, 91) * 0.1; if (v > sc) { sc = v; d = i; } });
    const [ux, uz] = DIRS[d], e = SQ3 * (intra.length > 1 ? 1 : 0); W = [[p0.x + ux * (e + 0.95), p0.z + uz * (e + 0.95)], [p0.x + ux * (e + 2.5), p0.z + uz * (e + 2.5)]];
  }
  const PL = polyligne(W), w0 = W[0];
  // le pied du mur : le point de l'enceinte (ou du fort) le plus proche du bout des tranchées, et la normale du mur là
  let O, u;
  if (fort) { const dx = w0[0] - p0.x, dz = w0[1] - p0.z, l = Math.hypot(dx, dz) || 1; u = [dx / l, dz / l]; O = [p0.x + u[0] * 0.42, p0.z + u[1] * 0.42]; }
  else {
    let dm = Infinity;
    Q.forEach((a, j) => {
      const b = Q[(j + 1) % Q.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez), f = Math.max(0.05, Math.min(0.95, ((w0[0] - a[0]) * ex + (w0[1] - a[1]) * ez) / (l * l)));
      const px = a[0] + ex * f, pz = a[1] + ez * f, d = Math.hypot(w0[0] - px, w0[1] - pz);
      if (d < dm) { dm = d; O = [px, pz]; u = [ez / l, -ex / l]; } // normale vers dehors (polygone direct)
    });
  }
  const g = Math.hypot(w0[0] - O[0], w0[1] - O[1]), s0 = PL.L - 0.25, f = Math.max(0.1, Math.min(1, (s0 - 0.15) / Math.max(0.05, DIST_PAR[0] - g)));
  // les trois parallèles (abscisses depuis le bout des tranchées) : à leur place, ou reculées le long du chemin jusqu'où elles tiennent
  const sp = [], par = [];
  for (let i = 2, mini = 0; i >= 0; i--) { // reculées, elles gardent l'écart de la maquette (resserré si le chemin est court)
    let s = Math.max(mini, Math.max(0.02, DIST_PAR[i] - g) * f), pts = [];
    for (; s < s0 - 0.25 && !(pts = parallele(o, PL, s, LONG_PAR[i])).length; s += 0.05);
    sp[i] = Math.min(s, Math.max(mini, s0 - 0.25)); par[i] = pts; mini = sp[i] + Math.max(0.15, 0.27 * f);
  }
  const plan = { etapes: [
    { m: 1, pts: zigzag(o, PL, sp[0], s0) }, { m: 1, pts: par[0] },
    { m: 2, pts: zigzag(o, PL, sp[1], sp[0]) }, { m: 2.6, pts: par[1] },
    { m: 4, pts: zigzag(o, PL, sp[2], sp[1]) }, { m: 5, pts: par[2] },
    { m: 4, pts: zigzag(o, PL, 0, sp[2] > 0.15 ? sp[2] : 0) }, // la sape jusqu'au mur quand la dernière parallèle a dû reculer
  ], gabions: [], batteries: [], d0: (() => { const p = PL.sur(sp[2]); return [p.x, p.z]; })() };
  // gabions le long de la deuxième parallèle, là où le terrain est libre ; une batterie de chaque côté, derrière la deuxième
  // parallèle, ou à défaut derrière la première ou la troisième ; s'il n'y a de la place que d'un côté, les deux de ce côté-là
  const c2 = PL.sur(sp[1]);
  for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) { const l = 0.15 + i * 0.081, x = c2.x - c2.tx * 0.043 + c2.nx * sg * l, z = c2.z - c2.tz * 0.043 + c2.nz * sg * l; if (libreEn(o, x, z, 0.02)) plan.gabions.push([x, z]); }
  const places = sg => [sp[1], sp[0], sp[2]].flatMap(s => { const c = PL.sur(s); return [0.26, 0.2, 0.32, 0.14, 0.4, 0.48].map(l => [c.x + c.tx * 0.05 + c.nx * sg * l, c.z + c.tz * 0.05 + c.nz * sg * l]); }).filter(([x, z]) => libreEn(o, x, z, 0.16));
  const A = places(-1), B = places(1);
  for (const [x, z] of [A[0], B[0], ...A, ...B].filter(Boolean)) if (plan.batteries.length < 2 && plan.batteries.every(b => Math.hypot(b.x - x, b.z - z) > 0.3)) plan.batteries.push({ x, z, ry: capVers(O[0] - x, O[1] - z) });
  // le camp au bout des tranchées, l'allée de tentes vers la place ; l'armée à côté, sur du terrain libre
  const fin = PL.sur(PL.L - 0.3), cx = W[W.length - 1][0], cz = W[W.length - 1][1];
  plan.camp = { x: cx, z: cz, ry: capVers(-fin.tx, -fin.tz) - Math.PI / 2 };
  const ry = capVers(-fin.tx, -fin.tz), c = Math.cos(ry), sn = Math.sin(ry), e = empriseArmee(), ECH_CAMP = 0.085;
  const points = (x, z) => { const r = []; for (const u of [0, 0.5, 1]) for (const v of [0, 0.5, 1]) { const lx = (e.min.x + (e.max.x - e.min.x) * u) * ECH_CAMP, lz = (e.min.z + (e.max.z - e.min.z) * v) * ECH_CAMP; r.push([x + lx * c + lz * sn, z - lx * sn + lz * c]); } return r; };
  const tente = ([x, z]) => { const f = -(x - cx) * fin.tx - (z - cz) * fin.tz, l = (x - cx) * fin.nx + (z - cz) * fin.nz; return f > -0.52 && f < 0.32 && Math.abs(l) < 0.48; }; // l'emprise des tentes
  const poses = [[0.95, 0.1], [-0.95, 0.1], [0.8, 0.5], [-0.8, 0.5], [0, -1]].map(([a, b]) => [cx + fin.nx * a - fin.tx * b, cz + fin.nz * a - fin.tz * b]);
  const pose = poses.find(([x, z]) => points(x, z).every(p => libreEn(o, p[0], p[1], 0) && !tente(p))) || poses[0];
  plan.armee = { x: pose[0], z: pose[1], ry };
  // les cases des ouvrages (on en écarte le décor)
  const cases = new Set([caseA(cx, cz), caseA(...pose)]);
  for (const { pts } of plan.etapes) for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t <= 1; t += 0.1) cases.add(caseA(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t));
  for (const [x, z] of [...plan.gabions, ...plan.batteries.map(b => [b.x, b.z])]) cases.add(caseA(x, z));
  cases.delete(-1);
  return { cible: w0, O, u, plan, o, cases, id: ++numero };
}
let emprise = null;
/** L'emprise au sol de l'armée la plus large (palier 5, avec son fourgon), en unités du modèle. */
function empriseArmee() { if (!emprise) { const g = maillageArmee('#888', 5).children[0].geometry; g.computeBoundingBox(); emprise = g.boundingBox; } return emprise; }
/** Un boyau en zigzag entre les abscisses sa et sb du chemin, les crochets réduits (ou effacés) là où le terrain manque. */
function zigzag(o, PL, sa, sb, A = 0.12) {
  if (sb - sa < 0.04) return [];
  const n = Math.max(1, Math.round((sb - sa) / 0.16)), pts = [];
  for (let j = 0; j <= n; j++) {
    const p = PL.sur(sb - (sb - sa) * j / n); let q = [p.x, p.z];
    if (j > 0 && j < n) for (const a of [A, A / 2]) { const sg = j % 2 ? 1 : -1, c = [p.x + p.nx * a * sg, p.z + p.nz * a * sg]; if (segLibre(o, pts[j - 1], c, M)) { q = c; break; } }
    pts.push(q);
  }
  return pts;
}
/** Une parallèle à l'abscisse s, perpendiculaire au chemin, raccourcie de chaque côté au premier obstacle ([] si elle n'a plus de quoi se lire :
 *  moins des trois cinquièmes de sa longueur ; les batteries s'y appuient). */
function parallele(o, PL, s, Lmax) {
  const p = PL.sur(s), bout = sg => { let l = 0; while (l < Lmax && libreEn(o, p.x + p.nx * sg * (l + 0.03), p.z + p.nz * sg * (l + 0.03), M)) l += 0.03; return l; };
  const a = bout(1), b = bout(-1);
  return a + b < Math.max(0.25, 1.2 * Lmax) ? [] : [[p.x - p.nx * b, p.z - p.nz * b], [p.x + p.nx * a, p.z + p.nz * a]];
}
/** Le chemin des pillards : du camp au bord du faubourg pillé, côté camp, en contournant les maisons. */
function cheminPillards(k, fc) {
  const a = k.plan.camp, f = posCase(fc), o = k.o;
  const G = quadriller(o, Math.min(a.x, f.x) - 1.3, Math.min(a.z, f.z) - 1.3, Math.max(a.x, f.x) + 1.3, Math.max(a.z, f.z) + 1.3), sources = [];
  for (let kk = 0; kk < G.lib.length; kk++) if (G.lib[kk]) { const [x, z] = G.xz(kk); if (rayonHex(x - f.x, z - f.z) < 1.2) sources.push([kk, 0]); }
  const { dist, prev } = dijkstra(G, sources), ka = G.k(a.x, a.z);
  if (ka < 0 || !isFinite(dist[ka])) { const dx = f.x - a.x, dz = f.z - a.z, l = Math.hypot(dx, dz) || 1; return polyligne([[a.x, a.z], [f.x - dx / l * 0.95, f.z - dz / l * 0.95]]); }
  const pts = tendre(G, remonter(G, prev, ka)); pts[0] = [a.x, a.z];
  return polyligne(pts.length > 2 ? lisser(pts) : pts);
}
/** Le chemin de l'assaut : du bout des tranchées d au pied de la brèche f, sur le terrain libre (ni dalle ni mur ; ni coin coupé). */
function cheminAssaut(o, d, f) {
  const G = quadriller(o, Math.min(d[0], f.x) - 0.6, Math.min(d[1], f.z) - 0.6, Math.max(d[0], f.x) + 0.6, Math.max(d[1], f.z) + 0.6), sources = [];
  for (let kk = 0; kk < G.lib.length; kk++) if (G.lib[kk]) { const [x, z] = G.xz(kk), r = Math.hypot(x - f.x, z - f.z); if (r < 0.4) sources.push([kk, r * 3]); } // le pied du mur (dans le fossé) : depuis la cellule libre la plus proche
  const { dist, prev } = dijkstra(G, sources);
  let kd = -1; // la cellule libre et atteinte la plus proche du bout des tranchées
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const k = G.k(d[0] + a * PAS, d[1] + b * PAS); if (k >= 0 && isFinite(dist[k]) && (kd < 0 || dist[k] < dist[kd])) kd = k; }
  if (kd < 0) return polyligne([d, [f.x, f.z]]);
  const pts = tendre(G, remonter(G, prev, kd)); pts[0] = d; pts.push([f.x, f.z]);
  return polyligne(pts);
}

// ---------------------------------------------------------------- les ouvrages d'un siège
// S.pt(d, v) : point à la distance d (le pied du mur assiégé vers d = 0,58) et au décalage latéral v ; (S.ux, S.uz) va de la place vers le camp.
// Les parallèles, les boyaux, les gabions, les batteries et le camp suivent le plan du siège (choisirCamp), tracé sur le terrain libre.
const K = 0.62, E = 1.25; // K : le siège de la maquette ramené aux cases du jeu ; E : ouvrages un peu grossis pour la vue de loin
function travauxSiege(S, g, ep, P, roy, k) {
  const { etapes, gabions, batteries } = k.plan, [Ox, Oz] = S.O;
  S.tranchees = etapes.map(({ m, pts }) => {
    const Lt = lot();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = { x: pts[i][0], z: pts[i][1] }, b = { x: pts[i + 1][0], z: pts[i + 1][1] }, l = Math.hypot(b.x - a.x, b.z - a.z), cap = -Math.atan2(b.z - a.z, b.x - a.x), nb = Math.ceil(l / 0.1);
      if (l < 1e-4) continue;
      let nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l; if (nx * (Ox - a.x) + nz * (Oz - a.z) < 0) { nx = -nx; nz = -nz; } // parapet côté place
      for (let s = 0; s < nb; s++) { // par tronçons, chacun posé sur le sol de sa case
        const f = (s + 0.5) / nb, mx = a.x + (b.x - a.x) * f, mz = a.z + (b.z - a.z) * f, y = solEn(mx, mz);
        if (!libreEn(k.o, mx, mz, 0)) continue; // le plan de secours (rien de libre autour) ne trace pas ce qui chevauche
        put(Lt, boite(l / nb + 0.05 * E, 0.003 * E, 0.062 * E), 0xb59c68, mx + nx * 0.008 * E, y + 0.0015 * E, mz + nz * 0.008 * E, cap, 0); // terre rejetée
        put(Lt, boite(l / nb + 0.026 * E, 0.004 * E, 0.026 * E), 0x4a3522, mx - nx * 0.004 * E, y + 0.0025 * E, mz - nz * 0.004 * E, cap, 0); // le fossé
      }
    }
    const t = fige(Lt, g); t.userData.m = m; return t;
  });
  { const Lg = lot(); for (const [x, z] of gabions) { const y = solEn(x, z); put(Lg, cyl(0.014 * E, 0.014 * E, 0.034 * E, 8), 0x9a7a4a, x, y + 0.017 * E, z, 0, 0.003); put(Lg, cyl(0.015 * E, 0.015 * E, 0.006 * E, 8), 0x6a5030, x, y + 0.036 * E, z, 0, 0); } S.gabions = fige(Lg, g); }
  const pal = Math.max(0, Math.min(5, P | 0));
  S.batteries = batteries.map((pb, s) => {
    const b = maillageCache(`batterie|${ep}|${pal}|${roy}`, Lb => {
      for (const x of [-1.25, 1.25]) {
        if (ep === 'industrie') { // canon rayé de fer sur affût de fer
          const f = cyl(0.17, 0.27, 3.1, 10); f.rotateX(Math.PI / 2 - 0.1); put(Lb, f, 0x3a3d42, x, 1.05, 0.55, 0, 0.06); put(Lb, boite(0.6, 0.45, 2.1), 0x5a5f66, x, 0.62, -0.25, 0, 0.05);
          for (const dx of [-0.55, 0.55]) { const r = cyl(0.6, 0.6, 0.14, 12); r.rotateZ(Math.PI / 2); put(Lb, r, 0x2b2b30, x + dx, 0.6, 0, 0, 0.05); }
        } else canon(Lb, PALIERS[pal], x, 0);
        fantassin(Lb, PALIERS[pal], x - 0.9, -1.4, roy);
      }
      for (const x of [-0.2, 0.25]) put(Lb, cyl(0.38, 0.38, 0.8, 8), 0x6b4a2a, x, 0.4, -2.2, 0, 0.05);
    });
    partage(b); b.scale.setScalar(0.05 * E); b.position.set(pb.x, solEn(pb.x, pb.z), pb.z); b.rotation.y = pb.ry; g.add(b);
    return { g: b, canonsL: [[-1.25, 1.12, 2.05], [1.25, 1.12, 2.05]], ph: s ? 0 : 1.3 };
  });
}
function gravatsSiege(S, g, pierre, x, y, z, ry, ech) {
  const r = maillageCache(`gravats|${pierre}`, Lr => {
    const b = sphere(1.5, 1); b.scale(1.3, 0.62, 1.9); put(Lr, b, pierre, -0.3, 0, 0, 0, 0.12);
    for (const [gx, gz, s] of [[1.2, 1.1, 0.7], [-0.6, -1.6, 0.6], [1.6, -0.8, 0.55], [0.4, 1.9, 0.5], [-1.4, 0.9, 0.6]]) put(Lr, boite(s, s * 0.7, s * 0.8), pierre, gx, s * 0.3, gz, gx * 2, 0.06);
  });
  partage(r); r.position.set(x, y, z); r.rotation.y = ry; g.add(r); S.gravats = r; S.echG = ech;
}
function campSiege(S, g, roy, P, camp) {
  const c = maillageCache(`camp|${roy}|${P}`, Lc => {
    let i = 0;
    for (const [lx, lz] of [[-5, -3], [-1.5, -4.5], [2.5, -4], [-5, 3.2], [-1.5, 4.6], [2.5, 4]]) { put(Lc, cone(1.5, 2, 4), i++ % 2 ? 0xe9e2d0 : new THREE.Color(roy).getHex(), lx, 1, lz, Math.PI / 4, 0.09); put(Lc, boite(0.5, 0.9, 0.1), 0x2a2420, lx + 1.05, 0.45, lz, Math.PI / 2, 0); }
    put(Lc, boite(0.16, 5.4, 0.16), 0x4a3420, 0, 2.7, 0, 0, 0.06);
    for (const a of [0, 1.2, 2.4]) put(Lc, boite(1.4, 0.18, 0.18), 0x6b4a2a, -1 + Math.cos(a) * 0.1, 0.12, 0, a, 0.06);
    for (const [x, z] of [[1.5, -1.6], [1.5, 1.6]]) fantassin(Lc, PALIERS[P], x, z, roy);
  });
  partage(c);
  c.scale.setScalar(0.07); c.position.set(camp.x, solEn(camp.x, camp.z), camp.z); c.rotation.y = camp.ry; g.add(c);
  drapeau(c, roy, 0, 4.7, 0, 2.4, 1.5);
  S.feuCamp = versMonde(c, -1, 0.9, 0); S.campFumee = 0;
  const f = feu(c, -1, 0.1, 0, 2.6); f.visible = true; S.flammeCamp = f;
}

// ---------------------------------------------------------------- les sièges du plateau
const sieges = new Map(); // case de la place → S
let tourVu = null;

/** Met les sièges d'accord avec l'état : à appeler après majRemparts (la brèche est un morceau des remparts). */
export function majSieges(etat) {
  const ep = etat.epoque?.cle || 'ancien', vus = new Set(), nouveauMois = tourVu !== null && etat.tour !== tourVu;
  tourVu = etat.tour;
  for (const s of etat.sieges || []) {
    const k = camps.get(s.case); if (!k) continue;
    vus.add(s.case);
    const ville = !s.fort && etat.villes.find(v => v.id === s.ville), info = ville ? infoRemparts(ville.id) : null, ib = info?.infoBreche;
    const roy = couleurDe(s.assiegeant), P = palierRoyaume(s.assiegeant), p0 = posCase(s.case), y0 = dessus(s.case);
    // le pied du mur : le milieu de la courtine percée, ou le bord de la place du côté du camp
    const O = ib ? ib.O : k.O, n = ib ? ib.n : k.u;
    const cle = [ep, roy, P, O.map(v => v.toFixed(3)).join(','), info ? info.g.uuid : 'f', s.fort ? 1 : 0, k.id].join('|');
    let S = sieges.get(s.case);
    if (S && S.cle !== cle) { oter(S.g); S = null; }
    if (!S) {
      const g = new THREE.Group(); groupe.add(g);
      S = { cle, g, ux: n[0], uz: n[1], case: s.case, info, O, k, d0: k.plan.d0 };
      S.pt = (d, v) => ({ x: O[0] + S.ux * (d - 0.58) * K - S.uz * v * K, z: O[1] + S.uz * (d - 0.58) * K + S.ux * v * K });
      S.H = (ib ? ib.y + ib.H : y0 + 0.13);
      travauxSiege(S, g, ep, P, roy, k);
      const pierre = (STYLE_REMP[ep] || STYLE_REMP.ancien).pierre, gp = S.pt(0.66, 0);
      gravatsSiege(S, g, pierre, gp.x, ib ? ib.y : y0, gp.z, -Math.atan2(S.uz, S.ux), 0.1);
      campSiege(S, g, roy, P, k.plan.camp);
      // défenseurs et canons de la place : sur les bastions (ou les angles du mur) qui regardent le camp
      const cible = S.pt(3, 0), dist = p => Math.hypot(p.x - cible.x, p.z - cible.z);
      let postes = info ? info.pointes.filter(p => !p.demi && !p.rentrant).sort((a, b) => dist(a) - dist(b)) : [];
      if (!postes.length) postes = [-0.3, 0.3, 0, -0.15, 0.15].map(v => { const q = S.pt(0.5, v); return { x: q.x, z: q.z, y: S.H, nx: S.ux, nz: S.uz }; });
      const defen = couleurDe(s.proprio ?? (ville ? ville.proprio : -1)), Pd = palierRoyaume(s.proprio);
      S.defenseurs = postes.slice(0, 5).map(p => { const d = soldat(g, defen, Pd, ECH_GENS * 0.9); d.position.set(p.x, p.y, p.z); d.rotation.y = capVers(p.nx, p.nz); return d; });
      S.canons = postes.slice(0, 3).map(p => new THREE.Vector3(p.x + p.nx * 0.07, p.y + 0.03, p.z + p.nz * 0.07));
      if (ep === 'ancien' && info) { const Lc = lot(); for (const p of postes.slice(0, 3)) { const b = cyl(0.009, 0.013, 0.075, 6); b.rotateZ(-Math.PI / 2); putR(Lc, b, BRONZE, p.x + p.nx * 0.035 - p.nz * 0.03, p.y + 0.024, p.z + p.nz * 0.035 + p.nx * 0.03, ryDe(p.nx, p.nz), 0.003); putR(Lc, boite(0.04, 0.016, 0.03), 0x8a3a2a, p.x - p.nz * 0.03, p.y + 0.01, p.z + p.nx * 0.03, ryDe(p.nx, p.nz), 0.003); } fige(Lc, g); } // on pose une pièce en 1700 (les autres époques en ont déjà)
      // l'assaut : huit soldats et un porte-drapeau, par le terrain libre jusqu'au pied de la brèche ; le drapeau blanc de la place
      S.chA = cheminAssaut(k.o, S.d0, S.pt(0.72, 0));
      S.assaut = Array.from({ length: 8 }, () => { const a = soldat(g, roy, P, ECH_GENS * 1.15); a.visible = false; return a; });
      S.drapBreche = new THREE.Group(); { const L2 = lot(); put(L2, boite(0.14, 4.6, 0.14), 0x4a3420, 0, 2.3, 0, 0, 0.05); fige(L2, S.drapBreche); drapeau(S.drapBreche, roy, 0, 3.9, 0, 1.6, 1.05); }
      S.drapBreche.scale.setScalar(ECH_GENS * 1.15); S.drapBreche.visible = false; g.add(S.drapBreche);
      S.blanc = new THREE.Group(); { const L2 = lot(); put(L2, boite(0.012, 0.3, 0.012), 0x4a3420, 0, 0.15, 0, 0, 0.004); fige(L2, S.blanc); drapeau(S.blanc, '#f6f4ee', 0.006, 0.26, 0, 0.13, 0.085); }
      { const q = S.pt(0.45, 0.12); S.blanc.position.set(q.x, S.H, q.z); } S.blanc.visible = false; g.add(S.blanc);
      // les pillards : quatre de nos soldats, un sac ou une caisse de butin au retour
      S.pillards = [0, 1, 2, 3].map(i => { const v = soldat(g, roy, P, ECH_GENS * 1.15), b = soldat(g, roy, P, ECH_GENS * 1.15, i % 2 ? 'caisse' : 'sac'); v.visible = b.visible = false; return [v, b]; });
      S.feux = [0, 1, 2].map(() => feu(g, 0, 0, 0, 0.32));
      sieges.set(s.case, S);
    }
    S.mort = false;
    S.mois = s.mois + 1; S.br = s.murs_max > 0 ? 1 - s.murs / s.murs_max : 0; S.faim = s.faim > 0; S.mursPct = s.murs_pct ?? 100;
    if (S.br0 === undefined) S.br0 = S.br;
    // un faubourg pillé ce mois-ci : la sortie des pillards, l'incendie
    if (nouveauMois && s.pillage && s.pillage.case != null) {
      const f = posCase(s.pillage.case), yf = dessus(s.pillage.case);
      S.pillage = { debut: horloge, ch: cheminPillards(k, s.pillage.case) };
      [[0.32, 0.1], [-0.28, 0.2], [0.02, -0.34]].forEach(([ox, oz], i) => S.feux[i].position.set(f.x + ox, yf + 0.1, f.z + oz));
    }
  }
  for (const [c, S] of sieges) if (!vus.has(c)) { if (S.assautT && horloge < S.assautT.debut + DUREE_ASSAUT) S.mort = true; else { oter(S.g); sieges.delete(c); } }
}

// ---------------------------------------------------------------- le mois joué : assaut, capitulation
const DUREE_ASSAUT = 7.5;
/** Joue sous les yeux du joueur ce que le rapport du mois dit des sièges en cours (appelé par jouerMois, avant le nouvel état). */
export function jouerSieges(rapport) {
  for (const S of sieges.values()) {
    const c = (rapport.combats || []).find(x => x.case === S.case && !x.etape);
    if (c) S.assautT = { debut: horloge, victoire: c.vainqueur === c.attaquant };
    if ((rapport.evenements || []).some(e => e.case === S.case && /capitule/.test(e.texte))) S.capitule = horloge;
  }
}

// ---------------------------------------------------------------- à chaque image
const FL = (a, b, f) => a + (b - a) * f;
chaqueImage((dt, t) => {
  horloge = t;
  for (const [c, S] of sieges) {
    if (S.mort && !(S.assautT && t < S.assautT.debut + DUREE_ASSAUT)) { oter(S.g); sieges.delete(c); continue; }
    const m = S.mois, rendue = S.capitule !== undefined && t - S.capitule < 6, ua = S.assautT ? t - S.assautT.debut : -1, assaut = ua >= 0 && ua < DUREE_ASSAUT;
    for (const g of S.tranchees) g.visible = m >= g.userData.m;
    S.gabions.visible = m >= 2.6;
    for (const b of S.batteries) b.g.visible = m >= 2.6;
    S.br0 += (S.br - S.br0) * Math.min(1, dt * 1.5);
    const br = S.br0;
    if (S.info?.breche) S.info.breche.scale.y = 1 - 0.78 * br;
    S.gravats.scale.setScalar(Math.max(0.001, br) * S.echG);
    // les batteries tirent (pas pendant l'assaut ni la reddition), éclair, fumée, poussière à l'impact
    if (m >= 3 && !rendue && !assaut) for (const b of S.batteries) b.canonsL.forEach(([x, y, z], i) => {
      const per = 2.6, ph = b.ph + i * 1.1;
      if (Math.floor((t - dt - ph) / per) === Math.floor((t - ph) / per)) return;
      const p = versMonde(b.g, x, y, z); eclat(p, 1.6); bouffee(p.x, p.y, p.z, 'poudre', 1.5);
      const cible = S.pt(0.6, (Math.random() - 0.5) * 0.2); setTimeout(() => bouffee(cible.x, S.H * 0.6 + solEn(cible.x, cible.z) * 0.4, cible.z, 'poussiere', 1.1), 380);
    });
    // la place répond tant que ses murs tiennent
    if (m >= 2.6 && S.mursPct > 25 && !rendue && !assaut) S.canons.forEach((p, i) => {
      const per = 3.4, ph = i * 0.9; if (Math.floor((t - dt - ph) / per) === Math.floor((t - ph) / per)) return;
      eclat(p, 1.2); bouffee(p.x, p.y, p.z, 'poudre', 0.9);
      const q = S.pt(1.6 + Math.random() * 0.2, (Math.random() - 0.5) * 1.2); setTimeout(() => bouffee(q.x, solEn(q.x, q.z) + 0.02, q.z, 'poussiere', 0.8), 420);
    });
    // camp : feu et fumée
    animFeu(S.flammeCamp, t); if ((S.campFumee -= dt) <= 0) { S.campFumee = 1.1; bouffee(S.feuCamp.x, S.feuCamp.y, S.feuCamp.z, 'blanche', 0.45); }
    // drapeau blanc : la place a faim, ou elle capitule ce mois-ci
    S.blanc.visible = S.faim || rendue;
    S.defenseurs.forEach(d => { d.visible = !rendue && !(S.assautT?.victoire && ua > DUREE_ASSAUT * 0.62); });
    // l'assaut : la course à la file par le chemin de l'assaut, le déploiement au pied de la brèche, l'escalade des gravats, l'entrée
    // (ou le repli par le même chemin si la place tient)
    const yb = S.info?.infoBreche ? S.info.infoBreche.y : S.H - 0.13, hB = yb + (S.H - yb) * (1 - 0.78 * br), k = 0.55; // k : l'assaut joué en moins de temps que dans la maquette
    const ch = S.chA, pied = S.pt(0.72, 0);
    S.assaut.forEach((s, i) => {
      s.visible = assaut; if (!s.visible) return;
      const v = (i - 3.5) * 0.07, d1 = S.pt(0.72, v * 0.5), d2 = S.pt(0.53, v * 0.3), d3 = S.pt(0.32, v * 0.8), w = ua / k - i * 0.22;
      const surCh = u => { const p = ch.sur(u * ch.L), e = u ** 4; return { x: p.x + (d1.x - pied.x) * e, z: p.z + (d1.z - pied.z) * e, ry: capVers(p.tx, p.tz) }; }; // en file, puis de front au pied du mur
      let x, z, y, ry = capVers(-S.ux, -S.uz); const f1 = lisse(0, 3.2, w), f2 = lisse(3.2, 5, w), f3 = lisse(5.2, 7, w);
      if (!S.assautT.victoire && w > 3.4) { const p = surCh(1 - lisse(4.2, 8, w)); x = p.x; z = p.z; y = solEn(x, z); ry = p.ry + Math.PI; s.visible = w < 8; }
      else if (w < 3.2) { const p = surCh(f1), n0 = ch.sur(0), a = (1 - lisse(0, 0.6, w)) * (i - 3.5) * 0.02; x = p.x + n0.nx * a; z = p.z + n0.nz * a; y = solEn(x, z); if (f1 < 0.9) ry = p.ry; } // ils attendent le long de la dernière parallèle
      else if (w < 5.2) { x = FL(d1.x, d2.x, f2); z = FL(d1.z, d2.z, f2); y = FL(solEn(d1.x, d1.z), hB, f2); }
      else { x = FL(d2.x, d3.x, f3); z = FL(d2.z, d3.z, f3); y = hB * (1 - f3) + solEn(x, z) * f3; }
      s.position.set(x, y + (w < 7 ? Math.abs(Math.sin(t * 10 + i)) * 0.006 : 0), z); s.rotation.y = ry;
      if (w > 0.5 && w < 3 && Math.random() < dt * 0.9) { const p = versMonde(s, 0.42, 2.8, 0.5); bouffee(p.x, p.y, p.z, 'poudre', 0.5); eclat(p); }
    });
    if (assaut) for (const d of S.defenseurs) if (d.visible && Math.random() < dt * 1.2) { const p = versMonde(d, 0.42, 2.8, 0.5); eclat(p); bouffee(p.x, p.y, p.z, 'poudre', 0.5); }
    S.drapBreche.visible = assaut && S.assautT.victoire && ua > 6.2 * k; if (S.drapBreche.visible) { const p = S.pt(0.54, 0); S.drapBreche.position.set(p.x, hB, p.z); }
    // le pillage d'un faubourg : sortie, fouille, retour chargés ; le faubourg flambe
    const pl = S.pillage, w = pl ? t - pl.debut : 99, brule = w > 0.6 && w < 5.6;
    S.feux.forEach(f => { f.visible = brule; if (brule) animFeu(f, t); });
    if (brule && Math.random() < dt * 9) { const f = S.feux[Math.random() * 3 | 0].position; bouffee(f.x, f.y + 0.12, f.z, 'noire', 1.1); }
    S.pillards.forEach(([v, b], i) => {
      const wi = w - i * 0.2, dehors = wi > 0 && wi < 5.9, retour = wi >= 3.9;
      v.visible = dehors && !retour; b.visible = dehors && retour; if (!dehors) return;
      const s = retour ? b : v, sd = wi < 2.2 ? lisse(0, 2.2, wi) : wi < 3.9 ? 1 : 1 - lisse(3.9, 5.9, wi), p = pl.ch.sur(sd * pl.ch.L);
      const lat = (i - 1.5) * 0.025; let x = p.x + p.nx * lat, z = p.z + p.nz * lat, ry = capVers(p.tx, p.tz) + (retour ? Math.PI : 0); // à la file, presque l'un derrière l'autre (le chemin passe entre les maisons)
      if (wi >= 2.2 && wi < 3.9) { const a = t * 1.3 + i * 1.6; x += Math.cos(a) * 0.05; z += Math.sin(a) * 0.05; ry = capVers(-Math.sin(a), Math.cos(a)); } // ils fouillent
      s.position.set(x, solEn(x, z) + Math.abs(Math.sin(t * 9 + i)) * 0.006, z); s.rotation.y = ry;
    });
    if (S.pillards[0][0].visible && Math.random() < dt * 1.6) { const d = S.defenseurs[Math.random() * S.defenseurs.length | 0]; if (d?.visible) { const p = versMonde(d, 0.42, 2.8, 0.5); eclat(p); bouffee(p.x, p.y, p.z, 'poudre', 0.5); } }
  }
  // éclairs
  const pa = ECLATS.geometry.attributes.position, ca = ECLATS.geometry.attributes.color; let n = 0;
  for (let i = eclats.length - 1; i >= 0; i--) { const e = eclats[i]; e.vie -= dt; if (e.vie <= 0) eclats.splice(i, 1); }
  for (const e of eclats) { const f = Math.min(1, e.vie / 0.1); pa.setXYZ(n, e.x, e.y, e.z); ca.setXYZ(n++, f, 0.82 * f, 0.38 * f); }
  ECLATS.geometry.setDrawRange(0, n); pa.needsUpdate = ca.needsUpdate = true;
  // les drapeaux des sièges et des forts
  for (const f of pavillons) { const p = f.geometry.attributes.position, wd = f.userData.w; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / wd; p.setZ(i, Math.sin(t * 6 - u * 5 + f.userData.ph) * u * 0.16 * wd); } p.needsUpdate = true; }
});
