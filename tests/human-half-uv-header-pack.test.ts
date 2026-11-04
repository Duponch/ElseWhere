/** Pure real model/header representation proof; no renderer, pixels or timing. */
import{expect,test}from'vitest';
import{HumanModels}from'../src/render/models/HumanModels';
import{assertHalfUvFaceStrokeHeaders,packHalfUvFaceStrokeHeader,unpackHalfUvFaceStrokeHeader}from'../src/render/surfaces/FaceStrokeTable';
import{writeTestFileSync}from'./test-output';
test('all16 real human feature models including every weapon/apparel/tool header pack bit-exactly into one vec4, preserving half-face UVs',()=>{
 const reports:unknown[]=[];let total=0,half=0;
 for(let mask=0;mask<16;mask++){const models=new HumanModels(),features={smithing:!!(mask&1),mace:!!(mask&2),longsword:!!(mask&4),spear:!!(mask&8)};
  try{const model=models.get(features),table=model.strokes,proof=assertHalfUvFaceStrokeHeaders(table),values=table.values;total+=proof.faces;half+=proof.halfFaces;
   for(let face=0;face<table.faceCount;face++){const packed=packHalfUvFaceStrokeHeader(values,face*8),decoded=unpackHalfUvFaceStrokeHeader(packed),before=new Uint32Array(values.buffer,values.byteOffset+face*32,8),after=new Uint32Array(decoded.buffer,decoded.byteOffset,8);for(let c=0;c<8;c++)if(before[c]!==after[c])throw Error('Source Float32 header changed at featureMask='+mask+' face='+face+' component='+c);}
   const bad=values.slice(0,8);bad[2]=.25;expect(()=>assertHalfUvFaceStrokeHeaders({...table,faceCount:1,values:bad})).toThrow('half-UV packing domain');const negativeZero=values.slice(0,8);negativeZero[2]=-0;expect(()=>assertHalfUvFaceStrokeHeaders({...table,faceCount:1,values:negativeZero})).toThrow('half-UV packing domain');reports.push({features,...proof});
  }finally{models.dispose();}
 }
 expect(reports).toHaveLength(16);expect(total).toBeGreaterThan(0);expect(half).toBeGreaterThan(0);writeTestFileSync('artifacts/human-half-uv-header-pack-proof.json',JSON.stringify({scope:'Actual HumanModels16 feature combinations; canonical8Float32 words reproduced exactly, no pixels/GPU/performance claim',faces:total,halfFaces:half,reports},null,2)+'\n');
},60000);
