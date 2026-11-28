import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {ImportContext,convertRwsSave} from '../src/import/rimworld/convert.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {prepareRwsHumanCorpseOwner,importWorldPeople} from '../src/import/rimworld/import-world-people.ts';
import {validateAncientCasketRecord256} from '../src/sim/ancient-casket-save-256.ts';
import {isAncientCasket256} from '../src/sim/ancient-casket-state-256.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const human=(id:number,health:string,goods='')=>`<li Class="Pawn"><def>Human</def><id>Human${id}</id><faction>Faction_1</faction>
<name Class="NameTriple"><first>Anne</first><nick>Anne</nick><last>Test</last></name>
<ageTracker><ageBiologicalTicks>90000007</ageBiologicalTicks><birthAbsTicks>-90000000</birthAbsTicks></ageTracker>
<story><headType>Female_AverageNormal</headType><bodyType>Female</bodyType><hairDef>Mohawk</hairDef><childhood>CaveChild30</childhood><adulthood>Hunter74</adulthood></story><gender>Female</gender>
<healthTracker>${health}</healthTracker>${goods}</li>`;
const inventory=`<inventory><innerContainer><innerList><li><def>Gold</def><id>Gold900</id><stackCount>23</stackCount></li></innerList></innerContainer></inventory>`;
function context(){const save=readRwsSave(fixture),{world,thingIds}=convertRwsSave(save,{planet:false});const ctx=new ImportContext(save,save.maps[0]!,world,new ImportNotes(),false);for(const [ref,id] of thingIds)ctx.thingIds.set(ref,id);return ctx;}

it('constructs a true frozen ancient occupant with source identity and nested and direct items, never a map pawn',()=>{
 const ctx=context(),w=ctx.w,id=w.nextId++;
 const source=readThing(parseXml(`<thing Class="Building_AncientCryptosleepCasket"><def>AncientCryptosleepCasket</def><id>Casket900</id><pos>(6,0,6)</pos><innerContainer><innerList>${human(900,'<hediffSet><hediffs/></hediffSet>',inventory)}<li><def>Steel</def><id>Steel901</id><stackCount>5</stackCount></li></innerList></innerContainer></thing>`));
 ctx.map.things.push(source);ctx.thingIds.set(source.id,id);
 w.structures.push({id,kind:'ancient-cryptosleep-casket',x:6,z:13,orientation:0,footprint:'standard',factionId:null,casket:{revision:1,groupId:-1,contentsKnown:false,heldAt:w.tick,humans:[],animals:[],items:[]}});
 const oldCount=w.pawns.length;importWorldPeople(ctx);
 const holder=w.structures.find(s=>s.id===id);if(!isAncientCasket256(holder))throw Error('Missing real holder');
 const p=holder.casket.humans[0];expect(p?.name).toBe('Anne Test');expect(p?.nativeHuman?.name.first).toBe('Anne');
 expect(p?.x).toBe(-1000);expect(w.pawns.length).toBe(oldCount);
 expect(holder.casket.items).toEqual(expect.arrayContaining([expect.objectContaining({item:'gold',quantity:23,owner:{type:'inventory',pawnId:p!.id}}),expect.objectContaining({item:'steel',quantity:5,owner:{type:'ancient-casket',casketId:id}})]));
 expect(ctx.thingIds.get('Human900')).toBe(p!.id);expect(validateAncientCasketRecord256(holder,w)).toEqual([]);
});

it('admits a true blood-loss death at its source time without deriving a cause from postmortem injury',()=>{
 const ctx=context();ctx.w.tick=Math.max(ctx.w.tick,6000);
 const death=3000,heddiffs=`<healthState>Dead</healthState><hediffSet><hediffs><li><def>BloodLoss</def><severity>1</severity><tickAdded>29000</tickAdded></li><li Class="Hediff_MissingPart"><def>MissingBodyPart</def><tickAdded>30004</tickAdded><part><body>Human</body><index>15</index></part></li></hediffs></hediffSet>`;
 const source=readThing(parseXml(human(901,heddiffs,inventory))),id=ctx.w.nextId;
 const staged=prepareRwsHumanCorpseOwner(ctx,source,{x:6,z:6},death,30003);
 expect(staged?.pawn.health?.death).toEqual({tick:death,cause:'blood-loss'});expect(staged?.pawn.health?.missing).toEqual([]);
 expect(staged?.pawn.state).toBe('dead');expect(staged?.items[0]).toMatchObject({item:'gold',quantity:23,owner:{type:'inventory',pawnId:staged?.pawn.id}});
 expect(staged?.thingIds.get(source.id)).toBe(staged?.pawn.id);expect(ctx.thingIds.has(source.id)).toBe(false);expect(ctx.w.nextId).toBe(id);
 const unknown=readThing(parseXml(human(902,'<healthState>Dead</healthState><hediffSet><hediffs/></hediffSet>')));
 expect(prepareRwsHumanCorpseOwner(ctx,unknown,{x:6,z:6},death)).toBeUndefined();
});

it('does not invent an empty casket when its actual original occupant cannot be represented',()=>{
 const ctx=context(),w=ctx.w,id=w.nextId++;
 const source=readThing(parseXml(`<thing Class="Building_AncientCryptosleepCasket"><def>AncientCryptosleepCasket</def><id>Casket903</id><pos>(6,0,6)</pos><innerContainer><innerList>${human(903,'<healthState>Dead</healthState><hediffSet><hediffs/></hediffSet>')}</innerList></innerContainer></thing>`));
 ctx.map.things.push(source);ctx.thingIds.set(source.id,id);ctx.notes.countBefore('buildings');ctx.notes.countAfter('buildings');ctx.notes.def('buildings',source.def,'exact','ancient-cryptosleep-casket');
 w.structures.push({id,kind:'ancient-cryptosleep-casket',x:6,z:13,orientation:0,footprint:'standard',factionId:null,casket:{revision:1,groupId:-1,contentsKnown:false,heldAt:w.tick,humans:[],animals:[],items:[]}});
 importWorldPeople(ctx);expect(w.structures.some(s=>s.id===id)).toBe(false);expect(ctx.thingIds.has(source.id)).toBe(false);expect(ctx.thingIds.has('Human903')).toBe(false);expect(ctx.notes.after.get('buildings')).toBe(0);expect(ctx.notes.summary('buildings')).toEqual({exact:0,adapted:0,dropped:1,unknown:0});
});
