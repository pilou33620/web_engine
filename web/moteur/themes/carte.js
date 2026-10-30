// Thème « Carte » : carte stratégique ancienne (couleurs passées, noms en lettres à empattements).
// Même structure que aerienne.js : tables de styles par type, « _ » par défaut.
import { alea, trait, pointilles, lelong, forme, boite, semis, etiquette, nomLieu } from "./outils.js";

const P = window.PIXI;
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const TERRES = { chaume: 0xcdb984, culture: 0xa3aa6c, prairie: 0xb5b379, labour: 0xb99a6b, colza: 0xb2b262, foret: 0x7a8550 };

function terre(g, e) {
  // Les zones débordent un peu pour effacer les chemins : à cette échelle on voit des terroirs, pas des parcelles
  if (e.points) forme(g, e).fill(TERRES[e.style] ?? 0xc8b88a);
  else g.rect(e.x - 4, e.y - 4, e.w + 8, e.h + 8).fill(TERRES[e.style] ?? 0xc8b88a);
  if (e.style === "foret") semis(g, boite(e), alea(e.id), (e.w * e.h) / 90, [0x55603a, 0x4a5532, 0x606b40], 3, 6);
}

function eau(g, e) {
  forme(g, e).fill(0x3e6782);
  forme(g, e).stroke({ width: 10, color: 0x9fb4b0, alpha: 0.45 });
}

export const carte = {
  nom: "Carte", css: "carte", fond: 0x2b3d49, base: 0xcbb98a, unitesTailleFixe: true,
  orientation: () => 0,

  zone: { ...Object.fromEntries(Object.keys(TERRES).map((k) => [k, terre])), mer: eau, lac: eau, _: terre },

  ligne: {
    haie(g, e) { trait(g, e.points, { width: 2, color: 0x6b7340, alpha: 0.35 }); },
    riviere(g, e) {
      trait(g, e.points, { width: 22, color: 0x9fb4b0, alpha: 0.5 });
      trait(g, e.points, { width: 10, color: 0x3e6f98 });
    },
    route(g, e) { pointilles(g, e.points, 18, 8, { width: 4, color: 0x7a5636, alpha: 0.85 }); },
    ligne_electrique(g, e) {
      trait(g, e.points, { width: 2.5, color: 0x3a2a1a, alpha: 0.8 });
      lelong(e.points, 50, (x, y) => g.circle(x, y, 3).fill(0x3a2a1a));
    },
    canalisation(g, e) { pointilles(g, e.points, 8, 6, { width: 3, color: 0x2f5f86, alpha: 0.85 }); },
    frontiere(g, e) {
      const c = P.Color.shared.setValue(e.couleur ?? "#9b4dca").toNumber();
      trait(g, e.points, { width: 22, color: c, alpha: 0.22 });
      trait(g, e.points, { width: 4, color: c, alpha: 0.9 });
    },
    _(g, e) { trait(g, e.points, { width: 3, color: 0x5a4a3a }); },
  },

  batiment: {
    ville(e) {
      const g = new P.Graphics()
        .circle(e.x, e.y, 13).fill(0x5a3a2a).stroke({ width: 3, color: 0xf0e6cc })
        .rect(e.x - 1, e.y - 34, 2, 22).fill(0x3a2a1a)
        .poly([e.x + 1, e.y - 34, e.x + 16, e.y - 29, e.x + 1, e.y - 24]).fill(0xb83a2e);
      const lab = new P.Container();
      const nom = etiquette(e.nom.toUpperCase(), { fontFamily: SERIF, fontSize: 15, fontWeight: "600", fill: 0xf0e6cc, letterSpacing: 0.5 }, { color: 0x262626, alpha: 0.92 }, 0xb83a2e);
      const pop = etiquette(String(e.population ?? ""), { fontFamily: SERIF, fontSize: 12, fill: 0xf0e6cc }, { color: 0x3a2a2a, alpha: 0.95 });
      nom.y = 30;
      pop.position.set(nom.width / 2 + 4, 6);
      lab.addChild(nom, pop);
      lab.position.set(e.x, e.y);
      return { dessin: g, etiquette: lab };
    },
    eolienne(e) {
      const g = new P.Graphics().moveTo(e.x, e.y + 10).lineTo(e.x, e.y - 8).stroke({ width: 2, color: 0x3a2a1a });
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
        g.moveTo(e.x, e.y - 8).lineTo(e.x + Math.cos(a) * 10, e.y - 8 + Math.sin(a) * 10).stroke({ width: 2, color: 0x3a2a1a });
      }
      return { dessin: g };
    },
    transformateur(e) {
      return { dessin: new P.Graphics().rect(e.x - 7, e.y - 7, 14, 14).fill(0xf0e6cc).stroke({ width: 2, color: 0x3a2a1a }) };
    },
    hangar(e) {
      return { dessin: new P.Graphics().rect(e.x - 14, e.y - 9, 28, 18).fill(0x8a6a4a).stroke({ width: 2, color: 0x3a2a1a }) };
    },
    _(e) {
      const g = new P.Graphics().circle(e.x, e.y, 8).fill(0x5a3a2a).stroke({ width: 2, color: 0xf0e6cc });
      const lab = e.nom ? etiquette(e.nom, { fontFamily: SERIF, fontSize: 13, fill: 0xf0e6cc }, { color: 0x262626, alpha: 0.9 }) : null;
      lab?.position.set(e.x, e.y + 24);
      return { dessin: g, etiquette: lab };
    },
  },

  unite: {
    regiment(e) {
      const c = new P.Container();
      c.addChild(new P.Graphics()
        .circle(0, 0, 20).fill(0xf0e6cc).stroke({ width: 3, color: 0x8a1f1f })
        .circle(0, -4, 6).fill(0x2b3f7a)
        .roundRect(-7, 2, 14, 12, 3).fill(0x2b3f7a));
      const t = new P.Text({ text: String(e.effectif ?? ""), style: { fontFamily: SERIF, fontSize: 12, fontWeight: "700", fill: 0xf0e6cc } });
      const fond = new P.Graphics().roundRect(-t.width / 2 - 5, 22, t.width + 10, t.height + 2, 3).fill({ color: 0x262626, alpha: 0.9 });
      t.anchor.set(0.5, 0);
      t.y = 23;
      c.addChild(fond, t);
      return c;
    },
    tracteur: () => null,
    _: () => null,
  },

  nomLieu(e) {
    const style = { fontFamily: SERIF, fontSize: e.style === "mer" ? 30 : 17, fontStyle: "italic", fill: 0x2f4a5c, letterSpacing: 2 };
    return ["mer", "lac", "riviere"].includes(e.style) ? nomLieu(e.style === "mer" ? e.nom.toUpperCase() : e.nom, style) : null;
  },
};
