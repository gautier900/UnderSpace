// « Connexion » Deezer par profil public.
// Deezer n'accepte plus de nouvelles applications OAuth : on ne peut pas demander de mot de passe.
// En revanche, les favoris d'un profil PUBLIC sont lisibles par l'API publique (sans compte),
// via JSONP (l'API ne permet pas les appels fetch() directs depuis un autre site).

const API = 'https://api.deezer.com/';
export const STORAGE_KEY = 'underspace-deezer';

let n = 0;
export function jsonp(path, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = `__dz${Date.now()}_${n++}`;
    const qs = new URLSearchParams({ ...params, output: 'jsonp', callback: cb });
    const script = document.createElement('script');
    const timer = setTimeout(() => done(new Error('Deezer ne répond pas')), 15000);
    function done(err, data) {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
      err ? reject(err) : resolve(data);
    }
    window[cb] = (data) => {
      if (data?.error) done(new Error(data.error.message || 'Erreur Deezer'), null);
      else done(null, data);
    };
    script.onerror = () => done(new Error('Impossible de joindre Deezer'));
    script.src = `${API}${path}?${qs}`;
    document.head.append(script);
  });
}

// Récupère toutes les pages d'une liste Deezer (100 éléments par page).
async function all(path, max = 2000) {
  const out = [];
  for (let index = 0; index < max; index += 100) {
    const d = await jsonp(path, { limit: 100, index });
    out.push(...(d.data ?? []));
    if (!d.next || !(d.data ?? []).length) break;
  }
  return out;
}

// Accepte un identifiant (123456) ou un lien de profil (https://www.deezer.com/fr/profile/123456).
export function parseProfile(input) {
  const s = String(input ?? '').trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/deezer\.com\/(?:[a-z]{2}\/)?profile\/(\d+)/i);
  if (m) return m[1];
  if (/link\.deezer\.com|deezer\.page\.link/i.test(s)) {
    throw new Error(
      "Ce lien court ne peut pas être lu directement. Ouvre-le dans ton navigateur : l'adresse finale contient /profile/ suivi de ton numéro, copie-la ici.",
    );
  }
  throw new Error('Colle le lien de ton profil Deezer (il contient /profile/ et un numéro) ou juste ce numéro.');
}

// Lit le profil et les favoris, et calcule un « poids » d'écoute par artiste.
export async function fetchProfile(userId, onStep = () => {}) {
  onStep('Lecture du profil…');
  const user = await jsonp(`user/${userId}`);
  const poids = new Map(); // idDeezer -> { id, nom, poids, image }
  const add = (a, w) => {
    if (!a?.id) return;
    const cur = poids.get(a.id) ?? { id: a.id, nom: a.name, poids: 0, image: a.picture_medium ?? null };
    cur.poids += w;
    if (!cur.image && a.picture_medium) cur.image = a.picture_medium;
    poids.set(a.id, cur);
  };

  onStep('Artistes favoris…');
  const artistes = await all(`user/${userId}/artists`);
  artistes.forEach((a) => add(a, 3));

  onStep('Albums favoris…');
  const albums = await all(`user/${userId}/albums`);
  albums.forEach((al) => add(al.artist, 2));

  onStep('Titres favoris…');
  const titres = await all(`user/${userId}/tracks`);
  titres.forEach((t) => add(t.artist, 1));

  onStep('Playlists…');
  const playlists = (await all(`user/${userId}/playlists`, 300)).filter((p) => p.creator?.id === user.id).slice(0, 25);
  for (const [i, p] of playlists.entries()) {
    onStep(`Playlists (${i + 1}/${playlists.length})…`);
    const tr = await all(`playlist/${p.id}/tracks`, 500).catch(() => []);
    tr.forEach((t) => add(t.artist, 0.5));
  }

  if (!artistes.length && !albums.length && !titres.length && !playlists.length) {
    throw new Error(
      "Aucun favori lisible : ton profil Deezer est peut-être privé. Rends-le public dans Deezer (Paramètres → Confidentialité) puis réessaie.",
    );
  }

  return {
    user: { id: user.id, nom: user.name, image: user.picture_medium ?? null, lien: user.link },
    artistes: [...poids.values()].sort((a, b) => b.poids - a.poids),
    albums: albums.map((al) => ({ id: al.id, titre: al.title, artiste: al.artist?.name, artisteId: al.artist?.id, cover: al.cover_medium })),
    titres: titres.map((t) => ({ titre: t.title, artiste: t.artist?.name, artisteId: t.artist?.id, album: t.album?.title })),
    majLe: new Date().toISOString(),
  };
}

export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}
export function saveProfile(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}
export function clearProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
