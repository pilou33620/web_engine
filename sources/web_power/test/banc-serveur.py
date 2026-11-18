"""Banc du serveur : ce qu'il sert, ce qu'il refuse, sans réseau.

    python test/banc-serveur.py
"""
import http.client
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import serveur  # noqa: E402

serveur.Gestionnaire.log_message = lambda *a: None      # bilan court seulement
srv = serveur.Serveur(("127.0.0.1", 0), serveur.Gestionnaire)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]


def statut(chemin, hote=None, methode="GET"):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    c.putrequest(methode, chemin, skip_host=True)
    c.putheader("Host", hote or "127.0.0.1:%d" % PORT)
    c.endheaders()
    r = c.getresponse()
    r.read()
    c.close()
    return r.status


for chemin in ("/", "/index.html", "/css/style.css", "/js/00-appareil.js", "/js/25-boucle.js"):
    assert statut(chemin) == 200, chemin
for chemin in ("/.git/config", "/.git/HEAD", "/serveur.py", "/appairage.py", "/README.md", "/banc/banc.js",
               "/.gitignore", "/../README.md", "/%2e%2e/README.md", "/index.html/", "/banc/",
               "/js/", "/js/../serveur.py", "/js/%2e%2e/serveur.py", "/css/../appairage.py", "/js/inconnu.js", "/test/banc-serveur.py"):
    assert statut(chemin) == 404, chemin
assert statut("/", hote="piege.example") == 403, "Host inconnu"
assert statut("/", methode="POST") == 501, "POST"
assert statut("/index.html", methode="PUT") == 501, "PUT"
srv.shutdown()
print("OK")
