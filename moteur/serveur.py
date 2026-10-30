"""Serveur HTTP : sert l'interface web et expose l'API du monde. Bibliothèque standard uniquement."""
import http.server
import json
import pathlib
import threading
import time
import urllib.parse

from .monde import Monde

RACINE = pathlib.Path(__file__).resolve().parent.parent
WEB = RACINE / "web"
SAUVEGARDES = RACINE / "sauvegardes"


def servir(regles, nom_jeu, port=8080, hote="0.0.0.0"):
    monde = Monde(regles)
    verrou = threading.Lock()
    fichier_save = SAUVEGARDES / f"{nom_jeu}.json"

    def boucle():
        precedent = time.monotonic()
        while True:
            time.sleep(0.1)
            maintenant = time.monotonic()
            ecart, precedent = maintenant - precedent, maintenant
            with verrou:
                h = monde.horloge
                if h.mode == "temps_reel" and not h.pause:
                    monde.avancer(ecart * h.vitesse * Monde.MINUTES_PAR_SECONDE / 60)

    class Gestion(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(WEB), **k)

        def log_message(self, *a):
            pass

        def _json(self, data, code=200):
            corps = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(corps)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(corps)

        def do_GET(self):
            url = urllib.parse.urlsplit(self.path)
            if url.path in ("/api/info", "/api/vue"):
                id = urllib.parse.parse_qs(url.query).get("id", [""])[0]
                try:
                    with verrou:
                        return self._json(monde.info(id) if url.path == "/api/info" else monde.vue(id))
                except ValueError as e:
                    return self._json({"erreur": str(e)}, 400)
            if url.path == "/api/jeu":  # fichiers web propres au jeu (styles.js, module.js…)
                dossier = RACINE / "jeux" / nom_jeu / "web"
                return self._json({"nom": nom_jeu, "fichiers": sorted(p.name for p in dossier.glob("*.js")) if dossier.is_dir() else []})
            if url.path.startswith("/jeu/"):
                return self._fichier_du_jeu(url.path[len("/jeu/"):])
            if self.path == "/api/etat":
                with verrou:
                    return self._json(monde.etat())
            if self.path == "/api/carte":
                with verrou:
                    return self._json(monde.carte())
            return super().do_GET()

        def _fichier_du_jeu(self, relatif):
            """Fichiers propres au jeu (styles.js, images) servis depuis jeux/<nom>/web/."""
            base = (RACINE / "jeux" / nom_jeu / "web").resolve()
            chemin = (base / urllib.parse.unquote(relatif)).resolve()
            if base not in chemin.parents or not chemin.is_file():  # refuse ../ et l'absent
                return self._json({"erreur": "introuvable"}, 404)
            corps = chemin.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(chemin)))
            self.send_header("Content-Length", str(len(corps)))
            self.end_headers()
            self.wfile.write(corps)

        def do_POST(self):
            if self.path != "/api/action":
                return self._json({"erreur": "introuvable"}, 404)
            try:
                taille = int(self.headers.get("Content-Length", 0))
                if taille > 10_000:
                    raise ValueError("requête trop grande")
                demande = json.loads(self.rfile.read(taille) or b"{}")
                nom, params = demande["nom"], demande.get("params", {})
                if not isinstance(nom, str) or not isinstance(params, dict):
                    raise ValueError("format invalide")
                with verrou:
                    if nom == "sauver":
                        SAUVEGARDES.mkdir(exist_ok=True)
                        monde.sauver(fichier_save)
                        resultat = {"message": "Partie sauvegardée."}
                    elif nom == "charger":
                        monde.charger(fichier_save)
                        resultat = {"message": "Partie chargée."}
                    else:
                        resultat = monde.action(nom, params)
                return self._json({"ok": True, **(resultat or {})})
            except FileNotFoundError:
                return self._json({"erreur": "Aucune sauvegarde."}, 400)
            except (KeyError, ValueError, TypeError) as e:
                return self._json({"erreur": str(e)}, 400)

    threading.Thread(target=boucle, daemon=True).start()
    print(f"web_engine — jeu « {nom_jeu} » sur http://{hote}:{port}")
    http.server.ThreadingHTTPServer((hote, port), Gestion).serve_forever()
