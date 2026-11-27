# Insectes de nuit : adoucissement local provisoire

Le 27 novembre 2026, Saf demande un fond nocturne beaucoup moins strident. **Deux nouvelles prises ElevenLabs ont bien été générées (boucles de 16 s, V2).** Elles sont disponibles dans [le flow ElevenLabs](https://elevenlabs.io/app/flows/nVR1zK22S1RbrTBAmTDv), identifiants `lQQYL8jZ19wrBYkiK8jU` et `UJetOm1jkzjiOBmHuqdh`. Coût retourné 106,67 crédits (estimation préalable 320). Leurs fichiers ne sont pas disponibles localement après l'échec du transport HTTP et le refus de l'autorisation d'accès navigateur. Elles ne sont ni inscrites au manifeste ni annoncées comme jouées ; **ne pas relancer une génération**. Aucun autre accès n'est à tenter en contournant ce refus.

Lorsqu'elles seront transmises par Saf, importer les deux MP3 comme `ambient-night-insects-g1127-take-1.mp3` et `ambient-night-insects-g1127-take-2.mp3`, enregistrer leur provenance et calibrer puis contrôler les boucles à l'écoute avant leur activation. Le prompt des prises impose des trilles nocturnes graves/médiums éloignés, feutrés et irréguliers, des pauses et aucune note aiguë perçante. L'import ne doit pas faire disparaître les prises historiques tant que les nouvelles ne sont pas vérifiées. Voir aussi [le bilan du lot](retours-20261127.md).

Faute d'outillage local de décodage et d'encodage opérationnel dans les chemins consultés, le repli utilise les deux MP3 historiques `ambient-night-insects-g1122-take-{1,2}.mp3`, inchangés. Leurs empreintes restent celles du registre de génération. Seule l'entrée concernée du plan est revenue à sa prise g1122, son prompt, sa durée de dix secondes et son influence historiques ; sa famille de calibration devient `ambience-soft`.

| Prise historique | RMS historique du MP3 | Gain du manifeste | RMS de référence après gain, avant filtre |
| --- | ---: | ---: | ---: |
| 1 | −23,00 dBFS | 0,056234 | −48,00 dBFS |
| 2 | −15,73 dBFS | 0,024351 | −48,00 dBFS |

Ces mesures PCM viennent du bilan historique, elles n'ont pas été refaites ici. `AudioDirector` applique ensuite un passe-bas Web Audio à 1 500 Hz aux deux seuls chemins g1122 historiques. Le paramètre Q vaut **−6 dB**, soit un Q linéaire d'environ 0,5, pour éviter une bosse résonante à la coupure. Les futurs fichiers g1127 ne correspondent pas à cette condition.

Le filtre est créé une seule fois avec la voix continue et conserve son état lorsque le tampon reboucle. Il n'ajoute ni fondu aux extrémités, ni découpe, ni réencodage, ni copie du PCM ; il est déconnecté avec la voix. Le cache décodé reste limité à 32 Mio. Le registre `processing-log.json` décrit cette opération dans `runtimeTreatments`, distinct des dérivées MP3. Les lignes concernées du bilan PCM précisent que leur niveau de référence est mesuré avant ce filtre.

La sortie filtrée n'a pas été mesurée ni écoutée dans cette session. Aucun gain de performances n'est revendiqué. Les contrats vérifient le câblage unique du filtre, sa conservation pendant les mises à jour, sa libération, l'absence de croissance du cache et l'identité des fichiers historiques ; les prises nouvelles restent à importer puis à écouter.
