// ─── Rank system ──────────────────────────────────────────────────────
// Ranks are plain numbers. Cards are sorted ascending (lowest = topmost).
// Gap between ranks is large (1000) so halvings work for ~50+ operations
// before a column needs renormalisation.

export const INITIAL_GAP  = 1000;
export const RENORM_FLOOR = 0.5; // trigger renorm when gap < this

/** First rank for a brand-new column */
export function initialRank() {
  return INITIAL_GAP;
}

/** Rank for appending after the current last task */
export function rankAfter(tasks) {
  if (!tasks.length) return INITIAL_GAP;
  const last = Math.max(...tasks.map(t => t.rank));
  return last + INITIAL_GAP;
}

/**
 * Rank between two neighbours.
 * @param {number|null} prevRank  rank of card above drop position (null = top)
 * @param {number|null} nextRank  rank of card below drop position (null = bottom)
 * @param {object[]}    colTasks  all tasks in the same column (for fallback)
 * @returns {number}
 */
export function rankBetween(prevRank, nextRank, colTasks = []) {
  const lo = prevRank ?? 0;
  const hi = nextRank ?? (lo + INITIAL_GAP * 2);
  const mid = (lo + hi) / 2;
  return mid;
}

/**
 * Returns true when the column needs renormalisation.
 * (Smallest gap between consecutive ranks is below RENORM_FLOOR.)
 */
export function needsRenorm(tasks) {
  if (tasks.length < 2) return false;
  const sorted = [...tasks].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].rank - sorted[i - 1].rank < RENORM_FLOOR) return true;
  }
  return false;
}

/**
 * Returns a new array with evenly spaced ranks (in sorted order).
 * Does NOT mutate the originals.
 */
export function renormRanks(tasks) {
  const sorted = [...tasks].sort((a, b) => a.rank - b.rank);
  return sorted.map((t, i) => ({ ...t, rank: (i + 1) * INITIAL_GAP }));
}
