# Recherche : Opérateurs Modaux G (Grab), R (Rotate), S (Scale)

## 1. Pattern Modal Commun G/R/S

### 1.1 Déclenchement

Les trois opérateurs sont déclenchés par un **appui unique** sur la touche (G, R ou S). Ce n'est **pas** un maintien — on appuie et on relâche. L'opérateur entre alors en mode modal (`RUNNING_MODAL`) et capture tous les événements jusqu'à confirmation ou annulation.

Techniquement :
- L'appui sur G/R/S invoque la fonction `invoke()` de l'opérateur
- `invoke()` retourne `{'RUNNING_MODAL'}`, ce qui démarre la boucle modale
- La fonction `modal()` est alors appelée **à chaque nouvel événement** (mouvement souris, appui touche, etc.)
- Quand aucun événement n'est détecté, l'opérateur modal **ne s'exécute pas** (event-driven)

### 1.2 Interprétation du mouvement souris

Chaque mode utilise un **mode d'input souris** (`MouseInput`) différent :

| Mode | Input souris | Interprétation |
|------|-------------|----------------|
| **G (Grab)** | Position absolue 2D | Delta souris 2D → delta position 3D (projeté sur un plan aligné à la vue) |
| **R (Rotate)** | Angle (`InputAngle`) | Angle entre vecteur pivot→souris_initiale et pivot→souris_courante |
| **S (Scale)** | Ratio horizontal (`InputHorizontalRatio`) | Ratio = distance(pivot, souris_courante) / distance(pivot, souris_initiale) |

### 1.3 Confirmation et Annulation

| Action | Raccourci |
|--------|-----------|
| **Confirmer** | Clic gauche (LMB) ou Enter |
| **Annuler** | Clic droit (RMB) ou Escape |

À l'annulation, le système effectue un **rollback** complet : les valeurs initiales sauvegardées dans `TransData` et `TransDataExtension` sont restaurées. L'objet revient exactement à son état pré-transformation.

### 1.4 Saisie numérique au clavier

Pendant n'importe quel mode modal, on peut **taper un nombre au clavier** pour entrer une valeur précise :
- **G puis 5** → déplacement de 5 unités Blender (dans la direction contrainte)
- **R puis 45** → rotation de 45 degrés
- **S puis 2** → scale de facteur 2
- Les valeurs négatives sont possibles (ex: **R puis -90**)
- Enter ou LMB pour confirmer la valeur tapée

### 1.5 Affichage dans le header

Pendant toute transformation modale, les **valeurs en temps réel** sont affichées dans le footer/header du viewport 3D :
- **G** : affiche le delta X, Y, Z en unités Blender
- **R** : affiche l'angle en degrés
- **S** : affiche le facteur de scale

Cet affichage est géré par la fonction `headerPrint()` appelée dans la boucle d'action de chaque mode.

---

## 2. Spécificités de G (Grab/Move)

### 2.1 Conversion souris 2D → mouvement 3D

Le mouvement souris 2D est converti en mouvement 3D par **projection sur un plan aligné à la vue** (screen-aligned plane) :

- Le plan de projection passe par le **centre de l'objet** (ou le point pivot)
- Ce plan est **perpendiculaire à la direction de vue** (view direction)
- Le rayon de la souris est intersecté avec ce plan pour obtenir une position 3D
- Le **delta** entre la position 3D initiale et courante donne le vecteur de déplacement

En résumé : **on déplace l'objet dans le plan de l'écran uniquement**. L'objet suit le curseur souris projeté sur ce plan.

La documentation officielle confirme : *"The selected object or element then moves freely according to the mouse pointer's location and camera"* et *"you can move the object in the plane of the screen only"*.

Note importante : **la distance entre le pointeur souris et l'objet n'a pas d'effet** — c'est le delta de mouvement qui est utilisé, pas la position absolue du curseur par rapport à l'objet.

### 2.2 Unités

Le déplacement est en **unités Blender** (Blender Units, BU), pas en pixels écran. La correspondance pixel→BU dépend du **niveau de zoom** du viewport : plus on est zoomé, plus un pixel représente une petite distance en BU.

### 2.3 Mode Précision (Shift maintenu)

Maintenir **Shift** pendant le déplacement active le mode précision :
- Le mouvement est **divisé par 10** : de grands déplacements de la souris ne produisent que de petits déplacements de l'objet
- Ce n'est **pas** un incrément fixe — c'est une réduction continue de la sensibilité
- Permet un positionnement très fin sans dépendre de valeurs discrètes

### 2.4 Mode Snap (Ctrl maintenu)

Maintenir **Ctrl** active le snapping par incrément :
- Au **zoom par défaut** : incréments de **1 BU**
- En zoomant suffisamment (jusqu'à voir les lignes grises suivantes) : incréments de **0.1 BU**
- Le zoom détermine l'incrément : chaque niveau de zoom divise l'incrément par 10

### 2.5 Précision + Snap combinés (Shift + Ctrl)

- Incréments de **1/10e** de l'incrément normal
- Au zoom par défaut : **0.1 BU**
- À n'importe quel zoom : toujours 1/10e de ce que donnerait Ctrl seul

---

## 3. Spécificités de R (Rotate)

### 3.1 Calcul de l'angle

L'angle est calculé à partir du **pivot point projeté en 2D** :
1. Le centre pivot (3D) est projeté en coordonnées écran 2D
2. Un vecteur est tracé du pivot 2D vers la **position souris initiale** (au moment de l'appui R)
3. Un second vecteur est tracé du pivot 2D vers la **position souris courante**
4. L'**angle entre ces deux vecteurs** donne la rotation à appliquer

Visuellement : c'est comme si on tournait une aiguille de montre autour du pivot. Plus on est loin du pivot, plus le mouvement angulaire est **précis** (le même déplacement en pixels couvre un plus petit angle).

### 3.2 Axe de rotation par défaut

L'axe de rotation par défaut est l'**axe perpendiculaire à la vue** (view axis / Z-axis de l'espace écran). C'est-à-dire que l'objet tourne "dans le plan de l'écran", exactement comme on tournerait un objet posé sur une table vue de dessus.

On peut contraindre à un axe spécifique en appuyant X, Y ou Z pendant la rotation.

### 3.3 Mode Trackball (R R — double tap)

Appuyer **R deux fois** active le mode **Trackball** :
- C'est un mode de **rotation libre** sans contrainte d'axe
- La rotation est calculée comme un **axe+angle unique** basé sur la position souris initiale et finale
- Le mouvement horizontal de la souris tourne autour de l'axe Y de la vue
- Le mouvement vertical tourne autour de l'axe X de la vue
- Les deux se combinent pour une rotation libre dans toutes les directions

**Limitations connues du Trackball** :
- Au-delà de **180 degrés**, le comportement devient erratique
- Si la souris bouge tangentiellement par rapport à la direction de rotation souhaitée, les résultats sont **peu intuitifs**
- La rotation est calculée uniquement entre position initiale et finale (pas le chemin parcouru), ce qui rend le résultat dépendant du point d'arrivée, pas du trajet

Note : Le double-tap pour trackball est **hard-codé** dans le code de vérification d'événements de rotation (pas configurable via keymap classique).

### 3.4 Affichage des degrés

Pendant la rotation, **l'angle en degrés** est affiché en temps réel dans le header/footer du viewport 3D.

### 3.5 Snap à incréments (Ctrl)

- **Ctrl maintenu** : snap à **5 degrés** d'incrément
- **Ctrl + Shift** : snap à **1 degré** d'incrément

Ces incréments sont personnalisables dans Blender 4.2+ via le menu déroulant de snapping (deux valeurs : régulière et précise).

---

## 4. Spécificités de S (Scale)

### 4.1 Calcul du ratio

Le ratio de scale est calculé ainsi :
1. Le **pivot point** est projeté en coordonnées écran 2D
2. La **distance initiale** = distance(pivot_2D, souris_au_moment_de_S)
3. La **distance courante** = distance(pivot_2D, souris_courante)
4. **Ratio = distance_courante / distance_initiale**

Conséquence : éloigner la souris du pivot **agrandit**, rapprocher la souris du pivot **rétrécit**.

Note technique : le mode d'input souris utilisé est `InputHorizontalRatio`, qui extrait un facteur depuis le mouvement.

### 4.2 Influence du Pivot Point

Le pivot point est **fondamental** pour le scale :
- **Median Point** : scale depuis le centre de la sélection
- **3D Cursor** : scale depuis la position du curseur 3D
- **Individual Origins** : chaque objet scale depuis son propre centre
- **Active Element** : scale depuis le centre de l'élément actif

Tous les points de la sélection sont déplacés **en s'éloignant** (agrandissement) ou **en se rapprochant** (réduction) du pivot point sélectionné.

### 4.3 Scale négatif (miroir)

Si la souris **traverse le pivot point** et passe de l'autre côté :
- Le scale continue dans la direction **négative**
- L'élément est **retourné/mirroré** (flip)
- Ex: scale -1 sur X = miroir sur l'axe X

**Attention** : le scale négatif avec des objets **déjà pivotés** peut donner des résultats inattendus et incohérents. C'est un problème connu de Blender, surtout visible quand on scale depuis le curseur 3D.

Après un scale négatif, il est recommandé d'**appliquer la transformation** (Object → Apply → All Transforms) pour éviter des artefacts de normales inversées.

### 4.4 Scale uniforme vs non-uniforme

- **Scale uniforme** (défaut, appui S seul) : le facteur est appliqué **identiquement sur les 3 axes** (X, Y, Z)
- **Scale non-uniforme** : contraindre à un axe avec X, Y ou Z après S
  - **S puis X** : scale uniquement sur X
  - **S puis Shift+X** : scale sur Y et Z (exclusion de X)
  - **S puis MMB** : détection automatique de l'axe le plus proche du mouvement souris

### 4.5 Snap et Précision pour le Scale

- **Ctrl maintenu** : incréments de **0.1** (facteur)
- **Shift maintenu** : précision (1/10e de la sensibilité)
- **Ctrl + Shift** : incréments de **0.01**

---

## 5. Caméra/Viewport pendant les modes modaux

### 5.1 Navigation viewport pendant G/R/S

Depuis Blender 4.0+ : la navigation viewport est **possible** pendant une transformation modale, mais avec un modificateur :

- **Alt + MMB** : orbiter (rotation de la vue)
- **Alt + Scroll** : zoomer
- **Alt + Shift + MMB** : pan (déplacement de la vue)

Sans Alt, le **MMB est redirigé** vers la détection automatique de contrainte d'axe (pas vers la navigation).

### 5.2 Redirection du MMB

Pendant un mode modal G/R/S, le bouton du milieu de la souris (MMB) a un comportement **redirigé** :
- **MMB seul** : détection automatique de l'axe le plus proche du mouvement souris → contrainte d'axe
- **Shift + MMB** : contrainte au **plan** (au lieu de l'axe)
- Le MMB ne fait **plus** d'orbite viewport (sauf avec Alt)

Ce comportement est **hard-codé** et n'apparaît pas dans l'éditeur de keymap sous "Modal Transform".

### 5.3 Versions antérieures à Blender 4.0

Avant Blender 4.0, la navigation viewport était **complètement désactivée** pendant les transformations modales. Il fallait annuler (Escape/RMB) la transformation, naviguer, puis relancer la transformation.

---

## 6. Interactions entre G/R/S

### 6.1 Peut-on passer de G à R pendant un mode modal ?

**Non.** On ne peut **pas** passer directement d'un mode modal à un autre. Il faut :
1. **Confirmer** (Enter/LMB) ou **annuler** (Escape/RMB) la transformation en cours
2. Puis appuyer sur la nouvelle touche (R, S, etc.)

Les modes G, R et S sont des opérateurs modaux **mutuellement exclusifs**. Ils capturent tous les événements clavier, donc un appui sur R pendant un G serait interprété comme autre chose (ou ignoré), pas comme un changement de mode.

### 6.2 Workflow typique

Le workflow attendu est séquentiel :
1. G → déplacer → Enter (confirmer)
2. R → pivoter → Enter (confirmer)
3. S → scaler → Enter (confirmer)

Ou avec annulation :
1. G → déplacer → Escape (annuler, retour à l'état initial)
2. R → pivoter → etc.

---

## 7. Implémentation technique (code source C)

### 7.1 Structures de données principales

Définies dans `source/blender/include/transform.h` :

```
TransInfo
├── Flags globaux de transformation
├── Mode courant (translate/rotate/resize)
├── Pointeur de fonction vers le mode actuel
├── Position souris initiale et courante
├── État de la vue 3D
├── Données de snapping (TransSnap)
├── Données de saisie numérique (NumInput)
└── Collection de TransData[]

TransData (1 par élément sélectionné)
├── Position initiale sauvegardée (loc)
├── Autres propriétés initiales
├── Facteur de proportional editing
└── TransDataExtension (optionnel)
    ├── Rotation initiale (pour objets)
    ├── Taille initiale (pour objets)
    └── Quaternion initial (si mode quat)

TransData2D (pour les éléments 2D)
└── Utilisé pour flush vers les données 2D
```

### 7.2 Le moteur partagé

Les 3 modes (G/R/S) partagent **le même moteur de transformation** :
- Même structure `TransInfo`
- Mêmes structures `TransData` / `TransDataExtension`
- Même boucle d'événements modale
- Même système de contraintes d'axe
- Même système de snapping et de saisie numérique

La seule différence est le **pointeur de fonction** (`t->transform`) qui est assigné lors de l'initialisation du mode :
- `applyTranslation` pour G
- `applyRotation` pour R
- `applyResize` pour S

### 7.3 Cycle de vie d'un opérateur modal transform

```
1. INVOKE (appui sur G/R/S)
   ├── initTransform(mode, context)
   │   ├── Setup global (position souris, orientation vue)
   │   ├── Flags spécifiques au mode
   │   ├── Création des TransData (extraction sélection → TransData)
   │   │   └── SAUVEGARDE des valeurs initiales (pour rollback)
   │   ├── Init du moteur de snapping
   │   ├── Calcul des facteurs de proportional editing
   │   ├── Calcul du centre de transformation (pivot)
   │   └── Init mode (pointeur de fonction, gears/steps, restrictions NumInput)
   └── Retourne RUNNING_MODAL

2. MODAL LOOP (à chaque événement)
   ├── Vérifier position souris (redraw si changée)
   ├── Poll événements UI
   │   ├── Dispatch vers NumInput (saisie clavier)
   │   ├── Dispatch vers Snapping
   │   ├── Dispatch vers Constraints (X/Y/Z, MMB)
   │   ├── Shift → toggle précision
   │   └── Ctrl → toggle snap
   ├── Appeler la fonction de mode (applyTranslation/applyRotation/applyResize)
   │   ├── Extraire valeur depuis l'input souris (InputHorizontalAbsolute/InputAngle/InputHorizontalRatio)
   │   ├── Snap aux incréments (gears)
   │   ├── Appliquer NumInput si actif
   │   ├── Appliquer la transformation à tous les TransData
   │   ├── recalcData() → flush vers données Blender
   │   ├── headerPrint() → affichage dans le header
   │   └── viewRedrawForce() → rafraîchissement écran
   └── Retourne RUNNING_MODAL

3. FINALIZATION
   ├── Si CONFIRM (LMB/Enter) :
   │   ├── Conserver les modifications
   │   ├── Push undo state
   │   ├── Auto-keyframe si activé
   │   └── Libérer les structures TransData
   ├── Si CANCEL (RMB/Escape) :
   │   ├── ROLLBACK : restaurer depuis TransData + TransDataExtension
   │   ├── recalcData() → flush données originales
   │   └── Libérer les structures TransData
   └── Retourne FINISHED ou CANCELLED
```

### 7.4 Modes d'input souris

Chaque mode de transformation utilise un mode d'input souris spécifique, initialisé via `initMouseInputMode()` :

| Mode transform | Mouse input | Description |
|---------------|------------|-------------|
| Translate (G) | `InputHorizontalAbsolute` / `InputVerticalAbsolute` | Delta de position absolue de la souris, converti en coordonnées 3D via la matrice de vue |
| Rotate (R) | `InputAngle` | Angle entre deux vecteurs depuis le centre pivot projeté en 2D |
| Trackball (R R) | `InputTrackBall` | Décomposition du mouvement souris en deux rotations orthogonales |
| Scale (S) | `InputHorizontalRatio` | Ratio de distance depuis le pivot projeté en 2D |

### 7.5 Mécanisme de rollback

Le rollback est garanti par la sauvegarde des valeurs initiales :

1. **Lors de la création des TransData** : chaque propriété transformable est copiée dans le TransData correspondant (position initiale, rotation initiale, scale initial)
2. **Si l'état est CANCEL** : le moteur parcourt tous les TransData et **restaure les valeurs initiales** depuis les copies sauvegardées
3. Pour les objets, `TransDataExtension` contient les infos supplémentaires (rotation, taille) nécessaires au rollback complet
4. Après rollback, `recalcData()` est appelé pour flusher les données originales vers le système Blender

---

## 8. Résumé des raccourcis pendant un mode modal

| Raccourci | Effet |
|-----------|-------|
| **LMB / Enter** | Confirmer la transformation |
| **RMB / Escape** | Annuler (rollback) |
| **X / Y / Z** | Contraindre à un axe (1 appui = global, 2 appuis = local) |
| **Shift + X/Y/Z** | Contraindre au plan (exclure un axe) |
| **MMB** | Détection auto d'axe (direction du mouvement souris) |
| **Shift** | Mode précision (1/10e de sensibilité) |
| **Ctrl** | Mode snap (incréments fixes) |
| **Shift + Ctrl** | Snap précis (1/10e des incréments) |
| **Alt + MMB** | Navigation viewport (orbit) — Blender 4.0+ |
| **Chiffres** | Saisie numérique directe |
| **Tab** (pendant saisie) | Passer au champ suivant (X→Y→Z) |
| **R** (pendant R) | Passer en mode Trackball |
| **B** | Définir un nouveau point de base pour le snap |
| **A** | Ajouter un point de snap (si snap actif) |

---

## Sources

- [Blender 5.0 Manual — Rotate](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/rotate.html)
- [Blender 5.0 Manual — Scale](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/scale.html)
- [Blender 5.0 Manual — Precision](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/precision.html)
- [Blender 5.0 Manual — Axis Locking](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/axis_locking.html)
- [Blender 4.0 Manual — Transform Modal Map](https://docs.blender.org/manual/en/4.0/modeling/transform/modal_map.html)
- [Blender 2.81 Manual — Basic Transformations](https://docs.blender.org/manual/en/2.81/scene_layout/object/editing/transform/basics.html)
- [Blender Developer Docs — Transform Architecture](https://developer.blender.org/docs/features/objects/transform/)
- [BlenderWiki Archive — Precision Control](https://archive.blender.org/wiki/2015/index.php/User:Fade/Doc:2.6/Manual/3D_interaction/Transform_Control/Precision/)
- [BlenderWiki Archive — Grab/Move](https://archive.blender.org/wiki/2015/index.php/Doc:2.4/Manual/3D_interaction/Transformations/Basics/Grab/)
- [Blender Dev Wiki — Transform Source](https://wiki.blender.jp/Dev:Source/3D_interaction/Transform)
- [DevTalk — Accumulative Trackball Rotation](https://devtalk.blender.org/t/accumulative-trackball-rotation-mode/29022)
- [Blender Artists — Navigation During Transform](https://blenderartists.org/t/allow-navigation-during-transform-operation/688029)
- [Blender Artists — Rotation Snap Increment](https://blenderartists.org/t/is-it-possible-to-adjust-the-rotation-increment/1191643)
- [Blender Python API — Transform Operators](https://docs.blender.org/api/current/bpy.ops.transform.html)
- [Blender Source (GitHub mirror) — transform.c](https://github.com/dfelinto/blender/blob/master/source/blender/editors/transform/transform.c)
