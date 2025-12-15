// Simple levels loader (global) - loads `levels.json`
let __cachedLevels = null;

// Convert grid coordinates (col,row) to world coordinates centered on the 20x20 platform.
// This maps grid (0..cols-1, 0..rows-1) to roughly -10..10 in world space, covering the full board.
function gridToWorld(col, row, rows, cols, cellSizeX, cellSizeZ) {
    const x = (col + 0.5 - cols / 2) * cellSizeX;
    const z = (row + 0.5 - rows / 2) * cellSizeZ;
    return { x, z };
}

function addBorderWalls(level) {
    const rows = level.gridRows || 20;
    const cols = level.gridCols || 20;
    const existing = new Set((level.walls || []).map(([c, r]) => `${c},${r}`));
    for (let c = 0; c < cols; c++) {
        if (!existing.has(`${c},0`)) level.walls.push([c, 0]);
        if (!existing.has(`${c},${rows - 1}`)) level.walls.push([c, rows - 1]);
    }
    for (let r = 1; r < rows - 1; r++) {
        if (!existing.has(`0,${r}`)) level.walls.push([0, r]);
        if (!existing.has(`${cols - 1},${r}`)) level.walls.push([cols - 1, r]);
    }
}

// Normalize a level defined in grid space into world-space coordinates expected by GameObjects.
function normalizeLevel(level) {
    const rows = level.gridRows || 20;
    const cols = level.gridCols || 20;
    const cellSizeX = 20 / cols;
    const cellSizeZ = 20 / rows;

    // Initialize walls array (may be populated by patterns below)
    level.walls = level.walls ? [...level.walls] : [];

    // Support simple named patterns to avoid huge JSON lists (developer-friendly)
    if (level.pattern === 'checkerboard') {
        // Fill interior with a checkerboard pattern (skip borders)
        level.walls = [];
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if ((r + c) % 2 === 0) {
                    level.walls.push([c, r]);
                }
            }
        }
    }

    // Ensure border walls exist in grid space
    addBorderWalls(level);

    // Always interpret positions as grid coordinates, then convert to world.
    const toWorldPos = (obj, defaultY = 1.0) => {
        if (!obj) return obj;
        const { x, z } = gridToWorld(obj.x, obj.z, rows, cols, cellSizeX, cellSizeZ);
        return { x, y: obj.y ?? defaultY, z };
    };

    const start = toWorldPos(level.start, 1.0);
    const goal = toWorldPos(level.goal, 0.05);
    const radius = level.goal?.radius ?? (0.8 * Math.min(cellSizeX, cellSizeZ));

    // Keep walls in grid space; convert later when instantiating obstacles.
    return {
        ...level,
        start,
        goal: goal ? { ...goal, radius } : undefined,
        walls: [...level.walls],
        cellSizeX,
        cellSizeZ,
        gridRows: rows,
        gridCols: cols,
    };
}

// Procedural level generation with reachability check (BFS) in grid space.
function generateProceduralLevel(config) {
    const rows = config.gridRows || 20;
    const cols = config.gridCols || 20;
    const minObstacles = config.minObstacles ?? 8;
    const maxObstacles = config.maxObstacles ?? 18;
    const retries = config.retries ?? 500;

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function placeBorder(grid) {
        for (let c = 0; c < cols; c++) {
            grid[0][c] = 1;
            grid[rows - 1][c] = 1;
        }
        for (let r = 0; r < rows; r++) {
            grid[r][0] = 1;
            grid[r][cols - 1] = 1;
        }
    }

    function isReachable(grid, start, goal) {
        const q = [start];
        const seen = new Set([`${start.r},${start.c}`]);
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        while (q.length) {
            const { r, c } = q.shift();
            if (r === goal.r && c === goal.c) return true;
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                const key = `${nr},${nc}`;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                // Skip border walls only; allow reserved (value 2) and obstacles we'll skip later
                if (grid[nr][nc] === 1 && (nr === 0 || nr === rows - 1 || nc === 0 || nc === cols - 1)) continue;
                if (grid[nr][nc] === 3) continue; // Skip actual obstacles (value 3)
                if (seen.has(key)) continue;
                seen.add(key);
                q.push({ r: nr, c: nc });
            }
        }
        return false;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
        placeBorder(grid);

        // Start position: second-leftmost column (col = 1), random row
        const start = { r: randomInt(1, rows - 2), c: 1 };
        
        // Goal position: second-rightmost column (col = cols - 2), random row
        let goal = { r: randomInt(1, rows - 2), c: cols - 2 };
        // ensure goal not at start
        while (goal.r === start.r && goal.c === start.c) {
            goal = { r: randomInt(1, rows - 2), c: cols - 2 };
        }

        // Don't mark start/goal as obstacles; they're passable
        // Mark them with a reserved value to prevent obstacles from spawning there
        grid[start.r][start.c] = 2; // Reserve for start
        grid[goal.r][goal.c] = 2;   // Reserve for goal

        const obstacleCount = randomInt(minObstacles, maxObstacles);
        let placed = 0;
        while (placed < obstacleCount) {
            const r = randomInt(1, rows - 2);
            const c = randomInt(1, cols - 2);
            if (grid[r][c] !== 0) continue; // Only place on empty cells (value 0)
            grid[r][c] = 3; // Mark obstacles with value 3 (distinct from border walls = 1)
            placed++;
        }

        // Check reachability; if it fails, try with fewer obstacles
        let attempts = 0;
        let currentObstacles = placed;
        while (!isReachable(grid, start, goal) && attempts < 3) {
            // Reduce obstacles and retry
            currentObstacles = Math.max(Math.floor(minObstacles * 0.8), Math.floor(currentObstacles * 0.7));
            
            // Reset interior grid (keep borders = 1)
            for (let r = 1; r < rows - 1; r++) {
                for (let c = 1; c < cols - 1; c++) {
                    if (grid[r][c] === 3) grid[r][c] = 0; // Clear only obstacles, not borders or reserved cells
                }
            }
            
            // Restore reserved cells for start/goal
            grid[start.r][start.c] = 2;
            grid[goal.r][goal.c] = 2;
            
            // Re-place fewer obstacles
            placed = 0;
            while (placed < currentObstacles) {
                const r = randomInt(1, rows - 2);
                const c = randomInt(1, cols - 2);
                if (grid[r][c] !== 0) continue; // Only place on empty cells (value 0)
                grid[r][c] = 3;
                placed++;
            }
            
            attempts++;
        }
        
        if (!isReachable(grid, start, goal)) continue;

        // Build level from grid (only include value 3 obstacles, not borders)
        // Note: Game expects walls as [col, row], so push [c, r].
        const walls = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === 3) {
                    walls.push([c, r]);
                } else if ((r === 0 || r === rows - 1 || c === 0 || c === cols - 1) && grid[r][c] === 1) {
                    walls.push([c, r]);
                }
            }
        }
        
        return {
            name: `Endless-${Date.now()}`,
            gridRows: rows,
            gridCols: cols,
            start: { x: start.c, y: 1.0, z: start.r },
            goal: { x: goal.c, y: 0.05, z: goal.r, radius: 0.8 },
            walls,
        };
    }

    throw new Error('Failed to generate a reachable procedural level after retries');
}

function normalizeLevelsData(data) {
    const levels = data.levels || [];
    const finalLevels = [];

    for (const lvl of levels) {
        if (lvl?.procedural) {
            const generated = generateProceduralLevel(lvl);
            finalLevels.push(normalizeLevel(generated));
        } else {
            finalLevels.push(normalizeLevel(lvl));
        }
    }

    return finalLevels;
}

function loadLevels(url = 'levels.json') {
    // Always regenerate levels, don't cache
    return fetch(url).then(res => {
        if (!res.ok) throw new Error(`Failed to load levels from ${url}`);
        return res.json();
    }).then(data => {
        return normalizeLevelsData(data);
    });
}

function loadLevel(index = 0, url = 'levels.json') {
    return loadLevels(url).then(levels => {
        if (!levels.length) throw new Error('No levels found in levels.json');
        return levels[Math.min(index, levels.length - 1)];
    });
}

// expose globally for non-module scripts
window.loadLevels = loadLevels;
window.loadLevel = loadLevel;
window.generateProceduralLevel = generateProceduralLevel;
window.normalizeLevel = normalizeLevel;
