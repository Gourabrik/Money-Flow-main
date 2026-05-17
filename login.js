// ── Import Firebase services from central config ────────────────────────────
import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    onAuthStateChanged,
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
    doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// ── Redirect if already logged in ──────────────────────────────────────────
onAuthStateChanged(auth, user => {
    if (user) window.location.href = 'index.html';
});

// ── DOM refs ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const form          = document.getElementById('login-form');
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError    = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const authError     = document.getElementById('auth-error');
    const submitBtn     = document.getElementById('submit-btn');
    const submitText    = document.getElementById('submit-text');      // direct ID ref now
    const submitSpinner = document.getElementById('submit-spinner');
    const togglePwdBtn  = document.getElementById('toggle-password');
    const togglePwdIcon = togglePwdBtn ? togglePwdBtn.querySelector('i') : null;
    const modeToggle    = document.getElementById('mode-toggle');
    const formTitle     = document.getElementById('form-title');
    const formSubtitle  = document.getElementById('form-subtitle');
    const guestBtn      = document.getElementById('guest-login');
    const rememberMe    = document.getElementById('remember-me');
    const forgotLink    = document.getElementById('forgot-link');

    let isSignUp = false;

    // ── Forgot password ─────────────────────────────────────────────────
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) {
                showAuthError('Enter your email address first, then click Forgot.');
                return;
            }
            try {
                await sendPasswordResetEmail(auth, email);
                showAuthError('✅ Reset email sent! Check your inbox.');
                authError.style.background = 'rgba(52,211,153,.12)';
                authError.style.borderColor = 'rgba(52,211,153,.3)';
                authError.style.color = '#6ee7b7';
            } catch (err) {
                showAuthError(friendlyError(err.code));
            }
        });
    }

    // ── Toggle Sign-in / Sign-up mode ──────────────────────────────────
    function bindModeLink() {
        const link = document.getElementById('mode-link');
        if (link) link.addEventListener('click', e => { e.preventDefault(); toggleMode(); });
    }

    function toggleMode() {
        isSignUp = !isSignUp;
        if (isSignUp) {
            formTitle.textContent    = 'Create Account';
            formSubtitle.textContent = 'Start your financial journey today';
            if (submitText) submitText.textContent = 'Create Account';
            modeToggle.innerHTML = 'Already have an account? <a href="#" id="mode-link">Sign In</a>';
        } else {
            formTitle.textContent    = 'Welcome Back';
            formSubtitle.textContent = 'Securely sign in to your dashboard';
            if (submitText) submitText.textContent = 'Sign In to Dashboard';
            modeToggle.innerHTML = 'New to MoneyFlow? <a href="#" id="mode-link">Create an account</a>';
        }
        bindModeLink();
        clearErrors();
    }

    bindModeLink();

    // ── Password toggle ─────────────────────────────────────────────────
    if (togglePwdBtn && togglePwdIcon) {
        togglePwdBtn.addEventListener('click', () => {
            const isText = passwordInput.type === 'text';
            passwordInput.type     = isText ? 'password' : 'text';
            togglePwdIcon.className = isText ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }

    // ── Live error clear ────────────────────────────────────────────────
    emailInput.addEventListener('input',    () => { emailError.style.display    = 'none'; emailInput.style.borderColor    = ''; });
    passwordInput.addEventListener('input', () => { passwordError.style.display = 'none'; passwordInput.style.borderColor = ''; });

    // ── Form submit ─────────────────────────────────────────────────────
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        clearErrors();

        const email    = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            await setPersistence(auth, rememberMe && rememberMe.checked
                ? browserLocalPersistence
                : browserSessionPersistence);

            if (isSignUp) {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', cred.user.uid), {
                    email:     cred.user.email,
                    createdAt: serverTimestamp(),
                    isGuest:   false
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // onAuthStateChanged handles redirect to index.html
        } catch (err) {
            setLoading(false);
            showAuthError(friendlyError(err.code));
        }
    });

    // ── Guest login ─────────────────────────────────────────────────────
    if (guestBtn) {
        guestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            setGuestLoading(true);
            try {
                await signInAnonymously(auth);
                // onAuthStateChanged handles redirect
            } catch (err) {
                console.warn('[Guest] Anonymous failed, trying fallback...', err.code);
                try {
                    const guestEmail = `guest_${Date.now()}@moneyflow.local`;
                    const guestPwd   = Math.random().toString(36).slice(-10) + 'A1!';
                    const cred       = await createUserWithEmailAndPassword(auth, guestEmail, guestPwd);
                    await setDoc(doc(db, 'users', cred.user.uid), {
                        email: cred.user.email, createdAt: serverTimestamp(), isGuest: true
                    });
                } catch (fallbackErr) {
                    console.error('[Guest] Fallback failed:', fallbackErr);
                    setGuestLoading(false);
                    showAuthError('Guest sign-in failed. Please try again.');
                }
            }
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────
    function validate() {
        let ok = true;
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim() || !emailRx.test(emailInput.value.trim())) {
            emailError.style.display = 'block';
            emailInput.style.borderColor = '#f87171';
            ok = false;
        }
        if (!passwordInput.value || passwordInput.value.length < 6) {
            passwordError.textContent   = passwordInput.value ? 'Min 6 characters required.' : 'Password required.';
            passwordError.style.display = 'block';
            passwordInput.style.borderColor = '#f87171';
            ok = false;
        }
        return ok;
    }

    function setLoading(on) {
        submitBtn.disabled = on;
        if (submitText)    submitText.textContent = on ? (isSignUp ? 'Creating...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In to Dashboard');
        if (submitSpinner) submitSpinner.style.display = on ? 'block' : 'none';
    }

    function setGuestLoading(on) {
        if (!guestBtn) return;
        guestBtn.disabled = on;
        const guestTextEl = document.getElementById('guest-text');
        if (on) {
            if (guestTextEl) guestTextEl.textContent = 'Signing in...';
        } else {
            if (guestTextEl) guestTextEl.textContent = 'Continue as Guest';
        }
    }

    function clearErrors() {
        emailError.style.display = passwordError.style.display = authError.style.display = 'none';
        emailInput.style.borderColor = passwordInput.style.borderColor = '';
        authError.style.background = '';
        authError.style.borderColor = '';
        authError.style.color = '';
    }

    function showAuthError(msg) {
        authError.textContent   = msg;
        authError.style.display = 'block';
    }

    function friendlyError(code) {
        const map = {
            'auth/user-not-found':         'No account found with this email.',
            'auth/wrong-password':         'Incorrect password. Please try again.',
            'auth/invalid-email':          'Please enter a valid email address.',
            'auth/email-already-in-use':   'This email is already registered. Try signing in.',
            'auth/weak-password':          'Password must be at least 6 characters.',
            'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
            'auth/invalid-credential':     'Invalid email or password.',
            'auth/network-request-failed': 'Network error. Check your connection.',
            'auth/operation-not-allowed':  'This sign-in method is not enabled.',
        };
        return map[code] || `Something went wrong (${code}). Please try again.`;
    }
});