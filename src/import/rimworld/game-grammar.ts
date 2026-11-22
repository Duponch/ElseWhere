/** The game's grammar data, read from an installed RimWorld 1.6 at run time
 * (user's decision of 22 November 2026: never copied into the repository).
 *
 * What the game reads for faction and settlement names, and in which order
 * (decompiled `LoadedLanguage`, `DefInjectionPackage`, `Translator`,
 * `RulePack`, `RulePackDef`, `Rule_File`, `NameBank`,
 * `PawnNameDatabaseShuffled`; no code copied):
 * 1. the definitions under `Data/Core/Defs`: every `RulePackDef` (its rule pack
 *    of rule strings, word-list rules and raw rules, its includes) and the
 *    `FactionDef`s (their name packs and fixed names, through `ParentName`
 *    inheritance); the untranslated rules are kept as loaded;
 * 2. the active language's `DefInjected/RulePackDef` files replace a pack's
 *    whole list of rule strings or word-list rules
 *    (`<Pack>.rulePack.rulesStrings` with `<li>` items, any count) or one item
 *    (`….rulesStrings.3`); `TODO` keeps the original; `DefInjected/FactionDef`
 *    replaces fixed names; only the active language injects;
 * 3. a word-list rule « keyword->Words/Nouns/X » takes the lines of
 *    `Strings/Words/Nouns/X.txt` of the active language, or of English when the
 *    active language lacks the file (`Translator.TryGetTranslatedStringsForFile`)
 *    — for the untranslated rules too; only files inside a subfolder of
 *    `Strings` count; lines are read by `GenText.LinesFromString`;
 * 4. `NamePerson` rules draw from the game's standard first names, which are
 *    not in `Data` but in the Unity resources (`Text/Names/First_Male`,
 *    `First_Female`), the same in every language.
 * A language is a folder or a `.tar` archive under `Data/Core/Languages`.
 *
 * Pure TypeScript: the caller hands the files over (`GameFolder`). */
import {gameText,openGameLanguage,type GameFolder,type GameLanguageFolder} from './game-files.ts';
import {parseXml,child,text as xmlText,type XmlNode} from './xml.ts';
import {GrammarDatabase,parseGrammarRuleString,parseDotNetFloat,type GrammarConstraint,type GrammarConstraintType,type GrammarPackDef,type GrammarPersonNames,type GrammarRule} from '../../sim/verse-grammar.ts';
import {isLanguageWorkerKind,linesFromString,dotNetTrim,type LanguageWorkerKind} from '../../sim/verse-text.ts';

/** What a faction definition says about names. */
export interface GameFactionNaming {readonly factionNameMaker:string|null;readonly settlementNameMaker:string|null;readonly fixedName:string|null}
export interface GameGrammar {
 readonly language:{readonly folderName:string;readonly source:string;readonly worker:LanguageWorkerKind;readonly isDefault:boolean};
 readonly grammar:GrammarDatabase;
 readonly factions:ReadonlyMap<string,GameFactionNaming>;
 /** Counts for reports (numbers only). */
 readonly counts:{readonly defFiles:number;readonly rulePacks:number;readonly injectedPacks:number;readonly activeStringFiles:number;readonly defaultStringFiles:number;readonly personNames:number};
 /** What the loader could not apply, as the game would log it. */
 readonly problems:readonly string[];
}
/** The game's default language folder. */
export const DEFAULT_LANGUAGE_FOLDER='English';

const lis=(node:XmlNode|undefined)=>node?node.children.filter(c=>c.name==='li'):[];
/** `ParseHelper.ParseString`: a written « \n » becomes a line break. */
const parseString=(s:string)=>s.replace(/\\n/g,'\n');
/** Field names are matched ignoring case (`BindingFlags.IgnoreCase`). */
const sameField=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();

interface RawRulePack {strings:string[];files:string[];raw:XmlNode[];include:string[]}
interface RawRulePackDef {defName:string;include:string[];rulePack:RawRulePack|null}
interface RawFactionDef {name:string|null;parent:string|null;abstract:boolean;defName:string|null;fields:Map<string,string>}

function readRulePackDef(node:XmlNode):RawRulePackDef|null {
 const defName=xmlText(node,'defName');if(!defName)return null;
 const pack=child(node,'rulePack');
 return {defName,include:lis(child(node,'include')).map(li=>dotNetTrim(li.text)).filter(Boolean),
  rulePack:pack?{strings:lis(child(pack,'rulesStrings')).map(li=>parseString(li.text)),files:lis(child(pack,'rulesFiles')).map(li=>parseString(li.text)),
   raw:lis(child(pack,'rulesRaw')),include:lis(child(pack,'include')).map(li=>dotNetTrim(li.text)).filter(Boolean)}:null};
}
function readFactionDef(node:XmlNode):RawFactionDef {
 const fields=new Map<string,string>();
 for(const name of ['factionNameMaker','settlementNameMaker','fixedName']){const value=child(node,name);if(value)fields.set(name,parseString(value.text));}
 return {name:node.attrs?.Name??null,parent:node.attrs?.ParentName??null,abstract:node.attrs?.Abstract?.toLowerCase()==='true',defName:xmlText(node,'defName')??null,fields};
}

interface Injection {readonly path:string;readonly value:string|null;readonly list:string[]|null}
/** `DefInjectionPackage.AddDataFromFile`. Returns the injections in file order;
 * a duplicated whole-list key stops the file, as the game's exception does. */
function readInjections(source:string,file:string,into:Map<string,Injection>,problems:string[]):void {
 let root:XmlNode;
 try{root=parseXml(source);}catch(error){problems.push(`${file} : ${(error as Error).message}`);return;}
 const processedPath=(p:string)=>p.includes('[')||p.includes(']')?p.replace(/]/g,'').replace(/\[/g,'.'):p;
 const processed=(t:string)=>t.replace(/\\n/g,'\n');
 for(const item of root.children){
  let key:string,value:string|null=null,list:string[]|null=null;
  if(item.name==='rep'){key=processedPath(child(item,'path')?.text??'');value=processed(child(item,'trans')?.text??'');}
  else{
   key=processedPath(item.name);
   if(key.endsWith('.slateRef'))continue;
   if(item.children.length)list=item.children.filter(c=>c.name==='li').map(c=>processed(c.text));
   else value=processed(item.text);
  }
  if(!key.includes('.')){problems.push(`${file} : clé sans point ${key}`);continue;}
  if(list){
   if([...into.keys()].some(k=>!into.get(k)!.list&&k.startsWith(key+'.'))){problems.push(`${file} : liste et éléments traduits ensemble ${key}`);continue;}
   if(into.has(key)){problems.push(`${file} : clé en double ${key}, fin du fichier ignorée`);return;}
   into.set(key,{path:key,value:null,list});
  } else {
   const parent=key.slice(0,key.lastIndexOf('.'));
   if(/\d$/.test(key)&&into.get(parent)?.list){problems.push(`${file} : liste et éléments traduits ensemble ${key}`);continue;}
   into.set(key,{path:key,value:value==='TODO'?null:value,list:null});
  }
 }
}

/** A language's word lists: `Strings/<dossier>/…/<nom>.txt` → lines, keyed
 * « <dossier>/…/<nom> » (`LoadedLanguage.LoadFromFile_Strings`). */
function readStringFiles(language:GameLanguageFolder):Map<string,string[]> {
 const files=new Map<string,string[]>();
 for(const folder of language.folder.folders('Strings'))for(const path of language.folder.files(`Strings/${folder}`)){
  if(!path.toLowerCase().endsWith('.txt'))continue;
  const key=path.slice('Strings/'.length,path.lastIndexOf('.')),bytes=language.folder.read(path);if(!bytes)continue;
  const lines=linesFromString(gameText(bytes)),existing=files.get(key);
  if(existing)existing.push(...lines);else files.set(key,lines);
 }
 return files;
}
function languageWorkerOf(language:GameLanguageFolder):string {
 const bytes=language.folder.read('LanguageInfo.xml');if(!bytes)return 'LanguageWorker_Default';
 try{return xmlText(parseXml(gameText(bytes)),'languageWorkerClass')??'LanguageWorker_Default';}catch{return 'LanguageWorker_Default';}
}
/** Def-injected folders of a type: « RulePackDef », or the plural folder the
 * game also accepts (« RulePackDefs »). */
function injectedFiles(language:GameLanguageFolder,type:string):string[] {
 return language.folder.folders('DefInjected').filter(n=>n===type||n.length>3&&n.slice(0,-1)===type).flatMap(n=>language.folder.files(`DefInjected/${n}`)).filter(p=>p.toLowerCase().endsWith('.xml'));
}

/** `IntRange.FromString`: « a~b » or a single number. */
function intRange(text:string):[number,number] {
 const parts=text.split('~').map(s=>Number(dotNetTrim(s)));
 const min=parts[0]!,max=parts.length>1?parts[1]!:min;
 if(!Number.isInteger(min)||!Number.isInteger(max))throw Error(`Intervalle illisible : « ${text} ».`);
 return [min,max];
}
const CONSTRAINT_TYPE_NAMES:Readonly<Record<string,GrammarConstraintType>>={Equal:'==',NotEqual:'!=',Less:'<',Greater:'>',LessOrEqual:'<=',GreaterOrEqual:'>='};

/** Loads the grammar of a language (folder or short name, « French ») from
 * `Data/Core`. `resources`: the game's `resources.assets`, for the first-name
 * lists of `NamePerson` rules (without it such a rule cannot be reproduced). */
export function loadGameGrammar(core:GameFolder,languageName:string,options:{resources?:Uint8Array|null}={}):GameGrammar {
 const problems:string[]=[];
 const active=openGameLanguage(core,languageName);if(!active)throw Error(`Langue introuvable dans le jeu : ${languageName}.`);
 const fallback=openGameLanguage(core,DEFAULT_LANGUAGE_FOLDER);if(!fallback)throw Error('Langue anglaise du jeu introuvable.');
 const isDefault=active.folderName===DEFAULT_LANGUAGE_FOLDER;
 const worker=languageWorkerOf(active);
 if(!isLanguageWorkerKind(worker))throw Error(`Langue non prise en charge (${worker}) : seules l'anglais et le français sont reproduits.`);

 // 1. Definitions.
 const packs=new Map<string,RawRulePackDef>(),factions:RawFactionDef[]=[];let defFiles=0;
 for(const path of core.files('Defs')){
  if(!path.toLowerCase().endsWith('.xml'))continue;
  const bytes=core.read(path);if(!bytes)continue;
  const source=gameText(bytes);if(!source.includes('<RulePackDef')&&!source.includes('<FactionDef'))continue;
  let root:XmlNode;try{root=parseXml(source);}catch(error){problems.push(`${path} : ${(error as Error).message}`);continue;}
  defFiles++;
  for(const node of root.children){
   if(node.name==='RulePackDef'){const def=readRulePackDef(node);if(def)packs.set(def.defName,def);}
   else if(node.name==='FactionDef')factions.push(readFactionDef(node));
  }
 }
 // 2. Injections of the active language (their translated copies).
 const injections=new Map<string,Injection>(),factionInjections=new Map<string,Injection>();
 for(const path of injectedFiles(active,'RulePackDef')){const bytes=active.folder.read(path);if(bytes)readInjections(gameText(bytes),path,injections,problems);}
 for(const path of injectedFiles(active,'FactionDef')){const bytes=active.folder.read(path);if(bytes)readInjections(gameText(bytes),path,factionInjections,problems);}
 const translated=new Map<string,{strings:string[];files:string[]}>(),injectedPacks=new Set<string>();
 for(const pack of packs.values())if(pack.rulePack)translated.set(pack.defName,{strings:[...pack.rulePack.strings],files:[...pack.rulePack.files]});
 for(const injection of injections.values()){
  const parts=injection.path.split('.'),pack=packs.get(parts[0]!);
  if(!pack)continue;
  if(parts.length<3||!sameField(parts[1]!,'rulePack')){continue;}
  const target=translated.get(pack.defName);if(!target){problems.push(`${injection.path} : paquet sans règles`);continue;}
  const field=sameField(parts[2]!,'rulesStrings')?'strings':sameField(parts[2]!,'rulesFiles')?'files':null;if(!field)continue;
  if(parts.length===3&&injection.list){target[field]=[...injection.list];injectedPacks.add(pack.defName);}
  else if(parts.length===4&&injection.value!==null&&/^\d+$/.test(parts[3]!)){
   const index=Number(parts[3]);
   if(index<target[field].length){target[field][index]=injection.value;injectedPacks.add(pack.defName);}else problems.push(`${injection.path} : indice hors de la liste`);
  }
 }
 // 3. Word lists, active language first, then English.
 const activeStrings=readStringFiles(active),defaultStrings=isDefault?activeStrings:readStringFiles(fallback);
 const lookup=(path:string):{lines:string[];language:string|null}=>{
  const a=activeStrings.get(path);if(a)return {lines:a,language:active.folderName};
  const d=defaultStrings.get(path);if(d)return {lines:d,language:fallback.folderName};
  problems.push(`Aucun fichier de mots pour ${path}`);return {lines:[],language:null};
 };
 const fileRule=(keyword:string,paths:readonly string[],common:Partial<GrammarRule>={}):GrammarRule=>{
  const strings:string[]=[],sources:{path:string;language:string|null}[]=[];
  for(const path of paths){if(!path)continue;const found=lookup(path);strings.push(...found.lines);sources.push({path,language:found.language});}
  return {tag:null,requiredTag:null,usesLimit:null,constraints:null,...common,kind:'file',keyword,strings,sources} as GrammarRule;
 };
 const rawRule=(node:XmlNode,where:string):GrammarRule|null=>{
  const cls=(node.attrs?.Class??'').replace(/^Verse\.Grammar\./,'');
  const constraints:GrammarConstraint[]=lis(child(node,'constantConstraints')).map(c=>({key:xmlText(c,'key')??'',value:child(c,'value')?.text??'',type:CONSTRAINT_TYPE_NAMES[xmlText(c,'type')??'Equal']??'=='}));
  const uses=xmlText(node,'usesLimit');
  const common={keyword:child(node,'keyword')?parseString(child(node,'keyword')!.text):null,tag:xmlText(node,'tag')??null,requiredTag:xmlText(node,'requiredTag')??null,
   usesLimit:uses!==undefined?Number(uses):null,constraints:constraints.length?constraints:null};
  try{
   switch(cls){
    case 'Rule_NamePerson':{const g=xmlText(node,'gender')??'None';return {...common,kind:'person',gender:g==='Male'||g==='Female'?g:'None'};}
    case 'Rule_Number':{const [min,max]=intRange(xmlText(node,'range')??'0');return {...common,kind:'number',min,max,weight:Number(xmlText(node,'selectionWeight')??'1')};}
    case 'Rule_String':{const w=xmlText(node,'weight'),p=xmlText(node,'priority');return {...common,kind:'string',output:child(node,'output')?parseString(child(node,'output')!.text):null,weight:w?parseDotNetFloat(w):1,priority:p?parseDotNetFloat(p):0};}
    case 'Rule_File':return fileRule(common.keyword??'',[xmlText(node,'path')??'',...lis(child(node,'pathList')).map(li=>li.text)],common);
   }
  }catch(error){problems.push(`${where} : ${(error as Error).message}`);return null;}
  problems.push(`${where} : règle ${cls||'sans classe'} non reproduite`);return null;
 };
 /** `RulePack.GetRulesResolved`: strings, then word lists, then raw rules. */
 const resolveRules=(strings:readonly string[],files:readonly string[],raw:readonly XmlNode[],where:string):GrammarRule[]=>{
  const rules:GrammarRule[]=[];
  for(const s of strings){try{const rule=parseGrammarRuleString(s);if(rule.keyword===null)problems.push(`${where} : règle illisible`);rules.push(rule);}catch(error){problems.push(`${where} : ${(error as Error).message}`);}}
  for(const s of files){const parts=s.split('->');if(parts.length<2){problems.push(`${where} : liste de mots illisible`);continue;}rules.push(fileRule(dotNetTrim(parts[0]!),[dotNetTrim(parts[1]!)]));}
  for(const node of raw){const rule=rawRule(node,where);if(rule)rules.push(rule);}
  return rules;
 };
 const defs:GrammarPackDef[]=[];
 for(const pack of packs.values()){
  const missing=[...pack.include,...pack.rulePack?.include??[]].filter(n=>!packs.has(n));
  for(const name of missing)problems.push(`${pack.defName} : paquet inclus introuvable ${name}`);
  const keep=(names:readonly string[])=>names.filter(n=>packs.has(n));
  const t=translated.get(pack.defName);
  defs.push({defName:pack.defName,include:keep(pack.include),rulePack:pack.rulePack&&t?{
   rules:resolveRules(t.strings,t.files,pack.rulePack.raw,pack.defName),
   untranslatedRules:resolveRules(pack.rulePack.strings,pack.rulePack.files,pack.rulePack.raw,pack.defName),
   include:keep(pack.rulePack.include)}:null});
 }
 // 4. First names for NamePerson rules.
 let personNames:GrammarPersonNames|null=null;
 if(options.resources){
  const male=unityTextAsset(options.resources,'First_Male'),female=unityTextAsset(options.resources,'First_Female');
  if(male!==undefined&&female!==undefined)personNames={male:linesFromString(male),female:linesFromString(female)};
  else problems.push('Prénoms du jeu introuvables dans les ressources.');
 }
 // Faction definitions through their parents; fixed names translated.
 const abstractByName=new Map(factions.filter(d=>d.name).map(d=>[d.name!,d]));
 const field=(def:RawFactionDef,name:string):string|null=>{
  for(let d:RawFactionDef|undefined=def,depth=0;d&&depth<32;d=d.parent?abstractByName.get(d.parent):undefined,depth++){const v=d.fields.get(name);if(v!==undefined)return dotNetTrim(v)||null;}
  return null;
 };
 const factionNaming=new Map<string,GameFactionNaming>();
 for(const def of factions){
  if(def.abstract||!def.defName)continue;
  // An injected fixed name applies even where the English definition has
  // none (the French translation names the mechanoid hive this way): the
  // faction then draws no name at all.
  const injected=factionInjections.get(`${def.defName}.fixedName`)?.value;
  factionNaming.set(def.defName,{factionNameMaker:field(def,'factionNameMaker'),settlementNameMaker:field(def,'settlementNameMaker'),fixedName:injected??field(def,'fixedName')});
 }
 const grammar=new GrammarDatabase(defs,{worker,isDefault},personNames);
 return {language:{folderName:active.folderName,source:active.source,worker,isDefault},grammar,factions:factionNaming,
  counts:{defFiles,rulePacks:defs.length,injectedPacks:injectedPacks.size,activeStringFiles:activeStrings.size,defaultStringFiles:isDefault?0:defaultStrings.size,personNames:personNames?personNames.male.length+personNames.female.length:0},problems};
}

/** The text of a Unity `TextAsset` named `name` inside a serialized asset
 * file (`resources.assets`): the object stores its name (32-bit length, bytes,
 * padding to 4) then its text (32-bit length, bytes). The first plausible
 * object of that name is taken; undefined when none. */
export function unityTextAsset(bytes:Uint8Array,name:string):string|undefined {
 const label=new TextEncoder().encode(name),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=label.length;
 for(let at=bytes.indexOf(label[0]!,4);at>=4&&at+length<=bytes.length;at=bytes.indexOf(label[0]!,at+1)){
  if(view.getInt32(at-4,true)!==length)continue;
  let same=true;for(let k=1;k<length;k++)if(bytes[at+k]!==label[k]){same=false;break;}
  if(!same)continue;
  // Padding counts from the start of the name, as Unity aligns its fields.
  const textAt=at+((length+3)&~3);if(textAt+4>bytes.length)continue;
  const size=view.getInt32(textAt,true);if(size<=0||textAt+4+size>bytes.length)continue;
  const body=bytes.subarray(textAt+4,textAt+4+size);if(body.includes(0))continue;
  return gameText(body);
 }
 return undefined;
}

/** Word-list files a name pack can read: the keywords reachable from its
 * root keyword through the rules of one resolution (the pack, its includes,
 * `GlobalUtility`), and for each word-list rule among them, its game path and
 * the language folder that held it. For reports (no word is returned). */
export function nameFilesReachable(grammar:GrammarDatabase,pack:string,untranslated=false):{path:string;language:string|null}[] {
 const compiled=grammar.compile([pack],null,untranslated),seen=new Set<string>(),out=new Map<string,{path:string;language:string|null}>();
 const queue=[grammar.firstRuleKeyword(pack,untranslated)];
 while(queue.length){
  const keyword=queue.shift()!;if(seen.has(keyword))continue;seen.add(keyword);
  for(const i of compiled.byKeyword.get(keyword)??[]){
   const rule=compiled.rules[i]!;
   if(rule.kind==='string'&&rule.output)for(const m of rule.output.matchAll(/\[([^\[\]]*)\]/g))queue.push(m[1]!);
   if(rule.kind==='file')for(const s of rule.sources??[])out.set(s.path,s);
  }
 }
 return [...out.values()];
}
