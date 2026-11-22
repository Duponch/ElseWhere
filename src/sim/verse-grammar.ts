/** RimWorld's text grammar (`Verse.Grammar`, Core 1.6.4871), rewritten from
 * the decompiled `GrammarResolver`, `Rule`, `Rule_String`, `Rule_File`,
 * `Rule_NamePerson`, `Rule_Number`, `RulePack` and `RulePackDef`; no code
 * copied. With the same rule packs and the same generator state, it draws the
 * same values in the same order and produces the same text as the game.
 *
 * Rule packs come from the installed game at run time (user's decision of
 * 22 November 2026, `src/import/rimworld/game-grammar.ts`): nothing of the
 * game's text lives in this file or anywhere in the repository.
 *
 * How the game resolves a root keyword (`ResolveUnsafe`):
 * - the rules are collected afresh for each resolution: the request's own
 *   rules, then the included packs (a stack: the last pushed is taken first,
 *   each pack once, its own rules then its includes pushed), then every rule
 *   of `GlobalUtility` with its includes; a keyword lists its rules in that
 *   order, each with its own use count;
 * - a rule's text is scanned left to right; each `[symbol]` is replaced by a
 *   rule of that keyword chosen by weight among the valid rules of the highest
 *   priority (`TryRandomElementByWeight`: one `Value` unless a single rule
 *   exists), the weight being `p × 100 000 / ((uses + 1) × 1 000)`; a rule's
 *   use count rises when it is chosen, before it is expanded; a rule that
 *   cannot be expanded is marked unresolvable and another one is drawn;
 * - a file rule draws one of its lines (`Range(0, count)`), a person-name rule
 *   draws a gender when it has none (`Value < 0.5`) then 51 first names from
 *   the name list (the game's loop runs 51 times when it does not check for
 *   names in use), a number rule `RangeInclusive`;
 * - limits: 1 000 expansions, depth 50; on failure the game resolves the
 *   whole request a second time to log it (its draws count), the result being
 *   « ERR »; in a translated game the resolution is then retried once with
 *   the untranslated (English) rules;
 * - the text is post-processed by the language (`PostProcessed`), its
 *   sentences capitalized, spaces before « , » and « . » removed, trimmed.
 *
 * Pure and deterministic: the caller supplies the generator. */
import {tryRandomElementByWeight,type VerseWeightedRandom} from './verse-rand.ts';
import {DOTNET_WORD,capitalizeSentences,dotNetTrim,languagePostProcessed,type LanguageWorkerKind} from './verse-text.ts';
const f=Math.fround;

export type GrammarConstraintType='=='|'!='|'<'|'>'|'<='|'>=';
export interface GrammarConstraint {readonly key:string;readonly value:string;readonly type:GrammarConstraintType}
interface GrammarRuleCommon {
 /** Null only for a rule the game failed to parse (it is still added, and
  * the game then fails when it collects it). */
 readonly keyword:string|null;
 readonly tag:string|null;readonly requiredTag:string|null;readonly usesLimit:number|null;
 readonly constraints:readonly GrammarConstraint[]|null;
}
export type GrammarRule=
 |GrammarRuleCommon&{readonly kind:'string';readonly output:string|null;readonly weight:number;readonly priority:number}
 |GrammarRuleCommon&{readonly kind:'file';readonly strings:readonly string[];
   /** Where the lines came from, for reports only: each path the rule names
    * and the language folder that held it (null when no language had it). */
   readonly sources?:readonly {readonly path:string;readonly language:string|null}[]}
 |GrammarRuleCommon&{readonly kind:'person';readonly gender:'None'|'Male'|'Female'}
 |GrammarRuleCommon&{readonly kind:'number';readonly min:number;readonly max:number;readonly weight:number};
const COMMON:Omit<GrammarRuleCommon,'keyword'>={tag:null,requiredTag:null,usesLimit:null,constraints:null};

/** A rule whose text is given (`new Rule_String(keyword, output)`). */
export function grammarStringRule(keyword:string,output:string):GrammarRule {return {kind:'string',keyword,output,weight:1,priority:0,...COMMON};}
/** A rule drawing a line of a word list (`Rule_File` once its lines are loaded). */
export function grammarFileRule(keyword:string,strings:readonly string[]):GrammarRule {return {kind:'file',keyword,strings,...COMMON};}

// ---- Rule_String(rawString) -------------------------------------------------
const OPERATORS='==|=|!=|>=|<=|>|<|\\[less_than\\]|\\[greater_than\\]';
const RULE_PATTERN=new RegExp(`^([a-zA-Z0-9_/]+)(\\(((?:[ ]*[a-zA-Z0-9_/]+(?:${OPERATORS})[^,)]*,?)*)\\))?[ ]*->(.*)$`,'s');
const PARAMETER=new RegExp(`[ ]*([a-zA-Z0-9_/]+)(${OPERATORS})([^,)]*),?`,'y');
const CONSTRAINT_TYPES:Readonly<Record<string,GrammarConstraintType>>={'==':'==','!=':'!=','>':'>','<':'<','>=':'>=','<=':'<=','[less_than]':'<','[greater_than]':'>'};
/** `float.Parse` with the invariant culture; throws like the game. */
export function parseDotNetFloat(text:string):number {
 const t=dotNetTrim(text);
 if(!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t))throw Error(`Nombre illisible : « ${text} ».`);
 return f(Number(t));
}
function parseDotNetInt(text:string):number {
 const t=dotNetTrim(text);
 if(!/^[+-]?\d+$/.test(t))throw Error(`Entier illisible : « ${text} ».`);
 const v=Number(t);if(v< -2147483648||v>2147483647)throw Error(`Entier hors limites : « ${text} ».`);
 return v;
}
/** `new Rule_String(rawString)`: « keyword(p=2,tag=x,...)->output ». A text
 * that does not match keeps a null keyword and output, as in the game; a bad
 * number throws (the game then skips the rule). Parameters `p`, `priority`,
 * `tag`, `requiredTag` and `uses` are assigned whatever their operator (the
 * game only logs a wrong one); any other name with a comparison operator is a
 * constraint on a constant; anything else is ignored. */
export function parseGrammarRuleString(raw:string):GrammarRule {
 const m=RULE_PATTERN.exec(raw);
 if(!m)return {kind:'string',keyword:null,output:null,weight:1,priority:0,...COMMON};
 let weight=1,priority=0,tag:string|null=null,requiredTag:string|null=null,usesLimit:number|null=null;const constraints:GrammarConstraint[]=[];
 const params=m[3]??'';PARAMETER.lastIndex=0;
 for(let p=PARAMETER.exec(params);p&&p[0].length;p=PARAMETER.exec(params)){
  const [,name,op,value]=p as unknown as [string,string,string,string];
  switch(name){
   case 'p':weight=parseDotNetFloat(value);break;
   case 'priority':priority=parseDotNetFloat(value);break;
   case 'tag':tag=value;break;
   case 'requiredTag':requiredTag=value;break;
   case 'uses':usesLimit=parseDotNetInt(value);break;
   case 'debug':break;
   default:{const type=CONSTRAINT_TYPES[op];if(type)constraints.push({key:name,value,type});}
  }
 }
 return {kind:'string',keyword:m[1]!,output:m[4]!,weight,priority,tag,requiredTag,usesLimit,constraints:constraints.length?constraints:null};
}

// ---- Rule packs --------------------------------------------------------------
/** A `RulePack`: its rules in the game's order (strings, files, raw rules),
 * translated and untranslated, and its own includes. */
export interface GrammarRulePack {readonly rules:readonly GrammarRule[];readonly untranslatedRules:readonly GrammarRule[];readonly include:readonly string[]}
/** A `RulePackDef`. */
export interface GrammarPackDef {readonly defName:string;readonly include:readonly string[];readonly rulePack:GrammarRulePack|null}
export interface GrammarLanguage {
 readonly worker:LanguageWorkerKind;
 /** The game's default language (English): no retry with untranslated rules. */
 readonly isDefault:boolean;
}
/** First names of the game's standard person-name list (`NameBank`,
 * category HumanStandard, slot First), in the list's order. */
export interface GrammarPersonNames {readonly male:readonly string[];readonly female:readonly string[]}
/** The pack every resolution adds (`RulePackDefOf.GlobalUtility`). */
export const GRAMMAR_GLOBAL_PACK='GlobalUtility';

interface CompiledRules {readonly rules:readonly GrammarRule[];readonly byKeyword:ReadonlyMap<string,readonly number[]>;readonly nullKeyword:boolean}
export class GrammarDatabase {
 readonly language:GrammarLanguage;readonly personNames:GrammarPersonNames|null;
 readonly #packs=new Map<string,GrammarPackDef>();
 readonly #immediate=new Map<string,readonly GrammarRule[]>();
 readonly #plus=new Map<string,readonly GrammarRule[]>();
 readonly #compiled=new Map<string,CompiledRules>();
 constructor(packs:Iterable<GrammarPackDef>,language:GrammarLanguage,personNames:GrammarPersonNames|null=null){
  for(const pack of packs)this.#packs.set(pack.defName,pack);
  this.language=language;this.personNames=personNames;
 }
 has(defName:string):boolean {return this.#packs.has(defName);}
 get packNames():string[] {return [...this.#packs.keys()];}
 #pack(defName:string):GrammarPackDef {const pack=this.#packs.get(defName);if(!pack)throw Error(`Paquet de règles inconnu : ${defName}.`);return pack;}
 /** `RulePackDef.RulesImmediate`: the pack's rules, then its `RulePack`
  * includes with theirs; null without a rule pack. */
 rulesImmediate(defName:string,untranslated:boolean):readonly GrammarRule[]|null {
  const pack=this.#pack(defName);if(!pack.rulePack)return null;
  const key=`${untranslated?1:0}${defName}`;let rules=this.#immediate.get(key);
  if(!rules){rules=[...untranslated?pack.rulePack.untranslatedRules:pack.rulePack.rules,...pack.rulePack.include.flatMap(i=>this.rulesPlusIncludes(i,untranslated))];this.#immediate.set(key,rules);}
  return rules;
 }
 /** `RulePackDef.RulesPlusIncludes`. */
 rulesPlusIncludes(defName:string,untranslated:boolean,visiting=new Set<string>()):readonly GrammarRule[] {
  const key=`${untranslated?1:0}${defName}`;let rules=this.#plus.get(key);
  if(!rules){
   if(visiting.has(defName))throw Error(`Paquets de règles inclus en boucle : ${defName}.`);visiting.add(defName);
   const pack=this.#pack(defName);
   rules=[...(this.rulesImmediate(defName,untranslated)??[]),...pack.include.flatMap(i=>this.rulesPlusIncludes(i,untranslated,visiting))];
   visiting.delete(defName);this.#plus.set(key,rules);
  }
  return rules;
 }
 /** `RulePackDef.FirstRuleKeyword` / `FirstUntranslatedRuleKeyword`. */
 firstRuleKeyword(defName:string,untranslated:boolean):string {return this.rulesPlusIncludes(defName,untranslated)[0]?.keyword??'none';}
 /** The rules of one resolution, keyed by keyword (cached when the request
  * brings no rules of its own: the collection draws nothing). */
 compile(includes:readonly string[],requestRules:readonly GrammarRule[]|null,untranslated:boolean):CompiledRules {
  const cacheable=!requestRules,key=`${untranslated?1:0}\u0000${includes.join('\u0000')}`;
  const cached=cacheable?this.#compiled.get(key):undefined;if(cached)return cached;
  const rules:GrammarRule[]=[...requestRules??[]];
  const stack=[...includes],seen=new Set<string>();
  while(stack.length){
   const name=stack.pop()!;if(seen.has(name))continue;seen.add(name);
   rules.push(...this.rulesImmediate(name,untranslated)??[]);
   stack.push(...this.#pack(name).include);
  }
  if(this.#packs.has(GRAMMAR_GLOBAL_PACK))rules.push(...this.rulesPlusIncludes(GRAMMAR_GLOBAL_PACK,untranslated));
  const byKeyword=new Map<string,number[]>();let nullKeyword=false;
  rules.forEach((rule,i)=>{if(rule.keyword===null){nullKeyword=true;return;}let list=byKeyword.get(rule.keyword);if(!list)byKeyword.set(rule.keyword,list=[]);list.push(i);});
  const result={rules,byKeyword,nullKeyword};if(cacheable)this.#compiled.set(key,result);return result;
 }
}

// ---- Resolution -------------------------------------------------------------------
/** The draws the grammar takes from `Verse.Rand`. `VerseRand` is one. */
export interface GrammarRandom extends VerseWeightedRandom {range(minInclusive:number,maxExclusive:number):number;rangeInclusive(minInclusive:number,maxInclusive:number):number}
export interface GrammarRequest {
 /** `GrammarRequest.Includes`: rule pack names. */
 readonly includes?:readonly string[];
 /** `GrammarRequest.Rules`; null or absent when the request has none. */
 readonly rules?:readonly GrammarRule[]|null;
 readonly constants?:ReadonlyMap<string,string>|null;
}
/** A feature this port does not reproduce (a person-name rule without the
 * game's name list, a `{lookup}` or `{replace}` function, a gendered symbol):
 * continuing would leave the game's draws, so the caller must stop. */
export class GrammarUnsupportedError extends Error {}
/** Where the game itself throws while resolving (a translated resolution is
 * then retried with the untranslated rules, as the game does). */
class GrammarRuntimeError extends Error {}

const FLOAT_MIN=-3.4028234663852886e38;
interface Resolution {
 readonly db:GrammarDatabase;readonly random:GrammarRandom;readonly compiled:CompiledRules;
 readonly constants:ReadonlyMap<string,string>|null;readonly extraTags:readonly string[]|null;
 readonly uses:Int32Array;readonly unresolvable:Uint8Array;
 loops:number;
}
const baseWeight=(rule:GrammarRule)=>rule.kind==='file'?rule.strings.length:rule.kind==='person'?1:rule.weight;
/** `RuleEntry.SelectionWeight`: evaluated in double, returned as a float. */
const selectionWeight=(rule:GrammarRule,uses:number)=>f(f(baseWeight(rule))*100000/f((uses+1)*1000));
const priorityOf=(rule:GrammarRule)=>rule.kind==='string'?rule.priority:0;
function parseLooseFloat(text:string):number|undefined {try{return text?parseDotNetFloat(text):undefined;}catch{return undefined;}}
const equalsIgnoreCase=(a:string,b:string)=>a.localeCompare(b,'en',{sensitivity:'accent'})===0;
/** `Rule.ValidateConstraints`. */
function constraintsHold(rule:GrammarRule,constants:ReadonlyMap<string,string>|null):boolean {
 for(const c of rule.constraints??[]){
  const text=constants?.get(c.key)??'',a=parseLooseFloat(text),b=parseLooseFloat(c.value),numbers=a!==undefined&&b!==undefined;
  const ok=c.type==='=='?equalsIgnoreCase(text,c.value):c.type==='!='?!equalsIgnoreCase(text,c.value)
   :numbers&&(c.type==='<'?a<b:c.type==='>'?a>b:c.type==='<='?a<=b:a>=b);
  if(!ok)return false;
 }
 return true;
}
function valid(r:Resolution,i:number,resolvedTags:readonly string[]):boolean {
 const rule=r.compiled.rules[i]!;
 if(r.unresolvable[i])return false;
 if(rule.constraints&&!constraintsHold(rule,r.constants))return false;
 if(rule.requiredTag&&!r.extraTags?.includes(rule.requiredTag)&&!resolvedTags.includes(rule.requiredTag))return false;
 return rule.usesLimit===null||r.uses[i]!<rule.usesLimit;
}
/** `RandomPossiblyResolvableEntry`: -1 when nothing can be drawn. */
function drawEntry(r:Resolution,keyword:string,resolvedTags:readonly string[]):number {
 const list=r.compiled.byKeyword.get(keyword);if(!list)return -1;
 let maxPriority=FLOAT_MIN;
 for(const i of list)if(valid(r,i,resolvedTags)&&selectionWeight(r.compiled.rules[i]!,r.uses[i]!)!==0){const p=priorityOf(r.compiled.rules[i]!);if(p>maxPriority)maxPriority=p;}
 const chosen=tryRandomElementByWeight(r.random,list,i=>!valid(r,i,resolvedTags)||priorityOf(r.compiled.rules[i]!)!==maxPriority?0:selectionWeight(r.compiled.rules[i]!,r.uses[i]!));
 return chosen.found?chosen.value:-1;
}
/** `Rule.Generate`. */
function generate(rule:GrammarRule,db:GrammarDatabase,random:GrammarRandom):string {
 switch(rule.kind){
  case 'string':return rule.output??'';
  case 'file':return rule.strings.length?rule.strings[random.range(0,rule.strings.length)]!:'Filestring';
  case 'number':return String(random.rangeInclusive(rule.min,rule.max));
  case 'person':{
   const names=db.personNames;
   if(!names)throw new GrammarUnsupportedError('Règle « nom de personne » sans la liste de prénoms du jeu.');
   const gender=rule.gender==='None'?(random.value<.5?'Male':'Female'):rule.gender,list=gender==='Male'?names.male:names.female;
   if(!list.length)return 'Errorname';
   // NameBank.GetName without the in-use check: its loop runs 51 times.
   let name='';for(let n=0;n<=50;n++)name=list[random.range(0,list.length)]!;
   return name;
  }
 }
}
/** `TryResolveRecursive`. `entry` is -1 for the root rule. */
function resolveRecursive(r:Resolution,rule:GrammarRule,entry:number,depth:number,resolvedTags:string[]):{ok:boolean;output:string} {
 if(++r.loops>1000)return {ok:false,output:'HIT_LOOPS_LIMIT'};
 if(depth>50)return {ok:false,output:'DEPTH_LIMIT_REACHED'};
 let text=generate(rule,r.db,r.random),failed=false,open=-1;
 for(let j=0;j<text.length;j++){
  const c=text[j];
  if(c==='[')open=j;
  if(c!==']')continue;
  if(open===-1){failed=true;continue;}
  const keyword=text.slice(open+1,j);
  for(;;){
   const chosen=drawEntry(r,keyword,resolvedTags);
   if(chosen<0){if(entry>=0)r.unresolvable[entry]=1;failed=true;break;}
   r.uses[chosen]!++;
   const tags=[...resolvedTags],sub=resolveRecursive(r,r.compiled.rules[chosen]!,chosen,depth+1,tags);
   if(sub.ok){
    text=text.slice(0,open)+sub.output+text.slice(j+1);j=open;
    resolvedTags.length=0;resolvedTags.push(...tags);
    const tag=r.compiled.rules[chosen]!.tag;if(tag&&!resolvedTags.includes(tag))resolvedTags.push(tag);
    break;
   }
   r.unresolvable[chosen]=1;
  }
 }
 return {ok:!failed,output:text};
}
const SPACE_CLASS='\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000';
const FUNCTION_CALL=new RegExp(`\\{[${SPACE_CLASS}]*([${DOTNET_WORD}]+)[${SPACE_CLASS}]*:[${SPACE_CLASS}]*([^}]* ?)[${SPACE_CLASS}]*\\}`,'gu');
const GENDER_CALL=new RegExp(`\\{[${SPACE_CLASS}]*([${DOTNET_WORD}]+)_gender[${SPACE_CLASS}]*\\?[${SPACE_CLASS}]*([^}]* ?)[${SPACE_CLASS}]*\\}`,'gu');
/** `GrammarResolver.ResolveAllFunctions`, as far as names need it: unknown
 * functions are left as they are (the game only warns). */
function resolveAllFunctions(input:string,constants:ReadonlyMap<string,string>|null):string {
 if(input.includes('%%'))return input;
 for(const m of input.matchAll(FUNCTION_CALL))if(m[1]==='lookup'||m[1]==='replace')throw new GrammarUnsupportedError(`Fonction de grammaire non reproduite : ${m[1]}.`);
 for(const m of input.matchAll(GENDER_CALL)){
  if(!constants)throw new GrammarRuntimeError('Symbole genré sans constantes.');
  if(constants.has(`${m[1]}_gender`))throw new GrammarUnsupportedError('Symbole genré non reproduit.');
 }
 return input;
}
export interface GrammarResolveOptions {
 readonly untranslatedRootKeyword?:string|null;
 readonly extraTags?:readonly string[]|null;
 readonly capitalizeFirstSentence?:boolean;
}
/** `GrammarResolver.ResolveUnsafe`. */
export function grammarResolveUnsafe(db:GrammarDatabase,rootKeyword:string,request:GrammarRequest,random:GrammarRandom,options:{useUntranslatedRules?:boolean;forceLog?:boolean;extraTags?:readonly string[]|null;capitalizeFirstSentence?:boolean}={}):{text:string;success:boolean} {
 const untranslated=options.useUntranslatedRules??false,compiled=db.compile(request.includes??[],request.rules??null,untranslated);
 // Dictionary.TryGetValue(null) throws before any draw.
 if(compiled.nullKeyword)throw new GrammarRuntimeError('Règle sans mot-clé.');
 const constants=request.constants??null,extraTags=options.extraTags??null;
 const r:Resolution={db,random,compiled,constants,extraTags,uses:new Int32Array(compiled.rules.length),unresolvable:new Uint8Array(compiled.rules.length),loops:0};
 const root=grammarStringRule('',`[${rootKeyword}]`),result=resolveRecursive(r,root,-1,0,[]);
 let output=result.output;
 if(!result.ok){
  const own=request.rules??[];
  output=own.length?'ERR: '+generate(own[0]!,db,random):'ERR';
  // The game resolves the request again to log the failure: those draws count.
  if(!options.forceLog)grammarResolveUnsafe(db,rootKeyword,request,random,{useUntranslatedRules:untranslated,forceLog:true,extraTags});
 }
 output=resolveAllFunctions(output,constants);
 output=capitalizeSentences(languagePostProcessed(db.language.worker,output),options.capitalizeFirstSentence??true);
 output=dotNetTrim(output.replace(/ +([,.])/g,'$1'));
 return {text:output,success:result.ok};
}
/** `GrammarResolver.Resolve`: in a translated game, a failed or throwing
 * resolution is retried once with the untranslated rules. */
export function grammarResolve(db:GrammarDatabase,rootKeyword:string,request:GrammarRequest,random:GrammarRandom,options:GrammarResolveOptions={}):string {
 const common={extraTags:options.extraTags??null,capitalizeFirstSentence:options.capitalizeFirstSentence??true};
 if(db.language.isDefault)return grammarResolveUnsafe(db,rootKeyword,request,random,common).text;
 try{const first=grammarResolveUnsafe(db,rootKeyword,request,random,common);if(first.success)return first.text;}
 catch(error){if(!(error instanceof GrammarRuntimeError))throw error;}
 return grammarResolveUnsafe(db,options.untranslatedRootKeyword??rootKeyword,request,random,{...common,useUntranslatedRules:true}).text;
}
