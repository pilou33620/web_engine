// Thème « Vue aérienne » : vue du dessus aux couleurs plates, universel (campagne, ville, réseaux…).
// Chaque type (zone, ligne, batiment, unite) a une table de styles ; « _ » est le dessin par défaut.
import { alea, trait, traitVariable, pointilles, lelong, forme, boite, semis, etiquette, nomLieu, vue, largeur } from "./outils.js";
import { decor, terrain } from "./decor.js";
import { routeDe, rayures, parallele, voieDePres, alignement } from "./epoque.js";

const decorAerien = decor("aerienne", { force: 0.18 });
let avecSol = false;

const P = window.PIXI;
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// Zones cultivées : [couleur, couleur des rangs]
const CULTURES = {
  chaume: [0xc9b47c, 0xb8a36b], culture: [0x4f8a3c, 0x447d33], prairie: [0x8db35e, 0x80a653],
  labour: [0x6b4a32, 0x5b3e29], colza: [0x9aa83e, 0x8a982f],
};

function champ(g, e) {
  const [c1, c2] = CULTURES[e.style];
  forme(g, e).fill(c1);
  if (e.points) return;
  if (e.sens) for (let x = e.x + 4; x < e.x + e.w; x += 8) g.rect(x, e.y, 3, e.h).fill(c2);
  else for (let y = e.y + 4; y < e.y + e.h; y += 8) g.rect(e.x, y, e.w, 3).fill(c2);
  if (e.style === "prairie") {
    const r = alea(e.id);
    for (let i = 0; i < 5; i++) g.ellipse(e.x + 20 + r() * (e.w - 40), e.y + 20 + r() * (e.h - 40), 4, 2.5).fill(0xf2f0e6);
  }
}

function eau(g, e) {
  forme(g, e).fill(0x3a6ea6);
  forme(g, e).stroke({ width: 8, color: 0x8fb8d8, alpha: 0.45 });
}

// Route vue du ciel selon l'année (epoque.js routeDe) : vraie largeur (m) mais au moins px à l'écran. Sentier de terre
// ocre, chemin de terre battue claire, route empierrée grise, goudronnée, bitume moderne (ligne médiane quand elle se
// voit), en 2100 bitume clair bordé d'arbres et voies vertes
function routeAerienne(g, e, metres, px) {
  const w = largeur(metres / vue.echelle, px), bord = 1.4 / vue.zoom, grand = metres > 10, z = vue.zoom;
  let aspect = routeDe();
  if (aspect === "empierree" && !grand) aspect = "terre";
  if (aspect === "sentier") return trait(g, e.points, { width: w * 0.8, color: 0xb89c6c, alpha: grand ? 0.8 : 0.6 });
  if (aspect === "terre") return trait(g, e.points, { width: w, color: 0xe9dcb4, alpha: grand ? 0.85 : 0.6 });
  const [b, fort, faible] = { empierree: [0x7a6a4e, 0xd2c8ac], goudron: [0x2e2e2e, 0x66666a, 0xbfb49a],
    moderne: [0x2e2e2e, 0x55575a, 0x707274], verte: [0x3e5a34, 0x6e7072, 0xd8cfa8] }[aspect];
  if (aspect === "verte" && grand && w * z > 3) alignement(g, e.points, w, Math.max(8 / vue.echelle, 2.4 / z), 0x3a7a35);
  trait(g, e.points, { width: w + bord, color: b, alpha: aspect === "empierree" ? 0.55 : 0.7 });
  trait(g, e.points, { width: w, color: grand ? fort : faible });
  if (grand && aspect !== "empierree" && w * z > 7) rayures(g, e.points, "moitie", w * 2.6, 0xeeeeea, { width: w / 10 });
}

// Voie ferrée vue du ciel : de loin un trait de ballast sombre (LGV claire), de près (22 m exagérés) traverses et rails
const VOIE = { ballast: 0x8a8378, traverse: 0x5a4632, rail: 0x30302e };
function railAerien(g, e, metres, px, couleur, teintes) {
  const z = vue.zoom;
  if ((22 * z) / vue.echelle >= 6) return voieDePres(g, e.points, 22 / vue.echelle, metres > 8, teintes);
  const w = largeur(metres / vue.echelle, px);
  trait(g, e.points, { width: w + 1.2 / z, color: 0x2e2a26, alpha: 0.6 });
  trait(g, e.points, { width: w, color: couleur });
}

// Autoroute : deux chaussées de bitume séparées par un terre-plein vert ; de près, lignes de voies blanches
function autorouteAerienne(g, e) {
  const z = vue.zoom, w = largeur(32 / vue.echelle, 3), vert = routeDe() === "verte";
  if (vert && w * z > 5) alignement(g, e.points, w, Math.max(8 / vue.echelle, 2.4 / z), 0x3a7a35);
  trait(g, e.points, { width: w + 1.4 / z, color: 0x2a2a2a, alpha: 0.75 });
  trait(g, e.points, { width: w, color: vert ? 0x5c5e60 : 0x505256 });
  trait(g, e.points, { width: Math.max(w * 0.16, 0.8 / z), color: 0x5d8a46 });
  if (w * z > 10) for (const d of [-0.3, 0.3]) rayures(g, parallele(e.points, d * w), "moitie", w * 0.8, 0xeeeeea, { width: w * 0.03 });
}

// Voie romaine : dalles de pierre claire, rectiligne
function voieRomaineAerienne(g, e) {
  const z = vue.zoom, w = largeur(8 / vue.echelle, 1.6);
  trait(g, e.points, { width: w + 1.2 / z, color: 0x6e6450, alpha: 0.7 });
  trait(g, e.points, { width: w, color: 0xc4b89c });
  if (w * z > 5) rayures(g, e.points, "paves", w / 2, 0x8a7e66, { width: w, alpha: 0.6 });
}

function libelle(e, sous = "") {
  const lab = etiquette(e.nom + sous, { fontFamily: SANS, fontSize: 13, fontWeight: "600", fill: 0xf5e7c0 }, { color: 0x6b5a2a, alpha: 0.9 });
  lab.position.set(e.x, e.y + (e.taille ?? 40) * 0.8 + 14);
  return lab;
}

export const aerienne = {
  nom: "Vue aérienne", css: "aerienne", fond: 0x55703f, base: 0xa89668, unitesTailleFixe: false,
  orientation: (e) => (e.angle ?? -Math.PI / 2) + Math.PI / 2,
  decor(rendu, carte) {
    avecSol = Boolean(carte.occupation?.lignes?.length);
    return { ...decorAerien(rendu, carte), terrain: terrain(carte) };
  },
  // Au-dessus de l'occupation du sol : limites en tirets clairs, pays voisins voilés
  bordure: {
    departement(g, e) { if (e.points) pointilles(g, [...e.points, e.points[0]], 10, 7, { width: 2.5, color: 0xf2ecd2, alpha: 0.7 }); },
    pays(g, e) { if (e.points && avecSol) forme(g, e).fill({ color: 0x8a9378, alpha: 0.7 }); },
  },

  zone: {
    ...Object.fromEntries(Object.keys(CULTURES).map((k) => [k, champ])),
    foret(g, e) {
      forme(g, e).fill(0x2f5a2a);
      const b = boite(e);
      semis(g, b, alea(e.id), (b.w * b.h) / 220, [0x3f7136, 0x356530, 0x4a7d3e, 0x2c5627], 9, 17);
    },
    mer: eau,
    lac: eau,
    estuaire: eau,
    // Régions administratives vues du ciel : campagne verte nuancée, limites en tirets clairs
    departement(g, e) {
      const teinte = e.couleur ? P.Color.shared.setValue(e.couleur).toNumber() : 0xd8cc9a;
      forme(g, e).fill(0x6f9a4e).fill({ color: teinte, alpha: 0.28 });
    },
    pays(g, e) { forme(g, e).fill(0x8a9378); },
    _(g, e) { forme(g, e).fill(0x9a9a8a); },
  },

  ligne: {
    haie(g, e) {
      const r = alea(e.id);
      trait(g, e.points, { width: 7, color: 0x2e5a29 });
      lelong(e.points, 16, (x, y) => g.circle(x, y, 6 + r() * 6).fill(r() < 0.5 ? 0x2f6a2c : 0x3a7a35));
    },
    riviere(g, e) {
      if (e.largeur !== undefined) {  // carte de région ou de pays : vraie largeur, mais lisible à l'écran
        const px = [2, 4, 2.6, 1.7, 1.3][e.rang ?? 0], z = vue.zoom;
        traitVariable(g, e.points, e.largeur, { color: 0x34619a }, 1, 1.2 / z, (px + 1.2) / z);
        traitVariable(g, e.points, e.largeur, { color: 0x4a7fc0 }, 1, 0, px / z);
        if (z * e.largeur > 5) traitVariable(g, e.points, e.largeur, { color: 0x9cc0ea, alpha: 0.55 }, 0.15, 0, 0.9 / z);
        return;
      }
      trait(g, e.points, { width: 40, color: 0x5d8a46 });
      trait(g, e.points, { width: 24, color: 0x3a6ea6 });
      trait(g, e.points, { width: 5, color: 0x77a6d6, alpha: 0.5 });
    },
    route(g, e) { routeAerienne(g, e, 14, 1.6); },
    chemin(g, e) { routeAerienne(g, e, 6, 1); },
    voie_romaine: voieRomaineAerienne,
    voie_ferree(g, e) { railAerien(g, e, e.rang === 2 ? 6 : 10, e.rang === 2 ? 1.3 : 1.8, 0x5a5048, VOIE); },
    lgv(g, e) { railAerien(g, e, 14, 2.2, 0xc8c2b6, { ...VOIE, ballast: 0xb6b0a6, traverse: 0xd8d4cc }); },
    autoroute: autorouteAerienne,
    ligne_electrique(g, e) {
      trait(g, e.points, { width: 2, color: 0x2a2a2a, alpha: 0.8 });
      lelong(e.points, 60, (x, y) => g.rect(x - 4, y - 4, 8, 8).fill(0x6a6a6a).stroke({ width: 1.5, color: 0x2a2a2a }));
    },
    canalisation(g, e) {
      trait(g, e.points, { width: 6, color: 0x2c5f8a, alpha: 0.35 });
      pointilles(g, e.points, 10, 6, { width: 3, color: 0x4a90c8 });
    },
    frontiere() {},
    _(g, e) { trait(g, e.points, { width: 4, color: 0x777777 }); },
  },

  // Un bâtiment rend { dessin, etiquette?, animer?(dt, contexte) }
  batiment: {
    ville(e) {
      // Emprise bâtie (taille = diamètre en unités) ; vieux bourg de tuiles ou ville moderne de béton et de rues
      const t = e.taille ?? 60, R = t / 2, r = alea(e.id), moderne = vue.epoque === "moderne";
      const g = new P.Graphics().ellipse(e.x, e.y, R * 1.05, R * 0.85).fill({ color: moderne ? 0x9a9a96 : 0xb9ad8c, alpha: 0.9 });
      const toits = moderne ? [0x6f7378, 0x8a8e94, 0xc8c6c0, 0x5f6a74, 0xb0aaa0] : [0xa8473a, 0x9a5a3a, 0xb5653f, 0x6f7f8f, 0x8c4a34];
      const nb = Math.round(8 + 4 * Math.sqrt(t)), b = R / (moderne ? 4 : 5);
      for (let i = 0; i < nb; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.9;
        const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * 0.8;
        const w = b * (0.6 + r() * 0.8), h = b * (0.4 + r() * 0.5);
        g.rect(x - w / 2, y - h / 2, w, h).fill(toits[Math.floor(r() * toits.length)]);
      }
      if (moderne) {  // rues en grille
        for (let k = -2; k <= 2; k++) {
          g.moveTo(e.x - R, e.y + (k * R) / 3).lineTo(e.x + R, e.y + (k * R) / 3).moveTo(e.x + (k * R) / 2.5, e.y - R * 0.8).lineTo(e.x + (k * R) / 2.5, e.y + R * 0.8);
        }
        g.stroke({ width: Math.max(R / 40, 0.6 / vue.zoom), color: 0x4a4a4a, alpha: 0.6 });
      }
      if (avecSol) g.clear();  // la ville est peinte dans l'occupation du sol (cases « u »)
      return { dessin: g, etiquette: libelle(e) };
    },
    eolienne(e) {
      const c = new P.Container();
      c.position.set(e.x, e.y);
      const mat = new P.Graphics().circle(0, 0, 9).fill(0xd8d8d0).circle(0, 0, 4).fill(0xf4f4f0);
      const rotor = new P.Graphics();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        rotor.poly([0, 0, Math.cos(a - 0.08) * 34, Math.sin(a - 0.08) * 34, Math.cos(a + 0.08) * 34, Math.sin(a + 0.08) * 34]).fill(0xfafaf6);
      }
      rotor.circle(0, 0, 3).fill(0x9a9a9a);
      c.addChild(new P.Graphics().ellipse(14, 10, 30, 8).fill({ color: 0x000000, alpha: 0.15 }), mat, rotor);
      // Le rotor tourne avec le vent local (0,8 tr/s à 10 m/s)
      return { dessin: c, animer: (dt, ctx) => { rotor.rotation += dt * Math.min(25, ctx.vent(e.x, e.y)) * 0.5; } };
    },
    transformateur(e) {
      const g = new P.Graphics().rect(e.x - 12, e.y - 12, 24, 24).fill(0x8a8f96).stroke({ width: 2, color: 0x4a4f56 })
        .poly([e.x + 2, e.y - 9, e.x - 5, e.y + 1, e.x, e.y + 1, e.x - 2, e.y + 9, e.x + 5, e.y - 1, e.x, e.y - 1]).fill(0xf2c94c);
      return { dessin: g };
    },
    hangar(e) {
      const g = new P.Graphics().rect(e.x - 26, e.y - 16, 58, 38).fill({ color: 0x000000, alpha: 0.18 })
        .rect(e.x - 30, e.y - 20, 60, 40).fill(0x7d8ea0).rect(e.x - 30, e.y - 1, 60, 2).fill(0x5f6e80);
      return { dessin: g };
    },
    _(e) {
      const g = new P.Graphics().circle(e.x, e.y, (e.taille ?? 20) * 0.6).fill(0x8a8a8a).stroke({ width: 2, color: 0x444444 });
      return { dessin: g, etiquette: e.nom ? libelle(e) : null };
    },
  },

  unite: {
    tracteur(e) {
      const c = new P.Container();
      c.addChild(new P.Graphics()
        .rect(-9, 10, 18, 3).fill(0xb03030).rect(-1, 7, 2, 5).fill(0x333333)
        .rect(-7, -7, 4, 6).fill(0x111111).rect(3, -7, 4, 6).fill(0x111111)
        .rect(-7, 2, 3, 4).fill(0x111111).rect(4, 2, 3, 4).fill(0x111111)
        .rect(-4, -10, 8, 18).fill(e.couleur ?? 0x3f8f3a).rect(-3, -1, 6, 5).fill(0xf0f0f0));
      c.scale.set(1.6);
      return c;
    },
    regiment: () => null,
    _(e) {
      const c = new P.Container();
      c.addChild(new P.Graphics().circle(0, 0, 8).fill(e.couleur ?? 0xdddddd).stroke({ width: 2, color: 0x222222 }));
      return c;
    },
  },

  // Noms des mers, lacs et rivières
  nomLieu(e) {
    if (e.style === "departement" || e.style === "pays") {
      const texte = e.code ? `${e.nom} (${e.code})` : e.nom;
      return nomLieu(e.style === "pays" ? texte.toUpperCase() : texte, { fontFamily: SANS, fontSize: e.style === "pays" ? 13 : 12,
        fontWeight: "600", fill: e.style === "pays" ? 0xd8dccf : 0xfbf6e4, letterSpacing: e.style === "pays" ? 3 : 0.5,
        stroke: { color: 0x2c3a22, width: 3 } });
    }
    const style = { fontFamily: SANS, fontSize: 14, fontStyle: "italic", fill: 0xe6f0f8, letterSpacing: 1 };
    return ["mer", "lac", "estuaire", "riviere"].includes(e.style) ? nomLieu(e.nom, style) : null;
  },
};
