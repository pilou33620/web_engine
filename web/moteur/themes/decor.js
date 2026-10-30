// Décor des thèmes : ombrage du relief, teinte d'altitude, papier et vignette.
// Les textures sont générées une seule fois par carte (puis gardées), jamais à chaque image.
const P = window.PIXI;
const LUMIERE = [-0.5, -0.5, 0.707];   // vient du nord-ouest, 45° au-dessus de l'horizon
const textures = {};             // nom du décor → { cle, texture }
let papier = null;

function toile(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

// Une valeur par nœud de la grille : ombre (1 = aucune) × teinte d'altitude ; la mer (0 m) reste neutre
function ombrage(relief, force, teinte) {
  const { pas, valeurs: v } = relief, nl = v.length, nc = v[0].length;
  const [c, ctx] = toile(nc, nl);
  const img = ctx.createImageData(nc, nl);
  const max = v.flat().reduce((m, h) => Math.max(m, h), 1);
  // La mer et le bord comptent comme le point lui-même : pas de falaise sur la côte
  const a = (x, y, h) => (v[y]?.[x] > 0 ? v[y][x] : h);
  const pente = (i, j) => [(a(i + 1, j, v[j][i]) - a(i - 1, j, v[j][i])) / (2 * pas), (a(i, j + 1, v[j][i]) - a(i, j - 1, v[j][i])) / (2 * pas)];
  // Unités du monde quelconques (m, 100 m, 250 m…) : on cale les pentes fortes (97e centile) sur ~35°, les plaines restent claires
  const normes = [];
  for (let j = 0; j < nl; j++) for (let i = 0; i < nc; i++) if (v[j][i] > 0) normes.push(Math.hypot(...pente(i, j)));
  normes.sort((x, y) => x - y);
  const exageration = 0.7 / (normes[Math.floor(normes.length * 0.97)] || 1);
  for (let j = 0; j < nl; j++) {
    for (let i = 0; i < nc; i++) {
      const h = v[j][i], o = (j * nc + i) * 4;
      const [dx, dy] = pente(i, j).map((d) => d * exageration);
      const eclairage = (-dx * LUMIERE[0] - dy * LUMIERE[1] + LUMIERE[2]) / Math.hypot(dx, dy, 1);
      const k = h > 0 ? 1 - force * Math.min(1, Math.max(0, 0.85 - eclairage) * 1.6) : 1;
      const t = h / max;
      // Bas pays légèrement verdis, hauteurs plus chaudes
      const [r, g, b] = h > 0 && teinte ? [0.95 + 0.05 * t, 1 - 0.05 * t, 0.9 - 0.06 * t] : [1, 1, 1];
      img.data.set([r * k * 255, g * k * 255, b * k * 255, 255], o);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Ombrage + vignette sur une toile qui déborde de la carte de moitié de chaque côté (évite une coupure nette)
function texteDecor(carte, { force, teinte, vignette }) {
  const [L, H] = carte.taille;
  const w = 1024, h = Math.round((1024 * H) / L), [c, ctx] = toile(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const rel = carte.relief;
  if (rel?.valeurs?.length && rel.valeurs[0].length) {
    const ombre = ombrage(rel, force, teinte), ech = w / (2 * L);
    // Le centre du pixel i est le nœud i : décalage d'un demi-pas
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(ombre, (L / 2 - rel.pas / 2) * ech, (H / 2 - rel.pas / 2) * ech, ombre.width * rel.pas * ech, ombre.height * rel.pas * ech);
  }
  if (vignette) {
    // Ellipse : bords de la carte à 0,5, bords de la toile à 1 ; on revient au blanc pour ne laisser aucune coupure
    ctx.globalCompositeOperation = "multiply";
    ctx.setTransform(1, 0, 0, h / w, 0, 0);
    const grad = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    const brun = (k) => `rgb(${255 - 130 * k * vignette}, ${255 - 135 * k * vignette}, ${255 - 135 * k * vignette})`;
    grad.addColorStop(0, brun(0));
    grad.addColorStop(0.35, brun(0.04));
    grad.addColorStop(0.55, brun(1));
    grad.addColorStop(0.75, brun(0.6));
    grad.addColorStop(1, brun(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, w);
  }
  return c;
}

// Grain de papier répétable : bruit fin, fibres et quelques taches
function textePapier() {
  const n = 256, [c, ctx] = toile(n, n), img = ctx.createImageData(n, n);
  for (let o = 0; o < img.data.length; o += 4) {
    const v = 255 - Math.random() * 22;
    img.data.set([v, v - 1, v - 3, 255], o);
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.lineCap = "round";
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * n, y = Math.random() * n, a = Math.random() * Math.PI, l = 4 + Math.random() * 14;
    ctx.strokeStyle = `rgba(120, 95, 60, ${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * l / 2, y + Math.sin(a + 0.4) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * n, y = Math.random() * n, r = 20 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(170, 130, 80, 0.10)");
    g.addColorStop(1, "rgba(170, 130, 80, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
  }
  return P.Texture.from(c);
}

// Décor réutilisable : force de l'ombre (0 à 1), teinte d'altitude, vignette (0 à 1), grain de papier
export function decor(nom, options) {
  return (rendu, carte) => {
    const [L, H] = carte.taille;
    const cle = JSON.stringify([carte.taille, carte.relief?.pas, carte.relief?.valeurs.flat().reduce((x, y) => x + y, 0), options]);
    if (textures[nom]?.cle !== cle) {
      textures[nom]?.texture.destroy(true);
      const avecRelief = carte.relief?.valeurs?.length;
      textures[nom] = { cle, texture: avecRelief || options.vignette ? P.Texture.from(texteDecor(carte, options)) : null };
    }
    const sur = new P.Container();
    const t = textures[nom].texture;
    if (t) {
      const s = new P.Sprite(t);
      s.position.set(-L / 2, -H / 2);
      s.setSize(2 * L, 2 * H);
      s.blendMode = "multiply";
      sur.addChild(s);
    }
    if (options.papier) {
      papier ??= textePapier();
      const p = new P.TilingSprite({ texture: papier, width: 2 * L, height: 2 * H });
      p.position.set(-L / 2, -H / 2);
      p.tileScale.set(1.5);
      p.blendMode = "multiply";
      sur.addChild(p);
    }
    return { sur };
  };
}
