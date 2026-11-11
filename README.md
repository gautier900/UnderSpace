# 🪐 UnderSpace

**La galaxie du rap underground français.** Chaque rappeur est une planète : on voyage entre elles à la souris, on cherche un artiste, on découvre sa page, sa discographie et ses sons les plus écoutés.

👉 **Voir le site : https://gautier900.github.io/UnderSpace/**

---

## ✨ Fonctionnalités

### La galaxie
- **115 artistes** représentés par des planètes dessinées en temps réel, en style cartoon (shaders WebGL) : planètes à cratères, géantes gazeuses, lave, glace, étoiles, toxiques, astéroïdes, continents…
- **Deux modes**, en cliquant sur le logo UnderSpace :
  - **3D** : on tourne, on zoome, on vole jusqu'aux planètes ;
  - **2D** : une carte vue de face, plus lisible.
- Les planètes **tournent sur elles-mêmes et flottent** doucement autour de leur place.
- **Recherche** instantanée (touche `/`) : la caméra s'envole vers la planète choisie.
- **Filtres** par badge (❤️ Coup de cœur, ✨ Nouveau, 🔥 Nouvelle sortie, 💎 Pépite) et par style (`# trap`, `# drill`, `# rap suisse`…).

### Les pages artistes
- Résumé, ville, collectif et styles.
- **Lecteur intégré** : les titres les plus écoutés de l'artiste, mis à jour automatiquement par Spotify.
- **Projets** (avec pochettes) et **singles** ; les featurings avec d'autres artistes d'UnderSpace sont cliquables.
- La planète de l'artiste en 3D, qu'on peut faire tourner.

### Ma galaxie (Deezer)
- On relie son **profil Deezer public** en collant son lien (aucun mot de passe : tout reste dans le navigateur).
- Une vue **« Ma galaxie »** en plein écran : ton étoile au centre, tes 10 artistes les plus écoutés en orbite (plus ils sont proches, plus tu les écoutes) et les **artistes recommandés** sur une orbite extérieure.
- **Recommandations** calculées à partir des « artistes proches » (Deezer), des featurings, des collectifs et des styles en commun, toujours avec leur raison (« proche de La Fève · en featuring avec Jolagreen23 »).
- Badges **🧭 Recommandé pour toi** et **✅ Déjà écouté** sur la carte, et bouton **« Je connais déjà »** sur chaque page artiste.

### Menu administrateur (en local)
- Ajouter, modifier ou supprimer un artiste.
- Personnaliser sa planète avec un **aperçu 3D en direct** : type, couleurs, anneaux, taille, relief, vitesse de rotation, rayon de déplacement.
- Gérer les badges (Coup de cœur, Pépite, Nouveau).

---

## 🚀 Lancer le projet sur son ordinateur

Il faut [Node.js](https://nodejs.org) (version 18 ou plus).

```bash
git clone https://github.com/gautier900/UnderSpace.git
cd UnderSpace
npm install
npm run dev
```

Puis ouvrir **http://localhost:5173**.

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le site en local (avec rechargement automatique et le menu admin) |
| `npm run build` | Génère la version publiable du site dans `dist/` |
| `npm run preview` | Affiche la version générée, pour la vérifier avant publication |

---

## 🛠️ Ajouter ou modifier des artistes

### Avec le menu admin (le plus simple)
1. `npm run dev`
2. Ouvrir **http://localhost:5173/admin.html**
3. Modifier, puis **Enregistrer** (ou `Ctrl + S`).

Le menu écrit directement dans `src/data/rappeurs.json` et garde une copie de l'ancienne version dans `src/data/.sauvegardes/`. Il ne fonctionne qu'en local : il n'est pas publié sur le site.

### À la main
Tous les artistes sont dans **`src/data/rappeurs.json`**. La description de chaque champ (planète, liens, projets, singles, badges…) est en haut de `src/data/rappeurs.js`, et un artiste d'exemple complet est dans `src/data/artiste-exemple.js`.

Après avoir ajouté des artistes, recalculer leurs « artistes proches » (utilisés pour les recommandations) :

```bash
python3 scripts/build-liens.py
```

---

## 🗂️ Organisation du code

```
index.html            la galaxie
artiste.html          la page d'un artiste (?id=...)
admin.html            le menu administrateur (local uniquement)
src/
  main.js             scène 3D, caméra, sélection, bascule 2D/3D
  map2d.js            le mode carte 2D
  planet.js           les planètes (shaders cartoon)
  space.js            étoiles, poussière, nébuleuse
  ui.js               recherche, filtres, fiche d'une planète
  artiste.js          page artiste
  player.js           lecteur intégré (Spotify, Deezer, YouTube, SoundCloud)
  deezer.js           lecture d'un profil Deezer public
  perso.js            déjà écoutés + calcul des recommandations
  moi-ui.js           connexion Deezer et « Ma galaxie »
  ma-galaxie-3d.js    le système solaire personnel
  admin.js            le menu administrateur
  data/
    rappeurs.json     les artistes
    liens.js          artistes proches (généré par scripts/build-liens.py)
    badges.js         la liste des badges
scripts/
  build-liens.py      calcule les artistes proches via l'API Deezer
  admin-plugin.js     enregistrement des modifications du menu admin
```

Technologies : [Vite](https://vitejs.dev), [Three.js](https://threejs.org), JavaScript sans framework.

---

## 🌍 Publication

Le site est publié automatiquement sur **GitHub Pages** à chaque `git push` sur la branche `main`, grâce à `.github/workflows/deploy.yml`.

---

## 📌 Limites connues

- **Deezer** n'accepte plus de nouvelles applications de connexion : on relie donc un **profil public** par son lien, et Deezer ne fournit pas le nombre d'écoutes (le classement se base sur les favoris).
- Le **menu admin** ne fonctionne qu'en local, car le site publié n'a pas de serveur.
- Les résumés des artistes sont rédigés à partir de sources publiques (presse, festivals, Spotify, Deezer). Une erreur ? Corrige-la dans l'admin ou ouvre une *issue*.

---

Les discographies, pochettes et lecteurs proviennent de Spotify et Deezer ; les droits des œuvres appartiennent à leurs auteurs.
