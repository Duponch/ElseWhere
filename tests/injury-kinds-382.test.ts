import {expect,it} from 'vitest';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {injuryInfectionChance} from '../src/sim/infection-rules.ts';
import {resolveUnarmoredMelee} from '../src/sim/melee-impact.ts';
import {INJURY_RULES} from '../src/sim/injury-rules.ts';

it('keeps Core scratch rather than cut for the live combat producer and retains old resolved wounds',()=>{
 const record=createMedicalRecord(0),hit={kind:'scratch' as const,damage:2,part:'left-arm' as const};
 const current=resolveUnarmoredMelee(record,hit,()=>.99,undefined,true,true);
 expect(current.layers[0]).toMatchObject({part:'left-arm',kind:'scratch'});
 expect(resolveUnarmoredMelee(record,hit,()=>.99,undefined,true,false).layers[0]).toMatchObject({part:'left-arm',kind:'cut'});
 expect(INJURY_RULES.scratch).toMatchObject({painUnits:INJURY_RULES.cut.painUnits,bleedUnits:INJURY_RULES.cut.bleedUnits,scar:true,merge:false});
 expect(injuryInfectionChance(record,{kind:'scratch',part:'left-arm'})).toBe(injuryInfectionChance(record,{kind:'cut',part:'left-arm'}));
 expect(injuryInfectionChance(record,{kind:'surgical-cut',part:'left-arm'})).toBe(0);
});
