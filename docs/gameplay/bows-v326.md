# Arc recourbé et grand arc — V326

Schéma 326. Deux arcs du jeu de base (Bow_Recurve et Bow_Great) et leurs deux recherches (RecurveBow et Greatbow).

## Recherches

| Recherche | Coût | Prérequis | Âge technologique |
|---|---|---|---|
| Arc recourbé | 400 points | aucun | néolithique |
| Grand arc | 600 points | Arc recourbé | médiéval |

- Les deux se font au bureau de recherche simple, sans bureau avancé ni multi-analyseur.
- Le coût n'est pas majoré : les deux projets sont au niveau technologique de la colonie, ou en dessous.
- La recherche Grand arc ne peut être choisie qu'une fois Arc recourbé terminée.
- Les factures de chaque arc n'apparaissent qu'après sa recherche. Un arc acheté ou ramassé s'utilise sans recherche.

## Fabrication

| | Arc recourbé | Grand arc |
|---|---|---|
| Coût | 40 bois | 60 bois |
| Artisanat | 5 | 6 |
| Travail (unités du jeu de base) | 5 000 | 9 000 |

- **Postes :** emplacement d'artisanat, forge à combustible ou forge électrique.
- **Ouvrage :** l'arc inachevé de l'arc court sert aussi à ces deux arcs. Il garde sa recette, son auteur et sa progression. Le fabricant tire la qualité comme pour les autres armes fabriquées.

## Caractéristiques (qualité normale)

| Valeur | Arc recourbé | Grand arc |
|---|---|---|
| Portée | 25,9 cases | 29,9 cases |
| Visée | 1,45 s (87 ticks du jeu de base) | 2 s (120 ticks) |
| Récupération | 1,65 s (99 ticks) | 1,5 s (90 ticks) |
| Précision (contact / courte / moyenne / longue) | 70 % / 78 % / 65 % / 35 % | 65 % / 85 % / 75 % / 50 % |
| Flèche | 14 dégâts, pénétration 21 %, vitesse 56, pouvoir d'arrêt 1 | 17 dégâts, pénétration 15 %, vitesse 49, pouvoir d'arrêt 1,5 |
| Blessure | estoc (fêlure sur une partie dure) | coupure (fêlure sur une partie dure) |
| Corps à corps | Branche : contondant ou estoc, 9 dégâts, 2 s | idem |
| Points de vie, masse, valeur | 100, 1,3 kg, 66 | 100, 3 kg, 104,4 |

La qualité modifie les dégâts et la précision comme pour les autres armes à distance.

## Flèches

- La flèche de l'arc recourbé fait une **blessure par estoc** (dégât « flèche à grande vitesse » du jeu de base).
- La flèche du grand arc fait une **coupure**, comme celle de l'arc court.
- Sur une partie dure (crâne, os), les deux font une **fêlure**.
- Le choix de la partie touchée suit les règles des balles ; l'armure s'applique de la même façon, la flèche étant tranchante.

## Commerce

Les marchands visiteurs peuvent vendre un arc recourbé ou un grand arc. Le jeu de base les a toujours comptés parmi leurs armes à distance possibles (entrées 21 et 22 de la liste). Les tirages aléatoires sont inchangés : un marchand qui vendait déjà quelque chose le vend toujours.

## Rendu

- Modèles originaux. L'arc recourbé a des pointes de branches retournées vers l'avant ; le grand arc est une longue perche à poignée gainée.
- Les deux se tiennent et se portent comme l'arc court : droits pour viser, en travers du dos au repos.
- L'ouvrage inachevé garde l'apparence de la perche nue de l'arc court.
- Pictogrammes propres aux deux arcs, repris par leurs recherches.

## Limites

- **Pila :** pas encore fait.
- **Factions tribales :** elles n'ont toujours pas d'archers.
- **Brûlage :** brûler un arc comme recette n'est pas proposé.
- **Planification du rendu des acteurs cuits :** comme pour l'arc court et le fusil à pompe, la table de planification de l'atlas des acteurs ne connaît pas encore ces arcs ; le rendu ordinaire les affiche.

## Sauvegardes

Une sauvegarde 325 passe à 326 en changeant seulement son numéro. Avant 326, les éléments suivants sont refusés :
- les deux arcs ;
- leurs recettes et les ouvrages qui les portent ;
- leurs flèches en vol et les visées à l'arc ;
- les deux recherches, en cours, choisies ou terminées.

Dès 326, une facture, un ouvrage ou une tâche d'arc exige sa recherche terminée, et le Grand arc exige l'Arc recourbé.

## Vérifications

`tests/bows-326.test.ts` couvre :
- recettes, valeurs, profils de tir par qualité et outil de corps à corps ;
- estoc de la flèche recourbée, coupure de la grande flèche et fêlure sur l'os ;
- chaîne de recherche au vrai bureau : refus atomiques avant, factures débloquées après, reprise exacte de la sauvegarde ;
- fabrication réelle de chaque arc au poste d'artisanat, bois exact consommé, reprise exacte, puis équipement ;
- visée de 87 et 120 ticks, vraies flèches et blessures, récupération propre à l'arc, reprise exacte ;
- vente par les visiteurs avec les mêmes tirages ;
- refus avant 326 par les validateurs directs et par le chargement d'une sauvegarde complète ;
- migration.
