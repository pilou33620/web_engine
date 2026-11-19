//! Le serveur local du jeu : sert l'interface (web/) et l'API, garde la partie en mémoire,
//! la sauvegarde à chaque mois.
//!
//! Lancement :  royaumes            (puis ouvrir http://127.0.0.1:8795)
//! Options   :  --port 8795  --lan  --local  --no-browser  --browser  --no-update
//! Sur un Raspberry Pi (ou un Linux sans écran), le jeu s'ouvre tout seul au réseau local et
//! affiche son adresse ; en mode réseau, l'appairage des web tools (web_tools_commun) protège l'accès.

use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde_json::{json, Value};
use web_tools_commun::appairage::{self, Garde};
use web_tools_commun::serveur::{Reponse, Requete, Serveur};

use crate::carte::{Carte, Options};
use crate::commandes;
use crate::partie::Partie;
use crate::vue;

pub const PORT: u16 = 8795;
pub const AUTO: &str = "sauvegarde-automatique";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// La racine du jeu (web/, saves/) : le dossier courant s'il contient web/index.html, sinon le premier
/// dossier au-dessus de l'exécutable qui le contient.
pub fn racine() -> &'static Path {
    static R: OnceLock<PathBuf> = OnceLock::new();
    R.get_or_init(|| {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let jeu = |d: &Path| d.join("web").join("index.html").is_file();
        if jeu(&cwd) {
            return cwd;
        }
        let exe = std::env::current_exe().ok().and_then(|e| std::fs::canonicalize(e).ok());
        exe.and_then(|e| e.ancestors().find(|d| jeu(d)).map(Path::to_path_buf)).unwrap_or(cwd)
    })
}

fn dossier_saves() -> PathBuf {
    racine().join("saves")
}

pub struct App {
    pub partie: Option<Partie>,
    pub reseau: Vec<String>,
    pub maj: String,
}

impl App {
    pub fn new() -> App {
        let _ = std::fs::create_dir_all(dossier_saves());
        let mut app = App { partie: None, reseau: Vec::new(), maj: String::new() };
        if let Ok(p) = charger(AUTO) {
            println!("Partie reprise : {}", crate::meteo::date_texte(p.tour));
            app.partie = Some(p);
        }
        app
    }

    /// Traite une requête de l'API ; rend (code, JSON).
    pub fn api(&mut self, methode: &str, chemin: &str, corps: &[u8]) -> (u16, Value) {
        let entree: Value = if corps.is_empty() { json!({}) } else { serde_json::from_slice(corps).unwrap_or(json!({})) };
        let erreur = |m: &str| (400, json!({"ok": false, "msg": m}));
        match (methode, chemin) {
            ("GET", "/api/info") => (200, json!({
                "version": VERSION, "partie": self.partie.is_some(), "reseau": self.reseau, "maj": self.maj,
                "fin": self.partie.as_ref().and_then(|p| p.fin.as_ref()).is_some(),
            })),
            ("GET", "/api/regles") => (200, vue::regles_affichees()),
            ("POST", "/api/apercu") => {
                let mut o: Options = serde_json::from_value(entree).unwrap_or_default();
                o.borner();
                let m = Carte::generer(&o);
                (200, vue::carte(&m, 0))
            }
            ("POST", "/api/nouvelle") => {
                let o: Options = serde_json::from_value(entree).unwrap_or_default();
                let p = Partie::nouvelle(o);
                let _ = sauver(&p, AUTO);
                self.partie = Some(p);
                (200, json!({"ok": true}))
            }
            ("GET", "/api/sauvegardes") => (200, json!({"liste": liste_sauvegardes()})),
            ("POST", "/api/charger") => {
                let nom = entree.get("nom").and_then(Value::as_str).unwrap_or("");
                match charger(nom) {
                    Ok(p) => {
                        self.partie = Some(p);
                        (200, json!({"ok": true}))
                    }
                    Err(e) => erreur(&e),
                }
            }
            _ => {
                let Some(p) = self.partie.as_mut() else { return (409, json!({"ok": false, "msg": "Aucune partie en cours"})) };
                match (methode, chemin) {
                    ("GET", "/api/carte") => (200, vue::carte(&p.carte, p.version_carte)),
                    ("GET", "/api/etat") => (200, vue::etat(p)),
                    ("POST", "/api/cmd") => {
                        let r = commandes::executer(p, &entree);
                        if entree.get("action").and_then(Value::as_str) == Some("cases_valides") {
                            return (200, r.unwrap_or_else(|m| json!({"ok": false, "msg": m})));
                        }
                        let etat = vue::etat(p);
                        match r {
                            Ok(mut v) => {
                                v["etat"] = etat;
                                (200, v)
                            }
                            Err(m) => (200, json!({"ok": false, "msg": m, "etat": etat})),
                        }
                    }
                    ("POST", "/api/fin_tour") => {
                        let rapport = p.fin_du_mois();
                        let _ = sauver(p, AUTO);
                        (200, json!({"ok": true, "rapport": rapport, "etat": vue::etat(p)}))
                    }
                    ("POST", "/api/sauver") => {
                        let nom = entree.get("nom").and_then(Value::as_str).unwrap_or("partie");
                        match sauver(p, nom) {
                            Ok(n) => (200, json!({"ok": true, "msg": format!("Partie sauvegardée : {n}")})),
                            Err(e) => erreur(&e),
                        }
                    }
                    _ => (404, json!({"ok": false, "msg": "inconnu"})),
                }
            }
        }
    }
}

/// Un nom de sauvegarde sûr (pas de chemin) : lettres, chiffres, tirets.
pub fn nom_sur(nom: &str) -> String {
    let s: String = nom.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).take(40).collect();
    if s.trim_matches('-').is_empty() {
        "partie".into()
    } else {
        s
    }
}

pub fn sauver(p: &Partie, nom: &str) -> Result<String, String> {
    let n = nom_sur(nom);
    let f = dossier_saves().join(format!("{n}.json"));
    let tmp = dossier_saves().join(format!("{n}.tmp"));
    let texte = serde_json::to_string(p).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, texte).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &f).map_err(|e| e.to_string())?;
    Ok(n)
}

pub fn charger(nom: &str) -> Result<Partie, String> {
    let f = dossier_saves().join(format!("{}.json", nom_sur(nom)));
    let texte = std::fs::read_to_string(&f).map_err(|_| "Sauvegarde introuvable".to_string())?;
    Partie::relire(&texte).map_err(|e| format!("Sauvegarde illisible : {e}"))
}

fn liste_sauvegardes() -> Vec<Value> {
    let mut v = Vec::new();
    if let Ok(d) = std::fs::read_dir(dossier_saves()) {
        for e in d.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) != Some("json") {
                continue;
            }
            let nom = p.file_stem().and_then(|x| x.to_str()).unwrap_or("").to_string();
            let date = std::fs::read_to_string(&p)
                .ok()
                .and_then(|t| serde_json::from_str::<Value>(&t).ok())
                .and_then(|x| x.get("tour").and_then(Value::as_u64))
                .map(|t| crate::meteo::date_texte(t as u32))
                .unwrap_or_default();
            v.push(json!({"nom": nom, "date": date}));
        }
    }
    v.sort_by(|a, b| a["nom"].as_str().cmp(&b["nom"].as_str()));
    v
}

fn type_mime(p: &Path) -> &'static str {
    match p.extension().and_then(|x| x.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "webmanifest" => "application/manifest+json",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

/// Un fichier de web/ ; rien hors de ce dossier.
fn fichier(chemin: &str) -> Reponse {
    let rel = if chemin == "/" { "index.html" } else { chemin.trim_start_matches('/') };
    let rel = web_tools_commun::serveur::decoder_url(rel);
    let p = Path::new(&rel);
    if p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Reponse::texte(403, "interdit");
    }
    let f = racine().join("web").join(p);
    match std::fs::read(&f) {
        Ok(o) => Reponse::new(200, type_mime(&f), o),
        Err(_) => Reponse::texte(404, "introuvable"),
    }
}

fn garde() -> &'static Garde {
    GARDE.get().expect("garde non initialisée")
}
static GARDE: OnceLock<Garde> = OnceLock::new();

fn servir(r: &mut Requete, app: &Arc<Mutex<App>>) -> Reponse {
    if let Some(rep) = garde().filtrer(r) {
        return rep;
    }
    let chemin = r.chemin().to_string();
    if !chemin.starts_with("/api/") {
        if !r.lecture() {
            return Reponse::texte(405, "méthode refusée");
        }
        return fichier(&chemin);
    }
    let corps = if r.lecture() {
        Vec::new()
    } else {
        match r.lire_corps(2 * 1024 * 1024) {
            Ok(c) => c,
            Err(_) => return Reponse::json(413, &json!({"ok": false, "msg": "requête trop grosse"})),
        }
    };
    let methode = r.methode.clone();
    let (code, v) = {
        let mut a = app.lock().unwrap_or_else(|e| e.into_inner());
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| a.api(&methode, &chemin, &corps)));
        match res {
            Ok(x) => x,
            Err(_) => (500, json!({"ok": false, "msg": "erreur interne du moteur"})),
        }
    };
    Reponse::json(code, &v)
}

// ---------------------------------------------------------------------- lancement

#[derive(Debug, Default, PartialEq)]
pub struct Args {
    pub port: u16,
    pub lan: bool,
    pub local: bool,
    pub no_browser: bool,
    pub browser: bool,
    pub no_update: bool,
}

pub const USAGE: &str = "usage: royaumes [--port 8795] [--lan | --local] [--no-browser | --browser] [--no-update]";

pub fn lire_args(argv: &[String]) -> Result<Args, String> {
    let mut a = Args { port: PORT, ..Default::default() };
    let mut i = 0;
    while i < argv.len() {
        let x = argv[i].as_str();
        let (cle, val) = match x.split_once('=') {
            Some((k, v)) => (k, Some(v.to_string())),
            None => (x, None),
        };
        match cle {
            "--port" => {
                let v = match val {
                    Some(v) => v,
                    None => {
                        i += 1;
                        argv.get(i).cloned().ok_or("--port attend un nombre")?
                    }
                };
                a.port = v.parse().map_err(|_| format!("port invalide : {v}"))?;
            }
            "--lan" if val.is_none() => a.lan = true,
            "--local" if val.is_none() => a.local = true,
            "--no-browser" if val.is_none() => a.no_browser = true,
            "--browser" if val.is_none() => a.browser = true,
            "--no-update" if val.is_none() => a.no_update = true,
            _ => return Err(format!("option inconnue : {x}")),
        }
        i += 1;
    }
    Ok(a)
}

fn est_raspberry() -> bool {
    std::fs::read_to_string("/proc/device-tree/model").map(|m| m.contains("Raspberry")).unwrap_or(false)
}

fn sans_ecran() -> bool {
    cfg!(target_os = "linux") && std::env::var_os("DISPLAY").is_none() && std::env::var_os("WAYLAND_DISPLAY").is_none()
}

fn ouvrir_navigateur(url: &str) {
    let r = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", url]).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn()
    } else {
        Command::new("xdg-open").arg(url).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    };
    if r.is_err() {
        println!("Ouvrez {url} dans votre navigateur.");
    }
}

/// Mise à jour par git (avance rapide seulement). Rend vrai si le code a changé.
fn mise_a_jour() -> Result<bool, String> {
    let git = |args: &[&str]| -> Result<String, String> {
        let o = Command::new("git")
            .args(args)
            .current_dir(racine())
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdin(Stdio::null())
            .output()
            .map_err(|e| e.to_string())?;
        if o.status.success() {
            Ok(String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&o.stderr).trim().to_string())
        }
    };
    if !racine().join(".git").exists() {
        return Ok(false);
    }
    let avant = git(&["rev-parse", "HEAD"])?;
    git(&["fetch", "--quiet", "origin"])?;
    if git(&["merge", "--ff-only", "--quiet", "@{u}"]).is_err() {
        return Err("modifications locales : mise à jour mise de côté".into());
    }
    Ok(git(&["rev-parse", "HEAD"])? != avant)
}

pub fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let args = match lire_args(&argv) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{USAGE}\nroyaumes: {e}");
            std::process::exit(2);
        }
    };
    let _ = std::env::set_current_dir(racine());
    let rpi = est_raspberry();
    let auto = rpi || sans_ecran();
    let reseau = !args.local && (args.lan || auto);
    let srv = match Serveur::ouvrir(args.port, reseau, 1) {
        Ok(s) => s,
        Err(_) => {
            println!("\nImpossible d'ouvrir le port {}. Le jeu tourne peut-être déjà : essayez --port {}.", args.port, args.port + 1);
            std::process::exit(1);
        }
    };
    let mut maj = String::new();
    if !args.no_update {
        match mise_a_jour() {
            Ok(true) if std::env::var_os("ROYAUMES_RELANCEUR").is_some() => {
                println!("Nouvelle version installée : relance du jeu…");
                std::process::exit(75);
            }
            Ok(true) => maj = "Nouvelle version téléchargée : relancez le jeu pour en profiter.".into(),
            Ok(false) => maj = "Le jeu est à jour.".into(),
            Err(e) => maj = format!("Pas de mise à jour ({e})."),
        }
    }
    let _ = GARDE.set(Garde::new("Royaumes des Rives", reseau, None, None));
    garde().brancher(&srv);
    let port = srv.port();
    let adresses = if reseau { appairage::adresses_poste() } else { Vec::new() };
    let mut app = App::new();
    app.maj = maj;
    app.reseau = adresses.iter().map(|ip| garde().adresse(ip, port)).collect();
    let url = format!("http://127.0.0.1:{port}");
    println!("\n  Royaumes des Rives {VERSION} — {url}");
    if reseau {
        println!("\n   Pour jouer depuis l'iPad, un téléphone ou un PC du réseau local, ouvrez :\n");
        for a in &app.reseau {
            println!("      {a}");
        }
        let _ = std::fs::write(racine().join("adresse-reseau.txt"), app.reseau.join("\n") + "\n");
        garde().annoncer();
    }
    if !app.maj.is_empty() {
        println!("  {}", app.maj);
    }
    let app = Arc::new(Mutex::new(app));
    if args.browser || (!args.no_browser && !auto) {
        let u = url.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(700));
            ouvrir_navigateur(&u);
        });
    }
    srv.servir(Arc::new(move |r: &mut Requete| servir(r, &app)));
}

#[cfg(test)]
mod essais {
    use super::*;

    fn a(l: &[&str]) -> Vec<String> {
        l.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn ligne_de_commande() {
        let x = lire_args(&a(&["--port", "9000", "--lan", "--no-browser"])).unwrap();
        assert_eq!((x.port, x.lan, x.no_browser), (9000, true, true));
        assert_eq!(lire_args(&[]).unwrap().port, PORT);
        assert!(lire_args(&a(&["--port"])).is_err());
        assert!(lire_args(&a(&["--inconnu"])).is_err());
        assert_eq!(lire_args(&a(&["--port=8800"])).unwrap().port, 8800);
    }

    #[test]
    fn noms_et_api() {
        assert_eq!(nom_sur("../../etc/passwd"), "------etc-passwd");
        assert_eq!(nom_sur(""), "partie");
        let mut app = App { partie: None, reseau: vec![], maj: String::new() };
        assert_eq!(app.api("GET", "/api/etat", b"").0, 409);
        let (c, v) = app.api("POST", "/api/apercu", br#"{"taille":"petite","graine":4}"#);
        assert_eq!(c, 200);
        assert_eq!(v["l"], 32);
        app.partie = Some(Partie::nouvelle(Options::default()));
        let (c, v) = app.api("GET", "/api/etat", b"");
        assert_eq!(c, 200);
        assert_eq!(v["date"], "Avril 1700");
        let (_, v) = app.api("POST", "/api/cmd", br#"{"action":"impots","niveau":"bas"}"#);
        assert_eq!(v["ok"], true);
        assert_eq!(v["etat"]["joueur"]["impots"], "bas");
    }
}
