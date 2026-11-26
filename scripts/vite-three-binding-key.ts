import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';

const threeVersion = '0.186.0';
const distributionHash = 'a78400fa1d359e81fcc12b84ed0a89a7fbecb4b8373e28ae8f9d2b11f6ea13bc';
const transformedHash = 'b482d4be146783ece1ce6234cbe62c3219382fddebf376f83cd3fed3993e83ed';
const methodHash = 'aed22e1ff870a4d74a32622cb3f99d47777f7f95303aabe350956840f2d2a3aa';
const instructions = 'Review the distributed Bindings._update and its equivalence tests before updating the Three.js binding-key optimization.';
const sha256=(source:string)=>createHash('sha256').update(source).digest('hex');
const moduleState = `let elsewhereFreeBindingIds = new Float64Array(128);
function elsewhereNumericBindingKey(first, second, extra, count) {
  if (first === undefined) return '';
  let key = first + ',';
  if (second !== undefined) key += second + ',';
  for (let i = 0; i < count; i++) key += extra[i] + ',';
  return key;
}`;
const currentKey = 'elsewhereNumericBindingKey(firstBindingId, secondBindingId, borrowedBindingIds, extraBindingCount)';

// Keep both original getter sites. Exotic coercions may throw or re-enter
// rendering. Only primitive numbers can enter the exclusively borrowed scratch.
function captureId(expression:string):string {
  return `const rawBindingId = ${expression};
if (!bindingKeyEager && typeof rawBindingId === "number") {
  if (firstBindingId === undefined) firstBindingId = rawBindingId;
  else if (secondBindingId === undefined) secondBindingId = rawBindingId;
  else {
    if (borrowedBindingIds === undefined) {
      borrowedBindingIds = elsewhereFreeBindingIds;
      elsewhereFreeBindingIds = undefined;
    }
    if (borrowedBindingIds !== undefined && extraBindingCount < 128) {
      borrowedBindingIds[extraBindingCount++] = rawBindingId;
    } else {
      cacheKey = ${currentKey};
      cacheKey += rawBindingId + ',';
      bindingKeyEager = true;
    }
  }
} else {
  if (!bindingKeyEager) {
    cacheKey = ${currentKey};
    bindingKeyEager = true;
  }
  cacheKey += rawBindingId + ',';
}`;
}

// Replace whole lines in this single checked method. Each added line maps to
// the exact original line it expands. All following source lines keep their
// original positions, including in developer builds with source maps.
export function transformThreeBindingKey(source:string,id:string,version:string) {
  const declaration = 'class Bindings extends DataMap {';
  const classAt = source.indexOf(declaration);
  const start = source.indexOf('_update( bindGroup, bindings ) {',classAt);
  const end = source.indexOf('\n\t}\n\n}',start);
  const hash = sha256(source.slice(start,end+3));
  if (version !== threeVersion || classAt < 0 || start < 0 || end < 0 || hash !== methodHash) {
    throw Error(`Unsupported Three.js binding implementation (${version}, ${hash}). ${instructions}`);
  }
  const distribution=sha256(source);
  if(distribution!==distributionHash)throw Error(`Unsupported Three.js distribution SHA-256 (${distribution}). ${instructions}`);
  const method = source.slice(start,end+3);
  const changes = new Map<number,string[]>();
  function change(at:number,replacement:string) {
    const index = source.lastIndexOf('\n',at-1)+1;
    const indent = source.slice(index,at);
    const revised = replacement.split('\n').map(line=>indent+line);
    changes.set(index,revised);
  }
  change(classAt,moduleState+'\n'+declaration);
  function replaceLine(needle:string,replacement:string) {
    const offset = method.indexOf(needle);
    if (offset === -1 || method.indexOf(needle,offset+1)!==-1) throw Error(instructions);
    change(start+offset,replacement);
  }
  replaceLine("let cacheKey = '';",`let cacheKey = '';
let firstBindingId, secondBindingId, borrowedBindingIds;
let extraBindingCount = 0, bindingKeyEager = false;`);
  const loop = 'for ( const binding of bindGroup.bindings ) {';
  replaceLine(loop,'try {\n'+loop);
  for (const expression of ['attribute.id','texture.id']) {
    replaceLine(`cacheKey += ${expression} + ',';`, captureId(expression));
  }
  const update = "this.backend.updateBindings( bindGroup, bindings, cacheBindings ? cacheKey : '', version );";
  replaceLine(update,update.replace('cacheBindings ? cacheKey',"cacheBindings ? (bindingKeyEager ? cacheKey : "+currentKey+")"));
  change(end+2,`} finally {
  if (borrowedBindingIds !== undefined) elsewhereFreeBindingIds = borrowedBindingIds;
}
}`);
  let offset=0;
  const mappings:string[]=[];
  const lines=source.split('\n');
  for(let n=0;n<lines.length;n++) {
    const original=lines[n]!;
    const edited=changes.get(offset);
    // Source map segments with original line delta 1 or 0 and column 0.
    mappings.push((n===0?'AAAA':'AACA') + (edited?';AAAA'.repeat(edited.length-1):''));
    if(edited)lines[n]=edited.join('\n');
    offset+=original.length+1;
  }
  return {code:lines.join('\n'),map:{version:3 as const,sources:[id],sourcesContent:[source],names:[],mappings:mappings.join(';')}};
}

// Raw/URL imports consume bytes rather than executable code. Vite also
// resolves normal modules as /@fs/C:/... and file paths with a version query.
function modulePath(id:string):string{
  let path=id.replaceAll('\\','/').replace(/\?v=[\da-f]+$/i,'');
  if(path.startsWith('/@fs/')){
    path=path.slice(5);
    if(!path.startsWith('/')&&!/^[a-z]:\//i.test(path))path='/'+path;
  }
  if(/^\/[a-z]:\//i.test(path))path=path.slice(1);
  return /^[a-z]:\//i.test(path)||path.startsWith('//')?path.toLowerCase():path;
}

let warned=false;
function keepOriginal(reason:unknown):void{
  if(warned)return;
  warned=true;
  console.warn(`[elsewhere-three-binding-key] Using Three.js unchanged. ${reason instanceof Error?reason.message:String(reason)}`);
}
const installedEntry=()=>createRequire(import.meta.url).resolve('three/webgpu');

/** Build, Worker builds and dev prebundling each get a fresh plugin. A
 * dependency upgrade can always build normally while awaiting qualification. */
export function threeBindingKey(resolveEntry:()=>string=installedEntry) {
  let file:string|undefined;
  try{
    const entry=resolveEntry();
    if(!modulePath(entry).endsWith('/build/three.webgpu.js'))throw Error(`Unsupported Three.js entry ${entry}. ${instructions}`);
    const manifest=JSON.parse(readFileSync(resolve(dirname(entry),'../package.json'),'utf8')) as {name:string;version:string};
    if(manifest.name!=='three'||manifest.version!==threeVersion)throw Error(`Unsupported Three.js distribution (${manifest.name} ${manifest.version}). ${instructions}`);
    file=modulePath(entry);
  }catch(error){keepOriginal(error);}
  return {name:'elsewhere-three-binding-key-r186-1',enforce:'pre' as const,transform(source:string,id:string) {
    if(file===undefined||!/three\.webgpu\.js(?:\?v=[\da-f]+)?$/i.test(id)||modulePath(id)!==file)return;
    // Different bundling stages can encounter an already transformed entry.
    if(source.includes('let elsewhereFreeBindingIds')&&sha256(source)===transformedHash)return;
    try{return transformThreeBindingKey(source,id,threeVersion);}
    catch(error){keepOriginal(error);}
  }};
}
