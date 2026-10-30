// Rendu PixiJS universel : calques, dessin par style via le thème, caméra (doigt, stylet, molette).
// Le climat est rendu par climat.js.
import { ClimatRendu } from "./climat.js";
import { centre } from "./themes/outils.js";

const P = window.PIXI;
// Ordre d'empilement, du sol vers le ciel. Le « calque » d'une entité choisit sa place.
export const CALQUES = ["sol", "eau", "vegetation", "routes", "reseaux", "frontieres", "batiments", "etiquettes", "unites"];
const CALQUE_PAR_DEFAUT = { zone: "sol", ligne: "routes", batiment: "batiments", unite: "unites" };

// Dessin d'une entité : style du thème, sinon dessin par défaut « _ » du type
const dessinateur = (theme, e) => theme[e.type]?.[e.style] ?? theme[e.type]?._;

function distanceSegment(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function dansPolygone(x, y, pts) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) dedans = !dedans;
  }
  return dedans;
}

export class Rendu {
  constructor(app) {
    this.app = app;
    this.monde = new P.Container();
    this.calques = {};
    for (const nom of ["base", ...CALQUES]) this.monde.addChild((this.calques[nom] = new P.Container()));
    app.stage.addChild(this.monde);
    this.climat = new ClimatRendu(this);
    this.mobiles = new Map();
    this.animations = [];  // fonctions (dt, contexte) appelées à chaque image
    this.zoom = 1;
    // Ce que les animations des thèmes peuvent demander au monde
    this.contexte = { vent: (x, y) => (this.climat.etat ? this.climat.zoneDe(x, y).vent : 0) };
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
    this.animations = [];
    const [L, H] = carte.taille;
    this.calques.base.addChild(new P.Graphics().rect(0, 0, L, H).fill(t.base));
    const decor = t.decor?.(this, carte);
    if (decor) this.calques.base.addChild(decor);

    const graphiques = {};
    const graphique = (nom) => graphiques[nom] ?? (graphiques[nom] = this.calques[nom].addChild(new P.Graphics()));
    for (const e of carte.entites) {
      const calque = this.calques[e.calque] ? e.calque : CALQUE_PAR_DEFAUT[e.type] ?? "sol";
      const dessin = dessinateur(t, e);
      if (!dessin) continue;
      if (e.type === "zone" || e.type === "ligne") {
        dessin(graphique(calque), e);
        const nom = e.nom && t.nomLieu?.(e);
        if (nom) {
          const c = centre(e);
          nom.position.set(c.x, c.y);
          this.calques.etiquettes.addChild(nom);
        }
      } else if (e.type === "batiment") {
        const { dessin: objet, etiquette, animer } = dessin(e) ?? {};
        if (objet) this.calques[calque].addChild(objet);
        if (etiquette) this.calques.etiquettes.addChild(etiquette);
        if (animer) this.animations.push(animer);
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
        const objet = dessinateur(this.theme, e)?.(e) ?? null;
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
    for (const animer of this.animations) animer(dt, this.contexte);
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

  // Centre la vue sur un point du monde sans changer le zoom
  viser(x, y) {
    const { width: w, height: h } = this.app.screen;
    this.monde.position.set(w / 2 - x * this.zoom, h / 2 - y * this.zoom);
  }

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

  // Entité sous un point écran : bâtiments, puis lignes construites ou nommées, puis zones (la plus haute)
  chercher(x, y) {
    if (!this.carte) return null;
    const p = this.versMonde(x, y), tolerance = 14 / this.zoom;
    const ents = this.carte.entites;
    const batiment = ents.find((e) => e.type === "batiment" && Math.hypot(e.x - p.x, e.y - p.y) < Math.max(e.taille ?? 20, tolerance * 2));
    if (batiment) return batiment;
    const ligne = ents.find((e) => e.type === "ligne" && (e.constructible || e.nom)
      && e.points.some((a, i) => i > 0 && distanceSegment(p.x, p.y, e.points[i - 1], a) < tolerance));
    if (ligne) return ligne;
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (e.type !== "zone") continue;
      if (e.points ? dansPolygone(p.x, p.y, e.points) : p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) return e;
    }
    return null;
  }
}
