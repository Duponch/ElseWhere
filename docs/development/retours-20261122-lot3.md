# Retours du 22 novembre, vague 1, lot 3 : petites corrections visuelles et sélection

Points 9, 10, 11, 12, 14 et 16 du [chantier des retours](chantier-retours-20261122.md). Présentation et interface seulement : aucune règle du jeu, aucun changement de schéma (376 inchangé), aucune donnée de sauvegarde touchée.

## 9. Bébés animaux trop petits

**Constat.** Le rendu réduisait chaque animal par le facteur de taille corporelle de son âge (`bodySizeFactor` des `LifeStageDef` : 0,2 pour un petit, 0,1 pour un poussin d’oiseau, 0,5 pour un jeune). Un veau de muffalo était donc dessiné au cinquième de l’adulte, un caneton au dixième.

**Le jeu de base.** RimWorld 1.6 ne dessine pas la taille corporelle : chaque stade de vie a son propre dessin et sa propre `drawSize` (`PawnKindDef.lifeStages[].bodyGraphicData.drawSize`). Le muffalo est dessiné à 1,5 puis 2,25 puis 3 : le veau fait la moitié de l’adulte, le jeune les trois quarts. Les rapports relevés sur les 53 espèces d’Elsewhere vont de 0,45 (boomalope) à 0,8 (rat) pour un petit.

**Correction.** `src/render/animal-stage-scale.ts` porte les trois `drawSize` de chaque espèce (des nombres seulement, ni texture ni texte) ; le rendu (`WildlifeBodyScale`, utilisé par la faune, les cadavres et les animaux portés) dessine le modèle adulte au rapport du stade. Le stade vient du suivi de croissance enregistré quand l’animal en a un (jamais reconstruit depuis l’âge), sinon des âges de stade du jeu. Aucun plancher arbitraire n’a été nécessaire : le rapport du jeu garde petit < jeune < adulte pour chaque espèce, et le plus petit (0,45) reste lisible. La taille corporelle, la nutrition et toutes les règles lisent toujours `bodySizeAtAge`.

## 10. Couleur du muffalo

**Le jeu de base.** La texture du muffalo (lue localement dans le jeu installé pour vérifier sa palette, rien n’est copié dans le dépôt) est un animal laineux gris bleuté pâle : sous le contour, la moyenne est d’environ `#8e9fa4`, les teintes dominantes vont de `#90b0b0` à `#b0d0d0`, la tête est un peu plus claire, aucune corne n’est visible de face ou de profil. Sa laine (`WoolMuffalo`) est (179,192,186) et son cuir (`Leather_Bluefur`) (152,170,174). Le muffalo d’Elsewhere reprenait le buffle du Cap de la référence fournie, brun très foncé (`#362d28`).

**Correction.** Une correction de présentation du modèle « buffle » (`buildOrigamiAnimalPresentation`, comme celles du chien, de l’éléphant et du lièvre) remplace seulement le pigment sombre du pelage ; forme, cornes, yeux et sabots restent ceux de la référence, que le constructeur source continue de produire à l’identique. En Pastel, le pelage prend la couleur `#97a9ac` tirée de la texture ; en Gouache, il reçoit le pigment résident de laine argentée du bestiaire (celui du chinchilla et du chat, gris clair froid peint en traits ondulés), si bien qu’aucune nouvelle couche de peinture n’est cuite et que l’inventaire des 78 pigments ne change pas.

**Autres animaux comparés au passage** (moyenne de la texture du jeu multipliée par sa teinte de définition, contre la couleur principale d’Elsewhere) : la plupart concordent (ours, renards, cougar, panthère, gazelle, dromadaire, éléphant, rhinocéros, yak, tortue, sanglier, loups, singe). Écarts nets relevés, **non corrigés dans ce lot** : la mégarachnide est brune dans le jeu (teinte (154,125,94)) mais bleu-gris dans Elsewhere ; l’alpaga est fauve (180,148,109) dans le jeu mais crème ; le capybara est plus sombre (109,84,49) que dans Elsewhere ; le labrador est crème-jaune (220,198,160). Ces espèces viennent du bestiaire fourni, dont les pigments résidents sont gardés par un inventaire exact (`game-paint-residency.ts`) : les recolorer demande soit un pigment déjà résident de la bonne teinte, soit un nouveau pigment et la mise à jour de cet inventaire. À traiter avec le point 6 (modèles d’animaux).

## 11. Buissons

Le modèle d’avant la refonte Gouache/Origami (commit `2c7b7ac1` du 2 novembre, puis partagé par les deux styles le 4 novembre en `7a51cb7d`) était le buisson bas à facettes de `flora-presentation` : un icosaèdre aplati, comme les fragments de roche, avec cinq baies pour le buisson à baies. Le buisson et le buisson à baies ne sont plus confiés à la recette de référence (`resource-flora.ts`) ; ils reprennent ce modèle dans les deux styles, peint par la chaîne de surfaces actuelle (profil générique en Gouache, couleur de sommet en Pastel). La recette de référence elle-même reste inchangée. Gain : 20 triangles par buisson au lieu de 96 (120 au lieu de 168 avec ses baies) ; Les Forges en compte 990.

## 12. Fragment de calcaire sur une chaise

**Le jeu de base autorise la situation.** La chaise de salle à manger, le fauteuil et le canapé sont `Standable` sans `surfaceType` : un objet n’y bloque pas la construction (`GenConstruct.BlocksConstruction` ne refuse les objets que sous un bâtiment non `Standable` sans surface), le dépôt les juge bons (`GenPlace.PlaceSpotQualityAt` n’écarte que les bâtiments pleins, les portes, les établis et `preventDroppingThingsOn`) et les réserves peuvent les recouvrir. Le jeu dessine alors l’objet au-dessus de la chaise (altitude `Item` au-dessus de `Building`). La règle de simulation est donc conforme et n’a pas été changée.

**Correction de présentation.** L’objet était dessiné au sol et traversait l’assise. Une pile posée sur une chaise, un fauteuil ou un canapé est maintenant dessinée sur l’assise, un peu en avant du dossier et réduite de façon uniforme ; sur une table de chevet (`surfaceType Item` dans le jeu), sur son plateau. Lecture faite une fois par changement de structures, comme pour les tabourets et les tables.

## 14. Sélection plus robuste

**Le jeu de base** (`Selector.SelectUnderMouse`, `SelectableObjectsUnderMouse`, `GenUI.ThingsUnderMouse`) : les choses de la case cliquée sont triées par altitude de dessin, la plus haute d’abord (objets, puis bâtiments posés sur d’autres, puis bâtiments, puis câbles), les rangements (`Building_Storage` : étagères et trémie) passent en tête, puis viennent zone et plan ; chaque nouveau clic sur la même case passe à la chose suivante. L’applique murale (`isAttachment`, `Placeworker_AttachedToWall`) occupe la case libre devant le mur mais est dessinée 0,9 case vers lui, d’où le clic qui tombait sur le mur.

**Corrections.**
- Une applique est trouvée aussi sur la case du mur qui la porte, avant le mur (altitude `BuildingOnTop`) ; un clic sur l’applique dessinée en hauteur sur la face du mur la vise directement (projection de l’applique à l’écran, calculée seulement au clic). Clics successifs : applique, mur, applique.
- Les étagères et la trémie passent avant leur contenu ; les autres bâtiments suivent l’altitude du jeu (câble en dernier, comme avant). Adaptation : le jeu, quand une étagère porte au moins deux piles, fait alterner étagère et première pile et laisse les autres à l’onglet de contenu ; Elsewhere n’a pas encore cet onglet dans l’inspecteur natif, donc les clics continuent de parcourir toutes les piles.
- L’inspecteur de sélection n’avale plus le clic dans la carte : comme le panneau d’inspection du jeu, un clic sur la carte sélectionne directement la chose visée, passe à la suivante sur la même case ou vide la sélection, au lieu de seulement fermer l’inspecteur. Les autres fenêtres gardent leur fermeture par clic extérieur.
- La liste des choses d’une case lit l’appartenance par la requête ponctuelle existante (`footprintContains`, même verdict que `footprintCells`, vérifié sur toutes les cases de Les Forges) au lieu de construire la liste des cases de chaque bâtiment.

## 16. Noms dans la barre des colons

Le jeu affiche sous le portrait `Pawn.LabelShort`, c’est-à-dire `NameTriple.ToStringShort` : le surnom. Elsewhere garde un seul nom affiché par personne ; la barre en tire le surnom entre guillemets (« Umbre « LeSombre » Nighthawk » donne « LeSombre », « Ada 'Ace' Lovelace » donne « Ace »), sinon le premier mot (un nom triple dont le surnom égale le prénom ou le nom est écrit « Prénom Nom » sans garder lequel). Le nom complet reste dans l’info-bulle et le dossier.

## Vérification dans le client

Serveur de développement local, son et musique coupés, sur une copie locale de Les Aulnes (non versionnée) complétée d’un mur en bois avec applique, d’une chaise et d’un fauteuil portant un fragment de calcaire, et de trois muffalos d’âges différents :
- barre des colons : « LeSombre », « Ace », puis les prénoms ;
- clic sur l’applique dessinée sur la face du mur : « Applique murale » ; nouveau clic : « Mur » (bois) ; troisième : de nouveau l’applique ; clic sur la chaise : « Fragment de calcaire », puis « Chaise de salle à manger », sans fermer l’inspecteur entre deux ;
- fragments posés sur l’assise de la chaise et du fauteuil ;
- muffalos gris bleuté pâle en Pastel et gris argenté peint en Gouache ; le jeune est nettement plus petit que l’adulte sans être minuscule (le veau, caché par le panneau du temps à ce cadrage, est couvert par les tests) ;
- buissons à baies de nouveau en blocs à facettes, en Gouache ;
- page en arrière-plan (environ 1 image/s) : pas de mesure d’images par seconde tirée de cette vérification.

## Performances

Banc ciblé empaqueté par esbuild sur Les Forges (7 512 bâtiments, 1 778 piles, 241 animaux), avant (copie de `origin/main`) et après :
- liste des choses d’une case (survol et clic) : 3,0 → 0,87 ms par appel en médiane ; listes identiques sur les 9 379 cases comparées ;
- échelle des animaux, calcul à froid pour les 241 : 0,14 → 0,07 ms ;
- buissons : 96 → 20 triangles par buisson, 168 → 120 avec baies ;
- surfaces des piles : 1,2 à 1,4 ms par changement de structures, quelques types en plus seulement ;
- la projection de l’applique ne tourne qu’au clic.

## Tests

`tests/retours-20261122-visual-selection.test.ts` (11 cas). Voisins relancés : sélection (11 fichiers), flore et ressources, modèles et peintures d’animaux, surfaces des piles, scène native : aucun échec hors de `known-failures.json` ; `graphics-style-common-plants` et `animal-common-model-styles`, retirés de la suite car déjà en échec à leur construction, ne sont pas mis à jour.
