// Liste des rappeurs affichés dans UnderSpace.
// Les données sont dans src/data/rappeurs.json : modifie-les avec le menu admin
// (npm run dev puis http://localhost:5173/admin.html) ou directement dans ce fichier JSON.
// Ci-dessous, la description de tous les champs possibles.
//
// planete.type : 'rocheuse' | 'gazeuse' | 'lave' | 'glace' | 'etoile' | 'toxique' | 'asteroide' | 'continents'
// planete.couleurs : 3 couleurs [base, secondaire, accent]
// planete.taille : rayon (≈ 2 à 6)
// planete.relief : échelle du bruit (petit = grandes formes, grand = détails fins)
// planete.anneaux : couleur des anneaux (ou absent)
// planete.atmosphere : couleur du liseré lumineux sur le bord (optionnel)
// planete.vitesse : vitesse de rotation sur elle-même (1 = normale, 0 = immobile, 3 = très rapide)
// planete.deplacement : rayon dans lequel la planète flotte autour de sa place (1 = normal, 0 = fixe)
// position : [x, y, z] (optionnel, sinon placé automatiquement en spirale)
//
// --- Page artiste (tout est optionnel, la page s'adapte à ce qui est rempli) ---
// description : résumé / bio de l'artiste
// tags        : ['cloud', 'drill', ...]
// ville       : 'Paris'
// collectif   : 'Nom du collectif / label'
// debut       : 2019 (année des débuts)
// liens       : { spotify, appleMusic, deezer, youtube, soundcloud, instagram, tiktok, x }  (URLs)
//   → lecteur intégré : avec juste le lien du PROFIL Spotify (open.spotify.com/artist/...),
//     la page affiche automatiquement ses titres les plus populaires.
// titrePhare  : { titre: 'Nom du son', lien: 'https://open.spotify.com/track/...' }
//   → (optionnel) force un son précis dans le lecteur. Marche avec Spotify, YouTube, Deezer, SoundCloud.
// projets     : [{ titre, type: 'Album' | 'Mixtape' | 'EP', annee, date: 'AAAA-MM-JJ', titres: 12,
//                  cover: '/covers/xxx.jpg', lien: 'https://...' }]
// singles     : [{ titre, annee, date, featurings: ['Nom'], lien: 'https://...' }]
//   → un featuring dont le nom correspond à un artiste de cette liste devient un lien vers sa page.
// badges      : ['coup-de-coeur', 'pepite']  → badges choisis à la main (liste et noms dans src/data/badges.js)
// ajouteLe    : 'AAAA-MM-JJ'  → date d'ajout ; affiche le badge « Nouveau » pendant 30 jours
//   (le badge « Nouvelle sortie » s'affiche tout seul si un projet/single a une « date » de moins de 30 jours)
// Exemple complet : src/data/artiste-exemple.js (visible sur /artiste.html?id=exemple)

import data from './rappeurs.json';

export const rappeurs = data;
