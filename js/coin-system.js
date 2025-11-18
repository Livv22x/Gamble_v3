// Simple coin system with localStorage persistence and cross-tab sync
(function () {
  const STORAGE_KEY = 'casino-coins';
  const STARTING_COINS = 500; // starting balance for new users and daily reset
  const MIGRATION_FLAG_500 = 'casino-coins-migrated-to-500'; // one-time bump from legacy 100 → 500

  // Legacy rolling-24h key (kept for migration/no-op)
  const LAST_RESET_KEY = 'casino-coins-last-reset';

  // New keys for calendar-based noon reset
  const LAST_CAL_RESET_KEY = 'casino-coins-last-calendar-reset';
  const NEXT_RESET_AT_KEY = 'casino-coins-next-reset'; // timestamp (ms) of the next local 12:00 PM

  let resetTimerId = null;
  let countdownIntervalId = null;

  // --- EncryptedText-like reveal for countdown ---
  // Lightweight vanilla port of a per-character scrambling effect.
  const _scrambleState = new WeakMap();
  // Track elements that have already played the intro animation once per page load
  const _animatedOnce = new WeakSet();
  const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?".split("");

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }

  function runEncryptedReveal(el, targetText, opts) {
    // Allow opt-out per element
    if (!el || el.getAttribute('data-scramble') === 'off' || prefersReducedMotion()) {
      el.textContent = targetText;
      el.classList.remove('is-encrypting');
      el.classList.add('is-revealed');
      return;
    }

    const duration = (opts && opts.durationMs) || 350; // keep short to avoid flicker with 1s updates
    const revealDelay = (opts && opts.revealDelayMs) || 50;

    // Cancel any running animation on this element
    const prev = _scrambleState.get(el);
    if (prev && typeof prev.cancel === 'function') prev.cancel();

    const startTime = performance.now() + revealDelay;
    const len = targetText.length;
    const revealProgress = new Array(len).fill(0);
    const revealOrder = [...Array(len).keys()];
    // Reveal left-to-right but keep spaces/punctuation stable from the start
    const isStable = (ch) => /[\s:.,]/.test(ch);
    const targetArr = targetText.split("");
    const stableMask = targetArr.map(isStable);

    let rafId = null;
    let cancelled = false;
    function cancel() { cancelled = true; if (rafId) cancelAnimationFrame(rafId); }

    _scrambleState.set(el, { cancel });
    el.classList.add('is-encrypting');
    el.classList.remove('is-revealed');

    function frame(nowTs) {
      if (cancelled) return;
      const t = Math.max(0, nowTs - startTime);
      const pct = duration === 0 ? 1 : Math.min(1, t / duration);

      let out = "";
      for (let i = 0; i < len; i++) {
        if (stableMask[i]) {
          out += targetArr[i];
          revealProgress[i] = 1;
          continue;
        }
        // Linear reveal left-to-right
        const threshold = (i + 1) / len;
        if (pct >= threshold) {
          out += targetArr[i];
          revealProgress[i] = 1;
        } else {
          // scramble
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = out;
      if (pct < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        el.textContent = targetText; // ensure exact text at end
        el.classList.remove('is-encrypting');
        el.classList.add('is-revealed');
        _scrambleState.delete(el);
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  function now() {
    return Date.now();
  }

  function computeTodayNoonTimestamp(ms) {
    const d = new Date(ms);
    d.setHours(12, 0, 0, 0); // local 12:00 PM
    return d.getTime();
  }

  function computeNextNoonTimestamp(ms) {
    const t = ms ?? now();
    const todayNoon = computeTodayNoonTimestamp(t);
    if (t < todayNoon) return todayNoon; // later today at 12:00 PM
    // otherwise tomorrow 12:00 PM
    const d = new Date(t);
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }

  function scheduleResetTimer(nextTs) {
    try { if (resetTimerId != null) clearTimeout(resetTimerId); } catch (_) {}
    const delay = Math.max(0, Math.min(0x7fffffff, nextTs - now()));
    resetTimerId = setTimeout(() => {
      // When the timer fires, apply reset if still due, then reschedule.
      applyNoonResetIfDue();
    }, delay);
  }

  // Apply a calendar-day reset at local 12:00 PM if due.
  function applyNoonResetIfDue() {
    let didReset = false;
    try {
      const rawNext = localStorage.getItem(NEXT_RESET_AT_KEY);
      let nextTs = rawNext == null ? NaN : parseInt(rawNext, 10);

      if (Number.isNaN(nextTs)) {
        // First-time initialization or migration: compute the next noon from now.
        nextTs = computeNextNoonTimestamp(now());
      }

      const t = now();
      if (t >= nextTs) {
        // Reset to exactly the starting amount at/after noon.
        setBalance(STARTING_COINS);
        localStorage.setItem(LAST_CAL_RESET_KEY, String(t));
        // Compute the following noon from "now" to tolerate missed timers, DST, etc.
        const following = computeNextNoonTimestamp(t + 1);
        localStorage.setItem(NEXT_RESET_AT_KEY, String(following));
        if (document.documentElement.classList.contains('debug')) {
          try { console.log('[Coins] Daily noon reset applied — balance set to', STARTING_COINS); } catch (_) {}
        }
        didReset = true;
        scheduleResetTimer(following);
        // After a reset, make sure countdown UI immediately reflects the new schedule
        try { updateCountdownDisplays(); } catch (_) {}
        return true;
      }

      // Not due yet — make sure a timer is scheduled
      localStorage.setItem(NEXT_RESET_AT_KEY, String(nextTs));
      scheduleResetTimer(nextTs);
    } catch (_) {}
    return didReset;
  }

  // Publicly exposed getter for next reset timestamp (ms since epoch)
  function getNextResetTimestamp() {
    try {
      // ensure keys exist
      ensureInitialized();
      const rawNext = localStorage.getItem(NEXT_RESET_AT_KEY);
      let nextTs = rawNext == null ? NaN : parseInt(rawNext, 10);
      if (Number.isNaN(nextTs)) {
        nextTs = computeNextNoonTimestamp(now());
        localStorage.setItem(NEXT_RESET_AT_KEY, String(nextTs));
      }
      return nextTs;
    } catch (_) {
      return computeNextNoonTimestamp(now());
    }
  }

  // Format remaining milliseconds as HH:MM:SS (hours can exceed 24 in edge cases)
  function formatRemaining(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function formatExactTime(ts) {
    try {
      const d = new Date(ts);
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric', minute: '2-digit', second: '2-digit',
        weekday: 'short', month: 'short', day: 'numeric'
      }).format(d);
    } catch (_) {
      return '';
    }
  }

  function updateCountdownDisplays() {
    const nodes = document.querySelectorAll('[data-coin-countdown]');
    if (!nodes.length) return; // no countdowns present on this page
    const nextTs = getNextResetTimestamp();
    let remaining = nextTs - now();
    if (remaining <= 0) {
      // Try to apply reset and fetch a new schedule
      const did = applyNoonResetIfDue();
      remaining = getNextResetTimestamp() - now();
      if (!did && remaining < 0) remaining = 0;
    }
    const label = formatRemaining(remaining);
    const exact = formatExactTime(nextTs);
    nodes.forEach((el) => {
      // Ensure parent container (if present) announces politely
      try { el.parentElement && el.parentElement.setAttribute('aria-live', 'polite'); } catch (_) {}
      const text = `Next reset in ${label}`;
      // Only animate once at the start of the site; afterwards just update text
      const reduceMotion = prefersReducedMotion();
      const scrambleOff = el.getAttribute('data-scramble') === 'off';
      if (!reduceMotion && !scrambleOff && !_animatedOnce.has(el)) {
        // Play the intro animation once
        runEncryptedReveal(el, text, { durationMs: 820, revealDelayMs: 120 });
        _animatedOnce.add(el);
      } else {
        // Subsequent ticks: set text directly, keep revealed styling
        el.textContent = text;
        el.classList.remove('is-encrypting');
        el.classList.add('is-revealed');
      }
      if (exact) el.setAttribute('title', `Scheduled: ${exact}`);
    });
  }

  function getBalance() {
    // Ensure any pending noon reset is applied before reading
    applyNoonResetIfDue();
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
    const hasCoins = localStorage.getItem(STORAGE_KEY) != null;
    if (!hasCoins) {
      localStorage.setItem(STORAGE_KEY, String(STARTING_COINS));
    } else {
      // One-time migration: If an existing user still has the legacy default 100,
      // bump them to the new starting balance 500 once, then remember we migrated.
      try {
        const migrated = localStorage.getItem(MIGRATION_FLAG_500) === 'true';
        const current = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        if (!migrated && current === 100) {
          localStorage.setItem(STORAGE_KEY, String(STARTING_COINS));
          localStorage.setItem(MIGRATION_FLAG_500, 'true');
        }
      } catch (_) {}
    }
    // Migration/initialization for calendar noon reset
    if (localStorage.getItem(NEXT_RESET_AT_KEY) == null) {
      // Migrate legacy anchor if present (no functional need, but keeps a record)
      const legacy = localStorage.getItem(LAST_RESET_KEY);
      if (legacy != null) {
        localStorage.setItem(LAST_CAL_RESET_KEY, legacy);
      }
      const nextTs = computeNextNoonTimestamp(now());
      localStorage.setItem(NEXT_RESET_AT_KEY, String(nextTs));
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
    // Apply noon reset if due on startup and schedule next
    applyNoonResetIfDue();
    updateDisplays(getBalance());
    // Start/refresh countdown ticker
    try { if (countdownIntervalId != null) clearInterval(countdownIntervalId); } catch (_) {}
    updateCountdownDisplays();
    countdownIntervalId = setInterval(updateCountdownDisplays, 1000);
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
    if (e.key === NEXT_RESET_AT_KEY && e.newValue != null) {
      // Another tab rescheduled the next reset — update countdown
      try { updateCountdownDisplays(); } catch (_) {}
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
    getNextResetTimestamp,
    // Optional helpers for debugging or future features
    _checkResetDue: applyNoonResetIfDue,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  // Also check on visibility changes (e.g., user comes back after noon passed)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      const didReset = applyNoonResetIfDue();
      if (didReset) {
        // Displays are already updated by setBalance inside checkResetDue.
      } else {
        updateDisplays(getBalance());
      }
      // Always refresh countdown when user returns
      try { updateCountdownDisplays(); } catch (_) {}
    }
  });
})();
