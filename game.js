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
    console.log(levelData);
    gameState.reset();
    marblePhysics.reset();
    // reset marble position to level start if available
    const start = (levelData && levelData.start) ? levelData.start : { x: -8, y: 1.5, z: -8 };
    gameObjects.getMarble().position.set(start.x, start.y, start.z);
    gameObjects.getPlatformGroup().rotation.x = 0;
    gameObjects.getPlatformGroup().rotation.z = 0;
    if (ui && ui.setTimer) animate._startTime = performance.now();
    if (ui && ui.clearMessage) ui.clearMessage();
    animate._started = false;
    animate._finished = false;
    gameLogic.updateUI(gameState);
}

async function startLevelTransition() {
    // Start the transition animation
    gameState.startTransition();
    
    // Disable platform controller during transition
    platformController.enabled = false;
    
    // Create a new level in the background
    try {
        window.__cachedLevels = null;
        const newLevelData = await loadLevel(0);
        
        // Create new platform group (will be positioned off-screen initially)
        const newPlatformGroup = new THREE.Group();
        sceneSetup.scene.add(newPlatformGroup);
        
        // Manually create game objects on the new platform without using constructor
        // This avoids adding to scene twice
        const newPlatformGeometry = new THREE.BoxGeometry(20, 1, 20);
        const newPlatformMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const newPlatform = new THREE.Mesh(newPlatformGeometry, newPlatformMaterial);
        newPlatform.castShadow = true;
        newPlatform.receiveShadow = true;
        newPlatform.position.y = -0.5;
        newPlatformGroup.add(newPlatform);
        
        // Create marble
        const marbleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const marbleMaterial = new THREE.MeshStandardMaterial({ color: 0xff6347, metalness: 0.6, roughness: 0.4 });
        const newMarble = new THREE.Mesh(marbleGeometry, marbleMaterial);
        newMarble.castShadow = true;
        newMarble.receiveShadow = true;
        newMarble.position.set(newLevelData.start.x, newLevelData.start.y, newLevelData.start.z);
        newPlatformGroup.add(newMarble);
        
        // Create hole
        const holeRadius = newLevelData.goal && newLevelData.goal.radius ? newLevelData.goal.radius : 0.8;
        const holeGeometry = new THREE.CylinderGeometry(holeRadius, holeRadius, 0.1, 32);
        const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const newHole = new THREE.Mesh(holeGeometry, holeMaterial);
        newHole.castShadow = true;
        newHole.receiveShadow = true;
        newHole.position.set(newLevelData.goal.x, newLevelData.goal.y ?? 0.05, newLevelData.goal.z);
        newPlatformGroup.add(newHole);
        
        // Create obstacles using the same logic as GameObjects.createObstacles()
        const rows = newLevelData.gridRows || 20;
        const cols = newLevelData.gridCols || 20;
        const cellSizeX = newLevelData.cellSizeX || (20 / cols);
        const cellSizeZ = newLevelData.cellSizeZ || (20 / rows);
        
        for (const w of newLevelData.walls) {
            const [col, row, wUnits = 1, dUnits = 1] = w;
            const x = (col + 0.5 - cols / 2) * cellSizeX;
            const z = (row + 0.5 - rows / 2) * cellSizeZ;
            const width = wUnits * cellSizeX;
            const depth = dUnits * cellSizeZ;
            
            const obstacleGeometry = new THREE.BoxGeometry(width, 0.5, depth);
            const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8 });
            const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
            obstacle.position.set(x, 0.25, z);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            newPlatformGroup.add(obstacle);
        }
        
        // Store obstacles for collision detection
        const newObstacles = [];
        for (const w of newLevelData.walls) {
            const [col, row, wUnits = 1, dUnits = 1] = w;
            const x = (col + 0.5 - cols / 2) * cellSizeX;
            const z = (row + 0.5 - rows / 2) * cellSizeZ;
            const width = wUnits * cellSizeX;
            const depth = dUnits * cellSizeZ;
            newObstacles.push({
                x: x,
                z: z,
                width: width,
                depth: depth,
                height: 0.5
            });
        }
        
        // Position new platform off-screen to the right
        newPlatformGroup.position.x = 60;
        
        // Store transition state
        window.__transitionState = {
            oldPlatformGroup: gameObjects.getPlatformGroup(),
            newPlatformGroup: newPlatformGroup,
            newMarble: newMarble,
            newHole: newHole,
            newLevelData: newLevelData,
            newObstacles: newObstacles,
            startTime: performance.now(),
            marbleStartPos: gameObjects.getMarble().position.clone(),
        };
        
    } catch (err) {
        console.error('Failed to prepare next level:', err);
    }
}

function updateLevelTransition(deltaTime) {
    if (!window.__transitionState) return;
    
    const progress = gameState.getTransitionProgress();
    const ts = window.__transitionState;
    const marble = gameObjects.getMarble();
    const gravity = 9.8;
    
    // Phase 1 (0 to 0.5): Ball stays still, waiting for new platform
    if (progress <= 0.5) {
        // Ball doesn't move yet
        marble.position.copy(ts.marbleStartPos);
        // Platforms don't move yet
    }
    // Phase 2 (0.5 to 1.0): Platforms move, then ball falls
    else {
        const platformProgress = (progress - 0.5) * 2; // 0 to 1 over second half
        
        // Old platform slides from center (0) to the left (-60)
        ts.oldPlatformGroup.position.x = -platformProgress * 60;
        
        // New platform slides from right (60) to center (0)
        ts.newPlatformGroup.position.x = 60 - platformProgress * 60;
        
        // Ball falls after platforms start moving
        const fallProgress = platformProgress; // 0 to 1 over second half
        const fallDistance = 0.5 * gravity * fallProgress * fallProgress * (gameState.transitionDuration * 0.5) * (gameState.transitionDuration * 0.5);
        marble.position.y = ts.marbleStartPos.y - fallDistance;
    }
    
    // When transition is complete
    if (gameState.isTransitionComplete()) {
        completeTransition();
    }
}

function completeTransition() {
    if (!window.__transitionState) return;
    
    const ts = window.__transitionState;
    
    // Remove old platform group from scene
    sceneSetup.scene.remove(ts.oldPlatformGroup);
    
    // Replace current gameObjects with new ones
    gameObjects.platformGroup = ts.newPlatformGroup;
    levelData = ts.newLevelData;
    gameObjects.level = ts.newLevelData;
    gameObjects.marble = ts.newMarble;
    gameObjects.hole = ts.newHole;
    gameObjects.obstacles = ts.newObstacles; // Use the stored obstacles
    
    // Reset new platform position to center
    ts.newPlatformGroup.position.y = 0;
    
    // Reset physics state
    marblePhysics.position.copy(ts.newMarble.position);
    marblePhysics.velocity.set(0, 0, 0);
    marblePhysics.level = ts.newLevelData;
    
    // Reset platform rotation
    ts.newPlatformGroup.rotation.x = 0;
    ts.newPlatformGroup.rotation.z = 0;
    
    // Reset game state for new level
    gameState.reset();
    platformController.enabled = true;
    
    // Reset animation flags
    animate._started = false;
    animate._finished = false;
    animate._startTime = performance.now();
    
    if (ui && ui.clearMessage) ui.clearMessage();
    
    // Clear transition state
    window.__transitionState = null;
}

async function loadNextLevel() {
    try {
        // Clear cached levels to force regeneration
        window.__cachedLevels = null;
        
        // Generate new level
        levelData = await loadLevel(0);
        
        // Clear existing obstacles from scene
        const obstacles = gameObjects.getObstacles();
        for (const obs of obstacles) {
            if (obs.mesh) {
                gameObjects.getPlatformGroup().remove(obs.mesh);
            }
        }
        
        // Recreate game objects with new level
        const oldMarble = gameObjects.getMarble();
        const oldHole = gameObjects.getHole();
        gameObjects.getPlatformGroup().remove(oldMarble);
        gameObjects.getPlatformGroup().remove(oldHole);
        
        gameObjects.level = levelData;
        gameObjects.marble = gameObjects.createMarble();
        gameObjects.hole = gameObjects.createHole();
        gameObjects.obstacles = [];
        gameObjects.createObstacles();
        
        // Reset physics
        marblePhysics.position.set(levelData.start.x, levelData.start.y, levelData.start.z);
        marblePhysics.velocity.set(0, 0, 0);
        marblePhysics.level = levelData;
        
        // Reset game state
        gameState.reset();
        gameObjects.getPlatformGroup().rotation.x = 0;
        gameObjects.getPlatformGroup().rotation.z = 0;
        console.log(levelData);
        // Reset animation flags
        animate._started = false;
        animate._finished = false;
        animate._startTime = performance.now();
        
        if (ui && ui.clearMessage) ui.clearMessage();
        
    } catch (err) {
        console.error('Failed to load next level:', err);
    }
}

let lastFrameTime = Date.now();

function animate() {
    requestAnimationFrame(animate);

    // Calculate delta time in seconds
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // Handle level transition animation if active
    if (gameState.isTransitioning) {
        gameState.updateTransition(deltaTime);
        updateLevelTransition(deltaTime);
    }

    // simple timer/started detection (uses marblePhysics.velocity)
    if (!gameState.isWon && !gameState.isTransitioning) {
        // Update platform rotation
        platformController.update(deltaTime);
        platformController.applyRotationToPlatform(gameObjects.getPlatformGroup());

        // Update physics
        physicsEngine.update(
            marblePhysics,
            gameState,
            gameObjects.getObstacles(),
            gameObjects.getMarble(),
            deltaTime,
            levelData && levelData.goal ? levelData.goal : null,
            levelData && levelData.goal ? levelData.goal.radius ?? 0.8 : 0.8
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

        // Check win condition - ball must fall through the hole
        const marbleRadius = 0.5;
        if (levelData && levelData.goal) {
            const goal = levelData.goal;
            const dx = gameObjects.getMarble().position.x - goal.x;
            const dz = gameObjects.getMarble().position.z - goal.z;
            const goalRadius = goal.radius ?? 0.8;
            const d2 = dx*dx + dz*dz;
            const marbleY = gameObjects.getMarble().position.y;
            
            // Win when ball is over hole AND has fallen below platform (y < -0.5)
            if (!animate._finished && d2 < (goalRadius * goalRadius) && marbleY < -0.5) {
                animate._finished = true;
                gameState.win();
                gameLogic.updateUI(gameState);
                
                // Remove marble from scene
                gameObjects.getPlatformGroup().remove(gameObjects.getMarble());
                
                if (ui) {
                    const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                    ui.setMessage(`Goal! Time: ${elapsed.toFixed(2)}s`);
                }
                // Start level transition animation
                startLevelTransition();
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
