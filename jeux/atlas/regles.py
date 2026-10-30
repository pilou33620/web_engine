"""Atlas : afficher une carte toute faite (France, Aquitaine…) ou en générer une avec des réglages.

  CARTE=aquitaine python3 lancer.py atlas 8080      (CARTE=france par défaut)
"""
import os

from moteur import cartes


class Regles:
    TITRE = "Atlas"
    ANNEE = int(os.environ.get("ANNEE", "1790"))

    def initialiser(self, m):
        m.ressource("argent", 100000)
        self.changer(m, os.environ.get("CARTE", "france"), {})

    def changer(self, m, source, reglages):
        if source == "generee":
            if not isinstance(reglages, dict):
                raise ValueError("Réglages invalides.")
            cartes.generer(m, **reglages)
        else:
            cartes.charger(m, source)
        m.annoncer(f"Carte : {'générée' if source == 'generee' else source}.")

    def tick(self, m, heures):
        pass

    def nouveau_jour(self, m):
        pass

    def info(self, m, e):
        if e["style"] == "departement":
            return {"lignes": [f"Département n° {e['code']}"] if e.get("code") else []}
        if e["style"] == "ville":
            return {"lignes": [f"Population : {e['population']:,}".replace(",", " ")]
                    + (["Préfecture"] if e.get("prefecture") else [])}
        return None

    def action(self, m, nom, params):
        if nom == "changer_carte":
            self.changer(m, params.get("source"), params.get("reglages", {}))
            return {"message": "Carte chargée."}
        if nom == "annee":
            a = params.get("valeur")
            if isinstance(a, bool) or not isinstance(a, int) or not -500 <= a <= 2200:
                raise ValueError("Année invalide (de -500 à 2200).")
            m.annee = a
            m.version_carte += 1  # le client redessine villes, routes et réseaux
            return {"message": f"Année : {a}."}
        if nom == "liste_cartes":
            try:
                from moteur.generateur import REGLAGES
            except ImportError:
                REGLAGES = []
            return {"cartes": cartes.disponibles(), "reglages": REGLAGES}
        raise ValueError(f"action inconnue : {nom}")
