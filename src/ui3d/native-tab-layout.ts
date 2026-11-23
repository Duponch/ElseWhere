import type {CardMeasure,NativeTabCard} from './native-tab-card';
import {layoutNeedsTab,type NeedsSpec} from './native-tab-needs';
import {layoutHealthTab,type HealthSpec} from './native-tab-health';
import {layoutGearTab,type GearSpec} from './native-tab-gear';
import {layoutSocialTab,layoutLogTab,type SocialSpec,type LogSpec} from './native-tab-social';
import {layoutPrisonerTab,type PrisonerSpec} from './native-tab-prisoner';

/** The data of one inspector tab's card (see `native-tab-card.ts`): pure
 * values and controls, laid out once with the stage's text measure. */
export type NativeTabSpec=NeedsSpec|HealthSpec|GearSpec|SocialSpec|LogSpec|PrisonerSpec;
export function layoutNativeTab(spec:NativeTabSpec,measure:CardMeasure):NativeTabCard{
  switch(spec.type){
    case 'needs':return layoutNeedsTab(spec,measure);
    case 'health':return layoutHealthTab(spec,measure);
    case 'gear':return layoutGearTab(spec,measure);
    case 'social':return layoutSocialTab(spec,measure);
    case 'log':return layoutLogTab(spec,measure);
    case 'prisoner':return layoutPrisonerTab(spec,measure);
  }
}
