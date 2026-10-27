/**
 * Host half of the Command Centre bundle.
 *
 * Two jobs only (V1b):
 *   1. one small session projection `missionControl` — last assistant text,
 *      last tool, turn outcome and the files a turn wrote; folded from the
 *      session log so the Client never replays history;
 *   2. one authenticated same-origin route so the Client can keep the canvas
 *      layout across restarts (the Web UI origin changes per launch, so a
 *      localStorage key alone cannot survive a restart).
 *
 * Both stay small: the projection travels in every Client's control baseline.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const name = 'missionControl';
export const inject = ['sessionProjections', 'connection'];

const PREFS_PATH = join(homedir(), '.dsh', 'command-centre', 'canvas.json');
const PREFS_ROUTE = '/api/command-centre.prefs';
const PREFS_LIMIT = 16 * 1024;
const TEXT_LIMIT = 200;
const FILE_LIMIT = 5;
const WRITE_TOOLS = new Set(['write', 'edit']);
const FAILED_KINDS = new Set(['error', 'blocked', 'max-tokens']);

/** Minimal schema face: the registry validates versions, not our JSON shapes. */
const passthroughSchema = { parse: (value) => value, safeParse: (value) => ({ success: true, data: value }) };

/** Empty projection state; every field stays JSON-serializable and small. */
function emptyState() {
  return { text: '', tool: '', toolError: '', turn: 0, reason: '', files: [], fileCount: 0 };
}

function truncate(value, limit) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
}

function textOf(message) {
  const blocks = message && Array.isArray(message.content) ? message.content : [];
  const parts = [];
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('\n');
}

function fileOfArguments(name, rawArguments) {
  if (!WRITE_TOOLS.has(name) || typeof rawArguments !== 'string') return undefined;
  try {
    const parsed = JSON.parse(rawArguments);
    const candidate = parsed && (parsed.file_path || parsed.filePath || parsed.path);
    return typeof candidate === 'string' && candidate !== '' ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/** Fold one committed session event; unrelated events return the same reference. */
function applyEvent(state, event) {
  if (!event || typeof event.type !== 'string') return state;
  switch (event.type) {
    case 'assistant/message': {
      const text = truncate(textOf(event.data && event.data.message), TEXT_LIMIT);
      if (text === '' || text === state.text) return state;
      return { ...state, text };
    }
    case 'tool/call': {
      const callName = event.data && typeof event.data.name === 'string' ? event.data.name : '';
      const file = fileOfArguments(callName, event.data && event.data.arguments);
      const tool = truncate(callName, 80);
      if (!file) {
        if (tool === state.tool) return state;
        return { ...state, tool };
      }
      const files = state.files.filter((entry) => entry !== file);
      files.push(file);
      return {
        ...state,
        tool,
        files: files.slice(-FILE_LIMIT),
        fileCount: state.fileCount + 1,
      };
    }
    case 'tool/result': {
      const error = event.data && event.data.error;
      const next = error ? truncate(error.code || error.name || 'error', 80) : '';
      return next === state.toolError ? state : { ...state, toolError: next };
    }
    case 'turn/start': {
      const turn = event.data && Number.isInteger(event.data.turn) ? event.data.turn : state.turn;
      return turn === state.turn ? state : { ...state, turn };
    }
    case 'turn/end': {
      const turn = event.data && Number.isInteger(event.data.turn) ? event.data.turn : state.turn;
      const kind = event.data && event.data.reason && typeof event.data.reason.kind === 'string' ? event.data.reason.kind : '';
      if (turn === state.turn && kind === state.reason) return state;
      return { ...state, turn, reason: truncate(kind, 40) };
    }
    default:
      return state;
  }
}

const definition = {
  key: 'missionControl',
  stateSchema: passthroughSchema,
  stateVersion: 1,
  init: () => emptyState(),
  apply: applyEvent,
  wire: {
    viewSchema: passthroughSchema,
    view: (state) => state,
  },
};

async function readPrefs() {
  try {
    const raw = await readFile(PREFS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writePrefs(body) {
  const serialized = JSON.stringify(body ?? {});
  if (Buffer.byteLength(serialized, 'utf8') > PREFS_LIMIT) throw new Error('prefs too large');
  await mkdir(dirname(PREFS_PATH), { recursive: true });
  const temporary = `${PREFS_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, serialized, 'utf8');
  await rename(temporary, PREFS_PATH);
}

async function handlePrefs(rawRequest) {
  const noStore = { 'cache-control': 'no-store' };
  let request;
  try {
    request = rawRequest instanceof Request ? rawRequest : new Request(rawRequest);
  } catch {
    return Response.json({ ok: false, error: 'invalid-request' }, { status: 400, headers: noStore });
  }
  if (request.method === 'GET') {
    return Response.json(await readPrefs(), { headers: noStore });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid-json' }, { status: 400, headers: noStore });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ ok: false, error: 'invalid-body' }, { status: 400, headers: noStore });
  }
  try {
    await writePrefs(body);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return Response.json({ ok: false, error: String(error && error.message ? error.message : error) }, { status: 400, headers: noStore });
  }
}

function warn(message, error) {
  try {
    console.warn(`[command-centre] ${message}:`, error && error.message ? error.message : error);
  } catch {
    /* console may be unavailable in a stripped build */
  }
}

export function apply(ctx) {
  // Each contribution is optional on its own: a rejected projection or route must
  // never take the whole bundle (and with it the panel) down.
  ctx.effect(() => {
    try {
      return ctx.sessionProjections.register(definition);
    } catch (error) {
      warn('projection registration failed', error);
      return () => {};
    }
  }, 'command-centre: missionControl projection');

  ctx.effect(() => {
    try {
      return ctx.connection.fetch.register({
        path: PREFS_ROUTE,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: (request) => handlePrefs(request),
      });
    } catch (error) {
      warn('canvas prefs route registration failed', error);
      return () => {};
    }
  }, 'command-centre: canvas prefs route');
}
