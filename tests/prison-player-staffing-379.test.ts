import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/engine';
import {backgroundWorkRefusal} from '../src/sim/colonist-backgrounds';
import {medicalCamp} from './scenarios/health';
import {prisonStaffingDecisions} from './scenarios/prison-player';
import type {Decision} from './scenarios/colony-player';

test('recruit staffing keeps the visible incapable work cells disabled in inherited and prison notebooks',()=>{
 const w=medicalCamp(2),recruit=w.pawns[0]!,other=w.pawns[1]!;
 // The background genuinely encountered in the schema379 J85 campaign.
 recruit.background={childhood:'ChildStar74',adulthood:'Hunter89'};delete other.background;
 expect(backgroundWorkRefusal(recruit,'haul')).toContain('enfant star');
 expect(backgroundWorkRefusal(recruit,'grow')).toBeUndefined();
 const priority=(pawnId:number,work:'haul'|'grow',value:0|1|2|3):Decision=>({reason:'Staffing notebook',command:{type:'priority',pawnId,work,value}});
 const invalid=priority(recruit.id,'haul',2),baseGrow=priority(recruit.id,'grow',3),finalGrow=priority(recruit.id,'grow',2),otherHaul=priority(other.id,'haul',2);
 const planned=prisonStaffingDecisions(w,[invalid,baseGrow,otherHaul,finalGrow]);
 expect(planned).toEqual([finalGrow,otherHaul]);
 for(const d of planned)expect(applyCommand(w,d.command)).toMatchObject({ok:true});
 expect(recruit.priorities.haul).toBe(0);expect(recruit.priorities.grow).toBe(2);expect(other.priorities.haul).toBe(2);
 const disable=priority(recruit.id,'haul',0);expect(prisonStaffingDecisions(w,[invalid,disable])).toEqual([disable]);
});
