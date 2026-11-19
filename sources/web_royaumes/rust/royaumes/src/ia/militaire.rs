//! L'intelligence militaire des royaumes de l'ordinateur. Chaque mois, avec ce qu'il sait (brouillard,
//! renseignement de ses espions) : il entretient ses troupes, juge les sièges (assaut, attente ou levée),
//! se replie devant plus fort que lui, répartit ses garnisons selon la menace, secourt ses places
//! assiégées, intercepte quand l'avantage est net, mène une campagne (choix de la proie, rassemblement,
//! marche groupée, détachements contre les forts de la route, débarquement escorté), compose son armée
//! selon l'adversaire et ses moyens, mène sa marine (blocus, chasse, fuite) et ses espions ; ses campagnes
//! visent le joueur comme les rivaux avec qui la diplomatie l'a mis en guerre.
//! La difficulté règle la qualité des décisions (`Qualite::jugement`), jamais un bonus : mêmes règles que le joueur.
//! Tout se paie par les ordres du joueur (commandes.rs), dans les vraies réserves du royaume, sous les garde-fous
//! de l'économie (`peut_depenser`) ; la solde est prélevée avec le reste de l'entretien (tour.rs).

use std::cmp::Reverse;
use std::collections::{BTreeMap, BinaryHeap, VecDeque};

use serde::{Deserialize, Serialize};

use super::diplomatie::{ennemis, traits};
use super::economie::peut_depenser;
use crate::carte::Terrain;
use crate::commandes::cout_recrue;
use crate::hasard::Hasard;
use crate::partie::{Partie, Rapport, BRIGANDS};
use crate::regles::regles;

/// Une armée vue à cette distance (en cases) menace la place.
const PORTEE: i32 = 7;
/// Une campagne qui n'aboutit pas en ce nombre de mois est abandonnée.
const DUREE_CAMPAGNE: u32 = 30;

/// Ce que l'IA militaire garde d'un mois sur l'autre (dans la sauvegarde du royaume).
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct EtatMilitaire {
    pub campagne: Option<Campagne>,
    /// mois de paix d'affilée (au-delà de deux ans, on démobilise)
    pub paix: u32,
    /// pas de nouvelle campagne avant ce tour
    pub repos: u32,
}

/// Une campagne : une place visée, un point de rassemblement, puis une armée principale en marche.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Campagne {
    /// la case de la place visée (ville ou fort) et son maître
    pub cible: usize,
    pub ennemi: i32,
    /// la case de la ville où l'armée se rassemble (un port pour une campagne par mer)
    pub rassemblement: usize,
    pub debut: u32,
    /// l'armée principale, une fois partie (à terre ou à bord du convoi)
    pub armee: Option<u32>,
    pub mer: bool,
}

// ------------------------------------------------------------------ branchements

/// Le revenu mensuel du royaume, en or, dont il peut disposer pour son armée : ses vrais revenus du mois dernier
/// (impôts, routes, commerce maritime), moins l'entretien de ses bâtiments et de son éclairage (tour.rs).
pub fn revenu(p: &Partie, id: i32) -> f64 {
    let r = &p.royaumes[id as usize];
    let v = |x: &str| r.revenus.get(x).copied().unwrap_or(0.0);
    let st = p.stats(id);
    let militaire = st.soldats as f64 * 0.5 + st.entretien_flotte + p.entretien_forts(id);
    (v("impots") + v("commerce") + v("commerce_mer") - (v("entretien") - militaire).max(0.0)).max(0.0)
}

/// Le jugement militaire de l'ordinateur, de 0 à 1 (`Qualite::jugement`, selon la difficulté).
pub fn niveau(p: &Partie, _id: i32) -> f64 {
    super::qualite(p.options.difficulte).jugement
}

/// Le rapport de forces qu'exige le royaume avant d'attaquer : le caractère de son souverain (l'agressif se
/// contente de peu, le prudent veut l'écraser), puis son jugement (un ordinateur sot se contente de bien moins, et le paie).
pub fn audace(p: &Partie, id: i32) -> f64 {
    let t = traits(p, id);
    let base = 1.55 - 0.5 * (t.agressivite - 0.5) + 0.4 * (t.prudence - 0.5);
    base * (0.6 + 0.4 * niveau(p, id))
}

// ------------------------------------------------------------------ le mois

/// Le mois militaire du royaume `k` (appelé par `ia::mois`).
pub fn mois(p: &mut Partie, k: usize, rapport: &mut Rapport) {
    let id = k as i32;
    if p.capitale(id).is_none() {
        return;
    }
    // ses propres tirages, tirés de l'état du hasard sans l'avancer : les décisions militaires ne
    // changent ni la météo ni les événements de la partie (et restent reproductibles)
    let graine = p.hasard.etat ^ (k as u64).wrapping_mul(0x5851_F42D_4C95_7F2D);
    let hasard = std::mem::replace(&mut p.hasard, Hasard::new(graine));
    regrouper(p, id);
    entretien(p, k);
    let c = Ctx::new(p, id);
    let m = &mut p.royaumes[k].militaire;
    m.paix = if c.ennemis.is_empty() { m.paix + 1 } else { 0 };
    sieges(p, &c, rapport);
    replis(p, &c, rapport);
    defense(p, &c, rapport);
    fortifier(p, &c);
    campagne(p, &c, rapport);
    espionnage(p, &c);
    recrutement(p, &c);
    marine(p, &c);
    forts(p, &c);
    exploration(p, &c);
    p.hasard = hasard;
}

/// Une armée ennemie vue ce mois-ci (à terre, ou à bord d'une flotte).
struct Vu {
    case: usize,
    proprio: i32,
    /// attaque contre une place, attaque en rase campagne, défense (avec sa protection)
    att: f64,
    champ: f64,
    de: f64,
    abri: bool,
}

/// Une place à défendre : une de ses villes ou un de ses forts achevés.
struct Place {
    case: usize,
    ville: Option<usize>,
    /// défense voulue en garnison, et la menace qui pèse sur elle
    besoin: f64,
    menace: f64,
    assiegee: bool,
}

/// Ce que le royaume sait au début de son mois.
struct Ctx {
    id: i32,
    niv: f64,
    ennemis: Vec<i32>,
    vue: Vec<u8>,
    vus: Vec<Vu>,
    /// flottes ennemies vues : case, attaque, défense, navire de guerre
    flottes: Vec<(usize, f64, f64, bool)>,
    terre: Terre,
    villes: Vec<usize>,
    places: Vec<Place>,
    capitale: usize,
}

impl Ctx {
    fn new(p: &mut Partie, id: i32) -> Ctx {
        let niv = niveau(p, id);
        let ennemis = ennemis(p, id);
        let hostile = |o: i32| o == BRIGANDS || ennemis.contains(&o);
        let vue = p.vision(id);
        let mut vus = Vec::new();
        for a in p.armees.iter().filter(|a| hostile(a.proprio) && vue[a.case] == 1) {
            let abri = p.ville_a(a.case).is_some_and(|vi| p.villes[vi].proprio == a.proprio) || p.fort_a(a.case).is_some_and(|fi| p.forts[fi].proprio == a.proprio);
            vus.push(Vu { case: a.case, proprio: a.proprio, att: p.attaque(a, true, 1.0), champ: p.attaque(a, false, 1.0), de: p.defense(a) * p.protection(a), abri });
        }
        let mut flottes = Vec::new();
        for f in p.flottes.iter().filter(|f| hostile(f.proprio) && vue[f.case] == 1) {
            if let Some(a) = &f.armee {
                vus.push(Vu { case: f.case, proprio: f.proprio, att: p.attaque(a, true, 1.0), champ: p.attaque(a, false, 1.0), de: p.defense(a), abri: false });
            }
            flottes.push((f.case, p.force_navale(f, true), p.force_navale(f, false), p.de_guerre(f)));
        }
        let villes: Vec<usize> = (0..p.villes.len()).filter(|&i| p.villes[i].proprio == id).collect();
        let sources: Vec<usize> = villes.iter().map(|&vi| p.villes[vi].case).collect();
        let terre = Terre::depuis(p, &sources);
        let capitale = p.villes[p.capitale(id).unwrap()].case;
        // un ordinateur sot sous-estime ce qui le menace
        let lucidite = 0.3 + 0.7 * niv;
        let menace = |case: usize| -> f64 {
            vus.iter().filter(|h| !h.abri || p.carte.dist(h.case, case) <= 2).map(|h| {
                let d = p.carte.dist(h.case, case);
                if d > PORTEE { 0.0 } else { h.att * (1.0 - d as f64 / (PORTEE + 2) as f64) }
            }).sum::<f64>() * lucidite
        };
        let assiegee = |case: usize| p.sieges.iter().any(|s| s.case == case && hostile(s.assiegeant));
        let mut places = Vec::new();
        for &vi in &villes {
            let v = &p.villes[vi];
            let m = menace(v.case);
            let voisins: Vec<i32> = p.carte.rayon(v.case, 4).into_iter().map(|x| p.carte.cases[x].proprio).filter(|&o| o >= 0 && o != id).collect();
            let frontiere = if voisins.iter().any(|o| hostile(*o)) { 8.0 } else if voisins.is_empty() { 0.0 } else { 3.0 };
            let cote = p.carte.voisins(v.case).iter().any(|&x| p.carte.cases[x].mer()) && flottes.iter().any(|f| f.3 && p.carte.dist(f.0, v.case) <= 6);
            let base = 4.0 + 3.0 * v.niveau as f64 + if v.capitale { 8.0 } else { 0.0 } + frontiere + if cote { 8.0 } else { 0.0 };
            let besoin = base.max(1.2 * m - p.defense_ville(vi));
            places.push(Place { case: v.case, ville: Some(vi), besoin, menace: m, assiegee: assiegee(v.case) });
        }
        for f in p.forts.iter().filter(|f| f.proprio == id && f.niveau > 0) {
            let m = menace(f.case);
            let murs = regles().fort(f.niveau).map_or(0.0, |d| d.murs);
            let base: f64 = if exposition(p, id, f.case) == 2 || m > 0.0 { 6.0 } else { 3.0 };
            places.push(Place { case: f.case, ville: None, besoin: base.max(1.2 * m - murs), menace: m, assiegee: assiegee(f.case) });
        }
        Ctx { id, niv, ennemis, vue, vus, flottes, terre, villes, places, capitale }
    }

    fn hostile(&self, o: i32) -> bool {
        o == BRIGANDS || self.ennemis.contains(&o)
    }

    fn place(&self, case: usize) -> Option<&Place> {
        self.places.iter().find(|x| x.case == case)
    }

    /// La défense à laisser sur une case : celle de la place (rien hors des places).
    fn garde(&self, case: usize) -> f64 {
        self.place(case).map_or(0.0, |x| x.besoin)
    }
}

/// Les distances à pied depuis ses villes (un seul calcul par mois, au lieu d'une recherche par cible) :
/// pour chaque case, le coût du trajet depuis la ville la plus proche, et cette ville.
struct Terre {
    dist: Vec<f64>,
    source: Vec<usize>,
}

impl Terre {
    fn depuis(p: &Partie, sources: &[usize]) -> Terre {
        let n = p.carte.cases.len();
        let (mut dist, mut source) = (vec![f64::INFINITY; n], vec![usize::MAX; n]);
        let mut tas = BinaryHeap::new();
        for &s in sources {
            dist[s] = 0.0;
            source[s] = s;
            tas.push(Reverse((0u64, s)));
        }
        while let Some(Reverse((d, c))) = tas.pop() {
            let d = d as f64 / 1000.0;
            if d > dist[c] + 1e-6 {
                continue;
            }
            for v in p.carte.voisins(c) {
                if !p.praticable(v) {
                    continue;
                }
                let nd = d + p.cout_case(v);
                if nd < dist[v] - 1e-9 {
                    dist[v] = nd;
                    source[v] = source[c];
                    tas.push(Reverse(((nd * 1000.0) as u64, v)));
                }
            }
        }
        Terre { dist, source }
    }
}

// ------------------------------------------------------------------ unités et détachements

fn genre(cle: &str) -> &'static str {
    regles().unite(cle).map_or("", |d| d.genre.as_str())
}

fn def_unite(cle: &str) -> f64 {
    regles().unite(cle).map_or(0.0, |d| d.def)
}

/// L'attaque d'une unité de `id` (comme `Partie::attaque`, sans la météo), contre une place ou en rase campagne.
fn att_unite(p: &Partie, id: i32, cle: &str, place: bool) -> f64 {
    let Some(d) = regles().unite(cle) else { return 0.0 };
    let mut a = d.att;
    if d.genre == "infanterie" && p.a_tech(id, "silex") {
        a += 1.0;
    }
    if place && d.siege > 0.0 {
        a *= d.siege;
    }
    a
}

fn force(p: &Partie, id: i32, u: &BTreeMap<String, u32>, place: bool) -> f64 {
    u.iter().map(|(cle, &n)| att_unite(p, id, cle, place) * n as f64).sum()
}

fn tenue(u: &BTreeMap<String, u32>) -> f64 {
    u.iter().map(|(cle, &n)| def_unite(cle) * n as f64).sum()
}

fn terrain(p: &Partie, case: usize) -> f64 {
    let k = &p.carte.cases[case];
    if k.t == Terrain::Colline || k.foret { 1.2 } else { 1.0 }
}

/// L'erreur d'estimation : nulle pour un ordinateur lucide ; large, et optimiste, pour un sot.
fn bruit(p: &mut Partie, niv: f64) -> f64 {
    (p.hasard.normale() * 0.45 * (1.0 - niv)).exp() * (1.0 - 0.3 * (1.0 - niv))
}

/// L'armée de `id` à l'arrêt sur la case (la garnison d'une place, une troupe rassemblée).
fn arretee(p: &Partie, id: i32, case: usize) -> Option<usize> {
    p.armees.iter().position(|a| a.proprio == id && a.case == case && a.chemin.is_empty())
}

/// Les armées à l'arrêt d'un royaume sur une de ses places se fondent en une seule.
fn regrouper(p: &mut Partie, id: i32) {
    let mut i = 0;
    while i < p.armees.len() {
        let a = &p.armees[i];
        let chez_soi = p.ville_a(a.case).is_some_and(|vi| p.villes[vi].proprio == id) || p.fort_a(a.case).is_some_and(|fi| p.forts[fi].proprio == id);
        if a.proprio == id && a.chemin.is_empty() && chez_soi {
            if let Some(j) = (0..i).find(|&j| p.armees[j].proprio == id && p.armees[j].case == p.armees[i].case && p.armees[j].chemin.is_empty()) {
                p.fusionner(j, i);
                continue;
            }
        }
        i += 1;
    }
}

/// Les unités de l'armée `ai` qu'on peut emmener en laissant `garde` de défense sur place :
/// l'infanterie la plus solide reste, la cavalerie et l'artillerie partent d'abord.
fn libres(p: &Partie, ai: usize, garde: f64) -> BTreeMap<String, u32> {
    let mut l: Vec<(&String, u32)> = p.armees[ai].unites.iter().map(|(k, &n)| (k, n)).collect();
    l.sort_by(|x, y| (genre(x.0) != "infanterie").cmp(&(genre(y.0) != "infanterie")).then(def_unite(y.0).total_cmp(&def_unite(x.0))));
    let (mut garde, mut out) = (garde, BTreeMap::new());
    for (cle, n) in l {
        let d = def_unite(cle).max(0.5);
        let reste = if garde > 0.0 { ((garde / d).ceil() as u32).min(n) } else { 0 };
        garde -= reste as f64 * d;
        if n > reste {
            out.insert(cle.clone(), n - reste);
        }
    }
    out
}

/// Parmi `libres`, de quoi atteindre `voulu` selon `valeur`, en prenant d'abord les unités au meilleur `ordre`.
fn choisir(libres: &BTreeMap<String, u32>, voulu: f64, valeur: impl Fn(&str) -> f64, ordre: impl Fn(&str) -> f64) -> BTreeMap<String, u32> {
    let mut l: Vec<(&String, u32)> = libres.iter().map(|(k, &n)| (k, n)).collect();
    l.sort_by(|a, b| ordre(b.0).total_cmp(&ordre(a.0)));
    let (mut total, mut out) = (0.0, BTreeMap::new());
    for (cle, n) in l {
        for _ in 0..n {
            if total >= voulu {
                return out;
            }
            total += valeur(cle);
            *out.entry(cle.clone()).or_insert(0) += 1;
        }
    }
    out
}

/// Les unités `u` quittent l'armée `ai` et prennent `chemin` (toute l'armée part si on les prend toutes) ; rend l'armée partie.
fn detacher(p: &mut Partie, ai: usize, u: BTreeMap<String, u32>, chemin: Vec<usize>) -> Option<u32> {
    if u.values().sum::<u32>() == 0 || chemin.is_empty() || u.iter().any(|(k, n)| p.armees[ai].unites.get(k).copied().unwrap_or(0) < *n) {
        return None;
    }
    if u == p.armees[ai].unites {
        p.armees[ai].chemin = chemin;
        return Some(p.armees[ai].id);
    }
    for (cle, n) in &u {
        *p.armees[ai].unites.get_mut(cle).unwrap() -= n;
    }
    p.armees[ai].unites.retain(|_, n| *n > 0);
    let (id, case) = (p.armees[ai].proprio, p.armees[ai].case);
    let a = p.creer_armee(id, case, u);
    let i = p.armee(a).unwrap();
    p.armees[i].chemin = chemin;
    Some(a)
}

fn envoyer(p: &mut Partie, ai: usize, u: BTreeMap<String, u32>, vers: usize) -> Option<u32> {
    let ch = p.chemin(p.armees[ai].case, vers)?;
    detacher(p, ai, u, ch)
}

/// La place (ville ou fort) sur la case : son maître et son nom.
fn maitre(p: &Partie, case: usize) -> Option<(i32, String)> {
    if let Some(vi) = p.ville_a(case) {
        return Some((p.villes[vi].proprio, p.villes[vi].nom.clone()));
    }
    p.fort_a(case).map(|fi| (p.forts[fi].proprio, p.nom_fort(case)))
}

/// Un événement militaire : montré au joueur s'il le concerne ou s'il voit la case.
fn annoncer(p: &mut Partie, rapport: &mut Rapport, texte: String, case: usize, concerne: bool) {
    let connue = p.connait(0, case);
    if concerne || (connue && p.vision(0)[case] == 1) {
        p.evt(rapport, texte, "guerre", connue.then_some(case));
    }
}

/// Une case de ses terres exposée : 2 près d'une frontière (des terres d'un autre royaume à 2 cases), 1 sur la côte, 0 sinon.
fn exposition(p: &Partie, id: i32, c: usize) -> u32 {
    if p.carte.cases[c].proprio != id {
        0
    } else if p.carte.rayon(c, 2).iter().any(|&x| p.carte.cases[x].proprio >= 0 && p.carte.cases[x].proprio != id) {
        2
    } else {
        p.carte.voisins(c).iter().any(|&x| p.carte.cases[x].mer()) as u32
    }
}

// ------------------------------------------------------------------ entretien

/// La solde (soldats à 0,5 or chacun comme le joueur, navires, espions, forts) est prélevée avec le reste de
/// l'entretien à la fin du mois (tour.rs). Ici, ses suites : trésor vide et comptes dans le rouge, le dixième
/// de l'armée déserte ; en paix prolongée, on démobilise ce qu'on n'a pas les moyens de garder.
fn entretien(p: &mut Partie, k: usize) {
    let id = k as i32;
    let st = p.stats(id);
    let r = &p.royaumes[k];
    let v = |x: &str| r.revenus.get(x).copied().unwrap_or(0.0);
    let deficit = v("impots") + v("commerce") + v("commerce_mer") < v("entretien");
    if st.soldats > 0 && deficit && r.stock.get("or").copied().unwrap_or(0.0) < 1.0 {
        licencier(p, id, (st.soldats as u32 / 10).max(1));
    } else if p.royaumes[k].militaire.paix >= 24 && st.soldats as f64 > plafond(p, id, 0.2) {
        licencier(p, id, 1 + st.soldats as u32 / 40);
    }
}

/// Les soldats que le royaume peut entretenir en consacrant `part` de son revenu disponible (`revenu`) à l'armée.
fn plafond(p: &Partie, id: i32, part: f64) -> f64 {
    let st = p.stats(id);
    ((revenu(p, id) * part - st.entretien_flotte - p.entretien_forts(id)) / 0.5).max(8.0)
}

/// `n` soldats rendus à la vie civile : les moins utiles de la plus grosse garnison.
fn licencier(p: &mut Partie, id: i32, n: u32) {
    let Some(ai) = (0..p.armees.len()).filter(|&i| p.armees[i].proprio == id && p.armees[i].chemin.is_empty()).max_by_key(|&i| p.armees[i].effectif()) else { return };
    for _ in 0..n.min(p.armees[ai].effectif().saturating_sub(2)) {
        let u = p.armees[ai].unites.keys().min_by(|a, b| {
            let v = |c: &str| regles().unite(c).map_or(0.0, |d| d.att + d.def);
            v(a).total_cmp(&v(b))
        }).cloned().unwrap();
        *p.armees[ai].unites.get_mut(&u).unwrap() -= 1;
        p.armees[ai].unites.retain(|_, n| *n > 0);
    }
}

// ------------------------------------------------------------------ sièges et replis

/// Ses sièges : l'assaut quand il a de bonnes chances, l'attente quand la faim travaille pour lui,
/// la levée quand une sortie ou une armée de secours le menace.
fn sieges(p: &mut Partie, c: &Ctx, rapport: &mut Rapport) {
    let id = c.id;
    for si in (0..p.sieges.len()).rev() {
        let s = p.sieges[si].clone();
        if s.assiegeant != id {
            continue;
        }
        let Some((proprio, nom)) = maitre(p, s.case) else { continue };
        let (at, de) = p.forces_assaut(&s, 1.0);
        let murs = if s.murs_max > 0.0 { s.murs / s.murs_max } else { 0.0 };
        let assiegeants: Vec<usize> = (0..p.armees.len()).filter(|&i| p.armees[i].proprio == id && p.armees[i].case == s.case).collect();
        let tenue: f64 = assiegeants.iter().map(|&i| p.defense(&p.armees[i]) * p.protection(&p.armees[i])).sum::<f64>() * terrain(p, s.case);
        let secours: f64 = c.vus.iter().filter(|h| h.case != s.case && !h.abri && p.carte.dist(h.case, s.case) <= 6).map(|h| h.champ).sum();
        let jugement = bruit(p, c.niv);
        // la garnison disperse les assiégeants si elle les surpasse trois fois : on lève le camp avant
        let sortie = de > (2.0 + (1.0 - c.niv) * 0.9) * at;
        let ecrase = secours * jugement > (1.2 + (1.0 - c.niv) * 1.5) * tenue && p.hasard.p(0.4 + 0.6 * c.niv);
        if sortie || ecrase {
            let n: u32 = assiegeants.iter().map(|&i| p.armees[i].effectif()).sum();
            let mut parti = false;
            for &i in &assiegeants {
                let Some(vi) = p.ville_proche(s.case, id) else { break };
                let maison = p.villes[vi].case;
                if let Some(ch) = p.chemin(s.case, maison) {
                    p.armees[i].chemin = ch;
                    p.armees[i].retranche = None;
                    parti = true;
                }
            }
            if parti {
                let qui = p.nom_royaume(id);
                annoncer(p, rapport, format!("🏳️ {qui} lève le siège {} et se replie ({n} soldats)", crate::forts::de_lieu(&nom), n = n as i64 * crate::regles::HOMMES), s.case, proprio == 0);
            }
            continue;
        }
        let assaut = if c.niv < 0.4 {
            // l'ordinateur sot donne l'assaut dès que les murs tombent, quelle que soit la garnison
            murs < 0.3 || (s.mois >= 3 && at > 1.4 * de) || at > 2.5 * de
        } else {
            let presse = secours > 0.5 * tenue;
            // affamée, la place va se rendre : on l'attend, sauf si l'on est pressé
            let affamee = s.faim > 0 && !presse;
            !affamee && (at > (1.0 + 0.35 * c.niv) * de || (presse && at > 1.05 * de))
        };
        if assaut {
            p.sieges[si].assaut = true;
        }
    }
}

/// Ses armées hors de ses murs se replient vers la ville la plus proche quand une armée ennemie bien
/// supérieure approche (les assiégeants sont jugés par `sieges`).
fn replis(p: &mut Partie, c: &Ctx, rapport: &mut Rapport) {
    let id = c.id;
    for ai in 0..p.armees.len() {
        let a = &p.armees[ai];
        if a.proprio != id || !p.praticable(a.case) || p.assiege(id, a.case) || c.place(a.case).is_some() {
            continue;
        }
        let case = a.case;
        let menace: f64 = c.vus.iter().filter(|h| !h.abri && p.carte.dist(h.case, case) <= 5).map(|h| h.champ).sum();
        if menace <= 0.0 {
            continue;
        }
        let tenue = p.defense(a) * p.protection(a) * terrain(p, case);
        let (seuil, n) = (1.2 + (1.0 - c.niv) * 1.8, a.effectif());
        if menace * bruit(p, c.niv) <= seuil * tenue || !p.hasard.p(0.4 + 0.6 * c.niv) {
            continue;
        }
        let Some(vi) = p.ville_proche(case, id) else { continue };
        let (maison, ville) = (p.villes[vi].case, p.villes[vi].nom.clone());
        if p.armees[ai].chemin.last() == Some(&maison) {
            continue;
        }
        if let Some(ch) = p.chemin(case, maison) {
            p.armees[ai].chemin = ch;
            p.armees[ai].retranche = None;
            let qui = p.nom_royaume(id);
            let concerne = c.vus.iter().any(|h| h.proprio == 0 && p.carte.dist(h.case, case) <= 5);
            annoncer(p, rapport, format!("🏃 L'armée de {qui} ({n} soldats) se replie vers {ville}", n = n as i64 * crate::regles::HOMMES), case, concerne);
        }
    }
}

// ------------------------------------------------------------------ défense

/// La défense : secourir les places assiégées, renforcer les places menacées, intercepter quand
/// l'avantage est net, fortifier la ville la plus menacée. Un ordinateur sot réagit tard.
fn defense(p: &mut Partie, c: &Ctx, rapport: &mut Rapport) {
    if !p.hasard.p(0.35 + 0.65 * c.niv) {
        return;
    }
    let id = c.id;
    // secours : rassembler près de la place assiégée, frapper les assiégeants quand on est assez fort
    let assiegees: Vec<usize> = c.places.iter().filter(|x| x.assiegee).map(|x| x.case).collect();
    for case in assiegees {
        let assiegeants: Vec<usize> = (0..p.armees.len()).filter(|&i| p.armees[i].case == case && c.hostile(p.armees[i].proprio)).collect();
        let Some(&a0) = assiegeants.first() else { continue };
        let qui_assiege = p.armees[a0].proprio;
        let tenue: f64 = assiegeants.iter().map(|&i| p.defense(&p.armees[i]) * p.protection(&p.armees[i])).sum::<f64>() * terrain(p, case);
        let besoin = tenue * bruit(p, c.niv) * (1.1 + 0.4 * c.niv);
        let point = c.places.iter().filter(|x| !x.assiegee && x.ville.is_some()).min_by_key(|x| p.carte.dist(x.case, case)).map(|x| x.case);
        let Some(point) = point else { continue };
        if let Some((aid, n)) = frapper(p, c, point, case, besoin, false) {
            let ville = maitre(p, case).map(|m| m.1).unwrap_or_default();
            let qui = p.nom_royaume(id);
            let depart = p.armees[p.armee(aid).unwrap()].case;
            annoncer(p, rapport, format!("⚠️ {qui} envoie une armée de secours ({n} soldats) vers {ville} !", n = n as i64 * crate::regles::HOMMES), depart, qui_assiege == 0);
        } else if c.niv >= 0.3 {
            appeler(p, c, point, besoin, false);
        }
    }
    // renforts : les places en déficit reçoivent le surplus des places voisines
    let mut deficits: Vec<(usize, f64)> = c.places.iter().filter(|x| !x.assiegee).map(|x| {
        let present: f64 = p.armees.iter().filter(|a| a.proprio == id && (a.case == x.case && a.chemin.is_empty() || a.chemin.last() == Some(&x.case))).map(|a| p.defense(a)).sum();
        (x.case, x.besoin - present)
    }).filter(|d| d.1 > 0.5).collect();
    deficits.sort_by(|a, b| b.1.total_cmp(&a.1));
    let mut envois = 0;
    for (case, mut manque) in deficits.into_iter().take(3) {
        let mut donneurs: Vec<(usize, f64)> = c.places.iter().filter(|x| x.case != case && !x.assiegee && p.carte.dist(x.case, case) <= 15).map(|x| (x.case, x.besoin)).collect();
        donneurs.sort_by_key(|d| p.carte.dist(d.0, case));
        for (dc, garde) in donneurs {
            let Some(ai) = arretee(p, id, dc) else { continue };
            let l = libres(p, ai, garde);
            let pris = choisir(&l, manque, def_unite, |u| def_unite(u) + if genre(u) == "infanterie" { 10.0 } else { 0.0 });
            let t = tenue(&pris);
            if t > 0.0 && envoyer(p, ai, pris, case).is_some() {
                manque -= t;
                envois += 1;
            }
            if manque <= 0.0 || envois >= 4 {
                break;
            }
        }
    }
    // interception : une armée ennemie à découvert sur ses terres, qu'on peut battre nettement
    let cibles: Vec<(usize, f64)> = c.vus.iter().filter(|h| !h.abri && p.praticable(h.case) && (p.carte.cases[h.case].proprio == id || c.places.iter().any(|x| p.carte.dist(x.case, h.case) <= 3))).map(|h| (h.case, h.de)).collect();
    for (case, de) in cibles.into_iter().take(2) {
        let besoin = de * terrain(p, case) * bruit(p, c.niv) * (1.1 + 0.7 * c.niv);
        let donneur = c.places.iter().filter(|x| !x.assiegee && p.carte.dist(x.case, case) <= 6).filter_map(|x| {
            let ai = arretee(p, id, x.case)?;
            let l = libres(p, ai, x.besoin);
            (force(p, id, &l, false) >= besoin).then_some((ai, l))
        }).min_by_key(|(ai, _)| p.carte.dist(p.armees[*ai].case, case));
        if let Some((ai, l)) = donneur {
            let pris = choisir(&l, besoin, |u| att_unite(p, id, u, false), |u| if genre(u) == "cavalerie" { 100.0 } else { att_unite(p, id, u, false) });
            envoyer(p, ai, pris, case);
        }
    }
    // fortifier la ville la plus menacée (la menace dépasse ce que tiennent ses murs)
    let menacee = c.places.iter().filter_map(|x| x.ville.map(|vi| (vi, x.menace))).filter(|&(vi, m)| m > 0.5 * p.defense_ville(vi) && p.peut_fortifier(vi).is_ok()).max_by(|a, b| a.1.total_cmp(&b.1));
    if let Some((vi, _)) = menacee {
        let f = p.peut_fortifier(vi).unwrap();
        if peut_depenser(p, id as usize, &f.cout, 60.0) {
            let _ = p.fortifier(id, vi);
        }
    }
}

/// Les fortifications ordinaires : de temps en temps (bien plus souvent en guerre), la ville la plus exposée
/// — la capitale, puis les villes frontalières ou côtières ; à égalité la moins fortifiée — passe au niveau suivant,
/// par l'ordre du joueur, si le royaume en a les moyens sans entamer ses réserves (`defense` répond, elle, à la menace).
fn fortifier(p: &mut Partie, c: &Ctx) {
    let id = c.id;
    if !p.hasard.p(if c.ennemis.is_empty() { 0.06 } else { 0.25 }) {
        return;
    }
    let exposee = |vi: usize| {
        let v = &p.villes[vi];
        let cotiere = p.carte.rayon(v.case, 2).iter().any(|&x| p.carte.cases[x].mer());
        let frontaliere = p.villes.iter().any(|o| o.proprio != id && p.carte.dist(o.case, v.case) <= 10);
        (2 * v.capitale as u32 + cotiere as u32 + frontaliere as u32, 4u32.saturating_sub(v.fortif))
    };
    let Some(vi) = c.villes.iter().copied().filter(|&vi| p.peut_fortifier(vi).is_ok()).max_by_key(|&vi| exposee(vi)) else { return };
    let f = p.peut_fortifier(vi).unwrap();
    if peut_depenser(p, id as usize, &f.cout, 100.0) {
        let _ = p.fortifier(id, vi);
    }
}

/// Si la troupe rassemblée à `point` (au-delà de la garde de la place) atteint `besoin` (son attaque,
/// contre une place ou en rase campagne), elle part en un seul corps sur `cible`. Rend l'armée et son effectif.
fn frapper(p: &mut Partie, c: &Ctx, point: usize, cible: usize, besoin: f64, contre_place: bool) -> Option<(u32, u32)> {
    let ai = arretee(p, c.id, point)?;
    let l = libres(p, ai, c.garde(point));
    if force(p, c.id, &l, contre_place) < besoin {
        return None;
    }
    let n = l.values().sum();
    envoyer(p, ai, l, cible).map(|a| (a, n))
}

/// Les troupes disponibles convergent vers `point` jusqu'à y réunir `voulu` d'attaque (ce qui est déjà
/// en route compte) : le surplus des autres places, les armées sans emploi en campagne.
fn appeler(p: &mut Partie, c: &Ctx, point: usize, voulu: f64, contre_place: bool) {
    let id = c.id;
    // ce qui est déjà là (au-delà de la garde de la place) ou en route ; un peu de marge
    let la = arretee(p, id, point).map_or(0.0, |ai| force(p, id, &libres(p, ai, c.garde(point)), contre_place));
    let en_route: f64 = p.armees.iter().filter(|a| a.proprio == id && a.chemin.last() == Some(&point)).map(|a| p.attaque(a, contre_place, 1.0)).sum();
    let mut manque = 1.1 * voulu - la - en_route;
    // les armées sans emploi, hors des places : elles rejoignent toutes
    for ai in 0..p.armees.len() {
        let a = &p.armees[ai];
        if manque <= 0.0 {
            return;
        }
        if a.proprio == id && a.chemin.is_empty() && a.effectif() > 1 && a.case != point && p.praticable(a.case) && c.place(a.case).is_none() && !p.assiege(id, a.case) && !p.tient_un_poste(a) {
            let (u, f) = (a.unites.clone(), p.attaque(a, contre_place, 1.0));
            if envoyer(p, ai, u, point).is_some() {
                manque -= f;
            }
        }
    }
    let mut donneurs: Vec<(usize, f64)> = c.places.iter().filter(|x| x.case != point && !x.assiegee).map(|x| (x.case, x.besoin)).collect();
    donneurs.sort_by_key(|d| p.carte.dist(d.0, point));
    let mut envois = 0;
    for (dc, garde) in donneurs {
        if manque <= 0.0 || envois >= 4 {
            break;
        }
        let Some(ai) = arretee(p, id, dc) else { continue };
        let l = libres(p, ai, garde);
        let pris = choisir(&l, manque, |u| att_unite(p, id, u, contre_place), |u| att_unite(p, id, u, contre_place));
        let f = force(p, id, &pris, contre_place);
        if f > 0.0 && envoyer(p, ai, pris, point).is_some() {
            manque -= f;
            envois += 1;
        }
    }
}

// ------------------------------------------------------------------ campagne

/// Ce que `id` croit de la défense d'une place : la garnison vue (supposée si on ne la voit pas), la
/// ville et ses murs, les renforts possibles (armées vues alentour, forts tenus voisins).
struct Estimation {
    /// l'attaque qu'il faut pour l'emporter (un siège use la place : il en faut moins contre des murs)
    besoin: f64,
    murs: bool,
}

fn estimer(p: &Partie, c: &Ctx, case: usize) -> Estimation {
    let Some((m, _)) = maitre(p, case) else { return Estimation { besoin: 0.0, murs: false } };
    let (place, murs, vide) = match p.ville_a(case) {
        Some(vi) => (p.defense_ville(vi), p.murs_ville(vi) > 0.0, false),
        None => {
            let f = &p.forts[p.fort_a(case).unwrap()];
            (regles().fort(f.niveau).map_or(0.0, |d| d.murs), f.niveau > 0, !p.garnison(m, case))
        }
    };
    let garnison = if c.vue[case] == 1 {
        p.armees.iter().filter(|a| a.proprio == m && a.case == case).map(|a| p.defense(a) * p.protection(a)).sum()
    } else {
        place * 0.8 + 6.0
    };
    // un fort qu'on voit vide se prend en y entrant
    if vide && c.vue[case] == 1 {
        return Estimation { besoin: 4.0, murs: false };
    }
    let renforts: f64 = c.vus.iter().filter(|h| h.proprio == m && h.case != case && p.carte.dist(h.case, case) <= 6).map(|h| 0.6 * h.de).sum();
    let base = garnison * terrain(p, case) + place;
    Estimation { besoin: if murs { 0.6 * base } else { base } + renforts, murs }
}

/// La place la plus intéressante : faible, précieuse (capitale, rang, bâtiments), proche et accessible
/// (à pied, sinon par mer depuis un de ses ports). L'ordinateur sot choisit souvent au hasard.
fn choisir_cible(p: &mut Partie, c: &Ctx) -> Option<Campagne> {
    let id = c.id;
    let ports: Vec<usize> = c.villes.iter().copied().filter(|&vi| port_de(p, id, vi).is_some()).collect();
    let mut cand: Vec<(usize, i32, f64, usize, bool)> = Vec::new();
    // sans mine de fer, une ville ennemie assise sur un filon vaut bien plus (outils, Bourg, port, canons)
    let sans_fer = !p.batiments.iter().any(|b| b.proprio == id && b.cle == "mine_fer");
    let places: Vec<(usize, i32, f64)> = p.villes.iter().filter(|v| c.ennemis.contains(&v.proprio)).map(|v| {
        let bat = p.batiments.iter().filter(|b| b.ville == Some(v.id)).count() as f64;
        let filon = sans_fer && p.carte.rayon(v.case, 3).iter().any(|&x| p.carte.cases[x].gisement.as_deref() == Some("fer"));
        (v.case, v.proprio, 2.0 + v.niveau as f64 + if v.capitale { 4.0 } else { 0.0 } + bat / 8.0 + if filon { 3.0 } else { 0.0 })
    }).chain(p.forts.iter().filter(|f| c.ennemis.contains(&f.proprio)).map(|f| (f.case, f.proprio, 1.0 + f.niveau as f64))).collect();
    for (case, m, valeur) in places {
        if !p.connait(id, case) {
            continue;
        }
        let d = c.terre.dist[case];
        let (point, mer, d) = if d.is_finite() {
            (c.terre.source[case], false, d)
        } else if let Some(&vi) = ports.iter().min_by_key(|&&vi| p.carte.dist(p.villes[vi].case, case)) {
            (p.villes[vi].case, true, p.carte.dist(p.villes[vi].case, case) as f64 * 1.5 + 8.0)
        } else {
            continue;
        };
        let e = estimer(p, c, case);
        let score = valeur / (e.besoin + 10.0) / (1.0 + d / 20.0) * if mer { 0.6 } else { 1.0 };
        cand.push((case, m, score, point, mer));
    }
    if cand.is_empty() {
        return None;
    }
    let i = if p.hasard.p(1.0 - c.niv) { p.hasard.indice(cand.len()) } else { (0..cand.len()).max_by(|&a, &b| cand[a].2.total_cmp(&cand[b].2)).unwrap() };
    let (cible, ennemi, _, point, mer) = cand[i];
    // l'ordinateur sot rassemble à sa capitale, quelle que soit la cible
    let rassemblement = if c.niv < 0.4 && !mer && c.terre.dist[cible].is_finite() && p.chemin(c.capitale, cible).is_some() { c.capitale } else { point };
    Some(Campagne { cible, ennemi, rassemblement, debut: p.tour, armee: None, mer })
}

/// La campagne : choisir la proie, rassembler l'armée, la lancer quand le rapport de forces est atteint
/// (avec des détachements contre les forts de la route), la suivre, la renforcer ou l'abandonner.
fn campagne(p: &mut Partie, c: &Ctx, rapport: &mut Rapport) {
    let k = c.id as usize;
    let mut camp = p.royaumes[k].militaire.campagne.clone();
    if let Some(cp) = camp.as_mut() {
        if !maitre(p, cp.cible).is_some_and(|(m, _)| c.ennemis.contains(&m)) || p.tour >= cp.debut + DUREE_CAMPAGNE {
            camp = None;
            p.royaumes[k].militaire.repos = p.tour + p.hasard.entre(2, 5) as u32;
        } else {
            // l'armée principale a péri (ou s'est fondue dans une garnison) : on rassemble de nouveau
            if cp.armee.is_some_and(|a| p.armee(a).is_none() && !p.flottes.iter().any(|f| f.armee.as_ref().is_some_and(|x| x.id == a))) {
                cp.armee = None;
            }
            // le point de rassemblement est tombé : la ville la plus proche de la cible (un port, par mer)
            let port = |p: &Partie, x: usize| !cp.mer || p.ville_a(x).is_some_and(|vi| port_de(p, c.id, vi).is_some());
            if c.place(cp.rassemblement).is_none_or(|x| x.ville.is_none()) || !port(p, cp.rassemblement) {
                let r = Some(c.terre.source[cp.cible]).filter(|&x| x != usize::MAX && !cp.mer).or_else(|| c.villes.iter().map(|&vi| p.villes[vi].case).filter(|&x| port(p, x)).min_by_key(|&x| p.carte.dist(x, cp.cible)));
                match r {
                    Some(x) => cp.rassemblement = x,
                    None => camp = None,
                }
            }
        }
    }
    if camp.is_none() && !c.ennemis.is_empty() && p.tour >= p.royaumes[k].militaire.repos && p.tour >= p.royaumes[k].prochaine_attaque {
        camp = choisir_cible(p, c);
    }
    if let Some(cp) = camp.as_mut() {
        match cp.armee {
            None => rassembler(p, c, cp, rapport),
            Some(aid) => suivre(p, c, cp, aid, rapport),
        }
    }
    p.royaumes[k].militaire.campagne = camp;
}

fn rassembler(p: &mut Partie, c: &Ctx, cp: &mut Campagne, rapport: &mut Rapport) {
    let id = c.id;
    let e = estimer(p, c, cp.cible);
    let requis = audace(p, id) * e.besoin * bruit(p, c.niv);
    // un ordinateur avisé attend le rapport de son espion avant de marcher à l'aveugle
    let espion = p.espions.iter().any(|x| x.proprio == id && (x.chemin.last() == Some(&cp.cible) || p.carte.dist(x.case, cp.cible) <= 1));
    let attendre = c.niv >= 0.6 && c.vue[cp.cible] == 0 && espion && p.tour < cp.debut + 6;
    let Some(ai) = arretee(p, id, cp.rassemblement) else {
        appeler(p, c, cp.rassemblement, requis, e.murs);
        return;
    };
    let mut l = libres(p, ai, c.garde(cp.rassemblement));
    let mut convoi = None;
    if cp.mer {
        let Some((fi, ch, cap)) = convoi_pret(p, c, cp) else {
            appeler(p, c, cp.rassemblement, requis, e.murs);
            return;
        };
        l = choisir(&l, f64::INFINITY, |_| 1.0, |u| att_unite(p, id, u, e.murs));
        while l.values().sum::<u32>() > cap {
            let u = l.keys().min_by(|a, b| att_unite(p, id, a, e.murs).total_cmp(&att_unite(p, id, b, e.murs))).cloned().unwrap();
            *l.get_mut(&u).unwrap() -= 1;
            l.retain(|_, n| *n > 0);
        }
        convoi = Some((fi, ch));
    }
    if attendre || force(p, id, &l, e.murs) < requis {
        if c.niv >= 0.4 || p.hasard.p(c.niv) {
            appeler(p, c, cp.rassemblement, requis, e.murs);
        }
        return;
    }
    let n: u32 = l.values().sum();
    let (qui, ville) = (p.nom_royaume(id), maitre(p, cp.cible).map(|m| m.1).unwrap_or_default());
    let concerne = cp.ennemi == 0;
    match convoi {
        None => {
            let Some(ch) = p.chemin(cp.rassemblement, cp.cible) else { return };
            let route = ch.clone();
            let Some(aid) = detacher(p, ai, l, ch) else { return };
            cp.armee = Some(aid);
            annoncer(p, rapport, format!("⚠️ Une armée de {qui} ({n} soldats) marche sur {ville} !", n = n as i64 * crate::regles::HOMMES), cp.rassemblement, concerne);
            detachements(p, c, aid, &route);
        }
        Some((fi, ch)) => {
            let a = p.creer_armee(id, cp.rassemblement, BTreeMap::new());
            let na = p.armee(a).unwrap();
            for (u, k) in &l {
                *p.armees[ai].unites.get_mut(u).unwrap() -= k;
            }
            p.armees[ai].unites.retain(|_, k| *k > 0);
            p.armees[na].unites = l;
            if p.peut_embarquer(fi, na).is_err() {
                // rendre les troupes à la garnison
                let u = p.armees.remove(na).unites;
                let ai = arretee(p, id, cp.rassemblement).unwrap_or(ai);
                for (k, v) in u {
                    *p.armees[ai].unites.entry(k).or_insert(0) += v;
                }
                return;
            }
            p.embarquer(fi, na);
            p.flottes[fi].chemin = ch;
            p.flottes[fi].cible = Some(cp.cible);
            cp.armee = Some(a);
            let escorte = if p.de_guerre(&p.flottes[fi]) { ", escortée" } else { "" };
            annoncer(p, rapport, format!("⚠️ Une armée de {qui} ({n} soldats) s'embarque{escorte} contre {ville} !", n = n as i64 * crate::regles::HOMMES), cp.rassemblement, concerne);
        }
    }
}

/// Les détachements de la campagne : les forts ennemis connus près de la route, vides ou faibles, sont pris
/// par une partie de l'armée principale (la cavalerie d'abord) avant qu'elle n'arrive devant la place.
fn detachements(p: &mut Partie, c: &Ctx, aid: u32, route: &[usize]) {
    let id = c.id;
    let forts: Vec<usize> = p.forts.iter().filter(|f| c.ennemis.contains(&f.proprio) && p.connait(id, f.case) && route.iter().any(|&x| p.carte.dist(x, f.case) <= 2)).map(|f| f.case).collect();
    for fc in forts.into_iter().take(2) {
        let Some(ai) = p.armee(aid) else { return };
        let besoin = estimer(p, c, fc).besoin * audace(p, id);
        let total = force(p, id, &p.armees[ai].unites, true);
        if besoin > 0.35 * total {
            continue;
        }
        let u = p.armees[ai].unites.clone();
        let pris = choisir(&u, besoin.max(1.0), |x| att_unite(p, id, x, true), |x| if genre(x) == "cavalerie" { 100.0 } else { att_unite(p, id, x, true) });
        if pris.values().sum::<u32>() < p.armees[ai].effectif() {
            let case = p.armees[ai].case;
            if let Some(ch) = p.chemin(case, fc) {
                detacher(p, ai, pris, ch);
            }
        }
    }
}

/// L'armée principale en route : elle reprend sa marche si on l'a arrêtée, adopte la place qu'elle assiège
/// en chemin, reçoit des renforts pendant le siège ; un ordinateur avisé renonce si la place s'avère trop forte.
fn suivre(p: &mut Partie, c: &Ctx, cp: &mut Campagne, aid: u32, rapport: &mut Rapport) {
    let id = c.id;
    let Some(ai) = p.armee(aid) else { return }; // à bord du convoi
    let case = p.armees[ai].case;
    if p.assiege(id, case) {
        if case != cp.cible {
            if let Some((m, _)) = maitre(p, case) {
                cp.cible = case;
                cp.ennemi = m;
            }
        }
        // les renforts rassemblés rejoignent le siège
        if c.niv >= 0.4 {
            if let Some(r) = arretee(p, id, cp.rassemblement) {
                let l = libres(p, r, c.garde(cp.rassemblement));
                if l.values().sum::<u32>() >= 3 {
                    envoyer(p, r, l, case);
                }
            }
        }
        return;
    }
    if !p.armees[ai].chemin.is_empty() {
        // la place s'avère bien plus forte qu'on ne croyait : on rentre
        let e = estimer(p, c, cp.cible);
        let f = force(p, id, &p.armees[ai].unites, e.murs);
        if c.niv >= 0.6 && c.vue[cp.cible] == 1 && f < 0.75 * e.besoin {
            if let Some(ch) = p.chemin(case, cp.rassemblement) {
                let (qui, n) = (p.nom_royaume(id), p.armees[ai].effectif());
                p.armees[ai].chemin = ch;
                cp.armee = None;
                cp.debut = p.tour;
                annoncer(p, rapport, format!("🏃 L'armée de {qui} ({n} soldats) renonce et se replie", n = n as i64 * crate::regles::HOMMES), case, cp.ennemi == 0);
            }
        }
        return;
    }
    if case != cp.cible && c.place(case).is_none() {
        if let Some(ch) = p.chemin(case, cp.cible) {
            p.armees[ai].chemin = ch;
        }
    } else if c.place(case).is_some() {
        // rentrée dans une de ses villes (repli) : la campagne reprend du rassemblement
        cp.armee = None;
        cp.rassemblement = case;
    }
}

// ------------------------------------------------------------------ recrutement


/// Les bâtiments militaires qui manquent quand le danger presse (en paix, l'économie bâtit sa caserne à son heure) :
/// la caserne d'abord, le haras et l'arsenal en guerre ; par l'ordre du joueur, sans entamer ses réserves.
fn batir(p: &mut Partie, c: &Ctx, artillerie: bool, menace: bool) {
    let id = c.id;
    let guerre = !c.ennemis.is_empty();
    for (cle, voulu) in [("caserne", guerre || menace), ("haras", guerre), ("arsenal", guerre && artillerie)] {
        if !voulu || p.batiments.iter().any(|b| b.proprio == id && b.cle == cle) {
            continue;
        }
        let d = regles().bat(cle).unwrap();
        if d.niveau > p.niveau_capitale(id) || !peut_depenser(p, id as usize, &d.cout, 80.0) {
            return;
        }
        let Some(site) = p.carte.rayon(c.capitale, 3).into_iter().find(|&x| p.peut_construire(cle, x, id).is_ok() && p.connait(id, x)) else { continue };
        if p.construire(id, cle, site).is_ok() && d.territoire > 0 {
            p.recalculer_territoire();
        }
        return;
    }
}

/// L'unité à lever et le bâtiment qui la forme : selon la composition voulue (artillerie contre les places murées,
/// cavalerie pour la vitesse, la meilleure infanterie sinon), parmi ce que ses bâtiments forment et qu'il peut payer
/// en gardant `reserve` or en caisse (et ses réserves de vivres et de matériaux). L'ordinateur sot prend au hasard.
fn choisir_unite(p: &mut Partie, c: &Ctx, artillerie: bool, reserve: f64) -> Option<(String, u32)> {
    let id = c.id;
    let mut dispo: Vec<(String, u32)> = Vec::new();
    for b in ["caserne", "haras", "arsenal"] {
        let Some(bi) = p.batiments.iter().position(|x| x.proprio == id && x.cle == b && x.fini()) else { continue };
        dispo.extend(p.unites_dispo(id, b).into_iter().filter(|u| peut_depenser(p, id as usize, &cout_recrue(p, id, u), reserve)).map(|u| (u, p.batiments[bi].id)));
    }
    if dispo.is_empty() {
        return None;
    }
    if p.hasard.p(0.8 * (1.0 - c.niv)) {
        let i = p.hasard.indice(dispo.len());
        return Some(dispo.swap_remove(i));
    }
    let mut compte: BTreeMap<&str, f64> = BTreeMap::new();
    for a in p.armees.iter().filter(|a| a.proprio == id) {
        for (u, &n) in &a.unites {
            *compte.entry(genre(u)).or_insert(0.0) += n as f64;
        }
    }
    // (les recrues en formation comptent déjà)
    for u in p.batiments.iter().filter(|b| b.proprio == id).flat_map(|b| b.file.iter()).filter(|u| !matches!(genre(u), "marine" | "espion")) {
        *compte.entry(genre(u)).or_insert(0.0) += 1.0;
    }
    let total: f64 = compte.values().sum::<f64>() + 1.0;
    let cav = if p.royaumes[id as usize].caractere == "guerrier" { 0.3 } else { 0.22 };
    let art = if artillerie { 0.2 } else { 0.05 };
    let voulu = [("artillerie", art), ("cavalerie", cav), ("infanterie", 1.0 - art - cav)];
    let manque = |g: &str| voulu.iter().find(|v| v.0 == g).map_or(0.0, |v| v.1 * total) - compte.get(g).copied().unwrap_or(0.0);
    let g = voulu.iter().map(|v| v.0).filter(|g| dispo.iter().any(|d| genre(&d.0) == *g)).max_by(|a, b| manque(a).total_cmp(&manque(b)))?;
    let qualite = |u: &str| regles().unite(u).map_or(0.0, |d| d.att * d.siege.max(1.0) + d.def);
    dispo.into_iter().filter(|d| genre(&d.0) == g).max_by(|a, b| qualite(&a.0).total_cmp(&qualite(&b.0)))
}

/// Le recrutement : au vrai coût des unités, sans dépasser ce que le revenu peut entretenir (bien plus en
/// guerre qu'en paix), là où l'on en a besoin (le rassemblement de la campagne, la place en déficit).
fn recrutement(p: &mut Partie, c: &Ctx) {
    let id = c.id;
    let k = id as usize;
    let camp = p.royaumes[k].militaire.campagne.clone();
    let artillerie = camp.as_ref().is_some_and(|cp| p.ville_a(cp.cible).is_some_and(|vi| p.murs_ville(vi) > 0.0))
        || p.villes.iter().any(|v| c.ennemis.contains(&v.proprio) && v.fortif > 0 && p.connait(id, v.case));
    let menace = c.places.iter().any(|x| x.menace > 0.0);
    batir(p, c, artillerie, menace);
    let guerrier = if p.royaumes[k].caractere == "guerrier" { 0.08 } else { 0.0 };
    let part = guerrier + if !c.ennemis.is_empty() { 0.45 } else if menace { 0.35 } else { 0.22 };
    // les recrues en formation comptent déjà
    let en_file = p.batiments.iter().filter(|b| b.proprio == id).flat_map(|b| b.file.iter()).filter(|u| !matches!(genre(u), "marine" | "espion")).count();
    let soldats = (p.stats(id).soldats as usize + en_file) as f64;
    let max = plafond(p, id, part);
    if soldats >= max {
        return;
    }
    // en paix, le trésor sert d'abord aux murs et aux chantiers ; en guerre, aux soldats
    let reserve = if !c.ennemis.is_empty() { 60.0 } else if menace { 150.0 } else { 300.0 };
    let n = (1 + p.niveau_capitale(id) / 2 + !c.ennemis.is_empty() as u32).min((max - soldats).ceil() as u32);
    for _ in 0..n {
        let Some((u, bid)) = choisir_unite(p, c, artillerie, reserve) else { return };
        if p.recruter(id, bid, &u).is_err() {
            return;
        }
    }
}

// ------------------------------------------------------------------ marine

/// La case d'eau du port de la ville `vi` de `id`, s'il en a un.
fn port_de(p: &Partie, id: i32, vi: usize) -> Option<usize> {
    let vid = p.villes[vi].id;
    p.batiments.iter().find(|b| b.cle == "port" && b.proprio == id && b.fini() && b.ville == Some(vid)).and_then(|b| p.eau_du_port(b.case))
}

/// Les flottes à l'arrêt de `id` sur une même case (sans armée à bord) se réunissent.
fn reunir_flottes(p: &mut Partie, id: i32, case: usize) -> Option<usize> {
    let mut idx: Vec<usize> = (0..p.flottes.len()).filter(|&i| p.flottes[i].proprio == id && p.flottes[i].case == case && p.flottes[i].chemin.is_empty() && p.flottes[i].armee.is_none()).collect();
    let premier = *idx.first()?;
    while idx.len() > 1 {
        let j = idx.pop().unwrap();
        let f = p.flottes.remove(j);
        for (u, n) in f.navires {
            *p.flottes[premier].navires.entry(u).or_insert(0) += n;
        }
    }
    Some(premier)
}

/// Le convoi de la campagne par mer, s'il est prêt au port de rassemblement : la flotte (les flûtes et
/// l'escorte réunies), sa route vers la côte la plus proche de la cible, et ce qu'elle peut porter.
fn convoi_pret(p: &mut Partie, c: &Ctx, cp: &Campagne) -> Option<(usize, Vec<usize>, u32)> {
    let id = c.id;
    let eau = port_de(p, id, p.ville_a(cp.rassemblement)?)?;
    let fi = reunir_flottes(p, id, eau)?;
    let cap = p.capacite_transport(&p.flottes[fi]);
    if cap < 4 {
        return None;
    }
    // un ordinateur avisé n'embarque pas sans escorte quand l'ennemi a des navires de guerre
    if c.niv >= 0.5 && !p.de_guerre(&p.flottes[fi]) && c.flottes.iter().any(|f| f.3) {
        return None;
    }
    let mut eaux: Vec<usize> = p.carte.rayon(cp.cible, 4).into_iter().filter(|&x| !p.carte.cases[x].terre() && p.carte.voisins(x).iter().any(|&v| p.praticable(v))).collect();
    eaux.sort_by_key(|&x| p.carte.dist(x, cp.cible));
    let ch = eaux.into_iter().take(5).find_map(|e| p.chemin_mer(eau, e).filter(|ch| !ch.is_empty()))?;
    Some((fi, ch, cap))
}

/// La marine : convois qui débarquent près de la cible, flottes de guerre qui fuient plus fort qu'elles,
/// chassent plus faible, bloquent la place assiégée (ou visée) ; flûtes au commerce ou au rassemblement ;
/// navires neufs selon le besoin (transport de la campagne, escorte, flotte ennemie).
fn marine(p: &mut Partie, c: &Ctx) {
    let id = c.id;
    let k = id as usize;
    let ports: Vec<usize> = p.batiments.iter().filter(|b| b.proprio == id && b.cle == "port" && b.fini()).map(|b| b.case).collect();
    let camp = p.royaumes[k].militaire.campagne.clone();
    let mer_rassemblement = camp.as_ref().filter(|cp| cp.mer && cp.armee.is_none()).and_then(|cp| p.ville_a(cp.rassemblement)).and_then(|vi| port_de(p, id, vi));
    // les places à bloquer : ses sièges, la cible de la campagne, la ville ennemie connue la plus proche
    let mut blocus: Vec<usize> = p.sieges.iter().filter(|s| s.assiegeant == id && !s.fort).map(|s| s.case).collect();
    blocus.extend(camp.as_ref().filter(|cp| p.ville_a(cp.cible).is_some()).map(|cp| cp.cible));
    blocus.extend(p.villes.iter().filter(|v| c.ennemis.contains(&v.proprio) && p.connait(id, v.case)).min_by_key(|v| p.carte.dist(v.case, c.capitale)).map(|v| v.case));
    blocus.retain(|&v| p.carte.voisins(v).iter().any(|&x| !p.carte.cases[x].terre()));
    let au_port = |p: &Partie, case: usize| ports.iter().filter_map(|&b| p.eau_du_port(b)).min_by_key(|&e| p.carte.dist(e, case));
    for fi in 0..p.flottes.len() {
        let f = &p.flottes[fi];
        if f.proprio != id || !f.chemin.is_empty() {
            continue;
        }
        let case = f.case;
        if f.armee.is_some() {
            // convoi arrivé : débarquer près de la cible (en guerre), sinon chez soi
            let vers = f.cible.filter(|&t| maitre(p, t).is_some_and(|(m, _)| c.ennemis.contains(&m)));
            let chez_soi = ports.iter().any(|&b| p.carte.dist(b, case) <= 1) || p.carte.voisins(case).iter().any(|&x| p.carte.cases[x].proprio == id);
            if vers.is_some() || chez_soi {
                let but = vers.unwrap_or(c.capitale);
                if let Some(t) = p.carte.voisins(case).into_iter().filter(|&x| p.peut_debarquer(fi, x).is_ok()).min_by_key(|&x| p.carte.dist(x, but)) {
                    let aid = p.debarquer(fi, t);
                    p.flottes[fi].cible = None;
                    if let (Some(ai), Some(suite)) = (p.armee(aid), p.chemin(t, but)) {
                        p.armees[ai].chemin.extend(suite);
                    }
                }
            } else if let Some(ch) = au_port(p, case).and_then(|e| p.chemin_mer(case, e)) {
                p.flottes[fi].cible = None;
                p.flottes[fi].chemin = ch;
            }
            continue;
        }
        let (at, de) = (p.force_navale(f, true), p.force_navale(f, false));
        if p.de_guerre(f) && mer_rassemblement != Some(case) {
            // fuir une flotte bien plus forte, chasser une plus faible (sauf si le convoi attend son escorte)
            let danger: f64 = c.flottes.iter().filter(|x| p.carte.dist(x.0, case) <= 4).map(|x| x.1).sum();
            if danger > (1.2 + (1.0 - c.niv)) * de {
                if let Some(ch) = au_port(p, case).filter(|&e| e != case).and_then(|e| p.chemin_mer(case, e)) {
                    p.flottes[fi].commerce = false;
                    p.flottes[fi].chemin = ch;
                    continue;
                }
            }
            let ratio = 0.9 + 0.6 * c.niv;
            let proie = c.flottes.iter().filter(|x| p.carte.dist(x.0, case) <= 8 && x.2 * ratio < at).min_by_key(|x| p.carte.dist(x.0, case)).map(|x| x.0);
            if let Some(ch) = proie.filter(|_| mer_rassemblement.is_none()).and_then(|x| p.chemin_mer(case, x)).filter(|ch| !ch.is_empty()) {
                p.flottes[fi].commerce = false;
                p.flottes[fi].chemin = ch;
                continue;
            }
            if let Some(&v) = blocus.first().filter(|_| mer_rassemblement.is_none()) {
                if p.carte.dist(v, case) > 1 {
                    let mut eaux: Vec<usize> = p.carte.voisins(v).into_iter().filter(|&x| !p.carte.cases[x].terre()).collect();
                    eaux.sort_by_key(|&x| p.carte.dist(x, case));
                    if let Some(ch) = eaux.into_iter().take(3).find_map(|e| p.chemin_mer(case, e)).filter(|ch| !ch.is_empty()) {
                        p.flottes[fi].commerce = false;
                        p.flottes[fi].chemin = ch;
                    }
                }
                continue;
            }
        }
        // le rassemblement d'une campagne par mer appelle les flûtes et l'escorte
        if let Some(e) = mer_rassemblement {
            if case != e {
                if let Some(ch) = p.chemin_mer(case, e) {
                    p.flottes[fi].commerce = false;
                    p.flottes[fi].chemin = ch;
                }
            }
            continue;
        }
        let a_quai = p.port_voisin(&p.flottes[fi]).is_some();
        if !a_quai {
            if let Some(ch) = au_port(p, case).and_then(|e| p.chemin_mer(case, e)) {
                p.flottes[fi].chemin = ch;
            }
        } else if p.flutes(&p.flottes[fi]) > 0 {
            p.flottes[fi].commerce = true;
        }
    }
    // navires neufs
    // au port de rassemblement d'une campagne par mer, sinon au premier port
    let rade = mer_rassemblement.and_then(|e| ports.iter().copied().find(|&b| p.eau_du_port(b) == Some(e)));
    let Some(port) = rade.or(ports.first().copied()) else { return };
    let Some(port) = p.batiments.iter().find(|b| b.proprio == id && b.cle == "port" && b.case == port).map(|b| b.id) else { return };
    let mine: Vec<&crate::partie::Flotte> = p.flottes.iter().filter(|f| f.proprio == id).collect();
    let navires: u32 = mine.iter().map(|f| f.navires.values().sum::<u32>()).sum();
    let transport: u32 = mine.iter().map(|f| p.capacite_transport(f)).sum();
    let guerre_navires: u32 = mine.iter().flat_map(|f| f.navires.iter()).filter(|(u, _)| regles().unite(u).is_some_and(|d| d.guerre())).map(|(_, &n)| n).sum();
    let besoin_transport = if camp.as_ref().is_some_and(|cp| cp.mer) { (p.stats(id).soldats as u32 / 2).max(15) } else { 15 };
    let besoin_guerre = if c.ennemis.is_empty() { 1 } else { 2 + c.flottes.iter().filter(|f| f.3).count() as u32 };
    if navires >= 10 || !p.hasard.p(0.25) {
        return;
    }
    let dispo = p.unites_dispo(id, "port");
    let u = if transport < besoin_transport {
        dispo.iter().filter(|u| regles().unite(u).is_some_and(|d| d.transport > 0)).max_by_key(|u| regles().unite(u).map_or(0, |d| d.transport))
    } else if guerre_navires < besoin_guerre {
        dispo.iter().filter(|u| regles().unite(u).is_some_and(|d| d.guerre())).max_by(|a, b| regles().unite(a).unwrap().att.total_cmp(&regles().unite(b).unwrap().att))
    } else {
        None
    };
    if let Some(u) = u.cloned() {
        let cout = cout_recrue(p, id, &u);
        if peut_depenser(p, k, &cout, 150.0) {
            let _ = p.recruter(id, port, &u);
        }
    }
}

// ------------------------------------------------------------------ espionnage

/// Les espions : vers la cible de la campagne (sinon la ville ennemie connue la plus proche, ou le joueur
/// qu'on déteste) ; renseignement d'abord, puis sabotage (l'arsenal, la caserne : `espions`).
fn espionnage(p: &mut Partie, c: &Ctx) {
    let id = c.id;
    let k = id as usize;
    let camp = p.royaumes[k].militaire.campagne.as_ref().map(|cp| cp.cible).filter(|&x| p.ville_a(x).is_some());
    let hait = p.royaumes[k].relation < 10.0;
    let cible = camp.or_else(|| {
        p.villes.iter().filter(|v| (c.ennemis.contains(&v.proprio) || (hait && v.proprio == 0)) && p.connait(id, v.case)).min_by_key(|v| p.carte.dist(v.case, c.capitale)).map(|v| v.case)
    });
    let Some(cible) = cible else { return };
    let vi = p.ville_a(cible).unwrap();
    let tour = p.tour;
    let revele = p.royaumes[k].revele.iter().any(|r| r[2] > tour && p.carte.dist(r[0] as usize, cible) + 1 < r[1] as i32);
    for ei in 0..p.espions.len() {
        let e = &p.espions[ei];
        if e.proprio != id || e.mission.is_some() || !e.chemin.is_empty() {
            continue;
        }
        if p.carte.dist(e.case, cible) <= 1 {
            let genre = if p.hasard.p(1.0 - c.niv) { ["renseignement", "vol", "sabotage"][p.hasard.indice(3)] } else if revele { "sabotage" } else { "renseignement" };
            if p.peut_lancer(ei, genre, vi).is_ok() {
                p.lancer_mission(ei, genre, vi);
            }
        } else if let Some(ch) = p.chemin(e.case, cible) {
            p.espions[ei].chemin = ch;
        }
    }
    // (les espions en formation à la taverne comptent déjà)
    let nb = p.espions.iter().filter(|e| e.proprio == id).count() + p.batiments.iter().filter(|b| b.proprio == id).flat_map(|b| b.file.iter()).filter(|u| *u == "espion").count();
    let cout = cout_recrue(p, id, "espion");
    let voulus = if camp.is_some() && c.niv >= 0.7 { 2 } else { 1 };
    let chance = if camp.is_some() { 0.1 + 0.4 * c.niv } else { 0.08 };
    let Some(taverne) = p.batiments.iter().find(|b| b.proprio == id && b.cle == "taverne" && b.fini()).map(|b| b.id) else { return };
    if nb >= voulus || !peut_depenser(p, k, &cout, 20.0) || !p.hasard.p(chance) {
        return;
    }
    let _ = p.recruter(id, taverne, "espion");
}

// ------------------------------------------------------------------ forts et exploration

/// Retranchements et forts : ses armées se retranchent devant une place assiégée, sur une case frontalière
/// ou sur leur fort ; de temps en temps un détachement part bâtir une redoute sur une case frontalière ou
/// côtière ; un fort tenu s'améliore quand les moyens le permettent ; en guerre, un fort ennemi vide est une proie.
fn forts(p: &mut Partie, c: &Ctx) {
    let (id, k) = (c.id, c.id as usize);
    let rg = regles();

    for i in 0..p.armees.len() {
        let a = &p.armees[i];
        if a.proprio == id && a.effectif() > 1 && p.peut_retrancher(a).is_ok() && (p.assiege(id, a.case) || p.tient_un_poste(a) || exposition(p, id, a.case) == 2) {
            p.armees[i].retranche = Some(rg.retranchement.duree.max(1));
        }
    }
    // le détachement arrivé sur le chantier prévu bâtit la redoute (s'il a péri en route, le projet tombe)
    if let Some(site) = p.royaumes[k].projet_fort {
        if let Some(ai) = p.armees.iter().position(|a| a.proprio == id && a.case == site && a.chemin.is_empty()) {
            p.royaumes[k].projet_fort = None;
            if p.peut_construire_fort(&p.armees[ai]).is_ok_and(|d| peut_depenser(p, k, &d.cout, 0.0)) {
                let _ = p.construire_fort(id, ai);
            }
        } else if !p.armees.iter().any(|a| a.proprio == id && a.chemin.last() == Some(&site)) {
            p.royaumes[k].projet_fort = None;
        }
    }
    // un fort tenu s'améliore
    for fi in 0..p.forts.len() {
        if p.forts[fi].proprio != id {
            continue;
        }
        let Ok(d) = p.peut_ameliorer_fort(fi) else { continue };
        if peut_depenser(p, k, &d.cout, 150.0) && p.hasard.p(0.2) {
            let _ = p.ameliorer_fort(id, fi);
        }
    }
    let cap = c.capitale;
    let Some(g) = arretee(p, id, cap) else { return };
    // en guerre, un fort ennemi sans garnison, connu et à portée, est une proie
    if !c.ennemis.is_empty() {
        let proie = p.forts.iter()
            .filter(|f| c.ennemis.contains(&f.proprio) && !p.garnison(f.proprio, f.case) && p.connait(id, f.case) && p.carte.dist(f.case, cap) <= 12)
            .filter(|f| !p.armees.iter().any(|a| a.proprio == id && a.chemin.last() == Some(&f.case)))
            .min_by_key(|f| p.carte.dist(f.case, cap))
            .map(|f| f.case);
        if let Some(fc) = proie {
            let pris = choisir(&libres(p, g, c.garde(cap)), 2.0, |_| 1.0, |u| if genre(u) == "cavalerie" { 1.0 } else { 0.0 });
            if pris.values().sum::<u32>() >= 2 && envoyer(p, g, pris, fc).is_some() {
                return;
            }
        }
    }
    // de temps en temps, un détachement part bâtir une redoute sur une case frontalière ou côtière
    let Some(d) = rg.fort(1) else { return };
    let nb = p.forts.iter().filter(|f| f.proprio == id).count();
    let guerre = !c.ennemis.is_empty();
    if p.royaumes[k].projet_fort.is_some() || nb >= c.villes.len() || !peut_depenser(p, k, &d.cout, 200.0) || p.armees[g].effectif() < 8 {
        return;
    }
    if !p.hasard.p(if guerre { 0.1 } else { 0.03 }) {
        return;
    }
    let site = c.villes
        .iter()
        .flat_map(|&vi| p.carte.rayon(p.villes[vi].case, 5))
        .filter(|&x| exposition(p, id, x) > 0 && p.site_de_fort(id, x).is_ok())
        .max_by_key(|&x| (exposition(p, id, x), Reverse(p.carte.dist(x, cap)), Reverse(x)));
    let Some(site) = site else { return };
    let l = libres(p, g, c.garde(cap));
    let mut pris = choisir(&l, 3.0, |_| 1.0, def_unite);
    if pris.values().sum::<u32>() < 2 {
        // la garnison reste, mais la redoute vaut bien deux hommes de la capitale
        pris = choisir(&p.armees[g].unites.clone(), 2.0, |_| 1.0, def_unite);
        if p.armees[g].effectif() <= 4 {
            return;
        }
    }
    if envoyer(p, g, pris, site).is_some() {
        p.royaumes[k].projet_fort = Some(site);
    }
}

/// La case de terre inexplorée la plus proche, à pied depuis `de`.
fn inconnue_proche(p: &Partie, id: i32, de: usize) -> Option<usize> {
    let mut vu = vec![false; p.carte.cases.len()];
    let mut file = VecDeque::from([de]);
    vu[de] = true;
    while let Some(x) = file.pop_front() {
        if !p.connait(id, x) {
            return Some(x);
        }
        for v in p.carte.voisins(x) {
            if !vu[v] && p.praticable(v) {
                vu[v] = true;
                file.push_back(v);
            }
        }
    }
    None
}

/// L'exploration : de temps en temps (souvent en guerre si l'on ne sait où frapper), un éclaireur
/// — un cavalier si possible — quitte la garnison vers la terre inconnue la plus proche, et poursuit.
fn exploration(p: &mut Partie, c: &Ctx) {
    let (id, cap) = (c.id, c.capitale);
    let perdu = !c.ennemis.is_empty() && !p.villes.iter().any(|v| c.ennemis.contains(&v.proprio) && p.connait(id, v.case));
    // l'éclaireur arrivé (ou que la marche renvoie au logis) poursuit vers la prochaine terre inconnue
    for i in 0..p.armees.len() {
        let a = &p.armees[i];
        let rentre = a.chemin.is_empty() || a.chemin.last().is_some_and(|&l| c.place(l).is_some());
        if a.proprio == id && a.effectif() <= 1 && rentre && a.case != cap && c.place(a.case).is_none() {
            if let Some(ch) = inconnue_proche(p, id, a.case).and_then(|x| p.chemin(p.armees[i].case, x)) {
                p.armees[i].chemin = ch;
            }
        }
    }
    // un ordinateur avisé qui ne sait où frapper lance deux éclaireurs
    let eclaireurs = p.armees.iter().filter(|a| a.proprio == id && a.effectif() <= 1 && !a.chemin.is_empty()).count();
    if !p.hasard.p(if perdu { 0.5 } else { 0.15 }) || eclaireurs >= 1 + (perdu && c.niv >= 0.6) as usize {
        return;
    }
    let Some(g) = p.armees.iter().position(|a| a.proprio == id && a.case == cap && a.chemin.is_empty() && a.effectif() >= 4) else { return };
    let Some(ch) = inconnue_proche(p, id, cap).and_then(|x| p.chemin(cap, x)) else { return };
    let u = p.armees[g].unites.keys().find(|u| genre(u) == "cavalerie").or_else(|| p.armees[g].unites.keys().next()).cloned().unwrap();
    detacher(p, g, BTreeMap::from([(u, 1)]), ch);
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;
    use crate::partie::Siege;
    use crate::regles::Panier;

    const FACILE: f64 = 0.75;
    const DIFFICILE: f64 = 1.35;

    /// Une partie sans brigands où le royaume 1 est en guerre contre le joueur ; `None` si sa capitale
    /// n'est pas reliée à pied à celle du joueur.
    fn en_guerre(graine: u64, difficulte: f64) -> Option<Partie> {
        let mut p = Partie::nouvelle(Options { graine, difficulte, brigands: false, ..Options::default() });
        p.royaumes[1].statut = "guerre".into();
        p.chemin(cap(&p, 1), cap(&p, 0)).filter(|ch| ch.len() >= 6).map(|_| p)
    }

    fn cap(p: &Partie, id: i32) -> usize {
        p.villes[p.capitale(id).unwrap()].case
    }

    /// Les troupes de `id` à l'arrêt sur la case sont remplacées par `u`.
    fn garnison(p: &mut Partie, id: i32, case: usize, u: &[(&str, u32)]) {
        p.armees.retain(|a| !(a.proprio == id && a.case == case));
        p.creer_armee(id, case, u.iter().map(|(k, n)| (k.to_string(), *n)).collect());
    }

    /// L'or en caisse du royaume `k`.
    fn fixer_or(p: &mut Partie, k: usize, v: f64) {
        p.royaumes[k].stock.insert("or".into(), v);
    }

    /// Un royaume riche : de l'or, des matériaux, des armes, du fer et du blé en abondance, du monde, et les revenus qui vont avec.
    fn riche(p: &mut Partie, k: usize) {
        for (r, v) in [("or", 100000.0), ("bois", 900.0), ("planches", 900.0), ("pierre", 900.0), ("outils", 300.0), ("armes", 300.0), ("fer", 300.0), ("ble", 400.0)] {
            p.royaumes[k].stock.insert(r.into(), v);
        }
        p.royaumes[k].pop = 300;
        p.royaumes[k].revenus.insert("impots".into(), 3000.0);
    }

    /// Les troupes de `id`, par unité, sous les armes ou en formation.
    fn troupes(p: &Partie, id: i32) -> BTreeMap<String, u32> {
        let mut m: BTreeMap<String, u32> = BTreeMap::new();
        for a in p.armees.iter().filter(|a| a.proprio == id) {
            for (u, &n) in &a.unites {
                *m.entry(u.clone()).or_insert(0) += n;
            }
        }
        for u in p.batiments.iter().filter(|b| b.proprio == id).flat_map(|b| b.file.iter()) {
            *m.entry(u.clone()).or_insert(0) += 1;
        }
        m
    }

    /// `id` voit la zone (le rapport d'un espion).
    fn voir(p: &mut Partie, id: i32, case: usize, r: i32) {
        let fin = p.tour + 24;
        p.royaumes[id as usize].revele.push([case as u32, r as u32, fin]);
        p.decouvrir(id, case, r);
    }

    /// Une ville neuve pour `id` sur le chemin de sa capitale vers celle du joueur (à mi-distance environ).
    fn ville_avancee(p: &mut Partie, id: i32) -> Option<usize> {
        let ch = p.chemin(cap(p, id), cap(p, 0))?;
        let c = ch[ch.len() / 3..ch.len() * 2 / 3].iter().copied().find(|&c| p.carte.cases[c].bat.is_none() && p.villes.iter().all(|v| p.carte.dist(v.case, c) >= 4))?;
        let vi = p.fonder_ville(id, c, "Avant-Poste".into(), 2, false);
        p.recalculer_territoire();
        Some(vi)
    }

    /// Les armées de `id` en marche vers la case.
    fn vers(p: &Partie, id: i32, case: usize) -> Vec<usize> {
        (0..p.armees.len()).filter(|&i| p.armees[i].proprio == id && p.armees[i].chemin.last() == Some(&case)).collect()
    }

    fn mois_seul(p: &mut Partie, k: usize) -> Rapport {
        let mut r = Rapport::default();
        mois(p, k, &mut r);
        r
    }

    #[test]
    fn l_ordinateur_ne_frappe_que_ce_qu_il_connait() {
        let mut p = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        let c0 = cap(&p, 0);
        let c1 = cap(&p, 1);
        garnison(&mut p, 1, c1, &[("grenadier", 40)]);
        fixer_or(&mut p, 1, 0.0);
        mois_seul(&mut p, 1);
        assert!(p.royaumes[1].militaire.campagne.is_none() && vers(&p, 1, c0).is_empty(), "le joueur est inconnu : pas de campagne");
        voir(&mut p, 1, c0, 2);
        let r = mois_seul(&mut p, 1);
        assert_eq!(p.royaumes[1].militaire.campagne.as_ref().map(|c| c.cible), Some(c0), "la capitale du joueur est la proie");
        assert_eq!(vers(&p, 1, c0).len(), 1, "une seule armée, groupée");
        assert!(r.evenements.iter().any(|e| e.texte.contains("marche sur")), "le joueur est prévenu");
    }

    #[test]
    fn une_place_trop_forte_on_attend() {
        let mut n = 0;
        for g in 1..60 {
            let Some(mut p) = en_guerre(g, DIFFICILE) else { continue };
            let (c0, c1) = (cap(&p, 0), cap(&p, 1));
            garnison(&mut p, 1, c1, &[("mousquetaire", 20)]);
            garnison(&mut p, 0, c0, &[("grenadier", 60)]);
            voir(&mut p, 1, c0, 2);
            fixer_or(&mut p, 1, 0.0);
            for _ in 0..6 {
                mois_seul(&mut p, 1);
            }
            let cp = p.royaumes[1].militaire.campagne.as_ref().expect("une campagne est préparée");
            assert!(cp.armee.is_none() && vers(&p, 1, c0).is_empty(), "graine {g} : on ne se jette pas sur 60 grenadiers");
            n += 1;
            if n == 4 {
                return;
            }
        }
        panic!("trop peu de cartes");
    }

    #[test]
    fn rassembler_puis_attaquer() {
        for g in 1..80 {
            let Some(mut p) = en_guerre(g, DIFFICILE) else { continue };
            let Some(vi) = ville_avancee(&mut p, 1) else { continue };
            let (c0, c1, av) = (cap(&p, 0), cap(&p, 1), p.villes[vi].case);
            garnison(&mut p, 1, c1, &[("grenadier", 40)]);
            garnison(&mut p, 1, av, &[("mousquetaire", 3)]);
            garnison(&mut p, 0, c0, &[("mousquetaire", 8)]);
            voir(&mut p, 1, c0, 2);
            fixer_or(&mut p, 1, 0.0);
            mois_seul(&mut p, 1);
            let Some(cp) = p.royaumes[1].militaire.campagne.clone() else { continue };
            if cp.rassemblement != av {
                continue;
            }
            assert!(cp.armee.is_none() && vers(&p, 1, c0).is_empty(), "l'avant-poste seul est trop faible : on rassemble");
            let renforts = vers(&p, 1, av);
            assert!(!renforts.is_empty(), "la capitale envoie des troupes au rassemblement");
            // elles arrivent : l'armée part, en un seul corps
            for i in renforts {
                (p.armees[i].case, p.armees[i].chemin) = (av, Vec::new());
            }
            mois_seul(&mut p, 1);
            let parties = vers(&p, 1, c0);
            assert_eq!(parties.len(), 1, "une armée groupée marche sur la capitale du joueur");
            assert!(p.armees[parties[0]].effectif() >= 12);
            assert!(p.armees.iter().any(|a| a.proprio == 1 && a.case == av && a.chemin.is_empty()), "l'avant-poste garde sa garnison");
            return;
        }
        panic!("aucune carte où rassembler");
    }

    #[test]
    fn se_replier_devant_une_armee_bien_superieure() {
        for g in 1..40 {
            let Some(mut p) = en_guerre(g, DIFFICILE) else { continue };
            let c1 = cap(&p, 1);
            let ch = p.chemin(c1, cap(&p, 0)).unwrap();
            let (x, y) = (ch[3], ch[5]);
            if p.ville_a(x).is_some() || p.ville_a(y).is_some() {
                continue;
            }
            let a = p.creer_armee(1, x, BTreeMap::from([("milice".to_string(), 5)]));
            p.creer_armee(0, y, BTreeMap::from([("grenadier".to_string(), 40)]));
            voir(&mut p, 1, y, 1);
            let r = mois_seul(&mut p, 1);
            let ai = p.armee(a).unwrap();
            let fin = p.armees[ai].chemin.last().copied();
            assert!(fin.is_some_and(|c| p.ville_a(c).is_some_and(|vi| p.villes[vi].proprio == 1)), "l'armée rentre dans une de ses villes");
            assert!(r.evenements.iter().any(|e| e.texte.contains("se replie")));
            return;
        }
        panic!("aucune carte");
    }

    /// Une partie où le royaume 1 a une seconde ville, et la case d'une armée du joueur qui la menace (à 5 ou 6 cases, hors de ses terres).
    fn ville_menacee(g: u64) -> Option<(Partie, usize, usize)> {
        let mut p = en_guerre(g, DIFFICILE)?;
        let vi = ville_avancee(&mut p, 1)?;
        let b = p.villes[vi].case;
        let z = p.carte.rayon(b, 6).into_iter().find(|&z| {
            p.carte.dist(z, b) >= 5 && p.praticable(z) && p.carte.cases[z].proprio != 1 && p.ville_a(z).is_none() && p.villes.iter().filter(|v| v.proprio == 1).all(|v| p.carte.dist(v.case, z) > 3)
        })?;
        let c1 = cap(&p, 1);
        garnison(&mut p, 1, c1, &[("mousquetaire", 40)]);
        garnison(&mut p, 1, b, &[("milice", 1)]);
        fixer_or(&mut p, 1, 0.0);
        Some((p, b, z))
    }

    #[test]
    fn renforts_vers_la_ville_menacee() {
        for g in 1..80 {
            let Some((mut p, b, z)) = ville_menacee(g) else { continue };
            let mut sans = p.clone();
            p.creer_armee(0, z, BTreeMap::from([("grenadier".to_string(), 40)]));
            voir(&mut p, 1, z, 1);
            let envoye = |p: &Partie| vers(p, 1, b).iter().map(|&i| p.defense(&p.armees[i])).sum::<f64>();
            for _ in 0..3 {
                mois_seul(&mut p, 1);
                mois_seul(&mut sans, 1);
            }
            assert!(envoye(&p) >= 60.0, "graine {g} : la ville menacée reçoit de quoi tenir ({})", envoye(&p));
            assert!(envoye(&p) > 2.0 * envoye(&sans), "bien plus qu'en temps calme ({} contre {})", envoye(&p), envoye(&sans));
            assert!(p.armees.iter().any(|a| a.proprio == 1 && a.case == cap(&p, 1)), "la capitale garde sa garnison");
            return;
        }
        panic!("aucune carte");
    }

    #[test]
    fn secourir_une_ville_assiegee() {
        for g in 1..80 {
            let Some((mut p, b, _)) = ville_menacee(g) else { continue };
            let vi = p.ville_a(b).unwrap();
            p.villes[vi].fortif = 1;
            let a = p.creer_armee(0, b, BTreeMap::from([("mousquetaire".to_string(), 8)]));
            p.commencer_siege(a, vi, &mut Rapport::default());
            let mut r = Rapport::default();
            for _ in 0..3 {
                r = mois_seul(&mut p, 1);
                if !vers(&p, 1, b).is_empty() {
                    break;
                }
            }
            let secours = vers(&p, 1, b);
            assert!(!secours.is_empty(), "graine {g} : une armée de secours part");
            let at: f64 = secours.iter().map(|&i| p.attaque(&p.armees[i], false, 1.0)).sum();
            assert!(at > 32.0 * 1.2, "assez forte pour battre les assiégeants ({at})");
            assert!(r.evenements.iter().any(|e| e.texte.contains("secours")));
            // elle arrive et lève le siège
            for _ in 0..4 {
                p.royaumes[1].statut = "guerre".into();
                p.fin_du_mois();
            }
            assert!(p.siege_de(p.villes[vi].id).is_none() && p.villes[vi].proprio == 1, "le siège est levé");
            return;
        }
        panic!("aucune carte");
    }

    #[test]
    fn de_l_artillerie_contre_une_place_muree() {
        let mut p = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        let (c0, c1) = (cap(&p, 0), cap(&p, 1));
        let ci = p.capitale(1).unwrap();
        p.villes[ci].niveau = 3;
        for cle in ["caserne", "haras", "arsenal"] {
            let site = p.carte.rayon(c1, 3).into_iter().find(|&x| p.peut_construire(cle, x, 1).is_ok()).unwrap();
            p.poser(cle, site, 1, true);
        }
        p.villes[0].fortif = 2;
        voir(&mut p, 1, c0, 2);
        let compter = |p: &Partie| {
            let mut n: BTreeMap<&str, u32> = BTreeMap::new();
            for (u, k) in troupes(p, 1) {
                *n.entry(genre(&u)).or_insert(0) += k;
            }
            n
        };
        for _ in 0..24 {
            riche(&mut p, 1);
            let c = Ctx::new(&mut p, 1);
            recrutement(&mut p, &c);
        }
        let n = compter(&p);
        let total: u32 = n.values().sum();
        assert!(n.get("artillerie").copied().unwrap_or(0) as f64 >= 0.12 * total as f64, "des canons pour le siège : {n:?}");
        assert!(n.get("cavalerie").copied().unwrap_or(0) > 0 && n.get("infanterie").copied().unwrap_or(0) > n.get("cavalerie").copied().unwrap_or(0), "{n:?}");
    }

    #[test]
    fn payer_le_vrai_cout_et_respecter_l_entretien() {
        let mut p = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        let c1 = cap(&p, 1);
        for cle in ["caserne", "haras"] {
            if !p.batiments.iter().any(|b| b.proprio == 1 && b.cle == cle) {
                let site = p.carte.rayon(c1, 3).into_iter().find(|&x| p.peut_construire(cle, x, 1).is_ok()).unwrap();
                p.poser(cle, site, 1, true);
            }
        }
        let avant = troupes(&p, 1);
        let stock = p.royaumes[1].stock.clone();
        riche(&mut p, 1);
        p.royaumes[1].stock = stock.clone();
        for (r, v) in [("or", 2000.0), ("armes", 50.0), ("ble", 300.0), ("bois", 300.0)] {
            p.royaumes[1].stock.insert(r.into(), v);
        }
        let reserves = p.royaumes[1].stock.clone();
        let c = Ctx::new(&mut p, 1);
        recrutement(&mut p, &c);
        // chaque recrue en formation est payée à son vrai prix, dans les réserves
        let mut depense = Panier::new();
        for (u, n) in troupes(&p, 1) {
            for (r, q) in cout_recrue(&p, 1, &u) {
                *depense.entry(r).or_insert(0.0) += q * n.saturating_sub(avant.get(&u).copied().unwrap_or(0)) as f64;
            }
        }
        assert!(depense.get("or").copied().unwrap_or(0.0) > 25.0, "on a recruté");
        for (r, q) in &depense {
            assert!((reserves[r] - q - p.royaumes[1].stock[r]).abs() < 1e-6, "{r} : chaque recrue coûte son vrai prix ({depense:?})");
        }
        // la solde n'est pas payée ici (l'entretien du mois la prélève, tour.rs)
        let or = p.royaumes[1].stock["or"];
        entretien(&mut p, 1);
        assert_eq!(p.royaumes[1].stock["or"], or, "la solde n'est payée qu'une fois, avec l'entretien du mois");
        // au-delà de ce que le revenu entretient, on ne recrute plus
        garnison(&mut p, 1, c1, &[("mousquetaire", 300)]);
        p.batiments.iter_mut().for_each(|b| b.file.clear());
        p.royaumes[1].revenus.insert("impots".into(), 50.0);
        fixer_or(&mut p, 1, 5000.0);
        let c = Ctx::new(&mut p, 1);
        recrutement(&mut p, &c);
        assert!(troupes(&p, 1).values().sum::<u32>() == 300, "pas de recrue au-delà de l'entretien possible");
        // trésor vide et comptes dans le rouge : des soldats désertent
        fixer_or(&mut p, 1, 0.0);
        p.royaumes[1].revenus.insert("entretien".into(), 200.0);
        entretien(&mut p, 1);
        assert!(p.stats(1).soldats < 300);
        // en paix prolongée, on démobilise
        p.royaumes[1].statut = "paix".into();
        p.royaumes[1].militaire.paix = 30;
        fixer_or(&mut p, 1, 5000.0);
        let n = p.stats(1).soldats;
        entretien(&mut p, 1);
        assert!(p.stats(1).soldats < n, "démobilisation");
        // le vrai cycle du mois : la solde est prélevée une fois, avec l'entretien des bâtiments
        let mut q = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        let c1 = cap(&q, 1);
        garnison(&mut q, 1, c1, &[("mousquetaire", 40)]);
        q.fin_du_mois();
        let st = q.stats(1);
        let solde = st.soldats as f64 * 0.5 + st.entretien_flotte + q.entretien_forts(1);
        let nb_bat = q.batiments.iter().filter(|b| b.proprio == 1 && b.fini()).count() as f64;
        let e = q.royaumes[1].revenus["entretien"] - q.royaumes[1].revenus["eclairage"];
        assert!((e - solde - nb_bat * 0.2).abs() < 3.0, "entretien {e}, solde {solde}");
    }

    /// Une partie où le royaume `k` n'est pas relié à pied au joueur : sa capitale reçoit un port, deux flûtes
    /// et une corvette, une armée, et il connaît la capitale du joueur.
    fn outre_mer(g: u64) -> Option<(Partie, usize)> {
        let mut p = Partie::nouvelle(Options { graine: g, oceans: 60, brigands: false, difficulte: DIFFICILE, ..Options::default() });
        let c0 = cap(&p, 0);
        let k = (1..p.royaumes.len()).find(|&k| p.chemin(p.villes[k].case, c0).is_none())?;
        let id = k as i32;
        let c = p.villes[k].case;
        let vid = p.villes[k].id;
        let port = p.carte.rayon(c, 3).into_iter().find(|&x| p.carte.cases[x].bat.is_none() && p.praticable(x) && p.carte.voisins(x).iter().any(|&v| p.carte.cases[v].mer()))?;
        let b = p.poser("port", port, id, true);
        p.batiments.iter_mut().find(|x| x.id == b).unwrap().ville = Some(vid);
        for u in ["flute", "flute", "corvette"] {
            p.recruter_dans(id, u, port);
        }
        if p.flottes.iter().filter(|f| f.proprio == id).count() != 1 {
            return None;
        }
        voir(&mut p, id, c0, 2);
        p.royaumes[k].statut = "guerre".into();
        fixer_or(&mut p, k, 0.0);
        garnison(&mut p, id, c, &[("mousquetaire", 34)]);
        Some((p, k))
    }

    #[test]
    fn debarquement_escorte() {
        for g in 1..60u64 {
            let Some((mut p, k)) = outre_mer(g) else { continue };
            let (id, c0) = (k as i32, cap(&p, 0));
            let r = mois_seul(&mut p, k);
            let Some(f) = p.flottes.iter().find(|f| f.proprio == id && f.armee.is_some()) else { continue };
            assert!(p.de_guerre(f), "la corvette escorte le convoi");
            assert!(!f.chemin.is_empty() && f.cible == Some(c0), "le convoi part vers la capitale du joueur");
            assert!(f.armee.as_ref().unwrap().effectif() <= p.capacite_transport(f) && f.armee.as_ref().unwrap().effectif() >= 20, "l'armée complète, autant que les flûtes en portent");
            assert!(r.evenements.iter().any(|e| e.texte.contains("s'embarque, escortée")));
            // il navigue, débarque près de la cible et marche
            for _ in 0..24 {
                p.royaumes[k].statut = "guerre".into();
                p.fin_du_mois();
                if p.flottes.iter().all(|f| f.proprio != id || f.armee.is_none()) {
                    break;
                }
            }
            let comp = p.carte.cases[c0].comp;
            assert!(p.armees.iter().any(|a| a.proprio == id && p.carte.cases[a.case].comp == comp) || p.villes[0].proprio == id, "l'armée a débarqué sur la terre du joueur");
            return;
        }
        panic!("aucune carte avec un rival outre-mer");
    }

    #[test]
    fn blocus_combine_au_siege() {
        for g in 1..80u64 {
            let Some(mut p) = en_guerre(g, DIFFICILE) else { continue };
            let c0 = cap(&p, 0);
            let eaux: Vec<usize> = p.carte.voisins(c0).into_iter().filter(|&x| p.carte.cases[x].mer()).collect();
            if eaux.is_empty() {
                continue;
            }
            // une corvette à quelques cases de la côte du joueur
            let Some(depart) = p.carte.rayon(c0, 4).into_iter().find(|&x| p.carte.dist(x, c0) >= 3 && p.carte.cases[x].mer() && p.chemin_mer(x, eaux[0]).is_some()) else { continue };
            let id = p.id();
            p.flottes.push(crate::partie::Flotte { id, proprio: 1, case: depart, navires: BTreeMap::from([("corvette".to_string(), 2)]), ..Default::default() });
            // une garnison qui tient (ni assaut ni sortie) : le siège dure
            p.villes[0].fortif = 1;
            garnison(&mut p, 0, c0, &[("mousquetaire", 25)]);
            let a = p.creer_armee(1, c0, BTreeMap::from([("grenadier".to_string(), 20)]));
            p.commencer_siege(a, 0, &mut Rapport::default());
            p.sieges.retain(|s| s.assiegeant == 1);
            assert!(p.sieges.iter().any(|s: &Siege| s.case == c0));
            let c = Ctx::new(&mut p, 1);
            marine(&mut p, &c);
            let f = p.flottes.iter().find(|f| f.proprio == 1).unwrap();
            assert!(f.chemin.last().is_some_and(|&x| p.carte.dist(x, c0) <= 1), "graine {g} : la flotte vient bloquer la ville assiégée");
            for _ in 0..3 {
                p.fin_du_mois();
                if !p.blocus.is_empty() {
                    break;
                }
            }
            assert!(p.blocus.iter().any(|b| b.case == c0 && b.par == 1), "le port assiégé est bloqué");
            return;
        }
        panic!("aucune carte avec une capitale côtière");
    }

    #[test]
    fn en_facile_des_decisions_pires() {
        // une place que l'on ne peut pas prendre (rapport de forces réel 0,8) : combien s'y jettent ?
        let (mut facile, mut difficile) = (0, 0);
        let mut cartes = 0;
        for g in 1..120 {
            for (d, compte) in [(FACILE, &mut facile), (DIFFICILE, &mut difficile)] {
                let Some(mut p) = en_guerre(g, d) else { continue };
                let (c0, c1) = (cap(&p, 0), cap(&p, 1));
                garnison(&mut p, 1, c1, &[("mousquetaire", 26)]);
                voir(&mut p, 1, c0, 2);
                fixer_or(&mut p, 1, 0.0);
                let ci = p.capitale(0).unwrap();
                let libre = force(&p, 1, &libres(&p, p.armees.len() - 1, 30.0), false);
                let defense = (libre / 0.8 - p.defense_ville(ci)) / terrain(&p, c0);
                garnison(&mut p, 0, c0, &[("grenadier", (defense / 6.0).round().max(1.0) as u32)]);
                for _ in 0..6 {
                    mois_seul(&mut p, 1);
                }
                *compte += p.royaumes[1].militaire.campagne.as_ref().is_some_and(|c| c.armee.is_some()) as u32;
                cartes += (d == FACILE) as u32;
            }
            if cartes >= 20 {
                break;
            }
        }
        println!("attaques perdues d'avance : facile {facile}, difficile {difficile} (sur {cartes} cartes)");
        assert!(cartes >= 10);
        assert!(facile >= 4 && facile > 3 * difficile, "attaques perdues d'avance : facile {facile}, difficile {difficile} (sur {cartes} cartes)");
    }

    #[test]
    fn les_rivaux_batissent_des_forts_s_y_retranchent_et_prennent_les_forts_vides() {
        for g in [42u64, 7, 1, 99, 5, 11, 31, 2024] {
            let mut p = Partie::nouvelle(Options { graine: g, ..Options::default() });
            let c1 = cap(&p, 1);
            riche(&mut p, 1);
            let gi = p.armees.iter().position(|a| a.proprio == 1 && a.case == c1).unwrap();
            p.armees[gi].unites.insert("milice".into(), 20);
            for _ in 0..300 {
                let c = Ctx::new(&mut p, 1);
                forts(&mut p, &c);
                if p.royaumes[1].projet_fort.is_some() {
                    break;
                }
            }
            let Some(site) = p.royaumes[1].projet_fort else { continue };
            assert!(exposition(&p, 1, site) > 0, "une case frontalière ou côtière");
            let a = p.armees.iter().position(|a| a.proprio == 1 && a.chemin.last() == Some(&site)).expect("un détachement part");
            // le détachement arrive : il bâtit la redoute et s'y retranche
            (p.armees[a].case, p.armees[a].chemin) = (site, Vec::new());
            let c = Ctx::new(&mut p, 1);
            forts(&mut p, &c);
            let fi = p.fort_a(site).expect("la redoute est en chantier");
            assert_eq!((p.forts[fi].proprio, p.forts[fi].niveau), (1, 0));
            assert!(p.royaumes[1].stock["or"] < 100000.0 && p.royaumes[1].projet_fort.is_none());
            for _ in 0..4 {
                p.fin_du_mois();
            }
            let fi = p.fort_a(site).unwrap();
            assert!(p.forts[fi].niveau >= 1, "la redoute s'achève");
            assert!(p.armees.iter().any(|a| a.proprio == 1 && a.case == site && a.retranche.is_some()), "la garde reste à son poste");
            // en guerre : un fort du joueur laissé vide, connu, est une proie
            p.royaumes[1].statut = "guerre".into();
            let proie = p.carte.rayon(c1, 8).into_iter().find(|&x| p.carte.dist(x, c1) >= 3 && p.site_de_fort(0, x).is_ok() && p.chemin(c1, x).is_some()).unwrap();
            p.poser_fort(0, proie, 1);
            p.decouvrir(1, proie, 0);
            let gi = arretee(&p, 1, c1).unwrap();
            p.armees[gi].unites.insert("milice".into(), 20);
            let c = Ctx::new(&mut p, 1);
            forts(&mut p, &c);
            assert!(p.armees.iter().any(|a| a.proprio == 1 && a.chemin.last() == Some(&proie)), "un détachement marche sur le fort vide");
            // les assiégeants se retranchent devant la ville
            p.villes[0].fortif = 2;
            let cv = p.villes[0].case;
            let sid = p.creer_armee(1, cv, BTreeMap::from([("grenadier".to_string(), 10)]));
            p.commencer_siege(sid, 0, &mut Rapport::default());
            let c = Ctx::new(&mut p, 1);
            forts(&mut p, &c);
            assert!(p.armees[p.armee(sid).unwrap()].retranche.is_some(), "les assiégeants se retranchent");
            return;
        }
        panic!("aucune carte où un rival bâtit un fort");
    }

    #[test]
    fn les_rivaux_fortifient_leur_capitale_en_guerre() {
        let mut p = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        riche(&mut p, 1);
        let cap = p.capitale(1).unwrap();
        for _ in 0..80 {
            let c = Ctx::new(&mut p, 1);
            fortifier(&mut p, &c);
            if p.villes[cap].travaux_fortif > 0 {
                break;
            }
        }
        assert!(p.villes[cap].travaux_fortif > 0, "la capitale passe en travaux");
        assert!(p.royaumes[1].stock["or"] < 100000.0, "les travaux sont payés, par l'ordre du joueur");
        // sans les moyens (le bois de la palissade entamerait sa réserve de chauffage), rien
        let mut q = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        q.royaumes[1].stock.insert("bois".into(), 30.0);
        for _ in 0..80 {
            let c = Ctx::new(&mut q, 1);
            fortifier(&mut q, &c);
        }
        assert_eq!(q.villes[q.capitale(1).unwrap()].travaux_fortif, 0);
        // les travaux s'achèvent
        p.villes[cap].travaux_fortif = 1;
        p.fin_du_mois();
        assert!(p.villes[cap].fortif >= 1);
    }

    #[test]
    fn assaut_ou_levee_du_siege() {
        let mut p = (1..40).find_map(|g| en_guerre(g, DIFFICILE)).unwrap();
        let c0 = cap(&p, 0);
        p.villes[0].fortif = 2;
        garnison(&mut p, 0, c0, &[("mousquetaire", 4)]);
        let a = p.creer_armee(1, c0, BTreeMap::from([("grenadier".to_string(), 30), ("canon".to_string(), 4)]));
        p.commencer_siege(a, 0, &mut Rapport::default());
        // des assiégeants bien plus forts que la place : l'assaut
        mois_seul(&mut p, 1);
        assert!(p.sieges[0].assaut, "l'assaut est ordonné");
        // une garnison bien plus forte : on lève le siège avant la sortie
        p.sieges[0].assaut = false;
        garnison(&mut p, 0, c0, &[("grenadier", 200)]);
        let r = mois_seul(&mut p, 1);
        let ai = p.armee(a).unwrap();
        assert!(!p.sieges[0].assaut && !p.armees[ai].chemin.is_empty(), "les assiégeants s'en vont");
        assert!(r.evenements.iter().any(|e| e.texte.contains("lève le siège")));
    }
}
