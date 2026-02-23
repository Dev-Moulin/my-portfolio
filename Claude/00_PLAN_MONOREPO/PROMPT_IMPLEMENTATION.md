# PROMPT D'IMPLÉMENTATION — Monorepo my-portfolio

> Ce fichier est un prompt complet à donner à Claude pour implémenter la migration du portfolio en monorepo.
> Il peut être utilisé tel quel ou découpé en phases.

---

## PROMPT COMPLET

```
Tu vas m'aider à convertir mon portfolio React en monorepo pnpm.

## Contexte

Mon portfolio est actuellement à `/home/paul/THP_Linux/Dev_++/my-portfolio/`.
C'est une app Create React App (React 18, TypeScript 4.9, Tailwind 3) avec un oeil 3D (EyeFollower) qui utilise React Three Fiber.

Je veux le restructurer en monorepo exactement comme le projet OFC à :
`/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind_Founders_Collection/`

## Documentation de référence

Lis attentivement toute la documentation dans :
`/home/paul/THP_Linux/Dev_++/my-portfolio/Claude/00_PLAN_MONOREPO/`

Fichiers à lire dans l'ordre :
1. `PLAN_PRINCIPAL.md` — Vue d'ensemble, phases, décisions
2. `ARCHITECTURE.md` — Structure monorepo détaillée, configs, dépendances
3. `MIGRATION_CRA_TO_VITE.md` — Guide migration CRA → Vite
4. `OVERMIND_3D_LIGHT.md` — Spécification du package Overmind 3D allégé

## Code source de référence

Pour le package Overmind 3D, inspire-toi de l'implémentation existante :
- Package OFC : `/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind_Founders_Collection/packages/overmind-3d/`
- Repo Overmind source : `/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind/`
- Doc technique OFC : `/home/paul/THP_Linux/Dev_++/OFC_Project/Overmind_Founders_Collection/Claude/00_GESTION_PROJET/Projet_F4_Overmind3D/`

## Portfolio existant à migrer

Le code source du portfolio actuel est dans :
`/home/paul/THP_Linux/Dev_++/my-portfolio/src/`

Composants à préserver :
- Layout + NavArc (navigation circulaire)
- Home + LogoWall + HomeWallSkill
- Projects (projets, hackathons, formations)
- Contact
- Footer + LetterGlitch
- ThemeProvider (dark/light)
- i18n (EN/FR)
- Tous les assets (SVG logos, images projets, favicon)

## Ce que tu dois faire

### Phase 1 — Scaffold Monorepo

1. Sauvegarde l'ancien code source (copier src/ et public/ dans un dossier _backup/)
2. Crée la structure monorepo à la racine de my-portfolio :
   - `pnpm-workspace.yaml`
   - `package.json` (root, private, scripts workspace)
   - `tsconfig.base.json`
   - `.gitignore` actualisé
   - `apps/web/` avec Vite + React 19 + TypeScript 5.9
   - `packages/overmind-3d/` (scaffold vide @portfolio/overmind-3d)
   - `packages/shared/` (scaffold vide @portfolio/shared)
3. Configure les package.json et tsconfig.json de chaque package (voir ARCHITECTURE.md)
4. Vérifie que `pnpm install` et `pnpm dev` fonctionnent (page blanche OK)

### Phase 2 — Migration Portfolio

1. Crée `apps/web/index.html` (point d'entrée Vite)
2. Crée `apps/web/src/main.tsx` (React 19 createRoot)
3. Migre les styles :
   - Copie `global.css` avec les CSS variables (dark/light)
   - Copie `tailwind.config.js` et `postcss.config.js`
   - Copie les CSS composants (navArc.css, home.css, etc.)
4. Migre les composants dans l'ordre :
   - ThemeProvider.tsx
   - i18n/ (config + locales en.json, fr.json)
   - Layout.tsx + NavArc.tsx + Footer.tsx
   - Home.tsx + LogoWall.tsx + HomeWallSkill.tsx
   - Projects.tsx
   - Contact.tsx
   - LetterGlitch.tsx
   - Icons/
5. Migre les assets :
   - public/svg/ (logos tech)
   - public/projects/ (screenshots)
   - public/favicon.ico
6. Adapte les chemins d'assets :
   - `process.env.PUBLIC_URL` → `import.meta.env.BASE_URL`
   - Vérifie que `getAssetPath()` et `getSvgPath()` fonctionnent
7. Supprime les imports/dépendances CRA (react-scripts, etc.)
8. Vérifie : le portfolio fonctionne identiquement SANS l'oeil 3D

### Phase 3 — Package Overmind 3D Light

1. Setup `packages/overmind-3d/` avec la structure de OVERMIND_3D_LIGHT.md
2. Copie et adapte depuis le package OFC (@ofc/overmind-3d) :
   - `sceneSetup.ts` — SIMPLIFIER : background transparent (null + alpha: true)
   - `modelLoader.ts` — garder tel quel, filtrer les animations Pop_*
   - `inputTracker.ts` — garder tel quel
   - `gazeSystem.ts` — garder tel quel mais retirer le wallet override
3. Copie les behaviors Yuka :
   - `WanderBehaviorXY.ts` — garder tel quel
   - `SoftBoundaryBehavior.ts` — garder tel quel
4. Crée le NOUVEAU behavior :
   - `MouseRepulsionBehavior.ts` — champ de force avec distance min variable (voir OVERMIND_3D_LIGHT.md section 4.5)
5. Crée les machines XState minimales :
   - `applicationMachine.ts` — ne spawn que bloom, lighting, material, model, pbr
   - `bloomMachine.ts`, `lightingMachine.ts`, `materialMachine.ts`, `modelMachine.ts`, `pbrMachine.ts`
   - Inspire-toi des machines OFC mais retire les events/states non pertinents
6. Crée le SceneRenderer.tsx simplifié :
   - Setup scene + camera + renderer + bloom
   - Load model
   - Init InputTracker + GazeSystem + Yuka (wander + boundary + mouse repulsion)
   - Boucle animate() complète (voir OVERMIND_3D_LIGHT.md section 7)
7. Crée les exports (OvermindOverlay, OvermindProvider, useOvermind)
8. Copie les assets dans apps/web/public/ :
   - `models/V4.2_Overmind.glb` depuis le repo OFC
   - `draco/` (3 fichiers decoder) depuis le repo OFC

### Phase 4 — Intégration

1. Ajoute `@portfolio/overmind-3d` comme dépendance de apps/web
2. Wrappe l'app avec `<OvermindProvider>`
3. Ajoute `<OvermindOverlay />` dans App.tsx (en dehors du Layout, en fixed)
4. Ajuste les z-index : canvas=10, header/nav=50
5. Vérifie le vite.config.ts :
   - `optimizeDeps.exclude: ['@portfolio/overmind-3d']`
   - `resolve.dedupe: ['three']` si doublon
6. Teste tout :
   - L'oeil apparaît et se balade
   - L'oeil regarde la souris
   - L'oeil fuit la souris (champ de force)
   - Le HTML reste cliquable
   - Le scroll fonctionne
   - Le theme switch fonctionne
   - Le language switch fonctionne
   - Le build production fonctionne

### Phase 5 — Nettoyage

1. Supprime _backup/ si tout fonctionne
2. Supprime les anciennes dépendances R3F (@react-three/fiber, @react-three/drei)
3. Supprime l'ancien EyeFollower/ et Eye-1K.glb
4. Vérifie le .gitignore
5. pnpm build — zéro erreur

## Contraintes techniques

- Package manager : pnpm (pas npm, pas yarn)
- Tailwind reste en v3 (ne PAS migrer vers v4)
- Three.js vanilla (PAS React Three Fiber)
- XState v5 (pas v4)
- Les packages workspace n'ont PAS de build step — le source .ts est consommé directement par Vite
- `erasableSyntaxOnly: true` dans tsconfig → pas d'enums TS, utiliser `as const`
- `verbatimModuleSyntax: true` → `export type { ... }` pour les ré-exports de types
- Le modèle GLB et les fichiers DRACO sont dans apps/web/public/, pas dans le package

## Bonnes pratiques (identiques au monorepo OFC)

- Un seul `pnpm install` à la racine (pas d'install dans les sous-dossiers)
- Scripts root délèguent aux packages via `pnpm --filter`
- Les packages exports sont `"./src/index.ts"` (source directe, pas de dist/)
- Pas de build step pour les packages internes
- `workspace:*` pour les dépendances entre packages
```

---

## PROMPTS PAR PHASE (DÉCOUPAGE)

### Prompt Phase 1 — Scaffold

```
Lis la documentation dans /home/paul/THP_Linux/Dev_++/my-portfolio/Claude/00_PLAN_MONOREPO/ (les 4 fichiers .md).

Exécute la Phase 1 du plan : Scaffold le monorepo pnpm.

1. Copie src/ et public/ actuels dans _backup/
2. Crée la structure monorepo : pnpm-workspace.yaml, root package.json, tsconfig.base.json
3. Crée apps/web/ avec Vite + React 19 + TS 5.9 (page vide)
4. Crée packages/overmind-3d/ (scaffold vide @portfolio/overmind-3d)
5. Crée packages/shared/ (scaffold vide @portfolio/shared)
6. Configure tous les package.json et tsconfig.json selon ARCHITECTURE.md
7. Vérifie : pnpm install + pnpm dev fonctionne

Ne migre PAS encore le code du portfolio, juste le scaffold vide.
```

### Prompt Phase 2 — Migration Portfolio

```
Lis la documentation dans /home/paul/THP_Linux/Dev_++/my-portfolio/Claude/00_PLAN_MONOREPO/.

Le scaffold monorepo est en place. Exécute la Phase 2 : migre le portfolio depuis _backup/ vers apps/web/.

Guide de migration : voir MIGRATION_CRA_TO_VITE.md

1. Migre les styles (global.css, tailwind, CSS composants)
2. Migre les composants un par un (ThemeProvider → i18n → Layout → Home → Projects → Contact → Footer)
3. Migre les assets (SVG, images, favicon)
4. Adapte les chemins (PUBLIC_URL → BASE_URL)
5. Supprime react-scripts et les dépendances CRA
6. Le portfolio doit fonctionner identiquement, SANS l'oeil 3D pour l'instant

Attention :
- Tailwind reste en v3
- Pas de React Router si le portfolio actuel ne l'utilise pas
- Vérifie chaque composant individuellement
```

### Prompt Phase 3 — Overmind 3D Light

```
Lis la documentation dans /home/paul/THP_Linux/Dev_++/my-portfolio/Claude/00_PLAN_MONOREPO/, en particulier OVERMIND_3D_LIGHT.md.

Le portfolio migré fonctionne dans apps/web/. Exécute la Phase 3 : crée le package @portfolio/overmind-3d.

Code source de référence à adapter :
- /home/paul/THP_Linux/Dev_++/OFC_Project/Overmind_Founders_Collection/packages/overmind-3d/

Adapte le code OFC pour une version ALLÉGÉE :
1. Scene transparente (background: null, alpha: true)
2. Chargement modèle V4.2 (GLTFLoader + DRACO, animations bras/anneaux uniquement)
3. InputTracker (suivi souris → rotations)
4. GazeSystem (blend souris/autonome, SANS wallet override)
5. WanderBehaviorXY (vagabondage Yuka plan XY)
6. SoftBoundaryBehavior (limites viewport)
7. MouseRepulsionBehavior (NOUVEAU — champ de force, distance min variable)
8. Machines XState minimales (bloom, lighting, material, model, pbr)
9. SceneRenderer.tsx avec boucle animate() complète
10. Exports : OvermindOverlay, OvermindProvider, useOvermind

Copie les assets GLB et DRACO depuis le monorepo OFC vers apps/web/public/.

Contrainte CRITIQUE : Three.js vanilla, PAS React Three Fiber.
```

### Prompt Phase 4 — Intégration

```
Lis la documentation dans /home/paul/THP_Linux/Dev_++/my-portfolio/Claude/00_PLAN_MONOREPO/.

Le package @portfolio/overmind-3d est prêt. Exécute la Phase 4 : intègre-le dans apps/web.

1. Ajoute la dépendance workspace dans apps/web/package.json
2. Wrappe l'app avec OvermindProvider dans main.tsx
3. Ajoute <OvermindOverlay /> dans App.tsx (fixed overlay)
4. Configure vite.config.ts (exclude + dedupe)
5. Ajuste les z-index (canvas=10, nav=50)
6. Teste : oeil visible, se balade, regarde souris, fuit souris, HTML cliquable
7. Supprime l'ancien EyeFollower et les dépendances R3F
8. pnpm build — zéro erreur
```

---

## NOTES POUR L'AMÉLIORATION

Ce prompt peut être enrichi avec :
- **Screenshots** du portfolio actuel pour que Claude comprenne le rendu visuel
- **Paramètres visuels précis** si les valeurs par défaut ne conviennent pas (couleur de l'oeil, intensité du bloom, vitesse de déplacement)
- **Responsive** : comportement souhaité sur mobile (désactiver le 3D ? réduire la qualité ?)
- **Performance** : seuil GPU pour désactiver (detect-gpu)
- **Animations supplémentaires** : réaction au scroll, réaction aux sections de la page
- **Tests** : ajouter des tests unitaires/e2e

## ESTIMATION DE COMPLEXITÉ

| Phase | Fichiers à créer/modifier | Complexité |
|-------|--------------------------|------------|
| Phase 1 — Scaffold | ~10 fichiers config | Faible |
| Phase 2 — Migration | ~25 fichiers (copie + adaptation) | Moyenne |
| Phase 3 — Overmind 3D | ~20 fichiers (adaptation + création) | Haute |
| Phase 4 — Intégration | ~5 fichiers | Faible |
| Phase 5 — Nettoyage | ~5 fichiers à supprimer | Faible |
