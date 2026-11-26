/** Literal replay oracle, intentionally independent of the Native owned
 * decoder. The hash observes the structured-clone graph including its raw
 * shared references; the actual Native reader normalizes those into distinct
 * owned tree occurrences. Do not import that reader or its graph helpers. */
export function expandCorePhaseWire379(message:any):any {
 if((message?.type!=='actor-phase-297'&&message?.type!=='actor-frontier-297')||!Object.hasOwn(message,'phaseWire379'))return message;
 const wire=message.phaseWire379;
 if(!wire||wire.format!=='core-phase-graph-379-1'||!(wire.words instanceof ArrayBuffer)||!(wire.numbers instanceof ArrayBuffer)||!Array.isArray(wire.strings)||!Array.isArray(wire.shapes))throw Error('Replay Core phase graph header');
 const tokens=new Int32Array(wire.words),values=new Float64Array(wire.numbers),objects:unknown[]=[];
 let cursor=0,n=0;
 function read():unknown {
  if(cursor>=tokens.length)throw Error('Replay Core phase graph token extent');
  const token=tokens[cursor++]!,code=token>>>28,argument=token&0xfffffff;
  switch(code){
   case 0:if(argument!==n++||argument>=values.length)throw Error('Replay Core phase graph number');return values[argument];
   case 1:if(argument>=wire.strings.length||typeof wire.strings[argument]!=='string')throw Error('Replay Core phase graph string');return wire.strings[argument];
   case 2:if(argument===0)return undefined;break;
   case 3:if(argument===0)return null;break;
   case 4:if(argument===0)return false;break;
   case 5:if(argument===0)return true;break;
   case 6:{
    const keys=wire.shapes[argument];if(!Array.isArray(keys)||keys.length>tokens.length-cursor)throw Error('Replay Core phase graph object extent');
    const row:Record<string,unknown>={};objects.push(row);
    for(const key of keys){if(typeof key!=='string'||Object.hasOwn(row,key))throw Error('Replay Core phase graph field');Object.defineProperty(row,key,{value:read(),writable:true,enumerable:true,configurable:true});}return row;
   }
   case 7:{
    if(argument>tokens.length-cursor)throw Error('Replay Core phase graph array extent');
    const list:unknown[]=new Array(argument);objects.push(list);for(let i=0;i<argument;i++)list[i]=read();return list;
   }
   case 8:if(argument>=objects.length)throw Error('Replay Core phase graph reference');return objects[argument];
  }
  throw Error('Replay Core phase graph unknown token');
 }
 const result=read() as Record<string,unknown>;
 if(cursor!==tokens.length||n!==values.length||!result||result.type!==message.type||!Object.is(result.toCore,message.toCore))throw Error('Replay Core phase graph header/extent');
 return result;
}
