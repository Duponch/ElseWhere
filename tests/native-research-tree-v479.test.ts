import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {applyCommand,createWorld} from '../src/sim/index';
import {RESEARCH_SCALE} from '../src/sim/research';
import {researchProjects} from '../src/ui/research-projects';
import {researchGraphLinks,researchLinks,researchLinkSvgPath,researchNodePosition,researchPrerequisiteLabels,RESEARCH_GRAPH_WIDTH,RESEARCH_GRAPH_HEIGHT,RESEARCH_NODE_WIDTH,RESEARCH_NODE_HEIGHT} from '../src/ui/research-tree';
import {buildNativeResearch,resetNativeResearch} from '../src/ui3d/native-research';
import {coreResearchLinks,coreResearchNodePosition} from '../src/ui3d/native-research-geometry';
import {RESEARCH_PREREQUISITES} from '../src/sim/research-prerequisites';
import {layoutNativePage,NATIVE_UI} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';

let seed=479200;
function fixture(){
  const world=createWorld(++seed,16,16);
  // A prepared UI fixture needs an explicit research owner; createWorld may
  // legitimately leave the optional dossier absent until the first command.
  world.research??={project:null,points:0};
  const state:NativeUiState={world,epoch:seed,panel:'research',category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const noop=()=>{};
  const actions:NativeUiActions={command:vi.fn(async command=>applyCommand(world,command)),panel:vi.fn(),category:vi.fn(),tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:vi.fn(),readState:()=>state};
  let page:NativePage;
  const rebuild=()=>page=buildNativeResearch(world,actions);
  const control=(id:string):NativeControl=>{const result=page.rows.flatMap(row=>row.controls??[]).find(control=>control.id===id);if(!result)throw Error('Contrôle absent : '+id);return result;};
  rebuild();return {world,state,actions,rebuild,control,get page(){return page;}};
}
afterEach(()=>resetNativeResearch());

describe('shared delivered research hierarchy',()=>{
  it('keeps the exact delivered legacy SVG routes and current project coordinates',()=>{
    expect(researchProjects).toHaveLength(54);expect(researchLinks).toHaveLength(41);
    // Golden requalified on the untouched pre-lot-7 integration copy, after
    // twelve later research additions and the conformed prerequisite table.
    const paths=researchLinks.map(([from,to])=>[from,to,researchLinkSvgPath(from,to)]);
    expect(createHash('sha256').update(JSON.stringify(paths)).digest('hex')).toBe('0a5852c0f82d48ba0c5398b3c7a82f93a7b898c7811c33a5cb70ba7bd9bb5b74');
    expect([RESEARCH_NODE_WIDTH,RESEARCH_NODE_HEIGHT,RESEARCH_GRAPH_WIDTH,RESEARCH_GRAPH_HEIGHT]).toEqual([142,66,850,992]);
    const positions=researchProjects.map(researchNodePosition);
    // The delivered DOM coordinates contain this pre-existing overlap. Native
    // presentation repairs it separately without rewriting the legacy oracle.
    expect(new Set(positions.map(position=>`${position.x}:${position.y}`)).size).toBe(53);
    expect(researchNodePosition(researchProjects.find(project=>project.id==='prosthetics')!)).toEqual(researchNodePosition(researchProjects.find(project=>project.id==='recon-armor')!));
    for(const position of positions){expect(position.x).toBeGreaterThanOrEqual(0);expect(position.y).toBeGreaterThanOrEqual(0);expect(position.x+142).toBeLessThanOrEqual(RESEARCH_GRAPH_WIDTH);expect(position.y+66).toBeLessThanOrEqual(RESEARCH_GRAPH_HEIGHT);}
  });
  it('has no dangling native links and samples curves with the same SVG endpoints',()=>{
    const projects=new Set(researchProjects.map(project=>project.id));
    expect(researchGraphLinks.map(link=>[link.from,link.to])).toEqual(researchLinks);
    for(const link of researchGraphLinks){
      expect(projects.has(link.from)).toBe(true);expect(projects.has(link.to)).toBe(true);expect(link.path.length).toBeGreaterThanOrEqual(2);
      for(const point of link.path){expect(Number.isFinite(point.x)&&Number.isFinite(point.y)).toBe(true);expect(point.x).toBeGreaterThanOrEqual(0);expect(point.x).toBeLessThanOrEqual(RESEARCH_GRAPH_WIDTH);expect(point.y).toBeGreaterThanOrEqual(0);expect(point.y).toBeLessThanOrEqual(RESEARCH_GRAPH_HEIGHT);}
      const numbers=researchLinkSvgPath(link.from,link.to).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
      expect(link.path[0]).toEqual({x:numbers[0],y:numbers[1]});
      expect(link.path.at(-1)!.x).toBeCloseTo(numbers.at(-2)!,12);expect(link.path.at(-1)!.y).toBeCloseTo(numbers.at(-1)!,12);
    }
    expect(researchPrerequisiteLabels.get('vitals-monitor')).toEqual(['Multi-analyseur','Lit d’hôpital']);
  });
});

describe('native research uses the Core tree and keeps the dossier and direct actions',()=>{
  it('exposes the Principal tab, every fixed-size node and its distinct select/start controls without changing the World',()=>{
    const f=fixture(),before=JSON.stringify(f.world);f.rebuild();
    expect(f.page.id).toBe('research');expect(f.page.layout).toBe('research');expect(f.page.width).toBeUndefined();
    expect(f.page.rows.filter(row=>row.region==='navigation').flatMap(row=>row.controls??[]).map(control=>[control.id,control.label])).toEqual([['research-tab-main','Principal']]);
    const nodes=f.page.rows.filter(row=>row.graphNode);
    expect(nodes).toHaveLength(researchProjects.length);expect(f.page.research!.links).toEqual(coreResearchLinks);
    for(const project of researchProjects){const node=nodes.find(row=>row.id==='research-node-'+project.id)!;expect(node.graphNode).toMatchObject({...coreResearchNodePosition(project.id),width:140,height:50,cost:project.cost});expect(node.controls!.map(control=>control.id)).toEqual([`research-${project.id}-select`,`research-${project.id}-start`]);expect(node.controls![0]!.hint).toContain(project.detail);}
    expect(f.page.rows.some(row=>row.region==='details'&&row.id==='research-active-heading')).toBe(true);
    expect(JSON.stringify(f.world)).toBe(before);expect(f.actions.command).not.toHaveBeenCalled();
  });
  it('places every supported project in the original horizontal tree, with no overlaps and visible prerequisite ports',()=>{
    const legacyBefore=JSON.stringify({positions:researchProjects.map(researchNodePosition),links:researchGraphLinks});
    const f=fixture(),worldBefore=JSON.stringify(f.world),nodes=f.page.rows.filter(row=>row.graphNode);
    expect(new Set(nodes.map(row=>`${row.graphNode!.x}:${row.graphNode!.y}`)).size).toBe(researchProjects.length);
    expect(new Set(nodes.map(row=>row.id))).toEqual(new Set(researchProjects.map(project=>'research-node-'+project.id)));
    expect([f.page.research!.width,f.page.research!.height]).toEqual([4170,650]);
    // Coordinates checked against Core ResearchProjectDefs and the 190/100
    // conversion from MainTabWindow_Research (20 points of canvas margin).
    expect(coreResearchNodePosition('tree-sowing')).toEqual({x:20,y:20});
    expect(coreResearchNodePosition('prosthetics')).toEqual({x:1350,y:500});
    expect(coreResearchNodePosition('recon-armor')).toEqual({x:3250,y:130});
    expect(coreResearchNodePosition('ship-engine')).toEqual({x:4010,y:560});
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i]!.graphNode!,b=nodes[j]!.graphNode!;
      expect(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y,`${nodes[i]!.label} and ${nodes[j]!.label} must not overlap`).toBe(false);
    }
    const expectedLinks=researchProjects.flatMap(project=>RESEARCH_PREREQUISITES[project.id].visible.filter(parent=>parent!=='electricity').map(parent=>`${parent}>${project.id}`));
    expect(f.page.research!.links.map(link=>`${link.from}>${link.to}`)).toEqual(expectedLinks);
    for(const link of f.page.research!.links){
      const source=nodes.find(row=>row.id==='research-node-'+link.from)!.graphNode!,target=nodes.find(row=>row.id==='research-node-'+link.to)!.graphNode!;
      expect(link.path).toEqual([{x:source.x+source.width,y:source.y+source.height/2},{x:target.x,y:target.y+target.height/2}]);
    }
    expect(JSON.stringify({positions:researchProjects.map(researchNodePosition),links:researchGraphLinks})).toBe(legacyBefore);
    expect(JSON.stringify(f.world)).toBe(worldBefore);expect(f.actions.command).not.toHaveBeenCalled();
  });
  it('has the Core sidebar, 200 × 24 search field, tab and bounded scroll regions',()=>{
    const f=fixture(),measure=(s:string,n:number)=>s.length*n*.52;
    for(const viewport of [{width:1440,height:860},{width:960,height:540},{width:480,height:240}]){
      const box=layoutNativePage(f.page,viewport,false,measure),details=box.regions.details!,graph=box.regions.graph!,nav=box.regions.navigation!;
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      for(const region of Object.values(box.regions)){expect(region.x+region.width).toBeLessThanOrEqual(box.width);expect(region.y+region.height).toBeLessThanOrEqual(box.height);}
      expect(graph.x-details.x-details.width).toBe(10);
      const search=box.rows.find(row=>row.row.id==='research-search')!,tab=box.rows.find(row=>row.row.id==='research-tabs')!.controls[0]!;
      expect(search.inputRect!.height).toBe(24);expect(search.inputRect!.x+search.inputRect!.width).toBeLessThanOrEqual(nav.x+nav.width);
      expect(search.inputRect!.y+search.inputRect!.height+box.header).toBeLessThanOrEqual(nav.y+nav.contentHeight);
      expect(graph.contentWidth).toBe(f.page.research!.width);expect(box.rows.filter(row=>row.row.graphNode)).toHaveLength(researchProjects.length);
      expect(box.rows.find(row=>row.row.id==='research-selected-title')!.height).toBeGreaterThanOrEqual(50);
      expect(box.rows.find(row=>row.row.id==='research-selected-action')!.controls[0]!.height).toBe(55);
      if(viewport.width>=960){expect(search.inputRect!.width).toBe(200);expect(tab.width).toBeGreaterThanOrEqual(100);expect(tab.width).toBeLessThanOrEqual(200);
        expect(details.width).toBe(Math.max(270,Math.round((box.width-2*NATIVE_UI.padding)*.22)));
      }
    }
  });
  it('searches without removing branches or issuing an order, and requests horizontal focus on the match',async()=>{
    const f=fixture(),world=JSON.stringify(f.world),before=f.page.research!.focus!.key;
    await f.page.rows.find(row=>row.id==='research-search')!.input!.onCommit('ship-engine');f.rebuild();
    expect(f.page.research!.selected).toBe('ship-engine');expect(f.page.research!.focus).toMatchObject({x:4010,y:560});
    expect(f.page.research!.focus!.key).not.toBe(before);
    expect(f.page.rows.filter(row=>row.graphNode?.searchMatch).map(row=>row.id)).toEqual(['research-node-ship-engine']);
    expect(f.page.rows.filter(row=>row.graphNode)).toHaveLength(researchProjects.length);expect(f.page.research!.links).toEqual(coreResearchLinks);
    expect(JSON.stringify(f.world)).toBe(world);expect(f.actions.command).not.toHaveBeenCalled();
    f.state.epoch!++;f.rebuild();
    expect(f.page.rows.find(row=>row.id==='research-search')!.input!.value).toBe('');
    expect(f.page.rows.filter(row=>row.graphNode?.searchMatch)).toHaveLength(researchProjects.length);
  });
  it('keeps selection separate from launch, preserves the page identity and retains an explicit player choice across fresh World snapshots',async()=>{
    const f=fixture(),before=JSON.stringify(f.world),active=f.world.research?.project;
    await f.control('research-tree-sowing-select').onActivate();f.rebuild();
    expect(f.page.research!.selected).toBe('tree-sowing');expect(f.page.id).toBe('research');expect(f.actions.command).not.toHaveBeenCalled();expect(f.world.research?.project).toBe(active);expect(JSON.stringify(f.world)).toBe(before);
    f.world.tick++;if(f.world.corePathBudget297)f.world.corePathBudget297.tick=f.world.tick;f.rebuild();expect(f.page.research!.selected).toBe('tree-sowing');
    expect(f.control('research-start').disabled).toBe(false);await f.control('research-start').onActivate();f.rebuild();
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'research-project',project:'tree-sowing'});expect(f.world.research?.project).toBe('tree-sowing');
    expect(f.control('research-start').disabled).toBe(true);expect(f.control('research-start').label).toBe('Recherche en cours');
  });
  it('lets an ordinary project be chosen before its workstation exists, but explains its wait and still blocks missing prerequisites',async()=>{
    const f=fixture();f.world.structures.length=0;f.world.research!.smithing={points:0};
    f.rebuild();const tree=f.control('research-tree-sowing-start');expect(tree.disabled).toBe(false);expect(tree.hint).toContain('Le projet peut être choisi maintenant');
    await tree.onActivate();expect(f.world.research?.project).toBe('tree-sowing');
    f.rebuild();expect(f.control('research-machining-start').disabled).toBe(true);expect(f.control('research-machining-start').hint).toContain('Nécessite');
    const machining=f.page.rows.find(row=>row.id==='research-node-machining')!;expect(machining.graphNode!.state).toBe('locked');
  });
  it('keeps the installation admission specific to the vitals monitor after its research prerequisites are prepared',()=>{
    const f=fixture();f.world.structures.length=0;
    f.world.research!.hospitalBed={points:2000*RESEARCH_SCALE,completedAt:1};f.world.research!.multiAnalyzer={points:4000*RESEARCH_SCALE,completedAt:1};
    f.rebuild();expect(f.control('research-vitals-monitor-start').disabled).toBe(true);expect(f.control('research-vitals-monitor-start').hint).toContain('Un bureau avancé et un multi-analyseur alimentés');
  });
  it('retains active-project navigation, exact progress, pause and both context links',async()=>{
    const f=fixture();f.world.research!.project='smithing';f.world.research!.smithing={points:125.5*RESEARCH_SCALE};f.rebuild();
    await f.control('research-tree-sowing-select').onActivate();f.rebuild();await f.control('research-active-project').onActivate();f.rebuild();
    expect(f.page.research!.selected).toBe('smithing');expect(f.page.rows.find(row=>row.id==='research-active-progress')!.meter).toMatchObject({value:125.5,max:700});
    await f.control('research-pause').onActivate();f.rebuild();expect(f.world.research!.project).toBeNull();expect(f.world.research!.smithing.points).toBe(125.5*RESEARCH_SCALE);expect(f.control('research-pause').disabled).toBe(true);
    await f.control('research-open-work').onActivate();expect(f.actions.panel).toHaveBeenLastCalledWith('work');
    await f.control('research-open-production').onActivate();expect(f.actions.category).toHaveBeenLastCalledWith('production');expect(f.actions.panel).toHaveBeenLastCalledWith('architect');
  });
  it('shows completion and missing researcher facts while keeping help explicitly collapsible',async()=>{
    const f=fixture();for(const pawn of f.world.pawns){delete pawn.background;pawn.priorities.research=0;}
    f.world.research!.stonecutting={points:300*RESEARCH_SCALE,completedAt:0};f.rebuild();
    expect(f.control('research-stonecutting-start').disabled).toBe(true);expect(f.page.rows.find(row=>row.id==='research-node-stonecutting')!.graphNode!.state).toBe('done');
    expect(f.page.rows.find(row=>row.id==='research-readiness')!.label).toContain('Recherche désactivée');
    expect(f.page.rows.some(row=>row.id==='research-help-body')).toBe(false);await f.control('research-help').onActivate();f.rebuild();expect(f.page.rows.find(row=>row.id==='research-help-body')!.label).toContain('Architecte → Production');
    await f.control('research-help').onActivate();f.rebuild();expect(f.page.rows.some(row=>row.id==='research-help-body')).toBe(false);
  });
  it('keeps historical schema gates, omits dangling links and resets drafts on a real owner epoch or a tick rollback',async()=>{
    const f=fixture();await f.control('research-tree-sowing-select').onActivate();await f.control('research-help').onActivate();f.rebuild();
    f.state.epoch!++;f.rebuild();expect(f.page.research!.selected).toBe(f.world.research?.project??'complex-clothing');expect(f.page.rows.some(row=>row.id==='research-help-body')).toBe(false);
    await f.control('research-stonecutting-select').onActivate();f.world.tick+=10;f.rebuild();f.world.tick-=5;f.rebuild();expect(f.page.research!.selected).toBe(f.world.research?.project??'complex-clothing');
    f.world.schemaVersion=289 as typeof f.world.schemaVersion;f.rebuild();const graphIds=new Set(f.page.rows.filter(row=>row.graphNode).map(row=>row.id.slice('research-node-'.length)));
    expect(graphIds.has('tree-sowing')).toBe(false);expect(graphIds.has('firefoam')).toBe(false);
    for(const link of f.page.research!.links){expect(graphIds.has(link.from)).toBe(true);expect(graphIds.has(link.to)).toBe(true);}
  });
});
