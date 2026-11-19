// Les chantiers vivants, communs aux jeux : échafaudages qui montent avec les travaux, ouvriers qui vont et viennent,
// un maçon qui frappe, un porteur qui monte les matériaux, et une grue dont le mât s'élève au fil des travaux.
// Dessin (L, ex) pour modele() ou pour un jeu qui assemble lui-même (unités de 10 par case, comme BAT).
import { put, boite, cyl, sphere } from './toon.js';
import { piece } from './modernes.js';

const PEAU = 0xf0c9a0, BOIS = 0x8a6a42, PLANCHE = 0xb08a58;
// un ouvrier debout (face à +z) : casque jaune et gilet orange (moderne), ou bonnet et blouse (ancien)
function ouvrier(P, ancien, porte = false) {
  const blouse = ancien ? 0x8a7a5a : 0xff8a3a, coiffe = ancien ? 0x5a4a3a : 0xf2c94c;
  for (const dx of [-0.13, 0.13]) put(P, boite(0.2, 0.7, 0.22), ancien ? 0x4a4038 : 0x3a4a6a, dx, 0.35, 0, 0, 0.03);
  put(P, boite(0.55, 0.65, 0.32), blouse, 0, 1.02, 0, 0, 0.04);
  put(P, sphere(0.2, 1), PEAU, 0, 1.52, 0, 0, 0.03);
  put(P, ancien ? cyl(0.17, 0.2, 0.14, 8) : sphere(0.22, 1).scale(1, 0.6, 1), coiffe, 0, 1.68, 0, 0, 0.03);
  if (porte) put(P, boite(0.5, 0.35, 0.4), ancien ? 0xb0a080 : 0xc9c2b2, 0, 1.95, 0, 0, 0.04);  // sac ou parpaings sur l'épaule
}

/** Un chantier vivant ; av : l'avancement des travaux (0 à 1) ; w, d : l'emprise (unités de 10 par case) ; haut : la hauteur
 *  de l'échafaudage une fois les travaux finis ; ancien : bois et cordes, chèvre de levage au lieu de la grue jaune. */
export function chantierVivant(av = 0, { w = 7, d = 6, haut = 5, ancien = false } = {}) {
  av = Math.max(0, Math.min(1, av));
  return (L, ex) => {
    const h = 0.8 + av * haut, etages = Math.max(1, Math.round(h / 1.6));
    // échafaudage : poteaux aux coins et le long des façades, planchers à chaque étage
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2], [0, -d / 2]]) put(L, boite(0.14, h, 0.14), ancien ? BOIS : 0x9aa3ad, x, h / 2, z, 0, 0.02);
    for (let e = 1; e <= etages; e++) {
      const y = Math.min(h, e * 1.6);
      put(L, boite(w + 0.3, 0.08, 0.5), PLANCHE, 0, y, d / 2 + 0.25, 0, 0.02);
      put(L, boite(0.5, 0.08, d + 0.3), PLANCHE, w / 2 + 0.25, y, 0, 0, 0.02);
    }
    // tas de matériaux au pied
    put(L, boite(1.2, 0.5, 0.9), ancien ? 0xcdbb8e : 0xb5b0a4, -w / 2 - 1.2, 0.25, d / 2 + 1, 0.3, 0.04);
    put(L, cyl(0.25, 0.25, 1.6, 6).rotateZ(Math.PI / 2), BOIS, -w / 2 - 1.1, 0.25, d / 2 + 2, 0.2, 0.03);
    // ouvriers : l'un va et vient sur le plancher, un maçon frappe, un porteur fait la navette entre le tas et l'échafaudage
    const y1 = Math.min(h, 1.6);
    piece(L, ex, P => ouvrier(P, ancien), 0, y1 + 0.05, d / 2 + 0.25, 'glisse', 'x', w * 0.35, 0.35);
    piece(L, ex, P => { ouvrier(P, ancien); put(P, boite(0.08, 0.6, 0.08), BOIS, 0.35, 1.2, 0.2, 0, 0.02); }, w / 2 + 0.25, y1 + 0.05, -d * 0.2, 'oscille', 'x', 0.25, 6);
    piece(L, ex, P => ouvrier(P, ancien, true), 0, 0, 0, 'chemin', [[-w / 2 - 1.2, 0, d / 2 + 1.6, 1], [w / 2 + 0.8, 0, d / 2 + 1.2, 1]], 1, 0.12);
    // levage : le mât monte avec les travaux, la flèche tourne et la charge descend et remonte
    const mat = ancien ? 1.6 + av * haut * 0.6 : 4 + av * haut * 2, gx = -w / 2 - 0.5, gz = -d / 2 - 0.5;
    if (ancien) {  // chèvre : trois perches en faisceau, une poulie et une corde
      for (const a of [0, 2.1, 4.2]) put(L, boite(0.12, mat * 1.05, 0.12).rotateZ(0.18), BOIS, gx + Math.cos(a) * 0.5, mat / 2, gz + Math.sin(a) * 0.5, -a, 0.02);
      piece(L, ex, P => { put(P, boite(0.03, 1.2, 0.03), 0x3a3a3a, 0, -0.6, 0, 0, 0); put(P, boite(0.5, 0.35, 0.5), 0xcdbb8e, 0, -1.3, 0, 0, 0.03); }, gx, mat, gz, 'glisse', 'y', 0.6, 0.5);
    } else {
      put(L, boite(0.55, mat, 0.55), 0xf2c94c, gx, mat / 2, gz, 0, 0.04);
      piece(L, ex, P => {
        put(P, boite(9, 0.45, 0.45), 0xf2c94c, 2.5, 0, 0, 0, 0.04); put(P, boite(1.3, 1.1, 1.1), 0x6b6f75, -2.4, -0.4, 0, 0, 0.04);
        put(P, boite(0.05, 2.5, 0.05), 0x3a3a3a, 5.5, -1.25, 0, 0, 0); put(P, boite(0.8, 0.4, 0.6), 0xb5b0a4, 5.5, -2.7, 0, 0, 0.03);
      }, gx, mat + 0.2, gz, 'oscille', 'y', 0.9, 0.25);
    }
  };
}
