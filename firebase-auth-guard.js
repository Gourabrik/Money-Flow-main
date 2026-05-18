// ── Import Firebase services from central config ────────────────────────────
import { auth, db } from './firebase.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// ── Keys that belong to a specific user (must be cleared on user switch) ─────
const USER_STORAGE_KEYS = [
    'expenses', 'income', 'onlineIncome', 'cashIncome', 'savings',
    'incomeHistory', 'savingsHistory', 'savingsGoals', 'achievements',
    'debts', 'lastUpdateDate', 'customCategories', 'userNotes',
    'budgetLimits', 'weeklyLimit', 'monthlyLimit'
];

// ── Clear localStorage user data (called when a different user logs in) ───────
function clearUserLocalStorage() {
    USER_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    console.log('[AuthGuard] Cleared localStorage for new user session.');
}

// ── Auth Guard – redirect to login if not authenticated ─────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // User logged out – clear their localStorage data
        clearUserLocalStorage();
        localStorage.removeItem('_authUid');
        window.location.href = 'login.html';
        return;
    }

    // ── User isolation: clear localStorage if a different user was here ────
    const storedUid = localStorage.getItem('_authUid');
    const wasGuest = localStorage.getItem('_wasGuest') === 'true';

    if (storedUid && storedUid !== user.uid) {
        if (wasGuest) {
            console.log(`[AuthGuard] Upgrading from Guest (${storedUid} → ${user.uid}). Keeping local cache for migration.`);
            window._pendingMigration = true;
        } else {
            // Different user detected — wipe the previous user's local cache
            clearUserLocalStorage();
            console.log(`[AuthGuard] User switched (${storedUid} → ${user.uid}). Local cache cleared.`);
        }
    }
    // Always stamp the current uid so future sessions can detect user switches
    localStorage.setItem('_authUid', user.uid);

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

    // Wire the logout button (use { once: true } to avoid stacking handlers)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (window._fsUnsubscribes) {
                window._fsUnsubscribes.forEach(unsub => unsub());
                window._fsUnsubscribes = [];
            }

            const isGuest = window._firebaseUser && window._firebaseUser.isAnonymous;
            if (isGuest) {
                localStorage.setItem('_wasGuest', 'true');
                // Do NOT wipe local storage here! Let guest data persist for the next login.
            } else {
                clearUserLocalStorage();
                localStorage.removeItem('_wasGuest');
            }

            localStorage.removeItem('_authUid');
            await signOut(auth);
            window.location.href = 'login.html';
        }, { once: true });
    }

    // ── Wait for firebase-sync.js to expose window.FS ─────────────────────
    const waitForFS = () => new Promise((resolve) => {
        if (window.FS) { resolve(); return; }
        const interval = setInterval(() => {
            if (window.FS) { clearInterval(interval); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(interval); resolve(); }, 5000);
    });

    await waitForFS();

    // ── Load cloud data and inject it before init() ────────────────────────
    if (window.FS) {
        await window.FS.ensureUserDoc(user.uid, user.email, user.isAnonymous);

        console.log('[AuthGuard] Loading user data from Firestore for uid:', user.uid);
        const cloudData = await window.FS.loadAll(user.uid);

        if (cloudData) {
            // Always trust Firestore — even if empty (empty = new user, not "use local")
            window._cloudData = cloudData;
            console.log('[AuthGuard] Cloud data loaded:', {
                expenses: cloudData.expenses.length,
                income: cloudData.income,
                savings: cloudData.savings,
                debts: cloudData.debts.length,
            });
        } else {
            // Firestore unreachable — use local data ONLY for this UID
            console.warn('[AuthGuard] Firestore unavailable. Using localStorage for uid:', user.uid);
            // _cloudData stays undefined — init() will use localStorage (which is now uid-stamped)
        }
    }

    // ── Initialize the main app ────────────────────────────────────────────
    if (typeof init === 'function') {
        init();
    } else {
        const waitForInit = setInterval(() => {
            if (typeof init === 'function') { clearInterval(waitForInit); init(); }
        }, 50);
        setTimeout(() => clearInterval(waitForInit), 5000);
    }
});
