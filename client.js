/**
 * Command Centre — Client half (V1a, read-only).
 *
 * A full-page `main` panel, one `sidebar.panellist` entry, and a global
 * shortcut (so a collapsed sidebar still has a way back in). Everything is
 * derived from slot props the Host already publishes:
 *   - useSessions(s => s)        list rows, parentId tree, per-session projections
 *   - useSessionStatus(m => m)   running / pendingInteraction / completionUnread
 *   - useWorkspaces(s => s)      workspace titles for the session rows
 *
 * V1a is read-only: it observes and jumps back into the Conversation. Output
 * data (files / last answer) needs a Host projection and lands in V1b, so the
 * output slot renders an explicit placeholder instead of guessing.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-command-centre',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'missionControl';
    const PANEL_ID = 'mission';
    const REFRESH_CONCURRENCY = 4;
    const REFRESH_LIMIT = 80;

    // #region dictionaries
    const ZH = {
      panel: 'Command Centre',
      title: 'Command Centre',
      count: { running: '运行', needs: '待你', failed: '失败', idle: '空闲', child: '子' },
      metric: { agents: 'AGENTS', context: 'CTX', output: 'OUT' },
      group: { needs: '需要你', running: '运行中', failed: '失败', idle: '空闲' },
      groupEmpty: {
        needs: '没有在等你的任务',
        running: '当前没有运行中的任务',
        failed: '没有失败的任务',
        idle: '没有空闲任务',
      },
      view: { board: '看板', list: '矩阵', canvas: '画布' },
      column: {
        task: '任务',
        chain: '代理链',
        progress: '进度',
        context: '上下文',
        activity: '活动',
        output: '产出',
      },
      outputPlaceholder: '—',
      outputHint: '产出：本会话写入的文件 + 最后一段回答（由 Host 投影提供）',
      kind: { approval: '待批准', 'plan-review': '待审计划', question: '待回答' },
      status: { running: '运行中', needs: '等你处理', idle: '空闲', done: '有结果未读' },
      ago: '前',
      lessThanMinute: '<1m',
      tokens: 'tok',
      chainMain: '主',
      chainChild: '子',
      chainRunning: '跑',
      moreChildren: '还有 {n} 个子级',
      drawer: {
        overview: '概览',
        goal: '目标',
        team: '团队',
        progress: '进度',
        subagents: '子任务',
        output: '产出',
        pending: '等你处理',
        workspace: '工作区',
        tokens: 'Tokens',
        context: '上下文',
        round: '第 {n} 轮',
        goalPhase: { active: '进行中', paused: '已暂停', blocked: '受阻', complete: '已完成' },
        noGoal: '没有目标',
        noTodos: '还没有 todo',
        noSubagents: '没有子 agent',
        members: '队友',
        tasks: '共享任务',
        taskStatus: { pending: '待办', in_progress: '进行中', completed: '完成', deleted: '已删' },
        roleLead: '队长',
        roleTeammate: '队友',
        settled: '已结束',
        active: '已跑',
        unread: '有新结果',
        files: '文件区',
        dialogue: '对话区',
        paths: '个路径',
        writes: '次写入',
        preview: '文件预览',
        openExternal: '在桌面打开',
        loading: '读取中…',
        previewUnsupported: '这个类型不能内嵌预览，用「在桌面打开」',
        previewError: '读取失败',
        truncated: '仅显示前 {n} 行',
        noFiles: '还没有写入文件',
        noText: '还没有回复',
        lastTool: '最近工具',
        reason: '结束原因',
        outputPending: '产出投影接入中（Host 未加载）',
      },
      action: { open: '打开对话', openParent: '打开父对话', close: '关闭', refresh: '刷新', canvas: '在画布中聚焦' },
      filter: { all: '全部', active: '只看活跃', needs: '只看待你' },
      search: '搜索任务…',
      quiet: '安静',
      allWorkspaces: '全部工作区',
      ungrouped: '未归组',
      loading: '读取会话中…',
      empty: '还没有任务。开一个新对话后就会出现在这里。',
      readonly: '只读视图 · 批准与回答请打开对话',
      footer: 'j/k 移动 · Enter 详情 · o 打开 · v 视图 · f 过滤 · s 安静 · / 搜索 · Esc 关闭',
      crashed: '这个面板渲染出错，已降级为空视图。',
      errors: { noStore: '会话列表不可用' },
      shortcut: { open: '打开 / 返回 Command Centre' },
      settings: {
        title: '设置',
        open: '设置',
        defaultView: '默认界面',
        quiet: '安静模式默认开启',
        restoreView: '记住上次界面',
        hint: '画布的默认方向 / 连线 / 位置在画布左上角与拖动时自动保存',
        on: '开',
        off: '关',
      },
      canvas: {
        fit: '适配',
        zoomIn: '放大',
        zoomOut: '缩小',
        hint: '滚轮缩放 · 拖拽平移 · 0 适配 · 双击打开',
        root: '主',
        sub: '子',
        empty: '没有可画的节点',
        lr: '横',
        tb: '纵',
        lrTitle: '左→右布局',
        tbTitle: '上→下布局',
        reset: '重置布局',
        resetTitle: '清除手动拖动的位置',
        curve: '曲线',
        ortho: '直角',
        curveTitle: '贝塞尔连线',
        orthoTitle: '直角折线',
      },
    };
    const EN = {
      panel: 'Command Centre',
      title: 'Command Centre',
      count: { running: 'running', needs: 'waiting', failed: 'failed', idle: 'idle', child: 'sub' },
      metric: { agents: 'AGENTS', context: 'CTX', output: 'OUT' },
      group: { needs: 'Needs you', running: 'Running', failed: 'Failed', idle: 'Idle' },
      groupEmpty: {
        needs: 'Nothing is waiting for you',
        running: 'Nothing is running right now',
        failed: 'No failed tasks',
        idle: 'No idle tasks',
      },
      view: { board: 'Board', list: 'Matrix', canvas: 'Canvas' },
      column: {
        task: 'Task',
        chain: 'Agents',
        progress: 'Progress',
        context: 'Context',
        activity: 'Activity',
        output: 'Output',
      },
      outputPlaceholder: '—',
      outputHint: 'Output: files written by this session + its last answer (Host projection)',
      kind: { approval: 'Needs approval', 'plan-review': 'Plan review', question: 'Question' },
      status: { running: 'Running', needs: 'Waiting for you', idle: 'Idle', done: 'Unread result' },
      ago: 'ago',
      lessThanMinute: '<1m',
      tokens: 'tok',
      chainMain: 'main',
      chainChild: 'sub',
      chainRunning: 'live',
      moreChildren: '{n} more subagents',
      drawer: {
        overview: 'Overview',
        goal: 'Goal',
        team: 'Team',
        progress: 'Progress',
        subagents: 'Subagents',
        output: 'Output',
        pending: 'Waiting for you',
        workspace: 'Workspace',
        tokens: 'Tokens',
        context: 'Context',
        round: 'round {n}',
        goalPhase: { active: 'active', paused: 'paused', blocked: 'blocked', complete: 'complete' },
        noGoal: 'No goal',
        noTodos: 'No todos yet',
        noSubagents: 'No subagents',
        members: 'Members',
        tasks: 'Shared tasks',
        taskStatus: { pending: 'pending', in_progress: 'in progress', completed: 'done', deleted: 'deleted' },
        roleLead: 'lead',
        roleTeammate: 'teammate',
        settled: 'settled',
        active: 'ran',
        unread: 'new result',
        files: 'Files',
        dialogue: 'Dialogue',
        paths: 'paths',
        writes: 'writes',
        preview: 'File preview',
        openExternal: 'Open on desktop',
        loading: 'Loading…',
        previewUnsupported: 'No inline preview for this type — use "Open on desktop"',
        previewError: 'Read failed',
        truncated: 'First {n} lines only',
        noFiles: 'No files written yet',
        noText: 'No answer yet',
        lastTool: 'Last tool',
        reason: 'Turn outcome',
        outputPending: 'Output projection not loaded by the Host yet',
      },
      action: { open: 'Open conversation', openParent: 'Open parent', close: 'Close', refresh: 'Refresh', canvas: 'Focus in canvas' },
      filter: { all: 'All', active: 'Active', needs: 'Waiting' },
      search: 'Search tasks…',
      quiet: 'Quiet',
      allWorkspaces: 'All workspaces',
      ungrouped: 'Ungrouped',
      loading: 'Reading sessions…',
      empty: 'No tasks yet. Start a conversation and it shows up here.',
      readonly: 'Read-only · approve and answer inside the conversation',
      footer: 'j/k move · Enter details · o open · v view · f filter · s quiet · / search · Esc close',
      crashed: 'This panel crashed and fell back to an empty view.',
      errors: { noStore: 'Session list unavailable' },
      shortcut: { open: 'Open / return to Command Centre' },
      settings: {
        title: 'Settings',
        open: 'Settings',
        defaultView: 'Default view',
        quiet: 'Quiet mode by default',
        restoreView: 'Remember the last view',
        hint: 'Canvas direction, edge style and node positions save from the canvas itself',
        on: 'on',
        off: 'off',
      },
      canvas: {
        fit: 'Fit',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        hint: 'Wheel to zoom · drag to pan · 0 to fit · double-click to open',
        root: 'main',
        sub: 'sub',
        empty: 'No nodes to draw',
        lr: 'LR',
        tb: 'TB',
        lrTitle: 'Left to right',
        tbTitle: 'Top to bottom',
        reset: 'Reset layout',
        resetTitle: 'Clear manual node positions',
        curve: 'Curve',
        ortho: 'Ortho',
        curveTitle: 'Bezier edges',
        orthoTitle: 'Orthogonal edges',
      },
    };
    // #endregion

    // The Host locale registry looks dictionaries up by the exact key, not by a
    // dotted path, so nested authoring is flattened before registration.
    function flattenDict(node, prefix, out) {
      const target = out || {};
      for (const [key, value] of Object.entries(node)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) flattenDict(value, path, target);
        else target[path] = value;
      }
      return target;
    }

    // #region formatting
    function isNum(value) {
      return typeof value === 'number' && Number.isFinite(value);
    }

    function fmtTokens(value) {
      if (!isNum(value) || value < 0) return '';
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
      return String(value);
    }

    function fmtDuration(ms) {
      if (!isNum(ms) || ms <= 0) return '';
      const minutes = Math.floor(ms / 60000);
      if (minutes < 1) return '';
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      return `${Math.floor(hours / 24)}d`;
    }

    function relLabel(ms, t) {
      const unit = fmtDuration(ms);
      if (!unit) return t('lessThanMinute');
      const ago = t('ago');
      return ago === 'ago' ? `${unit} ${ago}` : `${unit}${ago}`;
    }

    function baseName(path) {
      const parts = String(path).split('/');
      return parts[parts.length - 1] || path;
    }

    function shortPath(path, keep) {
      const parts = String(path).split('/').filter((part) => part !== '');
      const tail = keep && keep > 0 ? keep : 2;
      if (parts.length <= tail) return String(path);
      return `…/${parts.slice(-tail).join('/')}`;
    }

    function fileKind(path) {
      const name = baseName(path).toLowerCase();
      const dot = name.lastIndexOf('.');
      const extension = dot >= 0 ? name.slice(dot + 1) : '';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(extension)) return 'image';
      if (['mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a'].includes(extension)) return 'media';
      if (
        ['md', 'markdown', 'txt', 'log', 'json', 'jsonc', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'htm', 'xml', 'yml', 'yaml', 'toml', 'ini', 'csv', 'tsv', 'sh', 'zsh', 'bash', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'sql', 'diff', 'patch', 'mjs', 'tex'].includes(extension)
      ) return 'text';
      return 'other';
    }

    function percent(part, whole) {
      if (!isNum(part) || !isNum(whole) || whole <= 0) return undefined;
      return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
    }
    // #endregion

    // #region data derivation
    function valuesOf(list, id) {
      const store = list && list.projectionsBySession ? list.projectionsBySession[id] : undefined;
      if (store && store.values) return store.values;
      const row = list && list.byId ? list.byId[id] : undefined;
      return row && row.projectionValues ? row.projectionValues : {};
    }

    function statusOf(statuses, id) {
      if (!statuses || typeof statuses.get !== 'function') return undefined;
      return statuses.get(id);
    }

    function runningOf(list, statuses, row) {
      const status = statusOf(statuses, row.id);
      if (status && typeof status.running === 'boolean') return status.running;
      return row.running === true;
    }

    function pendingOf(statuses, id) {
      const status = statusOf(statuses, id);
      const interaction = status && status.pendingInteraction;
      const kind = interaction && typeof interaction.kind === 'string' ? interaction.kind : undefined;
      return kind === 'approval' || kind === 'plan-review' || kind === 'question' ? interaction : undefined;
    }

    function todoProgress(values) {
      const todos = values && Array.isArray(values.todos) ? values.todos : undefined;
      if (!todos || todos.length === 0) return undefined;
      let done = 0;
      let active = 0;
      for (const item of todos) {
        if (!item) continue;
        if (item.status === 'completed') done += 1;
        else if (item.status === 'in_progress') active += 1;
      }
      return { done, total: todos.length, active };
    }

    function contextOf(values) {
      const pressure = values && values.contextPressure;
      if (!pressure) return undefined;
      const tokens = isNum(pressure.projectedTokens) ? pressure.projectedTokens : pressure.pressureTokens;
      const window = pressure.contextWindow;
      const pct = percent(tokens, window);
      if (!isNum(tokens) && !isNum(window)) return undefined;
      return { pct, tokens, window };
    }

    function tokenTotal(values) {
      const usage = values && values.tokenUsage;
      if (!usage) return undefined;
      const sum =
        (isNum(usage.uncachedInputTokens) ? usage.uncachedInputTokens : 0) +
        (isNum(usage.outputTokens) ? usage.outputTokens : 0) +
        (isNum(usage.cacheReadTokens) ? usage.cacheReadTokens : 0) +
        (isNum(usage.cacheWriteTokens) ? usage.cacheWriteTokens : 0);
      return sum > 0 ? sum : undefined;
    }

    const FAILED_OUTCOMES = new Set(['error', 'blocked', 'max-tokens']);

    /** Read the Host `missionControl` projection into the UI shape we render. */
    function outputOf(values) {
      const raw = values && values.missionControl;
      if (!raw || typeof raw !== 'object') return undefined;
      const files = Array.isArray(raw.files) ? raw.files.filter((entry) => typeof entry === 'string' && entry !== '') : [];
      const reason = typeof raw.reason === 'string' ? raw.reason : '';
      return {
        files,
        fileCount: Number.isInteger(raw.fileCount) && raw.fileCount > 0 ? raw.fileCount : files.length,
        text: typeof raw.text === 'string' ? raw.text : '',
        tool: typeof raw.tool === 'string' ? raw.tool : '',
        toolError: typeof raw.toolError === 'string' ? raw.toolError : '',
        turn: Number.isInteger(raw.turn) ? raw.turn : 0,
        reason,
        failed: FAILED_OUTCOMES.has(reason),
      };
    }

    /** Compact code for the output cell: files first, then answer text, then error. */
    function outputCode(output) {
      if (!output) return undefined;
      if (output.files.length > 0 || output.fileCount > 0) return `${Math.max(output.files.length, output.fileCount)}F`;
      if (output.text) return 'TXT';
      if (output.toolError || output.failed) return 'ERR';
      return undefined;
    }

    function outputTitle(output, t) {
      if (!output) return t('drawer.outputPending');
      const parts = [];
      if (output.files.length > 0) parts.push(output.files.join('\n'));
      if (output.text) parts.push(output.text);
      if (output.toolError) parts.push(`${t('drawer.lastTool')}: ${output.toolError}`);
      return parts.length > 0 ? parts.join('\n\n') : t('drawer.noFiles');
    }

    function timingOf(values, rowRunning) {
      const timing = values && values.subagentTiming;
      if (!timing) return undefined;
      const settled = isNum(timing.settledMs) ? timing.settledMs : 0;
      if (timing.active && isNum(timing.active.since)) {
        const through = isNum(timing.active.through) ? timing.active.through : Date.now();
        const live = rowRunning ? Date.now() - timing.active.since : Math.max(0, through - timing.active.since);
        return { ms: settled + Math.max(0, live), live: rowRunning === true, completed: timing.lastTurnCompleted === true };
      }
      return { ms: settled, live: false, completed: timing.lastTurnCompleted === true };
    }

    /** Build one flat model of the session tree plus the derived per-row facts. */
    function buildModel(input) {
      const list = input.list || {};
      const statuses = input.statuses;
      const byId = list.byId && typeof list.byId === 'object' ? list.byId : {};
      const workspaceTitles = input.workspaceTitles || new Map();
      const rows = Object.values(byId).filter((row) => row && typeof row.id === 'string');
      const childrenByParent = new Map();
      const roots = [];
      for (const row of rows) {
        const parentId = typeof row.parentId === 'string' ? row.parentId : undefined;
        if (parentId && byId[parentId]) {
          const bucket = childrenByParent.get(parentId) || [];
          bucket.push(row);
          childrenByParent.set(parentId, bucket);
        } else {
          roots.push(row);
        }
      }
      const rootSorted = roots.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const views = new Map();
      const viewOf = (row) => {
        const cached = views.get(row.id);
        if (cached) return cached;
        const values = valuesOf(list, row.id);
        const running = runningOf(list, statuses, row);
        const pending = pendingOf(statuses, row.id);
        const status = statusOf(statuses, row.id);
        const view = {
          id: row.id,
          row,
          values,
          title: pickTitle(row),
          workspace: workspaceTitles.get(row.id) || '',
          running,
          pending,
          unread: !!(status && status.completionUnread),
          isChild: typeof row.parentId === 'string',
          todos: todoProgress(values),
          context: contextOf(values),
          tokens: tokenTotal(values),
          timing: timingOf(values, running),
          output: outputOf(values),
          children: (childrenByParent.get(row.id) || []).slice(),
        };
        views.set(row.id, view);
        return view;
      };
      for (const row of rows) viewOf(row);
      const groupOf = (view) => {
        if (view.pending) return 'needs';
        if (view.running) return 'running';
        if (view.output && view.output.failed) return 'failed';
        return 'idle';
      };
      return { list, roots: rootSorted.map(viewOf), views, childrenByParent, viewOf, groupOf };
    }

    function pickTitle(row) {
      const candidates = [row.displayTitle, row.title];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
      }
      return row.id;
    }

    function matchQuery(view, query) {
      if (!query) return true;
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return view.title.toLowerCase().includes(needle) || view.id.toLowerCase().includes(needle);
    }

    /** Group roots for the board / matrix; a filtered-out parent keeps its children hidden. */
    function groupedRoots(model, filter, query, workspaceFilter) {
      const groups = { needs: [], running: [], failed: [], idle: [] };
      for (const root of model.roots) {
        if (!matchQuery(root, query) && !root.children.some((child) => matchQuery(model.viewOf(child), query))) continue;
        if (workspaceFilter !== 'all' && (root.workspace || '') !== workspaceFilter) continue;
        const group = model.groupOf(root);
        if (filter === 'active' && group === 'idle') continue;
        if (filter === 'needs' && group !== 'needs') continue;
        groups[group].push(root);
      }
      return groups;
    }

    function collectVisibleIds(groups, expanded, model) {
      const ids = [];
      const pushTree = (view) => {
        ids.push(view.id);
        if (expanded[view.id] === false) return;
        for (const child of orderedChildren(view)) pushTree(model.viewOf(child));
      };
      for (const group of ['needs', 'running', 'failed', 'idle']) for (const view of groups[group]) pushTree(view);
      return ids;
    }

    function orderedChildren(view) {
      const catalog = view.values && Array.isArray(view.values.subagentCatalog) ? view.values.subagentCatalog : [];
      const byId = new Map(view.children.map((child) => [child.id, child]));
      const ordered = [];
      for (const entry of catalog) {
        if (!entry || entry.mode === 'external') continue;
        const child = byId.get(entry.id);
        if (child) {
          ordered.push(child);
          byId.delete(entry.id);
        }
      }
      const rest = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return ordered.concat(rest);
    }

    function countDescendants(view, model) {
      let total = 0;
      for (const child of view.children) {
        total += 1;
        total += countDescendants(model.viewOf(child), model);
      }
      return total;
    }

    function stateOf(view) {
      if (view.pending) return 'needs';
      if (view.running) return 'running';
      if (view.output && view.output.failed) return 'failed';
      if (view.unread) return 'done';
      return 'idle';
    }

    function liveChildren(view, model) {
      let live = 0;
      for (const child of view.children) if (model.viewOf(child).running) live += 1;
      return live;
    }
    // #endregion

    // #region styles
    const MONO = 'var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)';
    const CSS = `
.mc-root{height:100%;min-height:0;display:flex;flex-direction:column;position:relative;outline:none;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;background-color:var(--dsw-alias-bg-base);
  --mc-mono:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);
  --mc-run:var(--dsw-alias-state-business-primary);
  --mc-warn:var(--dsw-alias-state-warn-primary);
  --mc-ok:var(--dsw-alias-state-success-secondary);
  --mc-err:var(--dsw-alias-state-error-primary);
  --mc-idle:var(--dsw-alias-state-idle-primary,var(--dsw-alias-label-tertiary));
  --cc-accent:#0a6c7e;
  --cc-accent-ink:#0a6c7e;
  --cc-hair:color-mix(in srgb,var(--dsw-alias-border-l3) 92%,transparent);
  --cc-hair-hi:color-mix(in srgb,var(--dsw-alias-border-l4) 92%,transparent);
  --cc-grid:rgba(14,110,130,.10);
  --cc-scan:rgba(10,40,50,.012);
  --cc-tint:rgba(10,108,126,.05);
  --cc-glow:rgba(10,108,126,.14);
  --cc-vignette:rgba(20,40,55,.06);
  --cc-ink-run:color-mix(in srgb,var(--mc-run) 72%,#06202b);
  --cc-ink-warn:color-mix(in srgb,var(--mc-warn) 58%,#06202b);
  --cc-ink-ok:color-mix(in srgb,var(--mc-ok) 62%,#06202b);
  --cc-ink-err:color-mix(in srgb,var(--mc-err) 66%,#06202b);
  background-image:linear-gradient(180deg,var(--cc-tint),transparent 240px),linear-gradient(var(--cc-grid) 1px,transparent 1px),linear-gradient(90deg,var(--cc-grid) 1px,transparent 1px),repeating-linear-gradient(0deg,var(--cc-scan) 0 1px,transparent 1px 3px);
  background-size:100% 100%,48px 48px,48px 48px,100% 3px;background-attachment:local;
}
body[data-ds-dark-theme] .mc-root{--cc-accent:#57e2ff;--cc-accent-ink:#57e2ff;--cc-grid:rgba(96,208,255,.055);--cc-scan:rgba(255,255,255,.018);--cc-tint:rgba(87,226,255,.06);--cc-glow:rgba(87,226,255,.3);--cc-vignette:rgba(0,0,0,.55);--cc-ink-run:var(--mc-run);--cc-ink-warn:var(--mc-warn);--cc-ink-ok:var(--mc-ok);--cc-ink-err:var(--mc-err)}
.mc-root.mc-quiet{--mc-run:var(--dsw-alias-label-secondary);--mc-warn:var(--dsw-alias-label-secondary);--mc-ok:var(--dsw-alias-label-secondary);--cc-glow:transparent}
.mc-root>*{position:relative;z-index:1}
.mc-root::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E")}
.mc-root::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(130% 90% at 50% 0%,transparent 58%,var(--cc-vignette) 100%)}

/* ---------- head ---------- */
.mc-head{flex:none;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 16px;padding:10px 20px 9px;border-bottom:1px solid var(--cc-hair);position:relative}
html[data-platform=darwin] .mc-head{padding-top:calc(10px + var(--dsh-frame-top-clearance,0px));padding-left:max(20px,var(--dsh-frame-leading-clearance,0px))}
.mc-head::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--cc-accent),transparent);opacity:.5}
.mc-head::before{content:"";position:absolute;left:0;bottom:-2px;width:30%;height:2px;background:linear-gradient(90deg,transparent,var(--cc-accent),transparent);opacity:.9;box-shadow:0 0 14px 0 var(--cc-glow);will-change:transform;animation:mc-sweep 5.5s cubic-bezier(.4,0,.2,1) infinite}
@keyframes mc-sweep{0%,70%{transform:translateX(-110%)}100%{transform:translateX(400%)}}
.mc-brand{display:flex;align-items:center;gap:8px;min-width:0}
.mc-titleMark{flex:none;display:inline-flex;color:var(--cc-accent)}
.mc-title{margin:0;font-family:var(--mc-mono);font-size:13px;font-weight:600;line-height:20px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;font-variant-numeric:tabular-nums slashed-zero;font-feature-settings:"zero" 1,"tnum" 1}
.mc-titleMark svg{display:block}
html:not([data-ds-dark-theme]) .mc-title{text-shadow:none}
body[data-ds-dark-theme] .mc-title{text-shadow:0 0 18px color-mix(in srgb,var(--cc-accent) 24%,transparent)}
.mc-telemetry{display:flex;align-items:stretch;gap:2px}
.mc-stat{display:flex;flex-direction:column;align-items:flex-start;gap:0;min-width:52px;padding:2px 10px 3px;border:0;border-bottom:1px solid var(--cc-hair);background:transparent}
.mc-stat[data-tone=run]{border-bottom-color:color-mix(in srgb,var(--mc-run) 60%,var(--cc-hair))}
.mc-stat[data-tone=needs]{border-bottom-color:color-mix(in srgb,var(--mc-warn) 60%,var(--cc-hair))}
.mc-stat[data-tone=failed]{border-bottom-color:color-mix(in srgb,var(--mc-err) 60%,var(--cc-hair))}
.mc-statNum{font-family:var(--mc-mono);font-size:15px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums slashed-zero;letter-spacing:.01em}
.mc-stat[data-tone=run] .mc-statNum{color:var(--cc-ink-run)}
.mc-stat[data-tone=needs] .mc-statNum{color:var(--cc-ink-warn)}
.mc-stat[data-tone=failed] .mc-statNum{color:var(--cc-ink-err)}
.mc-statLabel{font-family:var(--mc-mono);font-size:8.5px;line-height:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.mc-headSpacer{flex:1 1 auto;min-width:8px}
.mc-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mc-seg{display:inline-flex;border:1px solid var(--cc-hair);border-radius:2px;overflow:hidden;background:transparent}
.mc-segBtn{height:26px;padding:0 10px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-family:var(--mc-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.mc-segBtn:hover{color:var(--dsw-alias-label-primary);background:var(--cc-tint)}
.mc-segBtn[aria-pressed=true]{color:var(--cc-accent-ink);background:var(--cc-tint);box-shadow:inset 0 -1px 0 var(--cc-accent)}
.mc-segBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-2px}
.mc-search{display:flex;align-items:center;height:26px;border:1px solid var(--cc-hair);border-radius:2px;background:transparent;padding:0 8px;min-width:132px}
.mc-search input{border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-family:var(--mc-mono);font-size:11px;outline:none;width:132px;letter-spacing:.04em}
.mc-search input::placeholder{color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.1em;font-size:10px}
.mc-btn{height:26px;border:1px solid var(--cc-hair);border-radius:2px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-family:var(--mc-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;padding:0 9px;white-space:nowrap}
.mc-btn:hover{background:var(--cc-tint);color:var(--dsw-alias-label-primary);border-color:var(--cc-hair-hi)}
.mc-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-btn[aria-pressed=true]{border-color:color-mix(in srgb,var(--cc-accent) 55%,var(--cc-hair));color:var(--cc-accent-ink)}
.mc-btn:disabled{opacity:.5;cursor:default}
.mc-select{height:26px;border:1px solid var(--cc-hair);border-radius:2px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-family:var(--mc-mono);font-size:11px;padding:0 6px;letter-spacing:.04em}

/* ---------- banner ---------- */
.mc-banner{flex:none;margin:9px 20px 0;border:1px solid color-mix(in srgb,var(--mc-warn) 34%,var(--cc-hair));border-left:2px solid var(--mc-warn);border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--mc-warn) 8%,transparent),transparent);padding:7px 10px 8px;display:flex;flex-direction:column;gap:5px}
.mc-bannerHead{display:flex;align-items:center;gap:8px;font-family:var(--mc-mono);font-weight:600;color:var(--cc-ink-warn);font-size:10px;letter-spacing:.16em;text-transform:uppercase}
.mc-bannerRows{display:flex;flex-direction:column;gap:0}
.mc-bannerRow{display:grid;grid-template-columns:16px minmax(0,1fr) auto auto;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:4px 6px;border-radius:2px;cursor:pointer}
.mc-bannerRow:hover{background:color-mix(in srgb,var(--mc-warn) 9%,transparent)}
.mc-bannerRow:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color)}
.mc-bannerWho{color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap;font-family:var(--mc-mono);letter-spacing:.06em;text-transform:uppercase}

/* ---------- body / board ---------- */
.mc-body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:9px 14px 6px;position:relative}
.mc-body::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(100deg,transparent 42%,color-mix(in srgb,var(--cc-accent) 9%,transparent) 50%,transparent 58%);transform:translateX(-120%);animation:mc-scan 9s linear infinite}
@keyframes mc-scan{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
.mc-board,.mc-matrix{position:relative;z-index:1}
.mc-board{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(4,minmax(204px,1fr));gap:10px;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
.mc-col{min-width:0;display:flex;flex-direction:column;min-height:0;border:1px solid var(--cc-hair);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 52%,transparent);position:relative}
.mc-col::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,var(--mc-col-accent,var(--cc-hair)),transparent 72%)}
.mc-col[data-state=needs]{--mc-col-accent:var(--mc-warn)}
.mc-col[data-state=running]{--mc-col-accent:var(--mc-run)}
.mc-col[data-state=running]::after{background:linear-gradient(90deg,transparent,var(--mc-run),transparent);background-size:38% 100%;background-repeat:no-repeat;animation:mc-col-scan 3.6s linear infinite}
@keyframes mc-col-scan{0%{background-position:-40% 0}100%{background-position:140% 0}}
.mc-col[data-state=failed]{--mc-col-accent:var(--mc-err)}
.mc-col[data-state=idle]{--mc-col-accent:var(--mc-idle)}
.mc-colHead{flex:none;display:flex;align-items:center;gap:8px;padding:9px 10px 7px;border-bottom:1px solid var(--cc-hair);position:relative;--cut:11px;clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
.mc-colIndex{font-family:var(--mc-mono);font-size:8.5px;letter-spacing:.12em;color:var(--dsw-alias-label-tertiary);border:1px solid var(--cc-hair);padding:0 4px;line-height:13px;border-radius:1px}
.mc-colName{font-family:var(--mc-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-colCount{margin-left:auto;font-family:var(--mc-mono);font-size:11px;color:var(--mc-col-accent,var(--dsw-alias-label-tertiary));font-variant-numeric:tabular-nums slashed-zero}
.mc-colBody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:7px;display:flex;flex-direction:column;gap:7px}
.mc-colEmpty{color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase;padding:10px 6px;border:1px dashed var(--cc-hair);border-radius:2px;text-align:center}

/* ---------- card ---------- */
.mc-card{position:relative;display:flex;flex-direction:column;gap:6px;padding:9px 10px 8px;border:1px solid var(--cc-hair);border-radius:2px;cursor:pointer;text-align:left;color:inherit;font:inherit;
  background:
    linear-gradient(var(--mc-card-accent,var(--mc-idle)),var(--mc-card-accent,var(--mc-idle))) 0 8px/2px calc(100% - 16px) no-repeat,
    linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-bg-layer-2) 92%,transparent),color-mix(in srgb,var(--dsw-alias-bg-layer-1) 97%,transparent));
  box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent);
  transition:border-color .12s linear,transform .12s cubic-bezier(.2,.8,.2,1);
  animation:mc-card-in .18s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes mc-card-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.mc-card[data-state=needs]{--mc-card-accent:var(--mc-warn)}
.mc-card[data-state=running]{--mc-card-accent:var(--mc-run);animation:mc-card-in .18s cubic-bezier(.2,.8,.2,1) both,mc-live 3.2s ease-in-out infinite}
@keyframes mc-live{0%,100%{box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent),0 0 0 1px color-mix(in srgb,var(--mc-run) 10%,transparent)}50%{box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent),0 0 0 1px color-mix(in srgb,var(--mc-run) 34%,transparent),0 0 22px -10px var(--mc-run)}}
.mc-card[data-state=done]{--mc-card-accent:var(--mc-ok)}
.mc-card[data-state=failed]{--mc-card-accent:var(--mc-err)}
.mc-card[data-state=idle]{--mc-card-accent:var(--mc-idle)}
.mc-card::before,.mc-card::after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border:1px solid var(--cc-hair-hi);opacity:.5;transition:opacity .12s linear,border-color .12s linear}
.mc-card::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.mc-card::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.mc-card:hover{border-color:color-mix(in srgb,var(--mc-card-accent,var(--cc-accent)) 42%,var(--cc-hair));transform:translateY(-1px)}
.mc-card:hover::before,.mc-card:hover::after,.mc-card[data-selected=true]::before,.mc-card[data-selected=true]::after{opacity:1;border-color:var(--cc-accent)}
.mc-card:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-card[data-selected=true]{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc-accent) 30%,transparent)}
.mc-cardTop{display:flex;align-items:flex-start;gap:7px;min-width:0}
.mc-cardTitle{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;line-height:18px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
body[data-ds-dark-theme] .mc-card[data-state=running] .mc-cardTitle{text-shadow:0 0 12px color-mix(in srgb,var(--mc-run) 20%,transparent)}
.mc-cardSub{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}
.mc-cardMetrics{display:flex;gap:10px;flex-wrap:wrap;font-family:var(--mc-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.mc-metric{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.mc-metricValue{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums slashed-zero;letter-spacing:.02em;font-size:10.5px;text-transform:none}
.mc-metricValue[data-tone=warn]{color:var(--cc-ink-warn)}
.mc-metricValue[data-tone=err]{color:var(--cc-ink-err)}
.mc-metricValue[data-tone=run]{color:var(--cc-ink-run)}
.mc-prog{display:flex;align-items:center;gap:7px;min-width:0}
.mc-bar{position:relative;flex:1 1 auto;height:6px;border-radius:0;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 82%,transparent);overflow:hidden;min-width:26px}
.mc-bar::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 1px),var(--cc-hair-hi) calc(25% - 1px) 25%)}
.mc-barFill{position:absolute;inset:0 auto 0 0;height:100%;background:linear-gradient(90deg,color-mix(in srgb,var(--mc-run) 45%,transparent),var(--mc-run));box-shadow:0 0 10px -2px var(--mc-run);-webkit-mask-image:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 8px);mask-image:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 8px);transition:width .24s cubic-bezier(.2,.8,.2,1)}
.mc-barFill[data-done=true]{background:var(--mc-ok);box-shadow:none}
.mc-progText{color:var(--dsw-alias-label-tertiary);font-size:10px;font-family:var(--mc-mono);font-variant-numeric:tabular-nums slashed-zero;white-space:nowrap;letter-spacing:.04em}
.mc-kids{display:flex;flex-direction:column;gap:1px;padding-left:2px;border-left:1px solid var(--cc-hair);margin-left:3px}
.mc-kid{display:flex;align-items:center;gap:6px;padding:2px 4px 2px 8px;border-radius:1px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.mc-kid:hover{background:var(--cc-tint)}
.mc-kidName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-kidMeta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9.5px;font-family:var(--mc-mono);white-space:nowrap;letter-spacing:.06em;text-transform:uppercase}
.mc-cardFoot{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;font-family:var(--mc-mono);letter-spacing:.1em;text-transform:uppercase}
.mc-cardFootSpacer{flex:1 1 auto}

/* ---------- status marks ---------- */
.mc-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--mc-idle);margin-top:5px}
.mc-dot[data-state=needs]{width:8px;height:8px;border-radius:0;background:var(--mc-warn);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:none}
.mc-dot[data-state=running]{background:var(--mc-run);box-shadow:0 0 0 1px color-mix(in srgb,var(--mc-run) 55%,transparent),0 0 6px 0 color-mix(in srgb,var(--mc-run) 55%,transparent),0 0 14px 2px color-mix(in srgb,var(--mc-run) 16%,transparent);animation:mc-breathe 2.4s cubic-bezier(.45,0,.55,1) infinite,mc-beat 2.4s ease-in-out infinite}
@keyframes mc-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
.mc-dot[data-state=done]{background:var(--mc-ok);box-shadow:0 0 0 1px color-mix(in srgb,var(--mc-ok) 40%,transparent)}
.mc-dot[data-state=err]{background:var(--mc-err);animation:mc-fault 4.5s steps(1,end) infinite}
@keyframes mc-breathe{0%,100%{opacity:1}50%{opacity:.62}}
@keyframes mc-fault{0%,86%,100%{opacity:1}88%,92%{opacity:.3}}

/* ---------- chips ---------- */
.mc-chip{flex:none;border-radius:1px;padding:0 6px;font-size:9.5px;line-height:16px;border:1px solid var(--cc-hair);color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-family:var(--mc-mono);letter-spacing:.1em;text-transform:uppercase;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 30%,transparent)}
.mc-chip[data-tone=needs]{border-color:color-mix(in srgb,var(--mc-warn) 50%,var(--cc-hair));color:var(--cc-ink-warn);background:color-mix(in srgb,var(--mc-warn) 8%,transparent)}
.mc-chip[data-tone=run]{border-color:color-mix(in srgb,var(--mc-run) 48%,var(--cc-hair));color:var(--cc-ink-run);background:color-mix(in srgb,var(--mc-run) 8%,transparent)}
.mc-chip[data-tone=ok]{border-color:color-mix(in srgb,var(--mc-ok) 48%,var(--cc-hair));color:var(--cc-ink-ok);background:color-mix(in srgb,var(--mc-ok) 8%,transparent)}
button.mc-chip{cursor:pointer}
button.mc-chip:hover{border-color:var(--cc-hair-hi);color:var(--dsw-alias-label-primary)}
.mc-open{width:20px;height:20px;border-radius:1px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;flex:none}
.mc-open:hover{background:var(--cc-tint);color:var(--cc-accent-ink)}
.mc-open:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color)}

/* ---------- matrix view ---------- */
.mc-matrix{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--cc-hair);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 42%,transparent)}
.mc-matrixScroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 10px}
.mc-headRow,.mc-row{display:grid;grid-template-columns:20px minmax(0,1fr) 92px 138px 62px 82px 62px 26px;align-items:center;gap:10px;padding:0 8px}
.mc-headRow{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-family:var(--mc-mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;height:26px;border-bottom:1px solid var(--cc-hair)}
.mc-groupHead{display:flex;align-items:center;gap:8px;margin:11px 8px 3px;color:var(--dsw-alias-label-secondary);font-family:var(--mc-mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:600}
.mc-groupHead::after{content:"";flex:1 1 auto;height:1px;background:var(--cc-hair)}
.mc-groupEmpty{color:var(--dsw-alias-label-tertiary);font-size:10px;padding:2px 10px 6px;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}
.mc-row{min-height:36px;border-radius:1px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%}
.mc-row:hover{background:var(--cc-tint)}
.mc-row[data-selected=true]{background:var(--cc-tint);box-shadow:inset 2px 0 0 var(--cc-accent)}
.mc-row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-1px}
.mc-row[data-child=true]{min-height:30px}
.mc-name{min-width:0;display:flex;flex-direction:column;gap:0}
.mc-nameMain{display:flex;align-items:center;gap:6px;min-width:0}
.mc-nameText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.mc-nameText[data-quiet=true]{font-weight:400;color:var(--dsw-alias-label-secondary)}
.mc-subText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:13px;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}
.mc-indent{flex:none;width:14px;color:var(--dsw-alias-border-l4);font-family:var(--mc-mono);font-size:10px;white-space:pre}
.mc-cell{color:var(--dsw-alias-label-secondary);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums slashed-zero;font-family:var(--mc-mono);letter-spacing:.04em}
.mc-cell[data-muted=true]{color:var(--dsw-alias-label-tertiary)}

/* ---------- foot ---------- */
.mc-foot{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 20px;border-top:1px solid var(--cc-hair);color:var(--dsw-alias-label-tertiary);font-family:var(--mc-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase}
.mc-sys{color:var(--cc-accent-ink);border:1px solid color-mix(in srgb,var(--cc-accent) 35%,var(--cc-hair));padding:0 5px;line-height:15px;border-radius:1px}
.mc-hint{color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.mc-footSpacer{flex:1 1 auto}

/* ---------- drawer ---------- */
.mc-scrim{position:absolute;inset:0;z-index:4;background:linear-gradient(90deg,transparent,color-mix(in srgb,#000 34%,transparent))}
.mc-drawer{position:absolute;top:0;right:0;bottom:0;width:min(420px,44vw);display:flex;flex-direction:column;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 97%,transparent);border-left:1px solid color-mix(in srgb,var(--cc-accent) 40%,var(--cc-hair));box-shadow:-32px 0 64px -48px #000,-1px 0 0 color-mix(in srgb,var(--cc-accent) 18%,transparent);z-index:5;animation:mc-drawer-in .18s cubic-bezier(.2,.8,.2,1) both}
@keyframes mc-drawer-in{from{transform:translateX(14px);opacity:0}to{transform:none;opacity:1}}
.mc-drawerHead{flex:none;display:flex;align-items:flex-start;gap:8px;padding:11px 14px 9px;border-bottom:1px solid var(--cc-hair);position:relative}
.mc-drawerHead::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:1px;background:linear-gradient(90deg,var(--cc-accent),transparent)}
html[data-platform=darwin] .mc-drawerHead{padding-top:calc(11px + var(--dsh-frame-top-clearance,0px))}
.mc-drawerTitle{flex:1 1 auto;min-width:0;margin:0;font-size:14px;font-weight:600;line-height:20px;overflow-wrap:anywhere}
.mc-drawerBody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:11px 14px 15px;display:flex;flex-direction:column;gap:13px}
.mc-section{display:flex;flex-direction:column;gap:5px}
.mc-sectionTitle{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-family:var(--mc-mono);font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.mc-sectionTitle::before{content:"";width:10px;height:1px;background:var(--cc-accent);opacity:.7}
.mc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:11.5px;margin:0}
.mc-kv dt{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-family:var(--mc-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.mc-kv dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.mc-list{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.mc-item{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;line-height:17px}
.mc-itemDot{flex:none;width:5px;height:5px;border-radius:0;margin-top:6px;background:var(--mc-idle)}
.mc-itemDot[data-status=in_progress]{background:var(--mc-run)}
.mc-itemDot[data-status=completed]{background:var(--mc-ok)}
.mc-itemDot[data-status=pending]{background:var(--mc-warn)}
.mc-itemText{min-width:0;overflow-wrap:anywhere}
.mc-itemText[data-status=completed]{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}
.mc-itemMeta{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:9.5px;white-space:nowrap;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}
.mc-zone{border:1px dashed var(--cc-hair);border-radius:2px;padding:7px 9px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;display:flex;flex-direction:column;gap:3px;font-family:var(--mc-mono);letter-spacing:.06em}
.mc-zoneTitle{color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.mc-drawerFoot{flex:none;display:flex;gap:7px;padding:9px 14px 13px;border-top:1px solid var(--cc-hair)}
.mc-primary{background:color-mix(in srgb,var(--cc-accent) 20%,transparent);border-color:color-mix(in srgb,var(--cc-accent) 55%,var(--cc-hair));color:var(--cc-accent-ink)}
.mc-primary:hover{background:color-mix(in srgb,var(--cc-accent) 30%,transparent)}
.mc-center{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:12px;font-family:var(--mc-mono)}
.mc-empty{color:var(--dsw-alias-label-tertiary);font-size:11px;padding:18px 10px;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}

/* ---------- node canvas ---------- */
.mc-canvas{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;touch-action:none;user-select:none;cursor:grab;border:1px solid var(--cc-hair);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 30%,transparent)}
.mc-canvas[data-panning=true]{cursor:grabbing}
.mc-canvas[data-dragging=true] .mc-node{cursor:grabbing}
.mc-canvasWorld{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.mc-canvasEdges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.mc-edge{fill:none;stroke:color-mix(in srgb,var(--cc-accent) 45%,var(--dsw-alias-border-l4));stroke-width:1.6;stroke-linecap:round}
.mc-edge[data-live=true]{stroke:color-mix(in srgb,var(--mc-run) 72%,transparent);stroke-width:1.9;stroke-dasharray:6 6;animation:mc-edge-flow 1.4s linear infinite}
.mc-edge[data-active=true]{stroke:var(--cc-accent);stroke-width:2.3;filter:drop-shadow(0 0 3px var(--cc-glow))}
.mc-edge[data-active=true][data-live=true]{stroke:var(--mc-run)}
@keyframes mc-edge-flow{to{stroke-dashoffset:-24}}
.mc-cluster{position:absolute;border:1px dashed color-mix(in srgb,var(--cc-accent) 26%,var(--cc-hair));border-radius:4px;background:color-mix(in srgb,var(--cc-accent) 3%,transparent);pointer-events:none}
.mc-clusterLabel{position:absolute;transform:translateY(-100%);padding:0 6px;font-family:var(--mc-mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base);border:1px solid var(--cc-hair);border-left:2px solid var(--cc-accent);line-height:15px;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.mc-node{position:absolute;cursor:grab;display:flex;flex-direction:column;gap:5px;padding:8px 9px;border:1px solid var(--cc-hair);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 94%,transparent);cursor:pointer;box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 4%,transparent);transition:border-color .12s linear}
.mc-node:hover{border-color:color-mix(in srgb,var(--cc-accent) 45%,var(--cc-hair))}
.mc-node[data-selected=true]{border-color:var(--cc-accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--cc-accent) 40%,transparent),0 0 24px -14px var(--cc-accent)}
.mc-node[data-state=needs]{border-color:color-mix(in srgb,var(--mc-warn) 52%,var(--cc-hair))}
.mc-node[data-state=failed]{border-color:color-mix(in srgb,var(--mc-err) 55%,var(--cc-hair))}
.mc-node[data-state=running]{box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 4%,transparent),0 0 0 1px color-mix(in srgb,var(--mc-run) 24%,transparent)}
.mc-node:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-nodeKind{flex:none;font-family:var(--mc-mono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);border:1px solid var(--cc-hair);padding:0 4px;line-height:12px;border-radius:1px}
.mc-canvasOptions{position:absolute;left:10px;top:10px;z-index:3;display:flex;gap:6px;flex-wrap:wrap}
.mc-canvasCtl{position:absolute;right:10px;bottom:10px;z-index:3;display:flex;align-items:center;gap:3px;padding:4px 5px;border:1px solid var(--cc-hair);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 94%,transparent)}
.mc-canvasZoom{font-family:var(--mc-mono);font-size:10px;color:var(--dsw-alias-label-tertiary);min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
.mc-itemLink{cursor:pointer;border-radius:2px}
.mc-itemLink:hover .mc-itemText{color:var(--cc-accent-ink);text-decoration:underline;text-underline-offset:2px}
.mc-preview{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 98%,transparent);border:1px solid color-mix(in srgb,var(--cc-accent) 30%,var(--cc-hair))}
.mc-previewHead{flex:none;display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--cc-hair);min-width:0}
html[data-platform=darwin] .mc-previewHead{padding-top:calc(9px + var(--dsh-frame-top-clearance,0px))}
.mc-previewName{flex:1 1 auto;min-width:0;font-family:var(--mc-mono);font-size:11px;letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-previewPath{flex:none;max-width:46%;color:var(--dsw-alias-label-tertiary);font-family:var(--mc-mono);font-size:9.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.mc-previewBody{flex:1 1 auto;min-height:0;overflow:auto;padding:10px 12px}
.mc-previewText{margin:0;font-family:var(--mc-mono);font-size:11.5px;line-height:17px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.mc-previewImage{display:block;max-width:100%;max-height:100%;margin:0 auto;object-fit:contain;background:repeating-conic-gradient(color-mix(in srgb,var(--dsw-alias-bg-layer-3) 60%,transparent) 0 25%,transparent 0 50%) 0 0/16px 16px}
.mc-settingsRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid color-mix(in srgb,var(--cc-hair) 70%,transparent)}
.mc-settingsLabel{color:var(--dsw-alias-label-secondary);font-size:12px}
.mc-previewNote{color:var(--dsw-alias-label-tertiary);font-size:11px;font-family:var(--mc-mono);letter-spacing:.04em}
.mc-previewFoot{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--cc-hair)}
.mc-canvasHint{position:absolute;left:10px;bottom:12px;z-index:3;color:var(--dsw-alias-label-tertiary);font-family:var(--mc-mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
.mc-canvasEmpty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:11px;font-family:var(--mc-mono);letter-spacing:.08em;text-transform:uppercase}

@media (max-width:980px){.mc-board{grid-template-columns:repeat(4,minmax(186px,1fr))}.mc-headRow,.mc-row{grid-template-columns:20px minmax(0,1fr) 78px 110px 52px 26px}.mc-colCtx,.mc-colOut{display:none}}
@media (max-width:720px){.mc-board{grid-template-columns:1fr;overflow-y:auto}}
@media (prefers-reduced-motion:reduce){
  .mc-card{animation:none;transition:none}
  .mc-head::before{animation:none;opacity:0}
  .mc-dot[data-state=running]{animation:none;box-shadow:0 0 0 1px var(--mc-run)}
  .mc-dot[data-state=err]{animation:none}
  .mc-dot[data-state=running]{animation:none}
  .mc-card[data-state=running]{animation:none}
  .mc-col[data-state=running]::after{animation:none;background:var(--mc-run);background-size:100% 100%}
  .mc-body::before{animation:none;opacity:0}
  .mc-drawer{animation:none}
  .mc-card:hover{transform:none}
}
`;

    const ICON_PATH =
      'M4 4.6A.6.6 0 0 1 4.6 4h6.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6zM13.4 4h6a.6.6 0 0 1 .6.6v3.8a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6V4.6a.6.6 0 0 1 .6-.6zM13.4 10.6h6a.6.6 0 0 1 .6.6v8.2a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6v-8.2a.6.6 0 0 1 .6-.6zM4 14h6.8a.6.6 0 0 1 .6.6v4.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6v-4.8A.6.6 0 0 1 4 14z';

    function DiamondMark() {
      return h(
        'svg',
        { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M5 0.9 9.1 5 5 9.1 0.9 5z', stroke: 'currentColor', 'stroke-width': 1.1 }),
      );
    }

    function MissionIcon(props) {
      const size = isNum(props && props.size) ? props.size : 18;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: ICON_PATH, fill: 'currentColor', opacity: props && props.active ? 1 : 0.72 }),
      );
    }
    // #endregion

    // #region shared bits
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        if (this.state.failed) return h('div', { className: 'mc-root' }, h('div', { className: 'mc-center' }, this.props.label));
        return this.props.children;
      }
    }

    function Dot(props) {
      return h('span', { className: 'mc-dot', 'data-state': props.state, 'aria-hidden': true });
    }

    function ContextValue(props) {
      const context = props.context;
      if (!context || !isNum(context.pct)) return h('span', { className: 'mc-metricValue' }, '—');
      const tone = context.pct >= 85 ? 'err' : context.pct >= 65 ? 'warn' : undefined;
      return h('span', { className: 'mc-metricValue', 'data-tone': tone }, `${context.pct}%`);
    }

    function RelativeTime(props) {
      const { view, now, t } = props;
      const timing = view.timing;
      if (timing && timing.ms > 0) return h('span', null, relLabel(timing.ms, t));
      const updated = view.row && isNum(view.row.updatedAt) ? view.row.updatedAt : 0;
      if (updated > 0) return h('span', null, relLabel(Math.max(0, now - updated), t));
      return h('span', null, '—');
    }
    // #endregion

    // #region board view
    function BoardCard(props) {
      const { view, model, t, now, selected, onSelect, onOpen, expanded, onToggle } = props;
      const state = stateOf(view);
      const kids = orderedChildren(view);
      const focusCanvas = props.onFocusCanvas;
      const kidsOpen = expanded[view.id] !== false;
      const totalKids = view.children.length;
      const moreKids = countDescendants(view, model) - totalKids;
      const live = liveChildren(view, model);
      const stagger = Math.min(isNum(props.index) ? props.index : 0, 5);
      const chainLabel = totalKids === 0 ? t('chainMain') : `${t('chainMain')}+${totalKids}${t('chainChild')}`;
      return h(
        'div',
        {
          className: 'mc-card',
          style: { animationDelay: `${stagger * 24}ms` },
          'data-state': state,
          'data-selected': selected,
          role: 'button',
          tabIndex: -1,
          'aria-current': selected ? 'true' : undefined,
          onClick: () => onSelect(view.id),
          onDoubleClick: () => onOpen(view.id),
        },
        h(
          'div',
          { className: 'mc-cardTop' },
          h(Dot, { state }),
          h('span', { className: 'mc-cardTitle', title: view.title }, view.title),
          view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'needs' }, t(`kind.${view.pending.kind}`)) : null,
          view.unread && !view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'ok' }, '·') : null,
          focusCanvas
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mc-open',
                  title: t('action.canvas'),
                  'aria-label': t('action.canvas'),
                  onClick: (event) => {
                    event.stopPropagation();
                    focusCanvas(view.id);
                  },
                },
                '⌗',
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'mc-open',
              title: t('action.open'),
              'aria-label': t('action.open'),
              onClick: (event) => {
                event.stopPropagation();
                onOpen(view.id);
              },
            },
            h(
              'svg',
              { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('path', {
                d: 'M6 3.5h6.5V10M12.5 3.5 4 12',
                stroke: 'currentColor',
                'stroke-width': 1.4,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
              }),
            ),
          ),
        ),
        view.workspace ? h('div', { className: 'mc-cardSub', title: view.workspace }, view.workspace) : null,
        h(
          'div',
          { className: 'mc-cardMetrics' },
          h('span', { className: 'mc-metric' }, t('metric.agents'), h('span', { className: 'mc-metricValue', 'data-tone': live > 0 ? 'run' : undefined }, chainLabel)),
          live > 0 ? h('span', { className: 'mc-chip', 'data-tone': 'run' }, `${live}${t('chainRunning')}`) : null,
          h('span', { className: 'mc-metric' }, t('metric.context'), h(ContextValue, { context: view.context })),
        ),
        h(
          'div',
          { className: 'mc-prog' },
          view.todos
            ? h(
                'div',
                { className: 'mc-bar', role: 'progressbar', 'aria-valuenow': view.todos.done, 'aria-valuemax': view.todos.total },
                h('div', {
                  className: 'mc-barFill',
                  'data-done': view.todos.done === view.todos.total,
                  style: { width: `${view.todos.total > 0 ? Math.round((view.todos.done / view.todos.total) * 100) : 0}%` },
                }),
              )
            : h('div', { className: 'mc-bar' }),
          h('span', { className: 'mc-progText' }, view.todos ? `${view.todos.done}/${view.todos.total}` : '—'),
        ),
        totalKids > 0
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'mc-cardFoot' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mc-chip',
                    'aria-expanded': kidsOpen,
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggle(view.id);
                    },
                  },
                  kidsOpen ? `−${totalKids}` : `+${totalKids}`,
                ),
                moreKids > 0 ? h('span', { className: 'mc-chip', title: t('moreChildren').replace('{n}', String(moreKids)) }, `+${moreKids}`) : null,
              ),
              kidsOpen
                ? h(
                    'div',
                    { className: 'mc-kids' },
                    kids.map((child) => {
                      const childView = model.viewOf(child);
                      return h(
                        'div',
                        { className: 'mc-kid', key: child.id },
                        h(Dot, { state: stateOf(childView) }),
                        h('span', { className: 'mc-kidName', title: childView.title }, childView.title),
                        childView.pending ? h('span', { className: 'mc-kidMeta' }, t(`kind.${childView.pending.kind}`)) : null,
                        h('span', { className: 'mc-kidMeta' }, h(RelativeTime, { view: childView, now, t })),
                      );
                    }),
                  )
                : null,
            )
          : null,
        h(
          'div',
          { className: 'mc-cardFoot' },
          h('span', null, h(RelativeTime, { view, now, t })),
          h('span', { className: 'mc-cardFootSpacer' }),
          h('span', { title: outputTitle(view.output, t) }, `${t('metric.output')} ${outputCode(view.output) || t('outputPlaceholder')}`),
        ),
      );
    }

    function Board(props) {
      const { groups, model, t, now, selectedId, onSelect, onOpen, expanded, onToggle, onFocusCanvas } = props;
      return h(
        'div',
        { className: 'mc-board', role: 'list' },
        ['needs', 'running', 'failed', 'idle'].map((state, columnIndex) =>
          h(
            'section',
            { className: 'mc-col', key: state, 'data-state': state, 'aria-label': t(`group.${state}`) },
            h(
              'header',
              { className: 'mc-colHead' },
              h('span', { className: 'mc-colIndex' }, `CH-0${columnIndex + 1}`),
              h('span', { className: 'mc-colName' }, t(`group.${state}`)),
              h('span', { className: 'mc-colCount' }, String(groups[state].length).padStart(2, '0')),
            ),
            h(
              'div',
              { className: 'mc-colBody' },
              groups[state].length === 0
                ? h('div', { className: 'mc-colEmpty' }, t(`groupEmpty.${state}`))
                : groups[state].map((view, cardIndex) =>
                    h(BoardCard, {
                      key: view.id,
                      view,
                      model,
                      t,
                      now,
                      index: cardIndex,
                      selected: selectedId === view.id,
                      onSelect,
                      onOpen,
                      onFocusCanvas,
                      expanded,
                      onToggle,
                    }),
                  ),
            ),
          ),
        ),
      );
    }
    // #endregion

    // #region node canvas
    const NODE_W = 264;
    const NODE_H = 92;
    const NODE_GAP_X = 74;
    const NODE_GAP_Y = 18;
    const CLUSTER_PAD = 16;
    const CLUSTER_GAP = 46;
    const MIN_ZOOM = 0.35;
    const MAX_ZOOM = 1.6;

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    const CANVAS_STORE_KEY = 'dsh.command-centre.canvas.v1';
    const CANVAS_PREFS_ROUTE = 'api/command-centre.prefs';

    function readLocalCanvasPrefs() {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = window.localStorage.getItem(CANVAS_STORE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }

    function writeLocalCanvasPrefs(value) {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(CANVAS_STORE_KEY, JSON.stringify(value));
      } catch {
        /* private mode / quota: layout memory is best-effort */
      }
    }

    /** Host route survives an App restart (the Web origin's port changes per launch). */
    let prefsCache = null;
    let prefsInflight = null;

    async function fetchServerPrefs() {
      try {
        if (typeof fetch === 'function') {
          const response = await fetch(CANVAS_PREFS_ROUTE, { headers: { accept: 'application/json' }, cache: 'no-store' });
          if (response.ok) {
            const body = await response.json();
            if (body && typeof body === 'object' && !Array.isArray(body)) return body;
          }
        }
      } catch {
        /* route unavailable (older Host or no cache yet) */
      }
      return null;
    }

    async function ensurePrefs() {
      if (prefsCache) return prefsCache;
      if (!prefsInflight) {
        prefsInflight = (async () => {
          const local = readLocalCanvasPrefs() || {};
          const server = await fetchServerPrefs();
          prefsCache = { ...local, ...(server || {}) };
          return prefsCache;
        })().finally(() => {
          prefsInflight = null;
        });
      }
      return prefsInflight;
    }

    function updatePrefs(patch) {
      prefsCache = { ...(prefsCache || {}), ...patch };
      writeLocalCanvasPrefs(prefsCache);
      try {
        if (typeof fetch !== 'function') return;
        fetch(CANVAS_PREFS_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(prefsCache),
        }).catch(() => {});
      } catch {
        /* persistence is best-effort */
      }
    }

    /**
     * Tidy layered layout. One column/row per depth, leaves stacked in source
     * order, parents centered on the first/last child, single-child chains
     * straight. `direction` is 'lr' (columns) or 'tb' (rows); `overrides` holds
     * the user's manual node offsets so edges and clusters follow a dragged node.
     */
    function layoutForest(roots, model, direction, overrides) {
      const horizontal = direction !== 'tb';
      const breadthSize = horizontal ? NODE_H : NODE_W;
      const breadthGap = horizontal ? NODE_GAP_Y : 26;
      const depthSize = horizontal ? NODE_W : NODE_H;
      const depthGap = horizontal ? NODE_GAP_X : 70;
      const nodes = [];
      const byId = new Map();
      const rootNodes = [];
      let cursor = 0;
      const place = (view, depth) => {
        const kids = orderedChildren(view).map((child) => model.viewOf(child));
        let slot;
        if (kids.length === 0) {
          slot = cursor;
          cursor += breadthSize + breadthGap;
        } else {
          const placed = kids.map((kid) => place(kid, depth + 1));
          slot = (placed[0].slot + placed[placed.length - 1].slot) / 2;
        }
        const along = depth * (depthSize + depthGap);
        const node = {
          id: view.id,
          view,
          depth,
          slot,
          x: horizontal ? along : slot,
          y: horizontal ? slot : along,
          w: NODE_W,
          h: NODE_H,
          childIds: kids.map((kid) => kid.id),
        };
        nodes.push(node);
        byId.set(node.id, node);
        return node;
      };

      for (const root of roots) {
        rootNodes.push(place(root, 0));
        cursor += horizontal ? CLUSTER_GAP : CLUSTER_GAP;
      }

      // Manual offsets first, so every derived box (cluster, edge, size) follows.
      if (overrides) {
        for (const node of nodes) {
          const offset = overrides[node.id];
          if (!offset) continue;
          node.x += offset.dx;
          node.y += offset.dy;
        }
      }

      const clusters = [];
      for (const rootNode of rootNodes) {
        const subtree = [];
        const walk = (node) => {
          subtree.push(node);
          for (const childId of node.childIds) {
            const child = byId.get(childId);
            if (child) walk(child);
          }
        };
        walk(rootNode);
        const minX = Math.min(...subtree.map((node) => node.x)) - CLUSTER_PAD;
        const maxX = Math.max(...subtree.map((node) => node.x + node.w)) + CLUSTER_PAD;
        const minY = Math.min(...subtree.map((node) => node.y)) - CLUSTER_PAD;
        const maxY = Math.max(...subtree.map((node) => node.y + node.h)) + CLUSTER_PAD;
        clusters.push({ id: rootNode.id, title: rootNode.view.title, x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      }

      const pad = 40;
      const minX = Math.min(0, ...nodes.map((node) => node.x));
      const minY = Math.min(0, ...nodes.map((node) => node.y));
      const shiftX = pad - minX;
      const shiftY = pad - minY;
      for (const node of nodes) {
        node.x += shiftX;
        node.y += shiftY;
      }
      for (const cluster of clusters) {
        cluster.x += shiftX;
        cluster.y += shiftY;
      }

      const edges = [];
      for (const node of nodes) {
        const parentId = node.view.row && typeof node.view.row.parentId === 'string' ? node.view.row.parentId : undefined;
        const from = parentId ? byId.get(parentId) : undefined;
        if (!from) continue;
        let d;
        let ortho;
        if (horizontal) {
          const sx = from.x + from.w;
          const sy = from.y + from.h / 2;
          const ex = node.x;
          const ey = node.y + node.h / 2;
          const reach = Math.max(28, (ex - sx) * 0.45);
          d = `M ${sx} ${sy} C ${sx + reach} ${sy}, ${ex - reach} ${ey}, ${ex} ${ey}`;
          ortho = `M ${sx} ${sy} H ${(sx + ex) / 2} V ${ey} H ${ex}`;
        } else {
          const sx = from.x + from.w / 2;
          const sy = from.y + from.h;
          const ex = node.x + node.w / 2;
          const ey = node.y;
          const reach = Math.max(24, (ey - sy) * 0.45);
          d = `M ${sx} ${sy} C ${sx} ${sy + reach}, ${ex} ${ey - reach}, ${ex} ${ey}`;
          ortho = `M ${sx} ${sy} V ${(sy + ey) / 2} H ${ex} V ${ey}`;
        }
        edges.push({ id: `${from.id}->${node.id}`, from: from.id, to: node.id, d, ortho, live: node.view.running });
      }

      const width = Math.max(NODE_W, ...nodes.map((node) => node.x + node.w)) + pad;
      const height = Math.max(NODE_H, ...nodes.map((node) => node.y + node.h)) + pad;
      return { nodes, byId, edges, clusters, width, height };
    }

    function CanvasNode(props) {
      const { node, model, t, now, selected, onSelect, onOpen } = props;
      const view = node.view;
      const state = stateOf(view);
      const live = liveChildren(view, model);
      const kids = view.children.length;
      const chainLabel = kids === 0 ? t('chainMain') : `${t('chainMain')}+${kids}${t('chainChild')}`;
      return h(
        'div',
        {
          className: 'mc-node',
          'data-state': state,
          'data-selected': selected,
          'data-node-id': node.id,
          role: 'button',
          tabIndex: -1,
          'aria-current': selected ? 'true' : undefined,
          title: view.title,
          style: { left: node.x, top: node.y, width: node.w, height: node.h },
          onDoubleClick: () => onOpen(view.id),
        },
        h(
          'div',
          { className: 'mc-cardTop' },
          h(Dot, { state }),
          h('span', { className: 'mc-cardTitle' }, view.title),
          h('span', { className: 'mc-nodeKind' }, view.isChild ? t('canvas.sub') : t('canvas.root')),
          view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'needs' }, t(`kind.${view.pending.kind}`)) : null,
        ),
        h(
          'div',
          { className: 'mc-cardMetrics' },
          h('span', { className: 'mc-metric' }, t('metric.agents'), h('span', { className: 'mc-metricValue', 'data-tone': live > 0 ? 'run' : undefined }, chainLabel)),
          live > 0 ? h('span', { className: 'mc-chip', 'data-tone': 'run' }, `${live}${t('chainRunning')}`) : null,
          h('span', { className: 'mc-metric' }, t('metric.context'), h(ContextValue, { context: view.context })),
        ),
        h(
          'div',
          { className: 'mc-prog' },
          view.todos
            ? h(
                'div',
                { className: 'mc-bar', role: 'progressbar', 'aria-valuenow': view.todos.done, 'aria-valuemax': view.todos.total },
                h('div', {
                  className: 'mc-barFill',
                  'data-done': view.todos.done === view.todos.total,
                  style: { width: `${view.todos.total > 0 ? Math.round((view.todos.done / view.todos.total) * 100) : 0}%` },
                }),
              )
            : h('div', { className: 'mc-bar' }),
          h('span', { className: 'mc-progText' }, view.todos ? `${view.todos.done}/${view.todos.total}` : '—'),
        ),
        h(
          'div',
          { className: 'mc-cardFoot' },
          h('span', null, h(RelativeTime, { view, now, t })),
          h('span', { className: 'mc-cardFootSpacer' }),
          h('span', { title: outputTitle(view.output, t) }, `${t('metric.output')} ${outputCode(view.output) || t('outputPlaceholder')}`),
        ),
      );
    }

    function Canvas(props) {
      const { groups, model, t, now, selectedId, onSelect, onOpen, focus, fitRef } = props;
      const stored = React.useMemo(() => readLocalCanvasPrefs(), []);
      const [direction, setDirection] = React.useState(stored && stored.direction === 'lr' ? 'lr' : 'tb');

      const [edgeStyle, setEdgeStyle] = React.useState(stored && stored.edgeStyle === 'curve' ? 'curve' : 'ortho');
      const [overrides, setOverrides] = React.useState(() => {
        const saved = stored && stored.overrides;
        return saved && typeof saved === 'object' ? saved : {};
      });
      const touchedRef = React.useRef(false);
      const [hydrated, setHydrated] = React.useState(false);
      const changeDirection = (value) => {
        touchedRef.current = true;
        setDirection(value);
      };
      const changeEdgeStyle = (value) => {
        touchedRef.current = true;
        setEdgeStyle(value);
      };

      React.useEffect(() => {
        let alive = true;
        ensurePrefs().then((prefs) => {
          if (!alive) return;
          if (prefs && !touchedRef.current) {
            if (prefs.direction === 'lr' || prefs.direction === 'tb') setDirection(prefs.direction);
              if (prefs.edgeStyle === 'curve' || prefs.edgeStyle === 'ortho') setEdgeStyle(prefs.edgeStyle);
            if (prefs.overrides && typeof prefs.overrides === 'object' && !Array.isArray(prefs.overrides)) setOverrides(prefs.overrides);
          }
          setHydrated(true);
        });
        return () => {
          alive = false;
        };
      }, []);
      const overridesRef = React.useRef(overrides);
      overridesRef.current = overrides;
      const focusId = focus && focus.id ? focus.id : undefined;
      const roots = React.useMemo(() => ['needs', 'running', 'failed', 'idle'].flatMap((state) => groups[state]), [groups]);
      const layout = React.useMemo(
        () => layoutForest(roots, model, direction, overrides),
        [roots, model, direction, overrides],
      );
      const [camera, setCamera] = React.useState({ x: 24, y: 24, k: 1 });
      const cameraRef = React.useRef(camera);
      cameraRef.current = camera;
      const wrapRef = React.useRef(null);
      const panRef = React.useRef(null);
      const fittedRef = React.useRef('');
      const [panning, setPanning] = React.useState(false);

      const fit = React.useCallback(
        (onlyId) => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          const width = wrap.clientWidth;
          const height = wrap.clientHeight;
          if (!width || !height) return;
          let list = layout.nodes;
          if (onlyId && layout.byId.has(onlyId)) {
            const keep = new Set();
            const walk = (id) => {
              const node = layout.byId.get(id);
              if (!node) return;
              keep.add(id);
              for (const childId of node.childIds) walk(childId);
            };
            walk(onlyId);
            list = layout.nodes.filter((node) => keep.has(node.id));
          }
          if (list.length === 0) return;
          const minX = Math.min(...list.map((node) => node.x));
          const maxX = Math.max(...list.map((node) => node.x + node.w));
          const minY = Math.min(...list.map((node) => node.y));
          const maxY = Math.max(...list.map((node) => node.y + node.h));
          const pad = 30;
          const k = clamp(Math.min((width - pad * 2) / Math.max(1, maxX - minX), (height - pad * 2) / Math.max(1, maxY - minY), 1), MIN_ZOOM, 1);
          setCamera({
            x: pad + (width - pad * 2 - (maxX - minX) * k) / 2 - minX * k,
            y: pad + (height - pad * 2 - (maxY - minY) * k) / 2 - minY * k,
            k,
          });
        },
        [layout],
      );

      React.useEffect(() => {
        // Never write defaults over stored preferences before hydration resolved.
        if (!hydrated) return undefined;
        const timer = setTimeout(() => updatePrefs({ direction, edgeStyle, overrides }), 250);
        return () => clearTimeout(timer);
      }, [hydrated, direction, edgeStyle, overrides]);

      React.useEffect(() => {
        const key = `${focusId || 'all'}:${focus && focus.nonce ? focus.nonce : 0}:${layout.nodes.length}:${direction}`;
        if (fittedRef.current === key) return;
        fittedRef.current = key;
        fit(focusId);
      }, [fit, focusId, focus, layout, direction]);

      React.useEffect(() => {
        if (fitRef) fitRef.current = () => fit(focusId);
      }, [fit, fitRef, focusId]);

      React.useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return undefined;
        const onWheel = (event) => {
          event.preventDefault();
          const rect = wrap.getBoundingClientRect();
          const px = event.clientX - rect.left;
          const py = event.clientY - rect.top;
          const current = cameraRef.current;
          // A plain wheel zooms around the pointer; Shift+wheel keeps a pan escape hatch
          // for trackpads that scroll horizontally.
          if (event.shiftKey) {
            setCamera({ x: current.x - event.deltaX, y: current.y - event.deltaY, k: current.k });
            return;
          }
          const delta = event.deltaY || event.deltaX;
          const factor = Math.exp(-delta * 0.0015);
          const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
          const ratio = k / current.k;
          setCamera({ x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio, k });
        };
        wrap.addEventListener('wheel', onWheel, { passive: false });
        return () => wrap.removeEventListener('wheel', onWheel);
      }, []);

      const [draggingNode, setDraggingNode] = React.useState(false);
      const dragRef = React.useRef(null);

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        const target = event.target;
        const nodeEl = target && typeof target.closest === 'function' ? target.closest('.mc-node') : null;
        if (nodeEl) {
          const id = nodeEl.getAttribute('data-node-id');
          if (!id) return;
          const base = overridesRef.current[id] || { dx: 0, dy: 0 };
          touchedRef.current = true;
          dragRef.current = { mode: 'node', id, x: event.clientX, y: event.clientY, base, moved: false };
          setDraggingNode(true);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture is optional */
          }
          return;
        }
        if (target && typeof target.closest === 'function' && target.closest('button')) return;
        dragRef.current = { mode: 'pan', x: event.clientX, y: event.clientY, camera: cameraRef.current };
        setPanning(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* pointer capture is optional */
        }
      };
      const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.mode === 'pan') {
          setCamera({ x: drag.camera.x + (event.clientX - drag.x), y: drag.camera.y + (event.clientY - drag.y), k: drag.camera.k });
          return;
        }
        const scale = cameraRef.current.k || 1;
        const dx = drag.base.dx + (event.clientX - drag.x) / scale;
        const dy = drag.base.dy + (event.clientY - drag.y) / scale;
        if (!drag.moved && Math.abs(dx - drag.base.dx) + Math.abs(dy - drag.base.dy) > 2) drag.moved = true;
        setOverrides((previous) => ({ ...previous, [drag.id]: { dx, dy } }));
      };
      const endDrag = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        dragRef.current = null;
        if (drag.mode === 'pan') setPanning(false);
        else {
          setDraggingNode(false);
          if (!drag.moved) onSelect(drag.id);
        }
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
      };
      const zoomBy = (factor) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const current = cameraRef.current;
        const px = wrap.clientWidth / 2;
        const py = wrap.clientHeight / 2;
        const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
        const ratio = k / current.k;
        setCamera({ x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio, k });
      };

      return h(
        'div',
        {
          className: 'mc-canvas',
          ref: wrapRef,
          'data-panning': panning,
          'data-dragging': draggingNode,
          onContextMenu: (event) => event.preventDefault(),
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
        },
        layout.nodes.length === 0
          ? h('div', { className: 'mc-canvasEmpty' }, t('canvas.empty'))
          : h(
              'div',
              { className: 'mc-canvasWorld', style: { transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.k})` } },
              h(
                'svg',
                { className: 'mc-canvasEdges', width: layout.width, height: layout.height, viewBox: `0 0 ${layout.width} ${layout.height}`, 'aria-hidden': true },
                layout.edges.map((edge) =>
                  h('path', {
                    key: edge.id,
                    className: 'mc-edge',
                    'data-live': edge.live ? 'true' : 'false',
                    'data-active': edge.from === selectedId || edge.to === selectedId ? 'true' : 'false',
                    d: edgeStyle === 'ortho' ? edge.ortho : edge.d,
                  }),
                ),
              ),
              layout.clusters.map((cluster) =>
                h(
                  React.Fragment,
                  { key: `cluster:${cluster.id}` },
                  h('div', { className: 'mc-cluster', style: { left: cluster.x, top: cluster.y, width: cluster.w, height: cluster.h } }),
                  h('div', { className: 'mc-clusterLabel', style: { left: cluster.x, top: cluster.y } }, cluster.title),
                ),
              ),
              layout.nodes.map((node) =>
                h(CanvasNode, {
                  key: node.id,
                  node,
                  model,
                  t,
                  now,
                  selected: selectedId === node.id,
                  onSelect,
                  onOpen,
                }),
              ),
            ),
        h(
          'div',
          { className: 'mc-canvasOptions' },
          h(
            'div',
            { className: 'mc-seg', role: 'group' },
            h('button', { type: 'button', className: 'mc-segBtn', title: t('canvas.lrTitle'), 'aria-pressed': direction === 'lr' ? 'true' : 'false', onClick: () => changeDirection('lr') }, t('canvas.lr')),
            h('button', { type: 'button', className: 'mc-segBtn', title: t('canvas.tbTitle'), 'aria-pressed': direction === 'tb' ? 'true' : 'false', onClick: () => changeDirection('tb') }, t('canvas.tb')),
          ),
          h(
            'div',
            { className: 'mc-seg', role: 'group' },
            h('button', { type: 'button', className: 'mc-segBtn', title: t('canvas.curveTitle'), 'aria-pressed': edgeStyle === 'curve' ? 'true' : 'false', onClick: () => changeEdgeStyle('curve') }, t('canvas.curve')),
            h('button', { type: 'button', className: 'mc-segBtn', title: t('canvas.orthoTitle'), 'aria-pressed': edgeStyle === 'ortho' ? 'true' : 'false', onClick: () => changeEdgeStyle('ortho') }, t('canvas.ortho')),
          ),
        ),
        h(
          'div',
          { className: 'mc-canvasCtl' },
          h('button', { type: 'button', className: 'mc-btn', title: t('canvas.fit'), 'aria-label': t('canvas.fit'), onClick: () => fit(focusId) }, '⌖'),
          h('button', { type: 'button', className: 'mc-btn', title: t('canvas.zoomOut'), 'aria-label': t('canvas.zoomOut'), onClick: () => zoomBy(1 / 1.25) }, '−'),
          h('span', { className: 'mc-canvasZoom' }, `${Math.round(camera.k * 100)}%`),
          h('button', { type: 'button', className: 'mc-btn', title: t('canvas.zoomIn'), 'aria-label': t('canvas.zoomIn'), onClick: () => zoomBy(1.25) }, '+'),
          h(
            'button',
            {
              type: 'button',
              className: 'mc-btn',
              title: t('canvas.resetTitle'),
              'aria-label': t('canvas.reset'),
              disabled: Object.keys(overrides).length === 0,
              onClick: () => setOverrides({}),
            },
            '↺',
          ),
        ),
        h('div', { className: 'mc-canvasHint' }, t('canvas.hint')),
      );
    }
    // #endregion

    // #region matrix view
    function MatrixRow(props) {
      const { view, model, t, now, selected, selectedId, onSelect, onOpen, expanded, onToggle, level } = props;
      const state = stateOf(view);
      const kids = orderedChildren(view);
      const kidsOpen = expanded[view.id] !== false;
      const totalKids = view.children.length;
      const moreKids = level === 0 ? countDescendants(view, model) - totalKids : 0;
      const live = liveChildren(view, model);
      const chainLabel = totalKids === 0 ? t('chainMain') : `${t('chainMain')}+${totalKids}${t('chainChild')}`;
      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            className: 'mc-row',
            'data-selected': selected,
            'data-child': level > 0,
            role: 'button',
            tabIndex: -1,
            onClick: () => onSelect(view.id),
            onDoubleClick: () => onOpen(view.id),
            style: level > 0 ? { paddingLeft: 8 + level * 24 } : undefined,
          },
          h(Dot, { state }),
          h(
            'span',
            { className: 'mc-name' },
            h(
              'span',
              { className: 'mc-nameMain' },
              level > 0 ? h('span', { className: 'mc-indent' }, '└') : null,
              h('span', { className: 'mc-nameText', 'data-quiet': level > 0, title: view.title }, view.title),
              view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'needs' }, t(`kind.${view.pending.kind}`)) : null,
              view.unread && !view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'ok' }, '·') : null,
              totalKids > 0
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mc-chip',
                      'aria-expanded': kidsOpen,
                      onClick: (event) => {
                        event.stopPropagation();
                        onToggle(view.id);
                      },
                    },
                    kidsOpen ? `−${totalKids}` : `+${totalKids}`,
                  )
                : null,
              moreKids > 0 ? h('span', { className: 'mc-chip', title: t('moreChildren').replace('{n}', String(moreKids)) }, `+${moreKids}`) : null,
            ),
            view.workspace ? h('span', { className: 'mc-subText' }, view.workspace) : null,
          ),
          h(
            'span',
            { className: 'mc-cell', style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
            h('span', null, chainLabel),
            live > 0 ? h('span', { className: 'mc-chip', 'data-tone': 'run' }, `${live}${t('chainRunning')}`) : null,
          ),
          view.todos
            ? h(
                'span',
                { className: 'mc-prog' },
                h(
                  'span',
                  { className: 'mc-bar', role: 'progressbar', 'aria-valuenow': view.todos.done, 'aria-valuemax': view.todos.total },
                  h('span', {
                    className: 'mc-barFill',
                    'data-done': view.todos.done === view.todos.total,
                    style: { width: `${view.todos.total > 0 ? Math.round((view.todos.done / view.todos.total) * 100) : 0}%` },
                  }),
                ),
                h('span', { className: 'mc-progText' }, `${view.todos.done}/${view.todos.total}`),
              )
            : h('span', { className: 'mc-cell', 'data-muted': true }, '—'),
          h('span', { className: 'mc-cell mc-colCtx' }, h(ContextValue, { context: view.context })),
          h('span', { className: 'mc-cell' }, h(RelativeTime, { view, now, t })),
          h('span', { className: 'mc-cell mc-colOut', title: outputTitle(view.output, t) }, outputCode(view.output) || t('outputPlaceholder')),
          h(
            'button',
            {
              type: 'button',
              className: 'mc-open',
              title: t('action.open'),
              'aria-label': t('action.open'),
              onClick: (event) => {
                event.stopPropagation();
                onOpen(view.id);
              },
            },
            h(
              'svg',
              { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
              h('path', {
                d: 'M6 3.5h6.5V10M12.5 3.5 4 12',
                stroke: 'currentColor',
                'stroke-width': 1.4,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
              }),
            ),
          ),
        ),
        totalKids > 0 && kidsOpen
          ? kids.map((child) =>
              h(MatrixRow, {
                key: child.id,
                view: model.viewOf(child),
                model,
                t,
                now,
                selected: selectedId === child.id,
                selectedId,
                onSelect,
                onOpen,
                expanded,
                onToggle,
                level: level + 1,
              }),
            )
          : null,
      );
    }

    function Matrix(props) {
      const { groups, model, t, now, selectedId, onSelect, onOpen, expanded, onToggle } = props;
      return h(
        'div',
        { className: 'mc-matrix', role: 'list' },
        h(
          'div',
          { className: 'mc-headRow' },
          h('span', null, ''),
          h('span', null, t('column.task')),
          h('span', null, t('column.chain')),
          h('span', null, t('column.progress')),
          h('span', { className: 'mc-colCtx' }, t('column.context')),
          h('span', null, t('column.activity')),
          h('span', { className: 'mc-colOut' }, t('column.output')),
          h('span', null, ''),
        ),
        h(
          'div',
          { className: 'mc-matrixScroll' },
          ['needs', 'running', 'failed', 'idle'].map((group) =>
            h(
              'div',
              { key: group },
              h('div', { className: 'mc-groupHead' }, `${t(`group.${group}`)} · ${groups[group].length}`),
              groups[group].length === 0
                ? h('div', { className: 'mc-groupEmpty' }, t(`groupEmpty.${group}`))
                : groups[group].map((view) =>
                    h(MatrixRow, {
                      key: view.id,
                      view,
                      model,
                      t,
                      now,
                      selected: selectedId === view.id,
                      selectedId,
                      onSelect,
                      onOpen,
                      expanded,
                      onToggle,
                      level: 0,
                    }),
                  ),
            ),
          ),
        ),
      );
    }
    // #endregion

    // #region drawer
    function Drawer(props) {
      const { view, model, t, now, onClose, onOpen, onOpenParent, onPreview } = props;
      const values = view.values || {};
      const goal = values.goal && values.goal.goal ? values.goal : undefined;
      const team = values.agentTeam;
      const todos = Array.isArray(values.todos) ? values.todos : [];
      const children = orderedChildren(view);
      const goalPhase = goal && goal.goal && typeof goal.goal.phase === 'string' ? goal.goal.phase : undefined;
      const output = outputOf(values);
      return h(
        'aside',
        { className: 'mc-drawer', role: 'dialog', 'aria-label': view.title },
        h(
          'div',
          { className: 'mc-drawerHead' },
          h('h2', { className: 'mc-drawerTitle' }, view.title),
          h('button', { type: 'button', className: 'mc-btn', onClick: onClose, title: t('action.close'), 'aria-label': t('action.close') }, '✕'),
        ),
        h(
          'div',
          { className: 'mc-drawerBody' },
          h(
            'section',
            { className: 'mc-section' },
            h('div', { className: 'mc-sectionTitle' }, t('drawer.overview')),
            h(
              'dl',
              { className: 'mc-kv' },
              h('dt', null, t('column.task')),
              h('dd', null, t('status.' + (view.pending ? 'needs' : view.running ? 'running' : view.unread ? 'done' : 'idle'))),
              view.pending ? [h('dt', { key: 'pk' }, t('drawer.pending')), h('dd', { key: 'pv' }, t(`kind.${view.pending.kind}`))] : null,
              view.workspace ? [h('dt', { key: 'wk' }, t('drawer.workspace')), h('dd', { key: 'wv' }, view.workspace)] : null,
              isNum(view.row.updatedAt) && view.row.updatedAt > 0
                ? [h('dt', { key: 'ak' }, t('column.activity')), h('dd', { key: 'av' }, relLabel(Math.max(0, now - view.row.updatedAt), t))]
                : null,
              isNum(view.tokens) ? [h('dt', { key: 'tk' }, t('drawer.tokens')), h('dd', { key: 'tv' }, `${fmtTokens(view.tokens)} ${t('tokens')}`)] : null,
              view.context && isNum(view.context.pct)
                ? [
                    h('dt', { key: 'ck' }, t('drawer.context')),
                    h(
                      'dd',
                      { key: 'cv' },
                      `${view.context.pct}%${isNum(view.context.tokens) && isNum(view.context.window) ? ` · ${fmtTokens(view.context.tokens)} / ${fmtTokens(view.context.window)}` : ''}`,
                    ),
                  ]
                : null,
              view.timing && view.timing.ms > 0
                ? [h('dt', { key: 'dk' }, view.timing.live ? t('drawer.active') : t('drawer.settled')), h('dd', { key: 'dv' }, fmtDuration(view.timing.ms))]
                : null,
              output && output.reason
                ? [h('dt', { key: 'rk' }, t('drawer.reason')), h('dd', { key: 'rv', style: output.failed ? { color: 'var(--cc-ink-err)' } : undefined }, output.reason)]
                : null,
              output && output.tool
                ? [h('dt', { key: 'lk' }, t('drawer.lastTool')), h('dd', { key: 'lv' }, output.toolError ? `${output.tool} · ${output.toolError}` : output.tool)]
                : null,
            ),
          ),
          h(
            'section',
            { className: 'mc-section' },
            h('div', { className: 'mc-sectionTitle' }, t('drawer.goal')),
            goal
              ? h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
                  h('div', { style: { overflowWrap: 'anywhere' } }, String(goal.goal.objective || '')),
                  h(
                    'div',
                    { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, fontFamily: MONO } },
                    [goalPhase ? t(`drawer.goalPhase.${goalPhase}`) : '', isNum(goal.roundsStarted) ? t('drawer.round').replace('{n}', String(goal.roundsStarted)) : '']
                      .filter(Boolean)
                      .join(' · '),
                  ),
                )
              : h('div', { className: 'mc-zone' }, t('drawer.noGoal')),
          ),
          team && Array.isArray(team.members)
            ? h(
                'section',
                { className: 'mc-section' },
                h('div', { className: 'mc-sectionTitle' }, t('drawer.team')),
                h(
                  'ul',
                  { className: 'mc-list' },
                  team.members.map((member) =>
                    h(
                      'li',
                      { className: 'mc-item', key: String(member.id) },
                      h('span', { className: 'mc-itemDot', 'data-status': member.phase === 'failed' ? 'pending' : 'in_progress' }),
                      h('span', { className: 'mc-itemText' }, `${member.name || member.id} · ${member.role === 'lead' ? t('drawer.roleLead') : t('drawer.roleTeammate')}`),
                      h('span', { className: 'mc-itemMeta' }, String(member.phase || '')),
                    ),
                  ),
                ),
                Array.isArray(team.tasks) && team.tasks.length > 0
                  ? h(
                      'div',
                      { className: 'mc-sectionTitle', style: { marginTop: 4 } },
                      `${t('drawer.tasks')} · ${team.tasks.filter((task) => task.status === 'completed').length}/${team.tasks.length}`,
                    )
                  : null,
                Array.isArray(team.tasks)
                  ? h(
                      'ul',
                      { className: 'mc-list' },
                      team.tasks.slice(0, 12).map((task) =>
                        h(
                          'li',
                          { className: 'mc-item', key: String(task.id) },
                          h('span', { className: 'mc-itemDot', 'data-status': task.status }),
                          h('span', { className: 'mc-itemText' }, String(task.subject || task.id)),
                          h('span', { className: 'mc-itemMeta' }, t(`drawer.taskStatus.${task.status}`)),
                        ),
                      ),
                    )
                  : null,
              )
            : null,
          h(
            'section',
            { className: 'mc-section' },
            h('div', { className: 'mc-sectionTitle' }, t('drawer.progress')),
            todos.length > 0
              ? h(
                  'ul',
                  { className: 'mc-list' },
                  todos.map((todo, index) =>
                    h(
                      'li',
                      { className: 'mc-item', key: `${index}:${todo.content}` },
                      h('span', { className: 'mc-itemDot', 'data-status': todo.status }),
                      h('span', { className: 'mc-itemText', 'data-status': todo.status }, String(todo.content || '')),
                    ),
                  ),
                )
              : h('div', { className: 'mc-zone' }, t('drawer.noTodos')),
          ),
          h(
            'section',
            { className: 'mc-section' },
            h('div', { className: 'mc-sectionTitle' }, t('drawer.subagents')),
            children.length > 0
              ? h(
                  'ul',
                  { className: 'mc-list' },
                  children.map((child) => {
                    const childView = model.viewOf(child);
                    const timing = childView.timing;
                    return h(
                      'li',
                      { className: 'mc-item', key: child.id },
                      h('span', { className: 'mc-itemDot', 'data-status': childView.running ? 'in_progress' : timing && timing.completed ? 'completed' : undefined }),
                      h('span', { className: 'mc-itemText' }, childView.title),
                      h(
                        'span',
                        { className: 'mc-itemMeta' },
                        [
                          childView.pending ? t(`kind.${childView.pending.kind}`) : '',
                          childView.running ? t('status.running') : timing && timing.ms > 0 ? fmtDuration(timing.ms) : '',
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      ),
                    );
                  }),
                )
              : h('div', { className: 'mc-zone' }, t('drawer.noSubagents')),
          ),
          h(
            'section',
            { className: 'mc-section' },
            h('div', { className: 'mc-sectionTitle' }, t('drawer.output')),
            output
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'div',
                    { className: 'mc-zone' },
                    h(
                      'span',
                      { className: 'mc-zoneTitle' },
                      output.files.length > 0
                        ? `${t('drawer.files')} · ${output.files.length} ${t('drawer.paths')}${output.fileCount > output.files.length ? ` · ${output.fileCount} ${t('drawer.writes')}` : ''}`
                        : t('drawer.files'),
                    ),
                    output.files.length > 0
                      ? h(
                          'ul',
                          { className: 'mc-list' },
                          output.files.map((file) =>
                            h(
                              'li',
                              {
                                className: 'mc-item mc-itemLink',
                                key: file,
                                title: file,
                                onClick: () => {
                                  if (onPreview) onPreview(file);
                                },
                              },
                              h('span', { className: 'mc-itemDot', 'data-status': 'completed' }),
                              h('span', { className: 'mc-itemText' }, shortPath(file, 2)),
                              h('span', { className: 'mc-itemMeta' }, baseName(file)),
                            ),
                          ),
                        )
                      : h('span', null, t('drawer.noFiles')),
                  ),
                  h(
                    'div',
                    { className: 'mc-zone' },
                    h('span', { className: 'mc-zoneTitle' }, t('drawer.dialogue')),
                    h('span', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, output.text || t('drawer.noText')),
                  ),
                )
              : h('div', { className: 'mc-zone' }, h('span', { className: 'mc-zoneTitle' }, t('drawer.output')), h('span', null, t('drawer.outputPending'))),
          ),
        ),
        h(
          'div',
          { className: 'mc-drawerFoot' },
          h('button', { type: 'button', className: 'mc-btn mc-primary', onClick: () => onOpen(view.id) }, t('action.open')),
          view.isChild && view.row.parentId
            ? h('button', { type: 'button', className: 'mc-btn', onClick: () => onOpenParent(view.row.parentId) }, t('action.openParent'))
            : null,
          h('button', { type: 'button', className: 'mc-btn', onClick: onClose }, t('action.close')),
        ),
      );
    }

    function SettingsPanel(props) {
      const { t, settings, onChange, onClose } = props;
      const choices = [
        ['board', t('view.board')],
        ['list', t('view.list')],
        ['canvas', t('view.canvas')],
      ];
      const row = (label, control) => h('div', { className: 'mc-settingsRow' }, h('span', { className: 'mc-settingsLabel' }, label), control);
      return h(
        'div',
        { className: 'mc-preview mc-settings', role: 'dialog', 'aria-label': t('settings.title') },
        h(
          'div',
          { className: 'mc-previewHead' },
          h('span', { className: 'mc-previewName' }, t('settings.title')),
          h('button', { type: 'button', className: 'mc-btn', onClick: onClose, title: t('action.close'), 'aria-label': t('action.close') }, '✕'),
        ),
        h(
          'div',
          { className: 'mc-previewBody' },
          row(
            t('settings.defaultView'),
            h(
              'div',
              { className: 'mc-seg', role: 'group', 'aria-label': t('settings.defaultView') },
              choices.map(([value, label]) =>
                h(
                  'button',
                  { key: value, type: 'button', className: 'mc-segBtn', 'aria-pressed': settings.defaultView === value ? 'true' : 'false', onClick: () => onChange({ ...settings, defaultView: value }) },
                  label,
                ),
              ),
            ),
          ),
          row(
            t('settings.quiet'),
            h('button', { type: 'button', className: 'mc-btn', 'aria-pressed': settings.quiet ? 'true' : 'false', onClick: () => onChange({ ...settings, quiet: !settings.quiet }) }, settings.quiet ? t('settings.on') : t('settings.off')),
          ),
          row(
            t('settings.restoreView'),
            h('button', { type: 'button', className: 'mc-btn', 'aria-pressed': settings.restoreView ? 'true' : 'false', onClick: () => onChange({ ...settings, restoreView: !settings.restoreView }) }, settings.restoreView ? t('settings.on') : t('settings.off')),
          ),
          h('div', { className: 'mc-previewNote', style: { marginTop: 10 } }, t('settings.hint')),
        ),
        h('div', { className: 'mc-previewFoot' }, h('span', { className: 'mc-previewNote' }, t('title'))),
      );
    }

    function FilePreview(props) {
      const { file, sessionId, t, onClose, readTextFile, openPath, fileBytesUrl } = props;
      const kind = fileKind(file);
      const [state, setState] = React.useState({ status: kind === 'image' ? 'image' : kind === 'text' ? 'loading' : 'other', text: '', lines: 0, eof: true, error: '' });

      React.useEffect(() => {
        let alive = true;
        setState((previous) => ({ ...previous, status: kind === 'image' ? 'image' : kind === 'text' ? 'loading' : 'other', error: '' }));
        if (kind !== 'text' || typeof readTextFile !== 'function') return () => { alive = false; };
        Promise.resolve()
          .then(() => readTextFile(sessionId, file))
          .then((page) => {
            if (!alive) return;
            const text = page && typeof page.text === 'string' ? page.text : '';
            setState({ status: 'text', text, lines: Array.isArray(page && page.lines) ? page.lines.length : text.split('\n').length, eof: page ? page.eof !== false : true, error: '' });
          })
          .catch((error) => {
            if (!alive) return;
            setState({ status: 'error', text: '', lines: 0, eof: true, error: error && error.message ? error.message : String(error) });
          });
        return () => {
          alive = false;
        };
      }, [file, sessionId, kind, readTextFile]);

      const body = (() => {
        if (state.status === 'image') return h('img', { className: 'mc-previewImage', src: typeof fileBytesUrl === 'function' ? fileBytesUrl(file) : '', alt: baseName(file) });
        if (state.status === 'text') {
          return h(
            React.Fragment,
            null,
            h('pre', { className: 'mc-previewText' }, state.text || '—'),
            state.eof === false ? h('div', { className: 'mc-previewNote' }, t('drawer.truncated').replace('{n}', String(state.lines))) : null,
          );
        }
        if (state.status === 'error') return h('div', { className: 'mc-previewNote' }, `${t('drawer.previewError')}: ${state.error}`);
        if (state.status === 'loading') return h('div', { className: 'mc-previewNote' }, t('drawer.loading'));
        return h('div', { className: 'mc-previewNote' }, t('drawer.previewUnsupported'));
      })();

      return h(
        'div',
        { className: 'mc-preview', role: 'dialog', 'aria-label': t('drawer.preview') },
        h(
          'div',
          { className: 'mc-previewHead' },
          h('span', { className: 'mc-previewName', title: file }, baseName(file)),
          h('span', { className: 'mc-previewPath', title: file }, file),
          h(
            'button',
            {
              type: 'button',
              className: 'mc-btn',
              onClick: () => {
                if (typeof openPath === 'function') {
                  Promise.resolve()
                    .then(() => openPath(file))
                    .catch((error) => setState((previous) => ({ ...previous, status: 'error', error: error && error.message ? error.message : String(error) })));
                }
              },
            },
            t('drawer.openExternal'),
          ),
          h('button', { type: 'button', className: 'mc-btn', onClick: onClose, title: t('action.close'), 'aria-label': t('action.close') }, '✕'),
        ),
        h('div', { className: 'mc-previewBody' }, body),
        h('div', { className: 'mc-previewFoot' }, h('span', { className: 'mc-previewNote' }, shortPath(file, 3))),
      );
    }

    function Banner(props) {
      const { views, t, now, onSelect } = props;
      if (views.length === 0) return null;
      return h(
        'div',
        { className: 'mc-banner', role: 'status' },
        h('div', { className: 'mc-bannerHead' }, `⚠ ${t('group.needs')} · ${String(views.length).padStart(2, '0')}`),
        h(
          'div',
          { className: 'mc-bannerRows' },
          views.map((view) =>
            h(
              'button',
              { type: 'button', className: 'mc-bannerRow', key: view.id, onClick: () => onSelect(view.id) },
              h(Dot, { state: 'needs' }),
              h('span', { className: 'mc-nameText', title: view.title }, view.title),
              h('span', { className: 'mc-bannerWho' }, t(`kind.${view.pending.kind}`)),
              h('span', { className: 'mc-bannerWho' }, relLabel(Math.max(0, now - (view.row.updatedAt || now)), t)),
            ),
          ),
        ),
      );
    }
    // #endregion

    function MissionPanel(props) {
      const { t, useSessions, useSessionStatus, useWorkspaces } = props;
      const list = useSessions ? useSessions((snapshot) => snapshot) : undefined;
      const statuses = useSessionStatus ? useSessionStatus((snapshot) => snapshot) : undefined;
      const workspaces = useWorkspaces ? useWorkspaces((snapshot) => snapshot) : undefined;

      const [selectedId, setSelectedId] = React.useState(null);
      const [filter, setFilter] = React.useState('all');
      const [query, setQuery] = React.useState('');
      const [quiet, setQuiet] = React.useState(false);
      const [workspaceFilter, setWorkspaceFilter] = React.useState('all');
      const [viewMode, setViewMode] = React.useState('board');
      const [canvasFocus, setCanvasFocus] = React.useState({ id: null, nonce: 0 });
      const [previewFile, setPreviewFile] = React.useState(null);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const [settings, setSettings] = React.useState({ defaultView: 'board', quiet: false, restoreView: false });
      const viewTouchedRef = React.useRef(false);
      const canvasFitRef = React.useRef(null);
      const [expanded, setExpanded] = React.useState({});
      const [now, setNow] = React.useState(() => Date.now());
      const searchRef = React.useRef(null);
      const rootRef = React.useRef(null);
      const requested = React.useRef(new Set());

      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
      }, []);

      React.useEffect(() => {
        let alive = true;
        ensurePrefs().then((prefs) => {
          if (!alive || !prefs) return;
          const stored = prefs.settings && typeof prefs.settings === 'object' ? prefs.settings : {};
          const validView = (value) => value === 'board' || value === 'list' || value === 'canvas';
          const next = {
            defaultView: validView(stored.defaultView) ? stored.defaultView : 'board',
            quiet: stored.quiet === true,
            restoreView: stored.restoreView === true,
          };
          setSettings(next);
          setQuiet(next.quiet);
          if (!viewTouchedRef.current) {
            const target = next.restoreView && validView(stored.lastView) ? stored.lastView : next.defaultView;
            setViewMode(target);
          }
        });
        return () => {
          alive = false;
        };
      }, []);

      React.useEffect(() => {
        const timer = setTimeout(() => updatePrefs({ settings: { ...settings, lastView: viewMode } }), 250);
        return () => clearTimeout(timer);
      }, [settings, viewMode]);

      const workspaceTitles = React.useMemo(() => {
        const map = new Map();
        const items = workspaces && Array.isArray(workspaces.items) ? workspaces.items : [];
        for (const workspace of items) {
          const title = workspace && (workspace.title || workspace.path) ? workspace.title || workspace.path : '';
          const ids = workspace && Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
          for (const id of ids) map.set(id, title);
        }
        return map;
      }, [workspaces]);

      const model = React.useMemo(() => buildModel({ list, statuses, workspaceTitles }), [list, statuses, workspaceTitles]);
      const groups = React.useMemo(() => groupedRoots(model, filter, query, workspaceFilter), [model, filter, query, workspaceFilter]);
      const needs = React.useMemo(() => model.roots.filter((root) => !!root.pending), [model]);
      const visibleIds = React.useMemo(() => collectVisibleIds(groups, expanded, model), [groups, expanded, model]);

      const runningCount = model.roots.filter((root) => root.running && !root.pending).length;
      const needsCount = needs.length;
      const failedCount = model.roots.filter((root) => !root.running && !root.pending && root.output && root.output.failed).length;
      const idleCount = model.roots.filter((root) => !root.running && !root.pending && !(root.output && root.output.failed)).length;
      const phase = list && typeof list.phase === 'string' ? list.phase : 'pending';
      const selected = selectedId ? model.views.get(selectedId) : undefined;

      const focusPanel = React.useCallback(() => {
        const node = rootRef.current;
        if (node && typeof node.focus === 'function') {
          try {
            node.focus({ preventScroll: true });
          } catch {
            node.focus();
          }
        }
      }, []);

      const openSession = React.useCallback(
        (id) => {
          try {
            if (props.openSession) props.openSession(id);
          } catch {
            /* navigation is best-effort: stay on the panel when the Host refuses */
          }
        },
        [props.openSession],
      );

      // Pull cold projection values once the list is ready, without retaining history.
      React.useEffect(() => {
        const refresh = props.refreshProjections;
        if (typeof refresh !== 'function' || phase !== 'ready') return undefined;
        let alive = true;
        const ids = model.roots
          .map((root) => root.id)
          .filter((id) => {
            if (requested.current.has(id)) return false;
            requested.current.add(id);
            return true;
          })
          .slice(0, REFRESH_LIMIT);
        (async () => {
          for (let index = 0; index < ids.length && alive; index += REFRESH_CONCURRENCY) {
            const chunk = ids.slice(index, index + REFRESH_CONCURRENCY);
            await Promise.all(
              chunk.map((id) =>
                Promise.resolve()
                  .then(() => refresh(id))
                  .catch(() => undefined),
              ),
            );
          }
        })();
        return () => {
          alive = false;
        };
      }, [phase, model, props.refreshProjections]);

      const selectRow = React.useCallback(
        (id) => {
          setSelectedId(id);
          focusPanel();
        },
        [focusPanel],
      );
      const toggleRow = React.useCallback((id) => {
        setExpanded((previous) => ({ ...previous, [id]: previous[id] === false ? true : false }));
      }, []);

      const move = React.useCallback(
        (delta) => {
          const ids = visibleIds;
          if (ids.length === 0) return;
          const index = selectedId ? ids.indexOf(selectedId) : -1;
          const nextIndex = index < 0 ? (delta > 0 ? 0 : ids.length - 1) : Math.max(0, Math.min(ids.length - 1, index + delta));
          setSelectedId(ids[nextIndex]);
        },
        [visibleIds, selectedId],
      );

      const onKeyDown = React.useCallback(
        (event) => {
          const key = event.key;
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (key === 'j' || key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (key === 'k' || key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (key === 'Enter') {
            if (selectedId) {
              event.preventDefault();
              setSelectedId(selectedId);
            }
          } else if (key === 'o' || key === 'O') {
            if (selectedId) {
              event.preventDefault();
              openSession(selectedId);
            }
          } else if (key === 'Escape') {
            if (selectedId) {
              event.preventDefault();
              setSelectedId(null);
            }
          } else if (key === 'v' || key === 'V') {
            event.preventDefault();
            viewTouchedRef.current = true;
            setViewMode((previous) => (previous === 'board' ? 'list' : previous === 'list' ? 'canvas' : 'board'));
          } else if (key === 'f' || key === 'F') {
            event.preventDefault();
            setFilter((previous) => (previous === 'all' ? 'active' : previous === 'active' ? 'needs' : 'all'));
          } else if (key === 's' || key === 'S') {
            event.preventDefault();
            setQuiet((previous) => !previous);
          } else if (key === '0') {
            if (canvasFitRef.current) {
              event.preventDefault();
              canvasFitRef.current();
            }
          } else if (key === '/') {
            event.preventDefault();
            const input = searchRef.current;
            if (input && typeof input.focus === 'function') input.focus();
          }
        },
        [move, selectedId, openSession],
      );

      if (!list || !list.byId) return h('div', { className: 'mc-root' }, h('div', { className: 'mc-center' }, t('errors.noStore')));

      const workspaceNames = [];
      const seenWorkspaces = new Set();
      for (const workspace of (workspaces && workspaces.items) || []) {
        const name = workspace && (workspace.title || workspace.path);
        if (typeof name !== 'string' || name === '' || seenWorkspaces.has(name)) continue;
        seenWorkspaces.add(name);
        workspaceNames.push(name);
      }

      return h(
        'div',
        {
          ref: rootRef,
          className: `mc-root${quiet ? ' mc-quiet' : ''}`,
          tabIndex: 0,
          onKeyDown,
          role: 'region',
          'aria-label': t('title'),
        },
        h('style', null, CSS),
        h(
          'header',
          { className: 'mc-head' },
          h('div', { className: 'mc-brand' }, h('span', { className: 'mc-titleMark' }, h(DiamondMark)), h('h1', { className: 'mc-title' }, t('title'))),
          h(
            'div',
            { className: 'mc-telemetry', role: 'group', 'aria-label': t('column.task') },
            h('span', { className: 'mc-stat', 'data-tone': 'run' }, h('span', { className: 'mc-statNum' }, String(runningCount).padStart(2, '0')), h('span', { className: 'mc-statLabel' }, t('count.running'))),
            h('span', { className: 'mc-stat', 'data-tone': 'needs' }, h('span', { className: 'mc-statNum' }, String(needsCount).padStart(2, '0')), h('span', { className: 'mc-statLabel' }, t('count.needs'))),
            h('span', { className: 'mc-stat', 'data-tone': 'failed' }, h('span', { className: 'mc-statNum' }, String(failedCount).padStart(2, '0')), h('span', { className: 'mc-statLabel' }, t('count.failed'))),
            h('span', { className: 'mc-stat' }, h('span', { className: 'mc-statNum' }, String(idleCount).padStart(2, '0')), h('span', { className: 'mc-statLabel' }, t('count.idle'))),
          ),
          h('div', { className: 'mc-headSpacer' }),
          h(
            'div',
            { className: 'mc-tools' },
            h(
              'div',
              { className: 'mc-seg', role: 'group', 'aria-label': t('view.board') },
              h('button', { type: 'button', className: 'mc-segBtn', 'aria-pressed': viewMode === 'board' ? 'true' : 'false', onClick: () => { viewTouchedRef.current = true; setViewMode('board'); } }, t('view.board')),
              h('button', { type: 'button', className: 'mc-segBtn', 'aria-pressed': viewMode === 'list' ? 'true' : 'false', onClick: () => { viewTouchedRef.current = true; setViewMode('list'); } }, t('view.list')),
              h('button', { type: 'button', className: 'mc-segBtn', 'aria-pressed': viewMode === 'canvas' ? 'true' : 'false', onClick: () => { viewTouchedRef.current = true; setViewMode('canvas'); } }, t('view.canvas')),
            ),
            workspaceNames.length > 1
              ? h(
                  'select',
                  {
                    className: 'mc-select',
                    value: workspaceFilter,
                    'aria-label': t('column.task'),
                    onChange: (event) => setWorkspaceFilter(event.target.value),
                  },
                  h('option', { value: 'all' }, t('allWorkspaces')),
                  workspaceNames.map((name) => h('option', { key: name, value: name }, name)),
                )
              : null,
            h(
              'label',
              { className: 'mc-search' },
              h('input', {
                ref: searchRef,
                type: 'text',
                value: query,
                placeholder: t('search'),
                'aria-label': t('search'),
                onChange: (event) => setQuery(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    setQuery('');
                    event.currentTarget.blur();
                    event.stopPropagation();
                  }
                },
              }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mc-btn',
                onClick: () => setFilter((previous) => (previous === 'all' ? 'active' : previous === 'active' ? 'needs' : 'all')),
              },
              t(`filter.${filter}`),
            ),
            h(
              'button',
              { type: 'button', className: 'mc-btn', 'aria-pressed': quiet ? 'true' : 'false', onClick: () => setQuiet((previous) => !previous) },
              t('quiet'),
            ),
            h(
              'button',
              { type: 'button', className: 'mc-btn', 'aria-pressed': settingsOpen ? 'true' : 'false', title: t('settings.open'), 'aria-label': t('settings.open'), onClick: () => setSettingsOpen((previous) => !previous) },
              '⚙',
            ),
          ),
        ),
        h(Banner, { views: needs, t, now, onSelect: selectRow }),
        h(
          'div',
          { className: 'mc-body' },
          phase !== 'ready'
            ? h('div', { className: 'mc-empty' }, t('loading'))
            : model.roots.length === 0
              ? h('div', { className: 'mc-empty' }, t('empty'))
              : viewMode === 'board'
                ? h(Board, {
                    groups,
                    model,
                    t,
                    now,
                    selectedId,
                    onSelect: selectRow,
                    onOpen: openSession,
                    expanded,
                    onToggle: toggleRow,
                    onFocusCanvas: (id) => {
                      viewTouchedRef.current = true;
                      setCanvasFocus({ id, nonce: Date.now() });
                      setViewMode('canvas');
                    },
                  })
                : viewMode === 'list'
                  ? h(Matrix, { groups, model, t, now, selectedId, onSelect: selectRow, onOpen: openSession, expanded, onToggle: toggleRow })
                  : h(Canvas, {
                      groups,
                      model,
                      t,
                      now,
                      selectedId,
                      onSelect: selectRow,
                      onOpen: openSession,
                      focus: canvasFocus,
                      fitRef: canvasFitRef,
                    }),
        ),
        selected
          ? h(
              React.Fragment,
              null,
              h('div', { className: 'mc-scrim', 'aria-hidden': true, onClick: () => setSelectedId(null) }),
              h(Drawer, {
                view: selected,
                model,
                t,
                now,
                onClose: () => setSelectedId(null),
                onOpen: openSession,
                onOpenParent: openSession,
                onPreview: (file) => setPreviewFile(file),
              }),
            )
          : null,
        settingsOpen
          ? h(SettingsPanel, {
              t,
              settings,
              onClose: () => setSettingsOpen(false),
              onChange: (next) => {
                setSettings(next);
                setQuiet(next.quiet);
              },
            })
          : null,
        previewFile
          ? h(FilePreview, {
              file: previewFile,
              sessionId: selected ? selected.id : undefined,
              t,
              onClose: () => setPreviewFile(null),
              readTextFile: props.readTextFile,
              openPath: props.openPath,
              fileBytesUrl: props.fileBytesUrl,
            })
          : null,
        h(
          'footer',
          { className: 'mc-foot' },
          h('span', { className: 'mc-sys' }, 'SYS //'),
          t('footer')
            .split(' · ')
            .map((hint) => h('span', { className: 'mc-hint', key: hint }, hint)),
          h('div', { className: 'mc-footSpacer' }),
          h('span', { className: 'mc-hint' }, t('readonly')),
        ),
      );
    }

    // #region plugin
    function apply(ctx) {
      ctx.effect(
        () => {
          try {
            return ctx.locale.register(NS, { zh: flattenDict(ZH), en: flattenDict(EN) });
          } catch {
            return () => {};
          }
        },
        'mission-control: dictionaries',
      );
      const t = ctx.locale.bind(NS);

      // Optional remotes: file reads and native open. Absent services only cost the
      // preview's "open on desktop" button, never the panel.
      let remotes;
      ctx.inject(['remote'], (scope) => {
        remotes = scope.remote;
        return () => {
          remotes = undefined;
        };
      });

      const pageProps = {
        openSession: (id) => {
          try {
            const workspace = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined;
            if (workspace && typeof workspace.openSession === 'function') {
              workspace.openSession(id);
              return;
            }
          } catch {
            /* fall through to the plain panel switch below */
          }
          try {
            ctx.layout.selectPanel(null);
          } catch {
            /* the shell may be mid-navigation; leaving the panel as-is is safe */
          }
        },
        refreshProjections: (id) => ctx.sessions.refreshProjections(id),
        readTextFile: async (sessionId, path) => {
          const files = remotes && remotes.workspaceFiles;
          if (!files || typeof files.read !== 'function') throw new Error('workspace-files remote unavailable');
          const page = await files.read(sessionId, path, { offset: 1, limit: 400 }, undefined);
          return page;
        },
        openPath: async (path) => {
          const session = remotes && remotes.session;
          if (!session || typeof session.openWorkspacePath !== 'function') throw new Error('native open unavailable');
          await session.openWorkspacePath({ path });
        },
        fileBytesUrl: (path) => `api/file?path=${encodeURIComponent(path)}`,
      };

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS, inject: () => pageProps },
          function MainPage(props) {
            return h(PanelBoundary, { label: t('crashed') }, h(MissionPanel, props));
          },
        ),
      );

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, locale: NS, label: () => t('panel') }, MissionIcon),
      );

      // Global toggle: the sidebar's panel list is hidden while it is collapsed.
      ctx.effect(() => {
        let dispose = () => {};
        try {
          dispose = ctx.shortcuts.register({
            id: 'mission.open',
            label: () => t('shortcut.open'),
            aliases: ['command centre', 'command center', 'mission control', 'panel'],
            // ⌘P is taken by the sidebar-files panel (workspace.files); the
            // command-palette ⇧ keeps both commands valid. Web+Linux admits only
            // Cmd+/, Cmd+Shift+, and Cmd+Shift+. — leaving it without a default is
            // required, because register() validates every platform and rejects the
            // whole command when one of them is unsupported.
            defaults: {
              'desktop:macos': { code: 'KeyP', modifiers: ['primary', 'shift'] },
              'desktop:windows': { code: 'KeyP', modifiers: ['primary', 'shift'] },
              'desktop:linux': { code: 'KeyP', modifiers: ['primary', 'shift'] },
              'web:macos': { code: 'KeyP', modifiers: ['primary', 'shift'] },
              'web:windows': { code: 'KeyP', modifiers: ['primary', 'shift'] },
            },
            regions: ['page', 'editable', 'terminal'],
            modals: [],
            resolve: () => ({
              status: 'handled',
              run: () => {
                let current = null;
                try {
                  const source = ctx.layout && ctx.layout.panelInfo;
                  const snapshot = source && typeof source.getSnapshot === 'function' ? source.getSnapshot() : undefined;
                  current = snapshot && typeof snapshot.activePanelId === 'string' ? snapshot.activePanelId : null;
                } catch {
                  current = null;
                }
                try {
                  ctx.layout.selectPanel(current === PANEL_ID ? null : PANEL_ID);
                } catch {
                  /* the panel may be mid-unload; the shortcut stays harmless */
                }
              },
            }),
          });
        } catch (error) {
          // A profile without the shortcuts service still gets the panel + icon,
          // but a rejected binding must stay diagnosable instead of vanishing.
          try {
            console.warn('[command-centre] shortcut registration failed:', error && error.message);
          } catch {
            /* console may be unavailable in a stripped build */
          }
        }
        return () => {
          try {
            dispose();
          } catch {
            /* already disposed by the host */
          }
        };
      }, 'mission-control: open shortcut');
    }

    return {
      inject: ['slots', 'layout', 'locale', 'sessions', 'shortcuts'],
      apply,
    };
  },
});
