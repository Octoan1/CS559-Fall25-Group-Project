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
    
    // pressing 'n' teleports the marble into the hole (debug shortcut)
    window.addEventListener('keydown', (e) => {
        if (!(e.key && e.key.length === 1 && e.key.toLowerCase() === 'n')) return;
        try {
            if (!levelData || !levelData.goal) return;

            const goal = levelData.goal;
            const gx = goal.x;
            const gz = goal.z;
            const gy = (typeof goal.y === 'number') ? goal.y : 0.05;

            // Move marble mesh and physics position directly into the hole and slightly below platform
            const marble = gameObjects && gameObjects.getMarble && gameObjects.getMarble();
            if (marble) {
                // place ball at goal x/z and below platform so win condition triggers
                marble.position.set(gx, gy - 1.0, gz);
            }
            if (marblePhysics && marblePhysics.position) {
                marblePhysics.position.set(gx, gy - 1.0, gz);
                marblePhysics.velocity.set(0, -5, 0);
            }

            // Ensure animate loop notices movement immediately
            animate._started = true;
        } catch (err) {
            console.warn('Failed to teleport marble to hole', err);
        }
    });

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
    // Update DOM grid labels to follow camera/platform
    if (showGridCoords && gridLabelElements) updateGridLabels();
}

// Grid debugging
let gridHelper = null;
let showGridLines = false; // 'g' toggles grid lines
let showGridCoords = false; // 'h' toggles coordinate labels
let gridLabelOverlay = null;
let gridLabelElements = null; // array of {el, r, c}

function createGridLines() {
    if (gridHelper) return;
    // 20x20 grid, 21 lines each direction
    const size = 20;
    const divisions = 20;
    gridHelper = new THREE.GridHelper(size, divisions, 0x00ff00, 0x00ff00);
    gridHelper.position.y = 0.01; // Slightly above platform
    gameObjects.getPlatformGroup().add(gridHelper);
}

function removeGridLines() {
    if (gridHelper) {
        gameObjects.getPlatformGroup().remove(gridHelper);
        gridHelper = null;
    }
}

function createGridLabels() {
    // don't recreate if overlay exists
    if (gridLabelOverlay) return;

    // 20x20 defaults
    const size = 20;
    const divisions = 20;
    const rows = (Array.isArray(grid) && grid.length) ? grid.length : divisions;
    const cols = (Array.isArray(grid) && grid[0] && grid[0].length) ? grid[0].length : divisions;
    const cellSize = size / divisions;

    // create overlay container positioned over the renderer
    gridLabelElements = [];
    gridLabelOverlay = document.createElement('div');
    gridLabelOverlay.style.position = 'absolute';
    gridLabelOverlay.style.left = '0';
    gridLabelOverlay.style.top = '0';
    gridLabelOverlay.style.pointerEvents = 'none';
    gridLabelOverlay.style.width = '100%';
    gridLabelOverlay.style.height = '100%';
    gridLabelOverlay.className = 'grid-label-overlay';

    // Append overlay after the renderer element so it sits on top
    const rendererEl = sceneSetup && sceneSetup.renderer && sceneSetup.renderer.domElement;
    if (rendererEl && rendererEl.parentElement) {
        rendererEl.parentElement.style.position = rendererEl.parentElement.style.position || 'relative';
        rendererEl.parentElement.appendChild(gridLabelOverlay);
    } else {
        document.body.appendChild(gridLabelOverlay);
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // If we have a grid array, only label occupied cells to reduce clutter
            if (Array.isArray(grid) && grid.length) {
                if (!grid[r] || !grid[r][c]) continue;
            }

            const label = document.createElement('div');
            label.className = 'grid-cell-label';
            label.textContent = `[${c},${r}]`;
            Object.assign(label.style, {
                position: 'absolute',
                transform: 'translate(-50%, -50%)',
                padding: '1px 4px',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                fontSize: '12px',
                lineHeight: '12px',
                borderRadius: '3px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
            });

            gridLabelOverlay.appendChild(label);
            gridLabelElements.push({ el: label, r, c, cellSize, rows, cols });
        }
    }

    // initial positioning
    updateGridLabels();
}

function removeGridLabels() {
    if (gridLabelOverlay) {
        if (gridLabelOverlay.parentElement) gridLabelOverlay.parentElement.removeChild(gridLabelOverlay);
        gridLabelOverlay = null;
    }
    gridLabelElements = null;
}

function removeGrid() {
    if (gridHelper) {
        gameObjects.getPlatformGroup().remove(gridHelper);
        gridHelper = null;
    }
    if (gridLabelOverlay) {
        if (gridLabelOverlay.parentElement) gridLabelOverlay.parentElement.removeChild(gridLabelOverlay);
        gridLabelOverlay = null;
    }
    gridLabelElements = null;
}

function updateGridLabels() {
    if (!gridLabelElements || !gridLabelElements.length) return;
    const camera = sceneSetup && sceneSetup.camera;
    const rendererEl = sceneSetup && sceneSetup.renderer && sceneSetup.renderer.domElement;
    const platformGroup = gameObjects && gameObjects.getPlatformGroup && gameObjects.getPlatformGroup();
    if (!camera || !rendererEl || !platformGroup) return;

    const rect = rendererEl.getBoundingClientRect();

    // temp vector to avoid allocations in loop
    const vec = new THREE.Vector3();

    for (const item of gridLabelElements) {
        const { el, r, c, cellSize, rows, cols } = item;

        // compute cell center in platform-local coordinates
        const halfCols = cols / 2;
        const halfRows = rows / 2;
        const x = (c + 0.5 - halfCols) * cellSize;
        const z = (r + 0.5 - halfRows) * cellSize;
        vec.set(x, 0.1, z);

        // transform to world and project to NDC
        platformGroup.localToWorld(vec);
        vec.project(camera);

        // hide if behind camera
        if (vec.z < -1 || vec.z > 1) {
            el.style.display = 'none';
            continue;
        }

        const screenX = (vec.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-vec.y * 0.5 + 0.5) * rect.height + rect.top;

        el.style.display = '';
        el.style.left = `${Math.round(screenX)}px`;
        el.style.top = `${Math.round(screenY)}px`;
    }
}

window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (k === 'g') {
        showGridLines = !showGridLines;
        if (showGridLines) createGridLines(); else removeGridLines();
    }
    if (k === 'h') {
        showGridCoords = !showGridCoords;
        if (showGridCoords) createGridLabels(); else removeGridLabels();
    }
    if (k === 'r') {
        // Reset the game (same as clicking the reset button)
        resetGame();
    }
});

// Start the game when page loads
window.addEventListener('DOMContentLoaded', initializeGame);
