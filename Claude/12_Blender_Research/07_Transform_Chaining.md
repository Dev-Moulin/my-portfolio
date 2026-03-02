# Recherche : Chaînage de transformations après Shift+D

## Sources

- [Blender Source - transform.c](https://github.com/dfelinto/blender/blob/master/source/blender/editors/transform/transform.c)
- [Blender Source - transform_mode.c](https://github.com/dfelinto/blender/blob/master/source/blender/editors/transform/transform_mode.c)
- [Transform Modal Map - Blender Manual](https://docs.blender.org/manual/en/latest/modeling/transform/modal_map.html)
- [DevTalk - Operator Macros](https://devtalk.blender.org/t/trying-to-understand-the-purpose-of-operator-macros/1077)

---

## 1. Verdict : le chaînage N'EXISTE PAS par défaut dans Blender

### Constat

Pendant un Grab modal (après Shift+D), **on ne peut PAS appuyer R pour passer en mode Rotate**. La touche R est simplement **ignorée**.

### Pourquoi ?

Le code source de Blender **contient** les événements modaux pour le changement de type :

```c
{TFM_MODAL_TRANSLATE, "TRANSLATE", 0, "Move", ""},
{TFM_MODAL_ROTATE, "ROTATE", 0, "Rotate", ""},
{TFM_MODAL_RESIZE, "RESIZE", 0, "Resize", ""},
```

Mais les bindings clavier sont **commentés** :

```c
// WM_modalkeymap_add_item(keymap, EVT_GKEY, KM_PRESS, KM_ANY, 0, TFM_MODAL_TRANSLATE);
// WM_modalkeymap_add_item(keymap, EVT_RKEY, KM_PRESS, KM_ANY, 0, TFM_MODAL_ROTATE);
// WM_modalkeymap_add_item(keymap, EVT_SKEY, KM_PRESS, KM_ANY, 0, TFM_MODAL_RESIZE);
```

Le commentaire indique que ces raccourcis sont réservés pour le workflow gizmo uniquement.

### Workflow réel dans Blender

```
Shift+D → Grab actif → déplacer → Clic gauche (confirme)
→ R (nouvelle opération modale de rotation, séparée)
```

Il faut **confirmer ou annuler** le Grab avant de pouvoir faire autre chose.

---

## 2. Fonction `transform_mode_is_changeable`

Le code source contient une garde qui **permettrait** le changement de mode :

```c
bool transform_mode_is_changeable(const int mode) {
  return ELEM(mode, TFM_ROTATION, TFM_RESIZE, TFM_TRACKBALL,
              TFM_TRANSLATION, TFM_EDGE_SLIDE, TFM_VERT_SLIDE);
}
```

Si les bindings étaient activés, on pourrait switcher entre G/R/S pendant ces modes. Mais cette feature est **dormante** (jamais activée par défaut).

---

## 3. Extrude (E) — même comportement

L'extrude est aussi un macro operator :
1. `MESH_OT_extrude_region` → crée la géométrie
2. `TRANSFORM_OT_translate` → entre en Grab

Pendant le Grab post-extrude : **même limitation**, pas de switch vers R ou S.

---

## 4. Macros et opérateurs nestés

- Les macros chaînent des opérateurs séquentiellement
- La partie translate est un opérateur modal complet qui capture tous les événements
- Les opérateurs modaux **nestés ne sont PAS supportés** par Blender (et peuvent causer des crashes)
- On ne peut pas interrompre une macro pour injecter un autre mode

---

## 5. Comparaison avec Maya / 3ds Max

| Logiciel | Architecture | Chaînage ? |
|----------|-------------|-----------|
| **Blender** | Opérateurs modaux ponctuels (G, R, S) | Non (le modal capture tout) |
| **Maya** | Outils persistants (W=Move, E=Rotate, R=Scale) | Non pertinent : on switch d'outil, pas de modal |
| **3ds Max** | Outils persistants | Idem Maya |

Le concept de "chaînage pendant un modal" est **spécifique à Blender** et n'existe dans aucun DCC majeur.

---

## 6. Addons et discussions

- **Aucun addon** trouvé qui active le chaînage G→R→S pendant un modal
- **BlenderArtists** : discussions de users qui demandent cette feature, aucune réponse positive
- **Feature requests** : aucune FR formelle trouvée pour activer les bindings commentés

---

## 7. Implications pour notre éditeur

### Recommandation : NE PAS implémenter le chaînage

Le chaînage de transformations pendant un modal :
- **N'existe pas** dans Blender par défaut
- **N'existe pas** dans Maya ou 3ds Max
- Ajoute une complexité significative (états imbriqués, rollback partiel)
- Impact faible sur l'UX (le workflow confirmer → R est rapide)

### Si on veut quand même le faire un jour

Le code Blender montre que c'est architecturalement possible :
- Le `ModalTransformState` devrait supporter un `switchMode(newMode)` qui :
  1. Sauvegarde les valeurs courantes comme "point de départ" du nouveau mode
  2. Change la fonction de transformation (translate → rotate → resize)
  3. Réinitialise la position souris de référence
  4. L'annulation (Escape) devrait rollback **toute la chaîne** jusqu'aux valeurs initiales

### Priorité : la plus basse du backlog

Cet item devrait être retiré ou mis tout en bas de la liste. Le workflow standard (confirmer G → lancer R) est suffisant et plus intuitif.
