// Le rendu de web_power, commun à tout le plateau : ombrage dessin animé en trois tons et contours brun foncé.
// On assemble des « lots » de pièces colorées (unités libres), puis on les fige en deux maillages : les pièces et leurs contours.
import { THREE } from './scene.js';

const degrade = new THREE.DataTexture(new Uint8Array([105, 190, 255]), 3, 1, THREE.RedFormat);
degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.needsUpdate = true;
export { degrade };
/** Matériau des pièces (couleurs par sommet). */
export const MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade });
/** Matériau des contours : faces arrière, brun très foncé. */
export const CONT = new THREE.MeshBasicMaterial({ color: 0x24180f, side: THREE.BackSide });
/** Un matériau toon d'une seule couleur (eau, drapeaux, nuages…). */
export const toon = (couleur, extra = {}) => new THREE.MeshToonMaterial({ color: couleur, gradientMap: degrade, ...extra });

export const boite = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
export const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
export const sphere = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

/** Colore tous les sommets d'une géométrie. */
export function couleur(g, col) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const _c = new THREE.Vector3(), _t = new THREE.Vector3();
/** Le contour d'une pièce : la même forme grossie d'une épaisseur fixe autour de son centre (null pour les pièces plus fines que l'épaisseur). */
export function contour(g, ep) {
  g.computeBoundingBox(); g.boundingBox.getSize(_t);
  if (Math.min(_t.x, _t.y, _t.z) < ep * 0.999) return null;
  g.boundingBox.getCenter(_c);
  const o = g.clone().translate(-_c.x, -_c.y, -_c.z);
  o.scale((_t.x + 2 * ep) / _t.x, (_t.y + 2 * ep) / _t.y, (_t.z + 2 * ep) / _t.z);
  return o.translate(_c.x, _c.y, _c.z);
}
/** Fusionne des géométries non indexées (position, normale, couleur). */
export function fusion(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), souple = geos.some(g => g.attributes.souple), Sp = souple ? new Float32Array(n) : null; let o = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) C.set(g.attributes.color.array, o * 3);
    if (souple && g.attributes.souple) Sp.set(g.attributes.souple.array, o);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (souple) r.setAttribute('souple', new THREE.BufferAttribute(Sp, 1));  // 0 au pied, 1 à la cime : la part qui plie au vent (plateau.js)
  r.computeBoundingSphere();
  return r;
}
/** Un lot vide : pièces (g) et contours (o). */
export const lot = () => ({ g: [], o: [] });
/** Ajoute une pièce au lot : tournée de ry, posée en (x, y, z), colorée ; ep = épaisseur du contour (0 : sans contour). */
export function put(L, geo, col, x = 0, y = 0, z = 0, ry = 0, ep = 0.26) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (ry) g.rotateY(ry);
  g.translate(x, y, z); couleur(g, col); L.g.push(g);
  if (ep) { const o = contour(g, ep); if (o) L.o.push(couleur(o, 0)); }
  return g;
}
/** Fige un lot en un groupe (pièces + contours), ajouté à parent s'il est donné. */
export function fige(L, parent = null, mat = MAT) {
  const grp = new THREE.Group();
  if (L.g.length) { const m = new THREE.Mesh(fusion(L.g), mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
  if (L.o.length) grp.add(new THREE.Mesh(fusion(L.o), CONT));
  if (parent) parent.add(grp);
  return grp;
}
/** Libère les géométries d'un groupe figé. */
export function jeter(obj) { if (!obj) return; obj.parent?.remove(obj); obj.traverse(o => { if (o.isMesh || o.isLineSegments || o.isPoints) o.geometry?.dispose?.(); }); }
