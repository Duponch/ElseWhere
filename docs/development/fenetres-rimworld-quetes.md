# Fenêtres comme RimWorld — lot 8 : Quêtes

Reprise du 24 novembre, interface seule. `MainTabWindow_Quests` lu dans RimWorld 1.6 Core : fenêtre de 1 010 × 640, liste de gauche de 36 %, séparation de 17, rangée de 32, trois onglets (disponibles, actives, historiques), recherche de 24 sous la liste. La fenêtre de détail n'affiche que la quête sélectionnée. Aucun changement de schéma.

## Ce qui a changé

- L'ancienne liste de tous les dossiers à la suite est devenue la liste et le dossier indépendants du jeu de base. Toutes les informations, commandes, conséquences, choix de récompense et confirmations existantes restent dans le dossier de leur quête.
- Les offres, dossiers acceptés et conclus appartiennent respectivement aux trois onglets. Une quête sélectionnée qui change d'état est suivie vers son nouvel onglet. Les recherches et les sélections sont des états de présentation, jamais des ordres, et sont réinitialisées au changement de partie.
- La recherche filtre les noms, catégories et informations sans accent ni casse. À taille normale les onglets et la recherche ne défilent pas avec les quêtes ; à taille logique très réduite, la colonne de gauche est d'un seul défilement afin que tout reste atteignable.
- L'accès aux sites, aux pourparlers et aux arrivées, ainsi que les activations prospectives des parties anciennes, sont conservés. Les préférences globales de récompenses de Core et les sous-quêtes parentes n'existent pas encore dans la simulation d'Elsewhere ; pas de préférence ni de règle factice ajoutée dans ce lot.

## Coût

Banc des deux versions empaquetées par esbuild, 45 offres d'asile préparées, 7 passages alternés de 200 compositions à 1 440 × 860 : 184 → 53 lignes de page, construction + mise en page 0,887 → 0,400 ms en médiane (−55 %). Rien de nouveau par image.

## Vérifications

Typage intégral réussi. 59 tests ciblés verts (sept fichiers), dont les six cas des quêtes/historique : faits, onglets, sélection, changement d'état, recherche, petits écrans, récompenses, garde de carte et confirmation d'offre. Passe liée : 329 tests verts, 10 échecs connus et un chargement historique confirmé sur la version de départ, aucun nouvel échec. L'ancien test des colonnes Copier/Coller oublié au lot 5 est aussi revenu au vert. Contrôle visuel réel à confirmer, accès au serveur local refusé dans la session.
