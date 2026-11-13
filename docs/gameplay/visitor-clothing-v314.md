# Vêtements vendus par les visiteurs — V314

Schéma 314. Le marchand d'un groupe de visiteurs tire parfois un vêtement dans la liste des 22 vêtements du jeu de base qui portent l'étiquette commerciale « vêtements ». Jusqu'ici, seule la chemise boutonnée en tissu était produite. Tous les autres tirages ne donnaient rien, même pour un vêtement que le jeu sait fabriquer.

## Règle

Comme dans le jeu de base, le vêtement tiré reçoit une matière au hasard, pondérée par la fréquence de chaque tissu et de chaque cuir dans les définitions de RimWorld 1.6 Core :

- le tissu pèse 1,4, la laine de mouton 0,24, le cuir léger 0,25, le cuir ordinaire 0,2 ;
- la plupart des autres cuirs et laines pèsent entre 0,025 et 0,12 ;
- le total vaut 3,875 pour un vêtement en tissu ou en cuir, et 2,57 pour la tuque, qui n'accepte que le tissu.

Les visiteurs peuvent donc proposer la chemise, le pantalon, le t-shirt, le blouson, le cache-poussière, la parka et la tuque, dans les 22 matières de couture représentées. Si le tirage tombe sur une matière qu'Elsewhere ne représente pas encore, aucun vêtement n'est produit, comme avant. C'est le cas de la soie synthétique, du tissu du diable, de l'hypertissu, de la laine de mouton et des cuirs humain, de thrumbo et rapiécé.

## Hasard inchangé

Le tirage consomme exactement les mêmes nombres aléatoires qu'avant. Le tissu occupe la première tranche, si bien qu'un tirage qui donnait une chemise en tissu donne toujours une chemise en tissu. Les autres objets du stock sont inchangés.

## Sauvegardes

Une sauvegarde 313 passe à 314 en changeant seulement son numéro. Les visiteurs déjà présents gardent leur stock ; seuls ceux qui arrivent ensuite profitent de la nouvelle règle.

## Tests

`tests/visitor-clothing-314.test.ts` couvre :

- les fréquences des matières ;
- 3 000 stocks de visiteurs, avec les mêmes tirages aléatoires qu'au schéma 313 ;
- un vrai marchand portant un nouveau vêtement, à travers la sauvegarde ;
- la migration.

Le montage commun des tests de visiteurs date maintenant aussi le budget de chemin et la détérioration avec son horloge préparée. Cela répare trois échecs connus du test des vêtements chez les visiteurs.
