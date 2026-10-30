"""Auto-vérification du moteur : python3 tests/test_moteur.py"""
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from jeux.demo.regles import Regles
from moteur.monde import Monde

m = Monde(Regles())
assert m.de_type("parcelle") and len(m.de_type("tracteur")) == 3
date0, x0 = m.horloge.date, m.de_type("tracteur")[0]["x"]

m.avancer(30)  # 8h + 30h → lendemain 14h
assert (m.horloge.date - date0).days == 1 and abs(m.horloge.heure - 14) < 1e-9
assert m.de_type("tracteur")[0]["x"] != x0, "le tracteur doit bouger"

m.action("mode", {"valeur": "tour"})
ble = m.ressources["ble"]["valeur"]
m.action("tour_suivant", {})
assert (m.horloge.date - date0).days == 8
assert m.ressources["ble"]["delta"] == m.ressources["ble"]["valeur"] - ble, "delta = gain du tour"

labour = next(p for p in m.de_type("parcelle") if p["sol"] == "labour")
v = m.version_carte
m.action("semer", {"id": labour["id"]})
assert labour["sol"] == "colza" and m.version_carte > v
for mauvais in [("semer", {"id": labour["id"]}), ("vitesse", {"valeur": 3}), ("inconnue", {})]:
    try:
        m.action(*mauvais)
        raise AssertionError(f"aurait dû échouer : {mauvais}")
    except ValueError:
        pass

with tempfile.TemporaryDirectory() as d:
    chemin = pathlib.Path(d) / "save.json"
    m.sauver(chemin)
    m2 = Monde(Regles(), graine=99)
    m2.charger(chemin)
    assert m2.horloge.date == m.horloge.date and m2.entites == m.entites and m2.ressources == m.ressources
    assert [z.sol for z in m2.climat.zones] == [z.sol for z in m.climat.zones], "climat sauvegardé"
assert [z["nom"] for z in m.etat()["climat"]["zones"]] == ["Côte", "Intérieur", "Coteaux"]
print("OK — moteur vérifié")
