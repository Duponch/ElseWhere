import type {NativePage,NativeRow,NativeControl} from './native-contract';
import type {SavedColony} from '../ui/game-session';
import {NAMED_SAVE_KEYS,isNamedSaveKey,isManagedSaveKey,saveLabel} from '../ui/save-slots';
import {NATIVE_MESSAGE} from './native-dialog-metrics';
import {NATIVE_FILE_LIST} from './native-front-metrics';

export interface NativeSaveManagerOptions {
  readSaves:()=>readonly SavedColony[];
  refresh:()=>Promise<void>;
  save:()=>Promise<void>;
  saveNamed:(label:string,key?:string,revision?:string)=>Promise<void>;
  deleteSave:(key:string,revision?:string)=>Promise<void>;
  load:(key:string)=>Promise<void>;
  exportSave:()=>Promise<void>;
  show:(page:NativePage)=>void;
  close:()=>void;
  blocked:()=>boolean;
}
export interface NativeSaveManager {
  open():Promise<void>;
  dispose():void;
}
type Confirmation={action:'overwrite'|'delete';entry:SavedColony};
const kindLabels:Readonly<Record<SavedColony['kind'],string>>={
  manual:'Sauvegarde manuelle',recovery:'Colonie précédente',named:'Sauvegarde nommée',auto:'Copie automatique',
};
const shortKinds:Readonly<Record<SavedColony['kind'],string>>={manual:'Manuelle',recovery:'Précédente',named:'Nommée',auto:'Automatique'};
const message=(cause:unknown):string=>cause instanceof Error?cause.message:String(cause);
const same=(a:SavedColony,b:SavedColony):boolean=>a.key===b.key&&a.label===b.label&&a.detail===b.detail&&a.kind===b.kind&&a.savedAt===b.savedAt&&a.revision===b.revision;
const metadata=(entry:SavedColony):string=>[kindLabels[entry.kind],entry.savedAt===undefined?'':new Date(entry.savedAt).toLocaleString('fr-FR')].filter(Boolean).join(' · ');
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');

/** Native control data only. All capture, storage, compare-and-set, replacement
 * recovery and strict world validation remain in the supplied GameSession flows. */
export function createNativeSaveManager(options:NativeSaveManagerOptions):NativeSaveManager {
  let entries:SavedColony[]=[],selectedKey:string|undefined,nameDraft='',search='';
  let confirmation:Confirmation|undefined;
  let opened=false,disposed=false,pending=false,listingAvailable=false;
  let generation=0,status='',statusIsError=false;

  const selected=():SavedColony|undefined=>entries.find(entry=>entry.key===selectedKey);
  const unavailable=():boolean=>pending||options.blocked();
  const alive=(token:number):boolean=>!disposed&&opened&&token===generation;
  const namedCount=():number=>new Set(entries.filter(entry=>isNamedSaveKey(entry.key)).map(entry=>entry.key)).size;
  const feedback=(text:string,error=false):void=>{status=text;statusIsError=error;};

  function close():void {
    if(disposed||pending||!opened)return;
    opened=false;generation++;confirmation=undefined;options.close();
  }
  function control(id:string,label:string,action:()=>void|Promise<void>,disabled=false,hint?:string,active=false):NativeControl {
    const token=generation,dialog=confirmation;
    return {id,label,disabled,active,hint,onActivate:async()=>{
      if(!alive(token)||disabled||confirmation!==dialog)return;
      try {await action();}
      catch(cause){if(alive(token)){feedback(message(cause),true);paint();}}
    }};
  }

  /** Copies metadata, retaining the actual opaque revision string by value. */
  function read():void {
    const incoming=options.readSaves(),keys=new Set<string>();
    const next=incoming.map(entry=>{
      if(!entry||typeof entry.key!=='string'||!entry.key.length||keys.has(entry.key)||typeof entry.label!=='string'||typeof entry.detail!=='string'||!Object.hasOwn(kindLabels,entry.kind))
        throw Error('La liste des sauvegardes est illisible. Actualisez-la avant de choisir un emplacement.');
      keys.add(entry.key);return {...entry};
    });
    entries=next;listingAvailable=true;
    if(selectedKey!==undefined&&!next.some(entry=>entry.key===selectedKey))selectedKey=undefined;
    if(confirmation&&!next.some(entry=>same(entry,confirmation!.entry))){
      confirmation=undefined;
      feedback('Cette sauvegarde a changé. Sélectionnez-la à nouveau avant de confirmer.',true);
    }
  }
  function readOrReport():void {
    try {read();}
    catch(cause){entries=[];listingAvailable=false;selectedKey=undefined;confirmation=undefined;feedback(`Impossible de lire les sauvegardes : ${message(cause)}`,true);}
  }

  function assertCurrent(captured:SavedColony,needsRevision:boolean):SavedColony {
    read();
    const current=entries.find(entry=>entry.key===captured.key);
    if(!current||!same(current,captured)){
      confirmation=undefined;
      throw Error('Cette sauvegarde a changé ou disparu. Sélectionnez-la à nouveau avant de confirmer.');
    }
    if(needsRevision&&typeof captured.revision!=='string')
      throw Error('La révision de cette copie est indisponible. Actualisez la liste avant de la modifier.');
    return current;
  }

  function paint():void {
    if(!opened||disposed)return;
    // Root may update its cached repository while this native page is open.
    // Re-reading metadata never captures or modifies the active World.
    readOrReport();
    const locked=unavailable(),target=selected(),token=generation;
    if(confirmation){
      const dialog=confirmation,captured=dialog.entry,overwrite=dialog.action==='overwrite';
      options.show({
        id:'native-saves-confirm',title:overwrite?'Remplacer cette sauvegarde ?':'Supprimer cette sauvegarde ?',
        modal:true,closable:!pending,layout:'message',width:NATIVE_MESSAGE.width,height:NATIVE_MESSAGE.height,
        rows:[
          {id:'native-save-confirm-target',label:captured.label,value:metadata(captured),detail:captured.detail},
          {id:'native-save-confirm-consequence',label:overwrite?'La partie actuelle remplacera le contenu de cet emplacement. Le contenu précédent sera perdu.':'Cette copie sera supprimée définitivement.',detail:overwrite?'Le nom de cet emplacement reste celui affiché. Le champ « Nouvelle sauvegarde » ne renomme pas une copie existante.':'Les autres sauvegardes et la partie actuelle sont conservées.'},
          ...(status?[{id:'native-save-confirm-feedback',label:status,detail:statusIsError?'La modification n’est pas confirmée.':undefined}]:[]),
        ],
        actions:[
          control('native-save-confirm-cancel','Annuler',()=>{if(unavailable())return;confirmation=undefined;feedback('');paint();},locked),
          control('native-save-confirm-apply',overwrite?'Remplacer par la partie actuelle':'Supprimer cette copie',()=>confirmChange(dialog),locked),
        ],
        onClose:()=>{if(alive(token)&&!pending&&confirmation===dialog){confirmation=undefined;feedback('');paint();}},closeOwnsNavigation:true,
      });
      return;
    }

    const count=namedCount(),rows:NativeRow[]=[],renderedSearch=search,query=fold(search.trim());
    const visible=entries.filter(entry=>!query||fold([entry.label,metadata(entry),entry.detail].join(' ')).includes(query));
    if(status)rows.push({id:'native-saves-feedback',label:status,region:'navigation',detail:statusIsError?'Consultez la liste et réessayez lorsque la situation est résolue.':undefined});
    if(options.blocked()&&!pending)rows.push({id:'native-saves-blocked',label:'Une opération de partie est en cours. Les commandes de sauvegarde sont momentanément indisponibles.',region:'navigation'});
    rows.push({id:'native-saves-current',label:'Partie actuelle',region:'navigation',controls:[
      control('native-save-current','Sauvegarder',()=>run(options.save,'Sauvegarde de la partie actuelle…','Partie actuelle sauvegardée.'),locked),
      control('native-save-export','Exporter',()=>run(options.exportSave,'Préparation de l’export…','Export de la partie actuelle préparé.',{refresh:false}),locked),
      control('native-save-refresh','Actualiser la liste',refreshList,pending),
    ]});
    rows.push({id:'native-save-search',label:'Rechercher une copie',region:'navigation',input:{value:search,maxLength:160,onCommit:value=>{
      if(!alive(token)||pending||confirmation)return;search=value;selectedKey=undefined;paint();
    }}},{id:'native-save-named-slots',label:'Emplacements nommés',region:'navigation',value:`${count} / ${NAMED_SAVE_KEYS.length} · ${visible.length} / ${entries.length} copies affichées`,detail:count>=NAMED_SAVE_KEYS.length?'Les douze emplacements sont occupés. Choisissez explicitement une copie à remplacer ou supprimer pour libérer une place.':undefined});
    if(!visible.length)rows.push({id:'native-saves-empty',region:'catalogue',label:!listingAvailable?'La liste est indisponible. Actualisez-la avant de choisir une copie.':entries.length?'Aucune copie ne correspond à la recherche.':'Aucune sauvegarde disponible.'});
    for(const [index,entry] of visible.entries())rows.push({id:`native-save-slot-${entry.key}`,label:entry.label,region:'catalogue',fileEntry:{manage:true,index,date:entry.savedAt===undefined?'—':new Date(entry.savedAt).toLocaleDateString('fr-FR'),kind:shortKinds[entry.kind]},hint:[entry.label,metadata(entry),entry.detail].join('\n'),controls:[
      control(`native-save-load-${entry.key}`,'Charger',()=>{if(search===renderedSearch)return loadEntry(entry);},locked,[`Charger « ${entry.label} »`,metadata(entry),entry.detail].join('\n')),
      {...control(`native-save-select-${entry.key}`,'Gérer cette copie',()=>{
        if(unavailable()||confirmation||search!==renderedSearch)return;
        read();const current=entries.find(candidate=>candidate.key===entry.key);if(!current||!same(current,entry))throw Error('Cette copie a changé ou disparu. Choisissez de nouveau une copie.');
        selectedKey=entry.key;feedback('');paint();
      },locked,'Afficher les actions de remplacement ou de suppression de cette copie.',selectedKey===entry.key),presentation:'icon',icon:'settings'},
    ]});
    if(target)rows.push({id:'native-save-selected',region:'details',label:`Sélection : ${target.label}`,value:metadata(target),detail:target.detail,controls:[
      control('native-save-overwrite','Remplacer par la partie actuelle',()=>ask('overwrite',target),locked||!isNamedSaveKey(target.key)||target.kind!=='named'||typeof target.revision!=='string',target.kind==='named'?undefined:'Seul un emplacement nommé peut être remplacé ici.'),
      control('native-save-delete','Supprimer cette copie',()=>ask('delete',target),locked||!isManagedSaveKey(target.key)||typeof target.revision!=='string',isManagedSaveKey(target.key)?undefined:'La sauvegarde manuelle et la colonie précédente sont préservées.'),
    ]});
    rows.push({id:'native-save-name',label:'Nouvelle sauvegarde nommée',region:'toolbar',hint:'1 à 64 caractères. Créer utilise un emplacement libre et conserve les copies existantes.',input:{value:nameDraft,placeholder:'Nom de la nouvelle sauvegarde',maxLength:64,onCommit:value=>{
      if(!alive(token)||unavailable()||confirmation)return;
      nameDraft=value;feedback('');paint();
    }},controls:[control('native-save-create','Créer',createNamed,locked||!listingAvailable||count>=NAMED_SAVE_KEYS.length,'Créer une nouvelle copie sans remplacer les autres sauvegardes.')]});
    options.show({id:'native-saves',title:'Sauvegardes',modal:true,closable:!pending,layout:'files',width:NATIVE_FILE_LIST.width,height:NATIVE_FILE_LIST.height,contentKey:`managed-saves-${search}`,detailsKey:target?.key??'',rows,actions:[control('native-saves-close','Retour',close,pending)],onClose:()=>{if(alive(token)&&!confirmation)close();},closeOwnsNavigation:true});
  }

  async function run(operation:()=>Promise<void>,pendingText:string,successText:string,settings:{refresh?:boolean;after?:()=>void;closeAfter?:boolean}={}):Promise<void> {
    if(disposed||!opened||unavailable())return;
    const token=generation;pending=true;confirmation=undefined;feedback(pendingText);paint();
    let succeeded=false;
    try {
      await operation();succeeded=true;
      if(!alive(token))return;
      settings.after?.();feedback(successText);
      if(settings.refresh!==false){
        try {await options.refresh();if(alive(token))read();}
        catch(cause){if(alive(token))feedback(`${successText} La liste ne peut pas être actualisée : ${message(cause)}`,true);}
      }
    }catch(cause){if(alive(token))feedback(`Échec : ${message(cause)}`,true);}
    finally {
      if(alive(token)){
        pending=false;
        if(succeeded&&settings.closeAfter)close();else paint();
      }
    }
  }

  async function refreshList():Promise<void> {
    if(disposed||!opened||pending)return;
    const token=generation;pending=true;feedback('Actualisation de la liste…');paint();
    try {await options.refresh();if(alive(token)){read();feedback('Liste des sauvegardes actualisée.');}}
    catch(cause){if(alive(token)){listingAvailable=false;confirmation=undefined;feedback(`Impossible d’actualiser les sauvegardes : ${message(cause)}`,true);}}
    finally {if(alive(token)){pending=false;paint();}}
  }

  async function createNamed():Promise<void> {
    if(unavailable()||confirmation||!listingAvailable)return;
    const label=saveLabel(nameDraft);
    // No key is passed: only GameSession may choose one of its twelve free slots.
    await run(async()=>{await options.refresh();read();if(namedCount()>=NAMED_SAVE_KEYS.length)throw Error('Les douze emplacements nommés sont occupés. Choisissez explicitement une copie à remplacer ou supprimer.');await options.saveNamed(label);},`Création de « ${label} »…`,`Sauvegarde « ${label} » créée.`,{after:()=>{nameDraft='';}});
  }

  async function ask(action:Confirmation['action'],captured:SavedColony):Promise<void> {
    if(unavailable()||confirmation)return;
    const chosen=selected();if(!chosen||!same(chosen,captured))throw Error('La sélection a changé. Choisissez à nouveau cette copie.');
    const token=generation;
    if(action==='overwrite'&&(!isNamedSaveKey(captured.key)||captured.kind!=='named'))throw Error('Choisissez une sauvegarde nommée à remplacer.');
    if(action==='delete'&&!isManagedSaveKey(captured.key))throw Error('La sauvegarde manuelle et la colonie précédente sont préservées.');
    pending=true;feedback('Vérification de la copie sélectionnée…');paint();
    try {
      await options.refresh();if(!alive(token))return;
      if(options.blocked())throw Error('Attendez la fin de l’opération de partie.');
      assertCurrent(captured,true);confirmation={action,entry:captured};feedback('');
    }catch(cause){if(alive(token)){confirmation=undefined;feedback(message(cause),true);}}
    finally {if(alive(token)){pending=false;paint();}}
  }

  async function confirmChange(dialog:Confirmation):Promise<void> {
    if(unavailable()||confirmation!==dialog)return;
    const captured={...dialog.entry},action=dialog.action;
    await run(async()=>{
      // Refresh immediately before the explicit destructive action; then the
      // repository atomically checks this same opaque revision again at commit.
      await options.refresh();assertCurrent(captured,true);
      if(options.blocked())throw Error('Attendez la fin de l’opération de partie.');
      if(action==='overwrite')await options.saveNamed(captured.label,captured.key,captured.revision);
      else await options.deleteSave(captured.key,captured.revision);
    },action==='overwrite'?`Remplacement de « ${captured.label} »…`:`Suppression de « ${captured.label} »…`,action==='overwrite'?`Sauvegarde « ${captured.label} » remplacée.`:`Copie « ${captured.label} » supprimée.`);
  }

  async function loadEntry(entry:SavedColony):Promise<void> {
    if(unavailable()||confirmation)return;
    const captured={...entry};
    await run(async()=>{await options.refresh();assertCurrent(captured,isManagedSaveKey(captured.key));if(options.blocked())throw Error('Attendez la fin de l’opération de partie.');await options.load(captured.key);},`Chargement de « ${captured.label} »…`,`Sauvegarde « ${captured.label} » chargée.`,{refresh:false,closeAfter:true});
  }

  return {
    async open(){
      if(disposed)throw Error('Le gestionnaire de sauvegardes a été fermé.');
      if(opened){paint();return;}
      opened=true;generation++;confirmation=undefined;search='';selectedKey=undefined;feedback('');readOrReport();paint();await refreshList();
    },
    dispose(){
      if(disposed)return;const wasOpen=opened;
      disposed=true;opened=false;generation++;confirmation=undefined;entries=[];nameDraft='';
      if(wasOpen)options.close();
    },
  };
}
