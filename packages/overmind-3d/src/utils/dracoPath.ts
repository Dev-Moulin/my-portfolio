export function getDracoPath(basePath: string): string {
  return basePath + 'draco/';
}

/** Dossier des transcoders Basis (KTX2) — voir public/basis/ (basis_transcoder.js + .wasm). */
export function getBasisPath(basePath: string): string {
  return basePath + 'basis/';
}

export function getModelPath(basePath: string, filename: string): string {
  return basePath + 'models/' + filename;
}

export function getFontPath(basePath: string, filename: string): string {
  return basePath + 'fonts/' + filename;
}
