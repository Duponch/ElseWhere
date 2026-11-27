import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {AnimalModels,ANIMAL_SURFACE_PROFILE_STRIDE} from '../src/render/models/AnimalModels';
import {animalPastelPanel,ANIMAL_PASTEL_PANELS,createAnimalCoatTexture,decorateAnimalGouachePigment,ANIMAL_GOUACHE_PANELS} from '../src/render/animal-surface-paint';
import {referencePaintProfiles} from '../src/render/origami/reference-profiles';

const pixel=(texture:THREE.DataTexture,u:number,v:number)=> {
 const data=texture.image.data as Uint8Array;
 const at=4*(Math.floor(u*256)+Math.floor(v*256)*256);
 return [...data.subarray(at,at+4)];
};
const slot=(u:number,v:number)=>Math.floor(u*4)+Math.floor(v*4)*4;
const panelUV=(panel:typeof ANIMAL_PASTEL_PANELS[number],u:number,v:number)=>{
 const index=ANIMAL_PASTEL_PANELS.indexOf(panel);
 return [((index%4)*64+8.5+u*47)/256,(Math.floor(index/4)*64+8.5+v*47)/256] as const;
};

test('every real animal triangle stays in a single padded anatomical panel, with every silhouette receiving authored body paint',()=>{
 const models=new AnimalModels();
 try{
  for(const species of ANIMAL_SPECIES_IDS){
   const model=models.get(species),g=model.geometry,uv=g.getAttribute('animalSurfaceUv'),part=g.getAttribute('animalPart'),paint=g.getAttribute('animalPaint');
   const panels=new Set<string>();
   for(let t=0;t<g.index!.count;t+=3){
    const a=g.index!.getX(t),b=g.index!.getX(t+1),c=g.index!.getX(t+2);
    const ids=[a,b,c].map(i=>slot(uv.getZ(i),uv.getW(i)));
    expect(new Set(ids).size,species+' panel boundary').toBe(1);
    const profile=paint.getW(a)%ANIMAL_SURFACE_PROFILE_STRIDE,expected=animalPastelPanel(species,profile,part.getX(a),part.getW(a),part.getY(a));
    expect(ANIMAL_PASTEL_PANELS[ids[0]!],species).toBe(expected);
    panels.add(expected);
    for(const i of [a,b,c])for(const coordinate of [uv.getZ(i),uv.getW(i)]){
     const local=(coordinate*256)%64;
     expect(local).toBeGreaterThanOrEqual(8);
     expect(local).toBeLessThanOrEqual(56);
    }
   }
   expect([...panels].some(panel=>panel!=='plain'),species).toBe(true);
  }
 }finally{models.dispose();}
},60_000);

test('gazelle torso addresses dark flank, pale belly and ochre back without new textures or triangle streams',()=>{
 const models=new AnimalModels(),coat=createAnimalCoatTexture('short');
 try{
  const g=models.get('gazelle').geometry,uv=g.getAttribute('animalSurfaceUv'),paint=g.getAttribute('animalPaint'),position=g.getAttribute('position');
  const torso:number[]=[];
  for(let i=0;i<position.count;i++)if(referencePaintProfiles()[paint.getW(i)%ANIMAL_SURFACE_PROFILE_STRIDE]?.config.flankStripe)torso.push(i);
  expect(torso.length).toBeGreaterThan(0);
  expect(new Set(torso.map(i=>slot(uv.getZ(i),uv.getW(i))))).toEqual(new Set([ANIMAL_PASTEL_PANELS.indexOf('gazelle')]));
  const base=new THREE.Color('#c98e4b');
  const color=(v:number)=>{
   const [r,g,b,a]=pixel(coat,...panelUV('gazelle',.47,v));
   return new THREE.Color(base.r*a!/255*1.08+r!/255,base.g*a!/255*1.08+g!/255,base.b*a!/255*1.08+b!/255);
  };
  const belly=color(.18),flank=color(.43),back=color(.82);
  expect(belly.b).toBeGreaterThan(back.b*2);
  expect(belly.r).toBeGreaterThan(back.r);
  expect(flank.r).toBeLessThan(back.r*.4);
  expect(back.r).toBeGreaterThan(back.b*3);
  expect(coat.image).toMatchObject({width:256,height:256});
  expect((coat.image.data as Uint8Array).byteLength).toBe(256*256*4);
  expect(coat.generateMipmaps).toBe(true);
  expect(coat.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  for(const panel of ANIMAL_PASTEL_PANELS){
   const index=ANIMAL_PASTEL_PANELS.indexOf(panel),x=(index%4)*64,y=Math.floor(index/4)*64;
   // Exact repeated edge pixels in each eight-pixel gutter.
   expect(pixel(coat,(x+0.5)/256,(y+31.5)/256)).toEqual(pixel(coat,(x+8.5)/256,(y+31.5)/256));
   expect(pixel(coat,(x+63.5)/256,(y+31.5)/256)).toEqual(pixel(coat,(x+55.5)/256,(y+31.5)/256));
  }
 }finally{coat.dispose();models.dispose();}
});

test('Gouache decorates already-resident animal RGB pigments only, with original bump and gazelle/fox drawings unchanged',()=>{
 const flat=new Uint8Array(64*64*4);
 for(let i=0;i<flat.length;i+=4){flat.set([170,140,100,i%255],i);}
 const receipt=referencePaintProfiles().map(d=>d.key);
 for(const key of Object.keys(ANIMAL_GOUACHE_PANELS)){
  expect(receipt).toContain(key);
  const one=flat.slice(),two=flat.slice();
  decorateAnimalGouachePigment(key,'#aa8c64',one,64);
  decorateAnimalGouachePigment(key,'#aa8c64',two,64);
  expect(one).toEqual(two);
  expect(one).not.toEqual(flat);
  for(let i=3;i<flat.length;i+=4)expect(one[i]).toBe(flat[i]);
 }
 for(const key of ['matGazelleFlank','matFoxSnout','best46:matGrizzlyBrown','matShirt','generic-gouache']){
  const one=flat.slice();
  decorateAnimalGouachePigment(key,'#aa8c64',one,64);
  expect(one).toEqual(flat);
 }
});
