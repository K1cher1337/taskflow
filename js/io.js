import { store }      from "./store.js";
import { batchWrite } from "./repo.js";
import { showToast }  from "./toast.js";
import { SCHEMA_VER } from "./config.js";

// ─── Export ───────────────────────────────────────────────────────────

export function exportTasks() {
  const tasks = store.getAllTasks().map(t => ({
    ...t,
    createdAt: t.createdAt instanceof Object ? t.createdAt : t.createdAt,
    updatedAt: t.updatedAt instanceof Object ? t.updatedAt : t.updatedAt,
  }));

  const payload = {
    schemaVersion: SCHEMA_VER,
    exportedAt:    new Date().toISOString(),
    taskCount:     tasks.length,
    tasks,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `taskflow-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ Экспортировано ${tasks.length} задач`);
}

// ─── Import ───────────────────────────────────────────────────────────

export async function importTasks(file, replace = false) {
  let json;
  try {
    const text = await file.text();
    json = JSON.parse(text);
  } catch {
    showToast("⚠ Ошибка: невалидный JSON");
    return;
  }

  const tasks = Array.isArray(json) ? json : json.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    showToast("⚠ Нет задач для импорта");
    return;
  }

  // Validate minimum fields
  const valid = tasks.filter(t => t?.title);
  if (valid.length === 0) {
    showToast("⚠ Нет задач с обязательным полем title");
    return;
  }

  const mode = replace ? "replace" : "merge";
  const ok   = confirm(
    replace
      ? `Заменить ВСЕ задачи ${valid.length} импортируемыми? Это действие нельзя отменить.`
      : `Добавить ${valid.length} задач? Дубликаты по ID будут обновлены.`
  );
  if (!ok) return;

  showToast("⏳ Импорт…");
  await batchWrite(valid, replace);
  showToast(`✓ Импортировано ${valid.length} задач`);
}

// ─── Import/Export Modal ───────────────────────────────────────────────

export function openIOModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h2 class="modal-title">Импорт / Экспорт</h2>
        <button class="btn-icon" id="ioClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="io-section">
          <h3>📤 Экспорт</h3>
          <p>Скачать все задачи как JSON-файл</p>
          <button class="btn btn-ghost" id="exportBtn">Скачать JSON</button>
        </div>
        <div class="io-section">
          <h3>📥 Импорт</h3>
          <p>Загрузить задачи из JSON-файла</p>
          <div class="drop-zone" id="dropZone">
            Перетащите файл или нажмите для выбора
          </div>
          <input type="file" id="fileInput" accept=".json" style="display:none" />
          <div style="display:flex;gap:8px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2);cursor:pointer">
              <input type="checkbox" id="replaceMode" />
              Режим замены (удалить все существующие)
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="ioClose2">Закрыть</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelector("#ioClose").addEventListener("click",  close);
  overlay.querySelector("#ioClose2").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#exportBtn").addEventListener("click", () => {
    exportTasks();
    close();
  });

  const fileInput = overlay.querySelector("#fileInput");
  const dropZone  = overlay.querySelector("#dropZone");

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("active"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("active"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("active");
    const file = e.dataTransfer.files[0];
    if (file) { importTasks(file, overlay.querySelector("#replaceMode").checked); close(); }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) { importTasks(file, overlay.querySelector("#replaceMode").checked); close(); }
  });
}
