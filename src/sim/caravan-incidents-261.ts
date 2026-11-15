import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {draftManhunterRoster261} from './caravan-manhunter-261.ts';
import {planetTile} from './planet-geography-256.ts';
import {worldGroupContext} from './world-map-context.ts';
import {healthRandom} from './health.ts';
import {visitorPoints} from './visitor-state.ts';
import {caravanFactionCandidates261,selectCaravanFaction261,type CaravanFactionCapture261} from './caravan-faction-selection-261.ts';
import {CARAVAN_BIOME_MTB_261,groupVisibility261,caravanIncidentOccurs261} from './caravan-incident-calculation-261.ts';
import {CARAVAN_INCIDENTS_261,caravanIncidentTooRecent261,firedCaravanStory261,type EncounterGroup261,type CaravanIncident261} from './caravan-encounter-state-261.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {CARAVAN_TRADER_KINDS_332} from './trader-caravans-332.ts';
import {captureCurrentDemand261,selectCurrentDemand261} from './caravan-demand-capture-261.ts';
import type {CampaignState,WorldGroupRecord} from './world-map-state.ts';
import type {WorldLandBiome} from './world-biome-selection.ts';

/** Formation/reformation creation only. Never called by migration/bootstrap. */
export function admitBornCaravan261(root:CampaignState,record:WorldGroupRecord):void {
 if((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))(record as EncounterGroup261).encounters261={revision:1};
}
export function pendingCaravan261(root:CampaignState):EncounterGroup261|undefined {
 return root.worldGroups?.groups.find(r=>(r as EncounterGroup261).pending261!==undefined) as EncounterGroup261|undefined;
}
function actualFactionCapture(root:CampaignState):CaravanFactionCapture261[]|undefined {
 const registry=root.worldFactions;if(!registry)return;
 const result:CaravanFactionCapture261[]=[];
 for(const a of registry.factions){
  const player=a.id===registry.playerFactionId,relation=player?undefined:registry.relations.find(r=>r.aId===Math.min(a.id,registry.playerFactionId)&&r.bId===Math.max(a.id,registry.playerFactionId));
  if(!player&&!relation)return;
  result.push({id:a.id,def:a.def,player,hidden:a.hidden,hostileToPlayer:relation?.kind==='hostile',lifecycle259:a.lifecycle259});
 }
 return result;
}
export function caravanMapAllowed261(root:CampaignState,tile:number):boolean {
 const planet=root.planet,t=planet&&planetTile(planet,tile);if(planet?.revision!==3||!t||!Object.hasOwn(CARAVAN_BIOME_MTB_261,t.biome)||t.hilliness==='impassable')return false;
 return !root.worldMaps?.sites.some(s=>s.tile===tile)&&!root.worldFactions?.settlements.some(s=>s.tile===tile)
  &&!root.worldMaps?.retired.some(s=>s.tile===tile&&s.reason!=='battlefield-empty'&&(s.markerUntilCore===undefined||s.markerUntilCore>root.tick*10));
}
/** Own calendar, never a Cassandra ticket or deferred favorable retry. Each
 * 1000-Core boundary has one campaign RNG pass in actual group/definition order.
 * A successful incident owns originals immediately and stops this visible batch.
 * Temporary-map generation subsequently consumes precisely this pending owner.
 * Current PNJ points deliberately reuse the existing visitor/combat producer;
 * this approved adaptation does not claim native pawn-MarketValue parity. */
export function advanceCaravanIncidents261(root:CampaignState):boolean {
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||!root.worldGroups||root.planet?.revision!==3||!root.worldFactions||!root.worldPawns||root.tick*10%1000!==0||pendingCaravan261(root))return false;
 const factions=actualFactionCapture(root);if(!factions)return false;
 for(const raw of root.worldGroups.groups){
  const record=raw as EncounterGroup261,g=record.state;
  if(!record.encounters261||record.localMapId!==null||!('members'in g)||g.lastPersonalTick!==root.tick||!caravanMapAllowed261(root,g.tile))continue;
  const biome=planetTile(root.planet,g.tile)!.biome as WorldLandBiome,context=worldGroupContext(root,g.id);if(!context)continue;
  for(const incident of CARAVAN_INCIDENTS_261){
   if(caravanIncidentTooRecent261(record.story261,incident,root.tick*10))continue;
   const random={rng:root.rng};
   const points=visitorPoints(random,'visitor'),mode=incident==='meeting'?'meeting':'combat';
   if(incident==='manhunter-ambush'){
    if(!caravanIncidentOccurs261(biome,incident,groupVisibility261(g),random)){root.rng=random.rng;continue;}
    const roster=draftManhunterRoster261(root,g.tile,points,random.rng);if(!roster){root.rng=random.rng;continue;}
    record.pending261={revision:1,kind:'ambush',decision:'forced',animalAmbush261:true,atCore:root.tick*10,factionId:null,people:[],animals:roster.animals,items:[],packed:[]};
    root.nextId=roster.nextId;root.rng=roster.rng;root.worldGroups.selectedGroupId=g.id;
    root.worldGroups.events.push({tick:root.tick,type:'command',message:'Une meute atteinte de scaria interrompt la caravane. Préparation du champ de bataille en pause.'});if(root.worldGroups.events.length>80)root.worldGroups.events.shift();return true;
   }
   const eligibility=caravanFactionCandidates261(factions,mode,points);
   if(!eligibility.ok||!eligibility.choices.length){root.rng=random.rng;continue;}
   const demand=incident==='demand'?captureCurrentDemand261(g,root.worldFactions.playerFactionId,root.schemaVersion):undefined;
   if(demand&&!demand.ok)continue;
   if(!caravanIncidentOccurs261(biome,incident,groupVisibility261(g),random)){root.rng=random.rng;continue;}
   // CanFire's native faction draw is distinct from GeneratePawns' selection.
   const canFire=selectCaravanFaction261(factions,mode,points,()=>healthRandom(random));
   const selected=canFire.ok?selectCaravanFaction261(factions,mode,points,()=>healthRandom(random)):canFire;
   if(!selected.ok){root.rng=random.rng;continue;}
   const selection=demand?.ok?selectCurrentDemand261(demand.capture,random):undefined;
   if(selection&&selection.kind!=='selected'){root.rng=random.rng;continue;}
   const roster=draftForeignRoster261(context,incident==='meeting'?'trader':'combat',selected.factionId,points,random.rng);
   if(!roster){root.rng=random.rng;continue;}
   const common={revision:1 as const,atCore:root.tick*10,factionId:selected.factionId,people:roster.people,animals:[],items:roster.items,packed:[]};
   if(incident==='demand'){
    if(selection?.kind!=='selected')throw Error('Missing actual demand selection');
    record.pending261={...common,kind:'demand',decision:'open',demands:selection.lines};
   }else if(incident==='meeting'){
    if(!roster.meeting)throw Error('Missing actual trader roles');
    record.pending261={...common,kind:'meeting',decision:'open',...roster.meeting};
   }else record.pending261={...common,kind:'ambush',decision:'forced'};
   root.nextId=roster.nextId;root.rng=roster.rng;
   if(incident!=='ambush')record.story261=firedCaravanStory261(record.story261,incident,root.tick*10);
   root.worldGroups.selectedGroupId=g.id;
   const met=roster.meeting?.caravanKind338;
   root.worldGroups.events.push({tick:root.tick,type:'command',message:met?`La caravane rencontre une caravane marchande (${CARAVAN_TRADER_KINDS_332[met].label}) : Commerce, Attaquer ou Continuer.`:incidentMessage261(incident)});
   if(root.worldGroups.events.length>80)root.worldGroups.events.shift();return true;
  }
 }
 return false;
}
function incidentMessage261(kind:CaravanIncident261):string {
 return kind==='ambush'?'Une embuscade interrompt la caravane. Préparation du champ de bataille en pause.':kind==='meeting'?'La caravane rencontre des marchands : Commerce, Attaquer ou Continuer.':'Des assaillants exigent des biens réels : Donner ou Combattre.';
}
