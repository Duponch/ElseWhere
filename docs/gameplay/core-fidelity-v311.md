# Corrections de fidélité : points de vie, construction et beauté — V311

Schéma 311. Un audit en lecture seule a comparé les chiffres du catalogue d'Elsewhere aux définitions installées de RimWorld 1.6 Core : environ 55 recettes, 95 bâtiments, 44 recherches, 300 objets et toutes les armes existantes. Presque tout concorde. Ce lot corrige les écarts confirmés, en tenant compte de l'héritage des définitions.

## Points de vie de huit bâtiments

| Bâtiment | Avant | Jeu de base |
|---|---|---|
| Clôture | 100 | 40 |
| Portail de clôture | 120 | 20 |
| Marqueur d'enclos | 80 | 100 |
| Table 2×4 | 125 | 150 |
| Chaise | 75 | 100 |
| Table de chevet | 60 | 75 |
| Commode | 100 | 120 |
| Pot de fleurs | 40 | 75 |

Le facteur du matériau s'applique ensuite ; par exemple ×0,65 pour le bois, donc une clôture en bois a 26 points de vie. À la migration, un bâtiment endommagé garde la même proportion de points de vie, avec au moins un point restant.

## Construction

Le générateur à bois demande désormais Construction 4, et le générateur à carburant chimique Construction 6, comme dans le jeu de base. Avant, ils ne demandaient aucun niveau.

## Beauté

- **Bâtiments électriques** : éolienne −12, batterie −15, générateur à bois −20, conduit −2, interrupteur −2. Ils valaient 0.
- **Lit d'hôpital** : 0, comme dans le jeu de base, au lieu de 2.
- **Étagères** : beauté de base 0,5, comme dans le jeu de base, au lieu de 0.
- **Pierres** : le marbre multiplie la beauté par 1,35, le grès et l'ardoise par 1,1. Le mobilier les comptait à 1 ; les sculptures avaient déjà les bonnes valeurs.
- **Formule** :
  1. Le facteur du matériau ne s'applique qu'à une beauté de base positive.
  2. On ajoute ensuite le bonus du matériau, par exemple +1 pour le marbre et +10 pour le jade.
  3. La qualité multiplie le résultat s'il est positif. Avant, elle s'appliquait avant l'ajout du bonus.
  4. La valeur est enfin arrondie à l'entier, au pair en cas d'égalité, puis au multiple de 5 au-dessus de 100.

  Une table en marbre de bonne qualité vaut donc (0,5 × 1,35 + 1) × 2 = 3,35, soit 3.

## Adaptations connues, non modifiées

L'audit a relevé des choix déjà documentés, qui restent tels quels :

- **Recherches :**
  - le lit d'hôpital ne demande pas les matériaux stériles ;
  - les tourelles demandent la fabrication d'armes à feu ;
  - les rations de survie ne demandent pas la pâte nutritive ;
  - il n'y a pas de recherche « électricité » ;
  - le lit ordinaire ne demande aucune recherche.
- **Matériaux :** certains bâtiments n'acceptent qu'un seul matériau, pour un même coût total.

## Sauvegardes

La validation d'une sauvegarde antérieure à 311 utilise toujours les anciennes valeurs. La migration 310 → 311 ne fait que rééchelonner les dégâts des huit bâtiments.

## Vérifications

`tests/core-fidelity-311.test.ts` couvre :

- les points de vie selon le schéma et la migration des dégâts ;
- le niveau de construction des générateurs ;
- les valeurs de beauté, l'ordre de la formule et l'arrondi ;
- la migration d'une partie sans dégâts.
