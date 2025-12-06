// Main game orchestration
let sceneSetup;
let gameObjects;
let gameState;
let marblePhysics;
let inputController;
let platformController;
let physicsEngine;
let gameLogic;

function initializeGame() {
    // Initialize all game systems
    sceneSetup = new SceneSetup();
    gameObjects = new GameObjects(sceneSetup.scene);
    gameState = new GameState();
    marblePhysics = new MarblePhysics();
    inputController = new InputController();
    platformController = new PlatformController(gameState, inputController);
    physicsEngine = new PhysicsEngine();
    gameLogic = new GameLogic();

    // Setup input listeners
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'r') {
            resetGame();
        }
    });

    // Start game loop
    animate();
}

function resetGame() {
    gameState.reset();
    marblePhysics.reset();
    gameObjects.getMarble().position.set(-8, 1.5, -8);
    gameObjects.getPlatformGroup().rotation.x = 0;
    gameObjects.getPlatformGroup().rotation.z = 0;
    gameLogic.updateUI(gameState);
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameState.isWon) {
        // Update platform rotation
        platformController.update();
        platformController.applyRotationToPlatform(gameObjects.getPlatformGroup());

        // Update physics
        physicsEngine.update(
            marblePhysics,
            gameState,
            gameObjects.getObstacles(),
            gameObjects.getMarble()
        );

        // Check win condition
        if (gameLogic.checkWinCondition(marblePhysics)) {
            gameState.win();
            gameLogic.updateUI(gameState);
        }
    }

    // Render scene
    sceneSetup.render(sceneSetup.scene, sceneSetup.camera);
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', initializeGame);
