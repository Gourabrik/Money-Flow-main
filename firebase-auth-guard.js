// ── Import Firebase services from central config ────────────────────────────
import { auth, db } from './firebase.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// ── Auth Guard – redirect to login if not authenticated ─────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Expose user globally for script_v3.js and firebase-sync.js to use
    window._firebaseUser = user;
    window._firebaseAuth = auth;
    window._firebaseDb   = db;

    // Show user info in the navbar
    const userEl = document.getElementById('nav-user-email');
    if (userEl) {
        userEl.textContent = user.isAnonymous
            ? 'Guest'
            : (user.displayName || user.email || 'User');
    }

    // Wire the logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    // ── Wait for firebase-sync.js to expose window.FS, then load cloud data ──
    const waitForFS = () => new Promise((resolve) => {
        if (window.FS) { resolve(); return; }
        const interval = setInterval(() => {
            if (window.FS) { clearInterval(interval); resolve(); }
        }, 50);
        // Timeout after 5s – fall through to localStorage only
        setTimeout(() => { clearInterval(interval); resolve(); }, 5000);
    });

    await waitForFS();

    // Ensure user document exists in Firestore
    if (window.FS) {
        await window.FS.ensureUserDoc(user.uid, user.email, user.isAnonymous);

        // Load all data from Firestore and inject into global variables
        console.log('[AuthGuard] Loading user data from Firestore...');
        const cloudData = await window.FS.loadAll(user.uid);

        if (cloudData) {
            // Inject cloud data into the global variables used by script_v3.js
            window._cloudData = cloudData;
            console.log('[AuthGuard] Cloud data loaded:', {
                expenses: cloudData.expenses.length,
                income: cloudData.income,
                savings: cloudData.savings,
                debts: cloudData.debts.length,
            });
        } else {
            console.warn('[AuthGuard] Cloud load failed, script_v3.js will use localStorage.');
        }
    }

    // Initialize the main app (init() defined in script_v3.js)
    // DOMContentLoaded may have already fired, so call init directly
    if (typeof init === 'function') {
        init();
    } else {
        // Wait for script_v3.js to define init if it hasn't yet
        const waitForInit = setInterval(() => {
            if (typeof init === 'function') {
                clearInterval(waitForInit);
                init();
            }
        }, 50);
        setTimeout(() => clearInterval(waitForInit), 5000);
    }
});
