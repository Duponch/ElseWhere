import {animalConditionStage256} from './animal-age-condition-data-256.ts';
import {calendarTick} from './calendar.ts';
import {comfortableTemperature} from './heat-rules.ts';
import {HEAT_UNIT} from './heat-severity.ts';
import {IMMUNE_DISEASE_DEFINITIONS} from './immune-diseases-rules.ts';
import {IMMUNE_DISEASE_KINDS} from './immune-diseases-types.ts';
import {BLOOD_UNIT} from './injury-rules.ts';
import {medicalBleed,medicalStatus} from './injury-state.ts';
import {MALNUTRITION_UNIT} from './malnutrition.ts';
import {geographicSeasonTemperature256,seasonTemperature,siteClimateDefinition,TICKS_PER_YEAR} from './site-climate.ts';
import {TICKS_PER_DAY,type Pawn,type World} from './types.ts';

/** Core4871 AverageTemperatureAtTileForTwelfth: 120 hourly season-only
 * samples, starting half a day into the pawn's current local five-day period.
 * The period is selected by civil time; geographic seasonal samples use the
 * absolute annual phase, without a second longitude offset or current weather.
 * A historical map without a climate owner retains its represented 21C base. */
function seasonalBanishTemperature378(w:World):number {
 if(!w.climate)return 21;
 const civil=calendarTick(w),yearTick=((civil%TICKS_PER_YEAR)+TICKS_PER_YEAR)%TICKS_PER_YEAR;
 const twelfth=Math.floor(yearTick/(5*TICKS_PER_DAY)),definition=siteClimateDefinition(w);
 let sum=0;
 for(let hour=0;hour<120;hour++){
  const sample=(twelfth*5+.5)*TICKS_PER_DAY+hour*TICKS_PER_DAY/24;
  const temperature=w.climate.revision===4?geographicSeasonTemperature256(definition,sample*10):seasonTemperature(definition.latitude,definition.meanTemperature,sample);
  sum=w.climate.revision===4?Math.fround(sum+temperature):sum+temperature;
 }
 return w.climate.revision===4?Math.fround(sum/120):sum/120;
}

/** Read-only native banishment warning from the actual represented clinical
 * stages. Immunity does not suppress a still-present life-threatening stage;
 * injuries alone have no such stage and are covered by bleeding/downedness. */
export function wouldBeLeftToDie378(w:World,p:Pawn):boolean {
 const h=p.health;
 if(p.state==='downed'||h&&medicalStatus(h)==='downed')return true;
 if(h&&medicalBleed(h)>.4)return true;
 const range=comfortableTemperature(w,p),temperature=seasonalBanishTemperature378(w);
 // GenTemperature.SafeTemperatureRange extends both comfortable endpoints10C.
 if(temperature<range.min-10||temperature>range.max+10)return true;
 if(!h)return false;
 if(h.bloodLoss>=.6*BLOOD_UNIT||(h.malnutrition??0)>=.8*MALNUTRITION_UNIT||
    (h.heatstroke??0)>=.62*HEAT_UNIT||(h.hypothermia??0)>=.62*HEAT_UNIT||
    h.infections?.cases.some(c=>c.severity>=780_000_000)||(h.flu?.severity??0)>=833_000_000)return true;
 for(const kind of IMMUNE_DISEASE_KINDS)if((h.immuneDiseases?.[kind]?.severity??0)>=IMMUNE_DISEASE_DEFINITIONS[kind].lifeThreateningAt)return true;
 return h.animalAgeConditions?.cases.some(c=>animalConditionStage256(c.kind,c.severity).lifeThreatening===true)??false;
}
