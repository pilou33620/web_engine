"""Vérifie que le climat simulé retrouve les normales réelles : python3 tests/test_climat.py"""
import datetime as dt
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from moteur.climat import BORDEAUX, Climat, soleil

# Soleil à Bordeaux : environ 15 h 30 de jour au solstice d'été, 8 h 50 en hiver
ete, hiver = soleil(44.8, dt.date(2026, 6, 21), 12), soleil(44.8, dt.date(2026, 12, 21), 12)
assert 15.2 < ete["coucher"] - ete["lever"] < 15.9, ete
assert 8.6 < hiver["coucher"] - hiver["lever"] < 9.1, hiver
assert 66 < ete["elevation"] < 70 and 20 < hiver["elevation"] < 24
assert soleil(44.8, dt.date(2026, 6, 21), 0)["clair"] == 0

ANS = 10
c = Climat(random.Random(4), dt.date(2000, 1, 1))
z = c.zones[0]
date = dt.date(2000, 1, 1)
temp = {m: [] for m in range(1, 13)}
pluie = {m: 0.0 for m in range(1, 13)}
sol = {m: [] for m in range(1, 13)}
jours_gel = jours_neige = 0
for _ in range(ANS * 365):
    gel = neige = False
    for heure in range(24):
        c.avancer(date, heure, 1)
        temp[date.month].append(z.temperature)
        pluie[date.month] += z.pluie
        sol[date.month].append(z.sol)
        gel |= z.temperature < 0
        neige |= z.meteo == "neige"
    jours_gel += gel
    jours_neige += neige
    date += dt.timedelta(days=1)

moyenne = lambda l: sum(l) / len(l)
for m in (1, 4, 7, 10):
    attendu = (BORDEAUX[m - 1][0] + BORDEAUX[m - 1][1]) / 2
    assert abs(moyenne(temp[m]) - attendu) < 1.5, (m, moyenne(temp[m]), attendu)
total = sum(pluie.values()) / ANS
assert 0.8 * 909 < total < 1.2 * 909, total          # cumul annuel normal : 909 mm
assert moyenne(sol[2]) > 2 * moyenne(sol[8]), "sols humides l'hiver, secs l'été"
assert 5 < jours_gel / ANS < 60, jours_gel / ANS      # Bordeaux : ~25 jours de gel par an
print(f"OK — climat vérifié : {total:.0f} mm/an, {jours_gel / ANS:.0f} jours de gel/an, "
      f"{jours_neige / ANS:.1f} jours de neige/an, juillet {moyenne(temp[7]):.1f} °C, janvier {moyenne(temp[1]):.1f} °C")
