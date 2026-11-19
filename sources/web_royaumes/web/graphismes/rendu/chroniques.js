// Ce qui arrive au royaume se voit (web_royaumes) : incendies, épidémies (croix, fumigations, charrette des morts), famine,
// fête après une victoire, bateaux de commerce, charrettes sur les routes commerciales entre la capitale du joueur et celles de ses alliés,
// traces des batailles (traces.js), couronnements (confettis, cloches), révolte (foules aux torches), mariage royal (cortège fleuri
// entre deux capitales) et habitants qui fuient une ville assiégée vers les campagnes.
// Le jeu appelle majChroniques(etat, rapport) après appliquer() (et après appliquerMeteo). Tout vient de l'état du serveur :
// les événements du rapport (« 🔥 … » avec leur case, « 🤒 Épidémie »), la famine du joueur (etat.joueur.famine),
// les combats (rapport.combats), les rivières de la carte (C.rivieres), les successions (« 👑 … » / « 🗡️ Coup d'État », case de la capitale),
// le bonheur du joueur (révolte sous SEUIL_REVOLTE), les nouvelles alliances (mariage royal) et les villes assiégées (villes[].assiegee).
import { THREE, scene, chaqueImage, hache, posCase, voisins, qualite } from './scene.js';
import { carte, hauteur, dessus, solEn, pointsRiviere, secher, TERRE } from './plateau.js';
import { sillage } from './eau.js';
import { put, boite, cyl, cone, sphere } from './toon.js';
import { bouffee, climat } from './vie.js';
import { batiPose } from './monde.js';
import { modele, animer } from './modernes.js';
import { traceBataille, majTraces } from './traces.js';
import { lueur } from './nuit.js';
import { effet } from './etiquettes.js';
import { campArmee } from './sieges.js';

/** Sous ce bonheur (0 à 100), le peuple du joueur se révolte : foules aux torches dans ses villes. */
export const SEUIL_REVOLTE = 25;

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; scene.add(m); return m; };
const PEAU = 0xf0c9a0;
function villageois(P, habit, x = 0, z = 0) {
  put(P, boite(0.45, 0.8, 0.3), 0x4a4038, x, 0.4, z, 0, 0.03); put(P, boite(0.55, 0.7, 0.35), habit, x, 1.1, z, 0, 0.04);
  put(P, sphere(0.2, 1), PEAU, x, 1.62, z, 0, 0.03); put(P, sphere(0.21, 1).scale(1, 0.5, 1), 0x5a3a22, x, 1.75, z, 0, 0.02);
}

// ------------------------------------------------------------------ incendies : flammes, fumée noire, puis braises
const M_FLAMME = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, depthWrite: false });
const FLAMMES = inst(new THREE.ConeGeometry(1, 2.4, 6).translate(0, 1.2, 0), M_FLAMME, 60), feux = [];
function allumer(c, duree, fort) { const q = posCase(c); feux.push({ x: q.x, z: q.z, y: dessus(c), t: 0, duree, fort }); }

// ------------------------------------------------------------------ épidémie : croix sur les portes, fumigations
const M_CROIX = new THREE.MeshBasicMaterial({ color: 0xc8202a });
const CROIX_A = inst(new THREE.BoxGeometry(0.04, 0.09, 0.006).rotateZ(0.7), M_CROIX, 200), CROIX_B = inst(new THREE.BoxGeometry(0.04, 0.09, 0.006).rotateZ(-0.7), M_CROIX, 200);
let epidemie = [], fumig = 0;

// ------------------------------------------------------------------ famine : files d'attente devant les greniers ; feux d'artifice ; bateaux
let files = [], bateaux = [], fete = null, sigRiv = '', charrettes = [], sigAlli = '';
// navettes de l'épidémie et du mariage (même pas que les charrettes), fuyards, émeutes, couronnements ; confettis et pétales
let cortege = [], fuites = [], sigFuite = '', emeutes = [], sigEmeute = '', couronnements = [], alliesVus = null;
const M_CONF = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const CONF = inst(new THREE.PlaneGeometry(1, 0.6), M_CONF, 500), conf = [];
function pleuvoir(x, y, z, r, couleurs, n) {
  for (let k = 0; k < n && conf.length < 500; k++) conf.push({ x: x + (Math.random() - 0.5) * r, y: y + Math.random() * 0.2, z: z + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 0.06, vz: (Math.random() - 0.5) * 0.06, vie: 2.5 + Math.random(), ph: Math.random() * 6, col: couleurs[Math.random() * couleurs.length | 0] });
}
const CONFETTIS = [0xffd34d, 0xff5a5a, 0x6ad1ff, 0xffffff, 0x9dff6a, 0xff8af0], PETALES = [0xff9ec7, 0xffffff, 0xe84a5f, 0xffd0e0];
const M_TORCHE = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95, depthWrite: false });
const TORCHES = inst(new THREE.ConeGeometry(1, 2.2, 5).translate(0, 1.1, 0), M_TORCHE, 120);
const M_ONDE = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
const ONDES = inst(new THREE.RingGeometry(0.9, 1, 24).rotateX(-Math.PI / 2), M_ONDE, 40);
// un chemin terrestre en points (x, y, z) et ses longueurs cumulées, pour les navettes
function trace(ch) {
  const pts = ch.map(i => { const q = posCase(i); return [q.x, dessus(i) + 0.02, q.z]; }), long = [0];
  for (let k = 1; k < pts.length; k++) long.push(long[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]));
  return { pts, long };
}
// la case de terre libre à `dist` pas de c, la plus loin possible de `loin` (le camp de l'assiégeant)
function campagne(C, c, dist, loin) {
  const vu = new Map([[c, 0]]), file = [c]; let best = null, bd = -1;
  while (file.length) {
    const i = file.shift(), d = vu.get(i); if (d === dist) { const q = posCase(i), e = loin ? (q.x - loin.x) ** 2 + (q.z - loin.z) ** 2 : hache(i, c, 5); if (e > bd) { bd = e; best = i; } continue; }
    for (const n of voisins(i)) if (!vu.has(n) && TERRE(C.terrain[n])) { vu.set(n, d + 1); file.push(n); }
  }
  return best;
}
const M_ETINC = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const ETINC = inst(new THREE.SphereGeometry(1, 4, 3), M_ETINC, 400), etinc = [];
const ARTIFICE = [0xff5a5a, 0xffd34d, 0x6ad1ff, 0x9dff6a, 0xff8af0, 0xffffff];
function gerbe(x, y, z) {
  const col = ARTIFICE[Math.random() * ARTIFICE.length | 0], n = Math.round(40 * Math.min(1, qualite.part + 0.3));
  for (let k = 0; k < n && etinc.length < 400; k++) { const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), v = 0.5 + Math.random() * 0.3; etinc.push({ x, y, z, vx: Math.sin(b) * Math.cos(a) * v, vy: Math.cos(b) * v, vz: Math.sin(b) * Math.sin(a) * v, vie: 1.6, col }); }
}
const vider = l => { for (const o of l) { o.parent?.remove(o); } l.length = 0; };

function charrette(L, ex, bache = 0xeee6d2, habit = 0x6a5a3a) {  // charrette bâchée tirée par un cheval, son charretier
  put(L, boite(1.6, 0.5, 0.9), 0x8a6a42, 0, 0.6, 0, 0, 0.05); put(L, sphere(0.6, 1).scale(1.3, 0.7, 0.8), bache, 0, 1.0, 0, 0, 0.04);
  for (const z of [-0.5, 0.5]) put(L, cyl(0.32, 0.32, 0.08, 10).rotateX(Math.PI / 2), 0x5a3a22, -0.2, 0.32, z, 0, 0.03);
  put(L, boite(1.1, 0.55, 0.35), 0x6b4226, 1.5, 0.75, 0, 0, 0.04); put(L, boite(0.35, 0.35, 0.3), 0x6b4226, 2.05, 1.05, 0, 0, 0.03);
  for (const [x, z] of [[1.15, -0.12], [1.15, 0.12], [1.85, -0.12], [1.85, 0.12]]) put(L, boite(0.1, 0.5, 0.1), 0x4a3020, x, 0.25, z, 0, 0.02);
  villageois(L, habit, 0.75, 0);
}
// la charrette des morts de l'épidémie : bâche noire, croque-mort en noir, une cloche à la main
const charretteMorts = (L, ex) => { charrette(L, ex, 0x2a2826, 0x1f1f22); put(L, cone(0.12, 0.2, 6), 0xb08d57, 0.95, 1.5, 0.3, 0, 0.02); };
// le carrosse des mariés : caisse bleu roi à filets d'or, deux chevaux blancs, cocher ; fleurs sur le toit
function carrosse(L, ex) {
  put(L, boite(1.4, 0.9, 0.95), 0x2c4a8a, 0, 1.05, 0, 0, 0.05); put(L, boite(1.5, 0.1, 1.05), 0xd8b24a, 0, 1.55, 0, 0, 0.03); put(L, boite(1.5, 0.08, 1.0), 0xd8b24a, 0, 0.6, 0, 0, 0.02);
  for (const [x, c] of [[-0.4, 0xff9ec7], [0, 0xffffff], [0.4, 0xe84a5f]]) put(L, sphere(0.16, 1), c, x, 1.68, 0, 0, 0.02);
  for (const x of [-0.5, 0.5]) for (const z of [-0.55, 0.55]) put(L, cyl(0.3, 0.3, 0.08, 10).rotateX(Math.PI / 2), 0xd8b24a, x, 0.3, z, 0, 0.03);
  put(L, boite(0.35, 0.3, 0.8), 0x2c4a8a, 0.85, 1.25, 0, 0, 0.03); villageois(L, 0x8a1f2a, 0.85, 0);
  for (const z of [-0.3, 0.3]) { put(L, boite(1.0, 0.5, 0.32), 0xf2efe6, 2.0, 0.75, z, 0, 0.04); put(L, boite(0.3, 0.32, 0.28), 0xf2efe6, 2.55, 1.05, z, 0, 0.03); put(L, boite(0.08, 0.3, 0.3), 0xe84a5f, 2.4, 1.3, z, 0, 0.01);
    for (const x of [1.65, 2.3]) put(L, boite(0.09, 0.5, 0.09), 0xd9d4c8, x, 0.25, z, 0, 0.02); }
}
// des habitants qui fuient : baluchons sur l'épaule, une charrette à bras chargée de meubles
function fuyards(L, ex) {
  for (const [x, z, c] of [[0, 0, 0x6a5a3a], [-0.7, 0.45, 0x7a3a3a], [-1.3, -0.2, 0x4a5a7a]]) { villageois(L, c, x, z); put(L, sphere(0.25, 1), 0xd9c08a, x - 0.2, 1.65, z - 0.15, 0, 0.02); put(L, boite(0.06, 0.06, 0.7).rotateY(0.6), 0x5a3a22, x - 0.05, 1.55, z, 0, 0.01); }
  put(L, boite(1.0, 0.4, 0.7), 0x8a6a42, -2.3, 0.6, 0, 0, 0.04); put(L, cyl(0.3, 0.3, 0.07, 10).rotateX(Math.PI / 2), 0x5a3a22, -2.3, 0.3, 0.4, 0, 0.02);
  put(L, boite(0.4, 0.45, 0.4), 0x6b4a2b, -2.5, 1.0, 0, 0, 0.02); put(L, boite(0.35, 0.3, 0.5), 0xcdbb8e, -2.1, 0.95, 0.05, 0, 0.02);
  villageois(L, 0x5a6a4a, -1.6, 0.3);
}
// des émeutiers, torches levées et fourches (les flammes sont des cônes animés : TORCHES)
const POS_TORCHES = [[0, 0], [0.8, 0.5], [-0.7, 0.6], [0.3, -0.8], [-0.5, -0.6]];
function emeutiers(L, ex) {
  POS_TORCHES.forEach(([x, z], i) => { villageois(L, [0x6a4a3a, 0x5a5a4a, 0x7a3a2a, 0x4a4a5a, 0x6a6a3a][i], x, z); put(L, boite(0.07, 1.1, 0.07), 0x5a3a22, x + 0.35, 1.7, z, 0, 0.01); });
  put(L, boite(0.06, 1.6, 0.06), 0x5a3a22, -0.2, 1.4, 0.2, 0, 0.01); put(L, boite(0.3, 0.05, 0.05), 0x7a7a7a, -0.2, 2.2, 0.2, 0, 0.01);
}
// le plus court chemin terrestre entre deux cases (en largeur d'abord)
function cheminTerre(C, a, b) {
  const prev = new Map([[a, -1]]), file = [a];
  while (file.length) { const i = file.shift(); if (i === b) break; for (const n of voisins(i)) if (!prev.has(n) && (TERRE(C.terrain[n]) || n === b)) { prev.set(n, i); file.push(n); } }
  if (!prev.has(b)) return null;
  const p = []; for (let i = b; i !== -1; i = prev.get(i)) p.unshift(i); return p;
}

function barque(L, ex) {  // gabare de rivière : coque, mât et voile carrée, batelier à la perche
  put(L, boite(2.6, 0.45, 0.9), 0x6b4a2b, 0, 0.22, 0, 0, 0.05); put(L, boite(2.2, 0.1, 0.7), 0x8a6a42, 0, 0.47, 0, 0, 0.02);
  put(L, boite(0.6, 0.4, 0.5), 0xb08a58, -0.5, 0.7, 0, 0, 0.03); put(L, boite(0.5, 0.35, 0.45), 0xcdbb8e, 0.2, 0.68, 0, 0, 0.03);
  put(L, cyl(0.04, 0.05, 2, 5), 0x5a3a22, 0.5, 1.45, 0, 0, 0.02); put(L, boite(0.04, 1.1, 1.1), 0xeee6d2, 0.55, 1.6, 0, 0, 0.03);
  villageois(L, 0x3f5a7a, -1.05, 0); put(L, boite(0.05, 2.2, 0.05).rotateZ(0.4), 0x5a3a22, -1.3, 0.9, 0.2, 0, 0.01);
}

/** Met les chroniques d'accord avec l'état et le rapport du mois (à appeler après appliquer()). */
export function majChroniques(etat, rapport) {
  const evs = rapport?.evenements || [];
  // incendies du mois : brûlé (« part en fumée ») ou maîtrisé
  for (const e of evs) if (e.case != null && /^🔥|^🏮/.test(e.texte || '')) allumer(e.case, /part en fumée/.test(e.texte) ? 30 : 9, /part en fumée/.test(e.texte));
  // épidémie : les maisons du joueur marquées d'une croix, le temps du mois
  epidemie = evs.some(e => /Épidémie/.test(e.texte || '')) ? etat.batiments.filter(b => b.proprio === 0 && b.reste === 0 && /maison|cabane|immeuble|hotel_particulier/.test(b.cle)).map(b => b.id) : [];
  // épidémie : la charrette des morts va de la capitale du joueur au cimetière, hors les murs, et revient
  const capJ = etat.villes.find(v => v.proprio === 0 && v.capitale), C0 = carte();
  vider(cortege.map(c => c.m.groupe)); cortege = [];
  if (epidemie.length && capJ && C0) {
    const ci = campagne(C0, capJ.case, 2), ch = ci != null && cheminTerre(C0, capJ.case, ci);
    if (ch && ch.length >= 2) { const m = modele(charretteMorts, capJ.case + 3); scene.add(m.groupe); animer(m); cortege.push({ m, ...trace(ch), s: 0, v: 0.12 }); }
  }
  // traces des batailles du mois (elles s'effacent en quelques mois)
  if (etat.tour != null) majTraces(etat.tour);
  for (const c of rapport?.combats || []) if (c.case != null) traceBataille(c.case, etat.tour ?? 0);
  // couronnement : confettis et cloches sur la capitale du nouveau souverain, le temps du mois
  couronnements = evs.filter(e => e.case != null && /^👑|Coup d'État/.test(e.texte || '')).map(e => { const q = posCase(e.case); effet(q.x, dessus(e.case) + 1.2, q.z, '👑', 3000); return { x: q.x, z: q.z, y: dessus(e.case), t: 0, cloche: 0 }; });
  // révolte : sous SEUIL_REVOLTE de bonheur, des foules aux torches tournent dans les villes du joueur
  const revolte = etat.joueur?.bonheur != null && etat.joueur.bonheur < SEUIL_REVOLTE;
  const sigE = revolte ? etat.villes.filter(v => v.proprio === 0).map(v => v.case).join() : '';
  if (sigE !== sigEmeute) {
    sigEmeute = sigE; vider(emeutes.map(e => e.m.groupe)); emeutes = [];
    for (const v of revolte ? etat.villes.filter(v => v.proprio === 0) : []) {
      const m = modele(emeutiers, v.case); scene.add(m.groupe); animer(m);
      emeutes.push({ m, ...posCase(v.case), y: dessus(v.case), a: hache(v.case, 9, 3) * 6, r: 0.22 + (v.niveau || 1) * 0.03 });
    }
  }
  // mariage royal : une alliance nouvelle (pas celles du chargement), le cortège fleuri va d'une capitale à l'autre
  const alliances = (etat.royaumes || []).filter(r => r.statut === 'alliance').map(r => r.id);
  const nouveaux = alliesVus ? alliances.filter(id => !alliesVus.has(id)) : [];
  alliesVus = new Set(alliances);
  for (const id of nouveaux.slice(0, 1)) {
    const cv = etat.villes.find(v => v.proprio === id && v.capitale), ch = cv && capJ && C0 && cheminTerre(C0, capJ.case, cv.case);
    if (!ch || ch.length < 2) continue;
    const m = modele(carrosse, cv.case); scene.add(m.groupe); animer(m); cortege.push({ m, ...trace(ch), s: 0, v: 0.2, noce: true });
    for (const c of [capJ.case, cv.case]) { const q = posCase(c); effet(q.x, dessus(c) + 1.2, q.z, '💍', 3500); pleuvoir(q.x, dessus(c) + 0.9, q.z, 0.6, PETALES, 60); }
  }
  // siège : les habitants fuient la ville assiégée vers les campagnes, à l'opposé du camp de l'assiégeant
  const assiegees = etat.villes.filter(v => v.assiegee), sigF = assiegees.map(v => v.case).join();
  if (C0 && sigF !== sigFuite) {
    sigFuite = sigF; vider(fuites.map(f => f.m.groupe)); fuites = [];
    for (const v of assiegees) {
      const ci = campagne(C0, v.case, 3, campArmee(v.case)), ch = ci != null && cheminTerre(C0, v.case, ci);
      if (!ch || ch.length < 2) continue;
      for (let k = 0; k < 3; k++) { const m = modele(fuyards, v.case * 3 + k); scene.add(m.groupe); animer(m); fuites.push({ m, ...trace(ch), s: k / 3, v: 0.06 }); }
    }
  }
  // famine : champs vides (terre nue) et une file devant chaque grenier du joueur
  vider(files);
  climat.famine = !!etat.joueur?.famine;
  if (climat.famine) {
    secher(3);
    for (const b of etat.batiments) {
      if (b.proprio !== 0 || b.reste || !/grenier|marche/.test(b.cle)) continue;
      const B = batiPose(b.id); if (!B?.mesh) continue;
      const m = modele((L, ex) => { for (let k = 0; k < 5; k++) villageois(L, [0x7a5a3a, 0x5a6a4a, 0x8a4a3a, 0x4a5a7a, 0x6a6a5a][k], -1.6 + k * 0.75, 5.2 + (k % 2) * 0.2); }, b.id);
      m.groupe.position.copy(B.mesh.position); m.groupe.rotation.y = B.mesh.rotation.y; scene.add(m.groupe); animer(m); files.push(m.groupe);
    }
  }
  // victoire au combat : feux d'artifice sur la capitale, le temps du mois (vie.js y fait aussi la fête)
  const gagne = (rapport?.combats || []).some(c => c.vainqueur === 0 && (c.attaquant === 0 || c.defenseur === 0));
  const cap = etat.villes.find(v => v.proprio === 0 && v.capitale);
  fete = gagne && cap ? { ...posCase(cap.case), y: dessus(cap.case), t: 0 } : null;
  // routes commerciales : une charrette fait la navette entre la capitale du joueur et celle de chaque allié
  const allies = (etat.royaumes || []).filter(r => r.statut === 'alliance').map(r => etat.villes.find(v => v.proprio === r.id && v.capitale)).filter(Boolean);
  const sigA = allies.map(v => v.case).join() + ':' + (cap?.case ?? '');
  if (carte() && sigA !== sigAlli) {
    sigAlli = sigA; vider(charrettes.map(c => c.m.groupe)); charrettes = [];
    for (const v of cap ? allies : []) {
      const ch = cheminTerre(carte(), cap.case, v.case); if (!ch || ch.length < 3) continue;
      const m = modele(charrette, v.case); scene.add(m.groupe); animer(m); charrettes.push({ m, ...trace(ch), s: hache(v.case, 1, 150), v: 0.25 });
    }
  }
  // bateaux de commerce sur les rivières (une ou deux gabares par rivière assez longue)
  const C = carte(), sig = (C?.rivieres || []).map(r => r.length).join();
  if (C && sig !== sigRiv) {
    sigRiv = sig; vider(bateaux.map(b => b.m.groupe)); bateaux = [];
    const R = pointsRiviere();
    (C.rivieres || []).forEach((ch, n) => {
      if (ch.length < 4) return;
      const pts = []; for (const i of ch) for (const [x, z] of R.get(i) || []) pts.push([x, hauteur(i) + 0.02, z]);
      if (pts.length < 6) return;
      const long = [0]; for (let k = 1; k < pts.length; k++) long.push(long[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]));
      for (let k = 0; k < (ch.length > 8 ? 2 : 1); k++) {
        const m = modele(barque, n * 7 + k + 1); m.groupe.scale.multiplyScalar(0.9); m.groupe.userData.bateau = true; scene.add(m.groupe); animer(m);
        bateaux.push({ m, pts, long, s: hache(n, k, 120), v: 0.12 + hache(n, k, 121) * 0.06 });
      }
    });
  }
}

/** Ce qui se joue en ce moment (pour les tests et les vitrines). */
export const chroniquesVues = () => ({ cortege: cortege.map(c => (c.noce ? 'noce' : 'morts')), fuyards: fuites.length, emeutes: emeutes.length, couronnements: couronnements.length });

chaqueImage((dt, t) => {
  // flammes et fumées
  let nf = 0;
  for (let i = feux.length - 1; i >= 0; i--) {
    const f = feux[i]; f.t += dt;
    if (f.t > f.duree + (f.fort ? 20 : 0)) { feux.splice(i, 1); continue; }
    const brule = f.t < f.duree, k = brule ? Math.min(1, f.t / 2) * (f.fort ? 1 : 0.5) : 0;
    if (brule) for (let j = 0; j < (f.fort ? 6 : 3) && nf < 60; j++) {
      const a = j * 2.1, s = (0.035 + 0.025 * Math.sin(t * 13 + j * 3)) * k;
      FLAMMES.setMatrixAt(nf++, _m.compose(_p.set(f.x + Math.cos(a) * 0.15, f.y + 0.02, f.z + Math.sin(a) * 0.15), _q.identity(), _s.set(s, s * (1.2 + 0.4 * Math.sin(t * 17 + j)), s)));
    }
    if (Math.random() < dt * (brule ? 6 : 1.5)) bouffee(f.x + (Math.random() - 0.5) * 0.3, f.y + 0.25, f.z + (Math.random() - 0.5) * 0.3, brule ? 'noire' : 'blanche', brule ? 1.4 : 0.6);
  }
  FLAMMES.count = nf; FLAMMES.instanceMatrix.needsUpdate = true;
  // croix de l'épidémie, et fumigations de temps en temps
  let nc = 0;
  for (const id of epidemie) {
    const B = batiPose(id); if (!B?.mesh || !B.rel?.portes?.length) continue;
    B.mesh.updateMatrixWorld();
    for (const p of B.rel.portes.slice(0, 2)) {
      if (nc >= 200) break;
      const ry = p.ry || 0;  // la croix peinte sur la porte, juste devant la façade
      _l.compose(_p.set(p.x + Math.sin(ry) * 0.06, (p.h || 1) * 0.6, p.z + Math.cos(ry) * 0.06), _q.setFromAxisAngle(_s.set(0, 1, 0), ry), _s.set(10, 10, 10));
      _m.multiplyMatrices(B.mesh.matrixWorld, _l); CROIX_A.setMatrixAt(nc, _m); CROIX_B.setMatrixAt(nc++, _m);
    }
  }
  CROIX_A.count = CROIX_B.count = nc; CROIX_A.instanceMatrix.needsUpdate = CROIX_B.instanceMatrix.needsUpdate = true;
  if (epidemie.length && (fumig -= dt) <= 0) {
    fumig = 1.2; const B = batiPose(epidemie[Math.random() * epidemie.length | 0]);
    if (B?.mesh) bouffee(B.mesh.position.x, B.mesh.position.y + 0.2, B.mesh.position.z, 'blanche', 0.9);
  }
  // feux d'artifice sur la capitale, surtout la nuit
  if (fete) { fete.t += dt; if (Math.random() < dt * (climat.heure === 'nuit' ? 1.2 : 0.25)) gerbe(fete.x + (Math.random() - 0.5) * 0.8, fete.y + 1.6 + Math.random() * 0.8, fete.z + (Math.random() - 0.5) * 0.6); }
  let ne = 0;
  for (let i = etinc.length - 1; i >= 0; i--) {
    const e = etinc[i]; e.vie -= dt; if (e.vie <= 0) { etinc.splice(i, 1); continue; }
    e.vy -= dt * 0.35; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.vx *= 0.98; e.vz *= 0.98;
    ETINC.setMatrixAt(ne, _m.compose(_p.set(e.x, e.y, e.z), _q.identity(), _s.setScalar(0.018 * Math.min(1, e.vie))));
    ETINC.setColorAt(ne++, _c.setHex(e.col));
  }
  ETINC.count = ne; ETINC.instanceMatrix.needsUpdate = true; if (ETINC.instanceColor) ETINC.instanceColor.needsUpdate = true;
  // gabares : elles descendent puis remontent la rivière
  for (const b of bateaux) {
    const tot = b.long.at(-1); b.s = (b.s + dt * b.v / tot) % 2; const u = b.s < 1 ? b.s : 2 - b.s, d = u * tot;
    let k = 1; while (k < b.long.length - 1 && b.long[k] < d) k++;
    const A = b.pts[k - 1], B = b.pts[k], r = (d - b.long[k - 1]) / ((b.long[k] - b.long[k - 1]) || 1);
    b.m.groupe.position.set(A[0] + (B[0] - A[0]) * r, A[1] + (B[1] - A[1]) * r, A[2] + (B[2] - A[2]) * r);
    b.m.groupe.rotation.y = -Math.atan2(B[2] - A[2], B[0] - A[0]) + (b.s < 1 ? 0 : Math.PI);
    if ((b.sill = (b.sill || 0) - dt) <= 0) { b.sill = 0.3; const g = b.m.groupe.position; sillage(g.x, g.y, g.z, 0.035); }
  }
  // charrettes, charrette des morts, cortège : ils vont d'un bout à l'autre et reviennent, en suivant le terrain
  for (const c of charrettes) suivre(c, dt, t, true);
  for (const c of cortege) { suivre(c, dt, t, true); if (c.noce && Math.random() < dt * 6) { const g = c.m.groupe.position; pleuvoir(g.x, g.y + 0.25, g.z, 0.25, PETALES, 3); } }
  // fuyards : aller simple vers la campagne, ils disparaissent au bout et d'autres sortent de la ville
  for (const f of fuites) { suivre(f, dt, t, false); f.m.groupe.visible = f.s > 0.04 && f.s < 0.96; }
  // émeutiers : ils tournent dans la ville, torches levées ; une lueur la nuit, une fumée de temps en temps
  let nt = 0;
  for (const e of emeutes) {
    e.a += dt * 0.12; const x = e.x + Math.cos(e.a) * e.r, z = e.z + Math.sin(e.a) * e.r, g = e.m.groupe;
    g.position.set(x, solEn(x, z) + 0.01 + Math.abs(Math.sin(t * 7)) * 0.003, z); g.rotation.y = -e.a - Math.PI; g.updateMatrixWorld();
    for (const [px, pz] of POS_TORCHES) {
      if (nt >= 120) break;
      _p.set(px + 0.35, 2.25, pz).applyMatrix4(g.matrixWorld); const s = 0.012 * (1 + 0.25 * Math.sin(t * 15 + px * 7));
      TORCHES.setMatrixAt(nt++, _m.compose(_p, _q.identity(), _s.set(s, s * (1.1 + 0.3 * Math.sin(t * 19 + pz * 5)), s)));
    }
    if (climat.heure === 'nuit' || climat.nuit > 0.3) lueur(x, solEn(x, z) + 0.01, z, 0.18);
    if (Math.random() < dt * 0.6) bouffee(x, solEn(x, z) + 0.25, z, 'noire', 0.4);
  }
  TORCHES.count = nt; TORCHES.instanceMatrix.needsUpdate = true;
  // couronnement : confettis au-dessus de la capitale, et les cloches sonnent (ondes dorées, 🔔)
  let no = 0;
  for (const c of couronnements) {
    c.t += dt; if (Math.random() < dt * (c.t < 30 ? 8 : 2)) pleuvoir(c.x, c.y + 1.0, c.z, 0.7, CONFETTIS, 6);
    if ((c.cloche -= dt) <= 0) { c.cloche = 2.4; effet(c.x + (Math.random() - 0.5) * 0.3, c.y + 0.9, c.z, '🔔', 1400); }
    for (let k = 0; k < 3 && no < 40; k++) { const u = (t * 0.6 + k / 3) % 1; ONDES.setMatrixAt(no++, _m.compose(_p.set(c.x, c.y + 0.55 + u * 0.1, c.z), _q.identity(), _s.setScalar(0.1 + u * 0.6))); }
  }
  ONDES.count = no; ONDES.instanceMatrix.needsUpdate = true;
  // confettis et pétales : ils tombent en tournoyant, poussés par le vent
  let nk = 0; const wx = Math.cos(climat.dir || 0) * (climat.vent ?? 0.3) * 0.05, wz = Math.sin(climat.dir || 0) * (climat.vent ?? 0.3) * 0.05;
  for (let i = conf.length - 1; i >= 0; i--) {
    const c = conf[i]; c.vie -= dt; c.y -= dt * 0.12; c.x += (c.vx + wx + Math.sin(t * 3 + c.ph) * 0.02) * dt; c.z += (c.vz + wz) * dt;
    if (c.vie <= 0 || c.y < solEn(c.x, c.z)) { conf.splice(i, 1); continue; }
    CONF.setMatrixAt(nk, _m.compose(_p.set(c.x, c.y, c.z), _q.setFromAxisAngle(_s.set(Math.sin(c.ph), 0.6, Math.cos(c.ph)).normalize(), t * 4 + c.ph), _s.setScalar(0.018)));
    CONF.setColorAt(nk++, _c.setHex(c.col));
  }
  CONF.count = nk; CONF.instanceMatrix.needsUpdate = true; if (CONF.instanceColor) CONF.instanceColor.needsUpdate = true;
});
// avance une navette le long de son chemin (aller-retour, ou aller simple qui recommence)
function suivre(c, dt, t, retour) {
  const tot = c.long.at(-1) || 1; c.s = (c.s + dt * c.v / tot) % (retour ? 2 : 1); const u = c.s < 1 ? c.s : 2 - c.s, d = u * tot;
  let k = 1; while (k < c.long.length - 1 && c.long[k] < d) k++;
  const A = c.pts[k - 1], B = c.pts[k], r = (d - c.long[k - 1]) / ((c.long[k] - c.long[k - 1]) || 1), x = A[0] + (B[0] - A[0]) * r, z = A[2] + (B[2] - A[2]) * r;
  c.m.groupe.position.set(x, solEn(x, z) + 0.01 + Math.abs(Math.sin(t * 6)) * 0.004, z);
  c.m.groupe.rotation.y = -Math.atan2(B[2] - A[2], B[0] - A[0]) + (c.s < 1 ? 0 : Math.PI);
}
