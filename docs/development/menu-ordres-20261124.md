# Menu d'ordres au clic droit — reprise du 24 novembre

Premier point de la [passation](passation-20261123.md). Présentation seule, schéma 377 inchangé.

## Défaut et correction

Le menu affiche immédiatement « Vérification des accès… », puis attend les options du Worker. Une annulation incrémentait le numéro de la requête sans fermer la page déjà affichée. La réponse tardive était correctement ignorée, mais le chargement restait à l'écran. Ce cas est reproduit par un test à réponse différée. Une ancienne fermeture pouvait également agir sur le menu suivant.

- L'annulation retire désormais la page qui appartient à la requête ; les fermetures périmées sont sans effet.
- La garde tient compte du propriétaire de la page, de la sélection et de l'époque de la carte. Un nouvel instantané de la même carte ne ferme pas le menu.
- La remise à zéro **visuelle** d'une présentation annule les gestes non confirmés, sans invalider une requête d'ordres de la sélection courante. Un véritable changement de carte, de sélection, d'outil ou de fenêtre garde son annulation.

Le transport et la simulation restent les autorités : options recalculées avant l'envoi d'une commande, aucun ordre ajouté, aucune écriture de sauvegarde.

## Vérifications

Deux nouveaux cas de cycle de vie et un cas avec une requête réelle au runtime du Worker (pile de repas, schéma courant, une seule réponse sans publication). Passe ciblée : 41 tests verts, un échec déjà répertorié dans `tmp/perf/known-failures.json` (métadonnée `shipOwnerEpoch298` dans le test des factures). Passe des fichiers liés : 159 tests verts, 24 échecs répertoriés, 6 échecs de `pause-presentation-v491` et un chargement de `daylight-speed-engine-v492` reproduits sur la copie antérieure au correctif. Aucun nouvel échec. Typage intégral réussi. Aucun coût ajouté par image.

La reproduction navigateur de la passation n'a pas pu être exécutée : Chromium refuse la connexion au serveur local avec `ERR_NETWORK_ACCESS_DENIED` dans cette session. La disparition du blocage est démontrée pour l'annulation et le chemin de réponse testé, mais la cause du cas observé à l'écran n'est pas certifiée. Le contrôle interactif du menu reste à faire. Le serveur de test lancé pour cette tentative a été arrêté, sans toucher au serveur de l'utilisateur.
