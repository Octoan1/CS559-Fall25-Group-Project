export function createUI() {
  const timerEl = document.getElementById('timer');
  const messageEl = document.getElementById('message');
  const resetBtn = document.getElementById('resetBtn');

  const setTimer = (seconds) => {
    const s = typeof seconds === 'number' ? seconds : Number(seconds) || 0;
    timerEl.textContent = `Time: ${s.toFixed(2)}s`;
  };

  const setMessage = (text) => { messageEl.textContent = text; };
  const clearMessage = () => { messageEl.textContent = ''; };

  const onReset = (fn) => { resetBtn.addEventListener('click', fn); };

  return { setTimer, setMessage, clearMessage, onReset };
}
