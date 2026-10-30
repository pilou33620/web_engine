"""Cœur de simulation générique : horloge, climat, ressources, entités, événements, décisions, constructions.

Entités universelles : type "zone" (rect x,y,w,h ou polygone points), "ligne" (points), "batiment" (x,y,taille)
ou "unite" (mobile, x,y,angle). Le "style" dit comment les thèmes la dessinent ; le "calque" où elle s'affiche.

Un jeu fournit un objet « règles » avec les méthodes :
  initialiser(monde), tick(monde, heures), nouveau_jour(monde), action(monde, nom, params)
"""
import datetime as dt
import json
import random

from . import construction
from .climat import Climat

SAISONS = ["Hiver", "Hiver", "Printemps", "Printemps", "Printemps", "Été",
           "Été", "Été", "Automne", "Automne", "Automne", "Hiver"]
VITESSES = (1, 2, 5, 20)


class Horloge:
    def __init__(self, date, heure=8.0, mode="temps_reel"):
        self.date, self.heure, self.mode = date, heure, mode
        self.pause, self.vitesse = True, 1

    @property
    def saison(self):
        return SAISONS[self.date.month - 1]

    def etat(self):
        return {"date": self.date.isoformat(), "heure": round(self.heure, 2), "saison": self.saison,
                "mode": self.mode, "pause": self.pause, "vitesse": self.vitesse}


class Monde:
    MINUTES_PAR_SECONDE = 10  # à vitesse ×1 : 1 s réelle = 10 min de jeu
    JOURS_PAR_TOUR = 7

    def __init__(self, regles, graine=1):
        self.regles = regles
        self.rng = random.Random(graine)
        self.horloge = Horloge(dt.date(1790, 9, 1))
        self.taille = [2000, 1400]
        self.entites, self.ressources, self.evenements = {}, {}, []
        self.version_carte, self._compteur = 0, 0
        self.decisions, self.relief = {}, None
        # Un jeu règle son climat avec un dict CLIMAT (latitude, normales, zones), voir moteur/climat.py
        self.climat = Climat(self.rng, self.horloge.date, **getattr(regles, "CLIMAT", {}))
        self.climat.avancer(self.horloge.date, self.horloge.heure - 1, 1)  # météo de l'heure de départ
        regles.initialiser(self)

    # --- API pour les règles du jeu ---
    def ajouter(self, type, style, mobile=False, **props):
        self._compteur += 1
        e = {"id": f"{style}-{self._compteur}", "type": type, "style": style, "mobile": mobile, **props}
        self.entites[e["id"]] = e
        if not mobile:
            self.version_carte += 1
        return e

    def modifier(self, id, **props):
        e = self.entites[id]
        e.update(props)
        if not e["mobile"]:
            self.version_carte += 1  # le client redessine la carte
        return e

    def supprimer(self, id):
        e = self.entites.pop(id)
        if not e["mobile"]:
            self.version_carte += 1
        return e

    def de_type(self, type):
        return [e for e in self.entites.values() if e["type"] == type]

    def de_style(self, *styles):
        return [e for e in self.entites.values() if e["style"] in styles]

    def proposer(self, titre, texte, choix):
        """Décision à prendre par le joueur. choix : [(libellé, action, params)] ; action None = ne rien faire."""
        self._compteur += 1
        id = f"decision-{self._compteur}"
        self.decisions[id] = {"id": id, "titre": titre, "texte": texte,
                              "choix": [{"libelle": l, "action": a, "params": p} for l, a, p in choix]}
        return id

    def ressource(self, nom, quantite):
        r = self.ressources.setdefault(nom, {"valeur": 0, "delta": 0})
        r["valeur"] += quantite
        r["delta"] += quantite

    def annoncer(self, texte, importance="info"):
        self.evenements.insert(0, {"date": self.horloge.date.isoformat(), "texte": texte, "importance": importance})
        del self.evenements[30:]

    # --- Temps ---
    def avancer(self, heures):
        h = self.horloge
        for texte, importance in self.climat.avancer(h.date, h.heure, heures):
            self.annoncer(texte, importance)
        self.regles.tick(self, heures)
        h.heure += heures
        while h.heure >= 24:
            h.heure -= 24
            self._nouveau_jour()

    def _nouveau_jour(self):
        h = self.horloge
        h.date += dt.timedelta(days=1)
        if h.mode == "temps_reel":  # en tour par tour, le delta couvre tout le tour
            for r in self.ressources.values():
                r["delta"] = 0
        self.regles.nouveau_jour(self)

    def tour_suivant(self):
        for r in self.ressources.values():
            r["delta"] = 0
        for _ in range(self.JOURS_PAR_TOUR * 4):
            self.avancer(6)

    # --- Actions venant de l'interface ---
    def action(self, nom, params):
        h = self.horloge
        if nom == "pause":
            h.pause = bool(params.get("valeur", not h.pause))
        elif nom == "vitesse":
            v = int(params["valeur"])
            if v not in VITESSES:
                raise ValueError(f"vitesse invalide : {v}")
            h.vitesse = v
        elif nom == "mode":
            if params["valeur"] not in ("temps_reel", "tour"):
                raise ValueError("mode invalide")
            h.mode, h.pause = params["valeur"], True
        elif nom == "tour_suivant":
            self.tour_suivant()
        elif nom == "construire":
            return construction.construire(self, params)
        elif nom == "demolir":
            return construction.demolir(self, params.get("id"))
        elif nom == "decider":
            d = self.decisions.pop(params.get("id"), None)
            if d is None:
                raise ValueError("Décision introuvable.")
            c = d["choix"][int(params["index"])]
            return self.action(c["action"], c["params"]) if c["action"] else None
        else:
            return self.regles.action(self, nom, params)

    # --- Données envoyées au client ---
    def carte(self):
        r = self.regles
        return {"version": self.version_carte, "taille": self.taille, "titre": getattr(r, "TITRE", ""),
                "entites": [e for e in self.entites.values() if not e["mobile"]],
                "constructions": getattr(r, "CONSTRUCTIONS", []), "vues": getattr(r, "VUES", []),
                "tutoriel": getattr(r, "TUTORIEL", []), "relief": self.relief}

    def info(self, id):
        """Fiche d'une entité : {titre, lignes, actions:[{libelle, nom, params}]}, fournie par les règles."""
        e = self.entites.get(id)
        if e is None:
            raise ValueError("Entité introuvable.")
        fiche = {"titre": e.get("nom") or e["style"], "lignes": [], "actions": []}
        if hasattr(self.regles, "info"):
            fiche.update(self.regles.info(self, e) or {})
        if e.get("constructible"):
            fiche["actions"] = fiche["actions"] + [{"libelle": "Démolir", "nom": "demolir", "params": {"id": id}}]
        return fiche

    def vue(self, id):
        """Carte de données : {id_entite: valeur entre 0 et 1}, calculée par les règles."""
        if id not in {v["id"] for v in getattr(self.regles, "VUES", [])}:
            raise ValueError("Vue inconnue.")
        return {"valeurs": self.regles.vue(self, id)}

    def etat(self):
        return {"horloge": self.horloge.etat(), "climat": self.climat.etat(), "ressources": self.ressources,
                "evenements": self.evenements[:8], "version_carte": self.version_carte,
                "decisions": list(self.decisions.values()),
                "mobiles": [e for e in self.entites.values() if e["mobile"]]}

    # --- Sauvegarde ---
    def sauver(self, chemin):
        h = self.horloge
        data = {"horloge": {"date": h.date.isoformat(), "heure": h.heure, "mode": h.mode, "vitesse": h.vitesse},
                "taille": self.taille, "climat": self.climat.sauver(), "entites": self.entites,
                "ressources": self.ressources, "evenements": self.evenements, "compteur": self._compteur,
                "decisions": self.decisions}
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def charger(self, chemin):
        with open(chemin, encoding="utf-8") as f:
            data = json.load(f)
        hd = data["horloge"]
        self.horloge = Horloge(dt.date.fromisoformat(hd["date"]), hd["heure"], hd["mode"])
        self.horloge.vitesse = hd["vitesse"]
        self.taille = data["taille"]
        self.climat.charger(data["climat"])
        self.entites, self.ressources = data["entites"], data["ressources"]
        self.evenements, self._compteur = data["evenements"], data["compteur"]
        self.decisions = data.get("decisions", {})
        self.version_carte += 1
