// Les routes : tracées par le moteur entre les bâtiments et les villes, dessinées en rubans posés sur les cases
// (comme web_power), au tracé légèrement courbé. Leur couleur suit leur niveau : chemin de terre, route pavée,
// route royale bordée de petits arbres. Un petit pont enjambe les rivières.
import { THREE, scene, posCase, hache } from './scene.js';
import { carte, hauteur, ruban, TERRE } from './plateau.js';
import { lot, put, fige, jeter, boite, cyl, sphere } from './toon.js';

const groupe = new THREE.Group();
scene.add(groupe);
const COULEUR = { 1: 0xc9a874, 2: 0xb9b2a2, 3: 0x8a867e }, LARGE = { 1: 0.07, 2: 0.075, 3: 0.085 }, EP = 0.022;
let signature = '', niveauJoueur = 1, dernieres = [];

/** Le niveau des routes du joueur (etat.joueur.routes.niveau) : sert aux routes que le moteur envoie sans niveau. */
export function niveauRoutes(n) {
  if (!n || n === niveauJoueur) return;
  niveauJoueur = n;
  majRoutes(dernieres);
}

/** routes : [[case, case voisine, niveau?], …] */
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
  for (const [a, b, n] of routes) { const nv = n || niveauJoueur; lier(a, b, nv); lier(b, a, nv); }
  // le point de passage de chaque case, un peu décalé du centre : le tracé ondule d'une case à l'autre
  const P = i => { const q = posCase(i); return [q.x + (hache(q.c, q.r, 17) - 0.5) * 0.3, q.z + (hache(q.c, q.r, 19) - 0.5) * 0.3]; };
  const L = lot();
  for (const [i, ls] of liens) {
    const c = P(i), y0 = hauteur(i) + 0.012;
    const bords = ls.map(([v, n]) => { const q = P(v); return { M: [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2], y: Math.max(hauteur(i), hauteur(v)) + 0.012, n, v }; });
    // du bord vers le centre : la route monte (ou reste) à la hauteur de la case la plus haute sur le dernier tiers
    const haut = (b, u) => y0 + (b.y - y0) * Math.max(0, 1 - u / 0.4) + 0.001 * b.n;
    if (bords.length === 2) {
      // virage : une courbe du milieu d'un bord au milieu de l'autre, par le point de passage
      const [A, B] = bords, pts = [], n = Math.max(A.n, B.n);
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, u = 1 - t;
        pts.push([u * u * A.M[0] + 2 * u * t * c[0] + t * t * B.M[0], u * u * A.M[1] + 2 * u * t * c[1] + t * t * B.M[1], t < 0.5 ? haut(A, t * 2) : haut(B, (1 - t) * 2)]);
      }
      put(L, ruban(pts, LARGE[n] || 0.07), COULEUR[n] || COULEUR[1], 0, 0, 0, 0, 0);
    } else {
      for (const b of bords) {
        const pts = [];
        for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([b.M[0] + (c[0] - b.M[0]) * u, b.M[1] + (c[1] - b.M[1]) * u, haut(b, u)]); }
        put(L, ruban(pts, LARGE[b.n] || 0.07), COULEUR[b.n] || COULEUR[1], 0, 0, 0, 0, 0);
      }
    }
    if (!TERRE(C.terrain[i])) continue;
    const niv = Math.max(...bords.map(b => b.n)), d0 = bords[0].M, d1 = bords[1]?.M ?? c;
    if (C.riviere[i]) {
      // un pont : planches au niveau 1, pierre ensuite, avec ses parapets
      const dx = d1[0] - d0[0], dz = d1[1] - d0[1], l = Math.hypot(dx, dz) || 1, cap = -Math.atan2(dz, dx);
      put(L, boite(0.5, 0.03, 0.2), niv === 1 ? 0x8b5a2b : 0xb9b3a6, c[0], y0 + 0.02, c[1], cap, EP);
      for (const s of [-1, 1]) put(L, boite(0.5, 0.05, 0.025), niv === 1 ? 0x6b4423 : 0x8a8478, c[0] - dz / l * s * 0.1, y0 + 0.055, c[1] + dx / l * s * 0.1, cap, 0.008);
    }
    if (niv === 3) for (const b of bords) {
      // route royale : arbres d'alignement des deux côtés
      if (hache(i, b.v, 3) > 0.6) continue;
      const dx = b.M[0] - c[0], dz = b.M[1] - c[1], l = Math.hypot(dx, dz) || 1, y = hauteur(i);
      for (const s of [-1, 1]) {
        const x = c[0] + dx * 0.55 - dz / l * s * 0.2, z = c[1] + dz * 0.55 + dx / l * s * 0.2;
        put(L, cyl(0.018, 0.024, 0.12, 5), 0x6b4a2a, x, y + 0.06, z, 0, EP * 0.5);
        put(L, sphere(0.07, 0), 0x4c8f3a, x, y + 0.16, z, 0, EP);
      }
    }
  }
  fige(L, groupe);
}
function vider() { for (const o of [...groupe.children]) jeter(o); }
export function effacerRoutes() { signature = ''; dernieres = []; vider(); }
