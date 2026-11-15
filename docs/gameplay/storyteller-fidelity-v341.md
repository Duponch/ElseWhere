# Conteur : plusieurs raids à la fois, incidents récents — V341

Schéma 341. Ce lot termine les écarts restants de l'audit du conteur (Cassandra classique, difficulté Aventure), hors sièges, sapeurs et brèches.

## Plusieurs raids sur la carte

Dans le jeu de base, chaque créneau de grosse menace lance son raid, même si un raid précédent est encore sur la carte. Aucune règle ne l'en empêche, et chaque raid suit son propre chef de groupe.

Elsewhere perdait le créneau tant qu'un raid était en cours. Le cas le plus courant était le raid mécanoïde : ses machines ne battent jamais en retraite, et tous les créneaux suivants étaient perdus jusqu'à leur destruction.

Désormais, un raid qui arrive pendant un autre raid entre quand même sur la carte. C'est un groupe à part, avec les mêmes règles qu'un raid ordinaire :
- faction tirée parmi les factions hostiles et effectif payé par les points de menace du moment ;
- regroupement avant l'assaut ou attaque immédiate ;
- arrivée à pied ou en capsules ;
- délai d'abandon et seuil de pertes propres à ce groupe ;
- retraite, sortie par le bord de la carte, mort à terre des pillards ;
- bilan propre à la fin du groupe.

Un raid humain peut ainsi arriver pendant un raid mécanoïde, et l'inverse. Le calendrier attend la fin de tous les groupes avant de reprendre son compte ordinaire. L'alerte de raid compte les groupes présents, et les capsules de tous les raids sont dessinées.

Choix de mise en œuvre : le premier raid garde sa place habituelle dans la sauvegarde. Les raids suivants rejoignent la liste des groupes indépendants qui existait déjà pour les raids du réacteur et des cartes temporaires, avec une marque qui les rattache au conteur. Les systèmes qui lisaient déjà cette liste les voient sans changement.

## Incidents récents

Le jeu de base garde, pour chaque carte et pour la planète, les cinq derniers incidents survenus. Quand il tire un incident dans une catégorie, il multiplie le poids d'un incident présent dans cette liste selon sa position :

| Position | 1 (le plus récent) | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Facteur | 0,01 | 0,3 | 0,5 | 0,7 | 0,9 |

Un incident présent deux fois cumule les deux facteurs. Le même incident deux fois de suite devient donc cent fois moins probable.

La liste reçoit chaque incident lancé par le conteur, sauf les quêtes, le raid ennemi et les maladies, que le jeu de base exclut. Elsewhere y place :
- les incidents divers de la colonie ;
- la folie d'un animal ;
- les visiteurs, les passants, les caravanes commerçantes et les vaisseaux marchands en orbite ;
- l'éclipse, l'éruption solaire et l'aurore, dans la liste de la planète.

Les poids sont appliqués partout où le jeu de base les applique : les incidents divers (y compris le premier, au jour 4,4), les grosses menaces après le jour 20 et les incidents de la planète. Pour les petites menaces, la folie d'un animal est le seul incident possible : elle reste toujours tirée, mais elle compte dans la liste.

Exemple : juste après une infestation, à partir de 400 points de menace, un créneau de grosse menace donne un raid 50 % du temps au lieu de 42 %.

Adaptations :
- les incidents qu'Elsewhere n'a pas encore et que les tirages gardent comme tickets sans effet (infestation, apaisement psychique, pousse d'ambroisie…) entrent dans la liste comme s'ils étaient survenus, comme dans le jeu de base ;
- les incidents absents hors de ces tirages (chute de débris de vaisseau, raid allié) n'y entrent pas.

## Points déjà corrigés

- **Quêtes acceptées au bon moment.** La courbe d'acceptation est lue à la date de la quête depuis le schéma 329.
- **Brouillard.** La folie d'un seul animal ne vise plus un animal caché sous le brouillard depuis le schéma 328.

## Écarts restants

- Les sièges, les sapeurs et les raids qui percent les murs.
- Les incidents de la planète ne retirent pas encore du tirage ceux qui ne peuvent pas survenir.
- Les pillards d'un raid sur la colonie n'enlèvent pas encore de colon.

## Sauvegardes

Une sauvegarde 340 passe à 341 en changeant seulement son numéro. Les listes d'incidents récents commencent vides, et aucun raid n'est ajouté.

## Vérifications

`tests/storyteller-fidelity-341.test.ts` couvre :
- deux raids sur la carte en même temps, en vrais ticks, avec sauvegarde et rechargement identiques tant que les deux sont actifs ;
- la fin de l'un puis de l'autre et la reprise du calendrier ;
- un raid humain pendant un raid mécanoïde ;
- les règles inchangées avant le schéma 341 ;
- les facteurs des incidents récents, mesurés sur de nombreux tirages ;
- la liste dans les sauvegardes ;
- la migration.
