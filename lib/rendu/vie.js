// La vie de la carte, comme la maquette rendu-power : fumées, charrettes, bêtes, faune des lisières, bateaux, oiseaux,
// travaux des champs, métiers des bâtiments, fêtes, armées (exercice, tambour, bivouac), train, fenêtres et lanternes la nuit.
// Tout est décor : rien ici ne touche aux règles. Les personnages sont de petits modèles en boîtes (unités de web_power,
// réduits par ECH), regroupés par modèle en InstancedMesh ; ils ne sont reconstruits que quand l'état change (majVie).
import { THREE, scene, posCase, chaqueImage, hache, cam, voisins, qualite } from './scene.js';
import * as P from './plateau.js';
// ce que monde.js (bâtiments et armées de web_royaumes) prête à la vie ; il s'y inscrit lui-même : sans lui (web_power), rien
export const MONDE = {};
import { MAT, CONT, toon, put, fige, lot, fusion, boite, cyl, cone, sphere, jeter } from './toon.js';

/** Le temps qu'il fait et l'heure du jour (tenus à jour par meteo.js). */
export const climat = { genre: 'soleil', froid: true, vent: 0.3, dir: 0, nuages: 3, gris: 0, oiseaux: true, pluie: false, neige: false, gel: 0, saison: 2, heure: 'jour', jour: 1, aube: 0, nuit: 0, arc: false,
  // effets posés par meteo.js (sec, poudre, pluieForte), boue.js (apresPluie) ou par le jeu (pollution, eauSale : web_power), de 0 à 1
  sec: 0, poudre: 1, pluieForte: false, apresPluie: false, pollution: 0, eauSale: 0, famine: false };
const ECH = 0.04, ECH_BAT = 0.1, DALLE = 0.025, MER = -0.15;
const JOUR = () => climat.heure !== 'nuit';
const PLUIE = () => climat.pluie;
const dehors = () => JOUR() && !PLUIE();
// le marché se tient le matin : on remballe dans l'après-midi (le jour du cycle dure 300 s, meteo.js)
const MATIN = () => climat.phase === 'aube' || (climat.phase === 'jour' && (climat.p || 0) < 170);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const tache = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.6)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

// ------------------------------------------------------------------ fumées : boules toon qui montent et grossissent
const NFUM = 700;
const FUM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), toon(0xffffff, { transparent: true, opacity: 0.8, depthWrite: false }), NFUM);
FUM.count = 0; FUM.frustumCulled = false; FUM.setColorAt(0, _c.set(0xffffff)); scene.add(FUM);
const bouffees = [];
const TEINTE = { blanche: new THREE.Color(0xf6f4ee), noire: new THREE.Color(0x55504a), poudre: new THREE.Color(0xf4f1ea), poussiere: new THREE.Color(0xb59a74) };
/** Une bouffée de fumée : genre 'blanche', 'noire', 'poudre' ou 'poussiere' (travaux, impacts) ; k : taille (salves de l'armée). */
/** Efface toutes les fumées en cours (une vitrine qui change ce qu'elle montre). */
export function viderFumees() { bouffees.length = 0; }
export function bouffee(x, y, z, genre = 'blanche', k) {
  if (qualite.part < 1 && genre !== 'poudre' && Math.random() > qualite.part) return;  // qualité légère : moins de fumées
  if (bouffees.length >= NFUM) bouffees.shift();
  bouffees.push({ x, y, z, age: 0, c: TEINTE[genre] || TEINTE.blanche, k: k ?? (genre === 'poudre' ? 2.6 : 1), vie: genre === 'poudre' ? 2.2 : 3 });
}
function majFumees(dt) {
  const vx = Math.cos(climat.dir) * climat.vent * 0.12 + 0.03, vz = Math.sin(climat.dir) * climat.vent * 0.12;
  let n = 0;
  for (let i = bouffees.length - 1; i >= 0; i--) { const b = bouffees[i]; b.age += dt; if (b.age > b.vie) { bouffees.splice(i, 1); continue; } b.y += dt * 0.18; b.x += vx * dt; b.z += vz * dt; }
  for (const b of bouffees) {
    const u = b.age / b.vie, s = (0.6 + b.age * 0.7) * b.k * (u > 0.75 ? (1 - u) / 0.25 : 1);
    _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s.set(s, s, s)); FUM.setMatrixAt(n, _m); FUM.setColorAt(n++, b.c);
  }
  FUM.count = n; FUM.instanceMatrix.needsUpdate = true; FUM.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ modèles (unités de web_power : cases de 10)
const PATTES = (dx, dz, h, w, c) => [[-dx, -dz], [-dx, dz], [dx, -dz], [dx, dz]].map(([x, z]) => [boite(w, h, w), x, h / 2, z, c]);
const roue = (x, z, r = 0.38) => [cyl(r, r, 0.22, 8).rotateX(Math.PI / 2), x, r, z, 0x2a2622];
const BICHE = [[boite(1.3, 0.55, 0.45), 0, 1.05, 0, 0x9a6a3a], [boite(1, 0.14, 0.4), 0, 0.78, 0, 0xe8dcc8], [boite(0.28, 0.62, 0.26), 0.6, 1.45, 0, 0x9a6a3a], [boite(0.5, 0.28, 0.26), 0.8, 1.8, 0, 0x8a5c32], [boite(0.1, 0.2, 0.08), 0.68, 2.02, 0.1, 0x6b4a2a], [boite(0.1, 0.2, 0.08), 0.68, 2.02, -0.1, 0x6b4a2a], [boite(0.12, 0.16, 0.14), -0.7, 1.2, 0, 0xf4f1ea], ...PATTES(0.45, 0.14, 0.8, 0.12, 0x6b4a2a)];
const PAYSAN = chemise => [[boite(0.3, 0.9, 0.24), 0, 0.45, 0.16, 0x5a4632], [boite(0.3, 0.9, 0.24), 0, 0.45, -0.16, 0x5a4632], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, chemise], [sphere(0.28, 1), 0.02, 2.1, 0, 0xf0c9a0], [cyl(0.55, 0.55, 0.08, 10), 0, 2.36, 0, 0xd9b45a], [cyl(0.25, 0.3, 0.25, 8), 0, 2.5, 0, 0xd9b45a]];
const ATTELAGE = dx => [[boite(1.9, 0.85, 0.7), dx, 1.35, 0, 0x8a5a32], [boite(0.45, 0.9, 0.4), dx + 0.95, 1.95, 0, 0x8a5a32], [boite(0.7, 0.35, 0.35), dx + 1.25, 2.3, 0, 0x7a4a28], ...PATTES(0.7, 0.22, 0.95, 0.16, 0x4a2c18).map(([g, x, y, z, c]) => [g, x + dx, y, z, c])];
const FEMME = (jupe, haut = 0xe9e2d0) => [[boite(0.7, 0.9, 0.7), 0, 0.45, 0, jupe], [boite(0.5, 0.6, 0.6), 0, 1.2, 0, haut], [sphere(0.28, 1), 0.02, 1.75, 0, 0xf0c9a0], [boite(0.4, 0.16, 0.45), 0, 2.02, 0, 0xf6f2ea]];
const ENFANT = c => PAYSAN(c).slice(0, 4);
const CHEVAL = robe => [[boite(1.6, 0.6, 0.5), 0, 1.15, 0, robe], [boite(0.4, 0.75, 0.32), 0.78, 1.6, 0, robe], [boite(0.6, 0.3, 0.28), 1.05, 1.95, 0, robe], [boite(0.5, 0.12, 0.1), 0.62, 1.7, 0, 0x2a1d14], [boite(0.5, 0.12, 0.12).rotateZ(-0.9), -0.95, 1.05, 0, 0x2a1d14], ...PATTES(0.6, 0.18, 0.85, 0.14, robe)];
const decale = (m, dx, dy = 0) => m.map(([g, x, y, z, c]) => [g.clone(), x + dx, y + dy, z, c]);
const MODELES = {
  char: [[boite(1.7, 0.3, 1), -0.4, 0.75, 0, 0x9a6a3a], [boite(1.7, 0.35, 0.1), -0.4, 1.05, 0.45, 0x7a4f2a], [boite(1.7, 0.35, 0.1), -0.4, 1.05, -0.45, 0x7a4f2a], roue(-0.4, 0.55, 0.45), roue(-0.4, -0.55, 0.45), [boite(1.1, 0.55, 0.4), 1.2, 1.05, 0, 0x6b4226], [boite(0.45, 0.4, 0.3), 1.85, 1.45, 0, 0x6b4226], [boite(0.12, 0.75, 0.12), 0.8, 0.4, 0, 0x4a2e1a], [boite(0.12, 0.75, 0.12), 1.6, 0.4, 0, 0x4a2e1a], [boite(0.7, 0.35, 0.8), -0.5, 1.15, 0, 0xe3c75b]],
  vache: [[boite(1.6, 0.8, 0.7), 0, 0.9, 0, 0xf6f2ea], [boite(0.7, 0.5, 0.72), -0.2, 1.0, 0, 0x2f2c2a], [boite(0.6, 0.55, 0.5), 0.95, 1.15, 0, 0xf6f2ea], [boite(0.2, 0.5, 0.2), -0.55, 0.3, 0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), 0.5, 0.3, -0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), -0.55, 0.3, -0.2, 0xe8e2d6], [boite(0.2, 0.5, 0.2), 0.5, 0.3, 0.2, 0xe8e2d6]],
  biche: BICHE,
  cerf: [...BICHE, ...[0.13, -0.13].flatMap(z => [[boite(0.07, 0.55, 0.07), 0.66, 2.2, z, 0x5a4630], [boite(0.32, 0.07, 0.07), 0.55, 2.35, z * 1.6, 0x5a4630], [boite(0.07, 0.25, 0.07), 0.45, 2.45, z * 2, 0x5a4630]])],
  sanglier: [[boite(1.3, 0.7, 0.62), 0, 0.75, 0, 0x4a3a30], [boite(1, 0.14, 0.22), 0, 1.15, 0, 0x2e241e], [boite(0.5, 0.46, 0.46), 0.82, 0.68, 0, 0x3e3029], [boite(0.2, 0.22, 0.26), 1.14, 0.58, 0, 0x8a6a5a], [boite(0.06, 0.16, 0.05), 1.1, 0.52, 0.15, 0xf4f1ea], [boite(0.06, 0.16, 0.05), 1.1, 0.52, -0.15, 0xf4f1ea], ...PATTES(0.42, 0.18, 0.42, 0.15, 0x2e241e)],
  renard: [[boite(1, 0.38, 0.32), 0, 0.66, 0, 0xd9622b], [boite(0.8, 0.1, 0.28), 0, 0.48, 0, 0xf4f1ea], [boite(0.38, 0.32, 0.3), 0.6, 0.82, 0, 0xd9622b], [boite(0.2, 0.13, 0.15), 0.85, 0.74, 0, 0xf4f1ea], [boite(0.08, 0.2, 0.08), 0.62, 1.06, 0.09, 0x2a1d14], [boite(0.08, 0.2, 0.08), 0.62, 1.06, -0.09, 0x2a1d14], [boite(0.7, 0.22, 0.22), -0.8, 0.76, 0, 0xd9622b], [boite(0.2, 0.22, 0.22), -1.22, 0.8, 0, 0xf4f1ea], ...PATTES(0.32, 0.1, 0.46, 0.08, 0x2a1d14)],
  loco: [[cyl(0.5, 0.5, 2.2, 12).rotateZ(Math.PI / 2), 0.4, 1.25, 0, 0x2b2b30], [boite(0.15, 1.02, 1.02), -0.2, 1.25, 0, 0xb8322a], [boite(0.15, 1.02, 1.02), 1, 1.25, 0, 0xb8322a], [boite(1, 1.4, 1.15), -1.15, 1.4, 0, 0x8a2a24], [boite(1.3, 0.15, 1.35), -1.15, 2.15, 0, 0x2b2b30], [boite(0.5, 0.45, 0.08), -1.15, 1.6, 0.58, 0xf2d27a],
    [cyl(0.32, 0.18, 0.4, 8), 1.1, 2.15, 0, 0x2b2b30], [cyl(0.16, 0.16, 0.5, 8), 1.1, 1.8, 0, 0x2b2b30], [boite(0.4, 0.3, 0.4), 0.2, 1.85, 0, 0xc9a24a], [boite(3.4, 0.3, 1), -0.1, 0.55, 0, 0x3a3a40], [cone(0.45, 0.6, 4).rotateZ(-Math.PI / 2), 1.75, 0.5, 0, 0xb8322a],
    roue(-1.1, 0.55, 0.42), roue(-1.1, -0.55, 0.42), roue(0.1, 0.55, 0.42), roue(0.1, -0.55, 0.42), roue(1, 0.55, 0.3), roue(1, -0.55, 0.3)],
  wagon: [[boite(2.2, 0.8, 1.1), 0, 0.95, 0, 0x6b4a2a], [boite(2, 0.3, 0.95), 0, 1.4, 0, 0x2b2b2b], [boite(2.4, 0.25, 1), 0, 0.5, 0, 0x3a3a40], roue(-0.7, 0.55, 0.35), roue(-0.7, -0.55, 0.35), roue(0.7, 0.55, 0.35), roue(0.7, -0.55, 0.35)],
  paysan: PAYSAN(0xe9e2d0),
  faucheur: [...PAYSAN(0xd9cfb0), [boite(1.8, 0.08, 0.08).rotateZ(-0.6), 0.55, 1.3, 0.35, 0x8b5a2b], [boite(0.08, 0.05, 1.1), 1.25, 0.8, 0.85, 0xd9d9d9]],
  semeur: [...PAYSAN(0xc9d4e0), [boite(0.32, 0.45, 0.4), 0.3, 1.2, 0.4, 0xc9b27a]],
  vendangeur: [...PAYSAN(0xe0d0c0), [cyl(0.36, 0.26, 0.8, 8), -0.45, 1.55, 0, 0x8a6a4a], [sphere(0.22, 0), -0.45, 2, 0, 0x6a2a5a]],
  charrue: [...ATTELAGE(1.6), [boite(1.6, 0.12, 0.12), 0.1, 0.75, 0, 0x8b5a2b], [boite(0.2, 0.55, 0.5), -0.6, 0.35, 0, 0x6b6f75], [boite(0.9, 0.08, 0.08).rotateZ(0.5), -1, 1, 0.25, 0x8b5a2b], [boite(0.9, 0.08, 0.08).rotateZ(0.5), -1, 1, -0.25, 0x8b5a2b], ...decale(PAYSAN(0xd9cfb0), -1.7)],
  poule: [[boite(0.5, 0.4, 0.35), 0, 0.4, 0, 0xf4f1ea], [boite(0.22, 0.25, 0.2), 0.3, 0.7, 0, 0xf4f1ea], [boite(0.1, 0.12, 0.06), 0.32, 0.88, 0, 0xd9322a], [boite(0.1, 0.05, 0.06), 0.45, 0.68, 0, 0xf2b33d], [boite(0.06, 0.25, 0.06), 0, 0.12, 0.08, 0xf2b33d], [boite(0.06, 0.25, 0.06), 0, 0.12, -0.08, 0xf2b33d], [boite(0.15, 0.2, 0.25), -0.3, 0.6, 0, 0xe8e2d6]],
  mouton: [[boite(1.1, 0.65, 0.7), 0, 0.75, 0, 0xf4f2ea], [boite(0.35, 0.35, 0.35), 0.65, 0.85, 0, 0x2b2b2b], ...PATTES(0.35, 0.2, 0.45, 0.12, 0x2b2b2b)],
  corbeau: [[boite(0.6, 0.25, 0.25), 0, 0.25, 0, 0x1f1f24], [boite(0.2, 0.2, 0.2), 0.35, 0.38, 0, 0x1f1f24], [boite(0.15, 0.05, 0.06), 0.5, 0.35, 0, 0x4a4a4a], [boite(0.3, 0.05, 0.2), -0.4, 0.3, 0, 0x1f1f24]],
  bateau: [[boite(3.2, 0.7, 1.2), 0, 0.35, 0, 0x8a5a34], [boite(0.15, 3.2, 0.15), 0, 2, 0, 0x5b3a1e], [cone(1.2, 3.2, 3).scale(0.25, 1, 1), 0.2, 2.3, 0, 0xf6f2ea]],
  oiseau: [[boite(1.5, 0.32, 0.38), 0, 0, 0, 0xf4f1ea], [boite(0.42, 0.3, 0.3), 0.9, 0.08, 0, 0xf4f1ea], [boite(0.25, 0.08, 0.1), 1.2, 0.04, 0, 0xf2b33d], [boite(0.5, 0.08, 0.5), -0.95, 0.04, 0, 0xd9d6cf], [boite(0.75, 0.07, 2.2), 0.05, 0, 0, 0xd9d6cf]],
  lavandiere: FEMME(0x4a6a9a), cliente: FEMME(0x8a4a7a, 0xf2e6c8), cliente2: FEMME(0x5a7a4a), danseuse: FEMME(0xd9322a, 0xf6f2ea), danseuse2: FEMME(0xe0a020, 0xf6f2ea),
  marchand: [...PAYSAN(0xc0504a), [boite(0.12, 0.9, 0.6), 0.27, 1.1, 0, 0xf6f2ea]], client: PAYSAN(0x6a8aa4), danseur: PAYSAN(0x3a6aa8),
  musicien: [...PAYSAN(0x7a3a6a), [boite(0.5, 0.15, 0.2), 0.3, 1.8, 0.25, 0x8b5a2b], [boite(0.04, 0.04, 0.7), 0.35, 1.9, -0.1, 0xe9e2d0]],
  enfant0: ENFANT(0xd9533a), enfant1: ENFANT(0x3a8ad9), enfant2: ENFANT(0xe0c040),
  forgeron: [...PAYSAN(0x4a3a30).slice(0, 4), [boite(0.12, 0.85, 0.62), 0.27, 1.1, 0, 0x3a2a20], [boite(0.08, 0.7, 0.08), 0.45, 2, 0.25, 0x5b3a1e], [boite(0.3, 0.2, 0.2), 0.45, 2.4, 0.25, 0x3a3a3a]],
  bucheron: [...PAYSAN(0x8a3a2a), [boite(0.08, 1.3, 0.08).rotateZ(-0.5), 0.6, 1.6, 0.28, 0x5b3a1e], [boite(0.08, 0.3, 0.32), 0.95, 2.1, 0.28, 0xb8b8b8]],
  sapin: [[cyl(0.3, 0.4, 1.4, 5), 0, 0.7, 0, 0x7a5233], [cone(1.9, 3, 6), 0, 2.6, 0, 0x3e7f34], [cone(1.4, 2.4, 6), 0, 4, 0, 0x4c9440]],
  barque: [[boite(3, 0.5, 1.1), 0, 0.25, 0, 0x8a5a34], [boite(3.1, 0.12, 1.2), 0, 0.55, 0, 0x6b4426], ...decale(PAYSAN(0x4a6a8a), -0.6, 0.3), [boite(0.05, 0.05, 1.8).rotateX(0.3), 0.6, 1.4, 0, 0x5b3a1e], [boite(1, 0.02, 1), 1.5, 0.15, 0.4, 0xd9d2bc]],
  meunier: [...PAYSAN(0xf0ebe0), [boite(0.6, 0.5, 0.55), 0, 2.75, 0, 0xe9e2d0]],
  cavalier: [...CHEVAL(0x7a4a2a), [boite(0.5, 0.75, 0.62), -0.1, 1.9, 0, 0x3a4a6a], [boite(0.22, 0.55, 0.14), 0, 1.35, 0.32, 0x2e2a26], [boite(0.22, 0.55, 0.14), 0, 1.35, -0.32, 0x2e2a26], [sphere(0.26, 1), -0.08, 2.5, 0, 0xf0c9a0], [cyl(0.42, 0.42, 0.07, 10), -0.08, 2.74, 0, 0x2a2622], [cyl(0.2, 0.24, 0.24, 8), -0.08, 2.86, 0, 0x2a2622]],
  voyageur: [...PAYSAN(0x8a6a4a), [boite(0.38, 0.45, 0.4), -0.34, 1.55, 0, 0x7a5a3a], [boite(0.07, 2.2, 0.07), 0.38, 1.1, 0.3, 0x5b3a1e]],
  berger: [...PAYSAN(0x6a5a40), [boite(0.07, 2.6, 0.07), 0.38, 1.3, 0.3, 0x5b3a1e], [boite(0.3, 0.07, 0.07), 0.48, 2.6, 0.3, 0x5b3a1e]],
  chien: [[boite(0.8, 0.32, 0.28), 0, 0.5, 0, 0x6b4a2a], [boite(0.3, 0.28, 0.26), 0.5, 0.68, 0, 0x6b4a2a], [boite(0.14, 0.1, 0.14), 0.7, 0.62, 0, 0x2a1d14], [boite(0.32, 0.08, 0.08).rotateZ(0.6), -0.5, 0.66, 0, 0x6b4a2a], ...PATTES(0.28, 0.1, 0.35, 0.08, 0x4a3220)],
  wagonnet: [[boite(1.2, 0.6, 0.8), 0, 0.55, 0, 0x5a4632], [boite(1.1, 0.25, 0.7), 0, 0.95, 0, 0x6a5a4a], roue(-0.4, 0.35, 0.22), roue(-0.4, -0.35, 0.22), roue(0.4, 0.35, 0.22), roue(0.4, -0.35, 0.22), ...decale(PAYSAN(0x5a5a6a), -1.3)],
  allumeur: [...PAYSAN(0x3a3a4a), [boite(0.06, 2.2, 0.06), 0.35, 2, 0.2, 0x5b3a1e], [boite(0.14, 0.14, 0.14), 0.35, 3.1, 0.2, 0xffd36a]],
  pigeon: [[boite(0.6, 0.25, 0.25), 0, 0, 0, 0x9aa0a8], [boite(0.2, 0.2, 0.2), 0.35, 0.1, 0, 0x7a8088], [boite(0.3, 0.05, 1.2), 0, 0.05, 0, 0x8a9098]],
  patineur: [...PAYSAN(0x7a3a3a), [boite(0.55, 0.12, 0.8), 0, 1.75, 0, 0xd9533a]],
  ...Object.fromEntries([0xffd34d, 0xff8ad8, 0x9fd0ff, 0xffffff].map((c, i) => [`papillon${i}`, [[boite(0.12, 0.08, 0.12), 0, 0, 0, 0x3a2a20], [boite(0.5, 0.04, 0.45), 0, 0, 0.27, c], [boite(0.5, 0.04, 0.45), 0, 0, -0.27, c]]])),
};

// ------------------------------------------------------------------ acteurs : un InstancedMesh (pièces + contours) par modèle
// Un acteur est un simple Object3D hors de la scène ; à chaque image, sa matrice est recopiée dans l'InstancedMesh de son modèle.
// Une troupe regroupe les acteurs d'un jeu de modèles : celle de la carte (ici) et celle des quartiers proches du regard (quartiers.js).
/** modeles : { nom: [[géométrie, x, y, z, couleur], …] } ; plafond : nombre d'acteurs dessinés au plus (les suivants attendent) ;
 *  ombres : les acteurs portent-ils une ombre (une passe de dessin de plus par modèle) ? */
export function troupe(modeles, plafond = Infinity, ombres = true) {
  const POOLS = new Map();
  const t = {
    nb: 0,
    acteur(nom, s = ECH) {
      let p = POOLS.get(nom);
      if (!p) {
        const L = lot();
        for (const [g, x, y, z, c] of modeles[nom]) put(L, g, c, x, y, z, 0, 0.09);
        p = { g: fusion(L.g), o: L.o.length ? fusion(L.o) : null, list: [], mi: null, mo: null };
        POOLS.set(nom, p);
      }
      const o = new THREE.Object3D(); o.scale.setScalar(s); p.list.push(o);
      return o;
    },
    vider() { for (const p of POOLS.values()) p.list = []; },
    // les InstancedMesh sont gardés d'une reconstruction à l'autre ; ils ne grandissent que s'il le faut
    installer() {
      for (const p of POOLS.values()) {
        const n = p.list.length;
        if (p.mi && p.mi.instanceMatrix.count >= n) continue;
        for (const m of [p.mi, p.mo]) if (m) { scene.remove(m); m.dispose(); }
        p.mi = p.mo = null;
        if (!n) continue;
        const cap = Math.ceil(n * 1.3) + 4;
        p.mi = new THREE.InstancedMesh(p.g, MAT, cap); p.mi.castShadow = ombres; p.mi.receiveShadow = true;
        if (p.o) p.mo = new THREE.InstancedMesh(p.o, CONT, cap);
        for (const m of [p.mi, p.mo]) if (m) { m.count = 0; m.frustumCulled = false; scene.add(m); }
      }
    },
    dessiner() {
      let tot = 0;
      for (const p of POOLS.values()) {
        if (!p.mi) continue;
        let n = 0;
        for (const o of p.list) if (o.visible && tot < plafond) { o.updateMatrix(); p.mi.setMatrixAt(n, o.matrix); if (p.mo) p.mo.setMatrixAt(n, o.matrix); n++; tot++; }
        p.mi.count = n; p.mi.instanceMatrix.needsUpdate = true; p.mi.visible = n > 0;
        if (p.mo) { p.mo.count = n; p.mo.instanceMatrix.needsUpdate = true; p.mo.visible = n > 0; }
      }
      t.nb = tot;
    },
  };
  return t;
}
const TROUPE = troupe(MODELES);
const acteur = TROUPE.acteur, installerPools = TROUPE.installer, dessinerActeurs = TROUPE.dessiner;
/** Les bâtiments (id) dont quartiers.js anime la vie fine : la vie plus légère de la carte s'y efface. */
export const PROCHES = new Set();
let ACT = [];
/** o : l'acteur ; f(t, dt) : son mouvement ; quand() : visible ou non. */
const ajoute = (o, f, quand) => { ACT.push({ o, f, quand }); return o; };

// ------------------------------------------------------------------ repères des bâtiments (coordonnées locales de web_power → monde)
function repere(b) { const c = posCase(b.case), th = b.face || 0; return { x: c.x, z: c.z, y: P.dessus(b.case), th, cos: Math.cos(th), sin: Math.sin(th) }; }
const posB = (R, lx, lz) => ({ x: R.x + (lx * R.cos + lz * R.sin) * ECH_BAT, z: R.z + (-lx * R.sin + lz * R.cos) * ECH_BAT });
const capB = (R, dx, dz) => R.th - Math.atan2(dz, dx); // cap d'un modèle (face à +x) qui regarde la direction locale (dx, dz)
function groupeBat(L, R, parent) { const g = fige(L, parent); g.scale.setScalar(ECH_BAT); g.position.set(R.x, R.y, R.z); g.rotation.y = R.th; return g; }

// ------------------------------------------------------------------ particules et points lumineux
const ETINC = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0xffb43a }), 160);
ETINC.count = 0; ETINC.frustumCulled = false; scene.add(ETINC);
const etincelles = [];
const FEUILLES = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.004, 0.016), toon(0xffffff), 200);
FEUILLES.count = 0; FEUILLES.frustumCulled = false; FEUILLES.setColorAt(0, _c); scene.add(FEUILLES);
const feuilles = Array.from({ length: 200 }, (_, i) => ({ age: 4 + i * 0.02, ph: 0, x: 0, z: 0, y: 0, col: i % 4 }));
const COUL_FEUILLES = [0xd9822b, 0xc9a13a, 0xb5562a, 0xe0b040].map(c => new THREE.Color(c));
function points(n, taille, couleur) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setDrawRange(0, 0);
  const o = new THREE.Points(g, new THREE.PointsMaterial({ map: tache, size: taille, vertexColors: !couleur, color: couleur || 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  o.frustumCulled = false; scene.add(o); return o;
}
const FENETRES = points(4000, 0.32), LUCIOLES = points(300, 0.07, 0xdfff7a), LUEURS = points(400, 0.3);
let lucioles = [], lampes = [];
let BLE = null, bles = [];
const BLE_GEO = new THREE.ConeGeometry(0.012, 0.06, 4).translate(0, 0.03, 0), BLE_MAT = toon(0xffffff);

// ------------------------------------------------------------------ chemins
/** Lisse un tracé (Chaikin) ; renvoie la position et le cap à une distance donnée. */
function cheminLisse(pts, iter = 2, dy = 0) {
  for (let it = 0; it < iter; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const ys = pts.map(([x, z]) => P.solEn(x, z) + dy);
  const en = sd => { sd = Math.max(0, Math.min(cum[cum.length - 1] - 1e-4, sd)); let i = 0; while (cum[i + 1] < sd) i++; const f = (sd - cum[i]) / ((cum[i + 1] - cum[i]) || 1); return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, y: ys[i] + (ys[i + 1] - ys[i]) * f, cap: -Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) }; };
  return { pts, ys, en, long: cum[cum.length - 1] };
}
/** Le plus court chemin de cases (Dijkstra) de `de` vers l'une des cases `vers` ; cout(n) = Infinity si interdit. */
function plusCourt(de, vers, cout) {
  const d = new Map([[de, 0]]), prev = new Map([[de, -1]]), ouvert = new Set([de]), vu = new Set();
  while (ouvert.size) {
    let k = -1, m = Infinity; for (const x of ouvert) { const v = d.get(x); if (v < m) { m = v; k = x; } }
    ouvert.delete(k); vu.add(k);
    if (vers.has(k) && k !== de) { const p = []; for (let x = k; x !== -1; x = prev.get(x)) p.unshift(x); return p; }
    for (const n of voisins(k)) { if (vu.has(n)) continue; const c = m + cout(n); if (c < (d.get(n) ?? Infinity)) { d.set(n, c); prev.set(n, k); ouvert.add(n); } }
  }
  return null;
}
/** Un ruban plat le long d'un tracé, à la hauteur ys + dy. */
function ruban(pts, ys, larg, dy) {
  const pos = [], perp = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], pa = perp(i), pb = perp(i + 1), ya = ys[i] + dy, yb = ys[i + 1] + dy;
    pos.push(ax + pa[0] * larg, ya, az + pa[1] * larg, bx + pb[0] * larg, yb, bz + pb[1] * larg, ax - pa[0] * larg, ya, az - pa[1] * larg,
      ax - pa[0] * larg, ya, az - pa[1] * larg, bx + pb[0] * larg, yb, bz + pb[1] * larg, bx - pb[0] * larg, yb, bz - pb[1] * larg);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

// ------------------------------------------------------------------ parcelles des champs (repli si plateau.js ne les donne pas encore)
// shortcut: repli sur la formule de la maquette pour les plaines fertiles ; disparaît dès que plateau.js exporte parcelles().
function parcellesRepli(i, C, bati, foret) {
  if (C.terrain[i] !== 4 || !C.fertile?.[i] || foret[i] || C.riviere[i] || bati.has(i)) return null;
  const { x, z, c, r } = posCase(i), an = (hache(c, r, 7) * 3 | 0) * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an), W = 0.46, D = 0.24, jeu = 0.04, centres = [];
  for (let b = -1; b <= 1; b++) for (const cote of [-1, 1]) { const lx = cote * (W + jeu) / 2, lz = b * (D + jeu); centres.push({ x: x + lx * ca + lz * sa, z: z - lx * sa + lz * ca, b, cote }); }
  return { an, W, D, centres };
}

// ------------------------------------------------------------------ fêtes, arc-en-ciel : ce qui dépend du mois précédent
/** Une corde à linge entre deux piquets ; les draps se soulèvent sous le vent. */
const DRAPS = [0xf6f2ea, 0x9fc4e8, 0xf2d6d6, 0xf6f2ea, 0xe8d38a].map(c => toon(c, { side: THREE.DoubleSide })), DRAP = new THREE.PlaneGeometry(0.045, 0.05).translate(0, -0.025, 0);
function cordeLinge(x, y, z, cap, quand) {
  const L = lot(); for (const o of [-0.13, 0.13]) put(L, new THREE.BoxGeometry(0.008, 0.12, 0.008), 0x8b5a2b, o, 0.06, 0, 0, 0.003); put(L, new THREE.BoxGeometry(0.26, 0.003, 0.003), 0xe9e2d0, 0, 0.115, 0, 0, 0);
  const linge = fige(L, VIE); linge.position.set(x, y, z); linge.rotation.y = cap;
  const draps = [0, 1, 2, 3].map(j => { const m = new THREE.Mesh(DRAP, DRAPS[(j + Math.round(x * 7)) % DRAPS.length]); m.position.set(-0.09 + j * 0.06, 0.113, 0); linge.add(m); return m; });
  ajoute(linge, t => draps.forEach((m, j) => { m.rotation.x = Math.sin(t * (2 + climat.vent * 3) + j) * (0.15 + climat.vent * 0.5); }), quand);
}
const memo = { niveaux: new Map(), statuts: new Map(), fetes: new Map(), tour: -1, genre: null, arc: false };
function fetesDuMois(etat, rapport) {
  if (etat.tour < memo.tour) { memo.niveaux.clear(); memo.statuts.clear(); memo.fetes.clear(); memo.genre = null; }
  const cap = etat.villes.find(v => v.proprio === 0 && v.capitale) || etat.villes.find(v => v.proprio === 0);
  const feter = v => { if (v) memo.fetes.set(v.id, etat.tour); };
  for (const v of etat.villes) { const n = memo.niveaux.get(v.id); if (n != null && v.niveau > n) feter(v); memo.niveaux.set(v.id, v.niveau); }
  for (const r of etat.royaumes || []) {
    const s = memo.statuts.get(r.id);
    if (s != null && s !== r.statut && (r.statut === 'alliance' || (r.statut === 'paix' && s === 'guerre'))) feter(cap);
    memo.statuts.set(r.id, r.statut);
  }
  if ((rapport?.evenements || []).some(e => /Paix signée|Alliance/.test(e.texte || ''))) feter(cap);
  if ((rapport?.combats || []).some(c => c.vainqueur === 0 && (c.attaquant === 0 || c.defenseur === 0))) feter(cap);  // une bataille gagnée : la capitale fête la victoire
  const actives = new Set([...memo.fetes].filter(([, t]) => t >= etat.tour).map(([id]) => id));
  // la victoire, et chaque septembre (mois 8) la fête des vendanges dans toutes les villes du joueur
  if (etat.fin?.victoire || etat.mois === 8) for (const v of etat.villes) if (v.proprio === 0) actives.add(v.id);
  // arc-en-ciel : un beau mois après un mois pluvieux, ou parfois au hasard
  if (etat.tour !== memo.tour) {
    const g = etat.meteo?.genre, beau = ['soleil', 'nuages', 'canicule'].includes(g);
    memo.arc = beau && (['pluie', 'orage', 'tempete'].includes(memo.genre) || hache(etat.tour, 61) < 0.3);
    memo.genre = g; memo.tour = etat.tour;
  }
  climat.arc = memo.arc;
  return actives;
}

// ------------------------------------------------------------------ construction des acteurs d'après l'état
const VIE = new THREE.Group(); scene.add(VIE);
let sigVie = '', carteVue = null, couleurs = {}, RAIL = null, epoque = 'ancien';
const USINES = ['usine', 'filature', 'haut_fourneau', 'manufacture', 'fonderie'];

/** Met la vie d'accord avec l'état (rapport : le rapport du mois, s'il y en a un). */
export function majVie(etat, rapport) {
  if (!etat) return;
  climat.saison = etat.saison;
  couleurs = Object.fromEntries((etat.royaumes || []).map(r => [r.id, r.couleur])); couleurs[99] = '#4b4b4b';
  const fetes = fetesDuMois(etat, rapport);
  const C = P.carte();
  const train = (etat.joueur?.techs || []).includes('chemin_fer');
  const sig = JSON.stringify([etat.batiments.map(b => [b.id, b.cle, b.case, b.reste, b.face, b.ville, MONDE.estArrete?.(b)]), etat.routes, etat.saison, etat.epoque?.cle, [...fetes], train, etat.villes.map(v => [v.id, v.case])]);
  if (sig === sigVie && C === carteVue) return;
  sigVie = sig; carteVue = C;
  epoque = etat.epoque?.cle || 'ancien';
  reconstruire(etat, C, fetes, train);
}

function reconstruire(etat, C, fetes, train) {
  TROUPE.vider();
  ACT = [];
  while (VIE.children.length) jeter(VIE.children[0]);
  bles = []; lucioles = []; if (BLE) BLE.userData.sig = -1; lampes = []; RAIL = null;
  if (!C) { installerPools(); return; }
  const N = C.l * C.h, A = (nom, s) => acteur(nom, s);
  const bats = etat.batiments.filter(b => b.reste === 0 && !MONDE.estArrete?.(b)); // un bâtiment arrêté (faubourg assiégé, pillé, saboté) ne vit plus
  const bati = new Set(etat.batiments.map(b => b.case));
  const foret = etat.cases?.foret || C.foret || [], proprio = etat.cases?.proprio || [];
  const terre = i => i >= 0 && P.TERRE(C.terrain[i]);
  const parcelles = typeof P.parcelles === 'function' ? i => P.parcelles(i) : i => parcellesRepli(i, C, bati, foret);
  const champs = []; for (let i = 0; i < N; i++) { const p = parcelles(i); if (p) champs.push([i, p]); }
  const estChamp = new Set(champs.map(([i]) => i));
  const pre = i => terre(i) && C.terrain[i] === 4 && !foret[i] && !C.riviere[i] && !bati.has(i) && !estChamp.has(i);
  const ordre = (l, k) => l.sort((a, b) => hache(a, k) - hache(b, k));
  const villeCases = new Set(etat.villes.map(v => v.case));
  const pres = ordre([...Array(N).keys()].filter(i => pre(i) && proprio[i] >= 0 && voisins(i).some(n => bati.has(n))), 3);

  // ---- charrettes : des bouts du réseau de routes vers la ville la plus proche, par la route, en va-et-vient
  const liens = new Map();
  for (const [a, b] of etat.routes || []) for (const [x, y] of [[a, b], [b, a]]) { if (!liens.has(x)) liens.set(x, []); liens.get(x).push(y); }
  const bouts = ordre([...liens.keys()].filter(i => liens.get(i).length === 1 && !villeCases.has(i)), 5).slice(0, 18);
  for (const f of bouts) {
    const prev = new Map([[f, -1]]), file = [f]; let ch = null;
    while (file.length && !ch) { const c = file.shift(); if (villeCases.has(c)) { ch = []; for (let x = c; x !== -1; x = prev.get(x)) ch.push(x); break; } for (const n of liens.get(c) || []) if (!prev.has(n)) { prev.set(n, c); file.push(n); } }
    if (!ch || ch.length < 3) continue;
    const pts = []; ch.forEach((i, k) => { const p = posCase(i); pts.push([p.x, p.z]); if (k < ch.length - 1) { const q = posCase(ch[k + 1]); pts.push([(p.x + q.x) / 2, (p.z + q.z) / 2]); } });
    pts[0] = [pts[0][0] + (pts[1][0] - pts[0][0]) * 0.6, pts[0][1] + (pts[1][1] - pts[0][1]) * 0.6]; // part du bord de la place
    const v = 0.55 / pts.length, ph = hache(f, 9) * 6;
    ajoute(A('char'), (t, dt, o) => {
      const u = (Math.sin(t * v + ph) + 1) / 2 * (pts.length - 1.001), i = Math.floor(u), f2 = u - i, sens = Math.cos(t * v + ph) > 0 ? 1 : -1;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f2, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f2;
      o.position.set(x, P.solEn(x, z) + 0.012, z); o.rotation.y = -Math.atan2((pts[i + 1][1] - pts[i][1]) * sens, (pts[i + 1][0] - pts[i][0]) * sens);
    }, JOUR);
  }

  // ---- voyageurs entre les villes : charrettes, cavaliers et piétons font l'aller et retour par la route, chacun sur sa droite
  // (de chaque ville, la route est suivie jusqu'à la première ville de chaque branche ; un trajet par paire de villes)
  const trajets = new Map();
  for (const v of etat.villes) {
    const prev = new Map([[v.case, -1]]), file = [v.case];
    while (file.length) {
      const c = file.shift();
      if (c !== v.case && villeCases.has(c)) { const cle = Math.min(c, v.case) + ':' + Math.max(c, v.case); if (!trajets.has(cle)) { const ch = []; for (let x = c; x !== -1; x = prev.get(x)) ch.push(x); trajets.set(cle, ch); } continue; }
      for (const n of liens.get(c) || []) if (!prev.has(n)) { prev.set(n, c); file.push(n); }
    }
  }
  const VOYAGE = { char: [0.06, JOUR], cavalier: [0.16, JOUR], voyageur: [0.04, dehors] }, GENS = ['char', 'voyageur', 'cavalier', 'char', 'voyageur'];
  [...trajets.values()].sort((a, b) => hache(a[0], a.at(-1), 8) - hache(b[0], b.at(-1), 8)).slice(0, 28).forEach((ch, j) => {
    // par les points de passage des cases et le milieu entre deux, comme le ruban de la route (plateau.js, traceRoute)
    const pts = []; ch.forEach((i, k) => { const p = P.passage(i); pts.push(p); if (k < ch.length - 1) { const q = P.passage(ch[k + 1]); pts.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); } });
    const r = cheminLisse(pts, 1, 0.012), n = Math.min(3, 1 + (ch.length / 3 | 0));
    for (let k = 0; k < n; k++) {
      const nom = GENS[(j + k * 2) % GENS.length], [vit, quand] = VOYAGE[nom], ph = hache(j, k, 9) * 2 * r.long;
      ajoute(A(nom), (t, dt, o) => {
        const m = (t * vit + ph) % (2 * r.long), aller = m < r.long, p = r.en(aller ? m : 2 * r.long - m), cap = p.cap + (aller ? 0 : Math.PI), d = 0.035;
        o.position.set(p.x + Math.sin(cap) * d, p.y + (nom === 'voyageur' ? Math.abs(Math.sin(t * 7 + ph)) * 0.004 : nom === 'cavalier' ? Math.abs(Math.sin(t * 9 + ph)) * 0.005 : 0), p.z + Math.cos(cap) * d);
        o.rotation.y = cap;
      }, quand);
    }
  });

  // ---- vaches dans les prés près des villages (rentrées la nuit et l'hiver)
  pres.slice(0, 10).forEach((i, j) => {
    const k = posCase(i), y = P.dessus(i);
    for (const n of [0, 1]) {
      const x = k.x + (hache(i, n, 40) - 0.5) * 0.6, z = k.z + (hache(i, n, 50) - 0.5) * 0.5, a = hache(j, n, 60) * 6, ph = n * 2.1 + j;
      ajoute(A('vache', ECH * 0.9), (t, dt, o) => { o.position.set(x + Math.sin(t * 0.15 + ph) * 0.08, y, z); o.rotation.y = a + Math.sin(t * 0.2 + ph) * 0.8; }, () => JOUR() && climat.saison !== 0);
    }
  });

  // ---- troupeaux de moutons, leur berger et son chien, dans d'autres prés (rentrés la nuit, l'hiver et sous la pluie)
  pres.slice(10, 16).forEach((i, j) => {
    const k = posCase(i), y = P.dessus(i), quand = () => dehors() && climat.saison !== 0;
    for (let n = 0; n < 5; n++) {
      const cx = k.x + (hache(i, n, 41) - 0.5) * 0.35, cz = k.z + (hache(i, n, 42) - 0.5) * 0.3, ph = n * 1.9 + j;
      ajoute(A('mouton', ECH * 0.85), (t, dt, o) => {
        const u = t * 0.12 + ph; o.position.set(cx + Math.sin(u) * 0.06, y, cz + Math.cos(u * 0.8) * 0.05);
        o.rotation.set(0, -u + Math.PI / 2, Math.sin(t * 0.7 + ph) > 0.5 ? -0.35 : 0);   // (et broute de temps en temps)
      }, quand);
    }
    const bx = k.x + 0.3, bz = k.z + 0.18;
    ajoute(A('berger'), (t, dt, o) => { o.position.set(bx, y, bz); o.rotation.set(0, Math.PI + Math.sin(t * 0.15 + j) * 0.6, 0); }, quand);
    ajoute(A('chien', ECH * 0.9), (t, dt, o) => {
      // il fait le tour du troupeau en courant, puis s'arrête un moment
      const cy = (t + j * 5) % 14, u = cy < 6 ? cy * 1.05 : 6 * 1.05, a = u + j;
      o.position.set(k.x + Math.cos(a) * 0.3, y + (cy < 6 ? Math.abs(Math.sin(t * 11)) * 0.006 : 0), k.z + Math.sin(a) * 0.26); o.rotation.y = -a - Math.PI;
    }, quand);
  });

  // ---- barques qui remontent et descendent les rivières, entre deux cascades (pas sur l'eau gelée)
  (C.rivieres || []).map(rv => {
    let run = [], best = [];
    for (const i of rv) { if (!terre(i) || bati.has(i) || (run.length && Math.abs(P.hauteur(i) - P.hauteur(run.at(-1))) > 0.05)) { if (run.length > best.length) best = run; run = []; } if (terre(i) && !bati.has(i)) run.push(i); }
    return run.length > best.length ? run : best;
  }).filter(r => r.length >= 3).sort((a, b) => hache(a[0], 12) - hache(b[0], 12)).slice(0, 6).forEach((run, j) => {
    // la même courbe que l'eau (plateau.js, rivieres) : du milieu du bord d'amont au milieu du bord d'aval, tirée vers M
    const pts = [];
    run.forEach((i, n) => {
      const kk = posCase(i), mil = q => { const o = posCase(q); return [(kk.x + o.x) / 2, (kk.z + o.z) / 2]; };
      const A0 = n ? mil(run[n - 1]) : [kk.x, kk.z], B0 = n < run.length - 1 ? mil(run[n + 1]) : [kk.x, kk.z], M = [kk.x + (hache(kk.c, kk.r, 5) - 0.5) * 0.4, kk.z + (hache(kk.c, kk.r, 6) - 0.5) * 0.4];
      for (let s = n ? 1 : 0; s <= 4; s++) { const u = s / 4; pts.push([(1 - u) ** 2 * A0[0] + 2 * u * (1 - u) * M[0] + u * u * B0[0], (1 - u) ** 2 * A0[1] + 2 * u * (1 - u) * M[1] + u * u * B0[1]]); }
    });
    const r = cheminLisse(pts, 0, 0), y = P.hauteur(run[0]) + 0.012, ph = hache(run[0], 13) * 2 * r.long;
    ajoute(A('barque', 0.035), (t, dt, o) => {
      const m = (t * 0.05 + ph) % (2 * r.long), aller = m < r.long, p = r.en(aller ? m : 2 * r.long - m);
      o.position.set(p.x, y + Math.sin(t * 1.4 + ph) * 0.003, p.z); o.rotation.set(Math.sin(t * 1.2 + ph) * 0.04, p.cap + (aller ? 0 : Math.PI), 0);
    }, () => JOUR() && climat.gel < 0.3);
  });

  // ---- faune des lisières : cerf et biches, sangliers ou renard, entre une forêt et un pré
  const lisieres = ordre([...Array(N).keys()].filter(i => foret[i] && terre(i) && hache(i, 31) < 0.34 && voisins(i).some(n => terre(n) && C.terrain[n] === 4 && !foret[n] && !bati.has(n))), 32).slice(0, 10);
  lisieres.forEach((i, g) => {
    const n = voisins(i).find(n => terre(n) && C.terrain[n] === 4 && !foret[n] && !bati.has(n)), k = posCase(i), q = posCase(n), h = hache(i, 33);
    const gr = h < 0.45 ? [['cerf', 1], ['biche', 0.9], ['biche', 0.6]] : h < 0.8 ? [['sanglier', 1], ['sanglier', 0.55], ['sanglier', 0.5]] : [['renard', 1]];
    let ex = q.z - k.z, ez = -(q.x - k.x); const el = Math.hypot(ex, ez); ex /= el; ez /= el;
    const y = Math.max(P.dessus(i), P.dessus(n));
    gr.forEach(([esp, tl], j) => {
      const bx = (k.x + q.x) / 2 + (j ? (hache(g, j, 33) - 0.5) * 0.25 : 0), bz = (k.z + q.z) / 2 + (j ? (hache(g, j, 34) - 0.5) * 0.25 : 0), ph = g * 1.7 + j * 0.35, v = esp === 'renard' ? 0.35 : esp === 'sanglier' ? 0.3 : 0.18;
      ajoute(A(esp, ECH * tl), (t, dt, o) => {
        // va-et-vient le long de la lisière, avec des haltes pour brouter ; le renard trotte
        const p = t * v + ph, u = Math.sin(p - 0.6 * Math.sin(p)) * 0.4, sens = Math.cos(p - 0.6 * Math.sin(p)) >= 0 ? 1 : -1;
        o.position.set(bx + ex * u, y + (esp === 'renard' ? Math.abs(Math.sin(t * 7 + ph)) * 0.01 : 0), bz + ez * u); o.rotation.y = Math.atan2(-ez * sens, ex * sens);
      }, JOUR);
    });
  });

  // ---- bateaux au large, barques des pêcheurs et du port
  const large = ordre([...Array(N).keys()].filter(i => C.terrain[i] === 0 && hache(i, 23) < 0.25 && voisins(i).every(n => C.terrain[n] === 0)), 24).slice(0, 6);
  large.forEach((i, j) => {
    const k = posCase(i), r = 0.5 + hache(i, 3) * 0.6, ph = j * 1.7, v = 0.05 + hache(i, 5) * 0.05;
    ajoute(A('bateau', 0.05), (t, dt, o) => { const an = t * v + ph; o.position.set(k.x + Math.cos(an) * r, MER - 0.01 + Math.sin(t * 1.3 + ph) * 0.006, k.z + Math.sin(an) * r); o.rotation.set(Math.sin(t * 1.1 + ph) * 0.05 * (1 + climat.vent), -an, 0); });
  });
  for (const b of bats) {
    if (b.cle !== 'pecheur' && b.cle !== 'port') continue;
    const e = voisins(b.case).find(n => n >= 0 && !P.TERRE(C.terrain[n])); if (e == null) continue;
    const k = posCase(b.case), q = posCase(e), f = b.cle === 'port' ? 0.75 : 0.62, x = k.x + (q.x - k.x) * f, z = k.z + (q.z - k.z) * f, cap = -Math.atan2(q.z - k.z, q.x - k.x) + Math.PI / 2, ph = hache(b.id, 4) * 6;
    ajoute(A(b.cle === 'port' ? 'bateau' : 'barque', b.cle === 'port' ? 0.05 : 0.035), (t, dt, o) => {
      o.position.set(x + Math.sin(t * 0.2 + ph) * 0.04, MER - 0.01 + Math.sin(t * 1.3) * 0.006, z + Math.cos(t * 0.17 + ph) * 0.04); o.rotation.set(Math.sin(t * 1.1) * 0.05 * (1 + climat.vent), cap + Math.sin(t * 0.1 + ph) * 0.3, 0);
    }, () => JOUR() && !PLUIE() && climat.genre !== 'tempete' && climat.genre !== 'orage' && climat.gel < 0.5);  // le bétail rentre aussi sous la pluie
  }

  // ---- un vol d'oiseaux en V qui traverse le regard
  for (let n = 0; n < 7; n++) {
    const row = n - 3;
    ajoute(A('oiseau', 0.035), (t, dt, o) => {
      const R = Math.max(10, cam.d), cy = 46, u = ((t / cy) % 1) * 2 - 1, k = Math.floor(t / cy), ang = hache(k, 7) * 6.28, ca = Math.cos(ang), sa = Math.sin(ang);
      const bx = cam.x + ca * u * R * 1.6 - sa * R * 0.2, bz = cam.z + sa * u * R * 1.6 + ca * R * 0.2, d = Math.abs(row) * 0.12;
      o.position.set(bx - ca * d - sa * row * 0.12, 2.6 + Math.abs(row) * 0.03 + Math.sin(t * 9 + n) * 0.01, bz - sa * d + ca * row * 0.12);
      o.rotation.set(Math.sin(t * 9 + n * 0.7) * 0.4, -ang, 0);
    }, () => JOUR() && climat.oiseaux);
  }

  // ---- travaux des champs selon la saison (faucheurs l'été, semeur au printemps, laboureur et corbeaux à l'automne)
  const champ = (nom, saisons, x, z, y, an, extra) => {
    const { geste, v, L = 0.36, ph = 0 } = extra;
    ajoute(A(nom), (t, dt, o) => {
      const p = t * v + ph, saut = geste === 'sautille', u = saut ? Math.sin(Math.floor(p) * 2.7) : Math.sin(p), sens = saut ? (Math.floor(p) % 2 ? 1 : -1) : Math.cos(p) >= 0 ? 1 : -1;
      const ca = Math.cos(an), sa = Math.sin(an), d = u * L / 2;
      o.position.set(x + d * ca, y + (saut ? Math.abs(Math.sin(p * Math.PI)) * 0.012 : 0), z - d * sa);
      o.rotation.set(0, an + (sens < 0 ? Math.PI : 0) + (geste === 'fauche' ? Math.sin(t * 2.4 + ph) * 0.6 : 0), geste === 'cueille' ? -Math.max(0, Math.sin(t * 1.1 + ph * 3)) * 0.7 : 0);
    }, () => saisons.includes(climat.saison) && dehors()); // tout le monde rentre la nuit et quand il pleut
  };
  for (const [i, pc] of champs) {
    const y = P.dessus(i) + 0.03, c = (b, cote) => pc.centres.find(q => q.b === b && q.cote === cote) || pc.centres[0];
    const ph = k => hache(i, k, 30) * 6;
    for (const [b, cote, nom, s, ex] of [[-1, -1, 'faucheur', [2], { geste: 'fauche', v: 0.12 }], [0, -1, 'faucheur', [2], { geste: 'fauche', v: 0.1 }], [1, 1, 'semeur', [1], { geste: 'marche', v: 0.25 }], [1, -1, 'charrue', [3], { geste: 'marche', v: 0.12, L: 0.3 }]]) {
      const q = c(b, cote); champ(nom, s, q.x, q.z, y, pc.an, { ...ex, ph: ph(b * 3 + cote) });
    }
    for (let n = 0; n < 3; n++) { const q = c(n - 1, 1); champ('corbeau', [3, 0], q.x, q.z, y, pc.an, { geste: 'sautille', v: 0.6, L: 0.3, ph: n * 2.3 + i }); }
    // le soir, les paysans rentrent au village le plus proche (pendant le crépuscule, 30 s)
    const q0 = pc.centres[0], v0 = etat.villes.map(v => posCase(v.case)).sort((A, B) => (A.x - q0.x) ** 2 + (A.z - q0.z) ** 2 - ((B.x - q0.x) ** 2 + (B.z - q0.z) ** 2))[0];
    if (v0 && climat.saison !== 0) for (let n = 0; n < 2; n++) ajoute(A(n ? 'semeur' : 'faucheur'), (t, dt, o) => {
      const u = Math.min(1, (climat.p || 0) / 28), x = q0.x + (v0.x - q0.x) * u + n * 0.04, z = q0.z + (v0.z - q0.z) * u;
      o.position.set(x, P.solEn(x, z) + 0.03 + Math.abs(Math.sin(t * 7 + n)) * 0.006, z); o.rotation.y = Math.atan2(v0.x - q0.x, v0.z - q0.z);
    }, () => climat.phase === 'crepuscule' && !PLUIE());
    // blés qui ondulent : 4 × 3 épis par parcelle
    const ca = Math.cos(pc.an), sa = Math.sin(pc.an), W = pc.W || 0.46, D = pc.D || 0.24;
    for (const q of pc.centres) for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
      const lx = (a / 3 - 0.5) * W * 0.8, lz = (b / 2 - 0.5) * D * 0.7;
      bles.push({ x: q.x + lx * ca + lz * sa, z: q.z - lx * sa + lz * ca, y, ci: hache(i, q.b + 2, q.cote + 5) });
    }
  }

  // ---- les bâtiments et leurs gens
  const decorBat = (R, f) => { const L = lot(); f(L); groupeBat(L, R, VIE); };
  for (const b of bats) {
    const R = repere(b), yb = R.y + DALLE;
    const ronde = (nom, s, cx, cz, r, v, ph, opt, quand) => ajoute(A(nom, s), (t, dt, o) => {
      const ang = opt.arret ? ph + t * v + Math.sin(t * 0.6 + ph) * 0.6 : ph + t * v, p = posB(R, cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
      o.position.set(p.x, yb + (opt.saute ? Math.abs(Math.sin(t * 9 + ph)) * 0.01 : 0), p.z);
      o.rotation.set(0, opt.tourne ? t * 3 + ph : capB(R, -Math.sin(ang), Math.cos(ang)), 0);
    }, quand);
    const fixe = (nom, lx, lz, cap, balance, quand) => { const p = posB(R, lx, lz); return ajoute(A(nom), (t, dt, o) => { o.position.set(p.x, yb + Math.abs(Math.sin(t * balance + p.x * 9)) * 0.004, p.z); o.rotation.set(0, cap, Math.sin(t * balance) * 0.08); }, quand); };
    const navette = (nom, a, c, y, v, quand) => ajoute(A(nom), (t, dt, o) => {
      const u = (Math.sin(t * v) + 1) / 2, s = Math.cos(t * v) >= 0 ? 1 : -1;
      o.position.set(a.x + (c.x - a.x) * u, y + Math.abs(Math.sin(t * 7)) * 0.004, a.z + (c.z - a.z) * u); o.rotation.y = -Math.atan2((c.z - a.z) * s, (c.x - a.x) * s);
    }, quand);
    switch (b.cle) {
      case 'ferme': {
        for (const [fx, fz, lng, bb] of [[-3.6, 2.6, 4.4, 0], [2.2, 3.4, 4.6, 1]]) { const p = posB(R, fx, fz); champ(bb ? 'charrue' : 'faucheur', bb ? [3, 1] : [2], p.x, p.z, R.y + 0.045, R.th, { geste: bb ? 'marche' : 'fauche', v: 0.1, L: lng * ECH_BAT, ph: bb * 2 }); }
        for (let n = 0; n < 5; n++) { const p = posB(R, -3.4 + (hache(n, 1, 44) - 0.5) * 3, -0.2 + (hache(n, 2, 44) - 0.5) * 1.6); basseCour('poule', ECH * 0.8, p, yb, n * 1.3, 0.04, false); }
        break;
      }
      case 'bergerie': for (let n = 0; n < 6; n++) { const p = posB(R, (hache(n, 3, 45) - 0.5) * 7, 1 + (hache(n, 4, 45) - 0.5) * 6); basseCour('mouton', ECH * 0.85, p, yb, n * 1.7, 0.12, true); } break;
      case 'vignoble': for (let n = 0; n < 3; n++) {
        const p = posB(R, -0.9, (n - 1) * 1.7 + 0.85); // entre deux rangs de vigne
        champ('vendangeur', [3], p.x, p.z, R.y + 0.03, R.th, { geste: 'cueille', v: 0.06, L: 0.8, ph: n * 2.1 });
        if (n < 2) champ('paysan', [1, 2], p.x, p.z, R.y + 0.03, R.th, { geste: 'cueille', v: 0.05, L: 0.8, ph: n * 2.7 + 1 });
      } break;
      case 'marche': { // un marché proche du regard : quartiers.js a ses marchands et ses clients
        const loin = () => !PROCHES.has(b.id);
        for (const [sx, sz] of [[-3.2, -2.6], [3, -2.8], [-3, 3], [3.2, 2.8]]) fixe('marchand', sx * 1.28, sz * 1.28, capB(R, -sx, -sz), 1.5, () => MATIN() && loin());
        ['cliente', 'client', 'cliente2', 'client'].forEach((nom, i) => ronde(nom, ECH, 0, 0, 2.1, 0.12, i * 1.6, { arret: true }, () => MATIN() && !PLUIE() && loin()));
        break;
      }
      case 'hotel': {
        const loin = () => !PROCHES.has(b.id); // une mairie proche du regard : quartiers.js a ses enfants, son allumeur et ses lanternes
        ['enfant0', 'enfant1', 'enfant2'].forEach((nom, i) => ronde(nom, ECH * 0.75, 1.8, 2.6, 1.1, 1.1, i * 2.1, { saute: true }, () => dehors() && loin()));
        if (epoque === 'industrie') { // réverbères : l'allumeur passe à l'aube et au crépuscule, les lanternes brillent la nuit
          const pts = [[-3.2, 2.3], [3.2, 2.3], [3.4, -2.3], [-3.4, -2.3]].map(([lx, lz]) => posB(R, lx, lz));
          for (const p of pts) lampes.push([p.x, yb + 0.28, p.z, b.id]);
          ajoute(A('allumeur'), (t, dt, o) => { const n = pts.length, u = (t * 0.12) % n, i = Math.floor(u), f = Math.min(1, (u - i) * 1.4), a = pts[i], c = pts[(i + 1) % n]; o.position.set(a.x + (c.x - a.x) * f, yb, a.z + (c.z - a.z) * f); o.rotation.y = -Math.atan2(c.z - a.z, c.x - a.x); }, () => climat.heure === 'aube' && loin());
        }
        const v = etat.villes.find(v => v.case === b.case);
        if (v && fetes.has(v.id)) { // fête au village : guirlandes, bal et musicien sur la place
          decorBat(R, L => {
            const cs = [0xd9322a, 0xf2d040, 0x3a6ad9, 0xf6f2ea, 0x3fa04a];
            for (const [ax, az, bx, bz] of [[-5, -3, 4, 4], [-6, 0.5, 5.5, -0.5], [-1.5, -5.6, -0.5, 5.5]]) {
              const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.6);
              for (let i = 0; i <= n; i++) { const f = i / n, y = 5.6 - Math.sin(f * Math.PI) * 1.1; put(L, cone(0.22, 0.4, 3), cs[i % cs.length], ax + (bx - ax) * f, y - 0.2, az + (bz - az) * f, 0, 0); }
            }
          });
          ['danseuse', 'danseur', 'danseuse2', 'danseur', 'danseuse', 'danseur'].forEach((nom, i) => ronde(nom, ECH, -2.3, 2.9, 1, 0.7, i * Math.PI / 3, { tourne: true }, () => !PLUIE()));
          fixe('musicien', -2.3, 2.9, 0, 4, () => !PLUIE());
        }
        break;
      }
      case 'eglise': { // la cloche sonne dans son clocheton, les pigeons s'envolent du clocher
        decorBat(R, L => { for (const x of [-0.5, 0.5]) put(L, boite(0.15, 1.2, 0.15), 0xefe3c6, x, 6.4, 3.5, 0, 0.1); put(L, cone(0.8, 0.6, 4), 0x5d6f80, 0, 7.3, 3.5, Math.PI / 4, 0.1); });
        const Lc = lot(); put(Lc, new THREE.ConeGeometry(0.32, 0.5, 10).translate(0, -0.45, 0), 0xb08d57, 0, 0, 0, 0, 0.06); put(Lc, sphere(0.12, 0), 0x6a5030, 0, -0.75, 0, 0, 0);
        const cloche = fige(Lc, VIE), p = posB(R, 0, 3.5), ph = hache(b.id, 5) * 22; cloche.scale.setScalar(ECH_BAT); cloche.position.set(p.x, R.y + 7 * ECH_BAT, p.z); cloche.rotation.order = 'YXZ'; cloche.rotation.y = R.th;
        ajoute(cloche, t => { const cy = (t + ph) % 22; cloche.rotation.x = cy < 6 ? Math.sin(cy * 3) * 0.6 * (1 - cy / 6) : 0; });
        const cl = posB(R, 0, -2.4);
        for (let i = 0; i < 6; i++) ajoute(A('pigeon', 0.022), (t, dt, o) => {
          const cy = (t + ph) % 22, ang = t * 1.4 + i * 1.05, r = 0.14 + (i % 3) * 0.04;
          o.position.set(cl.x + Math.cos(ang) * r, R.y + 1 + Math.sin(cy / 9 * Math.PI) * 0.15 + (i % 2) * 0.03, cl.z + Math.sin(ang) * r); o.rotation.set(Math.sin(t * 12 + i) * 0.5, -ang - Math.PI / 2, 0);
        }, () => (horlogeT + ph) % 22 < 9 && dehors());
        break;
      }
      case 'forge': { // le forgeron bat le fer, les étincelles volent
        const p = posB(R, 1.5, 2.2), q = posB(R, 2.4, 2.2), cap = capB(R, 1, 0); let avant = 0;
        ajoute(A('forgeron'), (t, dt, o) => {
          const s = Math.sin(t * 6); o.position.set(p.x, yb, p.z); o.rotation.set(0, cap, -Math.max(0, s) * 0.45);
          if (avant > 0 && s <= 0) for (let n = 0; n < 8 && etincelles.length < 160; n++) etincelles.push({ x: q.x, y: yb + 0.1, z: q.z, vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.5, vie: 0.5 + Math.random() * 0.3 });
          avant = s;
        }, JOUR);
        break;
      }
      case 'bucheron': { // il abat un sapin, qui repousse
        const p = posB(R, -0.7, -4.8), q = posB(R, 0.6, -4.8), cap = capB(R, 1, 0), arbre = A('sapin', 0.11); arbre.rotation.order = 'YXZ';
        ajoute(arbre, (t, dt, ar) => {
          const cy = t % 14; ar.position.set(q.x, yb, q.z); ar.rotation.y = cap;
          if (cy < 7) { ar.rotation.z = Math.sin(t * 5) > 0.95 ? -0.03 : 0; ar.scale.setScalar(0.11); }
          else if (cy < 8.5) ar.rotation.z = -(((cy - 7) / 1.5) ** 2) * Math.PI / 2; // il tombe
          else if (cy < 11) ar.rotation.z = -Math.PI / 2;
          else if (cy < 12) ar.scale.setScalar(0.0001);
          else { ar.rotation.z = 0; ar.scale.set(0.11, 0.11 * (cy - 12) / 2 + 1e-4, 0.11); } // il repousse
        }, JOUR);
        ajoute(A('bucheron'), (t, dt, o) => { o.position.set(p.x, yb, p.z); o.rotation.set(0, cap, t % 14 < 7 ? -Math.max(0, Math.sin(t * 5)) * 0.5 : 0); }, JOUR);
        break;
      }
      case 'moulin': { // le meunier porte ses sacs du moulin à la charrette
        const a = posB(R, 0, 2.6), c = posB(R, -3, 3.8), ch = posB(R, -3.9, 4.1), char = A('char');
        char.position.set(ch.x, yb, ch.z); char.rotation.y = capB(R, 0, 1); ajoute(char);
        navette('meunier', a, c, yb, 0.35, dehors);
        break;
      }
      case 'mine_fer': case 'mine_charbon': case 'mine_or': navette('wagonnet', posB(R, -1.5, 2.6), posB(R, -1.5, 6.2), yb + 0.02, 0.3, JOUR); break;
    }
  }
  function basseCour(nom, s, p, y, ph, r, lent) {
    ajoute(A(nom, s), (t, dt, o) => {
      const q = t * (lent ? 0.15 : 0.5) + ph, an = q + Math.sin(q * 0.7) * 2;
      o.position.set(p.x + Math.cos(an) * r * 0.5, y, p.z + Math.sin(an) * r * 0.5);
      o.rotation.set(0, -an - Math.PI / 2, Math.sin(t * (lent ? 0.8 : 5) + ph) > 0.4 ? -0.5 : 0);
    }, dehors);  // poules et moutons à l'abri la nuit et sous la pluie
  }

  // ---- la rivière la plus proche de la capitale : lavandières et linge, patineurs quand elle gèle
  const cap = etat.villes.find(v => v.proprio === 0 && v.capitale) || etat.villes.find(v => v.proprio === 0);
  if (cap && C.rivieres?.length) {
    const pc = posCase(cap.case); let best = null;
    C.rivieres.forEach(rv => rv.forEach((i, k) => { if (!terre(i) || bati.has(i)) return; const p = posCase(i), d = Math.hypot(p.x - pc.x, p.z - pc.z); if (!best || d < best.d) best = { rv, k, i, d }; }));
    if (best && best.d < 9) {
      const { rv, k, i } = best, kr = posCase(i), av = posCase(rv[k - 1] ?? i), ap = posCase(rv[k + 1] ?? i), y = P.dessus(i);
      let dx = ap.x - av.x, dz = ap.z - av.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const px = -dz, pz = dx, rive = { x: kr.x + px * 0.24, z: kr.z + pz * 0.24 };
      for (const o of [-0.07, 0.07]) {
        const x = rive.x + dx * o, z = rive.z + dz * o, cp = -Math.atan2(-pz, -px), ph = o * 30;
        ajoute(A('lavandiere'), (t, dt, a) => { a.position.set(x, y + 0.005, z); a.rotation.set(0, cp, -Math.max(0, Math.sin(t * 1.8 + ph)) * 0.8 - 0.3); }, () => dehors() && climat.saison !== 0);
      }
      cordeLinge(kr.x + px * 0.4, y, kr.z + pz * 0.4, -Math.atan2(dz, dx), () => climat.saison !== 0 && !PLUIE());
      const seg = rv.slice(Math.max(0, k - 5), k + 6).filter(terre);
      if (seg.length > 2) {
        const ch = cheminLisse(seg.map(j => { const p = posCase(j); return [p.x, p.z]; })), yp = Math.max(0, P.dessus(seg[0])) + 0.012;
        for (let n = 0; n < 2; n++) ajoute(A('patineur'), (t, dt, o) => {
          const sd = (Math.sin(t * 0.18 + n * 2.2) + 1) / 2 * ch.long, p = ch.en(sd), sens = Math.cos(t * 0.18 + n * 2.2) >= 0;
          o.position.set(p.x, yp, p.z); o.rotation.set(0, p.cap + (sens ? 0 : Math.PI), Math.sin(t * 2 + n * 2.2) * 0.25);
        }, () => climat.saison === 0 && climat.gel > 0.3 && dehors());
      }
    }
  }

  // ---- la foule des villes : des passants entre la place et les quartiers voisins, plus nombreux dans les grandes villes
  // (population si le jeu la donne, sinon le rang de la ville et ses bâtiments) ; personne sous la pluie ni dans une ville assiégée
  const PASSANTS = ['cliente', 'client', 'paysan', 'cliente2', 'enfant1', 'client', 'cliente', 'marchand'];
  for (const v of etat.villes) {
    const autour = voisins(v.case).filter(n => bati.has(n) && terre(n)), nb = etat.batiments.filter(b => b.ville === v.id).length;
    const n = Math.min(18, Math.round(v.pop ? 2 + Math.sqrt(v.pop) / 6 : 2 + (v.niveau || 1) * 2 + nb / 2 + (v.capitale ? 4 : 0)));
    const pts = [v.case, ...autour].map(i => posCase(i));
    for (let k = 0; k < n; k++) {
      // chacun va de la place vers un quartier voisin et revient, en flânant de côté
      const a = pts[0], b = pts[1 + (k % Math.max(1, pts.length - 1))] || { x: a.x + Math.cos(k * 2.4) * 0.6, z: a.z + Math.sin(k * 2.4) * 0.6 };
      const ph = hache(v.case, k, 71) * 6.28, vit = 0.08 + hache(v.case, k, 72) * 0.06, ec = (hache(v.case, k, 73) - 0.5) * 0.5, nom = PASSANTS[(k + v.case) % PASSANTS.length];
      const px = -(b.z - a.z), pz = b.x - a.x;
      ajoute(A(nom, nom.startsWith('enfant') ? ECH * 0.75 : ECH), (t, dt, o) => {
        const u = (Math.sin(t * vit + ph) + 1) / 2 * 0.8 + 0.1, sens = Math.cos(t * vit + ph) >= 0 ? 1 : -1, cote = ec + Math.sin(t * 0.3 + ph) * 0.06;
        const x = a.x + (b.x - a.x) * u + px * cote * 0.35, z = a.z + (b.z - a.z) * u + pz * cote * 0.35;
        o.position.set(x, P.solEn(x, z) + DALLE + Math.abs(Math.sin(t * 7 + ph)) * 0.003, z); o.rotation.y = -Math.atan2((b.z - a.z) * sens, (b.x - a.x) * sens);
      }, () => dehors() && !v.assiegee);
    }
    // ---- du linge qui sèche entre deux maisons (pas l'hiver, ni sous la pluie)
    for (let j = 0; j < Math.min(3, 1 + (v.niveau || 1) / 2 | 0); j++) {
      const i = j === 0 ? v.case : autour[j - 1]; if (i == null) break;
      const q = posCase(i), an = hache(i, j, 74) * 6.28, x = q.x + Math.cos(an) * 0.62, z = q.z + Math.sin(an) * 0.62;
      cordeLinge(x, P.solEn(x, z), z, an + Math.PI / 2, () => climat.saison !== 0 && !PLUIE() && JOUR());
    }
  }

  // ---- fleurs et papillons au printemps, bonshommes de neige l'hiver
  const FLEURS = lot(), NEIGE = lot();
  pres.slice(0, 40).forEach(i => { const k = posCase(i), y = P.dessus(i); for (let n = 0; n < 9; n++) { const a = hache(i, n, 61) * 6.28, l = Math.sqrt(hache(i, n, 62)) * 0.6; put(FLEURS, sphere(0.014, 0), [0xff7ab8, 0xffd34d, 0xffffff, 0xb57bff][n % 4], k.x + Math.cos(a) * l, y + 0.012, k.z + Math.sin(a) * l, 0, 0); } });
  pres.slice(0, 12).forEach((i, n) => { const k = posCase(i), y = P.dessus(i); [0, 1].forEach(j => { const ph = n * 1.3 + j * 2.7; ajoute(A(`papillon${(n + j) % 4}`, 0.03), (t, dt, o) => { const u = t * 0.5 + ph; o.position.set(k.x + Math.sin(u) * 0.3 + Math.sin(u * 2.3) * 0.05, y + 0.06 + Math.sin(u * 3.1) * 0.03, k.z + Math.cos(u * 0.8) * 0.25); o.rotation.y = -u; o.scale.set(0.03, 0.03, 0.03 * (0.2 + Math.abs(Math.sin(t * 16 + ph * 5)))); }, () => (climat.saison === 1 || climat.saison === 2) && dehors()); }); });
  for (const v of etat.villes.slice(0, 16)) {
    const i = voisins(v.case).find(n => terre(n) && !bati.has(n) && !foret[n] && C.terrain[n] <= 5); if (i == null) continue;
    const k = posCase(i), x = k.x + 0.2, z = k.z - 0.15, y = P.dessus(i);
    put(NEIGE, sphere(0.036, 1), 0xf6f8fb, x, y + 0.018, z, 0, 0.003); put(NEIGE, sphere(0.026, 1), 0xf6f8fb, x, y + 0.046, z, 0, 0.003); put(NEIGE, sphere(0.018, 1), 0xf6f8fb, x, y + 0.068, z, 0, 0.003);
    put(NEIGE, new THREE.CylinderGeometry(0.012, 0.014, 0.02, 8), 0x1f1f1f, x, y + 0.088, z, 0, 0.002); put(NEIGE, new THREE.ConeGeometry(0.004, 0.016, 5).rotateZ(-Math.PI / 2), 0xf08a30, x + 0.012, y + 0.07, z, 0, 0);
  }
  if (FLEURS.g.length) { const g = fige(FLEURS, VIE); ajoute(g, null, () => climat.saison === 1); }
  if (NEIGE.g.length) { const g = fige(NEIGE, VIE); ajoute(g, null, () => climat.saison === 0); }

  // ---- lucioles (forêts et prés habités), feuilles mortes (forêts proches du regard)
  forets = [...Array(N).keys()].filter(i => foret[i] && terre(i));
  ordre([...forets.filter(i => proprio[i] >= 0), ...pres], 81).slice(0, 80).forEach((i, n) => { const k = posCase(i), y = P.dessus(i); for (let j = 0; j < 3; j++) lucioles.push({ x: k.x + (hache(n, j, 81) - 0.5) * 1.2, z: k.z + (hache(n, j, 82) - 0.5) * 1.2, y: y + 0.05 + hache(n, j, 83) * 0.2, ph: n * 3 + j }); });

  // ---- fenêtres allumées la nuit
  batsVie = bats; remplirFenetres();

  // ---- le train : de la gare à l'usine la plus proche, quand le joueur a le chemin de fer
  const gare = bats.find(b => b.proprio === 0 && b.cle === 'gare'), usines = new Set(bats.filter(b => b.proprio === 0 && USINES.includes(b.cle)).map(b => b.case));
  if (train && gare && usines.size) {
    const ch = plusCourt(gare.case, usines, n => (!terre(n) || C.terrain[n] === 6 ? Infinity : usines.has(n) ? 1 : bati.has(n) ? 8 : C.riviere[n] ? 3 : C.terrain[n] === 5 ? 2 : foret[n] ? 1.5 : 1));
    if (ch && ch.length >= 2) poserVoie(ch, repere(gare));
  }
  installerPools();
}
let forets = [], horlogeT = 0, batsVie = [];
/** Les fenêtres allumées des bâtiments (points posés au hasard), sauf ceux dont quartiers.js allume les vraies vitres une à une. */
export function remplirFenetres() {
  const fp = FENETRES.geometry.attributes.position, fc = FENETRES.geometry.attributes.color; let nf = 0;
  for (const b of batsVie) {
    if (PROCHES.has(b.id)) continue;
    const k = posCase(b.case), y = P.dessus(b.case), nb = b.cle === 'hotel' ? 9 : ['maison', 'maison_pierre', 'hotel_particulier', 'immeuble'].includes(b.cle) ? 7 : b.cle === 'cabane' ? 4 : 3;
    for (let i = 0; i < nb && nf < fp.count; i++, nf++) {
      fp.setXYZ(nf, k.x + (hache(b.id, i, 80) - 0.5) * 0.7, y + 0.08 + hache(b.id, i, 90) * 0.2, k.z + (hache(b.id, i, 100) - 0.5) * 0.6);
      fc.setXYZ(nf, 1, i % 3 ? 0.74 : 0.9, i % 3 ? 0.36 : 0.65);
    }
  }
  FENETRES.geometry.setDrawRange(0, nf); fp.needsUpdate = fc.needsUpdate = true;
}

function poserVoie(ch, Rg) {
  // la voie sort de la gare par le bout de ses quais (z local = +3) le plus proche de la case suivante, et s'arrête au pied de l'usine
  const q1 = posCase(ch[1]), bouts = [posB(Rg, -5.5, 3), posB(Rg, 5.5, 3)].sort((a, b) => Math.hypot(a.x - q1.x, a.z - q1.z) - Math.hypot(b.x - q1.x, b.z - q1.z));
  const quai = posB(Rg, 0, 3), pts = [[quai.x, quai.z], [bouts[0].x, bouts[0].z], ...ch.slice(1).map(i => { const p = posCase(i); return [p.x, p.z]; })];
  const n = pts.length - 1; pts[n] = [pts[n][0] + (pts[n - 1][0] - pts[n][0]) * 0.3, pts[n][1] + (pts[n - 1][1] - pts[n][1]) * 0.3];
  RAIL = cheminLisse(pts, 3, 0.02);
  const L = lot();
  put(L, ruban(RAIL.pts, RAIL.ys, 0.065, 0), 0x9a948a, 0, 0, 0, 0, 0); // ballast
  for (let sd = 0.02; sd < RAIL.long; sd += 0.045) { const p = RAIL.en(sd); put(L, new THREE.BoxGeometry(0.026, 0.008, 0.13), 0x5b3a1e, p.x, p.y + 0.002, p.z, p.cap, 0); } // traverses
  for (let i = 0; i < RAIL.pts.length - 1; i++) { // deux rails
    const [ax, az] = RAIL.pts[i], [bx, bz] = RAIL.pts[i + 1], l = Math.hypot(bx - ax, bz - az); if (l < 1e-5) continue;
    const cp = -Math.atan2(bz - az, bx - ax), px = -(bz - az) / l, pz = (bx - ax) / l, y = (RAIL.ys[i] + RAIL.ys[i + 1]) / 2 + 0.01;
    for (const o of [-0.032, 0.032]) put(L, new THREE.BoxGeometry(l + 0.004, 0.01, 0.008), 0x8a8f96, (ax + bx) / 2 + px * o, y, (az + bz) / 2 + pz * o, cp, 0);
  }
  fige(L, VIE);
  // navette : la locomotive tire à l'aller et pousse au retour ; arrêts aux deux bouts
  const voitures = [acteur('loco'), acteur('wagon'), acteur('wagon')], ecart = 0.115, utile = Math.max(0.01, RAIL.long - ecart * 2 - 0.04); let fumee = 0;
  ajoute(voitures[0], (t, dt) => {
    const u = Math.max(-1, Math.min(1, Math.sin(t * 0.9 / Math.max(1, RAIL.long)) * 1.25)), tete = 0.02 + ecart * 2 + (u + 1) / 2 * utile;
    voitures.forEach((o, i) => { const p = RAIL.en(tete - i * ecart); o.position.set(p.x, p.y, p.z); o.rotation.y = p.cap; });
    if (Math.abs(u) < 1 && (fumee -= dt) <= 0) { fumee = 0.35; const p = RAIL.en(tete + 0.045); bouffee(p.x, p.y + 0.1, p.z, 'noire'); }
  });
}

// ------------------------------------------------------------------ armées : exercice, tambour en marche, bivouac la nuit
const armees = new Map(); // id → { coul, biv, flamme, tambour, cache }
function creerBivouac(coul) {
  const L = lot(), r = new THREE.Color(coul).getHex();
  [[-3, -2, r], [0.2, -3.4, 0xe9e2d0], [3.2, -2, r], [-2.6, 2.2, 0xe9e2d0]].forEach(([x, z, c]) => { put(L, cone(1.5, 2, 4), c, x, 1, z, Math.PI / 4, 0.09); put(L, boite(0.5, 0.9, 0.1), 0x2a2420, x, 0.45, z + 1.03, 0, 0); });
  for (const a of [0, 1.2, 2.4]) put(L, boite(1.4, 0.18, 0.18), 0x6b4a2a, 1.6 + Math.cos(a) * 0.1, 0.12, 1.6 + Math.sin(a) * 0.1, a, 0.06);
  for (const a of [0, 2.1, 4.2]) put(L, boite(0.07, 2, 0.07).rotateZ(0.25), 0x5b3a1e, 4.4 + Math.cos(a) * 0.25, 0.95, 1.2 + Math.sin(a) * 0.25, a, 0); // faisceau de fusils
  { const x = -4.6, z = 0.4; put(L, boite(0.24, 0.9, 0.3), 0xf2efe6, x, 0.45, z, 0, 0.05); put(L, boite(0.75, 1, 0.5), r, x, 1.4, z, 0, 0.07); put(L, sphere(0.28, 1), 0xf0c9a0, x, 2.1, z, 0, 0.05); put(L, boite(0.09, 2.2, 0.09), 0x5b3a1e, x + 0.42, 1.6, z, 0, 0); } // sentinelle
  const biv = fige(L, scene); biv.matrixAutoUpdate = false;
  const flamme = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6).translate(0, 0.55, 0), new THREE.MeshBasicMaterial({ color: 0xff9a2a })); flamme.position.set(1.6, 0.15, 1.6); biv.add(flamme);
  const Lt = lot();
  for (const [g, x, y, z, c] of [[boite(0.24, 0.9, 0.3), 0, 0.45, 0.16, 0xf2efe6], [boite(0.24, 0.9, 0.3), 0, 0.45, -0.16, 0xf2efe6], [boite(0.5, 0.95, 0.75), 0, 1.35, 0, r], [sphere(0.28, 1), 0.02, 2.1, 0, 0xf0c9a0], [cone(0.55, 0.3, 3), 0, 2.4, 0, 0x1f1f1f], [cyl(0.36, 0.36, 0.45, 10).rotateX(Math.PI / 2), 0.45, 1.1, 0, 0xf2efe6], [cyl(0.38, 0.38, 0.08, 10).rotateX(Math.PI / 2), 0.45, 1.1, 0.24, 0xb8322a]]) put(Lt, g, c, x, y, z, 0, 0.09);
  const tambour = fige(Lt, scene); tambour.scale.setScalar(ECH);
  biv.visible = tambour.visible = false;
  return { coul, biv, flamme, tambour, cache: false, fumee: 0 };
}
const LIGNE = Array.from({ length: 6 }, (_, i) => [-3.4 + i * 1.15 + 0.42, 2.7, 2.9]), CANONS = [[5.4, 1.2, 3.3], [7.2, 1.2, 2.7]];
const feux = [];
function majArmees(t, dt) {
  feux.length = 0;
  const liste = MONDE.listeArmees?.() || [], vus = new Set();
  for (const a of liste) {
    const g = a.groupe; if (!g) continue;
    vus.add(a.id);
    const coul = couleurs[a.proprio] || '#888888';
    let s = armees.get(a.id);
    if (!s || s.coul !== coul) { if (s) { jeter(s.biv); jeter(s.tambour); } s = creerBivouac(coul); armees.set(a.id, s); }
    const dort = climat.heure === 'nuit' && !a.enMarche;
    if (dort && g.visible) { g.visible = false; s.cache = true; } else if (!dort && s.cache) { g.visible = true; s.cache = false; }
    g.updateWorldMatrix(true, false);
    s.biv.visible = dort;
    if (dort) {
      s.biv.matrix.copy(g.matrixWorld); s.biv.matrixWorldNeedsUpdate = true;
      s.flamme.scale.set(1 + Math.sin(t * 13 + a.id) * 0.15, 1 + Math.sin(t * 17 + a.id) * 0.25, 1 + Math.cos(t * 11) * 0.15);
      _v.set(1.6, 1, 1.6).applyMatrix4(g.matrixWorld); feux.push(_v.x, _v.y - 0.05, _v.z);
      if ((s.fumee -= dt) <= 0) { s.fumee = 1.1; bouffee(_v.x, _v.y, _v.z, 'blanche', 0.45); }
    }
    s.tambour.visible = a.enMarche && JOUR() && g.visible;
    if (s.tambour.visible) { _v.set(-0.2, 0, 4.4).applyMatrix4(g.matrixWorld); s.tambour.position.set(_v.x, _v.y + Math.abs(Math.sin(t * 8)) * 0.006, _v.z); _v.set(0, 0, 1).transformDirection(g.matrixWorld); s.tambour.rotation.y = Math.atan2(_v.x, _v.z) - Math.PI / 2; }
    else if (!a.enMarche && JOUR() && g.visible) {
      // exercice de temps en temps : salve de la ligne, puis des canons
      const per = 40, cy = (t + hache(a.id, 7) * per) % per, av = cy - dt;
      // poudre mouillée (climat.poudre < 1) : des coups ratent, à peine une fumerolle
      const salve = (pts, k) => { for (const [lx, ly, lz] of pts) { _v.set(lx, ly, lz).applyMatrix4(g.matrixWorld); const rate = climat.poudre < 1 && Math.random() < 0.45; bouffee(_v.x, _v.y, _v.z, 'blanche', rate ? k * 0.25 : k); } };
      if (av < 1 && cy >= 1) salve(LIGNE, 1.6);
      if (av < 2.5 && cy >= 2.5) salve(CANONS, 3);
    }
  }
  for (const [id, s] of armees) if (!vus.has(id)) { jeter(s.biv); jeter(s.tambour); armees.delete(id); }
}

// ------------------------------------------------------------------ boucle
function majParticules(t, dt) {
  // étincelles
  for (let i = etincelles.length - 1; i >= 0; i--) { const e = etincelles[i]; e.vie -= dt; if (e.vie <= 0) { etincelles.splice(i, 1); continue; } e.vy -= dt * 1.6; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; }
  ETINC.count = etincelles.length;
  etincelles.forEach((e, i) => ETINC.setMatrixAt(i, _m.makeTranslation(e.x, e.y, e.z)));
  ETINC.instanceMatrix.needsUpdate = true;
  // blés qui ondulent (printemps : courts et verts ; été : hauts et dorés)
  const vb = (climat.saison === 1 || climat.saison === 2) && bles.length > 0 && !climat.famine;  // famine : les champs sont vides
  if (vb && (!BLE || BLE.instanceMatrix.count < bles.length)) { if (BLE) { scene.remove(BLE); BLE.dispose(); } BLE = new THREE.InstancedMesh(BLE_GEO, BLE_MAT, Math.ceil(bles.length * 1.3)); BLE.frustumCulled = false; BLE.castShadow = false; BLE.setColorAt(0, _c); scene.add(BLE); }
  if (BLE) BLE.visible = vb;
  if (vb) {
    // champs secs : jaunis (canicule), puis grillés et plus courts (sécheresse)
    const C = climat.sec === 2 ? [0xb08a4a, 0x9a7440, 0xa8864e] : climat.sec === 1 ? [0xd8c060, 0xc9b050, 0xd2b85a] : climat.saison === 1 ? [0x9fd35a, 0x86c24a, 0xb5d86a] : [0xe3c75b, 0xd6b24a, 0xa9c457, 0xc9b24a];
    const h = (climat.saison === 1 ? 0.55 : 1) * (climat.sec === 2 ? 0.6 : 1), V = Math.min(1.4, climat.vent);
    bles.forEach((b, i) => {
      const pench = Math.sin(t * 2.2 + b.x * 4 + b.z * 3) * 0.12 * (0.4 + V) + V * 0.12;
      _q.setFromEuler(_e.set(pench * 0.5, 0, pench, 'XYZ')); _m.compose(_p.set(b.x, b.y, b.z), _q, _s.set(1, h, 1)); BLE.setMatrixAt(i, _m);
    });
    // les couleurs ne changent qu'avec la saison ou les champs
    if (BLE.userData.sig !== bles.length * 16 + climat.saison * 4 + climat.sec) { BLE.userData.sig = bles.length * 16 + climat.saison * 4 + climat.sec; bles.forEach((b, i) => BLE.setColorAt(i, _c.setHex(C[b.ci * C.length | 0]).multiplyScalar(1.08))); BLE.instanceColor.needsUpdate = true; }
    BLE.count = bles.length; BLE.instanceMatrix.needsUpdate = true;
  }
  // feuilles mortes à l'automne, autour du regard
  FEUILLES.visible = climat.saison === 3 && forets.length > 0;
  if (FEUILLES.visible) {
    const R = Math.max(6, cam.d * 0.7);
    feuilles.forEach((f, i) => {
      f.age += dt;
      if (f.age > 4) {
        f.age = 0; f.ph = Math.random() * 6; f.y = -9;
        for (let essai = 0; essai < 6; essai++) { const k = forets[Math.random() * forets.length | 0], p = posCase(k); if (Math.abs(p.x - cam.x) < R && Math.abs(p.z - cam.z) < R) { f.x = p.x + (Math.random() - 0.5) * 0.9; f.z = p.z + (Math.random() - 0.5) * 0.9; f.y = P.dessus(k); break; } }
      }
      const u = f.age / 4, x = f.x + Math.sin(f.age * 2 + f.ph) * 0.06 + climat.vent * u * 0.4, z = f.z + Math.cos(f.age * 1.7 + f.ph) * 0.05;
      _q.setFromEuler(_e.set(f.age * 3 + f.ph, f.age * 2, f.age * 2.5, 'XYZ')); _m.compose(_p.set(x, f.y + 0.4 * (1 - u), z), _q, _s.set(1, 1, 1)); FEUILLES.setMatrixAt(i, _m); FEUILLES.setColorAt(i, COUL_FEUILLES[f.col]);
    });
    FEUILLES.count = feuilles.length; FEUILLES.instanceMatrix.needsUpdate = true; FEUILLES.instanceColor.needsUpdate = true;
  }
  // lucioles les soirs d'été
  LUCIOLES.visible = climat.saison === 2 && climat.heure !== 'jour' && !PLUIE() && lucioles.length > 0;
  if (LUCIOLES.visible) {
    const p = LUCIOLES.geometry.attributes.position;
    lucioles.forEach((l, i) => p.setXYZ(i, l.x + Math.sin(t * 0.7 + l.ph) * 0.08, l.y + Math.sin(t * 1.3 + l.ph * 2) * 0.03, l.z + Math.cos(t * 0.6 + l.ph) * 0.08));
    p.needsUpdate = true; LUCIOLES.geometry.setDrawRange(0, lucioles.length); LUCIOLES.material.opacity = 0.55 + 0.45 * Math.sin(t * 3);
  }
  // lueurs : lanternes de la ville industrielle, feux des bivouacs
  const lp = LUEURS.geometry.attributes.position, lc = LUEURS.geometry.attributes.color; let n = 0;
  if (climat.heure !== 'jour') for (const p of lampes) { if (n >= lp.count) break; if (PROCHES.has(p[3])) continue; lp.setXYZ(n, p[0], p[1], p[2]); lc.setXYZ(n++, 1, 0.85, 0.5); }
  for (let i = 0; i < feux.length && n < lp.count; i += 3) { const f = 0.8 + Math.sin(t * 13 + i) * 0.2; lp.setXYZ(n, feux[i], feux[i + 1], feux[i + 2]); lc.setXYZ(n++, f, 0.55 * f, 0.2 * f); }
  LUEURS.geometry.setDrawRange(0, n); lp.needsUpdate = lc.needsUpdate = true;
  // fenêtres : allumées au crépuscule, pleinement la nuit
  const op = Math.min(1, climat.aube * 0.55 + climat.nuit);
  FENETRES.visible = op > 0.03; FENETRES.material.opacity = op;
}

/** Le rythme du foyer (maquette « vie des quartiers ») : toutes les cheminées au matin, la moitié le jour, plus le soir, peu la nuit ;
 *  épaisses l'hiver, rares l'été, presque aucune en canicule. */
export function partFoyers() {
  const ph = climat.phase || 'jour', hiver = climat.saison === 0 || climat.genre === 'neige';
  let part = ph === 'aube' ? 1 : ph === 'crepuscule' ? 0.75 : ph === 'nuit' ? 0.3 : 0.45;
  if (hiver) part = Math.max(part, ph === 'nuit' ? 0.7 : 1); else if (climat.saison === 3) part += 0.15; else if (climat.saison === 2) part *= 0.5;
  if (climat.genre === 'canicule') part = 0.06;
  const gel = Math.min(1, climat.gel || 0);  // plus il gèle, plus on chauffe : fumées serrées et épaisses
  return { part, pas: hiver ? 0.42 - gel * 0.12 : 0.85, k: hiver ? 1.35 + gel * 0.3 : 0.9 };
}

chaqueImage((dt, t) => {
  horlogeT = t;
  const parts = MONDE.parts;
  if (parts) {
    const { part, pas, k } = partFoyers();
    for (const c of parts.cheminees || []) {
      if (c.rang === undefined) c.rang = Math.random();
      if (c.rang >= part) continue;
      c.prochain -= dt; if (c.prochain <= 0) { c.prochain = pas * (0.8 + Math.random() * 0.5); bouffee(c.pos.x, c.pos.y, c.pos.z, c.noire ? 'noire' : 'blanche', k); }
    }
    for (const f of parts.fumees || []) { f.prochain -= dt; if (f.prochain <= 0) { f.prochain = 0.55 + Math.random() * 0.5; bouffee(f.pos.x, f.pos.y, f.pos.z, f.noire ? 'noire' : 'blanche'); } }
  }
  for (const a of ACT) {
    if (a.quand) { a.o.visible = a.quand(); if (!a.o.visible) continue; }
    if (a.f) a.f(t, dt, a.o);
  }
  majArmees(t, dt);
  majParticules(t, dt);
  dessinerActeurs();
  majFumees(dt);
});
