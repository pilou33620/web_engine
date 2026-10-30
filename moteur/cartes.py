"""Cartes toutes faites (France, Aquitaine…) et cartes générées, au format commun :

  {"nom", "taille": [L, H] (unités), "echelle": mètres par unité, "latitude": degrés,
   "relief": {"pas", "valeurs"} | None, "zones_climat": [...] | None,
   "entites": [{"type", "style", "calque", ...}]}

Un jeu s'en sert dans ses règles :  cartes.charger(monde, "france")  ou  cartes.generer(monde, mer=0.4, …)
"""
import json
import pathlib
import re

from .climat import Climat

DOSSIER = pathlib.Path(__file__).resolve().parent.parent / "cartes"


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
