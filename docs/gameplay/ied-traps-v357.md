# Pièges EEI — V357

**Schéma 357.** La recherche **EEI** du jeu de base et ses deux premiers pièges : le **piège EEI explosif** et le **piège EEI incendiaire**, chacun fait de deux obus de mortier reliés à un déclencheur caché dans le sol. Les obus explosifs et incendiaires entrent dans le catalogue ; la colonie les achète aux caravanes qui en vendent.

## Ce que dit le jeu de base (faits vérifiés)

Sources : RimWorld 1.6.4871, définitions `ThingDefs_Buildings/Buildings_Security.xml` (TrapIEDBase, TrapIED_HighExplosive, TrapIED_Incendiary, TrapSpike), `ResearchProjectDefs/ResearchProjects_2_Electricity.xml` (IEDs), `ThingDefs_Items/Items_Resource_Shell.xml` (ShellBase, Shell_HighExplosive, Shell_Incendiary et les autres obus), `DamageDefs/Damages_Misc.xml` (Bomb), `DamageDefs/Damages_Environmental.xml` (Flame), `ThingCategoryDefs/ThingCategories.xml` (MortarShells), `TraderKindDefs/TraderKinds_Caravan_Outlander.xml`, et classes décompilées `Building_Trap`, `Building_TrapExplosive`, `CompExplosive`, `CompProperties_Explosive`, `GenExplosion`, `Explosion`, `DamageWorker_Flame`, `PlaceWorker_NeverAdjacentTrap`, `StockGenerator_Tag`.

- **Recherche EEI (IEDs).** 500 points, industrielle, après Électricité, sans bureau particulier.
- **Piège (TrapIEDBase).** Deux obus de son type (explosifs ou incendiaires), sans matériau au choix ; travail 1 400 ; 40 PV ; masse 2 ; inflammabilité 1 ; beauté −4 ; Construction 3 ; une case, non orientable ; se désinstalle ; aucun autre piège, plan ou cadre dans les huit cases voisines (`PlaceWorker_NeverAdjacentTrap`). Pas de récupération à la destruction (`leaveResourcesWhenKilled` faux).
- **Déclenchement (Building_Trap).** Chaque nouveau pas sur la case tire une fois la chance de déclenchement : 1 pour qui ignore le piège ; s'il le connaît, 0,5 % pour la même faction, 0 pour une autre faction (visiteurs neutres), 0,2 × 0,25 pour un animal sauvage calme (`trapPeacefulWildAnimalsSpringChanceFactor` des EEI ; 0,2 pour le piège à pointes). Les pillards hostiles ne le connaissent pas. Un déclenchement par un allié envoie la lettre « piège déclenché par un allié ».
- **Évitement.** Ceux qui connaissent le piège paient un coût de recherche de chemin de 800 et un délai de marche de 40 ticks dessus : ils le contournent.
- **Mèche et explosion (CompExplosive).** Le déclenchement allume la mèche (`SpringSub` → `StartWick`, le déclencheur devient l'instigateur) : 15 ticks, comptés à partir du tick du piège lui-même, puis `Detonate` tue le piège (reconstruction automatique éventuelle) et lance l'explosion de rayon 3,9. L'explosif fait des dégâts **Bomb** (50, pénétration 0,10, ×4 contre les bâtiments infranchissables, ×2 sinon, ×4 contre les plantes) et laisse une marque de souffle ; l'incendiaire fait des dégâts **Flame** (10) qui allument des feux. L'onde avance d'une case tous les 1,5 tick environ ; chaleur 5 par case (Bomb) ou 15 (Flame).
- **Dégâts subis.** Une balle ou une flèche allume la mèche ; des dégâts au moins égaux aux PV restants le font exploser tout de suite (un EEI touché par l'explosion d'un autre détone aussi) ; tomber à 8 PV ou moins (20 %) allume la mèche (le feu, par exemple).
- **Obus (ShellBase).** 60 PV, valeur 55, masse 1,25, inflammabilité 1, détérioration 1,5, piles de 25, catégorie « obus de mortier », étiquette commerciale MortarShell. Leur fabrication à l'atelier d'usinage exige la recherche Mortiers.
- **Commerce.** Le fournisseur militaire (caravane d'outlanders) vend 1 à 2 sortes d'obus, 3 à 15 chacune ; le marchand d'esclaves pirate −1 à 2 sortes, 1 à 10 chacune (`StockGenerator_Tag`, cinq obus de poids égal).

## Ce qui est livré

- **Recherche.** EEI apparaît dans l'arbre (colonne industrielle, Électricité acquise au départ), à tout bureau de recherche.
- **Construction.** **Architecte > Structure**, à côté du piège à pointes : piège EEI explosif et piège EEI incendiaire, deux obus livrés physiquement, Construction 3. La règle des huit voisins compte désormais aussi bien les pièges à pointes que les EEI. Ils se désinstallent et se réinstallent ; 2 kg en fret.
- **Déclenchement.** Le même suivi de contacts que le piège à pointes, sur l'arête de déplacement réellement payée : un pillard qui marche dessus allume la mèche, le piège reste en place 14 ticks Core, puis explose. Un colon qui marche dessus a 0,5 % de chance de le déclencher, avec une lettre d'avertissement.
- **Explosion.** L'onde de bombe existante (celle de la tourelle) porte une variante « EEI » : Bomb pour l'explosif, Flame pour l'incendiaire avec allumage des feux, sur les humains, animaux, mécanoïdes, bâtiments, plantes, piles et ponts du rayon, en ligne de vue. Le piège détruit compte ses deux obus perdus au grand livre ; si la reconstruction est activée (par défaut dans la zone Domicile), un nouveau plan attend deux nouveaux obus.
- **Dégâts.** Balle → mèche ; feu ou coups jusqu'à 8 PV → mèche ; coup d'au moins ses PV → explosion immédiate (réaction en chaîne).
- **Évitement.** Les colons et animaux domestiques contournent les EEI exactement comme les pièges à pointes ; les pillards les ignorent.
- **Obus.** Deux objets (explosif et incendiaire) dans la catégorie « Obus de mortier » des zones de stockage et des étagères ; vendus et rachetés par les caravanes de fournisseur militaire et de marchand d'esclaves.
- **Inspection.** Effet, rayon, mèche allumée et réglage « Reconstruire automatiquement » (après la recherche, comme `CanSetAutoRearm`).
- **Sauvegardes.** Dès 357, validation stricte des deux pièges, de leur mèche, des ondes EEI, des obus (piles, grands livres, filtres), de l'enregistrement EEI et des plans de piège (qui exigent la recherche). Une sauvegarde 356 migre par le seul numéro, sans rien offrir ; une 356 qui en contiendrait est refusée. Une partie sans EEI garde exactement les mêmes tirages : les obus d'une caravane sont tirés sur un sous-flux dérivé du flux privé de la caravane, si bien que ses autres marchandises, ses gardes et la suite du jeu tirent comme avant ; seules les piles d'obus, quand il y en a, prennent de nouvelles identités.

## Adaptations

- **Fuite devant la mèche.** Le jeu de base avertit les humains proches d'un explosif qui va sauter ; avec une mèche de 15 ticks (un quart de seconde), Elsewhere ne fait pas fuir les colons devant un EEI.
- **Marque de souffle.** La saleté « marque de souffle » de l'obus explosif n'existe pas encore ; elle n'est pas posée.
- **Mèche déclenchée par des dégâts.** Une balle ou le seuil de PV allument une mèche de 15 ticks pleins ; un contact, 14 (le tick du piège compte déjà).
- **Stock des caravanes.** Les cinq obus du jeu de base gardent leur poids dans le tirage ; les trois non représentés (IEM, fumée, mousse) ne donnent rien. Le tirage suit les distributions du jeu de base sur un sous-flux privé, pas dans le flux de la caravane elle-même (déjà une adaptation privée), pour ne rien décaler du reste.

## Ce qui reste

- Pièges EEI à IEM, à fumée, à mousse et à ogive antigrain : ni les obus IEM, fumigènes et anti-incendie, ni les dégâts fumée et ogive antigrain n'existent encore ; l'IEM d'Elsewhere ne vient que du lance-IEM.
- Fabrication des obus (recherche Mortiers, atelier d'usinage) et le mortier lui-même.
- Les obus en pile n'explosent pas encore quand on les endommage (jeu de base : mèche de 30 à 60 ticks sous 70 % de PV, rayon croissant avec la pile).
- Obus vendus par les bases outlanders et les vaisseaux de fournisseurs militaires, que le commerce d'Elsewhere ne représente pas.
- Proportion des pillards qui connaissent les pièges selon leur lord (`ILordAvoidTraps`), comme pour le piège à pointes.
