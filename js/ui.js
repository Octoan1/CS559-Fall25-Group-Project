// Minimal UI helper for the non-module root version
function createUI() {
    const timerEl = document.getElementById('timer');
    const messageEl = document.getElementById('status');
    const resetBtn = document.getElementById('resetBtn');

    const setTimer = (seconds) => {
        if (!timerEl) return;
        const s = typeof seconds === 'number' ? seconds : Number(seconds) || 0;
        timerEl.textContent = `Time: ${s.toFixed(2)}s`;
    };

    const setMessage = (text) => { if (messageEl) messageEl.textContent = text; };
    const clearMessage = () => { if (messageEl) messageEl.textContent = ''; };

    const onReset = (fn) => { if (resetBtn) resetBtn.addEventListener('click', fn); };

    return { setTimer, setMessage, clearMessage, onReset };
}

window.createUI = createUI;
