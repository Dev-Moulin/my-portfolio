# Carte 2 — Overmind 3D

**Titre :** Overmind 3D

**Tagline :** Contrôleur de scène 3D temps réel — œil robotique piloté par 9 machines à états concurrentes

**Image/GIF :** *(le modèle Overmind sera visible à côté de la carte dans la scène)*

---

## Description

J'ai modélisé un œil robotique sur Blender avec l'objectif de l'intégrer dans l'extension Chrome Intuition. L'idée : l'œil réagit en temps réel à ce que fait l'utilisateur — couleur de l'iris rouge si la page est un scam, verte si elle est approuvée, animations et effets de bloom différents selon le contexte.

Pour pouvoir contrôler chaque aspect du rendu dans le navigateur (bloom, éclairage, matériaux PBR, animations), j'ai construit une architecture où 9 machines XState indépendantes se partagent le travail et communiquent entre elles par événements. Un panneau de contrôle à 8 onglets permet d'ajuster tout en direct.

Le système gère des animations Blender (NLA) jouées dynamiquement, un clignement de paupières procédural avec timing aléatoire, et un système de révélation par zones trigger 3D.

---

## Mon rôle
Développeur unique + modélisation 3D Blender

## Tech
React 19 · TypeScript · Three.js · XState (Actor Model) · Blender · GLTF/DRACO · UnrealBloomPass · PBR · ACES Filmic · HDR · Vite · Jest · GitHub Actions

## Team
Solo

## Liens
- [Demo Live](https://intuition-box.github.io/Overmind/)
- [GitHub](https://github.com/intuition-box/Overmind)
