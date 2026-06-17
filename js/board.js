import { store }          from "./store.js";
import { openTaskModal }  from "./modals.js";

// ─── DOM refs ─────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "ideas",  icon: "💡", label: "Идеи"       },
  { id: "todo",   icon: "📋", label: "Сделать"    },
  { id: "doing",  icon: "⚡", label: "В процессе" },
  { id: "done",   icon: "✅", label: "Готово"     },
];

/** @type {Map<string, HTMLElement>} taskId → card DOM element */
const _cardMap = new Map();

// ─── Init board DOM ───────────────────────────────────────────────────

export function initBoard(container) {
  container.innerHTML = "";

  COLUMNS.forEach(col => {
    const el = _buildColumn(col);
    container.appendChild(el);
  });
}

function _buildColumn({ id, icon, label }) {
  const el = document.createElement("div");
  el.className = "column";
  el.dataset.col = id;
  el.innerHTML = `
    <div class="column-head">
      <div class="column-title-row">
        <span class="column-icon">${icon}</span>
        <span class="column-name">${label}</span>
        <span class="column-count" id="count-${id}">0</span>
      </div>
    </div>
    <div class="column-body" id="col-${id}"></div>
    <div class="column-footer">
      <button class="btn-add-col" data-addcol="${id}">
        ${svgPlus(12)} Добавить
      </button>
    </div>
  `;
  return el;
}

// ─── Main render ──────────────────────────────────────────────────────

export function renderBoard() {
  const { filter } = store.getState();

  COLUMNS.forEach(col => {
    let tasks = store.getColumnTasks(col.id);

    // Apply client-side filter
    if (filter.query || filter.tags.length || filter.priority) {
      const q  = filter.query.toLowerCase();
      const ft = filter.tags.map(t => t.toLowerCase());
      const fp = filter.priority;

      tasks = tasks.filter(t => {
        if (fp && t.priority !== fp) return false;
        if (ft.length && !ft.every(f => t.tags.map(x => x.toLowerCase()).includes(f))) return false;
        if (q) {
          const haystack = `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    }

    _renderColumn(col.id, tasks);
  });
}

function _renderColumn(colId, tasks) {
  const container = document.getElementById(`col-${colId}`);
  const countEl   = document.getElementById(`count-${colId}`);
  if (!container) return;

  countEl.textContent = store.getColumnTasks(colId).length; // always show real count

  if (tasks.length === 0) {
    // Remove all cards
    [...container.children].forEach(el => {
      const id = el.dataset.id;
      if (id) _cardMap.delete(id);
      el.remove();
    });
    if (!container.querySelector(".empty-col")) {
      container.innerHTML = _emptyColHTML();
    }
    return;
  }

  // Remove empty state
  container.querySelector(".empty-col")?.remove();

  // Diff: add / update / move cards
  tasks.forEach((task, i) => {
    let el = _cardMap.get(task.id);

    if (!el) {
      el = _createCard(task);
      _cardMap.set(task.id, el);
    } else {
      _updateCardContent(el, task);
    }

    // Move DOM element to correct position (no-op if already there)
    const current = container.children[i];
    if (current !== el) {
      container.insertBefore(el, current ?? null);
    }
  });

  // Remove cards that are no longer in this column's filtered view
  while (container.children.length > tasks.length) {
    const last = container.lastElementChild;
    const id   = last?.dataset.id;
    if (id) _cardMap.delete(id);
    last?.remove();
  }
}

// ─── Card factory ─────────────────────────────────────────────────────

function _createCard(task) {
  const el = document.createElement("div");
  el.className   = "card";
  el.dataset.id  = task.id;
  el.dataset.p   = task.priority ?? "med";

  _updateCardContent(el, task);

  el.addEventListener("click", () => openTaskModal(task.id));

  return el;
}

function _updateCardContent(el, task) {
  el.dataset.p = task.priority ?? "med";

  const tagsHtml = (task.tags ?? []).slice(0, 4).map(t =>
    `<span class="tag">${_esc(t)}</span>`
  ).join("");

  const date = _relDate(task.updatedAt);

  el.innerHTML = `
    <div class="card-title">${_esc(task.title)}</div>
    ${task.description ? `<div class="card-desc">${_esc(task.description)}</div>` : ""}
    <div class="card-footer">
      <div class="card-tags">${tagsHtml}</div>
      <span class="card-date">${date}</span>
      <span class="priority-dot" data-p="${task.priority ?? "med"}"></span>
    </div>
  `;

  // Re-attach click after innerHTML reset
  // (click is on the outer el which we don't reset → OK)
}

// ─── Card removal animation ───────────────────────────────────────────

export function removeCardAnimated(id, onDone) {
  const el = _cardMap.get(id);
  if (!el) { onDone?.(); return; }
  el.classList.add("removing");
  el.addEventListener("animationend", () => { el.remove(); _cardMap.delete(id); onDone?.(); }, { once: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────

function _emptyColHTML() {
  return `
    <div class="empty-col">
      ${svgEmpty()}
      <p>Пусто</p>
    </div>
  `;
}

function _esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function _relDate(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000)    return "сейчас";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)} ч`;
  return `${Math.floor(diff / 86_400_000)} д`;
}

// ─── Inline SVGs ──────────────────────────────────────────────────────

export function svgPlus(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`;
}

function svgEmpty() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M9 9h6M9 13h4"/>
  </svg>`;
}

export { COLUMNS };
