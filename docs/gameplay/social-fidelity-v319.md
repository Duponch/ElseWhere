# Corrections de fidélité : vie sociale et loisirs — V319

Schéma 319. Un audit, en lecture seule, a comparé à RimWorld 1.6 Core les règles des prisonniers, de la vie sociale et des loisirs. Les points suivants concordaient déjà :
- baisse de la résistance et recrutement ;
- conversations du gardien ;
- évasions ;
- fréquence et choix des interactions ;
- effets sur l'opinion ;
- bagarres de base ;
- gains et tolérance des loisirs.

Ce lot corrige une partie des écarts confirmés.

## Corrections

- **Souvenir « M'a recruté ».** Un prisonnier recruté se souvient de son gardien : +20 d'opinion pendant 120 jours, en s'effaçant sur le dernier tiers comme les autres souvenirs sociaux. Ce souvenir est unique par recruteur et ne dépend pas de l'aptitude sociale.
- **Bagarres : personne pacifique.** Une personne dont le passé interdit la violence ne se bat jamais en réponse à une vexation ou une insulte.
- **Bagarres : malnutrition.** La malnutrition rend les bagarres plus probables, selon son stade :

  | Stade | Facteur |
  |---|---|
  | Débutante | ×1,5 |
  | Légère | ×2 |
  | Modérée | ×2,5 |
  | Sévère | ×3 |
- **Fer à cheval.** Jouer au fer à cheval entraîne le Tir (0,003 point d'expérience par tick du jeu de base), comme les échecs entraînent l'Intellect.
- **Visites aux malades : seuil.** On ne rend visite qu'à un malade dont le loisir est sous 30 % (au lieu de 35 % inclus).
- **Visites aux malades : fin.** La visite dure jusqu'à ce que le visiteur *et* le malade aient fait le plein de loisir, ou jusqu'à la fin de la durée prévue.

## Écarts restants

- **Prisonniers entre eux :** les prisonniers de la même faction ne bavardent pas, ne s'insultent pas et ne se battent pas entre eux.
- **Âge :** il ne compte ni dans la compatibilité ni dans la probabilité d'une bagarre.
- **Visites aux malades :** le malade doit être dans un lit médical (le jeu de base accepte tout lit), et le malade visité est tiré au hasard sans tenir compte de l'opinion et de la distance.
- **Récupération après une bagarre :** une différence numérique négligeable (2,47 % au lieu de 2,5 % par vérification).

## Sauvegardes

Une sauvegarde 318 passe à 319 en changeant seulement son numéro. Le souvenir « M'a recruté » n'est accepté qu'à partir de 319 ; aucun recrutement passé n'en reçoit un.

## Vérifications

`tests/social-fidelity-319.test.ts` couvre :
- le souvenir créé par un vrai recrutement, sa durée, son effacement et son unicité ;
- l'absence de ce souvenir avant 319 ;
- les facteurs de bagarre ;
- la migration.
