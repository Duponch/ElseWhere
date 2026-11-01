import {isVictoryResearchProject298,isVictoryResearchSchema298,VICTORY_RESEARCH_CONTENT_298,type VictoryResearchProject298,type VictoryResearchRecordKey298} from './victory-research-content-298.ts';

export interface VictoryResearchProgress298 {readonly points:number;readonly completedAt?:number}
export type VictoryResearchParentKey298='microelectronics'|'machining'|'shipBasics'|VictoryResearchRecordKey298;
export interface VictoryResearchView298 {readonly schemaVersion:number;readonly research?:{readonly [K in VictoryResearchParentKey298]?:VictoryResearchProgress298}}
const parents:Readonly<Record<VictoryResearchProject298,readonly Readonly<{key:VictoryResearchParentKey298;label:string}>[]>>=Object.freeze({
 'long-range-mineral-scanner':Object.freeze([Object.freeze({key:'microelectronics' as const,label:'Microélectronique'}),Object.freeze({key:'machining' as const,label:'Usinage'})]),
 'ship-computer':Object.freeze([Object.freeze({key:'shipBasics' as const,label:'Construction de vaisseau'})]),
 'ship-sensors':Object.freeze([Object.freeze({key:'shipBasics' as const,label:'Construction de vaisseau'}),Object.freeze({key:'longRangeMineralScanner' as const,label:'Scanner minéral longue portée'})]),
});
export const victoryResearchUnlocked298=(w:VictoryResearchView298,p:VictoryResearchProject298):boolean=>isVictoryResearchSchema298(w.schemaVersion)&&w.research?.[VICTORY_RESEARCH_CONTENT_298[p].recordKey]?.completedAt!==undefined;
export function victoryResearchPrerequisite298(w:VictoryResearchView298,p:VictoryResearchProject298):string|undefined {
 if(!isVictoryResearchSchema298(w.schemaVersion))return 'Cette recherche exige le schéma prospectif298.';
 return parents[p].find(parent=>w.research?.[parent.key]?.completedAt===undefined)?.label;
}

type Data=Record<string,unknown>;
const plain=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const projects=Object.freeze(['long-range-mineral-scanner','ship-computer','ship-sensors'] as const);
/** Conjoin the FULL existing research guard. This guard owns only the three
 * prospective records/project selections; it never initializes progress. */
export function validVictoryResearchDomain298(state:unknown,version:number,atLocal:number):boolean {
 try{
  if(!int(version,1,299)||!int(atLocal,0,Number.MAX_SAFE_INTEGER))return false;
  if(state===undefined)return true;if(!plain(state))return false;
  const project=data(state,'project');if(!project&&'project'in state)return false;
  const selected=project?.value;
  if(isVictoryResearchProject298(selected)&&!isVictoryResearchSchema298(version))return false;
  for(const p of projects){
   const facts=VICTORY_RESEARCH_CONTENT_298[p],key=facts.recordKey,present=key in state;
   if(!present){if(selected===p)return false;continue;}
   if(!isVictoryResearchSchema298(version))return false;
   const field=data(state,key);if(!field||!plain(field.value))return false;
   const progress=field.value,points=data(progress,'points')?.value;
   if(Reflect.ownKeys(progress).some(k=>typeof k!=='string'||!['points','completedAt'].includes(k)||!data(progress,k))||!int(points,0,facts.scaledCost))return false;
   let earliest=0;
   for(const parent of parents[p]){const source=data(state,parent.key)?.value;if(!plain(source))return false;const completed=data(source,'completedAt')?.value;if(!int(completed,0,atLocal))return false;earliest=Math.max(earliest,completed);}
   if('completedAt'in progress){if(!int(data(progress,'completedAt')?.value,earliest,atLocal)||points!==facts.scaledCost||selected===p)return false;}
   else if(points>=facts.scaledCost)return false;
  }
  return true;
 }catch{return false;}
}
