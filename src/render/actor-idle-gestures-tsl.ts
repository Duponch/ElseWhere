import {float,sin} from 'three/tsl';
import type * as THREE from 'three/webgpu';
import type {GestureExpr,GestureOps} from './actor-idle-gestures';

/** TSL instantiation of the shared gesture formulas (actor-idle-gestures.ts).
 * TSL nodes already provide add/sub/mul/mod/clamp/min/max and the boolean
 * comparisons; only literals and sine are supplied here. */
export const TSL_GESTURE_OPS:GestureOps={lit:value=>float(value) as unknown as GestureExpr,sin:x=>sin(x as unknown as THREE.Node<'float'>) as unknown as GestureExpr};
export const gestureNode=(node:unknown):GestureExpr=>node as GestureExpr;
export const tslNode=(expr:GestureExpr):THREE.Node<'float'>=>expr as unknown as THREE.Node<'float'>;
export const tslBool=(expr:GestureExpr):THREE.Node<'bool'>=>expr as unknown as THREE.Node<'bool'>;
