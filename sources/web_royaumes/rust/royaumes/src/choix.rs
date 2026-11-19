//! Les événements à choix : tous les 3 ou 4 mois, une affaire se présente à chaque royaume
//! (un inventeur, des émeutiers, une disette…) avec deux ou trois options aux effets concrets.
//! Le joueur choisit (commande `choisir`) ; l'ordinateur décide seul.

use crate::meteo;
use crate::carte::Terrain;
use crate::partie::{Choix, Partie, Rapport};
use crate::regles::{regles, DefChoix, Panier};

impl Partie {
    fn situation(&self, id: i32, si: &str) -> bool {
        let r = &self.royaumes[id as usize];
        match si {
            "" => true,
            "vivres_bas" => regles().vivres.iter().map(|v| r.stock.get(v).copied().unwrap_or(0.0)).sum::<f64>() < r.pop as f64 * 0.6,
            "guerre" if id == 0 => self.royaumes.iter().any(|x| !x.joueur && x.vivant && x.statut == "guerre"),
            "guerre" => !crate::ia::diplomatie::ennemis(self, id).is_empty(),
            "paix" if id == 0 => self.royaumes.iter().any(|x| !x.joueur && x.vivant && x.statut != "guerre"),
            "paix" => crate::ia::diplomatie::ennemis(self, id).is_empty(),
            "port" => self.a_batiment(id, "port"),
            "eglise" => self.a_batiment(id, "eglise") || self.a_batiment(id, "cathedrale"),
            _ => false,
        }
    }

    /// Les événements possibles pour `id` ce mois-ci (époque, saison, situation).
    fn choix_possibles(&self, id: i32) -> Vec<&'static DefChoix> {
        let ep = &regles().epoque(self.annee()).cle;
        let saison = meteo::saison(meteo::mois(self.tour));
        regles()
            .evenements_choix
            .iter()
            .filter(|d| (d.epoques.is_empty() || d.epoques.contains(ep)) && (d.saisons.is_empty() || d.saisons.contains(&saison)))
            .filter(|d| self.situation(id, &d.si) && d.cle != self.royaumes[id as usize].dernier_choix)
            .collect()
    }

    /// Tous les 3 ou 4 mois, chaque royaume vit un événement à choix.
    pub fn choix_mois(&mut self, rapport: &mut Rapport) {
        for k in 0..self.royaumes.len() {
            if !self.royaumes[k].vivant {
                continue;
            }
            let prochain = self.tour + self.hasard.entre(3, 4) as u32;
            if self.royaumes[k].prochain_choix == 0 {
                self.royaumes[k].prochain_choix = prochain;
                continue;
            }
            if self.tour < self.royaumes[k].prochain_choix {
                continue;
            }
            self.royaumes[k].prochain_choix = prochain;
            let possibles = self.choix_possibles(k as i32);
            let Some(&d) = self.hasard.choix(&possibles) else { continue };
            self.royaumes[k].dernier_choix = d.cle.clone();
            if k == 0 {
                self.proposer_choix(d, rapport);
            } else {
                self.choix_ia(k, d);
            }
        }
    }

    fn proposer_choix(&mut self, d: &DefChoix, rapport: &mut Rapport) {
        let rivaux: Vec<usize> = self.royaumes.iter().filter(|r| !r.joueur && r.vivant && (d.si != "paix" || r.statut != "guerre")).map(|r| r.id).collect();
        let royaume = if d.royaume { self.hasard.choix(&rivaux).copied() } else { None };
        let nom_r = royaume.map(|k| self.royaumes[k].nom.clone()).unwrap_or_else(|| "un royaume voisin".into());
        let ville = self.capitale(0).map(|i| self.villes[i].nom.clone()).unwrap_or_default();
        let remplir = |t: &str| t.replace("{royaume}", &nom_r).replace("{ville}", &ville);
        let id = self.id();
        let c = Choix { id, cle: d.cle.clone(), titre: d.titre.clone(), icone: d.icone.clone(), texte: remplir(&d.texte), royaume, options: d.options.iter().map(|o| remplir(&o.texte)).collect() };
        self.evt(rapport, format!("{} {} : une décision vous attend", c.icone, c.titre), "info", None);
        self.choix.push(c);
    }

    /// Le joueur répond à l'événement `id` par l'option `option` ; rend le récit de ce qui arrive.
    pub fn choisir(&mut self, id: u32, option: usize) -> Result<String, String> {
        let i = self.choix.iter().position(|c| c.id == id).ok_or("événement inconnu")?;
        let d = regles().evenements_choix.iter().find(|x| x.cle == self.choix[i].cle).ok_or("événement inconnu")?;
        let o = d.options.get(option).ok_or("option inconnue")?;
        if !self.peut_payer(0, &o.cout) {
            return Err("Vous n'avez pas de quoi payer".into());
        }
        let c = self.choix.remove(i);
        self.payer(0, &o.cout);
        let echec = o.risque > 0.0 && self.hasard.p(o.risque);
        let mut recit = self.appliquer_effets(0, if echec { &o.echec } else { &o.effets }, c.royaume);
        if !echec {
            let cap = self.capitale(0).map(|ci| self.villes[ci].case);
            for (u, &n) in &o.unites {
                if let Some(cap) = cap {
                    (0..n).for_each(|_| self.recruter_dans(0, u, cap));
                    recit.push(format!("+{n} {}", regles().unite(u).map(|d| d.nom.as_str()).unwrap_or(u)));
                }
            }
        }
        let mut texte = format!("{} {} : {}", c.icone, c.titre, c.options[option]);
        if echec && !o.echec_texte.is_empty() {
            texte += &format!(". {}", o.echec_texte);
        }
        if !recit.is_empty() {
            texte += &format!(" ({})", recit.join(", "));
        }
        self.noter(format!("{} · {}", meteo::date_texte(self.tour), texte));
        Ok(texte)
    }

    /// L'ordinateur choisit au hasard parmi ce qu'il peut payer dans ses réserves.
    fn choix_ia(&mut self, k: usize, d: &DefChoix) {
        let id = k as i32;
        let possibles: Vec<usize> = (0..d.options.len()).filter(|&i| self.peut_payer(id, &d.options[i].cout)).collect();
        let Some(&i) = self.hasard.choix(&possibles) else { return };
        let o = &d.options[i];
        self.payer(id, &o.cout);
        let echec = o.risque > 0.0 && self.hasard.p(o.risque);
        self.appliquer_effets(k as i32, if echec { &o.echec } else { &o.effets }, None);
        if !echec {
            if let Some(ci) = self.capitale(k as i32) {
                let cap = self.villes[ci].case;
                for (u, &n) in &o.unites {
                    (0..n).for_each(|_| self.recruter_dans(k as i32, u, cap));
                }
            }
        }
    }

    /// Applique des effets à `id` ; rend leur description. La relation est celle du joueur avec les rivaux :
    /// un rival n'en tient pas compte.
    fn appliquer_effets(&mut self, id: i32, effets: &Panier, royaume: Option<usize>) -> Vec<String> {
        let rg = regles();
        let mut recit = Vec::new();
        let s = self.stats(id);
        let k = id as usize;
        for (cle, &v) in effets {
            let signe = if v >= 0.0 { "+" } else { "" };
            match cle.as_str() {
                "tech" => {
                    let an = self.annee();
                    let cand: Vec<String> = rg.techs.iter().filter(|t| t.annee <= an && !self.a_tech(id, &t.cle)).map(|t| t.cle.clone()).collect();
                    match self.hasard.choix(&cand).cloned() {
                        Some(t) => {
                            let r = &mut self.royaumes[id as usize];
                            r.techs.push(t.clone());
                            if r.recherche.as_deref() == Some(t.as_str()) {
                                r.recherche = None;
                            }
                            recit.push(format!("💡 {}", rg.tech(&t).map(|x| x.nom.as_str()).unwrap_or(&t)));
                        }
                        None => {
                            self.royaumes[id as usize].savoir += 100.0;
                            recit.push("+100 savoir".into());
                        }
                    }
                }
                "gisement" => {
                    if let Some((_, g)) = self.decouvrir_gisement(id) {
                        recit.push(format!("⛏️ gisement {g}"));
                    }
                }
                "bonheur" => {
                    let j = &mut self.royaumes[k];
                    j.bonheur = (j.bonheur + v).clamp(0.0, 100.0);
                    recit.push(format!("{signe}{v} bonheur"));
                }
                "savoir" => {
                    let j = &mut self.royaumes[k];
                    j.savoir = (j.savoir + v).max(0.0);
                    recit.push(format!("{signe}{v} savoir"));
                }
                "pop" => {
                    let j = &mut self.royaumes[k];
                    j.pop = (j.pop + v as i64).max(1);
                    recit.push(format!("{signe}{v} habitants", v = v as i64 * crate::regles::HOMMES));
                }
                "relation" if id != 0 => {}
                "relation" => {
                    for r in self.royaumes.iter_mut().filter(|r| !r.joueur && r.vivant && royaume.map_or(true, |k| k == r.id)) {
                        r.relation = (r.relation + v).clamp(-100.0, 100.0);
                    }
                    let qui = royaume.map(|k| self.royaumes[k].nom.clone()).unwrap_or_else(|| "les rivaux".into());
                    recit.push(format!("relation {qui} {signe}{v}"));
                }
                r => {
                    let cap = self.capacite(&s, r);
                    let x = self.royaumes[k].stock.entry(r.into()).or_insert(0.0);
                    *x = (*x + v).clamp(0.0, cap.max(*x));
                    recit.push(format!("{signe}{v} {}", rg.res_icone(r)));
                }
            }
        }
        recit
    }

    /// Un gisement apparaît sur une colline ou une montagne du territoire de `id` ; rend la case et sa nature.
    pub fn decouvrir_gisement(&mut self, id: i32) -> Option<(usize, &'static str)> {
        let cand: Vec<usize> = (0..self.carte.cases.len())
            .filter(|&c| self.carte.cases[c].proprio == id && matches!(self.carte.cases[c].t, Terrain::Colline | Terrain::Montagne) && self.carte.cases[c].gisement.is_none())
            .collect();
        let &c = self.hasard.choix(&cand)?;
        let g = if self.hasard.p(0.5) { "fer" } else if self.hasard.p(0.5) { "charbon" } else { "or" };
        self.carte.cases[c].gisement = Some(g.into());
        self.version_carte += 1;
        Some((c, match g { "fer" => "de fer", "or" => "d'or", _ => "de charbon" }))
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;

    #[test]
    fn evenements_a_choix() {
        let mut p = Partie::nouvelle(Options { graine: 21, ..Options::default() });
        let mut vus = 0;
        for _ in 0..24 {
            p.fin_du_mois();
            if let Some(c) = p.choix.first().cloned() {
                vus += 1;
                assert!(c.options.len() >= 2 && !c.texte.contains('{'), "{}", c.texte);
                assert!(p.choisir(c.id, 99).is_err(), "option inconnue");
                assert!(p.choisir(c.id + 1000, 0).is_err(), "événement inconnu");
                // la dernière option est toujours possible
                assert!(p.choisir(c.id, c.options.len() - 1).is_ok());
                assert!(p.choix.is_empty());
            }
        }
        assert!((5..=9).contains(&vus), "un événement tous les 3 ou 4 mois : {vus} en deux ans");
        // les rivaux ont eu les leurs (choisis tout seuls)
        assert!(p.royaumes.iter().skip(1).all(|r| !r.dernier_choix.is_empty()));
    }

    #[test]
    fn effets_d_un_choix() {
        let mut p = Partie::nouvelle(Options { graine: 21, ..Options::default() });
        p.choix.push(Choix { id: 77, cle: "mecene".into(), options: vec!["a".into(), "b".into(), "c".into()], ..Default::default() });
        let or = p.joueur().stock["or"];
        let msg = p.choisir(77, 0).unwrap();
        assert_eq!(p.joueur().stock["or"], or + 250.0, "{msg}");
        // un coût qu'on ne peut payer est refusé et l'événement reste
        p.choix.push(Choix { id: 78, cle: "ingenieur".into(), options: vec!["a".into(), "b".into(), "c".into()], ..Default::default() });
        assert!(p.choisir(78, 0).is_err());
        assert_eq!(p.choix.len(), 1);
        // des unités
        p.choix[0] = Choix { id: 79, cle: "levee".into(), options: vec!["a".into(), "b".into()], ..Default::default() };
        let soldats = p.stats(0).soldats;
        p.choisir(79, 0).unwrap();
        assert_eq!(p.stats(0).soldats, soldats + 6);
    }
}
