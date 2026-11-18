"use strict";
// ============================================================ outils
const $ = s => document.querySelector(s);
const nf = (n, d = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const euros = n => (Math.abs(n) >= 1e6 ? nf(n / 1e6, 1) + ' M€' : nf(n / 1e3, 0) + ' k€');
const DOUX = matchMedia('(prefers-reduced-motion: reduce)').matches;
const portrait = () => document.documentElement.dataset.format === 'portrait';
const R = 10, SQ3 = Math.sqrt(3), COLS = 30, ROWS = 21; let GRAINE = 7;
function hache(x, y, s = GRAINE) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function bruit(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = (x - xi) ** 2 * (3 - 2 * (x - xi)), v = (y - yi) ** 2 * (3 - 2 * (y - yi));
  const a = hache(xi, yi), b = hache(xi + 1, yi), c = hache(xi, yi + 1), d = hache(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => .55 * bruit(x, y) + .3 * bruit(x * 2.1 + 9, y * 2.1) + .15 * bruit(x * 4.3, y * 4.3 + 5);
let g = 1;
function rnd() { g = (g + 0x6D2B79F5) | 0; let t = Math.imul(g ^ (g >>> 15), 1 | g); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const semer = t => { g = t.q * 7919 + t.r * 104729 + 13; };
const entre = (a, b) => a + rnd() * (b - a);
let gs = 99; const alea = () => ((gs = (gs * 16807) % 2147483647) / 2147483647);  // hasard de la simulation (événements, pannes)

// ============================================================ grille hexagonale (pointe en haut, coordonnées axiales)
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const cle = (q, r) => q + ',' + r;
let T = new Map(), LISTE = [], RIV = [], VILLES = [], SITES = [], FRONT_T = null, BARRAGE_T = null, CARTE = null;
const OX = R * SQ3 * ((COLS - 1) / 2 + .25), OZ = R * 1.5 * (ROWS - 1) / 2;
function nouvelleGrille() {
  T = new Map(); LISTE = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const r = row, q = col - (row - (row & 1)) / 2;
    const t = { q, r, col, row, k: cle(q, r), x: R * SQ3 * (q + r / 2) - OX, z: R * 1.5 * r - OZ, npyl: 0 };
    T.set(t.k, t); LISTE.push(t);
  }
}
const voisins = t => DIRS.map(([a, b]) => T.get(cle(t.q + a, t.r + b))).filter(Boolean);
const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
function versHex(x, z) {
  x += OX; z += OZ;
  const q = (SQ3 / 3 * x - z / 3) / R, r = (2 / 3 * z) / R, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return T.get(cle(rq, rr));
}
const coin = (t, i, k = 1) => { const a = Math.PI / 180 * (60 * i - 30); return [t.x + R * k * Math.cos(a), t.z + R * k * Math.sin(a)]; };
function bordCommun(t, n) {
  const mx = (t.x + n.x) / 2, mz = (t.z + n.z) / 2;
  return [0, 1, 2, 3, 4, 5].map(i => coin(t, i)).sort((a, b) => Math.hypot(a[0] - mx, a[1] - mz) - Math.hypot(b[0] - mx, b[1] - mz)).slice(0, 2);
}
const NOMS = ['les Landes', 'la Crête', 'Saint-Aubin', 'Bellerive', 'Port-Rivière', 'les Sablons', 'Grand-Lac', 'les Fontaines', 'le Moulin', 'Haut-Val', 'Roche-Noire', 'la Combe', 'la Garenne', 'les Essarts', 'Pré-Vert', 'Mont-Fleury', 'Val-d’Argent', 'la Ferté', 'les Brandes', 'Bois-Joli', 'Champ-Long', 'la Source', 'les Aulnes', 'Pierrefeu', 'Belvédère', 'les Granges', 'Côte-Rousse', 'Fontfroide', 'les Ormes', 'Clairval'];
const lieu = t => NOMS[Math.floor(hache(t.q, t.r, 31) * NOMS.length)];
