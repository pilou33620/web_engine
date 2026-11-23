// Essai sans navigateur : en forêt, aucun arbre ni buisson du plateau (plateau.js) ne pousse sur le ruban d'une route,
// et les cases de route gardent leur forêt. Le moteur de rendu WebGL est remplacé par un faux, les poses du décor sont relevées.
// Usage : node outils/essai-arbres-routes.mjs   (n'imprime qu'un bilan)
import { register } from 'node:module';

// scene.js : un faux moteur de rendu ; plateau.js : chaque pose du décor est relevée (couleur, x, z)
const crochets = `
export async function load(url, ctx, suivant) {
  const r = await suivant(url, ctx);
  const remplacer = (a, b) => { const s = String(r.source); if (!s.includes(a)) throw new Error('essai à refaire, introuvable : ' + a); return { ...r, source: s.replace(a, b) }; };
  if (url.endsWith('/rendu/scene.js')) return remplacer('new THREE.WebGLRenderer(', 'new globalThis.FauxRendu(');
  if (url.endsWith('/rendu/plateau.js')) return remplacer('=> put(L, g, col, x, y, z, ry, ep);', '=> (globalThis.poses.push([col, x, z]), put(L, g, col, x, y, z, ry, ep));');
  return r;
}`;
register('data:text/javascript,' + encodeURIComponent(crochets));
const rien = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : rien), apply: () => rien, construct: () => rien, set: () => true });
Object.assign(globalThis, {
  FauxRendu: function () { return rien; }, poses: [], document: { getElementById: () => ({ clientWidth: 800, clientHeight: 600, addEventListener() {} }) },
  addEventListener() {}, requestAnimationFrame() {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, location: { search: '' },
  ResizeObserver: class { observe() {} },
});
globalThis.navigator ??= {};

const { voisin } = await import('../lib/rendu/scene.js');
const plateau = await import('../lib/rendu/plateau.js');
const TRONC = 0x6e4a2c, BUISSON = 0x4f8f3a;  // tronc des arbres, buisson de forêt l'été

// une forêt de 9 × 9 cases à 6 arbres ; une route droite sur la rangée du milieu, un embranchement et un virage
const l = 9, h = 9, N = l * h, c = (x, y) => y * l + x;
const carte = { l, h, terrain: Array(N).fill(4), foret: Array(N).fill(1), arbres: Array(N).fill(6), riviere: Array(N).fill(0), fertile: Array(N).fill(0), gisement: Array(N).fill(null), rivieres: [] };
const decor = () => poses.splice(0).filter(p => p[0] === TRONC || p[0] === BUISSON);
plateau.construire(carte);
const avant = decor();  // la forêt sans route
const routes = [];      // (voisin() a besoin de la taille de la carte, donnée par construire)
for (let x = 1; x < 7; x++) routes.push([c(x, 4), c(x + 1, 4)]);
for (const d of [1, 2]) routes.push([c(4, 4), voisin(c(4, 4), d)]);           // embranchement à quatre bords
const a = voisin(c(4, 4), 1); routes.push([a, voisin(a, 0)]);                   // un virage
plateau.majEtat({ cases: { arbres: carte.arbres, foret: carte.foret, proprio: Array(N).fill(-1) }, batiments: [], routes, forts: [], saison: 2, royaumes: [] });
const apres = decor();

// le ruban dessiné par routes.js suit traceRoute ; un pied à moins de ECART_ROUTE d'un tracé est sur la route
const cases = new Map();
for (const [p, q] of routes) for (const [u, v] of [[p, q], [q, p]]) { if (!cases.has(u)) cases.set(u, []); cases.get(u).push(v); }
const lignes = [...cases].flatMap(([i, vs]) => plateau.traceRoute(i, vs));
const dist = (x, z) => Math.min(...lignes.flatMap(L => L.slice(1).map((b, k) => {
  const [ax, az] = L[k], dx = b[0] - ax, dz = b[1] - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(ax + dx * t - x, az + dz * t - z);
})));
const surRoute = ps => ps.filter(([, x, z]) => dist(x, z) < plateau.ECART_ROUTE).length;
const arbres = ps => ps.filter(p => p[0] === TRONC).length;
const garde = arbres(apres) / arbres(avant);
const ok = surRoute(apres) === 0 && surRoute(avant) > 0 && garde >= 0.97;
console.log(`arbres et routes : ${ok ? 'OK' : 'ÉCHEC'} (sur les rubans : ${surRoute(apres)} pieds, ${surRoute(avant)} sans l'écart ; arbres gardés : ${arbres(apres)}/${arbres(avant)})`);
process.exit(ok ? 0 : 1);
