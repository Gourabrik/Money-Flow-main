// Firebase configuration for MoneyFlow
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB9iSAxAMNmUNhf6N64w6kIn6OLEQOOXdQ",
    authDomain: "money-flow-7bfb3.firebaseapp.com",
    projectId: "money-flow-7bfb3",
    storageBucket: "money-flow-7bfb3.firebasestorage.app",
    messagingSenderId: "465188702283",
    appId: "1:465188702283:web:4a44b7f2260654b3bfe5ce",
    measurementId: "G-WSLBY8WGSZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
