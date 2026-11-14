# Conteur : grosses menaces, premier pillard, saisons — V328

Schéma 328. Ce lot corrige une première série d'écarts relevés par l'audit du conteur (Cassandra classique, difficulté Aventure).

## Grosses menaces après le jour 20

Avant le jour 20, chaque créneau de grosse menace de Cassandra est un raid, dans le jeu de base comme dans Elsewhere. Ensuite, le jeu de base tire la menace selon ses poids :

| Menace | Poids | Condition |
|---|---|---|
| Raid ennemi (pirates ou mécanoïdes) | 7,4 | – |
| Infestation | 2,7 | 400 points de menace |
| Meute d'animaux enragés | 2 | – |
| Pièce de vaisseau défoliante | 2 | 400 points |
| Pièce de vaisseau psychique | 2 | 400 points |
| Folie animale de masse | 1,3 | – |

Elsewhere transformait chaque créneau en raid. Il tire désormais selon ces poids. Les menaces qu'Elsewhere n'a pas encore laissent passer le créneau sans événement, comme pour les petites menaces et les incidents divers. Les raids deviennent donc moins fréquents après le jour 20 : 42 % des créneaux à partir de 400 points de menace, 69 % en dessous.

Le premier créneau du cycle, exactement au jour 11, reste silencieux comme dans le jeu de base.

## Le premier pillard

Dans le jeu de base, le pillard du raid d'introduction (jour 5,4) ne meurt jamais quand il tombe : il reste à terre et peut être capturé. Depuis le schéma 320, Elsewhere tirait aussi sa mort. Il en est désormais exempté, ce qui rend la première capture possible.

Son arme reste une adaptation : le jeu de base lui donne une arme de mêlée simple, qu'Elsewhere n'a pas encore au catalogue.

## Autres corrections

- **Saisons exclusives.** Une vague de chaleur et un hiver volcanique ne peuvent plus se chevaucher.
- **Jours entiers.** Le facteur de durée de partie des points de menace compte les jours entiers, comme le jeu de base. Le plancher de points garde le jour fractionnaire.
- **Brouillard.** La folie d'un seul animal ne vise plus un animal caché sous le brouillard.

## Écarts restants

Ce lot ne traite pas ces écarts du même audit, qui restent à faire :
- les autres factions hostiles (tribus, étrangers) ;
- l'intention de population dans les incidents divers ;
- l'éclipse dans le mauvais composant ;
- les animaux dans les points de menace ;
- les raids qui attendent ou tombent du ciel ;
- l'enlèvement et l'adaptation ;
- la fraction d'alliés des visites ;
- les quêtes évaluées au bon moment ;
- le raid en cours qui avale le créneau suivant.

## Sauvegardes

Une sauvegarde 327 passe à 328 en changeant seulement son numéro.

## Vérifications

`tests/storyteller-fidelity-328.test.ts` couvre :
- le tirage des grosses menaces et leurs seuils ;
- les jours entiers ;
- le premier pillard ;
- l'exclusion des saisons ;
- le brouillard ;
- la migration.
