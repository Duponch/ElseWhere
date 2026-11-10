import * as THREE from 'three/webgpu';

/** Seamless painted values: periodic value noise, so world-space mapping can
 * cross any number of wall cells without a repeat seam. */
function periodicNoise(size:number,cells:number,seed:number):(x:number,y:number)=>number{
  const lattice=new Float32Array(cells*cells);
  for(let i=0;i<lattice.length;i++){const v=Math.sin((i+1)*12.9898+seed*78.233)*43758.5453;lattice[i]=v-Math.floor(v);}
  const at=(i:number,j:number)=>lattice[((j%cells+cells)%cells)*cells+((i%cells+cells)%cells)]!;
  const smooth=(t:number)=>t*t*(3-2*t);
  return (x,y)=>{
    const u=x/size*cells,v=y/size*cells,i=Math.floor(u),j=Math.floor(v),fu=smooth(u-i),fv=smooth(v-j);
    const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
    return (a+(b-a)*fu)+((c+(d-c)*fu)-(a+(b-a)*fu))*fv;
  };
}
export function wallPaintTexture(kind:'timber'|'stone'):THREE.DataTexture {
  const size=128,data=new Uint8Array(size*size*4);
  const broad=periodicNoise(size,4,kind==='timber'?3:7),mid=periodicNoise(size,16,kind==='timber'?11:13),fine=periodicNoise(size,64,kind==='timber'?17:19);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value:number;
    if(kind==='timber'){
      // Long fibres along the boards (u), broad painted tonal patches.
      const fibre=Math.sin(2*Math.PI*(y*6/size+.35*broad(x,y*.25)))*5+(fine(x*.125,y)-.5)*10;
      value=226+(broad(x,y)-.5)*26+(mid(x*.25,y)-.5)*12+fibre;
    }else value=228+(broad(x,y)-.5)*24+(mid(x,y)-.5)*14+(fine(x,y)-.5)*7;
    const at=(y*size+x)*4;data[at]=data[at+1]=data[at+2]=Math.max(160,Math.min(255,Math.round(value)));data[at+3]=255;
  }
  const result=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  result.wrapS=result.wrapT=THREE.RepeatWrapping;result.magFilter=THREE.LinearFilter;result.minFilter=THREE.LinearMipmapLinearFilter;
  result.generateMipmaps=true;result.needsUpdate=true;return result;
}

