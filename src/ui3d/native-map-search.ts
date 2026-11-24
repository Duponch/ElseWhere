import type {Cell,MaterialOwner,MaterialPile,World} from '../sim/types';
import type {NativePage,NativeRow} from './native-contract';
import type {MapObjectSelection} from '../ui/map-object-selection';
import {mapResourceSelectable} from '../ui/map-object-selection';
import {selectableMapJobs296} from '../ui/wall-door-selection-296';
import {knownPosition256} from '../ui/exploration-readers-256';
import {buildingLabels} from '../ui/building-labels';
import {rockThingLabel} from '../ui/geology-inspection';
import {animalSpecies} from '../sim/animal-species';
import {actualAnimalName256} from '../sim/starting-pet-state-256';
import {floraDefinition} from '../sim/biome-flora';
import {PLANT_DEFINITIONS} from '../sim/plants';
import {ITEM_DEFINITIONS} from '../sim/items';
import {isColonist} from '../sim/affiliation';
import {carrierOf} from '../sim/rescue-state';
import {mechanoidDefinition} from '../sim/mechanoid-definition';
import {weaponLabel} from '../sim/equipment-rules';
import {apparelLabel} from '../sim/apparel-rules';
import {animalTitle,buildingTitle,itemTitle,wildPlantTitle} from '../lore/lore-text';
import {NATIVE_MAP_SEARCH} from './native-map-search-metrics';

export type NativeMapSearchTarget=
 |{kind:'pawn'|'animal'|'mechanoid';id:number;cell:Cell}
 |{kind:'object';object:MapObjectSelection;cell:Cell}
 |{kind:'cell';cell:Cell};
export interface NativeMapSearchResult {
 key:string;label:string;definitionLabel:string;icon?:string;holder?:'inventory'|'container';target:NativeMapSearchTarget;
}
type Location={target:NativeMapSearchTarget;holder?:NativeMapSearchResult['holder']};
const cell=(value:Cell):Cell=>({x:value.x,z:value.z});
const objectTarget=(kind:MapObjectSelection['kind'],id:number,at:Cell):NativeMapSearchTarget=>({kind:'object',object:{kind,id},cell:cell(at)});
const clean=(value:string)=>value.replace(/<[^>]*>/g,'');
/** Core TextMatch uses one case-insensitive substring, not word tokens. */
export function nativeMapSearchMatches(label:string,definitionLabel:string,query:string):boolean {
  if(!query)return false;const needle=query.toLowerCase();
  return clean(label).toLowerCase().includes(needle)||clean(definitionLabel).toLowerCase().includes(needle);
}

/** Read-only projection of spawned Things and their permitted contents.
 * Build owner indices once per capture: the large flora/rock sets never
 * trigger a pile, pawn or structure search per result. Ancient closed caskets,
 * off-map cargo, unknown cells, zones and bare terrain are never enumerated. */
function projectNativeMapSearch(world:World,query:string,onlyKey?:string):NativeMapSearchResult[] {
  if(!query)return [];
  const needle=query.toLowerCase(),textMatches=new Map<string,boolean>();
  const matches=(label:string,definition:string)=>{const key=label+'\0'+definition,prior=textMatches.get(key);if(prior!==undefined)return prior;const found=clean(label).toLowerCase().includes(needle)||clean(definition).toLowerCase().includes(needle);textMatches.set(key,found);return found;};
  const wanted=onlyKey?.split(':')[0],include=(kind:string)=>!wanted||kind===wanted;
  const results:NativeMapSearchResult[]=[],seen=new Set<string>(),pawns=new Map(world.pawns.map(p=>[p.id,p])),animals=new Map(world.wildlife?.animals.map(a=>[a.id,a])??[]);
  const structures=new Map(world.structures.map(s=>[s.id,s])),piles=new Map(world.piles.map(p=>[p.id,p]));
  const add=(key:string,label:string,definitionLabel:string,location:Location|undefined,icon?:string)=>{
    if(onlyKey&&key!==onlyKey||!location||seen.has(key)||!matches(label,definitionLabel)||!knownPosition256(world,location.target.cell))return;
    seen.add(key);results.push({key,label:clean(label),definitionLabel:clean(definitionLabel),icon,holder:location.holder,target:location.target});
  };
  const ownStructure=(id:number)=>{const s=structures.get(id);return s&&(s.factionId===undefined||s.factionId===world.worldFactions?.playerFactionId)?s:undefined;};
  const humanLocations=new Map<number,Location>();
  const humanLocation=(id:number):Location|undefined=>{
    if(humanLocations.has(id))return humanLocations.get(id);
    const pawn=pawns.get(id);if(!pawn||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)return;
    if(pawn.state==='dead'){
      if(pawn.body?.lostAt!==undefined||pawn.body?.pileId===undefined)return;
      const body=piles.get(pawn.body.pileId);if(!body)return;
      // A corpse's contents are searchable even when its original faction
      // was foreign; they still focus the actual body or its container.
      const location=ownerLocation(body.owner,body.id);if(location)humanLocations.set(id,location);return location;
    }
    const carrier=carrierOf(world,id),at=carrier??pawn;
    if(!knownPosition256(world,at))return;
    const location:Location={target:{kind:'pawn',id:at.id,cell:cell(at)},holder:carrier?'inventory':undefined};humanLocations.set(id,location);return location;
  };
  const ownerLocation=(owner:MaterialOwner,thingId:number,packed=false):Location|undefined=>{
    if(owner.type==='ground')return{target:objectTarget(packed?'packed':'pile',thingId,owner)};
    if(owner.type==='grave'||owner.type==='egg-box374'){
      const id=owner.type==='grave'?owner.graveId:owner.structureId,s=ownStructure(id);
      return s?{target:objectTarget('structure',id,s),holder:'container'}:undefined;
    }
    if(!('pawnId'in owner))return;
    const pawn=pawns.get(owner.pawnId);
    if(pawn){
      if(pawn.state!=='dead'&&!isColonist(pawn))return;
      const location=humanLocation(pawn.id);return location?{...location,holder:'inventory'}:undefined;
    }
    const animal=owner.type==='inventory'?animals.get(owner.pawnId):undefined;
    return animal?.domestic&&animal.state!=='dead'&&animal.shipCryptosleepHeldAt277===undefined?{target:{kind:'animal',id:animal.id,cell:cell(animal)},holder:'inventory'}:undefined;
  };
  const addPile=(pile:MaterialPile,location:Location|undefined)=>{
    if(pile.quantity<=0)return;
    const def=itemTitle(pile.item,ITEM_DEFINITIONS[pile.item].label),person=pile.humanCorpse?pawns.get(pile.humanCorpse.pawnId):undefined;
    const name=person?`Cadavre de ${person.name}`:pile.corpse?`Cadavre de ${animalTitle(pile.corpse.species,animalSpecies(pile.corpse.species).label)}`:pile.book?.title??(pile.weapon?weaponLabel(pile):pile.apparel?apparelLabel(pile):def);
    // Quantity is displayed but deliberately excluded from TextMatch.
    if(!matches(name,def))return;
    add(`pile:${pile.id}`,`${name}${pile.quantity>1?` ×${pile.quantity}`:''}`,def,location,`item-${pile.item}`);
  };
  if(include('pawn'))for(const pawn of world.pawns)if(pawn.state!=='dead')add(`pawn:${pawn.id}`,pawn.name,'Humain',humanLocation(pawn.id),'colon');
  if(include('animal'))for(const animal of animals.values())if(animal.state!=='dead'&&animal.shipCryptosleepHeldAt277===undefined){const species=animalTitle(animal.species,animalSpecies(animal.species).label);add(`animal:${animal.id}`,actualAnimalName256(animal)??species,species,{target:{kind:'animal',id:animal.id,cell:cell(animal)}},animal.species);}
  if(include('mechanoid'))for(const mech of world.mechanoids??[])if(mech.state!=='dead'&&mech.shipCryptosleepHeldAt277===undefined){const label=mechanoidDefinition(mech.mechKind).label;add(`mechanoid:${mech.id}`,label,label,{target:{kind:'mechanoid',id:mech.id,cell:cell(mech)}},mech.mechKind);}
  for(const structure of world.structures){
    const label=buildingTitle(structure.kind,buildingLabels[structure.kind]);if(include('structure'))add(`structure:${structure.id}`,label,label,{target:objectTarget('structure',structure.id,structure)},structure.kind);
    if(!ownStructure(structure.id)||!knownPosition256(world,structure))continue;
    const holder:Location={target:objectTarget('structure',structure.id,structure),holder:'container'};
    // Player caskets own their real contents outside the spawned arrays.
    // The ancient `casket` field is intentionally never visited.
    const storage=structure.cryptosleep??structure.shipCryptosleep277;
    if(storage){
      const occupant='human'in storage?storage.human:storage.occupant?.kind==='human'?storage.occupant.pawn:undefined;
      if(occupant)add(`pawn:${occupant.id}`,occupant.name,'Humain',holder,'colon');
      if('occupant'in storage&&storage.occupant?.kind==='animal'){const a=storage.occupant.animal,label=animalTitle(a.species,animalSpecies(a.species).label);add(`animal:${a.id}`,actualAnimalName256(a)??label,label,holder,a.species);}
      if('occupant'in storage&&storage.occupant?.kind==='mechanical'){const a=storage.occupant.mech,label=mechanoidDefinition(a.mechKind).label;add(`mechanoid:${a.id}`,label,label,holder,a.mechKind);}
      for(const pile of storage.items)addPile(pile,holder);
      for(const pack of storage.packed){const label=buildingTitle(pack.building.kind,buildingLabels[pack.building.kind]);add(`packed:${pack.building.id}`,`${label} (minifié)`,label,holder,pack.building.kind);}
    }
  }
  if(include('pile'))for(const pile of world.piles)if(!onlyKey||onlyKey===`pile:${pile.id}`)addPile(pile,ownerLocation(pile.owner,pile.id));
  if(include('packed'))for(const pack of world.packed){const label=buildingTitle(pack.building.kind,buildingLabels[pack.building.kind]);add(`packed:${pack.building.id}`,`${label} (minifié)`,label,ownerLocation(pack.owner,pack.building.id,true),pack.building.kind);}
  if(include('resource'))for(const resource of world.resources)if((!onlyKey||onlyKey===`resource:${resource.id}`)&&mapResourceSelectable(resource)){
    const label=resource.species?wildPlantTitle(resource.species,floraDefinition(resource)?.label??resource.species):resource.kind in PLANT_DEFINITIONS?PLANT_DEFINITIONS[resource.kind as keyof typeof PLANT_DEFINITIONS].label:resource.kind==='tree'?'Arbre':resource.kind==='rock'?'Rochers':resource.kind;
    add(`resource:${resource.id}`,label,label,{target:objectTarget('resource',resource.id,resource)},resource.kind);
  }
  if(include('rock'))for(let id=onlyKey?Number(onlyKey.slice(5)):0,end=onlyKey?id+1:world.tiles.length;id<end;id++){const tile=world.tiles[id];if(tile?.terrain!=='rock')continue;const at={x:id%world.width,z:Math.floor(id/world.width)};if(!knownPosition256(world,at))continue;const label=rockThingLabel(tile);add(`rock:${id}`,label,label,{target:objectTarget('rock',id,at)},'rock');}
  if(include('job'))for(const job of selectableMapJobs296(world))if(job.kind in buildingLabels){const def=buildingTitle(job.kind,buildingLabels[job.kind as keyof typeof buildingLabels]);add(`job:${job.id}`,`${def} (${job.construction==='frame'?'cadre':'plan'})`,def,{target:objectTarget('job',job.id,job)},job.kind);}
  if(include('geyser'))for(const geyser of world.geysers?.items??[])add(`geyser:${geyser.id}`,'Geyser de vapeur','Geyser de vapeur',{target:objectTarget('geyser',geyser.id,geyser)},'geyser');
  if(results.length<2)return results;
  const compare=new Intl.Collator('en').compare,lower=new Map<string,string>();
  const normalized=(label:string):string=>{let text=lower.get(label);if(text===undefined){text=label.toLowerCase();lower.set(label,text);}return text;};
  return results.sort((a,b)=>compare(normalized(a.label),normalized(b.label))||compare(a.key,b.key));
}
export function searchNativeMap(world:World,query:string):NativeMapSearchResult[]{return projectNativeMapSearch(world,query);}

export interface NativeMapSearchState {world?:World;epoch?:number;publicationRevision?:number;mapId?:number|string;mapVisible:boolean}
export interface NativeMapSearchOptions {
 readState:()=>NativeMapSearchState;showPage:(page:NativePage)=>void;isCurrentPage:(page:NativePage)=>boolean;
 focus:(target:NativeMapSearchTarget)=>void;preview?:(target:NativeMapSearchTarget|undefined)=>void;
 close:()=>void;
 /** Injected presentation clock; refresh also accepts an explicit timestamp. */
 now?:()=>number;
}
const mapIdentity=(s:NativeMapSearchState)=>s.mapId??(s.world?.campaignMap?.revision===2?s.world.campaignMap.activeMapId:s.world?.campaignMap?.active??'local');

/** Modeless controller owned by Main. No timer, command or persistent state.
 * Main may call refresh per frame: only an accepted publication, at most twice
 * a second, can trigger a capture. Typing recaptures once for that user edit. */
export function createNativeMapSearch(options:NativeMapSearchOptions){
 let active=false,query='',page:NativePage|undefined,scope:ReturnType<typeof mapIdentity>,epoch:number|undefined,seed:number|undefined;
 let generation=0,lastAt=-Infinity,lastWorld:World|undefined,lastRevision:number|undefined,lastTick:number|undefined,results:NativeMapSearchResult[]=[];
 const now=()=>options.now?.()??performance.now();
 const current=()=>active&&!!page&&options.isCurrentPage(page);
 const valid=(s:NativeMapSearchState)=>!!s.world&&s.mapVisible&&mapIdentity(s)===scope&&s.epoch===epoch&&s.world.seed===seed;
 const close=()=>{const visible=current();active=false;generation++;page=undefined;results=[];options.preview?.(undefined);if(visible)options.close();};
 const state=()=>{if(!current())return;const s=options.readState();if(!valid(s)){close();return;}return s as NativeMapSearchState&{world:World};};
 const capture=(s:NativeMapSearchState&{world:World},at:number)=>{results=searchNativeMap(s.world,query);lastAt=at;lastWorld=s.world;lastRevision=s.publicationRevision;lastTick=s.world.tick;};
 const show=()=>{
   const token=generation;
   const guarded=()=>token===generation?state():undefined;
   const search=(value:string)=>{const s=guarded();if(!s)return false;const next=value.slice(0,160);if(next===query)return true;query=next;options.preview?.(undefined);capture(s,now());show();return true;};
   const select=(key:string,hover=false)=>{const s=guarded();if(!s)return;const fresh=projectNativeMapSearch(s.world,query,key)[0];if(fresh){if(hover)options.preview?.(fresh.target);else options.focus(fresh.target);}else{options.preview?.(undefined);capture(s,now());show();}};
   const rows:NativeRow[]=results.map((result,index)=>({id:`map-search-${result.key}`,label:result.label,region:'catalogue',hint:result.holder?`${result.label}\n${result.holder==='inventory'?'Dans les possessions du détenteur':'Dans un contenant'}`:result.label,mapSearchEntry:{index,icon:result.icon,holder:result.holder},controls:[{id:`map-search-focus-${result.key}`,label:result.label,hint:`Voir ${result.label}`,onActivate:()=>select(result.key),onHover:hovered=>{if(!guarded())return;if(hovered&&options.preview)select(result.key,true);else options.preview?.(undefined);}}]}));
   rows.push({id:'map-search-status',label:query?`${results.length} résultat${results.length===1?'':'s'}`:'Rechercher sur la carte',region:'toolbar',emphasis:'muted'},
    {id:'map-search-input',label:'',region:'toolbar',input:{value:query,placeholder:'Rechercher sur la carte',maxLength:160,onChange:search,onCommit:search}});
   page={id:'map-search',title:'Rechercher sur la carte',layout:'map-search',modal:false,width:NATIVE_MAP_SEARCH.width,mapSearchCount:results.length,contentKey:query,rows,closeOwnsNavigation:true,onClose:()=>{if(guarded())close();}};options.showPage(page);
 };
 return {
   open(){const s=options.readState();if(!s.world||!s.mapVisible)return false;if(current())return true;active=true;generation++;query='';scope=mapIdentity(s);epoch=s.epoch;seed=s.world.seed;capture(s as NativeMapSearchState&{world:World},now());show();return true;},
   close,
   refresh(at=now()){
     if(!active)return false;if(!current()){active=false;generation++;page=undefined;results=[];options.preview?.(undefined);return false;}
     const s=state();if(!s)return false;
     const changed=s.publicationRevision!==undefined?s.publicationRevision!==lastRevision:s.world!==lastWorld||s.world.tick!==lastTick;
     if(!changed||at-lastAt<NATIVE_MAP_SEARCH.refreshMs)return false;
     const previous=results;capture(s,at);options.preview?.(undefined);
     // Row callbacks revalidate the live owner/location by key. Identical
     // painted rows need no second page or mesh rebuild on a new snapshot.
     if(previous.length!==results.length||results.some((r,i)=>{const p=previous[i]!;return r.key!==p.key||r.label!==p.label||r.holder!==p.holder||r.icon!==p.icon;}))show();return true;
   },
   get isOpen(){return current();},get value(){return query;},get results():readonly NativeMapSearchResult[]{return results;},get page(){return page;},
 };
}
