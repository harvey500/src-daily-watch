import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localDay, validateObservations, compareObservations, main } from './daily-state.mjs';

const observation = {
  program: 'Example', source: 'https://example.com/program', status: 'active',
  cash: 'USD 100', scope: 'Local deployment', restrictions: 'No production tests',
};

test('Shanghai date changes at 16:00 UTC', () => {
  assert.equal(localDay('2026-10-11T15:59:59Z'), '2026-10-11');
  assert.equal(localDay('2026-10-11T16:00:00Z'), '2026-10-12');
});

test('rejects empty, malformed and credential-bearing observations', () => {
  const credentialSource = new URL('https://example.com');
  credentialSource.username = 'EXAMPLE_USER';
  credentialSource.password = '<REDACTED>';
  for (const input of [[], [{}], [{ ...observation, source: credentialSource.href }], [observation, observation]]) {
    assert.throws(() => validateObservations(input));
  }
});

test('normalization ignores object key order and compares meaningful changes', () => {
  const old = validateObservations([observation]);
  const reordered = validateObservations([{ restrictions: observation.restrictions, ...observation }]);
  assert.deepEqual(compareObservations(old, reordered), { added: [], changed: [], removed: [] });
  assert.equal(compareObservations(old, validateObservations([{ ...observation, status: 'suspended' }])).changed.length, 1);
});

test('successful survey suppresses same day, not next day', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'src-watch-test-'));
  const state = join(directory, 'state.json');
  const observations = join(directory, 'observations.json');
  const args = ['--state', state, '--now', '2026-10-11T08:00:00Z'];
  assert.equal((await main(['status', ...args])).due, true);
  await writeFile(observations, JSON.stringify([observation]));
  assert.equal((await main(['complete', ...args, '--observations', observations])).baseline, true);
  assert.equal((await main(['status', ...args])).due, false);
  assert.equal((await main(['status', '--state', state, '--now', '2026-10-12T08:00:00Z'])).due, true);
  assert.equal((await main(['complete', ...args, '--observations', observations])).changes.changed.length, 0);
});

test('bad state is preserved and rejected', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'src-watch-test-'));
  const state = join(directory, 'state.json');
  const observations = join(directory, 'observations.json');
  await writeFile(state, '{broken');
  await writeFile(observations, JSON.stringify([observation]));
  await assert.rejects(main(['complete', '--state', state, '--observations', observations]));
  assert.equal(await readFile(state, 'utf8'), '{broken');
});
