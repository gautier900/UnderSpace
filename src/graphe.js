// Graphe des liens entre artistes UnderSpace, pour le jeu « Six degrés ».
//   - lien « feat »   : les deux artistes sont sur un même morceau (principal ou invités), que ce soit
//                       un single (fiches) ou un autre morceau collecté sur Deezer (src/data/feats.json) ;
//   - lien « proche » : Deezer les classe parmi les artistes proches (optionnel, plus faible).
import { rappeurs } from './data/rappeurs.js';
import { liens } from './data/liens.js';
import feats from './data/feats.json';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]/g, '');

export const byId = new Map(rappeurs.map((r) => [r.id, r]));
const idByName = new Map(rappeurs.map((r) => [norm(r.nom), r.id]));
const idByDeezer = new Map(Object.entries(liens).map(([rid, l]) => [l.deezerId, rid]));

// adj : id -> Map(id -> [{ type, titre?, annee? }])
const adj = new Map(rappeurs.map((r) => [r.id, new Map()]));
function addEdge(a, b, info) {
  if (!a || !b || a === b) return;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const m = adj.get(x);
    if (!m.has(y)) m.set(y, []);
    const list = m.get(y);
    if (!list.some((e) => e.type === info.type && norm(e.titre) === norm(info.titre))) list.push(info);
  }
}

// Tous les artistes présents sur un même morceau sont reliés deux à deux :
// l'artiste principal avec chaque invité, mais aussi les invités entre eux
// (ex. Deelee S et Ledouble, tous deux invités sur un single de Reallo).
for (const r of rappeurs) {
  for (const s of r.singles ?? []) {
    const presents = [r.id, ...(s.featurings ?? []).map((f) => idByName.get(norm(f))).filter(Boolean)];
    const uniques = [...new Set(presents)];
    for (let i = 0; i < uniques.length; i++)
      for (let j = i + 1; j < uniques.length; j++)
        addEdge(uniques[i], uniques[j], { type: 'feat', titre: s.titre, annee: s.annee, de: r.id });
  }
}
// Morceaux collectés par scripts/build-feats.py (src/data/feats.json, version allégée) :
// albums/EP des artistes, mais aussi leurs apparitions chez d'autres
// (ex. « tarif groupé » de Hologram Lo', avec Huntrill et Tedax Max).
// Chaque entrée : [titre, année, projet, idAuteur | null, nomAuteur | null, [ids UnderSpace]]
for (const [titre, annee, projet, de, deNom, ids] of feats) {
  const presents = ids.filter((x) => adj.has(x));
  for (let i = 0; i < presents.length; i++)
    for (let j = i + 1; j < presents.length; j++)
      addEdge(presents[i], presents[j], { type: 'feat', titre, annee, de: adj.has(de) ? de : null, deNom, projet });
}

for (const [rid, l] of Object.entries(liens)) {
  for (const [did] of l.proches ?? []) addEdge(rid, idByDeezer.get(did), { type: 'proche' });
}

const hasFeat = (a, b) => (adj.get(a)?.get(b) ?? []).some((e) => e.type === 'feat');

// Liens directs entre deux artistes (les featurings d'abord).
export function lienEntre(a, b, { proches = false } = {}) {
  const list = adj.get(a)?.get(b) ?? [];
  const feats = list.filter((e) => e.type === 'feat').sort((x, y) => (y.annee ?? 0) - (x.annee ?? 0));
  if (feats.length) return feats;
  return proches ? list.filter((e) => e.type === 'proche') : [];
}

export function voisins(id, { proches = false } = {}) {
  return [...(adj.get(id) ?? [])].filter(([, list]) => list.some((e) => e.type === 'feat' || proches)).map(([v]) => v);
}

// Plus court chemin (Dijkstra) : un featuring coûte 1, un lien « proche » 1.5.
export function chemin(a, b, { proches = false } = {}) {
  if (!adj.has(a) || !adj.has(b)) return null;
  if (a === b) return [a];
  const dist = new Map([[a, 0]]);
  const prev = new Map();
  const todo = new Set([a]);
  while (todo.size) {
    let u = null;
    for (const x of todo) if (u === null || dist.get(x) < dist.get(u)) u = x;
    todo.delete(u);
    if (u === b) break;
    for (const [v, list] of adj.get(u)) {
      const cost = list.some((e) => e.type === 'feat') ? 1 : proches ? 1.5 : Infinity;
      const d = dist.get(u) + cost;
      if (d < (dist.get(v) ?? Infinity)) {
        dist.set(v, d);
        prev.set(v, u);
        todo.add(v);
      }
    }
  }
  if (!dist.has(b) || !Number.isFinite(dist.get(b))) return null;
  const path = [b];
  while (path[0] !== a) path.unshift(prev.get(path[0]));
  return path;
}

// Défi : deux artistes reliés par featurings, à `min`–`max` degrés l'un de l'autre.
export function defiAleatoire(min = 3, max = 5) {
  const ids = rappeurs.map((r) => r.id).filter((id) => voisins(id).length);
  for (let essai = 0; essai < 400; essai++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    const p = chemin(a, b);
    if (p && p.length - 1 >= min && p.length - 1 <= max) return { a, b, solution: p };
  }
  return null;
}

// Collaborations d'un artiste (featurings uniquement), les plus nombreuses d'abord.
// → [{ id, morceaux: [{ titre, annee, projet?, de }] }]
export function collaborations(id) {
  return [...(adj.get(id) ?? [])]
    .map(([v, list]) => ({ id: v, morceaux: list.filter((e) => e.type === 'feat') }))
    .filter((c) => c.morceaux.length)
    .sort((a, b) => b.morceaux.length - a.morceaux.length || byId.get(a.id).nom.localeCompare(byId.get(b.id).nom, 'fr'));
}

export const stats = {
  artistesRelies: rappeurs.filter((r) => [...adj.get(r.id).values()].some((l) => l.some((e) => e.type === 'feat'))).length,
  feats: [...adj.values()].reduce((n, m) => n + [...m.values()].filter((l) => l.some((e) => e.type === 'feat')).length, 0) / 2,
};
export { hasFeat };
