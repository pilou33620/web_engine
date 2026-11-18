#!/usr/bin/python3
"""Serveur de GridMaster : sert index.html au réseau local, derrière la garde commune.

    python3 serveur.py [--port 8794] [--local] [--sans-navigateur] [--sans-pause] [--sans-maj]

La partie s'enregistre dans le navigateur : le serveur n'a aucune route qui écrit.
"""
import argparse
import http.server
import os
import re
import shutil
import signal
import socket
import socketserver
import subprocess
import sys
import urllib.parse
import webbrowser
from pathlib import Path

import appairage

RACINE = Path(__file__).resolve().parent
STATIQUE = re.compile(r"^/(?:index\.html|css/[\w-]+\.css|js/[\w-]+\.js)?$")   # la page, ses styles et ses scripts ; ni .git/, ni le Python, ni le banc
GARDE = appairage.Garde("WEB_POWER", actif=False)   # remplacé dans main() selon --local


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    timeout = 60
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",          # nosniff : sans le bon type, le navigateur refuse le fichier
        ".js": "text/javascript; charset=utf-8",    # (Windows associe parfois .js à text/plain)
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    def parse_request(self):
        # Host, Internet, TLS, jeton : avant tout traitement de la requête
        return super().parse_request() and GARDE.filtrer(self)

    def send_head(self):
        # GET et HEAD passent tous deux par ici
        if not STATIQUE.match(urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)):
            self.send_error(404, "File not found")
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", "frame-ancestors 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, format, *args):
        if format.startswith("Request timed out"):
            return
        super().log_message("%s", appairage.masquer(format % args))

    def handle(self):
        try:
            super().handle()
        except ConnectionError:
            self.close_connection = True       # client parti : pas une erreur


class Serveur(socketserver.ThreadingTCPServer):
    # SO_REUSEADDR laisserait sous Windows deux serveurs partager un port
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class ServeurDoublePile(Serveur):
    """IPv4 et IPv6 sur la même socket (Tailscale fd7a::) quand le système le permet."""
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except AttributeError as exc:
            raise OSError("IPV6_V6ONLY absent : pas de double pile") from exc
        super().server_bind()


def ipv4_libre(port):
    """Sous Windows, une socket double pile se lie même si l'IPv4 du port est déjà pris."""
    if os.name != "nt":
        return True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def adresse_locale():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))     # aucun paquet n'est envoyé
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def ouvrir_serveur(hote, port, essais):
    """Le premier port libre à partir de `port`."""
    derniere = OSError("aucun port essayé")
    piles = [(ServeurDoublePile, "::"), (Serveur, hote)] if hote == "0.0.0.0" else [(Serveur, hote)]
    for p in range(port, port + essais):
        if hote == "0.0.0.0" and not ipv4_libre(p):
            derniere = OSError(f"l'IPv4 du port {p} est déjà pris")
            continue
        for classe, h in piles:
            try:
                return classe((h, p), Gestionnaire), p
            except OSError as e:
                derniere = e
    raise derniere


def verifier_et_appliquer_maj(dossier_racine=None):
    """Recherche les mises a jour sur GitHub via Git et les applique si disponible.

    Renvoie True si une mise a jour a ete telechargee et appliquee avec succes
    (necessitant un redemarrage du script pour executer le code a jour), ou False
    si l'outil est deja a jour, hors-ligne, ou dans l'impossibilite d'appliquer
    la mise a jour sans intervention manuelle.
    """
    racine = dossier_racine or RACINE
    # Git doit etre disponible dans l'environnement
    if not shutil.which("git"):
        return False

    # Le dossier doit etre un depot Git
    dossier_git = os.path.join(racine, ".git")
    if not os.path.isdir(dossier_git):
        res_test = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=racine, capture_output=True, text=True
        )
        if res_test.returncode != 0:
            return False

    print("[*] Recherche de mises a jour sur GitHub...")
    env_git = os.environ.copy()
    env_git["GIT_TERMINAL_PROMPT"] = "0"

    try:
        fetch = subprocess.run(
            ["git", "fetch", "--quiet", "origin"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        if fetch.returncode != 0:
            print("[!] Impossible de contacter GitHub (hors ligne ou depot distant inaccessible).")
            print("[*] Demarrage normal de l'outil...")
            return False
    except subprocess.TimeoutExpired:
        print("[!] Delai de recherche de mise a jour depasse (reseau lent ou indisponible).")
        print("[*] Demarrage normal de l'outil...")
        return False
    except Exception as exc:                           # noqa: BLE001
        print("[!] Echec de la recherche de mise a jour : %s" % exc)
        print("[*] Demarrage normal de l'outil...")
        return False

    # Determination de la branche amont (upstream) ou repli sur origin/main
    upstream = "@{u}"
    res_up = subprocess.run(
        ["git", "rev-parse", "--verify", "@{u}"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    if res_up.returncode != 0:
        res_main = subprocess.run(
            ["git", "rev-parse", "--verify", "origin/main"],
            cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
        )
        if res_main.returncode == 0:
            upstream = "origin/main"
        else:
            # Aucune branche amont connue
            return False

    # Nombre de commits distants en attente de recuperation
    res_count = subprocess.run(
        ["git", "rev-list", "HEAD..%s" % upstream, "--count"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    if res_count.returncode != 0:
        return False

    try:
        nb_commits = int(res_count.stdout.strip())
    except ValueError:
        return False

    if nb_commits <= 0:
        print("[*] Le logiciel est a jour.")
        return False

    print()
    print("=" * 60)
    print("MISE A JOUR DISPONIBLE (%d nouveau(x) commit(s) sur GitHub)" % nb_commits)
    print("=" * 60)
    print("  Application de la mise a jour en cours...")

    # Detection de modifications locales non commitees dans les fichiers suivis
    st_res = subprocess.run(
        ["git", "status", "--porcelain", "-uno"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    dirty = bool(st_res.stdout.strip())
    stashed = False
    if dirty:
        print("  Modifications locales detectees : mise en reserve temporaire...")
        stash_res = subprocess.run(
            ["git", "stash", "push", "-m", "Auto-stash WEB_POWER avant mise a jour"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        stashed = (stash_res.returncode == 0)

    # --ff-only : on n'applique que la suite exacte de ce qu'on a. Un historique
    # distant reecrit (force-push) ou divergent est refuse, jamais fusionne en
    # silence dans le code qu'on va executer.
    # Un pull trop long (reseau lent, carte SD) levait TimeoutExpired : le
    # serveur ne demarrait pas et la reserve n'etait jamais reappliquee.
    try:
        pull = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=racine, capture_output=True, text=True, timeout=120, env=env_git
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        pull = subprocess.CompletedProcess(["git", "pull"], 1, "",
                                           "git pull interrompu (%s)" % exc)

    if stashed:
        print("  Restauration des modifications locales...")
        pop = subprocess.run(
            ["git", "stash", "pop"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        # Un « pop » en conflit laisse les modifications dans la reserve (et
        # des marqueurs de conflit dans les fichiers) : le taire, c'etait
        # laisser croire qu'elles etaient perdues.
        if pop.returncode != 0:
            err = pop.stderr.strip() or pop.stdout.strip()
            print("[!] Vos modifications locales n'ont pas pu etre reappliquees"
                  " automatiquement :")
            print("    %s" % err)
            print("    Elles sont conservees dans la reserve Git : voir"
                  " « git stash list », puis « git stash pop » une fois le"
                  " conflit resolu.")

    if pull.returncode != 0:
        err = pull.stderr.strip() or pull.stdout.strip()
        print("[!] Echec de l'application de la mise a jour : %s" % err)
        print("[*] Poursuite avec la version actuelle...")
        return False

    print()
    print("=" * 60)
    print("MISE A JOUR APPLIQUEE AVEC SUCCES")
    print("=" * 60)
    print("  Redemarrage automatique de l'outil...")
    print("=" * 60)
    print()
    return True


def redemarrer_application(argv=None):
    """Relance le processus actuel avec les memes arguments apres une mise a jour."""
    env = os.environ.copy()
    env["WEB_POWER_DEJA_MAJ"] = "1"
    cmd = [sys.executable, os.path.abspath(__file__)] + (sys.argv[1:] if argv is None else list(argv))
    try:
        if os.name == "nt":
            # Sous Windows, subprocess.call permet de conserver la fenetre console
            # ouverte (en particulier lors d'un lancement par double-clic).
            code = subprocess.call(cmd, env=env)
            os._exit(code)
        else:
            # Sous Unix / macOS, execv remplace l'image du processus courant
            os.execv(sys.executable, cmd)
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as exc:                           # noqa: BLE001
        print("[!] Erreur lors du redemarrage automatique : %s" % exc)
        print("[*] Poursuite avec le processus actuel...")


def main():
    ap = argparse.ArgumentParser(description="GridMaster")
    ap.add_argument("--port", type=int, default=8794, help="port d'écoute (8794 par défaut)")
    ap.add_argument("--local", action="store_true", help="n'écouter que sur 127.0.0.1")
    ap.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    ap.add_argument("--sans-pause", action="store_true", help="ne pas attendre de touche à l'arrêt")
    ap.add_argument("--sans-maj", dest="verifier_maj", action="store_false", default=True,
                    help="ne pas vérifier les mises à jour GitHub au démarrage")
    args = ap.parse_args()
    # shortcut: pause seulement sous Windows (double-clic) ; WEB_3D détecte finement la console, à reprendre si gênant
    interactif = not args.sans_pause and os.name == "nt" and sys.stdin.isatty()

    def attendre():
        if interactif:
            try:
                input("\nAppuyez sur Entrée pour fermer…")
            except EOFError:
                pass

    if args.verifier_maj and os.environ.get("WEB_POWER_DEJA_MAJ") != "1":
        if verifier_et_appliquer_maj(str(RACINE)):
            redemarrer_application()

    hote = "127.0.0.1" if args.local else "0.0.0.0"
    global GARDE
    GARDE = appairage.Garde("WEB_POWER", actif=not args.local)
    try:
        serveur, port = ouvrir_serveur(hote, args.port, 10)
    except OSError as e:
        print(f"Aucun port libre entre {args.port} et {args.port + 9} : {e}", file=sys.stderr, flush=True)
        attendre()
        return 1

    GARDE.brancher(serveur)             # en mode réseau : HTTPS sur le même port
    url = f"http://127.0.0.1:{port}/"
    print("GridMaster", flush=True)
    print(f"  adresse : {url}", flush=True)
    if port != args.port:
        print(f"  (le port {args.port} était occupé)", flush=True)
    if not args.local:
        print(f"  réseau  : {GARDE.adresse(adresse_locale(), port)}   (tablette, autre poste)", flush=True)
        if appairage.ip_tailscale():
            print(f"  tailscale : {GARDE.adresse(appairage.ip_tailscale(), port)}", flush=True)
        print("            l'autre appareil demande une fois le code d'appairage ci-dessous", flush=True)
        GARDE.annoncer()
    print("  Ctrl+C pour arrêter.\n", flush=True)

    if not args.sans_navigateur:
        webbrowser.open(url)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))   # arrêt par web_launcher : passe par le finally
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.", flush=True)
    finally:
        serveur.server_close()
    attendre()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
