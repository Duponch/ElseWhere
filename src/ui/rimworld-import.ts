import type {RwsImportOutcome,RwsImportProgress,RwsImportWorkerMessage,RwsImportWorkerRequest} from '../import/rimworld/import-job';

/* Page side of the RimWorld save import (step 3).
 *
 * The conversion runs in its own dedicated Worker (import.worker.ts), not in
 * the simulation Worker: it takes 15 to 30 s of synchronous work on a large
 * save, which would hold up the simulation Worker's requests (the recovery
 * copy of the open colony, publications) while it runs; a synchronous job can
 * only be cancelled by stopping its thread, which must never be the
 * simulation's; and the import code is then loaded only when a player
 * imports. The file itself is handed to that Worker, which reads it: the page
 * never holds the RimWorld text. The converted Elsewhere save then goes
 * through the ordinary load path (strict validation in the simulation Worker). */
export type RimWorldImportResult=RwsImportOutcome|{readonly status:'cancelled'};
export interface RimWorldImportJob {
 /** Settles once, with the outcome, a failure or `cancelled`; never rejects. */
 readonly done:Promise<RimWorldImportResult>;
 /** Stops the Worker at once; `done` settles as `cancelled`. */
 cancel():void;
}
export type RimWorldImportStarter=(file:File,onProgress:(progress:RwsImportProgress)=>void,developerTest?:true)=>RimWorldImportJob;

const fileNameOf=(file:File)=>typeof file.name==='string'&&file.name?file.name:'sauvegarde.rws';

/** Starts one import in a fresh Worker from `createWorker`. Without Worker
 * support the import is refused: it never runs on the page thread. */
export function startRimWorldImport(file:File,onProgress:(progress:RwsImportProgress)=>void,createWorker:()=>Worker|undefined,developerTest?:true):RimWorldImportJob {
 let settle!:(result:RimWorldImportResult)=>void,settled=false,worker:Worker|undefined;
 const done=new Promise<RimWorldImportResult>(resolve=>{settle=resolve;});
 const finish=(result:RimWorldImportResult)=>{
  if(settled)return;settled=true;
  if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();worker=undefined;}
  settle(result);
 };
 const failed=(message:string):RimWorldImportResult=>({status:'failed',fileName:fileNameOf(file),message});
 try{worker=createWorker();}catch{worker=undefined;}
 if(!worker){finish(failed('Ce navigateur ne peut pas lancer l’import à côté du jeu (Worker indisponible).'));return {done,cancel:()=>{}};}
 worker.onmessage=(event:MessageEvent<RwsImportWorkerMessage>)=>{
  const message=event.data;if(settled||!message)return;
  if(message.type==='progress')onProgress(message.progress);
  else if(message.type==='done')finish(message.outcome);
 };
 worker.onerror=event=>{event?.preventDefault?.();finish(failed('Le module d’import s’est arrêté de façon inattendue. La colonie actuelle et vos sauvegardes sont conservées.'));};
 try{worker.postMessage({type:'import',file,...developerTest===true?{developerTest:true as const}:{}} satisfies RwsImportWorkerRequest);}
 catch(error){finish(failed(`Le fichier n’a pas pu être transmis au module d’import : ${error instanceof Error?error.message:String(error)}`));}
 return {done,cancel:()=>finish({status:'cancelled'})};
}

/** Name of the downloaded report: the save's name, then « -rapport-import.md ». */
export function rimWorldReportFileName(fileName:string):string {
 const base=fileName.replace(/\.rws$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'_').trim().slice(0,80)||'sauvegarde';
 return `${base}-rapport-import.md`;
}
