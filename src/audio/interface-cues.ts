/* Interface cues (audio coverage of 22 November 2026). Presentation only:
 * these mappings read commands, letters, alerts and UI state already present
 * on the main thread; nothing here is saved or enters the simulation. The Core
 * names in comments are the SoundDefs Core plays for the same moment (UI_*,
 * LetterDefs, MessageTypeDefs); Elsewhere's takes are its own recordings. */

export type InterfaceCueKind =
  | 'ui.click' | 'ui.reject' | 'ui.panel' | 'ui.threat' | 'ui.colonist-death'
  | 'ui.colonist-downed' | 'ui.research-complete'
  | 'letter.threat-big' | 'letter.threat-small' | 'letter.negative' | 'letter.neutral' | 'letter.positive'
  | 'alert.high' | 'alert.critical'
  | 'ui.tab-open' | 'ui.tab-close' | 'ui.toggle-on' | 'ui.toggle-off'
  | 'ui.clock-pause' | 'ui.clock-run' | 'ui.tool-select'
  | 'ui.designate' | 'ui.designate-zone' | 'ui.designate-cancel' | 'ui.place-building'
  | 'ui.draft-on' | 'ui.draft-off' | 'ui.order' | 'ui.select'
  | 'ui.trade-open' | 'ui.trade-execute'
  | 'tutorial.lesson-appear' | 'tutorial.lesson-complete' | 'quest.accepted';

/** Interface cues the Worker's recorder emits from confirmed World changes.
 * They play on the interface output, paused or not, under the SFX setting. */
export const WORLD_INTERFACE_CUES: ReadonlySet<string> = new Set([
  'ui.threat', 'ui.colonist-death', 'ui.colonist-downed', 'ui.research-complete',
]);
export const isWorldInterfaceCue = (kind: string): boolean => WORLD_INTERFACE_CUES.has(kind);

/** Burst control per cue: minimum spacing between two starts (seconds of
 * audio-clock time) and at most `voices` sounding at once. Gesture feedback
 * (clicks, tabs, speed) follows the player's hand, so it has no spacing;
 * event-driven notifications collapse a burst into one sound, as Core's
 * Alert.Notify_Started bell (once per 0.5 s) and one LetterArrive per frame. */
export interface InterfaceBurstRule { spacing: number; voices: number }
const GESTURE: InterfaceBurstRule = { spacing: 0, voices: 3 };
const EVENT: InterfaceBurstRule = { spacing: 0.5, voices: 1 };
export const MAX_INTERFACE_VOICES = 6;
export function interfaceBurstRule(kind: string): InterfaceBurstRule {
  if (kind.startsWith('letter.') || kind.startsWith('alert.') || kind.startsWith('tutorial.')) return EVENT;
  if (kind === 'ui.threat' || kind === 'ui.colonist-death' || kind === 'ui.colonist-downed'
    || kind === 'ui.research-complete') return { spacing: 0.35, voices: 2 };
  return GESTURE;
}

/** Letter classes of schema 352 (Core LetterDef.arriveSound): one sound per
 * arriving batch, the most urgent class. NewQuest is a PositiveEvent child in
 * Core (LetterArrive_Good); a death letter adds nothing to the colonist death
 * cue already played by the recorder. */
const LETTER_ORDER = ['threat-big', 'threat-small', 'negative', 'new-quest', 'positive', 'neutral'] as const;
export function letterCue(classes: readonly string[]): InterfaceCueKind | undefined {
  const cls = LETTER_ORDER.find(c => classes.includes(c));
  if (!cls) return undefined;
  return cls === 'new-quest' ? 'letter.positive' : `letter.${cls}`;
}

/** Core Alert.Notify_Started: the TinyBell for High and Critical alerts, at
 * most once per half second (the HUD's `bell`). Elsewhere gives Critical its
 * own double bell. Medium alerts are silent, as in Core. */
export function alertCue(started: { priority: string; bell: boolean }): InterfaceCueKind | undefined {
  if (!started.bell) return undefined;
  return started.priority === 'critical' ? 'alert.critical' : started.priority === 'high' ? 'alert.high' : undefined;
}

/** Core TimeControls: Clock_Stop, Clock_Normal, Clock_Fast, Clock_Superfast.
 * Elsewhere plays one winding take at a rate rising with the speed. */
export function clockCue(speed: number): { kind: InterfaceCueKind; pitch: number } {
  if (speed <= 0) return { kind: 'ui.clock-pause', pitch: 1 };
  return { kind: 'ui.clock-run', pitch: speed >= 6 ? 1.26 : speed >= 3 ? 1.12 : 1 };
}

const ZONE_ACTIONS = new Set(['stockpile', 'growing', 'home', 'snow-clear', 'build-roof', 'ignore-roof']);
const PLACE_ACTIONS = new Set(['lay-floor', 'build-bridge']);
/** Core Designator soundSucceeded: Designate_ZoneAdd* for areas,
 * Designate_PlaceBuilding for blueprints, Designate_Cancel/ZoneDelete for
 * removals, the order designators' own sounds for the rest. */
export function areaActionCue(action: string): InterfaceCueKind {
  if (action === 'cancel' || action.startsWith('remove-')) return 'ui.designate-cancel';
  if (ZONE_ACTIONS.has(action)) return 'ui.designate-zone';
  if (PLACE_ACTIONS.has(action)) return 'ui.place-building';
  return 'ui.designate';
}

/** Designation kinds that mark an order on something existing; every other
 * designated kind places a blueprint (Designate_PlaceBuilding). */
const ORDER_DESIGNATIONS = new Set(['smooth-floor', 'extract-tree', 'replant-tree', 'mine', 'chop', 'harvest', 'cut',
  'sow', 'deconstruct', 'uninstall', 'remove-roof', 'remove-floor', 'remove-bridge', 'flick', 'repair', 'fix-breakdown']);

function affected(result: string | undefined): number | undefined {
  if (!result) return undefined;
  try {
    const parsed = JSON.parse(result) as { affected?: unknown };
    return typeof parsed?.affected === 'number' ? parsed.affected : undefined;
  } catch { return undefined; }
}

/** The sound of a command the simulation accepted (a refusal throws and keeps
 * `ui.reject`). Core: designators, DraftOn/DraftOff, ColonistOrdered,
 * ExecuteTrade, Quest_Accepted. `undefined`: no dedicated sound. */
export function commandCue(command: { type: string } & Record<string, unknown>, result?: string): InterfaceCueKind | undefined {
  switch (command.type) {
    case 'area': {
      if (affected(result) === 0) return undefined;
      return areaActionCue(String(command.action));
    }
    case 'build-line': return affected(result) === 0 ? undefined : 'ui.place-building';
    case 'designate': return ORDER_DESIGNATIONS.has(String(command.kind)) ? 'ui.designate' : 'ui.place-building';
    case 'install': return 'ui.place-building';
    case 'cancel': case 'delete-zone': case 'allowed-area-delete': return 'ui.designate-cancel';
    case 'hunt': case 'tame': case 'slaughter': return 'ui.designate';
    case 'allowed-area-paint': return 'ui.designate-zone';
    case 'draft': return command.enabled ? 'ui.draft-on' : 'ui.draft-off';
    case 'draft-move': case 'job': case 'shoot': case 'melee': return 'ui.order';
    case 'trade-execute': case 'orbital-trade-execute': return 'ui.trade-execute';
    case 'answer-quest': return command.accept ? 'quest.accepted' : undefined;
    default: return command.type.startsWith('order-') ? 'ui.order' : undefined;
  }
}

/** Generic activation of a native control or HUD piece (Core Widgets click,
 * TabOpen/TabClose of the main tabs and windows). Speed buttons are silent
 * here: the speed change plays its clock cue. `undefined`: silent. */
export function nativeActivationCue(id: string, state: { panel?: string | null; palette?: string }): InterfaceCueKind | undefined {
  if (id.startsWith('hud:speed:')) return undefined;
  if (id.startsWith('tab:')) return state.panel === id.slice(4) ? 'ui.tab-close' : 'ui.tab-open';
  if (id.startsWith('map-dock:')) return state.palette === id.slice(9) ? 'ui.tab-close' : 'ui.tab-open';
  if (id === 'page:close' || id === 'page:cancel' || id.includes('back')) return 'ui.tab-close';
  return 'ui.click';
}

/** Tutorial card (schema 349): Core Lesson_Instruction.PostDeactivated closes
 * the lesson with a sound and the next card appears (TutorMessageAppear for a
 * note). A completed lesson followed at once by the next one plays only the
 * completion; a card appearing from nothing plays its arrival. */
export function tutorialLessonCue(previous: string | undefined, next: string | undefined): InterfaceCueKind | undefined {
  if (previous === next) return undefined;
  return previous !== undefined ? 'tutorial.lesson-complete' : 'tutorial.lesson-appear';
}
