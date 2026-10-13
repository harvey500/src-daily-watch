import { readFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const fields = ['program', 'source', 'status', 'cash', 'scope', 'restrictions'];

export function localDay(now, timezone = 'Asia/Shanghai') {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (name) => parts.find((part) => part.type === name).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function validateObservations(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('A completed survey needs nonempty verified observations');
  }
  const sources = new Set();
  return input.map((item) => {
    const observation = {};
    for (const field of fields) {
      if (typeof item?.[field] !== 'string' || !item[field].trim()) {
        throw new Error(`Missing observation field: ${field}`);
      }
      observation[field] = item[field].trim();
    }
    const url = new URL(observation.source);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Use an HTTPS public source without credentials');
    }
    observation.source = url.href;
    if (sources.has(url.href)) throw new Error('Duplicate observation source');
    sources.add(url.href);
    return observation;
  }).sort((a, b) => a.source.localeCompare(b.source));
}

export function compareObservations(previous, next) {
  const old = new Map(previous.map((item) => [item.source, item]));
  const current = new Set(next.map((item) => item.source));
  return {
    added: next.filter((item) => !old.has(item.source)),
    changed: next.filter((item) => old.has(item.source)
      && fields.some((field) => old.get(item.source)[field] !== item[field])),
    removed: previous.filter((item) => !current.has(item.source)),
  };
}

async function loadState(path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const state = JSON.parse(text);
  if (state.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(state.lastSuccessfulDay)
      || !Number.isFinite(Date.parse(state.checkedAt))) {
    throw new Error('Invalid state; refusing to overwrite');
  }
  state.observations = validateObservations(state.observations);
  return state;
}

export async function main(args) {
  const [command, ...options] = args;
  if (!['status', 'complete'].includes(command) || options.length % 2) {
    throw new Error('Usage: status|complete --state ABS_PATH [--observations ABS_PATH] [--timezone ZONE] [--now ISO_DATE]');
  }
  const values = new Map();
  for (let i = 0; i < options.length; i += 2) {
    const key = options[i];
    if (!['--state', '--observations', '--timezone', '--now'].includes(key) || values.has(key)) {
      throw new Error(`Unknown or duplicate option: ${key}`);
    }
    values.set(key, options[i + 1]);
  }
  const statePath = values.get('--state');
  if (!statePath || !isAbsolute(statePath)) throw new Error('State path must be absolute');
  const now = values.get('--now') ?? new Date().toISOString();
  const timezone = values.get('--timezone') ?? 'Asia/Shanghai';
  const today = localDay(now, timezone);
  if (command === 'status') {
    const state = await loadState(statePath);
    return { today, due: state?.lastSuccessfulDay !== today, lastSuccessfulDay: state?.lastSuccessfulDay ?? null };
  }
  const observationsPath = values.get('--observations');
  if (!observationsPath || !isAbsolute(observationsPath)) throw new Error('Observations path must be absolute');
  if (observationsPath === statePath) throw new Error('State and observations must be different files');
  const observations = validateObservations(JSON.parse(await readFile(observationsPath, 'utf8')));
  await mkdir(dirname(statePath), { recursive: true });
  // Serialize writers; never quietly replace malformed state or another writer's lock.
  const lockPath = `${statePath}.lock`;
  const lock = await open(lockPath, 'wx');
  const temp = `${statePath}.${randomUUID()}.tmp`;
  try {
    const previous = await loadState(statePath);
    const changes = compareObservations(previous?.observations ?? [], observations);
    const next = { version: 1, lastSuccessfulDay: today, checkedAt: new Date(now).toISOString(), timezone, observations };
    const handle = await open(temp, 'wx');
    try { await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    await rename(temp, statePath);
    return { today, baseline: previous === null, changes };
  } finally {
    await unlink(temp).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await lock.close();
    await unlink(lockPath);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
