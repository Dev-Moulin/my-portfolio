# 03 — Timeline UX — Refonte

## Problèmes actuels

### 1. Navigation verticale impossible
- Beaucoup de pistes mais pas de scroll vertical quand la souris est sur le panneau des noms
- Si on a 10+ pistes, on ne voit pas celles en bas

### 2. Fold/unfold inutile
- Les chevrons ▶/▼ ne servent à rien car les pistes sont déjà compactes
- À retirer

### 3. Durée limitée (~150 frames)
- La timeline s'arrête vers 150 frames, ne lit plus la suite
- Bug à investiguer — `totalFrames` dans la machine timeline

### 4. Rendu visuel trop simple
- On voit uniquement des diamants (losanges) sur les pistes
- Pas le même "feeling" que Blender
- Entre deux keyframes, on ne voit pas visuellement ce qui se passe (maintien de position, interpolation, etc.)
- Blender affiche des barres colorées entre les keyframes pour montrer l'interpolation

### 5. Pistes présentes au démarrage sans rien de défini
- Title, Subtitle, Card, Neon apparaissent au chargement même si rien n'est configuré
- Les pistes devraient être **dynamiques** : apparaissent quand l'élément existe dans la scène
- Piste vide = l'objet existe mais pas encore de keyframes dessus
- Pas d'objet = pas de piste

### 6. Zoom/navigation limités
- On a scroll=zoom et MMB=pan mais c'est à vérifier
- Sur laptop (pas de pavé numérique), certains raccourcis sont inaccessibles
- Besoin de plus d'options de navigation

---

## Recherches effectuées

### [x] Navigation timeline Blender

#### Scroll vertical (voir les pistes en bas)
- **MMB drag vertical** dans la zone principale = pan vertical (défile les canaux)
- **Molette dans la zone des noms** (panneau gauche) = scroll vertical des pistes
- **Scrollbar verticale** (bord droit) = navigation classique
- La molette dans la zone principale = zoom horizontal (pas scroll vertical)

#### Zoom horizontal (temps)
- **Molette** = zoom horizontal centré sur le curseur souris
- **Ctrl+MMB drag** = zoom directionnel (horizontal = temps, vertical = valeurs)
- **Numpad+/-** = zoom in/out
- **Ctrl+B** ou **Shift+B** = box zoom (sélectionner une zone rectangulaire pour zoomer dessus)
- **Pinch trackpad** = zoom horizontal natif

#### Pan horizontal (défilement dans le temps)
- **MMB drag gauche/droite** = pan horizontal
- Pour aller à la frame 500 : taper `500` dans le champ "Current Frame" ou utiliser la scrollbar

#### Zoom-to-fit

| Raccourci | Effet |
|-----------|-------|
| `Home` | View All — cadre tous les keyframes / la plage entière |
| `Numpad.` | View Selected — cadre la sélection |
| `Numpad0` | Recentre sur la frame courante (sans changer le zoom) |

#### Alternatives laptop (sans MMB, sans numpad)
- **Emulate 3 Button Mouse** : `Alt+LMB` = MMB. Conflit avec d'autres raccourcis.
- **Emulate Numpad** : touches 0-9 du clavier principal = numpad (`.` = Numpad., `+/-` = zoom)
- **Trackpad** : scroll 2 doigts vertical (zone noms) = scroll pistes, horizontal = pan temps, pinch = zoom

#### Playhead / frame courante

| Raccourci | Action |
|-----------|--------|
| LMB sur la règle (en haut) | Positionne le playhead |
| LMB hold+drag sur la règle | Scrub continu |
| `→` / `←` | +1 / -1 frame |
| `Shift+→` / `Shift+←` | Sauter à la fin / au début |
| `↑` / `↓` | Keyframe suivant / précédent |
| `Alt+Wheel` | Avancer/reculer d'une frame |
| `Espace` | Play/Pause (Blender 2.8+) |

#### Minimap / vue d'ensemble
- **Blender n'a pas de minimap.** La scrollbar horizontale fait office d'indicateur de position (largeur = ratio visible/total).
- Stratégie pratique : split deux éditeurs — un Dope Sheet zoomé + une Timeline dézoomée (Home) en bas.

---

### [x] Rendu visuel des keyframes Blender

#### Forme des keyframes (avec "Show Handles and Interpolation" actif)

| Forme | Type de handle |
|-------|---------------|
| **Cercle plein** | Auto-Clamped (défaut) |
| **Cercle vide** | Auto |
| **Diamant** (losange pointu) | Free Handle |
| **Losange** | Aligned |
| **Carré** | Vector |

Sans "Show Handles and Interpolation" → tous les keyframes sont des **diamants** uniformes.

#### Couleurs par type de keyframe

| Type | Non-sélectionné | Sélectionné | Taille |
|------|----------------|-------------|--------|
| **Keyframe** (normal) | Orange (#FFAA00) | Blanc-jaune (#FFE080) | ×1.0 |
| **Breakdown** | Cyan (#00CED1) | Cyan clair | ×0.85 |
| **Extreme** | Rose/magenta | Rose clair | ×1.2 |
| **Jitter** | Vert (#2ECC71) | Vert clair | ×0.8 |
| **Moving Hold** | Gris-brun | Proche Keyframe | ×0.925 |

- Sélectionné = couleur plus lumineuse + contour blanc brillant
- Canaux verrouillés = opacité réduite à 25%

#### Segments entre keyframes

| Visuel | Signification |
|--------|--------------|
| **Barre grise** | "Long Keyframe" — deux KF consécutifs avec valeurs identiques (hold) |
| **Barre grise 80% opacité** | Moving Hold bar |
| **Ligne verte fine** | Interpolation Linear |
| **Ligne verte foncée** | Interpolation Constant |
| **Pas de ligne** | Interpolation Bézier (défaut) |

> L'absence de ligne = Bézier. La ligne verte = non-Bézier. Visible uniquement avec "Show Handles and Interpolation" actif.

#### Couleurs de fond des pistes
- Alternance pair/impair avec deux teintes légèrement différentes
- Niveau objet = bleu-gris foncé
- Sous-canaux = légèrement plus clair
- Hauteur fixe (~20px par canal)
- Séparateurs = bordure 1px entre les couleurs alternées

#### Summary Channel
- Piste spéciale en haut, activable via toggle "Summary"
- Agrège TOUS les keyframes visibles : un diamant par frame contenant au moins 1 KF
- Cliquer un diamant Summary = sélectionne tous les KFs à cette frame dans tous les canaux

#### Marqueurs
- Zone dédiée en bas de la timeline
- Forme : petit **triangle** ▲ (vide = non-sélectionné, plein = sélectionné)
- Ligne verticale pointillée traverse toute la hauteur
- Nom affiché à droite du triangle
- Couleur personnalisable

---

### [x] Pistes et organisation Blender

#### Hiérarchie des canaux (4 niveaux)

```
[Bleu foncé]  Objet (Cube, Camera, Light...)
  └─ [Bleu clair]  Action / Shape Key
       └─ [Vert]  Groupe (Channel Group)
            └─ [Gris]  F-Curve individuelle (Location X, Rotation Y...)
```

- **Tous les niveaux sont repliables** (flèche ▶/▼ à gauche)
- Pistes créées **automatiquement** quand on insère un keyframe (I) — jamais manuellement
- Supprimer tous les KFs d'un canal = supprime le canal

#### Icônes par type d'objet

| Type | Icône |
|------|-------|
| Mesh | Cube |
| Light | Ampoule |
| Camera | Caméra |
| Armature | Os |
| Curve | Courbe |

#### Filtrage (bouton entonnoir dans le header)

| Option | Comportement |
|--------|-------------|
| **Only Show Selected** | Affiche UNIQUEMENT les pistes des objets sélectionnés dans le viewport |
| **Always Show Active** | L'objet actif reste toujours visible même si désélectionné |
| **Show Hidden** | Inclut les objets masqués |
| **Filtre par nom** | Correspondance floue sur le nom du canal |
| **Filter by Type** | Icônes cliquables (objets, os, shape keys...) |
| **Sort Data-Blocks** | Tri alphabétique |

> **"Only Show Selected" est le mécanisme central** de filtrage — le Dope Sheet se rafraîchit instantanément à chaque changement de sélection viewport.

#### Icônes de canal (panneau gauche)

| Icône | Nom | Effet |
|-------|-----|-------|
| **Œil** | Visibilité | Masque la courbe dans le Graph Editor (pas la lecture) |
| **Haut-parleur** | Mute | Désactive la lecture de ce canal (Shift+W) |
| **Cadenas** | Lock | Empêche toute modification des keyframes (Tab) |

---

### [x] Actions sur les keyframes

#### Sélection

| Action | Résultat |
|--------|----------|
| Clic gauche | Sélectionner un KF (désélectionne les autres) |
| Shift+Clic | Ajouter/retirer de la sélection |
| B + drag | Box Select |
| C + drag | Circle Select (pinceau) |
| A | Select All |
| Alt+A | Deselect All |
| `[` / `]` | KFs avant/après le playhead |
| Double-clic nom de piste | Tous les KFs du canal |

#### Manipulation

| Raccourci | Action |
|-----------|--------|
| G | Move (déplacer dans le temps) + saisie numérique possible |
| S | Scale (pivot = playhead, pas centre de sélection !) |
| Shift+D | Dupliquer + grab immédiat |
| X / Delete | Supprimer |
| Ctrl+C / Ctrl+V | Copier / Coller au playhead |

> **Important : S utilise le playhead comme pivot**, pas le centre de la sélection.

> **Shift+D passe immédiatement en grab** — pas de confirmation intermédiaire.

#### Interpolation — Touche T

3 catégories dans le menu :

**Base :**
| Type | Comportement |
|------|-------------|
| Constant | Pas d'interpolation, valeur figée jusqu'au KF suivant (escalier) |
| Linear | Vitesse constante, ligne droite |
| Bezier | Accélérations/décélérations fluides avec handles (défaut) |

**Easing (Penner) :** Sine, Quad, Cubic, Quart, Quint, Expo, Circ

**Effets dynamiques :** Back (dépassement), Bounce (rebond), Elastic (ressort)

**Direction d'easing (sous-menu) :** Auto, Ease In, Ease Out, Ease In Out

> **T s'applique au segment SORTANT** du keyframe (pas au segment entrant).

#### Handle Type — Touche V

| Type | Forme DS | Comportement |
|------|----------|-------------|
| Auto Clamped | Cercle plein | Auto sans dépassement (défaut) |
| Auto | Cercle vide | Auto avec dépassement possible |
| Aligned | Losange | Handles colinéaires, longueurs indépendantes |
| Vector | Carré | Pointe vers voisin (transitions linéaires) |
| Free | Diamant | Handles totalement indépendants |

---

### [x] Lien sélection viewport ↔ timeline

#### Sélectionner un objet dans le viewport → timeline
- **Sans filtre** : le Dope Sheet affiche TOUS les objets animés. Sélectionner un objet ne scrolle PAS auto vers sa piste. Pas de highlight fort.
- **Avec "Only Show Selected"** : le DS se rafraîchit instantanément. Seules les pistes de l'objet sélectionné apparaissent.
- **Pas d'auto-scroll** : c'est une limitation connue de Blender.

#### Sélectionner un keyframe dans la timeline → viewport
- Cliquer un KF dans le Dope Sheet **ne sélectionne PAS** l'objet dans le viewport.
- Cliquer un KF **ne déplace PAS** le playhead.

#### Cliquer sur le nom de la piste
- Clic gauche = sélectionne le canal dans le DS, **mais PAS l'objet dans le viewport** (sélection interne DS).
- Double-clic = sélectionne tous les KFs du canal.
- La sélection channel list est **indépendante** de la sélection 3D viewport.

> **La synchro viewport ↔ DS est à sens unique** pour les objets : viewport → DS (via "Only Show Selected"). Pas de DS → viewport.

---

## Comportement souhaité pour notre app

### Navigation
1. **Scroll vertical** sur la zone des noms de pistes (molette ou drag)
2. **Scroll=zoom horizontal**, MMB=pan horizontal (déjà implémenté)
3. **Home** = zoom-to-fit toute la timeline
4. **Numpad.** ou double-clic = zoom sur la sélection
5. Playhead : clic sur la règle, flèches ←/→, Shift+flèche = début/fin

### Rendu visuel
1. **Retirer fold/unfold** (chevrons ▶/▼) — nos pistes sont plates, pas hiérarchiques
2. **Barres colorées entre KFs** pour montrer l'interpolation :
   - Pas de barre = Bézier (défaut)
   - Ligne verte = Linear
   - Ligne verte foncée = Constant
   - Barre grise = Hold (valeurs identiques)
3. **Forme des KFs** selon le handle type (si "Show Handles" actif)
4. **Couleurs KF** : orange (non-sélectionné), blanc-jaune (sélectionné)

### Pistes
1. **Pistes dynamiques** — apparaissent quand l'objet existe dans la scène
2. **Pas d'objet = pas de piste** (supprime Title, Subtitle, Card, Neon au démarrage)
3. **"Only Show Selected"** comme filtre principal (bouton toggle)
4. **Durée illimitée** — fix du bug 150 frames

### Lien sélection ↔ timeline
1. **Sélectionner un objet** → sa piste est highlight dans la timeline
2. Optionnel : scroll auto vers la piste si pas visible
3. **"Only Show Selected"** comme mode par défaut (plus propre que highlight)

---

## Notes de l'utilisateur

> "Si tu veux pour les recherches approfondies je peux en faire un peu aussi comme ça tu aurais plus de source et de contexte à croiser"

L'utilisateur propose de faire des recherches de son côté sur le fonctionnement de la timeline Blender. Les résultats seront croisés avec les recherches automatiques pour un meilleur contexte.

---

## Complexité : Élevée
