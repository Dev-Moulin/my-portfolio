import * as THREE from 'three';

// ── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  active: boolean;
  emitterIdx: number;
  templateIdx: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
}

interface Emitter {
  position: THREE.Vector3;       // world position of circle center
  rotation: THREE.Quaternion;    // world rotation (transforms local plane to world)
  normal: THREE.Vector3;         // pre-computed: (0,0,1) applied by rotation
  radius: number;                // world-space radius
}

interface ParticleConfig {
  maxParticles: number;
  spawnRate: number;       // particles per second
  speed: number;           // units per second
  maxDistance: number;      // recycle distance from emitter
  spreadAngle: number;     // cone dispersion in radians
}

const DEFAULT_CONFIG: ParticleConfig = {
  maxParticles: 50,
  spawnRate: 3,
  speed: 20,
  maxDistance: 300,
  spreadAngle: 0,
};

// Emitter names to use (only 4 circles in V2_Cam)
const EMITTER_NAMES = new Set([
  'Circle001', 'Circle002', 'Circle003', 'Circle004',
]);

// Circles whose normals are flipped in Blender — invert the emission direction
const FLIPPED_EMITTERS = new Set([
  'Circle003', 'Circle004',
]);

// Mini ship templates are far off to the side (X < -200)
function isMiniShipTemplate(child: THREE.Object3D): boolean {
  if (!(child as THREE.Mesh).isMesh) return false;
  const name = child.name;
  // Cube_gameasset, Cube.001_gameasset etc. or Plane_gameasset, Plane.001_gameasset etc.
  return (name.startsWith('Cube') && name.endsWith('_gameasset')) ||
         (name.startsWith('Plane') && name.endsWith('_gameasset'));
}

// ── Temp vectors (avoid per-frame allocations) ──────────────────────────────

const _tempPos = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _tempMat = new THREE.Matrix4();
const _tempQuat = new THREE.Quaternion();
const _forward = new THREE.Vector3(0, 0, -1);

// ── Class ────────────────────────────────────────────────────────────────────

export class MiniShipParticleSystem {
  private emitters: Emitter[] = [];
  private templates: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private instancedMeshes: THREE.InstancedMesh[] = [];
  private particles: Particle[] = [];
  private config: ParticleConfig;
  private scene: THREE.Scene;
  private spawnAccumulator = 0;

  constructor(model: THREE.Object3D, scene: THREE.Scene, config?: Partial<ParticleConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Force world matrix update so getWorldPosition / matrixWorld are valid
    model.updateMatrixWorld(true);

    // ── Extract emitters and templates from model ─────────────────────────
    model.traverse((child) => {
      // Emitters: Circle nodes
      if (EMITTER_NAMES.has(child.name) && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // World position (use node's world position now that origins are correct in Blender)
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        // World rotation (orientation of the disc plane)
        const worldQuat = new THREE.Quaternion();
        mesh.getWorldQuaternion(worldQuat);

        // Normal = local +Z applied by world rotation (Blender circle: XY plane, normal +Z local)
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
        if (FLIPPED_EMITTERS.has(child.name)) normal.negate();

        // Radius from bounding sphere * world scale
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        const worldScale = new THREE.Vector3();
        mesh.getWorldScale(worldScale);
        const radius = mesh.geometry.boundingSphere!.radius * worldScale.x;

        this.emitters.push({ position: worldPos, rotation: worldQuat, normal, radius });
        mesh.visible = false;
        return;
      }

      // Templates: mini ship meshes
      if (isMiniShipTemplate(child)) {
        const mesh = child as THREE.Mesh;
        this.templates.push({
          geometry: mesh.geometry,
          material: mesh.material,
        });
        mesh.visible = false; // hide original
      }
    });

    // Also hide Circle.005
    model.traverse((child) => {
      if (child.name === 'Circle005') {
        child.visible = false;
      }
    });

    if (this.emitters.length === 0 || this.templates.length === 0) {
      console.warn('[MiniShipParticles] No emitters or templates found');
      return;
    }

    // ── Create InstancedMesh per template ─────────────────────────────────
    const maxPerTemplate = Math.ceil(this.config.maxParticles / this.templates.length) + 5;

    for (const tmpl of this.templates) {
      const im = new THREE.InstancedMesh(tmpl.geometry, tmpl.material, maxPerTemplate);
      im.count = 0; // start with 0 visible instances
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.instancedMeshes.push(im);
    }

    // ── Pre-allocate particle pool ────────────────────────────────────────
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.particles.push({
        active: false,
        emitterIdx: 0,
        templateIdx: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
      });
    }
  }

  // ── Update (called every frame) ─────────────────────────────────────────

  update(delta: number): void {
    if (this.emitters.length === 0 || this.templates.length === 0) return;

    // 1. SPAWN
    this.spawnAccumulator += delta * this.config.spawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnParticle();
    }

    // 2. UPDATE positions
    for (const p of this.particles) {
      if (!p.active) continue;
      p.position.addScaledVector(p.velocity, delta);
      p.age += delta;

      // Check distance from emitter
      const emitter = this.emitters[p.emitterIdx];
      const dist = p.position.distanceTo(emitter.position);
      if (dist > this.config.maxDistance) {
        p.active = false;
      }
    }

    // 3. RENDER — rebuild instance matrices per template
    // Count per template
    const counts = new Array<number>(this.templates.length).fill(0);

    for (const p of this.particles) {
      if (!p.active) continue;
      const idx = counts[p.templateIdx];
      const im = this.instancedMeshes[p.templateIdx];
      if (!im || idx >= im.instanceMatrix.count) continue;

      // Build matrix: position + rotation toward velocity
      _tempDir.copy(p.velocity).normalize();
      _tempQuat.setFromUnitVectors(_forward, _tempDir);
      _tempMat.compose(p.position, _tempQuat, _tempPos.set(0.5, 0.5, 0.5));
      im.setMatrixAt(idx, _tempMat);

      counts[p.templateIdx]++;
    }

    // Update counts and flag for GPU upload
    for (let i = 0; i < this.instancedMeshes.length; i++) {
      const im = this.instancedMeshes[i];
      im.count = counts[i];
      if (counts[i] > 0) {
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ── Spawn a single particle ─────────────────────────────────────────────

  private spawnParticle(): void {
    // Find an inactive slot
    const p = this.particles.find(p => !p.active);
    if (!p) return; // pool full

    // Random emitter and template
    p.emitterIdx = Math.floor(Math.random() * this.emitters.length);
    p.templateIdx = Math.floor(Math.random() * this.templates.length);
    p.age = 0;
    p.active = true;

    const emitter = this.emitters[p.emitterIdx];

    // Random point in local disc (XY plane, circle is at +Z normal in local)
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * emitter.radius; // sqrt for uniform distribution
    const localOffset = _tempPos.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    // Transform local offset to world by emitter rotation, then add world position
    localOffset.applyQuaternion(emitter.rotation);
    p.position.copy(emitter.position).add(localOffset);

    // Velocity: along emitter normal + random spread
    const spread = this.config.spreadAngle;
    _tempDir.copy(emitter.normal);
    if (spread > 0) {
      _tempDir.x += (Math.random() - 0.5) * spread * 2;
      _tempDir.y += (Math.random() - 0.5) * spread * 2;
      _tempDir.z += (Math.random() - 0.5) * spread * 2;
      _tempDir.normalize();
    }

    p.velocity.copy(_tempDir).multiplyScalar(this.config.speed);
  }

  // ── Dispose ─────────────────────────────────────────────────────────────

  dispose(): void {
    for (const im of this.instancedMeshes) {
      this.scene.remove(im);
      im.dispose();
    }
    this.instancedMeshes = [];
    this.particles = [];
    this.emitters = [];
    this.templates = [];
  }
}
