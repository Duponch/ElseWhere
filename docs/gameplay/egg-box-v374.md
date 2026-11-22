# Boîte à œufs, filtre des vêtements de mort et option des factures — schéma 374

Schéma 374. Trois manques du jeu de base comblés ensemble : la **boîte à œufs**, où les animaux de la colonie pondent et que les porteurs vident vers une réserve, et les deux restes du lot « Dépouiller » ([schéma 351](strip-v351.md)) : le filtre « vêtements de mort » des politiques de tenue et l'option « compter les vêtements de mort » des factures de vêtements.

Les règles viennent des définitions et du code décompilé de RimWorld 1.6 (ThingDef `EggBox` de `Buildings_Misc.xml`, `CompThingContainer`, `CompEggContainer`, `CompProperties_ThingContainer`, `JobGiver_LayEgg`, `JobDriver_LayEgg`, `GenClosest.ClosestThing_Regionwise_ReachablePrioritized` et `RegionProcessorClosestThingReachable`, WorkGiverDef `EmptyEggBox` et `WorkGiver_EmptyEggBox`, `JobDriver_EmptyThingContainer`, `CompHatcher` ; SpecialThingFilterDef `AllowDeadmansApparel` et `SpecialThingFilterWorker_DeadmansApparel`, `ThingFilter`, `OutfitDatabase`, `JobGiver_OptimizeApparel` ; `Bill_Production.includeTainted`, `RecipeWorkerCounter.CountProducts` et `CountValidThing`, `Dialog_BillConfig`). Seuls les faits sont repris, réécrits ; aucun texte ni code du jeu n'est copié.

Rien ne change avant 374 : aucune boîte ne se construit, une poule ne cherche aucune boîte, les factures et les politiques gardent leur comptage. Champs nouveaux, validés strictement et refusés avant 374 : le contenu d'une boîte (propriétaire `egg-box374` d'une pile d'œufs), la boîte visée par une ponte (`box374`), l'attente d'extraction d'un porteur (`eggBox374`), le refus des vêtements de mort d'une politique (`taintedAllowed374`) et l'option des factures (`includeTainted374`). La migration 373 → 374 ne change que le numéro.

## La boîte à œufs

**Architecte → Mobilier → Boîte à œufs**, sans recherche ni compétence : 1 × 1, non orientable, **20 bois ou acier** (catégories Métal et Bois du jeu de base ; l'acier est le seul métal de construction d'Elsewhere), travail 2 000 multiplié par le facteur du matériau (1 400 en bois), 50 points de vie (× 0,65 en bois), inflammabilité 1, masse 3 kg une fois emballée, coût de passage 10 ; on marche dessus. Elle se désinstalle et se réinstalle comme les autres meubles.

**Contenance.** Comme `CompThingContainer` et `CompEggContainer` : une boîte vide accepte n'importe quel œuf ; une boîte qui en contient accepte le même œuf tant qu'elle en tient moins de **25** ; la ponte entière est alors ajoutée (une tortue peut porter une boîte de 24 à 27). Seuls les œufs y entrent. Les œufs d'une boîte ne sont pas au sol : personne ne les mange ni ne les range, ils ne comptent pas dans les stocks, l'usure du plein air ne les touche pas ; ils pourrissent et incubent comme ailleurs, à la température de la case. Un œuf fécondé qui éclot donne son petit autour de la boîte ; un œuf fécondé gâté par la température devient non fécondé dans la boîte.

**Ponte.** Comme `JobGiver_LayEgg`, un animal **de la colonie** prêt à pondre cherche d'abord une boîte : construite, à 30 cases au plus (distance à vol d'oiseau), qui accepte son prochain œuf et qu'aucun porteur n'est en train de vider. Priorité 0,5 pour une boîte vide, 5 × le nombre d'œufs sinon : il remplit la boîte la plus pleine, puis la plus proche. Il marche jusque sur la boîte, attend **500 ticks** du jeu de base, puis pond dedans si elle est toujours là et l'accepte encore ; sinon il pond à côté. Un animal sauvage, ou un animal de la colonie sans boîte utilisable, pond au sol comme avant.

**Vider.** Donneur de travail **Transport**, priorité interne 20 (`EmptyEggBox`) : un porteur ne vide une boîte que lorsqu'elle contient **20 œufs** ou plus, et seulement si une réserve les accepte (la meilleure priorité, puis la case la plus proche de la boîte). Il touche la boîte, l'ouvre pendant **120 ticks** du jeu de base, pose tous les œufs à ses pieds, puis porte la pile vers la réserve. Le contenu d'une boîte détruite, déconstruite ou désinstallée tombe autour d'elle, avec la même identité.

**Inspection.** La boîte montre son contenu (« Œuf de dinde non fécondé × 12 / 25 »), le seuil de vidage et, pour des œufs fécondés, l'avancée de l'incubation.

## Filtre « vêtements de mort » des politiques de tenue

Le jeu de base donne à chaque politique de tenue le filtre « autoriser les vêtements souillés » (`AllowDeadmansApparel`), autorisé par défaut. Dans **Assignations → Tenues**, chaque politique a désormais une ligne **Vêtements de mort : Autorisés / Interdits**. Une politique qui les interdit ne fait jamais enfiler un vêtement porté au moment de la mort de quelqu'un, et le colon qui en porte un (sans port forcé) l'enlève de lui-même, comme `JobGiver_OptimizeApparel` le fait de tout vêtement que la politique refuse. La copie d'une politique garde le réglage.

## Option des factures de vêtements

Comme `Bill_Production.includeTainted`, une facture « jusqu'à X en réserve » d'un vêtement a l'option **Compter les vêtements de mort**, décochée par défaut : un vêtement pris sur un mort ne compte pas dans la réserve, et l'établi en refait. Cochée, il compte.

## Adaptations

- **Catégorie Architecte.** La boîte est dans Mobilier, à côté du couchage animal : Elsewhere n'a pas d'onglet Divers, où le jeu de base la range.
- **Recherche de la boîte.** Le jeu de base parcourt d'abord au moins 10 régions et s'arrête dès qu'il a trouvé ; Elsewhere examine toutes les boîtes à 30 cases et départage les égalités de priorité et de distance par le coût du chemin. Une boîte que la poule ne peut atteindre est écartée, et la ponte au sol reste possible le même tick.
- **Porter.** Les porteurs d'Elsewhere portent dix objets au plus : de 20 à 27 œufs posés, ils en portent dix tout de suite, le reste attend au sol le transport ordinaire. Le contact est celui d'Elsewhere (même case ou case voisine).
- **Pas de vidage forcé.** Le jeu de base permet d'ordonner de vider une boîte qui n'a pas atteint 20 œufs (menu du clic droit) ; cet ordre n'est pas repris.
- **Œufs gâtés.** Dans le jeu de base, une boîte dont les œufs sont gâtés se vide sans attendre 20 œufs et n'en accepte plus ; dans Elsewhere un œuf gâté redevient non fécondé le jour même, si bien qu'une boîte ne garde jamais d'œufs gâtés.
- **Modèle.** La caisse et sa paille ne montrent pas les œufs : le contenu se lit dans l'inspecteur (le jeu de base dessine l'œuf et le nombre au zoom le plus proche).
- **Politiques de départ.** Dans le jeu de base, les tenues de départ Ouvrier, Soldat et Nudiste interdisent les vêtements de mort, « Tout » les autorise. Elsewhere n'a que **Tout vêtement** (comme « Tout ») et **Tenue entretenue** (sa propre tenue, sans équivalent) : les deux les autorisent, comme le filtre par défaut du jeu de base et les anciennes parties ; le joueur les interdit où il veut.
- **Anciennes factures.** Une facture dont le filtre de réserve date d'avant 374 garde son comptage historique (vêtements de mort compris) ; l'option apparaît cochée et devient explicite au premier réglage. Toute nouvelle facture, ou tout filtre activé depuis 374, part de l'option décochée.

## Ce qui reste

- L'ordre manuel de vider une boîte et le menu du clic droit qui va avec.
- L'affichage des œufs dans la boîte sur la carte.
- Le poulet n'existe pas dans Elsewhere : pondent les canards, dindes, émeus, autruches, casoars, tortues, iguanes et cobras.

## Vérifications

`tests/eggbox-374.test.ts` (11 cas, par de vrais pas de simulation sauf les règles pures) : une dinde de la colonie va sur la boîte et pond dedans, l'inspecteur montre le contenu ; une boîte pleine est ignorée et une boîte remplie avant l'arrivée fait pondre à côté ; un porteur vide une boîte de 20 œufs (contact, 120 ticks, dépôt, réserve) avec conservation des œufs ; pas de vidage sous 20 et contenu au sol après déconstruction ; faits du jeu de base et construction depuis l'Architecte, refusée avant 374 ; filtre des politiques (défaut, refus, copie, sauvegarde, déshabillage réel) ; comptage des factures avec et sans l'option ; incubation et éclosion dans la boîte ; sauvegarde et rechargement pendant la marche vers la boîte et pendant l'extraction ; refus stricts des sauvegardes ; migration 373 → 374 par le seul numéro et, avant 374, une poule qui ignore une boîte exactement comme s'il n'y en avait pas.
