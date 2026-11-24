# Fenêtres comme RimWorld, vague 4 lot 6 : Architecte, menu flottant et info-bulles

Points 17 et 32 du [chantier des retours du 22 novembre](chantier-retours-20261122.md). Lot d'interface seulement : aucun changement de règle ni de schéma. Les chiffres viennent des classes de Ludeon relues pour ce lot (`MainTabWindow_Architect`, `ArchitectCategoryTab`, `GizmoGridDrawer`, `Command`, `FloatMenu`, `FloatMenuOption`, `ActiveTip`), réécrits en nombres ; aucun texte ni image du jeu copiés. La suite de [la référence](rimworld-ui-reference.md) (section 5.2) et l'échelle de texte du [premier lot](fenetres-rimworld-fiche-bio.md) restent la base : Courant en lignes de 22, Petit pour les vignettes. Commencé le 23 novembre, repris et consolidé le 24.

## Ce qui change pour le joueur

- **Architecte** : trois pièces comme dans le jeu. Les catégories sont des boutons de 32 de haut, sur deux colonnes, dans une fenêtre de 200 de large (un bouton dépasse d'un point, le gauche est plus large d'un point, comme `DoCategoryButton`). Au-dessus d'elles, la zone d'information de 200 × 270 (nom, matériau, orientation, description). À droite, dès x = 210, les constructions en vignettes de 75 × 75, 5 d'écart et 14 entre les rangées, libellées en Petit. La fenêtre n'est plus un grand papier de 1180 : sa largeur suit les colonnes de vignettes (au plus 10).
- **Menu flottant** (clic droit) : chaque option est une boîte pleine largeur, texte à gauche en Courant, 4 de marge en haut et en bas, 6 sur les côtés, une rangée chevauchant la suivante d'un point. La largeur de colonne est celle de l'option la plus large (70 au minimum, 300 au maximum, arrondie) ; passé 90 % de la hauteur de l'écran, une nouvelle colonne s'ouvre ; une barre de défilement de 16 n'apparaît que si les colonnes ne tiennent pas dans la largeur de l'écran. La fenêtre s'ouvre à la souris + (4, 0) et reste dans l'écran ; le titre flotte au-dessus. Une option impossible est grisée et garde sa raison entre parenthèses (« Aller ici (Pas de chemin) ») ; l'ancien doublon libellé + bouton disparaît.
- **Info-bulle** : texte Courant sur 260 au plus, 4 de marge, rectangle arrondi vers le haut, lignes de 22 (avant : 420 de large, marge 10, lignes de 17). Les infobulles trop longues pour l'écran gardent leur défilement à la molette.
- **Fenêtres indépendantes** : le menu d'ordres est posé au-dessus de l'inspecteur, sans changer son propriétaire ni ses dimensions. Il reste visible pendant les mises à jour de l'inspecteur et se ferme seul au clic extérieur, à Échap ou à la distance du jeu de base. La confirmation d'un ordre reste une vraie fenêtre modale. Le défaut du chargement orphelin est traité dans [la note du correctif](menu-ordres-20261124.md).
- **Échelle et place réduites** : si les 270 points d'information et les catégories ne tiennent pas, elles gardent chacune leur propre défilement ; le catalogue garde ses vignettes de 75, y compris à 260 × 240 points. Un menu de plus de 60 options utilise le Petit (lignes de 18) ; tous les menus sont bornés à l'écran, avec barre de défilement utilisable à la molette, au clic ou en glissant quand nécessaire. Les raisons de refus et avertissements restent lisibles.

## Faits du jeu utilisés (classe, nombre)

- `MainTabWindow_Architect` : largeur 200, marge 0, deux colonnes (`ColumnCount`), boutons de 32, hauteur de fenêtre = rangées × 32 + 28 (le 28 est le champ de recherche), bas à 35 au-dessus du bas de l'écran.
- `ArchitectCategoryTab` : zone d'information 200 × 270 juste au-dessus de la fenêtre, marge intérieure de 7, nom en Courant puis description ; grille de désignateurs de `GizmoGridDrawer.DrawGizmoGrid` à `startX = 210`.
- `GizmoGridDrawer` : vignettes de 75, espacement (5, 14), rangées remontant depuis y = bas − 35 − 14 − 75 ; passage à la rangée suivante quand la suivante dépasse `largeur d'écran − 147`.
- `Command.GizmoOnGUIInt` : libellé Petit, bande de texte au bas de la vignette, raccourci en haut à droite.
- `FloatMenu` : `MaxScreenHeightPercent` 0,9, colonne de 70 à 300 (`ColumnWidth`), chevauchement −1, barre de 16, colonnes remplies de haut en bas (`ColumnCountIfNoScrollbar`, `MaxViewHeight`, `TotalViewHeight`), position souris + (4, 0) bornée à l'écran, titre à (30, −25), 23 de haut ; plus de 60 options : mode « Tiny ».
- `FloatMenuOption` : hauteur 2 × 4 + hauteur du texte (largeur de retour 300 − (2 × 6 + 4)), largeur requise 6 + 4 + texte + 6 + 4, texte décalé de 4 au survol, couleurs actif / survol / grisé, icône de 27.
- `ActiveTip` : texte Courant, 260 au plus, marge 4, `RoundedCeil`.

## Adaptations déclarées

- **Couleurs et matière** : les boîtes du menu sont du papier crème (grisé : kraft), sans le fond noir bleuté du jeu ; le survol garde le relief de carton des autres commandes au lieu du décalage de 4 du texte.
- **Recherche rapide de l'Architecte** (champ de 24 sous les catégories) : absente d'Elsewhere, non ajoutée par ce lot. La hauteur des catégories ne compte donc pas les 28.
- **Zone d'information** : elle garde les lignes propres d'Elsewhere (matériau, orientation Q / E, compteur d'ordres) dans la zone de 270, qui défile si elles dépassent ; le jeu y met seulement coût et description.
- **Bas de l'écran** : le papier de l'Architecte reste posé au-dessus de la barre du bas d'Elsewhere, et les rangées de vignettes se lisent de haut en bas (le jeu les empile vers le haut).
- **Icônes d'option et partie additionnelle** (`extraPartWidth`) : le menu d'ordres d'Elsewhere n'en a pas, donc elles ne sont pas dessinées.

## Coût

Rien par image n'est ajouté : la mise en page est calculée à chaque changement de page (comme avant) ; l'info-bulle est composée une fois à son apparition. Le menu flottant crée une pièce par option visible et un fond commun ; une mise à jour de la fiche du colon ne relit ni ne redessine ces pièces. Banc Node, sept passages alternés de 2 000 compositions, mêmes pages et mesures de texte : Architecte 30 outils, 0,0132 → 0,0137 ms ; menu 6 options, 0,0064 → 0,0058 ms ; menu 85 options, 0,0791 → 0,0753 ms. Ce banc mesure les calculs de rectangulation, pas les images par seconde du vrai client.

## Tests

`tests/windows-architect-menus-w6.test.ts` : rectangles des catégories (deux colonnes, 32, 101 / 100 de large, 33 de haut), vignettes 75 × 75 au pas (80, 89), page Architecte (zone 200 × 270, grille à 210), tailles et colonnes du menu flottant (70 / 300, chevauchement, nouvelle colonne, barre), position à la souris, lignes d'une page de menu, taille de l'info-bulle. Le test 25 de `interactions-rimworld-20261122.test.ts` suit la règle de Core pour le bord droit (la fenêtre peut toucher le bord de l'écran).

Reprise : les tests de géométrie réduite conservent l'accessibilité de toutes les commandes avec les nouvelles dimensions ; les anciens chiffres 96 et 104 des vignettes ont laissé place aux chiffres de Core, sans supprimer les tests de défilement. Nouveau `tests/native-float-menu-layer.test.ts` : cycle d'une requête, indépendance de l'inspecteur, clic, Échap, clavier et changement de fenêtre. Les cinq fichiers ciblés pour la reprise sont verts (30 tests). Passe liée : 237 tests verts, 10 échecs connus, un chargement ancien confirmé sur la version de départ, aucun nouvel échec. Typage réussi. Le parcours visuel réel n'a pas pu être exécuté dans cette session (accès réseau local refusé).
