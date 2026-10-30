// Thèmes graphiques : chaque thème dessine les mêmes entités à sa façon.
// Un jeu peut ajouter son propre thème en suivant la même forme d'objet.
const P = window.PIXI;

// Aléatoire reproductible par entité (mêmes haies et arbres à chaque redessin)
export function alea(id) {
  let s = 0;
  for (const c of id) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trait(g, points, style) {
  g.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.stroke({ cap: "round", join: "round", ...style });
}

// Pointillés le long d'une polyligne
function pointilles(g, points, long, vide, style) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    for (let s = 0; s < d; s += long + vide) {
      const e = Math.min(s + long, d);
      g.moveTo(x1 + ux * s, y1 + uy * s).lineTo(x1 + ux * e, y1 + uy * e);
    }
  }
  g.stroke(style);
}

function bosquet(g, p, r, nb, couleurs, rmin, rmax) {
  for (let i = 0; i < nb; i++) {
    g.circle(p.x + r() * p.w, p.y + r() * p.h, rmin + r() * (rmax - rmin)).fill(couleurs[i % couleurs.length]);
  }
}

function etiquette(texte, style, fond, barre) {
  const c = new P.Container();
  const t = new P.Text({ text: texte, style });
  const px = 8, py = 4;
  const g = new P.Graphics()
    .roundRect(-px, -py, t.width + px * 2, t.height + py * 2, 4)
    .fill(fond);
  if (barre) g.rect(-px, -py, 4, t.height + py * 2).fill(barre);
  c.addChild(g, t);
  c.pivot.set(t.width / 2, t.height / 2);
  return c;
}

// ---------------------------------------------------------------- Ferme
const SOLS_FERME = {
  chaume: [0xc9b47c, 0xb8a36b], culture: [0x4f8a3c, 0x447d33], prairie: [0x8db35e, 0x80a653],
  labour: [0x6b4a32, 0x5b3e29], colza: [0x9aa83e, 0x8a982f], foret: [0x2f5a2a, 0x2f5a2a],
};

export const ferme = {
  nom: "Ferme", css: "ferme", fond: 0x55703f, base: 0xa89668,
  sol(g, p) {
    const [c1, c2] = SOLS_FERME[p.sol] ?? SOLS_FERME.chaume, r = alea(p.id);
    g.rect(p.x, p.y, p.w, p.h).fill(c1);
    if (p.sol === "foret") return bosquet(g, p, r, (p.w * p.h) / 220, [0x3f7136, 0x356530, 0x4a7d3e, 0x2c5627], 9, 17);
    if (p.sens) for (let x = p.x + 4; x < p.x + p.w; x += 8) g.rect(x, p.y, 3, p.h).fill(c2);
    else for (let y = p.y + 4; y < p.y + p.h; y += 8) g.rect(p.x, y, p.w, 3).fill(c2);
    if (p.sol === "prairie") for (let i = 0; i < 5; i++) g.ellipse(p.x + 20 + r() * (p.w - 40), p.y + 20 + r() * (p.h - 40), 4, 2.5).fill(0xf2f0e6);
  },
  haie(g, e) {
    const r = alea(e.id);
    trait(g, e.points, { width: 7, color: 0x2e5a29 });
    const [[x1, y1], [x2, y2]] = e.points, d = Math.hypot(x2 - x1, y2 - y1);
    for (let s = 0; s < d; s += 12 + r() * 14) {
      g.circle(x1 + ((x2 - x1) * s) / d, y1 + ((y2 - y1) * s) / d, 6 + r() * 6).fill(r() < 0.5 ? 0x2f6a2c : 0x3a7a35);
    }
  },
  riviere(g, e) {
    trait(g, e.points, { width: 40, color: 0x5d8a46 });
    trait(g, e.points, { width: 24, color: 0x3a6ea6 });
    trait(g, e.points, { width: 5, color: 0x77a6d6, alpha: 0.5 });
  },
  route(g, e) {
    trait(g, e.points, { width: 26, color: 0x3a3a3a, cap: "butt" });
    trait(g, e.points, { width: 22, color: 0x505050, cap: "butt" });
    pointilles(g, e.points, 14, 12, { width: 2, color: 0xe8e8e0 });
  },
  frontiere() {},
  ville(e) {
    const g = new P.Graphics().ellipse(e.x, e.y, 75, 48).fill(0xb9ad8c);
    g.rect(e.x - 45, e.y - 30, 52, 24).fill(0xa8473a);
    g.rect(e.x + 12, e.y - 26, 42, 22).fill(0x6f7f8f);
    g.rect(e.x - 20, e.y + 6, 50, 20).fill(0x7d8ea0);
    const lab = etiquette(e.nom, { fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: "600", fill: 0xf5e7c0 }, { color: 0x6b5a2a, alpha: 0.9 });
    lab.position.set(e.x, e.y + 62);
    return { dessin: g, etiquette: lab };
  },
  mobile(e) {
    if (e.type !== "tracteur") return null;
    const c = new P.Container();
    c.addChild(new P.Graphics()
      .rect(-9, 10, 18, 3).fill(0xb03030)            // outil attelé
      .rect(-1, 7, 2, 5).fill(0x333333)
      .rect(-7, -7, 4, 6).fill(0x111111).rect(3, -7, 4, 6).fill(0x111111)   // roues
      .rect(-7, 2, 3, 4).fill(0x111111).rect(4, 2, 3, 4).fill(0x111111)
      .rect(-4, -10, 8, 18).fill(e.couleur)            // carrosserie
      .rect(-3, -1, 6, 5).fill(0xf0f0f0));             // cabine
    c.scale.set(1.6);
    return c;
  },
  orientation: (e) => e.angle + Math.PI / 2,
};

// ---------------------------------------------------------------- Carte stratégique
const SOLS_CARTE = {
  chaume: 0xcdb984, culture: 0xa3aa6c, prairie: 0xb5b379, labour: 0xb99a6b, colza: 0xb2b262, foret: 0x7a8550,
};
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";

export const carte = {
  nom: "Carte", css: "carte", fond: 0x2b3d49, base: 0xcbb98a, unitesTailleFixe: true,
  sol(g, p) {
    g.rect(p.x - 4, p.y - 4, p.w + 8, p.h + 8).fill(SOLS_CARTE[p.sol] ?? SOLS_CARTE.chaume);
    if (p.sol === "foret") bosquet(g, p, alea(p.id), (p.w * p.h) / 90, [0x55603a, 0x4a5532, 0x606b40], 3, 6);
  },
  haie(g, e) { trait(g, e.points, { width: 2, color: 0x6b7340, alpha: 0.35 }); },
  riviere(g, e) {
    trait(g, e.points, { width: 22, color: 0x9fb4b0, alpha: 0.5 });
    trait(g, e.points, { width: 10, color: 0x3e6f98 });
  },
  route(g, e) { pointilles(g, e.points, 18, 8, { width: 4, color: 0x7a5636, alpha: 0.85 }); },
  frontiere(g, e) {
    const c = P.Color.shared.setValue(e.couleur).toNumber();
    trait(g, e.points, { width: 22, color: c, alpha: 0.22 });
    trait(g, e.points, { width: 4, color: c, alpha: 0.9 });
  },
  ville(e) {
    const g = new P.Graphics()
      .circle(e.x, e.y, 13).fill(0x5a3a2a).stroke({ width: 3, color: 0xf0e6cc })
      .rect(e.x - 1, e.y - 34, 2, 22).fill(0x3a2a1a)
      .poly([e.x + 1, e.y - 34, e.x + 16, e.y - 29, e.x + 1, e.y - 24]).fill(0xb83a2e);
    const lab = new P.Container();
    const nom = etiquette(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 15, fontWeight: "600", fill: 0xf0e6cc, letterSpacing: 0.5 }, { color: 0x262626, alpha: 0.92 }, 0xb83a2e);
    const pop = etiquette(String(e.population), { fontFamily: SERIF, fontSize: 12, fill: 0xf0e6cc }, { color: 0x3a2a2a, alpha: 0.95 });
    nom.y = 30;
    pop.position.set(nom.width / 2 + 4, 6);
    lab.addChild(nom, pop);
    lab.position.set(e.x, e.y);
    return { dessin: g, etiquette: lab };
  },
  mobile(e) {
    if (e.type !== "regiment") return null;
    const c = new P.Container();
    c.addChild(new P.Graphics()
      .circle(0, 0, 20).fill(0xf0e6cc).stroke({ width: 3, color: 0x8a1f1f })
      .circle(0, -4, 6).fill(0x2b3f7a)
      .roundRect(-7, 2, 14, 12, 3).fill(0x2b3f7a));
    const t = new P.Text({ text: String(e.effectif), style: { fontFamily: SERIF, fontSize: 12, fontWeight: "700", fill: 0xf0e6cc } });
    const fond = new P.Graphics().roundRect(-t.width / 2 - 5, 22, t.width + 10, t.height + 2, 3).fill({ color: 0x262626, alpha: 0.9 });
    t.anchor.set(0.5, 0);
    t.y = 23;
    c.addChild(fond, t);
    return c;
  },
  orientation: () => 0,
};

export const THEMES = { ferme, carte };
