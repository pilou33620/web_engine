"use strict";
// ============================================================ catalogue des installations
const FIL = { hydro: ['Hydraulique', '#4f8fe0'], nucleaire: ['Nucléaire', '#ff86c8'], charbon: ['Charbon', '#8d8f96'], fioul: ['Fioul', '#a07850'], biomasse: ['Biomasse', '#a0703f'], gaz: ['Gaz', '#f08a6c'], eolien: ['Éolien', '#7cc0f2'], solaire: ['Solaire', '#ffc94d'], stockage: ['Batteries', '#7be08a'], import: ['Import', '#c3b0ea'], tac: ['TAC', '#e0607e'], dechets: ['Déchets', '#f0a35e'] };
const bordEau = t => voisins(t).some(n => estEau(n) || n.riviere !== undefined);
// mw : puissance ; capex M€ ; delai mois ; opex k€/MW/an ; cout €/MWh hors CO₂ ; co2 g/kWh ; ramp MW/min ; min MW
const hydroLibre = t => t.riviere !== undefined && !UNITES.some(u => (u.type === 'barrage' || u.type === 'fil') && u.t !== t && dist(u.t, t) <= 2);
// an : première année de construction possible ; fin : dernière année (technologie dépassée)
const TYPES = {
  usine: { nom: 'Usine électrique au charbon', court: 'Usine', f: 'charbon', mw: 10, capex: 14, delai: 8, opex: 40, cout: 45, co2: 1250, ramp: 1, min: 3, ok: t => plat(t) || t.t === 'colline', non: 'Prairie, plaine ou collines', reseau: 15, pot: 'accept', groupe: 'production', an: 1900, fin: 1960 },
  fil: { nom: 'Usine au fil de l’eau', court: 'Fil de l’eau', f: 'hydro', mw: 6, capex: 9, delai: 12, opex: 15, cout: 0, co2: 0, ramp: 99, fatal: true, ok: hydroLibre, non: 'Sur une rivière, à 3 hexagones d’une autre usine hydraulique', reseau: 15, pot: 'eau', groupe: 'production', an: 1900 },
  barrage: { nom: 'Barrage', court: 'Barrage', f: 'hydro', mw: 180, capex: 420, delai: 36, opex: 20, cout: 2, co2: 0, ramp: 40, ok: hydroLibre, non: 'Sur une rivière, à 3 hexagones d’une autre usine hydraulique', reseau: 225, pot: 'eau', groupe: 'production', stock: 25000, an: 1922 },
  charbon: { nom: 'Centrale à charbon', court: 'Charbon', f: 'charbon', mw: 150, capex: 190, delai: 30, opex: 35, cout: 40, co2: 1050, ramp: 2, min: 50, ok: t => plat(t) || t.t === 'colline', non: 'Prairie, plaine ou collines', reseau: 63, pot: 'accept', groupe: 'production', an: 1925, fin: 1975 },
  charbonG: { nom: 'Grande centrale à charbon', court: 'Grand charbon', f: 'charbon', mw: 450, capex: 560, delai: 42, opex: 35, cout: 38, co2: 980, ramp: 2, min: 180, ok: plat, non: 'Terrain plat', reseau: 225, pot: 'accept', groupe: 'production', an: 1955, fin: 2000 },
  fioul: { nom: 'Centrale au fioul', court: 'Fioul', f: 'fioul', mw: 250, capex: 230, delai: 24, opex: 30, cout: 0, co2: 800, ramp: 6, min: 80, ok: plat, non: 'Terrain plat', reseau: 225, pot: 'accept', groupe: 'production', an: 1952, fin: 1985 },
  tac: { nom: 'Turbine à combustion', court: 'TAC', f: 'tac', mw: 120, capex: 70, delai: 6, opex: 15, cout: 135, co2: 620, ramp: 20, ok: plat, non: 'Terrain plat', reseau: 63, pot: 'accept', groupe: 'production', an: 1965 },
  nucleaire: { nom: 'Réacteur nucléaire 900 MW', court: 'Nucléaire', f: 'nucleaire', mw: 900, capex: 3800, delai: 72, opex: 90, cout: 10, co2: 6, ramp: 12, min: 450, ok: t => plat(t) && bordEau(t), non: 'Plat, au bord de l’eau', reseau: 400, pot: 'accept', groupe: 'production', an: 1974 },
  gaz: { nom: 'Cycle combiné gaz', court: 'CCG', f: 'gaz', mw: 430, capex: 380, delai: 18, opex: 25, cout: 70, co2: 370, ramp: 8, min: 140, ok: plat, non: 'Terrain plat', reseau: 225, pot: 'accept', groupe: 'production', an: 1992 },
  eolien: { nom: 'Parc éolien', court: 'Éolien', f: 'eolien', mw: 60, capex: 85, delai: 9, opex: 40, cout: 0, co2: 0, ramp: 99, fatal: true, ok: t => plat(t) || t.t === 'colline' || t.t === 'foret', non: 'Terrain dégagé ou forêt', reseau: 63, pot: 'vent', groupe: 'production', an: 1996 },
  biomasse: { nom: 'Centrale biomasse', court: 'Biomasse', f: 'biomasse', mw: 40, capex: 120, delai: 18, opex: 60, cout: 55, co2: 50, ramp: 2, min: 12, ok: t => plat(t) || t.t === 'foret', non: 'Plaine ou forêt', reseau: 63, pot: 'accept', rd: 'locales', groupe: 'production', an: 1998 },
  solaire: { nom: 'Ferme solaire', court: 'Solaire', f: 'solaire', mw: 35, capex: 32, delai: 4, opex: 15, cout: 0, co2: 0, ramp: 99, fatal: true, ok: t => plat(t) || t.t === 'colline', non: 'Prairie, plaine ou collines', reseau: 63, pot: 'soleil', groupe: 'production', an: 2006 },
  offshore: { nom: 'Éolien en mer', court: 'Éolien en mer', f: 'eolien', mw: 300, capex: 900, delai: 30, opex: 80, cout: 0, co2: 0, ramp: 99, fatal: true, ok: t => t.t === 'cote' && voisins(t).some(n => !estEau(n) && !n.brume), non: 'Sur la côte, près du rivage', reseau: 225, pot: 'vent', rd: 'offshore', groupe: 'production', eau: true, an: 2012 },
  batterie: { nom: 'Batteries', court: 'Batteries', f: 'stockage', mw: 100, capex: 90, delai: 3, opex: 8, cout: 0, co2: 0, ramp: 99, ok: plat, non: 'Terrain plat', reseau: 63, pot: 'accept', rd: 'li', groupe: 'stockage', mwh: 200, an: 2012 },
  smr: { nom: 'Petit réacteur modulaire', court: 'SMR', f: 'nucleaire', mw: 170, capex: 1100, delai: 48, opex: 110, cout: 12, co2: 6, ramp: 10, min: 60, ok: t => plat(t) && bordEau(t), non: 'Plat, au bord de l’eau', reseau: 225, pot: 'accept', rd: 'smr', groupe: 'production', an: 2030 },
  fusion: { nom: 'Centrale à fusion', court: 'Fusion', f: 'nucleaire', mw: 600, capex: 4000, delai: 60, opex: 120, cout: 5, co2: 0, ramp: 20, min: 200, ok: plat, non: 'Terrain plat', reseau: 400, pot: 'accept', rd: 'fusion', groupe: 'production', an: 2042 },
  poste: { nom: 'Poste 225/63 kV', court: 'Poste', f: null, mw: 0, capex: 25, delai: 4, opex: 0, ok: t => t.t !== 'montagne', non: 'Hors montagne', pot: 'accept', groupe: 'reseau', an: 1935 },
  frontiere: { nom: 'Interconnexion avec la région voisine', court: 'Frontière', f: null, mw: 0, cache: true, groupe: 'reseau', an: 1938 },
};
const estCharbon = u => TYPES[u.type]?.f === 'charbon';
// lignes : 15 kV (distribution des débuts), 63 kV, 225 kV, 400 kV
const KV = { 15: { nom: '15 kV', cap: 15, cout: .12, x: .6, delai: 1, an: 1900 }, 63: { nom: '63 kV', cap: 150, cout: .5, x: .05, delai: 2, an: 1920 }, 225: { nom: '225 kV', cap: 450, cout: 1.2, x: .004, delai: 3, an: 1935 }, 400: { nom: '400 kV', cap: 1600, cout: 2.1, x: .00125, delai: 5, an: 1960 } };
const kvDispo = kv => { for (const k of [400, 225, 63, 15]) if (k <= kv && KV[k].an <= annee(S.min)) return k; return 15; };
const ORDRE_BARRE = ['usine', 'fil', 'barrage', 'charbon', 'charbonG', 'fioul', 'tac', 'nucleaire', 'gaz', 'eolien', 'biomasse', 'solaire', 'offshore', 'batterie', 'smr', 'fusion', 'poste'];
const dispoType = ty => { const a = annee(S.min), t = TYPES[ty]; return a >= t.an && !(t.fin && a > t.fin); };

let vue = 'carte';  // vue de la carte : carte, elec ou eau
