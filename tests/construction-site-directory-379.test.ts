import {afterEach,expect,test} from 'vitest';
import type {World,Job} from '../src/sim/types';
import {footprintCells} from '../src/sim/definitions';
import {constructionObstructions,constructionSiteWork379} from '../src/sim/construction-rules';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {withPileIndexScope,assignPileOwner} from '../src/sim/pile-index';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';
afterEach(()=>setTerrainWriteCacheVerification(false));
const plan=(id:number,kind:Job['kind'],x:number,z:number):Job=>({id,kind,x,z,orientation:0,footprint:'standard',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
test('construction sites reuse real footprint membership and select ordered ground blockers without scanning unrelated stock',()=>{
 const w={schemaVersion:379,width:32,height:32,tiles:Array.from({length:1024},()=>({terrain:'grass'})),structures:[],jobs:[plan(1,'battery',4,4),plan(2,'shelf',10,10)],pawns:[],piles:[],resources:[],packed:[],tick:1,phaseCore297:0} as unknown as World;
 const [first,last]=footprintCells(w.jobs[0]!),shelf=footprintCells(w.jobs[1]!)[0]!;
 const p1={id:900,kind:'wood' as const,item:'wood' as const,quantity:5,owner:{type:'ground' as const,...last!}},p2={id:901,kind:'wood' as const,item:'wood' as const,quantity:5,owner:{type:'ground' as const,...first!}},allowed={id:902,kind:'wood' as const,item:'wood' as const,quantity:10,owner:{type:'ground' as const,...shelf}},blocked={id:903,kind:'chunk' as const,item:'granite-chunk' as const,quantity:1,owner:{type:'ground' as const,...shelf}};
 w.piles=Array.from({length:600},(_,i)=>({id:10000+i,kind:'wood',item:'wood',quantity:1,owner:{type:'ground',x:25,z:25}}));w.piles.push(p1,p2,allowed,blocked);
 const check=()=>expect(constructionObstructions(w)).toEqual(constructionObstructions({...w,jobs:w.jobs.slice()} as World));
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope({},()=>withPileIndexScope(()=>{
  const before=constructionSiteWork379();expect(constructionObstructions(w).get(1)!.pile).toBe(p1);expect(constructionObstructions(w).get(2)!.pile).toBe(blocked);
  // One same-tick physical transfer removes the ambiguity. The geometric
  // directory is unchanged while its new pile index must answer live.
  assignPileOwner(p1,{type:'ground',x:20,z:20});
  const snapshot=constructionSiteWork379();for(let i=0;i<10;i++){expect(constructionObstructions(w).get(1)!.pile).toBe(p2);expect(constructionObstructions(w).get(2)!.pile).toBe(blocked);}
  const after=constructionSiteWork379();expect(after.geometryBuilds-before.geometryBuilds).toBe(1);expect(after.groundScans-snapshot.groundScans).toBe(0);expect(after.indexedGroundReads-snapshot.indexedGroundReads).toBe(20);
  w.jobs.push(plan(3,'wall',25,25));expect(constructionObstructions(w).get(3)!.pile).toBe(w.piles[0]);expect(constructionSiteWork379().geometryBuilds-after.geometryBuilds).toBe(1);
  check();
 }));
 w.jobs[0]!.x=20;check();
});
