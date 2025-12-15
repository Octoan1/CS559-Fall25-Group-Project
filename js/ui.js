// UI system with main menu, level selection, and in-game interface
function createUI() {
    const timerEl = document.getElementById('timer');
    const messageEl = document.getElementById('status');
    const fastestEl = document.getElementById('fastestTime');
    const resetBtn = document.getElementById('resetBtn');
    const menuBtn = document.getElementById('menuBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const darkEl = document.getElementById('darkModeCheckbox');
    
    // Menu elements
    const mainMenu = document.getElementById('mainMenu');
    const levelSelectScreen = document.getElementById('levelSelectScreen');
    const gameUI = document.getElementById('gameUI');
    const controls = document.getElementById('controls');
    const endlessModeBtn = document.getElementById('endlessModeBtn');
    const raceModeBtn = document.getElementById('raceModeBtn');
    const levelModeBtn = document.getElementById('levelModeBtn');
    const backToMainBtn = document.getElementById('backToMainBtn');
    const levelGrid = document.getElementById('levelGrid');
    
    let onEndlessModeCallback = null;
    let onRaceModeCallback = null;
    let onLevelSelectCallback = null;
    let onMenuCallback = null;
    let onSettingsOpenCallback = null;
    let onSettingsCloseCallback = null;
    
    // Show/hide screens
    const hideSettings = () => {
        if (settingsMenu) settingsMenu.classList.add('hidden');
        if (onSettingsCloseCallback) onSettingsCloseCallback();
    };

    const showSettings = () => {
        if (settingsMenu) settingsMenu.classList.remove('hidden');
        if (onSettingsOpenCallback) onSettingsOpenCallback();
    };

    const showMainMenu = () => {
        mainMenu.classList.remove('hidden');
        levelSelectScreen.classList.add('hidden');
        gameUI.classList.add('hidden');
        controls.classList.add('hidden');
        hideSettings();
    };
    
    const showLevelSelect = () => {
        mainMenu.classList.add('hidden');
        levelSelectScreen.classList.remove('hidden');
        gameUI.classList.add('hidden');
        controls.classList.add('hidden');
        hideSettings();
    };
    
    const showGame = () => {
        mainMenu.classList.add('hidden');
        levelSelectScreen.classList.add('hidden');
        gameUI.classList.remove('hidden');
        controls.classList.remove('hidden');
        hideSettings();
    };
    
    // Event handlers
    endlessModeBtn.addEventListener('click', () => {
        showGame();
        if (onEndlessModeCallback) onEndlessModeCallback();
    });

    if (raceModeBtn) raceModeBtn.addEventListener('click', () => {
        showGame();
        if (onRaceModeCallback) onRaceModeCallback();
    });
    
    levelModeBtn.addEventListener('click', () => {
        showLevelSelect();
    });
    
    backToMainBtn.addEventListener('click', () => {
        showMainMenu();
        if (onMenuCallback) onMenuCallback();
    });
    
    if (settingsBtn) settingsBtn.addEventListener('click', showSettings);

    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideSettings);

    menuBtn.addEventListener('click', () => {
        hideSettings();
        showMainMenu();
        if (onMenuCallback) onMenuCallback();
    });
    
    // API for game logic
    const setTimer = (seconds) => {
        if (!timerEl) return;
        const s = typeof seconds === 'number' ? seconds : Number(seconds) || 0;
        timerEl.textContent = `Time: ${s.toFixed(2)}s`;
    };

    // Endless-mode fastest time helpers
    const setFastestTime = (seconds) => {
        if (!fastestEl) return;
        const valueEl = fastestEl.querySelector('.fastest-value');
        if (typeof seconds === 'number' && isFinite(seconds)) {
            if (valueEl) valueEl.textContent = `${seconds.toFixed(2)}s`;
            else fastestEl.textContent = `Fastest: ${seconds.toFixed(2)}s`;
        } else {
            if (valueEl) valueEl.textContent = '—';
            else fastestEl.textContent = 'Fastest: —';
        }
    };
    const setFastestVisible = (visible) => {
        if (!fastestEl) return;
        fastestEl.classList.toggle('hidden', !visible);
    };
    const pulseFastest = () => {
        if (!fastestEl) return;
        fastestEl.classList.remove('fastest-new');
        // force reflow to restart animation if already applied
        void fastestEl.offsetWidth;
        fastestEl.classList.add('fastest-new');
        setTimeout(() => fastestEl.classList.remove('fastest-new'), 1300);
    };

    const setMessage = (text) => { if (messageEl) messageEl.textContent = text; };
    const clearMessage = () => { if (messageEl) messageEl.textContent = ''; };

    const onReset = (fn) => { if (resetBtn) resetBtn.addEventListener('click', () => { hideSettings(); fn(); }); };
    
    const onEndlessMode = (fn) => { onEndlessModeCallback = fn; };
    const onRaceMode = (fn) => { onRaceModeCallback = fn; };
    const onLevelMode = (fn) => { onLevelSelectCallback = fn; };
    const onMenu = (fn) => { onMenuCallback = fn; };
    const onSettingsOpen = (fn) => { onSettingsOpenCallback = fn; };
    const onSettingsClose = (fn) => { onSettingsCloseCallback = fn; };
    
    // Populate level buttons (excluding endless mode)
    const setLevelOptions = (levelNames = []) => {
        if (!levelGrid) return;
        levelGrid.innerHTML = '';
        
        levelNames.forEach((name, index) => {
            // Skip endless mode levels
            if (name.startsWith('Endless')) return;
            
            const btn = document.createElement('button');
            btn.className = 'level-button';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                showGame();
                if (onLevelSelectCallback) onLevelSelectCallback(index);
            });
            levelGrid.appendChild(btn);
        });
    };

    const onDarkModeToggle = (fn) => { if (!darkEl) return; darkEl.addEventListener('change', (e) => fn(Boolean(e.target.checked))); };
    const setDarkMode = (enabled) => { if (!darkEl) return; darkEl.checked = Boolean(enabled); };
    
    // Compatibility methods (no longer used but kept for backward compatibility)
    const onLevelChange = () => {};
    const setSelectedLevel = () => {};

    return { 
        setTimer, 
        setFastestTime,
        setFastestVisible,
        pulseFastest,
        setMessage, 
        clearMessage, 
        onReset, 
        setLevelOptions, 
        onLevelChange, 
        setSelectedLevel, 
        onDarkModeToggle, 
        setDarkMode,
        onEndlessMode,
        onRaceMode,
        onLevelMode,
        onMenu,
        onSettingsOpen,
        onSettingsClose,
        showMainMenu,
        showLevelSelect,
        showGame
    };
}

window.createUI = createUI;
