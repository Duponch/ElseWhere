# Fenêtres comme RimWorld — lot 11 : boîtes de message et Options

Reprise du 24 novembre 2026 après la reconnexion du dépôt. Schéma 377 inchangé.

Référence relue dans l'installation locale de RimWorld 1.6 avec `ilspycmd` : `Verse.Dialog_MessageBox` et `RimWorld.Dialog_Options`. Leurs rectangles et l'ordre des actions sont reproduits dans notre propre système de cartes ; aucun texte, art ni code du jeu n'est importé.

## Boîtes de message

- Fenêtre de 640 × 460 centrée, titre de 42 dans le rectangle intérieur, texte défilant avec réserve pour sa barre. Actions de 35 au pied de page : retour à gauche et confirmation à droite ; un seul acquittement à droite, troisième action éventuelle au milieu.
- Application aux confirmations de départ et de l'assistant d'apprentissage, aux notices, aux confirmations du gestionnaire des sauvegardes et à l'entrée en cryptosommeil du dernier colon. Les callbacks, vérifications, révisions et refus d'opération en cours sont ceux qui existaient déjà.
- La page ne se décale plus sur le côté pour le dock en jeu : une boîte modale reste au centre.

## Options

- 650 × 600, rail de catégories de 160, pas de 50 (48 + 2), icônes originales du projet, panneau d'options à 177 dans le rectangle intérieur, interligne 5 et bouton OK centré de 160 × 40. Le titre de fenêtre propre à Elsewhere est conservé. Les catégories disponibles sont les fonctionnalités réelles du produit ; aucune préférence fictive n'est introduite.
- Les catégories et les réglages défilent indépendamment. À taille réduite, la disposition peut devenir verticale pour conserver une largeur lisible, les champs éditables passent si nécessaire en dessous de leur libellé, et les avertissements ne recouvrent pas le bouton OK. Les barres courtes ne débordent pas de leur piste.
- `DoWindowContents` de Core 1.6 ne dessine pas le champ de recherche déclaré dans la classe ; on n'en ajoute pas un artificiellement. Toutes les préférences graphiques, audio, d'apprentissage et de texte de RimWorld gardent leurs contrôles et leurs refus habituels.

Les dialogues spécialisés (commerce, informations, etc.), les listes de sauvegardes et les pages de création restent des lots séparés. La composition du panneau n'intervient que lors de son changement, comme auparavant.

## Vérifications et coût

- Typage TypeScript intégral réussi. Passe ciblée finale : 20 suites, **133 tests réussis sur 133** (géométrie, échelles réduites, commandes et préférences, sauvegardes, import, navigation, menus, assistant d'apprentissage et pictogrammes). Le test des styles vérifie les véritables libellés Pastel/Gouache déjà présents dans `HEAD` et conserve les vérifications des clés et des écritures de préférences.
- Banc de mise en page synthétique, empaqueté avec esbuild (`tmp/handoff-20261123/bench-dialog-options.ts`), 28 réglages + 7 catégories, et un long message de confirmation ; mêmes éléments entre les deux versions, sept passages alternés de 300 mises en page. Médianes : Options **0,0634 → 0,0281 ms** ; confirmation **0,0573 → 0,0282 ms**. Le gabarit fixe évite la double composition de l'ancien dossier ; pas de mesure de FPS du client ni du GPU.
- La passe automatique de toutes les dépendances des travaux non committés a été arrêtée après environ six minutes sans rapport ; elle n'est pas déclarée acquise. Les liens des notes touchées ont été vérifiés (15 liens, aucun manquant) ; le vérificateur Python global n'était pas exécutable dans la session. La preuve visuelle dans le client reste à faire.
