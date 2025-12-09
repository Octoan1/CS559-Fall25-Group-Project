// Minimal UI helper for the non-module root version
function createUI() {
    const timerEl = document.getElementById('timer');
    const messageEl = document.getElementById('status');
    const resetBtn = document.getElementById('resetBtn');
    const levelSelect = document.getElementById('levelSelect');

    const setTimer = (seconds) => {
        if (!timerEl) return;
        const s = typeof seconds === 'number' ? seconds : Number(seconds) || 0;
        timerEl.textContent = `Time: ${s.toFixed(2)}s`;
    };

    const setMessage = (text) => { if (messageEl) messageEl.textContent = text; };
    const clearMessage = () => { if (messageEl) messageEl.textContent = ''; };

    const onReset = (fn) => { if (resetBtn) resetBtn.addEventListener('click', fn); };
    const setLevelOptions = (options = []) => {
        if (!levelSelect) return;
        levelSelect.innerHTML = '';
        options.forEach((opt, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = opt;
            levelSelect.appendChild(o);
        });
    };
    const onLevelChange = (fn) => { if (!levelSelect) return; levelSelect.addEventListener('change', (e) => fn(Number(e.target.value))); };
    const setSelectedLevel = (index) => { if (!levelSelect) return; levelSelect.value = String(index); };

    const darkEl = document.getElementById('darkModeCheckbox');
    const onDarkModeToggle = (fn) => { if (!darkEl) return; darkEl.addEventListener('change', (e) => fn(Boolean(e.target.checked))); };
    const setDarkMode = (enabled) => { if (!darkEl) return; darkEl.checked = Boolean(enabled); };

    return { setTimer, setMessage, clearMessage, onReset, setLevelOptions, onLevelChange, setSelectedLevel, onDarkModeToggle, setDarkMode };
}

window.createUI = createUI;
