# Vêtements dans tous les cuirs et laines — V308

Schéma 308. Le jeu produisait déjà quinze cuirs et laines du jeu de base, en dépeçant ou en tondant les animaux, mais ils ne servaient qu'aux sacs de couchage et aux demandes commerciales. Comme dans RimWorld 1.6 Core, ils deviennent des matières de couture. Les vêtements de base acceptent tout tissu ou cuir ; la tuque n'accepte que le tissu, c'est-à-dire les laines. Code : `src/sim/textile-apparel-308.ts`.

## Matières ajoutées

| Matière | Protection tranchant | Isolation froid | Isolation chaud | Solidité | Valeur |
|---|---|---|---|---|---|
| Cuir de chien | 0,81 | 14 | 16 | ×1,3 | 2 |
| Cuir d'ours | 1,12 | 20 | 20 | ×1,3 | 3,4 |
| Cuir d'oiseau | 0,67 | 10 | 10 | ×1 | 1,8 |
| Fourrure de chinchilla | 0,67 | 30 | 16 | ×1 | 6,5 |
| Cuir d'éléphant | 1,12 | 14 | 12 | ×1,5 | 3 |
| Fourrure de cochon d'Inde | 0,67 | 38 | 18 | ×0,6 | 5 |
| Fourrure épaisse | 1,24 | 30 | 14 | ×1,5 | 3,3 |
| Cuir de lézard | 0,81 | 12 | 12 | ×1 | 2,1 |
| Fourrure de félin | 0,93 | 16 | 24 | ×1,3 | 3 |
| Cuir de porc | 0,64 | 12 | 12 | ×1,3 | 1,9 |
| Cuir de rhinocéros | 1,29 | 14 | 14 | ×1,5 | 4,2 |
| Cuir de loup | 1,02 | 24 | 16 | ×1,3 | 3 |
| Laine d'alpaga | 0,36 | 30 | 16 | ×1 | 3,8 |
| Laine de bison | 0,36 | 26 | 12 | ×1 | 2,7 |
| Laine de mégapareux | 0,80 | 34 | 12 | ×1 | 2,7 |

Les cuirs protègent aussi des coups (0,14 à 0,27) et de la chaleur (1,5) ; les laines protègent de la chaleur à 1,1. Toutes ces valeurs sont celles du jeu de base. Elles sont multipliées par les facteurs de chaque vêtement : la parka, par exemple, double l'isolation contre le froid.

Cela donne 78 nouveaux vêtements : tenue tribale, chemise, pantalon, cache-poussière et parka dans les quinze matières, et la tuque dans les trois laines. Leur valeur suit la règle du jeu de base : quantité de matière × valeur de la matière + travail × 0,0036.

## Partie en cours

- **Factures existantes** : elles ne se mettent pas à utiliser les nouvelles matières sans l'avis du joueur. Il faut les autoriser dans le filtre de la facture. Une nouvelle facture les accepte toutes, comme les autres matières.
- **Politiques de tenue** : à la migration, une politique qui autorisait la version en cuir ordinaire d'un vêtement autorise aussi ses versions dans les nouveaux cuirs. Il en va de même pour la laine de mufalo et les nouvelles laines, et pour la liste des matières. Une politique plus restrictive, par exemple « chemises en tissu », ne change pas.
- Aucun vêtement n'est donné.

## Adaptation visible

Le pantalon porté prend la plus proche des sept couleurs historiques, car son code de couleur n'a que seize valeurs. Le haut et la tuque gardent la couleur propre à chaque matière.

## Ce qui reste absent

La « Chemise » d'Elsewhere est la chemise boutonnée du jeu de base : 45 unités, 2 700 points de travail, isolation contre le froid 0,26. Le t-shirt du jeu de base (40 unités, 1 600 points, isolation 0,22), le blouson, le chapeau de cow-boy, le chapeau melon et la capuche restent absents.

## Sauvegardes

Avant le schéma 308, une sauvegarde ne peut contenir ni ces vêtements, ni ces matières dans une politique de tenue, ni ces clés dans le filtre d'une facture de couture.

## Vérifications

`tests/textile-apparel-308.test.ts` couvre :

- les caractéristiques et les recettes ;
- les valeurs marchandes ;
- un vrai tailleur qui coud une parka en cuir de loup, avec reprise exacte de la sauvegarde, puis la porte ;
- la limite au schéma 308 ;
- la migration des politiques.

Les tests qui fabriquent une sauvegarde ancienne en renumérotant un monde récent retirent d'abord ce que le schéma visé ne pouvait pas contenir. Ils utilisent pour cela `tests/scenarios/old-schema.ts`, car la validation stricte refuse toujours ces vêtements avant le schéma 308. Leur oracle tient compte de la migration des politiques.
