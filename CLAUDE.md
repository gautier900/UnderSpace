## Skills du projet
Installés dans `.claude/skills/` (sources dans `skills-lock.json`, mise à jour : `npx skills update -p`).

**Galaxie 3D** (⚠ ces skills visent three r186, le projet est en 0.170 : vérifier l'API avant d'appliquer un exemple)
- **threejs-shaders** : avant de créer ou modifier un shader GLSL des planètes (`src/planet.js`, `src/noise.js`).
- **threejs-performance** : quand la galaxie rame, ou avant d'ajouter des objets animés en nombre.
- **threejs-interaction** : clics et survol des planètes, contrôles et vols de caméra, recherche qui fait voler vers une planète.

**Interface et design**
- **emil-design-eng** : finitions des interactions (survol, transitions, fiches, menus, blind test).
- **ui-ux-pro-max** : choix de palettes, typographie et règles d'accessibilité (lance un script Python local, sans réseau).
- **web-design-guidelines** : audit de l'interface quand on demande une revue UI ou accessibilité (télécharge ses règles depuis GitHub à chaque usage).
- **fixing-motion-performance** : animations CSS/JS qui saccadent.

**Scripts Python** (`scripts/*.py`, lancés par `npm run maj`, `feats`, `liens`)
- **python-error-handling** : traitement des artistes par lots, un échec d'API Deezer ne doit pas bloquer les autres.

**Tests** (le projet n'en a pas encore)
- **vitest** : tests unitaires de la logique pure (plus court chemin de Six degrés, recommandations, score du blind test). Partage la config Vite.
- **playwright-best-practices** : tests de bout en bout dans le navigateur (recherche, page artiste, blind test). Le canvas WebGL se teste mal en e2e : tester plutôt le DOM et l'état exposé.
- **python-testing-patterns** : tests pytest des scripts, avec les appels Deezer/Spotify simulés.
