//! La vie des villes : le jour de marché, les écoles (vacances d'été, ateliers, ignorance), le chauffage
//! de l'hiver et l'éclairage public. Chaque royaume, joueur ou rival, les vit dans l'économie du mois (tour.rs).
//! Tous les chiffres sont dans `data/regles.json` (jour_marche, ecoles, chauffage, eclairage).

use crate::meteo;
use crate::partie::Partie;
use crate::regles::regles;

/// Ce que vit une ville ce mois-ci.
#[derive(Clone, Debug, Default)]
pub struct VieVille {
    /// halles du marché et écoles en activité
    pub halles: u32,
    pub ecoles: u32,
    /// c'est jour de marché et il se tient (la ville n'est ni assiégée ni bloquée)
    pub marche: bool,
    /// production des ateliers (artisanat) en plus grâce aux écoles
    pub ateliers: f64,
    /// au Siècle des Lumières : une ville sans école (ignorance), sans éclairage (délinquance)
    pub ignorance: bool,
    pub delinquance: bool,
}

impl Partie {
    /// Le mois en cours est-il jour de marché (janvier, avril, juillet, octobre avec un rythme de 3) ?
    pub fn jour_marche(&self) -> bool {
        meteo::mois(self.tour) as u32 % regles().jour_marche.tous_les.max(1) == 0
    }

    /// L'été : vacances et moissons, les écoles se vident.
    pub fn vacances(&self) -> bool {
        meteo::saison(meteo::mois(self.tour)) == 2
    }

    /// L'époque des Lumières est venue (l'année, pas la technologie) : ignorance et délinquance menacent.
    pub fn siecle_lumieres(&self) -> bool {
        self.annee() >= regles().epoques.iter().find(|e| e.cle == "lumieres").map_or(i32::MAX, |e| e.debut)
    }

    /// Bois de chauffage voulu ce mois-ci par habitant : l'hiver ou par grand froid, ×`grand_froid` sous la neige ou le gel.
    pub fn chauffage_par_habitant(&self) -> f64 {
        let c = &regles().chauffage;
        let grand_froid = matches!(self.meteo.genre.as_str(), "neige" | "gel") || self.meteo.temperature < c.seuil_froid;
        if meteo::saison(meteo::mois(self.tour)) != 0 && !grand_froid {
            return 0.0;
        }
        c.par_habitant * if grand_froid { c.grand_froid } else { 1.0 }
    }

    /// L'éclairage public est-il permis dans la ville `vi` (Encyclopédie ou Siècle des Lumières, rang) ?
    pub fn peut_eclairer(&self, vi: usize) -> Result<(), String> {
        let v = &self.villes[vi];
        let l = &regles().eclairage;
        if !self.a_tech(v.proprio, "lumieres") && !self.siecle_lumieres() {
            return Err("Il faut l'Encyclopédie ou le Siècle des Lumières".into());
        }
        if v.niveau < l.rang {
            return Err(format!("Il faut une ville au rang {}", regles().nom_niveau(l.rang)));
        }
        Ok(())
    }

    pub fn vie_ville(&self, vi: usize) -> VieVille {
        let rg = regles();
        let v = &self.villes[vi];
        let mut x = VieVille::default();
        for b in self.batiments.iter().filter(|b| b.proprio == v.proprio && b.ville == Some(v.id) && self.actif(b)) {
            match b.cle.as_str() {
                "marche" => x.halles += 1,
                "ecole" => x.ecoles += 1,
                _ => {}
            }
        }
        x.marche = x.halles > 0 && self.jour_marche() && self.siege_de(v.id).is_none() && !self.bloquee(Some(v.id));
        x.ateliers = (x.ecoles as f64 * rg.ecoles.ateliers).min(rg.ecoles.ateliers_max);
        let lumieres = self.siecle_lumieres();
        x.ignorance = lumieres && v.niveau >= rg.ecoles.ignorance_rang && x.ecoles == 0;
        x.delinquance = lumieres && v.niveau >= rg.eclairage.delinquance_rang && !v.eclairage;
        x
    }

    /// Le savoir que `id` gagne ce mois-ci : sa population, ses écoles et académies, moins l'ignorance.
    pub fn savoir_mois(&self, id: i32) -> f64 {
        let j = &self.royaumes[id as usize];
        let ignorantes = (0..self.villes.len()).filter(|&vi| self.villes[vi].proprio == id && self.vie_ville(vi).ignorance).count() as f64;
        let gain = (j.pop as f64 * 0.04 + self.stats(id).savoir - ignorantes * regles().ecoles.ignorance_savoir).max(0.0);
        gain * if j.a("lumieres") { 1.25 } else { 1.0 }
    }

    /// Le chauffage de `id` ce mois-ci : il brûle le combustible (le charbon d'abord à l'ère industrielle, le bois en complément).
    /// Rend la ligne de bonheur : `None` hors de l'hiver, le malus sans assez de combustible, le bonus avec une bonne réserve.
    pub fn chauffer(&mut self, id: i32, pop: f64) -> Option<f64> {
        let c = &regles().chauffage;
        let besoin = pop * self.chauffage_par_habitant();
        if besoin <= 0.0 {
            return None;
        }
        let charbon = if regles().epoque(self.annee()).cle == "industrie" { c.charbon } else { 0.0 };
        let st = &mut self.royaumes[id as usize].stock;
        let mut reste = besoin;
        if charbon > 0.0 {
            let x = st.entry("charbon".into()).or_insert(0.0);
            let t = x.min(reste / charbon);
            *x -= t;
            reste -= t * charbon;
        }
        let x = st.entry("bois".into()).or_insert(0.0);
        let t = x.min(reste);
        *x -= t;
        reste -= t;
        if reste > 1e-6 {
            return Some(c.malus);
        }
        let reserve = st["bois"] + st.get("charbon").copied().unwrap_or(0.0) * charbon;
        Some(if reserve >= c.reserve * besoin { c.bonus } else { 0.0 })
    }
}


#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;
    use crate::meteo::Meteo;
    use crate::partie::TOUR_DEPART;

    /// Une partie au mois `mois` de l'année `annee`, au temps doux, sans brigands.
    fn partie(graine: u64, annee: i32, mois: u32) -> Partie {
        let mut p = Partie::nouvelle(Options { graine, brigands: false, ..Options::default() });
        p.tour = (annee - meteo::ANNEE_DEPART) as u32 * 12 + mois;
        p.meteo = Meteo { genre: "nuages".into(), temperature: 12.0, ..Meteo::default() };
        p
    }

    /// Pose (achevé) le bâtiment `cle` dans le territoire de la ville de `id`, rattaché à cette ville.
    fn poser(p: &mut Partie, cle: &str, id: i32) -> u32 {
        let vi = p.capitale(id).unwrap();
        let cap = p.villes[vi].case;
        let c = p.carte.rayon(cap, 4).into_iter().find(|&c| p.carte.cases[c].bat.is_none() && p.carte.cases[c].proprio == id && p.peut_construire("cabane", c, id).is_ok()).expect("une case libre");
        let b = p.poser(cle, c, id, true);
        let vid = p.villes[vi].id;
        let x = p.batiments.iter_mut().find(|x| x.id == b).unwrap();
        x.ville = Some(vid);
        x.ouvriers = regles().bat(cle).unwrap().ouvriers;
        b
    }

    fn detail(p: &Partie, cle: &str) -> Option<f64> {
        p.joueur().detail_bonheur.iter().find(|x| x.0.starts_with(cle)).map(|x| x.1)
    }

    #[test]
    fn jour_de_marche() {
        let mut p = partie(21, 1702, 0);
        assert!(Partie { tour: TOUR_DEPART, ..p.clone() }.jour_marche(), "avril est jour de marché");
        p.villes[0].niveau = 2;
        p.royaumes[0].pop = 30;
        p.royaumes[0].stock.insert("pain".into(), 300.0);
        poser(&mut p, "marche", 0);
        assert!(p.jour_marche() && p.vie_ville(0).marche);
        assert_eq!(crate::vue::etat(&p)["jour_marche"], true);
        assert_eq!(crate::vue::etat(&p)["villes"][0]["jour_marche"], true, "la foule au marché, pour le rendu");
        let r = p.fin_du_mois();
        assert!(r.evenements.iter().any(|e| e.texte.starts_with("🧺 Jour de marché à")), "{:?}", r.evenements);
        assert_eq!(detail(&p, "Jour de marché"), Some(2.0));
        assert!(p.joueur().revenus["marche"] > 0.0);
        // le mois suivant : pas de marché
        assert!(!p.jour_marche() && !p.vie_ville(0).marche);
        p.fin_du_mois();
        assert_eq!(detail(&p, "Jour de marché"), None);
        assert_eq!(p.joueur().revenus["marche"], 0.0);
        // assiégée : pas de marché ; en disette : marché déserté
        p.tour += 1;
        p.sieges.push(crate::partie::Siege { ville: p.villes[0].id, case: p.villes[0].case, assiegeant: 1, ..Default::default() });
        assert!(p.jour_marche() && !p.vie_ville(0).marche);
        p.sieges.clear();
        for r in regles().nourriture.clone() {
            p.royaumes[0].stock.insert(r, 0.0);
        }
        let r = p.fin_du_mois();
        assert!(p.joueur().famine && r.evenements.iter().any(|e| e.texte.starts_with("🧺 Marché déserté")));
        assert_eq!(detail(&p, "Marché déserté"), Some(-2.0));
        assert_eq!(p.joueur().revenus["marche"], 0.0, "pas d'impôts en plus");
        // l'ordinateur vit le même jour de marché : sa halle lui rapporte des impôts en plus
        let mut q = partie(21, 1702, 0);
        poser(&mut q, "marche", 1);
        q.fin_du_mois();
        assert!(q.royaumes[1].revenus["marche"] > 0.0 && q.royaumes[1].detail_bonheur.iter().any(|x| x.0 == "Jour de marché"));
        q.fin_du_mois();
        assert_eq!(q.royaumes[1].revenus["marche"], 0.0);
    }

    #[test]
    fn ecole_et_saisons() {
        let mut p = partie(22, 1702, 3);
        p.villes[0].niveau = 3;
        poser(&mut p, "ecole", 0);
        let savoir = regles().bat("ecole").unwrap().savoir;
        assert_eq!(p.stats(0).savoir, savoir);
        p.tour += 3; // juillet : les vacances
        assert!(p.vacances());
        assert_eq!(p.stats(0).savoir, savoir * regles().ecoles.ete);
        // les ateliers de la ville : +2 % par école, 10 % au plus
        assert!((p.vie_ville(0).ateliers - 0.02).abs() < 1e-9);
        for _ in 0..6 {
            poser(&mut p, "ecole", 0);
        }
        assert!((p.vie_ville(0).ateliers - 0.1).abs() < 1e-9);
        // l'ignorance : un Bourg sans école au Siècle des Lumières
        let mut q = partie(22, 1760, 3);
        q.villes[0].niveau = 3;
        q.royaumes[0].pop = 50;
        assert!(q.vie_ville(0).ignorance);
        let ignorant = q.savoir_mois(0);
        q.fin_du_mois();
        assert_eq!(detail(&q, "Ignorance"), Some(-regles().ecoles.ignorance_bonheur));
        poser(&mut q, "ecole", 0);
        assert!(!q.vie_ville(0).ignorance);
        assert!(q.savoir_mois(0) >= ignorant + regles().ecoles.ignorance_savoir, "l'école chasse l'ignorance");
        q.villes[0].niveau = 2;
        q.batiments.retain(|b| b.cle != "ecole");
        assert!(!q.vie_ville(0).ignorance, "un village n'en souffre pas");
        // l'ordinateur : le savoir de ses écoles (moitié l'été), et l'ignorance lui coûte
        let mut r = partie(22, 1760, 3);
        r.villes[1].niveau = 3;
        r.royaumes[1].pop = 50;
        let ignorante = r.savoir_mois(1);
        poser(&mut r, "ecole", 1);
        let instruite = r.savoir_mois(1);
        assert!(instruite >= ignorante + regles().ecoles.ignorance_savoir, "{ignorante} {instruite}");
        r.tour += 3;
        assert!(r.savoir_mois(1) < instruite, "vacances");
    }

    #[test]
    fn hiver_et_chauffage() {
        let mut p = partie(23, 1703, 0); // janvier
        p.royaumes[0].pop = 40;
        p.royaumes[0].stock.insert("pain".into(), 300.0);
        let besoin = 40.0 * regles().chauffage.par_habitant;
        assert!((p.chauffage_par_habitant() * 40.0 - besoin).abs() < 1e-9);
        // une bonne réserve : les foyers sont chauds
        p.royaumes[0].stock.insert("bois".into(), 100.0);
        let r = p.fin_du_mois();
        assert_eq!(detail(&p, "Chauffage"), Some(regles().chauffage.bonus));
        assert!(!r.evenements.iter().any(|e| e.texte.starts_with("🥶")));
        // la neige fait brûler davantage
        let mut q = partie(23, 1703, 0);
        q.meteo.genre = "neige".into();
        assert!(q.chauffage_par_habitant() > regles().chauffage.par_habitant);
        // le printemps : on ne chauffe plus (sauf grand froid)
        q.tour += 3;
        q.meteo.genre = "nuages".into();
        assert_eq!(q.chauffage_par_habitant(), 0.0);
        // sans bois : le froid et les maladies
        let mut p = partie(23, 1703, 0);
        p.royaumes[0].pop = 40;
        p.royaumes[0].stock.insert("pain".into(), 300.0);
        p.royaumes[0].stock.insert("bois".into(), 0.0);
        let r = p.fin_du_mois();
        assert_eq!(detail(&p, "Chauffage"), Some(regles().chauffage.malus));
        assert!(r.evenements.iter().any(|e| e.texte.starts_with("🥶")), "{:?}", r.evenements);
        assert!(p.joueur().pop < 40);
        // l'ère industrielle : le charbon d'abord
        let mut p = partie(23, 1820, 0);
        p.royaumes[0].stock.insert("bois".into(), 50.0);
        p.royaumes[0].stock.insert("charbon".into(), 50.0);
        assert_eq!(p.chauffer(0, 40.0), Some(regles().chauffage.bonus));
        assert_eq!(p.joueur().stock["bois"], 50.0);
        assert!(p.joueur().stock["charbon"] < 50.0);
        // l'ordinateur brûle son propre bois ; sans bois, son peuple grelotte comme le nôtre
        let mut q = partie(23, 1703, 0);
        q.royaumes[1].stock.insert("bois".into(), 100.0);
        assert_eq!(q.chauffer(1, 40.0), Some(regles().chauffage.bonus));
        assert!(q.royaumes[1].stock["bois"] < 100.0);
        q.royaumes[1].stock.insert("bois".into(), 0.0);
        q.fin_du_mois();
        assert!(q.royaumes[1].detail_bonheur.iter().any(|x| x.0 == "Chauffage" && x.1 == regles().chauffage.malus), "{:?}", q.royaumes[1].detail_bonheur);
    }

    #[test]
    fn eclairage_et_veilleur() {
        let mut p = partie(24, 1745, 3);
        let ordre = |p: &mut Partie, actif: bool| {
            let c = serde_json::json!({"action": "eclairer", "ville": p.villes[0].id, "actif": actif});
            crate::commandes::executer(p, &c)
        };
        assert_eq!(ordre(&mut p, true).unwrap_err(), "Il faut l'Encyclopédie ou le Siècle des Lumières");
        p.royaumes[0].techs.push("lumieres".into());
        assert_eq!(ordre(&mut p, true).unwrap_err(), "Il faut une ville au rang Village");
        assert_eq!(crate::vue::etat(&p)["villes"][0]["eclairage_verrou"], "Il faut une ville au rang Village");
        p.villes[0].niveau = 3;
        assert!(!p.vie_ville(0).delinquance, "pas avant le Siècle des Lumières");
        let rival = p.villes.iter().position(|v| v.proprio == 1).unwrap();
        let c = serde_json::json!({"action": "eclairer", "ville": p.villes[rival].id});
        assert!(crate::commandes::executer(&mut p, &c).unwrap_err().contains("appartient"));
        assert!(ordre(&mut p, true).is_ok() && p.villes[0].eclairage);
        assert_eq!(crate::vue::etat(&p)["villes"][0]["eclairage"], true);
        p.royaumes[0].pop = 30;
        p.royaumes[0].stock.insert("pain".into(), 300.0);
        p.royaumes[0].stock.insert("or".into(), 500.0);
        p.fin_du_mois();
        assert_eq!(detail(&p, "Éclairage public"), Some(regles().eclairage.bonheur));
        assert_eq!(p.joueur().revenus["eclairage"], regles().eclairage.entretien);
        // le veilleur : la moitié des incendies évités (sur de nombreux tirages)
        let cle = "cabane";
        let mut eteints = 0;
        for k in 0..200u64 {
            let mut q = p.clone();
            q.hasard = crate::hasard::Hasard::new(k);
            q.batiments.retain(|b| b.cle == "hotel" || b.proprio != 0);
            let b = poser(&mut q, cle, 0);
            let mut r = crate::partie::Rapport::default();
            q.incendie(b, 0.0, &mut r);
            eteints += r.evenements.iter().any(|e| e.texte.starts_with("🏮")) as u32;
        }
        assert!((60..140).contains(&eteints), "{eteints} incendies éteints sur 200");
        // au Siècle des Lumières, un Bourg sans éclairage : délinquance (−5 % d'impôts)
        ordre(&mut p, false).unwrap();
        p.tour = (1760 - meteo::ANNEE_DEPART) as u32 * 12 + 4;
        assert!(p.vie_ville(0).delinquance);
        p.fin_du_mois();
        assert!(p.joueur().revenus["delinquance"] > 0.0);
        // l'ordinateur allume ses villes quand il le peut, et paie le veilleur dans son entretien
        let mut q = partie(24, 1760, 3);
        q.villes[rival].niveau = 3;
        q.royaumes[1].stock.insert("or".into(), 500.0);
        assert!(q.vie_ville(rival).delinquance);
        crate::ia::economie::eclairage(&mut q, 1);
        assert!(q.villes[rival].eclairage && !q.vie_ville(rival).delinquance, "le rival éclaire sa ville");
        q.fin_du_mois();
        assert_eq!(q.royaumes[1].revenus["eclairage"], regles().eclairage.entretien, "il paie le veilleur");
        q.royaumes[1].stock.insert("or".into(), 10.0);
        crate::ia::economie::eclairage(&mut q, 1);
        assert!(!q.villes[rival].eclairage && q.vie_ville(rival).delinquance, "trop pauvre : la délinquance");
    }
}
