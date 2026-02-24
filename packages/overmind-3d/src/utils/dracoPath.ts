export function getDracoPath(basePath: string): string {
  return basePath + 'draco/';
}

export function getModelPath(basePath: string, filename: string): string {
  return basePath + 'models/' + filename;
}

export function getFontPath(basePath: string, filename: string): string {
  return basePath + 'fonts/' + filename;
}
