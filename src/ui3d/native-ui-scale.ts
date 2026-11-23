/** One scale for the whole native interface, in RimWorld interface points
 * (`Text`, `GenUI`, `Window`, `Widgets`, `CharacterCardUtility`,
 * `InspectPaneUtility`). A point is a logical pixel; the player's interface
 * scale (`nativeUiScale`, Options) multiplies the whole stage once, as
 * RimWorld's `Prefs.UIScale` multiplies the whole screen. No window chooses its
 * own text size: every painter and layout reads a role from here, and
 * `tests/native-ui-scale-system.test.ts` fails on a literal font size in the
 * page builders, the layout or the stage painters.
 *
 * Measured against a capture of the real game (Bio card, 22-point lines):
 * Small ≈ Arial 14 px, cap height ≈ 10 points; Medium ≈ Arial 21 px. With
 * Elsewhere's default font (Comfortaa, wider and with a taller x-height), the
 * same x-height and cap height are reached at 13 and 20 px. */
export const NATIVE_TEXT={tiny:10,small:13,medium:20} as const;
export type NativeTextRole=keyof typeof NATIVE_TEXT;
/** Line heights reserved by RimWorld: `Text.SmallFontHeight` is 22; Tiny and
 * Medium are the rectangles the game reserves for them (18 and 30). */
export const NATIVE_LINE={tiny:18,small:22,medium:30} as const;
/** `GenUI` gaps. */
export const NATIVE_GAP={tiny:4,small:10,normal:17,wide:26,pad:10,label:22,list:28} as const;
/** `Window`/`Widgets` frame: standard margin, close button 18 with a margin of
 * 4, scroll bar 16, usual icon 24 (`GenUI.SmallIconSize`), common button 30. */
export const NATIVE_WINDOW={margin:18,close:18,closeMargin:4,scrollbar:16,icon:24,button:30,tab:30} as const;
/** `GenUI.DrawElementStack` chips: row height passed by the caller (22 for
 * text), 4 between rows, 5 between elements; label width + 10, text inset 5. */
export const NATIVE_CHIP={height:22,rowMargin:4,itemMargin:5,textPad:10,textInset:5} as const;
/** Colours by role. RimWorld's are drawn on a near-black window; Elsewhere keeps
 * its cream paper and brown ink, so each role keeps its meaning and contrast
 * rather than its RGB value (yellow section title → ochre ink, white 10 % chip
 * → a 10 % ink wash framed by a hand line, grey 0.5 « none » → faded ink). */
export const NATIVE_INK={
  text:'#3a2c1d',
  /** `ColoredText.TipSectionTitleColor` (0.9, 0.9, 0.3): ochre ink, darkened so
   * that it reads on the cream paper (every text role below keeps at least
   * 4.5:1 there, WCAG AA; `tests/native-tab-cards.test.ts`). */
  sectionTitle:'#5a3a00',
  /** `ColoredText.SubtleGrayColor` (0.6): help and secondary lines. */
  subtle:'#54493a',
  /** Grey 0.5: the « Aucun » of an empty section. */
  none:'#5a5040',
  /** Grey at 50 % (`SkillUI.DisabledSkillColor`) and disabled labels. */
  disabled:'#5f5545',
  /** Royal-title cause of an incapacity (0.67, 0.84, 0.9), unused in Core alone. */
  royal:'#2c5a72',
  /** Thoughts and moods (green 0.1, 1, 0.1 / pink 0.8, 0.4, 0.4). */
  positive:'#2a6326',
  negative:'#963529',
  /** Pain: medium (0.9, 0.9, 0) and severe (0.9, 0.5, 0). */
  painMedium:'#625600',
  painSevere:'#86470a',
  /** Health colours (`HealthUtility.GoodConditionColor`, `ColorLibrary.RedReadable`)
   * and the capacity estimates of `HealthCardUtility.efficiencyToColor`. */
  good:'#2a6326',
  red:'#963529',
  enhanced:'#38468f',
  /** The social tab's grey relation label (0.6) and opinion colours. */
  relation:'#54493a',
  /** `WidgetsWork` lines: separator labels (0.8 grey) and rules (0.3 grey). */
  line:'rgba(82,58,31,.45)',
  separator:'#54493a',
  /** `Widgets.FillableBar`: frame, track and the teal fill (0.2, 0.8, 0.85),
   * ticks, the instant marker and the change arrows (`Need.DrawOnGUI`). */
  barFrame:'#3a2c1d',barBack:'#d9ccb0',barFill:'#52a09e',tickPassed:'#2a2018',tickAhead:'#8f8369',marker:'#3a2c1d',arrow:'#3a2c1d',
  /** `Widgets.DrawMenuSection` and buttons. */
  panelFill:'rgba(82,58,31,.06)',panelEdge:'rgba(82,58,31,.5)',buttonFill:'#eadcb9',buttonActive:'#d6c496',buttonEdge:'rgba(82,58,31,.7)',
  /** Scroll bar track and thumb (`Widgets.BeginScrollView`). */
  scrollTrack:'rgba(82,58,31,.14)',scrollThumb:'rgba(82,58,31,.5)',
  /** Alternate row bands of lists (`TexUI.HighlightTex` at low alpha). */
  rowAlt:'rgba(82,58,31,.07)',
  /** `StackElementBackground` (white 10 %) and its frame on paper. */
  chipFill:'rgba(82,58,31,.10)',
  chipEdge:'rgba(82,58,31,.42)',
  /** `TexUI.HighlightTex` (white 10 %): hover over a row or chip. */
  highlight:'rgba(176,122,40,.16)',
  highlightPlane:'#b07a28',
  /** `SkillUI` bar fill (white 10 %, no frame, no background). */
  skillFill:'rgba(82,58,31,.16)',
  /** Inspect pane gauges (`InspectPaneFiller`): fills on a dark background. */
  gaugeBack:'#d8c7a6',
  gaugeHealth:'#bdb39c',
  gaugeMood:'#9fc4bc',
  gaugeHunger:'#b89c5a',
} as const;
/** The canvas font of a role in the current family. */
export function nativeFont(role:NativeTextRole,family:string,bold=false):string{return `${bold?'bold ':''}${NATIVE_TEXT[role]}px ${family}`;}
