import type {AncientHumanBioFacts256,AncientHumanKnownName256,AncientHumanNameTriple256,AncientNameTokenTriple256} from './ancient-human-bio-types-256.ts';
import type {AncientHumanBirthRandom256} from './ancient-human-birth-256.ts';
const f=Math.fround;
// Original phonetic content. The bijection preserves word equality and pool
// indices without shipping the native lexical assets. Never consumes Rand.
const SYLLABLES=['ba','be','bi','bo','bu','ca','ce','ci','co','cu','da','de','di','do','du','fa','fe','fi','fo','fu','ga','ge','gi','go','gu','ka','ke','ki','ko','ku','la','le'] as const;
/** Read by the lore registry (src/lore); the list is unchanged. */
export {SYLLABLES as ANCIENT_NAME_SYLLABLES_256};
export function originalAncientHumanWord256(id:number,wordCount:number):string {
 if(!Number.isInteger(id)||id<0||id>=wordCount||!Number.isInteger(wordCount)||wordCount<1||wordCount>1048576)throw Error('Unresolved actual native word equivalence');
 if(id===0)return '';
 // Odd multiplier is a permutation on the original content's 20-bit space.
 let code=Math.imul(id-1,49157)&1048575;const pieces:string[]=[];
 for(let i=0;i<4;i++){pieces.push(SYLLABLES[code&31]!);code>>>=5;}
 const word=pieces.join('');return word[0]!.toUpperCase()+word.slice(1);
}
export function materializeAncientName256(row:AncientNameTokenTriple256,wordCount:number):AncientHumanNameTriple256 {
 return Object.freeze({first:originalAncientHumanWord256(row[0],wordCount),nick:originalAncientHumanWord256(row[1],wordCount),last:originalAncientHumanWord256(row[2],wordCount),nickSet:row[3]});
}
export function ancientHumanNameUsed256(name:AncientHumanNameTriple256,known:readonly AncientHumanKnownName256[]):boolean {
 // UsedThisGame dispatches from the EXISTING name's ConfusinglySimilarTo.
 return known.some(row=>row.kind==='single'?row.value===name.nick:row.name.nick===name.nick||row.name.first===name.first&&row.name.last===name.last);
}
export function ancientHumanWordUsed256(word:string,known:readonly AncientHumanKnownName256[]):boolean {
 return known.some(row=>row.kind==='single'?row.value===word:row.name.first===word||row.name.nick===word||row.name.last===word);
}
export function ancientHumanNameLabel256(name:AncientHumanNameTriple256):string {
 return name.nick===name.first||name.nick===name.last?`${name.first} ${name.last}`:`${name.first} '${name.nick}' ${name.last}`;
}
export interface AncientHumanNameWorking256 {readonly revision:1;readonly preferredNames:readonly [];readonly solidNames:Record<'Male'|'Female'|'Either',AncientNameTokenTriple256[]>}
/** One real private generation scope, NOT re-created by each NPC. Solid-name
 * Shuffle mutates this exact array for subsequent consumers in that scope. */
export function constructAncientHumanNameWorking256(facts:AncientHumanBioFacts256,options:{preferredNames:readonly string[]}):AncientHumanNameWorking256 {
 if(!options||!Array.isArray(options.preferredNames)||options.preferredNames.length)throw Error('Only the explicitly captured empty creation-name preference is represented');
 return {revision:1,preferredNames:Object.freeze([] as const),solidNames:{Male:[...facts.solidNames.Male],Female:[...facts.solidNames.Female],Either:[...facts.solidNames.Either]}};
}
function shuffle<T>(rows:T[],random:AncientHumanBirthRandom256):void {
 for(let last=rows.length-1;last>0;last--){const at=random.integer(0,last+1),value=rows[last]!;rows[last]=rows[at]!;rows[at]=value;}
}
/** This creation UI exposes no PreferredNames setting; its explicit empty
 * default adds no Shuffle draws, while the source's .5 Chance still occurs. */
export function tryAncientSolidName256(facts:AncientHumanBioFacts256,working:AncientHumanNameWorking256,gender:'Male'|'Female',known:readonly AncientHumanKnownName256[],random:AncientHumanBirthRandom256):AncientHumanNameTriple256|null {
 const either=working.solidNames.Either,specific=working.solidNames[gender],chance=f(f(f(either.length)+f(.1))/f(f(either.length+specific.length)+f(.1)));
 const rows=random.value()<chance?either:specific;
 if(!rows.length)return null; // actual empty-list failure; caller falls back.
 void(random.value()<f(.5)); // preferred list is truly empty in this UI.
 shuffle(rows,random);
 for(const row of rows){const name=materializeAncientName256(row,facts.wordCount);if(!ancientHumanNameUsed256(name,known))return name;}
 return null;
}
function wordFromBank(rows:readonly number[],facts:AncientHumanBioFacts256,known:readonly AncientHumanKnownName256[],random:AncientHumanBirthRandom256):string {
 if(!rows.length)throw Error('Actual selected Human name bank is empty; no Errorname placeholder');
 let word='';for(let tries=0;tries<=50;tries++){word=originalAncientHumanWord256(rows[random.integer(0,rows.length)]!,facts.wordCount);if(!ancientHumanWordUsed256(word,known))return word;}return word;
}
/** HumanStandard only. A true cultural/backstory RulePack remains its own
 * producer; no invocation may call this merely because that owner is absent. */
export function drawAncientHumanStandardName256(facts:AncientHumanBioFacts256,working:AncientHumanNameWorking256,gender:'Male'|'Female',known:readonly AncientHumanKnownName256[],random:AncientHumanBirthRandom256):AncientHumanNameTriple256 {
 if(random.value()<f(.5)){const solid=tryAncientSolidName256(facts,working,gender,known,random);if(solid)return solid;}
 const bank=facts.shuffled,first=wordFromBank(gender==='Male'?bank.maleFirst:bank.femaleFirst,facts,known,random),last=wordFromBank(bank.last,facts,known,random);let nick='';
 for(let attempt=0;attempt<50;attempt++){
  if(random.value()<f(.15)){const g=random.value()<f(.8)?'Either':gender;nick=wordFromBank(g==='Either'?bank.unisexNick:g==='Male'?bank.maleNick:bank.femaleNick,facts,known,random);}
  else nick=random.value()<f(.5)?first:last;
  if(!known.some(row=>row.kind==='triple'&&row.name.nick===nick))break;
 }
 return Object.freeze({first,nick,last,nickSet:true});
}

