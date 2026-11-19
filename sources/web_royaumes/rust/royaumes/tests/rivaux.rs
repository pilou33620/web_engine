//! Les rivaux laissés seuls dix ans, sur plusieurs formes de carte et aux trois difficultés : ils vivent la même
//! économie que le joueur, sans tricher, et doivent prospérer (rang, techs, armée, pas de famine en boucle, réserves
//! jamais négatives), d'autant mieux que la difficulté est haute. Ils se font aussi la guerre (ia/diplomatie.rs) :
//! un rival conquis par un autre sort des moyennes, et les conquêtes doivent rester rares en dix ans.
//! `cargo test --release --test rivaux -- --nocapture` affiche le tableau de prospérité et le temps d'un mois.

use std::time::Instant;

use royaumes::carte::Options;
use royaumes::partie::Partie;

/// La prospérité des rivaux au bout de dix ans (sommes, pour les moyennes).
#[derive(Debug)]
struct Prosperite {
    pop: f64,
    rang: f64,
    techs: f64,
    armee: f64,
    villes: f64,
    batiments: f64,
    /// le plus de mois de famine d'un rival en dix ans
    famine_max: u32,
    /// les rivaux restés au rang de Hameau
    hameaux: usize,
    techs_min: usize,
    armee_min: u32,
    rivaux: usize,
    /// les rivaux anéantis par un autre
    conquis: usize,
}

impl Default for Prosperite {
    fn default() -> Self {
        Prosperite { pop: 0.0, rang: 0.0, techs: 0.0, armee: 0.0, villes: 0.0, batiments: 0.0, famine_max: 0, hameaux: 0, techs_min: usize::MAX, armee_min: u32::MAX, rivaux: 0, conquis: 0 }
    }
}

impl Prosperite {
    fn ajouter(&mut self, x: &Prosperite) {
        self.pop += x.pop;
        self.rang += x.rang;
        self.techs += x.techs;
        self.armee += x.armee;
        self.villes += x.villes;
        self.batiments += x.batiments;
        self.famine_max = self.famine_max.max(x.famine_max);
        self.hameaux += x.hameaux;
        self.techs_min = self.techs_min.min(x.techs_min);
        self.armee_min = self.armee_min.min(x.armee_min);
        self.rivaux += x.rivaux;
        self.conquis += x.conquis;
    }
}

const FORMES: [&str; 4] = ["classique", "continent", "archipel", "mer_interieure"];
/// quatre cartes par forme : la prospérité dépend beaucoup de la carte (un filon de fer, des bois, la côte)
const CARTES: u64 = 4;

fn dix_ans(forme: &str, difficulte: f64, graine: u64) -> Prosperite {
    let mut p = Partie::nouvelle(Options { graine, forme: forme.into(), difficulte, brigands: false, ..Options::default() });
    let n = p.royaumes.len();
    let mut famine = vec![0u32; n];
    for _ in 0..120 {
        p.fin_du_mois();
        for k in 1..n {
            let r = &p.royaumes[k];
            famine[k] += r.famine as u32;
            assert!(r.stock.values().all(|&v| v >= 0.0), "{forme} : réserves négatives chez {} : {:?}", r.nom, r.stock);
            assert!(r.pop >= 1);
        }
        if p.fin.is_some() {
            break;
        }
    }
    let mut x = Prosperite::default();
    for k in 1..n {
        let id = k as i32;
        if !p.royaumes[k].vivant {
            println!("  {forme} {difficulte} (graine {graine}) : {} a été conquis", p.royaumes[k].nom);
            x.conquis += 1;
            continue;
        }
        let (rang, techs, armee) = (p.niveau_capitale(id), p.royaumes[k].techs.len(), p.stats(id).soldats as u32);
        x.ajouter(&Prosperite {
            pop: p.royaumes[k].pop as f64,
            rang: rang as f64,
            techs: techs as f64,
            armee: armee as f64,
            villes: p.villes.iter().filter(|v| v.proprio == id).count() as f64,
            batiments: p.batiments.iter().filter(|b| b.proprio == id).count() as f64,
            famine_max: famine[k],
            hameaux: (rang < 2) as usize,
            techs_min: techs,
            armee_min: armee,
            rivaux: 1,
            conquis: 0,
        });
    }
    x
}

#[test]
fn les_rivaux_prosperent_seuls_et_selon_la_difficulte() {
    let mut tableau = Vec::new();
    println!("| Difficulté | Population | Rang | Techs | Armée | Villes | Bâtiments | Famine max (mois) | Restés Hameau | Conquis |");
    for (nom, difficulte) in [("Facile", 0.75), ("Normale", 1.0), ("Difficile", 1.35)] {
        let mut t = Prosperite::default();
        for (i, forme) in FORMES.iter().enumerate() {
            for g in 0..CARTES {
                let graine = 1750 + i as u64 * 10 + g;
                let x = dix_ans(forme, difficulte, graine);
                if x.hameaux > 0 || x.famine_max >= 12 {
                    println!("  {nom} {forme} (graine {graine}) : {} rival(aux) au rang de Hameau, famine max {} mois", x.hameaux, x.famine_max);
                }
                t.ajouter(&x);
            }
        }
        let r = t.rivaux as f64;
        println!(
            "| {nom} | {:.0} | {:.2} | {:.1} (min {}) | {:.1} (min {}) | {:.2} | {:.0} | {} | {}/{} | {} |",
            t.pop / r, t.rang / r, t.techs / r, t.techs_min, t.armee / r, t.armee_min, t.villes / r, t.batiments / r, t.famine_max, t.hameaux, t.rivaux, t.conquis
        );
        tableau.push((nom, t));
    }
    for (nom, t) in &tableau {
        // au plus difficile, tous atteignent le Village ; plus bas, les erreurs voulues en laissent rarement un à la traîne
        let tolere = if *nom == "Difficile" { 0 } else { t.rivaux / 20 };
        assert!(t.hameaux <= tolere, "{nom} : {} rivaux sur {} restés au rang de Hameau", t.hameaux, t.rivaux);
        assert!(t.conquis * 8 <= t.rivaux + t.conquis, "{nom} : {} rivaux sur {} conquis en dix ans", t.conquis, t.rivaux + t.conquis);
        assert!(t.famine_max < 24, "{nom} : un rival a eu faim {} mois sur 120", t.famine_max);
        assert!(t.techs_min >= 2, "{nom} : un rival n'a découvert que {} technologie(s)", t.techs_min);
        assert!(t.armee_min >= 4, "{nom} : un rival n'a que {} soldats", t.armee_min);
    }
    // la difficulté se voit dans leur prospérité
    let pop = |i: usize| tableau[i].1.pop / tableau[i].1.rivaux as f64;
    assert!(pop(0) < pop(1) && pop(1) < pop(2), "population moyenne : facile {:.0}, normale {:.0}, difficile {:.0}", pop(0), pop(1), pop(2));
}

#[test]
fn un_mois_reste_rapide_avec_six_royaumes_sur_une_grande_carte() {
    let mut p = Partie::nouvelle(Options { graine: 9, taille: "grande".into(), rivaux: 5, difficulte: 1.35, ..Options::default() });
    // dix ans de croissance d'abord : des royaumes bien remplis
    for _ in 0..120 {
        p.fin_du_mois();
    }
    let debut = Instant::now();
    for _ in 0..12 {
        p.fin_du_mois();
    }
    let ms = debut.elapsed().as_secs_f64() * 1000.0 / 12.0;
    println!("un mois avec {} royaumes sur une grande carte, après dix ans ({} bâtiments) : {ms:.1} ms", p.royaumes.len(), p.batiments.len());
    // le profil de test est moins optimisé que la version publiée : la borne y est large
    assert!(ms < 400.0, "{ms:.1} ms par mois");
}
