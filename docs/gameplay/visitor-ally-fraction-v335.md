# Voyageurs et visiteurs selon la part de factions amies — V335

Schéma 335. Dans le jeu de base, le conteur envoie voyageurs, visiteurs et caravanes marchandes selon la part de factions amies du monde. Chaque occasion prévue n'est retenue qu'avec cette probabilité. Elsewhere l'appliquait aux caravanes marchandes depuis le schéma 332, mais pas encore aux voyageurs ni aux visiteurs : environ 1,36 fois trop de visites.

## Ce qui change

La part retenue suit la courbe du jeu de base sur la fraction des factions non hostiles parmi celles qui peuvent l'être :

| Factions non hostiles | Occasions retenues |
|---|---|
| Un quart ou moins | 60 % |
| Toutes | 100 % |

Entre les deux, la part augmente en ligne droite. Sans aucune faction amie, aucun voyageur ni visiteur ne vient. Les calendriers ne changent pas : six occasions de voyageurs et quatre de visiteurs par an, comme avant. Une occasion refusée est consommée.

## Adaptations

- Un monde ancien sans registre de factions retient toutes les occasions, comme les caravanes du lot 332.
- Le tirage d'acceptation est propre à chaque occasion : le reste des tirages des visiteurs ne change pas.

## Sauvegardes

Une sauvegarde 334 passe à 335 en changeant seulement son numéro.

## Vérifications

`tests/visitor-ally-fraction-335.test.ts` couvre :
- la part retenue sur 4 000 occasions, égale à la fraction à 3 % près ;
- l'acceptation totale avant 335 et sans registre, le refus total sans faction amie ;
- une occasion de voyageurs consommée sans arrivée quand toutes les factions sont hostiles ;
- la migration.
