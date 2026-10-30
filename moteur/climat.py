"""Climat physique simplifié : soleil, température, vent, nuages, pluie/neige/orage, brouillard,
eau du sol, neige au sol et débit des rivières.

Calé sur des normales mensuelles réelles (par défaut Bordeaux-Mérignac 1991-2020, valeurs arrondies).
Chaque zone climatique (côte, intérieur, coteaux…) a sa propre météo, corrélée aux autres.
Pas de calcul : 1 h maximum, quel que soit le pas demandé par le moteur.
"""
import datetime as dt
import math
from statistics import NormalDist

N01 = NormalDist()

# Par mois : (t° min, t° max, pluie mm, jours de pluie ≥ 1 mm, vent moyen m/s)
BORDEAUX = [(3.3, 10.6, 87, 12, 4.0), (3.1, 12.1, 69, 10, 4.1), (5.2, 15.5, 64, 10, 4.2),
            (7.4, 17.9, 77, 11, 4.1), (10.9, 21.6, 75, 10, 3.8), (14.2, 25.0, 61, 8, 3.6),
            (15.9, 27.3, 47, 6, 3.5), (15.9, 27.6, 57, 7, 3.4), (12.9, 24.3, 75, 9, 3.4),
            (10.3, 19.6, 93, 12, 3.6), (6.3, 14.0, 103, 13, 3.9), (3.9, 11.1, 101, 13, 4.0)]

HEURES_DE_PLUIE_PAR_JOUR = 5   # durée moyenne des précipitations un jour de pluie
TAU_METEO = 36                 # h : durée de vie typique d'une situation météo
TAU_TEMP, SIGMA_TEMP = 72, 3.0 # écarts de température dus aux masses d'air
TAU_VENT, SIGMA_VENT = 12, 0.35
DIRECTION_DOMINANTE = 250      # ° d'où vient le vent (ouest-sud-ouest, océanique)
RESERVE_SOL = 100              # mm d'eau utile dans le sol
FONTE = 0.15                   # mm d'eau fondue par heure et par °C
ETP = 0.00035                  # mm d'évaporation par Wh/m² de soleil
TAU_RIVIERE = 48               # h : temps de vidange du bassin versant
SEUIL_CRUE, SEUIL_SECHERESSE = 3.0, 0.2


def normale(normales, date):
    """Normales du jour, interpolées entre les milieux de mois."""
    m = date.month - 1
    f = (date.day - 15) / 30
    voisin = normales[(m + (1 if f >= 0 else -1)) % 12]
    return [a + (b - a) * abs(f) for a, b in zip(normales[m], voisin)]


def soleil(latitude, date, heure):
    # shortcut: heure du jeu = heure solaire (midi = soleil au sud), à corriger si un jeu affiche l'heure légale
    lat = math.radians(latitude)
    decl = math.radians(23.44) * math.sin(2 * math.pi * (284 + date.timetuple().tm_yday) / 365)
    w0 = math.degrees(math.acos(max(-1.0, min(1.0, -math.tan(lat) * math.tan(decl)))))
    sin_e = (math.sin(lat) * math.sin(decl)
             + math.cos(lat) * math.cos(decl) * math.cos(math.radians(15 * (heure - 12))))
    # Rayonnement par ciel clair (modèle de Meinel) en W/m²
    clair = 1361 * sin_e * 0.7 ** ((1 / sin_e) ** 0.678) if sin_e > 0.01 else 0.0
    return {"elevation": round(math.degrees(math.asin(sin_e)), 1), "lever": round(12 - w0 / 15, 2),
            "coucher": round(12 + w0 / 15, 2), "clair": clair}


def ouest_est(angle):
    """Écart d'angle ramené entre −180 et 180°."""
    return (angle + 180) % 360 - 180


class Zone:
    def __init__(self, definition, mois):
        self.d = definition
        self.nom = definition["nom"]
        self.z = self.anomalie = self.vent_ecart = self.reservoir = self.neige = 0.0
        self.direction = DIRECTION_DOMINANTE
        self.sol = RESERVE_SOL * (0.9 if mois in (11, 12, 1, 2, 3) else 0.4)
        self.temperature = self.nebulosite = self.pluie = self.vent = self.rafales = self.ensoleillement = 0.0
        self.debit, self.meteo = 1.0, "soleil"
        self.drapeaux = {"crue": False, "secheresse": False, "gel": False, "neige": False, "orage": False}

    def pas(self, c, n, sol, heure, h, rng, messages):
        tmin, tmax, pluie_mois, jours, vent_moy = n
        fp, fv = self.d.get("pluie", 1.0), self.d.get("vent", 1.0)

        # Situation météo : processus aléatoire lent, en partie commun à toute la région
        a = math.exp(-h / TAU_METEO)
        self.z = self.z * a + math.sqrt(1 - a * a) * rng.gauss(0, 1)
        z = 0.8 * c.z_commun + 0.6 * self.z
        frac = min(0.5, jours * fp * HEURES_DE_PLUIE_PAR_JOUR / 720)  # part du temps où il pleut
        q = N01.inv_cdf(1 - frac)
        moyenne_exces = N01.pdf(q) / frac - q
        # Intensité calibrée pour retrouver le cumul mensuel normal
        precip = pluie_mois * fp / (frac * 720) * (z - q + 0.5) / (moyenne_exces + 0.5) if z > q else 0.0
        self.nebulosite = N01.cdf(z + 0.15)

        # Température : normale + cycle du jour (amorti par les nuages) + masses d'air
        moy = (tmin + tmax) / 2 + self.d.get("dt", 0.0)
        # Ciel clair : écart jour/nuit plus fort que la normale, ciel couvert : plus faible (0,725 = moyenne)
        amplitude = (tmax - tmin) / 2 * (1 - 0.5 * self.nebulosite) / 0.725
        a = math.exp(-h / TAU_TEMP)
        self.anomalie = self.anomalie * a + math.sqrt(1 - a * a) * SIGMA_TEMP * rng.gauss(0, 1)
        self.temperature = moy + amplitude * math.cos(2 * math.pi * (heure - 15) / 24) + self.anomalie - (1.5 if precip else 0)

        # Vent : plus fort au passage des perturbations, revient vers la direction dominante
        a = math.exp(-h / TAU_VENT)
        self.vent_ecart = self.vent_ecart * a + math.sqrt(1 - a * a) * SIGMA_VENT * rng.gauss(0, 1)
        self.vent = max(0.0, vent_moy * fv * (1 + self.vent_ecart + 0.3 * max(z, 0)))
        self.direction = (self.direction + rng.gauss(0, 15 * math.sqrt(h))
                          + ouest_est(DIRECTION_DOMINANTE - self.direction) * min(1, h / 24)) % 360

        neige = precip > 0 and self.temperature < 1
        orage = precip > 0 and self.temperature > 18 and z > q + 0.8
        self.rafales = self.vent * (2.5 if orage else 1.5)
        self.pluie = precip

        # Bilan d'eau : pluie et fonte entrent, évaporation sort, le surplus part à la rivière
        self.ensoleillement = sol["clair"] * (1 - 0.75 * self.nebulosite ** 3)
        if neige:
            self.neige += precip * h
        fonte = min(self.neige, FONTE * max(self.temperature, 0) * h)
        self.neige -= fonte
        evaporation = self.ensoleillement * ETP * (1 + max(self.temperature, 0) / 30) * h * self.sol / RESERVE_SOL
        self.sol += (0 if neige else precip * h) + fonte - evaporation
        surplus = max(0.0, self.sol - RESERVE_SOL)
        self.sol = max(0.0, min(self.sol, RESERVE_SOL))
        self.reservoir = (self.reservoir + surplus) * math.exp(-h / TAU_RIVIERE)
        self.debit = 0.5 + 0.8 * self.sol / RESERVE_SOL + self.reservoir / 15

        brouillard = (4 <= heure <= 10 and not precip and self.vent < 2.5
                      and self.sol > 0.5 * RESERVE_SOL and self.temperature < moy)
        self.meteo = ("orage" if orage else "neige" if neige else "pluie" if precip else
                      "brouillard" if brouillard else "nuages" if self.nebulosite > 0.65 else "soleil")

        self._signaler("crue", self.debit > SEUIL_CRUE, f"Crue : les rivières débordent ({self.nom}).", messages)
        self._signaler("secheresse", self.sol < SEUIL_SECHERESSE * RESERVE_SOL, f"Sécheresse : les sols sont secs ({self.nom}).", messages)
        self._signaler("gel", self.temperature < -0.5, f"Gelée ({self.nom}).", messages, retour=self.temperature > 2)
        self._signaler("neige", self.neige > 5, f"La neige tient au sol ({self.nom}).", messages, retour=self.neige < 1)
        self._signaler("orage", orage, f"Orage ({self.nom}) : rafales à {round(self.rafales * 3.6)} km/h.", messages)

    def _signaler(self, cle, actif, texte, messages, retour=None):
        """Annonce un phénomène quand il commence (hystérésis pour éviter les annonces en rafale)."""
        if actif and not self.drapeaux[cle]:
            self.drapeaux[cle] = True
            messages.append((texte, "alerte"))
        elif self.drapeaux[cle] and (not actif if retour is None else retour):
            self.drapeaux[cle] = False

    def etat(self):
        return {"nom": self.nom, "rect": self.d.get("rect"), "meteo": self.meteo,
                "temperature": round(self.temperature, 1), "nebulosite": round(self.nebulosite, 2),
                "pluie": round(self.pluie, 2), "vent": round(self.vent, 1), "rafales": round(self.rafales, 1),
                "direction": round(self.direction), "ensoleillement": round(self.ensoleillement),
                "humidite_sol": round(self.sol / RESERVE_SOL, 3), "neige_cm": round(self.neige, 1),
                "debit": round(self.debit, 2), **self.drapeaux}


class Climat:
    """zones : liste de {"nom", "rect": [x0, y0, x1, y1], "dt": °C, "pluie": facteur, "vent": facteur}."""

    def __init__(self, rng, date, latitude=44.8, normales=BORDEAUX, zones=None):
        self.rng, self.latitude, self.normales = rng, latitude, normales
        self.zones = [Zone(z, date.month) for z in (zones or [{"nom": "Région"}])]
        self.z_commun = 0.0
        self.soleil = soleil(latitude, date, 12)

    def zone_de(self, x, y):
        for z in self.zones:
            r = z.d.get("rect")
            if r and r[0] <= x < r[2] and r[1] <= y < r[3]:
                return z
        return self.zones[0]

    def avancer(self, date, heure, heures):
        messages = []
        while heures > 1e-9:
            h = min(1.0, heures)
            heures -= h
            heure += h
            if heure >= 24:
                heure -= 24
                date += dt.timedelta(days=1)
            self.soleil = soleil(self.latitude, date, heure)
            a = math.exp(-h / TAU_METEO)
            self.z_commun = self.z_commun * a + math.sqrt(1 - a * a) * self.rng.gauss(0, 1)
            n = normale(self.normales, date)
            for z in self.zones:
                z.pas(self, n, self.soleil, heure, h, self.rng, messages)
        return messages

    def etat(self):
        s = self.soleil
        return {"soleil": {k: s[k] for k in ("elevation", "lever", "coucher")}, "zones": [z.etat() for z in self.zones]}

    def sauver(self):
        return {"z_commun": self.z_commun, "zones": {z.nom: {k: getattr(z, k) for k in (
            "z", "anomalie", "vent_ecart", "reservoir", "neige", "direction", "sol", "drapeaux")} for z in self.zones}}

    def charger(self, data):
        self.z_commun = data["z_commun"]
        for z in self.zones:
            for k, v in data["zones"].get(z.nom, {}).items():
                setattr(z, k, v)
