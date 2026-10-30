// Module « construction » : outils universels pour tracer des lignes, placer des bâtiments et démolir.
// Branché par app.js via installer(ctx) ; les règles de validité reprennent moteur/construction.py.
const P = window.PIXI;
const AIMANT_PX = 18;  // distance d'aimantation et de « toucher le dernier point », en pixels écran
const COULEUR = 0xffd34d, VALIDE = 0x6fdc7a, ROUGE = 0xe0503c, BLEU_AIMANT = 0x4ad0ff;
const DEMOLIR = { id: "demolir", libelle: "Démolir", type: "demolir", icone: "🧨" };

export function installer(ctx) {
  const outils = ctx.$("outils"), barre = document.createElement("div");
  barre.className = "construction-barre";
  barre.hidden = true;
  document.body.appendChild(barre);
  const apercu = new P.Container(), g = apercu.addChild(new P.Graphics());
  const etiquette = apercu.addChild(new P.Text({ text: "", resolution: 2,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: "600", fill: 0xffffff, stroke: { color: 0x000000, width: 4 } } }));
  etiquette.anchor.set(0.5, 0);
  ctx.rendu.monde.addChild(apercu);

  let modeles = [], modele = null, points = [], curseur = null, aimant = null, fantome = null, cible = null;
  let survolActif = false, occupe = false, sale = true, zoomDessine = 0;
  const outil = { tap, survol, annuler: desactiver };
  const k = () => 1 / ctx.rendu.zoom;
  const unite = () => modele.unite ?? "€";
  const disponible = () => ctx.etat?.ressources[modele.ressource ?? "argent"]?.valeur ?? 0;
  // En mètres : la carte peut avoir une échelle (mètres par unité monde), comme le calcul du serveur
  const longueur = () => (ctx.carte.echelle ?? 1) * points.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0), 0);
  const cout = () => Math.round(modele.type === "ligne" ? (modele.cout * longueur()) / 1000 : modele.cout);
  const prix = (v) => `${ctx.nombre.format(v)} ${unite()}`;
  const proche = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * ctx.rendu.zoom < AIMANT_PX;
  const horsCarte = ([x, y]) => { const [L, H] = ctx.carte.taille; return !(x >= 0 && y >= 0 && x <= L && y <= H); };

  // Seul un vrai survol (souris, stylet en approche) pilote l'aperçu ; un doigt qui glisse déplace la carte
  ctx.app.canvas.addEventListener("pointermove", (e) => { survolActif = e.buttons === 0 && e.pointerType !== "touch"; }, true);
  ctx.app.canvas.addEventListener("pointerleave", () => { curseur = aimant = null; sale = true; });

  // Sommet de ligne (même calque de préférence) ou centre de bâtiment à moins de AIMANT_PX
  function aimanter(p) {
    const r = AIMANT_PX * k();
    let mieux = null, score = Infinity;
    for (const e of ctx.carte.entites) {
      const meme = e.type === "batiment" || e.calque === modele.calque;
      const pts = e.type === "batiment" ? [[e.x, e.y]] : e.type === "ligne" && (meme || e.constructible) ? e.points : [];
      for (const q of pts) {
        const d = Math.hypot(q[0] - p.x, q[1] - p.y), s = d + (meme ? 0 : r);
        if (d < r && s < score) [mieux, score] = [q, s];
      }
    }
    return mieux && [mieux[0], mieux[1]];
  }

  function invalidite([x, y]) {
    if (horsCarte([x, y])) return "Hors de la carte.";
    const r = modele.rayon ?? 20;
    if (ctx.carte.entites.some((b) => b.type === "batiment" && Math.hypot(b.x - x, b.y - y) < r + (b.taille ?? 20)))
      return "Trop près d'un autre bâtiment.";
    if (disponible() < cout()) return `Pas assez de ressources : ${prix(cout())} nécessaires.`;
    return null;
  }

  async function executer(nom, params) {
    if (occupe) return null;
    occupe = true;
    majBarre();
    try { return await ctx.action(nom, params); } finally { occupe = false; majBarre(); }
  }

  async function terminer() {
    if (points.length < 2) return ctx.toast("Posez au moins deux points.", true);
    if (await executer("construire", { modele: modele.id, points })) points = [];
    aimant = null;
    rafraichir();
  }

  async function placer() {
    const erreur = invalidite(fantome);
    if (erreur) return ctx.toast(erreur, true);
    await executer("construire", { modele: modele.id, x: fantome[0], y: fantome[1] });
    rafraichir();
  }

  async function demolir() {
    const id = cible.id;
    cible = null;
    await executer("demolir", { id });
    rafraichir();
  }

  function tap(p, entite) {
    if (!ctx.carte || occupe) return;
    if (modele.type === "ligne") {
      const q = aimanter(p) ?? [p.x, p.y];
      if (points.length >= 2 && proche(q, points.at(-1))) return terminer();
      if (horsCarte(q)) return ctx.toast("Hors de la carte.", true);
      if (points.length && proche(q, points.at(-1))) return;  // double toucher sur le premier point
      aimant = q[0] !== p.x || q[1] !== p.y ? q : null;
      points.push(q);
    } else if (modele.type === "batiment") {
      // Souris ou stylet en survol : le fantôme est déjà là, un toucher suffit ; au doigt, un 1er toucher le pose
      const confirme = survolActif || (fantome && proche(fantome, [p.x, p.y]));
      fantome = [p.x, p.y];
      if (confirme) return placer();
    } else if (!entite?.constructible) {
      cible = null;
      ctx.toast(entite ? `${entite.nom ?? "Ceci"} ne peut pas être démoli.` : "Rien à démolir ici.", true);
    } else if (cible?.id === entite.id) return demolir();
    else cible = entite;
    rafraichir();
  }

  function survol(p) {
    if (!modele || !survolActif || !ctx.carte) return;
    if (modele.type === "ligne") {
      aimant = aimanter(p);
      curseur = aimant ?? [p.x, p.y];
    } else if (modele.type === "batiment") fantome = [p.x, p.y];
    sale = true;
  }

  function dessiner() {
    sale = false;
    zoomDessine = ctx.rendu.zoom;
    g.clear();
    etiquette.visible = false;
    if (!modele) return;
    const s = k();
    if (modele.type === "ligne") {
      const chemin = (pts) => { g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); };
      if (points.length > 1) {
        chemin(points);
        g.stroke({ width: 7 * s, color: 0x000000, alpha: 0.35, cap: "round", join: "round" });
        chemin(points);
        g.stroke({ width: 3.5 * s, color: COULEUR, alpha: 0.95, cap: "round", join: "round" });
      }
      if (points.length && curseur && survolActif) {
        g.moveTo(...points.at(-1)).lineTo(...curseur).stroke({ width: 2.5 * s, color: COULEUR, alpha: 0.55 });
      }
      for (const q of points) g.circle(q[0], q[1], 5 * s).fill(COULEUR).stroke({ width: 1.5 * s, color: 0x000000 });
      // Le dernier point est entouré : le toucher à nouveau termine la ligne
      if (points.length >= 2) g.circle(...points.at(-1), 10 * s).stroke({ width: 2 * s, color: COULEUR });
      if (aimant) g.circle(aimant[0], aimant[1], 13 * s).stroke({ width: 3 * s, color: BLEU_AIMANT });
      else if (curseur && survolActif) g.circle(curseur[0], curseur[1], 4 * s).fill({ color: COULEUR, alpha: 0.7 });
    } else if (modele.type === "batiment" && fantome) {
      const couleur = invalidite(fantome) ? ROUGE : VALIDE, r = modele.rayon ?? 20;
      g.circle(fantome[0], fantome[1], r).fill({ color: couleur, alpha: 0.3 }).stroke({ width: 2.5 * s, color: couleur });
      g.circle(fantome[0], fantome[1], 3 * s).fill(couleur);
      etiquette.text = `${modele.icone ?? ""} ${prix(cout())}`.trim();
      etiquette.style.fill = couleur === ROUGE ? 0xffb0a5 : 0xffffff;
      etiquette.position.set(fantome[0], fantome[1] + r + 6 * s);
      etiquette.scale.set(s);
      etiquette.visible = true;
    } else if (cible) {
      if (cible.type === "ligne") {
        g.moveTo(...cible.points[0]);
        for (const q of cible.points.slice(1)) g.lineTo(...q);
        g.stroke({ width: 9 * s, color: ROUGE, alpha: 0.7, cap: "round", join: "round" });
      } else g.circle(cible.x, cible.y, cible.taille ?? 20).fill({ color: ROUGE, alpha: 0.25 }).stroke({ width: 3 * s, color: ROUGE });
    }
  }

  // --- Barre flottante : structure fixe par outil, seul le texte et l'état des boutons changent ---
  function construireBarre() {
    const boutons = modele.type === "ligne"
      ? [["retirer", "↶ Retirer le dernier point"], ["annuler", "Annuler"], ["terminer", "Terminer"]]
      : modele.type === "batiment" ? [["placer", "Placer"], ["fermer", "Fermer"]] : [["demolir", "Démolir"], ["fermer", "Fermer"]];
    barre.innerHTML = `<span class="infos"></span><span class="boutons">${boutons.map(([a, l]) =>
      `<button data-a="${a}" class="${a === "terminer" || a === "placer" || a === "demolir" ? "principal" : ""}">${ctx.esc(l)}</button>`).join("")}</span>`;
    barre.hidden = false;
  }

  function majBarre() {
    if (!modele) return (barre.hidden = true);
    barre.classList.toggle("occupe", occupe);
    const infos = barre.querySelector(".infos"), b = (a) => barre.querySelector(`[data-a="${a}"]`);
    const titre = `${modele.icone ?? ""} ${modele.libelle}`.trim();
    if (modele.type === "ligne") {
      const manque = disponible() < cout();
      infos.innerHTML = points.length
        ? `${ctx.esc(titre)} · <b>${(longueur() / 1000).toFixed(2).replace(".", ",")} km</b> · <b class="${manque ? "manque" : ""}">${ctx.esc(prix(cout()))}</b>`
        : `${ctx.esc(titre)} · ${ctx.esc(prix(modele.cout))}/km — touchez la carte pour poser le premier point`;
      b("retirer").disabled = !points.length || occupe;
      b("terminer").disabled = points.length < 2 || occupe;
    } else if (modele.type === "batiment") {
      const erreur = fantome && invalidite(fantome);
      infos.innerHTML = `${ctx.esc(titre)} · <b class="${disponible() < cout() ? "manque" : ""}">${ctx.esc(prix(cout()))}</b>${
        erreur ? ` — <span class="manque">${ctx.esc(erreur)}</span>` : fantome ? "" : " — touchez la carte pour placer"}`;
      b("placer").disabled = !fantome || !!erreur || occupe;
    } else {
      infos.textContent = cible ? `Démolir « ${cible.nom ?? cible.style} » ? Touchez-la à nouveau pour confirmer.` : "Touchez une construction à démolir.";
      b("demolir").disabled = !cible || occupe;
    }
  }

  barre.addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (a === "retirer") points.pop(), (aimant = null);
    else if (a === "annuler") { if (!points.length) return desactiver(); points = []; aimant = null; }
    else if (a === "terminer") return terminer();
    else if (a === "placer") return placer();
    else if (a === "demolir" && cible) return demolir();
    else if (a === "fermer") return desactiver();
    rafraichir();
  });

  function rafraichir() { sale = true; majBarre(); }

  function activer(m) {
    if (modele === m) return desactiver();
    points = [];
    curseur = aimant = fantome = cible = null;
    modele = m;
    ctx.afficherInfo(null);
    ctx.outil = outil;
    construireBarre();
    majOutils();
    rafraichir();
  }

  function desactiver() {
    modele = null;
    points = [];
    curseur = aimant = fantome = cible = null;
    if (ctx.outil === outil) ctx.outil = null;
    majOutils();
    rafraichir();
  }

  function majOutils() {
    for (const b of outils.children) {
      const actif = b.dataset.id === modele?.id;
      b.classList.toggle("actif", actif);
      b.setAttribute("aria-pressed", actif);
    }
  }

  outils.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) activer(b.dataset.id === DEMOLIR.id ? DEMOLIR : modeles.find((m) => m.id === b.dataset.id));
  });

  ctx.surCarte((carte) => {
    ctx.rendu.monde.addChild(apercu);  // reste au-dessus de ce que d'autres modules auraient ajouté
    if (cible) cible = carte.entites.find((e) => e.id === cible.id) ?? null;
    const signature = JSON.stringify(carte.constructions ?? []);
    if (signature !== outils.dataset.signature) {
      outils.dataset.signature = signature;
      modeles = carte.constructions ?? [];
      outils.hidden = !modeles.length;
      outils.innerHTML = modeles.length ? [...modeles, DEMOLIR].map((m) =>
        `<button data-id="${ctx.esc(m.id)}" title="${ctx.esc(m.libelle)}" aria-label="${ctx.esc(m.libelle)}" aria-pressed="false">
          <span class="icone" aria-hidden="true">${ctx.esc(m.icone ?? "▪")}</span><span class="libelle">${ctx.esc(m.libelle)}</span></button>`).join("") : "";
      if (modele && modele !== DEMOLIR) modele = modeles.find((m) => m.id === modele.id) ?? null;
      if (!modele) desactiver();
      majOutils();
    }
    rafraichir();
  });
  ctx.surEtat(() => modele && majBarre());

  ctx.app.ticker.add(() => {
    if (modele && ctx.outil !== outil) desactiver();  // un autre module a pris la main
    if (sale || zoomDessine !== ctx.rendu.zoom) dessiner();
  });
}
