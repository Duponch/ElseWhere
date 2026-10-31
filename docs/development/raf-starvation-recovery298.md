# Admission sans images et récupération après arrêt — schéma298

Le31octobre, la vraie campagne325×325 s'est arrêtée le8avrimai5500 à10h57, pendant une attente à×6. La pile appelle `MainFrameAdmissionFIFO.enqueue → onOverflow → SimulationClient.stop`, puis `Main.onFault → renderer.setWorld`, qui lève `Invalid Native Full phase owner`. Ce dernier message est secondaire : l'arrêt a déjà fermé la lane Native et révoqué ses propriétaires. L'arrêt dur et la perte du progrès non sauvegardé restent consignés ; aucun RAW n'est reconstruit depuis la scène affichée.

## Changement

- Une file non vide qui attend une image arme un unique délai de100ms. Sans image, elle reprend son admission par tâches MessageChannel distinctes, avec exactement les budgets existants. Une vraie image met fin à ce secours. Les hôtes sans ordonnanceur optionnel conservent leur ancien comportement.
- Pendant le secours, les admissions conservent leurs validations et leur dernière Full/phase, avec les mêmes gardes que la présentation masquée : les poses et historiques visuels ne s’accumulent pas sans images. La première vraie frame reconstruit depuis les derniers états confirmés.
- La fermeture annule le délai et rend les anciennes tâches inertes. Le plafond256, l'ordre des états et des réponses, les tickets Native, les refus et les acquittements restent stricts. Aucun paquet n'est supprimé et aucune opération n'est acquittée en avance.
- Après un arrêt, le rendu conserve et redessine sa dernière scène préparée sans ré-admettre son World ou son propriétaire révoqué. Horloge, positions et animations ne progressent plus. Un remplacement explicitement validé peut rétablir la présentation.
- Le menu de chargement ne demande plus une pause au Worker déjà terminé. Il conserve l'accès aux sauvegardes existantes ; il ne transforme pas le dernier écran en sauvegarde.

Les navigateurs peuvent suspendre les callbacks d'animation dans certains contextes en arrière-plan. Cela rend nécessaire un chemin de transport indépendant de ces callbacks. Cela ne prouve pas que cet état précis du navigateur explique à lui seul l'incident325. [MDN, requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## Vérification

Quatre contrats d'ordonnancement échouent sur le témoin et passent sur le candidat : reprise après100ms,300 arrivées espacées ordonnées sans images, fermeture et tâches périmées, erreur de callback et retour des images. Le premier harnais est explicitement numérique, sans autorité Native simulée. Les mêmes cas intégrés emploient les vrais prédicats de tickets, avec des callbacks ordinaires sans World.

L'intégration regroupée acquiert42PASS/0FAIL/0pending dans cinq fichiers, incluant les voisins Full/phase/FIFO et six contrôles des vrais corps Main/Scene avec services périphériques déclarés. Ces contrôles n'inventent ni Engine ni sauvegarde. Typage complet25,725s et build Pages6,202s acquis sur copie isolée des seules sources suivies et des cinq changements revus ; entrées identiques avant/après. Le paquet est lié au commit final avant publication.

## Coût et limites

Le chemin ajoute une vérification scalaire et au plus un délai vivant par file active ; aucun parcours par case/acteur, calcul physique ou baisse de qualité. Les tests contrôlent cette borne et l'absence de double admission. Il existe un coût de création/annulation du délai : aucune preuve de coût nul, de gain FPS ou de performances globales325 n'est revendiquée.

Le secours traite l'absence d'images malgré un rendu logiquement disponible. Il ne garantit pas de tenir un débit CPU durablement supérieur à la capacité de traitement, ni un burst de257 messages sans occasion de service. Le plafond et l'arrêt défensif sont conservés. La reprise réelle et la poursuite à×6 doivent rester observées, sans rouvrir une matrice générale de fluidité.

Ce lot concerne le transport et l'interface navigateur ; il ne modifie aucune règle, vitesse physique, RNG, contenu, quantité ou schéma de sauvegarde. La comparaison RimWorld ne fournit pas une spécification de cette architecture Web. Preuves privées : `playthrough-325-20261031/fault-j3-private` et `fault-j3-release` dans le checkpoint du chat.
