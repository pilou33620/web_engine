// Détails de près, à la manière de web_conquete : arbres un par un (ombre portée au sud-est, reflet au nord-ouest),
// champs en parcelles avec leurs sillons, rangs de vigne, buissons des landes. Peints par tuiles de 256 px quand le
// zoom dépasse ~14 px/km, une tuile par image au plus, gardés en cache ; le fond (decor.js terrain) reste dessous.
// Tout vient d'une grille absolue en km : deux tuiles voisines se raccordent sans couture.
import { paysage, bruit, SOLS, hash, parcelles, culture } from "./decor.js";
import { vue } from "./outils.js";
import { genererPlan, dessinerPlan } from "./villes.js";

const P = window.PIXI;
const TUILE = 256, CACHE = 96, SEUIL = 14;
const TAU = Math.PI * 2;
const BOIS = ["#2f5e2c", "#3a6c34", "#45793c", "#2b5427", "#518644"], PIN = "#2f5a33", OMBRE = "rgba(20,32,12,.42)";
export class Details {
  constructor(rendu, carte) {
    this.rendu = rendu;
    this.km = (carte.echelle ?? 1) / 1000;  // km par unité du monde
    this.P = paysage(carte);
    this.conteneur = new P.Container();
    this.tuiles = new Map();  // clé → { sprite, vue }
    this.horloge = 0;
    // villes dessinées en plan : centre et rayon en km
    // rayon du plan (km) : villes serrées d'autrefois, agglomérations étalées d'aujourd'hui
    const moderne = vue.epoque === "moderne", km = this.km;
    this.epoque = moderne ? "moderne" : "ancien";
    this.plans = new Map();
    // rivières (km) pour garder l'eau libre de maisons : segments et demi-largeur
    this.rivieres = carte.entites.filter((e) => e.style === "riviere").map((e) => {
      const l = Array.isArray(e.largeur) ? Math.max(...e.largeur) : e.largeur ?? 2;
      const pts = e.points.map(([x, y]) => [x * km, y * km]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { pts, w: Math.max(0.03, (l * km) / 2), boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
    // les routes qui arrivent à chaque ville donnent ses axes
    const bouts = [];
    for (const r of carte.entites) {
      if (r.style !== "route" && r.style !== "chemin") continue;
      const p = r.points;
      bouts.push([p[0], p[1]], [p.at(-1), p.at(-2)]);
    }
    this.villes = carte.entites.filter((e) => e.style === "ville").map((e) => ({
      x: e.x * km, y: e.y * km,
      r: moderne ? ((e.taille ?? 0) * km) / 2.2 : 0.12 * Math.sqrt((e.population ?? 2000) / 1000),
      axes: bouts.filter(([a]) => Math.hypot(a[0] - e.x, a[1] - e.y) < 1.5).map(([a, b]) => Math.atan2(b[1] - a[1], b[0] - a[0])),
      murs: e.prefecture || e.population > 15000, graine: Math.round(e.x * 7 + e.y) }));
  }

  // Code d'occupation en un point exprimé en km
  code(x, y) {
    const c = this.P.codeA(x / this.km, y / this.km);
    return c === "u" && vue.epoque !== "moderne" ? "c" : c;  // autrefois, les champs venaient jusqu'aux remparts
  }

  image() {
    const r = this.rendu, pxKm = (r.zoom * devicePixelRatio) / this.km;
    if (pxKm < SEUIL) return (this.conteneur.visible = false);
    this.conteneur.visible = true;
    const L = 2 ** Math.min(9, Math.max(4, Math.round(Math.log2(pxKm)))), span = TUILE / L;  // px/km de la tuile, km de côté
    const { width: w, height: h } = r.app.screen, a = r.versMonde(0, 0), b = r.versMonde(w, h);
    const tx0 = Math.floor((a.x * this.km) / span), tx1 = Math.floor((b.x * this.km) / span);
    const ty0 = Math.floor((a.y * this.km) / span), ty1 = Math.floor((b.y * this.km) / span);
    const vues = new Set();
    let peinte = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cle = `${L}|${tx}|${ty}`;
        vues.add(cle);
        let t = this.tuiles.get(cle);
        if (!t && !peinte) {
          peinte = true;  // une tuile par image : la carte reste fluide pendant qu'elle se détaille
          t = { sprite: this.peindre(L, tx, ty) };
          this.tuiles.set(cle, t);
          this.conteneur.addChild(t.sprite);
        }
        if (t) t.vue = ++this.horloge;
      }
    }
    for (const [cle, t] of this.tuiles) t.sprite.visible = vues.has(cle);
    if (this.tuiles.size > CACHE) {
      const vieilles = [...this.tuiles].sort((x, y) => x[1].vue - y[1].vue).slice(0, this.tuiles.size - CACHE);
      for (const [cle, t] of vieilles) {
        t.sprite.destroy({ texture: true, textureSource: true });
        this.tuiles.delete(cle);
      }
    }
  }

  peindre(L, tx, ty) {
    const span = TUILE / L, x0 = tx * span, y0 = ty * span, x1 = x0 + span, y1 = y0 + span;
    const toile = document.createElement("canvas");
    toile.width = toile.height = TUILE;
    const g = toile.getContext("2d");
    g.setTransform(L, 0, 0, L, -x0 * L, -y0 * L);  // on dessine en km
    if (L >= 24) this.champs(g, L, x0, y0, x1, y1);
    this.batiments(g, L, x0, y0, span);
    this.arbres(g, L, x0, y0, span);
    const s = new P.Sprite(P.Texture.from(toile));
    s.position.set(x0 / this.km, y0 / this.km);
    s.setSize(span / this.km, span / this.km);
    return s;
  }

  // Champs : fond, grain, sillons, tournières ; vignes en rangs de ceps. Un tracé par couleur.
  champs(g, L, x0, y0, x1, y1) {
    const u = 0.6 / Math.min(L, 64), lots = new Map();
    const lot = (cle) => lots.get(cle) ?? lots.set(cle, new Path2D()).get(cle);
    parcelles(x0, y0, x1, y1, (x, y, w, h, hh) => {
      // Une parcelle entière sur la terre ferme (les quatre coins), sinon le fond suffit
      const coins = [this.code(x, y), this.code(x + w, y), this.code(x, y + h), this.code(x + w, y + h)];
      const t = this.code(x + w / 2, y + h / 2);
      if (coins.includes(".") || !(t === "c" || t === "p" || t === "v") || coins.some((c) => c === "f")) return;
      const px = x + 0.7 * u, py = y + 0.7 * u, pw = w - 1.4 * u, ph = h - 1.4 * u, dirH = (hh * 13) % 1 < 0.5;
      if (t === "v") {
        lot("f|#b39b6c").rect(px, py, pw, ph);
        const rangs = lot(`s|#4a6f2e|${1.3 * u}`), e = 2.6 * u;
        if (dirH) for (let yy = py + 1.5 * u; yy < py + ph; yy += e) rangs.moveTo(px, yy), rangs.lineTo(px + pw, yy);
        else for (let xx = px + 1.5 * u; xx < px + pw; xx += e) rangs.moveTo(xx, py), rangs.lineTo(xx, py + ph);
        return;
      }
      const sol = culture(t, x, y, hh);
      const [base, raie, pas, ep] = SOLS[sol];
      lot(`f|${base}`).rect(px, py, pw, ph);
      const sillons = lot(`s|${raie}|${ep * u}`), e = pas * u;
      if (dirH) for (let yy = py + e / 2; yy < py + ph; yy += e) sillons.moveTo(px, yy), sillons.lineTo(px + pw, yy);
      else for (let xx = px + e / 2; xx < px + pw; xx += e) sillons.moveTo(xx, py), sillons.lineTo(xx, py + ph);
      // grain du sol : quelques taches claires et sombres
      const clair = lot("a|rgba(255,245,215,.16)"), sombre = lot("a|rgba(40,30,15,.12)");
      for (let i = 0, n = (pw * ph) / (u * u * 900); i < n; i++) {
        const a = hash(i, Math.floor(hh * 1e6), 11), b = hash(i, Math.floor(hh * 1e6), 12), r = (6 + 12 * hash(i, 3, 13)) * u;
        const p = a < 0.5 ? clair : sombre, cx = px + hash(i, 5, Math.floor(hh * 1e6)) * pw, cy = py + b * ph;
        p.moveTo(cx + r, cy);
        p.ellipse(cx, cy, r, r * 0.6, a * 3, 0, TAU);
      }
      lot(`h|rgba(245,235,200,.35)|${1.4 * u}`).rect(px + 0.7 * u, py + 0.7 * u, pw - 1.4 * u, ph - 1.4 * u);
    });
    // Les fonds d'abord, puis les tracés : sillons et grain par-dessus
    for (const ordre of ["f", "s", "a", "h"]) {
      for (const [cle, p] of lots) {
        const [op, c, lw] = cle.split("|");
        if (op !== ordre) continue;
        if (op === "f" || op === "a") { g.fillStyle = c; g.fill(p); }
        else { g.strokeStyle = c; g.lineWidth = +lw; g.stroke(p); }
      }
    }
  }

  // Eau pour les plans de ville : mer et lacs de l'occupation du sol, rivières (avec une marge de berge)
  eau(x, y) {
    if (this.P.codeA(x / this.km, y / this.km) === ".") return true;
    for (const r of this.rivieres) {
      const [a, b, c, d] = r.boite;
      if (x < a - r.w || x > c + r.w || y < b - r.w || y > d + r.w) continue;
      for (let i = 1; i < r.pts.length; i++) {
        const [x1, y1] = r.pts[i - 1], [x2, y2] = r.pts[i], dx = x2 - x1, dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(x - x1 - t * dx, y - y1 - t * dy) < r.w + 0.006) return true;
      }
    }
    return false;
  }

  // Villes : plans organiques (villes.js), générés une fois par ville quand une tuile les montre
  batiments(g, L, x0, y0, span) {
    const eau = (x, y) => this.eau(x, y);
    for (const v of this.villes) {
      const m = v.r * 2.2;
      if (v.x + m < x0 || v.x - m > x0 + span || v.y + m < y0 || v.y - m > y0 + span) continue;
      let plan = this.plans.get(v);
      if (!plan) this.plans.set(v, (plan = genererPlan(v, eau, this.epoque)));
      dessinerPlan(g, plan, x0, y0, x0 + span, y0 + span, 1 / L, eau);
    }
  }

  // Bois : houppiers ronds là où le fond dit forêt (et quelques arbres isolés ailleurs) ; ombre, feuillage, reflet
  arbres(g, L, x0, y0, span) {
    // de très près, des arbres à leur vraie taille (plus petits et plus nombreux) au lieu de houppiers géants
    const reduc = Math.max(0.15, Math.min(1, 64 / L)), pas = 3 / L, M = Math.ceil((0.13 * reduc) / pas) + 1, a2 = pas * pas;
    const gi0 = Math.floor(x0 / pas) - M, gj0 = Math.floor(y0 / pas) - M, n = Math.ceil(span / pas) + 2 * M + 1;
    const pts = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gi = gi0 + i, gj = gj0 + j, x = (gi + 0.5) * pas, y = (gj + 0.5) * pas, t = this.code(x, y);
        const densite = t === "f" ? 190 : t === "l" ? 14 : t === "p" ? 3 : t === "c" ? 0.6 : t === "v" ? 0.3 : 0;  // arbres par km²
        if (!densite || hash(gi, gj, L) >= (densite / (reduc * reduc)) * a2) continue;
        const ax = x + (hash(gj, gi, 3) - 0.5) * pas, ay = y + (hash(gi, gj, 4) - 0.5) * pas;
        // grands massifs de pins (une dizaine de km), lisières mêlées de feuillus
        const pin = t === "l" || (t === "f" && bruit(x, y, 12, 30) * 0.8 + bruit(x, y, 0.6, 31) * 0.35 < 0.5);
        const r = (pin ? 0.055 : 0.085) * (0.75 + hash(gi, gj, 5) * 0.6) * reduc;
        pts.push([ax, ay, r, pin ? PIN : BOIS[Math.floor(hash(gi, gj, 6) * BOIS.length)]]);
      }
    }
    if (!pts.length) return;
    const disques = (liste, dx, dy, k) => {
      g.beginPath();
      for (const [x, y, r] of liste) {
        const cx = x + r * dx, cy = y + r * dy;
        g.moveTo(cx + r * k, cy);
        g.arc(cx, cy, r * k, 0, TAU);
      }
      g.fill();
    };
    g.fillStyle = OMBRE;
    g.beginPath();
    for (const [x, y, r] of pts) {
      g.moveTo(x + 0.3 * r + r, y + 0.4 * r);
      g.arc(x + 0.3 * r, y + 0.4 * r, r, 0, TAU);
    }
    g.fill();
    const parCouleur = new Map();
    for (const p of pts) (parCouleur.get(p[3]) ?? parCouleur.set(p[3], []).get(p[3])).push(p);
    for (const [c, liste] of parCouleur) {
      g.fillStyle = c;
      disques(liste, 0, 0, 1);
    }
    g.globalAlpha = 0.26;
    g.fillStyle = "#a5cf7f";
    disques(pts, -0.32, -0.34, 0.5);
    g.globalAlpha = 1;
  }

  detruire() {
    for (const t of this.tuiles.values()) t.sprite.destroy({ texture: true, textureSource: true });
    this.tuiles.clear();
    this.conteneur.destroy();
  }
}
