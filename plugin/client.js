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
  id: '@local/dsh-plugin-mission-control',
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
      count: { running: '运行', needs: '待你', idle: '空闲', child: '子' },
      metric: { agents: 'AGENTS', context: 'CTX', output: 'OUT' },
      group: { needs: '需要你', running: '运行中', idle: '空闲' },
      groupEmpty: {
        needs: '没有在等你的任务',
        running: '当前没有运行中的任务',
        idle: '没有空闲任务',
      },
      view: { board: '看板', list: '矩阵' },
      column: {
        task: '任务',
        chain: '代理链',
        progress: '进度',
        context: '上下文',
        activity: '活动',
        output: '产出',
      },
      outputPlaceholder: '—',
      outputHint: '产出列在 V1b 补齐：文件区（改动文件）+ 对话区（最后回答）',
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
        fileZone: '文件区',
        dialogZone: '对话区',
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
        comingV1b: 'V1b 接入后显示',
      },
      action: { open: '打开对话', openParent: '打开父对话', close: '关闭', refresh: '刷新' },
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
    };
    const EN = {
      panel: 'Command Centre',
      title: 'Command Centre',
      count: { running: 'running', needs: 'waiting', idle: 'idle', child: 'sub' },
      metric: { agents: 'AGENTS', context: 'CTX', output: 'OUT' },
      group: { needs: 'Needs you', running: 'Running', idle: 'Idle' },
      groupEmpty: {
        needs: 'Nothing is waiting for you',
        running: 'Nothing is running right now',
        idle: 'No idle tasks',
      },
      view: { board: 'Board', list: 'Matrix' },
      column: {
        task: 'Task',
        chain: 'Agents',
        progress: 'Progress',
        context: 'Context',
        activity: 'Activity',
        output: 'Output',
      },
      outputPlaceholder: '—',
      outputHint: 'Output lands in V1b: file zone (changed files) + dialogue zone (last answer)',
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
        fileZone: 'Files',
        dialogZone: 'Dialogue',
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
        comingV1b: 'Available in V1b',
      },
      action: { open: 'Open conversation', openParent: 'Open parent', close: 'Close', refresh: 'Refresh' },
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
          children: (childrenByParent.get(row.id) || []).slice(),
        };
        views.set(row.id, view);
        return view;
      };
      for (const row of rows) viewOf(row);
      const groupOf = (view) => {
        if (view.pending) return 'needs';
        if (view.running) return 'running';
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
      const groups = { needs: [], running: [], idle: [] };
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
      for (const group of ['needs', 'running', 'idle']) for (const view of groups[group]) pushTree(view);
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
.mc-root{height:100%;min-height:0;display:flex;flex-direction:column;background-color:var(--dsw-alias-bg-base);background-image:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--dsw-alias-border-l2) 55%,transparent) 1px,transparent 0);background-size:22px 22px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden;position:relative;outline:none;--mc-run:var(--dsw-alias-state-business-primary);--mc-warn:var(--dsw-alias-state-warn-primary);--mc-idle:var(--dsw-alias-label-tertiary);--mc-ok:var(--dsw-alias-state-success-secondary);--mc-err:var(--dsw-alias-state-error-primary);--mc-line:color-mix(in srgb,var(--dsw-alias-border-l3) 80%,transparent);--mc-panel:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 88%,transparent)}
.mc-root.mc-quiet{--mc-run:var(--dsw-alias-label-secondary);--mc-warn:var(--dsw-alias-label-secondary);--mc-ok:var(--dsw-alias-label-secondary)}
.mc-head{flex:none;display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 16px;padding:12px 20px 10px;border-bottom:1px solid var(--mc-line);position:relative}
html[data-platform=darwin] .mc-head{padding-top:calc(10px + var(--dsh-frame-top-clearance,0px));padding-left:max(20px,var(--dsh-frame-leading-clearance,0px))}
.mc-head::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--mc-run) 55%,transparent),transparent);opacity:.8}
.mc-brand{display:flex;flex-direction:column;gap:2px;min-width:0}
.mc-title{margin:0;font-family:${MONO};font-size:15px;font-weight:600;line-height:20px;letter-spacing:.22em;text-transform:uppercase;white-space:nowrap}
.mc-titleMark{color:var(--mc-run);margin-right:8px}
.mc-telemetry{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mc-stat{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border:1px solid var(--mc-line);border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);font-family:${MONO};font-size:11px;letter-spacing:.08em;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.mc-statNum{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;font-size:12px}
.mc-stat[data-tone=run]{border-color:color-mix(in srgb,var(--mc-run) 35%,transparent)}
.mc-stat[data-tone=needs]{border-color:color-mix(in srgb,var(--mc-warn) 40%,transparent);color:var(--mc-warn)}
.mc-headSpacer{flex:1 1 auto;min-width:8px}
.mc-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mc-seg{display:inline-flex;border:1px solid var(--mc-line);border-radius:5px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent)}
.mc-segBtn{height:28px;padding:0 10px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.mc-segBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.mc-segBtn[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--mc-run) 16%,transparent);box-shadow:inset 0 -1.5px 0 var(--mc-run)}
.mc-segBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-2px}
.mc-search{display:flex;align-items:center;height:28px;border:1px solid var(--mc-line);border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);padding:0 9px;min-width:140px}
.mc-search input{border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;width:140px;font-family:${MONO}}
.mc-search input::placeholder{color:var(--dsw-alias-label-tertiary);letter-spacing:.04em}
.mc-btn{height:28px;border:1px solid var(--mc-line);border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;padding:0 9px;white-space:nowrap;font-family:${MONO};letter-spacing:.04em}
.mc-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mc-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-btn[aria-pressed=true]{border-color:color-mix(in srgb,var(--mc-run) 55%,transparent);color:var(--mc-run)}
.mc-btn:disabled{opacity:.5;cursor:default}
.mc-select{height:28px;border:1px solid var(--mc-line);border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:0 6px;font-family:${MONO}}
.mc-banner{flex:none;margin:10px 20px 0;border:1px solid color-mix(in srgb,var(--mc-warn) 38%,transparent);border-radius:6px;background:linear-gradient(180deg,color-mix(in srgb,var(--mc-warn) 10%,transparent),transparent);padding:8px 10px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden}
.mc-banner::before{content:"";position:absolute;inset:0 auto 0 0;width:2px;background:var(--mc-warn)}
.mc-bannerHead{display:flex;align-items:center;gap:8px;font-family:${MONO};font-weight:600;color:var(--mc-warn);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.mc-bannerRows{display:flex;flex-direction:column;gap:1px}
.mc-bannerRow{display:grid;grid-template-columns:16px minmax(0,1fr) auto auto;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:5px 6px;border-radius:4px;cursor:pointer}
.mc-bannerRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-bannerRow:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color)}
.mc-bannerWho{color:var(--dsw-alias-label-tertiary);font-size:11.5px;white-space:nowrap;font-family:${MONO}}
.mc-body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:10px 14px 6px}
.mc-board{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(238px,1fr));gap:12px;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
.mc-col{min-width:0;display:flex;flex-direction:column;min-height:0;border:1px solid var(--mc-line);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 55%,transparent);position:relative}
.mc-col::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;border-radius:8px 8px 0 0;background:var(--mc-col-accent,var(--dsw-alias-border-l3));opacity:.85}
.mc-col[data-state=needs]{--mc-col-accent:var(--mc-warn)}
.mc-col[data-state=running]{--mc-col-accent:var(--mc-run)}
.mc-col[data-state=idle]{--mc-col-accent:var(--mc-idle)}
.mc-colHead{flex:none;display:flex;align-items:center;gap:8px;padding:12px 12px 8px;border-bottom:1px solid color-mix(in srgb,var(--mc-line) 70%,transparent)}
.mc-colName{font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:600}
.mc-colCount{margin-left:auto;font-family:${MONO};font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.mc-colBody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.mc-colEmpty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:10px 6px;border:1px dashed var(--mc-line);border-radius:6px;text-align:center}
.mc-card{position:relative;display:flex;flex-direction:column;gap:7px;padding:10px 11px 9px;border:1px solid var(--mc-line);border-radius:7px;background:var(--mc-panel);cursor:pointer;text-align:left;color:inherit;font:inherit;transition:border-color .12s ease,box-shadow .12s ease,transform .12s ease}
.mc-card:hover{border-color:color-mix(in srgb,var(--mc-card-accent,var(--mc-run)) 45%,var(--mc-line));transform:translateY(-1px);box-shadow:0 6px 18px -12px rgba(0,0,0,.55)}
.mc-card:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-card[data-selected=true]{border-color:color-mix(in srgb,var(--mc-run) 70%,var(--mc-line));box-shadow:0 0 0 1px color-mix(in srgb,var(--mc-run) 55%,transparent)}
.mc-card[data-state=needs]{--mc-card-accent:var(--mc-warn)}
.mc-card[data-state=running]{--mc-card-accent:var(--mc-run)}
.mc-card[data-state=done]{--mc-card-accent:var(--mc-ok)}
.mc-card[data-state=idle]{--mc-card-accent:var(--mc-idle)}
.mc-card::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:2px;background:var(--mc-card-accent,var(--mc-idle));opacity:.9}
.mc-cardTop{display:flex;align-items:flex-start;gap:7px;min-width:0}
.mc-cardTitle{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;line-height:18px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mc-cardSub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:${MONO};letter-spacing:.02em}
.mc-cardMetrics{display:flex;gap:10px;flex-wrap:wrap;font-family:${MONO};font-size:10.5px;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary)}
.mc-metric{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.mc-metricValue{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;letter-spacing:0}
.mc-metricValue[data-tone=warn]{color:var(--mc-warn)}
.mc-metricValue[data-tone=err]{color:var(--mc-err)}
.mc-metricValue[data-tone=run]{color:var(--mc-run)}
.mc-prog{display:flex;align-items:center;gap:7px;min-width:0}
.mc-bar{position:relative;flex:1 1 auto;height:4px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 90%,transparent);overflow:hidden;min-width:26px}
.mc-barFill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--mc-run);transition:width .2s ease}
.mc-barFill[data-done=true]{background:var(--mc-ok)}
.mc-progText{color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-family:${MONO};font-variant-numeric:tabular-nums;white-space:nowrap}
.mc-kids{display:flex;flex-direction:column;gap:2px;padding-left:2px;border-left:1px solid color-mix(in srgb,var(--mc-line) 90%,transparent);margin-left:3px}
.mc-kid{display:flex;align-items:center;gap:6px;padding:2px 4px 2px 8px;border-radius:4px;font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:0}
.mc-kid:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-kidName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-kidMeta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-family:${MONO};white-space:nowrap}
.mc-cardFoot{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-family:${MONO};letter-spacing:.05em}
.mc-cardFootSpacer{flex:1 1 auto}
.mc-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--mc-idle);margin-top:5px}
.mc-dot[data-state=needs]{border-radius:1px;transform:rotate(45deg);background:var(--mc-warn);width:8px;height:8px}
.mc-dot[data-state=running]{background:var(--mc-run);box-shadow:0 0 0 3px color-mix(in srgb,var(--mc-run) 20%,transparent);animation:mc-pulse 1.8s ease-in-out infinite}
.mc-dot[data-state=done]{background:var(--mc-ok)}
.mc-dot[data-state=idle]{background:var(--mc-idle)}
@keyframes mc-pulse{0%,100%{box-shadow:0 0 0 3px color-mix(in srgb,var(--mc-run) 18%,transparent)}50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--mc-run) 8%,transparent)}}
@media (prefers-reduced-motion:reduce){.mc-card{transition:none}.mc-card:hover{transform:none}.mc-dot[data-state=running]{animation:none}}
.mc-chip{flex:none;border-radius:4px;padding:0 6px;font-size:10.5px;line-height:16px;border:1px solid var(--mc-line);color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-family:${MONO};letter-spacing:.04em;background:transparent}
.mc-chip[data-tone=needs]{border-color:color-mix(in srgb,var(--mc-warn) 50%,transparent);color:var(--mc-warn)}
.mc-chip[data-tone=run]{border-color:color-mix(in srgb,var(--mc-run) 48%,transparent);color:var(--mc-run)}
.mc-chip[data-tone=ok]{border-color:color-mix(in srgb,var(--mc-ok) 48%,transparent);color:var(--mc-ok)}
button.mc-chip{cursor:pointer}
button.mc-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-open{width:22px;height:22px;border-radius:4px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;flex:none}
.mc-open:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mc-matrix{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--mc-line);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 45%,transparent)}
.mc-matrixScroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 10px}
.mc-headRow,.mc-row{display:grid;grid-template-columns:20px minmax(0,1fr) 92px 138px 62px 82px 62px 26px;align-items:center;gap:10px;padding:0 8px}
.mc-headRow{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-family:${MONO};font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;height:30px;border-bottom:1px solid var(--mc-line)}
.mc-groupHead{display:flex;align-items:center;gap:8px;margin:12px 8px 3px;color:var(--dsw-alias-label-secondary);font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.mc-groupHead::after{content:"";flex:1 1 auto;height:1px;background:var(--mc-line)}
.mc-groupEmpty{color:var(--dsw-alias-label-tertiary);font-size:11.5px;padding:2px 10px 6px;font-family:${MONO}}
.mc-row{min-height:38px;border-radius:5px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%}
.mc-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 2px 0 0 var(--mc-run)}
.mc-row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-1px}
.mc-row[data-child=true]{min-height:32px}
.mc-name{min-width:0;display:flex;flex-direction:column;gap:0}
.mc-nameMain{display:flex;align-items:center;gap:6px;min-width:0}
.mc-nameText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.mc-nameText[data-quiet=true]{font-weight:400;color:var(--dsw-alias-label-secondary)}
.mc-subText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px;font-family:${MONO}}
.mc-indent{flex:none;width:14px;color:var(--dsw-alias-border-l4);font-family:${MONO};font-size:10px;white-space:pre}
.mc-cell{color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;font-family:${MONO}}
.mc-cell[data-muted=true]{color:var(--dsw-alias-label-tertiary)}
.mc-foot{flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 20px;border-top:1px solid var(--mc-line);color:var(--dsw-alias-label-tertiary);font-family:${MONO};font-size:10.5px;letter-spacing:.04em}
.mc-footSpacer{flex:1 1 auto}
.mc-drawer{position:absolute;top:0;right:0;bottom:0;width:min(420px,88%);display:flex;flex-direction:column;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 96%,transparent);border-left:1px solid color-mix(in srgb,var(--mc-run) 22%,var(--mc-line));box-shadow:-18px 0 40px -28px rgba(0,0,0,.7);z-index:5}
.mc-drawerHead{flex:none;display:flex;align-items:flex-start;gap:8px;padding:13px 16px 10px;border-bottom:1px solid var(--mc-line);position:relative}
.mc-drawerHead::after{content:"";position:absolute;left:16px;right:16px;bottom:-1px;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--mc-run) 60%,transparent),transparent)}
html[data-platform=darwin] .mc-drawerHead{padding-top:calc(13px + var(--dsh-frame-top-clearance,0px))}
.mc-drawerTitle{flex:1 1 auto;min-width:0;margin:0;font-size:14px;font-weight:600;line-height:20px;overflow-wrap:anywhere}
.mc-drawerBody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px 16px 16px;display:flex;flex-direction:column;gap:14px}
.mc-section{display:flex;flex-direction:column;gap:6px}
.mc-sectionTitle{color:var(--dsw-alias-label-tertiary);font-family:${MONO};font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.mc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 12px;font-size:12px;margin:0}
.mc-kv dt{color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.mc-kv dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.mc-list{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none}
.mc-item{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:17px}
.mc-itemDot{flex:none;width:6px;height:6px;border-radius:50%;margin-top:6px;background:var(--dsw-alias-label-tertiary)}
.mc-itemDot[data-status=in_progress]{background:var(--mc-run)}
.mc-itemDot[data-status=completed]{background:var(--mc-ok)}
.mc-itemText{min-width:0;overflow-wrap:anywhere}
.mc-itemText[data-status=completed]{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}
.mc-itemMeta{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap;font-family:${MONO}}
.mc-zone{border:1px dashed var(--mc-line);border-radius:6px;padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;display:flex;flex-direction:column;gap:3px;font-family:${MONO};letter-spacing:.02em}
.mc-zoneTitle{color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.mc-drawerFoot{flex:none;display:flex;gap:8px;padding:10px 16px 14px;border-top:1px solid var(--mc-line)}
.mc-primary{background:color-mix(in srgb,var(--mc-run) 88%,transparent);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}
.mc-primary:hover{background:var(--mc-run);color:var(--dsw-alias-label-primary-foreground)}
.mc-center{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.mc-empty{color:var(--dsw-alias-label-tertiary);font-size:12.5px;padding:18px 10px;font-family:${MONO}}
@media (max-width:980px){.mc-board{grid-template-columns:repeat(3,minmax(210px,1fr))}.mc-headRow,.mc-row{grid-template-columns:20px minmax(0,1fr) 78px 110px 52px 26px}.mc-colCtx,.mc-colOut{display:none}}
@media (max-width:720px){.mc-board{grid-template-columns:1fr;overflow-y:auto}}
`;

    const ICON_PATH =
      'M4 4.6A.6.6 0 0 1 4.6 4h6.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6zM13.4 4h6a.6.6 0 0 1 .6.6v3.8a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6V4.6a.6.6 0 0 1 .6-.6zM13.4 10.6h6a.6.6 0 0 1 .6.6v8.2a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6v-8.2a.6.6 0 0 1 .6-.6zM4 14h6.8a.6.6 0 0 1 .6.6v4.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6v-4.8A.6.6 0 0 1 4 14z';

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
      const kidsOpen = expanded[view.id] !== false;
      const totalKids = view.children.length;
      const moreKids = countDescendants(view, model) - totalKids;
      const live = liveChildren(view, model);
      const chainLabel = totalKids === 0 ? t('chainMain') : `${t('chainMain')}+${totalKids}${t('chainChild')}`;
      return h(
        'div',
        {
          className: 'mc-card',
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
          h('span', { title: t('outputHint') }, `${t('metric.output')} ${t('outputPlaceholder')}`),
        ),
      );
    }

    function Board(props) {
      const { groups, model, t, now, selectedId, onSelect, onOpen, expanded, onToggle } = props;
      return h(
        'div',
        { className: 'mc-board', role: 'list' },
        ['needs', 'running', 'idle'].map((state) =>
          h(
            'section',
            { className: 'mc-col', key: state, 'data-state': state, 'aria-label': t(`group.${state}`) },
            h(
              'header',
              { className: 'mc-colHead' },
              h('span', { className: 'mc-colName' }, t(`group.${state}`)),
              h('span', { className: 'mc-colCount' }, String(groups[state].length).padStart(2, '0')),
            ),
            h(
              'div',
              { className: 'mc-colBody' },
              groups[state].length === 0
                ? h('div', { className: 'mc-colEmpty' }, t(`groupEmpty.${state}`))
                : groups[state].map((view) =>
                    h(BoardCard, {
                      key: view.id,
                      view,
                      model,
                      t,
                      now,
                      selected: selectedId === view.id,
                      onSelect,
                      onOpen,
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
          h('span', { className: 'mc-cell mc-colOut', title: t('outputHint') }, t('outputPlaceholder')),
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
          ['needs', 'running', 'idle'].map((group) =>
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
      const { view, model, t, now, onClose, onOpen, onOpenParent } = props;
      const values = view.values || {};
      const goal = values.goal && values.goal.goal ? values.goal : undefined;
      const team = values.agentTeam;
      const todos = Array.isArray(values.todos) ? values.todos : [];
      const children = orderedChildren(view);
      const goalPhase = goal && goal.goal && typeof goal.goal.phase === 'string' ? goal.goal.phase : undefined;
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
            h('div', { className: 'mc-zone' }, h('span', { className: 'mc-zoneTitle' }, t('drawer.fileZone')), h('span', null, t('drawer.comingV1b'))),
            h('div', { className: 'mc-zone' }, h('span', { className: 'mc-zoneTitle' }, t('drawer.dialogZone')), h('span', null, t('drawer.comingV1b'))),
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
      const [expanded, setExpanded] = React.useState({});
      const [now, setNow] = React.useState(() => Date.now());
      const searchRef = React.useRef(null);
      const rootRef = React.useRef(null);
      const requested = React.useRef(new Set());

      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
      }, []);

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
      const idleCount = model.roots.filter((root) => !root.running && !root.pending).length;
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
            setViewMode((previous) => (previous === 'board' ? 'list' : 'board'));
          } else if (key === 'f' || key === 'F') {
            event.preventDefault();
            setFilter((previous) => (previous === 'all' ? 'active' : previous === 'active' ? 'needs' : 'all'));
          } else if (key === 's' || key === 'S') {
            event.preventDefault();
            setQuiet((previous) => !previous);
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
          h('div', { className: 'mc-brand' }, h('h1', { className: 'mc-title' }, h('span', { className: 'mc-titleMark', 'aria-hidden': true }, '◆'), t('title'))),
          h(
            'div',
            { className: 'mc-telemetry', role: 'group', 'aria-label': t('column.task') },
            h('span', { className: 'mc-stat', 'data-tone': 'run' }, h(Dot, { state: 'running' }), h('span', { className: 'mc-statNum' }, String(runningCount).padStart(2, '0')), t('count.running')),
            h('span', { className: 'mc-stat', 'data-tone': 'needs' }, h(Dot, { state: 'needs' }), h('span', { className: 'mc-statNum' }, String(needsCount).padStart(2, '0')), t('count.needs')),
            h('span', { className: 'mc-stat' }, h(Dot, { state: 'idle' }), h('span', { className: 'mc-statNum' }, String(idleCount).padStart(2, '0')), t('count.idle')),
          ),
          h('div', { className: 'mc-headSpacer' }),
          h(
            'div',
            { className: 'mc-tools' },
            h(
              'div',
              { className: 'mc-seg', role: 'group', 'aria-label': t('view.board') },
              h('button', { type: 'button', className: 'mc-segBtn', 'aria-pressed': viewMode === 'board' ? 'true' : 'false', onClick: () => setViewMode('board') }, t('view.board')),
              h('button', { type: 'button', className: 'mc-segBtn', 'aria-pressed': viewMode === 'list' ? 'true' : 'false', onClick: () => setViewMode('list') }, t('view.list')),
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
                ? h(Board, { groups, model, t, now, selectedId, onSelect: selectRow, onOpen: openSession, expanded, onToggle: toggleRow })
                : h(Matrix, { groups, model, t, now, selectedId, onSelect: selectRow, onOpen: openSession, expanded, onToggle: toggleRow }),
        ),
        selected ? h(Drawer, { view: selected, model, t, now, onClose: () => setSelectedId(null), onOpen: openSession, onOpenParent: openSession }) : null,
        h('footer', { className: 'mc-foot' }, h('span', null, t('footer')), h('div', { className: 'mc-footSpacer' }), h('span', null, t('readonly'))),
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
            defaults: {
              'desktop:macos': { code: 'KeyP', modifiers: ['primary'] },
              'desktop:windows': { code: 'KeyP', modifiers: ['primary'] },
              'desktop:linux': { code: 'KeyP', modifiers: ['primary'] },
              'web:macos': { code: 'KeyP', modifiers: ['primary', 'alt'] },
              'web:windows': { code: 'KeyP', modifiers: ['primary', 'alt'] },
              'web:linux': { code: 'KeyP', modifiers: ['primary', 'alt'] },
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
        } catch {
          /* a profile without the shortcuts service still gets the panel + icon */
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
