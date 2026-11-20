# Armoire à outils et tapis — V355

**Schéma 355.** Deux contenus du jeu de base que la colonie rencontre dès ses premiers jours : l'**armoire à outils**, qui accélère le travail aux établis voisins, et les **tapis** des 63 couleurs du jeu, posés comme les autres sols après la recherche **Fabrication de tapis**.

## Ce que dit le jeu de base (faits vérifiés)

Sources : RimWorld 1.6.4871, définitions `ThingDefs_Buildings/Buildings_Misc.xml` (ToolCabinet), `ThingDefs_Buildings/Buildings_Production.xml` (établis), `Stats/Stats_Building_Special.xml` (WorkTableWorkSpeedFactor), `TerrainDefs/Terrain_Floors.xml` (modèle Carpet), `TerrainDefs/Terrain_Floors_Burned.xml` (BurnedCarpet), `ColorDefs/ColorDefs.xml`, `ResearchProjectDefs/ResearchProjects_1.xml` (CarpetMaking, ComplexFurniture), `Misc/DesignatorDropdownGroupDef` (Floor_Carpet), et classes décompilées `CompProperties_Facility`, `CompFacility`, `CompAffectedByFacilities`, `FacilitiesUtility`, `GenSight`, `GridsUtility`, `GenThing`, `Altitudes`, `StatWorker`, `TerrainDefGenerator_Carpet`.

- **Armoire à outils (ToolCabinet).** 200 acier, sans matériau au choix ; travail 1 800 ; 100 PV ; masse 20 ; inflammabilité 0,5 ; 2 × 1 orientable ; traversable lentement (coût de passage 42), remplissage 0,5 ; Construction 4 ; recherche Mobilier complexe ; se désinstalle ; pas de beauté propre ; catégorie Divers de l'Architecte.
- **Installation (CompProperties_Facility).** +0,06 au facteur de vitesse de travail de l'établi (`WorkTableWorkSpeedFactor`), **deux armoires au plus par établi** (`maxSimultaneous` 2) ; une armoire sert autant d'établis qu'il y en a autour. Distance maximale **8** entre les centres vrais des deux bâtiments, mesurée en 3D (la hauteur de couche compte) ; ligne de vue exigée entre une case de l'établi et une case de l'armoire, bloquée par tout bâtiment plein (mur, porte fermée, roche) ; pas de règle de pièce. Les liens gardent les plus proches (distance, puis x, puis z) : une armoire plus proche remplace la plus lointaine ; une armoire retirée ou un obstacle construit ou retiré relie tout de nouveau.
- **Établis concernés.** Ceux dont la définition liste ToolCabinet : emplacement d'artisanat, emplacement de boucherie, établi de sculpture, table de boucherie, établis de tailleur manuel et électrique, forges à combustible et électrique, atelier d'usinage, table du tailleur de pierre, laboratoire de drogues, établi de fabrication. Pas les cuisinières, la brasserie, la fonderie, la raffinerie, le crématorium ni les bureaux de recherche.
- **Calcul (StatWorker).** Base de l'établi, plus les décalages des installations liées, puis les parties de la statistique (sans courant, rôle de pièce, température, extérieur) qui multiplient. L'emplacement d'artisanat et l'établi de tailleur manuel valent 0,5 de base : une armoire les porte à 0,56, deux à 0,62. Un établi électrique sans courant : (1 + décalage) × 0,5.
- **Tapis (modèle Carpet).** Un sol par couleur de bâtiment (63 `ColorDef` de type Structure, dans l'ordre du jeu) : 7 tissus par case, travail 800, **beauté +2**, inflammabilité 0,32, **temps de nettoyage ×2**, propreté 0, sans niveau de Construction minimal ; recherche Fabrication de tapis ; catégorie Sols, menu déroulant « tapis ». Brûlé, il devient le **tapis brûlé** (beauté −6, coût de passage 1).
- **Fabrication de tapis (CarpetMaking).** 800 points, médiévale, sans prérequis ni bureau particulier.

## Ce qui est livré

- **Construction.** L'armoire est dans **Architecte > Production**, après Mobilier complexe (acquis au départ d'un atterrissage forcé) : 200 acier livrés, Construction 4, rotation Q/E. Elle se désinstalle, se transporte et se réinstalle comme les autres meubles ; sa masse de fret est 20 kg.
- **Liens.** Calculés à partir de la liste des bâtiments partagée par la simulation et de l'état du terrain, sans état sauvegardé : même partie, mêmes liens après rechargement. Ils ne sont recalculés qu'à un changement de bâtiment ou de roche (jeton de la liste des bâtiments et compteur d'écritures du terrain), jamais à chaque tick sinon. Distance 3D comme le jeu de base : un emplacement d'artisanat (couche FloorEmplacement) doit être un peu plus proche qu'un établi (couche Building).
- **Vitesse.** Le travail d'une facture à un établi lié avance plus vite selon le facteur ci-dessus, dans la même formule que la lumière, l'extérieur, le rôle de pièce et la température déjà présents.
- **Inspection.** L'établi affiche « Installations liées : … · vitesse de travail +n % » ; l'armoire, les établis qu'elle sert. Le facteur de production de l'inspection d'environnement inclut l'armoire. Sélectionner une armoire ou un établi lié trace au sol une ligne vers chaque lien, comme dans le jeu de base.
- **Tapis.** Les 63 couleurs sont des sols ordinaires : plan, livraison du tissu, pose, retrait (environ la moitié du tissu rendue, la perte au grand livre des textiles), beauté et richesse de pièce, temps de nettoyage, inflammabilité et tapis brûlé (sept tissus perdus au grand livre du feu). L'Architecte montre une seule tuile **Tapis** ; sa ligne **Couleur** propose les 63 teintes, comme le menu déroulant du jeu de base. Chaque couleur a son pictogramme et sa couleur de rendu.
- **Recherche.** Fabrication de tapis apparaît dans l'arbre (colonne médiévale), à tout bureau de recherche.
- **Sauvegardes.** Dès 355, validation stricte de l'armoire (acier, empreinte, recherche Mobilier complexe), des tapis et du tapis brûlé, de l'enregistrement de Fabrication de tapis et des plans de tapis (qui exigent la recherche). Une sauvegarde 354 migre par le seul numéro : aucune armoire, aucun tapis, aucune recherche offerts ; une 354 qui en contiendrait est refusée. Avant 355, rien ne change : l'armoire et les tapis n'existent pas et la vitesse des établis reste identique bit à bit.

## Coût mesuré

Les Forges (80 colons, 7 512 bâtiments, 16 établis concernés), 300 ticks dans Node (`tsx`, qui surestime le temps d'environ un tiers ; mesure de comparaison, pas de FPS) : 0,43 lecture du facteur de vitesse par tick en moyenne (une par colon travaillant à un poste). Sans armoire, la lecture coûte 0,10 µs (≈ 0,04 µs par tick, contre 73 ms par tick de simulation) ; avec deux armoires à chaque établi, 0,16 µs une fois les liens en cache. Un recalcul après une écriture de terrain coûte ≈ 34 µs pour l'établi lu. Sur ces 300 ticks, aucune écriture de terrain et 26 ticks avec une liste de bâtiments changée : les liens ne sont recalculés qu'à ces moments, et seulement pour les établis effectivement lus.

## Adaptations

- **Catégorie.** L'Architecte d'Elsewhere n'a pas de catégorie Divers : l'armoire est rangée en Production, à côté du multi-analyseur.
- **Portes.** Le jeu de base relie selon l'état de la porte au moment du recalcul (fermée presque toujours) et ne recalcule pas à son ouverture ; ici une porte compte toujours comme fermée.
- **Ligne de vue.** Le tracé de ligne de vue des tirs d'Elsewhere (même parcours de cases que `GenSight`) est réutilisé ; la roche naturelle et les rochers effondrés bloquent comme des bâtiments pleins.
- **Lignes de lien.** Bandes claires au sol, sans la couleur rouge des installations inactives (l'armoire n'a pas de courant, elle est toujours active).
- **Couleurs des tapis.** Libellés français écrits pour Elsewhere ; la teinte vient de la couleur Core, rendue en aplat dans le lot des sols, sans texture.

## Ce qui reste

- Les autres installations Core (tables de chevet et commodes sont déjà traitées à part ; moniteur vital et multi-analyseur ont leurs propres liens) ne passent pas par ce mécanisme commun.
- Pas d'aperçu des liens potentiels pendant la pose de l'armoire (le jeu de base les trace) ; seulement à la sélection.
- Tapis fins (extensions), natte de paille, béton, dalles d'or et d'argent restent absents.
- Pas de pipette de couleur (« eyedropper ») ni de mémoire du dernier tapis posé.
