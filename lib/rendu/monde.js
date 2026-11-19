// Ce qui vit sur le plateau et suit l'état de la partie : bâtiments (et chantiers), armées, bannières ;
// et, par remparts.js, sieges.js et forts.js : remparts des villes, sièges, forts d'armée et retranchements.
// Joue aussi le mois sous les yeux du joueur : marches des armées, batailles, assauts et redditions.
import { THREE, scene, posCase, voisins, chaqueImage, lerp, hache } from './scene.js';
import { maillageBatiment, maillageChantier, maillageArmee, maillageGarde, palierDe } from './modeles.js';
import { dessus, solEn, hauteurEn, carte, degager } from './plateau.js';
import { toon, lot, put, fige } from './toon.js';
import { etiquette, balayer, banniere, effet, deplacer, masquer } from './etiquettes.js';
import { bouffee, climat } from './vie.js';
import { trace, humidite } from './boue.js';
import { toitsDe } from './ambiance.js';
import { majRemparts } from './remparts.js';
import { preparerSieges, majSieges, jouerSieges, campArmee, casesOuvrages } from './sieges.js';
import { majForts } from './forts.js';

const groupe = new THREE.Group();
scene.add(groupe);
const batis = new Map();     // id → { cle, mesh, chantier, parts }
let casesBaties = new Set(); // cases portant un bâtiment : l'armée s'y range au bord
const armees = new Map();    // id → { mesh (THREE.Group), x, z, anim, cle, proprio, marche }
export const parts = { ailes: [], drapeaux: [], cheminees: [], fumees: [] };
let R = null;                // règles
let couleurs = {};
let paliers = {};            // id du royaume → palier de son armée (0 à 5)
let selArmee = null;
let arretes = new Set();     // bâtiments à l'arrêt : faubourgs d'une ville assiégée, pillés ou sabotés (plus de fumée ni de vie)
let casesForts = new Set();  // cases portant un fort : l'armée qui le garde se tient sur le glacis, devant la porte
let garnisons = new Map();   // case de la mairie d'une ville fortifiée → { x, z, ry, s } : où se tient l'armée qui la garde
const braises = [];          // ruines encore chaudes : { batiment, x, y, z }

export function initMonde(regles) { R = regles; }
export const couleurDe = id => couleurs[id] || '#888';
/** Le palier de l'armée d'un royaume (0 à 5). */
export const palierRoyaume = id => paliers[id] || 0;
/** Un bâtiment de l'état est-il à l'arrêt (faubourg assiégé, pillé, saboté) ? */
export const estArrete = b => arretes.has(b.id);
/** Le bâtiment posé (id de l'état) : { mesh (son groupe, matrice monde à jour), rel (relevés : fenêtres, portes, toits, lanternes…) } ou undefined. */
export const batiPose = id => batis.get(id);
toitsDe(() => batis);  // le givre des toits (ambiance.js) suit les bâtiments posés
/** Pour une vitrine hors partie : anime un bâtiment déjà posé dans la scène (ailes du moulin, drapeaux, cheminées, fumées) ; id libre, unique. */
export function animerPose(id, mesh, anim, couleur) { mesh.updateMatrixWorld(true); creerParts({ id }, mesh, anim, couleur, false); }
/** Retire ce que animerPose a posé. */
export function oublierPose(id) {
  for (const a of parts.ailes) if (a.batiment === id) groupe.remove(a.pivot);
  for (const d of parts.drapeaux) if (d.batiment === id) { groupe.remove(d.obj); d.obj.geometry.dispose(); }
  viderParts(id);
}

function viderParts(p) {
  for (const k of ['ailes', 'drapeaux', 'cheminees', 'fumees']) parts[k] = parts[k].filter(x => x.batiment !== p);
  for (let i = braises.length - 1; i >= 0; i--) if (braises[i].batiment === p) braises.splice(i, 1);
}

// les ailes du moulin (unités du plateau, comme la maquette) : quatre bras de bois et leurs toiles
const lotAiles = (() => {
  const La = lot();
  for (let j = 0; j < 4; j++) { put(La, new THREE.BoxGeometry(0.05, 0.44, 0.014).translate(0, 0.22, 0).rotateZ(j * Math.PI / 2), 0x8b5a2b, 0, 0, 0, 0, 0.008); put(La, new THREE.BoxGeometry(0.16, 0.012, 0.006).translate(0, 0.3, 0.01).rotateZ(j * Math.PI / 2), 0xe9dcc0, 0, 0, 0, 0, 0); }
  return La;
})();
const geoAiles = fige(lotAiles).children.map(m => [m.geometry, m.material]);
const geoDrapeau = new THREE.PlaneGeometry(0.22, 0.13, 6, 1).translate(0.11, 0, 0);

function creerParts(b, mesh, anim, couleur, arret) {
  for (const a of anim) {
    if (arret && (a.type === 'cheminee' || a.type === 'fumee')) continue; // à l'arrêt : plus une fumée
    const p = new THREE.Vector3(...a.pos).applyMatrix4(mesh.matrixWorld);
    if (a.type === 'ailes') {
      const grp = new THREE.Group();
      for (const [g, m] of geoAiles) grp.add(new THREE.Mesh(g, m));
      grp.position.copy(p);
      grp.rotation.order = 'YXZ';
      grp.rotation.y = mesh.rotation.y;
      grp.children[0].castShadow = true;
      const pivot = new THREE.Group(); pivot.add(grp); groupe.add(pivot);
      grp.rotation.z = arret ? 0.4 : 0;
      parts.ailes.push({ batiment: b.id, obj: grp, pivot, arret }); // à l'arrêt : les ailes du moulin ne tournent plus
    } else if (a.type === 'drapeau') {
      const m = new THREE.Mesh(geoDrapeau.clone(), toon(new THREE.Color(a.couleur || couleur), { side: THREE.DoubleSide }));
      m.position.copy(p);
      groupe.add(m);
      parts.drapeaux.push({ batiment: b.id, obj: m, phase: hache(b.id) * 6 });
    } else if (a.type === 'cheminee') parts.cheminees.push({ batiment: b.id, pos: p, prochain: hache(b.id) * 3 });
    else if (a.type === 'fumee') parts.fumees.push({ batiment: b.id, pos: p, noire: !!a.noire, prochain: hache(b.id, 2) * 2 });
  }
}

/** Met les bâtiments, les armées et les bannières d'accord avec l'état. */
export function synchroniser(etat) {
  casesBaties = new Set(etat.batiments.map(b => b.case));
  couleurs = {};
  for (const r of etat.royaumes) couleurs[r.id] = r.couleur;
  couleurs[99] = '#4b4b4b';
  // palier de l'armée : la technologie militaire la plus avancée du royaume (brigands : 0)
  paliers = {};
  for (const r of etat.royaumes) paliers[r.id] = palierDe(r.joueur ? etat.joueur?.techs : r.techs_liste);
  paliers[99] = 0;
  const villes = new Map(etat.villes.map(v => [v.id, v]));
  // les faubourgs des villes assiégées et les bâtiments pillés ou sabotés (arret) sont à l'arrêt ; ces derniers en ruine noircie
  arretes = new Set(etat.batiments.filter(b => b.arret != null).map(b => b.id));
  for (const s of etat.sieges || []) for (const f of s.faubourgs || []) arretes.add(f.id);
  casesForts = new Set((etat.forts || []).map(f => f.case));
  // remparts (après plateau.majEtat : les hauteurs des cases comptent), côté de chaque siège
  preparerSieges(etat);
  majRemparts(etat, R);
  const vus = new Set();
  for (const b of etat.batiments) {
    vus.add(b.id);
    const def = R.batiments.find(x => x.cle === b.cle);
    const niveau = b.cle === 'hotel' ? (villes.get(b.ville)?.niveau || 1) : 0;
    const arret = arretes.has(b.id), ruine = b.arret != null && b.reste === 0;
    const cle = `${b.cle}|${couleurs[b.proprio]}|${etat.epoque.cle}|${etat.saison}|${etat.meteo.neige_sol > 0.3 ? 1 : 0}|${niveau}|${b.reste > 0 ? b.reste : 0}|${b.proprio}|${arret ? 1 : 0}${ruine ? 1 : 0}`;
    const ex = batis.get(b.id);
    if (ex && ex.cle === cle) continue;
    if (ex) { groupe.remove(ex.mesh); if (ex.chantier) groupe.remove(ex.chantier); viderParts(b.id); }
    const { mesh, anim, boites, rel } = maillageBatiment({ cle: b.cle, couleur: couleurs[b.proprio], epoque: etat.epoque.cle, saison: etat.saison, neige: etat.meteo.neige_sol, niveau, ruine });
    const { x, z } = posCase(b.case), y = dessus(b.case);
    mesh.position.set(x, y, z);
    mesh.rotation.y = b.face || 0;
    let chantier = null;
    if (b.reste > 0) {
      const duree = Math.max(1, def?.duree || 1), fait = 1 - b.reste / duree;
      mesh.scale.y *= Math.max(0.12, fait * 0.85);
      chantier = maillageChantier();
      chantier.position.set(x, y, z);
      chantier.rotation.y = b.face || 0;
      groupe.add(chantier);
    }
    groupe.add(mesh);
    mesh.updateMatrixWorld();
    if (b.reste === 0) creerParts(b, mesh, anim, couleurs[b.proprio], arret);
    if (ruine) braises.push({ batiment: b.id, x, y: y + 0.12, z });
    batis.set(b.id, { cle, mesh, chantier, boites, rel });
  }
  for (const [id, ex] of batis) {
    if (vus.has(id)) continue;
    groupe.remove(ex.mesh); if (ex.chantier) groupe.remove(ex.chantier);
    viderParts(id);
    batis.delete(id);
  }
  // bannières des villes
  for (const v of etat.villes) {
    const { x, z } = posCase(v.case);
    etiquette('v' + v.id, banniere(v, couleurs[v.proprio]), x, dessus(v.case) + 1.05, z);
  }
  balayer('v');
  // sièges (après les remparts : la brèche en est un morceau ; avant les armées : l'assiégeant se range au camp)
  majSieges(etat);
  // armées (la garnison d'une ville fortifiée dans son enceinte) ; les cases des ouvrages et des garnisons perdent leur décor
  placerGarnisons(etat);
  degager(new Set([...casesOuvrages(), ...[...garnisons.values()].filter(g => g.degage).map(g => g.case)]));
  const ids = new Set();
  for (const a of etat.armees) {
    ids.add(a.id);
    majArmee(a, false);
  }
  for (const [id, a] of armees) if (!ids.has(id) && !a.anim) { groupe.remove(a.mesh); armees.delete(id); }
  balayerArmees(ids);
  // forts et retranchements (après les armées : la tranchée se creuse devant l'armée là où elle se tient)
  majForts(etat, R);
}

function balayerArmees(ids) {
  for (const [id, a] of armees) if (!ids.has(id) && !a.anim) { groupe.remove(a.mesh); armees.delete(id); }
  balayer('a');
}

function majArmee(a, fantome) {
  // sur une case bâtie, l'armée se range au bord de la case, un peu plus petite, pour ne pas recouvrir le bâtiment ;
  // devant un fort, sur son glacis ; une armée qui assiège se tient à son camp, au bout des tranchées, face à la place
  // dans une ville fortifiée, la garnison se tient dans l'enceinte, là où les bâtiments et les murs lui laissent la place (placerGarnisons) ;
  // une armée qui part en marche (fantome) reprend l'icône entière
  const camp = a.assiege ? campArmee(a.case) : null, garde = !fantome && !camp && garnisons.get(a.case), fort = !camp && !garde && casesForts.has(a.case), bati = !camp && !garde && !fort && casesBaties.has(a.case);
  const cle = `${couleurs[a.proprio]}|${paliers[a.proprio] || 0}|${garde?.compacte ? 1 : 0}`;
  let v = armees.get(a.id);
  const { x, z } = posCase(a.case);
  if (!v || v.cle !== cle) {
    if (v) groupe.remove(v.mesh);
    const mesh = (garde?.compacte ? maillageGarde : maillageArmee)(couleurs[a.proprio], paliers[a.proprio] || 0);
    const old = v;
    mesh.rotation.y = old ? old.mesh.rotation.y : 0.5;
    v = { mesh, x: old ? old.x : x, z: old ? old.z : z, cle, anim: old?.anim || null, proprio: a.proprio };
    groupe.add(mesh);
    armees.set(a.id, v);
  }
  const pose = camp || garde;
  if (!v.anim) {
    v.x = pose ? pose.x : x; v.z = pose ? pose.z : z + (bati ? 0.52 : fort ? 0.58 : 0);
    if (pose) v.mesh.rotation.y = pose.ry; else if (fort) v.mesh.rotation.y = 0;
  }
  v.mesh.scale.setScalar(v.anim ? 0.1 : camp ? 0.085 : garde ? garde.s : fort ? 0.075 : bati ? 0.075 : 0.1);
  v.n = a.effectif ?? Object.values(a.unites || {}).reduce((s, n) => s + n, 0);
  v.marche = (a.chemin || []).length > 0;
  v.fantome = fantome;
  etiquetteArmee(a.id, v);
  return v;
}
// ------------------------------------------------------------------ la garnison d'une ville fortifiée
// L'armée qui garde une ville fortifiée (assiégée ou non) se tient dans l'enceinte : sur une case intra-muros sans bâtiment, sinon
// sur la place la plus large que laissent les pièces du bâtiment (leurs emprises au sol, modeles.js) en deçà des murs, réduite pour
// y tenir. Quand l'armée entière n'y tiendrait que trop petite (enceinte de la seule mairie), c'est la garde qu'on y montre : la ligne
// et le drapeau, à la taille des autres armées. Si même la garde n'y tient pas et que la ville n'est pas assiégée, l'armée se range
// devant les murs, sur une case libre.
// MURS : rayon inscrit (unités de web_power, depuis le centre de la case) où commencent les murs ; S_PLEINE : en deçà, la garde plutôt que l'armée entière
const MURS = 6.5, S_GARDE = 0.075, S_PLEINE = 0.065, S_MIN = 0.04, VIDE = [];
const rIn = (x, z) => Math.max(Math.abs(x), Math.abs(0.5 * x + 0.866 * z), Math.abs(0.5 * x - 0.866 * z)); // rayon inscrit de l'hexagone (sommet vers +z) qui passe par (x, z)
/** Le rectangle (centre x, z ; demi-côtés hx, hz ; tourné de φ : c = cos φ, sn = sin φ) touche-t-il la boîte b = [x0, x1, z0, z1] ? (axes séparateurs) */
function touche(x, z, hx, hz, c, sn, b) {
  const ex = (b[1] - b[0]) / 2, ez = (b[3] - b[2]) / 2, dx = (b[0] + b[1]) / 2 - x, dz = (b[2] + b[3]) / 2 - z, ac = Math.abs(c), as = Math.abs(sn);
  return Math.abs(dx) <= ex + hx * ac + hz * as && Math.abs(dz) <= ez + hx * as + hz * ac && Math.abs(dx * c - dz * sn) <= hx + ex * ac + ez * as && Math.abs(dx * sn + dz * c) <= hz + ex * as + ez * ac;
}
const XS = Array.from({ length: 25 }, (_, i) => (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5); // 0, 0,5, −0,5, 1, −1…
const places = new WeakMap(); // emprises d'un bâtiment → (emprise de l'armée → place)
/** La plus large place où l'armée (boîte bA, unités du modèle) tient sur la case d'un bâtiment : { x, z (centre de l'emprise, repère local, unités de web_power), phi, s (échelle) } ou null. */
function placeLibre(boites, bA) {
  const cle = [bA.min.x, bA.max.x, bA.min.z, bA.max.z].join();
  let m = places.get(boites); if (!m) places.set(boites, m = new Map());
  if (m.has(cle)) return m.get(cle);
  const hx0 = (bA.max.x - bA.min.x) * 5, hz0 = (bA.max.z - bA.min.z) * 5; // demi-emprise à l'échelle 1, en unités de web_power (× 10)
  const tient = (x, z, c, sn, s) => {
    const hx = hx0 * s, hz = hz0 * s;
    for (const u of [-1, 1]) for (const w of [-1, 1]) if (rIn(x + u * hx * c + w * hz * sn, z - u * hx * sn + w * hz * c) > MURS) return false;
    return !boites.some(b => touche(x, z, hx, hz, c, sn, b));
  };
  let best = null;
  // du sud vers le nord (la caméra regarde vers le nord : l'armée devant les bâtiments plutôt que derrière), du milieu vers les côtés
  for (let z = 6; z >= -6 && !(best?.s >= S_GARDE); z -= 0.5) for (const x of XS) {
    if (rIn(x, z) > MURS - 1) continue;
    for (let a = 0; a < 12; a++) { // face au sud d'abord (vers la caméra) ; une autre pose ne l'emporte que si l'armée y tient plus grande
      const phi = a * Math.PI / 6, c = Math.cos(phi), sn = Math.sin(phi);
      // plus au nord (derrière les bâtiments, vu de la caméra), il faut y tenir nettement plus grand, tant que la place trouvée est assez large
      let lo = best ? best.s * (1.02 + (best.s >= S_PLEINE ? 0.03 * (best.z - z) : 0)) : 0.01, hi = S_GARDE; if (lo >= hi || !tient(x, z, c, sn, lo)) continue;
      if (tient(x, z, c, sn, hi)) lo = hi; else for (let i = 0; i < 6; i++) { const mi = (lo + hi) / 2; if (tient(x, z, c, sn, mi)) lo = mi; else hi = mi; }
      best = { x, z, phi, s: lo };
    }
  }
  m.set(cle, best);
  return best;
}
function placerGarnisons(etat) {
  garnisons = new Map();
  const C = carte(); if (!C) return;
  for (const v of etat.villes) {
    if (!v.fortif) continue;
    const a = etat.armees.find(x => x.case === v.case && !x.assiege); if (!a) continue;
    const emprise = m => { const g = m(couleurs[a.proprio], paliers[a.proprio] || 0).children[0].geometry; if (!g.boundingBox) g.computeBoundingBox(); return g.boundingBox; };
    const camp = v.assiegee ? campArmee(v.case) : null, intra = v.enceinte?.length ? v.enceinte : [v.case];
    const chercher = bA => {
      let best = null;
      for (const c of intra) {
        const b = etat.batiments.find(x => x.case === c), ex = b && batis.get(b.id);
        if (b && (!ex || b.reste > 0)) continue; // un chantier : pas de place
        const pl = placeLibre(ex ? ex.boites : VIDE, bA); if (!pl) continue;
        const k = posCase(c), th = ex ? ex.mesh.rotation.y : 0, ct = Math.cos(th), st = Math.sin(th);
        const cx = k.x + (pl.x * ct + pl.z * st) * 0.1, cz = k.z + (-pl.x * st + pl.z * ct) * 0.1;
        const score = pl.s + (camp ? Math.hypot(cx - camp.x, cz - camp.z) * 0.002 : 0); // assiégée : plutôt loin du camp
        if (!best || score > best.score) best = { score, cx, cz, ry: th + pl.phi, s: pl.s, case: c, degage: !b, bA };
      }
      return best;
    };
    let best = chercher(emprise(maillageArmee));
    if (!(best?.s >= S_PLEINE)) { const g = chercher(emprise(maillageGarde)); if (g && !(g.s <= best?.s)) best = { ...g, compacte: true }; } // l'enceinte d'une seule case : la garde, à sa taille
    if ((!best || best.s < S_MIN) && !v.assiegee) { // devant les murs, sur une case voisine libre (la plus au sud : face à la caméra)
      const dans = new Set(intra), ouv = casesOuvrages(), k0 = posCase(v.case);
      const c = intra.flatMap(i => voisins(i)).filter(i => !dans.has(i) && C.terrain[i] >= 3 && C.terrain[i] !== 6 && !casesBaties.has(i) && !casesForts.has(i) && !ouv.has(i)).sort((p, q) => posCase(q).z - posCase(p).z)[0];
      if (c !== undefined) { const k = posCase(c); best = { cx: k.x, cz: k.z, ry: Math.atan2(k0.x - k.x, k0.z - k.z), s: S_GARDE, case: c, degage: true, bA: emprise(maillageArmee) }; }
    }
    if (!best) continue;
    // l'origine du modèle : le centre de son emprise ramené sur la place choisie
    const bA = best.bA, bx = (bA.min.x + bA.max.x) / 2 * best.s, bz = (bA.min.z + bA.max.z) / 2 * best.s, c = Math.cos(best.ry), sn = Math.sin(best.ry);
    garnisons.set(v.case, { x: best.cx - (bx * c + bz * sn), z: best.cz - (-bx * sn + bz * c), ry: best.ry, s: best.s, case: best.case, degage: best.degage, compacte: !!best.compacte });
  }
}
function etiquetteArmee(id, v) {
  const html = `<div class="arm ${selArmee === id ? 'sel' : ''} ${v.marche ? 'marche' : ''}" style="--c:${couleurs[v.proprio]}">🛡 ${v.n}</div>`;
  etiquette('a' + id, html, v.x, 0.95, v.z, { dy: -6, loin: 75 });
}
export function selectionnerArmee(id) {
  selArmee = id;
  for (const [aid, v] of armees) etiquetteArmee(aid, v);
}

// ------------------------------------------------------------------ le mois joué sous les yeux du joueur
/** Anime les marches et batailles du rapport ; `apres` : l'état du mois suivant (armées créées en route). */
export function jouerMois(rapport, apres, duree = 2800) {
  const etapes = Math.max(1, ...rapport.mouvements.map(m => m.trajet.length - 1), ...rapport.combats.map(c => c.etape || 1));
  const t0 = performance.now();
  for (const m of rapport.mouvements) {
    if (m.flotte) continue; // les flottes : marine.js (gardées dans le compte des étapes)
    let v = armees.get(m.armee);
    if (!v || v.cle.endsWith('|1')) { // une armée qui n'était pas là, ou la garde d'une petite place qui sort : l'armée entière
      const a = apres.armees.find(x => x.id === m.armee) || { id: m.armee, proprio: m.proprio, case: m.trajet[0], unites: { milice: 6 }, chemin: [] };
      v = majArmee({ ...a, case: m.trajet[0] }, true);
    }
    v.anim = { trajet: m.trajet, t0, duree: duree * (m.trajet.length - 1) / etapes };
    v.marche = true;
  }
  const combats = rapport.combats.map(c => ({ ...c, t: t0 + duree * (c.etape || 1) / etapes - 150, fait: false }));
  jouerSieges(rapport); // assauts et redditions, sur les ouvrages du siège encore debout
  return new Promise(res => {
    const fin = () => {
      for (const [, v] of armees) v.anim = null;
      res();
    };
    setTimeout(fin, (rapport.mouvements.length || combats.length ? duree : 0) + 400);
    attente = combats;
  });
}
let attente = [];

chaqueImage((dt, t) => {
  const now = performance.now();
  for (const c of attente) {
    if (c.fait || now < c.t) continue;
    c.fait = true;
    const { x, z } = posCase(c.case), y = dessus(c.case);
    effet(x, y + 0.9, z, '⚔️');
    // poudre mouillée (climat.poudre < 1) : un coup sur deux rate, à peine une fumerolle, et une goutte au-dessus de la mêlée
    const mouillee = climat.poudre < 1;
    for (let k = 0; k < 7; k++) setTimeout(() => bouffee(x + (Math.random() - 0.5) * 0.7, y + 0.15, z + (Math.random() - 0.5) * 0.7, 'poudre', mouillee && k % 2 ? 0.3 : undefined), k * 90);
    if (mouillee) setTimeout(() => effet(x + 0.3, y + 1.1, z, '💧'), 350);
    setTimeout(() => effet(x, y + 1.3, z, c.vainqueur === 0 ? '🏆' : (c.attaquant === 0 || c.defenseur === 0) ? '💀' : '🏳️'), 700);
  }
  for (const [id, v] of armees) {
    if (v.anim) {
      const a = v.anim, k = Math.min(1, (now - a.t0) / Math.max(1, a.duree));
      const f = k * (a.trajet.length - 1), i = Math.min(a.trajet.length - 2, Math.floor(f)), r = f - i;
      const p = posCase(a.trajet[i]), q = posCase(a.trajet[Math.min(i + 1, a.trajet.length - 1)]);
      v.x = lerp(p.x, q.x, r); v.z = lerp(p.z, q.z, r);
      v.mesh.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x) + Math.PI / 2;
      v.pas = (v.pas || 0) + dt * 14;
      // sous la pluie, l'armée laisse des traces de boue derrière elle (deux files : la troupe et les canons)
      if ((climat.pluie && !climat.neige) || humidite.v > 0.25) {
        const d = Math.hypot(v.x - (v.tx ?? v.x), v.z - (v.tz ?? v.z));
        if (v.tx === undefined || d > 0.07) {
          const ry = v.mesh.rotation.y, c = Math.cos(ry), sn = Math.sin(ry), cote = (v.nt = (v.nt || 0) + 1) % 2 ? 0.12 : -0.12;
          if (hauteurEn(v.x, v.z) > -0.1) trace(v.x + c * cote, solEn(v.x, v.z), v.z - sn * cote, ry);
          v.tx = v.x; v.tz = v.z;
        }
      }
    }
    const bob = v.anim ? Math.abs(Math.sin(v.pas || 0)) * 0.04 : 0;
    v.mesh.position.set(v.x, solEn(v.x, v.z) + 0.02 + bob, v.z);
    deplacer('a' + id, v.x, 0.95, v.z);
    // une armée qui débarque attend sur la case d'eau de sa flotte : marine.js montre ses soldats sur le pont et dans les chaloupes
    const eau = hauteurEn(v.x, v.z) < -0.1;
    if (v.mesh.visible === eau) { v.mesh.visible = !eau; masquer('a' + id, eau); }
  }
  for (const a of parts.ailes) if (!a.arret) a.obj.rotation.z += dt * (1.2 + vent.v * 3);
  for (const b of braises) if (Math.random() < dt * 0.7) bouffee(b.x + (Math.random() - 0.5) * 0.3, b.y, b.z + (Math.random() - 0.5) * 0.3, 'noire', 0.55); // braises des ruines
  for (const d of parts.drapeaux) {
    const pos = d.obj.geometry.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k); pos.setZ(k, Math.sin(t * (4 + vent.v * 6) + x * 18 + d.phase) * 0.025 * (x / 0.22) * (0.4 + vent.v)); }
    pos.needsUpdate = true;
    d.obj.rotation.y = vent.dir;
  }
});
export const vent = { v: 0.3, dir: 0 };

/** Où l'armée est dessinée au repos : { x, z, ry, s (échelle) } ou null. */
export function posArmee(id) { const v = armees.get(id); return v ? { x: v.x, z: v.z, ry: v.mesh.rotation.y, s: v.mesh.scale.x } : null; }

/** Les armées posées sur le plateau, pour la vie (exercice, marche au tambour, bivouac) : groupe = leur THREE.Group dans la scène. */
export function listeArmees() {
  return [...armees].map(([id, v]) => ({ id, proprio: v.proprio, groupe: v.mesh, enMarche: !!(v.marche || v.anim) }));
}
