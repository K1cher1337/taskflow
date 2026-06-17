// ─── State ────────────────────────────────────────────────────────────

const _state = {
  /** @type {Map<string, object>} taskId → task */
  tasks:      new Map(),
  spaceId:    null,
  syncStatus: "synced", // "synced" | "saving" | "offline" | "error"
  settings: {
    mode:   "dark",
    accent: "indigo",
  },
  filter: {
    query:    "",
    tags:     [],
    priority: null,
  },
  isOnline:   navigator.onLine,
};

// ─── Listeners ────────────────────────────────────────────────────────

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

function _emit(event) {
  _listeners.get(event)?.forEach(fn => fn());
}

// ─── Public API ───────────────────────────────────────────────────────

export const store = {
  // ─ Read ──────────────────────────────────────────────────────────
  getState()          { return _state; },
  getTask(id)         { return _state.tasks.get(id); },
  getSpaceId()        { return _state.spaceId; },
  getSyncStatus()     { return _state.syncStatus; },
  getSettings()       { return { ..._state.settings }; },
  getFilter()         { return { ..._state.filter }; },

  /** Tasks in column, sorted by rank (asc), excluding soft-deleted */
  getColumnTasks(col) {
    const out = [];
    for (const t of _state.tasks.values()) {
      if (t.column === col && !t.deletedAt) out.push(t);
    }
    out.sort((a, b) => a.rank - b.rank);
    return out;
  },

  /** All non-deleted tasks (for export / search) */
  getAllTasks() {
    const out = [];
    for (const t of _state.tasks.values()) {
      if (!t.deletedAt) out.push(t);
    }
    return out;
  },

  // ─ Write ─────────────────────────────────────────────────────────
  setSpaceId(id)       { _state.spaceId = id; },

  setTask(id, task)    { _state.tasks.set(id, task); _emit("tasks"); },
  removeTask(id)       { _state.tasks.delete(id);    _emit("tasks"); },

  /** Merge all tasks from Firestore snapshot; remove missing ones */
  reconcileTasks(incoming) {
    const next = new Map(incoming.map(t => [t.id, t]));
    // Add/update
    for (const [id, t] of next) {
      if (!_state.tasks.has(id) || JSON.stringify(_state.tasks.get(id)) !== JSON.stringify(t)) {
        _state.tasks.set(id, t);
      }
    }
    // Remove tasks deleted server-side
    for (const id of _state.tasks.keys()) {
      if (!next.has(id)) _state.tasks.delete(id);
    }
    _emit("tasks");
  },

  setSyncStatus(s)     { _state.syncStatus = s; _emit("sync"); },
  setOnline(v)         { _state.isOnline = v; _emit("online"); },

  setSettings(patch) {
    Object.assign(_state.settings, patch);
    _emit("settings");
  },

  setFilter(patch) {
    Object.assign(_state.filter, patch);
    _emit("filter");
  },

  // ─ Subscribe ─────────────────────────────────────────────────────
  /** on("tasks" | "sync" | "settings" | "filter" | "online", fn) → unsubscribe fn */
  on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(fn);
    return () => _listeners.get(event).delete(fn);
  },
};
