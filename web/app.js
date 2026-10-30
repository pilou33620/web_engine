// Interface générique : relie le serveur, le rendu et le kit d'interface.
import { Rendu, CALQUES } from "./moteur/rendu.js";
import { THEMES } from "./moteur/themes.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const memo = {
  lire(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  ecrire(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};
const NOMS_CALQUES = { sol: "Sols", haies: "Haies", eau: "Rivières", routes: "Routes", frontieres: "Frontières", villes: "Villes", unites: "Unités", etiquettes: "Noms" };
const RESSOURCES = { argent: ["€", "Trésorerie"], ble: ["🌾", "Blé"], bois: ["🪵", "Bois"], population: ["👥", "Population"] };
const SOLS = { chaume: "Chaume", culture: "Blé en herbe", prairie: "Prairie", labour: "Labour", colza: "Colza", foret: "Forêt" };
const METEO = { soleil: "☀️", nuages: "☁️", pluie: "🌧️", neige: "❄️", orage: "⛈️", brouillard: "🌫️" };
const VENTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const virgule = (v, d = 1) => v.toFixed(d).replace(".", ",");
const ciel = (z) => (z.meteo === "soleil" && etat.climat.soleil.elevation < 0 ? "🌙" : METEO[z.meteo] ?? "");
const horaire = (h) => `${Math.floor(h)}h${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
const VITESSES = [1, 2, 5, 20];
const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const jour = (iso) => new Date(iso + "T12:00:00");

const app = new PIXI.Application();
await app.init({ resizeTo: window, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
$("scene").appendChild(app.canvas);
const rendu = new Rendu(app);
let etat = null, versionCarte = -1, dernierJournal = "", dernieresZones = "", selection = null;

// --- Serveur ---
async function api(chemin, corps) {
  const r = await fetch(chemin, corps ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) } : {});
  const data = await r.json();
  if (!r.ok) throw new Error(data.erreur ?? "Erreur du serveur");
  return data;
}
async function action(nom, params = {}) {
  try {
    const res = await api("/api/action", { nom, params });
    if (res.message) toast(res.message);
    await rafraichir();
  } catch (e) { toast(e.message, true); }
}
async function rafraichir() {
  etat = await api("/api/etat");
  if (etat.version_carte !== versionCarte) {
    const carte = await api("/api/carte");
    versionCarte = carte.version;
    rendu.dessinerCarte(carte);
    if (selection) afficherInfo(carte.entites.find((e) => e.id === selection.id));
  }
  rendu.majEtat(etat);
  majInterface();
}
// shortcut: interrogation du serveur 5 fois/s ; passer au WebSocket si le réseau sature ou pour le multijoueur
async function boucle() {
  try { await rafraichir(); } catch { $("date").textContent = "Serveur injoignable"; }
  setTimeout(boucle, 200);
}

// --- Interface ---
function majInterface() {
  const h = etat.horloge, tour = h.mode === "tour";
  $("date").textContent = dateLongue.format(jour(h.date));
  $("heure").textContent = `${tour ? "" : `${horaire(h.heure)} · `}${h.saison}`;
  const zones = etat.climat.zones.map((z, i) =>
    `<button data-zone="${i}">${esc(z.nom)} ${ciel(z)} ${Math.round(z.temperature)}°</button>`).join("");
  if (zones !== dernieresZones) $("zones").innerHTML = dernieresZones = zones;  // ne pas recréer les boutons sous le doigt
  const bloc = $("info-climat");
  if (bloc && selection) bloc.innerHTML = climatDe(selection);
  $("ressources").innerHTML = Object.entries(etat.ressources).map(([nom, r]) => {
    const [icone, libelle] = RESSOURCES[nom] ?? ["•", nom];
    const d = r.delta ? `<small class="${r.delta > 0 ? "plus" : "moins"}"> ${r.delta > 0 ? "+" : ""}${nombre.format(r.delta)}</small>` : "";
    return `<span class="ressource" title="${esc(libelle)}">${icone} <b>${nombre.format(r.valeur)}</b>${d}</span>`;
  }).join("");
  $("tour").hidden = !tour;
  $("temps").hidden = tour;
  if (tour) {
    const suivant = jour(h.date);
    suivant.setDate(suivant.getDate() + 7);
    $("tour-date").textContent = "→ " + dateLongue.format(suivant);
  }
  $("lecture").textContent = h.pause ? "▶" : "❚❚";
  $("vitesse").textContent = `${h.vitesse}×`;
  for (const b of $("choix-mode").children) b.classList.toggle("actif", b.dataset.mode === h.mode);
  const journal = JSON.stringify(etat.evenements);
  if (journal !== dernierJournal) {
    dernierJournal = journal;
    $("journal").innerHTML = etat.evenements.map((e) =>
      `<li class="evt-${esc(e.importance)}"><time>${esc(dateLongue.format(jour(e.date)).replace(/ \d+$/, ""))}</time>${esc(e.texte)}</li>`).join("");
  }
}

let minuterieToast;
function toast(texte, erreur = false) {
  const t = $("toast");
  t.textContent = texte;
  t.className = `toast visible${erreur ? " erreur" : ""}`;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => t.classList.remove("visible"), 2500);
}

// Météo locale d'une sélection (parcelle, ville ou zone), mise à jour en direct
function climatDe(sel) {
  const z = sel.type === "zone" ? etat.climat.zones[sel.index]
    : rendu.climat.zoneDe(sel.x + (sel.w ?? 0) / 2, sel.y + (sel.h ?? 0) / 2);
  const s = etat.climat.soleil, alerte = (v, t) => (v ? ` <b class="alerte">${t}</b>` : "");
  return `<ul class="climat">
    <li>${ciel(z)} <span>${esc(z.nom)}</span></li>
    <li>🌡️ <span>${virgule(z.temperature)} °C${alerte(z.gel, "gel")}</span></li>
    <li>☀️ <span>${horaire(s.lever)} → ${horaire(s.coucher)} · ${Math.round(z.ensoleillement)} W/m²</span></li>
    <li>☁️ <span>${Math.round(z.nebulosite * 100)} % · ${virgule(z.pluie)} mm/h${alerte(z.orage, "orage")}</span></li>
    <li>💨 <span>${Math.round(z.vent * 3.6)} km/h de ${VENTS[Math.round(z.direction / 22.5) % 16]}, rafales ${Math.round(z.rafales * 3.6)}</span></li>
    <li>💧 <span>sol humide à ${Math.round(z.humidite_sol * 100)} %${alerte(z.secheresse, "sécheresse")}</span></li>
    <li>🌊 <span>débit des rivières ×${virgule(z.debit)}${alerte(z.crue, "crue")}</span></li>
    ${z.neige_cm >= 0.5 ? `<li>❄️ <span>${Math.round(z.neige_cm)} cm de neige</span></li>` : ""}
  </ul>`;
}

function afficherInfo(e) {
  selection = e;
  const info = $("info");
  if (!e) return (info.hidden = true);
  if (e.type === "zone") {
    info.innerHTML = `<h2>Climat</h2><div id="info-climat">${climatDe(e)}</div>
      <div class="actions"><button data-action="fermer">Fermer</button></div>`;
  } else if (e.type === "ville") {
    info.innerHTML = `<h2>${esc(e.nom)}</h2><p>Population : ${nombre.format(e.population)}</p><div id="info-climat">${climatDe(e)}</div>
      <div class="actions"><button data-action="fermer">Fermer</button></div>`;
  } else {
    const ha = ((e.w * e.h) / 10000).toFixed(1).replace(".", ",");
    info.innerHTML = `<h2>${esc(SOLS[e.sol] ?? e.sol)}</h2><p>Parcelle de ${ha} ha</p><div id="info-climat">${climatDe(e)}</div>
      <div class="actions">${e.sol === "labour" ? `<button class="bouton-or" data-action="semer">Semer du colza (800 €)</button>` : ""}
      <button data-action="fermer">Fermer</button></div>`;
  }
  info.hidden = false;
}
$("zones").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) afficherInfo({ type: "zone", index: Number(b.dataset.zone) });
});
$("info").addEventListener("click", (ev) => {
  const a = ev.target.closest("button")?.dataset.action;
  if (a === "semer") action("semer", { id: selection.id });
  if (a === "fermer") afficherInfo(null);
});

function changerTheme(nom) {
  const theme = THEMES[nom] ?? THEMES.ferme;
  document.body.dataset.theme = theme.css;
  rendu.appliquerTheme(theme);
  memo.ecrire("theme", nom);
  for (const b of $("choix-theme").children) b.classList.toggle("actif", b.dataset.theme === nom);
}

// --- Gestes : glisser, pincer, molette, toucher ---
const toile = app.canvas, pointeurs = new Map();
let glisse = 0;
toile.addEventListener("pointerdown", (e) => {
  toile.setPointerCapture(e.pointerId);
  pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointeurs.size === 1) glisse = 0;
});
toile.addEventListener("pointermove", (e) => {
  const p = pointeurs.get(e.pointerId);
  if (!p) return;
  if (pointeurs.size === 1) {
    rendu.deplacer(e.clientX - p.x, e.clientY - p.y);
    glisse += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
  } else if (pointeurs.size === 2) {
    const autre = [...pointeurs.entries()].find(([id]) => id !== e.pointerId)[1];
    const avant = Math.hypot(p.x - autre.x, p.y - autre.y), apres = Math.hypot(e.clientX - autre.x, e.clientY - autre.y);
    if (avant > 0) rendu.zoomer(apres / avant, (e.clientX + autre.x) / 2, (e.clientY + autre.y) / 2);
    glisse = Infinity;
  }
  p.x = e.clientX;
  p.y = e.clientY;
});
const relacher = (e) => {
  if (e.type === "pointerup" && pointeurs.size === 1 && glisse < 8) afficherInfo(rendu.chercher(e.clientX, e.clientY));
  pointeurs.delete(e.pointerId);
};
toile.addEventListener("pointerup", relacher);
toile.addEventListener("pointercancel", relacher);
toile.addEventListener("wheel", (e) => { e.preventDefault(); rendu.zoomer(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });

// --- Boutons ---
const centre = () => [innerWidth / 2, innerHeight / 2];
$("zoom-plus").onclick = () => rendu.zoomer(1.4, ...centre());
$("zoom-moins").onclick = () => rendu.zoomer(1 / 1.4, ...centre());
$("recentrer").onclick = () => rendu.recentrer();
$("lecture").onclick = () => action("pause", { valeur: !etat.horloge.pause });
$("vitesse").onclick = () => action("vitesse", { valeur: VITESSES[(VITESSES.indexOf(etat.horloge.vitesse) + 1) % VITESSES.length] });
$("tour").onclick = () => action("tour_suivant");
$("menu-btn").onclick = () => ($("menu").hidden = false);
$("menu-fermer").onclick = () => ($("menu").hidden = true);
$("choix-theme").onclick = (e) => e.target.dataset.theme && changerTheme(e.target.dataset.theme);
$("choix-mode").onclick = (e) => e.target.dataset.mode && action("mode", { valeur: e.target.dataset.mode });
$("sauver").onclick = () => action("sauver");
$("charger").onclick = () => action("charger");
$("calques").innerHTML = CALQUES.map((c) => `<label><input type="checkbox" data-calque="${c}" checked>${NOMS_CALQUES[c]}</label>`).join("");
$("calques").onchange = (e) => rendu.afficherCalque(e.target.dataset.calque, e.target.checked);

changerTheme(memo.lire("theme", "ferme"));
boucle();
