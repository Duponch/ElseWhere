# Petites créatures, membres blessés et soins hors carte — V324

Schéma 324. Ce lot corrige quatre écarts restants des audits du combat et de la santé.

## Dégâts reportés sur les petites créatures

Dans le jeu de base, une créature dont l'échelle de santé ne dépasse pas 0,5 subit deux fois un coup d'au moins 10 dégâts. Cela concerne le lièvre, l'écureuil, le rat, le chat, le yorkshire et les petits des animaux.

La seconde application frappe la partie parente de la dernière partie touchée. Par exemple, une balle qui détruit la patte d'un lièvre frappe aussi sa jambe. Cette seconde application repasse par l'armure naturelle et par la règle qui préserve les membres extérieurs.

La règle vaut pour les balles, les flèches, les coups au corps à corps et les pièges à pointes. Une créature déjà morte ne reçoit pas la seconde application.

## Attaques à mains nues et membres blessés

Un poing frappe aussi fort que la moyenne de l'efficacité des doigts de sa main. Les dents suivent la mâchoire. Le coup de tête suit la tête, sans descendre sous 0,4 de sa force.

La pénétration d'armure et le choix de l'attaque suivent la force corrigée. Une main dont tous les doigts sont hors d'usage ne frappe plus.

Les animaux suivent la même règle pour leurs attaques du jeu de base, y compris le minimum de 0,4 quand l'attaque doit rester utilisable. Leur pénétration d'armure reste celle de l'attaque intacte, comme elle ignorait déjà l'âge.

Une main prothétique garde son poing entier, comme depuis le schéma 273.

## La langue ne saigne pas

Dans le jeu de base, la langue ne saigne pas. Cette règle vaut sans condition de version : la langue couvre 0,1 % du corps.

## Soins des personnes hors carte

Une personne hors carte se soigne seule, sans médicament. La qualité de base vaut 0,225 ; le jeu de base y ajoute un tirage entre −0,25 et +0,25, borné entre 0 et 0,7. La moyenne ne change pas, mais les soins varient désormais d'une fois à l'autre.

## Sauvegardes

Une sauvegarde 323 passe à 324 en changeant seulement son numéro.

## Vérifications

`tests/combat-health-fidelity-324.test.ts` couvre :
- le report des dégâts, aux balles et au corps à corps, avec ses seuils ;
- la force des poings, des dents et du coup de tête ;
- la langue ;
- la marge du soin hors carte ;
- la migration.
