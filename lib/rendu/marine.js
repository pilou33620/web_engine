// La marine (maquettes/guerre.html) : navires aux couleurs du royaume (pavillon, flamme, liston) qui tanguent et laissent
// un sillage d'écume ; flûte, corvette, frégate, vaisseau de ligne, vapeur à roues (frégate et vaisseau à hélice à l'ère
// industrielle), coques selon l'époque ; flottes qui naviguent pendant le mois, bataille navale (bordées, fumée de poudre,
// gerbes, navire qui brûle et coule), embarquement et débarquement en chaloupes, blocus (navires mouillés en arc devant
// le port, voiles serrées, ligne de bouées) et commerce (la flûte fait la navette depuis le quai).
// Chaque variante de navire est assemblée une fois (géométries fusionnées en cache) ; une flotte garde ses maillages
// tant que sa composition, son époque, sa couleur et son allure ne changent pas.
//
// Commerce et haute mer (champs facultatifs de l'état, lus par majMarine ; une case est un indice de case du moteur) :
//  - etat.comptoirs = [{ id, case, denree, navires: [{ proprio }], dispute? }] : comptoir en mer (ponton, caisses de la denrée,
//    bouée et pavillon, ancre) ; les marchands mouillés autour (3 au plus) et leurs chaloupes. Libre (pavillon blanc), occupé
//    (pavillon du camp), disputé (dispute : true ou le camp qui le conteste ; pavillon qui alterne, coups de feu).
//    denree : sucre, tabac, cafe, coton, the, epices, indigo, ivoire, fourrures.
//  - etat.routes_mer, sinon etat.routes = [{ id, chemin: [cases], proprio, coupee }] : route commerciale (ruban pointillé animé
//    aux couleurs du camp, flûte qui la parcourt) ; coupée : rouge, pointillés arrêtés, sans navire. (Les routes de terre de
//    routes.js, des tableaux [case, case, niveau], sont ignorées.) Le ruban garde à peu près sa largeur à l'écran quand on
//    s'éloigne (bornée) et prend un liseré sombre de loin.
//  - etat.sorties = [{ case, nom, vers? }] : route vers un autre théâtre (balise et flèche d'horizon au bord de la mer, avec son nom) ;
//    vers = [dx, dz] : de quel côté est ce théâtre (x vers la droite de la carte, z vers le bas), sinon le bord de carte le plus
//    proche de la balise. Les flottes qui partent ou arrivent par cette balise suivent cette direction.
//  - flottes[].ordre : 'corsaire' (pavillon noir, flamme rouge), 'route' (la flotte gagne une sortie, s'éloigne vers l'horizon et
//    s'estompe ; elle reste cachée tant qu'elle a cet ordre), 'commerce' (comme commerce: true : la navette).
//    Avec 'route' : flottes[].sortie = case de la balise à prendre ; sinon flottes[].vers = [dx, dz], la direction du théâtre de
//    destination : la balise qui va le mieux de ce côté, et sans balise de ce côté, droit vers le bord de la fenêtre dans cette
//    direction ; sans l'un ni l'autre, la balise la plus proche (comme avant).
//    Types reconnus : flute, corvette, fregate, vaisseau, vapeur (ou vapeur_navire), fregate_helice, vaisseau_helice, cuirasse.
// Rapport de jouerMoisMarine (champs facultatifs, en plus de mouvements et combats, eux-mêmes facultatifs) :
//  - mouvements[] d'une flotte ({ flotte: true, armee: id, proprio, trajet: [cases] }) qui sort de la fenêtre ou y entre :
//    sortie: true, ou une ou des cases négatives (hors fenêtre) à la fin du trajet : la flotte suit ses cases, va jusqu'au bord
//    de la fenêtre (dans la direction de son dernier pas, ou sortie = [dx, dz]) puis au-delà en s'estompant, et reste cachée jusqu'au
//    prochain majMarine (où elle n'est plus, d'ordinaire) ; entree: true, ou des cases négatives au début : elle paraît au bord en
//    fondu (du côté d'où vient son premier pas, ou entree = [dx, dz] : le côté d'où elle vient) puis suit ses cases. Exemples :
//    { flotte: true, armee: 7, proprio: 1, trajet: [412, 413, -1] } ; { flotte: true, armee: 8, proprio: 2, trajet: [-1, 96, 97] }.
//  - arrivees = [{ flotte, case?, sortie?, vers? }] : la flotte (cherchée dans apres.flottes) surgit de l'horizon, par la sortie
//    donnée (sinon celle qui va vers vers = [dx, dz], le côté d'où elle vient, sinon la plus proche), et gagne sa case (case, sinon
//    celle de apres).
//  - abordages = [{ flotte, case, proprio? }] : comme abordageCorsaire(flotte, case, { proprio }).
//  - departs = [{ case, proprio, navires: { type: n }, sortie?, vers?, armee? }] : comme departFlotte(…) ; une flotte qui part vers
//    un autre théâtre et que le jeu ne suit plus (absente de etat.flottes) : son départ se voit quand même.
// Fonctions de mise en scène, pour la page :
//  - departFlotte({ case, proprio?, navires?, sortie?, vers?, armee?, epoque? }) : la flotte part de sa case, gagne la balise (sortie,
//    sinon celle qui va vers vers, sinon la plus proche ; sans balise de ce côté, droit vers le bord), s'éloigne et s'efface ; elle
//    n'entre pas dans etat.flottes et survit à majMarine. armee : effectif embarqué (soldats sur le pont, étiquette). Rend la durée (ms).
//  - abordageCorsaire(flotteId, caseMarchand, { proprio?, duree? }) : le corsaire fond sur le marchand de la case (une flotte
//    d'un autre camp, sinon un marchand du comptoir, sinon une flûte de passage aux couleurs de proprio), coup de semonce,
//    grappins et fusillade, puis le marchand hisse les couleurs du corsaire. Rend la durée de la scène (ms), 0 si rien.
//  - sceneNavale({ case, camps: [{ proprio, navires: { type: n } }, …], phase, vent?, coules?, pris?, epoque? }) : bataille
//    navale pilotée phase par phase ; phase 'approche' | 'bordees' | 'abordage' | 'fin' ; vent : indice du camp qui a le vent
//    (flèche de vent sur l'eau) ; coules, pris : nombre de navires coulés, pris, par camp (dans l'ordre des camps, cumulés :
//    on peut les augmenter à chaque phase). Rappeler avec les mêmes camps fait avancer la scène ; sceneNavale(null) l'efface.
import { THREE, scene, camera, cam, posCase, chaqueImage, hache, voisins, geo, SQ3 } from './scene.js';
import { MAT, CONT, lot, put, fusion, boite, cyl, sphere } from './toon.js';
import { fantassin, tete, PALIERS, palierDe } from './modeles.js';
import { solEn } from './plateau.js';
import { bouffee } from './vie.js';
import { etiquette, deplacer, balayer, echapper, effet } from './etiquettes.js';
import { MER, lisse, capX, capVers, versMonde, eau, ecart, cheminLisse, ecume, eclat, gerbe, feu, oublierFeu, drapeau, matPav, soldat } from './guerre_commun.js';

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
// cuirassé (après 1860) : coque grise basse, tourelles à l'avant et à l'arrière, une cheminée, deux mâts à voiles auriques
TYPES.cuirasse = { L: 7.2, W: 1.75, H: 0.75, arriere: 0.8, coque: 0x4a4f57, mats: [[-1.7, 4.0], [1.3, 4.4]], voiles: 0, auriques: true, dunette: 0, gaillard: 0, bandes: [], cheminee: [-0.2, 2.5], tourelles: [2.15, -2.45] };
const ALIAS = { vapeur_navire: 'vapeur', fregate_helice: 'fregateH', vaisseau_helice: 'vaisseauH' };
/** Le modèle d'une unité du jeu à une époque : à l'ère industrielle, frégates et vaisseaux passent à l'hélice. */
function modeleDe(unite, epoque) {
  if (ALIAS[unite]) return ALIAS[unite];
  if (epoque === 'industrie' && (unite === 'fregate' || unite === 'vaisseau')) return unite + 'H';
  return TYPES[unite] ? unite : 'corvette';
}
const RANG = { cuirasse: -1, vaisseau_helice: 0, vaisseau: 0, vapeur_navire: 1, vapeur: 1, fregate_helice: 2, fregate: 2, corvette: 3, flute: 4 };
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
  put(L, tranche(Lg, W, T.arriere, -0.55, H), T.coque ?? E.coque, 0, 0, 0, 0, ep);
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
  for (const tx of T.tourelles || []) { // tourelle tournante et ses deux canons, vers l'avant ou l'arrière ; passerelle entre les deux
    const s = Math.sign(tx);
    put(L, cyl(0.62, 0.68, 0.5, 12), 0x5d636c, tx, H + 0.25, 0, 0, 0.08);
    for (const z of [-0.18, 0.18]) put(L, cyl(0.08, 0.1, 1.0, 6).rotateZ(-s * Math.PI / 2), 0x2b2d31, tx + s * 0.9, H + 0.3, z, 0, 0.05);
  }
  if (T.tourelles) put(L, boite(1.1, 0.7, 1.0), 0x5d636c, 0.7, H + 0.35, 0, 0, 0.08);
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

const NOIR = 0x1c1a1a, ROUGE = 0xd42a1e;
/** Un navire posé : groupe (cap, roulis) et corps à l'échelle ; ses pavillons claquent, ses roues tournent.
 *  opts.corsaire : pavillon noir à la poupe et flamme rouge au grand mât (le liston garde les couleurs du camp). */
function creerNavire(type, epoque, roy, opts, parent = groupe) {
  const m = modeleNavire(type, epoque, roy, opts.ferle, opts.troupes, opts.palier || 0);
  const g = new THREE.Group(), corps = new THREE.Group();
  g.rotation.order = 'YXZ'; corps.scale.setScalar(ECH_NAV); g.add(corps);
  const piece = new THREE.Mesh(m.g, MAT); piece.castShadow = piece.receiveShadow = true; corps.add(piece);
  corps.add(new THREE.Mesh(m.o, CONT));
  const pavs = m.drapeaux.map(([x, y, z, w, h, ry]) => drapeau(corps, roy, x, y, z, w, h, ry));
  const roues = m.roues.map(p => { const r = new THREE.Mesh(ROUE, MAT); r.position.set(...p); corps.add(r); return r; });
  parent.add(g);
  const n = { g, corps, m, roues, pavs, ph: Math.random() * 6, sill: 0, fumT: Math.random() * 0.5 };
  if (opts.corsaire) hisser(n, NOIR, ROUGE);
  return n;
}
/** Hisse d'autres couleurs (pavillon de poupe, flamme) : marchand pris, corsaire. */
function hisser(n, poupe, flamme = poupe) { n.pavs[0].material = matPav(poupe); n.pavs[1].material = matPav(flamme); }
/** Opacité d'un navire (1 : plein) : ses matériaux sont copiés le temps du fondu, puis rendus. */
function estomper(n, a) {
  if (a >= 1) { if (n.mats) { for (const [o, m] of n.mats) { o.material.dispose(); o.material = m; } n.mats = null; } return; }
  if (!n.mats) { n.mats = new Map(); n.g.traverse(o => { if (o.material) { n.mats.set(o, o.material); o.material = o.material.clone(); o.material.transparent = true; } }); }
  for (const [o] of n.mats) o.material.opacity = a;
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
    const compo = composition(f, epoque), ferle = !!bloc || aQuaiBloque, corsaire = f.ordre === 'corsaire';
    const cle = `${epoque}|${roy}|${compo.join(',')}|${troupes ? 1 : 0}|${ferle ? 1 : 0}|${palier}|${corsaire ? 1 : 0}`;
    let v = flottes.get(f.id);
    if (v?.anim && performance.now() > v.anim.t0 + v.anim.duree) v.anim = null;
    if (!v || v.cle !== cle) {
      if (v) v.navires.forEach(ote);
      const vieux = v;
      v = { cle, proprio: f.proprio, navires: compo.map((ty, i) => creerNavire(ty, epoque, roy, { ferle, troupes: troupes && (TRANSPORT.has(ty) || i === 0), palier, corsaire })), anim: vieux?.anim || null, cap: vieux?.cap, x: vieux?.x, z: vieux?.z, horizon: vieux?.horizon, parti: vieux?.parti };
      flottes.set(f.id, v);
    }
    v.case = f.case; v.ferle = ferle; v.couleur = roy; v.corsaire = corsaire; v.n = Object.values(f.navires || {}).reduce((s, n) => s + n, 0);
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
    if (!v.anim && !v.horizon) { v.x = x; v.z = z; v.cap = cap; }
    // vers un autre théâtre : la flotte gagne l'horizon et s'estompe (une fois), puis reste cachée tant qu'elle a cet ordre
    if (f.ordre === 'route' && !v.parti && !v.horizon) { const route = trajetHorizon(v.x ?? x, v.z ?? z, f.case, f.sortie, false, f.vers); v.horizon = { part: true, t0: performance.now(), duree: Math.min(12000, Math.max(5000, route.long / 1.2 * 1000)), route }; }
    if (f.ordre !== 'route' && (v.parti || v.horizon?.part || v.sortie)) { v.parti = v.sortie = false; v.horizon = null; v.navires.forEach(n => { estomper(n, 1); n.g.visible = true; }); }
    // commerce : la flûte (ou le vapeur) fait la navette entre le quai et le large
    const iNav = v.navires.findIndex(n => TRANSPORT.has(n.m.type));
    v.navette = (f.commerce || f.ordre === 'commerce') && port && !ferle && iNav >= 0 ? (v.navette?.cle === `${f.case}|${port.case}` ? v.navette : routeCommerce(f.case, port.case, iNav)) : null;
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
  majComptoirs(etat, epoque);
  majRoutesMer(etat, epoque);
  majSorties(etat);
}
function etiquettes() {
  for (const [id, v] of flottes) if (!v.parti && !v.sortie) etiquette('f' + id, `<div class="arm" style="--c:${v.couleur}">${v.corsaire ? '☠' : '⚓'} ${v.n}${v.effectif ? ` · 🛡 ${v.effectif}` : ''}</div>`, v.x, 0.75, v.z, { dy: -6, loin: 75 });
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
export function jouerMoisMarine(rapport, apres = E, duree = 2800) {
  if (!E) return;
  const mouvements = rapport.mouvements || [], combatsR = rapport.combats || [];
  const etapes = Math.max(1, ...mouvements.map(m => m.trajet.length - 1), ...combatsR.map(c => c.etape || 1));
  const t0 = performance.now(), epoque = E.epoque?.cle || 'ancien';
  // une flotte qui entre dans notre vue
  const entrante = (id, proprio) => {
    const f = apres.flottes?.find(x => x.id === id) || { id, proprio, navires: { corvette: 1 } };
    const roy = couleurDe(f.proprio), corsaire = f.ordre === 'corsaire';
    const v = { cle: '', proprio: f.proprio, couleur: roy, corsaire, n: Object.values(f.navires || {}).reduce((s, n) => s + n, 0) || 1, effectif: 0, navires: composition(f, epoque).map(ty => creerNavire(ty, epoque, roy, { corsaire })), repos: null, x: 0, z: 0, cap: 0 };
    flottes.set(id, v);
    return v;
  };
  for (const m of mouvements) {
    if (!m.flotte) continue;
    const pts = pointsMouvement(m);
    if (!pts) continue;
    const v = flottes.get(m.armee) || entrante(m.armee, m.proprio);
    v.anim = { ...pts, t0, duree: duree * Math.max(1, m.trajet.length - 1) / etapes };
    if (v.sortie) { v.sortie = false; v.navires.forEach(n => { n.g.visible = true; }); } // (sortie au mois précédent, elle revient)
    if (pts.entree) { v.cap = capX(pts.pts[1][0] - pts.pts[0][0], pts.pts[1][1] - pts.pts[0][1]); v.navires.forEach(n => estomper(n, 0)); }
    v.navette = null;
  }
  // arrivées d'un autre théâtre : de l'horizon à la case
  for (const a of rapport.arrivees || []) {
    const f = apres.flottes?.find(x => x.id === a.flotte), c = a.case ?? f?.case;
    if (c === undefined) continue;
    const v = flottes.get(a.flotte) || entrante(a.flotte, f?.proprio ?? 0), p = posCase(c);
    v.horizon = { part: false, t0, duree: Math.max(4500, duree * 1.6), route: trajetHorizon(p.x, p.z, c, a.sortie, true, a.vers) };
    v.parti = false; v.anim = null; v.navette = null; v.repos = v.repos || { x: p.x, z: p.z, cap: v.horizon.route.en(1e9).cap };
  }
  for (const a of rapport.abordages || []) abordageCorsaire(a.flotte, a.case, { proprio: a.proprio });
  for (const d of rapport.departs || []) departFlotte(d);
  if (rapport.arrivees?.length) etiquettes();
  // débarquement : l'armée part de la case de la flotte (une case d'eau) vers la terre
  for (const m of mouvements) if (!m.flotte && m.trajet.length > 1 && eau(m.trajet[0]) && !eau(m.trajet[1])) {
    const v = [...flottes].find(([, x]) => x.case === m.trajet[0] && x.proprio === m.proprio);
    if (v) scenes.push(sceneChaloupes(v[0], m.trajet[1], true, duree));
  }
  const combats = combatsR.filter(c => eau(c.case)).map(c => ({ ...c, t: t0 + duree * (c.etape || 1) / etapes - 150, fait: false }));
  const vivantes = new Set((apres.flottes || []).map(f => f.id));
  mois = { t0, combats, vivantes, visible: apres.visible || [] };
  setTimeout(() => { for (const [, v] of flottes) { if (v.anim?.entree) v.navires.forEach(n => estomper(n, 1)); v.anim = null; } }, duree + 400);
}
/** Le tracé d'un mouvement de flotte : { pts, cum (distances cumulées), long, sortie, entree } ; null s'il n'a aucune case dans la fenêtre.
 *  Une flotte sort de la fenêtre (m.sortie, ou un trajet qui finit par des cases hors fenêtre, négatives) : elle va jusqu'au bord, puis au-delà
 *  en s'estompant ; elle y entre (m.entree, ou un trajet qui commence hors fenêtre) : elle paraît au bord en fondu. La direction : m.sortie
 *  ou m.entree = [dx, dz] (vers où elle sort, d'où elle vient), sinon celle de son premier ou dernier pas, sinon le bord le plus proche. */
function pointsMouvement(m) {
  const cases = m.trajet.filter(c => c >= 0);
  if (!cases.length) return null;
  const pts = cases.map(c => { const q = posCase(c); return [q.x, q.z]; }), n = pts.length;
  const sortie = m.sortie || (m.trajet[m.trajet.length - 1] < 0 ? true : null), entree = m.entree || (m.trajet[0] < 0 ? true : null);
  const dir = (o, a, b, c) => (Array.isArray(o) ? unite(o) : a && (a[0] !== b[0] || a[1] !== b[1]) ? unite([b[0] - a[0], b[1] - a[1]]) : versLarge(c));
  /** Du point p au bord de la fenêtre dans la direction u (par pas d'au plus une case : la vitesse reste la même), puis au-delà. */
  const versBord = (p, u) => { const b = bord(p[0], p[1], u[0], u[1]), l = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.ceil(l / 1.7), q = []; for (let i = 1; i <= k; i++) q.push([p[0] + (b[0] - p[0]) * i / k, p[1] + (b[1] - p[1]) * i / k]); q.push([b[0] + u[0] * 1.4, b[1] + u[1] * 1.4]); return q; };
  if (sortie) pts.push(...versBord(pts[n - 1], dir(sortie, pts[n - 2], pts[n - 1], cases[cases.length - 1])));
  if (entree) pts.unshift(...versBord(pts[0], dir(entree, pts[1], pts[0], cases[0])).reverse());
  if (pts.length < 2) pts.push([...pts[0]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, long: cum[cum.length - 1], sortie: !!sortie, entree: !!entree };
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
  camps.a.forEach((n, i) => bordee(n, camps.d, i * 0.4, now));
  camps.d.forEach((n, i) => bordee(n, camps.a, 0.25 + i * 0.4, now));
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
/** Un navire lâche ses bordées (salves de tous les sabords du flanc tourné vers la cible), à partir de decal secondes. */
function bordee(n, cibles, decal, now, salves = 2) {
  if (!cibles.length) return;
  const cible = cibles[Math.random() * cibles.length | 0];
  const cap = n.g.rotation.y, versD = Math.sin(cap) * (cible.g.position.x - n.g.position.x) + Math.cos(cap) * (cible.g.position.z - n.g.position.z) > 0; // tribord (+z local) face à la cible ?
  const ports = n.m.ports[versD ? 'd' : 'g'].length ? n.m.ports[versD ? 'd' : 'g'] : [[0, n.m.T.H * 0.7, (versD ? 1 : -1) * (n.m.T.W / 2 + 0.2)]];
  for (let b = 0; b < salves; b++) ports.forEach((port, k) => tirs.push({ t: now + (decal + b * 1.6 + k * 0.07) * 1000, n, port, cible }));
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

// ------------------------------------------------------------------ vers un autre théâtre : sorties au bord de la mer, flottes qui gagnent l'horizon
/** Vers le large : direction (unité) du bord de carte le plus proche d'une case. */
function versLarge(c) {
  const { c: col, r } = posCase(c), d = [col, geo.l - 1 - col, r, geo.h - 1 - r];
  return [[-1, 0], [1, 0], [0, -1], [0, 1]][d.indexOf(Math.min(...d))];
}
const unite = ([x, z]) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
/** Vers le large par une sortie : sa direction (sorties[].vers = [dx, dz], donnée par le jeu), sinon le bord de carte le plus proche. */
function dirSortie(s) { const o = (E.sorties || []).find(x => x.case === s); return Array.isArray(o?.vers) ? unite(o.vers) : versLarge(s); }
/** La sortie à prendre depuis la case c : la plus proche ; avec vers (la direction du théâtre de destination), celle qui y mène le mieux,
 *  aucune (undefined) si aucune ne va de ce côté. */
function choisirSortie(c, vers) {
  const l = (E.sorties || []).map(o => o.case);
  if (!vers) return l.sort((a, b) => ecart(a, c) - ecart(b, c))[0];
  const [ux, uz] = unite(vers), cos = s => { const [a, b] = dirSortie(s); return a * ux + b * uz; };
  return l.filter(s => cos(s) > 0.3).sort((a, b) => cos(b) - ecart(b, c) * 0.02 - cos(a) + ecart(a, c) * 0.02)[0];
}
/** Le point où la demi-droite (x, z) + t (ux, uz) quitte la fenêtre bâtie. */
function bord(x, z, ux, uz) {
  const X = SQ3 * (geo.l - 0.5), Z = 1.5 * (geo.h - 1);
  let t = Infinity;
  if (ux > 1e-6) t = Math.min(t, (X - x) / ux); else if (ux < -1e-6) t = Math.min(t, -x / ux);
  if (uz > 1e-6) t = Math.min(t, (Z - z) / uz); else if (uz < -1e-6) t = Math.min(t, -z / uz);
  t = Number.isFinite(t) ? Math.max(0, t) : 0;
  return [x + ux * t, z + uz * t];
}
/** Le trajet entre un point (x, z) de la case c et l'horizon, par la sortie donnée, sinon celle qui va vers vers ([dx, dz]), sinon la plus
 *  proche ; sans sortie de ce côté, droit vers le bord de la fenêtre dans la direction vers ; arrive : dans l'autre sens. */
function trajetHorizon(x, z, c, sortie, arrive = false, vers = null) {
  const s = sortie ?? choisirSortie(c, vers);
  let pts;
  if (s === undefined && Array.isArray(vers)) { const [ux, uz] = unite(vers), [bx, bz] = bord(x, z, ux, uz); pts = [[x, z], [bx + ux * 0.01, bz + uz * 0.01], [bx + ux * 4.5, bz + uz * 4.5]]; }
  else { const p = s !== undefined ? posCase(s) : { x, z }, [ux, uz] = s !== undefined ? dirSortie(s) : versLarge(c); pts = [[x, z], [p.x + ux * 0.01, p.z + uz * 0.01], [p.x + ux * 4.5, p.z + uz * 4.5]]; }
  return cheminLisse(arrive ? pts.reverse() : pts);
}
/** Une file de navires sur un trajet d'horizon, à la fraction k du trajet ; part : en fondu sortant (sinon entrant). Rend le point de tête. */
function poseHorizon(navires, route, k, part, t, dt) {
  const p = route.en(k * route.long), a = part ? 1 - lisse(0.45, 1, k) : lisse(0, 0.45, k), co = Math.cos(p.cap), si = Math.sin(p.cap), file = FILE[Math.min(3, navires.length) - 1] || FILE[0];
  navires.forEach((n, i) => { if (n.pilote) return; const [ox, oz] = file[i] || [0, 0]; poser(n, p.x + ox * co + oz * si, p.z - ox * si + oz * co, p.cap, t, dt, { vitesse: 0.3 }); estomper(n, a); });
  return p;
}
let nDeparts = 0;
/** Le départ d'une flotte vers un autre théâtre, que le jeu ne suit plus (elle n'est pas dans etat.flottes) : elle part de sa case, gagne
 *  la balise (sortie, sinon celle qui va vers vers = [dx, dz], sinon la plus proche ; sans balise de ce côté, droit vers le bord), s'éloigne
 *  vers l'horizon et s'efface. navires : { type: nombre } ; armee : effectif embarqué (étiquette). Rend la durée de la scène (ms), 0 si rien. */
export function departFlotte({ case: c, proprio = 0, navires = { corvette: 1 }, sortie, vers, armee = 0, epoque } = {}) {
  if (!E || !(c >= 0)) return 0;
  const ep = epoque || E.epoque?.cle || 'ancien', roy = couleurDe(proprio), p = posCase(c), id = 'md' + nDeparts++ + '|';
  const liste = composition({ navires }, ep).map((ty, i) => creerNavire(ty, ep, roy, { troupes: !!armee && (TRANSPORT.has(ty) || i === 0), palier: palierRoy(proprio) }));
  const route = trajetHorizon(p.x, p.z, c, sortie, false, vers), t0 = performance.now(), duree = Math.min(12000, Math.max(5000, route.long / 1.2 * 1000));
  const nb = Object.values(navires).reduce((a, b) => a + b, 0) || 1;
  etiquette(id, `<div class="arm" style="--c:${roy}">⚓ ${nb}${armee ? ` · 🛡 ${armee}` : ''}</div>`, p.x, 0.75, p.z, { dy: -6, loin: 75 });
  scenes.push({
    maj(now, dt, t) {
      const k = Math.min(1, (now - t0) / duree), q = poseHorizon(liste, route, k, true, t, dt);
      deplacer(id, q.x, 0.75, q.z);
      if (k < 1) return true;
      for (const n of liste) { estomper(n, 1); ote(n); }
      balayer(id); balayer(id); // (deux passes : la première ne fait que marquer)
      return false;
    },
  });
  return duree;
}
// une flèche de trois chevrons posés sur l'eau, qui s'allument tour à tour (sorties, vent de la bataille)
const CHEVRON = (() => { const s = new THREE.Shape(); s.moveTo(-0.12, -0.17); s.lineTo(0.04, 0); s.lineTo(-0.12, 0.17); s.lineTo(-0.03, 0.17); s.lineTo(0.13, 0); s.lineTo(-0.03, -0.17); s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); })();
function fleche(x, z, ux, uz, couleur = 0xffd34d) {
  const g = new THREE.Group();
  g.position.set(x, MER + 0.014, z); g.rotation.y = capX(ux, uz);
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(CHEVRON, new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false })); m.position.x = k * 0.24; m.renderOrder = 2; g.add(m); }
  groupe.add(g);
  return g;
}
const animerFleche = (g, t) => g.children.forEach((m, k) => { m.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 - k * 0.9)); });
const jeterFleche = g => { groupe.remove(g); g.children.forEach(m => m.material.dispose()); };
// la balise d'horizon : bouée jaune et noire, perche et voyant (deux cônes)
const BALISE = (() => {
  const L = lot();
  put(L, cyl(0.55, 0.7, 0.9, 10), 0xf2c230, 0, 0.1, 0, 0, 0.08); put(L, cyl(0.57, 0.6, 0.3, 10), NOIR, 0, 0.35, 0, 0, 0);
  put(L, cyl(0.07, 0.07, 3.2, 6), 0x2b2d31, 0, 2.1, 0, 0, 0.06);
  put(L, new THREE.ConeGeometry(0.4, 0.55, 8), NOIR, 0, 3.95, 0, 0, 0.06); put(L, new THREE.ConeGeometry(0.4, 0.55, 8).rotateX(Math.PI), NOIR, 0, 3.3, 0, 0, 0.06);
  return { g: fusion(L.g), o: fusion(L.o) };
})();
let sorties = [], cleSorties = '';
function majSorties(etat) {
  const cle = JSON.stringify(etat.sorties || []);
  if (cle !== cleSorties) {
    cleSorties = cle;
    for (const s of sorties) { groupe.remove(s.balise); jeterFleche(s.fleche); }
    sorties = (etat.sorties || []).map(o => {
      const p = posCase(o.case), [ux, uz] = dirSortie(o.case), balise = new THREE.Group();
      balise.add(new THREE.Mesh(BALISE.g, MAT), new THREE.Mesh(BALISE.o, CONT)); balise.scale.setScalar(ECH_NAV);
      balise.position.set(p.x - uz * 0.35, MER, p.z + ux * 0.35); groupe.add(balise);
      return { ...o, x: p.x, z: p.z, balise, fleche: fleche(p.x + ux * 0.2, p.z + uz * 0.2, ux, uz), ph: Math.random() * 6 };
    });
  }
  sorties.forEach((s, i) => { const [ux, uz] = dirSortie(s.case); etiquette('ms' + i, `<div class="arm" style="--c:#8a6514">⛵ ${echapper(s.nom || 'vers le large')} ➜</div>`, s.x - ux * 0.6, 0.42, s.z - uz * 0.6, { loin: 90 }); }); // (un peu en deçà du bord : lisible même caméra au bord)
  balayer('ms');
}

// ------------------------------------------------------------------ comptoirs en mer : ponton, caisses de la denrée, bouée et pavillon, ancre ; marchands mouillés et chaloupes
const DENREES = {
  sucre: [0xf6f2e8, 'Sucre'], tabac: [0xc8953f, 'Tabac'], cafe: [0x4a2a18, 'Café'], coton: [0xc9d6e8, 'Coton'], the: [0x5c9a44, 'Thé'],
  epices: [0xd8572a, 'Épices'], indigo: [0x3a3fa8, 'Indigo'], ivoire: [0xe6d8a8, 'Ivoire'], fourrures: [0x7a5034, 'Fourrures'],
};
const cacheCpt = new Map();
/** Le ponton d'un comptoir (unités du navire) : planches, caisses aux couleurs de la denrée cerclées de bois, ancre posée contre le bord. */
function modeleComptoir(denree) {
  let r = cacheCpt.get(denree);
  if (r) return r;
  const L = lot(), col = (DENREES[denree] || [0xb08a5a])[0], bois = 0x7a5130, fer = 0x3a3c42;
  put(L, boite(5.0, 0.45, 3.4), 0xb3a284, 0, 0, 0, 0, 0.1); // bois gris délavé : les caisses brunes (tabac, café, fourrures) s'en détachent
  for (let x = -2.1; x <= 2.2; x += 0.7) put(L, boite(0.06, 0.03, 3.4), 0x7d6d55, x, 0.24, 0, 0, 0); // joints des planches
  for (const [x, z] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) put(L, cyl(0.16, 0.16, 1.2, 6), bois, x, 0.3, z, 0, 0.06); // pieux d'amarrage
  [[-1.3, -0.6, 0], [-0.4, -0.6, 0], [-1.3, 0.35, 0], [0.5, -0.6, 0], [-0.85, -0.1, 1], [0.05, -0.6, 1], [1.5, 0.7, 0]].forEach(([x, z, e], k) => {
    const s = 0.8 - (k % 3) * 0.06;
    put(L, boite(s, s, s), col, x, 0.23 + s / 2 + e * 0.8, z, k * 0.3, 0.07);
    put(L, boite(s * 1.04, 0.1, s * 1.04), bois, x, 0.23 + s * 0.2 + e * 0.8, z, k * 0.3, 0); put(L, boite(s * 1.04, 0.1, s * 1.04), bois, x, 0.23 + s * 0.8 + e * 0.8, z, k * 0.3, 0);
  });
  // l'ancre, debout contre le bord avant : verge, jas, bras et anneau
  const ax = 1.6, az = -1.25;
  put(L, boite(0.18, 2.0, 0.18), fer, ax, 1.2, az, 0, 0.06); put(L, boite(0.14, 0.14, 1.3), bois, ax, 2.05, az, 0, 0.05);
  for (const s of [1, -1]) { const b = boite(1.0, 0.18, 0.18); b.rotateZ(s * 0.55); put(L, b, fer, ax + s * 0.4, 0.45, az, 0, 0.06); put(L, boite(0.18, 0.4, 0.3), fer, ax + s * 0.82, 0.72, az, 0, 0.05); }
  put(L, new THREE.TorusGeometry(0.22, 0.06, 5, 10), fer, ax, 2.35, az, 0, 0);
  r = { g: fusion(L.g), o: fusion(L.o) };
  for (const g of [...L.g, ...L.o]) g.dispose();
  cacheCpt.set(denree, r);
  return r;
}
// la bouée du comptoir : flotteur rouge et blanc, mât et pavillon (posé à part : il change de couleurs)
const BOUEE = (() => { const L = lot(); put(L, cyl(0.5, 0.62, 0.8, 10), 0xd9322a, 0, 0.1, 0, 0, 0.08); put(L, cyl(0.52, 0.55, 0.26, 10), 0xf6f2ea, 0, 0.3, 0, 0, 0); put(L, cyl(0.07, 0.07, 3.4, 6), 0x5b3a1e, 0, 2.0, 0, 0, 0.05); return { g: fusion(L.g), o: fusion(L.o) }; })();
const LIBRE = '#f4f1ea', comptoirs = new Map(); // id → { cle, groupe, ponton, bouee, pav, navires, chaloupes, cols, … }
function majComptoirs(etat, epoque) {
  const vus = new Set();
  for (const c of etat.comptoirs || []) {
    vus.add(c.id);
    const proprios = (c.navires || []).slice(0, 3).map(n => n.proprio), dispute = !!c.dispute;
    const cle = `${c.case}|${c.denree}|${epoque}|${proprios.map(couleurDe).join(',')}|${dispute ? c.dispute : ''}`;
    let w = comptoirs.get(c.id);
    if (w?.cle === cle) continue;
    if (w) jeterComptoir(w);
    const p = posCase(c.case), a0 = hache(c.case, 7) * 6.28, m = modeleComptoir(c.denree);
    const ponton = new THREE.Group(); ponton.add(new THREE.Mesh(m.g, MAT), new THREE.Mesh(m.o, CONT));
    ponton.scale.setScalar(ECH_NAV); ponton.position.set(p.x, MER + 0.01, p.z); ponton.rotation.y = a0; groupe.add(ponton);
    const bouee = new THREE.Group(); bouee.add(new THREE.Mesh(BOUEE.g, MAT), new THREE.Mesh(BOUEE.o, CONT)); bouee.scale.setScalar(ECH_NAV);
    bouee.position.set(p.x + Math.cos(a0 + 2.2) * 0.33, MER, p.z - Math.sin(a0 + 2.2) * 0.33); groupe.add(bouee);
    // couleurs du pavillon : le camp qui occupe, ceux qui se disputent (et le camp qui conteste), sinon blanc
    const cols = [...new Set([...proprios, ...(typeof c.dispute === 'number' ? [c.dispute] : [])].map(couleurDe))];
    const pav = drapeau(bouee, cols[0] || LIBRE, 0.04, 3.1, 0, 2.0, 1.3, 0);
    const navires = proprios.map((pr, k) => {
      const a = a0 + 0.9 + k * 2.09, n = creerNavire('flute', epoque, couleurDe(pr), { ferle: true });
      n.place = { x: p.x + Math.cos(a) * 0.6, z: p.z + Math.sin(a) * 0.6, cap: -(a + Math.PI / 2) };
      return n;
    });
    const chaloupes = navires.map((n, k) => ({ ...chaloupe(couleurDe(proprios[k]), palierRoy(proprios[k])), n, t0: k * 2.3 }));
    // l'étiquette : la denrée (pastille de sa couleur), libre, occupé (places prises sur 3) ou disputé
    const [col, nom] = DENREES[c.denree] || [0xb08a5a, c.denree];
    const fond = dispute ? '#b3261e' : proprios.length ? couleurDe(proprios[0]) : '#6b6455';
    const html = `<div class="arm" style="--c:${fond}"><i style="display:inline-block;width:8px;height:8px;margin-right:4px;border:1.5px solid #24180f;border-radius:2px;background:#${col.toString(16).padStart(6, '0')}"></i>${echapper(nom)} · ${dispute ? '⚔ disputé' : proprios.length ? `⚓ ${proprios.length}/3` : 'libre'}</div>`;
    comptoirs.set(c.id, { cle, p, html, ponton, bouee, pav, navires, chaloupes, cols: cols.length ? cols : [LIBRE], dispute, ph: Math.random() * 6 });
  }
  for (const [id, w] of comptoirs) if (!vus.has(id)) { jeterComptoir(w); comptoirs.delete(id); }
  for (const [id, w] of comptoirs) etiquette('mc' + id, w.html, w.p.x, 0.5, w.p.z, { loin: 75 });
  balayer('mc');
}
function jeterComptoir(w) { groupe.remove(w.ponton, w.bouee); w.navires.forEach(ote); w.chaloupes.forEach(c => groupe.remove(c.g)); }

// ------------------------------------------------------------------ routes commerciales : ruban pointillé sur l'eau (animé ; arrêté et rouge si coupée), flûte qui le parcourt
// La largeur du ruban suit le zoom (à peu près constante à l'écran, bornée : RUBAN) : le tampon garde l'axe du tracé et, par sommet, le côté
// où l'écarter (attribut cote), que le nuanceur multiplie par la largeur du moment ; de loin, un liseré sombre continu le détache de la mer.
function texPointilles() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = '#24180f'; g.fillRect(0, 0, 19, 8); g.fillStyle = '#fff'; g.fillRect(2, 2, 15, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX_RTE = [texPointilles(), texPointilles()]; // pointillés qui défilent, pointillés arrêtés
const RUBAN = { min: 0.075, max: 0.42, k: 0.0085 }; // largeur = cam.d × k, bornée (0,075 de tout près, comme avant)
const U_LARG = { value: RUBAN.min }, U_LISERE = { value: 0 };
/** Le matériau écarte chaque sommet de l'axe du ruban de cote × la largeur du moment (uniforme partagé) ; les pointillés gardent leurs proportions. */
const elargi = (m, larg) => { m.onBeforeCompile = s => { s.uniforms.uLarg = larg; s.vertexShader = 'attribute vec2 cote;\nuniform float uLarg;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz += cote * uLarg;')
  .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x *= ${RUBAN.min} / uLarg;\n#endif`); }; return m; }; // (les pointillés s'allongent avec le ruban)
const M_LISERE = elargi(new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), U_LISERE);
const matsRte = new Map();
function matRoute(col, coupee) {
  const k = col + (coupee ? '|c' : '');
  let m = matsRte.get(k);
  if (!m) { m = elargi(new THREE.MeshBasicMaterial({ color: col, map: TEX_RTE[coupee ? 1 : 0], transparent: true, depthWrite: false, side: THREE.DoubleSide }), U_LARG); matsRte.set(k, m); }
  return m;
}
/** Un ruban à fleur d'eau le long d'un tracé lissé (axe et côtés : la largeur est donnée par le matériau) ; u (texture) compte la
 *  distance parcourue, pour les pointillés. */
function rubanPointille(R) {
  const n = Math.max(2, Math.ceil(R.long / 0.08) + 1), P = [], C = [], U = [], I = [];
  for (let k = 0; k < n; k++) {
    const sd = R.long * k / (n - 1), p = R.en(sd), px = Math.sin(p.cap) / 2, pz = Math.cos(p.cap) / 2;
    P.push(p.x, MER + 0.012, p.z, p.x, MER + 0.012, p.z); C.push(px, pz, -px, -pz); U.push(sd / 0.24, 0, sd / 0.24, 1);
    if (k) I.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('cote', new THREE.Float32BufferAttribute(C, 2)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(R.en(R.long / 2).x, MER, R.en(R.long / 2).z), R.long / 2 + 1); // (l'axe seul sous-estimerait le ruban élargi)
  return g;
}
const routesMer = new Map(); // id → { cle, mesh, lisere, navire, nav, mi, coupee }
function majRoutesMer(etat, epoque) {
  const liste = etat.routes_mer || (etat.routes || []).filter(r => r && r.chemin); // (etat.routes : aussi les routes de terre, des tableaux)
  const vus = new Set();
  for (const r of liste) {
    if (!(r.chemin?.length >= 2)) continue;
    vus.add(r.id);
    const col = couleurDe(r.proprio), cle = `${r.chemin.join(',')}|${col}|${r.coupee ? 1 : 0}|${epoque}`;
    let w = routesMer.get(r.id);
    if (w?.cle === cle) continue;
    if (w) jeterRoute(w);
    const R = cheminLisse(r.chemin.map(c => { const q = posCase(c); return [q.x, q.z]; })), geo = rubanPointille(R);
    const mesh = new THREE.Mesh(geo, matRoute(r.coupee ? '#d0302a' : col, r.coupee)), lisere = new THREE.Mesh(geo, M_LISERE);
    mesh.renderOrder = 2; lisere.renderOrder = 1; groupe.add(lisere, mesh);
    const navire = r.coupee ? null : creerNavire('flute', epoque, col, {});
    w = { cle, mesh, lisere, navire, nav: navire && { route: R, t0: hache(r.id, 3) * 30 }, mi: R.en(R.long / 2), coupee: !!r.coupee };
    routesMer.set(r.id, w);
  }
  for (const [id, w] of routesMer) if (!vus.has(id)) { jeterRoute(w); routesMer.delete(id); }
  for (const [id, w] of routesMer) if (w.coupee) etiquette('mr' + id, '<div class="arm" style="--c:#b3261e">✂ route coupée</div>', w.mi.x, 0.3, w.mi.z, { loin: 75 });
  balayer('mr');
}
const jeterRoute = w => { groupe.remove(w.mesh, w.lisere); w.mesh.geometry.dispose(); if (w.navire) ote(w.navire); };

// commerce et horizon, à chaque image : pointillés, flûtes des routes, comptoirs (bouée, mouillage, chaloupes, escarmouches), sorties
function imageCommerce(now, dt, t) {
  TEX_RTE[0].offset.x = -t * 0.8;
  // le ruban garde à peu près sa largeur à l'écran ; de loin, son liseré sombre se montre (de près, rien ne change)
  U_LARG.value = Math.min(RUBAN.max, Math.max(RUBAN.min, cam.d * RUBAN.k)); U_LISERE.value = U_LARG.value * 1.55; M_LISERE.opacity = 0.5 * lisse(12, 34, cam.d); M_LISERE.visible = M_LISERE.opacity > 0.01;
  for (const [, w] of routesMer) if (w.navire && !w.navire.pilote) { const p = poseNavette(w.nav, t); poser(w.navire, p.x, p.z, p.cap, t, dt, { vitesse: p.vit }); }
  for (const s of sorties) { animerFleche(s.fleche, t); s.balise.position.y = MER + Math.sin(t * 1.5 + s.ph) * 0.008; s.balise.rotation.z = Math.sin(t * 1.2 + s.ph) * 0.07; }
  for (const [, w] of comptoirs) {
    w.bouee.position.y = MER + Math.sin(t * 1.7 + w.ph) * 0.008; w.bouee.rotation.set(Math.sin(t * 1.3 + w.ph) * 0.08, 0, Math.cos(t * 1.1 + w.ph) * 0.08);
    w.ponton.position.y = MER + 0.01 + Math.sin(t * 1.1 + w.ph) * 0.003;
    if (w.cols.length > 1) w.pav.material = matPav(w.cols[Math.floor(t / 1.2) % w.cols.length]);
    for (const n of w.navires) if (!n.pilote) poser(n, n.place.x, n.place.z, n.place.cap + Math.sin(t * 0.12 + n.ph) * 0.05, t, dt, { mouille: true });
    // chaloupes : du flanc du marchand au bord du ponton, chargées à l'aller, à vide au retour
    for (const c of w.chaloupes) {
      const A = c.n.place, B = w.p, ax = A.x + (B.x - A.x) * 0.2, az = A.z + (B.z - A.z) * 0.2, bx = A.x + (B.x - A.x) * 0.6, bz = A.z + (B.z - A.z) * 0.6;
      const u = (t + c.t0) % 7, f = u < 3 ? lisse(0, 3, u) : u < 3.5 ? 1 : u < 6.5 ? 1 - lisse(3.5, 6.5, u) : 0, x = ax + (bx - ax) * f, z = az + (bz - az) * f;
      c.g.visible = !c.n.pilote; c.pass.visible = u < 3.25;
      c.g.position.set(x, MER + 0.004 + Math.sin(t * 2 + c.ph) * 0.004, z);
      c.g.rotation.set(Math.sin(t * 3 + c.ph) * 0.06, capX(bx - ax, bz - az) + (u < 3.25 ? 0 : Math.PI), Math.sin(t * 2.4) * 0.05);
      if (c.g.visible && f > 0.05 && f < 0.95 && Math.random() < dt * 3) ecume(x, z, 0.22, 1);
    }
    if (w.dispute && w.navires.length && Math.random() < dt * 0.7) { // escarmouche entre marchands rivaux
      const n = w.navires[Math.random() * w.navires.length | 0], p = versMonde(n.corps, 0, n.m.T.H * 0.7, n.m.T.W / 2 + 0.2);
      eclat(p); bouffee(p.x, p.y, p.z, 'poudre', 0.8);
      setTimeout(() => gerbe(w.p.x + (Math.random() - 0.5) * 0.9, w.p.z + (Math.random() - 0.5) * 0.9, 0.6), 260);
    }
  }
}

// ------------------------------------------------------------------ abordage : grappins (cordes entre les flancs qui se font face) et fusillade
const flanc = (A, B) => Math.sign(Math.sin(A.g.rotation.y) * (B.g.position.x - A.g.position.x) + Math.cos(A.g.rotation.y) * (B.g.position.z - A.g.position.z)) || 1;
function cordage(paires) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(paires * 18), 3)); g.setDrawRange(0, 0);
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe0c890 }));
  l.frustumCulled = false; groupe.add(l);
  return l;
}
/** Trois grappins de A vers B, écrits dans le tampon à partir du sommet k ; rend le sommet suivant. */
function grappins(pos, k, A, B) {
  const sA = flanc(A, B), sB = flanc(B, A);
  for (const x of [-1.4, 0, 1.4]) {
    const a = versMonde(A.corps, x, A.m.T.H + 0.5, sA * A.m.T.W / 2), b = versMonde(B.corps, x * 0.8, B.m.T.H + 0.3, sB * B.m.T.W / 2);
    pos.setXYZ(k++, a.x, a.y, a.z); pos.setXYZ(k++, b.x, b.y, b.z);
  }
  return k;
}
function fusillade(A, B, dt) {
  if (Math.random() > dt * 7) return;
  const f = Math.random(), a = A.g.position, b = B.g.position, x = a.x + (b.x - a.x) * f + (Math.random() - 0.5) * 0.25, z = a.z + (b.z - a.z) * f + (Math.random() - 0.5) * 0.06;
  bouffee(x, MER + 0.09, z, 'poudre', 0.45); eclat({ x, y: MER + 0.09, z });
}
const fermer = l => { groupe.remove(l); l.geometry.dispose(); l.material.dispose(); };

/** Un corsaire fond sur un marchand : il le rattrape, tire un coup de semonce, jette ses grappins (fusillade, fumée), et le marchand
 *  hisse ses couleurs ; puis le corsaire rentre (le marchand de passage le suit et s'efface, un autre regagne sa place). */
export function abordageCorsaire(flotteId, caseMarchand, { proprio, duree = 9000 } = {}) {
  const v = flottes.get(flotteId);
  if (!E || !v || v.parti || !v.navires.length || v.navires[0].pilote) return 0;
  const C = v.navires[0], p = posCase(caseMarchand);
  let M = null, temporaire = false;
  for (const [, w] of flottes) if (!M && w !== v && !w.parti && w.case === caseMarchand && w.proprio !== v.proprio) M = w.navires.find(n => !n.pilote) || null;
  for (const [, w] of comptoirs) if (!M && Math.hypot(w.p.x - p.x, w.p.z - p.z) < 0.5) M = w.navires.find(n => !n.pilote) || null;
  if (!M) {
    M = creerNavire('flute', E.epoque?.cle || 'ancien', couleurDe(proprio ?? 99), {}); temporaire = true;
    M.g.position.set(p.x, MER, p.z); M.g.rotation.y = hache(caseMarchand, 3) * 6.28;
  }
  C.pilote = M.pilote = true;
  const t0 = performance.now(), D = Math.max(6, duree / 1000), K = D / 9, cordes = cordage(1), fait = {}; // (K : les temps de la scène, donnés pour 9 s)
  const c0 = C.g.position.lengthSq() ? { x: C.g.position.x, z: C.g.position.z } : { x: v.x, z: v.z }, m0 = { x: M.g.position.x, z: M.g.position.z, cap: M.g.rotation.y };
  let sc = C.g.rotation.y, mx = m0.x, mz = m0.z;
  const cote = Math.sign(Math.sin(m0.cap) * (camera.position.x - m0.x) + Math.cos(m0.cap) * (camera.position.z - m0.z)) || 1;
  scenes.push({
    maj(now, dt, t) {
      const ut = (now - t0) / 1000, u = ut / K;
      if (ut > D) { C.pilote = M.pilote = false; fermer(cordes); if (temporaire) { estomper(M, 1); ote(M); } return false; }
      // le marchand fuit droit devant, puis est saisi ; le corsaire vient se ranger le long de son flanc, du côté de la caméra
      const fuite = 0.07 * Math.min(u, 4), fx = m0.x + Math.cos(m0.cap) * fuite, fz = m0.z - Math.sin(m0.cap) * fuite;
      const bx = fx + Math.sin(m0.cap) * 0.3 * cote, bz = fz + Math.cos(m0.cap) * 0.3 * cote, retour = lisse(6.8, 9 - 0.3 / K, u), a = lisse(0, 4, u);
      const cx = c0.x + (bx - c0.x) * a + (c0.x - bx) * retour, cz = c0.z + (bz - c0.z) * a + (c0.z - bz) * retour;
      const dx = cx - C.g.position.x, dz = cz - C.g.position.z, vit = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      const voulu = u > 4 && u < 6.8 ? m0.cap : vit > 0.04 ? capX(dx, dz) : sc;
      sc += Math.atan2(Math.sin(voulu - sc), Math.cos(voulu - sc)) * Math.min(1, dt * 3);
      poser(C, cx, cz, sc, t, dt, { vitesse: vit > 0.04 ? 0.3 : 0 });
      // pris : le marchand de passage suit le corsaire ; un autre regagne sa place
      if (temporaire && u > 6.8) { const k = Math.min(1, dt * 1.5); mx += (cx - Math.cos(sc) * 0.55 - mx) * k; mz += (cz + Math.sin(sc) * 0.55 - mz) * k; }
      else { mx = fx + (m0.x - fx) * retour; mz = fz + (m0.z - fz) * retour; }
      poser(M, mx, mz, temporaire && u > 6.8 ? sc : m0.cap, t, dt, { vitesse: u < 4 || (temporaire && u > 6.8) ? 0.3 : 0 });
      if (temporaire) estomper(M, 1 - lisse(D - 1.6, D - 0.2, ut));
      if (u > 2.6 && !fait.semonce) { // coup de semonce, par l'avant
        fait.semonce = true; const q = versMonde(C.corps, C.m.T.L / 2 - 0.3, C.m.T.H + 0.3, 0);
        eclat(q, 1.5); bouffee(q.x, q.y, q.z, 'poudre', 1.1); setTimeout(() => gerbe(fx + Math.cos(m0.cap) * 0.45, fz - Math.sin(m0.cap) * 0.45), 300);
      }
      const accroche = u > 4 && u < 6.8;
      cordes.geometry.setDrawRange(0, accroche ? grappins(cordes.geometry.attributes.position, 0, C, M) : 0);
      cordes.geometry.attributes.position.needsUpdate = true;
      if (accroche) fusillade(C, M, dt);
      if (u > 4 && !fait.cri) { fait.cri = true; effet(bx, 0.55, bz, '⚔️', 1600); }
      if (u > 6 && !fait.prise) { fait.prise = true; hisser(M, v.couleur); } // pris : les couleurs du camp du corsaire
      return true;
    },
  });
  return D * 1000;
}

// ------------------------------------------------------------------ bataille navale pilotée par phases : deux lignes (4 navires montrés au plus par camp)
let navale = null; // { cle, x, z, phase, t0, salve, k, cordes, fleche, camps: [{ proprio, roy, s, navires, total, reste }] }
export function sceneNavale(o) {
  if (!o) { finNavale(); return; }
  const epoque = o.epoque || E?.epoque?.cle || 'ancien', now = performance.now();
  const cle = `${o.case}|${epoque}|${o.camps.map(c => `${c.proprio}:${JSON.stringify(c.navires)}`).join(';')}`;
  if (navale?.cle !== cle) {
    finNavale();
    const p = posCase(o.case);
    navale = { cle, x: p.x, z: p.z, phase: null, cordes: cordage(4), fleche: null, camps: o.camps.slice(0, 2).map((c, k) => {
      const roy = couleurDe(c.proprio), s = k ? -1 : 1, liste = [];
      for (const [u, n] of Object.entries(c.navires || {}).sort((a, b) => (RANG[a[0]] ?? 9) - (RANG[b[0]] ?? 9))) for (let j = 0; j < n && liste.length < 4; j++) liste.push(modeleDe(u, epoque));
      const navires = liste.map((ty, i) => Object.assign(creerNavire(ty, epoque, roy, {}), { i, x: p.x + (i - (liste.length - 1) / 2) * 0.62 - 0.5, z: p.z + s * 1.6, cap: capX(1, -s * 0.45) }));
      return { proprio: c.proprio, roy, s, navires, total: Object.values(c.navires || {}).reduce((a, b) => a + b, 0), reste: 0 };
    }) };
  }
  const N = navale;
  if (o.phase !== N.phase) { N.phase = o.phase; N.t0 = now; N.salve = now + 900; N.k = 0; }
  // coulés et pris : une part des navires montrés, au prorata (au moins un dès qu'il y en a) ; les pris hissent les couleurs du vainqueur
  N.camps.forEach((c, k) => {
    const part = v => (v > 0 ? Math.min(c.navires.length, Math.max(1, Math.round(v * c.navires.length / Math.max(1, c.total)))) : 0);
    let nc = c.navires.filter(n => n.coule).length, np = c.navires.filter(n => n.pris).length;
    for (let i = c.navires.length - 1; i >= 0 && nc < part(o.coules?.[k] || 0); i--) {
      const n = c.navires[i]; if (n.coule || n.pris) continue;
      n.coule = true; nc++;
      mourants.push({ n, f: feu(n.corps, -0.5, n.m.T.H, 0, 6), x0: n.x, z0: n.z, x: n.x, z: n.z, cap: n.cap, t0: now + 900 + nc * 400 });
    }
    for (let i = 0; i < c.navires.length && np < part(o.pris?.[k] || 0); i++) { const n = c.navires[i]; if (n.coule || n.pris) continue; n.pris = true; np++; hisser(n, N.camps[1 - k]?.roy ?? NOIR); }
    c.reste = Math.max(0, c.total - (o.coules?.[k] || 0) - (o.pris?.[k] || 0));
  });
  // le vent : une flèche sur l'eau, du camp qui a le vent vers l'autre
  if (N.fleche) { jeterFleche(N.fleche); N.fleche = null; }
  if (N.camps[o.vent]) { const s = N.camps[o.vent].s; N.fleche = fleche(N.x + 1.75, N.z + s * 0.3, 0, -s, 0xeef7ff); }
  N.camps.forEach((c, k) => etiquette('mn' + k, `<div class="arm" style="--c:${c.roy}">⚓ ${c.reste}${o.vent === k ? ' · 🌬 au vent' : ''}</div>`, N.x - 1.5, 0.4, N.z + c.s * 0.5, { loin: 90 }));
  balayer('mn');
}
function finNavale() {
  if (!navale) return;
  for (const c of navale.camps) for (const n of c.navires) if (!n.coule) ote(n);
  fermer(navale.cordes);
  if (navale.fleche) jeterFleche(navale.fleche);
  navale = null;
  balayer('mn'); balayer('mn'); // (deux passes : la première ne fait que marquer les étiquettes revues)
}
function imageNavale(now, dt, t) {
  const N = navale;
  if (!N) return;
  const u = (now - N.t0) / 1000, [A, B] = N.camps, k = Math.min(1, dt * 1.4), paires = Math.min(A.navires.length, B?.navires.length || 0);
  for (const c of N.camps) {
    let zs = 0, nz = 0;
    for (const n of c.navires) {
      if (n.coule) continue;
      const s = c.s, xi = N.x + (n.i - (c.navires.length - 1) / 2) * 0.62;
      let tx = xi, tz, tc = 0, vit = 0.12;
      if (N.phase === 'approche') { tz = N.z + s * (1.6 - 1.05 * lisse(0, 6, u)); tc = capX(1, -s * 0.45 * (1 - lisse(3, 7, u))); tx = xi - 0.5 + 0.5 * lisse(0, 7, u); vit = 0.3; }
      else if (N.phase === 'bordees') { tz = N.z + s * 0.42; tx = xi + Math.sin(u * 0.3) * 0.05; }
      else if (N.phase === 'abordage') { const p = n.i < paires; tz = N.z + s * (p ? 0.14 : 0.55); if (p) tx = N.x + (n.i - (A.navires.length - 1) / 2) * 0.62; vit = 0.04; }
      else { tz = N.z + (n.pris ? -s * 1.35 : s * 0.8); vit = 0.2; }
      n.x += (tx - n.x) * k; n.z += (tz - n.z) * k; n.cap += Math.atan2(Math.sin(tc - n.cap), Math.cos(tc - n.cap)) * k;
      poser(n, n.x, n.z, n.cap, t, dt, { vitesse: vit, roulis: N.phase === 'bordees' ? s * 0.03 : 0 });
      zs += n.z; nz++;
    }
    if (nz) deplacer('mn' + N.camps.indexOf(c), N.x - 1.5, 0.4, zs / nz);
  }
  const vifs = c => c.navires.filter(n => !n.coule);
  // bordées : chaque camp à son tour
  if (N.phase === 'bordees' && B && now > N.salve) {
    const tire = N.camps[N.k % 2], cibles = vifs(N.camps[1 - N.k % 2]);
    vifs(tire).forEach((n, i) => bordee(n, cibles, i * 0.22, now, 1));
    N.k++; N.salve = now + 1700;
  }
  // abordage : grappins et fusillade entre les navires appariés
  let kv = 0;
  if (N.phase === 'abordage' && u > 1.6) for (let i = 0; i < paires; i++) {
    const a = A.navires[i], b = B.navires[i];
    if (a.coule || b.coule) continue;
    kv = grappins(N.cordes.geometry.attributes.position, kv, a, b); fusillade(a, b, dt);
  }
  N.cordes.geometry.setDrawRange(0, kv); N.cordes.geometry.attributes.position.needsUpdate = true;
  if (N.fleche) animerFleche(N.fleche, t);
}

// ------------------------------------------------------------------ chaque image
chaqueImage((dt, t) => {
  const now = performance.now();
  if (mois) for (const c of mois.combats) if (!c.fait && now >= c.t) { c.fait = true; bataille(c); }
  majTirs(now);
  for (const [id, v] of flottes) {
    if (v.parti || v.sortie) { for (const n of v.navires) n.g.visible = false; continue; }
    if (v.horizon) { // vers l'horizon (ou depuis) : en file le long du trajet, en fondu
      const h = v.horizon, k = Math.min(1, (now - h.t0) / h.duree), p = poseHorizon(v.navires, h.route, k, h.part, t, dt);
      v.x = p.x; v.z = p.z; v.cap = p.cap;
      deplacer('f' + id, p.x, 0.75, p.z);
      if (k >= 1) { v.horizon = null; v.navires.forEach(n => estomper(n, 1)); if (h.part) { v.parti = true; etiquettes(); } }
      continue;
    }
    let x = v.x, z = v.z, cap = v.cap, vit = 0;
    if (v.anim) { // le long du tracé, à vitesse régulière ; au bord de la fenêtre, en fondu
      const a = v.anim, k = Math.min(1, (now - a.t0) / Math.max(1, a.duree)), sd = k * a.long;
      let i = 0; while (i < a.pts.length - 2 && a.cum[i + 1] < sd) i++;
      const p = a.pts[i], q = a.pts[i + 1], r = Math.min(1, (sd - a.cum[i]) / ((a.cum[i + 1] - a.cum[i]) || 1));
      x = p[0] + (q[0] - p[0]) * r; z = p[1] + (q[1] - p[1]) * r;
      const c = q[0] !== p[0] || q[1] !== p[1] ? capX(q[0] - p[0], q[1] - p[1]) : v.cap ?? 0, d = Math.atan2(Math.sin(c - (v.cap ?? c)), Math.cos(c - (v.cap ?? c)));
      cap = (v.cap ?? c) + d * Math.min(1, dt * 6); vit = k < 1 ? 0.3 : 0;
      v.x = x; v.z = z; v.cap = cap;
      if (a.sortie || a.entree) {
        const op = Math.min(a.sortie ? 1 - lisse(a.cum[a.cum.length - 2], a.long, sd) : 1, a.entree ? lisse(0, a.cum[1], sd) : 1);
        v.navires.forEach(n => estomper(n, op));
        if (a.sortie && k >= 1) { v.sortie = true; v.anim = null; v.navires.forEach(n => { estomper(n, 1); n.g.visible = false; }); etiquettes(); continue; }
      }
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
      if (n.pilote) return; // mené par une scène (abordage)
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
  imageCommerce(now, dt, t);
  imageNavale(now, dt, t);
});
