# FinishFrame301 : première portée mur en bois

Qualification ciblée du 1 novembre 2026 ; enregistrement et publication selon le checkpoint courant. La campagne réelle 325 reste en pause et n’a pas servi de fixture.

Cette tranche remplace le travail historique au macro pour le **Frame d’un mur en bois uniquement**, en schéma 301. Elle s’appuie sur les branches ciblées de Core 1.6.4871 rev590 : coût WorkToBuild, FinishFrame, compteur Thing, Touch, ordre XP/stat/échec, transitions de toil et leavings. Elle prolonge le [lot civil 300](idle-job-fallback300.md) et le modèle local de [matériaux de construction](construction-materials.md) ; elle ne déclare pas les fondations terminées.

La primaire locale est Assembly-CSharp.dll, SHA256 `5cf1b5be399d5b1c9c56ca72c9d35b4ecf307feacf5859d04ac5a1aa5926356a`, revérifiée avant livraison. L’[annonce officielle de 1.6](https://ludeon.com/blog/2025/06/announcing-odyssey-and-update-1-6/) décrit l’étalement de charge ; les chiffres et branches précises de ce lot viennent du code installé consulté.

## Travail et conservation

Le coût natif du mur en bois est 135 × 0,7 = 94,5 unités, sans arrondi à 95. Le travail emploie le stat du constructeur, les capacités et conditions locales représentées, le facteur 1,7 et le delta Core, avec les arrondis Float32 dans leur ordre. Pour Construction 3 neutre, la vitesse 0,5625 donne 0,95625 unité/Core : l’oracle sans échec, à delta 1 et conditions maintenues, achève en 99 Core, contre 180 Core pour l’ancien calcul local neutre. Ce n’est pas une promesse de 99 Core pour toute visite jouée : cadence, première tranche accumulée, état du bâtisseur et échec interviennent.

Le compteur Thing appartient au pawn et continue entre les jobs ; il n’est pas remis à zéro à l’entrée du toil. La vue réelle vient de ColonyRenderer, passe par le client et le Worker courants et reste éphémère. Les cinq bandes 3D, calibrées par hauteur de vue au centre d’orbite ≤16/24/36/54/>54 cellules, donnent les taux 1–5 ; hors vue ou en headless, le taux est 15. Le rectangle conservateur du frustum au sol est étendu d’une case. Ce calibrage et son envoi quantifié sont des adaptations du rendu 3D, pas une identité de pixels avec Core.

Le Frame conserve son cumul de travail ; la visite du bâtisseur possède le toil 5000 Core et ses transitions réelles. Une continuation refusée avant le toil libère le Job ; l’absence de contact seule conserve le trajet. Un nouveau Frame choisi par Main est admis sans payer une fois l’ancien travail macro. Le contact diagonal est limité à ce vrai Frame bois ; le trajet doit être terminé. Un toil déjà actif peut travailler pendant stun, tandis que Ready et les transitions restent soumises à busy. La sortie peut conserver la posture d’expiry 1 avant la décision suivante.

L’XP précède la lecture de vitesse ; sa représentation locale reste en millipoints d’XP entiers. Le succès utilise la compétence et les capacités effectivement représentées, sans multiplier par WorkSpeedGlobal ou la lumière. Le tirage d’échec joueur hors tutoriel a lieu à chaque invocation admissible, avant l’ajout de travail, y compris quand la probabilité d’échec est nulle.

À l’échec, l’ancien Frame est retiré avant les leavings et un blueprint neuf, sans progrès, est créé après. La récupération se calcule par pile réelle : max(RoundRandom(count×0,5),1), avec le tirage requis même pour une quantité entière. Les portions conservent quantité, identité/ID de split, état et conditions de fusion ; un dépôt peut être partiel. Les fusions déjà réalisées restent acquises si Near refuse ensuite. Aucun retry ni réattachement automatique du reliquat à une autorité persistée n’est ajouté. L’ordre radial des distances égales, certaines géométries/métadonnées locales et le PRNG restent adaptés ; le flux global Core n’est pas reproduit bit à bit.

La migration 300→301 est neutre : validation 300 puis changement du numéro seul. Elle ne crée ni compteur, travail, toil, posture ou date passée. Au premier vrai contact, un ancien chantier conserve sa fraction payée avec son ancien seuil ; progress/workRemainder ne sont pas relus comme des unités natives. Arrêt, reprise et changement de bâtisseur conservent le cumul du Frame. Les autres matériaux et constructions gardent leur calcul historique.

## Preuves acquises et limites

Seize contrats intégrés Engine, deux conséquences matérielles et trois contrats de continuité 301 passent ; typage et Pages passent en 71,807 s et 5,603 s. Les reprises de contrôles ne constituent pas de nouveaux cas distincts.

Une fixture 32² séparée a été jouée par l’interface Native via IAB : mur 184 achevé, état final observé au Core 564, RNG 765300941, prochain ID 185. La sauvegarde et la recharge UI conservent le Whole entier ; les deux exports actual-core564 et reloaded-core564 ont le même hash commençant par b9aa292c. Aucun export de la vraie 325 n’a été utilisé.

L’observation Native contient 128 échantillons sur 704 ms, sans erreur de collecteur. Les six paires du compteur Full `[14,1] [20,1] [30,1] [43,0] [50,1] [60,1]` ne correspondent qu’au taux 2 dans ce scénario, et excluent le fallback 15 : c’est une preuve comportementale de consommation de la vue, **pas un ACK de protocole**. La cible jobSolid présente avant est retirée au passage du chantier au mur, à play 73. Ces observations ne qualifient ni les bras, ni une pose CPU indisponible, ni les FPS globaux.

Les coûts fonctionnels W/C/W restent inconclusifs : valeurs entre témoins et résultats adverses sont conservés, sans conclusion causale de gain ou de non-régression globale. Le banc général de présentation 90 s n’est pas acquis. Les 11 contrats purs du harnais courant passent mais restent privés et non installés ; ils ne remplacent pas le contrôle réel ciblé ci-dessus.

Main demeure au macro avec un délai possible 0–9 Core. Le fallback insideFrame/OnCell et la gestion d’occupation au spawn final ne sont pas portés. Les autres Frames restent historiques, et cette portée ne prouve ni parité exhaustive Core, ni fluidité globale, ni fin du chantier des fondations.
