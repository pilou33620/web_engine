// Outils de dessin partagés par les thèmes.
const P = window.PIXI;

// Aléatoire reproductible par entité (mêmes arbres et détails à chaque redessin)
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

export function trait(g, points, style) {
  g.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.stroke({ cap: "round", join: "round", ...style });
}

// Pointillés le long d'une polyligne
export function pointilles(g, points, long, vide, style) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    for (let s = 0; s < d; s += long + vide) {
      const e = Math.min(s + long, d);
      g.moveTo(x1 + ux * s, y1 + uy * s).lineTo(x1 + ux * e, y1 + uy * e);
    }
  }
  g.stroke(style);
}

// Appelle f(x, y) tous les `pas` mètres le long d'une polyligne
export function lelong(points, pas, f) {
  let reste = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1);
    for (let s = reste; s < d; s += pas) f(x1 + ((x2 - x1) * s) / d, y1 + ((y2 - y1) * s) / d);
    reste = (reste - d) % pas;
    if (reste < 0) reste += pas;
  }
}

// Contour d'une zone : rectangle (x, y, w, h) ou polygone (points)
export function forme(g, e) {
  return e.points ? g.poly(e.points.flat()) : g.rect(e.x, e.y, e.w, e.h);
}

// Boîte englobante d'une zone (utile pour semer des détails dedans)
export function boite(e) {
  if (!e.points) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const xs = e.points.map((p) => p[0]), ys = e.points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Point où poser le nom d'une zone ou d'une ligne
export function centre(e) {
  if (e.ancre) return { x: e.ancre[0], y: e.ancre[1] };
  if (e.type === "ligne") return { x: e.points[e.points.length >> 1][0], y: e.points[e.points.length >> 1][1] };
  if (e.type === "zone" && e.points) {
    const b = boite(e);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  return e.w ? { x: e.x + e.w / 2, y: e.y + e.h / 2 } : { x: e.x, y: e.y };
}

export function semis(g, b, r, nb, couleurs, rmin, rmax) {
  for (let i = 0; i < nb; i++) g.circle(b.x + r() * b.w, b.y + r() * b.h, rmin + r() * (rmax - rmin)).fill(couleurs[i % couleurs.length]);
}

// Étiquette avec fond (et barre colorée à gauche en option), centrée sur sa position
export function etiquette(texte, style, fond, barre) {
  const c = new P.Container();
  const t = new P.Text({ text: texte, style });
  const px = 8, py = 4;
  const g = new P.Graphics().roundRect(-px, -py, t.width + px * 2, t.height + py * 2, 4).fill(fond);
  if (barre) g.rect(-px, -py, 4, t.height + py * 2).fill(barre);
  c.addChild(g, t);
  c.pivot.set(t.width / 2, t.height / 2);
  return c;
}

// Nom de lieu sans fond (mers, lacs, rivières)
export function nomLieu(texte, style) {
  const t = new P.Text({ text: texte, style });
  t.anchor.set(0.5);
  return t;
}
