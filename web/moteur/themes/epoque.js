// Les époques du rendu. Un jeu donne une année (Regles.ANNEE) ; tout le dessin (villes, routes, réseaux, véhicules,
// campagne) s'y adapte. Le Moyen Âge n'est pas traité : de 500 à 1699, on dessine comme en 1700.
//
//   ère          années          en bref
//   celte        avant -52       oppida et villages de huttes rondes au toit de chaume, sentiers
//   romaine      -52 à 499       villes en damier, forum, voies romaines, villae
//   classique    500 à 1839      bourgs serrés, remparts, chemins de terre, routes royales
//   industrielle 1840 à 1944     chemin de fer, faubourgs ouvriers, routes empierrées puis goudronnées
//   moderne      1945 à 2039     banlieues pavillonnaires, grands ensembles, autoroutes
//   futur        2040 et après   mégapoles vertes : tours, toits végétalisés et solaires, tramways, drones
import { vue } from "./outils.js";

export const ERES = [
  { nom: "celte", jusqua: -53 },
  { nom: "romaine", jusqua: 499 },
  { nom: "classique", jusqua: 1839 },
  { nom: "industrielle", jusqua: 1944 },
  { nom: "moderne", jusqua: 2039 },
  { nom: "futur", jusqua: Infinity },
];

export const ere = (annee = vue.annee) => ERES.find((e) => annee <= e.jusqua).nom;

// Années proposées par l'Atlas (pas de Moyen Âge)
export const ANNEES = [-100, -52, 50, 200, ...Array.from({ length: 41 }, (_, k) => 1700 + 10 * k)];

// Une entité n'existe qu'entre ses années « depuis » et « jusqua » (par exemple une voie ferrée depuis 1850)
export const existe = (e, annee = vue.annee) => (e.depuis ?? -Infinity) <= annee && annee <= (e.jusqua ?? Infinity);

// Population d'une ville à une année donnée, d'après sa population actuelle (ordre de grandeur pour la France)
const COURBE = [[-100, 0.03], [200, 0.06], [500, 0.08], [1700, 0.25], [1800, 0.3], [1850, 0.4], [1900, 0.55],
  [1950, 0.7], [2000, 0.95], [2025, 1], [2100, 1.15]];
export function facteurPopulation(annee = vue.annee) {
  if (annee <= COURBE[0][0]) return COURBE[0][1];
  for (let i = 1; i < COURBE.length; i++) {
    const [a1, f1] = COURBE[i - 1], [a2, f2] = COURBE[i];
    if (annee <= a2) return f1 + ((f2 - f1) * (annee - a1)) / (a2 - a1);
  }
  return COURBE.at(-1)[1];
}

// --- Campagne et voies selon l'année ---
// Paysage : antique (forêts, landes, petits champs irréguliers), ancien (lanières et haies, 500 à 1959),
// remembre (grandes parcelles, maïs, peu de haies, 1960 à 2039), futur (haies et bosquets revenus, fermes solaires)
export const paysageDe = (annee = vue.annee) => (annee < 500 ? "antique" : annee < 1960 ? "ancien" : annee < 2040 ? "remembre" : "futur");
// Routes et chemins : sentier de terre, chemin, route empierrée (routes royales), goudronnée, moderne, verte (bordée d'arbres)
export const routeDe = (annee = vue.annee) =>
  annee < 500 ? "sentier" : annee < 1750 ? "terre" : annee < 1920 ? "empierree" : annee < 1960 ? "goudron" : annee < 2040 ? "moderne" : "verte";

// Motifs répétés le long des voies (traverses, tirets de voie ferrée, pavés, arbres d'alignement) : 16 px par période
const P = window.PIXI;
const bandes = {};
const MOTIFS = {
  traverses: (c) => c.fillRect(0, 0, 6, 16),
  moitie: (c) => c.fillRect(0, 0, 8, 16),
  paves: (c) => { c.fillRect(0, 0, 1.5, 16); c.fillRect(0, 7.25, 16, 1.5); },
  arbres: (c) => { c.beginPath(); c.arc(8, 8, 7, 0, 7); c.fill(); },
};
function bande(nom, couleur) {
  const cle = nom + couleur;
  if (!bandes[cle]) {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#" + couleur.toString(16).padStart(6, "0");
    MOTIFS[nom](ctx);
    bandes[cle] = P.Texture.from(c);
  }
  return bandes[cle];
}

// Trait à motif répété le long de la ligne (le motif tourne avec chaque tronçon et ne repart pas à chaque sommet) :
// periode en unités du monde, couleur du motif (le reste est transparent). Coût : un trait par tronçon, quel que soit le zoom.
export function rayures(g, points, nom, periode, couleur, style) {
  let parcouru = 0;
  const s = periode / 16;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i], d = Math.hypot(x2 - x1, y2 - y1);
    if (!d) continue;
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, recul = parcouru % periode;
    const motif = new P.FillPattern(bande(nom, couleur), "repeat");
    // pixel du motif (u, v) → monde : u le long du tronçon, v en travers, centré sur la ligne
    motif.setTransform(new P.Matrix(s * ux, s * uy, -s * uy, s * ux, x1 - ux * recul + uy * 8 * s, y1 - uy * recul - ux * 8 * s));
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ cap: "butt", join: "round", ...style, fill: motif });
    parcouru += d;
  }
}

// Polyligne décalée de d (unités du monde) sur sa gauche : rails, chaussées, rangées d'arbres
export function parallele(points, d) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / l) * d, p[1] + (dx / l) * d];
  });
}

// Voie ferrée vue de près (largeur w exagérée à l'écran) : ballast, traverses, deux rails par voie ; double voie si double
export function voieDePres(g, points, w, double, teintes) {
  const { ballast, traverse, rail } = teintes;
  g.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.stroke({ width: w, color: ballast, cap: "round", join: "round" });
  for (const c of double ? [-0.24, 0.24] : [0]) {
    const axe = c ? parallele(points, c * w) : points;
    rayures(g, axe, "traverses", w / 5, traverse, { width: w * (double ? 0.4 : 0.6) });
    for (const r of [-0.09, 0.09].map((k) => k * w * (double ? 1 : 1.5))) {
      const p = parallele(axe, r);
      g.moveTo(p[0][0], p[0][1]);
      for (const [x, y] of p.slice(1)) g.lineTo(x, y);
      g.stroke({ width: Math.max(0.035 * w, 0.9 / vue.zoom), color: rail, join: "round" });
    }
  }
}

// Arbres d'alignement des deux côtés d'une voie de largeur w (2100) ; diametre et ecart en unités du monde
export function alignement(g, points, w, diametre, couleur) {
  for (const d of [-1, 1]) rayures(g, parallele(points, d * (w / 2 + diametre * 0.6)), "arbres", diametre * 1.5, couleur, { width: diametre * 1.35, alpha: 0.9 });
}
