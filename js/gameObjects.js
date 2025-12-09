// Game objects - platform, marble, obstacles, and hole
class GameObjects {
    constructor(scene, level = null) {
        this.platformGroup = new THREE.Group();
        scene.add(this.platformGroup);
        this.level = level;

        this.createPlatform();
        this.marble = this.createMarble();
        this.hole = this.createHole();
        this.obstacles = [];
        this.createObstacles();
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
    }

    createMarble() {
        const marbleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const marbleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff6347, 
            metalness: 0.6, 
            roughness: 0.4 
        });
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
    createObstacle(x, z, width, depth, height = 0.3, visible = true) {
        let mesh = null;
        if (visible) {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, height / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.platformGroup.add(mesh);
        }

        this.obstacles.push({
            mesh: mesh,
            x: x,
            z: z,
            width: width,
            depth: depth,
            height: height,
        });
    }

    setDarkMode(enabled) {
        const on = Boolean(enabled);

        // Platform: different color but keep lighting properties similar to basic
        if (this.platformMesh) {
            const pMat = this.platformMesh.material || new THREE.MeshStandardMaterial();
            if (on) {
                pMat.color = new THREE.Color(0x3a3f44); // dark gray-blue tint
                pMat.roughness = 0.7;
                pMat.metalness = 0.0;
            } else {
                pMat.color = new THREE.Color(0x8b4513);
                pMat.roughness = 0.7;
                pMat.metalness = 0.0;
            }
            pMat.needsUpdate = true;
            this.platformMesh.material = pMat;
        }

        // Marble: neon/cool color in dark mode
        if (this.marble) {
            const mMat = this.marble.material || new THREE.MeshStandardMaterial();
            if (on) {
                mMat.color = new THREE.Color(0x00aaff);
                mMat.emissive = new THREE.Color(0x000000);
                mMat.emissiveIntensity = 0.0;
                mMat.metalness = 0.6;
                mMat.roughness = 0.4;
            } else {
                mMat.color = new THREE.Color(0xff6347);
                mMat.emissive = new THREE.Color(0x000000);
                mMat.emissiveIntensity = 0.0;
                mMat.metalness = 0.6;
                mMat.roughness = 0.4;
            }
            mMat.needsUpdate = true;
            this.marble.material = mMat;
        }

        // Obstacles: subtle tint in dark mode
        for (const obs of this.obstacles) {
            if (!obs.mesh) continue;
            const oMat = obs.mesh.material || new THREE.MeshStandardMaterial();
            if (on) {
                oMat.color = new THREE.Color(0x555566);
                oMat.emissive = new THREE.Color(0x000000);
                oMat.emissiveIntensity = 0.0;
                oMat.metalness = 0.0;
                oMat.roughness = 0.7;
            } else {
                oMat.color = new THREE.Color(0x808080);
                oMat.emissive = new THREE.Color(0x000000);
                oMat.emissiveIntensity = 0.0;
                oMat.metalness = 0.0;
                oMat.roughness = 0.8;
            }
            oMat.needsUpdate = true;
            obs.mesh.material = oMat;
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
                this.createObstacle(x, z, width, depth, 0.5);
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

    getObstacles() {
        return this.obstacles;
    }
}
