# Repli d’inactivité et recherche alimentaire — schéma 300

**Premier lot fonctionnel de la revue des fondations, schéma300.** Il ajoute le repli d’inactivité manquant et conserve le travail déjà engagé pendant une recherche alimentaire encore inconnue. Il ne clôt pas la revue des fondations ni les problèmes généraux de fluidité.

## Comportement

Lors du repli ordinaire sans tâche possédée, le colon considère d’abord IdleJoy, puis l’alternance attente/errance. IdleJoy devient disponible au Core 60000, sous 99 % de loisir ; l’horaire Travail l’interdit, tandis que Temps libre, Loisir et Sommeil le permettent, après les fournisseurs prioritaires.

L’attente devient une vraie tâche, avec intervalle tiré entre 125 et 200 Core et fin soumise à sa fenêtre de hash. L’errance utilise le déplacement physique existant et finit à l’arrivée réelle ; elle ne reçoit pas la durée d’une attente. La présence d’un colon en attente est prise en compte par le choix des destinations, sans devenir un obstacle universel au transit. Les destinations coloniales incluent les huit directions autour des bâtiments admissibles ; Home s’applique à la position du bâtiment.

L’alternance utilise le même bit historique que l’errance clinique. La migration 299→300 conserve strictement les données, le RNG, les identités, les routes et ce bit ; elle ne crée aucune tâche idle ni histoire passée. Le défaut true concerne seulement les nouveaux humains 300.

Une recherche alimentaire suspendue faute de budget représente un résultat encore inconnu. Elle conserve la continuation d’un travail déjà engagé ; elle n’autorise ni la sélection d’un nouveau travail inférieur ni un faux verdict « nourriture introuvable ».

Un étourdissement isolé suspend le trajet d’errance en conservant sa tâche et son chemin. Une attente conserve son échéance et peut expirer pendant cet étourdissement. Le garde de sauvegarde accepte ce propriétaire légitime, sans accepter un mouvement orphelin ni relâcher la validation générale des dates de stun.

## Preuves et limites

L’assemblage final passe **19 contrats dans sept fichiers**, sans échec ni cas ignoré : propriété, attente/arrivée, sauvegarde et transport, migration neutre, destinations Home/huit directions, IdleJoy, continuation alimentaire et trois cas de stun. Le témoin du défaut en cours d’arête échoue avant correction ; les nouvelles vérifications couvrent aussi Whole/recharge et Full strict/résident. Typage final : **74,668s** ; build Pages CODE : **5,291s**, compilateur borné à deux cœurs/1536MiB. Les trois extractions admission/continuation qualifiées séparément restent privées et ne sont pas branchées au Core.

Vérification ciblée dans le navigateur, sur une fixture32² déclarée distincte de la campagne : import normal, déplacements réellement observés, activité « Erre. », activité « Attend sans rien faire. », puis interruption effective par « Mobiliser » en pause. L’import a été anormalement lent ; l’attribution outil/jeu n’est pas isolée. Aucun contrôle de stun en navigateur n’est revendiqué. Le [banc général historique](playability-validation.md) reste non acquis : ses raccordements d’initialisation, d’interface et son ancienne borne13cases/s sont déjà documentés comme obsolètes. Il n’a pas été rejoué pour produire un refus connu ; cette vérification ciblée ne vaut ni ce parcours complet ni un PASS de fluidité.

Un unique W/C/W de 600 Core a utilisé les mêmes trois colons mobilisés par commande réelle, pour mesurer le chemin sans tâche idle active. Les JSON Whole initiaux/finals, RNG, identités et propres recharges concordent après retrait du seul numéro de schéma.

| Temps en ms | W1 | Candidat | W2 |
|---|---:|---:|---:|
| Mural |317,607|252,163|189,654|
| CPU processus |281|265|235|
| CPU thread |251|203|188|

Le candidat est entre les témoins. Face à W2, les adverses sont +32,96 % mural, +12,77 % processus et +7,98 % thread ; le témoin mural dérive de −40,29 %. **Coût causal inconclusif** : aucun coût nul, non-régression globale ou FPS global acquis. Ce relevé précède le petit correctif de conservation sous stun, non exercé dans ce scénario sans tâche idle active ; aucun gain de coût de ce dernier n’est inféré.

Le Main civil reste au macro : une fin d’attente/arrivée peut attendre 0–9 Core avant sa prochaine décision. Géométrie coloniale, recherche de destination et ordre RNG gardent des adaptations locales ; aucune identité exhaustive avec Core n’est revendiquée.

La construction reste un écart fondamental ouvert. Mur bois : primaire 94,5 unités et 99 Core conditionnels à Construction 3 stable, facteurs neutres, delta 1 et absence d’échec ; local actuel 180 Core de seul travail. Les pertes, tirages et transitions empêchent de livrer une correction de vitesse isolée.

La référence exacte est Core1.6.4871rev590, Assembly-CSharp SHA2565cf1b5be399d5b1c9c56ca72c9d35b4ecf307feacf5859d04ac5a1aa5926356a : JobGiver_IdleJoy, JobGiver_WanderColony, JobDriver_Wait, Pawn_JobTracker, Pawn_PathFollower, StunHandler et XML correspondants lus localement. L’[annonce officielle1.6](https://ludeon.com/blog/2025/06/announcing-odyssey-and-update-1-6/) et son [primer officiel](https://docs.google.com/document/d/e/2PACX-1vRKE9u5ZW_zG45pxzwNvy4sxvozDeqtxlxpac5jwenOeW6liQCPgmPl9bIbtcMuqL1NPIDHOLFg64M_/pub) décrivent Variable Tick Rate et PathRequest asynchrone ; ils ne prouvent pas seuls les détails de priorité ou d’expiration lus dans la primaire locale.
