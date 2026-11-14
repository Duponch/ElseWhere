/* `structuredClone` for plain simulation data, without its serializer.
 *
 * Same result as structuredClone(value) when the graph holds only primitives
 * (not symbols), plain objects (prototype Object.prototype or null) and plain
 * arrays without holes or extra properties: fresh plain objects and arrays,
 * own enumerable string keys copied in their order (getters read once, in that
 * order), shared references and cycles kept as shared references and cycles.
 * Anything else (a Map, a Date, a typed array, a class instance, a function, a
 * sparse array, a key named __proto__…) makes the whole call return
 * structuredClone(value), so the result and any error are its own. */
const UNSUPPORTED=Symbol('unsupported');
function copy(value:unknown,seen:Map<object,unknown>):unknown {
  if(typeof value!=='object'){if(typeof value==='function'||typeof value==='symbol')throw UNSUPPORTED;return value;}
  if(value===null)return value;
  const known=seen.get(value);if(known!==undefined)return known;
  const proto=Object.getPrototypeOf(value);
  if(Array.isArray(value)){
    if(proto!==Array.prototype)throw UNSUPPORTED;
    const length=value.length,out:unknown[]=new Array(length);seen.set(value,out);
    if(Object.keys(value).length!==length)throw UNSUPPORTED;
    for(let i=0;i<length;i++){if(!(i in value))throw UNSUPPORTED;out[i]=copy(value[i],seen);}
    return out;
  }
  if(proto!==Object.prototype&&proto!==null)throw UNSUPPORTED;
  const out:Record<string,unknown>={};seen.set(value,out);
  for(const key of Object.keys(value)){if(key==='__proto__')throw UNSUPPORTED;out[key]=copy((value as Record<string,unknown>)[key],seen);}
  return out;
}
export function clonePlainData<T>(value:T):T {
  try{return copy(value,new Map()) as T;}
  catch(error){if(error===UNSUPPORTED)return structuredClone(value);throw error;}
}
