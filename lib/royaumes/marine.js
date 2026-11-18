// La marine (maquettes/guerre.html) : navires aux couleurs du royaume (pavillon, flamme, liston) qui tanguent et laissent
// un sillage d'écume ; flûte, corvette, frégate, vaisseau de ligne, vapeur à roues (frégate et vaisseau à hélice à l'ère
// industrielle), coques selon l'époque ; flottes qui naviguent pendant le mois, bataille navale (bordées, fumée de poudre,
// gerbes, navire qui brûle et coule), embarquement et débarquement en chaloupes, blocus (navires mouillés en arc devant
// le port, voiles serrées, ligne de bouées) et commerce (la flûte fait la navette depuis le quai).
// Chaque variante de navire est assemblée une fois (géométries fusionnées en cache) ; une flotte garde ses maillages
// tant que sa composition, son époque, sa couleur et son allure ne changent pas.
import { THREE, scene, posCase, chaqueImage, hache, voisins } from './scene.js';
import { MAT, CONT, lot, put, fusion, boite, cyl, sphere } from './toon.js';
import { fantassin, tete, PALIERS, palierDe } from './modeles.js';
import { solEn } from './plateau.js';
import { bouffee } from './vie.js';
import { etiquette, deplacer, balayer } from './etiquettes.js';
import { MER, lisse, capX, capVers, versMonde, eau, ecart, cheminLisse, ecume, eclat, gerbe, feu, oublierFeu, drapeau, soldat } from './guerre_commun.js';

const ECH_NAV = 0.085, ECH_GENS = 0.045, PEAU = 0xf0c9a0;
const groupe = new THREE.Group();
scene.add(groupe);

// ------------------------------------------------------------------ les navires : proue vers +x, ligne de flottaison à y = 0 ; une case = 10 unités, réduites par ECH_NAV
const LIVREE = {
  ancien: { coque: 0x8a5a2e, bande: 0xd9a43a, sabord: 0x6a1e14, voile: 0xefe6cc, deco: 0xe0b040, pont: 0xd2a96c },
  lumieres: { coque: 0x5e3d22, bande: 0xe6c66a, sabord: 0x2a1d14, voile: 0xf6f2ea, deco: 0xe6c66a, pont: 0xcfa66c },
  empire: { coque: 0x2a2a2e, bande: 0xe8c45e, sabord: 0x161616, voile: 0xfaf8f2, deco: 0xe8c45e, pont: 0xcaa56e },
  industrie: { coque: 0x26262a, bande: 0xf2efe6, sabord: 0x161616, voile: 0xf0eee6, deco: 0xd9b45a, pont: 0xc4a274 },
};
const TYPES = {
  flute: { L: 5.2, W: 1.8, H: 1.05, arriere: 0.48, mats: [[-1.4, 5.0], [0.3, 5.9], [1.8, 4.7]], voiles: 2, dunette: 1.0, gaillard: 0.3, bandes: [] },
  corvette: { L: 5.0, W: 1.3, H: 0.8, arriere: 0.8, mats: [[-1.0, 5.6], [1.15, 6.0]], voiles: 3, dunette: 0.3, gaillard: 0.22, bandes: [0.42] },
  fregate: { L: 6.2, W: 1.5, H: 1.0, arriere: 0.78, mats: [[-1.8, 5.8], [0.2, 7.0], [2.0, 6.2]], voiles: 3, dunette: 0.4, gaillard: 0.25, bandes: [0.55] },
  vaisseau: { L: 7.4, W: 1.95, H: 1.6, arriere: 0.8, mats: [[-2.3, 6.4], [0.1, 8.0], [2.5, 7.0]], voiles: 3, dunette: 0.7, gaillard: 0.35, bandes: [0.5, 1.12] },
  vapeur: { L: 5.8, W: 1.4, H: 0.85, arriere: 0.75, mats: [[-2.0, 4.0], [2.0, 4.4]], voiles: 0, auriques: true, dunette: 0, gaillard: 0.25, bandes: [], roues: true, cheminee: [0, 3.2] },
};
TYPES.fregateH = { ...TYPES.fregate, voiles: 2, cheminee: [-0.8, 2.8] };
TYPES.vaisseauH = { ...TYPES.vaisseau, voiles: 2, cheminee: [-1.1, 3.1] };
/** Le modèle d'une unité du jeu à une époque : à l'ère industrielle, frégates et vaisseaux passent à l'hélice. */
function modeleDe(unite, epoque) {
  if (unite === 'vapeur_navire') return 'vapeur';
  if (epoque === 'industrie' && (unite === 'fregate' || unite === 'vaisseau')) return unite + 'H';
  return TYPES[unite] ? unite : 'corvette';
}
const RANG = { vaisseau: 0, vapeur_navire: 1, fregate: 2, corvette: 3, flute: 4 };
const TRANSPORT = new Set(['flute', 'vapeur']);

function planCoque(Lg, W, arr) { // vue de dessus : arrière plat, flancs droits, étrave en pointe arrondie
  const a = -Lg / 2, b = Lg / 2, s = new THREE.Shape();
  s.moveTo(a, -W * arr / 2); s.lineTo(a * 0.55, -W / 2); s.lineTo(b * 0.3, -W / 2);
  s.quadraticCurveTo(b * 0.85, -W * 0.44, b, 0); s.quadraticCurveTo(b * 0.85, W * 0.44, b * 0.3, W / 2);
  s.lineTo(a * 0.55, W / 2); s.lineTo(a, W * arr / 2); s.closePath(); return s;
}
function tranche(Lg, W, arr, y0, y1, sx = 1, sz = 1) {
  const g = new THREE.ExtrudeGeometry(planCoque(Lg, W, arr), { depth: y1 - y0, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2); g.scale(sx, 1, sz); g.translate(0, y0, 0); return g;
}
/** Quelques soldats (modèle de l'armée, un peu réduits) ajoutés au lot, debout en (x, y, z) en unités du navire. */
function soldatsSur(L, P, roy, places, k) {
  for (const [x, y, z] of places) {
    const Ls = lot(); fantassin(Ls, P, 0, 0, roy);
    for (const g of [...Ls.g, ...Ls.o]) { g.scale(k, k, k); g.rotateY(Math.PI / 2); g.translate(x, y, z); }
    L.g.push(...Ls.g); L.o.push(...Ls.o);
  }
}
const cacheNav = new Map();
/** Un navire assemblé : géométries partagées (pièces, contours), sabords, cheminée, roues et pavillons. */
function modeleNavire(type, epoque, roy, ferle, troupes, palier) {
  const cle = `${type}|${epoque}|${roy}|${ferle ? 1 : 0}|${troupes ? palier : -1}`;
  let r = cacheNav.get(cle);
  if (r) return r;
  const T = TYPES[type], E = LIVREE[epoque] || LIVREE.ancien, L = lot(), Lg = T.L, W = T.W, H = T.H, ep = 0.12, bois = 0x5b3a1e;
  put(L, tranche(Lg, W, T.arriere, -0.55, H), E.coque, 0, 0, 0, 0, ep);
  put(L, tranche(Lg, W, T.arriere, H - 0.02, H + 0.03, 0.93, 0.86), E.pont, 0, 0, 0, 0, 0);
  const ports = { d: [], g: [] };
  for (const yb of T.bandes) {
    put(L, tranche(Lg, W, T.arriere, yb - 0.13, yb + 0.15, 1.012, 1.05), E.bande, 0, 0, 0, 0, 0);
    for (let x = -Lg * 0.27; x <= Lg * 0.18; x += 0.56) for (const s of [1, -1]) { put(L, boite(0.24, 0.17, 0.06), E.sabord, x, yb + 0.01, s * (W / 2 * 1.05 + 0.025), 0, 0); (s > 0 ? ports.d : ports.g).push([x, yb, s * (W / 2 + 0.2)]); }
  }
  put(L, tranche(Lg, W, T.arriere, H - 0.17, H - 0.03, 1.012, 1.04), roy, 0, 0, 0, 0, 0); // liston aux couleurs du royaume
  const yP = H + T.dunette;
  if (T.dunette) {
    const dl = Lg * 0.24, dw = W * (T.arriere * 0.5 + 0.45), dx = -Lg / 2 + dl / 2 + 0.04;
    put(L, boite(dl, T.dunette, dw), E.coque, dx, H + T.dunette / 2, 0, 0, ep);
    put(L, boite(dl * 0.9, 0.04, dw * 0.84), E.pont, dx, yP + 0.02, 0, 0, 0);
    put(L, boite(dl * 1.01, 0.12, dw * 1.03), roy, dx, yP - 0.08, 0, 0, 0);
    put(L, boite(0.08, T.dunette * 0.75, dw * 0.88), E.deco, -Lg / 2 + 0.02, H + T.dunette * 0.5, 0, 0, 0); // poupe ornée
    for (const z of [-0.25, 0.25]) put(L, boite(0.06, T.dunette * 0.32, 0.26), 0xf2d27a, -Lg / 2 - 0.03, H + T.dunette * 0.55, z * dw, 0, 0); // fenêtres de poupe
  }
  if (T.gaillard) put(L, boite(Lg * 0.14, T.gaillard, W * 0.55), E.coque, Lg * 0.3, H + T.gaillard / 2, 0, 0, ep);
  { const len = Lg * 0.36, bp = cyl(0.06, 0.1, len, 6); bp.rotateZ(-Math.PI / 2 + 0.32); put(L, bp, bois, Lg / 2 - 0.3 + 0.949 * len / 2, H + 0.15 + 0.315 * len / 2, 0, 0, 0); } // beaupré
  let grand = T.mats[0];
  T.mats.forEach(([mx, mh], i) => {
    if (mh > grand[1]) grand = [mx, mh];
    put(L, cyl(0.09, 0.15, mh, 6), bois, mx, H + mh / 2, 0, 0, 0.08);
    let y = H + 0.75;
    for (let v = 0; v < T.voiles; v++) {
      const sh = mh * [0.36, 0.29, 0.21][v], sw = W * [2.05, 1.72, 1.28][v] * (Lg > 7 ? 1.05 : 1);
      if (ferle) put(L, cyl(0.09, 0.09, sw * 0.8, 6).rotateX(Math.PI / 2), E.voile, mx + 0.1, y + sh - 0.06, 0, 0, 0.04);
      else put(L, boite(0.2, sh, sw), E.voile, mx + 0.16, y + sh / 2, 0, 0, 0.07);
      put(L, boite(0.09, 0.09, sw * (ferle ? 0.88 : 1.08)), bois, mx + 0.06, y + sh, 0, 0, 0);
      y += sh + 0.08;
    }
    if (T.auriques || (i === 0 && !ferle && T.voiles)) put(L, boite(T.auriques ? 1.7 : 1.3, mh * (T.auriques ? 0.55 : 0.36), 0.12), E.voile, mx - (T.auriques ? 0.9 : 0.72), H + 0.65 + mh * (T.auriques ? 0.28 : 0.2), 0, 0, 0.06);
  });
  if (!ferle && T.voiles) { // foc, du beaupré au mât de misaine
    const [fx, fh] = T.mats[T.mats.length - 1], s = new THREE.Shape(); s.moveTo(fx + 0.25, H + fh * 0.72); s.lineTo(Lg / 2 + Lg * 0.28, H + 0.6); s.lineTo(fx + 0.6, H + 0.45); s.closePath();
    const gf = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }); gf.translate(0, 0, -0.05); put(L, gf, E.voile, 0, 0, 0, 0, 0.05);
  }
  let fum = null;
  if (T.cheminee) { const [cx, ch] = T.cheminee; put(L, cyl(0.3, 0.34, ch, 10), 0x2b2b30, cx, H + ch / 2, 0, 0, 0.08); put(L, cyl(0.318, 0.318, 0.36, 10), roy, cx, H + ch - 0.5, 0, 0, 0); fum = [cx, H + ch + 0.1, 0]; }
  put(L, boite(0.07, 1.4, 0.07), bois, -Lg / 2 + 0.06, yP + 0.7, 0, 0, 0);
  const roues = [];
  if (T.roues) for (const s of [1, -1]) {
    const cz = s * (W / 2 + 0.26), cy = H * 0.5;
    put(L, new THREE.CylinderGeometry(0.95, 0.95, 0.5, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), roy, 0, cy, cz, 0, 0.08);
    roues.push([0, cy, cz]);
  }
  // l'armée embarquée : quelques soldats debout sur le pont, entre les mâts
  if (troupes) {
    const xs = T.mats.slice(0, -1).map(([a], i) => (a + T.mats[i + 1][0]) / 2);
    soldatsSur(L, PALIERS[palier] || PALIERS[0], roy, xs.flatMap(x => [[x, H + 0.03, -W * 0.22], [x, H + 0.03, W * 0.22]]).slice(0, 4), ECH_GENS / ECH_NAV);
  }
  r = { type, g: fusion(L.g), o: fusion(L.o), ports, fum, roues, T, drapeaux: [[-Lg / 2 + 0.06, yP + 1.12, 0, 1.25, 0.8, Math.PI], [grand[0], H + grand[1] + 0.02, 0, 1.7, 0.28, Math.PI]] };
  for (const g of [...L.g, ...L.o]) g.dispose();
  cacheNav.set(cle, r);
  return r;
}
// la roue à aubes, commune à tous les vapeurs
const ROUE = (() => { const Lr = lot(); put(Lr, cyl(0.2, 0.2, 0.44, 8).rotateX(Math.PI / 2), 0x3a3a40, 0, 0, 0, 0, 0); for (let k = 0; k < 8; k++) { const b = boite(0.16, 0.42, 0.38); b.translate(0, 0.62, 0); b.rotateZ(k * Math.PI / 4); put(Lr, b, 0x6b4426, 0, 0, 0, 0, 0); } return fusion(Lr.g); })();

/** Un navire posé : groupe (cap, roulis) et corps à l'échelle ; ses pavillons claquent, ses roues tournent. */
function creerNavire(type, epoque, roy, opts, parent = groupe) {
  const m = modeleNavire(type, epoque, roy, opts.ferle, opts.troupes, opts.palier || 0);
  const g = new THREE.Group(), corps = new THREE.Group();
  g.rotation.order = 'YXZ'; corps.scale.setScalar(ECH_NAV); g.add(corps);
  const piece = new THREE.Mesh(m.g, MAT); piece.castShadow = piece.receiveShadow = true; corps.add(piece);
  corps.add(new THREE.Mesh(m.o, CONT));
  for (const [x, y, z, w, h, ry] of m.drapeaux) drapeau(corps, roy, x, y, z, w, h, ry);
  const roues = m.roues.map(p => { const r = new THREE.Mesh(ROUE, MAT); r.position.set(...p); corps.add(r); return r; });
  parent.add(g);
  return { g, corps, m, roues, ph: Math.random() * 6, sill: 0, fumT: Math.random() * 0.5 };
}
/** Pose d'un navire : cap (proue vers +x), tangage et roulis de la houle, sillage quand il avance, fumée de sa cheminée. */
function poser(n, x, z, cap, t, dt, { vitesse = 0, roulis = 0, tangage = 0, dy = 0, mouille = false } = {}) {
  const g = n.g, h = mouille ? 0.6 : 1;
  g.position.set(x, MER + Math.sin(t * 1.3 + n.ph) * 0.006 * h + dy, z);
  g.rotation.set(roulis + Math.sin(t * 1.05 + n.ph) * 0.045 * h, cap, tangage + Math.sin(t * 0.85 + n.ph * 2) * 0.03 * h);
  if (!g.visible || !dt) return;
  if (vitesse > 0.02 && (n.sill -= dt) <= 0) { n.sill = 0.16; const p = versMonde(g, -n.m.T.L / 2 * ECH_NAV, 0, (Math.random() - 0.5) * 0.04); ecume(p.x, p.z); }
  if (n.m.fum && dy > -0.2 && (n.fumT -= dt) <= 0) { n.fumT = 0.45; const p = versMonde(n.corps, ...n.m.fum); bouffee(p.x, p.y, p.z, 'noire', 0.6); }
  for (const r of n.roues) r.rotation.z -= dt * (vitesse > 0.02 ? 5 : 0.6);
}
const ote = n => n.g.parent?.remove(n.g); // les géométries sont partagées : on retire sans libérer

// chaloupe et ses quatre passagers (masqués au retour à vide)
const cacheCh = new Map();
function chaloupe(roy, palier) {
  const cle = roy + '|' + palier;
  let r = cacheCh.get(cle);
  if (!r) {
    const L = lot(), Lp = lot(), P = PALIERS[palier] || PALIERS[0];
    put(L, tranche(2.4, 0.95, 0.7, -0.3, 0.42), 0x8a5a34, 0, 0, 0, 0, 0.09);
    put(L, tranche(2.4, 0.95, 0.7, 0.3, 0.42, 1.02, 1.06), roy, 0, 0, 0, 0, 0);
    for (const x of [-0.45, 0.35]) for (const s of [1, -1]) { const b = boite(0.08, 0.06, 1.2); b.rotateX(s * 0.35); put(L, b, 0xb08a5a, x, 0.33, s * 0.8, 0, 0); }
    for (const x of [-0.78, -0.26, 0.26, 0.78]) { put(Lp, boite(0.4, 0.5, 0.42), roy, x, 0.62, 0, 0, 0.05); put(Lp, sphere(0.2, 1), PEAU, x, 1.05, 0, 0, 0.04); tete(Lp, P, x, 1.2, 0, roy); }
    r = { g: fusion(L.g), o: fusion(L.o), pg: fusion(Lp.g), po: fusion(Lp.o) };
    cacheCh.set(cle, r);
  }
  const g = new THREE.Group(), pass = new THREE.Group();
  g.add(new THREE.Mesh(r.g, MAT), new THREE.Mesh(r.o, CONT), pass);
  pass.add(new THREE.Mesh(r.pg, MAT), new THREE.Mesh(r.po, CONT));
  g.scale.setScalar(ECH_NAV); g.rotation.order = 'YXZ'; groupe.add(g);
  return { g, pass, ph: Math.random() * 6 };
}
// ------------------------------------------------------------------ état
const flottes = new Map(); // id → { cle, proprio, couleur, navires: [navire], case, x, z, cap, ferle, anim, navette, label }
const mourants = [];       // navires qui coulent (détachés de leur flotte : la bataille survit au nouvel état)
const scenes = [];         // chaloupes, soldats : { maj(now, dt, t) → false quand c'est fini }
let E = null;              // dernier état reçu
let bouees = null, cleBouees = '';
const couleurs = {};
const VIDE = { flottes: [], blocus: [], royaumes: [], armees: [], batiments: [], villes: [] };
const palierRoy = id => { const r = E?.royaumes.find(x => x.id === id); return r ? palierDe(r.joueur ? E.joueur?.techs : r.techs_liste) : 0; };
const couleurDe = id => couleurs[id] || '#888';
const portDe = (proprio, c) => E?.batiments.find(b => b.cle === 'port' && b.proprio === proprio && b.reste === 0 && ecart(b.case, c) <= 1);

/** Les navires montrés pour une flotte : les plus forts d'abord, trois au plus. */
function composition(f, epoque) {
  const l = [];
  for (const [u, n] of Object.entries(f.navires || {}).sort((a, b) => (RANG[a[0]] ?? 9) - (RANG[b[0]] ?? 9))) for (let k = 0; k < n && l.length < 3; k++) l.push(modeleDe(u, epoque));
  return l.length ? l : ['corvette'];
}
/** Places des navires d'une flotte, en file, dans le repère de son cap. */
const FILE = [[[0, 0]], [[0.36, 0.1], [-0.36, -0.1]], [[0.66, 0.12], [0, -0.12], [-0.66, 0.12]]];
/** Une flotte bloque-t-elle une ville ? Rend le blocus (son arc se tourne vers la ville). */
function blocusDe(f) {
  for (const b of E.blocus || []) {
    if (b.par !== f.proprio) continue;
    const ville = E.villes.find(v => v.id === b.ville);
    const lieux = [b.case, ...E.batiments.filter(x => x.cle === 'port' && ville && x.ville === ville.id).map(x => x.case)];
    const lieu = lieux.find(c => ecart(c, f.case) <= 1);
    if (lieu !== undefined) return { ...b, lieu };
  }
  return null;
}
const villeBloquee = c => (E.blocus || []).some(b => { const v = E.villes.find(x => x.id === b.ville); return v && E.batiments.some(x => x.cle === 'port' && x.ville === v.id && ecart(x.case, c) <= 1); });

/** Met les flottes, les blocus et le commerce par mer d'accord avec l'état (après synchroniser de monde.js). */
export function majMarine(etat) {
  const avant = E;
  E = etat = etat || VIDE; // sans partie (accueil) : plus rien en mer
  for (const r of etat.royaumes) couleurs[r.id] = r.couleur;
  couleurs[99] = '#4b4b4b';
  const epoque = etat.epoque?.cle || 'ancien';
  const parCase = new Map();
  const vus = new Set();
  for (const f of etat.flottes || []) {
    vus.add(f.id);
    const roy = couleurDe(f.proprio), palier = palierRoy(f.proprio);
    const bloc = blocusDe(f);
    const aQuaiBloque = !bloc && f.a_quai && villeBloquee(f.case);
    // une armée qui attend de débarquer reste à bord jusqu'à la fin du mois
    const troupes = !!f.armee || etat.armees.some(a => a.proprio === f.proprio && a.case === f.case);
    const compo = composition(f, epoque), ferle = !!bloc || aQuaiBloque;
    const cle = `${epoque}|${roy}|${compo.join(',')}|${troupes ? 1 : 0}|${ferle ? 1 : 0}|${palier}`;
    let v = flottes.get(f.id);
    if (v?.anim && performance.now() > v.anim.t0 + v.anim.duree) v.anim = null;
    if (!v || v.cle !== cle) {
      if (v) v.navires.forEach(ote);
      const vieux = v;
      v = { cle, proprio: f.proprio, navires: compo.map((ty, i) => creerNavire(ty, epoque, roy, { ferle, troupes: troupes && (TRANSPORT.has(ty) || i === 0), palier })), anim: vieux?.anim || null, cap: vieux?.cap, x: vieux?.x, z: vieux?.z };
      flottes.set(f.id, v);
    }
    v.case = f.case; v.ferle = ferle; v.couleur = roy; v.n = Object.values(f.navires || {}).reduce((s, n) => s + n, 0);
    v.effectif = f.armee?.effectif || 0;
    // où mouiller, dans quel sens
    const p = posCase(f.case), k = parCase.get(f.case) || 0; parCase.set(f.case, k + 1);
    let x = p.x, z = p.z, cap = v.cap ?? hache(f.id, 5) * 6.28;
    const port = portDe(f.proprio, f.case);
    if (f.chemin?.length) { const q = posCase(f.chemin[0]); cap = capX(q.x - p.x, q.z - p.z); }
    else if (bloc) { const c = posCase(bloc.lieu), a = Math.atan2(p.z - c.z, p.x - c.x); cap = -(a + Math.PI / 2); }
    else if (port && v.cap === undefined) { const q = posCase(port.case); cap = capX(q.x - p.x, q.z - p.z) + Math.PI / 2; } // flanc au quai
    if (k) { const a = cap + Math.PI / 2; x += Math.cos(a) * 0.5 * (k % 2 ? 1 : -1) * Math.ceil(k / 2); z -= Math.sin(a) * 0.5 * (k % 2 ? 1 : -1) * Math.ceil(k / 2); }
    v.repos = { x, z, cap };
    v.bloc = bloc ? { centre: posCase(bloc.lieu), R: Math.hypot(p.x - posCase(bloc.lieu).x, p.z - posCase(bloc.lieu).z) } : null;
    if (!v.anim) { v.x = x; v.z = z; v.cap = cap; }
    // commerce : la flûte (ou le vapeur) fait la navette entre le quai et le large
    const iNav = v.navires.findIndex(n => TRANSPORT.has(n.m.type));
    v.navette = f.commerce && port && !ferle && iNav >= 0 ? (v.navette?.cle === `${f.case}|${port.case}` ? v.navette : routeCommerce(f.case, port.case, iNav)) : null;
  }
  for (const [id, v] of flottes) if (!vus.has(id)) { v.navires.forEach(ote); flottes.delete(id); }
  // embarquement : une de nos armées (vue au dernier état) est montée à bord
  if (avant) for (const f of etat.flottes || []) {
    if (f.proprio !== 0 || !f.armee?.id) continue;
    const a = avant.armees.find(x => x.id === f.armee.id);
    if (a && a.case !== f.case) scenes.push(sceneChaloupes(f.id, a.case, false));
  }
  majBouees();
  etiquettes();
}
function etiquettes() {
  for (const [id, v] of flottes) etiquette('f' + id, `<div class="arm" style="--c:${v.couleur}">⚓ ${v.n}${v.effectif ? ` · 🛡 ${v.effectif}` : ''}</div>`, v.x, 0.75, v.z, { dy: -6, loin: 75 });
  balayer('f');
}

// ------------------------------------------------------------------ commerce : navette du quai vers le large, demi-tour à chaque bout
function routeCommerce(c0, portC, iNav) {
  const P = posCase(portC), dist = new Map([[c0, 0]]), prev = new Map(), file = [c0];
  let loin = c0;
  while (file.length) {
    const c = file.shift(), d = dist.get(c);
    if (d >= 3) continue;
    for (const n of voisins(c)) if (eau(n) && !dist.has(n)) { dist.set(n, d + 1); prev.set(n, c); file.push(n); }
  }
  let best = -1;
  for (const [c, d] of dist) { const q = posCase(c), s = d * 10 + Math.hypot(q.x - P.x, q.z - P.z); if (s > best) { best = s; loin = c; } }
  const cases = []; for (let c = loin; c !== undefined; c = prev.get(c)) cases.unshift(c);
  const p0 = posCase(c0), quai = { x: P.x + (p0.x - P.x) * 0.55, z: P.z + (p0.z - P.z) * 0.55 };
  const pts = [[quai.x, quai.z], ...cases.map(c => { const q = posCase(c); return [q.x, q.z]; })];
  if (pts.length < 3) pts.push([pts[pts.length - 1][0] + 0.8, pts[pts.length - 1][1]]);
  return { cle: `${c0}|${portC}`, route: cheminLisse(pts), i: iNav, t0: Math.random() * 10 };
}
function poseNavette(N, t) {
  const R = N.route, v = 0.3, tr = R.long / v, cyc = 2 * (tr + 3), u = (t + N.t0) % cyc;
  let sd, cap, vit = v;
  if (u < 3) { sd = 0; cap = R.en(0.02).cap + Math.PI * (1 - lisse(0, 3, u)); vit = 0; }
  else if (u < 3 + tr) { sd = (u - 3) * v; cap = R.en(sd).cap; }
  else if (u < 6 + tr) { sd = R.long; cap = R.en(R.long - 0.02).cap + Math.PI * lisse(3 + tr, 6 + tr, u); vit = 0; }
  else { sd = R.long - (u - 6 - tr) * v; cap = R.en(sd).cap + Math.PI; }
  const p = R.en(sd);
  return { x: p.x, z: p.z, cap, vit };
}

// ------------------------------------------------------------------ blocus : bouées rouges et blanches devant le port bloqué
function majBouees() {
  const arcs = [];
  for (const [, v] of flottes) if (v.bloc && v.navires.length) arcs.push(v);
  const cle = arcs.map(v => `${v.repos.x.toFixed(2)},${v.repos.z.toFixed(2)},${v.navires.length}`).join(';');
  if (cle === cleBouees) return;
  cleBouees = cle;
  if (bouees) { groupe.remove(bouees); bouees.children.forEach(m => m.geometry.dispose()); bouees = null; }
  if (!arcs.length) return;
  const L = lot();
  for (const v of arcs) {
    const pts = placesBlocus(v).map(p => ({ x: p.x, z: p.z }));
    const a = pts[0], b = pts[pts.length - 1], dx = b.x - a.x, dz = b.z - a.z;
    const ext = [{ x: a.x - dx * 0.35, z: a.z - dz * 0.35 }, ...pts, { x: b.x + dx * 0.35, z: b.z + dz * 0.35 }];
    for (let i = 0; i < ext.length - 1; i++) for (let f = 0.2; f < 0.85; f += 0.15) put(L, sphere(0.022, 0), (f * 100 | 0) % 2 ? 0xd9322a : 0xf6f2ea, ext[i].x + (ext[i + 1].x - ext[i].x) * f, MER + 0.012, ext[i].z + (ext[i + 1].z - ext[i].z) * f, 0, 0.004);
  }
  bouees = new THREE.Group();
  bouees.add(new THREE.Mesh(fusion(L.g), MAT), new THREE.Mesh(fusion(L.o), CONT));
  groupe.add(bouees);
}
/** Les navires d'un blocus mouillent en arc autour de la ville, flanc tourné vers elle. */
function placesBlocus(v) {
  const { centre, R } = v.bloc, n = v.navires.length, a0 = Math.atan2(v.repos.z - centre.z, v.repos.x - centre.x), Rr = Math.max(1.1, R * 0.86);
  return v.navires.map((_, i) => { const a = a0 + (i - (n - 1) / 2) * 0.36; return { x: centre.x + Math.cos(a) * Rr, z: centre.z + Math.sin(a) * Rr, cap: -(a + Math.PI / 2) }; });
}

// ------------------------------------------------------------------ le mois joué : navigation, batailles, débarquements
let mois = null; // { t0, combats: [...] }
/** À appeler avec jouerMois de monde.js (mêmes rapport, état suivant et durée) : flottes en route, batailles navales, débarquements. */
export function jouerMoisMarine(rapport, apres, duree = 2800) {
  if (!E) return;
  const etapes = Math.max(1, ...rapport.mouvements.map(m => m.trajet.length - 1), ...rapport.combats.map(c => c.etape || 1));
  const t0 = performance.now(), epoque = E.epoque?.cle || 'ancien';
  for (const m of rapport.mouvements) {
    if (!m.flotte) continue;
    let v = flottes.get(m.armee);
    if (!v) { // une flotte qui entre dans notre vue
      const f = apres.flottes?.find(x => x.id === m.armee) || { id: m.armee, proprio: m.proprio, navires: { corvette: 1 } };
      const roy = couleurDe(m.proprio);
      v = { cle: '', proprio: m.proprio, couleur: roy, n: 1, effectif: 0, navires: composition(f, epoque).map(ty => creerNavire(ty, epoque, roy, {})), repos: null, x: 0, z: 0, cap: 0 };
      flottes.set(m.armee, v);
    }
    v.anim = { trajet: m.trajet, t0, duree: duree * (m.trajet.length - 1) / etapes };
    v.navette = null;
  }
  // débarquement : l'armée part de la case de la flotte (une case d'eau) vers la terre
  for (const m of rapport.mouvements) if (!m.flotte && m.trajet.length > 1 && eau(m.trajet[0]) && !eau(m.trajet[1])) {
    const v = [...flottes].find(([, x]) => x.case === m.trajet[0] && x.proprio === m.proprio);
    if (v) scenes.push(sceneChaloupes(v[0], m.trajet[1], true, duree));
  }
  const combats = rapport.combats.filter(c => eau(c.case)).map(c => ({ ...c, t: t0 + duree * (c.etape || 1) / etapes - 150, fait: false }));
  const vivantes = new Set((apres.flottes || []).map(f => f.id));
  mois = { t0, combats, vivantes, visible: apres.visible || [] };
  setTimeout(() => { for (const [, v] of flottes) v.anim = null; }, duree + 400);
}

// bataille navale : les deux camps se canonnent ; les flottes disparues brûlent, s'inclinent et coulent
const tirs = [];
function bataille(c) {
  const p = posCase(c.case), camps = { a: [], d: [] }, perdants = [];
  for (const [id, v] of flottes) {
    if (v.proprio !== c.attaquant && v.proprio !== c.defenseur) continue;
    const pres = v.navires.filter(n => Math.hypot(n.g.position.x - p.x, n.g.position.z - p.z) < 1.4);
    if (!pres.length) continue;
    (v.proprio === c.attaquant ? camps.a : camps.d).push(...pres);
    if (!mois.vivantes.has(id) && (v.proprio === 0 || mois.visible[c.case])) perdants.push(id);
  }
  const now = performance.now();
  // deux lignes de file qui se font face : chaque camp s'écarte d'un côté, tous au cap de l'assaillant
  const capA = camps.a[0]?.g.rotation.y ?? 0, px = Math.sin(capA), pz = Math.cos(capA);
  for (const [, v] of flottes) {
    if (v.proprio !== c.attaquant && v.proprio !== c.defenseur) continue;
    if (!v.navires.some(n => camps.a.includes(n) || camps.d.includes(n))) continue;
    const s = v.proprio === c.attaquant ? -0.34 : 0.34;
    v.combat = { dx: px * s, dz: pz * s, cap: capA, t0: now, t1: now + 7000 };
  }
  const tirer = (n, cibles, decal) => {
    if (!cibles.length) return;
    const cible = cibles[Math.random() * cibles.length | 0];
    const cap = n.g.rotation.y, versD = Math.sin(cap) * (cible.g.position.x - n.g.position.x) + Math.cos(cap) * (cible.g.position.z - n.g.position.z) > 0; // tribord (+z local) face à la cible ?
    const ports = n.m.ports[versD ? 'd' : 'g'].length ? n.m.ports[versD ? 'd' : 'g'] : [[0, n.m.T.H * 0.7, (versD ? 1 : -1) * (n.m.T.W / 2 + 0.2)]];
    for (let b = 0; b < 2; b++) ports.forEach((port, k) => tirs.push({ t: now + (decal + b * 1.6 + k * 0.07) * 1000, n, port, cible }));
  };
  camps.a.forEach((n, i) => tirer(n, camps.d, i * 0.4));
  camps.d.forEach((n, i) => tirer(n, camps.a, 0.25 + i * 0.4));
  for (const id of perdants) {
    const v = flottes.get(id);
    flottes.delete(id);
    v.navires.forEach((n, i) => {
      const f = feu(n.corps, -0.5, n.m.T.H, 0, 6);
      const k = FILE[Math.min(3, v.navires.length) - 1][i] || [0, 0], x = p.x + px * 0.34 + Math.cos(capA) * k[0], z = p.z + pz * 0.34 - Math.sin(capA) * k[0];
      mourants.push({ n, f, x0: n.g.position.x, z0: n.g.position.z, x, z, cap: capA, t0: now + 1200 + i * 300 });
    });
  }
  etiquettes(); // l'étiquette de la flotte coulée s'en va
}
function majTirs(now) {
  for (let i = tirs.length - 1; i >= 0; i--) {
    const s = tirs[i];
    if (now < s.t) continue;
    tirs.splice(i, 1);
    if (!s.n.g.parent) continue;
    const p = versMonde(s.n.corps, ...s.port);
    eclat(p, 1.5); bouffee(p.x, p.y, p.z, 'poudre', 1.25);
    const c = s.cible.g.position, tx = c.x + (Math.random() - 0.5) * 0.7, tz = c.z + (Math.random() - 0.5) * 0.3;
    if (Math.random() < 0.65) setTimeout(() => gerbe(tx, tz), 280);
    else setTimeout(() => bouffee(c.x + (Math.random() - 0.5) * 0.4, MER + 0.08, c.z, 'noire', 0.7), 280);
  }
}

// chaloupes : deux allers-retours entre le navire et la rive ; à terre (débarquement) les soldats se forment en ligne
function sceneChaloupes(idFlotte, terre, debarque, duree = 2800) {
  const v = flottes.get(idFlotte);
  if (!v) return { maj: () => false };
  const roy = v.couleur, palier = palierRoy(v.proprio), t0 = performance.now();
  const T = posCase(terre), F = { x: v.x ?? v.repos.x, z: v.z ?? v.repos.z }; // (un navire tout juste recréé n'est pas encore posé)
  const dx = T.x - F.x, dz = T.z - F.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const rive = s => ({ x: T.x - ux * 0.93 - uz * s * 0.16, z: T.z - uz * 0.93 + ux * s * 0.16 });
  const flanc = s => ({ x: F.x + ux * 0.16 - uz * s * 0.1, z: F.z + uz * 0.16 + ux * s * 0.1 });
  const ch = [chaloupe(roy, palier), chaloupe(roy, palier)];
  const cyc = Math.max(1.6, duree / 1000 / 2.2), aller = cyc * 0.42;
  const soldats = debarque ? Array.from({ length: 8 }, (_, i) => { const s = soldat(groupe, roy, palier, i === 3 ? 'grenadier' : 'ligne'); s.visible = false; return s; }) : [];
  const fin = 2 * cyc + 0.6 + (debarque ? 1.8 : 0);
  return {
    maj(now, dt, t) {
      const u = (now - t0) / 1000;
      if (u > fin) { for (const c of ch) groupe.remove(c.g); for (const s of soldats) groupe.remove(s); return false; }
      ch.forEach((c, j) => {
        const s = j ? 1 : -1, debut = j * cyc * 0.35, A = debarque ? flanc(s) : rive(s), B = debarque ? rive(s) : flanc(s);
        let f = 0, charge = true;
        const w = u - debut;
        c.g.visible = w > -0.3 && w < 2 * cyc;
        if (w >= 0) { const r = w % cyc; charge = r < aller; f = r < aller ? lisse(0, aller, r) : r < aller + 0.3 ? 1 : 1 - lisse(aller + 0.3, cyc, r); }
        c.pass.visible = charge;
        const cx = A.x + (B.x - A.x) * f, cz = A.z + (B.z - A.z) * f;
        c.g.position.set(cx, MER + 0.004 + Math.sin(t * 2 + c.ph) * 0.004, cz);
        c.g.rotation.set(Math.sin(t * 3 + c.ph) * 0.06, capX(B.x - A.x, B.z - A.z), Math.sin(t * 2.4) * 0.05);
        if (c.g.visible && f > 0.05 && f < 0.95 && Math.random() < dt * 4) ecume(cx - ux * 0.12, cz - uz * 0.12, 0.25, 1.2);
      });
      // à terre : chacun remonte la plage vers sa place (deux rangs de quatre, face aux terres)
      soldats.forEach((so, i) => {
        const j = i % 2, voyage = (i >> 1) >> 1, quand = j * cyc * 0.35 + voyage * cyc + aller + ((i >> 1) % 2) * 0.25;
        so.visible = u > quand; if (!so.visible) return;
        const rang = i >> 2, col = i % 4, px = -uz, pz = ux;
        const cible = { x: T.x - ux * (0.25 + rang * 0.15) + px * (col - 1.5) * 0.11, z: T.z - uz * (0.25 + rang * 0.15) + pz * (col - 1.5) * 0.11 };
        const dep = rive(j ? 1 : -1), f = lisse(quand, quand + 1.2, u), x = dep.x + (cible.x - dep.x) * f, z = dep.z + (cible.z - dep.z) * f;
        so.position.set(x, Math.max(solEn(x, z), MER - 0.01) + (f < 1 ? Math.abs(Math.sin(t * 9 + i)) * 0.006 : 0), z);
        so.rotation.y = f < 1 ? capVers(cible.x - dep.x, cible.z - dep.z) : capVers(ux, uz);
      });
      return true;
    },
  };
}

// ------------------------------------------------------------------ chaque image
chaqueImage((dt, t) => {
  const now = performance.now();
  if (mois) for (const c of mois.combats) if (!c.fait && now >= c.t) { c.fait = true; bataille(c); }
  majTirs(now);
  for (const [id, v] of flottes) {
    let x = v.x, z = v.z, cap = v.cap, vit = 0;
    if (v.anim) {
      const a = v.anim, k = Math.min(1, (now - a.t0) / Math.max(1, a.duree));
      const f = k * (a.trajet.length - 1), i = Math.min(a.trajet.length - 2, Math.floor(f)), r = f - i;
      const p = posCase(a.trajet[i]), q = posCase(a.trajet[i + 1]);
      x = p.x + (q.x - p.x) * r; z = p.z + (q.z - p.z) * r;
      const c = capX(q.x - p.x, q.z - p.z), d = Math.atan2(Math.sin(c - (v.cap ?? c)), Math.cos(c - (v.cap ?? c)));
      cap = (v.cap ?? c) + d * Math.min(1, dt * 6); vit = k < 1 ? 0.3 : 0;
      v.x = x; v.z = z; v.cap = cap;
    } else if (v.repos) {
      x = v.repos.x; z = v.repos.z;
      const d = Math.atan2(Math.sin(v.repos.cap - cap), Math.cos(v.repos.cap - cap));
      cap += d * Math.min(1, dt * 2); v.x = x; v.z = z; v.cap = cap;
    }
    if (v.combat) { // en ligne de bataille
      const b = v.combat, a = lisse(b.t0, b.t0 + 700, now) * (1 - lisse(b.t1 - 900, b.t1, now));
      x += b.dx * a; z += b.dz * a;
      cap += Math.atan2(Math.sin(b.cap - cap), Math.cos(b.cap - cap)) * a;
      if (now > b.t1) v.combat = null;
    }
    const places = v.bloc && !v.anim ? placesBlocus(v) : null;
    const file = FILE[Math.min(3, v.navires.length) - 1] || FILE[0], co = Math.cos(cap), si = Math.sin(cap);
    v.navires.forEach((n, i) => {
      if (v.navette && i === v.navette.i && !v.anim) { const p = poseNavette(v.navette, t); poser(n, p.x, p.z, p.cap, t, dt, { vitesse: p.vit }); return; }
      if (places) { const p = places[i]; poser(n, p.x, p.z, p.cap + Math.sin(t * 0.12 + n.ph) * 0.04, t, dt, { mouille: true }); return; }
      const [ox, oz] = file[i] || [0, 0]; // ox le long du cap (+x local), oz par le travers
      poser(n, x + ox * co + oz * si, z - ox * si + oz * co, cap + (vit ? 0 : Math.sin(t * 0.15 + n.ph) * 0.05), t, dt, { vitesse: vit, mouille: v.ferle });
    });
    deplacer('f' + id, x, 0.75, z);
  }
  // navires qui coulent : le feu prend, ils s'inclinent, s'enfoncent, puis l'eau se referme
  for (let i = mourants.length - 1; i >= 0; i--) {
    const m = mourants[i], u = (now - m.t0) / 1000;
    m.f.visible = u > -1 && u < 2.6;
    if (m.f.visible && Math.random() < dt * 3) { const p = versMonde(m.n.corps, 0, m.n.m.T.H + 1.2, 0); bouffee(p.x, p.y, p.z, 'noire', 0.9); }
    const s = lisse(0, 3, u), a = lisse(-1.2, -0.4, u);
    poser(m.n, m.x0 + (m.x - m.x0) * a + Math.max(0, u) * 0.012, m.z0 + (m.z - m.z0) * a, m.cap, t, dt, { roulis: s * 0.75, tangage: -s * 0.32, dy: -s * 0.62 });
    if (u > 3 && !m.gerbe) { m.gerbe = true; for (let k = 0; k < 6; k++) gerbe(m.x + (Math.random() - 0.5) * 0.3, m.z + (Math.random() - 0.5) * 0.2, 0.6); }
    if (u > 3.2) { ote(m.n); oublierFeu(m.f); mourants.splice(i, 1); }
  }
  for (let i = scenes.length - 1; i >= 0; i--) if (!scenes[i].maj(now, dt, t)) scenes.splice(i, 1);
});
