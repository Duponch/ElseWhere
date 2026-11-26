/** Representation capture only, never an admission or native-source capability.
 * Called by the fixed lane inside its first trusted MessageEvent listener. */
const ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,proto=Object.getPrototypeOf;
const objectProto=Object.prototype,arrayProto=Array.prototype,freeze=Object.freeze,define=Object.defineProperty;
type Data=Record<string,unknown>;
function outer(value:unknown):Data {
 if(!value||typeof value!=='object'||Array.isArray(value)||proto(value)!==objectProto&&proto(value)!==null)throw Error('Native deferred envelope requires own data');
 const copy:Data={};
 for(const key of ownKeys(value)){
  const field=descriptor(value,key);if(typeof key!=='string'||!field||!field.enumerable||!('value' in field))throw Error('Native deferred envelope data field');
  define(copy,key,{value:field.value,writable:true,enumerable:true,configurable:true});
 }
 return copy;
}
function owned(value:unknown,active:Set<object>,depth=0):unknown {
 if(value===null||typeof value!=='object')return value;
 if(depth>32||active.has(value))throw Error('Cyclic/deep deferred control metadata');active.add(value);
 try{
  if(Array.isArray(value)){
   if(proto(value)!==arrayProto||ownKeys(value).length!==value.length+1)throw Error('Deferred control array shape');
   const copy:unknown[]=[];
   for(let i=0;i<value.length;i++){const field=descriptor(value,String(i));if(!field?.enumerable||!('value'in field))throw Error('Deferred control array data');copy.push(owned(field.value,active,depth+1));}
   return freeze(copy);
  }
  const copy=outer(value);for(const key of ownKeys(copy) as string[])copy[key]=owned(copy[key],active,depth+1);return freeze(copy);
 }finally{active.delete(value);}
}
function controls(value:Data):Data {
 const copy=outer(value);
 for(const key of ['checkpoint','progress','urgentThreats','audioCues','motion','corePhase297'])if(descriptor(copy,key))copy[key]=owned(copy[key],new Set());
 return freeze(copy);
}
export function captureNativeMessageForDeferred(value:unknown):unknown {
 const copy=outer(value);
 if(copy.type==='actor-phase-297'||copy.type==='actor-frontier-297')return owned(copy,new Set());
 if(copy.type==='resident-publication')copy.publication=controls(copy.publication as Data);
 else return controls(copy);
 return freeze(copy);
}

// Representation ownership only. The Native Event/Worker receipt remains a
// separate one-use capability. No public shape, flag or frozen wrapper enrolls.
const capturedCoreRoots297=new WeakSet<object>();
const weakHas297=WeakSet.prototype.has,weakAdd297=WeakSet.prototype.add;
const finite297=Number.isFinite,isArray297=Array.isArray,Set297=Set;
const setHas297=Set.prototype.has,setAdd297=Set.prototype.add,setDelete297=Set.prototype.delete;
/** The existing normalization plus the complete downstream Core copy bounds.
 * Null-prototype records normalize at every depth, as in the old two-copy path.
 * All source reads remain own descriptors; none can invoke a getter. */
function ownedCore297(value:unknown,active:Set<object>,budget:{left:number},depth=0):unknown {
 if(--budget.left<0||depth>24)throw Error('Core phase payload budget exceeded');
 if(value===undefined||value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!finite297(value))throw Error('Nonfinite Core phase number');return value;}
 if(typeof value!=='object'||setHas297.call(active,value))throw Error('Cyclic or non-data Core phase value');
 setAdd297.call(active,value);
 try {
  if(isArray297(value)){
   if(proto(value)!==arrayProto||ownKeys(value).length!==value.length+1)throw Error('Deferred Core array shape');
   const copy:unknown[]=[];
   // Numeric keys name the same index properties without building a string
   // per element; each element is still read and defined as own data.
   for(let i=0;i<value.length;i++){
    const field=descriptor(value,i);if(!field?.enumerable||!('value'in field))throw Error('Deferred Core array data');
    define(copy,i,{value:ownedCore297(field.value,active,budget,depth+1),writable:true,enumerable:true,configurable:true});
   }
   return freeze(copy);
  }
  // Same checks and messages as outer(), then one own-data spread instead of
  // a descriptor + defineProperty per key: CopyDataProperties creates data
  // properties (no inherited setter) in the same key order. Children replace
  // already-own properties, as before.
  if(proto(value)!==objectProto&&proto(value)!==null)throw Error('Native deferred envelope requires own data');
  const keys=ownKeys(value);
  for(const key of keys){const field=descriptor(value,key);if(typeof key!=='string'||!field||!field.enumerable||!('value' in field))throw Error('Native deferred envelope data field');}
  const copy:Data={...(value as Data)};
  for(const key of keys as string[])copy[key]=ownedCore297(copy[key],active,budget,depth+1);
  return freeze(copy);
 }finally{setDelete297.call(active,value);}
}
/** Fixed first-listener capture. Historical Full/control capture stays literal;
 * only Core phase data gets the stricter bounds already required by its codec. */
export function captureNativeMessageForDeferred297(value:unknown):unknown {
 const copy=outer(value);
 if(copy.type==='actor-phase-297'||copy.type==='actor-frontier-297'){
  const captured=ownedCore297(copy,new Set297<object>(),{left:1048576}) as object;
  weakAdd297.call(capturedCoreRoots297,captured);return captured;
 }
 if(copy.type==='resident-publication')copy.publication=controls(copy.publication as Data);
 else return controls(copy);
 return freeze(copy);
}
/** Zero-read identity check. It conveys data ownership, never Native admission. */
export function isCapturedCoreData297(value:unknown):boolean {return typeof value==='object'&&value!==null&&weakHas297.call(capturedCoreRoots297,value);}