# Graph Report - UnderSpace  (2026-11-17)

## Corpus Check
- 32 files · ~30,880 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .css 3, (none) 1)

## Summary
- 408 nodes · 881 edges · 13 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.87)
- Token cost: 78,487 input · 0 output

## Graph Freshness
- Built from commit: `4e56397e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- setupBlindTest

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
- `planetFor()` --calls--> `createPlanet()`  [EXTRACTED]
  src/ma-galaxie-3d.js → src/planet.js
- `Panneau Six degrés (#six)` --implements--> `Six degrés (plus courte chaîne de featurings)`  [INFERRED]
  index.html → README.md
- `Skill python-error-handling` --conceptually_related_to--> `Mise à jour des sorties (update-sorties.py, npm run maj)`  [INFERRED]
  CLAUDE.md → README.md
- `renderEditor()` --calls--> `icon()`  [EXTRACTED]
  src/admin.js → src/icons.js
- `createPreview()` --calls--> `createPlanet()`  [EXTRACTED]
  src/admin.js → src/planet.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pipeline de données Deezer (scripts Python)** — readme_maj_sorties, readme_feats_pipeline, readme_artistes_proches, readme_deezer_api, readme_rappeurs_json [EXTRACTED 1.00]
- **Fonctionnalités Explorer du HUD (Sorties, Six degrés, Blind test, Deezer)** — index_sorties_view, index_six_panel, index_bt_dialog, index_ma_galaxie_view, index_hud [EXTRACTED 1.00]

## Communities (13 total, 0 thin omitted)

### Community 0 - "Blind test"
Cohesion: 0.11
Nodes (32): byId, cacheTop, jouables, titreAuHasard(), liens, rappeurs, all(), clearProfile() (+24 more)

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
Cohesion: 0.12
Nodes (25): hasFeat(), clamp(), createMap2D(), draw(), drawBackground(), drawLabel(), flyToView(), frame() (+17 more)

### Community 6 - "Menu administrateur"
Cohesion: 0.17
Nodes (28): change(), clone(), color(), createPreview(), current(), data, dirty(), field() (+20 more)

### Community 7 - "Config npm et Vite"
Cohesion: 0.08
Nodes (19): dependencies, three@0.170.0, devDependencies, vite@5.4.11, name, private, scripts, build (+11 more)

### Community 8 - "Sorties et shaders de bruit"
Cohesion: 0.17
Nodes (22): auj(), byId, coverEl(), createScene(), fmtJour(), h(), jour(), PERIODES (+14 more)

### Community 9 - "Page artiste"
Cohesion: 0.15
Nodes (25): all, artiste, byDateDesc(), byName, empty(), h(), heroPlanet(), id (+17 more)

### Community 10 - "Badges, filtres et interface"
Cohesion: 0.16
Nodes (20): BADGES, badgesOf(), DUREE_NOUVEAU_JOURS, DUREE_SORTIE_JOURS, joursDepuis(), ORDER, collaborations(), norm() (+12 more)

### Community 11 - "Graphe des feats et Six degrés"
Cohesion: 0.19
Nodes (24): addEdge(), adj, byId, chemin(), defiAleatoire(), idByDeezer, idByName, lienEntre() (+16 more)

### Community 12 - "setupBlindTest"
Cohesion: 0.38
Nodes (12): h(), leurres(), melange(), record(), setupBlindTest(), accueil(), demarrer(), fin() (+4 more)

## Knowledge Gaps
- **5 isolated node(s):** `Liste et éditeur d'artistes (#ad-list, #ad-editor)`, `Skill threejs-performance`, `Skills interface et design (emil-design-eng, ui-ux-pro-max, web-design-guidelines, fixing-motion-performance)`, `Lecteur intégré (Spotify, Deezer, YouTube, SoundCloud)`, `Vite + Three.js, JavaScript sans framework`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 118 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Config npm et Vite` to `Blind test`, `Galaxie 3D principale`, `Ma galaxie et carte 2D`, `Menu administrateur`, `Sorties et shaders de bruit`, `Page artiste`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `setupUI()` (e.g. with `renderResults()` and `renderStyles()`) actually correct?**
  _`setupUI()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Liste et éditeur d'artistes (#ad-list, #ad-editor)`, `Skill threejs-performance`, `Skills interface et design (emil-design-eng, ui-ux-pro-max, web-design-guidelines, fixing-motion-performance)` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Blind test` be split into smaller, more focused modules?**
  _Cohesion score 0.10676532769556026 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `Graphe des feats et Six degrés` to `Blind test`, `Menu administrateur`, `Sorties et shaders de bruit`, `Page artiste`, `setupBlindTest`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Galaxie 3D principale` be split into smaller, more focused modules?**
  _Cohesion score 0.06090808416389812 - nodes in this community are weakly interconnected._
- **Why does `setupUI()` connect `Badges, filtres et interface` to `Galaxie 3D principale`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._