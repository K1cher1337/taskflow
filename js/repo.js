import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch,
  query, orderBy,
} from "firebase/firestore";
import { db }       from "./firebase.js";
import { store }    from "./store.js";
import { needsRenorm, renormRanks } from "./rank.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function tasksRef() {
  return collection(db, "spaces", store.getSpaceId(), "tasks");
}

function taskRef(id) {
  return doc(db, "spaces", store.getSpaceId(), "tasks", id);
}

// ─── Realtime listener ────────────────────────────────────────────────

let _unsubscribe = null;

export function startSync() {
  if (_unsubscribe) _unsubscribe();

  const q = query(tasksRef());

  _unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const incoming = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Convert Firestore Timestamps to JS numbers for easy sorting/display
    const normalised = incoming.map(t => ({
      ...t,
      createdAt: t.createdAt?.toMillis?.() ?? t.createdAt ?? Date.now(),
      updatedAt: t.updatedAt?.toMillis?.() ?? t.updatedAt ?? Date.now(),
      deletedAt: t.deletedAt?.toMillis?.() ?? t.deletedAt ?? null,
    }));

    store.reconcileTasks(normalised);

    // Sync status from metadata
    if (snap.metadata.hasPendingWrites) {
      store.setSyncStatus("saving");
    } else if (snap.metadata.fromCache) {
      store.setSyncStatus("offline");
    } else {
      store.setSyncStatus("synced");
    }

    // Check if any column needs rank renormalisation
    _checkRenorm();
  }, (err) => {
    console.error("Firestore error:", err);
    store.setSyncStatus("error");
  });
}

export function stopSync() {
  _unsubscribe?.();
  _unsubscribe = null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────

export async function createTask(data) {
  const now = serverTimestamp();
  const docRef = await addDoc(tasksRef(), {
    ...data,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  return docRef.id;
}

export async function updateTask(id, patch) {
  await updateDoc(taskRef(id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Soft delete */
export async function softDeleteTask(id) {
  await updateDoc(taskRef(id), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Hard delete (for permanent removal) */
export async function hardDeleteTask(id) {
  await deleteDoc(taskRef(id));
}

/** Restore a soft-deleted task */
export async function restoreTask(id) {
  await updateDoc(taskRef(id), {
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });
}

// ─── Batch write (import) ─────────────────────────────────────────────

const BATCH_MAX = 500;

export async function batchWrite(tasks, replace = false) {
  const ref = tasksRef();

  if (replace) {
    // First, hard delete all existing
    const existing = store.getAllTasks();
    for (let i = 0; i < existing.length; i += BATCH_MAX) {
      const b = writeBatch(db);
      existing.slice(i, i + BATCH_MAX).forEach(t => b.delete(taskRef(t.id)));
      await b.commit();
    }
  }

  // Write in batches
  for (let i = 0; i < tasks.length; i += BATCH_MAX) {
    const b = writeBatch(db);
    const now = serverTimestamp();
    tasks.slice(i, i + BATCH_MAX).forEach(t => {
      const ref2 = t.id ? doc(ref, t.id) : doc(ref);
      b.set(ref2, {
        title:       t.title       ?? "",
        description: t.description ?? "",
        tags:        t.tags        ?? [],
        priority:    t.priority    ?? "med",
        column:      t.column      ?? "todo",
        rank:        t.rank        ?? 1000,
        deletedAt:   t.deletedAt   ?? null,
        createdAt:   now,
        updatedAt:   now,
      });
    });
    await b.commit();
  }
}

// ─── Rank renormalisation ─────────────────────────────────────────────

async function _checkRenorm() {
  const columns = ["ideas", "todo", "doing", "done"];
  for (const col of columns) {
    const tasks = store.getColumnTasks(col);
    if (needsRenorm(tasks)) {
      const renormed = renormRanks(tasks);
      const b = writeBatch(db);
      renormed.forEach(t => b.update(taskRef(t.id), { rank: t.rank }));
      await b.commit().catch(console.error);
    }
  }
}
