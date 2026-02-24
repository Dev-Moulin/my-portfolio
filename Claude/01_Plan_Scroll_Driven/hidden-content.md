# Contenu HTML masqué — Inventaire complet

Ce fichier documente tous les composants HTML de l'application web qui sont masqués
pour laisser place à l'expérience 3D scroll-driven. Rien n'est supprimé, tout est
caché via la classe CSS `hide-html-content` sur `<body>`.

Toggle : DevControlPanel > bouton "Hide HTML"

---

## 1. Home — Section héro + Skills

**Fichier** : `apps/web/src/components/home/Home.tsx`
**Rendu dans** : `App.tsx` > `<main>` > `<Home />`

**Contenu** :
- Section `#home` (vide — titre/sous-titre sont dans le canvas 3D)
- Section `#skills` contenant :
  - Titre h2 "My Technical Skills" (i18n : `home.skills`)
  - `<LogoWall />` (voir point 2)
  - `<HomeWallSkill />` (voir point 3)

---

## 2. LogoWall — Mur de logos technologies

**Fichier** : `apps/web/src/components/home/LogoWall.tsx`
**Rendu dans** : `Home.tsx` > section `#skills`

**Contenu** :
- Défilement infini horizontal (animation CSS `scroll-x`)
- 18 logos technologies : Vue, React, TypeScript, JavaScript, Python, Solidity, HTML5, CSS3, Tailwind, Node.js, GraphQL, MongoDB, PostgreSQL, Firebase, Docker, Git, Figma, Three.js
- Chaque logo : icône SVG (react-icons) + label texte
- Dupliqué 2x pour l'effet boucle infinie

---

## 3. HomeWallSkill — Grille de compétences avec accordéon

**Fichier** : `apps/web/src/components/home/HomeWallSkill.tsx`
**Style** : `apps/web/src/styles/components/homeWallSkill.css`
**Rendu dans** : `Home.tsx` > section `#skills`

**Contenu** :
- 5 catégories de compétences (accordéon framer-motion) :
  1. **Programming** : TypeScript, JavaScript, Python, Solidity, Rust, C
  2. **Front-end** : React, Vue.js, Next.js, Tailwind CSS, SCSS, Framer Motion
  3. **Back-end** : Node.js, Express, NestJS, GraphQL, REST API, PostgreSQL, MongoDB, Firebase, Prisma
  4. **Tools** : Git, Docker, AWS, Vercel, Figma, VS Code
  5. **3D & Creative** : Three.js, React Three Fiber, Blender, GLSL Shaders, WebXR
- Chaque tech : icône SVG inline + nom + barre de niveau (%)
- Animation expand/collapse avec `AnimatePresence`

---

## 4. Projects — Projets, Hackathons, Formations

**Fichier** : `apps/web/src/components/projects/Projects.tsx`
**Rendu dans** : `App.tsx` > `<main>` > `<Projects />`

**Contenu** :

### Section "My Projects" (`#projects`)
- **Intuition Chrome Extension** : Extension Chrome Web3 pour knowledge graph décentralisé. Stack : React, TypeScript, Blockchain. Lien GitHub.
- **CoinTribe** : Plateforme communautaire crypto. Stack : Next.js, Node.js, MongoDB. Lien GitHub.

### Section "Hackathons"
- **Base Batch** (Coinbase) : Batch processing blockchain. Stack : Solidity, TypeScript.
- **Artizen** : Plateforme art NFT. Stack : React, Solidity.
- **ETH Cannes** : Projet hackathon ETH. Stack : Solidity, React.

### Section "Training"
- **THP (The Hacking Project)** : Formation fullstack intensive.
- **Three.js Journey** : Formation 3D web par Bruno Simon.
- **Blender Guru** : Formation modélisation 3D.

---

## 5. Contact — Coordonnées et liens sociaux

**Fichier** : `apps/web/src/components/contact/Contact.tsx`
**Rendu dans** : `App.tsx` > `<main>` > `<Contact />`

**Contenu** :
- Section `#contact`
- Titre h2 "Get In Touch" (i18n : `contact.title`)
- Sous-titre (i18n : `contact.subtitle`)
- 3 cartes info :
  - **Email** : paulmoulin.music@gmail.com
  - **Location** : Paris, France
  - **Social** : GitHub, LinkedIn, Twitter (mêmes liens que Footer)
- Bouton CTA "Send Message" (mailto)

---

## 6. Footer — Pied de page

**Fichier** : `apps/web/src/components/Layout/Footer.tsx`
**Style** : `apps/web/src/styles/components/footer.css`
**Rendu dans** : `Layout.tsx` (après `{children}`)

**Contenu** :
- Background `LetterGlitch` (animation de texte glitch)
- Grille 3 colonnes :
  - **Info** : Titre, sous-titre, description (i18n `footer.*`)
  - **Navigation** : Liens vers Home, Projects, About, Skills, Contact
  - **Social** : GitHub, LinkedIn, Twitter (icônes SVG)
- Copyright en bas

---

## Structure de rendu (App.tsx)

```
App.tsx
├── AccentColorProvider
│   ├── ScrollProgressEmitter (invisible)
│   ├── OvermindOverlay (canvas 3D + DevControlPanel) ← NON MASQUÉ
│   └── Layout
│       ├── NavArc ← NON MASQUÉ
│       ├── main.container
│       │   ├── Home ← MASQUÉ
│       │   │   ├── section#home (vide)
│       │   │   └── section#skills
│       │   │       ├── LogoWall ← MASQUÉ
│       │   │       └── HomeWallSkill ← MASQUÉ
│       │   ├── Projects ← MASQUÉ
│       │   └── Contact ← MASQUÉ
│       └── Footer ← MASQUÉ
```

**Non masqué** : OvermindOverlay (canvas Three.js, DevControlPanel), NavArc, ScrollProgressEmitter
