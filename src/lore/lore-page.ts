import {LORE_CATEGORIES,LORE_ENTRIES} from './lore-registry.ts';
import {installedLoreSources} from './lore-installed.ts';
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
function renderInstalled():void {
  const box=el('section',undefined,'about');
  box.append(el('h2','Jeu installé'),
    el('p','Cette partie montrera l’univers du RimWorld installé chez le joueur : histoires, noms, factions et descriptions lus à l’ouverture dans ses fichiers de définitions et de langue. Rien n’est copié dans le dépôt ni gardé dans une sauvegarde ; sans jeu installé, la partie reste vide.'),
    el('p','Un lot à venir branchera ce lecteur. Il fournira une source (interface InstalledLoreSource de src/lore/lore-installed.ts) : un libellé et une fonction qui lit l’installation et rend des entrées de la même forme que celles d’Elsewhere, d’origine « installed », pour comparer les deux univers et partir de l’un ou de l’autre.'));
  content.append(box);
  const sources=installedLoreSources();
  if(!sources.length){content.append(el('p','Aucun lecteur du jeu installé n’est encore branché.','empty'));return;}
  for(const source of sources){
    const button=el('button',`Lire : ${source.label}`),out=el('div');
    button.onclick=async()=>{button.disabled=true;out.replaceChildren(el('p','Lecture…','empty'));
      try{const entries=filterLoreEntries(await source.load(),{query:search.value});out.replaceChildren(...entries.map(entryCard));if(!entries.length)out.append(el('p','Aucune entrée.','empty'));}
      catch(error){out.replaceChildren(el('p',`Lecture impossible : ${error instanceof Error?error.message:String(error)}`,'empty'));}
      finally{button.disabled=false;}};
    content.append(button,out);
  }
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
