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

// --- Occupation du sol (forêts, cultures, prairies, vignes, landes, roche) ---
// Une texture par carte, peinte pixel par pixel : bords déformés par du bruit (taches naturelles), cimes fines pour
// les forêts, mosaïque de parcelles pour les cultures, rangs pour les vignes ; découpée net sur les côtes.
const BRUIT = (() => {
  const n = 256, t = new Float32Array(n * n);
  let s = 12345;
  for (let i = 0; i < t.length; i++) t[i] = ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  return t;
})();

// Bruit de valeur lissé, période 256 cases ; f = taille d'une case en pixels
function bruit(x, y, f, decal = 0) {
  x = x / f + decal;
  y = y / f + decal * 1.7;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const a = (ii, jj) => BRUIT[((jj & 255) << 8) | (ii & 255)];
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = a(i, j) + (a(i + 1, j) - a(i, j)) * sx, b = a(i, j + 1) + (a(i + 1, j + 1) - a(i, j + 1)) * sx;
  return h + (b - h) * sy;
}

const hachage = (i, j) => BRUIT[(((j * 31 + i * 17) & 255) << 8) | ((i * 13 + j * 7) & 255)];

// Couleur d'un pixel selon la classe : palette = { c, p, f, v, l, r: [r, g, b] }
function teinte(code, px, py, palette) {
  const [r, g, b] = palette[code];
  let k = 0.94 + 0.12 * bruit(px, py, 90, 3);  // variations douces à grande échelle
  if (code === "f") {
    const cime = bruit(px, py, 2.2, 5) * 0.6 + bruit(px, py, 5, 7) * 0.4;  // houppiers serrés
    k *= 0.72 + 0.45 * cime;
  } else if (code === "c") {
    // Parcelles irrégulières : chaque case d'une grille déformée a sa nuance
    const wx = px + 6 * bruit(px, py, 24, 9), wy = py + 6 * bruit(px, py, 24, 11);
    k *= 0.9 + 0.2 * hachage(Math.floor(wx / 7), Math.floor(wy / 5));
  } else if (code === "p") {
    k *= 0.9 + 0.16 * bruit(px, py, 4, 13);
  } else if (code === "v") {
    k *= (px + py) % 4 < 1.5 ? 0.8 : 1.02;
  } else if (code === "l") {
    k *= bruit(px, py, 2.5, 15) > 0.72 ? 0.78 : 0.97 + 0.06 * bruit(px, py, 6, 17);
  } else {
    k *= 0.9 + 0.2 * bruit(px, py, 3, 19);
  }
  return [r * k, g * k, b * k];
}

const terrains = {};  // nom du thème → { cle, texture }

export function terrain(nom, carte, palette) {
  const o = carte.occupation;
  if (!o?.lignes?.length) return null;
  const [L, H] = carte.taille, cle = JSON.stringify([carte.taille, o.pas, o.lignes.length, o.lignes[0], o.lignes.at(-1)]);
  if (terrains[nom]?.cle !== cle) {
    terrains[nom]?.texture.destroy(true);
    terrains[nom] = { cle, texture: P.Texture.from(peindre(carte, o, palette)) };
  }
  const s = new P.Sprite(terrains[nom].texture);
  s.setSize(L, H);
  return s;
}

function peindre(carte, o, palette) {
  const [L, H] = carte.taille, nl = o.lignes.length, nc = o.lignes[0].length, d = o.decalage ?? 0;
  // shortcut: 2048 px au plus de côté (limite sûre des textures sur iPad) ; au-delà, le détail se perd en zoomant
  const k = Math.min(2048 / Math.max(L, H), 5 / o.pas), w = Math.ceil(L * k), h = Math.ceil(H * k);
  const [c, ctx] = toile(w, h), img = ctx.createImageData(w, h), px = img.data;
  const classe = (i, j) => o.lignes[Math.min(nl - 1, Math.max(0, j))][Math.min(nc - 1, Math.max(0, i))];
  const deform = 1.4;  // en cases : les limites entre classes ondulent au lieu de suivre la grille
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Deux échelles de déformation : grandes ondulations + franges fines (lisières naturelles)
      const cx = x / k / o.pas - 0.5 - d + deform * ((bruit(x, y, 22, 1) - 0.5) * 2 + (bruit(x, y, 5, 3) - 0.5) * 0.8);
      const cy = y / k / o.pas - 0.5 - d + deform * ((bruit(x, y, 22, 2) - 0.5) * 2 + (bruit(x, y, 5, 4) - 0.5) * 0.8);
      let code = classe(Math.round(cx), Math.round(cy));
      // Le long des côtes, on prolonge la terre voisine ; le découpage par les polygones donne le trait net
      for (let r = 1; code === "." && r <= 2; r++) {
        for (const [di, dj] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
          const v = classe(Math.round(cx) + di, Math.round(cy) + dj);
          if (v !== ".") { code = v; break; }
        }
      }
      if (code === "." || !palette[code]) continue;
      const [r, g, b] = teinte(code, x, y, palette), i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Découpe par les terres (départements, pays, zones dessinées) : côtes nettes et lisses
  const terres = carte.entites.filter((e) => e.type === "zone" && e.points && e.style !== "mer" && e.style !== "lac");
  if (!terres.length) return c;
  const [c2, ctx2] = toile(w, h);
  ctx2.beginPath();
  for (const e of terres) {
    e.points.forEach(([x, y], i) => (i ? ctx2.lineTo(x * k, y * k) : ctx2.moveTo(x * k, y * k)));
    ctx2.closePath();
  }
  ctx2.save();
  ctx2.clip("nonzero");
  ctx2.drawImage(c, 0, 0);
  ctx2.restore();
  return c2;
}
