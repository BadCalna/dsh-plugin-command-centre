/**
 * Offline smoke test for the Mission Control client half.
 *
 * This is a logic check only: it stubs React (no DOM, no rendering engine) and
 * exercises the factory, apply(), the data shaping and a full component render
 * tree so a runtime error cannot reach the user's install. It is NOT visual
 * verification.
 */
const fs = require('fs');
const path = require('path');

const PLUGIN = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(PLUGIN, 'client.js'), 'utf8');

let hookIndex = 0;
let hookState = [];

function resetHooks() {
  hookIndex = 0;
}

const React = {
  createElement(type, props, ...children) {
    const flat = [];
    for (const child of children) {
      if (Array.isArray(child)) flat.push(...child.flat(Infinity));
      else flat.push(child);
    }
    const propsOut = Object.assign({}, props || {});
    if (flat.length > 0) propsOut.children = flat.length === 1 ? flat[0] : flat;
    return { type, props: propsOut, children: flat };
  },
  Fragment: Symbol.for('react.fragment'),
  useState(init) {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = typeof init === 'function' ? init() : init;
    const set = (value) => {
      hookState[index] = typeof value === 'function' ? value(hookState[index]) : value;
    };
    return [hookState[index], set];
  },
  useEffect() {
    hookIndex += 1;
  },
  useMemo(fn) {
    hookIndex += 1;
    return fn();
  },
  useRef(init) {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = { current: init };
    return hookState[index];
  },
  useCallback(fn) {
    hookIndex += 1;
    return fn;
  },
};

Object.assign(React, {
  Component: class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
  },
});

const loaded = [];
const windowStub = {
  __ModuleLoader__: {
    load(definition) {
      loaded.push(definition);
    },
  },
};

// One frame queue so the canvas' subtree-drag springs can be stepped by hand.
const frames = [];
const sandbox = {
  window: windowStub,
  console, Date, Math, JSON, Set, Map, Object, String, Number, Array, Promise, Symbol,
  requestAnimationFrame: (callback) => {
    frames.push(callback);
    return frames.length;
  },
  cancelAnimationFrame: () => {},
};
sandbox.globalThis = sandbox;
require('vm').createContext(sandbox);
require('vm').runInContext(source, sandbox, { filename: 'client.js' });

/** Run queued animation frames at a steady 16ms until nothing is scheduled. */
function flushFrames(limit = 300) {
  let elapsed = 0;
  let count = 0;
  while (frames.length > 0 && count < limit) {
    const batch = frames.splice(0, frames.length);
    elapsed += 16;
    for (const callback of batch) callback(elapsed);
    count += 1;
  }
  return count;
}

const fakeEvent = { stopPropagation() {}, preventDefault() {} };

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

assert(loaded.length === 1, 'exactly one module factory registered');
const definition = loaded[0];
assert(definition.id === require('../package.json').name, 'module id equals the package name');
assert(typeof definition.factory === 'function', 'factory is a function');

const plugin = definition.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unexpected require: ${name}`);
});

assert(Array.isArray(plugin.inject), 'plugin inject is an array');
assert(!plugin.inject.includes('@deepseek-ai/dsh-client-ui-primitives'), 'no host client package injected');
assert(plugin.inject.includes('slots') && plugin.inject.includes('layout') && plugin.inject.includes('locale'), 'core services injected');
assert(plugin.inject.includes('sessions') && plugin.inject.includes('shortcuts'), 'session + shortcut services injected');

const registered = [];
const injectedSlots = [];
let dictionaries = null;
const delivered = [];
const panelSelections = [];
const registeredShortcuts = [];
const openedPaths = [];
const injectedDeps = [];
const ctx = {
  effect(fn) {
    const disposer = fn();
    return typeof disposer === 'function' ? disposer : () => {};
  },
  locale: {
    register(ns, dicts) {
      dictionaries = { ns, dicts };
      return () => {};
    },
    bind() {
      return (key) => flatLookup(dictionaries.dicts.zh, String(key));
    },
  },
  slots: {
    inject(key, callback) {
      injectedSlots.push(key);
      callback();
      return () => {};
    },
    register(options, component) {
      registered.push({ options, component });
      return () => {};
    },
  },
  sessions: {
    refreshProjections: () => Promise.resolve(),
    using: async (_id, _options, callback) =>
      callback({
        binding: {
          session: {
            rename: async (title) => ({ ok: true, value: { title, seq: 9 } }),
            getSnapshot: () => ({ openState: 'open' }),
            prompt: async () => ({ ok: true, value: { accepted: true } }),
          },
          eventSource: {
            getSnapshot: () => ({
              entries: [
                { type: 'event', event: { type: 'turn/start', seq: 1, time: 1, data: { turn: 3 } } },
                { type: 'event', event: { type: 'tool/call', seq: 2, time: 2, data: { turn: 3, step: 1, callId: 'c1', name: 'write', arguments: '{"file_path":"/w/deck.mjs"}' } } },
                { type: 'event', event: { type: 'assistant/message', seq: 3, time: 3, data: { turn: 3, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '第 7 页改好了' }] } } } },
                { type: 'event', event: { type: 'deliverables/presented', seq: 4, time: 4, data: { turn: 3, files: [{ path: '/w/输出/deck.pptx' }] } } },
              ],
            }),
          },
        },
      }),
  },
  inject: (deps, callback) => {
    injectedDeps.push(Array.isArray(deps) ? deps.join(',') : String(deps));
    return callback({
      remote: {
        workspaceFiles: {
          read: async (_sessionId, path) =>
            path.includes('missing')
              ? { ok: false, error: { code: 'FS_NOT_FOUND', message: 'FS_NOT_FOUND' } }
              : { ok: true, value: { text: 'preview', lines: ['preview'], eof: true } },
          readBytes: async () => ({ ok: true, value: { data: [137, 80, 78, 71], eof: true } }),
          stat: async (_sessionId, path) => ({ ok: true, value: { absolutePath: `/abs${path.startsWith('/') ? path : `/${path}`}` } }),
        },
        session: {
          openWorkspacePath: async (request) => {
            openedPaths.push(request.path);
            return { ok: true, value: { opened: true } };
          },
        },
      },
    });
  },
  layout: {
    panelInfo: { getSnapshot: () => ({ activePanelId: null }) },
    selectPanel: (id) => panelSelections.push(id),
  },
  shortcuts: {
    register: (command) => {
      registeredShortcuts.push(command);
      return () => {};
    },
  },
  get: () => undefined,
};

plugin.apply(ctx);

assert(injectedSlots.includes('main'), 'main slot injected');
assert(injectedDeps.includes('remote.workspaceFiles'), 'the workspace-files Remote namespace is declared (not just remote)');
assert(injectedDeps.includes('remote.session'), 'the session Remote namespace is declared for open-on-desktop');
assert(injectedSlots.includes('sidebar.panellist'), 'sidebar.panellist slot injected');
assert(dictionaries && dictionaries.ns === 'missionControl', 'locale dictionary registered');
assert(dictionaries.dicts.zh && dictionaries.dicts.en, 'zh + en dictionaries present');
const zhFlat = dictionaries.dicts.zh;
const enFlat = dictionaries.dicts.en;
assert(zhFlat['kind.approval'] === '待批准', 'dotted key flattened for zh');
assert(enFlat['kind.approval'] === 'Needs approval', 'dotted key flattened for en');
assert(!Object.values(zhFlat).some((value) => typeof value === 'object'), 'every zh dictionary value is a flat string');
assert(!Object.values(enFlat).some((value) => typeof value === 'object'), 'every en dictionary value is a flat string');
const dynamicKeys = [
  'kind.approval', 'kind.plan-review', 'kind.question',
  'status.running', 'status.needs', 'status.idle', 'status.done',
  'group.needs', 'group.running', 'group.idle',
  'groupEmpty.needs', 'groupEmpty.running', 'groupEmpty.idle',
  'filter.all', 'filter.active', 'filter.needs',
  'count.running', 'count.needs', 'count.idle', 'count.child',
  'column.task', 'column.chain', 'column.progress', 'column.context', 'column.activity', 'column.output',
  'drawer.goalPhase.active', 'drawer.goalPhase.paused', 'drawer.goalPhase.blocked', 'drawer.goalPhase.complete',
  'drawer.taskStatus.pending', 'drawer.taskStatus.in_progress', 'drawer.taskStatus.completed', 'drawer.taskStatus.deleted',
];
for (const key of dynamicKeys) {
  assert(zhFlat[key] !== undefined, `zh dictionary has dynamic key ${key}`);
  assert(enFlat[key] !== undefined, `en dictionary has dynamic key ${key}`);
}
const literalKeys = new Set();
for (const match of source.matchAll(/\bt\('([A-Za-z][\w.]*)'\)/g)) literalKeys.add(match[1]);
const missing = [...literalKeys].filter((key) => zhFlat[key] === undefined || enFlat[key] === undefined);
assert(missing.length === 0, `literal locale keys missing: ${missing.join(', ')}`);

const main = registered.find((entry) => entry.options.name === 'main');
const entry = registered.find((entry) => entry.options.name === 'sidebar.panellist');
assert(main && main.options.key === 'mission', 'main registered with key "mission"');
assert(entry && entry.options.id === 'mission', 'sidebar.panellist id equals main key');
assert(entry.options.label() === dictionaries.dicts.zh.panel, 'sidebar label resolves through locale');
assert(main.options.inject().openSession && main.options.inject().refreshProjections, 'business props injected');

assert(registeredShortcuts.length === 1, 'one global shortcut registered');
const shortcut = registeredShortcuts[0];
assert(shortcut.id === 'mission.open', 'shortcut id');
assert(shortcut.defaults['desktop:macos'].code === 'KeyP', 'desktop shortcut is cmd+shift+P');
assert(shortcut.defaults['desktop:macos'].modifiers.includes('primary') && shortcut.defaults['desktop:macos'].modifiers.includes('shift'), 'cmd+shift+P avoids the sidebar-files cmd+P');
assert(!shortcut.defaults['desktop:macos'].modifiers.includes('alt'), 'desktop keeps a two-modifier binding');
const decision = shortcut.resolve({ modal: null });
assert(decision.status === 'handled' && typeof decision.run === 'function', 'shortcut resolves to a handled action');
decision.run();
assert(panelSelections[panelSelections.length - 1] === 'mission', 'shortcut selects the panel when the conversation is shown');

// ---- render tree with sample data ----
function flatLookup(dict, key) {
  const value = dict[key];
  return typeof value === 'string' ? value : key;
}

function render(node) {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node.type === React.Fragment) return (node.children || []).map(render).join('');
  if (Array.isArray(node)) return node.map(render).join('');
  if (typeof node === 'function') {
    if (node.prototype && typeof node.prototype.render === 'function') {
      const instance = new node(node.props);
      return render(instance.render());
    }
    resetHooks();
    return render(node(node.props));
  }
  if (node.type && typeof node.type === 'function') {
    if (node.type.prototype && typeof node.type.prototype.render === 'function') {
      const instance = new node.type(node.props);
      return render(instance.render());
    }
    return render(node.type(node.props));
  }
  const newline = node.type === 'div' || node.type === 'section' || node.type === 'header' ? '\n' : '';
  const attrs = [];
  for (const [key, value] of Object.entries(node.props || {})) {
    if (key === 'children' || typeof value === 'function' || value === undefined) continue;
    attrs.push(`${key}=${JSON.stringify(value)}`);
  }
  return `<${node.type} ${attrs.join(' ')}>${(node.children || []).map(render).join('')}${newline ? '\n' : ''}</${node.type}>`;
}

const now = Date.now();
const projection = {
  a: {
    missionControl: {
      text: '已定位 auth 中间件超时，正在补回归测试',
      tool: 'write',
      toolError: '',
      turn: 5,
      reason: 'completed',
      files: ['notes/auth.md', 'tests/test_auth.py'],
      fileCount: 2,
    },
    todos: [
      { content: '定位 auth 中间件', status: 'completed' },
      { content: '跑 pytest', status: 'in_progress' },
      { content: '写回归测试', status: 'pending' },
    ],
    contextPressure: { projectedTokens: 88000, contextWindow: 128000 },
    tokenUsage: { uncachedInputTokens: 12000, outputTokens: 4000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    subagentCatalog: [
      { id: 'a1', createdAt: now - 600000, mode: 'one-shot', label: '定位超时' },
      { id: 'a2', createdAt: now - 300000, mode: 'one-shot', label: '写回归测试' },
    ],
  },
  a1: { subagentTiming: { settledMs: 240000, lastTurnCompleted: true } },
  a2: { subagentTiming: { active: { since: now - 180000, through: now - 60000 } } },
  c: {
    missionControl: {
      text: '**迁移失败**：SQL 语法错误',
      tool: 'bash',
      toolError: 'FS_NOT_FOUND',
      turn: 3,
      reason: 'error',
      files: ['migrate.log'],
      fileCount: 1,
    },
  },
  b: {
    missionControl: {
      text: '第 7 页改成进度条版，已交付 pptx',
      tool: 'present',
      toolError: '',
      turn: 4,
      reason: 'completed',
      files: ['/w/build_deck.mjs'],
      fileCount: 1,
      deliverables: [{ path: '/w/输出/2026Q4_西二区_1023v3.pptx', description: '第 7 页改成 Q1—Q4 进度条' }],
    },
    goal: { goal: { objective: '重构支付模块', phase: 'active' }, roundsStarted: 2 },
    agentTeam: {
      members: [{ id: 'b', name: 'lead', role: 'lead', phase: 'active' }],
      tasks: [{ id: 't1', subject: '拆 parser', status: 'completed' }, { id: 't2', subject: '删 legacy_orders', status: 'pending' }],
    },
  },
};

const list = {
  phase: 'ready',
  ids: ['a', 'b', 'c'],
  byId: {
    a: {
      id: 'a',
      displayTitle: '修复登录超时',
      running: true,
      blank: false,
      updatedAt: now - 120000,
      projectionValues: projection.a,
    },
    a1: {
      id: 'a1',
      displayTitle: '定位超时',
      parentId: 'a',
      origin: 'subagent',
      running: false,
      blank: false,
      updatedAt: 0,
      projectionValues: projection.a1,
    },
    a2: {
      id: 'a2',
      displayTitle: '写回归测试',
      parentId: 'a',
      origin: 'subagent',
      running: true,
      blank: false,
      updatedAt: 0,
      projectionValues: projection.a2,
    },
    b: {
      id: 'b',
      displayTitle: '重构支付模块',
      running: false,
      blank: false,
      updatedAt: now - 300000,
      projectionValues: projection.b,
    },
    c: {
      id: 'c',
      displayTitle: '迁移脚本 review',
      running: false,
      blank: false,
      updatedAt: now - 7200000,
      projectionValues: projection.c,
    },
  },
  projectionsBySession: Object.fromEntries(Object.entries(projection).map(([id, values]) => [id, { values, state: 'ready', error: null }])),
};
const statuses = new Map([
  ['a', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['a1', { running: false, pendingInteraction: undefined, completionUnread: true }],
  ['a2', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['b', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
  ['c', { running: false, pendingInteraction: undefined, completionUnread: false }],
]);
const workspaces = {
  items: [
    { workspaceId: 'w1', path: '/Users/jaychen/Documents/MissionDashboard', title: 'MissionDashboard', sessionIds: ['a', 'b'] },
    { workspaceId: 'w2', path: '/tmp/other', title: 'Other', sessionIds: [] },
  ],
};

function renderPanel() {
  hookState = [];
  resetHooks();
  const tree = React.createElement(main.component, {
    t: (key) => flatLookup(dictionaries.dicts.zh, String(key)),
    useSessions: (selector) => selector(list),
    useSessionStatus: (selector) => selector(statuses),
    useWorkspaces: (selector) => selector(workspaces),
    openSession: () => {},
    refreshProjections: () => Promise.resolve(),
  });
  return render(tree);
}

const html = renderPanel();
const expectations = [
  ['panel title', 'Command Centre'],
  ['board columns', '运行中'],
  ['board card class', 'mc-board'],
  ['card class', 'mc-card'],
  ['view toggle', '看板'],
  ['failed column', '失败'],
  ['output code', 'OUT 2F'],
  ['running task', '修复登录超时'],
  ['pending task', '重构支付模块'],
  ['needs banner', '需要你'],
  ['approval kind', '待批准'],
  ['todo progress', '1/3'],
  ['context percent', '69%'],
  ['subagent child', '定位超时'],
  ['output placeholder', 'OUT'],
  ['readonly footer', '只读视图'],
  ['filter label', '全部'],
  ['agents metric', '主+2子'],
  ['context metric', '69%'],
];
for (const [label, needle] of expectations) {
  assert(html.includes(needle), `${label}: expected "${needle}" in render output`);
}
assert(!/undefined|NaN|\[object Object\]/.test(html), 'render output has no undefined/NaN/[object Object]');

// click a row -> drawer opens with goal + team + subagents sections
function findFirst(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirst(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return null;
}

function expand(node) {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(expand);
  if (node.type === React.Fragment) return (node.children || []).map(expand);
  const type = node.type;
  if (typeof type === 'function' || (type && typeof type === 'object')) {
    if (type && type.prototype && typeof type.prototype.render === 'function') {
      const instance = new type(node.props);
      return expand(instance.render());
    }
    if (typeof type === 'function') {
      // Hook positions are shared by this stub runtime: reset only at the root
      // component of a pass, never per nested component (MissionPanel → Canvas).
      return expand(type(node.props));
    }
  }
  return { type, props: node.props, children: (node.children || []).map(expand) };
}

hookState = [];
resetHooks();
const asked = [];
const openedSessions = [];
// Effects are stubbed out in this harness, so projection warms never fire here; the
// lazy-refresh policy is verified by reading the effect (mount warms roots only).
const refreshed = [];
const renamed = [];
const trailReads = [];
const nativeTrailCalls = [];
let nativeTrailAllowed = false;
const panelProps = {
  t: (key) => flatLookup(dictionaries.dicts.zh, String(key)),
  useSessions: (selector) => selector(list),
  useSessionStatus: (selector) => selector(statuses),
  useWorkspaces: (selector) => selector(workspaces),
  openSession: (id) => openedSessions.push(id),
  refreshProjections: (id) => {
    refreshed.push(id);
    return Promise.resolve();
  },
  deliverToSession: (id, text) => {
    delivered.push({ id, text });
    return Promise.resolve({ accepted: true });
  },
  askSession: (id, text, requestId) => {
    asked.push({ id, text, requestId });
    return Promise.resolve({ accepted: true });
  },
  renameSession: (id, title) => {
    renamed.push({ id, title });
    return Promise.resolve({ title, seq: 9 });
  },
  openNativeTrail: (id) => {
    nativeTrailCalls.push(id);
    if (!nativeTrailAllowed) return { ok: false, reason: 'devtools-off' };
    openedSessions.push(id);
    return { ok: true, bestEffort: true };
  },
  readSessionTrail: (id) => {
    trailReads.push(id);
    return Promise.resolve([
      { kind: 'turn', text: 'T3', at: Date.now() - 60000 },
      { kind: 'tool', text: 'write · /w/deck.mjs', at: Date.now() - 50000 },
      { kind: 'deliver', text: 'deck.pptx', at: Date.now() - 40000 },
    ]);
  },
};

const expandedOnce = expand(React.createElement(main.component, panelProps));
const row = findFirst(expandedOnce, (node) => node.type === 'div' && node.props && (node.props.className === 'mc-row' || node.props.className === 'mc-card'));
assert(row, 'row element rendered');
row.props.onClick();

resetHooks();
const selectedTree = expand(React.createElement(main.component, panelProps));
const drawerText = render(selectedTree);
assert(drawerText.includes('概览'), 'drawer overview section renders');
assert(drawerText.includes('子任务'), 'drawer subagents section renders');
assert(drawerText.includes('产出'), 'drawer output section renders');
assert(!/undefined|NaN|\[object Object\]/.test(drawerText), 'drawer output has no undefined/NaN/[object Object]');

// ---- drawer output from the Host projection ----
const outputTree = expandPanel();
const failedCard = findFirst(outputTree, (node) => node.type === 'div' && node.props && node.props.className === 'mc-card' && nodeText(node).includes('迁移脚本 review'));
assert(failedCard, 'failed task card rendered');
failedCard.props.onClick(fakeEvent);
const failedDrawer = render(expandPanel());
assert(failedDrawer.includes('migrate.log'), 'drawer file zone lists projected files');
assert(failedDrawer.includes('结束原因') && failedDrawer.includes('error'), 'drawer shows the turn outcome');
const dialogueSpan = findFirst(expandPanel(), (node) => node.props && node.props.style && node.props.style.whiteSpace === 'pre-wrap');
assert(dialogueSpan, 'dialogue text span rendered');
assert(nodeText(dialogueSpan) === '迁移失败：SQL 语法错误', `dialogue text is flattened from markdown (got: ${nodeText(dialogueSpan)})`);

// ---- settings panel: default view choice ----
let settingsTree = expandPanel();
const gear = findFirst(settingsTree, (node) => node.type === 'button' && node.children && node.children[0] === '⚙');
assert(gear, 'settings button rendered in the header');
gear.props.onClick(fakeEvent);
settingsTree = expandPanel();
assert(countClass(settingsTree, 'mc-settings') === 1, 'settings overlay opens');
const settingsText = render(settingsTree);
assert(settingsText.includes('默认界面') && settingsText.includes('记住上次界面'), 'settings expose the default view and view memory');
const settingsRoot = findFirst(settingsTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('mc-settings'));
assert(settingsRoot, 'settings overlay element found');
const closeSettings = findFirst(settingsRoot, (node) => node.type === 'button' && node.children && node.children[0] === '✕');
assert(closeSettings, 'settings overlay has a close button');
closeSettings.props.onClick(fakeEvent);
settingsTree = expandPanel();
assert(countClass(settingsTree, 'mc-settings') === 0, 'settings overlay closes');

// ---- theme switch (system / light / dark) ----
let themeTree = expandPanel();
const rootEl = findFirst(themeTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes('mc-root'));
assert(rootEl, 'panel root rendered');
assert(rootEl.props['data-tone'] === 'light', 'a light host resolves to the light tone');
const gearAgain = findFirst(themeTree, (node) => node.type === 'button' && node.children && node.children[0] === '⚙');
gearAgain.props.onClick(fakeEvent);
themeTree = expandPanel();
assert(render(themeTree).includes('跟随系统'), 'settings expose the theme switch');
const darkButton = findFirst(themeTree, (node) => node.type === 'button' && node.props && node.props['data-testid'] === 'mc-theme-dark');
assert(darkButton, 'the dark theme button renders');
darkButton.props.onClick(fakeEvent);
themeTree = expandPanel();
const darkRoot = findFirst(themeTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes('mc-root'));
assert(darkRoot.props['data-tone'] === 'dark', 'picking dark forces the dark tone even on a light host');
const systemButton = findFirst(themeTree, (node) => node.type === 'button' && node.props && node.props['data-testid'] === 'mc-theme-system');
systemButton.props.onClick(fakeEvent);
themeTree = expandPanel();
const systemRoot = findFirst(themeTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes('mc-root'));
assert(systemRoot.props['data-tone'] === 'light', 'system follows the host again');
const settingsCloseAgain = findFirst(findFirst(themeTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('mc-settings')), (node) => node.type === 'button' && node.children && node.children[0] === '✕');
settingsCloseAgain.props.onClick(fakeEvent);
themeTree = expandPanel();

// ---- typing inside a text field must not fire the panel hotkeys ----
const hotkeyRoot = findFirst(themeTree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes('mc-root'));
const typingEvent = (key, target) => ({ key, keyCode: key.charCodeAt(0), metaKey: false, ctrlKey: false, altKey: false, isComposing: false, target, preventDefault() {}, stopPropagation() {} });
hotkeyRoot.props.onKeyDown(typingEvent('o', { tagName: 'TEXTAREA' }));
hotkeyRoot.props.onKeyDown(typingEvent('v', { tagName: 'INPUT', type: 'text' }));
hotkeyRoot.props.onKeyDown(typingEvent('j', { tagName: 'DIV', isContentEditable: true }));
assert(openedSessions.length === 0, 'typing in a text field does not trigger panel shortcuts');
hotkeyRoot.props.onKeyDown(typingEvent('o', { tagName: 'DIV' }));
assert(openedSessions.length === 1, 'the same key still works when the panel itself has focus');
const beforeTyping = render(expandPanel());
const rootForTyping = findFirst(expandPanel(), (node) => node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes('mc-root'));
rootForTyping.props.onKeyDown(typingEvent('j', { tagName: 'INPUT', type: 'text' }));
rootForTyping.props.onKeyDown(typingEvent('v', { tagName: 'TEXTAREA' }));
rootForTyping.props.onKeyDown(typingEvent('s', { tagName: 'DIV', isContentEditable: true }));
assert(render(expandPanel()) === beforeTyping, 'typing keys in a text field leave the panel state untouched');

// ---- file preview from the projected file list ----
let previewTree = expandPanel();
const fileRow = findFirst(previewTree, (node) => node.type === 'li' && node.props && typeof node.props.className === 'string' && node.props.className.includes('mc-itemLink'));
assert(fileRow, 'drawer file rows are clickable');
fileRow.props.onClick(fakeEvent);
previewTree = expandPanel();
assert(countClass(previewTree, 'mc-preview') === 1, 'clicking a projected file opens the preview overlay');
const previewText = render(previewTree);
assert(previewText.includes('在桌面打开') && previewText.includes('migrate.log'), 'preview offers native open and names the file');
const previewRoot = findFirst(previewTree, (node) => node.props && node.props.className === 'mc-preview');
assert(previewRoot, 'preview overlay element found');
const closePreview = findFirst(previewRoot, (node) => node.type === 'button' && node.children && node.children[0] === '✕');
assert(closePreview, 'preview overlay has a close button');

// ---- dropping a projected file on a task opens the delivery confirm ----
closePreview.props.onClick(fakeEvent);
let dropTree = expandPanel();
const targetCard = findFirst(dropTree, (node) => node.type === 'div' && node.props && node.props.className === 'mc-card' && nodeText(node).includes('重构支付模块'));
assert(targetCard, 'delivery target card rendered');
targetCard.props.onDrop({
  preventDefault() {},
  currentTarget: { setAttribute() {}, removeAttribute() {} },
  dataTransfer: { getData: () => '/tmp/notes/auth.md' },
});
dropTree = expandPanel();
assert(countClass(dropTree, 'mc-delivery') === 1, 'dropping a file opens the delivery confirm');
const deliveryText = render(dropTree);
assert(deliveryText.includes('auth.md') && deliveryText.includes('投递'), 'confirm names the file and offers delivery');
const sendButton = findFirst(dropTree, (node) => node.type === 'button' && node.children && node.children[0] === '投递');
assert(sendButton, 'delivery send button rendered');
sendButton.props.onClick(fakeEvent);
dropTree = expandPanel();
assert(countClass(dropTree, 'mc-delivery') === 1, 'delivery overlay stays open while sending');
assert(render(dropTree).includes('读取中'), 'delivery shows a sending state');

// ---- handed-off deliverables (Host projection v2) ----
const deliveredCard = findFirst(expandPanel(), (node) => node.type === 'div' && node.props && node.props.className === 'mc-card' && nodeText(node).includes('重构支付模块'));
assert(deliveredCard, 'card with a handed-off deliverable rendered');
assert(nodeText(deliveredCard).includes('OUT 1D'), 'output code counts deliverables as D, not F');
deliveredCard.props.onClick(fakeEvent);
const deliveredDrawer = render(expandPanel());
assert(deliveredDrawer.includes('1023v3.pptx'), 'the handed-off pptx is listed in the file zone');
assert(deliveredDrawer.includes('交付'), 'the deliverable row is tagged');
assert(deliveredDrawer.includes('build_deck.mjs'), 'write/edit helper scripts stay listed too');
assert(deliveredDrawer.includes('第 7 页改成 Q1—Q4 进度条'), 'the agent description is surfaced');

// ---- canvas view ----
function expandPanel() {
  resetHooks();
  return expand(React.createElement(main.component, panelProps));
}
function nodeText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(' ');
  return (node.children || []).map(nodeText).join(' ');
}
function countClass(node, className) {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) return node.reduce((sum, child) => sum + countClass(child, className), 0);
  const classes = node.props && typeof node.props.className === 'string' ? node.props.className.split(/\s+/) : [];
  let total = classes.includes(className) ? 1 : 0;
  for (const child of node.children || []) total += countClass(child, className);
  return total;
}

let tree = expandPanel();
const canvasButton = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '画布');
assert(canvasButton, 'canvas view button rendered');
canvasButton.props.onClick(fakeEvent);

tree = expandPanel();
assert(countClass(tree, 'mc-canvas') === 1, 'canvas container renders');
assert(countClass(tree, 'mc-node') === 5, 'canvas renders one node per session (3 roots + 2 subagents)');
assert(countClass(tree, 'mc-edge') === 2, 'canvas renders one edge per parent link');
assert(countClass(tree, 'mc-cluster') === 0, 'canvas draws no workspace-like group frames (v0.9.1)');
const canvasText = render(tree);
for (const [label, needle] of [['node title', '修复登录超时'], ['subagent node', '定位超时'], ['canvas hint', '拖拽平移'], ['node output', 'OUT 2F']]) {
  assert(canvasText.includes(needle), `canvas ${label} rendered`);
}
const badCanvas = canvasText.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/);
assert(!badCanvas, `canvas output has no undefined/NaN/[object Object] (found: ${badCanvas && badCanvas[0]})`);

// ---- canvas focus entry from a board card ----
tree = expandPanel();
const canvasFocusButton = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '画布');
assert(canvasFocusButton, 'canvas button still present');
// switch back to board, then click the ⌗ focus button on the first card
const boardButton = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '看板');
boardButton.props.onClick(fakeEvent);
tree = expandPanel();
const focusCard = findFirst(tree, (node) => node.type === 'div' && node.props && node.props.className === 'mc-card' && nodeText(node).includes('修复登录超时'));
assert(focusCard, 'running card rendered before canvas focus');
const focusButton = findFirst(focusCard, (node) => node.type === 'button' && node.children && node.children[0] === '⌗');
assert(focusButton, 'card exposes the canvas focus button');
focusButton.props.onClick(fakeEvent);
tree = expandPanel();
assert(countClass(tree, 'mc-canvas') === 1, 'focus switches to the canvas view');

// ---- canvas layout options ----
function clickLabel(label) {
  const button = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === label);
  assert(button, `canvas option button "${label}" rendered`);
  button.props.onClick(fakeEvent);
  tree = expandPanel();
}
function nodeBoxes() {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) walk(child); return; }
    if (node.props && node.props.className === 'mc-node') out.push(node.props.style);
    for (const child of node.children || []) walk(child);
  };
  walk(tree);
  return out;
}
function edgePath() {
  return findFirst(tree, (node) => node.type === 'path' && node.props && node.props.className === 'mc-edge');
}

assert(countClass(tree, 'mc-node') === 5, 'all-scope canvas draws every task');
const boxesTb = JSON.stringify(nodeBoxes());
assert(/H .* V /.test(edgePath().props.d), 'default edges are orthogonal');

clickLabel('横');
const boxesLr = nodeBoxes();
assert(JSON.stringify(boxesLr) !== boxesTb, 'left-to-right layout moves the nodes');
assert(boxesLr.every((box) => Number.isFinite(box.left) && Number.isFinite(box.top)), 'left-to-right boxes are numbers');

clickLabel('纵');
assert(JSON.stringify(nodeBoxes()) === boxesTb, 'switching back restores the top-to-bottom boxes');

clickLabel('曲线');
assert(/ C /.test(edgePath().props.d), 'curve edges use a cubic bezier');
clickLabel('直角');
assert(/H .* V /.test(edgePath().props.d), 'orthogonal edges use H/V segments');

// (the subtree scope switch was removed: it did not earn its place for one-level trees)

// ---- canvas node dragging ----
function canvasElement(node) {
  return findFirst(node, (candidate) => candidate.type === 'div' && candidate.props && candidate.props.className === 'mc-canvas');
}
function nodeLeft(tree_, id) {
  let left;
  const walk = (node) => {
    if (!node || typeof node !== 'object' || left !== undefined) return;
    if (Array.isArray(node)) { for (const child of node) walk(child); return; }
    if (node.props && node.props.className === 'mc-node' && node.props['data-node-id'] === id) left = node.props.style.left;
    for (const child of node.children || []) walk(child);
  };
  walk(tree_);
  return left;
}
const pointerEvent = (overrides) => Object.assign({
  button: 0,
  pointerId: 7,
  clientX: 100,
  clientY: 100,
  currentTarget: { setPointerCapture() {}, releasePointerCapture() {} },
  target: { closest: (selector) => (selector === '.mc-node' ? { getAttribute: () => 'a' } : null) },
}, overrides || {});

function nodeLeftOf(currentTree, id) {
  let left;
  const walk = (node) => {
    if (!node || typeof node !== 'object' || left !== undefined) return;
    if (Array.isArray(node)) { for (const child of node) walk(child); return; }
    if (node.props && node.props.className === 'mc-node' && node.props['data-node-id'] === id) left = node.props.style.left;
    for (const child of node.children || []) walk(child);
  };
  walk(currentTree);
  return left;
}

const before = nodeLeft(tree, 'a');
const beforeKids = { a1: nodeLeftOf(tree, 'a1'), a2: nodeLeftOf(tree, 'a2') };
const gapBefore = { a1: beforeKids.a1 - before, a2: beforeKids.a2 - before };
const canvas = canvasElement(tree);
assert(canvas, 'canvas element exposes pointer handlers');
canvas.props.onPointerDown(pointerEvent());
canvas.props.onPointerMove(pointerEvent({ clientX: 140 }));
flushFrames(1);
tree = expandPanel();
const oneFrame = nodeLeft(tree, 'a');
const oneFrameKids = { a1: nodeLeftOf(tree, 'a1'), a2: nodeLeftOf(tree, 'a2') };
assert(Number.isFinite(oneFrame) && oneFrame > before, `dragging a node moves it (${before} -> ${oneFrame})`);
assert(oneFrameKids.a1 > beforeKids.a1 && oneFrameKids.a2 > beforeKids.a2, 'children start following in the same frame');
assert(oneFrameKids.a1 - oneFrame < gapBefore.a1 && oneFrameKids.a2 - oneFrame < gapBefore.a2, 'children trail the parent by a few pixels (spring, not a rigid snap)');
canvas.props.onPointerMove(pointerEvent({ clientX: 180 }));
canvas.props.onPointerUp(pointerEvent({ clientX: 180 }));
flushFrames();
tree = expandPanel();
const after = nodeLeft(tree, 'a');
const afterKids = { a1: nodeLeftOf(tree, 'a1'), a2: nodeLeftOf(tree, 'a2') };
assert(Number.isFinite(after) && Math.abs(after - (before + 80)) < 0.5, `drag settles on the pointer delta (${before} -> ${after})`);
assert(Math.abs(afterKids.a1 - beforeKids.a1 - 80) < 0.6 && Math.abs(afterKids.a2 - beforeKids.a2 - 80) < 0.6, `children settle with the parent, shape intact (a1 ${beforeKids.a1} -> ${afterKids.a1}, a2 ${beforeKids.a2} -> ${afterKids.a2})`);
assert(frames.length === 0, 'the follow springs stop once the subtree settles');

const dragCanvas = canvasElement(tree);
dragCanvas.props.onPointerDown(pointerEvent({ clientX: 200, clientY: 200 }));
dragCanvas.props.onPointerUp(pointerEvent({ clientX: 200, clientY: 200 }));
tree = expandPanel();
assert(countClass(tree, 'mc-drawer') === 1, 'a click without movement still selects the node');

// ---- right-click menu + node composer (continue conversation) ----
function menuButton(label) {
  return findFirst(tree, (node) => node.type === 'button' && node.props && node.props.className === 'mc-menuItem' && node.children && node.children[0] === label);
}
const canvasForMenu = canvasElement(tree);
assert(canvasForMenu, 'canvas element present for the context menu');
canvasForMenu.props.onContextMenu({
  preventDefault() {},
  clientX: 120,
  clientY: 140,
  target: { closest: (selector) => (selector === '.mc-node' ? { getAttribute: () => 'a' } : null) },
});
tree = expandPanel();
assert(countClass(tree, 'mc-menu') === 1, 'right-clicking a node opens the context menu');
assert(render(tree).includes('查看工作轨迹'), 'the menu offers the work-trail entry');
const continueButton = menuButton('继续对话');
assert(continueButton, 'the menu offers continue-conversation');
continueButton.props.onClick(fakeEvent);
tree = expandPanel();
assert(countClass(tree, 'mc-menu') === 0, 'picking an item closes the menu');
assert(countClass(tree, 'mc-composer') === 1, 'continue-conversation opens the node composer');
const composerInput = findFirst(tree, (node) => node.type === 'textarea');
assert(composerInput, 'the composer has a textarea');
composerInput.props.onChange({ target: { value: '第 7 页再调一下颜色' } });
tree = expandPanel();
const composerSend = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '发送');
assert(composerSend, 'the composer has a send button');
const composerTextarea = findFirst(tree, (node) => node.type === 'textarea');
const composerKey = (composing) => ({
  key: 'Enter',
  keyCode: composing ? 229 : 13,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  preventDefault() {},
  stopPropagation() {},
  nativeEvent: { isComposing: composing, keyCode: composing ? 229 : 13, target: { tagName: 'TEXTAREA' } },
});
composerTextarea.props.onKeyDown(composerKey(true));
assert(asked.length === 0, 'Enter while the IME is composing does not submit');
composerTextarea.props.onKeyDown(composerKey(false));

// The preview reads through a promise: settle it before the last assertions.
(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));

  // PageProps native opener: with no configForms service the tab is unavailable, so the
  // caller falls back to the in-panel trail instead of claiming success.
  const nativePageProps = main.options.inject();
  const nativeOpening = nativePageProps.openNativeTrail('a');
  assert(nativeOpening && nativeOpening.ok === false && nativeOpening.reason === 'devtools-off', 'native trail reports devtools-off when the gate is closed');

  // pageProps: the host-facing rename + trail implementations
  const hostProps = main.options.inject();
  const renamedResult = await hostProps.renameSession('a', '新名字');
  assert(renamedResult && renamedResult.title === '新名字', 'renameSession unwraps the RemoteResult envelope');
  const hostTrail = await hostProps.readSessionTrail('a');
  assert(hostTrail.length === 4, 'readSessionTrail folds the loaded event window');
  assert(hostTrail[1].kind === 'tool' && hostTrail[1].text.startsWith('write'), 'the trail labels a tool call with its file');
  assert(hostTrail[3].kind === 'deliver' && hostTrail[3].text === 'deck.pptx', 'the trail shows a delivered artifact');

  assert(asked.length === 1, 'the composer sent exactly one prompt');
  assert(asked[0].id === 'a' && asked[0].text === '第 7 页再调一下颜色', 'the prompt targets the right-clicked node with the typed text');
  assert(typeof asked[0].requestId === 'string' && asked[0].requestId.length > 0, 'the prompt carries an idempotent request id');
  const afterSend = render(expandPanel());
  assert(afterSend.includes('已排队，下一轮送到'), 'the composer reports the queued prompt');

  await new Promise((resolve) => setTimeout(resolve, 0));

// ---- work trail + rename from the same menu ----
const canvasForTrail = canvasElement(tree);
canvasForTrail.props.onContextMenu({
  preventDefault() {},
  clientX: 120,
  clientY: 140,
  target: { closest: (selector) => (selector === '.mc-node' ? { getAttribute: () => 'a' } : null) },
});
tree = expandPanel();
const trailItem = menuButton('查看工作轨迹');
assert(trailItem, 'the menu offers the work trail');
trailItem.props.onClick(fakeEvent);
tree = expandPanel();
assert(countClass(tree, 'mc-trail') === 1, 'the work-trail panel opens');
const renameItem0 = menuButton('修改标题');
assert(!renameItem0, 'the menu closed behind the trail panel');

// rename: right-click again, pick 修改标题, retitle, send
canvasForTrail.props.onContextMenu({
  preventDefault() {},
  clientX: 120,
  clientY: 140,
  target: { closest: (selector) => (selector === '.mc-node' ? { getAttribute: () => 'a' } : null) },
});
tree = expandPanel();
const renameItem = menuButton('修改标题');
assert(renameItem, 'the menu offers rename when the host exposes it');
renameItem.props.onClick(fakeEvent);
tree = expandPanel();
assert(countClass(tree, 'mc-composer') === 1, 'rename opens the composer');
const renameInput = findFirst(tree, (node) => node.type === 'input' && node.props && node.props.className === 'mc-composerInput');
assert(renameInput, 'rename uses a single-line input');
renameInput.props.onChange({ target: { value: '修复登录超时 · 回归' } });
tree = expandPanel();
const renameSend = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '保存');
assert(renameSend, 'rename has a save button');
renameSend.props.onClick(fakeEvent);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const afterTrail = render(expandPanel());
  assert(trailReads.length === 1 && trailReads[0] === 'a', 'the trail read targets the right-clicked node');
  assert(afterTrail.includes('write · /w/deck.mjs') && afterTrail.includes('deck.pptx'), 'the trail renders tool and delivery rows');
  assert(renamed.length === 1 && renamed[0].id === 'a' && renamed[0].title === '修复登录超时 · 回归', 'rename sends the new title to the host');
  assert(render(expandPanel()).includes('标题已更新'), 'rename reports success');

  const previousTrail = findFirst(tree, (node) => node.props && node.props.className === 'mc-trail');
  if (previousTrail) {
    const closeTrail = findFirst(previousTrail, (node) => node.type === 'button' && node.children && node.children[0] === '✕');
    closeTrail.props.onClick(fakeEvent);
    tree = expandPanel();
    assert(countClass(tree, 'mc-trail') === 0, 'the in-panel trail closes again');
  }
  nativeTrailAllowed = true;
  const openedBefore = openedSessions.length;
  const canvasForNative = canvasElement(tree);
  canvasForNative.props.onContextMenu({
    preventDefault() {},
    clientX: 120,
    clientY: 140,
    target: { closest: (selector) => (selector === '.mc-node' ? { getAttribute: () => 'a' } : null) },
  });
  tree = expandPanel();
  const nativeItem = menuButton('查看工作轨迹');
  assert(nativeItem, 'the menu offers the work trail');
  nativeItem.props.onClick(fakeEvent);
  tree = expandPanel();
  assert(countClass(tree, 'mc-trail') === 0, 'the native Trajectory tab is preferred over the in-panel trail');
  assert(openedSessions.length === openedBefore + 1, 'the native branch opens the conversation');
  assert(nativeTrailCalls.includes('a'), 'the native opener was asked for the right-clicked node');
  nativeTrailAllowed = false;

  // Preview remotes: unwrap the RemoteResult envelope, error codes surface, and
  // "open on desktop" resolves the workspace-relative path through stat first.
  const pageProps = main.options.inject();
  const page = await pageProps.readTextFile('a', 'notes/migrate.log');
  assert(page && page.text === 'preview', 'readTextFile unwraps the RemoteResult envelope');
  const bytes = await pageProps.readBytes('a', '输出/pic.png');
  assert(bytes && Array.isArray(bytes.data) && bytes.data.length === 4, 'readBytes unwraps the RemoteResult envelope');
  let readError = null;
  try {
    await pageProps.readTextFile('a', 'missing.md');
  } catch (error) {
    readError = error;
  }
  assert(readError && /FS_NOT_FOUND/.test(String(readError.message || readError.code)), 'a failed read surfaces the host error code');
  await pageProps.openPath('notes/migrate.log', 'a');
  assert(openedPaths.length === 1 && openedPaths[0] === '/abs/notes/migrate.log', `openPath sends the absolute host path from stat (got ${JSON.stringify(openedPaths)})`);

  console.log('SMOKE OK');
  console.log(`registered slots: ${registered.map((r) => `${r.options.name}:${r.options.key || r.options.id}`).join(', ')}`);
console.log(`render length: ${html.length} chars; drawer length: ${drawerText.length} chars`);

// Print a plain-text projection of the rendered page for a quick content review.
if (process.env.MC_DUMP) {
  const text = html
    .replace(/<\/div>|<\/span>|<\/h1>|<\/h2>|<\/dt>|<\/dd>|<\/li>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  console.log('--- RENDER TEXT ---');
  console.log(text.join('\n'));
  const drawerLines = drawerText
    .replace(/<\/div>|<\/span>|<\/h[12]>|<\/dt>|<\/dd>|<\/li>|<\/section>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('.mc-') && line.length < 160);
  const canvasTextDump = (typeof canvasText === 'string' ? canvasText : '')
    .replace(/<\/div>|<\/span>|<\/svg>|<\/path>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('.mc-') && line.length < 120);
  const collect = (node, className, out) => {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) { for (const child of node) collect(child, className, out); return out; }
    if (node.props && node.props.className === className) out.push(node.props.style || {});
    for (const child of node.children || []) collect(child, className, out);
    return out;
  };
  console.log('--- CANVAS BOXES ---');
  console.log(JSON.stringify({ nodes: collect(tree, 'mc-node', []), edges: collect(tree, 'mc-edge', []).length }, null, 1));
  console.log('--- CANVAS TEXT ---');
  console.log(canvasTextDump.slice(0, 60).join('\n'));
    console.log('--- DRAWER TEXT ---');
    console.log(drawerLines.join('\n'));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
