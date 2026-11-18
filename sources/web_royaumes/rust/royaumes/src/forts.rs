//! Les retranchements et les forts : hors des villes, une armée se protège soit en se retranchant
//! (gratuit, un mois de travaux, perdu dès qu'elle bouge), soit en bâtissant un fort permanent qu'on
//! améliore : Redoute, Fort bastionné, Fort à batteries. Un fort vide se prend en y entrant ; tenu,
//! il s'assiège comme une petite ville, sans faubourgs (`sieges`).

use crate::partie::{Armee, Fort, Partie, Rapport};
use crate::regles::{regles, DefFort};

/// « de Bellerive », « du fort de Bellerive » : le complément d'un nom de lieu.
pub fn de_lieu(nom: &str) -> String {
    match nom.strip_prefix("le ") {
        Some(r) => format!("du {r}"),
        None => format!("de {nom}"),
    }
}

/// La majuscule en début de phrase (« le fort de… » → « Le fort de… »).
pub fn majuscule(s: &str) -> String {
    let mut c = s.chars();
    c.next().map_or(String::new(), |p| p.to_uppercase().chain(c).collect())
}

impl Partie {
    pub fn fort(&self, id: u32) -> Option<usize> {
        self.forts.iter().position(|f| f.id == id)
    }

    pub fn fort_a(&self, case: usize) -> Option<usize> {
        self.forts.iter().position(|f| f.case == case)
    }

    /// Une armée de `proprio` se tient sur la case.
    pub fn garnison(&self, proprio: i32, case: usize) -> bool {
        self.armees.iter().any(|a| a.proprio == proprio && a.case == case)
    }

    /// Le nom d'un fort dans les récits : sa direction depuis la ville la plus proche.
    pub fn nom_fort(&self, case: usize) -> String {
        // la direction depuis la ville la plus proche distingue deux forts voisins (« le fort au nord-est de Lumen »)
        self.villes.iter().min_by_key(|v| self.carte.dist(v.case, case)).map_or_else(
            || "le fort".into(),
            |v| {
                let ((x0, z0), (x1, z1)) = (self.carte.cases[v.case].pos(), self.carte.cases[case].pos());
                let a = (x1 - x0).atan2(z0 - z1).to_degrees().rem_euclid(360.0); // 0° : nord (z décroissant), 90° : est
                let dir = ["au nord", "au nord-est", "à l'est", "au sud-est", "au sud", "au sud-ouest", "à l'ouest", "au nord-ouest"][((a + 22.5) / 45.0) as usize % 8];
                format!("le fort {dir} de {}", v.nom)
            },
        )
    }

    /// Ce qui protège une armée attaquée sur sa case : son retranchement achevé, ou le fort de son royaume
    /// (le meilleur des deux, sans cumul).
    pub fn protection(&self, a: &Armee) -> f64 {
        let r = if a.retranche == Some(0) { regles().retranchement.defense } else { 1.0 };
        let f = self.fort_a(a.case).filter(|&fi| self.forts[fi].proprio == a.proprio).and_then(|fi| regles().fort(self.forts[fi].niveau)).map_or(1.0, |d| d.defense);
        r.max(f)
    }

    /// L'armée reste à son poste (ordinateur) : retranchée, sur un de ses forts ou sur le chantier prévu.
    pub fn tient_un_poste(&self, a: &Armee) -> bool {
        a.retranche.is_some()
            || self.fort_a(a.case).is_some_and(|fi| self.forts[fi].proprio == a.proprio)
            || (a.proprio > 0 && self.royaumes.get(a.proprio as usize).is_some_and(|r| r.projet_fort == Some(a.case)))
    }

    /// L'ordre « Se retrancher » : à terre, à l'arrêt, hors des villes (sauf devant la ville qu'elle assiège).
    pub fn peut_retrancher(&self, a: &Armee) -> Result<(), String> {
        if !a.chemin.is_empty() {
            return Err("L'armée est en marche : faites halte d'abord".into());
        }
        if !self.praticable(a.case) {
            return Err("L'armée doit être à terre".into());
        }
        if self.ville_a(a.case).is_some() && !self.assiege(a.proprio, a.case) {
            return Err("En ville, ce sont les murs qui protègent : on ne s'y retranche pas".into());
        }
        match a.retranche {
            Some(0) => Err("L'armée est déjà retranchée".into()),
            Some(_) => Err("L'armée creuse déjà ses retranchements".into()),
            None => Ok(()),
        }
    }

    /// La case peut-elle porter un fort de `id` ? Terre ferme hors des villes et de leur enceinte, case libre,
    /// sur ses terres, des terres neutres ou ennemies, assez loin de ses autres forts.
    pub fn site_de_fort(&self, id: i32, case: usize) -> Result<(), String> {
        let k = &self.carte.cases[case];
        if !self.praticable(case) {
            return Err("Un fort se bâtit sur la terre ferme (ni eau ni montagne)".into());
        }
        if self.ville_a(case).is_some() {
            return Err("Pas de fort dans une ville : fortifiez plutôt la ville".into());
        }
        if (0..self.villes.len()).any(|vi| self.enceinte(vi).contains(&case)) {
            return Err("Pas de fort dans l'enceinte d'une ville".into());
        }
        if self.fort_a(case).is_some() {
            return Err("Il y a déjà un fort ici".into());
        }
        if k.bat.is_some() {
            return Err("Un bâtiment occupe déjà la case".into());
        }
        if k.proprio >= 0 && k.proprio != id && !self.est_ennemi(id, k.proprio) {
            return Err("Pas de fort sur les terres d'un royaume en paix avec vous".into());
        }
        let dmin = regles().forts.distance;
        if let Some(f) = self.forts.iter().find(|f| f.proprio == id && self.carte.dist(f.case, case) < dmin) {
            return Err(format!("Trop près {} ({dmin} cases au moins entre deux de vos forts)", de_lieu(&self.nom_fort(f.case))));
        }
        Ok(())
    }

    /// Le rang de la capitale et la technologie qu'exige un niveau de fort.
    fn verrou_fort(&self, id: i32, d: &DefFort) -> Result<(), String> {
        if self.niveau_capitale(id) < d.rang {
            return Err(format!("Il faut une capitale au rang {}", regles().nom_niveau(d.rang)));
        }
        if let Some(t) = &d.tech {
            if !self.a_tech(id, t) {
                return Err(format!("Il faut la technologie « {} »", regles().tech(t).map_or(t.as_str(), |x| x.nom.as_str())));
            }
        }
        Ok(())
    }

    /// L'armée peut-elle bâtir une redoute là où elle se tient ? (le paiement est vérifié par l'appelant)
    pub fn peut_construire_fort(&self, a: &Armee) -> Result<&'static DefFort, String> {
        if !a.chemin.is_empty() {
            return Err("L'armée est en marche : faites halte d'abord".into());
        }
        self.site_de_fort(a.proprio, a.case)?;
        let d = regles().fort(1).ok_or("Aucun fort dans les règles")?;
        self.verrou_fort(a.proprio, d)?;
        Ok(d)
    }

    /// Le niveau suivant du fort `fi`, s'il est permis (travaux, siège, garnison, rang, technologie) ;
    /// le paiement est vérifié par l'appelant.
    pub fn peut_ameliorer_fort(&self, fi: usize) -> Result<&'static DefFort, String> {
        let f = &self.forts[fi];
        if f.travaux > 0 {
            return Err(format!("Le fort est déjà en travaux ({} mois)", f.travaux));
        }
        let d = regles().fort(f.niveau + 1).ok_or("Fort au niveau maximal")?;
        if self.siege_de(f.id).is_some() {
            return Err("Le fort est assiégé".into());
        }
        if !self.garnison(f.proprio, f.case) {
            return Err("Il faut une de vos armées sur la case du fort".into());
        }
        self.verrou_fort(f.proprio, d)?;
        Ok(d)
    }

    /// Ouvre le chantier d'une redoute (déjà payée) ; rend l'identifiant du fort.
    pub fn poser_fort(&mut self, proprio: i32, case: usize, duree: u32) -> u32 {
        let id = self.id();
        self.forts.push(Fort { id, proprio, case, niveau: 0, travaux: duree.max(1) });
        id
    }

    /// Or par mois pour les forts de `id`.
    pub fn entretien_forts(&self, id: i32) -> f64 {
        self.forts.iter().filter(|f| f.proprio == id).filter_map(|f| regles().fort(f.niveau)).map(|d| d.entretien).sum()
    }

    /// Un fort change de mains et garde son niveau ; un chantier pris est rasé.
    pub fn prendre_fort(&mut self, fi: usize, nouveau: i32, rapport: &mut Rapport) {
        let f = self.forts[fi].clone();
        let nom = self.nom_fort(f.case);
        let (qui, ancien) = (self.nom_royaume(nouveau), self.nom_royaume(f.proprio));
        self.sieges.retain(|s| !(s.fort && s.ville == f.id));
        let Some(d) = regles().fort(f.niveau) else {
            self.forts.remove(fi);
            if nouveau == 0 || f.proprio == 0 {
                self.evt(rapport, format!("🔥 {qui} rase le chantier {}", de_lieu(&nom)), if nouveau == 0 { "bon" } else { "guerre" }, Some(f.case));
            }
            return;
        };
        self.forts[fi].proprio = nouveau;
        self.forts[fi].travaux = 0;
        self.recalculer_territoire();
        if nouveau == 0 {
            self.evt(rapport, format!("🚩 Vos troupes prennent {nom} ({}) à {ancien} !", d.nom), "bon", Some(f.case));
        } else if f.proprio == 0 {
            self.evt(rapport, format!("💀 {} ({}) tombe aux mains de {qui} !", majuscule(&nom), d.nom), "guerre", Some(f.case));
        }
    }

    /// Le mois des retranchements et des forts : les travaux n'avancent que si une armée du propriétaire tient
    /// la case (et qu'on ne l'assiège pas). L'entretien est payé dans l'économie (joueur) ou dans `ia`.
    pub fn forts_mois(&mut self, rapport: &mut Rapport) {
        for a in self.armees.iter_mut() {
            if let Some(n) = a.retranche.as_mut() {
                *n = n.saturating_sub(1);
            }
        }
        let mut territoire = false;
        for fi in 0..self.forts.len() {
            let f = &self.forts[fi];
            if f.travaux == 0 || !self.garnison(f.proprio, f.case) || self.siege_de(f.id).is_some() {
                continue;
            }
            let f = &mut self.forts[fi];
            f.travaux -= 1;
            if f.travaux > 0 {
                continue;
            }
            f.niveau += 1;
            let f = f.clone();
            territoire |= f.niveau == 1;
            if let (0, Some(d)) = (f.proprio, regles().fort(f.niveau)) {
                let nom = self.nom_fort(f.case);
                self.evt(rapport, format!("{} {} achevé(e) : {nom} commande les environs", d.icone, d.nom), "bon", Some(f.case));
            }
        }
        if territoire {
            self.recalculer_territoire();
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;
    use crate::commandes::executer;
    use serde_json::{json, Value};
    use std::collections::BTreeMap;

    /// Une partie, et une case libre de son territoire à 2 ou 3 cases de la capitale, où se tient une armée du joueur.
    fn en_campagne() -> (Partie, usize, u32) {
        let mut p = Partie::nouvelle(Options { graine: 31, ..Options::default() });
        let cap = p.villes[0].case;
        let c = p.carte.rayon(cap, 3).into_iter().find(|&c| p.carte.dist(c, cap) >= 2 && p.carte.cases[c].proprio == 0 && p.site_de_fort(0, c).is_ok()).unwrap();
        let id = p.creer_armee(0, c, BTreeMap::from([("mousquetaire".to_string(), 10)]));
        (p, c, id)
    }

    fn ordre(p: &mut Partie, c: Value) -> Result<Value, String> {
        executer(p, &c)
    }

    fn stock(p: &mut Partie, n: f64) {
        for r in ["bois", "planches", "pierre", "outils", "or"] {
            p.royaumes[0].stock.insert(r.into(), n);
        }
    }

    #[test]
    fn retranchement_refus_travaux_bonus_et_perte() {
        let (mut p, c, id) = en_campagne();
        let cap = p.villes[0].case;
        let garnison = p.armees.iter().find(|a| a.proprio == 0 && a.case == cap).unwrap().id;
        assert_eq!(ordre(&mut p, json!({"action": "retrancher", "armee": 999_999})), Err("armée inconnue".into()));
        assert_eq!(ordre(&mut p, json!({"action": "retrancher", "armee": garnison})), Err("En ville, ce sont les murs qui protègent : on ne s'y retranche pas".into()));
        let i = p.armee(id).unwrap();
        p.armees[i].chemin = vec![cap];
        assert_eq!(ordre(&mut p, json!({"action": "retrancher", "armee": id})), Err("L'armée est en marche : faites halte d'abord".into()));
        p.armees[i].chemin.clear();
        assert!(ordre(&mut p, json!({"action": "retrancher", "armee": id})).is_ok());
        assert_eq!(ordre(&mut p, json!({"action": "retrancher", "armee": id})), Err("L'armée creuse déjà ses retranchements".into()));
        let vue = |p: &Partie| crate::vue::etat(p)["armees"].as_array().unwrap().iter().find(|a| a["id"] == id).unwrap()["retranche"].clone();
        assert_eq!(vue(&p), "en_cours");
        assert_eq!(p.protection(&p.armees[i]), 1.0, "pas encore retranchée");
        p.fin_du_mois();
        let i = p.armee(id).unwrap();
        assert_eq!(p.armees[i].retranche, Some(0));
        assert_eq!(vue(&p), "pret");
        assert_eq!(ordre(&mut p, json!({"action": "retrancher", "armee": id})), Err("L'armée est déjà retranchée".into()));
        assert_eq!(p.protection(&p.armees[i]), regles().retranchement.defense);
        // en combat, à tirage égal : l'armée retranchée tient toujours quand elle tient sans retranchement,
        // et pour certaines forces de l'assaillant, seul le retranchement la sauve
        p.royaumes[1].statut = "guerre".into();
        let pres = p.carte.voisins(c).into_iter().find(|&v| p.praticable(v) && p.ville_a(v).is_none()).unwrap();
        let tient = |n: u32, retranche: Option<u32>| {
            let mut q = p.clone();
            let i = q.armee(id).unwrap();
            q.armees[i].retranche = retranche;
            let e = q.creer_armee(1, pres, BTreeMap::from([("mousquetaire".to_string(), n)]));
            let j = q.armee(e).unwrap();
            q.armees[j].chemin = vec![c];
            q.fin_du_mois();
            q.armee(id).is_some()
        };
        let mut sauvee = false;
        for n in 4..=30 {
            let (avec, sans) = (tient(n, Some(0)), tient(n, None));
            assert!(avec || !sans, "{n} assaillants");
            sauvee |= avec && !sans;
        }
        assert!(sauvee, "le retranchement change l'issue d'une bataille");
        // le retranchement se perd dès que l'armée bouge
        let v = p.carte.voisins(c).into_iter().find(|&v| p.praticable(v) && p.ville_a(v).is_none()).unwrap();
        assert!(ordre(&mut p, json!({"action": "deplacer", "armee": id, "case": v})).is_ok());
        p.royaumes[1].statut = "paix".into();
        p.fin_du_mois();
        let i = p.armee(id).unwrap();
        assert_eq!((p.armees[i].case, p.armees[i].retranche), (v, None));
        assert!(vue(&p).is_null());
    }

    #[test]
    fn fort_refus_et_construction_jusqu_au_niveau_trois() {
        let (mut p, c, id) = en_campagne();
        let cap = p.villes[0].case;
        let i = p.armee(id).unwrap();
        stock(&mut p, 0.0);
        assert_eq!(ordre(&mut p, json!({"action": "construire_fort", "armee": 999_999})), Err("armée inconnue".into()));
        assert_eq!(ordre(&mut p, json!({"action": "construire_fort", "armee": id})), Err("Ressources insuffisantes".into()));
        // les cases interdites
        let essai = |p: &mut Partie, case: usize| {
            let i = p.armee(id).unwrap();
            p.armees[i].case = case;
            let r = ordre(p, json!({"action": "construire_fort", "armee": id}));
            p.armees[i].case = c;
            r
        };
        assert_eq!(essai(&mut p, cap), Err("Pas de fort dans une ville : fortifiez plutôt la ville".into()));
        let eau = (0..p.carte.cases.len()).find(|&x| !p.carte.cases[x].terre()).unwrap();
        assert_eq!(essai(&mut p, eau), Err("Un fort se bâtit sur la terre ferme (ni eau ni montagne)".into()));
        if let Some(mont) = (0..p.carte.cases.len()).find(|&x| p.carte.cases[x].t == crate::carte::Terrain::Montagne) {
            assert_eq!(essai(&mut p, mont), Err("Un fort se bâtit sur la terre ferme (ni eau ni montagne)".into()));
        }
        p.villes[0].fortif = 3;
        let dedans = p.enceinte(0).into_iter().find(|&x| x != cap && p.carte.cases[x].bat.is_none()).unwrap();
        assert_eq!(essai(&mut p, dedans), Err("Pas de fort dans l'enceinte d'une ville".into()));
        p.villes[0].fortif = 0;
        let bat = p.batiments.iter().find(|b| b.proprio == 0 && b.cle != "hotel").unwrap().case;
        assert_eq!(essai(&mut p, bat), Err("Un bâtiment occupe déjà la case".into()));
        let rival = p.villes.iter().find(|v| v.proprio == 1).unwrap().case;
        let chez_lui = p.carte.voisins(rival).into_iter().find(|&x| p.praticable(x) && p.carte.cases[x].proprio == 1 && p.carte.cases[x].bat.is_none()).unwrap();
        assert_eq!(essai(&mut p, chez_lui), Err("Pas de fort sur les terres d'un royaume en paix avec vous".into()));
        p.armees[i].chemin = vec![cap];
        assert_eq!(ordre(&mut p, json!({"action": "construire_fort", "armee": id})), Err("L'armée est en marche : faites halte d'abord".into()));
        p.armees[i].chemin.clear();
        // la redoute : payée, 2 mois de travaux
        stock(&mut p, 5000.0);
        let r = ordre(&mut p, json!({"action": "construire_fort", "armee": id})).unwrap();
        let fid = r["fort"].as_u64().unwrap() as u32;
        assert_eq!(p.royaumes[0].stock["bois"], 5000.0 - 40.0);
        let fi = p.fort(fid).unwrap();
        assert_eq!((p.forts[fi].niveau, p.forts[fi].travaux), (0, 2));
        assert_eq!(ordre(&mut p, json!({"action": "construire_fort", "armee": id})), Err("Il y a déjà un fort ici".into()));
        assert!(p.peut_construire("cabane", c, 0).is_err(), "le fort occupe la case");
        // un second fort trop près
        assert!(p.carte.voisins(c).into_iter().any(|x| p.site_de_fort(0, x).is_err_and(|e| e.starts_with("Trop près du fort "))));
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Le fort est déjà en travaux (2 mois)".into()));
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": 999_999})), Err("fort inconnu".into()));
        p.fin_du_mois();
        p.fin_du_mois();
        let fi = p.fort(fid).unwrap();
        assert_eq!((p.forts[fi].niveau, p.forts[fi].travaux), (1, 0));
        assert_eq!(p.carte.cases[c].proprio, 0, "le fort tient sa case");
        assert!(p.entretien_forts(0) > 0.0);
        let e = crate::vue::etat(&p);
        let f = e["forts"].as_array().unwrap().iter().find(|f| f["id"] == fid).unwrap().clone();
        assert_eq!((f["niveau"].as_u64(), f["nom"].as_str(), f["garnison"].as_bool()), (Some(1), Some("Redoute"), Some(true)));
        assert!(f["travaux"].is_null() && f["assiege"] == false);
        assert_eq!(f["suivant"]["nom"], "Fort bastionné");
        // la protection du fort, meilleure que le retranchement, ne s'y ajoute pas
        let i = p.armee(id).unwrap();
        p.armees[i].retranche = Some(0);
        assert_eq!(p.protection(&p.armees[i]), 1.3);
        // Fort bastionné : capitale au rang Village et technologie Vauban
        p.villes[0].niveau = 1;
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Il faut une capitale au rang Village".into()));
        assert_eq!(crate::vue::etat(&p)["forts"][0]["suivant"]["verrou"], "Il faut une capitale au rang Village");
        p.villes[0].niveau = 3;
        p.royaumes[0].techs.retain(|t| t != "vauban" && t != "gribeauval");
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Il faut la technologie « Fortifications Vauban »".into()));
        p.royaumes[0].techs.push("vauban".into());
        stock(&mut p, 0.0);
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Ressources insuffisantes".into()));
        stock(&mut p, 5000.0);
        // sans armée sur la case, pas de travaux
        p.armees[i].case = cap;
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Il faut une de vos armées sur la case du fort".into()));
        p.armees[i].case = c;
        assert!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})).is_ok());
        for _ in 0..4 {
            p.fin_du_mois();
        }
        let fi = p.fort(fid).unwrap();
        assert_eq!(p.forts[fi].niveau, 2);
        // Fort à batteries : technologie Gribeauval, 6 mois
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Il faut la technologie « Système Gribeauval »".into()));
        p.royaumes[0].techs.push("gribeauval".into());
        stock(&mut p, 5000.0);
        assert!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})).is_ok());
        assert_eq!(p.forts[fi].travaux, 6);
        p.forts[fi].travaux = 1;
        p.fin_du_mois();
        assert_eq!(p.forts[p.fort(fid).unwrap()].niveau, 3);
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": fid})), Err("Fort au niveau maximal".into()));
        assert!(crate::vue::etat(&p)["forts"][0]["suivant"].is_null());
        // un fort d'un autre royaume
        let autre = p.poser_fort(1, (0..p.carte.cases.len()).find(|&x| p.site_de_fort(1, x).is_ok() && p.carte.dist(x, c) > 5).unwrap(), 2);
        assert_eq!(ordre(&mut p, json!({"action": "ameliorer_fort", "fort": autre})), Err("Ce fort ne vous appartient pas".into()));
    }

    #[test]
    fn travaux_suspendus_sans_armee_et_vision() {
        let (mut p, c, id) = en_campagne();
        let cap = p.villes[0].case;
        stock(&mut p, 5000.0);
        let fid = ordre(&mut p, json!({"action": "construire_fort", "armee": id})).unwrap()["fort"].as_u64().unwrap() as u32;
        // l'armée s'en va : les travaux s'arrêtent
        let i = p.armee(id).unwrap();
        p.armees[i].case = p.carte.voisins(c).into_iter().find(|&v| p.praticable(v) && p.ville_a(v).is_none()).unwrap();
        p.fin_du_mois();
        p.fin_du_mois();
        let fi = p.fort(fid).unwrap();
        assert_eq!((p.forts[fi].niveau, p.forts[fi].travaux), (0, 2), "travaux suspendus");
        assert_eq!(crate::vue::etat(&p)["forts"][0]["suspendu"], true);
        let i = p.armee(id).unwrap();
        p.armees[i].case = c;
        p.fin_du_mois();
        p.fin_du_mois();
        let fi = p.fort(fid).unwrap();
        assert_eq!(p.forts[fi].niveau, 1, "l'armée revenue, la redoute s'achève");
        // la vue du fort, même sans armée : rayon d'une armée + 1, puis + 3 au niveau 3
        let i = p.armee(id).unwrap();
        p.armees[i].case = cap;
        let r = regles().vision.armee;
        let bord = |p: &Partie, d: i32| p.carte.rayon(c, d).into_iter().find(|&x| p.carte.dist(x, c) == d && p.carte.dist(x, cap) > regles().vision.capitale && p.carte.cases[x].proprio != 0);
        if let Some(x) = bord(&p, r + 1) {
            assert_eq!(p.vision(0)[x], 1);
        }
        p.forts[fi].niveau = 3;
        let x = bord(&p, r + 3).expect("une case au bord de la vue");
        assert_eq!(p.vision(0)[x], 1);
        p.forts[fi].niveau = 1;
        assert_eq!(p.vision(0)[x], 0);
    }

    #[test]
    fn fort_vide_pris_fort_tenu_assiege() {
        let (mut p, c, id) = en_campagne();
        let cap = p.villes[0].case;
        p.royaumes[1].statut = "guerre".into();
        let fid = p.poser_fort(0, c, 1);
        let fi = p.fort(fid).unwrap();
        (p.forts[fi].niveau, p.forts[fi].travaux) = (2, 0);
        p.recalculer_territoire();
        let pres = p.carte.voisins(c).into_iter().find(|&v| p.praticable(v) && p.ville_a(v).is_none() && p.fort_a(v).is_none()).unwrap();
        // tenu : l'ennemi l'assiège (il ne livre pas bataille)
        let mut q = p.clone();
        let e = q.creer_armee(1, pres, BTreeMap::from([("grenadier".to_string(), 30), ("canon".to_string(), 4)]));
        let j = q.armee(e).unwrap();
        q.armees[j].chemin = vec![c];
        let r = q.fin_du_mois();
        let si = q.siege_de(fid).expect("le fort est assiégé");
        assert!(q.sieges[si].fort && q.sieges[si].murs < q.sieges[si].murs_max);
        assert!(r.evenements.iter().any(|e| e.texte.contains("Siège du fort ")), "{:?}", r.evenements);
        assert_eq!(q.forts[q.fort(fid).unwrap()].proprio, 0);
        let e = crate::vue::etat(&q);
        assert!(e["forts"][0]["assiege"] == true && e["sieges"][0]["fort"] == true && e["sieges"][0]["faubourgs"].as_array().unwrap().is_empty());
        assert_eq!(executer(&mut q, &json!({"action": "ameliorer_fort", "fort": fid})), Err("Le fort est assiégé".into()));
        for _ in 0..12 {
            q.fin_du_mois();
            if q.fort(fid).is_some_and(|fi| q.forts[fi].proprio == 1) {
                break;
            }
        }
        let fi = q.fort(fid).expect("le fort pris garde son niveau");
        assert_eq!((q.forts[fi].proprio, q.forts[fi].niveau), (1, 2), "assaut ou reddition");
        assert!(q.siege_de(fid).is_none() && q.armee(id).is_none());
        assert_eq!(q.carte.cases[c].proprio, 1, "le fort pris tient sa case pour son nouveau maître");
        // vide : l'ennemi qui entre le prend
        let i = p.armee(id).unwrap();
        p.armees[i].case = cap;
        let e = p.creer_armee(1, pres, BTreeMap::from([("milice".to_string(), 3)]));
        let j = p.armee(e).unwrap();
        p.armees[j].chemin = vec![c];
        let r = p.fin_du_mois();
        let fi = p.fort(fid).unwrap();
        assert_eq!((p.forts[fi].proprio, p.forts[fi].niveau), (1, 2));
        assert!(p.sieges.is_empty());
        assert!(r.evenements.iter().any(|e| e.texte.contains("tombe aux mains")));
        // une redoute en chantier prise est rasée
        let c2 = p.carte.rayon(cap, 4).into_iter().find(|&x| p.site_de_fort(0, x).is_ok() && p.carte.dist(x, c) >= 3 && p.carte.voisins(x).iter().any(|&v| p.praticable(v) && p.ville_a(v).is_none())).unwrap();
        let f2 = p.poser_fort(0, c2, 2);
        let pres2 = p.carte.voisins(c2).into_iter().find(|&v| p.praticable(v) && p.ville_a(v).is_none()).unwrap();
        let e = p.creer_armee(1, pres2, BTreeMap::from([("milice".to_string(), 3)]));
        let j = p.armee(e).unwrap();
        p.armees[j].chemin = vec![c2];
        p.fin_du_mois();
        assert!(p.fort(f2).is_none(), "chantier rasé");
    }

    #[test]
    fn ancienne_sauvegarde_sans_forts_ni_retranchements() {
        let (mut p, _, _) = en_campagne();
        let (vi, id) = (0, p.armees[0].id);
        p.royaumes[1].statut = "guerre".into();
        p.villes[vi].fortif = 2;
        let sid = p.creer_armee(1, p.villes[vi].case, BTreeMap::from([("grenadier".to_string(), 10)]));
        p.commencer_siege(sid, vi, &mut Rapport::default());
        // une sauvegarde de la version 2 : ni forts, ni retranchements, ni sièges de fort
        let mut v = serde_json::to_value(&p).unwrap();
        v["version"] = json!(2);
        let o = v.as_object_mut().unwrap();
        o.remove("forts");
        for a in o["armees"].as_array_mut().unwrap() {
            a.as_object_mut().unwrap().remove("retranche");
        }
        for r in o["royaumes"].as_array_mut().unwrap() {
            r.as_object_mut().unwrap().remove("projet_fort");
        }
        o["sieges"][0].as_object_mut().unwrap().remove("fort");
        let mut q = Partie::relire(&v.to_string()).unwrap();
        assert_eq!(q.version, crate::partie::VERSION_SAUVEGARDE);
        assert!(q.forts.is_empty() && q.armees.iter().all(|a| a.retranche.is_none()) && !q.sieges[0].fort);
        assert_eq!(q.place(&q.sieges[0]).map(|x| x.0), Some(0), "le siège en cours vise toujours la ville");
        assert!(crate::vue::etat(&q)["forts"].as_array().unwrap().is_empty());
        q.fin_du_mois();
        assert!(ordre(&mut q, json!({"action": "retrancher", "armee": id})).is_err(), "la garnison est en ville");
    }
}
