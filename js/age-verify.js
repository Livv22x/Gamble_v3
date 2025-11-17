// Age verification modal - shows on page load
(function() {
    const AGE_VERIFY_KEY = 'casino-age-verified';

    function showAgeVerification() {
        // Check if already verified in this session
        if (sessionStorage.getItem(AGE_VERIFY_KEY)) {
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'age-verify-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 12px;
            max-width: 400px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: slideIn 0.3s ease;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">
                ⚠️ Age Verification
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px;">
                This website contains gambling content. You must be <strong>18 years or older</strong> to continue.
            </p>
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button id="age-deny-btn" style="
                    flex: 1;
                    padding: 14px 20px;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 200ms ease;
                ">
                    I'm Under 18
                </button>
                <button id="age-confirm-btn" style="
                    flex: 1;
                    padding: 14px 20px;
                    background: #2980b9;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 200ms ease;
                ">
                    I'm 18 or Older
                </button>
            </div>
            <p style="margin: 20px 0 0 0; font-size: 12px; color: #999;">
                Age verification is required to access this site.
            </p>
        `;

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            body.age-blocked {
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Prevent body scroll while modal is open
        document.body.style.overflow = 'hidden';

        const confirmBtn = document.getElementById('age-confirm-btn');
        const denyBtn = document.getElementById('age-deny-btn');

        function verifyAge() {
            // Verified - store and close modal
            sessionStorage.setItem(AGE_VERIFY_KEY, 'true');
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
            }, 300);
        }

        function denyAccess() {
            alert('You must be 18 or older to access this website. Redirecting...');
            window.location.href = 'https://www.google.com';
        }

        confirmBtn.addEventListener('click', verifyAge);
        denyBtn.addEventListener('click', denyAccess);
    }

    // Show on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showAgeVerification);
    } else {
        showAgeVerification();
    }
})();
