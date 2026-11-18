//! Les sièges : une ville ennemie fortifiée ne tombe pas d'un coup. Les murs s'usent sous le canon
//! et la sape, les vivres s'épuisent, la garnison fond ; la ville se rend, à moins qu'un assaut
//! ne l'emporte ou qu'une armée de secours ne chasse les assiégeants. Hors de l'enceinte, les
//! faubourgs ne produisent plus et l'assiégeant les pille.
//! Les fortifications sont une amélioration de la ville : Palissade, Murailles, Bastions, Citadelle.
//! Un fort tenu (`forts`) s'assiège de même, avec ses murs et sans faubourgs.

use crate::forts::{de_lieu, majuscule};
use crate::meteo::Effets;
use crate::partie::{Batiment, Combat, Partie, Rapport, Siege};
use crate::regles::{regles, DefFortif, Panier};

impl Partie {
    /// Les murs d'une ville : sa fortification, plus les tours de guet proches (leur défense) ; ×Vauban.
    /// Zéro : la ville n'est pas fortifiée, elle se prend d'une bataille.
    pub fn murs_ville(&self, vi: usize) -> f64 {
        let v = &self.villes[vi];
        let mut m = regles().fortif(v.fortif).map_or(0.0, |f| f.murs);
        for b in self.batiments.iter().filter(|b| b.proprio == v.proprio && b.fini()) {
            let d = regles().bat(&b.cle).unwrap();
            if d.defense > 0.0 && self.carte.dist(b.case, v.case) <= 4 {
                m += d.defense;
            }
        }
        if self.a_tech(v.proprio, "vauban") {
            m *= regles().siege.vauban_defense;
        }
        m.round()
    }

    /// Les cases intra-muros : la mairie seule (Palissade, Murailles), puis aussi les cases voisines
    /// qui appartiennent à la ville (Bastions, Citadelle). Vide pour une ville ouverte.
    pub fn enceinte(&self, vi: usize) -> Vec<usize> {
        let v = &self.villes[vi];
        let Some(f) = regles().fortif(v.fortif) else { return Vec::new() };
        self.carte.rayon(v.case, f.enceinte).into_iter().filter(|&c| c == v.case || (self.carte.cases[c].terre() && self.carte.cases[c].proprio == v.proprio)).collect()
    }

    /// Un bâtiment d'une ville assiégée, hors de l'enceinte : un faubourg, qui ne produit plus.
    pub fn faubourg_assiege(&self, b: &Batiment) -> bool {
        let Some(vid) = b.ville else { return false };
        if b.cle == "hotel" || self.siege_de(vid).is_none() {
            return false;
        }
        let Some(vi) = self.villes.iter().position(|v| v.id == vid && v.proprio == b.proprio) else { return false };
        !self.enceinte(vi).contains(&b.case)
    }

    /// Le niveau de fortification suivant de la ville `vi`, s'il est permis (travaux, rang, technologie) ;
    /// le paiement est vérifié par l'appelant.
    pub fn peut_fortifier(&self, vi: usize) -> Result<&'static DefFortif, String> {
        let v = &self.villes[vi];
        if v.travaux_fortif > 0 {
            return Err(format!("{} est déjà en travaux ({} mois)", v.nom, v.travaux_fortif));
        }
        let f = regles().fortif(v.fortif + 1).ok_or("Fortifications au niveau maximal")?;
        if v.niveau < f.rang {
            return Err(format!("Il faut une ville au rang {}", regles().nom_niveau(f.rang)));
        }
        if let Some(t) = &f.tech {
            if !self.a_tech(v.proprio, t) {
                return Err(format!("Il faut la technologie « {} »", regles().tech(t).map_or(t.as_str(), |x| x.nom.as_str())));
            }
        }
        Ok(f)
    }

    /// Chaque mois de siège, l'assiégeant pille un bâtiment des faubourgs : il emporte de l'or et une part
    /// de ce qu'il a coûté, et le bâtiment reste arrêté quelques mois.
    fn piller_faubourg(&mut self, vid: u32, rapport: &mut Rapport) {
        let (Some(si), Some(vi)) = (self.siege_de(vid), self.villes.iter().position(|v| v.id == vid)) else { return };
        let (pr, qui, tour) = (self.sieges[si].assiegeant, self.villes[vi].proprio, self.tour);
        let cibles: Vec<usize> = (0..self.batiments.len()).filter(|&i| {
            let b = &self.batiments[i];
            b.proprio == qui && b.fini() && b.arret <= tour && self.faubourg_assiege(b)
        }).collect();
        let Some(&i) = self.hasard.choix(&cibles) else { return };
        let rs = &regles().siege;
        let d = regles().bat(&self.batiments[i].cle).unwrap();
        self.batiments[i].arret = tour + rs.pillage_mois;
        let case = self.batiments[i].case;
        let mut butin: Panier = d.cout.iter().map(|(r, q)| (r.clone(), (q * rs.pillage_part).floor())).filter(|x| x.1 > 0.0).collect();
        *butin.entry("or".into()).or_insert(0.0) += rs.pillage_or;
        if pr == 0 {
            let s = self.stats(0);
            for (r, q) in &butin {
                let cap = self.capacite(&s, r);
                let x = self.royaumes[0].stock.entry(r.clone()).or_insert(0.0);
                *x = (*x + q).min(cap.max(*x));
            }
        } else if let Some(r) = self.royaumes.get_mut(pr as usize) {
            r.or += regles().valeur(&butin);
        }
        self.sieges[si].pillage = Some((case, d.cle.clone()));
        if pr == 0 || qui == 0 {
            let gain = butin.iter().map(|(r, q)| format!("{q} {}", regles().res_icone(r))).collect::<Vec<_>>().join(", ");
            let qui_pille = if pr == 0 { "Vos troupes pillent".to_string() } else { format!("{} pille", self.nom_royaume(pr)) };
            let texte = format!("🔥 {qui_pille} {} {} dans les faubourgs de {} (butin : {gain})", d.icone, d.nom, self.villes[vi].nom);
            self.evt(rapport, texte, if pr == 0 { "or" } else { "guerre" }, Some(case));
        }
    }

    pub fn siege_de(&self, ville: u32) -> Option<usize> {
        self.sieges.iter().position(|s| s.ville == ville)
    }

    /// La place assiégée : son propriétaire et son nom (une ville, ou « le fort de… »).
    pub fn place(&self, s: &Siege) -> Option<(i32, String)> {
        if s.fort {
            self.fort(s.ville).map(|fi| (self.forts[fi].proprio, self.nom_fort(s.case)))
        } else {
            self.villes.iter().find(|v| v.id == s.ville).map(|v| (v.proprio, v.nom.clone()))
        }
    }

    /// La place tombe aux mains des assiégeants.
    fn prendre_place(&mut self, s: &Siege, rapport: &mut Rapport) {
        if s.fort {
            if let Some(fi) = self.fort(s.ville) {
                self.prendre_fort(fi, s.assiegeant, rapport);
            }
        } else if let Some(vi) = self.villes.iter().position(|v| v.id == s.ville) {
            self.prise(vi, s.assiegeant, rapport);
        }
    }

    /// L'armée `id` arrive devant le fort tenu `fi` : le siège commence (ou elle s'y joint).
    pub fn commencer_siege_fort(&mut self, id: u32, fi: usize, rapport: &mut Rapport) {
        let Some(i) = self.armee(id) else { return };
        self.armees[i].chemin.clear();
        let pr = self.armees[i].proprio;
        let f = self.forts[fi].clone();
        if self.siege_de(f.id).is_some() {
            return;
        }
        let murs = regles().fort(f.niveau).map_or(0.0, |d| d.murs);
        let vivres = regles().siege.vivres_base + f.niveau as f64;
        self.sieges.push(Siege { ville: f.id, case: f.case, assiegeant: pr, murs, murs_max: murs, vivres, fort: true, ..Default::default() });
        if pr == 0 || f.proprio == 0 {
            let (qui, nom) = (self.nom_royaume(pr), self.nom_fort(f.case));
            self.evt(rapport, format!("🏰 Siège {} : {qui} investit la place (murs {murs}, {vivres} mois de vivres)", de_lieu(&nom)), if pr == 0 { "info" } else { "guerre" }, Some(f.case));
        }
    }

    /// Une armée qui assiège : elle ne rentre pas à la maison.
    pub fn assiege(&self, proprio: i32, case: usize) -> bool {
        self.sieges.iter().any(|s| s.assiegeant == proprio && s.case == case)
    }

    /// L'armée `id` arrive devant la ville fortifiée `vi` : le siège commence (ou elle s'y joint).
    pub fn commencer_siege(&mut self, id: u32, vi: usize, rapport: &mut Rapport) {
        let Some(i) = self.armee(id) else { return };
        self.armees[i].chemin.clear();
        let pr = self.armees[i].proprio;
        let v = self.villes[vi].clone();
        if self.siege_de(v.id).is_some() {
            return;
        }
        let rs = &regles().siege;
        let murs = self.murs_ville(vi);
        let greniers = self.batiments.iter().filter(|b| b.proprio == v.proprio && b.cle == "grenier" && b.fini() && b.ville == Some(v.id)).count() as f64;
        let vivres = rs.vivres_base + rs.vivres_grenier * greniers + v.niveau as f64;
        self.sieges.push(Siege { ville: v.id, case: v.case, assiegeant: pr, murs, murs_max: murs, vivres, ..Default::default() });
        if pr == 0 || v.proprio == 0 {
            let qui = self.nom_royaume(pr);
            self.evt(rapport, format!("🏰 Siège de {} : {qui} investit la place (murs {murs}, {vivres} mois de vivres)", v.nom), if pr == 0 { "info" } else { "guerre" }, Some(v.case));
        }
    }

    /// Forces d'un assaut : les assiégeants contre la garnison et la ville, selon l'état des murs et la faim.
    pub fn forces_assaut(&self, s: &Siege, tir: f64) -> (f64, f64) {
        let Some((pr, _)) = self.place(s) else { return (1.0, 1.0) };
        let at: f64 = self.armees.iter().filter(|a| a.proprio == s.assiegeant && a.case == s.case).map(|a| self.attaque(a, true, tir)).sum();
        // la garnison d'un fort se bat derrière ses murs (sa défense ×celle du fort)
        let garnison: f64 = self.armees.iter().filter(|a| a.proprio == pr && a.case == s.case).map(|a| self.defense(a) * self.protection(a)).sum();
        let place = if s.fort {
            self.fort(s.ville).and_then(|fi| regles().fort(self.forts[fi].niveau)).map_or(0.0, |d| d.murs)
        } else {
            self.villes.iter().position(|v| v.id == s.ville).map_or(0.0, |vi| self.defense_ville(vi))
        };
        let murs = if s.murs_max > 0.0 { s.murs / s.murs_max } else { 0.0 };
        let faim = (1.0 - s.faim as f64 * regles().siege.faim).max(0.3);
        let de = (garnison + place) * (0.4 + 0.6 * murs) * faim;
        (at.max(1.0), de.max(1.0))
    }

    /// Le mois des sièges : assauts ordonnés, usure des murs, vivres, garnison ; reddition.
    pub fn sieges_mois(&mut self, eff: &Effets, rapport: &mut Rapport) {
        let rs = &regles().siege;
        let villes: Vec<u32> = self.sieges.iter().map(|s| s.ville).collect();
        for vid in villes {
            let Some(si) = self.siege_de(vid) else { continue };
            let s = self.sieges[si].clone();
            let Some((proprio, nom)) = self.place(&s) else {
                self.sieges.remove(si);
                continue;
            };
            let implique = proprio == 0 || s.assiegeant == 0;
            let assiegeants: Vec<u32> = self.armees.iter().filter(|a| a.proprio == s.assiegeant && a.case == s.case).map(|a| a.id).collect();
            if assiegeants.is_empty() || !self.est_ennemi(s.assiegeant, proprio) {
                self.sieges.remove(si);
                if implique {
                    self.evt(rapport, format!("🏳️ Le siège {} est levé.", de_lieu(&nom)), if proprio == 0 { "bon" } else { "info" }, Some(s.case));
                }
                continue;
            }
            if s.assaut {
                self.sieges[si].assaut = false;
                if self.assaut(vid, eff, rapport) {
                    continue;
                }
            }
            let Some(si) = self.siege_de(vid) else { continue };
            // des assiégeants bien trop faibles (un éclaireur, une troupe décimée) sont dispersés par une sortie
            let (at, de) = self.forces_assaut(&self.sieges[si], eff.tir);
            // des assiégeants retranchés résistent mieux à une sortie
            let tenue = assiegeants.iter().filter_map(|&a| self.armee(a)).map(|i| self.protection(&self.armees[i])).fold(1.0, f64::max);
            if de > 3.0 * at * tenue {
                for a in &assiegeants {
                    self.detruire_armee(*a);
                }
                self.sieges.remove(si);
                if implique {
                    self.evt(rapport, format!("🛡️ La garnison {} fait une sortie et disperse les assiégeants !", de_lieu(&nom)), if proprio == 0 { "bon" } else { "guerre" }, Some(s.case));
                }
                continue;
            }
            // les murs s'usent : sape et tranchées (Vauban), artillerie (Gribeauval)
            let artillerie: f64 = self.armees.iter().filter(|a| a.proprio == s.assiegeant && a.case == s.case).flat_map(|a| a.unites.iter()).filter_map(|(u, &n)| regles().unite(u).map(|d| d.siege * n as f64)).sum();
            let mut usure = rs.tranchees * if self.a_tech(s.assiegeant, "vauban") { rs.vauban_attaque } else { 1.0 }
                + artillerie * rs.artillerie * if self.a_tech(s.assiegeant, "gribeauval") { rs.gribeauval } else { 1.0 };
            if self.a_tech(proprio, "vauban") {
                usure /= rs.vauban_defense;
            }
            let s = &mut self.sieges[si];
            s.murs = (s.murs - usure).max(0.0).round();
            s.mois += 1;
            s.vivres -= 1.0;
            if s.vivres < 0.0 {
                s.vivres = 0.0;
                s.faim += 1;
            }
            let s = s.clone();
            // la garnison fond (et plus vite affamée), les assiégeants souffrent du camp
            let garnison: Vec<u32> = self.armees.iter().filter(|a| a.proprio == proprio && a.case == s.case).map(|a| a.id).collect();
            for g in &garnison {
                self.pertes(*g, rs.usure_garnison + if s.faim > 0 { rs.faim } else { 0.0 });
            }
            for a in &assiegeants {
                self.pertes(*a, rs.usure_assiegeant);
            }
            if s.faim > 0 && proprio == 0 && !s.fort {
                let j = &mut self.royaumes[0];
                j.bonheur = (j.bonheur - 3.0).max(0.0);
                j.pop = (j.pop - (j.pop as f64 * 0.02).ceil() as i64).max(1);
            }
            let reste_garnison: u32 = self.armees.iter().filter(|a| a.proprio == proprio && a.case == s.case).map(|a| a.effectif()).sum();
            // un fort sans garnison ne tient pas
            if s.faim >= rs.reddition_faim || (s.murs <= 0.0 && (s.faim > 0 || reste_garnison == 0)) || (s.fort && reste_garnison == 0) {
                for g in garnison {
                    self.detruire_armee(g);
                }
                if implique {
                    self.evt(rapport, format!("🏳️ {} capitule après {} mois de siège !", majuscule(&nom), s.mois), if s.assiegeant == 0 { "bon" } else { "guerre" }, Some(s.case));
                }
                if self.armees.iter().any(|a| a.proprio == s.assiegeant && a.case == s.case) {
                    self.prendre_place(&s, rapport);
                }
                continue;
            }
            self.piller_faubourg(vid, rapport);
            if implique {
                let pct = if s.murs_max > 0.0 { (s.murs / s.murs_max * 100.0).round() } else { 0.0 };
                let qui = if s.fort { "la garnison" } else { "la ville" };
                let faim = if s.faim > 0 { format!(", {qui} a faim depuis {} mois", s.faim) } else { format!(", {} mois de vivres", s.vivres) };
                self.evt(rapport, format!("🏰 Siège {} ({} mois) : murs à {pct} %{faim}", de_lieu(&nom), s.mois), "info", Some(s.case));
            }
        }
    }

    /// L'assaut sur la place assiégée `vid` (ville ou fort) ; rend vrai si elle est prise.
    fn assaut(&mut self, vid: u32, eff: &Effets, rapport: &mut Rapport) -> bool {
        let Some(si) = self.siege_de(vid) else { return false };
        let s = self.sieges[si].clone();
        let Some((proprio, nom)) = self.place(&s) else { return false };
        let (at, de) = self.forces_assaut(&s, eff.tir);
        let r = at / (at + de) * (0.85 + self.hasard.f() * 0.3);
        let assiegeants: Vec<u32> = self.armees.iter().filter(|a| a.proprio == s.assiegeant && a.case == s.case).map(|a| a.id).collect();
        let garnison: Vec<u32> = self.armees.iter().filter(|a| a.proprio == proprio && a.case == s.case).map(|a| a.id).collect();
        let (na, nd) = (self.nom_royaume(s.assiegeant), self.nom_royaume(proprio));
        let implique = proprio == 0 || s.assiegeant == 0;
        // l'assaut fait sortir les assiégeants de leurs retranchements
        for a in self.armees.iter_mut().filter(|a| assiegeants.contains(&a.id)) {
            a.retranche = None;
        }
        if r > 0.5 {
            for a in &assiegeants {
                self.pertes(*a, (de / at * 0.6).clamp(0.1, 0.85));
            }
            for g in garnison {
                self.detruire_armee(g);
            }
            let texte = format!("⚔️ Assaut victorieux de {na} sur {nom}");
            rapport.combats.push(Combat { case: s.case, attaquant: s.assiegeant, defenseur: proprio, vainqueur: s.assiegeant, texte: texte.clone(), etape: 0 });
            if implique {
                self.evt(rapport, texte, if s.assiegeant == 0 { "bon" } else { "guerre" }, Some(s.case));
            }
            if self.armees.iter().any(|a| a.proprio == s.assiegeant && a.case == s.case) {
                self.prendre_place(&s, rapport);
                return true;
            }
            false
        } else {
            for a in &assiegeants {
                self.pertes(*a, (de / at * 0.5).clamp(0.25, 0.9));
            }
            for g in &garnison {
                self.pertes(*g, (at / de * 0.3).clamp(0.05, 0.5));
            }
            let texte = format!("🛡️ {nd} repousse l'assaut de {na} sur {nom}");
            rapport.combats.push(Combat { case: s.case, attaquant: s.assiegeant, defenseur: proprio, vainqueur: proprio, texte: texte.clone(), etape: 0 });
            if implique {
                self.evt(rapport, texte, if proprio == 0 { "bon" } else { "guerre" }, Some(s.case));
            }
            false
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;
    use std::collections::BTreeMap;

    /// Le joueur en guerre contre le royaume 1, une armée sur une case voisine de sa capitale.
    fn devant_la_ville(murs: bool) -> (Partie, usize, u32) {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        p.royaumes[1].statut = "guerre".into();
        let vi = p.villes.iter().position(|v| v.proprio == 1).unwrap();
        let cv = p.villes[vi].case;
        if murs {
            p.villes[vi].fortif = 3;
        }
        let pres = p.carte.voisins(cv).into_iter().find(|&c| p.praticable(c) && p.carte.cases[c].bat.is_none()).unwrap();
        let mut u = BTreeMap::new();
        u.insert("grenadier".to_string(), 30);
        u.insert("canon".to_string(), 4);
        let id = p.creer_armee(0, pres, u);
        let i = p.armee(id).unwrap();
        p.armees[i].chemin = vec![cv];
        (p, vi, id)
    }

    #[test]
    fn ville_fortifiee_assiegee_puis_prise() {
        let (mut p, vi, _) = devant_la_ville(true);
        assert!(p.murs_ville(vi) >= 40.0);
        let vid = p.villes[vi].id;
        let r = p.fin_du_mois();
        assert_eq!(p.villes[vi].proprio, 1, "la ville ne tombe pas d'un coup");
        let s = &p.sieges[p.siege_de(vid).expect("siège")];
        assert!(s.murs < s.murs_max, "les canons ont entamé les murs");
        assert!(r.evenements.iter().any(|e| e.texte.contains("Siège")));
        // assaut : refusé sans siège, ordonné ici
        assert!(crate::commandes::executer(&mut p, &serde_json::json!({"action": "assaut", "ville": 12345})).is_err());
        assert!(crate::commandes::executer(&mut p, &serde_json::json!({"action": "assaut", "ville": vid})).is_ok());
        for _ in 0..12 {
            p.fin_du_mois();
            if p.villes[vi].proprio == 0 {
                break;
            }
        }
        assert_eq!(p.villes[vi].proprio, 0, "assaut ou reddition : la ville est prise");
        assert!(p.siege_de(vid).is_none());
    }

    #[test]
    fn ville_sans_murs_prise_d_un_coup() {
        let (mut p, vi, _) = devant_la_ville(false);
        p.batiments.retain(|b| !(b.proprio == 1 && b.cle == "tour"));
        assert_eq!(p.murs_ville(vi), 0.0);
        p.fin_du_mois();
        assert_eq!(p.villes[vi].proprio, 0);
        assert!(p.sieges.is_empty());
    }

    #[test]
    fn un_eclaireur_ne_prend_pas_une_place_forte() {
        let (mut p, vi, id) = devant_la_ville(true);
        let i = p.armee(id).unwrap();
        p.armees[i].unites = BTreeMap::from([("milice".to_string(), 1)]);
        let r = p.fin_du_mois();
        assert!(p.armee(id).is_none() && p.sieges.is_empty(), "une sortie disperse l'éclaireur");
        assert!(r.evenements.iter().any(|e| e.texte.contains("sortie")));
        assert_eq!(p.villes[vi].proprio, 1);
    }

    #[test]
    fn fortifier_la_ville_et_refus() {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        let ordre = |p: &mut Partie, v: u32| crate::commandes::executer(p, &serde_json::json!({"action": "fortifier", "ville": v}));
        let vid = p.villes[0].id;
        let autre = p.villes.iter().find(|v| v.proprio == 1).unwrap().id;
        assert_eq!(ordre(&mut p, autre), Err("Cette ville ne vous appartient pas".into()));
        assert_eq!(ordre(&mut p, 999_999), Err("ville inconnue".into()));
        let stock = |p: &mut Partie, n: f64| {
            for r in ["bois", "planches", "pierre", "outils", "or"] {
                p.royaumes[0].stock.insert(r.into(), n);
            }
        };
        stock(&mut p, 0.0);
        let e = crate::vue::etat(&p);
        assert_eq!((e["villes"][0]["fortif"].as_u64(), e["villes"][0]["fortif_nom"].as_str()), (Some(0), Some("Ville ouverte")));
        assert_eq!(e["villes"][0]["fortif_suivante"]["nom"], "Palissade");
        assert_eq!(e["villes"][0]["fortif_suivante"]["possible"], false);
        assert_eq!(ordre(&mut p, vid), Err("Ressources insuffisantes".into()));
        stock(&mut p, 5000.0);
        assert!(ordre(&mut p, vid).is_ok());
        assert_eq!(p.villes[0].travaux_fortif, 2);
        assert!(ordre(&mut p, vid).unwrap_err().contains("déjà en travaux"));
        assert_eq!(crate::vue::etat(&p)["villes"][0]["travaux_fortif"], 2);
        p.fin_du_mois();
        assert_eq!(p.villes[0].fortif, 0, "la ville est encore en travaux");
        let r = p.fin_du_mois();
        assert_eq!((p.villes[0].fortif, p.villes[0].travaux_fortif), (1, 0));
        assert!(r.evenements.iter().any(|e| e.texte.contains("Palissade")));
        assert!(p.murs_ville(0) >= 15.0, "la palissade donne des murs");
        // Murailles : rang Village ; Bastions : la technologie Vauban ; Citadelle : rang Ville
        stock(&mut p, 5000.0);
        p.villes[0].niveau = 1;
        assert_eq!(ordre(&mut p, vid), Err("Il faut une ville au rang Village".into()));
        assert_eq!(crate::vue::etat(&p)["villes"][0]["fortif_suivante"]["verrou"], "Il faut une ville au rang Village");
        p.villes[0].niveau = 3;
        assert!(ordre(&mut p, vid).is_ok());
        p.villes[0].travaux_fortif = 0;
        p.villes[0].fortif = 2;
        p.royaumes[0].techs.retain(|t| t != "vauban");
        assert_eq!(ordre(&mut p, vid), Err("Il faut la technologie « Fortifications Vauban »".into()));
        p.royaumes[0].techs.push("vauban".into());
        assert!(ordre(&mut p, vid).is_ok());
        p.villes[0].travaux_fortif = 0;
        p.villes[0].fortif = 3;
        assert_eq!(ordre(&mut p, vid), Err("Il faut une ville au rang Ville".into()));
        p.villes[0].niveau = 4;
        let territoire = |p: &Partie| p.carte.cases.iter().filter(|k| k.proprio == 0).count();
        let avant = territoire(&p);
        assert!(ordre(&mut p, vid).is_ok());
        p.villes[0].travaux_fortif = 1;
        p.fin_du_mois();
        assert_eq!(p.villes[0].fortif, 4);
        assert!(territoire(&p) > avant, "la citadelle étend le territoire");
        assert_eq!(ordre(&mut p, vid), Err("Fortifications au niveau maximal".into()));
        let e = crate::vue::etat(&p);
        assert!(e["villes"][0]["fortif_suivante"].is_null() && e["villes"][0]["fortif_nom"] == "Citadelle");
    }

    #[test]
    fn enceinte_rayon_un_aux_niveaux_trois_et_quatre() {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        let cv = p.villes[0].case;
        assert!(p.enceinte(0).is_empty(), "ville ouverte");
        for n in [1, 2] {
            p.villes[0].fortif = n;
            assert_eq!(p.enceinte(0), vec![cv], "la mairie seule");
        }
        for n in [3, 4] {
            p.villes[0].fortif = n;
            let e = p.enceinte(0);
            assert!(e.len() > 1 && e.contains(&cv));
            assert!(e.iter().all(|&c| p.carte.dist(c, cv) <= 1 && p.carte.cases[c].proprio == 0));
            assert_eq!(crate::vue::etat(&p)["villes"][0]["enceinte"].as_array().unwrap().len(), e.len());
        }
    }

    #[test]
    fn faubourgs_arretes_et_pilles_l_intra_muros_produit() {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        p.royaumes[1].statut = "guerre".into();
        let cv = p.villes[0].case;
        p.villes[0].fortif = 3;
        // une scierie dans l'enceinte, une autre dans les faubourgs
        let dedans = p.enceinte(0).into_iter().find(|&c| p.peut_construire("scierie", c, 0).is_ok()).unwrap();
        let dehors = p.carte.rayon(cv, 3).into_iter().find(|&c| p.carte.dist(c, cv) >= 2 && p.peut_construire("scierie", c, 0).is_ok()).unwrap();
        let (bi, bo) = (p.poser("scierie", dedans, 0, true), p.poser("scierie", dehors, 0, true));
        p.royaumes[0].stock.insert("bois".into(), 300.0);
        // une armée du royaume 1 arrive devant la capitale
        let pres = p.carte.voisins(cv).into_iter().find(|&c| p.praticable(c) && p.carte.cases[c].bat.is_none()).unwrap();
        let id = p.creer_armee(1, pres, BTreeMap::from([("grenadier".to_string(), 30), ("canon".to_string(), 2)]));
        let i = p.armee(id).unwrap();
        p.armees[i].chemin = vec![cv];
        let r = p.fin_du_mois();
        let vid = p.villes[0].id;
        let si = p.siege_de(vid).expect("la capitale fortifiée est assiégée");
        let (case, cle) = p.sieges[si].pillage.clone().expect("un faubourg pillé");
        assert!(!p.enceinte(0).contains(&case));
        assert!(p.batiments.iter().any(|b| b.case == case && b.cle == cle && b.arret > p.tour), "le bâtiment pillé est arrêté");
        assert!(r.evenements.iter().any(|e| e.texte.contains("faubourgs")));
        assert!(p.bat(bi).unwrap().produit.get("planches").copied().unwrap_or(0.0) > 0.0, "l'intra-muros produit : {}", p.bat(bi).unwrap().etat);
        assert!(p.bat(bo).unwrap().produit.is_empty(), "le faubourg ne produit plus : {}", p.bat(bo).unwrap().etat);
        let e = crate::vue::etat(&p);
        let s = &e["sieges"][0];
        assert!(s["faubourgs"].as_array().unwrap().iter().any(|f| f["id"] == bo));
        assert!(!s["faubourgs"].as_array().unwrap().iter().any(|f| f["id"] == bi));
        assert_eq!(s["pillage"]["case"], case);
        // chaque mois un autre pillage, et l'assiégeant s'enrichit
        for b in p.batiments.iter_mut() {
            b.arret = 0;
        }
        let or = p.royaumes[1].or;
        let eff = p.meteo.effets(p.tour);
        p.sieges_mois(&eff, &mut Rapport::default());
        assert!(p.royaumes[1].or > or, "butin");
    }

    #[test]
    fn secours_leve_le_siege() {
        let (mut p, vi, id) = devant_la_ville(true);
        let vid = p.villes[vi].id;
        p.fin_du_mois();
        assert!(p.siege_de(vid).is_some());
        // une forte armée de secours arrive et bat les assiégeants
        let i = p.armee(id).unwrap();
        p.armees[i].unites = BTreeMap::from([("milice".to_string(), 2)]);
        let cv = p.villes[vi].case;
        let pres = p.carte.voisins(cv).into_iter().find(|&c| p.praticable(c)).unwrap();
        let sid = p.creer_armee(1, pres, BTreeMap::from([("grenadier".to_string(), 40)]));
        let j = p.armee(sid).unwrap();
        p.armees[j].chemin = vec![cv];
        p.fin_du_mois();
        assert!(p.armee(id).is_none(), "les assiégeants sont battus");
        assert!(p.siege_de(vid).is_none(), "le siège est levé");
        assert_eq!(p.villes[vi].proprio, 1);
    }
}
