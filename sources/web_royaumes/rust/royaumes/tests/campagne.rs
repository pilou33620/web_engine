//! Banc d'une campagne : un robot joue le joueur (constructions raisonnables, recrutement),
//! on vérifie que l'économie tient l'hiver, que la population grandit et que les rivaux vivent.
//! `cargo test --test campagne -- --nocapture` affiche le bilan année par année.

use royaumes::carte::Options;
use royaumes::commandes::executer;
use royaumes::meteo;
use royaumes::partie::Partie;
use royaumes::regles::regles;
use serde_json::json;

fn construire(p: &mut Partie, cle: &str) -> bool {
    let cap = p.villes[p.capitale(0).unwrap()].case;
    let mut cases: Vec<usize> = (0..p.carte.cases.len()).filter(|&c| p.peut_construire(cle, c, 0).is_ok()).collect();
    cases.sort_by_key(|&c| p.carte.dist(c, cap));
    match cases.first() {
        Some(&c) => executer(p, &json!({"action": "construire", "cle": cle, "case": c})).is_ok(),
        None => false,
    }
}

fn robot(p: &mut Partie) {
    let s = p.stats(0);
    let j = p.joueur().clone();
    let nb = |p: &Partie, cle: &str| p.batiments.iter().filter(|b| b.proprio == 0 && b.cle == cle).count();
    // rang de la capitale d'abord : on économise pour l'Hôtel de ville
    let vid = p.villes[p.capitale(0).unwrap()].id;
    let _ = executer(p, &json!({"action": "ameliorer", "ville": vid}));
    let econome = p.niveau_capitale(0) == 1 && j.pop >= 40;
    // pendant l'économie, la scierie ne dévore pas le bois que demande l'Hôtel de ville quand les planches s'entassent
    let garder_bois = econome && j.stock["bois"] < 60.0 && j.stock["planches"] >= 80.0;
    // l'automne et l'hiver, on garde trois mois de grand froid de bois de chauffage : scierie et fonderie s'arrêtent
    let c = &regles().chauffage;
    let reserve = j.pop as f64 * c.par_habitant * c.grand_froid * 3.0;
    let froid = matches!(meteo::saison(meteo::mois(p.tour)), 0 | 3) && j.stock["bois"] < reserve;
    let garder_bois = garder_bois || froid;
    // et s'il manque encore du bois, on en achète aux rivaux (par lots de 10) tant que le trésor le permet
    for k in 1..p.royaumes.len() {
        while froid && p.joueur().stock["bois"] < reserve && p.joueur().stock["or"] > 200.0 {
            if executer(p, &json!({"action": "echanger", "royaume": k, "ressource": "bois", "achat": true})).is_err() {
                break;
            }
        }
    }
    for b in p.batiments.iter().filter(|b| b.proprio == 0 && matches!(b.cle.as_str(), "scierie" | "fonderie") && b.pause != garder_bois).map(|b| b.id).collect::<Vec<_>>() {
        let _ = executer(p, &json!({"action": "pause", "batiment": b}));
    }
    if econome {
        if nb(p, "bucheron") < 3 {
            construire(p, "bucheron");
        }
        return;
    }
    // la ville : logements quand on approche du plafond, si les greniers suivent (bien chauffée, elle grandit vite)
    let vivres: f64 = regles().nourriture.iter().map(|r| j.stock.get(r).copied().unwrap_or(0.0)).sum();
    if j.pop + 6 >= s.logement && vivres >= j.pop as f64 {
        let cle = if p.niveau_capitale(0) >= 2 { "maison" } else { "cabane" };
        construire(p, cle);
    }
    // des vivres à la mesure de la population
    if p.niveau_capitale(0) >= 2 && vivres < j.pop as f64 * 2.0 && nb(p, "pecheur") + nb(p, "ferme") < 4 + j.pop as usize / 30 {
        let _ = construire(p, "pecheur") || construire(p, "ferme");
    }
    // le bois de chauffage : quand les forêts voisines sont rasées, un bûcheron part vers une forêt intacte
    let abattent = p.batiments.iter().filter(|b| b.proprio == 0 && b.cle == "bucheron" && !b.etat.starts_with("🌲")).count();
    if froid && abattent < 2 && nb(p, "bucheron") < 8 {
        construire(p, "bucheron");
    }
    let voulus: &[(&str, usize)] = &[
        ("bucheron", 2), ("pecheur", 2), ("ferme", 2), ("carriere", 1), ("scierie", 1), ("grenier", 1), ("puits", 1), ("forestier", 1),
        ("caserne", 1), ("moulin", 1), ("boulangerie", 1), ("taverne", 1), ("brasserie", 1), ("eglise", 1), ("entrepot", 1), ("comptoir", 1),
        ("bergerie", 1), ("tisserand", 1), ("mine_fer", 1), ("fonderie", 1), ("forge", 1), ("marche", 1), ("ecole", 1), ("fontaine", 1),
    ];
    for &(cle, n) in voulus {
        if nb(p, cle) < n && construire(p, cle) {
            break;
        }
    }
    // rang de la capitale
    let vid = p.villes[p.capitale(0).unwrap()].id;
    let _ = executer(p, &json!({"action": "ameliorer", "ville": vid}));
    // recherche
    if p.joueur().recherche.is_none() {
        for t in ["assolement", "vauban", "silex", "routes", "manufactures", "cartographie", "lumieres", "parmentier"] {
            if executer(p, &json!({"action": "rechercher", "tech": t})).is_ok() {
                break;
            }
        }
    }
    // l'éclairage public, dès qu'il est permis et que le trésor suit (refusé tant qu'il ne l'est pas)
    if p.joueur().stock["or"] > 500.0 {
        for v in p.villes.iter().filter(|v| v.proprio == 0 && !v.eclairage).map(|v| v.id).collect::<Vec<_>>() {
            let _ = executer(p, &json!({"action": "eclairer", "ville": v, "actif": true}));
        }
    }
    // une petite armée
    if s.soldats < 6 + j.pop / 8 {
        if let Some(b) = p.batiments.iter().find(|b| b.proprio == 0 && b.cle == "caserne" && b.fini()).map(|b| b.id) {
            let _ = executer(p, &json!({"action": "recruter", "batiment": b, "unite": "mousquetaire"}));
            let _ = executer(p, &json!({"action": "recruter", "batiment": b, "unite": "milice"}));
        }
    }
    // événements à choix : la première option si on peut la payer, sinon la dernière (gratuite)
    for c in p.choix.clone() {
        if executer(p, &json!({"action": "choisir", "evenement": c.id, "option": 0})).is_err() {
            executer(p, &json!({"action": "choisir", "evenement": c.id, "option": c.options.len() - 1})).unwrap();
        }
    }
    // la marine : un port, une flûte mise au commerce
    if nb(p, "port") == 0 && p.niveau_capitale(0) >= 3 {
        construire(p, "port");
    }
    if let Some(b) = p.batiments.iter().find(|b| b.proprio == 0 && b.cle == "port" && b.fini()).map(|b| b.id) {
        if p.flottes.iter().all(|f| f.proprio != 0) && p.batiments.iter().all(|x| x.file.is_empty()) {
            let _ = executer(p, &json!({"action": "recruter", "batiment": b, "unite": "flute"}));
        }
    }
    for f in p.flottes.iter().filter(|f| f.proprio == 0 && !f.commerce).map(|f| f.id).collect::<Vec<_>>() {
        let _ = executer(p, &json!({"action": "commerce_flotte", "flotte": f, "actif": true}));
    }
    // un espion : vers la ville rivale connue la plus proche, puis une mission de renseignement
    if p.espions.iter().all(|e| e.proprio != 0) && j.stock["or"] > 400.0 {
        if let Some(b) = p.batiments.iter().find(|b| b.proprio == 0 && b.cle == "taverne" && b.fini()).map(|b| b.id) {
            let _ = executer(p, &json!({"action": "recruter", "batiment": b, "unite": "espion"}));
        }
    }
    for e in p.espions.iter().filter(|e| e.proprio == 0 && e.mission.is_none() && e.chemin.is_empty()).cloned().collect::<Vec<_>>() {
        let mut cibles: Vec<(u32, usize)> = p.villes.iter().filter(|v| v.proprio > 0 && p.connait(0, v.case)).map(|v| (v.id, v.case)).collect();
        cibles.sort_by_key(|&(_, c)| p.carte.dist(c, e.case));
        if let Some(&(vid, c)) = cibles.first() {
            if p.carte.dist(c, e.case) <= 1 {
                let _ = executer(p, &json!({"action": "mission", "espion": e.id, "genre": "renseignement", "ville": vid}));
            } else {
                let _ = executer(p, &json!({"action": "deplacer_espion", "espion": e.id, "case": c}));
            }
        } else {
            // aucune ville rivale connue : l'espion part explorer la terre inconnue la plus proche
            let comp = p.carte.cases[e.case].comp;
            let inconnue = (0..p.carte.cases.len()).filter(|&c| !p.connait(0, c) && p.praticable(c) && p.carte.cases[c].comp == comp).min_by_key(|&c| p.carte.dist(c, e.case));
            if let Some(c) = inconnue {
                let _ = executer(p, &json!({"action": "deplacer_espion", "espion": e.id, "case": c}));
            }
        }
    }
    // répondre aux propositions : on paie les tributs, on accepte paix et alliances, on refuse le reste
    let props = p.propositions.clone();
    for pr in props {
        let oui = matches!(pr.genre.as_str(), "paix" | "alliance" | "tribut");
        let _ = executer(p, &json!({"action": "repondre", "proposition": pr.id, "accepte": oui}));
    }
}

#[test]
fn dix_ans_de_campagne() {
    campagne(Options { graine: 1789, ..Options::default() });
}

#[test]
fn dix_ans_dans_l_archipel() {
    campagne(Options { graine: 1789, forme: "archipel".into(), ..Options::default() });
}

#[test]
fn dix_ans_autour_de_la_mer_interieure() {
    campagne(Options { graine: 1789, forme: "mer_interieure".into(), ..Options::default() });
}

fn campagne(o: Options) {
    let mut p = Partie::nouvelle(o);
    let mut famines = 0;
    let (mut choix, mut espion, mut commerce_mer) = (0, false, 0.0);
    let (mut geles, mut marches) = (0, 0);
    for mois in 0..120 {
        robot(&mut p);
        espion |= p.espions.iter().any(|e| e.proprio == 0);
        let r = p.fin_du_mois();
        let evt = |debut: &str| r.evenements.iter().filter(|e| e.texte.starts_with(debut)).count();
        (geles, marches) = (geles + evt("🥶"), marches + evt("🧺 Jour de marché"));
        choix += p.choix.len();
        commerce_mer += p.joueur().commerce_mer;
        if p.joueur().famine {
            famines += 1;
        }
        if mois % 12 == 11 {
            let j = p.joueur();
            println!(
                "{} · pop {} · bonheur {:.0} · or {:.0} · bois {:.0} · pain {:.0} · poisson {:.0} · blé {:.0} · bât. {} · techs {} · rang {} · rivaux {} bât. · navires {} · espions {} · explorées {}",
                r.date,
                j.pop,
                j.bonheur,
                j.stock["or"],
                j.stock["bois"],
                j.stock["pain"],
                j.stock["poisson"],
                j.stock["ble"],
                p.batiments.iter().filter(|b| b.proprio == 0).count(),
                j.techs.len(),
                p.niveau_capitale(0),
                p.batiments.iter().filter(|b| b.proprio != 0).count(),
                p.flottes.iter().filter(|f| f.proprio == 0).map(|f| f.navires.values().sum::<u32>()).sum::<u32>(),
                p.espions.iter().filter(|e| e.proprio == 0).count(),
                j.explore.iter().filter(|&&x| x == 1).count()
            );
        }
        if p.fin.is_some() {
            break;
        }
    }
    let fortifs: Vec<u32> = p.villes.iter().filter(|v| v.proprio > 0).map(|v| v.fortif).collect();
    let forts: Vec<u32> = p.forts.iter().filter(|f| f.proprio > 0).map(|f| f.niveau).collect();
    println!("événements à choix : {choix} · commerce maritime : {commerce_mer} 🪙 · fortifications des rivaux : {fortifs:?} · leurs forts : {forts:?} · mois de froid : {geles} · jours de marché : {marches}");
    // forêts rasées et sans comptoir pour acheter du bois (petites îles), le robot grelotte certains hivers, mais tient
    assert!(geles < 30, "le robot chauffe ses foyers : {geles} mois de froid en 10 ans");
    assert!(marches > 0 || !p.a_batiment(0, "marche"), "la halle anime la capitale tous les 3 mois");
    assert!(fortifs.iter().any(|&f| f > 0), "les rivaux fortifient leurs villes");
    assert!(choix >= 20, "un événement à choix tous les 3 ou 4 mois ({choix})");
    assert!(espion, "le robot a recruté un espion");
    let j = p.joueur();
    assert!(p.villes.iter().any(|v| v.proprio == 0), "le joueur a survécu");
    assert!(j.pop > 40, "la population a grandi : {}", j.pop);
    assert!(famines < 24, "{famines} mois de famine en 10 ans");
    assert!(p.niveau_capitale(0) >= 2);
    assert!(j.techs.len() >= 3);
}

#[test]
fn sauvegarde_relue() {
    let mut p = Partie::nouvelle(Options { graine: 3, ..Options::default() });
    for _ in 0..14 {
        p.fin_du_mois();
    }
    let t = serde_json::to_string(&p).unwrap();
    let mut q: Partie = serde_json::from_str(&t).unwrap();
    assert_eq!(q.tour, p.tour);
    let a = p.fin_du_mois();
    let b = q.fin_du_mois();
    assert_eq!(a.date, b.date);
    assert_eq!(p.joueur().pop, q.joueur().pop, "même partie, même suite");
}

#[test]
fn ancienne_sauvegarde_relue() {
    // une sauvegarde d'avant la marine, l'espionnage, les sièges, le brouillard et les forts
    let mut p = Partie::nouvelle(Options { graine: 4, ..Options::default() });
    for _ in 0..3 {
        p.fin_du_mois();
    }
    let mut v = serde_json::to_value(&p).unwrap();
    let o = v.as_object_mut().unwrap();
    for k in ["flottes", "espions", "sieges", "blocus", "choix", "forts"] {
        o.remove(k);
    }
    for r in o["royaumes"].as_array_mut().unwrap() {
        for k in ["explore", "revele", "prochain_choix", "dernier_choix", "commerce_mer", "projet_fort"] {
            r.as_object_mut().unwrap().remove(k);
        }
    }
    for b in o["batiments"].as_array_mut().unwrap() {
        b.as_object_mut().unwrap().remove("arret");
    }
    for a in o["armees"].as_array_mut().unwrap() {
        a.as_object_mut().unwrap().remove("retranche");
    }
    for m in o["rapport"]["mouvements"].as_array_mut().unwrap() {
        m.as_object_mut().unwrap().remove("flotte");
    }
    let mut q: Partie = serde_json::from_value(v).unwrap();
    assert!(q.flottes.is_empty() && q.forts.is_empty() && q.royaumes[0].explore.is_empty());
    // l'interface voit au moins ce que le royaume voit, puis l'exploration reprend au premier mois
    let e = royaumes::vue::etat(&q);
    let cap = q.villes[0].case;
    assert_eq!(e["explore"][cap], 1);
    for _ in 0..6 {
        q.fin_du_mois();
    }
    assert!(q.connait(0, cap));
}

#[test]
fn routes_tracees_et_ameliorees() {
    let mut p = Partie::nouvelle(Options { graine: 77, ..Options::default() });
    // dès le départ, les chaumières sont reliées à l'hôtel de ville
    assert!(p.segments_routes(0) >= 1, "routes de départ");
    assert!(p.routes.iter().all(|r| p.carte.dist(r[0], r[1]) == 1), "une route relie deux cases voisines");
    assert!(construire(&mut p, "bucheron"));
    p.fin_du_mois();
    p.fin_du_mois();
    let b = p.batiments.iter().find(|b| b.proprio == 0 && b.cle == "bucheron").unwrap().case;
    assert!(p.carte.cases[b].route == 1, "le bûcheron achevé est relié");
    // amélioration : refusée au rang Hameau, acceptée ensuite
    assert!(executer(&mut p, &json!({"action": "ameliorer_routes"})).is_err());
    let ci = p.capitale(0).unwrap();
    p.villes[ci].niveau = 2;
    p.royaumes[0].stock.insert("pierre".into(), 500.0);
    p.royaumes[0].stock.insert("or".into(), 500.0);
    assert!(executer(&mut p, &json!({"action": "ameliorer_routes"})).is_ok());
    assert_eq!(p.carte.cases[b].route, 2);
    let avant = p.cout_case(b);
    p.royaumes[0].niveau_routes = 1;
    p.recalculer_routes();
    assert!(avant < p.cout_case(b), "une meilleure route est plus rapide");
}
