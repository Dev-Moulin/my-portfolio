/**
 * Utilitaire pour gérer les chemins d'assets avec BASE_URL (Vite)
 */

/**
 * Génère le chemin complet vers un asset en tenant compte de BASE_URL
 * @param assetPath - Le chemin relatif vers l'asset (ex: "svg/react.svg")
 * @returns Le chemin complet vers l'asset
 */
export const getAssetPath = (assetPath: string): string => {
  const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  const base = import.meta.env.BASE_URL;
  // BASE_URL finit toujours par '/'
  return `${base}${cleanPath}`;
};

/**
 * Raccourci spécifique pour les SVG dans le dossier public/svg
 */
export const getSvgPath = (svgName: string): string => {
  const fileName = svgName.endsWith('.svg') ? svgName : `${svgName}.svg`;
  return getAssetPath(`svg/${fileName}`);
};

/**
 * Raccourci pour les images dans le dossier public/images
 */
export const getImagePath = (imageName: string): string => {
  return getAssetPath(`images/${imageName}`);
};
