import Sortable          from "sortablejs";
import { store }        from "./store.js";
import { updateTask }   from "./repo.js";
import { rankBetween }  from "./rank.js";
import { COLUMNS }      from "./board.js";

// ─── Init DnD ─────────────────────────────────────────────────────────

export function initDnD() {
  COLUMNS.forEach(({ id }) => {
    const container = document.getElementById(`col-${id}`);
    if (!container) return;

    Sortable.create(container, {
      group:               "board",
      animation:           220,
      easing:              "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      ghostClass:          "sortable-ghost",
      chosenClass:         "sortable-chosen",
      dragClass:           "sortable-drag",
      handle:              ".card",
      filter:              ".empty-col",
      delay:               0,
      delayOnTouchOnly:    true,
      touchStartThreshold: 4,
      fallbackTolerance:   4,
      swapThreshold:       0.6,

      onStart({ item }) {
        document.body.classList.add("is-dragging");
        item.style.willChange = "transform";
      },

      onOver({ to }) {
        to.classList.add("drag-over");
      },
      onLeave({ to }) {
        to.classList.remove("drag-over");
      },

      onEnd(evt) {
        document.body.classList.remove("is-dragging");
        evt.item.style.willChange = "";
        evt.to.classList.remove("drag-over");
        evt.from.classList.remove("drag-over");

        const taskId   = evt.item.dataset.id;
        const newColId = evt.to.closest("[data-col]")?.dataset.col;
        if (!taskId || !newColId) return;

        const siblings = [...evt.to.querySelectorAll(".card")];
        const newIndex = siblings.findIndex(el => el.dataset.id === taskId);

        const prevId   = siblings[newIndex - 1]?.dataset.id ?? null;
        const nextId   = siblings[newIndex + 1]?.dataset.id ?? null;

        const prevTask = prevId ? store.getTask(prevId) : null;
        const nextTask = nextId ? store.getTask(nextId) : null;

        const colTasks = store.getColumnTasks(newColId);
        const newRank  = rankBetween(
          prevTask?.rank ?? null,
          nextTask?.rank ?? null,
          colTasks,
        );

        const existing = store.getTask(taskId);
        if (existing) {
          store.setTask(taskId, {
            ...existing,
            column:    newColId,
            rank:      newRank,
            updatedAt: Date.now(),
          });
        }

        updateTask(taskId, { column: newColId, rank: newRank });
      },
    });
  });
}
