# Dépouiller et vêtements de mort — schéma 351

Schéma 351. Dans RimWorld 1.6, le joueur peut faire **dépouiller** un corps, une personne à terre ou un prisonnier : un colon chargé du Transport va au contact, travaille un court instant, puis laisse tomber au sol l'équipement, les vêtements et l'inventaire de la cible. Les vêtements pris sur un mort gardent la marque « porté par un mort », et celui qui les porte en souffre (pensée « vêtement de mort »). Elsewhere avait déjà la marque (`corpseWear284`, utilisée pour la valeur et le commerce) mais aucun moyen de retirer quoi que ce soit d'un corps : tout restait sur la dépouille jusqu'à l'enterrement.

Les règles viennent du code et des définitions du jeu de base (Designator_Strip, StrippableUtility, WorkGiver_Strip, JobDriver_Strip, Pawn.Strip et Corpse.Strip, Pawn_ApparelTracker, Apparel.Notify_PawnKilled, Faction.Notify_MemberStripped, FloatMenuOptionProvider_Strip, ReverseDesignatorDatabase, ThoughtWorker_ApparelThought, ThoughtWorker_DeadMansApparel ; DesignationDef, WorkGiverDef et JobDef Strip ; ThoughtDef DeadMansApparel). Seuls les faits sont repris, ni code ni texte.

La règle ne vaut qu'à partir du schéma 351 : avant, aucune commande n'est acceptée et aucune pensée n'apparaît. Deux champs nouveaux, absents tant qu'ils sont vides : la liste des désignations de la carte (`strip351`) et le travail en cours d'un colon (`strip351` sur la personne), validés strictement. La migration 350 → 351 ne change que le numéro ; une sauvegarde 350 qui contiendrait déjà l'un de ces champs est refusée. Aucun tirage aléatoire n'est ajouté.

## Ce qui peut être dépouillé

Comme `StrippableUtility.CanBeStrippedByColony` :

- il faut **quelque chose à retirer** : une arme équipée, un vêtement porté ou un objet d'inventaire (meubles emballés compris) ;
- un **corps** est toujours accepté s'il est au sol de la carte, en place ou en pile de corps (pas porté, pas enterré, pas perdu) ;
- une **personne vivante** seulement si elle n'est pas portée et qu'elle est **à terre**, ou **prisonnière détenue** : prisonnière de la colonie, ni libérée, ni en fuite, ni en évasion, ni en crise violente. Un colon à terre peut donc être dépouillé, comme dans le jeu de base ; un colon debout, un visiteur debout ou un pillard debout, non.

Un corps interdit est ignoré par le travail ordinaire ; l'ordre direct le réautorise, comme le jeu de base.

## Désigner : ordres, clic droit, inspection

- **Ordres → Dépouiller** : cliquer ou tracer un rectangle. Chaque case connue (hors brouillard) désigne tout ce qui peut l'être et ne l'est pas encore. L'outil Annuler retire aussi ces désignations.
- **Inspection** : un bouton « Dépouiller » apparaît sur la personne ou le corps sélectionné quand la désignation serait acceptée (le jeu de base le montre comme désignateur inverse), et devient « Annuler le dépouillement » une fois désigné. Le même bouton existe sur une pile de corps.
- **Clic droit** d'un colon sur la case : « Prioriser : Dépouiller … ». C'est un ordre direct, sans désignation et sans file d'attente (Maj refusé, comme la capture ou l'ouverture de capsule). Un colon **mobilisé** peut aussi le recevoir : il reste mobilisé et attend sur place une fois le travail fini.

Désigner un membre vivant d'une faction visible et non hostile affiche un avertissement : le dépouiller coûtera **40 points de relation** (voir plus bas).

La désignation reste attachée à la chose désignée. Elle disparaît quand la cible quitte la carte, est portée (secours, capture, transport vers une tombe), enterrée ou détruite, quand une personne vivante désignée meurt (son corps est une nouvelle chose) et quand elle rejoint ou quitte la colonie. Une cible qui devient simplement impossible à dépouiller (elle s'est relevée, il ne reste rien) **garde sa désignation**, comme dans le jeu de base, mais personne ne vient la dépouiller.

## Le travail

Donneur de travail du **Transport**, priorité interne 100, juste avant le transport des corps (90) : comme tous les donneurs de la planification à la RimWorld, il passe après les types de travail de priorité plus haute. Il ne fait **rien** tant qu'aucune désignation n'existe : pas de recherche de corps à chaque pas.

Le colon choisit la cible désignée la plus proche (distance à vol d'oiseau, puis ordre de désignation) qu'il peut atteindre, autorisée, dans sa zone permise, et que personne d'autre n'occupe : un autre colon qui la dépouille, la porte vers une tombe, la secourt, la soigne, la nourrit, l'opère ou s'en occupe comme geôlier. Il marche jusqu'à la case de la cible ou une case voisine, puis travaille **60 ticks du jeu de base** (6 pas d'Elsewhere) au contact. Le travail est abandonné si la cible disparaît, entre en crise violente, n'est plus dépouillable, ou si un autre travail la réserve.

À la fin, comme `Pawn.Strip` : l'équipement tombe d'abord, puis les vêtements, puis l'inventaire, chacun sur une case libre voisine de la cible. Arme et vêtements sont autorisés et perdent la protection « tenue imposée » ; l'inventaire garde son état. Les mêmes objets, avec leurs identités et quantités, passent au sol : rien n'est créé ni perdu. Si une chose ne trouve pas de place, **rien ne bouge** et la désignation reste.

Un vêtement porté au moment de la mort garde sa marque « porté par un mort » (posée à la mort, comme `Apparel.Notify_PawnKilled`) ; dépouiller ne la pose ni ne l'enlève. Les vêtements retirés à un vivant restent propres.

## Relations

Dépouiller un membre **vivant** d'une faction visible, non hostile, et qui n'est pas la colonie coûte **40 points** de relation (`Faction.Notify_MemberStripped`), avec les règles ordinaires du changement de relation (bonus vers la valeur naturelle, bornes, seuils d'hostilité). Si la relation bascule, les personnes de cette faction présentes sur la carte suivent, comme après des pourparlers. Un pillard, un corps ou une personne sans faction du monde ne changent rien.

## Vêtement de mort

Pensée de situation du jeu de base, valable aussi hors carte (caravane) : chaque pièce portée qui a la marque compte.

| Pièces marquées | Humeur |
|---|---|
| 1 | −5 |
| 2 | −8 |
| 3 | −11 |
| 4 ou plus | −14 |

L'intitulé nomme la première pièce comptée. Le trait **Sanguinaire** annule la pensée.

Pour qui peut avoir la pensée, le choix automatique des vêtements (politique de tenue) baisse la note d'une pièce marquée comme `JobGiver_OptimizeApparel` : note − 0,5, puis × 0,1 si elle reste positive. Un colon préfère donc un vêtement propre, mais prend encore un vêtement de mort s'il n'a rien d'autre.

## Adaptations

- La cible est la personne ou son corps, repérée par l'identité de la personne : la désignation suit le corps lorsqu'il est posé au sol en pile.
- Le contact est le contact d'Elsewhere : même case ou case voisine orthogonale. Si un prisonnier s'éloigne pendant l'attente, le colon le rejoint et l'attente reprend (le jeu de base finit l'attente sans regarder la cible).
- Les autres travaux ne voient pas la réservation du dépouillement : s'ils prennent la cible (secours, enterrement), le dépouillement s'arrête proprement.
- Les animaux ne sont pas des cibles : ceux d'Elsewhere laissent déjà tomber leur inventaire à leur mort, et un animal de bât à terre n'est pas pris en charge.
- La capacité Manipulation n'est pas vérifiée séparément ; le refus médical ordinaire du travail s'applique.
- Pas d'icône de désignation sur la carte : l'état se lit dans l'inspection.

## Ce qui reste

- Les politiques de tenue n'ont pas de filtre « vêtements de mort » (le jeu de base l'interdit par défaut dans ses tenues Ouvrier, Soldat, Nudiste et Astronaute, pas dans « Tout »).
- L'option « compter les vêtements marqués » des factures de vêtements n'est pas ajoutée.
- Le dépouillement automatique avant découpe ou à la formation d'une caravane, le compteur « corps dépouillés » et le récit du jeu de base ne sont pas repris.

## Vérifications

`tests/strip-351.test.ts` (9 cas, tous par de vrais pas de simulation sauf les règles pures) : un corps dépouillé par un porteur (contact, 60 ticks, objets au sol avec la marque, identités et quantités conservées), un pillard à terre et un prisonnier capturé, les refus, la disparition des désignations, la pensée et ses paliers (et un vêtement réellement porté après dépouillement), note des vêtements marqués dans le choix automatique, sauvegarde et rechargement en plein travail, clic droit mobilisé ou non et boutons d'inspection, relations, et rien de changé avant 351 avec la migration 350 → 351.
