/** Minimal XML reader for RimWorld saves (`.rws`). The save is plain XML 1.0
 * written by the game: elements, attributes, text and the five predefined
 * entities plus numeric references. No DTD, namespace or processing beyond the
 * declaration. Pure TypeScript, identical in a browser worker and in Node. */

export interface XmlNode {
 readonly name:string;
 readonly attrs:Readonly<Record<string,string>>|null;
 readonly children:XmlNode[];
 /** Concatenated character data of this element only (not descendants). */
 text:string;
}

const ENTITIES:Readonly<Record<string,string>>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function decodeEntities(s:string):string {
 if(s.indexOf('&')<0)return s;
 return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g,(whole,body:string)=>{
  if(body[0]==='#'){const code=body[1]==='x'||body[1]==='X'?parseInt(body.slice(2),16):parseInt(body.slice(1),10);return Number.isFinite(code)&&code>=0&&code<=0x10ffff?String.fromCodePoint(code):whole;}
  return ENTITIES[body]??whole;
 });
}
const isSpace=(c:number)=>c===32||c===9||c===10||c===13;

/** Parses a whole document and returns its root element. Throws a French
 * message on malformed input. */
export function parseXml(source:string):XmlNode {
 const stack:XmlNode[]=[];let root:XmlNode|undefined;let i=0;const n=source.length;
 if(source.charCodeAt(0)===0xfeff)i=1;
 while(i<n){
  const lt=source.indexOf('<',i);
  if(lt<0){if(stack.length&&source.slice(i).trim())stack.at(-1)!.text+=decodeEntities(source.slice(i));break;}
  if(lt>i&&stack.length){
   // Indentation between child elements is skipped: the save never relies
   // on whitespace-only character data.
   let k=i;while(k<lt&&isSpace(source.charCodeAt(k)))k++;
   if(k<lt)stack.at(-1)!.text+=decodeEntities(source.slice(i,lt));
  }
  const c=source.charCodeAt(lt+1);
  if(c===63){const end=source.indexOf('?>',lt+2);if(end<0)throw Error('Déclaration XML non fermée.');i=end+2;continue;}
  if(c===33){
   if(source.startsWith('<!--',lt)){const end=source.indexOf('-->',lt+4);if(end<0)throw Error('Commentaire XML non fermé.');i=end+3;continue;}
   if(source.startsWith('<![CDATA[',lt)){const end=source.indexOf(']]>',lt+9);if(end<0)throw Error('Section CDATA non fermée.');if(stack.length)stack.at(-1)!.text+=source.slice(lt+9,end);i=end+3;continue;}
   const end=source.indexOf('>',lt+2);if(end<0)throw Error('Déclaration XML non fermée.');i=end+1;continue;
  }
  if(c===47){
   const end=source.indexOf('>',lt+2);if(end<0)throw Error('Balise fermante incomplète.');
   const name=source.slice(lt+2,end).trim(),top=stack.pop();
   if(!top||top.name!==name)throw Error(`Balise fermante inattendue : ${name}.`);
   i=end+1;continue;
  }
  // Start tag: name, attributes, optional self-closing slash.
  let j=lt+1;while(j<n&&!isSpace(source.charCodeAt(j))&&source[j]!=='>'&&source[j]!=='/')j++;
  const name=source.slice(lt+1,j);if(!name)throw Error('Nom de balise vide.');
  let attrs:Record<string,string>|null=null;let selfClosing=false;
  for(;;){
   while(j<n&&isSpace(source.charCodeAt(j)))j++;
   if(j>=n)throw Error(`Balise ${name} non fermée.`);
   const ch=source[j];
   if(ch==='>'){j++;break;}
   if(ch==='/'){if(source[j+1]!=='>')throw Error(`Balise ${name} mal formée.`);selfClosing=true;j+=2;break;}
   const eq=source.indexOf('=',j);if(eq<0)throw Error(`Attribut mal formé dans ${name}.`);
   const key=source.slice(j,eq).trim();let k=eq+1;while(isSpace(source.charCodeAt(k)))k++;
   const quote=source[k];if(quote!=='"'&&quote!=="'")throw Error(`Attribut sans guillemets dans ${name}.`);
   const close=source.indexOf(quote,k+1);if(close<0)throw Error(`Attribut non fermé dans ${name}.`);
   (attrs??={})[key]=decodeEntities(source.slice(k+1,close));j=close+1;
  }
  const node:XmlNode={name,attrs,children:[],text:''};
  if(stack.length)stack.at(-1)!.children.push(node);else if(root)throw Error('Plusieurs racines XML.');else root=node;
  if(!selfClosing)stack.push(node);
  i=j;
 }
 if(stack.length)throw Error(`Balise ${stack.at(-1)!.name} non fermée en fin de fichier.`);
 if(!root)throw Error('Document XML vide.');
 return root;
}

// ---- Navigation helpers ------------------------------------------------------
export function child(node:XmlNode|undefined,name:string):XmlNode|undefined {
 if(!node)return undefined;for(const c of node.children)if(c.name===name)return c;return undefined;
}
export function children(node:XmlNode|undefined,name:string):XmlNode[] {
 return node?node.children.filter(c=>c.name===name):[];
}
/** Slash path of child names, e.g. `story/childhood`. */
export function at(node:XmlNode|undefined,path:string):XmlNode|undefined {
 let current=node;for(const part of path.split('/')){current=child(current,part);if(!current)return undefined;}return current;
}
/** Trimmed text at a path, or undefined when absent, empty or `null`. */
export function text(node:XmlNode|undefined,path?:string):string|undefined {
 const target=path?at(node,path):node;if(!target)return undefined;
 const value=target.text.trim();return value&&value!=='null'?value:undefined;
}
export function num(node:XmlNode|undefined,path?:string):number|undefined {
 const value=text(node,path);if(value===undefined)return undefined;const parsed=Number(value);return Number.isFinite(parsed)?parsed:undefined;
}
export function isNull(node:XmlNode|undefined):boolean {return !node||node.attrs?.IsNull==='True';}
/** `<li>` items of a list element. */
export function items(node:XmlNode|undefined,path?:string):XmlNode[] {
 const target=path?at(node,path):node;return children(target,'li');
}
/** Scribe dictionary (`keys/li` + `values/li`) as pairs of nodes. */
export function dictionary(node:XmlNode|undefined):[XmlNode,XmlNode][] {
 const keys=items(node,'keys'),values=items(node,'values');
 return keys.map((k,i)=>[k,values[i]!] as [XmlNode,XmlNode]).filter(pair=>pair[1]);
}
