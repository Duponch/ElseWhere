import {NATIVE_INK} from './native-ui-scale';
/** Semantic ink only. These spans are painted on the page's existing canvas;
 * they never create a DOM node, geometry, material, texture or frame callback. */
export type NativeTextKind='plain'|'person'|'item'|'action'|'value'|'warning';
export interface NativeTextEntity {text:string;kind:Exclude<NativeTextKind,'plain'>}
export interface NativeTextSpan {text:string;kind:NativeTextKind}
export interface NativeRichLine {
  spans:NativeTextSpan[];width:number;breakAfter:'wrap'|'newline'|'end';
  /** Present only for a source paragraph break, preserving even CRLF verbatim. */
  separator?:string;
}
export interface NativeTextLexicon {
  readonly pattern:RegExp;
  readonly entities:ReadonlyMap<string,Exclude<NativeTextKind,'plain'>>;
}
export const NATIVE_TEXT_STYLES:Readonly<Record<NativeTextKind,{color:string;bold:boolean}>>=Object.freeze({
  plain:{get color(){return NATIVE_INK.text;},bold:false},person:{get color(){return NATIVE_INK.richPerson;},bold:true},
  item:{get color(){return NATIVE_INK.richItem;},bold:true},action:{get color(){return NATIVE_INK.richAction;},bold:true},
  value:{get color(){return NATIVE_INK.richValue;},bold:true},warning:{get color(){return NATIVE_INK.richWarning;},bold:true},
});

const actions=[
  'a cuisiné','a mangé','a insulté','a soigné','a construit','a fabriqué','a récolté','a abattu','a miné',
  's’allonge','s\'allonge','se repose','se détendre ensemble','commence','termine','porte','transporte',
  'Bavardage','Mobiliser','Démobiliser','Construire','Miner','Récolter','Abattre','Transporter',
  'Entraîner','Apprivoiser','Chasser','Rechercher','Soigner','Installer','Démonter','Ramasser',
  'Lancer la recherche','Suspendre la recherche','Effacer les ordres','Appliquer','Sauvegarder','Exporter',
] as const;
const warnings=[
  'Ordre annulé','Valeurs manquantes','Indisponible','Impossible','Refusé','Refusée',
  'Introuvable','Bloqué','Bloquée','Inaccessible','Incapable','Mort','Morte','Décédé','Décédée',
] as const;
const canonical=(text:string)=>text.trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr-FR');
const escaped=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ +/g,'[ \\t\\u00a0\\u202f]+');
const boundary='[\\p{L}\\p{M}\\p{N}_]';
const before=`(?<!${boundary})`,after=`(?!${boundary})`;
const phrase=(values:Iterable<string>)=>[...values].sort((a,b)=>b.length-a.length||a.localeCompare(b,'fr')).map(escaped).join('|');
const number='[+−-]?(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?';
const units='(?:%|°[ \\t]*C|°|ans?|années?|jours?|j|heures?|h|min|secondes?|s|kg|g|m|PV|argent|ticks?)';
const clock='\\d{1,2}[h:]\\d{2}';
const values=`(?<![\\p{L}\\p{M}\\p{N}_+−-])(?:${clock}|${number}(?:[ \\t\\u00a0\\u202f]*${units})?|∞)${after}`;
const compiled=new WeakMap<readonly NativeTextEntity[],NativeTextLexicon>();
const emptyEntities:readonly NativeTextEntity[]=Object.freeze([]);

/** Compile once per stable page entity array. Capitalisation never implies a
 * person's name: only an explicit entity may supply that meaning. */
export function createNativeTextLexicon(entities:readonly NativeTextEntity[]=emptyEntities):NativeTextLexicon {
  const known=compiled.get(entities);if(known)return known;
  const map=new Map<string,Exclude<NativeTextKind,'plain'>>();
  // An actual person's name wins a collision with an ordinary item label.
  for(const entity of entities){const key=canonical(entity.text);if(!key||key.length>160)continue;const previous=map.get(key);if(!previous||entity.kind==='person')map.set(key,entity.kind);}
  const source=[map.size?`${before}(?<entity>${phrase(map.keys())})${after}`:'',
    `${before}(?<warning>${phrase(warnings)})${after}`,
    `${before}(?<action>${phrase(actions)})${after}`,
    `(?<value>${values})`,
  ].filter(Boolean).join('|');
  const result:NativeTextLexicon={pattern:new RegExp(source,'giu'),entities:map};compiled.set(entities,result);return result;
}
export const DEFAULT_NATIVE_TEXT_LEXICON=createNativeTextLexicon();

function appendSpan(spans:NativeTextSpan[],span:NativeTextSpan):void {
  if(!span.text)return;const last=spans.at(-1);if(last?.kind===span.kind)last.text+=span.text;else spans.push({...span});
}
/** Keeps the original characters, punctuation, spacing and paragraph breaks. */
export function tokenizeNativeText(text:string,lexicon:NativeTextLexicon=DEFAULT_NATIVE_TEXT_LEXICON):NativeTextSpan[] {
  const spans:NativeTextSpan[]=[];let cursor=0;lexicon.pattern.lastIndex=0;
  for(const match of text.matchAll(lexicon.pattern)){
    const index=match.index!;if(index>cursor)appendSpan(spans,{text:text.slice(cursor,index),kind:'plain'});
    const kind:NativeTextKind=match.groups?.entity?lexicon.entities.get(canonical(match[0]))??'plain':match.groups?.warning?'warning':match.groups?.action?'action':'value';
    appendSpan(spans,{text:match[0],kind});cursor=index+match[0].length;
  }
  if(cursor<text.length)appendSpan(spans,{text:text.slice(cursor),kind:'plain'});
  return spans;
}

type RichMeasure=(text:string,bold:boolean)=>number;
interface Unit {spans:NativeTextSpan[];kind:'word'|'space'|'newline';separator?:string}
const spanWidth=(span:NativeTextSpan,measure:RichMeasure)=>measure(span.text,NATIVE_TEXT_STYLES[span.kind].bold);
const measured=(spans:readonly NativeTextSpan[],measure:RichMeasure)=>spans.reduce((sum,span)=>sum+spanWidth(span,measure),0);

/** Wraps styled runs together, so a comma after a name is not orphaned because
 * the two parts use different ink. Long tokens split without losing letters. */
export function wrapNativeRichText(spans:readonly NativeTextSpan[],width:number,measure:RichMeasure):NativeRichLine[] {
  const limit=Math.max(1,width),units:Unit[]=[];
  for(const span of spans)for(const text of span.text.match(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu)??[]){
    const kind:Unit['kind']=/^[\r\n]/.test(text)?'newline':/^\s+$/u.test(text)?'space':'word',last=units.at(-1);
    if(kind==='newline')units.push({spans:[],kind,separator:text});
    else if(last?.kind===kind)appendSpan(last.spans,{text,kind:span.kind});
    else units.push({spans:[{text,kind:span.kind}],kind});
  }
  const lines:NativeRichLine[]=[];let current:NativeTextSpan[]=[],lineWidth=0;
  const emit=(breakAfter:NativeRichLine['breakAfter'],separator?:string)=>{lines.push({spans:current,width:lineWidth,breakAfter,...(separator?{separator}:{})});current=[];lineWidth=0;};
  const append=(span:NativeTextSpan)=>{const last=current.at(-1);if(last?.kind===span.kind){const old=spanWidth(last,measure);last.text+=span.text;lineWidth+=spanWidth(last,measure)-old;}else{current.push({...span});lineWidth+=spanWidth(span,measure);}};
  const joinedWidth=(next:readonly NativeTextSpan[])=>{const last=current.at(-1),first=next[0];let value=lineWidth+measured(next,measure);if(last&&first&&last.kind===first.kind)value+=measure(last.text+first.text,NATIVE_TEXT_STYLES[last.kind].bold)-spanWidth(last,measure)-spanWidth(first,measure);return value;};
  for(const unit of units){
    if(unit.kind==='newline'){emit('newline',unit.separator);continue;}
    if(unit.kind==='word'&&current.length&&joinedWidth(unit.spans)>limit)emit('wrap');
    if(joinedWidth(unit.spans)<=limit){for(const span of unit.spans)append(span);continue;}
    // This also preserves excess spaces instead of silently trimming content.
    for(const span of unit.spans)for(const letter of Array.from(span.text)){
      const part={text:letter,kind:span.kind};if(current.length&&joinedWidth([part])>limit)emit('wrap');append(part);
    }
  }
  emit('end');return lines;
}
