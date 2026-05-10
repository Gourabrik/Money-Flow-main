document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const togglePasswordIcon = togglePasswordBtn.querySelector('i');
    
    const submitBtn = document.getElementById('submit-btn');
    const submitText = submitBtn.querySelector('span');
    const submitSpinner = document.getElementById('submit-spinner');
    
    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        if (type === 'text') {
            togglePasswordIcon.classList.remove('fa-eye');
            togglePasswordIcon.classList.add('fa-eye-slash');
        } else {
            togglePasswordIcon.classList.remove('fa-eye-slash');
            togglePasswordIcon.classList.add('fa-eye');
        }
    });

    // Form Validation and Submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let isValid = true;
        
        // Reset errors
        emailError.style.display = 'none';
        passwordError.style.display = 'none';
        emailInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        passwordInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        
        // Validate Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
            emailError.style.display = 'block';
            emailInput.style.borderColor = '#f87171';
            isValid = false;
        }
        
        // Validate Password
        if (!passwordInput.value.trim()) {
            passwordError.style.display = 'block';
            passwordInput.style.borderColor = '#f87171';
            isValid = false;
        }
        
        if (isValid) {
            simulateLogin();
        }
    });

    // Clear errors on input
    emailInput.addEventListener('input', () => {
        emailError.style.display = 'none';
        emailInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });

    passwordInput.addEventListener('input', () => {
        passwordError.style.display = 'none';
        passwordInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });

    function simulateLogin() {
        // Show loading state
        submitText.textContent = 'Signing in...';
        submitSpinner.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        
        // Simulate network request
        setTimeout(() => {
            localStorage.setItem('moneyflow_loggedin', 'true');
            localStorage.setItem('moneyflow_user', emailInput.value);
            window.location.href = 'index.html';
        }, 1500);
    }

    // Handle Google Login
    const googleBtn = document.getElementById('google-login');
    googleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const originalText = this.innerHTML;
        this.innerHTML = '<div class="loading-spinner"></div>';
        this.disabled = true;
        
        setTimeout(() => {
            localStorage.setItem('moneyflow_loggedin', 'true');
            localStorage.setItem('moneyflow_user', 'Google User');
            window.location.href = 'index.html';
        }, 1000);
    });

    // Handle Guest Login
    const guestBtn = document.getElementById('guest-login');
    guestBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const originalText = this.innerHTML;
        this.innerHTML = '<div class="loading-spinner"></div>';
        this.disabled = true;
        
        setTimeout(() => {
            localStorage.setItem('moneyflow_loggedin', 'true');
            localStorage.setItem('moneyflow_user', 'Guest');
            window.location.href = 'index.html';
        }, 800);
    });
});