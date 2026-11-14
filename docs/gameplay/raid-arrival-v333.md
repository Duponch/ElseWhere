# Modes d'arrivée des raids : groupes et capsules — V333

Schéma 333. Dans le jeu de base, un raid choisit son mode d'arrivée : à pied par un bord de la carte, à pied en plusieurs groupes, ou en capsules de largage. Elsewhere faisait toujours entrer les assaillants à pied par un seul point du bord ; les raids de la colonie tirés par Cassandra tirent désormais leur mode comme le jeu de base.

Faits relus dans le jeu de base 1.6 : `PawnsArrivalModes.xml`, `RaidStrategies_Basic.xml`, `Ethereal_Skyfallers.xml`, et le code décompilé de `PawnsArrivalModeWorker_*`, `PawnsArrivalModeWorkerUtility`, `IncidentWorker_Raid`, `DropCellFinder`, `DropPodUtility`, `Skyfaller` et `ActiveTransporter` (faits seulement, aucun code repris).

## Choix du mode

Poids du jeu de base selon les points du raid (linéaires entre les points, constants au-delà) :

| Mode | Poids | Technologie |
|---|---|---|
| À pied, un point du bord | 1 jusqu'à 300 points, 0,4 à partir de 700 | toutes |
| À pied, plusieurs groupes | 0 à 100 points, 0,3 à 300, 0,5 à partir de 700 | toutes |
| Capsules à l'écart | 0 jusqu'à 300 points, 0,3 à partir de 700 | industrielle |
| Capsules, plusieurs groupes | 0 à 100 points, 0,2 à 300, 0,5 à partir de 700 | industrielle |
| Capsules au cœur de la colonie | 0 jusqu'à 300 points, 3,5 à partir de 1 000 | industrielle |
| Capsules dispersées | 0 jusqu'à 300 points, 1,9 à partir de 1 000 | industrielle |

- Un raid qui se regroupe avant l'assaut (V330) n'arrive que par un bord : à pied ou en capsules à l'écart, seul ou en groupes.
- Les tribus (technologie néolithique) arrivent toujours à pied ; pirates et hors-la-loi peuvent tomber du ciel.
- Sous 100 points, et pour le raid d'introduction ou les petits raids de quête, seule l'arrivée à pied par un point pèse.

Comme dans le jeu de base, certains modes réduisent les points du raid : × 0,9 pour les deux modes en groupes, de × 0,5 à × 0,3 (vers 5 000 points) au cœur de la colonie, de × 0,7 à × 0,45 pour les capsules dispersées. La composition est alors refaite avec ces points, sans descendre sous 1,05 fois le coût du combattant le moins cher de la faction.

## Arrivée à pied en groupes

Deux groupes, ou trois à partir de six assaillants (règle du jeu de base : la moitié des assaillants, entre 2 et 3). Les premiers assaillants fondent chacun un groupe, les autres rejoignent un groupe au hasard. Chaque nouveau point d'entrée est le plus éloigné des précédents parmi quatre tirages.

## Capsules de largage

- **À l'écart** : un point de chute tiré au hasard, découvert, sans toit, à cinq cases au moins du bord, relié à la colonie, et à l'écart des colons et des bâtiments de la colonie (65 cases, moins 0,2 par case essayée ; la 301e case essayée est prise sans condition).
- **Au cœur de la colonie** : près d'un colon tiré au hasard, une case à moins de 10 cases de marche où une capsule peut tomber. Quatre fois sur dix, si la colonie a une balise commerciale orbitale alimentée, la chute vise la balise. Sans case possible, le raid tombe à l'écart (avec le délai d'ouverture du cœur de la colonie, comme le jeu de base).
- **Dispersées** : chaque capsule vise une case tirée sur toute la carte.
- **En groupes** : chaque groupe a son point de chute à l'écart.

Chaque assaillant a sa capsule. Une capsule tombe sur une bonne case à 5 à 16 cases de son point de chute, reliée à lui ; si ce point est à l'intérieur, elle cherche d'abord la même pièce, puis une autre pièce.

Une capsule tombe pendant 120 à 200 ticks du jeu de base. Quinze ticks avant l'impact, elle perce un toit léger (construit ou de roche fine) avec l'effondrement de toit des capsules de départ ; elle ne vise jamais une case sous un toit de roche épais. Une fois posée, elle s'ouvre quand son âge dépasse le délai : 140 ticks, ou 520 au cœur de la colonie et pour les capsules dispersées. L'assaillant en sort armé, sur la case de la capsule, et la capsule laisse une scorie d'acier. Le raid ne se termine pas tant qu'une capsule reste fermée.

Un raid de capsules qui se regroupe le fait à son point de chute ; un raid en groupes, chaque groupe à son propre point.

Le journal annonce le mode (par exemple « tombe(nt) du ciel en capsules près de la colonie, en plein cœur de vos positions ! ») et le panneau des raids affiche le mode et les capsules encore en approche. Les capsules qui tombent puis s'ouvrent sont dessinées dans un lot GPU commun ; leur chute et l'ouverture des trappes suivent le tick confirmé.

## Adaptations

- Elsewhere tire la composition avant la stratégie et le mode ; le mode est donc tiré après, et la composition refaite quand le mode réduit les points. Le plancher de 1,05 fois le combattant le moins cher ne s'applique qu'à ces modes. Le facteur 0,95 de l'attaque « habile » n'est toujours pas appliqué (V330).
- Les assaillants à pied entrent sur les cases libres du bord les plus proches du point d'entrée de leur groupe ; le jeu de base les place jusqu'à 8 cases autour.
- Tous les groupes forment un seul raid : pertes, délai de renoncement et retraite sont communs. Le jeu de base donne un seigneur à chaque groupe.
- Une capsule ne tombe pas sur une case occupée par une personne, un animal, une machine ou un tas posé au sol, ni sur une case où se trouve une construction. Une pièce « intérieure » est lue comme une enceinte couverte qui ne touche pas le bord de la carte.
- Vers la balise commerciale, seule la première balise découverte est visée ; la recherche plus large du jeu de base autour des balises et consoles alimentées n'est pas reprise.
- L'assaillant naît à l'ouverture de sa capsule, avec l'identité réservée à l'arrivée ; dans le jeu de base il est déjà dans la capsule. Une capsule sans case libre autour d'elle reste fermée jusqu'à ce qu'une case se libère.
- Les capsules sont traitées au tick local (10 ticks du jeu de base) : chute, toit et ouverture se produisent au premier tick local qui atteint leur tick du jeu de base.

Cela ne concerne que les raids de la colonie tirés par Cassandra. Les raids mécaniques, ceux des cartes temporaires, des caravanes et du réacteur du vaisseau gardent leur comportement.

## Sauvegardes

Une sauvegarde 332 passe à 333 en changeant seulement son numéro ; aucun mode ni capsule n'est inventé pour un raid déjà en cours. Le mode, ses points d'entrée et ses capsules sont validés strictement : mode permis par la stratégie et la faction, nombre de groupes, capsules dans l'ordre des assaillants, chute dans la fenêtre du jeu de base, ouverture exactement après le délai, cases distinctes, faction des assaillants à naître. Un assaillant d'une capsule fermée n'existe que par son identité réservée : aucune autre chose ne peut la porter.

## Vérifications

`tests/raid-arrival-333.test.ts` couvre :
- les fréquences des modes selon les poids, à plusieurs niveaux de points, et les filtres de stratégie et de technologie ;
- la composition refaite selon les points du mode ;
- les groupes à pied à des points du bord distincts ;
- la chute puis l'ouverture des capsules aux bons ticks, avec des assaillants vivants et armés sur les cases des capsules, et la faction tirée ;
- le toit léger percé, le toit épais évité ;
- le regroupement d'un raid de capsules à son point de chute ;
- les sauvegardes pendant la chute, le refus d'une arrivée falsifiée, l'absence de mode avant 333 et la migration.
