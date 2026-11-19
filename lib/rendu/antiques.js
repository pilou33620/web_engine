// Les bâtiments et les armées de l'Antiquité : Gaulois et Romains. Modèles du moteur, dans les conventions de modernes.js
// (lot, put…, unités de 10 par case, parties mobiles déclarées par piece()), assemblés et animés par modele() et animer().
//
//   import { ANT, ANTIQUES } from './antiques.js';
//   import { modele, animer } from './modernes.js';
//   const m = modele(ANT.hutte, 1); scene.add(m.groupe); animer(m);   // groupe à l'échelle du plateau (× 0,1)
//
// Maisons gauloises : murs à poteaux de bois et torchis, toit de chaume. Maisons romaines : enduit, pierre, marbre et tuiles.
import { THREE } from './scene.js';
import { lot, put, boite, cyl, cone, sphere } from './toon.js';
import { piece, oiseaux, fum, arbreVent, arbre, sol } from './modernes.js';

const TORCHIS = 0xd8c08f, BOIS = 0x6e4a2c, BOIS2 = 0x8a6a42, CHAUME = 0xc9a45a, CHAUME2 = 0xb08a3e, PAILLE = 0xe0c070;
const PIERRE = 0xb9b2a2, MARBRE = 0xf2eee4, TUILE = 0xc4573a, ENDUIT = 0xe8cfa0, OCRE = 0xd9a066, EAU = 0x4f9fd0, FEU = 0xffa030;
const ROUGE = 0xb3302a, OR = 0xe0b23a, FER = 0x9aa3ad, BRONZE = 0xb08a3a, PEAU = 0xf1c9a0;
const TARTANS = [0x3f7a4a, 0x8a3a2a, 0x3a5a8a, 0xc9a24a, 0x6a4a7a], CHEVEUX = [0xe0c070, 0xb5552a, 0x8a5a2a, 0xd9b060];
const lumiere = ex => { if (ex) ex.lumiere = true; };
/** Un toit à deux pans posé en (x, y, z) : largeur w (selon x), longueur d (selon z, le faîtage), hauteur h ; ry tourne le tout. */
function pignon(L, w, d, h, col, x, y, z, ry = 0) {
  const f = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  put(L, new THREE.ExtrudeGeometry(f, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), col, x, y, z, ry, .15);
}

// ------------------------------------------------------------------ gens et bêtes (tournés vers +x, la direction de marche)
/** Un personnage debout en (x, y, z), haut d'environ 1,9 : jambes, tunique, tête ; o : tunique, jambes, cheveux, casque, y. */
function homme(P, x, z, o = {}) {
  const y = o.y ?? 0;
  put(P, boite(.45, .65, .3), o.jambes ?? 0x5a4a3a, x, y + .33, z, 0, .05);
  put(P, cyl(.27, .37, .8, 8), o.tunique ?? 0x8a6a3a, x, y + 1.05, z, 0, .05);
  put(P, sphere(.24, 1), PEAU, x, y + 1.65, z, 0, .05);
  if (o.cheveux) put(P, sphere(.25, 1).scale(1, .7, 1), o.cheveux, x - .04, y + 1.74, z, 0, 0);
  if (o.casque) put(P, cyl(.17, .27, .24, 8), o.casque, x, y + 1.84, z, 0, .05);
}
/** Un cheval en (x, z), tête vers +x ; robe : couleur. */
function cheval(P, x, z, robe = 0x7a5233) {
  put(P, boite(2, .85, .7), robe, x, 1.35, z, 0, .08);
  for (const [dx, dz] of [[-.75, -.25], [-.75, .25], [.75, -.25], [.75, .25]]) put(P, boite(.2, 1, .2), robe, x + dx, .5, z + dz, 0, .05);
  put(P, boite(.4, 1, .38).rotateZ(-.5), robe, x + 1.05, 1.95, z, 0, .06); put(P, boite(.75, .34, .32), robe, x + 1.45, 2.35, z, 0, .05);
  put(P, boite(.14, .8, .14).rotateZ(.4), 0x2f2c2a, x - 1.1, 1.3, z, 0, 0);
}
/** Un cavalier monté sur son cheval. */
function cavalier(P, x, z, robe, tunique, tete, bouclier) {
  cheval(P, x, z, robe);
  put(P, cyl(.25, .32, .75, 8), tunique, x - .1, 2.15, z, 0, .05);
  for (const c of [-1, 1]) put(P, boite(.3, .65, .18), tunique, x, 1.6, z + c * .42, 0, .04);
  put(P, sphere(.22, 1), PEAU, x - .1, 2.72, z, 0, .05); put(P, cyl(.16, .25, .22, 8), tete, x - .1, 2.9, z, 0, .05);
  put(P, cyl(.45, .45, .1, 12).rotateX(Math.PI / 2).scale(1, 1.35, 1), bouclier, x - .1, 2.1, z + .5, 0, .06);
  put(P, cyl(.035, .035, 2.8, 5), BOIS2, x + .3, 2.5, z - .3, 0, 0);
}
const poule = (L, ex, x, z, ph) => piece(L, ex, P => { put(P, sphere(.3, 1).scale(1.2, 1, 1), 0xf6f4ee, 0, .35, 0, 0, .04); put(P, sphere(.14, 1), 0xd9573b, .32, .62, 0, 0, 0); }, x, .2, z, 'glisse', 'x', .6, .6, ph);
const mouton = (L, ex, x, z, ph) => piece(L, ex, P => { put(P, sphere(.6, 1).scale(1.3, .9, 1), 0xf3efe2, 0, .75, 0, 0, .06); put(P, boite(.4, .38, .34), 0x2f2c2a, .8, .9, 0, 0, .04); }, x, 0, z, 'glisse', 'x', .7, .2, ph);
const flamme = (L, ex, x, y, z, s = 1) => piece(L, ex, P => { put(P, cone(.35 * s, .9 * s, 6), FEU, 0, 0, 0, 0, 0); put(P, cone(.18 * s, .5 * s, 6), 0xffe27a, 0, -.1, 0, 0, 0); }, x, y, z, 'pulse', 'y', .25, 8, x);
const torche = (L, ex, x, z) => { put(L, cyl(.07, .09, 2.2, 5), BOIS, x, 1.1, z, 0, .04); flamme(L, ex, x, 2.5, z, .6); };
const tasDeBois = (L, x, z) => { for (let k = 0; k < 5; k++) put(L, cyl(.18, .18, 1.6, 6).rotateX(Math.PI / 2), BOIS2, x + (k % 3) * .38 - .38 + (k > 2 ? .19 : 0), .2 + (k > 2 ? .33 : 0), z, 0, .04); };
const cypres = (L, ex, x, z, ph = 0) => piece(L, ex, P => { put(P, cyl(.15, .2, .8, 5), 0x6e4a2c, 0, .4, 0, 0, .05); put(P, cone(.7, 4, 7), 0x2f5f30, 0, 2.6, 0, 0, .1); }, x, 0, z, 'oscille', 'z', .05, 1.1, ph);

/** Quelqu'un (qui(P), tourné vers +x) qui suit un trajet en boucle : points [x, z] ou [x, y, z], parcourus en 1/v s ;
 *  charge(P) : ce qu'il porte, visible seulement sur les tronçons i où porte[i] est vrai (un sac monté au grenier, puis redescendu sans). */
function trajet(L, ex, pts, v, ph, qui, charge, porte = []) {
  const c = pts.map(q => q.length === 2 ? [q[0], .1, q[1]] : q);
  piece(L, ex, qui, ...c[0], 'chemin', c, 1, v, ph);
  if (charge) piece(L, ex, charge, ...c[0], 'chemin', c.map((q, i) => [...q, porte[i] ? 1 : 0]), 1, v, ph);
}
const gens = o => P => homme(P, 0, 0, o);
const SAC = P => put(P, sphere(.42, 1).scale(1, .8, 1), PAILLE, -.05, 2.2, 0, 0, .05);
/** Un poisson (corps et queue), couché selon x ; rz l'incline. */
function poisson(P, x, y, z, rz = 0, col = 0x9ab8c8) {
  put(P, sphere(.3, 1).scale(2, .6, .6).rotateZ(rz), col, x, y, z, 0, .04);
  put(P, cone(.22, .35, 4).rotateZ(Math.PI / 2 + rz), col, x - Math.cos(rz) * .7, y - Math.sin(rz) * .7, z, 0, .03);
}
/** Un chariot tiré par un bœuf, tourné vers +x. */
function chariot(P, charge = 0x8a6a42) {
  put(P, boite(1.8, .5, 1.2), BOIS2, 0, .9, 0, 0, .06); for (const c of [-1, 1]) put(P, cyl(.45, .45, .1, 10).rotateX(Math.PI / 2), BOIS, 0, .45, c * .65, 0, .05);
  put(P, sphere(.35, 1).scale(1, .8, 1), charge, 0, 1.3, 0, 0, .04); put(P, boite(1.4, .8, .6), 0x8a5a3a, 1.9, .9, 0, 0, .06); put(P, boite(.5, .45, .45), 0x8a5a3a, 2.8, 1, 0, 0, .04);
  put(P, boite(.1, .1, .7), 0xf3efe2, 2.9, 1.35, 0, 0, 0);
}
/** Un âne gris, tourné vers +x. */
function ane(P, x, z) {
  put(P, boite(1.3, .6, .5), 0x8d8f96, x, .95, z, 0, .06);
  for (const [dx, dz] of [[-.5, -.18], [-.5, .18], [.5, -.18], [.5, .18]]) put(P, boite(.14, .7, .14), 0x8d8f96, x + dx, .35, z + dz, 0, .03);
  put(P, boite(.5, .3, .3), 0x8d8f96, x + .85, 1.35, z, 0, .04); for (const c of [-1, 1]) put(P, boite(.08, .4, .1), 0x6b6f75, x + .75, 1.65, z + c * .1, 0, 0);
}
/** Un bras qui frappe ou travaille (hache, houe, marteau) pour un personnage debout en (x, z) : le manche part de l'épaule vers +x. */
const outil = (L, ex, x, z, col = 0x3a3a3a, v = 4, ph = 0) => piece(L, ex, P => { put(P, boite(.8, .1, .1), BOIS2, .4, 0, 0, 0, .03); put(P, boite(.22, .3, .26), col, .82, 0, 0, 0, .04); }, x, 1.35, z, 'oscille', 'z', .6, v, ph);
/** Un étal : table, quatre poteaux, toit de chaume (ou de tuiles). */
function etal(L, x, z, toit = CHAUME) {
  put(L, boite(2.4, .9, 1.2), BOIS2, x, .45, z, 0, .06);
  for (const [dx, dz] of [[-1.1, -.6], [1.1, -.6], [-1.1, .6], [1.1, .6]]) put(L, boite(.12, 2.4, .12), BOIS, x + dx, 1.2, z + dz, 0, 0);
  pignon(L, 1.8, 2.8, .8, toit, x, 2.4, z, Math.PI / 2);
}

// ------------------------------------------------------------------ maisons gauloises : poteaux de bois, torchis, chaume
/** Une maison ronde gauloise : mur de torchis tenu par des poteaux, linteau, porte vers +z, toit conique de chaume qui fume par le haut. */
function maisonRonde(L, ex, x, z, r = 2.6, hm = 2.9) {
  put(L, cyl(r, r, hm, 16), TORCHIS, x, hm / 2, z, 0, .2);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; put(L, boite(.24, hm + .1, .24), BOIS, x + Math.cos(a) * r, hm / 2, z + Math.sin(a) * r, -a, .06); }
  put(L, cyl(r + .06, r + .06, .22, 16), BOIS, x, hm, z, 0, .06);
  put(L, boite(1, 1.6, .3), 0x4a3322, x, .8, z + r - .05, 0, .06);
  put(L, cyl(r + .55, r + .7, .35, 16), CHAUME2, x, hm + .1, z, 0, .12);
  put(L, cone(r + .55, r * 1.45, 16), CHAUME, x, hm + .25 + r * .725, z, 0, .2);
  put(L, cone(.4, .6, 8), CHAUME2, x, hm + .2 + r * 1.45, z, 0, .06);
  fum(ex, x, hm + .6 + r * 1.45, z, true);
}
/** Une maison longue à colombages : torchis entre les poteaux, toit de chaume à deux pans, faîtage selon x. */
function maisonLongue(L, ex, x, z, lg = 7.4, pf = 3.6, hm = 2.2) {
  put(L, boite(lg, hm, pf), TORCHIS, x, hm / 2, z, 0, .2);
  for (let k = 0; k <= 6; k++) for (const c of [-1, 1]) put(L, boite(.24, hm + .1, .24), BOIS, x - lg / 2 + k * lg / 6, hm / 2, z + c * (pf / 2 + .02), 0, .06);
  for (const c of [-1, 1]) put(L, boite(lg + .1, .22, .26), BOIS, x, hm, z + c * (pf / 2 + .02), 0, .06);
  put(L, boite(1.1, 1.6, .3), 0x4a3322, x, .8, z + pf / 2, 0, .06);
  pignon(L, pf + 1.2, lg + 1, 3, CHAUME, x, hm, z, Math.PI / 2);
  fum(ex, x - lg / 4, hm + 3, z, true);
}

// ------------------------------------------------------------------ au repos et au travail : aides communes aux bivouacs et aux retranchements
/** Quelqu'un couché qui dort (sa poitrine se soulève) ; tunique, tête vers -x. */
function dormeur(L, ex, x, z, tunique, cheveux) {
  put(L, boite(1.5, .35, .7), 0x7a6a52, x, .3, z, 0, .04);
  put(L, sphere(.24, 1), PEAU, x - .9, .55, z, 0, .04); if (cheveux) put(L, sphere(.25, 1).scale(.7, 1, 1), cheveux, x - 1, .58, z, 0, 0);
  piece(L, ex, P => put(P, boite(1.1, .4, .62), tunique, 0, 0, 0, 0, .04), x, .62, z, 'pulse', 'y', .05, 2.2, x);
}
/** Un feu de camp entouré de pierres, qui flambe et fume. */
function feuDeCamp(L, ex, x, z, s = 1) {
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; put(L, sphere(.22 * s, 0), PIERRE, x + Math.cos(a) * .7 * s, .35, z + Math.sin(a) * .7 * s, 0, .03); }
  for (let k = 0; k < 3; k++) put(L, cyl(.08, .08, 1 * s, 5).rotateZ(Math.PI / 2), BOIS, x, .35, z, k * 1.05, .02);
  flamme(L, ex, x, .75, z, s); fum(ex, x, 1.6, z, true);
}
/** Une marmite sur son trépied au-dessus des braises, et le cuisinier qui touille. */
function marmite(L, ex, x, z, tunique, cheveux, casque) {
  for (const a of [0, 2.1, 4.2]) put(L, boite(.07, 1.6, .07).rotateZ(.25), BOIS, x + Math.cos(a) * .4, .8, z + Math.sin(a) * .4, -a, 0);
  put(L, new THREE.SphereGeometry(.5, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x3a3a3a, x, 1.1, z, 0, .04); flamme(L, ex, x, .45, z, .6);
  homme(L, x + 1, z, { tunique, cheveux, casque });
  piece(L, ex, P => put(P, boite(.9, .07, .07), BOIS2, -.45, 0, 0, 0, 0), x + .85, 1.35, z, 'oscille', 'y', .5, 2.5);
}
/** Une charrette sans attelage (pour un cercle de chariots), tournée de ry. */
function charrette(L, x, z, ry, toile = 0xe8dcc0) {
  put(L, boite(2.2, .5, 1.2), BOIS2, x, .9, z, ry, .06);
  put(L, new THREE.CylinderGeometry(.62, .62, 2.1, 10, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), toile, x, 1.15, z, ry, .05);
  for (const [dx, dz] of [[-.7, -.65], [.7, -.65], [-.7, .65], [.7, .65]]) { const c = Math.cos(ry), sn = Math.sin(ry); put(L, cyl(.42, .42, .1, 10).rotateX(Math.PI / 2), BOIS, x + dx * c + dz * sn, .42, z - dx * sn + dz * c, ry, .04); }
}

const ANT = {
  // ================================================================ Gaulois
  hutte(L, ex) {
    sol(L, 0x8fbf5a); lumiere(ex);
    maisonRonde(L, ex, -.5, -1.5);
    tasDeBois(L, 3.6, -2.2); put(L, cyl(.5, .5, .8, 10), BOIS2, 4, .4, 1, 0, .08);
    for (const [x, z, k] of [[2.2, 3, 0], [3.6, 4.4, 1], [-3.2, 3.6, 2]]) poule(L, ex, x, z, k * 2);
    piece(L, ex, P => homme(P, 0, 0, { tunique: TARTANS[1], cheveux: CHEVEUX[0] }), -.5, .1, 4.8, 'marche', 'x', 2.2, .25);
    arbreVent(L, ex, -5.5, -3, 1.1); arbreVent(L, ex, 5.6, -4.4, .9, 1);
    homme(L, 3.2, -.8, { tunique: TARTANS[0], cheveux: CHEVEUX[2] }); outil(L, ex, 3.2, -.8, FER, 3);
    piece(L, ex, P => { put(P, boite(.9, .45, .35), 0x8a5a2a, 0, .5, 0, 0, .04); put(P, boite(.35, .3, .3), 0x8a5a2a, .55, .75, 0, 0, .03); put(P, boite(.4, .08, .08), 0x8a5a2a, -.6, .7, 0, 0, 0); }, 1, 0, 3.4, 'glisse', 'x', 1.6, .5);
  },
  longue(L, ex) {
    sol(L, 0x8fbf5a); lumiere(ex);
    maisonLongue(L, ex, 0, -2.2);
    tasDeBois(L, -5, 2.4);
    piece(L, ex, P => { put(P, sphere(.55, 1).scale(1.5, .9, 1), 0xe8a0a0, 0, .6, 0, 0, .06); put(P, boite(.3, .3, .3), 0xd98a8a, .8, .6, 0, 0, .04); }, 1.6, 0, 3.4, 'glisse', 'x', 1.2, .3);
    poule(L, ex, -2, 3.8, 0); poule(L, ex, 3.8, 1.6, 3);
    piece(L, ex, P => homme(P, 0, 0, { tunique: TARTANS[3], cheveux: CHEVEUX[1] }), -1.5, .1, 1.4, 'marche', 'x', 2.5, .2);
    arbreVent(L, ex, 5.4, 3.6, .9);
    put(L, cyl(.5, .55, .5, 10), PIERRE, -3, .25, .6, 0, .06);
    piece(L, ex, P => { put(P, cyl(.5, .5, .25, 10), 0x9a9488, 0, 0, 0, 0, .05); put(P, boite(.08, .5, .08), BOIS, .35, .3, 0, 0, 0); }, -3, .6, .6, 'tourne', 'y', 1, 1.5);
    homme(L, -2.1, .6, { tunique: TARTANS[4], cheveux: CHEVEUX[3], y: -.45 });
    trajet(L, ex, [[4.4, 4.4], [4.4, .4], [1.4, .1], [1.4, .1], [4.4, .4]], .06, 0, gens({ tunique: TARTANS[2], cheveux: CHEVEUX[0] }), P => put(P, cyl(.25, .2, .4, 8), BOIS2, .35, 1.1, 0, 0, .03), [1, 1, 0, 0, 0]);
  },
  chef(L, ex) {
    sol(L, 0x8fbf5a); lumiere(ex);
    maisonRonde(L, ex, 0, -1.6, 3.6, 3);
    for (const [x, c] of [[-1.4, 0x3a5a8a], [1.4, 0x8a3a2a]]) put(L, cyl(.45, .45, .1, 12).rotateX(Math.PI / 2).scale(1, 1.35, 1), c, x, 1.5, 2.05, 0, .06);
    torche(L, ex, -1, 3); torche(L, ex, 1, 3);
    put(L, cyl(.08, .1, 5.2, 6), BOIS, 4.6, 2.6, 1.8, 0, .05);
    piece(L, ex, P => { put(P, boite(1, .55, .3), BRONZE, 0, 0, 0, 0, .06); put(P, boite(.3, .3, .26), BRONZE, .62, .08, 0, 0, .04); put(P, boite(.12, .55, .12), BRONZE, 0, .4, 0, 0, 0); }, 4.6, 5.5, 1.8, 'oscille', 'y', .25, .5);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: TARTANS[0], cheveux: CHEVEUX[2] }); put(P, cyl(.04, .04, 2.6, 5), BOIS2, .25, 1.4, -.3, 0, 0); }, 0, .1, 5, 'marche', 'x', 2.6, .2);
    for (const a of [0, 2.1, 4.2]) put(L, boite(.08, 1.6, .08).rotateZ(.25), BOIS, -3.6 + Math.cos(a) * .4, .75, 3.6 + Math.sin(a) * .4, -a, 0);
    put(L, new THREE.SphereGeometry(.55, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BRONZE, -3.6, 1.2, 3.6, 0, .05); flamme(L, ex, -3.6, .45, 3.6, .7); fum(ex, -3.6, 1.6, 3.6, true);
    trajet(L, ex, [[5.4, -1.6], [5.4, 3.4], [-2.8, 4.2], [-2.8, 4.2], [5.4, 3.4]], .05, 0, gens({ tunique: TARTANS[3], cheveux: CHEVEUX[1] }), P => put(P, cyl(.15, .15, 1, 6).rotateX(Math.PI / 2), BOIS2, .35, 1.1, 0, 0, .03), [1, 1, 0, 0, 0]);
  },
  grenier(L, ex) {
    sol(L, 0x9fc46a);
    for (const [gx, gz, s] of [[-1, -1.2, 1], [3.6, 2.4, .7]]) {
      for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) put(L, cyl(.18, .22, 1.7, 6), BOIS, gx + dx * s, .85, gz + dz * s, 0, .05);
      put(L, boite(3 * s, .25, 3 * s), BOIS2, gx, 1.75, gz, 0, .06);
      put(L, boite(2.6 * s, 1.8 * s, 2.6 * s), TORCHIS, gx, 1.85 + .9 * s, gz, 0, .15);
      put(L, cone(2.5 * s, 2.3 * s, 4), CHAUME, gx, 1.85 + 1.8 * s + 1.15 * s, gz, Math.PI / 4, .15);
    }
    for (const c of [-1, 1]) put(L, boite(.1, 2.4, .1).rotateZ(.5), BOIS, .9, 1, .3 + c * .35, 0, 0);
    for (let k = 0; k < 4; k++) put(L, boite(.1, .1, .8), BOIS, .5 + k * .3, .4 + k * .5, .3, 0, 0);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: TARTANS[2], cheveux: CHEVEUX[3] }); put(P, sphere(.42, 1).scale(1, .8, 1), PAILLE, -.05, 2.2, 0, 0, .05); }, -1, .1, 4.4, 'marche', 'x', 2.8, .22);
    oiseaux(L, ex, 0, 0, 7, 2.6, 4, 0x6a5a4a, .8);
    for (let k = 0; k < 4; k++) put(L, sphere(.42, 1).scale(1, .8, 1), PAILLE, 2.4 + (k % 2) * .7, .35 + (k > 1 ? .55 : 0), -2.8, 0, .05);
    trajet(L, ex, [[2.6, .1, -2], [2, .1, .3], [1.5, .1, .3], [.4, 1.95, .3], [.4, 1.95, .3], [1.5, .1, .3], [2, .1, .3], [2.6, .1, -2]], 1 / 16, 0,
      gens({ tunique: TARTANS[1], cheveux: CHEVEUX[2] }), SAC, [1, 1, 1, 1, 0, 0, 0, 0]);
  },
  ferme(L, ex) {
    sol(L, 0x9fc46a); lumiere(ex);
    maisonRonde(L, ex, -3.4, -3.2, 2.2, 2.3);
    put(L, new THREE.TorusGeometry(2.8, .1, 3, 24).rotateX(Math.PI / 2), BOIS, 2.4, .7, 1.6, 0, 0);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; put(L, boite(.15, 1, .15), BOIS, 2.4 + Math.cos(a) * 2.8, .5, 1.6 + Math.sin(a) * 2.8, 0, 0); }
    for (const [x, z, k] of [[1.6, .8, 0], [3, 2.4, 1], [2.2, 2.8, 2]]) mouton(L, ex, x, z, k * 2);
    for (let k = 0; k < 3; k++) put(L, boite(4, .3, .7), [0xd6b24a, 0xa9c457, 0xe3c75b][k], -3.4, .15, 1.6 + k * 1.3, 0, .06);
    put(L, cone(1, 1.8, 8), PAILLE, 4.6, .9, -3.2, 0, .1);
    oiseaux(L, ex, 0, 0, 6, 3);
    trajet(L, ex, [[-.8, 1.6], [2.4, -1.6], [5.6, 1.6], [2.4, 4.8]], .12, 0, P => { put(P, boite(.8, .4, .3), 0x3a2a1e, 0, .5, 0, 0, .04); put(P, boite(.3, .3, .26), 0xf3efe2, .5, .7, 0, 0, .03); put(P, boite(.3, .08, .08), 0x3a2a1e, -.5, .6, 0, 0, 0); });
    homme(L, -5.4, 2.9, { tunique: TARTANS[3], cheveux: CHEVEUX[0] }); outil(L, ex, -5.4, 2.9, FER, 2.5);
  },
  forge(L, ex) {
    sol(L, 0xb3a98a);
    for (const [x, z] of [[-2.4, -1.8], [2.4, -1.8], [-2.4, 1.8], [2.4, 1.8]]) put(L, boite(.3, 2.6, .3), BOIS, x, 1.3, z, 0, .06);
    pignon(L, 5.6, 4.6, 2, CHAUME, 0, 2.6, 0);
    put(L, boite(1.7, 1, 1.7), PIERRE, -1.2, .5, -.4, 0, .12); flamme(L, ex, -1.2, 1.4, -.4, 1.1);
    put(L, cyl(.35, .4, .6, 8), BOIS, 1, .3, 0, 0, .06); put(L, boite(.7, .35, .35), 0x3a3a3a, 1, .78, 0, 0, .06);
    homme(L, 1.9, .2, { tunique: 0x6a4a2a, cheveux: CHEVEUX[1] });
    piece(L, ex, P => { put(P, boite(.8, .12, .12), 0x6a4a2a, -.4, 0, 0, 0, .03); put(P, boite(.22, .3, .26), 0x3a3a3a, -.82, 0, 0, 0, .04); }, 1.9, 1.35, .2, 'oscille', 'z', .55, 6);
    fum(ex, -1.2, 4.6, -.4, false);
    tasDeBois(L, 3.6, 3.2); for (let k = 0; k < 3; k++) put(L, boite(.1, 1.2, .1), FER, -3.6 + k * .3, .6, 3.4, 0, 0);
    homme(L, -2.6, .9, { tunique: TARTANS[2], cheveux: CHEVEUX[3] });
    piece(L, ex, P => { put(P, boite(.9, .35, .6), 0x6a4a2a, 0, 0, 0, 0, .04); put(P, boite(.5, .06, .06), BOIS, .6, .1, 0, 0, 0); }, -2.1, .8, .4, 'pulse', 'y', .25, 4);
  },
  potier(L, ex) {
    sol(L, 0xb8a98a);
    put(L, new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb5653a, -2.4, 0, -1.4, 0, .12);
    put(L, boite(.7, .6, .3), 0x3a2a1e, -2.4, .3, .15, 0, 0); flamme(L, ex, -2.4, .4, .25, .5);
    fum(ex, -2.4, 2, -1.4, false);
    put(L, cyl(.2, .3, .8, 8), BOIS, 1.4, .4, 0, 0, .05);
    piece(L, ex, P => { put(P, cyl(.6, .6, .14, 12), BOIS2, 0, 0, 0, 0, .05); put(P, cyl(.22, .28, .5, 8), 0xc0703f, 0, .3, 0, 0, .04); put(P, boite(.08, .1, .3), 0x4a3322, .45, .1, 0, 0, 0); }, 1.4, .87, 0, 'tourne', 'y', 1, 4);
    homme(L, 2.3, .1, { tunique: TARTANS[3], cheveux: CHEVEUX[0], y: -.4 });
    for (let k = 0; k < 7; k++) { const x = -3.6 + k * .9, c = k % 2 ? 0xc0703f : 0xa85a32; put(L, cyl(.25, .35, .7, 8), c, x, .35, 3.4, 0, .05); put(L, sphere(.3, 1), c, x + .45, .3, 4.3, 0, .05); }
    for (const [x, z] of [[3.6, -2.4], [-4.8, 1.6]]) arbreVent(L, ex, x, z, .9, x);
    trajet(L, ex, [[-2.4, 1], [-2.4, 1], [0, 2.4], [0, 2.4], [-2.4, 1]], .08, 0, gens({ tunique: TARTANS[1], cheveux: CHEVEUX[2] }), P => put(P, cyl(.22, .3, .55, 8), 0xc0703f, .4, 1.15, 0, 0, .03), [0, 1, 0, 0, 0]);
  },
  sanctuaire(L, ex) {
    sol(L, 0x86b85a);
    for (const [x, z, w, d] of [[0, -4.6, 9.6, .6], [0, 4.6, 3.4, .6], [-4.6, 0, .6, 9.6], [4.6, 0, .6, 9.6]]) put(L, boite(w, .6, d), 0x7a6a4a, x, .3, z, 0, .08);
    for (let k = 0; k < 9; k++) for (const [x, z] of [[-4.6 + k * 1.15, -4.6], [-4.6, -4.6 + k * 1.15], [4.6, -4.6 + k * 1.15]]) put(L, boite(.2, 1.6, .2), BOIS, x, .8, z, 0, 0);
    for (const [x, z] of [[-2.6, 2.6], [2.6, 2.6], [-2.6, -1], [2.6, -1]]) { put(L, cyl(.3, .35, 3.6, 6), BOIS2, x, 1.8, z, 0, .08); put(L, sphere(.3, 1), 0xf3efe2, x, 3.8, z, 0, .06); }
    put(L, boite(1.6, .8, 1), PIERRE, 0, .4, 1, 0, .1); flamme(L, ex, 0, 1.25, 1, 1.1); fum(ex, 0, 2.2, 1, true);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0xe9e6dd }); put(P, new THREE.TorusGeometry(.25, .05, 4, 8, Math.PI), OR, .35, 1.2, .2, 0, 0); put(P, cyl(.05, .05, 2.4, 5), BOIS2, -.3, 1.2, .3, 0, 0); }, 0, .1, 3.4, 'marche', 'x', 2, .15);
    piece(L, ex, P => arbre(P, 0, 0, 1.9), 0, 0, -2.6, 'oscille', 'z', .05, 1, 0);
    oiseaux(L, ex, 0, -2.6, 8, 2.4, 3, 0x2f2c2a, .5);
    trajet(L, ex, [[0, 6.5], [0, 2.2], [0, 2.2], [0, 6.5], [0, 6.5]], .07, 0, gens({ tunique: TARTANS[0], cheveux: CHEVEUX[1] }), P => put(P, sphere(.25, 1), 0xe3c75b, .4, 1.2, 0, 0, .03), [1, 0, 0, 0, 0]);
    put(L, cone(.25, .5, 5), 0x6fa83a, 0, 4.2, -2.6, 0, .03);
  },
  oppidum(L, ex) {
    sol(L, 0x8fbf5a);
    for (const c of [-1, 1]) {
      const x = c * 4.6;
      put(L, boite(6, 3, 3), 0x8a7a5a, x, 1.5, -1.4, 0, .15);
      put(L, boite(6, 2.6, .3), PIERRE, x, 1.4, .2, 0, .1);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) put(L, boite(.32, .32, .12), BOIS, x - 2.4 + i * .95, .8 + j * 1.2, .38, 0, 0);
      put(L, boite(6, .4, 3.2), 0x7cae4a, x, 3.15, -1.4, 0, .08);
      for (let k = 0; k < 7; k++) put(L, boite(.18, 1.2, .18), BOIS, x - 2.7 + k * .9, 3.9, -.1, 0, 0);
    }
    for (const [x, z] of [[-1.5, -2.8], [1.5, -2.8], [-1.5, .2], [1.5, .2]]) put(L, boite(.35, 5.2, .35), BOIS, x, 2.6, z, 0, .06);
    put(L, boite(3.6, .3, 3.4), BOIS2, 0, 3.6, -1.3, 0, .06); pignon(L, 4, 3.8, 1.8, CHAUME, 0, 5.2, -1.3);
    for (const c of [-1, 1]) put(L, boite(1.3, 2.6, .2), BOIS2, c * .7, 1.3, .25, c * .5, .06);
    put(L, boite(15, .4, 1.6), 0x5a6a3a, 0, .05, 3, 0, 0);
    for (const c of [-1, 1]) piece(L, ex, P => { homme(P, 0, 0, { tunique: TARTANS[c > 0 ? 0 : 2], cheveux: CHEVEUX[c > 0 ? 0 : 1] }); put(P, cyl(.04, .04, 2.6, 5), BOIS2, .25, 1.4, -.3, 0, 0); }, c * 4.6, 3.35, -1.6, 'marche', 'x', 1.8, .2);
    put(L, cyl(.06, .08, 2.6, 5), BOIS, 1.5, 6.4, .2, 0, 0);
    piece(L, ex, P => put(P, boite(1.3, .8, .06), 0x3a5a8a, .65, 0, 0, 0, .04), 1.5, 7.2, .2, 'oscille', 'y', .4, 1.4);
    trajet(L, ex, [[0, .1, 7], [0, .1, -5.4], [0, .1, -5.4], [0, .1, 7], [0, .1, 7]], 1 / 22, 0, P => chariot(P, PAILLE));
  },
  tour(L, ex) {
    sol(L, 0x8fbf5a);
    for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) put(L, boite(.35, 6.4, .35), BOIS, x, 3.2, z, 0, .06);
    for (const y of [2.2, 4.2]) for (const c of [-1, 1]) { put(L, boite(.12, .12, 2.8).rotateX(.7), BOIS2, c * 1.1, y, 0, 0, 0); put(L, boite(2.8, .12, .12).rotateZ(.7), BOIS2, 0, y, c * 1.1, 0, 0); }
    put(L, boite(3.2, .3, 3.2), BOIS2, 0, 6.3, 0, 0, .06);
    for (const c of [-1, 1]) { put(L, boite(3.2, .7, .1), BOIS2, 0, 6.8, c * 1.6, 0, .04); put(L, boite(.1, .7, 3.2), BOIS2, c * 1.6, 6.8, 0, 0, .04); }
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put(L, boite(.15, 1.8, .15), BOIS, x, 7.3, z, 0, 0);
    put(L, cone(2.7, 2, 4), CHAUME, 0, 9.2, 0, Math.PI / 4, .15);
    piece(L, ex, P => homme(P, .7, 0, { tunique: TARTANS[4], cheveux: CHEVEUX[0] }), 0, 6.45, 0, 'tourne', 'y', 1, .4);
    flamme(L, ex, 1.5, 8.4, 1.5, .6);
    put(L, cyl(.6, .7, .7, 8), PIERRE, 3, .35, 2.4, 0, .08); flamme(L, ex, 3, 1, 2.4, .9); fum(ex, 3, 1.8, 2.4, false);
    arbreVent(L, ex, -4.6, 2.6, 1); arbreVent(L, ex, 4.4, -3.4, .9, 2);
    put(L, cyl(.05, .05, 1.6, 5), BOIS, 0, 10.8, 0, 0, 0);
    piece(L, ex, P => put(P, boite(1, .6, .05), 0x8a3a2a, .5, 0, 0, 0, .03), 0, 11.3, 0, 'oscille', 'y', .5, 1.2);
    trajet(L, ex, [[-7.5, 4.6], [-1.6, 3.4], [-1.6, 3.4], [-7.5, 4.6], [-7.5, 4.6]], 1 / 18, 0, P => cavalier(P, 0, 0, 0x7a5233, TARTANS[1], BRONZE, TARTANS[2]));
  },

  marcheG(L, ex) {
    sol(L, 0x9fc46a);
    etal(L, -3.6, -2.6); etal(L, .4, -3.8); etal(L, 4.2, -2.2);
    for (let k = 0; k < 5; k++) poisson(L, -4.5 + k * .45, 1, -2.6 + (k % 2) * .25, Math.PI / 2, k % 2 ? 0x9ab8c8 : 0xb8c8a8);
    homme(L, -3.6, -3.7, { tunique: TARTANS[2], cheveux: CHEVEUX[1] });
    piece(L, ex, P => poisson(P, .6, 0, 0, .3), -3.4, 1.6, -3.5, 'oscille', 'z', .5, 2.5);
    for (let k = 0; k < 4; k++) put(L, cyl(.22, .3, .6, 8), k % 2 ? 0xc0703f : 0xa85a32, -.5 + k * .6, 1.2, -3.8, 0, .03);
    for (let k = 0; k < 3; k++) put(L, cyl(.3, .3, 1.1, 8).rotateZ(Math.PI / 2), TARTANS[k], 4.2, 1.05 + k * .05, -2.6 + k * .4, 0, .03);
    homme(L, 4.2, -3.3, { tunique: TARTANS[3], cheveux: CHEVEUX[0] });
    trajet(L, ex, [[-5.4, 1.4], [0, 2.4], [5.2, 1], [0, .2]], 1 / 16, 0, gens({ tunique: TARTANS[4], cheveux: CHEVEUX[2] }), P => put(P, cyl(.3, .22, .4, 8), 0xb08a3e, .4, 1.1, 0, 0, .03), [1, 1, 1, 1]);
    trajet(L, ex, [[5.6, 4], [-.6, 5], [-4.8, 3.4], [-.6, 3.4]], 1 / 19, .4, gens({ tunique: TARTANS[1], cheveux: CHEVEUX[3] }));
    piece(L, ex, P => { put(P, boite(.8, .4, .3), 0xc9a24a, 0, .5, 0, 0, .04); put(P, boite(.3, .3, .26), 0xc9a24a, .5, .7, 0, 0, .03); }, 2.6, 0, 5.6, 'glisse', 'x', 1.4, .45);
    oiseaux(L, ex, -3.6, -2.6, 5, 1.4, 3, 0xf6f6f1, .9);
    // clin d'œil, rare (quelques secondes toutes les 45 s) : une bagarre de Gaulois au poisson devant l'étal du poissonnier, dans un nuage de poussière
    const C = [-2, 1.4], BAGARRE = 1 / 45, DUREE = .14, PH = .92;
    for (const [dx, dz, k] of [[-.6, 0, 0], [.6, .2, 1], [0, -.6, 2], [.1, .7, 3]])
      piece(L, ex, P => { homme(P, 0, 0, { tunique: TARTANS[k], cheveux: CHEVEUX[k] }); poisson(P, .3, 2.2, 0, .9 - k * .5); }, C[0] + dx, .1, C[1] + dz, 'rare', 'y', DUREE, BAGARRE, PH);
    piece(L, ex, P => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put(P, sphere(.45, 1), 0xe8dcc0, Math.cos(a) * 1.1, .6 + (k % 3) * .5, Math.sin(a) * 1.1, 0, .05); } }, C[0], 0, C[1], 'rare', 'y', DUREE, BAGARRE, PH);
  },
  taverne(L, ex) {
    sol(L, 0x8fbf5a); lumiere(ex);
    maisonLongue(L, ex, -.6, -3, 6.4, 3.2);
    for (const [x, y, z] of [[3.8, .55, -3.6], [4.7, .55, -3], [4.2, 1.6, -3.3]]) { put(L, cyl(.45, .45, 1.1, 10), 0x8a5a2a, x, y, z, 0, .05); put(L, cyl(.47, .47, .1, 10), 0x3a3a3a, x, y + .3, z, 0, 0); }
    put(L, boite(4.4, .15, 1), BOIS2, -1, .9, 1.2, 0, .05); for (const z of [.4, 2]) put(L, boite(4.4, .12, .4), BOIS2, -1, .5, z, 0, .04);
    for (const [x, z] of [[-2.8, .4], [-1, .4], [.8, 2]]) { piece(L, ex, P => homme(P, 0, 0, { tunique: TARTANS[(x + 4 | 0) % 5], cheveux: CHEVEUX[(x + 4 | 0) % 4], y: -.4 }), x, .1, z, 'glisse', 'y', .08, 5, x);
      piece(L, ex, P => put(P, cone(.14, .5, 6).rotateX(Math.PI), OR, 0, 0, 0, 0, .03), x + .4, 1.35, z, 'glisse', 'y', .25, 1.8, x); }
    for (const c of [-1, 1]) put(L, boite(.15, 1.6, .15), BOIS, 3.4 + c, .8, 2.6, 0, .03);
    put(L, cyl(.04, .04, 2.4, 5).rotateZ(Math.PI / 2), FER, 3.4, 1.5, 2.6, 0, 0);
    piece(L, ex, P => { put(P, sphere(.6, 1).scale(1.5, .9, .9), 0x8a4a2a, 0, 0, 0, 0, .06); put(P, boite(.4, .35, .35), 0x7a3a1e, .95, .05, 0, 0, .04); }, 3.4, 1.5, 2.6, 'tourne', 'x', 1, 1.2);
    flamme(L, ex, 3.4, .45, 2.6, .9); fum(ex, 3.4, 1.4, 2.6, false);
    trajet(L, ex, [[-4.8, 4.4], [-3, 5.2], [-1.6, 4.2], [0, 5.4], [1.6, 4.4], [0, 3.6]], 1 / 14, 0, gens({ tunique: TARTANS[1], cheveux: CHEVEUX[0] }));
  },
  pecheurs(L, ex) {
    sol(L, 0x9fc46a); lumiere(ex);
    put(L, boite(16, .3, 3.6), EAU, 0, .1, 3.8, 0, 0);
    maisonRonde(L, ex, -3.6, -3.4, 2, 2.3);
    put(L, boite(1.2, .25, 2.8), BOIS2, -2.4, .45, 2.8, 0, .05); for (const [dx, dz] of [[-.5, 1.6], [.5, 1.6], [-.5, 3.8], [.5, 3.8]]) put(L, cyl(.1, .1, .8, 5), BOIS, -2.4 + dx, .2, dz, 0, 0);
    homme(L, -2.4, 3.8, { tunique: TARTANS[0], cheveux: CHEVEUX[1], y: .5 });
    piece(L, ex, P => { put(P, cyl(.03, .03, 3, 5).rotateZ(-1.1), BOIS2, 1.3, .6, 0, 0, 0); put(P, boite(.02, 1.4, .02), 0xf6f4ee, 2.65, -.1, 0, 0, 0); }, -2.3, 1.85, 3.9, 'oscille', 'z', .12, 1.2);
    piece(L, ex, P => { put(P, boite(2.6, .5, .8), BOIS, 0, 0, 0, 0, .05); homme(P, -.6, 0, { tunique: TARTANS[3], cheveux: CHEVEUX[0], y: -.3 }); homme(P, .6, 0, { tunique: TARTANS[2], cheveux: CHEVEUX[2], y: -.3 }); put(P, boite(.08, .08, 1.6), BOIS2, .9, .8, .3, 0, 0); }, 2.4, .35, 4.4, 'glisse', 'x', 3, .12);
    for (const c of [-1, 1]) put(L, boite(.15, 2, .15), BOIS, 3.2 + c * 1.2, 1, -1.4, 0, .03);
    put(L, boite(2.6, .08, .08), BOIS, 3.2, 1.9, -1.4, 0, 0);
    for (let k = 0; k < 5; k++) poisson(L, 2.4 + k * .4, 1.5, -1.4, -Math.PI / 2, k % 2 ? 0x9ab8c8 : 0xb8c8a8);
    piece(L, ex, P => poisson(P, 0, 0, 0, .6), 0, .2, 3.4, 'chemin', [[0, .1, 3.4, 0], [0, .1, 3.4, 0], [0, .1, 3.4, 0], [0, .1, 3.4, 0], [0, .1, 3.4, 0], [0, .1, 3.4, 0], [0, .2, 3.4, 1], [.6, 1.3, 3.4, 1], [1.2, .2, 3.4, 0]], 1, 1 / 8, 0);
    oiseaux(L, ex, 1, 3, 6, 2.6, 3, 0xf6f6f1, .5);
  },

  // ================================================================ Romains
  domus(L, ex) {
    sol(L, 0xcfc6b0); lumiere(ex);
    for (const z of [-2.6, 2.6]) { put(L, boite(8, 2.6, 2), ENDUIT, 0, 1.3, z, 0, .15); pignon(L, 2.6, 8.4, 1.2, TUILE, 0, 2.6, z, Math.PI / 2); }
    for (const x of [-3, 3]) { put(L, boite(2, 2.6, 3.2), ENDUIT, x, 1.3, 0, 0, .15); pignon(L, 2.6, 3.2, 1.2, TUILE, x, 2.6, 0); }
    put(L, boite(1.2, 1.9, .3), 0x5a3a2a, 0, .95, 3.62, 0, .06); put(L, boite(8.1, .3, .2), ROUGE, 0, .2, 3.62, 0, 0);
    put(L, boite(2.2, .2, 1.6), MARBRE, 0, .3, 0, 0, .06); put(L, boite(1.8, .12, 1.2), EAU, 0, .42, 0, 0, 0);
    for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) put(L, cyl(.16, .18, 2.4, 8), MARBRE, x, 1.2, z, 0, .05);
    piece(L, ex, P => put(P, cyl(.06, .16, .9, 6), 0xbfeeff, 0, .45, 0, 0, .04), 0, .45, 0, 'pulse', 'y', .3, 4);
    fum(ex, -3, 4, 0, false);
    cypres(L, ex, -5.4, -4.6); cypres(L, ex, 5.4, -4.4, 1.5);
    piece(L, ex, P => homme(P, 0, 0, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x4a3322 }), 0, .1, 5.4, 'marche', 'x', 2.5, .2);
    trajet(L, ex, [[-1.35, -1], [1.35, -1], [1.35, 1], [-1.35, 1]], .08, 0, gens({ tunique: 0xd9c49a, cheveux: 0x2f2c2a }), P => put(P, cyl(.18, .14, .45, 8), 0xc0703f, .35, 1.2, 0, 0, .03), [1, 1, 1, 1]);
  },
  insula(L, ex) {
    sol(L, 0xd8d0bc); lumiere(ex);
    put(L, boite(6.4, 7, 5), OCRE, 0, 3.5, -1, 0, .2);
    for (let e = 1; e <= 3; e++) for (let k = -2; k <= 2; k++) { put(L, boite(.6, .8, .1), 0x4a3322, k * 1.2, e * 1.7 + 1.2, 1.55, 0, 0); if (k > -2 && k < 2) put(L, boite(.1, .8, .6), 0x4a3322, 3.25, e * 1.7 + 1.2, k * 1.4 - 1, 0, 0); }
    for (let k = -1; k <= 1; k++) put(L, boite(1.4, 1.7, .1), 0x3a2a1e, k * 2, .85, 1.55, 0, 0);
    put(L, boite(6.6, .2, .9), BOIS2, 0, 2.6, 1.95, 0, .05); put(L, boite(6.6, .5, .08), BOIS2, 0, 2.95, 2.38, 0, 0);
    pignon(L, 5.6, 7, 1.4, TUILE, 0, 7, -1, Math.PI / 2);
    piece(L, ex, P => { put(P, boite(.8, .9, .04), 0xf6f4ee, 0, -.45, 0, 0, 0); put(P, boite(.7, .8, .04), 0x8ac0e0, 1, -.4, 0, 0, 0); }, -1.6, 4.4, 2.1, 'oscille', 'x', .25, 1.5);
    put(L, boite(4, .04, .04), 0x3a3a3a, -1, 4.4, 2.1, 0, 0);
    for (const c of [-1, 1]) piece(L, ex, P => { homme(P, 0, 0, { tunique: c > 0 ? 0xd9573b : 0x8ac0e0, cheveux: 0x4a3322 }); homme(P, 0, .6, { tunique: 0xe8cfa0, cheveux: 0x2f2c2a }); }, c * 1.5, .1, 3.6 + (c > 0 ? 1.4 : 0), 'marche', 'x', 2, .2 + c * .05);
    fum(ex, 2, 8.6, -1, false); oiseaux(L, ex, 0, -1, 10, 2.4, 4, 0x8d96a0, .9);
    trajet(L, ex, [[-6, 6.4], [6, 6.4], [6, 6.4], [-6, 6.4], [-6, 6.4]], 1 / 16, 0, gens({ tunique: 0x8a6a42, cheveux: 0x2f2c2a }), P => { put(P, cyl(.22, .12, .8, 8), 0xc0703f, -.1, 2.2, 0, 0, .03); put(P, cone(.12, .3, 6).rotateX(Math.PI), 0xc0703f, -.1, 1.65, 0, 0, 0); }, [1, 0, 0, 0, 0]);
  },
  temple(L, ex) {
    sol(L, 0xd8d0bc);
    put(L, boite(6, 1.5, 8.4), PIERRE, 0, .75, -.6, 0, .15);
    for (let k = 0; k < 3; k++) put(L, boite(4.6, .5 * (3 - k), .5), PIERRE, 0, .25 * (3 - k), 3.85 + k * .5, 0, .06);
    put(L, boite(4.4, 3.6, 4.6), MARBRE, 0, 3.3, -2.2, 0, .15);
    put(L, boite(1.2, 2.2, .1), 0x5a3a2a, 0, 2.6, .12, 0, 0);
    for (let k = 0; k < 6; k++) put(L, cyl(.24, .28, 3.6, 10), MARBRE, -2.5 + k, 3.3, 2.8, 0, .06);
    for (const z of [1.4, 0, -1.4, -2.8, -4.2]) for (const c of [-1, 1]) put(L, cyl(.24, .28, 3.6, 10), MARBRE, c * 2.6, 3.3, z, 0, .06);
    put(L, boite(5.8, .55, 7.8), MARBRE, 0, 5.38, -.7, 0, .1); put(L, boite(5.9, .18, 7.9), OR, 0, 5.2, -.7, 0, 0);
    pignon(L, 6, 8, 1.7, TUILE, 0, 5.65, -.7);
    for (const c of [-1, 1]) { put(L, cyl(.3, .4, 1.2, 8), BRONZE, c * 2.8, .6, 5.6, 0, .06); flamme(L, ex, c * 2.8, 1.5, 5.6, .8); }
    piece(L, ex, P => homme(P, 0, 0, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0xd9d4c8 }), 0, .1, 6.6, 'marche', 'x', 1.6, .15);
    oiseaux(L, ex, 0, -1, 9, 2.6);
    put(L, boite(1, .9, .8), MARBRE, 0, .45, 5.2, 0, .06); flamme(L, ex, 0, 1.2, 5.2, .6); fum(ex, 0, 1.6, 5.2, true);
    trajet(L, ex, [[-4.6, 7], [-1, 6], [-.6, 6], [-.6, 6], [3.6, 7.2], [3.6, 7.2]], .06, 0, gens({ tunique: 0xd9c49a, cheveux: 0x4a3322 }), P => put(P, sphere(.22, 1), 0xe3c75b, .4, 1.2, 0, 0, .03), [1, 1, 1, 0, 0, 0]);
  },
  forum(L, ex) {
    sol(L, 0xd8d0bc);
    put(L, boite(13, 3.6, .4), ENDUIT, 0, 1.8, -5.6, 0, .1);
    for (let k = 0; k < 7; k++) put(L, cyl(.22, .26, 3.2, 10), MARBRE, -6 + k * 2, 1.6, -3.6, 0, .05);
    put(L, boite(13, .4, 2.4), MARBRE, 0, 3.4, -4.6, 0, .08); pignon(L, 2.8, 13.2, 1, TUILE, 0, 3.6, -4.6, Math.PI / 2);
    put(L, boite(1.4, 1.8, 1.4), MARBRE, 0, .9, .4, 0, .1); homme(L, 0, .4, { tunique: BRONZE, jambes: BRONZE, cheveux: BRONZE, y: 1.8 });
    for (const [x, c] of [[-4.4, 0xd9573b], [4.4, 0x3f7fb5]]) {
      put(L, boite(2.2, .9, 1.2), BOIS2, x, .45, 3.2, 0, .06);
      for (const d of [-1, 1]) put(L, boite(.12, 2.2, .12), BOIS, x + d, 1.1, 3.8, 0, 0);
      piece(L, ex, P => { put(P, boite(2.4, .08, 1.6), c, 0, 0, 0, 0, .04); put(P, boite(2.4, .1, .3), 0xf6f4ee, 0, .02, .5, 0, 0); }, x, 2.2, 3.2, 'oscille', 'x', .06, 1.6, x);
      for (let k = 0; k < 3; k++) put(L, sphere(.25, 1), [0xe3c75b, 0x7be08a, 0xd9573b][k], x - .6 + k * .6, 1.1, 3.2, 0, .04);
    }
    for (const [x, z, axe, k] of [[-2, -1.6, 'x', 0], [2.6, 1.6, 'z', 1], [0, 5.4, 'x', 2]]) piece(L, ex, P => { homme(P, 0, 0, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x4a3322 }); homme(P, .2, .6, { tunique: [0xd9573b, 0x8ac0e0, 0xe8cfa0][k], cheveux: 0x2f2c2a }); }, x, .1, z, 'marche', axe, 1.6, .18 + k * .04);
    oiseaux(L, ex, 0, .4, 6, 1.4, 4, 0x8d96a0, 1);
    put(L, boite(1.6, .9, 1.2), MARBRE, 4, .45, -1.6, 0, .06); homme(L, 4, -1.6, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0xd9d4c8, y: .9 });
    piece(L, ex, P => { put(P, boite(.7, .12, .12), 0xf6f4ee, .35, 0, 0, 0, .03); put(P, sphere(.1, 1), PEAU, .72, 0, 0, 0, 0); }, 4.15, 2.3, -1.3, 'oscille', 'z', .5, 1.6);
    for (const [x, z, k] of [[2.4, -.6, 0], [2.6, .4, 1], [1.8, -1.6, 2]]) homme(L, x, z, { tunique: [0xd9573b, 0x8ac0e0, 0xe8cfa0][k], cheveux: 0x2f2c2a });
  },
  thermes(L, ex) {
    sol(L, 0xcfc6b0);
    put(L, boite(7.4, 3.6, 4.2), ENDUIT, -1, 1.8, -2.4, 0, .15);
    put(L, cyl(2, 2, .6, 16), 0xcfc8b8, -1, 3.9, -2.4, 0, .08); put(L, new THREE.SphereGeometry(2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xcfc8b8, -1, 4.2, -2.4, 0, .12);
    for (const c of [-1, 1]) pignon(L, 1.8, 4.4, .9, TUILE, -1 + c * 2.85, 3.6, -2.4);
    for (let k = 0; k < 4; k++) put(L, boite(.5, 1.6, .1), 0x4a3322, -3.4 + k * 1.6, 1.6, -.28, 0, 0);
    put(L, boite(.7, 2.4, .7), PIERRE, 3.4, 4.6, -3.6, 0, .06); fum(ex, 3.4, 6, -3.6, false);
    put(L, boite(7, .5, 3.8), MARBRE, 0, .25, 3, 0, .08); put(L, boite(6.2, .1, 3), EAU, 0, .52, 3, 0, 0);
    piece(L, ex, P => { put(P, sphere(.22, 1), PEAU, .5, .1, 0, 0, .04); put(P, boite(.9, .14, .35), PEAU, -.1, 0, 0, 0, .03); }, 0, .6, 3, 'glisse', 'x', 2.2, .3);
    fum(ex, 0, .8, 3, true);
    for (const x of [-3.4, 3.4]) put(L, cyl(.16, .18, 2.2, 8), MARBRE, x, 1.1, 5, 0, .05);
    piece(L, ex, P => homme(P, 0, 0, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x4a3322 }), 4.6, .1, .8, 'marche', 'z', 1.2, .2);
    piece(L, ex, P => { put(P, sphere(.22, 1), PEAU, .5, .1, 0, 0, .04); put(P, boite(.9, .14, .35), PEAU, -.1, 0, 0, 0, .03); }, 0, .6, 3.8, 'glisse', 'x', 2.2, .22, 2);
    trajet(L, ex, [[-3.8, 1.2], [3.8, 1.2], [3.8, 1.2], [-3.8, 1.2], [-3.8, 1.2]], .06, 0, gens({ tunique: 0xd9c49a, cheveux: 0x2f2c2a }), P => put(P, boite(.5, .25, .5), 0xf6f4ee, .35, 1.2, 0, 0, .03), [1, 1, 1, 1, 1]);
  },
  amphi(L, ex) {
    sol(L, 0xd8d0bc);
    const prof = [[3.7, 0], [6.8, 0], [6.8, 4.4], [6.3, 4.4], [3.9, 1.3], [3.7, 1.3]].map(([r, y]) => new THREE.Vector2(r, y));
    put(L, new THREE.LatheGeometry(prof, 28).scale(1, 1, .78), 0xd9cdb0, 0, 0, 0, 0, .15);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; for (const y of [1, 2.9]) put(L, boite(.7, 1.2, .12), 0x7a6a52, Math.cos(a) * 6.85, y, Math.sin(a) * 6.85 * .78, -a + Math.PI / 2 - Math.sin(2 * a) * .1, 0); }
    put(L, cyl(3.7, 3.7, .3, 24).scale(1, 1, .78), 0xe8d6a0, 0, .35, 0, 0, 0);
    for (let k = 0; k < 40; k++) { const a = k * .63, r = 4.4 + (k % 3) * .6, y = 1.3 + (r - 3.9) / 2.4 * 3.1; put(L, boite(.35, .5, .35), TARTANS[k % 5] ^ (k % 2 ? 0x202020 : 0), Math.cos(a) * r, y + .25, Math.sin(a) * r * .78, 0, 0); }
    for (const [c, t] of [[-1, ROUGE], [1, 0x3a5a8a]]) piece(L, ex, P => { homme(P, 0, 0, { tunique: t, casque: FER }); put(P, boite(.12, .9, .6), t, -c * .32, 1.05, 0, 0, .04); put(P, boite(.6, .07, .07), FER, c * .45, 1.2, 0, 0, 0); }, c * .9, .5, 0, 'glisse', 'x', .5, 1.6, c > 0 ? Math.PI : 0);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3, x = Math.cos(a) * 6.5, z = Math.sin(a) * 6.5 * .78; put(L, cyl(.06, .06, 2, 5), BOIS, x, 5.4, z, 0, 0); piece(L, ex, P => put(P, boite(1, .6, .05), k % 2 ? ROUGE : OR, .5, 0, 0, 0, .03), x, 6.1, z, 'oscille', 'y', .5, 1.5, k); }
    for (let k = 0; k < 10; k++) { const a = k * .63 + .3, r = 5, y = 1.3 + (r - 3.9) / 2.4 * 3.1; piece(L, ex, P => { put(P, boite(.35, .5, .35), TARTANS[(k + 2) % 5], 0, .25, 0, 0, 0); put(P, sphere(.16, 1), PEAU, 0, .62, 0, 0, 0); }, Math.cos(a) * r, y, Math.sin(a) * r * .78, 'glisse', 'y', .15, 7, k); }
  },
  aqueduc(L, ex) {
    sol(L, 0x8fbf5a);
    for (let k = 0; k < 7; k++) put(L, boite(1.2, 4, 1.1), PIERRE, -7.2 + k * 2.4, 2, -1, 0, .1);
    put(L, boite(16, .9, 1.2), PIERRE, 0, 4.45, -1, 0, .1);
    for (let k = 0; k < 13; k++) put(L, boite(.7, 2, .9), PIERRE, -7.2 + k * 1.2, 5.9, -1, 0, .08);
    put(L, boite(16, .8, 1.5), PIERRE, 0, 7.3, -1, 0, .1); put(L, boite(16, .12, .9), EAU, 0, 7.72, -1, 0, 0);
    for (let k = 0; k < 6; k++) piece(L, ex, P => put(P, boite(.9, .1, .5), 0xbfeeff, 0, 0, 0, 0, 0), 0, 7.8, -1, 'coule', 'x', 7.4, .12, k / 6);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: 0xe8cfa0, cheveux: 0x4a3322 }); homme(P, .7, .3, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x2f2c2a }); }, 0, .1, 3.2, 'marche', 'x', 3, .15);
    arbreVent(L, ex, -4.4, -4.4, 1); arbreVent(L, ex, 3.6, -4.6, .9, 1); cypres(L, ex, 5.2, 4.6, 2);
    trajet(L, ex, [[1.2, .1, 6.5], [1.2, .1, -6.5], [1.2, .1, -6.5], [1.2, .1, 6.5], [1.2, .1, 6.5]], 1 / 20, 0, P => chariot(P, 0xc0703f));
    homme(L, -4.8, -1, { tunique: 0xe8cfa0, cheveux: 0x4a3322, y: 7.7 }); outil(L, ex, -4.8, -1, PIERRE, 3);
  },
  villa(L, ex) {
    sol(L, 0xa9c66e); lumiere(ex);
    put(L, boite(6.4, 2.6, 3.2), ENDUIT, -1.4, 1.3, -3.4, 0, .15); pignon(L, 3.8, 6.8, 1.3, TUILE, -1.4, 2.6, -3.4, Math.PI / 2);
    put(L, boite(2.6, 2.6, 4), ENDUIT, 3.4, 1.3, -2, 0, .15); pignon(L, 3.2, 4.2, 1.3, TUILE, 3.4, 2.6, -2);
    for (let k = 0; k < 5; k++) put(L, cyl(.14, .16, 2.2, 8), MARBRE, -4 + k * 1.3, 1.1, -1.5, 0, .04);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) put(L, sphere(.42, 1), 0x4f8a3a, -4.4 + k * 1.1, .55, 1.4 + r * 1.2, 0, .05);
    piece(L, ex, P => chariot(P), 2.6, 0, 3.4, 'marche', 'x', 1.2, .15);
    fum(ex, -2.4, 4.2, -3.4, false); cypres(L, ex, 5.6, -5, 0); oiseaux(L, ex, 0, 2, 6, 3);
    trajet(L, ex, [[-5.4, 2], [-5.4, 4.8], [-5.4, 4.8], [-1, -1], [-1, -1]], .07, 0, gens({ tunique: 0xd9c49a, cheveux: 0x2f2c2a }), P => { put(P, cyl(.32, .25, .45, 8), 0xb08a3e, .4, 1.15, 0, 0, .03); put(P, sphere(.25, 1), 0x6a3a7a, .4, 1.45, 0, 0, 0); }, [0, 0, 1, 1, 0]);
  },
  moulin(L, ex) {
    sol(L, 0xa9c66e);
    put(L, boite(4.4, 3.4, 4.4), PIERRE, -1.6, 1.7, -2.6, 0, .15); pignon(L, 5, 5, 1.6, TUILE, -1.6, 3.4, -2.6);
    put(L, boite(1.2, 1.8, .1), 0x5a3a2a, -3, .9, -.35, 0, 0);
    put(L, boite(16, .3, 1.8), EAU, 0, .1, 1.4, 0, 0);
    put(L, boite(.3, .3, 1.8), BOIS, -.2, 2.4, .1, 0, .04);
    piece(L, ex, P => {
      put(P, cyl(2.3, 2.3, .2, 16).rotateX(Math.PI / 2), BOIS2, 0, 0, 0, 0, .08); put(P, cyl(.35, .35, .7, 8).rotateX(Math.PI / 2), BOIS, 0, 0, 0, 0, .04);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; put(P, boite(.14, .7, .8).rotateZ(a), BOIS, Math.sin(a) * -2.35, Math.cos(a) * 2.35, 0, 0, .03); }
      for (let k = 0; k < 4; k++) put(P, boite(.16, 4.4, .12).rotateZ(k * Math.PI / 4), BOIS, 0, 0, 0, 0, 0);
    }, -.2, 2.4, 1.4, 'tourne', 'z', 1, -1.2);
    for (let k = 0; k < 4; k++) piece(L, ex, P => put(P, boite(.7, .08, .6), 0xbfeeff, 0, 0, 0, 0, 0), 0, .3, 1.4, 'coule', 'x', 7.6, .15, k / 4);
    fum(ex, 1.8, .6, 1.4, true);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: 0xe8cfa0, cheveux: 0x4a3322 }); put(P, sphere(.42, 1).scale(1, .8, 1), 0xf3efe2, -.05, 2.2, 0, 0, .05); }, -1.5, .1, 4.6, 'marche', 'x', 2.5, .2);
    cypres(L, ex, 4.4, -3.6);
    for (const [x, k] of [[-4.4, 0], [3, 1]]) piece(L, ex, P => { put(P, sphere(.3, 1).scale(1.3, .8, 1), 0xf6f6f1, 0, .2, 0, 0, .05); put(P, sphere(.17, 1), 0x3f7f4a, .32, .45, 0, 0, .05); }, x, .3, 1.8, 'glisse', 'x', 1.2, .2, k * 2);
  },
  castrum(L, ex) {
    sol(L, 0xb3a98a);
    for (const [x, z, w, d] of [[0, -6, 12, .5], [-6, 0, .5, 12], [6, 0, .5, 12], [-3.75, 6, 4.5, .5], [3.75, 6, 4.5, .5]]) {
      put(L, boite(w, 2, d), 0x8a6a42, x, 1, z, 0, .1);
      const n = Math.round(Math.max(w, d) / .6);
      for (let k = 0; k < n; k++) { const t = (k + .5) / n - .5; put(L, cone(.16, .45, 4), 0x8a6a42, x + (w > d ? t * w : 0), 2.2, z + (w > d ? 0 : t * d), 0, 0); }
    }
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [-1.6, 6], [1.6, 6]]) { put(L, boite(1.3, 3.6, 1.3), BOIS2, x, 1.8, z, 0, .08); put(L, cone(1.1, 1, 4), TUILE, x, 4.1, z, Math.PI / 4, .06); }
    for (const [x, z] of [[-3.4, -3.4], [-1, -3.4], [1.4, -3.4], [-3.4, -.6], [-1, -.6], [1.4, -.6]]) pignon(L, 1.8, 2, 1.3, 0xeee6d2, x, 0, z);
    put(L, boite(2.6, 2, 2.2), ENDUIT, 3.8, 1, -2.6, 0, .1); pignon(L, 2.8, 2.4, 1, TUILE, 3.8, 2, -2.6);
    put(L, cyl(.06, .08, 4, 5), BOIS, 3.8, 2, 0, 0, 0); put(L, boite(.9, .08, .08), BOIS, 3.8, 3.6, 0, 0, 0);
    piece(L, ex, P => { put(P, boite(.9, 1.1, .05), ROUGE, 0, -.6, 0, 0, .03); put(P, boite(.5, .3, .06), OR, 0, -.5, 0, 0, 0); }, 3.8, 3.6, 0, 'oscille', 'x', .2, 1.3);
    put(L, cyl(.6, .7, .5, 8), PIERRE, 0, .25, 1.6, 0, .06); flamme(L, ex, 0, .9, 1.6, .9); fum(ex, 0, 1.6, 1.6, false);
    piece(L, ex, P => { for (let k = 0; k < 3; k++) { homme(P, k * -.9, 0, { tunique: ROUGE, casque: FER }); put(P, boite(.6, .9, .1), ROUGE, k * -.9, 1, .3, 0, .03); put(P, cyl(.03, .03, 2.2, 5), BOIS2, k * -.9 + .2, 1.5, -.2, 0, 0); } }, .5, .1, 3.8, 'marche', 'x', 2.2, .2);
    for (const [c, t] of [[-1, ROUGE], [1, 0xa83a2a]]) piece(L, ex, P => { homme(P, 0, 0, { tunique: t, casque: FER }); put(P, boite(.12, .9, .6), ROUGE, -c * .32, 1.05, 0, 0, .04); put(P, boite(.6, .07, .07), BOIS2, c * .45, 1.2, 0, 0, 0); }, -3 + c * .7, .1, 2.4, 'glisse', 'x', .4, 1.8, c > 0 ? Math.PI : 0);
    piece(L, ex, P => homme(P, .35, 0, { tunique: ROUGE, casque: FER }), -6, 3.6, -6, 'tourne', 'y', 1, .3);
  },

  macellum(L, ex) {
    sol(L, 0xd8d0bc);
    put(L, cyl(2.2, 2.2, .3, 16), MARBRE, 0, .15, 0, 0, .06);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put(L, cyl(.16, .18, 2.4, 8), MARBRE, Math.cos(a) * 1.8, 1.5, Math.sin(a) * 1.8, 0, .04); }
    put(L, cyl(2, 2, .3, 16), MARBRE, 0, 2.85, 0, 0, .06); put(L, cone(2.6, 1.4, 16), TUILE, 0, 3.7, 0, 0, .1);
    put(L, cyl(.5, .6, .4, 10), MARBRE, 0, .5, 0, 0, .04); piece(L, ex, P => put(P, cyl(.05, .14, .8, 6), 0xbfeeff, 0, .4, 0, 0, .03), 0, .7, 0, 'pulse', 'y', .3, 4);
    put(L, boite(12, 2.6, 2), ENDUIT, 0, 1.3, -5, 0, .12); pignon(L, 2.6, 12.4, 1, TUILE, 0, 2.6, -5, Math.PI / 2);
    for (let k = 0; k < 5; k++) put(L, boite(1.4, 1.8, .1), 0x3a2a1e, -4.8 + k * 2.4, .9, -3.98, 0, 0);
    for (let k = 0; k < 5; k++) { put(L, cyl(.18, .26, .8, 8), 0xc0703f, -4.4 + k * .35, .4, -3.4, 0, .03); put(L, cone(.18, .3, 6).rotateX(Math.PI), 0xc0703f, -4.4 + k * .35, -.05 + .2, -3.4, 0, 0); }
    for (let k = 0; k < 3; k++) put(L, cyl(.35, .3, .35, 8), 0xb08a3e, 2.2 + k * .8, .2, -3.4, 0, .03), put(L, sphere(.28, 1), [0xd9573b, 0xe3c75b, 0x6a3a7a][k], 2.2 + k * .8, .5, -3.4, 0, 0);
    homme(L, -2.8, -2.6, { tunique: 0xd9c49a, cheveux: 0x2f2c2a });
    piece(L, ex, P => { put(P, boite(1.2, .06, .06), BRONZE, 0, 0, 0, 0, 0); for (const c of [-1, 1]) put(P, cyl(.22, .12, .1, 8), BRONZE, c * .55, -.35, 0, 0, .02); }, -2.1, 1.6, -2.4, 'oscille', 'z', .2, 1.4);
    trajet(L, ex, [[3.2, 0], [0, 3.2], [-3.2, 0], [0, -3]], 1 / 18, 0, gens({ tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x4a3322 }));
    trajet(L, ex, [[-6, 4.6], [-3.2, -2.4], [-3.2, -2.4], [-6, 4.6], [-6, 4.6]], 1 / 15, 0, gens({ tunique: 0x8a6a42, cheveux: 0x2f2c2a }), P => { put(P, cyl(.22, .12, .8, 8), 0xc0703f, -.1, 2.2, 0, 0, .03); put(P, cone(.12, .3, 6).rotateX(Math.PI), 0xc0703f, -.1, 1.65, 0, 0, 0); }, [1, 0, 0, 0, 0]);
    trajet(L, ex, [[5.6, 4], [2.4, 4.4], [2.6, -2.6], [2.6, -2.6], [5.6, 4]], 1 / 17, .5, gens({ tunique: 0xd9573b, cheveux: 0x4a3322 }), P => put(P, cyl(.3, .22, .4, 8), 0xb08a3e, .4, 1.1, 0, 0, .03), [0, 0, 1, 1, 1]);
    oiseaux(L, ex, 0, 0, 7, 1.6, 4, 0x8d96a0, 1);
  },
  pistrinum(L, ex) {
    sol(L, 0xcfc6b0);
    put(L, boite(7, 2.8, 3), ENDUIT, 0, 1.4, -4.2, 0, .12); pignon(L, 3.6, 7.4, 1.2, TUILE, 0, 2.8, -4.2, Math.PI / 2);
    put(L, boite(1.4, 1.9, .1), 0x3a2a1e, -1.6, .95, -2.68, 0, 0);
    put(L, new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb5653a, 3.6, 0, -.4, 0, .1); put(L, boite(.8, .6, .2), 0x2a1e14, 3.6, .4, .95, 0, 0);
    flamme(L, ex, 3.6, .45, 1, .5); put(L, boite(.4, 1.2, .4), 0xb5653a, 3.6, 1.8, -1, 0, .04); fum(ex, 3.6, 2.6, -1, false);
    homme(L, 2.1, 1.5, { tunique: 0xf6f4ee, jambes: 0xf6f4ee, cheveux: 0x2f2c2a });
    piece(L, ex, P => { put(P, boite(1.8, .06, .06), BOIS2, .9, 0, 0, 0, 0); put(P, boite(.5, .04, .4), BOIS2, 1.85, 0, 0, 0, 0); }, 2.3, 1.2, 1.3, 'glisse', 'x', .35, 1);
    put(L, cyl(1, 1.1, .6, 12), PIERRE, -3, .3, 0, 0, .06); put(L, cone(.7, 1.1, 10), 0x9a9488, -3, 1.15, 0, 0, .04);
    piece(L, ex, P => { put(P, cyl(.75, .5, .7, 10), 0x8d8f96, 0, 1.3, 0, 0, .05); put(P, cyl(.5, .75, .7, 10), 0x8d8f96, 0, 2, 0, 0, .05); put(P, boite(.12, .12, 1.8), BOIS2, 0, 1.3, 1, 0, 0); ane(P, 0, 1.9); }, -3, 0, 0, 'tourne', 'y', 1, -.6);
    put(L, boite(2.6, .9, 1), BOIS2, 0, .45, 2, 0, .05); for (let k = 0; k < 6; k++) put(L, sphere(.28, 1).scale(1, .55, 1), 0xb87a3a, -1 + (k % 3) * .7, 1, 1.75 + (k > 2 ? .45 : 0), 0, .03);
    trajet(L, ex, [[-6, 5.4], [0, 3.2], [0, 3.2], [6, 5.4], [6, 5.4]], 1 / 15, 0, gens({ tunique: 0xd9573b, cheveux: 0x4a3322 }), P => put(P, sphere(.25, 1).scale(1, .55, 1), 0xb87a3a, .4, 1.15, 0, 0, .03), [0, 0, 1, 1, 0]);
  },
  theatre(L, ex) {
    sol(L, 0xd8d0bc);
    const prof = [[1.8, 0], [6.6, 0], [6.6, 4.2], [6.1, 4.2], [2, .6], [1.8, .6]].map(([r, y]) => new THREE.Vector2(r, y));
    put(L, new THREE.LatheGeometry(prof, 16, Math.PI / 2, Math.PI), 0xd9cdb0, 0, 0, -.6, 0, 0);
    for (const c of [1, -1]) { const q = prof.map(v => new THREE.Vector2(c * v.x, v.y)); put(L, new THREE.ShapeGeometry(new THREE.Shape(c > 0 ? q : q.reverse())), 0xcfc2a2, 0, 0, -.6, 0, 0); }  // les deux bouts des gradins, fermés
    put(L, new THREE.CylinderGeometry(1.8, 1.8, .25, 16, 1, false, Math.PI / 2, Math.PI), MARBRE, 0, .12, -.6, 0, 0);
    for (let k = 0; k < 30; k++) { const a = Math.PI / 2 + .12 + (k % 10) * .3, r = 2.8 + (k / 10 | 0) * 1.1, y = .6 + (r - 2) / 4.1 * 3.6; put(L, boite(.35, .5, .35), TARTANS[k % 5] ^ (k % 2 ? 0x202020 : 0), Math.sin(a) * r, y + .25, Math.cos(a) * r - .6, 0, 0); }
    put(L, boite(9, 1, 1.8), BOIS2, 0, .5, 2.4, 0, .08);
    for (let k = 0; k < 7; k++) put(L, cyl(.18, .2, 2.6, 8), MARBRE, -4 + k * 1.33, 2.3, 3.4, 0, .04);
    put(L, boite(9.2, .4, .6), MARBRE, 0, 3.8, 3.4, 0, .06);
    for (const [c, t, m] of [[-1, 0xd9573b, 0xf6f4ee], [1, 0x3a5a8a, 0xe3c75b]]) piece(L, ex, P => { homme(P, 0, 0, { tunique: t, jambes: t, cheveux: m }); put(P, sphere(.26, 1).scale(.6, 1, 1), m, .15, 1.65, 0, 0, .03); }, c * 1.6, 1.05, 2.4, 'glisse', 'x', 1.4, .35, c > 0 ? Math.PI : 0);
    for (const c of [-1, 1]) { put(L, cyl(.06, .06, 2, 5), BOIS, c * 6.4, 5.2, -.6, 0, 0); piece(L, ex, P => put(P, boite(1, .6, .05), c > 0 ? OR : ROUGE, .5, 0, 0, 0, .03), c * 6.4, 5.9, -.6, 'oscille', 'y', .5, 1.4, c); }
  },

  // ================================================================ armée gauloise
  phalange(L, ex) {
    piece(L, ex, P => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = -1.8 + i * 1.2, z = -2.2 + j * 1.2, t = TARTANS[(i + j * 2) % 5];
        homme(P, x, z, { tunique: t, jambes: TARTANS[(i + j + 3) % 5], cheveux: CHEVEUX[(i * 3 + j) % 4] });
        put(P, cyl(.48, .48, .1, 12).rotateX(Math.PI / 2).scale(1, 1.45, 1), TARTANS[(i + j + 1) % 5], x, 1.05, z + .4, 0, .05); put(P, boite(.1, 1.2, .14), BRONZE, x, 1.05, z + .46, 0, 0);
        put(P, cyl(.035, .035, 3, 5), BOIS2, x + .25, 1.9, z - .25, 0, 0); put(P, cone(.08, .3, 4), FER, x + .25, 3.5, z - .25, 0, 0);
      }
      homme(P, 3, -.4, { tunique: 0xc9a24a, jambes: 0x8a3a2a, casque: BRONZE });
      for (const c of [-1, 1]) put(P, boite(.08, .5, .3).rotateX(c * .5), 0xf6f4ee, 3, 2.1, -.4 + c * .25, 0, 0);
      put(P, boite(1, .08, .08).rotateZ(.9), FER, 3.4, 2.2, -.7, 0, 0);
      homme(P, 3, 1.4, { tunique: TARTANS[2], cheveux: CHEVEUX[1] });
      put(P, cyl(.05, .07, 2.6, 6), BRONZE, 3.2, 2.6, 1.4, 0, .03); put(P, boite(.45, .3, .3), BRONZE, 3.35, 3.95, 1.4, 0, .04); put(P, boite(.25, .12, .2), ROUGE, 3.62, 3.88, 1.4, 0, 0);
    }, 0, .1, 0, 'marche', 'x', 1.4, .45);
  },
  cavalerieG(L, ex) {
    piece(L, ex, P => { for (const [x, z, k] of [[0, -2.8, 0], [1.4, 0, 1], [0, 2.8, 2]]) cavalier(P, x, z, [0x7a5233, 0x2f2c2a, 0xc9b28a][k], TARTANS[k + 1], BRONZE, TARTANS[(k + 3) % 5]); }, -1, .1, 0, 'marche', 'x', 1.8, .3);
  },
  char(L, ex) {
    piece(L, ex, P => {
      put(P, boite(1.8, .3, 1.4), BOIS2, -1, .95, 0, 0, .06);
      for (const c of [-1, 1]) { put(P, new THREE.TorusGeometry(.55, .07, 4, 10, Math.PI), BOIS, -1, 1.1, c * .7, 0, .03); put(P, cyl(.7, .7, .12, 14).rotateX(Math.PI / 2), BOIS, -1, .7, c * .85, 0, .05); put(P, cyl(.72, .72, .08, 14).rotateX(Math.PI / 2), FER, -1, .7, c * .92, 0, 0); }
      put(P, boite(2.6, .12, .12), BOIS, .9, 1, 0, 0, 0);
      for (const c of [-1, 1]) cheval(P, 2.4, c * .55, c > 0 ? 0xc9b28a : 0x7a5233);
      homme(P, -.6, -.3, { tunique: TARTANS[0], cheveux: CHEVEUX[0], y: 1.1 });
      homme(P, -1.4, .3, { tunique: TARTANS[1], cheveux: CHEVEUX[1], casque: BRONZE, y: 1.1 });
      put(P, cyl(.45, .45, .1, 12).rotateX(Math.PI / 2).scale(1, 1.4, 1), TARTANS[2], -1.4, 2.2, .75, 0, .05); put(P, cyl(.035, .035, 2.8, 5), BOIS2, -1.1, 3, 0, 0, 0);
    }, -.6, 0, 0, 'marche', 'x', 1.6, .3);
  },
  archersG(L, ex) {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
      const x = -3 + i * 1.4, z = -2.4 + j * 1.6;
      homme(L, x, z, { tunique: TARTANS[(i + j) % 5], cheveux: CHEVEUX[(i + j * 2) % 4] });
      put(L, new THREE.TorusGeometry(.75, .04, 4, 12, Math.PI).rotateZ(-Math.PI / 2), BOIS, x + .45, 1.25, z, 0, 0);
      put(L, cyl(.12, .12, .8, 6), 0x6a4a2a, x - .3, 1.3, z - .15, 0, .03);
    }
    for (let k = 0; k < 6; k++) piece(L, ex, P => { put(P, boite(.9, .05, .05), BOIS2, 0, 0, 0, 0, 0); put(P, cone(.06, .2, 4).rotateZ(-Math.PI / 2), FER, .5, 0, 0, 0, 0); }, 1.4, 2.2 + (k % 3) * .5, -2.4 + (k % 4) * 1.6, 'coule', 'x', 2.4, .5, k / 6);
    put(L, cyl(.5, .5, 1.6, 10), 0xc9a45a, 4.4, .8, 0, 0, .08); put(L, cyl(.45, .45, .05, 10).rotateZ(Math.PI / 2), 0xd9573b, 3.88, 1.1, 0, 0, 0);
  },

  bivouacG(L, ex) {
    feuDeCamp(L, ex, 0, .4, 1.2);
    for (const c of [-1, 1]) put(L, boite(.15, 1.8, .15), BOIS, c * 1.2, .9, .4, 0, .03);
    put(L, cyl(.04, .04, 2.6, 5).rotateZ(Math.PI / 2), FER, 0, 1.75, .4, 0, 0);
    piece(L, ex, P => { put(P, sphere(.6, 1).scale(1.5, .9, .9), 0x8a4a2a, 0, 0, 0, 0, .06); put(P, boite(.4, .35, .35), 0x7a3a1e, .95, .05, 0, 0, .04); }, 0, 1.75, .4, 'tourne', 'x', 1, 1.2);
    for (let k = 0; k < 5; k++) { const a = Math.PI * .15 + k * Math.PI * .17, x = Math.cos(a) * 2.6, z = .4 + Math.sin(a) * 2.6;
      piece(L, ex, P => homme(P, 0, 0, { tunique: TARTANS[k], cheveux: CHEVEUX[k % 4], y: -.4 }), x, .1, z, 'glisse', 'y', .06, 4, k);
      if (k % 2 === 0) piece(L, ex, P => put(P, cone(.14, .5, 6).rotateX(Math.PI), OR, 0, 0, 0, 0, .03), x + .35, 1.35, z, 'glisse', 'y', .25, 1.6, k); }
    dormeur(L, ex, -4.6, 3.6, TARTANS[2], CHEVEUX[1]); dormeur(L, ex, -2.6, 5, TARTANS[4], CHEVEUX[0]);
    for (const [c, t] of [[-1, TARTANS[1]], [1, TARTANS[0]]]) piece(L, ex, P => homme(P, 0, 0, { tunique: t, cheveux: CHEVEUX[c > 0 ? 0 : 1] }), 4 + c * .45, .1, 3.6, 'glisse', 'x', .35, 2.2, c > 0 ? Math.PI : 0);
    for (let k = 0; k < 4; k++) put(L, cyl(.45, .45, .1, 12).rotateX(Math.PI / 2 - .3).scale(1, 1.35, 1), TARTANS[k], -5 + k * .5, .8, -2.6, 0, .05);
    for (let k = 0; k < 3; k++) put(L, cyl(.035, .035, 3, 5).rotateZ(.2 - k * .2), BOIS2, -3.4 + k * .3, 1.5, -3.4, 0, 0);
    for (const [x, k] of [[4.2, 0], [5.6, 1]]) piece(L, ex, P => cheval(P, 0, 0, [0x7a5233, 0xc9b28a][k]), x, 0, -3 + k * 1.2, 'glisse', 'x', .5, .15, k * 2);
    put(L, cyl(.05, .07, 2.4, 6).rotateZ(.4), BRONZE, -.8, 1.1, -3.6, 0, .03);
  },
  retranchementG(L, ex) {
    pignon(L, 2.8, 8, 1.5, 0x8a6a42, -2.6, 0, .6, Math.PI / 2);
    for (let k = 0; k < 6; k++) put(L, cyl(.2, .2, 2.8, 6).rotateX(Math.PI / 2), BOIS2, -5.6 + k * 1.2, .5 + (k % 2) * .4, 2.1, 0, .04);
    for (let k = 0; k < 4; k++) put(L, cone(.8, 1.1, 6), 0x8a6a42, 2.4 + k * 1.1, .5, .6 + (k % 2) * .5, 0, .06);
    for (let k = 0; k < 4; k++) { const x = -6 + k * 2.2; put(L, cyl(.18, .25, 3, 6).rotateZ(Math.PI / 2 - .4), BOIS, x, .7, 4.4, Math.PI / 2, .04); put(L, cone(.6, 1.2, 5).rotateX(Math.PI / 2), 0x4f8a3a, x, 1, 5.6, 0, .05); }
    put(L, cyl(.25, .3, 1.5, 6), BOIS, 4.8, .75, -3.4, 0, .05); piece(L, ex, P => arbre(P, 0, 0, 1.2), 6, 0, -4.4, 'oscille', 'z', .05, 1.2, 0);
    homme(L, 4.8, -2.4, { tunique: TARTANS[0], cheveux: CHEVEUX[0] }); outil(L, ex, 4.8, -2.4, FER, 3);
    for (const [x, k] of [[2.6, 0], [4.4, 1]]) { homme(L, x, 2.4, { tunique: TARTANS[k + 1], cheveux: CHEVEUX[k + 1] }); outil(L, ex, x, 2.4, FER, 2.5, k); }
    trajet(L, ex, [[5.6, -2], [3.4, .6], [3.4, .6], [5.6, -2], [5.6, -2]], 1 / 12, 0, gens({ tunique: TARTANS[3], cheveux: CHEVEUX[2] }), P => put(P, cyl(.18, .18, 2.2, 6).rotateX(Math.PI / 2), BOIS2, .3, 1.9, 0, 0, .03), [1, 0, 0, 0, 0]);
    trajet(L, ex, [[3, 3.4], [0, 2.8], [0, 2.8], [3, 3.4], [3, 3.4]], 1 / 10, .5, gens({ tunique: TARTANS[4], cheveux: CHEVEUX[3] }), P => put(P, cyl(.32, .25, .45, 8), 0x8a6a42, .4, 1.15, 0, 0, .03), [1, 0, 0, 0, 0]);
    homme(L, -1, -2.4, { tunique: 0xc9a24a, jambes: 0x8a3a2a, casque: BRONZE }); for (const c of [-1, 1]) put(L, boite(.08, .5, .3).rotateX(c * .5), 0xf6f4ee, -1, 2.1, -2.4 + c * .25, 0, 0);
  },
  defenseG(L, ex) {
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; charrette(L, Math.cos(a) * 4.8, Math.sin(a) * 4.8, -a, k % 3 ? 0xe8dcc0 : 0xc9b28a); }
    feuDeCamp(L, ex, 0, 0, .9);
    for (let k = 0; k < 3; k++) { const a = Math.PI * .35 + k * .5; piece(L, ex, P => { homme(P, 0, 0, { tunique: TARTANS[k], cheveux: CHEVEUX[k] }); put(P, cyl(.035, .035, 2.8, 5), BOIS2, .25, 1.6, -.3, 0, 0); put(P, cyl(.45, .45, .1, 12).rotateX(Math.PI / 2).scale(1, 1.35, 1), TARTANS[k + 1], 0, 1.05, .4, 0, .05); }, Math.cos(a) * 3.4, .1, Math.sin(a) * 3.4, 'marche', 'x', .7, .2 + k * .03, k); }
    for (let k = 0; k < 3; k++) piece(L, ex, P => homme(P, 0, 0, { tunique: TARTANS[k + 2], cheveux: CHEVEUX[(k + 2) % 4], y: -.4 }), -1.6 + k * 1.2, .1, -1.8, 'glisse', 'y', .06, 4, k);
    put(L, cyl(.08, .1, 5, 6), BOIS, 1.6, 2.5, -1.2, 0, .05);
    piece(L, ex, P => { put(P, boite(1, .55, .3), BRONZE, 0, 0, 0, 0, .06); put(P, boite(.3, .3, .26), BRONZE, .62, .08, 0, 0, .04); }, 1.6, 5.3, -1.2, 'oscille', 'y', .25, .5);
    oiseaux(L, ex, 0, 0, 7, 3, 3, 0x2f2c2a, .5);
  },

  // ================================================================ armée romaine
  legion(L, ex) {
    piece(L, ex, P => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = -2.2 + i * 1.2, z = -2.2 + j * 1.2;
        homme(P, x, z, { tunique: ROUGE, jambes: 0x6a4a2a, casque: FER });
        put(P, cyl(.31, .36, .5, 8), FER, x, 1.2, z, 0, .04);
        put(P, boite(.8, 1.2, .12), ROUGE, x, 1.05, z + .4, 0, .05); put(P, sphere(.13, 1), OR, x, 1.05, z + .48, 0, 0); put(P, boite(.82, .08, .13), OR, x, 1.62, z + .41, 0, 0);
        put(P, cyl(.035, .035, 2.4, 5), BOIS2, x + .25, 1.7, z - .2, 0, 0); put(P, cone(.05, .45, 4), FER, x + .25, 3.1, z - .2, 0, 0);
      }
      homme(P, 2.6, -.6, { tunique: ROUGE, jambes: 0x6a4a2a, casque: FER }); put(P, cyl(.31, .36, .5, 8), FER, 2.6, 1.2, -.6, 0, .04);
      put(P, boite(.14, .2, .7), ROUGE, 2.6, 2.05, -.6, 0, .03);
      homme(P, 2.6, 1.2, { tunique: ROUGE, jambes: 0x6a4a2a, casque: FER }); put(P, sphere(.3, 1).scale(1, .8, 1), 0x8a6a42, 2.6, 1.95, 1.2, 0, 0);
      put(P, cyl(.05, .05, 3.4, 6), BOIS2, 2.85, 2.6, 1.2, 0, 0); put(P, boite(.6, .45, .06), ROUGE, 3.15, 3.6, 1.2, 0, .03);
      put(P, sphere(.22, 1), OR, 2.85, 4.5, 1.2, 0, .04); for (const c of [-1, 1]) put(P, boite(.12, .55, .45).rotateX(c * .6), OR, 2.85, 4.6, 1.2 + c * .3, 0, .03);
    }, 0, .1, 0, 'marche', 'x', 1.2, .35);
  },
  tortue(L, ex) {
    piece(L, ex, P => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const x = -1.8 + i * 1.05, z = -1.05 + j * 1.05;
        homme(P, x, z, { tunique: ROUGE, jambes: 0x6a4a2a, casque: FER });
        put(P, boite(.95, .12, 1.15), ROUGE, x, 2.2, z, 0, .04); put(P, sphere(.12, 1), OR, x, 2.28, z, 0, 0);
        if (i === 3) put(P, boite(.12, 1.25, .95), ROUGE, x + .5, 1.15, z, 0, .04);
        if (j === 0 || j === 2) put(P, boite(.95, 1.25, .12), ROUGE, x, 1.15, z + (j ? .55 : -.55), 0, .04);
        if (j === 2) put(P, sphere(.12, 1), OR, x, 1.15, z + .62, 0, 0);
      }
    }, 0, .1, 0, 'marche', 'x', 1.8, .2);
  },
  cavalerieR(L, ex) {
    piece(L, ex, P => { for (const [x, z, k] of [[0, -2.8, 0], [1.4, 0, 1], [0, 2.8, 2]]) cavalier(P, x, z, [0x2f2c2a, 0x7a5233, 0xf3efe2][k], ROUGE, FER, ROUGE); }, -1, .1, 0, 'marche', 'x', 1.8, .3);
  },
  onagre(L, ex) {
    put(L, boite(3, .35, 1.6), BOIS2, -2, .5, -1.6, 0, .06);
    for (const c of [-1, 1]) { put(L, boite(.25, 1.8, .25), BOIS2, -1.6, 1.4, -1.6 + c * .7, 0, .04); put(L, cyl(.4, .4, .14, 10).rotateX(Math.PI / 2), BOIS, -3.2, .4, -1.6 + c * .85, 0, .04); put(L, cyl(.4, .4, .14, 10).rotateX(Math.PI / 2), BOIS, -.8, .4, -1.6 + c * .85, 0, .04); }
    put(L, boite(.25, .25, 1.6), BOIS2, -1.6, 2.3, -1.6, 0, .04);
    piece(L, ex, P => { put(P, boite(.18, 2.6, .18), BOIS, 0, 1.3, 0, 0, .04); put(P, sphere(.3, 1), 0x8d8f96, 0, 2.7, 0, 0, .04); }, -2.6, .7, -1.6, 'oscille', 'z', .7, 1.4);
    for (const [x, z] of [[-3.8, -3.2], [-.6, -3]]) homme(L, x, z, { tunique: ROUGE, casque: FER });
    for (let k = 0; k < 5; k++) put(L, sphere(.3, 1), 0x8d8f96, -4.6 + (k % 3) * .55, .3 + (k > 2 ? .45 : 0), -.2, 0, .04);
    for (const a of [0, 2.1, 4.2]) put(L, boite(.15, 1.6, .15).rotateZ(.3), BOIS2, 2.4 + Math.cos(a) * .45, .75, 2 + Math.sin(a) * .45, -a, .03);
    piece(L, ex, P => { put(P, boite(1.6, .3, .4), BOIS2, 0, 0, 0, 0, .04); put(P, new THREE.TorusGeometry(.8, .05, 4, 12, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), BOIS, .5, 0, 0, 0, 0); put(P, boite(1.2, .06, .06), FER, .3, .2, 0, 0, 0); }, 2.4, 1.65, 2, 'oscille', 'y', .5, .4);
    homme(L, 1.4, 2.6, { tunique: ROUGE, casque: FER }); homme(L, 3.6, 3.2, { tunique: ROUGE, casque: FER });
  },
  bivouacR(L, ex) {
    for (let k = 0; k < 4; k++) pignon(L, 2.2, 2.6, 1.7, 0xd9c49a, -4.2 + k * 2.8, 0, -3.8);
    for (let k = 0; k < 4; k++) put(L, boite(.5, 1.2, .1), 0x3a2a1e, -4.2 + k * 2.8, .6, -2.48, 0, 0);
    for (const x of [5.2, 6]) for (let k = 0; k < 3; k++) { const a = k * 2.1; put(L, boite(.07, 2.4, .07).rotateZ(.22), BOIS2, x + Math.cos(a) * .3, 1.15, -.6 + Math.sin(a) * .3, -a, 0); }
    feuDeCamp(L, ex, .6, .4, .9); marmite(L, ex, 2.4, 1.6, ROUGE, 0x2f2c2a, FER);
    put(L, cyl(.6, .6, .08, 12), ROUGE, -3, .3, 1.8, 0, .03);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; piece(L, ex, P => homme(P, 0, 0, { tunique: ROUGE, casque: FER, y: -.4 }), -3 + Math.cos(a) * 1.1, .1, 1.8 + Math.sin(a) * 1.1, 'glisse', 'y', .05, 3, k); }
    piece(L, ex, P => put(P, boite(.2, .2, .2), 0xf6f4ee, 0, 0, 0, 0, .02), -3, .5, 1.8, 'chemin', [[-3.2, .45, 1.6, 1], [-2.9, 1.3, 1.8, 1], [-2.7, .45, 2, 1], [-2.7, .45, 2, 1], [-2.7, .45, 2, 1], [-2.7, .45, 2, 0]], 1, 1 / 4, 0);
    dormeur(L, ex, -5, 4.2, ROUGE, 0x2f2c2a);
    homme(L, 4.4, 3, { tunique: ROUGE, casque: FER, y: -.4 }); outil(L, ex, 4.4, 2.6, FER, 3);
    put(L, cyl(.05, .05, 3.4, 6), BOIS2, 2.4, 1.7, -1.6, 0, 0); put(L, sphere(.22, 1), OR, 2.4, 3.5, -1.6, 0, .04); for (const c of [-1, 1]) put(L, boite(.12, .5, .4).rotateX(c * .6), OR, 2.4, 3.6, -1.6 + c * .28, 0, .03);
    piece(L, ex, P => { put(P, boite(.9, 1.1, .05), ROUGE, 0, -.6, 0, 0, .03); put(P, boite(.5, .3, .06), OR, 0, -.5, 0, 0, 0); }, 2.4, 3, -1.4, 'oscille', 'x', .2, 1.3);
    piece(L, ex, P => { homme(P, 0, 0, { tunique: ROUGE, casque: FER }); put(P, boite(.8, 1.2, .12), ROUGE, 0, 1.05, .4, 0, .04); put(P, cyl(.035, .035, 2.4, 5), BOIS2, .25, 1.6, -.2, 0, 0); }, 0, .1, 5.6, 'marche', 'x', 3, .15);
  },
  retranchementR(L, ex) {
    put(L, boite(15, .2, 1.8), 0x6a5034, 0, .16, 3.2, 0, 0);
    pignon(L, 2.8, 9, 1.5, 0x8a6a42, -2.6, 0, .9, Math.PI / 2);
    for (let k = 0; k < 11; k++) put(L, cyl(.08, .1, 1.3, 5), BOIS2, -6.6 + k * .8, 2.1, .9, 0, .02);
    for (let k = 0; k < 4; k++) put(L, cone(.8, 1, 6), 0x8a6a42, 2.6 + k * 1.1, .5, .9 + (k % 2) * .5, 0, .06);
    for (let k = 0; k < 6; k++) put(L, cyl(.08, .1, 1.6, 5).rotateZ(Math.PI / 2), BOIS2, 5.4, .3 + (k % 3) * .18, -2.8 + (k >> 1) * .2, 0, .02);
    for (const [x, k] of [[-3.6, 0], [-1.4, 1], [.8, 2]]) { homme(L, x, 4.4, { tunique: ROUGE, casque: FER }); outil(L, ex, x, 4.4, FER, 2.6, k); }
    for (let k = 0; k < 2; k++) trajet(L, ex, [[3, 3.6], [3.4, 1.8], [3.4, 1.8], [3, 3.6], [3, 3.6]], 1 / 9, k * .5, gens({ tunique: ROUGE, casque: FER }), P => put(P, cyl(.32, .25, .45, 8), 0x8a6a42, .4, 1.15, 0, 0, .03), [1, 0, 0, 0, 0]);
    homme(L, 1.6, -.6, { tunique: ROUGE, casque: FER }); outil(L, ex, 1.6, -.6, 0x6a4a2a, 4);
    trajet(L, ex, [[5.4, -2.2], [1.2, -.8], [1.2, -.8], [5.4, -2.2], [5.4, -2.2]], 1 / 11, .3, gens({ tunique: ROUGE, casque: FER }), P => put(P, cyl(.07, .07, 1.6, 5).rotateZ(Math.PI / 2), BOIS2, 0, 1.9, 0, 0, .02), [1, 0, 0, 0, 0]);
    homme(L, 5.6, 2.4, { tunique: ROUGE, jambes: 0x6a4a2a, casque: FER }); put(L, boite(.14, .2, .7), ROUGE, 5.6, 2.05, 2.4, 0, .03);
    piece(L, ex, P => put(P, boite(.07, .9, .07), BOIS2, 0, .45, 0, 0, 0), 5.9, 1.3, 2.4, 'oscille', 'z', .4, 1.2);
  },
  defenseR(L, ex) {
    put(L, boite(15, .2, 1.8), 0x6a5034, 0, .16, 3.4, 0, 0);
    for (let k = 0; k < 9; k++) { put(L, cyl(.3, .2, .2, 8), 0x5a4030, -6.4 + k * 1.6, .28, 5.2, 0, 0); put(L, cone(.06, .5, 4), BOIS2, -6.4 + k * 1.6, .5, 5.2, 0, 0); }
    for (const c of [-1, 1]) { pignon(L, 2.8, 5.8, 1.5, 0x8a6a42, c * 4.3, 0, 1, Math.PI / 2); for (let k = 0; k < 8; k++) put(L, cyl(.08, .1, 1.3, 5), BOIS2, c * 4.3 - 2.8 + k * .8, 2.1, 1, 0, .02); }
    for (const c of [-1, 1]) { for (const [dx, dz] of [[-.8, -.2], [.8, -.2], [-.8, 2.2], [.8, 2.2]]) put(L, boite(.22, 4.4, .22), BOIS, c * 1.4 + dx, 2.2, dz, 0, .04); put(L, boite(2, .25, 2.8), BOIS2, c * 1.4, 4.4, 1, 0, .05); put(L, cone(1.7, 1.2, 4), TUILE, c * 1.4, 5.2, 1, Math.PI / 4, .06); }
    for (const c of [-1, 1]) put(L, boite(1.1, 2, .15), BOIS2, c * .4, 1, 2.2, c * .4, .04);
    for (const c of [-1, 1]) piece(L, ex, P => { homme(P, 0, 0, { tunique: ROUGE, casque: FER }); put(P, cyl(.035, .035, 2.4, 5), BOIS2, .25, 1.6, -.2, 0, 0); }, c * 4.3, 1.55, .4, 'marche', 'x', 1.6, .2);
    for (const c of [-1, 1]) homme(L, c * 1.4, 1, { tunique: ROUGE, casque: FER, y: 4.55 });
    put(L, cyl(.05, .05, 2, 5), BOIS, 1.4, 6.6, 1, 0, 0);
    piece(L, ex, P => put(P, boite(1, .6, .05), ROUGE, .5, 0, 0, 0, .03), 1.4, 7.3, 1, 'oscille', 'y', .5, 1.4);
    for (let k = 0; k < 3; k++) pignon(L, 1.8, 2.2, 1.4, 0xd9c49a, -3 + k * 3, 0, -3.6);
    feuDeCamp(L, ex, 4.4, -3.2, .7);
  },
};
// les armées, plus grandes que nature pour se lire sur leur case : le dessin et ses pièces sont agrandis de k, le sol non
function plusGrand(k, col, f) {
  const agrandir = Q => { for (const g of [...Q.g, ...Q.o]) g.scale(k, k, k); };
  return (L, ex) => {
    sol(L, col);
    const L2 = lot(), ex2 = ex?.pieces ? { ...ex, pieces: [] } : ex;
    f(L2, ex2); agrandir(L2); L.g.push(...L2.g); L.o.push(...L2.o);
    if (ex?.pieces) for (const p of ex2.pieces) ex.pieces.push({ ...p, dessin: P => { const Q = lot(); p.dessin(Q); agrandir(Q); P.g.push(...Q.g); P.o.push(...Q.o); },
      pos: p.pos.map(v => v * k), amp: ['glisse', 'marche', 'coule'].includes(p.a) ? p.amp * k : p.amp });
  };
}
for (const [cle, col, k] of [['phalange', 0x8fbf5a, 1.5], ['cavalerieG', 0x9fc46a, 1.35], ['char', 0x9fc46a, 1.35], ['archersG', 0x8fbf5a, 1.5],
  ['legion', 0xb3a98a, 1.5], ['tortue', 0xb3a98a, 1.6], ['cavalerieR', 0xa9a07a, 1.35], ['onagre', 0xb3a98a, 1.4],
  ['bivouacG', 0x8fbf5a, 1], ['retranchementG', 0x8fbf5a, 1], ['defenseG', 0x9fc46a, 1], ['bivouacR', 0xa9c66e, 1], ['retranchementR', 0x8fbf5a, 1], ['defenseR', 0x8fbf5a, 1]]) ANT[cle] = plusGrand(k, col, ANT[cle]);

/** Le catalogue : une entrée par modèle de ANT (clé, nom, groupe), dans l'ordre de la vitrine. */
export const ANTIQUES = [
  ['hutte', 'Maison gauloise (bois, torchis, chaume)', 'Gaulois'], ['longue', 'Maison longue', 'Gaulois'], ['chef', 'Maison du chef', 'Gaulois'],
  ['grenier', 'Greniers sur pilotis', 'Gaulois'], ['ferme', 'Ferme gauloise', 'Gaulois'], ['forge', 'Forge', 'Gaulois'], ['potier', 'Atelier du potier', 'Gaulois'],
  ['sanctuaire', 'Sanctuaire (nemeton)', 'Gaulois'], ['oppidum', 'Porte d’oppidum (murus gallicus)', 'Gaulois'], ['tour', 'Tour de guet', 'Gaulois'],
  ['marcheG', 'Marché gaulois', 'Gaulois'], ['taverne', 'Cervoiserie (taverne)', 'Gaulois'], ['pecheurs', 'Port de pêche', 'Gaulois'],
  ['domus', 'Domus', 'Romains'], ['insula', 'Insula', 'Romains'], ['temple', 'Temple', 'Romains'], ['forum', 'Forum', 'Romains'], ['thermes', 'Thermes', 'Romains'],
  ['amphi', 'Amphithéâtre', 'Romains'], ['aqueduc', 'Aqueduc', 'Romains'], ['villa', 'Villa rustica', 'Romains'], ['moulin', 'Moulin à eau', 'Romains'], ['castrum', 'Camp romain (castrum)', 'Romains'],
  ['macellum', 'Marché romain (macellum)', 'Romains'], ['pistrinum', 'Boulangerie (pistrinum)', 'Romains'], ['theatre', 'Théâtre', 'Romains'],
  ['phalange', 'Phalange gauloise', 'Armée gauloise'], ['cavalerieG', 'Cavalerie gauloise', 'Armée gauloise'], ['char', 'Char de guerre', 'Armée gauloise'], ['archersG', 'Archers gaulois', 'Armée gauloise'],
  ['legion', 'Légion (centurie, aigle et centurion)', 'Armée romaine'], ['tortue', 'Tortue (testudo)', 'Armée romaine'], ['cavalerieR', 'Cavalerie romaine (equites)', 'Armée romaine'], ['onagre', 'Onagre et scorpion', 'Armée romaine'],
  ['bivouacG', 'Bivouac gaulois (au repos)', 'Armée gauloise'], ['retranchementG', 'Retranchement gaulois (en travaux)', 'Armée gauloise'], ['defenseG', 'Position défensive gauloise (cercle de chariots)', 'Armée gauloise'],
  ['bivouacR', 'Bivouac romain (au repos)', 'Armée romaine'], ['retranchementR', 'Retranchement romain (en travaux)', 'Armée romaine'], ['defenseR', 'Position défensive romaine (camp retranché)', 'Armée romaine'],
].map(([cle, nom, groupe]) => ({ cle, nom, groupe }));

export { ANT, homme, cheval, cavalier, maisonRonde, maisonLongue, trajet, poule, mouton, chariot, ane, poisson, flamme, pignon, dormeur, feuDeCamp, marmite };
