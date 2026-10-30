// Rendu PixiJS universel : calques, dessin par style via le thème, caméra (doigt, stylet, molette).
// Le climat est rendu par climat.js.
import { ClimatRendu } from "./climat.js";
import { centre, vue } from "./themes/outils.js";
import { Details } from "./themes/details.js";
import { existe } from "./themes/epoque.js";
import { Effets } from "./effets.js";

const P = window.PIXI;
// Ordre d'empilement, du sol vers le ciel. Le « calque » d'une entité choisit sa place.
export const CALQUES = ["sol", "occupation", "eau", "vegetation", "relief", "routes", "reseaux", "frontieres", "batiments", "etiquettes", "unites"];
const CALQUE_PAR_DEFAUT = { zone: "sol", ligne: "routes", batiment: "batiments", unite: "unites" };
const TUILE = 512;  // m : zones et lignes sont regroupées par tuile selon leur point de départ, pour masquer le hors-écran

// Remplace le dessin du thème par l'image de l'entité (e.image) une fois chargée ; le garde si elle échoue.
// x, y : centre de l'image dans le conteneur rendu.
export function avecImage(dessin, e, x = e.x, y = e.y) {
  const c = new P.Container();
  c.addChild(dessin);
  P.Assets.load(e.image).then((texture) => {
    if (c.destroyed) return;
    const s = c.addChild(new P.Sprite(texture));
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set((e.largeur ?? 2 * (e.taille ?? 12)) / texture.width);
    dessin.visible = false;
  }, () => {});
  return c;
}

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

// Importance d'un nom quand la place manque : mers et pays, puis préfectures, régions, autres villes, cours d'eau
function priorite(e) {
  if (e.style === "mer") return 1e9;
  if (e.style === "pays") return 5e8;
  if (e.population !== undefined) return (e.prefecture ? 2e7 : 0) + e.population;  // préfectures avant les noms de régions
  if (e.type === "zone") return 1.5e7;
  return e.type === "batiment" ? e.taille ?? 0 : 1e5;
}

export class Rendu {
  constructor(app) {
    this.app = app;
    this.monde = new P.Container();
    this.calques = {};
    for (const nom of ["base", ...CALQUES]) this.monde.addChild((this.calques[nom] = new P.Container()));
    app.stage.addChild(this.monde);
    this.climat = new ClimatRendu(this);
    // Particules sous les unités ; ondes et surlignage au-dessus de tout le monde
    this.dessus = this.monde.addChild(new P.Container());
    this.effets = new Effets(this.monde.addChildAt(new P.Container(), this.monde.getChildIndex(this.calques.unites)), this.dessus);
    this.surlignage = this.dessus.addChild(new P.Graphics());
    this.selection = null;
    this.culles = [];  // { objet, x0, y0, x1, y1, marge (px écran) } masqués hors de l'écran
    this.mobiles = new Map();
    this.animations = [];  // fonctions (dt, contexte) appelées à chaque image
    this.zoom = 1;
    // Ce que les animations des thèmes peuvent demander au monde
    this.contexte = { vent: (x, y) => (this.climat.etat ? this.climat.zoneDe(x, y).vent : 0) };
    app.ticker.add((t) => this.image(t.deltaMS / 1000));
    // Onde discrète à l'endroit d'un toucher (sans glissé)
    const appuis = new Map();
    app.canvas.addEventListener("pointerdown", (e) => appuis.set(e.pointerId, [e.clientX, e.clientY]));
    app.canvas.addEventListener("pointerup", (e) => {
      const a = appuis.get(e.pointerId);
      appuis.delete(e.pointerId);
      if (a && Math.hypot(e.clientX - a[0], e.clientY - a[1]) < 8) {
        const p = this.versMonde(e.clientX, e.clientY);
        this.effets.emettre("onde", p.x, p.y, { zoom: this.zoom });
      }
    });
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
    this.details?.detruire();
    this.details = null;
    for (const nom of ["base", ...CALQUES]) {
      if (nom === "unites") continue;
      for (const enfant of this.calques[nom].removeChildren()) enfant.destroy({ children: true });
    }
    this.animations = [];
    const annee = carte.annee ?? 1790;
    Object.assign(vue, { zoom: this.zoom, echelle: carte.echelle ?? 1, annee, epoque: annee >= 1945 ? "moderne" : "ancien" });
    this.lignes = [];  // [graphique, entité, dessin] : retracées quand le zoom change (épaisseur à l'écran)
    const [L, H] = carte.taille;
    this.calques.base.addChild(new P.Graphics().rect(0, 0, L, H).fill(t.base));
    // Décor du thème : « sous » le terrain (papier, fond) et « sur » le terrain (ombrage du relief)
    const decor = t.decor?.(this, carte) ?? {};
    if (decor.sous) this.calques.base.addChild(decor.sous);
    if (decor.sur) this.calques.relief.addChild(decor.sur);
    if (decor.terrain) {
      this.calques.occupation.addChild(decor.terrain);
      this.details = new Details(this, carte);  // arbres et champs de près
      this.calques.occupation.addChild(this.details.conteneur);
    }

    const graphiques = {};
    const graphique = (nom, e, calque = nom) => {
      const [x, y] = e.points?.[0] ?? [e.x, e.y], cle = `${nom}|${Math.floor(x / TUILE)}|${Math.floor(y / TUILE)}`;
      return graphiques[cle] ?? (graphiques[cle] = this.calques[calque].addChild(new P.Graphics()));
    };
    const graphiqueLigne = (nom, e) => graphique(`${nom}|ligne`, e, nom);
    const objets = [];  // bâtiments et étiquettes, masqués eux aussi hors de l'écran
    for (const e of carte.entites) {
      if (!existe(e, annee)) continue;  // pas encore construite, ou déjà disparue, à cette année
      const calque = this.calques[e.calque] ? e.calque : CALQUE_PAR_DEFAUT[e.type] ?? "sol";
      const dessin = dessinateur(t, e);
      if (!dessin) continue;
      if (e.type === "zone" || e.type === "ligne") {
        if (e.type === "ligne") {
          const g = graphiqueLigne(calque, e);
          this.lignes.push([g, e, dessin]);
          dessin(g, e);
        } else dessin(graphique(calque, e), e);
        // Bordure : tracée au-dessus de l'occupation du sol (limites administratives, pays grisés)
        t.bordure?.[e.style]?.(graphique("frontieres", e), e);
        const nom = e.nom && t.nomLieu?.(e);
        if (nom) {
          const c = centre(e);
          nom.position.set(c.x, c.y);
          nom.priorite = priorite(e);
          if (e.type === "zone") nom.origine = { x: c.x, y: c.y };  // nom de région : peut se décaler s'il gêne
          objets.push([this.calques.etiquettes.addChild(nom), 150]);
        }
      } else if (e.type === "batiment") {
        const { dessin: objet, etiquette, animer } = dessin(e) ?? {};
        if (objet) objets.push([this.calques[calque].addChild(e.image ? avecImage(objet, e) : objet), 30]);
        if (etiquette) {
          etiquette.priorite = priorite(e);
          objets.push([this.calques.etiquettes.addChild(etiquette), 150]);
        }
        if (animer) this.animations.push(animer);
      }
    }
    this.climat.carte(carte);
    this.majEtiquettes();
    this.culles = [...Object.values(graphiques).map((g) => [g, 30]), ...objets].map(([objet, marge]) => ({ objet, marge, ...this.boiteMonde(objet) }));
    this.cleVue = "";
    if (premiere) this.recentrer();
    this.dessinerSurlignage();
  }

  // Boîte d'un objet en coordonnées du monde, quelle que soit la caméra du moment
  boiteMonde(objet) {
    const b = objet.getBounds(), z = this.zoom, { x, y } = this.monde;
    return { x0: (b.minX - x) / z, y0: (b.minY - y) / z, x1: (b.maxX - x) / z, y1: (b.maxY - y) / z };
  }

  // Masque ce qui sort de l'écran ; ne recalcule que si la caméra a bougé
  cacherHorsEcran() {
    const { width: w, height: h } = this.app.screen, z = this.zoom;
    const cle = `${this.monde.x}|${this.monde.y}|${z}|${w}|${h}`;
    if (cle === this.cleVue) return;
    this.cleVue = cle;
    const a = this.versMonde(0, 0), b = this.versMonde(w, h);
    for (const c of this.culles) {
      const m = c.marge / z;
      c.objet.visible = c.x1 > a.x - m && c.x0 < b.x + m && c.y1 > a.y - m && c.y0 < b.y + m;
    }
    this.eviterChevauchements();
  }

  // Étiquettes qui se chevauchent à l'écran : seule la plus importante reste (comme sur une carte IGN)
  eviterChevauchements() {
    const places = [];
    const etiquettes = this.calques.etiquettes.children.filter((e) => e.visible)
      .sort((a, b) => (b.priorite ?? 0) - (a.priorite ?? 0));
    const occupe = (r) => places.some((p) => r.minX < p.maxX && r.maxX > p.minX && r.minY < p.maxY && r.maxY > p.minY);
    for (const e of etiquettes) {
      let r = e.getBounds();
      if (e.origine) {
        // Essaie la place prévue, puis au-dessus et en dessous (décalage en pixels écran ramené au monde)
        for (const pas of [0, -1, 1, -2, 2]) {
          e.position.set(e.origine.x, e.origine.y + (pas * (r.height + 6)) / this.zoom);
          r = e.getBounds();
          if (!occupe(r)) break;
        }
      }
      e.visible = !occupe(r);
      if (e.visible) places.push({ minX: r.minX - 4, minY: r.minY - 2, maxX: r.maxX + 4, maxY: r.maxY + 2 });
    }
  }

  // Image basse résolution de quelques calques sur toute la carte (minicarte), hors-écran compris
  instantane(noms, largeur) {
    const [L, H] = this.carte.taille, garder = new Set(noms.map((n) => this.calques[n]));
    const etats = this.monde.children.map((c) => [c, c.visible]);
    for (const [c] of etats) c.visible = garder.has(c);
    for (const c of this.culles) c.objet.visible = true;
    const toile = this.app.renderer.extract.canvas({
      target: this.monde, frame: new P.Rectangle(0, 0, L, H), resolution: largeur / L, antialias: true });
    for (const [c, v] of etats) c.visible = v;
    this.cleVue = "";
    return toile;
  }

  // --- Sélection : contour lumineux qui pulse, d'épaisseur constante à l'écran ---
  surligner(e) {
    this.selection = e;
    this.dessinerSurlignage();
  }

  dessinerSurlignage() {
    const e = this.selection, g = this.surlignage.clear(), z = this.zoom;
    this.zoomSurlignage = z;
    if (!e) return;
    const forme = () => {
      if (e.type === "batiment" || e.type === "unite") return g.circle(e.x, e.y, (e.taille ?? 20) + 6 / z);
      if (e.type === "ligne") {
        g.moveTo(...e.points[0]);
        for (const p of e.points.slice(1)) g.lineTo(...p);
        return g;
      }
      return e.points ? g.poly(e.points.flat()) : g.rect(e.x, e.y, e.w, e.h);
    };
    const halo = { color: 0xffd75e, cap: "round", join: "round" };
    forme().stroke({ ...halo, width: (e.type === "ligne" ? 18 : 12) / z, alpha: 0.3 });
    forme().stroke({ ...halo, width: 3 / z, color: 0xfff4c2 });
  }

  // --- Entités mobiles (positions interpolées entre deux mises à jour) ---
  majEtat(etat) {
    this.climat.maj(etat);
    const vus = new Set();
    for (const e of etat.mobiles) {
      vus.add(e.id);
      let s = this.mobiles.get(e.id);
      if (!s) {
        const dessin = dessinateur(this.theme, e)?.(e);
        const objet = dessin && e.image ? avecImage(dessin, e, 0, 0) : dessin ?? null;
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

  // Les lignes (routes, rivières…) gardent une épaisseur lisible : retracées quand le zoom a changé de 40 %
  retracerLignes() {
    if (!this.lignes?.length || Math.abs(Math.log(this.zoom / vue.zoom)) < Math.log(1.4)) return;
    vue.zoom = this.zoom;
    for (const g of new Set(this.lignes.map((l) => l[0]))) g.clear();
    for (const [g, e, dessin] of this.lignes) dessin(g, e);
  }

  image(dt) {
    this.retracerLignes();
    const k = Math.min(1, dt * 6), { width: w, height: h } = this.app.screen;
    const a = this.versMonde(0, 0), b = this.versMonde(w, h), marge = 80 / this.zoom;
    for (const s of this.mobiles.values()) {
      const { objet, cible } = s;
      if (!objet) continue;
      // Saut direct si l'écart est grand (tour par tour, chargement)
      const ecart = Math.hypot(cible.x - objet.x, cible.y - objet.y);
      if (ecart > 150) objet.position.set(cible.x, cible.y);
      else objet.position.set(objet.x + (cible.x - objet.x) * k, objet.y + (cible.y - objet.y) * k);
      objet.rotation = this.theme.orientation(cible);
      objet.visible = objet.x > a.x - marge && objet.x < b.x + marge && objet.y > a.y - marge && objet.y < b.y + marge;
      // Effet laissé derrière soi : une bouffée tous les 8 m parcourus
      if (cible.effet && objet.visible && ecart <= 150) {
        s.parcouru = (s.parcouru ?? 0) + ecart * k;
        if (s.parcouru > 8) {
          s.parcouru = 0;
          this.effets.emettre(cible.effet, objet.x, objet.y, { dx: (cible.x - objet.x) / ecart, dy: (cible.y - objet.y) / ecart });
        }
      }
    }
    for (const animer of this.animations) animer(dt, this.contexte);
    this.effets.image(dt);
    this.cacherHorsEcran();
    if (this.selection) {
      if (this.zoom !== this.zoomSurlignage) this.dessinerSurlignage();
      this.surlignage.alpha = 0.65 + 0.35 * Math.sin(performance.now() / 260);
    }
    this.details?.image();
    this.climat.image(dt);
  }

  // --- Caméra ---
  versMonde(x, y) { return this.monde.toLocal({ x, y }); }

  zoomer(facteur, cx, cy) {
    const avant = this.versMonde(cx, cy);
    // Zoom maximal : ~500 px/km sur les grandes cartes (maisons visibles), au moins ×6
    this.zoom = Math.min(Math.max(6, 0.5 * (this.carte?.echelle ?? 1)), Math.max(0.15, this.zoom * facteur));
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
