import * as THREE from 'three';

// ── Liste des SVG logos a inclure dans l'atlas ───────────────────────────────

const LOGO_FILES = [
  'react.svg', 'typeScript.svg', 'javaScript.svg', 'threejs.svg', 'blender.svg',
  'nodejs.svg', 'next.svg', 'vue.svg', 'astro.svg',
  'HTML5.svg', 'CSS3.svg', 'tailwindcss.svg',
  'rails.svg', 'ruby.svg', 'python.svg', 'bash.svg',
  'postgresql.svg', 'mysql.svg', 'graphql.svg',
  'github.svg', 'git.svg',
];

const ATLAS_LOGO_SIZE = 128;        // each logo cell: 128x128
const ATLAS_PAD = 32;                // horizontal spacing between logos
const ATLAS_HEIGHT = 256;            // total atlas height
const LOGO_Y_OFFSET = (ATLAS_HEIGHT - ATLAS_LOGO_SIZE) / 2;

// ── Build atlas canvas (asynchronous: returns a promise) ───────────────────

async function buildLogoAtlas(basePath: string): Promise<HTMLCanvasElement> {
  // Atlas width = sum of (logo + padding)
  const atlasW = LOGO_FILES.length * (ATLAS_LOGO_SIZE + ATLAS_PAD);
  const canvas = document.createElement('canvas');
  canvas.width = atlasW;
  canvas.height = ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, atlasW, ATLAS_HEIGHT);

  // Load all SVGs in parallel
  const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn(`[holoWall] Failed to load ${src}`); resolve(null); };
    img.src = src;
  });

  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const promises = LOGO_FILES.map(f => loadImage(`${prefix}svg/${f}`));
  const images = await Promise.all(promises);

  // Draw each logo into its cell with original colors
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img) continue;
    const x = i * (ATLAS_LOGO_SIZE + ATLAS_PAD) + ATLAS_PAD / 2;
    const y = LOGO_Y_OFFSET;
    ctx.drawImage(img, x, y, ATLAS_LOGO_SIZE, ATLAS_LOGO_SIZE);
  }

  return canvas;
}

// ── Shaders ──────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -normalize(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uTime;
  uniform float uScrollSpeed;
  uniform vec3  uTint;
  uniform float uOpacity;
  uniform float uScanlineCount;
  uniform float uScanlineIntensity;
  uniform float uFlickerIntensity;
  uniform float uTilesPerScreen;     // how many logo tiles visible at once
  uniform float uLogoCount;          // total number of logos in the atlas
  uniform float uLogoVerticalScale;  // 0..1 = portion of atlas height used for logos (margin = 1 - this)

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float rand(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
  }

  void main() {
    // Wall UV: U = horizontal (scroll axis), V = vertical
    // Mesh UVs come pre-flipped on X, so we only need to flip vertically
    float wallU = vUv.y;
    float wallV = 1.0 - vUv.x;

    // Atlas Y range: logos centered, scale = portion of atlas height
    float halfRange = uLogoVerticalScale * 0.5;
    float logoTop = 0.5 - halfRange;
    float logoBottom = 0.5 + halfRange;
    float ySample = mix(logoTop, logoBottom, wallV);

    // Atlas X: sample only a small portion = (tilesPerScreen / totalLogos)
    float windowSize = uTilesPerScreen / uLogoCount;
    float scrollOffset = uTime * uScrollSpeed;
    float xSample = fract(wallU * windowSize + scrollOffset);

    // Sample atlas — keep original colors
    vec4 atlasSample = texture2D(uAtlas, vec2(xSample, ySample));
    float mask = atlasSample.a;
    // Use original logo colors, slightly tinted toward holo color
    vec3 logoCol = mix(atlasSample.rgb, uTint, 0.3);

    // Background haze (cyan)
    vec3 bgCol = uTint * 0.3;
    vec3 col = mix(bgCol, logoCol, mask);

    // Scanlines (along the perpendicular axis = horizontal lines)
    float scanline = sin(wallV * uScanlineCount * 6.28) * 0.5 + 0.5;
    col *= 1.0 - scanline * uScanlineIntensity;

    // Flicker
    float flicker = 1.0 - uFlickerIntensity * 0.5 * (
      sin(uTime * 6.0) * 0.5 +
      rand(floor(uTime * 8.0)) * 0.5
    );
    col *= flicker;

    // Fresnel edge glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.0);
    col += uTint * fresnel * 0.4;

    // Background visible everywhere + logos brighter
    float finalAlpha = uOpacity * (0.6 + mask * 0.4) * flicker;

    gl_FragColor = vec4(col, finalAlpha);
  }
`;

// ── Material factory ─────────────────────────────────────────────────────────

export interface HoloWallOptions {
  scrollSpeed?: number;        // logos per second
  tint?: THREE.Color | string;
  opacity?: number;
  scanlineCount?: number;
  scanlineIntensity?: number;
  flickerIntensity?: number;
  tilesPerScreen?: number;
  logoVerticalScale?: number;  // 0..1 — portion of atlas height used for logo
  reverse?: boolean;           // scroll the other way
}

const DEFAULT_TINT = new THREE.Color(0x00d4ff);

export function createHoloWallMaterial(atlas: HTMLCanvasElement, opts: HoloWallOptions = {}): THREE.ShaderMaterial {
  const tint = opts.tint instanceof THREE.Color
    ? opts.tint
    : new THREE.Color(opts.tint ?? DEFAULT_TINT);

  const texture = new THREE.CanvasTexture(atlas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const speed = (opts.scrollSpeed ?? 0.05) * (opts.reverse ? -1 : 1);

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas:             { value: texture },
      uTime:              { value: 0 },
      uScrollSpeed:       { value: speed },
      uTint:              { value: tint },
      uOpacity:           { value: opts.opacity ?? 0.85 },
      uScanlineCount:     { value: opts.scanlineCount ?? 60 },
      uScanlineIntensity: { value: opts.scanlineIntensity ?? 0.15 },
      uFlickerIntensity:  { value: opts.flickerIntensity ?? 0.12 },
      uTilesPerScreen:    { value: opts.tilesPerScreen ?? 14 },
      uLogoCount:         { value: LOGO_FILES.length },
      uLogoVerticalScale: { value: opts.logoVerticalScale ?? 0.86 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

// ── Apply to walls in a loaded model ────────────────────────────────────────

const WALL_NAMES = new Set(['Wall_Tech_Plane_1', 'Wall_Tech_Plane_2']);

export async function applyHoloWalls(model: THREE.Object3D, basePath: string): Promise<THREE.ShaderMaterial[]> {
  const atlas = await buildLogoAtlas(basePath);
  const materials: THREE.ShaderMaterial[] = [];

  let i = 0;
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    if (!WALL_NAMES.has(child.name)) return;

    const mat = createHoloWallMaterial(atlas, {
      reverse: i % 2 === 1,  // alternate direction for the 2 walls
    });
    (child as THREE.Mesh).material = mat;
    materials.push(mat);
    i++;
  });

  if (materials.length === 0) {
    console.warn('[holoWall] No wall plane meshes found');
  }
  return materials;
}
