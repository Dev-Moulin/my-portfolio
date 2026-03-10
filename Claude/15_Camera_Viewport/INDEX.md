# Plan Caméra, Viewport & Scène

## Vue d'ensemble

Ce plan couvre 4 phases pour améliorer le système de caméra, ajouter un mini viewport debug, et préparer l'architecture pour une scène de grande échelle.

## Phases

| Phase | Nom | Statut | Fichier |
|-------|-----|--------|---------|
| A | Contrôles Caméra (near/far/FOV) | À faire | [Phase_A_Camera_Controls.md](Phase_A_Camera_Controls.md) |
| B | Vue Libre + Toggle (touche 0) | À faire | [Phase_B_Free_Camera.md](Phase_B_Free_Camera.md) |
| C | Mini Viewport Debug (PIP) | À faire | [Phase_C_Mini_Viewport.md](Phase_C_Mini_Viewport.md) |
| D | Floating Origin | À discuter | [Phase_D_Floating_Origin.md](Phase_D_Floating_Origin.md) |

## Ordre d'implémentation

**A → B → C → D** — chaque phase bénéficie de la précédente :
- **A** donne le contrôle du frustum (FOV, near, far)
- **B** donne la vue libre pour inspecter la scène + CameraHelper (frustum wireframe)
- **C** donne le mini viewport PIP pour se repérer (2 tailles : S et L)
- **D** permet d'agrandir la scène sans limites (floating origin)

## Contexte technique actuel

- **Canvas** : plein écran (`window.innerWidth × innerHeight`)
- **Caméra** : PerspectiveCamera, FOV 45°, near 0.1, far 100
- **Position initiale** : `(0, 1.5, 12)`, lookAt `(0, 1, 0)`
- **Zone visible** (à z=0) : ~18 × 10 unités (écran 16:9)
- **Fichier setup** : `packages/overmind-3d/src/scene/sceneSetup.ts`

## Discussions en cours

- **Phase D** : l'approche floating origin n'est PAS overkill — l'échelle devrait permettre des objets très petits ET très grands. À discuter en détail.

## Archive

Les anciens plans (phases 1-14) sont dans le dossier `archive/`.
