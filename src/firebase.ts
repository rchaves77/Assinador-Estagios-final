import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import config from "../firebase-applet-config.json";

// Initialize Firebase using the provisioned config
const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with getFirestore(app, databaseId) which supports custom database IDs natively
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

export { db };
export default app;
