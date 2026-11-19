//! Ce que l'interface reçoit : la carte (terrain, presque fixe) et l'état du mois.

use serde_json::{json, Value};

use crate::carte::{Carte, Terrain};
use crate::commandes::{cout_recrue, prix};
use crate::meteo::{self, Meteo};
use crate::ia::diplomatie;
use crate::partie::Partie;
use crate::regles::{regles, HOMMES, REGLES_JSON};
use crate::tour::QUETES;

fn code(t: Terrain) -> u8 {
    match t {
        Terrain::Profond => 0,
        Terrain::Hautfond => 1,
        Terrain::Lac => 2,
        Terrain::Sable => 3,
        Terrain::Plaine => 4,
        Terrain::Colline => 5,
        Terrain::Montagne => 6,
    }
}

/// Le terrain : envoyé à l'ouverture et quand `version` change.
/// Les règles servies à l'interface : celles du moteur, les habitants et les soldats comptés en hommes (`HOMMES`).
pub fn regles_affichees() -> Value {
    let mut r: Value = serde_json::from_str(REGLES_JSON).unwrap_or(json!({}));
    let fois = |v: &mut Value, cles: &[&str]| {
        for c in cles {
            if let Some(n) = v.get(*c).and_then(Value::as_f64) {
                v[*c] = json!(n * HOMMES as f64);
            }
        }
    };
    for (liste, cles) in [("batiments", &["logement", "ouvriers", "hygiene", "foi", "taverne", "colons"][..]), ("niveaux", &["pop"][..]), ("unites", &["transport"][..])] {
        for v in r[liste].as_array_mut().into_iter().flatten() {
            fois(v, cles);
        }
    }
    r
}

pub fn carte(m: &Carte, version: u32) -> Value {
    json!({
        "l": m.l,
        "h": m.h,
        "version": version,
        "terrain": m.cases.iter().map(|k| code(k.t)).collect::<Vec<_>>(),
        "riviere": m.cases.iter().map(|k| k.riviere as u8).collect::<Vec<_>>(),
        "fertile": m.cases.iter().map(|k| k.fertile as u8).collect::<Vec<_>>(),
        "poissons": m.cases.iter().map(|k| k.poissons as u8).collect::<Vec<_>>(),
        "gisement": m.cases.iter().map(|k| k.gisement.clone()).collect::<Vec<_>>(),
        "arbres": m.cases.iter().map(|k| k.arbres).collect::<Vec<_>>(),
        "foret": m.cases.iter().map(|k| k.foret as u8).collect::<Vec<_>>(),
        "rivieres": m.rivieres,
        "biome": m.cases.iter().map(|k| k.biome.clone()).collect::<Vec<_>>(),
    })
}

pub fn meteo_json(m: &Meteo, tour: u32) -> Value {
    let e = m.effets(tour);
    json!({
        "genre": m.genre, "titre": m.titre, "icone": m.icone, "temperature": m.temperature,
        "vent": m.vent, "direction": m.direction, "pluie": m.pluie, "neige_sol": m.neige_sol,
        "secheresse": m.secheresse, "historique": m.historique, "effets": e.resume,
        "cultures": e.cultures, "mouvement": e.mouvement, "tir": e.tir,
    })
}

pub fn etat(p: &Partie) -> Value {
    let rg = regles();
    let j = p.joueur();
    let s = p.stats(0);
    let an = p.annee();
    let m = meteo::mois(p.tour);
    let ep = rg.epoque(an);
    let caps: serde_json::Map<String, Value> = rg.ressources.iter().map(|r| (r.cle.clone(), json!(p.capacite(&s, &r.cle).min(1e9)))).collect();
    let previsions: Vec<Value> = Meteo::previsions(p.tour + 1, &p.meteo)
        .into_iter()
        .map(|(g, pc)| json!({"genre": g, "pourcent": pc}))
        .collect();
    let quete = QUETES.get(j.quete).map(|q| json!({"n": j.quete + 1, "texte": q.texte, "prime": q.prime}));
    let mut dispo = serde_json::Map::new();
    let mut prix_unites = serde_json::Map::new();
    for b in ["caserne", "haras", "arsenal", "port", "taverne"] {
        let l = p.unites_dispo(0, b);
        for u in &l {
            prix_unites.insert(u.clone(), json!(cout_recrue(p, 0, u)));
        }
        dispo.insert(b.into(), json!(l));
    }
    // brouillard de guerre : le joueur ne reçoit des autres que ce qu'il voit (armées, flottes, espions)
    // ou a exploré (villes, bâtiments) ; le terrain part en entier, l'interface le masque
    let visible = p.vision(0);
    let explore: Vec<u8> = (0..visible.len()).map(|i| (p.connait(0, i) || visible[i] == 1) as u8).collect();
    let vu = |c: usize| visible.get(c) == Some(&1);
    let connu = |c: usize| explore.get(c) == Some(&1);
    let tir = p.meteo.effets(p.tour).tir;
    let mut rapport = p.rapport.clone();
    rapport.mouvements.retain(|m| m.proprio == 0 || m.trajet.iter().any(|&c| vu(c)));
    rapport.combats.retain(|c| c.attaquant == 0 || c.defenseur == 0 || vu(c.case));
    let nr = p.niveau_routes(0);
    let nom_routes = ["", "Chemins de terre", "Routes pavées", "Routes royales"][nr as usize];
    let routes_joueur = json!({
        "niveau": nr,
        "nom": nom_routes,
        "segments": p.segments_routes(0),
        "cout": if nr < 3 { json!(p.cout_routes(0, nr + 1)) } else { Value::Null },
        "verrou": if nr == 1 && p.niveau_capitale(0) < 2 { json!("Capitale au rang Village") } else if nr == 2 && !j.a("routes") { json!("Technologie « Routes royales et canaux »") } else { Value::Null },
    });
    let villes: Vec<Value> = p.villes.iter().enumerate().filter(|(_, v)| v.proprio == 0 || connu(v.case)).map(|(i, v)| {
        // le niveau suivant, pour le joueur : son coût, et ce qui le bloque (travaux, rang, technologie)
        let suivante = rg.fortif(v.fortif + 1).filter(|_| v.proprio == 0).map(|f| {
            let verrou = p.peut_fortifier(i).err();
            json!({"niveau": f.niveau, "nom": f.nom, "icone": f.icone, "cout": f.cout, "duree": f.duree, "murs": f.murs, "defense": f.defense,
                   "possible": verrou.is_none() && p.peut_payer(0, &f.cout), "verrou": verrou})
        });
        // la vie de la ville (cite.rs) ; le détail n'est donné que pour les villes du joueur
        let x = p.vie_ville(i);
        let mien = v.proprio == 0;
        json!({
            "id": v.id, "nom": v.nom, "proprio": v.proprio, "case": v.case, "niveau": v.niveau,
            // la foule au marché, pour le rendu : jour de marché, une halle, ni siège ni blocus, et (joueur) pas de disette le mois dernier
            "jour_marche": x.marche && !(mien && j.famine),
            // réverbères allumés (rendu : les lumières la nuit)
            "eclairage": v.eclairage,
            "eclairage_verrou": if mien { json!(p.peut_eclairer(i).err()) } else { Value::Null },
            "ecoles": if mien { json!(x.ecoles) } else { Value::Null },
            "ateliers": if mien { json!(x.ateliers) } else { Value::Null },
            "ignorance": mien && x.ignorance,
            "delinquance": mien && x.delinquance,
            "capitale": v.capitale, "defense": p.defense_ville(i), "rang": rg.nom_niveau(v.niveau),
            "murs": p.murs_ville(i), "assiegee": p.siege_de(v.id).is_some(), "blocus": p.bloquee(Some(v.id)),
            "fortif": v.fortif, "fortif_nom": rg.fortif(v.fortif).map_or("Ville ouverte", |f| f.nom.as_str()),
            "travaux_fortif": if v.travaux_fortif > 0 { json!(v.travaux_fortif) } else { Value::Null },
            "fortif_suivante": suivante, "enceinte": p.enceinte(i),
        })
    }).collect();
    json!({
        "tour": p.tour,
        "date": meteo::date_texte(p.tour),
        "annee": an,
        "mois": m,
        "mois_nom": meteo::MOIS[m],
        "saison": meteo::saison(m),
        "saison_nom": meteo::SAISONS[meteo::saison(m)],
        // ce mois-ci est jour de marché (tous les `regles.jour_marche.tous_les` mois) ; la foule de chaque ville : `villes[].jour_marche`
        "jour_marche": p.jour_marche(),
        "epoque": {"cle": ep.cle, "nom": ep.nom},
        "meteo": meteo_json(&p.meteo, p.tour),
        "previsions": previsions,
        "version_carte": p.version_carte,
        "joueur": {
            "stock": j.stock,
            "capacite": caps,
            "pop": j.pop * HOMMES,
            "logement": s.logement * HOMMES,
            "soldats": s.soldats * HOMMES,
            "prix_terre": p.prix_terre(0),
            "ouvriers_libres": j.ouvriers_libres as i64 * HOMMES,
            "bonheur": j.bonheur,
            "detail_bonheur": j.detail_bonheur,
            "impots": j.impots,
            "revenus": j.revenus,
            "bilan": j.bilan,
            "techs": j.techs,
            "recherche": j.recherche,
            "savoir": j.savoir,
            "savoir_mois": p.savoir_mois(0),
            // bois (ou équivalent en charbon) que brûleront les foyers à la fin du mois (0 hors de l'hiver)
            "chauffage": j.pop as f64 * p.chauffage_par_habitant(),
            "famine": j.famine,
            "variete": j.variete,
            "comptoir": s.comptoir,
            "port": s.port,
            "niveau_capitale": p.niveau_capitale(0),
            "quete": quete,
            "routes": routes_joueur,
            "unites_dispo": dispo,
            "prix_unites": prix_unites,
            "remise_recrues": if j.a("levee_masse") { 0.75 } else { 1.0 },
            "commerce_mer": j.commerce_mer,
            "entretien_flotte": s.entretien_flotte,
            "entretien_forts": p.entretien_forts(0),
        },
        "explore": explore,
        "visible": visible,
        "royaumes": p.royaumes.iter().map(|r| {
            let prix_: serde_json::Map<String, Value> = if r.joueur { serde_json::Map::new() } else {
                rg.prix.keys().map(|k| (k.clone(), json!([prix(p, r.id, k, true), prix(p, r.id, k, false)]))).collect()
            };
            json!({
                "id": r.id, "nom": r.nom, "couleur": r.couleur, "joueur": r.joueur,
                "caractere": p.diplomatie.souverains.get(r.id).map_or("", |s| diplomatie::nom_caractere(&s.caractere)), "vivant": r.vivant, "statut": r.statut,
                "relation": r.relation, "commerce": r.commerce, "puissance": p.puissance(r.id as i32),
                // ce que l'on sait d'un rival : son trésor (pour commercer) et sa population à la dizaine près, pas ses réserves
                "surplus": r.surplus, "demande": r.demande, "tresor": r.stock.get("or").copied().unwrap_or(0.0).floor(), "prix": prix_,
                "population": if r.joueur { r.pop * HOMMES } else { (r.pop as f64 / 10.0).round() as i64 * 10 * HOMMES },
                "techs": r.techs.len(), "techs_liste": r.techs,
                // souverain, trêve, guerres et alliances avec les royaumes connus, coalition, mémoire
                "diplo": diplomatie::vue_royaume(p, r.id),
            })
        }).collect::<Vec<_>>(),
        "villes": villes,
        "batiments": p.batiments.iter().filter(|b| b.proprio == 0 || connu(b.case)).map(|b| json!({
            "id": b.id, "cle": b.cle, "proprio": b.proprio, "case": b.case, "reste": b.reste,
            "ouvriers": b.ouvriers as i64 * HOMMES, "etat": b.etat, "pause": b.pause, "file": b.file, "face": b.face,
            "ville": b.ville, "produit": b.produit, "arret": if b.arret > p.tour { json!(b.arret) } else { Value::Null },
        })).collect::<Vec<_>>(),
        "armees": p.armees.iter().filter(|a| a.proprio == 0 || vu(a.case)).map(|a| json!({
            "id": a.id, "proprio": a.proprio, "case": a.case, "unites": a.unites, // les autres : seulement la partie de leur marche qui est en vue (menaces en approche)
            "chemin": if a.proprio == 0 { json!(a.chemin) } else { json!(a.chemin.iter().take_while(|&&c| vu(c)).collect::<Vec<_>>()) },
            "effectif": a.effectif() as i64 * HOMMES, "att": p.attaque(a, false, 1.0), "def": p.defense(a),
            "mois": if a.chemin.is_empty() { 0 } else { p.mois_trajet(a, &a.chemin) },
            "assiege": p.assiege(a.proprio, a.case),
            // null, "en_cours" (un mois de travaux) ou "pret" (défense ×retranchement.defense)
            "retranche": match a.retranche { None => Value::Null, Some(0) => json!("pret"), Some(_) => json!("en_cours") },
            // pour le joueur : pourquoi l'ordre est refusé (null : permis ; le coût du fort est vérifié à part)
            "retrancher_verrou": if a.proprio == 0 { json!(p.peut_retrancher(a).err()) } else { Value::Null },
            "fort_verrou": if a.proprio == 0 { json!(p.peut_construire_fort(a).err()) } else { Value::Null },
        })).collect::<Vec<_>>(),
        // les forts : comme les armées, ceux des autres ne se voient que s'ils sont en vue
        "forts": p.forts.iter().enumerate().filter(|(_, f)| f.proprio == 0 || vu(f.case)).map(|(fi, f)| {
            let d = rg.fort(f.niveau);
            let garnison = p.garnison(f.proprio, f.case);
            let suivant = rg.fort(f.niveau + 1).filter(|_| f.proprio == 0).map(|n| {
                let verrou = p.peut_ameliorer_fort(fi).err();
                json!({"niveau": n.niveau, "nom": n.nom, "icone": n.icone, "cout": n.cout, "duree": n.duree, "murs": n.murs, "defense": n.defense,
                       "vision": n.vision, "entretien": n.entretien, "possible": verrou.is_none() && p.peut_payer(0, &n.cout), "verrou": verrou})
            });
            json!({
                "id": f.id, "proprio": f.proprio, "case": f.case, "niveau": f.niveau,
                "nom": d.map_or_else(|| rg.fort(1).map_or(String::new(), |x| format!("{} (chantier)", x.nom)), |d| d.nom.clone()),
                "icone": d.map(|d| d.icone.clone()), "lieu": p.nom_fort(f.case),
                "murs": d.map_or(0.0, |d| d.murs), "defense": d.map_or(1.0, |d| d.defense), "entretien": d.map_or(0.0, |d| d.entretien),
                "travaux": if f.travaux > 0 { json!(f.travaux) } else { Value::Null },
                "suspendu": f.travaux > 0 && (!garnison || p.siege_de(f.id).is_some()),
                "garnison": garnison, "assiege": p.siege_de(f.id).is_some(), "suivant": suivant,
            })
        }).collect::<Vec<_>>(),
        "flottes": p.flottes.iter().filter(|f| f.proprio == 0 || vu(f.case)).map(|f| {
            let a_moi = f.proprio == 0;
            json!({
                "id": f.id, "proprio": f.proprio, "case": f.case, "navires": f.navires,
                "chemin": if a_moi { json!(f.chemin) } else { json!([]) },
                "mois": if a_moi && !f.chemin.is_empty() { p.mois_navigation(f) } else { 0 },
                "att": p.force_navale(f, true), "def": p.force_navale(f, false), "guerre": p.de_guerre(f),
                "capacite": p.capacite_transport(f) as i64 * HOMMES, "flutes": p.flutes(f), "commerce": f.commerce,
                "a_quai": p.port_voisin(f).is_some(),
                "armee": f.armee.as_ref().map(|a| if a_moi {
                    json!({"id": a.id, "unites": a.unites, "effectif": a.effectif() as i64 * HOMMES, "att": p.attaque(a, false, 1.0), "def": p.defense(a)})
                } else {
                    json!({"effectif": a.effectif() as i64 * HOMMES})
                }),
            })
        }).collect::<Vec<_>>(),
        "espions": p.espions.iter().filter(|e| e.proprio == 0 || p.detecte(e, 0, &visible)).map(|e| {
            let ville = e.ville.and_then(|vid| p.villes.iter().find(|v| v.id == vid));
            let missions: Vec<Value> = if e.proprio == 0 && e.mission.is_none() && e.chemin.is_empty() {
                p.villes_a_portee(e).into_iter().flat_map(|vi| rg.espionnage.missions.iter().map(move |m| (vi, m))).map(|(vi, m)| json!({
                    "ville": p.villes[vi].id, "nom_ville": p.villes[vi].nom, "genre": m.cle, "nom": m.nom, "icone": m.icone,
                    "duree": m.duree.max(1), "chance": (p.chance_mission(0, &m.cle, vi) * 100.0).round(),
                })).collect()
            } else { Vec::new() };
            json!({
                "id": e.id, "proprio": e.proprio, "case": e.case,
                "chemin": if e.proprio == 0 { json!(e.chemin) } else { json!([]) },
                "mission": if e.proprio == 0 { json!(e.mission) } else { Value::Null },
                "ville": if e.proprio == 0 { json!(e.ville) } else { Value::Null },
                "nom_ville": if e.proprio == 0 { json!(ville.map(|v| v.nom.clone())) } else { Value::Null },
                "reste": if e.proprio == 0 { e.reste } else { 0 },
                "missions": missions,
            })
        }).collect::<Vec<_>>(),
        "sieges": p.sieges.iter().filter(|s| s.assiegeant == 0 || p.place(s).is_some_and(|x| x.0 == 0) || vu(s.case)).map(|s| {
            let place = p.place(s);
            let proprio = place.as_ref().map(|x| x.0);
            let (at, de) = p.forces_assaut(s, tir);
            // les faubourgs (bâtiments hors de l'enceinte, à l'arrêt) et le dernier pillé
            let faubourgs: Vec<Value> = p.batiments.iter().filter(|b| b.ville == Some(s.ville) && p.faubourg_assiege(b)).map(|b| json!({
                "id": b.id, "cle": b.cle, "case": b.case, "pille": b.arret > p.tour,
            })).collect();
            let pillage = s.pillage.as_ref().map(|(c, cle)| json!({"case": c, "batiment": cle, "nom": rg.bat(cle).map(|d| d.nom.clone())}));
            json!({
                "ville": s.ville, "fort": s.fort, "nom": place.map(|x| x.1), "case": s.case, "proprio": proprio,
                "assiegeant": s.assiegeant, "mois": s.mois, "murs": s.murs, "murs_max": s.murs_max,
                "murs_pct": if s.murs_max > 0.0 { (s.murs / s.murs_max * 100.0).round() } else { 0.0 },
                "vivres": s.vivres, "faim": s.faim, "assaut": s.assaut,
                "armees": p.armees.iter().filter(|a| a.proprio == s.assiegeant && a.case == s.case).map(|a| a.id).collect::<Vec<_>>(),
                "garnison": p.armees.iter().filter(|a| Some(a.proprio) == proprio && a.case == s.case).map(|a| a.effectif() as i64 * HOMMES).sum::<i64>(),
                "force_assaut": at.round(), "defense_assaut": de.round(),
                "chance_assaut": (at / (at + de) * 100.0).round(),
                "faubourgs": faubourgs, "pillage": pillage,
            })
        }).collect::<Vec<_>>(),
        "blocus": p.blocus.iter().filter(|b| b.par == 0 || p.villes.iter().any(|v| v.id == b.ville && v.proprio == 0) || connu(b.case)).map(|b| json!({
            "ville": b.ville, "case": b.case, "par": b.par,
            "nom": p.villes.iter().find(|v| v.id == b.ville).map(|v| v.nom.clone()),
        })).collect::<Vec<_>>(),
        "choix": p.choix.iter().map(|c| {
            let d = rg.evenements_choix.iter().find(|d| d.cle == c.cle);
            json!({
                "id": c.id, "cle": c.cle, "titre": c.titre, "icone": c.icone, "texte": c.texte, "royaume": c.royaume,
                "options": c.options.iter().enumerate().map(|(i, t)| {
                    let o = d.and_then(|d| d.options.get(i));
                    let cout = o.map(|o| o.cout.clone()).unwrap_or_default();
                    json!({"texte": t, "cout": cout, "possible": p.peut_payer(0, &cout), "risque": o.map_or(0.0, |o| o.risque)})
                }).collect::<Vec<_>>(),
            })
        }).collect::<Vec<_>>(),
        "cases": {
            "proprio": p.carte.cases.iter().map(|k| k.proprio).collect::<Vec<_>>(),
            "arbres": p.carte.cases.iter().map(|k| k.arbres).collect::<Vec<_>>(),
            "foret": p.carte.cases.iter().map(|k| k.foret as u8).collect::<Vec<_>>(),
            "bois": p.carte.cases.iter().map(|k| k.bois.round() as i32).collect::<Vec<_>>(),
        },
        "routes": p.routes.iter().map(|r| json!([r[0], r[1], p.niveau_routes(r[2] as i32)])).collect::<Vec<_>>(),
        "propositions": p.propositions,
        "coalitions": diplomatie::vue_coalitions(p),
        "journal": p.journal.iter().take(40).collect::<Vec<_>>(),
        "rapport": rapport,
        "fin": p.fin,
        "sans_victoire": p.sans_victoire,
        "couleurs": {"99": "#4b4b4b"},
    })
}
