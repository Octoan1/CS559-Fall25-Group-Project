// Main game orchestration
let sceneSetup;
let gameObjects;
let gameState;
let marblePhysics;
let inputController;
let platformController;
let physicsEngine;
let gameLogic;
let ui;
let levelData;
let grid;

async function initializeGame() {
    // load level (falls back to default if fails)
    try {
        levelData = await loadLevel(0);
    } catch (err) {
        console.warn('Could not load levels.json, using defaults.', err);
        levelData = null;
    }

    // Initialize all game systems
    sceneSetup = new SceneSetup();
    gameObjects = new GameObjects(sceneSetup.scene, levelData);
    gameState = new GameState();
    marblePhysics = new MarblePhysics(levelData);
    inputController = new InputController();
    platformController = new PlatformController(gameState, inputController);
    physicsEngine = new PhysicsEngine();
    gameLogic = new GameLogic(levelData);
    ui = createUI();

    // grid is optionally provided by levelData (walls as grid cell coords)
    grid = null;
    if (levelData && Array.isArray(levelData.walls)) {
        // Determine grid size (rows x cols)
        const rows = levelData.gridRows || 20;
        const cols = levelData.gridCols || levelData.gridRows || 20;
        grid = new Array(rows);
        for (let r = 0; r < rows; r++) grid[r] = new Array(cols).fill(0);

        for (const w of levelData.walls) {
            if (!Array.isArray(w)) continue;
            // Accept [row, col] pairs. Ignore malformed entries.
            if (w.length >= 2 && Number.isFinite(w[0]) && Number.isFinite(w[1])) {
                const rr = Math.floor(w[0]);
                const cc = Math.floor(w[1]);
                if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
                    grid[rr][cc] = 1;
                }
            }
        }

        // Populate obstacles from the grid (visible meshes)
        const cellSize = 1;
        gameObjects.populateFromGrid(grid, { cellSize: cellSize, obstacleSize: { w: 1, d: 1, h: 0.5 }, visible: true });

        // Helper to map grid (row,col) -> world (x,z) using same logic as populateFromGrid
        const halfCols = (cols - 1) / 2;
        const halfRows = (rows - 1) / 2;
        const gridToWorld = (r, c) => {
            return { x: (c - halfCols) * cellSize, z: (r - halfRows) * cellSize };
        };

        // If start is provided as [row,col], convert to world coords and place marble
        if (Array.isArray(levelData.start) && levelData.start.length >= 2) {
            const sr = Math.floor(levelData.start[0]);
            const sc = Math.floor(levelData.start[1]);
            if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) {
                const pos = gridToWorld(sr, sc);
                const marbleY = 0.5; // marble radius -> sits on platform top
                levelData.start = { x: pos.x, y: marbleY, z: pos.z };
                // Update existing marble and physics state if already created
                if (gameObjects && gameObjects.getMarble()) {
                    gameObjects.getMarble().position.set(pos.x, marbleY, pos.z);
                }
                if (marblePhysics && marblePhysics.position) {
                    marblePhysics.position.set(pos.x, marbleY, pos.z);
                }
            }
        }

        // If goal is provided as [row,col], convert to world coords and place hole
        if (Array.isArray(levelData.goal) && levelData.goal.length >= 2) {
            const gr = Math.floor(levelData.goal[0]);
            const gc = Math.floor(levelData.goal[1]);
            if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
                const pos = gridToWorld(gr, gc);
                const goalY = 0.05; // hole top default
                const goalRadius = (levelData.goal && levelData.goal.radius) ? levelData.goal.radius : 0.8;
                levelData.goal = { x: pos.x, y: goalY, z: pos.z, radius: goalRadius };
                if (gameObjects && gameObjects.getHole()) {
                    gameObjects.getHole().position.set(pos.x, goalY, pos.z);
                }
            }
        }
    }

    // wire reset button
    const resetMarble = () => {
        resetGame();
    };
    ui.onReset(resetMarble);

    // Start game loop
    animate();
}

function resetGame() {
    gameState.reset();
    marblePhysics.reset();
    // reset marble position to level start if available
    const start = (levelData && levelData.start) ? levelData.start : { x: -8, y: 1.5, z: -8 };
    gameObjects.getMarble().position.set(start.x, start.y, start.z);
    gameObjects.getPlatformGroup().rotation.x = 0;
    gameObjects.getPlatformGroup().rotation.z = 0;
    if (ui && ui.setTimer) animate._startTime = performance.now();
    if (ui && ui.clearMessage) ui.clearMessage();
    gameLogic.updateUI(gameState);
}

let lastFrameTime = Date.now();

function animate() {
    requestAnimationFrame(animate);

    // Calculate delta time in seconds
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // simple timer/started detection (uses marblePhysics.velocity)
    if (!gameState.isWon) {
        // Update platform rotation
        platformController.update(deltaTime);
        platformController.applyRotationToPlatform(gameObjects.getPlatformGroup());

        // Update physics
        physicsEngine.update(
            marblePhysics,
            gameState,
            gameObjects.getObstacles(),
            gameObjects.getMarble(),
            deltaTime
        );

        // update UI timer if UI available
        if (ui) {
            if (!animate._started) {
                const v = marblePhysics.velocity || { length: () => 0 };
                if ((v.length && v.length() > 0.02) || Object.values(inputController.getKeys()).some(Boolean)) {
                    animate._started = true;
                    animate._startTime = performance.now();
                }
            }
            if (animate._started && !animate._finished) {
                const elapsed = (performance.now() - animate._startTime) / 1000;
                ui.setTimer(elapsed);
            }
        }

        // Check win condition using goal-based detection (prefer level goal)
        const marbleRadius = 0.5;
        if (levelData && levelData.goal) {
            const goal = levelData.goal;
            const dx = gameObjects.getMarble().position.x - goal.x;
            const dz = gameObjects.getMarble().position.z - goal.z;
            const goalRadius = goal.radius ?? 0.8;
            const d2 = dx*dx + dz*dz;
            if (d2 < (goalRadius + marbleRadius)*(goalRadius + marbleRadius)) {
                gameState.win();
                gameLogic.updateUI(gameState);
                if (ui) {
                    const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                    ui.setMessage(`Goal! Time: ${elapsed.toFixed(2)}s`);
                }
            }
        } else {
            // fallback to existing check
            if (gameLogic.checkWinCondition(marblePhysics)) {
                gameState.win();
                gameLogic.updateUI(gameState);
            }
        }
    }

    // Render scene
    sceneSetup.render(sceneSetup.scene, sceneSetup.camera);
}

// Grid debugging
let gridHelper = null;
let showGrid = false;

function createGrid() {
    if (gridHelper) return;
    // 20x20 grid, 21 lines each direction
    const size = 20;
    const divisions = 20;
    console.log(grid)
    gridHelper = new THREE.GridHelper(size, divisions, 0x00ff00, 0x00ff00);
    gridHelper.position.y = 0.01; // Slightly above platform
    gameObjects.getPlatformGroup().add(gridHelper);
}

function removeGrid() {
    if (gridHelper) {
        gameObjects.getPlatformGroup().remove(gridHelper);
        gridHelper = null;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g') {
        showGrid = !showGrid;
        if (showGrid) {
            createGrid();
        } else {
            removeGrid();
        }
    }
    if (e.key.toLowerCase() === 'r') {
        // Reset the game (same as clicking the reset button)
        resetGame();
    }
});

// Start the game when page loads
window.addEventListener('DOMContentLoaded', initializeGame);
