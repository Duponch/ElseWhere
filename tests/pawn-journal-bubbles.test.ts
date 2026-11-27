import {afterEach,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import type {Pawn,World,WorldEvent} from '../src/sim/types';
import {ConfirmedJournalCursor,personalJournalEvents,journalPictogram} from '../src/ui/journal-events';
import {PawnJournalFeedback,JOURNAL_BUBBLE_LIMITS} from '../src/render/pawn-journal-feedback';
import {MapLabelBatch} from '../src/render/MapLabelBatch';
import {PawnJournalBubbles} from '../src/render/PawnJournalBubbles';
import {layoutLogTab} from '../src/ui3d/native-tab-social';

const pawn=(id=1,name='Ada')=>({id,name,faction:'colony',state:'idle',x:2,z:2} as Pawn);
const event=(n:number,tick=10):WorldEvent=>({tick,type:'need',message:`Bavardage entre Ada et Noé. (${n})`});
const world=(events:WorldEvent[]=[],tick=10,pawns=[pawn()])=>({seed:11,width:16,height:16,tick,pawns,events} as World);
afterEach(()=>vi.useRealTimers());

test('confirmed cursor baselines loading, preserves occurrences at the same tick and follows the eighty-entry rollover',()=>{
  const cursor=new ConfirmedJournalCursor(),old=Array.from({length:80},(_,i)=>event(i));
  expect(cursor.read(old,10)).toEqual([]);
  expect(cursor.read(old.map(e=>({...e})),10)).toEqual([]);
  const duplicate={...old[79]!},next=[...old.slice(1),duplicate];
  expect(cursor.read(next,10)).toEqual([duplicate]);
  expect(cursor.read([...next.slice(1),duplicate],10)).toEqual([duplicate]);
  const replacement=Array.from({length:80},(_,i)=>event(i+80));expect(cursor.read(replacement,10)).toEqual(replacement);
  expect(cursor.read([event(90)],11,true)).toEqual([]);
  expect(cursor.read([event(1)],1)).toEqual([]);
  cursor.clear();expect(cursor.read([],20)).toEqual([]);expect(cursor.read([event(2,20)],20)).toEqual([event(2,20)]);
  const mutable:WorldEvent[]=[];cursor.clear();expect(cursor.read(mutable,30)).toEqual([]);mutable.push(event(3,30));expect(cursor.read(mutable,30)).toEqual([event(3,30)]);
});

test('each admitted new personal log enters FIFO; real-time expiration advances it while simulation stays paused',()=>{
  vi.useFakeTimers();let notices:readonly {text:string}[]=[];
  const queue=new PawnJournalFeedback(next=>{notices=next;},()=>Date.now());
  try{
    queue.adopt(world([event(0)]));expect(notices).toEqual([]);
    queue.adopt(world([event(0),event(1),event(2)]));
    expect(notices.map(n=>n.text)).toEqual([event(1).message]);expect(queue.snapshot().pending).toBe(1);
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs);expect(notices.map(n=>n.text)).toEqual([event(2).message]);
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs);expect(notices).toEqual([]);
    queue.adopt(world([event(0),event(1),event(2)]));expect(notices).toEqual([]);
  }finally{queue.dispose();}
});

test('bursts stay bounded and every overflow is counted in a visible journal summary',()=>{
  vi.useFakeTimers();const queue=new PawnJournalFeedback(()=>{},()=>Date.now());
  try{
    queue.adopt(world());queue.adopt(world(Array.from({length:80},(_,i)=>event(i)),11));
    const first=queue.snapshot();expect(first.visible.length).toBe(1);expect(first.pending).toBeLessThanOrEqual(3);
    expect(first.visible.length+first.pending+first.summarized).toBe(80);
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs*3);
    expect(queue.snapshot().visible[0]).toMatchObject({summarized:77,text:'77 autres événements dans le Journal.'});
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs);expect(queue.snapshot().visible).toEqual([]);
  }finally{queue.dispose();}
});

test('at most eight owners are visible and pending owners advance without replaying earlier entries',()=>{
  vi.useFakeTimers();const people=Array.from({length:12},(_,i)=>pawn(i+1,'Colon'+i)),queue=new PawnJournalFeedback(()=>{},()=>Date.now());
  try{
    queue.adopt(world([],10,people));const events=people.map((p,i)=>({tick:11,type:'need' as const,message:`Bavardage entre ${p.name} et Visiteur. (${i})`}));queue.adopt(world(events,11,people));
    expect(queue.snapshot().visible).toHaveLength(8);expect(new Set(queue.snapshot().visible.map(n=>n.pawnId)).size).toBe(8);expect(queue.snapshot().pending).toBe(4);
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs);expect(queue.snapshot().visible.map(n=>n.pawnId)).toEqual([9,10,11,12]);
    vi.advanceTimersByTime(JOURNAL_BUBBLE_LIMITS.durationMs);expect(queue.snapshot().visible).toEqual([]);
  }finally{queue.dispose();}
});

test('text events never choose a homonym or a substring as an actor; renaming, disabling and reset drop transient ownership',()=>{
  const queue=new PawnJournalFeedback(()=>{},()=>0);
  try{
    queue.adopt(world([],10,[pawn(),pawn(2,'Ada')]));queue.adopt(world([event(1)],11,[pawn(),pawn(2,'Ada')]));expect(queue.snapshot().visible).toEqual([]);
    queue.adopt(world([],12,[pawn(1,'Ad')]));queue.adopt(world([event(2,13)],13,[pawn(1,'Ad')]));expect(queue.snapshot().visible).toEqual([]);
    queue.adopt(world([],14));queue.adopt(world([event(3,15)],15));expect(queue.snapshot().visible).toHaveLength(1);
    queue.adopt(world([event(3,15)],16,[pawn(1,'Mina')]));expect(queue.snapshot().visible).toEqual([]);
    queue.setEnabled(false);queue.adopt(world([event(4,17)],17));queue.setEnabled(true);queue.adopt(world([event(4,17)],17));expect(queue.snapshot().visible).toEqual([]);
    queue.adopt(world([event(4,17),event(5,18)],18));expect(queue.snapshot().visible).toHaveLength(1);
    queue.adopt(world([event(4,17),event(5,18)],18),true);expect(queue.snapshot().visible).toEqual([]);
  }finally{queue.dispose();}
});

test('personal journal and history share semantic pictograms; unrelated jobs do not become invented social dialogue',()=>{
  const events:WorldEvent[]=[event(1),{tick:11,type:'need',message:'Ada a insulté Noé.'},{tick:12,type:'need',message:'Ada et Noé deviennent partenaires.'},{tick:13,type:'need',message:'Frénésie incendiaire : Ada.'},{tick:14,type:'job',message:'Ada a retiré un meuble.'}];
  const rows=personalJournalEvents(world(events,14),pawn());expect(rows.map(r=>r.icon)).toEqual(['mental','romance','insult','chat']);
  for(const row of rows)expect(row.icon).toBe(journalPictogram(row.event));expect(journalPictogram(events[4]!)).toBe('work');
  const card=layoutLogTab({type:'log',toggles:[],copy:{id:'copy',label:'Copier',onActivate:()=>{}},emptyText:'',lines:rows.map(row=>({kind:'entry',id:String(row.index),text:row.event.message,hint:'',icon:row.icon}))},(text)=>text.length*7);
  expect(card.items.filter(item=>item.k==='glyph'&&item.glyph==='journal').map(item=>item.k==='glyph'&&item.journalIcon)).toEqual(rows.map(row=>row.icon));
});

test('speech backgrounds, icons and text share one resident draw; moving an active anchor never rebuilds glyph layout',()=>{
  const batch=new MapLabelBatch({journalBubbles:true}),camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,100),ordinary=new MapLabelBatch();
  try{
    batch.update([{x:1,y:2,z:3,ownerId:1,icon:'romance',label:'Ada et Noé deviennent partenaires.'}]);batch.present(camera,600,32,12);
    const geometry=batch.mesh.geometry,offsets=geometry.getAttribute('labelOffset'),glyphs=geometry.getAttribute('labelGlyph'),before=offsets.array.slice(),count=geometry.instanceCount;
    expect(batch.mesh.visible).toBe(true);expect(count).toBeGreaterThan(3);expect(geometry.hasAttribute('labelSize')).toBe(true);expect(ordinary.mesh.geometry.hasAttribute('labelSize')).toBe(false);
    batch.syncSpeechAnchors(()=>({x:7,y:2,z:9}));expect(batch.mesh.geometry).toBe(geometry);expect(geometry.getAttribute('labelGlyph')).toBe(glyphs);expect(offsets.array).toEqual(before);expect(geometry.instanceCount).toBe(count);
    const positions=geometry.getAttribute('labelAnchor');for(let i=0;i<count;i++)expect([positions.getX(i),positions.getY(i),positions.getZ(i)]).toEqual([7,2,9]);
    batch.update([]);expect(batch.mesh.visible).toBe(false);expect(geometry.instanceCount).toBe(0);
  }finally{batch.dispose();ordinary.dispose();}
});
test('the actual journal overlay is readable above a near wall without changing ordinary item depth',()=>{
  const overlay=new PawnJournalBubbles(()=>({x:1,y:2,z:3})),ordinary=new MapLabelBatch();
  try{expect(overlay.mesh.material.depthTest).toBe(false);expect(overlay.mesh.material.depthWrite).toBe(false);expect(ordinary.mesh.material.depthTest).toBe(true);}
  finally{overlay.dispose();ordinary.dispose();}
});
