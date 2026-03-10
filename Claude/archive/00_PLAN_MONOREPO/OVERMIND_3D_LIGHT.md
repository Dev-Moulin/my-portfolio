# OVERMIND 3D LIGHT — Spécification du package @portfolio/overmind-3d

> Version allégée de l'Overmind 3D, inspirée de `@ofc/overmind-3d` mais sans les features Web3.
> L'oeil se balade, regarde la souris, et maintient une distance minimum variable via un champ de force.

---

## 1. COMPORTEMENT ATTENDU

### 1.1 Description

Un oeil 3D (modèle GLB "Overmind") flotte sur la page en overlay transparent fixe.
Il se déplace de manière autonome avec des mouvements fluides et organiques.
Quand l'utilisateur bouge sa souris, l'oeil le regarde.
Un champ de force empêche l'oeil de s'approcher trop près de la souris — la distance minimum varie.

### 1.2 Comportements détaillés

| Comportement | Description |
|-------------|------------|
| **Vagabondage** | L'oeil se déplace librement dans la page avec des courbes naturelles (Yuka WanderBehaviorXY) |
| **Limites de page** | L'oeil reste dans les limites visibles du viewport avec une répulsion douce (SoftBoundaryBehavior) |
| **Regard souris** | L'oeil tourne pour regarder le curseur de l'utilisateur (InputTracker) |
| **Regard autonome** | Quand la souris est inactive, l'oeil regarde dans sa direction de déplacement (GazeSystem) |
| **Champ de force souris** | L'oeil fuit la souris quand elle s'approche trop — distance minimum variable (MouseRepulsionBehavior) |
| **Bloom/Glow** | L'oeil émet une lueur (post-processing UnrealBloomPass) |
| **Animations du modèle** | Les bras et anneaux du modèle tournent en boucle (AnimationMixer) |

### 1.3 Ce qui n'est PAS inclus (vs @ofc/overmind-3d)

- ❌ Réaction au wallet (WalletBehaviorController)
- ❌ Transitions de page (PageTransitionController)
- ❌ System POI (Points of Interest DOM)
- ❌ Visual Presets multiples (6 situations)
- ❌ PresetInterpolator
- ❌ Blink/Pop (eyelid animations)
- ❌ Revelation (ring reveal)
- ❌ DepthTierSystem (Z-depth tiers)
- ❌ ScrollTracker
- ❌ FpsTracker / PerformanceMachine
- ❌ DevControlPanel

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Stack

| Technologie | Version | Rôle |
|------------|---------|------|
| Three.js | ^0.178.0 | Rendu 3D (WebGL) |
| XState | ^5.22.0 | State machines (orchestration) |
| @xstate/react | ^4.1.3 | Binding React pour XState |
| Yuka | ^0.7.8 | AI Steering behaviors |

### 2.2 Pourquoi Three.js vanilla (pas R3F) ?

Le portfolio actuel utilise R3F (@react-three/fiber). On migre vers Three.js vanilla pour :
1. **Cohérence** avec le monorepo OFC — même pattern, même code réutilisable
2. **Contrôle total** sur la boucle render — pas de couche d'abstraction R3F
3. **Intégration Yuka naturelle** — Yuka update dans animate(), pas via useFrame()
4. **XState direct** — les machines XState subscribe aux changements, pas de hooks intermédiaires
5. **Bundle plus léger** — pas de @react-three/fiber ni @react-three/drei

---

## 3. COMPOSANTS & FICHIERS

### 3.1 OvermindOverlay.tsx — Wrapper React

```tsx
// Overlay plein écran, fixe, transparent, click-through
<div style={{
  position: 'fixed',
  inset: 0,
  zIndex: 10,           // Au-dessus du background, sous le header
  pointerEvents: 'none', // Le HTML en dessous reste cliquable
}}>
  <Suspense fallback={null}>
    <SceneRenderer />
  </Suspense>
</div>
```

**Points clés** :
- `pointer-events: none` — le canvas ne bloque pas les clics
- `z-index: 10` — visible mais sous la navigation (z-index: 50)
- Lazy loading via `React.lazy()` + `Suspense`

### 3.2 SceneRenderer.tsx — Coeur du rendu 3D

Le composant principal qui orchestre tout :

```
┌─────────────────────────────────────────┐
│ SceneRenderer                           │
│                                         │
│  useEffect(() => {                      │
│    // 1. Setup scene, camera, renderer  │
│    // 2. Setup bloom post-processing    │
│    // 3. Load GLB model                 │
│    // 4. Init InputTracker              │
│    // 5. Init Yuka Vehicle + behaviors  │
│    // 6. Init GazeSystem                │
│    // 7. Start animate() loop           │
│  })                                     │
│                                         │
│  animate() {                            │
│    delta = clock.getDelta()             │
│    yukaMgr.update(delta)                │
│    input.update(delta)                  │
│    gaze.update(delta)                   │
│    model.position = yukaVehicle.pos     │
│    model.rotation = blend(input, gaze)  │
│    mixer.update(delta)                  │
│    composer.render()                    │
│  }                                      │
└─────────────────────────────────────────┘
```

### 3.3 sceneSetup.ts — Initialisation de la scène

```typescript
export function createScene(container: HTMLElement) {
  // Scene
  const scene = new THREE.Scene();
  scene.background = null; // Transparent !

  // Camera
  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 100);
  camera.position.set(0, 1.5, 12);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,        // Background transparent
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    0.40,   // strength
    0.15,   // radius
    0.4     // threshold
  );
  composer.addPass(bloomPass);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  const pointLight = new THREE.PointLight(0x00ffff, 1.0, 50);
  pointLight.position.set(0, 2, 5);

  scene.add(ambientLight, directionalLight, pointLight);

  return { scene, camera, renderer, composer, bloomPass };
}
```

**Note** : `scene.background = null` + `renderer alpha: true` = canvas transparent.
L'oeil flotte au-dessus du contenu HTML de la page.

### 3.4 modelLoader.ts — Chargement du modèle

```typescript
export function loadModel(
  scene: THREE.Scene,
  basePath: string,
  onLoaded: (result: ModelLoadResult) => void
) {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(`${basePath}draco/`);
  loader.setDRACOLoader(dracoLoader);

  loader.load(`${basePath}models/V4.2_Overmind.glb`, (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Animation mixer pour les animations permanentes
    const mixer = new THREE.AnimationMixer(model);

    // Lancer les animations en boucle
    gltf.animations.forEach((clip) => {
      // Filtrer : garder bras + anneaux, ignorer Pop (blink)
      if (!clip.name.startsWith('Pop_')) {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
    });

    // Setup matériaux émissifs pour le bloom
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (child.name.includes('Iris') || child.name.includes('Anneaux')) {
          mat.emissive = new THREE.Color(0x00d0fa); // Cyan
          mat.emissiveIntensity = 1.2;
        }
      }
    });

    onLoaded({ model, mixer });
  });
}
```

**Modèle V4.2_Overmind.glb** :
- Meshes : Iris, Anneaux_Eye_Ext, Anneaux_Eye_Int, corps, bras
- Animations : Bras_L1_Mouv, Little_*_Mouv, Anneaux_Eye_*_Action
- Taille : ~11MB (DRACO compressé)

---

## 4. SYSTÈMES DE COMPORTEMENT

### 4.1 InputTracker — Suivi de la souris

**Rôle** : Convertir la position souris en rotations cibles pour l'oeil.

```typescript
class InputTracker {
  targetRotY: number = 0;  // Rotation horizontale cible
  targetRotX: number = 0;  // Rotation verticale cible
  currentRotY: number = 0; // Rotation horizontale actuelle (lerpée)
  currentRotX: number = 0; // Rotation verticale actuelle (lerpée)
  mouseNDC: { x: number, y: number }; // Position souris normalisée (-1 à 1)
  lastMoveTimestamp: number;

  attach() {
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 à +1
      const ny = -(e.clientY / window.innerHeight - 0.5) * 2; // -1 à +1 (inversé Y)
      this.mouseNDC = { x: nx, y: ny };
      this.targetRotY = clamp(nx * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y);
      this.targetRotX = clamp(-ny * MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X);
      this.lastMoveTimestamp = performance.now();
    });
  }

  update(delta: number, lerpFactor: number) {
    this.currentRotY = lerp(this.currentRotY, this.targetRotY, lerpFactor);
    this.currentRotX = lerp(this.currentRotX, this.targetRotX, lerpFactor);
  }
}
```

**Paramètres** :
| Param | Valeur | Description |
|-------|--------|-------------|
| MAX_ROT_Y | π/3 (60°) | Rotation horizontale max |
| MAX_ROT_X | π/6 (30°) | Rotation verticale max |
| mouseDeadZone | 0.1 | Ignore les petits mouvements |
| sensitivity | 0.05 | Vitesse de lerp vers la cible |
| returnSpeed | 0.04 | Vitesse de retour au centre |
| timeout | 3000ms | Temps avant retour au centre |

### 4.2 GazeSystem — Regard autonome

**Rôle** : Quand la souris est inactive, l'oeil regarde dans sa direction de déplacement (Yuka vehicle velocity). Blend progressif entre regard souris et regard autonome.

```typescript
class GazeSystem {
  autonomousRotY: number = 0;
  autonomousRotX: number = 0;
  blendFactor: number = 0; // 0 = full souris, 1 = full autonome

  update(delta, lastMoveTimestamp, yukaVehicle, yukaActive) {
    // Calculer le regard autonome depuis la vélocité Yuka
    if (yukaActive && yukaVehicle) {
      const vel = yukaVehicle.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > 0.01) {
        this.autonomousRotY = Math.atan2(vel.x, 1.0);
        this.autonomousRotX = Math.atan2(-vel.y, 1.0);
      }
    }

    // Blend : si la souris est inactive depuis > timeout → autonome
    const timeSinceMove = performance.now() - lastMoveTimestamp;
    const targetBlend = timeSinceMove > 3000 ? 0.8 : 0.0;
    this.blendFactor = lerp(this.blendFactor, targetBlend, TRANSITION_SPEED * delta);
  }
}
```

**Application dans animate()** :
```typescript
const finalRotY = lerp(input.currentRotY, gaze.autonomousRotY, gaze.blendFactor);
const finalRotX = lerp(input.currentRotX, gaze.autonomousRotX, gaze.blendFactor);
model.rotation.y = BASE_ROT_Y + finalRotY;
model.rotation.x = finalRotX;
```

### 4.3 WanderBehaviorXY — Vagabondage (Yuka)

**Rôle** : L'oeil se déplace avec des trajectoires naturelles et organiques dans le plan XY de l'écran.

**Algorithme** (basé sur Craig Reynolds) :
1. Un "cercle de wander" est projeté devant le véhicule
2. Un point cible se déplace aléatoirement sur ce cercle
3. Le véhicule se dirige vers ce point → courbes fluides

```typescript
class WanderBehaviorXY extends YUKA.SteeringBehavior {
  radius = 1.5;    // Rayon du cercle de wander
  distance = 2.0;  // Distance du cercle devant le véhicule
  jitter = 3.0;    // Perturbation angulaire (rad/s)

  calculate(vehicle, force) {
    // Perturber l'angle cible
    this._targetAngle += (Math.random() - 0.5) * 2 * this.jitter * delta;

    // Point sur le cercle
    const targetX = Math.cos(this._targetAngle) * this.radius;
    const targetY = Math.sin(this._targetAngle) * this.radius;

    // Projeter devant le véhicule
    const ahead = vehicle.velocity.clone().normalize().multiplyScalar(this.distance);
    force.x = ahead.x + targetX - vehicle.position.x;
    force.y = ahead.y + targetY - vehicle.position.y;
    force.z = 0; // Pas de mouvement en Z

    return force;
  }
}
```

**Paramètres Yuka Vehicle** :
| Param | Valeur | Description |
|-------|--------|-------------|
| maxSpeed | 1.7 | Vitesse max |
| maxForce | 5.0 | Budget de force total (wander + boundary + repulsion) |
| mass | 3.0 | Inertie (mouvement fluide) |

### 4.4 SoftBoundaryBehavior — Limites de page (Yuka)

**Rôle** : Empêcher l'oeil de sortir du viewport avec une répulsion douce (pas de mur dur).

```typescript
class SoftBoundaryBehavior extends YUKA.SteeringBehavior {
  bounds = { xMin: -15, xMax: 15, yMin: -5, yMax: 5 };
  margin = 5.0;     // Distance avant que la répulsion commence
  strength = 3.0;   // Force max de répulsion
  weight = 5.0;     // Priorité (poids Yuka)

  calculate(vehicle, force) {
    const pos = vehicle.position;

    // Pour chaque bord : si dans la marge → force de répulsion quadratique
    if (pos.x > this.bounds.xMax - this.margin) {
      const t = (pos.x - (this.bounds.xMax - this.margin)) / this.margin;
      force.x -= t * t * this.strength; // Quadratique = doux au début, fort au bord
    }
    // ... idem pour xMin, yMin, yMax

    return force;
  }
}
```

**Formule quadratique** : `t² × strength`
- t = 0 (bord de la marge) → force = 0
- t = 0.5 (mi-marge) → force = 0.25 × strength
- t = 1 (au bord) → force = strength (max)

### 4.5 MouseRepulsionBehavior — Champ de force souris (NOUVEAU)

**Rôle** : L'oeil fuit la souris quand elle s'approche trop. La distance minimum varie pour un effet plus organique.

```typescript
class MouseRepulsionBehavior extends YUKA.SteeringBehavior {
  baseMinDistance = 3.0;    // Distance minimum de base (unités 3D)
  variationAmplitude = 1.5; // Amplitude de variation (±1.5 unités)
  variationSpeed = 0.3;     // Vitesse de variation (cycles/s)
  strength = 4.0;           // Force de répulsion max
  weight = 3.0;             // Priorité Yuka

  private _time = 0;
  private _mouseWorldPos = new YUKA.Vector3();

  setMousePosition(worldX: number, worldY: number) {
    this._mouseWorldPos.set(worldX, worldY, 0);
  }

  calculate(vehicle, force, delta) {
    this._time += delta;

    // Distance minimum qui varie sinusoïdalement
    const currentMinDist = this.baseMinDistance
      + Math.sin(this._time * this.variationSpeed * Math.PI * 2) * this.variationAmplitude;

    // Distance entre l'oeil et la souris
    const toVehicle = new YUKA.Vector3();
    toVehicle.subVectors(vehicle.position, this._mouseWorldPos);
    toVehicle.z = 0; // Plan XY uniquement
    const distance = toVehicle.length();

    // Si trop proche → repousser
    if (distance < currentMinDist && distance > 0.01) {
      const t = 1.0 - (distance / currentMinDist); // 0 au bord, 1 au centre
      const repulsionForce = t * t * this.strength;  // Quadratique

      toVehicle.normalize();
      force.x += toVehicle.x * repulsionForce;
      force.y += toVehicle.y * repulsionForce;
    }

    return force;
  }
}
```

**Conversion souris → coordonnées 3D** :
```typescript
// Dans animate(), convertir la position NDC de la souris en position monde 3D
const mouseWorld = new THREE.Vector3(
  input.mouseNDC.x * WORLD_HALF_WIDTH,   // NDC (-1,1) → monde (-15, 15)
  input.mouseNDC.y * WORLD_HALF_HEIGHT,  // NDC (-1,1) → monde (-5, 5)
  0
);
mouseRepulsion.setMousePosition(mouseWorld.x, mouseWorld.y);
```

**Paramètres** :
| Param | Valeur | Description |
|-------|--------|-------------|
| baseMinDistance | 3.0 | Distance min de base (unités monde) |
| variationAmplitude | 1.5 | L'oeil s'éloigne entre 1.5 et 4.5 unités |
| variationSpeed | 0.3 | 0.3 cycles/seconde (variation lente, organique) |
| strength | 4.0 | Force de répulsion max |
| weight | 3.0 | Priorité (inférieure aux boundaries) |

**Effet visuel** :
- La souris approche → l'oeil s'écarte doucement
- La distance minimum "pulse" lentement → l'oeil semble respirer / hésiter
- Si la souris poursuit l'oeil → il fuit en gardant la distance
- Si la souris s'éloigne → l'oeil reprend son vagabondage naturel

---

## 5. MACHINES XSTATE (MINIMALES)

### 5.1 applicationMachine — Orchestrateur

Spawn les machines enfants et gère l'état global.

```typescript
const applicationMachine = setup({
  types: {} as {
    context: {
      bloomActor: ActorRefFrom<typeof bloomMachine>;
      lightingActor: ActorRefFrom<typeof lightingMachine>;
      materialActor: ActorRefFrom<typeof materialMachine>;
      modelActor: ActorRefFrom<typeof modelMachine>;
      pbrActor: ActorRefFrom<typeof pbrMachine>;
    };
  },
}).createMachine({
  id: 'application',
  context: ({ spawn }) => ({
    bloomActor: spawn(bloomMachine, { id: 'bloom' }),
    lightingActor: spawn(lightingMachine, { id: 'lighting' }),
    materialActor: spawn(materialMachine, { id: 'material' }),
    modelActor: spawn(modelMachine, { id: 'model' }),
    pbrActor: spawn(pbrMachine, { id: 'pbr' }),
  }),
  initial: 'active',
  states: {
    active: {},
  },
});
```

### 5.2 Machines enfants — Résumé

| Machine | Context | Rôle |
|---------|---------|------|
| **bloomMachine** | `{ threshold: 0.4, strength: 0.4, radius: 0.15 }` | Paramètres bloom |
| **lightingMachine** | `{ ambientIntensity: 0.5, directionalIntensity: 0.8, pointIntensity: 1.0, exposure: 1.0 }` | Éclairage |
| **materialMachine** | `{ irisColor: '#00d0fa', irisIntensity: 1.2, ringsColor: '#00d0fa', ringsIntensity: 1.0 }` | Émissif |
| **modelMachine** | `{ positionY: 1.0, baseRotationY: 0, mouseMaxRotX: π/6, mouseMaxRotY: π/3, sensitivity: 0.05 }` | Modèle |
| **pbrMachine** | `{ metalness: 0.3, roughness: 0.5 }` | Matériaux PBR |

Chaque machine expose des événements `SET_*` pour modifier ses paramètres.

---

## 6. SETUP YUKA COMPLET

```typescript
// Dans SceneRenderer.tsx — setup()
import * as YUKA from 'yuka';

// 1. Créer l'entity manager
const entityManager = new YUKA.EntityManager();

// 2. Créer le véhicule
const vehicle = new YUKA.Vehicle();
vehicle.maxSpeed = 1.7;
vehicle.maxForce = 5.0;   // CRITIQUE : budget total pour tous les behaviors
vehicle.mass = 3.0;
vehicle.position.set(0, 1.5, 0); // Position initiale

// 3. Ajouter les behaviors
const wander = new WanderBehaviorXY(1.5, 2.0, 3.0);
wander.weight = 1.0;
vehicle.steering.add(wander);

const boundary = new SoftBoundaryBehavior(
  { xMin: -15, xMax: 15, yMin: -5, yMax: 5 },
  5.0,  // margin
  3.0   // strength
);
boundary.weight = 5.0; // Priorité haute
vehicle.steering.add(boundary);

const mouseRepulsion = new MouseRepulsionBehavior();
mouseRepulsion.weight = 3.0;
vehicle.steering.add(mouseRepulsion);

// 4. Enregistrer
entityManager.add(vehicle);

// 5. Dans animate()
function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);

  // Mettre à jour la position souris pour le champ de force
  mouseRepulsion.setMousePosition(
    input.mouseNDC.x * 15,  // Conversion NDC → monde
    input.mouseNDC.y * 5
  );

  // Update Yuka (calcule les forces, met à jour la position du véhicule)
  entityManager.update(delta);

  // Appliquer la position Yuka au modèle Three.js
  model.position.set(
    vehicle.position.x,
    vehicle.position.y,
    vehicle.position.z
  );

  // ...
}

// 6. Cleanup
return () => {
  entityManager.clear();
};
```

**Budget maxForce** :
- WanderBehaviorXY utilise ~2.5 de force
- SoftBoundaryBehavior utilise ~2.5 quand actif (près des bords)
- MouseRepulsionBehavior utilise ~4.0 quand actif (souris proche)
- Total max possible : ~9.0, mais rarement tous actifs simultanément
- `maxForce = 5.0` suffit car les behaviors se partagent le budget

---

## 7. BOUCLE ANIMATE COMPLÈTE

```typescript
function animate() {
  animationId = requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033); // Cap à 30fps min

  // 1. Mettre à jour la position souris monde pour le champ de force
  mouseRepulsion.setMousePosition(
    input.mouseNDC.x * WORLD_HALF_WIDTH,
    input.mouseNDC.y * WORLD_HALF_HEIGHT
  );

  // 2. Yuka steering (calcule wander + boundary + mouse repulsion)
  entityManager.update(delta);

  // 3. Input tracking (lerp les rotations vers la cible)
  input.update(delta, modelSettings.sensitivity);

  // 4. Gaze system (blend regard souris ↔ autonome)
  gaze.update(delta, input.lastMoveTimestamp, vehicle, true);

  // 5. Appliquer position Yuka au modèle
  model.position.set(vehicle.position.x, vehicle.position.y, vehicle.position.z);

  // 6. Appliquer rotations (blend input + gaze)
  const finalRotY = THREE.MathUtils.lerp(
    input.currentRotY,
    gaze.autonomousRotY,
    gaze.blendFactor
  );
  const finalRotX = THREE.MathUtils.lerp(
    input.currentRotX,
    gaze.autonomousRotX,
    gaze.blendFactor
  );
  model.rotation.y = modelSettings.baseRotationY + finalRotY;
  model.rotation.x = finalRotX;

  // 7. Animations du modèle (bras, anneaux)
  mixer?.update(delta);

  // 8. Render avec bloom
  composer.render();
}
```

---

## 8. CHECKLIST DE VÉRIFICATION

```
[ ] Le canvas est transparent (on voit le HTML en dessous)
[ ] pointer-events: none — les éléments HTML restent cliquables
[ ] L'oeil se déplace avec des courbes fluides (pas linéaire, pas saccadé)
[ ] L'oeil reste dans les limites du viewport (pas de sortie d'écran)
[ ] L'oeil regarde la souris quand elle bouge
[ ] L'oeil regarde dans sa direction de déplacement quand la souris est inactive
[ ] L'oeil s'écarte de la souris quand elle s'approche trop
[ ] La distance de répulsion varie lentement (effet organique)
[ ] Le bloom/glow fonctionne sur l'iris et les anneaux
[ ] Les animations du modèle tournent (bras, anneaux)
[ ] Pas de freeze ou de saccade (delta cappé à 33ms)
[ ] Le resize de fenêtre met à jour le renderer + camera
[ ] Cleanup correct au unmount (cancelAnimationFrame, removeEventListener, entityManager.clear)
```

---

## 9. PARAMÈTRES AJUSTABLES (référence rapide)

```typescript
// Vehicle
const VEHICLE_MAX_SPEED = 1.7;
const VEHICLE_MAX_FORCE = 5.0;
const VEHICLE_MASS = 3.0;

// Wander
const WANDER_RADIUS = 1.5;
const WANDER_DISTANCE = 2.0;
const WANDER_JITTER = 3.0;

// Boundary
const BOUNDARY_X_RANGE = 15;
const BOUNDARY_Y_MIN = -5;
const BOUNDARY_Y_MAX = 5;
const BOUNDARY_MARGIN = 5.0;
const BOUNDARY_STRENGTH = 3.0;

// Mouse Repulsion
const REPULSION_BASE_DISTANCE = 3.0;
const REPULSION_VARIATION_AMP = 1.5;
const REPULSION_VARIATION_SPEED = 0.3;
const REPULSION_STRENGTH = 4.0;

// Input
const MOUSE_MAX_ROT_Y = Math.PI / 3;  // 60°
const MOUSE_MAX_ROT_X = Math.PI / 6;  // 30°
const MOUSE_SENSITIVITY = 0.05;
const MOUSE_RETURN_SPEED = 0.04;
const MOUSE_TIMEOUT = 3000; // ms

// Gaze
const GAZE_TRANSITION_SPEED = 1.5;
const GAZE_AFK_BLEND = 0.8;

// Bloom
const BLOOM_THRESHOLD = 0.4;
const BLOOM_STRENGTH = 0.40;
const BLOOM_RADIUS = 0.15;

// Material
const EMISSIVE_COLOR = '#00d0fa'; // Cyan
const EMISSIVE_INTENSITY = 1.2;

// Camera
const CAMERA_FOV = 45;
const CAMERA_POSITION = { x: 0, y: 1.5, z: 12 };
```
