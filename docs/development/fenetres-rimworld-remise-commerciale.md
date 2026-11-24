# Fenêtres RimWorld — lot 16 : remise des demandes commerciales de quête

24 novembre 2026. Présentation native du Core 1.6.4871, habillée par Elsewhere. Aucune nouvelle règle, commande, définition d'objet ni modification du schéma 377. Les données et la transaction existantes restent sous l'autorité de la simulation.

## Référence et navigation

Lecture locale de `RimWorld.Planet.TradeRequestComp` : l'action de remise appartient à la demande active du véritable établissement visité par cette caravane. Elle est indisponible si le nombre admissible de marchandises est insuffisant et ouvre une confirmation (`Dialog_MessageBox.CreateConfirmation`), pas un panier d'achat/vente. La remise requise est complète ; les objets récompenses et le bonus de relations de +12 passent par les mécaniques de la quête. Pas de négociateur ni de stock du marchand fictif pour la remise.

- Dans Quêtes, choix et acceptation au format boîte de message. Le dossier accepté pointe maintenant vers la case réelle de l'établissement sur le globe et, quand une caravane y est effectivement arrêtée, vers son dossier.
- Dans le dossier de la caravane, la section de demande indique la destination, la quantité requise et le délai. Le devis de simulation `quoteTradeRequestFulfill284` donne le nombre admissible, ou désactive l'action avec le motif. Les autres boutons de commerce restent indépendants.
- Confirmation centrée `layout: 'message'`, **640 × 460**, corps défilant, Retour et Confirmer fixes. Affiche la quantité exigée et disponible, les fragments de lots effectivement consommés, la récompense sélectionnée (identifiants des objets originaux, qualité, porteur), les relations avant/après et la masse/capacité après remise. Une surcharge est signalée, pas transformée arbitrairement en motif de refus. Les variations diplomatiques tiennent compte des seuils et limites de la règle existante.
- Après confirmation effective, retour au dossier de la caravane ; la demande n'est plus remissible. Dans l'historique de la quête, reçu issu de `fulfillment` (et non recalculé) : quantités remises, caravane, lots récompenses et relations.

## Consentement, propriétaires et cycle de vie

`src/ui3d/native-trade-request-delivery.ts` possède un seul dialogue et un seul consentement. `native-world.ts` construit la lecture de la visite et du devis réels ; `native-panels.ts` relie la quête et son reçu. Aucun inventaire de substitution.

- Vérification de la campagne, génération, visite, groupe et demande avant et après l'accusé de pause. Une signature de devis et un instantané des seuls scalaires présentés sont conservés, pas le propriétaire mutable.
- Sur une publication Full acceptée (`publicationRevision`, également quand l'objet de projection reste le même au même tick), la revue est revérifiée. Un changement invalide visiblement le bouton, explique le refus et oblige à revenir au dossier. Une pause ou un envoi déjà en cours ne peut pas être repris en double par ce rafraîchissement.
- Au clic, lecture neuve, pause confirmée et comparaison du devis et des faits ; une seule commande `trade-request-fulfill` avec `requestId`, `groupId`, le devis et `confirm: true`. Réponse négative ou exception : pas de renvoi automatique. Un ancien clic, un ancien retour ou un ACK tardif ne peut ni réarmer la confirmation ni reprendre une autre page.
- Retour/croix rendent la main à la navigation possédée, sans modifier le monde. La commande et la comptabilité physique sont celles de la simulation préexistante.

## Qualification

- Passe finale des lots 16–17 : 10 suites, 96 réussites, deux preuves acquises explicitement ignorées par la passe rapide. Voir `tmp/handoff-20261123/codex-lots16-17-final-tests.log`.
- Preuve opt-in `NATIVE_TRADE_DELIVERY_PROOF=1` de `tests/native-trade-request-delivery.test.ts` : **22 tests sur 22 réussis**, dont une transaction avec les propriétaires d'une campagne géographique acquise (86,53 s, `codex-lot16-delivery-proof-final.log`). Une demande de sept tissus est préparée à l'établissement existant, acceptée par `applyCommand`, puis remise depuis les véritables inventaires ; le lot de dix ors d'origine quitte le détenteur de récompense et rejoint la caravane, le reçu correspond exactement au devis. L'ouverture, le retour et les callbacks obsolètes ne modifient ni la sérialisation, ni le RNG, ni `nextId`. Projection déclarée insuffisante, y compris changement en place au même tick, pour vérifier les refus ; ce n'est pas une revendication de trajet ou d'offre engendrés naturellement. Source de campagne et sauvegardes utilisateur non réécrites.
- Typage et build Pages vérifiés avec le lot 17. Pas de mesure FPS ou de contrôle du rendu WebGPU dans le client pour ce lot. Aucun déploiement.

Suite : gestes manquants de sélection, raccourcis et file d'ordres générale (cette dernière relève d'un travail de simulation avec nouveau schéma).
