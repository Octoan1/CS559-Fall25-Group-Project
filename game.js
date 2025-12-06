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
    gridHelper = new THREE.GridHelper(size, divisions, 0x00ff00, 0x00ff00);
    gridHelper.position.y = 0.51; // Slightly above platform
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
});

// Start the game when page loads
window.addEventListener('DOMContentLoaded', initializeGame);
