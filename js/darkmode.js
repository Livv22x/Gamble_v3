// Dark Mode Manager - Syncs across all pages using localStorage
(function() {
    const DARK_MODE_KEY = 'casino-dark-mode';
    const darkModeSwitch = document.getElementById('dark-mode-switch');

    // Initialize dark mode on page load
    function initDarkMode() {
        const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
        document.body.classList.toggle('dark-mode', isDarkMode);
        document.documentElement.classList.toggle('dark-mode', isDarkMode);
        if (darkModeSwitch) darkModeSwitch.checked = isDarkMode;
    }

    // Handle dark mode toggle
    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', function() {
            const isChecked = this.checked;
            
            // Save preference to localStorage
            localStorage.setItem(DARK_MODE_KEY, isChecked);
            
            // Apply dark mode class (html + body) for no-flash consistency
            document.body.classList.toggle('dark-mode', isChecked);
            document.documentElement.classList.toggle('dark-mode', isChecked);
            
            // Broadcast to other tabs/windows
            window.localStorage.setItem('darkModeToggle', Date.now());
        });
    }

    // Listen for changes from other tabs/windows
    window.addEventListener('storage', function(e) {
        if (e.key === 'darkModeToggle') {
            const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
            document.body.classList.toggle('dark-mode', isDarkMode);
            document.documentElement.classList.toggle('dark-mode', isDarkMode);
            if (darkModeSwitch) {
                darkModeSwitch.checked = isDarkMode;
            }
        }
    });

    // Initialize on load
    initDarkMode();
})();
