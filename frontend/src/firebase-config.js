// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; //
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDvOLcfqpIkNrzvb9e2cH-H83SFPLQM7wA",
  authDomain: "verifai-3f516.firebaseapp.com",
  projectId: "verifai-3f516",
  storageBucket: "verifai-3f516.firebasestorage.app",
  messagingSenderId: "1019016151266",
  appId: "1:1019016151266:web:d88221f88db78bcc845ebb",
  measurementId: "G-Y52F3RH17N"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const analytics = getAnalytics(firebaseApp);
const db = getFirestore(firebaseApp); 


// Export the app and the services
export { firebaseApp, auth, analytics, db };