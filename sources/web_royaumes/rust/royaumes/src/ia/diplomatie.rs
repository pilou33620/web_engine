//! La diplomatie des royaumes de l'ordinateur : une relation et un traité (neutre, paix et trêve, guerre,
//! alliance, route commerciale) entre chaque paire de royaumes, le joueur compris ; des souverains qui
//! ont un nom, un caractère et une fin (mort, succession, coup d'État) ; une mémoire (trahisons, cadeaux,
//! aide donnée ou refusée, villes perdues) ; des coalitions contre le royaume trop puissant ; des guerres,
//! des paix (blanches, contre de l'or ou une ville) et des alliances entre rivaux ; des propositions, des
//! contre-propositions et des demandes d'aide au joueur.
//!
//! Les liens avec le joueur restent dans `Royaume` (relation, statut, trêve, commerce, début de guerre) :
//! le reste du moteur les lit déjà. Ceux entre deux rivaux sont ici (`Lien`). `en_guerre`, `ennemis`,
//! `statut` et `relation` lisent les deux de la même façon.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::hasard::Hasard;
use crate::meteo;
use crate::partie::{Partie, Proposition, Rapport};
use crate::regles::{regles, Panier};

// ------------------------------------------------------------------ données (sauvegardées)

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Diplomatie {
    /// les liens entre deux rivaux (a < b, tous deux ≥ 1) ; ceux avec le joueur sont dans `Royaume`
    pub liens: Vec<Lien>,
    /// le souverain de chaque royaume (indice : le royaume ; le joueur, 0, n'en a pas ici)
    pub souverains: Vec<Souverain>,
    pub souvenirs: Vec<Souvenir>,
    pub coalitions: Vec<Coalition>,
    /// les villes prises (ou cédées) ces quatre dernières années
    pub conquetes: Vec<Conquete>,
    /// les paires de royaumes qui se sont rencontrés (a < b) : on ne traite qu'avec qui l'on connaît
    pub contacts: Vec<[usize; 2]>,
    /// le hasard de la diplomatie, à part : elle ne dérange pas les tirages du reste du jeu (météo, batailles)
    pub hasard: Hasard,
    /// la ville qui change de mains par traité : ni butin ni annonce de conquête (`Partie::prise`)
    #[serde(skip)]
    pub cession: Option<u32>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Lien {
    pub a: usize,
    pub b: usize,
    /// −100 (haine) à 100 (amitié), la même dans les deux sens
    pub relation: f64,
    /// neutre, paix (trêve tant que `treve` n'est pas passé), guerre, alliance
    pub statut: String,
    pub treve: u32,
    pub commerce: bool,
    pub debut_guerre: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Souverain {
    pub prenom: String,
    pub numero: u32,
    /// conquerant, marchand, batisseur, prudent, opportuniste, fourbe
    pub caractere: String,
    pub age: u32,
    /// tour de son avènement
    pub depuis: u32,
}

impl Souverain {
    pub fn nom(&self) -> String {
        if self.numero <= 1 { format!("{} Ier", self.prenom) } else { format!("{} {}", self.prenom, romain(self.numero)) }
    }
}

/// Ce dont un royaume se souvient envers un autre : trahison, treve_rompue, guerre, ville_prise,
/// refus_aide (négatifs), cadeau, aide (positifs). Le poids s'ajoute à la relation visée et s'efface lentement.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Souvenir {
    pub de: usize,
    pub envers: usize,
    pub genre: String,
    pub poids: f64,
    pub tour: u32,
    /// la ville perdue, s'il y a lieu
    pub detail: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Coalition {
    pub cible: usize,
    pub membres: Vec<usize>,
    pub depuis: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Conquete {
    pub tour: u32,
    pub par: usize,
    pub sur: usize,
    pub ville: String,
}

// ------------------------------------------------------------------ caractères

/// Les traits d'un souverain (0 à 1), lisibles par l'IA militaire.
#[derive(Clone, Copy, Debug, Default, Serialize)]
pub struct Traits {
    pub agressivite: f64,
    pub fidelite: f64,
    pub avidite: f64,
    pub prudence: f64,
}

/// Les règles diplomatiques d'un caractère.
pub struct Profil {
    pub cle: &'static str,
    pub nom: &'static str,
    pub traits: Traits,
    /// la relation vers laquelle tendent ses humeurs
    pub base: f64,
    /// relation sous laquelle il déclare la guerre par haine
    pub seuil_guerre: f64,
    /// rapport de forces (lui et ses alliés contre l'autre et les siens) qu'il exige pour attaquer
    pub besoin: f64,
    /// guerres menées à la fois
    pub max_guerres: usize,
    /// relation à partir de laquelle il s'allie (et propose l'alliance au joueur)
    pub seuil_alliance: f64,
    /// rapport de forces qui réveille son ambition contre un voisin (0 : jamais)
    pub ambition: f64,
    /// il attaque un voisin affaibli (en guerre ailleurs, ou qui vient de perdre une ville)
    pub opportuniste: bool,
    /// chance par mois de trahir un allié ou une trêve quand la victime est affaiblie
    pub trahison: f64,
}

const fn t(agressivite: f64, fidelite: f64, avidite: f64, prudence: f64) -> Traits {
    Traits { agressivite, fidelite, avidite, prudence }
}

pub const PROFILS: [Profil; 6] = [
    Profil { cle: "conquerant", nom: "Conquérant", traits: t(0.9, 0.5, 0.5, 0.2), base: -20.0, seuil_guerre: -25.0, besoin: 1.1, max_guerres: 2, seuil_alliance: 70.0, ambition: 1.3, opportuniste: true, trahison: 0.0 },
    Profil { cle: "marchand", nom: "Marchand", traits: t(0.2, 0.7, 0.9, 0.6), base: 15.0, seuil_guerre: -55.0, besoin: 1.4, max_guerres: 1, seuil_alliance: 60.0, ambition: 0.0, opportuniste: false, trahison: 0.0 },
    Profil { cle: "batisseur", nom: "Bâtisseur", traits: t(0.15, 0.8, 0.3, 0.7), base: 0.0, seuil_guerre: -60.0, besoin: 1.5, max_guerres: 1, seuil_alliance: 60.0, ambition: 0.0, opportuniste: false, trahison: 0.0 },
    Profil { cle: "prudent", nom: "Prudent", traits: t(0.25, 0.75, 0.3, 0.95), base: 0.0, seuil_guerre: -50.0, besoin: 1.8, max_guerres: 1, seuil_alliance: 65.0, ambition: 0.0, opportuniste: false, trahison: 0.0 },
    Profil { cle: "opportuniste", nom: "Opportuniste", traits: t(0.6, 0.4, 0.7, 0.5), base: -5.0, seuil_guerre: -40.0, besoin: 1.2, max_guerres: 2, seuil_alliance: 65.0, ambition: 0.0, opportuniste: true, trahison: 0.005 },
    Profil { cle: "fourbe", nom: "Fourbe", traits: t(0.55, 0.1, 0.7, 0.4), base: 0.0, seuil_guerre: -40.0, besoin: 1.2, max_guerres: 2, seuil_alliance: 50.0, ambition: 0.0, opportuniste: true, trahison: 0.04 },
];
/// Le joueur, ou un royaume sans souverain connu.
const NEUTRE: Profil = Profil { cle: "", nom: "", traits: t(0.5, 0.5, 0.5, 0.5), base: 0.0, seuil_guerre: -50.0, besoin: 1.3, max_guerres: 1, seuil_alliance: 65.0, ambition: 0.0, opportuniste: false, trahison: 0.0 };

pub fn profil(cle: &str) -> &'static Profil {
    PROFILS.iter().find(|x| x.cle == cle).unwrap_or(&NEUTRE)
}

fn profil_de(p: &Partie, k: usize) -> &'static Profil {
    profil(p.diplomatie.souverains.get(k).map_or("", |s| s.caractere.as_str()))
}

/// Les traits du souverain de `id` (neutres pour le joueur et les brigands).
pub fn traits(p: &Partie, id: i32) -> Traits {
    if id < 0 { NEUTRE.traits } else { profil_de(p, id as usize).traits }
}

pub fn nom_caractere(cle: &str) -> &'static str {
    profil(cle).nom
}

/// Les anciens caractères (sauvegardes, `DefRoyaume`) deviennent ceux des souverains.
pub fn depuis_ancien(c: &str) -> &'static str {
    match c {
        "guerrier" => "conquerant",
        _ if profil(c).cle.is_empty() => "prudent",
        _ => profil(c).cle,
    }
}

/// Le caractère économique de `Royaume::caractere` (lu par l'économie et l'armée de l'ordinateur) : celui du royaume
/// au départ, puis celui du souverain après une succession.
fn vers_ancien(c: &str) -> &'static str {
    match c {
        "conquerant" => "guerrier",
        "marchand" => "marchand",
        "batisseur" => "batisseur",
        _ => "",
    }
}

const PRENOMS: [&str; 24] = [
    "Frédéric", "Louis", "Isabeau", "Charles", "Maximilien", "Catherine", "Gustave", "Léopold", "Marguerite", "Ferdinand", "Sophie", "Henri",
    "Élisabeth", "Casimir", "Victor", "Amélie", "Rodolphe", "Béatrice", "Othon", "Anne", "Philippe", "Mathilde", "Sigismond", "Aliénor",
];

fn romain(n: u32) -> String {
    let mut s = String::new();
    let mut n = n;
    for (v, r) in [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")] {
        while n >= v {
            s.push_str(r);
            n -= v;
        }
    }
    s
}

// ------------------------------------------------------------------ difficulté

/// 0 en facile, environ 0,4 en normal, 1 en difficile : l'IA calcule, exploite et négocie mieux (`Qualite::ruse`).
fn ruse(p: &Partie) -> f64 {
    super::qualite(p.options.difficulte).ruse
}

/// Facteur de rapidité des décisions : naïve et lente en facile, prompte en difficile.
fn allure(p: &Partie) -> f64 {
    0.6 + 0.95 * ruse(p)
}

// ------------------------------------------------------------------ lecture des liens

fn lien(d: &Diplomatie, a: usize, b: usize) -> Option<&Lien> {
    let (a, b) = (a.min(b), a.max(b));
    d.liens.iter().find(|l| l.a == a && l.b == b)
}

fn lien_mut(d: &mut Diplomatie, a: usize, b: usize) -> &mut Lien {
    let (a, b) = (a.min(b), a.max(b));
    match d.liens.iter().position(|l| l.a == a && l.b == b) {
        Some(i) => &mut d.liens[i],
        None => {
            d.liens.push(Lien { a, b, statut: "neutre".into(), ..Default::default() });
            d.liens.last_mut().unwrap()
        }
    }
}

/// Les champs d'un lien, avec le joueur (dans `Royaume`) ou entre rivaux (dans `Lien`).
struct Champs<'a> {
    relation: &'a mut f64,
    statut: &'a mut String,
    treve: &'a mut u32,
    commerce: &'a mut bool,
    debut: &'a mut u32,
}

fn champs(p: &mut Partie, a: usize, b: usize) -> Champs<'_> {
    if a == 0 || b == 0 {
        let r = &mut p.royaumes[a.max(b)];
        Champs { relation: &mut r.relation, statut: &mut r.statut, treve: &mut r.treve, commerce: &mut r.commerce, debut: &mut r.debut_guerre }
    } else {
        let l = lien_mut(&mut p.diplomatie, a, b);
        Champs { relation: &mut l.relation, statut: &mut l.statut, treve: &mut l.treve, commerce: &mut l.commerce, debut: &mut l.debut_guerre }
    }
}

fn valide(p: &Partie, a: usize, b: usize) -> bool {
    a != b && a < p.royaumes.len() && b < p.royaumes.len()
}

/// Le traité entre deux royaumes : neutre, paix, guerre ou alliance.
pub fn statut(p: &Partie, a: usize, b: usize) -> &str {
    if !valide(p, a, b) {
        "neutre"
    } else if a == 0 || b == 0 {
        &p.royaumes[a.max(b)].statut
    } else {
        lien(&p.diplomatie, a, b).map_or("neutre", |l| l.statut.as_str())
    }
}

/// La relation entre deux royaumes (celle du rival envers le joueur, quand l'un d'eux est le joueur).
pub fn relation(p: &Partie, a: usize, b: usize) -> f64 {
    if !valide(p, a, b) {
        0.0
    } else if a == 0 || b == 0 {
        p.royaumes[a.max(b)].relation
    } else {
        lien(&p.diplomatie, a, b).map_or(0.0, |l| l.relation)
    }
}

fn treve(p: &Partie, a: usize, b: usize) -> u32 {
    if !valide(p, a, b) {
        0
    } else if a == 0 || b == 0 {
        p.royaumes[a.max(b)].treve
    } else {
        lien(&p.diplomatie, a, b).map_or(0, |l| l.treve)
    }
}

fn commerce(p: &Partie, a: usize, b: usize) -> bool {
    if !valide(p, a, b) {
        false
    } else if a == 0 || b == 0 {
        p.royaumes[a.max(b)].commerce
    } else {
        lien(&p.diplomatie, a, b).is_some_and(|l| l.commerce)
    }
}

fn debut_guerre(p: &Partie, a: usize, b: usize) -> u32 {
    if !valide(p, a, b) {
        0
    } else if a == 0 || b == 0 {
        p.royaumes[a.max(b)].debut_guerre
    } else {
        lien(&p.diplomatie, a, b).map_or(0, |l| l.debut_guerre)
    }
}

/// Deux royaumes (le joueur ou des rivaux) sont-ils en guerre ? Les brigands n'en sont pas : `Partie::est_ennemi` s'en charge.
pub fn en_guerre(p: &Partie, a: i32, b: i32) -> bool {
    a >= 0 && b >= 0 && statut(p, a as usize, b as usize) == "guerre"
}

/// Les royaumes vivants en guerre contre `id`.
pub fn ennemis(p: &Partie, id: i32) -> Vec<i32> {
    (0..p.royaumes.len() as i32).filter(|&k| p.royaumes[k as usize].vivant && en_guerre(p, id, k)).collect()
}

/// Les royaumes vivants alliés de `id`.
pub fn allies(p: &Partie, id: i32) -> Vec<i32> {
    if id < 0 {
        return Vec::new();
    }
    (0..p.royaumes.len()).filter(|&k| p.royaumes[k].vivant && statut(p, id as usize, k) == "alliance").map(|k| k as i32).collect()
}

/// Les deux royaumes se sont-ils rencontrés ?
pub fn contact(p: &Partie, a: usize, b: usize) -> bool {
    a == b || p.diplomatie.contacts.contains(&[a.min(b), a.max(b)])
}

fn changer_relation(p: &mut Partie, a: usize, b: usize, d: f64) {
    if valide(p, a, b) {
        let r = champs(p, a, b).relation;
        *r = (*r + d).clamp(-100.0, 100.0);
    }
}

fn fixer_statut(p: &mut Partie, a: usize, b: usize, s: &str) {
    if valide(p, a, b) {
        *champs(p, a, b).statut = s.into();
    }
}

// ------------------------------------------------------------------ mémoire

/// `de` se souviendra de ce que lui a fait `envers` (le joueur, lui, ne tient pas de registre ici).
pub fn souvenir(p: &mut Partie, de: usize, envers: usize, genre: &str, poids: f64, detail: &str) {
    if de == 0 || !valide(p, de, envers) {
        return;
    }
    let tour = p.tour;
    p.diplomatie.souvenirs.push(Souvenir { de, envers, genre: genre.into(), poids, tour, detail: detail.into() });
}

/// Ce que pèsent les souvenirs de `de` envers `envers` dans la relation.
pub fn rancune(p: &Partie, de: usize, envers: usize) -> f64 {
    p.diplomatie.souvenirs.iter().filter(|s| s.de == de && s.envers == envers).map(|s| s.poids).sum()
}

/// L'oubli d'un mois : les trahisons durent des années, les cadeaux moins.
fn oubli(genre: &str) -> f64 {
    match genre {
        "trahison" | "treve_rompue" => 0.993,
        "ville_prise" | "aide" => 0.99,
        "refus_aide" => 0.985,
        _ => 0.98,
    }
}

/// La phrase que le souverain de `de` glisse dans ses messages au joueur, s'il a la mémoire chargée.
pub fn rappel(p: &Partie, de: usize) -> Option<String> {
    let s = p.diplomatie.souvenirs.iter().filter(|s| s.de == de && s.envers == 0 && s.poids.abs() >= 6.0).max_by(|a, b| a.poids.abs().total_cmp(&b.poids.abs()))?;
    let qui = p.diplomatie.souverains.get(de)?.nom();
    let an = meteo::annee(s.tour);
    Some(match s.genre.as_str() {
        "trahison" => format!("{qui} n'a pas oublié votre trahison de {an}."),
        "treve_rompue" => format!("{qui} se souvient de la trêve que vous avez rompue en {an}."),
        "refus_aide" => format!("{qui} n'a pas oublié que vous l'avez abandonné en {an}."),
        "guerre" => format!("{qui} garde rancune de la guerre de {an}."),
        "ville_prise" => format!("{qui} n'a pas pardonné la perte de {} en {an}.", s.detail),
        "cadeau" => format!("{qui} se souvient de vos présents."),
        "aide" => format!("{qui} se souvient de votre aide en {an}."),
        _ => return None,
    })
}

fn suffixe(p: &Partie, de: usize) -> String {
    rappel(p, de).map(|r| format!(" — {r}")).unwrap_or_default()
}

// ------------------------------------------------------------------ outils

fn puissances(p: &Partie) -> Vec<f64> {
    (0..p.royaumes.len()).map(|k| if p.royaumes[k].vivant { p.puissance(k as i32) } else { 0.0 }).collect()
}

/// La force d'un camp telle que la voit l'IA : la sienne, et celle de ses alliés en difficile (l'IA naïve les ignore).
fn force(p: &Partie, pu: &[f64], x: usize) -> f64 {
    pu[x] + 0.6 * ruse(p) * allies(p, x as i32).iter().map(|&a| pu[a as usize]).sum::<f64>()
}

fn rapport_forces(p: &Partie, pu: &[f64], a: usize, b: usize) -> f64 {
    force(p, pu, a) / force(p, pu, b).max(1.0)
}

fn nb_villes(p: &Partie, k: usize) -> usize {
    p.villes.iter().filter(|v| v.proprio == k as i32).count()
}

/// Deux royaumes voisins : deux de leurs villes à 14 cases au plus.
fn voisins(p: &Partie, a: usize, b: usize) -> bool {
    p.villes.iter().filter(|v| v.proprio == a as i32).any(|v| p.villes.iter().any(|w| w.proprio == b as i32 && p.carte.dist(v.case, w.case) <= 14))
}

/// `j` est affaibli aux yeux de `sauf` : en guerre contre un autre, ou il vient de perdre une ville.
fn affaibli(p: &Partie, j: usize, sauf: usize) -> bool {
    ennemis(p, j as i32).iter().any(|&x| x as usize != sauf) || p.diplomatie.conquetes.iter().any(|c| c.sur == j && c.tour + 24 > p.tour)
}

fn coalition_contre(p: &Partie, cible: usize) -> Option<&Coalition> {
    p.diplomatie.coalitions.iter().find(|c| c.cible == cible)
}

/// `m` est engagé dans une coalition contre `cible` depuis moins de deux ans : pas de paix séparée.
fn coalise(p: &Partie, m: usize, cible: usize) -> bool {
    coalition_contre(p, cible).is_some_and(|c| c.membres.contains(&m) && c.depuis + 24 > p.tour)
}

fn nom(p: &Partie, k: usize) -> String {
    p.royaumes[k].nom.clone()
}

/// Une nouvelle des affaires de deux rivaux, si le joueur les connaît tous deux.
fn nouvelle(p: &mut Partie, rapport: &mut Rapport, a: usize, b: usize, texte: String, genre: &str) {
    if a != 0 && b != 0 && contact(p, 0, a) && contact(p, 0, b) {
        p.evt(rapport, texte, genre, None);
    }
}

fn proposer(p: &mut Partie, mut pr: Proposition) -> u32 {
    pr.id = p.id();
    let id = pr.id;
    p.propositions.push(pr);
    id
}

/// La ville que `cedant` abandonnerait à `preneur` : celle qu'il assiège, sinon la plus proche de lui ; jamais la dernière.
fn ville_a_ceder(p: &Partie, cedant: usize, preneur: usize) -> Option<usize> {
    let siennes: Vec<usize> = (0..p.villes.len()).filter(|&i| p.villes[i].proprio == cedant as i32).collect();
    if siennes.len() < 2 {
        return None;
    }
    if let Some(&vi) = siennes.iter().find(|&&vi| p.sieges.iter().any(|s| !s.fort && s.ville == p.villes[vi].id && s.assiegeant == preneur as i32)) {
        return Some(vi);
    }
    let chez = p.capitale(preneur as i32).map(|i| p.villes[i].case)?;
    siennes.into_iter().filter(|&vi| !p.villes[vi].capitale).min_by_key(|&vi| p.carte.dist(p.villes[vi].case, chez))
}

/// La ville `vi` passe à `nouveau` par traité : sa garnison évacue vers la ville la plus proche de son camp.
pub fn ceder_ville(p: &mut Partie, vi: usize, nouveau: usize, rapport: &mut Rapport) {
    let (ancien, case) = (p.villes[vi].proprio, p.villes[vi].case);
    if let Some(dest) = (0..p.villes.len()).filter(|&j| j != vi && p.villes[j].proprio == ancien).min_by_key(|&j| p.carte.dist(p.villes[j].case, case)).map(|j| p.villes[j].case) {
        for a in p.armees.iter_mut().filter(|a| a.proprio == ancien && a.case == case) {
            a.case = dest;
            a.chemin.clear();
        }
    }
    p.diplomatie.cession = Some(p.villes[vi].id);
    p.prise(vi, nouveau as i32, rapport);
    p.diplomatie.cession = None;
}

/// L'or que `k` a vraiment en caisse.
fn tresor(p: &Partie, k: usize) -> f64 {
    p.royaumes[k].stock.get("or").copied().unwrap_or(0.0).max(0.0)
}

/// `de` verse `or` (au plus ce qu'il a en caisse) à `a` : réparations de guerre, rançon de la paix.
fn verser(p: &mut Partie, de: usize, a: usize, or: f64) {
    let or = or.min(tresor(p, de)).max(0.0);
    if or > 0.0 {
        let panier = Panier::from([("or".to_string(), or)]);
        p.payer(de as i32, &panier);
        p.crediter(a as i32, &panier);
    }
}

/// Le prix en or de la paix qu'exige un vainqueur (selon le rapport de forces, mieux négocié en difficile).
fn montant(p: &Partie, ratio: f64) -> f64 {
    ((100.0 + 80.0 * (ratio - 1.0)).clamp(80.0, 400.0) * (0.7 + 0.6 * ruse(p)) / 10.0).round() * 10.0
}

// ------------------------------------------------------------------ mise en place

/// Donne un souverain à chaque royaume et une relation à chaque paire de rivaux (nouvelle partie,
/// ou ancienne sauvegarde : les anciens caractères y sont repris tels quels, guerrier devenant conquérant).
pub fn initialiser(p: &mut Partie, nouvelle_partie: bool) {
    let n = p.royaumes.len();
    if p.diplomatie.souverains.len() >= n {
        return;
    }
    let mut h = Hasard::new(p.options.graine.wrapping_mul(31).wrapping_add(17));
    for k in p.diplomatie.souverains.len()..n {
        let ancien = p.royaumes[k].caractere.clone();
        let caractere = if k == 0 {
            String::new()
        } else if nouvelle_partie {
            // un peu de variété autour du caractère du royaume
            let x = h.f();
            match ancien.as_str() {
                "guerrier" => if x < 0.6 { "conquerant" } else if x < 0.85 { "opportuniste" } else { "fourbe" },
                "marchand" => if x < 0.65 { "marchand" } else if x < 0.85 { "prudent" } else { "opportuniste" },
                "batisseur" => if x < 0.6 { "batisseur" } else if x < 0.9 { "prudent" } else { "fourbe" },
                c => depuis_ancien(c),
            }
            .to_string()
        } else {
            depuis_ancien(&ancien).to_string()
        };
        let s = Souverain { prenom: PRENOMS[h.indice(PRENOMS.len())].into(), numero: h.entre(1, 4) as u32, caractere, age: h.entre(25, 55) as u32, depuis: p.tour };
        p.diplomatie.souverains.push(s);
    }
    for a in 1..n {
        for b in a + 1..n {
            if lien(&p.diplomatie, a, b).is_none() {
                let rel = (profil_de(p, a).base + profil_de(p, b).base + p.royaumes[a].attitude + p.royaumes[b].attitude) / 2.0 + (h.f() - 0.5) * 20.0;
                lien_mut(&mut p.diplomatie, a, b).relation = rel;
            }
        }
    }    p.diplomatie.hasard = h;
}

// ------------------------------------------------------------------ le monde, une fois par mois

/// Une fois par mois, avant que chaque royaume ne décide : rencontres, mémoire, souverains,
/// humeurs entre rivaux, commerce, coalitions.
pub fn monde(p: &mut Partie, rapport: &mut Rapport) {
    initialiser(p, false);
    maj_contacts(p);
    let tour = p.tour;
    p.diplomatie.conquetes.retain(|c| c.tour + 48 > tour);
    for s in p.diplomatie.souvenirs.iter_mut() {
        s.poids *= oubli(&s.genre);
    }
    p.diplomatie.souvenirs.retain(|s| s.poids.abs() >= 1.0 && p.royaumes.get(s.de).is_some_and(|r| r.vivant));
    souverains(p, rapport);
    humeurs_entre_rivaux(p, rapport);
    coalitions(p, rapport);
}

/// Deux royaumes se rencontrent dès que l'un a vu les terres de l'autre, ou que leurs villes sont proches (12 cases).
fn maj_contacts(p: &mut Partie) {
    let n = p.royaumes.len();
    let mut vus = vec![false; n * n];
    for v in &p.villes {
        for w in &p.villes {
            let (a, b) = (v.proprio, w.proprio);
            if a >= 0 && a < b && (b as usize) < n && p.carte.dist(v.case, w.case) <= 12 {
                vus[a as usize * n + b as usize] = true;
            }
        }
    }
    for k in (0..n).filter(|&k| p.royaumes[k].vivant) {
        for (c, &x) in p.royaumes[k].explore.iter().enumerate() {
            let o = p.carte.cases.get(c).map_or(-1, |k| k.proprio);
            if x == 1 && o >= 0 && (o as usize) < n && o as usize != k {
                vus[k.min(o as usize) * n + k.max(o as usize)] = true;
            }
        }
    }
    for a in 0..n {
        for b in a + 1..n {
            if vus[a * n + b] && !p.diplomatie.contacts.contains(&[a, b]) {
                p.diplomatie.contacts.push([a, b]);
            }
        }
    }
}

fn humeurs_entre_rivaux(p: &mut Partie, rapport: &mut Rapport) {
    let n = p.royaumes.len();
    for a in 1..n {
        for b in a + 1..n {
            if !p.royaumes[a].vivant || !p.royaumes[b].vivant || !contact(p, a, b) {
                continue;
            }
            let st = statut(p, a, b).to_string();
            let ennemi_commun = ennemis(p, a as i32).iter().any(|x| ennemis(p, b as i32).contains(x));
            let cible = (profil_de(p, a).base + profil_de(p, b).base + p.royaumes[a].attitude + p.royaumes[b].attitude) / 2.0
                + (rancune(p, a, b) + rancune(p, b, a)) / 2.0
                + if st == "alliance" { 10.0 } else { 0.0 }
                + if commerce(p, a, b) { 8.0 } else { 0.0 }
                + if voisins(p, a, b) { -15.0 } else { 0.0 }
                + if ennemi_commun { 12.0 } else { 0.0 };
            // des humeurs qui varient, et entre voisins des incidents de frontière
            let mut bruit = (p.diplomatie.hasard.f() - 0.5) * 10.0;
            if voisins(p, a, b) && p.diplomatie.hasard.p(0.015) {
                bruit -= 15.0;
                let (na, nb) = (nom(p, a), nom(p, b));
                nouvelle(p, rapport, a, b, format!("📜 Incident de frontière entre {na} et {nb}"), "info");
            }
            let l = lien_mut(&mut p.diplomatie, a, b);
            l.relation += (cible - l.relation) * 0.03 + bruit;
            if l.statut == "guerre" {
                l.relation = l.relation.min(-20.0);
            }
            l.relation = l.relation.clamp(-100.0, 100.0);
            // (une route commerciale enrichit les deux : elle compte dans leurs revenus, `Partie::routes_commerciales`)
        }
    }
}

/// Seuils de coalition : part de la puissance totale, part des villes, conquêtes des quatre dernières années.
fn menace(p: &Partie, pu: &[f64], i: usize, f: f64) -> bool {
    let ru = ruse(p);
    let total: f64 = pu.iter().sum::<f64>().max(1.0);
    let villes = nb_villes(p, i);
    let conquetes = p.diplomatie.conquetes.iter().filter(|c| c.par == i).count() as f64;
    pu[i] / total >= (0.5 - 0.15 * ru) * f || (villes >= 5 && villes as f64 / p.villes.len().max(1) as f64 >= 0.4 * f) || conquetes >= ((4.0 - 2.0 * ru) * f).round()
}

fn liste_noms(p: &Partie, ids: &[usize]) -> String {
    let noms: Vec<String> = ids.iter().map(|&m| nom(p, m)).collect();
    match noms.len() {
        0 => String::new(),
        1 => noms[0].clone(),
        n => format!("{} et {}", noms[..n - 1].join(", "), noms[n - 1]),
    }
}

/// Le royaume trop puissant voit les autres s'allier et lui déclarer la guerre ensemble ; la coalition
/// se dissout quand il n'inquiète plus personne (ou au bout de six ans).
fn coalitions(p: &mut Partie, rapport: &mut Rapport) {
    let tour = p.tour;
    let pu = puissances(p);
    let finies: Vec<usize> = p
        .diplomatie
        .coalitions
        .iter()
        .filter(|c| !p.royaumes[c.cible].vivant || tour > c.depuis + 72 || (!menace(p, &pu, c.cible, 0.75) && !c.membres.iter().any(|&m| en_guerre(p, m as i32, c.cible as i32))))
        .map(|c| c.cible)
        .collect();
    for cible in finies {
        p.diplomatie.coalitions.retain(|c| c.cible != cible);
        if p.royaumes[cible].vivant && (cible == 0 || contact(p, 0, cible)) {
            let qui = if cible == 0 { "vous".to_string() } else { nom(p, cible) };
            p.evt(rapport, format!("🕊️ La coalition contre {qui} se dissout."), "info", None);
        }
    }
    for c in p.diplomatie.coalitions.iter_mut() {
        c.membres.retain(|&m| p.royaumes[m].vivant);
    }
    let ru = ruse(p);
    let vivants: Vec<usize> = (0..p.royaumes.len()).filter(|&k| p.royaumes[k].vivant).collect();
    if (tour as f64) < 48.0 - 24.0 * ru || vivants.len() < 3 {
        return;
    }
    for &i in &vivants {
        if coalition_contre(p, i).is_some() || !menace(p, &pu, i, 1.0) {
            continue;
        }
        let membres: Vec<usize> = vivants.iter().copied().filter(|&m| m != 0 && m != i && contact(p, m, i) && statut(p, m, i) != "alliance" && relation(p, m, i) < 40.0).collect();
        let somme: f64 = membres.iter().map(|&m| pu[m]).sum();
        // une coalition sans espoir ne se forme pas
        if membres.len() < 2 || somme < 0.35 * pu[i] {
            continue;
        }
        former_coalition(p, i, membres, rapport);
        break;
    }
}

fn former_coalition(p: &mut Partie, cible: usize, membres: Vec<usize>, rapport: &mut Rapport) {
    let tour = p.tour;
    for (x, &a) in membres.iter().enumerate() {
        for &b in &membres[x + 1..] {
            if en_guerre(p, a as i32, b as i32) {
                signer_paix(p, a, b, rapport);
            }
            fixer_statut(p, a, b, "alliance");
            let r = champs(p, a, b).relation;
            *r = r.max(30.0);
        }
    }
    for &m in &membres {
        changer_relation(p, m, cible, -25.0);
        guerre(p, m, cible, rapport, false);
    }
    let liste = liste_noms(p, &membres);
    if cible == 0 {
        p.evt(rapport, format!("⚔️ Coalition contre vous ! {liste} s'allient et vous déclarent la guerre."), "guerre", None);
    } else if contact(p, 0, cible) {
        let n = nom(p, cible);
        p.evt(rapport, format!("⚔️ Coalition contre {n} : {liste} s'allient et lui déclarent la guerre."), "guerre", None);
        // le joueur est invité à se joindre à la coalition
        if !en_guerre(p, 0, cible as i32) && statut(p, 0, cible) != "alliance" {
            if let Some(&m) = membres.iter().find(|&&m| relation(p, m, 0) >= 0.0 && !en_guerre(p, m as i32, 0)) {
                let texte = format!("{} vous invite à rejoindre la coalition contre {n} et à lui déclarer la guerre.", nom(p, m));
                proposer(p, Proposition { de: m, genre: "aide".into(), texte, cible: Some(cible), ..Default::default() });
            }
        }
    }
    p.diplomatie.coalitions.push(Coalition { cible, membres, depuis: tour });
}

/// Les souverains vieillissent ; ils meurent (l'héritier reprend souvent le caractère du père) ou
/// tombent sous un coup d'État (plus probable quand le royaume perd des villes).
fn souverains(p: &mut Partie, rapport: &mut Rapport) {
    let janvier = meteo::mois(p.tour) == 0;
    for k in 1..p.royaumes.len().min(p.diplomatie.souverains.len()) {
        if !p.royaumes[k].vivant {
            continue;
        }
        if janvier {
            p.diplomatie.souverains[k].age += 1;
        }
        let age = p.diplomatie.souverains[k].age as f64;
        let mort = 0.0008 + ((age - 45.0).max(0.0) / 30.0).powi(2) * 0.012;
        let revers = p.diplomatie.conquetes.iter().any(|c| c.sur == k && c.tour + 24 > p.tour);
        let coup = 0.0006 + if revers { 0.006 } else { 0.0 };
        if p.diplomatie.hasard.p(mort) {
            succession(p, k, false, rapport);
        } else if p.diplomatie.hasard.p(coup) {
            succession(p, k, true, rapport);
        }
    }
}

/// Un nouveau souverain monte sur le trône de `k` : par héritage, ou par un coup d'État.
pub fn succession(p: &mut Partie, k: usize, coup_d_etat: bool, rapport: &mut Rapport) {
    let ancien = p.diplomatie.souverains[k].clone();
    let caractere = if !coup_d_etat && p.diplomatie.hasard.p(0.55) {
        ancien.caractere.clone()
    } else {
        let autres: Vec<&str> = PROFILS.iter().map(|x| x.cle).filter(|&c| c != ancien.caractere).collect();
        // les usurpateurs sont plus souvent des ambitieux
        let ambitieux = ["conquerant", "fourbe", "opportuniste"];
        let choix: Vec<&str> = if coup_d_etat && p.diplomatie.hasard.p(0.6) { autres.iter().copied().filter(|c| ambitieux.contains(c)).collect() } else { autres };
        choix[p.diplomatie.hasard.indice(choix.len())].to_string()
    };
    let (prenom, numero) = if !coup_d_etat && p.diplomatie.hasard.p(0.35) { (ancien.prenom.clone(), ancien.numero + 1) } else { (PRENOMS[p.diplomatie.hasard.indice(PRENOMS.len())].to_string(), p.diplomatie.hasard.entre(1, 3) as u32) };
    let age = if coup_d_etat { p.diplomatie.hasard.entre(30, 55) } else { p.diplomatie.hasard.entre(16, 40) } as u32;
    let nouveau = Souverain { prenom, numero, caractere: caractere.clone(), age, depuis: p.tour };
    // le nouveau souverain ne porte qu'une part des rancunes et des amitiés de l'ancien
    let garde = if coup_d_etat { 0.3 } else { 0.6 };
    for s in p.diplomatie.souvenirs.iter_mut().filter(|s| s.de == k) {
        s.poids *= garde;
    }
    let r = &mut p.royaumes[k];
    r.caractere = vers_ancien(&caractere).into();
    let base = profil(&caractere).base + r.attitude;
    r.relation = (r.relation * (1.0 - garde / 2.0) + base * garde / 2.0).clamp(-100.0, 100.0);
    let (vieux, neuf, royaume, nature) = (ancien.nom(), nouveau.nom(), r.nom.clone(), nom_caractere(&caractere).to_lowercase());
    p.diplomatie.souverains[k] = nouveau;
    if contact(p, 0, k) {
        let texte = if coup_d_etat {
            format!("🗡️ Coup d'État : {neuf} renverse {vieux} et s'empare du trône ({royaume}) — un souverain {nature}.")
        } else {
            format!("👑 {vieux} ({royaume}) est mort ; {neuf} lui succède — un souverain {nature}.")
        };
        p.evt(rapport, texte, "info", None);
    }
}

// ------------------------------------------------------------------ guerre, paix, conquêtes

/// `a` déclare la guerre à `b` (le joueur ou des rivaux) ; une alliance rompue ou une trêve violée
/// sont des trahisons dont la victime et les témoins se souviendront.
pub fn declarer_guerre(p: &mut Partie, a: usize, b: usize, rapport: &mut Rapport) {
    guerre(p, a, b, rapport, true);
}

fn guerre(p: &mut Partie, a: usize, b: usize, rapport: &mut Rapport, annonce: bool) {
    if !valide(p, a, b) || en_guerre(p, a as i32, b as i32) {
        return;
    }
    let tour = p.tour;
    let trahison = statut(p, a, b) == "alliance";
    let treve_rompue = !trahison && tour <= treve(p, a, b);
    let temoins: Vec<usize> = (1..p.royaumes.len()).filter(|&o| o != a && o != b && p.royaumes[o].vivant && contact(p, o, a)).collect();
    if trahison {
        souvenir(p, b, a, "trahison", -40.0, "");
        for &o in &temoins {
            changer_relation(p, o, a, -8.0);
        }
    } else if treve_rompue {
        souvenir(p, b, a, "treve_rompue", -30.0, "");
        for &o in &temoins {
            changer_relation(p, o, a, -5.0);
        }
    } else {
        souvenir(p, b, a, "guerre", -10.0, "");
    }
    let c = champs(p, a, b);
    *c.statut = "guerre".into();
    *c.debut = tour;
    *c.relation = (*c.relation - 30.0).min(-30.0);
    *c.commerce = false;
    // les rivaux préparent leur première attaque
    for k in [a, b].into_iter().filter(|&k| k != 0) {
        let attente = tour + p.diplomatie.hasard.entre(2, 4) as u32;
        let r = &mut p.royaumes[k];
        if r.prochaine_attaque <= tour || r.prochaine_attaque > attente {
            r.prochaine_attaque = attente;
        }
    }
    if a == 0 {
        for (i, o) in p.royaumes.iter_mut().enumerate() {
            if i != b && !o.joueur && o.vivant {
                o.relation -= 8.0;
            }
        }
    }
    if !annonce {
        return;
    }
    let (na, nb) = (nom(p, a), nom(p, b));
    if a == 0 {
        let quoi = if trahison { "rompez votre alliance et déclarez" } else if treve_rompue { "rompez la trêve et déclarez" } else { "déclarez" };
        p.evt(rapport, format!("⚔️ Vous {quoi} la guerre à {nb} !"), "guerre", None);
    } else if b == 0 {
        let texte = if trahison {
            format!("🗡️ Trahison ! {na} rompt votre alliance et vous déclare la guerre !")
        } else if treve_rompue {
            format!("🗡️ {na} rompt la trêve et vous déclare la guerre !")
        } else {
            format!("⚔️ {na} vous déclare la guerre !")
        };
        p.evt(rapport, texte, "guerre", None);
    } else {
        let quoi = if trahison { "trahit son alliance et déclare" } else { "déclare" };
        nouvelle(p, rapport, a, b, format!("📜 {na} {quoi} la guerre à {nb}"), "guerre");
    }
}

/// La paix entre `a` et `b`, avec une trêve de deux ans ; les armées en marche vers l'autre s'arrêtent.
pub fn signer_paix(p: &mut Partie, a: usize, b: usize, _rapport: &mut Rapport) {
    if !valide(p, a, b) {
        return;
    }
    let tour = p.tour;
    let c = champs(p, a, b);
    *c.statut = "paix".into();
    *c.treve = tour + 24;
    *c.relation = c.relation.max(-15.0);
    for (x, y) in [(a as i32, b as i32), (b as i32, a as i32)] {
        for i in 0..p.armees.len() {
            let fin = p.armees[i].chemin.last().copied();
            if p.armees[i].proprio == x && fin.is_some_and(|c| p.carte.cases[c].proprio == y) {
                p.armees[i].chemin.clear();
            }
        }
    }
}

/// Appelé par `Partie::prise` : la conquête est notée (coalitions, rancune du vaincu) et annoncée au joueur
/// s'il connaît les deux royaumes. Rend vrai si la ville change de mains par traité (pas de butin).
pub fn conquete(p: &mut Partie, nouveau: i32, ancien: i32, vi: usize, rapport: &mut Rapport) -> bool {
    let cession = p.diplomatie.cession == Some(p.villes[vi].id);
    let n = p.royaumes.len() as i32;
    if !(0..n).contains(&nouveau) || !(0..n).contains(&ancien) {
        return cession;
    }
    let (nv, an) = (nouveau as usize, ancien as usize);
    let (ville, case) = (p.villes[vi].nom.clone(), p.villes[vi].case);
    let tour = p.tour;
    p.diplomatie.conquetes.push(Conquete { tour, par: nv, sur: an, ville: ville.clone() });
    souvenir(p, an, nv, "ville_prise", -15.0, &ville);
    if nv != 0 && an != 0 && contact(p, 0, nv) && contact(p, 0, an) {
        let (qui, sur) = (nom(p, nv), nom(p, an));
        let texte = if cession { format!("📜 {sur} cède la ville de {ville} à {qui}") } else { format!("🏰 {qui} a pris la ville de {ville} à {sur}") };
        let lieu = p.connait(0, case).then_some(case);
        p.evt(rapport, texte, "guerre", lieu);
    }
    cession
}

// ------------------------------------------------------------------ chaque royaume décide

/// Le mois diplomatique du royaume `k` (appelé par `ia::mois`) : son humeur envers le joueur, la guerre,
/// la paix et les traités avec chaque royaume rencontré, l'aide à ses alliés, ses offres au joueur.
pub fn mois(p: &mut Partie, k: usize, rapport: &mut Rapport) {
    initialiser(p, false);
    let pu = puissances(p);
    humeur_joueur(p, k);
    let autres: Vec<usize> = (0..p.royaumes.len()).filter(|&j| j != k && p.royaumes[j].vivant && (contact(p, k, j) || en_guerre(p, k as i32, j as i32))).collect();
    for j in autres {
        if en_guerre(p, k as i32, j as i32) {
            if j == 0 {
                paix_au_joueur(p, k, &pu);
            } else {
                paix_entre_rivaux(p, k, j, &pu, rapport);
            }
        } else {
            guerre_envisagee(p, k, j, &pu, rapport);
            if j > k {
                traites(p, k, j, &pu, rapport);
            }
        }
    }
    appel_aux_armes(p, k, &pu, rapport);
    if !en_guerre(p, k as i32, 0) && contact(p, k, 0) {
        offres_au_joueur(p, k, &pu);
    }
}

fn humeur_joueur(p: &mut Partie, k: usize) {
    let base = profil_de(p, k).base + p.royaumes[k].attitude + rancune(p, k, 0);
    let r = &mut p.royaumes[k];
    if r.statut == "alliance" {
        r.relation += 0.3;
    }
    if r.commerce && r.statut != "guerre" {
        r.relation += 0.4;
    }
    r.relation += (base - r.relation) * 0.03;
    if r.statut == "guerre" {
        r.relation = r.relation.min(-20.0);
    }
    r.relation = r.relation.clamp(-100.0, 100.0);
}

/// `k` envisage la guerre contre `j` : par haine, par ambition (le conquérant contre un voisin plus faible),
/// par opportunisme (un voisin affaibli), ou par trahison (le fourbe contre un allié ou un voisin en trêve affaibli).
fn guerre_envisagee(p: &mut Partie, k: usize, j: usize, pu: &[f64], rapport: &mut Rapport) {
    if p.tour <= crate::partie::TOUR_DEPART + 15 {
        return;
    }
    let pr = profil_de(p, k);
    let st = statut(p, k, j).to_string();
    let ratio = rapport_forces(p, pu, k, j);
    let rel = relation(p, k, j);
    let guerres = ennemis(p, k as i32).len();
    let affaibli = affaibli(p, j, k);
    let al = allure(p);
    // un allié, ou un voisin sous trêve : seule la trahison y mène, contre une victime affaiblie et plus faible
    if st == "alliance" || p.tour <= treve(p, k, j) {
        if pr.trahison > 0.0 && affaibli && pu[k] >= 1.3 * pu[j] && guerres < pr.max_guerres && p.diplomatie.hasard.p(pr.trahison * al) {
            guerre(p, k, j, rapport, true);
        }
        return;
    }
    if guerres >= pr.max_guerres {
        return;
    }
    let ru = ruse(p);
    // l'IA naïve (facile) jauge mal le rapport de forces
    let besoin = pr.besoin * (0.6 + 0.4 * ru);
    let haine = rel <= pr.seuil_guerre;
    // l'ambition et l'opportunisme attendent que les royaumes soient installés (plus tôt en difficile)
    let installe = p.tour as f64 > 48.0 - 24.0 * ru;
    let ambition = installe && pr.ambition > 0.0 && ratio >= pr.ambition && rel < 10.0 && voisins(p, k, j);
    // un voisin en guerre ailleurs, qui vient de perdre une ville, ou bien plus faible
    let occasion = installe && pr.opportuniste && (affaibli || ratio >= 1.6) && rel < 20.0 && voisins(p, k, j) && p.diplomatie.hasard.p(0.3 + 0.7 * ru);
    if (haine || ambition || occasion) && ratio >= besoin && p.diplomatie.hasard.p(0.08 * (0.4 + pr.traits.agressivite) * al) {
        guerre(p, k, j, rapport, true);
    }
}

/// `k`, en guerre contre le rival `j`, propose la paix quand il perd ou s'use ; `j` accepte (contre une ville
/// si `k` est aux abois, contre de l'or s'il domine), ou continue s'il est en train de gagner.
fn paix_entre_rivaux(p: &mut Partie, k: usize, j: usize, pu: &[f64], rapport: &mut Rapport) {
    let duree = p.tour.saturating_sub(debut_guerre(p, k, j));
    let pk = profil_de(p, k);
    let ratio = rapport_forces(p, pu, k, j);
    // réduit à sa dernière ville, assiégée ou face à plus fort que lui seul (ses alliés ne la sauveront pas),
    // on traite sans attendre, coalition ou non : il y va du royaume
    let assiege = p.sieges.iter().any(|s| s.assiegeant == j as i32 && p.villes.iter().any(|v| v.id == s.ville && v.proprio == k as i32));
    let abois = nb_villes(p, k) == 1 && (assiege || pu[k] < 0.7 * pu[j]);
    let veut = abois || (duree as f64 >= 6.0 + 12.0 * pk.traits.agressivite && (ratio < 0.7 + 0.4 * pk.traits.prudence || duree > 40));
    if !veut || (!abois && (coalise(p, k, j) || coalise(p, j, k))) || !p.diplomatie.hasard.p(0.25 * allure(p)) {
        return;
    }
    let pj = profil_de(p, j);
    let ratio_j = rapport_forces(p, pu, j, k);
    let ru = ruse(p);
    let (nk, nj) = (nom(p, k), nom(p, j));
    // aux abois, `k` cède une ville
    if ratio_j >= 2.2 - 0.6 * ru && (ratio < 0.6 || (pk.traits.prudence >= 0.9 && ratio < 0.8)) {
        if let Some(vi) = ville_a_ceder(p, k, j) {
            ceder_ville(p, vi, j, rapport);
            signer_paix(p, k, j, rapport);
            nouvelle(p, rapport, k, j, format!("🕊️ {nk} et {nj} signent la paix"), "info");
            return;
        }
    }
    if ratio_j >= 1.5 + 0.5 * pj.traits.agressivite && duree <= 36 {
        // réduit à sa dernière ville, `k` rachète sa survie avec la moitié de son or : un vainqueur avide prend
        // la rançon, un conquérant préfère la ville
        let rancon = (tresor(p, k) * 0.5).floor();
        if nb_villes(p, k) == 1 && rancon >= 100.0 && p.diplomatie.hasard.p(pj.traits.avidite * (1.0 - 0.5 * pj.traits.agressivite)) {
            verser(p, k, j, rancon);
            signer_paix(p, k, j, rapport);
            nouvelle(p, rapport, k, j, format!("🕊️ {nk} rachète la paix à {nj} ({rancon} 🪙)"), "info");
        }
        return;
    }
    // les réparations : 30 % de l'or que `k` a vraiment en caisse
    let or = if ratio_j >= 1.3 { (tresor(p, k) * 0.3).floor() } else { 0.0 };
    verser(p, k, j, or);
    signer_paix(p, k, j, rapport);
    let prix = if or > 0.0 { format!(" ({nk} verse {or} 🪙)") } else { String::new() };
    nouvelle(p, rapport, k, j, format!("🕊️ {nk} et {nj} signent la paix{prix}"), "info");
}

/// Les traités entre deux rivaux en paix : alliance (amitié, ou ennemi commun), fin d'alliance, route commerciale.
fn traites(p: &mut Partie, k: usize, j: usize, pu: &[f64], rapport: &mut Rapport) {
    let (pk, pj) = (profil_de(p, k), profil_de(p, j));
    let st = statut(p, k, j).to_string();
    let rel = relation(p, k, j);
    let (nk, nj) = (nom(p, k), nom(p, j));
    if st == "alliance" {
        if rel < 0.0 {
            fixer_statut(p, k, j, "paix");
            nouvelle(p, rapport, k, j, format!("📜 L'alliance entre {nk} et {nj} prend fin"), "info");
        }
    } else {
        // entre rivaux : l'amitié (30 points sous le seuil d'alliance avec le joueur), un ennemi commun,
        // ou un voisin commun plus fort que chacun d'eux
        let commun = ennemis(p, k as i32).iter().any(|x| ennemis(p, j as i32).contains(x));
        let menacant = (1..p.royaumes.len()).any(|x| x != k && x != j && p.royaumes[x].vivant && voisins(p, x, k) && voisins(p, x, j) && pu[x] > 1.2 * pu[k].max(pu[j]));
        let amis = rel >= pk.seuil_alliance - 30.0 && rel >= pj.seuil_alliance - 30.0;
        if (amis || (commun && rel >= 0.0) || (menacant && rel >= 10.0)) && p.diplomatie.hasard.p(0.08 * allure(p)) {
            fixer_statut(p, k, j, "alliance");
            nouvelle(p, rapport, k, j, format!("🤝 {nk} et {nj} signent une alliance"), "info");
        }
    }
    let route = commerce(p, k, j);
    if !route && rel >= 10.0 && (pk.traits.avidite + pj.traits.avidite) / 2.0 >= 0.45 && p.diplomatie.hasard.p(0.1) {
        *champs(p, k, j).commerce = true;
        nouvelle(p, rapport, k, j, format!("🛤️ {nk} et {nj} ouvrent une route commerciale"), "info");
    } else if route && rel < -10.0 {
        *champs(p, k, j).commerce = false;
    }
}

/// Un allié en guerre appelle aux armes : `k` le rejoint, d'autant plus volontiers qu'il est fidèle.
fn appel_aux_armes(p: &mut Partie, k: usize, pu: &[f64], rapport: &mut Rapport) {
    let pr = profil_de(p, k);
    if ennemis(p, k as i32).len() >= pr.max_guerres {
        return;
    }
    for j in allies(p, k as i32).into_iter().map(|j| j as usize) {
        for x in ennemis(p, j as i32).into_iter().map(|x| x as usize) {
            if x == k || en_guerre(p, k as i32, x as i32) || statut(p, k, x) == "alliance" || !contact(p, k, x) || rapport_forces(p, pu, k, x) < 0.5 {
                continue;
            }
            if !p.diplomatie.hasard.p(0.1 * pr.traits.fidelite * allure(p)) {
                continue;
            }
            guerre(p, k, x, rapport, false);
            souvenir(p, j, k, "aide", 10.0, "");
            let (nk, nj, nx) = (nom(p, k), nom(p, j), nom(p, x));
            if j == 0 {
                p.evt(rapport, format!("🤝 {nk} entre en guerre à vos côtés contre {nx} !"), "bon", None);
            } else if x == 0 {
                p.evt(rapport, format!("⚔️ {nk}, allié de {nj}, vous déclare la guerre !"), "guerre", None);
            } else {
                nouvelle(p, rapport, k, x, format!("📜 {nk} entre en guerre contre {nx} aux côtés de {nj}"), "guerre");
            }
            return;
        }
    }
}

/// Les termes de la paix qu'exige un vainqueur : une ville du joueur s'il domine nettement, de l'or s'il domine,
/// sinon des marchandises dont il manque.
fn termes_de_paix(p: &Partie, k: usize, ratio: f64) -> (String, Option<u32>, Panier) {
    let nk = nom(p, k);
    if ratio >= 2.2 - 0.6 * ruse(p) {
        if let Some(vi) = ville_a_ceder(p, 0, k) {
            let v = &p.villes[vi];
            return (format!("{nk} vous offre la paix si vous lui cédez {}.", v.nom), Some(v.id), Panier::new());
        }
    }
    if let Some(res) = p.royaumes[k].demande.first().filter(|_| ratio < 1.5) {
        let (rg, n) = (regles(), (40.0 * (0.7 + 0.6 * ruse(p))).round());
        return (format!("{nk} vous offre la paix contre {n} {} {}.", rg.res_icone(res), rg.res_nom(res)), None, Panier::from([(res.clone(), n)]));
    }
    let or = montant(p, ratio);
    (format!("{nk} vous offre la paix contre {or} 🪙."), None, Panier::from([("or".to_string(), or)]))
}

/// En guerre contre le joueur : une offre de paix dont les termes suivent le rapport de forces.
fn paix_au_joueur(p: &mut Partie, k: usize, pu: &[f64]) {
    let r = &p.royaumes[k];
    let duree = p.tour.saturating_sub(r.debut_guerre);
    if duree <= 12 || p.tour < r.prochaine_offre || p.propositions.iter().any(|x| x.de == k && x.genre == "paix") {
        return;
    }
    let ratio = rapport_forces(p, pu, k, 0);
    let pr = profil_de(p, k);
    if !(r.relation > -25.0 || ratio < 0.5 + 0.3 * pr.traits.prudence || duree > 36) || coalise(p, k, 0) || !p.diplomatie.hasard.p(0.25 * allure(p)) {
        return;
    }
    p.royaumes[k].prochaine_offre = p.tour + 6;
    let nk = nom(p, k);
    let mut pr = Proposition { de: k, genre: "paix".into(), ..Default::default() };
    if ratio >= 1.2 {
        let (texte, ville, demande) = termes_de_paix(p, k, ratio);
        (pr.texte, pr.ville, pr.demande) = (texte, ville, demande);
    } else if ratio < 0.6 && tresor(p, k) >= 50.0 {
        let or = (tresor(p, k) * 0.3).min(250.0).floor();
        pr.texte = format!("{nk}, épuisé, implore la paix et vous offre {or} 🪙 de réparations.");
        pr.donne = Panier::from([("or".to_string(), or)]);
    } else {
        pr.texte = format!("{nk}, las de la guerre, vous propose la paix.");
    }
    pr.texte += &suffixe(p, k);
    proposer(p, pr);
}

/// En paix avec le joueur : demande d'aide d'un allié en guerre, échange, alliance, tribut.
fn offres_au_joueur(p: &mut Partie, k: usize, pu: &[f64]) {
    let r = &p.royaumes[k];
    if p.tour <= 12 || p.tour < r.prochaine_offre {
        return;
    }
    let pr = profil_de(p, k);
    let (rel, st, nk) = (r.relation, r.statut.clone(), r.nom.clone());
    let al = allure(p);
    let mut offre = None;
    if st == "alliance" && !p.propositions.iter().any(|x| x.de == k && x.genre == "aide") {
        let cible = ennemis(p, k as i32).into_iter().map(|x| x as usize).find(|&x| x != 0 && !en_guerre(p, 0, x as i32) && statut(p, 0, x) != "alliance" && contact(p, 0, x));
        if let Some(x) = cible.filter(|_| p.diplomatie.hasard.p(0.35 * al)) {
            let texte = format!("{nk}, votre allié, est en guerre contre {} : il vous demande d'entrer en guerre à ses côtés.", nom(p, x));
            offre = Some(Proposition { de: k, genre: "aide".into(), texte, cible: Some(x), ..Default::default() });
        }
    }
    // un échange part de ses vrais surplus (ce qu'il peut céder sans entamer ses réserves) et de ses vrais besoins
    let surplus: Vec<String> = p.royaumes[k].surplus.iter().filter(|x| p.royaumes[k].stock.get(*x).copied().unwrap_or(0.0) >= 30.0 + super::economie::reserve(p, k, x)).cloned().collect();
    let echange = !surplus.is_empty() && !p.royaumes[k].demande.is_empty();
    if offre.is_some() {
    } else if echange && p.diplomatie.hasard.p(0.3 * pr.traits.avidite * pr.traits.avidite) {
        let donne = surplus[p.diplomatie.hasard.indice(surplus.len())].clone();
        let veut = p.royaumes[k].demande[p.diplomatie.hasard.indice(p.royaumes[k].demande.len())].clone();
        let rg = regles();
        let texte = format!("{nk} propose 30 {} {} contre 18 {} {}.", rg.res_icone(&donne), rg.res_nom(&donne), rg.res_icone(&veut), rg.res_nom(&veut));
        offre = Some(Proposition { de: k, genre: "echange".into(), texte, donne: Panier::from([(donne, 30.0)]), demande: Panier::from([(veut, 18.0)]), ..Default::default() });
    } else if rel >= pr.seuil_alliance && st != "alliance" && p.diplomatie.hasard.p(0.2 * al) {
        offre = Some(Proposition { de: k, genre: "alliance".into(), texte: format!("{nk} vous propose une alliance durable."), ..Default::default() });
    } else if pr.traits.agressivite * pr.traits.avidite >= 0.3 && rel < -15.0 && p.tour > 36 && rapport_forces(p, pu, k, 0) > 1.4 && p.diplomatie.hasard.p(0.2 * pr.traits.agressivite) {
        offre = Some(Proposition {
            de: k,
            genre: "tribut".into(),
            texte: format!("{nk} exige un tribut de 150 🪙, sinon c'est la guerre."),
            demande: Panier::from([("or".to_string(), 150.0)]),
            ..Default::default()
        });
    }
    if let Some(mut o) = offre {
        o.texte += &suffixe(p, k);
        proposer(p, o);
        p.royaumes[k].prochaine_offre = p.tour + p.diplomatie.hasard.entre(4, 9) as u32;
    }
}

// ------------------------------------------------------------------ le joueur négocie (commandes.rs)

/// Le joueur propose la paix à `k` : blanche (`paix`), contre une ville de `k` (`paix_ville`) ou contre
/// de l'or (`paix_or`). Selon le rapport de forces, `k` accepte, refuse, ou fait une contre-proposition.
pub fn negocier_paix(p: &mut Partie, k: usize, acte: &str) -> Result<String, String> {
    if !en_guerre(p, 0, k as i32) {
        return Err("Vous n'êtes pas en guerre".into());
    }
    let pu = puissances(p);
    let ratio = rapport_forces(p, &pu, k, 0);
    let ru = ruse(p);
    let nk = nom(p, k);
    let rel = p.royaumes[k].relation;
    let lie = coalise(p, k, 0);
    let deja = p.propositions.iter().any(|x| x.de == k && x.genre == "paix");
    let rappel = suffixe(p, k);
    let mut r = Rapport::default();
    let contre = |p: &mut Partie, texte: String, ville: Option<u32>, donne: Panier, demande: Panier| {
        proposer(p, Proposition { de: k, genre: "paix".into(), texte, ville, donne, demande, manche: 1, ..Default::default() });
    };
    match acte {
        "paix" => {
            if !lie && (rel > -45.0 || ratio < 0.7 + 0.2 * (1.0 - ru)) {
                signer_paix(p, 0, k, &mut r);
                return Ok(format!("🕊️ Paix signée avec {nk}"));
            }
            changer_relation(p, k, 0, -3.0);
            if !lie && !deja && ratio >= 1.0 {
                let (texte, ville, demande) = termes_de_paix(p, k, ratio);
                contre(p, texte.clone(), ville, Panier::new(), demande);
                return Ok(format!("✉️ {nk} refuse une paix blanche mais fait une contre-proposition : {texte}"));
            }
            Err(format!("{nk} refuse la paix{rappel}"))
        }
        "paix_ville" => {
            let vi = ville_a_ceder(p, k, 0).ok_or_else(|| format!("{nk} n'a qu'une ville : il ne la cédera jamais"))?;
            let ville = p.villes[vi].nom.clone();
            let assiegee = p.sieges.iter().any(|s| !s.fort && s.assiegeant == 0 && s.ville == p.villes[vi].id);
            if !lie && (ratio < 0.6 - 0.2 * ru || (assiegee && ratio < 0.8)) {
                ceder_ville(p, vi, 0, &mut r);
                signer_paix(p, 0, k, &mut r);
                for e in r.evenements {
                    p.noter(e.texte);
                }
                return Ok(format!("🕊️ Paix signée : {nk} vous cède {ville}"));
            }
            changer_relation(p, k, 0, -5.0);
            if !lie && !deja && ratio < 0.9 && tresor(p, k) >= 50.0 {
                let or = (tresor(p, k) * 0.3).min(250.0).floor();
                contre(p, format!("{nk} refuse de céder {ville}, mais vous offre la paix et {or} 🪙 de réparations."), None, Panier::from([("or".to_string(), or)]), Panier::new());
                return Ok(format!("✉️ {nk} refuse de céder {ville} mais propose {or} 🪙 de réparations"));
            }
            Err(format!("{nk} refuse de céder {ville}{rappel}"))
        }
        "paix_or" => {
            let or = (tresor(p, k) * 0.4).min(300.0).floor();
            if !lie && or >= 20.0 && ratio < 0.8 - 0.2 * ru {
                verser(p, k, 0, or);
                signer_paix(p, 0, k, &mut r);
                return Ok(format!("🕊️ Paix signée : {nk} vous verse {or} 🪙 de réparations"));
            }
            changer_relation(p, k, 0, -3.0);
            if !lie && !deja && ratio < 1.1 {
                contre(p, format!("{nk} refuse de payer, mais accepterait une paix blanche."), None, Panier::new(), Panier::new());
                return Ok(format!("✉️ {nk} refuse de payer mais propose une paix blanche"));
            }
            Err(format!("{nk} refuse de payer{rappel}"))
        }
        _ => Err("acte inconnu".into()),
    }
}

/// Le joueur propose l'alliance : acceptée selon la confiance (et le caractère) ; un souverain avide qui
/// hésite la monnaye.
pub fn alliance_proposee(p: &mut Partie, k: usize) -> Result<String, String> {
    let st = statut(p, 0, k).to_string();
    if st == "guerre" {
        return Err("Faites d'abord la paix".into());
    }
    if st == "alliance" {
        return Err("Vous êtes déjà alliés".into());
    }
    let pr = profil_de(p, k);
    let seuil = pr.seuil_alliance - 15.0;
    let (rel, nk) = (p.royaumes[k].relation, nom(p, k));
    if rel >= seuil {
        fixer_statut(p, 0, k, "alliance");
        return Ok(format!("🤝 Alliance conclue avec {nk}"));
    }
    if rel >= seuil - 15.0 && pr.traits.avidite >= 0.5 && !p.propositions.iter().any(|x| x.de == k && x.genre == "alliance") {
        let or = (150.0 * (0.7 + 0.6 * ruse(p)) / 10.0).round() * 10.0;
        let texte = format!("{nk} hésite : il scellerait l'alliance contre {or} 🪙.");
        proposer(p, Proposition { de: k, genre: "alliance".into(), texte, demande: Panier::from([("or".to_string(), or)]), manche: 1, ..Default::default() });
        return Ok(format!("✉️ {nk} hésite : il demande {or} 🪙 pour sceller l'alliance"));
    }
    Err(format!("{nk} ne vous fait pas assez confiance (relation ≥ {seuil:.0}){}", suffixe(p, k)))
}

/// Le joueur rompt son alliance avec `k` : une trahison, dont `k` se souviendra longtemps.
pub fn rompre(p: &mut Partie, k: usize) -> Result<String, String> {
    if statut(p, 0, k) != "alliance" {
        return Err("Vous n'êtes pas alliés".into());
    }
    fixer_statut(p, 0, k, "paix");
    p.royaumes[k].treve = 0;
    changer_relation(p, k, 0, -20.0);
    souvenir(p, k, 0, "trahison", -25.0, "");
    let temoins: Vec<usize> = (1..p.royaumes.len()).filter(|&o| o != k && p.royaumes[o].vivant && contact(p, o, 0)).collect();
    for o in temoins {
        changer_relation(p, o, 0, -5.0);
    }
    Ok(format!("💔 Vous rompez l'alliance avec {} : il ne l'oubliera pas", nom(p, k)))
}

/// Le joueur demande à son allié `k` d'entrer en guerre contre `x` (sans hasard : la même demande reçoit la même réponse).
pub fn aide_demandee(p: &mut Partie, k: usize, x: usize) -> Result<String, String> {
    let nk = nom(p, k);
    if statut(p, 0, k) != "alliance" {
        return Err("Seul un allié peut entrer en guerre à vos côtés".into());
    }
    if x == 0 || x == k || x >= p.royaumes.len() {
        return Err("royaume inconnu".into());
    }
    let nx = nom(p, x);
    if !p.royaumes[x].vivant {
        return Err("ce royaume n'existe plus".into());
    }
    if !en_guerre(p, 0, x as i32) {
        return Err(format!("Vous n'êtes pas en guerre contre {nx}"));
    }
    if en_guerre(p, k as i32, x as i32) {
        return Err(format!("{nk} est déjà en guerre contre {nx}"));
    }
    if statut(p, k, x) == "alliance" {
        return Err(format!("{nk} est l'allié de {nx} : il ne le trahira pas pour vous"));
    }
    if !contact(p, k, x) {
        return Err(format!("{nk} ne connaît pas {nx}"));
    }
    let pr = profil_de(p, k);
    let pu = puissances(p);
    if p.royaumes[k].relation < 60.0 - 30.0 * pr.traits.fidelite || rapport_forces(p, &pu, k, x) < 0.6 || ennemis(p, k as i32).len() >= pr.max_guerres {
        return Err(format!("{nk} refuse de s'engager contre {nx}{}", suffixe(p, k)));
    }
    let mut r = Rapport::default();
    guerre(p, k, x, &mut r, false);
    Ok(format!("⚔️ {nk} entre en guerre contre {nx} à vos côtés"))
}

/// Le joueur accepte d'aider `k` contre `cible` : il entre en guerre, et `k` s'en souviendra.
pub fn aide_acceptee(p: &mut Partie, k: usize, cible: usize) -> Result<String, String> {
    if cible >= p.royaumes.len() || !p.royaumes[cible].vivant {
        return Err("ce royaume n'existe plus".into());
    }
    let (nk, nc) = (nom(p, k), nom(p, cible));
    souvenir(p, k, 0, "aide", 15.0, "");
    changer_relation(p, k, 0, 10.0);
    if en_guerre(p, 0, cible as i32) {
        return Ok(format!("Vous êtes déjà en guerre contre {nc} : {nk} vous en sait gré"));
    }
    let mut r = Rapport::default();
    declarer_guerre(p, 0, cible, &mut r);
    Ok(format!("⚔️ Vous entrez en guerre contre {nc} aux côtés de {nk}"))
}

/// Le joueur refuse son aide à `k` : la relation baisse, et `k` ne l'oubliera pas.
pub fn aide_refusee(p: &mut Partie, k: usize) -> String {
    changer_relation(p, k, 0, -12.0);
    souvenir(p, k, 0, "refus_aide", -10.0, "");
    format!("{} n'oubliera pas votre refus", nom(p, k))
}

/// Le joueur vient de refuser la proposition `pr` : `k` peut revenir avec une autre offre (deux fois au plus).
pub fn contre_proposition(p: &mut Partie, pr: &Proposition) -> Option<String> {
    let k = pr.de;
    if k == 0 || pr.manche >= 2 || !p.royaumes.get(k).is_some_and(|r| r.vivant) || !p.diplomatie.hasard.p(0.5 + 0.4 * ruse(p)) {
        return None;
    }
    let nk = nom(p, k);
    let pu = puissances(p);
    let mut o = Proposition { de: k, genre: pr.genre.clone(), manche: pr.manche + 1, ..Default::default() };
    match pr.genre.as_str() {
        "paix" if pr.ville.is_some() && en_guerre(p, 0, k as i32) => {
            let or = montant(p, rapport_forces(p, &pu, k, 0));
            o.texte = format!("Soit : {nk} renonce à la ville, mais demande {or} 🪙 pour la paix.");
            o.demande = Panier::from([("or".to_string(), or)]);
        }
        "paix" if !pr.demande.is_empty() && en_guerre(p, 0, k as i32) && rapport_forces(p, &pu, k, 0) < 1.6 => {
            o.texte = format!("{nk} se contenterait finalement d'une paix blanche.");
        }
        "echange" => {
            o.donne = pr.donne.clone();
            o.demande = pr.demande.iter().map(|(r, v)| (r.clone(), (v * 0.75).round())).collect();
            let rg = regles();
            let lot = |pa: &Panier| pa.iter().map(|(r, v)| format!("{v} {} {}", rg.res_icone(r), rg.res_nom(r))).collect::<Vec<_>>().join(", ");
            o.texte = format!("{nk} revoit son offre : {} contre {}.", lot(&o.donne), lot(&o.demande));
        }
        "tribut" => {
            let or = (pr.demande.get("or").copied().unwrap_or(150.0) / 2.0).round();
            o.texte = format!("{nk} se radoucit : {or} 🪙 suffiront, et l'on n'en parlera plus.");
            o.demande = Panier::from([("or".to_string(), or)]);
        }
        _ => return None,
    }
    let texte = o.texte.clone();
    proposer(p, o);
    Some(format!("✉️ Contre-proposition : {texte}"))
}

// ------------------------------------------------------------------ l'interface (vue.rs)

/// Ce que le joueur sait de la diplomatie de `k` : son souverain, ses guerres, alliances et routes
/// avec les royaumes qu'il connaît, la coalition contre lui, ce dont il se souvient.
pub fn vue_royaume(p: &Partie, k: usize) -> Value {
    if k == 0 {
        return json!({"connu": true});
    }
    let connu = contact(p, 0, k);
    let tour = p.tour;
    let autres = |s: &str| -> Vec<usize> { (1..p.royaumes.len()).filter(|&j| j != k && p.royaumes[j].vivant && contact(p, 0, j) && statut(p, k, j) == s).collect() };
    let s = p.diplomatie.souverains.get(k);
    json!({
        "connu": connu,
        "souverain": s.filter(|_| connu).map(|s| json!({
            "nom": s.nom(), "cle": s.caractere, "caractere": nom_caractere(&s.caractere), "age": s.age,
            "regne": tour.saturating_sub(s.depuis) / 12, "traits": profil(&s.caractere).traits,
        })),
        "treve": if p.royaumes[k].statut != "guerre" && p.royaumes[k].treve > tour { p.royaumes[k].treve - tour } else { 0 },
        "guerres": if connu { autres("guerre") } else { vec![] },
        "allies": if connu { autres("alliance") } else { vec![] },
        "routes": if connu { (1..p.royaumes.len()).filter(|&j| j != k && contact(p, 0, j) && commerce(p, k, j) && statut(p, k, j) != "guerre").collect() } else { vec![] },
        "souvenir": rappel(p, k),
        "coalition": coalition_contre(p, k).filter(|_| connu).map(|c| c.membres.clone()),
    })
}

/// Les coalitions dont le joueur a connaissance (et celle contre lui).
pub fn vue_coalitions(p: &Partie) -> Value {
    json!(p.diplomatie.coalitions.iter().filter(|c| c.cible == 0 || contact(p, 0, c.cible)).map(|c| json!({"cible": c.cible, "membres": c.membres, "depuis": c.depuis})).collect::<Vec<_>>())
}

#[cfg(test)]
mod essais {
    use std::collections::BTreeMap;

    use super::*;
    use crate::carte::{Options, Terrain};
    use crate::commandes::executer;

    fn rencontre(p: &mut Partie, a: usize, b: usize) {
        if !contact(p, a, b) {
            p.diplomatie.contacts.push([a.min(b), a.max(b)]);
        }
    }

    fn renforcer(p: &mut Partie, k: usize, n: u32) {
        let c = p.villes[p.capitale(k as i32).unwrap()].case;
        match p.armees.iter_mut().find(|a| a.proprio == k as i32 && a.case == c) {
            Some(a) => *a.unites.entry("mousquetaire".into()).or_insert(0) += n,
            None => _ = p.creer_armee(k as i32, c, BTreeMap::from([("mousquetaire".to_string(), n)])),
        }
    }

    /// Une ville nouvelle pour `k`, à 5–9 cases de la capitale de `pres` (des voisins).
    fn ville_pres(p: &mut Partie, k: usize, pres: usize, nom: &str) -> usize {
        let centre = p.villes[p.capitale(pres as i32).unwrap()].case;
        let c = (0..p.carte.cases.len())
            .filter(|&c| (5..=9).contains(&p.carte.dist(c, centre)) && p.carte.cases[c].t == Terrain::Plaine && p.carte.cases[c].bat.is_none() && p.villes.iter().all(|v| p.carte.dist(v.case, c) >= 4))
            .min_by_key(|&c| p.carte.dist(c, centre))
            .expect("une plaine libre près de la capitale");
        let vi = p.fonder_ville(k as i32, c, nom.into(), 1, false);
        p.recalculer_territoire();
        vi
    }

    fn partie(graine: u64) -> Partie {
        let mut p = Partie::nouvelle(Options { graine, brigands: false, ..Options::default() });
        p.tour = 100;
        p
    }

    #[test]
    fn souverains_liens_et_guerre_entre_rivaux() {
        let mut p = partie(42);
        assert_eq!(p.diplomatie.souverains.len(), p.royaumes.len());
        assert!(p.diplomatie.souverains[1..].iter().all(|s| PROFILS.iter().any(|x| x.cle == s.caractere) && !s.prenom.is_empty()));
        assert_eq!(p.diplomatie.liens.len(), 3, "une relation par paire de rivaux");
        assert!(!p.est_ennemi(1, 2) && ennemis(&p, 1).is_empty());
        // ils se rencontrent, se haïssent : le conquérant plus fort déclare la guerre
        rencontre(&mut p, 1, 2);
        rencontre(&mut p, 0, 1);
        rencontre(&mut p, 0, 2);
        p.diplomatie.souverains[1].caractere = "conquerant".into();
        renforcer(&mut p, 1, 30);
        let mut r = Rapport::default();
        for _ in 0..300 {
            lien_mut(&mut p.diplomatie, 1, 2).relation = -80.0;
            let pu = puissances(&p);
            guerre_envisagee(&mut p, 1, 2, &pu, &mut r);
            if en_guerre(&p, 1, 2) {
                break;
            }
        }
        assert!(en_guerre(&p, 1, 2) && en_guerre(&p, 2, 1) && p.est_ennemi(1, 2) && p.est_ennemi(2, 1));
        assert_eq!((ennemis(&p, 1), ennemis(&p, 2)), (vec![2], vec![1]));
        assert!(!p.est_ennemi(0, 1) && !p.est_ennemi(0, 2), "le joueur n'est pas concerné");
        assert!(r.evenements.iter().any(|e| e.texte.contains("déclare la guerre à")), "le joueur apprend la nouvelle : {:?}", r.evenements);
        assert!(rancune(&p, 2, 1) < 0.0, "la victime s'en souvient");
        // l'interface : souverain, guerres entre royaumes connus
        let v = crate::vue::etat(&p);
        assert!(v["royaumes"][1]["diplo"]["souverain"]["nom"].is_string());
        assert_eq!(v["royaumes"][1]["diplo"]["guerres"], json!([2]));
        assert_eq!(v["royaumes"][1]["caractere"], "Conquérant");
    }

    #[test]
    fn prise_d_une_ville_entre_rivaux_de_bout_en_bout() {
        let mut p = partie(42);
        rencontre(&mut p, 0, 1);
        rencontre(&mut p, 0, 2);
        let mut r = Rapport::default();
        declarer_guerre(&mut p, 1, 2, &mut r);
        let vi = p.capitale(2).unwrap();
        let (cv, vid) = (p.villes[vi].case, p.villes[vi].id);
        let bats: Vec<u32> = p.batiments.iter().filter(|b| b.proprio == 2 && b.ville == Some(vid)).map(|b| b.id).collect();
        assert!(bats.len() >= 2);
        let depart = p.carte.voisins(cv).into_iter().find(|&c| p.praticable(c) && p.ville_a(c).is_none()).unwrap();
        let a = p.creer_armee(1, depart, BTreeMap::from([("mousquetaire".to_string(), 80)]));
        let ai = p.armee(a).unwrap();
        p.armees[ai].chemin = vec![cv];
        let r = p.fin_du_mois();
        assert_eq!(p.villes[vi].proprio, 1, "la ville est prise : {:?}", r.evenements);
        assert!(bats.iter().all(|&b| p.bat(b).is_none_or(|b| b.proprio == 1)), "ses bâtiments changent de mains");
        assert_eq!(p.carte.cases[cv].proprio, 1, "le territoire suit");
        assert!(!p.royaumes[2].vivant, "sa seule ville perdue, le royaume est anéanti");
        assert!(!p.armees.iter().any(|a| a.proprio == 2));
        assert!(r.evenements.iter().any(|e| e.texte.contains("a pris la ville de")), "{:?}", r.evenements);
        assert!(r.evenements.iter().any(|e| e.texte.contains("anéanti")));
        assert!(p.diplomatie.conquetes.iter().any(|c| c.par == 1 && c.sur == 2));
        assert!(ennemis(&p, 1).is_empty(), "un royaume mort n'est plus un ennemi");
    }

    #[test]
    fn coalition_contre_le_joueur_puis_contre_un_rival() {
        for (cible, ennemi_de) in [(0usize, "vous"), (1, "Coalition contre")] {
            let mut p = Partie::nouvelle(Options { graine: 7, rivaux: 4, brigands: false, ..Options::default() });
            p.tour = 100;
            let n = p.royaumes.len();
            for a in 0..n {
                for b in a + 1..n {
                    rencontre(&mut p, a, b);
                }
            }
            while puissances(&p)[cible] / puissances(&p).iter().sum::<f64>() < 0.55 {
                renforcer(&mut p, cible, 5);
            }
            let mut r = Rapport::default();
            coalitions(&mut p, &mut r);
            let c = coalition_contre(&p, cible).expect("une coalition se forme").clone();
            assert!(c.membres.len() >= 2 && !c.membres.contains(&0) && !c.membres.contains(&cible));
            assert!(c.membres.iter().all(|&m| en_guerre(&p, m as i32, cible as i32)), "ils lui déclarent la guerre ensemble");
            assert!(c.membres.iter().all(|&a| c.membres.iter().all(|&b| a == b || statut(&p, a, b) == "alliance")), "ils s'allient");
            assert!(r.evenements.iter().any(|e| e.texte.starts_with("⚔️ Coalition contre") && e.texte.contains(ennemi_de)), "{:?}", r.evenements);
            if cible == 1 {
                assert!(p.propositions.iter().any(|x| x.genre == "aide" && x.cible == Some(1)), "le joueur est invité à la rejoindre");
            }
            // en difficile, la coalition se forme plus tôt (une part moindre de la puissance suffit)
            let part = |p: &Partie| puissances(p)[cible] / puissances(p).iter().sum::<f64>();
            let mut q = Partie::nouvelle(Options { graine: 7, rivaux: 4, brigands: false, difficulte: 1.35, ..Options::default() });
            q.tour = 100;
            let mut f = Partie::nouvelle(Options { graine: 7, rivaux: 4, brigands: false, difficulte: 0.75, ..Options::default() });
            f.tour = 100;
            while part(&q) < 0.4 {
                renforcer(&mut q, cible, 5);
                renforcer(&mut f, cible, 5);
            }
            assert!(menace(&q, &puissances(&q), cible, 1.0) && !menace(&f, &puissances(&f), cible, 1.0));
        }
    }

    #[test]
    fn contre_propositions() {
        let mut p = partie(11);
        p.options.difficulte = 1.35;
        let mut r = Rapport::default();
        declarer_guerre(&mut p, 1, 0, &mut r);
        renforcer(&mut p, 1, 120);
        p.royaumes[1].relation = -80.0;
        // une paix blanche refusée, contre une paix à son prix
        let m = executer(&mut p, &json!({"action": "diplo", "royaume": 1, "acte": "paix"})).unwrap();
        assert!(m["msg"].as_str().unwrap().contains("contre-proposition"), "{m}");
        let c = p.propositions.iter().find(|x| x.de == 1 && x.genre == "paix").unwrap().clone();
        assert!(c.manche == 1 && (c.ville.is_some() || !c.demande.is_empty()));
        // un échange refusé : le marchand revoit son offre
        let mut vu = false;
        for _ in 0..30 {
            p.propositions.clear();
            let id = proposer(&mut p, Proposition { de: 2, genre: "echange".into(), texte: "…".into(), donne: Panier::from([("bois".to_string(), 30.0)]), demande: Panier::from([("or".to_string(), 18.0)]), ..Default::default() });
            let m = executer(&mut p, &json!({"action": "repondre", "proposition": id, "accepte": false})).unwrap();
            if let Some(o) = p.propositions.iter().find(|x| x.de == 2 && x.genre == "echange") {
                assert!(m["msg"].as_str().unwrap().starts_with("✉️ Contre-proposition"));
                assert_eq!((o.manche, o.demande["or"]), (1, 14.0));
                vu = true;
                break;
            }
        }
        assert!(vu, "une contre-proposition après un refus");
    }

    #[test]
    fn paix_contre_une_ville() {
        // le vainqueur exige une ville du joueur ; le joueur accepte
        let mut p = partie(11);
        let mut r = Rapport::default();
        declarer_guerre(&mut p, 1, 0, &mut r);
        let colonie = ville_pres(&mut p, 0, 0, "Colonie");
        renforcer(&mut p, 1, 300);
        p.royaumes[1].debut_guerre = p.tour - 40;
        for _ in 0..300 {
            let pu = puissances(&p);
            paix_au_joueur(&mut p, 1, &pu);
            p.royaumes[1].prochaine_offre = 0;
            if !p.propositions.is_empty() {
                break;
            }
        }
        let pr = p.propositions.iter().find(|x| x.genre == "paix").expect("une offre de paix").clone();
        assert_eq!(pr.ville, Some(p.villes[colonie].id), "{}", pr.texte);
        let or = p.royaumes[1].stock["or"];
        executer(&mut p, &json!({"action": "repondre", "proposition": pr.id, "accepte": true})).unwrap();
        assert_eq!(p.villes[colonie].proprio, 1);
        assert_eq!(p.royaumes[1].statut, "paix");
        assert!(p.royaumes[1].treve > p.tour && !p.est_ennemi(0, 1));
        assert_eq!(p.royaumes[1].stock["or"], or, "une ville cédée ne rapporte pas de butin");
        // le joueur victorieux exige une ville d'un rival aux abois
        let mut p = partie(11);
        declarer_guerre(&mut p, 0, 2, &mut r);
        let vi = ville_pres(&mut p, 2, 2, "Avant-poste");
        renforcer(&mut p, 0, 300);
        let or = p.joueur().stock["or"];
        let m = executer(&mut p, &json!({"action": "diplo", "royaume": 2, "acte": "paix_ville"})).unwrap();
        assert!(m["msg"].as_str().unwrap().contains("vous cède"), "{m}");
        assert_eq!(p.villes[vi].proprio, 0);
        assert_eq!(p.joueur().stock["or"], or, "pas de butin");
        assert!(!en_guerre(&p, 0, 2));
        // un rival qui n'a qu'une ville refuse net
        declarer_guerre(&mut p, 0, 3, &mut r);
        assert!(executer(&mut p, &json!({"action": "diplo", "royaume": 3, "acte": "paix_ville"})).unwrap_err().contains("qu'une ville"));
    }

    #[test]
    fn demande_d_aide_refusee_et_rancune() {
        let mut p = partie(42);
        for (a, b) in [(0, 1), (0, 2), (1, 2)] {
            rencontre(&mut p, a, b);
        }
        p.royaumes[1].statut = "alliance".into();
        p.royaumes[1].relation = 60.0;
        let mut r = Rapport::default();
        declarer_guerre(&mut p, 1, 2, &mut r);
        for _ in 0..200 {
            p.royaumes[1].prochaine_offre = 0;
            let pu = puissances(&p);
            offres_au_joueur(&mut p, 1, &pu);
            if p.propositions.iter().any(|x| x.genre == "aide") {
                break;
            }
            p.propositions.clear();
        }
        let pr = p.propositions.iter().find(|x| x.genre == "aide").expect("l'allié demande de l'aide").clone();
        assert_eq!((pr.de, pr.cible), (1, Some(2)));
        let avant = p.royaumes[1].relation;
        let m = executer(&mut p, &json!({"action": "repondre", "proposition": pr.id, "accepte": false})).unwrap();
        assert!(m["msg"].as_str().unwrap().contains("n'oubliera pas"));
        assert!(p.royaumes[1].relation <= avant - 12.0);
        assert!(rappel(&p, 1).unwrap().contains("abandonné"), "il le dit dans ses messages");
        // une demande acceptée : le joueur entre en guerre, et l'allié s'en souvient
        let id = proposer(&mut p, Proposition { de: 1, genre: "aide".into(), cible: Some(2), ..Default::default() });
        executer(&mut p, &json!({"action": "repondre", "proposition": id, "accepte": true})).unwrap();
        assert!(en_guerre(&p, 0, 2) && rancune(&p, 1, 0) > rancune(&p, 1, 2));
        // le joueur demande l'aide de son allié : refus exacts
        let e = |p: &mut Partie, k: i64, x: i64| executer(p, &json!({"action": "diplo", "royaume": k, "acte": "aide", "contre": x})).unwrap_err();
        assert_eq!(e(&mut p, 2, 1), "Seul un allié peut entrer en guerre à vos côtés");
        assert_eq!(e(&mut p, 1, 2), format!("{} est déjà en guerre contre {}", p.royaumes[1].nom, p.royaumes[2].nom));
        assert_eq!(e(&mut p, 1, 3), format!("Vous n'êtes pas en guerre contre {}", p.royaumes[3].nom));
        assert_eq!(e(&mut p, 1, 9), "royaume inconnu");
    }

    #[test]
    fn rancune_apres_une_trahison() {
        let mut p = partie(42);
        let mut temoin = p.clone();
        for q in [&mut p, &mut temoin] {
            q.royaumes[1].statut = "alliance".into();
            q.royaumes[1].relation = 70.0;
        }
        // rompre l'alliance en déclarant la guerre : une trahison
        executer(&mut p, &json!({"action": "diplo", "royaume": 1, "acte": "guerre"})).unwrap();
        assert!(p.diplomatie.souvenirs.iter().any(|s| s.de == 1 && s.envers == 0 && s.genre == "trahison"));
        let mut r = Rapport::default();
        signer_paix(&mut p, 0, 1, &mut r);
        fixer_statut(&mut temoin, 0, 1, "paix");
        for _ in 0..60 {
            for q in [&mut p, &mut temoin] {
                monde(q, &mut r);
                humeur_joueur(q, 1);
            }
        }
        assert!(p.royaumes[1].relation < temoin.royaumes[1].relation - 15.0, "cinq ans après, la trahison pèse encore : {} contre {}", p.royaumes[1].relation, temoin.royaumes[1].relation);
        assert!(rappel(&p, 1).unwrap().contains("trahison"));
        // attaquer pendant la trêve : une autre trahison, que les témoins jugent aussi
        rencontre(&mut p, 0, 2);
        let rel2 = p.royaumes[2].relation;
        assert!(p.royaumes[1].treve > p.tour);
        declarer_guerre(&mut p, 0, 1, &mut r);
        assert!(p.diplomatie.souvenirs.iter().any(|s| s.de == 1 && s.genre == "treve_rompue"));
        assert!(p.royaumes[2].relation < rel2);
        assert!(r.evenements.iter().any(|e| e.texte.contains("rompez la trêve")));
    }

    #[test]
    fn succession_et_coup_d_etat() {
        let mut p = partie(42);
        rencontre(&mut p, 0, 1);
        let mut r = Rapport::default();
        let avant = p.diplomatie.souverains[1].clone();
        succession(&mut p, 1, true, &mut r);
        let apres = p.diplomatie.souverains[1].clone();
        assert!(apres.caractere != avant.caractere, "l'usurpateur a un autre caractère");
        assert_eq!(p.royaumes[1].caractere, vers_ancien(&apres.caractere), "l'économie suit le nouveau souverain");
        assert!(r.evenements.iter().any(|e| e.texte.starts_with("🗡️ Coup d'État") && e.texte.contains(&apres.nom())));
        // un vieux roi finit par mourir ; son héritier lui succède
        p.diplomatie.souverains[1].age = 95;
        let nom = p.diplomatie.souverains[1].nom();
        let mut r = Rapport::default();
        for _ in 0..240 {
            monde(&mut p, &mut r);
            if p.diplomatie.souverains[1].nom() != nom {
                break;
            }
        }
        assert!(p.diplomatie.souverains[1].age < 95, "un nouveau souverain");
        assert!(r.evenements.iter().any(|e| e.texte.starts_with("👑") && e.texte.contains(&nom)), "{:?}", r.evenements);
    }

    #[test]
    fn les_caracteres_se_conduisent_differemment() {
        let mut base = partie(42);
        ville_pres(&mut base, 2, 1, "Marche-Frontière");
        let ratio = |p: &Partie| rapport_forces(p, &puissances(p), 1, 2);
        while ratio(&base) < 1.45 {
            renforcer(&mut base, 1, 2);
        }
        rencontre(&mut base, 1, 2);
        rencontre(&mut base, 0, 1);
        let essais = 400;
        // (scénario, déclarations ou trahisons par caractère)
        let compter = |c: &str, scenario: u8| -> usize {
            let mut p = base.clone();
            p.diplomatie.souverains[1].caractere = c.into();
            if scenario > 0 {
                // le voisin est en guerre ailleurs
                let mut r = Rapport::default();
                guerre(&mut p, 2, 3, &mut r, false);
            }
            let mut n = 0;
            let mut r = Rapport::default();
            for _ in 0..essais {
                let l = lien_mut(&mut p.diplomatie, 1, 2);
                (l.statut, l.relation, l.treve) = (if scenario == 2 { "alliance" } else { "neutre" }.into(), if scenario == 0 { -30.0 } else { 0.0 }, 0);
                let pu = puissances(&p);
                guerre_envisagee(&mut p, 1, 2, &pu, &mut r);
                n += en_guerre(&p, 1, 2) as usize;
            }
            n
        };
        let haine: BTreeMap<&str, usize> = PROFILS.iter().map(|x| (x.cle, compter(x.cle, 0))).collect();
        let occasion: BTreeMap<&str, usize> = PROFILS.iter().map(|x| (x.cle, compter(x.cle, 1))).collect();
        let trahison: BTreeMap<&str, usize> = PROFILS.iter().map(|x| (x.cle, compter(x.cle, 2))).collect();
        println!("haine {haine:?}\noccasion {occasion:?}\ntrahison {trahison:?}");
        // la haine (relation −30) : seul le conquérant attaque
        assert!(haine["conquerant"] > 15 && ["marchand", "batisseur", "prudent", "opportuniste", "fourbe"].iter().all(|c| haine[c] == 0));
        // un voisin affaibli : les opportunistes, fourbes et conquérants en profitent, pas les autres
        assert!(["opportuniste", "fourbe", "conquerant"].iter().all(|c| occasion[c] > 5) && ["marchand", "batisseur", "prudent"].iter().all(|c| occasion[c] == 0));
        // un allié affaibli : le fourbe trahit bien plus que les autres ; les fidèles jamais
        assert!(trahison["fourbe"] > 3 * trahison["opportuniste"].max(1) && ["conquerant", "marchand", "batisseur", "prudent"].iter().all(|c| trahison[c] == 0));
        // le goût du commerce : les offres d'échange au joueur
        let echanges = |c: &str| {
            let mut p = base.clone();
            p.diplomatie.souverains[1].caractere = c.into();
            p.royaumes[1].relation = 0.0;
            // de quoi échanger : de la pierre en trop, du pain qui manque
            p.royaumes[1].stock.insert("pierre".into(), 200.0);
            (p.royaumes[1].surplus, p.royaumes[1].demande) = (vec!["pierre".into()], vec!["pain".into()]);
            let mut n = 0;
            for _ in 0..essais {
                p.royaumes[1].prochaine_offre = 0;
                p.propositions.clear();
                let pu = puissances(&p);
                offres_au_joueur(&mut p, 1, &pu);
                n += p.propositions.iter().filter(|x| x.genre == "echange").count();
            }
            n
        };
        let (m, c, b) = (echanges("marchand"), echanges("conquerant"), echanges("batisseur"));
        println!("échanges : marchand {m}, conquérant {c}, bâtisseur {b}");
        assert!(m > 2 * c && c > b, "marchand {m}, conquérant {c}, bâtisseur {b}");
    }

    #[test]
    fn ancienne_sauvegarde_sans_diplomatie() {
        let mut p = partie(31);
        p.royaumes[1].caractere = "guerrier".into();
        p.royaumes[2].caractere = "batisseur".into();
        p.royaumes[1].relation = -33.0;
        p.propositions.push(Proposition { id: 999, de: 1, genre: "alliance".into(), texte: "…".into(), ..Default::default() });
        let mut v = serde_json::to_value(&p).unwrap();
        v["version"] = json!(4);
        v.as_object_mut().unwrap().remove("diplomatie");
        for pr in v["propositions"].as_array_mut().unwrap() {
            for k in ["ville", "cible", "manche"] {
                pr.as_object_mut().unwrap().remove(k);
            }
        }
        let q = Partie::relire(&v.to_string()).unwrap();
        assert_eq!(q.version, crate::partie::VERSION_SAUVEGARDE);
        assert_eq!(q.diplomatie.souverains.len(), q.royaumes.len());
        assert_eq!(q.diplomatie.souverains[1].caractere, "conquerant", "guerrier devient conquérant");
        assert_eq!(q.diplomatie.souverains[2].caractere, "batisseur");
        assert_eq!(q.diplomatie.liens.len(), 3);
        assert_eq!((q.royaumes[1].relation, q.propositions[0].manche), (-33.0, 0));
        // et le jeu continue
        let mut q = q;
        for _ in 0..12 {
            q.fin_du_mois();
        }
        let r = Partie::relire(&serde_json::to_string(&q).unwrap()).unwrap();
        assert_eq!(r.diplomatie.souverains[1].nom(), q.diplomatie.souverains[1].nom());
    }

    /// Bilan d'une campagne : guerres, paix, villes prises entre rivaux, coalitions, successions.
    #[derive(Debug, Default)]
    struct Bilan {
        guerres: usize,
        paix: usize,
        prises: usize,
        aneantis: usize,
        alliances: usize,
        coalitions: usize,
        successions: usize,
    }

    #[test]
    fn quinze_ans_sans_diplomatie_du_joueur() {
        let mut total = Bilan::default();
        let (mut avec_guerre_et_paix, mut avec_prise) = (0, 0);
        for g in [7u64, 99, 2024, 5, 42] {
            let mut p = Partie::nouvelle(Options { graine: g, rivaux: 5, taille: "grande".into(), ..Options::default() });
            let mut b = Bilan::default();
            let debut = std::time::Instant::now();
            for _ in 0..15 * 12 {
                let avant: Vec<(u32, i32)> = p.villes.iter().map(|v| (v.id, v.proprio)).collect();
                let guerres: Vec<(usize, usize)> = p.diplomatie.liens.iter().filter(|l| l.statut == "guerre").map(|l| (l.a, l.b)).collect();
                let allies = p.diplomatie.liens.iter().filter(|l| l.statut == "alliance").count();
                let (coal, vivants) = (p.diplomatie.coalitions.len(), p.royaumes.iter().filter(|r| r.vivant).count());
                let souv: Vec<String> = p.diplomatie.souverains.iter().map(|s| s.nom()).collect();
                // le joueur laisse toutes les propositions sans réponse
                p.fin_du_mois();
                if p.fin.as_ref().is_some_and(|f| !f.victoire) {
                    // le joueur est tombé : le monde continue sans lui
                    (p.fin, p.sans_victoire) = (None, true);
                }
                b.prises += avant.iter().filter(|&&(id, pr)| pr > 0 && p.villes.iter().any(|v| v.id == id && v.proprio > 0 && v.proprio != pr)).count();
                let apres: Vec<(usize, usize)> = p.diplomatie.liens.iter().filter(|l| l.statut == "guerre").map(|l| (l.a, l.b)).collect();
                b.guerres += apres.iter().filter(|x| !guerres.contains(x)).count();
                b.paix += guerres.iter().filter(|x| !apres.contains(x) && p.royaumes[x.0].vivant && p.royaumes[x.1].vivant).count();
                b.alliances += p.diplomatie.liens.iter().filter(|l| l.statut == "alliance").count().saturating_sub(allies);
                b.coalitions += p.diplomatie.coalitions.len().saturating_sub(coal);
                b.successions += p.diplomatie.souverains.iter().zip(&souv).filter(|(s, n)| s.nom() != **n).count();
                b.aneantis += vivants - p.royaumes.iter().filter(|r| r.vivant).count();
            }
            let duree = debut.elapsed().as_secs_f64() * 1000.0 / 180.0;
            println!("graine {g} : {b:?} · {duree:.1} ms par mois · villes {:?}", p.royaumes.iter().map(|r| nb_villes(&p, r.id)).collect::<Vec<_>>());
            avec_guerre_et_paix += (b.guerres > 0 && b.paix > 0) as usize;
            avec_prise += (b.prises > 0) as usize;
            total.guerres += b.guerres;
            total.paix += b.paix;
            total.prises += b.prises;
            total.alliances += b.alliances;
            total.coalitions += b.coalitions;
            total.successions += b.successions;
            total.aneantis += b.aneantis;
        }
        println!("en tout : {total:?}");
        assert!(avec_guerre_et_paix >= 3, "des guerres et des paix entre rivaux sur la plupart des graines ({avec_guerre_et_paix}/5)");
        assert!(avec_prise >= 2, "la carte change de mains sur plusieurs graines ({avec_prise}/5)");
        assert!(total.alliances > 0 && total.successions > 0);
    }
}
