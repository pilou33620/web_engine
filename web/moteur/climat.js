// Rendu du climat : lumière du soleil, couleurs des saisons, neige au sol, crues, ombres de nuages
// poussées par le vent, pluie / neige / orage, brouillard, éclairs, éclairage des villes la nuit.
// Toutes les valeurs viennent de la physique du serveur (moteur/climat.py).
const P = window.PIXI;

export const melange = (a, b, t) => [16, 8, 0].reduce((r, s) => r | (Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t) << s), 0);
const multiplier = (a, b) => [16, 8, 0].reduce((r, s) => r | (Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s), 0);
const borne = (v, a, b) => Math.min(b, Math.max(a, v));

const TEINTE_SAISON = { Printemps: 0xffffff, "Été": 0xfff0d2, Automne: 0xffdcb0, Hiver: 0xdde3e8 };
const CIEL = { soleil: 0xffffff, nuages: 0xe2e5ea, brouillard: 0xe6e8eb, pluie: 0xc2c9d3, neige: 0xd6dce4, orage: 0x98a1b0 };

// Couleur de la lumière selon la hauteur du soleil (en degrés)
function lumiere(elevation) {
  if (elevation >= 10) return 0xffffff;
  if (elevation >= 0) return melange(0xffc287, 0xffffff, elevation / 10);
  if (elevation >= -8) return melange(0x44537d, 0xffc287, (elevation + 8) / 8);
  return 0x44537d;
}

export class ClimatRendu {
  constructor(rendu) {
    this.r = rendu;
    const m = rendu.monde, avant = (nom) => m.getChildIndex(rendu.calques[nom]);
    this.neige = m.addChildAt(new P.Graphics(), avant("haies"));     // posée sur le sol
    this.crue = m.addChildAt(new P.Graphics(), avant("eau"));        // débordement sous la rivière
    this.ombres = m.addChildAt(new P.Container(), avant("villes"));  // nuages au-dessus du paysage
    // Flou puis transparence appliqués à l'ensemble : les nuages qui se chevauchent ne s'assombrissent pas
    this.opaciteOmbres = new P.AlphaFilter({ alpha: 0.2 });
    this.ombres.filters = [new P.BlurFilter({ strength: 40, quality: 3 }), this.opaciteOmbres];
    this.lumiere = new P.Graphics();
    this.lumiere.blendMode = "multiply";
    // Éclairage des villes : au-dessus de la nuit pour briller, mais suit la caméra du monde
    this.lumieres = new P.Container();
    this.lumieres.blendMode = "add";
    this.brume = new P.Graphics();
    this.precip = new P.Graphics();
    this.eclair = new P.Graphics();
    rendu.app.stage.addChild(this.lumiere, this.lumieres, this.brume, this.precip, this.eclair);
    this.particules = Array.from({ length: 320 }, () => [Math.random(), Math.random(), Math.random()]);
    this.nuages = [];
    this.flash = this.brumeAlpha = 0;
    this.etat = null;
    this.cle = "";
  }

  zoneDe(x, y) {
    const zones = this.etat.climat.zones;
    return zones.find((z) => z.rect && x >= z.rect[0] && x < z.rect[2] && y >= z.rect[1] && y < z.rect[3]) ?? zones[0];
  }

  // Appelé à chaque (re)dessin de la carte
  carte(carte) {
    this.taille = carte.taille;
    this.rivieres = carte.entites.filter((e) => e.type === "riviere");
    for (const c of [...this.lumieres.removeChildren(), ...this.ombres.removeChildren()]) c.destroy();
    for (const v of carte.entites.filter((e) => e.type === "ville")) {
      const g = new P.Graphics();
      for (const r of [110, 75, 45, 22]) g.circle(v.x, v.y, r).fill({ color: 0xffb25a, alpha: 0.13 });
      this.lumieres.addChild(g);
    }
    const [L, H] = this.taille;
    this.nuages = Array.from({ length: Math.ceil((L * H) / 350000) }, () => {
      const g = new P.Graphics();
      for (let i = 0; i < 7; i++) g.circle((Math.random() - 0.5) * 260, (Math.random() - 0.5) * 140, 50 + Math.random() * 70).fill(0x10141c);
      g.position.set(Math.random() * (L + 800) - 400, Math.random() * (H + 800) - 400);
      g.seuil = 0.3 + Math.random() * 0.7;  // plus le ciel est couvert, plus de nuages sont visibles
      return this.ombres.addChild(g);
    });
    this.cle = "";
  }

  maj(etat) {
    this.etat = etat;
    const h = etat.horloge;
    this.fige = h.pause || h.mode === "tour";
    this.tour = h.mode === "tour";
    this.vitesse = h.vitesse;
    const teinte = TEINTE_SAISON[h.saison] ?? 0xffffff;
    for (const nom of ["sol", "haies"]) this.r.calques[nom].tint = teinte;
    // Neige et crues ne se redessinent que si les valeurs ont changé
    const cle = etat.climat.zones.map((z) => `${Math.round(z.neige_cm)}|${z.debit.toFixed(1)}`).join();
    if (cle !== this.cle && this.taille) {
      this.cle = cle;
      this.dessinerNeige();
      this.dessinerCrue();
    }
  }

  dessinerNeige() {
    const [L, H] = this.taille;
    this.neige.clear();
    for (const z of this.etat.climat.zones) {
      if (z.neige_cm < 0.5) continue;
      const [x0, y0, x1, y1] = z.rect ?? [0, 0, L, H];
      const a = borne(x0, 0, L), b = borne(y0, 0, H);
      this.neige.rect(a, b, borne(x1, 0, L) - a, borne(y1, 0, H) - b).fill({ color: 0xf3f6f9, alpha: Math.min(0.85, z.neige_cm / 10) });
    }
  }

  dessinerCrue() {
    this.crue.clear();
    for (const r of this.rivieres ?? []) {
      for (let i = 0; i < r.points.length - 1; i++) {
        const [x1, y1] = r.points[i], [x2, y2] = r.points[i + 1];
        const debit = this.zoneDe((x1 + x2) / 2, (y1 + y2) / 2).debit;
        if (debit <= 2) continue;
        this.crue.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: Math.min(180, 24 + (debit - 2) * 45), color: 0x4f7fae, alpha: 0.55, cap: "round" });
      }
    }
  }

  image(dt) {
    if (!this.etat) return;
    const { width: w, height: h } = this.r.app.screen;
    const centre = this.r.versMonde(w / 2, h / 2), z = this.zoneDe(centre.x, centre.y);
    const elevation = this.tour ? 45 : this.etat.climat.soleil.elevation;  // pas de nuit au tour par tour
    const nuit = borne((2 - elevation) / 10, 0, 1);

    this.lumiere.clear().rect(0, 0, w, h).fill(multiplier(lumiere(elevation), CIEL[z.meteo] ?? 0xffffff));
    this.lumieres.alpha = nuit;
    this.lumieres.position.copyFrom(this.r.monde.position);
    this.lumieres.scale.copyFrom(this.r.monde.scale);
    this.opaciteOmbres.alpha = 0.22 * (1 - 0.8 * nuit);

    // Ombres de nuages : chaque nuage suit le vent et la nébulosité de sa zone
    const [L, H] = this.taille ?? [0, 0], avance = this.fige ? 0 : dt * this.vitesse * 4;
    for (const n of this.nuages) {
      const zn = this.zoneDe(n.x, n.y), vers = ((zn.direction + 180) * Math.PI) / 180;
      n.x += Math.sin(vers) * zn.vent * avance;
      n.y -= Math.cos(vers) * zn.vent * avance;
      if (n.x > L + 400) n.x = -400; else if (n.x < -400) n.x = L + 400;
      if (n.y > H + 400) n.y = -400; else if (n.y < -400) n.y = H + 400;
      n.visible = zn.nebulosite > n.seuil;
    }

    this.brumeAlpha += ((z.meteo === "brouillard" ? 0.5 : 0) - this.brumeAlpha) * Math.min(1, dt * 1.5);
    this.brume.clear();
    if (this.brumeAlpha > 0.01) this.brume.rect(0, 0, w, h).fill({ color: 0xe8eaec, alpha: this.brumeAlpha });

    // Précipitations : quantité selon l'intensité (mm/h), inclinées par le vent
    this.precip.clear();
    const vers = ((z.direction + 180) * Math.PI) / 180, derive = Math.sin(vers) * z.vent;
    if (z.pluie > 0) {
      const nb = Math.min(this.particules.length, 60 + z.pluie * 60);
      const neige = z.meteo === "neige";
      for (let i = 0; i < nb; i++) {
        const p = this.particules[i];
        p[1] = (p[1] + dt * (neige ? 0.12 + p[2] * 0.08 : 1.3 + p[2] * 0.6)) % 1;
        p[0] = (p[0] + dt * derive * (neige ? 0.01 : 0.004) + 1) % 1;
        const x = p[0] * (w + 80) - 40, y = p[1] * h;
        if (neige) this.precip.circle(x + Math.sin(y / 30 + p[2] * 6) * 6, y, 1.5 + p[2] * 1.5);
        else this.precip.moveTo(x, y).lineTo(x + derive * 2, y + 16);
      }
      if (neige) this.precip.fill({ color: 0xffffff, alpha: 0.85 });
      else this.precip.stroke({ width: 1.5, color: 0xd8e4f0, alpha: 0.5 });
    }

    // Éclairs pendant les orages
    if (z.meteo === "orage" && Math.random() < dt * 0.3) this.flash = 1;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.eclair.clear();
    if (this.flash > 0) this.eclair.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: this.flash * 0.6 });
  }
}
