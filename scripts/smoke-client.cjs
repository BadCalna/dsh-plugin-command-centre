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

const sandbox = { window: windowStub, console, Date, Math, JSON, Set, Map, Object, String, Number, Array, Promise, Symbol };
sandbox.globalThis = sandbox;
require('vm').createContext(sandbox);
require('vm').runInContext(source, sandbox, { filename: 'client.js' });

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
const panelSelections = [];
const registeredShortcuts = [];
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
  sessions: { refreshProjections: () => Promise.resolve() },
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
  b: {
    goal: { goal: { objective: '重构支付模块', phase: 'active' }, roundsStarted: 2 },
    agentTeam: {
      members: [{ id: 'b', name: 'lead', role: 'lead', phase: 'active' }],
      tasks: [{ id: 't1', subject: '拆 parser', status: 'completed' }, { id: 't2', subject: '删 legacy_orders', status: 'pending' }],
    },
  },
};

const list = {
  phase: 'ready',
  ids: ['a', 'b'],
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
  },
  projectionsBySession: Object.fromEntries(Object.entries(projection).map(([id, values]) => [id, { values, state: 'ready', error: null }])),
};
const statuses = new Map([
  ['a', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['a1', { running: false, pendingInteraction: undefined, completionUnread: true }],
  ['a2', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['b', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
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
const panelProps = {
  t: (key) => flatLookup(dictionaries.dicts.zh, String(key)),
  useSessions: (selector) => selector(list),
  useSessionStatus: (selector) => selector(statuses),
  useWorkspaces: (selector) => selector(workspaces),
  openSession: () => {},
  refreshProjections: () => Promise.resolve(),
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

// ---- canvas view ----
const fakeEvent = { stopPropagation() {}, preventDefault() {} };
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
  let total = node.props && node.props.className === className ? 1 : 0;
  for (const child of node.children || []) total += countClass(child, className);
  return total;
}

let tree = expandPanel();
const canvasButton = findFirst(tree, (node) => node.type === 'button' && node.children && node.children[0] === '画布');
assert(canvasButton, 'canvas view button rendered');
canvasButton.props.onClick(fakeEvent);

tree = expandPanel();
assert(countClass(tree, 'mc-canvas') === 1, 'canvas container renders');
assert(countClass(tree, 'mc-node') === 4, 'canvas renders one node per session (2 roots + 2 subagents)');
assert(countClass(tree, 'mc-edge') === 2, 'canvas renders one edge per parent link');
assert(countClass(tree, 'mc-cluster') === 2, 'canvas groups each root subtree in a cluster');
const canvasText = render(tree);
for (const [label, needle] of [['node title', '修复登录超时'], ['subagent node', '定位超时'], ['canvas hint', '拖拽平移']]) {
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

assert(countClass(tree, 'mc-node') === 4, 'all-scope canvas draws every task');
const boxesLr = JSON.stringify(nodeBoxes());
clickLabel('子树');
assert(countClass(tree, 'mc-node') === 3, 'subtree scope draws only the focused case');
const scopedNodes = [];
(function walkNodes(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walkNodes(child); return; }
  if (node.props && node.props.className === 'mc-node') scopedNodes.push(nodeText(node));
  for (const child of node.children || []) walkNodes(child);
})(tree);
assert(scopedNodes.some((text) => text.includes('修复登录超时')), 'subtree scope keeps the focused root');
assert(!scopedNodes.some((text) => text.includes('重构支付模块')), 'subtree scope drops other roots');
clickLabel('纵');
const boxesTb = nodeBoxes();
assert(JSON.stringify(boxesTb) !== boxesLr, 'top-to-bottom layout moves the nodes');
assert(boxesTb.every((box) => Number.isFinite(box.left) && Number.isFinite(box.top)), 'top-to-bottom boxes are numbers');
const tbTree = render(tree);
assert(!/undefined|NaN|null/.test(tbTree.replace(/null/g, '')), 'top-to-bottom render has no NaN');
clickLabel('直角');
const orthoPath = findFirst(tree, (node) => node.type === 'path' && node.props && node.props.className === 'mc-edge');
assert(orthoPath && /H .* V /.test(orthoPath.props.d), 'orthogonal edge path uses H/V segments');

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
  console.log(JSON.stringify({ nodes: collect(tree, 'mc-node', []), clusters: collect(tree, 'mc-cluster', []), edges: collect(tree, 'mc-edge', []).length }, null, 1));
  console.log('--- CANVAS TEXT ---');
  console.log(canvasTextDump.slice(0, 60).join('\n'));
  console.log('--- DRAWER TEXT ---');
  console.log(drawerLines.join('\n'));
}
