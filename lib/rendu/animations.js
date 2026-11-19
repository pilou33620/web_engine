// La vie des bâtiments anciens (modeles.js, 1700 → 1816) hors partie : artisans, porteurs, passants, charrettes, bêtes, soldats,
// wagonnets, train… Chaque bâtiment a sa recette ; les gens se placent dans ses espaces libres (les emprises au sol que donne
// maillageBatiment), en unités du modèle, et sont dessinés comme pièces mobiles (piece) que modele() et animer() de modernes.js animent.
//
//   const { mesh, boites } = maillageBatiment({ cle, epoque, couleur });
//   const m = modele(animationsAncien(cle, epoque, boites, couleur), 1);   // posé au même endroit que le bâtiment
import { lot, put, boite, cyl, sphere } from './toon.js';
import { piece, oiseaux } from './modernes.js';
import { homme, cheval, trajet, poule, mouton, chariot, ane, poisson, flamme, pignon, feuDeCamp } from './antiques.js';
import { fantassin, canon, tete, PALIERS } from './modeles.js';
import { fum } from './modernes.js';

const K = .62;  // les gens et les bêtes à l'échelle des portes des bâtiments anciens
const Y = .25;  // le dessus du sol des cases
const BOIS = 0x6e4a2c, FER = 0x3a3a3a, PAILLE = 0xe0c070, PIERRE = 0x9a9488;
// les habits de chaque époque (tunique, cheveux)
const HABITS = {
  ancien: [0x8a3a2a, 0x3a5a8a, 0x6a5a3a, 0xc9a24a, 0x5a7a4a], lumieres: [0x7a4a6a, 0x3a6a8a, 0xb08a5a, 0x8a3a2a, 0x4a6a4a],
  empire: [0x2f4f8a, 0xf2efe6, 0xb8322a, 0x5a4a3a, 0x3a5a3a], industrie: [0x3a3a3a, 0x5a4a3a, 0x2f3f5a, 0x7a6a5a, 0x6a2a2a],
};
const CHEVEUX = [0x4a3322, 0x2f2c2a, 0x8a5a2a, 0xd9b060, 0xd9d4c8];
const PALIER = { ancien: 1, lumieres: 2, empire: 3, industrie: 5 };  // l'uniforme des soldats de l'époque

/** ex dont les pièces sont dessinées à l'échelle k (leur position ne change pas) : les gens d'antiques.js à la taille des bâtiments anciens. */
const petit = (ex, k = K) => ex?.pieces ? { ...ex, pieces: { push: p => ex.pieces.push({ ...p, dessin: P => { const Q = lot(); p.dessin(Q); for (const g of [...Q.g, ...Q.o]) g.scale(k, k, k); P.g.push(...Q.g); P.o.push(...Q.o); } }) } } : ex;

/** Les points libres de la case (pas sous une pièce du bâtiment), espacés d'au moins `ecart`, le devant (+z, face à la caméra) d'abord. */
function placesLibres(boites, ecart = 1.7) {
  const libres = [];
  for (let z = 7; z >= -7; z -= .5) for (let x = -7; x <= 7; x += .5) {
    if (Math.hypot(x, z) > 7.3) continue;
    if (boites.some(([x0, x1, z0, z1, h = 9]) => !((x1 - x0) * (z1 - z0) > 12 && h < 1.4) && x > x0 - .6 && x < x1 + .6 && z > z0 - .6 && z < z1 + .6)) continue;  // une grande pièce basse (clôture, muret, enclos) ne gêne pas
    if (libres.every(([a, b]) => Math.hypot(a - x, b - z) >= ecart)) libres.push([x, z]);
  }
  return libres;
}

// ------------------------------------------------------------------ ce qu'on peut poser : chaque élément prend une ou plusieurs places libres
const E = {
  /** Un artisan qui travaille : son outil (pioche, hache, marteau, houe…) bat la mesure. */
  ouvrier(c, outil = FER, v = 3) {
    const p = c.prendre(); if (!p) return;
    const P2 = petit(c.ex);
    piece(c.L, P2, P => homme(P, 0, 0, { tunique: c.habit(), cheveux: c.cheveux() }), p[0], Y, p[1], 'glisse', 'y', 0, 1);  // immobile, mais à l'échelle
    piece(c.L, P2, P => { put(P, boite(.8, .1, .1), BOIS, .4, 0, 0, 0, .03); put(P, boite(.22, .3, .26), outil, .82, 0, 0, 0, .04); }, p[0], Y + 1.35 * K, p[1], 'oscille', 'z', .6, v, p[0]);
  },
  /** Quelqu'un qui va chercher quelque chose (charge) et le rapporte : un aller-retour entre deux places. */
  porteur(c, charge, couleur = BOIS) {
    const a = c.prendre(), b = c.prendre(); if (!a || !b) return;
    const dessins = { sac: P => put(P, sphere(.42, 1).scale(1, .8, 1), PAILLE, -.05, 2.2, 0, 0, .05), tonneau: P => put(P, cyl(.4, .4, .7, 10), couleur, .45, 1.1, 0, 0, .05),
      caisse: P => put(P, boite(.7, .6, .6), couleur, .45, 1.1, 0, 0, .05), panier: P => put(P, cyl(.32, .25, .45, 8), 0xb08a3e, .4, 1.15, 0, 0, .03),
      seau: P => put(P, cyl(.22, .18, .4, 8), 0x7a6a5a, .4, 1, 0, 0, .03), poisson: P => poisson(P, .45, 1.2, 0, 0), bois: P => put(P, cyl(.15, .15, 1.1, 6).rotateX(Math.PI / 2), couleur, .35, 1.15, 0, 0, .03),
      pierre: P => put(P, boite(.6, .45, .5), PIERRE, .45, 1.1, 0, 0, .04), pain: P => put(P, sphere(.25, 1).scale(1, .55, 1), 0xb87a3a, .4, 1.15, 0, 0, .03),
      ballot: P => put(P, boite(.6, .5, .5), couleur, .45, 1.15, 0, 0, .04), minerai: P => put(P, sphere(.3, 1), couleur, .4, 1.15, 0, 0, .04) };
    trajet(c.L, petit(c.ex), [[a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y, b[1]], [a[0], Y, a[1]], [a[0], Y, a[1]]], 1 / (9 + c.n() * 2), c.n() * .37,
      P => homme(P, 0, 0, { tunique: c.habit(), cheveux: c.cheveux() }), dessins[charge], [0, 0, 1, 1, 0]);
  },
  /** Des passants qui font le tour de quelques places. */
  passants(c, n = 3) {
    const pts = []; for (let i = 0; i < n; i++) { const p = c.prendre(); if (p) pts.push([p[0], Y, p[1]]); }
    if (pts.length < 2) return;
    trajet(c.L, petit(c.ex), pts, 1 / (5 * pts.length), c.n() * .23, P => { homme(P, 0, 0, { tunique: c.habit(), cheveux: c.cheveux() }); homme(P, -.2, .55, { tunique: c.habit(), cheveux: c.cheveux() }); });
  },
  /** Une charrette (ou un carrosse) tirée par un cheval, qui va et vient entre deux places. */
  charrette(c, couleur = 0x8a6a42, carrosse = false) {
    const a = c.prendre(), b = c.prendre(); if (!a || !b) return;
    trajet(c.L, petit(c.ex, K * .8), [[a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y, b[1]], [a[0], Y, a[1]], [a[0], Y, a[1]]], 1 / 16, c.n() * .3,
      carrosse ? P => { put(P, boite(1.8, 1.3, 1.2), couleur, 0, 1.4, 0, 0, .06); put(P, boite(1.9, .15, 1.3), 0xe0b23a, 0, 2.1, 0, 0, 0); for (const z of [-.65, .65]) put(P, cyl(.45, .45, .1, 10).rotateX(Math.PI / 2), BOIS, 0, .45, z, 0, .04); cheval(P, 2.2, 0, 0x2f2c2a); }
        : P => { chariot(P, couleur); });
  },
  /** Des bêtes qui paissent (moutons, vaches, cochons, chevaux), chacune sur sa place. */
  betes(c, genre = 'mouton', n = 3) {
    for (let i = 0; i < n; i++) {
      const p = c.prendre(); if (!p) return;
      if (genre === 'mouton') mouton(c.L, petit(c.ex), p[0], p[1], i * 2);
      else if (genre === 'cheval') piece(c.L, petit(c.ex, K * .8), P => cheval(P, 0, 0, [0x7a5233, 0x2f2c2a, 0xc9b28a][i % 3]), p[0], Y, p[1], 'glisse', 'x', .8, .15, i * 2);
      else if (genre === 'ane') piece(c.L, petit(c.ex), P => ane(P, 0, 0), p[0], Y, p[1], 'glisse', 'x', .5, .2, i * 2);
      else { const col = genre === 'vache' ? 0xf3efe2 : 0xe8a0a0; piece(c.L, petit(c.ex), P => { put(P, boite(1.5, .8, .7), col, 0, .9, 0, 0, .06); put(P, boite(.45, .45, .4), col, .9, 1.1, 0, 0, .04); if (genre === 'vache') put(P, boite(.5, .3, .72), 0x2f2c2a, -.2, 1.05, 0, 0, 0); for (const [dx, dz] of [[-.5, -.2], [-.5, .2], [.5, -.2], [.5, .2]]) put(P, boite(.15, .5, .15), col, dx, .25, dz, 0, 0); }, p[0], Y, p[1], 'glisse', 'x', .5, .18, i * 2); }
    }
  },
  poules(c, n = 3) { for (let i = 0; i < n; i++) { const p = c.prendre(); if (!p) return; poule(c.L, petit(c.ex), p[0], p[1], i * 2); } },
  chien(c) { const p = c.prendre(); if (!p) return; piece(c.L, petit(c.ex), P => { put(P, boite(.8, .4, .3), 0x8a5a2a, 0, .5, 0, 0, .04); put(P, boite(.3, .3, .26), 0x8a5a2a, .5, .7, 0, 0, .03); put(P, boite(.3, .08, .08), 0x8a5a2a, -.5, .6, 0, 0, 0); }, p[0], Y, p[1], 'glisse', 'x', 1.2, .5); },
  /** Des soldats en uniforme de l'époque qui marchent au pas. */
  soldats(c, n = 3) {
    const p = c.prendre(); if (!p) return;
    const P0 = PALIERS[PALIER[c.ep]];
    piece(c.L, petit(c.ex, .45), P => { for (let i = 0; i < n; i++) fantassin(P, P0, -i * 1.1, 0, c.roy); }, p[0], Y, p[1], 'marche', 'x', .7, .25);
  },
  /** Des enfants qui courent en rond. */
  enfants(c, n = 3) {
    const pts = []; for (let i = 0; i < n; i++) { const p = c.prendre(); if (p) pts.push([p[0], Y, p[1]]); }
    if (pts.length < 2) return;
    for (let k = 0; k < 2; k++) trajet(c.L, petit(c.ex, K * .7), pts, 1 / (2.2 * pts.length), k * .5, P => homme(P, 0, 0, { tunique: c.habit(), cheveux: c.cheveux() }));
  },
  /** Un wagonnet de minerai qui va et vient sur ses rails. */
  wagonnet(c, couleur = 0x5a5a5a) {
    const a = c.prendre(), b = c.prendre(); if (!a || !b) return;
    trajet(c.L, petit(c.ex), [[a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y, b[1]], [a[0], Y, a[1]], [a[0], Y, a[1]]], 1 / 10, 0,
      P => { put(P, boite(1.4, .7, 1), 0x6b4a2b, 0, .6, 0, 0, .05); put(P, sphere(.45, 1).scale(1.3, .6, 1), couleur, 0, 1.05, 0, 0, .03); for (const [dx, dz] of [[-.45, -.5], [.45, -.5], [-.45, .5], [.45, .5]]) put(P, cyl(.2, .2, .1, 8).rotateX(Math.PI / 2), FER, dx, .2, dz, 0, 0); homme(P, -1.4, 0, { tunique: c.habit(), cheveux: c.cheveux() }); });
  },
  /** Un petit train (locomotive et deux wagons) qui passe devant la gare. */
  train(c) {
    const p = c.prendre(); if (!p) return;
    piece(c.L, petit(c.ex, .55), P => {
      put(P, cyl(.55, .55, 2.2, 10).rotateZ(Math.PI / 2), 0x2f2c2a, 0, 1.1, 0, 0, .06); put(P, boite(1, 1.4, 1.1), 0x2f2c2a, -1.4, 1.2, 0, 0, .06); put(P, cyl(.2, .28, .8, 8), 0x2f2c2a, .7, 1.9, 0, 0, .04);
      for (const x of [-4, -6.6]) put(P, boite(2.4, 1.2, 1.1), [0x6a2a2a, 0x2f4f6a][x < -5 ? 1 : 0], x, 1.1, 0, 0, .06);
      for (const x of [.6, -.6, -1.6, -3.4, -4.6, -6, -7.2]) for (const z of [-.5, .5]) put(P, cyl(.3, .3, .1, 10).rotateX(Math.PI / 2), FER, x, .35, z, 0, 0);
    }, 0, Y, p[1], 'coule', 'x', 7, .08);
  },
  /** Des oiseaux qui tournent au-dessus du bâtiment. */
  oiseaux(c, h = 6, blancs = false) { oiseaux(c.L, c.ex, 0, 0, h, 2.6, 3, blancs ? 0xf6f6f1 : 0x3a3a3a, .6); },
};

// ------------------------------------------------------------------ la recette de chaque bâtiment
const VILLE = [['passants'], ['passants'], ['poules', 2]];
const RECETTES = {
  cabane: [['ouvrier', FER], ['poules'], ['chien']], maison: [['passants'], ['poules'], ['chien']], maison_pierre: [['passants'], ['ouvrier', BOIS, 2], ['poules', 2]],
  hotel_particulier: [['charrette', 0x2a3a5a, true], ['passants'], ['chien']], immeuble: [['passants'], ['passants'], ['porteur', 'seau']],
  bucheron: [['ouvrier', FER], ['ouvrier', FER], ['porteur', 'bois']], forestier: [['ouvrier', FER], ['porteur', 'bois'], ['oiseaux']],
  carriere: [['ouvrier', PIERRE], ['ouvrier', PIERRE], ['charrette', PIERRE]], ferme: [['betes', 'vache', 2], ['poules'], ['ouvrier', BOIS, 2]],
  champ_patates: [['ouvrier', BOIS, 2], ['ouvrier', BOIS, 2], ['porteur', 'panier']], pecheur: [['porteur', 'poisson'], ['porteur', 'poisson'], ['oiseaux', 5, true]],
  chasseur: [['passants', 2], ['chien'], ['chien'], ['oiseaux']], bergerie: [['betes', 'mouton', 4], ['chien'], ['passants', 2]],
  vignoble: [['porteur', 'panier'], ['porteur', 'panier'], ['ouvrier', BOIS, 2]],
  mine: [['wagonnet'], ['ouvrier', FER], ['porteur', 'minerai', 0x5a5a5a]], mine_fer: [['wagonnet', 0x8a5a4a], ['ouvrier', FER], ['porteur', 'minerai', 0x8a5a4a]],
  mine_charbon: [['wagonnet', 0x2a2a2a], ['ouvrier', FER], ['porteur', 'minerai', 0x2a2a2a]], mine_or: [['wagonnet', 0xe0b23a], ['ouvrier', FER], ['porteur', 'minerai', 0xe0b23a]],
  scierie: [['ouvrier', FER, 5], ['porteur', 'bois', 0xc9a06a], ['charrette', 0xc9a06a]], moulin: [['porteur', 'sac'], ['charrette', PAILLE], ['betes', 'ane', 1]],
  boulangerie: [['porteur', 'pain'], ['passants'], ['porteur', 'sac']], brasserie: [['porteur', 'tonneau', 0x8a5a2a], ['charrette', 0x8a5a2a], ['porteur', 'sac']],
  fonderie: [['porteur', 'minerai', 0x5a5a5a], ['ouvrier', FER, 4], ['charrette', 0x2a2a2a]], haut_fourneau: [['wagonnet', 0x2a2a2a], ['ouvrier', FER, 4], ['porteur', 'minerai', 0x8a5a4a]],
  forge: [['ouvrier', FER, 6], ['ouvrier', FER, 5], ['porteur', 'bois']], armurerie: [['ouvrier', FER, 5], ['porteur', 'caisse', 0x6b4a2b], ['soldats', 2]],
  tisserand: [['ouvrier', BOIS, 4], ['porteur', 'ballot', 0xd9c49a], ['passants', 2]], manufacture: [['porteur', 'caisse', 0x8a6a42], ['porteur', 'ballot', 0xb8322a], ['charrette']],
  filature: [['porteur', 'ballot', 0xf2efe6], ['porteur', 'ballot', 0xf2efe6], ['charrette', 0xf2efe6]], usine: [['porteur', 'caisse', 0x6b4a2b], ['wagonnet', 0x2a2a2a], ['charrette']],
  entrepot: [['porteur', 'caisse', 0x8a6a42], ['porteur', 'tonneau', 0x8a5a2a], ['charrette']], grenier: [['porteur', 'sac'], ['porteur', 'sac'], ['charrette', PAILLE]],
  marche: [['passants'], ['passants'], ['porteur', 'panier'], ['poules', 2]], comptoir: [['porteur', 'caisse', 0x8a6a42], ['charrette'], ['passants', 2]],
  port: [['porteur', 'caisse', 0x8a6a42], ['porteur', 'tonneau', 0x8a5a2a], ['oiseaux', 6, true]], banque: [['passants'], ['charrette', 0x2a3a5a, true], ['soldats', 1]],
  gare: [['train'], ['passants'], ['porteur', 'caisse', 0x6b4a2b]], puits: [['porteur', 'seau'], ['porteur', 'seau'], ['poules', 2]],
  taverne: [['passants'], ['porteur', 'tonneau', 0x8a5a2a], ['chien']], eglise: [['passants'], ['passants'], ['oiseaux', 9]],
  jardin: [['ouvrier', BOIS, 2], ['passants'], ['oiseaux']], ecole: [['enfants', 4], ['passants', 2]], fontaine: [['porteur', 'seau'], ['passants'], ['enfants', 3]],
  statue: [['passants'], ['passants'], ['oiseaux', 5]], academie: [['passants'], ['passants'], ['charrette', 0x2a3a5a, true]], theatre: [['passants'], ['passants'], ['charrette', 0x5a2a3a, true]],
  hopital: [['passants'], ['porteur', 'caisse', 0xf2efe6], ['charrette', 0xf2efe6]], cathedrale: [['passants'], ['passants'], ['oiseaux', 12]],
  palais: [['charrette', 0x2a3a5a, true], ['soldats', 2], ['passants']], caserne: [['soldats', 4], ['soldats', 3], ['porteur', 'caisse', 0x6b4a2b]],
  haras: [['betes', 'cheval', 3], ['passants', 2]], arsenal: [['soldats', 3], ['charrette', 0x6b4a2b], ['porteur', 'caisse', 0x6b4a2b]],
  tour: [['soldats', 2], ['passants', 2]], remparts: [['soldats', 3], ['soldats', 2]], citadelle: [['soldats', 4], ['soldats', 2], ['charrette', 0x6b4a2b]],
  colonie: [['porteur', 'caisse', 0x8a6a42], ['passants'], ['charrette']], hotel: [['passants'], ['passants'], ['charrette', 0x2a3a5a, true], ['soldats', 2]],
};

/** Le dessin (L, ex) des animations d'un bâtiment ancien, pour modele() : rien d'immobile, que des pièces mobiles posées dans ses espaces libres.
 *  boites : ses emprises au sol (maillageBatiment) ; couleur : celle du royaume (uniformes). */
export function animationsAncien(cle, epoque = 'ancien', boites = [], couleur = '#3b6fd1') {
  return (L, ex) => {
    const libres = placesLibres(boites), habits = HABITS[epoque] || HABITS.ancien;
    let h = 0, n = 0;
    const c = { L, ex, ep: epoque, roy: couleur, prendre: () => libres.shift(), habit: () => habits[h++ % habits.length], cheveux: () => CHEVEUX[(h * 3) % CHEVEUX.length], n: () => n++ };
    for (const [quoi, ...args] of RECETTES[cle] || VILLE) E[quoi](c, ...args);
  };
}
export { RECETTES };

// ------------------------------------------------------------------ le bivouac : une armée au repos, hors des rangs (mêmes soldats que maillageArmee)
const PEAU = 0xf0c9a0, BLANC = 0xf2efe6;
/** Un soldat assis par terre, tourné de ry (face à +z avant rotation) ; P0 : son palier (habit, coiffe). */
function assis(L, P0, x, z, ry, roy) {
  const habit = P0.habit === 'capote' ? 0x5a6a86 : roy, pant = P0.pantalon || BLANC, c = Math.cos(ry), sn = Math.sin(ry);
  const at = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
  put(L, boite(0.7, 0.9, 0.45), habit, x, 0.95, z, ry, 0.06);
  for (const dx of [-0.16, 0.16]) { const [a, b] = at(dx, 0.4); put(L, boite(0.24, 0.24, 0.8), pant, a, 0.4, b, ry, 0.04); const [e, f] = at(dx, 0.8); put(L, boite(0.24, 0.5, 0.24), pant, e, 0.25, f, ry, 0.04); }
  put(L, sphere(0.27, 1), PEAU, x, 1.68, z, 0, 0.04); tete(L, P0, x, 1.9, z, roy);
}
/** Un soldat couché qui dort (la poitrine se soulève). */
function endormi(L, ex, P0, x, z, roy) {
  put(L, boite(0.5, 0.3, 1.4), 0x7a6a52, x, 0.3, z, 0, 0.04); put(L, sphere(0.26, 1), PEAU, x, 0.5, z - 0.9, 0, 0.04); tete(L, P0, x + 0.5, 0.25, z - 0.9, roy);
  piece(L, ex, P => put(P, boite(0.7, 0.4, 1.1), P0.habit === 'capote' ? 0x5a6a86 : roy, 0, 0, 0, 0, 0.05), x, 0.55, z + 0.1, 'pulse', 'y', 0.05, 2.2, x);
}
/** Le bivouac d'une armée de web_royaumes au palier donné : tentes, faisceaux de fusils, feu de camp et marmite, joueurs de cartes autour d'un
 *  tambour, dormeurs, sentinelle, chevaux au piquet et canon parqué. Dessin (L, ex) pour modele(), face à +z comme l'armée. */
export function bivouacAncien(palier = 0, couleur = '#3b6fd1') {
  const P0 = PALIERS[Math.max(0, Math.min(5, palier | 0))], roy = couleur;
  return (L, ex) => {
    for (const [x, z] of [[-3.6, -4.4], [-0.8, -4.6], [2.1, -4.2]]) pignon(L, 2.4, 2.8, 1.9, 0xeee6d2, x, 0.25, z);
    for (const [x, z] of [[3.4, -3], [4.8, -1.8]]) for (let k = 0; k < 3; k++) { const a = k * 2.1; put(L, boite(0.09, 2.3, 0.09).rotateZ(0.24), BOIS, x + Math.cos(a) * 0.32, 1.35, z + Math.sin(a) * 0.32, -a, 0); }
    feuDeCamp(L, ex, 0.2, 0.2, 1);
    for (const a of [0, 2.1, 4.2]) put(L, boite(0.07, 1.6, 0.07).rotateZ(0.25), BOIS, 2 + Math.cos(a) * 0.4, 1.05, 1.4 + Math.sin(a) * 0.4, -a, 0);
    put(L, cyl(0.45, 0.35, 0.5, 10), 0x3a3a3a, 2, 1.3, 1.4, 0, 0.04); flamme(L, ex, 2, 0.6, 1.4, 0.5);
    fantassin(L, P0, 3, 1.4, roy);
    piece(L, ex, P => put(P, boite(0.9, 0.07, 0.07), BOIS, -0.45, 0, 0, 0, 0), 2.75, 1.55, 1.4, 'oscille', 'y', 0.5, 2.5);
    put(L, cyl(0.45, 0.45, 0.6, 10), roy, -3, 0.55, 1.8, 0, 0.04); put(L, cyl(0.47, 0.47, 0.06, 10), BLANC, -3, 0.86, 1.8, 0, 0);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.3, x = -3 + Math.sin(a) * 1.2, z = 1.8 + Math.cos(a) * 1.2;
      assis(L, P0, x, z, a + Math.PI, roy);
      piece(L, ex, P => put(P, boite(0.3, 0.4, 0.04), BLANC, 0, 0, 0, 0, 0.02), x - Math.sin(a) * 0.45, 1.25, z - Math.cos(a) * 0.45, 'oscille', 'y', 0.4, 1.5 + k * 0.3, k);
    }
    endormi(L, ex, P0, -5.2, 2.4, roy); endormi(L, ex, P0, -1.2, -1.6, roy);
    piece(L, ex, P => fantassin(P, P0, 0, 0, roy), -0.4, 0, 5.4, 'marche', 'x', 3, 0.15);
    if (P0.cav) for (const [x, k] of [[5, 0], [6.2, 1]]) piece(L, ex, P => cheval(P, 0, 0, [0x6b4226, 0x2f2c2a][k]), x - 1, 0.25, 2.6 + k * 1.4, 'glisse', 'x', 0.4, 0.15, k * 2);
    canon(L, P0, -6.2, 0);
  };
}
