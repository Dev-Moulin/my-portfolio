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
  uniform float uTextOffset;     // 0..1, position dans le canvas
  uniform float uViewportFrac;   // fraction visible (viewportH / canvasH)
  uniform float uHoverGlow;      // 0..1
  uniform float uDebugFrame;     // bool 0/1

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

    // ── Sample content texture (window vertical via uTextOffset) ──
    // Note: CanvasTexture flipY=true, so v=1 = top of canvas, v=0 = bottom.
    // uTextOffset = 0 → on veut voir le haut du canvas (header).
    float ySample = mix(1.0 - uViewportFrac, 1.0, uv.y) - uTextOffset;
    vec4 texel = texture2D(uContentTex, vec2(uv.x, ySample));
    float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));

    // Détecte si le pixel est coloré (photo) ou monochrome (texte/fond)
    float maxC = max(texel.r, max(texel.g, texel.b));
    float minC = min(texel.r, min(texel.g, texel.b));
    float saturation = maxC > 0.001 ? (maxC - minC) / maxC : 0.0;
    float colorMask = smoothstep(0.05, 0.15, saturation);

    // Mode monochrome (texte/fond) — mix cyan classique
    vec3 bgCol = uTint * 0.2;
    vec3 fgCol = mix(uTint, vec3(1.0), 0.9);
    vec3 holoCol = mix(bgCol, fgCol, lum);

    // Mode couleur (photo) — garde les couleurs originales avec un léger overlay tint
    vec3 photoCol = texel.rgb * (vec3(1.0) - uTint * 0.05);

    vec3 col = mix(holoCol, photoCol, colorMask);

    // Hover glow
    col += uTint * uHoverGlow * 0.1;

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

    // ── Fade haut/bas (mode lecture) ──
    float fadeTop = smoothstep(0.0, 0.05, uv.y);
    float fadeBot = smoothstep(0.0, 0.05, 1.0 - uv.y);
    col *= fadeTop * fadeBot;

    // ── Debug frame (cadre rouge autour de la zone visible) ──
    if (uDebugFrame > 0.5) {
      if (uv.y < 0.01 || uv.y > 0.99 || uv.x < 0.01 || uv.x > 0.99) {
        col = vec3(1.0, 0.0, 0.0);
      }
    }

    // ── Alpha ──
    // High base opacity so background is solid; text on top is even more visible
    float alpha = uOpacity * (0.85 + fresnel * 0.15) * flicker;

    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Canvas2D content renderer ────────────────────────────────────────────────

const CANVAS_W = 1024;
const VIEWPORT_H = 1024;           // hauteur visible (≈ ratio mesh)

// ── Style configs (typo) ────────────────────────────────────────────────────

export interface HoloCardStyle {
  fontTitle: string;       // pour le titre principal
  fontSubtitle: string;    // pour le sous-titre
  fontHeading: string;     // pour les section headings [ FOO ]
  fontBody: string;        // pour le texte des lignes
  fontFooter: string;      // pour le footer
  colorTitle: string;
  colorSubtitle: string;
  colorHeading: string;
  colorBody: string;
  colorFooter: string;
  colorAccent: string;     // separators, border, corners, avatar circle
  uppercaseTitle?: boolean;
  letterSpacingTitle?: number; // px
  // Tailles de texte (overridable par style — defaults dans DEFAULT_SIZES)
  sizeTitle?: number;
  sizeSubtitle?: number;
  sizeHeading?: number;
  sizeBody?: number;
  sizeFooter?: number;
  lineHeightBody?: number; // espacement vertical entre lignes du body
  headingHeight?: number;  // espacement après un section heading
}

const DEFAULT_SIZES = {
  title: 44,
  subtitle: 26,
  heading: 28,
  body: 24,
  footer: 30,
  lineHeightBody: 36,
  headingHeight: 48,
};

export const HOLO_STYLES: Record<string, HoloCardStyle> = {
  // Style A — Cyber/terminal (Cynatar + JetBrains Mono)
  cyber: {
    fontTitle:    `'Cynatar', 'Courier New', monospace`,
    fontSubtitle: `'JetBrains Mono', 'Courier New', monospace`,
    fontHeading:  `'JetBrains Mono', 'Courier New', monospace`,
    fontBody:     `'JetBrains Mono', 'Courier New', monospace`,
    fontFooter:   `'Cynatar', 'Courier New', monospace`,
    colorTitle:    '#ffffff',
    colorSubtitle: '#cfeaff',
    colorHeading:  '#00d4ff',
    colorBody:     '#ffffff',
    colorFooter:   '#00d4ff',
    colorAccent:   '#00d4ff',
    uppercaseTitle: false,
    letterSpacingTitle: 2,
  },
  // Style B — Modern minimal (Inter)
  modern: {
    fontTitle:    `700 'Inter', sans-serif`,
    fontSubtitle: `400 'Inter', sans-serif`,
    fontHeading:  `500 'Inter', sans-serif`,
    fontBody:     `400 'Inter', sans-serif`,
    fontFooter:   `500 'Inter', sans-serif`,
    colorTitle:    '#ffffff',
    colorSubtitle: '#a0c8d8',
    colorHeading:  '#7eddff',
    colorBody:     '#e8f4f8',
    colorFooter:   '#00d4ff',
    colorAccent:   '#00d4ff',
    uppercaseTitle: false,
    letterSpacingTitle: 0,
    // Tailles par défaut du style — peuvent être overridées par card via card.sizes
    sizeTitle: 60,
    sizeSubtitle: 34,
    sizeHeading: 36,
    sizeBody: 30,
    sizeFooter: 36,
    lineHeightBody: 44,
    headingHeight: 56,
  },
  // Style D — Mix cyber + lisible (Orbitron titre + Inter corps)
  mix: {
    fontTitle:    `700 'Orbitron', sans-serif`,
    fontSubtitle: `400 'Inter', sans-serif`,
    fontHeading:  `700 'Orbitron', sans-serif`,
    fontBody:     `400 'Inter', sans-serif`,
    fontFooter:   `700 'Orbitron', sans-serif`,
    colorTitle:    '#ffffff',
    colorSubtitle: '#b8e0ff',
    colorHeading:  '#00d4ff',
    colorBody:     '#f0f8ff',
    colorFooter:   '#00d4ff',
    colorAccent:   '#00d4ff',
    uppercaseTitle: true,
    letterSpacingTitle: 4,
    // Orbitron encore plus condensé → on grossit
    sizeTitle: 56,
    sizeSubtitle: 32,
    sizeHeading: 32,
    sizeBody: 30,
    sizeFooter: 34,
    lineHeightBody: 44,
    headingHeight: 56,
  },
  // Style C — Editorial (Space Grotesk + Inter)
  editorial: {
    fontTitle:    `700 'Space Grotesk', sans-serif`,
    fontSubtitle: `400 'Space Grotesk', sans-serif`,
    fontHeading:  `500 'Space Grotesk', sans-serif`,
    fontBody:     `400 'Inter', sans-serif`,
    fontFooter:   `700 'Space Grotesk', sans-serif`,
    colorTitle:    '#ffffff',
    colorSubtitle: '#c0e0f0',
    colorHeading:  '#00d4ff',
    colorBody:     '#ffffff',
    colorFooter:   '#00d4ff',
    colorAccent:   '#00d4ff',
    uppercaseTitle: false,
    letterSpacingTitle: -1,
  },
};

/** Tailles de texte pour une card. Tout est optionnel — chaque champ override le style. */
export interface HoloCardSizes {
  title?: number;          // taille du titre principal
  subtitle?: number;       // taille du sous-titre
  heading?: number;        // taille des [ HEADING ] de section
  body?: number;           // taille des lignes de texte
  footer?: number;         // taille du footer
  lineHeightBody?: number; // espacement vertical entre lignes du body (≈ body × 1.4)
  headingHeight?: number;  // espace vertical après un heading (≈ heading × 1.6)
}

/** Content definition for a holo card */
export interface HoloCardContent {
  title: string;
  subtitle?: string;
  sections: { heading: string; lines: string[] }[];
  footer?: string;
  styleKey?: keyof typeof HOLO_STYLES; // typo + couleurs (default 'cyber')
  profileImage?: string;                // optional URL → drawn in avatar circle
  /** 'avatar' = cercle photo + titre à droite (default si profileImage),
   *  'centered' = pas de cercle, titre + sous-titre centrés horizontalement */
  headerLayout?: 'avatar' | 'centered';
  /** Override des tailles pour CETTE card uniquement (passe outre le style) */
  sizes?: HoloCardSizes;
}

// ── Asset preload (image + fonts) ───────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** Build a valid CSS font shorthand string : `[weight ]<size>px <family>`.
 *
 * Le shorthand stocké dans HoloCardStyle peut commencer par un weight optionnel
 * (ex: `700 'Inter', sans-serif`) ou non (ex: `'Cynatar', monospace`).
 * Concaténer naïvement `${size}px ${shorthand}` donne `60px 700 'Inter'` qui
 * est INVALIDE en CSS — l'ordre attendu est `weight size family`. Cette helper
 * extrait le weight (s'il existe) et reconstruit dans le bon ordre. */
function buildFontString(size: number, shorthand: string): string {
  // Extrait un weight numérique optionnel en tête (ex: '700 ', '100 ')
  const m = shorthand.match(/^(\d{2,3})\s+(.+)$/);
  if (m) {
    const weight = m[1];
    const family = m[2];
    return `${weight} ${size}px ${family}`;
  }
  return `${size}px ${shorthand}`;
}

/** Wait for all fonts referenced by a style to be loaded by the browser */
async function preloadStyleFonts(style: HoloCardStyle): Promise<void> {
  const probes = [
    buildFontString(40, style.fontTitle),
    buildFontString(26, style.fontSubtitle),
    buildFontString(28, style.fontHeading),
    buildFontString(24, style.fontBody),
    buildFontString(30, style.fontFooter),
  ];
  await Promise.all(probes.map(p => document.fonts.load(p).catch(() => null)));
}

// ── Layout constants ────────────────────────────────────────────────────────

const PAD = 72;
const HEADER_TOP = 100;
const HEADER_BLOCK_HEIGHT = 152;        // espace après le bloc title/subtitle (augmenté pour avatar plus grand)
const SEPARATOR_AFTER_HEADER = 52;

// ── Avatar (cercle photo de profil) ─────────────────────────────────────────
// Le shader fait une rotation 90° de l'UV, donc un cercle parfait en pixels canvas
// apparaît étiré horizontalement à l'écran. AVATAR_ASPECT_Y < 1 compresse le cercle
// en Y canvas pour qu'il apparaisse rond visuellement après le rendu.
// Augmente AVATAR_RADIUS pour grossir, joue avec AVATAR_ASPECT_Y entre 0.5 et 1.0
// si la rondeur n'est pas parfaite (0.7 = compensation moyenne).
const AVATAR_RADIUS = 70;        // rayon en pixels canvas (avant déformation)
const AVATAR_ASPECT_Y = 1.5;     // ratio rY/rX pour compenser l'écrasement horizontal
const AVATAR_TITLE_GAP = 32;     // espace horizontal entre l'avatar et le titre
const SECTION_EMPTY_LINE = 20;
const SECTION_BOTTOM_GAP = 24;
const BETWEEN_SECTIONS_SEP = 40;
const FOOTER_TOP_GAP = 16;
const FOOTER_SEPARATOR_GAP = 48;
const BOTTOM_MARGIN = 100;

/** Résout les tailles effectives. Priorité : card.sizes > style.size* > DEFAULT_SIZES */
function resolveSizes(style: HoloCardStyle, cardSizes?: HoloCardSizes) {
  return {
    title:          cardSizes?.title          ?? style.sizeTitle      ?? DEFAULT_SIZES.title,
    subtitle:       cardSizes?.subtitle       ?? style.sizeSubtitle   ?? DEFAULT_SIZES.subtitle,
    heading:        cardSizes?.heading        ?? style.sizeHeading    ?? DEFAULT_SIZES.heading,
    body:           cardSizes?.body           ?? style.sizeBody       ?? DEFAULT_SIZES.body,
    footer:         cardSizes?.footer         ?? style.sizeFooter     ?? DEFAULT_SIZES.footer,
    lineHeightBody: cardSizes?.lineHeightBody ?? style.lineHeightBody ?? DEFAULT_SIZES.lineHeightBody,
    headingHeight:  cardSizes?.headingHeight  ?? style.headingHeight  ?? DEFAULT_SIZES.headingHeight,
  };
}

/** Calcule la hauteur nécessaire pour dessiner ce contenu (auto-fit) */
function measureContentHeight(content: HoloCardContent, style: HoloCardStyle): number {
  const sizes = resolveSizes(style, content.sizes);
  const layout = content.headerLayout ?? (content.profileImage ? 'avatar' : 'centered');
  let y = HEADER_TOP;

  // Header (avatar layout = bloc fixe avec avatar à gauche, centered = titre + sub-titre centrés)
  if (layout === 'avatar') {
    if (content.subtitle) {
      const subLines = content.subtitle.split('\n');
      y += 48 + (subLines.length - 1) * 36;
    }
    y += HEADER_BLOCK_HEIGHT;
  } else {
    // centered : title + subtitle centrés (line height ~ 1.2 * size)
    y += sizes.title * 1.1;
    if (content.subtitle) {
      const subLines = content.subtitle.split('\n');
      y += sizes.subtitle * 1.4 * subLines.length;
    }
    y += 60; // breathing space after header
  }

  // Separator after header
  y += SEPARATOR_AFTER_HEADER;

  // Sections
  for (let s = 0; s < content.sections.length; s++) {
    const section = content.sections[s];
    y += sizes.headingHeight;
    for (const line of section.lines) {
      y += line === '' ? SECTION_EMPTY_LINE : sizes.lineHeightBody;
    }
    y += SECTION_BOTTOM_GAP;
    if (s < content.sections.length - 1) y += BETWEEN_SECTIONS_SEP;
  }

  // Footer
  if (content.footer) {
    y += FOOTER_TOP_GAP + FOOTER_SEPARATOR_GAP + sizes.footer;
  }

  return y + BOTTOM_MARGIN;
}

// ── 6 card contents ──────────────────────────────────────────────────────────

export const CARD_CONTENTS: HoloCardContent[] = [
  // Card 0 — Profil (Paul Moulin) — Style cyber + photo
  {
    styleKey: 'cyber',
    profileImage: '/images/profile.jpg',
    title: 'Paul Moulin',
    subtitle: 'Full-Stack Developer\nWeb3 & Creative 3D',
    sections: [
      { heading: 'PARCOURS', lines: [
        '12 ans geometre topographe',
        'Mecanicien moto (CAP)',
        'Reconversion dev web',
      ]},
      { heading: 'FORMATION', lines: [
        'The Hacking Project',
        'Dev Fullstack RNCP 37805',
        'Niveau 5 - Blocs 1, 2, 3',
      ]},
      { heading: 'SPECIALISATION', lines: [
        'Web3 . Three.js . Blender',
      ]},
      { heading: 'EXPERIENCE', lines: [
        'Stage THP - Extension Chrome',
        'Web3 protocole Intuition',
      ]},
      { heading: 'COMPETITIONS', lines: [
        'Base Batch Europe',
        'Artizen Fund S6',
        'ETH Global Cannes',
      ]},
      { heading: 'EN COURS', lines: [
        'Three.js Journey',
        'Agent IA (Rust + Ollama)',
      ]},
      { heading: 'LINKS', lines: [
        '> github.com/Dev-Moulin',
        '> x.com/@Dev_FullPoulpe',
        '> linkedin.com/in/DevMoulin',
        '> p.moulin.95@gmail.com',
      ]},
    ],
    footer: '[ TELECHARGER CV ]',
  },
  // Card 1 — OFC (Overmind Founders Collection) — Style modern minimal (Inter)
  {
    styleKey: 'modern',
    headerLayout: 'centered',
    sizes: {
      title: 48,
      subtitle: 48,
      heading: 32,
      body: 24,
      lineHeightBody: 34,   // body × 1.42 — interligne du corps de texte
      headingHeight: 52,    // heading × 1.62 — espace après [ HEADING ]
      footer: 42,           // taille du footer "[ DEMO TESTNET ]"
    },
    title: 'Overmind Founders',
    subtitle: 'Collection',
    sections: [
      { heading: 'TAGLINE', lines: [
        'Vote communautaire on-chain',
        'pour attribuer des totems',
        'aux 42 fondateurs INTUITION',
      ]},
      { heading: 'CONCEPT', lines: [
        'Collection NFT 3D rendant',
        'hommage aux 42 personnes',
        'qui ont contribue a Intuition.',
        '',
        'La communaute explore via',
        'un carrousel 3D, propose des',
        'totems, vote FOR/AGAINST en',
        'deposant des $TRUST dans des',
        'bonding curves. Les votes',
        'enrichissent le Knowledge',
        'Graph (Atoms, Triples, Vaults).',
      ]},
      { heading: 'STATUS', lines: [
        'Fonctionnel sur testnet',
      ]},
      { heading: 'TECH', lines: [
        'React 19 . TypeScript . Vite',
        'Tailwind v4 . wagmi . viem',
        'RainbowKit . Apollo GraphQL',
        'WebSocket . react-i18next',
        'recharts . Vitest . Playwright',
        'INTUITION Protocol',
        '(Atoms, Triples, MultiVault,',
        ' Bonding Curves, Knowledge Graph)',
      ]},
      { heading: 'ROLE', lines: [
        'Developpeur unique (Solo)',
      ]},
    ],
    footer: '[ DEMO TESTNET ]',
  },
  // Card 2 — Overmind 3D — Style mix cyber + lisible (Orbitron + Inter)
  {
    styleKey: 'mix',
    headerLayout: 'centered',
    sizes: {
      title: 48,
      subtitle: 48,
      heading: 32,
      body: 24,
      lineHeightBody: 34,
      headingHeight: 52,
      footer: 42,
    },
    title: 'Overmind 3D',
    subtitle: 'Controller',
    sections: [
      { heading: 'TAGLINE', lines: [
        'Controleur de scene 3D',
        'temps reel - oeil robotique',
        'pilote par 9 machines XState',
      ]},
      { heading: 'CONCEPT', lines: [
        'Oeil robotique modelise sur',
        'Blender pour l\'extension',
        'Chrome Intuition. Reagit en',
        'temps reel : iris rouge si',
        'scam, vert si approuve.',
        '',
        '9 machines XState independantes',
        'communiquent par evenements.',
        'Panneau de controle 8 onglets',
        'pour ajuster en direct.',
        '',
        'Animations Blender NLA jouees',
        'dynamiquement, clignement',
        'procedural, systeme de',
        'revelation par zones trigger.',
      ]},
      { heading: 'TECH', lines: [
        'React 19 . TypeScript',
        'Three.js . XState (Actor Model)',
        'Blender . GLTF/DRACO',
        'UnrealBloomPass . PBR',
        'ACES Filmic . HDR',
        'Vite . Jest . GitHub Actions',
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

async function createContentCanvas(content: HoloCardContent): Promise<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; viewportFrac: number }> {
  const styleKey = content.styleKey ?? 'cyber';
  const style = HOLO_STYLES[styleKey] ?? HOLO_STYLES.cyber;

  // Wait for required fonts to be loaded so the canvas uses them on first paint
  await preloadStyleFonts(style);

  // Optional profile image
  let profileImg: HTMLImageElement | null = null;
  if (content.profileImage) {
    try {
      profileImg = await loadImage(content.profileImage);
    } catch {
      profileImg = null;
    }
  }

  // Resolve sizes (priorité : card.sizes > style.size* > DEFAULT_SIZES)
  const sizes = resolveSizes(style, content.sizes);
  const layout = content.headerLayout ?? (content.profileImage ? 'avatar' : 'centered');

  // Auto-fit canvas height to content
  const measuredH = measureContentHeight(content, style);
  const canvasH = Math.max(VIEWPORT_H, measuredH);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  // ── Helper drawText ──
  const drawText = (
    text: string, x: number, y: number, size: number, color: string,
    fontShorthand: string,
    align: CanvasTextAlign = 'left',
    letterSpacing = 0,
    uppercase = false,
  ) => {
    const final = uppercase ? text.toUpperCase() : text;
    ctx.fillStyle = color;
    ctx.font = buildFontString(size, fontShorthand);
    // letterSpacing nécessite cast (typed only récemment dans lib.dom)
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
    ctx.textAlign = align;
    ctx.fillText(final, x, y);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
  };

  const drawSeparator = (yPos: number) => {
    ctx.strokeStyle = style.colorAccent + '44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, yPos);
    ctx.lineTo(CANVAS_W - PAD, yPos);
    ctx.stroke();
  };

  let y = HEADER_TOP;

  // ── Header ─────────────────────────────────────────────────────────────────
  if (layout === 'avatar') {
    // ── Mode avatar (ellipse pré-déformée + title à droite) ──
    const avatarCx = PAD + AVATAR_RADIUS;
    const avatarCy = y + AVATAR_RADIUS * AVATAR_ASPECT_Y;
    const rX = AVATAR_RADIUS;
    const rY = AVATAR_RADIUS * AVATAR_ASPECT_Y;

    ctx.save();
    ctx.strokeStyle = style.colorAccent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(avatarCx, avatarCy, rX, rY, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (profileImg) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(avatarCx, avatarCy, rX - 2, rY - 2, 0, 0, Math.PI * 2);
      ctx.clip();
      const iw = profileImg.naturalWidth;
      const ih = profileImg.naturalHeight;
      const side = Math.min(iw, ih);
      const sx = (iw - side) / 2;
      const sy = (ih - side) / 2;
      ctx.drawImage(profileImg, sx, sy, side, side, avatarCx - rX, avatarCy - rY, rX * 2, rY * 2);
      ctx.restore();
    } else {
      const initials = content.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      drawText(initials, avatarCx, avatarCy + 16, 56, style.colorAccent, style.fontTitle, 'center');
    }
    ctx.restore();

    // Title (à droite de l'avatar)
    const titleX = PAD + rX * 2 + AVATAR_TITLE_GAP;
    drawText(content.title, titleX, y + 16, sizes.title, style.colorTitle, style.fontTitle, 'left', style.letterSpacingTitle ?? 0, style.uppercaseTitle ?? false);

    if (content.subtitle) {
      const subLines = content.subtitle.split('\n');
      for (let i = 0; i < subLines.length; i++) {
        drawText(subLines[i], titleX, y + 64 + i * 36, sizes.subtitle, style.colorSubtitle, style.fontSubtitle, 'left');
      }
      y += 48 + (subLines.length - 1) * 36;
    }
    y += HEADER_BLOCK_HEIGHT;
  } else {
    // ── Mode centered (titre + sous-titre centrés horizontalement) ──
    const cx = CANVAS_W / 2;
    y += sizes.title * 0.85; // descend du baseline du titre
    drawText(content.title, cx, y, sizes.title, style.colorTitle, style.fontTitle, 'center', style.letterSpacingTitle ?? 0, style.uppercaseTitle ?? false);
    y += sizes.title * 0.35;

    if (content.subtitle) {
      const subLines = content.subtitle.split('\n');
      const subLineH = sizes.subtitle * 1.4;
      for (let i = 0; i < subLines.length; i++) {
        drawText(subLines[i], cx, y + subLineH * (i + 1), sizes.subtitle, style.colorSubtitle, style.fontSubtitle, 'center');
      }
      y += subLineH * subLines.length;
    }
    y += 60;
  }

  // Separator after header
  drawSeparator(y);
  y += SEPARATOR_AFTER_HEADER;

  // ── Sections ──
  for (let s = 0; s < content.sections.length; s++) {
    const section = content.sections[s];
    drawText(`[ ${section.heading} ]`, PAD, y, sizes.heading, style.colorHeading, style.fontHeading, 'left');
    y += sizes.headingHeight;

    for (const line of section.lines) {
      if (line === '') { y += SECTION_EMPTY_LINE; continue; }
      drawText(line, PAD + 16, y, sizes.body, style.colorBody, style.fontBody, 'left');
      y += sizes.lineHeightBody;
    }

    y += SECTION_BOTTOM_GAP;

    if (s < content.sections.length - 1) {
      drawSeparator(y);
      y += BETWEEN_SECTIONS_SEP;
    }
  }

  // ── Footer ──
  if (content.footer) {
    y += FOOTER_TOP_GAP;
    drawSeparator(y);
    y += FOOTER_SEPARATOR_GAP;
    drawText(content.footer, CANVAS_W / 2, y, sizes.footer, style.colorFooter, style.fontFooter, 'center');
  }

  // ── Border frame ──
  ctx.strokeStyle = style.colorAccent + '33';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, CANVAS_W - 64, canvasH - 64);

  // Corner accents
  const cornerLen = 40;
  ctx.strokeStyle = style.colorAccent;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(32, 32 + cornerLen); ctx.lineTo(32, 32); ctx.lineTo(32 + cornerLen, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CANVAS_W - 32 - cornerLen, 32); ctx.lineTo(CANVAS_W - 32, 32); ctx.lineTo(CANVAS_W - 32, 32 + cornerLen); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(32, canvasH - 32 - cornerLen); ctx.lineTo(32, canvasH - 32); ctx.lineTo(32 + cornerLen, canvasH - 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CANVAS_W - 32 - cornerLen, canvasH - 32); ctx.lineTo(CANVAS_W - 32, canvasH - 32); ctx.lineTo(CANVAS_W - 32, canvasH - 32 - cornerLen); ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { canvas, texture, viewportFrac: VIEWPORT_H / canvasH };
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

export async function createHoloScreenMaterial(opts: HoloScreenOptions = {}): Promise<THREE.ShaderMaterial> {
  const tint = opts.tint instanceof THREE.Color
    ? opts.tint
    : new THREE.Color(opts.tint ?? DEFAULT_TINT);

  const content = opts.content ?? CARD_CONTENTS[0];
  const { texture, viewportFrac } = await createContentCanvas(content);

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:              { value: 0 },
      uTint:              { value: tint },
      uOpacity:           { value: opts.opacity ?? 1.0 },
      uScanlineCount:     { value: opts.scanlineCount ?? 80 },
      uScanlineSpeed:     { value: opts.scanlineSpeed ?? 1.0 },
      uScanlineIntensity: { value: opts.scanlineIntensity ?? 0.06 },
      uFlickerSpeed:      { value: opts.flickerSpeed ?? 1.0 },
      uFlickerIntensity:  { value: opts.flickerIntensity ?? 0.15 },
      uFresnelPower:      { value: opts.fresnelPower ?? 2.5 },
      uFresnelIntensity:  { value: opts.fresnelIntensity ?? 0.6 },
      uGlitchIntensity:   { value: opts.glitchIntensity ?? 0.2 },
      uContentTex:        { value: texture },
      uTextOffset:        { value: 0 },
      uViewportFrac:      { value: viewportFrac },
      uHoverGlow:         { value: 0 },
      uDebugFrame:        { value: 0 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

// ── Apply holo to multiple card screens ─────────────────────────────────────

const CARD_SCREEN_MAP: Record<string, number> = {
  // Note: Blender exports strip dots in node names → "Cadre_Screen_gameasset.001" becomes "Cadre_Screen_gameasset001"
  Cadre_Screen_gameasset001: 0, // Card1 — Profil
  Cadre_Screen_gameasset002: 1, // Card2 — OFC
  Cadre_Screen_gameasset004: 2, // Card3 — Overmind3D
};

export interface HoloCardEntry {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  cardIdx: number; // 0=Profil, 1=OFC, 2=Overmind3D
}

/** Apply hologram material to the 3 card screens (Profil, OFC, Overmind3D) */
export async function applyHoloScreensToCards(model: THREE.Object3D): Promise<HoloCardEntry[]> {
  // Collect candidate meshes first (sync traverse)
  const candidates: { mesh: THREE.Mesh; contentIdx: number }[] = [];
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const contentIdx = CARD_SCREEN_MAP[mesh.name];
    if (contentIdx === undefined) return;
    if (!CARD_CONTENTS[contentIdx]) return;
    candidates.push({ mesh, contentIdx });
  });

  // Build all materials in parallel (await fonts + image)
  const built = await Promise.all(candidates.map(async ({ mesh, contentIdx }) => {
    const content = CARD_CONTENTS[contentIdx];
    const mat = await createHoloScreenMaterial({ content });
    mesh.material = mat;
    return { mesh, material: mat, cardIdx: contentIdx } satisfies HoloCardEntry;
  }));

  if (built.length === 0) {
    console.warn('[holoScreen] No card screen meshes found in model');
  }
  // CRITIQUE: trier par cardIdx pour que cardEntries[i].cardIdx === i.
  // Sans ce sort, model.traverse() retourne les meshes dans l'ordre de la
  // hiérarchie GLB, qui ne correspond pas forcément à cardIdx → l'animator
  // accédait à la mauvaise mesh quand il faisait cardEntries[readingCardIdx].
  built.sort((a, b) => a.cardIdx - b.cardIdx);
  return built;
}

/** Apply hologram material to the screen mesh inside a loaded Card_Holo model.
 *  Also tones down metallic/roughness on the surrounding frame meshes. */
export async function applyHoloScreen(model: THREE.Object3D, opts?: HoloScreenOptions): Promise<THREE.ShaderMaterial | null> {
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

  const mat = await createHoloScreenMaterial(opts);
  (screenMesh as THREE.Mesh).material = mat;
  return mat;
}
