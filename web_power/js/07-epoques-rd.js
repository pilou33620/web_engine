"use strict";
// ============================================================ époques de la campagne
const ERES = [
  { an: 1900, nom: 'Les pionniers', txt: 'L’électricité éclaire les rues et fait tourner les premiers ateliers. Petites usines au charbon et au fil de l’eau, réseau en 15 kV.' },
  { an: 1920, nom: 'L’entre-deux-guerres', txt: 'Le 63 kV relie les vallées et les premiers grands barrages sortent de terre.' },
  { an: 1935, nom: 'Le réseau régional', txt: 'Le 225 kV et les postes de transformation arrivent. L’interconnexion avec la région voisine ouvre en 1938.' },
  { an: 1946, nom: 'La reconstruction', txt: 'Après la guerre, la demande s’envole : grandes centrales au charbon, fioul et barrages.' },
  { an: 1960, nom: 'Les Trente Glorieuses', txt: 'La consommation double tous les dix ans. Le 400 kV et les turbines à combustion font leur apparition.' },
  { an: 1974, nom: 'Le choc pétrolier', txt: 'Le prix du fioul quadruple. Le programme nucléaire est lancé.' },
  { an: 1990, nom: 'Le marché', txt: 'Cycles combinés au gaz, échanges entre régions et premiers parcs éoliens.' },
  { an: 2005, nom: 'Le climat', txt: 'La taxe carbone arrive ; le solaire et l’éolien se développent.' },
  { an: 2020, nom: 'La transition', txt: 'Le charbon doit fermer avant 2032. Batteries et éolien en mer.' },
  { an: 2035, nom: 'Le futur', txt: 'Petits réacteurs, hydrogène, et peut-être la fusion.' },
];
const ere = (a = annee(S.min)) => [...ERES].reverse().find(e => a >= e.an) || ERES[0];
// électrification : demande par quartier, en fraction de celle de 2027
const ELEC = [[1900, .02], [1920, .045], [1935, .075], [1946, .11], [1955, .19], [1965, .36], [1975, .58], [1985, .76], [1995, .88], [2010, .97], [2027, 1], [2040, 1.12], [2050, 1.25]];
function elec(a) { for (let i = 1; i < ELEC.length; i++) if (a <= ELEC[i][0]) { const [a0, v0] = ELEC[i - 1], [a1, v1] = ELEC[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0); } return ELEC.at(-1)[1]; }
const facteurDemande = (m = S.min) => elec(annee(m) + jourAn(m) / 365) * DIFF[S.diff].k * ((CARTE && CARTE.demande) || 1);
// prix de l'électricité en euros constants : un luxe au début du siècle
// prix réel de l'électricité (euros constants) : cher au début du siècle, au plus bas vers 1975, en hausse avec la transition
const TARIF_ERE = [[1900, 1.45], [1946, 1.1], [1960, .88], [1975, .78], [1990, .84], [2005, .95], [2020, 1]];
const tarifEre = (a = annee(S.min)) => { for (let i = 1; i < TARIF_ERE.length; i++) if (a <= TARIF_ERE[i][0]) { const [a0, v0] = TARIF_ERE[i - 1], [a1, v1] = TARIF_ERE[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0); } return 1; };
function prixCombustible(type, a) {
  if (type === 'fioul') return a < 1974 ? 20 : a < 1986 ? 85 : a < 2004 ? 45 : 75;
  return TYPES[type].cout;
}

// ============================================================ R&D (5 branches, 5 niveaux)
const BRANCHES = ['Production', 'Réseau et transport', 'Stockage et flexibilité', 'Gestion et smart grid', 'Eau et assainissement', 'Déchets'];
const RD = [
  { id: 'locales', an: 1995, b: 0, niv: 1, nom: 'Filières locales', cout: 8, effet: 'Débloque la centrale biomasse' },
  { id: 'desulfu', an: 1970, b: 0, niv: 1, nom: 'Dépoussiérage et désulfuration', cout: 6, effet: 'Équipement des centrales au charbon et au fioul contre les fumées (fiche de la centrale)' },
  { id: 'lownox', an: 1990, b: 0, niv: 2, nom: 'Brûleurs bas NOx', cout: 6, effet: 'Équipement des centrales au gaz et des turbines contre les oxydes d’azote', pre: ['desulfu'] },
  { id: 'pales', an: 1990, b: 0, niv: 1, nom: 'Pales composites', cout: 6, effet: '+8 % de production éolienne' },
  { id: 'offshore', an: 2008, b: 0, niv: 2, nom: 'Éolien en mer posé', cout: 20, effet: 'Débloque l’éolien en mer (300 MW)', pre: ['pales'] },
  { id: 'ccga', an: 1998, b: 0, niv: 2, nom: 'Cycles combinés améliorés', cout: 15, effet: '−10 % de combustible et de CO₂ pour le gaz', pre: ['locales'] },
  { id: 'bifacial', an: 2016, b: 0, niv: 3, nom: 'Solaire bifacial', cout: 25, effet: '+15 % de production solaire', pre: ['offshore', 'ccga'] },
  { id: 'epr', an: 2000, b: 0, niv: 3, nom: 'Nucléaire optimisé', cout: 40, effet: 'Réacteur −20 % de coût, −2 ans de chantier', pre: ['ccga'] },
  { id: 'smr', an: 2026, b: 0, niv: 4, nom: 'Petits réacteurs modulaires', cout: 60, effet: 'Débloque le SMR de 170 MW', pre: ['epr', 'bifacial'] },
  { id: 'fusion', an: 2040, b: 0, niv: 5, nom: 'Fusion nucléaire', cout: 150, effet: 'Débloque la centrale à fusion', pre: ['smr'] },
  { id: 'compens', an: 1965, b: 1, niv: 1, nom: 'Compensation série', cout: 8, effet: '+10 % de capacité en 225 et 400 kV' },
  { id: 'htls', an: 1995, b: 1, niv: 2, nom: 'Conducteurs HTLS', cout: 18, effet: '+30 % de capacité de toutes les lignes', pre: ['compens'] },
  { id: 'scada', an: 1985, b: 1, niv: 2, nom: 'Supervision SCADA', cout: 14, effet: '−15 % de pertes en ligne', pre: ['compens'] },
  { id: 'dlr', an: 2008, b: 1, niv: 3, nom: 'Capacité dynamique des lignes', cout: 30, effet: '+15 % de capacité quand il fait froid ou venteux', pre: ['htls', 'scada'] },
  { id: 'hvdc', an: 1998, b: 1, niv: 4, nom: 'Liaison HVDC avec l’Est', cout: 60, effet: '+600 MW d’échanges avec la région voisine', pre: ['dlr'] },
  { id: 'gridf', an: 2022, b: 1, niv: 4, nom: 'Onduleurs grid-forming', cout: 50, effet: 'Fréquence beaucoup plus stable', pre: ['dlr'] },
  { id: 'li', an: 2008, b: 2, niv: 1, nom: 'Batteries lithium-ion', cout: 8, effet: 'Débloque les batteries (100 MW, 2 h)' },
  { id: 'volants', an: 1995, b: 2, niv: 1, nom: 'Volants d’inertie', cout: 10, effet: 'Écarts de fréquence −25 %' },
  { id: 'b4h', an: 2018, b: 2, niv: 2, nom: 'Batteries 4 heures', cout: 18, effet: 'Capacité des batteries doublée', pre: ['li'] },
  { id: 'reversible', an: 1965, b: 2, niv: 2, nom: 'Turbines réversibles', cout: 22, effet: 'Les barrages pompent les surplus', pre: ['li', 'volants'] },
  { id: 'sodium', an: 2022, b: 2, niv: 3, nom: 'Sodium-ion', cout: 30, effet: 'Batteries −30 % de coût', pre: ['b4h'] },
  { id: 'v2g', an: 2028, b: 2, niv: 4, nom: 'Véhicule vers réseau', cout: 45, effet: 'Pointe du soir −6 %', pre: ['sodium'] },
  { id: 'h2', an: 2030, b: 2, niv: 5, nom: 'Hydrogène vert', cout: 100, effet: 'Les surplus sont vendus à 45 €/MWh', pre: ['v2g'] },
  { id: 'compteurs', an: 2005, b: 3, niv: 1, nom: 'Compteurs intelligents', cout: 6, effet: 'Demande −2 %' },
  { id: 'maint', an: 1995, b: 3, niv: 1, nom: 'Maintenance prédictive', cout: 10, effet: 'Pannes de centrales divisées par deux' },
  { id: 'effac', an: 1980, b: 3, niv: 2, nom: 'Effacement industriel', cout: 12, effet: 'Débloque l’effacement (−8 % industrie)', pre: ['compteurs'] },
  { id: 'tarifs', an: 1975, b: 3, niv: 2, nom: 'Heures creuses dynamiques', cout: 15, effet: 'Pointe du soir −4 %', pre: ['compteurs', 'maint'] },
  { id: 'cyber', an: 2008, b: 3, niv: 2, nom: 'Cybersécurité', cout: 10, effet: 'Cyberattaques quatre fois plus rares et deux fois plus courtes', pre: ['compteurs'] },
  { id: 'previ', an: 2012, b: 3, niv: 3, nom: 'Prévisions météo fines', cout: 20, effet: 'Incertitude des prévisions −50 %', pre: ['effac', 'tarifs'] },
  { id: 'ia', an: 2028, b: 3, niv: 5, nom: 'Pilotage par IA', cout: 80, effet: 'Pertes −10 %, demande −3 %', pre: ['previ'] },
  { id: 'fuites', an: 1960, b: 4, niv: 1, nom: 'Recherche acoustique des fuites', cout: 6, effet: 'Fuites des conduites −30 %' },
  { id: 'desodo', an: 1975, b: 4, niv: 2, nom: 'Couverture et désodorisation des stations', cout: 6, effet: 'Équipement des épurations contre les odeurs', pre: ['fuites'] },
  { id: 'boues', an: 1980, b: 4, niv: 2, nom: 'Déshydratation des boues', cout: 6, effet: 'Équipement des épurations : trois fois moins de boues à éliminer', pre: ['fuites'] },
  { id: 'cag', an: 1965, b: 4, niv: 1, nom: 'Charbon actif en grains', cout: 6, effet: 'Débloque l’étape Charbon actif des usines de potabilisation' },
  { id: 'ozone', an: 1980, b: 4, niv: 2, nom: 'Ozonation', cout: 10, effet: 'Débloque l’étape Ozonation', pre: ['cag'] },
  { id: 'alerte', an: 1985, b: 4, niv: 2, nom: 'Surveillance continue de la qualité', cout: 8, effet: 'Captages pollués coupés automatiquement, crises sanitaires deux fois plus rares et plus courtes', pre: ['fuites'] },
  { id: 'denitr', an: 1990, b: 4, niv: 3, nom: 'Dénitratation biologique', cout: 12, effet: 'Débloque l’étape Dénitratation', pre: ['ozone'] },
  { id: 'telerel', an: 1998, b: 4, niv: 3, nom: 'Télérelève et sectorisation', cout: 12, effet: 'Demande en eau −5 %, casses de conduites divisées par deux', pre: ['alerte'] },
  { id: 'membranes', an: 2000, b: 4, niv: 4, nom: 'Ultrafiltration sur membranes', cout: 18, effet: 'Débloque l’étape Ultrafiltration', pre: ['denitr'] },
  { id: 'bioMB', an: 2005, b: 4, niv: 4, nom: 'Bioréacteurs à membranes', cout: 20, effet: 'Stations d’épuration +50 % de capacité', pre: ['membranes'] },
  { id: 'reut', an: 2010, b: 4, niv: 5, nom: 'Réutilisation des eaux usées traitées', cout: 20, effet: 'Les épurations peuvent arroser les fermes et fournir l’industrie', pre: ['bioMB', 'telerel'] },
  { id: 'osmose', an: 2012, b: 4, niv: 5, nom: 'Osmose inverse basse énergie', cout: 25, effet: 'Dessalement −40 % d’électricité et de coût', pre: ['membranes'] },
  { id: 'tasseuse', an: 1950, b: 5, niv: 1, nom: 'Benne tasseuse', cout: 4, effet: 'Camions de collecte : +60 % de capacité' },
  { id: 'chaleur', an: 1965, b: 5, niv: 1, nom: 'Récupération de chaleur', cout: 5, effet: 'Les incinérateurs vendent leur chaleur' },
  { id: 'lixiviats', an: 1975, b: 5, niv: 2, nom: 'Casiers étanches', cout: 5, effet: 'Équipement des décharges : les jus ne polluent plus la rivière', pre: ['tasseuse'] },
  { id: 'ergonomie', an: 1980, b: 5, niv: 2, nom: 'Bennes ergonomiques', cout: 4, effet: 'Usure des équipages de collecte divisée par deux', pre: ['tasseuse'] },
  { id: 'biogaz', an: 1990, b: 5, niv: 3, nom: 'Captage du biogaz de décharge', cout: 6, effet: 'Équipement des décharges : gêne des riverains divisée par deux', pre: ['lixiviats'] },
  { id: 'fumees', an: 1990, b: 5, niv: 3, nom: 'Traitement des fumées', cout: 8, effet: 'Équipement des incinérateurs : gêne des riverains −60 %', pre: ['chaleur'] },
  { id: 'metha', an: 2003, b: 5, niv: 4, nom: 'Méthanisation', cout: 10, effet: 'Débloque le méthaniseur : biodéchets et boues donnent du biogaz et de l’électricité', pre: ['biodechets'] },
  { id: 'selective', an: 1988, b: 5, niv: 2, nom: 'Collecte sélective', cout: 6, effet: 'Débloque le bac jaune des emballages (dès 1992)', pre: ['tasseuse'] },
  { id: 'tournees', an: 1995, b: 5, niv: 2, nom: 'Optimisation des tournées', cout: 6, effet: 'Camions +20 % de capacité, transport −15 %', pre: ['tasseuse'] },
  { id: 'trisemi', an: 1998, b: 5, niv: 3, nom: 'Tri semi-automatique', cout: 10, effet: 'Centres de tri : capacité ×1,7, refus −5 points', pre: ['selective'] },
  { id: 'biodechets', an: 2000, b: 5, niv: 3, nom: 'Collecte des biodéchets', cout: 8, effet: 'Débloque le bac marron des biodéchets', pre: ['selective'] },
  { id: 'incitative', an: 2005, b: 5, niv: 4, nom: 'Redevance incitative', cout: 8, effet: 'Les habitants trient bien mieux, mais 3 % des résiduels finissent dans la nature', pre: ['trisemi'] },
  { id: 'optique', an: 2015, b: 5, niv: 5, nom: 'Tri optique et robotisé', cout: 15, effet: 'Centres de tri : capacité ×2,2, refus −5 points de plus', pre: ['trisemi', 'incitative'] },
];
const RDI = Object.fromEntries(RD.map(r => [r.id, r]));
const rd = id => S.rd.acquis.includes(id);
const rdDispo = r => !rd(r.id) && annee(S.min) >= (r.an || 0) && (r.pre || []).every(rd);
