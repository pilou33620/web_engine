//! La carte : un plateau d'hexagones (pointe en haut, lignes impaires décalées : « odd-r »),
//! générée selon les réglages du joueur (forme, océans, forêts, lacs, rivières, montagnes, gisements).

use serde::{Deserialize, Serialize};

use crate::hasard::{Bruit, Hasard};

pub const SQ3: f64 = 1.732_050_807_568_877_2;
/// Les six voisins, dans l'ordre des angles 0°, 60°, … 300° (x vers la droite, z vers le bas).
const DIRS_PAIR: [(i32, i32); 6] = [(1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1)];
const DIRS_IMPAIR: [(i32, i32); 6] = [(1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1)];

/// Bois porté par un arbre d'une forêt.
pub const BOIS_ARBRE: f32 = 12.0;

/// Les formes de carte, dans l'ordre de l'accueil ; « aleatoire » (la dernière) tire l'une des autres selon la graine.
pub const FORMES: [&str; 10] =
    ["classique", "continent", "deux_continents", "iles", "archipel", "mer_interieure", "peninsule", "cote", "terres", "aleatoire"];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Options {
    pub taille: String,
    pub forme: String,
    pub graine: u64,
    pub oceans: u32,
    pub forets: u32,
    pub lacs: u32,
    pub rivieres: u32,
    pub montagnes: u32,
    pub mines: u32,
    pub rivaux: u32,
    pub attitude: String,
    pub difficulte: f64,
    pub brigands: bool,
    pub capitale: String,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            taille: "moyenne".into(),
            forme: "classique".into(),
            graine: 1700,
            oceans: 42,
            forets: 38,
            lacs: 4,
            rivieres: 5,
            montagnes: 7,
            mines: 2,
            rivaux: 3,
            attitude: "mixte".into(),
            difficulte: 1.0,
            brigands: true,
            capitale: "Valdor".into(),
        }
    }
}

impl Options {
    /// Ramène chaque réglage dans ses bornes (une requête du navigateur n'est pas digne de confiance).
    pub fn borner(&mut self) {
        if !["petite", "moyenne", "grande"].contains(&self.taille.as_str()) {
            self.taille = "moyenne".into();
        }
        if !FORMES.contains(&self.forme.as_str()) {
            self.forme = "classique".into();
        }
        self.oceans = self.oceans.clamp(10, 75);
        self.forets = self.forets.min(85);
        self.lacs = self.lacs.min(20);
        self.rivieres = self.rivieres.min(20);
        self.montagnes = self.montagnes.min(25);
        self.mines = self.mines.clamp(1, 3);
        self.rivaux = self.rivaux.clamp(1, 5);
        if !["mixte", "agressifs", "pacifiques"].contains(&self.attitude.as_str()) {
            self.attitude = "mixte".into();
        }
        if !self.difficulte.is_finite() {
            self.difficulte = 1.0;
        }
        self.difficulte = self.difficulte.clamp(0.5, 2.0);
        self.capitale = self.capitale.chars().filter(|c| !c.is_control() && *c != '<' && *c != '>').take(18).collect();
        if self.capitale.trim().is_empty() {
            self.capitale = "Valdor".into();
        }
    }

    /// La forme réellement générée : « aleatoire » en tire une selon la graine.
    pub fn forme_reelle(&self) -> &'static str {
        if self.forme == "aleatoire" {
            return FORMES[Hasard::new(self.graine ^ 0xF0F0_F0F0).indice(FORMES.len() - 1)];
        }
        FORMES.iter().copied().find(|f| *f == self.forme).unwrap_or("classique")
    }

    pub fn dimensions(&self) -> (i32, i32) {
        match self.taille.as_str() {
            "petite" => (32, 24),
            "grande" => (58, 42),
            _ => (44, 32),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Terrain {
    Profond,
    Hautfond,
    Lac,
    Sable,
    Plaine,
    Colline,
    Montagne,
}

impl Terrain {
    pub fn nom(self) -> &'static str {
        match self {
            Terrain::Profond => "Océan",
            Terrain::Hautfond => "Haut-fond",
            Terrain::Lac => "Lac",
            Terrain::Sable => "Plage",
            Terrain::Plaine => "Plaine",
            Terrain::Colline => "Colline",
            Terrain::Montagne => "Montagne",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Case {
    pub c: i32,
    pub r: i32,
    pub t: Terrain,
    /// Altitude brute du bruit (sert à trier, pas au rendu).
    pub alt: f32,
    pub humide: f32,
    pub foret: bool,
    /// Arbres sur la case (0 à 6) : une forêt en a au moins 3.
    pub arbres: u8,
    pub bois: f32,
    pub riviere: bool,
    pub gisement: Option<String>,
    pub poissons: bool,
    pub fertile: bool,
    /// Royaume qui tient la case (-1 : terres libres).
    pub proprio: i32,
    /// Bâtiment posé sur la case.
    pub bat: Option<u32>,
    /// Composante terrestre (pour savoir si deux lieux sont reliés à pied).
    pub comp: i32,
    /// Route qui passe sur la case : 0 aucune, 1 chemin de terre, 2 route pavée, 3 route royale.
    #[serde(default)]
    pub route: u8,
    /// Biome (rendu, et le marais n'est pas cultivable) : "marais", "desert", "toundra" ou rien.
    #[serde(default)]
    pub biome: Option<String>,
}

impl Case {
    pub fn terre(&self) -> bool {
        !matches!(self.t, Terrain::Profond | Terrain::Hautfond | Terrain::Lac)
    }
    pub fn mer(&self) -> bool {
        matches!(self.t, Terrain::Profond | Terrain::Hautfond)
    }
    /// Coordonnées cubiques (distance hexagonale).
    pub fn cube(&self) -> (i32, i32, i32) {
        let x = self.c - (self.r - (self.r & 1)) / 2;
        let z = self.r;
        (x, -x - z, z)
    }
    pub fn pos(&self) -> (f64, f64) {
        (SQ3 * (self.c as f64 + 0.5 * (self.r & 1) as f64), 1.5 * self.r as f64)
    }
}

/// La silhouette d'une carte : la forme choisie et ses tirages (côté de la terre, centres des îles, isthme).
/// Les coordonnées `u`, `v` vont de 0 à 1 (ouest → est, nord → sud) ; `asp` est le rapport largeur / hauteur.
struct Silhouette {
    forme: &'static str,
    asp: f64,
    /// Côté de la terre (péninsule, côte) : 0 sud, 1 nord, 2 ouest, 3 est.
    cote: u8,
    /// Centres des îles ou des continents : (u, v, poids).
    centres: Vec<(f64, f64, f64)>,
    /// Ligne (v) de l'isthme entre deux continents ; sans isthme, des îles relais.
    isthme: Option<f64>,
}

impl Silhouette {
    fn tirer(forme: &'static str, h: &mut Hasard, l: i32, ht: i32) -> Silhouette {
        let asp = SQ3 * l as f64 / (1.5 * ht as f64);
        let mut s = Silhouette { forme, asp, cote: h.entre(0, 3) as u8, centres: Vec::new(), isthme: None };
        match forme {
            "deux_continents" => {
                let j = (h.f() - 0.5) * 0.16;
                s.centres = vec![(0.26, 0.5 + j, 1.0), (0.74, 0.5 - j, 1.0)];
                if h.p(0.5) {
                    s.isthme = Some(0.5 + (h.f() - 0.5) * 0.2);
                }
            }
            "iles" => {
                let k = h.entre(5, 8) as usize;
                s.semer(h, k, (0.11, 0.15), (0.8, 1.25));
            }
            "archipel" => {
                // six îles hautes, assez grandes pour une capitale, puis une poussière d'îlots
                s.semer(h, 6, (0.1, 0.13), (1.5, 1.8));
                s.semer(h, (l * ht) as usize / 60, (0.06, 0.09), (0.4, 0.9));
            }
            _ => {}
        }
        s
    }

    /// Ajoute `k` centres bien espacés (l'écart se resserre si la place manque), loin des bords d'au moins `marge`.
    fn semer(&mut self, h: &mut Hasard, k: usize, marge: (f64, f64), poids: (f64, f64)) {
        let mut ecart = 0.85 * (self.asp / k as f64).sqrt();
        let mut poses = 0;
        while poses < k {
            let mut place = false;
            for _ in 0..400 {
                let (u, w) = (marge.0 + h.f() * (1.0 - 2.0 * marge.0), marge.1 + h.f() * (1.0 - 2.0 * marge.1));
                if self.centres.iter().all(|c| self.dist(u, w, c.0, c.1) >= ecart) {
                    self.centres.push((u, w, poids.0 + h.f() * (poids.1 - poids.0)));
                    place = true;
                    poses += 1;
                    break;
                }
            }
            if !place {
                ecart *= 0.9;
            }
        }
    }

    /// Distance isotrope (en hauteurs de carte).
    fn dist(&self, u1: f64, v1: f64, u2: f64, v2: f64) -> f64 {
        (((u1 - u2) * self.asp).powi(2) + (v1 - v2).powi(2)).sqrt()
    }

    /// Distance au côté `cote` (0 sur ce bord, 1 au bord opposé) et écart latéral isotrope au milieu de ce bord.
    fn axes(&self, u: f64, v: f64) -> (f64, f64) {
        match self.cote {
            0 => (1.0 - v, (u - 0.5) * self.asp),
            1 => (v, (u - 0.5) * self.asp),
            2 => (u, v - 0.5),
            _ => (1.0 - u, v - 0.5),
        }
    }

    /// Part d'eau (en %) : le réglage des océans module chaque forme dans ses bornes (le curseur va de 10 à 75).
    fn eau(&self, oceans: u32) -> usize {
        let (a, b) = match self.forme {
            "continent" => (25.0, 72.0),
            "deux_continents" => (30.0, 68.0),
            "iles" => (40.0, 75.0),
            "archipel" => (45.0, 75.0),
            "mer_interieure" => (22.0, 55.0),
            "peninsule" => (45.0, 75.0),
            "cote" => (30.0, 70.0),
            "terres" => (2.0, 7.0),
            _ => return oceans as usize,
        };
        (a + (oceans.clamp(10, 75) as f64 - 10.0) * (b - a) / 65.0).round() as usize
    }

    /// Le bord de carte en (c, r) est-il forcément de la mer ?
    fn bord_mer(&self, c: i32, r: i32, l: i32, ht: i32) -> bool {
        let bords = [r == ht - 1, r == 0, c == 0, c == l - 1];
        match self.forme {
            "mer_interieure" | "terres" => false,
            // la terre tient un côté : la mer borde les trois autres
            "peninsule" => (0..4).any(|k| k != self.cote as usize && bords[k]),
            // la côte : seul le bord opposé à la terre est forcément en mer
            "cote" => bords[(self.cote ^ 1) as usize],
            _ => bords.iter().any(|&b| b),
        }
    }

    /// Altitude de la forme en (u, v) ; `b` est le bruit fin centré, `bl` un bruit large centré (contours des côtes).
    fn altitude(&self, u: f64, v: f64, b: f64, bl: f64) -> f64 {
        let (dx, dz) = ((u - 0.5) * 2.0, (v - 0.5) * 2.0);
        match self.forme {
            "continent" => 0.8 * b + 0.5 * bl - (dx * dx + dz * dz),
            "deux_continents" => {
                let r2 = self.centres.iter().map(|c| ((u - c.0) / 0.24).powi(2) + ((v - c.1) / 0.42).powi(2)).fold(9.0, f64::min);
                0.8 * b + 0.4 * bl - 0.9 * r2 - 0.9 * (-((u - 0.5) / 0.045).powi(2)).exp()
            }
            "iles" | "archipel" => {
                // les deux centres les plus proches (pondérés) : les îles se creusent le long de leurs frontières
                let (mut d1, mut d2) = (9.0, 9.0);
                for c in &self.centres {
                    let d = self.dist(u, v, c.0, c.1) / c.2;
                    if d < d1 {
                        d2 = d1;
                        d1 = d;
                    } else if d < d2 {
                        d2 = d;
                    }
                }
                let (pente, ecart) = if self.forme == "iles" { (1.8, 0.12) } else { (3.0, 0.06) };
                0.75 * b - pente * d1 - 1.2 * (1.0 - (d2 - d1) / ecart).max(0.0)
            }
            "mer_interieure" => 0.8 * b + 0.4 * bl + (dx * dx + dz * dz),
            "peninsule" => {
                let (a, lat) = self.axes(u, v);
                // une bande de terre le long du côté, puis une langue qui s'amincit vers le large
                let w = 0.2 - 0.07 * a + 2.0 * (-a / 0.1).exp();
                0.6 * b + 0.3 * bl - 0.6 * (lat / w).powi(2) - 2.0 * (a - 0.82).max(0.0)
            }
            "cote" => {
                // le bord de la terre reste terre ferme : les baies se creusent plus loin
                let a = self.axes(u, v).0;
                0.8 * b + 0.6 * bl - a + 0.5 * (1.0 - a / 0.15).max(0.0)
            }
            _ => b + 0.4 * bl,
        }
    }

    /// Retouches après le partage terre / mer : l'isthme ou les îles relais entre deux continents.
    fn retoucher(&self, m: &mut Carte, seuil: f32) {
        if self.forme != "deux_continents" {
            return;
        }
        let terre = |m: &mut Carte, c: i32, r: i32| {
            if let Some(i) = m.idx(c, r) {
                if !m.cases[i].terre() && c > 0 && r > 0 && c < m.l - 1 && r < m.h - 1 {
                    m.cases[i].t = Terrain::Plaine;
                    m.cases[i].alt = seuil + 0.01;
                }
            }
        };
        let mi = m.l / 2;
        match self.isthme {
            Some(vi) => {
                // trois rangs de terre, du milieu vers chaque rive, jusqu'à toucher la terre
                let r0 = (vi * m.h as f64) as i32;
                for r in r0 - 1..=r0 + 1 {
                    for sens in [-1, 1] {
                        for k in 0..m.l / 4 {
                            let c = mi + sens * k;
                            if k > 0 && m.idx(c, r).is_some_and(|i| m.cases[i].terre()) {
                                break;
                            }
                            terre(m, c, r);
                        }
                    }
                }
            }
            None => {
                for k in 1..=3 {
                    let i = m.idx(mi, (0.25 * k as f64 * m.h as f64) as i32).unwrap_or(0);
                    for j in m.rayon(i, 1) {
                        let (c, r) = (m.cases[j].c, m.cases[j].r);
                        terre(m, c, r);
                    }
                }
            }
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Carte {
    pub l: i32,
    pub h: i32,
    pub cases: Vec<Case>,
    pub rivieres: Vec<Vec<usize>>,
}

impl Carte {
    pub fn idx(&self, c: i32, r: i32) -> Option<usize> {
        if c < 0 || r < 0 || c >= self.l || r >= self.h {
            None
        } else {
            Some((r * self.l + c) as usize)
        }
    }

    pub fn voisin_dir(&self, i: usize, d: usize) -> Option<usize> {
        let k = &self.cases[i];
        let (dc, dr) = if k.r & 1 == 1 { DIRS_IMPAIR[d] } else { DIRS_PAIR[d] };
        self.idx(k.c + dc, k.r + dr)
    }

    pub fn voisins(&self, i: usize) -> Vec<usize> {
        (0..6).filter_map(|d| self.voisin_dir(i, d)).collect()
    }

    pub fn dist(&self, a: usize, b: usize) -> i32 {
        let (x1, y1, z1) = self.cases[a].cube();
        let (x2, y2, z2) = self.cases[b].cube();
        (x1 - x2).abs().max((y1 - y2).abs()).max((z1 - z2).abs())
    }

    /// Les cases à `rayon` ou moins de `i` (`i` comprise).
    pub fn rayon(&self, i: usize, rayon: i32) -> Vec<usize> {
        let k = &self.cases[i];
        let mut v = Vec::new();
        for r in (k.r - rayon)..=(k.r + rayon) {
            for c in (k.c - rayon - 1)..=(k.c + rayon + 1) {
                if let Some(j) = self.idx(c, r) {
                    if self.dist(i, j) <= rayon {
                        v.push(j);
                    }
                }
            }
        }
        v
    }

    /// Numérote les composantes de terre praticable (montagnes exclues) ; rend la taille de chacune.
    pub fn composantes(&mut self) -> Vec<usize> {
        for k in self.cases.iter_mut() {
            k.comp = -1;
        }
        let mut tailles = Vec::new();
        for i in 0..self.cases.len() {
            if !self.cases[i].terre() || self.cases[i].t == Terrain::Montagne || self.cases[i].comp >= 0 {
                continue;
            }
            let id = tailles.len() as i32;
            let mut pile = vec![i];
            self.cases[i].comp = id;
            let mut n = 0;
            while let Some(x) = pile.pop() {
                n += 1;
                for y in self.voisins(x) {
                    let k = &self.cases[y];
                    if k.terre() && k.t != Terrain::Montagne && k.comp < 0 {
                        self.cases[y].comp = id;
                        pile.push(y);
                    }
                }
            }
            tailles.push(n);
        }
        tailles
    }

    /// Met à jour la forêt d'une case d'après son bois.
    pub fn regler_arbres(&mut self, i: usize) {
        let k = &mut self.cases[i];
        if k.foret {
            k.arbres = ((k.bois / BOIS_ARBRE).ceil() as i32).clamp(0, 6) as u8;
            if k.bois <= 0.01 {
                k.foret = false;
                k.bois = 0.0;
                k.arbres = 0;
            }
        }
    }

    /// Les étendues de mer de moins de 12 cases (toutes si `toutes`) deviennent des lacs.
    fn mers_fermees(&mut self, toutes: bool) {
        let mut vu = vec![false; self.cases.len()];
        for i in 0..self.cases.len() {
            if vu[i] || self.cases[i].t != Terrain::Profond {
                continue;
            }
            let mut eau = vec![i];
            vu[i] = true;
            let mut k = 0;
            while k < eau.len() {
                for j in self.voisins(eau[k]) {
                    if !vu[j] && self.cases[j].t == Terrain::Profond {
                        vu[j] = true;
                        eau.push(j);
                    }
                }
                k += 1;
            }
            if toutes || eau.len() < 12 {
                for j in eau {
                    self.cases[j].t = Terrain::Lac;
                }
            }
        }
    }

    /// Distance de chaque case à l'eau la plus proche (99 sans eau à portée).
    fn distance_eau(&self) -> Vec<u32> {
        let mut d = vec![99; self.cases.len()];
        let mut file: std::collections::VecDeque<usize> = (0..self.cases.len()).filter(|&i| !self.cases[i].terre()).collect();
        for &i in &file {
            d[i] = 0;
        }
        while let Some(i) = file.pop_front() {
            for j in self.voisins(i) {
                if d[j] > d[i] + 1 {
                    d[j] = d[i] + 1;
                    file.push_back(j);
                }
            }
        }
        d
    }

    /// Génère une carte selon les réglages.
    pub fn generer(o: &Options) -> Carte {
        let mut h = Hasard::new(o.graine.wrapping_add(1));
        let (l, ht) = o.dimensions();
        let ne = Bruit::new(o.graine);
        let nm = Bruit::new(o.graine.wrapping_add(101));
        let nr = Bruit::new(o.graine.wrapping_add(202));
        let nl = Bruit::new(o.graine.wrapping_add(303));
        let wx = SQ3 * l as f64;
        let hz = 1.5 * ht as f64;
        let f = 3.4 / wx;
        // la forme a son propre hasard : la carte classique reste celle d'avant les formes
        let forme = o.forme_reelle();
        let classique = forme == "classique";
        let sil = Silhouette::tirer(forme, &mut Hasard::new(o.graine.wrapping_add(404)), l, ht);
        let mut brut = Vec::with_capacity((l * ht) as usize);
        let mut cases = Vec::with_capacity((l * ht) as usize);
        for r in 0..ht {
            for c in 0..l {
                let x = SQ3 * (c as f64 + 0.5 * (r & 1) as f64);
                let z = 1.5 * r as f64;
                let b = ne.octaves(x * f, z * f, 5);
                brut.push(b);
                let mut e = if classique {
                    let dx = (x / wx - 0.5) * 2.0;
                    let dz = (z / hz - 0.5) * 2.0;
                    let d = (dx * dx * 0.85 + dz * dz * 0.85).powf(1.2);
                    b - 0.5 * d
                } else {
                    sil.altitude(x / wx, z / hz, b - 0.5, nl.octaves(x * f * 0.5, z * f * 0.5, 2) - 0.5)
                };
                if sil.bord_mer(c, r, l, ht) {
                    e = -9.0;
                }
                cases.push(Case {
                    c,
                    r,
                    t: Terrain::Plaine,
                    alt: e as f32,
                    humide: nm.octaves(x * f * 1.7, z * f * 1.7, 4) as f32,
                    foret: false,
                    arbres: 0,
                    bois: 0.0,
                    riviere: false,
                    gisement: None,
                    poissons: false,
                    fertile: false,
                    proprio: -1,
                    bat: None,
                    comp: -1,
                    route: 0,
                    biome: None,
                });
            }
        }
        let mut m = Carte { l, h: ht, cases, rivieres: Vec::new() };
        let n = m.cases.len();

        // océans : pourcentage exact des cases
        let mut tri: Vec<usize> = (0..n).collect();
        tri.sort_by(|&a, &b| m.cases[a].alt.total_cmp(&m.cases[b].alt));
        let n_eau = n * sil.eau(o.oceans) / 100;
        for (k, &i) in tri.iter().enumerate() {
            if k < n_eau || m.cases[i].alt < -5.0 {
                m.cases[i].t = Terrain::Profond;
            }
        }
        if !classique {
            let seuil = m.cases[tri[n_eau.min(n - 1)]].alt;
            sil.retoucher(&mut m, seuil);
            m.mers_fermees(forme == "terres");
        }
        // montagnes puis collines, sur les terres les plus hautes (crêtes : bruit en plus) ; hors de la carte
        // classique, la forme ne compte pas : le relief suit le bruit et s'éloigne des côtes
        let dcote = if classique { Vec::new() } else { m.distance_eau() };
        let mut terres: Vec<(usize, f64)> = (0..n)
            .filter(|&i| m.cases[i].terre())
            .map(|i| {
                let (x, z) = m.cases[i].pos();
                let base = if classique { m.cases[i].alt as f64 } else { brut[i] + 0.035 * dcote[i].min(8) as f64 };
                (i, base + 0.3 * nr.octaves(x * f * 2.6, z * f * 2.6, 3))
            })
            .collect();
        terres.sort_by(|a, b| b.1.total_cmp(&a.1));
        let nt = terres.len();
        let n_mt = nt * o.montagnes as usize / 100;
        let n_col = (nt as f64 * (o.montagnes.max(3) as f64) / 100.0 * 1.4) as usize;
        for (k, &(i, _)) in terres.iter().enumerate() {
            if k < n_mt {
                m.cases[i].t = Terrain::Montagne;
            } else if k < n_mt + n_col {
                m.cases[i].t = Terrain::Colline;
            }
        }
        // hauts-fonds : le long des côtes, et parfois un peu plus loin
        for i in 0..n {
            if m.cases[i].t == Terrain::Profond && m.voisins(i).iter().any(|&j| m.cases[j].terre()) {
                m.cases[i].t = Terrain::Hautfond;
            }
        }
        // l'archipel a des hauts-fonds en plus, qui s'étendent entre les îles
        for p in if forme == "archipel" { vec![0.35, 0.6, 0.45] } else { vec![0.35] } {
            let loin: Vec<usize> = (0..n)
                .filter(|&i| m.cases[i].t == Terrain::Profond && m.voisins(i).iter().any(|&j| m.cases[j].t == Terrain::Hautfond))
                .collect();
            for i in loin {
                if h.p(p) {
                    m.cases[i].t = Terrain::Hautfond;
                }
            }
        }
        // lacs
        for _ in 0..o.lacs {
            let cand: Vec<usize> = (0..n)
                .filter(|&i| m.cases[i].t == Terrain::Plaine && m.voisins(i).iter().all(|&j| m.cases[j].terre()))
                .collect();
            let Some(&s) = h.choix(&cand) else { break };
            m.cases[s].t = Terrain::Lac;
            let mut lac = vec![s];
            let taille = h.entre(1, 5);
            for _ in 1..taille {
                let bord: Vec<usize> = lac
                    .iter()
                    .flat_map(|&x| m.voisins(x))
                    .filter(|&y| {
                        m.cases[y].terre() && m.cases[y].t != Terrain::Montagne && m.voisins(y).iter().all(|&z| !m.cases[z].mer())
                    })
                    .collect();
                let Some(&y) = h.choix(&bord) else { break };
                m.cases[y].t = Terrain::Lac;
                lac.push(y);
            }
        }
        // rivières : descendent des reliefs vers l'eau
        for _ in 0..o.rivieres {
            let mut sources: Vec<usize> = (0..n)
                .filter(|&i| {
                    matches!(m.cases[i].t, Terrain::Montagne | Terrain::Colline)
                        && !m.cases[i].riviere
                        && m.voisins(i).iter().any(|&j| m.cases[j].terre() && m.cases[j].t != Terrain::Montagne)
                })
                .collect();
            if sources.is_empty() {
                sources = (0..n).filter(|&i| m.cases[i].terre()).collect();
            }
            let Some(&s) = h.choix(&sources) else { break };
            let mut cur = s;
            let mut chemin = vec![s];
            let mut vu = std::collections::HashSet::from([s]);
            for pas in 0..60 {
                let mut ns: Vec<usize> =
                    m.voisins(cur).into_iter().filter(|j| !vu.contains(j) && m.cases[*j].t != Terrain::Montagne).collect();
                if let Some(&w) = ns.iter().find(|&&j| !m.cases[j].terre()) {
                    chemin.push(w);
                    break;
                }
                if let Some(&rv) = ns.iter().find(|&&j| m.cases[j].riviere) {
                    if pas > 1 {
                        chemin.push(rv);
                        break;
                    }
                }
                if ns.is_empty() {
                    break;
                }
                let bruit: Vec<f64> = ns.iter().map(|_| h.f() * 0.07).collect();
                let mut ordre: Vec<(usize, f64)> = ns.drain(..).zip(bruit).map(|(j, b)| (j, m.cases[j].alt as f64 + b)).collect();
                ordre.sort_by(|a, b| a.1.total_cmp(&b.1));
                cur = ordre[0].0;
                vu.insert(cur);
                chemin.push(cur);
            }
            if chemin.len() < 3 {
                continue;
            }
            let dernier = *chemin.last().unwrap();
            if m.cases[dernier].terre() && !m.cases[dernier].riviere {
                m.cases[dernier].t = Terrain::Lac;
            }
            for &i in &chemin {
                if m.cases[i].terre() && m.cases[i].t != Terrain::Montagne {
                    m.cases[i].riviere = true;
                }
            }
            m.rivieres.push(chemin);
        }
        // forêts : pourcentage exact des terres boisables
        let mut boisables: Vec<(usize, f64)> = (0..n)
            .filter(|&i| matches!(m.cases[i].t, Terrain::Plaine | Terrain::Colline))
            .map(|i| (i, m.cases[i].humide as f64 + h.f() * 0.12))
            .collect();
        boisables.sort_by(|a, b| b.1.total_cmp(&a.1));
        let n_f = boisables.len() * o.forets as usize / 100;
        for &(i, _) in boisables.iter().take(n_f) {
            let a = h.entre(4, 6) as u8;
            let k = &mut m.cases[i];
            k.foret = true;
            k.arbres = a;
            k.bois = a as f32 * BOIS_ARBRE;
        }
        // plages, gisements, poissons, fertilité, arbres épars
        for i in 0..n {
            let cote = m.voisins(i).iter().any(|&j| m.cases[j].mer());
            let k = &m.cases[i];
            if k.t == Terrain::Plaine && !k.foret && !k.riviere && cote && h.p(0.5) {
                m.cases[i].t = Terrain::Sable;
            }
        }
        for i in 0..n {
            let t = m.cases[i].t;
            if matches!(t, Terrain::Colline | Terrain::Montagne) && h.p(0.16 * o.mines as f64) {
                let x = h.f();
                m.cases[i].gisement = Some(if x < 0.42 { "pierre" } else if x < 0.72 { "fer" } else if x < 0.88 { "charbon" } else { "or" }.into());
            }
            if t == Terrain::Hautfond && h.p(0.2) {
                m.cases[i].poissons = true;
            }
            if t == Terrain::Plaine && (m.cases[i].riviere || m.voisins(i).iter().any(|&j| m.cases[j].t == Terrain::Lac || m.cases[j].riviere)) {
                m.cases[i].fertile = true;
            }
            let k = &mut m.cases[i];
            if !k.foret && k.t == Terrain::Plaine && h.p(0.18) {
                k.arbres = h.entre(1, 2) as u8;
            } else if !k.foret && k.t == Terrain::Colline && h.p(0.15) {
                k.arbres = 1;
            }
        }
        m.biomes(o.graine);
        m.composantes();
        m
    }

    /// Les biomes, tirés à part (leur propre bruit) : les cartes d'avant restent les mêmes.
    /// Désert : les plaines et le sable les plus secs, loin de toute eau ; marais : plaines basses au bord d'un lac ou d'une
    /// rivière (plus cultivables) ; toundra : le nord de la carte et les terres prises entre des montagnes.
    fn biomes(&mut self, graine: u64) {
        let (nd, nm) = (Bruit::new(graine.wrapping_add(505)), Bruit::new(graine.wrapping_add(606)));
        let n = self.cases.len();
        let f = 3.0 / (SQ3 * self.l as f64);
        let bruit = |b: &Bruit, k: &Case| { let (x, z) = k.pos(); b.octaves(x * f, z * f, 3) };
        // seuil : la valeur au-dessus de laquelle se trouve la part p des cases de terre (des taches, pas des cases isolées)
        let terre: Vec<usize> = (0..n).filter(|&i| self.cases[i].terre()).collect();
        let seuil = |b: &Bruit, p: f64| {
            let mut v: Vec<f64> = terre.iter().map(|&i| bruit(b, &self.cases[i])).collect();
            v.sort_by(|a, b| b.total_cmp(a));
            v.get((v.len() as f64 * p) as usize).copied().unwrap_or(f64::MAX)
        };
        let (sd, sm) = (seuil(&nd, 0.10), seuil(&nm, 0.45));
        for i in 0..n {
            let vs = self.voisins(i);
            let k = &self.cases[i];
            let eau = vs.iter().any(|&j| !self.cases[j].terre() || self.cases[j].riviere);
            let montagnes = vs.iter().filter(|&&j| self.cases[j].t == Terrain::Montagne).count();
            let b = if matches!(k.t, Terrain::Plaine | Terrain::Sable) && !k.foret && !k.riviere && !k.fertile && !eau && bruit(&nd, k) >= sd {
                Some("desert")
            } else if k.t == Terrain::Plaine && !k.foret && vs.iter().any(|&j| self.cases[j].t == Terrain::Lac || self.cases[j].riviere) && bruit(&nm, k) >= sm {
                Some("marais")
            } else if matches!(k.t, Terrain::Plaine | Terrain::Colline) && ((k.r as f64) < self.h as f64 * 0.08 || montagnes >= 2) {
                Some("toundra")
            } else {
                None
            };
            if b == Some("marais") { self.cases[i].fertile = false; }
            self.cases[i].biome = b.map(String::from);
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;

    #[test]
    fn biomes() {
        let m = Carte::generer(&Options::default());
        let compte = |b: &str| m.cases.iter().filter(|k| k.biome.as_deref() == Some(b)).count();
        let terre = m.cases.iter().filter(|k| k.terre()).count();
        for b in ["desert", "marais", "toundra"] { assert!(compte(b) > 0 && compte(b) < terre / 4, "{b} : {} sur {terre}", compte(b)); }
        assert!(m.cases.iter().all(|k| k.biome.as_deref() != Some("marais") || !k.fertile), "un marais ne se cultive pas");
        assert!(m.cases.iter().all(|k| k.biome.is_none() || k.terre()));
    }

    #[test]
    fn generation_reglable() {
        let mut o = Options::default();
        o.graine = 12345;
        let a = Carte::generer(&o);
        let b = Carte::generer(&o);
        assert_eq!(a.cases.len(), 44 * 32);
        assert!(a.cases.iter().zip(&b.cases).all(|(x, y)| x.t == y.t), "même graine, même carte");
        let eau = a.cases.iter().filter(|k| !k.terre()).count() as f64 / a.cases.len() as f64;
        assert!(eau > 0.35 && eau < 0.6, "océans {eau}");
        o.forets = 80;
        let c = Carte::generer(&o);
        let f1 = a.cases.iter().filter(|k| k.foret).count();
        let f2 = c.cases.iter().filter(|k| k.foret).count();
        assert!(f2 > f1 * 3 / 2, "plus de forêts : {f1} → {f2}");
        o.lacs = 12;
        o.rivieres = 12;
        let d = Carte::generer(&o);
        assert!(d.rivieres.len() >= 6);
        assert!(d.cases.iter().filter(|k| k.t == Terrain::Lac).count() >= 8);
    }

    /// Tailles des masses de terre (montagnes comprises), de la plus grande à la plus petite.
    fn masses(m: &Carte) -> Vec<usize> {
        let mut vu = vec![false; m.cases.len()];
        let mut t = Vec::new();
        for i in 0..m.cases.len() {
            if vu[i] || !m.cases[i].terre() {
                continue;
            }
            vu[i] = true;
            let mut pile = vec![i];
            let mut k = 0;
            while let Some(x) = pile.pop() {
                k += 1;
                for y in m.voisins(x) {
                    if !vu[y] && m.cases[y].terre() {
                        vu[y] = true;
                        pile.push(y);
                    }
                }
            }
            t.push(k);
        }
        t.sort_by(|a, b| b.cmp(a));
        t
    }

    /// Part de terre (lacs compris) sur un bord : 0 sud, 1 nord, 2 ouest, 3 est.
    fn bord_terre(m: &Carte, s: usize) -> f64 {
        let bord: Vec<&Case> = m.cases.iter().filter(|k| [k.r == m.h - 1, k.r == 0, k.c == 0, k.c == m.l - 1][s]).collect();
        bord.iter().filter(|k| !k.mer()).count() as f64 / bord.len() as f64
    }

    #[test]
    fn formes_reconnaissables() {
        for &forme in &FORMES[..FORMES.len() - 1] {
            for taille in ["petite", "moyenne", "grande"] {
                for graine in [1u64, 7, 42, 1789, 31337] {
                    let o = Options { forme: forme.into(), taille: taille.into(), graine, ..Options::default() };
                    let m = Carte::generer(&o);
                    let ctx = format!("{forme} {taille} graine {graine}");
                    let n = m.cases.len() as f64;
                    let terre = m.cases.iter().filter(|k| k.terre()).count() as f64;
                    let part = terre / n;
                    let ms = masses(&m);
                    let grandes = |seuil: usize| ms.iter().filter(|&&t| t >= seuil).count();
                    let bords: Vec<f64> = (0..4).map(|s| bord_terre(&m, s)).collect();
                    let mers = m.cases.iter().filter(|k| k.mer()).count() as f64;
                    assert!(part > 0.2, "{ctx} : trop peu de terre ({part:.2})");
                    match forme {
                        "classique" => assert!(part < 0.85, "{ctx} : {part:.2}"),
                        "continent" => {
                            assert!(ms[0] as f64 >= 0.8 * terre, "{ctx} : masse principale {} sur {terre}", ms[0]);
                            assert!(bords.iter().all(|&b| b == 0.0), "{ctx} : l'océan entoure le continent");
                        }
                        "deux_continents" => {
                            let bande = |a: f64, b: f64| m.cases.iter().filter(move |k| (k.c as f64) >= a * m.l as f64 && (k.c as f64) < b * m.l as f64);
                            let detroit = bande(0.46, 0.54).filter(|k| !k.terre()).count() as f64 / bande(0.46, 0.54).count() as f64;
                            assert!(detroit >= 0.6, "{ctx} : bras de mer {detroit:.2}");
                            for (a, b) in [(0.0, 0.42), (0.58, 1.0)] {
                                let t = bande(a, b).filter(|k| k.terre()).count() as f64;
                                assert!(t >= 0.3 * terre, "{ctx} : un continent trop petit ({t} sur {terre})");
                            }
                        }
                        "iles" => {
                            assert!(grandes(15) >= 4, "{ctx} : grandes îles {:?}", ms);
                            assert!((ms[0] as f64) < 0.5 * terre, "{ctx} : une île écrase les autres {:?}", ms);
                        }
                        "archipel" => {
                            assert!(grandes(3) >= 8, "{ctx} : îles {:?}", ms);
                            assert!((ms[0] as f64) < 0.3 * terre, "{ctx} : une île écrase les autres {:?}", ms);
                            let hf = m.cases.iter().filter(|k| k.t == Terrain::Hautfond).count() as f64;
                            assert!(hf >= 0.35 * mers, "{ctx} : hauts-fonds {hf} sur {mers}");
                        }
                        "mer_interieure" => {
                            let bord: f64 = bords.iter().sum::<f64>() / 4.0;
                            assert!(bord >= 0.85, "{ctx} : le bord est surtout de la terre ({bord:.2})");
                            assert!(mers >= 0.15 * n, "{ctx} : la mer intérieure ({mers})");
                            let centre = m.idx(m.l / 2, m.h / 2).unwrap();
                            assert!(m.cases[centre].mer(), "{ctx} : la mer est au centre");
                        }
                        "peninsule" => {
                            let tenus: Vec<usize> = (0..4).filter(|&s| bords[s] > 0.0).collect();
                            assert!(tenus.len() == 1 && bords[tenus[0]] >= 0.5, "{ctx} : rattachée par un seul côté {bords:.2?}");
                            assert!(part < 0.62, "{ctx} : {part:.2}");
                        }
                        "cote" => {
                            let s = (0..4).max_by(|&a, &b| bords[a].total_cmp(&bords[b])).unwrap();
                            assert!(bords[s] >= 0.8 && bords[s ^ 1] == 0.0, "{ctx} : terre d'un côté, océan de l'autre {bords:.2?}");
                        }
                        "terres" => {
                            assert!(mers == 0.0, "{ctx} : pas de mer ({mers})");
                            assert!(part >= 0.88, "{ctx} : {part:.2}");
                        }
                        _ => unreachable!(),
                    }
                }
            }
        }
        // « aleatoire » donne l'une des autres formes, toujours la même pour une graine
        let o = Options { forme: "aleatoire".into(), graine: 5, ..Options::default() };
        assert!(FORMES[..FORMES.len() - 1].contains(&o.forme_reelle()));
        assert_eq!(o.forme_reelle(), o.forme_reelle());
        let vues: std::collections::HashSet<&str> =
            (0..40).map(|g| Options { forme: "aleatoire".into(), graine: g, ..Options::default() }.forme_reelle()).collect();
        assert!(vues.len() >= 6, "le tirage varie : {vues:?}");
    }

    #[test]
    fn voisinage() {
        let m = Carte::generer(&Options::default());
        let i = m.idx(10, 10).unwrap();
        let v = m.voisins(i);
        assert_eq!(v.len(), 6);
        assert!(v.iter().all(|&j| m.dist(i, j) == 1));
        assert_eq!(m.rayon(i, 2).len(), 19);
    }
}
