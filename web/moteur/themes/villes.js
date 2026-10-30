// Plans de villes vus du ciel, « mini réalistes », selon l'ère (epoque.js). Une ville est un tissu d'îlots délimités
// par des rues irrégulières : les rues sont les bords d'un diagramme de Voronoï semé sur une trame déformée (fine au
// cœur, lâche en périphérie) ; routes, rivières et remparts y tracent leurs lignes (graines en miroir de part et
// d'autre, d'où des faubourgs qui s'étirent le long des routes). Chaque îlot se remplit à la demande selon son quartier :
// maisons mitoyennes sur le pourtour et cours, pavillons et jardins, barres, usines, tours… Les Gaulois ont leurs huttes
// et leurs enclos. Tout est en km, déterministe ; rien sur l'eau.

const TAU = Math.PI * 2, CASE = 0.2, HG = 0.08, DETAIL = 128;  // index des îlots, des graines (km) ; px/km des maisons
const SOLEIL = [-0.6, -0.8], OMBRE = [0.6, 0.8];  // lumière du nord-ouest, ombres vers le sud-est

// ---------- hasard et bruit (autonomes : ce fichier se vérifie avec node)
export const hash = (i, j, k = 0) => {
  let n = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const TABLE = Float32Array.from({ length: 65536 }, (_, i) => hash(i, 7, 3));
function bruit(x, y, f, d = 0) {
  x = x / f + d;
  y = y / f + d * 1.7;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = (ii, jj) => TABLE[((jj & 255) << 8) | (ii & 255)];
  const h = a(i, j) + (a(i + 1, j) - a(i, j)) * sx, b = a(i, j + 1) + (a(i + 1, j + 1) - a(i, j + 1)) * sx;
  return h + (b - h) * sy;
}
function alea(s) {
  let a = (s * 4294967296) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- couleurs : toits à deux versants (clair au soleil, sombre à l'ombre, faîtage), comme web_conquete
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const melange = (a, b, k) => { const p = rgb(a), q = rgb(b); return "#" + p.map((v, i) => Math.round(v + (q[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
const PAL = {
  tuile: ["#c8664a", "#94432f", "#6e3024"], canal: ["#d9906a", "#ad6142", "#874a31"], romaine: ["#d8835a", "#a8583a", "#7a3c28"],
  ardoise: ["#8f9eaf", "#5d6b7c", "#46525f"], zinc: ["#bfc6c9", "#8e979b", "#6d767b"], chaume: ["#d0b46e", "#9c8446", "#7a6634"],
  meca: ["#c25e40", "#8a3d2b", "#5e2a20"], beton: ["#d8d5ce", "#aaa79f", "#8a877f"],
  vert: ["#8dbb62", "#5f8c42", "#4a6e34"], solaire: ["#46658a", "#24384f", "#16243a"],
};
const TEINTES = {};  // « tuile1 » → 9 nuances du versant à l'ombre au versant au soleil, et le faîtage
for (const [nom, p] of Object.entries(PAL)) {
  for (let v = 0; v < 3; v++) {
    const q = p.map((c) => (v ? melange(c, v === 1 ? "#ffffff" : "#000000", 0.08) : c));
    TEINTES[nom + v] = { pans: Array.from({ length: 9 }, (_, k) => melange(q[1], q[0], k / 8)), faite: q[2] };
  }
}
const pal = (nom, r) => nom + ((r() * 3) | 0);
const BOIS = ["#2f5e2c", "#3a6c34", "#45793c", "#2b5427", "#518644"];

// ---------- taille : densité (hab./km²) selon l'ère, plus forte dans les grandes villes
const DENSITE = { celte: 5000, romaine: 11000, classique: 16000, industrielle: 13000, moderne: 4000, futur: 7000 };
export const rayon = (pop, ere) =>
  Math.max(0.05, Math.sqrt(pop / (DENSITE[ere] * Math.min(2.5, Math.max(0.35, (pop / 30000) ** 0.25)) * Math.PI)));
const RUE = { celte: "#b9a67a", romaine: "#d2c6a6", classique: "#c9b58e", industrielle: "#b6aa90", moderne: "#8e8f8c", futur: "#a5aaa4" };

// ---------- géométrie (polygones = listes de [x, y])
const aire = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const centre = (P) => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distSeg = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const ex = x - a[0] - t * dx, ey = y - a[1] - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
};
function dansPoly(P, x, y) {
  let d = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
// Garde la partie du polygone où nx·x + ny·y ≤ c ; T étiquette les côtés (le côté créé prend `tag`)
function couper(P, T, nx, ny, c, tag) {
  const Q = [], U = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) Q.push(a), U.push(T[i]);
    if (da <= 0 !== db <= 0) {
      const k = da / (da - db);
      Q.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      U.push(da <= 0 ? tag : T[i]);
    }
  }
  return [Q, U];
}
// Normales intérieures des côtés d'un polygone convexe
const normales = (P) => {
  const s = Math.sign(aire(P));
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(-(b[1] - a[1]) / l) * s, ((b[0] - a[0]) / l) * s];
  });
};
// Rentre chaque côté i d'un polygone convexe de d(i) ; les étiquettes suivent ; null s'il ne reste rien
function rentrer(P, T, d) {
  const N = normales(P);
  let Q = P, U = T;
  for (let i = 0; i < P.length && Q.length > 2; i++) {
    const [nx, ny] = N[i], a = P[i];
    [Q, U] = couper(Q, U, -nx, -ny, -(nx * a[0] + ny * a[1]) - d(i), T[i]);
  }
  return Q.length > 2 ? [Q, U] : null;
}
const interieur = (P, d) => rentrer(P, P.map(() => 0), () => d)?.[0] ?? null;
// Rayon intérieur approché : distance du centre au côté le plus proche
const rin = (P) => { const [x, y] = centre(P); return Math.min(...P.map((a, i) => distSeg(x, y, a, P[(i + 1) % P.length]))); };
// Repère d'un polygone : axe du plus long côté, centre et demi-étendues le long de u et de n
function cadre(P) {
  let u = [1, 0], lm = 0;
  P.forEach((a, i) => { const b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > lm) { lm = l; u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; } });
  const n = [-u[1], u[0]], pu = P.map((p) => p[0] * u[0] + p[1] * u[1]), pn = P.map((p) => p[0] * n[0] + p[1] * n[1]);
  const mu = (Math.min(...pu) + Math.max(...pu)) / 2, mn = (Math.min(...pn) + Math.max(...pn)) / 2;
  return { u, n, c: [u[0] * mu + n[0] * mn, u[1] * mu + n[1] * mn], a: (Math.max(...pu) - Math.min(...pu)) / 2, b: (Math.max(...pn) - Math.min(...pn)) / 2 };
}
// Rectangle de centre c, demi-côtés a (le long de u) et b
const rect = (c, u, a, b) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [c[0] + u[0] * a * i - u[1] * b * j, c[1] + u[1] * a * i + u[0] * b * j]);
const ovale = (c, u, a, b, n = 24) => Array.from({ length: n }, (_, k) => { const t = (k / n) * TAU, x = Math.cos(t) * a, y = Math.sin(t) * b; return [c[0] + u[0] * x - u[1] * y, c[1] + u[1] * x + u[0] * y]; });
// Une ligne (route, rivière, enceinte) : écart d'un point au bord de sa chaussée ou de son eau
function ecart(l, x, y) {
  if (!l.boite) { const xs = l.pts.map((p) => p[0]), ys = l.pts.map((p) => p[1]), w = l.ws ? Math.max(...l.ws) : l.demi; l.boite = [Math.min(...xs) - w, Math.min(...ys) - w, Math.max(...xs) + w, Math.max(...ys) + w]; }
  const b = l.boite, hors = Math.max(b[0] - x, x - b[2], b[1] - y, y - b[3]);
  if (hors > 0.5) return hors;  // loin de la ligne : une borne inférieure suffit
  let m = Infinity;
  for (let k = 1; k < l.pts.length; k++) m = Math.min(m, distSeg(x, y, l.pts[k - 1], l.pts[k]) - (l.ws ? Math.max(l.ws[k - 1], l.ws[k]) : l.demi));
  return m;
}
function demiEn(l, x, y) {
  if (!l.ws) return l.demi;
  let m = Infinity, w = 0;
  for (let k = 1; k < l.pts.length; k++) { const d = distSeg(x, y, l.pts[k - 1], l.pts[k]); if (d < m) { m = d; w = (l.ws[k - 1] + l.ws[k]) / 2; } }
  return w;
}

// ---------- génération
export function genererPlan(v, eau, urbain = () => false) {
  const P = { v, ere: v.ere, eau, ilots: [], cases: new Map(), mur: null, rempart: null, rue: RUE[v.ere], axes: [] };
  (v.ere === "celte" ? celte : tissu)(P, v, eau, urbain);
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const il of P.ilots) {
    const xs = il.bloc.map((p) => p[0]), ys = il.bloc.map((p) => p[1]);
    il.boite = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (il.pts) for (const p of il.pts) { il.boite[0] = Math.min(il.boite[0], p[0]); il.boite[1] = Math.min(il.boite[1], p[1]); il.boite[2] = Math.max(il.boite[2], p[0]); il.boite[3] = Math.max(il.boite[3], p[1]); }
    for (let i = Math.floor(il.boite[0] / CASE); i <= Math.floor(il.boite[2] / CASE); i++) {
      for (let j = Math.floor(il.boite[1] / CASE); j <= Math.floor(il.boite[3] / CASE); j++) (P.cases.get(i * 100003 + j) ?? P.cases.set(i * 100003 + j, []).get(i * 100003 + j)).push(il);
    }
    b[0] = Math.min(b[0], il.boite[0]); b[1] = Math.min(b[1], il.boite[1]); b[2] = Math.max(b[2], il.boite[2]); b[3] = Math.max(b[3], il.boite[3]);
  }
  P.boite = b;
  return P;
}

// Tronque une polyligne partie du centre à la distance B
function tronquer(pts, cx, cy, B) {
  const out = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const d = Math.hypot(pts[k][0] - cx, pts[k][1] - cy);
    if (d > B) { const a = pts[k - 1], da = Math.hypot(a[0] - cx, a[1] - cy); out.push(lerp(a, pts[k], Math.max(0, Math.min(1, (B - da) / (d - da || 1))))); break; }
    out.push(pts[k]);
  }
  return out;
}

// Quartiers : demi-largeur de rue (km), sol, teinte du bâti vu de loin, profondeur des maisons
const QUARTIERS = {
  vieux: [0.0032, "#cdbd99", "#b0654a", 0.016], faubourg: [0.0025, "#87a35b", null, 0], maraichers: [0.002, "#86a159", null, 0],
  place: [0.0035, "#ddd0ae", null, 0], eglise: [0.0032, "#d6c8a6", "#7d8794", 0.014], jardin: [0.004, "#78a453", null, 0],
  insula: [0.003, "#dccdaa", "#bd6e4c", 0.013], horti: [0.0025, "#88a65c", null, 0], forum: [0.0045, "#e5d9bb", "#c07a55", 0.006], thermes: [0.004, "#dccfae", "#b97250", 0.01],
  ouvrier: [0.004, "#7f9d55", "#a85940", 0.011], immeubles: [0.006, "#c9bfa8", "#8b8f93", 0.018], usine: [0.006, "#a39a86", "#85827c", 0.03], gare: [0.006, "#b2a78f", "#9aaab3", 0.03],
  pavillons: [0.0045, "#88ac5e", null, 0], grandEnsemble: [0.007, "#80a65b", null, 0], zone: [0.008, "#a2a3a1", "#d6d6d2", 0.03], parc: [0.004, "#6f9f4f", null, 0],
  tours: [0.008, "#d2d6d0", "#8299ab", 0.02], dense: [0.006, "#80ae5e", "#9fb08f", 0.016], eco: [0.004, "#86b15e", null, 0],
  enclos: [0, "#b7a578", null, 0], sanctuaire: [0, "#c8b689", null, 0], villa: [0, "#8aa85c", null, 0], amphi: [0, "#cdb68b", null, 0],
};

function tissu(P, v, eau, urbain) {
  const { ere, r: R, graine: g, x: cx, y: cy } = v, romaine = ere === "romaine";
  const Rh = Math.min(v.rh ?? R, R), Ri = Math.min(Math.max(v.ri ?? R, Rh), R), B = 1.75 * R + 0.15;
  const D = (x, y) => Math.hypot(x - cx, y - cy);
  // lignes qui découpent le tissu : routes, rivières, enceinte (ou boulevards à sa place)
  const axes = (v.axes ?? []).map((a) => ({ pts: tronquer(a.pts, cx, cy, B), demi: a.grand ? 0.0075 : 0.0055, kind: "axe" })).filter((a) => a.pts.length > 1);
  P.axes = axes;
  const lignes = [...axes, ...(v.rivieres ?? []).map((r) => ({ pts: r.pts, ws: r.ws.map((w) => w + 0.012), kind: "riviere" }))];
  const dirAxe = axes[0] ? Math.atan2(axes[0].pts[1][1] - cy, axes[0].pts[1][0] - cx) : hash(g, 1) * TAU;
  const co = Math.cos(dirAxe), si = Math.sin(dirAxe);
  const forme = (x, y) => 0.82 + 0.5 * (bruit(x, y, Math.max(0.3, R * 0.8), g % 251) - 0.5) + 0.3 * (bruit(x, y, Math.max(0.12, R * 0.3), (g % 241) + 50) - 0.5);
  const base = romaine
    ? (x, y) => { const u = (x - cx) * co + (y - cy) * si, w = -(x - cx) * si + (y - cy) * co; return 1 - Math.max(Math.abs(u), Math.abs(w) * 1.2) / (R * 0.9 * (0.9 + 0.2 * bruit(x, y, 0.4, g % 97))); }
    : (x, y) => {
      const d = D(x, y), b = 1 - d / (R * forme(x, y));
      return (ere === "moderne" || ere === "futur") && b <= 0 && d < 1.6 * R && urbain(x, y) ? 0.15 * (1 - d / (1.6 * R)) : b;
    };
  const fa = (x, y) => { let m = 0; for (const a of axes) m = Math.max(m, 1 - ecart(a, x, y) / 0.1); return m * (1 - D(x, y) / B); };
  if (v.murs && !romaine) {  // enceinte : courtines droites entre des angles irréguliers
    const n = Math.min(16, 7 + Math.round(Rh * 5)), pts = [];
    for (let k = 0; k < n; k++) {
      const a = dirAxe + ((k + 0.5 + (hash(k, g, 8) - 0.5) * 0.6) / n) * TAU, r = Rh * (0.7 + 0.22 * hash(k, g, 9));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    pts.push(pts[0]);
    const kind = ere === "classique" ? "mur" : "boulevard";
    P.mur = { pts, kind };
    lignes.push({ pts, demi: kind === "mur" ? 0.011 : 0.015, kind });
  }
  const s0 = romaine ? 0.075 : 0.05;
  const lim = R * (ere === "moderne" || ere === "futur" ? 1.6 : 1.3) + 0.1;
  const esp = (d, fin = false) => {
    if (!fin && d > lim) return 0.25;  // hors de la ville : graines lâches, qui ne servent que de voisines
    if (romaine) return 0.075;
    if (d < Rh || ere === "classique") return Math.min(0.09, 0.05 + (0.035 * d) / Math.max(Rh, 0.1));
    if (ere === "industrielle") return 0.08;
    if (ere === "moderne") return d < Ri ? 0.085 : 0.13;
    return d < 0.5 * R ? 0.1 : 0.12;
  };
  const deform = (d) => (romaine ? 0 : d < Rh || ere === "classique" ? 0.45 : ere === "moderne" && d > Ri ? 0.35 : 0.12);

  // graines : trame (quadtree dans le repère de l'axe principal, îlots allongés), déformée, plus fine au cœur
  const asp = romaine ? 1 : 1.4, seeds = [];
  const versMonde = (u, w) => [cx + u * asp * co - w * si, cy + u * asp * si + w * co];
  const racine = s0 * 2 ** Math.ceil(Math.log2(0.3 / s0));
  const semer = (u, w, t) => {
    const [x, y] = versMonde(u + t / 2, w + t / 2), d = D(x, y), s = esp(d);
    if (t > 1.3 * s && t > 0.03) { const h = t / 2; semer(u, w, h); semer(u + h, w, h); semer(u, w + h, h); semer(u + h, w + h, h); return; }
    const i = Math.round(u / 0.005), j = Math.round(w / 0.005), jit = romaine ? 0 : d < Rh || ere === "classique" ? 0.22 : 0.08;
    let [px, py] = versMonde(u + t * (0.5 + (hash(i, j, g) - 0.5) * jit), w + t * (0.5 + (hash(j, i, g + 1) - 0.5) * jit));
    const A = deform(d) * s;
    if (A) {
      const dx = (bruit(px, py, 0.45, 3) - 0.5) * 2 + 0.35 * (bruit(px, py, 0.17, 5) - 0.5) * 2;
      const dy = (bruit(px, py, 0.45, 6) - 0.5) * 2 + 0.35 * (bruit(px, py, 0.17, 8) - 0.5) * 2;
      px += A * dx; py += A * dy;
    }
    seeds.push({ x: px, y: py, s: Math.min(t, 1.3 * s) });
  };
  const nu = Math.ceil(B / asp / racine), nw = Math.ceil(B / racine);
  for (let a = -nu; a < nu; a++) for (let b = -nw; b < nw; b++) semer(a * racine, b * racine, racine);
  // pas de trame sur l'eau ni sur les lignes ; dans la ville romaine, le damier ignore les routes
  const actives = (l, x, y) => !(romaine && l.kind === "axe" && base(x, y) > 0);
  const trame = seeds.filter((sd) => !eau(sd.x, sd.y) && !lignes.some((l) => actives(l, sd.x, sd.y) && ecart(l, sd.x, sd.y) < 1.3 * sd.s));
  seeds.length = 0;
  seeds.push(...trame);
  // graines en miroir de part et d'autre de chaque ligne : la ligne devient une rue (ou un quai, un rempart)
  lignes.forEach((l, li) => {
    let reste = 0;
    for (let k = 1; k < l.pts.length; k++) {
      const a = l.pts[k - 1], b = l.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      let t = reste;
      for (; t < L;) {
        const x = a[0] + ux * t, y = a[1] + uy * t, d = D(x, y), s = esp(d, true), demi = l.ws ? l.ws[k - 1] + ((l.ws[k] - l.ws[k - 1]) * t) / L : l.demi;
        if (actives(l, x, y) && d > 0.9 * s0) {
          const o = demi + 0.5 * s, i0 = seeds.length;
          for (const c of [1, -1]) {
            const sx = x - uy * o * c, sy = y + ux * o * c;
            if (!eau(sx, sy) && !lignes.some((m, mi) => mi !== li && ecart(m, sx, sy) < 0.6 * s)) seeds.push({ x: sx, y: sy, s, ligne: li });
          }
          if (seeds.length === i0 + 2) { seeds[i0].pair = i0 + 1; seeds[i0 + 1].pair = i0; }
        }
        t += s * asp * 0.95;
      }
      reste = t - L;
    }
  });
  // qui fait partie de la ville : le cœur (forme irrégulière), les faubourgs le long des routes
  for (const [k, sd] of seeds.entries()) {
    sd.b = base(sd.x, sd.y);
    const f = sd.ligne !== undefined && lignes[sd.ligne].kind === "axe" ? fa(sd.x, sd.y) : 0;
    sd.garde = sd.b > 0 || (f > 0.12 && hash(k, g, 4) < 0.85);
  }
  const grille = new Map();
  P.nbGraines = seeds.length;
  seeds.forEach((sd, k) => { const q = Math.floor(sd.x / HG) * 100003 + Math.floor(sd.y / HG); (grille.get(q) ?? grille.set(q, []).get(q)).push(k); });
  const voisins = (x, y, r) => {
    const out = [];
    for (let i = Math.floor((x - r) / HG); i <= Math.floor((x + r) / HG); i++) {
      for (let j = Math.floor((y - r) / HG); j <= Math.floor((y + r) / HG); j++) for (const k of grille.get(i * 100003 + j) ?? []) { const q = seeds[k]; if ((q.x - x) ** 2 + (q.y - y) ** 2 < r * r) out.push(k); }
    }
    return out;
  };
  // cellules de Voronoï des graines gardées ; chaque côté retient la graine voisine
  const cellules = [];
  seeds.forEach((sd, k) => {
    if (!sd.garde) return;
    const h = (sd.ligne === undefined ? 1.5 : 1.1) * sd.s * asp;
    let Q, U, r0 = 2.4 * sd.s * asp;
    for (let essai = 0; essai < 2; essai++) {
      Q = [[sd.x - h, sd.y - h], [sd.x + h, sd.y - h], [sd.x + h, sd.y + h], [sd.x - h, sd.y + h]];
      U = [-1, -1, -1, -1];
      const vs = [];
      for (const j of voisins(sd.x, sd.y, r0)) if (j !== k) vs.push([(seeds[j].x - sd.x) ** 2 + (seeds[j].y - sd.y) ** 2, j]);
      vs.sort((a, b) => a[0] - b[0]);
      let rho2 = 2 * h * h;
      for (const [d2, j] of vs) {
        if (d2 > 4 * rho2) break;  // trop loin pour couper la cellule
        const q = seeds[j], nx = q.x - sd.x, ny = q.y - sd.y;
        [Q, U] = couper(Q, U, nx, ny, (nx * (sd.x + q.x)) / 2 + (ny * (sd.y + q.y)) / 2, j);
        if (Q.length < 3) return;
        rho2 = 0;
        for (const p of Q) rho2 = Math.max(rho2, (p[0] - sd.x) ** 2 + (p[1] - sd.y) ** 2);
      }
      if (4 * rho2 <= r0 * r0) break;
      r0 = 2 * Math.sqrt(rho2) + 0.01;  // des voisines plus lointaines peuvent encore couper
    }
    const c = centre(Q), ce = { pts: Q, tags: U, k, c };
    sd.cellule = ce;
    cellules.push(ce);
  });
  // quartier de chaque îlot selon l'ère
  const dedans = (x, y) => (P.mur ? dansPoly(P.mur.pts, x, y) : D(x, y) < Rh * 0.8);
  for (const ce of cellules) {
    const [x, y] = ce.c, d = D(x, y), sd = seeds[ce.k], b = sd.b, n = hash(ce.k, g, 11), f = fa(x, y);
    let t;
    if (romaine) t = b > 0.1 ? "insula" : "horti";
    else if (ere === "classique") t = (P.mur ? dedans(x, y) : b > 0.3) ? "vieux" : b > 0.1 || f > 0.3 ? "faubourg" : "maraichers";
    else if (ere !== "futur" && (dedans(x, y) || d < Rh * 0.85)) t = "vieux";
    else if (ere === "industrielle") t = b < 0.08 ? (f > 0.3 ? "faubourg" : "maraichers") : n < 0.1 ? "usine" : d < Rh * 1.3 && n < 0.5 ? "immeubles" : "ouvrier";
    else if (ere === "moderne") {
      if (d < Ri) t = n < 0.08 ? "usine" : n < 0.45 ? "immeubles" : "ouvrier";
      else if (f > 0.25 && n < 0.35) t = "zone";
      else if (bruit(x, y, 0.6, (g % 89) + 9) > 0.66 && v.pop > 15000) t = "grandEnsemble";
      else t = n > 0.95 ? "parc" : "pavillons";
    } else {  // futur : cœur ancien, tours, quartiers denses et verts, coulées vertes
      if (d < Rh * 0.6) t = "vieux";
      else if (Math.abs(bruit(x, y, 1.1, (g % 83) + 4) - 0.5) < 0.04 || n > 0.93) t = "parc";
      else if (d < 0.5 * R) t = n < 0.55 ? "tours" : "dense";
      else t = d < 0.8 * R ? "dense" : "eco";
    }
    ce.type = t;
  }
  // rues : chaque côté rentre de la demi-largeur de sa rue (ou de la route, du quai, du rempart)
  const ilots = [];
  for (const ce of cellules) {
    const sd = seeds[ce.k];
    const kinds = ce.tags.map((j) => (j >= 0 && sd.pair === j ? lignes[sd.ligne].kind : j < 0 || !seeds[j].cellule ? "bord" : "rue"));
    const r = rentrer(ce.pts, kinds, (i) => {
      const kd = kinds[i], a = ce.pts[i], b = ce.pts[(i + 1) % ce.pts.length];
      if (kd === "bord") return 0;
      if (kd === "rue") return Math.max(QUARTIERS[ce.type][0], QUARTIERS[seeds[ce.tags[i]].cellule.type][0]);
      return demiEn(lignes[sd.ligne], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    });
    if (!r || Math.abs(aire(r[0])) < 0.00015) continue;
    const [bloc, bk] = r, mouille = bloc.filter((p) => eau(p[0], p[1])).length;
    if (mouille >= 2 || eau(...centre(bloc))) continue;
    ilots.push({ pts: ce.pts, bloc, kinds: bk, type: ce.type, c: centre(bloc), graine: hash(ce.k, g, 77) });
  }
  // lieux : place et église (forum), églises du vieux centre, jardin public, gare
  const pres = (p, f = () => true) => { let m = Infinity, r = null; for (const il of ilots) { const d = (il.c[0] - p[0]) ** 2 + (il.c[1] - p[1]) ** 2; if (d < m && f(il)) { m = d; r = il; } } return r; };
  const place = pres([cx, cy]);
  if (place) place.type = romaine ? "forum" : "place";
  if (romaine) {
    const th = v.pop > 4000 && pres([cx + co * R * 0.4, cy + si * R * 0.4], (il) => il.type === "insula");
    if (th) th.type = "thermes";
  } else {
    const choix = [];
    for (const il of ilots.filter((il) => il.type === "vieux" && Math.abs(aire(il.bloc)) > 0.0022).sort((a, b) => a.graine - b.graine)) {
      if (choix.length >= Math.min(12, Math.floor((Rh / 0.33) ** 2))) break;
      if ([[cx, cy], ...choix.map((c) => c.c)].every((p) => Math.hypot(p[0] - il.c[0], p[1] - il.c[1]) > 0.25)) choix.push(il);
    }
    for (const il of choix) il.type = "eglise";
    const jard = Rh > 0.6 && ilots.filter((il) => il.type === "vieux" && D(...il.c) > Rh * 0.4).sort((a, b) => Math.abs(aire(b.bloc)) - Math.abs(aire(a.bloc)))[0];
    if (jard) jard.type = "jardin";
    if (ere !== "classique" && Rh > 0.2) {
      const a = axes[1] ?? axes[0], dir = a ? Math.atan2(a.pts[1][1] - cy, a.pts[1][0] - cx) + 0.5 : dirAxe + 2;
      const gare = pres([cx + Math.cos(dir) * Rh * 1.15, cy + Math.sin(dir) * Rh * 1.15], (il) => il.type !== "vieux" && il.type !== "place" && il.type !== "eglise");
      if (gare) gare.type = "gare";
    }
  }
  for (const il of ilots) il.kinds = il.kinds.map((k) => k ?? "bord");
  P.ilots.push(...ilots);
  // campagne romaine : amphithéâtre aux portes, villae dans les champs
  if (romaine) {
    const pose = (d, a, f) => { const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (!eau(x, y) && !axes.some((l) => ecart(l, x, y) < 0.08)) f(x, y, a); };
    if (v.pop > 5000) pose(R * 1.05 + 0.08, dirAxe + Math.PI / 2 + 0.6, (x, y, a) => P.ilots.push({ type: "amphi", bloc: ovale([x, y], [Math.cos(a), Math.sin(a)], 0.055, 0.044), c: [x, y], graine: hash(g, 5) }));
    for (let k = 0; k < Math.min(10, 1 + v.pop / 2500); k++) {
      pose(R * (1.5 + 2 * hash(k, g, 21)) + 0.3, hash(k, g, 22) * TAU, (x, y, a) => {
        if (base(x, y) > 0) return;
        P.ilots.push({ type: "villa", bloc: rect([x, y], [Math.cos(a), Math.sin(a)], 0.05, 0.04), c: [x, y], graine: hash(k, g, 23), u: [Math.cos(a), Math.sin(a)] });
      });
    }
  }
}

// Gaulois : enclos palissadés semés irrégulièrement, huttes rondes, sanctuaire au centre, rempart de terre des oppida
function celte(P, v, eau) {
  const R = v.r, g = v.graine, cx = v.x, cy = v.y, pas = 0.05;
  const forme = (x, y) => 0.8 + 0.6 * (bruit(x, y, Math.max(0.2, R * 0.7), g % 251) - 0.5);
  const base = (x, y) => 1 - Math.hypot(x - cx, y - cy) / (R * forme(x, y));
  const axes = (v.axes ?? []).map((a) => ({ pts: tronquer(a.pts, cx, cy, 1.5 * R + 0.1), demi: 0.004 }));
  P.axes = axes;
  const enclos = (x, y, re, gr, type = "enclos") => {
    const bloc = Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * TAU + hash(k, gr * 1e6, 1) * 0.5, r = re * (0.75 + 0.4 * hash(k, gr * 1e6, 2)); return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
    if (bloc.some((p) => eau(p[0], p[1])) || axes.some((l) => bloc.some((p) => ecart(l, p[0], p[1]) < 0.002))) return false;
    P.ilots.push({ type, bloc, c: [x, y], graine: gr });
    return true;
  };
  enclos(cx + 0.012, cy - 0.01, 0.026, hash(g, 1), "sanctuaire");
  const n = Math.ceil((R * 1.3) / pas);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = cx + (i + (hash(i, j, g) - 0.5) * 0.7) * pas, y = cy + (j + (hash(j, i, g + 1) - 0.5) * 0.7) * pas, b = base(x, y);
      if (b <= 0 || hash(i, j, g + 2) > 0.5 + 0.7 * b || Math.hypot(x - cx, y - cy) < 0.045 || eau(x, y)) continue;
      enclos(x, y, 0.012 + 0.012 * hash(i, j, g + 3), hash(i, j, g + 4));
    }
  }
  if (P.ilots.length < 3) enclos(cx - 0.04, cy + 0.03, 0.018, hash(g, 2));
  if (v.pop > 1200) {  // oppidum : levée de terre qui suit le relief (pas un cercle)
    const nb = 13, pts = [];
    for (let k = 0; k < nb; k++) {
      const a = ((k + (hash(k, g, 6) - 0.5) * 0.5) / nb) * TAU, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const r = R * forme(x, y) * (1.02 + 0.12 * hash(k, g, 7)) + 0.03;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    pts.push(pts[0]);
    P.rempart = pts;
  }
}

// ---------- remplissage d'un îlot (à la demande) : primitives à dessiner
//   ["s", couleur, poly] sol · ["L", couleur, largeur, segments] marques au sol · ["t", palette, f0, f1, b1, b0, h] toit à deux
//   versants (faîtage parallèle à f0-f1) · ["p", couleur, poly, h, déco] toit plat · ["l", couleur, largeur, pts, fermé]
//   ["c", x, y, r, h] cheminée · ["a", x, y, r, couleur] arbre · ["h", x, y, r] hutte
const TOUT = ["rue", "axe", "eau", "mur", "boulevard", "riviere", "bord"];
const RUES = ["rue", "axe", "riviere", "boulevard"];

function arbres(o, poly, r, n, rmin = 0.0035, rmax = 0.006) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  for (let k = 0, m = 0; k < n * 4 && m < n; k++) {
    const x = x0 + r() * w, y = y0 + r() * h;
    if (dansPoly(poly, x, y)) { o.push(["a", x, y, rmin + r() * (rmax - rmin), BOIS[(r() * BOIS.length) | 0]]); m++; }
  }
}
function potager(o, c, u, a, b, r) {
  const R = rect(c, u, a, b), segs = [];
  o.push(["s", r() < 0.5 ? "#8c7449" : "#7d6a42", R]);
  for (let t = -b + 0.0018; t < b; t += 0.0028) { const p = [c[0] - u[1] * t, c[1] + u[0] * t]; segs.push(p[0] - u[0] * a * 0.92, p[1] - u[1] * a * 0.92, p[0] + u[0] * a * 0.92, p[1] + u[1] * a * 0.92); }
  o.push(["L", r() < 0.5 ? "#5f8a3c" : "#78a34c", 0.0011, segs]);
}

// Maisons mitoyennes sur le pourtour : parcelles le long des côtés choisis, coins en onglet ; rend la cour intérieure
function perimetre(x, q) {
  const { il, r, P } = x, B = il.bloc, n = B.length, N = normales(B);
  const ri = rin(B), D = Math.min(q.D, ri * 0.92);
  const M = B.map((p, i) => {
    const a = N[(i + n - 1) % n], b = N[i], l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1, bx = (a[0] + b[0]) / l, by = (a[1] + b[1]) / l;
    const k = Math.min(2.5 * D, D / Math.max(0.3, bx * b[0] + by * b[1]));
    return [p[0] + bx * k, p[1] + by * k];
  });
  for (let i = 0; i < n; i++) {
    if (!q.cotes.includes(il.kinds[i])) continue;
    const A = B[i], Bb = B[(i + 1) % n], mA = M[i], mB = M[(i + 1) % n], L = Math.hypot(Bb[0] - A[0], Bb[1] - A[1]);
    for (let t = 0; t < L - 1e-4;) {
      let w = q.w[0] + r() * (q.w[1] - q.w[0]);
      if (L - t - w < q.w[0] * 0.7) w = L - t;
      const t0 = t / L, t1 = (t + w) / L;
      t += w;
      if (r() < q.vide) continue;
      const k = q.prof[0] + r() * (q.prof[1] - q.prof[0]), f0 = lerp(A, Bb, t0), f1 = lerp(A, Bb, t1), b0 = lerp(f0, lerp(mA, mB, t0), k), b1 = lerp(f1, lerp(mA, mB, t1), k);
      const m = [(f0[0] + f1[0] + b0[0] + b1[0]) / 4, (f0[1] + f1[1] + b0[1] + b1[1]) / 4];
      if (P.eau(m[0], m[1]) || P.eau((f0[0] + f1[0]) / 2, (f0[1] + f1[1]) / 2) || x.axes.some((l) => ecart(l, m[0], m[1]) < 0.004)) continue;
      if (q.plat) { const col = q.plat(r); x.o.push(["p", col, [f0, f1, b1, b0], q.h, q.deco ? q.deco(col) : 0]); }
      else x.o.push(["t", q.pal(r), f0, f1, b1, b0, q.h * (0.85 + 0.3 * r())]);
    }
  }
  return D < ri * 0.85 ? interieur(B, D) : null;
}
function cour(x, inn, vert = false) {
  if (!inn) return;
  const a = Math.abs(aire(inn));
  if (vert || a > 0.0015) { x.o.push(["s", "#7da456", inn]); arbres(x.o, inn, x.r, Math.min(7, a / 0.0003)); }
  else { x.o.push(["s", "#d6c7a2", inn]); if (a > 0.0006 && x.r() < 0.5) arbres(x.o, inn, x.r, 1); }
}
// Église orientée selon u : nef, transept, chevet, clocher (deux tours pour une cathédrale)
function eglise(o, c, u, L, nom) {
  const n = [-u[1], u[0]], at = (a, b) => [c[0] + u[0] * a + n[0] * b, c[1] + u[1] * a + n[1] * b], W = 0.16 * L, p = (nom ?? "ardoise") + "0";
  o.push(["t", p, at(-0.38 * L, -W), at(0.36 * L, -W), at(0.36 * L, W), at(-0.38 * L, W), 0.016]);
  o.push(["t", p, at(0.1 * L, -0.31 * L), at(0.1 * L, 0.31 * L), at(0.28 * L, 0.31 * L), at(0.28 * L, -0.31 * L), 0.016]);
  o.push(["p", TEINTES[p].pans[3], Array.from({ length: 9 }, (_, k) => { const a = -Math.PI / 2 + (k / 8) * Math.PI; return at(0.36 * L + Math.cos(a) * W, Math.sin(a) * W); }), 0.014, 0]);
  const tour = (b) => o.push(["p", "#8a8274", rect(at(-0.43 * L, b), u, 0.08 * L, 0.08 * L), 0.04, 0]);
  if (L > 0.07) { tour(-0.11 * L); tour(0.11 * L); } else tour(0);
}
// Bâtiment rectangulaire à toit à deux versants, faîtage le long de u
const maison = (o, c, u, a, b, p, h) => { const R = rect(c, u, a, b); o.push(["t", p, R[0], R[1], R[2], R[3], h]); };

const palVieux = (ere, r) => {
  const k = r();
  if (ere === "futur" && k < 0.3) return pal(k < 0.15 ? "vert" : "solaire", r);
  if (ere === "classique") return pal(k < 0.72 ? "canal" : k < 0.95 ? "tuile" : "ardoise", r);
  return pal(k < 0.55 ? "canal" : k < 0.8 ? "tuile" : k < 0.92 ? "ardoise" : "zinc", r);
};

const REMPLIR = {
  vieux(x) {
    x.o.push(["s", QUARTIERS.vieux[1], x.il.bloc]);
    cour(x, perimetre(x, { D: 0.016, w: [0.01, 0.018], vide: 0.04, prof: [0.65, 1], pal: (r) => palVieux(x.P.ere, r), h: 0.009, cotes: TOUT }), x.P.ere === "futur");
  },
  faubourg(x) {
    x.o.push(["s", QUARTIERS.faubourg[1], x.il.bloc]);
    const inn = perimetre(x, { D: 0.013, w: [0.011, 0.02], vide: 0.35, prof: [0.7, 1], pal: (r) => pal(r() < 0.8 ? "canal" : "tuile", r), h: 0.007, cotes: RUES });
    const cd = cadre(inn ?? x.il.bloc);
    if (cd.a > 0.012 && cd.b > 0.008) potager(x.o, cd.c, cd.u, cd.a * 0.55, cd.b * 0.5, x.r);
    arbres(x.o, inn ?? x.il.bloc, x.r, 3);
  },
  maraichers(x) {
    const { o, r } = x, cd = cadre(x.il.bloc);
    o.push(["s", QUARTIERS.maraichers[1], x.il.bloc]);
    for (let k = -1; k <= 1; k += 2) if (r() < 0.8) potager(o, [cd.c[0] + cd.u[0] * k * cd.a * 0.4, cd.c[1] + cd.u[1] * k * cd.a * 0.4], cd.u, cd.a * 0.32, cd.b * 0.55, r);
    if (r() < 0.6) maison(o, [cd.c[0] - cd.u[1] * cd.b * 0.7, cd.c[1] + cd.u[0] * cd.b * 0.7], cd.u, 0.006, 0.004, pal("canal", r), 0.005);
    arbres(o, x.il.bloc, r, 3);
  },
  place(x) {
    const { o, il, r, P } = x, cd = cadre(il.bloc);
    o.push(["s", QUARTIERS.place[1], il.bloc]);
    const L = Math.min(0.03 + 0.012 * Math.log2(1 + P.v.pop / 4000), cd.a * 1.3, cd.b * 4.5);
    if (L > 0.018) eglise(o, [cd.c[0] - cd.u[0] * cd.a * 0.25, cd.c[1] - cd.u[1] * cd.a * 0.25], cd.u, L, P.ere === "classique" ? "ardoise" : "zinc");
    const f = [cd.c[0] + cd.u[0] * cd.a * 0.55, cd.c[1] + cd.u[1] * cd.a * 0.55];
    o.push(["s", "#a59b86", ovale(f, cd.u, 0.004, 0.004, 10)], ["s", "#5d93c2", ovale(f, cd.u, 0.0028, 0.0028, 10)]);
    if (P.ere !== "classique") for (let k = -1; k <= 1; k += 2) for (let t = -0.8; t <= 0.8; t += 0.2) o.push(["a", cd.c[0] + cd.u[0] * cd.a * t - cd.u[1] * cd.b * 0.8 * k, cd.c[1] + cd.u[1] * cd.a * t + cd.u[0] * cd.b * 0.8 * k, 0.0035, BOIS[2]]);
  },
  eglise(x) {
    x.o.push(["s", QUARTIERS.eglise[1], x.il.bloc]);
    const inn = perimetre(x, { D: 0.012, w: [0.01, 0.016], vide: 0.3, prof: [0.7, 1], pal: (r) => palVieux(x.P.ere, r), h: 0.008, cotes: TOUT });
    if (!inn) return;
    const cd = cadre(inn), L = Math.min(0.11, cd.a * 1.8, cd.b * 5.5);
    x.o.push(["s", "#d9ccab", inn]);
    if (L > 0.02) eglise(x.o, cd.c, cd.u, L, x.r() < 0.7 ? "ardoise" : "tuile");
  },
  jardin(x) {
    const { o, il, r } = x, cd = cadre(il.bloc);
    o.push(["s", QUARTIERS.jardin[1], il.bloc]);
    const inn = interieur(il.bloc, 0.004);
    if (inn) { o.push(["L", "#e3d6b4", 0.003, [cd.c[0] - cd.u[0] * cd.a, cd.c[1] - cd.u[1] * cd.a, cd.c[0] + cd.u[0] * cd.a, cd.c[1] + cd.u[1] * cd.a, cd.c[0] + cd.u[1] * cd.b, cd.c[1] - cd.u[0] * cd.b, cd.c[0] - cd.u[1] * cd.b, cd.c[1] + cd.u[0] * cd.b]]); arbres(o, inn, r, 14); }
  },
  // Antiquité
  insula(x) {
    x.o.push(["s", QUARTIERS.insula[1], x.il.bloc]);
    const inn = perimetre(x, { D: 0.013, w: [0.012, 0.022], vide: 0.05, prof: [0.7, 1], pal: (r) => pal("romaine", r), h: 0.008, cotes: TOUT });
    if (!inn) return;
    x.o.push(["s", "#e2d5b2", inn]);
    const j = interieur(inn, 0.005);
    if (j) { x.o.push(["s", "#7fa55a", j]); if (x.r() < 0.4) { const cd = cadre(j); x.o.push(["s", "#5d9cc4", rect(cd.c, cd.u, Math.min(0.005, cd.a * 0.4), Math.min(0.003, cd.b * 0.4))]); } }
  },
  horti(x) {
    const { o, r } = x, cd = cadre(x.il.bloc);
    o.push(["s", QUARTIERS.horti[1], x.il.bloc]);
    potager(o, cd.c, cd.u, cd.a * 0.5, cd.b * 0.45, r);
    if (r() < 0.5) maison(o, [cd.c[0] + cd.u[0] * cd.a * 0.65, cd.c[1] + cd.u[1] * cd.a * 0.65], cd.u, 0.008, 0.005, pal("romaine", r), 0.006);
    arbres(o, x.il.bloc, r, 2);
  },
  forum(x) {
    const { o, il } = x, cd = cadre(il.bloc), { u } = cd, at = (a, b) => [cd.c[0] + u[0] * a - u[1] * b, cd.c[1] + u[1] * a + u[0] * b];
    o.push(["s", QUARTIERS.forum[1], il.bloc]);
    perimetre(x, { D: 0.006, w: [0.03, 0.05], vide: 0, prof: [1, 1], pal: () => "romaine0", h: 0.006, cotes: TOUT });
    const ta = Math.min(0.016, cd.a * 0.3);
    o.push(["s", "#efe6cf", rect(at(cd.a * 0.55, 0), u, ta * 1.2, ta * 0.75)]);
    maison(o, at(cd.a * 0.55, 0), u, ta, ta * 0.55, "romaine1", 0.014);  // temple sur son podium
    maison(o, at(-cd.a * 0.45, 0), [-u[1], u[0]], Math.min(0.03, cd.b * 0.6), Math.min(0.009, cd.a * 0.15), "romaine2", 0.012);  // basilique
  },
  thermes(x) {
    const { o, il, r } = x, cd = cadre(il.bloc), { u } = cd, at = (a, b) => [cd.c[0] + u[0] * a - u[1] * b, cd.c[1] + u[1] * a + u[0] * b];
    o.push(["s", QUARTIERS.thermes[1], il.bloc]);
    perimetre(x, { D: 0.009, w: [0.01, 0.016], vide: 0.2, prof: [0.8, 1], pal: (r) => pal("romaine", r), h: 0.007, cotes: TOUT });
    o.push(["s", "#7fa55a", rect(at(-cd.a * 0.35, 0), u, cd.a * 0.25, cd.b * 0.5)]);
    maison(o, at(cd.a * 0.2, 0), u, cd.a * 0.32, cd.b * 0.35, "romaine1", 0.012);
    o.push(["s", "#5d9cc4", rect(at(-cd.a * 0.35, 0), u, cd.a * 0.12, cd.b * 0.22)]);
    if (r() < 0.5) maison(o, at(cd.a * 0.2, cd.b * 0.5), [-u[1], u[0]], cd.b * 0.12, cd.a * 0.12, "romaine2", 0.01);
  },
  villa(x) {
    const { o, il, r } = x, u = il.u, n = [-u[1], u[0]], at = (a, b) => [il.c[0] + u[0] * a + n[0] * b, il.c[1] + u[1] * a + n[1] * b];
    o.push(["s", "#86a65a", il.bloc], ["s", "#ddd0ac", rect(il.c, u, 0.02, 0.014)]);
    maison(o, at(0, -0.018), u, 0.026, 0.005, "romaine0", 0.008);
    maison(o, at(-0.024, 0.002), n, 0.016, 0.0045, "romaine1", 0.007);
    maison(o, at(0.024, 0.002), n, 0.016, 0.0045, "romaine2", 0.007);
    const segs = [];
    for (let t = -0.035; t < 0.035; t += 0.0035) { const p = at(t, 0.03); segs.push(p[0] - n[0] * 0.007, p[1] - n[1] * 0.007, p[0] + n[0] * 0.007, p[1] + n[1] * 0.007); }
    o.push(["L", "#4f7a33", 0.0012, segs]);  // vignes
    arbres(o, il.bloc, r, 4);
  },
  amphi(x) { x.o.push(["p", "#cdb68b", x.il.bloc, 0.012, 5]); },
  // ère industrielle
  ouvrier(x) {
    x.o.push(["s", QUARTIERS.ouvrier[1], x.il.bloc]);
    const ind = x.P.ere === "industrielle";
    const inn = perimetre(x, { D: 0.011, w: [0.0075, 0.0095], vide: 0.02, prof: [0.85, 1], pal: (r) => pal(r() < (ind ? 0.7 : 0.5) ? "meca" : r() < 0.5 ? "canal" : "ardoise", r), h: 0.007, cotes: TOUT });
    if (inn) { const cd = cadre(inn); if (cd.a > 0.01 && cd.b > 0.006) potager(x.o, cd.c, cd.u, cd.a * 0.6, cd.b * 0.45, x.r); arbres(x.o, inn, x.r, 2); }
  },
  immeubles(x) {
    x.o.push(["s", QUARTIERS.immeubles[1], x.il.bloc]);
    cour(x, perimetre(x, { D: 0.018, w: [0.014, 0.026], vide: 0, prof: [0.85, 1], pal: (r) => pal(r() < 0.45 ? "zinc" : r() < 0.5 ? "ardoise" : "canal", r), h: 0.016, cotes: TOUT }));
  },
  usine(x) {
    const { o, il, r } = x, inn = interieur(il.bloc, 0.006);
    o.push(["s", QUARTIERS.usine[1], il.bloc]);
    if (!inn) return;
    const cd = cadre(inn), nb = cd.a > 0.05 ? 2 : 1, a = (cd.a * 0.75) / nb;
    for (let k = 0; k < nb; k++) {
      const c = [cd.c[0] + cd.u[0] * (k - (nb - 1) / 2) * 2 * a * 1.08, cd.c[1] + cd.u[1] * (k - (nb - 1) / 2) * 2 * a * 1.08];
      o.push(["p", r() < 0.5 ? "#8f8b84" : "#9b8f80", rect(c, cd.u, a, cd.b * 0.7), 0.012, 3]);
    }
    const ch = [cd.c[0] - cd.u[1] * cd.b * 0.85 + cd.u[0] * cd.a * 0.6, cd.c[1] + cd.u[0] * cd.b * 0.85 + cd.u[1] * cd.a * 0.6];
    o.push(["c", ch[0], ch[1], 0.0028, 0.06]);
  },
  gare(x) {
    const { o, il } = x, cd = cadre(il.bloc), segs = [];
    o.push(["s", QUARTIERS.gare[1], il.bloc]);
    for (let t = -cd.b * 0.6; t <= cd.b * 0.6; t += 0.005) { const p = [cd.c[0] - cd.u[1] * t, cd.c[1] + cd.u[0] * t]; segs.push(p[0] - cd.u[0] * cd.a * 0.95, p[1] - cd.u[1] * cd.a * 0.95, p[0] + cd.u[0] * cd.a * 0.95, p[1] + cd.u[1] * cd.a * 0.95); }
    o.push(["L", "#5d5650", 0.0014, segs]);
    o.push(["p", "#a9bcc6", rect(cd.c, cd.u, cd.a * 0.55, cd.b * 0.38), 0.012, 4]);
    maison(o, [cd.c[0] + cd.u[1] * cd.b * 0.62, cd.c[1] - cd.u[0] * cd.b * 0.62], cd.u, cd.a * 0.4, 0.006, "ardoise1", 0.012);
  },
  // xxᵉ siècle
  pavillons(x, eco = false) {
    const { o, il, r } = x, B = il.bloc, N = normales(B), n = B.length;
    o.push(["s", eco ? QUARTIERS.eco[1] : QUARTIERS.pavillons[1], B]);
    for (let i = 0; i < n; i++) {
      if (!RUES.includes(il.kinds[i])) continue;
      const A = B[i], Bb = B[(i + 1) % n], L = Math.hypot(Bb[0] - A[0], Bb[1] - A[1]), u = [(Bb[0] - A[0]) / L, (Bb[1] - A[1]) / L], nn = N[i];
      for (let t = 0.004 + r() * 0.006; t < L - 0.012;) {
        const w = 0.009 + r() * 0.004, d = 0.008 + r() * 0.003, sb = 0.004 + r() * 0.003, c = [A[0] + u[0] * (t + w / 2) + nn[0] * (sb + d / 2), A[1] + u[1] * (t + w / 2) + nn[1] * (sb + d / 2)];
        const R = rect(c, u, w / 2, d / 2);
        if (R.every((p) => dansPoly(B, p[0], p[1])) && !x.P.eau(c[0], c[1])) {
          const k = r();
          o.push(["t", eco ? pal(k < 0.5 ? "solaire" : k < 0.8 ? "vert" : "canal", r) : pal(k < 0.6 ? "canal" : k < 0.8 ? "ardoise" : "beton", r), R[0], R[1], R[2], R[3], 0.006]);
          const j = [c[0] + nn[0] * (d / 2 + 0.008), c[1] + nn[1] * (d / 2 + 0.008)];
          if (dansPoly(B, j[0], j[1])) {
            if (r() < (eco ? 0.05 : 0.12)) o.push(["s", "#5ab3d6", rect(j, u, 0.0035, 0.002)]);
            else if (r() < 0.6) o.push(["a", j[0], j[1], 0.003 + r() * 0.002, BOIS[(r() * 5) | 0]]);
          }
          const hb = [A[0] + u[0] * (t + w + 0.003), A[1] + u[1] * (t + w + 0.003)];
          o.push(["l", "#4f7a3a", 0.0012, [hb, [hb[0] + nn[0] * 0.026, hb[1] + nn[1] * 0.026]], false]);  // haie mitoyenne
        }
        t += w + 0.006;
      }
    }
    if (eco) arbres(o, B, r, 5);
  },
  eco(x) { REMPLIR.pavillons(x, true); },
  grandEnsemble(x) {
    const { o, il, r } = x, inn = interieur(il.bloc, 0.01);
    o.push(["s", QUARTIERS.grandEnsemble[1], il.bloc]);
    if (!inn) return;
    const cd = cadre(inn), nb = Math.max(1, Math.floor(cd.b / 0.03));
    for (let k = 0; k < nb; k++) {
      const off = (k - (nb - 1) / 2) * ((2 * cd.b * 0.8) / nb), c = [cd.c[0] - cd.u[1] * off, cd.c[1] + cd.u[0] * off];
      if (r() < 0.25) o.push(["p", "#d9d6cf", rect(c, cd.u, 0.009, 0.009), 0.05, 0]);
      else o.push(["p", "#dedbd2", rect(c, cd.u, Math.min(0.06, cd.a * 0.8), 0.006), 0.028, 0]);
      const pk = [c[0] - cd.u[1] * 0.012, c[1] + cd.u[0] * 0.012];
      if (r() < 0.6) o.push(["s", "#8f908e", rect(pk, cd.u, Math.min(0.03, cd.a * 0.5), 0.003)]);
    }
    arbres(o, inn, r, 6);
  },
  zone(x) {
    const { o, il, r } = x, inn = interieur(il.bloc, 0.012);
    o.push(["s", QUARTIERS.zone[1], il.bloc]);
    if (!inn) return;
    const cd = cadre(inn), segs = [];
    o.push(["p", ["#e4e3df", "#c9d0d4", "#9aa5ad", "#d8d2c4"][(r() * 4) | 0], rect([cd.c[0] + cd.u[1] * cd.b * 0.25, cd.c[1] - cd.u[0] * cd.b * 0.25], cd.u, cd.a * 0.75, cd.b * 0.55), 0.01, r() < 0.4 ? 1 : 0]);
    for (let t = -cd.a * 0.8; t < cd.a * 0.8; t += 0.004) { const p = [cd.c[0] + cd.u[0] * t - cd.u[1] * cd.b * 0.72, cd.c[1] + cd.u[1] * t + cd.u[0] * cd.b * 0.72]; segs.push(p[0] - cd.u[1] * 0.004, p[1] + cd.u[0] * 0.004, p[0] + cd.u[1] * 0.004, p[1] - cd.u[0] * 0.004); }
    o.push(["L", "#e8e8e2", 0.0006, segs]);
  },
  parc(x) {
    const { o, il, r } = x, cd = cadre(il.bloc);
    o.push(["s", QUARTIERS.parc[1], il.bloc]);
    const pts = Array.from({ length: 7 }, (_, k) => { const t = k / 6 - 0.5; return [cd.c[0] + cd.u[0] * cd.a * 1.6 * t - cd.u[1] * cd.b * 0.5 * Math.sin(t * 6 + r()), cd.c[1] + cd.u[1] * cd.a * 1.6 * t + cd.u[0] * cd.b * 0.5 * Math.sin(t * 6)]; });
    o.push(["l", "#e0d6b8", 0.0025, pts, false]);
    if (r() < 0.4) o.push(["s", "#4f86b4", ovale([cd.c[0] + cd.u[1] * cd.b * 0.4, cd.c[1] - cd.u[0] * cd.b * 0.4], cd.u, Math.min(0.02, cd.a * 0.35), Math.min(0.01, cd.b * 0.3), 14)]);
    arbres(o, il.bloc, r, Math.min(30, Math.abs(aire(il.bloc)) / 0.00025), 0.004, 0.0075);
  },
  // futur
  tours(x) {
    const { o, il, r } = x, inn = interieur(il.bloc, 0.008);
    o.push(["s", QUARTIERS.tours[1], il.bloc]);
    if (!inn) return;
    const cd = cadre(inn), nb = cd.a > 0.04 ? 2 : 1;
    o.push(["s", "#86b463", rect(cd.c, cd.u, cd.a * 0.9, cd.b * 0.15)]);
    for (let k = 0; k < nb; k++) {
      const s = Math.min(0.02, cd.b * 0.7, (cd.a * 0.8) / nb) * (0.75 + 0.25 * r()), c = [cd.c[0] + cd.u[0] * (k - (nb - 1) / 2) * cd.a, cd.c[1] + cd.u[1] * (k - (nb - 1) / 2) * cd.a], q = r();
      o.push(["p", q < 0.45 ? "#7f9bb3" : q < 0.7 ? "#93a8b7" : "#7aac5a", rect(c, cd.u, s, s * (0.7 + 0.3 * r())), 0.08 + 0.16 * r(), q < 0.7 ? 4 : 2]);
    }
    arbres(o, inn, r, 4);
  },
  dense(x) {
    x.o.push(["s", QUARTIERS.dense[1], x.il.bloc]);
    const inn = perimetre(x, { D: 0.016, w: [0.016, 0.03], vide: 0.05, prof: [0.85, 1], plat: (r) => { const k = r(); return k < 0.45 ? "#86b862" : k < 0.8 ? "#2f4a6a" : "#d9dbd6"; }, deco: (c) => (c === "#86b862" ? 2 : c === "#2f4a6a" ? 1 : 0), h: 0.02, cotes: TOUT });
    cour(x, inn, true);
  },
  // Gaulois
  enclos(x) {
    const { o, il, r } = x, huttes = [];
    o.push(["s", QUARTIERS.enclos[1], il.bloc], ["l", "#6e5636", 0.0013, il.bloc, true]);
    for (let k = 0; k < 30 && huttes.length < 2 + r() * 4; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * rin(il.bloc) * 0.8, hx = il.c[0] + Math.cos(a) * d, hy = il.c[1] + Math.sin(a) * d, hr = 0.0045 + r() * 0.003;
      if (huttes.every(([x2, y2, r2]) => Math.hypot(hx - x2, hy - y2) > hr + r2 + 0.002)) huttes.push([hx, hy, hr]);
    }
    for (const [hx, hy, hr] of huttes) o.push(["h", hx, hy, hr]);
    const g = [il.c[0] + (r() - 0.5) * 0.01, il.c[1] + (r() - 0.5) * 0.01];
    if (huttes.every(([x2, y2, r2]) => Math.hypot(g[0] - x2, g[1] - y2) > r2 + 0.004)) maison(o, g, [1, 0], 0.0022, 0.0022, "chaume1", 0.004);  // grenier
    if (r() < 0.5) o.push(["a", il.bloc[2][0], il.bloc[2][1], 0.005, BOIS[(r() * 5) | 0]]);
  },
  sanctuaire(x) {
    const { o, il, r } = x;
    o.push(["s", QUARTIERS.sanctuaire[1], il.bloc], ["l", "#6e5636", 0.0016, il.bloc, true], ["h", il.c[0], il.c[1], 0.011]);
    arbres(o, il.bloc, r, 4, 0.005, 0.008);
  },
};

// ---------- dessin
const chemin = (g, P) => { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); };
function enveloppe(pts) {  // enveloppe convexe (ombres des tours)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas = [], haut = [];
  for (const q of p) { while (bas.length > 1 && x(bas.at(-2), bas.at(-1), q) <= 0) bas.pop(); bas.push(q); }
  for (const q of p.reverse()) { while (haut.length > 1 && x(haut.at(-2), haut.at(-1), q) <= 0) haut.pop(); haut.push(q); }
  return bas.slice(0, -1).concat(haut.slice(0, -1));
}
const groupe = (m, k) => m.get(k) ?? m.set(k, []).get(k);

function primitives(il, P) {
  if (!il.prims) {
    const o = [], r = alea(il.graine), axes = P.axes.filter((l) => l.pts.some((p, k) => k && distSeg(il.c[0], il.c[1], l.pts[k - 1], p) < 0.25));
    (REMPLIR[il.type] ?? REMPLIR.vieux)({ il, r, o, P, axes });
    il.prims = o;
  }
  return il.prims;
}

function dessinerPrims(g, prims, px) {
  const W = (w) => Math.max(w, 0.7 * px);
  // sols dans l'ordre (les cours par-dessus les îlots), puis marques au sol
  let c = null;
  for (const p of prims) {
    if (p[0] !== "s") continue;
    if (p[1] !== c) { if (c) g.fill(); g.fillStyle = c = p[1]; g.beginPath(); }
    chemin(g, p[2]);
  }
  if (c) g.fill();
  const traits = new Map();
  for (const p of prims) if (p[0] === "L") groupe(traits, p[1] + "|" + p[2]).push(p[3]);
  for (const [k, liste] of traits) {
    const [col, w] = k.split("|");
    g.strokeStyle = col; g.lineWidth = W(+w); g.beginPath();
    for (const s of liste) for (let i = 0; i < s.length; i += 4) { g.moveTo(s[i], s[i + 1]); g.lineTo(s[i + 2], s[i + 3]); }
    g.stroke();
  }
  // ombres portées vers le sud-est, plus longues pour les bâtiments hauts
  g.fillStyle = "rgba(28,22,14,.36)";
  g.beginPath();
  for (const p of prims) {
    if (p[0] === "t" || p[0] === "p") {
      const h = p[0] === "t" ? p[6] : p[3], pts = p[0] === "t" ? [p[2], p[3], p[4], p[5]] : p[2], dx = OMBRE[0] * h, dy = OMBRE[1] * h;
      chemin(g, h > 0.015 ? enveloppe([...pts, ...pts.map((q) => [q[0] + dx, q[1] + dy])]) : pts.map((q) => [q[0] + dx, q[1] + dy]));
    } else if (p[0] === "h") { g.moveTo(p[1] + p[3] * 1.4, p[2] + p[3] * 0.5); g.arc(p[1] + p[3] * 0.4, p[2] + p[3] * 0.5, p[3], 0, TAU); }
  }
  g.fill();
  // toits à deux versants : nuance selon l'orientation au soleil ; faîtages
  const pans = new Map(), faites = new Map();
  for (const p of prims) {
    if (p[0] !== "t") continue;
    const [, nom, f0, f1, b1, b0] = p, T = TEINTES[nom] ?? TEINTES.tuile0;
    let nx = -(f1[1] - f0[1]), ny = f1[0] - f0[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    if (nx * (b0[0] - f0[0]) + ny * (b0[1] - f0[1]) < 0) { nx = -nx; ny = -ny; }
    const r0 = lerp(f0, b0, 0.5), r1 = lerp(f1, b1, 0.5), s = nx * SOLEIL[0] + ny * SOLEIL[1];
    const teinte = (k) => T.pans[Math.round(Math.max(0, Math.min(1, 0.5 + 0.7 * k)) * 8)];
    groupe(pans, teinte(-s)).push([f0, f1, r1, r0]);
    groupe(pans, teinte(s)).push([r0, r1, b1, b0]);
    groupe(faites, T.faite).push(r0, r1);
  }
  for (const [col, liste] of pans) { g.fillStyle = col; g.beginPath(); for (const q of liste) chemin(g, q); g.fill(); }
  g.lineWidth = Math.max(0.0007, 0.5 * px);
  for (const [col, liste] of faites) {
    g.strokeStyle = col; g.beginPath();
    for (let i = 0; i < liste.length; i += 2) { g.moveTo(liste[i][0], liste[i][1]); g.lineTo(liste[i + 1][0], liste[i + 1][1]); }
    g.stroke();
  }
  // toits plats et leurs décors (panneaux solaires, toits végétalisés, sheds, verrières, gradins)
  const plats = new Map();
  for (const p of prims) if (p[0] === "p") groupe(plats, p[1]).push(p[2]);
  for (const [col, liste] of plats) { g.fillStyle = col; g.beginPath(); for (const q of liste) chemin(g, q); g.fill(); }
  const deco = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const p of prims) if (p[0] === "p" && p[4]) deco[p[4]].push(p[2]);
  const rayures = (liste, pas, col, w) => {
    g.strokeStyle = col; g.lineWidth = W(w); g.beginPath();
    for (const q of liste) {
      const [a, b, c2, d] = q, n = Math.max(1, Math.round(Math.hypot(d[0] - a[0], d[1] - a[1]) / pas));
      for (let k = 1; k < n; k++) { const p0 = lerp(a, d, k / n), p1 = lerp(b, c2, k / n); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
    }
    g.stroke();
  };
  rayures(deco[1], 0.0022, "rgba(150,185,230,.55)", 0.0004);
  rayures(deco[3], 0.005, "rgba(40,36,30,.45)", 0.0012);
  rayures(deco[4], 0.004, "rgba(255,255,255,.3)", 0.0005);
  if (deco[2].length) {
    g.fillStyle = "rgba(40,90,30,.35)"; g.beginPath();
    for (const q of deco[2]) for (let k = 0; k < 6; k++) { const p0 = lerp(lerp(q[0], q[1], hash(k, q[0][0] * 1e5, 1)), lerp(q[3], q[2], hash(k, q[0][0] * 1e5, 1)), hash(k, q[0][1] * 1e5, 2)); g.moveTo(p0[0] + 0.0015, p0[1]); g.arc(p0[0], p0[1], 0.0015, 0, TAU); }
    g.fill();
  }
  for (const q of deco[5]) {  // amphithéâtre : gradins et arène
    const c0 = centre(q), s = (k) => q.map((p) => lerp(c0, p, k));
    g.strokeStyle = "rgba(90,70,40,.4)"; g.lineWidth = W(0.0008); g.beginPath();
    for (const k of [0.68, 0.78, 0.88]) chemin(g, s(k));
    g.stroke();
    g.fillStyle = "#e6d5a6"; g.beginPath(); chemin(g, s(0.58)); g.fill();
  }
  // lignes (palissades, haies, allées)
  const lignes = new Map();
  for (const p of prims) if (p[0] === "l") groupe(lignes, p[1] + "|" + p[2]).push(p);
  g.lineCap = g.lineJoin = "round";
  for (const [k, liste] of lignes) {
    const [col, w] = k.split("|");
    g.strokeStyle = col; g.lineWidth = W(+w); g.beginPath();
    for (const p of liste) { p[3].forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (p[4]) g.closePath(); }
    g.stroke();
  }
  // cheminées d'usine et leur longue ombre
  for (const p of prims) {
    if (p[0] !== "c") continue;
    g.strokeStyle = "rgba(28,22,14,.4)"; g.lineWidth = p[3] * 1.6; g.beginPath(); g.moveTo(p[1], p[2]); g.lineTo(p[1] + OMBRE[0] * p[4], p[2] + OMBRE[1] * p[4]); g.stroke();
    g.fillStyle = "#8c4a36"; g.beginPath(); g.arc(p[1], p[2], p[3], 0, TAU); g.fill();
    g.fillStyle = "#2c2622"; g.beginPath(); g.arc(p[1], p[2], p[3] * 0.55, 0, TAU); g.fill();
  }
  // arbres : ombre, houppier, reflet
  const ar = prims.filter((p) => p[0] === "a");
  if (ar.length) {
    g.fillStyle = "rgba(20,32,12,.42)"; g.beginPath();
    for (const p of ar) { g.moveTo(p[1] + p[3] * 1.3, p[2] + p[3] * 0.4); g.arc(p[1] + p[3] * 0.3, p[2] + p[3] * 0.4, p[3], 0, TAU); }
    g.fill();
    const parC = new Map();
    for (const p of ar) groupe(parC, p[4]).push(p);
    for (const [col, liste] of parC) { g.fillStyle = col; g.beginPath(); for (const p of liste) { g.moveTo(p[1] + p[3], p[2]); g.arc(p[1], p[2], p[3], 0, TAU); } g.fill(); }
    g.fillStyle = "rgba(165,207,127,.28)"; g.beginPath();
    for (const p of ar) { g.moveTo(p[1] - p[3] * 0.32 + p[3] * 0.5, p[2] - p[3] * 0.34); g.arc(p[1] - p[3] * 0.32, p[2] - p[3] * 0.34, p[3] * 0.5, 0, TAU); }
    g.fill();
  }
  // huttes gauloises : chaume en cône, clair au nord-ouest, faîte sombre
  const hu = prims.filter((p) => p[0] === "h");
  if (hu.length) {
    const disques = (col, k, dx, dy) => { g.fillStyle = col; g.beginPath(); for (const p of hu) { const x = p[1] + dx * p[3], y = p[2] + dy * p[3]; g.moveTo(x + p[3] * k, y); g.arc(x, y, p[3] * k, 0, TAU); } g.fill(); };
    disques("#9a7f48", 1, 0, 0);
    disques("#c2a564", 0.72, -0.2, -0.24);
    disques("#d8bf80", 0.35, -0.3, -0.36);
    disques("#5e4a2c", 0.14, 0, 0);
  }
}

// Dessine la partie d'un plan qui tombe dans la tuile [x0, y0, x1, y1] (km), sur un contexte transformé en km ; L = px/km
export function dessinerPlan(g, plan, x0, y0, x1, y1, L) {
  const px = 1 / L, m = 0.02, vus = [], deja = new Set();
  for (let i = Math.floor((x0 - m) / CASE); i <= Math.floor((x1 + m) / CASE); i++) {
    for (let j = Math.floor((y0 - m) / CASE); j <= Math.floor((y1 + m) / CASE); j++) {
      for (const il of plan.cases.get(i * 100003 + j) ?? []) {
        if (deja.has(il)) continue;
        deja.add(il);
        const b = il.boite;
        if (b[2] > x0 - m && b[0] < x1 + m && b[3] > y0 - m && b[1] < y1 + m) vus.push(il);
      }
    }
  }
  g.lineCap = g.lineJoin = "round";
  // le sol des rues sous les îlots
  g.fillStyle = plan.rue;
  g.beginPath();
  for (const il of vus) if (il.pts) chemin(g, il.pts);
  g.fill();
  if (L >= DETAIL) {
    const prims = [];
    for (const il of vus) for (const p of primitives(il, plan)) prims.push(p);
    dessinerPrims(g, prims, px);
  } else {
    // de loin : chaque îlot en aplat, son pourtour bâti d'une teinte de toits, la cour au milieu
    const sols = new Map(), bati = new Map();
    for (const il of vus) {
      const [, sol, teinte, D] = QUARTIERS[il.type];
      groupe(sols, sol).push(il.bloc);
      if (teinte) groupe(bati, teinte).push([il.bloc, il.cour === undefined ? (il.cour = interieur(il.bloc, Math.min(D, rin(il.bloc) * 0.92))) : il.cour]);
    }
    for (const [col, liste] of sols) { g.fillStyle = col; g.beginPath(); for (const b of liste) chemin(g, b); g.fill(); }
    for (const [col, liste] of bati) {
      g.fillStyle = col; g.beginPath();
      for (const [b, c] of liste) { chemin(g, b); if (c) chemin(g, c.slice().reverse()); }
      g.fill("evenodd");
    }
    const hu = vus.filter((il) => il.type === "enclos" || il.type === "sanctuaire");
    if (hu.length) { g.fillStyle = "#9a7f48"; g.beginPath(); for (const il of hu) { g.moveTo(il.c[0] + 0.006, il.c[1]); g.arc(il.c[0], il.c[1], 0.006, 0, TAU); } g.fill(); }
  }
  enceinte(g, plan, x0, y0, x1, y1, L, px);
}

// Remparts (courtines et tours, portes sur les routes), boulevards plantés, levée de terre gauloise
function enceinte(g, plan, x0, y0, x1, y1, L, px) {
  const ligne = plan.mur?.pts ?? plan.rempart;
  if (!ligne) return;
  const xs = ligne.map((p) => p[0]), ys = ligne.map((p) => p[1]);
  if (Math.max(...xs) < x0 - 0.05 || Math.min(...xs) > x1 + 0.05 || Math.max(...ys) < y0 - 0.05 || Math.min(...ys) > y1 + 0.05) return;
  // découpe en tronçons de 10 m : pas sur l'eau, ouvert aux portes
  const morceaux = [], porte = (x, y) => plan.axes.some((l) => ecart(l, x, y) < 0.012);
  for (let k = 1; k < ligne.length; k++) {
    const a = ligne[k - 1], b = ligne[k], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01);
    for (let i = 0; i < n; i++) {
      const p = lerp(a, b, i / n), q = lerp(a, b, (i + 1) / n), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (!plan.eau(mx, my) && !porte(mx, my)) morceaux.push(p, q);
    }
  }
  const trace = (col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i < morceaux.length; i += 2) { g.moveTo(...morceaux[i]); g.lineTo(...morceaux[i + 1]); } g.stroke(); };
  g.lineCap = "butt";
  if (plan.rempart) {
    trace("#6d5a3a", Math.max(0.018, 2.5 * px)); trace("#a48d5e", Math.max(0.011, 1.5 * px)); trace("#5a4630", Math.max(0.0015, 0.8 * px));
  } else if (plan.mur.kind === "mur") {
    trace("#86a05a", 0.02); trace("#5e5446", Math.max(0.0075, 1.9 * px)); trace("#e2d8c0", Math.max(0.0055, 1.3 * px));
    if (L >= 48) {  // tours aux angles et tous les 80 m
      g.fillStyle = "#efe6d0"; g.strokeStyle = "#5e5446"; g.lineWidth = Math.max(0.001, 0.6 * px); g.beginPath();
      for (let k = 1; k < ligne.length; k++) {
        const a = ligne[k - 1], b = ligne[k], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08));
        for (let i = 0; i < n; i++) { const p = lerp(a, b, i / n); if (!plan.eau(p[0], p[1])) { g.moveTo(p[0] + 0.0065, p[1]); g.arc(p[0], p[1], 0.0065, 0, TAU); } }
      }
      g.fill(); g.stroke();
    }
  } else if (L >= DETAIL) {  // boulevard : deux rangées d'arbres là où était le rempart
    const arbresB = [];
    for (let i = 0; i < morceaux.length; i += 2) {
      const [p, q] = [morceaux[i], morceaux[i + 1]], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l;
      for (const s of [1, -1]) arbresB.push(["a", p[0] + nx * 0.0105 * s, p[1] + ny * 0.0105 * s, 0.0042, BOIS[2 + (i % 2)]]);
    }
    dessinerPrims(g, arbresB, px);
  }
  g.lineCap = "round";
}

// ---------- auto-vérification : node web/moteur/themes/villes.js
if (typeof process !== "undefined" && process.argv[1]?.endsWith("villes.js")) {
  const riviere = { pts: [[0.25, -3], [0.25, 3]], ws: [0.06, 0.06] };
  const eau = (x, y) => Math.abs(x - 0.25) < 0.066;
  const axes = [{ pts: [[0, 0], [3, 0.4]], grand: true }, { pts: [[0, 0], [-1, 2.5]] }, { pts: [[0, 0], [-2, -2]] }];
  const faux = { fillStyle: "", strokeStyle: "", lineWidth: 1 };
  for (const f of ["beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "arc"]) faux[f] = () => {};
  const verifier = (ere, pop, extra = {}) => {
    const t = Date.now(), v = { x: 0, y: 0, pop, ere, r: rayon(pop, ere), rh: rayon(pop * 0.3, "classique"), ri: rayon(pop * 0.6, "industrielle"), graine: 42, axes, rivieres: [riviere], murs: pop > 15000, ...extra };
    const plan = genererPlan(v, eau, () => false), gen = Date.now() - t;
    let bat = 0;
    for (const il of plan.ilots) {
      for (const p of primitives(il, plan)) {
        if (p[0] !== "t" && p[0] !== "p" && p[0] !== "h") continue;
        bat++;
        const pts = p[0] === "t" ? [p[2], p[3], p[4], p[5]] : p[0] === "p" ? p[2] : [[p[1], p[2]]];
        const [mx, my] = centre(pts);
        console.assert(!eau(mx, my), `${ere} : bâtiment dans l'eau`, mx, my);
      }
    }
    dessinerPlan(faux, plan, -1, -1, 1, 1, 256);
    dessinerPlan(faux, plan, -4, -4, 4, 4, 32);
    const types = new Set(plan.ilots.map((il) => il.type));
    console.assert(bat > (pop < 500 ? 3 : 10), `${ere} : trop peu de bâtiments`, bat);
    console.log(`${ere.padEnd(12)} ${String(Math.round(pop)).padStart(8)} hab. R ${v.r.toFixed(2)} km : ${plan.ilots.length} îlots, ${bat} bâtiments (${gen} ms) — ${[...types].join(", ")}`);
    return plan;
  };
  verifier("celte", 7800); verifier("celte", 40);
  verifier("romaine", 15600);
  verifier("classique", 80000); verifier("classique", 120);
  verifier("industrielle", 143000);
  verifier("moderne", 221000); verifier("moderne", 300);
  verifier("futur", 299000);
  const t = Date.now(), paris = { x: 0, y: 0, pop: 2.4e6, ere: "futur", r: rayon(2.4e6, "futur"), rh: rayon(630000, "classique"), ri: rayon(1.2e6, "industrielle"), graine: 7, axes, rivieres: [riviere], murs: true };
  const pl = genererPlan(paris, eau);
  console.log(`Paris 2100 : ${pl.ilots.length} îlots en ${Date.now() - t} ms`);
  console.assert(Date.now() - t < 1500, "génération trop lente");
}
