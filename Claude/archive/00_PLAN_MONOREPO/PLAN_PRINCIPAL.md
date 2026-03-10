# PLAN PRINCIPAL — Migration my-portfolio en Monorepo

> **Projet** : my-portfolio
> **Objectif** : Convertir le portfolio existant (CRA) en monorepo pnpm moderne, avec intégration d'un Overmind 3D allégé
> **Référence** : Structure identique à `Overmind_Founders_Collection` (OFC)
> **Date** : 2026-02-19
> **Statut** : 📝 PLANIFICATION

---

## 1. CONTEXTE

### 1.1 État actuel (AVANT)

| Aspect | Valeur |
|--------|--------|
| **Emplacement** | `/home/paul/THP_Linux/Dev_++/my-portfolio/` (déplacé depuis `API_Chrome_Extention/V2_plasmo/`) |
| **Build tool** | Create React App (react-scripts 5.0.1) |
| **React** | 18.3.1 |
| **TypeScript** | 4.9.5 |
| **Styling** | Tailwind CSS 3.4.17 + CSS custom properties + CSS modules par composant |
| **3D** | React Three Fiber (R3F) + @react-three/drei — modèle `Eye-1K.glb` |
| **i18n** | react-i18next (EN/FR) |
| **Animations** | Framer Motion 12.18.1 |
| **Déploiement** | GitHub Pages (gh-pages) |
| **Structure** | Flat — tout dans `src/` |

### 1.2 Cible (APRÈS)

| Aspect | Valeur |
|--------|--------|
| **Structure** | Monorepo pnpm workspace (`apps/` + `packages/`) |
| **Build tool** | Vite 7.x |
| **React** | 19.x |
| **TypeScript** | ~5.9.x |
| **Styling** | Tailwind CSS 3.x (inchangé) |
| **3D** | Three.js vanilla (pas R3F) + XState v5 + Yuka — modèle `V4.2_Overmind.glb` |
| **i18n** | react-i18next (EN/FR) — conservé |
| **Animations** | Framer Motion — conservé |
| **Déploiement** | GitHub Pages (vite + gh-pages) |

---

## 2. OBJECTIFS

### 2.1 Must-have (V1)

1. **Monorepo fonctionnel** avec `pnpm workspace`
2. **apps/web** — Portfolio migré de CRA vers Vite, React 19
3. **packages/overmind-3d** — Package interne `@portfolio/overmind-3d`
   - Overmind (l'oeil) se balade dans la page (Yuka WanderBehaviorXY)
   - L'oeil suit/regarde la souris (InputTracker + GazeSystem)
   - Champ de force : distance minimum variable de la souris (FleeBehavior custom)
   - Bloom post-processing pour le glow
   - Canvas fixed overlay (pointer-events: none)
4. **packages/shared** — Types et utilitaires partagés
5. **Toutes les features portfolio préservées** : i18n, theme, NavArc, projets, skills, contact
6. **Déploiement GitHub Pages** fonctionnel

### 2.2 Nice-to-have (V2+)

- GPU detection avec fallback (désactive le 3D sur GPU faible)
- Presets visuels (couleurs selon la section de la page)
- Animations de blink (Pop eyelids)
- Réaction au scroll (l'oeil suit le défilement)
- DevControlPanel pour ajuster les paramètres en dev

---

## 3. DÉCISIONS TECHNIQUES

### 3.1 Pourquoi Three.js vanilla et pas R3F ?

| Critère | R3F (actuel) | Three.js vanilla (cible) |
|---------|-------------|-------------------------|
| Cohérence avec OFC | ❌ | ✅ L'OFC utilise Three.js vanilla |
| Contrôle sur le render loop | Limité | Total |
| Intégration Yuka steering | Complexe via useFrame | Naturel dans animate() |
| XState orchestration | Indirect | Direct (subscribe aux actors) |
| Taille du bundle | +R3F +drei | Plus léger |
| Réutilisabilité du code | Spécifique R3F | Portable |

**Décision** : Three.js vanilla, comme le monorepo OFC.

### 3.2 Pourquoi garder Tailwind 3 ?

- Le portfolio utilise déjà Tailwind 3 avec une config stable
- La migration v3→v4 introduit des breaking changes (PostCSS plugin, syntaxe `@import "tailwindcss"`)
- Pas de bénéfice justifiant le risque pour un portfolio
- On pourra migrer plus tard si nécessaire

### 3.3 Naming des packages

| Package | Nom NPM | Rôle |
|---------|---------|------|
| `apps/web` | (pas publié) | Application portfolio |
| `packages/overmind-3d` | `@portfolio/overmind-3d` | Overlay 3D Overmind allégé |
| `packages/shared` | `@portfolio/shared` | Types et utils partagés |

### 3.4 Asset delivery

- Modèle GLB : `public/models/V4.2_Overmind.glb`
- DRACO decoder : `public/draco/` (3 fichiers)
- Résolu via `import.meta.env.BASE_URL` (Vite)

---

## 4. PHASES D'IMPLÉMENTATION

### Phase 0 — Préparation (cette session)
- [x] Déplacer my-portfolio vers `Dev_++/`
- [x] Documenter le plan (ce fichier + docs associées)
- [ ] Valider le plan avec l'utilisateur

### Phase 1 — Scaffold Monorepo
- [ ] Initialiser le monorepo pnpm (workspace yaml, root package.json)
- [ ] Créer `apps/web/` avec Vite + React 19 + TypeScript 5.9
- [ ] Créer `packages/overmind-3d/` (scaffold vide)
- [ ] Créer `packages/shared/` (scaffold vide)
- [ ] Configurer les tsconfig (root + packages)
- [ ] Vérifier : `pnpm install` + `pnpm --filter web dev` fonctionne

### Phase 2 — Migration du Portfolio (CRA → Vite)
- [ ] Migrer les composants existants vers `apps/web/src/`
- [ ] Adapter la config Tailwind 3 pour Vite
- [ ] Migrer le système i18n (react-i18next)
- [ ] Migrer le ThemeProvider (dark/light)
- [ ] Migrer les assets (SVG, images, favicon)
- [ ] Adapter les chemins d'assets (`PUBLIC_URL` → `import.meta.env.BASE_URL`)
- [ ] Supprimer les dépendances CRA (react-scripts)
- [ ] Vérifier : portfolio fonctionne identiquement sans le 3D

### Phase 3 — Package Overmind 3D Light
- [ ] Setup du package `@portfolio/overmind-3d`
- [ ] Extraire/adapter le SceneRenderer depuis le repo Overmind source
- [ ] Implémenter le chargement du modèle V4.2 (GLTFLoader + DRACO)
- [ ] Implémenter InputTracker (suivi souris)
- [ ] Implémenter GazeSystem (regard autonome + blend souris)
- [ ] Implémenter WanderBehaviorXY (déplacement Yuka)
- [ ] Implémenter SoftBoundaryBehavior (limites de la page)
- [ ] **Implémenter MouseRepulsionBehavior** (champ de force — NOUVEAU)
- [ ] Setup bloom post-processing (UnrealBloomPass)
- [ ] Machines XState minimales (bloom, lighting, material, model, pbr)
- [ ] Exports : `<OvermindOverlay />`, `OvermindProvider`, `useOvermind()`
- [ ] Vérifier : l'oeil apparaît, se balade, suit la souris, fuit la souris

### Phase 4 — Intégration & Polish
- [ ] Intégrer `<OvermindOverlay />` dans `apps/web`
- [ ] Ajuster les z-index (canvas derrière le contenu)
- [ ] Tester la cohabitation 3D + scroll + navigation
- [ ] Tester responsive (mobile : désactiver ou adapter le 3D)
- [ ] Vérifier le déploiement GitHub Pages
- [ ] Nettoyage : supprimer l'ancien EyeFollower + Eye-1K.glb + dépendances R3F

### Phase 5 — Finalisation
- [ ] Tests manuels complets (navigation, theme, i18n, 3D)
- [ ] Optimisation du bundle (lazy loading du 3D)
- [ ] README.md à jour
- [ ] Commit propre + push

---

## 5. RISQUES & MITIGATIONS

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Migration CRA→Vite casse des imports | Moyen | Voir guide `MIGRATION_CRA_TO_VITE.md` |
| Modèle GLB trop lourd (11MB) | Moyen | Lazy loading + suspense, DRACO déjà compressé |
| Tailwind 3 incompatible avec Vite config | Faible | Config bien documentée, PostCSS standard |
| Performance 3D sur mobile | Moyen | Désactiver sur mobile ou réduire la qualité |
| Framer Motion + Three.js conflits | Faible | Canvas séparé en fixed overlay, pas d'interaction |

---

## 6. ARBORESCENCE CIBLE

```
my-portfolio/
├── pnpm-workspace.yaml
├── package.json                    # Root monorepo (private, scripts workspace)
├── tsconfig.base.json              # Config TS partagée
├── .gitignore
├── Claude/                         # Documentation projet
│   └── 00_PLAN_MONOREPO/
│       ├── PLAN_PRINCIPAL.md       # Ce fichier
│       ├── ARCHITECTURE.md         # Détail structure technique
│       ├── MIGRATION_CRA_TO_VITE.md
│       ├── OVERMIND_3D_LIGHT.md    # Spec du package 3D
│       └── PROMPT_IMPLEMENTATION.md # Prompt complet pour implémentation
├── apps/
│   └── web/                        # Application portfolio
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── public/
│       │   ├── models/V4.2_Overmind.glb
│       │   ├── draco/
│       │   ├── svg/
│       │   └── projects/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles/
│           ├── components/
│           ├── i18n/
│           └── utils/
├── packages/
│   ├── overmind-3d/                # @portfolio/overmind-3d
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── components/
│   │       ├── scene/
│   │       ├── systems/
│   │       ├── machines/
│   │       ├── hooks/
│   │       ├── context/
│   │       ├── utils/
│   │       └── data/
│   └── shared/                     # @portfolio/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── types/
```

---

## 7. FICHIERS DE DOCUMENTATION

| Document | Contenu |
|----------|---------|
| `PLAN_PRINCIPAL.md` | Ce fichier — vue d'ensemble, phases, décisions |
| `ARCHITECTURE.md` | Structure détaillée du monorepo, configs, dépendances |
| `MIGRATION_CRA_TO_VITE.md` | Guide pas-à-pas pour migrer CRA → Vite |
| `OVERMIND_3D_LIGHT.md` | Spécification complète du package Overmind allégé |
| `PROMPT_IMPLEMENTATION.md` | Prompt complet à donner à Claude pour l'implémentation |

---

## 8. SOURCES & RÉFÉRENCES

| Ressource | Chemin / URL |
|-----------|-------------|
| Monorepo OFC (référence) | `/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind_Founders_Collection/` |
| Doc OFC Overmind 3D | `.../Claude/00_GESTION_PROJET/Projet_F4_Overmind3D/` |
| Repo Overmind source | `https://github.com/intuition-box/Overmind.git` / `/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind/` |
| Package @ofc/overmind-3d | `.../Overmind_Founders_Collection/packages/overmind-3d/` |
| Portfolio actuel | `/home/paul/THP_Linux/Dev_++/my-portfolio/` |
