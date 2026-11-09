import {validGeographicCreationSize262,validGeographicSettlementDimensions262,type GeographicCreationSize262} from './geographic-creation-options-262.ts';
import {captureCampaignLordIds256} from './cave-hive-lord-ids-256.ts';
import {captureAncientCasketGroupIds256} from './ancient-casket-group-ids-256.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Boundary adapter only: real campaign -> unpublished Encounter candidate.
 * The ordered worker owns the shared generation runtime and final entry.
 * Neither a progress yield nor a ready draft is a campaign adoption. */
import {assembleEncounterCamp256,assembleSettlementMap257,type CampMapInputs256,type CampMapProgress256,type CampMapResult256} from './camp-map-assembly-256.ts';
import {campAnimalArrayWritable256} from './camp-entry-recipients-256.ts';
import {CAMPAIGN_FIELDS,type CampaignField} from './secondary-site-state.ts';
import {captureSecondaryMap} from './secondary-site-context.ts';
import {registeredCampaign} from './world-map-context.ts';
import {groupEntryActions} from './world-map-authority.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {CORE_4871_PAWN_KIND_ORDER} from './core-definition-order-4871.ts';
import type {World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {CampaignState} from './world-map-state.ts';
import type {draftSite} from './secondary-site.ts';

/** Supplied by the SAME actual generator runtime, after its preceding calls.
 * No label/seed/permutation default is an attestation of this state. */
export interface ActualCampGenerationRuntime256 {
 readonly angular:CampMapInputs256['angular'];
 readonly context:CampMapInputs256['context'];
 readonly adjacentPermutation:readonly number[];
 readonly fog:Omit<CampMapInputs256['fog'],'provenance'>;
 readonly animalRuntimeRng:number;
 readonly monumentCatalogue?:CampMapInputs256['monumentCatalogue'];
}
export type ReadyCampDraft256={
 readonly status:'ready';readonly groupId:number;
 readonly settlement?:{readonly size:GeographicCreationSize262;readonly nextLordId:number;readonly nextAncientCasketGroupId:number};
 readonly draft:NonNullable<ReturnType<typeof draftSite>>;
 /** Closed-over actual source, not a client-provided boolean certificate. */
 current(input:CampaignState):boolean;
 /** Apply these actual outputs to their runtime owner ONLY with entry commit.
  * In particular, do not drop initialGrowth or silently regenerate edge order. */
 readonly adoptWorldAnimals:()=>void;
 readonly runtimeAfter:Pick<Extract<CampMapResult256,{status:'ready'}>,'initialGrowth'|'adjacentPermutation'|'adjacentUses'|'edgeContext'|'initialization'|'steps'>;
};
export type GroupCampDraftResult256=ReadyCampDraft256|Extract<CampMapResult256,{status:'blocked'}>;

/** Existing physical-owner capture already rejects conflicting originals.
 * Core WorldPawns classifies actual caravan members separately from Free:
 * they cannot be redressed by a wild-animal generation request. Keep all
 * other retained/contained originals under the conservative refusal until
 * their actual Free/mothballed authority is implemented. */
export function captureCampRetainedAnimals256(root:CampaignState):WildAnimal[] {
 const capture=captureActorBeds256(root);
 const caravan=new Set<WildAnimal>();
 for(const record of root.worldGroups?.groups??[])if('members'in record.state)
  for(const animal of record.state.animalOwners?.members??[])caravan.add(animal);
 const pending=new Set((root.worldGroups?.groups??[]).flatMap(record=>record.pending261?.animals??[]));
 return capture.actors.filter((a):a is WildAnimal=>'species'in a&&capture.localMapFor(a)===null&&!caravan.has(a)&&!pending.has(a));
}
function sharedMutableStamp(root:CampaignState):string {
 // Planet.geography is immutable and potentially dense: never stringify it.
 // The exact Planet/geography references are checked separately below.
 return JSON.stringify(CAMPAIGN_FIELDS.filter(k=>k!=='planet').map(k=>[k,root[k]]));
}
function mapRegistryStamp(root:CampaignState):string {
 const maps=root.worldMaps!;
 return JSON.stringify({nextMapId:maps.nextMapId,campaignSeed:maps.campaignSeed,calendarOrigin:maps.calendarOrigin,mapSize:maps.mapSize,nextLordId:maps.nextLordId,nextAncientCasketGroupId:maps.nextAncientCasketGroupId,
  sites:maps.sites.map(s=>({id:s.id,tile:s.tile,kind:s.kind,createdAt:s.createdAt})),retired:maps.retired});
}
function planetScalarStamp(planet:NonNullable<CampaignState['planet']>):string {
 if(planet.revision!==3)return JSON.stringify({revision:planet.revision});
 return JSON.stringify({revision:planet.revision,adoptedAt:planet.adoptedAt,generationSeed:planet.generationSeed,homeTile:planet.homeTile,civilianTile:planet.civilianTile,nextGroupId:planet.nextGroupId});
}
/** No shared authority, retained Pawn or supplied static state is written.
 * Cancellation is simply generator.return()/discard; there is no rollback
 * that rewrites the real allocator, PRNG or player map. */
export function* draftActualGroupCamp256(input:CampaignState,groupId:number,runtime:ActualCampGenerationRuntime256|undefined,mode:'camp'|'settle'='camp'):Generator<CampMapProgress256,GroupCampDraftResult256,void> {
 const root=registeredCampaign(input),permission=groupEntryActions(root,groupId)[mode];
 const blocked=(phase:string,reason:string):GroupCampDraftResult256=>({status:'blocked',phase,reason});
 if(!permission.ok)return blocked('entry-preflight',permission.reason??'Actual Camp entry refused');
 if(!isSchema256Or257(root.schemaVersion)||root.planet?.revision!==3||!root.worldFactions||!root.worldMaps||!root.worldGroups)return blocked('entry-preflight','Actual Planet3 campaign authority required');
 if(!runtime||!runtime.context||!runtime.angular||!Array.isArray(runtime.adjacentPermutation)||runtime.adjacentPermutation.length!==8||!runtime.fog||!Array.isArray(runtime.fog.rootsToUnfog)||!Number.isSafeInteger(runtime.animalRuntimeRng)||runtime.animalRuntimeRng<1||runtime.animalRuntimeRng>0xffffffff)return blocked('runtime-preflight','Actual shared Camp generation runtime is unavailable; no default order or RNG is supplied');
 const maps=root.worldMaps,groups=root.worldGroups,record=groups.groups.find(r=>r.state.id===groupId),g=record?.state;
 if(!record||!g||!('members'in g))return blocked('entry-preflight','Actual away group required');
 const planet=root.planet,geography=planet.geography,tile=g.tile,calendarOrigin=maps.calendarOrigin;
 // Read authoritative CAMPAIGN_FIELDS, not a group projection's local header.
 const campaign=Object.fromEntries(CAMPAIGN_FIELDS.filter(k=>Object.hasOwn(root,k)).map(k=>[k,root[k]])) as Pick<World,CampaignField>&{schemaVersion:256|257|258|259|260|261|262|263|264|265|266|267|268|269|270|271|272|273|274|275|276|277|278|279|280|281|282|283|284|285|286|287|288|289|290|291|292|293|294|295|296|297|298|299|300|301|302;planet:typeof planet;worldFactions:NonNullable<World['worldFactions']>};
 const captured=sharedMutableStamp(root),planetStamp=planetScalarStamp(planet),mapStamp=mapRegistryStamp(root),groupStamp=JSON.stringify(g),sites=maps.sites.slice();
 const retained=captureCampRetainedAnimals256(root),retainedStamp=JSON.stringify(retained);
 const runtimeStamp=JSON.stringify({adjacent:runtime.adjacentPermutation,fog:runtime.fog,context:runtime.context,rng:runtime.animalRuntimeRng});
 const current=(input:CampaignState)=>{try{return registeredCampaign(input)===root&&root.worldMaps===maps&&root.worldGroups===groups&&root.planet===planet&&planet.geography===geography&&planetScalarStamp(planet)===planetStamp
  &&groups.groups.find(r=>r.state.id===groupId)===record&&record.state===g&&JSON.stringify(g)===groupStamp
  &&sites.length===maps.sites.length&&sites.every((s,i)=>s===maps.sites[i])&&mapRegistryStamp(root)===mapStamp
  &&sharedMutableStamp(root)===captured&&JSON.stringify(retained)===retainedStamp
  &&JSON.stringify({adjacent:runtime.adjacentPermutation,fog:runtime.fog,context:runtime.context,rng:runtime.animalRuntimeRng})===runtimeStamp
  &&(()=>{const now=captureCampRetainedAnimals256(root);return now.length===retained.length&&now.every((a,i)=>a===retained[i]);})()
  &&groupEntryActions(root,groupId)[mode].ok;}catch{return false;}};
 // These labels describe this actual capture only; preflight additionally
 // checks the scalar frontier. They never fabricate external provenance.
 const provenance={source:mode==='camp'?'actual ordered group Camp capture':'actual ordered group settlement capture',atTick:root.tick,nextId:root.nextId,tile};
 // This Core-only campaign starts at TicksGame0 and has no NewColony quest
 // reset producer. Ordinary settling does NOT reset TickManager's clock.
 // The closed profile therefore retains the actual initial settleTick0;
 // never substitute this Camp's createdAt or add elapsed travel twice.
 const daysPassedSinceSettle=Math.floor(root.tick/6000);
 const common={campaign,tile,calendarOrigin,provenance,daysPassedSinceSettle,
  angular:runtime.angular,context:runtime.context,chunks:{adjacentPermutation:runtime.adjacentPermutation,provenance},
  animals:{pawnKindOrder:CORE_4871_PAWN_KIND_ORDER,unspawned:retained,runtimeRng:runtime.animalRuntimeRng,provenance},
  fog:{...runtime.fog,provenance},...(runtime.monumentCatalogue?{monumentCatalogue:runtime.monumentCatalogue}:{})};
 let settlement:{size:GeographicCreationSize262;dimensions:Readonly<{width:number;height:number}>;lordIds:ReturnType<typeof captureCampaignLordIds256>;casketGroupIds:ReturnType<typeof captureAncientCasketGroupIds256>}|undefined;
 try{if(mode==='settle'){if(!validGeographicCreationSize262(maps.mapSize.width)||!validGeographicSettlementDimensions262(root.schemaVersion,maps.mapSize.width,maps.mapSize.height,maps.mapSize))return blocked('settlement-size','La réinstallation doit conserver la taille carrée de colonie configurée.');settlement={size:maps.mapSize.width,dimensions:Object.freeze({...maps.mapSize}),lordIds:captureCampaignLordIds256(root),casketGroupIds:captureAncientCasketGroupIds256(root)};}}catch(error){return blocked('settlement-allocators',error instanceof Error?error.message:String(error));}
 const generator=settlement?assembleSettlementMap257({...common,size:settlement.size,settlement}):assembleEncounterCamp256({...common,size:200});
 let result:CampMapResult256;
 try {
  for(;;){if(!current(root))return blocked('stale-capture','Camp source changed before adoption');const step=generator.next();if(step.done){result=step.value;break;}yield step.value;}
 }finally {generator.return({status:'blocked',phase:'cancelled',reason:'Unpublished Camp generation discarded'});}
 if(result.status==='blocked')return result;
 if(!current(root))return blocked('stale-capture','Camp source changed before adoption');
 const w=result.world;
 // WaterInfo is the exact produced float map, packed once. No load reroll.
 if(result.riverFlow&&!w.riverWater)throw Error('Actual Camp factory omitted its produced river owner');
 const wildlife=w.wildlife!,draftAnimals=wildlife.animals,worldAnimals=result.worldAnimalGeneration,body=captureSecondaryMap(w);
 const currentWithAnimals=(input:CampaignState)=>current(input)&&worldAnimals.current()&&Object.getOwnPropertyDescriptor(w,'wildlife')?.value===wildlife&&Object.getOwnPropertyDescriptor(body,'wildlife')?.value===wildlife&&Object.getOwnPropertyDescriptor(wildlife,'animals')?.value===draftAnimals&&campAnimalArrayWritable256(wildlife);
 const generatedWild=new Set(worldAnimals.candidateAnimals),otherAnimals=draftAnimals.filter(a=>!generatedWild.has(a));
 const adoptWorldAnimals=()=>{if(!currentWithAnimals(root))throw Error('Stale local-map WorldPawn adoption');wildlife.animals=[...otherAnimals,...worldAnimals.commit()];};
 return {status:'ready',groupId,...settlement?{settlement:{size:settlement.size,nextLordId:settlement.lordIds.nextId,nextAncientCasketGroupId:settlement.casketGroupIds.nextId}}:{},current:currentWithAnimals,adoptWorldAnimals,draft:{site:{revision:1,tile,createdAt:root.tick,selected:false,map:body,visit:null},nextId:result.nextId},
  runtimeAfter:{initialGrowth:result.initialGrowth,adjacentPermutation:result.adjacentPermutation,adjacentUses:result.adjacentUses,...result.edgeContext?{edgeContext:result.edgeContext}:{},initialization:result.initialization,steps:result.steps}};
}
