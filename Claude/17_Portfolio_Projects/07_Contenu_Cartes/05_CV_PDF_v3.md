# CV PDF — Version 3

## COLONNE GAUCHE

### Contact
p.moulin.95@gmail.com
github.com/Dev-Moulin
linkedin.com/in/DevMoulin
@Dev_FullPoulpe

### Compétences techniques

**Frontend**
React 19 · TypeScript · Tailwind CSS

**3D / WebGL**
Three.js · Blender · Shaders GLSL · GLTF

**Web3**
wagmi · viem · RainbowKit · INTUITION Protocol

**Backend**
Ruby on Rails 8 · Node.js · PostgreSQL

**Architecture**
XState · Monorepo pnpm

**Outils**
Git · Docker · Vite · Plasmo · GitHub Actions · Claude Code

### Langues
Français — natif
Anglais — lecture technique

### Formation

**The Hacking Project**
Développeur Fullstack
RNCP 37805 Niveau 5
Front-end · Back-end · Framework avancé
(Blocs 1, 2, 3)
*Sept 2024 – Mai 2025*

**Three.js Journey**
Formation WebGL/3D

**Blender**
Modélisation 3D — autodidacte

### Compétitions
Base Batch Europe
Artizen Fund S6
ETH Global Cannes 2025

---

## COLONNE DROITE

# PAUL MOULIN
**Développeur Full-Stack — Web3 & 3D Interactive**

### Profil

Développeur web fullstack, formé chez The Hacking Project (RNCP 5) après 12 ans en tant que géomètre-topographe. Compétences en React, TypeScript, Ruby on Rails, avec une appétence pour la 3D interactive (Three.js, Blender) et les technologies Web3. À l'aise en équipe comme en autonomie — mes projets personnels démontrent ma capacité à concevoir et livrer des applications complètes seul.

---

### Projets

**Overmind Founders Collection** · Solo · *Nov 2025*
Application décentralisée permettant à la communauté INTUITION de voter collectivement pour attribuer des totems symboliques aux 42 fondateurs du protocole. Les votes sont pondérés via des bonding curves en tokens $TRUST, et chaque action produit des données structurées (Atoms, Triples) qui enrichissent le Knowledge Graph d'Intuition.
- Conçu l'architecture complète du frontend (React 19, Apollo GraphQL) avec un système de subscriptions WebSocket pour afficher les votes en temps réel
- Développé un carrousel CSS 3D permettant de naviguer visuellement parmi les 42 fondateurs, avec flip progressif au survol et dock alphabétique pour un accès rapide
- Implémenté un système de batch transactions permettant aux utilisateurs de voter sur plusieurs fondateurs en une seule opération blockchain
- *React 19 · TypeScript · Vite · Tailwind v4 · wagmi · viem · RainbowKit · Apollo GraphQL · INTUITION Protocol*
- [Demo](https://dev-moulin.github.io/Overmind_Founders_Collection/) · [GitHub](https://github.com/Dev-Moulin/Overmind_Founders_Collection)

**Overmind 3D** · Solo · *Août 2025*
Contrôleur de scène 3D temps réel pour un œil robotique modélisé sur Blender. L'objectif : intégrer ce modèle dans l'extension Chrome Intuition pour qu'il réagisse visuellement aux événements — iris rouge sur un site scam, vert sur un site approuvé, animations différentes selon le contexte.
- Architecturé un système de 9 machines à états (XState) indépendantes qui se partagent la gestion du bloom, de l'éclairage, des matériaux PBR et des animations, en communiquant entre elles par événements
- Intégré des animations Blender (NLA) jouées dynamiquement avec transitions fluides et un système de clignement de paupières procédural à timing aléatoire
- Développé un panneau de contrôle à 8 onglets permettant d'ajuster chaque aspect du rendu en direct (bloom, lumières, matériaux, effets, performance)
- *React 19 · Three.js · XState · Blender · GLTF/DRACO · UnrealBloomPass · PBR*
- [Demo](https://intuition-box.github.io/Overmind/) · [GitHub](https://github.com/intuition-box/Overmind)

**CoinTribe** · Équipe de 5 · *Déc 2024 · 11 jours*
Plateforme communautaire crypto développée en projet de fin de formation THP. Les utilisateurs votent Bullish ou Bearish sur des cryptomonnaies, suivent les cours via des graphiques candlestick mis à jour en temps réel par WebSocket Binance, et configurent des alertes email quand un prix franchit un seuil.
- Mis en place l'authentification complète (Devise) et le déploiement production (Heroku, SMTP Mailjet)
- Développé un filtre de modération multilingue qui sanitize automatiquement les posts et commentaires côté serveur et alerte l'utilisateur côté client
- Rédigé l'ensemble des pages légales (CGU, politique de confidentialité, FAQ — ~600 lignes de contenu)
- *Ruby on Rails 8 · PostgreSQL · Hotwire · Binance WebSocket · CoinMarketCap API · Mailjet*
- [GitHub](https://github.com/DevFullstackCo/CoinTribe)

---

### Expérience professionnelle

**Développeur Web3 — Stage THP × Protocole Intuition**
*Mars – Juillet 2025 · Équipe de 6 · Mentor : Jérémie Olivier*

Extension Chrome de confiance décentralisée dans le cadre d'un partenariat entre l'école THP et l'équipe du protocole Intuition. L'extension affiche un indicateur visuel sur chaque page web visitée — rouge si le site est signalé comme scam, vert s'il est approuvé par la communauté — en s'appuyant sur des attestations on-chain.

- Créé un modèle 3D d'œil robotique (Blender) et son intégration complète dans l'extension (Three.js, shaders GLSL custom pour l'iris, bloom sélectif) — donnant à l'extension son identité visuelle distinctive
- Développé un système de particules dual avec un groupe interactif qui réagit aux mouvements de souris par attraction gravitationnelle, et un fond de particules connectées
- Conçu une navigation en arc (NavArc) — les icônes de navigation sont disposées sur un demi-cercle animé, offrant une alternative originale à la navbar classique
- Mis en place le système de theming dark/light avec des variables OKLCH et un ThemeProvider React
- [GitHub](https://github.com/intuition-box/Extension)

---

### Parcours précédent

**Géomètre-topographe** — 12 ans
Mesures de précision, relevés 3D (scanner Faro), implantations, AutoCAD/Covadis
