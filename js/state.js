// Input handling and game state management
class InputController {
    constructor() {
        this.keys = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    isKeyPressed(key) {
        return this.keys[key] || false;
    }

    getKeys() {
        return this.keys;
    }
}

// Game state and logic
class GameState {
    constructor() {
        this.isWon = false;
        this.rotationX = 0;
        this.rotationZ = 0;
        this.targetRotationX = 0;
        this.targetRotationZ = 0;
        this.ballGrounded = false;
    }

    reset() {
        this.isWon = false;
        this.rotationX = 0;
        this.rotationZ = 0;
        this.targetRotationX = 0;
        this.targetRotationZ = 0;
        this.ballGrounded = false;
    }

    win() {
        this.isWon = true;
    }

    setRotation(x, z) {
        this.rotationX = x;
        this.rotationZ = z;
    }

    setTargetRotation(x, z) {
        this.targetRotationX = x;
        this.targetRotationZ = z;
    }

    getRotation() {
        return { x: this.rotationX, z: this.rotationZ };
    }

    getTargetRotation() {
        return { x: this.targetRotationX, z: this.targetRotationZ };
    }
}

// Marble physics state
class MarblePhysics {

    level = null;

    constructor(level = null) {
        this.level = level;
        this.position = (level && level.start) ? new THREE.Vector3(level.start.x, level.start.y, level.start.z) : new THREE.Vector3(-8, 1.5, -8);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.mass = 1;
    }

    reset() {
        (this.level && this.level.start) ? this.position.set(this.level.start.x, this.level.start.y, this.level.start.z) : this.position.set(-8, 1.5, -8);
        this.velocity.set(0, 0, 0);
    }

    getPosition() {
        return this.position;
    }

    getVelocity() {
        return this.velocity;
    }
}
