// Thème « Carte » : carte stratégique ancienne (couleurs passées, relief ombré, noms en lettres à empattements).
// Même structure que aerienne.js : tables de styles par type, « _ » par défaut.
import { alea, trait, traitVariable, pointilles, lelong, forme, boite, etiquette, nomLieu, vue, largeur } from "./outils.js";
import { decor, terrain, MER_LARGE } from "./decor.js";
import { routeDe, rayures, voieDePres, alignement } from "./epoque.js";

const P = window.PIXI;
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const TERRES = { chaume: 0xd2c08e, culture: 0xaeb07a, prairie: 0xbdb985, labour: 0xc4a77a, colza: 0xbcb76e, foret: 0x76814e };
const ENCRE = 0x2a2018, CREME = 0xefe3c4, ROUGE = 0xa8322a, OR = 0xd9b25e, MER = 0x1c586c, ECUME = 0xbfe0da;  // mer turquoise profonde (web_conquete)
let avecSol = false;  // la carte a une occupation du sol : les aplats administratifs restent dessous
// Teintes passées des départements (aquarelle sur papier)
const PASTELS = [0xdcc9a0, 0xcdc69b, 0xd8bca2, 0xc6c7a2, 0xdfcfae, 0xcbbf98, 0xd3c3a8, 0xc2bf98];

// Préparé une fois par carte (voir decor) : épaisseur de référence, rang des villes, arêtes partagées, côtes
let ech = 1, rangs = () => 0, aretes = new Map(), traces = new Set(), cotes = [];
const cle = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? a + "|" + b : b + "|" + a);
const terreFerme = (e) => e.type === "zone" && e.points && !["mer", "lac", "estuaire"].includes(e.style);

function preparer(carte) {
  const [L, H] = carte.taille;
  // Traits lisibles quelle que soit l'unité du monde : 1 pour une carte de 2 400 de côté, plus au-delà
  ech = Math.max(1, Math.max(L, H) / 2400);
  // Rang d'une ville selon sa place parmi celles de la carte (marche de 300 habitants à 2 millions)
  const valeur = (e) => e.population ?? e.taille ?? 0;
  const tri = carte.entites.filter((e) => e.style === "ville").map(valeur).sort((a, b) => a - b);
  rangs = (e) => {
    const part = tri.filter((v) => v <= valeur(e)).length / (tri.length || 1);
    return part > 0.8 ? 2 : part > 0.4 ? 1 : 0;
  };
  aretes = new Map();
  traces = new Set();
  for (const e of carte.entites.filter(terreFerme)) {
    e.points.forEach((a, i) => {
      const k = cle(a, e.points[(i + 1) % e.points.length]);
      aretes.set(k, [...(aretes.get(k) ?? []), e.style]);
    });
  }
  // Côte = arête d'un seul polygone de terre, sauf le bord découpé de la carte ; chaînée en polylignes
  const bord = (a, b) => (a[0] === b[0] && (a[0] <= 0 || a[0] >= L)) || (a[1] === b[1] && (a[1] <= 0 || a[1] >= H));
  const libres = new Map();
  for (const [k, v] of aretes) {
    if (v.length !== 1) continue;
    const [a, b] = k.split("|").map((p) => p.split(",").map(Number));
    if (bord(a, b)) continue;
    for (const [p, q] of [[a, b], [b, a]]) libres.set(String(p), [...(libres.get(String(p)) ?? []), [k, q]]);
  }
  const vus = new Set();
  cotes = [];
  for (const [depart, liste] of libres) {
    for (const [k0, q0] of liste) {
      if (vus.has(k0)) continue;
      vus.add(k0);
      const ligne = [depart.split(",").map(Number), q0];
      for (let suite = true; suite;) {
        suite = false;
        for (const [k, q] of libres.get(String(ligne.at(-1))) ?? []) {
          if (vus.has(k)) continue;
          vus.add(k);
          ligne.push(q);
          suite = true;
          break;
        }
      }
      cotes.push(ligne);
    }
  }
}

// Morceaux consécutifs d'un polygone fermé dont les arêtes passent le filtre
function troncons(pts, garder) {
  const res = [];
  let cur = null;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    if (!garder(a, b)) return (cur = null);
    if (!cur) res.push((cur = [a]));
    cur.push(b);
  });
  return res;
}

// Tirets continus le long d'une polyligne (le motif ne repart pas à chaque sommet)
function tirets(g, pts, long, vide) {
  let parcouru = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], d = Math.hypot(x2 - x1, y2 - y1);
    const p = (s) => [x1 + ((x2 - x1) * s) / d, y1 + ((y2 - y1) * s) / d];
    // Début du premier motif qui touche ce segment, en abscisse locale
    for (let s = Math.floor(parcouru / (long + vide)) * (long + vide) - parcouru; s < d; s += long + vide) {
      const debut = Math.max(0, s), fin = Math.min(d, s + long);
      if (fin > debut) g.moveTo(...p(debut)).lineTo(...p(fin));
    }
    parcouru += d;
  }
}

function toile(w, h, dessiner) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  dessiner(c.getContext("2d"));
  return P.Texture.from(c);
}

// Motifs répétés, créés une seule fois (sources 2× plus fines que le monde, voir echelle())
const motifs = {};
function motif(nom) {
  return (motifs[nom] ??= {
    // Petites couronnes d'arbres ombrées au sud-est
    foret: () => toile(128, 128, (ctx) => {
      const r = alea("foret");
      for (let i = 0; i < 70; i++) {
        const x = r() * 128, y = r() * 128, t = 3 + r() * 2.5;
        for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [128, 128], [-128, 0], [0, -128]]) {
          ctx.fillStyle = "rgba(40, 45, 25, 0.45)";
          ctx.beginPath(); ctx.arc(x + dx + 1.4, y + dy + 1.4, t, 0, 7); ctx.fill();
          ctx.fillStyle = ["#5d6a3a", "#55613a", "#66733f"][i % 3];
          ctx.beginPath(); ctx.arc(x + dx, y + dy, t, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(200, 200, 140, 0.35)";
          ctx.beginPath(); ctx.arc(x + dx - t / 3, y + dy - t / 3, t / 3, 0, 7); ctx.fill();
        }
      }
    }),
    // Petites vagues dispersées en quinconce
    vagues: () => toile(128, 128, (ctx) => {
      ctx.strokeStyle = "rgba(170, 200, 205, 0.28)";
      ctx.lineWidth = 1.6;
      for (const [x, y] of [[10, 20], [74, 52], [30, 86], [94, 118], [60, 4]]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y - 5, x + 12, y);
        ctx.quadraticCurveTo(x + 18, y + 5, x + 24, y);
        ctx.stroke();
      }
    }),
  }[nom]());
}

// Remplissage par motif répété en coordonnées du monde : `taille` unités de monde par pixel du motif
function echelle(nom, taille) {
  const m = new P.FillPattern(motif(nom), "repeat");
  m.setTransform(new P.Matrix().scale(taille, taille));
  return m;
}

function terre(g, e) {
  // Les zones débordent un peu pour effacer les chemins : à cette échelle on voit des terroirs, pas des parcelles
  if (e.points) forme(g, e).fill(TERRES[e.style] ?? 0xc8b88a);
  else g.rect(e.x - 4, e.y - 4, e.w + 8, e.h + 8).fill(TERRES[e.style] ?? 0xc8b88a);
}

function foret(g, e) {
  terre(g, e);
  if (e.points) forme(g, e).fill(echelle("foret", 0.5 * ech));
  else g.rect(e.x - 4, e.y - 4, e.w + 8, e.h + 8).fill(echelle("foret", 0.5 * ech));
}

// Polygones administratifs : contour côtier à l'encre, frontières partagées en tirets tracées une seule fois
function contours(g, e, couleur, largeur) {
  const k = (a, b) => cle(a, b);
  for (const t of troncons(e.points, (a, b) => aretes.get(k(a, b))?.length === 1)) trait(g, t, { width: 1.3 * ech, color: ENCRE, alpha: 0.8 });
  const neuves = (a, b) => aretes.get(k(a, b))?.length > 1 && !traces.has(k(a, b));
  for (const t of troncons(e.points, neuves)) {
    const etat = t.some((p, i) => i && new Set(aretes.get(k(t[i - 1], p))).size > 1);  // limite avec un pays : plus marquée
    t.forEach((p, i) => i && traces.add(k(t[i - 1], p)));
    tirets(g, t, 6 * ech, 4 * ech);
    g.stroke({ width: (etat ? 2.2 : largeur) * ech, color: couleur, alpha: etat ? 0.9 : 0.75 });
  }
}

function departement(g, e) {
  const c = e.couleur ? P.Color.shared.setValue(e.couleur).toNumber() : PASTELS[Math.floor(alea(e.id)() * PASTELS.length)];
  if (!e.points) return terre(g, e);
  forme(g, e).fill(c);
}

function pays(g, e) {
  if (!e.points) return g.rect(e.x, e.y, e.w, e.h).fill(0xbdb6a6);
  forme(g, e).fill(0xbdb6a6 - Math.floor(alea(e.id)() * 3) * 0x060606);
}

// Au-dessus de l'occupation du sol : limites à l'encre, pays voisins voilés de gris
const bordure = {
  departement(g, e) {
    if (!e.points) return;
    // Sur l'occupation du sol, un trait continu sous les tirets garde les limites lisibles (forêts sombres)
    if (avecSol) trait(g, [...e.points, e.points[0]], { width: 2.4 * ech, color: CREME, alpha: 0.35 });
    contours(g, e, 0x5a3a24, 1.1);
  },
  pays(g, e) {
    if (!e.points) return;
    if (avecSol) forme(g, e).fill({ color: 0xbdb6a6, alpha: 0.72 });
    contours(g, e, 0x6e675c, 0.9);
  },
};

// Contour décalé de d vers l'intérieur d'un polygone (lignes de vagues parallèles à la côte)
function decale(points, d) {
  const n = points.length;
  let aire = 0;
  for (let i = 0; i < n; i++) aire += points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1];
  const s = Math.sign(aire) || 1;
  const normale = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [(-dy / l) * s, (dx / l) * s];
  };
  const res = points.map((p, i) => {
    const n1 = normale(points[(i - 1 + n) % n], p), n2 = normale(p, points[(i + 1) % n]);
    const mx = n1[0] + n2[0], my = n1[1] + n2[1], l = Math.hypot(mx, my) || 1;
    const k = d / Math.max(0.4, (mx * n1[0] + my * n1[1]) / l);
    return [p[0] + (mx / l) * k, p[1] + (my / l) * k];
  });
  return [...res, res[0]];
}

function eau(anneaux, couleur = MER) {
  return (g, e) => {
    forme(g, e).fill(couleur);
    forme(g, e).fill(echelle("vagues", 1.2 * ech));
    if (!e.points) {
      // Mer de fond (rectangle sous les terres) : anneaux autour des côtes, la moitié côté terre sera recouverte
      if (e.w * e.h <= 0) return;
      for (const d of [...anneaux].reverse()) {
        for (const c of cotes) trait(g, c, { width: 2 * d * ech + 1.4 * ech, color: ECUME, alpha: 0.45 });
        for (const c of cotes) trait(g, c, { width: 2 * d * ech - 1.4 * ech, color: MER });
      }
      return;
    }
    const b = boite(e), pts = e.points;
    anneaux.filter((d) => d * ech < Math.min(b.w, b.h) / 4)
      .forEach((d, i) => trait(g, decale(pts, d * ech), { width: 1.4 * ech, color: ECUME, alpha: 0.55 - i * 0.09 }));
    // Liseré côtier : sable clair puis trait d'encre
    trait(g, [...pts, pts[0]], { width: 5 * ech, color: 0xd8cca4, alpha: 0.8 });
    trait(g, [...pts, pts[0]], { width: 1.2 * ech, color: ENCRE, alpha: 0.7 });
  };
}

// Angle du segment le plus proche d'un point, ramené entre -90° et 90° pour rester lisible
function angleProche(points, x, y) {
  let best = Infinity, angle = 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i];
    const d = Math.hypot((x1 + x2) / 2 - x, (y1 + y2) / 2 - y);
    if (d < best) [best, angle] = [d, Math.atan2(y2 - y1, x2 - x1)];
  }
  // Un tracé vertical se lit de bas en haut, comme sur les cartes anciennes
  if (angle > Math.PI * 0.45) angle -= Math.PI;
  if (angle < -Math.PI * 0.55) angle += Math.PI;
  return angle;
}

// Nom de bourg ou de village : petites capitales claires sur un halo sombre, sans plaque (web_conquete)
function nomVillage(texte, rang) {
  const t = new P.Text({ text: texte.toUpperCase(), style: { fontFamily: SERIF, fontSize: rang ? 11 : 9.5, fontWeight: "700",
    fill: 0xf4ecd6, letterSpacing: 0.6, stroke: { color: 0x241c14, width: 3, join: "round" } } });
  t.anchor.set(0.5);
  return t;
}

// Pastille sombre à liseré doré (population, effectif)
function pastille(texte, taille = 11) {
  const c = new P.Container();
  const t = new P.Text({ text: texte, style: { fontFamily: SERIF, fontSize: taille, fontWeight: "700", fill: CREME } });
  t.anchor.set(0.5);
  const w = Math.max(t.height + 4, t.width + 10), h = t.height + 4;
  c.addChild(new P.Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0x1d1a17, alpha: 0.95 }).stroke({ width: 1.5, color: OR }), t);
  return c;
}

// Étiquette de lieu : capitales à empattements sur fond sombre à liseré rouge
// (préfecture / chef-lieu : étoile dorée et liseré doublé)
function cartouche(texte, taille, chefLieu) {
  const c = new P.Container();
  const t = new P.Text({ text: (chefLieu ? "★ " : "") + texte.toUpperCase(), style: { fontFamily: SERIF, fontSize: taille, fontWeight: "600", fill: CREME, letterSpacing: 1.5 } });
  t.anchor.set(0.5);
  const w = t.width + 16, h = t.height + 6;
  const g = new P.Graphics().roundRect(-w / 2, -h / 2, w, h, 2).fill({ color: 0x221e1b, alpha: 0.92 })
    .stroke({ width: chefLieu ? 2.2 : 1.5, color: ROUGE }).roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 1).stroke({ width: 0.6, color: OR, alpha: chefLieu ? 0.9 : 0.5 });
  c.addChild(g, t);
  return c;
}

// Voies selon l'année (epoque.js routeDe) : vraie largeur (m) mais au moins px à l'écran. Sentier de terre en tirets,
// chemin de terre claire (web_conquete), route royale empierrée bordée d'encre, route goudronnée jaune, carte routière
// moderne (grands axes rouges, petites routes blanches), en 2100 routes vertes bordées d'arbres
function routeCarte(g, e, metres, px) {
  const w = largeur(metres / vue.echelle, px), grand = metres > 10, z = vue.zoom;
  let aspect = routeDe();
  if (aspect === "empierree" && !grand) aspect = "terre";  // seules les routes royales sont empierrées
  if (aspect === "sentier") return rayures(g, e.points, "moitie", 7 / z, 0x5a3c22, { width: w, alpha: grand ? 0.9 : 0.7 });
  if (aspect === "terre") return trait(g, e.points, { width: w, color: 0xe9dcb4, alpha: grand ? 0.85 : 0.6 });
  const [bord, fort, faible] = { empierree: [0x4a3624, 0xf3e6c2], goudron: [0x3a3030, 0xe8b850, 0xf2ead6],
    moderne: [0x3a3030, 0xd0503a, 0xf2ead6], verte: [0x2c4424, 0xc9d68a, 0xd8e6b4] }[aspect];
  if (aspect === "verte" && grand && w * z > 3) alignement(g, e.points, w, Math.max(8 / vue.echelle, 2.4 / z), 0x3d6a2e);
  trait(g, e.points, { width: w + 1.2 / z, color: bord, alpha: aspect === "empierree" ? 0.75 : 0.55 });
  trait(g, e.points, { width: w, color: grand ? fort : faible });
}

// Voie ferrée : de loin, trait d'encre et tirets clairs alternés comme sur une carte (LGV en rouge, plus épaisse) ;
// de près (largeur exagérée, 22 m), ballast, traverses et rails
const VOIE = { ballast: 0x8e877a, traverse: 0x5a4430, rail: 0x2a2622 };
function rail(g, e, metres, px, encre, teintes) {
  const z = vue.zoom, pm = z / vue.echelle;  // pixels par mètre
  if (22 * pm >= 6) return voieDePres(g, e.points, 22 / vue.echelle, metres > 8, teintes);
  const w = largeur(metres / vue.echelle, px);
  trait(g, e.points, { width: w, color: encre });
  rayures(g, e.points, "moitie", 10 / z, CREME, { width: w * 0.5 });
}

// Autoroute : liseré sombre, chaussées rouges (carte routière), terre-plein central jaune entre les deux chaussées
function autorouteCarte(g, e) {
  const z = vue.zoom, w = largeur(32 / vue.echelle, 3.2);
  if (routeDe() === "verte" && w * z > 5) alignement(g, e.points, w, Math.max(8 / vue.echelle, 2.4 / z), 0x3d6a2e);
  trait(g, e.points, { width: w + 1.6 / z, color: 0x4a1612, alpha: 0.85 });
  trait(g, e.points, { width: w, color: 0xc8322a });
  trait(g, e.points, { width: Math.max(w * 0.14, 0.8 / z), color: 0xf6d860 });
}

// Voie romaine : chaussée pavée ocre, rectiligne, bordée d'encre ; de près, les dalles
function voieRomaineCarte(g, e) {
  const z = vue.zoom, w = largeur(8 / vue.echelle, 1.8);
  trait(g, e.points, { width: w + 1.4 / z, color: 0x4a3020, alpha: 0.85 });
  trait(g, e.points, { width: w, color: 0xcfa86c });
  if (w * z > 5) rayures(g, e.points, "paves", w / 2, 0x7a5a3a, { width: w, alpha: 0.6 });
}

// Icônes de lieux habités, à l'échelle de l'écran, selon l'époque (vue.epoque) et le rang de la ville.
// Ancien : 0 hameau, 1 bourg à clocher, 2 ville à château
const ICONES = [
  (g) => g.rect(-6, -3, 12, 8).fill(CREME).stroke({ width: 1.3, color: ENCRE })
    .poly([-8, -3, 0, -10, 8, -3]).fill(ROUGE).stroke({ width: 1.3, color: ENCRE }),
  (g) => g.rect(-10, -2, 14, 9).fill(CREME).stroke({ width: 1.3, color: ENCRE })
    .poly([-11, -2, -3, -8, 5, -2]).fill(ROUGE).stroke({ width: 1.3, color: ENCRE })
    .rect(4, -8, 7, 15).fill(CREME).stroke({ width: 1.3, color: ENCRE })
    .poly([3, -8, 7.5, -19, 12, -8]).fill(0x5a4632).stroke({ width: 1.3, color: ENCRE })
    .moveTo(7.5, -19).lineTo(7.5, -24).moveTo(5.5, -22).lineTo(9.5, -22).stroke({ width: 1.2, color: ENCRE }),
  (g) => {
    g.rect(-11, -6, 22, 14).fill(CREME).stroke({ width: 1.3, color: ENCRE });
    for (const x of [-15, 9]) {
      g.rect(x, -12, 6, 20).fill(CREME).stroke({ width: 1.3, color: ENCRE });
      g.rect(x, -15, 2, 3).rect(x + 4, -15, 2, 3).fill(ENCRE);
    }
    for (let x = -9; x < 9; x += 4) g.rect(x, -9, 2, 3).fill(ENCRE);
    g.roundRect(-3, 1, 6, 7, 3).fill(ENCRE)
      .moveTo(0, -6).lineTo(0, -20).stroke({ width: 1.2, color: ENCRE }).poly([0, -20, 9, -17, 0, -14]).fill(ROUGE);
  },
];
// Moderne : 0 pavillons, 1 petite ville (immeubles), 2 grande ville (tours)
const BETON = 0xd9dde0, VITRE = 0x5d7a92;
const immeuble = (g, x, y, w, h) => {
  g.rect(x, y - h, w, h).fill(BETON).stroke({ width: 1.2, color: ENCRE });
  for (let yy = y - h + 3; yy < y - 3; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3.5) g.rect(xx, yy, 1.6, 2).fill(VITRE);
};
const ICONES_MODERNES = [
  (g) => g.rect(-8, -2, 7, 7).rect(1, -4, 8, 9).fill(0xefe9de).stroke({ width: 1.2, color: ENCRE })
    .rect(-8, -4, 7, 2).rect(1, -6, 8, 2).fill(0x8a5a4a),
  (g) => { immeuble(g, -12, 7, 8, 11); immeuble(g, -3, 7, 8, 17); immeuble(g, 6, 7, 7, 9); },
  (g) => { immeuble(g, -16, 7, 7, 13); immeuble(g, -8, 7, 8, 24); immeuble(g, 1, 7, 7, 30); immeuble(g, 9, 7, 7, 17); },
];

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const habitants = (n) => (n >= 10000 ? compact.format(n) : n.toLocaleString("fr-FR"));

function medaillon(e, dessinInterieur) {
  const c = new P.Container();
  const coul = P.Color.shared.setValue(e.couleur ?? 0x2b3f7a).toNumber();
  const g = new P.Graphics().circle(1.5, 2, 19).fill({ color: 0x000000, alpha: 0.35 })
    .circle(0, 0, 19).fill(coul).stroke({ width: 3, color: OR }).circle(0, 0, 21).stroke({ width: 1, color: ENCRE });
  dessinInterieur(g);
  c.addChild(g);
  return c;
}

const decorCarte = decor("carte", { force: 0.45, teinte: true, vignette: 0.4, papier: true });
// Sur un fond peint (occupation du sol), il est déjà ombré : relief et papier discrets, pas de teinte orangée
const decorPeint = decor("carte-peinte", { force: 0.12, teinte: false, vignette: 0.22, papier: false });

export const carte = {
  nom: "Carte", css: "carte", fond: 0x22343f, base: 0xcbb98a, unitesTailleFixe: true,
  orientation: () => 0,
  decor(rendu, carte) {
    preparer(carte);
    avecSol = Boolean(carte.occupation?.lignes?.length);
    return avecSol ? { ...decorPeint(rendu, carte), terrain: terrain(carte) } : decorCarte(rendu, carte);
  },
  bordure,

  zone: {
    ...Object.fromEntries(Object.keys(TERRES).map((k) => [k, terre])),
    foret, departement, pays, mer: eau([9, 20, 34, 52]), lac: eau([6, 13], 0x4f86a8), estuaire: eau([], MER), _: terre,
  },

  ligne: {
    haie(g, e) { trait(g, e.points, { width: 2 * ech, color: 0x6b7340, alpha: 0.35 }); },
    // Fleuve : `largeur` (unités du monde, nombre ou une par point) si fournie, sinon 8 ; liseré clair et reflet au milieu
    // Eau bleue entre des berges vertes, reflet clair au fil de l'eau (web_conquete) ; jamais plus fine que px à l'écran
    riviere(g, e) {
      const l = e.largeur ?? 8, px = [2, 4, 2.6, 1.7, 1.3][e.rang ?? 0], z = vue.zoom;
      traitVariable(g, e.points, l, { color: 0x34619a }, 1, 1.2 / z, (px + 1.2) / z);
      traitVariable(g, e.points, l, { color: 0x4a7fc0 }, 1, 0, px / z);
      if (z * l > 5) traitVariable(g, e.points, l, { color: 0x9cc0ea, alpha: 0.55 }, 0.15, 0, 0.9 / z);
    },
    route(g, e) { routeCarte(g, e, 14, 1.6); },
    chemin(g, e) { routeCarte(g, e, 6, 1); },
    voie_romaine: voieRomaineCarte,
    voie_ferree(g, e) { rail(g, e, e.rang === 2 ? 6 : 10, e.rang === 2 ? 1.6 : 2.4, ENCRE, VOIE); },
    lgv(g, e) { rail(g, e, 14, 3, 0x9a1e24, { ...VOIE, traverse: 0xd8d2c4, ballast: 0xb4aea2 }); },
    autoroute: autorouteCarte,
    ligne_electrique(g, e) {
      const k = ech;
      trait(g, e.points, { width: 1.8 * k, color: ENCRE, alpha: 0.85 });
      lelong(e.points, 50 * k, (x, y) => g.moveTo(x - 5 * k, y - 3 * k).lineTo(x + 5 * k, y - 3 * k).moveTo(x, y - 6 * k).lineTo(x, y + 4 * k).stroke({ width: 2 * k, color: ENCRE }));
    },
    canalisation(g, e) {
      trait(g, e.points, { width: 6 * ech, color: 0xe6d6ae, alpha: 0.7 });
      pointilles(g, e.points, 8 * ech, 6 * ech, { width: 3 * ech, color: 0x2f5f86 });
    },
    // Frontière en lueur colorée
    frontiere(g, e) {
      const c = P.Color.shared.setValue(e.couleur ?? "#9b4dca").toNumber();
      for (const [w, a] of [[46, 0.07], [30, 0.1], [18, 0.16], [9, 0.3]]) trait(g, e.points, { width: w * ech, color: c, alpha: a });
      trait(g, e.points, { width: 3 * ech, color: c, alpha: 0.95 });
      trait(g, e.points, { width: ech, color: 0xffffff, alpha: 0.5 });
    },
    _(g, e) { trait(g, e.points, { width: 3 * ech, color: 0x5a4a3a }); },
  },

  batiment: {
    ville(e) {
      // Au sol : la tache bâtie (emprise réelle) ; à l'écran : icône de l'époque, nom et population
      const g = new P.Graphics(), r = alea(e.id), t = e.taille ?? 60, n = rangs(e), moderne = vue.epoque === "moderne";
      const ilots = Math.round(6 + 3 * Math.sqrt(t)), b = t / 7;
      for (let i = 0; i < ilots; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * t * 0.42;
        g.rect(e.x + Math.cos(a) * d - b / 2, e.y + Math.sin(a) * d - b / 2, b * (0.6 + r() * 0.8), b * (0.5 + r() * 0.7));
      }
      g.fill({ color: moderne ? 0x6a6670 : 0x7a3a2c, alpha: 0.55 });
      if (avecSol) g.clear();  // la ville est peinte dans l'occupation du sol (cases « u »)
      const lab = new P.Container();
      const icone = new P.Graphics();
      (moderne ? ICONES_MODERNES : ICONES)[n](icone);
      const nom = n === 2 || e.prefecture ? cartouche(e.nom, n === 2 ? 14 : 12, e.prefecture) : nomVillage(e.nom, n);
      nom.y = n === 2 || e.prefecture ? 22 : 16;
      lab.addChild(icone, nom);
      if (e.population != null && n === 2) {
        const pop = pastille(habitants(e.population));
        pop.position.set(nom.width / 2 + pop.width / 2 - 2, 22 - nom.height / 2 - 2);
        lab.addChild(pop);
      }
      lab.position.set(e.x, e.y);
      return { dessin: g, etiquette: lab };
    },
    eolienne(e) {
      const c = new P.Container();
      c.position.set(e.x, e.y);
      const rotor = new P.Graphics();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        const p = (k, l) => [Math.cos(a + k) * l, Math.sin(a + k) * l];
        rotor.poly([0, 0, ...p(-0.12, 10), ...p(-0.04, 18), ...p(0.06, 18)]).fill(CREME).stroke({ width: 1.2, color: ENCRE });
      }
      rotor.circle(0, 0, 2.5).fill(ENCRE);
      rotor.position.set(0, -14);
      c.addChild(new P.Graphics().ellipse(0, 14, 8, 3).fill({ color: ENCRE, alpha: 0.35 })
        .poly([-2.5, 14, -1, -14, 1, -14, 2.5, 14]).fill(CREME).stroke({ width: 1.2, color: ENCRE }), rotor);
      return { dessin: c, animer: (dt, ctx) => { rotor.rotation += dt * Math.min(25, ctx.vent(e.x, e.y)) * 0.5; } };
    },
    transformateur(e) {
      const g = new P.Graphics().rect(e.x - 10, e.y - 9, 22, 20).fill({ color: ENCRE, alpha: 0.3 })
        .rect(e.x - 11, e.y - 11, 22, 20).fill(CREME).stroke({ width: 1.5, color: ENCRE })
        .poly([e.x + 2, e.y - 8, e.x - 5, e.y + 1, e.x, e.y + 1, e.x - 2, e.y + 7, e.x + 5, e.y - 2, e.x, e.y - 2]).fill(ROUGE);
      return { dessin: g };
    },
    hangar(e) {
      const g = new P.Graphics().rect(e.x - 25, e.y - 13, 54, 32).fill({ color: ENCRE, alpha: 0.3 })
        .rect(e.x - 28, e.y - 16, 56, 32).fill(0xb08a62).stroke({ width: 1.5, color: ENCRE });
      for (let x = -22; x < 28; x += 7) g.moveTo(e.x + x, e.y - 16).lineTo(e.x + x - 6, e.y + 16);
      g.stroke({ width: 1, color: ENCRE, alpha: 0.45 }).moveTo(e.x - 28, e.y).lineTo(e.x + 28, e.y).stroke({ width: 1.5, color: ENCRE });
      return { dessin: g };
    },
    _(e) {
      const g = new P.Graphics().circle(e.x, e.y, 8).fill(0x5a3a2a).stroke({ width: 2, color: CREME });
      const lab = e.nom ? etiquette(e.nom, { fontFamily: SERIF, fontSize: 13, fill: CREME }, { color: 0x221e1b, alpha: 0.9 }, ROUGE) : null;
      lab?.position.set(e.x, e.y + 24);
      return { dessin: g, etiquette: lab };
    },
  },

  unite: {
    // Médaillon à l'uniforme (bicorne et buste) et effectif en dessous
    regiment(e) {
      const c = medaillon(e, (g) => g.circle(0, -3, 5).fill(CREME)
        .poly([-10, -6, 0, -12, 10, -6, 6, -5, -6, -5]).fill(ENCRE)
        .poly([-10, 14, -8, 4, 0, 1, 8, 4, 10, 14]).fill(CREME).rect(-1, 3, 2, 11).fill(ROUGE));
      if (e.effectif != null) {
        const p = pastille(String(e.effectif), 12);
        p.y = 27;
        c.addChild(p);
      }
      return c;
    },
    tracteur: () => null,
    _(e) {
      const c = medaillon(e, () => {});
      if (e.nom) {
        const t = new P.Text({ text: e.nom[0].toUpperCase(), style: { fontFamily: SERIF, fontSize: 18, fontWeight: "700", fill: CREME } });
        t.anchor.set(0.5);
        c.addChild(t);
      }
      return c;
    },
  },

  nomLieu(e) {
    if (e.constructible) return null;  // « Route », « Canalisation » : le nom du modèle n'apprend rien sur la carte
    const halo = { color: 0xe9dfc2, width: 3, join: "round" };
    let t;
    if (e.style === "mer") {
      t = nomLieu(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 34, fontStyle: "italic", fill: 0xb9ced3, letterSpacing: 12 });
      t.alpha = 0.85;
    } else if (e.style === "lac" || e.style === "estuaire") {
      t = nomLieu(e.nom, { fontFamily: SERIF, fontSize: 14, fontStyle: "italic", fill: 0xdfe9ea, stroke: { color: MER, width: 3, join: "round" }, letterSpacing: 1 });
    } else if (e.style === "riviere") {
      t = nomLieu(e.nom, { fontFamily: SERIF, fontSize: 13, fontStyle: "italic", fontWeight: "600", fill: 0x24465e, stroke: halo, letterSpacing: 1.5 });
    } else if (e.style === "departement") {
      t = new P.Container();
      const nom = nomLieu(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 11, fill: 0x4a3420, stroke: halo, letterSpacing: 3 });
      t.addChild(nom);
      if (e.code) {
        const code = nomLieu(e.code, { fontFamily: SERIF, fontSize: 11, fontStyle: "italic", fill: 0x8a3a2a, stroke: halo });
        code.y = nom.height * 0.9;
        t.addChild(code);
      }
    } else if (e.style === "pays") {
      t = nomLieu(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 13, fill: 0x7d776c, stroke: { ...halo, color: 0xd6d0c2 }, letterSpacing: 6 });
    } else if (e.type === "zone") {
      t = nomLieu(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 14, fill: 0x4a3a28, stroke: halo, letterSpacing: 5 });
    } else {
      t = nomLieu(e.nom, { fontFamily: SERIF, fontSize: 13, fontStyle: "italic", fill: 0x4a3a28, stroke: halo });
    }
    // Les mers suivent leur côte, les lignes leur tracé (posées au-dessus du trait)
    if (e.points && (e.type === "ligne" || e.style === "mer")) {
      const m = e.points[e.points.length >> 1];
      t.rotation = angleProche(e.points, ...(e.ancre ?? m));
      if (e.type === "ligne") t.anchor.set(0.5, 1.2);
    }
    return t;
  },
};
