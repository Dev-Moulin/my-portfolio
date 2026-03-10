# Phase D — Floating Origin

> **STATUT : BROUILLON — À DISCUTER**

## Objectif

Permettre une scène de grande échelle (petits et grands objets) en gardant la caméra proche de l'origine pour éviter les problèmes de précision float. Le monde bouge autour de la caméra, pas l'inverse.

## Le problème sans floating origin

Avec une PerspectiveCamera classique qui se déplace :
- Au-delà de ~1000 unités de l'origine, les flottants 32 bits perdent en précision
- Résultat : jittering (tremblement) des objets, z-fighting (faces qui clignotent)
- Impossible d'avoir à la fois des détails très fins (0.001 unités) et un monde très grand (10000+ unités)

## Le principe

```
CLASSIQUE :
  Camera se déplace de (0,0,0) vers (500, 0, 800)
  Les objets restent fixes

FLOATING ORIGIN :
  Camera reste à (0, 0, 0) (ou proche)
  Quand la "position logique" de la caméra est (500, 0, 800),
  tous les objets sont décalés de (-500, 0, -800)
```

## Points à discuter

### 1. Échelle cible
- Quelle est la taille de scène souhaitée ?
- Quels types d'objets petits / grands ?
- Est-ce que chaque "section" du portfolio serait une zone distante, ou tout est concentré ?

### 2. Seuil de rebasing
- À quelle distance rebase-t-on ? (ex: tous les 100 unités ? 500 ?)
- Ou en continu (chaque frame le monde est recentré) ?

### 3. Impact sur les systèmes existants
- **Camera Keyframes** : stockent des positions absolues (monde). Le système doit convertir en positions relatives
- **ScrollText / Card / Neon** : positionnés en absolu actuellement. Doivent recevoir l'offset
- **Steering (Yuka)** : le véhicule se déplace en espace monde. Il faut synchroniser avec l'offset
- **SelectionSystem** : le raycaster fonctionne en espace local de la scène. L'offset affecte les coordonnées
- **CSS3DRenderer** : le rendu CSS3D doit aussi être offset

### 4. Approches possibles

**A — World container (simple)**
```
scene
  └── worldContainer (THREE.Group)
       ├── eye model
       ├── text objects
       ├── cards
       └── all other objects

// Chaque frame :
worldContainer.position.set(-camX, -camY, -camZ);
// La caméra reste à (0, 0, 0)
```
- Avantage : simple, un seul offset à gérer
- Inconvénient : TOUS les objets sont enfants du container, y compris les lights, helpers, etc.

**B — Offset par système (flexible)**
```
// Chaque système applique l'offset individuellement
textSystem.setWorldOffset(offset);
cardSystem.setWorldOffset(offset);
steeringSystem.setWorldOffset(offset);
```
- Avantage : contrôle fin, certains objets (grille, axes) peuvent rester fixes
- Inconvénient : plus de code, chaque système doit le supporter

**C — Rebase périodique (jeux AAA)**
```
// Quand la caméra s'éloigne trop :
if (camera.position.length() > THRESHOLD) {
  const offset = camera.position.clone();
  camera.position.set(0, 0, 0);
  // Déplacer TOUS les objets de -offset
  scene.traverse(obj => obj.position.sub(offset));
}
```
- Avantage : transparent pour tous les systèmes
- Inconvénient : "saut" de coordonnées, complexe avec la physique/réseau

### 5. Stockage des positions
- Les keyframes stockent des positions MONDE (absolues)
- Le DevPanel affiche des positions MONDE
- Seul le rendu utilise des positions LOCALES (relatives à l'origine flottante)
- Il faut un système de conversion : `worldToLocal(pos)` et `localToWorld(pos)`

## TODO — Questions ouvertes

- [ ] Définir l'échelle cible exacte
- [ ] Choisir l'approche (A, B ou C)
- [ ] Lister tous les systèmes impactés
- [ ] Déterminer si le CSS3DRenderer pose problème
- [ ] Tester si le near/far étendu (Phase A) suffit sans floating origin

## Dépendances

- Phase A (near/far/FOV) : tester si élargir le far suffit pour nos besoins
- Phase B (Free View) : indispensable pour debug le floating origin
- Phase C (PIP) : le PIP montre la position "monde" vs la position "locale"
