import { store }                     from "./store.js";
import { createTask, updateTask,
         softDeleteTask, hardDeleteTask,
         restoreTask }               from "./repo.js";
import { rankAfter }                 from "./rank.js";
import { showToast }                 from "./toast.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function _modal(inner, id = "modal-" + Date.now()) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.dataset.modalId = id;
  overlay.innerHTML = inner;

  // Close on backdrop click
  overlay.addEventListener("click", e => {
    if (e.target === overlay) _close(overlay);
  });
  // Close on Esc
  const onKey = e => { if (e.key === "Escape") { _close(overlay); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);

  // Focus first input
  requestAnimationFrame(() => overlay.querySelector("input,textarea")?.focus());

  return overlay;
}

function _close(overlay) {
  overlay?.remove();
}

// ─── Task Modal (create / edit) ───────────────────────────────────────

export function openTaskModal(taskId = null, defaultCol = "todo") {
  const task    = taskId ? store.getTask(taskId) : null;
  const isEdit  = !!task;

  const title   = task?.title       ?? "";
  const desc    = task?.description ?? "";
  const tags    = [...(task?.tags   ?? [])];
  const prio    = task?.priority    ?? "med";
  const col     = task?.column      ?? defaultCol;

  const PRIOS   = [
    { id:"low",    label:"Низкий",   icon:"▪" },
    { id:"med",    label:"Средний",  icon:"▪▪" },
    { id:"high",   label:"Высокий",  icon:"▪▪▪" },
    { id:"urgent", label:"Срочно",   icon:"🔥" },
  ];

  const COLS    = [
    { id:"ideas", label:"Идеи" },
    { id:"todo",  label:"Сделать" },
    { id:"doing", label:"В процессе" },
    { id:"done",  label:"Готово" },
  ];

  const priosHTML = PRIOS.map(p => `
    <div class="priority-opt ${prio === p.id ? "active" : ""}" data-p="${p.id}">
      <span>${p.icon}</span>
      <span>${p.label}</span>
    </div>
  `).join("");

  const colsHTML = COLS.map(c => `
    <div class="col-opt ${col === c.id ? "active" : ""}" data-c="${c.id}">${c.label}</div>
  `).join("");

  const tagsHTML = tags.map(t =>
    `<span class="tag removable" data-tag="${_esc(t)}">${_esc(t)} ×</span>`
  ).join("");

  const overlay = _modal(`
    <div class="modal" role="dialog" aria-modal="true" aria-label="${isEdit ? "Редактирование" : "Новая задача"}">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? "Редактирование" : "Новая задача"}</h2>
        <button class="btn-icon" data-action="close" aria-label="Закрыть">
          ${_svgX()}
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label">Название</label>
          <input id="m-title" class="input" type="text" value="${_esc(title)}"
            placeholder="Краткое название задачи" maxlength="120" required />
        </div>
        <div class="field">
          <label class="field-label">Описание</label>
          <textarea id="m-desc" class="textarea" rows="4"
            placeholder="Детали, ссылки, заметки…">${_esc(desc)}</textarea>
        </div>
        <div class="field">
          <label class="field-label">Теги</label>
          <div class="tags-field" id="m-tags-field">
            ${tagsHTML}
            <input id="m-tag-input" placeholder="Тег + Enter" maxlength="32" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">Приоритет</label>
          <div class="priority-grid">${priosHTML}</div>
        </div>
        <div class="field">
          <label class="field-label">Колонка</label>
          <div class="col-grid">${colsHTML}</div>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit ? `<button class="btn btn-danger modal-footer-left" data-action="delete">Удалить</button>` : ""}
        <button class="btn btn-ghost" data-action="close">Отмена</button>
        <button class="btn btn-primary" data-action="save">
          ${isEdit ? "Сохранить" : "Создать"}
        </button>
      </div>
    </div>
  `);

  // ── Local state ──────────────────────────────────────────────────
  let currentPrio = prio;
  let currentCol  = col;
  const currentTags = [...tags];

  // ── Tag input ────────────────────────────────────────────────────
  const tagInput    = overlay.querySelector("#m-tag-input");
  const tagsField   = overlay.querySelector("#m-tags-field");

  function addTag(raw) {
    const val = raw.trim().toLowerCase().replace(/[,#\s]+/g, "-").slice(0, 32);
    if (!val || currentTags.includes(val)) return;
    currentTags.push(val);
    const chip = document.createElement("span");
    chip.className    = "tag removable";
    chip.dataset.tag  = val;
    chip.textContent  = `${val} ×`;
    chip.addEventListener("click", () => { currentTags.splice(currentTags.indexOf(val), 1); chip.remove(); });
    tagsField.insertBefore(chip, tagInput);
  }

  tagInput.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput.value); tagInput.value = ""; }
    if (e.key === "Backspace" && !tagInput.value && currentTags.length) {
      const last = tagsField.querySelector(".tag:last-of-type");
      last?.click();
    }
  });
  tagInput.addEventListener("blur", () => { if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ""; } });

  // Remove existing tag chips on click
  tagsField.querySelectorAll(".tag.removable").forEach(chip => {
    chip.addEventListener("click", () => {
      currentTags.splice(currentTags.indexOf(chip.dataset.tag), 1);
      chip.remove();
    });
  });

  // ── Priority select ──────────────────────────────────────────────
  overlay.querySelectorAll(".priority-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      overlay.querySelectorAll(".priority-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      currentPrio = opt.dataset.p;
    });
  });

  // ── Column select ────────────────────────────────────────────────
  overlay.querySelectorAll(".col-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      overlay.querySelectorAll(".col-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      currentCol = opt.dataset.c;
    });
  });

  // ── Actions ──────────────────────────────────────────────────────
  async function save() {
    const titleVal = overlay.querySelector("#m-title").value.trim();
    if (!titleVal) { overlay.querySelector("#m-title").focus(); return; }

    const patch = {
      title:       titleVal,
      description: overlay.querySelector("#m-desc").value.trim(),
      tags:        currentTags,
      priority:    currentPrio,
      column:      currentCol,
    };

    _close(overlay);

    if (isEdit) {
      // Optimistic update
      const old = store.getTask(taskId);
      if (old) store.setTask(taskId, { ...old, ...patch, updatedAt: Date.now() });
      await updateTask(taskId, patch);
    } else {
      const colTasks = store.getColumnTasks(currentCol);
      const rank     = rankAfter(colTasks);
      const id       = await createTask({ ...patch, rank });
      showToast("✓ Задача создана");
    }
  }

  async function del() {
    if (!taskId) return;
    _close(overlay);
    const snap = store.getTask(taskId);

    // Optimistic: remove from store view
    if (snap) store.setTask(taskId, { ...snap, deletedAt: Date.now() });
    await softDeleteTask(taskId);

    showToast("Задача удалена", "Отменить", async () => {
      await restoreTask(taskId);
      const restored = store.getTask(taskId);
      if (restored) store.setTask(taskId, { ...restored, deletedAt: null });
    });
  }

  // Button delegation
  overlay.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "close")  _close(overlay);
    if (action === "save")   save();
    if (action === "delete") del();
  });

  // Ctrl/Cmd+Enter to save
  overlay.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save();
  });
}

// ─── Settings Modal ────────────────────────────────────────────────────

export function openSettingsModal() {
  const { mode, accent } = store.getSettings();
  const spaceId = store.getSpaceId() ?? "—";

  const ACCENTS = [
    { id:"indigo",  color:"#6366f1" },
    { id:"violet",  color:"#8b5cf6" },
    { id:"emerald", color:"#10b981" },
    { id:"rose",    color:"#f43f5e" },
    { id:"amber",   color:"#f59e0b" },
  ];

  const swatchesHTML = ACCENTS.map(a => `
    <div class="accent-swatch ${accent === a.id ? "active" : ""}"
      data-a="${a.id}" style="background:${a.color}"
      title="${a.id}" role="radio" tabindex="0"></div>
  `).join("");

  const overlay = _modal(`
    <div class="modal" role="dialog" aria-modal="true" aria-label="Настройки">
      <div class="modal-header">
        <h2 class="modal-title">Настройки</h2>
        <button class="btn-icon" data-action="close" aria-label="Закрыть">${_svgX()}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label">Цветовая схема</label>
          <div class="accent-grid">${swatchesHTML}</div>
        </div>
        <div class="field">
          <label class="field-label">Тема</label>
          <div class="theme-toggle" id="themeToggle" role="switch" aria-checked="${mode === "light"}">
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span style="font-size:13px;color:var(--text-2)">
              ${mode === "light" ? "☀️ Светлая" : "🌙 Тёмная"}
            </span>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Space ID (ваш пароль)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="input" id="spaceIdDisplay" type="text" value="${_esc(spaceId)}"
              style="font-family:var(--font-mono);font-size:12px;" readonly />
            <button class="btn btn-ghost" id="copySpaceId" style="flex-shrink:0">Копировать</button>
          </div>
          <p style="font-size:11px;color:var(--text-3);margin-top:4px">
            Введите этот пароль на другом устройстве для синхронизации
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="close">Закрыть</button>
      </div>
    </div>
  `);

  // Accent swatches
  overlay.querySelectorAll(".accent-swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      overlay.querySelectorAll(".accent-swatch").forEach(s => s.classList.remove("active"));
      sw.classList.add("active");
      const a = sw.dataset.a;
      store.setSettings({ accent: a });
      import("./theme.js").then(m => m.applyTheme());
    });
  });

  // Theme toggle
  const toggle = overlay.querySelector("#themeToggle");
  toggle?.addEventListener("click", () => {
    const newMode = store.getSettings().mode === "dark" ? "light" : "dark";
    store.setSettings({ mode: newMode });
    import("./theme.js").then(m => m.applyTheme());
    // Update toggle UI
    const label = toggle.querySelector("span");
    if (label) label.textContent = newMode === "light" ? "☀️ Светлая" : "🌙 Тёмная";
    toggle.setAttribute("aria-checked", String(newMode === "light"));
  });

  // Copy space ID
  overlay.querySelector("#copySpaceId")?.addEventListener("click", () => {
    navigator.clipboard.writeText(spaceId).then(() => showToast("Space ID скопирован"));
  });

  overlay.addEventListener("click", e => {
    if (e.target.closest("[data-action=close]")) _close(overlay);
  });
}

// ─── SVG helpers ──────────────────────────────────────────────────────

function _svgX() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;
}
