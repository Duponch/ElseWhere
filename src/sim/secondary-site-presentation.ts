import {registeredMapPresentation,registeredMapPresentationView} from './world-map-presentation.ts';
import {validRegisteredPresentation} from './world-map-projection-save.ts';
import {alertManhunter,alertDownedColonist} from './status-alert-rules.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import { captureHumanOwners } from './human-owners.ts';
import { campaignAuthority,otherCampaignMap,selectedMap } from './secondary-site-context.ts';
import { validExpeditionOrigin } from './secondary-site-save.ts';
import type { World } from './types.ts';
import type { RelationshipPerson } from './relationship-state.ts';
import {activeThreat} from './affiliation.ts';

export interface CampaignIncident {site:'home'|'secondary';kind:'raid'|'mechanoid'|'visitor'|'manhunter'|'downed';count:number;actorId:number}
/** Bounded summary only: no inactive cells, terrain, jobs or actor list.
 * Derived at confirmed tick/snapshot boundaries, never by the image loop. */
export function otherMapIncidents(world:World):CampaignIncident[] {
  const root=campaignAuthority(world),other=otherCampaignMap(world);if(!other)return [];
  const site=other===root?'home':'secondary',rows:CampaignIncident[]=[];
  let raidCount=0,raidId=Infinity,visitorCount=0,visitorId=Infinity,mechCount=0,mechId=Infinity;
  for(const p of other.pawns){
    if(p.faction==='outlaws'&&!p.prisoner&&activeThreat(p)){raidCount++;raidId=Math.min(raidId,p.id);}
    if(p.visitor&&p.visitor.phase!=='leaving'&&p.state!=='dead'&&p.state!=='downed'){visitorCount++;visitorId=Math.min(visitorId,p.id);}
  }
  for(const m of other.mechanoids??[])if(m.state!=='dead'&&m.state!=='downed'){mechCount++;mechId=Math.min(mechId,m.id);}
  if(raidCount)rows.push({site,kind:'raid',count:raidCount,actorId:raidId});
  if(mechCount)rows.push({site,kind:'mechanoid',count:mechCount,actorId:mechId});
  if(visitorCount)rows.push({site,kind:'visitor',count:visitorCount,actorId:visitorId});
  if(root.schemaVersion>=252){
    let manhunterCount=0,manhunterId=Infinity,downedCount=0,downedId=Infinity;
    for(const a of other.wildlife?.animals??[])if(alertManhunter(a)){manhunterCount++;manhunterId=Math.min(manhunterId,a.id);}
    for(const p of other.pawns)if(alertDownedColonist(p)){downedCount++;downedId=Math.min(downedId,p.id);}
    if(manhunterCount)rows.push({site,kind:'manhunter',count:manhunterCount,actorId:manhunterId});
    if(downedCount)rows.push({site,kind:'downed',count:downedCount,actorId:downedId});
  }
  return rows;
}

const projections=new WeakMap<World,{source:World;view:World}>();
/** Publish the selected genuine map, plus cross-map KNOWLEDGE only. Inactive
 * terrain/resources/jobs/piles never enter its snapshots or per-frame render.
 * Switching source creates a new stable projection, using the existing epoch
 * replacement path. Current campaign save remains the complete authority. */
export function campaignPresentation(world:World):World {
  if(world.worldMaps){const view=registeredMapPresentation(world);if(!view)throw Error('Campaign has no selected local map');return view;}
  const root=campaignAuthority(world);if(!root.secondarySite)return root;
  const source=selectedMap(root);let cached=projections.get(root);
  if(!cached||cached.source!==source){cached={source,view:{} as World};projections.set(root,cached);}
  const target=cached.view as unknown as Record<string,unknown>;
  const keys=new Set(Object.keys(source).filter(k=>!['secondarySite','campaignPeople','campaignMap'].includes(k)));
  for(const key of Object.keys(target))if(!keys.has(key))delete target[key];
  for(const key of keys)target[key]=(source as unknown as Record<string,unknown>)[key];
  const other=otherCampaignMap(source)!;
  cached.view.campaignPeople=[...captureHumanOwners(other,{},false).people.values()].map((person):RelationshipPerson=>({...person,status:person.status==='present'?'away':person.status}));
  cached.view.campaignMap={active:source===root?'home':'secondary',secondaryTile:root.secondarySite.tile,
    createdAt:root.secondarySite.createdAt,visitIds:[...root.secondarySite.visit?.memberIds??[]],
    ...root.schemaVersion>=242?{incidents:otherMapIncidents(source)}:{}};
  return cached.view;
}

/** The object campaignPresentation() returns for the selected map, when that
 * projection already exists; its fields are NOT refreshed here. For an identity
 * check only: every reader of its contents calls campaignPresentation. */
export function campaignPresentationView(world:World):World|undefined {
  if(world.worldMaps)return registeredMapPresentationView(world);
  const root=campaignAuthority(world);if(!root.secondarySite)return root;
  const cached=projections.get(root);return cached&&cached.source===selectedMap(root)?cached.view:undefined;
}

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);

/** Snapshot-only domains are rejected by saved-world guards. References here
 * prove no physical ownership and are never inserted into byId/pawnOwners. */
export function validCampaignPresentation(w:Pick<World,'schemaVersion'|'tick'|'nextId'|'width'|'height'|'pawns'|'mechanoids'|'wildlife'|'planet'|'expeditionSite'|'campaignPeople'|'campaignMap'> & {secondarySite?:unknown}):boolean {
  const raw=w as unknown as Record<string,unknown>;
  if(w.schemaVersion>=255)return validRegisteredPresentation(w as World);
  if(Object.hasOwn(raw,'secondarySite'))return false;
  if(w.schemaVersion<240)return !['expeditionSite','campaignPeople','campaignMap'].some(k=>Object.hasOwn(raw,k));
  if(!Object.hasOwn(raw,'campaignMap'))return !Object.hasOwn(raw,'campaignPeople')&&!Object.hasOwn(raw,'expeditionSite');
  if(!Array.isArray(w.pawns)||!w.planet||w.planet.revision===3||!Array.isArray(w.planet.tiles))return false;
  if(w.mechanoids!==undefined&&!Array.isArray(w.mechanoids))return false;
  if(w.wildlife!==undefined&&(!object(w.wildlife)||!Array.isArray(w.wildlife.animals)))return false;
  const map:unknown=w.campaignMap,people:unknown=w.campaignPeople;
  if(!object(map)||!exact(map,['active','secondaryTile','createdAt','visitIds',...w.schemaVersion>=242?['incidents']:[]])||typeof map.active!=='string'||!['home','secondary'].includes(map.active)
    ||!integer(map.secondaryTile,0,161)||!integer(map.createdAt,0,w.tick)||!dense(map.visitIds,8)||map.visitIds.some(id=>!integer(id,1,w.nextId-1))
    ||new Set(map.visitIds).size!==map.visitIds.length||!dense(people,w.width*w.height+65536)||!validExpeditionOrigin(w.expeditionSite,w,w.schemaVersion))return false;
  if(map.active==='secondary'?(!w.expeditionSite||w.expeditionSite.tile!==map.secondaryTile||w.expeditionSite.createdAt!==map.createdAt):Object.hasOwn(raw,'expeditionSite'))return false;
  const seen=new Set(w.pawns.map(p=>p.id));
  for(const person of people){
    if(!object(person)||!exact(person,person.deathAt===undefined?['id','name','status']:['id','name','status','deathAt'])
      ||!integer(person.id,1,w.nextId-1)||seen.has(person.id)||typeof person.name!=='string'||person.name.length<1||person.name.length>80
      ||typeof person.status!=='string'||!['away','departed','dead'].includes(person.status)||(person.status==='dead'?!integer(person.deathAt,0,w.tick):person.deathAt!==undefined))return false;
    seen.add(person.id);
  }
  if(w.schemaVersion>=242){
    const extended=w.schemaVersion>=252;
    if(!dense(map.incidents,extended?5:3))return false;
    const kinds=new Set<string>(),actors=new Set<number>();
    for(const row of map.incidents){
      if(!object(row)||!exact(row,['site','kind','count','actorId'])||row.site===(map.active)||!['home','secondary'].includes(String(row.site))
        ||!(extended?['raid','mechanoid','visitor','manhunter','downed']:['raid','mechanoid','visitor']).includes(String(row.kind))||kinds.has(String(row.kind))||!integer(row.count,1,w.width*w.height)
        ||!integer(row.actorId,1,w.nextId-1)||actors.has(row.actorId)||w.pawns.some(p=>p.id===row.actorId)||w.mechanoids?.some(m=>m.id===row.actorId)||w.wildlife?.animals.some(a=>!object(a)||a.id===row.actorId)
        ||row.kind==='manhunter'&&(row.count>MAX_WILDLIFE||people.some(p=>object(p)&&p.id===row.actorId))
        ||row.kind!=='mechanoid'&&row.kind!=='manhunter'&&!people.some(p=>object(p)&&p.id===row.actorId&&p.status==='away'))return false;
      kinds.add(String(row.kind));actors.add(row.actorId);
    }
  }
  return true;
}
