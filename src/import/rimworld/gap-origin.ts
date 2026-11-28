import type {DefTally,Family} from './notes.ts';

/** Distinguish an absent model from an unfinished translation. A missing
 * source receipt is a third case, not an excuse to invent a record; an
 * ambiguous report is deliberately not silently classified as a model gap. */
export type GapOrigin='model'|'importer'|'both'|'source'|'unresolved';
export const GAP_ORIGIN_LABEL:Readonly<Record<GapOrigin,string>>={model:'Modèle ElseWhere',importer:'Importeur',both:'Les deux',source:'Donnée source insuffisante',unresolved:'À expertiser'};
const normalized=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function gapOrigin(family:Family,row:DefTally):GapOrigin|undefined {
 if(row.status==='exact')return undefined;
 if(row.origin)return row.origin;
 const reason=normalized(row.note??''),def=normalized(row.def);
 if(family==='plants'&&['smashedstump','choppedstump','burnedtree'].includes(def)&&reason.includes('cadence de deterioration'))return 'model';
 if(family==='health'&&(def==='ambrosiatolerance'||def==='ambrosiahigh')&&reason.includes('politique de prise non raccordees'))return 'model';
 if(family==='weapons'&&def==='thrumbohorn'&&reason.includes('cornes individuelles'))return 'model';
 // Unknown definition names are not evidence that a mechanic is missing.
 if(row.status==='unknown')return 'unresolved';
 if(/(?:source|sauvegarde core).*(?:introuvable|incomplet|non enregistre|non serialise)|(?:provenance|cause|reference|recu|identifiant|cible|personne referencee).*(?:introuvable|non enregistre|non resolu)|(?:date|fabrication|recu|phase|identite|provenance).*(?:non sauvegarde|absente de la sauvegarde|non conserve par core|non enregistre)|aucune cause.*invente|aucun.*proprietaire.*identifi|sans carte d.origine reelle identifiee|cause deduite des lesions|recu complet.*nettoyage/.test(reason))return 'source';
 if(/aleatoire|tirages|chemin core|route.*recom|route.*reprendre|parcours.*core|phase.*recalcul|generation future.*adapt|etat.*reinitialis|recalcule.*carte|orientation adaptee/.test(reason))return 'both';
 if(/(?:modele|catalogue|elsewhere|regles actuelles|simulation actuelle|schema|proprietaire actuel).*(?:absent|incompatible|non admis|ne peut|ne sait|pas encore|non represent|ne superpose|ne memorise|stocke.*pas)|(?:absent|non represent|indisponible|incompatible|non admis|limite|capacite).*(?:modele|catalogue|elsewhere|regles actuelles|simulation actuelle|schema|anatomique actuelle)|(?:drogue|implant|espece|meuble|tourelle|materiau|porte|type|prothese|recette|objet|batiment|vegetal|plante|besoin|trait|mecanique).*absen|:\s*absent[e]?s?\.?$|ne sont pas represent|non representable|sans proprietaire equivalent|decor non recree|devient (?:du|de la|des|un|une|en)|arrondi|tronqu|limite du modele|gramme|precision|ne peut pas porter|sans recherche dans|acquise d.office|watts sont entiers|pas de definition elsewhere|sans regle correspondante|non sauvegardee.*modele/.test(reason))return 'model';
 if(family==='backstories'||/^(?:relation|souvenir|besoin|coiffure|cheveux|barbe|titre personnalise)/.test(def)&&/incompat|absen|non represen/.test(reason))return 'model';
 if(/dossier anatomique natif indisponible|usage du lit repris|selection detaillee.*indisponible|culture absente|arme absente|seul .*elsewhere|sans equivalent direct|postmortem|posterieures.*dossier clinique|fragment superieur|capacite disponible|quantite.*quota core|tete de la tournee|personne referencee non importee|facteur non represente|definitions (?:sans equivalent|absentes)|famille .*absente|ne porte pas les titres|origine du pigment non representee|material pile limit exceeded|dossier ne respecte pas les invariants|material.*substitution|mat.eriau de substitution|recherche necessaire|facture suspendue|lit medical represente|reservoir non represente|case de stockage exacte n.accepte/.test(reason))return 'model';
 if(/cases de depot compatibles reservees|suite opportuniste.*recalcul|facture originale de test conserv.ee/.test(reason))return 'both';
 if(/facture originale de test conservee|pause de promenade|progression et ingredients deja deposes|etabli\/facture exacts absents|quantite ou possession.*non conforme/.test(reason))return 'both';
 if(/texte du dialogue conserve|style de barbe absent|:\s*absent[e]?s?[.\s(]|devient le beton ancien|emprise impossible a reproduire|sans proprietaire geothermique reel|matiere de casque non representee|condition anatomique sans partie|duree bornee ou vitesse sans equivalent|infection globale|materiau de substitution|zone ne permet pas ce travail/.test(reason))return 'model';
 if(def==='archive sans identifiant')return 'source';
 if(/pas encore import|non encore import|pas encore compose|importeur|conversion.*incomplet|non traduit/.test(reason))return 'importer';
 if(family==='health'&&def==='scratch'&&row.to==='cut')return 'model';
 if(family==='world'&&def.endsWith(': scratch'))return 'model';
 return 'unresolved';
}
