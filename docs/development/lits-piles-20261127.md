# Lits, propriétaires, étagères et bûches — 27 novembre 2026

Lot demandé par Saf, sans changement de simulation ni de schéma.

## Couleurs relues dans le jeu installé

Lecture directe de `RimWorld.Building_Bed` et `RimWorld.BuildingProperties` dans l'Assembly-CSharp de RimWorld 1.6 installé sous `E:/Steam/steamapps/common/RimWorld/`, et des définitions Core `Buildings_Furniture.xml`. Aucun texte, code ou dessin du jeu n'a été copié dans le dépôt.

| Usage | Couleur exacte de drap, `DrawColorTwo` |
| --- | --- |
| Ordinaire | `#a1d5b4` |
| Médical | `#639fe2` |
| Prisonniers | `#ffb721` |
| Médical pour prisonniers | `#a76027` |

`bed_UseSheetColor` vaut vrai par défaut et les modèles présents ne le désactivent pas. Les RGB sont repris dans `bed-sheet-color.ts`. Les emplacements de couleur dans nos modèles 3D, leurs cadres, leurs silhouettes et leur éclairage restent une adaptation originale : drap des lits, couverture du lit double, bordure du sac, contour du couchage au sol, couverture de l'hôpital. Oreillers et matériaux des cadres restent distincts. Le mode prisonnier est maintenant une dépendance des signatures graphiques publiques, confirmées et résidentes, ainsi que des zones de meubles : changer ce rôle recolore réellement le lit déjà affiché.

## Propriétaires et noms

Le code Core n'attribue pas durablement les lits médicaux. Il masque leurs noms sur la carte. Il affiche les propriétaires des autres lits, ou une mention de non-attribution ; le nom d'un propriétaire déjà couché dans son lit est masqué. Le nouvel inspecteur sépare donc propriétaire et patient, et montre le propriétaire d'un lit de prison sans proposer une attribution civile.

Les noms des sept couchages humains sont ajoutés au `MapLabelBatch` existant : même atlas de glyphes, même matériau, même appel de dessin, mêmes attributs. Ils ont un bouton HUD propre « Propriétaires de lits » ; les quantités et qualités restent indépendantes de ce bouton. Le seuil Options des étiquettes règle la distance à laquelle cette couche commune est lisible. Les données sont réindexées aux changements de publication ; un mouvement de caméra sur les mêmes sources ne parcourt aucun lit ni propriétaire et ne réécrit aucun attribut.

Les propriétaires sont les vraies personnes, y compris leurs claims `mapBed` quand elles voyagent. Les groupes publiés dans MAIN sont lus dans leurs vrais dossiers de personnes ; les simples listes de noms et connaissances ne deviennent jamais des propriétaires. Le test passe par le vrai SnapshotEncoder/Decoder pour vérifier ce cas.

Adaptation 3D assumée par rapport au code Core : les noms sont ancrés au-dessus des places durables, et les deux places d'un double couchage ont un petit décalage vertical de texte pour éviter le chevauchement, au lieu de remesurer leur largeur et de les reprojeter sur le processeur à chaque image. Le seuil de zoom utilise le réglage de la couche d'étiquettes existante.

## Objets dans les étagères et bois

Le facteur de réduction des piles en étagère passe de `0.55` à `1` : l'objet conserve ses dimensions au sol. Les supports, les transferts et les étiquettes partagent toujours les mêmes positions. Les supports sont désormais à `0.14`, `0.86` et `1.58`, avec des montants de `1.92`, pour qu'une pile complète de blocs de hauteur `0.59` et son étiquette ne traversent pas la planche supérieure. Le modèle garde ses huit pièces.

Le bois est toujours composé de trois cylindres et de leurs six bouts déjà présents. Leur diamètre passe de `0.14` à `0.22`, la longueur de `0.65` à `0.72`, pour lire des sections de tronc plutôt que des baguettes. L'assemblage reste sous le prochain niveau d'étagère. Les dessins personnalisés d'écorce et de bois de bout restent sur les neuf mêmes pièces ; topologie, domaines de texture et nombre d'appels inchangés.

## Vérification

Contrats ciblés, `--maxWorkers=1`, sans navigateur ni build : couleurs des huit modèles, quatre orientations des places doubles, propriétaire en voyage relu dans MAIN, nom du propriétaire déjà couché, médical sans propriétaire, bouton HUD indépendant, stabilité des buffers sous caméra, tailles des objets identiques au sol et en étagère, passage sous la planche suivante, topologie des bûches et invalidation du rôle prisonnier.

Le passage de huit fichiers a donné 41 succès et le seul échec historique de `construction-preview-parts.test.ts` sur les champs `surfaceDesign` de chaise/raffinerie. Un passage voisin a également retrouvé la façade historique de `shelf-presentation-v320.test.ts` dépourvue de `createPileChunkGroup`. Ces deux échecs sont indépendants de ce lot. Aucun gain de FPS ni contrôle visuel natif n'est revendiqué.

Après ajout du contrôle d'inspection et de la recoloration ciblée, les trois fichiers `bed-owners-presentation`, `furniture-zones` et `structure-signature-v299` donnent **16 succès sur 16**. Les autres contrats de la passe précédente restent verts. Les champs temporaires des tests respectent les drapeaux optionnels `true` du schéma.
