// Platform rotation and input handling
class PlatformController {
    constructor(gameState, inputController) {
        this.gameState = gameState;
        this.inputController = inputController;
        this.rotationSpeed = 0.1;
        this.maxRotation = 0.4; // ~23 degrees
    }

    update(deltaTime) {
        const keys = this.inputController.getKeys();
        let targetRotationX = this.gameState.getTargetRotation().x;
        let targetRotationZ = this.gameState.getTargetRotation().z;

        // Support Arrow keys and WASD (case-insensitive)
        const rightPressed = keys['ArrowRight'] || keys['d'];
        const leftPressed = keys['ArrowLeft'] || keys['a'];
        const upPressed = keys['ArrowUp'] || keys['w'];
        const downPressed = keys['ArrowDown'] || keys['s'];

        // Update target rotations based on input (scaled by deltaTime)
        if (rightPressed) {
            targetRotationZ = Math.max(targetRotationZ - this.rotationSpeed * deltaTime * 60, -this.maxRotation);
        }
        if (leftPressed) {
            targetRotationZ = Math.min(targetRotationZ + this.rotationSpeed * deltaTime * 60, this.maxRotation);
        }
        if (upPressed) {
            targetRotationX = Math.max(targetRotationX - this.rotationSpeed * deltaTime * 60, -this.maxRotation);
        }
        if (downPressed) {
            targetRotationX = Math.min(targetRotationX + this.rotationSpeed * deltaTime * 60, this.maxRotation);
        }

        // Smooth return to neutral (damping) - scaled by deltaTime
        const dampingFactor = Math.pow(0.95, deltaTime * 60);
        if (!rightPressed && !leftPressed) {
            targetRotationZ *= dampingFactor;
        }
        if (!upPressed && !downPressed) {
            targetRotationX *= dampingFactor;
        }

        this.gameState.setTargetRotation(targetRotationX, targetRotationZ);

        // Smoothly interpolate to target (scaled by deltaTime)
        const currentRotation = this.gameState.getRotation();
        const targetRotation = this.gameState.getTargetRotation();
        const interpolationFactor = Math.min(deltaTime * 10, 1);
        const newRotationX = currentRotation.x + (targetRotation.x - currentRotation.x) * interpolationFactor;
        const newRotationZ = currentRotation.z + (targetRotation.z - currentRotation.z) * interpolationFactor;

        this.gameState.setRotation(newRotationX, newRotationZ);
    }

    applyRotationToPlatform(platformGroup) {
        const rotation = this.gameState.getRotation();
        platformGroup.rotation.x = rotation.x;
        platformGroup.rotation.z = rotation.z;
    }
}
