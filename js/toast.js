// ─── Toast ────────────────────────────────────────────────────────────

let _container = null;

function _getContainer() {
  if (!_container) {
    _container = document.createElement("div");
    _container.className = "toast-container";
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * @param {string}   message
 * @param {string}   [undoLabel]     label for the undo button
 * @param {Function} [onUndo]        callback when undo is clicked
 * @param {number}   [duration=3500] ms before auto-dismiss
 */
export function showToast(message, undoLabel, onUndo, duration = 3500) {
  const container = _getContainer();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span>${message}</span>
    ${undoLabel ? `<button class="toast-undo">${undoLabel}</button>` : ""}
  `;

  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }

  if (onUndo) {
    toast.querySelector(".toast-undo")?.addEventListener("click", () => {
      onUndo();
      dismiss();
    });
  }

  container.appendChild(toast);
  setTimeout(dismiss, duration);
}
