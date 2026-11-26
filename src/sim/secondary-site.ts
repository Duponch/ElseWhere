import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {markPileMembershipChanged,appendPileEntries} from './pile-identity-directory.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {newCorePathBudget297} from './core-path-budget-297.ts';
import {createDeteriorationState} from './deterioration-content.ts';
import { campaignAuthority,captureSecondaryMap,flushSecondaryContext,isSecondaryContext,secondaryContext } from './secondary-site-context.ts';
import { secondaryCommand,type SecondarySite,type SecondarySiteCommand } from './secondary-site-state.ts';
import { generateSiteWorld } from './site-generation.ts';
import { resolveSite } from './site.ts';
import { isPlant } from './plants.ts';
import { createPlantLife } from './plant-life.ts';
import { climateTick,planetTileClimateDefinition } from './site-climate.ts';
import { adoptWeather } from './weather.ts';
import { adoptWind } from './wind.ts';
import {ensureFilth} from './filth-rules.ts';
import { ensureFireState } from './fire-rules.ts';
import { newBreakdownCalendar } from './breakdowns.ts';
import { createApparelWearCalendar } from './apparel-renewal.ts';
import { enableBiomeWildlife } from './wildlife.ts';
import { initializeSnowSurface } from './snow-surface.ts';
import { adoptColonyEconomy } from './colony-economy.ts';
import { adoptFluIncidents } from './flu-incidents.ts';
import { captureCivilianReturnFinder } from './civilian-return.ts';
import { captureHumanOwners } from './human-owners.ts';
import { longitudeOffsetCore } from './planet-navigation.ts';
import { tileCoordinates } from './planet-generation.ts';
import { localSeedForTile } from './starting-world.ts';
import { refreshStock } from './materials.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';

const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const log=(root:World,message:string)=>{root.events.push({tick:root.tick,type:'command',message});if(root.events.length>80)root.events.splice(0,root.events.length-80);};

/** A fresh landscape is drafted without changing the campaign. No scenario
 * factory, starting people, goods, research, old-map replay or random draw. */
export function draftSite(root:World,tileId:number,kind:'camp'|'settlement'='camp'):{site:SecondarySite;nextId:number}|undefined {
  // This function is the literal legacy landscape adapter. ROOT must wire
  // generateGeographicSiteWorld256 before enabling fresh Planet3 map entry.
  const planet=root.planet;if(!planet||planet.revision===3)return undefined;const tile=planet.tiles[tileId];
  if(!tile||tile.biome==='ocean'||tile.hilliness==='mountainous')return undefined;
  const seed=localSeedForTile(planet.generationSeed,tileId),site=resolveSite(seed,{biome:tile.biome,hilliness:tile.hilliness});
  const generated=generateSiteWorld(seed,root.width,root.height,site),offset=root.nextId-1;
  if(!Number.isSafeInteger(generated.nextId+offset))return undefined;
  initializeSnowSurface(generated);
  const homeLongitude=tileCoordinates(planet.tiles[planet.homeTile]!).longitude;
  const calendarOffset=(longitudeOffsetCore(tileCoordinates(tile).longitude)-longitudeOffsetCore(homeLongitude))/10;
  generated.tick=root.tick;if(isCorePhysicalSchema297(Number(root.schemaVersion)))generated.corePathBudget297=newCorePathBudget297(root.tick);else delete generated.corePathBudget297;generated.site=site;generated.expeditionSite={tile:tileId,createdAt:root.tick,calendarOffset};
  generated.snow!.adoptedAt=root.tick;generated.snow!.lastTick=root.tick;
  generated.deterioration=createDeteriorationState(seed,root.tick);
  for(const collection of [generated.resources,markPileMembershipChanged(generated.piles)])for(const item of collection)markPileContentWrite379(item).id+=offset;
  generated.nextId+=offset;
  enableBiomeWildlife(generated,tile.biome);
  for(const plant of generated.resources)if(isPlant(plant)){plant.growthTick=root.tick;plant.plantLife=createPlantLife(generated,plant);}
  if(generated.flora?.revision===1){generated.flora.adoptedAt=root.tick;generated.flora.nextCheck=root.tick+60;}
  generated.breakdown=newBreakdownCalendar(seed,root.tick);
  generated.apparelWear=createApparelWearCalendar(root.tick,(seed^0x0a77e1)>>>0);
  const definition=planetTileClimateDefinition(tile);
  generated.climate={revision:3,adoptedAt:root.tick,
    calendarOrigin:(root.worldMaps?root.worldMaps.calendarOrigin+root.tick:climateTick(root))+calendarOffset,definition};
  adoptWeather(generated);adoptWind(generated);ensureFireState(generated);
  adoptColonyEconomy(generated);
  // A Cassandra map must own its prospective disease calendar even while
  // paused immediately after entry. The shared profile is not a local field
  // and captureSecondaryMap discards this temporary reference.
  if(root.gameProfile){generated.gameProfile=root.gameProfile;adoptFluIncidents(generated);}
  return {site:{revision:1,tile:tileId,createdAt:root.tick,selected:false,map:captureSecondaryMap(generated),visit:null},nextId:generated.nextId};
}

/** The public transaction accepts only the group that ACTUALLY finished its
 * route. It transfers original references after every placement is admitted. */
export function enterSecondarySite(root:World):CommandResult {
  root=campaignAuthority(root);const g=root.group;
  if(!root.planet||!g||g.phase!=='at-site'||!('members' in g)||g.segment||g.tile!==g.destination||g.tile===root.planet.civilianTile)return fail('Faites arriver le groupe sur une case terrestre libre avant d’entrer.');
  if(root.secondarySite?.visit)return fail('Une expédition est déjà présente sur le second site.');
  if(root.secondarySite&&root.secondarySite.tile!==g.tile)return fail('Cette première boucle conserve un seul second site.');
  let draft:ReturnType<typeof draftSite>;
  if(!root.secondarySite){draft=draftSite(root,g.tile);if(!draft)return fail('Le relief de cette destination ne permet pas encore une carte locale.');}
  // Draft admission reads its own empty map; the actual campaign is untouched.
  const site=root.secondarySite??draft!.site;
  const admission={...site.map,...Object.fromEntries(['tick','nextId','schemaVersion','rng','foodRules','restRules'].map(k=>[k,(root as unknown as Record<string,unknown>)[k]]))} as World;
  const find=captureCivilianReturnFinder(admission),used=new Set<number>(),placements:{pawn:Pawn;cell:Cell}[]=[];
  if(site.map.pawns.length+g.members.length>root.width*root.height||site.map.piles.length+g.items.length>32768)return fail('La carte distante ne peut pas accueillir tout le groupe et ses biens.');
  for(const pawn of g.members){const cell=find(g.entry,c=>!used.has(c.z*admission.width+c.x));if(!cell)return fail('Le groupe attend un bord accessible sur le second site.');used.add(cell.z*admission.width+cell.x);placements.push({pawn,cell});}
  try{captureHumanOwners(root);}catch{return fail('Le registre des personnes ne permet pas ce transfert.');}
  // Closed adoption: no operation below can refuse or allocate a Thing.
  if(draft){root.secondarySite=draft.site;root.nextId=draft.nextId;}
  for(const {pawn,cell} of placements){pawn.x=cell.x;pawn.z=cell.z;pawn.path=[];pawn.moveCooldown=0;pawn.planCooldown=0;delete pawn.motion;delete pawn.allowedAreaId;if(pawn.state!=='downed')pawn.state='idle';}
  site.map.pawns.push(...g.members);appendPileEntries(site.map.piles,...g.items);
  site.visit={groupId:g.id,memberIds:g.members.map(p=>p.id),homeEntry:{...g.entry}};
  site.selected=true;delete root.group;
  // A cached context can exist on a revisit; update its replaced containers.
  const local=secondaryContext(root)!;local.pawns=site.map.pawns;local.piles=site.map.piles;
  const pending=g.items.filter(i=>i.owner.type==='inventory').map(i=>i.id);
  if(pending.length)local.group={id:g.id,startedAt:g.startedAt,destination:site.tile,ledger:g.ledger,...g.provisions?{provisions:g.provisions}:{},...g.freight?{freight:g.freight}:{},phase:'unloading',memberIds:g.members.map(p=>p.id),pendingPileIds:pending};
  // Personal carried soil keeps its original record across map entry.
  ensureFilth(local);refreshStock(local);flushSecondaryContext(root);
  log(root,'L’expédition entre sur le second site. Les deux cartes suivent la même horloge ; leurs habitants et biens restent distincts.');
  return {ok:true};
}

export function applySecondarySiteCommand(world:World,c:SecondarySiteCommand):CommandResult {
  if(!secondaryCommand(c))return fail('Commande de site invalide.');
  const root=campaignAuthority(world);
  if(c.type==='secondary-enter')return enterSecondarySite(root);
  if(c.site==='secondary'&&!root.secondarySite)return fail('Aucune seconde carte n’a encore été visitée.');
  if(root.secondarySite)root.secondarySite.selected=c.site==='secondary';return {ok:true};
}

/** Local formation/loading/unloading reuse the genuine group driver. Only
 * the home context owns off-map route execution and commercial exchanges. */
export function secondaryLocalGroupAllowed(world:World,type:string):boolean {
  return !isSecondaryContext(world)||type==='group-start'||type==='group-unload'||type==='group-cancel';
}
