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
// persist the dark mode state so it survives level switches
let darkMode = false;
// persist the prototype mode (low-detail) state
let prototypeMode = false;
// track game mode: 'endless' or 'level'
let gameMode = 'level';

// Helper to set the default status text and color
function setDefaultStatusMessage() {
    if (!ui || !ui.setMessage) return;
    ui.setMessage('Get the ball in the hole!');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.color = 'white';
}

// Race mode state
let raceTimeRemaining = 0;
let raceScore = 0;
let raceHighScore = 0;
let raceLevelStartTime = 0; // Track when the current level started for bonus calculation
// Pause state (pauses timer when settings open)
let isPaused = false;
let pauseStartedTime = 0; // Track the exact time pause began

// Endless mode best time (fastest level clear)
let endlessBestTime = Infinity;

// Flash the bonus overlay briefly
function showBonusOverlay(bonusAmount = 5) {
    const overlay = document.getElementById('bonusOverlay');
    if (!overlay) return;
    const content = overlay.querySelector('.bonus-content');
    const text = overlay.querySelector('.bonus-text');
    if (text) {
        if (bonusAmount === 10) {
            text.textContent = '+10 BONUS';
        } else {
            text.textContent = `+${bonusAmount}`;
        }
    }
    overlay.classList.remove('hidden');
    if (content) content.style.animation = 'flashBonus 1500ms ease-out';
    setTimeout(() => {
        overlay.classList.add('hidden');
        if (content) content.style.animation = '';
    }, 1500);
}

async function initializeGame() {
    // Preload shaders first
    await GameObjects.preloadShaders();
    
    // Initialize scene and UI first
    sceneSetup = new SceneSetup();
    ui = createUI();

    // Load persisted race high score
    try {
        const saved = Number(localStorage.getItem('raceHighScore') || 0);
        raceHighScore = isNaN(saved) ? 0 : saved;
    } catch (e) { raceHighScore = 0; }

    // Load persisted endless fastest time
    try {
        const eb = Number(localStorage.getItem('endlessBestTime'));
        endlessBestTime = isFinite(eb) && eb > 0 ? eb : Infinity;
    } catch (e) { endlessBestTime = Infinity; }

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

    // Create common systems
    gameState = new GameState();
    marblePhysics = new MarblePhysics();
    inputController = new InputController();
    platformController = new PlatformController(gameState, inputController);
    physicsEngine = new PhysicsEngine();

    // Handle endless mode button
    ui.onEndlessMode(async () => {
        gameMode = 'endless';
        // Show fastest line for endless mode
        if (ui.setFastestVisible) ui.setFastestVisible(true);
        if (ui.setFastestTime) ui.setFastestTime(isFinite(endlessBestTime) ? endlessBestTime : null);
        // Generate a new procedural level for endless mode
        const rawLevel = generateProceduralLevel({
            gridRows: 20,
            gridCols: 20,
            minObstacles: 10,
            maxObstacles: 20,
            retries: 500
        });
        const endlessLevel = normalizeLevel(rawLevel);
        
        // Remove previous gameObjects from scene (if any)
        try {
            if (gameObjects && gameObjects.getPlatformGroup) {
                sceneSetup.scene.remove(gameObjects.getPlatformGroup());
            }
        } catch (e) {
            // ignore
        }
        
        // Create new game objects for endless mode
        levelData = endlessLevel;
        gameObjects = new GameObjects(sceneSetup.scene, endlessLevel, darkMode);
        if (gameObjects && typeof gameObjects.setDarkMode === 'function') {
            gameObjects.setDarkMode(darkMode);
            if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
        }
        gameLogic = new GameLogic(endlessLevel);
        
        // Reset game state and marble physics
        gameState.reset();
        marblePhysics.position.set(endlessLevel.start.x, endlessLevel.start.y, endlessLevel.start.z);
        marblePhysics.velocity.set(0, 0, 0);
        marblePhysics.level = endlessLevel;
        setDefaultStatusMessage();
        
        // Reset animation flags
        animate._started = false;
        animate._finished = false;
        animate._startTime = performance.now();
        
        platformController.enabled = true;
        
        // Clear UI
        if (ui.setTimer) ui.setTimer(0);
        setDefaultStatusMessage();
    });

    // Handle race mode button
    ui.onRaceMode(async () => { initRaceMode(); });

    // Helper to start (or restart) race mode
    function initRaceMode() {
        gameMode = 'race';
        // Hide fastest line outside endless mode
        if (ui.setFastestVisible) ui.setFastestVisible(false);
        const rawLevel = generateProceduralLevel({
            gridRows: 20,
            gridCols: 20,
            minObstacles: 10,
            maxObstacles: 20,
            retries: 500
        });
        const raceLevel = normalizeLevel(rawLevel);
        try {
            if (gameObjects && gameObjects.getPlatformGroup) {
                sceneSetup.scene.remove(gameObjects.getPlatformGroup());
            }
        } catch (e) {}
        levelData = raceLevel;
        gameObjects = new GameObjects(sceneSetup.scene, raceLevel, darkMode);
        if (gameObjects && typeof gameObjects.setDarkMode === 'function') {
            gameObjects.setDarkMode(darkMode);
            if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
        }
        gameLogic = new GameLogic(raceLevel);
        raceTimeRemaining = 20.0;
        raceScore = 0;
        gameState.reset();
        marblePhysics.position.set(raceLevel.start.x, raceLevel.start.y, raceLevel.start.z);
        marblePhysics.velocity.set(0, 0, 0);
        marblePhysics.level = raceLevel;
        animate._started = true;
        animate._finished = false;
        animate._startTime = performance.now();
        raceLevelStartTime = performance.now();
        platformController.enabled = true;
        if (ui.setTimer) ui.setTimer(raceTimeRemaining);
        setDefaultStatusMessage();
    }
    // Expose for external calls
    window.__initRaceMode = initRaceMode;

    // Handle level mode selection
    ui.onLevelMode(async (levelIndex) => {
        gameMode = 'level';
        // Hide fastest line outside endless mode
        if (ui.setFastestVisible) ui.setFastestVisible(false);
        currentLevelIndex = levelIndex;
        await switchLevel(currentLevelIndex);
        platformController.enabled = true;
    });

    // Handle menu button
    ui.onMenu(() => {
        platformController.enabled = false;
        // Hide fastest line outside endless mode
        if (ui.setFastestVisible) ui.setFastestVisible(false);
        gameState.reset();
        try {
            if (gameObjects && gameObjects.getPlatformGroup && sceneSetup && sceneSetup.scene) {
                sceneSetup.scene.remove(gameObjects.getPlatformGroup());
            }
        } catch (e) {
            // ignore
        }
    });

    // wire reset button
    const resetMarble = () => resetGame();
    ui.onReset(resetMarble);

    // Wire pause/resume for settings menu
    if (ui.onSettingsOpen) {
        ui.onSettingsOpen(() => {
            isPaused = true;
            pauseStartedTime = performance.now();
        });
    }
    if (ui.onSettingsClose) {
        ui.onSettingsClose(() => {
            // Adjust start time to account for paused duration
            if (pauseStartedTime && !gameState.isWon) {
                const pausedDuration = performance.now() - pauseStartedTime;
                if (animate._startTime) animate._startTime += pausedDuration;
            }
            isPaused = false;
        });
    }

    // wire dark mode checkbox
    if (ui.onDarkModeToggle) ui.onDarkModeToggle((enabled) => {
        darkMode = Boolean(enabled);
        if (sceneSetup && typeof sceneSetup.setDarkMode === 'function') sceneSetup.setDarkMode(darkMode);
        if (gameObjects && typeof gameObjects.setDarkMode === 'function') gameObjects.setDarkMode(darkMode);
        // also update any platform being prepared during a transition
        if (window.__transitionState) {
            const ts = window.__transitionState;
            try {
                if (ts.newPlatform) {
                    const pMat = ts.newPlatform.material || new THREE.MeshStandardMaterial();
                    pMat.color = new THREE.Color(darkMode ? 0x3a3f44 : 0x8b4513);
                    pMat.needsUpdate = true;
                    ts.newPlatform.material = pMat;
                }
                if (ts.newMarble) {
                    const mMat = ts.newMarble.material || new THREE.MeshStandardMaterial();
                    mMat.color = new THREE.Color(darkMode ? 0x00aaff : 0xff6347);
                    mMat.needsUpdate = true;
                    ts.newMarble.material = mMat;
                }
                if (ts.newObstacles && Array.isArray(ts.newObstacles)) {
                    for (const o of ts.newObstacles) {
                        if (!o.mesh) continue;
                        GameObjects.applyObstacleMaterial(o.mesh, darkMode, gameObjects ? gameObjects.woodTexture : null, gameObjects ? gameObjects.stoneTexture : null);
                    }
                }
            } catch (e) {
                // ignore any errors during transition update
            }
        }
    });
    // wire prototype mode checkbox (low-detail/prototype)
    if (ui.onPrototypeToggle) ui.onPrototypeToggle((enabled) => {
        prototypeMode = Boolean(enabled);
        if (sceneSetup && typeof sceneSetup.setPrototypeMode === 'function') sceneSetup.setPrototypeMode(prototypeMode);
        if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
        // also update any platform being prepared during a transition
        if (window.__transitionState) {
            const ts = window.__transitionState;
            try {
                if (ts.newPlatform) {
                    if (prototypeMode) {
                        ts.newPlatform.material = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
                        ts.newPlatform.castShadow = false;
                        ts.newPlatform.receiveShadow = false;
                    } else {
                        const pMat = ts.newPlatform.material || new THREE.MeshStandardMaterial();
                        pMat.color = new THREE.Color(darkMode ? 0x3a3f44 : 0x8b4513);
                        ts.newPlatform.material = pMat;
                        ts.newPlatform.castShadow = true;
                        ts.newPlatform.receiveShadow = true;
                    }
                }
                if (ts.newMarble) {
                    if (prototypeMode) {
                        ts.newMarble.material = new THREE.MeshBasicMaterial({ color: darkMode ? 0x00aaff : 0xff6347 });
                        ts.newMarble.castShadow = false;
                        ts.newMarble.receiveShadow = false;
                    } else {
                        const mMat = ts.newMarble.material || new THREE.MeshStandardMaterial();
                        mMat.color = new THREE.Color(darkMode ? 0x00aaff : 0xff6347);
                        ts.newMarble.material = mMat;
                        ts.newMarble.castShadow = true;
                        ts.newMarble.receiveShadow = true;
                    }
                }
                if (ts.newObstacles && Array.isArray(ts.newObstacles)) {
                    for (const o of ts.newObstacles) {
                        if (!o.mesh) continue;
                        if (prototypeMode) {
                            o.mesh.material = new THREE.MeshBasicMaterial({ color: darkMode ? 0x555566 : 0x808080 });
                            o.mesh.castShadow = false;
                            o.mesh.receiveShadow = false;
                        } else {
                            GameObjects.applyObstacleMaterial(o.mesh, darkMode, gameObjects ? gameObjects.woodTexture : null, gameObjects ? gameObjects.stoneTexture : null);
                            o.mesh.castShadow = true;
                            o.mesh.receiveShadow = true;
                        }
                    }
                }
            } catch (e) {
                // ignore any errors during transition update
            }
        }
    });
    // Apply current prototype setting after obstacles are created
    if (typeof prototypeMode !== 'undefined' && gameObjects && typeof gameObjects.setPrototypeMode === 'function') {
        gameObjects.setPrototypeMode(prototypeMode);
    }
    // default prototype off
    if (ui.setPrototypeMode) ui.setPrototypeMode(false);
        // Apply current dark-mode setting after obstacles are created
        if (typeof darkMode !== 'undefined' && gameObjects && typeof gameObjects.setDarkMode === 'function') {
            gameObjects.setDarkMode(darkMode);
            if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
        }
    // default to light mode (darkMode off)
    if (ui.setDarkMode) ui.setDarkMode(false);
    if (sceneSetup && typeof sceneSetup.setDarkMode === 'function') sceneSetup.setDarkMode(false);
    
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
    gameObjects = new GameObjects(sceneSetup.scene, levelData, darkMode);
    if (gameObjects && typeof gameObjects.setDarkMode === 'function') {
        gameObjects.setDarkMode(darkMode);
        if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
    }
    gameLogic = new GameLogic(levelData);

    // Reset game state and marble physics to level start
    gameState.reset();
    if (Array.isArray(levelData.start) && levelData.start.length >= 2) {
        // grid coords handled in level normalizer; keep as-is
    }
    const start = (levelData && levelData.start) ? levelData.start : { x: -8, y: 1.5, z: -8 };
    marblePhysics.position.set(start.x, start.y, start.z);
    marblePhysics.velocity.set(0,0,0);
        if (ui && ui.clearMessage) ui.clearMessage();
        setDefaultStatusMessage();

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

    // Clear UI timer/message and reset animation state
    if (ui.setTimer) ui.setTimer(0);
    animate._started = false;
    animate._finished = false;
    animate._startTime = performance.now();
    setDefaultStatusMessage();
}

function resetGame() {
    console.log(levelData);
    gameState.reset();
    // Ensure marblePhysics knows the current level so reset uses the level start
    if (marblePhysics) {
        marblePhysics.level = levelData || null;
        // reset physics state
        marblePhysics.reset();
    }
    // reset marble position to level start if available
    const start = (levelData && levelData.start) ? levelData.start : { x: -8, y: 1.5, z: -8 };
    // Update both the visual marble mesh and the physics position so they stay in sync
    if (gameObjects && gameObjects.getMarble) gameObjects.getMarble().position.set(start.x, start.y, start.z);
    if (marblePhysics && marblePhysics.position) marblePhysics.position.set(start.x, start.y, start.z);
    if (marblePhysics && marblePhysics.velocity) marblePhysics.velocity.set(0, 0, 0);
    gameObjects.getPlatformGroup().rotation.x = 0;
    gameObjects.getPlatformGroup().rotation.z = 0;
    if (ui && ui.setTimer) animate._startTime = performance.now();
    setDefaultStatusMessage();
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
        // Generate a new procedural level for endless mode
        const rawLevel = generateProceduralLevel({
            gridRows: 20,
            gridCols: 20,
            minObstacles: 10,
            maxObstacles: 20,
            retries: 500
        });
        // Normalize to convert grid coordinates to world coordinates
        const newLevelData = normalizeLevel(rawLevel);
        
        // Create new platform group (will be positioned off-screen initially)
        const newPlatformGroup = new THREE.Group();
        sceneSetup.scene.add(newPlatformGroup);
        
        // Manually create game objects on the new platform without using constructor
        // This avoids adding to scene twice
        const newPlatformGeometry = new THREE.BoxGeometry(20, 1, 20);
        const newPlatformMaterial = new THREE.MeshStandardMaterial({ color: darkMode ? 0x3a3f44 : 0x8b4513, roughness: 0.7 });
        
        // Apply appropriate texture based on dark mode
        if (darkMode && gameObjects.stoneTexture) {
            newPlatformMaterial.map = gameObjects.stoneTexture;
        } else if (!darkMode && gameObjects.woodTexture) {
            newPlatformMaterial.map = gameObjects.woodTexture;
        }
        
        const newPlatform = new THREE.Mesh(newPlatformGeometry, newPlatformMaterial);
        newPlatform.castShadow = true;
        newPlatform.receiveShadow = true;
        newPlatform.position.y = -0.5;
        newPlatformGroup.add(newPlatform);
        
        // Create marble with shader material
        const marbleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const newMarbleUniforms = {
            time: { value: 0.0 },
            baseColor: { value: new THREE.Color(darkMode ? 0x00aaff : 0xff6347) }
        };
        
        let marbleMaterial;
        if (GameObjects.shadersLoaded && GameObjects.marbleVertexShader && GameObjects.marbleFragmentShader) {
            marbleMaterial = new THREE.ShaderMaterial({
                uniforms: newMarbleUniforms,
                vertexShader: GameObjects.marbleVertexShader,
                fragmentShader: GameObjects.marbleFragmentShader,
                lights: false
            });
        } else {
            marbleMaterial = new THREE.MeshStandardMaterial({ color: darkMode ? 0x00aaff : 0xff6347, metalness: 0.6, roughness: 0.4 });
        }
        
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
        
        const newObstacles = [];
        for (const w of newLevelData.walls) {
            const [col, row, wUnits = 1, dUnits = 1] = w;
            const x = (col + 0.5 - cols / 2) * cellSizeX;
            const z = (row + 0.5 - rows / 2) * cellSizeZ;
            const width = wUnits * cellSizeX;
            const depth = dUnits * cellSizeZ;
            // Use a deterministic seed based on position to ensure consistent stump sizes
            const seed = col * 73856093 ^ row * 19349663;
            const obstacle = GameObjects.createObstacleMesh({
                width,
                depth,
                height: 0.5,
                darkMode,
                woodTexture: gameObjects ? gameObjects.woodTexture : null,
                stoneTexture: gameObjects ? gameObjects.stoneTexture : null,
                seed: seed,
            });
            const visualHeight = obstacle.userData.visualHeight ?? 0.5;
            obstacle.position.set(x, visualHeight / 2, z);
            newPlatformGroup.add(obstacle);
            newObstacles.push({ mesh: obstacle, x: x, z: z, width: width, depth: depth, height: visualHeight });
        }
        
        
        // Position new platform off-screen to the right
        newPlatformGroup.position.x = 60;
        
        // Store transition state
        window.__transitionState = {
            oldPlatformGroup: gameObjects.getPlatformGroup(),
            newPlatformGroup: newPlatformGroup,
            newPlatform: newPlatform,
            newMarble: newMarble,
            newMarbleUniforms: newMarbleUniforms,
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
    
    // Use the marble that already has the shader material
    gameObjects.marble = ts.newMarble;
    gameObjects.marbleUniforms = ts.newMarbleUniforms; // Store the uniforms for dark mode switching
    
    gameObjects.hole = ts.newHole;
    gameObjects.obstacles = ts.newObstacles; // Use the stored obstacles

    // Ensure platform mesh reference is set so visuals can be applied
    if (ts.newPlatform) {
        gameObjects.platformMesh = ts.newPlatform;
    }

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
    
    // Reset race level timer for next level (only in race mode)
    if (gameMode === 'race') {
        raceLevelStartTime = performance.now();
    }
    
    setDefaultStatusMessage();
    
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
        // Apply dark mode to new objects
        if (typeof darkMode !== 'undefined' && gameObjects && typeof gameObjects.setDarkMode === 'function') {
            gameObjects.setDarkMode(darkMode);
            if (gameObjects && typeof gameObjects.setPrototypeMode === 'function') gameObjects.setPrototypeMode(prototypeMode);
        }
        
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
        
        setDefaultStatusMessage();
        
    } catch (err) {
        console.error('Failed to load next level:', err);
    }
}

let lastFrameTime = Date.now();
// When marble enters the hole area, require it to stay below for a few frames
let holeBelowCounter = 0;
const HOLE_BELOW_REQUIRED_FRAMES = 6;

function animate() {
    requestAnimationFrame(animate);

    // Calculate delta time in seconds
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // Race mode countdown (pause during transitions and when paused)
    if (gameMode === 'race' && !gameState.isTransitioning && !isPaused) {
        const prev = raceTimeRemaining;
        raceTimeRemaining = Math.max(0, raceTimeRemaining - deltaTime);
        if (ui && ui.setTimer) ui.setTimer(raceTimeRemaining);
        // Handle time expiry when not transitioning
        if (prev > 0 && raceTimeRemaining === 0 && !gameState.isWon) {
            // Race over -> stop the ball and show results overlay
            platformController.enabled = false;
            if (marblePhysics) {
                marblePhysics.velocity.set(0, 0, 0);
            }
            try { if (gameObjects && gameObjects.getMarble) gameObjects.getPlatformGroup().remove(gameObjects.getMarble()); } catch (e) {}
            showRaceResults();
        }
    }

    // Handle level transition animation if active
    if (gameState.isTransitioning) {
        gameState.updateTransition(deltaTime);
        updateLevelTransition(deltaTime);
    }

    // simple timer/started detection (uses marblePhysics.velocity)
    if (!gameState.isWon && !gameState.isTransitioning && gameObjects) {
        // Update platform rotation
        platformController.update(deltaTime);
        platformController.applyRotationToPlatform(gameObjects.getPlatformGroup());

        // Convert goal world coordinates back to grid coordinates
        let holeGridCell = null;
        if (levelData && levelData.goal) {
            const cols = levelData.gridCols || 20;
            const rows = levelData.gridRows || 20;
            const cellSizeX = levelData.cellSizeX || (20 / cols);
            const cellSizeZ = levelData.cellSizeZ || (20 / rows);
            // Reverse: x = (col + 0.5 - cols/2) * cellSize
            // So: col = x/cellSize + cols/2 - 0.5
            const col = Math.round(levelData.goal.x / cellSizeX + cols / 2 - 0.5);
            const row = Math.round(levelData.goal.z / cellSizeZ + rows / 2 - 0.5);
            holeGridCell = [col, row];
        }

        // Update physics
        physicsEngine.update(
            marblePhysics,
            gameState,
            gameObjects.getObstacles(),
            gameObjects.getMarble(),
            deltaTime,
            levelData && levelData.goal ? levelData.goal : null,
            levelData && levelData.goal ? levelData.goal.radius ?? 0.8 : 0.8,
            holeGridCell
        );

        // update UI timer if UI available (skip for race mode which uses countdown, skip if paused)
        if (ui && gameMode !== 'race' && !isPaused) {
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
        // In race mode, prevent winning after time has expired
        const marbleRadius = 0.5;
        const canWin = gameMode !== 'race' || raceTimeRemaining > 0;
        if (canWin && levelData && levelData.goal) {
            const goal = levelData.goal;
            const dx = gameObjects.getMarble().position.x - goal.x;
            const dz = gameObjects.getMarble().position.z - goal.z;
            const goalRadius = goal.radius ?? 0.8;
            const d2 = dx*dx + dz*dz;
            const marbleY = gameObjects.getMarble().position.y;
            const platformTop = 0.0;
            const committed75 = Boolean(marblePhysics && marblePhysics.fallCommitted);
            
                // Win when ball is over hole AND has fallen below platform for several frames
                if (!animate._finished && d2 < (goalRadius * goalRadius)) {
                    if (marbleY < -0.5) {
                        // increment counter when marble remains below platform while over the hole
                        holeBelowCounter++;
                    } else {
                        holeBelowCounter = 0;
                    }

                    // require a small number of frames below the platform AND that the marble isn't moving strongly upward
                    const velY = (marblePhysics && marblePhysics.velocity) ? marblePhysics.velocity.y : 0;
                    if (holeBelowCounter >= HOLE_BELOW_REQUIRED_FRAMES && velY < 0.5) {
                        animate._finished = true;
                        gameState.win();
                        gameLogic.updateUI(gameState);

                        // Remove marble from scene
                        gameObjects.getPlatformGroup().remove(gameObjects.getMarble());

                        if (ui) {
                            const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                            ui.setMessage(`Goal! Time: ${elapsed.toFixed(2)}s`);
                        }
                        
                        // Handle level completion based on game mode
                        if (gameMode === 'endless') {
                            // In endless mode, record fastest time and transition to next level
                            const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                            if (!isFinite(endlessBestTime) || elapsed < endlessBestTime) {
                                endlessBestTime = elapsed;
                                try { localStorage.setItem('endlessBestTime', String(endlessBestTime)); } catch (e) {}
                                if (ui.setFastestTime) ui.setFastestTime(endlessBestTime);
                                if (ui.pulseFastest) ui.pulseFastest();
                            }
                            startLevelTransition();
                        } else if (gameMode === 'race') {
                            // In race mode, award +10 if beaten in under 6 seconds
                            const levelTime = (performance.now() - raceLevelStartTime) / 1000;
                            let bonusTime = 5.0;
                            let bonusAmount = 5;
                            if (levelTime <= 6.0) {
                                bonusTime = 10.0;
                                bonusAmount = 10;
                            }
                            raceTimeRemaining += bonusTime;
                            raceScore += 1;
                            showBonusOverlay(bonusAmount);
                            startLevelTransition();
                        } else {
                            // In level mode, return to level select after a delay
                            setTimeout(() => {
                                platformController.enabled = false;
                                if (ui && ui.showLevelSelect) {
                                    ui.showLevelSelect();
                                } else if (ui && ui.showMainMenu) {
                                    ui.showMainMenu();
                                }
                            }, 2000);
                        }
                    }
                } else {
                    // If we've committed (90% in) and have fallen past the platform, count as a win.
                    if (!animate._finished && committed75 && marbleY < (platformTop + 0.1)) {
                        animate._finished = true;
                        gameState.win();
                        gameLogic.updateUI(gameState);

                        // Remove marble from scene
                        try { gameObjects.getPlatformGroup().remove(gameObjects.getMarble()); } catch (e) {}

                        if (ui) {
                            const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                            ui.setMessage(`Goal! Time: ${elapsed.toFixed(2)}s`);
                        }

                        // Handle level completion based on game mode
                        if (gameMode === 'endless') {
                            const elapsed = (performance.now() - (animate._startTime || performance.now()))/1000;
                            if (!isFinite(endlessBestTime) || elapsed < endlessBestTime) {
                                endlessBestTime = elapsed;
                                try { localStorage.setItem('endlessBestTime', String(endlessBestTime)); } catch (e) {}
                                if (ui.setFastestTime) ui.setFastestTime(endlessBestTime);
                                if (ui.pulseFastest) ui.pulseFastest();
                            }
                            startLevelTransition();
                        } else if (gameMode === 'race') {
                            const levelTime = (performance.now() - raceLevelStartTime) / 1000;
                            let bonusTime = 5.0;
                            let bonusAmount = 5;
                            if (levelTime <= 6.0) {
                                bonusTime = 10.0;
                                bonusAmount = 10;
                            }
                            raceTimeRemaining += bonusTime;
                            raceScore += 1;
                            showBonusOverlay(bonusAmount);
                            startLevelTransition();
                        } else {
                            setTimeout(() => {
                                platformController.enabled = false;
                                if (ui && ui.showLevelSelect) {
                                    ui.showLevelSelect();
                                } else if (ui && ui.showMainMenu) {
                                    ui.showMainMenu();
                                }
                            }, 2000);
                        }
                    } else {
                        // reset counter when not over the hole
                        holeBelowCounter = 0;
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

    // Update scene (animated sky, etc.)
    if (sceneSetup && typeof sceneSetup.update === 'function') sceneSetup.update(deltaTime);

    // Render scene
    sceneSetup.render(sceneSetup.scene, sceneSetup.camera);
    // Update DOM grid labels to follow camera/platform
    if (showGridCoords && gridLabelElements) updateGridLabels();
}

// Show end-of-race results overlay with high score and actions
function showRaceResults() {
    // Update high score
    if (raceScore > raceHighScore) {
        raceHighScore = raceScore;
        try { localStorage.setItem('raceHighScore', String(raceHighScore)); } catch (e) {}
    }

    const overlay = document.getElementById('raceResultsOverlay');
    if (!overlay) return;
    const levelsEl = document.getElementById('raceLevelsBeaten');
    const hsEl = document.getElementById('raceHighScore');
    const tryBtn = document.getElementById('raceTryAgainBtn');
    const menuBtn = document.getElementById('raceMainMenuBtn');

    if (levelsEl) levelsEl.textContent = `Levels Beaten: ${raceScore}`;
    if (hsEl) hsEl.textContent = `High Score: ${raceHighScore}`;

    overlay.classList.remove('hidden');

    // Rebind actions each time (overwrite old if any)
    if (tryBtn) tryBtn.onclick = () => {
        overlay.classList.add('hidden');
        // Restart race mode
        if (typeof window.__initRaceMode === 'function') window.__initRaceMode();
    };

    if (menuBtn) menuBtn.onclick = () => {
        overlay.classList.add('hidden');
        // Clean up scene and return to main menu
        platformController.enabled = false;
        gameState.reset();
        try {
            if (gameObjects && gameObjects.getPlatformGroup && sceneSetup && sceneSetup.scene) {
                sceneSetup.scene.remove(gameObjects.getPlatformGroup());
            }
        } catch (e) {}
        if (ui && ui.showMainMenu) ui.showMainMenu();
    };
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
