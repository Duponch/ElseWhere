import {deconstructionCamp} from './deconstruction.ts';
import {COMPLEX_FURNITURE_RESEARCH_COST} from '../../src/sim/research.ts';

/** New phase-zero fixture: preserve its real path-budget owner and clock. */
export function blueprintStorageCamp380(){
 const w=deconstructionCamp();w.stockpiles=[];w.growingZones=[];
 w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
 for(const p of w.pawns){p.background={childhood:'workshop-child',adulthood:'artisan'};p.schedule.fill('work');p.recreation.level=100;}
 return w;
}
