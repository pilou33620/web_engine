// Interface générique : relie le serveur, le rendu, le kit d'interface et les modules.
// Les modules (vues, minicarte, construction, décisions, tutoriel) reçoivent un contexte « ctx »
// et s'y branchent ; ils ne modifient pas ce fichier.
import { Rendu, CALQUES } from "./moteur/rendu.js";
import { THEMES, fusionnerStyles } from "./moteur/themes/index.js";
import * as vues from "./moteur/vues.js";
import * as minicarte from "./moteur/minicarte.js";
import * as construction from "./moteur/construction.js";
import * as decisions from "./moteur/decisions.js";
import * as tutoriel from "./moteur/tutoriel.js";
import * as trafic from "./moteur/trafic.js";

const MODULES = [vues, minicarte, construction, decisions, tutoriel, trafic];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const memo = {
  lire(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  ecrire(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};
const NOMS_CALQUES = { sol: "Sols", occupation: "Occupation du sol", eau: "Eaux", vegetation: "Végétation", relief: "Relief", routes: "Routes", reseaux: "Réseaux",
  frontieres: "Frontières", batiments: "Bâtiments", unites: "Unités", etiquettes: "Noms" };
const RESSOURCES = { argent: ["€", "Trésorerie"], ble: ["🌾", "Blé"], bois: ["🪵", "Bois"], population: ["👥", "Population"],
  energie: ["⚡", "Énergie (MWh)"] };
const METEO = { soleil: "☀️", nuages: "☁️", pluie: "🌧️", neige: "❄️", orage: "⛈️", brouillard: "🌫️" };
const VENTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const virgule = (v, d = 1) => v.toFixed(d).replace(".", ",");
const ciel = (z) => (z.meteo === "soleil" && etat.climat.soleil.elevation < 0 ? "🌙" : METEO[z.meteo] ?? "");
const horaire = (h) => `${Math.floor(h)}h${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
const VITESSES = [1, 2, 5, 20];
const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const jour = (iso) => new Date(iso + "T12:00:00");

// Fichiers propres au jeu (jeux/<nom>/web/), chargés seulement s'ils existent : styles.js et module.js
const fichiersDuJeu = (await (await fetch("/api/jeu")).json()).fichiers;
const fichierDuJeu = (nom) => (fichiersDuJeu.includes(nom) ? import(`/jeu/${nom}`) : null);
fusionnerStyles((await fichierDuJeu("styles.js"))?.default);
const moduleDuJeu = await fichierDuJeu("module.js");

const app = new PIXI.Application();
await app.init({ resizeTo: window, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
$("scene").appendChild(app.canvas);
const rendu = new Rendu(app);
const abonnes = { etat: [], carte: [] };
let etat = null, versionCarte = -1, dernierJournal = "", dernieresZones = "", selection = null, fiche = null;

// --- Contexte partagé avec les modules ---
const ctx = {
  app, rendu, api, action, toast, $, esc, nombre,
  get etat() { return etat; },
  get carte() { return rendu.carte; },
  get selection() { return selection; },
  outil: null,              // outil actif : { tap(pointMonde, entite), survol?(pointMonde), annuler?() }
  surEtat: (f) => abonnes.etat.push(f),     // f(etat) à chaque mise à jour (5 fois/s)
  surCarte: (f) => abonnes.carte.push(f),   // f(carte) après chaque redessin de la carte
  afficherInfo,
};

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
    return res;
  } catch (e) {
    toast(e.message, true);
    return null;
  }
}
async function rafraichir() {
  etat = await api("/api/etat");
  if (etat.version_carte !== versionCarte) {
    const carte = await api("/api/carte");
    versionCarte = carte.version;
    rendu.dessinerCarte(carte);
    $("titre-jeu").textContent = document.title = carte.titre || "web_engine";
    for (const f of abonnes.carte) f(carte);
    if (selection?.id) afficherInfo(carte.entites.find((e) => e.id === selection.id) ?? null);
  }
  rendu.majEtat(etat);
  majInterface();
  for (const f of abonnes.etat) f(etat);
}
// shortcut: interrogation du serveur 5 fois/s ; passer au WebSocket si le réseau sature ou pour le multijoueur
async function boucle() {
  try { await rafraichir(); } catch (e) { $("date").textContent = "Serveur injoignable"; console.error(e); }
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

// Météo locale d'une sélection (entité ou zone climatique), mise à jour en direct
function climatDe(sel) {
  let z;
  if (sel.type === "climat") z = etat.climat.zones[sel.index];
  else {
    const p = sel.points ? { x: sel.points[0][0], y: sel.points[0][1] } : { x: sel.x + (sel.w ?? 0) / 2, y: sel.y + (sel.h ?? 0) / 2 };
    z = rendu.climat.zoneDe(p.x, p.y);
  }
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

// Fiche d'une entité (fournie par les règles du jeu) ou d'une zone climatique
async function afficherInfo(e) {
  selection = e;
  rendu.surligner?.(e?.id ? e : null);
  const info = $("info");
  if (!e) return (info.hidden = true);
  if (e.type === "climat") {
    fiche = { titre: "Climat", lignes: [], actions: [] };
  } else {
    try { fiche = await api(`/api/info?id=${encodeURIComponent(e.id)}`); } catch { return afficherInfo(null); }
    if (selection !== e) return;  // une autre sélection est arrivée entre-temps
  }
  info.innerHTML = `<h2>${esc(fiche.titre)}</h2>${fiche.lignes.map((l) => `<p>${esc(l)}</p>`).join("")}
    <div id="info-climat">${climatDe(e)}</div>
    <div class="actions">${fiche.actions.map((a, i) => `<button class="bouton-or" data-index="${i}">${esc(a.libelle)}</button>`).join("")}
    <button data-action="fermer">Fermer</button></div>`;
  info.hidden = false;
}
$("zones").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) afficherInfo({ type: "climat", index: Number(b.dataset.zone) });
});
$("info").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.action === "fermer") return afficherInfo(null);
  const a = fiche?.actions[Number(b.dataset.index)];
  if (a) action(a.nom, a.params);
});

function changerTheme(nom) {
  if (!THEMES[nom]) nom = "aerienne";
  document.body.dataset.theme = THEMES[nom].css;
  rendu.appliquerTheme(THEMES[nom]);
  memo.ecrire("theme", nom);
  for (const b of $("choix-theme").children) b.classList.toggle("actif", b.dataset.theme === nom);
  if (selection?.id) rendu.surligner?.(selection);
}

// --- Gestes : glisser, pincer, molette, toucher ; un outil actif reçoit les touchers ---
const toile = app.canvas, pointeurs = new Map();
let glisse = 0;
toile.addEventListener("pointerdown", (e) => {
  toile.setPointerCapture(e.pointerId);
  pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointeurs.size === 1) glisse = 0;
});
toile.addEventListener("pointermove", (e) => {
  ctx.outil?.survol?.(rendu.versMonde(e.clientX, e.clientY));
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
  if (e.type === "pointerup" && pointeurs.size === 1 && glisse < 8) {
    const entite = rendu.chercher(e.clientX, e.clientY);
    if (ctx.outil) ctx.outil.tap(rendu.versMonde(e.clientX, e.clientY), entite);
    else afficherInfo(entite);
  }
  pointeurs.delete(e.pointerId);
};
toile.addEventListener("pointerup", relacher);
toile.addEventListener("pointercancel", relacher);
toile.addEventListener("wheel", (e) => { e.preventDefault(); rendu.zoomer(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
addEventListener("keydown", (e) => { if (e.key === "Escape") ctx.outil?.annuler?.(); });

// --- Boutons ---
const milieu = () => [innerWidth / 2, innerHeight / 2];
$("zoom-plus").onclick = () => rendu.zoomer(1.4, ...milieu());
$("zoom-moins").onclick = () => rendu.zoomer(1 / 1.4, ...milieu());
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
$("calques").innerHTML = CALQUES.map((c) => `<label><input type="checkbox" data-calque="${c}" checked>${NOMS_CALQUES[c] ?? c}</label>`).join("");
$("calques").onchange = (e) => rendu.afficherCalque(e.target.dataset.calque, e.target.checked);

changerTheme(memo.lire("theme", "aerienne"));
for (const m of MODULES) m.installer(ctx);
moduleDuJeu?.installer(ctx);
boucle();
