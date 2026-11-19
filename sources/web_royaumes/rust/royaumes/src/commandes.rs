//! Les ordres du joueur pendant le mois (POST /api/cmd) : construire, recruter, déplacer,
//! commercer, négocier, rechercher… Chaque ordre est vérifié ici : le navigateur ne décide de rien.

use std::collections::BTreeMap;

use serde_json::{json, Value};

use crate::ia;
use crate::partie::{Partie, Rapport, Royaume, BRIGANDS};
use crate::regles::{regles, DefFort, DefFortif, DefNiveau, DefTech, Panier};

fn txt<'a>(c: &'a Value, k: &str) -> Result<&'a str, String> {
    c.get(k).and_then(Value::as_str).ok_or_else(|| format!("paramètre « {k} » manquant"))
}
fn num(c: &Value, k: &str) -> Result<i64, String> {
    c.get(k).and_then(Value::as_i64).ok_or_else(|| format!("paramètre « {k} » manquant"))
}
fn case(p: &Partie, c: &Value) -> Result<usize, String> {
    let i = num(c, "case")?;
    if i < 0 || i as usize >= p.carte.cases.len() {
        return Err("case hors de la carte".into());
    }
    Ok(i as usize)
}
fn royaume(p: &Partie, c: &Value) -> Result<usize, String> {
    let k = num(c, "royaume")?;
    if k <= 0 || k as usize >= p.royaumes.len() {
        return Err("royaume inconnu".into());
    }
    if !p.royaumes[k as usize].vivant {
        return Err("ce royaume n'existe plus".into());
    }
    Ok(k as usize)
}

fn armee(p: &Partie, c: &Value) -> Result<usize, String> {
    let id = num(c, "armee")? as u32;
    p.armee(id).filter(|&i| p.armees[i].proprio == 0).ok_or_else(|| "armée inconnue".into())
}
fn flotte(p: &Partie, c: &Value) -> Result<usize, String> {
    let id = num(c, "flotte")? as u32;
    p.flotte(id).filter(|&i| p.flottes[i].proprio == 0).ok_or_else(|| "flotte inconnue".into())
}
fn espion(p: &Partie, c: &Value) -> Result<usize, String> {
    let id = num(c, "espion")? as u32;
    p.espion(id).filter(|&i| p.espions[i].proprio == 0).ok_or_else(|| "espion inconnu".into())
}

fn ok(msg: impl Into<String>) -> Result<Value, String> {
    Ok(json!({"ok": true, "msg": msg.into()}))
}

pub fn executer(p: &mut Partie, c: &Value) -> Result<Value, String> {
    // lecture seule : les cases où l'on peut poser un bâtiment (surbrillance du mode construction)
    if c.get("action").and_then(Value::as_str) == Some("cases_valides") {
        let cle = txt(c, "cle")?;
        let v: Vec<usize> = (0..p.carte.cases.len()).filter(|&i| p.connait(0, i) && p.peut_construire(cle, i, 0).is_ok()).collect();
        return Ok(json!({"ok": true, "cases": v}));
    }
    if p.fin.is_some() && !p.sans_victoire {
        if txt(c, "action")? == "continuer" && p.fin.as_ref().is_some_and(|f| f.victoire) {
            p.sans_victoire = true;
            return ok("La partie continue.");
        }
        return Err("La partie est terminée".into());
    }
    let rg = regles();
    match txt(c, "action")? {
        "construire" => {
            let cle = txt(c, "cle")?;
            let i = case(p, c)?;
            let id = p.construire(0, cle, i)?;
            let d = rg.bat(cle).unwrap();
            Ok(json!({"ok": true, "msg": format!("{} {} : travaux lancés ({} mois)", d.icone, d.nom, d.duree.max(1)), "id": id}))
        }
        "demolir" => {
            let i = case(p, c)?;
            let bid = p.carte.cases[i].bat.ok_or("Rien à démolir")?;
            if p.bat(bid).map(|b| b.proprio) != Some(0) {
                return Err("Ce bâtiment ne vous appartient pas".into());
            }
            p.demolir(i)?;
            p.recalculer_routes();
            ok("Démoli (la moitié des matériaux est récupérée)")
        }
        "pause" => {
            let id = num(c, "batiment")? as u32;
            ok(if p.pause(0, id)? { "En pause" } else { "Reprise" })
        }
        "recruter" => {
            let id = num(c, "batiment")? as u32;
            let u = txt(c, "unite")?;
            p.recruter(0, id, u)?;
            let du = rg.unite(u).unwrap();
            ok(format!("{} {} : en formation", du.icone, du.nom))
        }
        "ameliorer" => {
            let vid = num(c, "ville")? as u32;
            let vi = p.villes.iter().position(|v| v.id == vid && v.proprio == 0).ok_or("ville inconnue")?;
            let def = p.ameliorer_ville(0, vi)?;
            ok(format!("🎉 {} devient un(e) {} !", p.villes[vi].nom, def.nom))
        }
        "fortifier" => {
            let vid = num(c, "ville")? as u32;
            let vi = p.villes.iter().position(|v| v.id == vid).ok_or("ville inconnue")?;
            let f = p.fortifier(0, vi)?;
            Ok(json!({"ok": true, "msg": format!("{} {} : {} en travaux ({} mois)", f.icone, p.villes[vi].nom, f.nom, f.duree.max(1)), "mois": f.duree.max(1)}))
        }
        // {"action": "eclairer", "ville": id, "actif": true|false} : allume ou éteint l'éclairage public (payé chaque mois)
        "eclairer" => {
            let vid = num(c, "ville")? as u32;
            let vi = p.villes.iter().position(|v| v.id == vid).ok_or("ville inconnue")?;
            let actif = c.get("actif").and_then(Value::as_bool).unwrap_or(true);
            p.eclairer(0, vi, actif)?;
            let l = &rg.eclairage;
            ok(if actif { format!("🏮 {} : réverbères allumés, un veilleur fait sa ronde ({} 🪙 par mois)", p.villes[vi].nom, l.entretien) } else { format!("{} : éclairage public éteint", p.villes[vi].nom) })
        }
        "deplacer" => {
            let id = num(c, "armee")? as u32;
            let vers = case(p, c)?;
            let ai = p.armee(id).filter(|&i| p.armees[i].proprio == 0).ok_or("armée inconnue")?;
            if let Some(vi) = p.ville_a(vers) {
                let pr = p.villes[vi].proprio;
                if pr != 0 && pr != BRIGANDS && p.royaumes[pr as usize].statut != "guerre" {
                    if c.get("confirme").and_then(Value::as_bool) != Some(true) {
                        return Ok(json!({"ok": false, "confirmer": format!("Attaquer {} revient à déclarer la guerre à {}. Continuer ?", p.villes[vi].nom, p.royaumes[pr as usize].nom)}));
                    }
                    let mut r = Rapport::default();
                    ia::declarer_guerre(p, pr as usize, true, &mut r);
                }
            }
            let depart = p.armees[ai].case;
            if depart == vers && p.praticable(vers) {
                p.armees[ai].chemin.clear();
                return ok("L'armée reste sur place");
            }
            let ch = p.chemin(depart, vers).ok_or_else(|| {
                if p.carte.cases[vers].terre() { "Destination inaccessible à pied (embarquez l'armée sur une flotte)".to_string() } else { "Une armée ne marche pas sur l'eau : embarquez-la sur des flûtes au port".to_string() }
            })?;
            let mois = p.mois_trajet(&p.armees[ai], &ch);
            p.armees[ai].chemin = ch.clone();
            Ok(json!({"ok": true, "msg": format!("🚩 En route : {} cases, environ {} mois", ch.len(), mois), "chemin": ch, "mois": mois}))
        }
        // ---------------------------------------------------------------- retranchements et forts
        "retrancher" => {
            let ai = armee(p, c)?;
            p.peut_retrancher(&p.armees[ai])?;
            let r = &rg.retranchement;
            let n = r.duree.max(1);
            p.armees[ai].retranche = Some(n);
            let x = format!("{}", r.defense).replace('.', ",");
            Ok(json!({"ok": true, "msg": format!("⛏️ L'armée se retranche : prête dans {n} mois (défense ×{x} tant qu'elle ne bouge pas)"), "mois": n}))
        }
        "construire_fort" => {
            let ai = armee(p, c)?;
            let (id, d) = p.construire_fort(0, ai)?;
            let n = d.duree.max(1);
            Ok(json!({"ok": true, "msg": format!("{} {} : chantier ouvert ({n} mois, tant qu'une armée garde la case)", d.icone, d.nom), "fort": id, "mois": n}))
        }
        "ameliorer_fort" => {
            let id = num(c, "fort")? as u32;
            let fi = p.fort(id).ok_or("fort inconnu")?;
            let d = p.ameliorer_fort(0, fi)?;
            let n = d.duree.max(1);
            Ok(json!({"ok": true, "msg": format!("{} {} : {} en travaux ({n} mois, tant qu'une armée garde la case)", d.icone, crate::forts::majuscule(&p.nom_fort(p.forts[fi].case)), d.nom), "mois": n}))
        }
        "halte" => {
            let id = num(c, "armee")? as u32;
            let ai = p.armee(id).filter(|&i| p.armees[i].proprio == 0).ok_or("armée inconnue")?;
            if !p.praticable(p.armees[ai].case) {
                return Err("L'armée débarque : elle ne peut s'arrêter sur l'eau".into());
            }
            p.armees[ai].chemin.clear();
            ok("Halte !")
        }
        "diviser" => {
            let id = num(c, "armee")? as u32;
            let ai = p.armee(id).filter(|&i| p.armees[i].proprio == 0).ok_or("armée inconnue")?;
            if !p.praticable(p.armees[ai].case) {
                return Err("L'armée débarque : attendez qu'elle touche terre".into());
            }
            let demande = c.get("unites").and_then(Value::as_object).ok_or("paramètre « unites » manquant")?;
            let mut part = BTreeMap::new();
            for (u, n) in demande {
                let n = n.as_u64().unwrap_or(0) as u32;
                let dispo = p.armees[ai].unites.get(u).copied().unwrap_or(0);
                if n > 0 {
                    part.insert(u.clone(), n.min(dispo));
                }
            }
            let total: u32 = part.values().sum();
            if total == 0 || total >= p.armees[ai].effectif() {
                return Err("Choisissez une partie de l'armée".into());
            }
            for (u, n) in &part {
                let x = p.armees[ai].unites.get_mut(u).unwrap();
                *x -= n;
            }
            p.armees[ai].unites.retain(|_, n| *n > 0);
            let case = p.armees[ai].case;
            let nid = p.creer_armee(0, case, part);
            Ok(json!({"ok": true, "msg": "Nouvelle armée formée", "armee": nid}))
        }
        "ameliorer_routes" => {
            let cible = p.ameliorer_routes(0)?;
            ok(if cible == 2 { "🛤️ Vos chemins sont pavés !" } else { "🛤️ Routes royales : larges, empierrées, bordées d'arbres !" })
        }
        "impots" => {
            let n = txt(c, "niveau")?;
            if !["bas", "normal", "eleve"].contains(&n) {
                return Err("niveau inconnu".into());
            }
            p.royaumes[0].impots = n.into();
            ok("Taux d'imposition modifié")
        }
        "rechercher" => {
            let d = p.rechercher(0, txt(c, "tech")?)?;
            ok(format!("💡 Recherche : {}", d.nom))
        }
        "diplo" => {
            let k = royaume(p, c)?;
            diplomatie(p, k, txt(c, "acte")?, c)
        }
        "echanger" => {
            let k = royaume(p, c)?;
            let r = txt(c, "ressource")?;
            let achat = c.get("achat").and_then(Value::as_bool).unwrap_or(true);
            echanger(p, k, r, achat)
        }
        "repondre" => {
            let id = num(c, "proposition")? as u32;
            let oui = c.get("accepte").and_then(Value::as_bool).unwrap_or(false);
            repondre(p, id, oui)
        }
        "choisir" => {
            let id = num(c, "evenement")? as u32;
            let o = usize::try_from(num(c, "option")?).map_err(|_| "option inconnue")?;
            ok(p.choisir(id, o)?)
        }
        // ---------------------------------------------------------------- marine
        "deplacer_flotte" => {
            let fi = flotte(p, c)?;
            let vers = case(p, c)?;
            if p.carte.cases[vers].terre() {
                return Err("Une flotte navigue sur l'eau : choisissez une case de mer".into());
            }
            if p.flottes[fi].case == vers {
                p.flottes[fi].chemin.clear();
                return ok("La flotte reste au mouillage");
            }
            let ch = p.chemin_mer(p.flottes[fi].case, vers).ok_or("Aucune route maritime jusque-là")?;
            p.flottes[fi].chemin = ch.clone();
            p.flottes[fi].commerce = false;
            let mois = p.mois_navigation(&p.flottes[fi]);
            Ok(json!({"ok": true, "msg": format!("⛵ Cap sur la destination : {} cases, environ {} mois", ch.len(), mois), "chemin": ch, "mois": mois}))
        }
        "embarquer" => {
            let fi = flotte(p, c)?;
            let ai = armee(p, c)?;
            p.peut_embarquer(fi, ai)?;
            let n = p.armees[ai].effectif();
            p.embarquer(fi, ai);
            ok(format!("⛵ {n} soldats embarquent"))
        }
        "debarquer" => {
            let fi = flotte(p, c)?;
            let vers = case(p, c)?;
            p.peut_debarquer(fi, vers)?;
            let id = p.debarquer(fi, vers);
            Ok(json!({"ok": true, "msg": "⚓ L'armée débarque : elle touche terre à la fin du mois", "armee": id}))
        }
        "commerce_flotte" => {
            let fi = flotte(p, c)?;
            let actif = c.get("actif").and_then(Value::as_bool).unwrap_or(true);
            if actif {
                let f = &p.flottes[fi];
                if p.flutes(f) == 0 {
                    return Err("Il faut des flûtes marchandes pour commercer".into());
                }
                if f.armee.is_some() {
                    return Err("La flotte transporte une armée".into());
                }
                if p.port_voisin(f).is_none() {
                    return Err("La flotte doit être à quai, à côté d'un de vos ports".into());
                }
                p.flottes[fi].chemin.clear();
            }
            p.flottes[fi].commerce = actif;
            ok(if actif { format!("⚖️ Les flûtes commercent : environ {} 🪙 par mois par mer en tout", p.commerce_maritime(0)) } else { "Les flûtes cessent le commerce".into() })
        }
        // ---------------------------------------------------------------- espionnage
        "deplacer_espion" => {
            let ei = espion(p, c)?;
            let vers = case(p, c)?;
            if p.espions[ei].mission.is_some() {
                return Err("L'espion est en mission".into());
            }
            if p.espions[ei].case == vers {
                p.espions[ei].chemin.clear();
                return ok("L'espion reste où il est");
            }
            let ch = p.chemin(p.espions[ei].case, vers).ok_or("Destination inaccessible à pied")?;
            let cout: f64 = ch.iter().map(|&x| p.cout_case(x)).sum();
            let mois = (cout / rg.unite("espion").map_or(7.0, |d| d.vitesse)).ceil().max(1.0);
            p.espions[ei].chemin = ch.clone();
            Ok(json!({"ok": true, "msg": format!("🕵️ L'espion part : environ {mois} mois"), "chemin": ch, "mois": mois}))
        }
        "mission" => {
            let ei = espion(p, c)?;
            let genre = txt(c, "genre")?;
            let vid = num(c, "ville")? as u32;
            let vi = p.villes.iter().position(|v| v.id == vid).ok_or("ville inconnue")?;
            p.peut_lancer(ei, genre, vi)?;
            let chance = (p.chance_mission(0, genre, vi) * 100.0).round();
            p.lancer_mission(ei, genre, vi);
            let m = rg.mission(genre).unwrap();
            ok(format!("{} {} à {} : {} mois, environ {chance} % de réussite", m.icone, m.nom, p.villes[vi].nom, m.duree.max(1)))
        }
        // ---------------------------------------------------------------- sièges
        "assaut" => {
            // une ville, ou un fort (`fort` : son identifiant)
            let vid = num(c, "ville").or_else(|_| num(c, "fort"))? as u32;
            let si = p.siege_de(vid).filter(|&i| p.sieges[i].assiegeant == 0).ok_or("Vous n'assiégez pas cette ville")?;
            p.sieges[si].assaut = true;
            let (at, de) = p.forces_assaut(&p.sieges[si], p.meteo.effets(p.tour).tir);
            ok(format!("⚔️ L'assaut sera donné à la fin du mois : vos forces {at:.0} contre {de:.0}"))
        }
        autre => Err(format!("ordre inconnu : {autre}")),
    }
}

/// Ce que coûte une recrue à `id` (la levée en masse rend les soldats moins chers, pas les navires ni les espions).
pub fn cout_recrue(p: &Partie, id: i32, u: &str) -> Panier {
    let Some(du) = regles().unite(u) else { return Panier::new() };
    let mut cout = du.cout.clone();
    if p.a_tech(id, "levee_masse") && du.genre != "marine" && du.genre != "espion" {
        if let Some(o) = cout.get_mut("or") {
            *o = (*o * 0.75).round();
        }
    }
    cout
}

/// Les ordres d'un royaume, avec leurs contrôles et leur paiement dans ses réserves : le joueur les donne par
/// `executer`, l'ordinateur les appelle directement (ia/) : mêmes règles pour tous.
impl Partie {
    /// Un chantier de `cle` sur `case` : rang de la capitale, technologie, terre connue, emplacement, coût, colons.
    pub fn construire(&mut self, id: i32, cle: &str, case: usize) -> Result<u32, String> {
        let rg = regles();
        let d = rg.bat(cle).ok_or("bâtiment inconnu")?;
        if d.cat == "aucune" {
            return Err("ce bâtiment ne se construit pas".into());
        }
        if d.niveau > self.niveau_capitale(id) {
            return Err(format!("Il faut une capitale au rang {}", rg.nom_niveau(d.niveau)));
        }
        if let Some(t) = &d.tech {
            if !self.a_tech(id, t) {
                return Err(format!("Il faut la technologie « {} »", rg.tech(t).map(|x| x.nom.as_str()).unwrap_or(t)));
            }
        }
        if !self.connait(id, case) {
            return Err("Terre inconnue : explorez-la d'abord".into());
        }
        self.peut_construire(cle, case, id)?;
        if !self.peut_payer(id, &d.cout) {
            return Err("Ressources insuffisantes".into());
        }
        let s = self.stats(id);
        if d.colons > 0 && self.royaumes[id as usize].pop - s.soldats < d.colons as i64 + 6 {
            return Err("Pas assez d'habitants disponibles pour partir coloniser".into());
        }
        self.payer(id, &d.cout);
        self.royaumes[id as usize].pop -= d.colons as i64;
        Ok(self.poser(cle, case, id, false))
    }

    /// Met en pause (ou relance) un bâtiment de `id` ; rend vrai s'il est désormais en pause.
    pub fn pause(&mut self, id: i32, bid: u32) -> Result<bool, String> {
        let b = self.batiments.iter_mut().find(|b| b.id == bid && b.proprio == id).ok_or("bâtiment inconnu")?;
        b.pause = !b.pause;
        Ok(b.pause)
    }

    /// Met une recrue en formation dans le bâtiment `bid` : unité permise, coût payé, assez d'habitants.
    pub fn recruter(&mut self, id: i32, bid: u32, u: &str) -> Result<(), String> {
        let b = self.batiments.iter().find(|b| b.id == bid && b.proprio == id && b.fini()).ok_or("bâtiment inconnu")?;
        if !self.unites_dispo(id, &b.cle).iter().any(|x| x == u) {
            return Err("Unité indisponible ici".into());
        }
        let cout = cout_recrue(self, id, u);
        if !self.peut_payer(id, &cout) {
            return Err("Ressources insuffisantes".into());
        }
        let s = self.stats(id);
        let en_file: usize = self.batiments.iter().filter(|b| b.proprio == id).map(|b| b.file.len()).sum();
        if self.royaumes[id as usize].pop - s.soldats - (en_file as i64) < 6 {
            return Err("Pas assez d'habitants disponibles".into());
        }
        self.payer(id, &cout);
        self.batiments.iter_mut().find(|x| x.id == bid).unwrap().file.push(u.into());
        Ok(())
    }

    /// La ville `vi` de `id` monte d'un rang : pas au-delà de la capitale, assez d'habitants, coût payé.
    pub fn ameliorer_ville(&mut self, id: i32, vi: usize) -> Result<&'static DefNiveau, String> {
        if self.villes[vi].proprio != id {
            return Err("ville inconnue".into());
        }
        let n = self.villes[vi].niveau + 1;
        let def = regles().niveau(n).ok_or("Rang maximal atteint")?;
        if !self.villes[vi].capitale && n > self.niveau_capitale(id) {
            return Err("Une ville ne peut dépasser le rang de la capitale".into());
        }
        if self.royaumes[id as usize].pop < def.pop {
            return Err(format!("Il faut {} habitants", def.pop));
        }
        if !self.peut_payer(id, &def.cout) {
            return Err("Ressources insuffisantes".into());
        }
        self.payer(id, &def.cout);
        self.villes[vi].niveau = n;
        self.recalculer_territoire();
        Ok(def)
    }

    /// La ville `vi` de `id` passe en travaux de fortification (niveau suivant).
    pub fn fortifier(&mut self, id: i32, vi: usize) -> Result<&'static DefFortif, String> {
        if self.villes[vi].proprio != id {
            return Err("Cette ville ne vous appartient pas".into());
        }
        let f = self.peut_fortifier(vi)?;
        if !self.peut_payer(id, &f.cout) {
            return Err("Ressources insuffisantes".into());
        }
        self.payer(id, &f.cout);
        self.villes[vi].travaux_fortif = f.duree.max(1);
        Ok(f)
    }

    /// Allume (si c'est permis) ou éteint l'éclairage public de la ville `vi` de `id`.
    pub fn eclairer(&mut self, id: i32, vi: usize, actif: bool) -> Result<(), String> {
        if self.villes[vi].proprio != id {
            return Err("Cette ville ne vous appartient pas".into());
        }
        if actif {
            self.peut_eclairer(vi)?;
        }
        self.villes[vi].eclairage = actif;
        Ok(())
    }

    /// `id` se met à chercher la technologie `t` (pas avant son année).
    pub fn rechercher(&mut self, id: i32, t: &str) -> Result<&'static DefTech, String> {
        let d = regles().tech(t).ok_or("technologie inconnue")?;
        if self.a_tech(id, t) {
            return Err("Déjà découverte".into());
        }
        if self.annee() < d.annee {
            return Err(format!("Pas avant {}", d.annee));
        }
        self.royaumes[id as usize].recherche = Some(t.into());
        Ok(d)
    }

    /// Les routes de `id` passent au niveau suivant ; rend ce niveau.
    pub fn ameliorer_routes(&mut self, id: i32) -> Result<u8, String> {
        let n = self.niveau_routes(id);
        if n >= 3 {
            return Err("Vos routes sont déjà des routes royales".into());
        }
        let cible = n + 1;
        if cible == 2 && self.niveau_capitale(id) < 2 {
            return Err("Il faut une capitale au rang Village".into());
        }
        if cible == 3 && !self.a_tech(id, "routes") {
            return Err("Il faut la technologie « Routes royales et canaux »".into());
        }
        let cout = self.cout_routes(id, cible);
        if !self.peut_payer(id, &cout) {
            return Err("Ressources insuffisantes".into());
        }
        self.payer(id, &cout);
        self.royaumes[id as usize].niveau_routes = cible as u32;
        self.recalculer_routes();
        Ok(cible)
    }

    /// L'armée `ai` de `id` ouvre le chantier d'un fort sur sa case ; rend le fort et son niveau.
    pub fn construire_fort(&mut self, id: i32, ai: usize) -> Result<(u32, &'static DefFort), String> {
        if self.armees[ai].proprio != id {
            return Err("armée inconnue".into());
        }
        let d = self.peut_construire_fort(&self.armees[ai])?;
        if !self.peut_payer(id, &d.cout) {
            return Err("Ressources insuffisantes".into());
        }
        self.payer(id, &d.cout);
        Ok((self.poser_fort(id, self.armees[ai].case, d.duree.max(1)), d))
    }

    /// Le fort `fi` de `id` passe en travaux (niveau suivant).
    pub fn ameliorer_fort(&mut self, id: i32, fi: usize) -> Result<&'static DefFort, String> {
        if self.forts[fi].proprio != id {
            return Err("Ce fort ne vous appartient pas".into());
        }
        let d = self.peut_ameliorer_fort(fi)?;
        if !self.peut_payer(id, &d.cout) {
            return Err("Ressources insuffisantes".into());
        }
        self.payer(id, &d.cout);
        self.forts[fi].travaux = d.duree.max(1);
        Ok(d)
    }

    /// Un lot de 10 `r` passe du `vendeur` à l'`acheteur` pour `px` or. Le vendeur de l'ordinateur garde
    /// ce dont il a besoin (`ia::economie::reserve`) ; l'acheteur doit avoir l'or et la place.
    pub fn lot(&mut self, acheteur: usize, vendeur: usize, r: &str, px: f64) -> Result<(), String> {
        let rg = regles();
        let nom = |k: usize| self.royaumes[k].nom.clone();
        let s = self.stats(acheteur as i32);
        let (sa, sv) = (&self.royaumes[acheteur].stock, &self.royaumes[vendeur].stock);
        if sa.get("or").copied().unwrap_or(0.0) < px {
            return Err(if acheteur == 0 { "Pas assez d'or".into() } else { format!("{} n'a pas assez d'or", nom(acheteur)) });
        }
        if sa.get(r).copied().unwrap_or(0.0) + 10.0 > self.capacite(&s, r) {
            return Err(if acheteur == 0 { "Stock plein".into() } else { format!("{} n'a plus de place pour en stocker", nom(acheteur)) });
        }
        let garde = if vendeur == 0 { 0.0 } else { crate::ia::economie::reserve(self, vendeur, r) };
        if sv.get(r).copied().unwrap_or(0.0) < 10.0 + garde {
            return Err(if vendeur == 0 { format!("Pas assez de {}", rg.res_nom(r)) } else { format!("{} n'a pas de {} à vendre", nom(vendeur), rg.res_nom(r)) });
        }
        for (k, signe) in [(acheteur, 1.0), (vendeur, -1.0)] {
            let st = &mut self.royaumes[k].stock;
            *st.entry(r.into()).or_insert(0.0) += 10.0 * signe;
            *st.entry("or".into()).or_insert(0.0) -= px * signe;
        }
        Ok(())
    }
}

/// Le prix d'un lot de 10 `r` chez le rival `k` (`achat` : quand on le lui achète) : ses surplus sont bon marché,
/// ce qu'il demande est cher, et une bonne relation avec le joueur adoucit le prix.
pub fn prix(p: &Partie, k: usize, r: &str, achat: bool) -> f64 {
    tarif(&p.royaumes[k], r, achat, p.royaumes[k].relation)
}

/// Le prix d'un lot chez `f`, selon ses surplus et sa demande, et une `relation` avec l'autre partie.
pub fn tarif(f: &Royaume, r: &str, achat: bool, relation: f64) -> f64 {
    let base = regles().prix.get(r).copied().unwrap_or(1.0);
    let m = if f.surplus.iter().any(|x| x == r) {
        0.6
    } else if f.demande.iter().any(|x| x == r) {
        1.7
    } else {
        1.0
    };
    let rel = 1.0 - relation.clamp(-50.0, 100.0) / 500.0;
    if achat {
        (base * 10.0 * m * 1.3 * rel).ceil()
    } else {
        (base * 10.0 * m * 0.75 / rel).floor().max(1.0)
    }
}

fn echanger(p: &mut Partie, k: usize, r: &str, achat: bool) -> Result<Value, String> {
    if !regles().prix.contains_key(r) {
        return Err("marchandise inconnue".into());
    }
    let s = p.stats(0);
    if !s.comptoir && !s.port {
        return Err("Il faut un Comptoir de commerce ou un Port".into());
    }
    if p.royaumes[k].statut == "guerre" {
        return Err("On ne commerce pas avec l'ennemi".into());
    }
    let px = prix(p, k, r, achat);
    if achat {
        p.lot(0, k, r, px)?;
    } else {
        p.lot(k, 0, r, px)?;
    }
    p.royaumes[k].relation = (p.royaumes[k].relation + 0.5).min(100.0);
    ok(if achat { format!("Acheté 10 {} pour {px} 🪙", regles().res_nom(r)) } else { format!("Vendu 10 {} pour {px} 🪙", regles().res_nom(r)) })
}

/// {"action": "diplo", "royaume": k, "acte": …} : cadeau, guerre, paix, paix_ville (exiger une ville),
/// paix_or (exiger des réparations), alliance, rompre (l'alliance), route, tribut,
/// aide (demander à un allié d'entrer en guerre, avec "contre": royaume).
fn diplomatie(p: &mut Partie, k: usize, acte: &str, c: &Value) -> Result<Value, String> {
    let nom = p.royaumes[k].nom.clone();
    let mut r = Rapport::default();
    let res = match acte {
        "cadeau" => {
            if p.royaumes[0].stock["or"] < 100.0 {
                return Err("Il faut 100 🪙".into());
            }
            *p.royaumes[0].stock.get_mut("or").unwrap() -= 100.0;
            let f = &mut p.royaumes[k];
            *f.stock.entry("or".into()).or_insert(0.0) += 100.0;
            let g = (14.0 - f.cadeaux as f64 * 2.0).max(3.0);
            f.cadeaux += 1;
            f.relation += g;
            // un présent laisse aussi un souvenir, qui s'efface en quelques années
            ia::diplomatie::souvenir(p, k, 0, "cadeau", 4.0, "");
            format!("🎁 {nom} apprécie votre présent (+{g:.0})")
        }
        "guerre" => {
            if p.royaumes[k].statut == "guerre" {
                return Err("Déjà en guerre".into());
            }
            ia::declarer_guerre(p, k, true, &mut r);
            format!("⚔️ Guerre déclarée à {nom}")
        }
        "paix" | "paix_ville" | "paix_or" => ia::diplomatie::negocier_paix(p, k, acte)?,
        "alliance" => ia::diplomatie::alliance_proposee(p, k)?,
        "rompre" => ia::diplomatie::rompre(p, k)?,
        "aide" => {
            let x = usize::try_from(num(c, "contre")?).map_err(|_| "royaume inconnu")?;
            ia::diplomatie::aide_demandee(p, k, x)?
        }
        "route" => {
            let s = p.stats(0);
            if !s.comptoir && !s.port {
                return Err("Il faut un Comptoir de commerce ou un Port".into());
            }
            let f = &p.royaumes[k];
            if f.statut == "guerre" || f.commerce {
                return Err("Route impossible".into());
            }
            if f.relation < 0.0 {
                return Err(format!("{nom} refuse : relation insuffisante (≥ 0)"));
            }
            if p.royaumes[0].stock["or"] < 150.0 {
                return Err("Il faut 150 🪙".into());
            }
            *p.royaumes[0].stock.get_mut("or").unwrap() -= 150.0;
            p.royaumes[k].commerce = true;
            p.royaumes[k].relation += 5.0;
            format!("🛤️ Route commerciale ouverte avec {nom}")
        }
        "tribut" => {
            if p.puissance(0) > p.puissance(k as i32) * 1.5 {
                let tresor = p.royaumes[k].stock.entry("or".into()).or_insert(0.0);
                let g = (*tresor * 0.3).floor().max(80.0).min(tresor.floor());
                *tresor -= g;
                p.royaumes[k].relation -= 25.0;
                *p.royaumes[0].stock.get_mut("or").unwrap() += g;
                format!("💰 {nom} paie un tribut de {g} 🪙")
            } else {
                p.royaumes[k].relation -= 10.0;
                return Err(format!("{nom} se moque de vos exigences"));
            }
        }
        _ => return Err("acte inconnu".into()),
    };
    p.royaumes[k].relation = p.royaumes[k].relation.clamp(-100.0, 100.0);
    for e in r.evenements {
        p.noter(e.texte);
    }
    ok(res)
}

fn repondre(p: &mut Partie, id: u32, oui: bool) -> Result<Value, String> {
    let i = p.propositions.iter().position(|x| x.id == id).ok_or("proposition inconnue")?;
    let pr = p.propositions.remove(i);
    let k = pr.de;
    let nom = if k > 0 { p.royaumes[k].nom.clone() } else { "Le colporteur".into() };
    let payer = |p: &mut Partie, panier: &Panier| -> Result<(), String> {
        if !p.peut_payer(0, panier) {
            return Err("Vous n'avez pas de quoi payer".into());
        }
        p.payer(0, panier);
        Ok(())
    };
    let msg = match (pr.genre.as_str(), oui) {
        ("echange" | "marchand", true) => {
            // le rival livre ce qu'il a promis, s'il l'a encore, et reçoit son dû
            let livre = k == 0 || p.peut_payer(k as i32, &pr.donne);
            if let Err(e) = if livre { payer(p, &pr.demande) } else { Err(format!("{nom} n'a plus de quoi honorer ce marché")) } {
                p.propositions.insert(i, pr);
                return Err(e);
            }
            p.crediter(0, &pr.donne);
            if k > 0 {
                p.payer(k as i32, &pr.donne);
                p.crediter(k as i32, &pr.demande);
                p.royaumes[k].relation += 5.0;
            }
            "Marché conclu".to_string()
        }
        ("alliance", true) => {
            if p.royaumes[k].statut == "guerre" {
                return Err("Faites d'abord la paix".into());
            }
            if let Err(e) = payer(p, &pr.demande) {
                p.propositions.insert(i, pr);
                return Err(e);
            }
            p.crediter(k as i32, &pr.demande);
            p.royaumes[k].statut = "alliance".into();
            format!("🤝 Alliance avec {nom}")
        }
        ("paix", true) => {
            if p.royaumes[k].statut != "guerre" {
                return Err("Vous n'êtes plus en guerre".into());
            }
            // la ville promise doit être encore à l'un des deux, et l'on ne cède pas sa dernière ville
            let ville = match pr.ville {
                Some(vid) => Some(p.villes.iter().position(|v| v.id == vid && (v.proprio == 0 || v.proprio == k as i32)).ok_or("Cette ville a changé de mains : l'offre ne tient plus")?),
                None => None,
            };
            if let Some(vi) = ville {
                let cedant = p.villes[vi].proprio;
                if p.villes.iter().filter(|v| v.proprio == cedant).count() < 2 {
                    return Err("On ne cède pas sa dernière ville : l'offre ne tient plus".into());
                }
            }
            if let Err(e) = payer(p, &pr.demande) {
                p.propositions.insert(i, pr);
                return Err(e);
            }
            // le prix de la paix va au vainqueur ; les réparations viennent des réserves de celui qui les offre (ce qu'il en a encore)
            p.crediter(k as i32, &pr.demande);
            let reparations: Panier = pr.donne.iter().map(|(r, v)| (r.clone(), v.min(p.royaumes[k].stock.get(r).copied().unwrap_or(0.0)).max(0.0).floor())).collect();
            p.payer(k as i32, &reparations);
            p.crediter(0, &reparations);
            let mut rap = Rapport::default();
            let mut texte = format!("🕊️ Paix signée avec {nom}");
            if let Some(vi) = ville {
                let preneur = if p.villes[vi].proprio == 0 { k } else { 0 };
                texte += &format!(" — {} change de mains", p.villes[vi].nom);
                ia::diplomatie::ceder_ville(p, vi, preneur, &mut rap);
            }
            ia::diplomatie::signer_paix(p, 0, k, &mut rap);
            for e in rap.evenements {
                p.noter(e.texte);
            }
            texte
        }
        ("tribut", true) => {
            if let Err(e) = payer(p, &pr.demande) {
                p.propositions.insert(i, pr);
                return Err(e);
            }
            p.crediter(k as i32, &pr.demande);
            p.royaumes[k].relation += 12.0;
            format!("Tribut payé à {nom}")
        }
        ("aide", true) => ia::diplomatie::aide_acceptee(p, k, pr.cible.unwrap_or(usize::MAX))?,
        ("aide", false) => ia::diplomatie::aide_refusee(p, k),
        ("tribut", false) => {
            p.royaumes[k].relation -= 15.0;
            if let Some(contre) = ia::diplomatie::contre_proposition(p, &pr) {
                contre
            } else if p.hasard.p(0.55) {
                let mut r = Rapport::default();
                ia::declarer_guerre(p, k, false, &mut r);
                format!("{nom} vous déclare la guerre !")
            } else {
                format!("{nom} ravale sa menace… pour l'instant")
            }
        }
        (_, false) => {
            if k > 0 {
                p.royaumes[k].relation -= 3.0;
            }
            ia::diplomatie::contre_proposition(p, &pr).unwrap_or_else(|| "Proposition refusée".to_string())
        }
        _ => "…".to_string(),
    };
    ok(msg)
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;

    #[test]
    fn ordres_verifies() {
        let mut p = Partie::nouvelle(Options { graine: 11, ..Options::default() });
        assert!(executer(&mut p, &json!({"action": "voler"})).is_err());
        assert!(executer(&mut p, &json!({"action": "construire", "cle": "palais", "case": 0})).is_err());
        let c = (0..p.carte.cases.len()).find(|&c| p.peut_construire("cabane", c, 0).is_ok()).unwrap();
        let bois = p.joueur().stock["bois"] + p.carte.cases[c].arbres as f64 * 3.0;
        assert!(executer(&mut p, &json!({"action": "construire", "cle": "cabane", "case": c})).is_ok());
        assert_eq!(p.joueur().stock["bois"], bois - 15.0);
        assert!(executer(&mut p, &json!({"action": "construire", "cle": "cabane", "case": c})).is_err());
        // déplacer l'armée d'une case
        let a = p.armees.iter().find(|a| a.proprio == 0).unwrap().clone();
        let v = p.carte.voisins(a.case).into_iter().find(|&x| p.praticable(x)).unwrap();
        let r = executer(&mut p, &json!({"action": "deplacer", "armee": a.id, "case": v})).unwrap();
        assert_eq!(r["ok"], true);
        assert!(executer(&mut p, &json!({"action": "rechercher", "tech": "chemin_fer"})).is_err());
        assert!(executer(&mut p, &json!({"action": "rechercher", "tech": "assolement"})).is_ok());
        assert!(executer(&mut p, &json!({"action": "diplo", "royaume": 1, "acte": "cadeau"})).is_ok());
        assert!(executer(&mut p, &json!({"action": "impots", "niveau": "eleve"})).is_ok());
    }

    #[test]
    fn ordres_de_marine_d_espionnage_et_de_siege_verifies() {
        let mut p = Partie::nouvelle(Options { graine: 5, ..Options::default() });
        let cap = p.villes[0].case;
        let ordre = |p: &mut Partie, c: Value| executer(p, &c);
        // flottes
        assert_eq!(ordre(&mut p, json!({"action": "deplacer_flotte", "flotte": 1, "case": 0})), Err("flotte inconnue".into()));
        let mut cotes: Vec<usize> = (0..p.carte.cases.len()).filter(|&c| p.praticable(c) && p.carte.cases[c].bat.is_none() && p.carte.voisins(c).iter().any(|&v| p.carte.cases[v].mer())).collect();
        cotes.sort_by_key(|&c| p.carte.dist(c, cap));
        let port = cotes[0];
        p.poser("port", port, 0, true);
        p.recruter_dans(0, "corvette", port);
        let f = p.flottes[0].id;
        let a = p.armees.iter().find(|a| a.proprio == 0).unwrap().id;
        assert!(ordre(&mut p, json!({"action": "deplacer_flotte", "flotte": f, "case": cap})).unwrap_err().contains("l'eau"));
        assert!(ordre(&mut p, json!({"action": "embarquer", "flotte": f, "armee": a})).unwrap_err().contains("transport"));
        assert!(ordre(&mut p, json!({"action": "debarquer", "flotte": f, "case": port})).unwrap_err().contains("aucune armée"));
        assert!(ordre(&mut p, json!({"action": "commerce_flotte", "flotte": f, "actif": true})).unwrap_err().contains("flûtes"));
        p.recruter_dans(0, "flute", port);
        let loin_terre = (0..p.carte.cases.len()).filter(|&c| p.praticable(c)).max_by_key(|&c| p.carte.dist(c, port)).unwrap();
        let egaree = p.creer_armee(0, loin_terre, BTreeMap::from([("milice".to_string(), 2)]));
        assert!(ordre(&mut p, json!({"action": "embarquer", "flotte": f, "armee": egaree})).unwrap_err().contains("côte"), "l'armée est loin");
        // l'armée de la capitale embarque : le port est celui de sa ville
        assert!(ordre(&mut p, json!({"action": "embarquer", "flotte": f, "armee": a})).is_ok());
        assert!(ordre(&mut p, json!({"action": "commerce_flotte", "flotte": f, "actif": true})).unwrap_err().contains("armée"));
        let eau = p.flottes[0].case;
        let loin = (0..p.carte.cases.len()).filter(|&c| !p.carte.cases[c].terre() && p.chemin_mer(eau, c).is_some()).max_by_key(|&c| p.carte.dist(c, eau)).unwrap();
        let r = ordre(&mut p, json!({"action": "deplacer_flotte", "flotte": f, "case": loin})).unwrap();
        assert!(r["mois"].as_u64().unwrap() >= 1);
        // espions
        assert_eq!(ordre(&mut p, json!({"action": "mission", "espion": 1, "genre": "vol", "ville": 1})), Err("espion inconnu".into()));
        p.recruter_dans(0, "espion", cap);
        let e = p.espions[0].id;
        let vid = p.villes.iter().find(|v| v.proprio == 1).unwrap().id;
        assert!(ordre(&mut p, json!({"action": "mission", "espion": e, "genre": "vol", "ville": vid})).unwrap_err().contains("juste à côté"));
        assert!(ordre(&mut p, json!({"action": "mission", "espion": e, "genre": "vol", "ville": 999_999})).is_err());
        assert!(ordre(&mut p, json!({"action": "deplacer_espion", "espion": e, "case": eau})).is_err(), "pas sur l'eau");
        // sièges et événements
        assert_eq!(ordre(&mut p, json!({"action": "assaut", "ville": vid})), Err("Vous n'assiégez pas cette ville".into()));
        assert_eq!(ordre(&mut p, json!({"action": "choisir", "evenement": 1, "option": 0})), Err("événement inconnu".into()));
        assert_eq!(ordre(&mut p, json!({"action": "choisir", "evenement": 1, "option": -1})), Err("option inconnue".into()));
        // l'interface reçoit de quoi tout brancher (navires au rang Bourg)
        p.villes[0].niveau = 3;
        let v = crate::vue::etat(&p);
        assert!(v["flottes"][0]["armee"]["effectif"].as_u64().unwrap() > 0);
        assert!(v["espions"].as_array().unwrap().len() == 1 && v["joueur"]["unites_dispo"]["port"].as_array().unwrap().iter().any(|u| u == "flute"));
        assert!(v["joueur"]["prix_unites"]["espion"]["or"].as_f64().unwrap() > 0.0);
        for k in ["sieges", "blocus", "choix", "visible"] {
            assert!(v[k].is_array(), "{k}");
        }
    }
}
