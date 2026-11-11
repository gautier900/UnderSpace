// Transforme un lien (Spotify, YouTube, Deezer, SoundCloud) en lecteur intégrable.
// Renvoie { src, height, source, kind } ou null si le lien n'est pas reconnu.

export function embedFor(url) {
  if (!url) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  // Spotify : open.spotify.com/(intl-fr/)artist|track|album|playlist/ID
  if (host === "open.spotify.com") {
    const p = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const [kind, id] = p;
    if (!["artist", "track", "album", "playlist"].includes(kind) || !id)
      return null;
    return {
      source: "Spotify",
      kind,
      src: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`,
      height: kind === "track" ? 152 : 352,
    };
  }

  // YouTube : vidéo uniquement (watch?v=, youtu.be/, shorts/, embed/)
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be"
  ) {
    let id = null;
    if (host === "youtu.be") id = parts[0];
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(parts[0])) id = parts[1];
    if (!id) return null;
    return {
      source: "YouTube",
      kind: "video",
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      height: null,
    };
  }

  // Deezer : deezer.com/(fr/)track|album|artist|playlist/ID
  if (host === "deezer.com") {
    const p = /^[a-z]{2}$/.test(parts[0]) ? parts.slice(1) : parts;
    const [kind, id] = p;
    if (!["track", "album", "artist", "playlist"].includes(kind) || !id)
      return null;
    const suffix = kind === "artist" ? "/top_tracks" : "";
    return {
      source: "Deezer",
      kind,
      src: `https://widget.deezer.com/widget/dark/${kind}/${id}${suffix}`,
      height: kind === "track" ? 150 : 352,
    };
  }

  // SoundCloud : n'importe quel lien de son, de playlist ou de profil
  if (host === "soundcloud.com" || host === "m.soundcloud.com") {
    if (!parts.length) return null;
    const kind = parts.length === 1 ? "artist" : "track";
    const params = new URLSearchParams({
      url,
      color: "#ffc23d",
      visual: kind === "track" ? "true" : "false",
      show_comments: "false",
    });
    return {
      source: "SoundCloud",
      kind,
      src: `https://w.soundcloud.com/player/?${params}`,
      height: kind === "track" ? 300 : 400,
    };
  }

  return null;
}

// Choisit le meilleur lecteur pour un artiste :
// 1. le « titrePhare » s'il est renseigné (le son le plus connu, choisi à la main)
// 2. sinon le profil Spotify → Spotify affiche tout seul ses titres les plus populaires
// 3. sinon Deezer (top titres), puis SoundCloud, puis une vidéo YouTube
export function bestPlayer(artiste) {
  const phare = artiste.titrePhare;
  if (phare?.lien) {
    const e = embedFor(phare.lien);
    if (e) return { ...e, titre: phare.titre, auto: false };
  }
  const liens = artiste.liens ?? {};
  for (const key of ["spotify", "deezer", "soundcloud", "youtube"]) {
    const e = embedFor(liens[key]);
    if (e) return { ...e, titre: null, auto: e.kind === "artist" };
  }
  return null;
}
