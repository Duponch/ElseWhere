# Prisonniers entre eux et visites aux malades — V325

Schéma 325. Ce lot corrige les écarts restants de l'audit de la vie sociale.

## Les prisonniers se parlent

Dans le jeu de base, chaque personne lance de temps en temps une conversation avec quelqu'un de sa faction présent sur la carte. Un prisonnier de la colonie garde sa faction d'origine : il parle donc avec les autres prisonniers de cette faction, jamais avec un colon.

Elsewhere réservait les conversations aux colons. Désormais, les prisonniers d'une même faction se parlent : bavardage, discussion approfondie, mot gentil, vexation et insulte, avec les souvenirs et l'opinion qui en découlent. Les conditions du jeu de base restent les mêmes : éveillé, capable de parler, à 6 cases au plus et en vue l'un de l'autre.

Un prisonnier ne parle pas pendant une évasion, une fuite ou après sa libération.

Deux adaptations restent :
- les prisonniers ne se font pas la cour (le jeu de base le permet) ;
- une insulte entre prisonniers ne déclenche pas de bagarre (le jeu de base le permet aussi). Les bagarres d'Elsewhere ne gèrent encore que les colons.

## Visites aux malades

Trois règles du jeu de base remplacent les anciennes :
- **N'importe quel lit.** Un colon alité pour se soigner peut recevoir une visite dans n'importe quel lit, et plus seulement dans un lit médical.
- **Pas de visite à un convalescent.** On ne rend pas visite à un malade qui ne combat aucune maladie (infection, grippe, peste, paludisme, maladie du sommeil) et dont les blessures en voie de guérison font moins de 8 points de vie au total. Les cicatrices ne comptent pas.
- **Choix du malade.** Le visiteur tire le malade selon son opinion de lui (poids 0,05 à −100, 2 à +100) et la distance (poids 1 tout près, 0,2 à 150 cases et au-delà). Avant, le malade le plus proche l'emportait.

Adaptation : si le malade tiré est inaccessible, la visite échoue et le colon choisit un autre loisir. Le jeu de base écarte d'abord les malades inaccessibles.

## Fin des bagarres

Après ses 7 premières secondes (420 ticks du jeu de base), une bagarre peut s'arrêter à chaque contrôle, toutes les 30 ticks. Le jeu de base accorde à chaque contrôle une chance de 30 sur 1 200, soit 2,5 % ; Elsewhere utilisait 1 − e^(−30/1 200), soit 2,47 %. La valeur du jeu de base s'applique désormais.

## Sauvegardes

Une sauvegarde 324 passe à 325 en changeant seulement son numéro.

## Vérifications

`tests/social-fidelity-325.test.ts` couvre :
- les conversations entre prisonniers ;
- les lits, la convalescence et le poids du choix du malade ;
- la chance de fin de bagarre ;
- la migration.
