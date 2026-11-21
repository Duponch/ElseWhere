import { createScenarioWorld } from '../../src/sim/new-game.ts';
import { stepWorld } from '../../src/sim/engine.ts';
import { refreshStock } from '../../src/sim/materials.ts';
import type { Mechanoid } from '../../src/sim/mechanoid-state.ts';
import type { World } from '../../src/sim/types.ts';

export function fixtureMechanoid(w:World,x:number,z:number):Mechanoid {
  const m:Mechanoid={id:w.nextId++,mechKind:'scyther',x,z,state:'idle',path:[],heading:0,moveCooldown:0,planCooldown:0};
  (w.mechanoids??=[]).push(m);return m;
}
/** Prepared positions and staging mandate only; no movement or blow played. */
export function mechanoidCombatCamp(){
  const w=createScenarioWorld(42,96,'crashlanded');
  // Preserve authentic site, provenance and every creation calendar. Clear only
  // the prepared spatial inventory, then let the real first tick adopt clocks.
  w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];w.growingZones=[];
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));delete w.wildlife;w.pawns=w.pawns.slice(0,2);
  // Schema 343: the landing gives CrashedTogether opinions and a NewColony
  // memory to every starter; drop the ones that name the pawn removed here.
  const kept=new Set(w.pawns.map(p=>p.id));
  for(const p of w.pawns)if(p.social?.memories)p.social.memories=p.social.memories.filter(m=>kept.has(m.otherId));
  if(w.worldGroups?.lostMemories)w.worldGroups.lostMemories=w.worldGroups.lostMemories.filter(m=>kept.has(m.receiverId)&&(m.otherId===null||kept.has(m.otherId)));
  for(const p of w.pawns){p.hunger=100;p.rest=100;p.recreation.level=100;p.bedId=null;p.schedule.fill('work');
    for(const kind of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[kind]=0;}
  Object.assign(w.pawns[0]!,{x:48,z:48,hostilityResponse:'ignore'});
  Object.assign(w.pawns[1]!,{x:48,z:50,hostilityResponse:'ignore'});
  refreshStock(w);stepWorld(w);w.rng=1;
  const m=fixtureMechanoid(w,44,48);
  const s=w.raids!;s.serial=1;s.nextCheck=null;
  s.mechActive={id:1,startedAt:w.tick,members:[m.id],lost:[],phase:'staging',
    stage:{point:{x:m.x,z:m.z},activatedAtCore:w.tick*10,delayCore:5000},composition:{budget:150,roster:['scyther']}};
  m.raid={group:1,goal:null};return {w,m,victim:w.pawns[0]!};
}
