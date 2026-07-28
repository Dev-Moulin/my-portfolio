// Ce package est bundlé par Vite (via apps/web) → `import.meta.env` existe au RUNTIME.
// Mais `tsc` du package n'a pas les types Vite (vite n'est pas une dépendance directe ici,
// contrairement à apps/web qui utilise `/// <reference types="vite/client" />`).
// On déclare donc le minimum utilisé dans le package (BASE_URL pour les chemins base-aware
// GitHub Pages, cf. holoScreenShader profileImage + linkSystem CV).
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
