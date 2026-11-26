import { mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Historical artifacts are immutable inputs; current test evidence goes to tmp. */
const defaultRun = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
function testRunName():string {
  const run = process.env.LISIERE_TEST_RUN ?? defaultRun;
  if (!/^[A-Za-z0-9._-]+$/.test(run) || run === '.' || run === '..') throw new Error('Invalid LISIERE_TEST_RUN directory name');
  return run;
}
export function testOutputPath(file: string): string;
export function testOutputPath(file: string | Buffer | URL): string | Buffer | URL;
export function testOutputPath(file: Parameters<typeof writeFileSync>[0]): Parameters<typeof writeFileSync>[0];
export function testOutputPath(file: Parameters<typeof writeFileSync>[0]): Parameters<typeof writeFileSync>[0] {
  if (typeof file === 'number') return file;
  const name = file instanceof URL ? fileURLToPath(file) : String(file);
  const archive = path.resolve(process.cwd(), 'artifacts');
  const absolute = path.resolve(name);
  const relative = path.relative(archive, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const tmp = path.resolve(process.cwd(), 'tmp');
    const insideTmp = path.relative(tmp, absolute);
    if (insideTmp !== '..' && !insideTmp.startsWith(`..${path.sep}`) && !path.isAbsolute(insideTmp)) {
      // Opt-in for full campaigns with historical fixed checkpoint names.
      // The input checkpoint paths are unchanged; only new evidence writes
      // go to this run's folder so a new qualification cannot overwrite them.
      if(process.env.LISIERE_TEST_SCOPE_TMP==='1'&&insideTmp&&!insideTmp.startsWith(`test-runs${path.sep}`)){
        const scoped=path.resolve(tmp,'test-runs',testRunName(),'tmp',insideTmp);
        mkdirSync(path.dirname(scoped),{recursive:true});return scoped;
      }
      mkdirSync(path.dirname(absolute), { recursive: true });
    }
    return file;
  }
  const run = testRunName();
  const output = path.resolve(process.cwd(), 'tmp', 'test-runs', run, 'artifacts', relative);
  mkdirSync(path.dirname(output), { recursive: true });
  return output;
}

export function testOutputDirectory(directory: string): string {
  const output = path.dirname(testOutputPath(path.join(directory, '.directory')) as string);
  mkdirSync(output, { recursive: true });
  return output;
}

export const writeTestFileSync: typeof writeFileSync = (file, data, options) =>
  writeFileSync(testOutputPath(file), data, options);

export const writeTestFile: typeof writeFile = (file, data, options) =>
  writeFile(typeof file === 'string' || Buffer.isBuffer(file) || file instanceof URL ? testOutputPath(file) : file, data, options);
