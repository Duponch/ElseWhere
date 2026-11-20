# Œufs et gelée en cuisine, chapeaux de cowboy et melon — V353

Schéma 353. Deux manques des premiers jours, relevés par l'audit des bases (point 7 de la [feuille de route](../development/feuille-de-route-20261115.md)) : les œufs et la gelée d'insecte étaient refusés par tous les repas et par les croquettes, et le chapeau de cowboy, débloqué dès le départ par Vêtements complexes, n'existait pas. Les règles viennent des définitions du jeu de base 1.6 ; les textes sont propres à Elsewhere.

## Œufs et gelée d'insecte en cuisine

### Ce que dit le jeu de base

- Les œufs (non fécondés et fécondés) et la gelée d'insecte sont des **produits animaux** (`AnimalProductRaw`), une sous-catégorie des aliments crus (`FoodRaw`), comme le lait.
- **Repas simple** (et ×4) : tout aliment cru, 0,5 de nutrition (2,0 pour ×4).
- **Plats raffiné, gastronomique et repas de survie** (et leurs ×4) : une part « protéines » (viande crue ou produit animal) et une part végétale, chacune de 0,25 / 0,5 / 0,3 de nutrition (×4 : 1,0 / 2,0 / 1,2).
- **Plats végétariens** : végétaux ou produits animaux (œufs, lait, gelée), 0,75 / 1,25 de nutrition (×4 : 3,0 / 5,0).
- **Plats carnivores** et **pemmican** : les produits animaux sont exclus.
- **Croquettes** : 1,0 de protéines (viande ou produit animal) et 1,0 de végétaux ou de foin.
- **Filtre par défaut d'une nouvelle facture** (`CookMealBase`, `Make_Kibble`) : les œufs non fécondés sont acceptés ; les **œufs fécondés** et la **gelée d'insecte** sont refusés tant que le joueur ne les coche pas. Ils restent admis par la recette.
- La nutrition se compte par objet (`IngredientValueGetter_Nutrition`) : un œuf vaut 0,25 ou 0,5 (l'œuf d'autruche fécondé 0,6), la gelée 0,05. Le cuisinier prend d'abord les ingrédients les **moins nourrissants**, puis les plus proches, et pour chacun le nombre arrondi au-dessus de ce qui manque (`WorkGiver_DoBill`, mélange autorisé) : seul le dernier objet pris peut dépasser le quota.
- Le repas ne garde de ses ingrédients que leur liste (`CompIngredients`) ; ni le risque d'intoxication d'un œuf cru (0,02) ni le plaisir de la gelée ne passent au repas. Le risque d'intoxication d'un repas vient de la propreté de la cuisine et du niveau du cuisinier, comme avant. Les pensées « viande d'insecte » ne concernent que la viande, pas la gelée.

### Dans Elsewhere

- Les 16 œufs du jeu (8 espèces, fécondés ou non) et la gelée d'insecte rejoignent les recettes ci-dessus, avec leur filtre par défaut du jeu de base. Les carnivores et le pemmican ne changent pas.
- Les quotas d'Elsewhere comptent des unités de 0,05 de nutrition : un œuf de canard, de cobra, d'iguane ou de tortue vaut 5 unités, un œuf de casoar, d'émeu, de dinde ou d'autruche non fécondé 10, l'œuf d'autruche fécondé 12. Tout autre ingrédient reste à 1 unité, donc les quotas exacts des anciens ingrédients ne changent pas.
- Exemple : un repas simple se fait avec deux œufs de canard ; un plat raffiné avec un œuf d'émeu (qui dépasse la part de protéines, comme dans le jeu) et cinq unités de riz ; 1,0 de protéines de croquettes avec deux œufs d'émeu.
- Le message de cuisson d'un repas simple qui contient des œufs ou de la gelée détaille ses ingrédients.

## Chapeau de cowboy et chapeau melon

| | Chapeau de cowboy | Chapeau melon |
|---|---|---|
| Matière | 25 unités de tissu ou de cuir | 20 unités de tissu ou de cuir |
| Travail | 1 800 | 1 800 |
| Points de vie | 80 (× matière) | 80 (× matière) |
| Couche, zone | par-dessus, haut de la tête | par-dessus, haut de la tête |
| Protection (× matière) | 0,2 | 0,2 |
| Isolation froid / chaud (× matière) | 0,10 / 0,50 | 0,10 / 0,40 |
| Impact social porté | +10 % | +15 % |
| Masse | 0,14 kg | 0,14 kg |
| Recherche | vêtements complexes | vêtements complexes |

- Faits Core : `Apparel_CowboyHat` et `Apparel_BowlerHat` (qui hérite du premier), matières `Fabric` et `Leathery`, établis de tailleur à la main ou électriques, temps d'équipement 0,8 s. Les deux se cousent dans les 22 matières de couture d'Elsewhere : 44 chapeaux.
- Un seul couvre-chef à la fois : le chapeau ne se porte ni avec la tuque, ni avec un casque. Il se porte avec n'importe quel haut.
- **Impact social** : comme dans le jeu de base, le bonus s'ajoute à la base 1 avant les facteurs de compétence Sociale, de parole et d'ouïe (minimum 0,2). Il compte dans les échanges entre colons, les insultes d'une crise et le rapport du geôlier ; le dossier Social l'affiche.
- **Valeur** : quantité × valeur de la matière + travail × 0,0036 (25 tissus : 43,98).
- **Commerce** : les deux chapeaux sont les entrées 0 et 1 de la liste des vêtements du jeu de base (étiquette `BasicClothing`). Les visiteurs, les caravanes marchandes et les vaisseaux de marchandises en gros en proposent désormais, tirés par les mêmes nombres aléatoires qu'avant ; les marchands qui rachètent les vêtements ordinaires rachètent aussi les chapeaux.
- **Politiques de tenue** : les politiques d'une nouvelle partie les autorisent ; ils ont leur ligne dans l'éditeur.
- **Affichage** : un modèle de chapeau sur la tête du personnage (calotte, ruban sombre, bord large ou étroit), dans la couleur de la matière ; il cache les cheveux comme la tuque. Ce modèle ne s'ajoute au personnage commun qu'une fois un chapeau porté. Au sol, une calotte et un bord dans la couleur de la matière ; pictogrammes dessinés.

## Partie en cours

Migration 352 → 353 par le seul numéro. Rien n'est donné : une facture de cuisine déjà créée n'a pas de case pour les œufs ni la gelée et continue de les refuser jusqu'à ce que le joueur les coche ; une politique de tenue existante n'autorise pas les chapeaux tant qu'on ne les y ajoute pas.

## Sauvegardes

Avant le schéma 353, une sauvegarde ne peut contenir ni chapeau, ni son ouvrage, sa facture, sa commande ou sa mention dans une politique de tenue (contrôle des contenus futurs partagé avec la tuque), ni œuf ou gelée dans le filtre d'une facture de cuisine ou dans les ingrédients réservés d'une cuisson.

## Adaptations

- Le cuisinier classe tous les ingrédients du rayon par nutrition puis par distance ; le jeu de base étend sa recherche région par région et s'arrête à la première zone qui suffit.
- Hors des styles graphiques Origami/Pastel/Gouache (rendu de secours), le chapeau porté garde une teinte fixe au lieu de la couleur de sa matière.
- Un chapeau transporté (dans les bras d'un colon) s'affiche avec le modèle de cargaison de la tuque en tissu : 44 modèles de plus auraient dépassé le budget de la géométrie de cargaison résidente et décalé les codes de cargaison des autres objets.

## Ce qui reste

- Les **coffres à œufs** et la viande de mégarachnide dans les repas (refusée par défaut dans le jeu de base, mais admise par la recette) ne sont pas faits.
- Les variantes ×4 du pemmican et du repas de survie manquent toujours.
- Le masque en tissu (autre vêtement de Vêtements complexes) manque.

## Vérifications

`tests/cooking-hat-353.test.ts` couvre :

- les recettes, les filtres par défaut, la valeur nutritive des œufs et les quotas avec dépassement du dernier objet ;
- un vrai cuisinier qui fait un repas simple avec deux œufs de canard, puis un plat raffiné avec un œuf d'émeu et du riz, avec reprise exacte de la sauvegarde ;
- des croquettes avec des œufs ; la gelée et les œufs fécondés refusés, puis utilisés une fois cochés ;
- les caractéristiques, la valeur, la masse, la vente par les visiteurs et la politique des chapeaux ;
- un vrai tailleur qui coud un chapeau de cowboy porté ensuite par un colon (impact social × 1,1), avec reprise exacte ;
- les refus avant le schéma 353 et la migration 352 → 353 sans rien donner.
- le modèle porté (pièces ajoutées au personnage commun seulement une fois un chapeau porté), l'apparence, les portraits et les modèles au sol et transporté.
