// Plans de villes organiques, à la manière d'une vue du ciel « mini réaliste » : les rues partent des routes qui
// arrivent à la ville et se ramifient en ruelles qui serpentent ; les maisons s'alignent le long des rues, serrées au
// cœur, plus rares vers les faubourgs, avec des jardins derrière ; une place et son église au centre ; une enceinte
// irrégulière pour les villes closes d'autrefois. Pas de rivière sous les maisons. Tout est en km, déterministe.
import { bruit, hash } from "./decor.js";

const TAU = Math.PI * 2;
const CASE = 0.25;  // index spatial des maisons (km)

// Réglages par époque : rues (km), façades et profondeurs des maisons (km), couleurs
export const STYLES = {
  ancien: {
    rue: 0.008, axe: 0.012, facade: [0.016, 0.028], profondeur: [0.012, 0.02], jardin: 0.35,
    toits: ["#b5553f", "#a8473a", "#c0664a", "#9a4632", "#b8604a", "#8f4430"], sol: "#cdb991", voie: "#d8c7a0",
  },
  moderne: {
    rue: 0.012, axe: 0.02, facade: [0.022, 0.05], profondeur: [0.016, 0.04], jardin: 0.6,
    toits: ["#8d9196", "#a9adb0", "#c9c6bd", "#767d86", "#b7afa3", "#9c8f86"], sol: "#a7a59d", voie: "#6d6e70",
  },
};

export function genererPlan(v, eau, epoque) {
  const S = STYLES[epoque], g = v.graine | 0, R = v.r;
  let n = 0;
  const alea = () => hash(g, n++, 77);
  const rues = [], maisons = [], jardins = [];
  // Enveloppe irrégulière : jusqu'où la ville s'étend dans chaque direction
  const enveloppe = (a) => R * (0.7 + 0.55 * bruit(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + 10, 1, g % 89));
  const rapport = (x, y) => Math.hypot(x - v.x, y - v.y) / enveloppe(Math.atan2(y - v.y, x - v.x));

  // Axes : les routes qui arrivent (au moins 3, sinon on en ajoute)
  const axes = [...v.axes];
  while (axes.length < 3) axes.push((axes.length ? axes[0] : alea() * TAU) + (TAU * axes.length) / 3 + (alea() - 0.5) * 0.6);

  const pousser = (x, y, angle, longueur, profondeurRue, principale) => {
    const pas = Math.min(0.06, Math.max(0.015, R * 0.05)), pts = [[x, y]];
    let a = angle;
    for (let s = 0; s < longueur; s += pas) {
      a += (alea() - 0.5) * 0.35 + (angle - a) * 0.15;  // serpente, mais garde son cap
      x += Math.cos(a) * pas;
      y += Math.sin(a) * pas;
      if (eau(x, y) && !principale) break;  // une ruelle s'arrête au bord de l'eau ; un axe la franchit (pont)
      if (!principale && rapport(x, y) > 1.05) break;
      pts.push([x, y]);
    }
    if (pts.length < 2) return;
    const rue = { pts, l: principale ? S.axe : S.rue, principale };
    rues.push(rue);
    if (profondeurRue >= 2) return;
    // ruelles qui partent de chaque côté, plus serrées au cœur
    for (let i = 2; i < pts.length - 1; i++) {
      const [px, py] = pts[i], q = rapport(px, py);
      if (q > 1 || alea() > (q < 0.5 ? 0.45 : 0.22)) continue;
      const [qx, qy] = pts[i + 1], dir = Math.atan2(qy - py, qx - px), cote = alea() < 0.5 ? 1 : -1;
      pousser(px, py, dir + cote * (Math.PI / 2 + (alea() - 0.5) * 0.7), R * (0.25 + alea() * 0.5) / (profondeurRue + 1), profondeurRue + 1, false);
    }
  };
  for (const a of axes) pousser(v.x, v.y, a, enveloppe(a) * 1.6, 0, true);

  // Maisons le long des rues, sans se chevaucher (grille d'occupation fine)
  const occupe = new Set(), cle = (x, y) => `${Math.floor(x / 0.008)},${Math.floor(y / 0.008)}`;
  const libre = (pts) => pts.every(([x, y]) => !occupe.has(cle(x, y)));
  for (const rue of rues) {
    for (let i = 0; i < rue.pts.length - 1; i++) {
      const [x1, y1] = rue.pts[i], [x2, y2] = rue.pts[i + 1], d = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      for (let t = 0; t < d;) {
        const f = S.facade[0] + alea() * (S.facade[1] - S.facade[0]);
        for (const cote of [1, -1]) {
          const p = S.profondeur[0] + alea() * (S.profondeur[1] - S.profondeur[0]), o = rue.l / 2 + 0.002;
          const cx = x1 + ux * (t + f / 2) - uy * cote * (o + p / 2), cy = y1 + uy * (t + f / 2) + ux * cote * (o + p / 2);
          const q = rapport(cx, cy), dens = q < 0.55 ? 0.95 : q < 1 ? 0.95 - (q - 0.55) * 1.6 : rue.principale && q < 1.6 ? 0.35 * (1.6 - q) : 0;
          if (alea() > dens) continue;
          const coins = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + ux * (a * f) / 2 - uy * cote * (b * p) / 2, cy + uy * (a * f) / 2 + ux * cote * (b * p) / 2]);
          if (eau(cx, cy) || !libre([[cx, cy], ...coins])) continue;
          for (const [x, y] of [[cx, cy], ...coins]) occupe.add(cle(x, y));
          maisons.push({ coins, x: cx, y: cy, toit: S.toits[Math.floor(alea() * S.toits.length)], long: f > p, ux, uy });
          // jardin derrière les maisons des quartiers lâches
          if (q > 0.45 && alea() < S.jardin) {
            const jx = cx - uy * cote * (p / 2 + p * 0.6), jy = cy + ux * cote * (p / 2 + p * 0.6);
            if (!eau(jx, jy)) jardins.push({ x: jx, y: jy, w: f * 0.9, h: p * 1.1, ux, uy, potager: alea() < 0.5 });
          }
        }
        t += f + 0.001;
      }
    }
  }
  // Index spatial pour ne dessiner que les maisons de la tuile
  const cases = new Map();
  for (const m of maisons) {
    const k = `${Math.floor(m.x / CASE)},${Math.floor(m.y / CASE)}`;
    (cases.get(k) ?? cases.set(k, []).get(k)).push(m);
  }
  // Enceinte : polygone irrégulier autour du vieux centre, interrompu sur l'eau
  let murs = null;
  if (epoque === "ancien" && v.murs) {
    const nb = 14 + Math.round(R * 6);
    murs = Array.from({ length: nb }, (_, k) => {
      const a = (k / nb) * TAU, r = enveloppe(a) * 0.62 * (0.9 + 0.2 * hash(k, g, 5));
      return [v.x + Math.cos(a) * r, v.y + Math.sin(a) * r];
    });
  }
  const boite = [v.x - R * 2, v.y - R * 2, v.x + R * 2, v.y + R * 2];
  return { rues, maisons, jardins, cases, murs, boite, centre: [v.x, v.y], R, S };
}

// Dessine la partie d'un plan qui tombe dans la tuile [x0, y0, x1, y1] (km), sur un contexte transformé en km
export function dessinerPlan(g, plan, x0, y0, x1, y1, px, eau) {
  const { S } = plan;
  // jardins et potagers
  for (const j of plan.jardins) {
    if (j.x < x0 - 0.05 || j.x > x1 + 0.05 || j.y < y0 - 0.05 || j.y > y1 + 0.05) continue;
    g.fillStyle = j.potager ? "#8a9a52" : "#6f9a4e";
    g.beginPath();
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.lineTo(j.x + (j.ux * a * j.w - j.uy * b * j.h) / 2, j.y + (j.uy * a * j.w + j.ux * b * j.h) / 2);
    g.fill();
  }
  // rues : terre battue autrefois, bitume aujourd'hui ; jamais plus fines qu'un pixel
  g.lineCap = g.lineJoin = "round";
  for (const principale of [false, true]) {
    g.strokeStyle = S.voie;
    g.beginPath();
    let l = 0;
    for (const r of plan.rues) {
      if (r.principale !== principale) continue;
      l = Math.max(r.l, 1.1 * px);
      r.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    }
    g.lineWidth = l;
    g.stroke();
  }
  // maisons de la tuile : ombre au sud-est, toit, faîtage
  const vues = [];
  for (let i = Math.floor((x0 - 0.05) / CASE); i <= Math.floor((x1 + 0.05) / CASE); i++) {
    for (let j = Math.floor((y0 - 0.05) / CASE); j <= Math.floor((y1 + 0.05) / CASE); j++) vues.push(...(plan.cases.get(`${i},${j}`) ?? []));
  }
  if (vues.length) {
    const poly = (m, dx = 0, dy = 0) => { m.coins.forEach(([x, y], k) => (k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.closePath(); };
    g.fillStyle = "rgba(25,18,10,.38)";
    g.beginPath();
    for (const m of vues) poly(m, 0.003, 0.004);
    g.fill();
    const parToit = new Map();
    for (const m of vues) (parToit.get(m.toit) ?? parToit.set(m.toit, []).get(m.toit)).push(m);
    for (const [c, liste] of parToit) {
      g.fillStyle = c;
      g.beginPath();
      for (const m of liste) poly(m);
      g.fill();
    }
    // faîtage : la ligne du toit à deux pans, dans la longueur de la maison ; versant à l'ombre un peu plus sombre
    g.strokeStyle = S === STYLES.moderne ? "rgba(255,255,255,.28)" : "rgba(70,25,12,.45)";
    g.lineWidth = Math.max(0.0015, 0.6 * px);
    g.beginPath();
    for (const m of vues) {
      const [a, b, c, d] = m.coins;
      if (S === STYLES.moderne) { g.moveTo(a[0], a[1]); [b, c, d, a].forEach((p) => g.lineTo(p[0], p[1])); continue; }
      const [p, q] = m.long ? [[(a[0] + d[0]) / 2, (a[1] + d[1]) / 2], [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]] : [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]];
      g.moveTo(p[0], p[1]);
      g.lineTo(q[0], q[1]);
    }
    g.stroke();
  }
  // place et église (ou mairie) au centre
  const [cx, cy] = plan.centre;
  if (cx > x0 - 0.2 && cx < x1 + 0.2 && cy > y0 - 0.2 && cy < y1 + 0.2) {
    const r = 0.022 + plan.R * 0.03;
    g.fillStyle = S === STYLES.moderne ? "#bdb8ae" : "#e2d4b0";
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, rr = r * (0.8 + 0.4 * hash(k, cx * 1000 | 0, 3));
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.fill();
    g.fillStyle = "rgba(25,18,10,.38)";
    g.fillRect(cx - 0.02 + 0.003, cy - 0.007 + 0.004, 0.04, 0.014);
    g.fillStyle = S === STYLES.moderne ? "#d9d3c4" : "#8a6a52";
    g.fillRect(cx - 0.02, cy - 0.007, 0.04, 0.014);  // nef
    g.fillRect(cx - 0.006, cy - 0.013, 0.012, 0.026);  // transept
  }
  // enceinte : courtines et tours, coupées sur l'eau
  if (plan.murs) {
    const m = plan.murs;
    g.strokeStyle = "#ebe2cc";
    g.lineWidth = Math.max(0.01, 1.4 * px);
    g.beginPath();
    m.forEach(([x, y], k) => {
      const [qx, qy] = m[(k + 1) % m.length];
      if (eau((x + qx) / 2, (y + qy) / 2)) return;
      g.moveTo(x, y);
      g.lineTo(qx, qy);
    });
    g.stroke();
    g.fillStyle = "#f2ead6";
    g.strokeStyle = "#7a6a52";
    g.lineWidth = Math.max(0.002, 0.5 * px);
    g.beginPath();
    for (const [x, y] of m) {
      if (eau(x, y)) continue;
      g.moveTo(x + 0.014, y);
      g.arc(x, y, 0.014, 0, TAU);
    }
    g.fill();
    g.stroke();
  }
}

// Auto-vérification (node web/moteur/themes/villes.js) : pas de maison dans l'eau ni de chevauchement grossier
if (typeof process !== "undefined" && process.argv[1]?.endsWith("villes.js")) {
  const riviere = (x, y) => Math.abs(x - 0.1) < 0.05;  // une rivière nord-sud à l'est du centre
  const plan = genererPlan({ x: 0, y: 0, r: 0.8, graine: 42, murs: true, axes: [0.3, 2.5] }, riviere, "ancien");
  console.assert(plan.maisons.length > 200, "trop peu de maisons", plan.maisons.length);
  console.assert(plan.maisons.every((m) => !riviere(m.x, m.y)), "maison dans la rivière");
  console.assert(plan.rues.some((r) => r.principale), "pas d'axe");
  console.log(`OK — plan de ville vérifié (${plan.maisons.length} maisons, ${plan.rues.length} rues)`);
}
