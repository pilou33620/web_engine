// Les routes : tracées par le moteur entre les bâtiments et les villes, dessinées en rubans posés sur les cases
// (comme web_power), au tracé légèrement courbé. Leur couleur suit leur niveau : chemin de terre, route pavée,
// route royale bordée de petits arbres. Un petit pont enjambe les rivières. Sous la pluie (boue.js) : la terre devient boue,
// le pavé fonce, des flaques grandissent puis sèchent.
// Usure : les tronçons les plus empruntés (le plus de trajets entre lieux bâtis passent par eux, ou le trafic que donne le jeu,
// 4e élément de chaque route, de 0 à 1) s'élargissent, et un chemin de terre très passant devient pavé.
import { THREE, scene, posCase, hache } from './scene.js';
import { carte, hauteur, ruban, TERRE, bordEntre, casesBaties } from './plateau.js';
import { lot, put, fige, jeter, boite, cyl, cone, sphere } from './toon.js';
import { MAT_TERRE, MAT_PAVE, flaques } from './boue.js';

const groupe = new THREE.Group();
scene.add(groupe);
// 1 chemin de terre, 2 pavée, 3 royale (Lumières), 4 impériale (Empire), 5 empierrée au macadam (révolution industrielle)
const COULEUR = { 1: 0xc9a874, 2: 0xb9b2a2, 3: 0x8a867e, 4: 0xd8cdb4, 5: 0x5f5d5a }, LARGE = { 1: 0.07, 2: 0.075, 3: 0.085, 4: 0.1, 5: 0.095 }, EP = 0.022;
let signature = '', niveauJoueur = 1, dernieres = [];

/** Le niveau des routes du joueur (etat.joueur.routes.niveau) : sert aux routes que le moteur envoie sans niveau. */
export function niveauRoutes(n) {
  if (!n || n === niveauJoueur) return;
  niveauJoueur = n;
  majRoutes(dernieres);
}

/** routes : [[case, case voisine, niveau?, trafic?], …] (trafic : 0 à 1, sinon estimé d'après le réseau) */
export function majRoutes(routes) {
  routes = routes || [];
  const C = carte();
  if (!C) return;
  // les hauteurs comptent : une case bâtie redescend à 0
  const sig = JSON.stringify(routes) + niveauJoueur + routes.map(r => hauteur(r[0]) + ',' + hauteur(r[1])).join();
  if (sig === signature) return;
  signature = sig; dernieres = routes;
  vider();
  if (!routes.length) return;
  const liens = new Map();
  const lier = (a, b, n) => { if (!liens.has(a)) liens.set(a, []); liens.get(a).push([b, n]); };
  const use = usure(routes);
  for (const [a, b, n] of routes) {
    const u = use.get(a < b ? a + ',' + b : b + ',' + a) || 0;
    let nv = n || niveauJoueur; if (nv === 1 && u > 0.6) nv = 2;  // un chemin de terre très passant est pavé
    lier(a, b, nv + u * 0.999); lier(b, a, nv + u * 0.999);       // la partie décimale : l'usure (largeur)
  }
  // le point de passage de chaque case, un peu décalé du centre : le tracé ondule d'une case à l'autre
  const P = i => { const q = posCase(i); return [q.x + (hache(q.c, q.r, 17) - 0.5) * 0.3, q.z + (hache(q.c, q.r, 19) - 0.5) * 0.3]; };
  const L = lot(), LT = lot(), LP = lot(), eau = [];
  // un tronçon de route : sur le matériau de son revêtement ; les chemins de terre gardent plus d'eau que le pavé
  const troncon = (pts, n) => {
    const u = n % 1; n = Math.floor(n);
    put(n > 1 ? LP : LT, ruban(pts, (LARGE[n] || 0.07) * (1 + u * 0.6)), COULEUR[n] || COULEUR[1], 0, 0, 0, 0, 0);
    pts.forEach(([x, z, y], k) => { if (k % (n > 1 ? 4 : 2) === 1) eau.push([x, y, z]); });
  };
  for (const [i, ls] of liens) {
    const c = P(i), y0 = hauteur(i) + 0.012;
    const bords = ls.map(([v, n]) => { const q = P(v); return { M: [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2], y: bordEntre(i, v) + 0.012, n, v }; });
    // du bord vers le centre : la route monte (ou reste) à la hauteur de la case la plus haute sur le dernier tiers ;
    // en haut d'une pente de colline (plateau.js, relief), elle descend sur le quart extérieur de la case, comme le sol
    const haut = (b, u) => y0 + (b.y - y0) * Math.max(0, 1 - u / (b.y < y0 ? 0.25 : 0.4)) + 0.001 * Math.floor(b.n);
    if (bords.length === 2) {
      // virage : une courbe du milieu d'un bord au milieu de l'autre, par le point de passage
      const [A, B] = bords, pts = [], n = Math.max(A.n, B.n);
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, u = 1 - t;
        pts.push([u * u * A.M[0] + 2 * u * t * c[0] + t * t * B.M[0], u * u * A.M[1] + 2 * u * t * c[1] + t * t * B.M[1], t < 0.5 ? haut(A, t * 2) : haut(B, (1 - t) * 2)]);
      }
      troncon(pts, n);
    } else {
      for (const b of bords) {
        const pts = [];
        for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([b.M[0] + (c[0] - b.M[0]) * u, b.M[1] + (c[1] - b.M[1]) * u, haut(b, u)]); }
        troncon(pts, b.n);
      }
    }
    if (!TERRE(C.terrain[i])) continue;
    const niv = Math.floor(Math.max(...bords.map(b => b.n))), d0 = bords[0].M, d1 = bords[1]?.M ?? c;
    if (C.riviere[i]) {
      // un pont : planches au niveau 1, pierre ensuite, avec ses parapets
      const dx = d1[0] - d0[0], dz = d1[1] - d0[1], l = Math.hypot(dx, dz) || 1, cap = -Math.atan2(dz, dx);
      put(L, boite(0.5, 0.03, 0.2), niv === 1 ? 0x8b5a2b : 0xb9b3a6, c[0], y0 + 0.02, c[1], cap, EP);
      for (const s of [-1, 1]) put(L, boite(0.5, 0.05, 0.025), niv === 1 ? 0x6b4423 : 0x8a8478, c[0] - dz / l * s * 0.1, y0 + 0.055, c[1] + dx / l * s * 0.1, cap, 0.008);
    }
    if (niv === 3 || niv === 4) for (const b of bords) {
      // routes royale et impériale : arbres d'alignement des deux côtés (l'impériale, plus serrés : des peupliers)
      if (hache(i, b.v, 3) > (niv === 4 ? 0.85 : 0.6)) continue;
      const dx = b.M[0] - c[0], dz = b.M[1] - c[1], l = Math.hypot(dx, dz) || 1, y = hauteur(i);
      for (const s of [-1, 1]) {
        const x = c[0] + dx * 0.55 - dz / l * s * 0.2, z = c[1] + dz * 0.55 + dx / l * s * 0.2;
        put(L, cyl(0.018, 0.024, 0.12, 5), 0x6b4a2a, x, y + 0.06, z, 0, EP * 0.5);
        if (niv === 4) put(L, cone(0.04, 0.2, 6), 0x3f7f34, x, y + 0.2, z, 0, EP); else put(L, sphere(0.07, 0), 0x4c8f3a, x, y + 0.16, z, 0, EP);
      }
    }
    if (niv === 5) for (const b of bords) {
      // route empierrée : bornes kilométriques blanches au bord
      if (hache(i, b.v, 4) > 0.5) continue;
      const dx = b.M[0] - c[0], dz = b.M[1] - c[1], l = Math.hypot(dx, dz) || 1, y = hauteur(i);
      put(L, boite(0.022, 0.035, 0.016), 0xf2efe6, c[0] + dx * 0.5 - dz / l * 0.07, y + 0.0175, c[1] + dz * 0.5 + dx / l * 0.07, 0, 0.004);
    }
  }
  fige(L, groupe); fige(LT, groupe, MAT_TERRE); fige(LP, groupe, MAT_PAVE);
  flaques(groupe, eau);
}
/** L'usure de chaque tronçon ('a,b', a < b), de 0 à 1 : le trafic donné par le jeu, sinon la part des plus courts trajets
 *  entre les lieux bâtis du réseau qui l'empruntent (rapportée au tronçon le plus passant). */
function usure(routes) {
  const use = new Map(), cle = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  if (routes.some(r => r[3] != null)) { for (const r of routes) use.set(cle(r[0], r[1]), Math.max(0, Math.min(1, r[3] || 0))); return use; }
  const adj = new Map(); for (const [a, b] of routes) for (const [x, y] of [[a, b], [b, a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); }
  const bati = casesBaties(), lieux = [...adj.keys()].filter(i => bati.has(i));
  if (lieux.length < 3) return use;
  // un parcours en largeur depuis chaque lieu ; chaque autre lieu remonte son chemin et compte ses tronçons
  for (const de of lieux.slice(0, 60)) {
    const prev = new Map([[de, -1]]), file = [de];
    for (let f = 0; f < file.length; f++) for (const n of adj.get(file[f])) if (!prev.has(n)) { prev.set(n, file[f]); file.push(n); }
    for (const vers of lieux) { if (vers === de) continue; for (let x = vers; prev.get(x) >= 0; x = prev.get(x)) { const k = cle(x, prev.get(x)); use.set(k, (use.get(k) || 0) + 1); } }
  }
  const max = Math.max(1, ...use.values());
  for (const [k, v] of use) use.set(k, v / max > 0.25 ? (v / max - 0.25) / 0.75 : 0);
  return use;
}
function vider() { for (const o of [...groupe.children]) jeter(o); }
export function effacerRoutes() { signature = ''; dernieres = []; vider(); }
