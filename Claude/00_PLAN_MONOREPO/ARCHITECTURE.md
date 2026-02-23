# ARCHITECTURE — Monorepo my-portfolio

> Détail de la structure technique, configurations, dépendances par package.

---

## 1. STRUCTURE MONOREPO

### 1.1 Workspace pnpm

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.2 Root package.json

```json
{
  "name": "my-portfolio",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "preview": "pnpm --filter web preview",
    "type-check": "pnpm --recursive type-check",
    "clean": "pnpm --recursive exec rm -rf node_modules dist"
  },
  "devDependencies": {
    "typescript": "~5.9.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

### 1.3 tsconfig.base.json (root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

---

## 2. APPS/WEB — Application Portfolio

### 2.1 package.json

```json
{
  "name": "web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "deploy": "gh-pages -d dist"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-i18next": "^16.3.0",
    "i18next": "^25.6.0",
    "i18next-browser-languagedetector": "^8.2.0",
    "framer-motion": "^12.18.0",
    "@heroicons/react": "^2.2.0",
    "@radix-ui/react-icons": "^1.3.2",
    "@portfolio/overmind-3d": "workspace:*",
    "@portfolio/shared": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.0",
    "vite": "^7.2.0",
    "typescript": "~5.9.3",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "gh-pages": "^6.3.0"
  }
}
```

### 2.2 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages : base = "/my-portfolio/" en production
  base: process.env.NODE_ENV === 'production' ? '/my-portfolio/' : '/',
  optimizeDeps: {
    // Ne pas pré-bundler les packages workspace
    exclude: ['@portfolio/overmind-3d', '@portfolio/shared'],
  },
  build: {
    target: 'ES2022',
    rollupOptions: {
      output: {
        // Séparer Three.js dans un chunk dédié
        manualChunks: {
          three: ['three'],
          xstate: ['xstate', '@xstate/react'],
        },
      },
    },
  },
});
```

### 2.3 tsconfig.json (apps/web)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["vite/client"]
  },
  "include": [
    "src",
    "../../packages/overmind-3d/src",
    "../../packages/shared/src"
  ]
}
```

### 2.4 Tailwind + PostCSS (inchangé depuis v3)

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sec: 'var(--sec)',
        background: 'var(--background)',
        white: 'var(--white)',
        'white-icon': 'var(--white-icon)',
        'component-bg': 'var(--component-bg)',
        'primary-accent': 'var(--primary-accent)',
        'secondary-accent': 'var(--secondary-accent)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
```

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 2.5 Structure src/ (apps/web)

```
apps/web/src/
├── main.tsx                       # Point d'entrée React 19
├── App.tsx                        # Providers + Layout
├── styles/
│   ├── global.css                 # Variables CSS + @tailwind directives
│   ├── animations/                # Keyframes CSS
│   └── components/                # CSS par composant
│       ├── navArc.css
│       ├── home.css
│       ├── logoWall.css
│       ├── homeWallSkill.css
│       ├── projects.css
│       ├── contact.css
│       └── footer.css
├── components/
│   ├── Layout/
│   │   ├── Layout.tsx
│   │   ├── NavArc.tsx
│   │   └── Footer.tsx
│   ├── home/
│   │   ├── Home.tsx
│   │   ├── HomeWallSkill.tsx
│   │   └── LogoWall.tsx
│   ├── projects/
│   │   └── Projects.tsx
│   ├── contact/
│   │   └── Contact.tsx
│   ├── animations/
│   │   └── LetterGlitch.tsx
│   ├── icons/                     # Composants icônes SVG
│   ├── LanguageSwitch/
│   └── ThemeProvider.tsx
├── i18n/
│   ├── index.ts                   # Config i18next
│   └── locales/
│       ├── en.json
│       └── fr.json
└── utils/
    └── assetPath.ts               # Helper pour BASE_URL
```

### 2.6 index.html (apps/web)

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Paul Moulin — Portfolio</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 2.7 main.tsx (apps/web)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OvermindProvider } from '@portfolio/overmind-3d';
import { ThemeProvider } from './components/ThemeProvider';
import App from './App';
import './i18n';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <OvermindProvider>
        <App />
      </OvermindProvider>
    </ThemeProvider>
  </StrictMode>
);
```

---

## 3. PACKAGES/OVERMIND-3D — @portfolio/overmind-3d

> Voir `OVERMIND_3D_LIGHT.md` pour la spécification complète.

### 3.1 package.json

```json
{
  "name": "@portfolio/overmind-3d",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "three": "^0.178.0",
    "xstate": "^5.22.0",
    "@xstate/react": "^4.1.3",
    "yuka": "^0.7.8"
  },
  "devDependencies": {
    "@types/three": "^0.178.0",
    "typescript": "~5.9.3"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

### 3.2 tsconfig.json (packages/overmind-3d)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### 3.3 Structure src/

```
packages/overmind-3d/src/
├── index.ts                       # Exports publics
│
├── components/
│   └── OvermindOverlay.tsx        # <div fixed inset-0> + lazy SceneRenderer
│
├── context/
│   ├── OvermindContext.ts         # React.createContext pour l'acteur XState
│   └── OvermindProvider.tsx       # Provider avec useActorRef(applicationMachine)
│
├── hooks/
│   └── useOvermind.ts             # Hook public — accès aux actors enfants
│
├── scene/
│   ├── SceneRenderer.tsx          # Composant principal — setup Three.js + boucle animate()
│   ├── sceneSetup.ts              # Création scene, camera, renderer, composer, bloom
│   ├── modelLoader.ts             # GLTFLoader + DRACOLoader + setup animations
│   ├── inputTracker.ts            # Suivi souris → rotations normalisées
│   └── gazeSystem.ts              # Blend regard souris ↔ regard autonome
│
├── systems/
│   ├── WanderBehaviorXY.ts        # Steering Yuka — vagabondage plan XY
│   ├── SoftBoundaryBehavior.ts    # Steering Yuka — répulsion douce aux bords
│   └── MouseRepulsionBehavior.ts  # NOUVEAU — champ de force souris (distance min)
│
├── machines/
│   ├── applicationMachine.ts      # Orchestrateur racine (spawn les enfants)
│   ├── bloomMachine.ts            # Contrôle bloom (threshold, strength, radius)
│   ├── lightingMachine.ts         # Contrôle éclairage (ambient, directional, point)
│   ├── materialMachine.ts         # Couleurs émissives + intensité
│   ├── modelMachine.ts            # Position, rotation, sensibilité souris
│   └── pbrMachine.ts              # Metalness, roughness par groupe
│
├── data/
│   └── defaultPresets.ts          # Preset visuel unique (couleurs, bloom, lighting)
│
├── utils/
│   └── dracoPath.ts               # getDracoPath(), getModelPath() via BASE_URL
│
└── vite-env.d.ts                  # Types import.meta.env
```

### 3.4 Exports publics (index.ts)

```typescript
// Composants
export { OvermindOverlay } from './components/OvermindOverlay';

// Provider & Context
export { OvermindProvider } from './context/OvermindProvider';

// Hooks
export { useOvermind } from './hooks/useOvermind';
```

---

## 4. PACKAGES/SHARED — @portfolio/shared

### 4.1 package.json

```json
{
  "name": "@portfolio/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "~5.9.3"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

### 4.2 tsconfig.json (packages/shared)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### 4.3 Structure src/

```
packages/shared/src/
├── index.ts                       # Ré-exports
└── types/
    └── index.ts                   # Types partagés (ThemeMode, Locale, etc.)
```

---

## 5. DÉPENDANCES — VUE D'ENSEMBLE

### 5.1 Par package

| Package | Dépendance | Version | Rôle |
|---------|-----------|---------|------|
| **apps/web** | react | ^19.0.0 | UI framework |
| | react-dom | ^19.0.0 | DOM rendering |
| | react-i18next | ^16.3.0 | Traductions |
| | i18next | ^25.6.0 | Moteur i18n |
| | framer-motion | ^12.18.0 | Animations UI |
| | @heroicons/react | ^2.2.0 | Icônes |
| | @portfolio/overmind-3d | workspace:* | 3D overlay |
| | @portfolio/shared | workspace:* | Types partagés |
| | vite | ^7.2.0 | Build tool (dev) |
| | tailwindcss | ^3.4.17 | Styling (dev) |
| | gh-pages | ^6.3.0 | Déploiement (dev) |
| **packages/overmind-3d** | three | ^0.178.0 | Moteur 3D |
| | xstate | ^5.22.0 | State machines |
| | @xstate/react | ^4.1.3 | Binding React |
| | yuka | ^0.7.8 | AI steering |
| **packages/shared** | (aucune) | — | Types only |

### 5.2 Singleton critique

**Three.js** doit être en version unique dans tout le monorepo.
Vérification : `pnpm ls three` ne doit afficher qu'une seule version.

Si doublon détecté :
```json
// apps/web/vite.config.ts
resolve: {
  dedupe: ['three'],
}
```

---

## 6. ASSETS

### 6.1 Dans apps/web/public/

```
public/
├── models/
│   └── V4.2_Overmind.glb          # ~11MB (DRACO compressé)
├── draco/
│   ├── draco_decoder.wasm          # ~280KB
│   ├── draco_decoder.js            # ~703KB
│   └── draco_wasm_wrapper.js       # ~58KB
├── svg/
│   ├── javascript.svg
│   ├── typescript.svg
│   ├── react.svg
│   ├── tailwind.svg
│   ├── threejs.svg
│   ├── blender.svg
│   ├── nodejs.svg
│   ├── rails.svg
│   ├── ruby.svg
│   ├── python.svg
│   ├── postgresql.svg
│   ├── mysql.svg
│   ├── html5.svg
│   ├── css3.svg
│   ├── git.svg
│   ├── github.svg
│   ├── bash.svg
│   ├── vue.svg
│   └── figma.svg
├── projects/
│   ├── accueilCoinTribe.png
│   └── pageCoinTribe.png
└── favicon.ico
```

### 6.2 Provenance du modèle GLB

Le modèle `V4.2_Overmind.glb` provient du repo `https://github.com/intuition-box/Overmind.git`.
Il est utilisé dans le monorepo OFC à `/apps/web/public/models/V4.2_Overmind.glb`.

Les fichiers DRACO decoder proviennent de `https://www.gstatic.com/draco/versioned/decoders/1.5.7/` ou peuvent être copiés depuis le monorepo OFC.

---

## 7. WORKFLOW DE DÉVELOPPEMENT

```bash
# Installation
pnpm install

# Développement (lance apps/web avec HMR)
pnpm dev

# Type-check tout le monorepo
pnpm type-check

# Build production
pnpm build

# Preview local du build
pnpm preview

# Déployer sur GitHub Pages
pnpm --filter web deploy
```

---

## 8. DIAGRAMME DE DÉPENDANCES

```
┌─────────────┐
│  apps/web   │
│  (Portfolio) │
└──────┬──────┘
       │ workspace:*
       ├──────────────────────┐
       ▼                      ▼
┌──────────────────┐   ┌─────────────┐
│ @portfolio/      │   │ @portfolio/ │
│ overmind-3d      │   │ shared      │
│ (Three+XState+   │   │ (Types)     │
│  Yuka)           │   │             │
└──────────────────┘   └─────────────┘
       │
       ▼
  three.js, xstate, yuka
  (npm dependencies)
```
