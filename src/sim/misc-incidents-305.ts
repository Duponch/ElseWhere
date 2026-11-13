import {schemaAtLeast} from './schema-range.ts';
import {naturalLight,seasonalNaturalLight} from './environment.ts';
import {climateTick,siteClimateDefinition,seasonTemperature} from './site-climate.ts';
import {outdoorTemperature} from './temperature.ts';
import {isColonist} from './affiliation.ts';
import {isAnimalSpecies256,animalCore256} from './animal-core-v256.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {adoptAsColonyAnimal} from './animal-handling.ts';
import {INITIAL_ANIMAL_FACTS_256,type InitialAnimalFact256} from './initial-animal-data-256.ts';
import {constructFreshInitialWildAnimal256} from './initial-animal-constructor-256.ts';
import {stagedCampArrivalRandom256} from './camp-center-entry-256.ts';
import {visitorArrival} from './visitor-navigation.ts';
import {isRoofed} from './roof-rules.ts';
import {pawnBody} from './health-rules.ts';
import {carrierOf} from './rescue-state.ts';
import type {MoodThought} from './mood.ts';
import {animalSpecies} from './animal-species.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Pawn,World} from './types.ts';

/* Schema 305: three RimWorld 1.6 Core incidents that the storyteller already
 * drew without effect. Rules come from the Core definitions (weights,
 * durations, refire delays, candidate filters); texts are our own.
 * - Aurora (World category, weight 1.2): a night-sky condition of 0.125 to
 *   0.35 day; awake or asleep, a pawn standing under the open sky, able to see,
 *   gets +14 mood. It cannot start in daylight or when daylight is near, and
 *   it fades soon after daylight returns.
 * - Self-tame (Misc, weight 1.0): one wild animal of the map joins the colony.
 * - Farm animals wander in (Misc, weight 0.4): a few tame farm animals of one
 *   kind arrive at the map edge and join the colony. */
export const isMiscIncidents305=schemaAtLeast(305);

export const AURORA_REFIRE_TICKS305=15*6000;
/** Core durationDays 0.125~0.35, in Core ticks (60000 per day). */
export const AURORA_MIN_DURATION_CORE305=7500,AURORA_MAX_DURATION_CORE305=21000;
/** Remaining Core ticks once daylight returns (the condition fades out). */
export const AURORA_FADE_CORE305=280;
export const AURORA_MOOD305=14;
const NIGHT_GLOW305=.5,NIGHT_LOOKAHEAD_TICKS305=500;

export interface AuroraState305 {start:number;endCore:number}

/** Sun glow of the home site without eclipse or weather (the celestial glow). */
export function celestialGlow305(world:World,tick=world.tick):number {
  const civil=climateTick(world,tick);
  return world.climate?seasonalNaturalLight(siteClimateDefinition(world).latitude,civil):naturalLight(civil);
}
const roundEven=(n:number)=>{const f=Math.floor(n);return n-f===.5?f+f%2:Math.round(n);};
const emit=(world:World,message:string)=>{world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);};

export function eligibleAurora305(world:World):boolean {
  const state=world.worldIncidents;
  if(!state||!isMiscIncidents305(Number(world.schemaVersion))||!world.gameProfile||state.aurora)return false;
  if(state.lastAuroraStart!==undefined&&world.tick-state.lastAuroraStart<AURORA_REFIRE_TICKS305)return false;
  if(!Number.isSafeInteger(world.tick*10+AURORA_MAX_DURATION_CORE305))return false;
  return celestialGlow305(world)<=NIGHT_GLOW305&&celestialGlow305(world,world.tick+NIGHT_LOOKAHEAD_TICKS305)<=NIGHT_GLOW305;
}
/** Only an already selected World ticket reaches this function. */
export function resolveSelectedAurora305(world:World,random:()=>number):boolean {
  if(!eligibleAurora305(world))return false;
  const state=world.worldIncidents!,start=world.tick;
  const duration=roundEven(AURORA_MIN_DURATION_CORE305+(AURORA_MAX_DURATION_CORE305-AURORA_MIN_DURATION_CORE305)*random());
  state.aurora={start,endCore:start*10+duration};state.lastAuroraStart=start;state.auroras=(state.auroras??0)+1;
  emit(world,'Aurore : de grands voiles colorés ondulent dans le ciel nocturne. Ceux qui sont dehors, à découvert, en profitent.');
  return true;
}
/** Called with the World calendar, after the step's power and mood reads. */
export function advanceAurora305(world:World):void {
  const state=world.worldIncidents,aurora=state?.aurora;if(!state||!aurora)return;
  const now=world.tick*10;
  if(now>aurora.endCore){delete state.aurora;emit(world,'L’aurore s’efface du ciel.');return;}
  if(celestialGlow305(world)>NIGHT_GLOW305&&aurora.endCore-now>AURORA_FADE_CORE305)aurora.endCore=now+AURORA_FADE_CORE305;
}
export function auroraActive305(world:World):boolean {
  const aurora=world.worldIncidents?.aurora;
  return !!aurora&&isMiscIncidents305(Number(world.schemaVersion))&&world.tick*10>aurora.start*10&&world.tick*10<=aurora.endCore;
}
const auroraThought305:MoodThought={id:'aurora',label:'Aurore',offset:AURORA_MOOD305,kind:'situation',
  description:'Une aurore colore le ciel au-dessus de cette position découverte. La pensée disparaît sous un toit ou à la fin de l’aurore.'};
/** A pawn of the map (or carried on it) under the open sky and able to see. */
export function localAuroraThought305(world:World,pawn:Pawn):MoodThought|undefined {
  if(!auroraActive305(world)||!world.pawns.includes(pawn)||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)return;
  if(pawnBody(pawn).capacities.sight<=0)return;
  const holder=carrierOf(world,pawn.id)??pawn;if(!world.pawns.includes(holder))return;
  const position=holder.motion&&holder.motion.end>world.tick?holder.motion.from:holder;
  return isRoofed(world,position.z*world.width+position.x)?undefined:auroraThought305;
}

const INSECTS305=new Set(['megascarab','megaspider','spelopede']);
/* Original species of the first wildlife (hare, deer...) carry no Core
 * stats here; they are all wild kinds, with the neutral taming factor 1
 * (tameWildnessFactor256), i.e. wildness 0.5. */
const wildness305=(a:Pick<WildAnimal,'species'>)=>isAnimalSpecies256(a.species)?animalCore256(a.species).stats.Wildness:.5;
const freeColonistsPresent305=(world:World)=>world.pawns.some(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead');
/** Wild animals of the map, outside fog, sane, standing, without scaria and
 * with some wildness (Core IncidentWorker_SelfTame's candidates). */
export function selfTameCandidates305(world:World):WildAnimal[] {
  const out:WildAnimal[]=[];
  for(const a of world.wildlife?.animals??[]){
    if(a.domestic||a.state==='dead'||a.state==='downed'||a.health?.death||a.manhunter||a.confusion||a.health?.scaria261||INSECTS305.has(a.species))continue;
    if(a.shipCryptosleepHeldAt277!==undefined||animalCarrier(world,a.id)||wildness305(a)<=0)continue;
    if(foggedCell256(world,a.z*world.width+a.x))continue;
    out.push(a);
  }
  return out;
}
export function resolveSelectedSelfTame305(world:World,random:()=>number):boolean {
  if(!isMiscIncidents305(Number(world.schemaVersion))||!freeColonistsPresent305(world))return false;
  const candidates=selfTameCandidates305(world);if(!candidates.length)return false;
  const animal=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]!;
  adoptAsColonyAnimal(world,animal);
  emit(world,`Un animal sauvage s’est attaché à la colonie : ${animalLabel305(animal)} ${animal.id} vous suit désormais.`);
  return true;
}
const animalLabel305=(a:Pick<WildAnimal,'species'>)=>animalSpecies(a.species).label;

/** Core farm animals (trade tag AnimalFarm) that this game represents, with
 * wildness below 0.35: dromedary, duck, yak, donkey, alpaca. */
const FARM_DEFS305=['Dromedary','Duck','Yak','Donkey','Alpaca'] as const;
const FARM_BODY_TOTAL305=2.5;
function farmKinds305(world:World):{fact:InitialAnimalFact256;weight:number}[] {
  const season=seasonTemperature(siteClimateDefinition(world).latitude,siteClimateDefinition(world).meanTemperature,climateTick(world)),outdoor=outdoorTemperature(world);
  const out:{fact:InitialAnimalFact256;weight:number}[]=[];
  for(const def of FARM_DEFS305){
    const fact=(INITIAL_ANIMAL_FACTS_256 as Record<string,InitialAnimalFact256>)[def];if(!fact||!isAnimalSpecies256(fact.species))continue;
    const wild=animalCore256(fact.species).stats.Wildness;if(!(wild<.35))continue;
    if(season<fact.comfyMin||season>fact.comfyMax||outdoor<fact.comfyMin||outdoor>fact.comfyMax)continue;
    const own=(world.wildlife?.animals??[]).filter(a=>a.species===fact.species&&!!a.domestic&&a.state!=='dead'&&!a.health?.death);
    const pair=own.some(a=>a.sex==='male')&&own.some(a=>a.sex==='female');
    out.push({fact,weight:(.42-wild)*(pair?.5:1)});
  }
  return out;
}
export function resolveSelectedFarmAnimals305(world:World,seed:number):boolean {
  if(!isMiscIncidents305(Number(world.schemaVersion))||!world.wildlife||!freeColonistsPresent305(world))return false;
  const stream=stagedCampArrivalRandom256(seed>>>0||1),f=Math.fround;
  const random={value:stream.value,integer:stream.integer,float:(min:number,max:number)=>max<=min?f(min):f(f(stream.value()*f(f(max)-f(min)))+f(min))};
  const kinds=farmKinds305(world);if(!kinds.length)return false;
  const total=kinds.reduce((n,k)=>n+k.weight,0);let ticket=random.value()*total,kind=kinds[kinds.length-1]!;
  for(const k of kinds){ticket-=k.weight;if(ticket<0){kind=k;break;}}
  const raw=FARM_BODY_TOTAL305/kind.fact.baseBodySize,whole=Math.floor(raw);
  const count=Math.max(2,Math.min(10,whole+(random.value()<raw-whole?1:0)));
  const arrival=visitorArrival(world,Math.floor(random.value()*4294967296),count,'visitor');
  if(!arrival||arrival.sites.length<count)return false;
  const made:WildAnimal[]=[];let nextId=world.nextId;
  for(let i=0;i<count;i++){
    if(!Number.isSafeInteger(nextId+1))return false;
    const forcedSex=i===0&&kind.fact.hasGenders?'female' as const:i===1&&kind.fact.hasGenders?'male' as const:undefined;
    const result=constructFreshInitialWildAnimal256({fact:kind.fact,id:nextId++,cell:arrival.sites[i]!,tick:world.tick,random,...forcedSex?{forcedSex}:{}});
    if(result.status==='blocked')return false;
    made.push(result.animal);
  }
  world.nextId=nextId;
  for(const a of made){world.wildlife.animals.push(a);adoptAsColonyAnimal(world,a);}
  emit(world,`Des animaux de ferme arrivent d’eux-mêmes : ${count} ${animalLabel305(made[0]!)} rejoignent la colonie.`);
  return true;
}
