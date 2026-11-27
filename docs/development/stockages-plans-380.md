# Stockage des plans et charpentes — schéma 380

Les plans d'étagère et de petite étagère peuvent être réglés dès leur sélection. La même politique reste attachée au chantier pendant la livraison et la construction ; elle est copiée, sans feuille mutable partagée, au vrai meuble terminé. Le chantier n'est jamais une destination de stockage. Ses cellules de stockage ne sont créées qu'à l'achèvement.

## Référence primaire relue

Code Core 1.6 installé localement, `RimWorld.Blueprint_Storage` et `RimWorld.Frame`, lu avec l'outil ILSpy privé déjà présent. `PostMake` donne au plan les réglages par défaut ; `MakeSolidThing` transmet une copie au Frame ; `CompleteConstruction` transmet une copie au meuble ; les deux propriétaires sérialisent leurs réglages. Leurs onglets de stockage sont visibles pendant la construction. Aucun code décompilé ni asset propriétaire n'est intégré.

La portée est celle des deux bâtiments dont Elsewhere possède déjà la politique générale de stockage : `shelf` et `small-shelf`. Les trémies conservent leur ravitaillement alimentaire spécialisé ; tombes et boîtes à œufs ont leurs propriétaires et commandes propres. Cette tranche ne prétend pas leur donner les fonctions de `Building_Storage` encore absentes du modèle local. Les groupes de stockage existants s'appliquent aux vrais meubles, sans nouveau groupe fantôme.

## Modèle et frontières

- `Job.storage380`, optionnel, possède les filtres, objets précis, priorité, fraîcheur, qualité et points de vie. Une absence conserve les défauts ordinaires ; la migration n'en crée pas.
- `blueprint-storage-policy` cible le `jobId`, jamais une position. Le contrat de patch est celui des étagères construites, y compris l'effacement explicite d'une restriction et la capacité physique inchangée.
- La commande modifie seulement la politique : aucune pile, cellule, réservation, progression, identité, horloge ou tirage aléatoire n'est créé.
- Le parcours partagé des données de construction vérifie le champ avant migration et reconstruction, dans les sauvegardes et les publications. Un champ futur, un accesseur, un propriétaire qui n'est pas un chantier d'étagère ou une politique malformée est refusé.
- 379 → 380 valide d'abord le contrat 379 complet puis change seulement le numéro. Un champ `storage380` injecté dans une sauvegarde 379 est refusé.
- L'annulation retire le propriétaire avec le chantier. Un nouveau plan à la même case reçoit une nouvelle identité et les défauts ordinaires.

## Points d'entrée de l'interface

`blueprintStorageSettings380(world, jobId)` fournit une copie de la politique effective. `nativeBlueprintStoragePage380(state, actions, jobId)` fournit le même éditeur natif que les réserves, avec les exclusions physiques d'étagère. L'ouverture et les modifications de brouillon n'écrivent pas dans la simulation. Avant l'application, l'éditeur relit la carte, la sélection, l'identité et la politique initiale ; une annulation, un remplacement, un changement de carte ou une modification concurrente refuse le brouillon.

`nativeSpecialRows` expose déjà le bouton « Régler le stockage… » pour un chantier sélectionné. L'inspecteur principal peut également ouvrir cette page depuis son onglet Stockage pour une sélection `kind: 'job'` dont le type est `shelf` ou `small-shelf`. L'ancien panneau peut employer la même lecture et la commande ci-dessus.

## Vérifications ciblées

Les contrats couvrent les deux tailles, la construction réellement payée, les frontières plan/charpente/meuble, les sauvegardes et recharges complètes, une continuation déterministe, les publications initiales et suivantes, l'annulation/recréation, les effacements de restrictions, les données futures ou malformées et la migration par `asNumberOnly`. Les contrats d'interface couvrent les exclusions physiques, le brouillon sans écriture et quatre refus de propriétaire périmé.

La vérification à l'écran et le typage intégral sont intégrés par le propriétaire du lot principal ; aucun navigateur, build, commit ou déploiement n'est lancé par cette tranche.
