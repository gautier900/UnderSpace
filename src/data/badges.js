// Badges affichés sur les planètes, les fiches et les pages artiste.
// Pour renommer un badge ou changer son icône / sa couleur, modifie juste ce fichier.
//
// Dans src/data/rappeurs.json, on attribue un badge à la main avec :
//   badges: ['coup-de-coeur', 'pepite']
// Deux badges peuvent aussi s'afficher tout seuls :
//   - « nouveau »         : si l'artiste a  ajouteLe: 'AAAA-MM-JJ'  il y a moins de DUREE_NOUVEAU_JOURS jours
//   - « nouvelle-sortie » : si un projet ou un single a  date: 'AAAA-MM-JJ'  il y a moins de DUREE_SORTIE_JOURS jours

import { perso } from '../perso.js';

export const DUREE_NOUVEAU_JOURS = 30;
export const DUREE_SORTIE_JOURS = 30;

export const BADGES = {
  'coup-de-coeur': { label: 'Coup de cœur', icone: '❤️', couleur: '#ff6b9a' },
  nouveau: { label: 'Nouveau', icone: '✨', couleur: '#7fe0d0' },
  'nouvelle-sortie': { label: 'Nouvelle sortie', icone: '🔥', couleur: '#ffa040' },
  pepite: { label: 'Pépite', icone: '💎', couleur: '#9fb8ff' }, // artiste qui mérite plus de visibilité
  // Badges personnels (seulement une fois le profil Deezer relié ou des artistes cochés à la main)
  recommande: { label: 'Recommandé pour toi', icone: '🧭', couleur: '#c6f06a', perso: true },
  ecoute: { label: 'Déjà écouté', icone: '✅', couleur: '#8fd8a8', perso: true },
};

const ORDER = Object.keys(BADGES);
const DAY = 24 * 60 * 60 * 1000;

// Nombre de jours écoulés depuis une date 'AAAA-MM-JJ' (lue en heure locale, pas en UTC).
function joursDepuis(date, today) {
  const [y, m, d] = String(date).split('-').map(Number);
  if (!y || !m || !d) return Infinity;
  const t = new Date(y, m - 1, d).getTime();
  return Math.floor((today - t) / DAY);
}

// Renvoie la liste des badges d'un artiste : [{ id, label, icone, couleur }, ...]
export function badgesOf(r, today = Date.now()) {
  const ids = new Set(r.badges ?? []);
  if (r.ajouteLe) {
    const j = joursDepuis(r.ajouteLe, today);
    if (j >= 0 && j <= DUREE_NOUVEAU_JOURS) ids.add('nouveau');
  }
  const sorties = [...(r.projets ?? []), ...(r.singles ?? [])];
  if (sorties.some((s) => s.date && joursDepuis(s.date, today) >= 0 && joursDepuis(s.date, today) <= DUREE_SORTIE_JOURS)) {
    ids.add('nouvelle-sortie');
  }
  if (perso.recoIds.has(r.id)) ids.add('recommande');
  if (perso.ecoutes.has(r.id)) ids.add('ecoute');
  return ORDER.filter((id) => ids.has(id)).map((id) => ({ id, ...BADGES[id] }));
}
