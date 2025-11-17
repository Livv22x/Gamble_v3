// Simple coin system with localStorage persistence and cross-tab sync
(function () {
  const STORAGE_KEY = 'casino-coins';
  const STARTING_COINS = 100; // adjust as desired

  function getBalance() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    if (Number.isNaN(n)) return STARTING_COINS;
    return n;
  }

  function setBalance(n) {
    const clamped = Math.max(0, Math.floor(n));
    localStorage.setItem(STORAGE_KEY, String(clamped));
    updateDisplays(clamped);
    dispatchChange(clamped);
  }

  function ensureInitialized() {
    if (localStorage.getItem(STORAGE_KEY) == null) {
      localStorage.setItem(STORAGE_KEY, String(STARTING_COINS));
    }
  }

  function add(amount) {
    const cur = getBalance();
    setBalance(cur + Math.floor(amount));
  }

  function canAfford(amount) {
    return getBalance() >= Math.floor(amount);
  }

  function spend(amount) {
    const a = Math.floor(amount);
    const cur = getBalance();
    setBalance(cur - a);
  }

  function trySpend(amount) {
    if (!canAfford(amount)) return false;
    spend(amount);
    return true;
  }

  function format(n) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  }

  function updateDisplays(balance) {
    const els = document.querySelectorAll('[data-coin-balance]');
    els.forEach((el) => {
      el.textContent = format(balance);
    });
  }

  function dispatchChange(balance) {
    try {
      const ev = new CustomEvent('coins:change', { detail: { balance } });
      window.dispatchEvent(ev);
    } catch (_) {}
  }

  function initUI() {
    ensureInitialized();
    updateDisplays(getBalance());
  }

  // sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue != null) {
      const n = parseInt(e.newValue, 10);
      if (!Number.isNaN(n)) {
        updateDisplays(n);
        dispatchChange(n);
      }
    }
  });

  // public API
  window.Coins = {
    getBalance,
    setBalance,
    add,
    spend,
    trySpend,
    canAfford,
    format,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
