// Game objects - platform, marble, obstacles, and hole
class GameObjects {
    constructor(scene, level = null) {
        this.platformGroup = new THREE.Group();
        scene.add(this.platformGroup);
        this.level = level;

        this.createPlatform();
        this.marble = this.createMarble();
        this.hole = this.createHole();
        // No obstacles or walls
    }

    createPlatform() {
        const platformGeometry = new THREE.BoxGeometry(20, 1, 20);
        const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.castShadow = true;
        platform.receiveShadow = true;
        platform.position.y = -0.5;
        this.platformGroup.add(platform);
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

    // No obstacles or walls

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
