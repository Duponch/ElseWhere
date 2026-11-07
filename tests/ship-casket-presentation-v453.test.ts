import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {shipCasketServiceCamp277} from './scenarios/ship-casket-service-v453.ts';
import {shipCasketParts277,SHIP_CASKET_MODEL_BOUNDS_277} from '../src/render/ship-casket-parts277';
import {shipCasketRect277} from '../src/sim/ship-casket-geometry-277';
import {electricalParts} from '../src/render/electrical-parts';
import {buildFurniture} from '../src/render/FurnitureLayer';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {ARCHITECT_ICON_MAPPING,ARCHITECT_ICON_URLS} from '../src/ui/architect-icons';
import {modelIconUrl} from '../src/ui/pictograms';
import {placementMaterial} from '../src/ui/construction-controls';
import {powerInspection} from '../src/ui/power-inspection';
import {toolDefinitions} from '../src/ui/layout';
import {newCryptosleepHolder271,type PlayerCasket271} from '../src/sim/cryptosleep-state-271';
import {readColonistAvailability} from '../src/ui/colonist-availability';
import {readAvailabilityStatusAlerts} from '../src/ui/status-alerts';
import {personNotificationTarget,knownNotificationTarget256,objectNotificationTarget} from '../src/ui/notification-focus';
import {readFirstDayGuide} from '../src/ui/first-day-guide';
import type {Placement} from '../src/render/primitives';
import type {BoxBatches} from '../src/render/BoxBatches';

const shape=({key:_key,targetId:_target,...p}:Placement)=>p;
test.each([0,1,2,3] as const)('original spatial model and plan share the true two-cell center, rotation%i and resident batch',orientation=>{
 const {w,casket}=shipCasketServiceCamp277();casket.orientation=orientation;const before=structuredClone(w),parts=shipCasketParts277(casket),r=shipCasketRect277(casket,orientation);
 expect(parts).toHaveLength(14);for(const p of parts){
  const rx=Math.abs(Math.cos(p.ry??0))*(p.sx??1)/2+Math.abs(Math.sin(p.ry??0))*(p.sz??1)/2,rz=Math.abs(Math.sin(p.ry??0))*(p.sx??1)/2+Math.abs(Math.cos(p.ry??0))*(p.sz??1)/2;
  expect(p.x-rx).toBeGreaterThanOrEqual(r.x-.5-1e-12);expect(p.x+rx).toBeLessThanOrEqual(r.x+r.width-.5+1e-12);expect(p.z-rz).toBeGreaterThanOrEqual(r.z-.5-1e-12);expect(p.z+rz).toBeLessThanOrEqual(r.z+r.depth-.5+1e-12);expect(p.y+(p.sy??1)/2).toBeLessThanOrEqual(SHIP_CASKET_MODEL_BOUNDS_277.height+1e-12);
 }
 expect(electricalParts(w)).toEqual(parts);const preview=constructionPreviewParts(w,[{kind:casket.kind,x:casket.x,z:casket.z,orientation,material:'steel'}]);expect(preview.boxes.map(shape)).toEqual(parts.map(shape));
 const calls=new Map<string,Placement[]>();buildFurniture(w,new THREE.Group(),false,{set:(_g:THREE.Group,n:string,p:Placement[])=>calls.set(n,p)} as unknown as BoxBatches);expect(calls.get('furniture')).toEqual(parts);expect(w).toEqual(before);
});
test('occupancy alone changes the lid and both signature paths; unrelated holder clocks do not rebuild geometry',()=>{
 const {w,casket,actor}=shipCasketServiceCamp277(),raw=new StructurePresentationSignature(),confirmed=new ConfirmedStructurePresentationSignature(),empty=raw.read(w.structures,'',''),emptyParts=shipCasketParts277(casket);expect(confirmed.readConfirmed(w.structures,'','')).toBe(empty);
 // Presentation-only input, not a prepared playable holder or owner fixture.
 casket.shipCryptosleep277.occupant={kind:'human',pawn:actor};const closed=raw.read(w.structures,'','');expect(closed).not.toBe(empty);expect(confirmed.readConfirmed(w.structures,'','',[0])).toBe(closed);expect(shipCasketParts277(casket)).not.toEqual(emptyParts);
 casket.shipCryptosleep277.heldAt++;expect(raw.read(w.structures,'','')).toBe(closed);expect(confirmed.readConfirmed(w.structures,'','',[0])).toBe(closed);
});
test('spatial catalogue has its own original image, stable historical UV and passive power label',()=>{
 const {w,casket}=shipCasketServiceCamp277();expect(placementMaterial(casket.kind,'wood')).toBe('steel');expect(toolDefinitions.find(t=>t.id===casket.kind)).toMatchObject({category:'ship'});expect(modelIconUrl(casket.kind)).toBe('/assets/ui/elsewhere/pictograms-20261107/ship-cryptosleep-casket.svg');expect(ARCHITECT_ICON_URLS[casket.kind]).toBe(modelIconUrl(casket.kind));expect(ARCHITECT_ICON_MAPPING[casket.kind]).toEqual(ARCHITECT_ICON_MAPPING.bed);
 const text=powerInspection(w,casket);expect(text).toContain('Transmission électrique passive');expect(text).not.toContain('Non raccordée');expect(text).not.toContain('Demande 0 W');
});

test.each(['ship-casket','player-casket'] as const)('the same living suspended colonist is unavailable and focuses the actual %s rather than an absent actor',owner=>{
 const {w,casket,actor}=shipCasketServiceCamp277(1);
 expect(readColonistAvailability(w)).toEqual({kind:'available',pawnIds:[actor.id]});
 // Presentation-only owner snapshot: the original is moved out of the map
 // container, never copied or presented as a newly played admission.
 w.pawns=[];
 if(owner==='ship-casket'){casket.shipCryptosleep277.occupant={kind:'human',pawn:actor};actor.shipCryptosleepHeldAt277=w.tick;}
 else{
  const ordinary:PlayerCasket271={id:casket.id,kind:'cryptosleep-casket',x:casket.x,z:casket.z,orientation:casket.orientation,footprint:'standard',material:'steel',power:{on:false,parentId:null},cryptosleep:newCryptosleepHolder271(w.tick)};
  ordinary.cryptosleep.human=actor;actor.cryptosleepHeldAt271=w.tick;w.structures=[ordinary];
 }
 const before=structuredClone(w),target=objectNotificationTarget('structure',casket.id,casket),availability=readColonistAvailability(w);
 expect(availability).toEqual({kind:'unavailable',local:[],away:[],deaths:[],suspended:[{id:actor.id,name:actor.name,owner,casketId:casket.id}]});
 expect(personNotificationTarget(w,actor.id)).toEqual(target);expect(knownNotificationTarget256(w,target)).toBe(true);
 const rows=readAvailabilityStatusAlerts(w);expect(rows[0]).toEqual({key:'colonist-availability',text:'Aucun colon libre sur cette carte',targets:[target]});
 expect(rows[1]).toMatchObject({key:`availability-suspended:${actor.id}`,targets:[target]});expect(rows[1]!.text).toContain(`${actor.name} · vivant, en cryptosommeil`);
 expect(rows.map(r=>r.text).join(' ')).not.toMatch(/décès|arrivée|Aucun colon vivant/);
 const work=readFirstDayGuide(w).find(r=>r.id==='work')!;expect(work.action).toEqual({target});expect(work.actionLabel).toBe('Inspecter le caisson');expect(w).toEqual(before);
 w.structures=[];expect(personNotificationTarget(w,actor.id)).toBeUndefined();expect(Object.hasOwn(readColonistAvailability(w),'suspended')).toBe(false);
});
