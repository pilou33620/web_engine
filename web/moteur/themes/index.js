// Liste des thèmes. Un jeu peut ajouter ou remplacer des styles avec jeux/<nom>/web/styles.js :
//   export default { aerienne: { batiment: { moulin(e) { … } } }, carte: { … } }
import { aerienne } from "./aerienne.js";
import { carte } from "./carte.js";

export const THEMES = { aerienne, carte };

export function fusionnerStyles(extension) {
  for (const [nom, ajout] of Object.entries(extension ?? {})) {
    const theme = THEMES[nom];
    if (!theme) continue;
    for (const [cle, valeur] of Object.entries(ajout)) {
      theme[cle] = typeof valeur === "object" && typeof theme[cle] === "object" ? { ...theme[cle], ...valeur } : valeur;
    }
  }
}
