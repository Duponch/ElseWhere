/** Text helpers of RimWorld 1.6 that shape generated names (`Verse.GenText`,
 * `Verse.LanguageWorker` and the English and French language workers),
 * rewritten from the decompiled algorithms; no code copied. Characters are
 * UTF-16 code units, as in .NET strings; .NET's Unicode classes (`char.IsUpper`,
 * `\w`, `\b`, `String.Trim`) are reproduced with Unicode property escapes.
 * Pure: no DOM, clock or randomness. */

/** `char.IsWhiteSpace`, the characters `String.Trim()` removes. */
const DOTNET_SPACE='\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000';
const TRIM=new RegExp(`^[${DOTNET_SPACE}]+|[${DOTNET_SPACE}]+$`,'gu');
/** `String.Trim()`. */
export const dotNetTrim=(text:string)=>text.replace(TRIM,'');
const SPACE=new RegExp(`^[${DOTNET_SPACE}]$`,'u');
export const isDotNetWhiteSpace=(c:string)=>SPACE.test(c);
/** .NET regular-expression word character (`\w`). */
export const DOTNET_WORD='\\p{L}\\p{Mn}\\p{Nd}\\p{Pc}';
const isUpper=(c:string)=>/^\p{Lu}$/u.test(c);
const isLetterOrDigit=(c:string)=>/^[\p{L}\p{Nd}]$/u.test(c);
/** `char.ToUpper`: one code unit in, one out. */
export function charToUpper(c:string):string {const u=c.toUpperCase();return u.length===1?u:c;}
/** `String.ToUpper()`: every code unit by itself. */
const stringToUpper=(s:string)=>Array.from(s,c=>c.length===1?charToUpper(c):c).join('');

/** `GenText.LinesFromString`: lines split on CR LF or LF, empty ones dropped,
 * trimmed; a line starting with `//` is skipped, a later `//` cuts the line
 * (the part kept is not trimmed again); an empty result is skipped. */
export function linesFromString(text:string):string[] {
 const lines:string[]=[];
 for(const raw of text.split(/\r\n|\n/)){
  if(!raw)continue;
  let line=dotNetTrim(raw);
  if(line.startsWith('//'))continue;
  line=line.split('//')[0]!;
  if(line.length)lines.push(line);
 }
 return lines;
}
/** `GenText.FirstLetterBetweenTags`. */
function firstLetterBetweenTags(s:string):number {
 return s[0]==='<'&&s.indexOf('>')>0&&s.length>1&&s[1]!=='/'?s.indexOf('>')+1:0;
}
/** `GenText.CapitalizeFirst`. */
export function capitalizeFirst(s:string):string {
 if(!s)return s;
 if(isUpper(s[0]!))return s;
 if(s.length===1)return stringToUpper(s);
 const i=firstLetterBetweenTags(s);
 return s.slice(0,i)+charToUpper(s[i]!)+s.slice(i+1);
}
/** `GenText.MergeMultipleSpaces`. */
export function mergeMultipleSpaces(s:string,leaveMultipleSpacesAtLineBeginning=true):string {
 if(!s||!s.includes('  '))return s;
 let out='',lineStart=true;
 for(let i=0;i<s.length;i++){
  const c=s[i]!;
  if(c==='\r'||c==='\n')lineStart=true;
  if(leaveMultipleSpacesAtLineBeginning&&lineStart||c!==' '||i===0||s[i-1]!==' ')out+=c;
  if(!isDotNetWhiteSpace(c))lineStart=false;
 }
 return out;
}
/** `GenText.CapitalizeSentences`. */
export function capitalizeSentences(input:string,capitalizeFirstSentence=true):string {
 if(!input)return input;
 if(input.length===1)return capitalizeFirstSentence?stringToUpper(input):input;
 let capitalize=capitalizeFirstSentence,tag=false,brace=false,comment=false,out='';
 for(let i=0;i<input.length;i++){
  const c=input[i]!,next=i<input.length-1?input[i+1]:undefined;
  if(capitalize&&isLetterOrDigit(c)&&!tag&&!brace&&!comment){out+=charToUpper(c);capitalize=false;}
  else out+=c;
  if(c==='\r'||c==='\n'||c==='.'&&next===' '||c==='!'||c==='?'||c===':')capitalize=true;
  else if(c==='<'&&next!==undefined&&next!=='/')tag=true;
  else if(tag&&c==='>')tag=false;
  else if(c==='('&&next==='*')comment=true;
  else if(comment&&c===')')comment=false;
  else if(c==='{'){brace=true;capitalize=false;}
  else if(brace&&c==='}'){brace=false;capitalize=false;}
 }
 return out;
}

/** English small words left in lower case inside a title
 * (`TitleCaseHelper.IsUppercaseTitleWord`): articles, conjunctions and
 * prepositions, as listed in the game's code. */
const ENGLISH_TITLE_SMALL_WORDS=new Set(('a aboard about above absent across after against along alongside amid amidst among amongst an and around as aslant astride at athwart atop '
 +'barring before behind below beneath beside besides between beyond but by despite down during except failing following for from in inside into like mid minus near next nor '
 +'of off on onto opposite or out outside over past per plus regarding save since so than the through throughout till times to toward towards under underneath unlike until up '
 +'upon via vs. vs when with within without worth yet').split(' '));
const isUppercaseTitleWord=(word:string)=>word.length>1&&!ENGLISH_TITLE_SMALL_WORDS.has(word);
function capitalizeFirstLetterAfterSeparator(s:string,separator:string):string {
 const parts=s.split(separator);
 for(let i=0;i<parts.length;i++){
  const part=parts[i]!;
  if((i===0||i===parts.length-1||isUppercaseTitleWord(part))&&part){
   const at=firstLetterBetweenTags(part);
   parts[i]=(at===0?stringToUpper(part[0]!):part.slice(0,at)+charToUpper(part[at]!))+part.slice(at+1);
  }
 }
 return parts.join(separator);
}
/** `GenText.ToTitleCaseSmart`. */
export function toTitleCaseSmart(s:string):string {
 if(!s)return s;
 return capitalizeFirstLetterAfterSeparator(capitalizeFirstLetterAfterSeparator(capitalizeFirstLetterAfterSeparator(dotNetTrim(mergeMultipleSpaces(s,false)),' '),'-'),' \'');
}

/** The language worker classes this port knows. */
export type LanguageWorkerKind='LanguageWorker_English'|'LanguageWorker_French'|'LanguageWorker_Default';
export const isLanguageWorkerKind=(v:string):v is LanguageWorkerKind=>v==='LanguageWorker_English'||v==='LanguageWorker_French'||v==='LanguageWorker_Default';

// LanguageWorker_English.PostProcessed: "a" before a vowel or "hour" becomes
// "an", "an unique" stays "a unique"; after a space, then after a line break.
const ENGLISH_ARTICLE_REPLACEMENTS:readonly (readonly [string,string])[]=(()=>{
 const pairs:[string,string][]=[];
 for(const start of [' ','\n'])for(const article of ['a','A']){
  for(const next of ['a','e','i','o','u','hour'])pairs.push([`${start}${article} ${next}`,`${start}${article}n ${next}`]);
  pairs.push([`${start}${article}n unique`,`${start}${article} unique`]);
 }
 for(const start of [' ','\n'])for(const article of ['a','A'])for(const next of ['A','E','I','O','U'])pairs.push([`${start}${article} ${next}`,`${start}${article}n ${next}`]);
 return pairs;
})();
function englishPostProcessed(s:string):string {
 if(s.slice(0,2).toLowerCase()==='a '&&s.length>=3){
  const hour=s.slice(2)==='hour';
  if(hour||'aeiou'.includes(s[2]!))s=s.slice(0,1)+'n'+s.slice(1);
  // The game tests the third character again after the first insertion.
  if(hour||'AEIOU'.includes(s[2]!))s=s.slice(0,1)+'n'+s.slice(1);
 }
 if(s.slice(0,10).toLowerCase()==='an unique ')s=s.slice(0,1)+s.slice(2);
 for(const [from,to] of ENGLISH_ARTICLE_REPLACEMENTS)s=s.split(from).join(to);
 return s;
}
// LanguageWorker_French.PostProcessed: elisions and contractions, .NET
// regular expressions with IgnoreCase; `\b` is .NET's Unicode word boundary.
const W=DOTNET_WORD,B=`(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;
const FRENCH_VOWEL_OR_H='aàâäeéèêëiîïoôöuùüûh';
const FRENCH_ELISION_E=new RegExp(`${B}([cdjlmnst]|qu|quoiqu|lorsqu)e ([${FRENCH_VOWEL_OR_H}])`,'giu');
const FRENCH_ELISION_LA=new RegExp(`${B}(l)a ([${FRENCH_VOWEL_OR_H}])`,'giu');
const FRENCH_ELISION_SI=new RegExp(`${B}(s)i (ils?)${B}`,'giu');
const FRENCH_DE_LE=new RegExp(`${B}(d)e l(es?)${B}`,'giu');
const FRENCH_A_LE=new RegExp(`${B}à les?${B}`,'giu');
const FRENCH_A_LE_FORMS:Readonly<Record<string,string>>={'à le':'au','à les':'aux','À le':'Au','À les':'Aux'};
function frenchPostProcessed(s:string):string {
 s=s.replace(FRENCH_ELISION_E,"$1'$2").replace(FRENCH_ELISION_LA,"$1'$2").replace(FRENCH_ELISION_SI,"$1'$2").replace(FRENCH_DE_LE,'$1$2');
 return s.replace(FRENCH_A_LE,m=>FRENCH_A_LE_FORMS[m]??m);
}
/** `LanguageWorker.PostProcessed` of the language. */
export function languagePostProcessed(worker:LanguageWorkerKind,s:string):string {
 const base=mergeMultipleSpaces(s);
 return worker==='LanguageWorker_English'?englishPostProcessed(base):worker==='LanguageWorker_French'?frenchPostProcessed(base):base;
}
/** `GenText.CapitalizeAsTitle` (`LanguageWorker.ToTitleCase`). */
export function languageTitleCase(worker:LanguageWorkerKind,s:string):string {
 return worker==='LanguageWorker_English'?toTitleCaseSmart(s):capitalizeFirst(s);
}
