# Rendu commun et textures Pastel/Gouache

État du 5 novembre, lot groupé V67 : **qualité conservée, parité non atteinte**.
Herbe, ressources et surfaces rigides partagent un masque d'encre conservateur
dans l'alpha inutilisé de leur couleur préparée. Chaque mip est calculé depuis
les RGB de l'encre déjà stockés, sans utiliser son alpha. Le programme peut
omettre la seconde lecture quand son empreinte de filtrage ne contient aucune
encre. Les couleurs, les modèles, les matériaux et les quatre mips sont conservés.
La préparation réutilise ses cibles existantes ; aucun travail CPU par image ni
nouvelle texture persistante n'est ajouté. Pastel et le repli complet restent
inchangés. Les gradients des deux lectures Gouache sont identiques.

Les23contrats distincts sont acquis par une reprise ciblée, les types produit
finaux passent en54,000s, ceux du harnais en20,020s, Native en6,265s et Pages en
4,068s. La sortie Pages conserve575artifacts ; ses fichiers publics ont été
rétablis après une erreur de commande de nettoyage de sortie, sans recompiler
ni modifier ses dix fichiers compilés. Les quatre Workers restent exacts.

V67 utilise cette fois1120×760pixels physiques, DPR1 : les anciens chiffres à
DPR1,2 sont des acquisitions différentes. Même WorkerWorld128/Main435 en pause,
contours activés, relief/usure0 : GPU P/G/P0,738816/0,808960/0,759296ms, Gouache
+7,997 % face aux deux témoins, dérive Pastel+2,772 %. CPU de soumission
0,867264/0,850778/0,754371ms, avec dérive Pastel−13,017 % : aucun gain CPU n'est
revendiqué. Les384frames/1152UID, les pics et les21appels/214196triangles restent
conservés ; propriétaires et préparation435 stables dans les six fenêtres.

Le témoin V66 gelé, repris au même DPR1, donne GPU0,727040/0,818176/0,756736ms.
La différence normalisée entre ces deux acquisitions est−2,073 %GPU et+1,587 %CPU,
avec des médianes GPU identiques par texture. Cette comparaison chronologique ne
prouve pas de gain causal. Aucune parité, campagne, WholeMain ou FPS global acquis.

Quarante paires GPU, dix pages sur trois banques, conservent exactement chaque
RGB et le masque attendu aux quatre mips :120lectures/80copies de contrôle,
16Mio maximum de lecture et4Mio de masque, aucun buffer de contrôle conservé.
Le témoin est désinscrit et tous les renderers/clients de contrôle sont libérés.
Les quatre comparaisons visuelles au même DPR1 sont strictement identiques :
Pastel, Gouache, cadrage intermédiaire et retour Gouache,0pixel RGBA différent.
Les anciens PNG à DPR1,2 ne sont ni redimensionnés ni utilisés comme témoins égaux.

La galerie standard conserve714assets,39groupes et2sansmodèle. Les passages
Gouache1/.75,0/0,Pastel puis Gouache sont prêts ; la table longue a été observée
avec les contours activés. Aucun message d'erreur,26avertissements Three conservés.
L'onglet de contrôle est fermé ; la galerie n'expose pas de reçu public de libération.

Le prochain lot reste privé : préparer une couleur finale pour une teinte commune,
en conservant le B/I initial pour les couleurs variables. Sa sélection doit utiliser
les données déjà transmises au GPU, sans nouvelle variante cartésienne, tampon de
modèle ou décision CPU par image. Résolution, budgets et qualité restent à qualifier.

Le manque d'espace a été résolu avec `uv cache prune`, hors ligne et sans forcer
les verrous : l'outil a supprimé11,3Gio d'entrées inutilisées, sans suppression de
conversation, base, projet ou sauvegarde. Le gain physique global observé sur C:
est inférieur à l'estimation de l'outil ; C: affichait14,6Go libres à sa clôture.
Les gardes disque et mémoire n'ont pas été abaissées.

État du 5 novembre, lot UV/masques V66 : **images conservées, surcoût encore ouvert**.
Les coordonnées et couches des ressources sont résolues lors de la publication,
dans les huit buffers existants. Leur rendu final n'a plus de table de recherche
GPU. Les mêmes attributs sont transmis aux pages435 et restaurés avant Pastel,
un gros plan ou le rendu complet. Un nouvel ensemble de maillages peut réutiliser
sa texture tout en recevant ses propres coordonnées, sans refaire la peinture.
Le premier Pastel n'alloue aucun miroir de coordonnées ; les 136512 sommets des
seize géométries Resource retiennent ensuite1638144octets d'originaux CPU.
Les six fenêtres de mesure gardent leurs propriétaires et états de préparation
stables ; aucune préparation n'est ajoutée au rendu stable.

Le masque du rendu complet des arbres utilise désormais leur vraie projection
plane, déjà présente dans les coordonnées d'atlas. Les UV d'origine d'un tronc
conique décrivent un rectangle et ne peuvent pas représenter son trapèze avec
une seule transformation affine : le premier contrôle a correctement refusé ce
calcul. Papier et pigment conservent leurs coordonnées ; le remplissage suit les
vrais polygones, y compris pour les sondes de relief. Les treize espèces et leurs
deux variantes passent le contrat géométrique indépendant. La texture de masque
est déclarée et empruntée ; son lecteur particulier conserve le repli natif435.

V66, même WorkerWorld128/Main435/caméra/DPR1,2, contours activés et effets0 :
GPU P/G/P0,905728/0,963072/0,891904ms, soit+7,149 %Gouache et dérive Pastel−1,526 %.
CPU soumission0,783000/0,799915/0,799750ms, soit+1,079 % et dérive+2,139 %.
Les384frames/1152passes fraîches, leurs maxima et les21appels/214196triangles
sont conservés. Les mêmes modèles et matériaux subsistent dans tous les bras.
Ce sont les deux textures actuelles sur un Core en pause : aucune parité avec
l'ancien Pastel, mesure de campagne, WholeMain ou FPS global n'est revendiquée.
Le renderer, son instrumentation et son client sont libérés sans erreur.

Les images V65→V66 Pastel et Gouache sont strictement identiques, ainsi que le
retour Gouache après le gros plan. Le rendu complet corrigé reste différent du
préparé au niveau pixel ; ses feuillages sont verts et le gros plan a été observé.
Cela ne qualifie pas tous les angles, palettes ou familles absentes de la carte.
Les43contrats distincts sont acquis par reprises bornées ; types produit54,567s,
types du harnais19,942s, build Native6,362s et Pages4,319s passent. Quatre Workers
restent exacts octet par octet. La galerie finale affiche714assets/39groupes/2sans
modèle ; relief/usure1/0,75 puis0/0 et le retour Pastel/Gouache sont prêts. La table
longue peinte et ses contours ont été observés. Les26avertissements Three sont
conservés, sans erreur observée ; l'onglet36 est fermé. Aucun reçu public de
libération du renderer de galerie n'est revendiqué.

Le lot suivant reste privé : employer l'alpha inutilisé des textures B/I comme
preuve de l'absence d'encre, pour éviter sa seconde lecture à l'intérieur des
surfaces. Les gradients doivent être identiques pour les deux lectures et chaque
mip doit conserver ses RGB. Une comparaison des octets durant la préparation et
une qualification globale sont requises avant toute promotion.

État du 5 novembre, lot rigides/ressources V65 : **rendu préparé réellement admis,
parité encore ouverte**. Box/Item, Door, Crop et Timber partagent le propriétaire
transactionnel de surfaces ; les ressources réunissent arbres et autres surfaces
dans une seule banque et un même programme à huit buffers. Les mêmes géométries,
matériaux, éclairage, poses et règles de visibilité sont conservés dès le premier
Pastel. Le calcul du budget distingue les phases réelles de préparation, séparées
par une attente effective des travaux GPU avant allocation de la banque finale.
Les plafonds, la résolution et les quatre niveaux de mipmaps restent inchangés.

V65 admet 348 variantes Resource sur six pages génériques et quatorze couches
finales, ainsi que 32 variantes Box/Item sur trois pages. Door/Crop/Timber n'ont
aucune demande dans cette carte : leurs contrats CPU ne constituent pas une
qualification visuelle en colonie. Les 68 contrats distincts du lot, acquis par
reprises bornées, et le typage produit final de 56,198 s passent. Les échecs
initiaux et les replis Source V63 restent conservés séparément.

Même WorkerWorld128, vrai contexte Main435, DPR1,2, contours activés,
relief/usure0 : GPU P/G/P0,874496/0,986624/0,890880 ms, soit Gouache+11,775 %
face aux deux témoins Pastel ; dérive Pastel+1,874 %. CPU soumission
0,830911/0,805734/0,791820 ms, soit−0,694 %, avec dérive Pastel−4,705 %.
Ces chiffres sont descriptifs ; ils ne prouvent ni parité avec l'ancien Legacy,
ni gain CPU global, ni FPS de campagne. Les 384 échantillons GPU et leurs pics
adverses sont conservés. Les appels et triangles sont identiques entre textures.
Le renderer et son client ont été libérés publiquement sans erreur.

Au cadrage joueur, V65 conserve l'apparence générale du témoin Gouache V57 :
0,863 % de pixels différents et alpha identique. Aucun défaut géométrique grossier
n'a été observé dans ce cadrage. Le repli Source présente déjà des triangles kraft
absents du rendu préparé et ne constitue donc pas seul une référence de qualité.
Les détails proches et toutes les familles inactives ne sont pas qualifiés par
cette comparaison. Pages passe en 4,121 s ; ses quatre comparaisons de Workers,
Native et standard chacun face à son témoin, restent exactes octet par octet.
La galerie V65 affiche 714 assets, 39 groupes et deux définitions sans modèle.
Relief/usure1/0,75 puis0/0 et Pastel/Gouache ont été observés, avec la table longue
peinte et ses contours. L'onglet34 est fermé ; les avertissements de conversion
non indexée et de dépréciation Three sont conservés, sans erreur observée.
Aucun reçu public de libération du renderer de galerie n'est revendiqué.
La prochaine optimisation groupée prépare les adresses des ressources dans leurs
buffers existants afin de supprimer leurs recherches GPU, sans modifier la peinture.
Elle corrige aussi l'ancien masque du repli complet des arbres, dont l'exposition
plus fréquente rend les triangles kraft visibles à certains niveaux de zoom.

État du 5 novembre 2026 : **macrolot acteurs/contours qualifié dans le vrai Core,
parité encore ouverte**. Les mêmes modèles, matériaux, poses et règles de visibilité
restent en place dans les deux textures. Les traits utilisent des coefficients
préparés hors image ; les acteurs admissibles utilisent une texture de couleur
préparée, avec les fabriques Source de peinture et de traits. Les états cliniques,
formes non affines, effets positifs ou budgets non admis gardent leur représentation
Source complète sur le même matériau. Aucun graphe Source coûteux n'est caché dans
le fragment rapide. Le Pastel natif est conservé en64² pour les humains et256² pour
les manteaux animaux, sans rééchantillonnage.

V57 a admis les trois humains et treize animaux réels (douze gazelles et un renard),
avec zéro préparation répétée pendant les fenêtres CPU. La préparation globale
retient le dessin avant les premiers rendus et ombres ; tous les propriétaires
stagent avant publication, compilation et transfert de durée de vie. Le registry
sert aussi la galerie, sans créer de World de simulation. La densité physique
est capturée avant l'admission ; une décision globale O(1) traite ensuite les vraies
transitions de zoom. Le cache ne dépend pas du tick, d'un UUID de World ou de la pose.

Même WorkerWorld128, Main435, caméra, DPR1.2000000476837158, contours activés et
relief/usure0 : CPU P/G/P0.885287/0.890805/0.892882ms, soit Gouache+0.193% face à
la moyenne Pastel ; GPU0.885760/0.996352/0.900608ms, soit+11.551%, dérive Pastel
+1.676%. Les384frames GPU et1152passes sont fraîches et leurs sommes exactes ;
le pic adverse Gouache2.293760ms est conservé. Les25appels et214196triangles sont
identiques dans tous les bras. Ces temps concernent la soumission CPU et le vrai
GPU de ce sous-ensemble en pause, pas les FPS ou une campagne active/WholeMain.

La référence356 a été mesurée de nouveau séparément, avec le même World/cadrage,
128callbacks et trois passes : CPU0.717356ms, GPU0.832512ms. Le coût commun ajouté
au Pastel courant reste donc visible, et Gouache reste environ19.68% plus coûteux
côté GPU face à cette référence. C'est une comparaison chronologique indépendante,
pas une attribution causale à une technique. **L'objectif de parité n'est pas acquis.**
Deux familles Resource de quatre quadrants expliquent les quatre appels ajoutés ;
leurs programmes doivent être réunis, leurs UUID seuls ne suffisent pas.

La paire réelle Source/préparé au cadrage joueur change1758/1225728pixels ; retours
Gouache et Pastel exacts. Root a observé les images côte à côte sans défaut grossier
apparent. Les personnages sont petits dans ce cadrage : cela ne qualifie pas tous
les détails proches, palettes, états cliniques ou angles. Les identités de modèles,
matériaux et caméra sont vérifiées strictement avant les événements de diagnostic.
Le renderer V57, son observateur et son client ont été libérés sans erreur.

Les contrôles ciblés sont acquis par reprises bornées, avec les échecs initiaux
conservés. Les types finaux et les builds passent ; quatre Workers des builds
Native et Pages restent byte-exacts. Le premier démarrage Native de la galerie a
refusé sa publication parce que la première compilation initialise légitimement
la projection WebGPU. La correction initialise ce même champ public avant la
capture de la garde stricte ; deux contrats couvrent cette conversion et refusent
toujours un vrai changement de caméra après staging. Native V59 a ensuite observé
714 assets, 39 groupes et deux définitions sans modèle au démarrage Gouache,
puis relief/usure0 et Pastel/Gouache, sans erreur. La table longue a été observée
avec peinture et contours ; son image et le reçu sont conservés. L'onglet a été
fermé ; aucun reçu public de libération du renderer de galerie n'est revendiqué.
Les neuf contrats galerie, les types finaux56.277s et Pages4.940s passent.
Les programmes Native V59 sont byte-exacts à V57 : cette correction propre à la
galerie ne justifie pas de rejouer le benchmark Core déjà acquis. Le total du lot
est de69 cas distincts par reprises bornées. Les paragraphes suivants gardent les
preuves et limites historiques des lots précédents.


État du 4 novembre 2026 : **rendu commun fonctionnel, qualification finale ouverte**.
La base des modèles est committée en `356a1d9a`. Le présent lot raccorde les surfaces,
le jeu et la galerie. Les contrats ciblés, le typage complet et Pages passent.
Native V45 a observé le même Core pendant les changements
Pastel/Gouache/Pastel, avec contours activés, relief/usure à zéro, puis sa fermeture.
La galerie a affiché 714 assets et conservé ce nombre pendant son aller-retour.
La correction de coordonnées multibanques passe cinq contrats distincts, dont
de vrais programmes humains et ressources avec deux banques, relief nul et
positif. Le typage final passe en 59,059 s et Pages en 5,193 s ; les deux Workers
restent identiques octet par octet. Native V46 a observé la galerie corrigée,
un humain corpulent, le passage relief/usure à zéro et Gouache/Pastel/Gouache
sur 714 assets, sans erreur. La fermeture de son onglet est observée ; aucun
reçu public de libération du renderer de galerie n'est revendiqué. Ces contrôles
ne constituent pas une qualification pixel exhaustive de toutes les palettes.

V45 dessine 25 appels et 214196 triangles dans les deux textures. Le GPU Gouache
reste à +23,23 % face à la moyenne des deux Pastel courants ; leur dérive est de
+15,28 %, avec le pic adverse conservé. CPU : +0,87 % sur 836 échantillons par bras.
Le témoin Pastel antérieur V38, mesuré de nouveau à cadence comparable, donne
encore +38,41 % GPU / +40,23 % CPU pour Gouache V45. Les quatre appels ajoutés
proviennent de deux familles de matériaux de ressources qui restent à réunir.
Les refus V43, les mesures V44 à faible cadence et tous leurs reçus restent
conservés séparément. **La parité avec l'ancien Pastel n'est pas atteinte.**
Il ne s'agit ni de FPS globaux, ni d'une campagne active ou de Whole Main.

Le lot suivant V47 réunit les matériaux et layouts de ressources : quatre pages,
21 appels, 214196 triangles dans les deux textures, sans changer les règles435.
Un filtre conservateur évite aussi des recherches de traits dans des intérieurs
prouvés vides. Les sept contrats distincts passent ; types56,074s/Pages5,509s,
Workers identiques et fermeture Native complète sont acquis. Le PNG du gros plan
colon/rochers est identique à V45 sur ses 851200 pixels. Cela reste un seul cadrage.

V47 L/C/L : GPU0,791893/1,010347/0,791893ms ; CPU0,880144/0,939785/0,929426ms
sur836/837/836 échantillons. Gouache reste à +27,59%GPU/+3,87%CPU face au Pastel
courant ; dérives0%GPU/+5,60%CPU conservées. La comparaison externe avec l'ancien
Pastel mesuré une heure auparavant est descriptive, pas une attribution causale.
Le regroupement et le filtre constituent un lot combiné : aucun gain individuel
n'est attribué à l'un des deux. Une borne dépendant des réglages réels et des
groupes de paramètres versionnés restent des candidats privés non qualifiés.

## Un seul propriétaire des modèles et du rendu

Humains, 53 animaux, plantes, herbes et buissons gardent les modèles Origami
communs ; arbres, fragments, objets et mobilier gardent les modèles Legacy
communs. Les poses, variations, attachements, blessures, croissance, indices et
règles de visibilité appartiennent au modèle. Aucune de ces identités ne dépend
du style de texture.

Les mêmes matériaux et le même moteur de rendu sont conservés au changement
Pastel/Gouache. Un uniforme choisit les données d'habillage. Les valeurs
persistées `default`/`origami` restent des alias de compatibilité des préférences ;
elles ne choisissent plus deux fabriques de modèles ou deux renderers.

`Main` attend la préparation exclusive sur son renderer existant. Les nouveaux
états confirmés continuent d'être admis pendant cette attente ; le dernier état
complet et son éventuel reset sont présentés ensuite. Une erreur prépare de
nouveau l'habillage précédent sur les mêmes propriétaires. La galerie suit la
même règle et conserve collections, sélection, caméra, agencement et modèles.

## Peinture et traits sur les surfaces opaques

Le pigment Source reste à sa résolution 512². Le papier RGB conserve le masque
de remplissage dans son alpha : les imperfections suivent les UV de la vraie
face, tandis que le pigment adapte ses proportions physiques à la surface.
La composition conserve le mélange Source en sRGB encodé. Sur les formes aux
proportions variables, ce chemin utilise deux lectures de couleur, au lieu de
réduire arbitrairement la résolution ou d'étirer un atlas canonique.

Les traits noirs et carton utilisent les positions, largeurs, irrégularités,
graines et ordre des bandes du producteur Source. Une table de modèle permet
de les intégrer à la surface opaque ; les anciennes bandes transparentes ne
sont plus dessinées séparément. Le masque et les couleurs cliniques s'appliquent
au corps avant l'encre. Seules les vraies coutures nécessaires à la face sont
ajoutées aux sommets, avec indexation des faces coplanaires compatibles.

Le relief positif possède une carte de hauteur R8 séparée. À zéro, ni carte,
ni graphe de relief, ni propriétaire/décision LOD ne sont créés. L'usure physique
positive reste un effet optionnel existant ; à zéro, ses géométries, matériaux,
cartes et caches dédiés sont retirés. Les effets absents d'un producteur Source
n'ont pas été inventés. Les anciennes préférences positives ne sont pas
silencieusement converties en zéro.

## Herbes

Les touffes utilisent désormais une texture préparée en deux termes : la
peinture atténuée par l'encre et l'encre séparée. Cela conserve la teinte propre
à chaque plante sans teinter aussi le trait. Le matériau final ne contient plus
le calcul de peinture ou la recherche de traits : une lecture en Pastel, deux
en Gouache, sur une seule texture à couches et un seul sampler. Les formes,
positions, croissance et mouvement au vent restent communs. Seize classes de
proportions conservent les coups de pinceau, avec une erreur métrique maximale
au repos de 1,903 %. Le placement de texture suit le modèle au repos sous le vent.

La préparation possède un budget explicite de 416 Mio incluant les ressources
temporaires et les anciennes et nouvelles textures. Le modèle actuel utilise
42,5 Mio de texture conservée. Un refus de réservation ou des effets de relief
ou d'usure positifs conserve le rendu Source complet. Les erreurs GPU restent
des erreurs ; elles ne déclenchent pas une boucle de nouvelles tentatives.

Native V54 a observé 3478 touffes sur la même carte et le même Core pendant
Pastel/Gouache/Pastel, puis leur fermeture. La paire Source/Gouache préparée à
distance de jeu conserve World, caméra, modèles, placements et matériaux
attendus. Les images restent proches à l'œil ; elles ne sont pas identiques
(9547 pixels différents sur 851200, MAE RGB 0,14258/255). Les horloges décoratives
restent actives : ces différences ne sont pas toutes attribuées aux touffes.
Le premier gros plan préparé ne possédait pas toutes les métadonnées du témoin ;
il ne constitue donc pas une comparaison strictement identifiée.

V54 GPU L/C/L : 0,731819/1,075883/0,770048 ms, pic Gouache 2,62144 ms inclus.
L'écart moyen Gouache reste +43,27 %, avec une dérive Pastel de +5,22 % ;
les médianes donnent +26,09 %. CPU : 0,898946/0,954089/0,913583 ms,
soit +5,28 % avec une dérive de +1,63 %. Chaque bras GPU conserve ses douze
échantillons, 21 appels et 214196 triangles. Aucun gain causal face à un ancien
essai, aucune parité, campagne active ou mesure globale de FPS n'est acquis.
Les prochains essais utiliseront un échantillon GPU plus long pour réduire
l'influence d'un unique pic, sans retirer les observations adverses.

## Arbres, ressources et rochers

`TreeModels` possède les treize essences Legacy et les deux vraies variantes de
couronnes, ainsi que les placements anonymes continus. UV Pastel et adresses
préparées existent avant le premier dessin. Le cache de peinture emprunte ces
modèles ; publier une banque change seulement texture et table d'adresses.

Les arbres nommés aux proportions fixes peuvent utiliser leur peinture cuite
avec une seule lecture. Les anonymes continus utilisent la peinture de face
adaptée à leurs proportions. Une banque absente, incomplète ou refusée laisse
la vraie surface Gouache directe ; aucun arbre Gouache ne redevient Pastel pour
attendre son image. Les effets positifs utilisent également la surface commune.

Le lot V55 donne aux arbres fixes un matériau final séparé, sans branche de
peinture directe dans son programme. Ce même matériau existe dès le premier
dessin Pastel. Un coordinateur conserve le dernier World et son éventuel reset
pendant l'admission d'une nouvelle cohorte ; il prépare ses images avant de
publier ces modèles. Les changements de texture conservent la banque prête.
Les erreurs GPU restent des erreurs et les propriétaires en échec de rollback
restent en quarantaine. Les producteurs et la galerie suivent cette discipline.
La projection de cohorte peut encore parcourir les ressources à l'adoption d'un
World sans journal compatible ; aucun recensement n'est ajouté au rendu stable.

V55 observe 473 arbres prêts, deux espèces, zéro repli, sur la même carte et le
même Core. Les 29 contrats intégrés passent par reprises ciblées ; les cinq
contrats de composants, trois contrats de sampler générique, types complets,
Pages et quatre comparaisons de Workers passent aussi. Le seul échec de fixture
attendait deux matériaux lorsque les textures sont coupées : les deux familles
partagent alors correctement le même matériau uni.

La séparation représente huit pages435 et 25 appels, contre quatre pages et
21 appels précédemment ; les 214196 triangles restent identiques. Sur trois
bras de 128 échantillons GPU, V55 donne 0,894976/1,125376/0,895488 ms : Gouache
reste à +25,71 %, dérive Pastel +0,057 %. Tous les pics sont conservés.
CPU : 1,216505/1,178351/1,209000 ms, soit -2,84 % local, avec des cadences
différentes entre le premier bras et les suivants. La fermeture du renderer et
du client est attestée. Ce résultat ne prouve aucun gain de FPS ou de campagne.

Le DPR V55 vaut 1,2 : ses images 1344×912 contiennent 44 % de pixels de plus
que V54 à DPR1. Les temps absolus des deux versions ne sont donc pas comparés
pour attribuer un gain à ce lot. Les formes et l'aspect restent cohérents sur
les gros plans examinés ; aucune identité pixel historique n'est revendiquée.
La paire Source/B-I de V55 conserve, elle, toutes les identités et le même DPR.
La parité de performances avec Pastel demeure ouverte.

Les surfaces implicitement génériques utilisent désormais seulement la banque
de pigment0, dont le slot0 est réservé au profil générique. Les profils explicites dynamiques
conservent leur domaine complet de huit banques. Cela retire des bindings et
des branches inutiles sans changer les pixels Source512, leur composition ou
leur stockage ; aucun gain individuel n'est attribué à cette spécialisation.

Le Pastel garde sa carte neutre Source64, ses pixels, filtres et espace couleur.
Il n'est pas converti en gros atlas2048. Les ressources transportent UV de face,
UV de trait/cache et identités exactes dans huit buffers au maximum, vent inclus.
Les tables d'adresses versionnées ne sont pas repackées à chaque frame.

Les rochers continus gardent leurs triangles, pigment, socle et mises à jour
locales d'excavation. Les coutures de face et tables de traits sont indépendantes
du style. Les pages de stockage retiennent une capacité maximale réutilisable
entre tailles de cartes ; elles ne sont pas recréées à chaque aller-retour.

## Lot groupé V56

Le lot suivant réunit rochers, humains, animaux, objets et mobilier. Les
rochers utilisent un stockage propriétaire unique lorsque leur borne tient
sous128Mio, sinon les huit pages Source ; les écritures, adresses et opérations
de minage restent communes. V56 confirme un buffer réel de8Mio aux douze
frontières :265172 lignes utilisées,524288 de capacité. Les allocations
retirées sont comptées dans les14680336 octets CPU déclarés ; aucune
libération GPU anticipée n'est déduite du seul propriétaire CPU.

Les78 peintures statiques du jeu peuvent maintenant lier uniquement la banque0.
Le plan d'admission vérifie ce domaine avant toute allocation ou publication ;
les palettes humaines dynamiques conservent leurs huit banques. Pigment512,
papier/masque et composition Source sont conservés. Les boîtes rigides et portes
admettent une métrique de peinture vertex exacte ; les formes qui n'en ont pas
la preuve gardent le calcul de surface existant.

Les headers de traits passent au vertex, avec des valeurs constantes par face.
Les humains transportent un seulvec4 : les vraies bornesUV0/.5/1, dont les
demi-faces des pantalons, sont encodées en entier exact puis reconstruites par
opérations binaires. Aucun buffer, propriétaire, modèle, UV ou pixel nouveau
n'est requis. Les27 contrats distincts passent par reprises ciblées : ils
couvrent notamment53 modèles, les78 profils après300 couleurs humaines, et
11328 faces sur16 variantes humaines, dont256 demi-faces, avec leurs huit mots
Float32 reproduits bit pour bit. Le froid avec le vrai champ lumineux conserve
16varyings pour les humains Native/LOD et13 pour les animaux ; les limites
huit buffers et16 attributs/samplers restent contrôlées.

Un premier froid humain sans ce champ ne couvrait pas le produit complet :
le contrôle renforcé a refusé17varyings avant Native. Cet échec est conservé.
Le principe des headers vertex avait déjà été essayé dans V49 sans gain
convaincant ; ce lot le réutilise avec un autre stockage et plusieurs familles,
sans réinstaller l'ancien filtre dynamique ou la déduplication des neuf lignes.
Les types finaux, Pages et les quatre comparaisons de Workers passent. Sur le
même Core/World128, V56 mesure Pastel/Gouache/Pastel : GPU
0,899072/1,110016/0,942592ms, soit+20,54% pour Gouache face à la moyenne des
témoins ; dérive Pastel+4,84%, pic Gouache2,031616ms inclus. CPU :
1,078500/1,393411/1,153917ms, soit+24,83%, dérive+6,99%. Les384échantillons
GPU,1152UID et trois passes par callback sont conservés, à25appels et214196
triangles dans chaque bras. Renderer et client sont fermés sans erreur.
Ces données ne démontrent aucune parité, amélioration historique causale,
attribution individuelle de sous-lot, campagne active ou gain de FPS globaux.

Au même World, caméra, paramètres et DPR1,2, les PNG colon, arbre et vue joueur
Gouache sont byte-exacts avec V55, ainsi que le retour Pastel avec son témoin
initial. L'animal observé est partiellement masqué par un tronc ; le mobilier
cubique est absent de cette carte. La galerie distincte a montré714assets et
une table longue peinte, mais aucune paire Source/optimisé de mobilier dans
ce Core n'est inventée. Les surfaces directes et palettes dynamiques ne sont
pas toutes devenues une unique texture finale ; l'optimisation continue.

## Qualification et limites

Les contrats contrôlent les vrais producteurs, les identités et les programmes
WGSL à froid, avec les limites de 16 attributs, huit buffers et 16 varyings.
Les données synthétiques de peinture des tests de cycle de vie ne qualifient
ni les coups de pinceau, ni les pixels, ni les performances d'une colonie.
Les erreurs et les reprises isolées sont conservées dans le checkpoint.

Les humains et animaux partagent le Standard Source de Gouache (.88/.02) entre
styles ; les ressources partagent Lambert. La comparaison inclut aussi
un ancien Pastel figé, pour ne pas masquer un coût commun ajouté aux deux
habillages. Les différences éventuelles d'éclairage de l'encre et son attache
aux faces sous morphologie/vent demandent une observation proche dans le produit.
V45 a aussi rétabli le corps de pierre Source dans les deux textures : les
rochers recevaient involontairement une nouvelle peinture par facette. Leur
seul changement d'habillage reste le trait. Les PNG proches à World/caméra
identiques et leurs différences sont conservés, sans identité pixel revendiquée.

La durée de vie des stockages GPU et ses limites publiques r186 sont décrites
dans [le contrat de stockage](shared-texture-storage-lifetime.md). Une fermeture
CPU seule ne prouve pas une libération anticipée des buffers d'une page435.

Les prototypes de culling et de peinture lointaine V39/V40/V41 restent privés,
non promus. SIM301, vraie325, sauvegardes et autres chantiers ne sont pas repris.
Aucun push ni publication n'est demandé. Commit local après qualification.
