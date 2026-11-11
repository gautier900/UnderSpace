// Artiste FICTIF qui sert de modèle : il montre une page artiste entièrement remplie.
// Il n'apparaît pas dans la galaxie. Page : /artiste.html?id=exemple
// Copie la structure dans src/data/rappeurs.json pour remplir les vrais artistes.

export const exemple = {
  id: 'exemple',
  nom: 'Artiste Exemple',
  description:
    "Ceci est un artiste fictif qui sert de modèle. Écris ici un court résumé : d'où vient l'artiste, son univers, ce qui le rend unique, et les projets qui l'ont fait connaître.",
  tags: ['cloud', 'mélodique', 'nocturne'],
  badges: ['coup-de-coeur', 'pepite'],
  ajouteLe: '2026-11-10',
  ville: 'Ville imaginaire',
  collectif: 'Collectif Exemple',
  debut: 2019,
  liens: {
    spotify: 'https://open.spotify.com/',
    youtube: 'https://www.youtube.com/',
    instagram: 'https://www.instagram.com/',
    soundcloud: 'https://soundcloud.com/',
  },
  projets: [
    { titre: 'Premier Projet', type: 'Mixtape', annee: 2020, titres: 9, lien: 'https://open.spotify.com/' },
    { titre: 'Orbite Basse', type: 'EP', annee: 2022, titres: 6 },
    { titre: 'Grand Album', type: 'Album', annee: 2024, date: '2024-10-04', titres: 15, lien: 'https://open.spotify.com/' },
  ],
  singles: [
    { titre: 'Single n°1', annee: 2021, lien: 'https://open.spotify.com/' },
    { titre: 'Single n°2', annee: 2023, featurings: ['Invité Fictif'] },
    { titre: 'Single n°3', annee: 2025, date: '2025-03-14', lien: 'https://www.youtube.com/' },
    { titre: 'Single tout frais', annee: 2026, date: '2026-11-07' },
  ],
  planete: { type: 'gazeuse', couleurs: ['#4a3a8a', '#7a6ad6', '#d0c8ff'], taille: 4, relief: 1.4, anneaux: '#d0c8ff', atmosphere: '#ebe6ff' },
};
