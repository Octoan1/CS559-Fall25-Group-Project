// Game objects - platform, marble, obstacles, and hole
class GameObjects {
    // Static properties to cache shaders
    static marbleVertexShader = null;
    static marbleFragmentShader = null;
    static shadersLoaded = false;
    static stumpVertexShader = null;
    static stumpFragmentShader = null;
    static stumpShadersLoaded = false;

    // Seeded random number generator for deterministic obstacle generation
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // Build an obstacle mesh that can look like a tree stump in light mode
    // and a darker block in dark mode. Returns the mesh with visualHeight
    // stored in userData so callers can place it flush on the platform.
    static createObstacleMesh({ width, depth, height = 0.5, darkMode = false, woodTexture = null, stoneTexture = null, seed = null }) {
        const useStump = !darkMode;

        if (useStump) {
            // Use seeded random if seed provided, otherwise use Math.random()
            const rand = (offset = 0) => seed !== null ? GameObjects.seededRandom(seed + offset) : Math.random();
            
            const minRadius = Math.min(width, depth) * 0.3;
            const maxRadius = Math.min(width, depth) * 0.55;
            const bottomRadius = THREE.MathUtils.clamp(minRadius * (1.1 + rand(1) * 0.6), 0.2, maxRadius);
            const topRadius = bottomRadius * (0.7 + rand(2) * 0.25);
            const stumpHeight = height * (0.9 + rand(3) * 0.5);

            // Closed cylinder with higher segments; keep caps flat to avoid holes
            const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, stumpHeight, 24, 1, false);
            geometry.computeVertexNormals();
            const sideMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x8b5a2b),
                roughness: 0.9,
                metalness: 0.0,
                map: woodTexture || null,
                side: THREE.FrontSide,
            });

            // Generate procedural ring texture for the top cap
            const ringCount = Math.floor(6 + rand(4) * 6);
            const ringTexture = GameObjects.createRingTexture(topRadius, ringCount);

            const topMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xd4b08c),
                roughness: 0.7,
                metalness: 0.0,
                side: THREE.FrontSide,
                map: ringTexture,
            });

            const mesh = new THREE.Mesh(geometry, [sideMaterial, topMaterial, topMaterial]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.visualHeight = stumpHeight;
            return mesh;
        }

        // Dark mode: create a rock-like icosahedron shape
        const baseRadius = Math.min(width, depth) * 0.4;
        const geometry = new THREE.IcosahedronGeometry(baseRadius, 2);
        // Jitter vertices slightly to make rocks more irregular
        const pos = geometry.attributes.position;
        const v = new THREE.Vector3();
        const rand = (offset = 0) => seed !== null ? GameObjects.seededRandom(seed + offset) : Math.random();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const jitter = 0.85 + rand(100 + i) * 0.3;
            v.multiplyScalar(jitter);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x777788),
            roughness: 0.85,
            metalness: 0.0,
            map: stoneTexture || null,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.visualHeight = height;
        return mesh;
    }

    // Update obstacle materials to match the current theme (handles single or multi-material meshes)
    static applyObstacleMaterial(mesh, darkMode, woodTexture = null, stoneTexture = null) {
        if (!mesh) return;
        const materialsArray = Array.isArray(mesh.material) ? mesh.material : [mesh.material || new THREE.MeshStandardMaterial()];

        for (let i = 0; i < materialsArray.length; i++) {
            const mat = materialsArray[i] || new THREE.MeshStandardMaterial();
            const isSide = i === 0; // CylinderGeometry groups: [sides, top, bottom]

            if (darkMode) {
                mat.color = new THREE.Color(isSide ? 0x555566 : 0x666677);
                mat.map = null;
                mat.roughness = 0.8;
                mat.metalness = 0.0;
                if (stoneTexture && !Array.isArray(mesh.material)) {
                    mat.map = stoneTexture;
                }
            } else {
                mat.color = new THREE.Color(isSide ? 0x8b5a2b : 0xd4b08c);
                mat.map = isSide && woodTexture ? woodTexture : mat.map; // Keep ring texture on top caps
                mat.roughness = isSide ? 0.9 : 0.7;
                mat.metalness = 0.0;
            }

            mat.needsUpdate = true;
            materialsArray[i] = mat;
        }

        mesh.material = Array.isArray(mesh.material) ? materialsArray : materialsArray[0];
    }

    // Create a procedural ring texture for stump tops
    static createRingTexture(radius, ringCount) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base color
        ctx.fillStyle = '#d4b08c';
        ctx.fillRect(0, 0, size, size);

        // Draw concentric rings from center outward
        const center = size / 2;
        const maxPixelRadius = size / 2;
        const ringWidth = maxPixelRadius / ringCount;

        for (let i = 1; i <= ringCount; i++) {
            const r = i * ringWidth;
            ctx.strokeStyle = i % 2 === 0 ? '#b8925a' : '#d4b08c'; // alternate darker/lighter
            ctx.lineWidth = ringWidth * 0.7;
            ctx.beginPath();
            ctx.arc(center, center, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }
    
    constructor(scene, level = null, darkMode = false) {
        this.platformGroup = new THREE.Group();
        scene.add(this.platformGroup);
        this.level = level;
        this.darkMode = darkMode;

        this.createPlatform();
        this.marble = this.createMarble();
        this.hole = this.createHole();
        this.obstacles = [];
        this.createObstacles();
    }
    
    // Static method to preload shaders
    static preloadShaders() {
        return new Promise((resolve) => {
            if (GameObjects.shadersLoaded && GameObjects.stumpShadersLoaded) {
                resolve();
                return;
            }
            
            const loader = new THREE.FileLoader();

            const maybeResolve = () => {
                if (GameObjects.shadersLoaded && GameObjects.stumpShadersLoaded) {
                    resolve();
                }
            };

            loader.load('shaders/ball.vs', (vs) => {
                GameObjects.marbleVertexShader = vs;
                GameObjects.shadersLoaded = Boolean(GameObjects.marbleFragmentShader);
                maybeResolve();
            });
            
            loader.load('shaders/ball.fs', (fs) => {
                GameObjects.marbleFragmentShader = fs;
                GameObjects.shadersLoaded = Boolean(GameObjects.marbleVertexShader);
                maybeResolve();
            });

            loader.load('shaders/stump.vs', (vs) => {
                GameObjects.stumpVertexShader = vs;
                GameObjects.stumpShadersLoaded = Boolean(GameObjects.stumpFragmentShader);
                maybeResolve();
            });
            
            loader.load('shaders/stump.fs', (fs) => {
                GameObjects.stumpFragmentShader = fs;
                GameObjects.stumpShadersLoaded = Boolean(GameObjects.stumpVertexShader);
                maybeResolve();
            });
        });
    }

    createPlatform() {
        const platformGeometry = new THREE.BoxGeometry(20, 1, 20);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.castShadow = true;
        platform.receiveShadow = true;
        platform.position.y = -0.5;
        this.platformGroup.add(platform);
        this.platformMesh = platform;
        
        // Load wood texture for light mode
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('../textures/wood.jpg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
            this.woodTexture = texture;
            // Apply texture if not in dark mode
            const darkModeCheckbox = document.getElementById('darkModeCheckbox');
            if (!darkModeCheckbox || !darkModeCheckbox.checked) {
                if (this.platformMesh && this.platformMesh.material) {
                    this.platformMesh.material.map = texture;
                    this.platformMesh.material.needsUpdate = true;
                }
                if (this.obstacles && this.obstacles.length) {
                    for (const obs of this.obstacles) {
                        GameObjects.applyObstacleMaterial(obs.mesh, false, texture, this.stoneTexture);
                    }
                }
            }
        });
        
        // Load stone texture for dark mode
        textureLoader.load('../textures/stone.jpg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
            this.stoneTexture = texture;
            // Apply texture if in dark mode
            const darkModeCheckbox = document.getElementById('darkModeCheckbox');
            if (darkModeCheckbox && darkModeCheckbox.checked) {
                if (this.platformMesh && this.platformMesh.material) {
                    this.platformMesh.material.map = texture;
                    this.platformMesh.material.needsUpdate = true;
                }
            }
        });
    }

    createMarble() {
        const marbleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        
        // Marble shader uniforms
        const marbleUniforms = {
            time: { value: 0.0 },
            baseColor: { value: new THREE.Color(0xff6347) }
        };
        
        this.marbleUniforms = marbleUniforms;
        
        // Use cached shaders if available
        let marbleMaterial;
        if (GameObjects.shadersLoaded && GameObjects.marbleVertexShader && GameObjects.marbleFragmentShader) {
            marbleMaterial = new THREE.ShaderMaterial({
                uniforms: marbleUniforms,
                vertexShader: GameObjects.marbleVertexShader,
                fragmentShader: GameObjects.marbleFragmentShader,
                lights: false
            });
        } else {
            // Fallback to standard material if shaders not loaded
            marbleMaterial = new THREE.MeshStandardMaterial({ color: 0xff6347 });
        }
        
        const marble = new THREE.Mesh(marbleGeometry, marbleMaterial);
        marble.castShadow = true;
        marble.receiveShadow = true;
        const start = (this.level && this.level.start) ? this.level.start : { x: -8, y: 1.0, z: -8 };
        marble.position.set(start.x, start.y, start.z);
        this.platformGroup.add(marble);
        this.marble = marble;
        return marble;
    }

    createHole() {
        const radius = (this.level && this.level.goal && this.level.goal.radius) ? this.level.goal.radius : 0.8;
        const holeGeometry = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
        const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        hole.castShadow = true;
        hole.receiveShadow = true;
        const goal = (this.level && this.level.goal) ? this.level.goal : { x: 8, y: 0.05, z: 8 };
        hole.position.set(goal.x, goal.y ?? 0.05, goal.z);
        this.platformGroup.add(hole);
        return hole;
    }

    // Create an obstacle. If `visible` is false, no THREE.Mesh is created
    // and the obstacle exists only as logical collision data.
    createObstacle(x, z, width, depth, height = 0.3, visible = true, gridCell = null) {
        let mesh = null;
        if (visible) {
            // Create a deterministic seed based on position
            const seed = Math.floor(x * 73856093) ^ Math.floor(z * 19349663);
            mesh = GameObjects.createObstacleMesh({
                width,
                depth,
                height,
                darkMode: this.darkMode,
                woodTexture: this.woodTexture,
                stoneTexture: this.stoneTexture,
                seed: seed,
            });
            const visualHeight = mesh.userData.visualHeight ?? height;
            mesh.position.set(x, visualHeight / 2, z);
            this.platformGroup.add(mesh);
        }

        this.obstacles.push({
            mesh: mesh,
            x: x,
            z: z,
            width: width,
            depth: depth,
            height: mesh && mesh.userData.visualHeight ? mesh.userData.visualHeight : height,
            gridCell: gridCell,
        });
    }

    setDarkMode(enabled) {
        const on = Boolean(enabled);
        // Always remember preference even if prototype mode overrides visuals
        this.darkMode = on;
        // If prototype mode is active, defer material updates until prototype is disabled
        if (this._prototypeMode) return;

        // Platform: different color but keep lighting properties similar to basic
        if (this.platformMesh) {
            const pMat = this.platformMesh.material || new THREE.MeshStandardMaterial();
            if (on) {
                pMat.color = new THREE.Color(0x3a3f44); // dark gray-blue tint
                pMat.roughness = 0.7;
                pMat.metalness = 0.0;
                // Apply stone texture in dark mode if available
                if (this.stoneTexture) {
                    pMat.map = this.stoneTexture;
                }
            } else {
                pMat.color = new THREE.Color(0x8b4513);
                pMat.roughness = 0.7;
                pMat.metalness = 0.0;
                // Apply wood texture in light mode if available
                if (this.woodTexture) {
                    pMat.map = this.woodTexture;
                }
            }
            pMat.needsUpdate = true;
            this.platformMesh.material = pMat;
        }

        // Marble: update base color in shader uniform
        if (this.marble && this.marbleUniforms) {
            if (on) {
                this.marbleUniforms.baseColor.value.setHex(0x00aaff);
            } else {
                this.marbleUniforms.baseColor.value.setHex(0xff6347);
            }
        }

        // Obstacles: update color and swap shape if needed
        for (const obs of this.obstacles) {
            if (!obs.mesh) continue;
            
            // Dispose old materials
            if (Array.isArray(obs.mesh.material)) {
                obs.mesh.material.forEach(mat => mat.dispose());
            } else if (obs.mesh.material) {
                obs.mesh.material.dispose();
            }
            
            // Swap shape: rock for dark mode, stump for light mode
            if (on) {
                // Replace with rock shape (icosahedron) with random size variation
                const baseRadius = Math.min(obs.width, obs.depth) * (0.35 + Math.random() * 0.15);
                const rockGeometry = new THREE.IcosahedronGeometry(baseRadius, 2);
                const pos = rockGeometry.attributes.position;
                const v = new THREE.Vector3();
                for (let i = 0; i < pos.count; i++) {
                    v.fromBufferAttribute(pos, i);
                    const jitter = 0.85 + Math.random() * 0.3;
                    v.multiplyScalar(jitter);
                    pos.setXYZ(i, v.x, v.y, v.z);
                }
                rockGeometry.computeVertexNormals();
                obs.mesh.geometry.dispose();
                obs.mesh.geometry = rockGeometry;
                obs.mesh.scale.set(1, 1, 1);
                
                // Set rock material directly
                const rockMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x777788),
                    roughness: 0.85,
                    metalness: 0.0,
                    map: this.stoneTexture || null,
                });
                obs.mesh.material = rockMaterial;
            } else {
                // Replace with stump shape (cylinder)
                const bottomRadius = Math.min(obs.width, obs.depth) * 0.55;
                const topRadius = bottomRadius * (0.7 + Math.random() * 0.25);
                const stumpGeometry = new THREE.CylinderGeometry(topRadius, bottomRadius, obs.height, 24, 1, false);
                stumpGeometry.computeVertexNormals();
                obs.mesh.geometry.dispose();
                obs.mesh.geometry = stumpGeometry;
                obs.mesh.scale.set(1, 1, 1);
                
                // Set stump materials directly (array for cylinder sides/top/bottom)
                const sideMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x8b5a2b),
                    roughness: 0.9,
                    metalness: 0.0,
                    map: this.woodTexture || null,
                });
                const ringTexture = GameObjects.createRingTexture(topRadius, 6 + Math.floor(Math.random() * 7));
                const topMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0xd4b08c),
                    roughness: 0.7,
                    metalness: 0.0,
                    map: ringTexture,
                });
                obs.mesh.material = [sideMaterial, topMaterial, topMaterial];
            }
        }
    }

    // Populate obstacles from a 2D grid array. Each grid cell that is truthy
    // will spawn an obstacle. The grid should be an array of rows: grid[row][col].
    // Options:
    //  - cellSize: size in world units of each grid cell (default 1)
    //  - obstacleSize: {w,d,h} default {1,1,0.5}
    //  - visible: whether to create visible meshes (default true)
    populateFromGrid(grid, options = {}) {
        if (!Array.isArray(grid) || !grid.length) return;
        const rows = grid.length;
        const cols = grid[0].length;
        const cellSize = options.cellSize || 1;
        const obstacleSize = options.obstacleSize || { w: 1, d: 1, h: 0.5 };
        const visible = options.visible !== undefined ? options.visible : true;

        // Remove existing obstacle meshes from platformGroup
        for (const obs of this.obstacles) {
            if (obs.mesh) this.platformGroup.remove(obs.mesh);
        }
        this.obstacles = [];

        // Map grid indices to world coordinates. Grid is centered on the platform.
        const halfCols = (cols - 1) / 2;
        const halfRows = (rows - 1) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (!cell) continue; // skip empty

                // Compute world position (x,z) for cell center.
                // Offset by half a cell so obstacles sit in the middle of grid cells
                    const x = (c - halfCols) * cellSize;
                    const z = (r - halfRows) * cellSize;

                this.createObstacle(x, z, obstacleSize.w, obstacleSize.d, obstacleSize.h, visible);
            }
        }
    }

    createObstacles() {
        if (this.level && Array.isArray(this.level.walls) && this.level.walls.length) {
            const rows = this.level.gridRows || 20;
            const cols = this.level.gridCols || 20;
            const cellSizeX = this.level.cellSizeX || (20 / cols);
            const cellSizeZ = this.level.cellSizeZ || (20 / rows);
            for (const w of this.level.walls) {
                // walls are [col, row, width, depth] in grid units
                const [col, row, wUnits = 1, dUnits = 1] = w;
                const x = (col + 0.5 - cols / 2) * cellSizeX;
                const z = (row + 0.5 - rows / 2) * cellSizeZ;
                const width = wUnits * cellSizeX;
                const depth = dUnits * cellSizeZ;
                // use a thin wall height to act as obstacle
                this.createObstacle(x, z, width, depth, 0.5, true, [col, row]);
            }
            return;
        }

        // default obstacle layout
        this.createObstacle(0, -5, 2, 2);      // Center obstacle
        this.createObstacle(-5, 0, 2, 2);      // Left obstacle
        this.createObstacle(5, 0, 2, 2);       // Right obstacle
        this.createObstacle(0, 5, 1.5, 1.5);   // Upper center
        this.createObstacle(-3, 3, 1, 1);      // Upper left
        this.createObstacle(3, 3, 1, 1);       // Upper right
    }

    getPlatformGroup() {
        return this.platformGroup;
    }

    getMarble() {
        return this.marble;
    }

    getHole() {
        return this.hole;
    }

    setPrototypeMode(enabled) {
        const on = Boolean(enabled);
        this._prototypeMode = on;

        if (on) {
            // Simple flat materials and disable shadows for faster rendering
            if (this.platformMesh) {
                this.platformMesh.material = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
                this.platformMesh.castShadow = false;
                this.platformMesh.receiveShadow = false;
            }
            if (this.marble) {
                // Use basic material (keep color similar to current darkMode selection)
                const color = this.darkMode ? 0x00aaff : 0xff6347;
                this.marble.material = new THREE.MeshBasicMaterial({ color });
                this.marble.castShadow = false;
                this.marble.receiveShadow = false;
            }
            for (const obs of this.obstacles) {
                if (!obs.mesh) continue;
                // Replace obstacle geometry with a simple cube for prototype mode
                try {
                    if (obs.mesh.geometry && obs.mesh.geometry.dispose) obs.mesh.geometry.dispose();
                } catch (e) { /* ignore dispose errors */ }

                // Use a uniform prototype height so all cubes match visually
                const protoHeight = 0.8;
                const boxGeo = new THREE.BoxGeometry(obs.width, protoHeight, obs.depth);
                obs.mesh.geometry = boxGeo;
                // Position the cube so it sits flush on the platform and update logical height
                obs.mesh.position.y = protoHeight / 2;
                obs.height = protoHeight;

                const color = this.darkMode ? 0x777788 : 0x808080;
                obs.mesh.material = new THREE.MeshBasicMaterial({ color });
                obs.mesh.castShadow = false;
                obs.mesh.receiveShadow = false;
            }
        } else {
            // Restore detailed materials consistent with current darkMode setting
            if (this.platformMesh) {
                const pMat = new THREE.MeshStandardMaterial({ color: this.darkMode ? 0x3a3f44 : 0x8b4513, roughness: 0.7 });
                if (this.darkMode && this.stoneTexture) pMat.map = this.stoneTexture;
                if (!this.darkMode && this.woodTexture) pMat.map = this.woodTexture;
                this.platformMesh.material = pMat;
                this.platformMesh.castShadow = true;
                this.platformMesh.receiveShadow = true;
            }
            // Restore marble material (shader if available, otherwise standard)
            if (this.marble) {
                // Dispose previous prototype material to avoid leaks
                try {
                    if (Array.isArray(this.marble.material)) {
                        this.marble.material.forEach(m => { if (m && m.dispose) m.dispose(); });
                    } else if (this.marble.material && this.marble.material.dispose) {
                        this.marble.material.dispose();
                    }
                } catch (e) { /* ignore dispose errors */ }

                // Create appropriate detailed material
                if (GameObjects.shadersLoaded && GameObjects.marbleVertexShader && GameObjects.marbleFragmentShader && this.marbleUniforms) {
                    this.marble.material = new THREE.ShaderMaterial({
                        uniforms: this.marbleUniforms,
                        vertexShader: GameObjects.marbleVertexShader,
                        fragmentShader: GameObjects.marbleFragmentShader,
                        lights: false
                    });
                } else {
                    const color = this.darkMode ? 0x00aaff : 0xff6347;
                    this.marble.material = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.4 });
                    // If using standard material, also update color immediately
                    this.marble.material.needsUpdate = true;
                }

                // Ensure shadows are enabled on the marble
                this.marble.castShadow = true;
                this.marble.receiveShadow = true;
            }

            // Re-apply darkMode materials for obstacles and other updates
            this.setDarkMode(this.darkMode);
            for (const obs of this.obstacles) {
                if (!obs.mesh) continue;
                obs.mesh.castShadow = true;
                obs.mesh.receiveShadow = true;
            }
        }
    }

    getObstacles() {
        return this.obstacles;
    }
}
