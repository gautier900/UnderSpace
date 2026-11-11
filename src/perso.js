// Données personnelles : ce que l'utilisateur écoute (profil Deezer + coches manuelles)
// et les recommandations qui en découlent. Tout reste dans le navigateur.
import { rappeurs } from './data/rappeurs.js';
import { liens } from './data/liens.js';
import { loadProfile } from './deezer.js';

const MANUEL_KEY = 'underspace-ecoutes';
export const NB_RECOS = 12;

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]/g, '');

// --- Coches manuelles « déjà écouté » -----------------------------------------
function loadManuel() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MANUEL_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
export function toggleManuel(id) {
  const s = loadManuel();
  s.has(id) ? s.delete(id) : s.add(id);
  try {
    localStorage.setItem(MANUEL_KEY, JSON.stringify([...s]));
  } catch {}
  return s.has(id);
}

// --- Calcul ------------------------------------------------------------------
function compute() {
  const profil = loadProfile();
  const manuel = loadManuel();
  const byId = new Map(rappeurs.map((r) => [r.id, r]));
  const deezerIdOf = new Map(Object.entries(liens).map(([rid, l]) => [rid, l.deezerId]));
  const ridByDeezer = new Map([...deezerIdOf].map(([rid, d]) => [d, rid]));
  const ridByName = new Map(rappeurs.map((r) => [norm(r.nom), r.id]));

  // Artistes écoutés par l'utilisateur (tous, y compris hors UnderSpace), avec un poids.
  const ecouteDeezer = new Map(); // idDeezer -> { nom, poids }
  for (const a of profil?.artistes ?? []) ecouteDeezer.set(a.id, a);

  // Artistes UnderSpace déjà écoutés : via Deezer (id ou nom) ou coche manuelle.
  const ecoutes = new Map(); // rid -> 'deezer' | 'manuel'
  for (const a of ecouteDeezer.values()) {
    const rid = ridByDeezer.get(a.id) ?? ridByName.get(norm(a.nom));
    if (rid) ecoutes.set(rid, 'deezer');
  }
  for (const rid of manuel) if (byId.has(rid) && !ecoutes.has(rid)) ecoutes.set(rid, 'manuel');

  // Poids d'un artiste UnderSpace écouté (les coches manuelles comptent comme un favori).
  const poidsUS = (rid) => {
    const d = ecouteDeezer.get(deezerIdOf.get(rid));
    return d ? d.poids : ecoutes.has(rid) ? 3 : 0;
  };
  // Atténue les très gros poids (un artiste écouté 200 fois ne doit pas tout écraser).
  const amortir = (w) => Math.log2(1 + w);

  // Featurings entre artistes UnderSpace (dans les deux sens).
  const feats = new Map(); // rid -> Map(rid -> nb)
  const addFeat = (a, b) => {
    if (a === b) return;
    if (!feats.has(a)) feats.set(a, new Map());
    feats.get(a).set(b, (feats.get(a).get(b) ?? 0) + 1);
  };
  for (const r of rappeurs) {
    for (const s of r.singles ?? []) {
      for (const f of s.featurings ?? []) {
        const other = ridByName.get(norm(f));
        if (other) {
          addFeat(r.id, other);
          addFeat(other, r.id);
        }
      }
    }
  }

  const recos = [];
  if (profil || manuel.size) {
    for (const r of rappeurs) {
      if (ecoutes.has(r.id)) continue;
      let score = 0;
      const raisons = new Map(); // texte -> poids (pour garder les plus parlantes)
      const note = (txt, w) => {
        score += w;
        raisons.set(txt, (raisons.get(txt) ?? 0) + w);
      };
      const l = liens[r.id];

      // 1. Deezer : un artiste que tu écoutes fait partie des « proches » de cet artiste.
      (l?.proches ?? []).forEach(([did, nom], i) => {
        const e = ecouteDeezer.get(did);
        const ridE = ridByDeezer.get(did);
        const w = e ? e.poids : ridE && ecoutes.has(ridE) ? poidsUS(ridE) : 0;
        if (w) note(`proche de ${e?.nom ?? byId.get(ridE)?.nom ?? nom}`, amortir(w) * (1 - i / 40));
      });
      // 2. Deezer, dans l'autre sens : cet artiste est un « proche » d'un artiste UnderSpace que tu écoutes.
      for (const [ridE] of ecoutes) {
        const pos = (liens[ridE]?.proches ?? []).findIndex(([did]) => did === l?.deezerId);
        if (pos >= 0) note(`proche de ${byId.get(ridE).nom}`, 0.8 * amortir(poidsUS(ridE)) * (1 - pos / 40));
      }
      // 3. Featurings avec des artistes que tu écoutes.
      for (const [ridE, nb] of feats.get(r.id) ?? []) {
        if (ecoutes.has(ridE)) note(`en featuring avec ${byId.get(ridE).nom}`, 1.5 + 0.5 * Math.min(nb, 3));
      }
      // 4. Même collectif.
      if (r.collectif) {
        for (const [ridE] of ecoutes) {
          if (byId.get(ridE).collectif === r.collectif) note(`même collectif que ${byId.get(ridE).nom} (${r.collectif})`, 1.5);
        }
      }
      // 5. Styles en commun (petit bonus).
      const tags = new Set((r.tags ?? []).map(norm));
      if (tags.size) {
        let commun = 0;
        for (const [ridE] of ecoutes) for (const t of byId.get(ridE).tags ?? []) if (tags.has(norm(t))) commun++;
        if (commun) score += Math.min(commun * 0.25, 1.5);
      }

      if (score > 0.5 && raisons.size) {
        const top = [...raisons].sort((a, b) => b[1] - a[1]).map(([t]) => t);
        recos.push({ id: r.id, score, raisons: top.slice(0, 3) });
      }
    }
    recos.sort((a, b) => b.score - a.score);
  }

  return {
    connecte: !!profil,
    profil,
    ecoutes, // Map rid -> 'deezer' | 'manuel'
    manuel,
    recos, // [{ id, score, raisons }]
    recoIds: new Set(recos.slice(0, NB_RECOS).map((r) => r.id)),
    recoOf: new Map(recos.map((r) => [r.id, r])),
  };
}

export const perso = compute();
