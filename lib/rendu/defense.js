// Le tower defense (web_defense) : tours, ennemis, projectiles, effets et villes à défendre, une allure par âge.
// Quinze époques (ERES), de l'Antiquité à 2035, regroupées en cinq styles de dessin : antique, poudre (1700 → 1816),
// guerres (1900 → 1946), moderne (1960 → 1990) et futur (2005 → 2035). Quatre rôles de tour (rapide, zone, lent, loin)
// et quatre genres d'ennemi (fantassin, rapide, lourd, chef) changent d'aspect avec le style ; les villes reprennent les
// bâtiments de antiques.js, modeles.js et modernes.js. Modèles en unités de 10 par case, rendus à l'échelle du plateau.
import { THREE, scene, chaqueImage } from './scene.js';
import { lot, put, fige, boite, cyl, cone, sphere } from './toon.js';
import { bouffee } from './vie.js';
import { maillageBatiment } from './modeles.js';
import { modele, animer, QBAT } from './modernes.js';
import { ANT } from './antiques.js';

// ------------------------------------------------------------------ catalogue
/** Les quinze époques du jeu, dans l'ordre : style de dessin, niveau des routes (routes.js), couleur des ennemis, bâtiments de la ville. */
export const ERES = [
  { cle: 'antiquite', an: -52, nom: 'Antiquité', style: 'antique', route: 1, couleur: 0xb8322a },
  { cle: 'ancien', an: 1700, nom: 'Ancien Régime', style: 'poudre', route: 2, couleur: 0xe8e2d0, bat: 'ancien' },
  { cle: 'lumieres', an: 1750, nom: 'Lumières', style: 'poudre', route: 3, couleur: 0xb8322a, bat: 'lumieres' },
  { cle: 'empire', an: 1789, nom: 'Révolution et Empire', style: 'poudre', route: 4, couleur: 0x2a6a3a, bat: 'empire' },
  { cle: 'industrie', an: 1816, nom: 'Révolution industrielle', style: 'poudre', route: 5, couleur: 0x3a4a8a, bat: 'industrie' },
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
    ennemis: { fantassin: 'Guerriers', rapide: 'Cavaliers', lourd: 'Tortue romaine', chef: 'Éléphant de guerre' },
  },
  poudre: {
    tours: { rapide: ['Mousquetaires', 'balle'], zone: ['Canon', 'boulet'], lent: ['Pompe à bras', 'eau'], loin: ['Couleuvrine', 'boulet'] },
    ennemis: { fantassin: 'Fusiliers', rapide: 'Dragons', lourd: 'Grenadiers cuirassés', chef: 'Canon de siège' },
  },
  guerres: {
    tours: { rapide: ['Mitrailleuse', 'balle'], zone: ['Obusier', 'obus'], lent: ['Pompe à vapeur', 'eau'], loin: ['Canon long', 'obus'] },
    ennemis: { fantassin: 'Fantassins', rapide: 'Motocyclistes', lourd: 'Char', chef: 'Zeppelin' },
  },
  moderne: {
    tours: { rapide: ['Tourelle double', 'balle'], zone: ['Lance-roquettes', 'roquette'], lent: ['Canon à eau', 'eau'], loin: ['Lance-missiles', 'roquette'] },
    ennemis: { fantassin: 'Soldats', rapide: 'Jeeps', lourd: 'Char d’assaut', chef: 'Hélicoptère' },
  },
  futur: {
    tours: { rapide: ['Tourelle laser', 'laser'], zone: ['Mortier à plasma', 'plasma'], lent: ['Rayon cryogénique', 'glace'], loin: ['Canon électrique', 'laser'] },
    ennemis: { fantassin: 'Robots', rapide: 'Drones', lourd: 'Glisseur blindé', chef: 'Méca géant' },
  },
};
export const ROLES = ['rapide', 'zone', 'lent', 'loin'];
export const GENRES = ['fantassin', 'rapide', 'lourd', 'chef'];
/** Les ennemis volants (au-dessus du chemin). */
export const VOLANTS = new Set(['guerres:chef', 'moderne:chef', 'futur:rapide']);

// ------------------------------------------------------------------ couleurs
const BOIS = 0x8a5a32, BOIS2 = 0x5b3a1e, PIERRE = 0xbcb6a8, PIERRE2 = 0x9a948a, FER = 0x3a3a3e, ACIER = 0x8a9098, LAITON = 0xd9b45a,
  PEAU = 0xf0c9a0, SABLE = 0xcdb98a, KAKI = 0x6f7a4a, BETON = 0xa8a8a2, NOIR = 0x26262a, CYAN = 0x5ff0ff, BLANC = 0xf2efe6, JOUEUR = 0x2f5fa8;
const ECH = 0.1;

// formes tournées : un fût dans l'axe z (avant du modèle), une roue dans l'axe x
const futZ = (r, l, s = 10) => cyl(r, r, l, s).rotateX(Math.PI / 2);
const roue = r => cyl(r, r, 0.4, 10).rotateZ(Math.PI / 2);
const incline = (g, a) => g.rotateX(-a);  // relève vers le haut ce qui pointe vers +z

/** Un personnage debout (tourné vers +z) : habit, coiffe ('casque', 'tricorne', 'bonnet', 'robot', 'kepi', 'aucun'), arme ('arc', 'fusil', 'lance'). */
function bonhomme(L, x, z, habit, { coiffe = 'aucun', arme = null, bouclier = null, ech = 1, y = 0 } = {}) {
  const k = ech, P = (g, c, dx, dy, dz) => put(L, g, c, x + dx * k, y + dy * k, z + dz * k, 0, 0.1);
  P(boite(0.45 * k, 1.1 * k, 0.4 * k), FER, -0.25, 0.55, 0); P(boite(0.45 * k, 1.1 * k, 0.4 * k), FER, 0.25, 0.55, 0);
  P(boite(1.15 * k, 1.3 * k, 0.75 * k), habit, 0, 1.75, 0);
  P(sphere(0.42 * k, 1), coiffe === 'robot' ? ACIER : PEAU, 0, 2.75, 0);
  if (coiffe === 'casque') P(sphere(0.48 * k, 1).scale(1, 0.6, 1), KAKI, 0, 2.95, 0);
  if (coiffe === 'tricorne') P(cone(0.75 * k, 0.45 * k, 3), NOIR, 0, 3.1, 0);
  if (coiffe === 'bonnet') P(cyl(0.38 * k, 0.45 * k, 0.75 * k, 8), NOIR, 0, 3.25, 0);
  if (coiffe === 'kepi') P(cyl(0.4 * k, 0.44 * k, 0.4 * k, 8), habit, 0, 3.05, 0);
  if (coiffe === 'robot') P(boite(0.5 * k, 0.15 * k, 0.1 * k), CYAN, 0, 2.8, 0.38);
  if (arme === 'fusil') P(boite(0.15 * k, 0.15 * k, 1.9 * k), BOIS2, 0.55, 1.9, 0.6);
  if (arme === 'lance') P(boite(0.12 * k, 3.4 * k, 0.12 * k), BOIS, 0.65, 1.9, 0.3);
  if (arme === 'arc') P(boite(0.12 * k, 2 * k, 0.25 * k), BOIS2, 0, 1.9, 0.75);
  if (bouclier) P(cyl(0.75 * k, 0.75 * k, 0.15 * k, 10).rotateX(Math.PI / 2), bouclier, -0.35, 1.7, 0.5);
}
/** Un cheval (tourné vers +z), le dos à y = 2,4. */
function cheval(L, x, z, robe = 0x6b4226) {
  put(L, boite(1.1, 1.1, 2.6), robe, x, 2.2, z, 0, 0.1);
  put(L, boite(0.7, 1.4, 0.7), robe, x, 3.1, z + 1.4, 0, 0.1); put(L, boite(0.6, 0.6, 1), robe, x, 3.6, z + 1.9, 0, 0.1);
  for (const [dx, dz] of [[-0.35, -1], [0.35, -1], [-0.35, 1], [0.35, 1]]) put(L, boite(0.3, 1.7, 0.3), robe, x + dx, 0.85, z + dz, 0, 0.08);
  put(L, boite(0.2, 1, 0.3), NOIR, x, 2.4, z - 1.4, 0, 0);
}

// ------------------------------------------------------------------ tours
/** Le socle d'une tour (tout son étage, sans la tête) : sa hauteur grandit avec le niveau (1 à 3). Rend la hauteur du dessus. */
function socle(L, style, niveau) {
  const h = 1.4 + (niveau - 1) * 1.1;
  if (style === 'antique') {
    put(L, cyl(4.4, 4.8, h, 10), BOIS, 0, h / 2, 0, 0, 0.15);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; put(L, cyl(0.35, 0.4, h + 1.2, 6), BOIS2, Math.cos(a) * 4.6, (h + 1.2) / 2, Math.sin(a) * 4.6, 0, 0.08); }
  } else if (style === 'poudre') {
    put(L, cyl(4.6, 5, h, 6), PIERRE, 0, h / 2, 0, Math.PI / 6, 0.15);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(L, boite(1.4, 0.9, 1.4), PIERRE2, Math.cos(a) * 4.2, h + 0.45, Math.sin(a) * 4.2, -a, 0.1); }
  } else if (style === 'guerres') {
    put(L, cyl(4.6, 4.9, h, 10), 0x8a7a5a, 0, h / 2, 0, 0, 0.15);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; put(L, boite(1.6, 0.8, 1).scale(1, 1, 1), SABLE, Math.cos(a) * 4.1, h + 0.4, Math.sin(a) * 4.1, -a + Math.PI / 2, 0.08); }
  } else if (style === 'moderne') {
    put(L, boite(8.6, h, 8.6), BETON, 0, h / 2, 0, 0, 0.15);
    put(L, boite(9, 0.3, 9), 0x7a7a76, 0, h + 0.15, 0, 0, 0.1);
  } else {
    put(L, cyl(4.4, 5, h, 6), 0x4a5260, 0, h / 2, 0, 0, 0.15);
    put(L, cyl(4.5, 4.5, 0.3, 6), CYAN, 0, h + 0.1, 0, 0, 0);
  }
  if (niveau >= 2) { put(L, cyl(0.12, 0.12, 4.5, 6), BOIS2, -3.6, h + 2.25, -3.6, 0, 0); put(L, boite(1.8, 1.1, 0.1), JOUEUR, -2.7, h + 3.8, -3.6, 0, 0.05); }
  if (niveau >= 3) put(L, cyl(style === 'moderne' ? 6.2 : 4.75, style === 'moderne' ? 6.2 : 4.85, 0.35, style === 'moderne' ? 4 : 10), LAITON, 0, h * 0.55, 0, Math.PI / 4, 0);
  return h;
}

/** La tête d'une tour, qui pivote vers sa cible (tournée vers +z) ; rend la bouche du tir (coordonnées de la tête). */
const TETES = {
  rapide: {
    antique(L) { put(L, cyl(3.2, 3.2, 0.4, 8), BOIS, 0, 0.2, 0, 0, 0.1); bonhomme(L, -1.1, 0, 0x5a7a3a, { arme: 'arc' }); bonhomme(L, 1.1, -0.3, 0x7a5a3a, { arme: 'arc' }); return [0, 2, 1]; },
    poudre(L) { bonhomme(L, -1.2, 0, JOUEUR, { coiffe: 'tricorne', arme: 'fusil' }); bonhomme(L, 1.2, 0, JOUEUR, { coiffe: 'tricorne', arme: 'fusil' }); return [0, 2, 1.6]; },
    guerres(L) {
      for (const dx of [-0.6, 0.6]) put(L, boite(0.15, 1.6, 0.15), FER, dx, 0.8, 0.4, 0, 0);
      put(L, boite(0.9, 0.9, 2.2), FER, 0, 1.8, 0.6, 0, 0.1); put(L, futZ(0.2, 2.4), FER, 0, 1.9, 2.6, 0, 0.06);
      bonhomme(L, 0, -1.6, KAKI, { coiffe: 'casque' }); return [0, 1.9, 3.8];
    },
    moderne(L) {
      put(L, boite(3.4, 1.8, 3.6), 0x5a6a4a, 0, 0.9, 0, 0, 0.12); put(L, boite(2.6, 0.6, 2.6), 0x4a5a3a, 0, 2.1, -0.3, 0, 0.1);
      for (const dx of [-0.6, 0.6]) put(L, futZ(0.22, 3.6), FER, dx, 1.1, 3.4, 0, 0.06);
      return [0, 1.1, 5.2];
    },
    futur(L) {
      put(L, sphere(1.9, 1), 0xd8dde4, 0, 1.9, 0, 0, 0.1); put(L, futZ(0.35, 3.2), 0x4a5260, 0, 2, 2.2, 0, 0.08);
      put(L, sphere(0.45, 1), CYAN, 0, 2, 3.9, 0, 0); return [0, 2, 4];
    },
  },
  zone: {
    antique(L) {
      for (const dx of [-1.4, 1.4]) { put(L, boite(0.4, 0.5, 4.6), BOIS, dx, 0.6, 0, 0, 0.1); put(L, boite(0.4, 2.6, 0.4), BOIS, dx, 1.6, 0.6, 0, 0.1); }
      put(L, boite(3.2, 0.4, 0.4), BOIS2, 0, 2.8, 0.6, 0, 0.1);
      put(L, incline(boite(0.35, 0.35, 4.4), 0.9), BOIS2, 0, 2.2, -0.5, 0, 0.08); put(L, sphere(0.6, 1), PIERRE2, 0, 3.8, -1.7, 0, 0.08);
      return [0, 3.8, -1.7];
    },
    poudre(L) {
      for (const dx of [-1.1, 1.1]) { put(L, roue(1.2), BOIS2, dx, 1.2, -0.4, 0, 0.1); put(L, boite(0.35, 0.7, 3.6), BOIS, dx * 0.6, 1.1, -0.8, 0, 0.08); }
      put(L, incline(cyl(0.45, 0.7, 4.4, 10).rotateX(Math.PI / 2), 0.12), 0x3e3a34, 0, 1.8, 0.8, 0, 0.1);
      return [0, 2.1, 3];
    },
    guerres(L) {
      put(L, boite(3.4, 0.6, 3.4), FER, 0, 0.3, 0, 0, 0.1); put(L, boite(3.2, 2.2, 0.3), KAKI, 0, 1.6, 1, 0, 0.1);
      put(L, incline(futZ(0.55, 4.6), 0.45), KAKI, 0, 2.4, 2, 0, 0.1); put(L, boite(1.6, 1.4, 1.8), KAKI, 0, 1.2, -0.4, 0, 0.1);
      return [0, 3.5, 3.9];
    },
    moderne(L) {
      put(L, boite(3.2, 1, 3.2), 0x5a6a4a, 0, 0.5, 0, 0, 0.12);
      const g = incline(boite(3, 2.2, 3.6), 0.35); put(L, g, 0x4a5a3a, 0, 2.2, 0.3, 0, 0.12);
      for (const dx of [-0.8, 0, 0.8]) for (const dy of [-0.5, 0.5]) put(L, incline(futZ(0.3, 0.4), 0.35), NOIR, dx, 2.2 + dy, 2.1 + dy * 0.35, 0, 0);
      return [0, 2.8, 2.4];
    },
    futur(L) {
      put(L, sphere(2.1, 1).scale(1, 0.6, 1), 0xd8dde4, 0, 0.9, 0, 0, 0.1); put(L, cyl(1.6, 1.6, 0.3, 12), 0xe040ff, 0, 1.6, 0, 0, 0);
      put(L, incline(cyl(0.7, 1, 2.2, 10).rotateX(Math.PI / 2), 0.7), 0x4a5260, 0, 2.2, 0.8, 0, 0.08);
      return [0, 3, 1.6];
    },
  },
  lent: {
    antique(L) {
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; put(L, boite(0.3, 3.4, 0.3), BOIS2, Math.cos(a) * 1.3, 1.7, Math.sin(a) * 1.3, 0, 0.06); }
      put(L, sphere(1.3, 1).scale(1, 0.75, 1), FER, 0, 1.4, 0, 0, 0.1); put(L, cyl(1.05, 1.05, 0.1, 10), NOIR, 0, 2.15, 0, 0, 0);
      put(L, cone(0.7, 1.1, 6), 0xff8a2a, 0, 0.5, 0, 0, 0); return [0, 2.4, 0.5];
    },
    poudre(L) {
      put(L, futZ(1.2, 2.6), BOIS, 0, 1.2, -0.8, 0, 0.1); put(L, boite(0.25, 2.2, 0.25), FER, 0, 2.5, -0.8, 0, 0);
      put(L, boite(3, 0.2, 0.2), BOIS2, 0, 3.5, -0.8, 0, 0.05); put(L, futZ(0.25, 2.6), LAITON, 0, 1.6, 1.6, 0, 0.05);
      return [0, 1.6, 2.9];
    },
    guerres(L) {
      put(L, cyl(1.2, 1.2, 3, 10).rotateZ(Math.PI / 2), 0x4a3a2a, 0, 1.3, -0.6, 0, 0.1); put(L, cyl(0.35, 0.45, 2.4, 8), NOIR, 1, 3.4, -0.6, 0, 0.06);
      put(L, futZ(0.3, 2.8), LAITON, 0, 1.5, 1.8, 0, 0.05); return [0, 1.5, 3.2];
    },
    moderne(L) {
      put(L, boite(3, 1.6, 3.6), 0xc8c8c0, 0, 0.8, 0, 0, 0.12); put(L, cyl(0.9, 0.9, 1, 10), 0xa8a8a2, 0, 2.1, 0, 0, 0.1);
      put(L, incline(futZ(0.3, 2.8), 0.2), ACIER, 0, 2.3, 1.4, 0, 0.06); return [0, 2.6, 2.8];
    },
    futur(L) {
      put(L, cyl(0.6, 1.2, 1.6, 6), 0x4a5260, 0, 0.8, 0, 0, 0.1); put(L, sphere(1.3, 0).scale(0.8, 1.5, 0.8), 0xa8f0ff, 0, 2.8, 0, 0, 0.08);
      return [0, 2.8, 0.8];
    },
  },
  loin: {
    antique(L) {
      put(L, boite(0.6, 2, 0.6), BOIS2, 0, 1, 0, 0, 0.1); put(L, boite(0.6, 0.5, 4.6), BOIS, 0, 2.3, 0.6, 0, 0.1);
      for (const s of [-1, 1]) put(L, boite(2.4, 0.4, 0.4), BOIS2, s * 1.3, 2.4, 2.2, -s * 0.35, 0.08);
      return [0, 2.5, 2.9];
    },
    poudre(L) {
      put(L, boite(1.8, 1.2, 3), BOIS, 0, 0.9, -0.4, 0, 0.1);
      put(L, incline(cyl(0.3, 0.55, 6.2, 10).rotateX(Math.PI / 2), 0.08), 0x7a6a3a, 0, 1.9, 1.6, 0, 0.08);
      return [0, 2.2, 4.7];
    },
    guerres(L) {
      put(L, cyl(1.8, 2, 1, 10), FER, 0, 0.5, 0, 0, 0.1); put(L, boite(2.6, 2, 2.4), 0x5a6060, 0, 2, -0.2, 0, 0.1);
      put(L, incline(futZ(0.35, 6.4), 0.1), 0x5a6060, 0, 2.2, 4, 0, 0.08); return [0, 2.5, 7.2];
    },
    moderne(L) {
      put(L, boite(2.4, 1.2, 2.4), 0x5a6a4a, 0, 0.6, 0, 0, 0.1);
      for (const dx of [-0.7, 0.7]) { put(L, incline(futZ(0.4, 4), 0.4), BLANC, dx, 2.2, 0.6, 0, 0.06); put(L, incline(cone(0.4, 0.9, 8).rotateX(Math.PI / 2), 0.4), 0xb8322a, dx, 3, 2.8, 0, 0); }
      return [0, 3.1, 3];
    },
    futur(L) {
      put(L, cyl(1.4, 1.8, 1.4, 6), 0x4a5260, 0, 0.7, 0, 0, 0.1);
      for (const dx of [-0.6, 0.6]) put(L, boite(0.4, 0.5, 6.6), 0xd8dde4, dx, 2, 1.8, 0, 0.06);
      put(L, futZ(0.25, 5.4), CYAN, 0, 2, 1.8, 0, 0); return [0, 2, 5.2];
    },
  },
};

// prototypes figés une fois, puis clonés (géométries partagées)
const PROTOS = new Map();
function proto(cle, f) { let p = PROTOS.get(cle); if (!p) { p = f(); PROTOS.set(cle, p); } return p; }

/** Une tour : { groupe (à l'échelle du plateau), tete (pivote sur y vers +z), bouche (THREE.Vector3, coordonnées de la tête) }.
 *  role : 'rapide', 'zone', 'lent' ou 'loin' ; style : celui de l'époque ; niveau : 1 à 3. */
export function tour(role, style, niveau = 1) {
  const p = proto(`tour|${role}|${style}|${niveau}`, () => {
    const S = lot(), h = socle(S, style, niveau), base = fige(S);
    const T = lot(), b = TETES[role][style](T), tete = fige(T);
    tete.position.y = h;
    return { base, tete, bouche: new THREE.Vector3(...b) };
  });
  const groupe = new THREE.Group(), tete = p.tete.clone();
  groupe.add(p.base.clone(), tete);
  groupe.scale.setScalar(ECH);
  return { groupe, tete, bouche: p.bouche.clone() };
}

// ------------------------------------------------------------------ ennemis
const ENNEMIS = {
  antique: {
    fantassin(L, c) { bonhomme(L, 0, 0, c, { arme: 'lance', bouclier: 0xc9a14f }); },
    rapide(L, c) { cheval(L, 0, 0); bonhomme(L, 0, -0.2, c, { arme: 'lance', y: 1.6, ech: 0.9 }); },
    lourd(L, c) {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) put(L, boite(0.4, 1.2, 0.4), FER, dx, 0.6, dz, 0, 0.06);
      put(L, boite(3.2, 2.4, 3.2), c, 0, 2.2, 0, 0, 0.12); put(L, boite(3.3, 0.25, 3.3), LAITON, 0, 3.45, 0, 0, 0);
      put(L, boite(0.3, 0.3, 0.1), LAITON, 0, 2.2, 1.65, 0, 0);
    },
    chef(L, c) {
      const G = 0x8a8a90; put(L, sphere(2.4, 1).scale(1, 0.85, 1.35), G, 0, 4.4, 0, 0, 0.15);
      for (const [dx, dz] of [[-1.1, -1.6], [1.1, -1.6], [-1.1, 1.6], [1.1, 1.6]]) put(L, cyl(0.7, 0.7, 3, 8), G, dx, 1.5, dz, 0, 0.1);
      put(L, sphere(1.4, 1), G, 0, 5.4, 3.2, 0, 0.12); put(L, cyl(0.35, 0.5, 3, 8).rotateX(0.3), G, 0, 3.8, 4.4, 0, 0.08);
      for (const dx of [-0.6, 0.6]) put(L, cone(0.2, 1.6, 6).rotateX(1.7), BLANC, dx, 4.6, 4.2, 0, 0);
      put(L, boite(2.6, 1.6, 2.6), BOIS, 0, 7, -0.3, 0, 0.12); put(L, boite(2.8, 0.3, 2.8), c, 0, 6.3, -0.3, 0, 0);
    },
  },
  poudre: {
    fantassin(L, c) { bonhomme(L, 0, 0, c, { coiffe: 'tricorne', arme: 'fusil' }); },
    rapide(L, c) { cheval(L, 0, 0, 0x3a2a1a); bonhomme(L, 0, -0.2, c, { coiffe: 'tricorne', arme: 'fusil', y: 1.6, ech: 0.9 }); },
    lourd(L, c) { bonhomme(L, 0, 0, c, { coiffe: 'bonnet', arme: 'fusil', ech: 1.3 }); put(L, boite(1.6, 1.2, 1.1), ACIER, 0, 2.4, 0, 0, 0.08); },
    chef(L, c) {
      for (const dx of [-1.6, 1.6]) put(L, roue(1.6), BOIS2, dx, 1.6, -1, 0, 0.1);
      put(L, boite(1.6, 0.8, 5), BOIS, 0, 1.6, -0.6, 0, 0.1); put(L, futZ(0.8, 5.6), 0x3e3a34, 0, 2.6, -0.4, 0, 0.12);
      cheval(L, -0.9, 4.2); cheval(L, 0.9, 4.2, 0x4a3020); put(L, boite(2.4, 0.5, 0.4), c, 0, 2.5, 2.4, 0, 0);
    },
  },
  guerres: {
    fantassin(L, c) { bonhomme(L, 0, 0, c, { coiffe: 'casque', arme: 'fusil' }); },
    rapide(L, c) {
      for (const dz of [-1.3, 1.3]) put(L, roue(0.9), NOIR, 0, 0.9, dz, 0, 0.08);
      put(L, boite(0.7, 0.8, 2.6), c, 0, 1.5, 0, 0, 0.1); put(L, futZ(0.7, 1.8), c, 1.5, 1.2, 0, 0, 0.1); put(L, roue(0.7), NOIR, 1.5, 0.7, 0, 0, 0);
      bonhomme(L, 0, -0.3, c, { coiffe: 'casque', y: 0.9, ech: 0.85 });
    },
    lourd(L, c) {
      put(L, boite(4, 2.2, 6), c, 0, 1.6, 0, 0, 0.15); for (const dx of [-2.1, 2.1]) put(L, boite(0.6, 1.6, 6.4), NOIR, dx, 1, 0, 0, 0.08);
      put(L, cyl(1.4, 1.5, 1.2, 8), c, 0, 3.3, -0.4, 0, 0.12); put(L, futZ(0.25, 3.2), c, 0, 3.4, 2.4, 0, 0.06);
    },
    chef(L, c) {
      put(L, sphere(3, 1).scale(1, 0.8, 2.6), 0xb8b8b0, 0, 3, 0, 0, 0.15); put(L, boite(1.4, 1, 3), c, 0, 0.3, 0.5, 0, 0.1);
      for (const s of [-1, 1]) put(L, boite(0.2, 2.4, 1.8), c, s * 1.4, 3, -7, 0, 0.06);
      put(L, boite(5, 0.2, 1.8), c, 0, 3, -7, 0, 0.06);
    },
  },
  moderne: {
    fantassin(L, c) { bonhomme(L, 0, 0, c, { coiffe: 'casque', arme: 'fusil' }); },
    rapide(L, c) {
      for (const dx of [-1.5, 1.5]) for (const dz of [-1.6, 1.6]) put(L, roue(0.8), NOIR, dx, 0.8, dz, 0, 0.08);
      put(L, boite(3, 1.2, 4.6), c, 0, 1.4, 0, 0, 0.12); put(L, boite(2.6, 0.2, 1.4), 0x8ab0c8, 0, 2.3, 0.8, 0, 0);
      bonhomme(L, -0.6, -0.4, c, { coiffe: 'casque', y: 0.8, ech: 0.7 });
    },
    lourd(L, c) {
      put(L, boite(4.4, 1.6, 6.6), c, 0, 1.4, 0, 0, 0.15); for (const dx of [-2.3, 2.3]) put(L, boite(0.8, 1.4, 6.8), NOIR, dx, 0.8, 0, 0, 0.08);
      put(L, boite(2.8, 1.1, 3), c, 0, 2.7, -0.4, 0, 0.12); put(L, futZ(0.25, 4.6), c, 0, 2.8, 3.2, 0, 0.06);
    },
    chef(L, c) {
      put(L, sphere(1.8, 1).scale(1, 0.9, 1.5), c, 0, 0, 0, 0, 0.12); put(L, futZ(0.45, 5), c, 0, 0.3, -3.6, 0, 0.08);
      put(L, boite(0.2, 1.6, 0.8), c, 0, 1, -6, 0, 0.05); put(L, boite(2.2, 0.3, 1.2), 0x8ab0c8, 0, 0.2, 2.1, 0, 0);
      for (const dx of [-1, 1]) put(L, boite(0.2, 0.2, 3), NOIR, dx, -1.6, 0, 0, 0);
    },
  },
  futur: {
    fantassin(L, c) { bonhomme(L, 0, 0, c, { coiffe: 'robot', arme: 'fusil' }); },
    rapide(L, c) {
      put(L, boite(1.6, 0.6, 1.6), c, 0, 0, 0, Math.PI / 4, 0.08); put(L, sphere(0.4, 1), CYAN, 0, -0.3, 0.6, 0, 0);
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) put(L, boite(0.3, 0.3, 1.8), FER, dx * 0.5, 0, dz * 0.5, Math.atan2(dx, dz), 0);
    },
    lourd(L, c) {
      put(L, boite(4.6, 1.2, 6).scale(1, 1, 1), c, 0, 1.6, 0, 0, 0.15); put(L, boite(4, 0.4, 5.4), CYAN, 0, 0.8, 0, 0, 0);
      put(L, sphere(1.6, 1).scale(1, 0.6, 1), 0xd8dde4, 0, 2.6, -0.4, 0, 0.1); put(L, futZ(0.3, 3.6), 0x4a5260, 0, 2.7, 2, 0, 0.06);
    },
    chef(L, c) {
      for (const dx of [-1.6, 1.6]) { put(L, boite(1.2, 4.6, 1.4), FER, dx, 2.3, 0, 0, 0.12); put(L, boite(1.6, 0.6, 2.4), FER, dx, 0.3, 0.3, 0, 0.08); }
      put(L, boite(5, 3.2, 3.6), c, 0, 6.2, 0, 0, 0.15); put(L, boite(2, 0.5, 0.2), CYAN, 0, 7, 1.85, 0, 0);
      for (const dx of [-3.2, 3.2]) put(L, futZ(0.5, 3.6), 0x4a5260, dx, 5.8, 1.2, 0, 0.08);
    },
  },
};
// les hélices et rotors à faire tourner (coordonnées du modèle, unités de 10) : [x, y, z, rayon]
const HELICES = { 'moderne:chef': [[0, 2, 0, 4.6]], 'futur:rapide': [[-1.3, 0.4, -1.3, 0.9], [1.3, 0.4, -1.3, 0.9], [-1.3, 0.4, 1.3, 0.9], [1.3, 0.4, 1.3, 0.9]], 'guerres:chef': [[0, 3, -7.8, 1.2]] };
const TAILLE = { fantassin: 1.15, rapide: 1, lourd: 1, chef: 1.3 };

/** Un ennemi : { groupe (à l'échelle du plateau, tourné vers +z), corps (ce qui sautille), helices (THREE.Group à faire tourner sur y), vol }.
 *  genre : 'fantassin', 'rapide', 'lourd' ou 'chef' ; couleur : celle de l'époque (ERES). */
export function ennemi(genre, style, couleur = 0xb8322a) {
  const cle = `${style}:${genre}`;
  const p = proto(`ennemi|${cle}|${couleur}`, () => { const L = lot(); ENNEMIS[style][genre](L, couleur); return fige(L); });
  const groupe = new THREE.Group(), corps = p.clone();
  groupe.add(corps);
  const helices = (HELICES[cle] || []).map(([x, y, z, r]) => {
    const h = proto(`helice|${r}`, () => { const L = lot(); put(L, boite(r * 2, 0.15, 0.4), FER, 0, 0, 0, 0, 0); put(L, boite(0.4, 0.15, r * 2), FER, 0, 0, 0, 0, 0); return fige(L); }).clone();
    h.position.set(x, y, z); corps.add(h); return h;
  });
  const vol = VOLANTS.has(cle);
  groupe.scale.setScalar(ECH * 0.95 * TAILLE[genre]);
  return { groupe, corps, helices, vol };
}

// ------------------------------------------------------------------ projectiles
const PROJ = {
  fleche: L => { put(L, futZ(0.08, 2.2, 4), BOIS, 0, 0, 0, 0, 0); put(L, cone(0.2, 0.5, 4).rotateX(Math.PI / 2), FER, 0, 0, 1.2, 0, 0); },
  carreau: L => { put(L, futZ(0.14, 3, 4), BOIS2, 0, 0, 0, 0, 0); put(L, cone(0.3, 0.7, 4).rotateX(Math.PI / 2), FER, 0, 0, 1.7, 0, 0); },
  pierre: L => put(L, sphere(0.9, 0), PIERRE2, 0, 0, 0, 0, 0.1),
  boulet: L => put(L, sphere(0.55, 1), NOIR, 0, 0, 0, 0, 0),
  balle: L => put(L, futZ(0.12, 1.4, 4), 0xffe08a, 0, 0, 0, 0, 0),
  obus: L => { put(L, futZ(0.35, 1.2, 8), LAITON, 0, 0, 0, 0, 0); put(L, cone(0.35, 0.6, 8).rotateX(Math.PI / 2), FER, 0, 0, 0.9, 0, 0); },
  roquette: L => { put(L, futZ(0.3, 2, 8), BLANC, 0, 0, 0, 0, 0); put(L, cone(0.3, 0.7, 8).rotateX(Math.PI / 2), 0xb8322a, 0, 0, 1.35, 0, 0); },
  poix: L => put(L, sphere(0.6, 1), NOIR, 0, 0, 0, 0, 0),
  eau: L => put(L, sphere(0.6, 1).scale(1, 1, 1.6), 0x6ab8ff, 0, 0, 0, 0, 0),
  glace: L => put(L, sphere(0.6, 0).scale(1, 1, 1.8), 0xa8f0ff, 0, 0, 0, 0, 0),
  plasma: L => put(L, sphere(0.8, 1), 0xe040ff, 0, 0, 0, 0, 0),
  laser: L => put(L, futZ(0.15, 3, 4), CYAN, 0, 0, 0, 0, 0),
};
/** Un projectile (tourné vers +z, à l'échelle du plateau) : 'fleche', 'carreau', 'pierre', 'boulet', 'balle', 'obus', 'roquette', 'poix', 'eau', 'glace', 'plasma', 'laser'. */
export function projectile(genre) {
  const g = proto(`proj|${genre}`, () => { const L = lot(); (PROJ[genre] || PROJ.boulet)(L); return fige(L); }).clone();
  g.scale.setScalar(ECH);
  return g;
}

// ------------------------------------------------------------------ effets (animés ici, en temps réel)
const effets = [];
const BOULE = new THREE.IcosahedronGeometry(1, 1), MAT_FEU = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, depthWrite: false });
function effet(o, duree, maj) { maj(0); scene.add(o); effets.push({ o, t: 0, duree, maj }); }
/** Une explosion (boule de feu et fumée) de rayon r (unités du plateau) ; couleur : 0xffb040 par défaut (plasma : 0xe040ff). */
export function explosion(x, y, z, r = 0.4, couleur = 0xffb040) {
  const m = new THREE.Mesh(BOULE, MAT_FEU.clone()); m.material.color.setHex(couleur); m.position.set(x, y, z);
  effet(m, 0.45, u => { m.scale.setScalar(r * (0.3 + u)); m.material.opacity = 1 - u; });
  for (let k = 0; k < 3; k++) bouffee(x + (Math.random() - 0.5) * r, y + 0.05, z + (Math.random() - 0.5) * r, couleur === 0xffb040 ? 'noire' : 'blanche', 0.6 + r);
}
/** Un éclair de départ du coup (bouche d'un canon, d'un fusil). */
export function eclat(x, y, z, couleur = 0xfff1a0) {
  const m = new THREE.Mesh(BOULE, MAT_FEU.clone()); m.material.color.setHex(couleur); m.position.set(x, y, z);
  effet(m, 0.12, u => { m.scale.setScalar(0.06 + u * 0.08); m.material.opacity = 1 - u; });
}
/** Une éclaboussure au sol (poix, eau, glace) : une tache qui s'étale puis s'efface. */
export function eclaboussure(x, y, z, couleur = 0x6ab8ff, r = 0.35) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false }));
  m.position.set(x, y + 0.02, z);
  effet(m, 0.9, u => { m.scale.setScalar(r * Math.min(1, u * 4)); m.material.opacity = 0.7 * (1 - u); });
}
/** Un rayon (laser) entre deux points, qui s'éteint vite. */
export function rayon(a, b, couleur = 0x5ff0ff) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false }));
  m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, l);
  effet(m, 0.15, u => { m.material.opacity = 1 - u; m.scale.x = m.scale.y = 1 + u * 2; });
}
/** La chute d'un ennemi : poussière (ou fumée noire d'un engin). */
export function chute(x, y, z, engin = false) { for (let k = 0; k < (engin ? 4 : 2); k++) bouffee(x + (Math.random() - 0.5) * 0.2, y + 0.05, z + (Math.random() - 0.5) * 0.2, engin ? 'noire' : 'poussiere', engin ? 1 : 0.6); }
chaqueImage(dt => {
  for (let i = effets.length - 1; i >= 0; i--) {
    const e = effets[i]; e.t += dt; const u = Math.min(1, e.t / e.duree); e.maj(u);
    if (u >= 1) { scene.remove(e.o); e.o.geometry !== BOULE && e.o.geometry.dispose(); e.o.material.dispose(); effets.splice(i, 1); }
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
 *  { groupe } ; les bâtiments modernes et antiques sont déjà animés (fumées, fenêtres la nuit) une fois ajoutés à la scène. */
export function batimentVille(ere, coeur, graine = 1, saison = 2) {
  const E = typeof ere === 'string' ? ERES.find(e => e.cle === ere) : ere;
  if (E.style === 'antique') { const m = modele(coeur ? ANT.oppidum : (graine % 2 ? ANT.hutte : ANT.longue), graine); return { groupe: m.groupe, m }; }
  if (E.bat) return { groupe: maillageBatiment({ cle: coeur ? 'citadelle' : graine % 3 ? 'maison' : 'maison_pierre', couleur: '#2f5fa8', epoque: E.bat, saison }).mesh };
  const m = modele(coeur ? QBAT.centre : graine % 3 ? QBAT.residentiel : QBAT.village, graine);
  return { groupe: m.groupe, m };
}
/** Une fois le bâtiment posé et ajouté à la scène : fumées, fenêtres la nuit, rebond de construction (modèles antiques et modernes). */
export function animerVille(b, pop = false) { if (b.m) animer(b.m, { pop }); }

