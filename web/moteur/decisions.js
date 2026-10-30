// Module « decisions » : cartes des décisions en attente (ctx.etat.decisions), un bouton par choix.
const VISIBLES = 2;

export function installer(ctx) {
  const zone = ctx.$("decisions"), journal = ctx.$("journal");
  const cartes = new Map();  // id → élément, pour ne pas recréer les boutons sous le doigt
  let derniere = "", ouvert = false;
  const entete = document.createElement("button");
  entete.className = "decisions-entete";
  entete.onclick = () => { ouvert = !ouvert; ranger(); };
  zone.append(entete);

  zone.addEventListener("click", (ev) => {
    // Toucher le titre replie la carte (téléphone : libère la vue sans décider)
    if (ev.target.closest(".decision h3")) return ev.target.closest(".decision").classList.toggle("reduite");
    const b = ev.target.closest("button[data-index]");
    if (!b) return;
    const carte = b.closest(".decision");
    for (const x of carte.querySelectorAll("button")) x.disabled = true;
    ctx.action("decider", { id: carte.dataset.id, index: Number(b.dataset.index) })
      .then((res) => { if (!res) for (const x of carte.querySelectorAll("button")) x.disabled = false; });
  });

  function ranger() {
    const actives = [...cartes.values()];
    actives.forEach((c, i) => c.classList.toggle("repliee", !ouvert && i >= VISIBLES));
    const caches = actives.length - VISIBLES;
    entete.hidden = actives.length < 2;
    entete.textContent = `Décisions · ${actives.length}${caches > 0 ? (ouvert ? "  ▴" : `  · ${caches} de plus ▾`) : ""}`;
    zone.classList.toggle("ouvert", ouvert);
  }

  ctx.surEtat((etat) => {
    // La pile se pose juste au-dessus du journal, quelle que soit sa hauteur
    zone.style.setProperty("--haut-journal", `${journal.offsetHeight}px`);
    zone.classList.toggle("en-retrait", !!ctx.outil);
    const liste = etat.decisions ?? [], cle = JSON.stringify(liste);
    if (cle === derniere) return;
    derniere = cle;
    const ids = new Set(liste.map((d) => d.id));
    for (const [id, c] of cartes) {
      if (ids.has(id)) continue;
      cartes.delete(id);
      c.classList.add("partante");
      setTimeout(() => c.remove(), 300);
    }
    for (const d of liste) {
      if (cartes.has(d.id)) continue;
      const c = document.createElement("article");
      c.className = "decision";
      c.dataset.id = d.id;
      c.innerHTML = `<h3>${ctx.esc(d.titre)}</h3><p>${ctx.esc(d.texte)}</p><div class="choix-decision">${d.choix.map((ch, i) =>
        `<button data-index="${i}" class="${i === 0 ? "bouton-or" : ""}">${ctx.esc(ch.libelle)}</button>`).join("")}</div>`;
      cartes.set(d.id, c);
      zone.append(c);
    }
    if (cartes.size <= VISIBLES) ouvert = false;
    ranger();
  });
}
