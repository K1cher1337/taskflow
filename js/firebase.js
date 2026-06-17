import { initializeApp }                         from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
}                                                 from "firebase/firestore";
import { FIREBASE_CONFIG }                        from "./config.js";

// ─── Init ──────────────────────────────────────────────────────────────

const app = initializeApp(FIREBASE_CONFIG);

// Persistent cache → full offline support via IndexedDB
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
