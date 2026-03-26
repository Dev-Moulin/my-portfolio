# 19 — Particle System (Mini Ships)

## Concept

Des mini vaisseaux spatiaux spawn en continu depuis des cercles emetteurs autour du vaisseau principal et partent dans la direction de la normale du cercle. Quand ils sont trop loin, ils respawn.

C'est un systeme d'**instanced mesh particles** inspire du Particle System Blender avec "Render As: Collection".

---

## Donnees du GLB (Spaceship_V1_Assetify3.glb)

### Emetteurs (6 circles)

| Node | Nom | Position | Normal direction |
|------|-----|----------|-----------------|
| 0 | Circle | (5.7, 15.2, 215.0) | rot -90X → normale vers +Z (avant) |
| 1 | Circle.001 | (-7.0, -14.6, -186.9) | rot +90X → normale vers -Z (arriere) |
| 2 | Circle.002 | (16.0, 2.4, -186.9) | rot +90X → normale vers -Z (arriere) |
| 3 | Circle.003 | (-16.1, -0.5, 215.0) | rot -90X → normale vers +Z (avant) |
| 4 | Circle.004 | (9.9, -12.8, 215.0) | rot -90X → normale vers +Z (avant) |
| 6 | Circle.006 | (-10.2, 12.6, -186.9) | rot +90X → normale vers -Z (arriere) |

**Circle.005 (node 5) : a supprimer/ignorer** (meme position que Circle, doublon)

3 circles a l'avant (Z ~215) → vaisseaux partent vers +Z
3 circles a l'arriere (Z ~-187) → vaisseaux partent vers -Z

### Templates Mini Ships (11 mesh)

| Node | Nom | Type |
|------|-----|------|
| 17 | Cube_gameasset | vaisseau |
| 18 | Cube.001_gameasset | vaisseau |
| 19 | Cube.002_gameasset | vaisseau |
| 20 | Cube.004_gameasset | vaisseau |
| 21 | Plane_gameasset | vaisseau |
| 22 | Plane.001_gameasset | vaisseau |
| 23 | Plane.002_gameasset | vaisseau |
| 24 | Plane.003_gameasset | vaisseau |
| 25 | Plane.004_gameasset | vaisseau |
| 26 | Plane.005_gameasset | vaisseau |
| 27 | Plane.006_gameasset | vaisseau |

Tous positionnes loin (~-240, 83, 30) = hors champ. Doivent etre **invisibles** (templates seulement).

---

## Architecture

### Fichier: `packages/overmind-3d/src/scene/miniShipParticles.ts`

```typescript
interface Particle {
  emitterIndex: number;      // quel circle l'a spawn
  templateIndex: number;     // quel mini ship mesh
  position: Vector3;         // position courante
  velocity: Vector3;         // direction * speed
  age: number;               // temps ecoule depuis spawn
  maxAge: number;            // duree de vie (= distance / speed)
}

class MiniShipParticleSystem {
  // Emetteurs (positions + normales extraites des circles)
  emitters: { position: Vector3; normal: Vector3 }[];

  // Templates (geometries + materials extraits des mini ships)
  templates: { geometry: BufferGeometry; material: Material }[];

  // InstancedMesh par template (1 InstancedMesh = N instances du meme mesh)
  instancedMeshes: InstancedMesh[];

  // Pool de particules actives
  particles: Particle[];

  // Config
  maxParticles: number;      // 200
  spawnRate: number;         // particules/seconde
  speed: number;             // unites/seconde
  maxDistance: number;        // distance avant recycling (configurable)
  spreadAngle: number;       // cone de dispersion autour de la normale
}
```

### Fonctionnement

1. **Init** : apres chargement du GLB, parcourir les nodes :
   - Circles → extraire position + calculer normale depuis la rotation
   - Mini Ships → extraire geometry + material, cacher le mesh original
   - Creer un `InstancedMesh` par template (max ~20 instances par template)

2. **Spawn** (chaque frame) :
   - Si `particles.length < maxParticles`, spawn de nouvelles particules
   - Choisir un emetteur aleatoire parmi les 6
   - Choisir un template aleatoire parmi les 11
   - Position = centre du cercle + offset aleatoire dans le rayon du cercle
   - Velocity = normale du cercle * speed + petite dispersion aleatoire
   - Orienter le vaisseau dans la direction de la velocity

3. **Update** (chaque frame) :
   - Pour chaque particule : `position += velocity * delta`
   - `age += delta`
   - Si `age > maxAge` (ou distance > maxDistance) → recycler (respawn)
   - Mettre a jour la matrice de l'InstancedMesh correspondant

4. **InstancedMesh** :
   - 1 InstancedMesh par template mesh (11 au total)
   - Chaque InstancedMesh a un count = nombre de particules actives de ce type
   - `instancedMesh.setMatrixAt(index, matrix)` chaque frame
   - `instancedMesh.instanceMatrix.needsUpdate = true`

### Performance (200 particules)

- 11 draw calls (1 par template) au lieu de 200
- Pas d'allocation par frame (pool pre-alloue)
- Matrices mises a jour en batch
- 200 particules = tres leger pour un GPU moderne

---

## Parametres configurables

| Param | Default | Description |
|-------|---------|-------------|
| maxParticles | 200 | Nombre max de vaisseaux actifs |
| spawnRate | 15/s | Vaisseaux spawnes par seconde |
| speed | 50 | Vitesse de deplacement (unites/s) |
| maxDistance | 300 | Distance avant recyclage |
| spreadAngle | 0.15 rad (~8 deg) | Cone de dispersion |
| scale | 1.0 | Scale des mini vaisseaux |

Le `maxDistance` est le parametre principal a regler visuellement.

---

## Integration dans SceneRenderer

```typescript
// Apres chargement du GLB Spaceship_V1_Assetify3
import { MiniShipParticleSystem } from './miniShipParticles.ts';

const particleSystem = new MiniShipParticleSystem(model, scene, {
  maxParticles: 200,
  spawnRate: 15,
  speed: 50,
  maxDistance: 300,
});

// Dans l'animation loop
particleSystem.update(delta);

// Cleanup
particleSystem.dispose();
```

---

## Phases d'implementation

### Phase A — Extraction des donnees du GLB
- [ ] Parcourir le modele charge pour trouver les circles (emetteurs)
- [ ] Extraire position + calculer direction normale depuis la rotation
- [ ] Trouver les Mini Ships, extraire geometry + material
- [ ] Cacher les mesh originaux (visible = false)
- [ ] Cacher/supprimer Circle.005

### Phase B — InstancedMesh setup
- [ ] Creer 1 InstancedMesh par template mesh
- [ ] Pre-allouer le pool de particules (200 slots)
- [ ] Ajouter les InstancedMesh a la scene

### Phase C — Spawn + Update loop
- [ ] Logique de spawn (rate, emetteur aleatoire, template aleatoire)
- [ ] Position initiale dans le rayon du cercle
- [ ] Velocity = normale * speed + dispersion
- [ ] Orientation du vaisseau dans la direction du mouvement
- [ ] Update position chaque frame
- [ ] Recyclage quand maxDistance atteint
- [ ] Mise a jour des matrices InstancedMesh

### Phase D — Integration
- [ ] Brancher dans SceneRenderer (init + animation loop + dispose)
- [ ] Verifier la performance (pas de GC spikes)

### Phase E — Reglages
- [ ] Exposer maxDistance dans le DevPanel ou via config
- [ ] Ajuster speed, spawnRate, spreadAngle visuellement
