//! L'économie de l'ordinateur. Chaque mois où il décide (selon la difficulté), le rival fait son bilan
//! (`Bilan` : réserves, production, consommation, besoins) puis agit comme un joueur, avec les mêmes ordres
//! et les mêmes contrôles (commandes.rs) : impôts, pauses, recherche, rang de ville, colonie, éclairage,
//! commerce, routes, et surtout le bon bâtiment au bon endroit (bûcheron près des bois, pêcheur sur la côte,
//! ferme sur la terre fertile…). Son caractère (belliqueux, marchand, bâtisseur) pondère ses priorités.

use crate::carte::Terrain;
use crate::commandes::tarif;
use crate::meteo;
use crate::partie::Partie;
use crate::regles::{regles, DefBat, Panier};

use super::{qualite, Qualite};

/// Ce que le rival sait de lui-même ce mois-ci.
pub struct Bilan {
    pub pop: f64,
    pub logement: f64,
    pub libres: f64,
    pub rang: u32,
    pub bonheur: f64,
    /// production attendue par mois (moyenne de l'année pour les récoltes, chantiers compris)
    pub prod: Panier,
    /// les réserves visées, et le besoin de chaque ressource (0 : rien ne manque, 1 : manque franc, plus : urgence)
    pub cible: Panier,
    pub besoin: Panier,
    /// mois de vivres en réserve
    pub mois_vivres: f64,
    /// besoins qui ne sont pas des marchandises
    pub b_logement: f64,
    pub b_bonheur: f64,
    pub b_or: f64,
    pub b_savoir: f64,
    pub b_defense: f64,
    /// ce que l'on met de côté pour monter la capitale de rang, et si la population y suffit déjà
    pub epargne: Panier,
    pub rang_proche: bool,
    /// couvertures des services (0 à 1) : hygiène, foi, tavernes
    pub hygiene: f64,
    pub foi: f64,
    pub taverne: f64,
    pub decor: f64,
    pub stockage_plein: bool,
    pub vivres_pleins: bool,
    /// le pays est à l'étroit : peu de terre libre où bâtir (une tour ou une colonie l'agrandiraient)
    pub b_territoire: f64,
    /// un filon de fer à prendre au-delà des frontières (une tour l'y ferait entrer)
    pub filon: bool,
    /// un filon de fer à creuser dans le territoire, sans mine encore : on garde les outils de la mine
    pub creuser: bool,
}

/// La terre libre où bâtir dans le territoire de `id` (ni forêt, ni montagne, ni bâtiment).
fn places_libres(p: &Partie, id: i32) -> usize {
    p.carte.cases.iter().filter(|k| k.proprio == id && k.terre() && k.t != Terrain::Montagne && k.bat.is_none() && !k.foret).count()
}

/// Production moyenne sur l'année d'une culture (1 hors des récoltes).
fn saison_moyenne(d: &DefBat) -> f64 {
    d.saison.as_deref().map_or(1.0, |c| (0..12).map(|m| meteo::saisonnier(c, m)).sum::<f64>() / 12.0)
}

/// Le bois qu'un bûcheron sur `c` trouverait encore dans les forêts voisines.
fn bois_autour(p: &Partie, c: usize) -> f64 {
    p.carte.voisins(c).iter().filter(|&&v| p.carte.cases[v].foret).map(|&v| p.carte.cases[v].bois as f64).sum()
}

/// Un bâtiment `cle` sur la case `x` ?
fn bati(p: &Partie, x: usize, cle: &str) -> bool {
    p.carte.cases[x].bat.and_then(|b| p.bat(b)).is_some_and(|b| b.cle == cle)
}

fn bucheron_sur(p: &Partie, x: usize) -> bool {
    bati(p, x, "bucheron")
}

/// La terre où un forestier sur `c` replanterait (rayon 2, comme dans tour.rs) au bord des coupes d'un bûcheron,
/// et qu'aucun autre forestier ne replante déjà.
fn terre_a_planter(p: &Partie, c: usize) -> f64 {
    let id = p.carte.cases[c].proprio;
    p.carte
        .rayon(c, 2)
        .iter()
        .filter(|&&x| {
            let kx = &p.carte.cases[x];
            matches!(kx.t, Terrain::Plaine | Terrain::Colline)
                && kx.bat.is_none()
                && kx.proprio == id
                && kx.arbres < 6
                && p.carte.voisins(x).iter().any(|&w| bucheron_sur(p, w))
                && !p.carte.rayon(x, 2).iter().any(|&w| w != c && bati(p, w, "forestier"))
        })
        .count() as f64
}

/// Le bois des forêts voisines de `c` qui lui reviendrait : chaque forêt se partage avec les autres bûcherons qui la bordent.
fn bois_libre(p: &Partie, c: usize) -> f64 {
    p.carte
        .voisins(c)
        .iter()
        .filter(|&&v| p.carte.cases[v].foret)
        .map(|&v| p.carte.cases[v].bois as f64 / (1.0 + p.carte.voisins(v).iter().filter(|&&w| w != c && bucheron_sur(p, w)).count() as f64))
        .sum()
}

/// Ce que le rival `k` garde d'une ressource quand on veut la lui acheter (vivres, bois de chauffage, matériaux).
pub fn reserve(p: &Partie, k: usize, r: &str) -> f64 {
    let pop = p.royaumes[k].pop as f64;
    let rg = regles();
    if rg.nourriture.iter().any(|x| x == r) {
        pop * 0.3 * 1.5
    } else {
        match r {
            "bois" => 20.0 + pop * rg.chauffage.par_habitant * rg.chauffage.grand_froid * 2.0,
            "planches" | "pierre" => 20.0,
            "outils" => 10.0,
            _ => 0.0,
        }
    }
}

/// Le rival `k` peut-il payer `cout` (armée, forts, fortifications…) sans entamer ce qu'il garde (vivres, bois de
/// chauffage, matériaux : `reserve`) et en gardant `marge` or en caisse ?
pub fn peut_depenser(p: &Partie, k: usize, cout: &Panier, marge: f64) -> bool {
    // en paix, le Village passe avant l'armée : au Hameau, l'or du rang reste en caisse quand la population en approche
    let pop = p.royaumes[k].pop as f64;
    let niveau = p.niveau_capitale(k as i32);
    let rang = regles().niveau(niveau + 1).filter(|n| niveau == 1 && pop >= n.pop as f64 * 0.75 && p.royaumes[k].statut != "guerre");
    let marge = marge + rang.map_or(0.0, |n| n.cout.get("or").copied().unwrap_or(0.0));
    p.peut_payer(k as i32, cout)
        && cout.iter().all(|(r, v)| {
            let reste = p.royaumes[k].stock.get(r).copied().unwrap_or(0.0) - v;
            reste >= if r == "or" { marge } else { reserve(p, k, r) }
        })
}

/// Le bilan du rival `k`, avec l'`horizon` (mois de réserve) que lui permet sa difficulté.
pub fn bilan(p: &Partie, k: usize, horizon: f64) -> Bilan {
    let rg = regles();
    let id = k as i32;
    let r = &p.royaumes[k];
    let s = p.stats(id);
    let pop = r.pop as f64;
    let st = |x: &str| r.stock.get(x).copied().unwrap_or(0.0);
    let rang = p.niveau_capitale(id);
    // les bâtiments travaillent si la population suffit à les pourvoir
    let mien: Vec<&crate::partie::Batiment> = p.batiments.iter().filter(|b| b.proprio == id).collect();
    let postes: f64 = mien.iter().map(|b| rg.bat(&b.cle).map_or(0, |d| d.ouvriers) as f64).sum();
    let pourvus = if postes > 0.0 { ((pop - s.soldats as f64) / postes).clamp(0.0, 1.0) } else { 1.0 };
    let (mut prod, mut conso) = (Panier::new(), Panier::new());
    for b in &mien {
        let d = rg.bat(&b.cle).unwrap();
        if b.pause {
            continue;
        }
        let staff = if d.ouvriers > 0 { pourvus } else { 1.0 };
        let mut f = staff * saison_moyenne(d) * multiplicateur_site(p, &b.cle, b.case);
        if b.cle == "bucheron" && b.fini() && bois_autour(p, b.case) < 1.0 {
            f = 0.0;
        }
        for (x, q) in &d.prod {
            *prod.entry(x.clone()).or_insert(0.0) += q * f;
        }
        for (x, q) in &d.conso {
            *conso.entry(x.clone()).or_insert(0.0) += q * staff;
        }
    }
    // la population mange, se chauffe, boit et s'habille
    let c = &rg.chauffage;
    let mois = meteo::mois(p.tour);
    let hiver_proche = matches!(mois, 8..=11 | 0..=1);
    let chauffe = pop * c.par_habitant * c.grand_froid;
    *conso.entry("bois".into()).or_insert(0.0) += chauffe * 0.35;
    let boire = s.taverne.min(pop) * 0.1;
    let besoin_boisson = boire;
    let vetir = pop * 0.05;
    *conso.entry("tissu".into()).or_insert(0.0) += vetir;
    let p_ = |x: &str| prod.get(x).copied().unwrap_or(0.0);
    let c_ = |x: &str| conso.get(x).copied().unwrap_or(0.0);
    let nb = |cle: &str| mien.iter().filter(|b| b.cle == cle).count() as f64;
    // le rang suivant : on met de côté ce qu'il coûte dès que la population en approche, sauf s'il y manque
    // une marchandise qu'on ne produit pas (épargner pour un rang hors d'atteinte bloquerait tout)
    let suivant = rg.niveau(rang + 1).filter(|n| pop >= n.pop as f64 * 0.75 && n.cout.iter().all(|(x, q)| x == "or" || st(x) >= *q || p_(x) > 0.0));
    let epargne: Panier = suivant.map(|n| n.cout.clone()).unwrap_or_default();
    let mut cible = Panier::new();
    let mut fixe = |x: &str, v: f64| {
        cible.insert(x.to_string(), v + epargne.get(x).copied().unwrap_or(0.0));
    };
    fixe("bois", 30.0 + 15.0 * horizon + if hiver_proche { chauffe * 3.0 } else { chauffe });
    fixe("planches", 25.0 + 10.0 * rang as f64);
    fixe("pierre", 25.0 + 15.0 * rang as f64);
    fixe("outils", 10.0 + 5.0 * rang as f64);
    fixe("minerai", 10.0 * nb("fonderie"));
    fixe("fer", 6.0 * (nb("forge") + nb("armurerie") + nb("usine")) + if rang >= 4 { 20.0 } else { 0.0 });
    fixe("farine", 6.0 + 8.0 * nb("boulangerie"));
    fixe("laine", 6.0 * (nb("tisserand") + nb("manufacture")));
    fixe("tissu", vetir * horizon + if rang >= 3 { 10.0 } else { 0.0 });
    fixe("biere", besoin_boisson * horizon / 2.0);
    fixe("vin", besoin_boisson * horizon / 2.0);
    fixe("armes", if rang >= 2 { 4.0 } else { 0.0 });
    fixe("charbon", if rg.epoque(p.annee()).cle == "industrie" { chauffe * 2.0 } else { 0.0 } + 8.0 * (nb("haut_fourneau") + nb("usine")));
    let mut besoin = Panier::new();
    for (x, &ci) in &cible {
        if ci <= 0.0 {
            continue;
        }
        let net = p_(x) - c_(x);
        let mut b = ((ci - st(x) - net * horizon) / ci).clamp(0.0, 2.0);
        if net < 0.0 && st(x) < ci {
            b += 0.5;
        }
        // le bois et la pierre font tout le reste : n'en produire aucun est grave
        if matches!(x.as_str(), "bois" | "pierre") && p_(x) <= 0.0 {
            b += 1.0;
        }
        besoin.insert(x.clone(), b);
    }
    // les chaînes : ce qui manque en aval donne envie de l'amont (outils ← fer ← minerai, tissu ← laine)
    let derive = |besoin: &mut Panier, amont: &str, aval: &[&str]| {
        let v = aval.iter().map(|x| besoin.get(*x).copied().unwrap_or(0.0)).fold(0.0, f64::max) * 0.7;
        let e = besoin.entry(amont.to_string()).or_insert(0.0);
        *e = e.max(v);
    };
    derive(&mut besoin, "fer", &["outils", "armes"]);
    derive(&mut besoin, "minerai", &["fer"]);
    derive(&mut besoin, "laine", &["tissu"]);
    // les vivres se valent (le pain, le poisson, la viande…) : un seul besoin, plus la variété
    let manger = pop * 0.3;
    let vivres: f64 = rg.nourriture.iter().map(|x| st(x)).sum();
    let net_vivres: f64 = rg.nourriture.iter().map(|x| p_(x) - c_(x)).sum::<f64>() - manger;
    // l'hiver, les champs ne donnent rien : avant lui, on remplit les greniers
    let cible_vivres = manger * (horizon + 1.0 + if matches!(mois, 6..=10) { 2.0 } else { 0.0 });
    let mut b_vivres = ((cible_vivres - vivres - net_vivres.min(0.0) * horizon) / cible_vivres.max(1.0)).clamp(0.0, 2.5);
    if net_vivres < 0.0 {
        b_vivres += 0.4 + (-net_vivres / manger.max(1.0)).min(1.5);
    }
    for x in &rg.nourriture {
        let variete = if p_(x) <= 0.0 && st(x) < 1.0 { 0.3 } else { 0.0 };
        besoin.insert(x.clone(), b_vivres + variete);
    }
    let mois_vivres = vivres / manger.max(1.0);
    // logement : la population bute sur son plafond (et peut grandir : bonheur, vivres)
    let plein = pop + 3.0 >= s.logement as f64;
    let mut b_logement = if plein { 1.5 } else if pop + 10.0 >= s.logement as f64 { 0.6 } else { 0.1 };
    if suivant.is_some_and(|n| (s.logement as f64) < n.pop as f64 + 5.0) {
        b_logement += 0.5;
    }
    if r.ouvriers_libres <= 0 && postes > 0.0 {
        b_logement += 0.4;
    }
    if r.bonheur < 35.0 || mois_vivres < 1.0 || r.famine {
        b_logement *= 0.3;
    }
    let or = st("or");
    let b_or = ((150.0 + 100.0 * rang as f64 - or) / (150.0 + 100.0 * rang as f64)).clamp(0.0, 1.5) + if r.revenus.get("impots").copied().unwrap_or(0.0) < r.revenus.get("entretien").copied().unwrap_or(0.0) { 0.8 } else { 0.0 };
    let b_bonheur = ((65.0 - r.bonheur) / 20.0).clamp(0.2, 2.5);
    let b_savoir = if rang >= 2 { 0.6 } else { 0.2 };
    let caserne = p.a_batiment(id, "caserne") || mien.iter().any(|b| b.cle == "caserne");
    let b_defense = if r.statut == "guerre" { 2.0 } else { 0.4 } + if caserne { 0.0 } else { 0.8 };
    let cap_vivres = p.capacite(&s, "pain");
    // on agrandit les entrepôts quand ce qu'on veut garder n'y tient plus (pas pour entasser ce qui déborde)
    let stockage_plein = cible.iter().any(|(x, &ci)| !rg.est_vivre(x) && ci >= s.stockage * 0.85);
    let vivres_pleins = cible_vivres >= cap_vivres * 0.85;
    // un filon de fer connu, libre, à portée d'une ville, quand on manque de fer et qu'on n'a où creuser
    // un filon de fer à creuser chez soi, tant qu'on n'a pas de mine (et qu'on manque de fer)
    let creuser = besoin.get("minerai").copied().unwrap_or(0.0) >= 0.3
        && !mien.iter().any(|b| b.cle == "mine_fer")
        && (0..p.carte.cases.len()).any(|c| p.carte.cases[c].proprio == id && p.peut_construire("mine_fer", c, id).is_ok());
    let filon = besoin.get("minerai").copied().unwrap_or(0.0) >= 0.5
        && !creuser
        && !mien.iter().any(|b| b.cle == "mine_fer")
        && p.carte.cases.iter().enumerate().any(|(c, kc)| kc.gisement.as_deref() == Some("fer") && kc.proprio == -1 && p.connait(id, c) && p.villes.iter().any(|v| v.proprio == id && p.carte.dist(v.case, c) <= 7));
    Bilan {
        pop,
        logement: s.logement as f64,
        libres: r.ouvriers_libres as f64,
        rang,
        bonheur: r.bonheur,
        prod,
        cible,
        besoin,
        mois_vivres,
        b_logement,
        b_bonheur,
        b_or,
        b_savoir,
        b_defense,
        // au Hameau, le Village se prépare tôt : sans lui, ni comptoir pour acheter le bois, ni colonie
        rang_proche: suivant.is_some_and(|n| pop >= n.pop as f64 * if rang == 1 { 0.75 } else { 1.0 }),
        epargne,
        hygiene: (s.hygiene / pop.max(1.0)).min(1.0),
        foi: (s.foi / pop.max(1.0)).min(1.0),
        taverne: (s.taverne / pop.max(1.0)).min(1.0),
        decor: s.decor,
        stockage_plein,
        vivres_pleins,
        b_territoire: (1.0 - places_libres(p, id) as f64 / 8.0).clamp(0.0, 1.0) * 1.5,
        filon,
        creuser,
    }
}

/// Ce qu'une case ajoute à la production d'un bâtiment : terre fertile, eaux poissonneuses, filon de pierre, bois sur pied.
pub fn multiplicateur_site(p: &Partie, cle: &str, c: usize) -> f64 {
    let k = &p.carte.cases[c];
    let vois = p.carte.voisins(c);
    match cle {
        "ferme" if k.fertile => 1.5,
        "pecheur" | "port" if vois.iter().any(|&v| p.carte.cases[v].poissons) => 1.5,
        "carriere" if k.gisement.as_deref() == Some("pierre") || vois.iter().any(|&v| p.carte.cases[v].gisement.as_deref() == Some("pierre")) => 1.4,
        // un bûcheron vide les bois voisins : 150 de bois sur pied (à lui), c'est un an de coupe
        "bucheron" => (bois_libre(p, c) / 150.0).min(1.0),
        // un forestier sans terre à replanter près des bûcherons ne sert à rien
        "forestier" => (terre_a_planter(p, c) / 3.0).min(1.0),
        _ => 1.0,
    }
}

/// Ce que vaut une ressource (or : 1).
fn valeur(r: &str) -> f64 {
    if r == "or" {
        1.0
    } else {
        regles().prix.get(r).copied().unwrap_or(1.0)
    }
}

/// L'intérêt d'un bâtiment pour le rival, en or par mois environ, sur une case qui multiplie sa production par `mult`.
pub fn utilite(p: &Partie, k: usize, b: &Bilan, cle: &str, mult: f64) -> f64 {
    let rg = regles();
    let d = rg.bat(cle).unwrap();
    let besoin = |r: &str| b.besoin.get(r).copied().unwrap_or(0.0);
    let dispo = |r: &str| p.royaumes[k].stock.get(r).copied().unwrap_or(0.0) + b.prod.get(r).copied().unwrap_or(0.0) * 2.0;
    let mut u = 0.0;
    let f = saison_moyenne(d) * mult;
    for (r, q) in &d.prod {
        let w = if r == "or" { 0.6 + b.b_or } else { 0.15 + besoin(r) };
        u += q * f * valeur(r) * w;
    }
    for (r, q) in &d.conso {
        // un atelier sans matière première ne sert à rien
        if dispo(r) < q * 0.5 {
            return 0.0;
        }
        u -= q * valeur(r) * (0.1 + besoin(r) * 0.5);
    }
    // chaque point de bonheur fait grandir la ville et rentrer l'impôt
    let point = (1.0 + b.pop * 0.02) * b.b_bonheur;
    let part = |offre: f64, couverture: f64| (offre / b.pop.max(1.0)).min(1.0 - couverture).max(0.0);
    u += d.logement as f64 * 1.2 * b.b_logement;
    u += 7.0 * part(d.hygiene, b.hygiene) * point * if b.hygiene < 0.5 && b.pop > 30.0 { 1.5 } else { 1.0 };
    u += 10.0 * part(d.foi, b.foi) * point;
    if d.taverne > 0.0 {
        let boissons = rg.boissons.iter().any(|x| dispo(x) > 1.0) as u8 as f64;
        u += 10.0 * part(d.taverne, b.taverne) * point * (0.3 + 0.7 * boissons);
    }
    u += d.decor.min((15.0 - b.decor).max(0.0)) * point;
    u += d.taxe * b.pop * 0.5 * (0.6 + b.b_or);
    u += d.savoir * 2.0 * b.b_savoir;
    if d.stockage > 0.0 && b.stockage_plein {
        u += 15.0;
    }
    if d.stock_vivres > 0.0 && (b.vivres_pleins || b.mois_vivres > 4.0) {
        u += 12.0;
    }
    // une tour garde la frontière, mais pas avant d'avoir de quoi vivre
    u += d.defense * 0.3 * b.b_defense * if b.rang >= 2 { 1.0 } else { 0.3 };
    if d.territoire > 0 {
        // chaque tour de plus gagne moins de terre
        let tours = p.batiments.iter().filter(|x| x.proprio == k as i32 && x.cle == cle).count() as f64;
        u += d.territoire as f64 * (8.0 * b.b_territoire + if b.filon { 12.0 } else { 0.0 }) / (1.0 + tours * 0.5);
    }
    // un puits sauve du feu les maisons de bois
    if d.hygiene > 0.0 && b.hygiene < 0.6 {
        u += 6.0;
    }
    let a = |cle: &str| p.batiments.iter().any(|x| x.proprio == k as i32 && x.cle == cle);
    match cle {
        "caserne" if !a("caserne") => u += 25.0 * b.b_defense,
        // le filon est là, sans mine : c'est elle qui ouvre la chaîne des outils (Bourg, port, armes)
        "mine_fer" if b.creuser => u += 25.0,
        "comptoir" if !a("comptoir") && !a("port") => u += 18.0,
        // le port : la pêche, le commerce des flûtes et la marine
        "port" if !a("port") => u += 90.0 + 20.0 * b.b_or + 10.0 * b.b_defense,
        "marche" if !a("marche") => u += 6.0 * point,
        "ecole" if !a("ecole") => u += 8.0 + if p.siecle_lumieres() { 4.0 * point } else { 0.0 },
        "taverne" if !a("taverne") => u += 3.0,
        "forestier" => {
            // replanter avant que les bois des bûcherons ne soient rasés
            let bucherons: Vec<usize> = p.batiments.iter().filter(|x| x.proprio == k as i32 && x.cle == "bucheron").map(|x| x.case).collect();
            let forestiers = p.batiments.iter().filter(|x| x.proprio == k as i32 && x.cle == "forestier").count();
            let epuises = bucherons.iter().filter(|&&c| bois_autour(p, c) < 200.0).count();
            if forestiers < epuises {
                u += 15.0 * (0.5 + besoin("bois"));
            }
        }
        _ => {}
    }
    // le caractère pondère : un belliqueux arme, un marchand commerce, un bâtisseur embellit et loge
    let caractere = match (p.royaumes[k].caractere.as_str(), d.cat.as_str()) {
        ("guerrier", "militaire") => 1.8,
        ("marchand", "commerce") => 1.6,
        ("batisseur", "habitat" | "services") => 1.4,
        _ => 1.0,
    };
    // au Hameau, le bois et la pierre vont à la ville : l'armée attend le Village (sauf en guerre ; une tour qui gagne de la terre, non)
    let hameau = if b.rang == 1 && d.cat == "militaire" && d.territoire == 0 && p.royaumes[k].statut != "guerre" { 0.25 } else { 1.0 };
    // un bâtiment sans ouvriers pour le faire tourner rend peu
    let main = if d.ouvriers > 0 { (b.libres / d.ouvriers as f64).clamp(0.25, 1.0) } else { 1.0 };
    let cout = regles().valeur(&d.cout);
    u * caractere * hameau * main / (1.0 + cout / 200.0)
}

/// Le meilleur emplacement de `cle` pour `id` (rend la case et ce qu'elle multiplie), parmi `n` cases au plus.
fn emplacement(p: &mut Partie, id: i32, cle: &str, q: &Qualite) -> Option<(usize, f64)> {
    let d = regles().bat(cle).unwrap();
    let villes: Vec<(usize, u32)> = p.villes.iter().filter(|v| v.proprio == id).map(|v| (v.case, v.niveau)).collect();
    let mut cases: Vec<(usize, usize)> = Vec::new();
    for &(centre, niveau) in &villes {
        for c in p.carte.rayon(centre, niveau as i32 + 4) {
            if !cases.iter().any(|x| x.0 == c) && p.carte.cases[c].proprio == id && p.carte.cases[c].bat.is_none() && p.peut_construire(cle, c, id).is_ok() && p.connait(id, c) {
                cases.push((c, centre));
            }
        }
    }
    if cases.is_empty() {
        return None;
    }
    if cases.len() > q.sites {
        p.hasard.melanger(&mut cases);
        cases.truncate(q.sites);
    }
    if p.hasard.p(q.erreur) {
        let (c, _) = cases[p.hasard.indice(cases.len())];
        return Some((c, multiplicateur_site(p, cle, c)));
    }
    let eau = matches!(d.besoin.as_deref(), Some("eau" | "cote"));
    let sans_carriere = !p.batiments.iter().any(|x| x.proprio == id && x.cle == "carriere");
    let ferme = matches!(cle, "ferme" | "champ_patates" | "bergerie" | "vignoble");
    let score = |c: usize, centre: usize| -> f64 {
        let k = &p.carte.cases[c];
        let mult = multiplicateur_site(p, cle, c);
        let mut s = mult * 4.0 - p.carte.dist(c, centre) as f64 * if d.cat == "habitat" { 1.2 } else { 0.6 };
        if cle == "bucheron" {
            // des bois, et de la terre libre autour où un forestier replantera
            let libre = p.carte.voisins(c).iter().filter(|&&x| matches!(p.carte.cases[x].t, Terrain::Plaine | Terrain::Colline) && p.carte.cases[x].bat.is_none()).count() as f64;
            s += bois_libre(p, c) / 60.0 + libre * 0.3;
        } else if cle == "forestier" {
            s += 1.5 * terre_a_planter(p, c);
        } else {
            // on garde les bois (surtout ceux des bûcherons), les terres fertiles et la côte pour ceux qui en vivent
            s -= k.arbres as f64 * 1.0 + (bois_autour(p, c) > 0.0) as u8 as f64 * 0.5;
            // ni sur les coupes des bûcherons, ni sur la terre des forestiers
            if p.carte.voisins(c).iter().any(|&v| bucheron_sur(p, v)) {
                s -= if k.foret { 5.0 } else { 1.5 };
            }
            if p.carte.rayon(c, 2).iter().any(|&v| bati(p, v, "forestier")) {
                s -= 1.0;
            }
        }
        if k.fertile && !ferme {
            s -= 1.5;
        }
        if !eau && p.carte.voisins(c).iter().any(|&v| p.carte.cases[v].mer()) {
            s -= 0.8;
        }
        if k.t == Terrain::Colline && cle != "carriere" {
            s -= 0.3;
        }
        if cle == "tour" {
            s += 2.0 * p.carte.rayon(c, 2).iter().any(|&x| p.carte.cases[x].proprio >= 0 && p.carte.cases[x].proprio != id) as u8 as f64;
        }
        if d.territoire > 0 {
            // gagner de la terre libre (des bois, un filon, une colline pour la carrière qui manque) au-delà des frontières
            s += p.carte.rayon(c, d.territoire).iter().filter(|&&x| p.carte.cases[x].proprio == -1 && p.carte.cases[x].terre()).map(|&x| {
                let kx = &p.carte.cases[x];
                let roche = matches!(kx.t, Terrain::Colline | Terrain::Montagne) || kx.gisement.as_deref() == Some("pierre");
                0.6 + kx.foret as u8 as f64 * 0.6
                    + if kx.gisement.is_some() && kx.gisement.as_deref() != Some("pierre") { 8.0 } else { 0.0 }
                    + if roche && sans_carriere { 3.0 } else { 0.0 }
            }).sum::<f64>();
        }
        s
    };
    cases.iter().map(|&(c, centre)| (c, score(c, centre))).max_by(|a, b| a.1.total_cmp(&b.1)).map(|(c, _)| (c, multiplicateur_site(p, cle, c)))
}

/// Le mois économique du rival `k`.
pub fn mois(p: &mut Partie, k: usize) {
    let q = qualite(p.options.difficulte);
    // il ne réagit qu'un mois sur `delai` (en facile) : le reste du temps, son royaume vit sur sa lancée
    if (p.tour + k as u32) % q.delai != 0 {
        return;
    }
    let b = bilan(p, k, q.horizon);
    marchandises(p, k, &b);
    impots(p, k, &b, &q);
    pauses(p, k, &b);
    recherche(p, k, &b, &q);
    rang(p, k);
    eclairage(p, k);
    commerce(p, k, &b);
    let b = bilan(p, k, q.horizon);
    colonie(p, k, &b);
    terres(p, k, &q);
    demolir_inutile(p, k, &b);
    construire(p, k, &b, &q);
    if p.hasard.p(0.1) && p.royaumes[k].stock["or"] > 500.0 {
        routes(p, k);
    }
}

/// Ses surplus (vendus bon marché) et ce qui lui manque (acheté cher), d'après ses réserves.
fn marchandises(p: &mut Partie, k: usize, b: &Bilan) {
    let st = &p.royaumes[k].stock;
    let mut surplus: Vec<(String, f64)> = regles()
        .prix
        .keys()
        .filter_map(|r| {
            let x = st.get(r).copied().unwrap_or(0.0);
            let ci = b.cible.get(r).copied().unwrap_or(0.0).max(reserve(p, k, r)).max(15.0);
            (x >= 30.0 && x >= ci * 1.5).then(|| (r.clone(), x / ci))
        })
        .collect();
    surplus.sort_by(|a, c| c.1.total_cmp(&a.1));
    let mut demande: Vec<(String, f64)> = b.besoin.iter().filter(|(r, &v)| v >= 0.5 && regles().prix.contains_key(*r)).map(|(r, &v)| (r.clone(), v)).collect();
    demande.sort_by(|a, c| c.1.total_cmp(&a.1).then(a.0.cmp(&c.0)));
    let r = &mut p.royaumes[k];
    r.surplus = surplus.into_iter().take(3).map(|x| x.0).collect();
    r.demande = demande.into_iter().filter(|x| !r.surplus.contains(&x.0)).take(3).map(|x| x.0).collect();
}

/// Les impôts : bas quand le peuple gronde ou a faim, élevés quand il est heureux et que la caisse est vide.
fn impots(p: &mut Partie, k: usize, b: &Bilan, q: &Qualite) {
    let r = &mut p.royaumes[k];
    r.impots = if b.bonheur < 40.0 || r.famine {
        "bas"
    } else if b.bonheur > 68.0 && b.b_or > 0.4 && q.erreur < 0.2 {
        "eleve"
    } else {
        "normal"
    }
    .into();
}

/// Les pauses : l'automne et l'hiver, scieries et fonderies s'arrêtent pour garder le bois de chauffage ;
/// un atelier sans matière première libère ses ouvriers, et reprend quand elle revient.
fn pauses(p: &mut Partie, k: usize, b: &Bilan) {
    let id = k as i32;
    let rg = regles();
    let c = &rg.chauffage;
    let froid = matches!(meteo::saison(meteo::mois(p.tour)), 0 | 3);
    let st = p.royaumes[k].stock.clone();
    // le bois de chauffage l'hiver, et celui du rang suivant quand la population y suffit
    let epargne = |r: &str| b.epargne.get(r).copied().unwrap_or(0.0);
    let garder_bois = (froid && st["bois"] < b.pop * c.par_habitant * c.grand_froid * 3.0) || (b.rang_proche && st["bois"] < epargne("bois") + 10.0 && st["planches"] >= epargne("planches"));
    let mut ordres = Vec::new();
    for x in p.batiments.iter().filter(|x| x.proprio == id && x.fini()) {
        let d = rg.bat(&x.cle).unwrap();
        if d.conso.is_empty() {
            continue;
        }
        let brule_bois = d.conso.contains_key("bois");
        let sans_matiere = d.conso.iter().any(|(r, v)| st.get(r).copied().unwrap_or(0.0) < *v && b.prod.get(r).copied().unwrap_or(0.0) <= 0.0);
        // inutile de transformer ce qui manque en ce qui déborde (le bois en planches quand les planches s'entassent)
        let deborde = |r: &String| b.cible.get(r).is_some_and(|&ci| st.get(r).copied().unwrap_or(0.0) >= (ci * 1.5).max(40.0));
        let superflu = d.prod.keys().all(deborde) && d.conso.keys().any(|r| b.besoin.get(r).copied().unwrap_or(0.0) >= 0.5);
        let voulu = (brule_bois && garder_bois) || sans_matiere || superflu;
        if x.pause != voulu {
            ordres.push(x.id);
        }
    }
    for bid in ordres {
        let _ = p.pause(id, bid);
    }
}

/// La recherche : la technologie la plus utile à ses besoins et à son caractère (au hasard s'il se trompe).
fn recherche(p: &mut Partie, k: usize, b: &Bilan, q: &Qualite) {
    if p.royaumes[k].recherche.is_some() {
        return;
    }
    let id = k as i32;
    let an = p.annee();
    let possibles: Vec<&str> = regles().techs.iter().filter(|t| t.annee <= an && !p.a_tech(id, &t.cle)).map(|t| t.cle.as_str()).collect();
    if possibles.is_empty() {
        return;
    }
    let caractere = p.royaumes[k].caractere.clone();
    let vivres = b.besoin.get("pain").copied().unwrap_or(0.0);
    let interet = |t: &str| -> f64 {
        let cout = regles().tech(t).map_or(100.0, |d| d.cout);
        let mut v: f64 = match t {
            "assolement" | "parmentier" | "engrais" => 2.0 + vivres,
            "manufactures" | "filature" | "vapeur" | "coke" => 1.4,
            "lumieres" => 1.6,
            "routes" | "cartographie" => 1.2,
            "silex" | "vauban" | "gribeauval" | "levee_masse" | "percussion" => 1.0,
            _ => 1.0,
        };
        v *= match (caractere.as_str(), t) {
            ("guerrier", "silex" | "vauban" | "gribeauval" | "levee_masse" | "percussion" | "marine_royale") => 2.0,
            ("marchand", "routes" | "cartographie" | "manufactures" | "marine_royale" | "chemin_fer") => 1.8,
            ("batisseur", "lumieres" | "vapeur" | "manufactures" | "filature" | "coke") => 1.8,
            _ => 1.0,
        };
        v * 100.0 / cout
    };
    let t = if p.hasard.p(q.erreur) {
        possibles[p.hasard.indice(possibles.len())].to_string()
    } else {
        possibles.iter().max_by(|a, c| interet(a).total_cmp(&interet(c))).unwrap().to_string()
    };
    let _ = p.rechercher(id, &t);
}

/// Le rang des villes : la capitale d'abord, puis les autres (jamais au-dessus d'elle), aux vraies conditions.
fn rang(p: &mut Partie, k: usize) {
    let id = k as i32;
    let mut villes: Vec<usize> = (0..p.villes.len()).filter(|&vi| p.villes[vi].proprio == id).collect();
    villes.sort_by_key(|&vi| (!p.villes[vi].capitale, p.villes[vi].niveau));
    for vi in villes {
        if p.ameliorer_ville(id, vi).is_ok() {
            return;
        }
    }
}

/// L'éclairage public : allumé dès qu'il est permis et que la caisse le permet, éteint quand elle se vide.
pub fn eclairage(p: &mut Partie, k: usize) {
    let id = k as i32;
    let entretien = regles().eclairage.entretien;
    for vi in 0..p.villes.len() {
        if p.villes[vi].proprio != id {
            continue;
        }
        let or = p.royaumes[k].stock.get("or").copied().unwrap_or(0.0);
        let allume = p.villes[vi].eclairage;
        if allume && or < entretien * 3.0 {
            let _ = p.eclairer(id, vi, false);
        } else if !allume && or >= 150.0 && p.peut_eclairer(vi).is_ok() {
            let _ = p.eclairer(id, vi, true);
        }
    }
}

/// Le colporteur passe (tour.rs, comme chez le joueur) : le rival prend ses outils s'il en manque et peut les payer
/// sans entamer sa caisse. Sans filon de fer, c'est avec le commerce la seule source d'outils (mine, port, Bourg).
pub fn colporteur(p: &mut Partie, k: usize) {
    let (r, n, or) = crate::tour::COLPORTEUR;
    let rang = p.niveau_capitale(k as i32) as f64;
    let prix = Panier::from([("or".to_string(), or)]);
    if p.royaumes[k].stock.get(r).copied().unwrap_or(0.0) < 10.0 + 10.0 * rang && peut_depenser(p, k, &prix, 80.0) {
        p.payer(k as i32, &prix);
        p.crediter(k as i32, &Panier::from([(r.to_string(), n)]));
    }
}

/// Ce qu'un rival qui n'a pas `r` en surplus garde avant d'en vendre un lot : un fonds de roulement (la chaîne
/// du fer, les armes) en plus de ce que `reserve` met de côté.
fn garde_vendeur(p: &Partie, j: usize, r: &str) -> f64 {
    20.0 + 2.0 * reserve(p, j, r)
}

/// Le marché : avec un comptoir ou un port, il achète aux autres rivaux, au prix du vendeur, des lots de ce qui
/// lui manque le plus (deux par mois au plus), s'il garde assez d'or : à qui l'a en surplus d'abord, sinon à qui
/// en a de reste (les outils et le fer d'un royaume qui a sa mine, pour qui n'a pas de filon).
fn commerce(p: &mut Partie, k: usize, b: &Bilan) {
    let id = k as i32;
    let s = p.stats(id);
    if !s.comptoir && !s.port {
        return;
    }
    let mut achats = 0;
    for r in p.royaumes[k].demande.clone() {
        if achats >= 2 || b.besoin.get(&r).copied().unwrap_or(0.0) < 0.8 {
            break;
        }
        let vendeur = (1..p.royaumes.len())
            .filter(|&j| j != k && p.royaumes[j].vivant && !super::diplomatie::en_guerre(p, k as i32, j as i32))
            .filter(|&j| p.royaumes[j].surplus.contains(&r) || p.royaumes[j].stock.get(&r).copied().unwrap_or(0.0) >= 10.0 + garde_vendeur(p, j, &r))
            .map(|j| (j, tarif(&p.royaumes[j], &r, true, super::diplomatie::relation(p, k, j))))
            .min_by(|a, c| a.1.total_cmp(&c.1));
        let Some((j, px)) = vendeur else { continue };
        if p.royaumes[k].stock["or"] - px < 80.0 + b.epargne.get("or").copied().unwrap_or(0.0) {
            break;
        }
        if p.lot(k, j, &r, px).is_ok() {
            achats += 1;
        }
    }
}

/// Les routes : pavées, royales, impériales puis empierrées quand le trésor déborde.
fn routes(p: &mut Partie, k: usize) {
    let id = k as i32;
    let cible = p.niveau_routes(id) + 1;
    if cible <= 5 && p.peut_payer(id, &p.cout_routes(id, cible)) {
        let _ = p.ameliorer_routes(id);
    }
}

/// Comme le joueur, il achète une terre libre au bord du royaume quand il manque de place pour bâtir et que l'or
/// lui reste après l'achat (d'autant plus souvent qu'il est habile) : la meilleure (gisement, terre fertile, plaine), la plus proche de sa capitale.
fn terres(p: &mut Partie, k: usize, q: &Qualite) {
    let id = k as i32;
    let prix = Panier::from([("or".to_string(), p.prix_terre(id))]);
    // l'armée d'abord : en paix seulement, avec de quoi se défendre
    if places_libres(p, id) >= 4 || p.royaumes[k].statut == "guerre" || p.stats(id).soldats < 10 || !peut_depenser(p, k, &prix, 400.0) || !p.hasard.p(0.05 + 0.3 * q.jugement) {
        return;
    }
    let Some(cap) = p.capitale(id).map(|vi| p.villes[vi].case) else { return };
    let valeur = |c: usize| {
        let x = &p.carte.cases[c];
        (x.gisement.is_some() as i32) * 3 + (x.fertile as i32) * 2 + (x.t == Terrain::Plaine) as i32 - p.carte.dist(c, cap)
    };
    // une terre où bâtir (ni forêt, ni montagne) : c'est la place qui lui manque
    let choix = (0..p.carte.cases.len())
        .filter(|&c| { let x = &p.carte.cases[c]; x.terre() && x.t != Terrain::Montagne && !x.foret && x.proprio == -1 })
        .filter(|&c| p.carte.voisins(c).iter().any(|&v| p.carte.cases[v].proprio == id))
        .max_by_key(|&c| valeur(c));
    if let Some(c) = choix {
        let _ = p.acheter_terre(id, c);
    }
}

/// Une colonie quand le pays est à l'étroit : un Village au moins, de quoi la payer, des colons disponibles,
/// une terre libre et bonne (plaines, bois, eau) à portée de ses frontières.
fn colonie(p: &mut Partie, k: usize, b: &Bilan) {
    let id = k as i32;
    let rg = regles();
    let d = rg.bat("colonie").unwrap();
    let villes = p.villes.iter().filter(|v| v.proprio == id).count();
    let en_cours = p.batiments.iter().any(|x| x.proprio == id && x.cle == "colonie");
    let envie = if p.royaumes[k].caractere == "batisseur" { 0.5 } else { 0.3 } + b.b_territoire * 0.3;
    let etroit = b.b_territoire >= 1.0 && b.pop >= 40.0;
    if villes >= 4 || en_cours || b.rang < d.niveau || (b.pop < 60.0 && !etroit) || b.mois_vivres < 2.0 || b.pop + 6.0 < b.logement * 0.9 {
        return;
    }
    // sans entamer l'épargne du rang
    let mut avec_epargne = d.cout.clone();
    for (r, v) in avec_epargne.iter_mut() {
        *v += b.epargne.get(r).copied().unwrap_or(0.0);
    }
    // les outils de la mine de fer d'abord
    let outils = p.royaumes[k].stock.get("outils").copied().unwrap_or(0.0) - avec_epargne.get("outils").copied().unwrap_or(0.0);
    if !p.peut_payer(id, &avec_epargne) || p.royaumes[k].stock["or"] < avec_epargne["or"] + 100.0 || (b.creuser && outils < 4.0) || !p.hasard.p(envie) {
        return;
    }
    let portee = if p.a_tech(id, "cartographie") { 5 } else { 3 };
    let mut cand: Vec<usize> = Vec::new();
    for v in p.villes.iter().filter(|v| v.proprio == id) {
        for c in p.carte.rayon(v.case, v.niveau as i32 + 2 + portee) {
            if !cand.contains(&c) && p.carte.cases[c].t == Terrain::Plaine && p.connait(id, c) && p.peut_construire("colonie", c, id).is_ok() {
                cand.push(c);
            }
        }
    }
    // sans filon de fer chez soi (ni mine), la colonie va le chercher : outils, Bourg, port et flotte en dépendent
    let sans_fer = !b.creuser && !p.batiments.iter().any(|x| x.proprio == id && x.cle == "mine_fer");
    let bonne = |c: usize| -> i32 {
        p.carte
            .rayon(c, 2)
            .iter()
            .map(|&x| {
                let kx = &p.carte.cases[x];
                if kx.proprio != -1 {
                    -1
                } else {
                    let fer = kx.gisement.as_deref() == Some("fer") && sans_fer;
                    (kx.t == Terrain::Plaine) as i32 + kx.foret as i32 + kx.fertile as i32 + kx.poissons as i32 + kx.gisement.is_some() as i32 + 8 * fer as i32
                }
            })
            .sum()
    };
    if let Some(c) = cand.into_iter().max_by_key(|&c| (bonne(c), std::cmp::Reverse(c))) {
        let _ = p.construire(id, "colonie", c);
    }
}

/// À l'étroit, sans terre où loger son monde : on rase un bâtiment qui ne sert plus (un bûcheron sans bois,
/// un forestier sans terre à replanter) pour rendre la case (et la moitié des matériaux), comme le ferait un joueur.
fn demolir_inutile(p: &mut Partie, k: usize, b: &Bilan) {
    let id = k as i32;
    if b.b_territoire < 1.0 || b.b_logement < 1.0 {
        return;
    }
    let inutile = p.batiments.iter().find(|x| {
        x.proprio == id && x.fini() && ((x.cle == "bucheron" && bois_autour(p, x.case) < 1.0) || (x.cle == "forestier" && x.etat.starts_with("🌱 0 ")))
    });
    if let Some(c) = inutile.map(|x| x.case) {
        if p.demolir(c).is_ok() {
            p.recalculer_routes();
        }
    }
}

/// Les chantiers du mois : les bâtiments les plus utiles qu'il peut payer (sans toucher à l'épargne du rang,
/// sauf urgence), chacun à son meilleur emplacement. Pas plus de chantiers ouverts que son rang n'en permet.
fn construire(p: &mut Partie, k: usize, b: &Bilan, q: &Qualite) {
    let id = k as i32;
    let rg = regles();
    // même étourdi, on ne se trompe pas quand la disette menace
    let q = &Qualite { erreur: if b.mois_vivres < 1.5 || p.royaumes[k].famine { 0.0 } else { q.erreur }, ..*q };
    let ouverts = p.batiments.iter().filter(|x| x.proprio == id && !x.fini()).count();
    let max_chantiers = (1 + b.rang as usize + (p.royaumes[k].caractere == "batisseur") as usize).min(5);
    if ouverts >= max_chantiers {
        return;
    }
    let niveau = b.rang;
    let mut cand: Vec<(&str, f64)> = rg
        .batiments
        .iter()
        .filter(|d| !matches!(d.cat.as_str(), "aucune" | "admin") && d.niveau <= niveau && d.tech.as_ref().map_or(true, |t| p.a_tech(id, t)))
        .filter(|d| d.cle != "palais" || b.rang >= 5)
        .map(|d| (d.cle.as_str(), utilite(p, k, b, &d.cle, 1.0)))
        .filter(|x| x.1 > 0.5)
        .collect();
    // il n'examine qu'une partie des possibles (selon la difficulté)
    if cand.len() > q.options {
        p.hasard.melanger(&mut cand);
        cand.truncate(q.options);
    }
    cand.sort_by(|a, c| c.1.total_cmp(&a.1));
    let mut lances = 0;
    // l'urgence passe avant l'épargne : vivres, bois, logement, et ce qui produit ce qu'il manque pour le rang
    let st = p.royaumes[k].stock.clone();
    let urgence = |cle: &str| -> bool {
        let d = rg.bat(cle).unwrap();
        let vivres = d.prod.keys().any(|r| b.besoin.get(r).copied().unwrap_or(0.0) >= 1.0 && rg.nourriture.contains(r));
        let manque_au_rang = |r: &String| b.epargne.get(r).is_some_and(|&e| st.get(r).copied().unwrap_or(0.0) < e);
        // quand la population suffit au rang suivant, tout attend qu'il soit payé : les vivres seuls, et de quoi
        // produire ce qu'il réclame et qu'on ne produit pas du tout
        if b.rang_proche {
            let loger = d.logement > 0 && b.pop + 3.0 >= b.logement && rg.niveau(b.rang + 1).is_some_and(|n| b.logement < n.pop as f64 + 4.0);
            return vivres || loger || d.prod.keys().any(|r| manque_au_rang(r) && b.prod.get(r).copied().unwrap_or(0.0) <= 0.0);
        }
        (d.logement > 0 && b.b_logement >= 1.0) || vivres || d.prod.keys().any(|r| r == "bois" && b.besoin.get(r).copied().unwrap_or(0.0) >= 1.0) || d.prod.keys().any(manque_au_rang)
    };
    // sans bois qui rentre, on garde de quoi bâtir un bûcheron
    let sans_bois = b.prod.get("bois").copied().unwrap_or(0.0) <= 0.0;
    // ce que réclame le rang suivant et qu'on ne produit pas encore (la pierre des premiers mois sans carrière) : on n'y touche pas,
    // au Hameau, ou quand la population y suffit presque (garder les outils d'un rang lointain bloquerait la mine, le port, l'arsenal)
    let garde: Panier = rg
        .niveau(b.rang + 1)
        .filter(|_| b.rang == 1 || b.rang_proche)
        .map(|n| n.cout.iter().filter(|(r, _)| *r != "or" && b.prod.get(*r).copied().unwrap_or(0.0) <= 0.0).map(|(r, q)| (r.clone(), q.min(st.get(r).copied().unwrap_or(0.0)))).collect())
        .unwrap_or_default();
    let mut essais = 0;
    while lances < q.actions && ouverts + lances < max_chantiers && !cand.is_empty() && essais < 6 {
        essais += 1;
        let i = if p.hasard.p(q.erreur) { p.hasard.indice(cand.len()) } else { 0 };
        let (cle, _) = cand.remove(i);
        let d = rg.bat(cle).unwrap();
        // payer sans entamer l'épargne du rang (sauf urgence : vivres, bois, logement)
        let mut avec_epargne = d.cout.clone();
        for (r, v) in avec_epargne.iter_mut() {
            *v += b.epargne.get(r).copied().unwrap_or(0.0);
        }
        if !p.peut_payer(id, &avec_epargne) && !(urgence(cle) && p.peut_payer(id, &d.cout)) {
            continue;
        }
        if sans_bois && !matches!(cle, "bucheron" | "forestier") && p.royaumes[k].stock["bois"] - d.cout.get("bois").copied().unwrap_or(0.0) < 15.0 {
            continue;
        }
        // (la chaîne du fer ne compte pas : la mine, la fonderie et la forge font les outils qui manquent)
        let fer = d.prod.keys().any(|x| x == "fer" || x == "minerai");
        let entame = d.cout.iter().any(|(r, v)| {
            let g = garde.get(r).copied().unwrap_or(0.0);
            st.get(r).copied().unwrap_or(0.0) - v < g && !d.prod.contains_key(r) && !(fer && r == "outils")
        });
        // (sauf les logements qui manquent encore pour atteindre la population du rang)
        if entame && !(d.logement > 0 && rg.niveau(b.rang + 1).is_some_and(|n| b.pop < n.pop as f64)) {
            continue;
        }
        // les outils de la mine, eux, ne vont à rien d'autre (pas même aux maisons de pierre)
        if b.creuser && !fer && d.cout.get("outils").is_some_and(|v| st.get("outils").copied().unwrap_or(0.0) - v < 4.0) {
            continue;
        }
        let Some((c, mult)) = emplacement(p, id, cle, q) else { continue };
        if mult <= 0.1 || utilite(p, k, b, cle, mult) <= 0.5 {
            continue;
        }
        if p.construire(id, cle, c).is_ok() {
            lances += 1;
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::carte::Options;

    #[test]
    fn le_rival_a_l_etroit_achete_des_terres() {
        let mut p = Partie::nouvelle(Options { graine: 11, ..Options::default() });
        p.royaumes[1].stock.insert("or".into(), 2000.0);
        let ai = p.armees.iter().position(|a| a.proprio == 1).unwrap();
        p.armees[ai].unites.insert("milice".into(), 12);
        p.royaumes[1].pop = 200;
        terres(&mut p, 1, &qualite(1.35));
        assert!(p.terres.is_empty(), "assez de place : il n'achète pas");
        for k in p.carte.cases.iter_mut().filter(|k| k.proprio == 1 && k.bat.is_none()) {
            k.foret = true; // plus de place pour bâtir
        }
        while p.terres.is_empty() {
            terres(&mut p, 1, &qualite(1.35)); // pas tous les mois (hasard)
        }
        assert_eq!(p.terres.len(), 1);
        assert_eq!(p.carte.cases[p.terres[0][0] as usize].proprio, 1);
        assert!(p.royaumes[1].stock["or"] < 2000.0);
    }

    #[test]
    fn le_rival_construit_avec_ses_reserves_et_au_bon_endroit() {
        let mut p = Partie::nouvelle(Options { graine: 42, difficulte: 1.35, brigands: false, ..Options::default() });
        let avant = p.royaumes[1].stock.clone();
        let bats = p.batiments.iter().filter(|b| b.proprio == 1).count();
        mois(&mut p, 1);
        let apres = &p.royaumes[1].stock;
        assert!(p.batiments.iter().filter(|b| b.proprio == 1).count() > bats, "il bâtit dès le premier mois");
        assert!(apres["bois"] < avant["bois"] + 1e-9 || apres["planches"] < avant["planches"], "il paie dans ses réserves");
        for b in p.batiments.iter().filter(|b| b.proprio == 1 && !b.fini()) {
            let d = regles().bat(&b.cle).unwrap();
            if d.besoin.as_deref() == Some("foret") {
                assert!(bois_autour(&p, b.case) > 0.0, "un bûcheron près des bois");
            }
            if d.besoin.as_deref() == Some("eau") {
                assert!(p.carte.voisins(b.case).iter().any(|&v| !p.carte.cases[v].terre()), "un pêcheur au bord de l'eau");
            }
        }
        // sans rien en caisse, il ne bâtit rien
        let mut q = Partie::nouvelle(Options { graine: 42, difficulte: 1.35, brigands: false, ..Options::default() });
        for v in q.royaumes[1].stock.values_mut() {
            *v = 0.0;
        }
        let bats = q.batiments.iter().filter(|b| b.proprio == 1).count();
        mois(&mut q, 1);
        assert_eq!(q.batiments.iter().filter(|b| b.proprio == 1).count(), bats);
        assert!(q.royaumes[1].stock.values().all(|&v| v >= 0.0));
    }

    #[test]
    fn surplus_et_demande_suivent_les_reserves() {
        let mut p = Partie::nouvelle(Options { graine: 7, brigands: false, ..Options::default() });
        p.royaumes[1].stock.insert("pierre".into(), 180.0);
        for r in regles().nourriture.clone() {
            p.royaumes[1].stock.insert(r, 0.0);
        }
        let b = bilan(&p, 1, 3.0);
        marchandises(&mut p, 1, &b);
        let r = &p.royaumes[1];
        assert!(r.surplus.contains(&"pierre".to_string()), "{:?}", r.surplus);
        assert!(r.demande.iter().any(|x| regles().nourriture.contains(x)), "il demande des vivres : {:?}", r.demande);
        // le prix suit : la pierre est bon marché chez lui
        assert!(crate::commandes::prix(&p, 1, "pierre", true) < crate::commandes::prix(&p, 2, "pierre", true) || p.royaumes[2].surplus.contains(&"pierre".to_string()));
    }

    #[test]
    fn la_difficulte_regle_la_qualite_pas_les_ressources() {
        let (f, n, d) = (qualite(0.75), qualite(1.0), qualite(1.35));
        assert!(f.delai > n.delai && f.erreur > n.erreur && n.erreur > d.erreur && f.horizon < d.horizon && f.options < d.options);
        assert_eq!((super::super::bonus_production(0.75), super::super::bonus_production(1.0)), (1.0, 1.0));
        assert!((super::super::bonus_production(1.35) - 1.1).abs() < 1e-9, "au plus +10 % au niveau le plus dur");
    }
}
