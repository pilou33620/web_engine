//! L'espionnage : des espions recrutés à la taverne, invisibles des autres royaumes, qui marchent
//! vite et, dans une ville étrangère ou à côté, renseignent, volent des plans ou sabotent.

use crate::meteo::Effets;
use crate::partie::{Espion, Partie, Rapport};
use crate::regles::regles;

impl Partie {
    pub fn espion(&self, id: u32) -> Option<usize> {
        self.espions.iter().position(|e| e.id == id)
    }

    /// Chance de réussite d'une mission de `id` contre la ville `vi` : l'Académie aide, les défenses gênent.
    pub fn chance_mission(&self, id: i32, genre: &str, vi: usize) -> f64 {
        let e = &regles().espionnage;
        let base = regles().mission(genre).map_or(0.0, |m| m.chance);
        let academie = if self.a_batiment(id, "academie") { e.academie } else { 0.0 };
        (base + academie - self.defense_ville(vi) * e.defense).clamp(0.05, 0.95)
    }

    /// Les villes étrangères à portée d'un espion (sa case ou une case voisine).
    pub fn villes_a_portee(&self, e: &Espion) -> Vec<usize> {
        (0..self.villes.len()).filter(|&i| self.villes[i].proprio != e.proprio && self.carte.dist(self.villes[i].case, e.case) <= 1).collect()
    }

    pub fn peut_lancer(&self, ei: usize, genre: &str, vi: usize) -> Result<(), String> {
        let e = &self.espions[ei];
        regles().mission(genre).ok_or("mission inconnue")?;
        if e.mission.is_some() {
            return Err("L'espion est déjà en mission".into());
        }
        if !e.chemin.is_empty() {
            return Err("L'espion est encore en route".into());
        }
        if self.villes[vi].proprio == e.proprio {
            return Err("C'est une de vos villes".into());
        }
        if self.carte.dist(self.villes[vi].case, e.case) > 1 {
            return Err("L'espion doit être dans la ville visée ou juste à côté".into());
        }
        Ok(())
    }

    pub fn lancer_mission(&mut self, ei: usize, genre: &str, vi: usize) {
        let duree = regles().mission(genre).map_or(1, |m| m.duree.max(1));
        let vid = self.villes[vi].id;
        let e = &mut self.espions[ei];
        e.mission = Some(genre.into());
        e.ville = Some(vid);
        e.reste = duree;
    }

    /// Le mois des espions : ils marchent (sans combattre), puis leurs missions avancent.
    pub fn espions_mois(&mut self, eff: &Effets, rapport: &mut Rapport) {
        let vitesse = regles().unite("espion").map_or(7.0, |d| d.vitesse);
        let ids: Vec<u32> = self.espions.iter().map(|e| e.id).collect();
        for &id in &ids {
            let Some(i) = self.espion(id) else { continue };
            let mut pts = vitesse * eff.mouvement;
            while pts > 0.05 && !self.espions[i].chemin.is_empty() {
                let s = self.espions[i].chemin.remove(0);
                pts -= self.cout_case(s);
                self.espions[i].case = s;
                let pr = self.espions[i].proprio;
                self.decouvrir(pr, s, regles().vision.espion);
            }
        }
        for id in ids {
            let Some(i) = self.espion(id) else { continue };
            if self.espions[i].mission.is_none() {
                continue;
            }
            if self.espions[i].reste > 1 {
                self.espions[i].reste -= 1;
            } else {
                self.resoudre_mission(i, rapport);
            }
        }
    }

    fn resoudre_mission(&mut self, i: usize, rapport: &mut Rapport) {
        let e = self.espions[i].clone();
        self.espions[i].mission = None;
        self.espions[i].ville = None;
        self.espions[i].reste = 0;
        let genre = e.mission.unwrap_or_default();
        let Some(vi) = self.villes.iter().position(|v| Some(v.id) == e.ville) else { return };
        let cible = self.villes[vi].proprio;
        if cible == e.proprio {
            return;
        }
        if self.hasard.p(self.chance_mission(e.proprio, &genre, vi)) {
            self.reussir_mission(e.proprio, &genre, vi, rapport);
            return;
        }
        let (ville, case) = (self.villes[vi].nom.clone(), self.villes[vi].case);
        let (qui, chez) = (self.nom_royaume(e.proprio), self.nom_royaume(cible));
        if self.hasard.p(regles().espionnage.capture) {
            self.espions.retain(|x| x.id != e.id);
            let rel = regles().espionnage.relation;
            if e.proprio == 0 && cible > 0 && cible != crate::partie::BRIGANDS {
                self.royaumes[cible as usize].relation = (self.royaumes[cible as usize].relation - rel).max(-100.0);
                self.evt(rapport, format!("🕵️ Votre espion est démasqué et pendu à {ville} ! {chez} est furieux (relation −{rel})."), "guerre", Some(case));
            } else if cible == 0 && e.proprio > 0 {
                let r = &mut self.royaumes[e.proprio as usize];
                r.relation = (r.relation - rel / 2.0).max(-100.0);
                self.evt(rapport, format!("🕵️ Un espion de {qui} est démasqué à {ville} et pendu."), "bon", Some(case));
            }
        } else if e.proprio == 0 {
            self.evt(rapport, format!("🕵️ Mission manquée à {ville} : votre espion a dû se cacher."), "info", Some(case));
        }
    }

    /// Les effets d'une mission réussie de `id` contre la ville `vi`.
    pub fn reussir_mission(&mut self, id: i32, genre: &str, vi: usize, rapport: &mut Rapport) {
        let Some(m) = regles().mission(genre) else { return };
        let v = self.villes[vi].clone();
        let cible = v.proprio;
        let qui = self.nom_royaume(id);
        let (auteur, victime) = match genre {
            "renseignement" => {
                let fin = self.tour + m.mois;
                self.royaumes[id as usize].revele.push([v.case as u32, m.rayon as u32, fin]);
                self.decouvrir(id, v.case, m.rayon);
                (format!("🔎 Renseignements sur {} : la région vous est révélée pour {} mois, armées comprises.", v.nom, m.mois), format!("🕵️ Un espion de {qui} a relevé les plans de {}.", v.nom))
            }
            "vol" => {
                let a_voler: Vec<String> = self.royaumes.get(cible as usize).map(|r| r.techs.iter().filter(|t| !self.a_tech(id, t)).cloned().collect()).unwrap_or_default();
                let texte = if let Some(t) = self.hasard.choix(&a_voler).cloned() {
                    let r = &mut self.royaumes[id as usize];
                    r.techs.push(t.clone());
                    if r.recherche.as_deref() == Some(t.as_str()) {
                        r.recherche = None;
                    }
                    format!("📜 Vos espions dérobent à {} les secrets de « {} » !", v.nom, regles().tech(&t).map(|x| x.nom.as_str()).unwrap_or(&t))
                } else {
                    self.royaumes[id as usize].savoir += m.savoir;
                    format!("📜 Vos espions rapportent de {} des mémoires utiles (+{} savoir).", v.nom, m.savoir)
                };
                (texte, format!("🕵️ Un espion de {qui} a volé des plans à {}.", v.nom))
            }
            _ => {
                let mut cand: Vec<u32> = self.batiments.iter().filter(|b| b.proprio == cible && b.ville == Some(v.id) && b.fini() && b.cle != "hotel").map(|b| b.id).collect();
                // l'ordinateur sabote d'abord ce qui arme la place : arsenal, caserne, haras
                let armes: Vec<u32> = cand.iter().copied().filter(|&b| self.bat(b).is_some_and(|x| matches!(x.cle.as_str(), "arsenal" | "caserne" | "haras"))).collect();
                if id > 0 && !armes.is_empty() {
                    cand = armes;
                }
                let Some(&bid) = self.hasard.choix(&cand) else { return };
                let b = self.bat(bid).cloned().unwrap();
                let nom = regles().bat(&b.cle).map(|d| d.nom.clone()).unwrap_or_default();
                if self.hasard.p(m.incendie) {
                    let _ = self.demolir(b.case);
                    (format!("🔥 Vos saboteurs incendient {nom} à {} !", v.nom), format!("🔥 Un saboteur de {qui} incendie {nom} à {} !", v.nom))
                } else {
                    let fin = self.tour + m.mois;
                    if let Some(x) = self.batiments.iter_mut().find(|x| x.id == bid) {
                        x.arret = fin;
                    }
                    (format!("💣 Sabotage réussi : {nom} de {} est arrêté pour {} mois.", v.nom, m.mois), format!("💣 Un saboteur de {qui} a mis {nom} hors d'usage à {} pour {} mois.", v.nom, m.mois))
                }
            }
        };
        if id == 0 {
            self.evt(rapport, auteur, "bon", Some(v.case));
        }
        if cible == 0 {
            self.evt(rapport, victime, "guerre", Some(v.case));
        }
    }

    /// Un espion étranger est repéré s'il passe, sur une case visible, à côté d'une ville ou d'une armée de `par`.
    pub fn detecte(&self, e: &Espion, par: i32, vision: &[u8]) -> bool {
        vision.get(e.case) == Some(&1)
            && (self.villes.iter().any(|v| v.proprio == par && self.carte.dist(v.case, e.case) <= 1) || self.armees.iter().any(|a| a.proprio == par && self.carte.dist(a.case, e.case) <= 1))
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;

    #[test]
    fn missions_d_espion() {
        let mut p = Partie::nouvelle(Options { graine: 8, ..Options::default() });
        let cap = p.villes[0].case;
        p.recruter_dans(0, "espion", cap);
        assert_eq!(p.espions.len(), 1);
        assert!(p.armees.iter().filter(|a| a.proprio == 0).count() == 1, "l'espion n'est pas un soldat");
        // trop loin de la ville rivale
        let vi = p.villes.iter().position(|v| v.proprio == 1).unwrap();
        assert!(p.peut_lancer(0, "vol", vi).is_err());
        assert!(p.peut_lancer(0, "vol", 0).is_err(), "pas chez soi");
        p.espions[0].case = p.villes[vi].case;
        assert!(p.peut_lancer(0, "voler", vi).is_err());
        assert!(p.peut_lancer(0, "renseignement", vi).is_ok());
        let c = p.chance_mission(0, "renseignement", vi);
        assert!(c > 0.05 && c < 0.95);
        p.lancer_mission(0, "renseignement", vi);
        let r = p.fin_du_mois();
        // réussite, échec ou capture : la mission est close
        assert!(p.espions.iter().filter(|e| e.proprio == 0).all(|e| e.mission.is_none()));
        let reussi = !p.royaumes[0].revele.is_empty();
        if reussi {
            assert!(p.connait(0, p.villes[vi].case));
            assert!(p.vision(0)[p.villes[vi].case] == 1, "la ville espionnée est visible");
        } else {
            assert!(r.evenements.iter().any(|e| e.texte.contains("espion")));
        }
    }

    #[test]
    fn vol_et_sabotage() {
        let mut p = Partie::nouvelle(Options { graine: 8, ..Options::default() });
        let vi = p.villes.iter().position(|v| v.proprio == 1).unwrap();
        p.royaumes[1].techs = vec!["vauban".into()];
        let mut r = Rapport::default();
        p.reussir_mission(0, "vol", vi, &mut r);
        assert!(p.a_tech(0, "vauban"), "la technologie est volée");
        p.reussir_mission(0, "vol", vi, &mut r);
        assert!(p.joueur().savoir >= 80.0, "rien à voler : une avance de recherche");
        // un espion rival sabote une ville du joueur
        let n = p.batiments.iter().filter(|b| b.proprio == 0).count();
        p.reussir_mission(1, "sabotage", 0, &mut r);
        let arrete = p.batiments.iter().any(|b| b.proprio == 0 && b.arret > p.tour);
        assert!(arrete || p.batiments.iter().filter(|b| b.proprio == 0).count() < n, "un bâtiment arrêté ou incendié");
        assert!(r.evenements.iter().any(|e| e.texte.contains("saboteur")), "le joueur est prévenu");
    }
}
