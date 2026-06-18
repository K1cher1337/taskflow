import { loadTheme, applyTheme }   from "./theme.js";
import { store }                   from "./store.js";
import { startSync }               from "./repo.js";
import { initBoard, renderBoard, COLUMNS } from "./board.js";
import { initDnD }                 from "./dnd.js";
import { openTaskModal,
         openSettingsModal }       from "./modals.js";
import { openIOModal }             from "./io.js";
import { LS_KEY }                  from "./config.js";

// ─── 1. Apply theme immediately (prevents flash) ───────────────────────
loadTheme();

// ─── 2. DOM ready ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const savedId = _loadSpaceId();
  if (savedId) {
    _launch(savedId);
  } else {
    _showSetup();
  }
});

// ─── Setup screen ─────────────────────────────────────────────────────

function _showSetup() {
  const screen = document.createElement("div");
  screen.className = "setup-screen";
  screen.id = "setupScreen";
  screen.innerHTML = `
    <div class="setup-card">
      <div class="setup-logo">
        <svg class="setup-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <h1>TaskFlow</h1>
        <p>Введите пароль вашего пространства<br/>для доступа к задачам</p>
      </div>
      <div class="field">
        <label class="field-label">Пароль / Space ID</label>
        <input id="spaceInput" class="input" type="text"
          placeholder="Введите ваш пароль..."
          autocomplete="off" autocorrect="off" spellcheck="false" />
      </div>
      <div class="setup-warning hidden" id="shortWarn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        Пароль менее 8 символов легко угадать. Рекомендуем 20+ символов.
      </div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="setupEnterBtn" style="width:100%;justify-content:center;padding:11px">
          Войти
        </button>
        <button class="btn btn-ghost" id="setupGenBtn" style="width:100%;justify-content:center;padding:11px">
          Сгенерировать безопасный пароль
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(screen);

  const input    = screen.querySelector("#spaceInput");
  const warn     = screen.querySelector("#shortWarn");
  const enterBtn = screen.querySelector("#setupEnterBtn");
  const genBtn   = screen.querySelector("#setupGenBtn");

  input.addEventListener("input", () => {
    warn.classList.toggle("hidden", input.value.length === 0 || input.value.length >= 8);
  });

  function enter() {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    _saveSpaceId(val);
    screen.remove();
    _launch(val);
  }

  enterBtn.addEventListener("click", enter);
  input.addEventListener("keydown", e => { if (e.key === "Enter") enter(); });
  genBtn.addEventListener("click", () => {
    input.value = _genId();
    warn.classList.add("hidden");
    input.select();
  });
}

// ─── Launch app ───────────────────────────────────────────────────────

async function _launch(spaceId) {
  store.setSpaceId(spaceId);

  // Build board structure
  const boardEl = document.getElementById("board");
  if (boardEl) {
    initBoard(boardEl);
    initDnD();
  }

  // Show skeletons while loading
  _showSkeletons();

  // Start Firestore sync
  startSync();

  // Wire store → re-render
  store.on("tasks",    () => { renderBoard(); _updateFilterBar(); });
  store.on("filter",  () => renderBoard());
  store.on("sync",    () => _updateSyncStatus());
  store.on("online",  () => _updateOnlineBanner());

  // Topbar wiring
  _wireTopbar();

  // Online/offline detection
  window.addEventListener("online",  () => store.setOnline(true));
  window.addEventListener("offline", () => store.setOnline(false));

  // Delegate column "add" buttons
  boardEl?.addEventListener("click", e => {
    const col = e.target.closest("[data-addcol]")?.dataset.addcol;
    if (col) openTaskModal(null, col);
  });
}

// ─── Topbar ───────────────────────────────────────────────────────────

function _wireTopbar() {
  const searchInput = document.getElementById("searchInput");
  let _searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      store.setFilter({ query: searchInput.value });
    }, 180);
  });

  document.getElementById("addTaskBtn")
    ?.addEventListener("click", () => openTaskModal());

  document.getElementById("settingsBtn")
    ?.addEventListener("click", openSettingsModal);

  document.getElementById("ioBtn")
    ?.addEventListener("click", openIOModal);
}

// ─── Sync status indicator ────────────────────────────────────────────

function _updateSyncStatus() {
  const dot  = document.getElementById("syncDot");
  const text = document.getElementById("syncText");
  if (!dot) return;

  const s = store.getSyncStatus();
  dot.className = `sync-dot ${s === "synced" ? "" : s}`;

  const labels = { synced:"Синхр.", saving:"Сохранение…", offline:"Офлайн", error:"Ошибка" };
  if (text) text.textContent = labels[s] ?? s;
}

// ─── Offline banner ───────────────────────────────────────────────────

function _updateOnlineBanner() {
  const banner = document.getElementById("offlineBanner");
  banner?.classList.toggle("hidden", store.getState().isOnline);
}

// ─── Filter bar ───────────────────────────────────────────────────────

function _updateFilterBar() {
  const bar = document.getElementById("filterBar");
  if (!bar) return;

  // Collect all tags across tasks
  const allTags = new Set();
  store.getAllTasks().forEach(t => t.tags?.forEach(tag => allTags.add(tag)));

  const filter = store.getFilter();
  const chips  = [...allTags].map(tag => {
    const active = filter.tags.includes(tag);
    return `<span class="filter-chip ${active ? "active" : ""}" data-tag="${tag}">${tag}</span>`;
  }).join("");

  const hasFilter = filter.tags.length;
  bar.innerHTML = chips + (hasFilter
    ? `<span class="filter-clear" id="clearFilter">Сбросить</span>`
    : "");

  bar.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const tag  = chip.dataset.tag;
      const tags = store.getFilter().tags;
      store.setFilter({
        tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
      });
    });
  });
  bar.querySelector("#clearFilter")?.addEventListener("click", () => {
    store.setFilter({ tags: [], query: "" });
    const si = document.getElementById("searchInput");
    if (si) si.value = "";
  });
}

// ─── Skeletons ────────────────────────────────────────────────────────

function _showSkeletons() {
  COLUMNS.forEach(({ id }) => {
    const col = document.getElementById(`col-${id}`);
    if (!col) return;
    col.innerHTML = [3,2,4].map(() =>
      `<div class="skeleton skeleton-card"></div>`
    ).slice(0, 2 + Math.floor(Math.random() * 2)).join("");
  });
  // Remove skeletons after first real render (tasks event)
  let unsub;
  unsub = store.on("tasks", () => { unsub?.(); });
}

// ─── Helpers ──────────────────────────────────────────────────────────

function _genId() {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2,"0")).join("");
}

function _saveSpaceId(id) {
  try { localStorage.setItem(LS_KEY, id); } catch {}
}

function _loadSpaceId() {
  try { return localStorage.getItem(LS_KEY) || null; } catch { return null; }
}
