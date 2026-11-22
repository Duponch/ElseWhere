/** Step 3: one whole import as the game runs it, off the main thread
 * (import.worker.ts): read, analyse, convert, validate, write the Elsewhere
 * save text and check that it reloads to the same text. Pure TypeScript: the
 * same code runs in the browser Worker, in Node and in the tests.
 *
 * Nothing of the RimWorld file leaves this module except what the player is
 * shown (counts, French report) and the converted Elsewhere save. */
import {readRwsSave} from './rws-save.ts';
import {analyzeRwsSave,type RwsAnalysis} from './analyze.ts';
import {convertRwsSave,type RwsConvertStage} from './convert.ts';
import {frenchReport} from './report-fr.ts';
import {FAMILIES,FAMILY_LABELS,type DefTally,type Family,type ImportNotes,type Message} from './notes.ts';
import {elsewhereTargetLabel} from './labels-fr.ts';
import {validateWorld,serializeCampaignUnchecked,deserializeCampaign} from '../../sim/serialization.ts';

/** Largest .rws accepted: a long Core colony is 15 to 40 MB. */
export const MAX_RWS_BYTES=256*1024*1024;

export type RwsImportStage='read'|'analyze'|RwsConvertStage|'validate'|'serialize'|'reload';
export interface RwsImportProgress {readonly stage:RwsImportStage;readonly label:string;/** 0..1, monotonic. */readonly fraction:number}

/** Share of the whole import at the start of each stage, measured on a real
 * 250×250 Core save in Node (14 s): creating the colony on its tile (58 %)
 * and the reload check (16 %) are the long parts. Only the bar depends on it. */
const STAGES:readonly {stage:RwsImportStage;label:string;at:number}[]=[
 {stage:'read',label:'Lecture de la sauvegarde',at:0},
 {stage:'analyze',label:'Analyse du contenu',at:.09},
 {stage:'planet',label:'Reconstruction de la planète',at:.1},
 {stage:'colony',label:'Création de la colonie sur sa case',at:.14},
 {stage:'terrain',label:'Terrain, roches et toits',at:.72},
 {stage:'buildings',label:'Bâtiments',at:.73},
 {stage:'plants',label:'Plantes',at:.735},
 {stage:'people',label:'Colons et animaux',at:.74},
 {stage:'items',label:'Objets au sol',at:.745},
 {stage:'zones',label:'Zones et aires',at:.79},
 {stage:'research',label:'Recherche et date',at:.792},
 {stage:'finish',label:'Réseaux et stocks',at:.794},
 {stage:'validate',label:'Validation du monde',at:.796},
 {stage:'serialize',label:'Écriture de la sauvegarde Elsewhere',at:.83},
 {stage:'reload',label:'Contrôle du rechargement',at:.84},
];
/** Progress at the start of a stage, or `part` (0..1) of the way through it. */
export function importProgress(stage:RwsImportStage,part=0):RwsImportProgress {
 const index=STAGES.findIndex(s=>s.stage===stage),found=STAGES[index]!,next=STAGES[index+1]?.at??1;
 const fraction=found.at+Math.max(0,Math.min(1,part))*(next-found.at);
 return {stage,label:found.label,fraction:Math.round(fraction*1000)/1000};
}

export interface RwsFamilyCount {readonly family:Family;readonly label:string;readonly before?:number;readonly after?:number;readonly exact:number;readonly adapted:number;readonly dropped:number;readonly unknown:number}
/** `toLabel` is the French name of the Elsewhere target (`to` keeps its id). */
export interface RwsFamilyDetail {readonly family:Family;readonly label:string;readonly messages:readonly Message[];readonly rows:readonly (DefTally&{readonly toLabel?:string})[]}
export interface RwsLoss {readonly family:Family;readonly label:string;readonly def:string;readonly count:number;readonly note?:string}
export type RwsImportFacts=RwsAnalysis['summary'];
export type RwsPlanetMode='save'|'seed'|'none';

export type RwsImportOutcome=
 |{readonly status:'refused';readonly fileName:string;readonly reasons:readonly string[];readonly facts:RwsImportFacts;readonly report:string}
 |{readonly status:'failed';readonly fileName:string;readonly message:string;readonly facts?:RwsImportFacts;readonly report?:string}
 |{readonly status:'converted';readonly fileName:string;readonly facts:RwsImportFacts;readonly planetMode:RwsPlanetMode;
   readonly colonists:number;readonly animals:number;readonly bytes:number;
   readonly families:readonly RwsFamilyCount[];readonly details:readonly RwsFamilyDetail[];readonly losses:readonly RwsLoss[];
   readonly report:string;/** The converted Elsewhere save (campaign text), the only thing kept. */readonly save:string};

/** Message from the import Worker to the page. */
export type RwsImportWorkerMessage={readonly type:'progress';readonly progress:RwsImportProgress}|{readonly type:'done';readonly outcome:RwsImportOutcome};
/** Request from the page to the import Worker: the chosen file, read there. */
export interface RwsImportWorkerRequest {readonly type:'import';readonly file:Blob&{readonly name?:string}}

const message=(error:unknown)=>error instanceof Error?error.message:String(error);
const now=()=>typeof performance!=='undefined'?performance.now():0;

/** Per family counts in the report's order (families with nothing are left out). */
export function familyCounts(notes:ImportNotes):RwsFamilyCount[] {
 const out:RwsFamilyCount[]=[];
 for(const family of FAMILIES){
  const s=notes.summary(family),before=notes.before.get(family),after=notes.after.get(family);
  if(!s.exact&&!s.adapted&&!s.dropped&&!s.unknown&&before===undefined)continue;
  out.push({family,label:FAMILY_LABELS[family],...before!==undefined?{before}:{},...after!==undefined?{after}:{},exact:s.exact,adapted:s.adapted,dropped:s.dropped,unknown:s.unknown});
 }
 return out;
}
/** Every family's messages and definition rows, largest first (the in-game report). */
export function familyDetails(notes:ImportNotes):RwsFamilyDetail[] {
 const out:RwsFamilyDetail[]=[];
 for(const family of FAMILIES){
  const rows=[...(notes.tallies.get(family)?.values()??[])].sort((a,b)=>b.count-a.count||a.def.localeCompare(b.def)).map(row=>({...row,...row.to!==undefined?{toLabel:elsewhereTargetLabel(family,row.to)}:{}}));
  const messages=notes.messages.filter(m=>m.family===family).map(m=>({...m}));
  if(rows.length||messages.length)out.push({family,label:FAMILY_LABELS[family],messages,rows});
 }
 return out;
}
/** The largest losses (dropped or unknown definitions), all families together. */
export function mainLosses(notes:ImportNotes,limit=12):RwsLoss[] {
 const all:RwsLoss[]=[];
 for(const family of FAMILIES)for(const row of notes.tallies.get(family)?.values()??[])
  if(row.status==='dropped'||row.status==='unknown')all.push({family,label:FAMILY_LABELS[family],def:row.def,count:row.count,...row.note?{note:row.note}:{}});
 const order=(f:Family)=>FAMILIES.indexOf(f);
 return all.sort((a,b)=>b.count-a.count||order(a.family)-order(b.family)||a.def.localeCompare(b.def)).slice(0,limit);
}

/** Runs the whole import of one save text. Never throws: every failure is a
 * French outcome. `onProgress` is called at the start of each stage. */
export function runRwsImport(source:string,fileName:string,onProgress:(progress:RwsImportProgress)=>void=()=>{}):RwsImportOutcome {
 // Monotonic: a fallback planet repeats the colony stage without moving the bar back.
 let reached=-1,lastKey='';
 const started=now(),stage=(s:RwsImportStage,part?:number)=>{
  const progress=importProgress(s,part),key=`${s}:${progress.fraction}`;
  if(progress.fraction<reached||key===lastKey)return;reached=progress.fraction;lastKey=key;onProgress(progress);
 };
 stage('read');
 let analysis:RwsAnalysis;
 try{analysis=analyzeAfterRead(source,()=>stage('analyze'));}
 catch(error){return {status:'failed',fileName,message:`Ce fichier n’est pas une sauvegarde RimWorld lisible : ${message(error)}`};}
 const facts=analysis.summary;
 if(!analysis.compatible)return {status:'refused',fileName,reasons:analysis.refusals,facts,report:frenchReport({title:`Import de ${fileName} : refusé`,analysis})};
 let conversion:ReturnType<typeof convertRwsSave>;
 try{conversion=convertRwsSave(analysis.save,{onStage:stage});}
 catch(error){return {status:'failed',fileName,facts,message:`La conversion a échoué : ${message(error)}`,report:frenchReport({title:`Import de ${fileName} : échec`,analysis})};}
 const w=conversion.world;
 stage('validate');
 const errors=validateWorld(w);
 const failedReport=(title:string,extra:{roundTrip:boolean;bytes?:number})=>frenchReport({title,analysis,conversion,checks:{valid:!errors.length,errors,ticksRun:0,validAfterTicks:true,planetMode:conversion.planetMode,elapsedMs:now()-started,...extra}});
 if(errors.length)return {status:'failed',fileName,facts,message:`Le monde converti ne passe pas la validation d’Elsewhere : ${errors.slice(0,3).join(' ; ')}`,report:failedReport(`Import de ${fileName} : échec`,{roundTrip:false})};
 stage('serialize');
 let save:string;
 try{save=serializeCampaignUnchecked(w);}
 catch(error){return {status:'failed',fileName,facts,message:`La sauvegarde Elsewhere n’a pas pu être écrite : ${message(error)}`,report:failedReport(`Import de ${fileName} : échec`,{roundTrip:false})};}
 stage('reload');
 // The load path a later « Jouer » takes (strict validation included), then the same text again.
 let roundTrip=false,reloadError='';
 try{roundTrip=serializeCampaignUnchecked(deserializeCampaign(save))===save;}catch(error){reloadError=message(error);}
 if(!roundTrip)return {status:'failed',fileName,facts,message:reloadError?`La sauvegarde convertie ne se recharge pas : ${reloadError}`:'La sauvegarde convertie ne se recharge pas à l’identique.',report:failedReport(`Import de ${fileName} : échec`,{roundTrip:false,bytes:save.length})};
 const report=frenchReport({title:`Import de ${fileName} dans Elsewhere`,analysis,conversion,checks:{valid:true,errors:[],roundTrip:true,ticksRun:0,validAfterTicks:true,bytes:save.length,planetMode:conversion.planetMode,elapsedMs:now()-started}});
 return {status:'converted',fileName,facts,planetMode:conversion.planetMode,colonists:w.pawns.length,animals:w.wildlife?.animals.filter(a=>a.domestic).length??0,bytes:save.length,
  families:familyCounts(conversion.notes),details:familyDetails(conversion.notes),losses:mainLosses(conversion.notes),report,save};
}
function analyzeAfterRead(source:string,analysing:()=>void):RwsAnalysis {
 const save=readRwsSave(source);analysing();return analyzeRwsSave(save);
}

/** The import Worker's work for one request: reads the chosen file there (the
 * page never holds its text), posts each stage, then the outcome. Shared by
 * import.worker.ts and the tests' in-process Worker. */
export async function handleRwsImportRequest(request:RwsImportWorkerRequest,post:(message:RwsImportWorkerMessage)=>void):Promise<void> {
 const fileName=request.file?.name??'sauvegarde.rws';
 let outcome:RwsImportOutcome;
 try{
  const file=request.file;
  if(!file||request.type!=='import')outcome={status:'failed',fileName,message:'Aucun fichier à importer.'};
  else if(!file.size)outcome={status:'failed',fileName,message:'Ce fichier est vide : ce n’est pas une sauvegarde RimWorld.'};
  else if(file.size>MAX_RWS_BYTES)outcome={status:'failed',fileName,message:`Ce fichier dépasse ${MAX_RWS_BYTES/1024/1024} Mio : l’import ne le prend pas en charge.`};
  else{
   // The bar shows « Lecture » while the file is read, once.
   let last='';const send=(progress:RwsImportProgress)=>{const key=`${progress.stage}:${progress.fraction}`;if(key===last)return;last=key;post({type:'progress',progress});};
   send(importProgress('read'));outcome=runRwsImport(await file.text(),fileName,send);
  }
 }catch(error){outcome={status:'failed',fileName,message:`Lecture du fichier impossible : ${message(error)}`};}
 post({type:'done',outcome});
}
