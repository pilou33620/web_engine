"""Auto-vérification du moteur : python3 tests/test_moteur.py"""
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from jeux.demo.regles import Regles
from moteur.monde import Monde


def refuse(m, nom, params):
    try:
        m.action(nom, params)
    except ValueError:
        return
    raise AssertionError(f"aurait dû échouer : {nom} {params}")


m = Monde(Regles())
assert m.de_type("zone") and len(m.de_style("tracteur")) == 3
assert all(e["type"] in ("zone", "ligne", "batiment", "unite") and e["style"] for e in m.entites.values())
date0, x0 = m.horloge.date, m.de_style("tracteur")[0]["x"]

m.avancer(30)  # 8h + 30h → lendemain 14h
assert (m.horloge.date - date0).days == 1 and abs(m.horloge.heure - 14) < 1e-9
assert m.de_style("tracteur")[0]["x"] != x0, "le tracteur doit bouger"

m.action("mode", {"valeur": "tour"})
ble = m.ressources["ble"]["valeur"]
m.action("tour_suivant", {})
assert (m.horloge.date - date0).days == 8
assert m.ressources["ble"]["delta"] == m.ressources["ble"]["valeur"] - ble, "delta = gain du tour"

# Actions des règles, fiches et vues
labour = m.de_style("labour")[0]
v = m.version_carte
assert any(a["nom"] == "semer" for a in m.info(labour["id"])["actions"])
m.action("semer", {"id": labour["id"]})
assert labour["style"] == "colza" and m.version_carte > v
refuse(m, "semer", {"id": labour["id"]})
refuse(m, "vitesse", {"valeur": 3})
refuse(m, "inconnue", {})
valeurs = m.vue("humidite")["valeurs"]
assert valeurs and all(0 <= x <= 1 for x in valeurs.values())
carte = m.carte()
assert carte["constructions"] and carte["vues"] and carte["tutoriel"] and carte["relief"]["valeurs"]

# Constructions
argent = m.ressources["argent"]["valeur"]
r = m.action("construire", {"modele": "route", "points": [[1000, 300], [1000, 800]]})
assert m.entites[r["id"]]["constructible"] and m.ressources["argent"]["valeur"] == argent - 1000  # 2 000 €/km × 0,5 km
r = m.action("construire", {"modele": "eolienne", "x": 1200, "y": 500})
refuse(m, "construire", {"modele": "eolienne", "x": 1210, "y": 505})        # trop près
refuse(m, "construire", {"modele": "eolienne", "x": 40, "y": 500})          # en mer
refuse(m, "construire", {"modele": "route", "points": [[0, 0], [5000, 0]]})  # hors carte
refuse(m, "construire", {"modele": "route", "points": [[0, 0], ["a", 0]]})   # coordonnée invalide
refuse(m, "construire", {"modele": "nimporte", "x": 10, "y": 10})
refuse(m, "demolir", {"id": m.de_style("ville")[0]["id"]})                   # pas une construction du joueur
assert any(a["nom"] == "demolir" for a in m.info(r["id"])["actions"])
m.action("demolir", {"id": r["id"]})
assert r["id"] not in m.entites

# Décisions
foire = next(iter(m.decisions))
pop = m.ressources["population"]["valeur"]
m.action("decider", {"id": foire, "index": 0})
assert m.ressources["population"]["valeur"] == pop + 50 and foire not in m.decisions
refuse(m, "decider", {"id": foire, "index": 0})

with tempfile.TemporaryDirectory() as d:
    chemin = pathlib.Path(d) / "save.json"
    m.proposer("Test", "texte", [("Rien", None, {})])
    m.sauver(chemin)
    m2 = Monde(Regles(), graine=99)
    m2.charger(chemin)
    assert m2.horloge.date == m.horloge.date and m2.entites == m.entites and m2.ressources == m.ressources
    assert [z.sol for z in m2.climat.zones] == [z.sol for z in m.climat.zones], "climat sauvegardé"
    assert m2.decisions == m.decisions
assert [z["nom"] for z in m.etat()["climat"]["zones"]] == ["Côte", "Intérieur", "Coteaux"]
print("OK — moteur vérifié")
