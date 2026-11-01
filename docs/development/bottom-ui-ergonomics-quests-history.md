# Quêtes et Historique — structure et densité retrouvées

Brouillon privé du 1 novembre 2026. L’interface carton3D conserve ses matériaux, ses couleurs, sa typographie et son rendu. Ce lot rétablit des informations et des parcours qui avaient été simplifiés lors du remplacement des menus. Il ne modifie aucune règle de simulation, aucun propriétaire, aucun format persistant ni le schéma 301. Les autres écrans et les campagnes sont hors de ce lot.

## Comparaison avec l’ancienne interface

La référence avant remplacement est `c7c61ebbf06a6bdfe42219b3c19989309e3a2cb1`, et le remplacement initial des menus est `5f6f27a3f24f6dcd6eaa6930baf3bf8a74ec5600`. Le comparatif borné `four-panels-comparison.md` distingue les données toujours conservées des faits que le producteur Native n’affichait plus. Les retouches Faune/Animaux livrées ensuite sont conservées ; il n’y a pas de copie globale d’une ancienne version de NativePanels.

| Écran | Écart confirmé avant ce lot | Restitution ciblée |
|---|---|---|
| Quêtes | Liste de tous les dossiers, actifs et anciens mélangés ; liens par identifiant, parcours brut ; âge et compétences absents ; demande de largeur 780 px. | Dossiers courants d’abord, précédents repliables ; sections par famille ; faits humains lisibles et délais détaillés ; demande de largeur 920 px comme l’ancien panneau. |
| Historique | Trois lignes économiques riches, dont les montants groupés dans une phrase ; journal complet sans recherche. | Section Patrimoine avec montants séparés et faits comparables ; journal limité aux 30 plus récents par défaut, accès à l’ensemble et recherche sur tous les événements conservés. |

Les largeurs sont des demandes de mise en page, bornées au viewport par le layout existant. Historique conserve sa largeur effective 720 px déjà imposée par son identifiant. Aucune nouvelle architecture générale de Stage n’est introduite.

## Quêtes

Les offres et engagements courants précèdent les dossiers terminés. Les familles disponibles gardent une section propre : asile et poursuite, demandes commerciales, pourparlers diplomatiques, informations de sites acquises, arrivées et départs. Un bouton fixe donne accès aux dossiers précédents sans imposer leur défilement à chaque ouverture. Aucun dossier n’est supprimé ou réordonné dans le World.

Pour l’asile, l’offre montre l’âge biologique et chronologique **s’il est enregistré**, le nom de la personne liée, le parcours localisé et le profil proposé de compétences via les helpers existants. Les explications distinguent l’offre, l’arrivée attendue, l’arrivée accomplie, la poursuite apparue et les issues neutres/refusées/expirées. Les durées reprennent la convention minutes/heures de notre ancienne UI. La présentation ne crée ni âge inconnu, ni passé, ni résultat de combat. Les sites et pourparlers continuent d’utiliser leurs helpers de faits existants.

Pour les demandes commerciales, les récompenses restent directement lisibles. Choisir une option est une préférence locale de vue ; l’acceptation et sa confirmation restent séparées. Les exigences physiques de livraison sont de nouveau visibles : biens dans les inventaires de la caravane, fraîcheur, qualité normale ou meilleure lorsque pertinente, vêtements non souillés. Il s’agit d’explications de règles existantes, sans nouveau critère d’acceptation.

Les commandes gardent leurs payloads et leurs identifiants : `enable-quests`, `answer-quest`, `trade-request-answer`, `trade-request-dismiss`. Avant une réponse, la page relit le contexte, l’état busy, le vrai dossier, son statut, son délai et, pour le commerce, l’accès à la destination et l’option choisie. Le clic de confirmation vérifie encore le choix local. Confirmation, Retour, fermeture et retour après une commande asynchrone sont bornés au même contexte. Le Worker conserve l’autorité d’exécution ; ces gardes de présentation ne constituent pas un nouvel acquittement.

## Historique

La section Patrimoine lit uniquement les montants du dernier relevé conservé : total, objets, bâtiments, sols, attentes/humeur, couverture et date. Elle distingue le palier provisoire et les valeurs non évaluées. Ouvrir cette page ne recompte pas la carte et n’attribue aucun prix générique aux biens inconnus. L’adoption économique conserve sa commande existante et n’invente pas de relevés passés.

Le journal présente les 30 événements les plus récents par défaut, comme l’ancienne interface. La recherche ignore les accents et porte sur **tous** les événements retenus ; le bouton d’étendue affiche le journal complet. Le compteur distingue affichés, correspondants et total. Recherche et étendue sont des états de vue, réinitialisés au changement de contexte ; elles ne déclenchent aucune commande et ne modifient ni l’ordre, ni la rétention des événements.

**Aucun graphique de richesse n’est fabriqué.** Les données utilisées ici contiennent un relevé courant, pas une série chronologique vérifiée. Le lot ne crée pas de collecte persistante pour dessiner artificiellement le graphe de RimWorld.

## Références visuelles et limites de comparaison

Deux références primaires ont été réellement observées par Root ; détails et captures d’observation dans `quests-history-next-private/visual-reference.md` :

- [Annonce officielle Steam du 10 août 2020, mise à jour 1.2](https://store.steampowered.com/news/posts/?appids=294100&enddate=1599853798&feed=steam_community_announcements), avec la [capture Imperial Shuttle Crash](https://clan.akamai.steamstatic.com/images/25160263/dc47aa8bb56f42bd890bf253a562c96bac954e2a.jpg). Elle montre des catégories disponibles/actives/historiques, une liste et un détail distincts, les délais et une acceptation **par option** de récompense. C’est un écran 1.2 / Royalty, pas une preuve de vanilla 1.6. Notre choix local puis confirmation est une adaptation héritée de l’ancienne UI Elsewhere ; il ne reproduit pas exactement « Accept for ».
- [Capture officielle Steam ancienne de l’Historique](https://cdn.akamai.steamstatic.com/steam/apps/294100/ss_bb8f991ea52d67f4e32de25f38d600d90f6db32f.1920x1080.jpg?t=1676391313). Elle montre un graphe temporel, ses légendes et des marqueurs d’événements. Sa date originale et sa révision exacte restent inconnues ; le paramètre de cache ne date pas la version du jeu. Restituer nos montants et notre journal ne restaure pas ce graphe.

Ces références étayent la hiérarchie et la lisibilité des faits. Elles ne prouvent ni les règles de la DLL 1.6, ni une identité exhaustive des écrans, ni une accessibilité complète sur tous les formats. Aucune image RimWorld n’est intégrée au produit.

## Qualification acquise et éléments à compléter par Root

La composition stricte installée depuis Faune/Animaux `8d7a56c1` fait passer NativePanels de `fdaaaea5fbc57506a755aaa42476d8391dc91b5afba33a226ddab48ee8c627c5` à `87943d2669860f8c0b6ac44e04c8625e6d559d3de896ce8e3d69c1822e09d169`. Trois coutures seulement : imports, helpers/Historique, Quêtes. Les fins de lignes mixtes extérieures et les autres sections restent conservées. L’ancien refus de composition sur les EOL est antérieur à toute écriture et ne constitue pas un défaut produit.

Quatre contrats intégrés acquis dans `targeted-v1.json` :

1. Faits enregistrés de l’offre, parcours/lien/compétences et dossiers précédents, sans mutation du World ni commande.
2. Réponse par identifiant, refus des handlers expirés, occupés ou d’un contexte antérieur.
3. Valeurs économiques enregistrées, journal 30 / 45 et recherche d’un ancien événement, sans mutation.
4. Choix de récompense local, refus après changement de choix/expiration/contexte, anciens retours et payload d’acceptation inchangé. Le spy qualifie le routage UI, pas l’exécution de la mission par le Worker.

Typage strict complet acquis en 70,926 s ; Pages CODE acquis en 4,211 s. Carte de 2132 sources, SHA de carte `b74a517fcb467952b0eacf59894d6298122af6e0268633a2d1f481ddb1647301`. Ces résultats concernent ce lot ; ils ne rendent pas verts les anciens bancs généraux restés non acquis.

**Coût UI : à compléter par Root depuis l’unique W/C/W en cours.** Aucun coût nul, gain causal ou non-régression générale n’est revendiqué dans ce brouillon.

**Native/WebGPU : à compléter par Root après ses vrais gestes et observations.** La fixture préparée est 16² / Core 0, indépendante des campagnes, sans Worker/step/save et avec spy UI explicite. Sa préparation ne constitue ni une observation rendue, ni une validation d’acceptation moteur, ni une preuve de fluidité/FPS.

**Commit, push et publication : à compléter depuis les reçus réels.** Aucun déploiement n’est présumé. La vraie 325 reste en pause et protégée ; aucune progression, recharge ou commande de campagne n’a servi à qualifier ce lot.

## Qualification finale et observations

Quatre contrats distincts passent. Le typage complet passe en70,926s et le premier Pages CODE en4,211s. Après ces contrôles, seules deux expressions de texte économique ont été raccourcies, avec correction du singulier : aucun callback, type, propriétaire ni calcul changé. Le contrat Historique concerné repasse, le paquet final est recompilé (5,038s avec vérifications de source). Carte finale2132sources `03e7fbd2831c525043d4ac384bb2f222749467904979cde1af2790c85c5272aa`, schéma301. Les deux Workers générés sont comparés au paquet précédent lors de l’assemblage.

Une vraie observation Native/WebGPU sur une fixture16²/Core0 a exercé les dossiers précédents, le choix local de récompense puis sa confirmation séparée, le journal30/45, la recherche sans accent d’un ancien événement et l’accès45/45. Le choix ne route rien ; la confirmation produit exactement `trade-request-answer`, requestId1, optionId2 dans un **spy UI**, sans exécution Engine ni transfert de biens. Le World reste exact, aucune erreur. Le contrôle final800×600 et1280×720 est conservé, viewport rétabli. Aucun Worker, sauvegarde ou campagne n’est utilisé. La vraie325 reste en pause et intacte.

## Coût limité de la construction des pages

Un seul W/C/W acquis,30constructions par charge et bras. Moyennes en millisecondes :

| Charge UI | Témoin avant | Candidat | Témoin après |
|---|---:|---:|---:|
| Journal40événements |0,188|0,197|0,158|
| Journal400événements |0,266|0,214|0,194|
| Dix offres d’asile |1,145|0,744|1,173|

Le journal40 est légèrement plus coûteux ; celui400 se situe entre les témoins. Les dix offres affichent une moyenne plus basse mais un maximum adverse6,601ms contre1,321/1,540ms. Tous écarts et coûts CPU sont conservés. La source mesurée87943d précède uniquement les deux textes finaux : ce n’est pas une nouvelle mesure du texte raccourci. Le candidat affiche par défaut30événements, les témoins40/400 : ce changement de quantité est intentionnel et ne permet pas une prétention de coût de rendu équivalent. Les entrées et identifiants sont conservés, World/Core/commandes inchangés. Aucune mesure GPU/FPS, de débit de simulation ou non-régression globale.

Commit, push et publication sont attestés séparément dans le reçu de livraison du checkpoint. Une compilation ou une fixture n’est pas un déploiement.
