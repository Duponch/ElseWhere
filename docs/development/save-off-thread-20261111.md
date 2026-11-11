# Sauvegarde hors du fil de simulation (11 novembre 2026)

## Constat

Une sauvegarde validait toute la partie dans le Worker de simulation avant d'en écrire le texte (`serializeCampaign`). Sur Les Forges (80 colons, 241 animaux, 7 512 bâtiments, 21 122 ressources), mesuré dans Node :

| Étape | Durée |
|---|---|
| Validation complète (`validateWorld`) | 1 187 ms |
| Sauvegarde complète (validation + texte) | 1 415 ms |
| Texte seul (`JSON.stringify`, 15,6 Mo) | 138 ms |

Pendant ce temps, la simulation était arrêtée. Avec la sauvegarde automatique (toutes les 5 minutes par défaut), cela faisait un gel d'environ 1,4 s toutes les 5 minutes sur une grande colonie.

## Changement

- Le client du jeu (`MainSimulationClient`, `src/main.ts`) demande au Worker le texte seul (`{type:'save', check:'deferred'}`, `serializeCampaignUnchecked`) : environ 0,14 s d'arrêt de la simulation sur Les Forges au lieu de 1,4 s.
- Le texte est ensuite contrôlé par un Worker dédié (`src/bridge/save-check.worker.ts`, `src/bridge/save-check.ts`) pendant que le jeu continue. La sauvegarde n'est gardée qu'après ce contrôle.
- Le contrôle est le chemin de chargement complet (`savedCampaignRefusal` appelle `deserializeCampaign`) : une sauvegarde gardée est une sauvegarde qui se recharge. Un refus garde la forme « Cannot save invalid world: … » de l'ancien chemin.
- Sans Worker de contrôle (client par défaut, tests sous Node, outils) ou si ce Worker ne démarre pas, la sauvegarde reprend l'ancien chemin, validation dans le Worker de simulation comprise.

Valider le texte relu par `validateWorld` seul ne suffit pas : le texte est la forme stockée, que le chargement restaure avant de la valider. Le premier essai dans le navigateur l'a montré : une partie valide y était refusée (« Invalid or future map/group registry »). C'est pourquoi le contrôle passe par le chargement complet.

## Vérifications

- Test `tests/save-off-thread.test.ts` :
  - le texte est identique à celui de `serializeCampaign` ;
  - la même partie invalide est refusée par les deux chemins, avec le même message ;
  - la validation est bien déléguée ;
  - le repli fonctionne sans Worker et quand le Worker échoue.
- Tests liés à la sauvegarde et au client : aucun échec nouveau dû au code. Les fichiers d'essai absents de ce dossier de travail font échouer les mêmes tests sur la version de base.
- Version Pages construite et essayée dans le navigateur, avec le vrai Worker de contrôle : une partie valide (Les Éclaircies, 14,5 Mo) est acceptée en 4,1 s, hors du jeu. La même partie faussée (colon hors carte) est refusée avec « Cannot save invalid world: Invalid pawns identity or cell. ». Confier le texte au Worker coûte 7 ms au fil d'affichage.

## Limites

- Le contrôle est un chargement complet. Il dure plus longtemps que l'ancienne validation (environ 3 à 4 s sur une grande partie), mais à côté du jeu. La sauvegarde est donc gardée quelques secondes après la demande.
- Une partie dont seul l'état en mémoire est invalide, mais dont le texte se recharge, est désormais gardée. Exemple : un champ indéfini, que le texte JSON ne transporte pas. L'ancien chemin la refusait. Le contrat retenu est « une sauvegarde gardée se recharge ».
- La compression et l'écriture du texte côté affichage n'ont pas changé ; elles n'ont pas été mesurées ici.
- Aucune sauvegarde complète n'a été jouée de bout en bout dans l'interface du jeu. Le client est couvert par le test avec faux Workers, et le vrai Worker de contrôle par l'essai dans le navigateur.

## Publication

Publié sur Cloudflare Pages le 11 novembre (Production `b06f1639`, branche main, commit `a68058d2`), depuis une copie exacte du commit. Typage et construction Pages réussis, avec le nouveau Worker de contrôle `save-check.worker-CSKmSTXG.js`. Fichiers publics inchangés. 36 réponses HTTPS identiques octet pour octet sur le site public et l'adresse fixe du déploiement. La publication inclut aussi les deux optimisations exactes de la journée : recherche des bâtiments par l'index partagé (Worker ×3 de 79,6 à 82,2 % sur Les Forges) et comparaison des dépendances d'acteurs en boucles simples.
