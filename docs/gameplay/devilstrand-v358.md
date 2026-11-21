# Soie du diable : recherche, culture et tissu — V358

**Schéma 358.** La colonie peut rechercher la **soie du diable**, la semer dans une zone de culture en pleine terre, la récolter, puis coudre avec ce tissu tous les vêtements de tissu et le sac de couchage. Code : `src/sim/devilstrand-358.ts`.

## Ce que dit le jeu de base (faits vérifiés)

Sources : RimWorld 1.6.4871, définitions `ResearchProjectDefs/ResearchProjects_1.xml` (Devilstrand), `ThingDefs_Plants/Plants_Cultivated_Farm.xml` (Plant_Devilstrand) et `Plants_Bases.xml` (PlantBase, PlantBaseNonEdible), `ThingDefs_Items/Items_Resource_Stuff.xml` (DevilstrandCloth, ResourceBase), `ThingDefs_Misc/Apparel_Various.xml` (ApparelBase), `ThingDefs_Buildings/Buildings_Furniture.xml`, `TraderKindDefs/*`, et classes décompilées `PlantProperties` (valeurs par défaut), `Command_SetPlantToGrow` (`IsPlantAvailable`), `WorkGiver_GrowerSow` (compétence minimale).

- **Recherche Devilstrand.** 800 points, néolithique, sans prérequis ni bureau particulier.
- **Plante (Plant_Devilstrand).** 22,5 jours de croissance ; semis 400 de travail, récolte 200 (valeur de la base) ; **6** soies par plant mûr ; fertilité minimale **0,5**, sensibilité à la fertilité 1 ; **Culture 10** pour semer ; pleine terre seulement (étiquette de semis `Ground`, pas d'hydroponie) ; recherche Devilstrand requise pour la choisir ; **jamais touchée par la rouille** (`neverBlightable`) ; meurt sans feuilles ; 85 PV, nutrition 0,2 ; maturité de récolte 0,65 et températures de croissance 0 / 6 / 42 / 58 °C (valeurs par défaut) ; durée de vie 22,5 × 8 = 180 jours.
- **Tissu (DevilstrandCloth).** Pile de 75 ; 100 PV ; valeur 5,5 ; masse 0,032 kg ; inflammabilité 0,4 ; détérioration 3 ; puissances de matière : armure tranchant 1,40, contondant 0,36, chaleur 3,00 ; isolation froid 20, chaud 24 ; catégorie Tissu (`Fabric`), fréquence 0,20, couleur (180, 60, 60) ; facteurs appliqués à ce qui en est fait : inflammabilité ×0,4, PV ×1,3, beauté ×3,2 ; catégorie d'objets Textiles.
- **Qui accepte le tissu.** Tous les vêtements de tissu ou de cuir (tenue tribale, chemise, t-shirt, pantalon, cache-poussière, blouson, parka, chapeaux de cow-boy et melon) et la tuque, qui n'accepte que le tissu ; parmi les meubles : sac de couchage (simple et double), lit pour animal, fauteuil, canapé, sacs de sable et chatière.
- **Marchands.** Les caravanes et bases tribales et de l'espace, et le vaisseau de marchandises en vrac, ont un générateur de stock de la catégorie Textiles ; les vêtements de leur stock tirent leur matière selon la fréquence des matières (0,20 pour la soie du diable).

## Ce qui est livré

- **Recherche.** « Soie du diable » apparaît dans l'arbre de recherche, à tout bureau. Une fois terminée, un message l'annonce.
- **Culture.** Le choix de la culture d'une zone de pleine terre propose la soie du diable seulement après la recherche (un ordre direct est refusé avant) ; les bacs hydroponiques ne la proposent jamais. Un cultivateur de niveau **Culture 10** au moins commence le semis (40 ticks nominaux) ; récolte et dégagement n'ont pas de minimum. La croissance suit la formule commune (lumière, nuit, froid, fertilité) avec les valeurs du jeu de base, ce qui donne environ 41 jours de jeu sur une terre de fertilité 100 %. La rouille des cultures ne la choisit jamais, ni comme cible d'incident ni par propagation. Récolte : 6 soies au sol, modulées comme les autres cultures par la compétence et l'état du plant.
- **Rendu.** Trois champignons rouges à large chapeau sur pied clair, dans le lot de cultures résident ; ce lot n'est créé qu'à l'apparition du premier plant. Pictogrammes de la recherche, de la culture et du tissu.
- **Tissu.** Objet « Soie du diable », stockable dans **Textiles** (à côté du tissu), échangeable à 5,5, avec ses PV, son inflammabilité, sa masse et sa détérioration.
- **Vêtements.** La soie du diable est la 23e matière de couture : dix vêtements (tenue tribale, chemise, t-shirt, pantalon, cache-poussière, blouson, parka, tuque, chapeaux de cow-boy et melon), aux PV ×1,3, à l'armure et à l'isolation calculées avec ses puissances (une parka : 234 PV, froid 40, armure tranchant 0,28 et chaleur 0,6), inflammables à 0,4 au lieu de 1,2, et valant quantité × 5,5 + travail × 0,0036. Les nouvelles factures de couture l'acceptent par défaut ; les politiques de tenue d'une nouvelle partie autorisent ces vêtements.
- **Sac de couchage.** La soie du diable est une matière du sac de couchage : PV ×1,3, beauté ×3,2, inflammabilité ×0,4.
- **Marchands.** Les visiteurs, les caravanes commerciales et le vaisseau de marchandises en vrac vendent désormais des vêtements en soie du diable : le même tirage de matière qui ne donnait rien pour cette ligne du jeu de base la donne maintenant (mêmes tirages, même suite aléatoire). Le vaisseau de marchandises en vrac achète et revend le tissu.
- **Sauvegardes.** Dès 358, validation stricte de la plante, du tissu, des vêtements, de la matière dans les politiques, factures et ouvrages, de l'enregistrement de recherche et des zones de culture (une zone réglée sur la soie du diable exige la recherche terminée). Une sauvegarde 357 migre par le seul numéro : rien n'est donné ; ses politiques de tenue et ses factures gardent leurs réglages et n'acceptent la soie du diable qu'une fois cochée. Une sauvegarde 357 (ou plus ancienne) qui en contiendrait est refusée. Avant 358, rien ne change.

## Adaptations

- **Fauteuil, sacs de sable.** Ici le fauteuil ne se fait qu'en tissu ou en cuir léger et les sacs de sable qu'en tissu ; la soie du diable n'y est pas ajoutée, pas plus que les autres cuirs et laines. Le sac de couchage double, le lit pour animal, le canapé et la chatière n'existent pas.
- **Stock de textiles des marchands.** Aucun générateur de la catégorie Textiles n'est représenté (ni tissu, ni cuirs, ni laines) : visiteurs et caravanes ne vendent pas la soie du diable brute. Seul le vaisseau de marchandises en vrac la commerce, comme il le fait déjà pour les textiles représentés.
- **Transport porté.** Le modèle de cargaison résident n'a plus que 72 sommets de marge : un colon qui porte de la soie du diable montre la pièce de tissu du tissu ordinaire, et un vêtement porté dans les bras celui du vêtement en tissu de la même famille (les chapeaux, la tuque en tissu, comme en 353). Au sol, chaque objet garde sa forme et sa couleur rouge.
- **Pantalon porté.** Le code de couleur du pantalon n'a que seize valeurs : le pantalon en soie du diable prend la couleur historique la plus proche, celle de la fourrure de renard. Haut, tuque et chapeaux gardent la couleur de la soie du diable.
- **Coût de passage.** Le coût de passage 14 des cultures n'est pas modélisé à part ; la soie du diable se traverse comme les autres cultures.

## Ce qui reste

- Synthread et hyperweave, les deux autres tissus du jeu de base, restent absents (leur ligne de matière continue de ne rien donner aux marchands).
- La soie du diable ne fait pas partie des provisions qu'une caravane décharge, des dons diplomatiques ni des demandes commerciales de tissu brut.
- Pas de soie du diable sauvage (le jeu de base n'en place dans aucun biome).
- L'atelier des modèles (`/assets.html`) ne montre pas encore le plant de soie du diable.

## Vérifications

`tests/devilstrand-358.test.ts` couvre :

- les faits du jeu de base (recherche, plante, tissu, matière, vêtements, sac de couchage, marchands) ;
- la recherche au bureau par de vrais ticks, la culture refusée avant puis proposée après, le refus du semis à Culture 9 puis le semis réel à Culture 10, deux jours de croissance réelle, la reprise exacte d'une sauvegarde en pleine croissance et une vraie récolte de 6 soies après un point de maturité déclaré ;
- un vrai tailleur qui coud une parka en soie du diable, avec reprise exacte de la sauvegarde, puis la porte ;
- les vêtements vendus par les visiteurs avec la même suite aléatoire qu'en 357 ;
- le refus de tout contenu de soie du diable en 356 et 357, et la migration 357 → 358 par le seul numéro.

Oracles mis à jour pour le contenu qu'une nouvelle partie ou une nouvelle facture contient désormais : nombre de matières (23), de t-shirts et blousons, de chapeaux et de matières du sac de couchage, entrées de la tuque, catalogue des vêtements (V456), cultures proposées sans recherche (V471), cultures sensibles à la rouille, unicité des modèles portés (les vêtements en soie du diable partagent ceux du tissu), et deux migrations par le seul numéro (354, 355) comparées au monde courant migré (`asMigratedFrom357`). `tests/scenarios/old-schema.ts` retire la soie du diable des politiques et des filtres de facture avant 358.

