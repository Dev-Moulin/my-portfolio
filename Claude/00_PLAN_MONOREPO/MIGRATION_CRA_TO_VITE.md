# MIGRATION CRA → Vite — Guide pas-à-pas

> Guide pour migrer le portfolio de Create React App (react-scripts) vers Vite.
> Ce guide couvre les changements nécessaires pour que le portfolio fonctionne identiquement sous Vite.

---

## 1. DIFFÉRENCES CLÉS CRA vs VITE

| Aspect | CRA (react-scripts) | Vite |
|--------|---------------------|------|
| **Point d'entrée** | `public/index.html` + `src/index.tsx` | `index.html` (racine) + `src/main.tsx` |
| **Variables d'env** | `REACT_APP_*` + `process.env` | `VITE_*` + `import.meta.env` |
| **Assets publics** | `%PUBLIC_URL%/` dans HTML | `/` (servi directement par Vite) |
| **Assets en code** | `process.env.PUBLIC_URL` | `import.meta.env.BASE_URL` |
| **Import SVG** | `import { ReactComponent as Logo } from './logo.svg'` | `import logo from './logo.svg'` (URL) ou plugin SVGR |
| **CSS** | Webpack loaders (CSS modules auto) | PostCSS natif, CSS modules via `.module.css` |
| **TypeScript** | `react-scripts` compile | `tsc` pour type-check, Vite/esbuild pour transpile |
| **Config** | Pas de fichier (ou eject) | `vite.config.ts` explicite |
| **Base path** | `homepage` dans package.json | `base` dans vite.config.ts |

---

## 2. CHANGEMENTS À EFFECTUER

### 2.1 Fichier index.html

**AVANT** (CRA) — `public/index.html` :
```html
<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
<div id="root"></div>
<!-- Pas de script, CRA l'injecte -->
```

**APRÈS** (Vite) — `index.html` (à la racine de apps/web) :
```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.ico" />
    <title>Paul Moulin — Portfolio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Points importants** :
- `%PUBLIC_URL%` → supprimé, Vite sert les assets directement
- Script `src="/src/main.tsx"` ajouté manuellement
- `type="module"` obligatoire

---

### 2.2 Point d'entrée

**AVANT** — `src/index.tsx` :
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<React.StrictMode><App /></React.StrictMode>);
```

**APRÈS** — `src/main.tsx` :
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Changements** :
- Renommé `index.tsx` → `main.tsx` (convention Vite)
- Import destructuré `{ StrictMode }` (React 19 n'a plus besoin d'import default)
- `!` au lieu de `as HTMLElement`

---

### 2.3 Variables d'environnement

**AVANT** (CRA) :
```typescript
// .env
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development

// Usage
const version = process.env.REACT_APP_VERSION;
```

**APRÈS** (Vite) :
```typescript
// .env
VITE_VERSION=1.0.0
VITE_ENVIRONMENT=development

// Usage
const version = import.meta.env.VITE_VERSION;
```

**Rechercher et remplacer** dans tout le code :
```
process.env.REACT_APP_  →  import.meta.env.VITE_
process.env.PUBLIC_URL  →  import.meta.env.BASE_URL
process.env.NODE_ENV    →  import.meta.env.MODE
```

---

### 2.4 Asset paths

**AVANT** (CRA) — `src/utils/assetPath.ts` :
```typescript
export const getAssetPath = (path: string) => {
  return `${process.env.PUBLIC_URL}/${path}`;
};
```

**APRÈS** (Vite) :
```typescript
export const getAssetPath = (path: string) => {
  const base = import.meta.env.BASE_URL;
  // BASE_URL finit toujours par '/'
  return `${base}${path}`;
};
```

---

### 2.5 Imports CSS

**AVANT** (CRA) — les imports CSS marchent tel quel, aucun changement nécessaire :
```typescript
import './styles/global.css';
import './styles/components/navArc.css';
```

**APRÈS** (Vite) — identique, Vite supporte nativement les imports CSS.

---

### 2.6 Tailwind CSS (v3)

**Aucun changement** pour Tailwind 3. Les fichiers `tailwind.config.js` et `postcss.config.js` fonctionnent identiquement sous Vite.

Seul changement : le `postcss.config.js` doit utiliser la syntaxe ESM :

```javascript
// postcss.config.js (ESM)
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Et le `global.css` garde ses directives Tailwind v3 :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### 2.7 TypeScript config

**AVANT** (CRA) — `tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "node"
  }
}
```

**APRÈS** (Vite) — `tsconfig.json` :
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

**Changements** :
- `target` → ES2022 (via tsconfig.base.json)
- `moduleResolution` → `bundler` (au lieu de `node`)
- Ajout de `types: ["vite/client"]` pour `import.meta.env`
- `include` référence les packages workspace

---

### 2.8 Types pour Vite

Créer `src/vite-env.d.ts` :
```typescript
/// <reference types="vite/client" />
```

Cela donne accès à `import.meta.env` typé.

---

## 3. DÉPENDANCES À SUPPRIMER

```bash
# Supprimer les dépendances CRA
pnpm --filter web remove react-scripts @testing-library/react @testing-library/jest-dom @testing-library/user-event web-vitals

# Si react-router-dom n'est pas utilisé (le portfolio actuel ne l'utilise pas vraiment)
pnpm --filter web remove react-router-dom
```

---

## 4. DÉPENDANCES À AJOUTER

```bash
# Build tool
pnpm --filter web add -D vite @vitejs/plugin-react

# Types React 19
pnpm --filter web add -D @types/react @types/react-dom

# React 19 (upgrade)
pnpm --filter web add react@^19.0.0 react-dom@^19.0.0
```

---

## 5. PIÈGES COURANTS

### 5.1 `process.env` n'existe pas dans Vite

Vite n'injecte pas `process.env`. Si un package tiers utilise `process.env.NODE_ENV`, ajouter dans `vite.config.ts` :

```typescript
define: {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
},
```

### 5.2 Import SVG comme composant React

CRA permet `import { ReactComponent as Logo } from './logo.svg'`. Vite ne le supporte pas nativement.

**Solutions** :
1. Utiliser l'URL : `import logo from './logo.svg'` puis `<img src={logo} />`
2. Installer `vite-plugin-svgr` si besoin de composants SVG

Le portfolio actuel utilise des SVG depuis `public/svg/` via `<img src={getAssetPath('svg/react.svg')} />` → **aucun changement nécessaire**.

### 5.3 GitHub Pages base path

CRA utilise `"homepage"` dans package.json. Vite utilise `base` dans vite.config.ts :

```typescript
// vite.config.ts
base: process.env.NODE_ENV === 'production' ? '/my-portfolio/' : '/',
```

### 5.4 Framer Motion compatibilité React 19

Framer Motion 12.x supporte React 19. Vérifier la version et mettre à jour si nécessaire :
```bash
pnpm --filter web add framer-motion@latest
```

### 5.5 i18next compatibilité

`react-i18next` v16+ supporte React 19. Le code i18next n'a pas besoin de changements.

---

## 6. CHECKLIST DE VÉRIFICATION

Après migration, vérifier :

```
[ ] pnpm install — pas d'erreurs
[ ] pnpm dev — le serveur démarre
[ ] La page d'accueil s'affiche correctement
[ ] Le theme dark/light fonctionne
[ ] Le switch de langue EN/FR fonctionne
[ ] La navigation NavArc fonctionne
[ ] Le LogoWall défile correctement
[ ] Les compétences s'expandent (HomeWallSkill)
[ ] Les projets s'affichent avec images/vidéos
[ ] Le footer avec LetterGlitch fonctionne
[ ] Les SVG des logos s'affichent
[ ] pnpm build — compile sans erreur
[ ] pnpm preview — le build fonctionne
[ ] Les assets publics sont accessibles (favicon, images, SVG)
```

---

## 7. ORDRE DE MIGRATION RECOMMANDÉ

1. **Scaffold** : Créer la structure monorepo vide avec Vite
2. **Styles d'abord** : Copier global.css + tailwind.config + postcss.config
3. **ThemeProvider** : Copier et adapter (pas de changement attendu)
4. **i18n** : Copier locales + config
5. **Layout + NavArc** : Copier le squelette de navigation
6. **Sections** : Home, Projects, Contact, Footer une par une
7. **Animations** : LetterGlitch, LogoWall, HomeWallSkill
8. **Assets** : Copier SVG, images, favicon
9. **Test complet** : Vérifier chaque feature
10. **3D** : Intégrer le package Overmind 3D (Phase 3 séparée)
