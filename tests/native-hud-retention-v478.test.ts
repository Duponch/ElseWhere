import {afterEach, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three/webgpu';
import type {ItemId} from '../src/sim/items';
import type {StatusAlert} from '../src/ui/status-alerts';
import {NativeHudCards,type NativeHudActions} from '../src/ui3d/native-hud';
import {createWorld,applyCommand} from '../src/sim/index';
import {addMaterial} from '../src/sim/materials';
import {refreshNativePage} from '../src/ui3d/native-page-refresh';
import type {NativePage,NativeUiState,NativeUiActions} from '../src/ui3d/native-contract';
import {PALETTE, PrototypeCardboardArt, type CardboardPiece} from '../src/ui3d/prototype-art';

type Command=unknown[];
const surfaces=new WeakMap<HTMLCanvasElement,Command[]>();
class ImageFixture {
  onload:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  complete=false;
  naturalWidth=0;
  src='';
}
function installPaint():void {
  const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash']);
  vi.stubGlobal('Image',ImageFixture);
  vi.stubGlobal('document',{createElement:(tag:string)=>{
    if(tag!=='canvas')throw new Error(`Unexpected native element ${tag}`);
    const commands:Command[]=[],state=new Map<PropertyKey,unknown>(),stack:Array<Map<PropertyKey,unknown>>=[];
    const context=new Proxy({}, {
      get(_target,key){
        if(key==='measureText')return (text:string)=>({width:text.length*7});
        if(typeof key==='string'&&methods.has(key))return (...args:unknown[])=>{
          commands.push([key,...args]);
          if(key==='save')stack.push(new Map(state));
          if(key==='restore'){state.clear();for(const [name,value] of stack.pop()??[])state.set(name,value);}
        };
        return state.get(key);
      },
      set(_target,key,value:unknown){state.set(key,value);commands.push(['set',key,value]);return true;}
    });
    const canvas={width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;
    surfaces.set(canvas,commands);return canvas;
  }});
}
type TestAlert=StatusAlert&{domain?:{severity:'danger'|'warning'}};
interface HudAccess {
  resources:Array<{item:ItemId;stock:number;ground:number;carried:number;inventory:number;equipped:number;delivered:number}>;
  alerts:TestAlert[];
  resourceImages:Map<ItemId,ImageFixture>;
  refreshResources():void;
  refreshAlerts():void;
}
function fixture(options:Partial<NativeHudActions>={}){
  installPaint();
  const art=new PrototypeCardboardArt(),root=new THREE.Group(),showPage=vi.fn((page:NativePage)=>options.showPage?.(page));
  const anchors={topCenter:new THREE.Group(),topLeft:new THREE.Group(),topRight:new THREE.Group(),bottomRight:new THREE.Group()};
  root.add(...Object.values(anchors));
  const hud=new NativeHudCards(art,anchors,{selectPawn:vi.fn(),speed:vi.fn(),...options,showPage});
  const access=hud as unknown as HudAccess;
  const piece=(id:string):CardboardPiece=>{
    let found:CardboardPiece|undefined;
    root.traverse(object=>{if(object.userData.nativeId===id)found=object as CardboardPiece;});
    if(!found)throw new Error(`Missing ${id}`);return found;
  };
  const resources=(rows:Array<[ItemId,number]>)=>{
    access.resources=rows.map(([item,stock])=>({item,stock,ground:stock,carried:0,inventory:0,equipped:0,delivered:0}));
    access.refreshResources();
  };
  const alerts=(rows:TestAlert[])=>{access.alerts=rows;access.refreshAlerts();};
  return {art,hud,access,root,piece,resources,alerts,showPage,close:()=>{hud.dispose();art.dispose();}};
}
const ink=(piece:CardboardPiece)=>surfaces.get(piece.userData.canvas)!;
const front=(piece:CardboardPiece)=>(Array.isArray(piece.userData.mesh.material)?piece.userData.mesh.material[0]:piece.userData.mesh.material) as THREE.Material;
const disposed=(resource:THREE.BufferGeometry|THREE.Material|THREE.Texture)=>{const spy=vi.fn();resource.addEventListener('dispose',spy);return spy;};
const alert=(key:string,text:string):TestAlert=>({key,text,targets:[]});

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('HUD dossiers keep the accepted live facts',()=>{
  it('refreshes an open roster and stock dossier on a same-tick accepted world without creating more HUD pieces',()=>{
    const world=createWorld(8_530_099,16,16);world.piles=[];
    for(const tile of world.tiles){tile.terrain='soil';delete tile.fogged;}
    addMaterial(world,'wood',12,{type:'ground',x:4,z:4},'wood');
    const state={world,epoch:99} as NativeUiState;let page:NativePage|undefined;
    const f=fixture({readState:()=>state,showPage:p=>{page=p;}});
    const access=f.hud as unknown as {showRoster:()=>void;showResources:()=>void;refreshPortraits:()=>void};
    access.refreshPortraits=vi.fn();
    try{
      f.hud.update(world,0,60);access.showRoster();const previous=page!,tick=world.tick;
      state.world=structuredClone(world);expect(applyCommand(state.world!,{type:'pawn-rename',pawnId:world.pawns[0]!.id,nick:'Lise',title:''})).toMatchObject({ok:true});
      expect(state.world!.tick).toBe(tick);f.hud.update(state.world,0,60);page=refreshNativePage(page!,state,{} as NativeUiActions)!;
      expect(page).not.toBe(previous);expect(page.rows.some(r=>r.label.includes('Lise'))).toBe(true);
      access.showResources();expect(page!.rows.find(r=>r.id==='item-wood')?.detail).toContain('Sol 12');
      const next=structuredClone(state.world!);addMaterial(next,'wood',7,{type:'ground',x:5,z:4},'wood');state.world=next;f.hud.update(next,0,60);
      const pieces=f.art.pieceRevision;page=refreshNativePage(page!,state,{} as NativeUiActions)!;
      expect(page.rows.find(r=>r.id==='item-wood')?.detail).toContain('Sol 19');expect(f.art.pieceRevision).toBe(pieces);
    }finally{f.close();}
  });
  it('refreshes only the currently owned alert dossier when the delayed alert reading finishes while paused',()=>{
    const state={world:createWorld(8_530_100,16,16),epoch:100} as NativeUiState;let page:NativePage|undefined,now=0;
    const refresh=vi.fn(()=>{if(page)page=refreshNativePage(page,state,{} as NativeUiActions)??undefined;});
    const f=fixture({readState:()=>state,showPage:p=>{page=p;},isCurrentPage:p=>page===p,refresh});
    const access=f.hud as unknown as {clock:()=>number;showAlerts:()=>void;refreshPortraits:()=>void;animateAlerts:(delta:number)=>void};
    Object.assign(access,{clock:()=>now,refreshPortraits:vi.fn()});
    try{
      f.hud.update(state.world,0,60);access.showAlerts();
      now=100;state.world=structuredClone(state.world!);f.hud.update(state.world,0,60);
      now=1001;access.animateAlerts(.1);expect(refresh).toHaveBeenCalledOnce();
      page={id:'local-confirmation',title:'Confirmation',rows:[]};
      now=1100;state.world=structuredClone(state.world!);f.hud.update(state.world,0,60);
      now=2002;access.animateAlerts(.1);expect(refresh).toHaveBeenCalledOnce();expect(page.id).toBe('local-confirmation');
    }finally{f.close();}
  });
});

describe('retained native HUD resources',()=>{
  it('an advancing civil minute repaints only the clock while hover changes repaint only the temperature',()=>{
    const f=fixture(),world=createWorld(8_530_099,16,16);
    const access=f.hud as unknown as {world:typeof world;refreshWeather:(value:typeof world)=>void};
    try{
      access.world=world;f.hud.setHoverTemperature('Intérieur 21 °C');
      const clock=f.piece('hud:clock'),weather=f.piece('hud:weather-label'),temperature=f.piece('hud:temperature');
      const versions=()=>[clock,weather,temperature].map(piece=>piece.userData.texture.version);
      const [c,w,t]=versions() as [number,number,number];
      world.tick+=5;access.refreshWeather(world);
      expect(versions()).toEqual([c+1,w,t]);
      f.hud.setHoverTemperature('Intérieur 22 °C');
      expect(versions()).toEqual([c+1,w,t+1]);
      expect(clock.userData.tooltip).toContain('22 °C');
      access.refreshWeather(world);
      expect(versions()).toEqual([c+1,w,t+1]);
    }finally{f.close();}
  });
  it('changes only affected ink and preserves canvases, GPU resources, hit meshes and hover state',()=>{
    const f=fixture();
    try{
      f.resources([['wood',10],['steel',20]]);
      const wood=f.piece('hud:resource:wood'),steel=f.piece('hud:resource:steel');
      const identities=[wood.userData.canvas,wood.userData.texture,wood.userData.mesh.geometry,front(wood)];
      const releases=identities.slice(1).map(resource=>disposed(resource as THREE.Texture|THREE.BufferGeometry|THREE.Material));
      const woodVersion=wood.userData.texture.version,steelVersion=steel.userData.texture.version;
      wood.userData.hoverVal=.75;ink(wood).length=0;
      f.resources([['wood',11],['steel',20]]);
      expect(f.piece('hud:resource:wood')).toBe(wood);
      expect([wood.userData.canvas,wood.userData.texture,wood.userData.mesh.geometry,front(wood)]).toEqual(identities);
      expect(wood.userData.texture.version).toBe(woodVersion+1);
      expect(steel.userData.texture.version).toBe(steelVersion);
      expect(wood.userData.hoverVal).toBe(.75);
      expect(f.art.interactiveMeshes).toContain(wood.userData.mesh);
      expect(ink(wood).some(command=>command[0]==='fillText'&&command[1]==='11')).toBe(true);
      expect(wood.userData.tooltip).toContain('11 comptabilisé');
      for(const release of releases)expect(release).not.toHaveBeenCalled();
      const revision=f.art.revision;
      f.resources([['wood',11],['steel',20]]);
      expect(f.art.revision).toBe(revision);
      wood.userData.onClick?.();
      expect(f.showPage.mock.lastCall![0].rows.find((row:{id:string})=>row.id==='item-wood')!.value).toBe('11 comptabilisé(s)');
    }finally{f.close();}
  });

  it('keeps branch controls live and releases disappeared rows and changed positional seeds once',()=>{
    const f=fixture();
    try{
      f.resources([['wood',10],['steel',20]]);
      const branch=f.piece('hud:resource:raw-resources'),wood=f.piece('hud:resource:wood'),steel=f.piece('hud:resource:steel');
      const woodReleased=disposed(wood.userData.texture),steelReleased=disposed(steel.userData.texture);
      branch.userData.onClick?.();
      expect(f.piece('hud:resource:raw-resources')).toBe(branch);
      expect(branch.userData.tooltip).toBe('Déplier Ressources brutes');
      expect(woodReleased).toHaveBeenCalledTimes(1);expect(steelReleased).toHaveBeenCalledTimes(1);
      expect(f.art.interactiveMeshes).not.toContain(wood.userData.mesh);
      branch.userData.onClick?.();
      const restoredWood=f.piece('hud:resource:wood'),woodSeed=restoredWood.userData.seed;
      f.resources([['wood',10]]);
      // A shifted index changes the literal brush seed; it must not inherit the
      // previous row's texture/hand jitter merely to preserve object identity.
      expect(f.piece('hud:resource:wood').userData.seed).not.toBe(woodSeed);
      expect(f.piece('hud:resource:wood')).not.toBe(restoredWood);
      f.resources([]);
      expect(f.piece('hud:resource:empty').userData.tooltip).toContain('Stocks connus');
    }finally{f.close();}
  });

  it('retains page controls when only quantities change and refreshes their page actions',()=>{
    const f=fixture();
    try{
      f.hud.setViewport(1440,228,.01); // Three rows per page.
      f.resources([['wood',10],['steel',20],['gold',30],['silver',40]]);
      const next=f.piece('hud:resource:next'),previous=f.piece('hud:resource:previous');
      const nextVersion=next.userData.texture.version;
      f.resources([['wood',11],['steel',20],['gold',30],['silver',40]]);
      expect(f.piece('hud:resource:next')).toBe(next);
      expect(f.piece('hud:resource:previous')).toBe(previous);
      expect(next.userData.texture.version).toBe(nextVersion);
      next.userData.onClick?.();
      expect(ink(f.piece('hud:resource:previous')).some(command=>command[0]==='fillText'&&command[1]==='‹ 2/2')).toBe(true);
      f.piece('hud:resource:previous').userData.onClick?.();
      expect(f.piece('hud:resource:raw-resources')).toBeDefined();
    }finally{f.close();}
  });

  it('image completion repaints current records with current values and becomes inert on disposal',()=>{
    const f=fixture();
    try{
      f.resources([['wood',10]]);
      const image=f.access.resourceImages.get('wood')!,late=image.onload!;
      f.resources([['wood',12]]);
      const wood=f.piece('hud:resource:wood');ink(wood).length=0;
      image.complete=true;image.naturalWidth=24;late();
      expect(ink(wood).some(command=>command[0]==='drawImage'&&command[1]===image)).toBe(true);
      expect(ink(wood).some(command=>command[0]==='fillText'&&command[1]==='12')).toBe(true);
      f.resources([]);
      const revision=f.art.revision;late();expect(f.art.revision).toBe(revision);
      f.hud.dispose();const closedRevision=f.art.revision;late();
      expect(f.art.revision).toBe(closedRevision);expect(image.onload).toBeNull();
    }finally{f.close();}
  });
});

describe('retained native HUD alerts',()=>{
  it('rebinds current alert details without painting unchanged ink, and repaints severity on the same card',()=>{
    const f=fixture();
    try{
      f.alerts([alert('notice','Message court')]);
      const card=f.piece('hud:alert:notice'),all=f.piece('hud:alerts:all'),version=card.userData.texture.version,allVersion=all.userData.texture.version,revision=f.art.revision;
      f.alerts([{...alert('notice','Message court'),tooltip:{title:'Titre actuel',body:'Détails actuels'}}]);
      expect(f.piece('hud:alert:notice')).toBe(card);expect(f.art.revision).toBe(revision);
      card.userData.onClick?.();
      expect(f.showPage.mock.lastCall?.[0].rows).toContainEqual({id:'body',label:'Détails actuels'});
      f.alerts([{...alert('notice','Message court'),domain:{severity:'danger'}}]);
      expect(f.piece('hud:alert:notice')).toBe(card);
      expect(card.userData.texture.version).toBe(version+1);
      expect(ink(card)).toContainEqual(['set','fillStyle',PALETTE.terracotta]);
      expect(all.userData.texture.version).toBe(allVersion);
    }finally{f.close();}
  });

  it('repaints equal-sized text from live records and releases only removed/resized/reseeded cards',()=>{
    const f=fixture();
    try{
      f.alerts([alert('notice','Message court'),alert('other','Autre message')]);
      const card=f.piece('hud:alert:notice'),other=f.piece('hud:alert:other'),otherVersion=other.userData.texture.version;
      const identities=[card.userData.texture,card.userData.canvas,front(card),card.userData.mesh.geometry];
      ink(card).length=0;
      f.alerts([alert('notice','Message neuf!'),alert('other','Autre message')]);
      expect(f.piece('hud:alert:notice')).toBe(card);
      expect([card.userData.texture,card.userData.canvas,front(card),card.userData.mesh.geometry]).toEqual(identities);
      expect(ink(card).some(command=>command[0]==='fillText'&&command[1]==='Message neuf!')).toBe(true);
      expect(card.userData.tooltip).toBe('Message neuf!');expect(other.userData.texture.version).toBe(otherVersion);
      const release=disposed(card.userData.texture),otherRelease=disposed(other.userData.texture);
      f.alerts([alert('notice','Un message devenu bien plus long et donc redimensionné'),alert('other','Autre message')]);
      expect(release).toHaveBeenCalledTimes(1);expect(f.piece('hud:alert:other')).toBe(other);
      f.alerts([alert('other','Autre message')]);
      expect(otherRelease).toHaveBeenCalledTimes(1);expect(f.piece('hud:alert:other').userData.seed).toBe(53);
      expect(f.art.interactiveMeshes).not.toContain(card.userData.mesh);
    }finally{f.close();}
  });

  it('matches freshly painted ink after retention and maintains overflow count and cleanup',()=>{
    const f=fixture(),g=fixture();
    try{
      // Alerts lot A shows every alert that fits (Core has no four-card cap):
      // 30 short rows still overflow the default column, four never do.
      const rows=Array.from({length:30},(_,index)=>alert(`notice-${index}`,`Message ${index}`));
      f.alerts(rows);const first=f.piece('hud:alert:notice-0'),all=f.piece('hud:alerts:all');
      expect(all.visible).toBe(true);
      ink(first).length=0;
      const next=[alert('notice-0','Nouveau 0'),...rows.slice(1)];f.alerts(next);g.alerts(next);
      expect(ink(first)).toEqual(ink(g.piece('hud:alert:notice-0')));
      const version=all.userData.texture.version;
      f.alerts(next.slice(0,4));expect(all.visible).toBe(false);expect(all.userData.texture.version).toBe(version+1);
      expect(ink(all).some(command=>command[0]==='fillText'&&command[1]==='4 alertes · tout voir')).toBe(true);
      const releases=[first.userData.texture,front(first),first.userData.mesh.geometry,first.userData.shadowMesh.geometry].map(disposed);
      f.alerts([]);for(const release of releases)expect(release).toHaveBeenCalledTimes(1);
      f.hud.dispose();for(const release of releases)expect(release).toHaveBeenCalledTimes(1);
    }finally{f.close();g.close();}
  });
});

describe('responsive retained HUD reservations · V485',()=>{
  it('preserves existing portrait sheets, images and hit planes across guidance reservations and height changes',()=>{
    const f=fixture(),world=createWorld(8_530_107,16,16);
    const access=f.hud as unknown as {clock:()=>number;barPiece:CardboardPiece;portraits:Array<{image:unknown;piece:CardboardPiece}>};
    access.clock=()=>1000;
    try{
      f.hud.update(world,0,60);expect(access.portraits.length).toBeGreaterThan(0);
      const sheet=access.barPiece,original=access.portraits.map(entry=>({image:entry.image,piece:entry.piece}));
      const version=sheet.userData.texture.version;
      f.hud.setViewport(1440,900,.01,110,330);f.hud.setViewport(1440,850,.01,120,250);
      expect(access.barPiece).toBe(sheet);expect(access.barPiece.userData.texture.version).toBe(version);
      for(let i=0;i<original.length;i++){expect(access.portraits[i]!.piece).toBe(original[i]!.piece);expect(access.portraits[i]!.image).toBe(original[i]!.image);}
      f.hud.setViewport(1400,850,.01,120,250);expect(access.barPiece).not.toBe(sheet);
    }finally{f.close();}
  });

  it('uses one compact Stocks control in a short left lane and opens every unchanged resource record',()=>{
    const f=fixture();
    try{
      f.hud.setViewport(480,400,.01,96,60);
      f.resources([['wood',12],['steel',20],['gold',3]]);
      const original=structuredClone(f.access.resources),compact=f.piece('hud:resource:compact'),shown:string[]=[];
      f.root.traverse(object=>{if(String(object.userData.nativeId??'').startsWith('hud:resource:'))shown.push(String(object.userData.nativeId));});
      expect(shown).toEqual(['hud:resource:compact']);expect(compact.userData.paper).toBe(false);
      expect(compact.userData.tooltip).toContain('tous les stocks');
      compact.userData.onClick?.();
      const page=f.showPage.mock.lastCall![0];expect(page.id).toBe('hud-resources');
      expect(page.rows.filter((row:{id:string})=>row.id.startsWith('item-'))).toEqual([
        expect.objectContaining({id:'item-wood',value:'12 comptabilisé(s)',detail:expect.stringContaining('Sol 12')}),
        expect.objectContaining({id:'item-steel',value:'20 comptabilisé(s)',detail:expect.stringContaining('Sol 20')}),
        expect.objectContaining({id:'item-gold',value:'3 comptabilisé(s)',detail:expect.stringContaining('Sol 3')})
      ]);
      expect(f.access.resources).toEqual(original);
      const revision=f.art.revision,version=compact.userData.texture.version;
      f.resources([['wood',12],['steel',20],['gold',3]]);
      expect(f.piece('hud:resource:compact')).toBe(compact);expect(compact.userData.texture.version).toBe(version);expect(f.art.revision).toBe(revision);
    }finally{f.close();}
  });

  it('keeps resource ink inside the corner reserved before the portrait and roster controls',()=>{
    const f=fixture();
    try{
      // Display-only roster count; no World or simulated person is introduced.
      const display=f.hud as unknown as {barLayout:{left:number;locs:unknown[]}};
      f.hud.setViewport(1000,800,.01,96,200);display.barLayout={left:200,locs:[{}]};
      f.resources([['wood',12],['steel',20],['gold',3],['silver',4],['marble-chunk',5]]);
      const rosterLeft=display.barLayout.left;
      const records:CardboardPiece[]=[];f.root.traverse(object=>{if(String(object.userData.nativeId??'').startsWith('hud:resource:'))records.push(object as CardboardPiece);});
      expect(records.length).toBeGreaterThan(1);
      for(const piece of records){
        const right=8+(piece.userData.basePos.x+piece.userData.w/2)*100;
        expect(right).toBeLessThanOrEqual(rosterLeft-8+.001);
        expect(piece.userData.w*100).toBeGreaterThanOrEqual(60);
      }
      const source=f.access.resources.map(row=>({item:row.item,quantity:row.stock}));
      f.piece('hud:resource:raw-resources').userData.onClick?.();
      expect(f.access.resources.map(row=>({item:row.item,quantity:row.stock}))).toEqual(source);
      expect(ink(records[0]!).some(command=>command[0]==='set'&&command[1]==='font'&&String(command[2]).includes('13px'))).toBe(true);
    }finally{f.close();}
  });

  it('keeps the alerts and overflow footer above the weather board and leaves settled paint untouched',()=>{
    const f=fixture();
    try{
      // Alerts lot A: enough rows to overflow even the tallest viewport (no four-card cap).
      const rows=Array.from({length:40},(_,index)=>alert(`bounded-${index}`,`Alerte actuelle ${index}`));
      for(const viewport of [{width:480,height:400,bottom:96},{width:720,height:500,bottom:174},{width:1440,height:800,bottom:96}]){
        f.hud.setViewport(viewport.width,viewport.height,.01,viewport.bottom,60);f.alerts(rows);
        const all=f.piece('hud:alerts:all'),weather=f.piece('hud:clock');
        // Recreate the native anchor offsets in logical pixels. Bounds include
        // actual cut geometry, hand rotation and its physical shadow.
        all.parent!.parent!.position.y=(viewport.height/2-8)/100;
        weather.parent!.parent!.position.y=(-viewport.height/2+8)/100;
        f.root.updateMatrixWorld(true);
        const weatherBounds=new THREE.Box3().setFromObject(weather),visible:CardboardPiece[]=[];
        f.root.traverse(object=>{if(String(object.userData.nativeId??'').startsWith('hud:alert:')||object===all&&all.visible)visible.push(object as CardboardPiece);});
        expect(all.visible).toBe(true);
        for(const piece of visible)expect(new THREE.Box3().setFromObject(piece).min.y).toBeGreaterThan(weatherBounds.max.y+.03);
        const painted=visible.map(piece=>({piece,canvas:piece.userData.canvas,texture:piece.userData.texture,version:piece.userData.texture.version,draws:ink(piece).filter(command=>['fillText','fillRect','stroke','drawImage'].includes(String(command[0]))).length})),revision=f.art.revision;
        f.hud.setViewport(viewport.width,viewport.height,.01,viewport.bottom,60);f.alerts(rows);
        expect(f.art.revision).toBe(revision);
        for(const old of painted){expect(old.piece.userData.canvas).toBe(old.canvas);expect(old.piece.userData.texture).toBe(old.texture);expect(old.texture.version).toBe(old.version);expect(ink(old.piece).filter(command=>['fillText','fillRect','stroke','drawImage'].includes(String(command[0])))).toHaveLength(old.draws);}
      }
    }finally{f.close();}
  });
});
