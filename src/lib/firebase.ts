import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBA9WYz9Smto3_sMcah8AmWxtQtoFeXt-0",
  authDomain: "methode-clear.firebaseapp.com",
  projectId: "methode-clear",
  storageBucket: "methode-clear.firebasestorage.app",
  messagingSenderId: "938258068490",
  appId: "1:938258068490:web:194cf57167987c1c7a9bf3",
};

// Guard against double-init on hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Émulateurs Firebase — LOCAL UNIQUEMENT. Double garde : ne s'active qu'en dev
// Vite (import.meta.env.DEV) ET avec VITE_USE_FIREBASE_EMULATOR=true, posé
// seulement par `npm run dev:emu`. Jamais dans un build/prod (Vercel).
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch {
    /* déjà connecté (HMR) */
  }
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8085);
  } catch {
    /* déjà connecté (HMR) */
  }
  try {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  } catch {
    /* déjà connecté (HMR) */
  }
}
