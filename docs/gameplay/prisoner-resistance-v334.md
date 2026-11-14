# Résistance des prisonniers selon le type de pillard — V334

Schéma 334. Dans le jeu de base, la résistance initiale d'un prisonnier dépend de son type : un pillard capturé se tire dans la plage de son type, puis est arrondie au hasard. Elsewhere tirait toujours entre 7 et 12, la plage du vagabond, quel que soit le pillard capturé.

## Ce qui change

Chaque pillard d'un raid de Cassandra garde son type, celui de sa place dans la composition du raid. À la capture, la résistance initiale se tire dans la plage du jeu de base pour ce type :

| Type | Résistance initiale |
|---|---|
| Vagabond, pirate | 7 à 12 |
| Brute | 14 à 23 |
| Récupérateur | 17 à 26 |
| Pénitent tribal | 10 à 17 |
| Guerrier tribal | 5 à 9 |
| Archer tribal | 17 à 27 |
| Chasseur tribal | 10 à 16 |
| Archer lourd tribal | 14 à 22 |
| Berserker tribal | 13 à 20 |
| Chef archer | 16 à 26 |
| Chef berserker | 38 à 58 |
| Villageois | 10 à 17 |
| Garde de ville | 15 à 24 |
| Mercenaire tireur | 6 à 10 |
| Conseiller de ville | 7 à 11 |

Un récupérateur ou un chef demande donc beaucoup plus de conversations qu'un vagabond avant de pouvoir être recruté ; un guerrier tribal en demande moins.

## Adaptations

- Seuls les pillards des raids de Cassandra sur la colonie ont un type. Les pillards des cartes temporaires, des caravanes et du réacteur du vaisseau, ainsi que les autres captifs, gardent la plage de 7 à 12.
- Le jeu de base ajoute un bonus de titre de noblesse, qui n'existe qu'avec l'extension Royalty : il n'est pas repris.

## Sauvegardes

Une sauvegarde 333 passe à 334 en changeant seulement son numéro : les pillards déjà présents n'ont pas de type et gardent la plage de 7 à 12. Une résistance enregistrée doit rester dans la plage du type enregistré.

## Vérifications

`tests/prisoner-resistance-334.test.ts` couvre :
- les plages du jeu de base, dont le chef berserker qui remplace la plage de sa définition parente ;
- le tirage dans la plage de chaque type, bornes atteintes, et le tirage historique sans type ou avant 334 ;
- un vrai raid, la capture d'un pillard, la validation et le rechargement de la sauvegarde ;
- le refus d'une résistance hors de sa plage, d'un type inconnu et du champ avant 334 ;
- la migration.
