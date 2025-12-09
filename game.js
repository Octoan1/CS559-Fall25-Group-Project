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
let levels = [];
let currentLevelIndex = 0;

async function initializeGame() {
    // Initialize scene and UI first
    sceneSetup = new SceneSetup();
    ui = createUI();

    // Load all levels (procedural or static)
    try {
        levels = await loadLevels();
    } catch (err) {
        console.warn('Could not load levels.json, using defaults.', err);
        levels = [];
    }

    // Populate level selector UI
    const levelNames = levels.map((l, i) => l.name || `Level ${i}`);
    if (ui.setLevelOptions) ui.setLevelOptions(levelNames);
    if (ui.onLevelChange) ui.onLevelChange((idx) => switchLevel(idx));

    // Create common systems
    gameState = new GameState();
    marblePhysics = new MarblePhysics();
    inputController = new InputController();
    platformController = new PlatformController(gameState, inputController);
    physicsEngine = new PhysicsEngine();

    // Create initial level
    currentLevelIndex = 0;
    if (ui.setSelectedLevel) ui.setSelectedLevel(currentLevelIndex);
    await switchLevel(currentLevelIndex);

    // wire reset button
    const resetMarble = () => resetGame();
    ui.onReset(resetMarble);

    // Start game loop
    animate();
}

async function switchLevel(index) {
    if (!levels || index < 0 || index >= levels.length) return;
    currentLevelIndex = index;
    levelData = levels[index];

    // Remove previous gameObjects from scene (if any)
    try {
        if (gameObjects && gameObjects.getPlatformGroup) {
            sceneSetup.scene.remove(gameObjects.getPlatformGroup());
        }
    } catch (e) {
        // ignore
    }

    // Create new game objects for this level
    gameObjects = new GameObjects(sceneSetup.scene, levelData);
    gameLogic = new GameLogic(levelData);

    // Reset game state and marble physics to level start
    gameState.reset();
    if (Array.isArray(levelData.start) && levelData.start.length >= 2) {
        // grid coords handled in level normalizer; keep as-is
    }
    const start = (levelData && levelData.start) ? levelData.start : { x: -8, y: 1.5, z: -8 };
    marblePhysics.position.set(start.x, start.y, start.z);
    marblePhysics.velocity.set(0,0,0);

    // If the level contains a grid of walls, populate visible obstacles
    if (levelData && Array.isArray(levelData.walls) && levelData.walls.length) {
        const rows = levelData.gridRows || 20;
        const cols = levelData.gridCols || (levelData.gridRows || 20);
        const gridArr = new Array(rows);
        for (let r = 0; r < rows; r++) gridArr[r] = new Array(cols).fill(0);
        for (const w of levelData.walls) {
            if (!Array.isArray(w)) continue;
            const col = Math.floor(w[0]);
            const row = Math.floor(w[1]);
            if (row >= 0 && row < rows && col >= 0 && col < cols) gridArr[row][col] = 1;
        }
        // cellSize chosen to match GameObjects.createObstacles mapping (20 / cols etc.)
        const cellSize = 1; // matches populateFromGrid mapping used elsewhere
        gameObjects.populateFromGrid(gridArr, { cellSize: cellSize, obstacleSize: { w: 1, d: 1, h: 0.5 }, visible: true });
    }

    // Update UI selection
    if (ui.setSelectedLevel) ui.setSelectedLevel(index);

    // Clear UI timer/message
    if (ui.setTimer) ui.setTimer(0);
    if (ui.clearMessage) ui.clearMessage();
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
