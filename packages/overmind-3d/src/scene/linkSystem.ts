import * as THREE from 'three';

/**
 * LinkSystem — rend cliquables les logos réseaux + textes démo (Card1/2/3).
 *
 * - Glow bleu LÉGER au repos sur les 6 éléments, RENFORCÉ (bloom) au survol.
 * - Clic → ouvre l'URL. Écoute en CAPTURE (priorité sur CardClickSystem en bubble) :
 *   sur un hit lien, stopPropagation → la carte n'entre/sort pas du mode lecture.
 * - Les 2 TEXTES reçoivent une BOÎTE DE CLIC INVISIBLE auto-générée (bounding box + marge)
 *   comme cible de raycast (clic plus facile qu'une géo de lettres) ; le glow reste sur le
 *   vrai texte. Les logos sont raycastés en direct.
 * - Matériaux CLONÉS par mesh (Logo_Gris partagé) → glow isolé par lien.
 */

const LINKS: Record<string, string> = {
  Logo_GitHub: 'https://github.com/Dev-Moulin',
  Logo_X: 'https://x.com/Dev_FullPoulpe',
  Logo_LinkedIn: 'https://linkedin.com/in/DevMoulin',
  // Gmail : préfixe copy: → clic = COPIE l'adresse (+ toast « Adresse copiée ») au lieu d'ouvrir
  // un client mail (décision Paul : personne n'a de client mailto configuré, la copie sert plus).
  Logo_Gmail: 'copy:p.moulin.95@gmail.com',
  Logo_Download: '/cv.pdf', // CV : même glow hover + clic que les liens réseaux
  Texte_DemoTestnet: 'https://dev-moulin.github.io/Overmind_Founders_Collection/',
  Texte_DemoLive: 'https://overmind.intuition.box/',
  CardE_Logo_GitHub: 'https://github.com/intuition-box/Extension', // Card E — repo de l'extension Chrome
  CardE_Logo_YouTube: 'https://www.youtube.com/watch?v=YJwcXQ3oAWY', // Card E — vidéo démo (GLB V3.1)
};
// Éléments qui reçoivent une boîte de clic invisible (au lieu d'un raycast géométrie)
const PROXY_LINKS = new Set(['Texte_DemoLive', 'Texte_DemoTestnet']);

const GLOW_COLOR = new THREE.Color(0x2a9dff);  // bleu
// Logos réseaux = surfaces pleines : le bloom les capte bien → intensités modérées.
const IDLE_INTENSITY = 1.2;    // glow permanent au repos
const HOVER_INTENSITY = 1.6;   // glow renforcé au survol
// Textes démo/testnet = géométries FINES (traits de lettres). Le bloom capte beaucoup moins une
// ligne fine (pixels de bord antialiasés = demi-luminance) qu'une surface pleine → à émissif ÉGAL
// ils paraissent éteints. Matériaux pourtant identiques aux logos (diag : base #898989, pas
// d'emissiveMap) → seule la géométrie diffère. On compense par un émissif dédié plus fort.
const TEXT_IDLE_INTENSITY = 1.5;    // repos textes (≈ ce que Paul a dû monter à la main)
const TEXT_HOVER_INTENSITY = 2.1;   // survol textes : au-dessus de l'idle pour un renfort visible

interface LinkEntry {
  name: string;                // nom GLB de l'élément (pour le highlight onboarding)
  url: string;
  meshes: THREE.Mesh[];        // meshes visuels (glow)
  picks: THREE.Object3D[];     // cibles de raycast (proxy pour textes, meshes pour logos)
  proxy: THREE.Mesh | null;    // boîte invisible (textes)
  baseColor: THREE.Color[];    // fallback matériaux sans émissif
  idleI: number;               // émissif au repos (textes fins boostés vs logos pleins)
  hoverI: number;              // émissif au survol
}

export class LinkSystem {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private entries: LinkEntry[] = [];
  private allPicks: THREE.Object3D[] = [];
  private hovered: LinkEntry | null = null;

  private boundMove: (e: PointerEvent) => void;
  private boundDown: (e: PointerEvent) => void;

  constructor(model: THREE.Object3D, camera: THREE.Camera, renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.camera = camera;
    this.domElement = renderer.domElement;
    this.scene = scene;
    model.updateWorldMatrix(true, false);

    const find = (name: string) =>
      model.getObjectByName(name) ?? model.getObjectByName(name.replace(/\./g, '')) ?? null;

    for (const [name, url] of Object.entries(LINKS)) {
      const root = find(name);
      if (!root) { console.warn(`[links] ${name} introuvable`); continue; }
      const meshes: THREE.Mesh[] = [];
      const baseColor: THREE.Color[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material)
          ? m.material.map((mm) => mm.clone())
          : (m.material as THREE.Material).clone();
        meshes.push(m);
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        baseColor.push(mat.color ? mat.color.clone() : new THREE.Color(0xffffff));
      });
      if (!meshes.length) continue;

      // Boîte de clic invisible pour les textes (AABB monde + marge)
      let proxy: THREE.Mesh | null = null;
      let picks: THREE.Object3D[] = meshes;
      if (PROXY_LINKS.has(name)) {
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        proxy = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(size.x * 1.2, 0.5), Math.max(size.y * 1.5, 0.5), Math.max(size.z * 1.5, 1.0)),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        proxy.position.copy(center);
        proxy.name = `${name}_clickbox`;
        this.scene.add(proxy);
        picks = [proxy];
      }

      const isText = PROXY_LINKS.has(name);
      const entry: LinkEntry = {
        name, url, meshes, picks, proxy, baseColor,
        idleI: isText ? TEXT_IDLE_INTENSITY : IDLE_INTENSITY,
        hoverI: isText ? TEXT_HOVER_INTENSITY : HOVER_INTENSITY,
      };
      this.entries.push(entry);
      this.allPicks.push(...picks);
      this.applyGlow(entry, false); // glow permanent au repos (intensité par-lien)
    }

    this.boundMove = (e) => this.onMove(e);
    this.boundDown = (e) => this.onDown(e);
    window.addEventListener('pointermove', this.boundMove);
    window.addEventListener('pointerdown', this.boundDown, true); // capture → priorité cartes
    console.log(`[links] ${this.entries.length} liens cliquables (${this.allPicks.length} cibles)`);
  }

  private updateNDC(e: PointerEvent): void {
    const r = this.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(): LinkEntry | null {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.allPicks, false);
    if (!hits.length) return null;
    const hit = hits[0].object;
    return this.entries.find((e) => e.picks.includes(hit)) ?? null;
  }

  private onMove(e: PointerEvent): void {
    this.updateNDC(e);
    const entry = this.pick();
    if (entry === this.hovered) return;
    if (this.hovered) this.applyGlow(this.hovered, false);
    this.hovered = entry;
    if (entry) this.applyGlow(entry, true);
    document.body.style.cursor = entry ? 'pointer' : '';
  }

  private onDown(e: PointerEvent): void {
    this.updateNDC(e);
    const entry = this.pick();
    if (!entry) return;
    e.stopPropagation(); // empêche CardClickSystem de réagir au même clic
    if (entry.url.startsWith('copy:')) {
      this.copyToClipboard(entry.url.slice(5));
      return;
    }
    window.open(entry.url, '_blank', 'noopener');
  }

  /** Copie `text` dans le presse-papier + toast de confirmation. Fallback : mailto (comportement
   *  historique) si l'API clipboard est refusée (vieux navigateur / permission). */
  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.showToast(document.documentElement.lang === 'en' ? 'Address copied' : 'Adresse copiée'),
      () => window.open(`mailto:${text}`, '_blank', 'noopener'),
    );
  }

  /** Petit toast auto-destructeur (2 s), raccord univers holo (sombre + halo cyan). */
  private showToast(message: string): void {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      top: '14%',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 22px',
      background: 'rgba(4, 10, 16, 0.88)',
      color: '#ffffff',
      border: '1px solid rgba(0, 229, 255, 0.55)',
      borderRadius: '6px',
      boxShadow: '0 0 18px 2px rgba(0, 229, 255, 0.35)',
      fontFamily: 'monospace',
      fontSize: '15px',
      letterSpacing: '1.5px',
      zIndex: '9999',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    el.animate(
      [
        { opacity: 0, transform: 'translateX(-50%) translateY(-8px)' },
        { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.12 },
        { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.82 },
        { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' },
      ],
      { duration: 2000, easing: 'ease-in-out' },
    ).onfinish = () => el.remove();
  }

  /** Glow : repos (léger) ou survol (renforcé). S'applique aux meshes visuels. */
  private applyGlow(entry: LinkEntry, hover: boolean): void {
    const intensity = hover ? entry.hoverI : entry.idleI;
    entry.meshes.forEach((m, i) => {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        const mat = mm as THREE.MeshStandardMaterial;
        if (mat.emissive) {
          mat.emissive.copy(GLOW_COLOR);
          mat.emissiveIntensity = intensity;
        } else if ((mat as unknown as { color?: THREE.Color }).color) {
          // Matériau sans émissif : on teinte (pas de glow au repos)
          (mat as unknown as { color: THREE.Color }).color.copy(hover ? GLOW_COLOR : entry.baseColor[i]);
        }
      }
    });
  }

  /** Onboarding : force le glow d'un sous-ensemble de liens (par nom GLB) à `intensity` (pulse).
   *  Les liens non listés reviennent au repos. names=null → tous au repos. */
  setHighlight(names: string[] | null, intensity: number): void {
    for (const e of this.entries) {
      const on = names !== null && names.includes(e.name);
      const value = on ? intensity : e.idleI;
      for (const m of e.meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) {
          const mat = mm as THREE.MeshStandardMaterial;
          if (mat.emissive) { mat.emissive.copy(GLOW_COLOR); mat.emissiveIntensity = value; }
        }
      }
    }
  }

  dispose(): void {
    if (this.hovered) this.applyGlow(this.hovered, false);
    this.hovered = null;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', this.boundMove);
    window.removeEventListener('pointerdown', this.boundDown, true);
    for (const e of this.entries) {
      if (e.proxy) {
        e.proxy.removeFromParent();
        e.proxy.geometry.dispose();
        (e.proxy.material as THREE.Material).dispose();
      }
    }
  }
}
