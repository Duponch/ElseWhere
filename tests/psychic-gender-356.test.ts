import {expect,test,vi} from 'vitest';
import {stepWorld} from '../src/sim/engine.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {pawnGender350} from '../src/sim/mood-pool-350.ts';
import {psychicActive350,resolveSelectedPsychic350} from '../src/sim/psychic-emanation-350.ts';
import {adoptMiscIncidents} from '../src/sim/cassandra-misc.ts';
import {appearanceOf} from '../src/sim/pawn-appearance.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {type Pawn,type World} from '../src/sim/types.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const thought=(w:World,p:Pawn)=>moodThoughts(w,p).find(t=>t.id.startsWith('psychic-'));
function until(w:World,done:()=>boolean,limit:number){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done()).toBe(true);}

/** A colony whose humans were saved before appearances existed: the record
 * holds no appearance, the game draws them from seed, id and name. */
function legacyColony():World{
 const w=createScenarioWorld(42,64,'crashlanded');
 until(w,()=>w.pawns.filter(x=>(x.faction??'colony')==='colony').length>=3&&!w.startingArrival,3000);
 adoptMiscIncidents(w);
 for(const p of w.pawns)delete p.appearance;
 return w;
}

test('from 356 a drone on legacy pawns hits only the gender the game shows, as in Core',()=>{
 const w=legacyColony(),colonists=w.pawns.filter(x=>(x.faction??'colony')==='colony'&&!x.prisoner&&!x.visitor);
 const shown=(p:Pawn)=>appearanceOf(p,w.seed).sex;
 expect(colonists.every(p=>pawnGender350(p,w)===shown(p))).toBe(true);
 // Draws: duration first, then the gender of a free colonist.
 const draws=[.5,.4];expect(resolveSelectedPsychic350(w,'drone',()=>draws.shift()!)).toBe(true);
 const c=psychicActive350(w)!;
 expect(c.gender).toBe(shown(colonists[Math.floor(.4*colonists.length)]!));
 expect(c.gender).not.toBe('none');
 for(const p of colonists)expect(!!thought(w,p)).toBe(shown(p)===c.gender);
});

test('below 356 a legacy pawn still counts as genderless, so the drone hits all of them',()=>{
 const w=legacyColony();Object.assign(w,{schemaVersion:355});
 const colonists=w.pawns.filter(x=>(x.faction??'colony')==='colony'&&!x.prisoner&&!x.visitor);
 expect(colonists.every(p=>pawnGender350(p,w)==='none')).toBe(true);
 const draws=[.5,.4];expect(resolveSelectedPsychic350(w,'drone',()=>draws.shift()!)).toBe(true);
 expect(psychicActive350(w)!.gender).toBe('none');
 for(const p of colonists)expect(thought(w,p)).toBeDefined();
});
