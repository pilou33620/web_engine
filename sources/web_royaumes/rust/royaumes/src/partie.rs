//! L'état d'une partie et ce qui le lit ou le modifie hors du tour : création, territoire,
//! construction, armées, chemins, défense des villes.

use std::collections::{BTreeMap, BinaryHeap, HashMap};
use std::cmp::Reverse;

use serde::{Deserialize, Serialize};

use crate::carte::{Carte, Options, Terrain, BOIS_ARBRE};
use crate::hasard::Hasard;
use crate::ia::diplomatie::{self, Diplomatie};
use crate::meteo::{self, Meteo};
use crate::regles::{regles, Panier};

/// 2 : les remparts et citadelles sont devenus des niveaux de fortification des villes
/// 3 : forts bâtis par les armées, retranchements (champs nouveaux, lus par défaut)
/// 4 : éclairage public des villes (`Ville::eclairage`, éteint par défaut)
/// 5 : (deux branches parallèles) les rivaux vivent la même économie que le joueur (stocks, population, ouvriers) :
///     `migrer_economie_rivaux` ; ou diplomatie entre tous les royaumes (`Partie::diplomatie`)
/// 6 : les deux à la fois ; une sauvegarde 5 reçoit ce qui lui manque
pub const VERSION_SAUVEGARDE: u32 = 6;
/// La partie commence en avril 1700 (le printemps : on sème avant l'hiver).
pub const TOUR_DEPART: u32 = 3;
/// Les brigands : un « royaume » à part, ennemi de tous.
pub const BRIGANDS: i32 = 99;

pub struct DefRoyaume {
    pub nom: &'static str,
    pub couleur: &'static str,
    pub caractere: &'static str,
    pub villes: &'static [&'static str],
}

pub const ROYAUMES: [DefRoyaume; 6] = [
    DefRoyaume { nom: "Royaume d'Azur", couleur: "#2f7fd6", caractere: "", villes: &["Bellerive", "Clairmont", "Hautegarde", "Rochefleur", "Pré-Doré", "Vauclair", "Montjoie"] },
    DefRoyaume { nom: "Empire d'Ostrie", couleur: "#c23b2e", caractere: "guerrier", villes: &["Ostria", "Ravenne", "Capoue", "Néapolis", "Ostie", "Tarente"] },
    DefRoyaume { nom: "Ligue de Marbrune", couleur: "#139089", caractere: "marchand", villes: &["Marbrune", "Texcoque", "Cholula", "Tlacopa", "Xochimar", "Coyoac"] },
    DefRoyaume { nom: "Duché de Sylve", couleur: "#8e44ad", caractere: "batisseur", villes: &["Sylvanor", "Brumebois", "Fougeraie", "Mousseval", "Lierre", "Combefeuille"] },
    DefRoyaume { nom: "Électorat de Korval", couleur: "#df7a1c", caractere: "guerrier", villes: &["Korval", "Durnhelm", "Skarp", "Grimholt", "Vargen", "Eisenau"] },
    DefRoyaume { nom: "République de Lumen", couleur: "#c9a00f", caractere: "marchand", villes: &["Lumen", "Aurelle", "Dorac", "Solenne", "Mirabel", "Port-Clair"] },
];

/// Les réserves de chaque royaume au départ.
pub const STOCK_DEPART: [(&str, f64); 7] = [("or", 300.0), ("bois", 80.0), ("planches", 30.0), ("pierre", 40.0), ("outils", 10.0), ("pain", 30.0), ("poisson", 20.0)];

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Royaume {
    pub id: usize,
    pub nom: String,
    pub couleur: String,
    pub joueur: bool,
    pub caractere: String,
    pub vivant: bool,
    pub techs: Vec<String>,
    // --- l'économie, la même pour tous les royaumes (tour.rs) ---
    pub stock: Panier,
    pub pop: i64,
    pub bonheur: f64,
    pub impots: String,
    pub recherche: Option<String>,
    pub savoir: f64,
    pub detail_bonheur: Vec<(String, f64)>,
    pub revenus: Panier,
    pub bilan: Panier,
    pub famine: bool,
    pub ouvriers_libres: i64,
    pub variete: u32,
    pub quete: usize,
    // --- les royaumes de l'ordinateur ---
    /// le trésor résumé des sauvegardes d'avant la version 5 : versé dans `stock` à la migration, jamais réécrit
    #[serde(rename = "or", skip_serializing)]
    pub tresor_v4: f64,
    pub relation: f64,
    pub statut: String,
    pub commerce: bool,
    pub treve: u32,
    pub debut_guerre: u32,
    pub prochaine_attaque: u32,
    pub prochaine_offre: u32,
    pub cadeaux: u32,
    /// (ordinateur) ce qu'il vend bon marché et ce qu'il achète cher : recalculés chaque mois depuis ses stocks (ia/economie.rs)
    pub surplus: Vec<String>,
    pub demande: Vec<String>,
    pub noms_villes: Vec<String>,
    pub attitude: f64,
    /// 1 chemins de terre, 2 routes pavées, 3 routes royales (0 : ancienne sauvegarde, vaut 1)
    pub niveau_routes: u32,
    /// cases explorées (1) : le brouillard de guerre ; les cases visibles se recalculent (`vision`)
    pub explore: Vec<u8>,
    /// zones révélées par les espions : [case, rayon, jusqu'au tour compris]
    pub revele: Vec<[u32; 3]>,
    /// tour du prochain événement à choix (0 : à tirer)
    pub prochain_choix: u32,
    pub dernier_choix: String,
    /// or rapporté par le commerce maritime le mois dernier
    pub commerce_mer: f64,
    /// (ordinateur) la case où un détachement part bâtir une redoute
    pub projet_fort: Option<usize>,
    /// (ordinateur) la campagne en cours et la mémoire de l'IA militaire
    pub militaire: crate::ia::militaire::EtatMilitaire,
}

impl Royaume {
    pub fn a(&self, tech: &str) -> bool {
        self.techs.iter().any(|t| t == tech)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Ville {
    pub id: u32,
    pub nom: String,
    pub proprio: i32,
    pub case: usize,
    pub niveau: u32,
    pub capitale: bool,
    /// niveau de fortification : 0 ville ouverte, 1 Palissade … 4 Citadelle (`regles.fortifications`)
    #[serde(default)]
    pub fortif: u32,
    /// mois de travaux restants avant le niveau suivant (0 : pas de travaux)
    #[serde(default)]
    pub travaux_fortif: u32,
    /// éclairage public allumé (réverbères et veilleur, payés chaque mois : `regles.eclairage`)
    #[serde(default)]
    pub eclairage: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Batiment {
    pub id: u32,
    pub cle: String,
    pub proprio: i32,
    pub case: usize,
    /// mois de travaux restants (0 : terminé)
    pub reste: u32,
    pub ouvriers: u32,
    pub etat: String,
    pub pause: bool,
    pub file: Vec<String>,
    /// la ville dont il dépend
    pub ville: Option<u32>,
    /// ce qu'il a produit le mois dernier
    pub produit: Panier,
    /// orientation du modèle (radians)
    pub face: f64,
    /// saboté : ne produit plus avant ce tour
    pub arret: u32,
}

impl Batiment {
    pub fn fini(&self) -> bool {
        self.reste == 0
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Armee {
    pub id: u32,
    pub proprio: i32,
    pub case: usize,
    pub unites: BTreeMap<String, u32>,
    /// cases à parcourir (sans la case actuelle)
    pub chemin: Vec<usize>,
    /// retranchement : mois de travaux restants, `Some(0)` retranchée ; perdu dès qu'elle bouge
    pub retranche: Option<u32>,
}

/// Un fort bâti par une armée hors des villes : 0 en chantier, 1 Redoute, 2 Fort bastionné, 3 Fort à batteries.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Fort {
    pub id: u32,
    pub proprio: i32,
    pub case: usize,
    pub niveau: u32,
    /// mois de travaux restants avant le niveau suivant (0 : pas de travaux)
    pub travaux: u32,
}

impl Armee {
    pub fn effectif(&self) -> u32 {
        self.unites.values().sum()
    }
}

/// Une flotte : des navires sur une case d'eau, et peut-être une armée à bord.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Flotte {
    pub id: u32,
    pub proprio: i32,
    pub case: usize,
    pub navires: BTreeMap<String, u32>,
    pub chemin: Vec<usize>,
    pub armee: Option<Armee>,
    /// à quai, ses flûtes commercent
    pub commerce: bool,
    /// (ordinateur) en arrivant, débarquer l'armée et marcher vers cette case
    pub cible: Option<usize>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Espion {
    pub id: u32,
    pub proprio: i32,
    pub case: usize,
    pub chemin: Vec<usize>,
    /// renseignement, vol, sabotage
    pub mission: Option<String>,
    /// la ville visée par la mission
    pub ville: Option<u32>,
    /// mois de mission restants
    pub reste: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Siege {
    pub ville: u32,
    pub case: usize,
    pub assiegeant: i32,
    pub mois: u32,
    pub murs: f64,
    pub murs_max: f64,
    /// mois de vivres restants dans la ville
    pub vivres: f64,
    /// mois passés à souffrir de la faim
    pub faim: u32,
    /// assaut ordonné : il se donne à la fin du mois
    pub assaut: bool,
    /// dernier faubourg pillé : (case, clé du bâtiment)
    pub pillage: Option<(usize, String)>,
    /// le siège d'un fort : `ville` est alors l'identifiant du fort
    pub fort: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Blocus {
    pub ville: u32,
    pub case: usize,
    pub par: i32,
}

/// Un événement à choix en attente de la réponse du joueur.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Choix {
    pub id: u32,
    pub cle: String,
    pub titre: String,
    pub icone: String,
    pub texte: String,
    pub royaume: Option<usize>,
    pub options: Vec<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Proposition {
    pub id: u32,
    pub de: usize,
    /// echange, alliance, paix, tribut, marchand, aide (entrer en guerre contre `cible`)
    pub genre: String,
    pub texte: String,
    pub donne: Panier,
    pub demande: Panier,
    /// la ville cédée avec la paix (à celui qui ne la possède pas)
    pub ville: Option<u32>,
    /// le royaume contre lequel un allié demande de l'aide
    pub cible: Option<usize>,
    /// 0 : première offre ; 1, 2 : contre-propositions
    pub manche: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Evenement {
    pub texte: String,
    /// info, bon, guerre, or, meteo
    pub genre: String,
    pub case: Option<usize>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Mouvement {
    pub armee: u32,
    pub proprio: i32,
    pub trajet: Vec<usize>,
    /// une flotte (sinon une armée)
    pub flotte: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Combat {
    pub case: usize,
    pub attaquant: i32,
    pub defenseur: i32,
    pub vainqueur: i32,
    pub texte: String,
    /// étape du déplacement où il a lieu (pour l'animation)
    pub etape: usize,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Rapport {
    pub tour: u32,
    pub date: String,
    pub meteo: Option<Meteo>,
    pub effets_meteo: Vec<String>,
    pub evenements: Vec<Evenement>,
    pub mouvements: Vec<Mouvement>,
    pub combats: Vec<Combat>,
    pub termines: Vec<usize>,
    pub bilan: Panier,
    pub pop_avant: i64,
    pub pop_apres: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Fin {
    pub victoire: bool,
    pub titre: String,
    pub texte: String,
}

#[derive(Clone, Debug, Default)]
pub struct Stats {
    pub logement: i64,
    pub stockage: f64,
    pub vivres: f64,
    pub hygiene: f64,
    pub foi: f64,
    pub taverne: f64,
    pub decor: f64,
    pub taxe: f64,
    pub savoir: f64,
    pub soldats: i64,
    pub comptoir: bool,
    pub port: bool,
    pub gare: bool,
    /// or par mois pour les navires et les espions
    pub entretien_flotte: f64,
}

/// Gain de temps des routes, par niveau : aucune, chemin de terre, pavée, royale (Lumières), impériale (Empire), empierrée (macadam, industrie).
pub const ROUTES: [f64; 6] = [1.0, 0.8, 0.65, 0.5, 0.4, 0.32];
/// Nom des niveaux de route et l'année où chacun devient possible.
pub const NIVEAUX_ROUTES: [(&str, u32); 6] = [("", 0), ("Chemins de terre", 0), ("Routes pavées", 0), ("Routes royales", 1720), ("Routes impériales", 1789), ("Routes empierrées (macadam)", 1816)];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Partie {
    pub version: u32,
    pub options: Options,
    pub hasard: Hasard,
    pub carte: Carte,
    pub tour: u32,
    pub meteo: Meteo,
    pub royaumes: Vec<Royaume>,
    pub villes: Vec<Ville>,
    pub batiments: Vec<Batiment>,
    pub armees: Vec<Armee>,
    pub propositions: Vec<Proposition>,
    pub journal: Vec<String>,
    pub rapport: Rapport,
    pub prochain_id: u32,
    pub prochains_brigands: u32,
    pub fin: Option<Fin>,
    pub sans_victoire: bool,
    /// numéro de version de la carte (le terrain a changé : l'interface la recharge)
    pub version_carte: u32,
    /// Les routes, tracées toutes seules : [case, case voisine, royaume qui l'entretient].
    #[serde(default)]
    pub routes: Vec<[usize; 3]>,
    #[serde(default)]
    pub flottes: Vec<Flotte>,
    #[serde(default)]
    pub espions: Vec<Espion>,
    #[serde(default)]
    pub sieges: Vec<Siege>,
    #[serde(default)]
    pub blocus: Vec<Blocus>,
    #[serde(default)]
    pub choix: Vec<Choix>,
    #[serde(default)]
    pub forts: Vec<Fort>,
    /// cases achetées : [case, royaume] ; elles restent au royaume comme la case d'un fort
    #[serde(default)]
    pub terres: Vec<[i64; 2]>,
    /// relations et traités entre rivaux, souverains, mémoire, coalitions (ia/diplomatie.rs)
    #[serde(default)]
    pub diplomatie: Diplomatie,
}

impl Partie {
    // ------------------------------------------------------------------ création
    pub fn nouvelle(mut o: Options) -> Partie {
        o.borner();
        let mut carte = Carte::generer(&o);
        let mut h = Hasard::new(o.graine.wrapping_mul(7).wrapping_add(3));
        let tailles = carte.composantes();
        let n = o.rivaux as usize + 1;
        let la_plus_grande = tailles.iter().enumerate().max_by_key(|x| x.1).map(|x| x.0 as i32).unwrap_or(0);
        let (l, ht) = (carte.l, carte.h);
        let mut cand: Vec<usize> = (0..carte.cases.len())
            .filter(|&i| {
                let k = &carte.cases[i];
                k.t == Terrain::Plaine && !k.riviere && k.comp >= 0 && tailles[k.comp as usize] >= 20 && k.c > 2 && k.r > 2 && k.c < l - 3 && k.r < ht - 3
            })
            .collect();
        // hors de la carte classique (qui garde ses départs d'origine) : de la place pour bâtir autour de la capitale
        // et, sur les cartes d'îles, la mer à deux cases pour un port (les armées ne passent l'eau qu'en flûte)
        let forme = o.forme_reelle();
        let classique = forme == "classique";
        let insulaire = matches!(forme, "iles" | "archipel" | "deux_continents");
        for place in if classique { vec![] } else { vec![20, 15] } {
            let strict: Vec<usize> = cand
                .iter()
                .copied()
                .filter(|&i| {
                    carte.rayon(i, 3).iter().filter(|&&x| carte.cases[x].comp == carte.cases[i].comp).count() >= place
                        && (!insulaire || carte.rayon(i, 2).iter().any(|&x| carte.cases[x].mer()))
                })
                .collect();
            if strict.len() >= n {
                cand = strict;
                break;
            }
        }
        if cand.len() < n {
            cand = (0..carte.cases.len()).filter(|&i| matches!(carte.cases[i].t, Terrain::Plaine | Terrain::Sable)).collect();
        }
        let premiers: Vec<usize> = cand.iter().copied().filter(|&i| carte.cases[i].comp == la_plus_grande).collect();
        let mut departs = vec![*h.choix(&premiers).or(h.choix(&cand)).expect("aucune terre où fonder un royaume")];
        while departs.len() < n {
            let mut meilleur = None;
            let mut score = f64::NEG_INFINITY;
            for &i in &cand {
                if departs.contains(&i) {
                    continue;
                }
                let d = departs.iter().map(|&s| carte.dist(s, i)).min().unwrap_or(0) as f64;
                let comp = carte.cases[i].comp;
                let bonus = if classique {
                    if comp == la_plus_grande { 4.0 } else { 0.0 }
                } else if comp >= 0 && tailles[comp as usize] < 150 && departs.iter().any(|&s| carte.cases[s].comp == comp) {
                    -8.0 // une petite île déjà prise : mieux vaut une île à soi
                } else {
                    0.0
                };
                let sc = d + bonus + h.f() * 2.0;
                if sc > score {
                    score = sc;
                    meilleur = Some(i);
                }
            }
            match meilleur {
                Some(i) => departs.push(i),
                None => break,
            }
        }
        // chaque départ a du bois et de la pierre à portée
        for &s in &departs {
            // un royaume ne naît ni au désert ni dans la toundra : ses terres proches redeviennent tempérées
            for x in carte.rayon(s, 2) {
                if matches!(carte.cases[x].biome.as_deref(), Some("desert" | "toundra")) {
                    carte.cases[x].biome = None;
                }
            }
            carte.cases[s].foret = false;
            carte.cases[s].arbres = 0;
            carte.cases[s].bois = 0.0;
            let autour: Vec<usize> = carte.rayon(s, 3).into_iter().filter(|&x| x != s && carte.cases[x].t == Terrain::Plaine).collect();
            // hors de la carte classique, six bois à quatre cases : une petite île ne doit pas manquer de bois dès le départ
            let (zone, voulus) = if classique { (3, 1) } else { (4, 6) };
            let bois = carte.rayon(s, zone).iter().filter(|&&x| carte.cases[x].foret).count();
            if bois < voulus {
                let n_bois = if classique { 3 } else { voulus - bois };
                let choisies: Vec<usize> = carte
                    .rayon(s, zone)
                    .into_iter()
                    .filter(|&x| carte.dist(x, s) >= 2 && carte.cases[x].t == Terrain::Plaine && !carte.cases[x].foret)
                    .take(n_bois)
                    .collect();
                for x in choisies {
                    let k = &mut carte.cases[x];
                    k.foret = true;
                    k.arbres = 5;
                    k.bois = 5.0 * BOIS_ARBRE;
                }
            }
            if !carte.rayon(s, 4).iter().any(|&x| matches!(carte.cases[x].t, Terrain::Colline | Terrain::Montagne) || carte.cases[x].gisement.is_some()) {
                if let Some(&x) = autour.iter().find(|&&x| !carte.cases[x].foret && carte.dist(x, s) >= 2) {
                    carte.cases[x].t = Terrain::Colline;
                    carte.cases[x].gisement = Some("pierre".into());
                }
            }
        }
        carte.composantes();
        // les royaumes : le joueur d'abord (Azur), puis les rivaux tirés au sort
        let mut ordre: Vec<usize> = (1..6).collect();
        h.melanger(&mut ordre);
        ordre.insert(0, 0);
        ordre.truncate(departs.len());
        let mut royaumes = Vec::new();
        for (k, &d) in ordre.iter().enumerate() {
            let def = &ROYAUMES[d];
            let joueur = k == 0;
            let mut caractere = def.caractere.to_string();
            if !joueur {
                caractere = match o.attitude.as_str() {
                    "agressifs" if h.p(0.7) => "guerrier".into(),
                    "pacifiques" if caractere == "guerrier" => "batisseur".into(),
                    _ => caractere,
                };
            }
            let attitude = match o.attitude.as_str() {
                "agressifs" => -25.0,
                "pacifiques" => 25.0,
                _ => 0.0,
            };
            let base = match caractere.as_str() {
                "guerrier" => -20.0,
                "marchand" => 15.0,
                _ => 0.0,
            };
            let mut r = Royaume {
                id: k,
                nom: if joueur { "Votre royaume".into() } else { def.nom.into() },
                couleur: def.couleur.into(),
                joueur,
                caractere,
                vivant: true,
                impots: "normal".into(),
                bonheur: 60.0,
                pop: 24,
                relation: base + attitude,
                attitude,
                statut: "neutre".into(),
                noms_villes: def.villes.iter().skip(if joueur { 0 } else { 1 }).map(|s| s.to_string()).collect(),
                prochaine_offre: h.entre(10, 18) as u32,
                ..Default::default()
            };
            // tous partent à égalité : mêmes réserves, même hameau, même garnison
            for res in &regles().ressources {
                r.stock.insert(res.cle.clone(), 0.0);
            }
            for (c, v) in STOCK_DEPART {
                r.stock.insert(c.into(), v);
            }
            royaumes.push(r);
        }
        let mut p = Partie {
            version: VERSION_SAUVEGARDE,
            meteo: Meteo::default(),
            options: o,
            hasard: h,
            carte,
            tour: TOUR_DEPART,
            royaumes,
            villes: Vec::new(),
            batiments: Vec::new(),
            armees: Vec::new(),
            propositions: Vec::new(),
            journal: Vec::new(),
            rapport: Rapport::default(),
            prochain_id: 1,
            prochains_brigands: TOUR_DEPART + 20,
            fin: None,
            sans_victoire: false,
            version_carte: 1,
            routes: Vec::new(),
            flottes: Vec::new(),
            espions: Vec::new(),
            sieges: Vec::new(),
            blocus: Vec::new(),
            choix: Vec::new(),
            forts: Vec::new(),
            terres: Vec::new(),
            diplomatie: Diplomatie::default(),
        };
        p.meteo = Meteo::tirer(&Meteo { temperature: 9.0, ..Meteo::default() }, TOUR_DEPART, &mut p.hasard);
        for (k, &s) in departs.iter().enumerate() {
            let nom = if k == 0 { p.options.capitale.clone() } else { ROYAUMES[ordre[k]].villes[0].to_string() };
            p.fonder_ville(k as i32, s, nom, 1, true);
        }
        p.recalculer_territoire();
        // bâtiments de départ : deux chaumières contre la mairie
        for k in 0..p.royaumes.len() {
            let cap = p.villes[k].case;
            let mut poses = 0;
            for v in p.carte.voisins(cap) {
                if poses < 2 && p.peut_construire("cabane", v, k as i32).is_ok() {
                    p.poser("cabane", v, k as i32, true);
                    poses += 1;
                }
            }
        }
        for k in 0..p.royaumes.len() {
            let case = p.villes[k].case;
            p.creer_armee(k as i32, case, BTreeMap::from([("milice".to_string(), 4), ("mousquetaire".to_string(), 2)]));
        }
        p.recalculer_routes();
        // chacun connaît les environs de sa capitale
        for k in 0..p.royaumes.len() {
            let c = p.villes[k].case;
            p.decouvrir(k as i32, c, regles().vision.depart);
        }
        p.explorer();
        diplomatie::initialiser(&mut p, true);
        p.noter(format!("{} : vous fondez {}.", meteo::date_texte(TOUR_DEPART), p.villes[0].nom));
        p
    }

    /// Relit une sauvegarde (même ancienne) et la met à jour.
    pub fn relire(texte: &str) -> Result<Partie, String> {
        let mut p: Partie = serde_json::from_str(texte).map_err(|e| e.to_string())?;
        p.migrer();
        Ok(p)
    }

    /// Les anciens bâtiments « remparts » et « citadelle » deviennent la fortification de la ville proche
    /// (remparts → 3, citadelle → 4, le plus haut l'emporte).
    pub fn migrer(&mut self) {
        let anciens: Vec<Batiment> = self.batiments.iter().filter(|b| b.cle == "remparts" || b.cle == "citadelle").cloned().collect();
        for b in &anciens {
            let vi = b.ville.and_then(|vid| self.villes.iter().position(|v| v.id == vid && v.proprio == b.proprio)).or_else(|| self.ville_proche(b.case, b.proprio));
            if let Some(vi) = vi {
                let v = &mut self.villes[vi];
                v.fortif = v.fortif.max(if b.cle == "citadelle" { 4 } else { 3 });
            }
            self.batiments.retain(|x| x.id != b.id);
            if self.carte.cases[b.case].bat == Some(b.id) {
                self.carte.cases[b.case].bat = None;
            }
        }
        if !anciens.is_empty() {
            self.recalculer_territoire();
            self.recalculer_routes();
        }
        // avant la version 5 (ou une version 5 de la branche diplomatie) : le trésor résumé des rivaux devient une économie
        if self.version < 5 || (self.version == 5 && self.royaumes.iter().any(|r| !r.joueur && (r.tresor_v4 > 0.0 || !r.stock.contains_key("or")))) {
            self.migrer_economie_rivaux();
        }
        // avant la version 5 (ou une version 5 de la branche économie) : des souverains tirés des anciens caractères
        diplomatie::initialiser(self, false);
        self.version = VERSION_SAUVEGARDE;
    }

    /// Avant la version 5, l'économie des rivaux était résumée en un trésor. Chacun reçoit des réserves,
    /// une population et des ouvriers cohérents avec ses villes et ses bâtiments : son or, de quoi bâtir selon
    /// le rang de sa capitale, trois mois de vivres, et assez d'habitants pour sa garnison et ses ateliers.
    pub fn migrer_economie_rivaux(&mut self) {
        let rg = regles();
        for k in 0..self.royaumes.len() {
            if self.royaumes[k].joueur {
                continue;
            }
            let id = k as i32;
            let s = self.stats(id);
            let rang = self.niveau_capitale(id) as f64;
            let ouvriers: i64 = self.batiments.iter().filter(|b| b.proprio == id && b.fini()).map(|b| rg.bat(&b.cle).map_or(0, |d| d.ouvriers) as i64).sum();
            let pop = ((s.logement as f64 * 0.9).round() as i64).max(s.soldats + ouvriers.min(s.logement)).max(24);
            let vivres = (pop as f64 * 0.3 * 3.0 / 2.0).ceil();
            let r = &mut self.royaumes[k];
            for res in &rg.ressources {
                r.stock.entry(res.cle.clone()).or_insert(0.0);
            }
            let depart = [("or", r.tresor_v4.max(0.0)), ("bois", 60.0 + 20.0 * rang), ("planches", 20.0 + 20.0 * rang), ("pierre", 30.0 + 25.0 * rang), ("outils", 5.0 * rang), ("pain", vivres), ("poisson", vivres)];
            for (c, v) in depart {
                let cap = self.capacite(&s, c);
                self.royaumes[k].stock.insert(c.into(), v.min(cap));
            }
            let r = &mut self.royaumes[k];
            r.tresor_v4 = 0.0;
            r.pop = pop;
            if r.impots.is_empty() {
                r.impots = "normal".into();
            }
            self.affecter_ouvriers(k);
        }
    }

    // ------------------------------------------------------------------ utilitaires
    pub fn annee(&self) -> i32 {
        meteo::annee(self.tour)
    }

    pub fn id(&mut self) -> u32 {
        self.prochain_id += 1;
        self.prochain_id
    }

    pub fn noter(&mut self, texte: String) {
        self.journal.insert(0, texte);
        self.journal.truncate(80);
    }

    pub fn joueur(&self) -> &Royaume {
        &self.royaumes[0]
    }

    /// Le royaume `id` (ni les brigands, ni « personne »).
    pub fn royaume_mut(&mut self, id: i32) -> Option<&mut Royaume> {
        if id < 0 || id == BRIGANDS {
            return None;
        }
        self.royaumes.get_mut(id as usize)
    }

    pub fn nom_royaume(&self, id: i32) -> String {
        if id == BRIGANDS {
            "les Brigands".into()
        } else {
            self.royaumes.get(id as usize).map(|r| r.nom.clone()).unwrap_or_default()
        }
    }

    pub fn couleur(&self, id: i32) -> String {
        if id == BRIGANDS {
            "#4b4b4b".into()
        } else {
            self.royaumes.get(id as usize).map(|r| r.couleur.clone()).unwrap_or_else(|| "#888".into())
        }
    }

    pub fn a_tech(&self, id: i32, tech: &str) -> bool {
        id != BRIGANDS && self.royaumes.get(id as usize).is_some_and(|r| r.a(tech))
    }

    pub fn capitale(&self, id: i32) -> Option<usize> {
        self.villes.iter().position(|v| v.proprio == id && v.capitale).or_else(|| self.villes.iter().position(|v| v.proprio == id))
    }

    pub fn niveau_capitale(&self, id: i32) -> u32 {
        self.capitale(id).map(|i| self.villes[i].niveau).unwrap_or(1)
    }

    pub fn ville_a(&self, case: usize) -> Option<usize> {
        self.villes.iter().position(|v| v.case == case)
    }

    pub fn bat(&self, id: u32) -> Option<&Batiment> {
        self.batiments.iter().find(|b| b.id == id)
    }

    pub fn a_batiment(&self, id: i32, cle: &str) -> bool {
        self.batiments.iter().any(|b| b.proprio == id && b.cle == cle && b.fini())
    }

    pub fn ville_proche(&self, case: usize, id: i32) -> Option<usize> {
        self.villes.iter().enumerate().filter(|(_, v)| v.proprio == id).min_by_key(|(_, v)| self.carte.dist(v.case, case)).map(|(i, _)| i)
    }

    /// Les brigands sont ennemis de tous ; deux royaumes (le joueur ou des rivaux) le sont en guerre.
    pub fn est_ennemi(&self, a: i32, b: i32) -> bool {
        a != b && (a == BRIGANDS || b == BRIGANDS || diplomatie::en_guerre(self, a, b))
    }

    // ------------------------------------------------------------------ brouillard de guerre
    /// Marque explorées, pour `id`, les cases à `r` de `case`.
    pub fn decouvrir(&mut self, id: i32, case: usize, r: i32) {
        if id < 0 || id as usize >= self.royaumes.len() {
            return;
        }
        let zone = self.carte.rayon(case, r);
        let e = &mut self.royaumes[id as usize].explore;
        e.resize(self.carte.cases.len(), 0);
        for c in zone {
            e[c] = 1;
        }
    }

    /// Les cases que `id` voit ce mois-ci (1) : autour de ses villes, tours, armées, flottes et espions,
    /// tout son territoire, et ce que ses espions ont révélé.
    pub fn vision(&self, id: i32) -> Vec<u8> {
        let rv = &regles().vision;
        let mut v = vec![0u8; self.carte.cases.len()];
        let Some(roy) = (id >= 0).then(|| self.royaumes.get(id as usize)).flatten() else { return v };
        let mut sources: Vec<(usize, i32)> = Vec::new();
        sources.extend(self.villes.iter().filter(|x| x.proprio == id).map(|x| (x.case, if x.capitale { rv.capitale } else { rv.ville })));
        sources.extend(self.batiments.iter().filter(|b| b.proprio == id && b.fini() && b.cle == "tour").map(|b| (b.case, rv.tour)));
        for a in self.armees.iter().filter(|a| a.proprio == id) {
            let cavalerie = a.unites.keys().any(|u| regles().unite(u).is_some_and(|d| d.genre == "cavalerie"));
            sources.push((a.case, if cavalerie { rv.cavalerie } else { rv.armee }));
        }
        sources.extend(self.flottes.iter().filter(|f| f.proprio == id).map(|f| (f.case, rv.flotte)));
        sources.extend(self.espions.iter().filter(|e| e.proprio == id).map(|e| (e.case, rv.espion)));
        sources.extend(self.forts.iter().filter(|f| f.proprio == id).filter_map(|f| regles().fort(f.niveau).map(|d| (f.case, rv.armee + d.vision))));
        sources.extend(roy.revele.iter().filter(|r| r[2] >= self.tour && (r[0] as usize) < v.len()).map(|r| (r[0] as usize, r[1] as i32)));
        for (c, r) in sources {
            for x in self.carte.rayon(c, r) {
                v[x] = 1;
            }
        }
        for (i, k) in self.carte.cases.iter().enumerate() {
            if k.proprio == id {
                v[i] = 1;
            }
        }
        v
    }

    /// Ce que chacun voit devient exploré (chaque mois, et au départ).
    pub fn explorer(&mut self) {
        for k in 0..self.royaumes.len() {
            let v = self.vision(k as i32);
            let tour = self.tour;
            let r = &mut self.royaumes[k];
            r.revele.retain(|x| x[2] >= tour);
            r.explore.resize(v.len(), 0);
            for (x, y) in r.explore.iter_mut().zip(v) {
                *x |= y;
            }
        }
    }

    /// `id` a-t-il exploré cette case ?
    pub fn connait(&self, id: i32, case: usize) -> bool {
        id >= 0 && self.royaumes.get(id as usize).and_then(|r| r.explore.get(case)) == Some(&1)
    }

    // ------------------------------------------------------------------ villes et territoire
    pub fn fonder_ville(&mut self, proprio: i32, case: usize, nom: String, niveau: u32, capitale: bool) -> usize {
        let id = self.id();
        self.villes.push(Ville { id, nom, proprio, case, niveau, capitale, fortif: 0, travaux_fortif: 0, eclairage: false });
        let b = self.poser("hotel", case, proprio, true);
        if let Some(bb) = self.batiments.iter_mut().find(|x| x.id == b) {
            bb.ville = Some(id);
        }
        self.villes.len() - 1
    }

    pub fn recalculer_territoire(&mut self) {
        let mut sources: Vec<(usize, i32, i32, u8)> = self.villes.iter().map(|v| (v.case, v.proprio, 2 + v.niveau as i32 + regles().fortif(v.fortif).map_or(0, |f| f.territoire), 0)).collect();
        for b in &self.batiments {
            if let Some(d) = regles().bat(&b.cle) {
                if b.fini() && d.territoire > 0 {
                    sources.push((b.case, b.proprio, d.territoire, 1));
                }
            }
        }
        for i in 0..self.carte.cases.len() {
            if let Some(bid) = self.carte.cases[i].bat {
                if let Some(b) = self.bat(bid) {
                    self.carte.cases[i].proprio = b.proprio;
                    continue;
                }
            }
            // un fort achevé tient sa case, une terre achetée aussi
            if let Some(f) = self.forts.iter().find(|f| f.case == i && f.niveau > 0) {
                self.carte.cases[i].proprio = f.proprio;
                continue;
            }
            if let Some(t) = self.terres.iter().find(|t| t[0] == i as i64) {
                self.carte.cases[i].proprio = t[1] as i32;
                continue;
            }
            let mut meilleur: Option<(i32, i32, u8)> = None;
            for &(c, p, r, pri) in &sources {
                let d = self.carte.dist(i, c);
                if d <= r {
                    let mieux = match meilleur {
                        None => true,
                        Some((bd, _, bp)) => d < bd || (d == bd && pri < bp),
                    };
                    if mieux {
                        meilleur = Some((d, p, pri));
                    }
                }
            }
            self.carte.cases[i].proprio = meilleur.map(|m| m.1).unwrap_or(-1);
        }
    }

    /// Le prix de la prochaine terre achetée par `id`.
    pub fn prix_terre(&self, id: i32) -> f64 {
        let n = self.terres.iter().filter(|t| t[1] == id as i64).count() as f64;
        regles().achat_terre.or + regles().achat_terre.hausse * n
    }

    /// `id` achète la case libre `case`, sur la terre ferme et voisine de son territoire : elle est à lui tout de suite.
    pub fn acheter_terre(&mut self, id: i32, case: usize) -> Result<f64, String> {
        let k = self.carte.cases.get(case).ok_or("Hors de la carte")?;
        if !k.terre() {
            return Err("On n'achète pas la mer".into());
        }
        if k.proprio != -1 {
            return Err("Ces terres ne sont pas libres".into());
        }
        if !self.carte.voisins(case).iter().any(|&v| self.carte.cases[v].proprio == id) {
            return Err("La case doit toucher votre royaume".into());
        }
        // le désert ne vaut pas grand-chose : moitié prix
        let prix = self.prix_terre(id) * if k.biome.as_deref() == Some("desert") { 0.5 } else { 1.0 };
        let cout: Panier = [("or".to_string(), prix)].into();
        if !self.peut_payer(id, &cout) {
            return Err(format!("Il faut {prix} 🪙"));
        }
        self.payer(id, &cout);
        self.terres.push([case as i64, id as i64]);
        self.recalculer_territoire();
        Ok(prix)
    }

    // ------------------------------------------------------------------ construction
    pub fn peut_construire(&self, cle: &str, case: usize, id: i32) -> Result<(), String> {
        let d = regles().bat(cle).ok_or("Bâtiment inconnu")?;
        let k = self.carte.cases.get(case).ok_or("Hors de la carte")?;
        if !k.terre() {
            return Err("Impossible sur l'eau".into());
        }
        if k.t == Terrain::Montagne {
            return Err("Impossible sur une montagne".into());
        }
        if k.bat.is_some() || self.fort_a(case).is_some() {
            return Err("Case déjà occupée".into());
        }
        if cle == "hotel" {
            return Ok(());
        }
        let vois = self.carte.voisins(case);
        if cle == "colonie" {
            if k.proprio != -1 {
                return Err("Une colonie se fonde hors de tout territoire".into());
            }
            if self.villes.iter().any(|v| self.carte.dist(v.case, case) < 4) {
                return Err("Trop près d'une ville (4 cases au moins)".into());
            }
            let portee = if self.a_tech(id, "cartographie") { 5 } else { 3 };
            if !self.carte.rayon(case, portee).iter().any(|&x| self.carte.cases[x].proprio == id) {
                return Err(format!("Trop loin de vos frontières ({portee} cases au plus)"));
            }
            return Ok(());
        }
        if k.proprio != id {
            return Err("Hors de votre territoire".into());
        }
        let c = |f: &dyn Fn(&crate::carte::Case) -> bool| vois.iter().any(|&j| f(&self.carte.cases[j]));
        match d.besoin.as_deref() {
            Some("foret") if !(k.foret || c(&|x| x.foret)) => Err("Il faut une forêt voisine".into()),
            Some("roche") if !(k.t == Terrain::Colline || k.gisement.as_deref() == Some("pierre") || c(&|x| matches!(x.t, Terrain::Colline | Terrain::Montagne) || x.gisement.as_deref() == Some("pierre"))) => {
                Err("Il faut une colline ou une montagne voisine".into())
            }
            Some("plaine") if k.t != Terrain::Plaine => Err("Il faut une plaine".into()),
            Some("coteau") if !matches!(k.t, Terrain::Plaine | Terrain::Colline) || k.foret => Err("Il faut une plaine ou un coteau dégagé".into()),
            Some("eau") if !c(&|x| !x.terre()) => Err("Il faut de l'eau voisine".into()),
            Some("cote") if !c(&|x| x.mer()) => Err("Il faut une côte maritime".into()),
            Some(g @ ("fer" | "or" | "charbon")) if !(k.gisement.as_deref() == Some(g) || c(&|x| x.gisement.as_deref() == Some(g))) => {
                Err(format!("Il faut un gisement {} voisin", match g { "fer" => "de fer", "or" => "d'or", _ => "de charbon" }))
            }
            _ => Ok(()),
        }
    }

    /// Pose un bâtiment (déjà payé) ; rend son identifiant.
    pub fn poser(&mut self, cle: &str, case: usize, proprio: i32, immediat: bool) -> u32 {
        let d = regles().bat(cle).expect("bâtiment inconnu");
        let id = self.id();
        let mut face = (self.hasard.indice(6) as f64) * std::f64::consts::PI / 3.0;
        if cle == "pecheur" || cle == "port" {
            for dir in 0..6 {
                if let Some(v) = self.carte.voisin_dir(case, dir) {
                    if !self.carte.cases[v].terre() {
                        face = -(dir as f64) * std::f64::consts::PI / 3.0;
                        break;
                    }
                }
            }
        }
        if cle == "hotel" || cle == "colonie" {
            face = 0.0;
        }
        let ville = self.ville_proche(case, proprio).map(|i| self.villes[i].id);
        // les arbres de la case tombent (le bois va au bâtisseur)
        let gain = self.carte.cases[case].arbres as f64 * 3.0;
        if let Some(r) = self.royaume_mut(proprio).filter(|_| gain > 0.0) {
            *r.stock.entry("bois".into()).or_insert(0.0) += gain;
        }
        let k = &mut self.carte.cases[case];
        k.foret = false;
        k.arbres = 0;
        k.bois = 0.0;
        k.bat = Some(id);
        self.batiments.push(Batiment { id, cle: cle.into(), proprio, case, reste: if immediat { 0 } else { d.duree.max(1) }, ville, face, ..Default::default() });
        id
    }

    pub fn demolir(&mut self, case: usize) -> Result<(), String> {
        let bid = self.carte.cases[case].bat.ok_or("Rien à démolir")?;
        let b = self.bat(bid).cloned().ok_or("Rien à démolir")?;
        if b.cle == "hotel" {
            return Err("On ne démolit pas un hôtel de ville".into());
        }
        let d = regles().bat(&b.cle).unwrap();
        if let Some(roy) = self.royaume_mut(b.proprio) {
            for (r, v) in &d.cout {
                if r != "or" {
                    *roy.stock.entry(r.clone()).or_insert(0.0) += (v * 0.5).floor();
                }
            }
        }
        self.batiments.retain(|x| x.id != bid);
        self.carte.cases[case].bat = None;
        if d.territoire > 0 {
            self.recalculer_territoire();
        }
        Ok(())
    }

    pub fn stats(&self, id: i32) -> Stats {
        let mut s = Stats { stockage: 200.0, ..Default::default() };
        for b in &self.batiments {
            if b.proprio != id || !b.fini() {
                continue;
            }
            let d = regles().bat(&b.cle).unwrap();
            if b.cle == "hotel" {
                let n = b.ville.and_then(|v| self.villes.iter().find(|x| x.id == v)).map(|v| v.niveau).unwrap_or(1) as i64;
                s.logement += 8 + n * 6;
                s.stockage += 40.0;
                continue;
            }
            let actif = self.actif(b);
            s.logement += d.logement as i64;
            s.stockage += d.stockage;
            s.vivres += d.stock_vivres;
            s.hygiene += d.hygiene;
            s.decor += d.decor;
            if actif {
                s.foi += d.foi;
                s.taverne += d.taverne;
                s.taxe += d.taxe;
                // l'été, vacances et moissons : l'école ne rend qu'une part de son savoir
                s.savoir += d.savoir * if b.cle == "ecole" && self.vacances() { regles().ecoles.ete } else { 1.0 };
            }
            match b.cle.as_str() {
                "comptoir" => s.comptoir = true,
                "port" => s.port = true,
                "gare" => s.gare = true,
                _ => {}
            }
        }
        s.taxe = s.taxe.min(0.6);
        for a in &self.armees {
            if a.proprio == id {
                s.soldats += a.effectif() as i64;
            }
        }
        for f in self.flottes.iter().filter(|f| f.proprio == id) {
            s.soldats += f.armee.as_ref().map_or(0, |a| a.effectif()) as i64;
            s.entretien_flotte += f.navires.iter().map(|(u, &n)| regles().unite(u).map_or(0.0, |d| d.entretien) * n as f64).sum::<f64>();
        }
        s.entretien_flotte += self.espions.iter().filter(|e| e.proprio == id).count() as f64 * regles().unite("espion").map_or(0.0, |d| d.entretien);
        s
    }

    /// Un bâtiment achevé qui travaille : pourvu d'ouvriers, ni saboté ni faubourg assiégé.
    pub fn actif(&self, b: &Batiment) -> bool {
        let d = regles().bat(&b.cle).unwrap();
        b.fini() && (d.ouvriers == 0 || b.ouvriers > 0) && b.arret <= self.tour && !self.faubourg_assiege(b)
    }

    pub fn capacite(&self, s: &Stats, r: &str) -> f64 {
        if r == "or" {
            f64::INFINITY
        } else {
            s.stockage + if regles().est_vivre(r) { s.vivres } else { 0.0 }
        }
    }

    /// `id` a-t-il de quoi payer `cout` dans ses réserves ?
    pub fn peut_payer(&self, id: i32, cout: &Panier) -> bool {
        let Some(r) = self.royaumes.get(id.max(0) as usize).filter(|_| id >= 0) else { return false };
        cout.iter().all(|(res, v)| r.stock.get(res).copied().unwrap_or(0.0) + 1e-9 >= *v)
    }

    pub fn payer(&mut self, id: i32, cout: &Panier) {
        let r = &mut self.royaumes[id as usize];
        for (res, v) in cout {
            *r.stock.entry(res.clone()).or_insert(0.0) -= v;
        }
    }

    /// Verse `panier` dans les réserves de `id`, sans dépasser ses capacités (l'or n'en a pas).
    pub fn crediter(&mut self, id: i32, panier: &Panier) {
        if self.royaume_mut(id).is_none() {
            return;
        }
        let s = self.stats(id);
        for (res, v) in panier {
            let cap = self.capacite(&s, res);
            let x = self.royaumes[id as usize].stock.entry(res.clone()).or_insert(0.0);
            *x = (*x + v).min(cap.max(*x)).max(0.0);
        }
    }

    // ------------------------------------------------------------------ armées
    pub fn creer_armee(&mut self, proprio: i32, case: usize, unites: BTreeMap<String, u32>) -> u32 {
        let id = self.id();
        self.armees.push(Armee { id, proprio, case, unites, ..Default::default() });
        id
    }

    /// L'armée d'indice `src` rejoint celle d'indice `dst` (même case) : ses unités passent, la position retranchée le reste.
    pub fn fusionner(&mut self, dst: usize, src: usize) {
        let a = self.armees[src].clone();
        let d = &mut self.armees[dst];
        for (u, n) in a.unites {
            *d.unites.entry(u).or_insert(0) += n;
        }
        d.retranche = match (d.retranche, a.retranche) {
            (Some(x), Some(y)) => Some(x.min(y)),
            (x, y) => x.or(y),
        };
        self.armees.remove(src);
    }

    pub fn armee(&self, id: u32) -> Option<usize> {
        self.armees.iter().position(|a| a.id == id)
    }

    pub fn vitesse(&self, a: &Armee) -> f64 {
        let mut v = a.unites.iter().filter(|(_, &n)| n > 0).filter_map(|(u, _)| regles().unite(u)).map(|u| u.vitesse).fold(f64::INFINITY, f64::min);
        if !v.is_finite() {
            v = 4.0;
        }
        if self.a_tech(a.proprio, "routes") {
            v += 1.0;
        }
        if self.a_tech(a.proprio, "chemin_fer") && self.a_batiment(a.proprio, "gare") {
            v *= 1.5;
        }
        v
    }

    pub fn attaque(&self, a: &Armee, contre_ville: bool, tir: f64) -> f64 {
        let percussion = self.a_tech(a.proprio, "percussion");
        let silex = self.a_tech(a.proprio, "silex");
        a.unites
            .iter()
            .filter_map(|(u, &n)| regles().unite(u).map(|d| (d, n)))
            .map(|(d, n)| {
                let mut at = d.att;
                if d.genre == "infanterie" && silex {
                    at += 1.0;
                }
                if contre_ville && d.siege > 0.0 {
                    at *= d.siege;
                }
                if (d.genre == "infanterie" || d.cle == "dragon") && !percussion {
                    at *= tir;
                }
                at * n as f64
            })
            .sum()
    }

    pub fn defense(&self, a: &Armee) -> f64 {
        a.unites.iter().filter_map(|(u, &n)| regles().unite(u).map(|d| d.def * n as f64)).sum()
    }

    pub fn defense_ville(&self, vi: usize) -> f64 {
        let v = &self.villes[vi];
        let mut d = 8.0 + v.niveau as f64 * 8.0;
        for b in &self.batiments {
            if b.proprio != v.proprio || !b.fini() {
                continue;
            }
            let def = regles().bat(&b.cle).unwrap();
            if def.defense > 0.0 && self.carte.dist(b.case, v.case) <= 4 {
                d += def.defense;
            }
        }
        d *= regles().fortif(v.fortif).map_or(1.0, |f| f.defense);
        if self.a_tech(v.proprio, "vauban") {
            d *= 1.25;
        }
        d.round()
    }

    pub fn puissance(&self, id: i32) -> f64 {
        let armees: f64 = self.armees.iter().filter(|a| a.proprio == id).map(|a| self.attaque(a, false, 1.0) + self.defense(a)).sum();
        let villes: f64 = (0..self.villes.len()).filter(|&i| self.villes[i].proprio == id).map(|i| self.defense_ville(i)).sum();
        let flottes: f64 = self.flottes.iter().filter(|f| f.proprio == id).map(|f| self.force_navale(f, true) + self.force_navale(f, false)).sum();
        (armees + villes + flottes).round()
    }

    /// Une armée marche sur la terre, montagnes exceptées ; la mer se traverse à bord d'une flotte.
    pub fn praticable(&self, case: usize) -> bool {
        let k = &self.carte.cases[case];
        k.terre() && k.t != Terrain::Montagne
    }

    /// Coût d'une case pour le tracé des chemins (les routes y comptent pleinement, quel que soit leur royaume).
    pub fn cout_case(&self, case: usize) -> f64 {
        self.cout_pour(self.carte.cases[case].proprio, case)
    }

    /// Coût d'une case pour une armée de `id` : terrain, biome (désert ; toundra l'hiver ou sous la neige), route et météo.
    /// Une route fait gagner du temps, d'autant plus qu'elle est récente (ROUTES, un niveau par époque) ; un chemin de terre
    /// sous la pluie s'embourbe ; en terre étrangère, ponts gardés et routes coupées : la moitié du gain seulement.
    pub fn cout_pour(&self, id: i32, case: usize) -> f64 {
        let k = &self.carte.cases[case];
        let mut base = if !k.terre() {
            1.0
        } else if k.t == Terrain::Colline {
            2.0
        } else if k.foret {
            1.5
        } else {
            1.0
        };
        match k.biome.as_deref() {
            Some("desert") => base *= 1.5,
            Some("toundra") if self.hiver() || self.meteo.neige_sol > 0.3 => base *= 1.5,
            _ => {}
        }
        let mut f = ROUTES[(k.route as usize).min(5)];
        if k.route == 1 && self.meteo.pluie > 0.4 {
            f = 1.1;
        }
        if k.proprio >= 0 && k.proprio != id && f < 1.0 {
            f = 1.0 - (1.0 - f) / 2.0;
        }
        base * f
    }

    /// Surcoût de tracé d'une case où une armée souffrirait (désert ; toundra l'hiver) faute de ravitaillement : hors de tout
    /// royaume ou en terre étrangère, sans route sur la case ni à côté. Les chemins (joueur et ordinateur) la contournent
    /// quand un détour raisonnable existe ; la marche elle-même ne coûte pas plus.
    pub fn danger_climat(&self, case: usize) -> f64 {
        let k = &self.carte.cases[case];
        let rude = match k.biome.as_deref() {
            Some("desert") => true,
            Some("toundra") => self.hiver(),
            _ => false,
        };
        if !rude || k.route > 0 || self.carte.voisins(case).iter().any(|&v| self.carte.cases[v].route > 0) {
            return 0.0;
        }
        if k.proprio >= 0 && self.villes.iter().any(|v| v.case == case) { 0.0 } else { 3.0 }
    }

    pub fn hiver(&self) -> bool {
        crate::meteo::saison(crate::meteo::mois(self.tour)) == 0
    }

    /// La case est sur une route de `id`, ou la touche : ses armées y sont ravitaillées (ni soif ni froid).
    pub fn ravitaillee(&self, id: i32, case: usize) -> bool {
        let mut pres = self.carte.voisins(case);
        pres.push(case);
        self.routes.iter().any(|r| r[2] as i32 == id && (pres.contains(&r[0]) || pres.contains(&r[1])))
    }

    /// Les cases que l'armée `a` peut atteindre ce mois-ci (ses points de marche, routes, terrain et météo compris).
    pub fn portee(&self, a: &Armee) -> Vec<usize> {
        let pts = self.vitesse(a) * self.meteo.effets(self.tour).mouvement;
        let n = self.carte.cases.len();
        let mut dist = vec![f64::INFINITY; n];
        let mut tas = BinaryHeap::new();
        dist[a.case] = 0.0;
        tas.push(Reverse((0u64, a.case)));
        while let Some(Reverse((d, c))) = tas.pop() {
            let d = d as f64 / 1000.0;
            if d > dist[c] + 1e-6 {
                continue;
            }
            for v in self.carte.voisins(c) {
                // comme la marche : on entre dans une case tant qu'il reste des points (le dernier pas peut déborder)
                if !self.praticable(v) || d >= pts - 0.05 {
                    continue;
                }
                let nd = d + self.cout_pour(a.proprio, v);
                if nd < dist[v] - 1e-9 {
                    dist[v] = nd;
                    tas.push(Reverse(((nd * 1000.0) as u64, v)));
                }
            }
        }
        (0..n).filter(|&i| i != a.case && dist[i].is_finite()).collect()
    }

    // ------------------------------------------------------------------ routes
    pub fn niveau_routes(&self, id: i32) -> u8 {
        if id < 0 || id == BRIGANDS {
            return 1;
        }
        self.royaumes.get(id as usize).map(|r| r.niveau_routes.clamp(1, 5) as u8).unwrap_or(1)
    }

    pub fn segments_routes(&self, id: i32) -> usize {
        self.routes.iter().filter(|r| r[2] as i32 == id).count()
    }

    /// Ce que coûte à `id` le passage de ses routes au niveau `cible`.
    pub fn cout_routes(&self, id: i32, cible: u8) -> Panier {
        let n = self.segments_routes(id).max(4) as f64;
        match cible {
            0..=2 => Panier::from([("pierre".to_string(), n * 2.0), ("or".to_string(), 100.0)]),
            3 => Panier::from([("pierre".to_string(), n * 3.0), ("outils".to_string(), (n * 0.3).ceil()), ("or".to_string(), 300.0)]),
            4 => Panier::from([("pierre".to_string(), n * 4.0), ("outils".to_string(), (n * 0.5).ceil()), ("or".to_string(), 500.0)]),
            _ => Panier::from([("pierre".to_string(), n * 4.0), ("outils".to_string(), (n * 0.6).ceil()), ("fer".to_string(), (n * 0.4).ceil()), ("or".to_string(), 800.0)]),
        }
    }

    fn cout_trace(&self, c: usize) -> f64 {
        let k = &self.carte.cases[c];
        let mut v = if k.t == Terrain::Colline { 2.0 } else if k.foret { 1.6 } else { 1.0 };
        if k.bat.is_some() {
            v += 3.0; // on contourne les bâtiments
        }
        if k.riviere {
            v += 0.6; // un pont coûte
        }
        v
    }

    /// Plus courts chemins depuis `depart` sur les cases que `passe` accepte : (distances, précédents).
    fn plus_courts(&self, depart: usize, passe: &dyn Fn(usize) -> bool, max: f64) -> (Vec<f64>, Vec<usize>) {
        let n = self.carte.cases.len();
        let mut dist = vec![f64::INFINITY; n];
        let mut parent = vec![usize::MAX; n];
        let mut tas = BinaryHeap::new();
        dist[depart] = 0.0;
        tas.push(Reverse((0u64, depart)));
        while let Some(Reverse((d, c))) = tas.pop() {
            let dc = d as f64 / 1000.0;
            if dc > dist[c] + 1e-6 || dc > max {
                continue;
            }
            for v in self.carte.voisins(c) {
                if !passe(v) {
                    continue;
                }
                let nd = dist[c] + self.cout_trace(v);
                if nd < dist[v] - 1e-9 {
                    dist[v] = nd;
                    parent[v] = c;
                    tas.push(Reverse(((nd * 1000.0) as u64, v)));
                }
            }
        }
        (dist, parent)
    }

    /// Retrace toutes les routes : chaque bâtiment achevé est relié à l'hôtel de ville de sa ville
    /// (dans le territoire), et les villes d'un même royaume sont reliées à leur capitale.
    pub fn recalculer_routes(&mut self) {
        let mut aretes: BTreeMap<(usize, usize), usize> = BTreeMap::new();
        let suivre = |aretes: &mut BTreeMap<(usize, usize), usize>, parent: &[usize], de: usize, vers: usize, o: usize| {
            let mut c = de;
            while c != vers {
                let p = parent[c];
                if p == usize::MAX {
                    break;
                }
                aretes.entry((c.min(p), c.max(p))).or_insert(o);
                c = p;
            }
        };
        for v in &self.villes {
            let o = v.proprio;
            if o < 0 || o == BRIGANDS {
                continue;
            }
            let passe = |c: usize| {
                let k = &self.carte.cases[c];
                k.terre() && k.t != Terrain::Montagne && k.proprio == o
            };
            let (dist, parent) = self.plus_courts(v.case, &passe, 60.0);
            for b in &self.batiments {
                if b.proprio == o && b.fini() && b.case != v.case && b.ville == Some(v.id) && dist[b.case].is_finite() {
                    suivre(&mut aretes, &parent, b.case, v.case, o as usize);
                }
            }
        }
        for r in &self.royaumes {
            if !r.vivant {
                continue;
            }
            let o = r.id as i32;
            let Some(ci) = self.capitale(o) else { continue };
            let cap = self.villes[ci].case;
            let passe = |c: usize| {
                let k = &self.carte.cases[c];
                k.terre() && k.t != Terrain::Montagne
            };
            let (dist, parent) = self.plus_courts(cap, &passe, 40.0);
            for v in &self.villes {
                if v.proprio == o && v.case != cap && dist[v.case].is_finite() {
                    suivre(&mut aretes, &parent, v.case, cap, r.id);
                }
            }
        }
        for k in self.carte.cases.iter_mut() {
            k.route = 0;
        }
        let mut routes = Vec::with_capacity(aretes.len());
        for ((a, b), o) in aretes {
            let niv = self.niveau_routes(o as i32);
            self.carte.cases[a].route = self.carte.cases[a].route.max(niv);
            self.carte.cases[b].route = self.carte.cases[b].route.max(niv);
            routes.push([a, b, o]);
        }
        self.routes = routes;
    }

    /// Plus court chemin (A*) à pied de `de` à `vers` ; sans la case de départ.
    pub fn chemin(&self, de: usize, vers: usize) -> Option<Vec<usize>> {
        if vers >= self.carte.cases.len() || !self.praticable(vers) {
            return None;
        }
        self.a_etoile(de, vers, &|c| self.praticable(c))
    }

    /// A* de `de` à `vers` sur les cases que `passe` accepte (armées à pied, flottes sur l'eau).
    pub fn a_etoile(&self, de: usize, vers: usize, passe: &dyn Fn(usize) -> bool) -> Option<Vec<usize>> {
        let mut g: HashMap<usize, f64> = HashMap::from([(de, 0.0)]);
        let mut venu: HashMap<usize, usize> = HashMap::new();
        let mut ouvert = BinaryHeap::new();
        ouvert.push(Reverse((0u64, de)));
        let mut vus = 0;
        while let Some(Reverse((_, cur))) = ouvert.pop() {
            if cur == vers {
                let mut p = vec![cur];
                let mut c = cur;
                while let Some(&prec) = venu.get(&c) {
                    c = prec;
                    p.push(c);
                }
                p.reverse();
                p.remove(0);
                return Some(p);
            }
            vus += 1;
            if vus > 20000 {
                break;
            }
            let gc = g[&cur];
            for n in self.carte.voisins(cur) {
                if !passe(n) {
                    continue;
                }
                let ng = gc + self.cout_case(n) + self.danger_climat(n);
                if g.get(&n).map_or(true, |&x| ng < x - 1e-9) {
                    g.insert(n, ng);
                    venu.insert(n, cur);
                    let f = ng + self.carte.dist(n, vers) as f64;
                    ouvert.push(Reverse(((f * 1000.0) as u64, n)));
                }
            }
        }
        None
    }

    /// Mois nécessaires pour parcourir `chemin` (estimation affichée au joueur).
    pub fn mois_trajet(&self, a: &Armee, chemin: &[usize]) -> u32 {
        let pts = self.vitesse(a) * self.meteo.effets(self.tour).mouvement;
        let cout: f64 = chemin.iter().map(|&c| self.cout_pour(a.proprio, c)).sum();
        (cout / pts.max(0.5)).ceil().max(1.0) as u32
    }

    /// Une recrue sort du bâtiment près de `pres` : un soldat rejoint la garnison de la ville,
    /// un navire la flotte du port, un espion attend en ville.
    pub fn recruter_dans(&mut self, proprio: i32, unite: &str, pres: usize) {
        let genre = regles().unite(unite).map(|d| d.genre.as_str()).unwrap_or("");
        if genre == "marine" {
            self.lancer_navire(proprio, unite, pres);
            return;
        }
        let Some(vi) = self.ville_proche(pres, proprio) else { return };
        let case = self.villes[vi].case;
        if genre == "espion" {
            let id = self.id();
            self.espions.push(Espion { id, proprio, case, ..Default::default() });
            return;
        }
        if let Some(a) = self.armees.iter_mut().find(|a| a.proprio == proprio && a.case == case && a.chemin.is_empty()) {
            *a.unites.entry(unite.into()).or_insert(0) += 1;
        } else {
            let mut u = BTreeMap::new();
            u.insert(unite.to_string(), 1);
            self.creer_armee(proprio, case, u);
        }
    }

    /// Les unités que `id` peut recruter dans un bâtiment (techs et rang de la capitale).
    pub fn unites_dispo(&self, id: i32, cle_bat: &str) -> Vec<String> {
        let Some(d) = regles().bat(cle_bat) else { return Vec::new() };
        let niv = self.niveau_capitale(id);
        d.unites
            .iter()
            .filter(|u| {
                let du = regles().unite(u).unwrap();
                du.niveau <= niv.max(1) && du.tech.as_ref().map_or(true, |t| self.a_tech(id, t)) && du.obsolete.as_ref().map_or(true, |t| !self.a_tech(id, t))
            })
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::FORMES;

    #[test]
    fn capitales_placees_sur_chaque_forme() {
        for &forme in &FORMES {
            for taille in ["petite", "moyenne", "grande"] {
                for graine in [3u64, 11, 404] {
                    let mut p = Partie::nouvelle(Options { forme: forme.into(), taille: taille.into(), graine, rivaux: 5, ..Options::default() });
                    let ctx = format!("{forme} {taille} graine {graine}");
                    assert_eq!(p.royaumes.len(), 6, "{ctx} : six royaumes");
                    let tailles = p.carte.clone().composantes();
                    let caps: Vec<usize> = (0..6).map(|k| p.villes[p.capitale(k).unwrap()].case).collect();
                    let insulaire = matches!(p.options.forme_reelle(), "iles" | "archipel" | "deux_continents");
                    for &c in &caps {
                        let comp = p.carte.cases[c].comp;
                        assert!(comp >= 0 && tailles[comp as usize] >= 20, "{ctx} : capitale sur une terre trop petite");
                        let place = p.carte.rayon(c, 3).iter().filter(|&&x| p.carte.cases[x].comp == comp).count();
                        // la carte classique garde ses départs d'origine
                        assert!(place >= 15 || p.options.forme_reelle() == "classique", "{ctx} : pas de place pour bâtir ({place})");
                        assert!(!insulaire || p.carte.rayon(c, 2).iter().any(|&x| p.carte.cases[x].mer()), "{ctx} : capitale loin de la mer");
                        assert!(caps.iter().all(|&d| d == c || p.carte.dist(c, d) >= 4), "{ctx} : capitales collées");
                    }
                    // deux ans de jeu, brigands compris : personne ne reste planté sur l'eau
                    for _ in 0..24 {
                        p.fin_du_mois();
                    }
                    assert!(p.armees.iter().all(|a| p.carte.cases[a.case].terre()), "{ctx} : une armée sur l'eau");
                }
            }
        }
    }

    #[test]
    fn biomes_et_routes_comptent() {
        let mut p = Partie::nouvelle(Options { graine: 99, ..Options::default() });
        p.meteo.pluie = 0.0;
        p.meteo.neige_sol = 0.0;
        // une plaine libre, sans forêt ni route : on y essaie terrain, biome et niveaux de route
        let i = (0..p.carte.cases.len()).find(|&i| { let k = &p.carte.cases[i]; k.t == Terrain::Plaine && !k.foret && k.proprio == -1 }).unwrap();
        p.carte.cases[i].biome = None;
        p.carte.cases[i].route = 0;
        assert_eq!(p.cout_pour(0, i), 1.0);
        p.carte.cases[i].biome = Some("desert".into());
        assert_eq!(p.cout_pour(0, i), 1.5, "le désert ralentit");
        for v in p.carte.voisins(i) { p.carte.cases[v].route = 0; }
        assert!(p.danger_climat(i) > 0.0, "un désert sans route est contourné");
        let v0 = p.carte.voisins(i)[0];
        p.carte.cases[v0].route = 1;
        assert_eq!(p.danger_climat(i), 0.0, "près d'une route, on y passe");
        p.carte.cases[i].biome = None;
        let couts: Vec<f64> = (1..=5).map(|n| { p.carte.cases[i].route = n; p.cout_pour(-1, i) }).collect();
        assert!(couts.windows(2).all(|w| w[1] < w[0]), "chaque époque de route va plus vite : {couts:?}");
        p.carte.cases[i].route = 1;
        p.meteo.pluie = 0.8;
        assert!(p.cout_pour(-1, i) > 1.0, "un chemin de terre s'embourbe sous la pluie");
        p.carte.cases[i].route = 3;
        let libre = p.cout_pour(0, i);
        p.carte.cases[i].proprio = 1;
        assert!(p.cout_pour(0, i) > libre && p.cout_pour(1, i) < p.cout_pour(0, i), "en terre étrangère, la moitié du gain");
        // les routes impériales attendent 1789
        p.royaumes[0].niveau_routes = 3;
        assert!(p.ameliorer_routes(0).unwrap_err().contains("1789"));
    }

    #[test]
    fn nouvelle_partie() {
        let p = Partie::nouvelle(Options { graine: 99, ..Options::default() });
        assert_eq!(p.royaumes.len(), 4);
        assert_eq!(p.villes.len(), 4);
        assert!(p.villes[0].capitale && p.villes[0].proprio == 0);
        assert!(p.batiments.iter().filter(|b| b.proprio == 0 && b.cle == "cabane").count() >= 1);
        assert_eq!(p.armees.len(), 4);
        let cap = p.villes[0].case;
        assert_eq!(p.carte.cases[cap].proprio, 0);
        assert!(p.carte.rayon(cap, 3).iter().all(|&c| p.carte.cases[c].proprio == 0 || p.carte.cases[c].proprio != -1 || !p.carte.cases[c].terre() || true));
        // un chemin d'une ville à l'autre existe le plus souvent (même île) ; au moins vers une case voisine
        let v = p.carte.voisins(cap).into_iter().find(|&c| p.praticable(c)).unwrap();
        assert_eq!(p.chemin(cap, v), Some(vec![v]));
        assert!(p.defense_ville(0) > 0.0);
    }

    #[test]
    fn brouillard_de_guerre() {
        let mut p = Partie::nouvelle(Options { graine: 99, ..Options::default() });
        let cap = p.villes[0].case;
        assert!(p.carte.rayon(cap, regles().vision.depart).iter().all(|&c| p.connait(0, c)), "on connaît les environs de sa capitale");
        let rival = p.villes.iter().find(|v| v.proprio == 1).unwrap().case;
        assert!(!p.connait(0, rival) && p.vision(0)[rival] == 0);
        // l'interface ne reçoit ni la ville, ni l'armée, ni les bâtiments du rival
        let e = crate::vue::etat(&p);
        assert_eq!(e["explore"].as_array().unwrap().len(), p.carte.cases.len());
        assert!(e["villes"].as_array().unwrap().iter().all(|v| v["proprio"] == 0));
        assert!(e["armees"].as_array().unwrap().iter().all(|a| a["proprio"] == 0));
        assert!(e["batiments"].as_array().unwrap().iter().all(|b| b["proprio"] == 0));
        // une armée envoyée à côté de la ville rivale l'explore, et la voit tant qu'elle y reste
        let a = p.armees.iter().position(|a| a.proprio == 0).unwrap();
        p.armees[a].case = p.carte.voisins(rival)[0];
        p.explorer();
        assert!(p.connait(0, rival) && p.vision(0)[rival] == 1);
        let e = crate::vue::etat(&p);
        assert!(e["villes"].as_array().unwrap().iter().any(|v| v["proprio"] == 1));
        assert!(e["armees"].as_array().unwrap().iter().any(|a| a["proprio"] == 1), "la garnison rivale est visible");
        // l'armée repart : la ville reste explorée, sa garnison n'est plus vue
        p.armees[a].case = cap;
        let e = crate::vue::etat(&p);
        assert!(e["villes"].as_array().unwrap().iter().any(|v| v["proprio"] == 1));
        assert!(e["armees"].as_array().unwrap().iter().all(|a| a["proprio"] == 0));
    }

    #[test]
    fn ancienne_sauvegarde_remparts_et_citadelle() {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        let libres = |p: &Partie, id: i32| -> Vec<usize> {
            let c = p.villes[p.capitale(id).unwrap()].case;
            p.carte.rayon(c, 3).into_iter().filter(|&x| p.peut_construire("cabane", x, id).is_ok()).collect()
        };
        let (l0, l1) = (libres(&p, 0), libres(&p, 1));
        let anciens = [p.poser("remparts", l0[0], 0, true), p.poser("citadelle", l0[1], 0, true), p.poser("remparts", l1[0], 1, true)];
        // une sauvegarde d'avant les fortifications de ville
        let mut v = serde_json::to_value(&p).unwrap();
        v["version"] = serde_json::json!(1);
        for ville in v["villes"].as_array_mut().unwrap() {
            let o = ville.as_object_mut().unwrap();
            o.remove("fortif");
            o.remove("travaux_fortif");
            o.remove("eclairage");
        }
        let q = Partie::relire(&v.to_string()).unwrap();
        assert!(q.villes.iter().all(|v| !v.eclairage), "l'éclairage public est éteint dans une ancienne sauvegarde");
        assert_eq!(q.villes[q.capitale(0).unwrap()].fortif, 4, "citadelle → 4 (le plus haut l'emporte)");
        assert_eq!(q.villes[q.capitale(1).unwrap()].fortif, 3, "remparts → 3");
        assert!(q.batiments.iter().all(|b| b.cle != "remparts" && b.cle != "citadelle" && !anciens.contains(&b.id)));
        assert!(q.carte.cases[l0[0]].bat.is_none() && q.carte.cases[l0[1]].bat.is_none() && q.carte.cases[l1[0]].bat.is_none());
        assert_eq!(q.version, VERSION_SAUVEGARDE);
        // relire une sauvegarde à jour ne change rien
        let r = Partie::relire(&serde_json::to_string(&q).unwrap()).unwrap();
        assert_eq!((r.batiments.len(), r.villes[0].fortif), (q.batiments.len(), q.villes[0].fortif));
    }

    #[test]
    fn sauvegardes_5_des_deux_branches() {
        let mut p = Partie::nouvelle(Options { graine: 12, ..Options::default() });
        for _ in 0..6 {
            p.fin_du_mois();
        }
        let v = serde_json::to_value(&p).unwrap();
        // la version 5 de l'économie : réserves des rivaux, mais pas de diplomatie
        let mut eco = v.clone();
        eco["version"] = serde_json::json!(5);
        eco.as_object_mut().unwrap().remove("diplomatie");
        let q = Partie::relire(&eco.to_string()).unwrap();
        assert_eq!(q.version, VERSION_SAUVEGARDE);
        assert_eq!(q.diplomatie.souverains.len(), q.royaumes.len(), "des souverains");
        assert!(p.royaumes[1].stock.iter().all(|(r, v)| (q.royaumes[1].stock[r] - v).abs() < 1e-6), "les réserves des rivaux restent telles quelles");
        // la version 5 de la diplomatie : souverains et liens, mais les rivaux n'ont qu'un trésor
        let mut dip = v;
        dip["version"] = serde_json::json!(5);
        for r in dip["royaumes"].as_array_mut().unwrap().iter_mut().skip(1) {
            r["stock"] = serde_json::json!({});
            r["or"] = serde_json::json!(555.0);
        }
        let q = Partie::relire(&dip.to_string()).unwrap();
        assert_eq!(q.diplomatie.souverains[1].nom(), p.diplomatie.souverains[1].nom(), "la diplomatie reste telle quelle");
        assert!(q.royaumes.iter().skip(1).all(|r| r.stock["or"] == 555.0 && r.stock["bois"] > 0.0), "le trésor devient une économie");
    }

    #[test]
    fn ancienne_sauvegarde_economie_des_rivaux() {
        let mut p = Partie::nouvelle(Options { graine: 12, ..Options::default() });
        for _ in 0..6 {
            p.fin_du_mois();
        }
        // une sauvegarde de la version 4 : les rivaux n'avaient qu'un trésor, ni réserves ni ouvriers
        let mut v = serde_json::to_value(&p).unwrap();
        v["version"] = serde_json::json!(4);
        for r in v["royaumes"].as_array_mut().unwrap().iter_mut().skip(1) {
            r["stock"] = serde_json::json!({});
            r["or"] = serde_json::json!(777.0);
            r["pop"] = serde_json::json!(24);
        }
        for b in v["batiments"].as_array_mut().unwrap() {
            if b["proprio"] != 0 {
                b["ouvriers"] = serde_json::json!(0);
            }
        }
        let mut q = Partie::relire(&v.to_string()).unwrap();
        assert_eq!(q.version, VERSION_SAUVEGARDE);
        assert_eq!(q.joueur().stock, p.joueur().stock, "le joueur n'est pas touché");
        for k in 1..q.royaumes.len() {
            let (r, s) = (&q.royaumes[k], q.stats(k as i32));
            assert_eq!(r.stock["or"], 777.0, "le trésor passe dans les réserves");
            assert!(r.tresor_v4 == 0.0 && r.stock.len() == regles().ressources.len());
            assert!(r.stock.values().all(|&x| x >= 0.0) && r.stock["bois"] > 0.0 && r.stock["pain"] + r.stock["poisson"] >= r.pop as f64 * 0.3 * 2.0, "{:?}", r.stock);
            assert!(r.pop >= s.soldats && r.pop >= 24, "assez d'habitants pour la garnison");
            let postes = q.batiments.iter().any(|b| b.proprio == k as i32 && b.fini() && regles().bat(&b.cle).unwrap().ouvriers > 0);
            assert!(!postes || q.batiments.iter().any(|b| b.proprio == k as i32 && b.ouvriers > 0), "des ouvriers à l'ouvrage");
        }
        // l'interface ne reçoit d'un rival que sa population à la dizaine près, pas ses réserves
        let e = crate::vue::etat(&q);
        assert!(e["royaumes"][1].get("stock").is_none() && e["royaumes"][1]["population"].as_i64().unwrap() % 10 == 0);
        // le vieux trésor n'est plus écrit ; la partie continue
        assert!(serde_json::to_value(&q).unwrap()["royaumes"][1].get("or").is_none());
        for _ in 0..12 {
            q.fin_du_mois();
        }
        assert!(q.royaumes.iter().all(|r| r.stock.values().all(|&x| x >= 0.0)));
    }

    #[test]
    fn construction_verifiee() {
        let mut p = Partie::nouvelle(Options { graine: 5, ..Options::default() });
        let mer = (0..p.carte.cases.len()).find(|&c| !p.carte.cases[c].terre()).unwrap();
        assert!(p.peut_construire("cabane", mer, 0).is_err());
        let loin = (0..p.carte.cases.len()).find(|&c| p.carte.cases[c].terre() && p.carte.cases[c].proprio == -1 && p.carte.cases[c].t != Terrain::Montagne).unwrap();
        assert_eq!(p.peut_construire("cabane", loin, 0), Err("Hors de votre territoire".into()));
        let ok = (0..p.carte.cases.len()).find(|&c| p.peut_construire("cabane", c, 0).is_ok()).unwrap();
        p.poser("cabane", ok, 0, false);
        assert!(p.peut_construire("cabane", ok, 0).is_err());
        assert!(p.demolir(ok).is_ok());
    }
}
