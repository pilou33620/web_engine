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

// --- Occupation du sol, peinte « vue du ciel » à la manière de web_conquete ---
// Fond de toute la carte : herbe olive et dorée, bois sombres, landes ocre, sable au rivage, mer turquoise claire
// sur les hauts-fonds et profonde au large, versants ombrés par un soleil du nord-ouest. De près, details.js ajoute
// les arbres un par un et les champs en parcelles, sur le même découpage (codeA).
const BRUIT = (() => {
  const n = 256, t = new Float32Array(n * n);
  let s = 12345;
  for (let i = 0; i < t.length; i++) t[i] = ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  return t;
})();

// Bruit de valeur lissé (0 à 1), période 256 ; f = taille d'une case du bruit, dans l'unité de x et y
export function bruit(x, y, f, decal = 0) {
  x = x / f + decal;
  y = y / f + decal * 1.7;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const a = (ii, jj) => BRUIT[((jj & 255) << 8) | (ii & 255)];
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = a(i, j) + (a(i + 1, j) - a(i, j)) * sx, b = a(i, j + 1) + (a(i + 1, j + 1) - a(i, j + 1)) * sx;
  return h + (b - h) * sy;
}

const lerp = (a, b, t) => a + (b - a) * t;
export const MER_LARGE = [28, 88, 108];
const MER_BORD = [70, 150, 148], SABLE = [227, 211, 163], ECUME = [196, 226, 222];
const COUL = { f: [58, 104, 52], v: [143, 132, 86], l: [163, 158, 104], r: [178, 172, 156] };

// Lecture de la carte d'occupation du sol et du relief, partagée par le fond et par les détails
export function paysage(carte) {
  const o = carte.occupation, nl = o.lignes.length, nc = o.lignes[0].length, d = o.decalage ?? 0, pas = o.pas;
  const brut = (i, j) => o.lignes[Math.min(nl - 1, Math.max(0, j))][Math.min(nc - 1, Math.max(0, i))];
  // Code d'un point (unités du monde) : les limites ondulent au lieu de suivre la grille ; prolonge la terre d'une case
  const codeA = (x, y) => {
    const cx = x / pas - 0.5 - d, cy = y / pas - 0.5 - d;
    const ox = 1.3 * (bruit(cx, cy, 3.1, 1) - 0.5) * 2 + 0.45 * (bruit(cx, cy, 0.7, 3) - 0.5) * 2;
    const oy = 1.3 * (bruit(cx, cy, 3.1, 2) - 0.5) * 2 + 0.45 * (bruit(cx, cy, 0.7, 4) - 0.5) * 2;
    return brut(Math.round(cx + ox), Math.round(cy + oy));
  };
  // Distances (en cases) par chanfrein en deux passes : à la terre côté mer, à l'eau côté terre
  const distance = (loin) => {
    const dist = new Float32Array(nc * nl);
    for (let j = 0; j < nl; j++) for (let i = 0; i < nc; i++) dist[j * nc + i] = loin(brut(i, j)) ? 1e4 : 0;
    const passe = (sens) => {
      for (let a = 0; a < nl; a++) for (let b = 0; b < nc; b++) {
        const j = sens > 0 ? a : nl - 1 - a, i = sens > 0 ? b : nc - 1 - b, k = j * nc + i;
        if (!dist[k]) continue;
        for (const [di, dj, w] of [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]]) {
          const ii = i + di * sens, jj = j + dj * sens;
          if (ii >= 0 && jj >= 0 && ii < nc && jj < nl) dist[k] = Math.min(dist[k], dist[jj * nc + ii] + w);
        }
      }
    };
    passe(1);
    passe(-1);
    return (x, y) => {
      const u = Math.min(nc - 1.001, Math.max(0, x / pas - 0.5 - d)), v = Math.min(nl - 1.001, Math.max(0, y / pas - 0.5 - d));
      const i = u | 0, j = v | 0, fx = u - i, fy = v - j, k = j * nc + i, D = dist;
      return lerp(lerp(D[k], D[k + 1], fx), lerp(D[k + nc], D[k + nc + 1], fx), fy);
    };
  };
  const merA = distance((c) => c === "."), rivageA = distance((c) => c !== ".");
  // Pente du relief (ombrage) : normalisée sur les pentes fortes de la carte, pour toute unité du monde
  const rel = carte.relief?.valeurs?.length ? carte.relief : null;
  let pente = () => [0, 0];
  if (rel) {
    const v = rel.valeurs, rl = v.length, rc = v[0].length, rp = rel.pas;
    const h = (x, y) => {
      const u = Math.min(rc - 1.001, Math.max(0, x / rp)), w = Math.min(rl - 1.001, Math.max(0, y / rp)), i = u | 0, j = w | 0;
      return lerp(lerp(v[j][i], v[j][i + 1], u - i), lerp(v[j + 1][i], v[j + 1][i + 1], u - i), w - j);
    };
    const normes = [];
    for (let j = 1; j < rl - 1; j += 2) for (let i = 1; i < rc - 1; i += 2) normes.push(Math.hypot(v[j][i + 1] - v[j][i - 1], v[j + 1][i] - v[j - 1][i]));
    normes.sort((a, b) => a - b);
    const k = 1 / (normes[Math.floor(normes.length * 0.97)] || 1);
    pente = (x, y) => [(h(x + rp, y) - h(x - rp, y)) * k, (h(x, y + rp) - h(x, y - rp)) * k];
  }
  return { codeA, merA, rivageA, pente, pas };
}

// Couleur du fond en un point (unités du monde) ; null = rien (hors carte)
function couleur(P, x, y) {
  const code = P.codeA(x, y), cases = x / P.pas, lignes = y / P.pas;
  if (code === ".") {
    const m = P.merA(x, y);
    if (m < 0.35) return ECUME;
    const t = Math.min(1, Math.max(0, (m - 0.6) / 14));
    const c = MER_BORD.map((v, i) => lerp(v, MER_LARGE[i], t));
    const k = 0.97 + 0.06 * bruit(cases, lignes, 2.5, 21);
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  let c;
  if (code === "c" || code === "p") {
    // herbe olive et dorée en pays de quelques kilomètres ; prairies plus vertes
    const a = bruit(cases, lignes, 4, 5) * 0.75 + bruit(cases, lignes, 1.2, 6) * 0.25, b = bruit(cases, lignes, 7, 7) * 0.4;
    const vert = code === "p" ? 0.35 + 0.5 * a : a;
    c = [lerp(lerp(206, 124, vert), 196, b), lerp(lerp(186, 166, vert), 178, b), lerp(lerp(122, 90, vert), 120, b)];
  } else c = [...COUL[code]];
  if (code === "f") {
    const n = bruit(cases, lignes, 2.5, 8);
    c = [lerp(c[0], 47, n * 0.5), lerp(c[1], 90, n * 0.5), lerp(c[2], 51, n * 0.5)];  // feuillus et pins mêlés
  }
  if (P.rivageA(x, y) < 0.9 + 0.5 * bruit(cases, lignes, 1.5, 10)) c = [...SABLE];  // plages et dunes au bord de l'eau
  const [gx, gy] = P.pente(x, y), k = Math.min(1.3, Math.max(0.62, 1 - (gx * 0.6 + gy * 0.8) * 0.9)) * (0.95 + 0.1 * bruit(cases, lignes, 0.9, 9));
  return [c[0] * k, c[1] * k, c[2] * k];
}

const fonds = {};  // une texture de fond par carte (partagée par les thèmes)

export function terrain(carte) {
  const o = carte.occupation;
  if (!o?.lignes?.length) return null;
  const [L, H] = carte.taille, cle = JSON.stringify([carte.taille, o.pas, o.lignes.length, o.lignes[0], o.lignes.at(-1)]);
  if (fonds.cle !== cle) {
    fonds.texture?.destroy(true);
    Object.assign(fonds, { cle, texture: P.Texture.from(peindre(carte)) });
  }
  const s = new P.Sprite(fonds.texture);
  s.setSize(L, H);
  return s;
}

function peindre(carte) {
  const [L, H] = carte.taille, Pg = paysage(carte);
  // shortcut: 2048 px au plus de côté (limite sûre des textures sur iPad) ; de près, details.js prend le relais
  const k = Math.min(2048 / Math.max(L, H), 5 / Pg.pas), w = Math.ceil(L * k), h = Math.ceil(H * k);
  const [c, ctx] = toile(w, h), img = ctx.createImageData(w, h), px = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = couleur(Pg, (x + 0.5) / k, (y + 0.5) / k), i = (y * w + x) * 4;
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Mer peinte partout, terres par-dessus découpées par les polygones : côtes nettes et lisses
  const terres = carte.entites.filter((e) => e.type === "zone" && e.points && e.style !== "mer" && e.style !== "lac");
  if (!terres.length) return c;
  const [c2, ctx2] = toile(w, h);
  const im2 = ctx2.createImageData(w, h), q = im2.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xu = (x + 0.5) / k, yu = (y + 0.5) / k, m = Pg.merA(xu, yu), i = (y * w + x) * 4;
      const t = Math.min(1, Math.max(0, (m - 0.6) / 14)), col = m < 0.35 ? ECUME : MER_BORD.map((v, n) => lerp(v, MER_LARGE[n], t));
      q[i] = col[0];
      q[i + 1] = col[1];
      q[i + 2] = col[2];
      q[i + 3] = 255;
    }
  }
  ctx2.putImageData(im2, 0, 0);
  ctx2.save();
  ctx2.beginPath();
  for (const e of terres) {
    e.points.forEach(([x, y], i) => (i ? ctx2.lineTo(x * k, y * k) : ctx2.moveTo(x * k, y * k)));
    ctx2.closePath();
  }
  // Écume sur le rivage : un trait clair sous les terres, la moitié côté mer reste visible
  ctx2.strokeStyle = "rgba(220, 238, 232, 0.55)";
  ctx2.lineWidth = Math.max(1.5, 3 * k * Pg.pas / 12);
  ctx2.stroke();
  ctx2.clip("nonzero");
  ctx2.drawImage(c, 0, 0);
  ctx2.restore();
  return c2;
}
