// ─────────────────────────────────────────────────────────────────────────────
//  firebase-sync.js  –  Firestore Data Sync Manager for MoneyFlow
//  Exposes window.FS with all CRUD operations.
//  Firestore structure:
//    users/{uid}                         → profile + income/savings totals
//    users/{uid}/expenses/{id}           → expense documents
//    users/{uid}/incomeHistory/{id}      → income history documents
//    users/{uid}/debts/{id}             → debt documents
//    users/{uid}/savingsHistory/{id}     → savings history
//    users/{uid}/goals/{id}             → savings goals
//    users/{uid}/achievements/{id}       → achievements
// ─────────────────────────────────────────────────────────────────────────────

import { db } from './firebase.js';
import {
    doc, setDoc, getDoc, addDoc, deleteDoc, updateDoc,
    collection, getDocs, query, orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// ── Internal helper: get the user's root document reference ──────────────────
function userRef(uid) {
    return doc(db, 'users', uid);
}

function subCol(uid, name) {
    return collection(db, 'users', uid, name);
}

// ── Load ALL data for a user from Firestore ───────────────────────────────────
async function loadAll(uid) {
    try {
        // 1. Load user profile (income totals, savings balance)
        const userSnap = await getDoc(userRef(uid));
        const profile  = userSnap.exists() ? userSnap.data() : {};

        // 2. Load all sub-collections in parallel
        const [expSnap, incSnap, debSnap, savSnap, goalSnap, achSnap] = await Promise.all([
            getDocs(query(subCol(uid, 'expenses'),       orderBy('timestamp', 'desc'))),
            getDocs(query(subCol(uid, 'incomeHistory'),  orderBy('timestamp', 'desc'))),
            getDocs(query(subCol(uid, 'debts'),          orderBy('createdDate', 'desc'))),
            getDocs(query(subCol(uid, 'savingsHistory'), orderBy('timestamp', 'desc'))),
            getDocs(subCol(uid, 'goals')),
            getDocs(subCol(uid, 'achievements')),
        ]);

        const expenses       = expSnap.docs.map(d  => ({ _fsId: d.id, ...d.data() }));
        const incomeHistory  = incSnap.docs.map(d  => ({ _fsId: d.id, ...d.data() }));
        const debts          = debSnap.docs.map(d  => ({ _fsId: d.id, ...d.data() }));
        const savingsHistory = savSnap.docs.map(d  => ({ _fsId: d.id, ...d.data() }));
        const goals          = goalSnap.docs.map(d => ({ _fsId: d.id, ...d.data() }));
        const achievements   = achSnap.docs.map(d  => ({ _fsId: d.id, ...d.data() }));

        return {
            profile,
            expenses,
            incomeHistory,
            debts,
            savingsHistory,
            goals,
            achievements,
            income:       profile.income       || 0,
            onlineIncome: profile.onlineIncome  || 0,
            cashIncome:   profile.cashIncome    || 0,
            savings:      profile.savings       || 0,
        };
    } catch (err) {
        console.error('[FS] loadAll failed, falling back to localStorage:', err);
        return null; // signal to fall back to localStorage
    }
}

// ── Ensure the user document exists (creates it if needed) ───────────────────
async function ensureUserDoc(uid, email, isGuest) {
    try {
        const snap = await getDoc(userRef(uid));
        if (!snap.exists()) {
            await setDoc(userRef(uid), {
                email:        email || '',
                isGuest:      isGuest || false,
                createdAt:    serverTimestamp(),
                income:       0,
                onlineIncome: 0,
                cashIncome:   0,
                savings:      0,
            });
        }
    } catch (err) {
        console.warn('[FS] ensureUserDoc error:', err);
    }
}

// ── Expense operations ─────────────────────────────────────────────────────
async function saveExpense(uid, expense) {
    try {
        const data = { ...expense, timestamp: expense.timestamp || new Date().toISOString() };
        delete data._fsId; // don't store internal field
        if (expense._fsId) {
            await setDoc(doc(subCol(uid, 'expenses'), expense._fsId), data);
            return expense._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'expenses'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveExpense error:', err);
    }
}

async function deleteExpense(uid, fsId) {
    if (!fsId) return;
    try {
        await deleteDoc(doc(subCol(uid, 'expenses'), fsId));
    } catch (err) {
        console.warn('[FS] deleteExpense error:', err);
    }
}

// ── Income operations ──────────────────────────────────────────────────────
async function saveIncome(uid, incomeRecord) {
    try {
        const data = { ...incomeRecord, timestamp: incomeRecord.timestamp || new Date().toISOString() };
        delete data._fsId;
        if (incomeRecord._fsId) {
            await setDoc(doc(subCol(uid, 'incomeHistory'), incomeRecord._fsId), data);
            return incomeRecord._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'incomeHistory'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveIncome error:', err);
    }
}

async function deleteIncome(uid, fsId) {
    if (!fsId) return;
    try {
        await deleteDoc(doc(subCol(uid, 'incomeHistory'), fsId));
    } catch (err) {
        console.warn('[FS] deleteIncome error:', err);
    }
}

// ── User totals (income, savings) ─────────────────────────────────────────
async function saveUserTotals(uid, totals) {
    try {
        await setDoc(userRef(uid), totals, { merge: true });
    } catch (err) {
        console.warn('[FS] saveUserTotals error:', err);
    }
}

// ── Debt operations ────────────────────────────────────────────────────────
async function saveDebt(uid, debt) {
    try {
        const data = { ...debt };
        delete data._fsId;
        if (debt._fsId) {
            await setDoc(doc(subCol(uid, 'debts'), debt._fsId), data);
            return debt._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'debts'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveDebt error:', err);
    }
}

async function updateDebt(uid, fsId, updates) {
    if (!fsId) return;
    try {
        await updateDoc(doc(subCol(uid, 'debts'), fsId), updates);
    } catch (err) {
        console.warn('[FS] updateDebt error:', err);
    }
}

async function deleteDebt(uid, fsId) {
    if (!fsId) return;
    try {
        await deleteDoc(doc(subCol(uid, 'debts'), fsId));
    } catch (err) {
        console.warn('[FS] deleteDebt error:', err);
    }
}

// ── Savings operations ─────────────────────────────────────────────────────
async function saveSavingsEntry(uid, entry) {
    try {
        const data = { ...entry, timestamp: entry.timestamp || new Date().toISOString() };
        delete data._fsId;
        if (entry._fsId) {
            await setDoc(doc(subCol(uid, 'savingsHistory'), entry._fsId), data);
            return entry._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'savingsHistory'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveSavingsEntry error:', err);
    }
}

async function deleteSavingsEntry(uid, fsId) {
    if (!fsId) return;
    try {
        await deleteDoc(doc(subCol(uid, 'savingsHistory'), fsId));
    } catch (err) {
        console.warn('[FS] deleteSavingsEntry error:', err);
    }
}

// ── Goals operations ───────────────────────────────────────────────────────
async function saveGoal(uid, goal) {
    try {
        const data = { ...goal };
        delete data._fsId;
        if (goal._fsId) {
            await setDoc(doc(subCol(uid, 'goals'), goal._fsId), data);
            return goal._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'goals'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveGoal error:', err);
    }
}

async function deleteGoal(uid, fsId) {
    if (!fsId) return;
    try {
        await deleteDoc(doc(subCol(uid, 'goals'), fsId));
    } catch (err) {
        console.warn('[FS] deleteGoal error:', err);
    }
}

// ── Save achievement ───────────────────────────────────────────────────────
async function saveAchievement(uid, achievement) {
    try {
        const data = { ...achievement };
        delete data._fsId;
        if (achievement._fsId) {
            await setDoc(doc(subCol(uid, 'achievements'), achievement._fsId), data);
            return achievement._fsId;
        } else {
            const ref = await addDoc(subCol(uid, 'achievements'), data);
            return ref.id;
        }
    } catch (err) {
        console.warn('[FS] saveAchievement error:', err);
    }
}

// ── Expose everything globally via window.FS ──────────────────────────────
window.FS = {
    loadAll,
    ensureUserDoc,
    saveExpense,
    deleteExpense,
    saveIncome,
    deleteIncome,
    saveUserTotals,
    saveDebt,
    updateDebt,
    deleteDebt,
    saveSavingsEntry,
    deleteSavingsEntry,
    saveGoal,
    deleteGoal,
    saveAchievement,
};

console.log('[FS] firebase-sync.js loaded — window.FS ready');
