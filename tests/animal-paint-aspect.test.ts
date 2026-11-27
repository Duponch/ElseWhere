import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {bakeAnimalCoatCoordinates,createAnimalCoatPixels} from '../src/render/animal-surface-paint';
import {ANIMAL_PASTEL_PANELS,animalPanelUsesPhysicalCrop} from '../src/render/animal-surface-paint';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {AnimalModels} from '../src/render/models/AnimalModels';

function face(width:number,height:number,species='muffalo'){
 const g=new THREE.PlaneGeometry(width,height);
 const count=g.getAttribute('position').count;
 g.setAttribute('animalPaint',new THREE.BufferAttribute(new Float32Array(count*4),4));
 const parts=new Float32Array(count*4);for(let i=0;i<count;i++)parts[i*4+3]=-1;
 g.setAttribute('animalPart',new THREE.BufferAttribute(parts,4));
 bakeAnimalCoatCoordinates(g,species);return g;
}
function bounds(g:THREE.BufferGeometry){const uv=g.getAttribute('animalPaintUv');let loU=Infinity,hiU=-Infinity,loV=Infinity,hiV=-Infinity;for(let i=0;i<uv.count;i++){loU=Math.min(loU,uv.getX(i));hiU=Math.max(hiU,uv.getX(i));loV=Math.min(loV,uv.getY(i));hiV=Math.max(hiV,uv.getY(i));}return{u:hiU-loU,v:hiV-loV};}

test('generic animal paint crops the short axis in static bind coordinates, preserving square scale',()=>{
 for(const [width,height]of [[1,1],[4,1],[1,4],[2.5,.7]]){
  const g=face(width!,height!);try{const uv=bounds(g);expect(uv.u/width!).toBeCloseTo(uv.v/height!,6);expect(Math.max(uv.u,uv.v)).toBeCloseTo(47/256,6);expect(g.getAttribute('position').count).toBe(4);}finally{g.dispose();}
 }
});

test('anatomical belly composition keeps the complete panel on a rectangular body',()=>{
 const g=face(4,1,'deer');try{const uv=bounds(g);expect(uv.u).toBeCloseTo(47/256,6);expect(uv.v).toBeCloseTo(47/256,6);}finally{g.dispose();}
});

test('generic crop retains equal physical texel scale on a tilted rectangular face',()=>{
 const g=face(4,1);try{
  g.rotateY(Math.PI/3);bakeAnimalCoatCoordinates(g,'muffalo');
  const uv=g.getAttribute('animalPaintUv'),p=g.getAttribute('position');
  const density=(a:number,b:number)=>Math.hypot(uv.getX(a)-uv.getX(b),uv.getY(a)-uv.getY(b))/Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
  expect(density(0,1)).toBeCloseTo(density(0,2),6);
 }finally{g.dispose();}
});

test('neutral animal atlas keeps identical dimensions and coat wash without any coloured drawing',()=>{
 for(const coat of ['soft','short','shaggy']as const){
  const decorated=createAnimalCoatPixels(coat),neutral=createAnimalCoatPixels(coat,false);
  expect(neutral.length).toBe(256*256*4);expect(neutral).not.toEqual(decorated);
  let low=255,high=0;for(let i=0;i<neutral.length;i+=4){expect(neutral[i]!|neutral[i+1]!|neutral[i+2]!).toBe(0);low=Math.min(low,neutral[i+3]!);high=Math.max(high,neutral[i+3]!);}
  expect(high-low).toBeGreaterThan(20);
 }
});

test('all53 animal models retain the angles and length ratios of generic flat faces in packed coat UV',()=>{
 const models=new AnimalModels(),a=new THREE.Vector3(),b=new THREE.Vector3(),origin=new THREE.Vector3();let checked=0,worst=0;
 try{
  for(const species of ANIMAL_SPECIES_IDS){
   const g=models.get(species).geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('animalSurfaceUv'),index=g.index!;
   for(let t=0;t<index.count;t+=3){
    const i=index.getX(t),j=index.getX(t+1),k=index.getX(t+2),panel=ANIMAL_PASTEL_PANELS[Math.floor(uv.getZ(i)*4)+Math.floor(uv.getW(i)*4)*4]!;
    if(!animalPanelUsesPhysicalCrop(panel))continue;
    if(Math.hypot(n.getX(i)-n.getX(j),n.getY(i)-n.getY(j),n.getZ(i)-n.getZ(j),n.getX(i)-n.getX(k),n.getY(i)-n.getY(k),n.getZ(i)-n.getZ(k))>1e-6)continue;
    origin.fromBufferAttribute(p,i);a.fromBufferAttribute(p,j).sub(origin);b.fromBufferAttribute(p,k).sub(origin);
    const au=uv.getZ(j)-uv.getZ(i),av=uv.getW(j)-uv.getW(i),bu=uv.getZ(k)-uv.getZ(i),bv=uv.getW(k)-uv.getW(i),ul=Math.hypot(au,av),vl=Math.hypot(bu,bv);
    if(a.length()<1e-5||b.length()<1e-5||ul<1e-6||vl<1e-6)continue;
    worst=Math.max(worst,Math.abs(ul/a.length()/(vl/b.length())-1),Math.abs((au*bu+av*bv)/(ul*vl)-a.dot(b)/(a.length()*b.length())));checked++;
   }
  }
  expect(checked).toBeGreaterThan(1000);expect(worst).toBeLessThan(.001);
 }finally{models.dispose();}
},60_000);
