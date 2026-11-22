/** French Markdown report of an analysis and/or a conversion. */
import {FAMILIES,FAMILY_LABELS,type ImportNotes,type DefTally} from './notes.ts';
import {elsewhereTargetLabel} from './labels-fr.ts';
import type {RwsAnalysis} from './analyze.ts';

const STATUS_LABEL={exact:'repris',adapted:'adapté',dropped:'perdu',unknown:'inconnu'} as const;
const esc=(s:string)=>s.replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
export interface ReportChecks {valid:boolean;errors:string[];roundTrip:boolean;ticksRun:number;validAfterTicks:boolean;bytes?:number;planetMode?:string;elapsedMs?:number}

function familyTable(notes:ImportNotes,title:string):string[] {
 const out=[`## ${title}`,'','| Famille | Dans la sauvegarde | Créés dans Elsewhere | Repris | Adaptés | Perdus | Inconnus |','|---|---:|---:|---:|---:|---:|---:|'];
 for(const f of FAMILIES){
  const s=notes.summary(f),before=notes.before.get(f),after=notes.after.get(f);
  if(!s.exact&&!s.adapted&&!s.dropped&&!s.unknown&&before===undefined)continue;
  out.push(`| ${FAMILY_LABELS[f]} | ${before??'—'} | ${after??'—'} | ${s.exact} | ${s.adapted} | ${s.dropped} | ${s.unknown} |`);
 }
 out.push('','Les colonnes « repris / adaptés / perdus / inconnus » comptent les éléments par définition du jeu (une case de terrain, un objet, un trait…).','');
 return out;
}
function familyDetails(notes:ImportNotes):string[] {
 const out:string[]=[];
 for(const f of FAMILIES){
  const rows=[...(notes.tallies.get(f)?.values()??[])].sort((a,b)=>b.count-a.count||a.def.localeCompare(b.def));
  const messages=notes.messages.filter(m=>m.family===f);
  if(!rows.length&&!messages.length)continue;
  out.push(`### ${FAMILY_LABELS[f]}`,'');
  for(const m of messages)out.push(`- ${m.kind==='mapped'?'✔':m.kind==='adapted'?'≈':'✘'} ${m.text}`);
  if(messages.length)out.push('');
  if(rows.length){
   out.push('| Définition du jeu | Nombre | Statut | Dans Elsewhere | Explication |','|---|---:|---|---|---|');
   for(const r of mergeRows(rows))out.push(`| ${esc(r.def)} | ${r.count} | ${STATUS_LABEL[r.status]} | ${esc(r.to===undefined?'—':elsewhereTargetLabel(f,r.to))} | ${esc(r.note??'')} |`);
   out.push('');
  }
 }
 return out;
}
/** Same definition, status and target merged even when notes differ only by case. */
function mergeRows(rows:DefTally[]):DefTally[] {return rows;}

export function frenchReport(input:{title:string;analysis?:RwsAnalysis;conversion?:{notes:ImportNotes};checks?:ReportChecks}):string {
 const out=[`# ${input.title}`,''];
 const a=input.analysis;
 if(a){
  const s=a.summary;
  out.push('## Sauvegarde lue','',`- Version du jeu : ${s.version} ; modules : ${s.mods.join(', ')||'aucun'}.`,
   `- Durée de la partie : ${s.ticks} ticks (${s.days} jours) ; conteur ${s.storyteller??'?'} (${s.difficulty??'?'}) ; scénario « ${s.scenario??'?'} ».`,
   `- Carte : ${s.mapSize??'aucune'} ; ${s.things} objets ; ${s.pawns} êtres vivants dont ${s.colonists} colons ; ${s.zones} zones ; ${s.research} projets de recherche entamés.`,
   `- Monde : graine « ${s.worldSeed??'?'} », couverture ${s.coverage??'?'}, ${s.worldTiles??'?'} cases ; ${s.factions} factions ; faction du joueur « ${s.playerFaction??'?'} ».`,
   `- Compatibilité : ${a.compatible?'importable':'refusée — '+a.refusals.join(' ')}`,'');
 }
 if(input.checks){
  const c=input.checks;
  out.push('## Résultat de la conversion','',`- Monde : ${c.planetMode==='save'?'planète reconstruite case par case depuis la sauvegarde, colonie sur la même case':c.planetMode==='seed'?'planète régénérée par Elsewhere depuis la même graine, colonie sur une case du même biome':'carte seule, sans planète'}.`,
   `- Validation du monde Elsewhere : ${c.valid?'réussie':'ÉCHEC — '+c.errors.slice(0,5).join(' ; ')}.`,
   `- Rechargement exact (sérialiser, relire, resérialiser) : ${c.roundTrip?'identique':'différent'}${c.bytes?` (${c.bytes} octets)`:''}.`,
   // The game's import adopts the world untouched: no ticks are run before « Jouer ».
   ...c.ticksRun?[`- Simulation après import : ${c.ticksRun} ticks ${c.validAfterTicks?'sans erreur, monde toujours valide':'— ERREUR'}.`]:[],
   ...c.elapsedMs!==undefined?[`- Durée de la conversion : ${(c.elapsedMs/1000).toFixed(1)} s.`]:[],'');
 }
 const notes=input.conversion?.notes??a?.notes;
 if(notes){out.push(...familyTable(notes,input.conversion?'Bilan par famille (conversion)':'Bilan par famille (analyse)'));out.push('## Détail par famille','',...familyDetails(notes));}
 out.push('## Ce qui n’est pas repris dans cette étape','',
  '- Prisonniers, visiteurs, ennemis présents et mécanoïdes ; cadavres ; saletés ; chantiers et plans ; meubles emballés ; ouvrages inachevés.',
  '- Souvenirs, pensées, relations sociales, emplois du temps, politiques (tenues, nourriture, drogues), factures des établis, dressage autre que l’obéissance.',
  '- Santé des animaux ; maladies, dépendances et implants des colons ; neige au sol ; aires autorisées personnalisées.',
  '- Le compteur interne de la partie repart de la création (la date du calendrier est celle de la sauvegarde).','');
 return out.join('\n');
}
