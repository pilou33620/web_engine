"use strict";
// ============================================================ lignes électriques
// tracé au moindre coût : la montagne et la traversée d'un bras de mer peu profond coûtent plus cher, la haute mer est interdite
const poidsHex = t => (t.t === 'montagne' ? 3 : t.t === 'cote' || t.t === 'lac' ? 2.5 : t.t === 'colline' ? 1.4 : t.t === 'foret' ? 1.2 : 1);
const passable = (t, a, b) => t === a || t === b || (!t.brume && t.t !== 'mer' && !t.occ && t !== FRONT_T && (!t.ville || t.ville === a.ville || t.ville === b.ville));  // dans sa propre ville, la ligne passe en souterrain
function chemin(a, b) {
  const d = new Map([[a, 0]]), prev = new Map([[a, null]]), fait = new Set(), tas = [[0, a]];  // tas binaire : file de priorité
  const pousser = e => { tas.push(e); let i = tas.length - 1; while (i) { const p = (i - 1) >> 1; if (tas[p][0] <= tas[i][0]) break; [tas[p], tas[i]] = [tas[i], tas[p]]; i = p; } };
  const tirer = () => { const h = tas[0], f = tas.pop(); if (tas.length) { tas[0] = f; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < tas.length && tas[l][0] < tas[m][0]) m = l; if (r < tas.length && tas[r][0] < tas[m][0]) m = r; if (m === i) break; [tas[m], tas[i]] = [tas[i], tas[m]]; i = m; } } return h; };
  while (tas.length) {
    const [dm, t] = tirer(); if (fait.has(t)) continue; if (t === b) break; fait.add(t);
    for (const n of voisins(t)) if (passable(n, a, b)) { const v = dm + poidsHex(n); if (v < (d.get(n) ?? Infinity)) { d.set(n, v); prev.set(n, t); pousser([v, n]); } }
  }
  if (!prev.has(b)) return null;
  const p = []; for (let t = b; t; t = prev.get(t)) p.unshift(t); return p;
}
const poidsChemin = p => p.slice(1).reduce((a, t) => a + poidsHex(t), 0);
const bout = t => (t.ville ? t.ville.centre : t);
function finValide(t, kv) {
  t = bout(t);
  if (KV[kv].an > annee(S.min)) return `Le ${KV[kv].nom} arrive en ${KV[kv].an}`;
  if (t.ville) return kv <= 63 ? null : 'Une ville se raccorde en 15 ou 63 kV, par son poste source';
  if (!t.occ) return 'Une ligne relie deux ouvrages : poste, centrale ou ville';
  if (estEauU(t.occ)) return 'Les ouvrages d’eau se relient par conduites, dans la vue Eau';
  if (estDecU(t.occ) && !TYPES[t.occ.type].mw) return 'Les sites de déchets sont desservis par les camions de collecte';
  const ty = t.occ.type, mw = TYPES[ty].mw;
  if (ty === 'frontiere' && kv <= 63) return 'L’interconnexion se fait en 225 ou 400 kV';
  if (kv === 15 && mw > 15) return `${t.occ.nom} est trop puissante pour du 15 kV`;
  if (kv === 63 && mw > 150) return `${t.occ.nom} est trop puissante pour du 63 kV`;
  if (kv === 400 && !['poste', 'frontiere'].includes(ty) && mw < 400) return 'Le 400 kV est réservé aux postes et aux grosses centrales';
  // seul un poste transforme : une centrale reste soit en transport (225/400 kV), soit en répartition (15/63 kV)
  if (ty !== 'poste' && LIGNES.some(l => (l.a === t || l.b === t) && (l.kv > 63) !== (kv > 63))) return `${t.occ.nom} est déjà raccordée en ${kv > 63 ? '15/63' : '225/400'} kV : seul un poste 225/63 kV change de tension`;
  return null;
}
function capLigne(l) {
  let k = 1 + (rd('htls') ? .3 : 0) + (rd('compens') && l.kv > 63 ? .1 : 0);
  if (rd('dlr')) { const w = meteo(S.min); if (w.temp < 8 || w.vent > 9) k += .15; }
  return KV[l.kv].cap * k;
}
function pylone(L, x, y, z, ry, kv) {
  const m = lot(), s = kv === 15 ? .8 : kv === 63 ? .58 : kv === 225 ? .78 : 1;
  if (kv === 15) { put(m, cyl(.28, .36, 8.4, 6), 0x7a5a3a, 0, 4.2, 0, 0, .16); put(m, boite(6.8, .35, .35), 0x7a5a3a, 0, 8.2, 0, 0, .14); transfere(m, L, x, y, z, ry, s); return; }  // poteau en bois
  const f = cyl(.45, 1.5, 9.4, 4); f.rotateY(Math.PI / 4); put(m, f, 0x99a2ac, 0, 4.7, 0, 0, .2);
  put(m, boite(7.2, .45, .55), 0x99a2ac, 0, 8.4, 0, 0, .18);
  if (kv !== 63) put(m, boite(kv === 400 ? 9 : 4.4, .4, .5), 0x99a2ac, 0, 6.6, 0, 0, .18);
  put(m, cone(.5, 1.6, 4), 0x99a2ac, 0, 10.2, 0, 0, .14);
  transfere(m, L, x, y, z, ry, s);
}
function tracerLigne(a, b, kv, { immediat = false, chemin: p0 = null } = {}) {
  a = bout(a); b = bout(b);
  const p = p0 || chemin(a, b); if (!p) return null;
  const l = { id: 'l' + (++uid), a, b, kv, tuiles: p, fin: immediat ? 0 : S.min + KV[kv].delai * MOIS_MIN, hs: 0, f: 0, taux: 0, sur: 0, len: p.length - 1 };
  l.nom = `${nomCourt(a)} – ${nomCourt(b)}`;
  LIGNES.push(l); dessinerLigne(l); if (!immediat) pop(l.grp);
  return l;
}
const nomCourt = t => (t.ville ? t.ville.nom : t.occ ? (t.occ.type === 'poste' ? `Poste ${t.occ.nom.replace(/^Poste /, '')}` : t.occ.type === 'frontiere' ? 'Frontière' : t.occ.nom) : TERR[t.t].nom);
function dessinerLigne(l) {
  jeter(l.grp);
  const p = l.tuiles, L = lot(), att = [], s = l.kv === 15 ? .8 : l.kv === 63 ? .58 : l.kv === 225 ? .78 : 1;
  l.pyl = [];
  p.forEach((t, i) => {
    const pr = p[Math.max(0, i - 1)], nx = p[Math.min(p.length - 1, i + 1)];
    let dx = nx.x - pr.x, dz = nx.z - pr.z; const ln = Math.hypot(dx, dz) || 1; dx /= ln; dz /= ln;
    const px = -dz, pz = dx, extr = i === 0 || i === p.length - 1, sout = !extr && !!t.ville;
    let dec = 0;
    if (!extr && !sout) { if (!l.pylDec) l.pylDec = []; if (l.pylDec[i] === undefined) { l.pylDec[i] = [0, 3.4, -3.4, 6.8, -6.8][t.npyl] ?? 0; t.npyl++; l.pyl.push(t); } else l.pyl.push(t); dec = l.pylDec[i]; }
    const x = t.x + px * dec, z = t.z + pz * dec;
    if (!extr && !sout) pylone(L, x, t.top, z, Math.atan2(-pz, px), l.kv);
    att.push({ x, z, y: t.top + (extr ? 4.5 : sout ? .6 : 8.4 * s), px, pz, extr: extr || sout });
  });
  const C = lot();
  for (const k of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < att.length - 1; i++) {
      const A = att[i], B = att[i + 1], ea = A.extr ? .6 : 3.3 * s, eb = B.extr ? .6 : 3.3 * s;
      for (let st = 0; st <= 8; st++) {
        const u = st / 8; if (i && !st) continue;
        pts.push(new THREE.Vector3(A.x + A.px * ea * k + (B.x + B.px * eb * k - A.x - A.px * ea * k) * u, A.y + (B.y - A.y) * u - 1.8 * 4 * u * (1 - u), A.z + A.pz * ea * k + (B.z + B.pz * eb * k - A.z - A.pz * ea * k) * u));
      }
    }
    put(C, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, l.kv === 15 ? .1 : l.kv === 63 ? .14 : .19, 4), 0xffffff, 0, 0, 0, 0, 0);
  }
  l.grp = fige(L, scene, l.fin ? CHANT : MAT);
  const mc = new THREE.MeshBasicMaterial({ color: 0x2d2621, transparent: !!l.fin, opacity: l.fin ? .4 : 1 }); mc.userData = {};
  l.cables = new THREE.Mesh(mergeGeometries(C.g), mc); l.cables.userData.propre = true; l.grp.add(l.cables);
  l.pts = att.map(a => new THREE.Vector3(a.x, a.y - .9, a.z));
  l.long = []; let d = 0; l.pts.forEach((q, i) => { if (i) d += q.distanceTo(l.pts[i - 1]); l.long.push(d); });
  majParticules(); stylerL(l);
}
function demolirLigne(l, silencieux = false) {
  jeter(l.grp); LIGNES.splice(LIGNES.indexOf(l), 1);
  for (const t of l.pyl || []) t.npyl = Math.max(0, t.npyl - 1);
  majParticules(); if (!silencieux) log(`Ligne ${KV[l.kv].nom} ${l.nom} démontée.`, 'alerte');
}
// particules d'énergie le long des câbles : sens et vitesse selon le transit
let PART = null, PDATA = [];
function majParticules() {
  if (PART) { scene.remove(PART); PART.dispose(); }
  PDATA = []; for (const l of LIGNES) for (let i = 0, n = Math.max(1, Math.round(l.long.at(-1) / 18)); i < n; i++) PDATA.push({ l, s: i / n });
  PART = new THREE.InstancedMesh(new THREE.SphereGeometry(.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a0 }), Math.max(1, PDATA.length));
  PART.count = PDATA.length; scene.add(PART);
}
const MD = new THREE.Matrix4();
function animParticules(dt) {
  if (PART) PART.visible = vue === 'elec'; if (vue !== 'elec') return;
  PDATA.forEach((p, i) => {
    const L = p.l, tot = L.long.at(-1) || 1, actif = !L.fin && !(L.hs > S.min) && Math.abs(L.f) > .5;
    if (!actif) { MD.makeScale(0, 0, 0); PART.setMatrixAt(i, MD); return; }
    p.s = ((p.s + dt * Math.sign(L.f) * (8 + Math.min(40, Math.abs(L.f) / 6)) / tot) % 1 + 1) % 1; const d = p.s * tot;
    let k = 1; while (k < L.long.length - 1 && L.long[k] < d) k++;
    const u = (d - L.long[k - 1]) / ((L.long[k] - L.long[k - 1]) || 1);
    VA.lerpVectors(L.pts[k - 1], L.pts[k], u); VA.y -= 1.8 * 4 * u * (1 - u);
    MD.makeTranslation(VA.x, VA.y, VA.z); PART.setMatrixAt(i, MD);
  });
  if (PART) PART.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------ dessin des conduites et de l'eau qui circule (vue Eau)
const EAU_G = new THREE.Group(); EAU_G.visible = false; scene.add(EAU_G);
const CHAL_G = new THREE.Group(); scene.add(CHAL_G);  // le réseau de chaleur reste visible dans toutes les vues
const MCONT_T = new THREE.MeshBasicMaterial({ color: 0x0b1410, side: THREE.BackSide }), MJONC = new THREE.MeshToonMaterial({ color: 0xe4e8ea, gradientMap: degrade });
const posNoeud = (t, f) => new THREE.Vector3(t.x + DECAL[f][0], Math.max(t.top, -.6) + 1.1, t.z + DECAL[f][1]);
let FLUX_EAU = [], PART_EAU = null;
function dessinerEau() {
  for (const G of [EAU_G, CHAL_G]) { G.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.userData.propre) o.material.dispose(); } }); G.clear(); } FLUX_EAU = [];
  const noeuds = new Map();
  for (const e of ARETES.values()) {
    for (const t of [e.a, e.b]) { const k = e.f + '|' + t.k; (noeuds.get(k) || noeuds.set(k, { t, f: e.f, es: [] }).get(k)).es.push(e); }
    const [col, ray] = TUYAU[e.type], A = posNoeud(e.a, e.f), B = posNoeud(e.b, e.f), seg = new THREE.LineCurve3(A, B);
    e.mat = new THREE.MeshToonMaterial({ color: col, gradientMap: degrade });
    const c = new THREE.Mesh(new THREE.TubeGeometry(seg, 1, ray, 10), e.mat); c.userData.propre = true;
    (e.f === 'c' ? CHAL_G : EAU_G).add(c, new THREE.Mesh(new THREE.TubeGeometry(seg, 1, ray + .3, 10), MCONT_T));
    const h = new THREE.Vector3(0, ray * .8, 0);
    if (e.f !== 'c') FLUX_EAU.push({ e, a: A.clone().add(h), b: B.clone().add(h), col: new THREE.Color(col).lerp(new THREE.Color(0xffffff), .65), v: e.type === 'secondaire' ? 7 : 11, taille: ray * .75 });
  }
  for (const { t, f, es } of noeuds.values()) {  // coude arrondi dans les virages, regard aux embranchements et aux extrémités
    const P = posNoeud(t, f), gros = es.reduce((a, e) => (TUYAU[e.type][1] > TUYAU[a.type][1] ? e : a)), ray = TUYAU[gros.type][1];
    if (es.length === 2) {
      const [n1, n2] = es.map(e => (e.a === t ? e.b : e.a));
      if (n1.q + n2.q === 2 * t.q && n1.r + n2.r === 2 * t.r) continue;
      const c = new THREE.Mesh(new THREE.SphereGeometry(ray, 12, 8), gros.mat), o = new THREE.Mesh(new THREE.SphereGeometry(ray + .3, 12, 8), MCONT_T);
      c.position.copy(P); o.position.copy(P); (f === 'c' ? CHAL_G : EAU_G).add(c, o); continue;
    }
    const j = new THREE.Mesh(new THREE.CylinderGeometry(ray * 1.6, ray * 1.6, ray * 2.4, 12), MJONC), o = new THREE.Mesh(new THREE.CylinderGeometry(ray * 1.6 + .3, ray * 1.6 + .3, ray * 2.4 + .6, 12), MCONT_T);
    j.position.copy(P); o.position.copy(P); (f === 'c' ? CHAL_G : EAU_G).add(j, o);
  }
  // courant de la rivière
  const pts = []; for (const t of RIV) if (t.rivPts) for (const [x, z] of t.rivPts) pts.push(new THREE.Vector3(x, t.top + .4, z));
  for (let i = 1; i < pts.length; i++) if (i % 2 === 0) FLUX_EAU.push({ riv: true, a: pts[i - 1], b: pts[i], col: new THREE.Color(0xe8fbff), v: 6, taille: .55 });
  if (PART_EAU) { scene.remove(PART_EAU); PART_EAU.dispose(); }
  const n = FLUX_EAU.reduce((s, f) => s + (f.riv ? 1 : 2), 0);
  PART_EAU = new THREE.InstancedMesh(new THREE.SphereGeometry(.55, 8, 6), new THREE.MeshBasicMaterial(), Math.max(1, n)); PART_EAU.count = n; PART_EAU.frustumCulled = false;
  let i = 0; for (const f of FLUX_EAU) for (let k = 0, nb = f.riv ? 1 : 2; k < nb; k++) { f.s = f.s || []; f.s.push(k / nb); PART_EAU.setColorAt(i++, f.col); }
  PART_EAU.visible = vue === 'eau'; scene.add(PART_EAU);
  majVetuste();
}
function animEau(dt) {
  if (!PART_EAU) return; PART_EAU.visible = vue === 'eau'; if (vue !== 'eau') return;
  let i = 0;
  for (const f of FLUX_EAU) {
    const coule = f.riv || (!(f.e.hs && f.e.hs > S.min) && (f.e.f === 'a' || (f.e.f === 'r' ? (S.eau.reutQ || 0) > 0 : (f.e.res?.taux ?? 1) > 0)));
    for (let k = 0; k < f.s.length; k++) {
      if (!coule || DOUX) { MD.makeScale(0, 0, 0); PART_EAU.setMatrixAt(i++, MD); continue; }
      f.s[k] = (f.s[k] + dt * f.v / Math.max(1, f.a.distanceTo(f.b))) % 1;
      VA.lerpVectors(f.a, f.b, f.s[k]); const e = f.taille; MD.makeScale(e, e, e).setPosition(VA.x, VA.y, VA.z); PART_EAU.setMatrixAt(i++, MD);
    }
  }
  PART_EAU.instanceMatrix.needsUpdate = true;
}
function majVetuste() {
  const a = annee(S.min);
  for (const e of ARETES.values()) { if (!e.mat) continue; if (S.lentille === 'vetuste' && !mode) { CA.setHex(0x5cc46a); CB.setHex(0xe5533f); e.mat.color.lerpColors(CA, CB, clamp((a - e.an) / 70, 0, 1)); } else e.mat.color.setHex(e.hs && e.hs > S.min ? 0x8a3a30 : TUYAU[e.type][0]); }
}
