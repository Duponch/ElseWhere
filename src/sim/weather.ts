import {biomeWeatherCommonality256,WEATHER_ORDER_256} from './biome-weather-256.ts';
import {tutorialMode347} from './game-profile.ts';
import { captureStandability } from './furniture-travel.ts';
import { isRoofed } from './roof-rules.ts';
import { preventsRain } from './flashstorm.ts';
import { WEATHER,WEATHER_KINDS,rainfallWeight,type WeatherKind } from './weather-definitions.ts';
import type { Cell,World } from './types.ts';

export interface WeatherState {
  revision:1;originTick:number;lastCoreTick:number;rng:number;current:WeatherKind;previous:WeatherKind;
  ageCore:number;durationCore:number;fireWatchCore:number;largeFire:boolean;lightningCount:number;
  lastLightning?:Cell&{coreTick:number};
}
export interface WeatherInputs {outsideTemperature:number;rainfall:number;fireDanger:()=>number;lightning:(cell:Cell,coreTick:number)=>void}
export function newWeatherState(seed:number,tick=0):WeatherState {
  return {revision:1,originTick:tick,lastCoreTick:tick*10,rng:((seed^0x4f1bbcdc)>>>0)||1,current:'clear',previous:'clear',ageCore:0,durationCore:10000,fireWatchCore:tick*10,largeFire:false,lightningCount:0};
}
export function adoptWeather(w:World):void {if(!w.weather)w.weather=newWeatherState(w.seed,w.tick);}
function random(state:WeatherState):number {let x=state.rng;x^=x<<13;x^=x>>>17;x^=x<<5;state.rng=x>>>0;return state.rng/4294967296;}
export const weatherTransition=(w:World):number=>w.weather?Math.min(1,w.weather.ageCore/4000):1;
function blended(w:World,key:'rain'|'snow'|'wind'|'offset'|'movement'|'accuracy'):number {
  const s=w.weather;if(!s)return key==='wind'||key==='movement'||key==='accuracy'?1:0;
  const a=WEATHER[s.previous][key],b=WEATHER[s.current][key];return a+(b-a)*weatherTransition(w);
}
/** Core intentionally includes snowfall in RainRate, used by fire extinction. */
export const weatherRainRate=(w:World):number=>blended(w,'rain');
export const weatherSnowRate=(w:World):number=>blended(w,'snow');
export const weatherWindFactor=(w:World):number=>blended(w,'wind');
export const weatherWindOffset=(w:World):number=>blended(w,'offset');
export const weatherMovement=(w:World):number=>blended(w,'movement');
export const weatherAccuracy=(w:World):number=>blended(w,'accuracy');
export function perceivedWeather(w:World):WeatherKind {
  const s=w.weather;if(!s)return 'clear';
  const a=WEATHER[s.previous].priority,b=WEATHER[s.current].priority,threshold=b>a?.18:a>b?.82:.5;
  return weatherTransition(w)<threshold?s.previous:s.current;
}
export function weatherWeights(w:World,temperature:number,rainfall:number):Array<{kind:WeatherKind;weight:number}> {
  const s=w.weather,dry=preventsRain(w);
  const site=worldWeatherSite256(w);
  return (site?WEATHER_ORDER_256:WEATHER_KINDS).map(kind=>{const d=WEATHER[kind];
    const allowed=(kind==='clear'||kind!==s?.current)&&temperature>=d.minimum&&temperature<=d.maximum&&(!d.storm||w.tick>=48000)
      &&(!dry||d.rain<=.1);
    const base=site?biomeWeatherCommonality256(site.biome,kind,rainfall):d.weight*rainfallWeight(kind,rainfall);
    return {kind,weight:allowed?(site?Math.fround(base*(s?.largeFire&&d.rain>.1?15:1)):base*(s?.largeFire&&d.rain>.1?15:1)):0};
  });
}
function nextWeather(w:World,inputs:WeatherInputs):void {
  const s=w.weather!,weights=weatherWeights(w,inputs.outsideTemperature,inputs.rainfall),sum=weights.reduce((n,v)=>n+v.weight,0);
  let choice:WeatherKind='clear';
  // Schema 347: WeatherDecider.ChooseNextWeather picks Clear, without a
  // draw, in the tutorial whenever the biome lists it (every biome does).
  if(!tutorialMode347(w)||!weights.some(v=>v.kind==='clear')){
    let roll=random(s)*sum;
    for(const v of weights){roll-=v.weight;if(roll<0){choice=v.kind;break;}}
  }
  s.previous=s.current;s.current=choice;s.ageCore=0;
  s.durationCore=WEATHER[choice].storm?15000+Math.floor(random(s)*25001):16000+Math.floor(random(s)*144001);
}
/** Constructed buildings are captured only for this synchronous strike. */
function strikeCell(w:World,s:WeatherState):Cell|undefined {
  const stand=captureStandability(w),plants=new Set<number>();
  for(const r of w.resources)if(r.kind==='tree'||r.kind==='rock')plants.add(r.z*w.width+r.x);
  const valid=(i:number)=>!plants.has(i)&&!isRoofed(w,i)&&stand({x:i%w.width,z:Math.floor(i/w.width)});
  for(let attempt=0;attempt<64;attempt++){const i=Math.floor(random(s)*w.tiles.length);if(valid(i))return {x:i%w.width,z:Math.floor(i/w.width)};}
  const candidates:number[]=[];for(let i=0;i<w.tiles.length;i++)if(valid(i))candidates.push(i);
  if(!candidates.length)return;
  const i=candidates[Math.floor(random(s)*candidates.length)]!;return {x:i%w.width,z:Math.floor(i/w.width)};
}
/** No catch-up inventions: the saved Core clock advances only with the world.
 * The event callback immediately applies physical fire before another strike. */
export function advanceWeather(w:World,inputs:WeatherInputs):void {
  const s=w.weather;if(!s)return;
  // Core filters the next weather rather than erasing the outgoing rain.
  if(w.flashstorm?.active?.start===w.tick&&WEATHER[s.current].rain>.1)nextWeather(w,inputs);
  const end=w.tick*10;
  for(let core=s.lastCoreTick+1;core<=end;core++){
    if(core%426===0){s.largeFire=inputs.fireDanger()>90;s.fireWatchCore=core;}
    s.ageCore++;
    const d=WEATHER[s.current],duration=s.largeFire||inputs.outsideTemperature<d.minimum||inputs.outsideTemperature>d.maximum?Math.floor(s.durationCore*.25):s.durationCore;
    if(s.ageCore>duration)nextWeather(w,inputs);
    const strength=Math.min(1,s.ageCore/4000);
    for(const [kind,factor] of [[s.current,strength],[s.previous,1-strength]] as const){
      if(!WEATHER[kind].storm||factor<=0)continue;
      if(random(s)>=factor/1200)continue;
      const cell=strikeCell(w,s);if(!cell)continue;
      s.lightningCount++;s.lastLightning={...cell,coreTick:core};inputs.lightning(cell,core);
    }
    s.lastCoreTick=core;
  }
}

function worldWeatherSite256(w:World){return w.schemaVersion>=256&&w.site?.revision===3?w.site:undefined;}
