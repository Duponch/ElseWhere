/** Narrow control-flow oracle for Three's generated paint-bank samples.
 * Tracks explicit private-variable assignments through structured if/else.
 * WGSL's implicit zero initialization is deliberately NOT a computed UV metric.
 * This is not a general WGSL validator, constant evaluator or GPU pixel test. */
export interface PaintBankRead {bank:string;line:number;coordinates:string;profile:string;missing:string[]}
type State=Map<string,Set<string>>;
interface Token {text:string;line:number}
interface Statement {token:Token;body?:Statement[];otherwise?:Statement[];conditional?:boolean}

function tokens(code:string,firstLine:number):Token[]{
 const result:Token[]=[];let start=0,line=firstLine,startLine=firstLine,parens=0;
 for(let i=0;i<code.length;i++){
  const c=code[i]!;if(c==='\n')line++;if(c==='(')parens++;if(c===')')parens--;
  if(c==='{'||c==='}'||(c===';'&&parens===0)){
   const text=code.slice(start,i+1).trim();if(text)result.push({text,line:startLine});start=i+1;startLine=line;
  }else if(!code.slice(start,i).trim()&&!/\s/.test(c))startLine=line;
 }
 return result;
}
function parse(input:Token[]):Statement[]{
 let at=0;
 const statementFrom=(token:Token):Statement=>{
  const statement:Statement={token};
  if(token.text.endsWith('{')){
   statement.body=block();statement.conditional=/^if\b/.test(token.text);
   if(statement.conditional&&/^else\b/.test(input[at]?.text??'')){
    const other=input[at++]!;
    statement.otherwise=/^else\s+if\b/.test(other.text)
     ?[statementFrom({...other,text:other.text.replace(/^else\s+/,'')})]
     :block();
   }
  }
  return statement;
 };
 const block=():Statement[]=>{
  const result:Statement[]=[];
  while(at<input.length){
   const token=input[at++]!;if(token.text==='}')break;
   result.push(statementFrom(token));
  }
  return result;
 };
 return block();
}
function argumentsOf(text:string,open:number):string[]{
 let depth=0,start=open+1;const args:string[]=[];
 for(let i=open+1;i<text.length;i++){
  const c=text[i]!;if(c==='(')depth++;else if(c===')'){if(depth===0){args.push(text.slice(start,i).trim());return args;}depth--;}
  else if(c===','&&depth===0){args.push(text.slice(start,i).trim());start=i+1;}
 }
 throw Error('Unclosed generated texture sample');
}
export function paintBankReads(source:string,banks:ReadonlySet<string>):PaintBankRead[]{
 const code=source.replace(/\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,s=>' '.repeat(s.length)),entry=/\bfn\s+main\s*\([^]*?\)\s*(?:->[^{}]+)?\s*\{/.exec(code);
 if(!entry)throw Error('Expected generated main entry');
 const start=entry.index+entry[0].length,end=code.lastIndexOf('}'),declared=new Set([...code.slice(0,entry.index).matchAll(/\bvar<private>\s+(\w+)\s*:/g)].map(m=>m[1]!)),reads:PaintBankRead[]=[];
 const dependencies=(text:string,state:State)=>{
  const missing=new Set<string>();for(const match of text.matchAll(/\b[A-Za-z_]\w*\b/g))if(declared.has(match[0])){
   const value=state.get(match[0]);if(value)for(const reason of value)missing.add(reason);else missing.add(match[0]);
  }return missing;
 };
 const merge=(a:State,b:State):State=>{
  const merged:State=new Map();for(const key of new Set([...a.keys(),...b.keys()])){
   const x=a.get(key),y=b.get(key);merged.set(key,new Set([...(x??[key]),...(y??[key])]));
  }return merged;
 };
 const visit=(statements:Statement[],initial:State):State=>{
  let state=new Map(initial);
  for(const statement of statements){
   const {text,line}=statement.token;
   if(statement.body){
    const next=visit(statement.body,state),other=statement.otherwise?visit(statement.otherwise,state):state;
    // A loop/block may execute zero times. No paint sample in these programs
    // relies on loop-local assignments; preserve only definitely computed data.
    state=merge(next,other);continue;
   }
   for(const sample of text.matchAll(/\btextureSample(?:Level|Bias)?\s*\(/g)){
    const args=argumentsOf(text,sample.index!+sample[0].lastIndexOf('(')),bank=args[0]!;
    if(banks.has(bank)){if(args.length<4)throw Error('Expected array pigment coordinates and layer');reads.push({bank,line,coordinates:args[2]!,profile:args[3]!,missing:[...dependencies(args[2]!+','+args[3]!,state)].sort()});}
   }
   const assignment=/^(\w+)(?:\.([xyzwrgba]+))?\s*=\s*([^]*);$/.exec(text);
   if(assignment&&declared.has(assignment[1]!)){
    const missing=dependencies(assignment[3]!,state);if(assignment[2])for(const reason of state.get(assignment[1]!)??[assignment[1]!])missing.add(reason);
    state.set(assignment[1]!,missing);
   }
  }return state;
 };
 visit(parse(tokens(code.slice(start,end),code.slice(0,start).split('\n').length)),new Map());return reads;
}
