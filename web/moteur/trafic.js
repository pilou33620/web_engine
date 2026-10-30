// Module « trafic » : véhicules d'ambiance qui circulent selon l'année (routes, rails, eau, airs).
// Purement visuel, rien n'est envoyé au serveur ; tout est reconstruit à chaque nouvelle carte.
// Seuls les véhicules à l'écran existent : ils naissent dans la vue et disparaissent quand ils en sortent.
import { ere as ereDe, existe, facteurPopulation } from "./themes/epoque.js";

const P = window.PIXI;
const ACCEL = { sol: 25, rail: 25, eau: 25, air: 12 };  // le temps de l'ambiance défile plus vite que le réel, sinon rien ne bouge
const MAX = { sol: 140, rail: 24, eau: 45, air: 14 };
const VISIBLE = { sol: 80, rail: 160, eau: 400, air: 1e9 };  // mètres par pixel au-delà desquels le milieu n'est plus montré
const ESPACE = { sol: 260, rail: 1600, eau: 450 };
const GROS = { sol: 1.6, rail: 1.6, eau: 1.6, air: 1.2 };  // agrandissement des dessins (px)  // px d'écran entre deux véhicules sur une voie de poids 1
const DENSITE = {
  sol: { celte: 0.8, romaine: 0.9, classique: 0.9, industrielle: 0.9, moderne: 1.2, futur: 1.1 },
  rail: { industrielle: 1, moderne: 1.2, futur: 1.4 },
  eau: { celte: 0.5, romaine: 0.7, classique: 1, industrielle: 1, moderne: 1, futur: 1 },
  air: { celte: 0.25, romaine: 0.25, classique: 0.3, industrielle: 0.6, moderne: 1, futur: 1.4 },
};
// Poids des voies : les grands axes sont plus fréquentés
const VOIES = { autoroute: 2.5, route: 1, voie_romaine: 0.8, chemin: 0.35, voie_ferree: 1, lgv: 1.5, tramway: 1, tram: 1 };
const RAIL = new Set(["voie_ferree", "lgv", "tramway", "tram"]);
const TOUTES = { celte: 1, romaine: 1, classique: 1, industrielle: 1, moderne: 1, futur: 1 };

// --- Dessins vus du dessus, en pixels d'écran, l'avant vers +x ---
const C = (g, x, y, r, c) => g.circle(x, y, r).fill(c);
const R = (g, x, y, w, h, c, r = 0) => (r ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h)).fill(c);
const E = (g, x, y, rx, ry, c) => g.ellipse(x, y, rx, ry).fill(c);
const cheval = (g, x, y, c = 0x7a4a2a) => { E(g, x, y, 2.6, 1, c); E(g, x + 2.5, y, 1.1, 0.6, c); };
const boeuf = (g, x, y) => { E(g, x, y, 2.4, 1.2, 0xc8b490); E(g, x + 2.3, y, 0.9, 0.8, 0xa89470); };
const roues = (g, xs, y, c = 0x222222) => xs.forEach((x) => { R(g, x - 1, -y - 0.6, 2, 1.2, c); R(g, x - 1, y - 0.6, 2, 1.2, c); });
const auto = (g, c, l = 9, w = 4.4, vitre = 0x2a3644) => {
  roues(g, [-l / 2 + 2, l / 2 - 2], w / 2);
  R(g, -l / 2, -w / 2, l, w, c, 1.4);
  R(g, l / 2 - 3.6, -w / 2 + 0.6, 1.4, w - 1.2, vitre);
  R(g, -l / 2 + 0.8, -w / 2 + 0.7, 1, w - 1.4, vitre);
};
const coque = (g, l, w, c, pont) => {
  g.poly([l / 2, 0, l / 4, -w / 2, -l / 2, -w / 2, -l / 2, w / 2, l / 4, w / 2]).fill(c);
  if (pont) g.poly([l / 2 - 1.5, 0, l / 4, -w / 2 + 0.8, -l / 2 + 0.8, -w / 2 + 0.8, -l / 2 + 0.8, w / 2 - 0.8, l / 4, w / 2 - 0.8]).fill(pont);
};
const voile = (g, x, h, c = 0xf2ecdc) => R(g, x - 0.6, -h / 2, 1.4, h, c, 0.6);
const rotors = (g, d, r, c = 0x333333) => [[d, d], [d, -d], [-d, d], [-d, -d]].forEach(([x, y]) => g.circle(x, y, r).stroke({ width: 0.8, color: c }));
const VOITURES = [0xc8302a, 0x2a5aa8, 0xe8e8e8, 0x2a2a2a, 0x9aa4ae, 0x3a7a4a, 0xd8b030, 0x7a2a5a];
const PASTELS = [0xf2f4f2, 0xbfe3dc, 0xd8e8f4, 0xe8eedc];

// m : milieu ; p : poids par ère ; de / a : années ; v : vitesse (km/h) ; voies : styles admis ;
// l : longueur (px) ; wagons ; moteur : phares la nuit ; fumee ; alt : altitude de l'ombre (px) ; local : vole autour des villes
const TYPES = {
  // Routes
  pieton: { m: "sol", p: { celte: 5, romaine: 4, classique: 4, industrielle: 2, moderne: 0.4, futur: 1.2 }, v: 5, l: 3,
    d: (g) => { C(g, 0, 0, 1.7, 0x5a4636); C(g, 0.3, 0, 0.9, 0xd9b08c); } },
  cavalier: { m: "sol", p: { celte: 1.5, romaine: 1.5, classique: 2, industrielle: 1 }, a: 1930, v: 14, l: 7,
    d: (g) => { cheval(g, 0, 0); C(g, -0.4, 0, 1.3, 0x3a4a7a); } },
  troupe: { m: "sol", p: { romaine: 0.7 }, voies: ["voie_romaine", "route"], v: 5, l: 10,
    d: (g) => { for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) { C(g, -i * 2.4, j * 2, 1, 0xa82a22); C(g, -i * 2.4 + 0.2, j * 2, 0.5, 0xc8a050); } } },
  char_boeufs: { m: "sol", p: { celte: 2, romaine: 2, classique: 2, industrielle: 1 }, a: 1920, v: 4, l: 13,
    d: (g) => { boeuf(g, 3.5, -1.3); boeuf(g, 3.5, 1.3); R(g, -6, -0.3, 6, 0.6, 0x5a4028); R(g, -7, -2.6, 6, 5.2, 0x8a6a42); R(g, -6.4, -2, 4.8, 4, 0xc8a860); } },
  chariot: { m: "sol", p: { celte: 2, romaine: 1.5 }, v: 6, l: 13,
    d: (g) => { cheval(g, 3.5, -1.2, 0x6a3a22); cheval(g, 3.5, 1.2, 0x8a5a32); roues(g, [-5.5, -1.5], 2.8); R(g, -7, -2.6, 7, 5.2, 0x9a7a4a); R(g, -6.5, -2.2, 6, 4.4, 0xd8cfb0, 1.5); } },
  charrette: { m: "sol", p: { classique: 3, industrielle: 2.5, moderne: 0.2 }, de: 500, a: 1960, v: 6, l: 10,
    d: (g) => { cheval(g, 2.5, 0); R(g, -2, -0.9, 2.4, 0.4, 0x5a4028); R(g, -2, 0.5, 2.4, 0.4, 0x5a4028); R(g, -6, -2.4, 4.4, 4.8, 0x9a7244); R(g, -4.5, -3, 1.2, 6, 0x333333); } },
  diligence: { m: "sol", p: { classique: 1.2, industrielle: 0.8 }, de: 1700, a: 1870, voies: ["route", "voie_romaine", "autoroute"], v: 12, l: 16,
    d: (g) => { for (const x of [4.5, 1]) { cheval(g, x, -1.2); cheval(g, x, 1.2, 0x5a3420); } R(g, -8, -2.9, 7.5, 5.8, 0x2a3a5a, 1); R(g, -7, -2, 4.5, 4, 0x7a5a3a); } },
  malle_poste: { m: "sol", p: { classique: 0.6, industrielle: 0.5 }, de: 1793, a: 1873, voies: ["route", "autoroute"], v: 16, l: 13,
    d: (g) => { cheval(g, 3, -1.2); cheval(g, 3, 1.2, 0x5a3420); R(g, -6.5, -2.6, 6.5, 5.2, 0xc8a028, 1); R(g, -5.5, -1.5, 3, 3, 0x2a2a2a); } },
  fiacre: { m: "sol", p: { classique: 0.8, industrielle: 1.5 }, de: 1800, a: 1925, v: 12, l: 10,
    d: (g) => { cheval(g, 2.5, 0, 0x2a2018); R(g, -5.5, -2.3, 5, 4.6, 0x1e1e22, 1.2); R(g, -2.4, -2, 1.6, 4, 0x6a6a72); } },
  velo: { m: "sol", p: { industrielle: 1, moderne: 0.6, futur: 2.5 }, de: 1885, v: 16, l: 5,
    d: (g) => { R(g, -2.5, -0.35, 5, 0.7, 0x333333); C(g, -0.3, 0, 1.2, 0x2a6aa8); C(g, 0.1, 0, 0.7, 0xd9b08c); } },
  auto_ancienne: { m: "sol", p: { industrielle: 3, moderne: 1 }, de: 1898, a: 1960, v: 45, l: 9, moteur: true,
    d: (g) => { roues(g, [-2.5, 2.8], 2.4); R(g, 0.5, -1.6, 4, 3.2, 0x1e2a24, 0.8); R(g, -4, -2.1, 4.8, 4.2, 0x2a3a30, 0.8); R(g, -3.4, -1.6, 2.6, 3.2, 0x8a7050); } },
  camion_ancien: { m: "sol", p: { industrielle: 1.2, moderne: 0.5 }, de: 1910, a: 1960, voies: ["route", "autoroute", "voie_romaine"], v: 35, l: 13, moteur: true,
    d: (g) => { roues(g, [-4, 4], 2.7); R(g, 3, -2.2, 3.6, 4.4, 0x3a4a3a, 0.8); R(g, -6.5, -2.6, 9, 5.2, 0x6a5a3a); R(g, -6, -2, 8, 4, 0xa89060); } },
  bus: { m: "sol", p: { industrielle: 0.3, moderne: 0.6 }, de: 1925, a: 2045, voies: ["route", "autoroute"], v: 60, l: 16, moteur: true,
    d: (g) => { R(g, -8, -2.6, 16, 5.2, 0x2f6db5, 1.2); R(g, -7, -1.4, 14, 2.8, 0xe8eef4, 0.8); } },
  tracteur: { m: "sol", p: { industrielle: 0.3, moderne: 0.8, futur: 0.3 }, de: 1925, voies: ["chemin"], v: 20, l: 7, moteur: true,
    d: (g) => { R(g, -3, -3, 2.6, 6, 0x222222, 0.8); R(g, -2.5, -1.6, 6, 3.2, 0x3a8a3a, 0.8); R(g, -2, -1.2, 2, 2.4, 0xd8e8e8); } },
  voiture: { m: "sol", p: { moderne: 8, futur: 1.5 }, de: 1945, a: 2070, v: 80, l: 9, moteur: true, couleurs: VOITURES, d: (g, c) => auto(g, c) },
  camion: { m: "sol", p: { moderne: 2.5, futur: 0.5 }, de: 1945, a: 2060, voies: ["route", "autoroute"], v: 70, l: 17, moteur: true,
    couleurs: [0xc8302a, 0x2a5aa8, 0xe8e8e8, 0x3a7a4a],
    d: (g, c) => { roues(g, [-7, -4, 5], 2.9); R(g, 4, -2.6, 3.8, 5.2, c, 1); R(g, 6.5, -2.1, 1, 4.2, 0x2a3644); R(g, -9, -2.9, 12.6, 5.8, 0xe2e2de); } },
  voiture_elec: { m: "sol", p: { moderne: 0.6, futur: 5 }, de: 2010, v: 80, l: 9, moteur: true, couleurs: PASTELS,
    d: (g, c) => { roues(g, [-2.5, 2.5], 2.2); R(g, -4.5, -2.3, 9, 4.6, c, 2.2); R(g, -2.8, -1.7, 5.6, 3.4, 0x6ab8d0, 1.6); } },
  navette: { m: "sol", p: { futur: 2 }, de: 2035, voies: ["route", "autoroute", "voie_romaine"], v: 60, l: 13, moteur: true,
    d: (g) => { R(g, -6.5, -2.8, 13, 5.6, 0xf4f6f4, 2.8); R(g, -5, -2, 10, 4, 0x58b8a0, 2); R(g, -4, -1, 8, 2, 0xa8e0d4, 1); } },
  camion_auto: { m: "sol", p: { futur: 1.5 }, de: 2040, voies: ["route", "autoroute"], v: 70, l: 15, moteur: true,
    d: (g) => { R(g, -7.5, -2.8, 15, 5.6, 0xe8ecea, 2.4); R(g, -6, -2, 9, 4, 0x2a3a5a); R(g, 4.5, -1.8, 2, 3.6, 0x58b8a0, 1); } },
  // Rails (l : écart entre deux voitures)
  vapeur: { m: "rail", p: { industrielle: 3, moderne: 1 }, de: 1840, a: 1965, voies: ["voie_ferree"], v: 60, l: 11, wagons: 5, moteur: true, fumee: true,
    d: (g) => { R(g, -5, -2, 10, 4, 0x222222, 1); C(g, 3.5, 0, 1.1, 0x080808); R(g, -5.5, -2.3, 3, 4.6, 0x5a1a1a); },
    w: (g) => { R(g, -4.8, -2, 9.6, 4, 0x5a4a32); R(g, -4.3, -1.5, 8.6, 3, 0x7a6448); } },
  diesel: { m: "rail", p: { moderne: 1.5 }, de: 1950, a: 2030, voies: ["voie_ferree"], v: 90, l: 11, wagons: 6, moteur: true,
    d: (g) => { R(g, -5, -2.1, 10, 4.2, 0xb84a2a, 1); R(g, 2.5, -1.6, 2, 3.2, 0x2a3644); },
    w: (g) => { R(g, -4.8, -2, 9.6, 4, 0x4a5a6a); R(g, -4.3, -1.3, 8.6, 2.6, 0x6a7a8a); } },
  electrique: { m: "rail", p: { industrielle: 0.5, moderne: 2, futur: 1 }, de: 1920, voies: ["voie_ferree"], v: 110, l: 11, wagons: 6, moteur: true,
    d: (g) => { R(g, -5, -2.1, 10, 4.2, 0x2a5aa8, 1.2); R(g, -3, -0.3, 5, 0.6, 0xc8c8c8); },
    w: (g) => { R(g, -4.8, -2, 9.6, 4, 0x8a9aa8, 0.8); R(g, -4.3, -0.4, 8.6, 0.8, 0x2a5aa8); } },
  tgv: { m: "rail", p: { moderne: 3, futur: 1 }, de: 1981, voies: ["lgv", "voie_ferree"], v: 260, l: 11, wagons: 8, moteur: true,
    d: (g) => { g.poly([7, 0, 2, -2.1, -5, -2.1, -5, 2.1, 2, 2.1]).fill(0xeceef2); g.poly([6, 0, 2.5, -1.2, 1.5, 0, 2.5, 1.2]).fill(0x2a3644); R(g, -5, -0.5, 6, 1, 0x2a4a9a); },
    w: (g) => { R(g, -5, -2.1, 10, 4.2, 0xeceef2, 0.8); R(g, -5, -0.5, 10, 1, 0x2a4a9a); } },
  train_futur: { m: "rail", p: { futur: 4 }, de: 2040, voies: ["lgv", "voie_ferree"], v: 320, l: 11, wagons: 7, moteur: true,
    d: (g) => { g.poly([8, 0, 1, -2.2, -5, -2.2, -5, 2.2, 1, 2.2]).fill(0xf6f8f6); R(g, -5, -0.4, 9, 0.8, 0x3ab88a); },
    w: (g) => { R(g, -5, -2.2, 10, 4.4, 0xf6f8f6, 2); R(g, -4, -1.2, 8, 2.4, 0x58a8c0, 1); } },
  tram: { m: "rail", p: { industrielle: 1, moderne: 1, futur: 2 }, de: 1880, voies: ["tramway", "tram"], v: 25, l: 10, wagons: 2, moteur: true,
    d: (g) => { R(g, -5, -2, 10, 4, 0x2aa88a, 2); R(g, 2.5, -1.5, 1.6, 3, 0x2a3644); },
    w: (g) => { R(g, -4.8, -2, 9.6, 4, 0x2aa88a, 1.2); R(g, -4, -1, 8, 2, 0xd8f0e8); } },
  // Eau (voies : « fleuve » grande rivière, « riviere » moyenne, « mer » trajets côtiers)
  pirogue: { m: "eau", p: { celte: 3, romaine: 1.5 }, voies: ["fleuve", "riviere", "mer"], v: 6, l: 10,
    d: (g) => { E(g, 0, 0, 5, 1.2, 0x6a4a2a); for (const x of [-2.5, 0, 2.5]) C(g, x, 0, 0.6, 0x3a2a1a); } },
  barque: { m: "eau", p: { celte: 1, romaine: 1.5, classique: 2, industrielle: 1.5, moderne: 0.3 }, voies: ["fleuve", "riviere", "mer"], v: 5, l: 6,
    d: (g) => { coque(g, 6, 2.6, 0x7a5232, 0xa07a50); R(g, -0.4, -1.8, 0.8, 3.6, 0x4a3a2a); } },
  navire_gaulois: { m: "eau", p: { celte: 2 }, voies: ["mer", "fleuve"], v: 10, l: 16,
    d: (g) => { coque(g, 16, 4.6, 0x4a2e18, 0x7a5232); voile(g, 0.5, 8, 0x8a5a3a); } },
  galere: { m: "eau", p: { romaine: 1.5 }, voies: ["mer"], v: 14, l: 22,
    d: (g) => { for (let x = -8; x <= 6; x += 2) g.moveTo(x, -2).lineTo(x - 1, -5).moveTo(x, 2).lineTo(x - 1, 5); g.stroke({ width: 0.5, color: 0x5a4028 });
      coque(g, 22, 4.4, 0x5a3420, 0x9a7044); voile(g, 1, 9, 0xe8dcc0); R(g, 0.5, -4.5, 1, 9, 0xa82a22); } },
  navire_romain: { m: "eau", p: { romaine: 2 }, voies: ["mer", "fleuve"], v: 9, l: 16,
    d: (g) => { coque(g, 16, 6, 0x5a3420, 0x9a7044); voile(g, 1, 11, 0xf0e6cc); } },
  gabare: { m: "eau", p: { classique: 3, industrielle: 1.5 }, de: 500, a: 1930, voies: ["fleuve", "riviere"], v: 7, l: 13,
    d: (g) => { coque(g, 13, 4, 0x5a3c22, 0x8a6a44); g.poly([0, -0.5, -5, -4.5, -4, -0.5]).fill(0xe0d0a8); R(g, -4, -0.8, 3, 1.6, 0xb89868); } },
  trois_mats: { m: "eau", p: { classique: 3, industrielle: 1.5 }, de: 500, a: 1920, voies: ["mer"], v: 14, l: 24,
    d: (g) => { coque(g, 24, 6.4, 0x3a2414, 0x8a6a44); for (const x of [6, 0, -6]) voile(g, x, 12); R(g, 11, -0.3, 4, 0.6, 0x3a2414); } },
  vapeur_bateau: { m: "eau", p: { industrielle: 2.5, moderne: 0.3 }, de: 1830, a: 1960, voies: ["mer", "fleuve"], v: 16, l: 20, moteur: true, fumee: true,
    d: (g) => { coque(g, 20, 5.4, 0x1e1e1e, 0x8a6a4a); R(g, -6, -1.8, 8, 3.6, 0xe8e2d4); C(g, -1, 0, 1.3, 0xb82a22); C(g, -1, 0, 0.6, 0x111111); } },
  peniche: { m: "eau", p: { industrielle: 1.5, moderne: 1.5, futur: 1 }, de: 1850, voies: ["fleuve"], v: 9, l: 20, moteur: true,
    d: (g) => { R(g, -10, -2.2, 20, 4.4, 0x2e3a34, 1.2); R(g, -4, -1.6, 12, 3.2, 0x6a5a3a); R(g, -9.4, -1.6, 4, 3.2, 0xeeeeee); } },
  pecheur: { m: "eau", p: { industrielle: 1, moderne: 1.5, futur: 1 }, de: 1920, voies: ["mer"], v: 14, l: 9, moteur: true,
    d: (g) => { coque(g, 9, 3.4, 0x2a6a9a, 0xe0dcd0); R(g, -2.5, -1, 2.6, 2, 0xffffff); } },
  cargo: { m: "eau", p: { moderne: 2.5, futur: 0.8 }, de: 1945, voies: ["mer"], v: 25, l: 30, moteur: true,
    d: (g) => { coque(g, 30, 6.4, 0x9a2a2a, 0x3a3a40); const cs = [0xc84a2a, 0x2a6aa8, 0x3a8a4a, 0xd8b030, 0x8a8a8a];
      for (let i = 0; i < 6; i++) for (const y of [-1.4, 1.4]) R(g, -8 + i * 3.4, y - 1.2, 3, 2.4, cs[(i * 2 + (y > 0)) % 5]); R(g, -13, -2.4, 3.6, 4.8, 0xf2f2f2); } },
  ferry: { m: "eau", p: { moderne: 1, futur: 1 }, de: 1960, voies: ["mer"], v: 30, l: 24, moteur: true,
    d: (g) => { coque(g, 24, 6.4, 0xf4f4f4, 0x2a5aa8); R(g, -9, -2.2, 14, 4.4, 0xf4f4f4, 1.5); C(g, -6, 0, 1, 0xb82a22); } },
  plaisance: { m: "eau", p: { moderne: 2.5, futur: 2 }, de: 1950, voies: ["mer", "fleuve"], v: 12, l: 8,
    d: (g) => { coque(g, 8, 2.8, 0xf8f8f8, 0xc8b898); g.poly([2.5, -0.2, -3, -3.4, -3, -0.2]).fill(0xffffff); } },
  vedette_elec: { m: "eau", p: { futur: 2 }, de: 2030, voies: ["fleuve", "riviere"], v: 14, l: 10, moteur: true,
    d: (g) => { coque(g, 10, 3.6, 0xf4f6f4, 0x58b8a0); R(g, -3, -1.1, 4.5, 2.2, 0x2a3a5a); } },
  navire_futur: { m: "eau", p: { futur: 3 }, de: 2035, voies: ["mer"], v: 28, l: 26, moteur: true,
    d: (g) => { R(g, -12, -3.6, 24, 1.8, 0xf2f4f2, 0.9); R(g, -12, 1.8, 24, 1.8, 0xf2f4f2, 0.9); R(g, -9, -2, 16, 4, 0x2a3a5a);
      for (const x of [6, -1, -8]) R(g, x - 0.6, -4.5, 1.6, 9, 0x8aa8b8, 0.6); } },
  // Airs
  oiseaux: { m: "air", p: { celte: 1, romaine: 1, classique: 1, industrielle: 0.8, moderne: 0.4, futur: 0.6 }, v: 40, alt: 8, local: true,
    d: (g) => { for (const [x, y] of [[3, 0], [0, -2.5], [0, 2.5], [-3, -5], [-3, 5]]) g.moveTo(x - 1.2, y - 1.4).lineTo(x, y).lineTo(x - 1.2, y + 1.4); g.stroke({ width: 0.9, color: 0x2a2a2a }); } },
  montgolfiere: { m: "air", p: { classique: 0.8, industrielle: 0.6 }, de: 1783, a: 1910, v: 15, alt: 22, local: true, vent: true,
    d: (g) => { C(g, 0, 0, 6, 0xc8302a); for (const a of [0, 1, 2, 3]) g.moveTo(0, 0).arc(0, 0, 6, a * 1.57, a * 1.57 + 0.6).fill(0xe8c030); C(g, 0, 0, 1, 0x6a4a2a); } },
  dirigeable: { m: "air", p: { industrielle: 1 }, de: 1900, a: 1937, v: 90, alt: 28,
    d: (g) => { g.poly([-12, 0, -15, -3.5, -13, 0, -15, 3.5]).fill(0x8a8a82); E(g, 0, 0, 14, 3.6, 0xbab8ae); R(g, -2, -0.8, 4, 1.6, 0x5a5a52); } },
  avion_helice: { m: "air", p: { industrielle: 2, moderne: 1 }, de: 1912, a: 1975, v: 300, alt: 30,
    d: (g) => { R(g, -1.5, -8, 3.4, 16, 0xc0c0b8, 1); R(g, -7, -3, 2, 6, 0xc0c0b8, 0.8); E(g, 0, 0, 7, 1.4, 0xa8a8a0); R(g, 6.6, -2.5, 0.5, 5, 0x333333); } },
  avion_ligne: { m: "air", p: { moderne: 4, futur: 2 }, de: 1955, v: 800, alt: 40,
    d: (g) => { g.poly([3, 0, -4, -12, -6, -12, -2, 0, -6, 12, -4, 12]).fill(0xd8dce0); g.poly([-10, 0, -13, -4.5, -14, -4.5, -12.5, 0, -14, 4.5, -13, 4.5]).fill(0xd8dce0);
      E(g, -1, 0, 13, 1.8, 0xf6f6f6); R(g, -13, -0.4, 2.5, 0.8, 0x2a4a9a); } },
  helicoptere: { m: "air", p: { moderne: 0.8, futur: 0.6 }, de: 1950, v: 200, alt: 14, local: true,
    d: (g) => { R(g, -9, -0.5, 7, 1, 0x3a3a3a); E(g, 0, 0, 3.5, 2, 0xd8302a); g.circle(0, 0, 7).stroke({ width: 0.6, color: 0x222222, alpha: 0.6 }); } },
  drone: { m: "air", p: { moderne: 0.5, futur: 4 }, de: 2015, v: 60, alt: 6, local: true,
    d: (g) => { g.moveTo(-2.4, -2.4).lineTo(2.4, 2.4).moveTo(-2.4, 2.4).lineTo(2.4, -2.4).stroke({ width: 0.8, color: 0x333333 }); rotors(g, 2.4, 1.4); C(g, 0, 0, 1.1, 0xe8e8e8); } },
  taxi_volant: { m: "air", p: { futur: 3 }, de: 2035, v: 150, alt: 14, local: true,
    d: (g) => { rotors(g, 4.5, 2.6, 0x58b8a0); R(g, -4, -2, 8, 4, 0xf4f6f4, 2); R(g, 0, -1.4, 3, 2.8, 0x2a3a5a, 1); } },
  dirigeable_cargo: { m: "air", p: { futur: 0.8 }, de: 2045, v: 100, alt: 30,
    d: (g) => { E(g, 0, 0, 15, 4.4, 0xf2f4f2); for (let x = -8; x <= 6; x += 3.5) R(g, x, -2.6, 3, 5.2, 0x2a3a6a); } },
};
for (const [nom, t] of Object.entries(TYPES)) t.nom = nom;

const poidsType = (t, annee, ere) => {
  const p = (t.p[ere] ?? 0) * Math.min(1, (annee - (t.de ?? -1e9) + 5) / 25, ((t.a ?? 1e9) - annee + 5) / 25);
  return p > 0 ? p : 0;
};
const tirer = (liste, poids) => {
  let r = Math.random() * poids.reduce((a, b) => a + b, 0);
  for (let i = 0; i < liste.length; i++) if ((r -= poids[i]) < 0) return liste[i];
  return liste.at(-1);
};
const cle = ([x, y]) => `${Math.round(x)}|${Math.round(y)}`;

function trajet(pts, style, poids) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { pts, cum, len: cum.at(-1), style, poids, boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], debut: cle(pts[0]), fin: cle(pts.at(-1)) };
}

// Point à la distance s le long d'un trajet ; i : segment de départ de la recherche
function lieu(tr, s, i = 0) {
  const c = tr.cum, n = c.length - 1;
  s = Math.max(0, Math.min(tr.len, s));
  i = Math.min(i, n - 1);
  while (i < n - 1 && s > c[i + 1]) i++;
  while (i > 0 && s < c[i]) i--;
  const [x1, y1] = tr.pts[i], [x2, y2] = tr.pts[i + 1], k = (s - c[i]) / (c[i + 1] - c[i] || 1);
  return { x: x1 + (x2 - x1) * k, y: y1 + (y2 - y1) * k, a: Math.atan2(y2 - y1, x2 - x1), i };
}

// Trajets en mer entre les ports, calculés sur la grille d'occupation (lettre « . » = eau), loin des côtes
function trajetsMer(carte, villes) {
  const occ = carte.occupation;
  if (!occ?.lignes?.length) return [];
  const g = occ.lignes, pas = occ.pas, H = g.length, L = g[0].length, N = L * H;
  const eau = (i) => g[(i / L) | 0][i % L] === ".";
  // Plus grande étendue d'eau d'un seul tenant : la mer
  const zone = new Int32Array(N).fill(-1), tailles = [];
  const voisins4 = (i) => [i % L ? i - 1 : -1, i % L < L - 1 ? i + 1 : -1, i - L, i + L].filter((j) => j >= 0 && j < N);
  for (let i = 0; i < N; i++) {
    if (zone[i] >= 0 || !eau(i)) continue;
    const z = tailles.length, file = [i];
    zone[i] = z;
    for (let k = 0; k < file.length; k++) for (const j of voisins4(file[k])) if (zone[j] < 0 && eau(j)) { zone[j] = z; file.push(j); }
    tailles.push(file.length);
  }
  if (!tailles.length) return [];
  const mer = tailles.indexOf(Math.max(...tailles)), enMer = (i) => zone[i] === mer;
  // Distance à la terre (en cases), pour naviguer au large
  const dist = new Int32Array(N).fill(-1), file = [];
  for (let i = 0; i < N; i++) if (!enMer(i)) { dist[i] = 0; file.push(i); }
  for (let k = 0; k < file.length; k++) for (const j of voisins4(file[k])) if (dist[j] < 0) { dist[j] = dist[file[k]] + 1; file.push(j); }
  const libre = (i) => enMer(i) && dist[i] >= 2;
  const voisins8 = (i) => {
    const x = i % L, r = [];
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      const j = i + dy * L + dx;
      if ((dx || dy) && x + dx >= 0 && x + dx < L && j >= 0 && j < N && libre(j)) r.push(j);
    }
    return r;
  };
  // Ports : grandes villes au bord de la mer, avec la case libre la plus proche comme quai
  const ports = [];
  for (const v of [...villes].sort((a, b) => b.population - a.population)) {
    const cx = Math.floor(v.x / pas), cy = Math.floor(v.y / pas);
    if (cx < 0 || cy < 0 || cx >= L || cy >= H) continue;
    let pres = false;
    for (let dy = -3; dy <= 3 && !pres; dy++) for (let dx = -3; dx <= 3; dx++) { const i = (cy + dy) * L + cx + dx; if (i >= 0 && i < N && enMer(i)) { pres = true; break; } }
    if (!pres) continue;
    let quai = -1;
    const vu = new Set([cy * L + cx]), f = [cy * L + cx];
    for (let k = 0; k < f.length && k < 4000 && quai < 0; k++) for (const j of voisins4(f[k])) {
      if (vu.has(j)) continue;
      if (libre(j)) { quai = j; break; }
      vu.add(j); f.push(j);
    }
    if (quai < 0 || ports.some((p) => Math.hypot((p % L) - (quai % L), ((p / L) | 0) - ((quai / L) | 0)) < 15)) continue;
    ports.push(quai);
    if (ports.length >= 12) break;
  }
  const centre = (i) => [((i % L) + 0.5) * pas, (((i / L) | 0) + 0.5) * pas];
  const lisser = (pts) => {
    for (let n = 0; n < 2; n++) pts = [pts[0], ...pts.slice(0, -1).flatMap((p, k) => { const q = pts[k + 1];
      return [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]]; }), pts.at(-1)];
    return pts;
  };
  const trajets = [], faits = new Set();
  for (const depart of ports) {
    const parent = new Map([[depart, -1]]), f = [depart], buts = [];
    let large = -1;
    for (let k = 0; k < f.length; k++) {
      const i = f[k];
      if (i !== depart && ports.includes(i) && buts.length < 2) buts.push(i);
      if (large < 0 && dist[i] >= 15) large = i;
      for (const j of voisins8(i)) if (!parent.has(j)) { parent.set(j, i); f.push(j); }
    }
    if (large >= 0) buts.push(large);
    for (const b of buts) {
      const id = [depart, b].sort().join();
      if (faits.has(id)) continue;
      faits.add(id);
      const chemin = [];
      for (let i = b; i >= 0; i = parent.get(i)) chemin.push(i);
      // Chaque point remonte vers le large : les navires passent au milieu des estuaires, pas contre la rive
      const pts = chemin.filter((_, k) => k % 3 === 0 || k === chemin.length - 1).map((i) => {
        for (let n = 0; n < 4 && dist[i] < 8; n++) { const j = voisins8(i).reduce((m, j) => (dist[j] > dist[m] ? j : m), i); if (j === i) break; i = j; }
        return centre(i);
      });
      if (pts.length >= 3) trajets.push(trajet(lisser(pts.reverse()), "mer", 1));
    }
  }
  return trajets;
}

export function installer(ctx) {
  const { rendu, $ } = ctx, m = rendu.monde;
  // Au sol : au-dessus des routes et réseaux, sous les ombres des nuages et les bâtiments ; dans les airs : sous les étiquettes
  const sol = m.addChildAt(new P.Container(), m.getChildIndex(rendu.climat.ombres ?? rendu.calques.batiments));
  const ciel = m.addChildAt(new P.Container(), m.getChildIndex(rendu.calques.etiquettes));
  const ombres = ciel.addChild(new P.Container()), avions = ciel.addChild(new P.Container());
  // Phares : au-dessus de l'obscurité de la nuit (comme l'éclairage des villes), suivent la caméra du monde
  const phares = new P.Graphics();
  phares.blendMode = "add";
  const st = rendu.app.stage;
  st.addChildAt(phares, st.children.includes(rendu.climat.lumieres) ? st.getChildIndex(rendu.climat.lumieres) + 1 : st.children.length);

  let actif = true;
  try { actif = localStorage.getItem("trafic") !== "non"; } catch { /* stockage indisponible */ }
  const section = $("menu-extensions").appendChild(document.createElement("section"));
  section.innerHTML = '<h3>Trafic</h3><div class="calques"><label><input type="checkbox" id="trafic-vehicules">Véhicules</label></div>';
  const caseVehicules = section.querySelector("input");
  caseVehicules.checked = actif;
  caseVehicules.onchange = () => {
    actif = caseVehicules.checked;
    try { localStorage.setItem("trafic", actif ? "oui" : "non"); } catch { /* stockage indisponible */ }
    if (!actif) vider();
  };

  let trajets = { sol: [], rail: [], eau: [] }, graphes = {}, villes = [], annee = 1790, ere = "classique", echelle = 1, diag = 1;
  let vehicules = [], choix = {}, derniere = 0, premier = true;
  const contextes = new Map();  // dessin partagé par type et couleur
  const dessin = (t, c, wagon) => {
    const k = `${t.nom}|${c}|${wagon ?? ""}`;
    if (!contextes.has(k)) { const g = new P.GraphicsContext(); (wagon ? t.w : t.d)(g, c); contextes.set(k, g); }
    return contextes.get(k);
  };

  function vider() {
    for (const v of vehicules) for (const o of [...v.pieces, v.ombre]) o?.destroy();
    vehicules = [];
    phares.clear();
  }

  // Types admis sur une voie, pondérés selon l'année (mis en cache par style)
  function typesPour(milieu, style) {
    const k = `${milieu}|${style}`;
    if (!choix[k]) {
      const ts = Object.values(TYPES).filter((t) => t.m === milieu && (!t.voies || t.voies.includes(style)) && (style !== "autoroute" || t.moteur) && poidsType(t, annee, ere) > 0);
      choix[k] = [ts, ts.map((t) => poidsType(t, annee, ere))];
    }
    return choix[k];
  }

  ctx.surCarte((carte) => {
    vider();
    annee = carte.annee ?? 1790;
    ere = ereDe(annee);
    echelle = carte.echelle ?? 1;
    diag = Math.hypot(...carte.taille);
    choix = {};
    premier = true;
    const ents = carte.entites.filter((e) => existe(e, annee));
    const f = facteurPopulation(annee);
    villes = ents.filter((e) => e.type === "batiment" && e.population > 0).map((e) => ({ x: e.x, y: e.y, population: e.population * f }));
    // Fréquentation d'une voie : plus forte près des grandes villes
    const affluence = ([x, y]) => {
      let p = 0;
      for (const v of villes) if (Math.abs(v.x - x) < 20 && Math.abs(v.y - y) < 20 && v.population > p) p = v.population;
      return 1 + Math.min(2.5, Math.sqrt(p / 20000));
    };
    trajets = { sol: [], rail: [], eau: [] };
    for (const e of ents) {
      if (e.type !== "ligne" || !(e.points?.length >= 2)) continue;
      if (e.style === "riviere") {
        if ((e.largeur ?? 0) >= 1.5) trajets.eau.push(trajet(e.points, (e.rang ?? 1) <= 1 ? "fleuve" : "riviere", 1));
      } else if (VOIES[e.style]) {
        const tr = trajet(e.points, e.style, VOIES[e.style]);
        if (!RAIL.has(e.style)) tr.poids *= Math.max(affluence(e.points[0]), affluence(e.points.at(-1)));
        trajets[RAIL.has(e.style) ? "rail" : "sol"].push(tr);
      }
    }
    trajets.eau.push(...trajetsMer(carte, villes));
    // Carrefours : extrémités communes des voies d'un même milieu
    graphes = {};
    for (const [milieu, liste] of Object.entries(trajets)) {
      const gr = (graphes[milieu] = new Map());
      for (const tr of liste) for (const [k, debut] of [[tr.debut, true], [tr.fin, false]]) (gr.get(k) ?? gr.set(k, []).get(k)).push({ tr, debut });
    }
  });

  function creer(t, milieu, tr, s, sens) {
    const c = t.couleurs ? t.couleurs[(Math.random() * t.couleurs.length) | 0] : 0;
    const parent = milieu === "air" ? avions : sol;
    const pieces = [parent.addChild(new P.Graphics(dessin(t, c)))];
    for (let k = 0; k < (t.wagons ?? 0); k++) pieces.push(parent.addChild(new P.Graphics(dessin(t, c, true))));
    let ombre = null;
    if (t.alt) { ombre = ombres.addChild(new P.Graphics(dessin(t, c))); ombre.tint = 0x000000; }
    const v = { t, milieu, tr, s, sens, i: 0, age: 0, pieces, ombre, trace: [], fumee: 0,
      vitesse: Math.min((t.v * ACCEL[milieu] * (0.8 + 0.4 * Math.random())) / 3.6 / echelle, diag / 30) };
    const p = lieu(tr, s);
    Object.assign(v, { x: p.x, y: p.y, a: p.a + (sens < 0 ? Math.PI : 0), i: p.i });
    vehicules.push(v);
    return v;
  }

  // Un aéronef pas encore entré dans la vue y passera-t-il ? (reste du trajet rectiligne près du centre de la vue)
  const vise = (v, cx, cy, r) => {
    const [x2, y2] = v.tr.pts.at(-1), dx = x2 - v.x, dy = y2 - v.y;
    const k = Math.max(0, Math.min(1, ((cx - v.x) * dx + (cy - v.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(v.x + k * dx - cx, v.y + k * dy - cy) < r;
  };
  const enVue = (x, y, a, b, marge) => x > a.x - marge && x < b.x + marge && y > a.y - marge && y < b.y + marge;

  // Fait naître des véhicules dans la vue jusqu'à la densité voulue
  function semer(milieu, a, b, z, compte) {
    const cand = [], poids = [];
    let total = 0;
    for (const tr of trajets[milieu]) {
      const [x0, y0, x1, y1] = tr.boite;
      if (x1 < a.x || x0 > b.x || y1 < a.y || y0 > b.y) continue;
      const dedans = tr.pts.reduce((n, [x, y]) => n + enVue(x, y, a, b, 0), 0) / tr.pts.length;
      if (!dedans) continue;
      cand.push(tr); poids.push(tr.poids * tr.len * dedans);
      total += tr.poids * tr.len * dedans;
    }
    const cible = Math.min(MAX[milieu], Math.round((total * z * (DENSITE[milieu][ere] ?? 0)) / ESPACE[milieu]));
    for (let n = compte, essais = 60; n < cible && essais-- > 0;) {
      const tr = tirer(cand, poids), s = Math.random() * tr.len, p = lieu(tr, s);
      if (!enVue(p.x, p.y, a, b, 0)) continue;
      const [ts, ps] = typesPour(milieu, tr.style);
      if (!ts.length) continue;
      creer(tirer(ts, ps), milieu, tr, s, Math.random() < 0.5 ? 1 : -1);
      n++;
    }
  }

  function semerAir(a, b, compte) {
    const km2 = ((b.x - a.x) * (b.y - a.y) * echelle * echelle) / 1e6;
    const cible = Math.min(MAX.air, Math.ceil((Math.min(km2, 60000) / 5000) * (DENSITE.air[ere] ?? 0)));
    const [ts, ps] = typesPour("air", "ciel"), km = 1000 / echelle;
    const dansVue = () => [a.x + Math.random() * (b.x - a.x), a.y + Math.random() * (b.y - a.y)];
    const proches = villes.filter((v) => enVue(v.x, v.y, a, b, 0));
    for (let n = compte; n < cible && ts.length; n++) {
      const t = tirer(ts, ps);
      let ang = Math.random() * 2 * Math.PI, pts, s;
      if (t.vent && rendu.climat.etat) ang = ((rendu.climat.zoneDe(a.x, a.y).direction + 90) * Math.PI) / 180;  // vers où souffle le vent
      if (t.local) {
        const v = proches.length ? tirer(proches, proches.map((c) => c.population)) : null;
        const [x, y] = v ? [v.x + (Math.random() - 0.5) * 4 * km, v.y + (Math.random() - 0.5) * 4 * km] : dansVue();
        const d = (3 + Math.random() * 9) * km;
        pts = [[x, y], [x + Math.cos(ang) * d, y + Math.sin(ang) * d]];
        s = premier ? Math.random() * d : 0;
      } else {
        const [x, y] = dansVue(), d = Math.hypot(b.x - a.x, b.y - a.y) * 1.05 + 60 / rendu.zoom;
        pts = [[x - Math.cos(ang) * d, y - Math.sin(ang) * d], [x + Math.cos(ang) * d, y + Math.sin(ang) * d]];
        s = premier ? d * (0.6 + Math.random() * 0.8) : 0;
      }
      creer(t, "air", trajet(pts, "ciel", 1), s, 1);
    }
  }

  // Fin de voie : continue sur une voie voisine (de préférence un grand axe), sinon fait demi-tour
  function auBout(v, reste) {
    const k = v.sens > 0 ? v.tr.fin : v.tr.debut;
    const suites = (graphes[v.milieu]?.get(k) ?? []).filter((c) => c.tr !== v.tr && (!v.t.voies || v.t.voies.includes(c.tr.style)));
    if (!suites.length) { v.sens = -v.sens; v.s = v.sens > 0 ? reste : v.tr.len - reste; return; }
    const c = tirer(suites, suites.map((c) => c.tr.poids));
    v.tr = c.tr; v.sens = c.debut ? 1 : -1; v.s = c.debut ? reste : c.tr.len - reste; v.i = c.debut ? 0 : c.tr.cum.length - 2;
  }

  rendu.app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    sol.visible = ciel.visible = phares.visible = actif;
    if (!actif || document.hidden || !rendu.carte) return;
    const z = rendu.zoom, { width: w, height: h } = rendu.app.screen;
    const a = rendu.versMonde(0, 0), b = rendu.versMonde(w, h), mpp = echelle / z;
    // Gestion : retire ce qui est sorti de la vue, fait naître ce qui manque (2 fois par seconde)
    if (performance.now() - derniere > 500 || premier) {
      derniere = performance.now();
      const marge = 200 / z;
      vehicules = vehicules.filter((v) => {
        const garder = VISIBLE[v.milieu] > mpp && (v.milieu === "air"
          ? v.s < v.tr.len && (v.vu ? enVue(v.x, v.y, a, b, marge) : vise(v, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) / 2 + marge))
          : enVue(v.x, v.y, a, b, marge));
        if (!garder) for (const o of [...v.pieces, v.ombre]) o?.destroy();
        return garder;
      });
      const compte = { sol: 0, rail: 0, eau: 0, air: 0 };
      for (const v of vehicules) compte[v.milieu]++;
      for (const milieu of ["sol", "rail", "eau"]) if (VISIBLE[milieu] > mpp) semer(milieu, a, b, z, compte[milieu]);
      semerAir(a, b, compte.air);
      premier = false;
    }
    // Nuit : phares des véhicules à moteur (pas de nuit au tour par tour)
    const e = ctx.etat, elev = e?.horloge?.mode === "tour" ? 45 : e?.climat?.soleil?.elevation ?? 45;
    const nuit = Math.max(0, Math.min(1, (2 - elev) / 10)), clign = Math.sin(performance.now() / 180) > 0.6;
    phares.clear();
    phares.position.copyFrom(m.position);
    phares.scale.copyFrom(m.scale);
    for (const v of vehicules) {
      const { t } = v, u = GROS[v.milieu] / z;
      v.age += dt;
      v.s += v.sens * v.vitesse * dt;
      if (v.milieu !== "air") {
        if (v.s > v.tr.len) auBout(v, v.s - v.tr.len);
        else if (v.s < 0) auBout(v, -v.s);
      }
      const p = lieu(v.tr, v.s, v.i), cible = p.a + (v.sens < 0 ? Math.PI : 0);
      v.i = p.i;
      v.a += (((cible - v.a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * Math.min(1, dt * 8);  // virage en douceur
      // Au sol et sur l'eau, on tient sa droite
      const cote = v.milieu === "air" ? 0 : (v.milieu === "rail" ? 0 : 2.6) * u, nx = -Math.sin(cible), ny = Math.cos(cible);
      v.x = p.x + nx * cote; v.y = p.y + ny * cote;
      if (enVue(v.x, v.y, a, b, 0)) v.vu = true;
      const fondu = v.milieu === "air" && t.local ? Math.min(1, v.s / (0.1 * v.tr.len), (v.tr.len - v.s) / (0.1 * v.tr.len)) : 1;
      const alpha = Math.min(1, v.age / 0.6, fondu);
      const tete = v.pieces[0];
      tete.position.set(v.x, v.y); tete.rotation = v.a; tete.scale.set(u); tete.alpha = alpha;
      // Wagons : suivent la trace laissée par la tête
      if (v.pieces.length > 1) {
        const ecart = t.l * u, tr = v.trace;
        if (!tr.length) for (let k = v.pieces.length * 2; k >= 0; k--) { const q = lieu(v.tr, v.s - v.sens * k * ecart * 0.5); tr.push([q.x, q.y]); }
        tr.push([v.x, v.y]);
        let k = 1, d = 0;
        for (let j = tr.length - 1; j > 0 && k < v.pieces.length; j--) {
          const [x1, y1] = tr[j], [x0, y0] = tr[j - 1], l = Math.hypot(x1 - x0, y1 - y0);
          while (k < v.pieces.length && d + l >= k * ecart) {
            const f = (k * ecart - d) / (l || 1), o = v.pieces[k];
            o.position.set(x1 + (x0 - x1) * f, y1 + (y0 - y1) * f); o.rotation = Math.atan2(y1 - y0, x1 - x0); o.scale.set(u); o.alpha = alpha;
            k++;
          }
          d += l;
          if (k >= v.pieces.length && j > 1) { tr.splice(0, j - 1); break; }
        }
        for (; k < v.pieces.length; k++) { v.pieces[k].position.copyFrom(v.pieces[k - 1].position); v.pieces[k].alpha = 0; }
      }
      if (v.ombre) {
        v.ombre.position.set(v.x + t.alt * 0.7 * u, v.y + t.alt * u); v.ombre.rotation = v.a; v.ombre.scale.set(u); v.ombre.alpha = 0.22 * alpha;
      }
      const visible = enVue(v.x, v.y, a, b, 40 * u);
      // Panache de fumée des machines à vapeur
      if (t.fumee && visible && (v.fumee -= dt) <= 0) {
        v.fumee = 0.18;
        const ax = Math.cos(v.a), ay = Math.sin(v.a), avance = v.milieu === "rail" ? 3.5 : -1;
        rendu.effets.particule({ x: v.x + ax * avance * u, y: v.y + ay * avance * u, vx: (-ax * 4 + (Math.random() - 0.5) * 6) * u, vy: (-ay * 4 - 5) * u,
          duree: 2.4, rayon: 1.5 * u, croissance: 6 * u, couleur: 0xe4e2de, alpha: 0.55 });
      }
      if (nuit > 0.05 && visible) {
        const ax = Math.cos(v.a), ay = Math.sin(v.a), px = -ay, py = ax, l = (t.l ?? 8) / 2;
        if (v.milieu === "air") {
          if (clign && t.alt >= 14) phares.circle(v.x - ax * 4 * u, v.y - ay * 4 * u, 1.6 * u).fill({ color: 0xff4040, alpha: nuit });
        } else if (v.milieu === "eau") phares.circle(v.x + ax * l * 0.6 * u, v.y + ay * l * 0.6 * u, 1.3 * u).fill({ color: 0xfff2c8, alpha: nuit });
        else if (t.moteur) {
          const fx = v.x + ax * l * u, fy = v.y + ay * l * u, L = 14 * u;
          phares.poly([fx + px * 1.4 * u, fy + py * 1.4 * u, fx + (ax * L + px * 4 * u), fy + (ay * L + py * 4 * u),
            fx + (ax * L - px * 4 * u), fy + (ay * L - py * 4 * u), fx - px * 1.4 * u, fy - py * 1.4 * u]).fill({ color: 0xffe6a8, alpha: 0.35 * nuit });
          if (v.milieu === "sol") phares.circle(v.x - ax * l * u, v.y - ay * l * u, 1.1 * u).fill({ color: 0xff3020, alpha: 0.7 * nuit });
        }
      }
    }
  });
}
