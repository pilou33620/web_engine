// Détails de près, à la manière de web_conquete : arbres un par un (ombre portée au sud-est, reflet au nord-ouest),
// champs en parcelles avec leurs sillons, rangs de vigne, buissons des landes. Peints par tuiles de 256 px quand le
// zoom dépasse ~14 px/km, une tuile par image au plus, gardés en cache ; le fond (decor.js terrain) reste dessous.
// Tout vient d'une grille absolue en km : deux tuiles voisines se raccordent sans couture.
import { paysage, bruit, SOLS, hash, parcelles, culture, trame } from "./decor.js";
import { paysageDe } from "./epoque.js";
import { vue } from "./outils.js";
import { genererPlan, dessinerPlan, rayon } from "./villes.js";
import * as epoques from "./epoque.js";

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
    // villes dessinées en plan (villes.js) : centre (km), population et rayon à l'année du rendu (epoque.js)
    const km = this.km, an = vue.annee, er = epoques.ere(an), f = epoques.facteurPopulation(an);
    this.plans = new Map();
    // rivières (km) pour garder l'eau libre de maisons : segments et demi-largeur
    this.rivieres = carte.entites.filter((e) => e.style === "riviere").map((e) => {
      const l = Array.isArray(e.largeur) ? Math.max(...e.largeur) : e.largeur ?? 2;
      const pts = e.points.map(([x, y]) => [x * km, y * km]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { pts, w: Math.max(0.03, (l * km) / 2), boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
    // les routes qui partent de chaque ville sont ses axes ; les rivières proches (largeur par point) ses quais
    const voies = carte.entites.filter((r) => r.style === "route" || r.style === "chemin");
    const fleuves = carte.entites.filter((e) => e.style === "riviere").map((e) => {
      const xs = e.points.map((p) => p[0]), ys = e.points.map((p) => p[1]), l = e.largeur ?? 2;
      return { e, boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], ws: e.points.map((_, i) => Math.max(0.012, ((Array.isArray(l) ? l[i] ?? l.at(-1) : l) * km) / 2)) };
    });
    const f1790 = epoques.facteurPopulation(1790);
    this.villes = carte.entites.filter((e) => e.style === "ville").map((e) => {
      const p0 = e.population ?? 2000, pop = p0 * f, r = rayon(pop, er), lim = (2.2 * r + 0.3) / km;
      const axes = [], rivieres = [];
      for (const v of voies) {
        const p = v.points, d0 = Math.hypot(p[0][0] - e.x, p[0][1] - e.y), d1 = Math.hypot(p.at(-1)[0] - e.x, p.at(-1)[1] - e.y);
        if (Math.min(d0, d1) < 1.5) axes.push({ pts: (d0 < d1 ? p : [...p].reverse()).map(([a, b]) => [a * km, b * km]), grand: v.style === "route" });
      }
      for (const { e: fl, boite: b, ws } of fleuves) {
        if (e.x < b[0] - lim || e.x > b[2] + lim || e.y < b[1] - lim || e.y > b[3] + lim) continue;
        let i0 = -1, i1 = -1;
        fl.points.forEach(([a, c], i) => { if (Math.hypot(a - e.x, c - e.y) < lim) { if (i0 < 0) i0 = i; i1 = i; } });
        const s = Math.max(0, i0 - 1), t = Math.min(fl.points.length, i1 + 2);
        if (i0 >= 0) rivieres.push({ pts: fl.points.slice(s, t).map(([a, c]) => [a * km, c * km]), ws: ws.slice(s, t) });
      }
      // villes closes : remparts en 1790 (préfectures, plus de 15 000 habitants), boulevards à leur place ensuite
      const close = e.prefecture || (er === "classique" ? pop : p0 * f1790) > 15000;
      return { x: e.x * km, y: e.y * km, pop, ere: er, r, rh: rayon(p0 * f1790, "classique"), ri: rayon(p0 * epoques.facteurPopulation(1930), "industrielle"),
        axes, rivieres, murs: close && er !== "celte" && er !== "romaine", graine: Math.round(e.x * 7 + e.y) };
    });
    // villes voisines : chacune s'arrête où commence le territoire de l'autre
    for (const v of this.villes) v.voisines = this.villes.filter((o) => o !== v && Math.hypot(o.x - v.x, o.y - v.y) < 2.6 * (v.r + o.r) + 0.3).map((o) => [o.x, o.y, o.r]);
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
  // Selon l'époque (epoque.js paysageDe) : petits champs épars de l'Antiquité, lanières bordées de haies (jusqu'en 1959),
  // grandes parcelles remembrées presque sans haies, puis en 2100 haies revenues, fermes solaires et éoliennes.
  champs(g, L, x0, y0, x1, y1) {
    const u = 0.6 / Math.min(L, 64), lots = new Map(), ep = paysageDe(), friche = trame()[3];
    const haies = { antique: 0, ancien: 0.6, remembre: 0.08, futur: 0.5 }[ep], hw = Math.max(1.6 * u, 0.006);
    const lot = (cle) => lots.get(cle) ?? lots.set(cle, new Path2D()).get(cle);
    const haie = (xa, ya, xb, yb) => {
      lot(`g|#3a5a2c|${hw}`).moveTo(xa, ya);
      lot(`g|#3a5a2c|${hw}`).lineTo(xb, yb);
      if (L < 48) return;
      const n = Math.ceil(Math.hypot(xb - xa, yb - ya) / 0.022), c = lot("c|#46703a");
      for (let i = 0; i <= n; i++) {
        const r = hw * (0.7 + 0.6 * hash(i, Math.floor(xa * 1e3), Math.floor(ya * 1e3))), cx = xa + ((xb - xa) * i) / n, cy = ya + ((yb - ya) * i) / n;
        c.moveTo(cx + r, cy);
        c.arc(cx, cy, r, 0, TAU);
      }
    };
    parcelles(x0, y0, x1, y1, (x, y, w, h, hh) => {
      if (friche && hh < friche) return;  // Antiquité : la lande et les bois entre les champs (le fond)
      if (friche) {  // petits champs irréguliers : chacun rogné différemment
        const a = hash(Math.floor(hh * 1e6), 1, 21), b = hash(Math.floor(hh * 1e6), 2, 21);
        x += w * 0.2 * a; y += h * 0.2 * b; w *= 0.75 + 0.05 * b; h *= 0.75 + 0.05 * a;
      }
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
      // haies (bocage) sur le bas et le côté droit de la parcelle ; les panneaux solaires n'en ont pas
      if (sol !== "solaire" && hash(Math.floor(hh * 1e6), 3, 22) < haies) haie(x, y + h, x + w, y + h);
      if (sol !== "solaire" && hash(Math.floor(hh * 1e6), 4, 22) < haies) haie(x + w, y, x + w, y + h);
    });
    // Les fonds d'abord, puis les tracés : sillons et grain par-dessus, les haies et leurs arbres en dernier
    for (const ordre of ["f", "s", "a", "h", "g", "c"]) {
      for (const [cle, p] of lots) {
        const [op, c, lw] = cle.split("|");
        if (op !== ordre) continue;
        if (op === "f" || op === "a" || op === "c") { g.fillStyle = c; g.fill(p); }
        else { g.strokeStyle = c; g.lineWidth = +lw; g.stroke(p); }
      }
    }
    // 2100 : éoliennes isolées dans les champs (une case de 2 km sur douze), vues du dessus avec leur ombre
    if (ep !== "futur") return;
    const r = Math.max(0.06, 4 / L);
    for (let j = Math.floor(y0 / 2) - 1; j * 2 < y1 + 2; j++) {
      for (let i = Math.floor(x0 / 2) - 1; i * 2 < x1 + 2; i++) {
        if (hash(i, j, 31) > 0.08) continue;
        const x = (i + 0.2 + 0.6 * hash(i, j, 32)) * 2, y = (j + 0.2 + 0.6 * hash(i, j, 33)) * 2, t = this.code(x, y);
        if (t !== "c" && t !== "p" && t !== "l") continue;
        const a = hash(i, j, 34) * TAU;
        g.strokeStyle = "rgba(20,32,12,.35)";
        g.lineWidth = r * 0.12;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + r * 1.6, y + r * 1.2);
        g.stroke();
        g.strokeStyle = "#f4f4f0";
        g.lineWidth = r * 0.1;
        g.beginPath();
        for (let k = 0; k < 3; k++) g.moveTo(x, y), g.lineTo(x + Math.cos(a + (k * TAU) / 3) * r, y + Math.sin(a + (k * TAU) / 3) * r);
        g.stroke();
        g.fillStyle = "#d8d8d0";
        g.beginPath();
        g.arc(x, y, r * 0.12, 0, TAU);
        g.fill();
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

  // Villes : plans d'îlots selon l'ère (villes.js), générés une fois par ville quand une tuile les montre
  batiments(g, L, x0, y0, span) {
    const code = (x, y) => this.P.codeA(x / this.km, y / this.km);
    for (const v of this.villes) {
      const b = this.plans.get(v)?.boite, m = v.r * (v.ere === "romaine" ? 3.6 : 2) + 0.3;
      if (b ? b[2] < x0 || b[0] > x0 + span || b[3] < y0 || b[1] > y0 + span : v.x + m < x0 || v.x - m > x0 + span || v.y + m < y0 || v.y - m > y0 + span) continue;
      let plan = this.plans.get(v);
      if (!plan) {
        // l'eau : mer et lacs de l'occupation du sol, rivières à leur largeur locale (plus une berge)
        const eau = (x, y) => code(x, y) === "." || v.rivieres.some(({ pts, ws }) => pts.some((p, k) => {
          if (!k) return false;
          const a = pts[k - 1], dx = p[0] - a[0], dy = p[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
          return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < ws[k - 1] + (ws[k] - ws[k - 1]) * t + 0.006;
        }));
        this.plans.set(v, (plan = genererPlan(v, eau, (x, y) => code(x, y) === "u")));
      }
      dessinerPlan(g, plan, x0, y0, x0 + span, y0 + span, L);
    }
  }

  // Bois : houppiers ronds là où le fond dit forêt (et quelques arbres isolés ailleurs) ; ombre, feuillage, reflet
  arbres(g, L, x0, y0, span) {
    // de très près, des arbres à leur vraie taille (plus petits et plus nombreux) au lieu de houppiers géants
    const reduc = Math.max(0.15, Math.min(1, 64 / L)), pas = 3 / L, M = Math.ceil((0.13 * reduc) / pas) + 1, a2 = pas * pas;
    // arbres par km² hors forêt selon l'époque : [landes, prés, champs, vignes] ; en 2100, en bosquets
    const [dl, dp, dc, dv] = { antique: [30, 8, 4, 0.3], ancien: [14, 3, 0.6, 0.3], remembre: [12, 1.5, 0.2, 0.2], futur: [18, 5, 2.5, 0.3] }[paysageDe()];
    const bosquet = paysageDe() === "futur" ? (x, y) => (bruit(x, y, 0.7, 60) > 0.62 ? 6 : 0.4) : () => 1;
    const gi0 = Math.floor(x0 / pas) - M, gj0 = Math.floor(y0 / pas) - M, n = Math.ceil(span / pas) + 2 * M + 1;
    const pts = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gi = gi0 + i, gj = gj0 + j, x = (gi + 0.5) * pas, y = (gj + 0.5) * pas, t = this.code(x, y);
        const densite = t === "f" ? 190 : t === "l" ? dl : t === "p" ? dp * bosquet(x, y) : t === "c" ? dc * bosquet(x, y) : t === "v" ? dv : 0;
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
