# Armure naturelle des créatures — V321

Schéma 321. Dans le jeu de base, certaines créatures ont une armure naturelle (statistiques de race `ArmorRating_*`). Elsewhere avait ces valeurs dans ses données, mais ne les utilisait pas.

| Créature | Contre le tranchant | Contre le contondant |
|---|---|---|
| Tortue | 50 % | 35 % |
| Mégascarabée | 72 % | 18 % |
| Mégaraignée | 27 % | 18 % |
| Spélopède | 18 % | 18 % |

## Règle

À chaque balle, flèche ou coup au contact, l'armure est diminuée de la pénétration de l'arme. On tire ensuite au hasard, comme pour une armure portée :
- **sous la moitié de l'armure restante :** le coup est dévié ;
- **sous l'armure restante :** les dégâts sont divisés par deux, et un coup tranchant devient contondant ;
- **au-delà :** les dégâts passent entiers.

Exemple : une balle de revolver (pénétration 18 %) contre un mégascarabée est déviée 27 % du temps et réduite de moitié 27 % du temps. Une infestation devient donc nettement plus difficile.

Les créatures sans armure ne tirent aucun nombre aléatoire de plus : leurs combats sont inchangés.

## Sauvegardes

Une sauvegarde 320 passe à 321 en changeant seulement son numéro.

## Vérifications

`tests/natural-armor-321.test.ts` couvre :
- les valeurs d'armure ;
- le tirage (déviation, moitié, passage) et l'absence de tirage quand la pénétration suffit ;
- les tirages inchangés pour un animal sans armure ;
- la migration.
