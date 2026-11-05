/** Producer event/lifetime contract. Only the atlas OWNER callee is a TEST
 * double; real source models, appearance writers and clinical streams run.
 * Atlas GPU/pixels are qualified separately; this test makes no such claim. */
import{expect,test,vi}from'vitest';
import type * as THREE from'three/webgpu';
const states=vi.hoisted(()=>({owners:[]as{key:string;kind:string;invalidations:number;closed:boolean}[]}));
vi.mock('../src/render/origami/baked/actors/ActorAtlasOwner',async original=>{
 const actual=await original<typeof import('../src/render/origami/baked/actors/ActorAtlasOwner')>();
 return{...actual,ActorAtlasOwner:class TestAtlasOwner{
  readonly state:{key:string;kind:string;invalidations:number;closed:boolean};private readonly mapped=new Map<THREE.NodeMaterial,THREE.NodeMaterial>();
  constructor(readonly options:{key:string;kind:string;readPort?:()=>{model:{assertCurrent():void}}|undefined}){this.state={key:options.key,kind:options.kind,invalidations:0,closed:false};states.owners.push(this.state);}
  get materials(){return[...this.mapped.values()];}
  selectedMaterial(source:THREE.NodeMaterial){let material=this.mapped.get(source);if(!material){material=source.clone();this.mapped.set(source,material);}return material;}
  invalidate(){this.state.invalidations++;}
  status(){return{scope:'TEST producer callee only',...this.state};}
  attachGpuRetirement(){}
  dispose(){if(this.state.closed)return;this.options.readPort?.()?.model.assertCurrent();this.state.closed=true;for(const material of this.mapped.values())material.dispose();this.mapped.clear();}
 }};
});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import{GraphicsStyleContext,withGraphicsStyle}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{PawnLayer}from'../src/render/PawnLayer';
import{WildlifeLayer}from'../src/render/WildlifeLayer';
import{appearanceOf}from'../src/sim/pawn-appearance';
import{animalCombatCamp}from'./scenarios/animal-combat';
const preferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default'as const,impasto:0,wear:0};

test('real human appearance adoption invalidates semantic demand, while movement/style reuse one selected material and disposal closes the atlas before source models',()=>{
 const context=new GraphicsStyleContext(preferences),layer=withGraphicsStyle(context,()=>new PawnLayer()),world=animalCombatCamp();let closed=false;
 try{
  layer.update(world,0,true);expect(layer.actorAtlasStatus()).toBeDefined();const owner=states.owners.findLast(state=>state.kind==='human'&&!state.closed)!,before=owner.invalidations,mesh=Reflect.get(layer,'pawnMesh')as THREE.Mesh,geometry=mesh.geometry,material=mesh.material;
  const moved={...world,tick:world.tick+1,pawns:world.pawns.map((pawn,index)=>index?pawn:{...pawn,x:pawn.x+1})};layer.update(moved,0,false);expect(owner.invalidations).toBe(before);expect(mesh.geometry).toBe(geometry);
  for(const style of['origami','default','origami']as const){context.update({...context.preferences,style});layer.setTexturesEnabled(false);layer.setTexturesEnabled(true);expect(mesh.material).toBe(material);}expect(owner.invalidations).toBe(before);
  const identity=appearanceOf(moved.pawns[0]!,moved.seed),coloured={...moved,pawns:moved.pawns.map((pawn,index)=>index?pawn:{...pawn,appearance:{...identity,skinColor:identity.skinColor^0x010101}})};layer.update(coloured,0,false);expect(owner.invalidations).toBeGreaterThan(before);expect(mesh.material).toBe(material);layer.dispose();closed=true;expect(owner.closed).toBe(true);
 }finally{if(!closed)layer.dispose();context.dispose();}
});

test('real animal movement keeps texture demand stable and a new cohort invalidates once; every resident and inactive atlas owner closes',()=>{
 const context=new GraphicsStyleContext(preferences),first=states.owners.length,layer=withGraphicsStyle(context,()=>new WildlifeLayer(undefined,()=>undefined)),world=animalCombatCamp();
 try{
  layer.update(world,undefined,true);const statuses=layer.actorAtlasStatus();expect(statuses.length).toBeGreaterThan(0);const snapshot=new Map(states.owners.slice(first).map(owner=>[owner.key,owner.invalidations]));
  const moved={...world,tick:world.tick+1,wildlife:{...world.wildlife!,animals:world.wildlife!.animals.map((animal,index)=>index?animal:{...animal,x:animal.x+1})}};layer.update(moved,undefined,false);for(const owner of states.owners.slice(first))expect(owner.invalidations,owner.key).toBe(snapshot.get(owner.key));
  const added={...moved,wildlife:{...moved.wildlife,animals:[...moved.wildlife.animals,{...moved.wildlife.animals[0]!,id:moved.nextId+1000}]}};layer.update(added,undefined,false);expect(states.owners.slice(first).some(owner=>owner.invalidations!>snapshot.get(owner.key)!)).toBe(true);layer.dispose();expect(states.owners.slice(first).every(owner=>owner.closed)).toBe(true);
 }finally{layer.dispose();context.dispose();}
});
