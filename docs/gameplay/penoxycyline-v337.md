# Pénoxycyline et prise programmée — V337

Schéma 337. La pénoxycyline du jeu de base protège des nouvelles infections de paludisme, de maladie du sommeil et de peste. Elsewhere ajoute le médicament, sa recherche, ses factures au laboratoire de drogues et sa prise programmée dans les politiques de drogues.

## Recherche et fabrication

Valeurs du jeu de base :

| Élément | Valeur |
|---|---|
| Recherche Production de pénoxycyline | 500 points, industrielle, après Production de drogues |
| Fabriquer de la pénoxycyline | 2 neutroamine, 600 de travail (60 ticks locaux), 1 dose |
| Fabriquer de la pénoxycyline x4 | 8 neutroamine, 2 400 de travail (240 ticks locaux), 4 doses |
| Poste | laboratoire de drogues, métier Artisanat, apprentissage Intellectuel, sans niveau requis |
| Objet | valeur 18, 5 g, piles de 150, 50 points de vie, inflammabilité 0,7 |

Les factures passent par la chaîne de production existante : l'artisan apporte la vraie neutroamine, travaille au poste et dépose la dose. La pénoxycyline forme une nouvelle catégorie « Drogues » des zones de stockage et des étagères. Les zones existantes d'une ancienne partie ne l'acceptent pas tant que le joueur ne l'autorise pas.

## Effet d'une dose

Une dose donne l'état « Pénoxycyline » de gravité 1. Le jeu de base retire 0,18 par jour, par pas de 200 ticks propres à chaque personne ; l'état disparaît après 1 667 pas, soit environ 5,56 jours. Une nouvelle dose pendant l'effet le ramène à 1. L'onglet Santé affiche les heures restantes.

Tant que l'état dure, la chance d'attraper le paludisme, la maladie du sommeil ou la peste vaut 0 : l'incident de maladie passe ce colon, et le journal le signale comme protégé. Une infection déjà présente n'est pas soignée. Le tirage aléatoire de la victime est fait comme pour un colon déjà malade : la suite des tirages ne change pas de forme.

Adaptations :
- la fin de l'effet est enregistrée comme un tick de l'horloge clinique, gelée pendant une suspension comme les états du jeu de base ; après une suspension, la cadence de 200 ticks garde la phase de la dose (au plus 199 ticks d'écart) ;
- le risque de surdose du jeu de base (0,08 à 0,14 par dose) n'est pas représenté : Elsewhere n'a pas encore de surdose.

## Prise programmée

Chaque politique de drogues reçoit une entrée « Pénoxycyline » : prise programmée, fréquence de 0,1 à 25 jours et deux seuils d'humeur et de loisir. Les politiques du jeu de base ne la programment pas et gardent une fréquence de 1 jour ; le joueur règle d'ordinaire 5 jours. Une ancienne politique sans entrée reçoit ces valeurs par défaut, sans rien enregistrer.

La décision suit le jeu de base :
- première dose dès que la prise est permise ;
- puis une dose quand au moins N jours sont passés depuis le jour de la dernière, à un rendez-vous du jour tiré entre 10 % et 35 % de la journée ;
- sous 1 jour, plusieurs doses par jour, réparties dans la journée, avec un écart minimum entre deux doses.

Le colon prend d'abord une dose de son propre inventaire, sinon de la pile autorisée la plus proche qu'il peut atteindre. Il marche jusqu'à elle, prend une unité, la prend debout tout près (100 ticks du jeu de base) et seulement alors reçoit l'effet. Une interruption rend la même unité. Le dossier de prise reste enregistré après la fin de l'effet, comme celui du jeu de base, pour compter le prochain rendez-vous.

Adaptations :
- comme pour la bière, le rendez-vous du jour est une valeur stable par personne et par jour, et la journée est le jour entier plutôt que les heures d'éveil ;
- les inventaires des animaux de la colonie ne sont pas fouillés ;
- « Garder dans l'inventaire » et la prise ordonnée à la main ne sont pas représentés pour la pénoxycyline ; la prise en caravane non plus.

## Commerce

Non traité dans ce lot : la vente de la pénoxycyline par les marchands appartient au lot du commerce.

## Sauvegardes

Une sauvegarde 336 passe à 337 en changeant seulement son numéro : aucune dose, recherche ou entrée de politique n'est donnée. Avant 337, l'objet, sa catégorie, ses recettes, sa recherche, l'entrée de politique, l'état de santé et la prise en cours sont refusés. Une facture ou une tâche de fabrication exige la recherche achevée.

## Vérifications

`tests/penoxycyline-337.test.ts` couvre :
- les valeurs de l'objet, des recettes, de la recherche et de l'effet ;
- la recherche après Production de drogues, puis les factures ;
- la fabrication avec la vraie neutroamine et sa reprise exacte ;
- la prise programmée : marche, prise d'une unité, effet, conservation des doses, sauvegardes en cours de prise et pendant l'effet ;
- le calendrier des prises et la prise depuis l'inventaire ;
- la peste et la maladie du sommeil bloquées pendant l'effet, mêmes tirages, puis attrapées après la fin ;
- une infection existante non soignée ;
- les refus avant 337 et la migration.
