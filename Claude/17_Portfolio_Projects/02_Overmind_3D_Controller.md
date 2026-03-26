# Analyse — Overmind (3D Controller)

> Contrôleur de scène 3D temps réel — Œil robotique interactif
> Repo : https://github.com/intuition-box/Overmind
> Organisation : Intuition Box

---

## A. Vue d'ensemble

**Description :**
Contrôleur de scène 3D temps réel construit avec Three.js, React 19 et XState v5. Permet de visualiser, contrôler et animer un modèle 3D complexe — un "œil" robotique/cybernétique ("V3_Eye") — avec des effets post-processing avancés (bloom, PBR, HDR) et un système de révélation d'anneaux magiques.

**Problème résolu :**
Outil de visualisation 3D interactif pour un modèle Blender complexe, avec un panneau de contrôle à 8 onglets permettant de tweaker en temps réel le bloom, l'éclairage, les matériaux PBR, la révélation d'objets, et les animations procédurales.

**Contexte :**
- Créé le 19 août 2025
- Dernière activité : 9 octobre 2025
- 40 commits, 8 Pull Requests
- Contributeur unique : Dev-Moulin (Paul)
- Organisation Intuition Box (98 repos, écosystème Web3)
- Composant "vitrine 3D" de l'écosystème Intuition

---

## B. Stack Technique Complète

### Frontend & State Management
| Technologie | Version | Rôle |
|---|---|---|
| React | 19.1.0 | Framework UI |
| TypeScript | 5.8.3 | Typage (migration progressive depuis JS) |
| XState | v5.22.0 | State management principal (Actor Model) |
| @xstate/react | 4.1.3 | Bindings React |
| Zustand | 5.0.8 | Legacy, en cours de suppression |
| Vite | 6.3.5 | Bundler + dev server |

### 3D / Visualisation
| Technologie | Version | Rôle |
|---|---|---|
| Three.js | 0.178 | Moteur WebGL |
| GLTFLoader + DRACOLoader | — | Chargement modèles compressés |
| UnrealBloomPass | — | Post-processing bloom |
| EffectComposer + RenderPass | — | Pipeline post-processing |
| OrbitControls | — | Navigation caméra |
| @gltf-transform | 4.2.1 | Manipulation GLTF |

### Outils & CI/CD
| Outil | Rôle |
|---|---|
| ESLint 9.25 | Linting |
| Jest 30.1.3 + ts-jest | Tests unitaires |
| GitHub Actions | Deploy GitHub Pages via pnpm |

**Note :** Pas de backend dans ce repo. Le workflow CI/CD révèle des variables d'env pour Privy (auth Web3), Stripe (paiements), Umami (analytics) — indiquant un écosystème produit plus large.

---

## C. Architecture du Code

### Structure
```
src/
  main.jsx                              # Point d'entrée
  AppXState.tsx                          # OvermindProvider > App
  components/V20.001_xstate/
    xstate-v5/
      actors/                            # 9 machines actives
        applicationMachine.ts            # Orchestrateur central, spawn enfants
        bloom/bloomMachine.ts            # Contrôle bloom
        lighting/lightingMachine.ts      # Éclairage (ambient, directional, point)
        pbr/pbrMachine.ts               # Tone mapping, exposure, matériaux
        material/materialMachine.ts      # Matériaux PBR par groupe
        effects/effectsMachine.ts        # Effets post-processing
        scene/sceneMachine.ts            # Scène Three.js
        performance/performanceMonitor.ts # Stats FPS/mémoire
        revelation/revelationMachine.ts  # Zones trigger 3D
        pop/popMachine.ts               # Clignement paupières procédural
      components/
        App.tsx
        SceneCanvasWithControls.tsx      # Composant principal (~800 lignes)
        ControlPanel/                    # 8 onglets UI
      context/                           # OvermindProvider + Context
      hooks/                             # useApplication, useBloom, useLighting...
      services/                          # animation/, camera/, effects/, materials/
      utils/                             # presets, tone mapping, colors, easing
    components/                          # Legacy JSX
    stores/                              # Zustand slices (legacy)
    systems/                             # Legacy Three.js classes
      bloomEffects/                      # BloomControlCenter
      eyeSystems/                        # SecurityIRISManager, EyeRingRotation
      revelationSystems/                 # RevealationSystem, ZoneController
      animationSystemes/                 # AnimationController, TransitionManager
      particleSystems/                   # ParticleSystemV2
    Claude_guide/                        # ~80 fichiers documentation technique
```

### Pattern Architectural : Actor Model (XState v5)

```
applicationMachine (orchestrateur)
  ├── spawn(bloomMachine)
  ├── spawn(lightingMachine)
  ├── spawn(pbrMachine)
  ├── spawn(materialMachine)
  ├── spawn(effectsMachine)
  ├── spawn(sceneMachine)
  ├── spawn(performanceMonitor)
  ├── spawn(revelationMachine)
  └── spawn(popMachine)
```

**Communication :** Via `sendTo()` — ex: bloomMachine notifie materialMachine quand la couleur change.

**Pattern machine → hook → component :**
1. Chaque **machine** encapsule sa logique métier
2. Chaque **hook** (`useBloom`, `useLighting`...) expose sélecteurs + actions typées via `useSelector`
3. Chaque **composant** UI est un consommateur passif

**Context Three.js :** Les objets Three.js (Scene, Renderer, Lights, Materials) sont stockés comme refs dans le context XState et manipulés directement (mutation car non-sérialisables).

---

## D. Fonctionnalités Clés

### Features 3D
- Chargement modèle GLB/GLTF avec compression DRACO
- **Bloom post-processing** (UnrealBloomPass) — contrôles temps réel : threshold, strength, radius, couleur
- **Éclairage avancé** : ambient + directional + point lights, 6 presets de position, HDR boost avec multiplicateur
- **PBR complet** : tone mapping (ACES Filmic, Reinhard, Cineon...), metalness/roughness par groupe d'objets, presets matériaux
- **Système de révélation** : zone trigger 3D cylindrique, anneaux magiques visibles/invisibles selon position, logique inversée, contrôle clavier AZERTY
- **Animations permanentes** : rotation anneaux oculaires, mouvements bras mécaniques (13 petits + 4 grands)
- **Animations de transition** : crossfade entre poses et boucles permanentes (R1R2_Pose, R2R1_Pose)
- **Clignement de paupières procédural** (popMachine) : alternance Action/Suspicion, timing aléatoire (2-7s), interpolation smooth avec easing, 6 animations NLA Blender
- **SecurityIRIS** : système de couleurs d'alerte (SAFE/DANGER/WARNING/NORMAL/SCANNING) pour l'œil central

### Features UI — Panneau de Contrôle 8 Onglets
| Onglet | Contrôles |
|---|---|
| Bloom | Threshold, strength, radius, couleur |
| Lighting | Ambient, directional, point lights, presets position, HDR |
| PBR | Tone mapping, exposure, metalness, roughness |
| Materials | Matériaux par groupe d'objets, presets |
| Effects | Pipeline post-processing |
| Scene | Grille, axes, helpers |
| Performance | Stats FPS, mémoire, triangles, géométries, textures |
| Revelation | Zone trigger, anneaux, distances |

### Features Techniques
- Communication inter-machines XState (bloom → material via `sendTo`)
- Presets systèmes (light, PBR, effects)
- Monitoring performance temps réel
- Bloom adaptatif selon pixel ratio
- Détection GPU haute performance

---

## E. Points Forts Techniques

### 1. Architecture XState v5 Exemplaire
L'utilisation du modèle acteur avec 9 machines indépendantes, communication via events, et spawning depuis un orchestrateur est un cas d'usage **avancé et rare** de XState v5. Le typage TypeScript est complet sur les contexts et events.

### 2. PopMachine — Animation Procédurale par Machine à États
Machine hiérarchique avec 3 sous-états (`waiting`, `closing`, `opening`), alternance automatique entre types d'animation, timing aléatoire, interpolation avec easing. Un excellent showcase de XState pour des animations procédurales.

### 3. Système de Révélation par Zone Trigger 3D
Logique de révélation par zone cylindrique transformable avec logique inversée et prise en compte de la matrice monde du modèle parent. Original et bien implémenté.

### 4. Communication Inter-Machines Native
Changer la couleur bloom notifie automatiquement la machine materials via `sendTo()`. Démontre la maîtrise du modèle acteur.

### 5. Pipeline de Rendu Professionnel
EffectComposer + UnrealBloomPass + ACES Filmic tone mapping + HDR boost + matériaux PBR avec presets — pipeline de qualité studio, pas un "hello world Three.js".

### 6. Intégration Blender ↔ Code Complète
Animations NLA Blender directement consommées (6 animations paupières, 8 animations rings, poses de transition). Workflow Blender → GLTF → Three.js → XState complet.

### 7. Documentation Technique Massive
Plus de 80 fichiers Markdown de documentation technique (plans, audits, analyses, guides de refactoring). Approche méthodique et réflective du développement.

---

## F. Points d'Amélioration Potentiels

| Sujet | Détail |
|---|---|
| **Composant monolithique** | `SceneCanvasWithControls.tsx` (~800 lignes) gère setup Three.js, chargement GLB, création lumière, animations, post-processing et boucle de rendu dans un seul `useEffect` |
| **Tests** | Quelques tests unitaires (`applicationMachine.test.ts` avec 5 tests basiques), en décalage avec le code actuel. Aucun test de composant, aucun test E2E |
| **Mutations directes context** | Plusieurs machines mutent directement `context` au lieu d'utiliser `assign()` — anti-pattern XState qui casse l'immutabilité |
| **Code legacy** | Zustand (8 slices, 6 hooks) et systèmes legacy coexistent encore. Machines "en développement" = code mort |
| **Console.log** | Quasi chaque action de chaque machine a un `console.log` avec émojis — bruit en production |
| **Modèle 3D absent** | Le `.glb` est requis mais absent du repo, pas de documentation pour l'obtenir → projet non-reproductible |
| **Pas d'error handling** | Aucun try/catch au chargement modèle, pas de fallback UI, pas d'error boundaries |
| **CSS minimal** | Un seul fichier `ControlPanel.css` + styles inline, pas de design system |
| **Dépendances inutilisées** | `@react-three/drei` et `@react-three/postprocessing` dans les deps mais code en Three.js impératif |

---

## G. "Wow Factors"

### 1. L'Œil Robotique Interactif
Le concept visuel est frappant — un œil mécanique avec anneaux de révélation, bras articulés, iris central avec système de sécurité par couleur. **Visuellement spectaculaire** pour un portfolio.

### 2. XState comme Moteur d'Animation 3D
L'utilisation de machines à états pour orchestrer des animations Three.js (clignement, révélations, transitions) est **rare et originale**. La popMachine avec alternance Action/Suspicion est un excellent showcase.

### 3. Modèle Acteur pour Scène 3D
9 machines indépendantes qui communiquent par events pour contrôler une scène 3D en temps réel. Architecture élégante que peu de développeurs maîtrisent.

### 4. Pipeline Rendu Studio-Grade
Bloom + PBR + HDR + tone mapping + 8 onglets de contrôle temps réel. Ce n'est pas un projet Three.js basique — c'est un outil de rendu professionnel.

### 5. Workflow Blender → Code Complet
De la modélisation 3D aux animations procédurales dans le navigateur. Montre des compétences cross-disciplinaires rares (3D artist + developer).

---

## H. Résumé pour le Portfolio

### Tagline suggérée
> "Overmind — Contrôleur de scène 3D temps réel pilotant un œil robotique cybernétique via 9 machines à états concurrentes"

### Pitch en 3 phrases
J'ai conçu et développé un visualisateur 3D interactif pour un modèle Blender complexe d'œil robotique, avec un pipeline de rendu professionnel (bloom, PBR, HDR, tone mapping). L'architecture repose sur 9 machines XState v5 indépendantes communiquant par events (modèle acteur), orchestrant le bloom, l'éclairage, les matériaux, les animations procédurales et un système de révélation par zones trigger 3D. Le panneau de contrôle à 8 onglets permet de tweaker chaque aspect en temps réel.

### Métriques à mettre en avant
- 9 machines XState v5 concurrentes (modèle acteur)
- 8 onglets de contrôle temps réel
- 6 animations NLA Blender consommées dynamiquement
- Pipeline : UnrealBloomPass + ACES Filmic + PBR complet
- ~80 fichiers de documentation technique
- Workflow Blender → GLTF → Three.js → XState complet

### Stack badges
`React 19` `TypeScript` `Three.js 0.178` `XState v5` `Vite` `Blender` `GLTF/DRACO` `UnrealBloomPass` `PBR` `Jest` `GitHub Actions`

---

## I. Lien avec le Portfolio Actuel

> **Note importante :** Ce projet Overmind est l'ancêtre direct du package `overmind-3d` dans le portfolio actuel (`my-portfolio/packages/overmind-3d/`). Le portfolio a repris et considérablement étendu l'architecture XState + Three.js, en ajoutant la timeline unifiée, les visual keyframes, le système de sélection, le scroll navigation, et bien plus. C'est une belle démonstration d'évolution technique.
