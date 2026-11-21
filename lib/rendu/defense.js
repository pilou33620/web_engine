// Le tower defense (web_defense) : tours, ennemis, projectiles, effets et villes à défendre, dans le style des modèles du moteur
// (proportions, palette et personnages d'antiques.js et de modeles.js, contours fins, unités de 10 par case).
// Quinze époques (ERES), de l'Antiquité à 2035, regroupées en cinq styles de dessin : antique, poudre (1700 → 1816),
// guerres (1900 → 1946), moderne (1960 → 1990) et futur (2005 → 2035). Quatre rôles de tour (rapide, zone, lent, loin)
// et quatre genres d'ennemi (fantassin, rapide, lourd, chef) changent d'aspect avec le style.
//
// Animations : les tours vivent (drapeaux, flammes, fumées, radars, noyaux lumineux) et jouent leur tir quand le jeu appelle
// tirer(t) (recul, bras de l'onagre, levier de la pompe, mitrailleuse qui tremble, missile qui part) ; elles sortent de terre à la
// construction. Les ennemis marchent quand le jeu appelle avancer(e, distance, dt) (jambes, sabots, roues, hélices) et tombent
// avec abattre(e).
import { THREE, scene, chaqueImage } from './scene.js';
import { lot, put, fige, boite, cyl, cone, sphere } from './toon.js';
import { bouffee } from './vie.js';
import { maillageBatiment, tete as coiffe1700, canon as canon1700 } from './modeles.js';
import { modele, animer, QBAT } from './modernes.js';
import { ANT, homme } from './antiques.js';
import { animerPose, oublierPose } from './monde.js';

// ------------------------------------------------------------------ catalogue
/** Les quinze époques du jeu, dans l'ordre : style de dessin, niveau des routes (routes.js), couleur des ennemis, bâtiments de la ville,
 *  tenue des soldats de 1700 à 1816 (pal : 0 tricorne, 3 bicorne, 4 shako). */
export const ERES = [
  { cle: 'antiquite', an: -52, nom: 'Antiquité', style: 'antique', route: 1, couleur: 0xb3302a },
  { cle: 'ancien', an: 1700, nom: 'Ancien Régime', style: 'poudre', route: 2, couleur: 0xe8e2d0, bat: 'ancien', pal: 0 },
  { cle: 'lumieres', an: 1750, nom: 'Lumières', style: 'poudre', route: 3, couleur: 0xb8322a, bat: 'lumieres', pal: 1 },
  { cle: 'empire', an: 1789, nom: 'Révolution et Empire', style: 'poudre', route: 4, couleur: 0x2a6a3a, bat: 'empire', pal: 3 },
  { cle: 'industrie', an: 1816, nom: 'Révolution industrielle', style: 'poudre', route: 5, couleur: 0x3a4a8a, bat: 'industrie', pal: 4 },
  { cle: 'pionniers', an: 1900, nom: 'Les pionniers', style: 'guerres', route: 5, couleur: 0x6a7a4a },
  { cle: 'entre_deux', an: 1920, nom: 'L’entre-deux-guerres', style: 'guerres', route: 5, couleur: 0x7a6a4a },
  { cle: 'regional', an: 1935, nom: 'Les années trente', style: 'guerres', route: 5, couleur: 0x5a6a6a },
  { cle: 'reconstruction', an: 1946, nom: 'La reconstruction', style: 'guerres', route: 5, couleur: 0x4a5a3a },
  { cle: 'glorieuses', an: 1960, nom: 'Les Trente Glorieuses', style: 'moderne', route: 5, couleur: 0x5a6a3a },
  { cle: 'choc', an: 1974, nom: 'Le choc pétrolier', style: 'moderne', route: 5, couleur: 0x8a7a5a },
  { cle: 'marche', an: 1990, nom: 'La fin du siècle', style: 'moderne', route: 5, couleur: 0x4a4a4a },
  { cle: 'climat', an: 2005, nom: 'Le climat', style: 'futur', route: 5, couleur: 0x8a2a6a },
  { cle: 'transition', an: 2020, nom: 'La transition', style: 'futur', route: 5, couleur: 0x2a2a3a },
  { cle: 'futur', an: 2035, nom: 'Le futur', style: 'futur', route: 5, couleur: 0xc0303a },
];
/** Les noms des tours et des ennemis par style, et le projectile de chaque tour. */
export const STYLES = {
  antique: {
    tours: { rapide: ['Tour d’archers', 'fleche'], zone: ['Onagre', 'pierre'], lent: ['Chaudron de poix', 'poix'], loin: ['Scorpion', 'carreau'] },
    pieges: ['Chausse-trappes', 'Fossé boueux', 'Fosse à feu', 'Abattis'],
    ennemis: { fantassin: 'Légionnaires', rapide: 'Cavaliers', lourd: 'Tortue romaine', chef: 'Éléphant de guerre' },
  },
  poudre: {
    tours: { rapide: ['Redoute des fusiliers', 'balle'], zone: ['Canon', 'boulet'], lent: ['Pompe à bras', 'eau'], loin: ['Couleuvrine', 'boulet'] },
    pieges: ['Chevaux de frise', 'Marais inondé', 'Fougasse', 'Gabions'],
    ennemis: { fantassin: 'Fusiliers', rapide: 'Dragons', lourd: 'Grenadiers', chef: 'Canon de siège' },
  },
  guerres: {
    tours: { rapide: ['Nid de mitrailleuse', 'balle'], zone: ['Obusier', 'obus'], lent: ['Pompe à vapeur', 'eau'], loin: ['Canon long', 'obus'] },
    pieges: ['Barbelés', 'Tranchée inondée', 'Mine', 'Hérissons'],
    ennemis: { fantassin: 'Fantassins', rapide: 'Motocyclistes', lourd: 'Char', chef: 'Zeppelin' },
  },
  moderne: {
    tours: { rapide: ['Tourelle double', 'balle'], zone: ['Lance-roquettes', 'roquette'], lent: ['Canon à eau', 'eau'], loin: ['Lance-missiles', 'roquette'] },
    pieges: ['Herse à clous', 'Mousse collante', 'Mine antichar', 'Blocs de béton'],
    ennemis: { fantassin: 'Soldats', rapide: 'Jeeps', lourd: 'Char d’assaut', chef: 'Hélicoptère' },
  },
  futur: {
    tours: { rapide: ['Tourelle laser', 'laser'], zone: ['Mortier à plasma', 'plasma'], lent: ['Rayon cryogénique', 'glace'], loin: ['Canon électrique', 'laser'] },
    pieges: ['Champ de lames', 'Champ de gravité', 'Mine à impulsion', 'Mur de force'],
    ennemis: { fantassin: 'Robots', rapide: 'Drones', lourd: 'Glisseur blindé', chef: 'Méca géant' },
  },
};
export const ROLES = ['rapide', 'zone', 'lent', 'loin'];
/** Les pièges, posés sur le chemin : dans l'ordre des noms de STYLES[style].pieges. */
export const PIEGES = ['pointes', 'boue', 'mine', 'barrage'];
export const GENRES = ['fantassin', 'rapide', 'lourd', 'chef'];
/** Les ennemis volants (au-dessus du chemin). */
export const VOLANTS = new Set(['guerres:chef', 'moderne:chef', 'futur:rapide']);

// ------------------------------------------------------------------ palette (celle d'antiques.js, de modeles.js et de modernes.js)
const BOIS = 0x6e4a2c, BOIS2 = 0x8a6a42, CHAUME = 0xc9a45a, CHAUME2 = 0xb08a3e, PIERRE = 0xb9b2a2, PIERRE2 = 0x9d968a,
  FER = 0x9aa3ad, FONTE = 0x3a3a3e, BRONZE = 0xb08d57, OR = 0xe0b23a, ROUGE = 0xb3302a, BLANC = 0xf2efe6, NOIR = 0x1f1f1f, PEAU = 0xf1c9a0,
  TERRE = 0xb9a77a, PAVE = 0xcfc6b0, SAC = 0xc8b585, HORIZON = 0x7d8fa8, BETON = 0xb4b2aa, BETON2 = 0x8f8d86, OLIVE = 0x5d6b45,
  BLANCF = 0xe8ecf0, GRISF = 0x4a5260, CYAN = 0x5ff0ff, MAGENTA = 0xe040ff, GIVRE = 0xc8f4ff, FEU = 0xffa030, EAU = 0x5fb0e8, VERRE = 0x3a4652;
const TARTANS = [0x3f7a4a, 0x8a3a2a, 0x3a5a8a, 0xc9a24a, 0x6a4a7a], CHEVEUX = [0xe0c070, 0xb5552a, 0x8a5a2a, 0xd9b060];
const JOUEUR = 0x2f5fa8, ECH = 0.1;
const PALIERS = [{ tete: 'tricorne' }, { tete: 'tricorne' }, { tete: 'tricorne' }, { tete: 'bicorne' }, { tete: 'shako' }];

// formes tournées : un fût dans l'axe z (l'avant du modèle), une roue dans l'axe x
const futZ = (r1, r2, l, s = 10) => cyl(r1, r2, l, s).rotateX(Math.PI / 2);
const roueX = (r, ep = 0.18, s = 12) => cyl(r, r, ep, s).rotateZ(Math.PI / 2);
const P_ = (L, g, c, x, y, z, ry = 0, ep = 0.05) => put(L, g, c, x, y, z, ry, ep);

// ------------------------------------------------------------------ atelier : un lot fixe et des parties mobiles
// Une partie : { dessin(P) autour de son pivot, pos, type, … } ; types des tours : recul, bascule, pompe, vibre, depart (tirs),
// tourne, pulse, oscille, flotte, clignote (en continu) ; types des ennemis : jambe, roue, helice.
const atelier = () => ({ L: lot(), parts: [], fum: [], jambes: new Map() });
function mobile(A, type, x, y, z, dessin, o = {}) { A.parts.push({ type, pos: [x, y, z], dessin, amp: 0.4, v: 1, ph: 0, ...o }); }
/** Une jambe (ou une patte) qui pivote à la hanche (y, z) ; les jambes de même hanche et de même pas forment une seule partie. */
function jambe(A, y, z, ph, dessin, amp = 0.55) {
  const k = `${y}|${z}|${ph}`;
  if (!A.jambes.has(k)) { const liste = []; A.jambes.set(k, liste); mobile(A, 'jambe', 0, y, z, P => liste.forEach(f => f(P)), { ph, amp }); }
  A.jambes.get(k).push(dessin);
}
/** Fige un atelier : le groupe fixe et les parties (géométries partagées par toutes les copies). */
function figer(A) { return { fixe: fige(A.L), parts: A.parts.map(p => { const P = lot(); p.dessin(P); const g = fige(P); if (p.flou) g.add(flou(p.flou, p.axe)); return { ...p, g }; }), fum: A.fum }; }
// le flou d'une hélice qui tourne vite : un disque translucide dans le plan des pales (les pales, elles, tournent assez lentement
// pour que l'œil les suive : trop vite, elles sautent d'un quart de tour entre deux images et semblent figées ou à l'envers)
const MAT_FLOU = new THREE.MeshBasicMaterial({ color: 0xe6ebf0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
function flou(r, axe = 'y') {
  const g = new THREE.CircleGeometry(r, 28);
  if (axe === 'y') g.rotateX(-Math.PI / 2); else if (axe === 'x') g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, MAT_FLOU); m.renderOrder = 3; return m;
}
/** Une copie : un groupe, ses parties posées à leur pivot. */
function copier(pr) {
  const g = new THREE.Group(); g.add(pr.fixe.clone());
  const parts = pr.parts.map(p => { const o = p.g.clone(); o.position.set(...p.pos); if (p.rx) o.rotation.x = p.rx; g.add(o); return { ...p, o }; });
  return { g, parts };
}
const PROTOS = new Map();
function proto(cle, f) { let p = PROTOS.get(cle); if (!p) { p = f(); PROTOS.set(cle, p); } return p; }

// ------------------------------------------------------------------ personnages (tournés vers +z, hauts d'environ 2,4)
// coiffe : 'romain', 'gaulois', 'tricorne', 'bicorne', 'shako', 'bonnet', 'adrian', 'casque', 'robot' ; arme : 'pilum', 'fusil' (à l'épaule),
// 'vise' (en joue), 'arc', 'lance' ; bouclier : 'scutum' ; sac : sur le dos ; J : l'atelier où ses jambes marchent (sinon immobiles).
function soldat(L, x, z, o = {}) {
  const t = o.tenue ?? ROUGE, y = o.y ?? 0, A = o.J, robot = o.coiffe === 'robot', pant = o.jambes ?? (robot ? GRISF : 0x5a4a3a);
  for (const [dx, ph] of [[-0.16, 0], [0.16, Math.PI]]) {
    if (A) jambe(A, y + 0.9, z, ph, P => P_(P, boite(0.24, 0.9, 0.3), pant, x + dx, -0.45, 0));
    else P_(L, boite(0.24, 0.9, 0.3), pant, x + dx, y + 0.45, z);
  }
  const long = o.long ?? true;
  P_(L, boite(0.75, long ? 1.2 : 0.95, 0.5), t, x, y + (long ? 1.25 : 1.38), z, 0, 0.07);
  P_(L, boite(0.8, 0.1, 0.55), o.ceinture ?? (robot ? CYAN : 0x4a3322), x, y + 1.18, z, 0, 0);
  for (const s of [-1, 1]) P_(L, boite(0.2, 0.85, 0.26), t, x + s * 0.48, y + 1.45, z + (o.arme === 'vise' ? 0.2 : 0), 0, 0.04);
  P_(L, robot ? boite(0.5, 0.48, 0.48) : sphere(0.28, 1), robot ? BLANCF : PEAU, x, y + 2.1, z, 0, 0.05);
  const c = o.coiffe;
  if (c === 'romain') { P_(L, cyl(0.2, 0.31, 0.26, 8), FER, x, y + 2.3, z); P_(L, boite(0.12, 0.22, 0.6), ROUGE, x, y + 2.55, z, 0, 0.03); }
  else if (c === 'gaulois') { P_(L, sphere(0.29, 1).scale(1, 0.7, 1), o.cheveux ?? CHEVEUX[0], x, y + 2.2, z - 0.04, 0, 0); }
  else if (c === 'tricorne' || c === 'bicorne' || c === 'shako' || c === 'kepi') coiffe1700(L, { tete: c }, x, y + 2.32, z, t);
  else if (c === 'bonnet') P_(L, cyl(0.28, 0.33, 0.7, 8), NOIR, x, y + 2.6, z);
  else if (c === 'adrian') { P_(L, sphere(0.33, 1).scale(1, 0.55, 1.1), o.casqueC ?? HORIZON, x, y + 2.3, z); P_(L, boite(0.04, 0.12, 0.5), o.casqueC ?? HORIZON, x, y + 2.45, z, 0, 0); }
  else if (c === 'casque') P_(L, sphere(0.34, 1).scale(1, 0.62, 1.05), o.casqueC ?? OLIVE, x, y + 2.26, z);
  else if (robot) P_(L, boite(0.42, 0.1, 0.06), CYAN, x, y + 2.14, z + 0.25, 0, 0);
  if (o.sac) P_(L, boite(0.6, 0.6, 0.3), o.sacC ?? 0x6a5a3a, x, y + 1.5, z - 0.4, 0, 0.04);
  const a = o.arme;
  if (a === 'fusil') { P_(L, boite(0.09, 2, 0.09), o.armeC ?? BOIS, x + 0.42, y + 1.6, z + 0.18, 0, 0); if (o.baionnette) P_(L, boite(0.04, 0.42, 0.04), 0xd9d9d9, x + 0.42, y + 2.8, z + 0.18, 0, 0); }
  if (a === 'vise') { P_(L, boite(0.09, 0.12, 1.9), o.armeC ?? BOIS, x + 0.16, y + 1.82, z + 0.75, 0, 0); if (o.baionnette) P_(L, boite(0.04, 0.04, 0.4), 0xd9d9d9, x + 0.16, y + 1.84, z + 1.9, 0, 0); }
  if (a === 'pilum') { P_(L, cyl(0.035, 0.035, 2.6, 5), BOIS2, x + 0.45, y + 1.7, z + 0.1, 0, 0); P_(L, cone(0.06, 0.5, 4), FER, x + 0.45, y + 3.2, z + 0.1, 0, 0); }
  if (a === 'lance') { P_(L, cyl(0.035, 0.035, 3.2, 5), BOIS2, x + 0.45, y + 1.9, z + 0.1, 0, 0); P_(L, cone(0.08, 0.45, 4), FER, x + 0.45, y + 3.7, z + 0.1, 0, 0); }
  if (o.bouclier === 'scutum') { P_(L, boite(0.85, 1.25, 0.12), ROUGE, x - 0.2, y + 1.3, z + 0.4, 0, 0.04); P_(L, sphere(0.13, 1), OR, x - 0.2, y + 1.3, z + 0.48, 0, 0); P_(L, boite(0.87, 0.08, 0.13), OR, x - 0.2, y + 1.85, z + 0.41, 0, 0); }
}
/** Un cheval (tourné vers +z, dos à 1,8), ses pattes marchent si A est donné ; le cavalier se pose avec soldat(…, { y: 1.15 }). */
function cheval(L, A, x, z, robe = 0x6b4226) {
  P_(L, boite(0.7, 0.85, 1.9), robe, x, 1.35, z, 0, 0.07); P_(L, boite(0.4, 0.9, 0.45), robe, x, 1.95, z + 0.95); P_(L, boite(0.35, 0.35, 0.7), robe, x, 2.3, z + 1.25);
  P_(L, boite(0.12, 0.55, 0.3), 0x2a1d14, x, 2.25, z + 0.75, 0, 0); P_(L, boite(0.12, 0.6, 0.12), 0x2a1d14, x, 1.5, z - 1.05, 0, 0);
  for (const [dx, dz, ph] of [[-0.22, 0.7, 0], [0.22, 0.7, Math.PI], [-0.22, -0.7, Math.PI], [0.22, -0.7, 0]]) {
    if (A) jambe(A, 0.95, z + dz, ph, P => P_(P, boite(0.16, 0.95, 0.16), 0x4a2c18, x + dx, -0.47, 0, 0, 0), 0.6);
    else P_(L, boite(0.16, 0.95, 0.16), 0x4a2c18, x + dx, 0.47, z + dz, 0, 0);
  }
}
/** Un essieu et ses deux roues (écartement e ; 0 : une seule roue), qui tournent quand l'ennemi avance (rayon r, unités du modèle). */
function essieu(A, y, z, e, r, col = BOIS, rayons = true) {
  mobile(A, 'roue', 0, y, z, P => { for (const s of e ? [-1, 1] : [0]) { P_(P, roueX(r, 0.16, 12), col, s * e, 0, 0); if (rayons) for (let k = 0; k < 3; k++) P_(P, boite(0.06, r * 1.9, 0.08).rotateX(k * Math.PI / 3), BOIS2, s * (e + 0.1), 0, 0, 0, 0); } }, { r });
}
/** Un essieu immobile (véhicule des tours) : deux roues de rayon r écartées de ±e, moyeux de couleur col. */
function essieuFixe(L, y, z, e, r, col = NOIR) { for (const s of [-1, 1]) { P_(L, roueX(r, 0.2, 12), 0x2a2a2a, s * e, y, z, 0, 0.04); P_(L, roueX(r * 0.5, 0.22, 8), col, s * e, y, z, 0, 0); } }
/** Un drapeau qui flotte au vent : hampe, et le tissu (couleur, croix blanche si croix). */
function drapeau(A, x, y, z, h, col = JOUEUR, croix = true, hampe = BOIS) {
  P_(A.L, cyl(0.06, 0.07, h, 5), hampe, x, y + h / 2, z, 0, 0.03); P_(A.L, sphere(0.12, 1), OR, x, y + h + 0.05, z, 0, 0);
  mobile(A, 'oscille', x, y + h - 0.5, z, P => { P_(P, boite(1.5, 0.95, 0.05), col, 0.78, 0, 0, 0, 0.03); if (croix) { P_(P, boite(1.5, 0.2, 0.06), BLANC, 0.78, 0, 0, 0, 0); P_(P, boite(0.2, 0.95, 0.06), BLANC, 0.7, 0, 0, 0, 0); } }, { axe: 'y', amp: 0.35, v: 2.2, ph: x + z });
}
/** Une flamme qui danse (torche, foyer, brasero). */
const flamme = (A, x, y, z, s = 1) => mobile(A, 'pulse', x, y, z, P => { P_(P, cone(0.35 * s, 0.9 * s, 6), FEU, 0, 0, 0, 0, 0); P_(P, cone(0.18 * s, 0.5 * s, 6), 0xffe27a, 0, -0.1, 0, 0, 0); }, { amp: 0.22, v: 9, ph: x * 3 + z });
/** Une lumière qui clignote (gyrophare, voyant). */
const voyant = (A, x, y, z, col = 0x3a7aff, r = 0.25) => mobile(A, 'clignote', x, y, z, P => P_(P, sphere(r, 1), col, 0, 0, 0, 0, 0), { v: 6, ph: x });

// ------------------------------------------------------------------ tours : le socle (fixe) et la tête (qui pivote vers +z)
/** Les marques du niveau : fanion au niveau 2 ; au niveau 3, un second drapeau doré et des torches (ou des feux). */
function insignes(A, niveau, style, r, h) {
  const hampe = style === 'antique' || style === 'poudre' ? BOIS : FER, croix = style === 'poudre';
  if (niveau >= 2) drapeau(A, -r * 0.62, h, -r * 0.62, 3.4, JOUEUR, croix, hampe);
  if (niveau >= 3) {
    drapeau(A, r * 0.62, h, -r * 0.62, 3.4, OR, false, hampe);
    if (style === 'antique' || style === 'poudre') { for (const s of [-1, 1]) { P_(A.L, cyl(0.07, 0.09, 1.6, 5), BOIS, s * r * 0.75, h + 0.8, r * 0.55, 0, 0.03); flamme(A, s * r * 0.75, h + 1.85, r * 0.55, 0.6); } }
    else for (const s of [-1, 1]) voyant(A, s * r * 0.7, h + 0.4, r * 0.6, style === 'futur' ? CYAN : 0xffc040, 0.22);
  }
}
const disque = (L, r, col, h = 0.25) => P_(L, cyl(r, r + 0.15, h, 18), col, 0, h / 2, 0, 0, 0.04);
const palissade = (L, r, n, h, col = BOIS) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P_(L, cyl(0.2, 0.24, h, 5), col, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0, 0.03); P_(L, cone(0.24, 0.4, 5), col, Math.cos(a) * r, h + 0.2, Math.sin(a) * r, 0, 0); } };
const sacs = (L, r, n, y, rangs = 2) => { for (let j = 0; j < rangs; j++) for (let k = 0; k < n; k++) { const a = (k + j * 0.5) / n * Math.PI * 2; P_(L, boite(1.25, 0.5, 0.75), (k + j) % 3 ? SAC : 0xb8a578, Math.cos(a) * r, y + 0.25 + j * 0.48, Math.sin(a) * r, -a + Math.PI / 2, 0.04); } };
const caisse = (L, x, y, z, col = BOIS2, s = 0.8) => { P_(L, boite(s, s * 0.7, s), col, x, y + s * 0.35, z, 0.3, 0.04); P_(L, boite(s + 0.02, 0.08, s + 0.02), BOIS, x, y + s * 0.5, z, 0.3, 0); };
const crenaux = (L, r, n, y, col = PIERRE) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P_(L, boite(1, 0.8, 0.7), col, Math.cos(a) * r, y + 0.4, Math.sin(a) * r, -a + Math.PI / 2, 0.05); } };

const TOURS = {
  antique: {
    rapide: {  // tour de guet gauloise : poteaux, plancher, garde-corps, toit de chaume ; deux archers qui pivotent
      socle(A, n) {
        const L = A.L, h = 3.6 + 1.2 * (n - 1);
        disque(L, 6.2, TERRE); if (n >= 2) palissade(L, 5.9, 18, 1.6);
        for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) P_(L, boite(0.4, h + 3.3, 0.4), BOIS, x, (h + 3.3) / 2, z, 0, 0.06);
        for (const y of [h * 0.35, h * 0.75]) for (const c of [-1, 1]) { P_(L, boite(0.14, 0.14, 4.2).rotateX(0.7), BOIS2, c * 1.9, y, 0, 0, 0); P_(L, boite(4.2, 0.14, 0.14).rotateZ(0.7), BOIS2, 0, y, c * 1.9, 0, 0); }
        P_(L, boite(4.8, 0.3, 4.8), BOIS2, 0, h, 0, 0, 0.06);
        for (const c of [-1, 1]) { P_(L, boite(4.8, 0.7, 0.12), BOIS2, 0, h + 0.5, c * 2.4, 0, 0.04); P_(L, boite(0.12, 0.7, 4.8), BOIS2, c * 2.4, h + 0.5, 0, 0, 0.04); }
        for (const c of [-1, 1]) P_(L, boite(0.12, h + 0.2, 0.12).rotateX(-0.25), BOIS, c * 0.4, (h + 0.2) / 2, -2.9, 0, 0);
        for (let k = 1; k < h; k += 0.6) P_(L, boite(0.9, 0.08, 0.1), BOIS, 0, k, -2.6 - (h - k) * 0.06, 0, 0);
        P_(L, cone(3.9, 2.4, 4), CHAUME, 0, h + 4.3, 0, Math.PI / 4, 0.15); P_(L, cyl(3, 3.3, 0.3, 4), CHAUME2, 0, h + 3.2, 0, Math.PI / 4, 0.08);
        flamme(A, 2.3, h + 1.6, 2.3, 0.5); P_(L, cyl(0.06, 0.08, 1.2, 5), BOIS, 2.3, h + 0.9, 2.3, 0, 0);
        for (let k = 0; k < 4; k++) P_(L, cyl(0.15, 0.15, 1.4, 6).rotateX(Math.PI / 2), BOIS2, -4 + (k % 2) * 0.33, 0.2 + (k > 1 ? 0.3 : 0), 3, 0, 0.03);
        insignes(A, n, 'antique', 5.6, 0.2);
        return h + 0.15;
      },
      tete(A) {
        mobile(A, 'recul', 0, 0, 0, P => { homme(P, -0.8, 0, { tunique: TARTANS[0], cheveux: CHEVEUX[0] }); homme(P, 0.8, 0, { tunique: TARTANS[1], cheveux: CHEVEUX[1] }); for (const s of [-1, 1]) { P_(P, new THREE.TorusGeometry(0.7, 0.05, 4, 10, Math.PI).rotateZ(-Math.PI / 2).rotateY(Math.PI / 2), BOIS, s * 0.8, 1.35, 0.45, 0, 0); P_(P, boite(0.02, 1.4, 0.02), BLANC, s * 0.8, 1.35, 0.45, 0, 0); } }, { amp: 0.18 });
        return [0, 1.5, 1];
      },
    },
    zone: {  // onagre sur une butte palissadée : le bras se rabat d'un coup
      socle(A, n) {
        const L = A.L, h = 0.8 + 0.5 * (n - 1);
        disque(L, 6.4, TERRE); P_(L, cyl(4.6, 5.6, h, 14), 0x9a8a5a, 0, h / 2, 0, 0, 0.08); P_(L, cyl(4.4, 4.4, 0.12, 14), BOIS2, 0, h + 0.06, 0, 0, 0.04);
        palissade(L, 5.2, 16, h + 1.2);
        for (let k = 0; k < 6; k++) P_(L, sphere(0.42, 1), 0x8d8f96, -3.4 + (k % 3) * 0.75, h + 0.4 + (k > 2 ? 0.6 : 0), -2.6, 0, 0.04);
        homme(L, 3, -2.6, { tunique: TARTANS[3], cheveux: CHEVEUX[2], y: h });
        insignes(A, n, 'antique', 5.6, h);
        return h + 0.1;
      },
      tete(A) {
        const L = A.L;
        for (const c of [-1, 1]) { P_(L, boite(0.4, 0.45, 4.6), BOIS2, c * 1.1, 0.3, -0.3, 0, 0.05); P_(L, boite(0.35, 2.3, 0.35), BOIS2, c * 1.1, 1.4, 0.7, 0, 0.05); P_(L, roueX(0.55, 0.16, 10), BOIS, c * 1.45, 0.55, -1.8, 0, 0.04); P_(L, roueX(0.55, 0.16, 10), BOIS, c * 1.45, 0.55, 1.2, 0, 0.04); }
        P_(L, boite(2.6, 0.35, 0.35), BOIS, 0, 2.5, 0.7, 0, 0.05); P_(L, boite(2.4, 0.3, 0.6), 0xd8c8a0, 0, 2.5, 0.85, 0, 0);
        P_(L, cyl(0.38, 0.38, 2.4, 8).rotateZ(Math.PI / 2), 0xa08050, 0, 0.75, -1.5, 0, 0.04);
        mobile(A, 'bascule', 0, 0.75, -1.5, P => { P_(P, boite(0.3, 3.4, 0.3), BOIS, 0, 1.7, 0, 0, 0.04); P_(P, sphere(0.42, 1).scale(1, 0.6, 1), BOIS2, 0, 3.45, 0, 0, 0.03); P_(P, sphere(0.36, 1), 0x8d8f96, 0, 3.65, 0, 0, 0.03); }, { rx: -1.15, amp: 1.25 });
        soldat(L, -1.9, -1.4, { coiffe: 'gaulois', tenue: TARTANS[2], cheveux: CHEVEUX[3] });
        return [0, 3.6, 0.4];
      },
    },
    lent: {  // chaudron de poix sur son foyer de pierres : il fume, il bouillonne et se renverse vers la cible
      socle(A, n) {
        const L = A.L, h = 1 + 0.6 * (n - 1);
        disque(L, 6.2, TERRE); P_(L, cyl(4.2, 4.6, h, 12), PIERRE, 0, h / 2, 0, 0, 0.08); crenaux(L, 4.2, 10, h, PIERRE2);
        for (let k = 0; k < 5; k++) P_(L, cyl(0.18, 0.18, 1.6, 6).rotateX(Math.PI / 2), BOIS2, 4.2 + (k % 3) * 0.38, 0.2 + (k > 2 ? 0.33 : 0), 2.4, 0.5, 0.03);
        for (const [x, z] of [[-4.6, 2], [-4, 3]]) { P_(L, cyl(0.4, 0.34, 0.8, 8), BOIS2, x, 0.4, z, 0, 0.04); P_(L, cyl(0.36, 0.36, 0.05, 8), NOIR, x, 0.81, z, 0, 0); }
        insignes(A, n, 'antique', 5.6, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; P_(L, sphere(0.3, 0), PIERRE2, Math.cos(a) * 0.9, 0.25, Math.sin(a) * 0.9, 0, 0.03); }
        for (const a of [0, 2.1, 4.2]) P_(L, boite(0.12, 3.2, 0.12).rotateZ(0.22), BOIS, Math.cos(a) * 0.75, 1.5, Math.sin(a) * 0.75, -a, 0.02);
        flamme(A, 0, 0.45, 0, 1.1);
        mobile(A, 'bascule', 0, 1.9, 0, P => { P_(P, new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), FONTE, 0, 0, 0, 0, 0.04); P_(P, cyl(0.86, 0.86, 0.06, 12), 0x14100c, 0, -0.05, 0, 0, 0); P_(P, new THREE.TorusGeometry(0.9, 0.06, 4, 14).rotateX(Math.PI / 2), FONTE, 0, 0, 0, 0, 0); }, { amp: 0.7 });
        A.fum.push([0, 2.2, 0, 'noire']);
        soldat(L, 1.6, -0.9, { coiffe: 'gaulois', tenue: TARTANS[4], cheveux: CHEVEUX[1] });
        mobile(A, 'oscille', 1.3, 1.6, -0.5, P => P_(P, boite(1.3, 0.08, 0.08), BOIS2, -0.6, 0, 0, 0, 0), { axe: 'y', amp: 0.6, v: 2.4 });
        return [0, 2, 0.6];
      },
    },
    loin: {  // scorpion sur une plateforme de bois : le chariot du trait recule à chaque tir
      socle(A, n) {
        const L = A.L, h = 2.6 + 1 * (n - 1);
        disque(L, 6.2, TERRE); if (n >= 2) palissade(L, 5.9, 18, 1.4);
        for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) P_(L, boite(0.42, h, 0.42), BOIS, x, h / 2, z, 0, 0.05);
        for (const c of [-1, 1]) { P_(L, boite(0.14, 0.14, 5).rotateX(0.6), BOIS2, c * 2.2, h * 0.5, 0, 0, 0); P_(L, boite(5, 0.14, 0.14).rotateZ(0.6), BOIS2, 0, h * 0.5, c * 2.2, 0, 0); }
        P_(L, boite(5.2, 0.3, 5.2), BOIS2, 0, h, 0, 0, 0.06);
        for (const c of [-1, 1]) { P_(L, boite(5.2, 0.5, 0.12), BOIS, 0, h + 0.4, c * 2.6, 0, 0.03); P_(L, boite(0.12, 0.5, 5.2), BOIS, c * 2.6, h + 0.4, 0, 0, 0.03); }
        for (let k = 0; k < 3; k++) P_(L, boite(0.12, 0.12, 2.2), BOIS2, 3.2 + k * 0.2, 0.1 + k * 0.12, -3.6, 0.4, 0);
        insignes(A, n, 'antique', 5.6, 0.2);
        return h + 0.15;
      },
      tete(A) {
        const L = A.L;
        P_(L, boite(0.5, 1.4, 0.5), BOIS, 0, 0.7, 0, 0, 0.04);
        P_(L, boite(0.45, 0.35, 3.6), BOIS2, 0, 1.5, 0.4, 0, 0.04);
        for (const s of [-1, 1]) { P_(L, cyl(0.2, 0.2, 0.9, 8), 0xa08050, s * 0.45, 1.5, 1.6, 0, 0.03); P_(L, boite(1.6, 0.16, 0.16), BOIS, s * 1.2, 1.55, 1.3, -s * 0.4, 0.03); }
        P_(L, boite(3.2, 0.03, 0.03), BLANC, 0, 1.6, 0.6, 0, 0);
        mobile(A, 'recul', 0, 1.72, 0.6, P => { P_(P, boite(0.3, 0.12, 0.5), BOIS, 0, 0, 0, 0, 0.02); P_(P, cyl(0.04, 0.04, 2.2, 4).rotateX(Math.PI / 2), BOIS2, 0, 0.1, 1, 0, 0); }, { amp: 0.7 });
        soldat(L, 0.9, -1.5, { coiffe: 'gaulois', tenue: TARTANS[0], cheveux: CHEVEUX[2] });
        return [0, 1.8, 2.4];
      },
    },
  },
  poudre: {
    rapide: {  // redoute de pierre crénelée : trois fusiliers en joue
      socle(A, n) {
        const L = A.L, h = 2.6 + 1 * (n - 1);
        disque(L, 6.2, PAVE); P_(L, cyl(3.9, 4.3, h, 16), PIERRE, 0, h / 2, 0, 0, 0.1); P_(L, cyl(4.15, 4.15, 0.3, 16), PIERRE2, 0, h * 0.45, 0, 0, 0.04);
        crenaux(L, 3.9, 12, h); P_(L, boite(1.1, 1.8, 0.2), 0x4a3322, 0, 0.9, -4.2, 0, 0.04);
        for (let k = 0; k < 3; k++) P_(L, boite(0.6, 0.18, 0.12), VERRE, Math.cos(k * 2.1 + 0.5) * 4.15, h * 0.7, Math.sin(k * 2.1 + 0.5) * 4.15, -(k * 2.1 + 0.5) + Math.PI / 2, 0);
        if (n >= 2) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; P_(L, cyl(0.45, 0.5, 1, 8), 0x9a8058, Math.cos(a) * 5.5, 0.5, Math.sin(a) * 5.5, 0, 0.04); }
        insignes(A, n, 'poudre', 5.6, 0.2);
        return h;
      },
      tete(A, E) {
        const pal = PALIERS[E.pal ?? 0];
        mobile(A, 'recul', 0, 0, 0, P => { for (const x of [-1.15, 0, 1.15]) soldat(P, x, 0.1, { tenue: JOUEUR, coiffe: pal.tete, jambes: BLANC, ceinture: BLANC, long: pal.tete !== 'shako', arme: 'vise', baionnette: true }); }, { amp: 0.15 });
        return [0, 1.85, 2];
      },
    },
    zone: {  // bastion à pans et son canon (celui des armées de web_royaumes), qui recule au coup
      socle(A, n) {
        const L = A.L, h = 1.2 + 0.7 * (n - 1);
        disque(L, 6.4, PAVE); P_(L, cyl(4.8, 5.4, h, 6), PIERRE, 0, h / 2, 0, Math.PI / 6, 0.1); P_(L, cyl(4.6, 4.6, 0.1, 6), 0xc9b48a, 0, h + 0.05, 0, Math.PI / 6, 0);
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P_(L, boite(2.2, 0.7, 0.8), PIERRE2, Math.cos(a) * 4.6, h + 0.35, Math.sin(a) * 4.6, -a + Math.PI / 2, 0.05); }
        for (let k = 0; k < 6; k++) P_(L, sphere(0.25, 1), FONTE, -3 + (k % 3) * 0.5 + (k > 2 ? 0.25 : 0), h + 0.25 + (k > 2 ? 0.4 : 0), -2.6, 0, 0);
        caisse(L, 2.8, h, -2.6); P_(L, cyl(0.4, 0.36, 0.9, 8), BOIS2, 3.6, h + 0.45, -1.6, 0, 0.04);
        insignes(A, n, 'poudre', 5.6, h);
        return h + 0.1;
      },
      tete(A, E) {
        const pal = PALIERS[E.pal ?? 0];
        mobile(A, 'recul', 0, 0, 0, P => canon1700(P, { art: 'ancienne' }, 0, 0), { amp: 0.9 });
        soldat(A.L, -1.5, -1.2, { tenue: JOUEUR, coiffe: pal.tete, jambes: BLANC }); P_(A.L, boite(0.08, 2.2, 0.08), BOIS, -1.1, 1.2, -1, 0, 0);
        soldat(A.L, 1.5, -1.4, { tenue: JOUEUR, coiffe: pal.tete, jambes: BLANC });
        return [0, 1.15, 2];
      },
    },
    lent: {  // pompe à bras sur sa charrette : deux pompiers balancent le levier, la lance arrose
      socle(A, n) {
        const L = A.L, h = 0.5 + 0.5 * (n - 1);
        disque(L, 6.2, PAVE); P_(L, cyl(4.4, 4.8, h, 12), PIERRE2, 0, h / 2, 0, 0, 0.06);
        P_(L, cyl(1.1, 1.1, 1.2, 12), PIERRE, -3.6, 0.6, -3, 0, 0.06); P_(L, cyl(0.95, 0.95, 0.05, 12), EAU, -3.6, 1.2, -3, 0, 0);
        for (const c of [-1, 1]) P_(L, boite(0.12, 2.4, 0.12), BOIS, -3.6 + c * 1.1, 1.8, -3, 0, 0);
        P_(L, boite(2.4, 0.15, 0.15), BOIS, -3.6, 3, -3, 0, 0);
        for (const [x, z] of [[3.6, -2.6], [4.2, -1.6]]) { P_(L, cyl(0.45, 0.4, 1, 8), BOIS2, x, 0.5, z, 0, 0.04); P_(L, cyl(0.42, 0.42, 0.05, 8), EAU, x, 1.01, z, 0, 0); }
        insignes(A, n, 'poudre', 5.6, h);
        return h;
      },
      tete(A, E) {
        const L = A.L, pal = PALIERS[E.pal ?? 0];
        P_(L, boite(1.6, 1.1, 2.6), 0x9a3a2a, 0, 1.15, -0.2, 0, 0.05); P_(L, boite(1.7, 0.12, 2.7), OR, 0, 1.72, -0.2, 0, 0);
        essieuFixe(L, 0.55, 0.8, 1, 0.55, BOIS); essieuFixe(L, 0.55, -1.2, 1, 0.55, BOIS);
        P_(L, boite(0.2, 1.4, 0.2), BRONZE, 0, 2.4, -0.2, 0, 0.03);
        mobile(A, 'pompe', 0, 3.1, -0.2, P => { P_(P, boite(0.14, 0.14, 3.4), BOIS, 0, 0, 0, 0, 0.03); for (const s of [-1, 1]) P_(P, boite(1.2, 0.1, 0.1), BOIS, 0, 0, s * 1.7, 0, 0); }, { amp: 0.28 });
        for (const s of [-1, 1]) soldat(L, 0, s * 2.3 - 0.2, { tenue: 0x8a2a20, coiffe: pal.tete === 'shako' ? 'shako' : 'tricorne', jambes: BLANC, long: false });
        P_(L, futZ(0.12, 0.18, 1.6, 8), BRONZE, 0, 1.9, 1.7, 0, 0.03);
        return [0, 1.95, 2.6];
      },
    },
    loin: {  // grosse tour carrée crénelée : la couleuvrine, longue pièce de bronze, recule au coup
      socle(A, n) {
        const L = A.L, h = 4 + 1.2 * (n - 1);
        disque(L, 6.2, PAVE); P_(L, boite(4.6, h, 4.6), PIERRE, 0, h / 2, 0, 0, 0.1); P_(L, boite(5.2, 0.5, 5.2), PIERRE2, 0, h - 0.25, 0, 0, 0.05);
        for (let k = 0; k < 4; k++) for (let j = -1; j <= 1; j++) { const a = k * Math.PI / 2; P_(L, boite(0.9, 0.8, 0.6), PIERRE, Math.cos(a) * 2.35 - Math.sin(a) * j * 1.7, h + 0.4, Math.sin(a) * 2.35 + Math.cos(a) * j * 1.7, -a + Math.PI / 2, 0.04); }
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; P_(L, boite(0.4, 0.8, 0.12), VERRE, Math.cos(a) * 2.32, h * 0.6, Math.sin(a) * 2.32, -a + Math.PI / 2, 0); }
        P_(L, boite(1.1, 1.8, 0.2), 0x4a3322, 0, 0.9, -2.35, 0, 0.04);
        insignes(A, n, 'poudre', 5.6, 0.2);
        return h;
      },
      tete(A, E) {
        const L = A.L, pal = PALIERS[E.pal ?? 0];
        mobile(A, 'recul', 0, 0, 0, P => {
          P_(P, boite(0.7, 0.4, 2.6), 0x8a3a2a, 0, 0.6, -0.4, 0, 0.04); for (const s of [-1, 1]) P_(P, roueX(0.55, 0.14, 12), 0x4a3420, s * 0.55, 0.55, 0.3, 0, 0.04);
          P_(P, futZ(0.17, 0.32, 4.6, 10).rotateX(-0.05), BRONZE, 0, 1.05, 1.2, 0, 0.05); P_(P, sphere(0.2, 1), BRONZE, 0, 1.05, -1.1, 0, 0);
        }, { amp: 0.6 });
        soldat(L, 1.2, -1.3, { tenue: JOUEUR, coiffe: pal.tete, jambes: BLANC }); P_(L, cyl(0.04, 0.04, 2.2, 4), BOIS, 1.55, 1.4, -1.1, 0, 0);
        return [0, 1.15, 3.6];
      },
    },
  },
  guerres: {
    rapide: {  // nid de mitrailleuse en sacs de sable : la mitrailleuse tremble pendant les rafales
      socle(A, n) {
        const L = A.L, h = 0.3 + 0.4 * (n - 1);
        disque(L, 6.2, 0x9a8a62); P_(L, cyl(4.6, 4.8, h, 14), 0x8a7a52, 0, h / 2, 0, 0, 0.04);
        sacs(L, 3.8, 14, h, 2 + (n >= 3 ? 1 : 0));
        if (n >= 2) for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; P_(L, boite(0.12, 1.3, 0.12), BOIS, Math.cos(a) * 5.4, 0.65, Math.sin(a) * 5.4, 0, 0); P_(L, boite(0.03, 0.03, 3.7).rotateY(-a), 0x6a6a6a, Math.cos(a + 0.35) * 5.3, 0.9, Math.sin(a + 0.35) * 5.3, 0, 0); }
        caisse(L, -3, h, -3.4, OLIVE, 0.7); caisse(L, -2.2, h, -3.7, OLIVE, 0.7);
        insignes(A, n, 'guerres', 5.8, 0.2);
        return h;
      },
      tete(A) {
        const L = A.L;
        for (const a of [0, 2.1, 4.2]) P_(L, boite(0.08, 1.2, 0.08).rotateZ(0.3), FONTE, Math.cos(a + 1.57) * 0.4, 0.55, Math.sin(a + 1.57) * 0.4 + 0.6, -a, 0);
        mobile(A, 'vibre', 0, 1.1, 0.6, P => {
          P_(P, boite(0.45, 0.5, 1.1), FONTE, 0, 0, -0.2, 0, 0.03); P_(P, futZ(0.1, 0.1, 1.9, 6), FONTE, 0, 0.05, 1.2, 0, 0);
          for (let k = 0; k < 5; k++) P_(P, futZ(0.18, 0.18, 0.1, 8), BRONZE, 0, 0.05, 0.5 + k * 0.22, 0, 0);
          P_(P, boite(0.7, 0.06, 0.25), BRONZE, -0.45, 0.1, -0.2, 0, 0);
        }, { amp: 0.05 });
        soldat(L, -0.2, -1.2, { tenue: HORIZON, coiffe: 'adrian', jambes: HORIZON, y: -0.5 });
        soldat(L, 1.3, -0.4, { tenue: HORIZON, coiffe: 'adrian', jambes: HORIZON, y: -0.5, sac: true });
        return [0, 1.15, 2.2];
      },
    },
    zone: {  // obusier sur sa plateforme bétonnée : le tube recule le long de son axe
      socle(A, n) {
        const L = A.L, h = 0.7 + 0.5 * (n - 1);
        disque(L, 6.4, 0x9a8a62); P_(L, cyl(5, 5.4, h, 16), BETON, 0, h / 2, 0, 0, 0.06); sacs(L, 5, 16, h, 1 + (n >= 3 ? 1 : 0));
        for (let k = 0; k < 4; k++) P_(L, futZ(0.25, 0.25, 0.9, 8).rotateY(Math.PI / 2), BRONZE, -3.2, h + 0.25 + (k > 1 ? 0.45 : 0), -2.4 + (k % 2) * 0.5, 0, 0.03);
        caisse(L, 2.8, h, -3, OLIVE); caisse(L, 3.6, h, -2.2, OLIVE);
        insignes(A, n, 'guerres', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L, el = 0.5;
        for (const s of [-1, 1]) { P_(L, boite(0.3, 0.3, 3.2), OLIVE, s * 0.5, 0.35, -1.6, s * 0.25, 0.04); P_(L, roueX(0.9, 0.22, 14), 0x3a3a32, s * 1.25, 0.9, 0, 0, 0.04); }
        P_(L, boite(2.6, 1.8, 0.12), OLIVE, 0, 1.5, 0.55, 0, 0.04); P_(L, boite(1.2, 0.8, 1.6), OLIVE, 0, 1.1, -0.2, 0, 0.04);
        mobile(A, 'recul', 0, 1.6, 0.3, P => { P_(P, futZ(0.26, 0.32, 3.4, 10).rotateX(-el), OLIVE, 0, Math.sin(el) * 1.5, Math.cos(el) * 1.5, 0, 0.04); P_(P, futZ(0.38, 0.38, 1.4, 10).rotateX(-el), 0x4f5a3a, 0, -Math.sin(el) * 0.2, -Math.cos(el) * 0.2, 0, 0.04); }, { amp: 0.8, dir: [0, -Math.sin(el), -Math.cos(el)] });
        soldat(L, -1.5, -1.4, { tenue: HORIZON, coiffe: 'adrian', jambes: HORIZON }); soldat(L, 1.4, -2, { tenue: HORIZON, coiffe: 'adrian', jambes: HORIZON });
        return [0, 1.6 + Math.sin(el) * 3.2, 0.3 + Math.cos(el) * 3.2];
      },
    },
    lent: {  // pompe à vapeur des pompiers : chaudière de cuivre qui fume, la lance arrose
      socle(A, n) {
        const L = A.L, h = 0.4 + 0.5 * (n - 1);
        disque(L, 6.2, PAVE); P_(L, cyl(4.6, 4.9, h, 14), PIERRE2, 0, h / 2, 0, 0, 0.05);
        P_(L, cyl(1, 1, 2.6, 12).rotateZ(Math.PI / 2), 0x6a6a72, -3, h + 1.1, -3, 0.4, 0.05); for (const c of [-1, 1]) P_(L, boite(0.2, 0.9, 0.2), FONTE, -3 + c * 0.9, h + 0.4, -3 + c * 0.4, 0, 0);
        P_(L, cyl(0.25, 0.3, 1, 8), ROUGE, 3.4, h + 0.5, -3, 0, 0.04); P_(L, sphere(0.25, 1), ROUGE, 3.4, h + 1.05, -3, 0, 0);
        insignes(A, n, 'guerres', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, boite(1.6, 0.5, 3.4), ROUGE, 0, 0.95, 0, 0, 0.05); essieuFixe(L, 0.75, -1.1, 1, 0.75, ROUGE); essieuFixe(L, 0.55, 1.2, 0.9, 0.55, ROUGE);
        P_(L, cyl(0.6, 0.65, 1.8, 12), 0xc87a3a, 0, 2.1, -0.8, 0, 0.05); P_(L, sphere(0.45, 1), BRONZE, 0, 3.05, -0.8, 0, 0.03); P_(L, cyl(0.18, 0.24, 1.4, 8), FONTE, 0, 3.6, -0.8, 0, 0.03);
        A.fum.push([0, 4.4, -0.8, 'noire']);
        P_(L, boite(1.2, 0.6, 1), OR, 0, 1.5, 0.8, 0, 0.03);
        mobile(A, 'vibre', 0, 2, 1, P => { P_(P, futZ(0.12, 0.2, 1.8, 8), BRONZE, 0, 0, 0.6, 0, 0.03); }, { amp: 0.03 });
        soldat(L, 1.1, 1.6, { tenue: 0x2a3550, coiffe: 'adrian', casqueC: 0xd9b45a, jambes: 0x2a3550 });
        return [0, 2, 2];
      },
    },
    loin: {  // casemate de béton et sa tourelle blindée : le long canon recule au coup
      socle(A, n) {
        const L = A.L, h = 1.4 + 0.8 * (n - 1);
        disque(L, 6.4, 0x9a8a62); P_(L, cyl(4.4, 5.2, h, 8), BETON, 0, h / 2, 0, Math.PI / 8, 0.08);
        for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; P_(L, boite(0.6, 0.25, 0.12), VERRE, Math.cos(a) * 4.75, h * 0.6, Math.sin(a) * 4.75, -a + Math.PI / 2, 0); }
        for (let k = 0; k < 3; k++) P_(L, boite(1.4, 0.3, 0.6), BETON2, 0, 0.15 + k * 0.3, -5.3 + k * 0.5, 0, 0.03);
        insignes(A, n, 'guerres', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, cyl(2.2, 2.4, 0.4, 16), FONTE, 0, 0.2, 0, 0, 0.04);
        P_(L, boite(3, 1.4, 3.2), 0x6a706a, 0, 1.1, -0.2, 0, 0.06); P_(L, boite(3, 0.8, 1).rotateX(0.5), 0x6a706a, 0, 1.4, 1.5, 0, 0.05);
        P_(L, boite(3.6, 0.25, 0.4), FONTE, 0, 2, -0.6, 0, 0.03); for (const s of [-1, 1]) P_(L, futZ(0.18, 0.18, 0.3, 8).rotateY(Math.PI / 2), VERRE, s * 1.85, 2, -0.6, 0, 0);
        mobile(A, 'recul', 0, 1.2, 1.4, P => { P_(P, futZ(0.22, 0.3, 5.4, 10), 0x5a605a, 0, 0, 2.5, 0, 0.04); P_(P, futZ(0.3, 0.3, 0.6, 10), 0x5a605a, 0, 0, 5.1, 0, 0.03); }, { amp: 0.7 });
        return [0, 1.2, 7];
      },
    },
  },
  moderne: {
    rapide: {  // casemate hexagonale et sa tourelle double ; un petit radar tourne
      socle(A, n) {
        const L = A.L, h = 1.4 + 0.8 * (n - 1);
        disque(L, 6.2, BETON2); P_(L, cyl(3.8, 4.4, h, 6), BETON, 0, h / 2, 0, 0, 0.08);
        for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * Math.PI * 2; P_(L, boite(1.4, 0.22, 0.12), NOIR, Math.cos(a) * 4.02, h * 0.65, Math.sin(a) * 4.02, -a + Math.PI / 2, 0); }
        P_(L, boite(0.1, 3, 0.1), FER, -2.6, h + 1.5, -2, 0, 0); voyant(A, -2.6, h + 3.1, -2, 0xff4a3a, 0.15);
        insignes(A, n, 'moderne', 5.8, 0.2);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, cyl(1.7, 2, 1.3, 12), OLIVE, 0, 0.65, 0, 0, 0.06); P_(L, boite(1.6, 0.8, 1.2), OLIVE, 0, 1.6, -0.3, 0, 0.05); P_(L, boite(0.9, 0.3, 0.2), VERRE, 0, 1.7, 0.31, 0, 0);
        mobile(A, 'recul', 0, 0.9, 1.5, P => { for (const s of [-0.45, 0.45]) { P_(P, futZ(0.13, 0.13, 2.6, 8), FONTE, s, 0, 0.8, 0, 0.03); P_(P, futZ(0.2, 0.2, 0.4, 8), FONTE, s, 0, 2.1, 0, 0); } }, { amp: 0.3 });
        mobile(A, 'tourne', 0, 2.25, -0.6, P => { P_(P, boite(1.4, 0.4, 0.1), BLANCF, 0, 0.2, 0, 0, 0.03); P_(P, boite(0.1, 0.4, 0.1), FER, 0, -0.1, 0, 0, 0); }, { v: 3 });
        return [0, 0.9, 3.8];
      },
    },
    zone: {  // lance-roquettes sur chenilles, entre deux murets pare-éclats
      socle(A, n) {
        const L = A.L, h = 0.4 + 0.4 * (n - 1);
        disque(L, 6.4, BETON2); P_(L, boite(9, h, 9), BETON, 0, h / 2, 0, 0, 0.05);
        for (const s of [-1, 1]) P_(L, boite(0.6, 1.4, 6), BETON, s * 4.2, h + 0.7, 0, 0, 0.05);
        caisse(L, -3, h, -3.6, OLIVE, 0.9); caisse(L, 3, h, -3.6, OLIVE, 0.9);
        insignes(A, n, 'moderne', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        for (const s of [-1, 1]) { P_(L, boite(0.7, 0.9, 4.6), 0x2f2f2a, s * 1.25, 0.45, 0, 0, 0.04); for (let k = 0; k < 5; k++) P_(L, roueX(0.35, 0.72, 10), 0x4a4a42, s * 1.25, 0.4, -1.8 + k * 0.9, 0, 0); }
        P_(L, boite(2.2, 0.8, 4.4), OLIVE, 0, 1.2, 0, 0, 0.05); P_(L, boite(2.2, 1, 1.4), OLIVE, 0, 2, 1.6, 0, 0.05); P_(L, boite(1.9, 0.4, 0.1), VERRE, 0, 2.2, 2.31, 0, 0);
        mobile(A, 'recul', 0, 2, -0.6, P => {
          P_(P, boite(2.2, 1.6, 2.8).rotateX(-0.45), 0x55603f, 0, 0.6, 0.2, 0, 0.05);
          for (const x of [-0.6, 0, 0.6]) for (const y of [0.3, 0.9]) P_(P, futZ(0.2, 0.2, 0.1, 8).rotateX(-0.45), NOIR, x, y + 0.2, 1.62 + y * 0.45, 0, 0);
        }, { amp: 0.25, dir: [0, -0.43, -0.9] });
        return [0, 3, 1.6];
      },
    },
    lent: {  // camion lance-eau blanc et bleu, gyrophares et canon à eau sur le toit
      socle(A, n) {
        const L = A.L, h = 0.4 + 0.4 * (n - 1);
        disque(L, 6.2, BETON2); P_(L, boite(8.6, h, 8.6), BETON, 0, h / 2, 0, 0, 0.05);
        P_(L, cyl(1.2, 1.2, 3, 14), BLANCF, -3, h + 1.5, -3, 0, 0.06); P_(L, cyl(1.25, 1.25, 0.25, 14), JOUEUR, -3, h + 2.2, -3, 0, 0);
        P_(L, boite(0.3, 0.3, 3), FER, -1.4, h + 0.3, -3, 0, 0);
        insignes(A, n, 'moderne', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        essieuFixe(L, 0.6, 1.4, 1.05, 0.6); essieuFixe(L, 0.6, -1.3, 1.05, 0.6);
        P_(L, boite(2.2, 1.7, 3.2), BLANCF, 0, 1.6, -0.6, 0, 0.05); P_(L, boite(2.2, 0.35, 3.2), JOUEUR, 0, 1.2, -0.6, 0, 0);
        P_(L, boite(2.2, 1.5, 1.3), BLANCF, 0, 1.5, 1.6, 0, 0.05); P_(L, boite(2, 0.6, 0.1), VERRE, 0, 1.9, 2.26, 0, 0);
        voyant(A, -0.5, 2.4, 1.5, 0x3a7aff, 0.2); voyant(A, 0.5, 2.4, 1.5, 0xff3a3a, 0.2);
        P_(L, cyl(0.35, 0.4, 0.4, 8), FER, 0, 2.65, -0.6, 0, 0.03);
        mobile(A, 'vibre', 0, 2.95, -0.6, P => P_(P, futZ(0.12, 0.18, 2, 8).rotateX(-0.2), FER, 0, 0.2, 0.9, 0, 0.03), { amp: 0.03 });
        return [0, 3.4, 1.4];
      },
    },
    loin: {  // rampe de missiles et son radar : le missile part, un autre le remplace
      socle(A, n) {
        const L = A.L, h = 0.4 + 0.4 * (n - 1);
        disque(L, 6.2, BETON2); P_(L, boite(8.6, h, 8.6), BETON, 0, h / 2, 0, 0, 0.05);
        P_(L, boite(2, 1.6, 1.6), OLIVE, 3, h + 0.8, -3, 0, 0.05); P_(L, boite(0.12, 2.6, 0.12), FER, 3, h + 2.9, -3, 0, 0);
        mobile(A, 'tourne', 3, h + 4.2, -3, P => { P_(P, cyl(1.1, 0.2, 0.4, 12).rotateX(1.2), BLANCF, 0, 0, 0, 0, 0.04); P_(P, boite(0.08, 0.08, 0.8), FER, 0, 0.1, 0.4, 0, 0); }, { v: 1.4 });
        insignes(A, n, 'moderne', 5.8, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, cyl(1.4, 1.6, 0.6, 10), OLIVE, 0, 0.3, 0, 0, 0.04); P_(L, boite(0.6, 1.6, 0.6), OLIVE, 0, 1.2, 0, 0, 0.04);
        P_(L, boite(2.6, 0.25, 3.6).rotateX(-0.45), 0x55603f, 0, 2.1, 0.3, 0, 0.04);
        for (const s of [-0.75, 0.75]) mobile(A, 'depart', s, 2.45, 0.3, P => { P_(P, futZ(0.3, 0.3, 3, 10).rotateX(-0.45), BLANCF, 0, 0, 0, 0, 0.03); P_(P, cone(0.3, 0.7, 10).rotateX(Math.PI / 2 - 0.45), ROUGE, 0, 0.75, 1.65, 0, 0); for (const k of [-1, 1]) P_(P, boite(0.04, 0.5, 0.6).rotateX(-0.45), FER, k * 0.32, -0.55, -1.1, 0, 0); });
        return [0, 3.2, 2];
      },
    },
  },
  futur: {
    rapide: {  // pylône blanc, anneau lumineux qui tourne, tourelle sphérique et son émetteur
      socle(A, n) {
        const L = A.L, h = 1.6 + 0.9 * (n - 1);
        disque(L, 6.2, 0x6a7280); P_(L, cyl(3.4, 4.2, 0.6, 6), BLANCF, 0, 0.3, 0, 0, 0.05); P_(L, cyl(3.5, 3.5, 0.1, 6), CYAN, 0, 0.62, 0, 0, 0);
        P_(L, cyl(1, 1.6, h, 6), BLANCF, 0, h / 2 + 0.6, 0, 0, 0.05);
        mobile(A, 'tourne', 0, h * 0.6, 0, P => { P_(P, new THREE.TorusGeometry(2.3, 0.12, 4, 24).rotateX(Math.PI / 2), CYAN, 0, 0, 0, 0, 0); for (let k = 0; k < 3; k++) P_(P, boite(0.3, 0.3, 0.3), BLANCF, Math.cos(k * 2.1) * 2.3, 0, Math.sin(k * 2.1) * 2.3, 0, 0.02); }, { v: 1.2 });
        insignes(A, n, 'futur', 5.6, 0.6);
        return h + 0.6;
      },
      tete(A) {
        const L = A.L;
        P_(L, sphere(1.5, 2), BLANCF, 0, 1.3, 0, 0, 0.05); P_(L, boite(0.2, 0.2, 3.2), GRISF, 0, 1.3, 0, 0, 0);
        P_(L, futZ(0.3, 0.4, 2, 10), GRISF, 0, 1.4, 1.6, 0, 0.03);
        mobile(A, 'pulse', 0, 1.4, 2.7, P => P_(P, sphere(0.32, 1), CYAN, 0, 0, 0, 0, 0), { amp: 0.25, v: 6 });
        mobile(A, 'pulse', 0, 1.3, 0, P => P_(P, new THREE.TorusGeometry(1.52, 0.06, 4, 20).rotateY(Math.PI / 2), CYAN, 0, 0, 0, 0, 0), { amp: 0.03, v: 3 });
        return [0, 1.4, 2.9];
      },
    },
    zone: {  // dôme du mortier à plasma : son cœur magenta bat, le tube court recule
      socle(A, n) {
        const L = A.L, h = 0.8 + 0.6 * (n - 1);
        disque(L, 6.4, 0x6a7280); P_(L, cyl(4.2, 4.8, h, 6), BLANCF, 0, h / 2, 0, Math.PI / 6, 0.05);
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P_(L, boite(1, 0.12, 0.5), MAGENTA, Math.cos(a) * 4.5, h * 0.6, Math.sin(a) * 4.5, -a + Math.PI / 2, 0); }
        insignes(A, n, 'futur', 5.6, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, sphere(2.2, 2).scale(1, 0.62, 1), BLANCF, 0, 0.3, 0, 0, 0.05);
        mobile(A, 'pulse', 0, 1.25, -0.6, P => { P_(P, sphere(0.7, 1), MAGENTA, 0, 0, 0, 0, 0); }, { amp: 0.18, v: 4 });
        P_(L, new THREE.TorusGeometry(0.85, 0.12, 4, 16).rotateX(Math.PI / 2), GRISF, 0, 1.2, -0.6, 0, 0);
        mobile(A, 'recul', 0, 1.3, 0.6, P => { P_(P, futZ(0.6, 0.85, 1.8, 12).rotateX(-0.7), GRISF, 0, 0.55, 0.65, 0, 0.04); P_(P, futZ(0.55, 0.55, 0.1, 12).rotateX(-0.7), MAGENTA, 0, 1.15, 1.35, 0, 0); }, { amp: 0.35, dir: [0, -0.64, -0.77] });
        return [0, 2.5, 2];
      },
    },
    lent: {  // cristal de froid qui flotte et tourne au-dessus de son socle givré
      socle(A, n) {
        const L = A.L, h = 0.8 + 0.6 * (n - 1);
        disque(L, 6.2, 0x8aa0b0); P_(L, cyl(3.6, 4.4, h, 6), BLANCF, 0, h / 2, 0, 0, 0.05);
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; P_(L, cone(0.3, 1 + (k % 3) * 0.4, 5), GIVRE, Math.cos(a) * 4.9, 0.5 + (k % 3) * 0.2, Math.sin(a) * 4.9, 0, 0.02); }
        insignes(A, n, 'futur', 5.6, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, cyl(0.8, 1.3, 0.8, 6), GRISF, 0, 0.4, 0, 0, 0.04);
        for (let k = 0; k < 3; k++) P_(L, boite(0.2, 1.8, 0.2).rotateZ(0.35), BLANCF, Math.cos(k * 2.1) * 1.1, 1.3, Math.sin(k * 2.1) * 1.1, -k * 2.1, 0.02);
        mobile(A, 'flotte', 0, 2.6, 0, P => { P_(P, sphere(0.9, 0).scale(0.8, 1.6, 0.8), 0xa8f0ff, 0, 0, 0, 0, 0.03); P_(P, sphere(0.5, 0).scale(0.8, 1.6, 0.8), BLANCF, 0, 0, 0, 0, 0); }, { amp: 0.25, v: 1.6, tourne: 1.2 });
        mobile(A, 'tourne', 0, 2.6, 0, P => P_(P, new THREE.TorusGeometry(1.5, 0.06, 4, 20).rotateX(1.2), CYAN, 0, 0, 0, 0, 0), { v: -2 });
        return [0, 2.6, 0.6];
      },
    },
    loin: {  // canon électrique : deux rails, bobines qui s'illuminent ; panneaux solaires sur le socle
      socle(A, n) {
        const L = A.L, h = 0.8 + 0.6 * (n - 1);
        disque(L, 6.2, 0x6a7280); P_(L, cyl(3.6, 4.2, h, 6), BLANCF, 0, h / 2, 0, 0, 0.05);
        for (const s of [-1, 1]) { P_(L, boite(0.12, 1, 0.12), FER, s * 4.4, 0.5, -3, 0, 0); P_(L, boite(2.2, 0.08, 1.4).rotateX(-0.5), 0x2a3a6a, s * 4.4, 1.05, -3, 0, 0.02); }
        insignes(A, n, 'futur', 5.6, h);
        return h;
      },
      tete(A) {
        const L = A.L;
        P_(L, cyl(1.3, 1.6, 0.8, 6), GRISF, 0, 0.4, 0, 0, 0.04); P_(L, boite(1.8, 1.2, 2.4), BLANCF, 0, 1.4, -0.6, 0, 0.05);
        mobile(A, 'recul', 0, 1.5, 0, P => { for (const s of [-0.5, 0.5]) P_(P, boite(0.3, 0.45, 6), BLANCF, s, 0, 2.6, 0, 0.03); P_(P, boite(0.15, 0.12, 5.6), CYAN, 0, 0, 2.6, 0, 0); }, { amp: 0.35 });
        for (let k = 0; k < 3; k++) mobile(A, 'pulse', 0, 1.5, 0.6 + k * 1.3, P => P_(P, futZ(0.85, 0.85, 0.3, 10), GRISF, 0, 0, 0, 0, 0.02), { amp: 0.06, v: 5, ph: k });
        return [0, 1.5, 5.8];
      },
    },
  },
};

/** Une tour : { groupe (à l'échelle du plateau), tete (pivote sur y vers +z), bouche (THREE.Vector3, coordonnées de la tête) }.
 *  role : 'rapide', 'zone', 'lent' ou 'loin' ; ere : l'époque (ERES, sa clé ou un style) ; niveau : 1 à 3 ; pop : elle sort de terre. */
export function tour(role, ere, niveau = 1, { pop = false } = {}) {
  const E = typeof ere === 'string' ? ERES.find(e => e.cle === ere) || ERES.find(e => e.style === ere) : ere, def = TOURS[E.style][role];
  const p = proto(`tour|${role}|${E.cle}|${niveau}`, () => {
    const S = atelier(), h = def.socle(S, niveau, E), T = atelier(), b = def.tete(T, E);
    return { socle: figer(S), tete: figer(T), h, bouche: new THREE.Vector3(...b) };
  });
  const s = copier(p.socle), t = copier(p.tete), groupe = new THREE.Group();
  t.g.position.y = p.h; groupe.add(s.g, t.g); groupe.scale.setScalar(ECH);
  const m = { groupe, tete: t.g, bouche: p.bouche.clone(), parts: [...s.parts, ...t.parts], fum: p.tete.fum, style: E.style, role, tir: -99, pop: pop ? performance.now() / 1000 : 0, prochaineFumee: 0, vu: false };
  TOURS_VIVES.push(m);
  return m;
}

// ------------------------------------------------------------------ animation des tours
const TOURS_VIVES = [];
const _w = new THREE.Vector3();
/** Le coup part : recul, bras, levier ou missile ; éclair et fumée de poudre à la bouche. Rend la bouche (coordonnées du monde). */
export function tirer(m) {
  m.tir = performance.now() / 1000;
  m.groupe.updateMatrixWorld(true);
  const b = m.tete.localToWorld(_w.copy(m.bouche)).clone(), g = STYLES[m.style].tours[m.role][1];
  if (g === 'balle' || g === 'boulet' || g === 'obus') { eclat(b.x, b.y, b.z); if (m.style === 'poudre') bouffee(b.x, b.y, b.z, 'poudre', m.role === 'rapide' ? 0.9 : 1.4); else if (m.role !== 'rapide') bouffee(b.x, b.y, b.z, 'blanche', 0.7); }
  else if (g === 'roquette') { bouffee(b.x, b.y - 0.1, b.z, 'blanche', 0.9); eclat(b.x, b.y, b.z, 0xffc070); }
  else if (g === 'plasma') eclat(b.x, b.y, b.z, MAGENTA);
  else if (g === 'laser' || g === 'glace') eclat(b.x, b.y, b.z, g === 'glace' ? GIVRE : CYAN);
  else if (g === 'eau') bouffee(b.x, b.y, b.z, 'blanche', 0.4);
  return b;
}
const recul = u => u < 0.05 ? u / 0.05 : Math.max(0, 1 - (u - 0.05) / 0.4);
const bascule = u => u < 0.12 ? u / 0.12 : Math.max(0, 1 - (u - 0.12) / 1.1);
chaqueImage((dt, t) => {
  const now = performance.now() / 1000;
  for (let i = TOURS_VIVES.length - 1; i >= 0; i--) {
    const m = TOURS_VIVES[i];
    if (!m.groupe.parent) { if (m.vu) TOURS_VIVES.splice(i, 1); continue; }
    m.vu = true;
    const u = now - m.tir;
    for (const p of m.parts) {
      const o = p.o;
      switch (p.type) {
        case 'recul': { const k = recul(u) * p.amp, d = p.dir || [0, 0, -1]; o.position.set(p.pos[0] + d[0] * k, p.pos[1] + d[1] * k, p.pos[2] + d[2] * k); break; }
        case 'bascule': o.rotation.x = (p.rx || 0) + bascule(u) * p.amp; break;
        case 'pompe': o.rotation.x = u < 1.2 ? Math.sin(now * 11) * p.amp : o.rotation.x * 0.9; break;
        case 'vibre': { const v = u < 0.35; o.position.set(p.pos[0] + (v ? (Math.random() - 0.5) * p.amp * 10 : 0), p.pos[1] + (v ? (Math.random() - 0.5) * p.amp * 6 : 0), p.pos[2] - (v ? Math.random() * p.amp * 10 : 0)); break; }
        case 'depart': o.visible = u > 1.4; break;
        case 'jaillit': o.position.y = p.pos[1] + recul(u) * p.amp; o.scale.y = 0.35 + 0.65 * (m.usure ?? 1); break;
        case 'arme': o.visible = m.arme !== false; break;
        case 'tourne': o.rotation.y += dt * p.v; break;
        case 'pulse': o.scale.setScalar(1 + Math.sin(t * p.v + p.ph) * p.amp); break;
        case 'oscille': o.rotation[p.axe || 'y'] = Math.sin(t * p.v + p.ph) * p.amp; break;
        case 'flotte': o.position.y = p.pos[1] + Math.sin(t * p.v) * p.amp; if (p.tourne) o.rotation.y += dt * p.tourne; break;
        case 'clignote': o.visible = Math.sin(t * p.v + p.ph) > 0; break;
        case 'clignoteArme': o.visible = m.arme !== false && Math.sin(t * p.v + p.ph) > 0; break;
      }
    }
    if (m.fum.length && (m.prochaineFumee -= dt) < 0) {
      m.prochaineFumee = 0.6 + Math.random() * 0.3;
      for (const [x, y, z, g] of m.fum) { const w = m.tete.localToWorld(_w.set(x, y, z)); bouffee(w.x, w.y, w.z, g, 0.7); }
    }
    if (m.piege === 'barrage') {  // la barricade : elle tremble sous les coups, penche quand elle faiblit, disparaît détruite
      const v = m.vie ?? 1; m.groupe.visible = v > 0;
      m.corps.rotation.z = (1 - v) * 0.25 + (u < 0.3 ? Math.sin(now * 60) * 0.04 : 0); m.corps.position.y = -(1 - v) * 0.6;
    }
    if (m.pop) { const q = Math.min(1, (now - m.pop) / 0.65); m.groupe.scale.y = m.groupe.scale.x * (q < 1 ? 1 + Math.sin(q * Math.PI * 1.5) * (1 - q) * 0.5 - (1 - q) ** 3 : 1); if (q >= 1) m.pop = 0; }
  }
});

// ------------------------------------------------------------------ ennemis
const ENNEMIS = {
  antique: {  // une centurie romaine
    fantassin(A, c) { for (const x of [-1.2, 0, 1.2]) soldat(A.L, x, 0, { tenue: c, coiffe: 'romain', jambes: 0x6a4a2a, arme: 'pilum', bouclier: 'scutum', J: A }); },
    rapide(A, c) { for (const x of [-0.75, 0.75]) { cheval(A.L, A, x, 0, x < 0 ? 0x7a5233 : 0x4a3020); soldat(A.L, x, -0.1, { tenue: c, coiffe: 'romain', jambes: c, arme: 'lance', y: 1.15, long: false }); } },
    lourd(A, c) {  // la tortue : six légionnaires sous leurs boucliers
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = -1 + i, z = -0.5 + j;
        jambe(A, 0.9, z, (i + j) % 2 ? Math.PI : 0, P => { for (const dx of [-0.14, 0.14]) P_(P, boite(0.2, 0.9, 0.26), 0x6a4a2a, x + dx, -0.45, 0); });
        P_(A.L, boite(0.8, 1.1, 0.5), c, x, 1.4, z, 0, 0.04);
      }
      P_(A.L, boite(3.2, 0.14, 2.2), c, 0, 2.15, 0, 0, 0.05);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) P_(A.L, sphere(0.12, 1), OR, -1 + i, 2.24, -0.5 + j, 0, 0);
      P_(A.L, boite(3.2, 1.3, 0.14), c, 0, 1.45, 1.1, 0, 0.04); for (const s of [-1, 1]) P_(A.L, boite(0.14, 1.3, 2.2), c, s * 1.6, 1.45, 0, 0, 0.04);
      P_(A.L, boite(3.25, 0.1, 0.16), OR, 0, 2.05, 1.12, 0, 0);
    },
    chef(A, c) {  // éléphant de guerre : sa tour, son cornac et ses soldats
      const G = 0x8d8a90, L = A.L;
      P_(L, sphere(1.6, 1).scale(1, 0.9, 1.4), G, 0, 3.2, 0, 0, 0.08);
      for (const [dx, dz, ph] of [[-0.75, 1.1, 0], [0.75, 1.1, Math.PI], [-0.75, -1.1, Math.PI], [0.75, -1.1, 0]]) jambe(A, 2.3, dz, ph, P => P_(P, cyl(0.42, 0.38, 2.3, 8), G, dx, -1.15, 0, 0, 0.05), 0.35);
      P_(L, sphere(0.95, 1), G, 0, 3.9, 2.1, 0, 0.06); for (const s of [-1, 1]) P_(L, sphere(0.7, 1).scale(0.3, 1, 0.9), 0x9a96a0, s * 0.9, 3.9, 1.9, 0, 0.04);
      P_(L, cyl(0.2, 0.32, 2, 8).rotateX(0.35), G, 0, 2.6, 2.8, 0, 0.04);
      for (const s of [-1, 1]) P_(L, cone(0.1, 1.2, 6).rotateX(1.9), BLANC, s * 0.4, 3.1, 2.8, 0, 0);
      P_(L, boite(2.4, 0.3, 2.6), c, 0, 4.55, -0.3, 0, 0.04); P_(L, boite(2, 1, 2), BOIS2, 0, 5.2, -0.4, 0, 0.05);
      for (const s of [-1, 1]) P_(L, boite(2.1, 0.12, 0.1), OR, 0, 5.75, -0.4 + s * 1, 0, 0);
      soldat(L, 0, 1.6, { tenue: 0xd9c49a, coiffe: 'gaulois', cheveux: 0x2a2018, y: 3.4, long: false });
      for (const x of [-0.5, 0.5]) soldat(L, x, -0.4, { tenue: c, coiffe: 'romain', y: 4.4, arme: 'lance' });
    },
  },
  poudre: {
    fantassin(A, c, E) { const tete = PALIERS[E.pal ?? 0].tete; for (const x of [-1.15, 0, 1.15]) soldat(A.L, x, 0, { tenue: c, coiffe: tete, jambes: BLANC, ceinture: BLANC, long: tete !== 'shako', arme: 'fusil', baionnette: true, J: A }); },
    rapide(A, c, E) { const tete = PALIERS[E.pal ?? 0].tete; for (const x of [-0.75, 0.75]) { cheval(A.L, A, x, 0, x < 0 ? 0x6b4226 : 0x3a2a1a); soldat(A.L, x, -0.1, { tenue: c, coiffe: tete, jambes: BLANC, y: 1.15, long: false }); P_(A.L, boite(0.06, 0.06, 1.1), 0xd9d9d9, x + 0.4, 2.5, 0.25, 0, 0); } },
    lourd(A, c) { for (const x of [-1.15, 0, 1.15]) soldat(A.L, x, 0, { tenue: c, coiffe: 'bonnet', jambes: BLANC, ceinture: BLANC, arme: 'fusil', baionnette: true, sac: true, J: A }); },
    chef(A, c, E) {  // grand canon de siège traîné par quatre chevaux
      const L = A.L, tete = PALIERS[E.pal ?? 0].tete;
      P_(L, boite(1, 0.5, 3.6), 0x8a3a2a, 0, 1, -1.6, 0, 0.05); essieu(A, 1.1, -1.2, 0.9, 1.1, 0x4a3420);
      P_(L, futZ(0.42, 0.6, 4, 12).rotateX(-0.1), BRONZE, 0, 1.75, -1.4, 0, 0.06); P_(L, sphere(0.35, 1), BRONZE, 0, 1.55, -3.4, 0, 0);
      P_(L, boite(0.1, 0.1, 2.6), BOIS, 0, 0.8, 1.2, 0, 0);
      for (const z of [2.2, 4.6]) for (const x of [-0.6, 0.6]) cheval(L, A, x, z, x < 0 ? 0x6b4226 : 0x8a5a32);
      soldat(L, -0.6, 4.5, { tenue: c, coiffe: tete, jambes: BLANC, y: 1.15, long: false });
      for (const x of [-1.6, 1.6]) soldat(L, x, -1.4, { tenue: c, coiffe: tete, jambes: BLANC, J: A });
    },
  },
  guerres: {
    fantassin(A, c) { for (const x of [-1.15, 0, 1.15]) soldat(A.L, x, 0, { tenue: c, coiffe: 'adrian', casqueC: c, jambes: c, arme: 'fusil', baionnette: true, sac: true, J: A }); },
    rapide(A, c) {  // moto et side-car
      const L = A.L;
      essieu(A, 0.55, 1.2, 0, 0.55, NOIR, false); essieu(A, 0.55, -1, 0, 0.55, NOIR, false);
      P_(L, boite(0.4, 0.6, 2), c, 0, 1.1, 0.1, 0, 0.04); P_(L, boite(0.5, 0.35, 0.6), FONTE, 0, 0.8, 0, 0, 0); P_(L, boite(1, 0.08, 0.08), FONTE, 0, 1.6, 1, 0, 0);
      P_(L, sphere(0.6, 1).scale(1, 0.7, 1.6), c, 1.2, 0.8, 0, 0, 0.04); P_(L, roueX(0.4), NOIR, 1.65, 0.4, -0.2, 0, 0.03);
      soldat(L, 0, -0.2, { tenue: c, coiffe: 'adrian', casqueC: c, jambes: c, y: 0.35, long: false });
      soldat(L, 1.2, -0.1, { tenue: c, coiffe: 'adrian', casqueC: c, jambes: c, y: -0.2, long: false });
    },
    lourd(A, c) {  // char à tourelle
      const L = A.L;
      P_(L, boite(2.6, 1, 4.2), c, 0, 1.15, 0, 0, 0.06); P_(L, boite(2.6, 0.6, 1).rotateX(0.5), c, 0, 1.2, 2.2, 0, 0.05);
      for (const s of [-1, 1]) { P_(L, boite(0.6, 0.9, 4.6), 0x3a3a32, s * 1.5, 0.55, 0, 0, 0.04); for (let k = 0; k < 5; k++) P_(L, roueX(0.35, 0.62, 10), 0x5a5a50, s * 1.5, 0.45, -1.8 + k * 0.9, 0, 0); }
      P_(L, cyl(1.05, 1.15, 0.8, 10), c, 0, 2.05, -0.3, 0, 0.05); P_(L, futZ(0.13, 0.15, 2.6, 8), c, 0, 2.1, 1.9, 0, 0.03);
      P_(L, cyl(0.3, 0.3, 0.3, 8), c, 0.3, 2.6, -0.5, 0, 0.02);
    },
    chef(A, c) {  // zeppelin : son ballon, sa nacelle, ses hélices
      const L = A.L;
      P_(L, sphere(2.2, 2).scale(1, 0.85, 3.2), 0xc8c4b8, 0, 2.6, 0, 0, 0.08);
      for (let k = -2; k <= 2; k++) P_(L, futZ(1.9 - Math.abs(k) * 0.35, 1.9 - Math.abs(k) * 0.35, 0.1, 18).scale(1, 0.86, 1), 0xa8a498, 0, 2.6, k * 1.4, 0, 0);
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) P_(L, boite(0.12, 1.8, 1.6).rotateZ(a), c, Math.sin(a) * 1, 2.6 + Math.cos(a) * 1, -6.2, 0, 0.03);
      P_(L, boite(0.9, 0.7, 2.6), c, 0, 0.5, 0.6, 0, 0.04); P_(L, boite(0.92, 0.25, 1.8), VERRE, 0, 0.6, 0.7, 0, 0);
      for (const s of [-1, 1]) { P_(L, boite(1.9, 0.1, 0.1), FONTE, s * 1.35, 0.75, -1.3, 0, 0); P_(L, futZ(0.28, 0.2, 1, 8), c, s * 2.4, 0.75, -1.4, 0, 0.03); mobile(A, 'helice', s * 2.4, 0.75, -2, P => { P_(P, boite(1.5, 0.2, 0.08), BOIS, 0, 0, 0, 0, 0.02); P_(P, futZ(0.12, 0.12, 0.2, 8), FONTE, 0, 0, 0, 0, 0); }, { axe: 'z', v: 7, flou: 0.78 }); }
    },
  },
  moderne: {
    fantassin(A, c) { for (const x of [-1.15, 0, 1.15]) soldat(A.L, x, 0, { tenue: c, coiffe: 'casque', casqueC: c, jambes: c, arme: 'fusil', armeC: FONTE, sac: true, sacC: OLIVE, J: A }); },
    rapide(A, c) {  // jeep et sa mitrailleuse
      const L = A.L;
      essieu(A, 0.6, 1.3, 1.05, 0.6, 0x2a2a2a, false); essieu(A, 0.6, -1.3, 1.05, 0.6, 0x2a2a2a, false);
      P_(L, boite(2, 0.8, 3.8), c, 0, 1.1, 0, 0, 0.05); P_(L, boite(2, 0.5, 1.2), c, 0, 1.35, 1.3, 0, 0.04); P_(L, boite(1.9, 0.6, 0.08), VERRE, 0, 1.9, 0.6, 0, 0);
      soldat(L, -0.45, 0, { tenue: c, coiffe: 'casque', casqueC: c, jambes: c, y: 0.1, long: false });
      soldat(L, 0.3, -1.2, { tenue: c, coiffe: 'casque', casqueC: c, jambes: c, y: 0.5, long: false });
      P_(L, futZ(0.08, 0.08, 1.4, 6), FONTE, 0.3, 2.6, -0.4, 0, 0);
    },
    lourd(A, c) {  // char d'assaut : tourelle plate et long canon
      const L = A.L;
      P_(L, boite(2.9, 0.9, 4.8), c, 0, 1.1, 0, 0, 0.06); P_(L, boite(2.9, 0.5, 1).rotateX(-0.4), c, 0, 1.15, 2.6, 0, 0.05);
      for (const s of [-1, 1]) { P_(L, boite(0.7, 0.8, 5), 0x2f2f2a, s * 1.6, 0.5, 0, 0, 0.04); for (let k = 0; k < 6; k++) P_(L, roueX(0.32, 0.72, 10), 0x4a4a42, s * 1.6, 0.4, -2 + k * 0.8, 0, 0); }
      P_(L, boite(2.1, 0.7, 2.4), c, 0, 1.9, -0.3, 0, 0.05); P_(L, futZ(0.12, 0.13, 3.6, 8), c, 0, 1.95, 2.6, 0, 0.03); P_(L, futZ(0.2, 0.2, 0.6, 8), c, 0, 1.95, 1.6, 0, 0);
      P_(L, cyl(0.25, 0.25, 0.3, 8), c, 0.5, 2.4, -0.6, 0, 0.02);
    },
    chef(A, c) {  // hélicoptère : rotor principal et rotor de queue
      const L = A.L;
      P_(L, sphere(1.3, 2).scale(1, 0.85, 1.6), c, 0, 1.3, 0.3, 0, 0.06); P_(L, sphere(0.9, 1).scale(1, 0.7, 0.8), VERRE, 0, 1.45, 1.5, 0, 0);
      P_(L, futZ(0.25, 0.45, 3.6, 8), c, 0, 1.6, -2.3, 0, 0.04); P_(L, boite(0.12, 1.2, 0.8), c, 0, 2, -4, 0, 0.03);
      for (const s of [-1, 1]) { P_(L, boite(0.1, 0.1, 2.6), FONTE, s * 0.85, 0.1, 0.2, 0, 0); P_(L, boite(0.1, 0.6, 0.1), FONTE, s * 0.75, 0.4, 0.2, 0, 0); P_(L, futZ(0.18, 0.18, 1.4, 6), OLIVE, s * 1.3, 1, 0.3, 0, 0.02); }
      P_(L, cyl(0.12, 0.12, 0.5, 6), FONTE, 0, 2.5, 0.3, 0, 0);
      mobile(A, 'helice', 0, 2.75, 0.3, P => { P_(P, boite(6.4, 0.12, 0.42), FONTE, 0, 0, 0, 0, 0.03); P_(P, boite(0.42, 0.12, 6.4), FONTE, 0, 0, 0, 0, 0.03); P_(P, cyl(0.28, 0.28, 0.25, 8), FER, 0, 0.05, 0, 0, 0.02); }, { axe: 'y', v: 6, flou: 3.2 });
      mobile(A, 'helice', 0.2, 2.1, -4, P => { P_(P, boite(0.08, 1.3, 0.2), FONTE, 0, 0, 0, 0, 0.02); P_(P, boite(0.08, 0.2, 1.3), FONTE, 0, 0, 0, 0, 0.02); }, { axe: 'x', v: 9, flou: 0.68 });
    },
  },
  futur: {
    fantassin(A, c) { for (const x of [-1.15, 0, 1.15]) soldat(A.L, x, 0, { tenue: c, coiffe: 'robot', jambes: GRISF, arme: 'fusil', armeC: GRISF, J: A }); },
    rapide(A, c) {  // drone à quatre rotors
      const L = A.L;
      P_(L, boite(1.4, 0.5, 1.4), c, 0, 0, 0, Math.PI / 4, 0.04); P_(L, sphere(0.45, 1), BLANCF, 0, 0.3, 0, 0, 0.03); P_(L, sphere(0.25, 1), CYAN, 0, -0.1, 0.7, 0, 0);
      for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { P_(L, boite(0.18, 0.15, 1.6).rotateY(Math.atan2(x, z)), GRISF, x * 0.55, 0, z * 0.55, 0, 0); P_(L, cyl(0.15, 0.2, 0.3, 8), GRISF, x, 0.05, z, 0, 0.02); mobile(A, 'helice', x, 0.25, z, P => { P_(P, boite(1.4, 0.06, 0.22), BLANCF, 0, 0, 0, 0, 0.02); P_(P, cyl(0.1, 0.1, 0.12, 6), CYAN, 0, 0.04, 0, 0, 0); }, { axe: 'y', v: x * z > 0 ? 8 : -8, flou: 0.72 }); }
    },
    lourd(A, c) {  // glisseur blindé : il plane, sa lueur bat
      const L = A.L;
      P_(L, boite(2.8, 0.9, 4.4), c, 0, 1.2, 0, 0, 0.06); P_(L, boite(2.6, 0.5, 1.2).rotateX(-0.5), c, 0, 1.2, 2.4, 0, 0.04);
      mobile(A, 'pulse', 0, 0.6, 0, P => P_(P, boite(2.4, 0.15, 4), CYAN, 0, 0, 0, 0, 0), { amp: 0.06, v: 7 });
      P_(L, sphere(1.1, 1).scale(1, 0.55, 1.2), BLANCF, 0, 1.85, -0.4, 0, 0.04); P_(L, futZ(0.15, 0.2, 3, 8), GRISF, 0, 1.95, 1.6, 0, 0.03); P_(L, sphere(0.15, 1), CYAN, 0, 1.95, 3.1, 0, 0);
    },
    chef(A, c) {  // méca géant sur deux jambes
      const L = A.L;
      for (const [x, ph] of [[-1.1, 0], [1.1, Math.PI]]) jambe(A, 3.2, 0, ph, P => { P_(P, boite(0.8, 1.7, 0.9), GRISF, x, -0.85, 0, 0, 0.04); P_(P, boite(0.65, 1.5, 0.7), c, x, -2.3, 0.1, 0, 0.04); P_(P, boite(1.1, 0.35, 1.6), GRISF, x, -3.05, 0.25, 0, 0.03); }, 0.4);
      P_(L, boite(3, 1.8, 2.2), c, 0, 4.1, 0, 0, 0.06); P_(L, boite(1.6, 0.4, 0.1), CYAN, 0, 4.4, 1.12, 0, 0);
      for (const s of [-1, 1]) { P_(L, boite(0.7, 0.7, 1.2), GRISF, s * 1.85, 4.3, 0, 0, 0.04); P_(L, futZ(0.25, 0.25, 2.2, 8), GRISF, s * 2.1, 3.9, 1, 0, 0.03); P_(L, sphere(0.14, 1), CYAN, s * 2.1, 3.9, 2.1, 0, 0); }
      P_(L, boite(0.8, 0.8, 0.6), BLANCF, 0, 5.3, -0.2, 0, 0.03);
    },
  },
};
const TAILLE = { fantassin: 1.4, rapide: 1.35, lourd: 1.3, chef: 1.25 };

/** Un ennemi : { groupe (à l'échelle du plateau, tourné vers +z), vol } ; genre : 'fantassin', 'rapide', 'lourd' ou 'chef' ;
 *  ere : l'époque (ERES, sa clé ou un style) ; couleur : celle de l'époque par défaut.
 *  avancer(e, distance, dt) le fait marcher (jambes, roues, hélices), abattre(e) le fait tomber. */
export function ennemi(genre, ere, couleur) {
  const E = typeof ere === 'string' ? ERES.find(e => e.cle === ere) || ERES.find(e => e.style === ere) : ere, cle = `${E.style}:${genre}`, col = couleur ?? E.couleur;
  const p = proto(`ennemi|${cle}|${E.pal ?? 0}|${col}`, () => { const A = atelier(); ENNEMIS[E.style][genre](A, col, E); return figer(A); });
  const c = copier(p), groupe = new THREE.Group(), s = ECH * TAILLE[genre];
  groupe.add(c.g); groupe.scale.setScalar(s);
  const vol = VOLANTS.has(cle), roule = c.parts.some(q => q.type === 'roue') || genre === 'lourd' && E.style !== 'antique' && E.style !== 'poudre';
  return { groupe, corps: c.g, parts: c.parts, vol, roule, echelle: s, pas: Math.random() * 6, mort: 0 };
}
/** L'ennemi a parcouru d (unités du plateau) en dt secondes : jambes et pattes au pas, roues qui tournent, hélices, balancement. */
export function avancer(e, d, dt) {
  const dl = d / e.echelle; e.pas += dl * 1.1;
  for (const p of e.parts) {
    if (p.type === 'jambe') p.o.rotation.x = Math.sin(e.pas + p.ph) * p.amp;
    else if (p.type === 'roue') p.o.rotation.x += dl / p.r;
    else if (p.type === 'helice') p.o.rotation[p.axe] += dt * p.v;
    else if (p.type === 'pulse') p.o.scale.setScalar(1 + Math.sin(e.pas * 2) * p.amp);
  }
  e.corps.position.y = e.vol ? Math.sin(e.pas * 0.3) * 0.3 : e.roule ? Math.sin(e.pas * 7) * 0.03 : Math.abs(Math.sin(e.pas)) * 0.12;
}
const MORTS = [], TOUCHES = [];
/** L'ennemi tombe (les troupes s'effondrent, les engins s'affaissent, les volants piquent), puis disparaît de la scène. */
export function abattre(e) { e.mort = performance.now() / 1000; e.cote = Math.random() < 0.5 ? -1 : 1; MORTS.push(e); }
/** Un coup reçu : l'ennemi tressaille. */
export function toucher(e) { e.touche = performance.now() / 1000; if (!TOUCHES.includes(e)) TOUCHES.push(e); }
chaqueImage(dt => {
  const now = performance.now() / 1000;
  for (let i = TOUCHES.length - 1; i >= 0; i--) { const e = TOUCHES[i], u = (now - e.touche) / 0.15; e.corps.scale.setScalar(u < 1 ? 1 + Math.sin(u * Math.PI) * 0.12 : 1); if (u >= 1) TOUCHES.splice(i, 1); }
  for (let i = MORTS.length - 1; i >= 0; i--) {
    const e = MORTS[i], u = Math.min(1, (now - e.mort) / 0.9);
    if (e.vol) { e.corps.rotation.z = e.cote * u * 0.8; e.corps.rotation.x = u * 0.6; e.corps.position.y -= dt * 30 * u; }
    else if (e.roule) { e.corps.rotation.x = -u * 0.15; e.corps.position.y = -u * 0.6; }
    else { e.corps.rotation.z = e.cote * Math.min(1, u * 1.6) * 1.45; e.corps.position.y = -u * 0.4; }
    if (u > 0.6) e.groupe.scale.setScalar(e.echelle * (1 - (u - 0.6) / 0.4));
    if (u >= 1) { e.groupe.parent?.remove(e.groupe); MORTS.splice(i, 1); }
  }
});

// ------------------------------------------------------------------ pièges (posés sur la route, au centre de la case, tournés le long du chemin)
// Les pointes jaillissent à chaque passage et s'émoussent (m.usure, 1 → 0) ; la mine montre sa charge tant qu'elle est armée
// (m.arme) ; la barricade tremble quand on la frappe et penche à mesure qu'elle s'use (m.vie, 1 → 0). Le jeu règle ces champs.
const pointe = (P, x, z, h = 0.9, col = FER) => P_(P, cone(0.14, h, 4), col, x, h / 2, z, 0, 0.02);
const PIEGES_3D = {
  antique: {
    pointes(A) {  // chausse-trappes de fer semées dans l'herbe, et quelques pieux
      mobile(A, 'jaillit', 0, 0, 0, P => { for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 0.8 + (k % 4) * 0.75; pointe(P, Math.cos(a) * r, Math.sin(a) * r, 0.7, 0x5a5a5e); } }, { amp: 0.4 });
      for (const x of [-2.6, 2.6]) P_(A.L, cyl(0.12, 0.2, 1.6, 5).rotateZ(x > 0 ? -0.5 : 0.5), BOIS, x, 0.6, 0, 0, 0.03);
    },
    boue(A) {  // fossé boueux : la boue bouillonne
      P_(A.L, cyl(3.4, 3.6, 0.1, 14).scale(1, 1, 0.8), 0x6a4a28, 0, 0.05, 0, 0, 0.02);
      mobile(A, 'pulse', 0, 0.1, 0, P => { for (let k = 0; k < 5; k++) P_(P, sphere(0.25 + (k % 2) * 0.1, 1).scale(1, 0.5, 1), 0x7a5a32, Math.cos(k * 1.3) * 1.8, 0, Math.sin(k * 1.3) * 1.3, 0, 0); }, { amp: 0.25, v: 3 });
    },
    mine(A) {  // fosse à feu : fagots et jarres d'huile sous les branches
      P_(A.L, cyl(1.8, 1.8, 0.08, 10), 0x4a3a28, 0, 0.04, 0, 0, 0.02);
      mobile(A, 'arme', 0, 0, 0, P => { for (let k = 0; k < 6; k++) P_(P, boite(0.15, 0.15, 3.4), BOIS2, 0, 0.15, 0, k * 0.52, 0.02); for (const x of [-0.7, 0.7]) P_(P, sphere(0.35, 1).scale(1, 1.2, 1), 0xb0603a, x, 0.4, 0.3, 0, 0.02); });
      flammeArmee(A, 0, 0.5, -0.6, 0.35);
    },
    barrage(A) {  // abattis : troncs couchés en travers, branches pointées vers l'ennemi
      for (const [y, r] of [[0.45, 0.1], [1.1, -0.15]]) P_(A.L, cyl(0.42, 0.5, 6, 8).rotateZ(Math.PI / 2), BOIS, 0, y, 0, r, 0.04);
      for (let k = 0; k < 6; k++) P_(A.L, cyl(0.06, 0.12, 1.8, 5).rotateX(-0.9), BOIS2, -2.4 + k * 0.95, 1, -0.9, 0, 0.02);
    },
  },
  poudre: {
    pointes(A) {  // chevaux de frise : une poutre hérissée de pieux croisés
      P_(A.L, cyl(0.25, 0.25, 5.6, 8).rotateZ(Math.PI / 2), BOIS, 0, 0.9, 0, 0, 0.03);
      mobile(A, 'jaillit', 0, 0.9, 0, P => { for (let k = 0; k < 7; k++) for (const a of [0.8, -0.8]) P_(P, boite(0.1, 2.4, 0.1).rotateX(a), BOIS2, -2.4 + k * 0.8, 0, 0, 0, 0.02); }, { amp: 0.25 });
    },
    boue(A) {  // marais inondé : eau, roseaux
      P_(A.L, cyl(3.4, 3.6, 0.1, 14).scale(1, 1, 0.8), 0x4f7a6a, 0, 0.05, 0, 0, 0.02);
      for (let k = 0; k < 7; k++) mobile(A, 'oscille', Math.cos(k) * 2.8, 0, Math.sin(k) * 2.1, P => P_(P, boite(0.06, 1.2, 0.06), 0x6a8a3a, 0, 0.6, 0, 0, 0), { axe: 'z', amp: 0.15, v: 2, ph: k });
      mobile(A, 'pulse', 0, 0.12, 0, P => P_(P, new THREE.TorusGeometry(1.2, 0.05, 3, 16).rotateX(Math.PI / 2), 0x8ab0a0, 0, 0, 0, 0, 0), { amp: 0.3, v: 1.5 });
    },
    mine(A) {  // fougasse : un baril de poudre enterré, sa mèche qui grésille
      P_(A.L, cyl(1.5, 1.6, 0.25, 10), 0x7a6a4a, 0, 0.12, 0, 0, 0.02);
      mobile(A, 'arme', 0, 0, 0, P => { P_(P, cyl(0.6, 0.6, 0.6, 10), BOIS, 0, 0.3, 0, 0, 0.03); P_(P, cyl(0.62, 0.62, 0.08, 10), FONTE, 0, 0.45, 0, 0, 0); P_(P, boite(0.04, 0.04, 1.4), 0xd8c8a0, 0.3, 0.62, 0.7, 0.6, 0); });
      flammeArmee(A, 0.9, 0.65, 1.1, 0.2);
    },
    barrage(A) {  // gabions : paniers d'osier remplis de terre
      for (let k = 0; k < 5; k++) { P_(A.L, cyl(0.6, 0.6, 1.4, 10), 0x9a8058, -2.4 + k * 1.2, 0.7, 0, 0, 0.03); P_(A.L, cyl(0.55, 0.55, 0.08, 10), 0x6a5a3a, -2.4 + k * 1.2, 1.41, 0, 0, 0); }
      for (let k = 0; k < 2; k++) P_(A.L, cyl(0.6, 0.6, 1.4, 10), 0x9a8058, -0.6 + k * 1.2, 2.1, 0, 0, 0.03);
    },
  },
  guerres: {
    pointes(A) {  // barbelés : piquets et rouleaux de fil
      for (const x of [-2.6, 0, 2.6]) P_(A.L, boite(0.12, 1.4, 0.12), BOIS, x, 0.7, 0, 0, 0.02);
      mobile(A, 'jaillit', 0, 0.6, 0, P => { for (let k = 0; k < 7; k++) P_(P, new THREE.TorusGeometry(0.55, 0.03, 3, 10).rotateY(Math.PI / 2), 0x6a6a6a, -2.7 + k * 0.9, 0, 0, 0, 0); P_(P, boite(5.6, 0.03, 0.03), 0x6a6a6a, 0, 0.5, 0, 0, 0); }, { amp: 0.15 });
    },
    boue(A) {  // tranchée inondée : planches, eau boueuse
      P_(A.L, boite(5.6, 0.1, 2.4), 0x5a4a32, 0, 0.05, 0, 0, 0.02); for (const z of [-1.25, 1.25]) P_(A.L, boite(5.8, 0.4, 0.2), BOIS2, 0, 0.2, z, 0, 0.02);
      mobile(A, 'pulse', 0, 0.12, 0, P => { for (let k = 0; k < 4; k++) P_(P, sphere(0.25, 1).scale(1, 0.4, 1), 0x6a5a3a, -2 + k * 1.3, 0, (k % 2 - 0.5) * 0.8, 0, 0); }, { amp: 0.2, v: 2.5 });
    },
    mine(A) {  // mine : un disque de fer et ses détonateurs, à moitié enterré
      P_(A.L, cyl(1.2, 1.3, 0.1, 10), 0x7a6a4a, 0, 0.05, 0, 0, 0.02);
      mobile(A, 'arme', 0, 0, 0, P => { P_(P, cyl(0.7, 0.75, 0.3, 12), 0x4a5038, 0, 0.18, 0, 0, 0.03); for (let k = 0; k < 3; k++) P_(P, cyl(0.06, 0.06, 0.3, 5), FER, Math.cos(k * 2.1) * 0.3, 0.45, Math.sin(k * 2.1) * 0.3, 0, 0); });
    },
    barrage(A) {  // hérissons tchèques : poutrelles d'acier croisées
      for (const x of [-1.9, 0, 1.9]) { for (const [rx, rz] of [[0, 0.95], [0, -0.95], [Math.PI / 2, 0]]) P_(A.L, boite(0.22, 2.4, 0.22).rotateZ(rz).rotateX(rx), 0x4a4a4e, x, 0.9, 0, 0, 0.03); }
    },
  },
  moderne: {
    pointes(A) {  // herse à clous jaune et noire en travers de la route
      for (let k = 0; k < 8; k++) P_(A.L, boite(0.7, 0.12, 0.6), k % 2 ? 0xe8c020 : NOIR, -2.8 + k * 0.8, 0.06, 0, 0, 0.02);
      mobile(A, 'jaillit', 0, 0.1, 0, P => { for (let k = 0; k < 16; k++) pointe(P, -3 + k * 0.4, (k % 2 - 0.5) * 0.3, 0.45, 0xc8ccd0); }, { amp: 0.2 });
    },
    boue(A) {  // mousse collante : des amas jaunâtres qui gonflent
      mobile(A, 'pulse', 0, 0, 0, P => { for (let k = 0; k < 7; k++) P_(P, sphere(0.6 + (k % 3) * 0.2, 1).scale(1, 0.55, 1), k % 2 ? 0xf0e6a0 : 0xe8d878, Math.cos(k * 0.9) * 2, 0.25, Math.sin(k * 0.9) * 1.4, 0, 0.02); }, { amp: 0.08, v: 2 });
    },
    mine(A) {  // mine antichar verte et son voyant
      P_(A.L, cyl(1.2, 1.3, 0.1, 10), 0x7a7a6a, 0, 0.05, 0, 0, 0.02);
      mobile(A, 'arme', 0, 0, 0, P => { P_(P, cyl(0.8, 0.85, 0.35, 14), 0x4f6a3a, 0, 0.2, 0, 0, 0.03); P_(P, cyl(0.25, 0.25, 0.1, 8), FONTE, 0, 0.42, 0, 0, 0); });
      voyantArme(A, 0, 0.5, 0, 0xff3a3a);
    },
    barrage(A) {  // blocs de béton en travers
      for (const x of [-1.9, 0, 1.9]) { P_(A.L, boite(1.7, 0.5, 1), BETON, x, 0.25, 0, 0, 0.04); P_(A.L, boite(1.3, 0.9, 0.5), BETON, x, 0.95, 0, 0, 0.04); P_(A.L, boite(1.72, 0.12, 1.02), 0xd84a3a, x, 0.55, 0, 0, 0); }
    },
  },
  futur: {
    pointes(A) {  // champ de lames : des lames de lumière qui sortent du sol
      for (const x of [-2.2, 0, 2.2]) P_(A.L, cyl(0.6, 0.7, 0.15, 6), GRISF, x, 0.08, 0, 0, 0.02);
      mobile(A, 'jaillit', 0, 0.1, 0, P => { for (const x of [-2.2, 0, 2.2]) for (let k = 0; k < 3; k++) P_(P, boite(0.06, 0.9, 0.5).rotateY(k * 1.05), CYAN, x, 0.45, 0, 0, 0); }, { amp: 0.5 });
    },
    boue(A) {  // champ de gravité : anneaux violets qui battent
      P_(A.L, cyl(3, 3, 0.08, 6), GRISF, 0, 0.04, 0, 0, 0.02);
      for (let k = 0; k < 3; k++) mobile(A, 'pulse', 0, 0.12 + k * 0.05, 0, P => P_(P, new THREE.TorusGeometry(0.9 + k * 0.8, 0.06, 3, 24).rotateX(Math.PI / 2), 0xa060ff, 0, 0, 0, 0, 0), { amp: 0.12, v: 3, ph: k });
    },
    mine(A) {  // mine à impulsion : un cœur lumineux qui clignote
      P_(A.L, cyl(1, 1.2, 0.25, 6), GRISF, 0, 0.12, 0, 0, 0.02);
      mobile(A, 'arme', 0, 0, 0, P => P_(P, sphere(0.5, 1).scale(1, 0.6, 1), BLANCF, 0, 0.35, 0, 0, 0.02));
      voyantArme(A, 0, 0.55, 0, MAGENTA, 0.3);
    },
    barrage(A) {  // mur de force : deux bornes et le mur translucide qui ondule
      for (const x of [-2.6, 2.6]) { P_(A.L, boite(0.6, 2.4, 0.6), BLANCF, x, 1.2, 0, 0, 0.03); P_(A.L, boite(0.62, 0.15, 0.62), CYAN, x, 2.2, 0, 0, 0); }
      mobile(A, 'pulse', 0, 1.1, 0, P => { P_(P, boite(4.6, 1.8, 0.12), 0x7fd8ff, 0, 0, 0, 0, 0); for (let k = 0; k < 4; k++) P_(P, boite(4.6, 0.05, 0.14), CYAN, 0, -0.7 + k * 0.45, 0, 0, 0); }, { amp: 0.03, v: 6 });
    },
  },
};
function flammeArmee(A, x, y, z, s) { mobile(A, 'arme', x, y, z, P => { P_(P, cone(0.35 * s, 0.9 * s, 6), FEU, 0, 0, 0, 0, 0); P_(P, cone(0.18 * s, 0.5 * s, 6), 0xffe27a, 0, -0.1, 0, 0, 0); }); }
function voyantArme(A, x, y, z, col, r = 0.14) { mobile(A, 'clignote', x, y, z, P => P_(P, sphere(r, 1), col, 0, 0, 0, 0, 0), { v: 7, ph: 0, armee: true }); }

/** Un piège : { groupe (à l'échelle du plateau ; le jeu le tourne le long du chemin), arme, usure, vie } ; role : 'pointes', 'boue',
 *  'mine' ou 'barrage' ; declencher(p) joue son coup (pointes qui jaillissent, barricade qui tremble). */
export function piege(role, ere, { pop = false } = {}) {
  const E = typeof ere === 'string' ? ERES.find(e => e.cle === ere) || ERES.find(e => e.style === ere) : ere;
  const pr = proto(`piege|${role}|${E.style}`, () => { const A = atelier(); PIEGES_3D[E.style][role](A); return figer(A); });
  const c = copier(pr), groupe = new THREE.Group(); groupe.add(c.g); groupe.scale.setScalar(ECH * 1.15);
  const m = { groupe, corps: c.g, tete: c.g, bouche: new THREE.Vector3(), parts: c.parts.map(p => p.armee ? { ...p, type: 'clignoteArme' } : p), fum: [], style: E.style, role: null, piege: role, arme: true, usure: 1, vie: 1, tir: -99, pop: pop ? performance.now() / 1000 : 0, prochaineFumee: 0, vu: false };
  TOURS_VIVES.push(m);
  return m;
}
/** Le piège joue son coup : les pointes jaillissent, la barricade tremble sous les coups. */
export function declencher(m) { m.tir = performance.now() / 1000; }

// ------------------------------------------------------------------ projectiles
const PROJ = {
  fleche: L => { P_(L, futZ(0.06, 0.06, 2.2, 4), BOIS2, 0, 0, 0, 0, 0); P_(L, cone(0.16, 0.45, 4).rotateX(Math.PI / 2), FER, 0, 0, 1.3, 0, 0); P_(L, boite(0.3, 0.02, 0.4), BLANC, 0, 0, -1, 0, 0); },
  carreau: L => { P_(L, futZ(0.1, 0.1, 3, 4), BOIS, 0, 0, 0, 0, 0); P_(L, cone(0.25, 0.6, 4).rotateX(Math.PI / 2), FER, 0, 0, 1.7, 0, 0); P_(L, boite(0.4, 0.03, 0.5), BLANC, 0, 0, -1.3, 0, 0); },
  pierre: L => P_(L, sphere(0.8, 0), 0x8d8f96, 0, 0, 0, 0, 0.08),
  boulet: L => P_(L, sphere(0.45, 1), FONTE, 0, 0, 0, 0, 0.05),
  balle: L => P_(L, futZ(0.08, 0.08, 1.6, 4), 0xffe08a, 0, 0, 0, 0, 0),
  obus: L => { P_(L, futZ(0.3, 0.3, 1, 8), BRONZE, 0, 0, 0, 0, 0.03); P_(L, cone(0.3, 0.6, 8).rotateX(Math.PI / 2), FONTE, 0, 0, 0.8, 0, 0); },
  roquette: L => { P_(L, futZ(0.25, 0.25, 1.8, 8), BLANCF, 0, 0, 0, 0, 0.03); P_(L, cone(0.25, 0.6, 8).rotateX(Math.PI / 2), ROUGE, 0, 0, 1.2, 0, 0); P_(L, cone(0.3, 0.6, 6).rotateX(-Math.PI / 2), FEU, 0, 0, -1.2, 0, 0); },
  poix: L => { P_(L, sphere(0.55, 1), 0x14100c, 0, 0, 0, 0, 0.03); P_(L, sphere(0.3, 1), FEU, 0, 0.3, 0, 0, 0); },
  eau: L => P_(L, sphere(0.55, 1).scale(1, 1, 2), EAU, 0, 0, 0, 0, 0),
  glace: L => P_(L, sphere(0.55, 0).scale(1, 1, 2), 0xa8f0ff, 0, 0, 0, 0, 0.02),
  plasma: L => { P_(L, sphere(0.75, 1), MAGENTA, 0, 0, 0, 0, 0); P_(L, sphere(0.4, 1), 0xffd0ff, 0, 0, 0.2, 0, 0); },
  laser: L => P_(L, futZ(0.12, 0.12, 3, 4), CYAN, 0, 0, 0, 0, 0),
};
/** Un projectile (tourné vers +z, à l'échelle du plateau) : 'fleche', 'carreau', 'pierre', 'boulet', 'balle', 'obus', 'roquette', 'poix',
 *  'eau', 'glace', 'plasma', 'laser'. */
export function projectile(genre) {
  const g = proto(`proj|${genre}`, () => { const L = lot(); (PROJ[genre] || PROJ.boulet)(L); return fige(L); }).clone();
  g.scale.setScalar(ECH); g.userData.genre = genre;
  return g;
}
/** À chaque pas d'un projectile en vol : traînée des roquettes, fumée de la poix, rotation des boulets et des pierres. */
export function suivreTir(p) {
  const g = p.userData.genre, r = Math.random();
  if (g === 'roquette' && r < 0.6) bouffee(p.position.x, p.position.y, p.position.z, 'blanche', 0.35);
  else if (g === 'poix' && r < 0.3) bouffee(p.position.x, p.position.y, p.position.z, 'noire', 0.3);
}

// ------------------------------------------------------------------ effets (animés ici, en temps réel)
const effets = [];
const BOULE = new THREE.IcosahedronGeometry(1, 1), ANNEAU = new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2), MAT_FEU = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, depthWrite: false });
function effet(o, duree, maj) { maj(0); scene.add(o); effets.push({ o, t: 0, duree, maj }); }
const feu = c => { const m = MAT_FEU.clone(); m.color.setHex(c); return m; };
/** Une explosion de rayon r (unités du plateau) : boule de feu, onde au sol, fumée et terre soulevée ; couleur 0xffb040 (plasma : 0xe040ff). */
export function explosion(x, y, z, r = 0.4, couleur = 0xffb040) {
  const b = new THREE.Mesh(BOULE, feu(couleur)); b.position.set(x, y, z);
  effet(b, 0.45, u => { b.scale.setScalar(r * (0.35 + u * 0.9)); b.material.opacity = 1 - u; });
  const c = new THREE.Mesh(BOULE, feu(0xfff4c0)); c.position.set(x, y, z);
  effet(c, 0.18, u => { c.scale.setScalar(r * (0.2 + u * 0.4)); c.material.opacity = 1 - u; });
  const a = new THREE.Mesh(ANNEAU, feu(couleur === 0xffb040 ? 0xfff0d0 : couleur)); a.position.set(x, y + 0.03, z);
  effet(a, 0.5, u => { a.scale.setScalar(r * (0.3 + u * 1.6)); a.material.opacity = 0.8 * (1 - u); });
  const plasma = couleur !== 0xffb040;
  for (let k = 0; k < 4; k++) bouffee(x + (Math.random() - 0.5) * r, y + 0.05, z + (Math.random() - 0.5) * r, plasma ? 'blanche' : k % 2 ? 'noire' : 'poussiere', 0.6 + r);
}
/** Un éclair de départ du coup (bouche d'un canon, d'un fusil, d'un émetteur). */
export function eclat(x, y, z, couleur = 0xfff1a0) {
  const m = new THREE.Mesh(BOULE, feu(couleur)); m.position.set(x, y, z);
  effet(m, 0.12, u => { m.scale.setScalar(0.06 + u * 0.08); m.material.opacity = 1 - u; });
}
/** Une éclaboussure au sol (poix, eau, glace) : une tache qui s'étale puis s'efface, et des gouttes. */
export function eclaboussure(x, y, z, couleur = EAU, r = 0.35) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false }));
  m.position.set(x, y + 0.02, z);
  effet(m, 1.2, u => { m.scale.setScalar(r * Math.min(1, u * 5)); m.material.opacity = 0.65 * (1 - u); });
  for (let k = 0; k < 5; k++) {
    const g = new THREE.Mesh(BOULE, feu(couleur)), a = k / 5 * Math.PI * 2, v = 0.6 + Math.random() * 0.5;
    effet(g, 0.45, u => { g.position.set(x + Math.cos(a) * v * u * r * 1.5, y + Math.sin(u * Math.PI) * 0.25, z + Math.sin(a) * v * u * r * 1.5); g.scale.setScalar(0.035); g.material.opacity = 1 - u; });
  }
}
/** Un rayon (laser) entre deux points, avec un halo, qui s'éteint vite. */
export function rayon(a, b, couleur = CYAN) {
  const l = a.distanceTo(b);
  for (const [ep, op] of [[0.018, 1], [0.05, 0.35]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(ep, ep, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2), feu(couleur));
    m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, l);
    effet(m, 0.18, u => { m.material.opacity = op * (1 - u); m.scale.x = m.scale.y = 1 + u * 1.5; });
  }
  eclat(b.x, b.y, b.z, couleur);
}
/** La chute d'un ennemi : poussière (ou fumée noire d'un engin). */
export function chute(x, y, z, engin = false) { for (let k = 0; k < (engin ? 5 : 3); k++) bouffee(x + (Math.random() - 0.5) * 0.25, y + 0.05, z + (Math.random() - 0.5) * 0.25, engin ? 'noire' : 'poussiere', engin ? 1 : 0.6); }
chaqueImage(dt => {
  for (let i = effets.length - 1; i >= 0; i--) {
    const e = effets[i]; e.t += dt; const u = Math.min(1, e.t / e.duree); e.maj(u);
    if (u >= 1) { scene.remove(e.o); if (e.o.geometry !== BOULE && e.o.geometry !== ANNEAU) e.o.geometry.dispose(); e.o.material.dispose(); effets.splice(i, 1); }
  }
});

// ------------------------------------------------------------------ portée et barres de vie
/** L'anneau de portée d'une tour, à plat (rayon r en unités du plateau) : un disque translucide et son bord. */
export function anneauPortee(r, couleur = 0xffffff) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.12, depthWrite: false })));
  g.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.04, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.7, depthWrite: false })));
  g.renderOrder = 2;
  return g;
}
const M_FOND = new THREE.SpriteMaterial({ color: 0x1a1a1a, depthTest: false }), BARRE_L = 0.42;
/** Une barre de vie qui fait face à la caméra : { objet (à placer au-dessus de l'ennemi), regler(f) (f : 0 à 1) }. */
export function barreVie() {
  const objet = new THREE.Group(), fond = new THREE.Sprite(M_FOND), vie = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x5fd35f, depthTest: false }));
  fond.scale.set(BARRE_L + 0.03, 0.07, 1); vie.scale.set(BARRE_L, 0.045, 1); fond.renderOrder = 5; vie.renderOrder = 6;
  objet.add(fond, vie);
  // le bord gauche reste fixe à l'écran : l'ancre du sprite se déplace quand il raccourcit
  const regler = f => { f = Math.max(0.001, Math.min(1, f)); vie.scale.x = BARRE_L * f; vie.center.set(0.5 / f, 0.5); vie.material.color.setHex(f > 0.5 ? 0x5fd35f : f > 0.25 ? 0xffc040 : 0xe04a3a); };
  return { objet, regler };
}

// ------------------------------------------------------------------ la ville à défendre
/** Un bâtiment de la ville à défendre, à l'échelle du plateau : coeur (la case d'arrivée du chemin) ou maison (autour).
 *  { groupe } ; les bâtiments modernes et antiques sont animés (fumées, fenêtres la nuit) par animerVille() une fois dans la scène. */
export function batimentVille(ere, coeur, graine = 1, saison = 2) {
  const E = typeof ere === 'string' ? ERES.find(e => e.cle === ere) : ere;
  if (E.style === 'antique') { const m = modele(coeur ? ANT.oppidum : (graine % 2 ? ANT.hutte : ANT.longue), graine); return { groupe: m.groupe, m }; }
  if (E.bat) { const r = maillageBatiment({ cle: coeur ? 'citadelle' : graine % 3 ? 'maison' : 'maison_pierre', couleur: '#2f5fa8', epoque: E.bat, saison }); return { groupe: r.mesh, anim: r.anim, id: `defense-ville-${++nVille}` }; }
  const m = modele(coeur ? QBAT.centre : graine % 3 ? QBAT.residentiel : QBAT.village, graine);
  return { groupe: m.groupe, m };
}
let nVille = 0;
/** Une fois le bâtiment posé et ajouté à la scène : fumées, fenêtres la nuit, rebond de construction (modèles antiques et modernes) ;
 *  drapeaux, cheminées et fumées des bâtiments de 1700 à 1816 (ceux de web_royaumes, animés par monde.js). */
export function animerVille(b, pop = false) { if (b.m) animer(b.m, { pop }); if (b.anim) animerPose(b.id, b.groupe, b.anim, '#2f5fa8'); }
/** Retire ce qu'animerVille a posé à côté du bâtiment (drapeaux et fumées de monde.js), quand la ville disparaît. */
export function oublierVille(b) { if (b.anim) oublierPose(b.id); }
