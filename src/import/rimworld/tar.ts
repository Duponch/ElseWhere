/** Minimal reader of `.tar` archives, as RimWorld 1.6 ships its translations
 * (`Data/Core/Languages/<langue>.tar`, read by the game through SharpZipLib's
 * `TarInputStream`). Written for the tool: 512-byte headers, octal sizes (or
 * base-256 for very large ones), data padded to 512 bytes, end at the first
 * zero block. Understands the old format (the game's archives), ustar's name
 * prefix, GNU long names (`L`) and pax `path` records (`x`). Links and other
 * special entries are skipped. Pure TypeScript, identical in a browser and in
 * Node; nothing is extracted to disk. */

export interface TarEntry {
 /** Path inside the archive, forward slashes, without a trailing slash. */
 readonly path:string;
 readonly directory:boolean;
 /** File contents (a view into the archive); empty for a directory. */
 readonly data:Uint8Array;
}

const BLOCK=512;
const utf8=new TextDecoder('utf-8');
function field(header:Uint8Array,start:number,length:number):string {
 let end=start;while(end<start+length&&header[end]!==0)end++;
 return utf8.decode(header.subarray(start,end));
}
function octal(header:Uint8Array,start:number,length:number):number {
 // GNU base-256: the high bit of the first byte marks a big-endian binary number.
 if(header[start]!&0x80){let value=header[start]!&0x7f;for(let i=start+1;i<start+length;i++)value=value*256+header[i]!;return value;}
 const text=field(header,start,length).trim();
 if(!text)return 0;
 if(!/^[0-7]+$/.test(text))throw Error(`Archive tar : taille illisible (« ${text} »).`);
 return parseInt(text,8);
}
const isZeroBlock=(bytes:Uint8Array,at:number)=>{for(let i=at;i<at+BLOCK;i++)if(bytes[i]!==0)return false;return true;};
/** pax extended header: records `<length> <key>=<value>\n`. */
function paxPath(data:Uint8Array):string|undefined {
 const text=utf8.decode(data);let at=0,path:string|undefined;
 while(at<text.length){
  const space=text.indexOf(' ',at);if(space<0)break;
  const length=Number(text.slice(at,space));if(!Number.isInteger(length)||length<=0)break;
  const record=text.slice(space+1,at+length-1),eq=record.indexOf('=');
  if(eq>0&&record.slice(0,eq)==='path')path=record.slice(eq+1);
  at+=length;
 }
 return path;
}
const normalize=(path:string)=>path.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/+$/,'');

/** Every file and directory of the archive, in archive order. Throws a French
 * message on a truncated or malformed archive. */
export function readTarEntries(bytes:Uint8Array):TarEntry[] {
 const entries:TarEntry[]=[];let at=0,longName:string|undefined,pax:string|undefined;
 while(at+BLOCK<=bytes.length){
  if(isZeroBlock(bytes,at))break;
  const header=bytes.subarray(at,at+BLOCK),size=octal(header,124,12),type=String.fromCharCode(header[156]!);
  const dataStart=at+BLOCK,dataEnd=dataStart+size;
  if(dataEnd>bytes.length)throw Error('Archive tar tronquée.');
  const data=bytes.subarray(dataStart,dataEnd);
  at=dataStart+Math.ceil(size/BLOCK)*BLOCK;
  if(type==='L'){longName=field(data,0,data.length);continue;}
  if(type==='x'){pax=paxPath(data);continue;}
  if(type==='g'||type==='K')continue;
  const ustar=field(header,257,5)==='ustar',prefix=ustar?field(header,345,155):'';
  const raw=pax??longName??(prefix?`${prefix}/${field(header,0,100)}`:field(header,0,100)),path=normalize(raw);
  longName=undefined;pax=undefined;
  // The old format marks a directory by a trailing slash only.
  if(type==='5'||(type==='0'||type==='\0')&&/[\\/]$/.test(raw))entries.push({path,directory:true,data:new Uint8Array(0)});
  else if(type==='0'||type==='\0'||type==='7')entries.push({path,directory:false,data});
  // Links, devices and fifos carry no file contents the game reads.
 }
 return entries;
}
