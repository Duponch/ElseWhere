import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { testOutputPath, writeTestFile, writeTestFileSync } from './test-output.ts';

test('current test evidence stays under tmp and never overwrites historical artifacts', async () => {
  const relative = 'artifacts/__test-output-probe__.txt';
  const archived = path.resolve(relative);
  expect(existsSync(archived)).toBe(false);
  const output = testOutputPath(relative);
  expect(testOutputPath(archived)).toBe(output);
  expect(testOutputPath(pathToFileURL(archived))).toBe(output);
  expect(output).toContain(path.join('tmp', 'test-runs'));
  expect(testOutputPath('artifacts-other/probe.txt')).toBe('artifacts-other/probe.txt');
  writeTestFileSync(relative, 'sync');
  expect(readFileSync(output, 'utf8')).toBe('sync');
  await writeTestFile(relative, 'async');
  expect(readFileSync(output, 'utf8')).toBe('async');
  expect(existsSync(archived)).toBe(false);
  const nested = 'tmp/test-runs/test-output-nested/probe.txt';
  writeTestFileSync(nested, 'tmp');
  expect(readFileSync(nested, 'utf8')).toBe('tmp');
});

test.each(['.', '..', '../escape', 'C:\\outside'])('invalid run name %s cannot redirect writes outside tmp', run => {
  const previous = process.env.LISIERE_TEST_RUN;
  try {
    process.env.LISIERE_TEST_RUN = run;
    expect(() => testOutputPath('artifacts/__test-output-invalid__.txt')).toThrow('Invalid LISIERE_TEST_RUN');
  } finally {
    if (previous === undefined) delete process.env.LISIERE_TEST_RUN;
    else process.env.LISIERE_TEST_RUN = previous;
  }
});

test('opt-in campaign checkpoints are scoped to the run, but already scoped paths are unchanged', () => {
  const previousRun = process.env.LISIERE_TEST_RUN;
  const previousScope = process.env.LISIERE_TEST_SCOPE_TMP;
  const checkpoint = path.join('tmp', '__checkpoint-scope-probe__.json');
  const output = path.resolve('tmp', 'test-runs', 'checkpoint-scope-probe', checkpoint);
  try {
    process.env.LISIERE_TEST_RUN = 'checkpoint-scope-probe';
    process.env.LISIERE_TEST_SCOPE_TMP = '1';
    expect(testOutputPath(checkpoint)).toBe(output);
    expect(testOutputPath(path.resolve(checkpoint))).toBe(output);
    expect(testOutputPath(pathToFileURL(path.resolve(checkpoint)))).toBe(output);
    expect(testOutputPath(output)).toBe(output);
    writeTestFileSync(checkpoint, 'new campaign output');
    expect(readFileSync(output, 'utf8')).toBe('new campaign output');
    expect(existsSync(checkpoint)).toBe(false);
    process.env.LISIERE_TEST_RUN = '../escape';
    expect(() => testOutputPath(checkpoint)).toThrow('Invalid LISIERE_TEST_RUN');
    delete process.env.LISIERE_TEST_SCOPE_TMP;
    expect(testOutputPath(checkpoint)).toBe(checkpoint);
  } finally {
    if (previousRun === undefined) delete process.env.LISIERE_TEST_RUN;
    else process.env.LISIERE_TEST_RUN = previousRun;
    if (previousScope === undefined) delete process.env.LISIERE_TEST_SCOPE_TMP;
    else process.env.LISIERE_TEST_SCOPE_TMP = previousScope;
  }
});
