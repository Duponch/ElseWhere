# Picto de chasse sur l'animal

Une cible de `world.hunting.targets` affiche le picto de cible existant au-dessus de sa tête. La chasse et l'abattage partagent désormais le batch de marqueurs déjà présent par espèce : le champ résident historique code absence, abattage ou chasse. Un seul atlas de deux pictos et une seule lecture de couleur remplacent l'image isolée d'abattage ; aucune géométrie ni appel de dessin par animal n'est créé.

L'ancrage est préparé dans le modèle, puis évalué sur le GPU avec les trajectoires, la taille et les horloges du corps réellement affiché. Il reprend les rotations de tête, le balancement du corps, la pose couchée et le déplacement vertical de marche. Le chemin éloigné lit les cellules d'animation déjà calculées pour le corps. Le marqueur ne revient pas à la case de simulation pendant une interpolation.

Les seuils de zoom, l'échelle à l'écran et la portée perspective sont ceux du marqueur d'abattage et des autres désignations. Une cible de chasse inconnue, domestiquée, morte ou retirée n'affiche pas de chasse. Une annulation reçue retire le picto ; une mort adoptée dans une phase physique le retire sans attendre la publication complète suivante. Les quotas et ordres manuels d'abattage gardent leur priorité et leurs flags historiques.

Les tests ciblent une vraie désignation de chasse, une annulation, une mort par adoption de phase, le mélange chasse/abattage dans un batch, le dépassement de capacité initiale, le retrait et l'apprivoisement du propriétaire, l'absence d'uploads répétés et les seuils de zoom. Une compilation WGSL froide du vrai marqueur vérifie les limites d'attributs/buffers et une seule texture lue par le fragment. Ces contrats ne sont pas une mesure de performances GPU ni une vérification de pixels dans le navigateur.

Les désignations d'apprivoisement ont été examinées : elles n'ont pas de marqueur dans le chemin existant. Cette tranche reste limitée à la chasse demandée et au marqueur d'abattage partagé ; les soins et le dressage sont des tâches distinctes.
