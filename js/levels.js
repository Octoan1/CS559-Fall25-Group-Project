// Simple levels loader (global) - loads `OTHER/levels.json`
let __cachedLevels = null;
function loadLevels(url = 'OTHER/levels.json') {
    if (__cachedLevels) return Promise.resolve(__cachedLevels);
    return fetch(url).then(res => {
        if (!res.ok) throw new Error(`Failed to load levels from ${url}`);
        return res.json();
    }).then(data => {
        __cachedLevels = data.levels || [];
        return __cachedLevels;
    });
}

function loadLevel(index = 0, url = 'OTHER/levels.json') {
    return loadLevels(url).then(levels => {
        if (!levels.length) throw new Error('No levels found in levels.json');
        return levels[Math.min(index, levels.length - 1)];
    });
}

// expose globally for non-module scripts
window.loadLevels = loadLevels;
window.loadLevel = loadLevel;
