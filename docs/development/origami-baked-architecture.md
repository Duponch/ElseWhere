# Origami : préparation des couleurs et contours dans une texture

État du 3 novembre 2026 : **lot opaque qualifié en composants ; suite des performances ouverte**.
L'objectif reste le coût du mode Par défaut avec la même impression visuelle.
La parité n'est pas acquise. La simulation, le schéma301 et la vraie325 sont
inchangés ; aucun push ou déploiement n'est demandé.

Le 3 novembre, l'utilisateur a choisi de conserver les **formes Legacy des
arbres avec une apparence Origami**. Cette nouvelle direction concerne les arbres,
pas les animaux ni les humains. Le raccord maintenant intégré aux sources reprend aussi le vrai
matériau Lambert Legacy : une texture gouache opaque partagée doit remplacer les
calculs de peinture et les surfaces transparentes de traits pendant l'affichage.
Le style gouache n'impose aucun modèle d'éclairage plus coûteux. Les arbres
préparés utilisent désormais Lambert ; les autres producteurs Origami conservent
leur éclairage existant. Le chemin exige relief0/usure0 ; tant qu'une recette
n'est pas prête ou est refusée, son rendu source reste disponible explicitement.

Un premier banc des mêmes formes Legacy confirme, par empreintes de positions,
normales, couleurs, indices et plages, que seule leur présentation change.
Le premier banc avec peinture précuite et Lambert est désormais mesuré : sur
400 peupliers en 1920×1080, ombres désactivées, les trois passages Legacy /
gouache opaque / Legacy donnent **0,6171 / 0,6281 / 0,6281 ms GPU**. Le candidat
est à +0,88 % de la moyenne des témoins ; son pic à 1,048576 ms est conservé.
Le CPU de soumission donne 0,2363 / 0,2219 / 0,2277 ms, avec la même médiane de
0,2 ms. Cela établit un coût proche sur ce composant, sans prouver les FPS d'une
partie ni la parité globale. Les deux retours Legacy ont exactement les mêmes
pixels. Deux lots, 24 000 triangles d'arbres, un matériau Lambert et un atlas
2048² partagé remplacent les couches Source à l'affichage.

Cette première version de mesure reprenait encore la peinture générique sur les
UV brutes. La version V27 corrige les faces kraft brunes du feuillage : le masque
de remplissage suit les vrais polygones pendant la préparation, et les peintures
du tronc et du peuplier sont celles du registre Origami existant. Cinq vues Native
(près, loin, rasante et vent à 0,8 confirmé) ont été observées sans erreur. Le
matériau Lambert affiché reste identique à V26, mais aucun nouveau chronométrage
de V27 n'est revendiqué. Le raccord aux treize recettes réelles de ResourceLayer
et au propriétaire SceneRenderCore est désormais intégré aux sources. Une texture
partagée à plusieurs couches évite un matériau par espèce. Les treize essences
sont raccordées ; leur admission est observée dans l'atelier V31 ci-dessous,
sans constituer treize contrôles de qualité en gros plan.
La géométrie privée de comparaison utilise des copies à sommets entrelacés ;
elle ne sera pas transférée telle quelle au produit, dont les écritures de
croissance et de recul exigent des attributs contigus. Le raccord produit utilise
ces attributs ordinaires avant les plages de visibilité, les champs de vent et
le compilateur435 ; les proxies privés de V26 ne sont pas promus. L'état réel du
commit local figure dans le checkpoint ; aucun push ou déploiement n'est demandé.

Le banc **V29** utilise maintenant le vrai `ResourceLayer` et le vrai
`TreeBakeOwner`, sans transformation de source ni proxy. Sur400peupliers FullHD,
ombres OFF, les trois essais uniques Legacy/Origami/Legacy donnent
**0,628053/0,595285/0,606208ms GPU**, avec12mesures GPU fraîches chacun et aucune
erreur. La dérive des témoins est de−3,48% ; les horodatages restent quantifiés
à65,536µs. Le coût est proche des témoins ; l'écart de−3,54% ne prouve pas un gain
causal. Le CPU de soumission donne0,366055/0,359333/0,377064ms, avec une dérive
Legacy de+3,01%. Les trois bras mesurent4appels et24003triangles pour le composant.
Les400arbres du candidat sont prêts, sans repli, sur une seule page partagée.
Ses cinq vues, dont le vent à0,8, ont exactement les PNG de V27 ; le retour
Legacy et le retour des gestes de prévisualisation/textures/croissance/visibilité
conservent également leurs pixels de référence. Le [rapport V29](../../tmp/origami-baked-architecture-20261102/legacy-tree-product-runtime/native-v29-performance-summary.json)
porte l'empreinte SHA256 `299ebfec7d1aa401233258e49b1a83865eede214fbf2cc2197d79267f3b9d705`.
Ce banc n'active pas435 et ne qualifie ni le vrai Core, ni les douze autres
essences, ni les ombres, les humains, une campagne ou les FPS globaux.

Le vrai Core **V28** a conservé son refus observable pour34arbres sans espèce
forestière explicite. **V30** charge ensuite une nouvelle carte32×32 en pause
par le vrai Worker, avec un biome explicite :26chênes/peupliers sont prêts sans
repli sur deux pages partagées de42,5Mio, ainsi qu'un renard. Largeur1,7→2→1,7,
textures OFF/ON et fermeture publique passent sans erreur. Le header reste
schéma301/Core0/tick0/RNG61103/nextId381 ; la garde du harnais vérifie aussi
l'identité de l'objet World et de son JSON, sans avancer la simulation.
Le retour d'image conserve un écart de99pixels sur851200, MAE0,000569niveau/255,
maximum11 ; aucune cause ni identité pixel n'est supposée. Le renderer est
effectivement fermé, sans erreur de nettoyage. Le [rapport V30](../../tmp/origami-baked-architecture-20261102/core-tree-site-runtime/native-v30-core-summary.json)
porte le SHA256 `e4d8c5e400b338fd2a33718c815e6821e24af5e83ef071d297ef61b72a45de28`.
**435 est inactif dans cette fixture ColonyRenderer directe**, faute de contexte
d'application : le module chargé ne prouve pas son activation. Le contrat435
distinct est acquis ; aucun Whole du Main, essai de FPS ou contrôle d'ombres
exhaustif n'est déduit de V30.

Le banc **V32** reprend cette même initialisation publique et ajoute exactement
trois raccords de Main : `SceneApplicationContext`, le champ lumineux partagé
avec sa topologie et sa vue préparée, et la préparation des structures. Les
trois déclarations sont comparées à `src/main.ts` et épinglées ; la factory
héritée conserve son vrai `new this`. **435 est désormais effectivement actif
dans ce sous-ensemble** : deux pages, quatre blocs et 2884 triangles compilés,
égaux aux triangles source. La page portant les matériaux des arbres comporte
deux producteurs, deux blocs et 4680 indices, soit 1560 triangles ; il ne s'agit
donc pas seulement d'une page de terrain.

Les 26 chênes/peupliers générés restent prêts sur deux pages partagées de 42,5 Mio,
sans repli, et le renard conserve sa vraie publication opaque. Le contexte et
l'éclairage appartiennent au World courant ; topologie et préparation des
structures sont partagées. Largeur 1,7→2→1,7 et textures OFF/ON sont observés,
avec le même header schéma301/Core0/tick0/RNG61103/nextId381, sans simulation
avancée. Le retour conserve **99 pixels différents sur 851200**, MAE 0,000569 et
maximum 11, sans variation d'alpha ; aucune identité pixel ni cause n'est déduite.
La fermeture publique attend le renderer, fermé sans erreur. Le [rapport V32](../../tmp/origami-baked-architecture-20261102/core-tree-main-context-runtime/native-v32-core-summary.json)
porte le SHA256 `7d55a69853947911f68bf33e6867e5bbb2f2cd9d783b34cf51d5b3b64314f998`,
sous le pin `7548d819ef37bec24c0cde855822ba3bf72aad9a6356bd119f158d80c33debad`.
Ses cinq reçus décrivent un seul cycle de vie, sans nouveau chronométrage ni
preuve de performances. Room et les réglages d'ombres produits sont conservés,
mais la carte n'a aucun émetteur local lu ; les lampes et pièces non vides ne
sont donc pas qualifiées. Les lecteurs d'intentions, la file d'admission, l'UI,
les ordres et la boucle Main ne sont pas repris : **V32 n'est pas Whole Main**.
L'observation historique V30 sans435 reste distincte et inchangée.

L'atelier `assets.html` possède maintenant un raccord source au même
`TreeBakeOwner` : préparation exclusive, publication avant recalcul des bornes,
statuts et étiquettes, retrait avant modification de peinture et fermeture après
règlement de l'opération asynchrone. **V31** est observé par la vraie UI : les
notes d'admission des13essences, quatre gros plans (peuplier, saule, sapin,
cactus), largeur1,7→1,8→1,7 et aller-retour Par défaut701→Origami714 sont acquis,
sans erreur console ou erreur visible. Les défauts relief100%/usure75% sont
conservés ; le chemin opaque est préparé après leur passage explicite à0/0.
Le [reçu V31](../../tmp/origami-baked-architecture-20261102/gallery-tree-pages-runtime/native-v31-ui-summary.json)
porte le SHA256 `0ddfb0bbf4a1ba24a34bfb6586df30d7a9e7918ce6dfb11b1971994e8a588488`.
Les captures restent dans le tour CUA, sans PNG exporté ni diagnostic caché ;
treize notes ne valent pas treize gros plans. La page est fermée après règlement
du travail, sans reçu de nettoyage post-pagehide ni fermeture en pleine cuisson.
Le contrat d'adaptateur/owner PASS22,076s reste une preuve séparée, avec raster,
copies et compilation remplacés par des métadonnées de test.

Le correctif de quarantaine du chemin d'erreur Core après publication est
qualifié par deux cas ciblés, dont un nouveau, en28,126s
(`origami-tree-quarantine-dispose-final-2026-11-03T17-04-51.723Z-13352`). Le premier
lancement avait échoué avant collecte sur un mock hoisté ; cet échec et son
original sont conservés. Les gels Native V30/V31 précèdent ce correctif limité
aux erreurs et au nettoyage ; les contrats CPU n'exigent pas de rejouer le
chemin heureux Native déjà acquis. Le typage complet final passe en70,766s
(`origami-opaque-trees-final-types-2026-11-03T17-05-44.688Z-20200`) et le build Pages
standard en5,260s (`origami-opaque-trees-final-pages-2026-11-03T17-07-36.357Z-22804`).
Les deux Workers finaux ont exactement les tailles et SHA256 de la sortie
standard acquise à09:18 ; les sources suivies bridge/simulation sont inchangées.
Le [rapport d'identité](../../tmp/origami-baked-architecture-20261102/final-worker-identity.json)
porte le SHA256 `8ad7b9a002541f375d3a94c4e3b9da3bf685a6b4fc961186e39fad38c2cbde7a`.
Cette comparaison ne remplace ni les anciens contrôles de simulation ni un
Whole du Main. Le lot est enregistré par le commit local
`baadb63a4c1571120264c84923f84138d6a9160c` ; le travail de performances continue,
sans push ni livraison distante. Les animaux conservent
les limites de qualité détaillées plus bas ; les humains gardent leur rendu
actuel, sans optimisation opaque installée.

## Architecture du candidat

Le chemin admissible exige Origami, textures actives, relief0 et usure0. Il
prépare la peinture, le papier, le remplissage et les traits noirs/carton dans
une texture opaque. L'affichage des animaux conserve leur géométrie, leurs
poses, leurs attributs cliniques et l'éclairage existant ; sa couleur vient
ensuite d'une seule lecture de texture. Les rubans transparents du modèle
source sont retirés de l'affichage seulement après publication réussie.

Une texture est partagée par espèce et génération exacte de peinture, jamais
créée par individu. Le cache conserve des propriétaires explicites et refuse
les préparations qui dépassent son budget. La préparation utilise le renderer
exclusivement au chargement ou pendant une vraie pause ; aucune cuisson ne
s'exécute dans la boucle de mouvement des animaux. En cas de refus ordinaire,
le modèle source reste utilisable. Un nettoyage dont l'intégrité est inconnue
met la réservation en quarantaine et interrompt les allocations suivantes.

Le matériau publié pour une espèce sans sang visible omet maintenant le graphe
des taches. Cette capacité est explicite : les appelants génériques gardent
leur calcul de sang, et une blessure fait repasser l'espèce au matériau source
avant son affichage. Deux contrats ciblés vérifient les shaders et une blessure
pendant la préparation, puis les transitions après publication. Le gain propre
de cette suppression n'est pas isolé. Deux vues Native, proche et joueur,
gardent exactement les pixels du candidat précédent après cette suppression.

Les champs de peinture et les contours gardent leurs producteurs actuels.
Le regroupement des faces ne change ni leurs positions, ni leurs UV source,
ni les graines des traits. Les cartes reçoivent des marges isolées et quatre
niveaux de filtrage. Une indexation exacte réutilise uniquement les sommets
dont tous les attributs sont identiques.

Seuls les arbres admissibles et les animaux décrits ici sont raccordés au chemin
opaque. Les autres végétaux et les humains gardent leurs producteurs existants.
Les anciens bancs de peupliers décrits ci-dessous utilisent la forme source au
repos ; ils ne représentent pas la nouvelle direction Legacy du banc V29.

Un second banc utilise maintenant 400 vrais peupliers procéduraux et une banque
de textures partagées entre plusieurs proportions de pièces. Après rétablissement
du contrôle du navigateur, sa comparaison Par défaut/banque/Par défaut donne
0,6281/1,0977/0,6499 ms GPU : la banque reste **71,8 % plus coûteuse** que la
moyenne des témoins. Les trois bras font quatre appels de dessin ; le candidat
affiche 56 003 triangles contre 24 003 pour Par défaut. Ce banc en 1920×1080
ne se compare pas directement aux anciens essais de la forme statique.
Les quatre angles uniques comparés à la source montrent aussi des traits trop
adoucis et moins contrastés : ce prototype ne satisfait pas la qualité demandée.
Les deux captures précédemment décrites comme venteuses ont en fait conservé
un vent nul et sont des doublons exacts des gros plans ; le vent reste à vérifier.

Pour les humains, un prototype CPU génère une seule fois les contours du modèle
complet et partage leurs projections entre pièces et couleurs. Deux contrats
vérifient l'identité avec la source, les données empruntées, leur libération et
les budgets de pages. Il ne produit encore aucune texture à l'écran. Les
proportions du corps modifient la métrique du pigment source : leur traitement
reste à qualifier avant le raccord au moteur humain.

Un sélecteur préparatoire utilise aussi les règles de visibilité existantes
pour associer chaque pièce au profil de son propriétaire. Deux autres contrats
vérifient les échanges d'apparence, les outils et états d'yeux, ainsi que le
refus d'une préparation devenue obsolète. La fixture de deux apparences demande
45 cellules de texture utiles ; aucun pixel n'est encore alloué par ce helper.
Il ne certifie pas la morphologie, les taches de sang ou le rendu humain final.

Le banc GPU privé ultérieur **V33** a affiché la source et le candidat humain
aux vues joueur, proche et latérale. Le gros plan conserve des bras trop flous :
**NO GO de qualité**, aucun raccord humain au produit ni chronométrage acquis.
Le retour Source conserve exactement son PNG initial. La libération a été
demandée par l'UI et l'onglet21 a été fermé, sans erreur enregistrée ; ce n'est
pas un nouveau reçu d'état interne du renderer après fermeture. Le [rapport V33](../../tmp/origami-baked-architecture-20261102/human-gpu-cell-runtime-current/native-v33-quality-summary.json)
porte le SHA256 `9bda515376a270b40788e6095f2d74aa9a788c99758764f3984f7501a4a51f8d`.
Ce rejet reste privé et distinct des preuves de contexte435 et de métrologie.

Deux pistes supplémentaires restent privées. La première emploie la place libre
de l'atlas du cerf pour augmenter la définition de ses deux bois complets, sans
agrandir la texture ; ses trois contrats et sa compilation passent. Quatre vues
sont désormais conservées, mais leur analyse ne permet pas encore d'admettre
cette piste. La seconde calcule une partie de l'éclairage aux
sommets après un raffinement des triangles. Ses critères numériques et son
graphe froid Room passent, ombres comprises ; elle ajoute du travail aux sommets
et des triangles. Son essai Native V23 a ensuite montré un écart visuel de
feuillage d'environ9niveaux/255 : verdict NO GO, aucune activation.

La politique de définition renforcée a également été contrôlée sur les 53
espèces : 14 sont admissibles et 39 conservent le chemin normal. Les données
source et les dimensions des textures restent intactes dans tous les cas.
Cette admission géométrique ne constitue pas une validation visuelle.

## Qualification acquise et limites

| Essai borné | Résultat | Limite |
| --- | --- | --- |
| V32, vrai Core et trois raccords de contexte Main | 26 arbres prêts sans repli ;435 actif,2 pages/4 blocs/2884 triangles dont une page d'arbres de1560 triangles ; fermeture sans erreur | Cycle de vie en pause seulement, retour99 pixels différents conservé ; aucun nouveau chronométrage, pièce avec lampe ou Whole Main |
| V29, vrai ResourceLayer/TreeBakeOwner :400peupliers Legacy / gouache opaque Lambert / Legacy | GPU0,628053 /0,595285 /0,606208ms ; CPU0,366055 /0,359333 /0,377064ms ;400prêts,0repli | Coût local proche, dérives et quantification conservées ; ombres OFF, sans435/Core/campagne, aucune causalité ou parité globale |
| 400 peupliers source identiques, ancien Origami / texture opaque / ancien Origami | GPU moyen 0,8793 / 0,4751 / 0,8957 ms, environ −46,5 % | Au repos, ombres désactivées, aucune diversité procédurale |
| 400 peupliers, Par défaut / texture opaque / Par défaut | GPU moyen 0,3222 / 0,4915 / 0,3277 ms | Candidat encore **+51,3 %** contre les témoins Par défaut ; formes natives différentes |
| 45 animaux, vrai WildlifeLayer, cerf et raton laveur | GPU moyen 0,3222 / 0,1966 / 0,3714 ms, environ −43,3 % | Dérive des témoins +15,25 %, pas de comparaison animale Par défaut |
| 45 adultes au repos, candidat courant : Par défaut / opaque / Par défaut | GPU moyen 0,2021 / 0,2185 / 0,2075 ms ; CPU de soumission 0,4319 / 0,4555 / 0,4169 ms | Environ +6,7 % GPU et +7,3 % CPU contre les moyennes témoins ; deux espèces, ombres OFF, pas une parité globale |
| 45 adultes au repos après retrait du graphe sang : Par défaut / opaque / Par défaut | GPU moyen 0,2130 / 0,1966 / 0,2021 ms ; CPU de soumission 0,4283 / 0,4759 / 0,4391 ms | Environ −5,3 % GPU mais +9,7 % CPU ; mêmes limites, dérive des témoins −5,1 %, pas de gain causal isolé ni parité globale |

Les mesures GPU ont une quantification de65,536µs. Les résultats CPU ne
montrent pas de gain établi. Ces essais ne prouvent ni les FPS d'une colonie,
ni la qualité de toutes les espèces, ni le coût des ombres ou de Room.
Les données, témoins défavorables et captures sont conservés dans le checkpoint
privé `tmp/origami-baked-architecture-20261102/progress.md`.

Le filtrage moyen par face a été observé séparément sur le candidat courant.
Dans les petites silhouettes, l'écart RGB moyen mesuré contre la source passe
de8,84 à6,96 niveaux/255 ; le trait proche demeure trop doux. Son essai avec
45animaux donne0,2185ms GPU, mais0,6135ms CPU de soumission, résultat adverse
conservé. Il reste désactivé dans le moteur principal. Ces écarts d'image sont
des diagnostics, pas un seuil de qualité ou une preuve de perceptibilité.

Les comparaisons visuelles montrent notamment des contours plus doux. La
conservation de la silhouette et des données géométriques ne constitue donc
pas une identité visuelle acquise. Le banc du vrai SceneRenderCore est maintenant
observé sur une carte neuve32×32 en pause, chargée par le vrai Worker : trois
lièvres générés, une texture partagée de1024×512, aucun ruban source affiché.
Changement des paramètres, retour, textures OFF/ON et fermeture passent sans
erreur. Le zoom ne change pas la génération du cache. Cela qualifie ce cycle
de vie, pas la qualité des animaux en gros plan, leur transport clinique ou
une comparaison de coûts.

## Robustesse du comparateur — deux contrats ciblés acquis

Le comparateur du jeu recevait tout le diagnostic des textures précuites :
plans d'atlas, octets et états détaillés des espèces, caches et arbres. Ce
diagnostic peut dépasser ses gardes inchangées de1024valeurs et16384caractères.
Un contrôle CPU borné par la vraie API publique, avec caméra et paramètres
minimaux, a reproduit le refus dès41espèces :838valeurs mais16622caractères.
45espèces donnent914valeurs/18134caractères et53espèces1066/21158. Le contexte
réel du Core ajoute d'autres paramètres et peut donc atteindre la limite plus tôt.
Le [reçu de dimensionnement](../../tmp/origami-baked-architecture-20261102/comparison-metadata-size-audit.json)
porte le SHA256 `7af8a11ef34066cabb76cebb8d1ff05b994038490102433542a369701500df59`.
Il duplique uniquement la forme de métadonnées d'une publication V32 pour
dimensionner le message ; il ne prétend pas avoir admis53atlas réels. Aucun
modèle, Canvas, World ou GPU n'a été construit pour ce contrôle.

Le correctif source remplace ce diagnostic dans la mesure seulement par des
ports compacts : espèce, UUID de géométrie et matériau, état actif, textures,
sang, branche source/précuite et rubans. Les arbres donnent leurs générations,
matériaux et une révision mise à jour par les vrais changements de chunks ou
d'aperçu de sélection. La lecture ne refait aucun recensement des chunks, aucun
plan d'atlas ou total mémoire ; les diagnostics Native détaillés restent inchangés.
L'identité complète de chaque essai reste contrôlée à chaque échantillon.

Pour confronter deux styles, seul le résumé de présentation intrinsèque au style
et ses préférences graphiques sont exclus du message de comparabilité. World,
caméra, viewport, backend, paramètres de rendu communs, outil et sélections
restent exacts. Deux essais du même style conservent l'identité stricte complète.
Les limites de taille et les refus d'un contexte invalide ne sont pas assouplis.

Les deux nouveaux [contrats ciblés](../../tests/graphics-style-comparison-metadata.test.ts)
passent en33,772s (`origami-comparison-compact-metadata-2026-11-03T18-07-51.371Z-15024`).
Ils utilisent le Core public, les vrais ports et le collecteur, avec53petits
propriétaires de métadonnées : taille, changements d'état/UUID, aperçu et retrait,
paramètres communs et gardes. Les modèles des53espèces, leurs atlas et un renderer
ne sont pas construits. Ce PASS exclut les pixels, les performances et une
admission Native de53espèces. Le commit du correctif reste à effectuer ; aucun
hash d'enregistrement ni livraison distante n'est présumé.
Le premier typage complet a échoué en72,167s sur les seules intersections
`never` des trois prototypes de la fixture
(`origami-comparison-metadata-product-types-2026-11-03T18-09-33.898Z-16788`).
Les assertions de type ont été déplacées après `Object.assign`, sans changement
du comportement ou des oracles ; la source précédente est archivée exactement.
Les deux PASS restent acquis sans répétition après ces seules annotations.
Le typage complet final passe en69,281s
(`origami-comparison-metadata-product-types-final-2026-11-03T18-13-33.666Z-12360`)
et le build Pages standard CODE en4,338s
(`origami-comparison-metadata-pages-2026-11-03T18-21-22.953Z-17688`).
La sortie C privée garde `publicDir=false`, sans copie des médias publics.
Ses deux Workers sont strictement identiques en octets aux fichiers standards
de17:07, SHA256 `043ebe6a63b3b9ee2f62ea6b99ced62f51a2421b335dd4e4dbd63206c915393b`
et `d46556530d6c6f66a674f0638b4bc872c159bd3c76edbc72aab3c2fba727090e`.
Les sources bridge/simulation suivies sont inchangées. Le [reçu d'identité](../../tmp/origami-baked-architecture-20261102/comparison-worker-identity-20261103.json)
porte le SHA256 `a7ca8a373a8a5eb97c293aee632911b2c1d8dec221ad4e00ddea5f7acad4a758`.
Aucun gain CPU n'est chiffré et le Native humain V33 ne qualifie pas ce correctif.

## Dernières corrections de préparation

L'éléphant dépassait la hauteur permise avec le rangement en lignes, bien que
ses206rectangles occupent seulement87,68% de2048². Un rangement compact borné
sert maintenant de recours uniquement après ce refus. Il conserve la densité,
les dimensions et les marges. Les52autres dispositions admises restent sur
leur chemin antérieur. Dix contrats ciblés, types complets et Pages CODE ont
qualifié cette correction ; aucune réduction de résolution n'est appliquée.

Le cache peut désormais réserver la mémoire GPU en deux temps : la préparation
CPU reste réservée dès le départ, puis le plan exact du modèle est admis avant
toute allocation GPU. Le plafond par préparation reste256Mio et celui du cache
512Mio. La réservation ne diminue jamais pendant une préparation. Au retour,
seule la mémoire conservée demeure comptée. Cela évite de réserver256Mio pour
chaque petit modèle ; ce n'est ni un gain de FPS ni une mesure de VRAM pilote.

La validité des pixels empruntés fait aussi partie du contrôle de publication.
Une nouvelle génération de peinture, même sans changement des options, laisse
le travail en attente et provoque une nouvelle préparation pendant la pause.
Elle ne transforme plus une annulation temporaire en repli permanent.
Dix contrats cache/compilateur et neuf contrats orchestration/préparation
passent pour ces coutures. Ils vérifient les propriétaires et l'ordre des
opérations, sans remplacer une observation graphique.

## Travail encore ouvert

- Le filtrage lointain : quatre niveaux seuls ne suffisent pas aux petits
  animaux. Des helpers encore désactivés calculent une moyenne par vraie face
  à la préparation et effectuent la transition selon l'empreinte à l'écran.
  Trois contrats d'admission et de nettoyage passent ; ils n'ajoutent aucune
  boucle CPU de LOD. Leur raccord produit et leur qualité restent à qualifier.
- L'ancien prototype de forêt variée : les six pièces canoniques du peuplier peuvent partager
  leurs coordonnées avec les neuf pièces affichées. Les formes anisotropes et
  le vent imposent encore de conserver les proportions de la peinture et des
  grains des contours ; une texture finale simplement étirée n'est pas admise.
  Il n'est pas promu. Le choix humain de formes Legacy est désormais raccordé
  aux sources pour les13essences ; V29 qualifie le coût du composant peuplier,
  V30 le cycle Core en pause et V31 les13admissions/quatre gros plans. V32 observe
  le vrai contexte et435 actif sur cette carte32², sans reprendre tout Main.
  La qualité des autres gros plans, les ombres exhaustives et Whole Main restent ouverts.
- Le coût d'éclairage : une factorisation algébrique privée est préparée pour
  des faces rigides sous Directional+Hemi. Le jeu emploie aussi des PointLight
  et des déformations. Le premier contrôle CPU annoncé à trois heures contient
  une erreur de fixture : les ticks30000/42000/0 donnent tous minuit, car un jour
  vaut6000ticks. Son écart maximal de0,296niveau/255 ne vaut que pour la nuit.
  Le complément de jour aux vrais ticks3000/4200 dépasse le seuil linéaire
  fixé (0,002654 contre1/1024), bien que l'écart écran observé reste à0,305niveau.
  Le verdict est NO GO selon ces critères ; cette piste reste privée et
  désactivée. Aucun gain de performance n'en est déduit.
- La composition du sang : le pigment dynamique peut recolorer le trait
  précuit, contrairement au rendu source. Le candidat conserve maintenant
  matériau et rubans source pour toute espèce dont un animal affiche du sang.
  La texture et la géométrie optimisées restent conservées ; après guérison,
  leur réactivation est immédiate. Cinq contrats ciblés passent, avec snapshots
  complets ; la voie de transport phase résident n'est pas qualifiée par eux.
  Ce repli protège la qualité mais conserve provisoirement le coût source des
  espèces concernées. Les anciennes mesures d'animaux mixtes ne le couvrent pas.
- Le cycle de vie du vrai Core est observé sur les lièvres, puis sur les
  chênes/peupliers et le renard en pause. Le correctif de quarantaine après
  publication est qualifié par les deux contrats ciblés ; typage complet, Pages
  standard et identité des deux Workers finaux sont acquis.
  V32 ajoute l'activation effective435 et du champ lumineux partagé dans son
  sous-ensemble de contexte. Aucun Whole du Main ni parité de campagne n'est acquis.

La garde Native utilise désormais **4,5Gio libres sur C**, sur demande humaine,
avec les réserves mémoire4+1Gio et2Gio par volume conservées. Une garde fraîche
reste requise avant tout contrôle lourd. Seize anciens fichiers `.tmp.js` fermés
ont reçu une compression NTFS transparente bornée : six du16–19octobre, puis
dix du22–29octobre, sans parcours récursif. Chemins, longueurs, SHA et dates
conservés ;31580160 puis43921408octets libérés, aucun fichier supprimé ou déplacé.
Les deux reçus sont conservés dans le checkpoint privé. Aucun nouvel inventaire global,
nettoyage de session/DB, déplacement de RAW/archives/builds/jonctions ou reprise
de la vraie325 n'est autorisé par ces résultats. Les contrôles Workers antérieurs
restent des preuves distinctes. Le contrôle final est la comparaison directe de
taille/SHA256 des deux fichiers standards, documentée ci-dessus ; il n'est pas
déduit des bancs V29/V31 ni de leurs bundles de diagnostic au format ES.
