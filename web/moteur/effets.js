// Effets visuels réutilisables : particules nommées et interpolations (tweens) simples.
// Un jeu ou un thème ajoute un effet nommé : EFFETS.fumee = (fx, x, y, o) => fx.particule({ … }).
const P = window.PIXI;
const MAX_PARTICULES = 300;  // borne le coût sur iPad / Raspberry Pi

export const EFFETS = {
  // Terre soulevée derrière une unité qui roule (o.dx, o.dy : direction du mouvement)
  poussiere(fx, x, y, o) {
    fx.particule({
      x: x - o.dx * 14 + (Math.random() - 0.5) * 8, y: y - o.dy * 14 + (Math.random() - 0.5) * 8,
      vx: -o.dx * 6 + (Math.random() - 0.5) * 6, vy: -o.dy * 6 + (Math.random() - 0.5) * 6,
      duree: 1.4, rayon: 3, croissance: 7, couleur: 0xc9b48a, alpha: 0.45,
    });
  },
  fumee(fx, x, y) {
    fx.particule({ x, y, vx: (Math.random() - 0.5) * 4, vy: -10, duree: 3, rayon: 4, croissance: 10, couleur: 0x9a9a9a, alpha: 0.4 });
  },
  // Cercle qui s'élargit et s'efface, de taille constante à l'écran (o.zoom)
  onde(fx, x, y, o) {
    const g = fx.dessus.addChild(new P.Graphics().circle(0, 0, 30).stroke({ width: 2.5, color: 0xffffff }));
    g.position.set(x, y);
    g.scale.set(0.3 / o.zoom);
    g.alpha = 0.8;
    fx.interpoler(g.scale, { x: 1 / o.zoom, y: 1 / o.zoom }, 0.5);
    fx.interpoler(g, { alpha: 0 }, 0.5, () => g.destroy());
  },
};

const adoucir = (t) => 1 - (1 - t) ** 3;

export class Effets {
  // sous : conteneur des particules (sous les unités) ; dessus : effets au-dessus de tout le monde
  constructor(sous, dessus) {
    this.graphique = sous.addChild(new P.Graphics());
    this.dessus = dessus;
    this.particules = [];
    this.tweens = [];
  }

  emettre(nom, x, y, options = {}) { EFFETS[nom]?.(this, x, y, options); }

  particule(p) {
    if (this.particules.length < MAX_PARTICULES) this.particules.push({ vx: 0, vy: 0, croissance: 0, ...p, age: 0 });
  }

  // Fait passer les propriétés numériques de objet vers cibles en duree secondes
  interpoler(objet, cibles, duree, fin) {
    const depart = Object.fromEntries(Object.keys(cibles).map((k) => [k, objet[k]]));
    this.tweens.push({ objet, depart, cibles, duree, fin, t: 0 });
  }

  image(dt) {
    this.tweens = this.tweens.filter((tw) => {
      tw.t = Math.min(1, tw.t + dt / tw.duree);
      const k = adoucir(tw.t);
      for (const c in tw.cibles) tw.objet[c] = tw.depart[c] + (tw.cibles[c] - tw.depart[c]) * k;
      if (tw.t < 1) return true;
      tw.fin?.();
      return false;
    });
    if (!this.particules.length && !this.actif) return;
    const g = this.graphique.clear();
    this.particules = this.particules.filter((p) => (p.age += dt) < p.duree);
    for (const p of this.particules) {
      const t = p.age / p.duree;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.circle(p.x, p.y, p.rayon + p.croissance * t).fill({ color: p.couleur, alpha: p.alpha * (1 - t) });
    }
    this.actif = this.particules.length > 0;
  }
}
