import {SCHEMA_VERSION} from './types.ts';

/* Numeric schema ranges.
 *
 * A capability introduced in schema N stays available in every later schema
 * up to the current SCHEMA_VERSION. Before, each predicate enumerated its
 * versions as literals (value===263||...||value===301) and every schema bump
 * had to edit dozens of predicates by hand. Runtime and types now follow
 * SCHEMA_VERSION automatically; only integers in [N, SCHEMA_VERSION] match,
 * exactly like the former closed literal lists. */
type Enumerate<N extends number,Acc extends number[]=[]>=Acc['length'] extends N?Acc[number]:Enumerate<N,[...Acc,Acc['length']]>;
export type CurrentSchema=typeof SCHEMA_VERSION;
/** The literal union N | N+1 | ... | SCHEMA_VERSION. */
export type SchemaAtLeast<N extends number>=Exclude<Enumerate<CurrentSchema>|CurrentSchema,Enumerate<N>>;
export const schemaAtLeast=<N extends number>(minimum:N)=>(value:unknown):value is SchemaAtLeast<N>=>
 typeof value==='number'&&Number.isInteger(value)&&value>=minimum&&value<=SCHEMA_VERSION;
