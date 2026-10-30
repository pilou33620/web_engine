"""Cartes toutes faites (France, Aquitaine…) et cartes générées, au format commun :

  {"nom", "taille": [L, H] (unités), "echelle": mètres par unité, "latitude": degrés,
   "relief": {"pas", "valeurs"} | None, "zones_climat": [...] | None,
   "occupation": {"pas", "lignes": [chaîne par ligne], "decalage"?} | None  — occupation du sol, une lettre par case :
       "." eau / hors terre, c cultures, p prairies, f forêts, v vignes, l landes, r roche, u ville ; case (i, j) centrée en
       ((i + 0.5 + decalage) × pas, (j + 0.5 + decalage) × pas), decalage 0 par défaut,
   "entites": [{"type", "style", "calque", ...}]}

Un jeu s'en sert dans ses règles :  cartes.charger(monde, "france")  ou  cartes.generer(monde, mer=0.4, …)
"""
import json
import pathlib
import re

from .climat import Climat

DOSSIER = pathlib.Path(__file__).resolve().parent.parent / "cartes"


def urbaniser(occupation, villes):
    """Marque « u » les cases bâties autour des villes (taille = diamètre de l'emprise, en unités)."""
    pas, d, lignes = occupation["pas"], occupation.get("decalage", 0), [list(l) for l in occupation["lignes"]]
    for v in villes:
        r = v.get("taille", 0) / 2
        if r < 0.5 * pas:
            continue  # village : l'icône suffit
        for j in range(max(0, int((v["y"] - r) / pas - d) - 1), min(len(lignes), int((v["y"] + r) / pas - d) + 2)):
            for i in range(max(0, int((v["x"] - r) / pas - d) - 1), min(len(lignes[0]), int((v["x"] + r) / pas - d) + 2)):
                x, y = (i + 0.5 + d) * pas, (j + 0.5 + d) * pas
                # bords irréguliers : la ville s'étire le long d'un axe propre à chaque ville
                k = ((x - v["x"]) * 0.8) ** 2 + (y - v["y"]) ** 2 if sum(map(ord, v.get("nom", ""))) % 2 else (x - v["x"]) ** 2 + ((y - v["y"]) * 0.8) ** 2
                if lignes[j][i] != "." and k < r * r:
                    lignes[j][i] = "u"
    occupation["lignes"] = ["".join(l) for l in lignes]


def disponibles():
    return sorted(p.stem for p in DOSSIER.glob("*.json"))


def lire(nom):
    if not re.fullmatch(r"[a-z0-9_\-]+", nom or ""):
        raise ValueError("Nom de carte invalide.")
    chemin = DOSSIER / f"{nom}.json"
    if not chemin.is_file():
        raise ValueError(f"Carte inconnue : {nom}.")
    return json.loads(chemin.read_text(encoding="utf-8"))


def appliquer(m, carte):
    """Remplace la carte du monde : entités, taille, échelle, relief et climat (latitude, zones)."""
    m.vider()
    m.taille, m.echelle, m.relief = list(carte["taille"]), carte.get("echelle", 1.0), carte.get("relief")
    m.occupation = carte.get("occupation")
    for e in carte["entites"]:
        e = dict(e)
        m.ajouter(e.pop("type"), e.pop("style"), **e)
    reglage = {"latitude": carte.get("latitude", 45.0)}
    if carte.get("zones_climat"):
        reglage["zones"] = carte["zones_climat"]
    m.climat = Climat(m.rng, m.horloge.date, **reglage)
    m.climat.avancer(m.horloge.date, m.horloge.heure - 1, 1)


def charger(m, nom):
    appliquer(m, lire(nom))


def generer(m, **reglages):
    from .generateur import generer as fabriquer  # chargé à la demande : le générateur est lourd
    appliquer(m, fabriquer(reglages))
