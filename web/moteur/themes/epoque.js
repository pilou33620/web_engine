// Les époques du rendu. Un jeu donne une année (Regles.ANNEE) ; tout le dessin (villes, routes, réseaux, véhicules,
// campagne) s'y adapte. Le Moyen Âge n'est pas traité : de 500 à 1699, on dessine comme en 1700.
//
//   ère          années          en bref
//   celte        avant -52       oppida et villages de huttes rondes au toit de chaume, sentiers
//   romaine      -52 à 499       villes en damier, forum, voies romaines, villae
//   classique    500 à 1839      bourgs serrés, remparts, chemins de terre, routes royales
//   industrielle 1840 à 1944     chemin de fer, faubourgs ouvriers, routes empierrées puis goudronnées
//   moderne      1945 à 2039     banlieues pavillonnaires, grands ensembles, autoroutes
//   futur        2040 et après   mégapoles vertes : tours, toits végétalisés et solaires, tramways, drones
import { vue } from "./outils.js";

export const ERES = [
  { nom: "celte", jusqua: -53 },
  { nom: "romaine", jusqua: 499 },
  { nom: "classique", jusqua: 1839 },
  { nom: "industrielle", jusqua: 1944 },
  { nom: "moderne", jusqua: 2039 },
  { nom: "futur", jusqua: Infinity },
];

export const ere = (annee = vue.annee) => ERES.find((e) => annee <= e.jusqua).nom;

// Années proposées par l'Atlas (pas de Moyen Âge)
export const ANNEES = [-100, -52, 50, 200, ...Array.from({ length: 41 }, (_, k) => 1700 + 10 * k)];

// Une entité n'existe qu'entre ses années « depuis » et « jusqua » (par exemple une voie ferrée depuis 1850)
export const existe = (e, annee = vue.annee) => (e.depuis ?? -Infinity) <= annee && annee <= (e.jusqua ?? Infinity);

// Population d'une ville à une année donnée, d'après sa population actuelle (ordre de grandeur pour la France)
const COURBE = [[-100, 0.03], [200, 0.06], [500, 0.08], [1700, 0.25], [1800, 0.3], [1850, 0.4], [1900, 0.55],
  [1950, 0.7], [2000, 0.95], [2025, 1], [2100, 1.15]];
export function facteurPopulation(annee = vue.annee) {
  if (annee <= COURBE[0][0]) return COURBE[0][1];
  for (let i = 1; i < COURBE.length; i++) {
    const [a1, f1] = COURBE[i - 1], [a2, f2] = COURBE[i];
    if (annee <= a2) return f1 + ((f2 - f1) * (annee - a1)) / (a2 - a1);
  }
  return COURBE.at(-1)[1];
}
