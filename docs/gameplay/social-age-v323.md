# L'âge dans la vie sociale — V323

Schéma 323. Dans le jeu de base, l'âge biologique compte dans la vie sociale. Elsewhere connaissait l'âge de chaque colon sans s'en servir ici.

## Compatibilité

La compatibilité entre deux personnes ajoute à leur valeur propre un terme d'âge :
- même âge : +0,45 ;
- 10 ans d'écart : 0 ;
- 20 ans d'écart ou plus : −0,45.

Une bonne compatibilité rend les discussions approfondies plus fréquentes, et les vexations et insultes plus rares. Des colons d'âges proches s'entendent donc mieux.

## Bagarres

Au-delà de 10 ans d'écart (en années entières), la chance qu'une insulte ou une vexation tourne à la bagarre baisse :
- 30 ans d'écart : × 0,625 ;
- 50 ans d'écart ou plus : × 0,25.

## Sauvegardes

Une sauvegarde 322 passe à 323 en changeant seulement son numéro. Une personne historique sans âge enregistré compte pour 30 ans.

## Vérifications

`tests/social-age-323.test.ts` couvre :
- la compatibilité selon l'écart d'âge, avant et après 323 ;
- le facteur de bagarre ;
- la migration.
