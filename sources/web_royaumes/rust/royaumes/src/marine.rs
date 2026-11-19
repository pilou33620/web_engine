//! La marine : navires construits au port, flottes qui naviguent, armées embarquées sur les flûtes,
//! batailles navales, blocus des ports ennemis et commerce par mer.

use std::collections::BTreeMap;

use crate::meteo::Effets;
use crate::partie::{Batiment, Blocus, Combat, Flotte, Mouvement, Partie, Rapport};
use crate::regles::regles;

impl Partie {
    pub fn flotte(&self, id: u32) -> Option<usize> {
        self.flottes.iter().position(|f| f.id == id)
    }

    /// La case d'eau où mouillent les navires d'un port (la mer de préférence).
    pub fn eau_du_port(&self, case: usize) -> Option<usize> {
        let v = self.carte.voisins(case);
        v.iter().copied().find(|&c| self.carte.cases[c].mer()).or_else(|| v.into_iter().find(|&c| !self.carte.cases[c].terre()))
    }

    /// Un navire sort du chantier du port `pres` : il rejoint la flotte au mouillage, ou en forme une.
    pub fn lancer_navire(&mut self, proprio: i32, unite: &str, pres: usize) {
        let Some(eau) = self.eau_du_port(pres) else { return };
        if let Some(f) = self.flottes.iter_mut().find(|f| f.proprio == proprio && f.case == eau && f.chemin.is_empty() && f.armee.is_none()) {
            *f.navires.entry(unite.into()).or_insert(0) += 1;
        } else {
            let id = self.id();
            self.flottes.push(Flotte { id, proprio, case: eau, navires: BTreeMap::from([(unite.to_string(), 1)]), ..Default::default() });
        }
    }

    /// Attaque (ou défense) d'une flotte : la somme de ses navires.
    pub fn force_navale(&self, f: &Flotte, attaque: bool) -> f64 {
        f.navires.iter().filter_map(|(u, &n)| regles().unite(u).map(|d| if attaque { d.att } else { d.def } * n as f64)).sum()
    }

    pub fn capacite_transport(&self, f: &Flotte) -> u32 {
        f.navires.iter().filter_map(|(u, &n)| regles().unite(u).map(|d| d.transport * n)).sum()
    }

    /// La flotte compte-t-elle un navire de guerre (combat, blocus) ?
    pub fn de_guerre(&self, f: &Flotte) -> bool {
        f.navires.iter().any(|(u, &n)| n > 0 && regles().unite(u).is_some_and(|d| d.guerre()))
    }

    pub fn flutes(&self, f: &Flotte) -> u32 {
        f.navires.iter().filter(|(u, _)| regles().unite(u).is_some_and(|d| d.commerce)).map(|(_, &n)| n).sum()
    }

    pub fn vitesse_flotte(&self, f: &Flotte) -> f64 {
        let v = f.navires.iter().filter(|(_, &n)| n > 0).filter_map(|(u, _)| regles().unite(u)).map(|d| d.vitesse).fold(f64::INFINITY, f64::min);
        if v.is_finite() { v } else { 5.0 }
    }

    /// Plus court chemin sur l'eau (mer, hauts-fonds, et les lacs qui y touchent) ; sans la case de départ.
    pub fn chemin_mer(&self, de: usize, vers: usize) -> Option<Vec<usize>> {
        if vers >= self.carte.cases.len() || self.carte.cases[vers].terre() {
            return None;
        }
        self.a_etoile(de, vers, &|c| !self.carte.cases[c].terre())
    }

    /// Le port de son royaume auprès duquel la flotte est à quai.
    pub fn port_voisin(&self, f: &Flotte) -> Option<&Batiment> {
        self.batiments.iter().find(|b| b.proprio == f.proprio && b.cle == "port" && b.fini() && self.carte.dist(b.case, f.case) <= 1)
    }

    pub fn mois_navigation(&self, f: &Flotte) -> u32 {
        let cout: f64 = f.chemin.iter().map(|&c| self.cout_case(c)).sum();
        (cout / self.vitesse_flotte(f).max(0.5)).ceil().max(1.0) as u32
    }

    pub fn peut_embarquer(&self, fi: usize, ai: usize) -> Result<(), String> {
        let (f, a) = (&self.flottes[fi], &self.armees[ai]);
        if f.proprio != a.proprio {
            return Err("Cette flotte n'est pas à vous".into());
        }
        if f.armee.is_some() {
            return Err("La flotte porte déjà une armée".into());
        }
        let cap = self.capacite_transport(f);
        if cap == 0 {
            return Err("Il faut des navires de transport (flûte marchande, navire à vapeur)".into());
        }
        if a.effectif() > cap {
            return Err(format!("La flotte ne peut porter que {cap} soldats : divisez l'armée", cap = cap as i64 * crate::regles::HOMMES));
        }
        let cote = self.carte.cases[a.case].terre() && self.carte.dist(a.case, f.case) <= 1;
        let au_port = self.ville_a(a.case).is_some_and(|vi| {
            let vid = self.villes[vi].id;
            self.batiments.iter().any(|b| b.cle == "port" && b.proprio == a.proprio && b.fini() && b.ville == Some(vid) && self.carte.dist(b.case, f.case) <= 1)
        });
        if !cote && !au_port {
            return Err("L'armée doit être sur la côte à côté de la flotte, ou dans la ville de son port".into());
        }
        Ok(())
    }

    pub fn embarquer(&mut self, fi: usize, ai: usize) {
        let mut a = self.armees.remove(ai);
        let f = &mut self.flottes[fi];
        a.chemin.clear();
        a.retranche = None;
        a.case = f.case;
        f.armee = Some(a);
        f.commerce = false;
    }

    pub fn peut_debarquer(&self, fi: usize, case: usize) -> Result<(), String> {
        let f = &self.flottes[fi];
        if f.armee.is_none() {
            return Err("La flotte ne porte aucune armée".into());
        }
        if self.carte.dist(f.case, case) != 1 || !self.praticable(case) {
            return Err("Débarquez sur une case de terre voisine de la flotte (pas une montagne)".into());
        }
        if let Some(vi) = self.ville_a(case) {
            let pr = self.villes[vi].proprio;
            if pr != f.proprio && !self.est_ennemi(f.proprio, pr) {
                return Err("On ne débarque pas dans la ville d'un royaume en paix avec vous".into());
            }
        }
        Ok(())
    }

    /// L'armée descend à terre : elle part de la case de la flotte et gagne `case` pendant le mois
    /// (bataille ou siège si l'ennemi l'y attend). Rend son identifiant.
    pub fn debarquer(&mut self, fi: usize, case: usize) -> u32 {
        let f = &mut self.flottes[fi];
        let mut a = f.armee.take().expect("flotte vide");
        a.case = f.case;
        a.chemin = vec![case];
        let id = a.id;
        self.armees.push(a);
        id
    }

    /// Les flottes naviguent ; deux flottes ennemies qui se rencontrent se livrent bataille.
    pub fn navigation(&mut self, eff: &Effets, rapport: &mut Rapport) {
        // la tempête cloue presque les navires au port
        let mer = eff.peche.max(0.4);
        let mut points: BTreeMap<u32, f64> = BTreeMap::new();
        let mut trajets: BTreeMap<u32, (i32, Vec<usize>)> = BTreeMap::new();
        for f in self.flottes.iter().filter(|f| !f.chemin.is_empty()) {
            points.insert(f.id, self.vitesse_flotte(f) * mer);
            trajets.insert(f.id, (f.proprio, vec![f.case]));
        }
        for etape in 0..14 {
            let mut bouge = false;
            let ids: Vec<u32> = self.flottes.iter().map(|f| f.id).collect();
            for id in ids {
                let Some(i) = self.flotte(id) else { continue };
                let pts = points.get(&id).copied().unwrap_or(0.0);
                if self.flottes[i].chemin.is_empty() || pts <= 0.05 {
                    continue;
                }
                let suiv = self.flottes[i].chemin.remove(0);
                points.insert(id, pts - self.cout_case(suiv));
                let f = &mut self.flottes[i];
                f.case = suiv;
                f.commerce = false;
                if let Some(a) = f.armee.as_mut() {
                    a.case = suiv;
                }
                let pr = f.proprio;
                self.decouvrir(pr, suiv, regles().vision.flotte);
                if let Some(t) = trajets.get_mut(&id) {
                    t.1.push(suiv);
                }
                bouge = true;
                if self.flottes.iter().any(|o| o.case == suiv && self.est_ennemi(pr, o.proprio)) {
                    self.bataille_navale(id, rapport, etape + 1);
                }
            }
            if !bouge {
                break;
            }
        }
        for (id, (proprio, trajet)) in trajets {
            if trajet.len() > 1 {
                rapport.mouvements.push(Mouvement { armee: id, proprio, trajet, flotte: true });
            }
        }
    }

    fn bataille_navale(&mut self, id: u32, rapport: &mut Rapport, etape: usize) {
        let i = self.flotte(id).unwrap();
        let (case, pa) = (self.flottes[i].case, self.flottes[i].proprio);
        let pd = self.flottes.iter().find(|o| o.case == case && self.est_ennemi(pa, o.proprio)).unwrap().proprio;
        let defenseurs: Vec<u32> = self.flottes.iter().filter(|o| o.case == case && o.proprio == pd).map(|o| o.id).collect();
        let at = self.force_navale(&self.flottes[i], true).max(1.0);
        let de = defenseurs.iter().filter_map(|d| self.flotte(*d)).map(|j| self.force_navale(&self.flottes[j], false)).sum::<f64>().max(1.0);
        let r = at / (at + de) * (0.85 + self.hasard.f() * 0.3);
        let (vainqueur, gagnants, perdants, pertes) = if r > 0.5 { (pa, vec![id], defenseurs, de / at) } else { (pd, defenseurs, vec![id], at / de) };
        for g in gagnants {
            self.pertes_navires(g, (pertes * 0.4).clamp(0.05, 0.7), rapport);
        }
        for l in perdants {
            self.pertes_navires(l, regles().marine.pertes_vaincu, rapport);
            // sans navire de guerre pour la protéger, la flotte vaincue est coulée avec l'armée à bord
            if let Some(j) = self.flotte(l) {
                if !self.de_guerre(&self.flottes[j]) {
                    self.couler(j, rapport);
                } else {
                    let f = &mut self.flottes[j];
                    f.chemin.clear();
                    let mut perdus = 0i64;
                    if let Some(a) = f.armee.as_mut() {
                        for n in a.unites.values_mut() {
                            let l = (*n as f64 * 0.5).round() as u32;
                            *n -= l.min(*n);
                            perdus += l as i64;
                        }
                        a.unites.retain(|_, n| *n > 0);
                        if a.unites.is_empty() {
                            f.armee = None;
                        }
                    }
                    let proprio = f.proprio;
                    if let Some(r) = self.royaume_mut(proprio) {
                        r.pop = (r.pop - perdus).max(1);
                    }
                }
            }
        }
        let perdant = if vainqueur == pa { pd } else { pa };
        let texte = format!("⚓ Bataille navale : {} défait la flotte de {}", self.nom_royaume(vainqueur), self.nom_royaume(perdant));
        rapport.combats.push(Combat { case, attaquant: pa, defenseur: pd, vainqueur, texte: texte.clone(), etape });
        if pa == 0 || pd == 0 {
            self.evt(rapport, texte, if vainqueur == 0 { "bon" } else { "guerre" }, Some(case));
        }
    }

    /// La flotte perd une part de ses navires ; sans navire, elle sombre.
    pub fn pertes_navires(&mut self, id: u32, frac: f64, rapport: &mut Rapport) {
        let Some(i) = self.flotte(id) else { return };
        let f = &mut self.flottes[i];
        for n in f.navires.values_mut() {
            *n -= ((*n as f64 * frac).round() as u32).min(*n);
        }
        f.navires.retain(|_, n| *n > 0);
        if f.navires.is_empty() {
            self.couler(i, rapport);
        }
    }

    /// La flotte sombre, et l'armée à bord avec elle.
    fn couler(&mut self, i: usize, rapport: &mut Rapport) {
        let f = self.flottes.remove(i);
        let n = f.armee.as_ref().map_or(0, |a| a.effectif());
        if let Some(r) = self.royaume_mut(f.proprio) {
            r.pop = (r.pop - n as i64).max(1);
        }
        if f.proprio == 0 {
            let texte = if n > 0 { format!("🌊 Votre flotte est envoyée par le fond avec {n} soldats à bord !", n = n as i64 * crate::regles::HOMMES) } else { "🌊 Votre flotte est envoyée par le fond !".to_string() };
            self.evt(rapport, texte, "guerre", Some(f.case));
        } else if n > 0 && self.est_ennemi(0, f.proprio) {
            self.evt(rapport, format!("🌊 Un convoi de {} sombre avec {n} soldats à bord", self.nom_royaume(f.proprio), n = n as i64 * crate::regles::HOMMES), "bon", Some(f.case));
        }
    }

    pub fn bloquee(&self, ville: Option<u32>) -> bool {
        ville.is_some_and(|v| self.blocus.iter().any(|b| b.ville == v))
    }

    /// Les blocus du mois : un navire de guerre ennemi mouille à côté d'une ville ou de son port.
    pub fn blocus_mois(&mut self, rapport: &mut Rapport) {
        let mut nouveaux = Vec::new();
        for v in &self.villes {
            let lieux: Vec<usize> = std::iter::once(v.case)
                .chain(self.batiments.iter().filter(|b| b.cle == "port" && b.proprio == v.proprio && b.ville == Some(v.id)).map(|b| b.case))
                .collect();
            if let Some(f) = self.flottes.iter().find(|f| self.est_ennemi(f.proprio, v.proprio) && self.de_guerre(f) && lieux.iter().any(|&c| self.carte.dist(c, f.case) <= 1)) {
                nouveaux.push(Blocus { ville: v.id, case: v.case, par: f.proprio });
            }
        }
        let mut textes = Vec::new();
        for b in &nouveaux {
            let Some(v) = self.villes.iter().find(|v| v.id == b.ville) else { continue };
            if !self.blocus.iter().any(|x| x.ville == b.ville) {
                if v.proprio == 0 {
                    textes.push((format!("⚓ Blocus ! La flotte de {} bloque {} : ni pêche, ni port, ni commerce par mer", self.nom_royaume(b.par), v.nom), "guerre", v.case));
                } else if b.par == 0 {
                    textes.push((format!("⚓ Votre flotte bloque le port de {}", v.nom), "bon", v.case));
                }
            }
        }
        for b in &self.blocus {
            if let Some(v) = self.villes.iter().find(|v| v.id == b.ville) {
                if !nouveaux.iter().any(|x| x.ville == b.ville) && (v.proprio == 0 || b.par == 0) {
                    textes.push((format!("⚓ Le blocus de {} est levé", v.nom), "info", v.case));
                }
            }
        }
        // une ville bloquée perd sa pêche, son port et son commerce par mer (tour.rs, marine.rs) : la même règle pour tous
        self.blocus = nouveaux;
        for (t, g, c) in textes {
            self.evt(rapport, t, g, Some(c));
        }
    }

    /// L'or que rapportent ce mois-ci les flûtes de `id` mises au commerce, à quai dans ses ports :
    /// une base, plus chaque partenaire en paix (route commerciale ou alliance) selon la distance.
    /// Un blocus du port coupe tout.
    pub fn commerce_maritime(&self, id: i32) -> f64 {
        let m = &regles().marine;
        let mut total = 0.0;
        for f in self.flottes.iter().filter(|f| f.proprio == id && f.commerce && f.armee.is_none()) {
            let Some(port) = self.port_voisin(f) else { continue };
            if self.bloquee(port.ville) {
                continue;
            }
            let partenaire = |vers: i32| self.capitale(vers).map_or(0.0, |ci| m.commerce_partenaire + m.commerce_distance * self.carte.dist(port.case, self.villes[ci].case) as f64);
            let mut gain = m.commerce_base;
            if id == 0 {
                for r in self.royaumes.iter().filter(|r| !r.joueur && r.vivant && r.statut != "guerre" && (r.commerce || r.statut == "alliance")) {
                    gain += partenaire(r.id as i32);
                }
            } else if let Some(r) = self.royaumes.get(id as usize) {
                // les rivaux commercent entre eux, et avec le joueur s'ils ont une route ouverte
                gain += m.commerce_partenaire;
                if r.commerce && r.statut != "guerre" {
                    gain += partenaire(0);
                }
            }
            total += gain.min(m.commerce_max) * self.flutes(f) as f64;
        }
        total.round()
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;
    use crate::partie::Armee;

    /// Une partie où le joueur a un port achevé sur la côte la plus proche de sa capitale.
    fn avec_port(graine: u64) -> (Partie, usize) {
        let mut p = Partie::nouvelle(Options { graine, ..Options::default() });
        let cap = p.villes[0].case;
        let mut cotes: Vec<usize> = (0..p.carte.cases.len())
            .filter(|&c| p.praticable(c) && p.carte.cases[c].bat.is_none() && p.carte.voisins(c).iter().any(|&v| p.carte.cases[v].mer()))
            .collect();
        cotes.sort_by_key(|&c| p.carte.dist(c, cap));
        let c = cotes[0];
        p.poser("port", c, 0, true);
        (p, c)
    }

    #[test]
    fn flotte_embarque_et_debarque() {
        let (mut p, port) = avec_port(5);
        p.recruter_dans(0, "flute", port);
        p.recruter_dans(0, "flute", port);
        assert_eq!(p.flottes.len(), 1, "les deux flûtes forment une flotte");
        assert_eq!(p.flottes[0].navires["flute"], 2);
        assert!(!p.carte.cases[p.flottes[0].case].terre());
        assert_eq!(p.capacite_transport(&p.flottes[0]), 30);
        // une armée sur le port, à côté de la flotte
        let ai = p.armees.iter().position(|a| a.proprio == 0).unwrap();
        p.armees[ai].case = port;
        let soldats = p.stats(0).soldats;
        assert!(p.peut_embarquer(0, ai).is_ok());
        p.embarquer(0, ai);
        assert!(p.armees.iter().all(|a| a.proprio != 0));
        assert_eq!(p.stats(0).soldats, soldats, "les soldats à bord comptent toujours");
        // les armées ne marchent plus sur l'eau
        let eau = p.flottes[0].case;
        assert!(!p.praticable(eau));
        let terre = p.carte.voisins(eau).into_iter().find(|&c| p.praticable(c) && p.ville_a(c).is_none()).unwrap();
        assert!(p.peut_debarquer(0, eau).is_err());
        assert!(p.peut_debarquer(0, terre).is_ok());
        let id = p.debarquer(0, terre);
        p.fin_du_mois();
        let a = &p.armees[p.armee(id).unwrap()];
        assert_eq!(a.case, terre, "l'armée a débarqué");
        assert!(p.flottes[0].armee.is_none());
    }

    #[test]
    fn bataille_navale_et_blocus() {
        let (mut p, port) = avec_port(5);
        // un puits : un incendie tiré au sort ne brûle pas le port pendant le test
        let c = (0..p.carte.cases.len()).find(|&c| p.peut_construire("puits", c, 0).is_ok()).unwrap();
        p.poser("puits", c, 0, true);
        p.recruter_dans(0, "flute", port);
        let eau = p.flottes[0].case;
        let mut u = std::collections::BTreeMap::new();
        u.insert("milice".to_string(), 5);
        p.flottes[0].armee = Some(Armee { id: 999, proprio: 0, case: eau, unites: u, ..Default::default() });
        // l'ennemi : deux frégates qui viennent sur la flotte du joueur
        p.royaumes[1].statut = "guerre".into();
        let depart = p.carte.voisins(eau).into_iter().find(|&c| !p.carte.cases[c].terre() && c != eau).unwrap();
        let id = p.id();
        p.flottes.push(Flotte { id, proprio: 1, case: depart, navires: BTreeMap::from([("fregate".to_string(), 2)]), chemin: vec![eau], ..Default::default() });
        let r = p.fin_du_mois();
        assert!(r.combats.iter().any(|c| c.texte.contains("navale")), "{:?}", r.combats);
        assert!(p.flottes.iter().all(|f| f.proprio != 0), "la flûte sans escorte est coulée");
        assert!(r.evenements.iter().any(|e| e.texte.contains("50 soldats à bord")), "les soldats à bord sont perdus");
        // les frégates mouillent à côté du port : blocus
        assert!(p.bloquee(p.batiments.iter().find(|b| b.cle == "port").unwrap().ville), "{:?}", p.blocus);
        assert!(r.evenements.iter().any(|e| e.texte.contains("Blocus")));
        let b = p.batiments.iter().find(|b| b.cle == "port").unwrap();
        assert!(b.produit.is_empty() && b.etat.contains("Blocus"), "{}", b.etat);
    }

    #[test]
    fn commerce_par_mer() {
        let (mut p, port) = avec_port(5);
        p.recruter_dans(0, "flute", port);
        p.recruter_dans(0, "corvette", port);
        assert_eq!(p.commerce_maritime(0), 0.0);
        p.flottes[0].commerce = true;
        let seul = p.commerce_maritime(0);
        assert!(seul > 0.0, "une flûte au port rapporte");
        p.royaumes[1].commerce = true;
        assert!(p.commerce_maritime(0) > seul, "davantage avec un partenaire");
        p.fin_du_mois();
        assert!(p.joueur().revenus["commerce_mer"] > 0.0);
    }
}
