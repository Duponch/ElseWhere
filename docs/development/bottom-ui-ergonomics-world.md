# Monde : accès direct et navigation stable


L'onglet Monde faisait défiler ses changements de vue avec les longues listes de cartes, établissements et sites. Le lot garde la navigation accessible, rétablit **Aller à** pour atteindre directement une carte ou une caravane et sépare le défilement du catalogue de l'espace du globe. La charte carton3D, les quatre actions des cartes et leurs règles restent conservées. Schéma **301** inchangé.

## Comparaison historique précise

Le pré-refonte `c7c61ebbf06a6bdfe42219b3c19989309e3a2cb1` avait trois vues : Cartes et colonies, Globe et caravanes, Voyages individuels. Son registre était une suite d'articles de cartes, **pas un ancien tableau compact**. Les quatre actions Afficher, Préparer/Reformer une caravane, S'installer et Abandonner y existaient ; elles sont toujours présentes dans la baseline Native. Aucun retrait de ces actions n'a été établi.

L'ancien globe et le dossier partageaient deux colonnes, empilées sous1050px ; la fenêtre entière défilait. Le sélecteur typé **Aller à**, placé globalement hors du papier Monde, distinguait carte et caravane, conservait le choix encore présent et séparait le choix du bouton de navigation. Cette structure réelle est la référence : ni recherche générale, ni tri, ni onglets fixes historiques n'ont été inventés.

Le nouveau raccourci est une **adaptation dans la navigation fixe de Monde**. Les quatre vues Native actuelles, dont Factions, restent disponibles. Le catalogue conserve tous ses dossiers et actions ; une liste longue ne chasse plus les accès principaux. Sans globe, la hauteur suit le contenu utile sous la limite du viewport. Avec globe, une aire graphique reste réservée : à côté du catalogue sur grand écran, au-dessus sur écran étroit. Les régions longues disposent de leur propre défilement, y compris la navigation sur les écrans très courts ; les contrôles ne sont pas réduits pour forcer le contenu à entrer.

## Commandes et propriétaires

Le choix dans Aller à est local et n'envoie aucune commande. **Aller** relit la cible confirmée, ses droits, le contexte de campagne/epoch, busy, fault et pending. Pour une carte, il utilise `map-view(id)` ; pour une caravane, `group-select(id)` puis le dossier Native existant, seulement après résolution du même propriétaire actuel. Un remplacement de contexte pendant l'attente ne provoque pas de navigation tardive. Les refus du chemin existant sont conservés ; aucune copie de World, création de carte, commande de déplacement ou permission nouvelle n'est introduite.

## Sources et qualification bornée

L'[annonce officielle Ludeon du 11 juin 2025](https://ludeon.com/blog/2025/06/announcing-odyssey-and-update-1-6/) décrit l'accès Monde/Jump to. Elle concerne la **1.6 unstable**, pas une certification de l'interface finale4871. L'image adjacente à son paragraphe UI a été examinée par Root : c'est **Quêtes**, et elle est rejetée comme référence Monde. Aucun visuel Monde précisément daté/versionné n'a été acquis dans cette recherche bornée. Les choix de placement local sont donc des adaptations documentées, pas une copie visuelle1.6 revendiquée.

**Six contrats distincts déjà acquis**, dans les reçus privés conservés : quatre cas de navigation (choix sans commande/refus, revalidation des gardes, vraie caravane/contexte remplacé, faits de case et clôture après navigation confirmée), et deux cas de géométrie (petites/grandes listes, globe et accès final sur vues étroites/courtes). Ces contrôles n'impliquent ni campagne jouée ni dessin GPU acquis.

## Qualification finale et limites

Rebase local sur le parent649bba01 : quatre sources UI, deux fichiers de contrats. Le Stage conserve les changements de survol livrés, hors des trois coutures Monde. Six contrats distincts acquis par union des trois reçus conservés, sans rejeu : deux de géométrie et quatre de navigation. Le dernier reçu recouvre aussi un cas précédent ; il n'est pas compté deux fois.

Types complets : 72.935 s ; Pages CODE : 5.445 s. Carte 2135 sources, SHA-256 70308ca35c9b53aae86a1eb74da0e3e9a326cb6e9a01268499686763af2eca96. Ces contrôles portent sur les sources finales encore épinglées ; ils ne constituent pas une partie jouée. Le premier typage final a échoué uniquement sur deux accès de test à l’union campaignMap ; l’import type CampaignMapPresentation et deux casts ont corrigé ce rétrécissement de type, sans changement JavaScript, d’oracle ou de comportement. L’échec et la correction sont conservés, et les six cas fonctionnels acquis ne sont pas rejoués.

### Coût UI borné

Une seule comparaison W/C/W, trente résumés de cartes et trois groupes synthétiques, vingt constructions du producteur Monde avec son propre layout par bras après cinq échauffements non chronométrés. World16² non joué, Core0, ordre des identifiants et digests World/projection inchangés ; aucune commande ou route calculée. Les résumés ne sont pas des propriétaires de campagne admis.

| Bras | Moyenne par construction (ms) | Maximum d'un appel (ms) |
| --- | ---: | ---: |
| W1 | 0.439225 | 0.636900 |
| C | 0.482430 | 0.742300 |
| W2 | 0.367800 | 0.528700 |

Tous les témoins et écarts adverses sont conservés. Le nouveau raccourci et les régions changent volontairement la projection ; l'identité des lignes ou de leur géométrie n'est pas exigée. Ce protocole sans planète n'évalue ni géométrie du globe, routes, GPU, débit de simulation ou FPS globaux. Aucun gain causal ni coût nul n'en est déduit.

### Observation Native hors campagne

Périmètre exact du reçu Root : Composant Native/WebGPU réel, globe92cellules déclaré non persistable, projections synthétiques3/30cartes, zéro propriétaire de groupe et une intention map-view UI spy sans Engine/ACK. Aucun Main/Worker/save/campagne.

- desktop : À1280×720 : globe réel visible, trois cartes accessibles. Sur30cartes, catalogue3270px/viewport429px, offset2841 atteint et dernier map29 visible ; les six contrôles de navigation restent aux mêmes coordonnées avant/après scroll.
- quickjump : Choix de map29 par liste native et End/Entrée sans commande, puis bouton Aller donne uniquement {type:map-view,mapId:29}. Le modèle ne simule pas un ACK ni un changement de carte ; page conservée.
- selection : Clic ordinaire sur le globe choisit85 et place son détail en tête. Édition UI du champ Numéro de case vers52 choisit52, sans nouvelle commande.
- narrow : À640×720 : globe au-dessus du catalogue, rayon77,99px, catalogue243,02px. Offset3026,98 atteint, dernier map29 et navigation toujours visibles.
- conservation : World source32² et deux summaries exacts, Core0. ViewportRESET, OWNtab9 et serveur5203 fermés, serveurs/onglet humains préservés.

Limites/écarts conservés : Des libellés préexistants exposent boreal-forest/flat/settlement : correction française privée préparée pour le lot suivant, aucune nouvelle règle. Premier screenshot immédiat montrait encore accueil avant dessin ; screenshot drawn ultérieur acquis. Géographie92 non persistable, aucun groupeUI inventé ; ni charge planète nominale, FPS, picking de campagne ni ACK Engine acquis. Le PNG officiel examiné est Quêtes, rejeté comme référence Monde.

Cette observation de composant avec callbacks UI déclarés ne prouve ni navigation Engine/ACK, propriétaires des résumés synthétiques, géographie persistable, charge d'une planète normale ou campagne jouée. Les contrats de navigation qualifient séparément les vrais propriétaires et gardes.

Schéma301, règles et simulation inchangés. Les 565 publics, 71 chemins de sauvegardes et 68 fiches doivent encore être comparés exactement au paquet fermé avant publication ; aucun hardlink public fermé n'est modifié ou recopié par ce préparateur. Commit, push, Production et HTTPS ne sont attestés que par les reçus de livraison ultérieurs. La vraie325 reste protégée et en pause, avec les autres chantiers.
