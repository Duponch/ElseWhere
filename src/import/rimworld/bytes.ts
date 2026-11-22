/** Byte helpers for the RimWorld save reader: base64, raw DEFLATE (RFC 1951,
 * no zlib header, as the save writes its "…Deflate" arrays) and little-endian
 * columns. Pure TypeScript so the same reader runs in a browser worker and in
 * Node without a platform API (DecompressionStream is asynchronous). */

const BASE64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE=new Int16Array(128).fill(-1);
for(let i=0;i<BASE64.length;i++)BASE64_VALUE[BASE64.charCodeAt(i)]=i;

/** Decodes base64, ignoring whitespace (the save wraps long strings). */
export function decodeBase64(text:string):Uint8Array {
 const values=new Uint8Array(text.length);let count=0,padding=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);
  if(c===61){padding++;continue;}
  if(c===32||c===9||c===10||c===13)continue;
  const v=c<128?BASE64_VALUE[c]!:-1;
  if(v<0||padding)throw Error('Base64 invalide dans la sauvegarde.');
  values[count++]=v;
 }
 if(count%4===1)throw Error('Base64 tronqué dans la sauvegarde.');
 const out=new Uint8Array(Math.floor(count*3/4));let o=0,i=0;
 for(;i+3<count;i+=4){const n=values[i]!<<18|values[i+1]!<<12|values[i+2]!<<6|values[i+3]!;out[o++]=n>>16&255;out[o++]=n>>8&255;out[o++]=n&255;}
 if(count-i===2){out[o++]=(values[i]!<<2|values[i+1]!>>4)&255;}
 else if(count-i===3){const n=values[i]!<<10|values[i+1]!<<4|values[i+2]!>>2;out[o++]=n>>8&255;out[o++]=n&255;}
 return out.subarray(0,o);
}

// ---- Raw DEFLATE -----------------------------------------------------------
const LENGTH_BASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LENGTH_EXTRA=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DIST_BASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DIST_EXTRA=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const CODE_ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

interface Huffman {counts:Uint16Array;symbols:Uint16Array}
function huffman(lengths:ArrayLike<number>,n:number):Huffman {
 const counts=new Uint16Array(16),offsets=new Uint16Array(16),symbols=new Uint16Array(n);
 for(let i=0;i<n;i++)counts[lengths[i]!]!++;
 counts[0]=0;
 for(let i=1;i<16;i++)offsets[i]=offsets[i-1]!+counts[i-1]!;
 for(let i=0;i<n;i++)if(lengths[i])symbols[offsets[lengths[i]!]!++]=i;
 return {counts,symbols};
}
let FIXED:{lit:Huffman;dist:Huffman}|undefined;
function fixedTables(){
 if(FIXED)return FIXED;
 const l=new Uint8Array(288);l.fill(8,0,144);l.fill(9,144,256);l.fill(7,256,280);l.fill(8,280,288);
 const d=new Uint8Array(30).fill(5);
 return FIXED={lit:huffman(l,288),dist:huffman(d,30)};
}

class BitReader {
 pos=0;bit=0;bits=0;
 constructor(readonly data:Uint8Array){}
 need(n:number):number {
  let v=this.bit;
  while(this.bits<n){
   if(this.pos>=this.data.length)throw Error('Données compressées tronquées.');
   v|=this.data[this.pos++]!<<this.bits;this.bits+=8;
  }
  this.bit=v>>>n;this.bits-=n;return v&((1<<n)-1);
 }
 decode(h:Huffman):number {
  let code=0,first=0,index=0;
  for(let len=1;len<16;len++){
   code|=this.need(1);const count=h.counts[len]!;
   if(code-count<first)return h.symbols[index+(code-first)]!;
   index+=count;first+=count;first<<=1;code<<=1;
  }
  throw Error('Code de Huffman invalide.');
 }
}

/** Inflates raw DEFLATE data. */
export function inflateRaw(input:Uint8Array):Uint8Array {
 const r=new BitReader(input);let out=new Uint8Array(Math.max(1024,input.length*4)),o=0;
 const ensure=(n:number)=>{if(o+n<=out.length)return;let size=out.length*2;while(size<o+n)size*=2;const next=new Uint8Array(size);next.set(out.subarray(0,o));out=next;};
 let last=0;
 do{
  last=r.need(1);const type=r.need(2);
  if(type===0){
   r.bit=0;r.bits=0;
   if(r.pos+4>input.length)throw Error('Bloc stocké tronqué.');
   const len=input[r.pos]!|input[r.pos+1]!<<8;r.pos+=4;
   if(r.pos+len>input.length)throw Error('Bloc stocké tronqué.');
   ensure(len);out.set(input.subarray(r.pos,r.pos+len),o);o+=len;r.pos+=len;continue;
  }
  let lit:Huffman,dist:Huffman;
  if(type===1)({lit,dist}=fixedTables());
  else if(type===2){
   const nlen=r.need(5)+257,ndist=r.need(5)+1,ncode=r.need(4)+4,lengths=new Uint8Array(320);
   for(let i=0;i<ncode;i++)lengths[CODE_ORDER[i]!]=r.need(3);
   const codes=huffman(lengths,19);lengths.fill(0);
   for(let i=0;i<nlen+ndist;){
    const sym=r.decode(codes);
    if(sym<16){lengths[i++]=sym;continue;}
    let len=0,repeat=0;
    if(sym===16){if(!i)throw Error('Répétition sans longueur.');len=lengths[i-1]!;repeat=3+r.need(2);}
    else if(sym===17)repeat=3+r.need(3);else repeat=11+r.need(7);
    if(i+repeat>nlen+ndist)throw Error('Trop de longueurs.');
    while(repeat--)lengths[i++]=len;
   }
   lit=huffman(lengths.subarray(0,nlen),nlen);dist=huffman(lengths.subarray(nlen,nlen+ndist),ndist);
  }else throw Error('Type de bloc DEFLATE invalide.');
  for(;;){
   const sym=r.decode(lit);
   if(sym<256){ensure(1);out[o++]=sym;continue;}
   if(sym===256)break;
   const li=sym-257;if(li>=29)throw Error('Longueur invalide.');
   const len=LENGTH_BASE[li]!+r.need(LENGTH_EXTRA[li]!);
   const di=r.decode(dist);if(di>=30)throw Error('Distance invalide.');
   const d=DIST_BASE[di]!+r.need(DIST_EXTRA[di]!);
   if(d>o)throw Error('Distance hors des données.');
   ensure(len);for(let k=0;k<len;k++,o++)out[o]=out[o-d]!;
  }
 }while(!last);
 return out.slice(0,o);
}

/** A "…Deflate" or plain base64 byte array as written by the save. */
export function savedBytes(text:string,deflated:boolean):Uint8Array {
 const raw=decodeBase64(text);return deflated?inflateRaw(raw):raw;
}
export function readUint16Column(bytes:Uint8Array,count=bytes.length>>1):Uint16Array {
 if(bytes.length<count*2)throw Error('Colonne trop courte.');
 const out=new Uint16Array(count);for(let i=0;i<count;i++)out[i]=bytes[i*2]!|bytes[i*2+1]!<<8;return out;
}
export function readInt32Column(bytes:Uint8Array,count=bytes.length>>2):Int32Array {
 if(bytes.length<count*4)throw Error('Colonne trop courte.');
 const out=new Int32Array(count);for(let i=0;i<count;i++)out[i]=bytes[i*4]!|bytes[i*4+1]!<<8|bytes[i*4+2]!<<16|bytes[i*4+3]!<<24;return out;
}
