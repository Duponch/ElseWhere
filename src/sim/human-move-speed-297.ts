import {LightEnvironmentCache,type LightReader} from './light-environment.ts';
import {pawnBody} from './health-rules.ts';
import {apparelMoveFactor} from './apparel-rules.ts';
import {weatherMoveFactor} from './weather-exposure.ts';
import {cryptosleepCarrying271} from './rescue-state.ts';
import {shipCasketCarrying277} from './ship-casket-carry-277.ts';
import {groupHumanCarrying257} from './group-human-admission-257.ts';
import {kidnapCarrying261} from './caravan-kidnap-261.ts';
import {glowIgnoredByBlindPawn} from './glow-rules-301.ts';
import type {Pawn,World} from './types.ts';
const light=new WeakMap<World,LightEnvironmentCache>();
export function invalidateHumanMoveSpeed297(w:World):void {light.delete(w);}
/** Borrowed only until a command, macro mutation or physical impact. */
export function humanMoveSpeedFactor297(w:World,p:Pawn,read?:LightReader):number {
 let cache=light.get(w);if(!read&&!cache){cache=new LightEnvironmentCache();light.set(w,cache);}
 let factor=(glowIgnoredByBlindPawn(w,p)?1:read?(typeof read.speedAt==='function'?read.speedAt(p):(read()??cache!.read(w)).speedAt(p)):cache!.speedAt(w,p))*pawnBody(p).capacities.moving*apparelMoveFactor(w,p)*weatherMoveFactor(w,p);
 if(p.prisoner)factor*=.35;
 if(p.rescue?.phase==='carry'||cryptosleepCarrying271(p)||shipCasketCarrying277(p)||groupHumanCarrying257(w,p.id)||kidnapCarrying261(p))factor*=.6;
 return factor;
}
