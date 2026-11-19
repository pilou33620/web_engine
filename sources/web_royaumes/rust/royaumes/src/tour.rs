//! La fin du mois : tout ce qui se joue entre deux tours (IA, marches et batailles, chantiers,
//! production selon la saison et le temps, population, recherche, événements, victoire).

use std::collections::BTreeMap;

use crate::carte::{Terrain, BOIS_ARBRE};
use crate::cite::VieVille;
use crate::ia;
use crate::meteo::{self, Effets, Meteo};
use crate::partie::{Combat, Evenement, Fin, Mouvement, Partie, Rapport, BRIGANDS};
use crate::regles::{regles, Panier};

/// L'offre du colporteur : (ressource, quantité, prix en or).
pub const COLPORTEUR: (&str, f64, f64) = ("outils", 15.0, 120.0);

pub struct Quete {
    pub texte: &'static str,
    pub prime: f64,
}

pub const QUETES: [Quete; 15] = [
    Quete { texte: "Construisez un Bûcheron près d'une forêt", prime: 30.0 },
    Quete { texte: "Construisez une Carrière", prime: 30.0 },
    Quete { texte: "Construisez un Pêcheur et une Ferme céréalière", prime: 40.0 },
    Quete { texte: "Construisez une Scierie", prime: 40.0 },
    Quete { texte: "Bâtissez un Grenier à grain avant l'hiver", prime: 60.0 },
    Quete { texte: "Atteignez 400 habitants", prime: 80.0 }, // 40 au moteur (HOMMES)
    Quete { texte: "Faites de votre capitale un Village", prime: 120.0 },
    Quete { texte: "Produisez du pain (Moulin + Boulangerie)", prime: 100.0 },
    Quete { texte: "Construisez un Comptoir de commerce", prime: 120.0 },
    Quete { texte: "Ouvrez une route commerciale ou signez une alliance", prime: 150.0 },
    Quete { texte: "Rassemblez 20 régiments (200 soldats)", prime: 120.0 },
    Quete { texte: "Découvrez 3 technologies", prime: 150.0 },
    Quete { texte: "Atteignez le rang de Bourg", prime: 250.0 },
    Quete { texte: "Fondez une Colonie", prime: 300.0 },
    Quete { texte: "Visez la victoire : conquête, prospérité ou diplomatie !", prime: 0.0 },
];

impl Partie {
    fn quete_faite(&self, n: usize) -> bool {
        let j = self.joueur();
        let niv = self.niveau_capitale(0);
        match n {
            0 => self.a_batiment(0, "bucheron"),
            1 => self.a_batiment(0, "carriere"),
            2 => self.a_batiment(0, "pecheur") && self.a_batiment(0, "ferme"),
            3 => self.a_batiment(0, "scierie"),
            4 => self.a_batiment(0, "grenier"),
            5 => j.pop >= 40,
            6 => niv >= 2,
            7 => self.a_batiment(0, "moulin") && self.a_batiment(0, "boulangerie"),
            8 => self.a_batiment(0, "comptoir"),
            9 => self.royaumes.iter().any(|r| !r.joueur && (r.commerce || r.statut == "alliance")),
            10 => self.stats(0).soldats >= 20,
            11 => j.techs.len() >= 3,
            12 => niv >= 3,
            13 => self.villes.iter().filter(|v| v.proprio == 0).count() >= 2,
            _ => false,
        }
    }

    pub fn evt(&mut self, rapport: &mut Rapport, texte: String, genre: &str, case: Option<usize>) {
        self.noter(format!("{} · {}", meteo::date_texte(self.tour), texte));
        rapport.evenements.push(Evenement { texte, genre: genre.into(), case });
    }

    /// Joue la fin du mois en cours et passe au suivant. Rend le rapport du mois.
    pub fn fin_du_mois(&mut self) -> Rapport {
        let eff = self.meteo.effets(self.tour);
        let mut rapport = Rapport {
            tour: self.tour,
            date: meteo::date_texte(self.tour),
            meteo: Some(self.meteo.clone()),
            effets_meteo: eff.resume.clone(),
            pop_avant: self.joueur().pop,
            ..Default::default()
        };
        if self.fin.is_some() && !self.sans_victoire {
            return rapport;
        }
        // propositions laissées sans réponse : refusées
        let restees: Vec<_> = self.propositions.drain(..).collect();
        for pr in restees {
            if let Some(r) = self.royaumes.get_mut(pr.de) {
                r.relation -= 2.0;
            }
        }
        // événements à choix laissés sans réponse : la dernière option (qui ne coûte rien) s'applique
        let en_attente: Vec<(u32, usize)> = self.choix.iter().map(|c| (c.id, c.options.len().saturating_sub(1))).collect();
        for (id, o) in en_attente {
            match self.choisir(id, o) {
                Ok(t) => rapport.evenements.push(Evenement { texte: format!("Sans réponse de votre part — {t}"), genre: "info".into(), case: None }),
                Err(_) => self.choix.retain(|c| c.id != id),
            }
        }
        if let Some(h) = self.meteo.historique.clone() {
            self.evt(&mut rapport, h, "meteo", None);
        }
        // la diplomatie du monde (rencontres, souverains, humeurs entre rivaux, coalitions), puis
        // les royaumes de l'ordinateur décident (constructions, recrutement, guerre, offres)
        crate::ia::diplomatie::monde(self, &mut rapport);
        for k in 1..self.royaumes.len() {
            if self.royaumes[k].vivant {
                ia::mois(self, k, &mut rapport);
            }
        }
        self.brigands(&mut rapport);
        self.navigation(&eff, &mut rapport);
        self.marches(&eff, &mut rapport);
        self.espions_mois(&eff, &mut rapport);
        self.sieges_mois(&eff, &mut rapport);
        self.blocus_mois(&mut rapport);
        self.chantiers(&mut rapport);
        self.forts_mois(&mut rapport);
        // la même économie pour tous les royaumes encore debout
        for k in 0..self.royaumes.len() {
            if k == 0 || self.royaumes[k].vivant {
                self.economie(k, &eff, &mut rapport);
                self.recherche(k, &mut rapport);
                self.evenements(k, &eff, &mut rapport);
            }
        }
        self.choix_mois(&mut rapport);
        self.explorer();
        // quêtes
        while self.joueur().quete < QUETES.len() - 1 && self.quete_faite(self.joueur().quete) {
            let q = &QUETES[self.joueur().quete];
            let prime = q.prime;
            *self.royaumes[0].stock.entry("or".into()).or_insert(0.0) += prime;
            self.evt(&mut rapport, format!("📜 Objectif accompli : {} (+{} 🪙)", q.texte, prime), "or", None);
            self.royaumes[0].quete += 1;
        }
        self.recalculer_routes();
        self.victoire(&mut rapport);
        if self.fin.as_ref().is_some_and(|f| !f.victoire) {
            self.propositions.clear();
        }
        // mois suivant
        self.tour += 1;
        self.meteo = Meteo::tirer(&self.meteo, self.tour, &mut self.hasard);
        rapport.pop_apres = self.joueur().pop;
        rapport.bilan = self.royaumes[0].bilan.clone();
        self.rapport = rapport.clone();
        rapport
    }

    // ------------------------------------------------------------------ armées
    fn brigands(&mut self, rapport: &mut Rapport) {
        if !self.options.brigands || self.tour < self.prochains_brigands {
            return;
        }
        self.prochains_brigands = self.tour + self.hasard.entre(14, 24) as u32;
        let Some(ci) = self.capitale(0) else { return };
        let cap = self.villes[ci].case;
        let comp = self.carte.cases[cap].comp;
        let cand: Vec<usize> = (0..self.carte.cases.len())
            .filter(|&i| {
                let k = &self.carte.cases[i];
                k.terre() && k.t != Terrain::Montagne && k.proprio == -1 && k.comp == comp && (5..=10).contains(&self.carte.dist(i, cap))
            })
            .collect();
        let Some(&depart) = self.hasard.choix(&cand) else { return };
        let Some(ch) = self.chemin(depart, cap) else { return };
        let mut u = BTreeMap::new();
        u.insert("milice".to_string(), 3 + self.tour / 18);
        if self.tour > 60 {
            u.insert("mousquetaire".to_string(), self.tour / 40);
        }
        let id = self.creer_armee(BRIGANDS, depart, u);
        let i = self.armee(id).unwrap();
        self.armees[i].chemin = ch;
        let n = self.armees[i].effectif();
        let nom = self.villes[ci].nom.clone();
        self.evt(rapport, format!("🏴 Une bande de brigands ({n}) sort des bois et marche sur {nom} !"), "guerre", Some(depart));
    }

    fn marches(&mut self, eff: &Effets, rapport: &mut Rapport) {
        let mut points: BTreeMap<u32, f64> = BTreeMap::new();
        for a in &self.armees {
            if !a.chemin.is_empty() {
                points.insert(a.id, self.vitesse(a) * eff.mouvement);
            }
        }
        let mut trajets: BTreeMap<u32, Vec<usize>> = BTreeMap::new();
        for a in &self.armees {
            if !a.chemin.is_empty() {
                trajets.insert(a.id, vec![a.case]);
            }
        }
        for etape in 0..14 {
            let mut bouge = false;
            let ids: Vec<u32> = self.armees.iter().map(|a| a.id).collect();
            for id in ids {
                let Some(i) = self.armee(id) else { continue };
                if self.armees[i].chemin.is_empty() {
                    continue;
                }
                let pts = points.get(&id).copied().unwrap_or(0.0);
                if pts <= 0.05 {
                    continue;
                }
                let suiv = self.armees[i].chemin[0];
                points.insert(id, pts - self.cout_case(suiv));
                self.armees[i].chemin.remove(0);
                self.armees[i].case = suiv;
                self.armees[i].retranche = None;
                let pr = self.armees[i].proprio;
                self.decouvrir(pr, suiv, regles().vision.armee);
                trajets.entry(id).or_default().push(suiv);
                bouge = true;
                self.entrer(id, eff, rapport, etape + 1);
            }
            if !bouge {
                break;
            }
        }
        for (id, t) in trajets {
            if t.len() > 1 {
                let proprio = self.armees.iter().find(|a| a.id == id).map(|a| a.proprio).unwrap_or_else(|| {
                    // l'armée a péri en route : on garde son trajet pour l'animation
                    rapport.combats.iter().find(|c| c.case == *t.last().unwrap()).map(|c| c.attaquant).unwrap_or(-1)
                });
                rapport.mouvements.push(Mouvement { armee: id, proprio, trajet: t, flotte: false });
            }
        }
        // regroupement des armées immobiles sur la même case ; retour des armées de l'ordinateur
        let mut i = 0;
        while i < self.armees.len() {
            let a = self.armees[i].clone();
            if a.chemin.is_empty() && !self.praticable(a.case) {
                // une armée restée sur l'eau sans flotte (ancienne sauvegarde, débarquement manqué) regagne sa ville
                if let Some(vi) = self.ville_proche(a.case, a.proprio) {
                    self.armees[i].case = self.villes[vi].case;
                    continue;
                }
                self.armees.remove(i);
                continue;
            }
            if a.chemin.is_empty() && !self.assiege(a.proprio, a.case) {
                // le joueur fusionne lui-même ses armées (ordre « fusionner ») : celles qu'il a séparées restent séparées
                if let Some(j) = self.armees.iter().position(|o| o.id != a.id && o.proprio == a.proprio && o.case == a.case && o.chemin.is_empty() && o.id < a.id).filter(|_| a.proprio != 0) {
                    self.fusionner(j, i);
                    continue;
                }
                if a.proprio == BRIGANDS {
                    // une bande arrivée sans trouver de proie se disperse
                    if self.ville_a(a.case).is_none() {
                        self.armees.remove(i);
                        continue;
                    }
                } else if a.proprio != 0 && !self.tient_un_poste(&a) {
                    if let Some(vi) = self.ville_proche(a.case, a.proprio) {
                        let maison = self.villes[vi].case;
                        if maison != a.case && self.hasard.p(0.5) {
                            if let Some(ch) = self.chemin(a.case, maison) {
                                self.armees[i].chemin = ch;
                            }
                        }
                    }
                }
            }
            i += 1;
        }
    }

    /// Une armée vient d'entrer sur sa case : siège ou bataille.
    fn entrer(&mut self, id: u32, eff: &Effets, rapport: &mut Rapport, etape: usize) {
        let Some(i) = self.armee(id) else { return };
        let (case, proprio) = (self.armees[i].case, self.armees[i].proprio);
        if let Some(vi) = self.ville_a(case) {
            if self.est_ennemi(proprio, self.villes[vi].proprio) {
                // une ville fortifiée s'assiège ; sans murs, elle se prend d'une bataille (les brigands ne font que piller)
                if proprio != BRIGANDS && (self.murs_ville(vi) > 0.0 || self.siege_de(self.villes[vi].id).is_some()) {
                    self.commencer_siege(id, vi, rapport);
                } else {
                    self.bataille(id, Some(vi), eff, rapport, etape);
                }
                return;
            }
        }
        // un fort ennemi achevé et tenu (ou déjà assiégé) s'assiège comme une petite ville
        if let Some(fi) = self.fort_a(case).filter(|&fi| self.est_ennemi(proprio, self.forts[fi].proprio)) {
            let f = &self.forts[fi];
            if proprio != BRIGANDS && f.niveau > 0 && (self.garnison(f.proprio, case) || self.siege_de(f.id).is_some()) {
                self.commencer_siege_fort(id, fi, rapport);
                return;
            }
        }
        let ennemis: Vec<u32> = self.armees.iter().filter(|o| o.id != id && o.case == case && self.est_ennemi(proprio, o.proprio)).map(|o| o.id).collect();
        if !ennemis.is_empty() {
            self.bataille(id, None, eff, rapport, etape);
        }
        // un fort ennemi sans garnison (ou un chantier dont la garde vient d'être battue) change de mains
        if proprio != BRIGANDS && self.armee(id).is_some() {
            if let Some(fi) = self.fort_a(case).filter(|&fi| self.est_ennemi(proprio, self.forts[fi].proprio) && !self.garnison(self.forts[fi].proprio, case)) {
                self.prendre_fort(fi, proprio, rapport);
            }
        }
    }

    fn bataille(&mut self, id: u32, ville: Option<usize>, eff: &Effets, rapport: &mut Rapport, etape: usize) {
        let i = self.armee(id).unwrap();
        let a = self.armees[i].clone();
        let case = a.case;
        let def_proprio = match ville {
            Some(vi) => self.villes[vi].proprio,
            None => self.armees.iter().find(|o| o.case == case && self.est_ennemi(a.proprio, o.proprio)).unwrap().proprio,
        };
        let defenseurs: Vec<u32> = self.armees.iter().filter(|o| o.id != id && o.case == case && o.proprio == def_proprio).map(|o| o.id).collect();
        let mut at = self.attaque(&a, ville.is_some(), eff.tir).max(1.0);
        if self.meteo.genre == "brouillard" {
            at *= 1.1;
        }
        let k = &self.carte.cases[case];
        let terrain = if k.t == Terrain::Colline || k.foret { 1.2 } else { 1.0 };
        // retranchements et forts protègent les défenseurs
        let mut de: f64 = defenseurs.iter().map(|d| &self.armees[self.armee(*d).unwrap()]).map(|x| self.defense(x) * self.protection(x)).sum::<f64>() * terrain;
        if let Some(vi) = ville {
            de += self.defense_ville(vi);
        }
        let de = de.max(1.0);
        let r = at / (at + de) * (0.85 + self.hasard.f() * 0.3);
        let (na, nd) = (self.nom_royaume(a.proprio), self.nom_royaume(def_proprio));
        let lieu = ville.map(|vi| self.villes[vi].nom.clone()).unwrap_or_else(|| "en rase campagne".into());
        let concerne = a.proprio == 0 || def_proprio == 0;
        if r > 0.5 {
            self.pertes(id, (de / at * 0.5).clamp(0.05, 0.85));
            for d in defenseurs {
                self.detruire_armee(d);
            }
            let texte = format!("⚔️ Victoire de {na} sur {nd} ({lieu})");
            rapport.combats.push(Combat { case, attaquant: a.proprio, defenseur: def_proprio, vainqueur: a.proprio, texte: texte.clone(), etape });
            if concerne {
                self.evt(rapport, texte, if a.proprio == 0 { "bon" } else { "guerre" }, Some(case));
            }
            if let Some(vi) = ville {
                if self.armee(id).is_some() {
                    if a.proprio == BRIGANDS {
                        self.pillage(id, vi, rapport);
                    } else {
                        self.prise(vi, a.proprio, rapport);
                    }
                }
            }
        } else {
            for d in &defenseurs {
                self.pertes(*d, (at / de * 0.5).clamp(0.05, 0.85));
            }
            self.detruire_armee(id);
            let texte = format!("🛡️ {nd} repousse {na} ({lieu})");
            rapport.combats.push(Combat { case, attaquant: a.proprio, defenseur: def_proprio, vainqueur: def_proprio, texte: texte.clone(), etape });
            if concerne {
                self.evt(rapport, texte, if def_proprio == 0 { "bon" } else { "guerre" }, Some(case));
            }
            if a.proprio == BRIGANDS && def_proprio == 0 {
                *self.royaumes[0].stock.entry("or".into()).or_insert(0.0) += 40.0;
                self.evt(rapport, "Butin pris aux brigands : +40 🪙".into(), "or", None);
            }
        }
    }

    pub fn pertes(&mut self, id: u32, frac: f64) {
        let Some(i) = self.armee(id) else { return };
        let mut perdus = 0i64;
        let a = &mut self.armees[i];
        for n in a.unites.values_mut() {
            let l = ((*n as f64) * frac).round() as u32;
            let l = l.min(*n);
            *n -= l;
            perdus += l as i64;
        }
        a.unites.retain(|_, n| *n > 0);
        let vide = a.unites.is_empty();
        let proprio = a.proprio;
        if let Some(r) = self.royaume_mut(proprio) {
            r.pop = (r.pop - perdus).max(1);
        }
        if vide {
            self.armees.remove(i);
        }
    }

    pub fn detruire_armee(&mut self, id: u32) {
        if let Some(i) = self.armee(id) {
            let n = self.armees[i].effectif() as i64;
            if let Some(r) = self.royaume_mut(self.armees[i].proprio) {
                r.pop = (r.pop - n).max(1);
            }
            self.armees.remove(i);
        }
    }

    fn pillage(&mut self, id: u32, vi: usize, rapport: &mut Rapport) {
        let v = self.villes[vi].clone();
        if let Some(r) = self.royaume_mut(v.proprio) {
            let st = &mut r.stock;
            let or = st.entry("or".into()).or_insert(0.0);
            let g = (*or * 0.25).floor();
            *or -= g;
            for r in ["bois", "pierre", "pain", "poisson", "ble"] {
                if let Some(x) = st.get_mut(r) {
                    *x *= 0.8;
                }
            }
            if v.proprio == 0 {
                self.evt(rapport, format!("🏴 Les brigands pillent {} : −{g} 🪙 et des vivres", v.nom), "guerre", Some(v.case));
            }
        }
        self.detruire_armee(id);
    }

    pub fn prise(&mut self, vi: usize, nouveau: i32, rapport: &mut Rapport) {
        let ancien = self.villes[vi].proprio;
        let vid = self.villes[vi].id;
        let etait_capitale = self.villes[vi].capitale;
        self.villes[vi].proprio = nouveau;
        self.villes[vi].travaux_fortif = 0;
        self.sieges.retain(|s| s.ville != vid);
        self.blocus.retain(|b| b.ville != vid);
        self.villes[vi].capitale = !self.villes.iter().any(|v| v.proprio == nouveau && v.capitale);
        for b in self.batiments.iter_mut() {
            if b.proprio == ancien && (b.ville == Some(vid) || b.case == self.villes[vi].case) {
                b.proprio = nouveau;
                b.file.clear();
                b.ouvriers = 0;
            }
        }
        self.recalculer_territoire();
        let nom = self.villes[vi].nom.clone();
        let case = self.villes[vi].case;
        // notée pour les coalitions et la rancune du vaincu, annoncée au joueur s'il connaît les deux royaumes ;
        // une ville cédée par traité ne rapporte pas de butin
        let cession = crate::ia::diplomatie::conquete(self, nouveau, ancien, vi, rapport);
        // le vainqueur emporte la moitié du trésor d'un rival vaincu (celui du joueur reste au joueur)
        let butin = if !cession && ancien > 0 && ancien != BRIGANDS && nouveau >= 0 && nouveau != BRIGANDS {
            let or = self.royaumes[ancien as usize].stock.entry("or".into()).or_insert(0.0);
            let butin = (*or * 0.5).floor();
            *or -= butin;
            *self.royaumes[nouveau as usize].stock.entry("or".into()).or_insert(0.0) += butin;
            butin
        } else {
            0.0
        };
        if cession {
            if nouveau == 0 || ancien == 0 {
                self.noter(format!("{nom} passe à {} par traité", self.nom_royaume(nouveau)));
            }
        } else if nouveau == 0 {
            self.evt(rapport, format!("🏰 {nom} est conquise ! Butin : {butin} 🪙"), "bon", Some(case));
        } else if ancien == 0 {
            let qui = self.nom_royaume(nouveau);
            self.evt(rapport, format!("💀 {nom} tombe aux mains de {qui} !"), "guerre", Some(case));
        }
        let restantes: Vec<usize> = (0..self.villes.len()).filter(|&i| self.villes[i].proprio == ancien).collect();
        if restantes.is_empty() {
            if ancien == 0 {
                self.fin = Some(Fin { victoire: false, titre: "Défaite".into(), texte: "Votre dernière ville est tombée. Votre royaume n'est plus qu'un souvenir…".into() });
                self.sans_victoire = false;
            } else {
                let a = ancien as usize;
                self.royaumes[a].vivant = false;
                self.armees.retain(|x| x.proprio != ancien);
                self.flottes.retain(|x| x.proprio != ancien);
                self.espions.retain(|x| x.proprio != ancien);
                // ses forts sont abandonnés et rasés
                self.forts.retain(|x| x.proprio != ancien);
                self.recalculer_territoire();
                let n = self.royaumes[a].nom.clone();
                self.evt(rapport, format!("☠️ {n} a été anéanti !"), "or", None);
            }
        } else if etait_capitale {
            self.villes[restantes[0]].capitale = true;
        }
    }

    // ------------------------------------------------------------------ chantiers
    fn chantiers(&mut self, rapport: &mut Rapport) {
        let mut finis = Vec::new();
        for b in self.batiments.iter_mut() {
            if b.reste > 0 {
                b.reste -= 1;
                if b.reste == 0 {
                    finis.push(b.id);
                }
            }
        }
        let mut territoire = false;
        for id in finis {
            let b = self.bat(id).cloned().unwrap();
            let d = regles().bat(&b.cle).unwrap();
            rapport.termines.push(b.case);
            if b.cle == "colonie" {
                let pr = b.proprio;
                let nom = if pr >= 0 && (pr as usize) < self.royaumes.len() && !self.royaumes[pr as usize].noms_villes.is_empty() {
                    self.royaumes[pr as usize].noms_villes.remove(0)
                } else {
                    format!("Nouvelle-{}", self.prochain_id)
                };
                let vid = self.id();
                self.villes.push(crate::partie::Ville { id: vid, nom: nom.clone(), proprio: pr, case: b.case, niveau: 1, capitale: false, fortif: 0, travaux_fortif: 0, eclairage: false });
                if let Some(bb) = self.batiments.iter_mut().find(|x| x.id == id) {
                    bb.cle = "hotel".into();
                    bb.ville = Some(vid);
                }
                if pr == 0 {
                    self.evt(rapport, format!("🚩 La colonie de {nom} est fondée !"), "bon", Some(b.case));
                } else if self.connait(0, b.case) {
                    let qui = self.nom_royaume(pr);
                    self.evt(rapport, format!("{qui} fonde la ville de {nom}"), "info", Some(b.case));
                }
                territoire = true;
                continue;
            }
            if d.territoire > 0 {
                territoire = true;
            }
            if b.proprio == 0 {
                self.evt(rapport, format!("{} {} achevé(e)", d.icone, d.nom), "bon", Some(b.case));
            }
        }
        // les villes en travaux de fortification
        for vi in 0..self.villes.len() {
            let v = &mut self.villes[vi];
            if v.travaux_fortif == 0 {
                continue;
            }
            v.travaux_fortif -= 1;
            if v.travaux_fortif > 0 {
                continue;
            }
            v.fortif += 1;
            let (nom, case, proprio) = (v.nom.clone(), v.case, v.proprio);
            let Some(f) = regles().fortif(self.villes[vi].fortif) else { continue };
            territoire |= f.territoire > 0;
            if proprio == 0 {
                self.evt(rapport, format!("{} {nom} : {} achevé(e)s !", f.icone, f.nom), "bon", Some(case));
            }
        }
        if territoire {
            self.recalculer_territoire();
        }
    }

    // ------------------------------------------------------------------ économie (la même pour tous les royaumes)
    /// Les guerres que mène `id` : le joueur contre chaque rival en guerre, un rival contre le joueur.
    pub fn guerres(&self, id: i32) -> f64 {
        if id == 0 {
            self.royaumes.iter().filter(|r| !r.joueur && r.vivant && r.statut == "guerre").count() as f64
        } else {
            (self.royaumes[id as usize].statut == "guerre") as u8 as f64
        }
    }

    /// Les routes commerciales ouvertes de `id` (entre le joueur et un rival en paix).
    pub fn routes_commerciales(&self, id: i32) -> f64 {
        let ouverte = |r: &crate::partie::Royaume| !r.joueur && r.vivant && r.commerce && r.statut != "guerre";
        if id == 0 {
            self.royaumes.iter().filter(|r| ouverte(r)).count() as f64
        } else {
            // la route avec le joueur, et celles ouvertes avec les autres rivaux (ia/diplomatie.rs)
            let k = id as usize;
            let rivaux = self.diplomatie.liens.iter().filter(|l| (l.a == k || l.b == k) && l.commerce && l.statut != "guerre" && self.royaumes[l.a + l.b - k].vivant).count();
            ouverte(&self.royaumes[k]) as u8 as f64 + rivaux as f64
        }
    }

    /// Les ouvriers de `k` : la nourriture d'abord, puis les ressources, l'artisanat, les services, l'armée.
    pub fn affecter_ouvriers(&mut self, k: usize) {
        let rg = regles();
        let id = k as i32;
        let mut libres = (self.royaumes[k].pop - self.stats(id).soldats).max(0);
        let prio = |cle: &str| -> u32 {
            let d = rg.bat(cle).unwrap();
            if d.prod.keys().any(|r| rg.est_vivre(r)) {
                0
            } else if d.cat == "ressources" {
                1
            } else if d.cat == "artisanat" {
                2
            } else if !d.unites.is_empty() {
                4
            } else {
                3
            }
        };
        let mut ordre: Vec<usize> = (0..self.batiments.len())
            .filter(|&i| {
                let b = &self.batiments[i];
                b.proprio == id && b.fini() && rg.bat(&b.cle).unwrap().ouvriers > 0
            })
            .collect();
        ordre.sort_by_key(|&i| (prio(&self.batiments[i].cle), self.batiments[i].id));
        for i in ordre {
            let d = rg.bat(&self.batiments[i].cle).unwrap();
            if self.batiments[i].pause {
                self.batiments[i].ouvriers = 0;
                continue;
            }
            let n = (d.ouvriers as i64).min(libres);
            self.batiments[i].ouvriers = n as u32;
            libres -= n;
        }
        self.royaumes[k].ouvriers_libres = libres;
    }

    /// Le mois de l'économie du royaume `k` : ouvriers, production des bâtiments, vivres, boissons, drap, chauffage,
    /// bonheur, population, impôts et entretien. Les mêmes règles pour tous ; seul le joueur en reçoit le détail
    /// dans son rapport (d'un rival, il n'apprend que la famine, s'il connaît sa capitale).
    fn economie(&mut self, k: usize, eff: &Effets, rapport: &mut Rapport) {
        let rg = regles();
        let id = k as i32;
        let s = self.stats(id);
        let m = meteo::mois(self.tour);
        let saison = meteo::saison(m);
        let avant = self.royaumes[k].stock.clone();
        let etait_affame = self.royaumes[k].famine;
        self.affecter_ouvriers(k);
        // la vie des villes : ateliers instruits, jour de marché, ignorance, délinquance (cite.rs)
        let vies: Vec<(usize, VieVille)> = (0..self.villes.len()).filter(|&vi| self.villes[vi].proprio == id).map(|vi| (vi, self.vie_ville(vi))).collect();
        let ateliers: BTreeMap<u32, f64> = vies.iter().map(|(vi, x)| (self.villes[*vi].id, x.ateliers)).collect();
        let j = &self.royaumes[k];
        let ecole = if j.a("vapeur") { 1.0 } else { 1.0 };
        let humeur = 0.75 + j.bonheur / 200.0;
        // au niveau le plus dur, l'ordinateur produit un peu plus (`ia::bonus_production`) : son seul avantage
        let bonus = if j.joueur { 1.0 } else { ia::bonus_production(self.options.difficulte) };
        let routes_niv = self.niveau_routes(id) as f64;
        let (assol, engrais, vapeur, carto) = (j.a("assolement"), j.a("engrais"), j.a("vapeur"), j.a("cartographie"));
        let cap: BTreeMap<String, f64> = rg.ressources.iter().map(|r| (r.cle.clone(), self.capacite(&s, &r.cle))).collect();
        for i in 0..self.batiments.len() {
            if self.batiments[i].proprio != id || !self.batiments[i].fini() {
                continue;
            }
            let cle_b = self.batiments[i].cle.clone();
            let d = rg.bat(&cle_b).unwrap();
            self.batiments[i].produit.clear();
            if self.batiments[i].pause {
                self.batiments[i].etat = "⏸ En pause".into();
                continue;
            }
            let staff = if d.ouvriers > 0 { self.batiments[i].ouvriers as f64 / d.ouvriers as f64 } else { 1.0 };
            if d.ouvriers > 0 && self.batiments[i].ouvriers == 0 {
                self.batiments[i].etat = "👷 Aucun ouvrier disponible".into();
                continue;
            }
            if self.batiments[i].arret > self.tour {
                self.batiments[i].etat = format!("💣 Endommagé : arrêté jusqu'en {}", meteo::date_texte(self.batiments[i].arret));
                continue;
            }
            if self.faubourg_assiege(&self.batiments[i]) {
                self.batiments[i].etat = "🔥 Faubourg assiégé : hors de l'enceinte, plus rien ne sort".into();
                continue;
            }
            if !d.unites.is_empty() {
                let mut formes = 0.0;
                let mut credit = 2.0 * staff;
                while credit >= 1.0 - 1e-9 && !self.batiments[i].file.is_empty() {
                    let u = self.batiments[i].file.remove(0);
                    let case = self.batiments[i].case;
                    self.recruter_dans(id, &u, case);
                    credit -= 1.0;
                    formes += 1.0;
                }
                let n = self.batiments[i].file.len();
                self.batiments[i].etat = if formes > 0.0 { format!("{formes} régiment(s) formé(s), {n} en file") } else if n > 0 { format!("{n} en file") } else { "Prête à recruter".into() };
                // le port forme ses navires et pêche aussi
                if d.prod.is_empty() {
                    continue;
                }
            }
            if (cle_b == "port" || cle_b == "pecheur") && self.bloquee(self.batiments[i].ville) {
                self.batiments[i].etat = "⚓ Blocus : pêche et commerce coupés".into();
                continue;
            }
            if cle_b == "forestier" {
                let plantes = self.replanter(i, (4.0 * staff).round() as u32);
                self.batiments[i].etat = format!("🌱 {plantes} arbre(s) planté(s)");
                continue;
            }
            if d.prod.is_empty() {
                self.batiments[i].etat = if d.ouvriers > 0 { "✔ Actif".into() } else { String::new() };
                continue;
            }
            let b = &self.batiments[i];
            let kc = &self.carte.cases[b.case];
            let mut f = staff * ecole * humeur * bonus;
            if let Some(cult) = &d.saison {
                f *= meteo::saisonnier(cult, m) * eff.cultures;
                if b.cle == "ferme" || b.cle == "champ_patates" {
                    if assol {
                        f *= 1.2;
                    }
                    if engrais {
                        f *= 1.3;
                    }
                }
                if b.cle == "ferme" && kc.fertile {
                    f *= 1.5;
                }
            }
            if b.cle == "pecheur" || b.cle == "port" {
                f *= eff.peche * if carto { 1.2 } else { 1.0 };
                if self.carte.voisins(b.case).iter().any(|&v| self.carte.cases[v].poissons) {
                    f *= 1.5;
                }
            }
            if b.cle == "carriere" && (kc.gisement.as_deref() == Some("pierre") || self.carte.voisins(b.case).iter().any(|&v| self.carte.cases[v].gisement.as_deref() == Some("pierre"))) {
                f *= 1.4;
            }
            if d.cat == "artisanat" && vapeur {
                f *= 1.2;
            }
            if d.cat == "artisanat" {
                f *= 1.0 + b.ville.and_then(|v| ateliers.get(&v)).copied().unwrap_or(0.0);
            }
            // de bonnes routes : les charrois vont plus vite
            f *= 1.0 + 0.05 * (routes_niv - 1.0);
            if b.cle == "mine_or" && saison == 0 {
                f *= 0.8;
            }
            let mut manque = None;
            let mut plein = false;
            let st = &self.royaumes[k].stock;
            for (r, v) in &d.conso {
                let dispo = st.get(r).copied().unwrap_or(0.0);
                if dispo < v * f {
                    let kk = dispo / v;
                    if kk < f {
                        f = kk;
                        manque = Some(r.clone());
                    }
                }
            }
            for (r, v) in &d.prod {
                if r == "or" {
                    continue;
                }
                let place = (cap[r] - st.get(r).copied().unwrap_or(0.0)).max(0.0);
                if place / v < f {
                    f = place / v;
                    plein = true;
                }
            }
            if d.saison.is_some() && f <= 1e-6 && !plein && manque.is_none() {
                self.batiments[i].etat = format!("💤 Hors saison ({})", meteo::SAISONS[saison]);
                continue;
            }
            if b.cle == "bucheron" {
                let voulu = d.prod["bois"] * f;
                let obtenu = self.abattre(i, voulu);
                f = obtenu / d.prod["bois"];
                if obtenu <= 1e-6 {
                    self.batiments[i].etat = "🌲 Plus d'arbres à proximité".into();
                    continue;
                }
            }
            let mut produit = Panier::new();
            {
                let st = &mut self.royaumes[k].stock;
                for (r, v) in &d.conso {
                    let x = st.entry(r.clone()).or_insert(0.0);
                    *x = (*x - v * f).max(0.0);
                }
                for (r, v) in &d.prod {
                    *st.entry(r.clone()).or_insert(0.0) += v * f;
                    produit.insert(r.clone(), v * f);
                }
            }
            let texte: Vec<String> = produit.iter().map(|(r, v)| format!("{} {:.0}", rg.res_icone(r), v)).collect();
            self.batiments[i].etat = if plein {
                "📦 Stock plein".into()
            } else if let Some(r) = manque {
                format!("⚠️ Manque : {}", rg.res_nom(&r))
            } else {
                format!("✔ {} /mois", texte.join(" "))
            };
            self.batiments[i].produit = produit;
        }
        // nourriture
        let pop = self.royaumes[k].pop as f64;
        let st = &mut self.royaumes[k].stock;
        let variete = rg.nourriture.iter().filter(|r| st.get(*r).copied().unwrap_or(0.0) > 0.5).count() as u32;
        let mut reste = pop * 0.3;
        for _ in 0..4 {
            if reste <= 1e-6 {
                break;
            }
            let dispo: Vec<String> = rg.nourriture.iter().filter(|r| st.get(*r).copied().unwrap_or(0.0) > 1e-6).cloned().collect();
            if dispo.is_empty() {
                break;
            }
            let part = reste / dispo.len() as f64;
            for r in dispo {
                let x = st.get_mut(&r).unwrap();
                let t = x.min(part);
                *x -= t;
                reste -= t;
            }
        }
        let famine = reste > 0.5;
        // boissons, drap, chauffage
        let mut boisson = 0.0;
        if s.taverne > 0.0 && pop > 0.0 {
            let couv = (s.taverne / pop).min(1.0);
            let mut besoin = s.taverne.min(pop) * 0.1;
            let dispo: f64 = rg.boissons.iter().map(|r| st.get(r).copied().unwrap_or(0.0)).sum();
            let ratio = if besoin > 0.0 { (dispo / besoin).min(1.0) } else { 0.0 };
            for r in &rg.boissons {
                let x = st.entry(r.clone()).or_insert(0.0);
                let t = x.min(besoin);
                *x -= t;
                besoin -= t;
            }
            boisson = couv * ratio;
        }
        let besoin_drap = pop * 0.05;
        let drap = if st.get("tissu").copied().unwrap_or(0.0) >= besoin_drap && besoin_drap > 0.0 {
            *st.get_mut("tissu").unwrap() -= besoin_drap;
            true
        } else {
            false
        };
        let chauffage = self.chauffer(id, pop);
        let gele = chauffage.is_some_and(|v| v < 0.0);
        // bonheur
        let foi = (s.foi / pop.max(1.0)).min(1.0);
        let hyg = (s.hygiene / pop.max(1.0)).min(1.0);
        let guerres = self.guerres(id);
        let impots = self.royaumes[k].impots.clone();
        let mut detail: Vec<(String, f64)> = vec![
            ("Base".into(), 35.0),
            ("Nourriture".into(), if famine { -30.0 } else { [0.0, 6.0, 11.0, 15.0, 18.0, 20.0][variete.min(5) as usize] }),
            ("Bière et vin (tavernes)".into(), (10.0 * boisson).round()),
            ("Foi".into(), (10.0 * foi).round()),
            ("Hygiène".into(), (7.0 * hyg).round()),
            ("Vêtements".into(), if drap { 8.0 } else { 0.0 }),
            ("Décoration".into(), s.decor.min(15.0)),
            ("Impôts".into(), match impots.as_str() { "bas" => 10.0, "eleve" => -15.0, _ => 0.0 }),
            ("Guerres".into(), -4.0 * guerres),
            ("Météo".into(), eff.bonheur),
        ];
        let (mj, el) = (&rg.jour_marche, &rg.eclairage);
        let halles: f64 = vies.iter().filter(|x| x.1.marche).map(|x| x.1.halles as f64).sum();
        if halles > 0.0 {
            detail.push(if famine { ("Marché déserté (disette)".into(), mj.disette * halles) } else { ("Jour de marché".into(), (mj.bonheur * halles).min(mj.bonheur_max)) });
        }
        let ignorantes = vies.iter().filter(|x| x.1.ignorance).count() as f64;
        if ignorantes > 0.0 {
            detail.push(("Ignorance (villes sans école)".into(), -rg.ecoles.ignorance_bonheur * ignorantes));
        }
        let eclairees = self.villes.iter().filter(|v| v.proprio == id && v.eclairage).count() as f64;
        if eclairees > 0.0 {
            detail.push(("Éclairage public".into(), (el.bonheur * eclairees).min(el.bonheur_max)));
        }
        if let Some(v) = chauffage {
            detail.push((if v > 0.0 { "Chauffage : les foyers sont chauds" } else { "Chauffage" }.into(), v));
        }
        let cible: f64 = detail.iter().map(|x| x.1).sum::<f64>().clamp(0.0, 100.0);
        let j = &mut self.royaumes[k];
        j.bonheur += (cible - j.bonheur).clamp(-6.0, 6.0);
        j.detail_bonheur = detail;
        j.variete = variete;
        j.famine = famine;
        // population
        let parmentier = j.a("parmentier");
        if famine {
            let perte = ((pop * if parmentier { 0.025 } else { 0.05 }).ceil() as i64).max(1);
            j.pop = (j.pop - perte).max(1);
        } else if j.pop > s.logement + 2 {
            j.pop -= ((j.pop - s.logement) as f64 / 3.0).ceil() as i64;
        } else if j.pop < s.logement && j.bonheur >= 35.0 {
            let g = (pop * 0.05 * (j.bonheur - 30.0) / 40.0).max(1.0);
            j.pop = (j.pop + g.round() as i64).min(s.logement);
        }
        // le froid et les maladies, faute de combustible
        let geles = if gele { ((pop * rg.chauffage.pertes).ceil() as i64).max(1).min(j.pop - 1) } else { 0 };
        j.pop -= geles;
        // or : jour de marché (sauf disette) et délinquance des villes sans éclairage, en part des impôts
        let mult = match impots.as_str() { "bas" => 0.5, "eleve" => 1.6, _ => 1.0 };
        let part = j.pop as f64 * 0.5 * mult * (0.5 + j.bonheur / 100.0);
        let marche = if famine { 0.0 } else { halles * mj.impots };
        let delinquance = vies.iter().filter(|x| x.1.delinquance).count() as f64 * el.delinquance;
        let impot = part * (1.0 + s.taxe + marche - delinquance).max(0.0);
        let routes = if j.a("routes") { 1.5 } else { 1.0 };
        let commerce = self.routes_commerciales(id) * 25.0 * routes;
        let nb_bat = self.batiments.iter().filter(|b| b.proprio == id && b.fini()).count() as f64;
        let eclairage = eclairees * el.entretien;
        let entretien = s.soldats as f64 * 0.5 + nb_bat * 0.2 + s.entretien_flotte + self.entretien_forts(id) + eclairage;
        let commerce_mer = self.commerce_maritime(id);
        let j = &mut self.royaumes[k];
        j.commerce_mer = commerce_mer;
        let or = j.stock.entry("or".into()).or_insert(0.0);
        *or += impot + commerce + commerce_mer - entretien;
        if *or < 0.0 {
            *or = 0.0;
            j.bonheur = (j.bonheur - 3.0).max(0.0);
        }
        // dont : jour de marché, délinquance (dans les impôts), éclairage (dans l'entretien)
        j.revenus = Panier::from([
            ("impots".to_string(), impot),
            ("commerce".to_string(), commerce),
            ("commerce_mer".to_string(), commerce_mer),
            ("entretien".to_string(), entretien),
            ("marche".to_string(), part * marche),
            ("delinquance".to_string(), part * delinquance),
            ("eclairage".to_string(), eclairage),
        ]);
        for (r, v) in j.stock.iter_mut() {
            if r != "or" {
                *v = v.min(cap[r]).max(0.0);
            }
        }
        let mut bilan = Panier::new();
        for (r, v) in &j.stock {
            let d = v - avant.get(r).copied().unwrap_or(0.0);
            if d.abs() > 0.05 {
                bilan.insert(r.clone(), d);
            }
        }
        j.bilan = bilan;
        if k != 0 {
            // d'un rival, le joueur n'apprend que la famine qui commence, s'il connaît sa capitale
            let cap = self.capitale(id).map(|ci| self.villes[ci].case).filter(|&c| self.connait(0, c));
            if famine && !etait_affame && cap.is_some() {
                let nom = self.royaumes[k].nom.clone();
                self.evt(rapport, format!("🍽️ La famine frappe {nom} : ses greniers sont vides."), "info", cap);
            }
            return;
        }
        if famine {
            self.evt(rapport, "🍽️ Famine ! Les greniers sont vides, la population diminue.".into(), "guerre", None);
        }
        if gele {
            self.evt(rapport, format!("🥶 Pas assez de combustible pour se chauffer : le peuple grelotte, le froid et les maladies emportent {geles} habitant(s).", geles = geles as i64 * crate::regles::HOMMES), "meteo", None);
        }
        if self.jour_marche() {
            for (vi, x) in &vies {
                let (nom, case) = (self.villes[*vi].nom.clone(), Some(self.villes[*vi].case));
                if x.marche && famine {
                    self.evt(rapport, format!("🧺 Marché déserté à {nom} : la disette a vidé les étals."), "info", case);
                } else if x.marche {
                    let n = x.halles as f64;
                    self.evt(rapport, format!("🧺 Jour de marché à {nom} : impôts +{:.0} %, bonheur +{:.0}.", n * mj.impots * 100.0, (n * mj.bonheur).min(mj.bonheur_max)), "or", case);
                } else if x.halles > 0 {
                    self.evt(rapport, format!("🧺 Pas de marché à {nom} : la ville est assiégée ou bloquée."), "info", case);
                }
            }
        }
    }

    /// Abat `voulu` bois dans les forêts voisines du bûcheron `i` ; rend ce qui a été coupé.
    fn abattre(&mut self, i: usize, voulu: f64) -> f64 {
        let case = self.batiments[i].case;
        let mut forets: Vec<usize> = self.carte.voisins(case).into_iter().filter(|&v| self.carte.cases[v].foret && self.carte.cases[v].bois > 0.0).collect();
        forets.sort_by(|a, b| self.carte.cases[*b].bois.total_cmp(&self.carte.cases[*a].bois));
        let mut obtenu = 0.0;
        for v in forets {
            if obtenu >= voulu {
                break;
            }
            let pris = (self.carte.cases[v].bois as f64).min(voulu - obtenu);
            self.carte.cases[v].bois -= pris as f32;
            obtenu += pris;
            self.carte.regler_arbres(v);
        }
        obtenu
    }

    fn replanter(&mut self, i: usize, n: u32) -> u32 {
        let (case, proprio) = (self.batiments[i].case, self.batiments[i].proprio);
        let mut faits = 0;
        for _ in 0..n {
            let cand: Vec<usize> = self
                .carte
                .rayon(case, 2)
                .into_iter()
                .filter(|&c| {
                    let k = &self.carte.cases[c];
                    matches!(k.t, Terrain::Plaine | Terrain::Colline) && k.bat.is_none() && k.proprio == proprio && k.arbres < 6
                })
                .collect();
            if cand.is_empty() {
                break;
            }
            // on épaissit d'abord les bosquets
            let mut tri = cand.clone();
            tri.sort_by_key(|&c| std::cmp::Reverse(self.carte.cases[c].arbres));
            let c = if self.hasard.p(0.7) { tri[0] } else { cand[self.hasard.indice(cand.len())] };
            let k = &mut self.carte.cases[c];
            k.arbres += 1;
            if k.foret {
                k.bois += BOIS_ARBRE;
            } else if k.arbres >= 3 {
                k.foret = true;
                k.bois = k.arbres as f32 * BOIS_ARBRE;
            }
            faits += 1;
        }
        faits
    }

    // ------------------------------------------------------------------ recherche
    fn recherche(&mut self, k: usize, rapport: &mut Rapport) {
        let gain = self.savoir_mois(k as i32);
        let j = &mut self.royaumes[k];
        j.savoir += gain;
        if let Some(t) = j.recherche.clone() {
            let d = regles().tech(&t).unwrap();
            if j.savoir >= d.cout {
                j.savoir -= d.cout;
                j.techs.push(t.clone());
                j.recherche = None;
                let nom = d.nom.clone();
                if k == 0 {
                    self.evt(rapport, format!("💡 Découverte : {nom} !"), "bon", None);
                }
            }
        }
    }

    // ------------------------------------------------------------------ événements
    /// Les hasards du mois chez le royaume `k` : incendie, épidémie, moisson, réfugiés, gisement, colporteur (le
    /// joueur reçoit son offre ; un rival la prend s'il en a besoin, `ia::economie::colporteur`). Seuls ceux du joueur
    /// vont à son rapport.
    fn evenements(&mut self, k: usize, eff: &Effets, rapport: &mut Rapport) {
        let id = k as i32;
        let s = self.stats(id);
        let pop = self.royaumes[k].pop as f64;
        let hyg = s.hygiene / pop.max(1.0);
        // incendie
        if self.hasard.p(0.05 * eff.incendie) {
            let bois_: Vec<u32> = self
                .batiments
                .iter()
                .filter(|b| b.proprio == id && b.fini() && !["hotel", "maison_pierre", "hotel_particulier", "immeuble", "eglise", "cathedrale", "tour", "palais", "puits", "fontaine"].contains(&b.cle.as_str()))
                .map(|b| b.id)
                .collect();
            if let Some(&b) = self.hasard.choix(&bois_) {
                self.incendie(b, hyg, rapport);
            }
        }
        // épidémie
        let hopital = self.a_batiment(id, "hopital");
        if hyg < 0.5 && !hopital && self.hasard.p(0.03 * eff.epidemie) && pop > 30.0 {
            let l = (pop * 0.08).ceil() as i64;
            self.royaumes[k].pop = (self.royaumes[k].pop - l).max(1);
            if k == 0 {
                self.evt(rapport, format!("🤒 Épidémie : −{l} habitants (puits, fontaines, Hôtel-Dieu)", l = l as i64 * crate::regles::HOMMES), "guerre", None);
            }
        }
        if self.tour < 6 {
            return;
        }
        let x = self.hasard.f();
        let joueur = k == 0;
        if x < 0.04 && self.a_batiment(id, "ferme") && meteo::saison(meteo::mois(self.tour)) >= 2 {
            let st = &mut self.royaumes[k].stock;
            *st.entry("ble".into()).or_insert(0.0) += 40.0;
            if joueur {
                self.evt(rapport, "🌾 Moisson exceptionnelle : +40 blé".into(), "bon", None);
            }
        } else if x < 0.07 && s.logement > self.royaumes[k].pop {
            let n = 6.min(s.logement - self.royaumes[k].pop);
            self.royaumes[k].pop += n;
            if joueur {
                self.evt(rapport, format!("🧑‍🌾 {n} familles de réfugiés s'installent chez vous"), "bon", None);
            }
        } else if x < 0.09 {
            if let Some((c, g)) = self.decouvrir_gisement(id).filter(|_| joueur) {
                self.evt(rapport, format!("⛏️ Un gisement {g} est découvert !"), "or", Some(c));
            }
        } else if x < 0.11 && !joueur {
            crate::ia::economie::colporteur(self, k);
        } else if x < 0.11 {
            let id = self.id();
            self.propositions.push(crate::partie::Proposition {
                id,
                de: 0,
                genre: "marchand".into(),
                texte: "Un colporteur propose 15 🔨 outils pour 120 🪙.".into(),
                donne: Panier::from([(COLPORTEUR.0.to_string(), COLPORTEUR.1)]),
                demande: Panier::from([("or".to_string(), COLPORTEUR.2)]),
                ..Default::default()
            });
        }
    }

    /// Le feu prend au bâtiment `id` : le veilleur d'une ville éclairée l'éteint une fois sur deux
    /// (`eclairage.incendie`), sinon les puits (hygiène `hyg`) le maîtrisent, ou il part en fumée.
    /// Seuls les incendies du joueur vont à son rapport.
    pub fn incendie(&mut self, id: u32, hyg: f64, rapport: &mut Rapport) {
        let Some(b) = self.bat(id).cloned() else { return };
        let nom = regles().bat(&b.cle).unwrap().nom.clone();
        let veilleur = b.ville.and_then(|vid| self.villes.iter().find(|v| v.id == vid && v.eclairage)).map(|v| v.nom.clone());
        let (texte, genre) = if let Some(ville) = veilleur.filter(|_| self.hasard.p(1.0 - regles().eclairage.incendie)) {
            (format!("🏮 Le veilleur de nuit de {ville} donne l'alerte : le feu est éteint avant de prendre à {nom}."), "bon")
        } else if hyg >= 0.6 {
            (format!("🔥 Un incendie à {nom} est maîtrisé grâce aux puits."), "bon")
        } else {
            let _ = self.demolir(b.case);
            (format!("🔥 Incendie ! {nom} part en fumée."), "guerre")
        };
        if b.proprio == 0 {
            self.evt(rapport, texte, genre, Some(b.case));
        }
    }

    // ------------------------------------------------------------------ victoire
    fn victoire(&mut self, rapport: &mut Rapport) {
        if self.fin.is_some() || self.sans_victoire {
            return;
        }
        let vivants: Vec<&crate::partie::Royaume> = self.royaumes.iter().filter(|r| !r.joueur && r.vivant).collect();
        let cap = self.niveau_capitale(0);
        let gagne = if vivants.is_empty() {
            Some(("Victoire par la conquête", "Tous les royaumes rivaux sont tombés sous votre bannière."))
        } else if cap >= 5 && self.a_batiment(0, "palais") && self.joueur().pop >= 400 {
            Some(("Victoire par la prospérité", "Votre Cité et son Palais royal rayonnent sur le monde."))
        } else if vivants.iter().all(|r| r.statut == "alliance") {
            Some(("Victoire par la diplomatie", "Tous les royaumes sont vos alliés : la paix est faite."))
        } else {
            None
        };
        if let Some((t, x)) = gagne {
            self.fin = Some(Fin { victoire: true, titre: t.into(), texte: x.into() });
            self.evt(rapport, format!("🏆 {t} !"), "or", None);
        } else if meteo::annee(self.tour) >= meteo::ANNEE_FIN && meteo::mois(self.tour) == 11 {
            let rang = self.royaumes.iter().filter(|r| r.vivant && self.puissance(r.id as i32) + self.villes.iter().filter(|v| v.proprio == r.id as i32).count() as f64 * 50.0 > self.puissance(0) + self.villes.iter().filter(|v| v.proprio == 0).count() as f64 * 50.0).count();
            self.fin = Some(Fin {
                victoire: rang == 0,
                titre: "1850 : fin de l'époque".into(),
                texte: if rang == 0 { "Un siècle et demi a passé : votre royaume est le plus puissant du monde.".into() } else { format!("Un siècle et demi a passé : votre royaume se classe {}ᵉ.", rang + 1) },
            });
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;

    #[test]
    fn un_an_de_jeu() {
        let mut p = Partie::nouvelle(Options { graine: 2024, ..Options::default() });
        // le joueur construit l'essentiel
        for cle in ["bucheron", "pecheur", "ferme", "carriere", "scierie", "grenier"] {
            if let Some(c) = (0..p.carte.cases.len()).find(|&c| p.peut_construire(cle, c, 0).is_ok()) {
                p.poser(cle, c, 0, false);
            }
        }
        let avant = p.joueur().stock["bois"];
        for _ in 0..24 {
            let r = p.fin_du_mois();
            assert!(!r.date.is_empty());
        }
        assert_eq!(p.tour, 24 + crate::partie::TOUR_DEPART);
        assert!(p.joueur().pop >= 1);
        assert!(p.batiments.iter().any(|b| b.cle == "bucheron" && b.fini()));
        assert!(p.joueur().stock["bois"] >= 0.0);
        let _ = avant;
        // les IA ont grandi
        assert!(p.batiments.iter().filter(|b| b.proprio != 0).count() > 15);
    }

    #[test]
    fn les_rivaux_explorent_naviguent_et_espionnent() {
        let (mut flottes, mut espions, mut trouve) = (0, 0, 0);
        for g in [1u64, 7, 42, 99] {
            let mut p = Partie::nouvelle(Options { graine: g, rivaux: 5, attitude: "agressifs".into(), ..Options::default() });
            let cap = p.villes[0].case;
            assert!((1..p.royaumes.len()).all(|k| !p.connait(k as i32, cap)), "personne ne connaît le joueur au départ");
            // le joueur ne fait rien : une citadelle et une forte garnison le gardent assez longtemps pour voir les rivaux à l'œuvre
            p.villes[0].fortif = 4;
            let a = p.armees.iter().position(|a| a.proprio == 0).unwrap();
            p.armees[a].unites.insert("grenadier".into(), 80);
            p.royaumes[0].pop = 200;
            for _ in 0..(12 * 25) {
                p.fin_du_mois();
                flottes += p.flottes.iter().filter(|f| f.proprio != 0).count();
                espions += p.espions.iter().filter(|e| e.proprio != 0).count();
                if p.fin.is_some() {
                    break;
                }
            }
            trouve += (1..p.royaumes.len()).filter(|&k| p.connait(k as i32, cap)).count();
        }
        assert!(flottes > 0 && espions > 0 && trouve > 0, "flottes {flottes}, espions {espions}, découvertes {trouve}");
    }

    #[test]
    fn longue_partie_sans_panique() {
        for g in [1u64, 7, 42] {
            let mut p = Partie::nouvelle(Options { graine: g, rivaux: 5, attitude: "agressifs".into(), ..Options::default() });
            for _ in 0..(12 * 30) {
                p.fin_du_mois();
                if p.fin.is_some() {
                    break;
                }
            }
        }
    }
}
