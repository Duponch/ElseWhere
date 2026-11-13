# Aurore, animal apprivoisé seul, animaux de ferme et capsules de ressources — V305

Schéma 305. Le conteur tirait déjà ces quatre incidents du jeu de base sans effet : leur part du tirage ne produisait rien. Elle déclenche désormais l'incident correspondant, selon les règles de RimWorld 1.6 Core (poids, durées, délais et conditions relevés dans les définitions du jeu ; textes propres à Elsewhere). Code : `src/sim/misc-incidents-305.ts` et `src/sim/resource-pods-305.ts`.

## Aurore (catégorie « monde », poids 1,2 sur 4)

- **Déclenchement** : seulement la nuit, quand la lumière naturelle est au plus à 50 % maintenant et encore 500 ticks plus tard ; jamais pendant une autre aurore ; au moins 15 jours après le début de la précédente.
- **Durée** : 0,125 à 0,35 jour. Si le jour se lève avant la fin, l'aurore s'efface en 280 ticks Core.
- **Effet** : +14 d'humeur (« Aurore ») pour chaque personne de la carte à découvert, y compris portée par quelqu'un, qui n'est pas aveugle. Sous un toit, rien. Une personne en cryptosommeil ou hors de la carte n'est pas concernée.
- **Limite** : le ciel ne change pas encore de couleur à l'écran ; seule la règle d'humeur est en place.

## Animal qui s'apprivoise seul (catégorie « divers », poids 1)

- Il faut au moins un colon libre sur la carte.
- Le conteur choisit au hasard un animal sauvage de la carte, hors du brouillard, debout, sain d'esprit (ni enragé ni désorienté), sans scaria et avec une sauvagerie non nulle. Les insectes des ruches sont exclus, ainsi que les animaux portés ou en caisson.
- L'animal rejoint la colonie exactement comme après un apprivoisement réussi : même familiarité, mêmes soins par défaut, chasse annulée. Le code de conversion est désormais partagé (`adoptAsColonyAnimal`).
- **Adaptation** : les espèces d'origine de la faune (lièvre, cerf…) n'ont pas encore de fiche de sauvagerie ; elles comptent comme sauvages, au facteur neutre déjà utilisé pour leur apprivoisement.

## Animaux de ferme qui arrivent d'eux-mêmes (catégorie « divers », poids 0,4)

- **Espèces** : les animaux de ferme du jeu de base dont la sauvagerie est sous 0,35 et qu'Elsewhere représente : dromadaire, canard, yack, âne, alpaga. La vache, la poule, le cochon, le mouton et la chèvre n'existent pas encore dans le jeu.
- **Conditions** : la température de saison et la température extérieure du moment doivent être dans la plage de confort de l'espèce.
- **Choix de l'espèce** : poids 0,42 moins la sauvagerie, divisé par deux si la colonie a déjà un mâle et une femelle de cette espèce.
- **Nombre** : 2,5 divisé par la taille du corps, arrondi au hasard, borné entre 2 et 10. Le premier animal est une femelle, le deuxième un mâle, les suivants au hasard.
- **Arrivée** : les animaux entrent par un point du bord relié à la colonie (le même choix que pour les visiteurs) et rejoignent aussitôt la colonie.

## Capsules de ressources (catégorie « divers », poids 1)

- **Contenu** : une seule sorte d'objet, vendable par les marchands, hors armes et vêtements, valant de 1 à 40 d'argent pièce. Viandes, cuirs et œufs pèsent chacun comme cinq sortes au plus dans ce choix. La cargaison vaut 150 à 600 d'argent, en piles de 20 à 40 unités, limitées par la taille de pile et par la valeur restante, sept piles au plus.
- **Chute** : sur une case dégagée, découverte, visible et accessible depuis un colon. Les capsules s'ouvrent après une courte chute, puis la cargaison est posée autour du point d'impact avec une scorie d'acier. Si la case devient inutilisable, l'ouverture attend.
- **Adaptation** : un seul point d'impact par incident ; la chute et l'ouverture reprennent la courte mise en scène de la capsule de réfugié. Une seule chute peut être en attente à la fois ; un second tirage pendant ce temps ne produit rien.

## Ce qui reste absent

Onde psychique et apaisement psychique : ces incidents visent les personnes d'un genre, or les humains d'Elsewhere n'ont pas encore de genre. Météorite, migration de troupeau, homme sauvage, thrumbo, castors alpha, ambroisie, demande de rançon et hiver volcanique restent à faire. Leur part du tirage ne produit toujours rien.

## Sauvegardes

Une sauvegarde 304 passe à 305 en changeant seulement son numéro. Aucune aurore, aucun animal ni aucun tirage n'est offert rétroactivement. Le calendrier « monde » n'accepte les champs de l'aurore qu'à partir du schéma 305 : nombre, dernier début et aurore en cours. Il en va de même pour le calendrier « divers » et ses capsules : nombre et capsule non ouverte.

## Vérifications

`tests/misc-incidents-305.test.ts` couvre :

- l'aurore de nuit : durée, +14 à découvert, rien sous un toit ;
- le refus en plein jour, l'effacement au lever du jour et le délai de 15 jours ;
- l'animal apprivoisé seul, et le refus des animaux à terre ;
- l'arrivée des animaux de ferme : 2 à 10 animaux, une femelle puis un mâle, identifiants et validation du monde ;
- les capsules de ressources : contenu, chute, attente puis ouverture avec les piles et la scorie, sauvegarde ;
- la migration 304 → 305.

Les tests voisins (conteur, éruption solaire, éclipse, apprivoisement, moral, création d'animaux, migrations) ont été relancés avec ce lot.
