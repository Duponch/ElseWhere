/** Authoritative saved world Sites, not newly generated quest rewards. The
 * ownership record stores the actual source Thing and timeout exactly where
 * the existing Site model can hold them. Historical quest cards that have
 * lost required source witnesses are reported, never reconstructed from
 * guessed destinations/reward rolls. */
import {resolveApparel,resolveWeapon,type ImportContext} from './convert.ts';
import {at,items,num,text,type XmlNode} from './xml.ts';
import {readThing,parseTile,type RwsThing} from './rws-save.ts';
import {lookup,isDropped} from './mapping.ts';
import {ITEM_MAP,APPAREL_MAP,WEAPON_MAP,QUALITY_MAP} from './map-items.ts';
import {rwsItemCondition} from './convert-items.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../../sim/items.ts';
import type {MaterialPile} from '../../sim/types.ts';
import {validatePileRecordShape} from '../../sim/material-record-save.ts';
import {planetTileCount} from '../../sim/planet-geography-256.ts';
import {validWorldRelationKind274} from '../../sim/world-diplomacy-274.ts';
import {WORLD_FACTION_DEFINITIONS_256,type WorldFactionRelationKind256} from '../../sim/world-faction-catalog.ts';
import type {ItemStash263,ItemStashThreat263,WorldSite263} from '../../sim/world-sites-state-263.ts';
import {validateWorldSites263} from '../../sim/world-sites-save-263.ts';
import {newQuestCalendar263} from '../../sim/world-quest-calendar-263.ts';
import type {PeaceTalksSite293} from '../../sim/peace-talks-state-293.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {newApparelState} from '../../sim/apparel-rules.ts';
import {newWeaponState} from '../../sim/equipment-rules.ts';

const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v);
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const goodKind=(s:string|undefined):WorldFactionRelationKind256|undefined=>s==='Hostile'?'hostile':s==='Neutral'?'neutral':s==='Ally'?'ally':undefined;
const sourceCore=(ctx:ImportContext,v:number):number=>effectiveCore297(ctx.w)+v-ctx.save.ticksGame;
const pastCore=(ctx:ImportContext,v:number):number=>Math.max(0,Math.min(ctx.w.tick*10,Math.floor(sourceCore(ctx,v)/10)*10));
const sourceWorldObjects=(ctx:ImportContext)=>items(ctx.save.world?.node,'worldObjects/worldObjects');
const sourceQuests=(ctx:ImportContext)=>items(ctx.save.game,'questManager/quests');
const questId=(q:XmlNode)=>num(q,'id')??0;

/** The existing engine intentionally allows overlapping goodwill ranges for
 * hostile/neutral/ally. Preserve the original bilateral state (not the kind
 * recomputed by the old initialization thresholds), plus actual identity
 * data and lifecycle fields. No changes for a regenerated planet fallback. */
export function importFactionSnapshot(ctx:ImportContext):void {
 const {w,save,notes,factionIds}=ctx,registry=w.worldFactions;if(!registry||!factionIds)return;
 const source=items(save.world?.node,'factionManager/allFactions'),byLoad=new Map(source.map(n=>[`Faction_${num(n,'loadID')??0}`,n]));
 const loadById=new Map([...factionIds].map(([load,id])=>[id,load])),records=new Map(save.factions.map(f=>[f.loadId,f]));
 let factions=0,relations=0,adjusted=0;
 for(const f of registry.factions){
  const load=loadById.get(f.id),raw=load?byLoad.get(load):undefined;if(!raw)continue;
  const randomKey=num(raw,'randomKey')??0,spectrum=num(raw,'colorFromSpectrum')??0,name=text(raw,'name');
  if(integer(randomKey)&&randomKey>=0&&randomKey<=2147483646)f.randomKey=randomKey;
  if(spectrum>=0&&spectrum<=1&&Number.isFinite(spectrum))f.colorFromSpectrum=spectrum;
  if(name&&name.length<=80)f.name=name;
  else if(name)notes.lost('factions',`Nom source trop long pour le registre de faction (${load}).`);
  f.lifecycle259={revision:1,defeated:text(raw,'defeated')==='True',temporary:text(raw,'temporary')==='True'};factions++;
 }
 for(const r of registry.relations){
  const a=loadById.get(r.aId),b=loadById.get(r.bId);if(!a||!b)continue;
  const ar=records.get(a)?.relations.find(x=>x.other===b),br=records.get(b)?.relations.find(x=>x.other===a);
  // Prefer original player-facing direction where a directional relation
  // disagrees: the engine stores a single symmetric pair, never two aliases.
  const actual=a===save.playerFaction?ar??br:b===save.playerFaction?br??ar:ar??br;
  if(!actual)continue;
  const goodwill=Math.round(actual.goodwill),kind=goodKind(actual.kind),fa=registry.factions.find(f=>f.id===r.aId)!,fb=registry.factions.find(f=>f.id===r.bId)!;
  const permanent=WORLD_FACTION_DEFINITIONS_256[fa.def].permanentEnemy||WORLD_FACTION_DEFINITIONS_256[fb.def].permanentEnemy;
  if(!kind||!validWorldRelationKind274(goodwill,kind,w.schemaVersion)||permanent&&goodwill!==-100){adjusted++;continue;}
  if(ar&&br&&(ar.kind!==br.kind||ar.goodwill!==br.goodwill))adjusted++;
  r.goodwill=goodwill;r.kind=kind;relations++;
 }
 notes.mapped('factions',`${factions} identités/lifecycles et ${relations} relations de faction sauvegardées (nature et bonne volonté, sans recalcul des seuils).`);
 if(adjusted)notes.adapted('factions',`${adjusted} relations directionnelles ou valeurs non représentables dans le modèle bilatéral actuel.`);
}

/** One frozen original reward stack, no local stock owner/budget or reward
 * generator. Generic source piles can be divided only at catalogue limits. */
function draftGoods(ctx:ImportContext,siteId:number,t:RwsThing):{piles:MaterialPile[];note?:string}|undefined {
 if(!integer(t.stack)||t.stack<1)return undefined;
 const m=lookup(ITEM_MAP,t.def),apparel=Object.hasOwn(APPAREL_MAP,t.def),weapon=Object.hasOwn(WEAPON_MAP,t.def);
 const gear=apparel?resolveApparel(t):weapon?resolveWeapon(t):undefined;
 if(gear&&'drop'in gear||!gear&&(!m||isDropped(m)))return undefined;
 const item=(gear&&'item'in gear?gear.item:m&&!isDropped(m)?m.to:'') as ItemId,def=ITEM_DEFINITIONS[item];
 if(!def||['corpse','mech-corpse','unfinished','plant','book'].includes(def.kind))return undefined;
 const {condition}=rwsItemCondition(ctx,t,item);
 if(condition.egg)return undefined; // frozen eggs use a distinct owner clock
 const frozen=condition.rot?{...condition.rot,atTick:ctx.w.tick,rate:0}:undefined;
 if(frozen)condition.rot=frozen;
 if(gear){
  if(apparel)condition.apparel=newApparelState(item as Parameters<typeof newApparelState>[0],undefined,ctx.w.schemaVersion);
  if(weapon)condition.weapon=newWeaponState(item as Parameters<typeof newWeaponState>[0]);
  const state=condition.apparel??condition.weapon;if(!state)return undefined;
  if(t.quality)state.quality=QUALITY_MAP[t.quality]??'normal';
  if(t.hp!==undefined)state.hitPoints=clamp(Math.round(t.hp),1,state.hitPoints);
  delete condition.damage;
 }
 const out:MaterialPile[]=[];let remaining=t.stack;
 while(remaining>0&&out.length<64){const quantity=Math.min(remaining,def.stackLimit);remaining-=quantity;
  out.push({id:ctx.w.nextId+out.length,kind:def.kind,item,quantity,owner:{type:'world-site263',siteId},...structuredClone(condition)});
 }
 if(remaining>0)return undefined;
 const nextId=ctx.w.nextId+out.length,meta={width:1,height:1,tick:ctx.w.tick,nextId};
 if(out.some(p=>validatePileRecordShape(p as unknown as Record<string,unknown>,meta,ctx.w.schemaVersion,ctx.w.tick,undefined,siteId).length))return undefined;
 const note=gear&&'item'in gear?gear.note:m&&!isDropped(m)&&'adapt'in m?m.adapt:undefined;
 return {piles:out,...note?{note}:{}};
}

function threatFromParts(ctx:ImportContext,node:XmlNode,parts:readonly XmlNode[]):{factionId:number|null;threat:ItemStashThreat263}|undefined {
 const active=parts.filter(p=>!['ItemStash','PossibleUnknownThreatMarker'].includes(text(p,'def')??''));
 if(!active.length)return {factionId:null,threat:{kind:'none'}};
 if(active.length!==1)return;
 const p=active[0]!,def=text(p,'def'),points=num(p,'parms/threatPoints')??num(node,'desiredThreatPoints');
 if(points===undefined||!Number.isFinite(points)||points<0||points>10000)return;
 if(def==='AmbushEdge'||def==='AmbushHidden')return {factionId:null,threat:{kind:def==='AmbushEdge'?'ambush-edge':'ambush-hidden',points}};
 if(def==='Manhunters'||def==='SleepingMechanoids')return {factionId:null,threat:{kind:def==='Manhunters'?'manhunters':'sleeping-mechanoids',points}};
 if(def==='Outpost'||def==='Turrets'){
  const source=text(node,'faction'),id=source?ctx.factionIds?.get(source):undefined;if(id===undefined)return;
  return {factionId:id,threat:{kind:def==='Outpost'?'outpost':'turrets',factionId:id,points}};
 }
 return undefined;
}
const partOfClass=(q:XmlNode|undefined,cls:string)=>items(q,'parts').find(p=>p.attrs?.Class===cls);
function expiration(q:XmlNode|undefined,node:XmlNode):number|undefined {
 const direct=num(node,'timeoutEndTick');if(direct!==undefined&&direct>=0)return direct;
 const timer=partOfClass(q,'QuestPart_WorldObjectTimeout'),enable=num(timer,'enableTick'),delay=num(timer,'delayTicks');
 return text(timer,'state')==='Enabled'&&integer(enable)&&integer(delay)&&delay>0?enable+delay:undefined;
}

function importSite(ctx:ImportContext,node:XmlNode,q:XmlNode|undefined):{site?:WorldSite263;reason?:string} {
 const {w}=ctx,registry=w.worldSites263!,def=text(node,'def'),parts=items(node,'parts'),stash=parts.find(p=>text(p,'def')==='ItemStash');
 if(def!=='PeaceTalks'&&(def!=='Site'||!stash))return {reason:`Type de site ${parts.map(p=>text(p,'def')).join('/')||def||'?'} sans propriétaire équivalent.`};
 const tile=parseTile(text(node,'tile')),createdRaw=num(node,'creationGameTicks'),expiryRaw=expiration(q,node);
 if(tile===undefined||!w.planet||tile>=planetTileCount(w.planet)||createdRaw===undefined)return {reason:'Case ou date de création source inconnue.'};
 if(w.worldMaps?.sites.some(s=>s.tile===tile)||w.worldFactions?.settlements.some(s=>s.tile===tile)||registry.entries.some(s=>s.tile===tile&&!('closed'in s&&s.closed)))return {reason:'La case appartient déjà à un autre propriétaire du monde.'};
 if(expiryRaw===undefined||sourceCore(ctx,expiryRaw)<=effectiveCore297(w))return {reason:'Délai de mission vivant introuvable ou déjà expiré.'};
 const createdAtCore=pastCore(ctx,createdRaw),expiresAtCore=sourceCore(ctx,expiryRaw),id=registry.nextId;
 if(def==='PeaceTalks'){
  const sourceFaction=text(node,'faction'),factionId=sourceFaction?ctx.factionIds?.get(sourceFaction):undefined;
  const tag=items(q,'tags').map(text=>text.text.trim()).find(t=>t.startsWith('PeaceTalks_'));
  if(factionId===undefined||!tag)return {reason:'Faction ou identité de pourparlers absente.'};
  const site:PeaceTalksSite293={kind:'peace-talks',id,tile,factionId,createdAtCore,expiresAtCore,mapId:null,questTag:tag};
  return {site};
 }
 const threat=threatFromParts(ctx,node,parts);if(!threat)return {reason:'Composition de menace du site pas encore représentable.'};
 const originals=items(stash,'things/innerList').map(n=>readThing(n));
 if(!originals.length)return {reason:'Contenu physique de la cache non disponible.'};
 const startId=w.nextId,piles:MaterialPile[]=[],links:{original:RwsThing;item:MaterialPile;note?:string}[]=[];
 for(const t of originals){
  if(ctx.thingIds.has(t.id)||links.some(x=>x.original.id===t.id)){w.nextId=startId;return {reason:'Un objet de récompense appartient déjà à un autre propriétaire.'};}
  const goods=draftGoods(ctx,id,t);if(!goods||piles.length+goods.piles.length>64){w.nextId=startId;return {reason:`Contenu de cache ${t.def} (${t.stack}) non représentable, pas de récompense de substitution.`};}
  w.nextId+=goods.piles.length;piles.push(...goods.piles);links.push({original:t,item:goods.piles[0]!,...goods.note?{note:goods.note}:{}});
 }
 const site:ItemStash263={kind:'item-stash',id,tile,...threat,createdAtCore,mapId:null,expiresAtCore,heldAtCore:w.tick*10,items:piles};
 // Commit identity links only after the complete owner passes its validator.
 const candidate={...registry,nextId:id+1,entries:[...registry.entries,site]},errors=validateWorldSites263(candidate,w,new Set(),effectiveCore297(w));
 if(errors.length){w.nextId=startId;return {reason:`Validation du propriétaire du site : ${errors[0]}`};}
 for(const {original,item,note} of links){ctx.thingIds.set(original.id,item.id);ctx.notes.countBefore('items');ctx.notes.countAfter('items');ctx.notes.def('items',`${original.def} (site)`,note?'adapted':'exact',item.item,note);}
 return {site};
}

/** Count source roots as historical occurrences without creating a fake
 * selected quest. Source history lacks rejected opportunity draws and the
 * current calendar has narrower supported roots; disclose the adaptation. */
function importQuestCalendar(ctx:ImportContext,quests:readonly XmlNode[]):void {
 const {w,notes}=ctx,registry=w.worldSites263!;
 if(!registry.quest)return;
 const core=w.tick*10,original=registry.quest;
 const state=newQuestCalendar263(core,w.seed,w.pawns.filter(p=>(p.faction??'colony')==='colony'&&!p.prisoner&&p.state!=='dead').map(p=>p.id));state.rng=original.rng;
 const kind=(q:XmlNode):string|undefined=>{const root=text(q,'root');return root==='OpportunitySite_ItemStash'?'item-stash':root==='TradeRequest'?'trade-request':root==='OpportunitySite_PeaceTalks'?'peace-talks':undefined;};
 const supported=quests.filter(q=>kind(q)!==undefined).sort((a,b)=>(num(a,'appearanceTick')??0)-(num(b,'appearanceTick')??0)||questId(a)-questId(b));
 state.siteOffers=supported.length;state.opportunities=supported.length;state.recent=supported.slice(-5).reverse().map(q=>kind(q)!);
 const last=supported.at(-1),stamp=num(last,'appearanceTick');if(stamp!==undefined)state.previousHitInterval=Math.floor(pastCore(ctx,stamp)/1000);
 const adapt=num(ctx.save.game,'storyWatcher/watcherPopAdaptation/adaptDays');if(adapt!==undefined&&adapt>=0)state.populationAdaptationDays=Math.round(adapt*2)/2;
 registry.quest=state;
 notes.adapted('history',`Agenda des quêtes : ${supported.length} offres passées identifiables, mémoire récente des familles prises en charge et adaptation de population reprises ; RNG, consultations sans offre et dates non sauvegardées ne peuvent être déduits.`);
}

/** Cold conversion hook after the real source clock and faction/actor
 * namespaces are ready. Never reroll an actual reward or call a producer. */
export function importRwsWorldQuests(ctx:ImportContext):void {
 importFactionSnapshot(ctx);
 const {w,notes}=ctx,quests=sourceQuests(ctx),nodes=sourceWorldObjects(ctx).filter(n=>text(n,'def')!=='Settlement');
 const restored=new Set<number>(),objectReasons=new Map<string,string>();
 if(w.planet&&w.worldFactions&&ctx.factionIds){
  const old=w.worldSites263;w.worldSites263={revision:1,nextId:1,entries:[],...old?.quest?{quest:old.quest}:{}};
  importQuestCalendar(ctx,quests);
  for(const n of nodes){
   notes.countBefore('world');const sourceId=num(n,'ID')??0,sourceRef=`WorldObject_${sourceId}`,q=quests.find(q=>text(partOfClass(q,'QuestPart_SpawnWorldObject'),'worldObject')===sourceRef);
   const candidate=importSite(ctx,n,q);
   if(candidate.site){const state=w.worldSites263,entry=candidate.site,next={...state,nextId:state.nextId+1,entries:[...state.entries,entry]};
    const errors=validateWorldSites263(next,w,new Set(),effectiveCore297(w));if(!errors.length){state.entries.push(entry);state.nextId++;notes.countAfter('world');notes.def('world',`${text(n,'def')} #${sourceId}`,'adapted',entry.kind,`Même case ${entry.tile} et délai. ${entry.kind==='item-stash'?'Contenu réel repris ; génération future de la carte et titre de quête encore adaptés.':''}`);if(q)restored.add(questId(q));continue;}
    candidate.reason=`Validation de l’objet du monde : ${errors[0]}`;
   }
   const caravan=n.attrs?.Class==='Caravan'||text(n,'def')==='Caravan';
   const reason=caravan?'ElseWhere possède les groupes de caravane, mais leurs membres, fret et itinéraires RWS ne sont pas encore composés par l’importeur.':candidate.reason??'Type d’objet du monde non pris en charge.';objectReasons.set(sourceRef,reason);notes.def('world',`${text(n,'def')} #${sourceId}`,'dropped',undefined,reason,1,caravan?'importer':undefined);
  }
 }else for(const n of nodes){notes.countBefore('world');notes.def('world',`${text(n,'def')} #${num(n,'ID')??0}`,'dropped',undefined,'Planète exacte requise pour importer les objets du monde.');}
 for(const q of quests){
  const id=questId(q),root=text(q,'root')??'?',name=text(q,'name')??root,ended=text(q,'ended')==='True',outcome=text(q,'endOutcome')??'Indéterminé';
  notes.countBefore('history');
  if(restored.has(id)){notes.countAfter('history');notes.def('history',`Quête ${id} : ${name}`,'adapted',root,'Mission active et contenu physique repris ; le modèle ne porte pas les titres et textes de quête originaux.');continue;}
  const destination=text(partOfClass(q,'QuestPart_SpawnWorldObject'),'worldObject');
  const request=partOfClass(q,'QuestPart_InitiateTradeRequest'),requested=text(request,'requestedThingDef'),quantity=num(request,'requestedCount');
  const reason=ended?`Quête historique (${outcome}) : reçu complet (propriétaires, récompenses ou site d’origine) non conservé par Core après nettoyage ; aucun faux historique produit.`:root==='TradeRequest'?`Commande active${requested?` (${quantity??'?'} × ${requested})`:''} : ${requested?.startsWith('Bionic')?'famille bionique absente ; ':''}récompenses et reçu complet de génération/valeur à vérifier avant admission ; pas de transaction de remplacement.`:destination&&objectReasons.get(destination)||'Type ou état de quête sans propriétaire complet dans Elsewhere.';
  notes.def('history',`Quête ${id} : ${name}`,'dropped',root,reason);
 }
}
