import {LORE_CATEGORIES,LORE_ENTRIES} from './lore-registry.ts';
import {browserRimWorldTexts,type RimWorldTextsState} from './rimworld-texts.ts';
import {gameLoreTexts} from './lore-text.ts';
import {gameLoreCoverage} from './game-lore-coverage.ts';
import {buildLoreExport,filterLoreEntries,loreCategoryCounts,loreExportFileName,loreTextCount} from './lore-view.ts';
import type {LoreCategoryId,LoreCategoryInfo,LoreEntry} from './lore-types.ts';

/** Developer page `lore.html`: every lore text of Elsewhere, by category, with
 * search and a JSON export. Strings are always set with textContent. */
type View=LoreCategoryId|'all'|'installed';
const doc=document,nav=doc.querySelector<HTMLElement>('#categories')!,content=doc.querySelector<HTMLElement>('#content')!;
const search=doc.querySelector<HTMLInputElement>('#search')!,stats=doc.querySelector<HTMLElement>('#stats')!;
const isView=(value:string):value is View=>value==='all'||value==='installed'||LORE_CATEGORIES.some(c=>c.id===value);
let view:View=isView(location.hash.slice(1))?location.hash.slice(1) as View:'all';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K] {
  const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;
}
const FIELD_LABELS:readonly [keyof LoreEntry,string][]=[['shortTitle','Titre court'],['titleFemale','Titre au féminin'],['shortTitleFemale','Titre court au féminin'],['description','Description']];

function entryCard(entry:LoreEntry):HTMLElement {
  const card=el('article',undefined,'entry');card.dataset.id=entry.id;
  card.append(el('h3',entry.title??entry.key));
  const meta=el('div',undefined,'meta'),id=el('code',entry.id);meta.append(id);
  if(entry.reference)meta.append(el('span',entry.reference));
  meta.append(el('span',`${entry.source.file} · ${entry.source.symbol}`));card.append(meta);
  const rows=FIELD_LABELS.filter(([field])=>typeof entry[field]==='string');
  if(rows.length){const list=el('dl');for(const [field,label] of rows)list.append(el('dt',label),el('dd',entry[field] as string));card.append(list);}
  if(entry.words){const words=el('div',undefined,'words'+(entry.words.some(w=>w.length>40)?' long':''));for(const word of entry.words)words.append(el('span',word));card.append(words);}
  if(entry.note)card.append(el('div',entry.note,'note'));
  return card;
}
function aboutBox(category:LoreCategoryInfo,count:number):HTMLElement {
  const box=el('section',undefined,'about');box.append(el('h2',`${category.label} · ${count}`),el('p',category.description));
  if(category.pending.length){const p=el('p');p.append(el('strong','Pas encore lu ici : '));box.append(p);const list=el('ul');for(const line of category.pending)list.append(el('li',line));box.append(list);}
  return box;
}
function renderCategory(category:LoreCategoryInfo,entries:readonly LoreEntry[]):void {
  const own=entries.filter(e=>e.category===category.id);
  if(view==='all'&&!own.length)return;
  content.append(aboutBox(category,own.length));
  for(const group of category.groups){
    const inGroup=own.filter(e=>e.group===group.id);if(!inGroup.length)continue;
    content.append(el('h2',`${group.label} (${inGroup.length})`));
    for(const entry of inGroup)content.append(entryCard(entry));
  }
  if(!own.length)content.append(el('p','Aucune entrée ne correspond à la recherche.','empty'));
}
// « Jeu installé »: the texts of the player's own RimWorld, read from the
// folder this browser keeps (same controller as Options in the game), side by
// side with Elsewhere's. Nothing read is stored or sent.
const rimWorldTexts=browserRimWorldTexts(()=>new Worker(new URL('./game-lore.worker.ts',import.meta.url),{type:'module'}));
rimWorldTexts.subscribe(()=>{if(view==='installed')render();});
void rimWorldTexts.restore();
const INSTALLED_FIELDS:readonly [keyof LoreEntry,string][]=[['title','Titre'],['shortTitle','Titre court'],['titleFemale','Au féminin'],['shortTitleFemale','Court, au féminin'],['description','Description']];
function textColumn(heading:string,entry:LoreEntry|undefined):HTMLElement {
  const column=el('div',undefined,'side');column.append(el('h4',heading));
  if(!entry){column.append(el('p','Aucun texte.','empty'));return column;}
  const list=el('dl');
  for(const [field,label] of INSTALLED_FIELDS){const value=entry[field];if(typeof value==='string')list.append(el('dt',label),el('dd',value));}
  column.append(list);return column;
}
function pairCard(own:LoreEntry|undefined,game:LoreEntry):HTMLElement {
  const card=el('article',undefined,'entry');card.dataset.id=game.id;
  card.append(el('h3',own?.title??game.title??game.key));
  const meta=el('div',undefined,'meta');meta.append(el('code',game.id));if(game.reference)meta.append(el('span',game.reference));meta.append(el('span',game.source.file));card.append(meta);
  const pair=el('div',undefined,'pair');pair.append(textColumn('Elsewhere',own),textColumn('Jeu installé',game));card.append(pair);
  return card;
}
function installedControls(state:RimWorldTextsState):HTMLElement {
  const box=el('div',undefined,'top');
  const choose=el('button',state.folder?'Changer de dossier…':'Choisir le dossier de RimWorld…');choose.disabled=state.status==='unsupported'||state.status==='reading';choose.onclick=()=>void rimWorldTexts.choose();box.append(choose);
  if(state.status==='permission'){const allow=el('button','Autoriser la lecture');allow.onclick=()=>void rimWorldTexts.allow();box.append(allow);}
  if(state.folder){const forget=el('button','Oublier ce dossier');forget.onclick=()=>void rimWorldTexts.forget();box.append(forget);}
  if(state.languages.length){
    const select=el('select');select.setAttribute('aria-label','Langue des textes');select.disabled=state.status==='reading';
    for(const language of state.languages){const option=el('option',language);option.value=language;option.selected=language===state.language;select.append(option);}
    select.onchange=()=>void rimWorldTexts.setLanguage(select.value);box.append(select);
  }
  return box;
}
function renderInstalled():void {
  const state=rimWorldTexts.state(),texts=gameLoreTexts();
  const box=el('section',undefined,'about');
  box.append(el('h2','Jeu installé'),
    el('p','Les textes du RimWorld installé chez le joueur (histoires, traits, factions, noms et descriptions des choses), lus à l’ouverture dans ses fichiers de définitions et de langue, à côté de ceux d’Elsewhere. Rien n’est copié dans le dépôt, envoyé ni gardé dans une sauvegarde : ce navigateur retient seulement le dossier choisi, et le jeu montre ces textes à la place des siens quand ils sont lus (Options, « Textes de RimWorld »).'),
    installedControls(state),el('p',state.message,'empty'));
  content.append(box);
  if(!texts)return;
  const own=new Map(LORE_ENTRIES.map(entry=>[entry.id,entry])),coverage=gameLoreCoverage(LORE_CATEGORIES,LORE_ENTRIES,texts.entries);
  const report=el('section',undefined,'about');report.append(el('h2',`Correspondances · ${texts.label}`),el('p',`${coverage.matched} entrées sur ${coverage.total} ont un texte du jeu ; les autres gardent celui d’Elsewhere.`));
  const list=el('ul');
  for(const group of coverage.groups)list.append(el('li',`${group.label} : ${group.matched} / ${group.total}${group.reason?` — ${group.reason}`:''}`));
  if(coverage.extra.length)list.append(el('li',`Sans entrée dans le registre d’Elsewhere : ${coverage.extra.length} (titres de chef de faction, milieux et bâtiments qu’Elsewhere ne nomme pas dans le registre).`));
  report.append(list);content.append(report);
  const query=search.value,matching=filterLoreEntries([...texts.entries.values()],{query});
  for(const category of LORE_CATEGORIES){
    const inCategory=matching.filter(entry=>entry.category===category.id);if(!inCategory.length)continue;
    content.append(el('h2',`${category.label} (${inCategory.length})`));
    for(const entry of inCategory)content.append(pairCard(own.get(entry.id),entry));
  }
  if(!matching.length)content.append(el('p','Aucune entrée ne correspond à la recherche.','empty'));
}
function navButton(target:View,label:string,count?:number):HTMLButtonElement {
  const button=el('button');button.append(el('span',label));if(count!==undefined)button.append(el('span',String(count),'count'));
  button.setAttribute('aria-pressed',String(view===target));button.onclick=()=>{view=target;history.replaceState(null,'',`#${target}`);render();};
  return button;
}
function render():void {
  const query=search.value,matching=filterLoreEntries(LORE_ENTRIES,{query}),counts=loreCategoryCounts(matching);
  nav.replaceChildren(navButton('all','Tout',matching.length),...LORE_CATEGORIES.map(c=>navButton(c.id,c.label,counts[c.id])),el('hr'),navButton('installed','Jeu installé'));
  stats.textContent=query.trim()?`${matching.length} entrées sur ${LORE_ENTRIES.length}`:`${LORE_ENTRIES.length} entrées · ${loreTextCount(LORE_ENTRIES)} textes`;
  content.replaceChildren();
  if(view==='installed')return renderInstalled();
  for(const category of LORE_CATEGORIES)if(view==='all'||view===category.id)renderCategory(category,matching);
  if(!content.children.length)content.append(el('p','Aucune entrée ne correspond à la recherche.','empty'));
}
doc.querySelector<HTMLButtonElement>('#export')!.onclick=()=>{
  const now=new Date(),blob=new Blob([JSON.stringify(buildLoreExport(LORE_CATEGORIES,LORE_ENTRIES,now),null,2)+'\n'],{type:'application/json'});
  const link=el('a'),url=URL.createObjectURL(blob);link.href=url;link.download=loreExportFileName(now);doc.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
search.oninput=render;
addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(isView(target)&&target!==view){view=target;render();}});
render();
