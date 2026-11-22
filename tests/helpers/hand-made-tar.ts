// Writes small `.tar` archives for tests, header by header (old format by
// default, ustar on request), with invented contents only.
export interface HandMadeTarEntry {
 name:string;
 /** File contents; omitted for a directory. */
 text?:string;
 /** Header type flag: '0' file, '5' directory, 'L' GNU long name, 'x' pax. */
 type?:string;
 /** ustar name prefix (field at 345). */
 prefix?:string;
}
const encoder=new TextEncoder();
function header(name:string,size:number,type:string,prefix?:string):Uint8Array {
 const h=new Uint8Array(512),put=(text:string,at:number,length:number)=>{const b=encoder.encode(text);h.set(b.subarray(0,length),at);};
 put(name,0,100);put('0000644\0',100,8);put('0000000\0',108,8);put('0000000\0',116,8);
 put(size.toString(8).padStart(11,'0')+'\0',124,12);put('00000000000\0',136,12);
 put(type,156,1);
 if(prefix!==undefined){put('ustar\0',257,6);put('00',263,2);put(prefix,345,155);}
 put('        ',148,8);let sum=0;for(const b of h)sum+=b;put(sum.toString(8).padStart(6,'0')+'\0 ',148,8);
 return h;
}
export function handMadeTar(entries:readonly HandMadeTarEntry[]):Uint8Array {
 const parts:Uint8Array[]=[];
 for(const e of entries){
  const data=encoder.encode(e.text??''),type=e.type??(e.text===undefined?'5':'0');
  parts.push(header(e.name,data.length,type,e.prefix));
  if(data.length){const padded=new Uint8Array(Math.ceil(data.length/512)*512);padded.set(data);parts.push(padded);}
 }
 parts.push(new Uint8Array(1024));
 const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}
 return out;
}
/** A pax record « <length> path=<value>\n » with its own length counted. */
export function paxPathRecord(path:string):string {
 const body=` path=${path}\n`;let length=body.length;
 while(String(length).length+body.length!==length)length=String(length).length+body.length;
 return `${length}${body}`;
}
