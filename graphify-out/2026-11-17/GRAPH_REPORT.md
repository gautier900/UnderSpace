# Graph Report - UnderSpace  (2026-11-17)

## Corpus Check
- Corpus is ~30,882 words - fits in a single context window. You may not need a graph.

## Summary
- 409 nodes · 880 edges · 12 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.87)
- Token cost: 78,487 input · 0 output

## Community Hubs (Navigation)
- Blind test
- Galaxie 3D principale
- Docs, pages HTML et skills
- Scripts Python Deezer
- Déploiement GitHub Pages
- Ma galaxie et carte 2D
- Menu administrateur
- Config npm et Vite
- Sorties et shaders de bruit
- Page artiste
- Badges, filtres et interface
- Graphe des feats et Six degrés

## God Nodes (most connected - your core abstractions)
1. `icon()` - 22 edges
2. `createMap2D()` - 21 edges
3. `setupUI()` - 19 edges
4. `createPlanet()` - 17 edges
5. `renderEditor()` - 15 edges
6. `render()` - 14 edges
7. `setupMoi()` - 14 edges
8. `setupSixDegres()` - 14 edges
9. `badgesOf()` - 12 edges
10. `createMaGalaxie()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Skill python-error-handling` --conceptually_related_to--> `Mise à jour des sorties (update-sorties.py, npm run maj)`  [INFERRED]
  CLAUDE.md → README.md
- `Panneau Six degrés (#six)` --implements--> `Six degrés (plus courte chaîne de featurings)`  [INFERRED]
  index.html → README.md
- `renderEditor()` --calls--> `icon()`  [EXTRACTED]
  src/admin.js → src/icons.js
- `createPreview()` --calls--> `createPlanet()`  [EXTRACTED]
  src/admin.js → src/planet.js
- `render()` --calls--> `badgesOf()`  [EXTRACTED]
  src/artiste.js → src/data/badges.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pipeline de données Deezer (scripts Python)** — readme_maj_sorties, readme_feats_pipeline, readme_artistes_proches, readme_deezer_api, readme_rappeurs_json [EXTRACTED 1.00]
- **Fonctionnalités Explorer du HUD (Sorties, Six degrés, Blind test, Deezer)** — index_sorties_view, index_six_panel, index_bt_dialog, index_ma_galaxie_view, index_hud [EXTRACTED 1.00]

## Communities (12 total, 0 thin omitted)

### Community 0 - "Blind test"
Cohesion: 0.10
Nodes (44): byId, cacheTop, h(), idByDeezer, jouables, leurres(), melange(), record() (+36 more)

### Community 1 - "Galaxie 3D principale"
Cohesion: 0.06
Nodes (40): applyFilter(), badge, bloom, byId, camera, clearConstellation(), clock, composer (+32 more)

### Community 2 - "Docs, pages HTML et skills"
Cohesion: 0.08
Nodes (40): Liste et éditeur d'artistes (#ad-list, #ad-editor), admin.html (menu administrateur), artiste.html (page artiste), Skills du projet (CLAUDE.md), Skill python-error-handling, Skills de tests (vitest, playwright, pytest), Skill threejs-interaction, Skill threejs-performance (+32 more)

### Community 3 - "Scripts Python Deezer"
Cohesion: 0.13
Nodes (18): all_albums(), compacter(), get(), lire_album(), lire_sortie(), main(), run(), norm() (+10 more)

### Community 4 - "Déploiement GitHub Pages"
Cohesion: 0.06
Nodes (34): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+26 more)

### Community 5 - "Ma galaxie et carte 2D"
Cohesion: 0.11
Nodes (26): hasFeat(), createMaGalaxie(), planetFor(), clamp(), createMap2D(), draw(), drawBackground(), drawLabel() (+18 more)

### Community 6 - "Menu administrateur"
Cohesion: 0.17
Nodes (28): change(), clone(), color(), createPreview(), current(), data, dirty(), field() (+20 more)

### Community 7 - "Config npm et Vite"
Cohesion: 0.08
Nodes (19): dependencies, three@0.170.0, devDependencies, vite@5.4.11, name, private, scripts, build (+11 more)

### Community 8 - "Sorties et shaders de bruit"
Cohesion: 0.16
Nodes (23): noiseGLSL, auj(), byId, coverEl(), createScene(), fmtJour(), h(), jour() (+15 more)

### Community 9 - "Page artiste"
Cohesion: 0.15
Nodes (24): all, artiste, byDateDesc(), byName, empty(), h(), heroPlanet(), id (+16 more)

### Community 10 - "Badges, filtres et interface"
Cohesion: 0.15
Nodes (21): BADGES, badgesOf(), DUREE_NOUVEAU_JOURS, DUREE_SORTIE_JOURS, joursDepuis(), ORDER, collaborations(), perso (+13 more)

### Community 11 - "Graphe des feats et Six degrés"
Cohesion: 0.18
Nodes (23): addEdge(), adj, byId, chemin(), defiAleatoire(), idByDeezer, idByName, lienEntre() (+15 more)

## Knowledge Gaps
- **5 isolated node(s):** `Skill threejs-performance`, `Skills interface et design (emil-design-eng, ui-ux-pro-max, web-design-guidelines, fixing-motion-performance)`, `Lecteur intégré (Spotify, Deezer, YouTube, SoundCloud)`, `Vite + Three.js, JavaScript sans framework`, `Liste et éditeur d'artistes (#ad-list, #ad-editor)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Config npm et Vite` to `Blind test`, `Galaxie 3D principale`, `Ma galaxie et carte 2D`, `Menu administrateur`, `Sorties et shaders de bruit`, `Page artiste`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `setupUI()` (e.g. with `renderResults()` and `renderStyles()`) actually correct?**
  _`setupUI()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Skill threejs-performance`, `Skills interface et design (emil-design-eng, ui-ux-pro-max, web-design-guidelines, fixing-motion-performance)`, `Lecteur intégré (Spotify, Deezer, YouTube, SoundCloud)` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Blind test` be split into smaller, more focused modules?**
  _Cohesion score 0.09579100145137881 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `Blind test` to `Ma galaxie et carte 2D`, `Menu administrateur`, `Sorties et shaders de bruit`, `Page artiste`, `Graphe des feats et Six degrés`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Galaxie 3D principale` be split into smaller, more focused modules?**
  _Cohesion score 0.06090808416389812 - nodes in this community are weakly interconnected._
- **Why does `setupUI()` connect `Badges, filtres et interface` to `Galaxie 3D principale`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._