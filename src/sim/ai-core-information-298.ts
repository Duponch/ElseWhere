import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {orbitalCoverage} from './orbital-rules.ts';
import {reservedSource} from './materials.ts';
import {computeWeightedWorldThreatPoints298} from './threat-points.ts';
import {captureKnownWorldThreat298} from './world-known-threat-298.ts';
import {backgroundSkillRefusal} from './colonist-backgrounds.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {actualConsoleHome298,settledConsoleContact298} from './console-service-298.ts';
import {factionCommsAtContact298} from './faction-comms-298.ts';
import {factionCommsTask298,type AiCoreSiteRequest298,type FactionCommsPawn298} from './faction-comms-state-298.ts';
import {prepareItemStashBirth263} from './world-site-producer-263.ts';
import type {CampaignState} from './world-map-state.ts';
import type {MaterialPile,Pawn,World,CommandResult} from './types.ts';
export const AI_INFORMATION_PRICE_298=1500 as const;
const writable=(o:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(o,key);return !!d&&Object.hasOwn(d,'value')&&d.writable===true;};
const arrayMutable=(v:readonly unknown[])=>Object.isExtensible(v)&&Object.getOwnPropertyDescriptor(v,'length')?.writable===true;
/** Relevant own-data closure, once per real execution gesture, never a frame. */
function ownSeal(value:unknown,active=new Set<object>()):()=>boolean {
 if(!value||typeof value!=='object')return ()=>true;if(active.has(value))return ()=>false;
 active.add(value);const proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),fields=keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key)!;const data=Object.hasOwn(d,'value');return {key,d,data,child:data?ownSeal(d.value as unknown,active):()=>false};});active.delete(value);
 return ()=>Object.getPrototypeOf(value)===proto&&Reflect.ownKeys(value).length===keys.length&&fields.every(({key,d,data,child})=>{const n=Object.getOwnPropertyDescriptor(value,key);return data&&!!n&&n.value===d.value&&n.enumerable===d.enumerable&&n.configurable===d.configurable&&n.writable===d.writable&&child();});
}
/** UI consent is stable contact identity, not an affordability or owner grant. */
function basic(w:World,pawnId:number,factionId:number,consoleId:number):{pawn:Pawn;mapId:number;quote:string}|{reason:string} {
 const p=w.pawns.find(p=>p.id===pawnId),task=p&&factionCommsTask298(p);
 if(!isSchema298OrLater(Number(w.schemaVersion))||!p||!task||task.factionId!==factionId||task.consoleId!==consoleId||!settledConsoleContact298(w,p,task))return {reason:'Le négociateur doit être réellement prêt à cette console.'};
 const social=backgroundSkillRefusal(p,'social');if(social)return {reason:social};
 return {pawn:p,mapId:task.mapId,quote:JSON.stringify(['ai-core-info298',w.seed,task.mapId,pawnId,factionId,consoleId,task.startedAtCore,1500])};
}
export function readAiCoreInformation298(w:World,pawnId:number,factionId:number,consoleId:number):{price:1500;requiresWorkerValidation:true;quote?:string;reason?:string} {
 const value=basic(w,pawnId,factionId,consoleId);return 'reason'in value?{price:1500,requiresWorkerValidation:true,reason:value.reason}:{price:1500,requiresWorkerValidation:true,quote:value.quote};
}
function existingCoreSite(root:CampaignState):boolean {return !!root.worldSites263?.entries.some(s=>s.kind==='item-stash'&&!s.closed&&s.items.some(p=>p.item==='ai-core'));}
export type AiCoreInformationPlan298={ok:false;reason:string}|{ok:true;current():boolean;commit():boolean;readonly siteId:number};
export function prepareAiCoreInformation298(w:World,pawnId:number,factionId:number,consoleId:number,quote:string):AiCoreInformationPlan298 {
 const fail=(reason:string):Extract<AiCoreInformationPlan298,{ok:false}>=>({ok:false,reason}),value=basic(w,pawnId,factionId,consoleId);if('reason'in value)return fail(value.reason);
 const home=actualConsoleHome298(w);if(!home||home.mapId!==value.mapId)return fail('Le véritable foyer de ce contact est indisponible.');
 const {root,mapId,body,record}=home,{pawn}=value,task=factionCommsTask298(pawn)!;
 if(quote!==value.quote)return fail('La communication a changé. Vérifiez de nouveau la demande.');
 if(!factionCommsAtContact298(w,pawn,factionId,consoleId))return fail('Le contact réel de communication n’est plus admissible.');
 if(root.gameProfile?.storyteller!=='cassandra-partial'||root.gameProfile.difficulty!=='adventure-story')return fail('Profil de menaces non pris en charge pour cette information.');
 if(root.research?.shipBasics?.completedAt===undefined)return fail('Une recherche spatiale terminée est nécessaire.');
 const factions=root.worldFactions,playerId=factions?.playerFactionId,relation=factions?.relations.find(r=>r.aId===Math.min(factionId,playerId??-1)&&r.bId===Math.max(factionId,playerId??-1));
 if(!relation||relation.goodwill<40)return fail('Relations insuffisantes : 40 requis.');
 if(existingCoreSite(root))return fail('Une cache connue contient déjà un cœur d’IA.');
 if(!w.economy)return fail('Le budget de menace réel du foyer est indisponible.');
 const covered=orbitalCoverage(w),spend:{pileId:number;quantity:number}[]=[],quantities=new Map<number,number>();let remaining=1500;
 for(const pile of w.piles){if(!remaining)break;const o=pile.owner;if(pile.item!=='silver'||o.type!=='ground'||!covered.has(o.z*w.width+o.x))continue;const available=Math.max(0,pile.quantity-reservedSource(w,pile.id)),n=Math.min(remaining,available);if(n>0){spend.push({pileId:pile.id,quantity:n});quantities.set(pile.id,n);remaining-=n;}}
 if(remaining)return fail('1500 argent libres et couverts par des balises alimentées sont nécessaires.');
 // Local eligibility only: never sell a generated Site that this adapted campaign cannot enter.
 // Existing full save/entry guards still own the shapes; no registry or runtime is created here.
 const entryWorldPawns=root.worldPawns,entryGenerationRuntime=root.worldMaps?.generationRuntime;
 if(!entryWorldPawns||!entryGenerationRuntime)return fail('Cette campagne adaptée n’est pas prise en charge pour cette information : les données nécessaires pour créer et rejoindre la cache sont absentes. Aucun argent n’a été dépensé.');
 const worldPoints=captureKnownWorldThreat298(w);if(!worldPoints.ok)return fail(worldPoints.reason);
 // KNOWN World capture exposes missing-value and local-adaptation diagnostics;
 // it does not claim exact native World wealth or global historical adaptation.
 const points=computeWeightedWorldThreatPoints298(worldPoints.input).points;
 const sourceCore=frontierCore297(w),request:AiCoreSiteRequest298={kind:'ai-core-information',homeMapId:mapId,atCore:sourceCore,pawnId,factionId,consoleId,silver:spend};
 const birth=prepareItemStashBirth263(root,points,request);if(!birth.ok)return fail(birth.reason);
 const piles=w.piles,nextPiles:MaterialPile[]=piles.flatMap(p=>{const n=quantities.get(p.id)??0;return n===0?[p]:n===p.quantity?[]:[{...p,quantity:p.quantity-n}];});
 const groups=root.worldGroups,eventOwner=groups??w,events=eventOwner.events,nextEvents=[...events,{tick:root.tick,type:'command' as const,message:'Une information payée révèle une cache de cœur d’IA. Il faut encore récupérer le véritable objet.'}].slice(-80);
 const pawns=w.pawns,structures=w.structures,jobs=w.jobs,research=w.research,profile=w.gameProfile,fires=w.fires,economy=w.economy,groupRows=groups?.groups,selected=root.worldMaps?.selectedMapId;
 const tiles=w.tiles,width=w.width,height=w.height,seed=w.seed,tileLength=tiles.length;
 const terrainRows=[...covered].map(index=>({index,descriptor:Object.getOwnPropertyDescriptor(tiles,String(index))}));
 if(terrainRows.some(row=>!row.descriptor||!Object.hasOwn(row.descriptor,'value')))return fail('La couverture réelle n’est pas un tableau de terrain stable.');
 const terrainCurrent=()=>w.tiles===tiles&&w.width===width&&w.height===height&&w.seed===seed&&tiles.length===tileLength&&terrainRows.every(({index,descriptor:d})=>{const n=Object.getOwnPropertyDescriptor(tiles,String(index));return !!n&&Object.hasOwn(n,'value')&&n.value===d!.value&&n.enumerable===d!.enumerable&&n.configurable===d!.configurable&&n.writable===d!.writable;});
 const seal=ownSeal([pawn,structures,jobs,piles,research,profile,factions,fires,economy,groupRows,...terrainRows.map(entry=>entry.descriptor!.value),birth.site]),sourceTick=root.tick,sourceRng=root.rng,sourceNext=root.nextId,taskOwn=Object.getOwnPropertyDescriptor(pawn,'factionComms298');let used=false;
 const mutable=()=>arrayMutable(piles)&&writable(w,'piles')&&writable(body,'piles')&&['path','state','planCooldown'].every(k=>writable(pawn,k))&&taskOwn?.configurable===true&&writable(eventOwner,'events');
 const current=()=>{const live=actualConsoleHome298(w);return !used&&!!live&&live.root===root&&live.body===body&&live.record===record&&live.mapId===mapId&&registeredCampaign(w)===root&&registeredMapId(w)===mapId&&frontierCore297(w)===sourceCore&&root.worldPawns===entryWorldPawns&&root.worldMaps?.generationRuntime===entryGenerationRuntime&&terrainCurrent()&&worldPoints.current()&&root.tick===sourceTick&&root.rng===sourceRng&&root.nextId===sourceNext&&w.piles===piles&&body.piles===piles&&w.pawns===pawns&&body.pawns===pawns&&pawns.includes(pawn)&&w.structures===structures&&w.jobs===jobs&&w.research===research&&w.gameProfile===profile&&w.fires===fires&&w.economy===economy&&root.worldGroups===groups&&groups?.groups===groupRows&&eventOwner.events===events&&root.worldMaps?.selectedMapId===selected&&factionCommsTask298(pawn)===task&&seal()&&!existingCoreSite(root)&&mutable()&&birth.current();};
 if(!current())return fail('Le destinataire ou les sources de paiement sont immuables ou périmés.');
 return {ok:true,siteId:birth.site.id,current,commit(){if(!current())return false;used=true;birth.commit();w.piles=nextPiles;body.piles=nextPiles;eventOwner.events=nextEvents;delete (pawn as FactionCommsPawn298).factionComms298;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;return true;}};
}
export function applyAiCoreInformation298(w:World,pawnId:number,factionId:number,consoleId:number,quote:string):CommandResult {
 const plan=prepareAiCoreInformation298(w,pawnId,factionId,consoleId,quote);return !plan.ok?{ok:false,code:'invalid-command',reason:plan.reason}:plan.commit()?{ok:true,affected:1}:{ok:false,code:'invalid-command',reason:'La demande a changé avant sa confirmation.'};
}