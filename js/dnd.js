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
      group:      "board",         // enables cross-column drag
      animation:  160,
      easing:     "cubic-bezier(0.34, 1.56, 0.64, 1)",
      ghostClass: "sortable-ghost",
      chosenClass:"sortable-chosen",
      dragClass:  "sortable-drag",
      handle:     ".card",         // whole card is draggable
      filter:     ".empty-col",    // don't drag the empty state

      // Highlight drop zone
      onOver({ to }) {
        to.classList.add("drag-over");
      },
      onLeave({ to }) {
        to.classList.remove("drag-over");
      },

      onEnd(evt) {
        evt.to.classList.remove("drag-over");
        evt.from.classList.remove("drag-over");

        const taskId    = evt.item.dataset.id;
        const newColId  = evt.to.closest("[data-col]")?.dataset.col;
        if (!taskId || !newColId) return;

        // ── Calculate new rank from DOM neighbours ──────────────────
        // At this point SortableJS has already moved the DOM element.
        // The neighbouring cards' ranks in the store are still correct.
        const siblings  = [...evt.to.querySelectorAll(".card")];
        const newIndex  = siblings.findIndex(el => el.dataset.id === taskId);

        const prevId    = siblings[newIndex - 1]?.dataset.id ?? null;
        const nextId    = siblings[newIndex + 1]?.dataset.id ?? null;

        const prevTask  = prevId ? store.getTask(prevId) : null;
        const nextTask  = nextId ? store.getTask(nextId) : null;

        const colTasks  = store.getColumnTasks(newColId);
        const newRank   = rankBetween(
          prevTask?.rank ?? null,
          nextTask?.rank ?? null,
          colTasks,
        );

        // ── Optimistic store update ─────────────────────────────────
        const existing = store.getTask(taskId);
        if (existing) {
          store.setTask(taskId, {
            ...existing,
            column:    newColId,
            rank:      newRank,
            updatedAt: Date.now(),
          });
        }

        // ── Firestore write ─────────────────────────────────────────
        updateTask(taskId, { column: newColId, rank: newRank });
      },
    });
  });
}
