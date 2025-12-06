// Platform rotation and input handling
class PlatformController {
    constructor(gameState, inputController) {
        this.gameState = gameState;
        this.inputController = inputController;
        this.rotationSpeed = 0.1;
        this.maxRotation = 0.4; // ~23 degrees
    }

    update() {
        const keys = this.inputController.getKeys();
        let targetRotationX = this.gameState.getTargetRotation().x;
        let targetRotationZ = this.gameState.getTargetRotation().z;

        // Update target rotations based on input
        if (keys['ArrowRight']) {
            targetRotationZ = Math.max(targetRotationZ - this.rotationSpeed, -this.maxRotation);
        }
        if (keys['ArrowLeft']) {
            targetRotationZ = Math.min(targetRotationZ + this.rotationSpeed, this.maxRotation);
        }
        if (keys['ArrowUp']) {
            targetRotationX = Math.max(targetRotationX - this.rotationSpeed, -this.maxRotation);
        }
        if (keys['ArrowDown']) {
            targetRotationX = Math.min(targetRotationX + this.rotationSpeed, this.maxRotation);
        }

        // Smooth return to neutral (damping)
        if (!keys['ArrowRight'] && !keys['ArrowLeft']) {
            targetRotationZ *= 0.95;
        }
        if (!keys['ArrowUp'] && !keys['ArrowDown']) {
            targetRotationX *= 0.95;
        }

        this.gameState.setTargetRotation(targetRotationX, targetRotationZ);

        // Smoothly interpolate to target
        const currentRotation = this.gameState.getRotation();
        const targetRotation = this.gameState.getTargetRotation();
        const newRotationX = currentRotation.x + (targetRotation.x - currentRotation.x) * 0.1;
        const newRotationZ = currentRotation.z + (targetRotation.z - currentRotation.z) * 0.1;

        this.gameState.setRotation(newRotationX, newRotationZ);
    }

    applyRotationToPlatform(platformGroup) {
        const rotation = this.gameState.getRotation();
        platformGroup.rotation.x = rotation.x;
        platformGroup.rotation.z = rotation.z;
    }
}
