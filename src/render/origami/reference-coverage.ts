import type {ReferencePaintDescriptor} from './reference-paint-library';

/** Paper and mask are independent of RGB, but the mask starts after all paint
 * strokes have consumed their RNG. Keep every branch that changes that stream
 * in the key. Presence of secondary/accent colors matters; their values do not.
 * A collection belongs to one global fill setting/bake generation: changing
 * fill must rebake its existing slots, not append historical generations. */
export function referenceCoverageKey(descriptor:ReferencePaintDescriptor):string {
 const {config,seed,sourceIndex}=descriptor,strokeCount=config.strokeCount??340;
 if(!Number.isSafeInteger(seed)||!Number.isFinite(strokeCount))throw new Error('Origami coverage requires an exact integer seed and finite stroke count');
 if(sourceIndex!==undefined&&(!Number.isSafeInteger(sourceIndex)||sourceIndex<0))throw new Error('Origami coverage source index must be a nonnegative integer');
 return JSON.stringify(['reference-coverage-v1',sourceIndex??null,seed,
  config.strokeStyle??'fur',strokeCount,Boolean(config.secondaryColor),Boolean(config.accentColor),
  Boolean(config.gradientTip),Boolean(config.flankStripe),config.kraftEdgeWear??true]);
}
