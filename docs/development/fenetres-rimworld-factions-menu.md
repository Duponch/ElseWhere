# Fenêtres comme RimWorld — lot 10 : Factions et Menu

Travail de la nuit du 24 novembre retrouvé dans les fichiers locaux de `main` lors de la reconnexion du dépôt. Aucun nouveau schéma et aucun changement des règles de diplomatie.

- Factions reprend le tableau de `MainTabWindow_Factions` et `FactionUIUtility` : fenêtre de 1 010 × 684, rangées de 80, titre de 50 et icône colorée de 42. Nom, type, dirigeant, relation actuelle, bonne volonté naturelle et factions ennemies sont distincts. Les faits proviennent du registre de la campagne ; les factions invisibles ne sont pas exposées. La recherche, le tri, le dossier et l'accès aux établissements restent des opérations de présentation.
- Menu reprend une feuille de 450 × 390, ancrée à droite, avec les actions principales de 170 et le couloir supplémentaire de 145, espacés de 17. Le gestionnaire des sauvegardes, les Options et l'aide restent directement accessibles ; les copies et réglages historiques sont repliables. Les gardes de la partie empêchent toujours d'exécuter une ancienne action ou de sauvegarder pendant un défaut. Aucun ancien format n'est activé au simple dépliage.
- Les outils supplémentaires d'Elsewhere occupent le deuxième couloir à la place des liens web du jeu de référence. À très grande échelle d'interface, les actions restent accessibles par défilement plutôt que débordement.

Le compte rendu de la nuit indiquait 330 tests réussis sans nouvel échec. À la reconnexion, cinq suites ciblant ces menus, les sauvegardes, les Options et les tailles réduites ont de nouveau donné 23 tests verts avant le lot suivant. La validation visuelle dans le client reste à faire.
