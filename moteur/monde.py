"""Cœur de simulation générique : horloge, météo, ressources, entités, événements.

Un jeu fournit un objet « règles » avec les méthodes :
  initialiser(monde), tick(monde, heures), nouveau_jour(monde), action(monde, nom, params)
"""
import datetime as dt
import json
import random

SAISONS = ["Hiver", "Hiver", "Printemps", "Printemps", "Printemps", "Été",
           "Été", "Été", "Automne", "Automne", "Automne", "Hiver"]
# Probabilités de météo par saison : (soleil, nuages, pluie)
METEO = {"Hiver": (0.3, 0.35, 0.35), "Printemps": (0.45, 0.3, 0.25),
         "Été": (0.7, 0.2, 0.1), "Automne": (0.35, 0.35, 0.3)}
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
        self.meteo = "soleil"
        self.entites, self.ressources, self.evenements = {}, {}, []
        self.version_carte, self._compteur = 0, 0
        regles.initialiser(self)

    # --- API pour les règles du jeu ---
    def ajouter(self, type, mobile=False, **props):
        self._compteur += 1
        e = {"id": f"{type}-{self._compteur}", "type": type, "mobile": mobile, **props}
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

    def de_type(self, type):
        return [e for e in self.entites.values() if e["type"] == type]

    def ressource(self, nom, quantite):
        r = self.ressources.setdefault(nom, {"valeur": 0, "delta": 0})
        r["valeur"] += quantite
        r["delta"] += quantite

    def annoncer(self, texte, importance="info"):
        self.evenements.insert(0, {"date": self.horloge.date.isoformat(), "texte": texte, "importance": importance})
        del self.evenements[30:]

    # --- Temps ---
    def avancer(self, heures):
        self.regles.tick(self, heures)
        h = self.horloge
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
        if self.rng.random() < 0.3:
            ancien = self.meteo
            self.meteo = self.rng.choices(("soleil", "nuages", "pluie"), METEO[h.saison])[0]
            if self.meteo != ancien and self.meteo == "pluie":
                self.annoncer("La pluie arrive sur la région.")
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
        else:
            return self.regles.action(self, nom, params)

    # --- Données envoyées au client ---
    def carte(self):
        return {"version": self.version_carte, "taille": self.taille,
                "entites": [e for e in self.entites.values() if not e["mobile"]]}

    def etat(self):
        return {"horloge": self.horloge.etat(), "meteo": self.meteo, "ressources": self.ressources,
                "evenements": self.evenements[:8], "version_carte": self.version_carte,
                "mobiles": [e for e in self.entites.values() if e["mobile"]]}

    # --- Sauvegarde ---
    def sauver(self, chemin):
        h = self.horloge
        data = {"horloge": {"date": h.date.isoformat(), "heure": h.heure, "mode": h.mode, "vitesse": h.vitesse},
                "taille": self.taille, "meteo": self.meteo, "entites": self.entites,
                "ressources": self.ressources, "evenements": self.evenements, "compteur": self._compteur}
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def charger(self, chemin):
        with open(chemin, encoding="utf-8") as f:
            data = json.load(f)
        hd = data["horloge"]
        self.horloge = Horloge(dt.date.fromisoformat(hd["date"]), hd["heure"], hd["mode"])
        self.horloge.vitesse = hd["vitesse"]
        self.taille, self.meteo = data["taille"], data["meteo"]
        self.entites, self.ressources = data["entites"], data["ressources"]
        self.evenements, self._compteur = data["evenements"], data["compteur"]
        self.version_carte += 1
