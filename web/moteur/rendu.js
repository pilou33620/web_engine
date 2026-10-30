// Rendu PixiJS : calques, caméra (doigt, stylet, molette). Le climat est rendu par climat.js.
import { ClimatRendu } from "./climat.js";

const P = window.PIXI;
export const CALQUES = ["sol", "haies", "eau", "routes", "frontieres", "villes", "etiquettes", "unites"];

export class Rendu {
  constructor(app) {
    this.app = app;
    this.monde = new P.Container();
    this.calques = {};
    for (const nom of ["base", ...CALQUES]) this.monde.addChild((this.calques[nom] = new P.Container()));
    app.stage.addChild(this.monde);
    this.climat = new ClimatRendu(this);
    this.mobiles = new Map();
    this.zoom = 1;
    app.ticker.add((t) => this.image(t.deltaMS / 1000));
  }

  // --- Thème et carte ---
  appliquerTheme(theme) {
    this.theme = theme;
    this.app.renderer.background.color = theme.fond;
    for (const s of this.mobiles.values()) s.objet?.destroy({ children: true });
    this.mobiles.clear();
    if (this.carte) this.dessinerCarte(this.carte);
  }

  dessinerCarte(carte) {
    const premiere = !this.carte;
    this.carte = carte;
    const t = this.theme;
    for (const nom of ["base", ...CALQUES]) {
      if (nom === "unites") continue;
      for (const enfant of this.calques[nom].removeChildren()) enfant.destroy({ children: true });
    }
    const [L, H] = carte.taille;
    this.calques.base.addChild(new P.Graphics().rect(0, 0, L, H).fill(t.base));
    const g = {};
    for (const nom of ["sol", "haies", "eau", "routes", "frontieres"]) this.calques[nom].addChild((g[nom] = new P.Graphics()));
    for (const e of carte.entites) {
      if (e.type === "parcelle") t.sol(g.sol, e);
      else if (e.type === "haie") t.haie(g.haies, e);
      else if (e.type === "riviere") t.riviere(g.eau, e);
      else if (e.type === "route") t.route(g.routes, e);
      else if (e.type === "frontiere") t.frontiere(g.frontieres, e);
      else if (e.type === "ville") {
        const { dessin, etiquette } = t.ville(e);
        this.calques.villes.addChild(dessin);
        this.calques.etiquettes.addChild(etiquette);
      }
    }
    this.climat.carte(carte);
    this.majEtiquettes();
    if (premiere) this.recentrer();
  }

  // --- Entités mobiles (positions interpolées entre deux mises à jour) ---
  majEtat(etat) {
    this.climat.maj(etat);
    const vus = new Set();
    for (const e of etat.mobiles) {
      vus.add(e.id);
      let s = this.mobiles.get(e.id);
      if (!s) {
        const objet = this.theme.mobile(e);
        if (objet) {
          objet.position.set(e.x, e.y);
          if (this.theme.unitesTailleFixe) objet.scale.set(this.echelleEtiquettes());
          this.calques.unites.addChild(objet);
        }
        this.mobiles.set(e.id, (s = { objet }));
      }
      s.cible = e;
    }
    for (const [id, s] of this.mobiles) {
      if (!vus.has(id)) {
        s.objet?.destroy({ children: true });
        this.mobiles.delete(id);
      }
    }
  }

  image(dt) {
    const k = Math.min(1, dt * 6);
    for (const { objet, cible } of this.mobiles.values()) {
      if (!objet) continue;
      // Saut direct si l'écart est grand (tour par tour, chargement)
      if (Math.hypot(cible.x - objet.x, cible.y - objet.y) > 150) objet.position.set(cible.x, cible.y);
      else objet.position.set(objet.x + (cible.x - objet.x) * k, objet.y + (cible.y - objet.y) * k);
      objet.rotation = this.theme.orientation(cible);
    }
    this.climat.image(dt);
  }

  // --- Caméra ---
  versMonde(x, y) { return this.monde.toLocal({ x, y }); }

  zoomer(facteur, cx, cy) {
    const avant = this.versMonde(cx, cy);
    this.zoom = Math.min(6, Math.max(0.15, this.zoom * facteur));
    this.monde.scale.set(this.zoom);
    const apres = this.monde.toGlobal(avant);
    this.monde.x += cx - apres.x;
    this.monde.y += cy - apres.y;
    this.majEtiquettes();
  }

  deplacer(dx, dy) { this.monde.x += dx; this.monde.y += dy; }

  recentrer() {
    if (!this.carte) return;
    const [L, H] = this.carte.taille, { width: w, height: h } = this.app.screen;
    const tout = Math.min(w / L, h / H), rempli = Math.max(w / L, h / H);
    this.zoom = Math.min(rempli, tout * 3);  // remplit l'écran sans trop zoomer sur téléphone
    this.monde.scale.set(this.zoom);
    this.monde.position.set((w - L * this.zoom) / 2, (h - H * this.zoom) / 2);
    this.majEtiquettes();
  }

  // Les étiquettes gardent une taille lisible quel que soit le zoom
  echelleEtiquettes() { return Math.min(2.5, 1 / this.zoom); }

  majEtiquettes() {
    const s = this.echelleEtiquettes();
    for (const e of this.calques.etiquettes.children) e.scale.set(s);
    if (this.theme?.unitesTailleFixe) for (const u of this.calques.unites.children) u.scale.set(s);
  }

  afficherCalque(nom, visible) { this.calques[nom].visible = visible; }

  // Entité sous un point écran : villes d'abord, puis parcelles
  chercher(x, y) {
    if (!this.carte) return null;
    const p = this.versMonde(x, y), rayon = 40 / Math.min(1, this.zoom);
    const ents = this.carte.entites;
    return ents.find((e) => e.type === "ville" && Math.hypot(e.x - p.x, e.y - p.y) < rayon)
      ?? ents.find((e) => e.type === "parcelle" && p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h)
      ?? null;
  }
}
