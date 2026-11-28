/** Cold RWS adoption, before any source-local Thing is installed. The game
 * tick is the elapsed Core clock, not the calendar's absolute date. No calls
 * to stepWorld (which would age objects and replay a fictitious history).
 * Rebirth only of the private, synthetic calendars of the temporary map;
 * source clocks and owners are installed by their importers afterwards. */
import type {ImportContext} from './convert.ts';
import {newCorePathBudget297} from '../../sim/core-path-budget-297.ts';
import {createDeteriorationState} from '../../sim/deterioration-content.ts';
import {createApparelWearCalendar} from '../../sim/apparel-renewal.ts';
import {newBreakdownCalendar} from '../../sim/breakdowns.ts';
import {enableCassandraRaids,INTRO_RAID_TICK} from '../../sim/cassandra-raids.ts';
import {validNativePhoebeCycle382} from '../../sim/phoebe-native-cycle-382.ts';
import {enableVisitors} from '../../sim/visitors.ts';
import {adoptFluIncidents,adoptImmuneDiseaseIncidents} from '../../sim/flu-incidents.ts';
import {adoptMiscIncidents,adoptWeatherIncidents} from '../../sim/cassandra-misc.ts';
import {adoptShortCircuits} from '../../sim/short-circuit.ts';
import {adoptCropBlights} from '../../sim/crop-blight-incident.ts';
import {adoptToxicFallout294} from '../../sim/toxic-fallout-incident-294.ts';
import {adoptWorldIncidents} from '../../sim/cassandra-world.ts';
import {adoptSmallIncidents} from '../../sim/cassandra-small.ts';
import {adoptOrbital} from '../../sim/orbital.ts';
import {adoptRainElectrical} from '../../sim/rain-electric.ts';
import {newQuestCalendar263} from '../../sim/world-quest-calendar-263.ts';
import {adoptColonyEconomy,freeColonist} from '../../sim/colony-economy.ts';
import {initializeActualWildFlora256} from '../../sim/wild-plant-actual-runtime-256.ts';
import {num,text} from './xml.ts';
import {importWildFloraSnapshot} from './convert-environment.ts';
import {nativeHumanBiologicalCore256} from '../../sim/native-human-identity-256.ts';

/** Profile adoption is independent of physical clock/owners. A plain-local
 * fallback does not own the geographic profile; that loss is explicit. */
export function adoptRwsProfile382({w,save,notes}:Pick<ImportContext,'w'|'save'|'notes'>):void {
 if(!w.gameProfile){
  if(save.storyteller)notes.def('world',`Conteur : ${save.storyteller}`,'dropped',undefined,'La carte locale de repli n’a pas de propriétaire de conteur géographique.',1,'model');
  if(save.difficulty)notes.def('world',`Difficulté : ${save.difficulty}`,'dropped',undefined,'La carte locale de repli n’a pas de propriétaire de difficulté Core.',1,'model');
  return;
 }
 const narrator=save.storyteller==='Cassandra'?'cassandra-partial':save.storyteller==='Phoebe'?'phoebe-partial':undefined;
 const difficulty=save.difficulty==='Medium'?'adventure-story':save.difficulty==='Easy'?'community-builder':save.difficulty==='Rough'?'strive-to-survive':undefined;
 if(w.schemaVersion>=382&&narrator)w.gameProfile.storyteller=narrator;
 if(w.schemaVersion>=382&&difficulty)w.gameProfile.difficulty=difficulty;
 if(save.storyteller)notes.def('world',`Conteur : ${save.storyteller}`,narrator?'adapted':'dropped',w.gameProfile.storyteller,narrator?'Profil et cycles de menaces Core repris ; les tirages globaux, agendas et incidents incomplets restent adaptés.':'Conteur absent du modèle actuel ; le profil Cassandra existant est utilisé.',1,narrator?'both':'model');
 if(save.difficulty)notes.def('world',`Difficulté : ${save.difficulty}`,difficulty?'exact':'adapted',w.gameProfile.difficulty,difficulty?undefined:'Difficulté Core non encore représentée.',1,difficulty?undefined:'model');
 if(difficulty&&difficulty!=='adventure-story')notes.def('world',`Règles de difficulté : ${save.difficulty}`,'adapted',w.gameProfile.difficulty,'Les multiplicateurs d’humeur, santé, productivité, adaptation, menaces et maladies pris en charge sont actifs ; tous les incidents, restrictions et paramètres Core ne sont pas encore modélisés.',1,'model');
}

export function adoptRwsClock(ctx:ImportContext):void {
 const {w,save,notes}=ctx,core=save.ticksGame;
 if(!Number.isSafeInteger(core)||core<0||!Number.isSafeInteger(save.gameStartAbsTick+core))throw Error('Horloge RimWorld invalide.');
 const tick=Math.floor(core/10),macro=tick*10;
 // All source-local Things will be born at the *actual* import frontier.
 w.tick=tick;w.phaseCore297=core%10;w.corePathBudget297=newCorePathBudget297(tick);
 const manual=text(save.game,'playSettings/useWorkPriorities')==='True';
 if(manual)delete w.simpleWorkTab344;else w.simpleWorkTab344=true;
 notes.def('pawn-state','Priorités manuelles de travail','exact',manual?'activées':'désactivées');
 adoptRwsProfile382(ctx);
 if(w.worldPawns){
  const s=w.worldPawns;s.atCore=macro;s.physicalClockCore297=core;
  // The initial five owner templates are replaced by actual source owners.
  // Keep only the bounded committed macro frontier on these private templates.
  for(const row of s.owners)if(row.mode==='active'){
   row.clockCore=macro;
   if(row.actor.health){row.actor.health.tick=tick;if(row.actor.health.civilTick271!==undefined)row.actor.health.civilTick271=tick;}
  }
 }
 if(w.deterioration)w.deterioration=createDeteriorationState(w.seed,tick);
 if(w.breakdown)w.breakdown=newBreakdownCalendar(w.seed,tick);
 if(w.apparelWear)w.apparelWear=createApparelWearCalendar(tick,w.apparelWear.rng);
 if(w.weather){w.weather.lastCoreTick=macro;w.weather.fireWatchCore=macro;delete w.weather.lastLightning;w.weather.lightningCount=0;}
 if(w.snow){w.snow.adoptedAt=tick;w.snow.lastTick=tick;w.snow.cursor=0;}
 if(w.wildlife?.geographicRenewal262)w.wildlife.geographicRenewal262.lastTick=tick;
 if(w.geysers)w.geysers.atTick=tick;
 if(w.fires){w.fires.clockCore=macro;w.fires.embers=[];w.fires.batteryWicks=[];}
 // These calendars are our own deterministic streams, not serialized Core
 // RNG. Schedule prospectively, skipping elapsed opportunities. Never claim
 // that synthetic events took place before the conversion.
 if(w.raids){
  // Two actual identities feed the Core-only OnOffCycle components. The
  // importer does not synthesize either when the source lacks it.
  const source={worldRandom:num(save.world?.node,'info/persistentRandomValue'),mapUniqueId:num(ctx.map.node,'uniqueID')};
  const settledAt=text(save.game,'tickManager/lastSettleTicks');
  const native=(settledAt===undefined||num(save.game,'tickManager/lastSettleTicks')===0)&&w.gameProfile?.storyteller==='phoebe-partial'&&validNativePhoebeCycle382(source)?source:undefined;
  delete w.raids;enableCassandraRaids(w,tick>=INTRO_RAID_TICK,native);
  if(native)notes.def('world','Phoebe : graines des cycles Core','exact','Valeur persistante du monde et uniqueID de la carte');
 }
 if(w.visitors){delete w.visitors;enableVisitors(w,false,true);}
 if(w.fluIncidents){delete w.fluIncidents;adoptFluIncidents(w);adoptImmuneDiseaseIncidents(w);}
 if(w.miscIncidents){delete w.miscIncidents;adoptMiscIncidents(w);if(tick>0){adoptWeatherIncidents(w);adoptShortCircuits(w);adoptCropBlights(w);adoptToxicFallout294(w);}}
 if(ctx.geographic){
  delete w.worldIncidents;adoptWorldIncidents(w);
  delete w.smallIncidents;adoptSmallIncidents(w);
  delete w.orbital;adoptOrbital(w);
  delete w.rainElectrical;adoptRainElectrical(w);
 }
 if(w.party292){w.party292={...w.party292,adoptedAtCore:macro,nextCheckCore:macro+5000,pending:false};delete w.party292.active;delete w.party292.lastStartedAtCore;}
 if(w.tradeRequests284)w.tradeRequests284.adoptedAtCore=macro;
 if(w.worldMaps&&w.worldFactions&&w.worldGroups){
  w.worldSites263??={revision:1,nextId:1,entries:[]};
  w.worldSites263.quest=newQuestCalendar263(macro,w.seed,[]);
 }
 // The generated shrine warning refers to Things that have been discarded.
 delete w.ancientShrineWarnings;
 notes.def('time','Compteur de la partie','exact',`${core} ticks Core (${tick} + ${core%10}/10)`);
 notes.adapted('time','Les calendriers aléatoires propres au moteur sont adoptés à la date réelle sans rejouer les événements passés ; leurs futurs tirages ne sont pas ceux de RimWorld.');
}

/** Recalculate a real census on the imported Things, not the temporary map.
 * Restore the current story-watchers' adaptation scalars when available. */
export function finalizeRwsClock(ctx:ImportContext):void {
 const {w,save,notes}=ctx;
 if(w.flora?.revision===2&&!importWildFloraSnapshot(ctx)){delete w.flora;initializeActualWildFlora256(w);}
 if(w.economy){
  delete w.economy;adoptColonyEconomy(w);
  const days=num(save.game,'storyWatcher/watcherAdaptation/adaptDays');
  if(days!==undefined&&Number.isFinite(days)&&days>=-60&&days<=100){w.economy!.adaptationDays=days;notes.def('time','Adaptation du conteur','exact',String(days));}
 }
 const quest=w.worldSites263?.quest;
 if(quest){quest.knownColonistIds=w.pawns.filter(freeColonist).map(p=>p.id);const days=num(save.game,'storyWatcher/watcherPopAdaptation/adaptDays');if(days!==undefined&&Number.isFinite(days)&&days>=0)quest.populationAdaptationDays=days;}
}

/** Runtime qualification is distinct from identical future Core RNG draws. */
export function reportRwsLifetimeLimits(ctx:ImportContext):void {
 const {w,notes}=ctx;
 const actual=[...w.pawns,...(w.worldPawns?.owners??[]).flatMap(r=>r.kind==='human'&&r.mode==='active'?[r.actor]:[])];
 const birthdays=actual.filter(p=>p.nativeHuman&&p.state!=='dead'&&!p.health?.death).map(p=>{
  const core=nativeHumanBiologicalCore256(p);return Math.ceil((3600000-core%3600000)/10);
 });
 if(!birthdays.length)return;
 const next=Math.min(...birthdays);
 const warning=`Vieillissement natif actif : les neuf affections d’anniversaire Core peuvent apparaître. Premier anniversaire estimé dans ${next} ticks locaux (${(next/6000).toFixed(2)} jours). La cadence locale et le flux aléatoire d’ElseWhere ne garantissent pas les mêmes tirages que RimWorld ; l’ordre global des souvenirs d’Alzheimer reste adapté.`;
 notes.def('pawn-state','Anniversaire biologique natif','adapted',undefined,warning,1,'model');
}
