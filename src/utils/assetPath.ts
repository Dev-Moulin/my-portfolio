/**
 * Utilitaire pour gérer les chemins d'assets avec PUBLIC_URL
 * Cette solution est plus robuste pour le déploiement sur GitHub Pages
 */

/**
 * Génère le chemin complet vers un asset en tenant compte de PUBLIC_URL
 * @param assetPath - Le chemin relatif vers l'asset (ex: "svg/react.svg")
 * @returns Le chemin complet vers l'asset
 */
export const getAssetPath = (assetPath: string): string => {
    // Enlever le slash initial si présent
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    // En développement, PUBLIC_URL est généralement vide
    // En production (GitHub Pages), PUBLIC_URL sera "/my-portfolio"
    const publicUrl = process.env.PUBLIC_URL || '';
    
    // Construire le chemin complet
    return `${publicUrl}/${cleanPath}`;
  };
  
  /**
   * Raccourci spécifique pour les SVG dans le dossier public/svg
   * @param svgName - Le nom du fichier SVG (ex: "react.svg" ou "react")
   * @returns Le chemin complet vers le SVG
   */
  export const getSvgPath = (svgName: string): string => {
    // Ajouter l'extension .svg si elle n'est pas présente
    const fileName = svgName.endsWith('.svg') ? svgName : `${svgName}.svg`;
    return getAssetPath(`svg/${fileName}`);
  };
  
  /**
   * Raccourci pour les images dans le dossier public/images
   * @param imageName - Le nom du fichier image
   * @returns Le chemin complet vers l'image
   */
  export const getImagePath = (imageName: string): string => {
    return getAssetPath(`images/${imageName}`);
  };