import * as THREE from 'three';

// Placement HUD (responsive + fov-proof). On vise un point de l'ÉCRAN en NDC (repère -1..1), pas une
// position 3D fixe : recalculé chaque frame selon le fov/ratio courants → reste collé au coin.
const HUD_DIST = 3;                    // distance devant la caméra (unités)
const HUD_NDC = { x: 0.87, y: 0.90 };  // centre visé à l'écran : coin haut-droite avec une marge
const HUD_HALF = { x: 0.17, y: 0.07 }; // demi-taille à l'écran (fraction du demi-cadre) → OVALE

/**
 * SkipGlowSystem — bulle de glow (halo néon) DERRIÈRE le bouton SKIP. Un simple plane (2 triangles)
 * peint par un shader radial, ancré en HUD (coin haut-droite) sur la caméra, capté par le bloom
 * GLOBAL de la scène. Purement décoratif : NON cliquable (le clic reste sur le bouton HTML). Sa
 * visibilité sera pilotée par l'état du trajet (leçon 7).
 */
export class SkipGlowSystem {
  // ── Leçon 1 — la géométrie ──────────────────────────────────────────────
  // Un carré plat de 1×1 unité = 2 triangles (4 sommets). PlaneGeometry génère aussi les UV.
  private geometry = new THREE.PlaneGeometry(1, 1);

  // ── Leçon 3a — notre PREMIER shader : colorer les 2 triangles ────────────
  // Un ShaderMaterial = on écrit nous-mêmes le programme de peinture (GLSL), en 2 parties.
  private material = new THREE.ShaderMaterial({
    depthTest: false,
    transparent: true, // pour que l'alpha (transparence) du fragment shader soit pris en compte
    blending: THREE.AdditiveBlending, // la lumière s'AJOUTE au fond (comme une vraie source lumineuse)
    uniforms: {
      // uniforms = variables passées du JS au shader, MÊME valeur pour tous les pixels (des réglages).
      uColor: { value: new THREE.Color(0x00e5ff) }, // cyan
      uIntensity: { value: 0.85 },                   // franchit le seuil du bloom (0.5) ; baissé ~¼ (retours Paul)
      uOpacity: { value: 0 },                        // fondu apparition/disparition (0 = invisible au départ)
    },
    // VERTEX SHADER — tourne 1 fois PAR SOMMET (4×). Place le sommet à l'écran + transmet l'uv.
    vertexShader: `
      varying vec2 vUv;                 // le « pont » vers le fragment shader
      void main() {
        vUv = uv;                       // uv = coordonnée 0..1 du sommet (fournie par la géométrie)
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // FRAGMENT SHADER — tourne 1 fois PAR PIXEL. Décide la couleur. Ici : rouge d'un côté de la
    // diagonale, vert de l'autre → on VOIT les 2 triangles qui composent le carré.
    fragmentShader: `
      varying vec2 vUv;                 // reçoit l'uv INTERPOLÉ pour ce pixel
      uniform vec3 uColor;              // couleur (réglage global depuis le JS)
      uniform float uIntensity;         // intensité > 1 (HDR) → franchit le seuil du bloom
      uniform float uOpacity;           // fondu apparition/disparition (0..1), piloté par le trigger
      void main() {
        // Le DISQUE (leçon 4) : masque plein au centre, nul au bord.
        float d = distance(vUv, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.0, 0.5, d);
        // Leçon 5 — le GLOW : couleur poussée au-delà de 1 ; l'alpha découpe le disque. En
        // AdditiveBlending, cette lumière s'AJOUTE au fond → le bloom s'en empare → néon.
        // Leçon 7 — × uOpacity : le trigger fait apparaître/disparaître la bulle en fondu.
        gl_FragColor = vec4(uColor * uIntensity, alpha * uOpacity);
      }
    `,
  });

  // Le mesh = géométrie (la forme) + matériau (la peinture). C'est LUI l'objet qu'on affiche.
  private mesh = new THREE.Mesh(this.geometry, this.material);
  private camera: THREE.PerspectiveCamera | null = null; // mémorisée pour recalculer le placement

  constructor() {
    this.mesh.renderOrder = 999; // dessiné en DERNIER → passe par-dessus le reste
    // La position ET la taille sont (re)calculées chaque frame par layout() — responsive + fov-proof.
  }

  /**
   * Leçon 7 — le TRIGGER. Appelée à chaque image : on rapproche `uOpacity` de sa cible (1 si un
   * trajet nav joue, 0 sinon) → fondu apparition/disparition. Le facteur k = 1 - e^(-dt/τ) rend le
   * fondu INDÉPENDANT du framerate (τ ≈ 0.2 s = « rapidité » du fondu).
   */
  update(dt: number, active: boolean): void {
    this.layout(); // recalcule position + taille (responsive + fov-proof) à chaque image
    const target = active ? 1 : 0;
    const k = 1 - Math.exp(-dt / 0.2);
    const u = this.material.uniforms['uOpacity'];
    u.value += (target - u.value) * k;
    this.mesh.visible = u.value > 0.002; // perf : ne rien dessiner quand c'est invisible
  }

  /**
   * Place la bulle au point d'ÉCRAN visé (HUD_NDC), à la bonne taille, d'après le fov/ratio COURANTS
   * de la caméra. Comme on repart du NDC chaque frame, la bulle garde la même position + taille à
   * l'écran quel que soit l'écran ET même quand le fov s'anime pendant un trajet.
   */
  private layout(): void {
    const cam = this.camera;
    if (!cam) return;
    // demi-cadre visible à la distance HUD_DIST : hauteur via le fov, largeur via le ratio.
    const halfH = HUD_DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const halfW = halfH * cam.aspect;
    this.mesh.position.set(HUD_NDC.x * halfW, HUD_NDC.y * halfH, -HUD_DIST);
    this.mesh.scale.set(2 * HUD_HALF.x * halfW, 2 * HUD_HALF.y * halfH, 1);
  }

  /**
   * Ancre la bulle en HUD : on la rend ENFANT de la caméra → elle suit la caméra et reste donc FIXE
   * à l'écran, quoi que fasse la scène. Subtilité : un objet n'est rendu que s'il est dans le graphe
   * de la scène ; la caméra n'y étant pas, on l'y ajoute pour que son enfant (le HUD) soit parcouru.
   */
  attachTo(scene: THREE.Scene, camera: THREE.Camera): void {
    this.camera = camera as THREE.PerspectiveCamera; // mémorisée pour layout() (fov/ratio courants)
    if (camera.parent !== scene) scene.add(camera);
    camera.add(this.mesh);
  }

  /** Libère la mémoire GPU (géométrie + matériau ne sont pas nettoyés par le ramasse-miettes JS). */
  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
