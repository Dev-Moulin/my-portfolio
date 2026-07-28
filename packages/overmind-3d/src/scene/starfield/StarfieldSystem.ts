import * as THREE from 'three';

/**
 * StarfieldSystem — socle « Nuit étoilée » (Phase 1). Un unique `THREE.Points` (1 draw call) dessinant
 * une voûte d'étoiles procédurales autour de la caméra. Léger, mobile-friendly, autonome (branché en
 * 2 lignes dans SceneRenderer + 1 dans animationLoop, cf. Claude/32_Nuit_Etoilee/01_PLAN_Phase1.md).
 *
 * Réglable EN DIRECT (retour Paul « tester les 3 ») via l'event `overmind:starfield-config`
 * { density, tint } → régénère la géométrie. Un petit panneau dev l'émet.
 *
 * Contrainte bloom (recherche) : le bloom global n'est PAS sélectif → on garde la luminosité des
 * étoiles SOUS le seuil 0.5 (uBrightness ≈ 0.4, twinkle ≤ 1) → points NETS, pas de bave.
 */

export type StarDensity = 'minimal' | 'discret' | 'dense';
export type StarTint = 'white' | 'cyan' | 'varied';

const DENSITY_COUNT: Record<StarDensity, number> = {
  minimal: 1000,
  discret: 2200,
  dense: 5000,
};

const SHELL_RADIUS = 85;      // rayon de la voûte — DOIT rester sous le far caméra (=100, cf. sceneSetup.ts).
                              // Recentrée sur la caméra chaque frame → toujours à ~85 d'elle = fond « infini ».
const MAX_BRIGHTNESS = 0.4;   // < seuil bloom 0.5 → pas de bave (twinkle max ×1 → 0.4)
const ROT_SPEED = 0.006;      // rotation ultra-lente de la voûte (rad/s)

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vColor = aColor;
    // Scintillement doux, désynchronisé par étoile (aPhase).
    vTwinkle = 0.65 + 0.35 * sin(uTime * 1.5 + aPhase);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (160.0 / -mv.z); // calibré pour r≈85 → étoiles ~1.5-8 px
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uBrightness;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    // Disque doux : plein au centre, fondu au bord (pas de carré).
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * uBrightness * vTwinkle, alpha);
  }
`;

export class StarfieldSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points | null = null;
  private density: StarDensity;
  private tint: StarTint;
  private elapsed = 0;
  private boundConfig: (e: Event) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    pixelRatio = 1,
    density: StarDensity = 'dense',
    tint: StarTint = 'varied', // choix Paul (2026-07-28)
  ) {
    this.scene = scene;
    this.camera = camera;
    this.density = density;
    this.tint = tint;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBrightness: { value: MAX_BRIGHTNESS },
        uPixelRatio: { value: Math.min(pixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,  // ← occlusion : les étoiles DERRIÈRE le vaisseau sont cachées par lui (retour Paul).
                        // depthWrite reste false (transparent) → les étoiles ne s'occultent pas entre elles.
      blending: THREE.AdditiveBlending, // éclat sur fond noir ; reste sous le seuil bloom via uBrightness
    });
    this.build();

    // Réglage live (panneau dev) → régénère la voûte.
    this.boundConfig = (e: Event) => {
      const d = (e as CustomEvent<{ density?: StarDensity; tint?: StarTint }>).detail;
      let changed = false;
      if (d?.density && d.density !== this.density) { this.density = d.density; changed = true; }
      if (d?.tint && d.tint !== this.tint) { this.tint = d.tint; changed = true; }
      if (changed) this.build();
    };
    window.addEventListener('overmind:starfield-config', this.boundConfig);
  }

  /** (Re)génère le `Points` selon densité + teinte courantes. */
  private build(): void {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    const count = DENSITY_COUNT[this.density];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const col = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Distribution uniforme sur la sphère (évite l'agglutination aux pôles).
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = SHELL_RADIUS * (0.9 + Math.random() * 0.2); // légère variation de « profondeur »
      const sinPhi = Math.sin(phi);
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);

      this.starColor(col);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Majorité de petites étoiles + quelques grosses (3 %).
      sizes[i] = Math.random() > 0.97 ? 3.0 + Math.random() * 1.5 : 0.8 + Math.random() * 1.4;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const points = new THREE.Points(geo, this.material);
    points.frustumCulled = false;  // voûte centrée caméra → toujours visible
    points.renderOrder = -2;        // tout au fond
    points.name = 'starfield';
    points.position.copy(this.camera.position);
    this.scene.add(points);
    this.points = points;
  }

  /** Couleur d'une étoile selon la teinte choisie. */
  private starColor(out: THREE.Color): void {
    const r = Math.random();
    const white = () => { const w = 0.85 + Math.random() * 0.15; out.setRGB(w, w, w); };
    switch (this.tint) {
      case 'white':
        white();
        break;
      case 'cyan':
        if (r < 0.75) white();
        else out.setHSL(0.52, 0.6, 0.75); // cyan (raccord thème néon)
        break;
      case 'varied':
        if (r < 0.6) white();
        else if (r < 0.8) out.setHSL(0.55, 0.6, 0.75);  // cyan/bleu
        else if (r < 0.92) out.setHSL(0.08, 0.6, 0.72);  // ambre (étoile chaude)
        else out.setHSL(0.95, 0.5, 0.78);                // rosé
        break;
    }
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.material.uniforms.uTime.value = this.elapsed;
    if (this.points) {
      this.points.rotation.y += delta * ROT_SPEED;       // dérive lente de la voûte
      this.points.position.copy(this.camera.position);   // suit la caméra → fond « infini », pas de parallaxe de translation
    }
  }

  dispose(): void {
    window.removeEventListener('overmind:starfield-config', this.boundConfig);
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    this.material.dispose();
  }
}
