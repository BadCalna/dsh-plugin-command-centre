/**
 * Offline smoke test for the Host half's `missionControl` fold.
 *
 * Plain node, no DSH runtime: it drives `definition.apply` with committed session
 * events and checks the projection state the Client will read. Catches the classes
 * of bug that used to slip through here: a shell-built artifact never entering the
 * file list, a duplicate deliverable, an unbounded deliverables array, or a fold
 * that breaks the "unchanged event returns the same reference" gate.
 */
import assert from 'node:assert/strict';
import { definition, inject, name } from '../index.js';

assert.equal(name, 'missionControl', 'host module name');
assert.ok(inject.includes('sessionProjections'), 'projection registry injected');
assert.equal(definition.key, 'missionControl', 'projection key');
assert.equal(definition.stateVersion, 2, 'deliverables bump the projection state version');

const event = (type, data) => ({ type, data, seq: 1, time: 0 });

let state = definition.init({ id: 'session-a', cwd: '/workspace' }, 0);
assert.deepEqual(state.deliverables, [], 'fresh state has no deliverables');

// ---- the reported bug: a deck built by a bash script, handed over with `present` ----
state = definition.apply(
  state,
  event('deliverables/presented', {
    turn: 1,
    files: [
      { path: '/workspace/客户版/2026Q4_西二区经销商业务汇报_1023v2_P7进度条版.pptx', description: '第7页已重做为 Q1—Q4 横向百分比进度条 + 合计行' },
      { path: '/workspace/输出/预览_1023v2_P7进度条版.png', description: '' },
    ],
  }),
);
assert.equal(state.deliverables.length, 2, 'both handed-off files are kept');
assert.match(state.deliverables[0].path, /\.pptx$/, 'the deck is captured without any write/edit call');
assert.equal(state.deliverables[0].description, '第7页已重做为 Q1—Q4 横向百分比进度条 + 合计行', 'description kept');

// ---- re-presenting the same path replaces it instead of duplicating ----
state = definition.apply(state, event('deliverables/presented', { files: [{ path: '/workspace/客户版/2026Q4_西二区经销商业务汇报_1023v2_P7进度条版.pptx', description: 'v2 重建' }] }));
assert.equal(state.deliverables.length, 2, 'duplicates collapse');
assert.equal(state.deliverables[1].description, 'v2 重建', 'latest description wins');

// ---- the list stays bounded ----
for (let index = 0; index < 6; index += 1) {
  state = definition.apply(state, event('deliverables/presented', { files: [{ path: `/workspace/输出/deck-${index}.pptx` }] }));
}
assert.equal(state.deliverables.length, 4, 'deliverables capped at four');
assert.equal(state.deliverables[3].path, '/workspace/输出/deck-5.pptx', 'newest deliverable kept');

// ---- write/edit files still fold, and the unchanged-event gate holds ----
state = definition.apply(state, event('tool/call', { name: 'write', arguments: JSON.stringify({ file_path: '/workspace/build_deck.mjs' }) }));
assert.deepEqual(state.files, ['/workspace/build_deck.mjs'], 'helper script still tracked');
assert.equal(state.fileCount, 1, 'write counted once');
const unchanged = definition.apply(state, event('deliverables/presented', { files: [null, {}, { path: '' }] }));
assert.equal(unchanged, state, 'an empty present event returns the same reference');

// ---- other folds still behave ----
state = definition.apply(state, event('assistant/message', { message: { role: 'assistant', content: [{ type: 'text', text: '已经改好了。' }] } }));
assert.equal(state.text, '已经改好了。', 'assistant text folded');
state = definition.apply(state, event('turn/end', { turn: 3, reason: { kind: 'error' } }));
assert.equal(state.turn, 3, 'turn folded');
assert.equal(state.reason, 'error', 'turn outcome folded');
assert.equal(JSON.stringify(state).includes('undefined'), false, 'projection state stays JSON-serializable');

console.log('HOST SMOKE OK');
