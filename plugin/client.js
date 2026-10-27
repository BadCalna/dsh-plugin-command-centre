/**
 * Mission Control — Client half (V1a, read-only).
 *
 * A full-page `main` panel plus one `sidebar.panellist` entry. Everything is
 * derived from slot props the Host already publishes:
 *   - useSessions(s => s)        list rows, parentId tree, per-session projections
 *   - useSessionStatus(m => m)   running / pendingInteraction / completionUnread
 *   - useWorkspaces(s => s)      workspace titles for the session rows
 *
 * V1a is read-only: it observes and jumps back into the Conversation. Output
 * data (files / last answer) needs a Host projection and lands in V1b, so the
 * output column renders an explicit placeholder instead of guessing.
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
      panel: '任务指挥台',
      title: '任务指挥台',
      subtitle: '一屏看所有任务',
      count: { running: '运行', needs: '待你', idle: '空闲', child: '子' },
      group: { needs: '需要你', running: '运行中', idle: '空闲' },
      groupEmpty: {
        needs: '没有在等你的任务',
        running: '当前没有运行中的任务',
        idle: '没有空闲任务',
      },
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
      readonly: '只读视图：这里只观察，批准/回答请打开对话',
      footer: 'j/k 移动 · Enter 详情 · o 打开对话 · Esc 关闭 · f 过滤 · s 安静 · / 搜索',
      crashed: '这个面板渲染出错，已降级为空视图。',
      errors: { noStore: '会话列表不可用' },
    };
    const EN = {
      panel: 'Mission Control',
      title: 'Mission Control',
      subtitle: 'Every task on one screen',
      count: { running: 'running', needs: 'waiting', idle: 'idle', child: 'sub' },
      group: { needs: 'Needs you', running: 'Running', idle: 'Idle' },
      groupEmpty: {
        needs: 'Nothing is waiting for you',
        running: 'Nothing is running right now',
        idle: 'No idle tasks',
      },
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
      readonly: 'Read-only view: observe here, approve or answer inside the conversation',
      footer: 'j/k move · Enter details · o open · Esc close · f filter · s quiet · / search',
      crashed: 'This panel crashed and fell back to an empty view.',
      errors: { noStore: 'Session list unavailable' },
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
      if (minutes < 1) return ''; // caller falls back to a "just now" label
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

    /** Group roots for the matrix; a filtered-out parent keeps its children hidden. */
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
        const childView = model.viewOf(child);
        total += countDescendants(childView, model);
      }
      return total;
    }
    // #endregion

    // #region styles
    const CSS = `
.mc-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden;position:relative;outline:none;--mc-run:var(--dsw-alias-state-business-primary);--mc-warn:var(--dsw-alias-state-warn-primary);--mc-idle:var(--dsw-alias-label-tertiary);--mc-ok:var(--dsw-alias-state-success-secondary);--mc-err:var(--dsw-alias-state-error-primary)}
.mc-root.mc-quiet{--mc-run:var(--dsw-alias-label-secondary);--mc-warn:var(--dsw-alias-label-secondary);--mc-ok:var(--dsw-alias-label-secondary)}
.mc-head{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 20px 10px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.mc-headTitle{display:flex;flex-direction:column;gap:1px;min-width:0}
.mc-title{margin:0;font-size:16px;font-weight:600;line-height:22px}
.mc-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}
.mc-counts{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:12px}
.mc-count{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.mc-countNum{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.mc-headSpacer{flex:1 1 auto;min-width:8px}
.mc-search{display:flex;align-items:center;height:30px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);padding:0 10px;min-width:150px}
.mc-search input{border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;outline:none;width:150px}
.mc-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.mc-btn{height:30px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;padding:0 10px;white-space:nowrap}
.mc-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.mc-btn[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.mc-btn:disabled{opacity:.5;cursor:default}
.mc-banner{flex:none;margin:10px 20px 0;border:.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-state-warn-tertiary);padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.mc-bannerHead{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--dsw-alias-label-primary);font-size:12.5px}
.mc-bannerRows{display:flex;flex-direction:column;gap:2px}
.mc-bannerRow{display:grid;grid-template-columns:16px minmax(0,1fr) auto auto;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:5px 6px;border-radius:var(--dsw-radius-md);cursor:pointer}
.mc-bannerRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-bannerRow:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:0}
.mc-bannerWho{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
.mc-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px 12px 18px}
.mc-table{display:flex;flex-direction:column;gap:2px}
.mc-headRow,.mc-row{display:grid;grid-template-columns:20px minmax(0,1fr) 84px 132px 60px 78px 64px 28px;align-items:center;gap:10px;padding:0 8px}
.mc-headRow{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-size:11.5px;height:28px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.mc-groupHead{display:flex;align-items:center;gap:8px;margin:14px 8px 4px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}
.mc-groupHead::after{content:"";flex:1 1 auto;height:1px;background:var(--dsw-alias-border-l2)}
.mc-groupEmpty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:2px 10px 6px}
.mc-row{min-height:40px;border-radius:var(--dsw-radius-md);border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%}
.mc-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary)}
.mc-row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-1px}
.mc-row[data-child=true]{min-height:34px}
.mc-dot{width:8px;height:8px;border-radius:50%;justify-self:center;flex:none}
.mc-dot[data-state=needs]{background:var(--mc-warn);border-radius:2px;transform:rotate(45deg);width:9px;height:9px}
.mc-dot[data-state=running]{background:var(--mc-run);box-shadow:0 0 0 3px color-mix(in srgb, var(--mc-run) 22%, transparent)}
.mc-dot[data-state=done]{background:var(--mc-ok)}
.mc-dot[data-state=idle]{background:var(--mc-idle)}
.mc-name{min-width:0;display:flex;flex-direction:column;gap:0}
.mc-nameMain{display:flex;align-items:center;gap:6px;min-width:0}
.mc-nameText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.mc-nameText[data-quiet=true]{font-weight:400;color:var(--dsw-alias-label-secondary)}
.mc-subText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:16px}
.mc-chip{flex:none;border-radius:999px;padding:0 7px;font-size:11px;line-height:17px;border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.mc-chip[data-tone=needs]{border-color:color-mix(in srgb, var(--mc-warn) 50%, transparent);color:var(--mc-warn)}
.mc-chip[data-tone=run]{border-color:color-mix(in srgb, var(--mc-run) 50%, transparent);color:var(--mc-run)}
.mc-chip[data-tone=ok]{border-color:color-mix(in srgb, var(--mc-ok) 50%, transparent);color:var(--mc-ok)}
.mc-indent{flex:none;width:16px;color:var(--dsw-alias-border-l4);font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;white-space:pre}
.mc-tree{display:flex;align-items:center;gap:2px;min-width:0}
.mc-cell{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.mc-cell[data-muted=true]{color:var(--dsw-alias-label-tertiary)}
.mc-prog{display:flex;align-items:center;gap:6px;min-width:0}
.mc-bar{position:relative;flex:1 1 auto;height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);overflow:hidden;min-width:30px}
.mc-barFill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--mc-run)}
.mc-barFill[data-done=true]{background:var(--mc-ok)}
.mc-progText{color:var(--dsw-alias-label-tertiary);font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.mc-open{width:24px;height:24px;border-radius:var(--dsw-radius-sm);border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
.mc-open:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mc-foot{flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 20px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:11.5px}
.mc-footSpacer{flex:1 1 auto}
.mc-drawer{position:absolute;top:0;right:0;bottom:0;width:min(410px,86%);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.18));z-index:5}
.mc-drawerHead{flex:none;display:flex;align-items:flex-start;gap:8px;padding:14px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.mc-drawerTitle{flex:1 1 auto;min-width:0;margin:0;font-size:14px;font-weight:600;line-height:20px;overflow-wrap:anywhere}
.mc-drawerBody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:10px 16px 16px;display:flex;flex-direction:column;gap:14px}
.mc-section{display:flex;flex-direction:column;gap:6px}
.mc-sectionTitle{color:var(--dsw-alias-label-tertiary);font-size:11.5px;font-weight:600;letter-spacing:.02em}
.mc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:12px}
.mc-kv dt{color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.mc-kv dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.mc-list{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none}
.mc-item{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:17px}
.mc-itemDot{flex:none;width:7px;height:7px;border-radius:50%;margin-top:5px;background:var(--dsw-alias-label-tertiary)}
.mc-itemDot[data-status=in_progress]{background:var(--mc-run)}
.mc-itemDot[data-status=completed]{background:var(--mc-ok)}
.mc-itemText{min-width:0;overflow-wrap:anywhere}
.mc-itemText[data-status=completed]{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}
.mc-itemMeta{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}
.mc-zone{border:.5px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px;display:flex;flex-direction:column;gap:3px}
.mc-zoneTitle{color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600}
.mc-drawerFoot{flex:none;display:flex;gap:8px;padding:10px 16px 14px;border-top:1px solid var(--dsw-alias-border-l2)}
.mc-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
.mc-primary:hover{opacity:.92;background:var(--dsw-alias-state-business-primary)}
.mc-center{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.mc-empty{color:var(--dsw-alias-label-tertiary);font-size:12.5px;padding:18px 10px}
.mc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:900px){.mc-headRow,.mc-row{grid-template-columns:20px minmax(0,1fr) 64px 96px 54px 28px}.mc-colCtx,.mc-colOut{display:none}}
`;

    const ICON_PATH = 'M4 4.6A.6.6 0 0 1 4.6 4h6.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6zM13.4 4h6a.6.6 0 0 1 .6.6v3.8a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6V4.6a.6.6 0 0 1 .6-.6zM13.4 10.6h6a.6.6 0 0 1 .6.6v8.2a.6.6 0 0 1-.6.6h-6a.6.6 0 0 1-.6-.6v-8.2a.6.6 0 0 1 .6-.6zM4 14h6.8a.6.6 0 0 1 .6.6v4.8a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6v-4.8A.6.6 0 0 1 4 14z';

    function MissionIcon(props) {
      const size = isNum(props && props.size) ? props.size : 18;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', {
          d: ICON_PATH,
          fill: 'currentColor',
          opacity: props && props.active ? 1 : 0.72,
        }),
      );
    }
    // #endregion

    // #region components
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        if (this.state.failed) {
          return h(
            'div',
            { className: 'mc-root' },
            h('div', { className: 'mc-center' }, this.props.label),
          );
        }
        return this.props.children;
      }
    }

    function Dot(props) {
      return h('span', { className: 'mc-dot', 'data-state': props.state, 'aria-hidden': true });
    }

    function Progress(props) {
      const progress = props.progress;
      if (!progress) return h('span', { className: 'mc-cell', 'data-muted': true }, '—');
      const ratio = progress.total > 0 ? progress.done / progress.total : 0;
      return h(
        'span',
        { className: 'mc-prog' },
        h(
          'span',
          { className: 'mc-bar', role: 'progressbar', 'aria-valuenow': progress.done, 'aria-valuemax': progress.total },
          h('span', {
            className: 'mc-barFill',
            'data-done': progress.done === progress.total,
            style: { width: `${Math.round(ratio * 100)}%` },
          }),
        ),
        h('span', { className: 'mc-progText' }, `${progress.done}/${progress.total}`),
      );
    }

    function Chain(props) {
      const { view, model, t } = props;
      const kids = view.children.length;
      if (kids === 0) return h('span', { className: 'mc-cell', 'data-muted': view.isChild }, t(view.isChild ? 'chainChild' : 'chainMain'));
      let live = 0;
      for (const childView of view.children.map((child) => model.viewOf(child))) if (childView.running) live += 1;
      const label = `${t('chainMain')}+${kids}${t('chainChild')}`;
      return h(
        'span',
        { className: 'mc-cell', style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
        h('span', null, label),
        live > 0 ? h('span', { className: 'mc-chip', 'data-tone': 'run' }, `${live}${t('chainRunning')}`) : null,
      );
    }

    function ContextMeter(props) {
      const context = props.context;
      if (!context || !isNum(context.pct)) {
        return h('span', { className: 'mc-cell', 'data-muted': true }, '—');
      }
      const tone = context.pct >= 85 ? 'var(--mc-err)' : context.pct >= 65 ? 'var(--mc-warn)' : 'var(--dsw-alias-label-secondary)';
      return h('span', { className: 'mc-cell', style: { color: tone } }, `${context.pct}%`);
    }

    function ActivityCell(props) {
      const { view, now, t } = props;
      const timing = view.timing;
      if (timing && timing.ms > 0) {
        const label = relLabel(timing.ms, t);
        return h('span', { className: 'mc-cell', 'data-muted': !timing.live }, label);
      }
      const updated = view.row && isNum(view.row.updatedAt) ? view.row.updatedAt : 0;
      if (updated > 0) {
        const label = relLabel(Math.max(0, now - updated), t);
        return h('span', { className: 'mc-cell', 'data-muted': true }, label);
      }
      return h('span', { className: 'mc-cell', 'data-muted': true }, '—');
    }

    function stateOf(view) {
      if (view.pending) return 'needs';
      if (view.running) return 'running';
      if (view.unread) return 'done';
      return 'idle';
    }

    function Row(props) {
      const { view, model, t, selected, onSelect, onOpen, expanded, onToggle, level } = props;
      const state = stateOf(view);
      const totalKids = view.children.length;
      const moreKids = level === 0 ? countDescendants(view, model) - totalKids : 0;
      const kidsOpen = expanded[view.id] !== false;
      const subtitle = view.workspace || '';
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
            'aria-current': selected ? 'true' : undefined,
            onClick: () => onSelect(view.id),
            onDoubleClick: () => onOpen(view.id),
            style: level > 0 ? { paddingLeft: 8 + level * 22 } : undefined,
          },
          h(Dot, { state }),
          h(
            'span',
            { className: 'mc-name' },
            h(
              'span',
              { className: 'mc-nameMain' },
              level > 0 ? h('span', { className: 'mc-indent' }, '└') : null,
              h(
                'span',
                { className: 'mc-nameText', 'data-quiet': level > 0, title: view.title },
                view.title,
              ),
              view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'needs' }, t(`kind.${view.pending.kind}`)) : null,
              view.unread && !view.pending ? h('span', { className: 'mc-chip', 'data-tone': 'ok' }, t('drawer.unread')) : null,
              totalKids > 0 && kidsOpen
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mc-chip',
                      'aria-expanded': true,
                      onClick: (event) => {
                        event.stopPropagation();
                        onToggle(view.id);
                      },
                      style: { cursor: 'pointer', background: 'transparent' },
                    },
                    `−${totalKids}`,
                  )
                : null,
              totalKids > 0 && !kidsOpen
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mc-chip',
                      'aria-expanded': false,
                      onClick: (event) => {
                        event.stopPropagation();
                        onToggle(view.id);
                      },
                      style: { cursor: 'pointer', background: 'transparent' },
                    },
                    `+${totalKids}`,
                  )
                : null,
              moreKids > 0 ? h('span', { className: 'mc-chip', title: t('moreChildren').replace('{n}', String(moreKids)) }, `+${moreKids}`) : null,
            ),
            subtitle ? h('span', { className: 'mc-subText' }, subtitle) : null,
          ),
          h(Chain, { view, model, t }),
          h(Progress, { progress: view.todos }),
          h(ContextMeter, { context: view.context }),
          h(ActivityCell, { view, now: props.now, t }),
          h('span', { className: 'mc-cell mc-colOut', 'data-muted': true, title: t('outputHint') }, t('outputPlaceholder')),
          h(
            'button',
            {
              type: 'button',
              className: 'mc-open mc-colOpen',
              title: t('action.open'),
              'aria-label': t('action.open'),
              onClick: (event) => {
                event.stopPropagation();
                onOpen(view.id);
              },
            },
            h(
              'svg',
              { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
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
          ? orderedChildren(view).map((child) =>
              h(Row, {
                key: child.id,
                view: model.viewOf(child),
                model,
                t,
                selected: props.selectedId === child.id,
                selectedId: props.selectedId,
                now: props.now,
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
          h(
            'button',
            { type: 'button', className: 'mc-btn', onClick: onClose, title: t('action.close'), 'aria-label': t('action.close') },
            '✕',
          ),
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
                    { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5 } },
                    [
                      goalPhase ? t(`drawer.goalPhase.${goalPhase}`) : '',
                      isNum(goal.roundsStarted) ? t('drawer.round').replace('{n}', String(goal.roundsStarted)) : '',
                    ]
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
            h(
              'div',
              { className: 'mc-zone' },
              h('span', { className: 'mc-zoneTitle' }, t('drawer.fileZone')),
              h('span', null, t('drawer.comingV1b')),
            ),
            h(
              'div',
              { className: 'mc-zone' },
              h('span', { className: 'mc-zoneTitle' }, t('drawer.dialogZone')),
              h('span', null, t('drawer.comingV1b')),
            ),
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
        h('div', { className: 'mc-bannerHead' }, `⚠ ${t('group.needs')} · ${views.length}`),
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

      const model = React.useMemo(
        () => buildModel({ list, statuses, workspaceTitles }),
        [list, statuses, workspaceTitles],
      );
      const groups = React.useMemo(
        () => groupedRoots(model, filter, query, workspaceFilter),
        [model, filter, query, workspaceFilter],
      );
      const needs = React.useMemo(
        () => model.roots.filter((root) => !!root.pending),
        [model],
      );
      const visibleIds = React.useMemo(() => collectVisibleIds(groups, expanded, model), [groups, expanded, model]);

      const runningCount = model.roots.filter((root) => root.running && !root.pending).length;
      const needsCount = needs.length;
      const idleCount = model.roots.filter((root) => !root.running && !root.pending).length;
      const phase = list && typeof list.phase === 'string' ? list.phase : 'pending';
      const selected = selectedId ? model.views.get(selectedId) : undefined;

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

      if (!list || !list.byId) {
        return h('div', { className: 'mc-root' }, h('div', { className: 'mc-center' }, t('errors.noStore')));
      }

      const workspaceNames = [];
      const seen = new Set();
      for (const workspace of (workspaces && workspaces.items) || []) {
        const name = workspace && (workspace.title || workspace.path);
        if (typeof name !== 'string' || name === '' || seen.has(name)) continue;
        seen.add(name);
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
          h(
            'div',
            { className: 'mc-headTitle' },
            h('h1', { className: 'mc-title' }, t('title')),
            h('span', { className: 'mc-sub' }, t('subtitle')),
          ),
          h(
            'div',
            { className: 'mc-counts' },
            h('span', { className: 'mc-count' }, h(Dot, { state: 'running' }), h('span', { className: 'mc-countNum' }, String(runningCount)), t('count.running')),
            h('span', { className: 'mc-count' }, h(Dot, { state: 'needs' }), h('span', { className: 'mc-countNum' }, String(needsCount)), t('count.needs')),
            h('span', { className: 'mc-count' }, h(Dot, { state: 'idle' }), h('span', { className: 'mc-countNum' }, String(idleCount)), t('count.idle')),
          ),
          h('div', { className: 'mc-headSpacer' }),
          workspaceNames.length > 1
            ? h(
                'select',
                {
                  className: 'mc-btn',
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
            { type: 'button', className: 'mc-btn', onClick: () => setFilter((previous) => (previous === 'all' ? 'active' : previous === 'active' ? 'needs' : 'all')) },
            t(`filter.${filter}`),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mc-btn',
              'aria-pressed': quiet ? 'true' : 'false',
              onClick: () => setQuiet((previous) => !previous),
            },
            t('quiet'),
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
              : h(
                  'div',
                  { className: 'mc-table', role: 'list' },
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
                  ['needs', 'running', 'idle'].map((group) =>
                    h(
                      'div',
                      { key: group },
                      h('div', { className: 'mc-groupHead' }, `${t(`group.${group}`)} · ${groups[group].length}`),
                      groups[group].length === 0
                        ? h('div', { className: 'mc-groupEmpty' }, t(`groupEmpty.${group}`))
                        : groups[group].map((view) =>
                            h(Row, {
                              key: view.id,
                              view,
                              model,
                              t,
                              now,
                              selected: selectedId === view.id,
                              selectedId,
                              onSelect: selectRow,
                              onOpen: openSession,
                              expanded,
                              onToggle: toggleRow,
                              level: 0,
                            }),
                          ),
                    ),
                  ),
                ),
        ),
        selected
          ? h(Drawer, {
              view: selected,
              model,
              t,
              now,
              onClose: () => setSelectedId(null),
              onOpen: openSession,
              onOpenParent: openSession,
            })
          : null,
        h(
          'footer',
          { className: 'mc-foot' },
          h('span', null, t('footer')),
          h('div', { className: 'mc-footSpacer' }),
          h('span', null, t('readonly')),
        ),
      );
    }
    // #endregion

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

      // Business props for the page: navigation back into the Conversation and a
      // lazy projection pull for cold rows. Client services stay out of the
      // component tree so the page itself never re-implements Host behaviour.
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
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => pageProps,
          },
          function MainPage(props) {
            return h(PanelBoundary, { label: t('crashed') }, h(MissionPanel, props));
          },
        ),
      );

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('panel'),
          },
          MissionIcon,
        ),
      );
    }

    return {
      inject: ['slots', 'layout', 'locale', 'sessions'],
      apply,
    };
  },
});
