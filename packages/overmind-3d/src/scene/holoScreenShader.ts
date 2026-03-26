import * as THREE from 'three';

/* ── Hologram Screen Shader ──────────────────────────────────────────────────
 *  Applied to the "Cadre_Screen_gameasset001" mesh inside Card_Holo.glb.
 *  Renders a Canvas2D texture with holographic effects on top:
 *  scanlines, flicker, edge glow, chromatic aberration, glitch.
 * ─────────────────────────────────────────────────────────────────────────── */

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
  uniform float uTime;
  uniform vec3  uTint;
  uniform float uOpacity;
  uniform float uScanlineCount;
  uniform float uScanlineSpeed;
  uniform float uScanlineIntensity;
  uniform float uFlickerSpeed;
  uniform float uFlickerIntensity;
  uniform float uFresnelPower;
  uniform float uFresnelIntensity;
  uniform float uGlitchIntensity;
  uniform sampler2D uContentTex;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float rand(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Rotate UVs 90° CW + flip to match mesh orientation
    vec2 uv = vec2(1.0 - vUv.y, 1.0 - vUv.x);

    // ── Glitch offset ──
    float glitchBlock = floor(uv.y * 20.0 + uTime * 3.0);
    float glitchRand = hash(vec2(glitchBlock, floor(uTime * 8.0)));
    if (glitchRand > (1.0 - uGlitchIntensity * 0.15)) {
      uv.x += (glitchRand - 0.5) * 0.06 * uGlitchIntensity;
    }

    // ── Sample content texture ──
    vec4 texel = texture2D(uContentTex, uv);
    // Mix texture luminance with tint color
    float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
    vec3 col = mix(uTint * 0.15, uTint, lum);

    // ── Scanlines ──
    float scanline = sin((uv.y + uTime * uScanlineSpeed * 0.02) * uScanlineCount * 6.28) * 0.5 + 0.5;
    scanline = pow(scanline, 2.0);
    col *= 1.0 - scanline * uScanlineIntensity;

    // ── Large rolling bar ──
    float barPos = fract(uTime * 0.08);
    float bar = smoothstep(0.0, 0.05, abs(uv.y - barPos));
    col *= mix(0.6, 1.0, bar);

    // ── Flicker ──
    float flicker = 1.0 - uFlickerIntensity * 0.5 * (
      sin(uTime * uFlickerSpeed * 6.28) * 0.5 +
      rand(floor(uTime * uFlickerSpeed * 4.0)) * 0.5
    );
    col *= flicker;

    // ── Fresnel edge glow ──
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uFresnelPower);
    col += uTint * fresnel * uFresnelIntensity;

    // ── Chromatic aberration ──
    float chromaShift = 0.003 + 0.002 * sin(uTime * 2.0);
    float r = col.r * (1.0 + chromaShift * sin(uv.y * 40.0 + uTime));
    float b = col.b * (1.0 - chromaShift * sin(uv.y * 40.0 + uTime));
    col = vec3(r, col.g, b);

    // ── Vignette ──
    float vignette = 1.0 - 0.3 * length((uv - 0.5) * 1.8);
    col *= vignette;

    // ── Alpha ──
    float alpha = uOpacity * (0.85 + fresnel * 0.15) * flicker;
    // Fade where texture has content vs empty
    alpha *= mix(0.4, 1.0, lum);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Canvas2D content renderer ────────────────────────────────────────────────

const CANVAS_W = 512;
const CANVAS_H = 512;

/** Content definition for a holo card */
export interface HoloCardContent {
  title: string;
  subtitle?: string;
  sections: { heading: string; lines: string[] }[];
  footer?: string;
}

// ── 6 card contents ──────────────────────────────────────────────────────────

export const CARD_CONTENTS: HoloCardContent[] = [
  // Card 0 — Profil
  {
    title: 'Paul Moulin',
    subtitle: 'Full-Stack Developer\nWeb3 & Creative 3D',
    sections: [
      { heading: 'LINKS', lines: [
        '> github.com/Dev-Moulin',
        '> x.com/@Dev_FullPoulpe',
        '> linkedin.com/in/DevMoulin',
      ]},
      { heading: 'ABOUT', lines: [
        'Building Decentralized',
        'Experiences with Three.js,',
        'React & XState.',
        '',
        'Contributing to the',
        'Future of Trust.',
      ]},
    ],
    footer: '[ VIEW CV ]',
  },
  // Card 1 — OFC
  {
    title: 'Overmind Founders',
    subtitle: 'Collection',
    sections: [
      { heading: 'PROJECT', lines: [
        'Vote communautaire on-chain',
        'pour attribuer des totems',
        'aux 42 fondateurs INTUITION',
      ]},
      { heading: 'TECH', lines: [
        'React 19 . TypeScript . Vite',
        'wagmi . viem . RainbowKit',
        'Apollo GraphQL . WebSocket',
        'INTUITION Protocol',
      ]},
      { heading: 'ROLE', lines: [
        'Developpeur unique (Solo)',
      ]},
    ],
    footer: '[ DEMO TESTNET ]',
  },
  // Card 2 — Overmind 3D
  {
    title: 'Overmind 3D',
    subtitle: 'Controller',
    sections: [
      { heading: 'PROJECT', lines: [
        'Controleur de scene 3D',
        'temps reel — oeil robotique',
        'pilote par 9 machines XState',
      ]},
      { heading: 'TECH', lines: [
        'React 19 . Three.js . XState',
        'Blender . GLTF/DRACO',
        'UnrealBloomPass . PBR',
      ]},
      { heading: 'ROLE', lines: [
        'Dev unique + modelisation 3D',
      ]},
    ],
    footer: '[ DEMO LIVE ]',
  },
  // Card 3 — Extension Chrome
  {
    title: 'Intuition',
    subtitle: 'Chrome Extension',
    sections: [
      { heading: 'PROJECT', lines: [
        'Extension Web3 de confiance',
        'decentralisee — detection',
        'de scam via attestations',
      ]},
      { heading: 'TECH', lines: [
        'TypeScript . React . Plasmo',
        'Three.js . Shaders GLSL',
        'GraphQL . wagmi . viem',
      ]},
      { heading: 'ROLE', lines: [
        'UI/UX + integration 3D',
        '158 commits . 33 PRs',
        'Equipe de 6 (stage THP)',
      ]},
    ],
    footer: '[ GITHUB ]',
  },
  // Card 4 — CoinTribe
  {
    title: 'CoinTribe',
    subtitle: 'Plateforme Crypto',
    sections: [
      { heading: 'PROJECT', lines: [
        'Plateforme communautaire',
        'crypto — votes de sentiment',
        'graphiques temps reel',
        'alertes de prix email',
      ]},
      { heading: 'TECH', lines: [
        'Ruby on Rails 8 . PostgreSQL',
        'Hotwire . Binance WebSocket',
        'CoinMarketCap API . Mailjet',
      ]},
      { heading: 'ROLE', lines: [
        'Auth, securite, deploiement',
        'Equipe de 5 (projet THP)',
      ]},
    ],
    footer: '[ GITHUB ]',
  },
  // Card 5 — CV
  {
    title: 'Paul Moulin',
    subtitle: 'Curriculum Vitae',
    sections: [
      { heading: 'FORMATION', lines: [
        'The Hacking Project',
        'Dev Fullstack RNCP 37805',
        'Three.js Journey',
        'Blender — autodidacte',
      ]},
      { heading: 'COMPETENCES', lines: [
        'React 19 . TypeScript . Three.js',
        'XState . Ruby on Rails 8',
        'wagmi . viem . Blender . GLSL',
      ]},
      { heading: 'COMPETITIONS', lines: [
        'Base Batch Europe',
        'Artizen Fund S6',
        'ETH Global Cannes 2025',
      ]},
    ],
    footer: '[ TELECHARGER PDF ]',
  },
];

function createContentCanvas(content: HoloCardContent): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Helper
  const drawText = (text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', bold = false) => {
    ctx.fillStyle = color;
    ctx.font = `${bold ? 'bold ' : ''}${size}px 'Courier New', monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  const drawSeparator = (y: number) => {
    ctx.strokeStyle = '#00d4ff44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(CANVAS_W - pad, y);
    ctx.stroke();
  };

  const pad = 36;
  let y = 50;

  // ── Header ──
  // Avatar placeholder (circle)
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pad + 28, y + 8, 26, 0, Math.PI * 2);
  ctx.stroke();
  // Initials inside
  const initials = content.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  drawText(initials, pad + 28, y + 16, 20, '#00d4ff', 'center', true);

  // Title
  drawText(content.title, pad + 68, y, 22, '#ffffff', 'left', true);

  // Subtitle (multiline support)
  if (content.subtitle) {
    const subLines = content.subtitle.split('\n');
    for (let i = 0; i < subLines.length; i++) {
      drawText(subLines[i], pad + 68, y + 24 + i * 18, 13, '#88ccff');
    }
    y += 24 + (subLines.length - 1) * 18;
  }

  y += 56;

  // ── Separator ──
  drawSeparator(y);
  y += 26;

  // ── Sections ──
  for (let s = 0; s < content.sections.length; s++) {
    const section = content.sections[s];
    drawText(`[ ${section.heading} ]`, pad, y, 14, '#00d4ff', 'left', true);
    y += 24;

    for (const line of section.lines) {
      if (line === '') { y += 10; continue; }
      drawText(line, pad + 8, y, 12, '#99ccee');
      y += 18;
    }

    y += 12;

    // Separator between sections (not after last)
    if (s < content.sections.length - 1) {
      drawSeparator(y);
      y += 20;
    }
  }

  // ── Footer ──
  if (content.footer) {
    y += 8;
    drawSeparator(y);
    y += 24;
    drawText(content.footer, CANVAS_W / 2, y, 15, '#00d4ff', 'center', true);
  }

  // ── Border frame ──
  ctx.strokeStyle = '#00d4ff33';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, CANVAS_W - 32, CANVAS_H - 32);

  // Corner accents
  const cornerLen = 20;
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  // Top-left
  ctx.beginPath(); ctx.moveTo(16, 16 + cornerLen); ctx.lineTo(16, 16); ctx.lineTo(16 + cornerLen, 16); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(CANVAS_W - 16 - cornerLen, 16); ctx.lineTo(CANVAS_W - 16, 16); ctx.lineTo(CANVAS_W - 16, 16 + cornerLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(16, CANVAS_H - 16 - cornerLen); ctx.lineTo(16, CANVAS_H - 16); ctx.lineTo(16 + cornerLen, CANVAS_H - 16); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(CANVAS_W - 16 - cornerLen, CANVAS_H - 16); ctx.lineTo(CANVAS_W - 16, CANVAS_H - 16); ctx.lineTo(CANVAS_W - 16, CANVAS_H - 16 - cornerLen); ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { canvas, texture };
}

// ── Material factory ─────────────────────────────────────────────────────────

export interface HoloScreenOptions {
  tint?: THREE.Color | string;
  opacity?: number;
  scanlineCount?: number;
  scanlineSpeed?: number;
  scanlineIntensity?: number;
  flickerSpeed?: number;
  flickerIntensity?: number;
  fresnelPower?: number;
  fresnelIntensity?: number;
  glitchIntensity?: number;
  content?: HoloCardContent;
}

const DEFAULT_TINT = new THREE.Color(0x00d4ff);

export function createHoloScreenMaterial(opts: HoloScreenOptions = {}): THREE.ShaderMaterial {
  const tint = opts.tint instanceof THREE.Color
    ? opts.tint
    : new THREE.Color(opts.tint ?? DEFAULT_TINT);

  const content = opts.content ?? CARD_CONTENTS[0];
  const { texture } = createContentCanvas(content);

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:              { value: 0 },
      uTint:              { value: tint },
      uOpacity:           { value: opts.opacity ?? 0.95 },
      uScanlineCount:     { value: opts.scanlineCount ?? 80 },
      uScanlineSpeed:     { value: opts.scanlineSpeed ?? 1.0 },
      uScanlineIntensity: { value: opts.scanlineIntensity ?? 0.12 },
      uFlickerSpeed:      { value: opts.flickerSpeed ?? 3.0 },
      uFlickerIntensity:  { value: opts.flickerIntensity ?? 0.15 },
      uFresnelPower:      { value: opts.fresnelPower ?? 2.5 },
      uFresnelIntensity:  { value: opts.fresnelIntensity ?? 0.6 },
      uGlitchIntensity:   { value: opts.glitchIntensity ?? 0.5 },
      uContentTex:        { value: texture },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/** Apply hologram material to the screen mesh inside a loaded Card_Holo model.
 *  Also tones down metallic/roughness on the surrounding frame meshes. */
export function applyHoloScreen(model: THREE.Object3D, opts?: HoloScreenOptions): THREE.ShaderMaterial | null {
  let screenMesh: THREE.Mesh | null = null;

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    if (mesh.name === 'Cadre_Screen_gameasset001') {
      screenMesh = mesh;
      return;
    }

    // Reduce metallic reflection on frame meshes so they don't wash out the screen
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat && 'metalness' in mat) {
        const std = mat as THREE.MeshStandardMaterial;
        std.metalness = Math.min(std.metalness, 0.3);
        std.roughness = Math.max(std.roughness, 0.6);
        std.envMapIntensity = 0.2;
        std.needsUpdate = true;
      }
    }
  });

  if (!screenMesh) {
    console.warn('[holoScreen] Mesh "Cadre_Screen_gameasset001" not found in model');
    return null;
  }

  const mat = createHoloScreenMaterial(opts);
  (screenMesh as THREE.Mesh).material = mat;
  return mat;
}
