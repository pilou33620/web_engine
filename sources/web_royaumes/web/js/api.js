// Les appels au serveur Rust (le moteur décide de tout ; la page affiche et envoie les ordres).

async function appel(methode, chemin, corps) {
  const r = await fetch(chemin, {
    method: methode,
    headers: corps ? { 'Content-Type': 'application/json' } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
    credentials: 'same-origin',
  });
  let j = null;
  try { j = await r.json(); } catch { j = { ok: false, msg: `Réponse illisible (${r.status})` }; }
  if (!r.ok && j && j.ok === undefined) j.ok = false;
  return j;
}

export const api = {
  info: () => appel('GET', '/api/info'),
  regles: () => appel('GET', '/api/regles'),
  apercu: o => appel('POST', '/api/apercu', o),
  nouvelle: o => appel('POST', '/api/nouvelle', o),
  carte: () => appel('GET', '/api/carte'),
  etat: () => appel('GET', '/api/etat'),
  cmd: c => appel('POST', '/api/cmd', c),
  finTour: () => appel('POST', '/api/fin_tour', {}),
  sauvegardes: () => appel('GET', '/api/sauvegardes'),
  sauver: nom => appel('POST', '/api/sauver', { nom }),
  charger: nom => appel('POST', '/api/charger', { nom }),
};
