# Soigner un patient alité et colon enlevé — V336

Schéma 336. Deux écarts avec le jeu de base, dont un trouvé par la campagne « Atterrissage ».

## D'où le médecin soigne un patient alité

**Le défaut.** Au jour 13 de la campagne, Ada, blessée par un pillard, a été couchée dans le lit du milieu de trois lits côte à côte, têtes contre un mur. Elsewhere n'acceptait de la soigner que depuis une des quatre cases voisines de sa tête : deux lits, un mur et l'autre case du lit. Aucune ne convenait. Personne ne pouvait la soigner, et elle est morte d'hémorragie dans son lit pendant que la médecin récoltait du riz.

**La règle du jeu de base.** Un médecin va à la première case libre d'un ordre fixe autour du lit :

1. à côté de la tête ;
2. à côté du pied ;
3. au-delà de la tête, puis ses deux coins ;
4. au-delà du pied, puis ses deux coins.

Une case doit être praticable (on ne se tient pas sur un lit) et toucher le lit. Un coin ne compte que si l'une des deux cases qui le bordent se traverse sans porte. Une porte ne sert qu'en dernier recours. Pour un lit d'une case, l'ordre est les quatre côtés, puis les quatre coins.

**Ce qui change.** Le médecin soigne depuis la première case libre et atteignable de cet ordre. Dans la disposition de la campagne, c'est la case au-delà du pied. Le soin reste valable tant que le médecin est sur l'une de ces cases.

Adaptations :
- le jeu de base envoie le médecin à la première case de l'ordre, sans repli ; Elsewhere passe à la suivante si une case est réservée par un autre service ou inatteignable ;
- le côté « ouest » du jeu de base est, dans Elsewhere, le côté opposé à la seconde place d'un lit double ;
- ces cases ne servent pour l'instant qu'aux soins (automatiques et par ordre) ; nourrir un patient, l'opérer et parler à un prisonnier gardent les quatre cases voisines de la tête.

## Colon enlevé

Dans le jeu de base, un colon enlevé coûte à l'adaptation aux menaces la même perte qu'un colon mort, selon la population restante. Elsewhere n'en tenait pas compte. Désormais, la perte est appliquée quand le ravisseur quitte la carte avec le colon ; une chute violente notée dans le même tick pour ce colon est remplacée par cette perte, comme dans le jeu de base.

## Sauvegardes

Une sauvegarde 335 passe à 336 en changeant seulement son numéro.

## Vérifications

`tests/bedside-tending-336.test.ts` couvre :
- la disposition de la campagne : soin depuis le pied à partir de 336, aucun soin possible en 335 ;
- l'ordre complet des cases autour d'un lit isolé, et la validité d'une case au pied du lit ;
- la perte d'adaptation d'un colon enlevé, qui remplace sa chute, et rien avant 336 ;
- la migration.
