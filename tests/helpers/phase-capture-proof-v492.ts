// Test-only module-load observation, isolated to the Phase project.
type Row=Readonly<{role:'candidate'|'before'|'qualified';path:string;sha256:string}>;
const rows:Row[]=[];
export function recordPhaseCaptureSource492(value:Row):void{rows.push(Object.freeze({...value}));}
export function sourceObservations():Row[]{return rows.slice();}
