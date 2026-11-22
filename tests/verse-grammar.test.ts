// Lot 3 of « même planète, même graine »: the game's grammar resolver and
// name generator, ported. Hand-made rule packs with invented words; the
// expected draws are derived by hand from the decompiled algorithm (weights
// p × 100 000 / ((uses + 1) × 1 000), one `Value` per weighted choice unless
// the keyword has a single rule, one `Range` per word-list rule) and replayed
// on a separate `VerseRand` of the same seed.
import {describe,expect,it} from 'vitest';
import {VerseRand} from '../src/sim/verse-rand';
import {GrammarDatabase,grammarResolve,grammarResolveUnsafe,parseGrammarRuleString,grammarFileRule,GrammarUnsupportedError,type GrammarRule,type GrammarLanguage} from '../src/sim/verse-grammar';
import {generateName,generateFactionName,generateSettlementName} from '../src/sim/verse-name-generator';
import {languagePostProcessed,languageTitleCase,capitalizeSentences,linesFromString,toTitleCaseSmart,capitalizeFirst,mergeMultipleSpaces} from '../src/sim/verse-text';

const f=Math.fround;
const rule=(s:string)=>parseGrammarRuleString(s);
const DEFAULT:GrammarLanguage={worker:'LanguageWorker_Default',isDefault:true};
function db(packs:Record<string,{rules:GrammarRule[];untranslated?:GrammarRule[];include?:string[]}>,language=DEFAULT,personNames:{male:string[];female:string[]}|null=null){
 return new GrammarDatabase(Object.entries(packs).map(([defName,p])=>({defName,include:p.include??[],rulePack:{rules:p.rules,untranslatedRules:p.untranslated??p.rules,include:[]}})),language,personNames);
}
/** Hand replay of `TryRandomElementByWeight` (first pass) on known weights. */
function pick(ref:VerseRand,weights:readonly number[]):number {
 let total=0;for(const w of weights)total=f(total+w);
 let t=f(total*ref.value);
 for(let i=0;i<weights.length;i++){if(weights[i]!<=0)continue;t=f(t-weights[i]!);if(t<=0)return i;}
 throw Error('second pass not expected in these tests');
}

describe('rule strings',()=>{
 it('reads the keyword, the parameters and the output as the game does',()=>{
  expect(rule('r_name(p=3,tag=t1,requiredTag=t0,uses=2,priority=1.5,season==winter,count>=2)->[a] b')).toEqual({kind:'string',keyword:'r_name',output:'[a] b',weight:3,priority:1.5,tag:'t1',requiredTag:'t0',usesLimit:2,
   constraints:[{key:'season',value:'winter',type:'=='},{key:'count',value:'2',type:'>='}]});
  expect(rule('a/b->x->y')).toMatchObject({keyword:'a/b',output:'x->y',weight:1});
  expect(rule('w(p=0.4) ->  spaced ')).toMatchObject({keyword:'w',output:'  spaced ',weight:f(.4)});
  // A keyword outside [a-zA-Z0-9_/] does not match: the game keeps a null keyword.
  expect(rule('clé->x')).toMatchObject({keyword:null,output:null});
  expect(rule('no arrow')).toMatchObject({keyword:null});
  expect(()=>rule('x(p=abc)->o')).toThrow();
  expect(rule('x(other=1)->o')).toMatchObject({constraints:null});
 });
});

describe('grammar resolver',()=>{
 it('chooses by weight among a keyword\'s rules and draws one line of a word list',()=>{
  const d=db({Namer:{rules:[rule('r_name->[a] [b]'),rule('a->zol'),rule('a(p=3)->mib'),grammarFileRule('b',['kru','vex','plo'])]}});
  for(const seed of [1,2,3,1234,99999]){
   const random=new VerseRand(seed),ref=new VerseRand(seed);
   // r_name: one rule, no draw. a: weights 100 and 300. b: one rule, then Range(0, 3).
   const a=['zol','mib'][pick(ref,[100,300])],b=['kru','vex','plo'][ref.range(0,3)];
   expect(grammarResolve(d,'r_name',{includes:['Namer']},random)).toBe(`${a![0]!.toUpperCase()}${a!.slice(1)} ${b}`);
   expect(random.state.iterations).toBe(2);
  }
 });
 it('lowers the weight of a rule each time it is used in the same resolution',()=>{
  const d=db({N:{rules:[rule('r->[x][x][x]'),rule('x->o'),rule('x->e')]}});
  const random=new VerseRand(77),ref=new VerseRand(77),uses=[0,0];let expected='';
  for(let k=0;k<3;k++){const i=pick(ref,uses.map(u=>f(100000/f((u+1)*1000))));uses[i]!++;expected+=['o','e'][i];}
  expect(grammarResolve(d,'r',{includes:['N']},random)).toBe(expected[0]!.toUpperCase()+expected.slice(1));
  expect(random.state.iterations).toBe(3);
 });
 it('keeps the highest priority, still drawing when the keyword has several rules',()=>{
  const d=db({N:{rules:[rule('r->[x]'),rule('x(priority=1)->hi'),rule('x->lo')]}});
  const random=new VerseRand(5);
  expect(grammarResolve(d,'r',{includes:['N']},random)).toBe('Hi');expect(random.state.iterations).toBe(1);
 });
 it('marks a rule that cannot be expanded and draws again',()=>{
  const d=db({N:{rules:[rule('r->[x]'),rule('x->[nothing]'),rule('x->ok')]}});
  const seen=new Set<number>();
  for(let seed=0;seed<40&&seen.size<2;seed++){
   const random=new VerseRand(seed),ref=new VerseRand(seed),first=pick(ref,[100,100]);
   // After the dead end, only « ok » keeps a weight but two rules remain: a second Value.
   expect(grammarResolve(d,'r',{includes:['N']},random)).toBe('Ok');
   expect(random.state.iterations).toBe(first===0?2:1);seen.add(first);
  }
  expect(seen.size).toBe(2);
 });
 it('honours tags, required tags and use limits',()=>{
  const d=db({N:{rules:[rule('r->[a] [b]'),rule('a(tag=t1)->x'),rule('b(requiredTag=t1)->y'),rule('b(requiredTag=t2)->z'),rule('u->[once][once]'),rule('once(uses=1)->q')]}});
  const random=new VerseRand(8);
  expect(grammarResolve(d,'r',{includes:['N']},random)).toBe('X y');expect(random.state.iterations).toBe(1);
  // The second [once] has no rule left: the resolution fails.
  expect(grammarResolveUnsafe(d,'u',{includes:['N']},new VerseRand(1))).toEqual({text:'ERR',success:false});
 });
 it('on failure resolves again to log it, then retries with the untranslated rules in a translated game',()=>{
  const translated=[rule('r_name->[a][missing]'),rule('a->x'),rule('a->y')],untranslated=[rule('r_name->[b]'),rule('b->q'),rule('b->z')];
  const french={worker:'LanguageWorker_French',isDefault:false} as const;
  const random=new VerseRand(31),ref=new VerseRand(31);
  pick(ref,[100,100]);pick(ref,[100,100]);// failed resolution, then its logging run
  const expected=['Q','Z'][pick(ref,[100,100])];
  expect(grammarResolve(db({N:{rules:translated,untranslated}},french),'r_name',{includes:['N']},random)).toBe(expected);
  expect(random.state.iterations).toBe(3);
  // In English (the default language) there is no retry: « ERR ».
  const english=new VerseRand(31);
  expect(grammarResolve(db({N:{rules:translated,untranslated}}),'r_name',{includes:['N']},english)).toBe('ERR');expect(english.state.iterations).toBe(2);
  // A rule the game cannot parse makes the resolution throw: retried untranslated.
  const broken=db({N:{rules:[rule('clé->x'),rule('r_name->[b]'),rule('b->ok')],untranslated:[rule('r_name->fine')]}},french);
  expect(grammarResolve(broken,'r_name',{includes:['N']},new VerseRand(1))).toBe('Fine');
 });
 it('collects included packs as a stack, each once, then the global pack',()=>{
  const d=db({
   Root:{rules:[rule('r->[w]'),rule('w->root')],include:['A','B']},
   A:{rules:[rule('w->a')],include:['C']},B:{rules:[rule('w->b')],include:['A']},C:{rules:[rule('w->c')]},
   GlobalUtility:{rules:[rule('w->g')]},
  });
  expect(d.compile(['Root'],null,false).byKeyword.get('w')!.map(i=>(d.compile(['Root'],null,false).rules[i] as {output:string}).output)).toEqual(['root','b','a','c','g']);
  expect(d.rulesPlusIncludes('B',false).map(r=>(r as {output:string}).output)).toEqual(['b','a','c']);
 });
 it('draws 51 first names for a person-name rule, after its gender',()=>{
  const names={male:['zolan','krumo','vexen'],female:['plia']};
  const d=db({N:{rules:[rule('r->[NamePerson] [NamePersonFemale] [Digit]'),{kind:'person',keyword:'NamePerson',gender:'None',tag:null,requiredTag:null,usesLimit:null,constraints:null},
   {kind:'person',keyword:'NamePersonFemale',gender:'Female',tag:null,requiredTag:null,usesLimit:null,constraints:null},{kind:'number',keyword:'Digit',min:0,max:9,weight:1,tag:null,requiredTag:null,usesLimit:null,constraints:null}]}},DEFAULT,names);
  const random=new VerseRand(4),ref=new VerseRand(4);
  const list=ref.value<.5?names.male:names.female;let first='';for(let i=0;i<51;i++)first=list[ref.range(0,list.length)]!;
  let second='';for(let i=0;i<51;i++)second=names.female[ref.range(0,1)]!;
  const digit=ref.rangeInclusive(0,9);
  expect(grammarResolve(d,'r',{includes:['N']},random)).toBe(`${first[0]!.toUpperCase()}${first.slice(1)} ${second} ${digit}`);
  expect(random.state.iterations).toBe(1+51+51+1);
  expect(()=>grammarResolve(db({N:{rules:[rule('r->[p]'),{kind:'person',keyword:'p',gender:'Male',tag:null,requiredTag:null,usesLimit:null,constraints:null}]}}),'r',{includes:['N']},new VerseRand(1))).toThrow(GrammarUnsupportedError);
 });
 it('post-processes like the game: language, sentence capitals, spaces before punctuation, trim',()=>{
  const french={worker:'LanguageWorker_French',isDefault:false} as const;
  const d=db({N:{rules:[rule('r-> de le arbre ,  à les cimes de les monts. le écho'),rule('e->a apple a hour , an unique')]}},french);
  expect(grammarResolve(d,'r',{includes:['N']},new VerseRand(1))).toBe("De l'arbre, aux cimes des monts. L'écho");
  const e=db({N:{rules:[rule('e->a apple a hour , an unique')]}});
  expect(grammarResolve(new GrammarDatabase([{defName:'N',include:[],rulePack:{rules:[rule('e->a apple, a hour ; an unique; a Ox')],untranslatedRules:[],include:[]}}],{worker:'LanguageWorker_English',isDefault:true}),'e',{includes:['N']},new VerseRand(1))).toBe('An apple, an hour ; a unique; an Ox');
  expect(grammarResolve(e,'e',{includes:['N']},new VerseRand(1))).toBe('A apple a hour, an unique');
 });
});

describe('text helpers',()=>{
 it('reads word lists, capitalizes and merges spaces as GenText',()=>{
  expect(linesFromString('// tête\r\n  zol  \n\nkru // fin\r\n//\nvex//x')).toEqual(['zol','kru ','vex']);
  expect(capitalizeSentences('zol. kru! vex: plo? (*x) {y} <b>z</b>')).toBe('Zol. Kru! Vex: Plo? (*x) {y} <b>z</b>');
  expect(capitalizeFirst('élan')).toBe('Élan');expect(capitalizeFirst('<b>zol</b>')).toBe('<b>Zol</b>');expect(capitalizeFirst('Zol')).toBe('Zol');
  expect(mergeMultipleSpaces('a  b   c')).toBe('a b c');expect(mergeMultipleSpaces('  a  b',true)).toBe('  a b');
  expect(toTitleCaseSmart('the  north of  the zol-kru vex')).toBe('The North of the Zol-Kru Vex');
  expect(languageTitleCase('LanguageWorker_French','le cercle du nord')).toBe('Le cercle du nord');
  expect(languagePostProcessed('LanguageWorker_French','si il veut, je ai, la île, que il')).toBe("s'il veut, j'ai, l'île, qu'il");
  expect(languagePostProcessed('LanguageWorker_French','À le bord, à Le bord')).toBe('Au bord, à Le bord');
 });
});

describe('name generator',()=>{
 const words=['kru','vex','plo','zol'];
 const d=db({Namer:{rules:[rule('r_name->[w]'),grammarFileRule('w',words)]},Long:{rules:[rule('r_name->[w]'),grammarFileRule('w',['averyveryverylongzolname','ok'])]}});
 it('resolves again until the validator accepts, capitalized as a title',()=>{
  const random=new VerseRand(11),ref=new VerseRand(11);let n=0,expected='';
  do{expected=words[ref.range(0,4)]!;n++;}while(expected==='kru'||expected==='vex');
  expect(generateName(d,'Namer',random,{validator:x=>x!=='Kru'&&x!=='Vex'})).toBe(expected[0]!.toUpperCase()+expected.slice(1));
  expect(random.state.iterations).toBe(n);
 });
 it('appends the round number after five refused names (settlements)',()=>{
  const random=new VerseRand(3),ref=new VerseRand(3);
  for(let i=0;i<5;i++)ref.range(0,4);
  const w=words[ref.range(0,4)]!;
  expect(generateSettlementName(d,'Namer',['Kru','Vex','Plo','Zol'],random)).toBe(`${w[0]!.toUpperCase()}${w.slice(1)} 2`);
  expect(random.state.iterations).toBe(6);
 });
 it('names a faction with ten names, keeping the last one of 20 characters or fewer',()=>{
  for(const seed of [1,2,3,4,5,6]){
   const random=new VerseRand(seed),ref=new VerseRand(seed),drawn:string[]=[];
   for(let i=0;i<10;i++){const x=['averyveryverylongzolname','ok'][ref.range(0,2)]!;drawn.push(x[0]!.toUpperCase()+x.slice(1));}
   const kept=drawn.filter(x=>x.length<=20).at(-1);
   const expected=kept??(()=>{const x=['averyveryverylongzolname','ok'][ref.range(0,2)]!;return x[0]!.toUpperCase()+x.slice(1);})();
   expect(generateFactionName(d,'Long',[],random)).toBe(expected);
   expect(random.state.iterations).toBe(kept?10:11);
  }
  // Every name taken by a visible faction: 150 tries, then the last one.
  const random=new VerseRand(9);generateFactionName(d,'Namer',['Kru','Vex','Plo','Zol'],random);
  expect(random.state.iterations).toBe(10*150);
 });
});
