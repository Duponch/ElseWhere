# Conteur : incidents divers, éclipse, quêtes et animaux — V329

Schéma 329. Ce lot poursuit les corrections de l'audit du conteur (Cassandra classique, difficulté Aventure).

## Loterie des incidents divers

À chaque occasion d'incident divers, le jeu de base tire parmi ses 21 incidents de la colonie. Elsewhere tire désormais de la même façon :
1. **Incidents impossibles retirés.** Les incidents qui ne peuvent pas survenir maintenant sortent du tirage avant la pondération : une vague de froid en été, des retombées toxiques ou un hiver volcanique avant le jour 60, une deuxième canicule. Avant, leur ticket était perdu et les autres incidents devenaient 7 à 12 % trop rares.
2. **Intention de population.** Un premier tirage choisit le groupe des incidents qui ajoutent quelqu'un à la colonie, avec une chance de 5 % à 45 % selon l'intention de population. Ces incidents sont la capsule de réfugié, l'homme sauvage, le vagabond et la demande de rançon. Dans ce groupe, chacun est pondéré par l'intention, plus ou moins 0,4 selon sa difficulté, avec un plancher de 0,05.

   Une petite colonie reçoit ainsi plus souvent une capsule de réfugié : 17,5 % des incidents divers avec trois colons, 2,6 % avec douze. Avant, c'était 8,9 % quelle que soit la taille.
3. **Incidents absents.** Les incidents qu'Elsewhere n'a pas encore restent dans le tirage sans effet : apaisement et onde psychiques, pousse d'ambroisie, passage d'un thrumbo, météorite, migration, castors alpha, vagabond, homme sauvage. La demande de rançon en sort, car elle exige un colon enlevé.

**Premier incident divers (jour 4,4).** Le jeu de base le tire à part : un seul tirage pondéré sur tous les incidents divers, sans retirer ceux qui ne peuvent pas survenir et sans tirage du groupe de population. Un incident tiré qui ne peut pas survenir ne fait rien. Elsewhere suit cette règle. Les scènes de démonstration « Canicule et refuge » et « Orage sec et incendies » déclenchent toujours leur incident à ce tirage.

Reste à faire : la pondération des incidents récents (un même incident deux fois de suite est cent fois moins probable dans le jeu de base).

## L'éclipse

Dans le jeu de base, l'éclipse appartient au composant « monde » du conteur : vérification toutes les 15 jours en moyenne, à partir du jour 15, avec l'éruption solaire et l'aurore. Elsewhere la tirait parmi les incidents divers de la colonie, dès le jour 5. Elle vient désormais du composant « monde ».

## Quêtes aléatoires

Le jeu de base tire en début de cycle la date d'une quête et un nombre au hasard. Il compare ce nombre à la courbe des jours (0 au jour 8, 1 au jour 15) au moment de la quête. Elsewhere lisait la courbe en début de cycle : entre les jours 10 et 20, la chance tombait à 29 % au lieu de 82 %. La courbe est désormais lue à la date de la quête, sans nouvel état sauvegardé.

## Les animaux dans les points de menace

Chaque animal de la colonie, debout et capable d'apprendre l'attaque (dressabilité intermédiaire ou avancée), ajoute 0,08 × sa puissance de combat aux points de menace. Ce montant est pondéré à 65 % par sa santé. Une meute de grizzlis rend donc les raids plus forts, comme dans le jeu de base. Les espèces historiques sans données du jeu de base n'ajoutent rien.

## Écarts restants de l'audit du conteur

- Une seule faction humaine attaque (les tribus et les étrangers hostiles manquent).
- Les pirates n'attendent jamais avant d'attaquer et ne tombent jamais du ciel.
- Un raid en cours fait perdre le créneau suivant.
- L'enlèvement d'un colon ne réduit pas l'adaptation.
- Les visites ne tiennent pas compte de la fraction d'alliés.

## Sauvegardes

Une sauvegarde 328 passe à 329 en changeant seulement son numéro.

## Vérifications

`tests/storyteller-fidelity-329.test.ts` couvre :
- la loterie (incidents retirés, groupe de population, repli) ;
- le premier incident divers, à travers les deux scènes de démonstration.
- l'éclipse du composant « monde » ;
- l'acceptation des quêtes ;
- les animaux dans les points ;
- la migration.
