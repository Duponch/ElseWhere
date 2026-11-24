import {describe,expect,it,vi} from 'vitest';
import {createStartingCandidateRoster,previewStartingCandidate,previewStartingParty,rerollStartingCandidateForRoster,startingPartyMissingWork} from '../src/sim/starting-candidates';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256';
import {BACKGROUND_SKILL_IDS,backgroundSkillRefusal} from '../src/sim/colonist-backgrounds';
import {createPawnsUiHarness,PAWNS_UI_SEED} from './helpers/native-pregame-pawns-harness';
import {layoutNativePage} from '../src/ui3d/native-layout';

describe('real Native candidate controller on a declared UI backend',()=>{
 it('keeps eight actual profiles, three/five groups, full dossier and best usable twelve-skill summary without starting',async()=>{
  const f=createPawnsUiHarness();await f.enterPawns();const roster=createStartingCandidateRoster(PAWNS_UI_SEED),party=previewStartingParty(PAWNS_UI_SEED,roster.slice(0,3));
  expect(f.page).toMatchObject({layout:'setup',setupProfile:'pawns',width:1020,height:764,setupCatalogueWidth:140});expect(f.order()).toEqual(roster.map(person=>person.serial));expect(f.row('party-selected-heading').label).toBe('Au départ');expect(f.row('party-reserve-heading').label).toBe('Laissés sur place');
  const candidateRows=f.page!.rows.filter(row=>/^candidate-\d+$/.test(row.id)),boundary=f.page!.rows.findIndex(row=>row.id==='party-reserve-heading');expect(candidateRows.filter(row=>f.page!.rows.indexOf(row)<boundary)).toHaveLength(3);expect(candidateRows.filter(row=>f.page!.rows.indexOf(row)>boundary)).toHaveLength(5);
  expect(candidateRows.every(row=>row.controlStyle==='button'&&row.compact&&row.controls?.length===1&&row.controls[0]!.hint?.includes(row.controls[0]!.label))).toBe(true);
  expect(candidateRows.every(row=>row.controls![0]!.portraitUrl?.startsWith('data:image/svg+xml')&&row.controls![0]!.caption)).toBe(true);
  expect(f.page!.portrait?.label).toContain(f.row('candidate-name').input!.value);expect(f.row('candidate-name').bio!.skills).toHaveLength(12);expect(f.page!.rows.filter(row=>row.id.startsWith('team-'))).toHaveLength(12);
  expect(f.row('candidate-name').bio!.creation).toBe(true);expect(f.row('candidate-health-heading').setupColumn).toBe(2);expect(f.row('candidate-relations-heading').setupColumn).toBe(2);
  const box=layoutNativePage(f.page!,{width:1440,height:900},true,(text,size)=>text.length*size*.53),bio=box.rows.find(row=>row.row.id==='candidate-name')!,rail=box.regions.catalogue!,details=box.regions.details!;
  expect(rail.width).toBe(140);expect(box.regions.graph!.height).toBe(127);expect(box.portraitRect).toMatchObject({width:92,height:128});
  expect(box.rows.filter(row=>/^candidate-\d+$/.test(row.row.id)).map(row=>[row.height,row.controls[0]!.style])).toEqual(Array(8).fill([60,'candidate']));
  expect([bio.width,bio.height]).toEqual([480,455]);expect(box.header+bio.top+bio.height).toBeLessThanOrEqual(details.y+details.height);expect(box.portraitRect!.x).toBeGreaterThanOrEqual(bio.x+bio.width);
  const small=layoutNativePage(f.page!,{width:640,height:480},true,(text,size)=>text.length*size*.53),smallBio=small.rows.find(row=>row.row.id==='candidate-name')!;
  expect(small.regions.details!.contentWidth).toBeGreaterThan(small.regions.details!.width);expect([smallBio.width,smallBio.height]).toEqual([480,455]);
  const contentKey=f.page!.contentKey,detailsKey=f.page!.detailsKey,portraits=candidateRows.map(row=>row.controls![0]!.portraitUrl);await f.click('inspect-'+roster[6]!.serial);expect(f.page!.contentKey).toBe(contentKey);expect(f.page!.detailsKey).not.toBe(detailsKey);
  expect(f.page!.rows.filter(row=>/^candidate-\d+$/.test(row.id)).map(row=>row.controls![0]!.portraitUrl)).toEqual(portraits);
  for(const skill of BACKGROUND_SKILL_IDS){const usable=party.pawns.filter(person=>!backgroundSkillRefusal(person,skill)).sort((a,b)=>(b.skills[skill]?.level??0)-(a.skills[skill]?.level??0)||(b.skills[skill]?.passion??0)-(a.skills[skill]?.passion??0)),best=usable[0],summary=f.row('team-'+skill);expect(summary.meter?.value).toBe(best?.skills[skill]?.level??0);expect(summary.meter?.passion).toBe(best?.skills[skill]?.passion??0);for(const person of party.pawns)expect(summary.hint).toContain(person.name);}
  expect(f.backend.start).not.toHaveBeenCalled();expect(f.sourceUnchanged()).toBe(true);
 });

 it('reorders exact serials, renames and renews only the chosen descriptor, and refuses stale profile callbacks',async()=>{
  const f=createPawnsUiHarness();await f.enterPawns();let expected=createStartingCandidateRoster(PAWNS_UI_SEED);const serial=expected[3]!.serial;
  await f.click('inspect-'+serial);expect(f.backend.start).not.toHaveBeenCalled();await f.click('promote-'+serial);expected=[...expected];expected.splice(2,0,expected.splice(3,1)[0]!);expect(f.order()).toEqual(expected.map(person=>person.serial));
  await f.click('up-'+serial);expected.splice(1,0,expected.splice(2,1)[0]!);expect(f.order()).toEqual(expected.map(person=>person.serial));await f.click('down-'+serial);expected.splice(2,0,expected.splice(1,1)[0]!);expect(f.order()).toEqual(expected.map(person=>person.serial));
  await f.row('candidate-name').input!.onCommit('  Nouveau nom du profil choisi  ');expected=expected.map(person=>person.serial===serial?{...person,nameOverride:'Nouveau nom du profil choisi'}:person);expect(f.row('candidate-name').input!.value).toBe('Nouveau nom du profil choisi');
  const oldInput=f.row('candidate-name').input!,oldReroll=f.control('reroll-'+serial);await f.click('reroll-'+serial);expected=rerollStartingCandidateForRoster(PAWNS_UI_SEED,expected,serial);const actual=previewStartingCandidate(PAWNS_UI_SEED,expected.find(person=>person.serial===serial)!);expect(f.row('candidate-name').input!.value).toBe(actual.name);expect(f.order()).toEqual(expected.map(person=>person.serial));
  expect(await oldInput.onCommit('Refus tardif')).toBe(false);await oldReroll.onActivate();expect(f.row('candidate-name').input!.value).toBe(actual.name);for(const skill of BACKGROUND_SKILL_IDS){const shown=f.row('candidate-name').bio!.skills.find(entry=>entry.id==='skill-'+skill)!;expect(shown.disabled?0:shown.level).toBe(backgroundSkillRefusal(actual,skill)?0:actual.skills[skill]?.level??0);}
  expect(f.page!.rows.filter(row=>/^candidate-\d+$/.test(row.id)).map(row=>row.controls![0]!.label)).toEqual(expected.map(person=>previewStartingCandidate(PAWNS_UI_SEED,person).name));
  const retained=f.control('up-'+serial);await f.click('start-colony');if(f.page?.id==='front-confirm')await f.click('confirm-accept');expect(vi.mocked(f.backend.start).mock.calls[0]![1]).toEqual(startingOriginalRequestFromRoster256(PAWNS_UI_SEED,expected));await retained.onActivate();expect(f.page).toBeUndefined();expect(f.sourceUnchanged()).toBe(true);
 });

 it('uses the final explicit Start directly for these actually capable originals and sends the exact original request',async()=>{
  const f=createPawnsUiHarness();await f.enterPawns();const roster=createStartingCandidateRoster(PAWNS_UI_SEED);await f.click('inspect-'+roster[6]!.serial);expect(f.backend.start).not.toHaveBeenCalled();
  // The actual originals have no missing required work. Do not invent a
  // confirmation, change their seed or renew profiles to manufacture one.
  expect(startingPartyMissingWork(PAWNS_UI_SEED,roster.slice(0,3))).toEqual([]);expect(f.order()).toEqual(roster.map(person=>person.serial));expect(f.page!.id).toBe('front-pawns');
  expect(f.page!.actions!.at(-1)!.id).toBe('start-colony');await f.click('start-colony');
  await vi.waitFor(()=>{expect(f.backend.start).toHaveBeenCalledTimes(1);expect(f.menu.isOpen()).toBe(false);},{timeout:1000});
  const [ticket,request,context]=vi.mocked(f.backend.start).mock.calls[0]!;expect(ticket.ticket).toBe('UI-PREPARED-NO-WORKER');expect(request).toEqual(startingOriginalRequestFromRoster256(PAWNS_UI_SEED,roster));expect(request.roster).toHaveLength(8);expect(request.selected).toHaveLength(3);expect(context.signal.aborted).toBe(false);expect(f.page).toBeUndefined();expect(f.sourceUnchanged()).toBe(true);
 });
});
