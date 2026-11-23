// Essai sans navigateur : put() de toon.js (pièce tournée, posée, colorée, et son contour) donne les mêmes sommets que les
// opérations de three.js qu'il remplace (rotateY, translate ; contour : la pièce grossie autour de son centre par scale).
// Usage : node outils/essai-toon.mjs   (n'imprime qu'un bilan)
import { register } from 'node:module';
import assert from 'node:assert/strict';

// toon.js prend THREE de scene.js, qui démarre le moteur WebGL : ici, three.js seul
register('data:text/javascript,' + encodeURIComponent(`
export async function load(url, ctx, suivant) {
  const r = await suivant(url, ctx);
  if (!url.endsWith('/rendu/toon.js')) return r;
  return { ...r, source: String(r.source).replace("import { THREE } from './scene.js';", "import * as THREE from '../three/three.module.js';") };
}`));
const THREE = await import('../lib/three/three.module.js');
const T = await import('../lib/rendu/toon.js');

// la référence : ce que faisait put() avec three.js (couleur et contour à l'ancienne)
function reference(geo, col, x, y, z, ry, ep) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  const c = new THREE.Color(col);
  const teinte = (h, k) => { const a = new Float32Array(h.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([k.r, k.g, k.b], i); return a; };
  const res = { g: g.attributes.position.array, n: g.attributes.normal.array, c: teinte(g, c) };
  if (ep) {
    const t = new THREE.Vector3(), m = new THREE.Vector3();
    g.computeBoundingBox(); g.boundingBox.getSize(t); g.boundingBox.getCenter(m);
    if (Math.min(t.x, t.y, t.z) >= ep * 0.999) res.o = g.clone().translate(-m.x, -m.y, -m.z).scale((t.x + 2 * ep) / t.x, (t.y + 2 * ep) / t.y, (t.z + 2 * ep) / t.z).translate(m.x, m.y, m.z).attributes.position.array;
  }
  return res;
}
const proche = (a, b, nom) => { assert.equal(a.length, b.length, nom); for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-5, `${nom}[${i}] : ${a[i]} au lieu de ${b[i]}`); };
const formes = () => [T.boite(1.2, 0.5, 0.7), T.cone(0.6, 1.4, 7), T.sphere(0.8, 0), T.sphere(0.3, 1), T.cyl(0.2, 0.3, 1.5, 5), T.boite(0.008, 0.11, 0.008)];
const cas = [[0x3e7f34, 1, 2, 3, 0, 0.26], [0xf4f6f8, -4, 0.5, 2, 1.3, 0.09], ['#ff8800', 0, 0, 0, 2.7, 0], [new THREE.Color(0.2, 0.4, 0.6), 7, -1, 0.25, -0.8, 0.003]];
let n = 0;
for (const [col, x, y, z, ry, ep] of cas) for (const f of formes()) {
  const avant = f.attributes.position.array.slice(), L = T.lot();
  T.put(L, f, col, x, y, z, ry, ep);
  const r = reference(f, col, x, y, z, ry, ep);
  proche(L.g[0].attributes.position.array, r.g, 'position'); proche(L.g[0].attributes.normal.array, r.n, 'normale'); proche(L.g[0].attributes.color.array, r.c, 'couleur');
  assert.equal(L.o.length, r.o ? 1 : 0, 'contour');
  if (r.o) proche(L.o[0].attributes.position.array, r.o, 'contour');
  proche(f.attributes.position.array, avant, 'forme d’origine intacte');
  n++;
}
console.log(`toon.js : OK (${n} pièces identiques aux opérations de three.js)`);
