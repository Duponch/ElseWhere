# Mort des pillards à terre — V320

Schéma 320. Dans le jeu de base, un humain d'une autre faction (pillard, visiteur, marchand) qui tombe sous une violence extérieure peut mourir sur le coup. C'est pourquoi un raid laisse des morts et seulement quelques blessés à capturer. Elsewhere laissait survivre tous les pillards à terre.

## Règle

La chance de mourir dépend de l'« intention de population » du conteur Cassandra, c'est-à-dire de son envie de voir la colonie grandir :

| Intention | Chance de mourir |
|---|---|
| −1 | 86,7 % |
| 0 | 80 % |
| 1 | 56,6 % |
| 2 | 50 % |
| 8 | 26,3 % |

La difficulté « Récit d'aventure » ne modifie pas cette chance (facteur 1).

L'intention se calcule ainsi :
- **Population de la colonie :** 1 par colon libre, 0,5 par prisonnier de la colonie, sur toutes les cartes et dans la caravane.
- **Courbe du conteur :** 0 colon donne 8 ; 1 donne 2 ; 4 donne 1 ; 7 donne 0,35 ; 11 donne 0 ; 20 donne −1.
- **Adaptation :** une intention positive est réduite après l'arrivée d'un nouveau colon. Elle vaut zéro à l'arrivée puis remonte en 8 jours, par demi-journées, comme dans le jeu de base. Elle part aussi de zéro au début de la partie.

Exemple avec 3 colons, longtemps après la dernière arrivée : intention 1,33, chance de mort environ 54 %.

Ne sont jamais concernés :
- un colon ;
- un prisonnier de la colonie ;
- une personne tombée sans violence extérieure (maladie, faim, perte de sang).

## Arrivées de colons

L'adaptation repart de zéro à chaque nouveau colon :
- prisonnier recruté ;
- rescapé d'une capsule qui rejoint la colonie ;
- personne poursuivie qui rejoint la colonie par une quête.

## Sauvegardes

Une sauvegarde 319 passe à 320 en changeant seulement son numéro. Sans date d'arrivée connue, l'adaptation part du début de la partie : dans une partie déjà avancée, elle est donc complète.

## Vérifications

`tests/raider-death-320.test.ts` couvre :
- la population, l'intention, l'adaptation et la chance de mort ;
- un vrai tir qui met à terre : certains pillards meurent, jamais un colon ;
- le refus du champ d'adaptation avant 320 ;
- la migration.
