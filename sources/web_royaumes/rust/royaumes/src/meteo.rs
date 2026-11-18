//! Calendrier, saisons et météo : un tirage par mois, autour des normales d'un climat
//! océanique tempéré du « petit âge glaciaire », avec quelques années restées célèbres
//! (Grand Hiver de 1709, orage de grêle de 1788, « année sans été » de 1816…).

use serde::{Deserialize, Serialize};

use crate::hasard::Hasard;

pub const ANNEE_DEPART: i32 = 1700;
pub const ANNEE_FIN: i32 = 1850;
pub const MOIS: [&str; 12] =
    ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
/// Températures normales du mois (°C).
const NORMALES: [f64; 12] = [2.5, 3.5, 7.5, 11.0, 14.5, 18.0, 20.0, 20.0, 17.0, 12.5, 7.0, 3.5];
/// Probabilité d'un mois à dominante humide.
const HUMIDE: [f64; 12] = [0.55, 0.5, 0.48, 0.5, 0.48, 0.38, 0.32, 0.34, 0.4, 0.52, 0.56, 0.56];

pub fn annee(tour: u32) -> i32 {
    ANNEE_DEPART + (tour / 12) as i32
}
pub fn mois(tour: u32) -> usize {
    (tour % 12) as usize
}
/// 0 hiver, 1 printemps, 2 été, 3 automne.
pub fn saison(m: usize) -> usize {
    match m {
        11 | 0 | 1 => 0,
        2..=4 => 1,
        5..=7 => 2,
        _ => 3,
    }
}
pub const SAISONS: [&str; 4] = ["Hiver", "Printemps", "Été", "Automne"];

pub fn date_texte(tour: u32) -> String {
    format!("{} {}", MOIS[mois(tour)], annee(tour))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Meteo {
    /// soleil, nuages, pluie, orage, brouillard, neige, gel, canicule, tempete
    pub genre: String,
    pub titre: String,
    pub icone: String,
    pub temperature: f64,
    /// écart persistant aux normales (les mois se ressemblent d'un mois à l'autre)
    pub anomalie: f64,
    /// force du vent, 0 à 1, et sa direction (radians, 0 = vers l'est)
    pub vent: f64,
    pub direction: f64,
    /// intensité des précipitations, 0 à 1
    pub pluie: f64,
    /// neige au sol, 0 à 1 (s'accumule l'hiver, fond au redoux)
    pub neige_sol: f64,
    /// sécheresse accumulée (au-delà de 1, les cultures souffrent)
    pub secheresse: f64,
    /// événement historique du mois, s'il y en a un
    pub historique: Option<String>,
}

impl Default for Meteo {
    fn default() -> Self {
        Meteo {
            genre: "nuages".into(),
            titre: "Nuageux".into(),
            icone: "☁️".into(),
            temperature: 5.0,
            anomalie: 0.0,
            vent: 0.3,
            direction: 0.5,
            pluie: 0.0,
            neige_sol: 0.0,
            secheresse: 0.0,
            historique: None,
        }
    }
}

/// Les effets du temps sur le mois joué.
#[derive(Clone, Debug, Serialize)]
pub struct Effets {
    /// multiplicateur des récoltes (en plus de la saison)
    pub cultures: f64,
    /// multiplicateur des déplacements des armées
    pub mouvement: f64,
    pub peche: f64,
    pub bonheur: f64,
    /// risque d'incendie (multiplicateur)
    pub incendie: f64,
    pub epidemie: f64,
    /// efficacité des armes à feu (poudre mouillée sous la pluie)
    pub tir: f64,
    pub resume: Vec<String>,
}

fn libelle(genre: &str) -> (&'static str, &'static str) {
    match genre {
        "soleil" => ("Ensoleillé", "☀️"),
        "nuages" => ("Nuageux", "⛅"),
        "pluie" => ("Pluvieux", "🌧️"),
        "orage" => ("Orageux", "⛈️"),
        "brouillard" => ("Brumeux", "🌫️"),
        "neige" => ("Neigeux", "🌨️"),
        "gel" => ("Grand froid", "🥶"),
        "canicule" => ("Canicule", "🥵"),
        "tempete" => ("Tempête", "🌪️"),
        _ => ("Variable", "🌤️"),
    }
}

impl Meteo {
    /// Tire le temps du mois `tour` à partir de celui du mois précédent.
    pub fn tirer(prec: &Meteo, tour: u32, h: &mut Hasard) -> Meteo {
        let m = mois(tour);
        let an = annee(tour);
        let s = saison(m);
        let mut anomalie = prec.anomalie * 0.6 + h.normale() * 1.7;
        let mut historique = None;
        // années célèbres
        if an == 1709 && (m == 0 || m == 1) {
            anomalie = -14.0 + h.f() * 2.0;
            historique = Some("Le Grand Hiver de 1709 : les rivières gèlent, les oliviers éclatent, la famine menace.".into());
        }
        if an == 1740 && m <= 1 {
            anomalie = anomalie.min(-6.0);
            historique = Some("L'hiver rigoureux de 1740 glace les campagnes.".into());
        }
        if an == 1816 && (5..=7).contains(&m) {
            anomalie = anomalie.min(-4.0);
            historique = Some("L'« année sans été » : un volcan lointain voile le soleil, pluies froides sur les moissons.".into());
        }
        let temperature = NORMALES[m] + anomalie;
        let mut humide = HUMIDE[m] + if an == 1816 { 0.3 } else { 0.0 };
        if prec.genre == "pluie" || prec.genre == "orage" {
            humide += 0.08;
        }
        let pleut = h.p(humide.min(0.9));
        let mut genre = if temperature < -1.0 {
            if pleut { "neige" } else { "gel" }
        } else if temperature < 3.5 && pleut {
            "neige"
        } else if temperature < 1.5 && h.p(0.5) {
            "gel"
        } else if temperature > 25.5 && !pleut {
            "canicule"
        } else if pleut {
            if s == 2 && h.p(0.45) { "orage" } else { "pluie" }
        } else if (s == 1 || s == 3) && h.p(0.18) {
            "brouillard"
        } else if h.p(0.55) {
            "soleil"
        } else {
            "nuages"
        };
        if (s == 0 || s == 3) && h.p(0.07) {
            genre = "tempete";
        }
        if an == 1788 && m == 6 {
            genre = "orage";
            historique = Some("13 juillet 1788 : un orage de grêle hache les blés sur des lieues.".into());
        }
        let pluie = match genre {
            "pluie" => 0.5 + h.f() * 0.4,
            "orage" => 0.8 + h.f() * 0.2,
            "tempete" => 0.7 + h.f() * 0.3,
            "neige" => 0.4 + h.f() * 0.5,
            _ => 0.0,
        };
        let vent = match genre {
            "tempete" => 0.85 + h.f() * 0.15,
            "orage" => 0.5 + h.f() * 0.3,
            "brouillard" | "canicule" => h.f() * 0.15,
            _ => 0.15 + h.f() * 0.4,
        };
        let direction = prec.direction + (h.f() - 0.5) * 1.2;
        let mut neige_sol = prec.neige_sol;
        if genre == "neige" {
            neige_sol = (neige_sol + 0.45 + pluie * 0.3).min(1.0);
        } else if temperature < 0.0 {
            neige_sol = neige_sol.min(1.0);
        } else {
            neige_sol = (neige_sol - (temperature - 1.0).max(0.5) / 5.0).max(0.0);
        }
        let mut secheresse = prec.secheresse;
        if pluie > 0.0 {
            secheresse = (secheresse - 0.7).max(0.0);
        } else if s == 2 {
            secheresse += if genre == "canicule" { 0.6 } else { 0.3 };
        } else {
            secheresse = (secheresse - 0.2).max(0.0);
        }
        let (titre, icone) = libelle(genre);
        Meteo {
            genre: genre.into(),
            titre: titre.into(),
            icone: icone.into(),
            temperature: (temperature * 10.0).round() / 10.0,
            anomalie,
            vent,
            direction,
            pluie,
            neige_sol,
            secheresse,
            historique,
        }
    }

    /// Les effets de ce temps sur un mois donné.
    pub fn effets(&self, tour: u32) -> Effets {
        let s = saison(mois(tour));
        let mut e = Effets { cultures: 1.0, mouvement: 1.0, peche: 1.0, bonheur: 0.0, incendie: 1.0, epidemie: 1.0, tir: 1.0, resume: Vec::new() };
        match self.genre.as_str() {
            "soleil" => {
                e.bonheur = 2.0;
                if s == 2 {
                    e.incendie = 1.4;
                }
            }
            "pluie" => {
                if s == 1 || s == 2 {
                    e.cultures = 1.1;
                    e.resume.push("Pluie bienvenue : récoltes +10 %".into());
                }
                e.mouvement = 0.8;
                e.tir = 0.8;
                e.resume.push("Chemins boueux : armées −20 %, poudre mouillée".into());
                e.epidemie = 1.2;
            }
            "orage" => {
                e.cultures = 0.85;
                e.incendie = 2.2;
                e.mouvement = 0.85;
                e.tir = 0.8;
                e.resume.push("Grêle : récoltes −15 %, foudre et incendies".into());
            }
            "brouillard" => {
                e.mouvement = 0.9;
                e.resume.push("Brouillard : embuscades plus faciles".into());
            }
            "neige" => {
                e.mouvement = 0.5;
                e.peche = 0.7;
                e.bonheur = -2.0;
                e.resume.push("Neige : armées ralenties de moitié".into());
            }
            "gel" => {
                e.mouvement = 0.85;
                e.peche = 0.5;
                e.bonheur = -5.0;
                e.epidemie = 1.4;
                if s == 1 {
                    e.cultures = 0.5;
                    e.resume.push("Gelées tardives : récoltes −50 %".into());
                }
                e.resume.push("Grand froid : bois de chauffage et maladies".into());
            }
            "canicule" => {
                e.cultures = 0.7;
                e.bonheur = -4.0;
                e.incendie = 2.5;
                e.epidemie = 1.3;
                e.resume.push("Canicule : récoltes −30 %, incendies".into());
            }
            "tempete" => {
                e.mouvement = 0.6;
                e.peche = 0.25;
                e.cultures = 0.85;
                e.incendie = 1.3;
                e.resume.push("Tempête : pêche et navigation presque impossibles".into());
            }
            _ => {}
        }
        if self.secheresse > 1.0 {
            e.cultures *= 0.65;
            e.resume.push("Sécheresse : récoltes −35 %".into());
        }
        if self.temperature < -8.0 {
            e.cultures *= 0.3;
            e.bonheur -= 8.0;
            e.resume.push("Froid extrême : semis détruits".into());
        }
        e
    }

    /// Prévisions pour le mois `tour` (d'après le climat, pas le tirage) : genres probables.
    pub fn previsions(tour: u32, prec: &Meteo) -> Vec<(String, u32)> {
        let m = mois(tour);
        let t = NORMALES[m] + prec.anomalie * 0.6;
        let hu = HUMIDE[m];
        let s = saison(m);
        let mut v: Vec<(String, f64)> = Vec::new();
        if t < 3.5 {
            v.push(("neige".into(), hu));
            v.push(("gel".into(), 1.0 - hu));
        } else {
            let orage = if s == 2 { 0.45 } else { 0.0 };
            v.push(("pluie".into(), hu * (1.0 - orage)));
            if orage > 0.0 {
                v.push(("orage".into(), hu * orage));
            }
            let sec = 1.0 - hu;
            if t > 23.0 {
                v.push(("canicule".into(), sec * 0.4));
                v.push(("soleil".into(), sec * 0.6));
            } else {
                let br = if s == 1 || s == 3 { 0.18 } else { 0.0 };
                v.push(("brouillard".into(), sec * br));
                v.push(("soleil".into(), sec * (1.0 - br) * 0.55));
                v.push(("nuages".into(), sec * (1.0 - br) * 0.45));
            }
        }
        v.sort_by(|a, b| b.1.total_cmp(&a.1));
        v.into_iter().take(3).map(|(g, p)| (g, (p * 100.0).round() as u32)).collect()
    }
}

/// Multiplicateur saisonnier d'une culture (clé `saison` des règles) pour le mois `m`.
pub fn saisonnier(culture: &str, m: usize) -> f64 {
    const CEREALE: [f64; 12] = [0.0, 0.0, 0.2, 0.5, 0.8, 1.4, 2.0, 2.0, 1.2, 0.4, 0.0, 0.0];
    const TUBERCULE: [f64; 12] = [0.0, 0.0, 0.2, 0.6, 0.9, 1.2, 1.5, 1.6, 1.6, 1.0, 0.2, 0.0];
    const VENDANGE: [f64; 12] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 3.0, 2.5, 0.0, 0.0];
    match culture {
        "cereale" => CEREALE[m],
        "tubercule" => TUBERCULE[m],
        "vendange" => VENDANGE[m],
        _ => 1.0,
    }
}

#[cfg(test)]
mod essais {
    use super::*;

    #[test]
    fn saisons_et_annees_celebres() {
        assert_eq!(date_texte(0), "Janvier 1700");
        assert_eq!(saison(mois(6)), 2);
        let mut h = Hasard::new(3);
        let mut m = Meteo::default();
        let mut neiges = 0;
        let mut canicules = 0;
        for tour in 0..(12 * 40) {
            m = Meteo::tirer(&m, tour, &mut h);
            if m.genre == "neige" || m.genre == "gel" {
                neiges += 1;
                assert!(saison(mois(tour)) != 2, "pas de neige en été ({})", date_texte(tour));
            }
            if m.genre == "canicule" {
                canicules += 1;
            }
            if tour == 9 * 12 {
                assert!(m.temperature < -5.0, "Grand Hiver 1709 : {}", m.temperature);
                assert!(m.historique.is_some());
            }
        }
        assert!(neiges > 10, "{neiges} mois de neige ou de gel en 40 ans");
        assert!(canicules >= 1);
        let e = Meteo { genre: "neige".into(), ..Meteo::default() }.effets(0);
        assert_eq!(e.mouvement, 0.5);
        assert_eq!(saisonnier("cereale", 0), 0.0);
        assert!(!Meteo::previsions(6, &Meteo::default()).is_empty());
    }
}
