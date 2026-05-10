import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
