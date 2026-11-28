import {computeThreatPoints,summaryHealthPercent} from './threat-points.ts';
import {homeAnimalThreatPoints329} from './animal-threat-points-329.ts';
import {threatModifiers382} from './game-profile.ts';
import {freeColonist} from './colony-economy.ts';
import {outdoorTemperature} from './temperature.ts';
import {climateTick,siteClimateDefinition,seasonTemperature} from './site-climate.ts';
import {toxicFalloutActive294} from './toxic-fallout-state-294.ts';
import {visitorArrival} from './visitor-navigation.ts';
import {animalNavigation} from './wildlife-navigation.ts';
import {INITIAL_ANIMAL_FACTS_256} from './initial-animal-data-256.ts';
import {constructFreshInitialWildAnimal256} from './initial-animal-constructor-256.ts';
import {stagedCampArrivalRandom256} from './camp-center-entry-256.ts';
import {journalLetter352,actors352} from './letter-producers-352.ts';
import {TICKS_PER_DAY,type World} from './types.ts';
import {MAX_WILDLIFE,type WildAnimal} from './wildlife-state.ts';

/** Core Misc ThrumboPasses: actual climate, no toxic fallout, at least two
 * visitors, one common 1.5-2.5 day departure deadline, 13 day refire limit. */
export function eligibleThrumboPasses382(w:World):boolean {
 if(w.schemaVersion<382||!w.wildlife||!w.miscIncidents||w.wildlife.animals.length>MAX_WILDLIFE-2||toxicFalloutActive294(w)||!w.pawns.some(freeColonist))return false;
 if(w.miscIncidents.lastThrumboPassAt382!==undefined&&w.tick-w.miscIncidents.lastThrumboPassAt382<13*TICKS_PER_DAY)return false;
 const climate=siteClimateDefinition(w),season=seasonTemperature(climate.latitude,climate.meanTemperature,climateTick(w)),temperature=outdoorTemperature(w);
 return season>=-65&&season<=50&&temperature>=-65&&temperature<=50;
}
/** The real colony pressure determines count; the local arrival navigation
 * remains the shared, reachable-edge approach (Core's exact edge weighting
 * and closewalk ordering are a remaining general movement adaptation). */
export function resolveSelectedThrumboPasses382(w:World,seed:number):boolean {
 if(!eligibleThrumboPasses382(w))return false;
 const people=w.pawns.filter(freeColonist),f=Math.fround;
 const stream=stagedCampArrivalRandom256(seed>>>0||1),random={value:stream.value,integer:stream.integer,float:(min:number,max:number)=>max<=min?f(min):f(f(stream.value()*f(f(max)-f(min)))+f(min))};
 const points=computeThreatPoints({timeFactorWholeDays:true,animalPoints:homeAnimalThreatPoints329(w),knownWealth:w.economy?.wealth.knownStorytellerWealth??0,freeColonists:people.length,colonistHealthSum:people.reduce((n,p)=>n+(p.health?summaryHealthPercent(p.health):1),0),elapsedDays:w.tick/TICKS_PER_DAY,adaptationDays:w.economy?.adaptationDays??0,seedBucket:Math.floor(w.tick/250),difficulty:threatModifiers382(w)}).points;
 const number=points/500,integer=Math.floor(number),rounded=integer+Number(random.value()<number-integer),count=Math.max(2,Math.min(random.integer(3,7),rounded));
 if(w.wildlife!.animals.length+count>MAX_WILDLIFE||!Number.isSafeInteger(w.nextId+count))return false;
 const exitCore=w.tick*10+random.integer(90000,150001),arrival=visitorArrival(w,Math.floor(random.value()*4294967296),count,'visitor');if(!arrival||arrival.sites.length<count)return false;
 const made:WildAnimal[]=[],nav=animalNavigation(w,false,true);let nextId=w.nextId;
 for(const cell of arrival.sites.slice(0,count)){
  const result=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256.Thrumbo,id:nextId++,cell,tick:w.tick,random});if(result.status==='blocked')return false;
  const a=result.animal;a.exitAtCore382=exitCore;
  const path=nav.route(a,[arrival.spot]);if(path?.length&&a.wander){a.path=path;a.state='moving';a.wander.job={kind:'goto',destination:{...arrival.spot}};}
  made.push(a);
 }
 w.nextId=nextId;w.wildlife!.animals.push(...made);w.miscIncidents!.lastThrumboPassAt382=w.tick;
 w.events.push({tick:w.tick,type:'need',message:`${count} thrumbos ont pénétré sur la carte. Ils repartiront après quelques jours.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);
 journalLetter352(w,'positive','Passage de thrumbos',actors352(made.map(a=>a.id)));
 return true;
}
