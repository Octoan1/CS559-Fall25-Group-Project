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

        // Update target rotations based on input (scaled by deltaTime)
        if (keys['ArrowRight']) {
            targetRotationZ = Math.max(targetRotationZ - this.rotationSpeed * deltaTime * 60, -this.maxRotation);
        }
        if (keys['ArrowLeft']) {
            targetRotationZ = Math.min(targetRotationZ + this.rotationSpeed * deltaTime * 60, this.maxRotation);
        }
        if (keys['ArrowUp']) {
            targetRotationX = Math.max(targetRotationX - this.rotationSpeed * deltaTime * 60, -this.maxRotation);
        }
        if (keys['ArrowDown']) {
            targetRotationX = Math.min(targetRotationX + this.rotationSpeed * deltaTime * 60, this.maxRotation);
        }

        // Smooth return to neutral (damping) - scaled by deltaTime
        const dampingFactor = Math.pow(0.95, deltaTime * 60);
        if (!keys['ArrowRight'] && !keys['ArrowLeft']) {
            targetRotationZ *= dampingFactor;
        }
        if (!keys['ArrowUp'] && !keys['ArrowDown']) {
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
