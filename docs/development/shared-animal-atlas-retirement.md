# Retrait de l’ancien atlas animal produit

État Source du 4 novembre 2026. Les animaux utilisent désormais leur modèle
commun et la surface opaque partagée. Le produit ne prépare plus un atlas par
espèce et ne remplace plus son matériau en fonction des blessures.

Les types `WildlifeBakedPreparation`/`WildlifeBakedPreparationResult` et les
méthodes de préparation temporairement neutres ont donc été retirés. Le
diagnostic historique `bakedStatus()` reste en lecture seule : il indique
explicitement `shared-paint`, sans préparation ni publication d’atlas.

Six contrats de `origami-opaque-wildlife.test.ts` exerçaient exclusivement
l’ancien propriétaire d’atlas du produit, supprimé par cette architecture.
Le fichier complet est conservé hors collecte, avec sa taille et son SHA256,
dans le dossier privé
`audit/retired-animal-atlas-product-tests-20261104` de cette conversation.
Son SHA256 est
`03322afec97b8fd58c8bd31c65d7824b02f8e8212c78d4ff7480b6cff4a6de8a`.

Le septième contrat, indépendant, vérifie l’adoption d’un clone par les vrais
propriétaires d’éclairage et d’exploration. Il reste collecté dans
`tests/environment-lighting-composed-clone.test.ts`, avec un corps de test
inchangé (SHA256
`45872dbe3d59e61ed51b2be393b62e26ac25b4c925cef3564244d486a2cefef8`).
Ce déplacement n’est pas présenté comme une nouvelle exécution.

Les contrats de remplacement sont ceux des surfaces animales communes
(`shared-animal-texture-surface.test.ts`), des modèles/poses et des vrais
propriétaires cliniques, ainsi que les transactions de scène communes.
Les anciennes preuves d’atlas et leurs limites historiques restent conservées.

Le petit adaptateur `animal-graphics-style.ts`, sans aucun appel dans les
sources ou les tests au recensement, a également été retiré après préimage
exacte : SHA256
`4946abfb8c12d37c3156e09e8ba51bf9203d75d671f582f96723af24fe61a3e3`.
Les compilateurs privés d’images et les preuves historiques ne sont pas
supprimés par ce retrait de l’ancienne API produit.
