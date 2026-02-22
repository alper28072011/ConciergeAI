import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDh-f2H493fUerV8eqLEkCXBoKsNi78O2M",
  authDomain: "concierge-ai-55776.firebaseapp.com",
  projectId: "concierge-ai-55776",
  storageBucket: "concierge-ai-55776.firebasestorage.app",
  messagingSenderId: "625655393038",
  appId: "1:625655393038:web:885a1749589a8339e0855f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
