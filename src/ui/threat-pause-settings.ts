import type {ThreatPauseMode} from '../bridge/urgent-threats';
export type {ThreatPauseMode} from '../bridge/urgent-threats';
export const THREAT_PAUSE_PREFERENCE_KEY='lisiere.presentation.threat-pause.v1';
export const THREAT_PAUSE_CHOICES:readonly {value:ThreatPauseMode;label:string}[]=[
 {value:'never',label:'Jamais'},{value:'major',label:'Menaces majeures'},{value:'any-threat',label:'Toutes menaces'},{value:'any-letter',label:'Toutes lettres'},
];
export const threatPauseMode=(value:unknown):ThreatPauseMode=>value==='never'||value==='any-threat'||value==='any-letter'?value:'major';
export function readThreatPausePreference(read:()=>string|null):ThreatPauseMode {try{return threatPauseMode(read());}catch{return 'major';}}
/** A local preference becomes active only after the worker confirms it. Storage
 * failure cannot roll back a mode already accepted by the worker. */
export function createThreatPausePreference(options:{initial:ThreatPauseMode;confirm:(mode:ThreatPauseMode)=>Promise<unknown>;store:(mode:ThreatPauseMode)=>boolean;changed:()=>void}){
 const desiredInitialMode=options.initial;let mode:ThreatPauseMode='major',pending=false;let inFlight:Promise<boolean>|undefined;
 async function apply(next:ThreatPauseMode,persist:boolean):Promise<boolean>{
  if(pending)throw Error('Un choix de pause attend encore sa confirmation.');
  if(!THREAT_PAUSE_CHOICES.some(c=>c.value===next))throw Error('Choix de pause automatique invalide.');
  pending=true;options.changed();
  try{await options.confirm(next);mode=next;if(!persist)return true;try{return options.store(next);}catch{return false;}}
  finally{pending=false;options.changed();}
 }
 function run(next:ThreatPauseMode,persist:boolean){if(pending)return Promise.reject(Error('Un choix de pause attend encore sa confirmation.'));const work=apply(next,persist);inFlight=work;void work.then(()=>{if(inFlight===work)inFlight=undefined;},()=>{if(inFlight===work)inFlight=undefined;});return work;}
 return {get mode(){return mode;},get pending(){return pending;},whenSettled:()=>inFlight??Promise.resolve(true),initialize:()=>run(desiredInitialMode,false),set:(next:ThreatPauseMode)=>run(next,true)};
}
/** Menu and other internal resumptions cannot survive a newly confirmed urgent
 * pause or a navigation gesture which deliberately cancels a deferred resume. */
export function createDeferredResumeGuard(){let revision=0,held=false;return {
 capture:()=>held?-1:revision,allows:(captured:number)=>captured===revision&&!held,
 confirm:(urgentHeld:boolean)=>{if(urgentHeld&&!held)revision++;held=urgentHeld;},
 cancel:()=>{revision++;},get held(){return held;},
};}