# Maladie du sommeil — V309

Schéma 309. Dans les forêts tropicales et les marécages tropicaux, le conteur tirait déjà la maladie du sommeil (poids 140 sur 730 dans la catégorie maladie), sans aucun effet. Elle atteint désormais de vrais habitants, selon les règles de RimWorld 1.6 Core (`SleepingSickness`). Elle utilise le même système que le paludisme et la peste : gravité, immunité, soins et chance propre à chaque malade. Les textes sont propres à Elsewhere.

## Évolution

- **Gravité** : elle commence faible et monte de **12 % par jour**. Quand l'immunité atteint 100 %, elle baisse de 17,6 % par jour.
- **Immunité** : elle progresse de 10 % par jour, selon la vitesse de guérison et la chance propres au malade. L'immunité est donc en général acquise avant que la maladie ne tue, sauf si quelque chose ralentit la guérison.
- **Soins** : un soin de qualité *q* retire 7 % × *q* par jour pendant **35 heures** (32 heures plus 3 heures de chevauchement). Il se renouvelle pendant ces 3 dernières heures.
- **Décès** à 100 % de gravité.

## Stades

| Gravité | Douleur | Conscience | Manipulation |
|---|---|---|---|
| moins de 43,75 % | +2 % | −2 points | −2 points |
| à partir de 43,75 % | +3 % | −4 points | −4 points |
| à partir de 62,5 % | +5 % | −15 points | −6 points |
| à partir de 87,5 % (mortelle) | +10 % | −20 points | −20 points |
| à partir de 93,75 % | +15 % | 10 % au plus | −20 points |

La maladie donne la pensée « Malade » et impose le repos au lit, comme le paludisme.

## Limite

Le vomissement des stades avancés n'est pas encore représenté : dans le jeu de base, il survient en moyenne tous les 3,5, 1,75 puis 1 jour.

## Sauvegardes

Une sauvegarde 308 passe à 309 en changeant seulement son numéro ; aucune maladie n'est donnée. Le dossier médical n'accepte la maladie du sommeil, ou un décès qu'elle a causé, qu'à partir du schéma 309.

## Vérifications

`tests/sleeping-sickness-309.test.ts` couvre :

- la progression, les stades et le décès ;
- la durée et l'effet d'un soin ;
- la cible de soin, la douleur et la pensée « Malade » ;
- la sauvegarde ;
- le tirage, limité au schéma 309 ;
- la migration 308 → 309.
