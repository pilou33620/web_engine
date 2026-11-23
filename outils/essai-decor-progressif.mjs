// Essai sans navigateur : le décor posé par morceaux (decorProgressif de plateau.js) est le même, pièce pour pièce, que le décor
// posé d'un coup ; construire() n'arrête plus l'image que pour les cases, et chaque image ne pose qu'un morceau.
// Usage : node outils/essai-decor-progressif.mjs   (n'imprime qu'un bilan, avec les temps mesurés)
import { register } from 'node:module';

// scene.js : un faux moteur de rendu, et la boucle d'images appelée à la main ; plateau.js : chaque pose du décor est relevée
const crochets = `
export async function load(url, ctx, suivant) {
  const r = await suivant(url, ctx);
  const remplacer = (a, b) => { const s = String(r.source); if (!s.includes(a)) throw new Error('essai à refaire, introuvable : ' + a); return { ...r, source: s.replace(a, b) }; };
  if (url.endsWith('/rendu/scene.js')) return remplacer('new THREE.WebGLRenderer(', 'new globalThis.FauxRendu(');
  if (url.endsWith('/rendu/plateau.js')) return remplacer('? null : put(L, g, col, x, y, z, ry, simple ? 0 : ep);', '? null : (globalThis.poses.push([col, x, y, z, ry]), put(L, g, col, x, y, z, ry, simple ? 0 : ep));');
  return r;
}`;
register('data:text/javascript,' + encodeURIComponent(crochets));
const rien = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : rien), apply: () => rien, construct: () => rien, set: () => true });
let image = null;
Object.assign(globalThis, {
  FauxRendu: function () { return rien; }, poses: [], document: { getElementById: () => ({ clientWidth: 800, clientHeight: 600, addEventListener() {} }) },
  addEventListener() {}, requestAnimationFrame(f) { image = f; }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, location: { search: '' },
  ResizeObserver: class { observe() {} },
});
globalThis.navigator ??= {};
const plateau = await import('../lib/rendu/plateau.js');

// une carte de 60 × 50 cases : forêts, prés, champs, collines, quelques montagnes
const l = 60, h = 50, N = l * h, H = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
const terrain = Array.from({ length: N }, (_, i) => H(i, 1) < 0.08 ? 6 : H(i, 1) < 0.25 ? 5 : 4), foret = terrain.map((t, i) => t === 4 && H(i, 2) < 0.4 ? 1 : 0);
const carte = { l, h, terrain, foret, arbres: foret.map(f => f ? 6 : 0), riviere: Array(N).fill(0), fertile: terrain.map((t, i) => t === 4 && !foret[i] && H(i, 3) < 0.5 ? 1 : 0), gisement: Array(N).fill(null), rivieres: [] };
const etat = { cases: { arbres: carte.arbres, foret: carte.foret, proprio: Array(N).fill(-1) }, batiments: [], routes: [], forts: [], saison: 2, royaumes: [] };
const tri = ps => ps.map(p => p.map(v => typeof v === 'number' ? v.toFixed(5) : v).join()).sort();

poses.length = 0; let t = performance.now(); plateau.construire(carte, etat); const dUnCoup = performance.now() - t;
const unCoup = tri(poses.splice(0));

plateau.decorProgressif(6);
t = performance.now(); plateau.construire(carte, etat); const dCases = performance.now() - t;
const avant = poses.length;   // (rien du décor ne doit être posé par construire)
let n = 0, pire = 0, ms = 0;
while (plateau.decorEnCours() && n < 100000) { const t0 = performance.now(); image(ms += 16); pire = Math.max(pire, performance.now() - t0); n++; }
const parMorceaux = tri(poses.splice(0));
const memes = parMorceaux.length === unCoup.length && parMorceaux.every((p, k) => p === unCoup[k]);
const ok = memes && avant === 0 && !plateau.decorEnCours();
console.log(`décor par morceaux : ${ok ? 'OK' : 'ÉCHEC'} (${parMorceaux.length} pièces ${memes ? 'identiques' : 'DIFFÉRENTES'} ; d'un coup ${dUnCoup.toFixed(0)} ms, ` +
  `par morceaux ${dCases.toFixed(0)} ms puis ${n} images, la plus longue ${pire.toFixed(0)} ms)`);

// hexagones simples (vue de loin) : par morceaux comme d'un coup aussi, et seulement des pièces du décor complet (les petites en moins)
plateau.decorProgressif(0); plateau.hexagonesSimples(true);
plateau.construire(carte, etat); const simpleUnCoup = tri(poses.splice(0));
plateau.decorProgressif(6); plateau.construire(carte, etat);
for (let k = 0; plateau.decorEnCours() && k < 100000; k++) image(ms += 16);
const simpleMorceaux = tri(poses.splice(0)), complet = new Set(unCoup);
const okSimple = simpleMorceaux.length === simpleUnCoup.length && simpleMorceaux.every((p, k) => p === simpleUnCoup[k]) && simpleUnCoup.every(p => complet.has(p)) && simpleUnCoup.length < unCoup.length;
console.log(`hexagones simples : ${okSimple ? 'OK' : 'ÉCHEC'} (${simpleUnCoup.length} pièces sur ${unCoup.length}, les mêmes par morceaux)`);
plateau.hexagonesSimples(false); plateau.decorProgressif(0);
process.exit(ok && okSimple ? 0 : 1);
