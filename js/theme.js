import { store }        from "./store.js";
import { LS_SETTINGS } from "./config.js";

// ─── Apply current theme from store to DOM + persist ──────────────────

export function applyTheme() {
  const { mode, accent } = store.getSettings();
  document.documentElement.dataset.theme  = mode;
  document.documentElement.dataset.accent = accent;
  _persist({ mode, accent });
}

// ─── Load saved theme (call before anything renders) ──────────────────

export function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SETTINGS) ?? "{}");
    const mode   = saved.mode   ?? "dark";
    const accent = saved.accent ?? "indigo";
    store.setSettings({ mode, accent });
    document.documentElement.dataset.theme  = mode;
    document.documentElement.dataset.accent = accent;
  } catch {
    document.documentElement.dataset.theme  = "dark";
    document.documentElement.dataset.accent = "indigo";
  }
}

// ─── Persist ──────────────────────────────────────────────────────────

function _persist(data) {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(data)); } catch {}
}
